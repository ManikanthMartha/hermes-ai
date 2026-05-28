import type { AgentMessage, MemoryCategory, MemorySource } from "@hermes/shared";

export type MemoryStatus = "active" | "superseded" | "deleted";

export interface MemoryRecord {
  id: string;
  userId: string;
  content: string;
  category: MemoryCategory;
  subject?: string | null;
  predicate?: string | null;
  value?: string | null;
  sourceType?: MemorySource | null;
  sourceId?: string | null;
  confidence: number;
  status: MemoryStatus;
  validFrom?: Date | null;
  validUntil?: Date | null;
  supersedesMemoryId?: string | null;
  metadata: Record<string, unknown>;
  score?: number;
  createdAt: Date;
  updatedAt: Date;
}

export interface MemoryCandidate {
  content: string;
  category: MemoryCategory;
  subject?: string;
  predicate?: string;
  value?: string;
  sourceType?: MemorySource;
  sourceId?: string;
  confidence?: number;
  metadata?: Record<string, unknown>;
}

export interface ConversationMessageInput extends AgentMessage {
  name?: string;
  metadata?: Record<string, unknown>;
}

export interface ConversationMessage extends ConversationMessageInput {
  id: string;
  conversationId: string;
  createdAt: Date;
}

export interface ContextBlock {
  type: "profile" | "session" | "summary" | "memory" | "hint";
  title: string;
  content: string;
  tokenEstimate: number;
  memoryIds?: string[];
  score?: number;
}

export interface PackedContext {
  text: string;
  blocks: ContextBlock[];
  includedMemoryIds: string[];
  tokenUsage: {
    profile: number;
    session: number;
    summary: number;
    memories: number;
    hints: number;
    total: number;
  };
}
