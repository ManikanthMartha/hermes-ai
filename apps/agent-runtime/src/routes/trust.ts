import type { Request, Response } from "express";
import {
  audit,
  ensureDefaultWorkspace,
  listIntegrationHealth,
  logger,
  prisma,
} from "@hermes/shared";
import { requestContext } from "../http/request-context.js";

interface AuditRow {
  id: string;
  workspaceId: string;
  actorType: string;
  actorId: string | null;
  eventType: string;
  objectType: string;
  objectId: string | null;
  sourceCount: number;
  hasBeforeState: boolean;
  hasAfterState: boolean;
  failureReason: string | null;
  createdAt: Date;
}

interface FailureRow {
  id: string;
  workspaceId: string;
  severity: string;
  source: string;
  eventType: string;
  objectType: string | null;
  objectId: string | null;
  message: string;
  hasDetails: boolean;
  status: string;
  createdAt: Date;
  resolvedAt: Date | null;
}

export async function handleListIntegrations(req: Request, res: Response) {
  try {
    const context = requestContext(req);
    const { workspaceId } = context;
    const integrations = await listIntegrationHealth(context);

    res.json({
      workspaceId,
      integrations: integrations.map((row) => {
        const config = displaySafeIntegrationConfig(row.provider, row.config);
        const simulated = config.connectorMode === "prototype";
        return {
          id: row.id,
          provider: row.provider,
          status:
            simulated && row.status === "connected" ? "not_connected" : row.status,
          scopes: simulated ? [] : row.scopes,
          config,
          lastSuccessfulSync: simulated
            ? null
            : row.lastSuccessfulSync?.toISOString() ?? null,
          lastAttemptedSync: row.lastAttemptedSync?.toISOString() ?? null,
          failureReason: row.failureReason ? "Connection needs attention." : null,
          updatedAt: row.updatedAt?.toISOString() ?? null,
        };
      }),
    });
  } catch (err) {
    logger.error({ err }, "failed to list integrations");
    res.status(500).json({ error: "failed to list integrations" });
  }
}

export async function handleListAudit(req: Request, res: Response) {
  try {
    const { workspaceId } = requestContext(req);
    await ensureDefaultWorkspace(requestContext(req));
    const limit = clampLimit(singleQueryValue(req.query.limit), 100);
    const rows = await prisma.$queryRaw<AuditRow[]>`
      SELECT
        id::text AS "id",
        workspace_id::text AS "workspaceId",
        actor_type AS "actorType",
        actor_id AS "actorId",
        event_type AS "eventType",
        object_type AS "objectType",
        object_id AS "objectId",
        COALESCE(cardinality(source_ids), 0) AS "sourceCount",
        before_state IS NOT NULL AS "hasBeforeState",
        after_state IS NOT NULL AS "hasAfterState",
        failure_reason AS "failureReason",
        created_at AS "createdAt"
      FROM audit_logs
      WHERE workspace_id = ${workspaceId}::uuid
      ORDER BY created_at DESC
      LIMIT ${limit}
    `;

    res.json({ audit: rows.map(toAuditResponse) });
  } catch (err) {
    logger.error({ err }, "failed to list audit log");
    res.status(500).json({ error: "failed to list audit log" });
  }
}

export async function handleCreateAuditTest(req: Request, res: Response) {
  try {
    const { workspaceId, userId } = requestContext(req);
    await audit({
      workspaceId,
      actorType: "user",
      actorId: userId,
      eventType: "audit.test",
      objectType: "trust_center",
      objectId: "phase-a",
      afterState: { source: "manual-test" },
    });

    res.status(201).json({ ok: true });
  } catch (err) {
    logger.error({ err }, "failed to write audit test event");
    res.status(500).json({ error: "failed to write audit test event" });
  }
}

export async function handleListFailures(req: Request, res: Response) {
  try {
    const { workspaceId } = requestContext(req);
    await ensureDefaultWorkspace(requestContext(req));
    const status = singleQueryValue(req.query.status);
    const limit = clampLimit(singleQueryValue(req.query.limit), 100);
    const rows = await prisma.$queryRaw<FailureRow[]>`
      SELECT
        id::text AS "id",
        workspace_id::text AS "workspaceId",
        severity,
        source,
        event_type AS "eventType",
        object_type AS "objectType",
        object_id AS "objectId",
        message,
        details IS NOT NULL AND details <> '{}'::jsonb AS "hasDetails",
        status,
        created_at AS "createdAt",
        resolved_at AS "resolvedAt"
      FROM failure_events
      WHERE workspace_id = ${workspaceId}::uuid
        AND (${status ?? null}::text IS NULL OR status = ${status ?? null})
      ORDER BY created_at DESC
      LIMIT ${limit}
    `;

    res.json({ failures: rows.map(toFailureResponse) });
  } catch (err) {
    logger.error({ err }, "failed to list failures");
    res.status(500).json({ error: "failed to list failures" });
  }
}

function toAuditResponse(row: AuditRow) {
  return {
    id: row.id,
    workspaceId: row.workspaceId,
    actorType: row.actorType,
    actorId: row.actorId,
    eventType: row.eventType,
    objectType: row.objectType,
    objectId: row.objectId,
    sourceCount: row.sourceCount,
    hasBeforeState: row.hasBeforeState,
    hasAfterState: row.hasAfterState,
    failureReason: row.failureReason ? "Failure details redacted." : null,
    createdAt: row.createdAt.toISOString(),
  };
}

function toFailureResponse(row: FailureRow) {
  return {
    id: row.id,
    workspaceId: row.workspaceId,
    severity: row.severity,
    source: row.source,
    eventType: row.eventType,
    objectType: row.objectType,
    objectId: row.objectId,
    message: safeFailureMessage(row),
    hasDetails: row.hasDetails,
    status: row.status,
    createdAt: row.createdAt.toISOString(),
    resolvedAt: row.resolvedAt?.toISOString() ?? null,
  };
}

function displaySafeIntegrationConfig(
  provider: string,
  value: unknown,
): Record<string, unknown> {
  const stored = isRecord(value) ? value : {};
  const simulated =
    stored.connectorMode === "prototype" || stored.simulated === true;
  const connectorMode =
    stored.connectorMode === "env" ? "env" : simulated ? "prototype" : "real";
  return {
    developerConfigured:
      (!simulated && stored.developerConfigured === true),
    connectorMode,
    simulated,
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === "object" && !Array.isArray(value);
}

function safeFailureMessage(row: FailureRow): string {
  const source = row.source ? `${row.source} ` : "";
  return `${source}${row.eventType} needs attention.`;
}

function singleQueryValue(value: unknown): string | undefined {
  if (typeof value === "string") return value;
  if (Array.isArray(value) && typeof value[0] === "string") return value[0];
  return undefined;
}

function clampLimit(raw: string | undefined, fallback: number): number {
  const parsed = raw ? Number.parseInt(raw, 10) : fallback;
  if (!Number.isFinite(parsed)) return fallback;
  return Math.max(1, Math.min(parsed, 200));
}
