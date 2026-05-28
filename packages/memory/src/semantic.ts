import type { MemoryRecord } from "./types.js";
import { FactMemory } from "./facts.js";

export interface SemanticResult {
  id: string;
  content: string;
  score: number;
}

export class SemanticMemory {
  private readonly facts: FactMemory;

  constructor(public readonly userId: string) {
    if (!userId) throw new Error("SemanticMemory requires a user id");
    this.facts = new FactMemory(userId);
  }

  async search(query: string, limit = 5): Promise<SemanticResult[]> {
    const rows = await this.facts.search(query, limit);
    return rows.map(toSemanticResult);
  }

  async searchRecords(query: string, limit = 5): Promise<MemoryRecord[]> {
    return this.facts.search(query, limit);
  }

  async upsert(content: string): Promise<string> {
    const row = await this.facts.upsert({
      content,
      category: "fact",
      sourceType: "manual",
      confidence: 0.8,
    });
    return row.id;
  }
}

function toSemanticResult(row: MemoryRecord): SemanticResult {
  return {
    id: row.id,
    content: row.content,
    score: row.score ?? 0,
  };
}
