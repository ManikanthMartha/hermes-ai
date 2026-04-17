// Shared types across packages. Kept deliberately minimal —
// add only what's needed, avoid speculative abstractions.

export type Role = "user" | "assistant" | "system" | "tool";

export interface AgentMessage {
  role: Role;
  content: string;
  toolCalls?: ToolCall[];
}

export interface ToolCall {
  id: string;
  name: string;
  arguments: Record<string, unknown>;
  result?: unknown;
}

export type MemoryCategory = "preference" | "decision" | "fact" | "relationship";

export type MemorySource = "conversation" | "extraction" | "document";
