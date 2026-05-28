import { randomUUID } from "node:crypto";
import type { Request, Response } from "express";
import { z } from "zod";
import {
  actionDecisionSchema,
  audit,
  createIdempotencyKey,
  createActionSchema,
  ensureDefaultWorkspace,
  logger,
  prisma,
  snoozeActionSchema,
} from "@hermes/shared";
import { requestContext } from "../http/request-context.js";

const updateActionSchema = z.object({
  title: z.string().trim().min(1).optional(),
  summary: z.string().trim().nullable().optional(),
  reason: z.string().trim().nullable().optional(),
  draftPayload: z.record(z.string(), z.unknown()).nullable().optional(),
  metadata: z.record(z.string(), z.unknown()).optional(),
});

const delegateActionSchema = z.object({
  delegateTo: z.string().trim().min(1),
  reason: z.string().trim().optional(),
});

interface ActionRow {
  id: string;
  workspaceId: string;
  ownerUserId: string;
  actionType: string;
  title: string;
  summary: string | null;
  reason: string | null;
  impactLevel: string;
  riskLevel: string;
  confidenceScore: number | null;
  sourceIds: string[];
  draftPayload: unknown | null;
  approvalRequired: boolean;
  status: string;
  dueAt: Date | null;
  createdFromSignalId: string | null;
  idempotencyKey: string;
  metadata: unknown;
  createdAt: Date;
  updatedAt: Date;
}

const TRANSITION_READY_STATUSES = new Set([
  "detected",
  "drafted",
  "pending_approval",
]);

const TERMINAL_STATUSES = new Set([
  "approved",
  "rejected",
  "delegated",
  "completed",
  "failed",
  "archived",
]);

export async function handleListActions(req: Request, res: Response) {
  try {
    const { workspaceId } = await ensureDefaultWorkspace(requestContext(req));
    const status = singleQueryValue(req.query.status);
    const limit = clampLimit(singleQueryValue(req.query.limit), 100);

    const actions = await prisma.$queryRaw<ActionRow[]>`
      SELECT
        id::text AS "id",
        workspace_id::text AS "workspaceId",
        owner_user_id AS "ownerUserId",
        action_type AS "actionType",
        title,
        summary,
        reason,
        impact_level AS "impactLevel",
        risk_level AS "riskLevel",
        confidence_score AS "confidenceScore",
        source_ids AS "sourceIds",
        draft_payload AS "draftPayload",
        approval_required AS "approvalRequired",
        status,
        due_at AS "dueAt",
        created_from_signal_id::text AS "createdFromSignalId",
        idempotency_key AS "idempotencyKey",
        metadata,
        created_at AS "createdAt",
        updated_at AS "updatedAt"
      FROM action_items
      WHERE workspace_id = ${workspaceId}::uuid
        AND (${status ?? null}::text IS NULL OR status = ${status ?? null})
      ORDER BY created_at DESC
      LIMIT ${limit}
    `;

    res.json({ actions: actions.map(toActionResponse) });
  } catch (err) {
    logger.error({ err }, "failed to list actions");
    res.status(500).json({ error: "failed to list actions" });
  }
}

export async function handleCreateAction(req: Request, res: Response) {
  const parsed = createActionSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: z.treeifyError(parsed.error) });
    return;
  }

  try {
    const { workspaceId, userId } = await ensureDefaultWorkspace(requestContext(req));
    const input = parsed.data;
    const dueAt = parseOptionalDate(input.dueAt);
    const status =
      input.status ?? (input.approvalRequired ? "pending_approval" : "drafted");
    const idempotencyKey =
      input.idempotencyKey ??
      createIdempotencyKey([
        workspaceId,
        input.actionType,
        input.title,
        input.sourceIds,
        input.draftPayload ?? {},
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
        idempotency_key,
        metadata,
        created_at,
        updated_at
      )
      VALUES (
        ${randomUUID()}::uuid,
        ${workspaceId}::uuid,
        ${userId},
        ${input.actionType},
        ${input.title},
        ${input.summary ?? null},
        ${input.reason ?? null},
        ${input.impactLevel},
        ${input.riskLevel},
        ${input.confidenceScore ?? null},
        ${input.sourceIds},
        ${toJson(input.draftPayload)}::jsonb,
        ${input.approvalRequired},
        ${status},
        ${dueAt},
        ${idempotencyKey},
        ${toJson(input.metadata)}::jsonb,
        now(),
        now()
      )
      ON CONFLICT (workspace_id, idempotency_key) DO UPDATE
      SET updated_at = action_items.updated_at
      RETURNING
        id::text AS "id",
        workspace_id::text AS "workspaceId",
        owner_user_id AS "ownerUserId",
        action_type AS "actionType",
        title,
        summary,
        reason,
        impact_level AS "impactLevel",
        risk_level AS "riskLevel",
        confidence_score AS "confidenceScore",
        source_ids AS "sourceIds",
        draft_payload AS "draftPayload",
        approval_required AS "approvalRequired",
        status,
        due_at AS "dueAt",
        created_from_signal_id::text AS "createdFromSignalId",
        idempotency_key AS "idempotencyKey",
        metadata,
        created_at AS "createdAt",
        updated_at AS "updatedAt"
    `;
    const action = firstRow(rows);

    if (input.draftPayload) {
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
          ${action.id}::uuid,
          ${input.actionType},
          ${toJson(input.draftPayload)}::jsonb,
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

    await audit({
      workspaceId,
      actorType: "user",
      actorId: userId,
      eventType: "action.upserted",
      objectType: "action_item",
      objectId: action.id,
      sourceIds: input.sourceIds,
      afterState: toActionResponse(action),
    });

    res.status(201).json({ action: toActionResponse(action) });
  } catch (err) {
    if (err instanceof InvalidDateError) {
      res.status(400).json({ error: err.message });
      return;
    }

    logger.error({ err }, "failed to create action");
    res.status(500).json({ error: "failed to create action" });
  }
}

export async function handleGetAction(req: Request, res: Response) {
  try {
    const { workspaceId } = await ensureDefaultWorkspace(requestContext(req));
    const id = requireParam(req, "id");
    const action = await getAction(workspaceId, id);
    if (!action) {
      res.status(404).json({ error: "action not found" });
      return;
    }

    res.json({ action: toActionResponse(action) });
  } catch (err) {
    sendActionError(res, err, "failed to get action", "failed to get action");
  }
}

export async function handleUpdateAction(req: Request, res: Response) {
  const parsed = updateActionSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: z.treeifyError(parsed.error) });
    return;
  }

  try {
    const { workspaceId, userId } = await ensureDefaultWorkspace(requestContext(req));
    const id = requireParam(req, "id");
    const before = await getAction(workspaceId, id);
    if (!before) {
      res.status(404).json({ error: "action not found" });
      return;
    }
    assertEditable(before, "update");

    const input = parsed.data;
    const rows = await prisma.$queryRaw<ActionRow[]>`
      UPDATE action_items
      SET title = ${input.title ?? before.title},
          summary = ${input.summary === undefined ? before.summary : input.summary},
          reason = ${input.reason === undefined ? before.reason : input.reason},
          draft_payload = ${toJson(
            input.draftPayload === undefined
              ? before.draftPayload
              : input.draftPayload,
          )}::jsonb,
          metadata = ${toJson(
            input.metadata === undefined
              ? before.metadata
              : mergeRecord(before.metadata, input.metadata),
          )}::jsonb,
          updated_at = now()
      WHERE workspace_id = ${workspaceId}::uuid
        AND id = ${id}::uuid
        AND status NOT IN ('approved', 'rejected', 'delegated', 'completed', 'failed', 'archived')
      RETURNING
        id::text AS "id",
        workspace_id::text AS "workspaceId",
        owner_user_id AS "ownerUserId",
        action_type AS "actionType",
        title,
        summary,
        reason,
        impact_level AS "impactLevel",
        risk_level AS "riskLevel",
        confidence_score AS "confidenceScore",
        source_ids AS "sourceIds",
        draft_payload AS "draftPayload",
        approval_required AS "approvalRequired",
        status,
        due_at AS "dueAt",
        created_from_signal_id::text AS "createdFromSignalId",
        idempotency_key AS "idempotencyKey",
        metadata,
        created_at AS "createdAt",
        updated_at AS "updatedAt"
    `;
    const action = rows[0];
    if (!action) {
      throw new ClientInputError(409, "action status changed; cannot update");
    }

    await audit({
      workspaceId,
      actorType: "user",
      actorId: userId,
      eventType: "action.updated",
      objectType: "action_item",
      objectId: id,
      sourceIds: action.sourceIds,
      beforeState: toActionResponse(before),
      afterState: toActionResponse(action),
    });

    res.json({ action: toActionResponse(action) });
  } catch (err) {
    sendActionError(res, err, "failed to update action", "failed to update action");
  }
}

export async function handleApproveAction(req: Request, res: Response) {
  await decideAction(req, res, "approved");
}

export async function handleRejectAction(req: Request, res: Response) {
  await decideAction(req, res, "rejected");
}

export async function handleSnoozeAction(req: Request, res: Response) {
  const parsed = snoozeActionSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: z.treeifyError(parsed.error) });
    return;
  }

  try {
    const { workspaceId, userId } = await ensureDefaultWorkspace(requestContext(req));
    const id = requireParam(req, "id");
    const snoozedUntil = parseDate(parsed.data.snoozedUntil, "snoozedUntil");
    const before = await getAction(workspaceId, id);
    if (!before) {
      res.status(404).json({ error: "action not found" });
      return;
    }
    assertTransitionReady(before, "snooze");

    const rows = await prisma.$queryRaw<ActionRow[]>`
      UPDATE action_items
      SET status = 'snoozed',
          due_at = ${snoozedUntil},
          updated_at = now()
      WHERE workspace_id = ${workspaceId}::uuid
        AND id = ${id}::uuid
        AND status IN ('detected', 'drafted', 'pending_approval')
      RETURNING
        id::text AS "id",
        workspace_id::text AS "workspaceId",
        owner_user_id AS "ownerUserId",
        action_type AS "actionType",
        title,
        summary,
        reason,
        impact_level AS "impactLevel",
        risk_level AS "riskLevel",
        confidence_score AS "confidenceScore",
        source_ids AS "sourceIds",
        draft_payload AS "draftPayload",
        approval_required AS "approvalRequired",
        status,
        due_at AS "dueAt",
        created_from_signal_id::text AS "createdFromSignalId",
        idempotency_key AS "idempotencyKey",
        metadata,
        created_at AS "createdAt",
        updated_at AS "updatedAt"
    `;
    const action = rows[0];
    if (!action) {
      throw new ClientInputError(409, "action status changed; cannot snooze");
    }

    await audit({
      workspaceId,
      actorType: "user",
      actorId: userId,
      eventType: "action.snoozed",
      objectType: "action_item",
      objectId: id,
      beforeState: toActionResponse(before),
      afterState: {
        ...toActionResponse(action),
        decisionReason: parsed.data.reason ?? null,
      },
    });

    res.json({ action: toActionResponse(action) });
  } catch (err) {
    sendActionError(res, err, "failed to snooze action", "failed to snooze action");
  }
}

export async function handleDelegateAction(req: Request, res: Response) {
  const parsed = delegateActionSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: z.treeifyError(parsed.error) });
    return;
  }

  try {
    const { workspaceId, userId } = await ensureDefaultWorkspace(requestContext(req));
    const id = requireParam(req, "id");
    const before = await getAction(workspaceId, id);
    if (!before) {
      res.status(404).json({ error: "action not found" });
      return;
    }
    assertTransitionReady(before, "delegate");

    const metadata = mergeRecord(before.metadata, {
      delegatedTo: parsed.data.delegateTo,
      delegationReason: parsed.data.reason ?? null,
      delegatedAt: new Date().toISOString(),
    });
    const rows = await prisma.$queryRaw<ActionRow[]>`
      UPDATE action_items
      SET status = 'delegated',
          metadata = ${toJson(metadata)}::jsonb,
          updated_at = now()
      WHERE workspace_id = ${workspaceId}::uuid
        AND id = ${id}::uuid
        AND status IN ('detected', 'drafted', 'pending_approval')
      RETURNING
        id::text AS "id",
        workspace_id::text AS "workspaceId",
        owner_user_id AS "ownerUserId",
        action_type AS "actionType",
        title,
        summary,
        reason,
        impact_level AS "impactLevel",
        risk_level AS "riskLevel",
        confidence_score AS "confidenceScore",
        source_ids AS "sourceIds",
        draft_payload AS "draftPayload",
        approval_required AS "approvalRequired",
        status,
        due_at AS "dueAt",
        created_from_signal_id::text AS "createdFromSignalId",
        idempotency_key AS "idempotencyKey",
        metadata,
        created_at AS "createdAt",
        updated_at AS "updatedAt"
    `;
    const action = rows[0];
    if (!action) {
      throw new ClientInputError(409, "action status changed; cannot delegate");
    }

    await audit({
      workspaceId,
      actorType: "user",
      actorId: userId,
      eventType: "action.delegated",
      objectType: "action_item",
      objectId: id,
      sourceIds: action.sourceIds,
      beforeState: toActionResponse(before),
      afterState: {
        ...toActionResponse(action),
        delegateTo: parsed.data.delegateTo,
        decisionReason: parsed.data.reason ?? null,
      },
    });

    res.json({ action: toActionResponse(action) });
  } catch (err) {
    sendActionError(
      res,
      err,
      "failed to delegate action",
      "failed to delegate action",
    );
  }
}

export async function handleGetActionAudit(req: Request, res: Response) {
  try {
    const { workspaceId } = await ensureDefaultWorkspace(requestContext(req));
    const id = requireParam(req, "id");
    const action = await getAction(workspaceId, id);
    if (!action) {
      res.status(404).json({ error: "action not found" });
      return;
    }

    const rows = await prisma.$queryRaw<
      Array<{
        id: string;
        actorType: string;
        actorId: string | null;
        eventType: string;
        objectType: string;
        objectId: string | null;
        sourceIds: string[];
        beforeState: unknown | null;
        afterState: unknown | null;
        failureReason: string | null;
        createdAt: Date;
      }>
    >`
      SELECT
        id::text AS "id",
        actor_type AS "actorType",
        actor_id AS "actorId",
        event_type AS "eventType",
        object_type AS "objectType",
        object_id AS "objectId",
        source_ids AS "sourceIds",
        before_state AS "beforeState",
        after_state AS "afterState",
        failure_reason AS "failureReason",
        created_at AS "createdAt"
      FROM audit_logs
      WHERE workspace_id = ${workspaceId}::uuid
        AND object_type = 'action_item'
        AND object_id = ${id}
      ORDER BY created_at DESC
      LIMIT 50
    `;

    res.json({
      audit: rows.map((row) => ({
        ...row,
        createdAt: row.createdAt.toISOString(),
      })),
    });
  } catch (err) {
    sendActionError(
      res,
      err,
      "failed to get action audit",
      "failed to get action audit",
    );
  }
}

async function decideAction(
  req: Request,
  res: Response,
  status: "approved" | "rejected",
) {
  const parsed = actionDecisionSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: z.treeifyError(parsed.error) });
    return;
  }

  try {
    const { workspaceId, userId } = await ensureDefaultWorkspace(requestContext(req));
    const id = requireParam(req, "id");
    const before = await getAction(workspaceId, id);
    if (!before) {
      res.status(404).json({ error: "action not found" });
      return;
    }
    assertTransitionReady(before, status);

    const finalPayload =
      status === "approved"
        ? parsed.data.finalPayload ?? before.draftPayload
        : before.draftPayload;

    const action = await prisma.$transaction(async (tx): Promise<ActionRow> => {
      const rows = await tx.$queryRaw<ActionRow[]>`
        UPDATE action_items
        SET status = ${status},
            draft_payload = ${toJson(finalPayload)}::jsonb,
            updated_at = now()
        WHERE workspace_id = ${workspaceId}::uuid
          AND id = ${id}::uuid
          AND status IN ('detected', 'drafted', 'pending_approval')
        RETURNING
          id::text AS "id",
          workspace_id::text AS "workspaceId",
          owner_user_id AS "ownerUserId",
          action_type AS "actionType",
          title,
          summary,
          reason,
          impact_level AS "impactLevel",
          risk_level AS "riskLevel",
          confidence_score AS "confidenceScore",
          source_ids AS "sourceIds",
          draft_payload AS "draftPayload",
          approval_required AS "approvalRequired",
          status,
          due_at AS "dueAt",
          created_from_signal_id::text AS "createdFromSignalId",
          idempotency_key AS "idempotencyKey",
          metadata,
          created_at AS "createdAt",
          updated_at AS "updatedAt"
      `;
      const updated = rows[0];
      if (!updated) {
        throw new ClientInputError(
          409,
          `action status changed; cannot ${status}`,
        );
      }

      await tx.$executeRaw`
        INSERT INTO approvals (
          id,
          workspace_id,
          action_item_id,
          requested_by,
          decided_by,
          status,
          original_payload,
          final_payload,
          decision_reason,
          created_at,
          decided_at
        )
        VALUES (
          ${randomUUID()}::uuid,
          ${workspaceId}::uuid,
          ${id}::uuid,
          'system',
          ${userId},
          ${status},
          ${toJson(before.draftPayload)}::jsonb,
          ${toJson(finalPayload)}::jsonb,
          ${parsed.data.reason ?? null},
          now(),
          now()
        )
      `;

      return updated;
    });

    await audit({
      workspaceId,
      actorType: "user",
      actorId: userId,
      eventType: `action.${status}`,
      objectType: "action_item",
      objectId: id,
      sourceIds: action.sourceIds,
      beforeState: toActionResponse(before),
      afterState: {
        ...toActionResponse(action),
        decisionReason: parsed.data.reason ?? null,
      },
    });

    res.json({ action: toActionResponse(action) });
  } catch (err) {
    sendActionError(
      res,
      err,
      "failed to decide action",
      "failed to decide action",
      { status },
    );
  }
}

async function getAction(
  workspaceId: string,
  id: string,
): Promise<ActionRow | null> {
  const rows = await prisma.$queryRaw<ActionRow[]>`
    SELECT
      id::text AS "id",
      workspace_id::text AS "workspaceId",
      owner_user_id AS "ownerUserId",
      action_type AS "actionType",
      title,
      summary,
      reason,
      impact_level AS "impactLevel",
      risk_level AS "riskLevel",
      confidence_score AS "confidenceScore",
      source_ids AS "sourceIds",
      draft_payload AS "draftPayload",
      approval_required AS "approvalRequired",
      status,
      due_at AS "dueAt",
      created_from_signal_id::text AS "createdFromSignalId",
      idempotency_key AS "idempotencyKey",
      metadata,
      created_at AS "createdAt",
      updated_at AS "updatedAt"
    FROM action_items
    WHERE workspace_id = ${workspaceId}::uuid
      AND id = ${id}::uuid
    LIMIT 1
  `;

  return rows[0] ?? null;
}

function toActionResponse(row: ActionRow) {
  return {
    id: row.id,
    workspaceId: row.workspaceId,
    ownerUserId: row.ownerUserId,
    actionType: row.actionType,
    title: row.title,
    summary: row.summary,
    reason: row.reason,
    impactLevel: row.impactLevel,
    riskLevel: row.riskLevel,
    confidenceScore: row.confidenceScore,
    sourceIds: row.sourceIds,
    draftPayload: row.draftPayload,
    approvalRequired: row.approvalRequired,
    status: row.status,
    dueAt: row.dueAt?.toISOString() ?? null,
    createdFromSignalId: row.createdFromSignalId,
    idempotencyKey: row.idempotencyKey,
    metadata: row.metadata,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

function firstRow(rows: ActionRow[]): ActionRow {
  const row = rows[0];
  if (!row) throw new Error("database did not return an action row");
  return row;
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

function requireParam(req: Request, key: string): string {
  const value = req.params[key];
  if (typeof value !== "string" || !value.trim()) {
    throw new ClientInputError(400, `${key} param is required`);
  }
  const trimmed = value.trim();
  if (!isUuid(trimmed)) {
    throw new ClientInputError(400, `${key} must be a valid UUID`);
  }
  return trimmed;
}

function parseOptionalDate(value: string | undefined): Date | null {
  if (!value) return null;
  return parseDate(value, "dueAt");
}

function parseDate(value: string, label: string): Date {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    throw new InvalidDateError(`${label} must be a valid date`);
  }
  return date;
}

function assertTransitionReady(action: ActionRow, transition: string): void {
  if (!TRANSITION_READY_STATUSES.has(action.status)) {
    throw new ClientInputError(
      409,
      `action is ${action.status}; cannot ${transition}`,
    );
  }
}

function assertEditable(action: ActionRow, transition: string): void {
  if (TERMINAL_STATUSES.has(action.status)) {
    throw new ClientInputError(
      409,
      `action is ${action.status}; cannot ${transition}`,
    );
  }
}

function sendActionError(
  res: Response,
  err: unknown,
  logMessage: string,
  clientMessage: string,
  meta: Record<string, unknown> = {},
): void {
  if (err instanceof ClientInputError) {
    res.status(err.statusCode).json({ error: err.message });
    return;
  }
  if (err instanceof InvalidDateError) {
    res.status(400).json({ error: err.message });
    return;
  }

  logger.error({ ...meta, err }, logMessage);
  res.status(500).json({ error: clientMessage });
}

function isUuid(value: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
    value,
  );
}

function toJson(value: unknown): string | null {
  return value === undefined ? null : JSON.stringify(value);
}

function mergeRecord(
  current: unknown,
  next: Record<string, unknown>,
): Record<string, unknown> {
  const base =
    current && typeof current === "object" && !Array.isArray(current)
      ? (current as Record<string, unknown>)
      : {};
  return { ...base, ...next };
}

class InvalidDateError extends Error {}

class ClientInputError extends Error {
  constructor(
    public readonly statusCode: number,
    message: string,
  ) {
    super(message);
  }
}
