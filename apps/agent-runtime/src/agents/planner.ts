import { generateObject } from "ai";
import { z } from "zod";
import {
  HumanMessage,
  SystemMessage,
  type BaseMessage,
} from "@langchain/core/messages";
import { dispatchCustomEvent } from "@langchain/core/callbacks/dispatch";
import { Command, END, Send } from "@langchain/langgraph";
import { models } from "@hermes/shared/llm";
import { SPECIALIST_KEYS, type SpecialistKey } from "./names.js";

/** Hard cap on Herald → specialist hops per user turn. Prevents infinite
 * dispatch loops when Haiku routing misjudges. The real UX is: user asks,
 * Herald routes at most 3 specialists in sequence, graph finalizes. */
const MAX_HERALD_HOPS = 3;

/** Tag attached to Herald-generated nudge messages so we can count our own
 * hops without mistaking a real user message for a prior-hop carrier. */
const NUDGE_FLAG = "hermes_nudge";

/**
 * Herald — the supervisor node. Classifies the user's latest request and
 * routes to one or more specialists. Runs after EVERY specialist hop, so it
 * also decides when to finalize.
 *
 * Design:
 *   - Pure one-shot classification via Vercel AI SDK `generateObject` + Haiku.
 *     No tool loop. No LangGraph LLM binding. Cheap and deterministic.
 *   - UI progress is streamed via `dispatchCustomEvent("herald_routing", …)` —
 *     NOT via a placeholder message injected into state. The prior "marker"
 *     trick polluted state with an empty-content AIMessage which crashed
 *     Anthropic's API on subsequent turns ("text content blocks must be
 *     non-empty").
 *   - `Send` payloads carry the FULL conversation (not just a marker) so
 *     parallel specialists see the user's actual query. LangGraph's Send
 *     replaces child state; it does not inherit parent state the way
 *     `Command.goto` does.
 */

const RoutingSchema = z.object({
  /**
   * The specialist(s) needed NEXT.
   * - Empty ([]) = the query is fully answered; graph finalizes.
   * - Single agent = sequential hop (Command.goto preserves state).
   * - Multiple agents = truly INDEPENDENT parallel work (Send, fan-out).
   *   Only use parallel when the tasks don't depend on each other.
   */
  agents: z.array(z.enum(SPECIALIST_KEYS)),
  /** One sentence for the UI ("routing to Iris because …"). */
  reason: z.string(),
});

const AGENT_REGISTRY = `
- comms (Iris): Slack AND Gmail. Slack — list channels, search messages, read threads, lookup users, POST messages, REPLY to threads. Gmail — list/search messages (inbox, sent, labels), read messages/threads, sample the user's sent-email style, SEND new email or SAVE as draft.
- code (Talos): GitHub (repos, PRs, issues, commits, diffs) and Linear (issues, projects, states). Also CREATE issues and UPDATE issue status.
- ops (Argus): Sentry — list/search errors, fetch events, read stacktraces. Read-only.
`;

const ROUTING_RULES = `
Routing rules — read carefully:

1. NEVER refuse or ask the user for clarification. Your job is to DISPATCH, not to validate inputs. If the user's request is fuzzy (approximate project names, repo slugs, channel names, user nicknames), route to the relevant specialist anyway — specialists have discovery tools and will resolve ambiguity themselves. "Needs clarification" is never a valid first-turn outcome.

2. On the FIRST turn (no prior specialist replies in history), you MUST dispatch at least one specialist. Returning { agents: [] } on turn 1 is a bug.

3. PICK THE FEWEST AGENTS POSSIBLE. Default to one. Return multiple only when tasks are truly INDEPENDENT and can run in parallel (e.g., "check my GitHub PRs AND my Sentry errors" — both fetch-only, no dependency).

4. SEQUENTIAL tasks get dispatched one at a time across turns. Example: "fetch errors then post to Slack" — turn 1 returns ["ops"] only; after Argus replies with data, the NEXT turn returns ["comms"] to post.

5. FINALIZE (return { agents: [] }) only when:
   - At least one specialist has already run in this conversation,
   - AND the most recent assistant turn clearly answered the user's question,
   - AND no user-visible tool call is still needed.

6. Never invent agents outside the registry above.
`;

export interface HeraldOutput {
  agents: SpecialistKey[];
  reason: string;
}

export async function runHerald(
  messages: BaseMessage[],
  memoryContext?: string,
): Promise<HeraldOutput> {
  // Hard cap: count nudges emitted SINCE the last real user message.
  // Earlier this counted every nudge in the checkpointer's history, which
  // persists across chat turns — so after 3 hops total the whole session
  // would lock up. Walk backwards and stop at the first real human.
  let hops = 0;
  for (let i = messages.length - 1; i >= 0; i--) {
    const m = messages[i];
    if (!m || m.getType() !== "human") continue;
    const isNudge =
      (m as { additional_kwargs?: Record<string, unknown> })
        .additional_kwargs?.[NUDGE_FLAG] === true;
    if (isNudge) hops++;
    else break;
  }

  if (hops >= MAX_HERALD_HOPS) {
    const out: HeraldOutput = {
      agents: [],
      reason: `Max ${MAX_HERALD_HOPS} specialist hops reached — finalizing.`,
    };
    await dispatchCustomEvent("herald_routing", out);
    return out;
  }

  const history = [
    memoryContext?.trim()
      ? messageToAIPart(
          new SystemMessage(
            `Hermes memory context for this turn:\n${memoryContext}`,
          ),
        )
      : null,
    ...messages.map(messageToAIPart),
  ].filter(nonEmpty);

  // Anthropic's structured-output API rejects requests whose final message is
  // `assistant` (they treat it as pre-fill, which is incompatible with
  // output_config). Herald runs AFTER specialists — so the tail is often an
  // assistant turn. Append a synthetic user nudge to keep Anthropic happy
  // AND focus Herald on the decision at hand.
  if (history.at(-1)?.role === "assistant") {
    history.push({
      role: "user",
      content:
        "Given the conversation above, what's the next routing decision? Return { agents: [] } if the user's original question is now fully answered; otherwise route to the needed specialist(s).",
    });
  }

  const { object } = await generateObject({
    model: models.fast, // Haiku — classification
    schema: RoutingSchema,
    system: `You are the Herald — a dispatcher in the Hermes multi-agent system.

${AGENT_REGISTRY}

${ROUTING_RULES}`,
    messages: history,
  });

  // Stream routing info to the UI via a custom event. chat-bridge.ts
  // forwards this as a `data-herald-routing` UIMessage part.
  await dispatchCustomEvent("herald_routing", {
    agents: object.agents,
    reason: object.reason,
  });

  return { agents: object.agents, reason: object.reason };
}

/**
 * Convert LangChain BaseMessage → Vercel AI SDK message part.
 * Returns null for messages with no text content (tool-call-only AIMessages,
 * system noise, etc.). The caller filters nulls before sending to Anthropic,
 * which 400s on empty text blocks.
 */
function messageToAIPart(
  m: BaseMessage,
): { role: "user" | "assistant" | "system"; content: string } | null {
  const type = m.getType();
  const text =
    typeof m.content === "string"
      ? m.content
      : m.content
          .filter(
            (c): c is { type: "text"; text: string } =>
              (c as { type?: string }).type === "text",
          )
          .map((c) => c.text)
          .join("");
  if (!text.trim()) return null;
  if (type === "human") return { role: "user", content: text };
  if (type === "system") return { role: "system", content: text };
  return { role: "assistant", content: text };
}

function nonEmpty<T>(v: T | null | undefined): v is T {
  return v !== null && v !== undefined;
}

/**
 * Turn Herald's classification into a LangGraph Command.
 *   - 0 agents → goto END.
 *   - 1 agent  → Command.goto(agent) — parent state flows through automatically.
 *   - 2+ agents → Send[] for true parallel. Each Send carries the FULL
 *     message history so specialists see the user's query (Send replaces
 *     child state, it does not inherit).
 *
 * In every non-finalize case we append a HumanMessage "nudge" to the state.
 * That serves two purposes:
 *   (a) keeps the specialist's view of the conversation ending with a
 *       user-role message, so Sonnet doesn't 400 on "prefill not supported";
 *   (b) gives the specialist a crisp instruction derived from Herald's reason.
 * The nudge is flagged so `runHerald` can count iterations and cap the loop.
 */
export function routingToCommand(
  out: HeraldOutput,
  currentMessages: BaseMessage[],
  memoryContext?: string,
): Command<unknown> | typeof END {
  if (out.agents.length === 0) {
    return new Command({ goto: END });
  }

  const nudge = new HumanMessage({
    content: [
      `[Herald → ${out.agents.join(", ")}] ${out.reason}`,
      memoryContext?.trim()
        ? `\nRelevant Hermes memory context for this task:\n${memoryContext}`
        : "",
    ].join(""),
    additional_kwargs: { [NUDGE_FLAG]: true },
  });

  if (out.agents.length === 1) {
    // State flows automatically via Command.goto; nudge gets appended via
    // MessagesAnnotation's add_messages reducer so the specialist sees it.
    return new Command({
      goto: out.agents[0] as string,
      update: { messages: [nudge] },
    });
  }

  // Parallel fan-out. Each Send needs the full history so the specialist's
  // createReactAgent starts from a state that actually contains the user
  // query. Send replaces child state, so we build the payload explicitly.
  const withNudge = [...currentMessages, nudge];
  return new Command({
    goto: out.agents.map((a) => new Send(a, { messages: withNudge })),
    // Also add the nudge to parent state so the next Herald call can count it.
    update: { messages: [nudge] },
  });
}
