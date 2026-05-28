"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  ActivityIcon,
  BrainIcon,
  CalendarDaysIcon,
  CheckSquareIcon,
  HomeIcon,
  KeyRoundIcon,
  MessageSquareIcon,
  NewspaperIcon,
  ShieldCheckIcon,
  LogOutIcon,
} from "lucide-react";
import type { ReactNode } from "react";
import { useEffect } from "react";
import { authClient } from "@/lib/auth-client";

const NAV_ITEMS = [
  { href: "/", label: "Dashboard", icon: HomeIcon },
  { href: "/actions", label: "Actions", icon: CheckSquareIcon },
  { href: "/briefings", label: "Briefings", icon: NewspaperIcon },
  { href: "/meetings", label: "Meetings", icon: CalendarDaysIcon },
  { href: "/connections", label: "Connections", icon: KeyRoundIcon },
  { href: "/trust", label: "Trust", icon: ShieldCheckIcon },
  { href: "/memory", label: "Memory", icon: BrainIcon },
  { href: "/ask", label: "Ask", icon: MessageSquareIcon },
] as const;

export function AppShell({
  children,
  mainClassName = "",
}: {
  children: ReactNode;
  mainClassName?: string;
}) {
  const pathname = usePathname();
  const { data: session, isPending } = authClient.useSession();

  useEffect(() => {
    if (isPending || session?.user?.id) return;
    const callbackURL = `${window.location.pathname}${window.location.search}`;
    window.location.href = `/sign-in?callbackURL=${encodeURIComponent(callbackURL)}`;
  }, [isPending, session?.user?.id]);

  if (isPending) {
    return (
      <div className="grid min-h-svh place-items-center bg-background text-sm text-muted-foreground">
        Loading Hermes
      </div>
    );
  }

  if (!session?.user?.id) {
    return (
      <div className="grid min-h-svh place-items-center bg-background text-sm text-muted-foreground">
        Redirecting to sign in
      </div>
    );
  }

  return (
    <div className="min-h-svh overflow-x-hidden bg-background text-foreground">
      <div className="grid min-h-svh grid-cols-1 md:grid-cols-[236px_minmax(0,1fr)]">
        <aside className="border-b border-border bg-card/40 md:border-b-0 md:border-r">
          <div className="flex h-full flex-col">
            <div className="border-b border-border px-4 py-4">
              <Link href="/" className="flex items-center gap-3">
                <div className="grid size-9 place-items-center border border-hermes/50 bg-hermes/10 text-hermes">
                  <ActivityIcon className="size-4" />
                </div>
                <div>
                  <div className="text-sm font-semibold">Hermes</div>
                  <div className="text-xs text-muted-foreground">Action OS</div>
                </div>
              </Link>
            </div>

            <nav className="grid grid-cols-[repeat(3,minmax(0,1fr))] gap-2 px-3 py-3 md:flex md:flex-col">
              {NAV_ITEMS.map((item) => {
                const active =
                  item.href === "/"
                    ? pathname === "/" || pathname === "/dashboard"
                    : pathname?.startsWith(item.href);
                const Icon = item.icon;
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={`flex h-9 min-w-0 items-center gap-2 border px-2 text-xs transition-colors md:px-3 ${
                      active
                        ? "border-hermes bg-hermes text-hermes-foreground"
                        : "border-transparent text-muted-foreground hover:border-border hover:bg-background hover:text-foreground"
                    }`}
                  >
                    <Icon className="size-3.5 shrink-0" />
                    <span className="truncate">{item.label}</span>
                  </Link>
                );
              })}
            </nav>

            <div className="mt-auto hidden border-t border-border p-4 text-xs text-muted-foreground md:block">
              <div className="mb-3 h-px w-10 bg-hermes" />
              <div className="truncate text-foreground">
                {session.user.name || "Signed-in workspace"}
              </div>
              <div className="mt-1 truncate">{session.user.email}</div>
              <button
                type="button"
                onClick={() => {
                  void authClient.signOut({
                    fetchOptions: {
                      onSuccess: () => {
                        window.location.href = "/sign-in";
                      },
                    },
                  });
                }}
                className="mt-3 inline-flex h-8 items-center gap-2 border border-border px-2 text-xs hover:border-hermes/50 hover:text-foreground"
              >
                <LogOutIcon className="size-3.5" />
                Sign out
              </button>
            </div>
          </div>
        </aside>

        <main className={`min-w-0 ${mainClassName}`}>{children}</main>
      </div>
    </div>
  );
}
