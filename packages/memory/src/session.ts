import { prisma, redis, type AgentMessage } from "@hermes/shared";
import { createHash, randomUUID } from "node:crypto";
import type { ConversationMessage, ConversationMessageInput } from "./types.js";

export class ConversationStore {
  constructor(public readonly userId: string) {
    if (!userId) throw new Error("ConversationStore requires a user id");
  }

  async ensureConversation(conversationId: string): Promise<void> {
    const id = conversationDbId(conversationId);
    await prisma.$executeRaw`
      INSERT INTO conversations (id, user_id, created_at, updated_at)
      VALUES (${id}::uuid, ${this.userId}, now(), now())
      ON CONFLICT (id) DO NOTHING
    `;
    const rows = await prisma.$queryRaw<Array<{ userId: string }>>`
      SELECT user_id AS "userId"
      FROM conversations
      WHERE id = ${id}::uuid
      LIMIT 1
    `;
    const owner = rows[0]?.userId;
    if (owner !== this.userId) {
      throw new Error("conversation does not belong to the authenticated user");
    }
    await prisma.$executeRaw`
      UPDATE conversations
      SET updated_at = now()
      WHERE id = ${id}::uuid
        AND user_id = ${this.userId}
    `;
  }

  async appendMessage(
    conversationId: string,
    message: ConversationMessageInput,
  ): Promise<ConversationMessage> {
    await this.ensureConversation(conversationId);
    const id = conversationDbId(conversationId);
    const rows = await prisma.$queryRaw<Array<Record<string, unknown>>>`
      INSERT INTO messages (
        id,
        conversation_id,
        role,
        content,
        name,
        tool_calls,
        metadata,
        created_at
      )
      VALUES (
        ${randomUUID()}::uuid,
        ${id}::uuid,
        ${message.role},
        ${message.content},
        ${message.name ?? null},
        ${message.toolCalls ? JSON.stringify(message.toolCalls) : null}::jsonb,
        ${JSON.stringify(message.metadata ?? {})}::jsonb,
        now()
      )
      RETURNING id, conversation_id, role, content, name, tool_calls, metadata, created_at
    `;
    const row = rows[0];
    if (!row) throw new Error("appendMessage failed to return inserted row");
    const saved = rowToConversationMessage(row);
    if (message.role === "user") {
      await this.setTitleFromFirstUserMessage(conversationId, message.content);
    }
    await this.cacheMessage(conversationId, saved);
    return saved;
  }

  async recent(
    conversationId: string,
    limit = 20,
  ): Promise<ConversationMessage[]> {
    const cached = await this.recentFromCache(conversationId, limit);
    if (cached.length) return cached;

    const id = conversationDbId(conversationId);
    const rows = await prisma.$queryRaw<Array<Record<string, unknown>>>`
      SELECT id, conversation_id, role, content, name, tool_calls, metadata, created_at
      FROM messages m
      INNER JOIN conversations c ON c.id = m.conversation_id
      WHERE m.conversation_id = ${id}::uuid
        AND c.user_id = ${this.userId}
      ORDER BY m.created_at DESC
      LIMIT ${limit}
    `;
    const messages = rows.map(rowToConversationMessage).reverse();
    await this.seedCache(conversationId, messages);
    return messages;
  }

  async list(limit = 50): Promise<
    Array<{
      id: string;
      threadId: string;
      title: string | null;
      createdAt: Date;
      updatedAt: Date;
      messageCount: number;
    }>
  > {
    const rows = await prisma.$queryRaw<Array<Record<string, unknown>>>`
      SELECT
        c.id,
        c.title,
        c.created_at,
        c.updated_at,
        COUNT(m.id)::int AS message_count
      FROM conversations c
      LEFT JOIN messages m ON m.conversation_id = c.id
      WHERE c.user_id = ${this.userId}
      GROUP BY c.id
      HAVING COUNT(m.id) > 0
      ORDER BY c.updated_at DESC
      LIMIT ${limit}
    `;
    return rows.map((row) => ({
      id: String(row.id),
      threadId: String(row.id),
      title: row.title ? String(row.title) : null,
      createdAt:
        row.created_at instanceof Date
          ? row.created_at
          : new Date(String(row.created_at)),
      updatedAt:
        row.updated_at instanceof Date
          ? row.updated_at
          : new Date(String(row.updated_at)),
      messageCount: Number(row.message_count ?? 0),
    }));
  }

  async allMessages(conversationId: string): Promise<ConversationMessage[]> {
    const id = conversationDbId(conversationId);
    const rows = await prisma.$queryRaw<Array<Record<string, unknown>>>`
      SELECT id, conversation_id, role, content, name, tool_calls, metadata, created_at
      FROM messages m
      INNER JOIN conversations c ON c.id = m.conversation_id
      WHERE m.conversation_id = ${id}::uuid
        AND c.user_id = ${this.userId}
      ORDER BY m.created_at ASC
    `;
    return rows.map(rowToConversationMessage);
  }

  async getSummary(conversationId: string): Promise<string | null> {
    const id = conversationDbId(conversationId);
    const rows = await prisma.$queryRaw<Array<{ summary: string | null }>>`
      SELECT summary
      FROM conversations
      WHERE id = ${id}::uuid
        AND user_id = ${this.userId}
      LIMIT 1
    `;
    return rows[0]?.summary ?? null;
  }

  async updateSummary(conversationId: string, summary: string): Promise<void> {
    await this.ensureConversation(conversationId);
    const id = conversationDbId(conversationId);
    await prisma.$executeRaw`
      UPDATE conversations
      SET summary = ${summary}, updated_at = now()
      WHERE id = ${id}::uuid
        AND user_id = ${this.userId}
    `;
  }

  private async setTitleFromFirstUserMessage(
    conversationId: string,
    content: string,
  ): Promise<void> {
    const id = conversationDbId(conversationId);
    const title = content.replace(/\s+/g, " ").trim().slice(0, 80);
    if (!title) return;
    await prisma.$executeRaw`
      UPDATE conversations
      SET title = COALESCE(title, ${title}), updated_at = now()
      WHERE id = ${id}::uuid
        AND user_id = ${this.userId}
    `;
  }

  private cacheKey(conversationId: string): string {
    return `session:${this.userId}:${conversationDbId(conversationId)}:messages`;
  }

  private async cacheMessage(
    conversationId: string,
    message: ConversationMessage,
  ): Promise<void> {
    if (!process.env.REDIS_URL) return;
    try {
      const client = redis();
      const key = this.cacheKey(conversationId);
      await client.rpush(key, JSON.stringify(message));
      await client.ltrim(key, -50, -1);
      await client.expire(key, 60 * 60);
    } catch {
      // Redis is a hot cache; Postgres remains the source of truth.
    }
  }

  private async seedCache(
    conversationId: string,
    messages: ConversationMessage[],
  ): Promise<void> {
    if (!process.env.REDIS_URL || !messages.length) return;
    try {
      const client = redis();
      const key = this.cacheKey(conversationId);
      await client.del(key);
      await client.rpush(key, ...messages.map((m) => JSON.stringify(m)));
      await client.expire(key, 60 * 60);
    } catch {
      // Redis is optional.
    }
  }

  private async recentFromCache(
    conversationId: string,
    limit: number,
  ): Promise<ConversationMessage[]> {
    if (!process.env.REDIS_URL) return [];
    try {
      const values = await redis().lrange(this.cacheKey(conversationId), -limit, -1);
      return values.map((value) => reviveConversationMessage(JSON.parse(value)));
    } catch {
      return [];
    }
  }
}

// Backward-compatible facade for the Phase 2 placeholder name.
export class SessionMemory {
  private readonly store: ConversationStore;

  constructor(
    public readonly sessionId: string,
    userId: string,
  ) {
    this.store = new ConversationStore(userId);
  }

  async append(message: AgentMessage): Promise<void> {
    await this.store.appendMessage(this.sessionId, message);
  }

  async recent(limit = 20): Promise<AgentMessage[]> {
    return this.store.recent(this.sessionId, limit);
  }
}

function conversationDbId(id: string): string {
  if (
    /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
      id,
    )
  ) {
    return id;
  }
  const hex = createHash("sha256").update(id).digest("hex").slice(0, 32);
  return [
    hex.slice(0, 8),
    hex.slice(8, 12),
    `4${hex.slice(13, 16)}`,
    `8${hex.slice(17, 20)}`,
    hex.slice(20, 32),
  ].join("-");
}

function rowToConversationMessage(
  row: Record<string, unknown>,
): ConversationMessage {
  return {
    id: String(row.id),
    conversationId: String(row.conversation_id),
    role: String(row.role) as ConversationMessage["role"],
    content: String(row.content ?? ""),
    name: row.name ? String(row.name) : undefined,
    toolCalls: Array.isArray(row.tool_calls)
      ? (row.tool_calls as ConversationMessage["toolCalls"])
      : undefined,
    metadata:
      typeof row.metadata === "object" && row.metadata !== null
        ? (row.metadata as Record<string, unknown>)
        : {},
    createdAt:
      row.created_at instanceof Date
        ? row.created_at
        : new Date(String(row.created_at)),
  };
}

function reviveConversationMessage(
  value: ConversationMessage,
): ConversationMessage {
  return {
    ...value,
    createdAt: new Date(value.createdAt),
  };
}
