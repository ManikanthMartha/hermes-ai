"use client";

import {
  CheckIcon,
  Clock3Icon,
  FileTextIcon,
  FileClockIcon,
  HistoryIcon,
  ListChecksIcon,
  RefreshCwIcon,
  SendIcon,
  ShieldCheckIcon,
  SlidersHorizontalIcon,
  UserPlusIcon,
  XIcon,
} from "lucide-react";
import type { ReactNode } from "react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { ActionItem, AuditEvent } from "@/lib/action-types";

const STATUS_FILTERS = [
  "all",
  "pending_approval",
  "drafted",
  "approved",
  "rejected",
  "snoozed",
  "delegated",
] as const;

type StatusFilter = (typeof STATUS_FILTERS)[number];
type DetailTab = "summary" | "draft" | "evidence" | "history";

export function ActionBoard() {
  const [actions, setActions] = useState<ActionItem[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [audit, setAudit] = useState<AuditEvent[]>([]);
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const auditRequestRef = useRef(0);

  const loadActions = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const query =
        statusFilter === "all"
          ? "?limit=80"
          : `?limit=80&status=${encodeURIComponent(statusFilter)}`;
      const res = await fetch(`/api/actions${query}`, { cache: "no-store" });
      if (!res.ok) throw new Error(`actions ${res.status}`);
      const data = (await res.json()) as { actions?: ActionItem[] };
      const next = data.actions ?? [];
      setActions(next);
      setSelectedId((id) =>
        id && next.some((action) => action.id === id)
          ? id
          : next[0]?.id ?? null,
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : "failed to load actions");
    } finally {
      setLoading(false);
    }
  }, [statusFilter]);

  useEffect(() => {
    void loadActions();
  }, [loadActions]);

  const selected = useMemo(
    () => actions.find((action) => action.id === selectedId) ?? actions[0],
    [actions, selectedId],
  );

  const loadAudit = useCallback(async (id: string) => {
    const requestId = auditRequestRef.current + 1;
    auditRequestRef.current = requestId;
    setAudit([]);
    const res = await fetch(`/api/actions/${encodeURIComponent(id)}/audit`, {
      cache: "no-store",
    });
    if (auditRequestRef.current !== requestId) return;
    if (!res.ok) {
      setAudit([]);
      return;
    }
    const data = (await res.json()) as { audit?: AuditEvent[] };
    if (auditRequestRef.current !== requestId) return;
    setAudit(data.audit ?? []);
  }, []);

  useEffect(() => {
    if (selected?.id) void loadAudit(selected.id);
  }, [selected?.id, loadAudit]);

  const mutateAction = async (
    id: string,
    path: "approve" | "reject" | "snooze" | "delegate",
    body: Record<string, unknown>,
  ) => {
    setSaving(path);
    setError(null);
    try {
      const res = await fetch(`/api/actions/${encodeURIComponent(id)}/${path}`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!res.ok) throw new Error(`${path} ${res.status}`);
      await loadActions();
      if (statusFilter === "all") await loadAudit(id);
    } catch (err) {
      setError(err instanceof Error ? err.message : `failed to ${path}`);
    } finally {
      setSaving(null);
    }
  };

  const updateDraft = async (id: string, draftText: string) => {
    setSaving("update");
    setError(null);
    try {
      const original = actions.find((action) => action.id === id)?.draftPayload;
      const draftPayload = draftPayloadFromText(original, draftText);
      const res = await fetch(`/api/actions/${encodeURIComponent(id)}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ draftPayload }),
      });
      if (!res.ok) throw new Error(`update ${res.status}`);
      const data = (await res.json()) as { action: ActionItem };
      setActions((items) =>
        items.map((item) => (item.id === id ? data.action : item)),
      );
      await loadAudit(id);
    } catch (err) {
      setError(err instanceof Error ? err.message : "failed to update draft");
    } finally {
      setSaving(null);
    }
  };

  return (
    <main className="min-h-svh bg-background text-foreground">
      <section className="px-6 py-5 lg:px-10">
        <div className="mx-auto flex max-w-5xl flex-col gap-4 border-b border-border pb-5 md:flex-row md:items-end md:justify-between">
          <div className="max-w-3xl">
            <div className="mb-2 inline-flex items-center gap-2 rounded-full border border-border bg-card px-3 py-1 text-xs text-muted-foreground">
              <ShieldCheckIcon className="size-3" />
              approval desk
            </div>
            <h1 className="text-3xl font-semibold tracking-[-0.02em] md:text-4xl">
              Approval desk
            </h1>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">
              Review work Hermes prepared, inspect the evidence, edit the
              draft, and decide what is allowed to happen outside Hermes.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => void loadActions()}
              className="inline-flex h-9 items-center gap-2 rounded-lg border border-border bg-background px-3 text-xs font-medium text-muted-foreground transition-colors hover:border-hermes/50 hover:text-foreground"
            >
              <RefreshCwIcon className="size-3.5" />
              refresh
            </button>
          </div>
        </div>
      </section>

      <section className="mx-auto grid min-h-[calc(100svh-150px)] max-w-[min(1480px,calc(100vw-2rem))] grid-cols-1 border border-border bg-card lg:grid-cols-[390px_minmax(0,1fr)]">
        <aside className="border-b border-border lg:border-b-0 lg:border-r">
          <div className="border-b border-border/70 p-3">
            <div className="mb-2 flex items-center gap-2 text-xs font-medium text-muted-foreground">
              <SlidersHorizontalIcon className="size-3.5" />
              Review list
            </div>
            <div className="flex flex-wrap gap-2">
              {STATUS_FILTERS.map((status) => (
                <button
                  key={status}
                  type="button"
                  onClick={() => setStatusFilter(status)}
                  className={`rounded-full border px-2.5 py-1 text-[11px] transition-colors ${
                    statusFilter === status
                      ? "border-foreground bg-foreground text-background"
                      : "border-border bg-card text-muted-foreground hover:text-foreground"
                  }`}
                >
                  {label(status)}
                </button>
              ))}
            </div>
          </div>

          {error && (
            <div className="m-4 border border-destructive/50 bg-destructive/10 px-3 py-2 text-xs text-destructive">
              {error}
            </div>
          )}

          <div className="divide-y divide-border">
            {loading ? (
              <ActionListSkeleton />
            ) : actions.length ? (
              actions.map((action) => (
                <button
                  key={action.id}
                  type="button"
                  onClick={() => setSelectedId(action.id)}
                  className={`block w-full px-4 py-4 text-left transition-colors ${
                    selected?.id === action.id
                      ? "bg-hermes/10"
                      : "hover:bg-card/70"
                  }`}
                >
                  <div className="mb-2 flex items-start justify-between gap-3">
                    <h2 className="line-clamp-2 text-sm font-semibold">
                      {cleanText(action.title)}
                    </h2>
                    <StatusPill status={action.status} />
                  </div>
                  <p className="line-clamp-2 text-xs leading-5 text-muted-foreground">
                    {cleanText(action.summary ?? action.reason ?? "No summary yet.")}
                  </p>
                  <div className="mt-3 flex items-center justify-between text-[11px] text-muted-foreground">
                    <span>{humanActionType(action.actionType)}</span>
                    <span>{relativeTime(action.updatedAt)}</span>
                  </div>
                </button>
              ))
            ) : (
              <div className="p-6 text-sm text-muted-foreground">
                No actions match this filter.
              </div>
            )}
          </div>
        </aside>

        <section className="min-w-0">
          {selected ? (
            <ActionDetail
              action={selected}
              audit={audit}
              saving={saving}
              onSaveDraft={updateDraft}
              onApprove={(id) =>
                mutateAction(id, "approve", { reason: "approved in Actions" })
              }
              onReject={(id) =>
                mutateAction(id, "reject", { reason: "rejected in Actions" })
              }
              onSnooze={(id) =>
                mutateAction(id, "snooze", {
                  reason: "snoozed in Actions",
                  snoozedUntil: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
                })
              }
              onDelegate={(id) =>
                mutateAction(id, "delegate", {
                  delegateTo: "teammate",
                  reason: "delegated from action inbox",
                })
              }
            />
          ) : (
            <div className="flex min-h-full items-center justify-center p-10 text-sm text-muted-foreground">
              Select or create an action.
            </div>
          )}
        </section>
      </section>
    </main>
  );
}

function ActionDetail({
  action,
  audit,
  saving,
  onSaveDraft,
  onApprove,
  onReject,
  onSnooze,
  onDelegate,
}: {
  action: ActionItem;
  audit: AuditEvent[];
  saving: string | null;
  onSaveDraft: (id: string, draftText: string) => void | Promise<void>;
  onApprove: (id: string) => void | Promise<void>;
  onReject: (id: string) => void | Promise<void>;
  onSnooze: (id: string) => void | Promise<void>;
  onDelegate: (id: string) => void | Promise<void>;
}) {
  const [draftText, setDraftText] = useState(extractDraftText(action.draftPayload));
  const [tab, setTab] = useState<DetailTab>("summary");
  const canTransition = isTransitionReady(action.status);
  const canEdit = isEditable(action.status);

  useEffect(() => {
    setDraftText(extractDraftText(action.draftPayload));
    setTab("summary");
  }, [action.id, action.draftPayload]);

  return (
    <div className="min-h-full min-w-0">
      <div className="sticky top-0 z-10 border-b border-border bg-card/95 px-5 py-3 backdrop-blur md:px-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <StatusPill status={action.status} />
            <span className="text-xs text-muted-foreground">
              {humanActionType(action.actionType)} / {relativeTime(action.updatedAt)}
            </span>
          </div>
          <div className="flex flex-wrap gap-2">
            <ActionButton
              icon={<CheckIcon className="size-3.5" />}
              label="Approve"
              busy={saving === "approve"}
              disabled={!canTransition}
              onClick={() => onApprove(action.id)}
            />
            <ActionButton
              icon={<XIcon className="size-3.5" />}
              label="Reject"
              busy={saving === "reject"}
              disabled={!canTransition}
              onClick={() => onReject(action.id)}
            />
            <ActionButton
              icon={<Clock3Icon className="size-3.5" />}
              label="Snooze"
              busy={saving === "snooze"}
              disabled={!canTransition}
              onClick={() => onSnooze(action.id)}
            />
            <ActionButton
              icon={<UserPlusIcon className="size-3.5" />}
              label="Delegate"
              busy={saving === "delegate"}
              disabled={!canTransition}
              onClick={() => onDelegate(action.id)}
            />
          </div>
        </div>
      </div>

      <div className="p-5 md:p-6">
        <div className="mb-5">
          <div>
            <h2 className="max-w-4xl text-2xl font-semibold leading-tight tracking-normal md:text-3xl">
              {cleanText(action.title)}
            </h2>
            <p className="mt-3 max-w-3xl text-sm leading-6 text-muted-foreground">
              {cleanText(action.summary ?? action.reason ?? "Hermes has not added a summary.")}
            </p>
          </div>
        </div>

        <div className="grid gap-3 md:grid-cols-4">
          <Metric label="kind" value={humanActionType(action.actionType)} />
          <Metric label="impact" value={humanLevel(action.impactLevel)} />
          <Metric label="risk" value={humanLevel(action.riskLevel)} />
          <Metric
            label="confidence"
            value={
              action.confidenceScore === null
                ? "manual"
                : `${Math.round(action.confidenceScore * 100)}%`
            }
          />
        </div>

        <div className="mt-5 flex flex-wrap gap-1 border-b border-border">
          <TabButton
            active={tab === "summary"}
            icon={<ListChecksIcon className="size-3.5" />}
            label="Summary"
            onClick={() => setTab("summary")}
          />
          <TabButton
            active={tab === "draft"}
            icon={<SendIcon className="size-3.5" />}
            label="Draft"
            onClick={() => setTab("draft")}
          />
          <TabButton
            active={tab === "evidence"}
            icon={<FileTextIcon className="size-3.5" />}
            label="Evidence"
            onClick={() => setTab("evidence")}
          />
          <TabButton
            active={tab === "history"}
            icon={<HistoryIcon className="size-3.5" />}
            label="History"
            onClick={() => setTab("history")}
          />
        </div>

        {tab === "summary" ? (
          <section className="mt-4 border border-border bg-background/65 p-4">
            <div className="mb-2 text-xs font-medium text-muted-foreground">
              Why Hermes surfaced this
            </div>
            <p className="text-sm leading-6">
              {cleanText(action.reason ?? action.summary ?? "No reason attached yet.")}
            </p>
            <div className="mt-4 grid gap-3 md:grid-cols-2">
              <SummaryRow label="Proposed work" value={cleanText(action.title)} />
              <SummaryRow label="Approval" value={action.approvalRequired ? "Required before sending" : "Not required"} />
              <SummaryRow label="Detected" value={new Date(action.createdAt).toLocaleString()} />
              <SummaryRow label="Updated" value={new Date(action.updatedAt).toLocaleString()} />
            </div>
          </section>
        ) : null}

        {tab === "draft" ? (
          <section className="mt-4 border border-border bg-background/65">
            <div className="border-b border-border px-4 py-3">
              <div className="flex items-center gap-2 text-xs font-medium text-muted-foreground">
                <SendIcon className="size-3.5" />
                Draft to review
              </div>
            </div>
            <textarea
              value={draftText}
              onChange={(event) => setDraftText(event.target.value)}
              disabled={!canEdit}
              className="min-h-64 w-full resize-y bg-transparent p-4 text-sm leading-6 outline-none"
              spellCheck={false}
            />
            <div className="border-t border-border px-4 py-3">
              <button
                type="button"
                onClick={() => onSaveDraft(action.id, draftText)}
                disabled={saving === "update" || !canEdit}
                className="inline-flex h-9 items-center gap-2 rounded-lg bg-foreground px-3 text-xs font-medium text-background disabled:opacity-50"
              >
                <FileClockIcon className="size-3.5" />
                Save draft
              </button>
            </div>
          </section>
        ) : null}

        {tab === "evidence" ? (
          <section className="mt-4 border border-border bg-background/65 p-4">
            <div className="mb-3 text-xs font-medium text-muted-foreground">
            Evidence
            </div>
            <div className="mt-4 flex flex-wrap gap-2">
              {action.sourceIds.length ? (
                action.sourceIds.map((source, index) => (
                  <span
                    key={source}
                    className="rounded-lg border border-border bg-card px-2.5 py-1.5 font-mono text-[11px] text-muted-foreground"
                    title={source}
                  >
                    Evidence source {index + 1}
                  </span>
                ))
              ) : (
                <span className="text-xs text-muted-foreground">
                  No source attached yet
                </span>
              )}
            </div>
          </section>
        ) : null}

        {tab === "history" ? (
          <section className="mt-4 border border-border bg-background/65 p-4">
            <div className="mb-4 text-xs font-medium text-muted-foreground">
              Review history
            </div>
            <div className="space-y-3">
              {audit.length ? (
                audit.map((event) => (
                  <div key={event.id} className="border-l border-hermes/50 pl-3">
                    <div className="text-xs font-medium">
                      {humanEvent(event.eventType)}
                    </div>
                    <div className="mt-1 text-[11px] text-muted-foreground">
                      {new Date(event.createdAt).toLocaleString()}
                    </div>
                  </div>
                ))
              ) : (
                <div className="text-sm text-muted-foreground">
                  No audit events yet.
                </div>
              )}
            </div>
          </section>
        ) : null}
      </div>
    </div>
  );
}

function ActionButton({
  icon,
  label,
  busy,
  disabled,
  onClick,
}: {
  icon: ReactNode;
  label: string;
  busy: boolean;
  disabled?: boolean;
  onClick: () => void | Promise<void>;
}) {
  return (
    <button
      type="button"
      onClick={() => void onClick()}
      disabled={busy || disabled}
      className="inline-flex h-9 items-center gap-2 border border-border bg-card px-3 text-xs transition-colors hover:border-hermes/60 hover:text-hermes disabled:opacity-50"
    >
      {icon}
      {busy ? "working" : label}
    </button>
  );
}

function StatusPill({ status }: { status: string }) {
  const tone =
    status === "approved" || status === "completed"
      ? "border-emerald-400/40 text-emerald-300 bg-emerald-400/10"
      : status === "rejected" || status === "failed"
        ? "border-destructive/50 text-destructive bg-destructive/10"
        : status === "pending_approval"
          ? "border-hermes/50 text-hermes bg-hermes/10"
          : "border-border text-muted-foreground bg-card";
  return (
    <span className={`shrink-0 border px-2 py-1 text-[10px] uppercase ${tone}`}>
      {label(status)}
    </span>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="border border-border bg-card/50 p-3">
      <div className="text-[11px] uppercase tracking-[0.16em] text-muted-foreground">
        {label}
      </div>
      <div className="mt-2 text-sm font-medium">{value}</div>
    </div>
  );
}

function TabButton({
  active,
  icon,
  label,
  onClick,
}: {
  active: boolean;
  icon: ReactNode;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`-mb-px inline-flex h-10 items-center gap-2 border-b px-3 text-xs font-medium transition-colors ${
        active
          ? "border-foreground text-foreground"
          : "border-transparent text-muted-foreground hover:text-foreground"
      }`}
    >
      {icon}
      {label}
    </button>
  );
}

function SummaryRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-border bg-card px-3 py-2">
      <div className="text-[11px] text-muted-foreground">{label}</div>
      <div className="mt-1 text-sm font-medium">{value}</div>
    </div>
  );
}

function ActionListSkeleton() {
  return (
    <div className="space-y-0 divide-y divide-border/70">
      {Array.from({ length: 5 }).map((_, index) => (
        <div key={index} className="px-4 py-4">
          <div className="h-4 w-2/3 bg-muted" />
          <div className="mt-3 h-3 w-full bg-muted/70" />
          <div className="mt-2 h-3 w-3/5 bg-muted/70" />
        </div>
      ))}
    </div>
  );
}

function extractDraftText(value: unknown) {
  if (value === null || value === undefined) return "";
  if (typeof value === "string") return value;
  if (isRecord(value)) {
    for (const key of ["body", "message", "text", "content", "draft"]) {
      const candidate = value[key];
      if (typeof candidate === "string" && candidate.trim()) return candidate;
    }
  }
  return "";
}

function draftPayloadFromText(original: unknown, text: string) {
  if (typeof original === "string") return text;
  if (isRecord(original)) {
    for (const key of ["body", "message", "text", "content", "draft"]) {
      if (typeof original[key] === "string") {
        return { ...original, [key]: text };
      }
    }
    return { ...original, body: text };
  }
  return { body: text };
}

function cleanText(value: string) {
  return value
    .replaceAll("&#39;", "'")
    .replaceAll("&quot;", '"')
    .replaceAll("&amp;", "&")
    .replace(/\s+/g, " ")
    .trim();
}

function humanActionType(value: string) {
  const normalized = value.replace(/_/g, " ");
  if (normalized.includes("gmail")) return "Email";
  if (normalized.includes("slack")) return "Slack";
  if (normalized.includes("calendar")) return "Calendar";
  if (normalized.includes("github")) return "GitHub";
  if (normalized.includes("linear")) return "Linear";
  return normalized.replace(/\b\w/g, (char) => char.toUpperCase());
}

function humanLevel(value: string) {
  if (!value) return "Unknown";
  return value.replace(/_/g, " ").replace(/\b\w/g, (char) => char.toUpperCase());
}

function humanEvent(value: string) {
  return value.replaceAll(".", " ").replace(/_/g, " ");
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function relativeTime(value: string) {
  const delta = Date.now() - new Date(value).getTime();
  const minutes = Math.max(0, Math.round(delta / 60_000));
  if (minutes < 1) return "now";
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.round(hours / 24)}d ago`;
}

function label(value: string) {
  return value.replaceAll("_", " ");
}

function isTransitionReady(status: string) {
  return status === "detected" || status === "drafted" || status === "pending_approval";
}

function isEditable(status: string) {
  return (
    status !== "approved" &&
    status !== "rejected" &&
    status !== "delegated" &&
    status !== "completed" &&
    status !== "failed" &&
    status !== "archived"
  );
}
