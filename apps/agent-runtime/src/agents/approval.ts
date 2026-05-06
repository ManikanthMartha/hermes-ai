import { interrupt } from "@langchain/langgraph";
import { tool, type StructuredToolInterface } from "@langchain/core/tools";
import { WRITE_TOOLS } from "./mcp.js";

/**
 * The payload sent to the UI when a write is blocked on approval.
 * Surfaced as a `data-approval` UIMessage part by the chat route.
 */
export interface ApprovalRequest {
  type: "approval_request";
  tool: string; //        prefixed name, e.g. 'slack__post_message'
  label: string; //       human-readable, e.g. 'Post message to Slack'
  input: Record<string, unknown>;
  /** Optional approve-variants. If present and contains "draft", the UI
   *  renders a 3-button card (Send / Save as Draft / Reject). Default = only
   *  "send" (2-button card). Gmail's send_message is the only tool that uses
   *  "draft" today. */
  actions?: Array<"send" | "draft">;
}

/**
 * What the UI sends back when the user decides. Shape matches what we resume
 * LangGraph with via `Command({ resume: decision })`.
 */
export type ApprovalDecision =
  | {
      approved: true;
      /** Which approve-variant the user picked. Defaults to "send" when
       *  absent (backward-compatible with Slack/Linear approvals). */
      action?: "send" | "draft";
      editedInput?: Record<string, unknown>;
    }
  | { approved: false; reason?: string };

const PRETTY_LABEL: Record<string, string> = {
  slack__post_message: "Post message to Slack",
  slack__reply_to_thread: "Reply in a Slack thread",
  linear__create_issue: "Create a Linear issue",
  linear__update_status: "Move a Linear issue to a new state",
  gmail__send_message: "Send an email",
};

/** Tools that expose a "Save as Draft" variant alongside "Send". The UI
 *  reads this via `actions` on the approval request; the runtime forks
 *  via an injected `_action` kwarg when invoking the underlying tool. */
const DRAFTABLE_TOOLS: ReadonlySet<string> = new Set(["gmail__send_message"]);

/**
 * Wrap any write tool with an interrupt gate. When the LLM invokes the wrapped
 * tool, execution pauses via `interrupt()` — the chat route converts this into
 * a `data-approval` UIMessage part. When the user approves (or rejects), we
 * resume with the decision and either invoke the underlying tool or return a
 * "cancelled by user" result.
 *
 * Reads pass straight through — no interrupt, no wrapping cost.
 */
export function withApproval(
  base: StructuredToolInterface,
): StructuredToolInterface {
  if (!WRITE_TOOLS.has(base.name)) return base;

  const draftable = DRAFTABLE_TOOLS.has(base.name);

  return tool(
    async (input: Record<string, unknown>) => {
      const request: ApprovalRequest = {
        type: "approval_request",
        tool: base.name,
        label: PRETTY_LABEL[base.name] ?? base.name,
        input,
        ...(draftable && { actions: ["send", "draft"] as const }),
      };

      // LangGraph pauses the graph here. On resume, `interrupt()` returns
      // whatever the client passed to `Command({ resume })`.
      const decision = interrupt(request) as ApprovalDecision;

      if (!decision?.approved) {
        const reason =
          !decision?.approved && "reason" in decision
            ? (decision.reason ?? "rejected by user")
            : "rejected by user";
        return JSON.stringify({ cancelled: true, reason });
      }

      // User may have edited args before approving (e.g., softened the draft).
      const edited = decision.editedInput ?? input;

      // For draftable tools, inject the user's chosen variant so the MCP
      // tool can fork between `messages.send` and `drafts.create`. For
      // non-draftable tools, `action` defaults to "send" and the field is
      // ignored by the tool.
      const finalInput = draftable
        ? { ...edited, _action: decision.action ?? "send" }
        : edited;

      // LangChain StructuredTool#invoke accepts the raw input and handles
      // schema validation internally; we forward as-is.
      return await base.invoke(finalInput);
    },
    {
      name: base.name,
      description:
        base.description +
        "\n\n[WRITE ACTION] The user must approve before this runs.",
      schema: base.schema,
    },
  );
}

/** Apply `withApproval` to every write tool in a list; leave reads alone. */
export function gateWrites(
  tools: StructuredToolInterface[],
): StructuredToolInterface[] {
  return tools.map(withApproval);
}
