import type { AgentMessage } from "@hermes/shared";

// Session memory — Redis-backed, TTL-bounded conversation history.
// Built in Phase 2.
export class SessionMemory {
  constructor(public readonly sessionId: string) {}

  async append(_message: AgentMessage): Promise<void> {
    throw new Error("SessionMemory.append: not implemented (Phase 2)");
  }

  async recent(_limit = 20): Promise<AgentMessage[]> {
    throw new Error("SessionMemory.recent: not implemented (Phase 2)");
  }
}
