/**
 * LangGraph → AI SDK UIMessage stream bridge.
 *
 * Shared by /api/chat (new turn) and /api/chat/resume (HIL decision). Takes
 * an async iterator of LangGraph events and writes equivalent UIMessage
 * parts via the AI SDK `writer`.
 *
 * Emits:
 *   - text-start / text-delta / text-end      per assistant run (specialist)
 *   - tool-input-available / tool-output-available  for MCP tool calls
 *   - data-agent-start / data-agent-end       specialist node boundaries
 *   - data-herald-routing                     Herald's classification + reason
 *   - data-approval                           when a write tool is paused on HIL
 */

import type { UIMessageStreamWriter } from "ai";
import { SPECIALIST_KEYS, type SpecialistKey } from "../agents/names.js";

const SPECIALISTS: ReadonlySet<string> = new Set(SPECIALIST_KEYS);

// The LangGraph compiled-graph type carries a massive inferred signature
// (every node name, every edge). Threading that through this bridge adds
// zero runtime benefit — we only ever call `streamEvents` + `getState`.
// Loose-typed on purpose.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type HermesGraph = any;

// Data-part payloads we emit. Keyed by the part name WITHOUT the `data-`
// prefix — the AI SDK v6 prepends `data-` itself at write time.
export type HermesDataParts = {
  "agent-start": { key: SpecialistKey };
  "agent-end": { key: SpecialistKey };
  "herald-routing": { agents: string[]; reason: string };
  approval: {
    threadId: string;
    tool: string;
    label: string;
    input: Record<string, unknown>;
    /** Optional approve-variants — "send", "draft". Absent/[] = send only. */
    actions?: Array<"send" | "draft">;
  };
};

// Dodge the UIMessage<…> generic — the writer interface has type-literal
// keys on `.write({ type })` that we satisfy at the call site. Using the
// default `UIMessageStreamWriter` keeps the code ergonomic; mis-types
// surface as runtime errors in dev rather than as spurious TS gymnastics.
type UIWriter = UIMessageStreamWriter;

interface BridgeOptions {
  graph: HermesGraph;
  threadId: string;
  writer: UIWriter;
  /** The input fed into `graph.streamEvents` — `{ messages: [...] }` for a new
   * turn, or a `Command({ resume })` for HIL resume. */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  input: any;
}

/**
 * Drain a LangGraph streamEvents iterator onto the UIMessage writer. Returns
 * after all events flush. Caller should then inspect graph state for a
 * pending interrupt and emit a `data-approval` part if one exists.
 */
export async function pumpGraphToWriter({
  graph,
  threadId,
  writer,
  input,
}: BridgeOptions): Promise<void> {
  const config = { configurable: { thread_id: threadId }, version: "v2" as const };

  // Track which text blocks we've opened so we can emit text-end.
  const openTextIds = new Set<string>();
  // LangGraph's createReactAgent fires on_chain_start/on_chain_end twice for
  // the same specialist name (outer node + inner ReAct subgraph). Dedupe.
  const openAgents = new Set<string>();

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const stream = (graph as any).streamEvents(input, config) as AsyncIterable<
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    any
  >;

  for await (const ev of stream) {
    const { event, name, run_id, data, metadata } = ev as {
      event: string;
      name: string;
      run_id: string;
      data: Record<string, unknown>;
      metadata?: Record<string, unknown>;
    };

    switch (event) {
      case "on_chain_start": {
        // Specialist node entered — signal the UI (dedupe outer/inner).
        if (SPECIALISTS.has(name) && !openAgents.has(name)) {
          writer.write({
            type: "data-agent-start",
            data: { key: name as SpecialistKey },
          });
          openAgents.add(name);
        }
        break;
      }

      case "on_chain_end": {
        if (SPECIALISTS.has(name) && openAgents.has(name)) {
          writer.write({
            type: "data-agent-end",
            data: { key: name as SpecialistKey },
          });
          openAgents.delete(name);
        }
        break;
      }

      case "on_custom_event": {
        // Herald emits `herald_routing` via dispatchCustomEvent to advertise
        // its decision to the UI without polluting graph state.
        if (name === "herald_routing") {
          const payload = data as { agents?: string[]; reason?: string };
          if (payload.reason) {
            writer.write({
              type: "data-herald-routing",
              data: {
                agents: payload.agents ?? [],
                reason: payload.reason,
              },
            });
          }
        }
        break;
      }

      case "on_chat_model_stream": {
        // Surface text deltas from any LLM call nested inside a specialist
        // subgraph. createReactAgent's chat model lives under an internal
        // node called "agent", NOT the specialist node's own name — so
        // checking `langgraph_node` directly drops every token. Instead,
        // walk the hierarchical checkpoint namespace which looks like
        // "ops:xxxx:agent:yyyy" when nested inside the ops specialist.
        //
        // Herald's routing uses Vercel AI SDK generateObject which bypasses
        // LangChain callbacks entirely, so it won't appear here even without
        // the filter.
        const ns =
          (metadata?.langgraph_checkpoint_ns as string | undefined) ??
          (metadata?.langgraph_node as string | undefined) ??
          "";
        const insideSpecialist = SPECIALIST_KEYS.some(
          (s) => ns === s || ns.startsWith(`${s}:`) || ns.startsWith(`${s}|`),
        );
        if (!insideSpecialist) break;

        const chunk = (data.chunk as
          | { content?: string | Array<{ type?: string; text?: string }> }
          | undefined);
        if (!chunk) break;

        let delta = "";
        if (typeof chunk.content === "string") {
          delta = chunk.content;
        } else if (Array.isArray(chunk.content)) {
          for (const c of chunk.content) {
            if (c?.type === "text" && typeof c.text === "string") delta += c.text;
          }
        }
        if (!delta) break;

        // Open a text block per run_id; emit start once, then deltas.
        if (!openTextIds.has(run_id)) {
          writer.write({ type: "text-start", id: run_id });
          openTextIds.add(run_id);
        }
        writer.write({ type: "text-delta", id: run_id, delta });
        break;
      }

      case "on_tool_start": {
        const input = data.input as Record<string, unknown> | undefined;
        writer.write({
          type: "tool-input-available",
          toolCallId: run_id,
          toolName: name,
          input: input ?? {},
        });
        break;
      }

      case "on_tool_end": {
        // LangChain tool outputs are strings (or objects). We forward as-is;
        // the UI ToolPart renders it with JSON.stringify when not a string.
        writer.write({
          type: "tool-output-available",
          toolCallId: run_id,
          output: data.output,
        });
        break;
      }

      default:
        break;
    }
  }

  // Close any text blocks we opened.
  for (const id of openTextIds) {
    writer.write({ type: "text-end", id });
  }

  // After the stream drains, check for a paused interrupt (HIL).
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const state = await (graph as any).getState({ configurable: { thread_id: threadId } });
  const tasks = (state?.tasks ?? []) as Array<{
    interrupts?: Array<{
      value?: {
        tool?: string;
        label?: string;
        input?: Record<string, unknown>;
        actions?: Array<"send" | "draft">;
      };
    }>;
  }>;
  for (const t of tasks) {
    for (const interrupt of t.interrupts ?? []) {
      const v = interrupt.value;
      if (!v?.tool) continue;
      writer.write({
        type: "data-approval",
        data: {
          threadId,
          tool: v.tool,
          label: v.label ?? v.tool,
          input: v.input ?? {},
          ...(v.actions && { actions: v.actions }),
        },
      });
    }
  }
}
