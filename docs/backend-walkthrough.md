# Hermes AI — Backend Walkthrough (MCP + Chat API)

A complete tour of the backend: MCP servers, agent-runtime, and the chat API. Every file is inlined. Every function is explained. Every tool is documented with the external API it calls and the shape it returns.

**Scope of this document.** Only the three directories that make the backend tick:

```
apps/agent-runtime/src/                 — Express server + chat handler + assistant composition
packages/mcp-servers/slack/src/         — Slack MCP server (Streamable HTTP, 4 tools)
packages/mcp-servers/github/src/        — GitHub MCP server (Streamable HTTP, 7 tools)
packages/mcp-servers/linear/src/        — Linear MCP server (Streamable HTTP, 4 tools)
packages/shared/src/                    — Cross-cutting primitives the above import
  ├── load-env.ts
  └── llm.ts
```

UI/web/styling code is deliberately ignored per the brief.

---

## Table of contents

- [1. The big picture](#1-the-big-picture)
- [2. Journey of a prompt — end-to-end trace](#2-journey-of-a-prompt--end-to-end-trace)
- [3. File-by-file walkthrough](#3-file-by-file-walkthrough)
  - [3.1 `packages/shared/src/load-env.ts` — silently loads the root `.env`](#31-packagessharedsrcload-envts)
  - [3.2 `packages/shared/src/llm.ts` — the one place model IDs live](#32-packagessharedsrcllmts)
  - [3.3 `apps/agent-runtime/src/index.ts` — the Express entry point](#33-appsagent-runtimesrcindexts)
  - [3.4 `apps/agent-runtime/src/routes/health.ts` — Neon + Upstash liveness](#34-appsagent-runtimesrcroutes-healthts)
  - [3.5 `apps/agent-runtime/src/agents/assistant.ts` — MCP client factory + system prompt](#35-appsagent-runtimesrcagentsassistantts)
  - [3.6 `apps/agent-runtime/src/routes/chat.ts` — streamText + streaming response](#36-appsagent-runtimesrcroutes-chatts)
  - [3.7 `packages/mcp-servers/slack/src/index.ts` — Slack MCP boot](#37-packagesmcp-serversslacksrcindexts)
  - [3.8 `packages/mcp-servers/slack/src/tools.ts` — 4 Slack tools](#38-packagesmcp-serversslacksrctoolsts)
  - [3.9 `packages/mcp-servers/github/src/index.ts` — GitHub MCP boot](#39-packagesmcp-serversgithubsrcindexts)
  - [3.10 `packages/mcp-servers/github/src/tools.ts` — 7 GitHub tools](#310-packagesmcp-serversgithubsrctoolsts)
  - [3.11 `packages/mcp-servers/linear/src/index.ts` — Linear MCP boot](#311-packagesmcp-serverslinearsrcindexts)
  - [3.12 `packages/mcp-servers/linear/src/tools.ts` — 4 Linear tools](#312-packagesmcp-serverslinearsrctoolsts)
- [4. Per-tool quick reference](#4-per-tool-quick-reference)
- [5. Streaming internals — what actually travels on the wire](#5-streaming-internals--what-actually-travels-on-the-wire)
- [6. Glossary](#6-glossary)

---

## 1. The big picture

Four processes run in development (each on its own port). They speak HTTP to each other. Each process is small and single-purpose.

```
┌──────────────────────────────────────────────────────────────────────────┐
│                        DEV TOPOLOGY (4 processes)                         │
│                                                                           │
│  Browser  ──HTTP──▶  Next.js   ──HTTP──▶  agent-runtime                   │
│  :3000              :3000                :4000                            │
│                     /api/chat            /api/chat    ──Streamable HTTP──▶│
│                     (proxy)              (streamText)                     │
│                                             ▲    ▲     ▲                  │
│                                             │    │     │                  │
│                                             │    │     │                  │
│                                    ┌────────┘    │     └────────┐         │
│                                    │             │              │         │
│                              mcp-slack      mcp-github     mcp-linear     │
│                              :4100/mcp      :4101/mcp      :4102/mcp      │
│                                 │               │              │          │
│                                 │               │              │          │
│                           api.slack.com  api.github.com  api.linear.app   │
└──────────────────────────────────────────────────────────────────────────┘
```

**Why this shape?**

- **Next.js as a thin proxy.** The browser only ever talks to the Next.js route handler at `/api/chat`. That route turns around and streams to the agent-runtime. This is the "Vercel trap" architecture: Vercel functions have a 60–300s timeout and no WebSockets, so the actual LLM loop must live on a long-running process (Railway in prod, `tsx watch` in dev).
- **Agent-runtime owns the LLM call.** It calls Anthropic with `streamText`, hands it a tool set assembled from the MCP clients, and pipes back UIMessage chunks.
- **MCP servers are separate processes.** Each one is a tiny Express app that mounts the Model Context Protocol's Streamable HTTP transport at `/mcp`. It exposes a handful of tools. When called, it hits the real external API (Slack Web API / Octokit / Linear SDK) and returns a JSON-stringified result.

**Protocol glossary in one paragraph.** *MCP (Model Context Protocol)* is Anthropic's JSON-RPC 2.0 protocol for exposing tools/resources/prompts to LLM agents. *Streamable HTTP* is MCP's preferred transport for networked servers — it's HTTP POST where each request is a JSON-RPC message, and the response is either a plain JSON reply or an SSE (Server-Sent Events) stream. We run it stateless: each POST creates a fresh `McpServer` + `StreamableHTTPServerTransport` pair that lives only for that request.

---

## 2. Journey of a prompt — end-to-end trace

Suppose you type "list my most active github repos" and hit Enter. Here is what actually happens, in order:

1. **Browser → Next.js.** The React `useChat` hook POSTs to `/api/chat` with a body like `{ messages: [...previous, { role: 'user', parts: [{ type: 'text', text: '…' }] }] }`.

2. **Next.js → agent-runtime.** Our `apps/web/src/app/api/chat/route.ts` fetches `${AGENT_RUNTIME_URL}/api/chat` with `duplex: 'half'` so the response stream is passed through unchanged.

3. **agent-runtime boots an MCP session.** `handleChat` in `apps/agent-runtime/src/routes/chat.ts` calls `connectMCPTools(DEFAULT_ENDPOINTS)`. That function opens one `@ai-sdk/mcp` client per MCP endpoint (Slack, GitHub, Linear), calls `.tools()` on each client — which triggers a `tools/list` JSON-RPC request to each MCP server — and merges the three tool maps into one `ToolSet`, prefixing every tool name with its service (so `list_my_repos` becomes `github_list_my_repos`).

4. **streamText is invoked.** `handleChat` calls `streamText` with `model: models.fast` (Claude Haiku 4.5), the built system prompt (with today's date injected), the recent message history, and the merged tools. `stopWhen: stepCountIs(10)` tells the SDK to keep running a tool-loop for up to 10 steps.

5. **Model replies with a tool call.** Anthropic emits a `tool-call` UIMessage part: `{ type: 'tool-github_list_my_repos', state: 'input-available', input: { sort: 'pushed' } }`. The AI SDK auto-invokes the matching tool function on our `ToolSet`.

6. **AI SDK MCP client → GitHub MCP.** Under the hood, the `@ai-sdk/mcp` client sends a JSON-RPC `tools/call` over HTTP to `http://127.0.0.1:4101/mcp` with `{ name: 'list_my_repos', arguments: { sort: 'pushed' } }`.

7. **GitHub MCP server → GitHub REST API.** The handler registered in `packages/mcp-servers/github/src/tools.ts` calls `octokit.repos.listForAuthenticatedUser({ sort, affiliation, visibility, per_page })`, maps the raw response down to compact fields, and returns a JSON-stringified MCP result: `{ content: [{ type: 'text', text: '{"repos":[...],"count":30}' }] }`.

8. **Tool result flows back to the model.** The AI SDK MCP client receives the JSON-RPC reply, formats it as a UIMessage tool result part (`state: 'output-available'`, `output: '...'`), and the AI SDK feeds it back into the next Anthropic turn.

9. **Model writes the summary.** Claude reads the tool output, produces text like *"Your 5 most recently pushed repos are: hermes-ai (4h ago), cruvo (2d ago), …"* — streamed token-by-token as `text-delta` chunks.

10. **streamText → UI message stream.** `result.toUIMessageStreamResponse()` returns a `Response` whose body is a readable stream of newline-delimited UIMessage chunks. `handleChat` pumps that stream byte-for-byte into the Express response.

11. **Next.js proxy relays the bytes.** The Next.js route handler returns `new Response(upstream.body, …)`, so the browser gets the exact byte stream the agent-runtime produced.

12. **Browser renders progressively.** `useChat` decodes each UIMessage chunk and updates `messages`. Text appears character-by-character; tool calls appear as collapsible panels; the whole thing finalizes when the stream closes.

Total external API calls for this one prompt: **two round-trips to api.anthropic.com** (one initial with tools, one after the tool result), **one round-trip to api.github.com** (`GET /user/repos`), zero to Slack/Linear because the model didn't need them. Cost is usually under $0.001 because Haiku is cheap.

---

## 3. File-by-file walkthrough

Every file below is shown verbatim, with prose above and below explaining what it does and why.

---

### 3.1 `packages/shared/src/load-env.ts`

**Purpose.** Loads the monorepo-root `.env` regardless of which package's `cwd` invoked the process. This is important because `tsx` runs each server with its own working directory (`packages/mcp-servers/slack/` for Slack MCP, etc.), and `dotenv/config` by default looks in `cwd`. Without this file, every server would fail to find the root `.env` and every tool would report "token not set".

This module is imported at the top of every MCP server's entry point and the agent-runtime's entry point, via `import "@hermes/shared";` — which triggers `packages/shared/src/index.ts` to `import "./load-env.js"` first.

```ts
// Loads the monorepo-root .env regardless of which package's CWD invoked it.
// Idempotent: dotenv does not override already-set vars, so production
// environments (Railway, Vercel) that inject env vars directly are untouched.

import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { config } from "dotenv";

// This file lives at packages/shared/src/load-env.ts.
// Monorepo root is three levels up: src → shared → packages → root.
const here = fileURLToPath(new URL(".", import.meta.url));
config({ path: resolve(here, "../../../.env"), quiet: true });
```

**Line-by-line.**

- **L5–7:** `resolve`, `fileURLToPath`, and `config` are the only imports. `node:path` and `node:url` are Node builtins; `dotenv` is a devDependency.
- **L11:** `import.meta.url` under NodeNext is the `file:///absolute/path/to/load-env.ts` URL of *this* module. `new URL(".", …)` resolves to the directory containing it (i.e., `packages/shared/src/`). `fileURLToPath` converts the URL to an OS-native path string, which `resolve` can then combine with relative segments.
- **L12:** `../../../.env` climbs three levels: `src → shared → packages → repo-root`. `quiet: true` silences dotenv's "injected env (22) from ..." banner — the tip we hit earlier that spammed the dev log.
- **Idempotency.** `dotenv.config` by default *does not* overwrite existing `process.env` keys. So if Railway's dashboard already injected `DATABASE_URL`, our `.env` file can't clobber it in production — exactly what we want.

---

### 3.2 `packages/shared/src/llm.ts`

**Purpose.** The single source of truth for every LLM identifier. Every model ID string in the whole project is one edit away here.

Three distinct exports because three distinct consumers exist:

- `models` — for the Vercel AI SDK (one-shot calls like `generateText`, `streamText`, frontend `useChat`).
- `chatModels` — for LangChain/LangGraph nodes (when we add multi-agent routing in Phase 3). Not used by Phase 1's chat.
- `embedModel` — for `text-embedding-3-small` calls that go into pgvector (Phase 2+).

```ts
// Single source of truth for every LLM call in the project.
// Change a model here, change it everywhere.
//
// Three exports, three consumers:
//   - `models`      — Vercel AI SDK (one-shot generation, frontend streaming)
//   - `chatModels`  — LangChain wrappers (agent nodes inside LangGraph)
//   - `embedModel`  — OpenAI embeddings for pgvector (Claude has no embeddings)
//
// See packages/shared/src/llm.README.md for the full decision table.

import { anthropic } from "@ai-sdk/anthropic";
import { openai } from "@ai-sdk/openai";
import { ChatAnthropic } from "@langchain/anthropic";
import type { EmbeddingModel, LanguageModel } from "ai";

// ─── Vercel AI SDK (one-shot + frontend streaming) ──────────────────────
// Use with: generateText, generateObject, streamText, embed, useChat.
export const models: Record<"fast" | "standard" | "deep", LanguageModel> = {
  fast: anthropic("claude-haiku-4-5"), //   ~$0.001/query — routing, classification, cache keys
  standard: anthropic("claude-sonnet-4-6"), // ~$0.01/query  — most agent work (default)
  deep: anthropic("claude-opus-4-7"), //    ~$0.05/query  — Chronos, complex reasoning, critical writes
};

// ─── LangChain chat models (LangGraph agent nodes) ──────────────────────
// Use ONLY inside LangGraph nodes — implements BaseChatModel, which
// LangGraph's bindTools / invoke / stream expect.
// temperature: 0 for deterministic tool selection.
export const chatModels = {
  fast: new ChatAnthropic({ model: "claude-haiku-4-5", temperature: 0 }),
  standard: new ChatAnthropic({ model: "claude-sonnet-4-6", temperature: 0 }),
  deep: new ChatAnthropic({ model: "claude-opus-4-7", temperature: 0 }),
} as const;

// ─── Embeddings (pgvector, 1536 dims) ───────────────────────────────────
export const embedModel: EmbeddingModel = openai.embedding(
  "text-embedding-3-small",
);

export type ModelTier = keyof typeof models;
```

**Key details.**

- The explicit `: Record<"fast" | "standard" | "deep", LanguageModel>` annotation on `models` is there to satisfy TypeScript 6's stricter "inferred type cannot be named without a reference to `@ai-sdk/provider`" portability rule. Without it, the symbol can't be re-exported through the `@hermes/shared/llm` subpath cleanly.
- `anthropic("claude-haiku-4-5")` returns a `LanguageModel` object — a descriptor, not a live connection. The actual network call happens inside `streamText` when it gets this object.
- The Vercel AI SDK resolves `ANTHROPIC_API_KEY` from `process.env` at invocation time. Because `load-env.ts` already populated `process.env` before this module evaluated, the key is available.
- The subpath export lives in `packages/shared/package.json`:
  ```json
  "exports": {
    ".": { "types": "./src/index.ts", "default": "./src/index.ts" },
    "./llm": { "types": "./src/llm.ts", "default": "./src/llm.ts" }
  }
  ```
  That's what lets `apps/agent-runtime/src/routes/chat.ts` write `import { models } from "@hermes/shared/llm"`.

---

### 3.3 `apps/agent-runtime/src/index.ts`

**Purpose.** Bootstraps the Express app. Mounts exactly two routes — `GET /api/health` (a shallow liveness check) and `POST /api/chat` (the real work). Binds on `process.env.PORT ?? 4000`.

```ts
import express from "express";
// @hermes/shared auto-loads the monorepo-root .env on import.
import { logger } from "@hermes/shared";
import { handleHealth } from "./routes/health.js";
import { handleChat } from "./routes/chat.js";

const app = express();
const port = Number(process.env.PORT ?? 4000);

app.use(express.json({ limit: "4mb" }));

app.get("/api/health", handleHealth);
app.post("/api/chat", handleChat);

app.listen(port, () => {
  logger.info({ port }, "agent-runtime listening");
});
```

**Line-by-line.**

- **L1:** `express` v5 — the only runtime framework dependency. v5 is an intentional choice because its error handling for async handlers is cleaner than v4.
- **L3:** Importing anything from `@hermes/shared` forces evaluation of `packages/shared/src/index.ts`, which runs `import "./load-env.js"` as its first line. This means `process.env` is populated before any other module reads from it.
- **L4–5:** The `.js` extensions are NodeNext convention — TypeScript rewrites `.js` to the actual `.ts` source at compile time. Under `tsx watch` (dev) or `node` with a build step (prod), these paths resolve correctly.
- **L8:** `PORT` is overridden by the runtime in production (Railway). In dev it defaults to 4000.
- **L10:** `express.json` with a 4 MB limit. Chat messages with long system prompts plus message history can approach a megabyte; 4 MB gives headroom without being obscene. No body = rejected.
- **L12–13:** Two endpoints. That's it. No auth middleware in Phase 1. Phase 8 adds a bearer token check for `/api/chat`.
- **L15–17:** `listen` binds all interfaces (no host arg). Fine for dev; in prod Railway terminates TLS upstream. `logger.info` is the Pino logger from shared — in dev it pretty-prints with ISO time; in prod it emits JSON.

---

### 3.4 `apps/agent-runtime/src/routes/health.ts`

**Purpose.** `GET /api/health` returns `{ status, services, errors? }` with live ping results for Neon (Postgres) and Upstash (Redis). The web status bar polls this every 20 seconds so you see green/red at a glance.

```ts
import type { Request, Response } from "express";
import { prisma, redis } from "@hermes/shared";

type ServiceStatus = "connected" | "error";
interface Health {
  status: "ok" | "degraded";
  services: { neon: ServiceStatus; upstash: ServiceStatus };
  errors?: { neon?: string; upstash?: string };
}

async function checkNeon(): Promise<{ ok: boolean; error?: string }> {
  try {
    await prisma.$queryRaw`SELECT 1`;
    return { ok: true };
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : String(err),
    };
  }
}

async function checkUpstash(): Promise<{ ok: boolean; error?: string }> {
  try {
    const reply = await redis().ping();
    return { ok: reply === "PONG" };
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : String(err),
    };
  }
}

export async function handleHealth(_req: Request, res: Response) {
  const [neon, upstash] = await Promise.all([checkNeon(), checkUpstash()]);

  const body: Health = {
    status: neon.ok && upstash.ok ? "ok" : "degraded",
    services: {
      neon: neon.ok ? "connected" : "error",
      upstash: upstash.ok ? "connected" : "error",
    },
  };
  if (!neon.ok || !upstash.ok) {
    body.errors = {};
    if (!neon.ok) body.errors.neon = neon.error;
    if (!upstash.ok) body.errors.upstash = upstash.error;
  }

  res.status(body.status === "ok" ? 200 : 503).json(body);
}
```

**Function breakdown.**

- `checkNeon()` runs `SELECT 1` through Prisma's tagged-template query API (`prisma.$queryRaw\`SELECT 1\``). Tagged-template form parameterizes automatically — safe against SQL injection, not that a literal `1` could be injected. A successful query means the Neon connection is alive and the Prisma adapter (PgBouncer-style) is healthy.
- `checkUpstash()` calls `redis()` (a factory from `@hermes/shared` that returns a lazy-connected ioredis client) and runs `.ping()`. Redis's PING command returns the string `"PONG"`; if we see that, we're connected. The `redis()` wrapper is lazy because evaluating `new Redis(process.env.REDIS_URL)` at import time would fail in environments where the URL isn't set.
- `handleHealth` runs both checks in parallel via `Promise.all`, then composes the payload. If either check fails, `status` flips to `"degraded"` and the HTTP status flips to `503` so uptime monitors see the red. Individual error messages are nested under `errors` only when present so the happy-path response stays compact.

---

### 3.5 `apps/agent-runtime/src/agents/assistant.ts`

**Purpose.** Two things: (1) open MCP clients against a list of Streamable-HTTP endpoints and merge their tools into one `ToolSet` for `streamText` to consume, and (2) compose the system prompt that Claude sees, with today's date injected and Slack search operators documented.

```ts
import { createMCPClient } from "@ai-sdk/mcp";
import type { ToolSet } from "ai";

export interface MCPEndpoint {
  name: string;
  url: string;
}

/** Open MCP clients for each endpoint, return their merged ToolSet. */
export async function connectMCPTools(
  endpoints: MCPEndpoint[],
): Promise<{ tools: ToolSet; close: () => Promise<void> }> {
  const clients = await Promise.all(
    endpoints.map(async ({ name, url }) => {
      const client = await createMCPClient({
        transport: { type: "http", url },
      });
      return { name, client };
    }),
  );

  const toolSets = await Promise.all(
    clients.map(async ({ name, client }) => {
      const toolset = await client.tools();
      // Prefix tool names with the service so the model can tell them apart
      // (and so two services can both expose `list_issues` without collision).
      return Object.fromEntries(
        Object.entries(toolset).map(([tool, def]) => [`${name}_${tool}`, def]),
      );
    }),
  );

  const tools = Object.assign({}, ...toolSets) as ToolSet;
  const close = async () => {
    await Promise.allSettled(clients.map((c) => c.client.close()));
  };

  return { tools, close };
}

const BASE_SYSTEM = `You are Hermes, an AI assistant with read-only access to the user's Slack, GitHub, and Linear workspaces via MCP tools.

Tool naming: every tool is prefixed with its service — e.g., \`slack_list_channels\`, \`github_list_prs\`, \`linear_list_issues\`.

Guidelines:
- Prefer calling a tool over guessing. If a question can be answered with data, fetch it.
- When unsure of an ID (channel, repo, issue, or user), resolve it first — GitHub: \`get_authenticated_user\`; Slack: \`lookup_user\`; Linear: \`list_projects\`.
- For time-relative queries ("yesterday", "last week", "this month"), translate to absolute dates using the current date below, then pass those into tool query operators.
- Be concise. Summarize lists; surface only fields that matter to the user's question.
- If a tool returns an error about missing credentials, tell the user which env var needs to be set.`;

/** Compose the system prompt at request time so the LLM always sees a fresh
 * date. Format: ISO date + day name + timezone offset. */
export function buildSystemPrompt(): string {
  const now = new Date();
  const iso = now.toISOString().slice(0, 10); // YYYY-MM-DD, UTC
  const yesterday = new Date(now.getTime() - 24 * 60 * 60 * 1000)
    .toISOString()
    .slice(0, 10);
  const weekday = now.toLocaleDateString("en-US", { weekday: "long" });
  const tzOffsetMin = now.getTimezoneOffset();
  const tzHours = -Math.floor(tzOffsetMin / 60);
  const tzMinutes = Math.abs(tzOffsetMin % 60);
  const tz = `UTC${tzHours >= 0 ? "+" : ""}${tzHours}${tzMinutes ? `:${String(tzMinutes).padStart(2, "0")}` : ""}`;

  return `${BASE_SYSTEM}

Current date: ${iso} (${weekday}, server time ${tz}).
"Yesterday" = ${yesterday}. "Today" = ${iso}.

Slack search operators the tools accept:
  from:@handle    — messages by a specific user
  to:@handle      — messages addressed to a user (DMs/mentions)
  with:@handle    — conversations involving a user (both directions, incl. DMs)
  in:#channel     — scoped to one channel
  on:YYYY-MM-DD   — exact date
  before:YYYY-MM-DD / after:YYYY-MM-DD
  during:january  — month-scoped`;
}

export const SYSTEM_PROMPT = buildSystemPrompt(); // static fallback

export const DEFAULT_ENDPOINTS: MCPEndpoint[] = [
  {
    name: "slack",
    url: process.env.MCP_SLACK_URL ?? "http://127.0.0.1:4100/mcp",
  },
  {
    name: "github",
    url: process.env.MCP_GITHUB_URL ?? "http://127.0.0.1:4101/mcp",
  },
  {
    name: "linear",
    url: process.env.MCP_LINEAR_URL ?? "http://127.0.0.1:4102/mcp",
  },
];
```

**`connectMCPTools(endpoints)` — line by line.**

- **Arg shape.** Takes an array of `{ name, url }`. `name` becomes the tool-name prefix; `url` is the full Streamable HTTP URL (e.g., `http://127.0.0.1:4100/mcp`).
- **Step 1 — open clients (Promise.all).** For each endpoint, `createMCPClient({ transport: { type: "http", url } })` returns a client that has already performed the MCP `initialize` handshake. Under the hood this is an HTTP POST to the MCP URL with a JSON-RPC `initialize` request; the server replies with its capabilities and a session ID (we disable session IDs — more on that in §3.7). Running them in parallel means three simultaneous HTTP round-trips instead of three sequential ones — 3× startup speedup for the chat request.
- **Step 2 — discover tools.** `client.tools()` sends a JSON-RPC `tools/list` request to the server. The server responds with an array of `{ name, description, inputSchema }`. The AI SDK MCP client wraps each into a Vercel AI SDK `tool()` definition — the format `streamText` expects. The return shape is `Record<string, Tool>`, a ToolSet.
- **Prefixing.** We rename every tool from `list_channels` to `slack_list_channels` (etc.) so (a) the model can tell which service a tool belongs to from the name alone, and (b) two services can safely expose tools with colliding names (both GitHub and Linear expose `list_issues` — without prefixing, one would overwrite the other).
- **Merge.** `Object.assign({}, ...toolSets)` flattens the three per-service maps into one. Cast to `ToolSet` (AI SDK's alias for `Record<string, Tool>`).
- **`close()`.** Returned separately so the caller can run it in `onFinish`. Uses `Promise.allSettled` — we try to close every client even if one throws. An MCP client close is effectively a no-op for stateless HTTP (there's no session to tear down), but the API contract is there for the stateful case.

**`buildSystemPrompt()` — why it's a function, not a constant.**

The prompt is recomputed on every chat request so the "Current date" line is always fresh. If we cached the string at module load, it'd be stale within a day. The function:

- Computes today's ISO date (UTC, first 10 chars of `toISOString()`).
- Computes yesterday by subtracting 24h (handles month/year boundaries via `Date`'s arithmetic).
- Formats the weekday in US English for readability ("Saturday").
- Derives a compact timezone offset like `UTC+5:30` or `UTC-5` from `getTimezoneOffset()`. Note: `getTimezoneOffset()` returns minutes *west* of UTC as a positive number, so we negate the hour sign to get the conventional format.

The static `SYSTEM_PROMPT` export is just a module-eval-time snapshot — convenient if a consumer doesn't care about date freshness, but we don't actually use it in `chat.ts`.

**`DEFAULT_ENDPOINTS`.**

The three MCP URLs, each with an env override (`MCP_*_URL`). Hardcoded defaults are `127.0.0.1` — never `localhost` or `0.0.0.0`, because `127.0.0.1` is the only address the MCP SDK's StreamableHTTPServerTransport is bound to by default (DNS-rebinding protection). In production we'll likely collapse all four processes onto one box and use Unix sockets or loopback, or split them across containers and set the URLs from Railway's internal DNS.

---

### 3.6 `apps/agent-runtime/src/routes/chat.ts`

**Purpose.** The actual chat endpoint. Validates input, opens MCP clients, calls `streamText`, and pumps the resulting UIMessage stream back to the client.

```ts
import type { Request, Response } from "express";
import { convertToModelMessages, streamText, stepCountIs } from "ai";
import type { UIMessage } from "ai";
import { models } from "@hermes/shared/llm";
import { logger } from "@hermes/shared";
import {
  buildSystemPrompt,
  connectMCPTools,
  DEFAULT_ENDPOINTS,
} from "../agents/assistant.js";

/** Keep the last N UIMessages sent to the model. Older context drops off the
 * bottom of the prompt — prevents cumulative token growth across a session.
 * Memory / summarization lives in Phase 2; this is the stopgap. */
const MAX_HISTORY = 20;

export async function handleChat(req: Request, res: Response) {
  const body = req.body as { messages?: UIMessage[] };
  const messages = (body.messages ?? []).slice(-MAX_HISTORY);

  const { tools, close } = await connectMCPTools(DEFAULT_ENDPOINTS);

  try {
    const result = streamText({
      // Haiku for Phase 1's tool-loop: cheap, plenty smart for tool selection,
      // and leaves much more headroom under the 10K tokens/min tier. Swap to
      // models.standard (Sonnet) when Phase 6 adds tier-based routing.
      model: models.fast,
      system: buildSystemPrompt(),
      messages: await convertToModelMessages(messages),
      tools,
      // Multi-step: keep looping tool-call → result → LLM until the model
      // stops requesting tools or we hit the step cap.
      stopWhen: stepCountIs(10),
      onFinish: async () => {
        await close();
      },
      onError: ({ error }) => {
        logger.error({ err: error }, "streamText error");
      },
    });

    // Pipe the AI SDK UI-message stream back to Next.js unchanged.
    const response = result.toUIMessageStreamResponse();
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
  } catch (e) {
    logger.error({ err: e }, "chat handler failed");
    await close();
    if (!res.headersSent) {
      res.status(500).json({
        error: e instanceof Error ? e.message : String(e),
      });
    }
  }
}
```

**Request lifecycle.**

1. **Parse the body.** `req.body` is already JSON-parsed by `express.json()` in `index.ts`. The cast to `{ messages?: UIMessage[] }` is a type-only assertion — no runtime validation here. Malformed bodies just return an empty `messages` array and the model will be invoked with zero user input (it'll likely say "Hi — what can I help with?").
2. **Trim history.** `.slice(-MAX_HISTORY)` keeps only the last 20 turns. Any older context falls off the back of the window. This is a stopgap until Phase 2 adds real memory (summarization + vector recall).
3. **Open MCP clients.** `connectMCPTools(DEFAULT_ENDPOINTS)` does three `initialize` + `tools/list` round-trips in parallel, returning `{ tools, close }`. The `close` cleanup is captured in a closure so both the happy path (`onFinish`) and the error path can call it.
4. **Invoke `streamText`.** The critical call. See below for each option.
5. **Pipe.** `toUIMessageStreamResponse()` returns a Web-standard `Response` whose `body` is a `ReadableStream<Uint8Array>`. Express's `res.write` accepts `Uint8Array` directly. The `pump` async function reads chunks from the stream and writes them to Express until the stream ends, then calls `res.end()`. `void pump()` kicks off the async pump without awaiting — the handler returns immediately so Express doesn't block.
6. **Error path.** If `streamText` throws synchronously (rare — usually errors come async via `onError`), we log, close the MCP clients, and return a JSON 500. `!res.headersSent` guards against double-write if we already started streaming before the error.

**`streamText` options — one by one.**

| Option | Value | What it does |
|---|---|---|
| `model` | `models.fast` (Haiku 4.5) | The Anthropic model ID. The AI SDK constructs the HTTP request to `api.anthropic.com/v1/messages` using `ANTHROPIC_API_KEY` from env. |
| `system` | `buildSystemPrompt()` | Fresh system prompt per request (date-aware). |
| `messages` | `await convertToModelMessages(messages)` | `convertToModelMessages` is an **async** helper in AI SDK v6 that translates UIMessage format (which includes file parts, tool-call parts, etc.) to the simpler `CoreMessage` format the Anthropic API expects (role + content). In v5 this was synchronous; v6 made it async because it can inline attachment URLs. |
| `tools` | Merged ToolSet from MCP clients | Every entry in this map becomes a tool descriptor in the Anthropic request: `{ name, description, input_schema }`. The model sees them all. |
| `stopWhen` | `stepCountIs(10)` | The tool loop runs up to 10 steps. A "step" is one LLM call + its tool-invocation cycle. With 10 steps the model can (say) call `lookup_user`, then `search_messages`, then `get_thread`, then synthesize — all within one `streamText` invocation. If the model tries to loop beyond 10, the SDK forces a stop. |
| `onFinish` | `async () => { await close(); }` | Called exactly once when the stream finalizes (whether via normal completion, error, or abort). We close the MCP clients here — after this, the next chat request will open new ones. |
| `onError` | Logs and continues | Errors inside the stream (provider 5xx, tool errors, network blips) are passed here. We log with Pino; the stream still emits an `error` part to the client so the UI can show a retry button. |

**How multi-step tool looping actually works under the hood.**

When `streamText` runs with `tools` and `stopWhen` set, it's not one HTTP call to Anthropic — it's a loop:

1. POST to `/v1/messages` with `tools` included. Response: `tool_use` block(s).
2. The AI SDK invokes the matching tool function from our ToolSet. For MCP tools, this delegates to the `@ai-sdk/mcp` client's internal `tools/call` JSON-RPC request to the MCP server, which returns a result.
3. POST to `/v1/messages` again, with the previous assistant turn (the tool_use) and a new user turn (the tool_result) appended. Response: either more tool_use blocks, or plain `text`.
4. Loop steps 2–3 until the model emits only text (no tool_use) or `stopWhen` fires.

Each of those Anthropic round-trips is streaming — `content_block_delta` events arrive token-by-token and are emitted as `text-delta` UIMessage parts. Tool calls come as `tool-<name>` parts with lifecycle states (`input-streaming` → `input-available` → `output-available`/`output-error`).

**Why `void pump()` and not `await`?**

If we `await pump()`, the handler returns only after the stream fully drains — which could take 30 seconds. During that time Express holds the request open (fine), but any errors inside `pump` would bubble to Express's default error handler with no context. By kicking it off and letting the outer `try/catch` only cover the synchronous setup, we keep the happy path simple; pumps rarely fail once started (they'd fail during `streamText` construction, which is already inside the try).

---

### 3.7 `packages/mcp-servers/slack/src/index.ts`

**Purpose.** Spin up an Express app that mounts the MCP Streamable HTTP transport at `/mcp` and accepts Slack-flavored tool calls. Binds to `127.0.0.1:4100` in dev. Creates a fresh `McpServer` + transport *per request* — stateless by design.

```ts
import "@hermes/shared"; // loads monorepo .env
import express from "express";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import { logger } from "@hermes/shared";
import { registerSlackTools } from "./tools.js";

function buildServer(): McpServer {
  const server = new McpServer({ name: "slack", version: "0.1.0" });
  registerSlackTools(server);
  return server;
}

const app = express();
app.use(express.json({ limit: "4mb" }));

// Stateless MCP: a fresh server + transport per POST. Matches the spec for
// scale-out deploys and sidesteps session management until we need it.
app.post("/mcp", async (req, res) => {
  const server = buildServer();
  const transport = new StreamableHTTPServerTransport({
    sessionIdGenerator: undefined,
  });
  res.on("close", () => {
    void transport.close();
    void server.close();
  });
  try {
    await server.connect(transport);
    await transport.handleRequest(req, res, req.body);
  } catch (e) {
    logger.error({ err: e }, "slack MCP request failed");
    if (!res.headersSent) res.status(500).end();
  }
});

// GET /mcp would be used for server-initiated SSE streams. We don't need
// that in stateless mode — explicitly reject.
app.get("/mcp", (_req, res) => {
  res.status(405).json({ error: "method not allowed in stateless mode" });
});

const port = Number(process.env.MCP_SLACK_PORT ?? 4100);
app.listen(port, "127.0.0.1", () => {
  const configured = !!process.env.SLACK_BOT_TOKEN;
  logger.info(
    { port, configured },
    configured
      ? "mcp-slack listening"
      : "mcp-slack listening (SLACK_BOT_TOKEN not set — tools will error)",
  );
});
```

**Annotations.**

- **L1:** Must be the first import. This triggers `load-env.ts` so `SLACK_BOT_TOKEN` is in `process.env` before `tools.ts` reads it.
- **L3–4:** The two MCP SDK imports. `mcp.js` exports the high-level `McpServer` class (which wraps `registerTool` / `registerResource` / `registerPrompt`). `streamableHttp.js` exports the HTTP transport.
- **L8–12 — `buildServer()`:** Constructs an `McpServer` with an identity (`name`/`version` — shown in the `initialize` handshake) and calls `registerSlackTools` to attach the four Slack tools. Called on every request — yes, per-request. The overhead is cheap (no I/O, just object allocation and tool-registration closures).
- **L14–15:** Standard Express setup with a 4 MB body limit.
- **L19–35 — the `POST /mcp` handler:**
  - `buildServer()` creates a fresh MCP server instance.
  - `new StreamableHTTPServerTransport({ sessionIdGenerator: undefined })` sets up the Streamable HTTP transport in **stateless** mode. When `sessionIdGenerator` is `undefined`, the server doesn't return an `Mcp-Session-Id` header on initialize, and it accepts every request as its own self-contained transaction. The alternative is stateful mode (`sessionIdGenerator: () => randomUUID()`), which is needed for long-lived SSE sessions with server-initiated messages — not something we need.
  - `res.on("close", ...)` registers a cleanup hook on the response. If the client disconnects (closes the tab, aborts the fetch), Express fires `close` on the response; we tear down the transport and server. This releases the SSE stream if one was open.
  - `server.connect(transport)` wires the server's request handlers to the transport and starts the transport listening. For Streamable HTTP, this is mostly a no-op (the transport's `start()` returns immediately — connections are managed per-request, not long-lived).
  - `transport.handleRequest(req, res, req.body)` is where the real work happens. The transport parses the incoming JSON-RPC message (from `req.body` — already parsed by `express.json()`), routes it to the appropriate handler on the server (e.g., `tools/list` → listing handler, `tools/call` → the specific tool's function), and writes the JSON-RPC response back to `res`. If the server chooses to upgrade to SSE (by calling transport-level stream operations), the response `Content-Type` flips to `text/event-stream`.
  - Errors are caught and logged. `!res.headersSent` guards against double-writes.
- **L39–41 — `GET /mcp`:** MCP's Streamable HTTP spec allows GET for server-initiated SSE streams (e.g., a long-running async tool that pushes progress events). We don't use that, so we reject with 405.
- **L43–52 — `listen`:** Binds on `127.0.0.1` (loopback only). DNS rebinding protection is a real concern for local MCP servers — malicious websites can use DNS rebinding to attack `localhost` services. Binding `127.0.0.1` explicitly means the socket only accepts connections from the loopback interface; external hosts can't reach it. The log message reports whether the service is "configured" (token present) so you can tell from boot logs whether tools will actually work.

---

### 3.8 `packages/mcp-servers/slack/src/tools.ts`

**Purpose.** Defines four read-only Slack tools. Each one: validates input via a Zod schema, calls a Slack Web API method via `@slack/web-api`, trims the response to the fields the LLM actually needs, and returns JSON-stringified text content.

```ts
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
}
```

**Top-level structure.**

- **`WebClient` singleton (L5–6).** Read the token once at module load, create the client once. If `SLACK_BOT_TOKEN` is missing, we leave `slack = null` — every tool will report a clear error instead of crashing the server.
- **`out(v)` / `err(msg)` (L8–24).** MCP's tool-result format is `{ content: Array<ContentBlock>, isError?: boolean }`. We only use `text` blocks (MCP also supports `image` and `resource` blocks — not needed here). `out` minifies the JSON to save tokens; `err` sets `isError: true` which the AI SDK surfaces as a tool output with `state: 'output-error'`.
- **`truncate(text)` (L14–20).** Slack messages can contain pasted resumes, whole docs, etc. 300 characters is enough to convey the gist; if the model needs more, it calls `get_thread` for the full context. This one change dropped token consumption by ~30% on typical chats.
- **`requireSlack()` (L26–29).** Guard: converts a missing-token state into a thrown error that's caught in each tool handler and converted to an MCP error result.
- **`SlackUserFields` + `serializeUser` (L31–55).** The Slack WebAPI's `User` type is huge (50+ fields). `serializeUser` picks 7 fields the model actually uses (id, handle, real_name, display_name, email, title, timezone) so tool results stay small.

**Tool 1 — `list_channels`.**

- **What it does.** Lists public + private channels the bot has access to.
- **Slack API.** `conversations.list` with `types: "public_channel,private_channel"` and `exclude_archived: !include_archived`. The inversion is because Slack's API takes "exclude archived" (boolean, default true) while our tool speaks in the positive sense.
- **Scope required.** `channels:read` (User Token Scope — user tokens access everything the user can see).
- **Output trimming.** Strip each channel to `{ id, name, is_private, is_archived, num_members, topic }`. Descriptions, membership lists, creator info, purpose, etc. are dropped.
- **Schema notes.** `include_archived` defaults to `false`, `limit` defaults to 100 with a hard cap of 1000.

**Tool 2 — `search_messages`.**

- **What it does.** Free-text search over Slack messages with Slack's full query operators (`from:`, `to:`, `with:`, `in:`, `on:`, `before:`, `after:`, `during:`).
- **Slack API.** `search.messages`. Returns `{ messages: { matches: [...], total } }`.
- **Scope required.** `search:read` — critically, **User Token only**. Bot tokens cannot call `search.messages`. This is why our Slack guide switched from `xoxb-` to `xoxp-` tokens.
- **Output trimming.** Each match becomes `{ ts, date (ISO derived from ts), user, username, channel, text (truncated), permalink }`. We drop blocks, attachments, files, reactions. The `date` field is added server-side because the model shouldn't have to convert the Unix epoch `ts` back to a date every time.
- **Description is huge** (15 lines) because the model's tool selection hinges on knowing the operator syntax. We pay a few hundred tokens per request but the model then picks correct operators instead of searching plain text.

**Tool 3 — `lookup_user`.**

- **What it does.** Takes a handle, email, or name fragment; returns a structured user object.
- **Slack APIs.** Two paths:
  - **Fast path (email).** If the needle contains `@`, try `users.lookupByEmail`. Requires `users:read.email`. If the scope is missing, this call errors and we fall through.
  - **Slow path (list + filter).** `users.list` with `limit: 1000` (Slack caps at 1000 per page). Client-side filter on `name`, `real_name`, `display_name`, `email`. Returns up to 10 hits.
- **Why this tool exists.** `search.messages` with `with:@trevor` is only reliable when Claude knows the exact handle. "Trevor" might be `@trevorking`, `@trevor.k`, etc. This tool converts the human name to an exact handle + ID.

**Tool 4 — `get_thread`.**

- **What it does.** Fetch all messages in a single thread.
- **Slack API.** `conversations.replies` with `channel` (ID, starts with `C...`), `ts` (parent message timestamp), `limit` (up to 200).
- **Scope required.** `channels:history` (plus `groups:history` for private channels).
- **Output trimming.** Each message becomes `{ ts, date, user, text (truncated), reply_count }`. We drop reactions, blocks, edits, files.

---

### 3.9 `packages/mcp-servers/github/src/index.ts`

Structurally identical to Slack's index. Only the name, port, env var, and tool registrar differ.

```ts
import "@hermes/shared"; // loads monorepo .env
import express from "express";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import { logger } from "@hermes/shared";
import { registerGitHubTools } from "./tools.js";

function buildServer(): McpServer {
  const server = new McpServer({ name: "github", version: "0.1.0" });
  registerGitHubTools(server);
  return server;
}

const app = express();
app.use(express.json({ limit: "4mb" }));

app.post("/mcp", async (req, res) => {
  const server = buildServer();
  const transport = new StreamableHTTPServerTransport({
    sessionIdGenerator: undefined,
  });
  res.on("close", () => {
    void transport.close();
    void server.close();
  });
  try {
    await server.connect(transport);
    await transport.handleRequest(req, res, req.body);
  } catch (e) {
    logger.error({ err: e }, "github MCP request failed");
    if (!res.headersSent) res.status(500).end();
  }
});

app.get("/mcp", (_req, res) => {
  res.status(405).json({ error: "method not allowed in stateless mode" });
});

const port = Number(process.env.MCP_GITHUB_PORT ?? 4101);
app.listen(port, "127.0.0.1", () => {
  const configured = !!process.env.GITHUB_TOKEN;
  logger.info(
    { port, configured },
    configured
      ? "mcp-github listening"
      : "mcp-github listening (GITHUB_TOKEN not set — tools will error)",
  );
});
```

Port 4101. Env var `GITHUB_TOKEN`. Otherwise the exact same pattern as Slack's index.

---

### 3.10 `packages/mcp-servers/github/src/tools.ts`

Seven tools — three discovery (`get_authenticated_user`, `list_my_repos`, `list_org_repos`) and four drill-down (`list_prs`, `get_pr_diff`, `list_issues`, `get_commits`). All powered by Octokit (GitHub's official REST client).

```ts
import { Octokit } from "@octokit/rest";
import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";

const token = process.env.GITHUB_TOKEN;
const octokit = token ? new Octokit({ auth: token }) : null;

const out = (v: unknown) => ({
  content: [{ type: "text" as const, text: JSON.stringify(v) }],
});
const err = (msg: string) => ({
  content: [{ type: "text" as const, text: `Error: ${msg}` }],
  isError: true,
});

function requireOctokit() {
  if (!octokit) throw new Error("GITHUB_TOKEN not set");
  return octokit;
}

const RepoRef = {
  owner: z.string().describe("GitHub org or user name."),
  repo: z.string().describe("Repository name."),
};

export function registerGitHubTools(server: McpServer) {
  server.registerTool(
    "get_authenticated_user",
    {
      description:
        "Returns who the GitHub token is acting as: login, name, email, and the orgs this user belongs to. Always call this first if the user says 'my' GitHub without naming an owner.",
      inputSchema: {},
    },
    async () => {
      try {
        const gh = requireOctokit();
        const [{ data: user }, { data: orgs }] = await Promise.all([
          gh.users.getAuthenticated(),
          gh.orgs.listForAuthenticatedUser({ per_page: 100 }),
        ]);
        return out({
          login: user.login,
          name: user.name,
          email: user.email,
          html_url: user.html_url,
          public_repos: user.public_repos,
          total_private_repos: user.total_private_repos,
          orgs: orgs.map((o) => o.login),
        });
      } catch (e) {
        return err(e instanceof Error ? e.message : String(e));
      }
    },
  );

  server.registerTool(
    "list_my_repos",
    {
      description:
        "List repos visible to the authenticated user (owned, collaborator, and org-member). Sort by 'pushed' to find the most recently active repos.",
      inputSchema: {
        sort: z
          .enum(["pushed", "updated", "created", "full_name"])
          .default("pushed")
          .describe("'pushed' = most-recently-committed first."),
        affiliation: z
          .string()
          .default("owner,collaborator,organization_member")
          .describe(
            "Comma-separated: 'owner', 'collaborator', 'organization_member'.",
          ),
        visibility: z.enum(["all", "public", "private"]).default("all"),
        per_page: z.number().int().min(1).max(100).default(30),
      },
    },
    async ({ sort, affiliation, visibility, per_page }) => {
      try {
        const gh = requireOctokit();
        const { data } = await gh.repos.listForAuthenticatedUser({
          sort,
          affiliation,
          visibility,
          per_page,
        });
        const repos = data.map((r) => ({
          full_name: r.full_name,
          private: r.private,
          pushed_at: r.pushed_at,
          updated_at: r.updated_at,
          language: r.language,
          stargazers_count: r.stargazers_count,
          open_issues_count: r.open_issues_count,
          url: r.html_url,
        }));
        return out({ repos, count: repos.length });
      } catch (e) {
        return err(e instanceof Error ? e.message : String(e));
      }
    },
  );

  server.registerTool(
    "list_org_repos",
    {
      description:
        "List repos in a GitHub org. Use this when the user names an org (e.g., 'repos in Veltrex1').",
      inputSchema: {
        org: z.string().describe("Organization login (e.g., 'Veltrex1')."),
        sort: z
          .enum(["pushed", "updated", "created", "full_name"])
          .default("pushed"),
        type: z
          .enum(["all", "public", "private", "sources", "forks", "member"])
          .default("all"),
        per_page: z.number().int().min(1).max(100).default(30),
      },
    },
    async ({ org, sort, type, per_page }) => {
      try {
        const gh = requireOctokit();
        const { data } = await gh.repos.listForOrg({
          org,
          sort,
          type,
          per_page,
        });
        const repos = data.map((r) => ({
          full_name: r.full_name,
          private: r.private,
          pushed_at: r.pushed_at,
          updated_at: r.updated_at,
          language: r.language,
          stargazers_count: r.stargazers_count,
          open_issues_count: r.open_issues_count,
          url: r.html_url,
        }));
        return out({ org, repos, count: repos.length });
      } catch (e) {
        return err(e instanceof Error ? e.message : String(e));
      }
    },
  );

  server.registerTool(
    "list_prs",
    {
      description: "List pull requests in a repository.",
      inputSchema: {
        ...RepoRef,
        state: z.enum(["open", "closed", "all"]).default("open"),
        per_page: z.number().int().min(1).max(100).default(30),
      },
    },
    async ({ owner, repo, state, per_page }) => {
      try {
        const gh = requireOctokit();
        const { data } = await gh.pulls.list({ owner, repo, state, per_page });
        const prs = data.map((p) => ({
          number: p.number,
          title: p.title,
          state: p.state,
          draft: p.draft,
          user: p.user?.login,
          created_at: p.created_at,
          updated_at: p.updated_at,
          head: p.head.ref,
          base: p.base.ref,
          url: p.html_url,
        }));
        return out({ owner, repo, prs, count: prs.length });
      } catch (e) {
        return err(e instanceof Error ? e.message : String(e));
      }
    },
  );

  server.registerTool(
    "get_pr_diff",
    {
      description:
        "Fetch the unified diff of a pull request. Large diffs may be truncated by the agent.",
      inputSchema: {
        ...RepoRef,
        pull_number: z.number().int().positive(),
      },
    },
    async ({ owner, repo, pull_number }) => {
      try {
        const gh = requireOctokit();
        const res = await gh.pulls.get({
          owner,
          repo,
          pull_number,
          mediaType: { format: "diff" },
        });
        // With `mediaType: { format: 'diff' }`, data is the raw diff string.
        const diff = res.data as unknown as string;
        return out({ owner, repo, pull_number, diff });
      } catch (e) {
        return err(e instanceof Error ? e.message : String(e));
      }
    },
  );

  server.registerTool(
    "list_issues",
    {
      description:
        "List issues in a repository. GitHub returns PRs here too — they include a `pull_request` field; this tool filters them out.",
      inputSchema: {
        ...RepoRef,
        state: z.enum(["open", "closed", "all"]).default("open"),
        labels: z
          .string()
          .optional()
          .describe("Comma-separated label names to filter by."),
        per_page: z.number().int().min(1).max(100).default(30),
      },
    },
    async ({ owner, repo, state, labels, per_page }) => {
      try {
        const gh = requireOctokit();
        const { data } = await gh.issues.listForRepo({
          owner,
          repo,
          state,
          labels,
          per_page,
        });
        const issues = data
          .filter((i) => !i.pull_request)
          .map((i) => ({
            number: i.number,
            title: i.title,
            state: i.state,
            user: i.user?.login,
            labels: i.labels.map((l) =>
              typeof l === "string" ? l : (l.name ?? ""),
            ),
            created_at: i.created_at,
            updated_at: i.updated_at,
            url: i.html_url,
          }));
        return out({ owner, repo, issues, count: issues.length });
      } catch (e) {
        return err(e instanceof Error ? e.message : String(e));
      }
    },
  );

  server.registerTool(
    "get_commits",
    {
      description: "List recent commits on a branch.",
      inputSchema: {
        ...RepoRef,
        sha: z
          .string()
          .optional()
          .describe("Branch name or commit SHA. Defaults to the default branch."),
        per_page: z.number().int().min(1).max(100).default(20),
      },
    },
    async ({ owner, repo, sha, per_page }) => {
      try {
        const gh = requireOctokit();
        const { data } = await gh.repos.listCommits({
          owner,
          repo,
          sha,
          per_page,
        });
        const commits = data.map((c) => ({
          sha: c.sha.slice(0, 8),
          author: c.commit.author?.name,
          email: c.commit.author?.email,
          date: c.commit.author?.date,
          message: c.commit.message.split("\n")[0], // subject line only
          url: c.html_url,
        }));
        return out({ owner, repo, commits, count: commits.length });
      } catch (e) {
        return err(e instanceof Error ? e.message : String(e));
      }
    },
  );
}
```

**Top-level structure.**

- **`Octokit` singleton (L5–6).** Created once with the token. Octokit adds retry logic, rate-limit handling, pagination helpers. Cheap to keep alive.
- **`RepoRef` (L21–24).** A reusable Zod schema shape — spread (`...RepoRef`) into every repo-scoped tool. Keeps the `owner` / `repo` descriptions consistent across tools.

**Tool-by-tool.**

**1 — `get_authenticated_user`.** Two API calls in parallel:
- `GET /user` → `users.getAuthenticated()` returns login, name, email, counts.
- `GET /user/orgs?per_page=100` → `orgs.listForAuthenticatedUser()` returns the orgs you belong to. Capped at 100 which is plenty.

Used as the bootstrap call when the user says "my repos" — Claude doesn't know your GitHub handle until it asks.

**2 — `list_my_repos`.** Calls `GET /user/repos` via `repos.listForAuthenticatedUser`. Returns repos across all your affiliations (owned, collaborator, org member). `sort: 'pushed'` sorts by most recent commit — exactly what "most active" means. Each repo is trimmed to `{ full_name, private, pushed_at, updated_at, language, stargazers_count, open_issues_count, url }` — drops license info, topics, fork flags, size, forks count, branches.

**3 — `list_org_repos`.** Calls `GET /orgs/{org}/repos` via `repos.listForOrg`. Works for public repos of any org; for private org repos, your token needs org-approved access. Same output trimming as `list_my_repos`.

**4 — `list_prs`.** Calls `GET /repos/{owner}/{repo}/pulls` via `pulls.list`. Trims each PR to `{ number, title, state, draft, user, created_at, updated_at, head, base, url }`. Drops reviewers, labels, body (too long), merge commits, CI status — the model can ask for those specifically via `get_pr_diff` if it needs more.

**5 — `get_pr_diff`.** The unusual one — uses Octokit's `mediaType: { format: 'diff' }` option, which tells GitHub to return the response as a unified diff string instead of the usual JSON object. The TypeScript types don't know about this format override, so we cast `res.data as unknown as string`. Diffs can be huge; we rely on the model's context limit + the system prompt nudging it to request diffs only when necessary.

**6 — `list_issues`.** Calls `GET /repos/{owner}/{repo}/issues` via `issues.listForRepo`. **GitHub quirk:** this endpoint returns both Issues and Pull Requests (PRs are technically a subtype of issue). We filter out PRs with `!i.pull_request` (PRs have a non-null `pull_request` field, issues have null). Each remaining issue is trimmed to `{ number, title, state, user, labels, created_at, updated_at, url }`. Labels can come as strings or objects depending on the API response shape; we normalize them to strings.

**7 — `get_commits`.** Calls `GET /repos/{owner}/{repo}/commits` via `repos.listCommits`. Each commit trimmed to `{ sha (8 chars only — short hash), author, email, date, message (first line only), url }`. The commit message's first line is the "subject" — dropping the body keeps output compact; model can ask for full message if it needs it.

---

### 3.11 `packages/mcp-servers/linear/src/index.ts`

Port 4102. Env var `LINEAR_API_KEY`. Same shape as Slack/GitHub.

```ts
import "@hermes/shared"; // loads monorepo .env
import express from "express";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import { logger } from "@hermes/shared";
import { registerLinearTools } from "./tools.js";

function buildServer(): McpServer {
  const server = new McpServer({ name: "linear", version: "0.1.0" });
  registerLinearTools(server);
  return server;
}

const app = express();
app.use(express.json({ limit: "4mb" }));

app.post("/mcp", async (req, res) => {
  const server = buildServer();
  const transport = new StreamableHTTPServerTransport({
    sessionIdGenerator: undefined,
  });
  res.on("close", () => {
    void transport.close();
    void server.close();
  });
  try {
    await server.connect(transport);
    await transport.handleRequest(req, res, req.body);
  } catch (e) {
    logger.error({ err: e }, "linear MCP request failed");
    if (!res.headersSent) res.status(500).end();
  }
});

app.get("/mcp", (_req, res) => {
  res.status(405).json({ error: "method not allowed in stateless mode" });
});

const port = Number(process.env.MCP_LINEAR_PORT ?? 4102);
app.listen(port, "127.0.0.1", () => {
  const configured = !!process.env.LINEAR_API_KEY;
  logger.info(
    { port, configured },
    configured
      ? "mcp-linear listening"
      : "mcp-linear listening (LINEAR_API_KEY not set — tools will error)",
  );
});
```

---

### 3.12 `packages/mcp-servers/linear/src/tools.ts`

Four tools using Linear's official SDK (`@linear/sdk`), which is a thin async wrapper over Linear's GraphQL API. The SDK uses a lot of lazy-fetched promises — fields like `.state` and `.assignee` on an Issue are promises that resolve to related entities. You `await` them on demand.

```ts
import { LinearClient } from "@linear/sdk";
import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";

const apiKey = process.env.LINEAR_API_KEY;
const linear = apiKey ? new LinearClient({ apiKey }) : null;

const out = (v: unknown) => ({
  content: [{ type: "text" as const, text: JSON.stringify(v) }],
});
const err = (msg: string) => ({
  content: [{ type: "text" as const, text: `Error: ${msg}` }],
  isError: true,
});

function requireLinear() {
  if (!linear) throw new Error("LINEAR_API_KEY not set");
  return linear;
}

export function registerLinearTools(server: McpServer) {
  server.registerTool(
    "list_projects",
    {
      description: "List Linear projects across the workspace.",
      inputSchema: {
        first: z.number().int().min(1).max(100).default(50),
        include_archived: z.boolean().default(false),
      },
    },
    async ({ first, include_archived }) => {
      try {
        const lin = requireLinear();
        const projects = await lin.projects({
          first,
          includeArchived: include_archived,
        });
        const nodes = await Promise.all(
          projects.nodes.map(async (p) => ({
            id: p.id,
            name: p.name,
            state: p.state,
            progress: p.progress,
            target_date: p.targetDate,
            url: p.url,
          })),
        );
        return out({ projects: nodes, count: nodes.length });
      } catch (e) {
        return err(e instanceof Error ? e.message : String(e));
      }
    },
  );

  server.registerTool(
    "list_issues",
    {
      description:
        "List Linear issues, optionally filtered by team key (e.g., 'ENG'), assignee email, or state name.",
      inputSchema: {
        team: z.string().optional().describe("Team key, e.g., 'ENG'."),
        assignee_email: z.string().email().optional(),
        state: z
          .string()
          .optional()
          .describe("Workflow state name, e.g., 'In Progress'."),
        first: z.number().int().min(1).max(100).default(50),
      },
    },
    async ({ team, assignee_email, state, first }) => {
      try {
        const lin = requireLinear();
        // Compose filter conservatively — Linear rejects empty {} on some fields.
        const filter: Record<string, unknown> = {};
        if (team) filter.team = { key: { eq: team } };
        if (assignee_email)
          filter.assignee = { email: { eq: assignee_email } };
        if (state) filter.state = { name: { eq: state } };

        const issues = await lin.issues({
          first,
          filter: Object.keys(filter).length ? filter : undefined,
        });
        const nodes = await Promise.all(
          issues.nodes.map(async (i) => {
            const [state_, assignee] = await Promise.all([
              i.state,
              i.assignee,
            ]);
            return {
              id: i.id,
              identifier: i.identifier,
              title: i.title,
              priority: i.priority,
              state: state_?.name,
              assignee: assignee?.name,
              created_at: i.createdAt,
              url: i.url,
            };
          }),
        );
        return out({ issues: nodes, count: nodes.length });
      } catch (e) {
        return err(e instanceof Error ? e.message : String(e));
      }
    },
  );

  server.registerTool(
    "get_issue",
    {
      description:
        "Fetch one Linear issue with description and comments, by its identifier (e.g., 'ENG-123').",
      inputSchema: {
        identifier: z.string().describe("Issue identifier like 'ENG-123'."),
      },
    },
    async ({ identifier }) => {
      try {
        const lin = requireLinear();
        // SDK's `issue(id)` takes either a UUID or the identifier.
        const issue = await lin.issue(identifier);
        const [state, assignee, comments] = await Promise.all([
          issue.state,
          issue.assignee,
          issue.comments({ first: 50 }),
        ]);
        return out({
          id: issue.id,
          identifier: issue.identifier,
          title: issue.title,
          description: issue.description,
          priority: issue.priority,
          state: state?.name,
          assignee: assignee?.name,
          created_at: issue.createdAt,
          updated_at: issue.updatedAt,
          url: issue.url,
          comments: comments.nodes.map((c) => ({
            created_at: c.createdAt,
            body: c.body,
          })),
        });
      } catch (e) {
        return err(e instanceof Error ? e.message : String(e));
      }
    },
  );

  server.registerTool(
    "search_issues",
    {
      description:
        "Full-text search across Linear issues by title/description. Returns top matches.",
      inputSchema: {
        query: z.string().min(1),
        first: z.number().int().min(1).max(50).default(20),
      },
    },
    async ({ query, first }) => {
      try {
        const lin = requireLinear();
        const res = await lin.searchIssues(query, { first });
        const nodes = await Promise.all(
          res.nodes.map(async (i) => {
            const state = await i.state;
            return {
              identifier: i.identifier,
              title: i.title,
              state: state?.name,
              url: i.url,
            };
          }),
        );
        return out({ query, matches: nodes, count: nodes.length });
      } catch (e) {
        return err(e instanceof Error ? e.message : String(e));
      }
    },
  );
}
```

**Linear SDK quirks worth knowing.**

- **Pagination.** Every list method in Linear uses GraphQL Relay-style cursors with `first` (count) and `after` (cursor). Our tools only use `first` — no pagination UX yet.
- **Lazy related fields.** `issue.state` is a **Promise** that resolves to the issue's workflow state when awaited. Similarly `issue.assignee`, `issue.team`, etc. This is because Linear's SDK uses a DataLoader pattern internally — awaiting a related field triggers a batched fetch. In `list_issues`, we `Promise.all([i.state, i.assignee])` per issue to parallelize these fetches. For a list of 50 issues this means 100 batched fetches which Linear's DataLoader will collapse into 2 queries (one for states, one for assignees).
- **Filter shape.** Linear's filter input is strict GraphQL: `{ key: { eq: "ENG" } }` not `{ key: "ENG" }`. Empty objects `{}` or nulls on specific filter keys cause validation errors — so we build the filter conditionally and only pass it if non-empty.

**Tool-by-tool.**

**1 — `list_projects`.** Calls `linear.projects({ first, includeArchived })`. Returns up to 100 projects with `{ id, name, state, progress, target_date, url }`.

**2 — `list_issues`.** Composes a filter from optional `team` / `assignee_email` / `state` and calls `linear.issues({ first, filter })`. For each issue, resolves `state` and `assignee` lazy fields. Returns `{ id, identifier (e.g., "ENG-123"), title, priority (0-4), state, assignee, created_at, url }`.

**3 — `get_issue`.** Calls `linear.issue(identifier)` which accepts either the UUID or the human identifier ("ENG-123"). Resolves `state`, `assignee`, and `comments({ first: 50 })` in parallel. Returns the full issue body plus up to 50 comments (each with `{ created_at, body }`).

**4 — `search_issues`.** Calls `linear.searchIssues(query, { first })`. This is Linear's full-text search over titles + descriptions (not comments). Returns compact `{ identifier, title, state, url }` per match.

---

## 4. Per-tool quick reference

Every tool exposed to Claude, the external API it ultimately calls, and the authentication it needs.

### Slack (prefix: `slack_`)

| Tool name                   | External API                                  | Scope required                     |
|----------------------------|-----------------------------------------------|------------------------------------|
| `slack_list_channels`      | `conversations.list` (Web API)                | `channels:read`, `groups:read`     |
| `slack_search_messages`    | `search.messages` (Web API)                   | `search:read` (**user token only**) |
| `slack_lookup_user`        | `users.lookupByEmail` + `users.list`          | `users:read`, `users:read.email`   |
| `slack_get_thread`         | `conversations.replies` (Web API)             | `channels:history`, `groups:history` |

**Token.** Slack User OAuth token (`xoxp-...`). Bot tokens can't use `search.messages`.

### GitHub (prefix: `github_`)

| Tool name                      | External API                                                   | Permission              |
|-------------------------------|----------------------------------------------------------------|-------------------------|
| `github_get_authenticated_user` | `GET /user` + `GET /user/orgs`                                | token's user            |
| `github_list_my_repos`        | `GET /user/repos`                                              | `repo` or repo-scope    |
| `github_list_org_repos`       | `GET /orgs/{org}/repos`                                        | org must approve token  |
| `github_list_prs`             | `GET /repos/{owner}/{repo}/pulls`                              | read:pulls              |
| `github_get_pr_diff`          | `GET /repos/{owner}/{repo}/pulls/{n}` (Accept: `vnd.github.diff`) | read:pulls           |
| `github_list_issues`          | `GET /repos/{owner}/{repo}/issues`                             | read:issues             |
| `github_get_commits`          | `GET /repos/{owner}/{repo}/commits`                            | read:contents           |

**Token.** GitHub classic PAT with `repo` + `read:org`, or fine-grained PAT with matching resource permissions. Classic PAT is easier when crossing personal + org repos.

### Linear (prefix: `linear_`)

| Tool name                | SDK method                                 | External endpoint            |
|-------------------------|--------------------------------------------|------------------------------|
| `linear_list_projects`  | `linear.projects({ first, includeArchived })` | GraphQL `projects` query    |
| `linear_list_issues`    | `linear.issues({ first, filter })`         | GraphQL `issues` query       |
| `linear_get_issue`      | `linear.issue(identifier)` + related fields| GraphQL `issue` query        |
| `linear_search_issues`  | `linear.searchIssues(query, { first })`    | GraphQL `issueSearch` query  |

**Token.** Linear personal API key (`lin_api_...`). Inherits your user permissions.

---

## 5. Streaming internals — what actually travels on the wire

For a query like "list my most active github repos", here's the data flowing at each hop.

### 5.1 Browser → Next.js `/api/chat`

HTTP POST. Request body (abbreviated):

```json
{
  "id": "chat-abc123",
  "messages": [
    {
      "id": "m-1",
      "role": "user",
      "parts": [{ "type": "text", "text": "list my most active github repos" }]
    }
  ],
  "trigger": "submit-message"
}
```

Response body: a Web-standard `ReadableStream<Uint8Array>` of UIMessage chunks (newline-delimited JSON, content-type `x-vercel-ai-ui-message-stream-v1`).

### 5.2 Next.js → agent-runtime `/api/chat`

Same body as above, same response stream. Next.js's route is literally a pipe:

```ts
const upstream = await fetch(`${AGENT_RUNTIME_URL}/api/chat`, {
  method: "POST", body: await req.text(), headers: {...}, duplex: "half",
});
return new Response(upstream.body, { status: upstream.status, headers: upstream.headers });
```

### 5.3 agent-runtime → MCP server (e.g., GitHub)

Three JSON-RPC messages, each an HTTP POST with `content-type: application/json` and `accept: application/json, text/event-stream`:

**(a) initialize**
```json
{
  "jsonrpc": "2.0",
  "id": 1,
  "method": "initialize",
  "params": {
    "protocolVersion": "2025-06-18",
    "capabilities": { "tools": {} },
    "clientInfo": { "name": "@ai-sdk/mcp", "version": "1.0.36" }
  }
}
```
Server replies with `{ jsonrpc: "2.0", id: 1, result: { capabilities: { tools: { listChanged: true } }, serverInfo: { name: "github", version: "0.1.0" } } }`.

**(b) tools/list**
```json
{ "jsonrpc": "2.0", "id": 2, "method": "tools/list", "params": {} }
```
Server replies with an array of 7 tool descriptors. Each has `name`, `description`, and an `inputSchema` (JSON Schema derived from the Zod schema).

**(c) tools/call** (only when the model actually invokes one)
```json
{
  "jsonrpc": "2.0",
  "id": 3,
  "method": "tools/call",
  "params": {
    "name": "list_my_repos",
    "arguments": { "sort": "pushed" }
  }
}
```
Server handler runs, calls Octokit, serializes the result, and replies:
```json
{
  "jsonrpc": "2.0",
  "id": 3,
  "result": {
    "content": [
      {
        "type": "text",
        "text": "{\"repos\":[{\"full_name\":\"ManikanthMartha/hermes-ai\",\"pushed_at\":\"2026-04-19T07:37:49Z\",...}],\"count\":30}"
      }
    ]
  }
}
```

### 5.4 agent-runtime → Anthropic `/v1/messages`

The SDK constructs a streaming-enabled request with:

```json
{
  "model": "claude-haiku-4-5",
  "system": "You are Hermes, an AI assistant... Current date: 2026-04-19 (Saturday, server time UTC+5:30). ...",
  "messages": [
    { "role": "user", "content": "list my most active github repos" }
  ],
  "tools": [
    { "name": "github_get_authenticated_user", "description": "...", "input_schema": {...} },
    { "name": "github_list_my_repos", "description": "...", "input_schema": {...} },
    ...
  ],
  "tool_choice": { "type": "auto" },
  "stream": true
}
```

Response is an SSE stream of `content_block_delta` events (token-by-token text) and `tool_use` blocks. When a tool_use arrives, the AI SDK pauses, invokes the tool, constructs a follow-up request with the tool result appended, and streams the next turn. This repeats until either no tool_use is emitted (final text) or `stopWhen` fires.

### 5.5 agent-runtime → Next.js → browser

The UIMessage chunks returned from `result.toUIMessageStreamResponse()` look like:

```
data: {"type":"start","messageId":"msg-abc"}\n\n
data: {"type":"tool-input-start","toolCallId":"call-1","toolName":"github_list_my_repos"}\n\n
data: {"type":"tool-input-delta","toolCallId":"call-1","inputTextDelta":"{\"sort\":\"pushed\"}"}\n\n
data: {"type":"tool-input-available","toolCallId":"call-1","toolName":"github_list_my_repos","input":{"sort":"pushed"}}\n\n
data: {"type":"tool-output-available","toolCallId":"call-1","output":"{\"repos\":[...],\"count\":30}"}\n\n
data: {"type":"text-start","id":"text-1"}\n\n
data: {"type":"text-delta","id":"text-1","delta":"Your "}\n\n
data: {"type":"text-delta","id":"text-1","delta":"most "}\n\n
data: {"type":"text-delta","id":"text-1","delta":"active "}\n\n
...
data: {"type":"text-end","id":"text-1"}\n\n
data: {"type":"finish"}\n\n
```

Each chunk is one SSE event. The `useChat` hook on the browser decodes these and updates the React state.

---

## 6. Glossary

- **MCP (Model Context Protocol).** Anthropic-authored JSON-RPC 2.0 protocol for exposing tools/resources/prompts to LLM agents. [Spec](https://modelcontextprotocol.io).
- **Streamable HTTP.** The preferred MCP transport for networked servers. A single HTTP endpoint handles POST (for requests) and optionally GET (for server-initiated SSE). Replaced the older HTTP+SSE transport in mid-2025.
- **Stateless mode.** Server doesn't track sessions; each request is self-contained. Set via `sessionIdGenerator: undefined` on the server transport. Simpler; works for read-only tool servers.
- **UIMessage.** The AI SDK's rich message format used on the wire between the server and `useChat`. Has `parts` like `text`, `tool-<name>`, `reasoning`, `file`, etc. Each tool part has a lifecycle: `input-streaming → input-available → output-available` (or `output-error`).
- **ToolSet.** `Record<string, Tool>` — the map passed to `streamText`. Each `Tool` has `description`, `inputSchema` (Zod), and `execute` (handler). For MCP tools, `execute` is auto-generated by `@ai-sdk/mcp` to dispatch a `tools/call` request over HTTP.
- **stopWhen.** A predicate on the tool-loop step count (or arbitrary condition). `stepCountIs(10)` = run at most 10 LLM turns inside one `streamText` call.
- **Tool loop / agent loop.** The pattern where an LLM alternates between producing tool calls and receiving tool results, driven automatically by the SDK, until the model emits final text.
- **`duplex: "half"`.** Undici/Node fetch option required when the request body is a stream. Most POSTs are buffered so this doesn't matter, but Next.js route handlers pass it through when proxying streaming bodies.
- **Octokit.** GitHub's official TypeScript REST client. Wraps fetch with auth, retries, rate-limit handling, and typed method signatures for every REST endpoint.
- **`@slack/web-api` WebClient.** Slack's official Web API client. Provides typed methods like `conversations.list`, `search.messages`, `users.lookupByEmail`.
- **`@linear/sdk` LinearClient.** Linear's GraphQL-wrapping client with lazy-loaded related fields (promises you await on demand).
