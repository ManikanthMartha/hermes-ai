-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateExtension
CREATE EXTENSION IF NOT EXISTS "plpgsql" WITH SCHEMA "pg_catalog" VERSION "1.0";

-- CreateExtension
CREATE EXTENSION IF NOT EXISTS "vector" WITH SCHEMA "public" VERSION "0.8.0";

-- CreateTable
CREATE TABLE "public"."conversations" (
    "id" UUID NOT NULL,
    "title" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "summary" TEXT,
    "user_id" VARCHAR(100) NOT NULL DEFAULT 'local-user',

    CONSTRAINT "conversations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."document_chunks" (
    "id" UUID NOT NULL,
    "document_id" UUID NOT NULL,
    "content" TEXT NOT NULL,
    "chunk_index" INTEGER NOT NULL,
    "metadata" JSONB NOT NULL DEFAULT '{}',
    "embedding" vector(1536),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "document_chunks_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."documents" (
    "id" UUID NOT NULL,
    "title" TEXT,
    "source_url" TEXT,
    "content_type" VARCHAR(20),
    "chunk_count" INTEGER NOT NULL DEFAULT 0,
    "ingested_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "documents_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."events" (
    "id" UUID NOT NULL,
    "source" VARCHAR(50) NOT NULL,
    "event_type" VARCHAR(100) NOT NULL,
    "payload" JSONB NOT NULL,
    "processed" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "events_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."memories" (
    "id" UUID NOT NULL,
    "content" TEXT NOT NULL,
    "source" VARCHAR(50),
    "category" VARCHAR(50),
    "metadata" JSONB NOT NULL DEFAULT '{}',
    "embedding" vector(1536),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "confidence" DOUBLE PRECISION NOT NULL DEFAULT 0.7,
    "predicate" VARCHAR(100),
    "source_id" VARCHAR(200),
    "source_type" VARCHAR(50),
    "status" VARCHAR(30) NOT NULL DEFAULT 'active',
    "subject" VARCHAR(200),
    "supersedes_memory_id" UUID,
    "user_id" VARCHAR(100) NOT NULL DEFAULT 'local-user',
    "valid_from" TIMESTAMP(3),
    "valid_until" TIMESTAMP(3),
    "value" TEXT,

    CONSTRAINT "memories_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."messages" (
    "id" UUID NOT NULL,
    "conversation_id" UUID NOT NULL,
    "role" VARCHAR(20) NOT NULL,
    "content" TEXT NOT NULL,
    "tool_calls" JSONB,
    "metadata" JSONB NOT NULL DEFAULT '{}',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "name" VARCHAR(100),

    CONSTRAINT "messages_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "conversations_user_id_idx" ON "public"."conversations"("user_id" ASC);

-- CreateIndex
CREATE INDEX "events_processed_idx" ON "public"."events"("processed" ASC);

-- CreateIndex
CREATE INDEX "events_source_event_type_idx" ON "public"."events"("source" ASC, "event_type" ASC);

-- CreateIndex
CREATE INDEX "memories_category_idx" ON "public"."memories"("category" ASC);

-- CreateIndex
CREATE INDEX "memories_status_idx" ON "public"."memories"("status" ASC);

-- CreateIndex
CREATE INDEX "memories_subject_predicate_idx" ON "public"."memories"("subject" ASC, "predicate" ASC);

-- CreateIndex
CREATE INDEX "memories_user_id_idx" ON "public"."memories"("user_id" ASC);

-- CreateIndex
CREATE INDEX "messages_conversation_id_idx" ON "public"."messages"("conversation_id" ASC);

-- AddForeignKey
ALTER TABLE "public"."document_chunks" ADD CONSTRAINT "document_chunks_document_id_fkey" FOREIGN KEY ("document_id") REFERENCES "public"."documents"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."memories" ADD CONSTRAINT "memories_supersedes_memory_id_fkey" FOREIGN KEY ("supersedes_memory_id") REFERENCES "public"."memories"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."messages" ADD CONSTRAINT "messages_conversation_id_fkey" FOREIGN KEY ("conversation_id") REFERENCES "public"."conversations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
