import type { LucideIcon } from "lucide-react";
import { AppShell } from "@/components/shell/app-shell";

export function PlaceholderPage({
  title,
  label,
  icon: Icon,
  children,
}: {
  title: string;
  label: string;
  icon: LucideIcon;
  children: React.ReactNode;
}) {
  return (
    <AppShell>
      <section className="min-h-svh px-6 py-8 lg:px-10">
        <div className="mx-auto max-w-5xl rounded-3xl border border-border bg-card p-8 shadow-sm">
          <div className="mb-5 inline-flex items-center gap-2 rounded-full border border-border bg-background px-3 py-1 text-xs text-muted-foreground">
            <Icon className="size-3.5" />
            {label}
          </div>
          <h1 className="font-display text-5xl leading-none tracking-[-0.04em] md:text-6xl">
            {title}
          </h1>
          <div className="mt-5 max-w-2xl text-sm leading-6 text-muted-foreground">
            {children}
          </div>
        </div>
      </section>
    </AppShell>
  );
}
