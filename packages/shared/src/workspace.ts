import { randomUUID } from "node:crypto";
import { createHash } from "node:crypto";
import { prisma } from "./db.js";

export interface WorkspaceContext {
  workspaceId: string;
  userId: string;
}

export function resolveWorkspaceContext(
  context: Partial<WorkspaceContext> = {},
): WorkspaceContext {
  const userId = context.userId;
  if (!userId) {
    throw new Error("workspace context requires an authenticated user id");
  }
  return {
    workspaceId: context.workspaceId ?? workspaceIdForUser(userId),
    userId,
  };
}

export function workspaceIdForUser(userId: string): string {
  const hash = createHash("sha256").update(`hermes:user-workspace:${userId}`).digest();
  hash.writeUInt8((hash.readUInt8(6) & 0x0f) | 0x40, 6);
  hash.writeUInt8((hash.readUInt8(8) & 0x3f) | 0x80, 8);
  const hex = hash.subarray(0, 16).toString("hex");
  return [
    hex.slice(0, 8),
    hex.slice(8, 12),
    hex.slice(12, 16),
    hex.slice(16, 20),
    hex.slice(20, 32),
  ].join("-");
}

export async function ensureDefaultWorkspace(
  context: Partial<WorkspaceContext> = {},
): Promise<WorkspaceContext> {
  const { workspaceId, userId } = resolveWorkspaceContext(context);
  const slug = `personal-${workspaceId.slice(0, 8)}`;

  await prisma.$executeRaw`
    INSERT INTO workspaces (id, name, slug, owner_user_id, metadata, created_at, updated_at)
    VALUES (${workspaceId}::uuid, 'Hermes Personal Workspace', ${slug}, ${userId}, '{}'::jsonb, now(), now())
    ON CONFLICT (id) DO UPDATE
    SET slug = EXCLUDED.slug,
        owner_user_id = EXCLUDED.owner_user_id,
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
