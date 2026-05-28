import {
  StateGraph,
  MessagesAnnotation,
  START,
  MemorySaver,
} from "@langchain/langgraph";
import type { WorkspaceContext } from "@hermes/shared";
import { ContextPacker } from "@hermes/memory";
import { buildCommsAgent } from "./agents/comms.js";
import { buildCodeAgent } from "./agents/code.js";
import { buildOpsAgent } from "./agents/ops.js";
import { routingToCommand, runHerald } from "./agents/planner.js";

/**
 * Build the Hermes multi-agent graph.
 *
 *   START ──▶ planner ──┬──▶ comms ──┐
 *                       ├──▶ code  ──┼──▶ planner (loop until "no more work")
 *                       └──▶ ops   ──┘         │
 *                                              ▼
 *                                            END
 *
 * Planner (Herald) is a supervisor node:
 *   - Inspects the latest messages,
 *   - Uses LLM classification (generateObject + Zod) to pick specialists,
 *   - Returns a Command that routes to one, many (parallel Send), or END.
 *
 * Each specialist is a full createReactAgent subgraph with its own tool loop.
 * Specialists emit AIMessages into shared state via MessagesAnnotation's
 * add_messages reducer; control returns to the planner so it can decide
 * whether another hop is needed.
 *
 * Checkpointer: MemorySaver stores per-thread state in process memory.
 * Phase 8 swaps this for a PostgresSaver against Neon so checkpoints survive
 * restarts (important for HIL resumes that span minutes/hours).
 */
export async function buildGraph(context: WorkspaceContext) {
  const [comms, code, ops] = await Promise.all([
    buildCommsAgent(context),
    buildCodeAgent(context),
    buildOpsAgent(context),
  ]);

  const plannerNode = async (
    state: typeof MessagesAnnotation.State,
    config?: { configurable?: { thread_id?: string; user_id?: string } },
  ) => {
    const latestUser = [...state.messages]
      .reverse()
      .find((m) => m.getType() === "human" && typeof m.content === "string");
    const threadId = config?.configurable?.thread_id ?? "default-thread";
    const userId = config?.configurable?.user_id;
    if (!userId) throw new Error("graph invocation requires user_id");
    const query =
      typeof latestUser?.content === "string" ? latestUser.content : "";
    const packed = query
      ? await new ContextPacker(userId).pack({
          threadId,
          query,
          specialist: "planner",
          tokenBudget: 4_000,
        })
      : null;
    const out = await runHerald(state.messages, packed?.text);
    return routingToCommand(out, state.messages, packed?.text);
  };

  const graph = new StateGraph(MessagesAnnotation)
    .addNode("planner", plannerNode, {
      ends: ["comms", "code", "ops", "__end__"],
    })
    .addNode("comms", comms)
    .addNode("code", code)
    .addNode("ops", ops)
    .addEdge(START, "planner")
    // After each specialist, return to the planner so it can route again
    // or finalize. This is what makes multi-hop ("argus then iris") work.
    .addEdge("comms", "planner")
    .addEdge("code", "planner")
    .addEdge("ops", "planner");

  return graph.compile({ checkpointer: new MemorySaver() });
}

const graphs = new Map<string, Awaited<ReturnType<typeof buildGraph>>>();

/** Lazy singleton — the graph is cheap but the MCP `getTools()` call inside
 * each specialist's builder is a real network hit. Build once, reuse. */
export async function getGraph(context: WorkspaceContext) {
  const key = `${context.workspaceId}:${context.userId}`;
  const existing = graphs.get(key);
  if (existing) return existing;
  const graph = await buildGraph(context);
  graphs.set(key, graph);
  return graph;
}
