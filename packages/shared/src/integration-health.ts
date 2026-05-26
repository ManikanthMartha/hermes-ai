import { randomUUID } from "node:crypto";
import {
  DEFAULT_WORKSPACE_ID,
  INTEGRATION_PROVIDERS,
  type IntegrationProvider,
  type IntegrationStatus,
} from "./action-os.js";
import { prisma } from "./db.js";
import { ensureDefaultWorkspace } from "./workspace.js";

export interface IntegrationHealth {
  id: string | null;
  workspaceId: string;
  provider: IntegrationProvider;
  status: IntegrationStatus;
  scopes: unknown[];
  config: Record<string, unknown>;
  lastSuccessfulSync: Date | null;
  lastAttemptedSync: Date | null;
  failureReason: string | null;
  updatedAt: Date | null;
}

export interface UpsertIntegrationHealthInput {
  workspaceId?: string;
  provider: IntegrationProvider;
  status: IntegrationStatus;
  scopes?: unknown[];
  config?: Record<string, unknown>;
  lastSuccessfulSync?: Date | null;
  lastAttemptedSync?: Date | null;
  failureReason?: string | null;
}

interface IntegrationRow {
  id: string;
  workspaceId: string;
  provider: string;
  status: IntegrationStatus;
  scopes: unknown;
  config: unknown;
  lastSuccessfulSync: Date | null;
  lastAttemptedSync: Date | null;
  failureReason: string | null;
  updatedAt: Date;
}

export async function listIntegrationHealth(
  workspaceId = DEFAULT_WORKSPACE_ID,
): Promise<IntegrationHealth[]> {
  await ensureDefaultWorkspace({ workspaceId });

  const rows = await prisma.$queryRaw<IntegrationRow[]>`
    SELECT
      id::text AS "id",
      workspace_id::text AS "workspaceId",
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
    ORDER BY provider ASC
  `;
  const byProvider = new Map(rows.map((row) => [row.provider, row]));

  return INTEGRATION_PROVIDERS.map((provider) => {
    const row = byProvider.get(provider);
    if (!row) return defaultIntegrationHealth(workspaceId, provider);

    return {
      id: row.id,
      workspaceId: row.workspaceId,
      provider,
      status: row.status,
      scopes: Array.isArray(row.scopes) ? row.scopes : [],
      config: isRecord(row.config) ? row.config : {},
      lastSuccessfulSync: row.lastSuccessfulSync,
      lastAttemptedSync: row.lastAttemptedSync,
      failureReason: row.failureReason,
      updatedAt: row.updatedAt,
    };
  });
}

export async function upsertIntegrationHealth(
  input: UpsertIntegrationHealthInput,
): Promise<void> {
  const workspaceId = input.workspaceId ?? DEFAULT_WORKSPACE_ID;
  await ensureDefaultWorkspace({ workspaceId });

  await prisma.$executeRaw`
    INSERT INTO integration_accounts (
      id,
      workspace_id,
      provider,
      status,
      scopes,
      config,
      last_successful_sync,
      last_attempted_sync,
      failure_reason,
      created_at,
      updated_at
    )
    VALUES (
      ${randomUUID()}::uuid,
      ${workspaceId}::uuid,
      ${input.provider},
      ${input.status},
      ${JSON.stringify(input.scopes ?? [])}::jsonb,
      ${JSON.stringify(input.config ?? {})}::jsonb,
      ${input.lastSuccessfulSync ?? null},
      ${input.lastAttemptedSync ?? null},
      ${input.failureReason ?? null},
      now(),
      now()
    )
    ON CONFLICT (workspace_id, provider) DO UPDATE
    SET status = EXCLUDED.status,
        scopes = EXCLUDED.scopes,
        config = EXCLUDED.config,
        last_successful_sync = COALESCE(
          EXCLUDED.last_successful_sync,
          integration_accounts.last_successful_sync
        ),
        last_attempted_sync = COALESCE(
          EXCLUDED.last_attempted_sync,
          integration_accounts.last_attempted_sync
        ),
        failure_reason = EXCLUDED.failure_reason,
        updated_at = now()
  `;
}

function defaultIntegrationHealth(
  workspaceId: string,
  provider: IntegrationProvider,
): IntegrationHealth {
  return {
    id: null,
    workspaceId,
    provider,
    status: "not_connected",
    scopes: [],
    config: {},
    lastSuccessfulSync: null,
    lastAttemptedSync: null,
    failureReason: null,
    updatedAt: null,
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === "object" && !Array.isArray(value);
}
