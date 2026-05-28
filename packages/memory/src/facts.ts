import { embed } from "ai";
import { randomUUID } from "node:crypto";
import { logger, prisma, type MemoryCategory } from "@hermes/shared";
import { embedModel } from "@hermes/shared/llm";
import type { MemoryCandidate, MemoryRecord } from "./types.js";
import { rowToMemory, vectorLiteral } from "./utils.js";

const DEDUPE_THRESHOLD = 0.92;

export interface Fact {
  id: string;
  content: string;
  category: MemoryCategory;
  createdAt: Date;
}

export class FactMemory {
  constructor(public readonly userId: string) {
    if (!userId) throw new Error("FactMemory requires a user id");
  }

  async upsert(fact: MemoryCandidate): Promise<MemoryRecord> {
    const embedding = await this.tryEmbedText(fact.content);

    if (fact.subject && fact.predicate && fact.value) {
      const conflict = await this.findActiveBySubjectPredicate(
        fact.subject,
        fact.predicate,
      );
      if (
        conflict &&
        normalize(conflict.value) !== normalize(fact.value)
      ) {
        return this.supersede(conflict, fact, embedding);
      }
    }

    const duplicate = embedding
      ? await this.findDuplicate(fact.content, embedding)
      : await this.findTextDuplicate(fact.content);
    if (duplicate) return this.touchDuplicate(duplicate, fact, embedding);

    return this.insert(fact, embedding);
  }

  async search(query: string, limit = 10): Promise<MemoryRecord[]> {
    const embedding = await this.tryEmbedText(query);
    if (!embedding) return this.keywordSearch(query, limit);
    const vector = vectorLiteral(embedding);
    const rows = await prisma.$queryRawUnsafe<Array<Record<string, unknown>>>(
      `
      SELECT
        id,
        user_id,
        content,
        category,
        subject,
        predicate,
        value,
        source_type,
        source_id,
        confidence,
        status,
        valid_from,
        valid_until,
        supersedes_memory_id,
        metadata,
        created_at,
        updated_at,
        1 - (embedding <=> $1::vector) AS score
      FROM memories
      WHERE user_id = $2
        AND status = 'active'
        AND embedding IS NOT NULL
      ORDER BY embedding <=> $1::vector, updated_at DESC
      LIMIT $3
      `,
      vector,
      this.userId,
      limit,
    );
    return rows.map(rowToMemory);
  }

  async listByCategories(
    categories: string[],
    limit = 20,
  ): Promise<MemoryRecord[]> {
    if (!categories.length) return [];
    const rows = await prisma.$queryRawUnsafe<Array<Record<string, unknown>>>(
      `
      SELECT
        id,
        user_id,
        content,
        category,
        subject,
        predicate,
        value,
        source_type,
        source_id,
        confidence,
        status,
        valid_from,
        valid_until,
        supersedes_memory_id,
        metadata,
        created_at,
        updated_at
      FROM memories
      WHERE user_id = $1
        AND status = 'active'
        AND category = ANY($2::text[])
      ORDER BY updated_at DESC
      LIMIT $3
      `,
      this.userId,
      categories,
      limit,
    );
    return rows.map(rowToMemory);
  }

  async forget(query: string): Promise<MemoryRecord[]> {
    const matches = await this.search(query, 5);
    const ids = matches.map((m) => m.id);
    if (!ids.length) return [];
    await prisma.$executeRawUnsafe(
      `
      UPDATE memories
      SET status = 'deleted', valid_until = now(), updated_at = now()
      WHERE id = ANY($1::uuid[]) AND user_id = $2
      `,
      ids,
      this.userId,
    );
    return matches;
  }

  private async findDuplicate(
    content: string,
    embedding: number[],
  ): Promise<MemoryRecord | null> {
    const vector = vectorLiteral(embedding);
    const rows = await prisma.$queryRawUnsafe<Array<Record<string, unknown>>>(
      `
      SELECT
        id,
        user_id,
        content,
        category,
        subject,
        predicate,
        value,
        source_type,
        source_id,
        confidence,
        status,
        valid_from,
        valid_until,
        supersedes_memory_id,
        metadata,
        created_at,
        updated_at,
        1 - (embedding <=> $1::vector) AS score
      FROM memories
      WHERE user_id = $2
        AND status = 'active'
        AND embedding IS NOT NULL
      ORDER BY embedding <=> $1::vector
      LIMIT 1
      `,
      vector,
      this.userId,
    );
    const match = rows[0] ? rowToMemory(rows[0]) : null;
    if (!match || (match.score ?? 0) < DEDUPE_THRESHOLD) return null;
    return match;
  }

  private async findActiveBySubjectPredicate(
    subject: string,
    predicate: string,
  ): Promise<MemoryRecord | null> {
    const rows = await prisma.$queryRaw<Array<Record<string, unknown>>>`
      SELECT
        id,
        user_id,
        content,
        category,
        subject,
        predicate,
        value,
        source_type,
        source_id,
        confidence,
        status,
        valid_from,
        valid_until,
        supersedes_memory_id,
        metadata,
        created_at,
        updated_at
      FROM memories
      WHERE user_id = ${this.userId}
        AND status = 'active'
        AND lower(subject) = lower(${subject})
        AND lower(predicate) = lower(${predicate})
      ORDER BY updated_at DESC
      LIMIT 1
    `;
    return rows[0] ? rowToMemory(rows[0]) : null;
  }

  private async supersede(
    oldMemory: MemoryRecord,
    fact: MemoryCandidate,
    embedding: number[] | null,
  ): Promise<MemoryRecord> {
    await prisma.$executeRaw`
      UPDATE memories
      SET status = 'superseded', valid_until = now(), updated_at = now()
      WHERE id = ${oldMemory.id}::uuid AND user_id = ${this.userId}
    `;
    return this.insert(
      {
        ...fact,
        metadata: {
          ...(fact.metadata ?? {}),
          supersededContent: oldMemory.content,
        },
      },
      embedding,
      oldMemory.id,
    );
  }

  private async touchDuplicate(
    existing: MemoryRecord,
    fact: MemoryCandidate,
    embedding: number[] | null,
  ): Promise<MemoryRecord> {
    const vector = embedding ? vectorLiteral(embedding) : null;
    const rows = await prisma.$queryRawUnsafe<Array<Record<string, unknown>>>(
      `
      UPDATE memories
      SET
        content = $1,
        category = $2,
        subject = COALESCE($3, subject),
        predicate = COALESCE($4, predicate),
        value = COALESCE($5, value),
        source_type = COALESCE($6, source_type),
        source_id = COALESCE($7, source_id),
        confidence = GREATEST(confidence, $8),
        metadata = metadata || $9::jsonb,
        embedding = COALESCE($10::vector, embedding),
        updated_at = now()
      WHERE id = $11::uuid AND user_id = $12
      RETURNING
        id,
        user_id,
        content,
        category,
        subject,
        predicate,
        value,
        source_type,
        source_id,
        confidence,
        status,
        valid_from,
        valid_until,
        supersedes_memory_id,
        metadata,
        created_at,
        updated_at
      `,
      fact.content,
      fact.category,
      fact.subject ?? null,
      fact.predicate ?? null,
      fact.value ?? null,
      fact.sourceType ?? null,
      fact.sourceId ?? null,
      fact.confidence ?? existing.confidence,
      JSON.stringify(fact.metadata ?? {}),
      vector,
      existing.id,
      this.userId,
    );
    const row = rows[0];
    if (!row) throw new Error("touchDuplicate failed to return updated row");
    return rowToMemory(row);
  }

  private async insert(
    fact: MemoryCandidate,
    embedding: number[] | null,
    supersedesMemoryId?: string,
  ): Promise<MemoryRecord> {
    const vector = embedding ? vectorLiteral(embedding) : null;
    const rows = await prisma.$queryRawUnsafe<Array<Record<string, unknown>>>(
      `
      INSERT INTO memories (
        id,
        user_id,
        content,
        source,
        category,
        subject,
        predicate,
        value,
        source_type,
        source_id,
        confidence,
        status,
        valid_from,
        supersedes_memory_id,
        metadata,
        embedding,
        created_at,
        updated_at
      )
      VALUES (
        $1::uuid,
        $2,
        $3,
        $4,
        $5,
        $6,
        $7,
        $8,
        $9,
        $10,
        $11,
        'active',
        now(),
        $12::uuid,
        $13::jsonb,
        $14::vector,
        now(),
        now()
      )
      RETURNING
        id,
        user_id,
        content,
        category,
        subject,
        predicate,
        value,
        source_type,
        source_id,
        confidence,
        status,
        valid_from,
        valid_until,
        supersedes_memory_id,
        metadata,
        created_at,
        updated_at
      `,
      randomUUID(),
      this.userId,
      fact.content,
      fact.sourceType ?? "extraction",
      fact.category,
      fact.subject ?? null,
      fact.predicate ?? null,
      fact.value ?? null,
      fact.sourceType ?? "extraction",
      fact.sourceId ?? null,
      fact.confidence ?? 0.7,
      supersedesMemoryId ?? null,
      JSON.stringify(fact.metadata ?? {}),
      vector,
    );
    const row = rows[0];
    if (!row) throw new Error("insert memory failed to return inserted row");
    return rowToMemory(row);
  }

  private async keywordSearch(
    query: string,
    limit: number,
  ): Promise<MemoryRecord[]> {
    const terms = query
      .toLowerCase()
      .split(/[^a-z0-9@._-]+/i)
      .map((t) => t.trim())
      .filter((t) => t.length >= 3)
      .filter((t) => !["what", "you", "remember", "about", "that"].includes(t));
    const rows = await prisma.$queryRawUnsafe<Array<Record<string, unknown>>>(
      `
      SELECT
        id,
        user_id,
        content,
        category,
        subject,
        predicate,
        value,
        source_type,
        source_id,
        confidence,
        status,
        valid_from,
        valid_until,
        supersedes_memory_id,
        metadata,
        created_at,
        updated_at,
        0.75 AS score
      FROM memories
      WHERE user_id = $1
        AND status = 'active'
        AND (
          content ILIKE '%' || $2 || '%'
          OR EXISTS (
            SELECT 1
            FROM unnest($3::text[]) AS term
            WHERE content ILIKE '%' || term || '%'
          )
          OR to_tsvector('english', content) @@ websearch_to_tsquery('english', $2)
        )
      ORDER BY updated_at DESC
      LIMIT $4
      `,
      this.userId,
      query,
      terms,
      limit,
    );
    return rows.map(rowToMemory);
  }

  private async findTextDuplicate(content: string): Promise<MemoryRecord | null> {
    const rows = await prisma.$queryRaw<Array<Record<string, unknown>>>`
      SELECT
        id,
        user_id,
        content,
        category,
        subject,
        predicate,
        value,
        source_type,
        source_id,
        confidence,
        status,
        valid_from,
        valid_until,
        supersedes_memory_id,
        metadata,
        created_at,
        updated_at
      FROM memories
      WHERE user_id = ${this.userId}
        AND status = 'active'
        AND lower(content) = lower(${content})
      LIMIT 1
    `;
    return rows[0] ? rowToMemory(rows[0]) : null;
  }

  private async tryEmbedText(content: string): Promise<number[] | null> {
    try {
      return await this.embedText(content);
    } catch (err) {
      logger.warn(
        { err },
        "embedding failed; storing/searching memory without vector",
      );
      return null;
    }
  }

  private async embedText(content: string): Promise<number[]> {
    const result = await embed({
      model: embedModel,
      value: content,
    });
    return result.embedding;
  }
}

function normalize(value: unknown): string {
  return String(value ?? "").trim().toLowerCase();
}
