import { DEFAULT_USER_ID, type MemoryRecord } from "./types.js";
import { FactMemory } from "./facts.js";

const PROFILE_CATEGORIES = new Set([
  "profile",
  "preference",
  "writing_style",
  "instruction",
]);

export class ProfileMemory {
  private readonly facts: FactMemory;

  constructor(public readonly userId: string = DEFAULT_USER_ID) {
    this.facts = new FactMemory(userId);
  }

  async remember(content: string, metadata: Record<string, unknown> = {}) {
    return this.facts.upsert({
      content,
      category: "profile",
      sourceType: "manual",
      confidence: 1,
      metadata,
    });
  }

  async list(limit = 20): Promise<MemoryRecord[]> {
    return this.facts.listByCategories([...PROFILE_CATEGORIES], limit);
  }

  async getBlock(limit = 12): Promise<string> {
    const rows = await this.list(limit);
    if (!rows.length) return "";
    return [
      "User profile memory:",
      ...rows.map((m) => `- ${m.content}`),
    ].join("\n");
  }
}

