"use client";

import {
  CheckCircle2Icon,
  ChevronRightIcon,
  ExternalLinkIcon,
  Loader2Icon,
  PlusIcon,
  RefreshCwIcon,
  SearchIcon,
  UnplugIcon,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import type { ConnectionProvider } from "@/lib/connection-types";

export function ConnectionCenter() {
  const {
    connections,
    loading,
    busyProvider,
    error,
    connect,
    disconnect,
    sync,
    refresh,
  } = useConnections();
  const [query, setQuery] = useState("");

  const filtered = useMemo(() => {
    const next = query.trim().toLowerCase();
    if (!next) return connections;
    return connections.filter((connection) =>
      `${connection.label} ${connection.category} ${connection.description}`
        .toLowerCase()
        .includes(next),
    );
  }, [connections, query]);

  const connected = connections.filter((item) => item.status === "connected").length;
  const issues = connections.filter(
    (item) => item.status === "degraded" || item.status === "failed" || item.failureReason,
  ).length;

  return (
    <main className="min-h-svh bg-background">
      <div className="mx-auto flex w-full max-w-5xl flex-col gap-5 px-6 py-6 lg:px-10">
        <section className="flex flex-col gap-5 md:flex-row md:items-end md:justify-between">
          <div>
            <h1 className="text-3xl font-semibold tracking-[-0.02em] md:text-4xl">
              Sources
            </h1>
            <p className="mt-3 max-w-2xl text-sm leading-6 text-muted-foreground">
              Manage the apps Hermes can use to prepare briefs, actions, and
              source-backed answers. Connected apps stay user-owned and writes
              remain approval-gated.
            </p>
          </div>

          <button
            type="button"
            onClick={() => void refresh()}
            disabled={loading}
            className="inline-flex h-10 w-fit items-center gap-2 rounded-xl border border-border bg-card px-3 text-sm font-medium shadow-sm disabled:opacity-60"
          >
            <RefreshCwIcon className={`size-4 ${loading ? "animate-spin" : ""}`} />
            Refresh
          </button>
        </section>

        {error ? (
          <div className="rounded-xl border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
            {error}
          </div>
        ) : null}

        <section className="overflow-hidden rounded-2xl border border-border bg-card shadow-sm">
          <div className="flex flex-col gap-3 border-b border-border p-4 md:flex-row md:items-center md:justify-between">
            <div>
              <h2 className="text-base font-semibold">
                Enabled apps
                <span className="ml-2 text-sm font-normal text-muted-foreground">
                  {connected}/{connections.length}
                  {issues ? ` / ${issues} need attention` : ""}
                </span>
              </h2>
              <p className="mt-1 text-sm text-muted-foreground">
                Add, reconnect, or sync apps from one simple list.
              </p>
            </div>
            <label className="flex h-10 min-w-0 items-center gap-2 rounded-xl border border-border bg-background px-3 text-sm text-muted-foreground md:w-72">
              <SearchIcon className="size-4" />
              <input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Search apps..."
                className="min-w-0 flex-1 bg-transparent outline-none placeholder:text-muted-foreground"
              />
            </label>
          </div>

          <div className="divide-y divide-border">
            {filtered.map((connection) => (
              <IntegrationRow
                key={connection.provider}
                connection={connection}
                busy={busyProvider === connection.provider}
                onConnect={connect}
                onDisconnect={disconnect}
                onSync={sync}
              />
            ))}
            {!filtered.length ? (
              <div className="p-8 text-center text-sm text-muted-foreground">
                No apps match your search.
              </div>
            ) : null}
          </div>
        </section>
      </div>
    </main>
  );
}

function IntegrationRow({
  connection,
  busy,
  onConnect,
  onDisconnect,
  onSync,
}: {
  connection: ConnectionProvider;
  busy: boolean;
  onConnect: (provider: string) => void | Promise<void>;
  onDisconnect: (provider: string) => void | Promise<void>;
  onSync: (provider: string) => void | Promise<void>;
}) {
  const [open, setOpen] = useState(false);
  const connected = connection.status === "connected";
  const attention = connection.failureReason || connection.status === "failed";

  return (
    <article>
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        className="flex w-full items-center gap-4 px-4 py-4 text-left transition-colors hover:bg-muted/50"
      >
        <div className="grid size-11 shrink-0 place-items-center rounded-full bg-muted text-sm font-semibold">
          {connection.label.slice(0, 1)}
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex min-w-0 flex-wrap items-center gap-2">
            <h3 className="truncate text-base font-semibold">{connection.label}</h3>
            <StatusLabel connected={connected} attention={Boolean(attention)} />
          </div>
          <p className="mt-1 line-clamp-1 text-sm text-muted-foreground">
            {connection.description}
          </p>
        </div>
        <ChevronRightIcon
          className={`size-5 shrink-0 text-muted-foreground transition-transform ${
            open ? "rotate-90" : ""
          }`}
        />
      </button>

      {open ? (
        <div className="border-t border-border bg-background/60 px-4 py-4">
          <div className="ml-[60px] grid gap-4 md:grid-cols-[minmax(0,1fr)_auto]">
            <div className="grid gap-2 text-sm text-muted-foreground sm:grid-cols-3">
              <Info label="Category" value={categoryTitle(connection.category)} />
              <Info
                label="Last sync"
                value={formatTime(connection.lastSuccessfulSync ?? connection.lastAttemptedSync)}
              />
              <Info
                label="Access"
                value={
                  connection.requiredScopes.length
                    ? `${connection.requiredScopes.length} permissions`
                    : "Not requested"
                }
              />
            </div>

            <div className="flex flex-wrap gap-2 md:justify-end">
              <button
                type="button"
                disabled={busy || !connection.oauthReady}
                onClick={() => void onConnect(connection.provider)}
                className="inline-flex h-9 items-center gap-2 rounded-lg bg-primary px-3 text-sm font-medium text-primary-foreground disabled:opacity-50"
              >
                {busy ? <Loader2Icon className="size-4 animate-spin" /> : connected ? <ExternalLinkIcon className="size-4" /> : <PlusIcon className="size-4" />}
                {connected ? "Reconnect" : "Connect"}
              </button>
              <button
                type="button"
                disabled={busy || !connected}
                onClick={() => void onSync(connection.provider)}
                className="inline-flex h-9 items-center gap-2 rounded-lg border border-border bg-card px-3 text-sm font-medium disabled:opacity-50"
              >
                <RefreshCwIcon className="size-4" />
                Sync
              </button>
              <button
                type="button"
                disabled={busy || !connected}
                onClick={() => void onDisconnect(connection.provider)}
                className="inline-flex h-9 items-center gap-2 rounded-lg border border-border bg-card px-3 text-sm font-medium text-muted-foreground disabled:opacity-50"
              >
                <UnplugIcon className="size-4" />
                Disconnect
              </button>
            </div>
          </div>

          {attention ? (
            <div className="ml-[60px] mt-3 rounded-xl border border-destructive/20 bg-destructive/10 px-3 py-2 text-sm text-destructive">
              {connection.failureReason ?? "This app needs attention."}
            </div>
          ) : null}
        </div>
      ) : null}
    </article>
  );
}

function StatusLabel({
  connected,
  attention,
}: {
  connected: boolean;
  attention: boolean;
}) {
  if (attention) {
    return (
      <span className="rounded-full bg-destructive/10 px-2 py-0.5 text-xs font-medium text-destructive">
        Needs attention
      </span>
    );
  }

  if (connected) {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-medium text-emerald-700">
        <CheckCircle2Icon className="size-3" />
        Connected
      </span>
    );
  }

  return (
    <span className="rounded-full bg-muted px-2 py-0.5 text-xs font-medium text-muted-foreground">
      Not connected
    </span>
  );
}

function Info({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className="mt-1 font-medium text-foreground">{value}</div>
    </div>
  );
}

function categoryTitle(category: string) {
  switch (category) {
    case "meetings":
      return "Calendar";
    case "communications":
      return "Communication";
    case "engineering":
      return "Engineering";
    case "planning":
      return "Planning";
    case "observability":
      return "Reliability";
    default:
      return category;
  }
}

function formatTime(value: string | null) {
  if (!value) return "Never";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Unknown";
  return new Intl.DateTimeFormat(undefined, {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(date);
}

function useConnections() {
  const [connections, setConnections] = useState<ConnectionProvider[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyProvider, setBusyProvider] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const refresh = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/connections", { cache: "no-store" });
      if (!res.ok) throw new Error(`connections ${res.status}`);
      const data = (await res.json()) as { connections?: ConnectionProvider[] };
      setConnections(data.connections ?? []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load integrations");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void refresh();
  }, []);

  const connect = async (provider: string) => {
    setBusyProvider(provider);
    try {
      const res = await fetch(`/api/connections/${provider}/connect`, {
        method: "POST",
      });
      const data = (await res.json()) as { authUrl?: string; error?: string };
      if (!res.ok || !data.authUrl) throw new Error(data.error ?? "connect failed");
      window.location.href = data.authUrl;
    } catch (err) {
      setError(err instanceof Error ? err.message : "Connection failed");
    } finally {
      setBusyProvider(null);
    }
  };

  const disconnect = async (provider: string) => {
    setBusyProvider(provider);
    try {
      const res = await fetch(`/api/connections/${provider}/disconnect`, {
        method: "POST",
      });
      if (!res.ok) throw new Error(`disconnect ${res.status}`);
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Disconnect failed");
    } finally {
      setBusyProvider(null);
    }
  };

  const sync = async (provider: string) => {
    setBusyProvider(provider);
    try {
      const res = await fetch(`/api/connectors/${provider}/sync-now`, {
        method: "POST",
      });
      if (!res.ok) throw new Error(`sync ${res.status}`);
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Sync failed");
    } finally {
      setBusyProvider(null);
    }
  };

  return {
    connections,
    loading,
    busyProvider,
    error,
    connect,
    disconnect,
    sync,
    refresh,
  };
}
