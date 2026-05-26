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
      <section className="min-h-svh border-b border-border px-5 py-6 md:px-8">
        <div className="mb-3 inline-flex items-center gap-2 border border-hermes/40 bg-hermes/10 px-2.5 py-1 text-xs text-hermes">
          <Icon className="size-3.5" />
          {label}
        </div>
        <h1 className="text-2xl font-semibold md:text-4xl">{title}</h1>
        <div className="mt-4 max-w-2xl text-sm leading-6 text-muted-foreground">
          {children}
        </div>
      </section>
    </AppShell>
  );
}

