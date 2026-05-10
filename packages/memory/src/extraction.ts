import { generateObject } from "ai";
import { z } from "zod";
import { logger } from "@hermes/shared";
import { models } from "@hermes/shared/llm";
import { DEFAULT_USER_ID, type MemoryCandidate } from "./types.js";
import { FactMemory } from "./facts.js";

const CandidateSchema = z.object({
  content: z.string().min(3),
  category: z.enum([
    "profile",
    "preference",
    "decision",
    "fact",
    "relationship",
    "writing_style",
    "project_context",
    "recurring_event",
    "instruction",
  ]),
  subject: z.string().optional(),
  predicate: z.string().optional(),
  value: z.string().optional(),
  confidence: z.number().min(0).max(1).default(0.7),
});

const ExtractionSchema = z.object({
  memories: z.array(CandidateSchema).max(8),
});

export interface ExtractMemoryOptions {
  userId?: string;
  conversationId: string;
  messages: Array<{ role: string; content: string }>;
}

export async function extractAndStoreMemories({
  userId = DEFAULT_USER_ID,
  conversationId,
  messages,
}: ExtractMemoryOptions): Promise<MemoryCandidate[]> {
  const text = messages
    .filter((m) => m.content.trim())
    .map((m) => `${m.role}: ${m.content}`)
    .join("\n");
  if (!text.trim()) return [];

  const { object } = await generateObject({
    model: models.fast,
    schema: ExtractionSchema,
    system: `Extract durable memories for a personal AI assistant.

Store only information likely to matter in future conversations.

Extract:
- user preferences
- decisions
- stable project facts
- relationships between people/projects
- writing style observations
- durable instructions
- recurring patterns

Do NOT extract:
- greetings or filler
- one-off temporary task state
- live calendar/email/GitHub/Sentry data that should be fetched from tools
- uncertain guesses

Use subject/predicate/value when a fact can be represented as a structured update,
especially for project decisions that may later be superseded.

Return no memories if nothing durable was learned.`,
    prompt: text,
  });

  const store = new FactMemory(userId);
  const saved: MemoryCandidate[] = [];
  for (const memory of object.memories) {
    const candidate: MemoryCandidate = {
      ...memory,
      sourceType: "chat",
      sourceId: conversationId,
      metadata: {
        extractor: "hermes-v1",
        conversationId,
      },
    };
    await store.upsert(candidate);
    saved.push(candidate);
  }
  return saved;
}

export function scheduleMemoryExtraction(options: ExtractMemoryOptions): void {
  setImmediate(() => {
    extractAndStoreMemories(options).catch((err) => {
      logger.warn({ err, conversationId: options.conversationId }, "memory extraction failed");
    });
  });
}

