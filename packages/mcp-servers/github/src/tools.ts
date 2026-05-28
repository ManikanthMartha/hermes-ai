import { Octokit } from "@octokit/rest";
import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";

export type GitHubCredential = {
  accessToken?: string;
};

export type GitHubToolOptions = {
  getCredential: () => Promise<GitHubCredential>;
};

const out = (v: unknown) => ({
  content: [{ type: "text" as const, text: JSON.stringify(v) }],
});
const err = (msg: string) => ({
  content: [{ type: "text" as const, text: `Error: ${msg}` }],
  isError: true,
});

async function requireOctokit(options: GitHubToolOptions) {
  const credential = await options.getCredential();
  if (!credential.accessToken) {
    throw new Error("GitHub is connected but did not return a usable access token");
  }
  return new Octokit({ auth: credential.accessToken });
}

const RepoRef = {
  owner: z.string().describe("GitHub org or user name."),
  repo: z.string().describe("Repository name."),
};

export function registerGitHubTools(
  server: McpServer,
  options: GitHubToolOptions,
) {
  server.registerTool(
    "get_authenticated_user",
    {
      description:
        "Returns who the GitHub token is acting as: login, name, email, and the orgs this user belongs to. Always call this first if the user says 'my' GitHub without naming an owner.",
      inputSchema: {},
    },
    async () => {
      try {
        const gh = await requireOctokit(options);
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
        const gh = await requireOctokit(options);
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
        const gh = await requireOctokit(options);
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
        const gh = await requireOctokit(options);
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
        const gh = await requireOctokit(options);
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
        const gh = await requireOctokit(options);
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
        const gh = await requireOctokit(options);
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
