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
} from "lucide-react";
import type { ReactNode } from "react";

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

  return (
    <div className="min-h-svh bg-background text-foreground">
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

            <nav className="flex gap-2 overflow-x-auto px-3 py-3 md:flex-col md:overflow-visible">
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
                    className={`flex h-9 shrink-0 items-center gap-2 border px-3 text-xs transition-colors ${
                      active
                        ? "border-hermes bg-hermes text-hermes-foreground"
                        : "border-transparent text-muted-foreground hover:border-border hover:bg-background hover:text-foreground"
                    }`}
                  >
                    <Icon className="size-3.5" />
                    {item.label}
                  </Link>
                );
              })}
            </nav>

            <div className="mt-auto hidden border-t border-border p-4 text-xs text-muted-foreground md:block">
              <div className="mb-2 h-px w-10 bg-hermes" />
              Personal workspace
            </div>
          </div>
        </aside>

        <main className={`min-w-0 ${mainClassName}`}>{children}</main>
      </div>
    </div>
  );
}

