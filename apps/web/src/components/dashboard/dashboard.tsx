import Link from "next/link";
import {
  AlertTriangleIcon,
  ArrowRightIcon,
  CheckCircle2Icon,
  Clock3Icon,
  GitBranchIcon,
  InboxIcon,
  ShieldCheckIcon,
} from "lucide-react";
import { AppShell } from "@/components/shell/app-shell";

const cards = [
  {
    label: "Pending approvals",
    value: "Action Board",
    href: "/actions",
    icon: CheckCircle2Icon,
  },
  {
    label: "Connector freshness",
    value: "Trust",
    href: "/trust",
    icon: ShieldCheckIcon,
  },
  {
    label: "Next briefing",
    value: "Briefings",
    href: "/briefings",
    icon: Clock3Icon,
  },
  {
    label: "Source activity",
    value: "Connectors",
    href: "/connections",
    icon: GitBranchIcon,
  },
] as const;

export function Dashboard() {
  return (
    <AppShell>
      <div className="min-h-svh">
        <section className="border-b border-border px-5 py-6 md:px-8">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <div className="mb-3 inline-flex items-center gap-2 border border-hermes/40 bg-hermes/10 px-2.5 py-1 text-xs text-hermes">
                <InboxIcon className="size-3.5" />
                Prototype workspace
              </div>
              <h1 className="text-2xl font-semibold md:text-4xl">
                Operating board
              </h1>
              <p className="mt-3 max-w-2xl text-sm leading-6 text-muted-foreground">
                Actions, approvals, source freshness, and briefings for the
                personal Hermes prototype.
              </p>
            </div>
            <Link
              href="/actions"
              className="inline-flex h-9 w-fit items-center gap-2 bg-hermes px-3 text-xs font-medium text-hermes-foreground"
            >
              Open Action Board
              <ArrowRightIcon className="size-3.5" />
            </Link>
          </div>
        </section>

        <section className="grid gap-4 p-5 md:grid-cols-2 md:p-8 xl:grid-cols-4">
          {cards.map((card) => {
            const Icon = card.icon;
            return (
              <Link
                key={card.href}
                href={card.href}
                className="border border-border bg-card/60 p-4 transition-colors hover:border-hermes/60"
              >
                <div className="mb-6 flex items-center justify-between">
                  <Icon className="size-4 text-hermes" />
                  <ArrowRightIcon className="size-3.5 text-muted-foreground" />
                </div>
                <div className="text-xs text-muted-foreground">{card.label}</div>
                <div className="mt-2 text-lg font-medium">{card.value}</div>
              </Link>
            );
          })}
        </section>

        <section className="grid gap-4 px-5 pb-8 md:grid-cols-[minmax(0,1fr)_360px] md:px-8">
          <div className="border border-border bg-card/50 p-5">
            <div className="mb-4 flex items-center gap-2 text-sm font-medium">
              <CheckCircle2Icon className="size-4 text-hermes" />
              Prototype path
            </div>
            <div className="grid gap-3 text-sm text-muted-foreground">
              <Row label="1" value="Action Board approval loop" done />
              <Row label="2" value="Connector watches and source objects" />
              <Row label="3" value="Generated actions from Gmail, Calendar, Slack" />
              <Row label="4" value="Morning briefing and meeting prep" />
            </div>
          </div>

          <div className="border border-border bg-card/50 p-5">
            <div className="mb-4 flex items-center gap-2 text-sm font-medium">
              <AlertTriangleIcon className="size-4 text-hermes" />
              Trust posture
            </div>
            <p className="text-sm leading-6 text-muted-foreground">
              External writes remain approval gated. Connector failures and
              stale data must surface in Trust before demos.
            </p>
          </div>
        </section>
      </div>
    </AppShell>
  );
}

function Row({
  label,
  value,
  done = false,
}: {
  label: string;
  value: string;
  done?: boolean;
}) {
  return (
    <div className="flex items-center gap-3 border border-border/70 bg-background/50 px-3 py-2">
      <span
        className={`grid size-5 place-items-center border text-[11px] ${
          done
            ? "border-hermes bg-hermes text-hermes-foreground"
            : "border-border text-muted-foreground"
        }`}
      >
        {label}
      </span>
      <span>{value}</span>
    </div>
  );
}

