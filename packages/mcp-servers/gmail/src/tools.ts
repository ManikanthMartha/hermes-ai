import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { google, type gmail_v1 } from "googleapis";

// Gmail API via googleapis. Auth is a one-time OAuth2 flow — the user runs
// `pnpm gmail:auth` once, pastes the refresh token into .env, and every
// subsequent tool call exchanges it for a short-lived access token in the
// background (the googleapis client handles the refresh automatically).
//
// All tools are scoped to `gmail.modify` — read + send, never delete.

const CLIENT_ID = process.env.GOOGLE_CLIENT_ID;
const CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET;
const REFRESH_TOKEN = process.env.GOOGLE_REFRESH_TOKEN;

const out = (v: unknown) => ({
  content: [{ type: "text" as const, text: JSON.stringify(v) }],
});
const err = (msg: string) => ({
  content: [{ type: "text" as const, text: `Error: ${msg}` }],
  isError: true,
});

let _gmail: gmail_v1.Gmail | null = null;
function requireGmail(): gmail_v1.Gmail {
  if (_gmail) return _gmail;
  if (!CLIENT_ID || !CLIENT_SECRET || !REFRESH_TOKEN) {
    throw new Error(
      "GOOGLE_CLIENT_ID / GOOGLE_CLIENT_SECRET / GOOGLE_REFRESH_TOKEN not set — run `pnpm gmail:auth`",
    );
  }
  const auth = new google.auth.OAuth2(CLIENT_ID, CLIENT_SECRET);
  auth.setCredentials({ refresh_token: REFRESH_TOKEN });
  _gmail = google.gmail({ version: "v1", auth });
  return _gmail;
}

/** Pull the common header fields off a message payload. */
function readHeaders(
  payload: gmail_v1.Schema$MessagePart | undefined,
): Record<string, string> {
  const out: Record<string, string> = {};
  for (const h of payload?.headers ?? []) {
    if (h.name && h.value) out[h.name.toLowerCase()] = h.value;
  }
  return out;
}

/** Gmail returns body as base64url — decode to utf-8. Walks multipart trees
 * to find the first text/plain part, falling back to text/html stripped. */
function extractBody(payload: gmail_v1.Schema$MessagePart | undefined): string {
  if (!payload) return "";
  const mimeType = payload.mimeType ?? "";
  const data = payload.body?.data;
  if (data && (mimeType === "text/plain" || !payload.parts?.length)) {
    const decoded = Buffer.from(data, "base64url").toString("utf-8");
    if (mimeType === "text/html") return stripHtml(decoded);
    return decoded;
  }
  for (const part of payload.parts ?? []) {
    const sub = extractBody(part);
    if (sub) return sub;
  }
  return "";
}

function stripHtml(s: string): string {
  return s
    .replace(/<style[\s\S]*?<\/style>/gi, "")
    .replace(/<script[\s\S]*?<\/script>/gi, "")
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\s+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

const TRUNCATE_CHARS = 1200;
const truncate = (text: string) =>
  text.length > TRUNCATE_CHARS
    ? text.slice(0, TRUNCATE_CHARS) + " …[truncated; call get_message for full body]"
    : text;

function summarizeMessage(m: gmail_v1.Schema$Message) {
  const h = readHeaders(m.payload);
  return {
    id: m.id,
    threadId: m.threadId,
    from: h.from,
    to: h.to,
    subject: h.subject,
    date: h.date,
    snippet: m.snippet,
    labelIds: m.labelIds,
  };
}

/** Build an RFC 5322 message as a base64url string for gmail.messages.send
 *  and gmail.drafts.create. Both endpoints take the same raw form. */
function buildRfc822({
  to,
  cc,
  bcc,
  subject,
  body,
  inReplyTo,
  references,
}: {
  to: string;
  cc?: string;
  bcc?: string;
  subject: string;
  body: string;
  inReplyTo?: string;
  references?: string;
}): string {
  const lines = [
    `To: ${to}`,
    cc ? `Cc: ${cc}` : null,
    bcc ? `Bcc: ${bcc}` : null,
    `Subject: ${subject}`,
    "MIME-Version: 1.0",
    'Content-Type: text/plain; charset="UTF-8"',
    "Content-Transfer-Encoding: 7bit",
    inReplyTo ? `In-Reply-To: ${inReplyTo}` : null,
    references ? `References: ${references}` : null,
    "",
    body,
  ].filter((l): l is string => l !== null);
  return Buffer.from(lines.join("\r\n"), "utf-8").toString("base64url");
}

export function registerGmailTools(server: McpServer) {
  server.registerTool(
    "list_messages",
    {
      description:
        "List Gmail messages. `query` uses Gmail's search syntax: 'is:unread', 'from:trevor@veltrex.ai', 'newer_than:7d', 'in:sent', 'has:attachment'. Returns minimal summaries — call get_message for full bodies.",
      inputSchema: {
        query: z
          .string()
          .default("in:inbox")
          .describe(
            "Gmail search query. Examples: 'is:unread', 'from:foo@bar.com', 'newer_than:7d', 'in:sent'. Default: 'in:inbox'.",
          ),
        maxResults: z.number().int().min(1).max(50).default(20),
        labelIds: z
          .array(z.string())
          .optional()
          .describe(
            "Filter by Gmail label IDs (e.g., 'INBOX', 'SENT', 'STARRED', 'IMPORTANT'). Usually the `query` param is enough.",
          ),
      },
    },
    async ({ query, maxResults, labelIds }) => {
      try {
        const gmail = requireGmail();
        const list = await gmail.users.messages.list({
          userId: "me",
          q: query,
          maxResults,
          labelIds,
        });
        const ids = list.data.messages ?? [];
        if (ids.length === 0) return out({ messages: [], count: 0 });
        const metas = await Promise.all(
          ids.map((m) =>
            gmail.users.messages.get({
              userId: "me",
              id: m.id!,
              format: "metadata",
              metadataHeaders: ["From", "To", "Subject", "Date"],
            }),
          ),
        );
        return out({
          count: metas.length,
          messages: metas.map((r) => summarizeMessage(r.data)),
        });
      } catch (e) {
        return err(e instanceof Error ? e.message : String(e));
      }
    },
  );

  server.registerTool(
    "get_message",
    {
      description:
        "Fetch a single Gmail message by id, including decoded plain-text body. Use this after list_messages to read content.",
      inputSchema: {
        id: z.string().describe("Gmail message id from list_messages."),
      },
    },
    async ({ id }) => {
      try {
        const gmail = requireGmail();
        const res = await gmail.users.messages.get({
          userId: "me",
          id,
          format: "full",
        });
        const h = readHeaders(res.data.payload);
        const body = truncate(extractBody(res.data.payload));
        return out({
          id: res.data.id,
          threadId: res.data.threadId,
          from: h.from,
          to: h.to,
          cc: h.cc,
          subject: h.subject,
          date: h.date,
          messageId: h["message-id"],
          body,
          labelIds: res.data.labelIds,
        });
      } catch (e) {
        return err(e instanceof Error ? e.message : String(e));
      }
    },
  );

  server.registerTool(
    "get_thread",
    {
      description:
        "Fetch a Gmail thread with all messages. Use before replying so you can quote context and match the conversation's tone.",
      inputSchema: {
        id: z.string().describe("Gmail thread id (same as threadId on any message)."),
      },
    },
    async ({ id }) => {
      try {
        const gmail = requireGmail();
        const res = await gmail.users.threads.get({
          userId: "me",
          id,
          format: "full",
        });
        const messages = (res.data.messages ?? []).map((m) => {
          const h = readHeaders(m.payload);
          return {
            id: m.id,
            from: h.from,
            to: h.to,
            subject: h.subject,
            date: h.date,
            messageId: h["message-id"],
            body: truncate(extractBody(m.payload)),
          };
        });
        return out({ id: res.data.id, messages });
      } catch (e) {
        return err(e instanceof Error ? e.message : String(e));
      }
    },
  );

  server.registerTool(
    "get_sent_examples",
    {
      description:
        "Fetch the user's recent sent emails as style examples. Call this BEFORE composing a new email so you can match the user's salutation, sign-off, sentence length, and formality.",
      inputSchema: {
        count: z.number().int().min(1).max(20).default(8),
      },
    },
    async ({ count }) => {
      try {
        const gmail = requireGmail();
        const list = await gmail.users.messages.list({
          userId: "me",
          q: "in:sent",
          maxResults: count,
        });
        const ids = list.data.messages ?? [];
        const messages = await Promise.all(
          ids.map(async (m) => {
            const r = await gmail.users.messages.get({
              userId: "me",
              id: m.id!,
              format: "full",
            });
            const h = readHeaders(r.data.payload);
            return {
              to: h.to,
              subject: h.subject,
              date: h.date,
              body: truncate(extractBody(r.data.payload)),
            };
          }),
        );
        return out({ count: messages.length, examples: messages });
      } catch (e) {
        return err(e instanceof Error ? e.message : String(e));
      }
    },
  );

  server.registerTool(
    "send_message",
    {
      description:
        "[WRITE] Send an email, OR save it as a Gmail draft — the user picks Send vs Save-as-Draft in the approval card. If `threadId` is provided, the message is sent as a reply in that thread (In-Reply-To/References headers are set automatically from the thread's last message).",
      inputSchema: {
        to: z
          .string()
          .describe(
            "Recipient(s), comma-separated. Use email addresses; don't try to resolve names.",
          ),
        subject: z.string(),
        body: z.string().describe("Plain text body. Match the user's style."),
        cc: z.string().optional(),
        bcc: z.string().optional(),
        threadId: z
          .string()
          .optional()
          .describe(
            "Optional — present when replying in-thread. Fetched from get_thread or get_message.",
          ),
        _action: z
          .enum(["send", "draft"])
          .optional()
          .describe(
            "Internal — set by the runtime's approval wrapper from the user's decision. LLM should not set this.",
          ),
      },
    },
    async ({ to, subject, body, cc, bcc, threadId, _action }) => {
      try {
        const gmail = requireGmail();

        // For replies, pull In-Reply-To + References from the thread's last
        // message so the reply threads correctly in Gmail / other clients.
        let inReplyTo: string | undefined;
        let references: string | undefined;
        if (threadId) {
          const thread = await gmail.users.threads.get({
            userId: "me",
            id: threadId,
            format: "metadata",
            metadataHeaders: ["Message-ID", "References"],
          });
          const last = thread.data.messages?.at(-1);
          const h = readHeaders(last?.payload);
          inReplyTo = h["message-id"];
          references = h["references"]
            ? `${h["references"]} ${h["message-id"] ?? ""}`.trim()
            : h["message-id"];
        }

        const raw = buildRfc822({
          to,
          cc,
          bcc,
          subject,
          body,
          inReplyTo,
          references,
        });

        // send vs draft is decided by the runtime's approval wrapper — it
        // injects `_action` AFTER the user clicks. See
        // apps/agent-runtime/src/agents/approval.ts for the fork.
        if (_action === "draft") {
          const res = await gmail.users.drafts.create({
            userId: "me",
            requestBody: { message: { raw, threadId } },
          });
          return out({
            action: "draft",
            draftId: res.data.id,
            messageId: res.data.message?.id,
            threadId: res.data.message?.threadId,
          });
        }

        const res = await gmail.users.messages.send({
          userId: "me",
          requestBody: { raw, threadId },
        });
        return out({
          action: "sent",
          messageId: res.data.id,
          threadId: res.data.threadId,
          labelIds: res.data.labelIds,
        });
      } catch (e) {
        return err(e instanceof Error ? e.message : String(e));
      }
    },
  );
}
