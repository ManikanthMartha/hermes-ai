export interface SourceObject {
  id: string;
  workspaceId: string;
  provider: string;
  objectType: string;
  externalId: string;
  title: string | null;
  url: string | null;
  summary: string | null;
  occurredAt: string | null;
  lastObservedAt: string;
  createdAt: string;
  updatedAt: string;
}

export interface ConnectorSyncRun {
  id: string;
  workspaceId: string;
  provider: string;
  syncType: string;
  status: string;
  objectsSeen: number;
  objectsChanged: number;
  failureReason: string | null;
  startedAt: string;
  completedAt: string | null;
}

export interface ConnectorSignal {
  id: string;
  workspaceId: string;
  signalType: string;
  title: string;
  summary: string | null;
  sourceIds: string[];
  confidence: number;
  status: string;
  idempotencyKey: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface ConnectorSyncResult {
  provider: string;
  syncRun: ConnectorSyncRun;
  sourceObject: SourceObject;
  signal: ConnectorSignal;
  action: ConnectorActionSummary;
}

export interface ConnectorActionSummary {
  id: string;
  workspaceId: string;
  actionType: string;
  title: string;
  summary: string | null;
  status: string;
  dueAt: string | null;
  createdAt: string;
  updatedAt: string;
}
