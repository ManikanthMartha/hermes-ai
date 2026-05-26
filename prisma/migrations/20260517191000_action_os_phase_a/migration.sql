-- AlterTable
ALTER TABLE "conversations" ADD COLUMN     "workspace_id" UUID NOT NULL DEFAULT '00000000-0000-4000-8000-000000000001';

-- AlterTable
ALTER TABLE "memories" ADD COLUMN     "workspace_id" UUID NOT NULL DEFAULT '00000000-0000-4000-8000-000000000001';

-- CreateTable
CREATE TABLE "workspaces" (
    "id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "slug" VARCHAR(120),
    "owner_user_id" VARCHAR(100) NOT NULL DEFAULT 'local-user',
    "metadata" JSONB NOT NULL DEFAULT '{}',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "workspaces_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "workspace_members" (
    "id" UUID NOT NULL,
    "workspace_id" UUID NOT NULL,
    "user_id" VARCHAR(100) NOT NULL,
    "role" VARCHAR(40) NOT NULL DEFAULT 'owner',
    "status" VARCHAR(40) NOT NULL DEFAULT 'active',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "workspace_members_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "integration_accounts" (
    "id" UUID NOT NULL,
    "workspace_id" UUID NOT NULL,
    "provider" VARCHAR(40) NOT NULL,
    "status" VARCHAR(40) NOT NULL DEFAULT 'not_connected',
    "scopes" JSONB NOT NULL DEFAULT '[]',
    "config" JSONB NOT NULL DEFAULT '{}',
    "last_successful_sync" TIMESTAMP(3),
    "last_attempted_sync" TIMESTAMP(3),
    "failure_reason" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "integration_accounts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "integration_credentials" (
    "id" UUID NOT NULL,
    "workspace_id" UUID NOT NULL,
    "integration_account_id" UUID NOT NULL,
    "provider" VARCHAR(40) NOT NULL,
    "encrypted_payload" TEXT NOT NULL,
    "metadata" JSONB NOT NULL DEFAULT '{}',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "integration_credentials_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "integration_scopes" (
    "id" UUID NOT NULL,
    "workspace_id" UUID NOT NULL,
    "integration_account_id" UUID NOT NULL,
    "provider" VARCHAR(40) NOT NULL,
    "scope" TEXT NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "integration_scopes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "source_objects" (
    "id" UUID NOT NULL,
    "workspace_id" UUID NOT NULL,
    "provider" VARCHAR(40) NOT NULL,
    "object_type" VARCHAR(80) NOT NULL,
    "external_id" VARCHAR(240) NOT NULL,
    "title" TEXT,
    "url" TEXT,
    "source_user_id" VARCHAR(160),
    "occurred_at" TIMESTAMP(3),
    "raw_payload" JSONB NOT NULL DEFAULT '{}',
    "normalized" JSONB NOT NULL DEFAULT '{}',
    "content_hash" VARCHAR(120),
    "last_observed_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "metadata" JSONB NOT NULL DEFAULT '{}',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "source_objects_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sync_runs" (
    "id" UUID NOT NULL,
    "workspace_id" UUID NOT NULL,
    "provider" VARCHAR(40) NOT NULL,
    "sync_type" VARCHAR(80) NOT NULL,
    "status" VARCHAR(40) NOT NULL DEFAULT 'running',
    "cursor_before" TEXT,
    "cursor_after" TEXT,
    "objects_seen" INTEGER NOT NULL DEFAULT 0,
    "objects_changed" INTEGER NOT NULL DEFAULT 0,
    "failure_reason" TEXT,
    "started_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completed_at" TIMESTAMP(3),
    "metadata" JSONB NOT NULL DEFAULT '{}',

    CONSTRAINT "sync_runs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "signals" (
    "id" UUID NOT NULL,
    "workspace_id" UUID NOT NULL,
    "signal_type" VARCHAR(80) NOT NULL,
    "title" TEXT NOT NULL,
    "summary" TEXT,
    "source_ids" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "confidence" DOUBLE PRECISION NOT NULL DEFAULT 0.5,
    "status" VARCHAR(40) NOT NULL DEFAULT 'candidate',
    "idempotency_key" VARCHAR(200),
    "metadata" JSONB NOT NULL DEFAULT '{}',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "signals_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "action_items" (
    "id" UUID NOT NULL,
    "workspace_id" UUID NOT NULL,
    "owner_user_id" VARCHAR(100) NOT NULL DEFAULT 'local-user',
    "action_type" VARCHAR(80) NOT NULL,
    "title" TEXT NOT NULL,
    "summary" TEXT,
    "reason" TEXT,
    "impact_level" VARCHAR(40) NOT NULL DEFAULT 'medium',
    "risk_level" VARCHAR(40) NOT NULL DEFAULT 'medium',
    "confidence_score" DOUBLE PRECISION,
    "source_ids" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "draft_payload" JSONB,
    "approval_required" BOOLEAN NOT NULL DEFAULT true,
    "status" VARCHAR(40) NOT NULL DEFAULT 'detected',
    "due_at" TIMESTAMP(3),
    "created_from_signal_id" UUID,
    "idempotency_key" VARCHAR(200) NOT NULL,
    "metadata" JSONB NOT NULL DEFAULT '{}',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "action_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "action_drafts" (
    "id" UUID NOT NULL,
    "workspace_id" UUID NOT NULL,
    "action_item_id" UUID NOT NULL,
    "draft_type" VARCHAR(80) NOT NULL,
    "payload" JSONB NOT NULL,
    "status" VARCHAR(40) NOT NULL DEFAULT 'active',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "action_drafts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "approvals" (
    "id" UUID NOT NULL,
    "workspace_id" UUID NOT NULL,
    "action_item_id" UUID NOT NULL,
    "requested_by" VARCHAR(100) NOT NULL DEFAULT 'system',
    "decided_by" VARCHAR(100),
    "status" VARCHAR(40) NOT NULL DEFAULT 'pending',
    "original_payload" JSONB,
    "final_payload" JSONB,
    "decision_reason" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "decided_at" TIMESTAMP(3),

    CONSTRAINT "approvals_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "executions" (
    "id" UUID NOT NULL,
    "workspace_id" UUID NOT NULL,
    "action_item_id" UUID NOT NULL,
    "provider" VARCHAR(40) NOT NULL,
    "tool_name" VARCHAR(120) NOT NULL,
    "payload" JSONB NOT NULL,
    "status" VARCHAR(40) NOT NULL DEFAULT 'queued',
    "provider_result" JSONB,
    "failure_reason" TEXT,
    "executed_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "executions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "audit_logs" (
    "id" UUID NOT NULL,
    "workspace_id" UUID NOT NULL,
    "actor_type" VARCHAR(40) NOT NULL,
    "actor_id" VARCHAR(100),
    "event_type" VARCHAR(100) NOT NULL,
    "object_type" VARCHAR(80) NOT NULL,
    "object_id" VARCHAR(120),
    "source_ids" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "before_state" JSONB,
    "after_state" JSONB,
    "failure_reason" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "audit_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "job_runs" (
    "id" UUID NOT NULL,
    "workspace_id" UUID NOT NULL,
    "queue_name" VARCHAR(80) NOT NULL,
    "job_name" VARCHAR(120) NOT NULL,
    "job_id" VARCHAR(120),
    "status" VARCHAR(40) NOT NULL DEFAULT 'queued',
    "input" JSONB NOT NULL DEFAULT '{}',
    "result" JSONB,
    "error" TEXT,
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "started_at" TIMESTAMP(3),
    "completed_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "job_runs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "failure_events" (
    "id" UUID NOT NULL,
    "workspace_id" UUID NOT NULL,
    "severity" VARCHAR(40) NOT NULL DEFAULT 'medium',
    "source" VARCHAR(80) NOT NULL,
    "event_type" VARCHAR(100) NOT NULL,
    "object_type" VARCHAR(80),
    "object_id" VARCHAR(120),
    "message" TEXT NOT NULL,
    "details" JSONB NOT NULL DEFAULT '{}',
    "status" VARCHAR(40) NOT NULL DEFAULT 'open',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "resolved_at" TIMESTAMP(3),

    CONSTRAINT "failure_events_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "workspaces_slug_key" ON "workspaces"("slug");

-- CreateIndex
CREATE INDEX "workspaces_owner_user_id_idx" ON "workspaces"("owner_user_id");

-- CreateIndex
CREATE INDEX "workspace_members_user_id_idx" ON "workspace_members"("user_id");

-- CreateIndex
CREATE UNIQUE INDEX "workspace_members_workspace_id_user_id_key" ON "workspace_members"("workspace_id", "user_id");

-- CreateIndex
CREATE INDEX "integration_accounts_status_idx" ON "integration_accounts"("status");

-- CreateIndex
CREATE UNIQUE INDEX "integration_accounts_workspace_id_provider_key" ON "integration_accounts"("workspace_id", "provider");

-- CreateIndex
CREATE INDEX "integration_credentials_workspace_id_provider_idx" ON "integration_credentials"("workspace_id", "provider");

-- CreateIndex
CREATE INDEX "integration_credentials_integration_account_id_idx" ON "integration_credentials"("integration_account_id");

-- CreateIndex
CREATE INDEX "integration_scopes_integration_account_id_idx" ON "integration_scopes"("integration_account_id");

-- CreateIndex
CREATE UNIQUE INDEX "integration_scopes_workspace_id_provider_scope_key" ON "integration_scopes"("workspace_id", "provider", "scope");

-- CreateIndex
CREATE INDEX "source_objects_workspace_id_provider_object_type_idx" ON "source_objects"("workspace_id", "provider", "object_type");

-- CreateIndex
CREATE INDEX "source_objects_content_hash_idx" ON "source_objects"("content_hash");

-- CreateIndex
CREATE UNIQUE INDEX "source_objects_workspace_id_provider_object_type_external_i_key" ON "source_objects"("workspace_id", "provider", "object_type", "external_id");

-- CreateIndex
CREATE INDEX "sync_runs_workspace_id_provider_status_idx" ON "sync_runs"("workspace_id", "provider", "status");

-- CreateIndex
CREATE INDEX "sync_runs_started_at_idx" ON "sync_runs"("started_at");

-- CreateIndex
CREATE INDEX "signals_workspace_id_signal_type_idx" ON "signals"("workspace_id", "signal_type");

-- CreateIndex
CREATE INDEX "signals_status_idx" ON "signals"("status");

-- CreateIndex
CREATE UNIQUE INDEX "signals_workspace_id_idempotency_key_key" ON "signals"("workspace_id", "idempotency_key");

-- CreateIndex
CREATE INDEX "action_items_workspace_id_status_idx" ON "action_items"("workspace_id", "status");

-- CreateIndex
CREATE INDEX "action_items_owner_user_id_idx" ON "action_items"("owner_user_id");

-- CreateIndex
CREATE UNIQUE INDEX "action_items_workspace_id_idempotency_key_key" ON "action_items"("workspace_id", "idempotency_key");

-- CreateIndex
CREATE INDEX "action_drafts_workspace_id_action_item_id_idx" ON "action_drafts"("workspace_id", "action_item_id");

-- CreateIndex
CREATE INDEX "action_drafts_status_idx" ON "action_drafts"("status");

-- CreateIndex
CREATE INDEX "approvals_workspace_id_status_idx" ON "approvals"("workspace_id", "status");

-- CreateIndex
CREATE INDEX "approvals_action_item_id_idx" ON "approvals"("action_item_id");

-- CreateIndex
CREATE INDEX "executions_workspace_id_status_idx" ON "executions"("workspace_id", "status");

-- CreateIndex
CREATE INDEX "executions_action_item_id_idx" ON "executions"("action_item_id");

-- CreateIndex
CREATE INDEX "audit_logs_workspace_id_event_type_idx" ON "audit_logs"("workspace_id", "event_type");

-- CreateIndex
CREATE INDEX "audit_logs_object_type_object_id_idx" ON "audit_logs"("object_type", "object_id");

-- CreateIndex
CREATE INDEX "audit_logs_created_at_idx" ON "audit_logs"("created_at");

-- CreateIndex
CREATE INDEX "job_runs_workspace_id_status_idx" ON "job_runs"("workspace_id", "status");

-- CreateIndex
CREATE INDEX "job_runs_queue_name_job_name_idx" ON "job_runs"("queue_name", "job_name");

-- CreateIndex
CREATE INDEX "failure_events_workspace_id_status_idx" ON "failure_events"("workspace_id", "status");

-- CreateIndex
CREATE INDEX "failure_events_source_event_type_idx" ON "failure_events"("source", "event_type");

-- CreateIndex
CREATE INDEX "conversations_workspace_id_idx" ON "conversations"("workspace_id");

-- CreateIndex
CREATE INDEX "memories_workspace_id_idx" ON "memories"("workspace_id");
