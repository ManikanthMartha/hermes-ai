import {
  DEFAULT_USER_ID,
  type ContextBlock,
  type PackedContext,
} from "./types.js";
import { ConversationStore } from "./session.js";
import { ProfileMemory } from "./profile.js";
import { FactMemory } from "./facts.js";
import { estimateTokens } from "./utils.js";

export interface ContextPackOptions {
  userId?: string;
  threadId: string;
  query: string;
  specialist?: "planner" | "comms" | "code" | "ops";
  tokenBudget?: number;
  recentMessages?: number;
}

const DEFAULT_TOKEN_BUDGET = 12_000;

export class ContextPacker {
  constructor(public readonly userId: string = DEFAULT_USER_ID) {}

  async pack(options: ContextPackOptions): Promise<PackedContext> {
    const userId = options.userId ?? this.userId;
    const budget = options.tokenBudget ?? DEFAULT_TOKEN_BUDGET;
    const conversation = new ConversationStore(userId);
    const profile = new ProfileMemory(userId);
    const facts = new FactMemory(userId);

    const blocks: ContextBlock[] = [];

    const profileBlock = await profile.getBlock();
    if (profileBlock) {
      blocks.push({
        type: "profile",
        title: "User Profile",
        content: profileBlock,
        tokenEstimate: estimateTokens(profileBlock),
      });
    }

    const summary = await conversation.getSummary(options.threadId).catch(() => null);
    if (summary?.trim()) {
      blocks.push({
        type: "summary",
        title: "Conversation Summary",
        content: `Conversation summary:\n${summary}`,
        tokenEstimate: estimateTokens(summary),
      });
    }

    const recent = await conversation
      .recent(options.threadId, options.recentMessages ?? 12)
      .catch(() => []);
    if (recent.length) {
      const content = [
        "Recent conversation:",
        ...recent.map((m) => `${m.role}: ${m.content}`),
      ].join("\n");
      blocks.push({
        type: "session",
        title: "Recent Conversation",
        content,
        tokenEstimate: estimateTokens(content),
      });
    }

    const query = specialistQuery(options.query, options.specialist);
    const memories = await facts.search(query, 8).catch(() => []);
    const relevant = memories.filter((m) => (m.score ?? 0) >= 0.68);
    if (relevant.length) {
      const content = [
        "Relevant long-term memories:",
        ...relevant.map((m) => {
          const score = m.score === undefined ? "" : ` (${m.score.toFixed(2)})`;
          return `- [${m.category}${score}] ${m.content}`;
        }),
      ].join("\n");
      blocks.push({
        type: "memory",
        title: "Relevant Memories",
        content,
        tokenEstimate: estimateTokens(content),
        memoryIds: relevant.map((m) => m.id),
        score: Math.max(...relevant.map((m) => m.score ?? 0)),
      });
    }

    const fitted = fitBlocks(blocks, budget);
    return {
      text: fitted.map((b) => b.content).join("\n\n"),
      blocks: fitted,
      includedMemoryIds: fitted.flatMap((b) => b.memoryIds ?? []),
      tokenUsage: {
        profile: sum(fitted, "profile"),
        session: sum(fitted, "session"),
        summary: sum(fitted, "summary"),
        memories: sum(fitted, "memory"),
        hints: sum(fitted, "hint"),
        total: fitted.reduce((acc, b) => acc + b.tokenEstimate, 0),
      },
    };
  }
}

function fitBlocks(blocks: ContextBlock[], budget: number): ContextBlock[] {
  const result: ContextBlock[] = [];
  let used = 0;
  for (const block of blocks) {
    if (used + block.tokenEstimate > budget) continue;
    result.push(block);
    used += block.tokenEstimate;
  }
  return result;
}

function sum(blocks: ContextBlock[], type: ContextBlock["type"]): number {
  return blocks
    .filter((b) => b.type === type)
    .reduce((acc, b) => acc + b.tokenEstimate, 0);
}

function specialistQuery(
  query: string,
  specialist: ContextPackOptions["specialist"],
): string {
  if (specialist === "comms") {
    return `${query}\ncommunication preferences email writing style aliases people scheduling`;
  }
  if (specialist === "code") {
    return `${query}\nprojects repositories linear github engineering decisions`;
  }
  if (specialist === "ops") {
    return `${query}\nservices sentry production incidents project aliases`;
  }
  return query;
}

