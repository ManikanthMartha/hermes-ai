import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";

const TENANT = process.env.MICROSOFT_TENANT ?? "common";
const CLIENT_ID = process.env.MICROSOFT_CLIENT_ID;
const CLIENT_SECRET = process.env.MICROSOFT_CLIENT_SECRET;
const GRAPH_BASE = "https://graph.microsoft.com/v1.0";

export type OutlookCredential = {
  accessToken?: string;
  refreshToken?: string;
};

export type OutlookToolOptions = {
  getCredential: () => Promise<OutlookCredential>;
};

type GraphMessage = {
  id?: string;
  conversationId?: string;
  subject?: string;
  receivedDateTime?: string;
  sentDateTime?: string;
  from?: { emailAddress?: { name?: string; address?: string } };
  toRecipients?: Array<{ emailAddress?: { name?: string; address?: string } }>;
  ccRecipients?: Array<{ emailAddress?: { name?: string; address?: string } }>;
  bodyPreview?: string;
  body?: { contentType?: string; content?: string };
  webLink?: string;
};

const out = (v: unknown) => ({
  content: [{ type: "text" as const, text: JSON.stringify(v) }],
});
const err = (msg: string) => ({
  content: [{ type: "text" as const, text: `Error: ${msg}` }],
  isError: true,
});

const TRUNCATE_CHARS = 1200;
const truncate = (text: string) =>
  text.length > TRUNCATE_CHARS
    ? `${text.slice(0, TRUNCATE_CHARS)} ...[truncated; call get_message for full body]`
    : text;

export function registerOutlookTools(
  server: McpServer,
  options: OutlookToolOptions,
) {
  server.registerTool(
    "list_messages",
    {
      description:
        "List Outlook messages using Microsoft Graph. Returns summaries; call get_message for full body.",
      inputSchema: {
        query: z
          .string()
          .default("")
          .describe(
            "Optional search text. Searches subject/from/body preview with Graph $search.",
          ),
        folder: z
          .enum(["inbox", "sentitems"])
          .default("inbox")
          .describe("Mail folder to list."),
        maxResults: z.number().int().min(1).max(50).default(20),
      },
    },
    async ({ query, folder, maxResults }) => {
      try {
        const token = await accessToken(options);
        const params = new URLSearchParams({
          "$top": String(maxResults),
          "$select":
            "id,conversationId,subject,receivedDateTime,sentDateTime,from,toRecipients,bodyPreview,webLink",
          "$orderby": folder === "sentitems" ? "sentDateTime desc" : "receivedDateTime desc",
        });
        if (query.trim()) {
          params.delete("$orderby");
          params.set("$search", `"${query.trim().replaceAll('"', '\\"')}"`);
        }
        const data = await graph<{ value?: GraphMessage[] }>(
          `/me/mailFolders/${folder}/messages?${params.toString()}`,
          token,
        );
        const messages = (data.value ?? []).map(summarizeMessage);
        return out({ count: messages.length, messages });
      } catch (e) {
        return err(e instanceof Error ? e.message : String(e));
      }
    },
  );

  server.registerTool(
    "get_message",
    {
      description:
        "Fetch one Outlook message by id, including plain-text body extracted from Graph message body.",
      inputSchema: {
        id: z.string().describe("Outlook message id from list_messages."),
      },
    },
    async ({ id }) => {
      try {
        const token = await accessToken(options);
        const message = await graph<GraphMessage>(
          `/me/messages/${encodeURIComponent(id)}?$select=id,conversationId,subject,receivedDateTime,sentDateTime,from,toRecipients,ccRecipients,body,bodyPreview,webLink`,
          token,
        );
        return out(fullMessage(message));
      } catch (e) {
        return err(e instanceof Error ? e.message : String(e));
      }
    },
  );

  server.registerTool(
    "get_thread",
    {
      description:
        "Fetch messages in an Outlook conversation. Use a conversationId from list_messages/get_message.",
      inputSchema: {
        conversationId: z.string().describe("Microsoft Graph conversationId."),
        maxResults: z.number().int().min(1).max(50).default(20),
      },
    },
    async ({ conversationId, maxResults }) => {
      try {
        const token = await accessToken(options);
        const params = new URLSearchParams({
          "$top": String(maxResults),
          "$select":
            "id,conversationId,subject,receivedDateTime,sentDateTime,from,toRecipients,body,bodyPreview,webLink",
          "$orderby": "receivedDateTime asc",
          "$filter": `conversationId eq '${conversationId.replaceAll("'", "''")}'`,
        });
        const data = await graph<{ value?: GraphMessage[] }>(
          `/me/messages?${params.toString()}`,
          token,
        );
        return out({
          conversationId,
          messages: (data.value ?? []).map(fullMessage),
        });
      } catch (e) {
        return err(e instanceof Error ? e.message : String(e));
      }
    },
  );

  server.registerTool(
    "get_sent_examples",
    {
      description:
        "Fetch recent Outlook sent messages as style examples. Call before composing new Outlook mail.",
      inputSchema: {
        count: z.number().int().min(1).max(20).default(8),
      },
    },
    async ({ count }) => {
      try {
        const token = await accessToken(options);
        const params = new URLSearchParams({
          "$top": String(count),
          "$select": "id,subject,sentDateTime,toRecipients,body,bodyPreview",
          "$orderby": "sentDateTime desc",
        });
        const data = await graph<{ value?: GraphMessage[] }>(
          `/me/mailFolders/sentitems/messages?${params.toString()}`,
          token,
        );
        const examples = (data.value ?? []).map((message) => ({
          to: recipients(message.toRecipients),
          subject: message.subject,
          date: message.sentDateTime,
          body: truncate(bodyText(message)),
        }));
        return out({ count: examples.length, examples });
      } catch (e) {
        return err(e instanceof Error ? e.message : String(e));
      }
    },
  );

  server.registerTool(
    "send_message",
    {
      description:
        "[WRITE] Send an Outlook email, OR save it as an Outlook draft. The user picks Send vs Save-as-Draft in the approval card.",
      inputSchema: {
        to: z
          .string()
          .describe("Recipient email address(es), comma-separated."),
        subject: z.string(),
        body: z.string().describe("Plain text body. Match the user's style."),
        cc: z.string().optional(),
        bcc: z.string().optional(),
        _action: z
          .enum(["send", "draft"])
          .optional()
          .describe("Internal; set by approval wrapper after the user decides."),
      },
    },
    async ({ to, subject, body, cc, bcc, _action }) => {
      try {
        const token = await accessToken(options);
        const message = {
          subject,
          body: { contentType: "Text", content: body },
          toRecipients: emailRecipients(to),
          ccRecipients: cc ? emailRecipients(cc) : [],
          bccRecipients: bcc ? emailRecipients(bcc) : [],
        };

        if (_action === "draft") {
          const draft = await graph<GraphMessage>("/me/messages", token, {
            method: "POST",
            body: JSON.stringify(message),
          });
          return out({
            action: "draft",
            messageId: draft.id,
            conversationId: draft.conversationId,
            webLink: draft.webLink,
          });
        }

        await graph("/me/sendMail", token, {
          method: "POST",
          body: JSON.stringify({ message, saveToSentItems: true }),
          expectJson: false,
        });
        return out({ action: "sent", to, subject });
      } catch (e) {
        return err(e instanceof Error ? e.message : String(e));
      }
    },
  );
}

async function accessToken(options: OutlookToolOptions): Promise<string> {
  const credential = await options.getCredential();
  if (!credential.refreshToken) {
    if (credential.accessToken) return credential.accessToken;
    throw new Error("Outlook is connected but did not return a usable token");
  }
  if (!CLIENT_ID || !CLIENT_SECRET) {
    throw new Error(
      "MICROSOFT_CLIENT_ID / MICROSOFT_CLIENT_SECRET are not configured for Outlook OAuth",
    );
  }
  const res = await fetch(
    `https://login.microsoftonline.com/${encodeURIComponent(TENANT)}/oauth2/v2.0/token`,
    {
      method: "POST",
      headers: { "content-type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        client_id: CLIENT_ID,
        client_secret: CLIENT_SECRET,
        refresh_token: credential.refreshToken,
        grant_type: "refresh_token",
      }),
    },
  );
  if (!res.ok) {
    throw new Error(`Microsoft token refresh failed with ${res.status}`);
  }
  const json = (await res.json()) as { access_token?: unknown };
  if (typeof json.access_token !== "string") {
    throw new Error("Microsoft token refresh did not return an access token");
  }
  return json.access_token;
}

async function graph<T = unknown>(
  path: string,
  token: string,
  options: {
    method?: string;
    body?: string;
    expectJson?: boolean;
  } = {},
): Promise<T> {
  const res = await fetch(`${GRAPH_BASE}${path}`, {
    method: options.method ?? "GET",
    headers: {
      Authorization: `Bearer ${token}`,
      "content-type": "application/json",
      Prefer: 'outlook.body-content-type="text"',
    },
    body: options.body,
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Microsoft Graph request failed with ${res.status}: ${text.slice(0, 200)}`);
  }
  if (options.expectJson === false || res.status === 202 || res.status === 204) {
    return undefined as T;
  }
  return (await res.json()) as T;
}

function summarizeMessage(message: GraphMessage) {
  return {
    id: message.id,
    conversationId: message.conversationId,
    from: address(message.from?.emailAddress),
    to: recipients(message.toRecipients),
    subject: message.subject,
    date: message.receivedDateTime ?? message.sentDateTime,
    snippet: message.bodyPreview,
    webLink: message.webLink,
  };
}

function fullMessage(message: GraphMessage) {
  return {
    ...summarizeMessage(message),
    cc: recipients(message.ccRecipients),
    body: truncate(bodyText(message)),
  };
}

function bodyText(message: GraphMessage): string {
  const content = message.body?.content ?? message.bodyPreview ?? "";
  return message.body?.contentType?.toLowerCase() === "html"
    ? stripHtml(content)
    : content;
}

function stripHtml(value: string): string {
  return value
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

function address(value: { name?: string; address?: string } | undefined) {
  if (!value) return undefined;
  return value.name ? `${value.name} <${value.address ?? ""}>` : value.address;
}

function recipients(
  values: Array<{ emailAddress?: { name?: string; address?: string } }> | undefined,
) {
  return (values ?? [])
    .map((item) => address(item.emailAddress))
    .filter((item): item is string => Boolean(item));
}

function emailRecipients(raw: string) {
  return raw
    .split(",")
    .map((email) => email.trim())
    .filter(Boolean)
    .map((addressValue) => ({
      emailAddress: { address: addressValue },
    }));
}
