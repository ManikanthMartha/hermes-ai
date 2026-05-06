# Hermes AI — Phase 3 Walkthrough (Multi-Agent Orchestration + HIL)

Companion to `docs/backend-walkthrough.md` (Phase 1). That document covers the single-agent, `streamText`-based chat path we started with. **This document covers everything Phase 3 added on top:** the LangGraph supervisor, the specialist subgraphs, human-in-the-loop writes, the event-stream bridge, and the Sentry MCP. It also includes a **fixes log** — every bug we hit during bring-up and what the fix was, so the document doubles as a debugging reference.

**Scope.** Backend only. UI code (`apps/web/**`) is deliberately not documented here. Phase 1's walkthrough applies to the parts that didn't change.

---

## Table of contents

- [1. What Phase 3 adds](#1-what-phase-3-adds)
- [2. The big picture — graph shape](#2-the-big-picture--graph-shape)
- [3. Journey of a multi-step HIL prompt](#3-journey-of-a-multi-step-hil-prompt)
- [4. File-by-file walkthrough](#4-file-by-file-walkthrough)
  - [4.1 `packages/mcp-servers/sentry/src/tools.ts` — Sentry read tools](#41-packagesmcp-serverssentry-srctoolsts)
  - [4.2 `packages/mcp-servers/sentry/src/index.ts` — Sentry MCP boot](#42-packagesmcp-serverssentry-srcindexts)
  - [4.3 Slack write tools + `whoami`](#43-slack-write-tools--whoami)
  - [4.4 Linear write tools](#44-linear-write-tools)
  - [4.5 `apps/agent-runtime/src/agents/names.ts`](#45-agentsnamests)
  - [4.6 `apps/agent-runtime/src/agents/mcp.ts`](#46-agentsmcpts)
  - [4.7 `apps/agent-runtime/src/agents/approval.ts`](#47-agentsapprovalts)
  - [4.8 `apps/agent-runtime/src/agents/comms.ts` — Iris](#48-agentscommsts--iris)
  - [4.9 `apps/agent-runtime/src/agents/code.ts` — Talos](#49-agentscodets--talos)
  - [4.10 `apps/agent-runtime/src/agents/ops.ts` — Argus](#410-agentsopsts--argus)
  - [4.11 `apps/agent-runtime/src/agents/planner.ts` — Herald](#411-agentsplannerts--herald)
  - [4.12 `apps/agent-runtime/src/graph.ts` — StateGraph wiring](#412-graphts--stategraph-wiring)
  - [4.13 `apps/agent-runtime/src/routes/chat-bridge.ts` — event bridge](#413-routeschat-bridgets--event-bridge)
  - [4.14 `apps/agent-runtime/src/routes/chat.ts` — rewritten chat route](#414-routeschatts--rewritten-chat-route)
  - [4.15 `apps/agent-runtime/src/routes/resume.ts` — HIL resume](#415-routesresumets--hil-resume)
  - [4.16 `apps/agent-runtime/src/index.ts` — route mounting delta](#416-indexts--route-mounting-delta)
- [5. Streaming internals — LangGraph events → UIMessage parts](#5-streaming-internals--langgraph-events--uimessage-parts)
- [6. HIL approval flow — pause, approve, resume](#6-hil-approval-flow--pause-approve-resume)
- [7. Fixes log — bugs and their root causes](#7-fixes-log--bugs-and-their-root-causes)
- [8. Glossary additions](#8-glossary-additions)

---

## 1. What Phase 3 adds

Phase 1 had a single agent (`assistant.ts`) that bound every MCP tool directly into `streamText` via `@ai-sdk/mcp`. Simple, effective for reads, but:

- No clean HIL gate for write actions
- No way to attribute cost / time per specialist
- No orchestration when queries span services (*"fetch X, then post Y"*)
- Every tool schema burns context on every turn, even tools irrelevant to the task

Phase 3 replaces that single agent with a **LangGraph supervisor/specialist** shape:

- **Herald** (supervisor, `planner.ts`) — Haiku-powered classifier. On each turn it inspects the state and emits a `Command` that routes to 0, 1, or many specialists. No tools bound; pure classification via `generateObject`.
- **Iris** (comms, `comms.ts`) — Slack reads + writes.
- **Talos** (code, `code.ts`) — GitHub + Linear reads + writes.
- **Argus** (ops, `ops.ts`) — Sentry reads.

Each specialist is a `createReactAgent` subgraph bound only to its own tools (4–11 each). Writes go through a `withApproval()` wrapper that calls LangGraph's `interrupt()`, pausing the graph and surfacing an approval card in the UI.

New MCP: a **Sentry server** (port `:4103`) with three read tools. `@langchain/mcp-adapters`'s `MultiServerMCPClient` replaces the per-service `@ai-sdk/mcp` clients from Phase 1 — one adapter aggregates all four MCPs and prefixes tool names with the server key (`slack__post_message`, `github__list_prs`, etc.).

Chat routes rewritten: `/api/chat` now drives the graph via `graph.streamEvents`, translating LangGraph events to AI SDK UIMessage parts through a dedicated bridge (`chat-bridge.ts`). A new `/api/chat/resume` accepts approval decisions and re-enters the paused graph via `Command({ resume })`.

---

## 2. The big picture — graph shape

```
                                 ┌──────────┐
                                 │  START   │
                                 └────┬─────┘
                                      ▼
                              ┌──────────────┐
                              │   HERALD     │   planner node
                              │ (planner.ts) │   generateObject (Haiku) + Zod
                              └──┬────┬────┬─┘   emits Command.goto or Send[]
                     goto         │    │    │  goto END if no more work
                  "iris"      ┌───▼┐ ┌─▼──┐ ┌▼───┐
                              │IRIS│ │TALO│ │ARGU│     each = createReactAgent
                              └─┬──┘ │ S  │ │ S  │     subgraph bound to its
                                │    └─┬──┘ └─┬──┘     own MCP tool subset
                                │      │      │
                                └──────▼──────┘
                                       ▼                 each specialist routes
                                    HERALD               back to the supervisor
                                       │                 via a plain edge
                                    (loop)
                                       │
                                       ▼
                                      END
```

**Key invariants:**
- Specialists never call other specialists. Only Herald orchestrates.
- Herald is stateless between turns except via `MessagesAnnotation` (conversation history in the checkpointer).
- HIL interrupts pause the graph at the `withApproval` wrapper inside a specialist. Resume re-enters that exact node with `Command({ resume })`.
- `MemorySaver` stores state per `thread_id` (= `useChat.id` on the browser). Phase 8 swaps it for Postgres for durability.

---

## 3. Journey of a multi-step HIL prompt

Take the canonical test query:

> *"list unresolved sentry errors then post a summary to my slack DM"*

**Turn 1 (client → server):**

1. Browser `useChat` POSTs `{ id: "abc", messages: [{role:"user", parts:[{type:"text", text:"..."}]}] }` to `/api/chat`.
2. Next.js proxies to agent-runtime. `handleChat` extracts the latest user text.
3. `getGraph()` lazy-builds the compiled graph (cached process-wide).
4. `createUIMessageStream({ execute })` opens a streaming response; inside, `pumpGraphToWriter` is called with `{ messages: [new HumanMessage(text)] }` as graph input and `threadId = "abc"`.

**Inside the graph:**

5. START → `planner` node. `runHerald(state.messages)` runs `generateObject` with Haiku + `RoutingSchema`. Haiku returns `{ agents: ["ops"], reason: "fetch Sentry errors first; the Slack post depends on this data" }`.
6. `dispatchCustomEvent("herald_routing", ...)` fires — the bridge sees it and emits `data-herald-routing` to the UI.
7. `routingToCommand(out, messages)` returns a `Command({ goto: "ops", update: { messages: [nudge] } })`. The nudge is a flagged `HumanMessage` with content like `[Herald → ops] fetch Sentry errors first...`.
8. Graph enters `ops` (Argus). `createReactAgent` runs. Argus's LLM (Haiku, per `chatModels.fast`) decides to call `sentry__list_issues`. Tool fires → hits Sentry REST API → returns 19 errors. AIMessage with summary text streams back token by token (bridged as `text-delta` UIMessage parts).
9. Edge `ops → planner`. Herald runs again. It counts nudges-since-real-user (= 1), under cap. History tail is assistant, so it appends a synthetic "what's next?" user nudge. `generateObject` returns `{ agents: ["comms"], reason: "now post the summary to Slack" }`.
10. `Command({ goto: "comms", update: { messages: [nudge] } })`. Graph enters `comms` (Iris).
11. Iris first calls `slack__whoami` (to get the user's own Slack ID). Tool returns `{ user_id: "U0AECJTTZ32", ... }`. Iris then calls `slack__post_message({ channel: "U0AECJTTZ32", text: "<summary>" })`.
12. `withApproval` wrapper intercepts: calls `interrupt({ type: "approval_request", tool: "slack__post_message", label: "Post message to Slack", input: { channel, text } })`. **Graph pauses. MemorySaver writes a checkpoint.**
13. `graph.streamEvents` finishes (no more events). `pumpGraphToWriter` calls `graph.getState({ thread_id })`, sees a pending interrupt in `state.tasks[0].interrupts[0]`, and writes a `data-approval` UIMessage part.
14. Stream closes. Browser receives the approval card.

**User clicks Approve in the UI:**

15. Browser POSTs `/api/chat/resume` with `{ threadId: "abc", decision: { approved: true, editedInput?: {...} } }`.
16. Next.js proxies to agent-runtime. `handleResume` calls `pumpGraphToWriter({ input: new Command({ resume: decision }) })`.
17. Graph resumes at the `interrupt()` call. `decision.approved === true` → wrapper calls the underlying Slack MCP tool. `chat.postMessage` fires → message actually lands in Slack → tool returns `{ ok: true, ts: "..." }`.
18. Iris continues, produces a confirmation text ("Posted to your DM."). Edge back to `planner`.
19. Herald: nudges-since-user = 2, still under cap. History tail is now a useful assistant turn; Herald returns `{ agents: [], reason: "the report has been sent; nothing more to do" }`. `Command({ goto: END })`.
20. Stream closes. Second response body (read by `readUIMessageStream` on the browser, merged into the last assistant message).

Total Anthropic calls: 3 Haiku (Herald × 3) + 2 Haiku (Iris, Argus) + 1 Haiku (Iris post-approval). Total external API: 1 Sentry + 1 Slack (whoami) + 1 Slack (post) = 3. Under a cent end-to-end.

---

## 4. File-by-file walkthrough

### 4.1 `packages/mcp-servers/sentry/src/tools.ts`

Three read-only tools. Talks to Sentry's REST API via `fetch` (no `@sentry/*` SDK — that's for emission, not querying). A slug→numeric-ID resolver caches per-process so `project: "react-native"` works for humans even though Sentry's API wants a numeric ID.

```ts
import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";

const AUTH = process.env.SENTRY_AUTH_TOKEN;
const ORG = process.env.SENTRY_ORG;
const PROJECT = process.env.SENTRY_PROJECT;
const BASE = "https://sentry.io/api/0";

const out = (v: unknown) => ({
  content: [{ type: "text" as const, text: JSON.stringify(v) }],
});
const err = (msg: string) => ({
  content: [{ type: "text" as const, text: `Error: ${msg}` }],
  isError: true,
});

function requireSentry() {
  if (!AUTH) throw new Error("SENTRY_AUTH_TOKEN not set");
  if (!ORG) throw new Error("SENTRY_ORG not set");
  return { auth: AUTH, org: ORG, project: PROJECT };
}

async function sentryFetch<T>(path: string, auth: string): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    headers: { Authorization: `Bearer ${auth}` },
  });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Sentry ${res.status}: ${body.slice(0, 200)}`);
  }
  return (await res.json()) as T;
}

/** Slug→id resolver with process-lifetime cache. See fixes log §7.10. */
let projectIdCache: Record<string, string> | null = null;
async function resolveProjectId(slug: string, auth: string, org: string): Promise<string | null> {
  if (!projectIdCache) {
    const projects = await sentryFetch<Array<{ id: string; slug: string }>>(
      `/organizations/${org}/projects/`, auth);
    projectIdCache = {};
    for (const p of projects) projectIdCache[p.slug] = p.id;
  }
  return projectIdCache[slug] ?? null;
}
```

**Tool 1 — `list_issues`.** Accepts a human-friendly project slug. Resolves to numeric ID via cache; if the slug isn't in the org, falls back to the search-query operator `project:slug`.

```ts
server.registerTool("list_issues", {
  description: "List Sentry issues for the configured org. Use `query` to scope...",
  inputSchema: {
    query: z.string().default("is:unresolved"),
    project: z.string().optional().describe("Project slug; auto-resolves to id."),
    limit: z.number().int().min(1).max(100).default(25),
  },
}, async ({ query, project, limit }) => {
  try {
    const { auth, org, project: defaultProject } = requireSentry();
    const proj = project ?? defaultProject;
    let finalQuery = query;
    const params = new URLSearchParams({ limit: String(limit) });

    if (proj) {
      const id = await resolveProjectId(proj, auth, org);
      if (id) params.set("project", id);
      else finalQuery = `${finalQuery} project:${proj}`.trim();  // fallback
    }
    params.set("query", finalQuery);

    const data = await sentryFetch<Array<{
      id: string; shortId: string; title: string; culprit?: string;
      level: string; status: string; count: string; userCount: number;
      firstSeen: string; lastSeen: string; permalink: string;
      metadata?: { type?: string; value?: string };
    }>>(`/organizations/${org}/issues/?${params}`, auth);

    const issues = data.map((i) => ({
      id: i.id, short_id: i.shortId, title: i.title,
      culprit: i.culprit, level: i.level, status: i.status,
      event_count: Number(i.count), user_count: i.userCount,
      first_seen: i.firstSeen, last_seen: i.lastSeen,
      type: i.metadata?.type, url: i.permalink,
    }));
    return out({ query, issues, count: issues.length });
  } catch (e) {
    return err(e instanceof Error ? e.message : String(e));
  }
});
```

**Tool 2 — `get_issue_events`.** Lists recent events for a given issue id.

```ts
server.registerTool("get_issue_events", {
  description: "Fetch the most recent events for a Sentry issue. Use the `id` from list_issues.",
  inputSchema: {
    issue_id: z.string(),
    limit: z.number().int().min(1).max(50).default(10),
  },
}, async ({ issue_id, limit }) => {
  try {
    const { auth } = requireSentry();
    const data = await sentryFetch<Array<{
      id: string; eventID: string; message?: string; dateCreated: string;
      platform: string; tags?: Array<{ key: string; value: string }>;
      user?: { id?: string; email?: string; ip_address?: string };
    }>>(`/issues/${issue_id}/events/?limit=${limit}`, auth);
    const events = data.map((e) => ({
      id: e.id, event_id: e.eventID, message: e.message,
      date: e.dateCreated, platform: e.platform,
      tags: e.tags?.slice(0, 8), user_email: e.user?.email,
    }));
    return out({ issue_id, events, count: events.length });
  } catch (e) {
    return err(e instanceof Error ? e.message : String(e));
  }
});
```

**Tool 3 — `get_error_stacktrace`.** Fetches the full event detail (stacktrace frames). Uses a different endpoint that requires project slug in the path.

```ts
server.registerTool("get_error_stacktrace", {
  description: "Fetch a specific event with its full stacktrace.",
  inputSchema: {
    event_id: z.string().describe("32-char event ID from get_issue_events."),
    project: z.string().optional(),
  },
}, async ({ event_id, project }) => {
  try {
    const { auth, org, project: defaultProject } = requireSentry();
    const proj = project ?? defaultProject;
    if (!proj) throw new Error("project not provided and SENTRY_PROJECT not set");

    const data = await sentryFetch<{
      eventID: string; dateCreated: string; platform: string;
      title: string; message?: string;
      entries: Array<{ type: string; data: unknown }>;
      tags?: Array<{ key: string; value: string }>;
    }>(`/projects/${org}/${proj}/events/${event_id}/`, auth);

    type Frame = { filename?: string; function?: string; lineNo?: number; inApp?: boolean };
    type Exception = { type: string; value: string; stacktrace?: { frames?: Frame[] } };
    const stacktraces: Array<{ type: string; message: string; frames: Frame[] }> = [];

    for (const entry of data.entries ?? []) {
      if (entry.type === "exception") {
        const values = (entry.data as { values?: Exception[] }).values ?? [];
        for (const v of values) {
          stacktraces.push({
            type: v.type, message: v.value,
            frames: v.stacktrace?.frames?.slice(-15).map((f) => ({
              filename: f.filename, function: f.function,
              lineNo: f.lineNo, inApp: f.inApp,
            })) ?? [],
          });
        }
      }
    }
    return out({
      event_id: data.eventID, date: data.dateCreated,
      title: data.title, message: data.message, platform: data.platform,
      stacktraces, tags: data.tags?.slice(0, 8),
    });
  } catch (e) {
    return err(e instanceof Error ? e.message : String(e));
  }
});
```

**Output trimming.** Each tool drops 70%+ of Sentry's raw response. Only the fields Argus actually needs (level, title, culprit, counts, timestamps, last 15 stack frames) make it into the text content. This keeps token usage predictable.

### 4.2 `packages/mcp-servers/sentry/src/index.ts`

Structurally identical to the Slack/GitHub/Linear MCP servers documented in Phase 1 — Express + Streamable HTTP transport, stateless mode, bound to `127.0.0.1:4103`.

```ts
import "@hermes/shared"; // loads monorepo .env
import express from "express";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import { logger } from "@hermes/shared";
import { registerSentryTools } from "./tools.js";

function buildServer(): McpServer {
  const server = new McpServer({ name: "sentry", version: "0.1.0" });
  registerSentryTools(server);
  return server;
}

const app = express();
app.use(express.json({ limit: "4mb" }));

app.post("/mcp", async (req, res) => {
  const server = buildServer();
  const transport = new StreamableHTTPServerTransport({ sessionIdGenerator: undefined });
  res.on("close", () => { void transport.close(); void server.close(); });
  try {
    await server.connect(transport);
    await transport.handleRequest(req, res, req.body);
  } catch (e) {
    logger.error({ err: e }, "sentry MCP request failed");
    if (!res.headersSent) res.status(500).end();
  }
});

app.get("/mcp", (_req, res) => {
  res.status(405).json({ error: "method not allowed in stateless mode" });
});

const port = Number(process.env.MCP_SENTRY_PORT ?? 4103);
app.listen(port, "127.0.0.1", () => {
  const configured = !!process.env.SENTRY_AUTH_TOKEN && !!process.env.SENTRY_ORG;
  logger.info({ port, configured }, configured
    ? "mcp-sentry listening"
    : "mcp-sentry listening (SENTRY_AUTH_TOKEN / SENTRY_ORG not set — tools will error)");
});
```

### 4.3 Slack write tools + `whoami`

Three additions to the Slack MCP's `tools.ts` — Phase 1 had four read tools; Phase 3 adds:

**`whoami`** — returns the authenticated user's Slack ID. Needed because *"DM myself"* requires knowing the user's own `U…` ID as the post target.

```ts
server.registerTool("whoami", {
  description: "Returns the authenticated Slack user's id, handle, and team. Call FIRST when the user says 'post to myself', 'DM me', or 'send to my Slack'. The returned `user_id` (starts with 'U') can be passed as the `channel` argument to post_message.",
  inputSchema: {},
}, async () => {
  try {
    const s = requireSlack();
    const res = await s.auth.test();
    return out({
      user_id: res.user_id, user: res.user,
      team: res.team, team_id: res.team_id,
    });
  } catch (e) {
    return err(e instanceof Error ? e.message : String(e));
  }
});
```

**`post_message`** — posts to a channel, DM, or group DM.

```ts
server.registerTool("post_message", {
  description: "[WRITE] Post a message to a Slack channel. Requires `chat:write` scope. Requires user approval before executing.",
  inputSchema: {
    channel: z.string().describe("Channel name (#engineering), channel ID, or DM user ID."),
    text: z.string().min(1).describe("Message body. Supports Slack mrkdwn."),
  },
}, async ({ channel, text }) => {
  try {
    const s = requireSlack();
    const res = await s.chat.postMessage({ channel, text });
    return out({ ok: res.ok, channel: res.channel, ts: res.ts });
  } catch (e) {
    return err(e instanceof Error ? e.message : String(e));
  }
});
```

**`reply_to_thread`** — posts inside an existing thread. Takes the parent's `channel` id and `thread_ts`.

```ts
server.registerTool("reply_to_thread", {
  description: "[WRITE] Reply inside an existing thread. Requires user approval.",
  inputSchema: {
    channel: z.string(),
    thread_ts: z.string(),
    text: z.string().min(1),
    broadcast: z.boolean().default(false).describe("Also post visibly to the channel."),
  },
}, async ({ channel, thread_ts, text, broadcast }) => {
  try {
    const s = requireSlack();
    const res = await s.chat.postMessage({
      channel, text, thread_ts, reply_broadcast: broadcast,
    });
    return out({ ok: res.ok, channel: res.channel, ts: res.ts, thread_ts });
  } catch (e) {
    return err(e instanceof Error ? e.message : String(e));
  }
});
```

**Scopes needed (User OAuth Token / `xoxp-`):**
- `chat:write` — posting.
- `users:read` — `auth.test` (whoami) and user lookups.
- `im:write` — starting DMs with other people.

The `[WRITE]` marker in the description is informational for LLM readers. The actual HIL gate is applied in `approval.ts` via the `WRITE_TOOLS` allowlist.

### 4.4 Linear write tools

Added to `linear/tools.ts`:

**`create_issue`** — create a new issue. Resolves team by key, optionally resolves assignee by email.

```ts
server.registerTool("create_issue", {
  description: "[WRITE] Create a new Linear issue. Requires user approval.",
  inputSchema: {
    team: z.string().describe("Team key, e.g., 'ENG'."),
    title: z.string().min(1),
    description: z.string().optional(),
    assignee_email: z.string().email().optional(),
    priority: z.number().int().min(0).max(4).optional()
      .describe("0=No priority, 1=Urgent, 2=High, 3=Medium, 4=Low."),
  },
}, async ({ team, title, description, assignee_email, priority }) => {
  try {
    const lin = requireLinear();
    const teams = await lin.teams({ filter: { key: { eq: team } } });
    const teamNode = teams.nodes[0];
    if (!teamNode) throw new Error(`Team '${team}' not found`);

    let assigneeId: string | undefined;
    if (assignee_email) {
      const users = await lin.users({ filter: { email: { eq: assignee_email } } });
      assigneeId = users.nodes[0]?.id;
      if (!assigneeId) throw new Error(`Assignee '${assignee_email}' not found`);
    }

    const payload = await lin.createIssue({
      teamId: teamNode.id, title, description, assigneeId, priority,
    });
    const issue = payload.issue ? await payload.issue : undefined;
    if (!issue) throw new Error("Linear returned no issue from createIssue");
    return out({
      success: payload.success, id: issue.id,
      identifier: issue.identifier, title: issue.title, url: issue.url,
    });
  } catch (e) {
    return err(e instanceof Error ? e.message : String(e));
  }
});
```

**`update_status`** — move an issue to a different workflow state, resolving the state by name case-insensitively.

```ts
server.registerTool("update_status", {
  description: "[WRITE] Move a Linear issue to a different workflow state. Requires user approval.",
  inputSchema: {
    identifier: z.string().describe("Issue identifier like 'ENG-123'."),
    state_name: z.string().describe("Target state (e.g., 'In Progress', 'Done')."),
  },
}, async ({ identifier, state_name }) => {
  try {
    const lin = requireLinear();
    const issue = await lin.issue(identifier);
    const team = await issue.team;
    if (!team) throw new Error(`Issue ${identifier} has no team`);

    const states = await team.states();
    const target = states.nodes.find(
      (s) => s.name.toLowerCase() === state_name.toLowerCase(),
    );
    if (!target) throw new Error(
      `State '${state_name}' not found for team ${team.key}. Available: ${
        states.nodes.map((s) => s.name).join(", ")
      }`,
    );

    const payload = await lin.updateIssue(issue.id, { stateId: target.id });
    return out({
      success: payload.success,
      identifier: issue.identifier,
      new_state: target.name, url: issue.url,
    });
  } catch (e) {
    return err(e instanceof Error ? e.message : String(e));
  }
});
```

Both are marked `[WRITE]` and registered in `WRITE_TOOLS` (see §4.6).

### 4.5 `agents/names.ts`

The **one** place the Greek display names live. File/class/node names everywhere else stay descriptive (`planner`, `comms`, `code`, `ops`).

```ts
export const AGENT_LABELS = {
  planner: "Herald",
  comms: "Iris",
  code: "Talos",
  ops: "Argus",
} as const;

export type AgentKey = keyof typeof AGENT_LABELS;

export const SPECIALIST_KEYS = ["comms", "code", "ops"] as const satisfies readonly AgentKey[];
export type SpecialistKey = (typeof SPECIALIST_KEYS)[number];

export function labelOf(key: string): string {
  return (AGENT_LABELS as Record<string, string>)[key] ?? key;
}
```

`SPECIALIST_KEYS` deliberately excludes `planner` — Herald isn't a specialist; it's the supervisor that routes *to* specialists.

### 4.6 `agents/mcp.ts`

Single long-lived `MultiServerMCPClient` that aggregates all four MCP servers. Builds a process-wide tool cache and slices it per-specialist.

```ts
import { MultiServerMCPClient } from "@langchain/mcp-adapters";
import type { StructuredToolInterface } from "@langchain/core/tools";
import { logger } from "@hermes/shared";

let _client: MultiServerMCPClient | null = null;
let _toolsCache: Map<string, StructuredToolInterface> | null = null;

function getClient(): MultiServerMCPClient {
  if (_client) return _client;
  _client = new MultiServerMCPClient({
    useStandardContentBlocks: true,
    // Prefix tool names with the server key (e.g. `slack__post_message`) so:
    //   (a) we can filter per-specialist by server,
    //   (b) collisions like `list_issues` (github + linear + sentry) don't
    //       silently overwrite each other.
    // Without this flag, getTools() returns UNPREFIXED names and every
    // specialist ends up with 0 tools — the LLM then hallucinates tool
    // calls as free text. See fixes log §7.11.
    prefixToolNameWithServerName: true,
    mcpServers: {
      slack:  { url: process.env.MCP_SLACK_URL  ?? "http://127.0.0.1:4100/mcp",
                reconnect: { enabled: true, maxAttempts: 5, delayMs: 2000 } },
      github: { url: process.env.MCP_GITHUB_URL ?? "http://127.0.0.1:4101/mcp",
                reconnect: { enabled: true, maxAttempts: 5, delayMs: 2000 } },
      linear: { url: process.env.MCP_LINEAR_URL ?? "http://127.0.0.1:4102/mcp",
                reconnect: { enabled: true, maxAttempts: 5, delayMs: 2000 } },
      sentry: { url: process.env.MCP_SENTRY_URL ?? "http://127.0.0.1:4103/mcp",
                reconnect: { enabled: true, maxAttempts: 5, delayMs: 2000 } },
    },
  });
  return _client;
}

async function loadAllTools(): Promise<Map<string, StructuredToolInterface>> {
  if (_toolsCache) return _toolsCache;
  const tools = await getClient().getTools();
  _toolsCache = new Map();
  for (const t of tools) _toolsCache.set(t.name, t);
  // Diagnostic log — invaluable during bring-up (see fixes log §7.11).
  logger.info({ total: tools.length, names: tools.map((t) => t.name) }, "MCP tools loaded");
  return _toolsCache;
}

export async function getToolsForSpecialist(
  servers: readonly string[],
): Promise<StructuredToolInterface[]> {
  const all = await loadAllTools();
  const result: StructuredToolInterface[] = [];
  for (const [name, tool] of all) {
    if (servers.some((s) => name.startsWith(`${s}__`) || name.startsWith(`${s}-`))) {
      result.push(tool);
    }
  }
  logger.info({ servers, count: result.length, names: result.map((t) => t.name) },
    "specialist tool subset");
  return result;
}

export async function closeMCPClient(): Promise<void> {
  if (!_client) return;
  try { await _client.close(); }
  finally { _client = null; _toolsCache = null; }
}

/** Tools considered writes. Every one is gated behind interrupt() in approval.ts.
 *  Must match the [WRITE] marker in each MCP's tools.ts. */
export const WRITE_TOOLS: ReadonlySet<string> = new Set([
  "slack__post_message", "slack__reply_to_thread",
  "linear__create_issue", "linear__update_status",
]);
```

**Why long-lived client?** The MCP `initialize` handshake costs a network round-trip to each server. Doing it once at first use amortizes across all chat turns for the process lifetime. The `reconnect` config handles transient drops.

**`useStandardContentBlocks: true`** tells the adapter to return LangChain-native content blocks, which `ChatAnthropic.bindTools` expects inside `createReactAgent`.

### 4.7 `agents/approval.ts`

The HIL mechanism. Wraps every write tool in a new tool whose handler calls LangGraph's `interrupt()` before forwarding to the original.

```ts
import { interrupt } from "@langchain/langgraph";
import { tool, type StructuredToolInterface } from "@langchain/core/tools";
import { WRITE_TOOLS } from "./mcp.js";

/** Payload sent to the UI when a write is blocked. Surfaced as a
 * `data-approval` UIMessage part by chat-bridge. */
export interface ApprovalRequest {
  type: "approval_request";
  tool: string;          // prefixed name, e.g., 'slack__post_message'
  label: string;         // human-readable, e.g., 'Post message to Slack'
  input: Record<string, unknown>;
}

/** What the UI sends back. Shape matches what we resume LangGraph with
 * via `Command({ resume: decision })`. */
export type ApprovalDecision =
  | { approved: true; editedInput?: Record<string, unknown> }
  | { approved: false; reason?: string };

const PRETTY_LABEL: Record<string, string> = {
  slack__post_message: "Post message to Slack",
  slack__reply_to_thread: "Reply in a Slack thread",
  linear__create_issue: "Create a Linear issue",
  linear__update_status: "Move a Linear issue to a new state",
};

/**
 * Wrap a write tool with an interrupt gate. Reads pass through unchanged.
 * When the LLM invokes the wrapped tool, the handler calls `interrupt()` —
 * LangGraph pauses the graph, MemorySaver checkpoints state. `interrupt()`
 * is a control-flow primitive: on resume (via `Command({ resume })`) it
 * returns the value the client supplied, and the handler continues.
 *
 * If approved, we call the underlying tool (optionally with edited args).
 * If rejected, we return a serialized "cancelled" result — the LLM sees
 * that, decides what to do next.
 */
export function withApproval(base: StructuredToolInterface): StructuredToolInterface {
  if (!WRITE_TOOLS.has(base.name)) return base;

  return tool(
    async (input: Record<string, unknown>) => {
      const request: ApprovalRequest = {
        type: "approval_request",
        tool: base.name,
        label: PRETTY_LABEL[base.name] ?? base.name,
        input,
      };
      const decision = interrupt(request) as ApprovalDecision;

      if (!decision?.approved) {
        const reason = !decision?.approved && "reason" in decision
          ? (decision.reason ?? "rejected by user")
          : "rejected by user";
        return JSON.stringify({ cancelled: true, reason });
      }

      const finalInput = decision.editedInput ?? input;
      return await base.invoke(finalInput);
    },
    {
      name: base.name,
      description: base.description +
        "\n\n[WRITE ACTION] The user must approve before this runs.",
      schema: base.schema,
    },
  );
}

export function gateWrites(tools: StructuredToolInterface[]): StructuredToolInterface[] {
  return tools.map(withApproval);
}
```

**The magic of `interrupt`.** Inside a LangGraph node, calling `interrupt(payload)` does three things:

1. Stops execution immediately.
2. Writes a checkpoint containing the node's current state PLUS the interrupt payload, keyed by `thread_id` in the checkpointer.
3. Causes the graph's `stream` / `streamEvents` iterator to finish with a pending-interrupt flag.

When the client resumes via `graph.stream(new Command({ resume: value }), config)`:

1. The checkpointer loads the saved state.
2. `interrupt()` returns `value` (i.e., the `ApprovalDecision`).
3. Execution continues from the exact statement after `interrupt`.

This works because LangGraph treats the node function as resumable — it re-runs it but `interrupt()` short-circuits past its already-completed prefix and returns the resume value. For our wrapper, that means `await base.invoke(finalInput)` actually fires only after approval.

### 4.8 `agents/comms.ts` — Iris

```ts
import { createReactAgent } from "@langchain/langgraph/prebuilt";
import { chatModels } from "@hermes/shared/llm";
import { getToolsForSpecialist } from "./mcp.js";
import { gateWrites } from "./approval.js";

const PROMPT = `You are Iris, the comms specialist in the Hermes multi-agent system.

Scope: Slack only (channels, messages, threads, posting, replying).

## Critical: do the work. Don't introduce yourself.
You are invoked BECAUSE there's a Slack task to do. Do not greet, do not list capabilities, do not ask "what can I help with?". Read the user's request, pick the right tool, call it.

## How to work — discover first, then act
- **Never ask the user for Slack IDs or channel names you can discover yourself.**
  - "DM me" / "post to myself" / "send to my Slack" → call \`slack__whoami\` first, use the returned user_id as the \`channel\` arg to \`slack__post_message\`.
  - Unknown person by name → \`slack__lookup_user\` with their name/email, use the returned id.
  - Channel by rough name — pass it as-is; Slack's chat.postMessage resolves "#engineering" etc. If that fails, call \`slack__list_channels\` to find the actual slug.
- **You MUST call \`slack__post_message\` to send. Writing the draft as text in your reply does nothing — the user expects a real Slack message to arrive.** The call triggers an approval card; the user reviews and approves it. No tool call = no message.
- Compose the message body from prior conversation context (what Argus/Talos returned earlier in the state). Be concise — a few bullets per source, links if available.

## Responding
- If you posted successfully, briefly confirm what was posted and where.
- **Do your Slack part only. Say nothing about other specialists or scope.** Herald dispatches the other agents in parallel/sequence — if the user asked for GitHub/Linear/Sentry data, those specialists will handle it. Your response should not mention "out of scope" or "ask Talos/Argus" — that's redundant noise.
- If an approval is rejected, acknowledge and stop. Don't retry with a variant.
- If there is genuinely nothing Slack-related for you to do, say so in one sentence and stop.`;

export async function buildCommsAgent() {
  const tools = gateWrites(await getToolsForSpecialist(["slack"]));
  return createReactAgent({
    llm: chatModels.fast, // Haiku — tool-selection accuracy is high at 7 tools
    tools,
    name: "comms",
    prompt: PROMPT,
  });
}
```

**Prompt anatomy (applies to all specialists):**
- *"Don't introduce yourself"* — specialists are invoked by Herald, not by the user directly, so intros are noise. Early bring-up showed Haiku producing generic greetings when its state lacked the user's query (fixes log §7.2).
- *"Discover first, then act"* — never refuse because a name is fuzzy. Each specialist has discovery tools (`whoami`, `lookup_user`, `list_channels` / `list_projects` / etc.) and should use them.
- *"Say nothing about other specialists' scope"* — removes noisy *"ask Argus for Sentry"*-style disclaimers (fixes log §7.14).

### 4.9 `agents/code.ts` — Talos

Same shape, broader scope (GitHub + Linear), 11 tools.

```ts
import { createReactAgent } from "@langchain/langgraph/prebuilt";
import { chatModels } from "@hermes/shared/llm";
import { getToolsForSpecialist } from "./mcp.js";
import { gateWrites } from "./approval.js";

const PROMPT = `You are Talos, the code & project-tracking specialist in the Hermes multi-agent system.

Scope: GitHub (repos, PRs, issues, commits, diffs) and Linear (issues, projects, workflow states).

## Critical: do the work. Don't introduce yourself.
You are invoked BECAUSE there's a GitHub or Linear task to do. Do not greet, do not list capabilities, do not ask the user what they need. Read the request, pick a tool, call it.

## How to work — discover first, then act
- **Never ask the user for exact owners/repos/team-keys/identifiers.** If the name is fuzzy, discover it yourself:
  - For "my repos" / "my issues" — call \`github__get_authenticated_user\` once to get your login + orgs, then \`github__list_my_repos\` or \`github__list_org_repos\` to find the match.
  - For Linear teams — call \`linear__list_projects\` to discover team keys and project IDs. Match the user's fuzzy name by substring against the results.
  - For a specific issue where you're unsure of the identifier — call \`linear__search_issues\` with keywords from the request.
- GitHub tools take \`owner\` + \`repo\` as SEPARATE args. Never pass "owner/repo" as one string.
- For writes (\`create_issue\`, \`update_status\`), construct the payload carefully — the user sees it exactly in an approval card. For \`create_issue\`, write a concise title and a body that cites sources (PR numbers, error IDs, Slack links) if they were provided in the conversation state.

## Responding
- Summarize the data you fetched — don't paste raw JSON. Surface the fields that matter for the user's question (PR numbers, issue titles, authors, dates).
- **Do your GitHub/Linear part only. Say nothing about other specialists or scope.** Herald dispatches the other agents in parallel/sequence — your response should not mention "out of scope" or "ask Iris/Argus". That's redundant noise.
- If an approval is rejected, stop. Don't retry.`;

export async function buildCodeAgent() {
  const tools = gateWrites(await getToolsForSpecialist(["github", "linear"]));
  return createReactAgent({
    llm: chatModels.fast,
    tools,
    name: "code",
    prompt: PROMPT,
  });
}
```

### 4.10 `agents/ops.ts` — Argus

Smallest scope — read-only Sentry. No `gateWrites` call (nothing to gate yet; Phase 4+ might add `resolve_issue` — wire it the same way as Iris/Talos when it lands).

```ts
import { createReactAgent } from "@langchain/langgraph/prebuilt";
import { chatModels } from "@hermes/shared/llm";
import { getToolsForSpecialist } from "./mcp.js";

const PROMPT = `You are Argus, the ops specialist in the Hermes multi-agent system.

Scope: Sentry only (errors, events, stacktraces). Read-only.

## Critical: do the work. Don't introduce yourself.
You are invoked BECAUSE there's a Sentry question to answer. Do not greet, do not list capabilities. Read the request, pick a tool, call it.

## How to work — discover first, then act
- **Never ask the user for IDs, slugs, or exact project names.** If you're given a fuzzy name, try it directly; the \`project\` arg auto-resolves slugs to numeric IDs. If that fails, call \`sentry__list_issues\` without a project filter to see everything, or match by substring in the results.
- Typical flow: \`sentry__list_issues\` (with or without a project) → scan matches → drill into specific events via \`sentry__get_issue_events\` / \`sentry__get_error_stacktrace\`.
- For multiple projects in one request, call \`sentry__list_issues\` once PER project. Don't try to fetch several in a single call.
- Sentry search syntax: 'is:unresolved' (default), 'is:regressed', 'environment:production', free text. Use alongside the \`project\` arg.

## Responding
- Surface the fields that matter: level, title, culprit, first/last seen, user count, URL. If you fetched a stacktrace, show the top frame or two.
- Drop low-value fields (internal tags, platform metadata) unless asked.
- **Do your Sentry part only. Say nothing about other specialists or scope.** Herald dispatches the other agents in parallel/sequence — your response should not mention "out of scope" or "ask Iris/Talos". That's redundant noise.`;

export async function buildOpsAgent() {
  const tools = await getToolsForSpecialist(["sentry"]);
  return createReactAgent({
    llm: chatModels.fast,
    tools,
    name: "ops",
    prompt: PROMPT,
  });
}
```

### 4.11 `agents/planner.ts` — Herald

The supervisor node. This file went through the most iteration during bring-up — see fixes log §7.1, §7.2, §7.3, §7.5, §7.6, §7.7, §7.9, §7.13.

Shown in full at the top of this document's sources. Key features:

- `runHerald(messages)` — uses `generateObject` (Vercel AI SDK) + Haiku to classify. Not a LangChain chat model; not a tool loop. One round-trip, structured output validated against `RoutingSchema`.
- **Hop counter** — walks backwards from the latest message, counts nudge-flagged `HumanMessage` markers since the last real user turn. If it hits `MAX_HERALD_HOPS = 3`, Herald force-finalizes with `agents: []`.
- **Empty-content filter** (`messageToAIPart`) — silently drops messages whose extracted text is empty. Anthropic 400s on empty text blocks inside a message's `content` array.
- **Assistant-terminal guard** — if the message history ends with an assistant turn, Herald appends a synthetic user nudge before calling `generateObject`. Anthropic's structured-output API rejects prefill (a final assistant message), so this is mandatory after every specialist reply.
- **Custom event for UI** — `dispatchCustomEvent("herald_routing", ...)` is the only way Herald communicates its decision to the UI. It does NOT inject any marker into state — that caused the infamous "empty text content block" bug (fixes log §7.1).
- `routingToCommand(out, currentMessages)` — translates the `HeraldOutput` into a LangGraph `Command`:
  - 0 agents → `Command({ goto: END })`
  - 1 agent → `Command({ goto: agent, update: { messages: [nudge] } })` (state propagates via parent)
  - 2+ agents → parallel `Send[]`, each Send carrying the full history + nudge (Send *replaces* child state — must be explicit)

The nudge is a `HumanMessage` with:
- Content: `[Herald → <agents>] <reason>` — gives the specialist a concise, human-readable instruction.
- `additional_kwargs: { hermes_nudge: true }` — the flag the hop counter uses.

Passing a flagged user message also solves the *"assistant as last message"* problem for SPECIALISTS downstream: when Iris's `ChatAnthropic` call runs, its message tail is a user message, not an assistant one. Sonnet and Haiku both reject prefill in structured-output mode — this applies to specialists too (fixes log §7.7).

### 4.12 `graph.ts` — StateGraph wiring

```ts
import {
  StateGraph, MessagesAnnotation, START, MemorySaver,
} from "@langchain/langgraph";
import { buildCommsAgent } from "./agents/comms.js";
import { buildCodeAgent } from "./agents/code.js";
import { buildOpsAgent } from "./agents/ops.js";
import { routingToCommand, runHerald } from "./agents/planner.js";

export async function buildGraph() {
  const [comms, code, ops] = await Promise.all([
    buildCommsAgent(), buildCodeAgent(), buildOpsAgent(),
  ]);

  const plannerNode = async (state: typeof MessagesAnnotation.State) => {
    const out = await runHerald(state.messages);
    return routingToCommand(out, state.messages);
  };

  const graph = new StateGraph(MessagesAnnotation)
    .addNode("planner", plannerNode, {
      ends: ["comms", "code", "ops", "__end__"],
    })
    .addNode("comms", comms)
    .addNode("code", code)
    .addNode("ops", ops)
    .addEdge(START, "planner")
    .addEdge("comms", "planner")
    .addEdge("code", "planner")
    .addEdge("ops", "planner");

  return graph.compile({ checkpointer: new MemorySaver() });
}

let _graph: Awaited<ReturnType<typeof buildGraph>> | null = null;

/** Lazy singleton — building the graph itself is cheap, but each specialist's
 * builder calls MCP `getTools()` which is a real network hit. Build once,
 * reuse across chat turns. */
export async function getGraph() {
  if (!_graph) _graph = await buildGraph();
  return _graph;
}
```

**Shape details:**

- `MessagesAnnotation` — built-in LangGraph annotation with a `messages` channel using the `add_messages` reducer. Appends on update. Used throughout.
- `ends: ["comms", "code", "ops", "__end__"]` on the planner node — tells LangGraph the set of valid `Command.goto` destinations when the node returns a Command. `__end__` covers the finalize case.
- **No edges from planner to specialists** — `Command.goto` handles the dispatch. We only need parent→planner edges and specialist→planner edges.
- `MemorySaver` — the in-process checkpointer. Stores state per `thread_id`. Phase 8 swaps this for `@langchain/langgraph-checkpoint-postgres` against Neon.

### 4.13 `routes/chat-bridge.ts` — event bridge

Shared by `/api/chat` and `/api/chat/resume`. Drains `graph.streamEvents()` and writes UIMessage parts via the AI SDK writer. Full source is in the file; key sections:

**Event routing.** A switch statement on `event.event`:

- `on_chain_start` — when a specialist node is entered. Emits `data-agent-start`. Deduped via `openAgents` set because `createReactAgent` fires the event twice (outer node + inner ReAct subgraph).
- `on_chain_end` — specialist node exits. Emits `data-agent-end`.
- `on_custom_event` (name === `herald_routing`) — Herald's routing decision. Emits `data-herald-routing` with agents + reason.
- `on_chat_model_stream` — per-token text deltas. **Filtered by `langgraph_checkpoint_ns`**, not `langgraph_node`, because `createReactAgent`'s chat model runs under an internal `"agent"` node, not the specialist's name. The checkpoint namespace looks like `"ops:uuid:agent:uuid"` when nested — we match by the leading prefix. (fixes log §7.12)
- `on_tool_start` — emits `tool-input-available`.
- `on_tool_end` — emits `tool-output-available`.

**Text block lifecycle.** Each `run_id` opens a new text block. `openTextIds` set tracks opens; at end-of-stream we emit `text-end` for each.

**Interrupt detection.** After `streamEvents` drains, the bridge calls `graph.getState({ configurable: { thread_id }})` and scans `state.tasks[].interrupts[]`. Any interrupt with `value.tool` set is surfaced as a `data-approval` UIMessage part containing `{ threadId, tool, label, input }` — the UI's approval card consumes that.

```ts
// After the stream drains, check for a paused interrupt (HIL).
const state = await (graph as any).getState({ configurable: { thread_id: threadId } });
const tasks = (state?.tasks ?? []) as Array<{
  interrupts?: Array<{ value?: { tool?: string; label?: string; input?: Record<string, unknown> } }>;
}>;
for (const t of tasks) {
  for (const interrupt of t.interrupts ?? []) {
    const v = interrupt.value;
    if (!v?.tool) continue;
    writer.write({
      type: "data-approval",
      data: { threadId, tool: v.tool, label: v.label ?? v.tool, input: v.input ?? {} },
    });
  }
}
```

The `data-approval` part is what the UI renders as the Approve / Edit / Reject card. `threadId` lets the browser POST to `/api/chat/resume` with the matching thread.

### 4.14 `routes/chat.ts` — rewritten chat route

Replaced Phase 1's `streamText` invocation with graph-driven execution.

```ts
import type { Request, Response } from "express";
import { createUIMessageStream, createUIMessageStreamResponse, type UIMessage } from "ai";
import { HumanMessage } from "@langchain/core/messages";
import { logger } from "@hermes/shared";
import { getGraph } from "../graph.js";
import { pumpGraphToWriter } from "./chat-bridge.js";

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
  try { graph = await getGraph(); }
  catch (e) {
    logger.error({ err: e }, "graph build failed");
    res.status(500).json({ error: e instanceof Error ? e.message : String(e) });
    return;
  }

  const stream = createUIMessageStream({
    async execute({ writer }) {
      await pumpGraphToWriter({
        graph, threadId, writer,
        input: { messages: [new HumanMessage(latestText)] },
      });
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
```

**Important nuance:** only the LATEST user message is fed into `graph.streamEvents`. Prior turns live in the checkpointer (`MemorySaver`, keyed by `thread_id`). When the graph runs, MessagesAnnotation's `add_messages` reducer appends the new message to the existing history — so the specialist sees the full conversation even though we only passed one message in.

### 4.15 `routes/resume.ts` — HIL resume

Mirror of `chat.ts`, but the input is a `Command({ resume })` instead of new messages.

```ts
import type { Request, Response } from "express";
import { createUIMessageStream, createUIMessageStreamResponse } from "ai";
import { Command } from "@langchain/langgraph";
import { logger } from "@hermes/shared";
import { getGraph } from "../graph.js";
import { pumpGraphToWriter } from "./chat-bridge.js";
import type { ApprovalDecision } from "../agents/approval.js";

export async function handleResume(req: Request, res: Response) {
  const body = req.body as { threadId?: string; decision?: ApprovalDecision };
  const threadId = body.threadId;
  const decision = body.decision;

  if (!threadId || !decision) {
    res.status(400).json({ error: "threadId and decision are required" });
    return;
  }

  let graph: Awaited<ReturnType<typeof getGraph>>;
  try { graph = await getGraph(); }
  catch (e) {
    logger.error({ err: e }, "graph build failed on resume");
    res.status(500).json({ error: e instanceof Error ? e.message : String(e) });
    return;
  }

  const stream = createUIMessageStream({
    async execute({ writer }) {
      await pumpGraphToWriter({
        graph, threadId, writer,
        input: new Command({ resume: decision }),
      });
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
```

**Flow:**

1. Browser clicks Approve → POST `{ threadId, decision }` here.
2. `new Command({ resume: decision })` as graph input.
3. LangGraph loads the checkpoint for that `thread_id`, finds the pending `interrupt()` call, and makes it return `decision`.
4. The `withApproval` wrapper either calls the underlying MCP tool (approved) or returns `{ cancelled: true }` (rejected).
5. Remaining graph execution streams back through the bridge as new UIMessage parts.
6. Browser merges those into the last assistant message.

### 4.16 `index.ts` — route mounting delta

One line added vs Phase 1:

```ts
import express from "express";
import { logger } from "@hermes/shared";
import { handleHealth } from "./routes/health.js";
import { handleChat } from "./routes/chat.js";
import { handleResume } from "./routes/resume.js";

const app = express();
const port = Number(process.env.PORT ?? 4000);
app.use(express.json({ limit: "4mb" }));

app.get("/api/health", handleHealth);
app.post("/api/chat", handleChat);
app.post("/api/chat/resume", handleResume);   //  ←  new in Phase 3

app.listen(port, () => {
  logger.info({ port }, "agent-runtime listening");
});
```

---

## 5. Streaming internals — LangGraph events → UIMessage parts

What traverses the wire for a typical single-specialist turn:

```
agent-runtime → browser (SSE, content-type: x-vercel-ai-ui-message-stream-v1)

data: {"type":"data-herald-routing","data":{"agents":["ops"],"reason":"..."}}\n\n
data: {"type":"data-agent-start","data":{"key":"ops"}}\n\n
data: {"type":"text-start","id":"run_abc"}\n\n
data: {"type":"text-delta","id":"run_abc","delta":"I'll "}\n\n
data: {"type":"text-delta","id":"run_abc","delta":"check "}\n\n
...
data: {"type":"tool-input-available","toolCallId":"call_1","toolName":"sentry__list_issues","input":{"project":"react-native"}}\n\n
data: {"type":"tool-output-available","toolCallId":"call_1","output":"{\"issues\":[...],\"count\":19}"}\n\n
data: {"type":"text-start","id":"run_def"}\n\n
data: {"type":"text-delta","id":"run_def","delta":"Found "}\n\n
... (summary text)
data: {"type":"text-end","id":"run_def"}\n\n
data: {"type":"data-agent-end","data":{"key":"ops"}}\n\n
data: {"type":"data-herald-routing","data":{"agents":[],"reason":"done"}}\n\n
data: {"type":"finish"}\n\n
```

For a HIL-gated write, the sequence ends differently — instead of a second `text-start/delta/end` after the tool-input, the stream emits:

```
data: {"type":"tool-input-available","toolCallId":"call_2","toolName":"slack__post_message","input":{"channel":"U...","text":"..."}}\n\n
data: {"type":"data-approval","data":{"threadId":"abc","tool":"slack__post_message","label":"Post message to Slack","input":{...}}}\n\n
data: {"type":"finish"}\n\n
```

The stream closes cleanly even though the graph is paused. The browser sees the approval card. Later, POST to `/api/chat/resume` opens a NEW stream with the continuation.

**Why no `tool-output-available` after the paused tool?** Because the tool hasn't completed yet — `interrupt()` never returned. On resume, the first event the bridge sees is `on_tool_end` for that tool call, which emits the delayed `tool-output-available`.

---

## 6. HIL approval flow — pause, approve, resume

Diagrammed for clarity:

```
                  LLM in specialist                 client (browser)
                        │
                        │ call slack__post_message({channel, text})
                        ▼
                  withApproval wrapper
                        │
                        │ interrupt({type:"approval_request", tool, label, input})
                        ▼
                  ┌───────────────────┐
                  │  LangGraph pauses │
                  │  MemorySaver      │                            
                  │  writes checkpoint│
                  │  keyed by thread  │
                  └───────────────────┘
                        │
                        │ streamEvents() drains
                        ▼
                  chat-bridge calls graph.getState
                  finds state.tasks[0].interrupts[0]
                        │
                        │ writer.write({type:"data-approval", data:{...}})
                        ▼
                  UIMessage stream closes
                                                    ▶ browser renders card
                                                    ▶ user clicks Approve
                                                    ▶ POST /api/chat/resume
                                                      { threadId, decision }
                        ◀───────────────────────────┘
                  handleResume →
                  pumpGraphToWriter(
                    input: new Command({ resume: decision })
                  )
                        │
                        ▼
                  LangGraph loads checkpoint
                  interrupt() returns `decision`
                        │
                  if approved:
                        │ await base.invoke(finalInput)  ← real Slack API call fires
                        ▼
                  tool result streams back, text streams back,
                  edge back to planner, Herald finalizes
                        │
                        │ second stream drains
                        ▼
                  client's readUIMessageStream merges new parts
                  into the same assistant message
```

**Durability story.** Because `MemorySaver` is in-process, restarting `agent-runtime` loses any pending interrupts. Phase 8 swaps to Postgres so approvals can survive minutes or hours between pause and resume.

---

## 7. Fixes log — bugs and their root causes

This section is a debugging reference. Every bug we hit during Phase 3 bring-up, what the symptom looked like, the root cause, and the fix. Ordered roughly chronologically.

### §7.1 — `text content blocks must be non-empty`

**Symptom.** Anthropic returned `400 invalid_request_error: "messages: text content blocks must be non-empty"` on the SECOND Herald call within a turn.

**Root cause.** Herald was injecting a placeholder `AIMessage({ content: "" })` into state as a carrier for routing metadata (`additional_kwargs.hermes_routing`), so the chat-bridge could read it on the next `on_chain_end` event. On round-2 Herald, when we re-serialized the state through `messageToAIPart`, that empty marker became `{role: "assistant", content: ""}` in the Anthropic request — which is rejected.

**Fix.** Replaced the marker with `dispatchCustomEvent("herald_routing", ...)` — a LangGraph callback-manager event that's picked up in `streamEvents` as `on_custom_event` with no state pollution. Also added a defensive empty-content filter in `messageToAIPart`.

### §7.2 — Specialists producing generic greetings instead of working

**Symptom.** Query asked for work, but Argus/Iris/Talos replied with introductions like *"I'm Iris, your Slack communications specialist. What can I help with today?"*.

**Root cause.** The planner was parallel-dispatching with `new Send(agent, { messages: [marker] })`. The `Send` payload REPLACES child state (unlike `Command.goto` which inherits). So specialists booted with only the empty marker as their state — no user query — and generated greetings.

**Fix.** `Send` payload now carries the full `[...currentMessages, nudge]`. Specialists see the actual user request.

### §7.3 — Herald re-dispatching the same specialists in a loop

**Symptom.** UI showed `done · Argus / done · Talos / done · Iris / done · Argus / done · Talos / done · Iris` — specialists running twice per query, eventually crashing.

**Root cause.** Two issues stacked. First, the specialists were greeting (§7.2), so their output didn't answer the user's question. Herald correctly decided the work wasn't done and re-dispatched. Second, no hop cap existed.

**Fix.** Fixed the specialist-greeting bug first (§7.2). Added `MAX_HERALD_HOPS = 3` as a hard ceiling. Counter later scoped to per-user-turn only (§7.13).

### §7.4 — Specialist-as-last-message rejected by Anthropic on Herald re-entry

**Symptom.** Another 400: *"Your API request included an `assistant` message in the final position, which would pre-fill the `assistant` response. When using output format, pre-filling the `assistant` response is not supported."*

**Root cause.** After a specialist replied, its `AIMessage` was the tail of state. Herald's next `generateObject` call built a request with that assistant message as `messages[-1]`. Anthropic's structured-output API (output_config / tools=json_schema) rejects prefill.

**Fix.** In `runHerald`, if the history tail is assistant, append a synthetic `{ role: "user", content: "Given the conversation above, what's the next routing decision? …" }` before calling `generateObject`.

### §7.5 — Specialist's own chat model rejecting assistant prefill

**Symptom.** Same "prefill not supported" error, but during a SPECIALIST's turn, not Herald's.

**Root cause.** When Herald routed Iris after Talos had already replied, state's tail was Talos's AIMessage. Iris's internal `ChatAnthropic.invoke()` inside `createReactAgent` sent that as the prefill. Anthropic rejected.

**Fix.** Herald's `Command.update` now always appends a flagged `HumanMessage` nudge. This makes the tail a user message before specialists enter. Bonus: the nudge content (`[Herald → comms] post summary to Slack`) gives the specialist a crisp task directive.

### §7.6 — Double `agent-start` / `agent-end` events in the UI

**Symptom.** Agent chips rendered twice per specialist run.

**Root cause.** `createReactAgent` is itself a subgraph. LangGraph's `streamEvents` fires `on_chain_start` for both the outer node named `comms`/`code`/`ops` AND the inner ReAct subgraph with the same name (LangGraph uses the node name as the subgraph's own name by default).

**Fix.** `chat-bridge.ts` maintains an `openAgents: Set<string>` — emit `data-agent-start` only if the agent isn't already open, and `data-agent-end` only if it is. Naturally collapses to one pair per specialist hop.

### §7.7 — Hop counter acting as a global session cap

**Symptom.** After ~3 messages in a chat session, Herald would finalize immediately with *"Max 3 specialist hops reached"* on every subsequent user message.

**Root cause.** The counter was `messages.filter(isNudge).length` — total nudges in the entire checkpointer history. Nudges persisted across user turns (checkpointer is per-thread, not per-turn), so by turn 3 the count had already accumulated past 3.

**Fix.** Walk backwards from the tail, increment on each flagged nudge, STOP at the first real user message. Resets naturally on each new user turn.

### §7.8 — All tokens hidden in the UI

**Symptom.** UI showed agent chips and tool calls, but no text output. Herald's routing notes appeared, specialists clearly did work (tool calls fired), but the summary text never reached the browser.

**Root cause.** The `on_chat_model_stream` filter in `chat-bridge.ts` gated on `metadata.langgraph_node === specialist_name`. But `createReactAgent` runs its LLM under an internal node called `"agent"` — so the metadata field equaled `"agent"`, NOT `"comms"` / `"code"` / `"ops"`. Filter rejected every token.

**Fix.** Check `metadata.langgraph_checkpoint_ns` instead — the hierarchical namespace path. When an LLM runs inside `createReactAgent` nested inside `ops`, the namespace looks like `"ops:uuid:agent:uuid"`. The bridge now matches by leading prefix: `SPECIALIST_KEYS.some(s => ns.startsWith(`${s}:`))`.

### §7.9 — "send the report" had no approval card

**Symptom.** User asked *"send the report to my slack"*, Iris produced text describing what she'd post, but no approval card appeared.

**Root cause.** Iris was generating the draft as plain text in her assistant response without actually calling `slack__post_message`. Since the tool was never invoked, the `withApproval` interrupt never fired, and no `data-approval` part was emitted.

**Fix (first attempt).** Added the `whoami` tool so Iris could resolve the user's Slack ID for DMs — previously she'd refuse *"can't DM without knowing your ID"* and just draft text instead of calling a tool.

**Fix (second).** Strengthened Iris's prompt: *"You MUST call `slack__post_message` to send. Writing the draft as text in your reply does nothing."*

### §7.10 — Sentry `list_issues` returning zero results for valid projects

**Symptom.** Argus called `sentry__list_issues({ project: "react-native" })`, got back zero issues. Argus correctly reported *"needs numeric project ID"*.

**Root cause.** Sentry's `GET /organizations/{org}/issues/?project=<x>` takes a NUMERIC project ID, not a slug. Passing a slug resulted in zero matches silently.

**Fix.** Added `resolveProjectId(slug, auth, org)` with a process-lifetime cache (one-time fetch of `/organizations/{org}/projects/` and index by slug). If the slug resolves, use the numeric ID; if not, fall back to appending `project:<slug>` to the search query (Sentry's search operator does match by slug/name).

### §7.11 — Specialists hallucinating `<function_calls>` XML tags in text

**Symptom.** Sonnet/Haiku produced responses like *`<function_calls> is:unresolved project:react-native 50 </function_calls> <function_response>{"projects":[...]}</function_response>`* — fake tool calls as literal text, with fabricated data.

**Root cause.** `MultiServerMCPClient.getTools()` was returning tool names WITHOUT the server prefix — just `list_channels`, `post_message`, `list_issues`, etc. The specialist filter `name.startsWith("slack__")` matched nothing. Specialists received zero bound tools. The LLM then hallucinated tool-call XML (a pattern it picked up in training) instead of using Anthropic's native `tool_use` blocks.

**Fix.** Added `prefixToolNameWithServerName: true` to `MultiServerMCPClient` config. Tool names now come through as `slack__list_channels`, `github__list_prs`, etc. Filter matches correctly. Also added diagnostic logs (`"MCP tools loaded"` + `"specialist tool subset"`) so this failure mode is visible next time.

### §7.12 — Herald refusing to dispatch on the first turn

**Symptom.** Herald's routing reason read *"I cannot fulfill this without clarification. Please tell me (1) the exact Sentry project names, (2) which Linear project, (3) whether you want errors…"* — and it returned `agents: []` on the first turn, so nothing happened.

**Root cause.** Overtuning. Previous prompt said *"pick the fewest agents possible"* and *"finalize if ambiguous"*. Haiku interpreted "fuzzy inputs" as grounds for finalization without dispatching. But the specialists have discovery tools that can resolve fuzzy names — Herald should trust them.

**Fix.** Rewrote routing rules with explicit anti-refusal: *"NEVER refuse or ask for clarification. Your job is to DISPATCH. On the FIRST turn, you MUST dispatch at least one specialist. Returning `{ agents: [] }` on turn 1 is a bug."* Also added discover-first guidance to each specialist's prompt.

### §7.13 — Cross-specialist disclaimers making the output unreadable

**Symptom.** Responses looked like *"Linear Issues (8 total) [table]. Sentry issues for react-native and hageman-dd: This requires ops/Argus access. I don't have those tools available. Sentry Issues Summary [table]."* — the disclaimers interleaved with the real data made it look like work was missing when it wasn't.

**Root cause.** Specialist prompts had a clause *"If the request had parts outside your scope, note that other specialists handle them"*. Haiku honored that literally even when Herald had already dispatched the other specialists in parallel.

**Fix.** Removed the clause. New rule: *"Do your part only. Say nothing about other specialists or scope — Herald already dispatches them."* Cleaner output with no redundant noise.

### §7.14 — Raw LangChain `ToolMessage` serialization bloating tool output

**Symptom.** Every tool-output-available block in the UI rendered the full LangChain serialization wrapper:

```json
{ "lc": 1, "type": "constructor",
  "id": ["langchain_core", "messages", "ToolMessage"],
  "kwargs": { "status": "success", "content": "{\"issues\":[...]}", ... } }
```

Real data was hidden inside `kwargs.content` as a JSON string.

**Fix.** Added `unwrapToolOutput()` in the UI's `tool-part.tsx` — detects `type === "constructor"` with ToolMessage in the id, extracts `kwargs.content`, `JSON.parse`s it. Also unwraps MCP's `{content: [{type: "text", text: "..."}]}` pattern. Orders of magnitude less noise; data readable at a glance.

(This is a frontend fix but worth documenting here because the symptom looks backend-related and might be misdiagnosed otherwise.)

### §7.15 — Slack `missing_scope` after adding `chat:write` to the app

**Symptom.** Iris called `slack__post_message` after approval. Slack returned `missing_scope`.

**Root cause.** Adding a scope to a Slack app's OAuth settings doesn't update existing tokens. The current `xoxp-` token was minted before `chat:write` existed in the scope list.

**Fix (user action).** Reinstall the Slack app from the OAuth & Permissions page, which mints a new token with the updated scopes. Replace `SLACK_BOT_TOKEN` in `.env` with the new value.

---

## 8. Glossary additions

Phase 1's glossary (MCP, Streamable HTTP, UIMessage, etc.) still applies. Phase 3 adds:

- **`createReactAgent`** — `@langchain/langgraph/prebuilt` helper that builds a reusable ReAct subgraph from `{ llm, tools, prompt, name }`. Each specialist is one of these. Internally it's a `StateGraph` with two nodes (`agent`, `tools`) and an `add_messages` reducer on its `messages` channel.
- **`StateGraph` + `MessagesAnnotation`** — LangGraph's primitives. A `StateGraph` is a typed node graph; `MessagesAnnotation` is a built-in state shape with a `messages: BaseMessage[]` channel and the `add_messages` reducer (appends, dedupes by id).
- **`Command`** — a node return value that combines a state update with a control-flow directive. `new Command({ goto, update })` moves to `goto` AND merges `update` into state in one atomic step.
- **`Send`** — LangGraph's parallel-dispatch primitive. `new Send(nodeName, data)` schedules `nodeName` to run with `data` as its input state. Used inside `Command.goto` array for fan-out. **Replaces child state; does not inherit.**
- **`interrupt(value)`** — pauses graph execution at the call site. Writes a checkpoint to the current `thread_id`. The client receives the `value` in the next stream's pending interrupts. On resume via `new Command({ resume })`, the call returns whatever was passed to `resume`.
- **`MemorySaver`** — in-process checkpointer. Swap for `PostgresSaver` in Phase 8 for durability.
- **`dispatchCustomEvent(name, payload)`** — from `@langchain/core/callbacks/dispatch`. Fires an `on_custom_event` in `streamEvents` with the given name/payload. Used by Herald to advertise routing decisions to the UI without polluting state.
- **Thread** — a single conversation identified by `thread_id` (= `useChat.id` on the browser). All checkpoints for one session share that id.
- **Specialist** — a createReactAgent bound to a subset of MCP tools. Today: `comms` (Iris), `code` (Talos), `ops` (Argus).
- **Nudge** — a `HumanMessage` with `additional_kwargs.hermes_nudge === true`, injected by Herald's `routingToCommand`. Carries the routing reason as content AND marks the hop for the per-turn counter.
- **HIL (Human-in-the-Loop)** — the interrupt/approve/resume flow. Gates all write tools in Phase 3.
- **UIMessage data parts** — custom streaming parts of form `{ type: "data-<name>", data: <payload> }`. Phase 3 uses four: `data-agent-start`, `data-agent-end`, `data-herald-routing`, `data-approval`.
