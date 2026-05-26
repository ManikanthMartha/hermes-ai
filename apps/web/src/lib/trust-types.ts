export interface IntegrationHealth {
  id: string | null;
  provider: string;
  status: string;
  scopes: unknown[];
  config: Record<string, unknown>;
  lastSuccessfulSync: string | null;
  lastAttemptedSync: string | null;
  failureReason: string | null;
  updatedAt: string | null;
}

export interface AuditEvent {
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
  createdAt: string;
}

export interface FailureEvent {
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
  createdAt: string;
  resolvedAt: string | null;
}
