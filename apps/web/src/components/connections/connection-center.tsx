"use client";

import {
  CableIcon,
  CheckCircle2Icon,
  ExternalLinkIcon,
  KeyRoundIcon,
  Loader2Icon,
  LockIcon,
  PlugZapIcon,
  RefreshCwIcon,
  ShieldCheckIcon,
  UnplugIcon,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import type { ConnectionProvider } from "@/lib/connection-types";
import type { SourceObject } from "@/lib/connector-types";

const PROVIDER_ACCENTS: Record<string, string> = {
  calendar: "border-amber-400/40 bg-amber-400/10 text-amber-200",
  gmail: "border-rose-400/40 bg-rose-400/10 text-rose-200",
  slack: "border-cyan-400/40 bg-cyan-400/10 text-cyan-200",
  github: "border-zinc-300/40 bg-zinc-300/10 text-zinc-100",
  linear: "border-indigo-300/40 bg-indigo-300/10 text-indigo-100",
  sentry: "border-orange-300/40 bg-orange-300/10 text-orange-100",
};

export function ConnectionCenter() {
  const {
    connections,
    activity,
    loading,
    busyProvider,
    error,
    connect,
    disconnect,
    sync,
    saveManual,
    refresh,
  } = useConnections();
  const connected = connections.filter((item) => item.status === "connected").length;
  const oauthReady = connections.filter((item) => item.oauthReady).length;
  const categories = useMemo(
    () => Array.from(new Set(connections.map((item) => item.category))),
    [connections],
  );

  return (
    <main className="min-h-svh overflow-x-hidden bg-background text-foreground">
      <section className="border-b border-border px-5 py-6 md:px-8">
        <div className="mx-auto flex w-full max-w-7xl flex-col gap-6">
          <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
            <div className="max-w-3xl">
              <div className="mb-4 inline-flex items-center gap-2 border border-hermes/40 bg-hermes/10 px-2.5 py-1 text-xs uppercase tracking-[0.16em] text-hermes">
                <CableIcon className="size-3.5" />
                connection center
              </div>
              <h1 className="text-3xl font-semibold tracking-tight md:text-5xl">
                Connect tools with user-owned authorization
              </h1>
              <p className="mt-4 max-w-2xl text-sm leading-6 text-muted-foreground md:text-base">
                Each provider stores encrypted credentials, reports freshness, and stays scoped to the signed-in user&apos;s personal workspace. Shared env tokens are not used for hosted connector access.
              </p>
            </div>

            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => void refresh()}
                disabled={loading}
                className="inline-flex h-10 items-center gap-2 border border-border bg-card px-4 text-xs text-muted-foreground hover:border-hermes/50 hover:text-foreground disabled:opacity-60"
              >
                <RefreshCwIcon className="size-3.5" />
                {loading ? "refreshing" : "refresh"}
              </button>
            </div>
          </div>

          {error && (
            <div className="border border-destructive/40 bg-destructive/10 px-3 py-2 text-xs text-destructive">
              {error}
            </div>
          )}

          <div className="grid gap-3 md:grid-cols-3">
            <ConnectionMetric label="connected tools" value={`${connected}/${connections.length}`} />
            <ConnectionMetric label="oauth apps ready" value={`${oauthReady}`} />
            <ConnectionMetric label="source objects" value={`${activity.length}`} />
          </div>
        </div>
      </section>

      <section className="px-5 py-6 md:px-8">
        <div className="mx-auto grid w-full max-w-7xl gap-6 xl:grid-cols-[minmax(0,1fr)_360px]">
          <div className="space-y-8">
            {categories.map((category) => (
              <section key={category}>
                <div className="mb-3 flex items-center justify-between gap-4">
                  <div>
                    <div className="text-xs uppercase tracking-[0.16em] text-muted-foreground">
                      {category}
                    </div>
                    <h2 className="mt-1 text-lg font-semibold">
                      {categoryTitle(category)}
                    </h2>
                  </div>
                </div>
                <div className="grid gap-4 lg:grid-cols-2">
                  {connections
                    .filter((connection) => connection.category === category)
                    .map((connection) => (
                      <ProviderConnectionCard
                        key={connection.provider}
                        connection={connection}
                        busy={busyProvider === connection.provider}
                        onConnect={connect}
                        onDisconnect={disconnect}
                        onSync={sync}
                        onSaveManual={saveManual}
                      />
                    ))}
                </div>
              </section>
            ))}
          </div>

          <aside className="space-y-4 xl:sticky xl:top-6 xl:self-start">
            <SecurityPanel />
            <ActivityPanel activity={activity} />
          </aside>
        </div>
      </section>
    </main>
  );
}

function ProviderConnectionCard({
  connection,
  busy,
  onConnect,
  onDisconnect,
  onSync,
  onSaveManual,
}: {
  connection: ConnectionProvider;
  busy: boolean;
  onConnect: (provider: string) => void | Promise<void>;
  onDisconnect: (provider: string) => void | Promise<void>;
  onSync: (provider: string) => void | Promise<void>;
  onSaveManual: (
    provider: string,
    values: { accessToken: string; orgSlug?: string },
  ) => void | Promise<void>;
}) {
  const [manualOpen, setManualOpen] = useState(false);
  const [accessToken, setAccessToken] = useState("");
  const [orgSlug, setOrgSlug] = useState("");
  const connected = connection.status === "connected";
  const accent = PROVIDER_ACCENTS[connection.provider] ?? "border-border bg-muted text-muted-foreground";

  const handleManual = async () => {
    await onSaveManual(connection.provider, {
      accessToken,
      orgSlug: orgSlug || undefined,
    });
    setAccessToken("");
    setOrgSlug("");
    setManualOpen(false);
  };

  return (
    <article className="border border-border bg-card/70 p-4 shadow-[0_0_0_1px_rgba(255,255,255,0.02)]">
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <div className={`grid size-9 place-items-center border ${accent}`}>
              {connected ? (
                <CheckCircle2Icon className="size-4" />
              ) : (
                <PlugZapIcon className="size-4" />
              )}
            </div>
            <div>
              <h3 className="text-base font-semibold">{connection.label}</h3>
              <p className="text-xs text-muted-foreground">
                {connection.connectedBy ? `connected by ${connection.connectedBy}` : connection.oauthReady ? "OAuth app ready" : "OAuth app missing"}
              </p>
            </div>
          </div>
          <p className="mt-4 text-sm leading-6 text-muted-foreground">
            {connection.description}
          </p>
        </div>
        <StatusPill status={connection.status} />
      </div>

      <div className="mt-5 grid gap-2 text-xs md:grid-cols-2">
        <InfoRow label="OAuth config" value={connection.oauthReady ? "ready" : "missing"} />
        <InfoRow label="env fallback" value="disabled" />
        <InfoRow label="last sync" value={formatTime(connection.lastSuccessfulSync ?? connection.lastAttemptedSync)} />
        <InfoRow label="refresh token" value={connection.credential?.hasRefreshToken ? "stored" : "none"} />
      </div>

      <div className="mt-4 flex flex-wrap gap-2">
        <button
          type="button"
          disabled={busy || !connection.oauthReady}
          onClick={() => void onConnect(connection.provider)}
          className="inline-flex h-9 items-center gap-2 bg-hermes px-3 text-xs font-medium text-hermes-foreground disabled:opacity-50"
        >
          {busy ? <Loader2Icon className="size-3.5 animate-spin" /> : <ExternalLinkIcon className="size-3.5" />}
          {connected ? "reconnect" : "connect"}
        </button>
        <button
          type="button"
          disabled={busy || !connected}
          onClick={() => void onSync(connection.provider)}
          className="inline-flex h-9 items-center gap-2 border border-border px-3 text-xs text-muted-foreground hover:border-hermes/50 hover:text-foreground disabled:opacity-50"
        >
          <RefreshCwIcon className="size-3.5" />
          sync now
        </button>
        <button
          type="button"
          disabled={busy || !connected}
          onClick={() => void onDisconnect(connection.provider)}
          className="inline-flex h-9 items-center gap-2 border border-border px-3 text-xs text-muted-foreground hover:border-destructive/50 hover:text-destructive disabled:opacity-50"
        >
          <UnplugIcon className="size-3.5" />
          disconnect
        </button>
        {connection.authKind === "oauth_or_token" && (
          <button
            type="button"
            onClick={() => setManualOpen((value) => !value)}
            className="inline-flex h-9 items-center gap-2 border border-border px-3 text-xs text-muted-foreground hover:border-hermes/50 hover:text-foreground"
          >
            <KeyRoundIcon className="size-3.5" />
            token
          </button>
        )}
      </div>

      {!connection.oauthReady && (
        <div className="mt-4 border border-amber-400/30 bg-amber-400/10 px-3 py-2 text-xs leading-5 text-amber-100">
          Add the provider OAuth client id and secret on the server, then register this callback URL in the provider app:
          <span className="mt-1 block break-all text-amber-50">
            /api/connections/oauth/{connection.provider}/callback
          </span>
        </div>
      )}

      {connection.failureReason && (
        <div className="mt-4 border border-destructive/40 bg-destructive/10 px-3 py-2 text-xs text-destructive">
          {connection.failureReason}
        </div>
      )}

      {manualOpen && (
        <div className="mt-4 grid gap-3 border border-border bg-background/40 p-3">
          <input
            value={accessToken}
            onChange={(event) => setAccessToken(event.target.value)}
            placeholder={`${connection.label} access token`}
            className="h-9 border border-border bg-background px-3 text-xs outline-none focus:border-hermes"
            type="password"
          />
          {connection.provider === "sentry" && (
            <input
              value={orgSlug}
              onChange={(event) => setOrgSlug(event.target.value)}
              placeholder="Sentry org slug"
              className="h-9 border border-border bg-background px-3 text-xs outline-none focus:border-hermes"
            />
          )}
          <button
            type="button"
            disabled={busy || !accessToken.trim()}
            onClick={() => void handleManual()}
            className="inline-flex h-9 w-fit items-center gap-2 bg-hermes px-3 text-xs text-hermes-foreground disabled:opacity-50"
          >
            <LockIcon className="size-3.5" />
            store encrypted token
          </button>
        </div>
      )}
    </article>
  );
}

function SecurityPanel() {
  return (
    <section className="border border-border bg-card/70 p-4">
      <div className="mb-4 flex items-center gap-2">
        <div className="grid size-8 place-items-center border border-emerald-400/40 bg-emerald-400/10 text-emerald-200">
          <ShieldCheckIcon className="size-4" />
        </div>
        <div>
          <h2 className="text-sm font-semibold">Security model</h2>
          <p className="text-xs text-muted-foreground">prototype-ready, auth-ready</p>
        </div>
      </div>
      <div className="space-y-3 text-xs leading-5 text-muted-foreground">
        <p>OAuth state is single-use and expires after 10 minutes.</p>
        <p>Credentials are encrypted server-side before they touch the database.</p>
        <p>Connections are scoped to the current default workspace until Better Auth user/org IDs are wired in.</p>
      </div>
    </section>
  );
}

function ActivityPanel({ activity }: { activity: SourceObject[] }) {
  return (
    <section className="border border-border bg-card/70 p-4">
      <div className="mb-4 flex items-center justify-between gap-4">
        <div>
          <div className="text-xs uppercase tracking-[0.16em] text-muted-foreground">
            recent activity
          </div>
          <h2 className="mt-1 text-sm font-semibold">Observed sources</h2>
        </div>
        <span className="text-xs text-muted-foreground">{activity.length}</span>
      </div>
      <div className="space-y-2">
        {activity.length ? (
          activity.slice(0, 8).map((item) => (
            <div key={item.id} className="border border-border/70 bg-background/40 p-3">
              <div className="flex items-center justify-between gap-3 text-xs">
                <span className="uppercase tracking-[0.14em] text-muted-foreground">
                  {item.provider}
                </span>
                <span className="text-muted-foreground">{formatTime(item.lastObservedAt)}</span>
              </div>
              <div className="mt-2 line-clamp-2 text-sm">{item.title ?? item.objectType}</div>
            </div>
          ))
        ) : (
          <div className="text-sm text-muted-foreground">
            No synced source objects yet.
          </div>
        )}
      </div>
    </section>
  );
}

function ConnectionMetric({ label, value }: { label: string; value: string }) {
  return (
    <div className="border border-border bg-card/60 p-4">
      <div className="text-xs uppercase tracking-[0.16em] text-muted-foreground">
        {label}
      </div>
      <div className="mt-3 text-2xl font-semibold">{value}</div>
    </div>
  );
}

function StatusPill({ status }: { status: string }) {
  const connected = status === "connected";
  return (
    <span
      className={`inline-flex h-7 shrink-0 items-center border px-2 text-[11px] uppercase tracking-[0.12em] ${
        connected
          ? "border-emerald-400/40 bg-emerald-400/10 text-emerald-200"
          : "border-border bg-background text-muted-foreground"
      }`}
    >
      {status.replace("_", " ")}
    </span>
  );
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex min-w-0 items-center justify-between gap-3 border border-border/70 bg-background/40 px-2 py-1.5">
      <span className="shrink-0 text-muted-foreground">{label}</span>
      <span className="truncate">{value}</span>
    </div>
  );
}

function categoryTitle(category: string) {
  switch (category) {
    case "meetings":
      return "Calendar intelligence";
    case "communications":
      return "Communication graph";
    case "engineering":
      return "Engineering systems";
    case "planning":
      return "Planning systems";
    case "observability":
      return "Reliability signals";
    default:
      return category;
  }
}

function formatTime(value: string | null) {
  if (!value) return "never";
  return new Date(value).toLocaleString();
}

function useConnections() {
  const [connections, setConnections] = useState<ConnectionProvider[]>([]);
  const [activity, setActivity] = useState<SourceObject[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyProvider, setBusyProvider] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const refresh = async () => {
    setLoading(true);
    setError(null);
    try {
      const [connectionsRes, activityRes] = await Promise.all([
        fetch("/api/connections", { cache: "no-store" }),
        fetch("/api/connectors/source-objects?limit=30", { cache: "no-store" }),
      ]);
      if (!connectionsRes.ok) throw new Error(`connections ${connectionsRes.status}`);
      if (!activityRes.ok) throw new Error(`activity ${activityRes.status}`);
      const connectionsData = (await connectionsRes.json()) as {
        connections?: ConnectionProvider[];
      };
      const activityData = (await activityRes.json()) as {
        sourceObjects?: SourceObject[];
      };
      setConnections(connectionsData.connections ?? []);
      setActivity(activityData.sourceObjects ?? []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "failed to load connections");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void refresh();
  }, []);

  const connect = async (provider: string) => {
    setBusyProvider(provider);
    setError(null);
    try {
      const res = await fetch(`/api/connections/${provider}/connect`, {
        method: "POST",
      });
      const data = (await res.json()) as { authUrl?: string; error?: string };
      if (!res.ok || !data.authUrl) {
        throw new Error(data.error ?? `connect ${provider} ${res.status}`);
      }
      window.location.href = data.authUrl;
    } catch (err) {
      setError(err instanceof Error ? err.message : `failed to connect ${provider}`);
      setBusyProvider(null);
    }
  };

  const disconnect = async (provider: string) => {
    setBusyProvider(provider);
    setError(null);
    try {
      const res = await fetch(`/api/connections/${provider}/disconnect`, {
        method: "POST",
      });
      if (!res.ok) throw new Error(`disconnect ${provider} ${res.status}`);
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : `failed to disconnect ${provider}`);
    } finally {
      setBusyProvider(null);
    }
  };

  const sync = async (provider: string) => {
    setBusyProvider(provider);
    setError(null);
    try {
      const res = await fetch(`/api/connectors/${provider}/sync-now`, {
        method: "POST",
      });
      if (!res.ok) throw new Error(`sync ${provider} ${res.status}`);
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : `failed to sync ${provider}`);
    } finally {
      setBusyProvider(null);
    }
  };

  const saveManual = async (
    provider: string,
    values: { accessToken: string; orgSlug?: string },
  ) => {
    setBusyProvider(provider);
    setError(null);
    try {
      const res = await fetch(`/api/connections/${provider}/manual`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(values),
      });
      if (!res.ok) throw new Error(`manual ${provider} ${res.status}`);
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : `failed to save ${provider} token`);
    } finally {
      setBusyProvider(null);
    }
  };

  return {
    connections,
    activity,
    loading,
    busyProvider,
    error,
    connect,
    disconnect,
    sync,
    saveManual,
    refresh,
  };
}
