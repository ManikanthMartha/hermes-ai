export const INTEGRATION_PROVIDERS = [
  "gmail",
  "calendar",
  "slack",
  "github",
  "linear",
  "sentry",
] as const;

export type IntegrationProvider = (typeof INTEGRATION_PROVIDERS)[number];

export type IntegrationStatus =
  | "not_connected"
  | "connected"
  | "degraded"
  | "error"
  | "disabled";

export type ActionStatus =
  | "detected"
  | "drafted"
  | "pending_approval"
  | "approved"
  | "rejected"
  | "queued"
  | "executing"
  | "completed"
  | "failed"
  | "snoozed"
  | "delegated"
  | "archived";

export type ApprovalStatus = "pending" | "approved" | "rejected" | "cancelled";

export type ExecutionStatus =
  | "queued"
  | "executing"
  | "completed"
  | "failed"
  | "cancelled";

export type ImpactLevel = "low" | "medium" | "high" | "critical";
export type RiskLevel = "low" | "medium" | "high" | "critical";
export type ActorType = "user" | "agent" | "system" | "tool";

export const AUDIT_EVENT_TYPES = [
  "action.upserted",
  "action.approved",
  "action.rejected",
  "action.snoozed",
  "audit.test",
  "failure.recorded",
  "integration.connected",
  "integration.degraded",
  "integration.failed",
  "sync.started",
  "sync.completed",
  "sync.failed",
] as const;

export type AuditEventType = (typeof AUDIT_EVENT_TYPES)[number];

export function isIntegrationProvider(
  value: string,
): value is IntegrationProvider {
  return INTEGRATION_PROVIDERS.includes(value as IntegrationProvider);
}
