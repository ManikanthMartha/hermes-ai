import { randomUUID } from "node:crypto";
import { DEFAULT_USER_ID, DEFAULT_WORKSPACE_ID } from "./action-os.js";
import { prisma } from "./db.js";

export interface WorkspaceContext {
  workspaceId: string;
  userId: string;
}

export function resolveWorkspaceContext(
  context: Partial<WorkspaceContext> = {},
): WorkspaceContext {
  return {
    workspaceId: context.workspaceId ?? DEFAULT_WORKSPACE_ID,
    userId: context.userId ?? DEFAULT_USER_ID,
  };
}

export async function ensureDefaultWorkspace(
  context: Partial<WorkspaceContext> = {},
): Promise<WorkspaceContext> {
  const { workspaceId, userId } = resolveWorkspaceContext(context);

  await prisma.$executeRaw`
    INSERT INTO workspaces (id, name, slug, owner_user_id, metadata, created_at, updated_at)
    VALUES (${workspaceId}::uuid, 'Hermes Personal Workspace', 'personal', ${userId}, '{}'::jsonb, now(), now())
    ON CONFLICT (id) DO UPDATE
    SET owner_user_id = EXCLUDED.owner_user_id,
        updated_at = now()
  `;

  await prisma.$executeRaw`
    INSERT INTO workspace_members (id, workspace_id, user_id, role, status, created_at, updated_at)
    VALUES (${randomUUID()}::uuid, ${workspaceId}::uuid, ${userId}, 'owner', 'active', now(), now())
    ON CONFLICT (workspace_id, user_id) DO UPDATE
    SET role = EXCLUDED.role,
        status = EXCLUDED.status,
        updated_at = now()
  `;

  return { workspaceId, userId };
}
