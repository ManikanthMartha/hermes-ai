import type { Request, Response } from "express";
import {
  createUIMessageStream,
  createUIMessageStreamResponse,
  type UIMessage,
} from "ai";
import { HumanMessage } from "@langchain/core/messages";
import { logger } from "@hermes/shared";
import {
  ConversationStore,
  DEFAULT_USER_ID,
  handleMemoryCommand,
  scheduleMemoryExtraction,
} from "@hermes/memory";
import { getGraph } from "../graph.js";
import { pumpGraphToWriter } from "./chat-bridge.js";

/**
 * Phase 3 chat handler — drives the LangGraph multi-agent graph instead of
 * the Phase 1 streamText flow. Persists across turns via the in-memory
 * checkpointer keyed by `useChat.id` (the browser-generated thread id).
 *
 * Flow:
 *   1. Extract the last user message + threadId from the body.
 *   2. Get (lazy-build) the compiled graph.
 *   3. Open a UIMessageStream.
 *   4. Feed `{ messages: [latestUserMsg] }` into graph.streamEvents.
 *   5. Bridge events → UIMessage parts via `pumpGraphToWriter`.
 *   6. If the graph paused on a HIL interrupt, the bridge emits a
 *      `data-approval` part — the UI renders the approval card and the user
 *      posts their decision to /api/chat/resume.
 */
export async function handleChat(req: Request, res: Response) {
  const body = req.body as { id?: string; messages?: UIMessage[] };
  const threadId = body.id ?? "default-thread";
  const messages = body.messages ?? [];
  const latest = messages.at(-1);

  if (!latest || latest.role !== "user") {
    res.status(400).json({ error: "last message must be a user message" });
    return;
  }

  const latestText = latest.parts
    .filter((p): p is { type: "text"; text: string } => p.type === "text")
    .map((p) => p.text)
    .join("")
    .trim();

  if (!latestText) {
    res.status(400).json({ error: "user message has no text content" });
    return;
  }

  const conversation = new ConversationStore(DEFAULT_USER_ID);
  await conversation
    .appendMessage(threadId, {
      role: "user",
      content: latestText,
      metadata: { source: "chat" },
    })
    .catch((err) => {
      logger.warn({ err, threadId }, "failed to persist user message");
    });

  try {
    const memoryCommand = await handleMemoryCommand(latestText, DEFAULT_USER_ID);
    if (memoryCommand.handled) {
      const responseText = memoryCommand.response ?? "Done.";
      await conversation
        .appendMessage(threadId, {
          role: "assistant",
          content: responseText,
          metadata: { source: "memory-command" },
        })
        .catch((err) => {
          logger.warn({ err, threadId }, "failed to persist memory-command response");
        });

      const stream = createUIMessageStream({
        async execute({ writer }) {
          const id = `memory-${Date.now()}`;
          writer.write({ type: "text-start", id });
          writer.write({ type: "text-delta", id, delta: responseText });
          writer.write({ type: "text-end", id });
        },
      });
      const response = createUIMessageStreamResponse({ stream });
      res.status(response.status);
      response.headers.forEach((v, k) => res.setHeader(k, v));
      if (response.body) {
        const reader = response.body.getReader();
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          res.write(value);
        }
      }
      res.end();
      return;
    }
  } catch (e) {
    logger.warn({ err: e, threadId }, "memory command handling failed");
  }

  let graph: Awaited<ReturnType<typeof getGraph>>;
  try {
    graph = await getGraph();
  } catch (e) {
    logger.error({ err: e }, "graph build failed");
    res.status(500).json({
      error: e instanceof Error ? e.message : String(e),
    });
    return;
  }

  const stream = createUIMessageStream({
    async execute({ writer }) {
      try {
        await pumpGraphToWriter({
          graph,
          threadId,
          writer,
          userId: DEFAULT_USER_ID,
          input: { messages: [new HumanMessage(latestText)] },
        });
        const recentForExtraction = await conversation
          .recent(threadId, 6)
          .catch(() => [{ role: "user", content: latestText }]);
        scheduleMemoryExtraction({
          userId: DEFAULT_USER_ID,
          conversationId: threadId,
          messages: recentForExtraction.map((m) => ({
            role: m.role,
            content: m.content,
          })),
        });
      } catch (e) {
        logger.error({ err: e, threadId }, "graph stream failed");
        throw e;
      }
    },
    onError: (err) => {
      logger.error({ err }, "chat UI stream error");
      return err instanceof Error ? err.message : "stream error";
    },
  });

  const response = createUIMessageStreamResponse({ stream });
  res.status(response.status);
  response.headers.forEach((v, k) => res.setHeader(k, v));
  if (response.body) {
    const reader = response.body.getReader();
    const pump = async () => {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        res.write(value);
      }
      res.end();
    };
    void pump();
  } else {
    res.end();
  }
}
