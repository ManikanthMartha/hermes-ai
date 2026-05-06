"use client";

import { cn } from "@hermes/ui/lib/utils";
import { CheckIcon, FileEditIcon, XIcon } from "lucide-react";
import { useState } from "react";

export interface ApprovalPayload {
  threadId: string;
  tool: string;
  label: string;
  input: Record<string, unknown>;
  /** Optional approve-variants. If includes "draft", a third "Save as Draft"
   *  button is rendered. Default = only ["send"] → 2-button card. */
  actions?: Array<"send" | "draft">;
}

export type ApprovalDecision =
  | {
      approved: true;
      action?: "send" | "draft";
      editedInput?: Record<string, unknown>;
    }
  | { approved: false; reason?: string };

/**
 * Inline card rendered when Iris / Talos pauses on a write tool. The user
 * can approve (optionally editing `text` / `title` / `description` fields
 * first), reject, or dismiss. The card is stateless — Chat owns the network
 * call + UIMessage-stream merge; this component just builds and emits the
 * decision via `onDecide`.
 *
 * The card tries to be smart about editable fields: it picks the most
 * "draft-like" string in the tool input (text, description, title) and
 * exposes it as an editable textarea. Other fields display read-only.
 */
export function ApprovalCard({
  payload,
  onDecide,
  status,
}: {
  payload: ApprovalPayload;
  onDecide: (decision: ApprovalDecision) => void;
  /** Chat-owned lifecycle so the card reflects submit/resolved state without
   * doing its own fetches. */
  status: "idle" | "submitting" | "resolved" | "rejected";
}) {
  const editableKey = pickEditableKey(payload.tool, payload.input);
  const [edited, setEdited] = useState<string>(
    editableKey ? String(payload.input[editableKey] ?? "") : "",
  );
  const state = status;

  const supportsDraft = payload.actions?.includes("draft") ?? false;

  const submit = (result: "send" | "draft" | "reject") => {
    if (state !== "idle") return;
    if (result === "reject") {
      onDecide({ approved: false, reason: "user rejected" });
      return;
    }
    const editedInput =
      editableKey && edited !== String(payload.input[editableKey] ?? "")
        ? { ...payload.input, [editableKey]: edited }
        : undefined;
    onDecide({ approved: true, action: result, editedInput });
  };

  const disabled = state !== "idle";

  return (
    <div
      className={cn(
        "border-hermes/30 bg-hermes/5 my-2 rounded-sm border font-mono text-[12.5px]",
        state === "resolved" && "border-emerald-500/30 bg-emerald-500/5",
        state === "rejected" && "border-destructive/30 bg-destructive/5",
      )}
    >
      <div className="border-border/40 flex items-center justify-between gap-2 border-b px-3 py-1.5">
        <span className="text-muted-foreground flex items-center gap-2">
          <span className="text-muted-foreground/60">[</span>
          <span className="text-hermes">?</span>
          <span className="text-foreground">{payload.label}</span>
          <span className="text-muted-foreground/60">·</span>
          <span className={tone(state)}>{labelFor(state)}</span>
          <span className="text-muted-foreground/60">]</span>
        </span>
        <span className="text-muted-foreground/50 text-[10.5px] font-mono">
          {payload.tool}
        </span>
      </div>

      <div className="space-y-2 px-3 py-2">
        {Object.entries(payload.input).map(([key, value]) => {
          if (key === editableKey) return null; // rendered below, editable
          return (
            <Row key={key} label={key}>
              <span className="text-foreground/90 break-words">
                {typeof value === "string"
                  ? value
                  : JSON.stringify(value, null, 2)}
              </span>
            </Row>
          );
        })}

        {editableKey && (
          <div>
            <div className="text-muted-foreground/70 mb-1 text-[10px] uppercase tracking-[0.15em]">
              ├─ {editableKey} <span className="normal-case">— editable</span>
            </div>
            <textarea
              value={edited}
              onChange={(e) => setEdited(e.target.value)}
              disabled={disabled}
              rows={Math.min(8, edited.split("\n").length + 1)}
              spellCheck={false}
              className="border-border/60 bg-background/40 text-foreground caret-hermes w-full resize-y rounded-sm border px-2 py-1.5 text-[12px] leading-[1.5] outline-none focus:border-hermes/60"
              style={{ color: "var(--foreground)" }}
            />
          </div>
        )}
      </div>

      <div className="border-border/40 flex items-center justify-end gap-2 border-t px-3 py-2">
        {state === "idle" && (
          <>
            <button
              onClick={() => void submit("reject")}
              className="text-destructive/80 hover:text-destructive border-border/60 hover:border-destructive/40 inline-flex items-center gap-1 rounded-sm border px-2.5 py-1 text-[11px] uppercase tracking-wider transition-colors"
            >
              <XIcon className="size-3" /> reject
            </button>
            {supportsDraft && (
              <button
                onClick={() => void submit("draft")}
                className="text-muted-foreground hover:text-foreground border-border/60 hover:border-foreground/40 inline-flex items-center gap-1 rounded-sm border px-2.5 py-1 text-[11px] uppercase tracking-wider transition-colors"
              >
                <FileEditIcon className="size-3" /> save draft
              </button>
            )}
            <button
              onClick={() => void submit("send")}
              className="border-hermes/60 text-hermes hover:bg-hermes hover:text-hermes-foreground inline-flex items-center gap-1 rounded-sm border px-2.5 py-1 text-[11px] uppercase tracking-wider transition-colors"
            >
              <CheckIcon className="size-3" />
              {supportsDraft ? "send" : "approve"}
            </button>
          </>
        )}
        {state === "submitting" && (
          <span className="text-muted-foreground text-[11px] uppercase tracking-wider">
            sending…
          </span>
        )}
        {state === "resolved" && (
          <span className="text-emerald-400/90 text-[11px] uppercase tracking-wider">
            approved
          </span>
        )}
        {state === "rejected" && (
          <span className="text-destructive/80 text-[11px] uppercase tracking-wider">
            rejected
          </span>
        )}
      </div>
    </div>
  );
}

function Row({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <div className="text-muted-foreground/70 mb-0.5 text-[10px] uppercase tracking-[0.15em]">
        ├─ {label}
      </div>
      <div className="pl-3 text-[12px] leading-relaxed">{children}</div>
    </div>
  );
}

function tone(s: "idle" | "submitting" | "resolved" | "rejected") {
  if (s === "resolved") return "text-emerald-400/90";
  if (s === "rejected") return "text-destructive/80";
  if (s === "submitting") return "text-hermes";
  return "text-hermes";
}

function labelFor(s: "idle" | "submitting" | "resolved" | "rejected") {
  if (s === "resolved") return "approved";
  if (s === "rejected") return "rejected";
  if (s === "submitting") return "sending";
  return "awaiting approval";
}

/** Pick a field name that represents the "drafty" payload worth editing. */
function pickEditableKey(
  toolName: string,
  input: Record<string, unknown>,
): string | null {
  // Per-tool hints
  if (toolName.endsWith("post_message") || toolName.endsWith("reply_to_thread")) {
    if (typeof input.text === "string") return "text";
  }
  if (toolName.endsWith("create_issue")) {
    if (typeof input.description === "string") return "description";
    if (typeof input.title === "string") return "title";
  }
  if (toolName.endsWith("send_message") && toolName.startsWith("gmail")) {
    if (typeof input.body === "string") return "body";
  }
  // Generic fallback — pick the longest string field
  const strings = Object.entries(input).filter(
    (e): e is [string, string] => typeof e[1] === "string",
  );
  if (!strings.length) return null;
  strings.sort((a, b) => b[1].length - a[1].length);
  return strings[0][0];
}
