import { z } from "zod";

export const jsonRecordSchema = z.record(z.string(), z.unknown());
export const actionLevelSchema = z.enum(["low", "medium", "high", "critical"]);

export const createActionSchema = z.object({
  title: z.string().trim().min(1),
  actionType: z.string().trim().min(1).default("manual"),
  summary: z.string().trim().optional(),
  reason: z.string().trim().optional(),
  impactLevel: actionLevelSchema.default("medium"),
  riskLevel: actionLevelSchema.default("medium"),
  confidenceScore: z.number().min(0).max(1).optional(),
  sourceIds: z.array(z.string()).default([]),
  draftPayload: jsonRecordSchema.optional(),
  approvalRequired: z.boolean().default(true),
  status: z
    .enum(["detected", "drafted", "pending_approval", "approved"])
    .optional(),
  dueAt: z.string().trim().optional(),
  idempotencyKey: z.string().trim().optional(),
  metadata: jsonRecordSchema.default({}),
});

export const actionDecisionSchema = z.object({
  reason: z.string().trim().optional(),
  finalPayload: jsonRecordSchema.optional(),
});

export const snoozeActionSchema = z.object({
  snoozedUntil: z.string().trim().min(1),
  reason: z.string().trim().optional(),
});

export type CreateActionInput = z.infer<typeof createActionSchema>;
export type ActionDecisionInput = z.infer<typeof actionDecisionSchema>;
export type SnoozeActionInput = z.infer<typeof snoozeActionSchema>;
