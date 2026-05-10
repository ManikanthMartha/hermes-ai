import type { MemoryRecord } from "./types.js";

export function estimateTokens(text: string): number {
  return Math.ceil(text.length / 4);
}

export function vectorLiteral(values: number[]): string {
  return `[${values.map((v) => (Number.isFinite(v) ? v : 0)).join(",")}]`;
}

export function rowToMemory(row: Record<string, unknown>): MemoryRecord {
  return {
    id: String(row.id),
    userId: String(row.user_id ?? row.userId ?? "local-user"),
    content: String(row.content ?? ""),
    category: String(row.category ?? "fact") as MemoryRecord["category"],
    subject: nullableString(row.subject),
    predicate: nullableString(row.predicate),
    value: nullableString(row.value),
    sourceType: nullableString(row.source_type ?? row.sourceType) as
      | MemoryRecord["sourceType"]
      | null,
    sourceId: nullableString(row.source_id ?? row.sourceId),
    confidence: Number(row.confidence ?? 0.7),
    status: String(row.status ?? "active") as MemoryRecord["status"],
    validFrom: nullableDate(row.valid_from ?? row.validFrom),
    validUntil: nullableDate(row.valid_until ?? row.validUntil),
    supersedesMemoryId: nullableString(
      row.supersedes_memory_id ?? row.supersedesMemoryId,
    ),
    metadata: isRecord(row.metadata) ? row.metadata : {},
    score: row.score === undefined ? undefined : Number(row.score),
    createdAt: nullableDate(row.created_at ?? row.createdAt) ?? new Date(),
    updatedAt: nullableDate(row.updated_at ?? row.updatedAt) ?? new Date(),
  };
}

function nullableString(value: unknown): string | null {
  if (value === null || value === undefined) return null;
  return String(value);
}

function nullableDate(value: unknown): Date | null {
  if (!value) return null;
  if (value instanceof Date) return value;
  return new Date(String(value));
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

