/**
 * Node keys (used inside LangGraph) ↔ Greek display names (surfaced to the UI).
 *
 * File/class names stay descriptive per the user's standing Phase 0.2 rule;
 * the Greek labels are cosmetic and live only in this one map. If the product
 * ever drops the mythology branding, only this file changes.
 */

export const AGENT_LABELS = {
  planner: "Herald",
  comms: "Iris",
  code: "Talos",
  ops: "Argus",
} as const;

export type AgentKey = keyof typeof AGENT_LABELS;

export const SPECIALIST_KEYS = ["comms", "code", "ops"] as const satisfies readonly AgentKey[];
export type SpecialistKey = (typeof SPECIALIST_KEYS)[number];

export function labelOf(key: string): string {
  return (AGENT_LABELS as Record<string, string>)[key] ?? key;
}
