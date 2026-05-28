import { LinearClient } from "@linear/sdk";
import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";

export type LinearCredential = {
  accessToken?: string;
};

export type LinearToolOptions = {
  getCredential: () => Promise<LinearCredential>;
};

const out = (v: unknown) => ({
  content: [{ type: "text" as const, text: JSON.stringify(v) }],
});
const err = (msg: string) => ({
  content: [{ type: "text" as const, text: `Error: ${msg}` }],
  isError: true,
});

async function requireLinear(options: LinearToolOptions) {
  const credential = await options.getCredential();
  if (!credential.accessToken) {
    throw new Error("Linear is connected but did not return a usable access token");
  }
  return new LinearClient({ accessToken: credential.accessToken });
}

export function registerLinearTools(server: McpServer, options: LinearToolOptions) {
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
        const lin = await requireLinear(options);
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
        const lin = await requireLinear(options);
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
        const lin = await requireLinear(options);
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
        const lin = await requireLinear(options);
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

  // ────────── WRITE TOOLS ──────────
  // HIL-gated by the specialist via `withApproval`.

  server.registerTool(
    "create_issue",
    {
      description:
        "[WRITE] Create a new Linear issue. Specify team by key (e.g., 'ENG'). Requires user approval.",
      inputSchema: {
        team: z.string().describe("Team key, e.g., 'ENG'."),
        title: z.string().min(1).describe("Issue title."),
        description: z
          .string()
          .optional()
          .describe("Markdown description of the issue."),
        assignee_email: z
          .string()
          .email()
          .optional()
          .describe("Assign to this user by email."),
        priority: z
          .number()
          .int()
          .min(0)
          .max(4)
          .optional()
          .describe(
            "0 = No priority, 1 = Urgent, 2 = High, 3 = Medium, 4 = Low.",
          ),
      },
    },
    async ({ team, title, description, assignee_email, priority }) => {
      try {
        const lin = await requireLinear(options);
        // Resolve team by key → id
        const teams = await lin.teams({ filter: { key: { eq: team } } });
        const teamNode = teams.nodes[0];
        if (!teamNode) throw new Error(`Team '${team}' not found`);

        // Optional assignee resolution
        let assigneeId: string | undefined;
        if (assignee_email) {
          const users = await lin.users({
            filter: { email: { eq: assignee_email } },
          });
          assigneeId = users.nodes[0]?.id;
          if (!assigneeId)
            throw new Error(`Assignee '${assignee_email}' not found`);
        }

        const payload = await lin.createIssue({
          teamId: teamNode.id,
          title,
          description,
          assigneeId,
          priority,
        });
        const issue = payload.issue ? await payload.issue : undefined;
        if (!issue) throw new Error("Linear returned no issue from createIssue");
        return out({
          success: payload.success,
          id: issue.id,
          identifier: issue.identifier,
          title: issue.title,
          url: issue.url,
        });
      } catch (e) {
        return err(e instanceof Error ? e.message : String(e));
      }
    },
  );

  server.registerTool(
    "update_status",
    {
      description:
        "[WRITE] Move a Linear issue to a different workflow state (e.g., 'In Progress' → 'Done'). Requires user approval.",
      inputSchema: {
        identifier: z
          .string()
          .describe("Issue identifier like 'ENG-123'."),
        state_name: z
          .string()
          .describe(
            "Target workflow state name (e.g., 'In Progress', 'Done', 'Cancelled'). Must match a state in the issue's team.",
          ),
      },
    },
    async ({ identifier, state_name }) => {
      try {
        const lin = await requireLinear(options);
        const issue = await lin.issue(identifier);
        const team = await issue.team;
        if (!team) throw new Error(`Issue ${identifier} has no team`);

        // Fetch team's workflow states and match by name (case-insensitive).
        const states = await team.states();
        const target = states.nodes.find(
          (s) => s.name.toLowerCase() === state_name.toLowerCase(),
        );
        if (!target)
          throw new Error(
            `State '${state_name}' not found for team ${team.key}. Available: ${states.nodes.map((s) => s.name).join(", ")}`,
          );

        const payload = await lin.updateIssue(issue.id, { stateId: target.id });
        return out({
          success: payload.success,
          identifier: issue.identifier,
          new_state: target.name,
          url: issue.url,
        });
      } catch (e) {
        return err(e instanceof Error ? e.message : String(e));
      }
    },
  );
}
