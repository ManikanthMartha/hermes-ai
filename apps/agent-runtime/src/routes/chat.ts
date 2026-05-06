import type { Request, Response } from "express";
import {
  createUIMessageStream,
  createUIMessageStreamResponse,
  type UIMessage,
} from "ai";
import { HumanMessage } from "@langchain/core/messages";
import { logger } from "@hermes/shared";
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
          input: { messages: [new HumanMessage(latestText)] },
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
