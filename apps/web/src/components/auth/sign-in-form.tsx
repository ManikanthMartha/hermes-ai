"use client";

import { ActivityIcon, Loader2Icon } from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";
import { authClient } from "@/lib/auth-client";

type Mode = "sign-in" | "sign-up";

export function SignInForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const callbackURL = searchParams.get("callbackURL") ?? "/";
  const [mode, setMode] = useState<Mode>("sign-in");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setLoading(true);
    setError(null);

    try {
      if (mode === "sign-up") {
        const result = await authClient.signUp.email({
          name: name.trim() || email.split("@")[0] || "Hermes user",
          email,
          password,
        });
        if (result.error) throw new Error(result.error.message);
      } else {
        const result = await authClient.signIn.email({
          email,
          password,
          rememberMe: true,
        });
        if (result.error) throw new Error(result.error.message);
      }
      router.push(callbackURL);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Authentication failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="min-h-svh bg-background text-foreground">
      <div className="grid min-h-svh lg:grid-cols-[minmax(0,1fr)_460px]">
        <section className="hidden border-r border-border bg-card/40 p-10 lg:flex lg:flex-col lg:justify-between">
          <div className="flex items-center gap-3">
            <div className="grid size-10 place-items-center rounded-xl border border-border bg-background text-hermes shadow-sm">
              <ActivityIcon className="size-4" />
            </div>
            <div>
              <div className="text-sm font-semibold">Hermes</div>
              <div className="text-xs text-muted-foreground">Action OS</div>
            </div>
          </div>

          <div className="max-w-2xl">
            <div className="mb-5 inline-flex rounded-full border border-border bg-background px-3 py-1 text-xs text-muted-foreground">
              secure workspace
            </div>
            <h1 className="max-w-3xl font-display text-7xl leading-[0.9] tracking-[-0.045em]">
              Your workday, <span className="italic">already briefed.</span>
            </h1>
            <p className="mt-5 max-w-xl text-sm leading-6 text-muted-foreground">
              Sign in to connect your sources, review prepared actions, and keep
              workspace memory scoped to your account.
            </p>
          </div>

          <div className="text-xs text-muted-foreground">
            Credentials are encrypted server-side. Source data is scoped per
            signed-in user.
          </div>
        </section>

        <section className="flex items-center justify-center px-5 py-10">
          <form
            onSubmit={(event) => void submit(event)}
            className="w-full max-w-sm rounded-3xl border border-border bg-card p-6 shadow-sm"
          >
            <div className="mb-6">
              <div className="mb-4 flex items-center gap-3 lg:hidden">
                <div className="grid size-9 place-items-center rounded-xl border border-border bg-background text-hermes">
                  <ActivityIcon className="size-4" />
                </div>
                <div>
                  <div className="text-sm font-semibold">Hermes</div>
                  <div className="text-xs text-muted-foreground">Action OS</div>
                </div>
              </div>
              <h2 className="text-2xl font-semibold tracking-tight">
                {mode === "sign-in" ? "Sign in" : "Create account"}
              </h2>
              <p className="mt-2 text-sm leading-6 text-muted-foreground">
                Use email and password to access your Hermes workspace.
              </p>
            </div>

            <div className="grid gap-3">
              {mode === "sign-up" && (
                <label className="grid gap-1.5 text-xs text-muted-foreground">
                  Name
                  <input
                    value={name}
                    onChange={(event) => setName(event.target.value)}
                    className="h-10 rounded-xl border border-border bg-background px-3 text-sm text-foreground outline-none focus:border-foreground/40"
                    autoComplete="name"
                  />
                </label>
              )}
              <label className="grid gap-1.5 text-xs text-muted-foreground">
                Email
                <input
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  className="h-10 rounded-xl border border-border bg-background px-3 text-sm text-foreground outline-none focus:border-foreground/40"
                  type="email"
                  autoComplete="email"
                  required
                />
              </label>
              <label className="grid gap-1.5 text-xs text-muted-foreground">
                Password
                <input
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  className="h-10 rounded-xl border border-border bg-background px-3 text-sm text-foreground outline-none focus:border-foreground/40"
                  type="password"
                  autoComplete={mode === "sign-in" ? "current-password" : "new-password"}
                  minLength={8}
                  required
                />
              </label>
            </div>

            {error && (
              <div className="mt-4 rounded-xl border border-destructive/40 bg-destructive/10 px-3 py-2 text-xs text-destructive">
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="mt-5 inline-flex h-10 w-full items-center justify-center gap-2 rounded-xl bg-primary px-4 text-sm font-medium text-primary-foreground disabled:opacity-60"
            >
              {loading && <Loader2Icon className="size-4 animate-spin" />}
              {mode === "sign-in" ? "Sign in" : "Create account"}
            </button>

            <button
              type="button"
              onClick={() => {
                setMode((value) => (value === "sign-in" ? "sign-up" : "sign-in"));
                setError(null);
              }}
              className="mt-4 w-full text-center text-xs text-muted-foreground hover:text-foreground"
            >
              {mode === "sign-in"
                ? "Need an account? Create one"
                : "Already have an account? Sign in"}
            </button>
          </form>
        </section>
      </div>
    </main>
  );
}
