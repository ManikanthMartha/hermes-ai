"use client";

import { cn } from "@hermes/ui/lib/utils";

const AGENT_LABELS: Record<string, string> = {
  comms: "Iris",
  code: "Talos",
  ops: "Argus",
  planner: "Herald",
};

/**
 * Small inline chip that announces which specialist has control right now.
 * Rendered between tool calls / text blocks when `data-agent-start` fires;
 * a matching `data-agent-end` marks it complete (dimmed + check).
 */
export function AgentChip({
  agent,
  state,
}: {
  agent: string;
  state: "running" | "complete";
}) {
  const label = AGENT_LABELS[agent] ?? agent;
  return (
    <div
      className={cn(
        "my-1 inline-flex items-center gap-2 font-mono text-[10.5px] uppercase tracking-[0.18em]",
        state === "running" ? "text-hermes" : "text-muted-foreground/60",
      )}
    >
      <span aria-hidden className="select-none">
        {state === "running" ? "▸" : "✓"}
      </span>
      <span>
        {state === "running" ? "running" : "done"} · {label}
      </span>
      {state === "running" && <span className="blink text-[11px]">▮</span>}
    </div>
  );
}

/**
 * Herald's routing explanation — appears right after the supervisor picks a
 * specialist. Dim + italicized to read as a stage direction, not content.
 */
export function RoutingNote({ reason }: { reason: string }) {
  return (
    <div className="text-muted-foreground/70 my-1 pl-4 font-mono text-[11px] italic">
      <span className="text-hermes/70 not-italic">↳</span> Herald: {reason}
    </div>
  );
}
