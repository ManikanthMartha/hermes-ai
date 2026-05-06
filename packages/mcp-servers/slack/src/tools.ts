import { WebClient } from "@slack/web-api";
import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";

const token = process.env.SLACK_BOT_TOKEN;
const slack = token ? new WebClient(token) : null;

/** Minified JSON for minimum token overhead. */
const out = (v: unknown) => ({
  content: [{ type: "text" as const, text: JSON.stringify(v) }],
});

/** Cap a message body so pasted resumes / long threads don't blow the context. */
const TRUNCATE_CHARS = 300;
const truncate = (text: string | undefined) =>
  !text
    ? text
    : text.length > TRUNCATE_CHARS
      ? text.slice(0, TRUNCATE_CHARS) + " …[truncated; use get_thread]"
      : text;
const err = (msg: string) => ({
  content: [{ type: "text" as const, text: `Error: ${msg}` }],
  isError: true,
});

function requireSlack() {
  if (!slack) throw new Error("SLACK_BOT_TOKEN not set");
  return slack;
}

type SlackUserFields = {
  id?: string;
  name?: string;
  real_name?: string;
  tz?: string;
  deleted?: boolean;
  is_bot?: boolean;
  profile?: {
    display_name?: string;
    email?: string;
    title?: string;
  };
};

function serializeUser(u: SlackUserFields) {
  return {
    id: u.id,
    handle: u.name,
    real_name: u.real_name,
    display_name: u.profile?.display_name,
    email: u.profile?.email,
    title: u.profile?.title,
    timezone: u.tz,
  };
}

export function registerSlackTools(server: McpServer) {
  server.registerTool(
    "list_channels",
    {
      description:
        "List Slack channels the bot has access to. Returns id, name, membership count, is_archived.",
      inputSchema: {
        include_archived: z
          .boolean()
          .default(false)
          .describe("Include archived channels."),
        limit: z
          .number()
          .int()
          .min(1)
          .max(1000)
          .default(100)
          .describe("Max channels to return."),
      },
    },
    async ({ include_archived, limit }) => {
      try {
        const s = requireSlack();
        const res = await s.conversations.list({
          types: "public_channel,private_channel",
          exclude_archived: !include_archived,
          limit,
        });
        const channels = (res.channels ?? []).map((c) => ({
          id: c.id,
          name: c.name,
          is_private: c.is_private,
          is_archived: c.is_archived,
          num_members: c.num_members,
          topic: c.topic?.value,
        }));
        return out({ channels, count: channels.length });
      } catch (e) {
        return err(e instanceof Error ? e.message : String(e));
      }
    },
  );

  server.registerTool(
    "search_messages",
    {
      description: `Search Slack messages using Slack's full search query syntax.

Supported operators (combine freely):
  from:@handle       — messages by a user
  to:@handle         — messages to a user (mentions / DMs addressed to them)
  with:@handle       — any conversation involving a user (both directions, DMs included)
  in:#channel        — scoped to one channel
  on:YYYY-MM-DD      — exact date
  before:YYYY-MM-DD  — strictly before the date
  after:YYYY-MM-DD   — strictly after the date
  during:january     — a named month

Examples:
  \`with:@trevor on:2026-04-18\` — every message between me and Trevor yesterday
  \`from:me in:#we-ride-app after:2026-04-01\` — my posts in the channel this month

If the handle is unknown, call \`lookup_user\` first.`,
      inputSchema: {
        query: z.string().min(1),
        count: z.number().int().min(1).max(100).default(20),
      },
    },
    async ({ query, count }) => {
      try {
        const s = requireSlack();
        const res = await s.search.messages({ query, count });
        const matches = (res.messages?.matches ?? []).map((m) => ({
          ts: m.ts,
          date: m.ts ? new Date(Number(m.ts) * 1000).toISOString() : undefined,
          user: m.user,
          username: m.username,
          channel: m.channel?.name,
          text: truncate(m.text),
          permalink: m.permalink,
        }));
        return out({
          query,
          total: res.messages?.total,
          matches,
        });
      } catch (e) {
        return err(e instanceof Error ? e.message : String(e));
      }
    },
  );

  server.registerTool(
    "whoami",
    {
      description:
        "Returns the authenticated Slack user's id, handle, and team. Call this FIRST when the user says 'post to myself', 'DM me', or 'send to my Slack'. The returned `user_id` (starts with 'U') can be passed as the `channel` argument to post_message — Slack's chat.postMessage treats a user id as a DM target.",
      inputSchema: {},
    },
    async () => {
      try {
        const s = requireSlack();
        const res = await s.auth.test();
        return out({
          user_id: res.user_id,
          user: res.user,
          team: res.team,
          team_id: res.team_id,
        });
      } catch (e) {
        return err(e instanceof Error ? e.message : String(e));
      }
    },
  );

  server.registerTool(
    "lookup_user",
    {
      description:
        "Resolve a Slack user by handle, email, or a fragment of their real name / display name. Returns id, handle, name, email (if visible), and timezone.",
      inputSchema: {
        query: z
          .string()
          .min(1)
          .describe(
            "A handle (with or without leading @), email, or a name fragment like 'trevor'.",
          ),
      },
    },
    async ({ query }) => {
      try {
        const s = requireSlack();
        const needle = query.replace(/^@/, "").toLowerCase();

        // Fast path: email lookup (only works if the workspace exposes emails).
        if (needle.includes("@")) {
          const res = await s.users.lookupByEmail({ email: needle });
          if (res.user) return out(serializeUser(res.user));
        }

        // Slow path: list members and substring-match. For workspaces with
        // thousands of users we'd paginate + cache; Veltrex is small enough.
        const list = await s.users.list({ limit: 1000 });
        const hits = (list.members ?? [])
          .filter((u) => {
            if (u.deleted || u.is_bot) return false;
            const fields = [
              u.name,
              u.real_name,
              u.profile?.display_name,
              u.profile?.email,
            ]
              .filter(Boolean)
              .map((v) => String(v).toLowerCase());
            return fields.some((f) => f.includes(needle));
          })
          .slice(0, 10)
          .map(serializeUser);
        return out({ query, matches: hits, count: hits.length });
      } catch (e) {
        return err(e instanceof Error ? e.message : String(e));
      }
    },
  );

  server.registerTool(
    "get_thread",
    {
      description:
        "Fetch all messages in a Slack thread. Provide the parent message's channel ID and timestamp (ts).",
      inputSchema: {
        channel: z
          .string()
          .describe("Channel ID (e.g., C0123ABC456) — not the name."),
        ts: z.string().describe("Thread parent timestamp (e.g., '1700000000.001234')."),
        limit: z.number().int().min(1).max(200).default(50),
      },
    },
    async ({ channel, ts, limit }) => {
      try {
        const s = requireSlack();
        const res = await s.conversations.replies({ channel, ts, limit });
        const messages = (res.messages ?? []).map((m) => ({
          ts: m.ts,
          date: m.ts ? new Date(Number(m.ts) * 1000).toISOString() : undefined,
          user: m.user,
          text: truncate(m.text),
          reply_count: m.reply_count,
        }));
        return out({ channel, thread_ts: ts, messages });
      } catch (e) {
        return err(e instanceof Error ? e.message : String(e));
      }
    },
  );

  // ────────── WRITE TOOLS ──────────
  // These perform side effects. The LangGraph specialist wraps them with an
  // `interrupt()` gate so the user sees a confirmation card before they fire.
  // (See apps/agent-runtime/src/agents/approval.ts.)

  server.registerTool(
    "post_message",
    {
      description:
        "[WRITE] Post a message to a Slack channel. Uses chat.postMessage. Requires `chat:write` scope. Requires user approval before executing.",
      inputSchema: {
        channel: z
          .string()
          .describe(
            "Channel name (e.g., '#engineering'), channel ID, or DM user ID.",
          ),
        text: z.string().min(1).describe("Message body. Supports Slack mrkdwn."),
      },
    },
    async ({ channel, text }) => {
      try {
        const s = requireSlack();
        const res = await s.chat.postMessage({ channel, text });
        return out({
          ok: res.ok,
          channel: res.channel,
          ts: res.ts,
          permalink: undefined as string | undefined,
        });
      } catch (e) {
        return err(e instanceof Error ? e.message : String(e));
      }
    },
  );

  server.registerTool(
    "reply_to_thread",
    {
      description:
        "[WRITE] Reply inside an existing thread. Needs the parent message's channel ID and timestamp. Uses chat.postMessage with thread_ts. Requires user approval.",
      inputSchema: {
        channel: z.string().describe("Channel ID (e.g., C0123ABC456)."),
        thread_ts: z
          .string()
          .describe("Parent message timestamp (e.g., '1700000000.001234')."),
        text: z.string().min(1).describe("Reply body."),
        broadcast: z
          .boolean()
          .default(false)
          .describe("Also post visibly to the channel (reply_broadcast)."),
      },
    },
    async ({ channel, thread_ts, text, broadcast }) => {
      try {
        const s = requireSlack();
        const res = await s.chat.postMessage({
          channel,
          text,
          thread_ts,
          reply_broadcast: broadcast,
        });
        return out({
          ok: res.ok,
          channel: res.channel,
          ts: res.ts,
          thread_ts,
        });
      } catch (e) {
        return err(e instanceof Error ? e.message : String(e));
      }
    },
  );
}
