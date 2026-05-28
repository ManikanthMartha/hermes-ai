import type { Request, Response } from "express";
import {
  createUIMessageStream,
  createUIMessageStreamResponse,
} from "ai";
import { Command } from "@langchain/langgraph";
import { logger } from "@hermes/shared";
import { ConversationStore } from "@hermes/memory";
import { getGraph } from "../graph.js";
import { pumpGraphToWriter } from "./chat-bridge.js";
import type { ApprovalDecision } from "../agents/approval.js";
import { requestContext } from "../http/request-context.js";

/**
 * POST /api/chat/resume — the user approved, rejected, or edited a write.
 *
 * Body: { threadId: string; decision: ApprovalDecision }
 *
 * Resuming a LangGraph checkpoint is just another stream invocation with a
 * `Command({ resume: value })` input. The graph picks up at the paused
 * `interrupt()` call inside the approval wrapper — returns the decision to
 * the wrapper, which either invokes the underlying MCP tool or returns a
 * "cancelled by user" result.
 *
 * The follow-on stream (specialist text after the tool ran, re-routing
 * through Herald, possibly more turns) is piped back via the same
 * UIMessage bridge.
 */
export async function handleResume(req: Request, res: Response) {
  const body = req.body as {
    threadId?: string;
    decision?: ApprovalDecision;
  };
  const threadId = body.threadId;
  const decision = body.decision;
  const context = requestContext(req);
  const { userId } = context;

  if (!threadId || !decision) {
    res.status(400).json({ error: "threadId and decision are required" });
    return;
  }

  const conversation = new ConversationStore(userId);
  await conversation
    .appendMessage(threadId, {
      role: "user",
      content: decision.approved
        ? `Approved write action (${decision.action ?? "send"}).`
        : `Rejected write action: ${decision.reason ?? "rejected by user"}.`,
      metadata: { source: "approval-decision", decision },
    })
    .catch((err) => {
      logger.warn({ err, threadId }, "failed to persist approval decision");
    });

  let graph: Awaited<ReturnType<typeof getGraph>>;
  try {
    graph = await getGraph(context);
  } catch (e) {
    logger.error({ err: e }, "graph build failed on resume");
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
          userId,
          workspaceId: context.workspaceId,
          writer,
          input: new Command({ resume: decision }),
        });
      } catch (e) {
        logger.error({ err: e, threadId }, "graph resume failed");
        throw e;
      }
    },
    onError: (err) => {
      logger.error({ err }, "resume UI stream error");
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
