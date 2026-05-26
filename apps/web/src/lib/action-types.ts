export interface ActionItem {
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
  dueAt: string | null;
  createdFromSignalId: string | null;
  idempotencyKey: string;
  metadata: unknown;
  createdAt: string;
  updatedAt: string;
}

export interface AuditEvent {
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
  createdAt: string;
}

