"use client";

import { useChat } from "@ai-sdk/react";
import {
  DefaultChatTransport,
  readUIMessageStream,
  type UIMessage,
  type UIMessageChunk,
} from "ai";
import { cn } from "@hermes/ui/lib/utils";
import { RotateCcwIcon, XIcon } from "lucide-react";
import { useCallback, useRef, useState } from "react";
import {
  Conversation,
  ConversationContent,
  ConversationScrollButton,
} from "@/components/ai-elements/conversation";
import { MessageResponse } from "@/components/ai-elements/message";
import {
  Reasoning,
  ReasoningContent,
  ReasoningTrigger,
} from "@/components/ai-elements/reasoning";
import { AgentChip, RoutingNote } from "./agent-chip";
import {
  ApprovalCard,
  type ApprovalDecision,
  type ApprovalPayload,
} from "./approval-card";
import { Composer, type ComposerHandle } from "./composer";
import { StatusStrip } from "./status-strip";
import { ToolPart } from "./tool-part";

const EXAMPLES = [
  "list my most active github repos",
  "what did I discuss with the team in slack this week",
  "any linear issues assigned to me",
];

export function Chat() {
  const {
    messages,
    setMessages,
    sendMessage,
    status,
    error,
    stop,
    regenerate,
    clearError,
  } = useChat({
    transport: new DefaultChatTransport({ api: "/api/chat" }),
    // Coalesce token-level updates to ~20fps so rendering stays cheap and
    // the cursor doesn't thrash on every character.
    experimental_throttle: 50,
  });

  const isStreaming = status === "submitted" || status === "streaming";
  const composerRef = useRef<ComposerHandle | null>(null);

  // Tracks the most-recent approval's lifecycle so the card in the stream
  // reflects submit → resolved/rejected states. Keyed by the approval's
  // (threadId + tool) so concurrent approvals couldn't collide; in practice
  // only one is ever pending because LangGraph pauses the whole graph.
  const [approvalStatus, setApprovalStatus] = useState<
    Record<string, "idle" | "submitting" | "resolved" | "rejected">
  >({});

  const approvalKey = (p: ApprovalPayload) => `${p.threadId}::${p.tool}`;

  const submit = (text: string) => {
    void sendMessage({ text });
  };

  /** Handle Approve / Reject → POST /api/chat/resume → merge resulting
   *  UIMessage parts into the tail of the last assistant message. */
  const handleApprovalDecision = useCallback(
    async (payload: ApprovalPayload, decision: ApprovalDecision) => {
      const key = approvalKey(payload);
      setApprovalStatus((s) => ({ ...s, [key]: "submitting" }));

      // Snapshot the parts present BEFORE resume, so we can append the new
      // stream's parts to them rather than replacing history.
      const priorParts =
        messages.at(-1)?.role === "assistant"
          ? [...(messages.at(-1)?.parts ?? [])]
          : [];

      try {
        const res = await fetch("/api/chat/resume", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ threadId: payload.threadId, decision }),
        });
        if (!res.ok || !res.body) throw new Error(`resume ${res.status}`);

        // The AI SDK's server helpers emit SSE bytes — `readUIMessageStream`
        // wants already-parsed chunks. Pipe through an inline parser first.
        const chunks = sseBytesToChunks<UIMessageChunk>(res.body);
        for await (const msg of readUIMessageStream({ stream: chunks })) {
          setMessages((prev) => {
            const last = prev.at(-1);
            if (!last || last.role !== "assistant") return prev;
            return [
              ...prev.slice(0, -1),
              { ...last, parts: [...priorParts, ...msg.parts] },
            ];
          });
        }

        setApprovalStatus((s) => ({
          ...s,
          [key]: decision.approved ? "resolved" : "rejected",
        }));
      } catch {
        setApprovalStatus((s) => ({ ...s, [key]: "idle" }));
      }
    },
    [messages, setMessages],
  );

  return (
    <div className="bg-background text-foreground flex h-svh flex-col font-sans">
      <StatusStrip chatStatus={status} />

      <Conversation className="relative flex-1">
        <ConversationContent className="mx-auto w-full max-w-3xl px-6 py-8">
          {messages.length === 0 ? (
            <EmptyState onPick={(t) => submit(t)} />
          ) : (
            <div className="flex flex-col gap-8">
              {messages.map((m) => (
                <Turn
                  key={m.id}
                  message={m}
                  isLast={m.id === messages.at(-1)?.id}
                  isStreaming={isStreaming}
                  approvalStatus={approvalStatus}
                  approvalKey={approvalKey}
                  onApprovalDecision={handleApprovalDecision}
                />
              ))}
            </div>
          )}

          {error && (
            <div className="border-destructive/40 bg-destructive/5 text-destructive mt-6 flex items-start justify-between gap-3 rounded-sm border px-3 py-2.5 text-[12.5px]">
              <div className="min-w-0 flex-1">
                <div className="font-medium">[ ✕ request failed ]</div>
                <div className="text-destructive/80 mt-0.5 truncate font-mono text-[11.5px]">
                  {error.message}
                </div>
              </div>
              <div className="flex shrink-0 gap-1.5">
                <button
                  onClick={() => {
                    clearError();
                    void regenerate();
                  }}
                  className="border-destructive/40 hover:bg-destructive hover:text-background inline-flex items-center gap-1 rounded-sm border px-2 py-1 text-[11px] uppercase tracking-wider transition-colors"
                >
                  <RotateCcwIcon className="size-2.5" /> retry
                </button>
                <button
                  onClick={clearError}
                  className="text-destructive/70 hover:text-destructive inline-flex items-center rounded-sm p-1 transition-colors"
                  aria-label="Dismiss"
                >
                  <XIcon className="size-3" />
                </button>
              </div>
            </div>
          )}
        </ConversationContent>
        <ConversationScrollButton className="border-border/60 bg-background hover:bg-card text-muted-foreground rounded-sm" />
      </Conversation>

      <Composer
        ref={composerRef}
        onSubmit={submit}
        onStop={stop}
        isStreaming={isStreaming}
      />
    </div>
  );
}

function EmptyState({ onPick }: { onPick: (text: string) => void }) {
  return (
    <div className="mx-auto max-w-xl pt-8 pb-4 font-mono text-[12.5px] leading-[1.7]">
      <pre
        aria-hidden
        className="text-hermes/80 mb-6 select-none text-[11px] leading-[1.2]"
      >
        {`  ╭─────────────────────────────╮
  │   the messenger of gods     │
  ╰─────────────────────────────╯`}
      </pre>

      <div className="text-muted-foreground space-y-4">
        <p>
          read from <span className="text-foreground">slack</span>,{" "}
          <span className="text-foreground">github</span>, and{" "}
          <span className="text-foreground">linear</span>. read-only for now —
          nothing i find leaves the chat.
        </p>

        <div>
          <div className="text-muted-foreground/60 mb-2 text-[10.5px] uppercase tracking-[0.18em]">
            — examples
          </div>
          <ul className="space-y-1">
            {EXAMPLES.map((ex) => (
              <li key={ex}>
                <button
                  onClick={() => onPick(ex)}
                  className="group hover:text-hermes flex w-full items-baseline gap-2 text-left transition-colors"
                >
                  <span className="text-hermes/70 group-hover:text-hermes select-none">
                    ▸
                  </span>
                  <span className="text-foreground/80 group-hover:text-hermes underline-offset-4 group-hover:underline decoration-dotted">
                    {ex}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        </div>

        <div className="text-muted-foreground/50 pt-4 text-[10.5px] uppercase tracking-[0.18em]">
          — keyboard
        </div>
        <div className="text-muted-foreground grid grid-cols-[auto_1fr] gap-x-4 gap-y-0.5 pl-3 text-[11.5px]">
          <span className="text-hermes/80">enter</span>
          <span>send</span>
          <span className="text-hermes/80">shift+enter</span>
          <span>newline</span>
          <span className="text-hermes/80">esc</span>
          <span>stop a running query</span>
        </div>
      </div>
    </div>
  );
}

function Turn({
  message,
  isLast,
  isStreaming,
  approvalStatus,
  approvalKey,
  onApprovalDecision,
}: {
  message: UIMessage;
  isLast: boolean;
  isStreaming: boolean;
  approvalStatus: Record<string, "idle" | "submitting" | "resolved" | "rejected">;
  approvalKey: (p: ApprovalPayload) => string;
  onApprovalDecision: (p: ApprovalPayload, d: ApprovalDecision) => void | Promise<void>;
}) {
  const isUser = message.role === "user";
  const isAssistant = message.role === "assistant";

  return (
    <div className="flex flex-col gap-2">
      {/* Role line: monospace small-caps */}
      <div
        className={cn(
          "flex items-center gap-2 text-[10.5px] font-medium uppercase tracking-[0.18em]",
          isUser ? "text-muted-foreground" : "text-hermes",
        )}
      >
        <span aria-hidden className="select-none">
          {isUser ? "▸" : "◆"}
        </span>
        <span>{isUser ? "you" : "hermes"}</span>
        {isAssistant && isLast && isStreaming && (
          <span className="blink ml-1 text-[11px]">▮</span>
        )}
      </div>

      {/* Body: rail-bordered for assistant, plain indent for user */}
      <div
        className={cn(
          "pl-5",
          isAssistant && "border-hermes/35 border-l-2",
        )}
      >
        <div className="flex flex-col gap-2">
          {message.parts.map((part, i) => {
            switch (part.type) {
              case "text":
                if (isAssistant) {
                  return (
                    <MessageResponse
                      key={i}
                      className={cn(
                        // Hand-styled markdown via Tailwind 4 child selectors —
                        // avoids pulling in @tailwindcss/typography for one component.
                        "text-foreground max-w-none text-[13.5px] leading-[1.65]",
                        "[&_p]:my-2 [&_p]:leading-[1.65]",
                        "[&_h1]:text-foreground [&_h1]:mt-4 [&_h1]:mb-2 [&_h1]:text-base [&_h1]:font-medium [&_h1]:tracking-tight",
                        "[&_h2]:text-foreground [&_h2]:mt-4 [&_h2]:mb-2 [&_h2]:text-[0.95rem] [&_h2]:font-medium",
                        "[&_h3]:text-foreground [&_h3]:mt-3 [&_h3]:mb-1.5 [&_h3]:text-sm [&_h3]:font-medium",
                        "[&_strong]:text-foreground [&_strong]:font-medium",
                        "[&_em]:text-foreground/90",
                        "[&_a]:text-hermes [&_a]:underline [&_a]:decoration-dotted [&_a]:underline-offset-4",
                        "[&_code]:bg-muted/50 [&_code]:text-foreground [&_code]:rounded-[3px] [&_code]:px-1 [&_code]:py-px [&_code]:text-[0.9em] [&_code]:font-mono",
                        "[&_pre]:bg-card/60 [&_pre]:border-border/60 [&_pre]:my-2 [&_pre]:rounded-sm [&_pre]:border [&_pre]:p-3 [&_pre]:text-[12px]",
                        "[&_pre_code]:bg-transparent [&_pre_code]:p-0",
                        "[&_ul]:my-2 [&_ul]:list-disc [&_ul]:pl-5 [&_ol]:my-2 [&_ol]:list-decimal [&_ol]:pl-5",
                        "[&_li]:my-0.5 [&_li]:marker:text-muted-foreground/60",
                        "[&_hr]:border-border/50 [&_hr]:my-4",
                        "[&_blockquote]:border-l-2 [&_blockquote]:border-hermes/40 [&_blockquote]:pl-3 [&_blockquote]:text-muted-foreground [&_blockquote]:italic",
                        "[&_table]:my-3 [&_table]:text-[12px] [&_table]:border-collapse",
                        "[&_th]:border-border/60 [&_th]:border [&_th]:px-2 [&_th]:py-1 [&_th]:text-left [&_th]:font-medium",
                        "[&_td]:border-border/60 [&_td]:border [&_td]:px-2 [&_td]:py-1",
                      )}
                    >
                      {part.text}
                    </MessageResponse>
                  );
                }
                return (
                  <div
                    key={i}
                    className="text-foreground whitespace-pre-wrap text-[13.5px] leading-[1.6]"
                  >
                    {part.text}
                  </div>
                );

              case "reasoning":
                return (
                  <Reasoning
                    key={i}
                    className="border-border/60 my-1 rounded-sm border"
                    isStreaming={isStreaming && isLast}
                  >
                    <ReasoningTrigger className="text-muted-foreground text-[11px] uppercase tracking-wider" />
                    <ReasoningContent className="text-muted-foreground/90 text-[12px]">
                      {part.text}
                    </ReasoningContent>
                  </Reasoning>
                );

              default: {
                // Greek-named progress chips from the graph bridge
                if (part.type === "data-agent-start") {
                  const key = (part as { data: { key: string } }).data.key;
                  // If a matching agent-end exists later in the parts list,
                  // this specialist already finished — render as complete.
                  const done = message.parts
                    .slice(i + 1)
                    .some(
                      (p) =>
                        p.type === "data-agent-end" &&
                        (p as { data?: { key?: string } }).data?.key === key,
                    );
                  return (
                    <AgentChip
                      key={i}
                      agent={key}
                      state={done ? "complete" : "running"}
                    />
                  );
                }
                if (part.type === "data-agent-end") {
                  return null; // paired with the start above
                }
                if (part.type === "data-herald-routing") {
                  const { reason } = (
                    part as { data: { reason: string } }
                  ).data;
                  return <RoutingNote key={i} reason={reason} />;
                }
                if (part.type === "data-approval") {
                  const payload = (part as { data: ApprovalPayload }).data;
                  const key = approvalKey(payload);
                  const status = approvalStatus[key] ?? "idle";
                  return (
                    <ApprovalCard
                      key={i}
                      payload={payload}
                      status={status}
                      onDecide={(decision) =>
                        void onApprovalDecision(payload, decision)
                      }
                    />
                  );
                }
                if (
                  part.type === "dynamic-tool" ||
                  part.type.startsWith("tool-")
                ) {
                  return (
                    <ToolPart
                      key={i}
                      part={part as Parameters<typeof ToolPart>[0]["part"]}
                    />
                  );
                }
                return null;
              }
            }
          })}
        </div>
      </div>
    </div>
  );
}

/**
 * Parse the AI SDK's Server-Sent-Events response body into a stream of
 * UIMessageChunk objects, which `readUIMessageStream` expects. Format is:
 *   data: {"type":"text-delta",...}\n\n
 * Tolerant of empty frames and the [DONE] sentinel (OpenAI-style; the AI
 * SDK doesn't emit it today, but parsing cost is nil).
 */
function sseBytesToChunks<T>(
  body: ReadableStream<Uint8Array>,
): ReadableStream<T> {
  let buffer = "";
  // Decode bytes → string, then split on SSE frame boundaries. The Web
  // Streams types between lib.dom and the `ai` package drift slightly in
  // newer TS versions; the narrow cast below is purely to silence that.
  const textStream = body.pipeThrough(
    new TextDecoderStream() as unknown as ReadableWritablePair<
      string,
      Uint8Array
    >,
  );
  return textStream.pipeThrough(
    new TransformStream<string, T>({
      transform(chunk, controller) {
        buffer += chunk;
        let boundary: number;
        while ((boundary = buffer.indexOf("\n\n")) !== -1) {
          const frame = buffer.slice(0, boundary);
          buffer = buffer.slice(boundary + 2);
          for (const line of frame.split("\n")) {
            if (!line.startsWith("data:")) continue;
            const payload = line.slice(5).trimStart();
            if (!payload || payload === "[DONE]") continue;
            try {
              controller.enqueue(JSON.parse(payload) as T);
            } catch {
              // ignore malformed chunks
            }
          }
        }
      },
    }),
  );
}
