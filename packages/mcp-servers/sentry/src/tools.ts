import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";

// Sentry has its own Node instrumentation SDK (@sentry/core), but that's for
// *reporting* errors FROM your app to Sentry — not for querying them. For
// querying we just call Sentry's REST API directly with fetch + Auth Token.
// https://docs.sentry.io/api/

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

/**
 * Sentry's `/issues/?project=...` query parameter takes a NUMERIC project ID,
 * not a slug — but humans know projects by slug (the URL-friendly name).
 * Resolve slug → id on first use, cache for the process lifetime.
 *
 * If a slug doesn't resolve (e.g., the user typed a project that doesn't
 * exist in this org), we return null and the caller falls back to Sentry's
 * `project:slug` search-query operator, which works on name/slug matching.
 */
let projectIdCache: Record<string, string> | null = null;
async function resolveProjectId(
  slug: string,
  auth: string,
  org: string,
): Promise<string | null> {
  if (!projectIdCache) {
    const projects = await sentryFetch<Array<{ id: string; slug: string }>>(
      `/organizations/${org}/projects/`,
      auth,
    );
    projectIdCache = {};
    for (const p of projects) projectIdCache[p.slug] = p.id;
  }
  return projectIdCache[slug] ?? null;
}

export function registerSentryTools(server: McpServer) {
  server.registerTool(
    "list_issues",
    {
      description:
        "List Sentry issues for the configured org. Use `query` to scope by status/env/search (e.g., 'is:unresolved environment:production'). Defaults to unresolved.",
      inputSchema: {
        query: z
          .string()
          .default("is:unresolved")
          .describe(
            "Sentry search syntax. Examples: 'is:unresolved', 'is:regressed environment:prod', 'error.type:TypeError'.",
          ),
        project: z
          .string()
          .optional()
          .describe(
            "Project slug (e.g., 'react-native', 'hageman-dd'). The tool resolves the slug to a numeric project id automatically. Defaults to SENTRY_PROJECT env var if omitted.",
          ),
        limit: z.number().int().min(1).max(100).default(25),
      },
    },
    async ({ query, project, limit }) => {
      try {
        const { auth, org, project: defaultProject } = requireSentry();
        const proj = project ?? defaultProject;
        let finalQuery = query;
        const params = new URLSearchParams({ limit: String(limit) });

        if (proj) {
          // Sentry's `?project=` wants a numeric ID, not a slug. Resolve.
          const id = await resolveProjectId(proj, auth, org);
          if (id) {
            params.set("project", id);
          } else {
            // Slug didn't resolve — fall back to search-query operator.
            // `project:xyz` in a Sentry query matches projects by slug/name.
            finalQuery = `${finalQuery} project:${proj}`.trim();
          }
        }
        params.set("query", finalQuery);

        const data = await sentryFetch<
          Array<{
            id: string;
            shortId: string;
            title: string;
            culprit?: string;
            level: string;
            status: string;
            count: string;
            userCount: number;
            firstSeen: string;
            lastSeen: string;
            permalink: string;
            metadata?: { type?: string; value?: string };
          }>
        >(`/organizations/${org}/issues/?${params}`, auth);
        const issues = data.map((i) => ({
          id: i.id,
          short_id: i.shortId,
          title: i.title,
          culprit: i.culprit,
          level: i.level,
          status: i.status,
          event_count: Number(i.count),
          user_count: i.userCount,
          first_seen: i.firstSeen,
          last_seen: i.lastSeen,
          type: i.metadata?.type,
          url: i.permalink,
        }));
        return out({ query, issues, count: issues.length });
      } catch (e) {
        return err(e instanceof Error ? e.message : String(e));
      }
    },
  );

  server.registerTool(
    "get_issue_events",
    {
      description:
        "Fetch the most recent events for a Sentry issue. Use the `id` from list_issues. Events are concrete occurrences; the issue is the group.",
      inputSchema: {
        issue_id: z.string().describe("Issue id (e.g., '4567890')."),
        limit: z.number().int().min(1).max(50).default(10),
      },
    },
    async ({ issue_id, limit }) => {
      try {
        const { auth } = requireSentry();
        const data = await sentryFetch<
          Array<{
            id: string;
            eventID: string;
            message?: string;
            dateCreated: string;
            platform: string;
            tags?: Array<{ key: string; value: string }>;
            user?: { id?: string; email?: string; ip_address?: string };
          }>
        >(`/issues/${issue_id}/events/?limit=${limit}`, auth);
        const events = data.map((e) => ({
          id: e.id,
          event_id: e.eventID,
          message: e.message,
          date: e.dateCreated,
          platform: e.platform,
          tags: e.tags?.slice(0, 8), // cap tag noise
          user_email: e.user?.email,
        }));
        return out({ issue_id, events, count: events.length });
      } catch (e) {
        return err(e instanceof Error ? e.message : String(e));
      }
    },
  );

  server.registerTool(
    "get_error_stacktrace",
    {
      description:
        "Fetch a specific event with its full stacktrace. Use the `event_id` from get_issue_events (NOT the numeric id).",
      inputSchema: {
        event_id: z
          .string()
          .describe(
            "32-char event ID (the `event_id` field, not the short numeric id).",
          ),
        project: z
          .string()
          .optional()
          .describe("Project slug. Defaults to SENTRY_PROJECT env var."),
      },
    },
    async ({ event_id, project }) => {
      try {
        const { auth, org, project: defaultProject } = requireSentry();
        const proj = project ?? defaultProject;
        if (!proj) throw new Error("project not provided and SENTRY_PROJECT not set");
        const data = await sentryFetch<{
          eventID: string;
          dateCreated: string;
          platform: string;
          title: string;
          message?: string;
          entries: Array<{
            type: string;
            data: unknown;
          }>;
          tags?: Array<{ key: string; value: string }>;
        }>(`/projects/${org}/${proj}/events/${event_id}/`, auth);

        // Extract the stacktrace entry — Sentry's response puts it under
        // `entries` as type "exception" or "stacktrace".
        type Frame = {
          filename?: string;
          function?: string;
          lineNo?: number;
          colNo?: number;
          inApp?: boolean;
          context?: Array<[number, string]>;
        };
        type Exception = {
          type: string;
          value: string;
          stacktrace?: { frames?: Frame[] };
        };

        const stacktraces: Array<{
          type: string;
          message: string;
          frames: Frame[];
        }> = [];
        for (const entry of data.entries ?? []) {
          if (entry.type === "exception") {
            const values = (entry.data as { values?: Exception[] }).values ?? [];
            for (const v of values) {
              stacktraces.push({
                type: v.type,
                message: v.value,
                frames:
                  v.stacktrace?.frames?.slice(-15).map((f) => ({
                    filename: f.filename,
                    function: f.function,
                    lineNo: f.lineNo,
                    inApp: f.inApp,
                  })) ?? [],
              });
            }
          }
        }

        return out({
          event_id: data.eventID,
          date: data.dateCreated,
          title: data.title,
          message: data.message,
          platform: data.platform,
          stacktraces,
          tags: data.tags?.slice(0, 8),
        });
      } catch (e) {
        return err(e instanceof Error ? e.message : String(e));
      }
    },
  );
}
