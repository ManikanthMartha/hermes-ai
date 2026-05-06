"use client";

import { useEffect, useState } from "react";
import { Brand } from "./brand";

type Health = {
  status: "ok" | "degraded";
  services: { neon: string; upstash: string };
};

type ChatStatus = "submitted" | "streaming" | "ready" | "error";

interface StatusStripProps {
  chatStatus: ChatStatus;
}

const STATUS_LABEL: Record<ChatStatus, string> = {
  submitted: "thinking",
  streaming: "streaming",
  ready: "ready",
  error: "error",
};

const STATUS_TONE: Record<ChatStatus, string> = {
  submitted: "text-hermes",
  streaming: "text-hermes",
  ready: "text-muted-foreground",
  error: "text-destructive",
};

export function StatusStrip({ chatStatus }: StatusStripProps) {
  const [health, setHealth] = useState<Health | null>(null);
  const [clock, setClock] = useState(() => fmtTime());

  // Poll /api/health every 20s through the Next.js proxy — harmless small request.
  useEffect(() => {
    let cancelled = false;
    const tick = async () => {
      try {
        const res = await fetch("/api/health", { cache: "no-store" });
        if (!res.ok || cancelled) return;
        const body = (await res.json()) as Health;
        if (!cancelled) setHealth(body);
      } catch {
        /* ignore — we render "—" for unknown */
      }
    };
    void tick();
    const id = setInterval(tick, 20_000);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, []);

  // Tick the clock every 10s — enough to reflect minute changes without churn.
  useEffect(() => {
    const id = setInterval(() => setClock(fmtTime()), 10_000);
    return () => clearInterval(id);
  }, []);

  return (
    <header className="border-border/60 bg-background/80 sticky top-0 z-40 border-b backdrop-blur-sm">
      <div className="mx-auto flex h-10 max-w-5xl items-center justify-between gap-4 px-6 text-[11.5px]">
        <div className="flex items-center gap-4">
          <Brand />
        </div>
        <div className="text-muted-foreground/80 flex items-center gap-4 font-mono">
          <Pair k="neon">
            <span className={tone(health?.services.neon)}>
              {health?.services.neon ?? "—"}
            </span>
          </Pair>
          <Sep />
          <Pair k="upstash">
            <span className={tone(health?.services.upstash)}>
              {health?.services.upstash ?? "—"}
            </span>
          </Pair>
          <Sep />
          <Pair k="agent">
            <span className={STATUS_TONE[chatStatus]}>
              {STATUS_LABEL[chatStatus]}
            </span>
          </Pair>
          <Sep />
          <span className="text-muted-foreground tabular-nums">{clock}</span>
        </div>
      </div>
    </header>
  );
}

function Pair({ k, children }: { k: string; children: React.ReactNode }) {
  return (
    <span className="flex items-center gap-1.5">
      <span className="text-muted-foreground/60">{k}</span>
      <span className="text-muted-foreground/40">▸</span>
      {children}
    </span>
  );
}

function Sep() {
  return <span className="text-muted-foreground/20">·</span>;
}

function tone(state?: string) {
  if (!state) return "text-muted-foreground/50";
  if (state === "connected") return "text-emerald-400/90";
  if (state === "error") return "text-destructive";
  return "text-muted-foreground";
}

function fmtTime() {
  const d = new Date();
  return d.toLocaleTimeString("en-US", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
}

