"use client";

import {
  CheckIcon,
  Clock3Icon,
  FileClockIcon,
  MessageSquarePlusIcon,
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
      let draftPayload: unknown = { body: draftText };
      try {
        draftPayload = JSON.parse(draftText);
      } catch {
        // Plain text is valid prototype draft content.
      }
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

  const createPrototypeAction = async () => {
    setSaving("create");
    setError(null);
    try {
      const stamp = new Date().toISOString();
      const res = await fetch("/api/actions", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          title: "Review prototype follow-up",
          actionType: "manual",
          summary: "A manually created action to validate the Action Board loop.",
          reason:
            "Prototype cards prove the approval surface before live connector signals arrive.",
          impactLevel: "medium",
          riskLevel: "low",
          sourceIds: [`manual:${stamp}`],
          draftPayload: {
            channel: "demo",
            body: "Quick follow-up: I reviewed this and can move it forward today.",
          },
          approvalRequired: true,
          metadata: { prototype: true, createdFrom: "action-board" },
        }),
      });
      if (!res.ok) throw new Error(`create ${res.status}`);
      const data = (await res.json()) as { action: ActionItem };
      setSelectedId(data.action.id);
      await loadActions();
      if (
        statusFilter === "all" ||
        statusFilter === data.action.status
      ) {
        await loadAudit(data.action.id);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "failed to create action");
    } finally {
      setSaving(null);
    }
  };

  return (
    <main className="min-h-svh bg-background text-foreground">
      <section className="border-b border-border/70 px-5 py-5 md:px-8">
        <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
          <div className="max-w-3xl">
            <div className="mb-3 inline-flex items-center gap-2 border border-hermes/40 bg-hermes/10 px-2.5 py-1 text-[11px] uppercase tracking-[0.18em] text-hermes">
              <ShieldCheckIcon className="size-3" />
              source backed approval board
            </div>
            <h1 className="text-2xl font-semibold tracking-normal md:text-4xl">
              Action Board
            </h1>
            <p className="mt-3 max-w-2xl text-sm leading-6 text-muted-foreground">
              Triage work Hermes has detected, inspect the evidence, edit the
              draft, and decide what is allowed to happen outside the system.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => void loadActions()}
              className="inline-flex h-9 items-center gap-2 border border-border bg-card px-3 text-xs text-muted-foreground transition-colors hover:border-hermes/50 hover:text-foreground"
            >
              <RefreshCwIcon className="size-3.5" />
              refresh
            </button>
            <button
              type="button"
              onClick={() => void createPrototypeAction()}
              disabled={saving === "create"}
              className="inline-flex h-9 items-center gap-2 bg-hermes px-3 text-xs font-medium text-hermes-foreground transition-opacity disabled:opacity-50"
            >
              <MessageSquarePlusIcon className="size-3.5" />
              create prototype action
            </button>
          </div>
        </div>
      </section>

      <section className="grid min-h-[calc(100svh-142px)] grid-cols-1 lg:grid-cols-[440px_minmax(0,1fr)]">
        <aside className="border-b border-border/70 lg:border-b-0 lg:border-r">
          <div className="border-b border-border/70 p-4">
            <div className="mb-3 flex items-center gap-2 text-xs uppercase tracking-[0.16em] text-muted-foreground">
              <SlidersHorizontalIcon className="size-3.5" />
              filters
            </div>
            <div className="flex flex-wrap gap-2">
              {STATUS_FILTERS.map((status) => (
                <button
                  key={status}
                  type="button"
                  onClick={() => setStatusFilter(status)}
                  className={`border px-2.5 py-1.5 text-[11px] transition-colors ${
                    statusFilter === status
                      ? "border-hermes bg-hermes text-hermes-foreground"
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

          <div className="divide-y divide-border/70">
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
                    <h2 className="line-clamp-2 text-sm font-medium">
                      {action.title}
                    </h2>
                    <StatusPill status={action.status} />
                  </div>
                  <p className="line-clamp-2 text-xs leading-5 text-muted-foreground">
                    {action.summary ?? action.reason ?? "No summary yet."}
                  </p>
                  <div className="mt-3 flex items-center justify-between text-[11px] text-muted-foreground">
                    <span>{action.actionType}</span>
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
                mutateAction(id, "approve", { reason: "approved in Action Board" })
              }
              onReject={(id) =>
                mutateAction(id, "reject", { reason: "rejected in Action Board" })
              }
              onSnooze={(id) =>
                mutateAction(id, "snooze", {
                  reason: "snoozed in Action Board",
                  snoozedUntil: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
                })
              }
              onDelegate={(id) =>
                mutateAction(id, "delegate", {
                  delegateTo: "teammate",
                  reason: "delegated from prototype board",
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
  const [draftText, setDraftText] = useState(formatDraft(action.draftPayload));
  const canTransition = isTransitionReady(action.status);
  const canEdit = isEditable(action.status);

  useEffect(() => {
    setDraftText(formatDraft(action.draftPayload));
  }, [action.id, action.draftPayload]);

  return (
    <div className="grid min-h-full grid-cols-1 xl:grid-cols-[minmax(0,1fr)_360px]">
      <div className="min-w-0 p-5 md:p-8">
        <div className="mb-6 flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
          <div>
            <StatusPill status={action.status} />
            <h2 className="mt-4 max-w-4xl text-2xl font-semibold leading-tight tracking-normal md:text-3xl">
              {action.title}
            </h2>
            <p className="mt-3 max-w-3xl text-sm leading-6 text-muted-foreground">
              {action.summary ?? action.reason ?? "Hermes has not added a summary."}
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <ActionButton
              icon={<CheckIcon className="size-3.5" />}
              label="approve"
              busy={saving === "approve"}
              disabled={!canTransition}
              onClick={() => onApprove(action.id)}
            />
            <ActionButton
              icon={<XIcon className="size-3.5" />}
              label="reject"
              busy={saving === "reject"}
              disabled={!canTransition}
              onClick={() => onReject(action.id)}
            />
            <ActionButton
              icon={<Clock3Icon className="size-3.5" />}
              label="snooze"
              busy={saving === "snooze"}
              disabled={!canTransition}
              onClick={() => onSnooze(action.id)}
            />
            <ActionButton
              icon={<UserPlusIcon className="size-3.5" />}
              label="delegate"
              busy={saving === "delegate"}
              disabled={!canTransition}
              onClick={() => onDelegate(action.id)}
            />
          </div>
        </div>

        <div className="grid gap-4 md:grid-cols-3">
          <Metric label="impact" value={action.impactLevel} />
          <Metric label="risk" value={action.riskLevel} />
          <Metric
            label="confidence"
            value={
              action.confidenceScore === null
                ? "manual"
                : `${Math.round(action.confidenceScore * 100)}%`
            }
          />
        </div>

        <section className="mt-6 border border-border bg-card/70">
          <div className="border-b border-border px-4 py-3">
            <div className="flex items-center gap-2 text-xs uppercase tracking-[0.16em] text-muted-foreground">
              <SendIcon className="size-3.5" />
              editable draft payload
            </div>
          </div>
          <textarea
            value={draftText}
            onChange={(event) => setDraftText(event.target.value)}
            disabled={!canEdit}
            className="min-h-56 w-full resize-y bg-transparent p-4 font-mono text-xs leading-6 outline-none"
            spellCheck={false}
          />
          <div className="border-t border-border px-4 py-3">
            <button
              type="button"
              onClick={() => onSaveDraft(action.id, draftText)}
              disabled={saving === "update" || !canEdit}
              className="inline-flex h-8 items-center gap-2 bg-foreground px-3 text-xs text-background disabled:opacity-50"
            >
              <FileClockIcon className="size-3.5" />
              save draft
            </button>
          </div>
        </section>

        <section className="mt-6 border border-border bg-card/50 p-4">
          <div className="mb-3 text-xs uppercase tracking-[0.16em] text-muted-foreground">
            why this action exists
          </div>
          <p className="text-sm leading-6">
            {action.reason ??
              "This prototype action was created manually. Live connector actions will cite provider evidence here."}
          </p>
          <div className="mt-4 flex flex-wrap gap-2">
            {action.sourceIds.length ? (
              action.sourceIds.map((source) => (
                <span
                  key={source}
                  className="border border-border bg-background px-2 py-1 font-mono text-[11px] text-muted-foreground"
                >
                  {source}
                </span>
              ))
            ) : (
              <span className="text-xs text-muted-foreground">
                source placeholder
              </span>
            )}
          </div>
        </section>
      </div>

      <aside className="border-t border-border p-5 xl:border-l xl:border-t-0">
        <div className="mb-4 text-xs uppercase tracking-[0.16em] text-muted-foreground">
          audit timeline
        </div>
        <div className="space-y-3">
          {audit.length ? (
            audit.map((event) => (
              <div key={event.id} className="border-l border-hermes/50 pl-3">
                <div className="text-xs font-medium">{event.eventType}</div>
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
      </aside>
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

function formatDraft(value: unknown) {
  if (value === null || value === undefined) return "";
  if (typeof value === "string") return value;
  return JSON.stringify(value, null, 2);
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
