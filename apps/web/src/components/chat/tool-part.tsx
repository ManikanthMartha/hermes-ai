"use client";

import { cn } from "@hermes/ui/lib/utils";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@hermes/ui/components/collapsible";
import { ChevronDownIcon } from "lucide-react";
import type { DynamicToolUIPart, ToolUIPart } from "ai";
import { useState } from "react";

type AnyToolPart = ToolUIPart | DynamicToolUIPart;

const STATE_SYMBOL: Record<AnyToolPart["state"], string> = {
  "input-streaming": "◐",
  "input-available": "◑",
  "output-available": "✓",
  "output-error": "✕",
  "output-denied": "⊘",
  "approval-requested": "?",
  "approval-responded": "✓",
};

const STATE_LABEL: Record<AnyToolPart["state"], string> = {
  "input-streaming": "preparing",
  "input-available": "running",
  "output-available": "ok",
  "output-error": "error",
  "output-denied": "denied",
  "approval-requested": "awaiting approval",
  "approval-responded": "approved",
};

const STATE_TONE: Record<AnyToolPart["state"], string> = {
  "input-streaming": "text-muted-foreground",
  "input-available": "text-hermes",
  "output-available": "text-emerald-400/80",
  "output-error": "text-destructive",
  "output-denied": "text-destructive/80",
  "approval-requested": "text-amber-400/80",
  "approval-responded": "text-emerald-400/80",
};

function toolDisplayName(part: AnyToolPart): string {
  if (part.type === "dynamic-tool") return part.toolName;
  return part.type.replace(/^tool-/, "");
}

export function ToolPart({ part }: { part: AnyToolPart }) {
  const open = useState(
    part.state === "input-streaming" || part.state === "input-available",
  );
  const [isOpen, setIsOpen] = open;

  const name = toolDisplayName(part);
  const symbol = STATE_SYMBOL[part.state];
  const label = STATE_LABEL[part.state];
  const tone = STATE_TONE[part.state];
  const isError = part.state === "output-error" || part.state === "output-denied";

  return (
    <Collapsible
      open={isOpen}
      onOpenChange={setIsOpen}
      className={cn(
        "group border-border/70 bg-card/30 my-2 rounded-sm border font-mono text-[12.5px]",
        isError && "border-destructive/40",
      )}
    >
      <CollapsibleTrigger
        className={cn(
          "hover:bg-accent/40 flex w-full items-center justify-between gap-3 px-3 py-1.5 text-left transition-colors",
        )}
      >
        <span className="text-muted-foreground flex min-w-0 items-center gap-2">
          <span className="text-muted-foreground/60">[</span>
          <span className={cn("shrink-0", tone)}>{symbol}</span>
          <span className="text-foreground truncate">{name}</span>
          <span className="text-muted-foreground/60">·</span>
          <span className={cn("truncate", tone)}>{label}</span>
          <span className="text-muted-foreground/60">]</span>
        </span>
        <ChevronDownIcon
          className={cn(
            "text-muted-foreground size-3.5 shrink-0 transition-transform",
            isOpen && "rotate-180",
          )}
        />
      </CollapsibleTrigger>

      <CollapsibleContent className="data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 border-border/60 overflow-hidden border-t">
        {"input" in part && part.input !== undefined && (
          <Section label="input">
            <Pre data={part.input} />
          </Section>
        )}
        {"output" in part && part.output !== undefined && (
          <Section label="output" error={isError}>
            <Pre data={part.output} />
          </Section>
        )}
        {"errorText" in part && part.errorText && (
          <Section label="error" error>
            <div className="text-destructive whitespace-pre-wrap">
              {part.errorText}
            </div>
          </Section>
        )}
      </CollapsibleContent>
    </Collapsible>
  );
}

function Section({
  label,
  children,
  error,
}: {
  label: string;
  children: React.ReactNode;
  error?: boolean;
}) {
  return (
    <div className="border-border/50 space-y-1.5 border-b px-3 py-2 last:border-b-0">
      <div
        className={cn(
          "text-[10px] uppercase tracking-[0.15em]",
          error ? "text-destructive/80" : "text-muted-foreground/70",
        )}
      >
        ├─ {label}
      </div>
      <div className="pl-3 text-[12px] leading-relaxed">{children}</div>
    </div>
  );
}

/**
 * LangChain's ToolMessage serializes to a bulky wrapper
 * `{ lc: 1, type: 'constructor', id: [..., 'ToolMessage'], kwargs: { content, ... } }`
 * whose actual payload is a JSON string inside `kwargs.content`. We unwrap
 * that before rendering so the user sees just the data, not the framework
 * envelope. MCP tools sometimes also wrap with `{ content: [{ type: 'text',
 * text: '...' }] }` — unwrap that too.
 */
function unwrapToolOutput(data: unknown): unknown {
  if (!data || typeof data !== "object") return data;
  const obj = data as Record<string, unknown>;

  // LangChain ToolMessage serialization
  if (
    obj.type === "constructor" &&
    Array.isArray(obj.id) &&
    obj.id.includes("ToolMessage") &&
    obj.kwargs &&
    typeof obj.kwargs === "object"
  ) {
    const inner = (obj.kwargs as Record<string, unknown>).content;
    if (typeof inner === "string") {
      try {
        return JSON.parse(inner);
      } catch {
        return inner;
      }
    }
    return unwrapToolOutput(inner);
  }

  // MCP content-block wrapper
  if (Array.isArray(obj.content)) {
    const texts = (obj.content as Array<Record<string, unknown>>)
      .filter((c) => c.type === "text" && typeof c.text === "string")
      .map((c) => c.text as string);
    if (texts.length) {
      const joined = texts.join("");
      try {
        return JSON.parse(joined);
      } catch {
        return joined;
      }
    }
  }

  return obj;
}

function Pre({ data }: { data: unknown }) {
  const unwrapped = unwrapToolOutput(data);
  const text =
    typeof unwrapped === "string"
      ? unwrapped
      : JSON.stringify(unwrapped, null, 2);
  return (
    <pre className="text-foreground/90 max-h-72 overflow-auto whitespace-pre-wrap break-words text-[11.5px] leading-[1.5]">
      {text}
    </pre>
  );
}
