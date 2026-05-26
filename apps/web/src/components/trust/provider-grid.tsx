"use client";

import {
  AlertTriangleIcon,
  CheckCircle2Icon,
  Clock3Icon,
  RefreshCwIcon,
  ShieldCheckIcon,
  XCircleIcon,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import type {
  ConnectorSyncResult,
  SourceObject,
} from "@/lib/connector-types";
import type {
  AuditEvent,
  FailureEvent,
  IntegrationHealth,
} from "@/lib/trust-types";

const PROVIDER_LABELS: Record<string, string> = {
  gmail: "Gmail",
  calendar: "Google Calendar",
  slack: "Slack",
  github: "GitHub",
  linear: "Linear",
  sentry: "Sentry",
};

export function ConnectionsView() {
  const { integrations, loading, error, refresh } = useTrustData();
  const {
    sourceObjects,
    syncingProvider,
    error: connectorError,
    refreshSourceObjects,
    syncProvider,
  } = useConnectorActivity();

  const refreshAll = async () => {
    await Promise.all([refresh(), refreshSourceObjects()]);
  };

  const handleSyncProvider = async (provider: string) => {
    await syncProvider(provider);
    await refresh();
  };

  return (
    <TrustFrame
      title="Connections"
      label="provider access"
      description="Verify env-based provider setup and sync recent provider activity without exposing secrets."
      onRefresh={refreshAll}
      loading={loading}
      error={error ?? connectorError}
    >
      <ProviderGrid
        integrations={integrations}
        variant="connections"
        onSyncProvider={handleSyncProvider}
        syncingProvider={syncingProvider}
      />
      <div className="mt-6">
        <SourceObjectPanel sourceObjects={sourceObjects} />
      </div>
    </TrustFrame>
  );
}

export function TrustView() {
  const { integrations, audit, failures, loading, error, refresh, writeAuditTest } =
    useTrustData({ includeAudit: true, includeFailures: true });
  const connected = integrations.filter((item) => item.status === "connected").length;
  const failing = failures.filter((item) => item.status === "open").length;

  return (
    <TrustFrame
      title="Trust Center"
      label="health, audit, failures"
      description="Hermes should show what it can access, what is fresh, what failed, and what it did. No hidden sync failures."
      onRefresh={refresh}
      loading={loading}
      error={error}
      action={
        <button
          type="button"
          onClick={() => void writeAuditTest()}
          className="inline-flex h-9 items-center gap-2 border border-border bg-card px-3 text-xs text-muted-foreground hover:border-hermes/50 hover:text-foreground"
        >
          <ShieldCheckIcon className="size-3.5" />
          write audit test
        </button>
      }
    >
      <div className="grid gap-4 md:grid-cols-3">
        <TrustMetric label="providers connected" value={`${connected}/${integrations.length}`} />
        <TrustMetric label="open failures" value={`${failing}`} />
        <TrustMetric label="audit events loaded" value={`${audit.length}`} />
      </div>

      <div className="mt-6">
        <ProviderGrid integrations={integrations} variant="trust" />
      </div>

      <div className="mt-6 grid gap-4 xl:grid-cols-2">
        <AuditPanel events={audit} />
        <FailurePanel failures={failures} />
      </div>
    </TrustFrame>
  );
}

function TrustFrame({
  title,
  label,
  description,
  children,
  onRefresh,
  loading,
  error,
  action,
}: {
  title: string;
  label: string;
  description: string;
  children: React.ReactNode;
  onRefresh: () => void | Promise<void>;
  loading: boolean;
  error: string | null;
  action?: React.ReactNode;
}) {
  return (
    <div className="min-h-svh">
      <section className="border-b border-border px-5 py-6 md:px-8">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <div className="mb-3 inline-flex items-center gap-2 border border-hermes/40 bg-hermes/10 px-2.5 py-1 text-xs text-hermes">
              <ShieldCheckIcon className="size-3.5" />
              {label}
            </div>
            <h1 className="text-2xl font-semibold md:text-4xl">{title}</h1>
            <p className="mt-3 max-w-2xl text-sm leading-6 text-muted-foreground">
              {description}
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            {action}
            <button
              type="button"
              onClick={() => void onRefresh()}
              className="inline-flex h-9 items-center gap-2 bg-hermes px-3 text-xs text-hermes-foreground disabled:opacity-50"
              disabled={loading}
            >
              <RefreshCwIcon className="size-3.5" />
              {loading ? "loading" : "refresh"}
            </button>
          </div>
        </div>
        {error && (
          <div className="mt-4 border border-destructive/50 bg-destructive/10 px-3 py-2 text-xs text-destructive">
            {error}
          </div>
        )}
      </section>

      <section className="p-5 md:p-8">{children}</section>
    </div>
  );
}

function ProviderGrid({
  integrations,
  variant,
  onSyncProvider,
  syncingProvider,
}: {
  integrations: IntegrationHealth[];
  variant: "connections" | "trust";
  onSyncProvider?: (provider: string) => void | Promise<void>;
  syncingProvider?: string | null;
}) {
  return (
    <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
      {integrations.map((integration) => (
        <ProviderCard
          key={integration.provider}
          integration={integration}
          variant={variant}
          onSyncProvider={onSyncProvider}
          syncing={syncingProvider === integration.provider}
        />
      ))}
    </div>
  );
}

function ProviderCard({
  integration,
  variant,
  onSyncProvider,
  syncing,
}: {
  integration: IntegrationHealth;
  variant: "connections" | "trust";
  onSyncProvider?: (provider: string) => void | Promise<void>;
  syncing?: boolean;
}) {
  const state = providerState(integration);
  const Icon = state.icon;
  const mode = connectorMode(integration);
  const configKind =
    developerConfigured(integration)
      ? "env configured"
      : mode === "env"
        ? "env missing"
        : mode === "prototype"
          ? "prototype data removed"
          : "not configured";

  return (
    <article className="border border-border bg-card/60 p-4">
      <div className="mb-5 flex items-start justify-between gap-4">
        <div>
          <h2 className="text-base font-medium">
            {PROVIDER_LABELS[integration.provider] ?? integration.provider}
          </h2>
          <p className="mt-1 text-xs text-muted-foreground">{configKind}</p>
        </div>
        <div className={`grid size-9 place-items-center border ${state.className}`}>
          <Icon className="size-4" />
        </div>
      </div>

      <div className="grid gap-2 text-xs text-muted-foreground">
        <InfoRow label="status" value={statusLabel(integration)} />
        <InfoRow label="mode" value={mode} />
        <InfoRow
          label="last sync"
          value={formatTime(integration.lastSuccessfulSync ?? integration.lastAttemptedSync)}
        />
        <InfoRow
          label="scopes"
          value={integration.scopes.length ? `${integration.scopes.length}` : "none"}
        />
      </div>

      {integration.failureReason && (
        <div className="mt-4 border border-destructive/40 bg-destructive/10 px-3 py-2 text-xs text-destructive">
          {integration.failureReason}
        </div>
      )}

      {variant === "connections" && (
        <div className="mt-4 flex gap-2">
          <button
            type="button"
            disabled={syncing || !onSyncProvider}
            onClick={() => void onSyncProvider?.(integration.provider)}
            className="inline-flex h-8 items-center gap-2 border border-border px-3 text-xs text-muted-foreground hover:border-hermes/50 hover:text-foreground disabled:opacity-60"
          >
            <RefreshCwIcon className="size-3.5" />
            {syncing ? "syncing" : "sync now"}
          </button>
        </div>
      )}
    </article>
  );
}

function SourceObjectPanel({
  sourceObjects,
}: {
  sourceObjects: SourceObject[];
}) {
  return (
    <section className="border border-border bg-card/50 p-4">
      <div className="mb-4 flex items-center justify-between gap-4">
        <div>
          <div className="text-xs uppercase tracking-[0.16em] text-muted-foreground">
            observed sources
          </div>
          <h2 className="mt-2 text-base font-medium">Connector activity</h2>
        </div>
        <div className="text-xs text-muted-foreground">
          {sourceObjects.length} loaded
        </div>
      </div>

      <div className="grid gap-2">
        {sourceObjects.length ? (
          sourceObjects.slice(0, 12).map((source) => (
            <div
              key={source.id}
              className="grid gap-3 border border-border/70 bg-background/40 px-3 py-3 text-xs md:grid-cols-[120px_minmax(0,1fr)_160px]"
            >
              <div className="text-muted-foreground">
                {PROVIDER_LABELS[source.provider] ?? source.provider}
              </div>
              <div className="min-w-0">
                <div className="truncate font-medium">
                  {source.title ?? source.objectType}
                </div>
                {source.summary && (
                  <div className="mt-1 truncate text-muted-foreground">
                    {source.summary}
                  </div>
                )}
              </div>
              <div className="text-muted-foreground md:text-right">
                {formatTime(source.lastObservedAt)}
              </div>
            </div>
          ))
        ) : (
          <EmptyPanel text="No source objects observed yet." />
        )}
      </div>
    </section>
  );
}

function AuditPanel({ events }: { events: AuditEvent[] }) {
  return (
    <section className="border border-border bg-card/50 p-4">
      <div className="mb-4 text-xs uppercase tracking-[0.16em] text-muted-foreground">
        recent audit
      </div>
      <div className="space-y-3">
        {events.length ? (
          events.slice(0, 12).map((event) => (
            <div key={event.id} className="border-l border-hermes/50 pl-3">
              <div className="text-xs font-medium">{event.eventType}</div>
              <div className="mt-1 text-[11px] text-muted-foreground">
                {event.objectType}
                {event.objectId ? ` / ${event.objectId}` : ""} -{" "}
                {formatTime(event.createdAt)}
              </div>
            </div>
          ))
        ) : (
          <EmptyPanel text="No audit events loaded." />
        )}
      </div>
    </section>
  );
}

function FailurePanel({ failures }: { failures: FailureEvent[] }) {
  return (
    <section className="border border-border bg-card/50 p-4">
      <div className="mb-4 text-xs uppercase tracking-[0.16em] text-muted-foreground">
        failures
      </div>
      <div className="space-y-3">
        {failures.length ? (
          failures.slice(0, 12).map((failure) => (
            <div key={failure.id} className="border-l border-destructive/50 pl-3">
              <div className="text-xs font-medium">{failure.message}</div>
              <div className="mt-1 text-[11px] text-muted-foreground">
                {failure.source} / {failure.eventType} - {formatTime(failure.createdAt)}
              </div>
            </div>
          ))
        ) : (
          <EmptyPanel text="No open failures." />
        )}
      </div>
    </section>
  );
}

function TrustMetric({ label, value }: { label: string; value: string }) {
  return (
    <div className="border border-border bg-card/50 p-4">
      <div className="text-xs uppercase tracking-[0.16em] text-muted-foreground">
        {label}
      </div>
      <div className="mt-3 text-2xl font-semibold">{value}</div>
    </div>
  );
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-4 border border-border/70 bg-background/40 px-2 py-1.5">
      <span>{label}</span>
      <span className="truncate text-foreground">{value}</span>
    </div>
  );
}

function EmptyPanel({ text }: { text: string }) {
  return <div className="text-sm text-muted-foreground">{text}</div>;
}

function providerState(integration: IntegrationHealth) {
  if (integration.status === "connected") {
    return {
      icon: CheckCircle2Icon,
      className: "border-emerald-400/40 bg-emerald-400/10 text-emerald-300",
    };
  }
  if (integration.status === "error" || integration.status === "degraded") {
    return {
      icon: AlertTriangleIcon,
      className: "border-destructive/40 bg-destructive/10 text-destructive",
    };
  }
  if (integration.status === "disabled") {
    return {
      icon: XCircleIcon,
      className: "border-border bg-muted text-muted-foreground",
    };
  }
  return {
    icon: Clock3Icon,
    className: "border-hermes/40 bg-hermes/10 text-hermes",
  };
}

function developerConfigured(integration: IntegrationHealth) {
  return Boolean(integration.config?.developerConfigured);
}

function connectorMode(integration: IntegrationHealth) {
  if (integration.config?.connectorMode === "env") return "env";
  if (integration.config?.connectorMode === "prototype") return "prototype";
  return "real";
}

function statusLabel(integration: IntegrationHealth) {
  return integration.status;
}

function formatTime(value: string | null) {
  if (!value) return "never";
  return new Date(value).toLocaleString();
}

function useTrustData(
  options: { includeAudit?: boolean; includeFailures?: boolean } = {},
) {
  const [integrations, setIntegrations] = useState<IntegrationHealth[]>([]);
  const [audit, setAudit] = useState<AuditEvent[]>([]);
  const [failures, setFailures] = useState<FailureEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = async () => {
    setLoading(true);
    setError(null);
    try {
      const [integrationsRes, auditRes, failuresRes] = await Promise.all([
        fetch("/api/trust/integrations", { cache: "no-store" }),
        options.includeAudit
          ? fetch("/api/trust/audit?limit=80", { cache: "no-store" })
          : Promise.resolve(null),
        options.includeFailures
          ? fetch("/api/trust/failures?limit=80&status=open", { cache: "no-store" })
          : Promise.resolve(null),
      ]);
      if (!integrationsRes.ok) throw new Error(`integrations ${integrationsRes.status}`);
      const integrationsData = (await integrationsRes.json()) as {
        integrations?: IntegrationHealth[];
      };
      setIntegrations(integrationsData.integrations ?? []);

      if (auditRes) {
        if (!auditRes.ok) throw new Error(`audit ${auditRes.status}`);
        const auditData = (await auditRes.json()) as { audit?: AuditEvent[] };
        setAudit(auditData.audit ?? []);
      }

      if (failuresRes) {
        if (!failuresRes.ok) throw new Error(`failures ${failuresRes.status}`);
        const failuresData = (await failuresRes.json()) as {
          failures?: FailureEvent[];
        };
        setFailures(failuresData.failures ?? []);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "failed to load trust data");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const writeAuditTest = async () => {
    setError(null);
    try {
      const res = await fetch("/api/trust/audit", { method: "POST" });
      if (!res.ok) throw new Error(`audit test ${res.status}`);
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "failed to write audit test");
    }
  };

  const memo = useMemo(
    () => ({ integrations, audit, failures, loading, error, refresh, writeAuditTest }),
    [integrations, audit, failures, loading, error],
  );
  return memo;
}

function useConnectorActivity() {
  const [sourceObjects, setSourceObjects] = useState<SourceObject[]>([]);
  const [syncingProvider, setSyncingProvider] = useState<string | null>(null);
  const [lastSync, setLastSync] = useState<ConnectorSyncResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  const refreshSourceObjects = async () => {
    setError(null);
    try {
      const res = await fetch("/api/connectors/source-objects?limit=40", {
        cache: "no-store",
      });
      if (!res.ok) throw new Error(`source objects ${res.status}`);
      const data = (await res.json()) as { sourceObjects?: SourceObject[] };
      setSourceObjects(data.sourceObjects ?? []);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "failed to load connector activity",
      );
    }
  };

  const syncProvider = async (provider: string) => {
    setSyncingProvider(provider);
    setError(null);
    try {
      const res = await fetch(
        `/api/connectors/${encodeURIComponent(provider)}/sync-now`,
        { method: "POST" },
      );
      if (!res.ok) throw new Error(`sync ${provider} ${res.status}`);
      const data = (await res.json()) as ConnectorSyncResult;
      setLastSync(data);
      await refreshSourceObjects();
    } catch (err) {
      setError(err instanceof Error ? err.message : `failed to sync ${provider}`);
    } finally {
      setSyncingProvider(null);
    }
  };

  useEffect(() => {
    void refreshSourceObjects();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return {
    sourceObjects,
    syncingProvider,
    lastSync,
    error,
    refreshSourceObjects,
    syncProvider,
  };
}
