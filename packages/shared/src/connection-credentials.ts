import {
  decryptCredential,
  encryptCredential,
} from "./credentials.js";
import type { IntegrationProvider } from "./action-os.js";
import { prisma } from "./db.js";

export type StoredCredentialPayload = {
  provider: IntegrationProvider;
  credentialType: "oauth" | "manual" | "env";
  accessToken?: string;
  refreshToken?: string;
  botAccessToken?: string;
  tokenType?: string;
  expiresAt?: string;
  scopes?: string[];
  account?: Record<string, unknown>;
};

type CredentialRow = {
  id: string;
  encryptedPayload: string;
  metadata: unknown;
};

export class MissingProviderCredentialError extends Error {
  constructor(provider: IntegrationProvider) {
    super(`${provider} is not connected for this workspace`);
    this.name = "MissingProviderCredentialError";
  }
}

export async function storeProviderCredential(input: {
  workspaceId: string;
  integrationAccountId: string;
  provider: IntegrationProvider;
  payload: StoredCredentialPayload;
  metadata?: Record<string, unknown>;
}) {
  const workspaceId = input.workspaceId;
  await prisma.$executeRaw`
    DELETE FROM integration_credentials
    WHERE workspace_id = ${workspaceId}::uuid
      AND provider = ${input.provider}
  `;

  await prisma.$executeRaw`
    INSERT INTO integration_credentials (
      id,
      workspace_id,
      integration_account_id,
      provider,
      encrypted_payload,
      metadata,
      created_at,
      updated_at
    )
    VALUES (
      gen_random_uuid(),
      ${workspaceId}::uuid,
      ${input.integrationAccountId}::uuid,
      ${input.provider},
      ${encryptCredential(input.payload)},
      ${JSON.stringify(safeCredentialMetadata(input.payload, input.metadata))}::jsonb,
      now(),
      now()
    )
  `;
}

export async function getProviderCredential(
  provider: IntegrationProvider,
  workspaceId: string,
): Promise<StoredCredentialPayload | null> {
  const rows = await prisma.$queryRaw<CredentialRow[]>`
    SELECT
      id::text AS "id",
      encrypted_payload AS "encryptedPayload",
      metadata
    FROM integration_credentials
    WHERE workspace_id = ${workspaceId}::uuid
      AND provider = ${provider}
    ORDER BY updated_at DESC
    LIMIT 1
  `;
  const row = rows[0];
  if (!row) return null;
  return decryptCredential<StoredCredentialPayload>(row.encryptedPayload);
}

export async function requireProviderCredential(
  provider: IntegrationProvider,
  workspaceId: string,
): Promise<StoredCredentialPayload> {
  const credential = await getProviderCredential(provider, workspaceId);
  if (!credential) throw new MissingProviderCredentialError(provider);
  return credential;
}

export async function deleteProviderCredential(
  provider: IntegrationProvider,
  workspaceId: string,
) {
  await prisma.$executeRaw`
    DELETE FROM integration_credentials
    WHERE workspace_id = ${workspaceId}::uuid
      AND provider = ${provider}
  `;
}

function safeCredentialMetadata(
  payload: StoredCredentialPayload,
  metadata: Record<string, unknown> = {},
) {
  return {
    ...metadata,
    credentialType: payload.credentialType,
    scopes: payload.scopes ?? [],
    account: payload.account ?? {},
    hasAccessToken: Boolean(payload.accessToken || payload.botAccessToken),
    hasRefreshToken: Boolean(payload.refreshToken),
    expiresAt: payload.expiresAt ?? null,
  };
}
