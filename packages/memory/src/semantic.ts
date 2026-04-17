// Semantic memory — pgvector-backed similarity search. Built in Phase 2.
export interface SemanticResult {
  id: string;
  content: string;
  score: number;
}

export class SemanticMemory {
  async search(_query: string, _limit = 5): Promise<SemanticResult[]> {
    throw new Error("SemanticMemory.search: not implemented (Phase 2)");
  }

  async upsert(_content: string): Promise<string> {
    throw new Error("SemanticMemory.upsert: not implemented (Phase 2)");
  }
}
