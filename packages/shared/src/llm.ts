// Single source of truth for every LLM call in the project.
// Change a model here, change it everywhere.
//
// Three exports, three consumers:
//   - `models`      — Vercel AI SDK (one-shot generation, frontend streaming)
//   - `chatModels`  — LangChain wrappers (agent nodes inside LangGraph)
//   - `embedModel`  — OpenAI embeddings for pgvector (Claude has no embeddings)
//
// See packages/shared/src/llm.README.md for the full decision table.

import { anthropic } from "@ai-sdk/anthropic";
import { openai } from "@ai-sdk/openai";
import { ChatAnthropic } from "@langchain/anthropic";
import type { EmbeddingModel, LanguageModel } from "ai";

// ─── Vercel AI SDK (one-shot + frontend streaming) ──────────────────────
// Use with: generateText, generateObject, streamText, embed, useChat.
export const models: Record<"fast" | "standard" | "deep", LanguageModel> = {
  fast: anthropic("claude-haiku-4-5"), //   ~$0.001/query — routing, classification, cache keys
  standard: anthropic("claude-sonnet-4-6"), // ~$0.01/query  — most agent work (default)
  deep: anthropic("claude-opus-4-7"), //    ~$0.05/query  — Chronos, complex reasoning, critical writes
};

// ─── LangChain chat models (LangGraph agent nodes) ──────────────────────
// Use ONLY inside LangGraph nodes — implements BaseChatModel, which
// LangGraph's bindTools / invoke / stream expect.
// temperature: 0 for deterministic tool selection.
export const chatModels = {
  fast: new ChatAnthropic({ model: "claude-haiku-4-5", temperature: 0 }),
  standard: new ChatAnthropic({ model: "claude-sonnet-4-6", temperature: 0 }),
  deep: new ChatAnthropic({ model: "claude-opus-4-7", temperature: 0 }),
} as const;

// ─── Embeddings (pgvector, 1536 dims) ───────────────────────────────────
export const embedModel: EmbeddingModel = openai.embedding(
  "text-embedding-3-small",
);

export type ModelTier = keyof typeof models;
