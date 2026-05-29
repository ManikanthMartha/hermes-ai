"use client";

import { cn } from "@hermes/ui/lib/utils";
import { ArrowRightIcon, SquareIcon } from "lucide-react";
import {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useRef,
  useState,
} from "react";

export interface ComposerHandle {
  focus: () => void;
  clear: () => void;
}

interface ComposerProps {
  onSubmit: (text: string) => void;
  onStop: () => void;
  isStreaming: boolean;
  placeholder?: string;
}

export const Composer = forwardRef<ComposerHandle, ComposerProps>(
  function Composer({ onSubmit, onStop, isStreaming, placeholder }, ref) {
    const textareaRef = useRef<HTMLTextAreaElement | null>(null);
    const [value, setValue] = useState("");

    useImperativeHandle(
      ref,
      () => ({
        focus: () => textareaRef.current?.focus(),
        clear: () => setValue(""),
      }),
      [],
    );

    useEffect(() => {
      const el = textareaRef.current;
      if (!el) return;
      el.style.height = "auto";
      el.style.height = `${Math.min(el.scrollHeight, 192)}px`;
    }, [value]);

    const submit = useCallback(() => {
      const trimmed = value.trim();
      if (!trimmed || isStreaming) return;
      onSubmit(trimmed);
      setValue("");
      requestAnimationFrame(() => textareaRef.current?.focus());
    }, [value, isStreaming, onSubmit]);

    const onKeyDown = useCallback(
      (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
        if (e.key === "Escape" && isStreaming) {
          e.preventDefault();
          onStop();
          return;
        }
        if (e.key === "Enter") {
          if (e.shiftKey) return;
          e.preventDefault();
          submit();
        }
      },
      [isStreaming, onStop, submit],
    );

    return (
      <form
        className="border-t border-border bg-background/95"
        onSubmit={(e) => {
          e.preventDefault();
          submit();
        }}
      >
        <div className="mx-auto w-full max-w-3xl px-6 py-5">
          <div className="flex items-start gap-3 rounded-2xl border border-border bg-card px-4 py-3 shadow-sm transition-colors focus-within:border-hermes/50 focus-within:ring-4 focus-within:ring-hermes/10">
            <span
              aria-hidden
              className="mt-[3px] shrink-0 select-none text-[13px] text-hermes"
            >
              &gt;
            </span>
            <textarea
              ref={textareaRef}
              value={value}
              onChange={(e) => setValue(e.target.value)}
              onKeyDown={onKeyDown}
              rows={1}
              spellCheck={false}
              autoComplete="off"
              placeholder={placeholder ?? "Ask about a meeting, action, source, or memory"}
              className={cn(
                "caret-hermes placeholder:text-muted-foreground",
                "min-h-[1.5rem] max-h-48 w-full resize-none overflow-y-auto",
                "bg-transparent text-sm leading-[1.6] text-foreground",
                "outline-none focus:outline-none",
              )}
              style={{ color: "var(--foreground)" }}
            />
            {isStreaming ? (
              <button
                type="button"
                onClick={onStop}
                className="inline-flex h-8 shrink-0 items-center gap-1.5 rounded-lg border border-border px-3 text-xs font-medium transition-colors hover:border-destructive/50 hover:text-destructive"
                aria-label="Stop"
              >
                <SquareIcon className="size-2.5 fill-current" />
                Stop
              </button>
            ) : (
              <button
                type="submit"
                disabled={!value.trim()}
                className={cn(
                  "inline-flex h-8 shrink-0 items-center gap-1.5 rounded-lg border px-3 text-xs font-medium transition-colors",
                  value.trim()
                    ? "border-primary bg-primary text-primary-foreground"
                    : "cursor-not-allowed border-border/70 text-muted-foreground/60",
                )}
                aria-label="Send"
              >
                Send
                <ArrowRightIcon className="size-3" />
              </button>
            )}
          </div>

          <div className="mt-2 flex items-center gap-2 px-1 text-[11px] text-muted-foreground">
            <Kbd>enter</Kbd>
            <span>send</span>
            <Sep />
            <Kbd>shift</Kbd>
            <span>+</span>
            <Kbd>enter</Kbd>
            <span>newline</span>
            {isStreaming && (
              <>
                <Sep />
                <Kbd>esc</Kbd>
                <span>stop</span>
              </>
            )}
          </div>
        </div>
      </form>
    );
  },
);

function Kbd({ children }: { children: React.ReactNode }) {
  return (
    <kbd className="rounded-md border border-border bg-card px-1.5 py-0.5 font-mono text-[10px] leading-none text-foreground/80">
      {children}
    </kbd>
  );
}

function Sep() {
  return <span className="text-muted-foreground/40">/</span>;
}
