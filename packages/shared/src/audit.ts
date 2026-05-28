import { randomUUID } from "node:crypto";
import type { ActorType } from "./action-os.js";
import { prisma } from "./db.js";

export interface AuditInput {
  workspaceId: string;
  actorType: ActorType;
  actorId?: string;
  eventType: string;
  objectType: string;
  objectId?: string;
  sourceIds?: string[];
  beforeState?: unknown;
  afterState?: unknown;
  failureReason?: string;
}

export interface FailureInput {
  workspaceId: string;
  severity?: "low" | "medium" | "high" | "critical";
  source: string;
  eventType: string;
  objectType?: string;
  objectId?: string;
  message: string;
  details?: unknown;
}

export async function audit(input: AuditInput): Promise<void> {
  await prisma.$executeRaw`
    INSERT INTO audit_logs (
      id,
      workspace_id,
      actor_type,
      actor_id,
      event_type,
      object_type,
      object_id,
      source_ids,
      before_state,
      after_state,
      failure_reason,
      created_at
    )
    VALUES (
      ${randomUUID()}::uuid,
      ${input.workspaceId}::uuid,
      ${input.actorType},
      ${input.actorId ?? null},
      ${input.eventType},
      ${input.objectType},
      ${input.objectId ?? null},
      ${input.sourceIds ?? []},
      ${toJson(input.beforeState)}::jsonb,
      ${toJson(input.afterState)}::jsonb,
      ${input.failureReason ?? null},
      now()
    )
  `;
}

export async function recordFailure(input: FailureInput): Promise<void> {
  const id = randomUUID();

  await prisma.$executeRaw`
    INSERT INTO failure_events (
      id,
      workspace_id,
      severity,
      source,
      event_type,
      object_type,
      object_id,
      message,
      details,
      status,
      created_at
    )
    VALUES (
      ${id}::uuid,
      ${input.workspaceId}::uuid,
      ${input.severity ?? "medium"},
      ${input.source},
      ${input.eventType},
      ${input.objectType ?? null},
      ${input.objectId ?? null},
      ${input.message},
      ${toJson(input.details ?? {})}::jsonb,
      'open',
      now()
    )
  `;

  await audit({
    workspaceId: input.workspaceId,
    actorType: "system",
    eventType: "failure.recorded",
    objectType: "failure_event",
    objectId: id,
    afterState: input,
    failureReason: input.message,
  });
}

function toJson(value: unknown): string | null {
  return value === undefined ? null : JSON.stringify(value);
}
