import { createHash, randomBytes, randomUUID } from "node:crypto";
import type { Request, Response } from "express";
import {
  audit,
  ensureDefaultWorkspace,
  isIntegrationProvider,
  logger,
  prisma,
  deleteProviderCredential,
  storeProviderCredential,
  type IntegrationProvider,
  type StoredCredentialPayload,
  type WorkspaceContext,
} from "@hermes/shared";

type OAuthProvider = "gmail" | "calendar" | "slack" | "github" | "linear" | "sentry";

type ProviderDefinition = {
  provider: OAuthProvider;
  label: string;
  category: string;
  authKind: "oauth" | "oauth_or_token";
  envKeys: string[];
  scopes: string[];
  userScopes?: string[];
  description: string;
};

type IntegrationRow = {
  id: string | null;
  provider: string;
  status: string;
  scopes: unknown;
  config: unknown;
  lastSuccessfulSync: Date | null;
  lastAttemptedSync: Date | null;
  failureReason: string | null;
  updatedAt: Date | null;
};

type CredentialMetaRow = {
  provider: string;
  metadata: unknown;
  updatedAt: Date;
};

type OAuthStateRow = {
  id: string;
  workspaceId: string;
  provider: string;
  stateHash: string;
  redirectUri: string;
  returnTo: string | null;
  metadata: unknown;
  expiresAt: Date;
  consumedAt: Date | null;
};

export const CONNECTION_PROVIDERS: ProviderDefinition[] = [
  {
    provider: "calendar",
    label: "Google Calendar",
    category: "meetings",
    authKind: "oauth",
    envKeys: ["GOOGLE_CLIENT_ID", "GOOGLE_CLIENT_SECRET"],
    scopes: ["https://www.googleapis.com/auth/calendar.events.readonly"],
    description: "Read upcoming meetings and create meeting prep from calendar context.",
  },
  {
    provider: "gmail",
    label: "Gmail",
    category: "communications",
    authKind: "oauth",
    envKeys: ["GOOGLE_CLIENT_ID", "GOOGLE_CLIENT_SECRET"],
    scopes: ["https://www.googleapis.com/auth/gmail.modify"],
    description: "Read and draft email workflows with user-authorized mailbox access.",
  },
  {
    provider: "slack",
    label: "Slack",
    category: "communications",
    authKind: "oauth",
    envKeys: ["SLACK_CLIENT_ID", "SLACK_CLIENT_SECRET"],
    scopes: [
      "channels:history",
      "channels:read",
      "groups:history",
      "groups:read",
      "im:history",
      "im:read",
      "im:write",
      "mpim:history",
      "mpim:read",
      "chat:write",
      "users:read",
    ],
    userScopes: ["search:read"],
    description: "Search workspace conversations and turn updates into action signals.",
  },
  {
    provider: "github",
    label: "GitHub",
    category: "engineering",
    authKind: "oauth",
    envKeys: ["GITHUB_CLIENT_ID", "GITHUB_CLIENT_SECRET"],
    scopes: ["repo", "read:user", "read:org"],
    description: "Find assigned issues, PRs, reviews, and engineering follow-ups.",
  },
  {
    provider: "linear",
    label: "Linear",
    category: "planning",
    authKind: "oauth_or_token",
    envKeys: ["LINEAR_CLIENT_ID", "LINEAR_CLIENT_SECRET"],
    scopes: ["read", "write"],
    description: "Sync assigned issues and project execution signals.",
  },
  {
    provider: "sentry",
    label: "Sentry",
    category: "observability",
    authKind: "oauth_or_token",
    envKeys: ["SENTRY_CLIENT_ID", "SENTRY_CLIENT_SECRET"],
    scopes: ["org:read", "project:read", "event:read"],
    description: "Monitor unresolved production issues and incident risks.",
  },
];

export async function listConnections(context: WorkspaceContext) {
  const { workspaceId } = await ensureDefaultWorkspace(context);
  const [integrations, credentials] = await Promise.all([
    prisma.$queryRaw<IntegrationRow[]>`
      SELECT
        id::text AS "id",
        provider,
        status,
        scopes,
        config,
        last_successful_sync AS "lastSuccessfulSync",
        last_attempted_sync AS "lastAttemptedSync",
        failure_reason AS "failureReason",
        updated_at AS "updatedAt"
      FROM integration_accounts
      WHERE workspace_id = ${workspaceId}::uuid
    `,
    prisma.$queryRaw<CredentialMetaRow[]>`
      SELECT
        provider,
        metadata,
        updated_at AS "updatedAt"
      FROM integration_credentials
      WHERE workspace_id = ${workspaceId}::uuid
    `,
  ]);

  const byProvider = new Map(integrations.map((row) => [row.provider, row]));
  const credentialByProvider = new Map(
    credentials.map((row) => [row.provider, row]),
  );

  return CONNECTION_PROVIDERS.map((definition) => {
    const integration = byProvider.get(definition.provider);
    const credential = credentialByProvider.get(definition.provider);
    const credentialMeta = isRecord(credential?.metadata)
      ? credential?.metadata
      : {};
    const grantedScopes = toStringArray(
      integration?.scopes ?? credentialMeta.scopes ?? [],
    );
    const requiredScopes = [
      ...definition.scopes,
      ...(definition.userScopes ?? []),
    ];
    const missingScopes = requiredScopes.filter(
      (scope) => !grantedScopes.includes(scope),
    );
    const oauthReady = definition.envKeys.every((key) => Boolean(process.env[key]));
    const connectedByCredential = Boolean(credential);
    const status = connectedByCredential
      ? missingScopes.length
        ? "degraded"
        : "connected"
      : integration?.status === "error" || integration?.status === "degraded"
        ? integration.status
        : "not_connected";

    return {
      provider: definition.provider,
      label: definition.label,
      category: definition.category,
      description: definition.description,
      authKind: definition.authKind,
      status,
      scopes: grantedScopes,
      requiredScopes,
      missingScopes,
      oauthReady,
      envFallbackReady: false,
      connectedBy: connectedByCredential
        ? credentialMeta.credentialType ?? "oauth"
        : null,
      credential: credential
        ? {
            updatedAt: credential.updatedAt.toISOString(),
            expiresAt: safeString(credentialMeta.expiresAt),
            hasRefreshToken: Boolean(credentialMeta.hasRefreshToken),
            account: isRecord(credentialMeta.account) ? credentialMeta.account : {},
          }
        : null,
      lastSuccessfulSync: integration?.lastSuccessfulSync?.toISOString() ?? null,
      lastAttemptedSync: integration?.lastAttemptedSync?.toISOString() ?? null,
      failureReason: missingScopes.length
        ? "Connection is missing required scopes. Reconnect this app."
        : integration?.failureReason
          ? "Connection needs attention."
          : null,
      updatedAt: integration?.updatedAt?.toISOString() ?? null,
    };
  });
}

export async function startConnection(
  provider: IntegrationProvider,
  context: WorkspaceContext,
) {
  const definition = getDefinition(provider);
  if (!definition.envKeys.every((key) => Boolean(process.env[key]))) {
    throw new ConnectionInputError(
      400,
      `${definition.label} OAuth app is not configured on the server.`,
    );
  }

  const { workspaceId, userId } = await ensureDefaultWorkspace(context);
  const state = randomBytes(32).toString("base64url");
  const redirectUri = callbackUrl(provider);
  await prisma.$executeRaw`
    INSERT INTO integration_oauth_states (
      id,
      workspace_id,
      provider,
      state_hash,
      redirect_uri,
      return_to,
      metadata,
      expires_at,
      created_at
    )
    VALUES (
      ${randomUUID()}::uuid,
      ${workspaceId}::uuid,
      ${provider},
      ${hashState(state)},
      ${redirectUri},
      '/connections',
      ${JSON.stringify({ userId })}::jsonb,
      ${new Date(Date.now() + 10 * 60 * 1000)},
      now()
    )
  `;

  return { provider, authUrl: buildAuthorizeUrl(definition, state, redirectUri) };
}

export async function completeConnection(input: {
  provider: IntegrationProvider;
  code: string;
  state: string;
}) {
  const definition = getDefinition(input.provider);
  const state = await consumeOAuthState(input.provider, input.state);
  const token = await exchangeCode(definition, input.code, state.redirectUri);
  const account = await providerAccount(definition.provider, token);
  const payload = toCredentialPayload(definition, token, account);
  const accountId = await upsertConnectedAccount({
    workspaceId: state.workspaceId,
    provider: input.provider,
    scopes: payload.scopes ?? definition.scopes,
    config: {
      connectorMode: "oauth",
      developerConfigured: true,
      authKind: definition.authKind,
      account,
    },
  });

  await storeProviderCredential({
    workspaceId: state.workspaceId,
    integrationAccountId: accountId,
    provider: input.provider,
    payload,
    metadata: { account },
  });

  await audit({
    workspaceId: state.workspaceId,
    actorType: "user",
    actorId: stateUserId(state),
    eventType: "integration.connected",
    objectType: "integration_account",
    objectId: accountId,
    afterState: {
      provider: input.provider,
      connectorMode: "oauth",
      scopes: payload.scopes ?? definition.scopes,
    },
  });

  return { provider: input.provider, returnTo: state.returnTo ?? "/connections" };
}

export async function saveManualCredential(input: {
  context: WorkspaceContext;
  provider: IntegrationProvider;
  accessToken: string;
  orgSlug?: string;
}) {
  const definition = getDefinition(input.provider);
  if (definition.authKind !== "oauth_or_token") {
    throw new ConnectionInputError(
      400,
      `${definition.label} requires OAuth for user-authorized setup.`,
    );
  }
  const { workspaceId } = await ensureDefaultWorkspace(input.context);
  const account = {
    setup: "manual_token",
    orgSlug: input.orgSlug ?? null,
  };
  const accountId = await upsertConnectedAccount({
    workspaceId,
    provider: input.provider,
    scopes: definition.scopes,
    config: {
      connectorMode: "oauth",
      authKind: "manual_token",
      account,
    },
  });
  await storeProviderCredential({
    workspaceId,
    integrationAccountId: accountId,
    provider: input.provider,
    payload: {
      provider: input.provider,
      credentialType: "manual",
      accessToken: input.accessToken,
      scopes: definition.scopes,
      account,
    },
    metadata: { account },
  });
  return { provider: input.provider, status: "connected" };
}

export async function disconnectProvider(
  provider: IntegrationProvider,
  context: WorkspaceContext,
) {
  const { workspaceId, userId } = await ensureDefaultWorkspace(context);
  await deleteProviderCredential(provider, workspaceId);
  await prisma.$executeRaw`
    UPDATE integration_accounts
    SET status = 'not_connected',
        scopes = '[]'::jsonb,
        config = jsonb_set(
          COALESCE(config, '{}'::jsonb),
          '{connectorMode}',
          '"oauth"'::jsonb,
          true
        ),
        failure_reason = NULL,
        updated_at = now()
    WHERE workspace_id = ${workspaceId}::uuid
      AND provider = ${provider}
  `;
  await audit({
    workspaceId,
    actorType: "user",
    actorId: userId,
    eventType: "integration.degraded",
    objectType: "integration_account",
    objectId: provider,
    afterState: { provider, status: "not_connected" },
  });
}

export async function handleConnectionCallback(req: Request, res: Response) {
  try {
    const provider = parseProvider(req.params.provider);
    const code = singleQueryValue(req.query.code);
    const state = singleQueryValue(req.query.state);
    const error = singleQueryValue(req.query.error);
    if (error) {
      res.redirect(`/connections?connection=${provider}&error=${encodeURIComponent(error)}`);
      return;
    }
    if (!code || !state) {
      throw new ConnectionInputError(400, "OAuth callback is missing code or state");
    }

    const result = await completeConnection({ provider, code, state });
    res.redirect(`${result.returnTo}?connection=${provider}&status=connected`);
  } catch (err) {
    logger.error({ err }, "connection callback failed");
    const message =
      err instanceof Error ? err.message : "connection callback failed";
    res.redirect(`/connections?error=${encodeURIComponent(message)}`);
  }
}

export function parseProvider(value: unknown): IntegrationProvider {
  if (typeof value !== "string" || !isIntegrationProvider(value)) {
    throw new ConnectionInputError(400, "unsupported provider");
  }
  return value;
}

export class ConnectionInputError extends Error {
  constructor(
    public readonly statusCode: number,
    message: string,
  ) {
    super(message);
  }
}

function getDefinition(provider: IntegrationProvider): ProviderDefinition {
  const definition = CONNECTION_PROVIDERS.find((item) => item.provider === provider);
  if (!definition) {
    throw new ConnectionInputError(400, "unsupported provider");
  }
  return definition;
}

function buildAuthorizeUrl(
  definition: ProviderDefinition,
  state: string,
  redirectUri: string,
) {
  if (definition.provider === "gmail" || definition.provider === "calendar") {
    const url = new URL("https://accounts.google.com/o/oauth2/v2/auth");
    url.searchParams.set("client_id", requiredEnv("GOOGLE_CLIENT_ID"));
    url.searchParams.set("redirect_uri", redirectUri);
    url.searchParams.set("response_type", "code");
    url.searchParams.set("scope", definition.scopes.join(" "));
    url.searchParams.set("access_type", "offline");
    url.searchParams.set("prompt", "consent");
    url.searchParams.set("include_granted_scopes", "true");
    url.searchParams.set("state", state);
    return url.toString();
  }

  if (definition.provider === "slack") {
    const url = new URL("https://slack.com/oauth/v2/authorize");
    url.searchParams.set("client_id", requiredEnv("SLACK_CLIENT_ID"));
    url.searchParams.set("scope", definition.scopes.join(","));
    if (definition.userScopes?.length) {
      url.searchParams.set("user_scope", definition.userScopes.join(","));
    }
    url.searchParams.set("redirect_uri", redirectUri);
    url.searchParams.set("state", state);
    return url.toString();
  }

  if (definition.provider === "github") {
    const url = new URL("https://github.com/login/oauth/authorize");
    url.searchParams.set("client_id", requiredEnv("GITHUB_CLIENT_ID"));
    url.searchParams.set("redirect_uri", redirectUri);
    url.searchParams.set("scope", definition.scopes.join(" "));
    url.searchParams.set("state", state);
    return url.toString();
  }

  if (definition.provider === "linear") {
    const url = new URL("https://linear.app/oauth/authorize");
    url.searchParams.set("client_id", requiredEnv("LINEAR_CLIENT_ID"));
    url.searchParams.set("redirect_uri", redirectUri);
    url.searchParams.set("response_type", "code");
    url.searchParams.set("scope", definition.scopes.join(","));
    url.searchParams.set("state", state);
    return url.toString();
  }

  const url = new URL("https://sentry.io/oauth/authorize/");
  url.searchParams.set("client_id", requiredEnv("SENTRY_CLIENT_ID"));
  url.searchParams.set("redirect_uri", redirectUri);
  url.searchParams.set("response_type", "code");
  url.searchParams.set("scope", definition.scopes.join(" "));
  url.searchParams.set("state", state);
  return url.toString();
}

async function exchangeCode(
  definition: ProviderDefinition,
  code: string,
  redirectUri: string,
) {
  if (definition.provider === "gmail" || definition.provider === "calendar") {
    return postForm<Record<string, unknown>>("https://oauth2.googleapis.com/token", {
      client_id: requiredEnv("GOOGLE_CLIENT_ID"),
      client_secret: requiredEnv("GOOGLE_CLIENT_SECRET"),
      code,
      redirect_uri: redirectUri,
      grant_type: "authorization_code",
    });
  }

  if (definition.provider === "slack") {
    return postForm<Record<string, unknown>>(
      "https://slack.com/api/oauth.v2.access",
      {
        code,
        redirect_uri: redirectUri,
      },
      basicAuth(requiredEnv("SLACK_CLIENT_ID"), requiredEnv("SLACK_CLIENT_SECRET")),
    );
  }

  if (definition.provider === "github") {
    return postJson<Record<string, unknown>>("https://github.com/login/oauth/access_token", {
      client_id: requiredEnv("GITHUB_CLIENT_ID"),
      client_secret: requiredEnv("GITHUB_CLIENT_SECRET"),
      code,
      redirect_uri: redirectUri,
    });
  }

  if (definition.provider === "linear") {
    return postForm<Record<string, unknown>>("https://api.linear.app/oauth/token", {
      client_id: requiredEnv("LINEAR_CLIENT_ID"),
      client_secret: requiredEnv("LINEAR_CLIENT_SECRET"),
      code,
      redirect_uri: redirectUri,
      grant_type: "authorization_code",
    });
  }

  return postForm<Record<string, unknown>>("https://sentry.io/oauth/token/", {
    client_id: requiredEnv("SENTRY_CLIENT_ID"),
    client_secret: requiredEnv("SENTRY_CLIENT_SECRET"),
    code,
    redirect_uri: redirectUri,
    grant_type: "authorization_code",
  });
}

async function providerAccount(
  provider: OAuthProvider,
  token: Record<string, unknown>,
) {
  if (provider === "slack") {
    return {
      team: isRecord(token.team) ? token.team : null,
      enterprise: isRecord(token.enterprise) ? token.enterprise : null,
      authedUser: isRecord(token.authed_user) ? token.authed_user : null,
      botUserId: safeString(token.bot_user_id),
      appId: safeString(token.app_id),
    };
  }
  if (provider === "github" && typeof token.access_token === "string") {
    const user = await fetchProviderJson<{
      id?: unknown;
      login?: unknown;
      name?: unknown;
    }>(
      "https://api.github.com/user",
      token.access_token,
      {
        Accept: "application/vnd.github+json",
        "X-GitHub-Api-Version": "2022-11-28",
        "User-Agent": "hermes-ai",
      },
    );
    return {
      id: user?.id ?? null,
      login: user?.login ?? null,
      name: user?.name ?? null,
    };
  }
  if (provider === "linear" && typeof token.access_token === "string") {
    const data = await fetch("https://api.linear.app/graphql", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token.access_token}`,
        "content-type": "application/json",
      },
      body: JSON.stringify({ query: "{ viewer { id name email } }" }),
    });
    if (data.ok) {
      const json = (await data.json()) as { data?: { viewer?: unknown } };
      return isRecord(json.data?.viewer) ? json.data.viewer : {};
    }
  }
  if (provider === "sentry" && typeof token.access_token === "string") {
    const orgs = await fetchProviderJson<Array<{ slug?: unknown; name?: unknown }>>(
      "https://sentry.io/api/0/organizations/",
      token.access_token,
    );
    const firstOrg = Array.isArray(orgs) ? orgs[0] : null;
    return {
      orgSlug: safeString(firstOrg?.slug) ?? null,
      orgName: safeString(firstOrg?.name) ?? null,
    };
  }
  return {};
}

function toCredentialPayload(
  definition: ProviderDefinition,
  token: Record<string, unknown>,
  account: Record<string, unknown>,
): StoredCredentialPayload {
  const authedUser = isRecord(token.authed_user) ? token.authed_user : {};
  const scopes = uniqueStrings([
    ...parseScopes(token.scope, definition.scopes),
    ...parseScopes(authedUser.scope, definition.userScopes ?? []),
  ]);
  const expiresAt = expiryFrom(token.expires_in);
  const accessToken =
    safeString(authedUser.access_token) ??
    safeString(token.authed_user_access_token);
  const botAccessToken =
    definition.provider === "slack" ? safeString(token.access_token) : undefined;
  return {
    provider: definition.provider,
    credentialType: "oauth",
    accessToken,
    botAccessToken,
    refreshToken: safeString(token.refresh_token),
    tokenType: safeString(token.token_type) ?? "Bearer",
    expiresAt,
    scopes,
    account,
  };
}

async function upsertConnectedAccount(input: {
  workspaceId: string;
  provider: IntegrationProvider;
  scopes: string[];
  config: Record<string, unknown>;
}) {
  const rows = await prisma.$queryRaw<Array<{ id: string }>>`
    INSERT INTO integration_accounts (
      id,
      workspace_id,
      provider,
      status,
      scopes,
      config,
      failure_reason,
      created_at,
      updated_at
    )
    VALUES (
      ${randomUUID()}::uuid,
      ${input.workspaceId}::uuid,
      ${input.provider},
      'connected',
      ${JSON.stringify(input.scopes)}::jsonb,
      ${JSON.stringify(input.config)}::jsonb,
      NULL,
      now(),
      now()
    )
    ON CONFLICT (workspace_id, provider) DO UPDATE
    SET status = 'connected',
        scopes = EXCLUDED.scopes,
        config = EXCLUDED.config,
        failure_reason = NULL,
        updated_at = now()
    RETURNING id::text AS id
  `;
  return rows[0]?.id ?? "";
}

async function consumeOAuthState(provider: IntegrationProvider, state: string) {
  const rows = await prisma.$queryRaw<OAuthStateRow[]>`
    UPDATE integration_oauth_states
    SET consumed_at = now()
    WHERE provider = ${provider}
      AND state_hash = ${hashState(state)}
      AND consumed_at IS NULL
      AND expires_at > now()
    RETURNING
      id::text AS "id",
      workspace_id::text AS "workspaceId",
      provider,
      state_hash AS "stateHash",
      redirect_uri AS "redirectUri",
      return_to AS "returnTo",
      metadata,
      expires_at AS "expiresAt",
      consumed_at AS "consumedAt"
  `;
  const row = rows[0];
  if (!row) {
    throw new ConnectionInputError(400, "OAuth state is invalid or expired");
  }
  return row;
}

function stateUserId(state: OAuthStateRow): string {
  const metadata = isRecord(state.metadata) ? state.metadata : {};
  const userId = safeString(metadata.userId);
  if (!userId) throw new ConnectionInputError(400, "OAuth state is missing user context");
  return userId;
}

function callbackUrl(provider: IntegrationProvider) {
  const appUrl = process.env.APP_URL ?? "http://localhost:3000";
  return `${appUrl.replace(/\/$/, "")}/api/connections/oauth/${provider}/callback`;
}

function hashState(state: string) {
  return createHash("sha256").update(state).digest("base64url");
}

function parseScopes(raw: unknown, fallback: string[]) {
  if (typeof raw !== "string") return fallback;
  return raw.includes(",")
    ? raw.split(",").map((scope) => scope.trim()).filter(Boolean)
    : raw.split(/\s+/).map((scope) => scope.trim()).filter(Boolean);
}

function expiryFrom(raw: unknown) {
  if (typeof raw !== "number" || !Number.isFinite(raw)) return undefined;
  return new Date(Date.now() + raw * 1000).toISOString();
}

async function postForm<T>(
  url: string,
  body: Record<string, string>,
  authorization?: string,
): Promise<T> {
  const headers: Record<string, string> = {
    "content-type": "application/x-www-form-urlencoded",
    Accept: "application/json",
  };
  if (authorization) headers.Authorization = authorization;
  const res = await fetch(url, {
    method: "POST",
    headers,
    body: new URLSearchParams(body),
  });
  return parseTokenResponse<T>(res);
}

async function postJson<T>(url: string, body: Record<string, string>): Promise<T> {
  const res = await fetch(url, {
    method: "POST",
    headers: {
      Accept: "application/json",
      "content-type": "application/json",
    },
    body: JSON.stringify(body),
  });
  return parseTokenResponse<T>(res);
}

async function parseTokenResponse<T>(res: globalThis.Response): Promise<T> {
  const json = (await res.json()) as Record<string, unknown>;
  if (!res.ok || json.error || json.ok === false) {
    throw new Error(
      `OAuth token exchange failed: ${safeString(json.error_description) ?? safeString(json.error) ?? res.status}`,
    );
  }
  return json as T;
}

async function fetchProviderJson<T>(
  url: string,
  token: string,
  extraHeaders: Record<string, string> = {},
): Promise<T | null> {
  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${token}`, ...extraHeaders },
  });
  if (!res.ok) return null;
  return (await res.json()) as T;
}

function basicAuth(clientId: string, clientSecret: string) {
  return `Basic ${Buffer.from(`${clientId}:${clientSecret}`).toString("base64")}`;
}

function requiredEnv(key: string) {
  const value = process.env[key];
  if (!value) throw new ConnectionInputError(400, `${key} is not configured`);
  return value;
}

function singleQueryValue(value: unknown): string | undefined {
  if (typeof value === "string") return value;
  if (Array.isArray(value) && typeof value[0] === "string") return value[0];
  return undefined;
}

function safeString(value: unknown): string | undefined {
  return typeof value === "string" && value.length > 0 ? value : undefined;
}

function uniqueStrings(values: string[]) {
  return [...new Set(values)];
}

function toStringArray(value: unknown): string[] {
  return Array.isArray(value)
    ? value.filter((item): item is string => typeof item === "string")
    : [];
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === "object" && !Array.isArray(value);
}
