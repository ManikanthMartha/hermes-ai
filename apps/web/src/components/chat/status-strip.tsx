"use client";

import { useEffect, useState } from "react";
import { Brand } from "./brand";

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
  const [clock, setClock] = useState(() => fmtTime());

  // Tick the clock every 10s to reflect minute changes without churn.
  useEffect(() => {
    const id = setInterval(() => setClock(fmtTime()), 10_000);
    return () => clearInterval(id);
  }, []);

  return (
    <header className="sticky top-0 z-40 border-b border-border bg-card/80 backdrop-blur-sm">
      <div className="mx-auto flex h-12 max-w-5xl items-center justify-between gap-4 px-6 text-xs">
        <div className="flex items-center gap-4">
          <Brand />
        </div>
        <div className="hidden items-center gap-3 text-muted-foreground sm:flex">
          <span className={STATUS_TONE[chatStatus]}>
            {chatStatus === "ready" ? "Ready" : STATUS_LABEL[chatStatus]}
          </span>
          <Sep />
          <span className="tabular-nums text-muted-foreground">{clock}</span>
        </div>
      </div>
    </header>
  );
}

function Sep() {
  return <span className="text-muted-foreground/30">/</span>;
}

function fmtTime() {
  const d = new Date();
  return d.toLocaleTimeString("en-US", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
}
