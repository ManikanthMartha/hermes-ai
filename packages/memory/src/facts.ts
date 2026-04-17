import type { MemoryCategory } from "@hermes/shared";

// Fact memory — Postgres-backed extracted facts. Built in Phase 2.
export interface Fact {
  id: string;
  content: string;
  category: MemoryCategory;
  createdAt: Date;
}

export class FactMemory {
  async upsert(_fact: Omit<Fact, "id" | "createdAt">): Promise<Fact> {
    throw new Error("FactMemory.upsert: not implemented (Phase 2)");
  }

  async search(_query: string, _limit = 10): Promise<Fact[]> {
    throw new Error("FactMemory.search: not implemented (Phase 2)");
  }
}
