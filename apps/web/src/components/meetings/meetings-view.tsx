"use client";

import {
  CalendarClockIcon,
  CheckCircle2Icon,
  ExternalLinkIcon,
  FileTextIcon,
  Loader2Icon,
  MessageSquareTextIcon,
  RefreshCwIcon,
  SearchIcon,
  SparklesIcon,
  UsersIcon,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import type { Meeting, MeetingBrief } from "@/lib/meeting-types";

export function MeetingsView() {
  const [meetings, setMeetings] = useState<Meeting[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const loadMeetings = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/meetings?limit=80", { cache: "no-store" });
      if (!res.ok) throw new Error(`meetings ${res.status}`);
      const data = (await res.json()) as { meetings?: Meeting[] };
      const next = data.meetings ?? [];
      setMeetings(next);
      setSelectedId((current) =>
        current && next.some((meeting) => meeting.id === current)
          ? current
          : next[0]?.id ?? null,
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : "failed to load meetings");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadMeetings();
  }, [loadMeetings]);

  const selected = useMemo(
    () => meetings.find((meeting) => meeting.id === selectedId) ?? meetings[0],
    [meetings, selectedId],
  );

  const preparedCount = meetings.filter(
    (meeting) => meeting.prepStatus === "prepared",
  ).length;

  const syncCalendar = async () => {
    setBusy("sync");
    setError(null);
    try {
      const res = await fetch("/api/calendar/sync-now", { method: "POST" });
      if (!res.ok) throw new Error(`calendar sync ${res.status}`);
      await loadMeetings();
    } catch (err) {
      setError(err instanceof Error ? err.message : "failed to sync calendar");
    } finally {
      setBusy(null);
    }
  };

  const prepare = async (id: string) => {
    setBusy(`prepare:${id}`);
    setError(null);
    try {
      const res = await fetch(`/api/meetings/${encodeURIComponent(id)}/prepare`, {
        method: "POST",
      });
      if (!res.ok) throw new Error(`prepare ${res.status}`);
      await loadMeetings();
      setSelectedId(id);
    } catch (err) {
      setError(err instanceof Error ? err.message : "failed to prepare meeting");
    } finally {
      setBusy(null);
    }
  };

  return (
    <div className="min-h-svh overflow-x-hidden bg-background text-foreground">
      <header className="border-b border-border/70 bg-[linear-gradient(180deg,color-mix(in_oklch,var(--card)_78%,transparent),transparent)] px-4 py-6 sm:px-6 lg:px-8">
        <div className="mx-auto flex w-full max-w-[min(1480px,calc(100vw-2rem))] min-w-0 flex-col gap-5 xl:flex-row xl:items-end xl:justify-between">
          <div className="min-w-0">
            <div className="mb-4 flex flex-wrap items-center gap-2">
              <span className="inline-flex h-7 items-center gap-2 border border-hermes/40 bg-hermes/10 px-2.5 text-[11px] uppercase text-hermes">
                <CalendarClockIcon className="size-3.5" />
                Calendar + Slack
              </span>
              <span className="inline-flex h-7 items-center border border-border/70 bg-card/60 px-2.5 text-[11px] text-muted-foreground">
                {meetings.length} meetings
              </span>
              <span className="inline-flex h-7 items-center border border-border/70 bg-card/60 px-2.5 text-[11px] text-muted-foreground">
                {preparedCount} prepared
              </span>
            </div>
            <h1 className="text-3xl font-semibold tracking-normal sm:text-4xl">
              Meeting Prep
            </h1>
            <p className="mt-3 max-w-[23rem] break-words text-sm leading-6 text-muted-foreground sm:max-w-3xl">
              Calendar events enriched with Slack context, agenda notes, risks,
              and follow-ups.
            </p>
          </div>

          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => void loadMeetings()}
              disabled={loading}
              className="inline-flex h-10 items-center gap-2 border border-border bg-card/80 px-3 text-xs text-muted-foreground transition-colors hover:border-hermes/50 hover:text-foreground disabled:opacity-60"
            >
              <RefreshCwIcon className="size-3.5" />
              Refresh
            </button>
            <button
              type="button"
              onClick={() => void syncCalendar()}
              disabled={busy === "sync"}
              className="inline-flex h-10 items-center gap-2 bg-hermes px-3 text-xs font-medium text-hermes-foreground transition-opacity disabled:opacity-60"
            >
              {busy === "sync" ? (
                <Loader2Icon className="size-3.5 animate-spin" />
              ) : (
                <CalendarClockIcon className="size-3.5" />
              )}
              Sync calendar
            </button>
          </div>
        </div>

        {error && (
          <div className="mx-auto mt-4 w-full max-w-[min(1480px,calc(100vw-2rem))] border border-destructive/50 bg-destructive/10 px-3 py-2 text-xs text-destructive">
            {error}
          </div>
        )}
      </header>

      <main className="mx-auto w-full max-w-[min(1480px,calc(100vw-2rem))] space-y-5 py-5">
        <MeetingStrip
          meetings={meetings}
          selectedId={selected?.id ?? null}
          loading={loading}
          onSelect={setSelectedId}
        />

        {selected ? (
          <MeetingWorkspace
            meeting={selected}
            preparing={busy === `prepare:${selected.id}`}
            onPrepare={() => prepare(selected.id)}
          />
        ) : (
          <EmptyWorkspace />
        )}
      </main>
    </div>
  );
}

function MeetingStrip({
  meetings,
  selectedId,
  loading,
  onSelect,
}: {
  meetings: Meeting[];
  selectedId: string | null;
  loading: boolean;
  onSelect: (id: string) => void;
}) {
  return (
    <section className="border border-border/70 bg-card/35">
      <div className="flex items-center justify-between border-b border-border/70 px-4 py-3">
        <div className="flex items-center gap-2 text-xs uppercase text-muted-foreground">
          <CalendarClockIcon className="size-3.5 text-hermes" />
          Upcoming meetings
        </div>
        <span className="text-[11px] text-muted-foreground">
          {meetings.length || "none"}
        </span>
      </div>

      {loading ? (
        <div className="grid gap-3 p-3 md:grid-cols-2 xl:grid-cols-3">
          {Array.from({ length: 3 }).map((_, index) => (
            <div key={index} className="h-28 border border-border/60 bg-muted/40" />
          ))}
        </div>
      ) : meetings.length ? (
        <div className="grid gap-3 p-3 md:grid-cols-2 2xl:grid-cols-3">
          {meetings.map((meeting) => {
            const active = selectedId === meeting.id;
            return (
              <button
                key={meeting.id}
                type="button"
                onClick={() => onSelect(meeting.id)}
                className={`min-w-0 border px-4 py-3 text-left transition-colors ${
                  active
                    ? "border-hermes/70 bg-hermes/10"
                    : "border-border/70 bg-background/35 hover:border-hermes/40"
                }`}
              >
                <div className="mb-3 flex items-start justify-between gap-3">
                  <h2 className="line-clamp-2 text-sm font-medium leading-5">
                    {meeting.title}
                  </h2>
                  <PrepPill status={meeting.prepStatus} />
                </div>
                <div className="flex flex-wrap gap-x-4 gap-y-2 text-xs text-muted-foreground">
                  <span>{formatCompactDate(meeting.startAt)}</span>
                  <span>
                    {meeting.attendeeEmails.length
                      ? `${meeting.attendeeEmails.length} attendees`
                      : "No attendees"}
                  </span>
                </div>
              </button>
            );
          })}
        </div>
      ) : (
        <div className="p-5 text-sm text-muted-foreground">
          No meetings loaded. Sync Calendar to fetch upcoming events.
        </div>
      )}
    </section>
  );
}

function MeetingWorkspace({
  meeting,
  preparing,
  onPrepare,
}: {
  meeting: Meeting;
  preparing: boolean;
  onPrepare: () => void | Promise<void>;
}) {
  const brief = meeting.latestBrief;
  const sourceCount = brief?.sourceIds.length ?? (meeting.calendarSourceObjectId ? 1 : 0);

  return (
    <section className="space-y-5">
      <div className="border border-border/70 bg-card/55">
        <div className="grid gap-6 p-5 lg:grid-cols-[minmax(0,1fr)_minmax(280px,360px)] xl:p-7">
          <div className="min-w-0">
            <div className="mb-4 flex flex-wrap items-center gap-2">
              <PrepPill status={meeting.prepStatus} />
              <span className="inline-flex h-7 items-center border border-border/70 bg-background/45 px-2.5 text-[11px] text-muted-foreground">
                {formatFullDate(meeting.startAt)}
              </span>
              {meeting.endAt && (
                <span className="inline-flex h-7 items-center border border-border/70 bg-background/45 px-2.5 text-[11px] text-muted-foreground">
                  {formatTime(meeting.startAt)} - {formatTime(meeting.endAt)}
                </span>
              )}
            </div>

            <h2 className="max-w-5xl text-3xl font-semibold leading-tight tracking-normal md:text-5xl">
              {meeting.title}
            </h2>

            <div className="mt-6 flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => void onPrepare()}
                disabled={preparing}
                className="inline-flex h-10 items-center gap-2 bg-hermes px-3 text-xs font-medium text-hermes-foreground transition-opacity disabled:opacity-60"
              >
                {preparing ? (
                  <Loader2Icon className="size-3.5 animate-spin" />
                ) : (
                  <SparklesIcon className="size-3.5" />
                )}
                Prepare from Slack
              </button>
              {meeting.htmlLink && (
                <ExternalLink href={meeting.htmlLink} label="Calendar" />
              )}
              {meeting.meetingUrl && (
                <ExternalLink href={meeting.meetingUrl} label="Join link" />
              )}
            </div>
          </div>

          <div className="grid grid-cols-3 gap-2 lg:grid-cols-1">
            <Metric label="Attendees" value={`${meeting.attendeeEmails.length}`} />
            <Metric label="Sources" value={`${sourceCount}`} />
            <Metric
              label="Prepared"
              value={meeting.lastPreparedAt ? relativeTime(meeting.lastPreparedAt) : "Not yet"}
            />
          </div>
        </div>
      </div>

      <div className="grid gap-5 xl:grid-cols-[minmax(0,1.35fr)_minmax(360px,0.65fr)]">
        <CalendarDetails meeting={meeting} />
        <PeoplePanel meeting={meeting} />
      </div>

      {brief ? <BriefDocument brief={brief} /> : <PrepEmptyState />}

      {brief && <EvidencePanel brief={brief} />}
    </section>
  );
}

function CalendarDetails({ meeting }: { meeting: Meeting }) {
  return (
    <section className="border border-border/70 bg-card/40 p-5">
      <div className="mb-3 flex items-center gap-2 text-xs uppercase text-muted-foreground">
        <FileTextIcon className="size-3.5 text-hermes" />
        Calendar details
      </div>
      <p className="max-w-5xl whitespace-pre-wrap text-sm leading-7 text-muted-foreground">
        {meeting.description || "No calendar description."}
      </p>
    </section>
  );
}

function PeoplePanel({ meeting }: { meeting: Meeting }) {
  return (
    <section className="border border-border/70 bg-card/40 p-5">
      <div className="mb-3 flex items-center gap-2 text-xs uppercase text-muted-foreground">
        <UsersIcon className="size-3.5 text-hermes" />
        People
      </div>
      {meeting.attendeeEmails.length ? (
        <div className="flex flex-wrap gap-2">
          {meeting.attendeeEmails.slice(0, 12).map((email) => (
            <span
              key={email}
              className="max-w-full truncate border border-border/70 bg-background/45 px-2.5 py-1.5 text-xs text-muted-foreground"
            >
              {email}
            </span>
          ))}
        </div>
      ) : (
        <p className="text-sm leading-7 text-muted-foreground">
          No attendees visible.
        </p>
      )}
    </section>
  );
}

function BriefDocument({ brief }: { brief: MeetingBrief }) {
  return (
    <section className="space-y-5">
      <div className="border border-border/70 bg-card/55 p-5 xl:p-7">
        <div className="mb-4 flex items-center gap-2 text-xs uppercase text-muted-foreground">
          <CheckCircle2Icon className="size-3.5 text-hermes" />
          Prep brief
        </div>
        <p className="max-w-5xl text-base leading-8 text-foreground/90">
          {brief.summary ?? "No summary generated."}
        </p>
      </div>

      <div className="grid gap-5 xl:grid-cols-2">
        <ListPanel title="Agenda" items={asStringArray(brief.agenda)} />
        <ListPanel title="Open questions" items={asStringArray(brief.openQuestions)} />
        <ListPanel title="Risks" items={asStringArray(brief.risks)} />
        <ListPanel title="Follow ups" items={asStringArray(brief.followUps)} />
      </div>
    </section>
  );
}

function EvidencePanel({ brief }: { brief: MeetingBrief }) {
  const queries = asStringArray(brief.slackQueries).slice(0, 8);
  const sources = brief.sourceIds.slice(0, 10);
  const hidden = Math.max(0, brief.sourceIds.length - sources.length);

  return (
    <section className="grid gap-5 xl:grid-cols-2">
      <div className="border border-border/70 bg-card/40 p-5">
        <div className="mb-4 flex items-center gap-2 text-xs uppercase text-muted-foreground">
          <MessageSquareTextIcon className="size-3.5 text-hermes" />
          Slack searches
        </div>
        {queries.length ? (
          <div className="grid gap-2 sm:grid-cols-2">
            {queries.map((query, index) => (
              <div
                key={`${query}-${index}`}
                className="border border-border/70 bg-background/45 px-3 py-2 text-xs leading-5 text-muted-foreground"
              >
                {query}
              </div>
            ))}
          </div>
        ) : (
          <p className="text-sm leading-7 text-muted-foreground">
            No Slack search recorded.
          </p>
        )}
      </div>

      <div className="border border-border/70 bg-card/40 p-5">
        <div className="mb-4 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2 text-xs uppercase text-muted-foreground">
            <SearchIcon className="size-3.5 text-hermes" />
            Source trail
          </div>
          <span className="text-[11px] text-muted-foreground">
            {brief.sourceIds.length}
          </span>
        </div>
        {sources.length ? (
          <div className="grid gap-2 sm:grid-cols-2">
            {sources.map((source) => (
              <div
                key={source}
                className="min-w-0 border border-border/70 bg-background/45 px-3 py-2 font-mono text-[11px] text-muted-foreground"
                title={source}
              >
                <div className="truncate">{source}</div>
              </div>
            ))}
            {hidden > 0 && (
              <div className="border border-border/70 bg-background/30 px-3 py-2 text-xs text-muted-foreground">
                +{hidden} more sources
              </div>
            )}
          </div>
        ) : (
          <p className="text-sm leading-7 text-muted-foreground">No sources.</p>
        )}
      </div>
    </section>
  );
}

function PrepEmptyState() {
  return (
    <section className="border border-dashed border-border bg-card/35 p-6">
      <div className="mb-4 grid size-10 place-items-center border border-border bg-background/50 text-hermes">
        <SearchIcon className="size-4" />
      </div>
      <h3 className="text-base font-medium">No prep generated</h3>
      <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">
        Prepare this meeting once the Calendar details are synced.
      </p>
    </section>
  );
}

function EmptyWorkspace() {
  return (
    <section className="grid min-h-[420px] place-items-center border border-border/70 bg-card/35 p-8 text-center">
      <div>
        <div className="mx-auto mb-4 grid size-12 place-items-center border border-border bg-background/50 text-hermes">
          <CalendarClockIcon className="size-5" />
        </div>
        <h2 className="text-lg font-medium">No meeting selected</h2>
        <p className="mt-2 max-w-sm text-sm leading-6 text-muted-foreground">
          Sync Calendar to load upcoming meetings.
        </p>
      </div>
    </section>
  );
}

function ListPanel({ title, items }: { title: string; items: string[] }) {
  return (
    <section className="border border-border/70 bg-card/45 p-5 xl:p-6">
      <div className="mb-5 text-xs uppercase text-muted-foreground">{title}</div>
      {items.length ? (
        <div className="space-y-4">
          {items.map((item, index) => (
            <div
              key={`${item}-${index}`}
              className="grid grid-cols-[28px_minmax(0,1fr)] gap-4 text-sm leading-7 text-muted-foreground"
            >
              <span className="mt-0.5 grid size-6 place-items-center border border-border bg-background/45 text-[10px] text-hermes">
                {index + 1}
              </span>
              <p className="min-w-0 break-words">{item}</p>
            </div>
          ))}
        </div>
      ) : (
        <p className="text-sm leading-6 text-muted-foreground">None found.</p>
      )}
    </section>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0 border border-border/70 bg-background/45 p-3">
      <div className="text-[10px] uppercase text-muted-foreground">{label}</div>
      <div className="mt-2 truncate text-sm font-medium">{value}</div>
    </div>
  );
}

function PrepPill({ status }: { status: string }) {
  const tone =
    status === "prepared"
      ? "border-emerald-400/40 bg-emerald-400/10 text-emerald-300"
      : status === "failed"
        ? "border-destructive/50 bg-destructive/10 text-destructive"
        : status === "preparing"
          ? "border-hermes/50 bg-hermes/10 text-hermes"
          : "border-border bg-card text-muted-foreground";
  return (
    <span className={`shrink-0 border px-2 py-1 text-[10px] uppercase ${tone}`}>
      {status.replaceAll("_", " ")}
    </span>
  );
}

function ExternalLink({ href, label }: { href: string; label: string }) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noreferrer"
      className="inline-flex h-10 items-center gap-2 border border-border/70 bg-background/45 px-3 text-xs text-muted-foreground transition-colors hover:border-hermes/50 hover:text-foreground"
    >
      <ExternalLinkIcon className="size-3.5" />
      {label}
    </a>
  );
}

function asStringArray(value: unknown): string[] {
  return Array.isArray(value)
    ? value.filter((item): item is string => typeof item === "string")
    : [];
}

function formatCompactDate(value: string) {
  return new Date(value).toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

function formatFullDate(value: string) {
  return new Date(value).toLocaleDateString(undefined, {
    weekday: "short",
    month: "short",
    day: "numeric",
  });
}

function formatTime(value: string) {
  return new Date(value).toLocaleTimeString(undefined, {
    hour: "numeric",
    minute: "2-digit",
  });
}

function relativeTime(value: string) {
  const delta = Date.now() - new Date(value).getTime();
  const minutes = Math.max(0, Math.round(delta / 60_000));
  if (minutes < 1) return "Now";
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.round(hours / 24)}d ago`;
}
