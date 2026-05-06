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

/**
 * Native <textarea> composer — no PromptInput, no InputGroup chrome.
 * Auto-grows up to a 8-line cap, renders a copper block caret (`▮`), and
 * handles Enter/Ctrl+Enter submit, Shift+Enter newline, Esc stop.
 *
 * Built custom because the Elements PromptInput stack had a text-color/caret
 * bug in dark mode that swallowed typed input. This implementation is 50
 * lines + transparent about exactly what happens on each keystroke.
 */
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

    // Auto-grow up to 8 lines. Keep in sync with `max-h-48` below (~192px / 24 lh).
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
      // Explicit focus — some browsers drop focus after clearing.
      requestAnimationFrame(() => textareaRef.current?.focus());
    }, [value, isStreaming, onSubmit]);

    const onKeyDown = useCallback(
      (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
        // Escape always stops if we're streaming.
        if (e.key === "Escape" && isStreaming) {
          e.preventDefault();
          onStop();
          return;
        }
        if (e.key === "Enter") {
          // Shift+Enter → newline (native behavior, do nothing).
          if (e.shiftKey) return;
          // Enter / Ctrl+Enter / Cmd+Enter → submit.
          e.preventDefault();
          submit();
        }
      },
      [isStreaming, onStop, submit],
    );

    return (
      <form
        className="border-border/60 bg-background border-t"
        onSubmit={(e) => {
          e.preventDefault();
          submit();
        }}
      >
        <div className="mx-auto w-full max-w-3xl px-6 py-4">
          <div className="border-border/70 focus-within:border-hermes/50 focus-within:ring-hermes/10 flex items-start gap-3 rounded-sm border bg-transparent px-3 py-3 transition-colors focus-within:ring-2">
            <span
              aria-hidden
              className="text-hermes mt-[3px] shrink-0 select-none text-[13px]"
            >
              ▸
            </span>
            <textarea
              ref={textareaRef}
              value={value}
              onChange={(e) => setValue(e.target.value)}
              onKeyDown={onKeyDown}
              rows={1}
              spellCheck={false}
              autoComplete="off"
              placeholder={placeholder ?? "ask anything. enter to send."}
              className={cn(
                "caret-hermes placeholder:text-muted-foreground/60",
                "min-h-[1.5rem] max-h-48 w-full resize-none overflow-y-auto",
                "bg-transparent text-[13.5px] leading-[1.55] text-foreground",
                "outline-none focus:outline-none",
              )}
              // Explicit color — guards against any parent CSS setting
              // `color: transparent` or similar.
              style={{ color: "var(--foreground)" }}
            />
            {isStreaming ? (
              <button
                type="button"
                onClick={onStop}
                className="border-border hover:border-destructive/50 hover:text-destructive inline-flex shrink-0 items-center gap-1.5 rounded-sm border px-2.5 py-1 text-[11px] uppercase tracking-wider transition-colors"
                aria-label="Stop"
              >
                <SquareIcon className="size-2.5 fill-current" />
                stop
              </button>
            ) : (
              <button
                type="submit"
                disabled={!value.trim()}
                className={cn(
                  "inline-flex shrink-0 items-center gap-1.5 rounded-sm border px-2.5 py-1 text-[11px] uppercase tracking-wider transition-colors",
                  value.trim()
                    ? "border-hermes/60 text-hermes hover:bg-hermes hover:text-hermes-foreground"
                    : "border-border/50 text-muted-foreground/50 cursor-not-allowed",
                )}
                aria-label="Send"
              >
                send
                <ArrowRightIcon className="size-2.5" />
              </button>
            )}
          </div>

          <div className="text-muted-foreground/60 mt-2 flex items-center gap-2 px-1 font-mono text-[10.5px] tracking-wide">
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
    <kbd className="border-border/60 text-foreground/80 rounded-[3px] border px-1 py-px font-mono text-[10px] leading-none">
      {children}
    </kbd>
  );
}

function Sep() {
  return <span className="text-muted-foreground/30">·</span>;
}
