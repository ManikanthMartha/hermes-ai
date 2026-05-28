# Hermes Hosted Auth and Connection Setup

This is the hosted prototype setup for user-scoped Hermes.

## Runtime Shape

Hermes now expects every product request to be authenticated in the web app.

- `apps/web` owns Better Auth email/password sign-in.
- `apps/web` validates the session and forwards only internal scope headers to `apps/agent-runtime`.
- `apps/agent-runtime` rejects `/api/*` requests that do not include the internal runtime secret and user/workspace scope.
- `apps/mcp-gateway` hosts the provider MCP endpoints and resolves encrypted user credentials per request.
- Each signed-in user gets a deterministic personal workspace ID derived from the Better Auth user ID.
- Provider credentials are encrypted and stored under that workspace.
- Shared env tokens are not used for hosted connector access.

## Railway Services

Create three Railway services from the same repo:

- Web: `pnpm --filter @hermes/web build` and `pnpm --filter @hermes/web start`
- Runtime: `pnpm --filter @hermes/agent-runtime start`
- MCP Gateway: `pnpm --filter @hermes/mcp-gateway start`

Set `AGENT_RUNTIME_URL` in the web service to the private or public URL of the runtime service.
Set `MCP_*_URL` in the runtime service to the MCP gateway private service URLs.

Set the same `API_SECRET_KEY` in both services. The web service sends it to the runtime as `x-hermes-runtime-secret`.
Set the same `MCP_GATEWAY_SECRET` in runtime and MCP gateway. Runtime sends it to the gateway as `x-hermes-runtime-secret`.

## Required Environment Variables

Set these in Railway:

```text
DATABASE_URL=
OPENAI_API_KEY=
ANTHROPIC_API_KEY=
CREDENTIAL_ENCRYPTION_KEY=
BETTER_AUTH_SECRET=
BETTER_AUTH_URL=https://<web-domain>
APP_URL=https://<web-domain>
AGENT_RUNTIME_URL=https://<runtime-domain>
API_SECRET_KEY=
MCP_GATEWAY_SECRET=
MCP_SLACK_URL=http://<mcp-gateway-private-domain>/slack/mcp
MCP_GMAIL_URL=http://<mcp-gateway-private-domain>/gmail/mcp
MCP_GITHUB_URL=http://<mcp-gateway-private-domain>/github/mcp
MCP_LINEAR_URL=http://<mcp-gateway-private-domain>/linear/mcp
MCP_SENTRY_URL=http://<mcp-gateway-private-domain>/sentry/mcp
GOOGLE_CLIENT_ID=
GOOGLE_CLIENT_SECRET=
SLACK_CLIENT_ID=
SLACK_CLIENT_SECRET=
GITHUB_CLIENT_ID=
GITHUB_CLIENT_SECRET=
LINEAR_CLIENT_ID=
LINEAR_CLIENT_SECRET=
SENTRY_CLIENT_ID=
SENTRY_CLIENT_SECRET=
```

`BETTER_AUTH_SECRET`, `CREDENTIAL_ENCRYPTION_KEY`, `API_SECRET_KEY`, and `MCP_GATEWAY_SECRET` should be long random strings.

## OAuth Redirect URLs

Register these callback URLs in each provider app:

```text
https://<web-domain>/api/connections/oauth/calendar/callback
https://<web-domain>/api/connections/oauth/gmail/callback
https://<web-domain>/api/connections/oauth/slack/callback
https://<web-domain>/api/connections/oauth/github/callback
https://<web-domain>/api/connections/oauth/linear/callback
https://<web-domain>/api/connections/oauth/sentry/callback
```

Local development callbacks:

```text
http://localhost:3000/api/connections/oauth/calendar/callback
http://localhost:3000/api/connections/oauth/gmail/callback
http://localhost:3000/api/connections/oauth/slack/callback
http://localhost:3000/api/connections/oauth/github/callback
http://localhost:3000/api/connections/oauth/linear/callback
http://localhost:3000/api/connections/oauth/sentry/callback
```

## Provider App Notes

Google:

- Create a Web OAuth client, not a desktop client.
- Enable Gmail API and Google Calendar API.
- Add the web callback URLs above.
- For internal testing, keep the OAuth consent screen in testing and add team members as test users.
- For external users, publish the app and complete Google's verification if requested for sensitive Gmail scopes.

Slack:

- Create a Slack app.
- Add bot scopes for channel/private-channel/DM reads, user reads, `chat:write`, and `im:write`.
- Add user scope `search:read` because meeting prep uses Slack workspace search.
- Add the Slack callback URL.
- Install the app into the workspace.
- For other workspaces, enable Slack app distribution or have each workspace install its own app.

GitHub:

- Create a GitHub OAuth App.
- Add the GitHub callback URL.
- Hermes requests repo/read-user/read-org style access for assigned issues and PR context.

Linear:

- Create a Linear OAuth application.
- Add the Linear callback URL.
- Hermes also supports manual token storage for prototype use.

Sentry:

- Create a Sentry OAuth application if available for your org.
- Add the Sentry callback URL.
- Hermes also supports manual token storage and requires the Sentry org slug when using manual token mode.

## Current Prototype Limitation

Background polling/watchers are disabled in user-scoped hosted mode. Manual sync from the UI is the supported prototype path. A per-user scheduler should be added before enabling background sync for multiple users.
