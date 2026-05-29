"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  ActivityIcon,
  CalendarDaysIcon,
  CheckSquareIcon,
  ChevronDownIcon,
  HomeIcon,
  KeyRoundIcon,
  MessageSquareIcon,
  PanelLeftCloseIcon,
  PanelLeftOpenIcon,
  SearchIcon,
  ShieldCheckIcon,
  LogOutIcon,
} from "lucide-react";
import type { ReactNode } from "react";
import { useEffect, useState } from "react";
import { authClient } from "@/lib/auth-client";

const MAIN_NAV_ITEMS = [
  { href: "/", label: "Today", icon: HomeIcon },
  { href: "/actions", label: "Actions", icon: CheckSquareIcon },
  { href: "/meetings", label: "Meetings", icon: CalendarDaysIcon },
  { href: "/connections", label: "Sources", icon: KeyRoundIcon },
  { href: "/ask", label: "Ask", icon: MessageSquareIcon },
] as const;

const UTILITY_NAV_ITEMS = [
  { href: "/trust", label: "Trust & settings", icon: ShieldCheckIcon },
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
  const [collapsed, setCollapsed] = useState(false);

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
      <aside
        className={`border-b border-sidebar-border bg-sidebar transition-[width] duration-200 md:fixed md:inset-y-0 md:left-0 md:z-50 md:h-svh md:border-b-0 md:border-r ${
          collapsed ? "md:w-[72px]" : "md:w-[268px]"
        }`}
      >
          <div className="flex h-full flex-col">
            <div className="px-3 py-3">
              <Link
                href="/"
                className={`flex items-center rounded-xl px-2 py-2 transition-colors hover:bg-sidebar-accent ${
                  collapsed ? "justify-center" : "justify-between"
                }`}
                title="Hermes"
              >
                <div className="flex min-w-0 items-center gap-2">
                  <div className="grid size-8 shrink-0 place-items-center rounded-lg bg-[#f0642f] text-white shadow-sm">
                    <ActivityIcon className="size-4" />
                  </div>
                  <div className={`min-w-0 ${collapsed ? "hidden" : "block"}`}>
                    <div className="truncate text-[15px] font-semibold leading-tight">
                      Hermes
                    </div>
                    <div className="truncate text-xs text-muted-foreground">
                      Action OS
                    </div>
                  </div>
                </div>
                {!collapsed ? (
                  <ChevronDownIcon className="size-4 shrink-0 text-muted-foreground" />
                ) : null}
              </Link>

              <div className="mt-2 flex items-center gap-2">
                {!collapsed ? (
                  <button
                    type="button"
                    className="flex h-9 min-w-0 flex-1 items-center justify-between rounded-lg border border-sidebar-border bg-card px-3 text-left text-xs text-muted-foreground shadow-sm transition-colors hover:border-foreground/20 hover:text-foreground"
                  >
                    <span className="truncate">Personal workspace</span>
                    <SearchIcon className="size-3.5" />
                  </button>
                ) : null}
                <button
                  type="button"
                  onClick={() => setCollapsed((value) => !value)}
                  className="hidden size-9 shrink-0 place-items-center rounded-lg border border-sidebar-border bg-card text-muted-foreground shadow-sm transition-colors hover:border-foreground/20 hover:text-foreground md:grid"
                  aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
                  title={collapsed ? "Expand sidebar" : "Collapse sidebar"}
                >
                  {collapsed ? (
                    <PanelLeftOpenIcon className="size-4" />
                  ) : (
                    <PanelLeftCloseIcon className="size-4" />
                  )}
                </button>
              </div>
            </div>

            <nav className="grid gap-1 px-3">
              {MAIN_NAV_ITEMS.map((item) => (
                <NavLink
                  key={item.href}
                  item={item}
                  pathname={pathname}
                  collapsed={collapsed}
                />
              ))}
            </nav>

            <div className="mt-auto hidden px-3 py-3 md:block">
              <div className="mb-2 grid gap-1 border-t border-sidebar-border pt-3">
                {UTILITY_NAV_ITEMS.map((item) => (
                  <NavLink
                    key={item.href}
                    item={item}
                    pathname={pathname}
                    collapsed={collapsed}
                    subtle
                  />
                ))}
              </div>

              <div
                className={`flex items-center gap-2 rounded-xl p-2 transition-colors hover:bg-sidebar-accent ${
                  collapsed ? "justify-center" : ""
                }`}
              >
                <div className="grid size-8 shrink-0 place-items-center rounded-full bg-muted text-xs font-medium">
                  {(session.user.name || session.user.email || "H")
                    .slice(0, 1)
                    .toUpperCase()}
                </div>
                <div className={`min-w-0 flex-1 ${collapsed ? "hidden" : "block"}`}>
                  <div className="truncate text-sm font-medium">
                    {session.user.name || "Signed-in user"}
                  </div>
                  <div className="truncate text-xs text-muted-foreground">
                    {session.user.email}
                  </div>
                </div>
                {!collapsed ? (
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
                    className="grid size-8 place-items-center rounded-md text-muted-foreground hover:bg-background hover:text-foreground"
                    aria-label="Sign out"
                  >
                    <LogOutIcon className="size-4" />
                  </button>
                ) : null}
              </div>
            </div>
          </div>
      </aside>

      <main
        className={`min-w-0 transition-[padding] duration-200 ${
          collapsed ? "md:pl-[72px]" : "md:pl-[268px]"
        } ${mainClassName}`}
      >
        {children}
      </main>
    </div>
  );
}

function NavLink({
  item,
  pathname,
  collapsed = false,
  subtle = false,
}: {
  item: (typeof MAIN_NAV_ITEMS)[number] | (typeof UTILITY_NAV_ITEMS)[number];
  pathname: string | null;
  collapsed?: boolean;
  subtle?: boolean;
}) {
  const active =
    item.href === "/"
      ? pathname === "/" || pathname === "/dashboard"
      : pathname?.startsWith(item.href);
  const Icon = item.icon;

  return (
    <Link
      href={item.href}
      title={item.label}
      className={`group flex h-9 min-w-0 items-center gap-2 rounded-lg text-sm transition-colors ${
        collapsed ? "justify-center px-0" : "px-2.5"
      } ${
        active
          ? "bg-card text-foreground shadow-sm ring-1 ring-sidebar-border"
          : subtle
            ? "text-muted-foreground hover:bg-sidebar-accent hover:text-foreground"
            : "text-sidebar-foreground/80 hover:bg-sidebar-accent hover:text-foreground"
      }`}
    >
      <Icon className="size-4 shrink-0" />
      <span className={`truncate ${collapsed ? "sr-only" : ""}`}>{item.label}</span>
      {item.href === "/connections" && !collapsed ? (
        <span className="ml-auto size-1.5 rounded-full bg-emerald-500" />
      ) : null}
    </Link>
  );
}
