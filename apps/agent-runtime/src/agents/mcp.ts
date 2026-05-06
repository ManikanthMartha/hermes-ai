import { MultiServerMCPClient } from "@langchain/mcp-adapters";
import type { StructuredToolInterface } from "@langchain/core/tools";
import { logger } from "@hermes/shared";

/**
 * One long-lived MCP client process-wide. Opens connections lazily on the
 * first `getSpecialistTools()` call; reuses the same tool handles across chat
 * turns so we don't pay the initialize handshake on every request.
 *
 * The `useStandardContentBlocks: true` flag is important — it tells the
 * adapter to return LangChain message-content blocks (compatible with
 * ChatAnthropic.bindTools) rather than legacy string outputs.
 */

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
    // Without this, getTools() returns unprefixed names and every specialist
    // ends up with 0 tools — the LLM then hallucinates tool calls as text.
    prefixToolNameWithServerName: true,
    mcpServers: {
      slack: {
        url: process.env.MCP_SLACK_URL ?? "http://127.0.0.1:4100/mcp",
        reconnect: { enabled: true, maxAttempts: 5, delayMs: 2000 },
      },
      github: {
        url: process.env.MCP_GITHUB_URL ?? "http://127.0.0.1:4101/mcp",
        reconnect: { enabled: true, maxAttempts: 5, delayMs: 2000 },
      },
      linear: {
        url: process.env.MCP_LINEAR_URL ?? "http://127.0.0.1:4102/mcp",
        reconnect: { enabled: true, maxAttempts: 5, delayMs: 2000 },
      },
      sentry: {
        url: process.env.MCP_SENTRY_URL ?? "http://127.0.0.1:4103/mcp",
        reconnect: { enabled: true, maxAttempts: 5, delayMs: 2000 },
      },
      gmail: {
        url: process.env.MCP_GMAIL_URL ?? "http://127.0.0.1:4104/mcp",
        reconnect: { enabled: true, maxAttempts: 5, delayMs: 2000 },
      },
    },
  });
  return _client;
}

/** Load every MCP tool once and index by `{service}__{tool_name}`. */
async function loadAllTools(): Promise<Map<string, StructuredToolInterface>> {
  if (_toolsCache) return _toolsCache;
  const tools = await getClient().getTools();
  _toolsCache = new Map();
  for (const t of tools) {
    _toolsCache.set(t.name, t);
  }
  // One-time dump so we can see whether MCP tools actually loaded and what
  // the adapter's name-prefix convention looks like. If this logs 0 tools —
  // or names that don't match `${server}__${tool}` — specialists will see
  // empty bindings and the LLM will hallucinate tool calls as free text.
  logger.info(
    {
      total: tools.length,
      names: tools.map((t) => t.name),
    },
    "MCP tools loaded",
  );
  return _toolsCache;
}

/**
 * Return the subset of tools a given specialist is allowed to use.
 * MultiServerMCPClient prefixes names with the server key + `__`
 * (e.g., `slack__post_message`), so we filter by prefix.
 */
export async function getToolsForSpecialist(
  servers: readonly string[],
): Promise<StructuredToolInterface[]> {
  const all = await loadAllTools();
  const result: StructuredToolInterface[] = [];
  for (const [name, tool] of all) {
    // Try both `server__tool` (adapter's default) and bare `tool` (fallback)
    // so we're not silently filtering everything out if the prefix format
    // differs from what we expect.
    if (
      servers.some(
        (s) => name.startsWith(`${s}__`) || name.startsWith(`${s}-`),
      )
    ) {
      result.push(tool);
    }
  }
  logger.info(
    { servers, count: result.length, names: result.map((t) => t.name) },
    "specialist tool subset",
  );
  return result;
}

/** Graceful shutdown on process exit / test teardown. */
export async function closeMCPClient(): Promise<void> {
  if (!_client) return;
  try {
    await _client.close();
  } finally {
    _client = null;
    _toolsCache = null;
  }
}

/**
 * Names of the tools considered "writes" — every one of these is gated
 * behind an `interrupt()` approval in `approval.ts`.
 *
 * Keep this list in sync with the [WRITE] marker in each MCP's tools.ts.
 */
export const WRITE_TOOLS: ReadonlySet<string> = new Set([
  "slack__post_message",
  "slack__reply_to_thread",
  "linear__create_issue",
  "linear__update_status",
  "gmail__send_message",
]);
