"use client";

import Link from "next/link";
import {
  ArrowRightIcon,
  CalendarDaysIcon,
  CheckCircle2Icon,
  Clock3Icon,
  InboxIcon,
  Loader2Icon,
  MessageSquareIcon,
  PlugZapIcon,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { AppShell } from "@/components/shell/app-shell";
import type { ActionItem } from "@/lib/action-types";
import type { Meeting } from "@/lib/meeting-types";

export function Dashboard() {
  const { actions, meetings, loading, error } = useHomeData();
  const pendingActions = useMemo(
    () =>
      actions.filter((action) =>
        ["pending_approval", "drafted", "created"].includes(action.status),
      ),
    [actions],
  );
  const nextMeeting = meetings
    .filter((meeting) => new Date(meeting.startAt).getTime() >= Date.now())
    .sort(
      (a, b) =>
        new Date(a.startAt).getTime() - new Date(b.startAt).getTime(),
    )[0];
  const topAction = pendingActions[0] ?? actions[0];

  return (
    <AppShell>
      <main className="min-h-svh bg-background">
        <div className="mx-auto flex w-full max-w-6xl flex-col gap-5 px-6 py-6 lg:px-10">
          <section className="flex flex-col gap-3 border-b border-border pb-5 md:flex-row md:items-end md:justify-between">
            <div>
              <div className="mb-2 inline-flex items-center gap-2 rounded-full border border-border bg-card px-3 py-1 text-xs text-muted-foreground">
                {loading ? (
                  <Loader2Icon className="size-3.5 animate-spin" />
                ) : (
                  <span className="size-2 rounded-full bg-emerald-500" />
                )}
                {loading ? "Loading workspace" : "Daily briefing"}
              </div>
              <h1 className="text-3xl font-semibold tracking-[-0.02em] md:text-4xl">
                Today’s briefing
              </h1>
              <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">
                {topAction || nextMeeting
                  ? headline(pendingActions.length, nextMeeting)
                  : "Connect sources once. Hermes turns the workday into actions, meetings, and answers."}
              </p>
            </div>
            <Link
              href="/ask"
              className="inline-flex h-10 w-fit items-center gap-2 rounded-xl border border-border bg-card px-4 text-sm font-medium shadow-sm hover:border-foreground/20"
            >
              <MessageSquareIcon className="size-4" />
              Ask Hermes
            </Link>
          </section>

          {error ? (
            <div className="rounded-xl border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
              {error}
            </div>
          ) : null}

          {topAction || nextMeeting ? (
            <>
              <section className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_320px]">
                <TopActionCard action={topAction} />
                <NextMeetingCard meeting={nextMeeting} />
              </section>

              <InboxPreview actions={pendingActions.slice(0, 3)} />
            </>
          ) : (
            <EmptyHome />
          )}
        </div>
      </main>
    </AppShell>
  );
}

function TopActionCard({ action }: { action: ActionItem | undefined }) {
  if (!action) {
    return (
    <article className="rounded-2xl border border-border bg-card p-4 shadow-sm">
      <div className="mb-3 flex items-center gap-2 text-sm font-medium text-muted-foreground">
        <InboxIcon className="size-4" />
        Actions
        </div>
        <h2 className="text-2xl font-semibold tracking-tight">
          No prepared actions yet
        </h2>
        <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">
          Once Hermes detects follow-ups, drafts, or decisions from your
          sources, they will appear here for review.
        </p>
        <Link
          href="/actions"
          className="mt-5 inline-flex h-10 items-center gap-2 rounded-xl border border-border bg-card px-4 text-sm font-medium"
        >
          Open Actions
          <ArrowRightIcon className="size-4" />
        </Link>
      </article>
    );
  }

  return (
    <article className="rounded-2xl border border-border bg-card p-4 shadow-sm">
      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="mb-3 flex items-center gap-2 text-sm font-medium text-muted-foreground">
            <InboxIcon className="size-4" />
            Top action
          </div>
          <h2 className="text-xl font-semibold tracking-tight">
            {cleanText(action.title)}
          </h2>
          <p className="mt-3 max-w-2xl text-sm leading-6 text-muted-foreground">
            {actionCopy(action)}
          </p>
        </div>
        <span className="rounded-full bg-muted px-2.5 py-1 text-xs font-medium text-muted-foreground">
          {humanStatus(action.status)}
        </span>
      </div>

      <div className="mt-4 grid gap-3 rounded-xl border border-border bg-background p-3 text-sm md:grid-cols-3">
        <Fact label="Evidence" value={`${action.sourceIds.length} sources`} />
        <Fact label="Impact" value={humanLevel(action.impactLevel)} />
        <Fact label="Risk" value={humanLevel(action.riskLevel)} />
      </div>

      <div className="mt-5 flex flex-wrap gap-2">
        <Link
          href="/actions"
          className="inline-flex h-10 items-center gap-2 rounded-xl bg-primary px-4 text-sm font-medium text-primary-foreground"
        >
          Open review
          <ArrowRightIcon className="size-4" />
        </Link>
      </div>
    </article>
  );
}

function NextMeetingCard({ meeting }: { meeting: Meeting | undefined }) {
  return (
    <aside className="grid gap-5">
      <article className="rounded-2xl border border-border bg-card p-4 shadow-sm">
        <div className="mb-3 flex items-center gap-2 text-sm font-medium text-muted-foreground">
          <CalendarDaysIcon className="size-4" />
          Next meeting
        </div>
        {meeting ? (
          <>
            <h2 className="text-xl font-semibold tracking-tight">
              {meeting.title}
            </h2>
            <p className="mt-2 text-sm leading-6 text-muted-foreground">
              {formatMeetingTime(meeting.startAt)}
              {meeting.prepStatus ? ` / ${humanStatus(meeting.prepStatus)}` : ""}
            </p>
            <Link
              href="/meetings"
              className="mt-4 inline-flex h-9 items-center gap-2 rounded-lg border border-border px-3 text-sm font-medium"
            >
              Open prep
              <ArrowRightIcon className="size-4" />
            </Link>
          </>
        ) : (
          <>
            <h2 className="text-xl font-semibold tracking-tight">
              No upcoming meetings loaded
            </h2>
            <p className="mt-2 text-sm leading-6 text-muted-foreground">
              Sync calendar sources to generate meeting prep.
            </p>
            <Link
              href="/meetings"
              className="mt-4 inline-flex h-9 items-center gap-2 rounded-lg border border-border px-3 text-sm font-medium"
            >
              Open Meetings
              <ArrowRightIcon className="size-4" />
            </Link>
          </>
        )}
      </article>

      <article className="rounded-2xl border border-border bg-card p-4 shadow-sm">
        <div className="mb-3 flex items-center gap-2 text-sm font-medium text-muted-foreground">
          <CheckCircle2Icon className="size-4" />
          Source coverage
        </div>
        <p className="text-sm text-muted-foreground">
          Check connected apps, failed syncs, and permissions.
        </p>
      </article>
    </aside>
  );
}

function InboxPreview({ actions }: { actions: ActionItem[] }) {
  return (
    <section className="rounded-2xl border border-border bg-card p-4 shadow-sm">
      <div className="mb-4 flex items-center justify-between">
        <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
          <InboxIcon className="size-4" />
          Inbox preview
        </div>
        <Link href="/actions" className="text-sm font-medium">
          View all
        </Link>
      </div>
      {actions.length ? (
        <div className="divide-y divide-border rounded-2xl border border-border">
          {actions.map((action) => (
            <Link
              key={action.id}
              href="/actions"
              className="grid gap-2 px-4 py-3 transition-colors hover:bg-muted/60 md:grid-cols-[minmax(0,1fr)_160px]"
            >
              <div className="min-w-0">
                <div className="truncate text-sm font-medium">
                  {action.title}
                </div>
                <div className="mt-1 truncate text-sm text-muted-foreground">
                  {actionCopy(action)}
                </div>
              </div>
              <div className="text-sm text-muted-foreground md:text-right">
                {humanStatus(action.status)}
              </div>
            </Link>
          ))}
        </div>
      ) : (
        <div className="rounded-2xl border border-dashed border-border p-6 text-sm text-muted-foreground">
          No pending actions yet.
        </div>
      )}
    </section>
  );
}

function EmptyHome() {
  return (
    <section className="rounded-2xl border border-dashed border-border bg-card/70 p-6 text-center shadow-sm">
      <PlugZapIcon className="mx-auto size-8 text-muted-foreground" />
      <h2 className="mt-4 text-xl font-semibold">Start by connecting sources</h2>
      <p className="mx-auto mt-2 max-w-xl text-sm leading-6 text-muted-foreground">
        Hermes needs source access before it can prepare briefings, actions,
        and meeting context.
      </p>
      <div className="mt-5 flex justify-center gap-2">
        <Link
          href="/connections"
          className="inline-flex h-10 items-center rounded-xl bg-primary px-4 text-sm font-medium text-primary-foreground"
        >
          Open Sources
        </Link>
        <Link
          href="/ask"
          className="inline-flex h-10 items-center rounded-xl border border-border bg-card px-4 text-sm font-medium"
        >
          Ask Hermes
        </Link>
      </div>
    </section>
  );
}

function Fact({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className="mt-1 font-medium">{value}</div>
    </div>
  );
}

function headline(actionCount: number, meeting: Meeting | undefined) {
  if (actionCount > 0) {
    return `${actionCount} ${actionCount === 1 ? "action needs" : "actions need"} attention.`;
  }
  if (meeting) return "Your next meeting is ready for prep.";
  return "Your workspace is ready.";
}

function humanStatus(value: string) {
  return value.replace(/_/g, " ").replace(/\b\w/g, (char) => char.toUpperCase());
}

function humanLevel(value: string) {
  return value ? humanStatus(value) : "Unknown";
}

function actionCopy(action: ActionItem) {
  const raw = action.summary ?? action.reason ?? "";
  const cleaned = cleanText(raw);
  if (!cleaned) return "Hermes prepared this item for review.";
  if (/gmail connector/i.test(cleaned)) {
    return "A recent email may need your review before anything is sent.";
  }
  return cleaned;
}

function cleanText(value: string) {
  return value
    .replaceAll("&#39;", "'")
    .replaceAll("&quot;", '"')
    .replaceAll("&amp;", "&")
    .replace(/\s+/g, " ")
    .trim();
}

function formatMeetingTime(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Time unavailable";
  return new Intl.DateTimeFormat(undefined, {
    weekday: "short",
    hour: "numeric",
    minute: "2-digit",
  }).format(date);
}

function useHomeData() {
  const [actions, setActions] = useState<ActionItem[]>([]);
  const [meetings, setMeetings] = useState<Meeting[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      setLoading(true);
      setError(null);
      try {
        const [actionsRes, meetingsRes] = await Promise.all([
          fetch("/api/actions?limit=5", { cache: "no-store" }),
          fetch("/api/meetings?limit=5", { cache: "no-store" }),
        ]);
        if (!actionsRes.ok) throw new Error(`actions ${actionsRes.status}`);
        if (!meetingsRes.ok) throw new Error(`meetings ${meetingsRes.status}`);
        const actionsData = (await actionsRes.json()) as { actions?: ActionItem[] };
        const meetingsData = (await meetingsRes.json()) as { meetings?: Meeting[] };
        if (!cancelled) {
          setActions(actionsData.actions ?? []);
          setMeetings(meetingsData.meetings ?? []);
        }
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : "Failed to load home data");
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    void load();
    return () => {
      cancelled = true;
    };
  }, []);

  return { actions, meetings, loading, error };
}
