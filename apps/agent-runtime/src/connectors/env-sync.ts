import { randomUUID } from "node:crypto";
import {
  audit,
  createIdempotencyKey,
  DEFAULT_USER_ID,
  ensureDefaultWorkspace,
  type IntegrationProvider,
  logger,
  prisma,
  recordFailure,
  upsertIntegrationHealth,
} from "@hermes/shared";

interface SourceObjectRow {
  id: string;
  workspaceId: string;
  provider: string;
  objectType: string;
  externalId: string;
  title: string | null;
  url: string | null;
  occurredAt: Date | null;
  normalized: unknown;
  lastObservedAt: Date;
  createdAt: Date;
  updatedAt: Date;
}

interface ExistingSourceObjectRow {
  contentHash: string | null;
}

interface SyncRunRow {
  id: string;
  workspaceId: string;
  provider: string;
  syncType: string;
  status: string;
  objectsSeen: number;
  objectsChanged: number;
  failureReason: string | null;
  startedAt: Date;
  completedAt: Date | null;
}

interface SignalRow {
  id: string;
  workspaceId: string;
  signalType: string;
  title: string;
  summary: string | null;
  sourceIds: string[];
  confidence: number;
  status: string;
  idempotencyKey: string | null;
  createdAt: Date;
  updatedAt: Date;
}

interface ActionRow {
  id: string;
  workspaceId: string;
  actionType: string;
  title: string;
  summary: string | null;
  status: string;
  dueAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

interface ConnectorSource {
  objectType: string;
  externalId: string;
  title: string;
  url: string | null;
  sourceUserId?: string | null;
  occurredAt: Date | null;
  rawPayload: Record<string, unknown>;
  normalized: Record<string, unknown>;
  action?: ConnectorAction;
}

interface ConnectorAction {
  actionType: string;
  title: string;
  summary: string;
  reason: string;
  impactLevel: "low" | "medium" | "high" | "critical";
  riskLevel: "low" | "medium" | "high" | "critical";
  draftPayload: Record<string, unknown>;
  dueAt: Date | null;
}

export interface ListSourceObjectsInput {
  provider?: IntegrationProvider;
  limit?: number;
}

export interface EnvSyncInput {
  trigger?: "manual" | "watcher";
}

export class ConnectorConfigurationError extends Error {
  constructor(message: string) {
    super(message);
  }
}

export async function listSourceObjects(input: ListSourceObjectsInput = {}) {
  const { workspaceId } = await ensureDefaultWorkspace();
  const limit = Math.max(1, Math.min(input.limit ?? 50, 200));
  const provider = input.provider ?? null;

  const rows = await prisma.$queryRaw<SourceObjectRow[]>`
    SELECT
      id::text AS "id",
      workspace_id::text AS "workspaceId",
      provider,
      object_type AS "objectType",
      external_id AS "externalId",
      title,
      url,
      occurred_at AS "occurredAt",
      normalized,
      last_observed_at AS "lastObservedAt",
      created_at AS "createdAt",
      updated_at AS "updatedAt"
    FROM source_objects
    WHERE workspace_id = ${workspaceId}::uuid
      AND (${provider}::text IS NULL OR provider = ${provider})
      AND external_id NOT LIKE 'prototype:%'
    ORDER BY last_observed_at DESC
    LIMIT ${limit}
  `;

  return rows.map(toSourceObjectResponse);
}

export async function runEnvConnectorSync(
  provider: IntegrationProvider,
  input: EnvSyncInput = {},
) {
  const { workspaceId } = await ensureDefaultWorkspace();
  const trigger = input.trigger ?? "manual";
  const startedAt = new Date();
  const syncRunId = randomUUID();

  await prisma.$executeRaw`
    INSERT INTO sync_runs (
      id,
      workspace_id,
      provider,
      sync_type,
      status,
      objects_seen,
      objects_changed,
      started_at,
      metadata
    )
    VALUES (
      ${syncRunId}::uuid,
      ${workspaceId}::uuid,
      ${provider},
      'env_watch',
      'running',
      0,
      0,
      ${startedAt},
      ${toJson({ trigger, connectorMode: "env" })}::jsonb
    )
  `;

  try {
    const items = await fetchProviderSources(provider);
    let objectsChanged = 0;
    const sourceObjects = [];
    const actions = [];

    for (const item of items) {
      const sourceObject = await upsertSourceObject(workspaceId, provider, item);
      if (sourceObject.changed) objectsChanged += 1;
      sourceObjects.push(toSourceObjectResponse(sourceObject.row));

      if (item.action) {
        const signal = await upsertSignal(
          workspaceId,
          provider,
          syncRunId,
          sourceObject.row,
          item,
        );
        const action = await upsertAction(
          workspaceId,
          provider,
          syncRunId,
          sourceObject.row,
          signal,
          item.action,
        );
        actions.push(toActionSummaryResponse(action));
      }
    }

    const syncRun = await completeSyncRun(syncRunId, items.length, objectsChanged, {
      trigger,
      connectorMode: "env",
    });

    await upsertIntegrationHealth({
      workspaceId,
      provider,
      status: "connected",
      scopes: ["read"],
      config: { developerConfigured: true, connectorMode: "env" },
      lastSuccessfulSync: new Date(),
      lastAttemptedSync: startedAt,
      failureReason: null,
    });

    await audit({
      workspaceId,
      actorType: trigger === "watcher" ? "system" : "user",
      actorId: trigger === "manual" ? DEFAULT_USER_ID : undefined,
      eventType: "sync.completed",
      objectType: "sync_run",
      objectId: syncRun.id,
      sourceIds: sourceObjects.map((item) => item.id),
      afterState: {
        provider,
        trigger,
        connectorMode: "env",
        objectsSeen: syncRun.objectsSeen,
        objectsChanged: syncRun.objectsChanged,
        actionsCreated: actions.length,
      },
    });

    return {
      provider,
      syncRun: toSyncRunResponse(syncRun),
      sourceObjects,
      actions,
    };
  } catch (err) {
    const configured = !(err instanceof ConnectorConfigurationError);
    const failureReason = configured
      ? "Connector sync failed."
      : "Connector is not configured.";

    await prisma.$executeRaw`
      UPDATE sync_runs
      SET status = 'failed',
          failure_reason = ${failureReason},
          completed_at = now(),
          metadata = ${toJson({ trigger, connectorMode: "env" })}::jsonb
      WHERE id = ${syncRunId}::uuid
    `;

    await upsertIntegrationHealth({
      workspaceId,
      provider,
      status: configured ? "error" : "not_connected",
      scopes: [],
      config: { developerConfigured: false, connectorMode: "env" },
      lastAttemptedSync: startedAt,
      failureReason: configured ? failureReason : null,
    });

    if (configured) {
      await recordFailure({
        workspaceId,
        severity: "medium",
        source: `connector.${provider}`,
        eventType: "sync.failed",
        objectType: "sync_run",
        objectId: syncRunId,
        message: failureReason,
        details: { provider, trigger, connectorMode: "env" },
      });
    }

    logger.error({ err, provider, trigger }, "env connector sync failed");
    throw err;
  }
}

async function upsertSourceObject(
  workspaceId: string,
  provider: IntegrationProvider,
  item: ConnectorSource,
) {
  const contentHash = createIdempotencyKey([
    workspaceId,
    provider,
    item.objectType,
    item.externalId,
    item.normalized,
  ]);
  const existing = await prisma.$queryRaw<ExistingSourceObjectRow[]>`
    SELECT content_hash AS "contentHash"
    FROM source_objects
    WHERE workspace_id = ${workspaceId}::uuid
      AND provider = ${provider}
      AND object_type = ${item.objectType}
      AND external_id = ${item.externalId}
    LIMIT 1
  `;
  const changed = existing[0]?.contentHash !== contentHash;

  const rows = await prisma.$queryRaw<SourceObjectRow[]>`
    INSERT INTO source_objects (
      id,
      workspace_id,
      provider,
      object_type,
      external_id,
      title,
      url,
      source_user_id,
      occurred_at,
      raw_payload,
      normalized,
      content_hash,
      last_observed_at,
      metadata,
      created_at,
      updated_at
    )
    VALUES (
      ${randomUUID()}::uuid,
      ${workspaceId}::uuid,
      ${provider},
      ${item.objectType},
      ${item.externalId},
      ${item.title},
      ${item.url},
      ${item.sourceUserId ?? null},
      ${item.occurredAt},
      ${toJson(item.rawPayload)}::jsonb,
      ${toJson(item.normalized)}::jsonb,
      ${contentHash},
      now(),
      ${toJson({ connectorMode: "env" })}::jsonb,
      now(),
      now()
    )
    ON CONFLICT (workspace_id, provider, object_type, external_id) DO UPDATE
    SET title = EXCLUDED.title,
        url = EXCLUDED.url,
        source_user_id = EXCLUDED.source_user_id,
        occurred_at = EXCLUDED.occurred_at,
        raw_payload = EXCLUDED.raw_payload,
        normalized = EXCLUDED.normalized,
        content_hash = EXCLUDED.content_hash,
        last_observed_at = now(),
        metadata = EXCLUDED.metadata,
        updated_at = now()
    RETURNING
      id::text AS "id",
      workspace_id::text AS "workspaceId",
      provider,
      object_type AS "objectType",
      external_id AS "externalId",
      title,
      url,
      occurred_at AS "occurredAt",
      normalized,
      last_observed_at AS "lastObservedAt",
      created_at AS "createdAt",
      updated_at AS "updatedAt"
  `;

  return { row: firstRow(rows, "source object"), changed };
}

async function upsertSignal(
  workspaceId: string,
  provider: IntegrationProvider,
  syncRunId: string,
  sourceObject: SourceObjectRow,
  item: ConnectorSource,
): Promise<SignalRow> {
  if (!item.action) throw new Error("cannot create signal without action");
  const idempotencyKey = createIdempotencyKey([
    workspaceId,
    "env_signal",
    provider,
    sourceObject.id,
  ]);
  const rows = await prisma.$queryRaw<SignalRow[]>`
    INSERT INTO signals (
      id,
      workspace_id,
      signal_type,
      title,
      summary,
      source_ids,
      confidence,
      status,
      idempotency_key,
      metadata,
      created_at,
      updated_at
    )
    VALUES (
      ${randomUUID()}::uuid,
      ${workspaceId}::uuid,
      ${item.action.actionType},
      ${item.action.title},
      ${item.action.summary},
      ${[sourceObject.id]},
      0.8,
      'accepted',
      ${idempotencyKey},
      ${toJson({ provider, syncRunId, connectorMode: "env" })}::jsonb,
      now(),
      now()
    )
    ON CONFLICT (workspace_id, idempotency_key) DO NOTHING
    RETURNING
      id::text AS "id",
      workspace_id::text AS "workspaceId",
      signal_type AS "signalType",
      title,
      summary,
      source_ids AS "sourceIds",
      confidence,
      status,
      idempotency_key AS "idempotencyKey",
      created_at AS "createdAt",
      updated_at AS "updatedAt"
  `;

  return rows[0] ?? getSignalByIdempotencyKey(workspaceId, idempotencyKey);
}

async function upsertAction(
  workspaceId: string,
  provider: IntegrationProvider,
  syncRunId: string,
  sourceObject: SourceObjectRow,
  signal: SignalRow,
  action: ConnectorAction,
): Promise<ActionRow> {
  const idempotencyKey = createIdempotencyKey([
    workspaceId,
    "env_action",
    provider,
    sourceObject.id,
    action.actionType,
  ]);
  const rows = await prisma.$queryRaw<ActionRow[]>`
    INSERT INTO action_items (
      id,
      workspace_id,
      owner_user_id,
      action_type,
      title,
      summary,
      reason,
      impact_level,
      risk_level,
      confidence_score,
      source_ids,
      draft_payload,
      approval_required,
      status,
      due_at,
      created_from_signal_id,
      idempotency_key,
      metadata,
      created_at,
      updated_at
    )
    VALUES (
      ${randomUUID()}::uuid,
      ${workspaceId}::uuid,
      ${DEFAULT_USER_ID},
      ${action.actionType},
      ${action.title},
      ${action.summary},
      ${action.reason},
      ${action.impactLevel},
      ${action.riskLevel},
      0.8,
      ${[sourceObject.id]},
      ${toJson(action.draftPayload)}::jsonb,
      true,
      'pending_approval',
      ${action.dueAt},
      ${signal.id}::uuid,
      ${idempotencyKey},
      ${toJson({ provider, syncRunId, connectorMode: "env" })}::jsonb,
      now(),
      now()
    )
    ON CONFLICT (workspace_id, idempotency_key) DO NOTHING
    RETURNING
      id::text AS "id",
      workspace_id::text AS "workspaceId",
      action_type AS "actionType",
      title,
      summary,
      status,
      due_at AS "dueAt",
      created_at AS "createdAt",
      updated_at AS "updatedAt"
  `;
  const row = rows[0] ?? (await getActionByIdempotencyKey(workspaceId, idempotencyKey));

  if (rows.length > 0) {
    await prisma.$executeRaw`
      INSERT INTO action_drafts (
        id,
        workspace_id,
        action_item_id,
        draft_type,
        payload,
        status,
        created_at,
        updated_at
      )
      VALUES (
        ${randomUUID()}::uuid,
        ${workspaceId}::uuid,
        ${row.id}::uuid,
        ${action.actionType},
        ${toJson(action.draftPayload)}::jsonb,
        'active',
        now(),
        now()
      )
      ON CONFLICT (workspace_id, action_item_id) WHERE status = 'active'
      DO UPDATE
      SET draft_type = EXCLUDED.draft_type,
          payload = EXCLUDED.payload,
          updated_at = now()
    `;
  }

  return row;
}

async function completeSyncRun(
  syncRunId: string,
  objectsSeen: number,
  objectsChanged: number,
  metadata: Record<string, unknown>,
): Promise<SyncRunRow> {
  const rows = await prisma.$queryRaw<SyncRunRow[]>`
    UPDATE sync_runs
    SET status = 'completed',
        objects_seen = ${objectsSeen},
        objects_changed = ${objectsChanged},
        completed_at = now(),
        metadata = ${toJson(metadata)}::jsonb
    WHERE id = ${syncRunId}::uuid
    RETURNING
      id::text AS "id",
      workspace_id::text AS "workspaceId",
      provider,
      sync_type AS "syncType",
      status,
      objects_seen AS "objectsSeen",
      objects_changed AS "objectsChanged",
      failure_reason AS "failureReason",
      started_at AS "startedAt",
      completed_at AS "completedAt"
  `;
  return firstRow(rows, "sync run");
}

async function fetchProviderSources(
  provider: IntegrationProvider,
): Promise<ConnectorSource[]> {
  switch (provider) {
    case "slack":
      return fetchSlackSources();
    case "github":
      return fetchGitHubSources();
    case "gmail":
      return fetchGmailSources();
    case "calendar":
      return fetchCalendarSources();
    case "linear":
      return fetchLinearSources();
    case "sentry":
      return fetchSentrySources();
  }
}

async function fetchSlackSources(): Promise<ConnectorSource[]> {
  const token = requireEnv("SLACK_BOT_TOKEN", "Slack");
  await slackApi<{ user_id?: string; team?: string }>("auth.test", token);
  return [];
}

async function fetchGitHubSources(): Promise<ConnectorSource[]> {
  const token = requireEnv("GITHUB_TOKEN", "GitHub");
  await githubApi<unknown>("/user", token);
  const issues = await githubApi<
    Array<{
      number: number;
      title: string;
      html_url: string;
      updated_at: string;
      repository?: { full_name?: string };
      pull_request?: unknown;
      user?: { login?: string };
    }>
  >("/issues?filter=assigned&state=open&sort=updated&per_page=10", token);

  return issues.slice(0, 5).map((issue) => {
    const repo = issue.repository?.full_name ?? "unknown/repo";
    const isPullRequest = Boolean(issue.pull_request);
    return {
      objectType: isPullRequest ? "pull_request" : "issue",
      externalId: `${repo}#${issue.number}`,
      title: `${repo}#${issue.number}: ${issue.title}`,
      url: issue.html_url,
      sourceUserId: issue.user?.login,
      occurredAt: new Date(issue.updated_at),
      rawPayload: {
        repo,
        number: issue.number,
        title: issue.title,
        url: issue.html_url,
        isPullRequest,
      },
      normalized: {
        summary: issue.title,
        repo,
        isPullRequest,
      },
      action: {
        actionType: isPullRequest ? "github_pr_review" : "github_issue_review",
        title: `${isPullRequest ? "Review PR" : "Review issue"} ${repo}#${issue.number}`,
        summary: issue.title,
        reason: "The GitHub connector found an open item assigned to the authenticated user.",
        impactLevel: "medium",
        riskLevel: "low",
        dueAt: null,
        draftPayload: {
          tool: "github",
          operation: isPullRequest ? "review_pull_request" : "review_issue",
          repo,
          number: issue.number,
          url: issue.html_url,
        },
      },
    };
  });
}

async function fetchGmailSources(): Promise<ConnectorSource[]> {
  const accessToken = await googleAccessToken();
  const list = await googleApi<{ messages?: Array<{ id: string; threadId?: string }> }>(
    "https://gmail.googleapis.com/gmail/v1/users/me/messages?q=in%3Ainbox%20newer_than%3A7d&maxResults=5",
    accessToken,
  );
  const messages = await Promise.all(
    (list.messages ?? []).map((message) =>
      googleApi<GmailMessage>(
        `https://gmail.googleapis.com/gmail/v1/users/me/messages/${message.id}?format=metadata&metadataHeaders=From&metadataHeaders=Subject&metadataHeaders=Date`,
        accessToken,
      ),
    ),
  );

  return messages.map((message) => {
    const headers = gmailHeaders(message);
    const subject = headers.subject ?? "(no subject)";
    return {
      objectType: "email",
      externalId: message.id,
      title: subject,
      url: null,
      sourceUserId: headers.from,
      occurredAt: headers.date ? new Date(headers.date) : null,
      rawPayload: {
        id: message.id,
        threadId: message.threadId,
        from: headers.from,
        subject,
        date: headers.date,
        snippet: message.snippet,
      },
      normalized: {
        summary: message.snippet ?? subject,
        from: headers.from,
      },
      action: {
        actionType: "gmail_review",
        title: `Review Gmail: ${subject}`,
        summary: message.snippet ?? subject,
        reason: "The Gmail connector found a recent inbox message.",
        impactLevel: "medium",
        riskLevel: "low",
        dueAt: null,
        draftPayload: {
          tool: "gmail",
          operation: "review_message",
          messageId: message.id,
          threadId: message.threadId,
          from: headers.from,
          subject,
        },
      },
    };
  });
}

async function fetchCalendarSources(): Promise<ConnectorSource[]> {
  const accessToken = await googleAccessToken();
  const timeMin = encodeURIComponent(new Date().toISOString());
  const data = await googleApi<{
    items?: Array<{
      id?: string;
      htmlLink?: string;
      summary?: string;
      start?: { dateTime?: string; date?: string };
      attendees?: Array<{ email?: string }>;
    }>;
  }>(
    `https://www.googleapis.com/calendar/v3/calendars/primary/events?singleEvents=true&orderBy=startTime&timeMin=${timeMin}&maxResults=5`,
    accessToken,
  );

  return (data.items ?? []).filter((event) => event.id).map((event) => {
    const start = event.start?.dateTime ?? event.start?.date;
    const title = event.summary ?? "Calendar event";
    return {
      objectType: "calendar_event",
      externalId: event.id!,
      title,
      url: event.htmlLink ?? null,
      occurredAt: start ? new Date(start) : null,
      rawPayload: {
        id: event.id,
        summary: title,
        start,
        attendeeCount: event.attendees?.length ?? 0,
        url: event.htmlLink,
      },
      normalized: {
        summary: title,
        start,
      },
      action: {
        actionType: "meeting_prep",
        title: `Prepare for ${title}`,
        summary: start ? `Upcoming calendar event at ${start}` : title,
        reason: "The calendar connector found an upcoming event.",
        impactLevel: "medium",
        riskLevel: "low",
        dueAt: start ? new Date(start) : null,
        draftPayload: {
          tool: "calendar",
          operation: "prepare_meeting",
          eventId: event.id,
          title,
          start,
          url: event.htmlLink,
        },
      },
    };
  });
}

async function fetchLinearSources(): Promise<ConnectorSource[]> {
  const apiKey = requireEnv("LINEAR_API_KEY", "Linear");
  const data = await linearGraphql<{
    viewer?: {
      assignedIssues?: {
        nodes?: Array<{
          id: string;
          identifier: string;
          title: string;
          url: string;
          priority: number;
          updatedAt: string;
          state?: { name?: string };
        }>;
      };
    };
  }>(
    apiKey,
    `query HermesAssignedIssues {
      viewer {
        assignedIssues(first: 5) {
          nodes {
            id
            identifier
            title
            url
            priority
            updatedAt
            state { name }
          }
        }
      }
    }`,
  );

  return (data.viewer?.assignedIssues?.nodes ?? []).map((issue) => ({
    objectType: "linear_issue",
    externalId: issue.id,
    title: `${issue.identifier}: ${issue.title}`,
    url: issue.url,
    occurredAt: new Date(issue.updatedAt),
    rawPayload: {
      id: issue.id,
      identifier: issue.identifier,
      title: issue.title,
      state: issue.state?.name,
      priority: issue.priority,
      url: issue.url,
    },
    normalized: {
      summary: issue.title,
      identifier: issue.identifier,
      state: issue.state?.name,
    },
    action: {
      actionType: "linear_issue_review",
      title: `Review Linear issue ${issue.identifier}`,
      summary: issue.title,
      reason: "The Linear connector found an issue assigned to the authenticated user.",
      impactLevel: "medium",
      riskLevel: "low",
      dueAt: null,
      draftPayload: {
        tool: "linear",
        operation: "review_issue",
        identifier: issue.identifier,
        url: issue.url,
      },
    },
  }));
}

async function fetchSentrySources(): Promise<ConnectorSource[]> {
  const token = requireEnv("SENTRY_AUTH_TOKEN", "Sentry");
  const org = requireEnv("SENTRY_ORG", "Sentry");
  const project = process.env.SENTRY_PROJECT;
  const query = encodeURIComponent(
    project ? `is:unresolved project:${project}` : "is:unresolved",
  );
  const issues = await sentryApi<
    Array<{
      id: string;
      shortId: string;
      title: string;
      permalink: string;
      lastSeen: string;
      level: string;
      count: string;
    }>
  >(`/organizations/${encodeURIComponent(org)}/issues/?query=${query}&limit=5`, token);

  return issues.map((issue) => ({
    objectType: "sentry_issue",
    externalId: issue.id,
    title: `${issue.shortId}: ${issue.title}`,
    url: issue.permalink,
    occurredAt: new Date(issue.lastSeen),
    rawPayload: {
      id: issue.id,
      shortId: issue.shortId,
      title: issue.title,
      level: issue.level,
      count: issue.count,
      url: issue.permalink,
    },
    normalized: {
      summary: issue.title,
      shortId: issue.shortId,
      level: issue.level,
    },
    action: {
      actionType: "sentry_issue_review",
      title: `Investigate Sentry issue ${issue.shortId}`,
      summary: issue.title,
      reason: "The Sentry connector found an unresolved issue.",
      impactLevel: issue.level === "fatal" || issue.level === "error" ? "high" : "medium",
      riskLevel: "medium",
      dueAt: null,
      draftPayload: {
        tool: "sentry",
        operation: "review_issue",
        issueId: issue.id,
        shortId: issue.shortId,
        url: issue.permalink,
      },
    },
  }));
}

async function slackApi<T>(path: string, token: string): Promise<T> {
  const data = await fetchJson<T & { ok?: boolean; error?: string }>(
    `https://slack.com/api/${path}`,
    { headers: { Authorization: `Bearer ${token}` } },
    "Slack",
  );
  if (data.ok === false) throw new Error(`Slack API rejected request: ${data.error ?? "unknown"}`);
  return data;
}

async function githubApi<T>(path: string, token: string): Promise<T> {
  return fetchJson<T>(
    `https://api.github.com${path}`,
    {
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: "application/vnd.github+json",
        "X-GitHub-Api-Version": "2022-11-28",
        "User-Agent": "hermes-ai",
      },
    },
    "GitHub",
  );
}

async function googleAccessToken(): Promise<string> {
  const clientId = requireEnv("GOOGLE_CLIENT_ID", "Google");
  const clientSecret = requireEnv("GOOGLE_CLIENT_SECRET", "Google");
  const refreshToken = requireEnv("GOOGLE_REFRESH_TOKEN", "Google");
  const body = new URLSearchParams({
    client_id: clientId,
    client_secret: clientSecret,
    refresh_token: refreshToken,
    grant_type: "refresh_token",
  });
  const token = await fetchJson<{ access_token?: string }>(
    "https://oauth2.googleapis.com/token",
    {
      method: "POST",
      headers: { "content-type": "application/x-www-form-urlencoded" },
      body,
    },
    "Google",
  );
  if (!token.access_token) throw new Error("Google did not return an access token");
  return token.access_token;
}

async function googleApi<T>(url: string, accessToken: string): Promise<T> {
  return fetchJson<T>(
    url,
    { headers: { Authorization: `Bearer ${accessToken}` } },
    "Google",
  );
}

async function linearGraphql<T>(apiKey: string, query: string): Promise<T> {
  const data = await fetchJson<{ data?: T; errors?: unknown }>(
    "https://api.linear.app/graphql",
    {
      method: "POST",
      headers: {
        Authorization: apiKey,
        "content-type": "application/json",
      },
      body: JSON.stringify({ query }),
    },
    "Linear",
  );
  if (data.errors) throw new Error("Linear GraphQL returned errors");
  if (!data.data) throw new Error("Linear GraphQL returned no data");
  return data.data;
}

async function sentryApi<T>(path: string, token: string): Promise<T> {
  return fetchJson<T>(
    `https://sentry.io/api/0${path}`,
    { headers: { Authorization: `Bearer ${token}` } },
    "Sentry",
  );
}

async function fetchJson<T>(
  url: string,
  init: RequestInit,
  provider: string,
): Promise<T> {
  const res = await fetch(url, init);
  if (!res.ok) throw new Error(`${provider} API request failed with ${res.status}`);
  return (await res.json()) as T;
}

function requireEnv(key: string, provider: string): string {
  const value = process.env[key];
  if (!value) throw new ConnectorConfigurationError(`${provider} env is not configured`);
  return value;
}

interface GmailMessage {
  id: string;
  threadId?: string;
  snippet?: string;
  payload?: {
    headers?: Array<{ name?: string; value?: string }>;
  };
}

function gmailHeaders(message: GmailMessage): Record<string, string> {
  const out: Record<string, string> = {};
  for (const header of message.payload?.headers ?? []) {
    if (header.name && header.value) out[header.name.toLowerCase()] = header.value;
  }
  return out;
}

async function getSignalByIdempotencyKey(
  workspaceId: string,
  idempotencyKey: string,
): Promise<SignalRow> {
  const rows = await prisma.$queryRaw<SignalRow[]>`
    SELECT
      id::text AS "id",
      workspace_id::text AS "workspaceId",
      signal_type AS "signalType",
      title,
      summary,
      source_ids AS "sourceIds",
      confidence,
      status,
      idempotency_key AS "idempotencyKey",
      created_at AS "createdAt",
      updated_at AS "updatedAt"
    FROM signals
    WHERE workspace_id = ${workspaceId}::uuid
      AND idempotency_key = ${idempotencyKey}
    LIMIT 1
  `;
  return firstRow(rows, "signal");
}

async function getActionByIdempotencyKey(
  workspaceId: string,
  idempotencyKey: string,
): Promise<ActionRow> {
  const rows = await prisma.$queryRaw<ActionRow[]>`
    SELECT
      id::text AS "id",
      workspace_id::text AS "workspaceId",
      action_type AS "actionType",
      title,
      summary,
      status,
      due_at AS "dueAt",
      created_at AS "createdAt",
      updated_at AS "updatedAt"
    FROM action_items
    WHERE workspace_id = ${workspaceId}::uuid
      AND idempotency_key = ${idempotencyKey}
    LIMIT 1
  `;
  return firstRow(rows, "action");
}

function toSourceObjectResponse(row: SourceObjectRow) {
  const normalized = isRecord(row.normalized) ? row.normalized : {};
  return {
    id: row.id,
    workspaceId: row.workspaceId,
    provider: row.provider,
    objectType: row.objectType,
    externalId: row.externalId,
    title: row.title,
    url: row.url,
    summary: typeof normalized.summary === "string" ? normalized.summary : null,
    occurredAt: row.occurredAt?.toISOString() ?? null,
    lastObservedAt: row.lastObservedAt.toISOString(),
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

function toSyncRunResponse(row: SyncRunRow) {
  return {
    id: row.id,
    workspaceId: row.workspaceId,
    provider: row.provider,
    syncType: row.syncType,
    status: row.status,
    objectsSeen: row.objectsSeen,
    objectsChanged: row.objectsChanged,
    failureReason: row.failureReason ? "Sync failed." : null,
    startedAt: row.startedAt.toISOString(),
    completedAt: row.completedAt?.toISOString() ?? null,
  };
}

function toActionSummaryResponse(row: ActionRow) {
  return {
    id: row.id,
    workspaceId: row.workspaceId,
    actionType: row.actionType,
    title: row.title,
    summary: row.summary,
    status: row.status,
    dueAt: row.dueAt?.toISOString() ?? null,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

function firstRow<T>(rows: T[], label: string): T {
  const row = rows[0];
  if (!row) throw new Error(`database did not return a ${label}`);
  return row;
}

function toJson(value: unknown): string {
  return JSON.stringify(value ?? {});
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === "object" && !Array.isArray(value);
}
