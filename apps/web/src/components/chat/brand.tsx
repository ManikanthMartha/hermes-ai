import { cn } from "@hermes/ui/lib/utils";

/**
 * Hermes wordmark, terminal-styled. The caduceus — two snakes twined around
 * a staff — is rendered in ASCII as a pair of `~` above a `│`. The copper
 * character on the left is the only brand color on this line.
 */
export function Brand({ className }: { className?: string }) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-2 text-sm leading-none tracking-tight select-none",
        className,
      )}
    >
      <span
        aria-hidden
        className="text-hermes font-medium"
        style={{ textShadow: "0 0 6px color-mix(in oklch, var(--hermes) 45%, transparent)" }}
      >
        ⟁
      </span>
      <span className="text-foreground font-medium">hermes</span>
      <span className="text-muted-foreground/80 text-[11px] tracking-[0.12em] uppercase">
        v0.1
      </span>
    </span>
  );
}
