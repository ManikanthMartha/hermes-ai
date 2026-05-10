import type { Request, Response } from "express";
import type { UIMessage } from "ai";
import { ConversationStore, DEFAULT_USER_ID } from "@hermes/memory";
import { logger } from "@hermes/shared";

const store = new ConversationStore(DEFAULT_USER_ID);

export async function handleListConversations(_req: Request, res: Response) {
  try {
    const conversations = await store.list(50);
    res.json({ conversations });
  } catch (err) {
    logger.error({ err }, "failed to list conversations");
    res.status(500).json({ error: "failed to list conversations" });
  }
}

export async function handleGetConversation(req: Request, res: Response) {
  const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  if (!id) {
    res.status(400).json({ error: "conversation id is required" });
    return;
  }

  try {
    const messages = await store.allMessages(id);
    res.json({
      id,
      messages: messages
        .filter((m) => m.role === "user" || m.role === "assistant")
        .filter((m) => m.content.trim())
        .map(toUIMessage),
    });
  } catch (err) {
    logger.error({ err, id }, "failed to load conversation");
    res.status(500).json({ error: "failed to load conversation" });
  }
}

function toUIMessage(message: {
  id: string;
  role: string;
  content: string;
}): UIMessage {
  return {
    id: message.id,
    role: message.role === "user" ? "user" : "assistant",
    parts: [{ type: "text", text: message.content }],
  };
}
