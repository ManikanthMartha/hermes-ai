import { createHash, randomUUID } from "node:crypto";
import { generateObject } from "ai";
import { z } from "zod";
import {
  audit,
  createIdempotencyKey,
  ensureDefaultWorkspace,
  logger,
  prisma,
  recordFailure,
  upsertIntegrationHealth,
  getProviderCredential,
  type WorkspaceContext,
} from "@hermes/shared";
import { models } from "@hermes/shared/llm";

const CALENDAR_ID = process.env.GOOGLE_CALENDAR_ID ?? "primary";
const CALENDAR_LOOKAHEAD_DAYS = parsePositiveInt(
  process.env.CALENDAR_LOOKAHEAD_DAYS,
  14,
);
const SLACK_LOOKBACK_DAYS = parsePositiveInt(
  process.env.SLACK_SEARCH_LOOKBACK_DAYS,
  30,
);
const INCLUDE_PRIVATE = process.env.CALENDAR_INCLUDE_PRIVATE === "true";

interface CalendarEvent {
  id?: string;
  status?: string;
  summary?: string;
  description?: string;
  location?: string;
  htmlLink?: string;
  hangoutLink?: string;
  conferenceData?: {
    entryPoints?: Array<{ entryPointType?: string; uri?: string }>;
  };
  start?: { dateTime?: string; date?: string; timeZone?: string };
  end?: { dateTime?: string; date?: string; timeZone?: string };
  organizer?: { email?: string; displayName?: string; self?: boolean };
  attendees?: Array<{
    email?: string;
    displayName?: string;
    responseStatus?: string;
    optional?: boolean;
  }>;
  visibility?: string;
  updated?: string;
  created?: string;
}

interface CalendarEventsResponse {
  items?: CalendarEvent[];
  nextPageToken?: string;
  nextSyncToken?: string;
}

interface CalendarSyncStateRow {
  id: string;
  workspaceId: string;
  calendarId: string;
  syncToken: string | null;
  watchChannelId: string | null;
  watchResourceId: string | null;
  watchResourceUri: string | null;
  watchTokenHash: string | null;
  watchExpiresAt: Date | null;
  lastSyncedAt: Date | null;
}

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

interface MeetingRow {
  id: string;
  workspaceId: string;
  calendarSourceObjectId: string | null;
  providerEventId: string;
  title: string;
  description: string | null;
  organizerEmail: string | null;
  attendeeEmails: string[];
  location: string | null;
  meetingUrl: string | null;
  htmlLink: string | null;
  startAt: Date;
  endAt: Date | null;
  status: string;
  prepStatus: string;
  lastPreparedAt: Date | null;
  metadata: unknown;
  createdAt: Date;
  updatedAt: Date;
}

interface MeetingBriefRow {
  id: string;
  workspaceId: string;
  meetingId: string;
  status: string;
  summary: string | null;
  agenda: unknown;
  openQuestions: unknown;
  risks: unknown;
  followUps: unknown;
  sourceIds: string[];
  slackQueries: unknown;
  content: unknown;
  createdAt: Date;
  updatedAt: Date;
}

interface SlackMatch {
  ts?: string;
  date?: string;
  user?: string;
  username?: string;
  channel?: string;
  text?: string;
  permalink?: string;
}

const prepSchema = z.object({
  summary: z.string(),
  agenda: z.array(z.string()).default([]),
  openQuestions: z.array(z.string()).default([]),
  risks: z.array(z.string()).default([]),
  followUps: z.array(z.string()).default([]),
  peopleContext: z.array(z.string()).default([]),
  sourceNotes: z.array(z.string()).default([]),
});

export async function syncGoogleCalendar(
  input: Partial<WorkspaceContext> & { trigger?: string } = {},
) {
  const { workspaceId, userId } = await ensureDefaultWorkspace(input);
  const trigger = input.trigger ?? "manual";
  const startedAt = new Date();
  const syncRunId = randomUUID();
  const state = await ensureCalendarSyncState(workspaceId);

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
      'calendar',
      'calendar_webhook',
      'running',
      0,
      0,
      ${startedAt},
      ${toJson({ trigger, calendarId: CALENDAR_ID })}::jsonb
    )
  `;

  try {
    const accessToken = await googleAccessToken(workspaceId);
    const response = await fetchCalendarEvents(
      accessToken,
      state.syncToken,
      workspaceId,
    );
    const events = response.items ?? [];
    let changed = 0;
    const meetings = [];

    for (const event of events) {
      if (!event.id || shouldSkipEvent(event)) continue;
      const source = await upsertCalendarSourceObject(workspaceId, event);
      changed += source.changed ? 1 : 0;

      if (event.status === "cancelled") {
        await markMeetingCancelled(workspaceId, event.id);
        continue;
      }

      const meeting = await upsertMeeting(workspaceId, source.row, event);
      await upsertMeetingPrepAction(workspaceId, userId, source.row, meeting);
      meetings.push(toMeetingResponse(meeting));
    }

    if (response.nextSyncToken) {
      await prisma.$executeRaw`
        UPDATE calendar_sync_states
        SET sync_token = ${response.nextSyncToken},
            last_synced_at = now(),
            updated_at = now()
        WHERE workspace_id = ${workspaceId}::uuid
          AND calendar_id = ${CALENDAR_ID}
      `;
    }

    const rows = await prisma.$queryRaw<
      Array<{
        id: string;
        objectsSeen: number;
        objectsChanged: number;
        completedAt: Date;
      }>
    >`
      UPDATE sync_runs
      SET status = 'completed',
          objects_seen = ${events.length},
          objects_changed = ${changed},
          completed_at = now(),
          metadata = ${toJson({
            trigger,
            calendarId: CALENDAR_ID,
            nextSyncTokenStored: Boolean(response.nextSyncToken),
          })}::jsonb
      WHERE id = ${syncRunId}::uuid
      RETURNING
        id::text AS "id",
        objects_seen AS "objectsSeen",
        objects_changed AS "objectsChanged",
        completed_at AS "completedAt"
    `;

    await upsertIntegrationHealth({
      workspaceId,
      userId,
      provider: "calendar",
      status: "connected",
      scopes: ["calendar.readonly"],
      config: { developerConfigured: true, connectorMode: "env" },
      lastSuccessfulSync: new Date(),
      lastAttemptedSync: startedAt,
      failureReason: null,
    });

    await audit({
      workspaceId,
      actorType: trigger === "webhook" ? "system" : "user",
      actorId: trigger === "manual" ? userId : undefined,
      eventType: "sync.completed",
      objectType: "sync_run",
      objectId: syncRunId,
      sourceIds: meetings
        .map((meeting) => meeting.calendarSourceObjectId)
        .filter((sourceId): sourceId is string => Boolean(sourceId)),
      afterState: {
        provider: "calendar",
        trigger,
        objectsSeen: events.length,
        objectsChanged: changed,
        meetingsChanged: meetings.length,
      },
    });

    return {
      syncRun: rows[0] ?? null,
      meetings,
      objectsSeen: events.length,
      objectsChanged: changed,
    };
  } catch (err) {
    await prisma.$executeRaw`
      UPDATE sync_runs
      SET status = 'failed',
          failure_reason = 'Calendar sync failed.',
          completed_at = now(),
          metadata = ${toJson({ trigger, calendarId: CALENDAR_ID })}::jsonb
      WHERE id = ${syncRunId}::uuid
    `;

    await upsertIntegrationHealth({
      workspaceId,
      userId,
      provider: "calendar",
      status: "error",
      scopes: [],
      config: { developerConfigured: hasGoogleEnv(), connectorMode: "env" },
      lastAttemptedSync: startedAt,
      failureReason: "Calendar sync failed.",
    });

    await recordFailure({
      workspaceId,
      severity: "medium",
      source: "connector.calendar",
      eventType: "sync.failed",
      objectType: "sync_run",
      objectId: syncRunId,
      message: "Calendar sync failed.",
      details: { trigger, calendarId: CALENDAR_ID },
    });

    logger.error({ err, trigger }, "calendar sync failed");
    throw err;
  }
}

export async function startGoogleCalendarWatch(context: WorkspaceContext) {
  const { workspaceId, userId } = await ensureDefaultWorkspace(context);
  const webhookUrl = process.env.CALENDAR_WEBHOOK_URL;
  if (!webhookUrl) {
    throw new ClientInputError(400, "CALENDAR_WEBHOOK_URL is required");
  }
  if (!webhookUrl.startsWith("https://")) {
    throw new ClientInputError(400, "CALENDAR_WEBHOOK_URL must be HTTPS");
  }

  await syncGoogleCalendar({ trigger: "watch_start" });

  const accessToken = await googleAccessToken(workspaceId);
  const channelId = randomUUID();
  const token = process.env.CALENDAR_WEBHOOK_TOKEN ?? randomUUID();
  const ttlSeconds = parsePositiveInt(process.env.CALENDAR_WATCH_TTL_SECONDS, 604800);
  const response = await googleApi<{
    id: string;
    resourceId?: string;
    resourceUri?: string;
    expiration?: string | number;
  }>(
    `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(
      CALENDAR_ID,
    )}/events/watch`,
    accessToken,
    {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        id: channelId,
        type: "web_hook",
        address: webhookUrl,
        token,
        params: { ttl: String(ttlSeconds) },
      }),
    },
  );

  const expiresAt = response.expiration
    ? new Date(Number(response.expiration))
    : null;

  await prisma.$executeRaw`
    UPDATE calendar_sync_states
    SET watch_channel_id = ${response.id},
        watch_resource_id = ${response.resourceId ?? null},
        watch_resource_uri = ${response.resourceUri ?? null},
        watch_token_hash = ${hashToken(token)},
        watch_expires_at = ${expiresAt},
        metadata = ${toJson({ webhookUrl, ttlSeconds })}::jsonb,
        updated_at = now()
    WHERE workspace_id = ${workspaceId}::uuid
      AND calendar_id = ${CALENDAR_ID}
  `;

  await audit({
    workspaceId,
    actorType: "user",
    actorId: userId,
    eventType: "integration.connected",
    objectType: "calendar_watch",
    objectId: response.id,
    afterState: {
      calendarId: CALENDAR_ID,
      resourceId: response.resourceId,
      expiresAt: expiresAt?.toISOString() ?? null,
    },
  });

  return {
    calendarId: CALENDAR_ID,
    channelId: response.id,
    resourceId: response.resourceId ?? null,
    expiresAt: expiresAt?.toISOString() ?? null,
  };
}

export async function handleGoogleCalendarWebhook(input: {
  channelId?: string;
  channelToken?: string;
  resourceState?: string;
  messageNumber?: string;
}) {
  throw new ClientInputError(
    410,
    "Google Calendar webhooks are disabled in user-scoped mode. Use authenticated manual sync or polling.",
  );
  /*
  if (!input.channelId) {
    throw new ClientInputError(400, "missing Google channel id");
  }

  const states = await prisma.$queryRaw<CalendarSyncStateRow[]>`
    SELECT
      id::text AS "id",
      workspace_id::text AS "workspaceId",
      calendar_id AS "calendarId",
      sync_token AS "syncToken",
      watch_channel_id AS "watchChannelId",
      watch_resource_id AS "watchResourceId",
      watch_resource_uri AS "watchResourceUri",
      watch_token_hash AS "watchTokenHash",
      watch_expires_at AS "watchExpiresAt",
      last_synced_at AS "lastSyncedAt"
    FROM calendar_sync_states
    WHERE workspace_id = ${workspaceId}::uuid
      AND watch_channel_id = ${input.channelId}
    LIMIT 1
  `;

  const state = states[0];
  if (!state) throw new ClientInputError(404, "calendar watch channel not found");
  if (
    state.watchTokenHash &&
    (!input.channelToken || hashToken(input.channelToken) !== state.watchTokenHash)
  ) {
    throw new ClientInputError(403, "invalid Google channel token");
  }

  await audit({
    workspaceId,
    actorType: "system",
    eventType: "calendar.webhook.received",
    objectType: "calendar_watch",
    objectId: input.channelId,
    afterState: {
      resourceState: input.resourceState,
      messageNumber: input.messageNumber,
    },
  });

  if (input.resourceState === "sync") {
    return { accepted: true, synced: false, reason: "watch initialized" };
  }

  const result = await syncGoogleCalendar({ trigger: "webhook" });
  return { accepted: true, synced: true, result };
  */
}

export async function listMeetings(
  input: Partial<WorkspaceContext> & { limit?: number } = {},
) {
  const { workspaceId } = await ensureDefaultWorkspace(input);
  const limit = Math.max(1, Math.min(input.limit ?? 50, 100));
  const rows = await prisma.$queryRaw<MeetingRow[]>`
    SELECT
      id::text AS "id",
      workspace_id::text AS "workspaceId",
      calendar_source_object_id::text AS "calendarSourceObjectId",
      provider_event_id AS "providerEventId",
      title,
      description,
      organizer_email AS "organizerEmail",
      attendee_emails AS "attendeeEmails",
      location,
      meeting_url AS "meetingUrl",
      html_link AS "htmlLink",
      start_at AS "startAt",
      end_at AS "endAt",
      status,
      prep_status AS "prepStatus",
      last_prepared_at AS "lastPreparedAt",
      metadata,
      created_at AS "createdAt",
      updated_at AS "updatedAt"
    FROM meetings
    WHERE workspace_id = ${workspaceId}::uuid
      AND status <> 'cancelled'
    ORDER BY start_at ASC
    LIMIT ${limit}
  `;
  const meetingIds = rows.map((row) => row.id);
  const briefs = await latestBriefsByMeeting(workspaceId, meetingIds);
  return rows.map((meeting) => ({
    ...toMeetingResponse(meeting),
    latestBrief: briefs.get(meeting.id) ?? null,
  }));
}

export async function getMeeting(id: string, context: WorkspaceContext) {
  const { workspaceId } = await ensureDefaultWorkspace(context);
  const rows = await prisma.$queryRaw<MeetingRow[]>`
    SELECT
      id::text AS "id",
      workspace_id::text AS "workspaceId",
      calendar_source_object_id::text AS "calendarSourceObjectId",
      provider_event_id AS "providerEventId",
      title,
      description,
      organizer_email AS "organizerEmail",
      attendee_emails AS "attendeeEmails",
      location,
      meeting_url AS "meetingUrl",
      html_link AS "htmlLink",
      start_at AS "startAt",
      end_at AS "endAt",
      status,
      prep_status AS "prepStatus",
      last_prepared_at AS "lastPreparedAt",
      metadata,
      created_at AS "createdAt",
      updated_at AS "updatedAt"
    FROM meetings
    WHERE workspace_id = ${workspaceId}::uuid
      AND id = ${id}::uuid
    LIMIT 1
  `;
  const meeting = rows[0];
  if (!meeting) return null;
  const briefs = await latestBriefsByMeeting(workspaceId, [meeting.id]);
  return {
    ...toMeetingResponse(meeting),
    latestBrief: briefs.get(meeting.id) ?? null,
  };
}

export async function prepareMeeting(id: string, context: WorkspaceContext) {
  const { workspaceId } = await ensureDefaultWorkspace(context);
  const rows = await prisma.$queryRaw<MeetingRow[]>`
    SELECT
      id::text AS "id",
      workspace_id::text AS "workspaceId",
      calendar_source_object_id::text AS "calendarSourceObjectId",
      provider_event_id AS "providerEventId",
      title,
      description,
      organizer_email AS "organizerEmail",
      attendee_emails AS "attendeeEmails",
      location,
      meeting_url AS "meetingUrl",
      html_link AS "htmlLink",
      start_at AS "startAt",
      end_at AS "endAt",
      status,
      prep_status AS "prepStatus",
      last_prepared_at AS "lastPreparedAt",
      metadata,
      created_at AS "createdAt",
      updated_at AS "updatedAt"
    FROM meetings
    WHERE workspace_id = ${workspaceId}::uuid
      AND id = ${id}::uuid
    LIMIT 1
  `;
  const meeting = rows[0];
  if (!meeting) throw new ClientInputError(404, "meeting not found");

  await prisma.$executeRaw`
    UPDATE meetings
    SET prep_status = 'preparing',
        updated_at = now()
    WHERE workspace_id = ${workspaceId}::uuid
      AND id = ${id}::uuid
  `;

  try {
    const queries = buildSlackQueries(meeting);
    const slackMatches = await searchSlackForMeeting(queries, workspaceId);
    const slackSources = [];
    for (const match of slackMatches) {
      const source = await upsertSlackSourceObject(workspaceId, match, meeting);
      slackSources.push(source.row);
    }

    const sourceIds = [
      meeting.calendarSourceObjectId,
      ...slackSources.map((source) => source.id),
    ].filter((value): value is string => Boolean(value));

    const brief = await generateMeetingBrief(meeting, slackMatches);
    const briefRow = await insertMeetingBrief(
      workspaceId,
      meeting,
      brief,
      sourceIds,
      queries,
      slackMatches,
    );

    await prisma.$executeRaw`
      UPDATE meetings
      SET prep_status = 'prepared',
          last_prepared_at = now(),
          updated_at = now()
      WHERE workspace_id = ${workspaceId}::uuid
        AND id = ${meeting.id}::uuid
    `;

    await audit({
      workspaceId,
      actorType: "agent",
      eventType: "meeting.prepared",
      objectType: "meeting",
      objectId: meeting.id,
      sourceIds,
      afterState: {
        meetingId: meeting.id,
        slackMatches: slackMatches.length,
        sourceCount: sourceIds.length,
      },
    });

    return toMeetingBriefResponse(briefRow);
  } catch (err) {
    await prisma.$executeRaw`
      UPDATE meetings
      SET prep_status = 'failed',
          updated_at = now()
      WHERE workspace_id = ${workspaceId}::uuid
        AND id = ${meeting.id}::uuid
    `;
    await recordFailure({
      workspaceId,
      severity: "medium",
      source: "meeting_prep",
      eventType: "meeting.prep_failed",
      objectType: "meeting",
      objectId: meeting.id,
      message: "Meeting prep failed.",
      details: { meetingId: meeting.id },
    });
    throw err;
  }
}

async function fetchCalendarEvents(
  accessToken: string,
  syncToken: string | null,
  workspaceId: string,
): Promise<CalendarEventsResponse> {
  const params = new URLSearchParams({
    maxResults: "250",
    showDeleted: "true",
    singleEvents: "true",
  });

  if (syncToken) {
    params.set("syncToken", syncToken);
  } else {
    const timeMin = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    const timeMax = new Date(
      Date.now() + CALENDAR_LOOKAHEAD_DAYS * 24 * 60 * 60 * 1000,
    ).toISOString();
    params.set("timeMin", timeMin);
    params.set("timeMax", timeMax);
    params.set("orderBy", "startTime");
  }

  try {
    return await googleApi<CalendarEventsResponse>(
      `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(
        CALENDAR_ID,
      )}/events?${params.toString()}`,
      accessToken,
    );
  } catch (err) {
    if (syncToken && isGoogleGone(err)) {
      await clearCalendarSyncToken(workspaceId);
      return fetchCalendarEvents(accessToken, null, workspaceId);
    }
    throw err;
  }
}

async function ensureCalendarSyncState(
  workspaceId: string,
): Promise<CalendarSyncStateRow> {
  const rows = await prisma.$queryRaw<CalendarSyncStateRow[]>`
    INSERT INTO calendar_sync_states (
      id,
      workspace_id,
      calendar_id,
      created_at,
      updated_at
    )
    VALUES (
      ${randomUUID()}::uuid,
      ${workspaceId}::uuid,
      ${CALENDAR_ID},
      now(),
      now()
    )
    ON CONFLICT (workspace_id, calendar_id) DO UPDATE
    SET updated_at = calendar_sync_states.updated_at
    RETURNING
      id::text AS "id",
      workspace_id::text AS "workspaceId",
      calendar_id AS "calendarId",
      sync_token AS "syncToken",
      watch_channel_id AS "watchChannelId",
      watch_resource_id AS "watchResourceId",
      watch_resource_uri AS "watchResourceUri",
      watch_token_hash AS "watchTokenHash",
      watch_expires_at AS "watchExpiresAt",
      last_synced_at AS "lastSyncedAt"
  `;
  return first(rows, "calendar sync state");
}

async function clearCalendarSyncToken(workspaceId: string) {
  await prisma.$executeRaw`
    UPDATE calendar_sync_states
    SET sync_token = null,
        updated_at = now()
    WHERE workspace_id = ${workspaceId}::uuid
      AND calendar_id = ${CALENDAR_ID}
  `;
}

async function upsertCalendarSourceObject(
  workspaceId: string,
  event: CalendarEvent,
) {
  const normalized = normalizeCalendarEvent(event);
  const contentHash = createIdempotencyKey([
    workspaceId,
    "calendar",
    "calendar_event",
    event.id,
    normalized,
  ]);
  const existing = await prisma.$queryRaw<Array<{ contentHash: string | null }>>`
    SELECT content_hash AS "contentHash"
    FROM source_objects
    WHERE workspace_id = ${workspaceId}::uuid
      AND provider = 'calendar'
      AND object_type = 'calendar_event'
      AND external_id = ${event.id}
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
      'calendar',
      'calendar_event',
      ${event.id},
      ${normalized.title},
      ${normalized.htmlLink ?? normalized.meetingUrl ?? null},
      ${normalized.organizerEmail ?? null},
      ${normalized.startAt ? new Date(normalized.startAt) : null},
      ${toJson(event)}::jsonb,
      ${toJson(normalized)}::jsonb,
      ${contentHash},
      now(),
      ${toJson({ calendarId: CALENDAR_ID })}::jsonb,
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
  return { row: first(rows, "calendar source object"), changed };
}

async function upsertSlackSourceObject(
  workspaceId: string,
  match: SlackMatch,
  meeting: MeetingRow,
) {
  const externalId = match.permalink ?? `${match.channel ?? "unknown"}:${match.ts}`;
  const normalized = {
    summary: match.text,
    channel: match.channel,
    username: match.username,
    user: match.user,
    ts: match.ts,
    date: match.date,
    permalink: match.permalink,
  };
  const contentHash = createIdempotencyKey([workspaceId, "slack", externalId, normalized]);
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
      'slack',
      'slack_message',
      ${externalId},
      ${match.channel ? `Slack ${match.channel}` : "Slack message"},
      ${match.permalink ?? null},
      ${match.user ?? match.username ?? null},
      ${match.date ? new Date(match.date) : null},
      ${toJson(match)}::jsonb,
      ${toJson(normalized)}::jsonb,
      ${contentHash},
      now(),
      ${toJson({ meetingId: meeting.id, relation: "meeting_prep" })}::jsonb,
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
  return { row: first(rows, "slack source object") };
}

async function upsertMeeting(
  workspaceId: string,
  sourceObject: SourceObjectRow,
  event: CalendarEvent,
) {
  const normalized = normalizeCalendarEvent(event);
  if (!normalized.startAt) {
    throw new Error("calendar event has no start time");
  }
  const rows = await prisma.$queryRaw<MeetingRow[]>`
    INSERT INTO meetings (
      id,
      workspace_id,
      calendar_source_object_id,
      provider_event_id,
      title,
      description,
      organizer_email,
      attendee_emails,
      location,
      meeting_url,
      html_link,
      start_at,
      end_at,
      status,
      metadata,
      created_at,
      updated_at
    )
    VALUES (
      ${randomUUID()}::uuid,
      ${workspaceId}::uuid,
      ${sourceObject.id}::uuid,
      ${event.id},
      ${normalized.title},
      ${normalized.description ?? null},
      ${normalized.organizerEmail ?? null},
      ${normalized.attendeeEmails},
      ${normalized.location ?? null},
      ${normalized.meetingUrl ?? null},
      ${normalized.htmlLink ?? null},
      ${new Date(normalized.startAt)},
      ${normalized.endAt ? new Date(normalized.endAt) : null},
      ${normalized.status ?? "confirmed"},
      ${toJson({
        attendeeNames: normalized.attendeeNames,
        calendarId: CALENDAR_ID,
        visibility: event.visibility,
      })}::jsonb,
      now(),
      now()
    )
    ON CONFLICT (workspace_id, provider_event_id) DO UPDATE
    SET calendar_source_object_id = EXCLUDED.calendar_source_object_id,
        title = EXCLUDED.title,
        description = EXCLUDED.description,
        organizer_email = EXCLUDED.organizer_email,
        attendee_emails = EXCLUDED.attendee_emails,
        location = EXCLUDED.location,
        meeting_url = EXCLUDED.meeting_url,
        html_link = EXCLUDED.html_link,
        start_at = EXCLUDED.start_at,
        end_at = EXCLUDED.end_at,
        status = EXCLUDED.status,
        metadata = EXCLUDED.metadata,
        updated_at = now()
    RETURNING
      id::text AS "id",
      workspace_id::text AS "workspaceId",
      calendar_source_object_id::text AS "calendarSourceObjectId",
      provider_event_id AS "providerEventId",
      title,
      description,
      organizer_email AS "organizerEmail",
      attendee_emails AS "attendeeEmails",
      location,
      meeting_url AS "meetingUrl",
      html_link AS "htmlLink",
      start_at AS "startAt",
      end_at AS "endAt",
      status,
      prep_status AS "prepStatus",
      last_prepared_at AS "lastPreparedAt",
      metadata,
      created_at AS "createdAt",
      updated_at AS "updatedAt"
  `;
  return first(rows, "meeting");
}

async function markMeetingCancelled(workspaceId: string, eventId: string) {
  await prisma.$executeRaw`
    UPDATE meetings
    SET status = 'cancelled',
        updated_at = now()
    WHERE workspace_id = ${workspaceId}::uuid
      AND provider_event_id = ${eventId}
  `;
}

async function upsertMeetingPrepAction(
  workspaceId: string,
  userId: string,
  sourceObject: SourceObjectRow,
  meeting: MeetingRow,
) {
  const idempotencyKey = createIdempotencyKey([
    workspaceId,
    "meeting_prep",
    meeting.providerEventId,
  ]);
  await prisma.$executeRaw`
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
      idempotency_key,
      metadata,
      created_at,
      updated_at
    )
    VALUES (
      ${randomUUID()}::uuid,
      ${workspaceId}::uuid,
      ${userId},
      'meeting_prep',
      ${`Prepare for ${meeting.title}`},
      ${`Meeting starts ${meeting.startAt.toISOString()}`},
      'Google Calendar found an upcoming event. Hermes should prepare it with related Slack context.',
      'medium',
      'low',
      0.8,
      ${[sourceObject.id]},
      ${toJson({
        tool: "calendar",
        operation: "prepare_meeting",
        meetingId: meeting.id,
        providerEventId: meeting.providerEventId,
      })}::jsonb,
      true,
      'pending_approval',
      ${meeting.startAt},
      ${idempotencyKey},
      ${toJson({ provider: "calendar", meetingId: meeting.id })}::jsonb,
      now(),
      now()
    )
    ON CONFLICT (workspace_id, idempotency_key) DO UPDATE
    SET title = EXCLUDED.title,
        summary = EXCLUDED.summary,
        source_ids = EXCLUDED.source_ids,
        draft_payload = EXCLUDED.draft_payload,
        due_at = EXCLUDED.due_at,
        updated_at = now()
  `;
}

function normalizeCalendarEvent(event: CalendarEvent) {
  const start = event.start?.dateTime ?? event.start?.date ?? null;
  const end = event.end?.dateTime ?? event.end?.date ?? null;
  return {
    title: event.summary ?? "(untitled meeting)",
    summary: event.description ?? event.summary ?? "(untitled meeting)",
    description: event.description ?? null,
    status: event.status ?? "confirmed",
    location: event.location ?? null,
    htmlLink: event.htmlLink ?? null,
    meetingUrl: event.hangoutLink ?? googleMeetLink(event) ?? null,
    startAt: start,
    endAt: end,
    organizerEmail: event.organizer?.email ?? null,
    attendeeEmails: (event.attendees ?? [])
      .map((attendee) => attendee.email)
      .filter((email): email is string => Boolean(email)),
    attendeeNames: (event.attendees ?? [])
      .map((attendee) => attendee.displayName)
      .filter((name): name is string => Boolean(name)),
    updated: event.updated ?? null,
    created: event.created ?? null,
  };
}

function googleMeetLink(event: CalendarEvent): string | undefined {
  return event.conferenceData?.entryPoints?.find(
    (entry) => entry.entryPointType === "video" && entry.uri,
  )?.uri;
}

function shouldSkipEvent(event: CalendarEvent): boolean {
  if (event.visibility === "private" && !INCLUDE_PRIVATE) return true;
  if (!event.start?.dateTime && !event.start?.date) return true;
  return false;
}

function buildSlackQueries(meeting: MeetingRow): string[] {
  const after = new Date(
    Date.now() - SLACK_LOOKBACK_DAYS * 24 * 60 * 60 * 1000,
  )
    .toISOString()
    .slice(0, 10);
  const terms = extractTerms(
    [meeting.title, meeting.description ?? "", meeting.organizerEmail ?? ""].join(
      " ",
    ),
  );
  const people = meeting.attendeeEmails
    .map((email) => email.split("@")[0] ?? "")
    .map((name) => name.replace(/[._-]/g, " "))
    .flatMap(extractTerms)
    .slice(0, 6);

  const queries = new Set<string>();
  if (terms.length) queries.add(`${terms.slice(0, 5).join(" ")} after:${after}`);
  if (terms.length && people.length) {
    queries.add(`${terms.slice(0, 3).join(" ")} ${people.slice(0, 4).join(" ")} after:${after}`);
  }
  for (const email of meeting.attendeeEmails.slice(0, 4)) {
    queries.add(`${email} after:${after}`);
  }
  for (const term of terms.slice(0, 4)) {
    queries.add(`${term} after:${after}`);
  }

  return [...queries].filter((query) => query.trim().length > 0).slice(0, 6);
}

async function searchSlackForMeeting(
  queries: string[],
  workspaceId: string,
): Promise<SlackMatch[]> {
  const slackCredential = await getProviderCredential("slack", workspaceId);
  const slackToken =
    slackCredential?.accessToken ?? slackCredential?.botAccessToken ?? null;
  if (slackToken) {
    return searchSlackApiForMeeting(queries, slackToken);
  }

  throw new Error("Slack is not connected for this workspace");
}

async function searchSlackApiForMeeting(
  queries: string[],
  accessToken: string,
): Promise<SlackMatch[]> {
  const seen = new Set<string>();
  const matches: SlackMatch[] = [];

  for (const query of queries) {
    const params = new URLSearchParams({
      query,
      count: "10",
      sort: "timestamp",
      sort_dir: "desc",
    });
    const res = await fetch(`https://slack.com/api/search.messages?${params}`, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    if (!res.ok) {
      throw new Error(`Slack search failed with ${res.status}`);
    }
    const data = (await res.json()) as {
      ok?: boolean;
      error?: string;
      messages?: {
        matches?: Array<{
          ts?: string;
          channel?: { id?: string; name?: string };
          user?: string;
          username?: string;
          text?: string;
          permalink?: string;
        }>;
      };
    };
    if (data.ok === false) {
      throw new Error(`Slack search rejected request: ${data.error ?? "unknown"}`);
    }

    for (const match of data.messages?.matches ?? []) {
      const key = match.permalink ?? `${match.channel?.id ?? match.channel?.name}:${match.ts}`;
      if (!key || seen.has(key)) continue;
      seen.add(key);
      matches.push({
        ts: match.ts,
        channel: match.channel?.name ?? match.channel?.id,
        user: match.user,
        username: match.username,
        text: match.text,
        permalink: match.permalink,
        date: match.ts ? new Date(Number(match.ts.split(".")[0]) * 1000).toISOString() : undefined,
      });
    }
  }

  return matches.slice(0, 20);
}

async function generateMeetingBrief(
  meeting: MeetingRow,
  slackMatches: SlackMatch[],
): Promise<z.infer<typeof prepSchema>> {
  const sourceText = slackMatches
    .slice(0, 15)
    .map(
      (match, index) =>
        `[S${index + 1}] ${match.date ?? ""} ${match.channel ?? ""} ${match.username ?? match.user ?? ""}: ${match.text ?? ""}`,
    )
    .join("\n");

  try {
    const result = await generateObject({
      model: models.standard,
      schema: prepSchema,
      prompt: `Generate a concise meeting prep brief from the calendar event and Slack evidence.

Calendar event:
Title: ${meeting.title}
Start: ${meeting.startAt.toISOString()}
Organizer: ${meeting.organizerEmail ?? "unknown"}
Attendees: ${meeting.attendeeEmails.join(", ") || "unknown"}
Description: ${meeting.description ?? "none"}

Slack evidence:
${sourceText || "No related Slack messages found."}

Rules:
- Do not invent facts beyond the provided calendar and Slack evidence.
- If evidence is thin, say what is missing.
- Keep agenda and follow-ups actionable.
- Mention source labels like S1, S2 only in sourceNotes.`,
    });
    return result.object;
  } catch (err) {
    logger.warn({ err }, "LLM meeting prep failed; using fallback brief");
    return {
      summary: slackMatches.length
        ? `Found ${slackMatches.length} related Slack messages for ${meeting.title}.`
        : `No related Slack messages were found for ${meeting.title}.`,
      agenda: ["Confirm meeting objective", "Review recent Slack context", "Agree next steps"],
      openQuestions: slackMatches.length ? [] : ["Which Slack channels or threads contain the relevant context?"],
      risks: [],
      followUps: [],
      peopleContext: meeting.attendeeEmails,
      sourceNotes: slackMatches.slice(0, 5).map((match, index) => `S${index + 1}: ${match.permalink ?? match.ts ?? "Slack result"}`),
    };
  }
}

async function insertMeetingBrief(
  workspaceId: string,
  meeting: MeetingRow,
  brief: z.infer<typeof prepSchema>,
  sourceIds: string[],
  slackQueries: string[],
  slackMatches: SlackMatch[],
) {
  const rows = await prisma.$queryRaw<MeetingBriefRow[]>`
    INSERT INTO meeting_briefs (
      id,
      workspace_id,
      meeting_id,
      status,
      summary,
      agenda,
      open_questions,
      risks,
      follow_ups,
      source_ids,
      slack_queries,
      content,
      created_at,
      updated_at
    )
    VALUES (
      ${randomUUID()}::uuid,
      ${workspaceId}::uuid,
      ${meeting.id}::uuid,
      'generated',
      ${brief.summary},
      ${toJson(brief.agenda)}::jsonb,
      ${toJson(brief.openQuestions)}::jsonb,
      ${toJson(brief.risks)}::jsonb,
      ${toJson(brief.followUps)}::jsonb,
      ${sourceIds},
      ${toJson(slackQueries)}::jsonb,
      ${toJson({ ...brief, slackMatchCount: slackMatches.length })}::jsonb,
      now(),
      now()
    )
    RETURNING
      id::text AS "id",
      workspace_id::text AS "workspaceId",
      meeting_id::text AS "meetingId",
      status,
      summary,
      agenda,
      open_questions AS "openQuestions",
      risks,
      follow_ups AS "followUps",
      source_ids AS "sourceIds",
      slack_queries AS "slackQueries",
      content,
      created_at AS "createdAt",
      updated_at AS "updatedAt"
  `;
  return first(rows, "meeting brief");
}

async function latestBriefsByMeeting(
  workspaceId: string,
  meetingIds: string[],
): Promise<Map<string, ReturnType<typeof toMeetingBriefResponse>>> {
  if (!meetingIds.length) return new Map();
  const rows = await prisma.$queryRaw<MeetingBriefRow[]>`
    SELECT DISTINCT ON (meeting_id)
      id::text AS "id",
      workspace_id::text AS "workspaceId",
      meeting_id::text AS "meetingId",
      status,
      summary,
      agenda,
      open_questions AS "openQuestions",
      risks,
      follow_ups AS "followUps",
      source_ids AS "sourceIds",
      slack_queries AS "slackQueries",
      content,
      created_at AS "createdAt",
      updated_at AS "updatedAt"
    FROM meeting_briefs
    WHERE workspace_id = ${workspaceId}::uuid
      AND meeting_id = ANY(${meetingIds}::uuid[])
    ORDER BY meeting_id, created_at DESC
  `;
  return new Map(rows.map((row) => [row.meetingId, toMeetingBriefResponse(row)]));
}

async function googleAccessToken(workspaceId: string): Promise<string> {
  const clientId = requireEnv("GOOGLE_CLIENT_ID", "Google");
  const clientSecret = requireEnv("GOOGLE_CLIENT_SECRET", "Google");
  const credential = await getProviderCredential("calendar", workspaceId);
  const refreshToken = credential?.refreshToken;
  if (!refreshToken) {
    throw new ClientInputError(400, "Google Calendar is not connected");
  }
  const body = new URLSearchParams({
    client_id: clientId,
    client_secret: clientSecret,
    refresh_token: refreshToken,
    grant_type: "refresh_token",
  });
  const token = await googleApi<{ access_token?: string }>(
    "https://oauth2.googleapis.com/token",
    "",
    {
      method: "POST",
      headers: { "content-type": "application/x-www-form-urlencoded" },
      body,
    },
  );
  if (!token.access_token) throw new Error("Google did not return an access token");
  return token.access_token;
}

async function googleApi<T>(
  url: string,
  accessToken: string,
  init: RequestInit = {},
): Promise<T> {
  const headers = new Headers(init.headers);
  if (accessToken) headers.set("authorization", `Bearer ${accessToken}`);
  const res = await fetch(url, { ...init, headers });
  if (!res.ok) {
    const error = new Error(`Google API request failed with ${res.status}`);
    error.name = `GoogleApi${res.status}`;
    throw error;
  }
  return (await res.json()) as T;
}

function isGoogleGone(err: unknown): boolean {
  return err instanceof Error && err.name === "GoogleApi410";
}

function requireEnv(key: string, provider: string): string {
  const value = process.env[key];
  if (!value) throw new ClientInputError(400, `${provider} env is not configured: ${key}`);
  return value;
}

function hasGoogleEnv(): boolean {
  return Boolean(
    process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET,
  );
}

function parseMcpJson<T>(value: unknown): T {
  if (typeof value === "string") return JSON.parse(value) as T;
  if (Array.isArray(value)) {
    const firstText = value.find(
      (item): item is { type: string; text: string } =>
        Boolean(item) &&
        typeof item === "object" &&
        "type" in item &&
        (item as { type?: unknown }).type === "text" &&
        typeof (item as { text?: unknown }).text === "string",
    );
    if (firstText) return JSON.parse(firstText.text) as T;
  }
  if (
    value &&
    typeof value === "object" &&
    "content" in value &&
    Array.isArray((value as { content?: unknown }).content)
  ) {
    return parseMcpJson((value as { content: unknown[] }).content);
  }
  return value as T;
}

function extractTerms(value: string): string[] {
  const stop = new Set([
    "the",
    "and",
    "for",
    "with",
    "from",
    "this",
    "that",
    "meeting",
    "call",
    "sync",
    "weekly",
    "daily",
    "com",
  ]);
  return Array.from(
    new Set(
      value
        .toLowerCase()
        .replace(/https?:\/\/\S+/g, " ")
        .replace(/[^a-z0-9@._-]+/g, " ")
        .split(/\s+/)
        .map((term) => term.trim())
        .filter((term) => term.length >= 3 && !stop.has(term)),
    ),
  ).slice(0, 12);
}

function hashToken(value: string): string {
  return createHash("sha256").update(value).digest("hex");
}

function parsePositiveInt(value: string | undefined, fallback: number): number {
  const parsed = value ? Number.parseInt(value, 10) : fallback;
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

function toMeetingResponse(row: MeetingRow) {
  return {
    id: row.id,
    workspaceId: row.workspaceId,
    calendarSourceObjectId: row.calendarSourceObjectId,
    providerEventId: row.providerEventId,
    title: row.title,
    description: row.description,
    organizerEmail: row.organizerEmail,
    attendeeEmails: row.attendeeEmails,
    location: row.location,
    meetingUrl: row.meetingUrl,
    htmlLink: row.htmlLink,
    startAt: row.startAt.toISOString(),
    endAt: row.endAt?.toISOString() ?? null,
    status: row.status,
    prepStatus: row.prepStatus,
    lastPreparedAt: row.lastPreparedAt?.toISOString() ?? null,
    metadata: row.metadata,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

function toMeetingBriefResponse(row: MeetingBriefRow) {
  return {
    id: row.id,
    workspaceId: row.workspaceId,
    meetingId: row.meetingId,
    status: row.status,
    summary: row.summary,
    agenda: row.agenda,
    openQuestions: row.openQuestions,
    risks: row.risks,
    followUps: row.followUps,
    sourceIds: row.sourceIds,
    slackQueries: row.slackQueries,
    content: row.content,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

function toJson(value: unknown): string {
  return JSON.stringify(value ?? {});
}

function first<T>(rows: T[], label: string): T {
  const row = rows[0];
  if (!row) throw new Error(`database did not return a ${label}`);
  return row;
}

export class ClientInputError extends Error {
  constructor(
    public readonly statusCode: number,
    message: string,
  ) {
    super(message);
  }
}
