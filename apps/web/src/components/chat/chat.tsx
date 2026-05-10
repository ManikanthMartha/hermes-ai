"use client";

import { useChat } from "@ai-sdk/react";
import {
  DefaultChatTransport,
  readUIMessageStream,
  type UIMessage,
  type UIMessageChunk,
} from "ai";
import { cn } from "@hermes/ui/lib/utils";
import {
  MessageSquareIcon,
  PlusIcon,
  RotateCcwIcon,
  XIcon,
} from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
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
  "remember that I prefer concise emails",
  "what do you remember about me?",
  "list my most active github repos",
  "any linear issues assigned to me",
];

interface SavedConversation {
  id: string;
  threadId: string;
  title: string | null;
  updatedAt: string;
  messageCount: number;
}

export function Chat() {
  const [threadId, setThreadId] = useState(() => crypto.randomUUID());
  const [initialMessages, setInitialMessages] = useState<UIMessage[]>([]);
  const [sessions, setSessions] = useState<SavedConversation[]>([]);
  const [loadingSessionId, setLoadingSessionId] = useState<string | null>(null);

  const refreshSessions = useCallback(async () => {
    try {
      const res = await fetch("/api/conversations", { cache: "no-store" });
      if (!res.ok) return;
      const data = (await res.json()) as {
        conversations?: SavedConversation[];
      };
      setSessions(data.conversations ?? []);
    } catch {
      // Saved sessions are convenience UI; chat remains usable if unavailable.
    }
  }, []);

  useEffect(() => {
    void refreshSessions();
  }, [refreshSessions]);

  const startNew = useCallback(() => {
    setInitialMessages([]);
    setThreadId(crypto.randomUUID());
  }, []);

  const loadSession = useCallback(async (id: string) => {
    setLoadingSessionId(id);
    try {
      const res = await fetch(`/api/conversations/${encodeURIComponent(id)}`, {
        cache: "no-store",
      });
      if (!res.ok) return;
      const data = (await res.json()) as { messages?: UIMessage[] };
      setInitialMessages(data.messages ?? []);
      setThreadId(id);
    } finally {
      setLoadingSessionId(null);
    }
  }, []);

  return (
    <ChatThread
      key={threadId}
      threadId={threadId}
      initialMessages={initialMessages}
      sessions={sessions}
      loadingSessionId={loadingSessionId}
      onNew={startNew}
      onLoadSession={loadSession}
      onSessionsChanged={refreshSessions}
    />
  );
}

function ChatThread({
  threadId,
  initialMessages,
  sessions,
  loadingSessionId,
  onNew,
  onLoadSession,
  onSessionsChanged,
}: {
  threadId: string;
  initialMessages: UIMessage[];
  sessions: SavedConversation[];
  loadingSessionId: string | null;
  onNew: () => void;
  onLoadSession: (id: string) => void | Promise<void>;
  onSessionsChanged: () => void | Promise<void>;
}) {
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
    id: threadId,
    messages: initialMessages,
    transport: new DefaultChatTransport({ api: "/api/chat" }),
    experimental_throttle: 50,
    onFinish: () => {
      void onSessionsChanged();
    },
  });

  const isStreaming = status === "submitted" || status === "streaming";
  const composerRef = useRef<ComposerHandle | null>(null);
  const [approvalStatus, setApprovalStatus] = useState<
    Record<string, "idle" | "submitting" | "resolved" | "rejected">
  >({});

  const approvalKey = (p: ApprovalPayload) => `${p.threadId}::${p.tool}`;

  const submit = (text: string) => {
    void sendMessage({ text });
  };

  const handleApprovalDecision = useCallback(
    async (payload: ApprovalPayload, decision: ApprovalDecision) => {
      const key = approvalKey(payload);
      setApprovalStatus((s) => ({ ...s, [key]: "submitting" }));

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
        void onSessionsChanged();
      } catch {
        setApprovalStatus((s) => ({ ...s, [key]: "idle" }));
      }
    },
    [messages, onSessionsChanged, setMessages],
  );

  return (
    <div className="bg-background text-foreground flex h-svh font-sans">
      <SessionRail
        activeId={threadId}
        sessions={sessions}
        loadingSessionId={loadingSessionId}
        onNew={onNew}
        onLoad={onLoadSession}
      />

      <main className="flex min-w-0 flex-1 flex-col">
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
                  <div className="font-medium">[ x request failed ]</div>
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
      </main>
    </div>
  );
}

function SessionRail({
  activeId,
  sessions,
  loadingSessionId,
  onNew,
  onLoad,
}: {
  activeId: string;
  sessions: SavedConversation[];
  loadingSessionId: string | null;
  onNew: () => void;
  onLoad: (id: string) => void | Promise<void>;
}) {
  return (
    <aside className="border-border/60 bg-card/20 hidden w-72 shrink-0 border-r md:flex md:flex-col">
      <div className="border-border/50 flex items-center justify-between border-b px-3 py-3">
        <div className="font-mono text-[11px] uppercase tracking-[0.18em] text-hermes">
          sessions
        </div>
        <button
          onClick={onNew}
          className="border-border/70 hover:border-hermes/60 hover:text-hermes inline-flex items-center gap-1 rounded-sm border px-2 py-1 font-mono text-[10.5px] uppercase tracking-wider transition-colors"
        >
          <PlusIcon className="size-3" /> new
        </button>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto p-2">
        {sessions.length === 0 ? (
          <div className="text-muted-foreground/70 px-2 py-4 font-mono text-[11.5px] leading-relaxed">
            No saved chats yet. Start a conversation and Hermes will archive it.
          </div>
        ) : (
          <div className="space-y-1">
            {sessions.map((session) => {
              const active =
                session.threadId === activeId || session.id === activeId;
              return (
                <button
                  key={session.id}
                  onClick={() => void onLoad(session.threadId)}
                  disabled={loadingSessionId === session.threadId}
                  className={cn(
                    "group border-border/0 hover:border-border/60 hover:bg-background/50 flex w-full items-start gap-2 rounded-sm border px-2 py-2 text-left transition-colors",
                    active && "border-hermes/40 bg-hermes/5",
                  )}
                >
                  <MessageSquareIcon
                    className={cn(
                      "mt-0.5 size-3 shrink-0 text-muted-foreground",
                      active && "text-hermes",
                    )}
                  />
                  <span className="min-w-0 flex-1">
                    <span className="text-foreground/90 line-clamp-2 block font-mono text-[12px] leading-snug">
                      {session.title ?? "untitled chat"}
                    </span>
                    <span className="text-muted-foreground/60 mt-1 block font-mono text-[10.5px]">
                      {formatSessionDate(session.updatedAt)} -{" "}
                      {session.messageCount} msgs
                    </span>
                  </span>
                </button>
              );
            })}
          </div>
        )}
      </div>
    </aside>
  );
}

function EmptyState({ onPick }: { onPick: (text: string) => void }) {
  return (
    <div className="mx-auto max-w-xl pt-8 pb-4 font-mono text-[12.5px] leading-[1.7]">
      <pre
        aria-hidden
        className="text-hermes/80 mb-6 select-none text-[11px] leading-[1.2]"
      >
        {`  +-----------------------------+
  |   the messenger of gods     |
  +-----------------------------+`}
      </pre>

      <div className="text-muted-foreground space-y-4">
        <p>
          read from <span className="text-foreground">gmail</span>,{" "}
          <span className="text-foreground">slack</span>,{" "}
          <span className="text-foreground">github</span>,{" "}
          <span className="text-foreground">linear</span>, and{" "}
          <span className="text-foreground">sentry</span>. saved sessions and
          individual memory are active.
        </p>

        <div>
          <div className="text-muted-foreground/60 mb-2 text-[10.5px] uppercase tracking-[0.18em]">
            - examples
          </div>
          <ul className="space-y-1">
            {EXAMPLES.map((ex) => (
              <li key={ex}>
                <button
                  onClick={() => onPick(ex)}
                  className="group hover:text-hermes flex w-full items-baseline gap-2 text-left transition-colors"
                >
                  <span className="text-hermes/70 group-hover:text-hermes select-none">
                    &gt;
                  </span>
                  <span className="text-foreground/80 group-hover:text-hermes underline-offset-4 group-hover:underline decoration-dotted">
                    {ex}
                  </span>
                </button>
              </li>
            ))}
          </ul>
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
  onApprovalDecision: (
    p: ApprovalPayload,
    d: ApprovalDecision,
  ) => void | Promise<void>;
}) {
  const isUser = message.role === "user";
  const isAssistant = message.role === "assistant";

  return (
    <div className="flex flex-col gap-2">
      <div
        className={cn(
          "flex items-center gap-2 text-[10.5px] font-medium uppercase tracking-[0.18em]",
          isUser ? "text-muted-foreground" : "text-hermes",
        )}
      >
        <span aria-hidden className="select-none">
          {isUser ? ">" : "*"}
        </span>
        <span>{isUser ? "you" : "hermes"}</span>
        {isAssistant && isLast && isStreaming && (
          <span className="blink ml-1 text-[11px]">|</span>
        )}
      </div>

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
                        "text-foreground max-w-none text-[13.5px] leading-[1.65]",
                        "[&_p]:my-2 [&_p]:leading-[1.65]",
                        "[&_strong]:text-foreground [&_strong]:font-medium",
                        "[&_a]:text-hermes [&_a]:underline [&_a]:decoration-dotted [&_a]:underline-offset-4",
                        "[&_code]:bg-muted/50 [&_code]:text-foreground [&_code]:rounded-[3px] [&_code]:px-1 [&_code]:py-px [&_code]:text-[0.9em] [&_code]:font-mono",
                        "[&_pre]:bg-card/60 [&_pre]:border-border/60 [&_pre]:my-2 [&_pre]:rounded-sm [&_pre]:border [&_pre]:p-3 [&_pre]:text-[12px]",
                        "[&_ul]:my-2 [&_ul]:list-disc [&_ul]:pl-5 [&_ol]:my-2 [&_ol]:list-decimal [&_ol]:pl-5",
                        "[&_li]:my-0.5 [&_li]:marker:text-muted-foreground/60",
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
                if (part.type === "data-agent-start") {
                  const key = (part as { data: { key: string } }).data.key;
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
                if (part.type === "data-agent-end") return null;
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

function formatSessionDate(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "unknown";
  return date.toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
  });
}

function sseBytesToChunks<T>(
  body: ReadableStream<Uint8Array>,
): ReadableStream<T> {
  let buffer = "";
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
              // Ignore malformed chunks.
            }
          }
        }
      },
    }),
  );
}

