"use client";

import {
  ActivityIcon,
  AlertTriangleIcon,
  ArrowLeftIcon,
  ArrowRightIcon,
  BrainIcon,
  CalendarClockIcon,
  CalendarDaysIcon,
  CheckCircle2Icon,
  CheckIcon,
  ChevronDownIcon,
  ChevronRightIcon,
  Clock3Icon,
  FileClockIcon,
  FileTextIcon,
  HistoryIcon,
  HomeIcon,
  InboxIcon,
  KeyRoundIcon,
  ListChecksIcon,
  Loader2Icon,
  LogOutIcon,
  MessageSquareIcon,
  PanelLeftCloseIcon,
  RefreshCwIcon,
  SearchIcon,
  SendIcon,
  ShieldCheckIcon,
  SlidersHorizontalIcon,
  SparklesIcon,
  SquareIcon,
  UserPlusIcon,
  UsersIcon,
  XIcon,
} from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  demoActions,
  demoAskPrompts,
  demoDrafts,
  demoIntegrations,
  demoMemories,
  demoMeetings,
} from "@/demo/data";
import type {
  DemoActionStatus,
  DemoIntegration,
  DemoLead,
  DemoMemory,
  DemoMemoryStatus,
} from "@/demo/types";

type DemoWorkspaceProps = {
  lead: DemoLead | null;
  onExit: () => void;
};

type DemoView = "dashboard" | "actions" | "meetings" | "sources" | "memory" | "ask";
type ActionTab = "summary" | "draft" | "evidence" | "history";

const actionStorageKey = "hermes_demo_v1_actions";
const askStorageKey = "hermes_demo_v1_query";
const memoryStorageKey = "hermes_demo_v1_memory_events";

const navItems = [
  { id: "dashboard", label: "Today", icon: HomeIcon },
  { id: "actions", label: "Actions", icon: InboxIcon },
  { id: "meetings", label: "Meetings", icon: CalendarDaysIcon },
  { id: "sources", label: "Sources", icon: KeyRoundIcon },
  { id: "memory", label: "Memory", icon: BrainIcon },
  { id: "ask", label: "Ask", icon: MessageSquareIcon },
] as const;

const sessions = [
  { title: "board sync launch prep", meta: "Today - 12 msgs" },
  { title: "Acme renewal risk and support tickets", meta: "Today - 8 msgs" },
  { title: "finance approvals for launch", meta: "Yesterday - 5 msgs" },
];

const descriptions: Record<string, string> = {
  Slack: "Search workspace conversations and turn updates into action signals.",
  Gmail: "Read and draft email workflows with user-authorized mailbox access.",
  Outlook: "Read Outlook mail and calendar context for meeting prep and replies.",
  "Google Calendar": "Read upcoming meetings and create meeting prep from calendar context.",
  GitHub: "Find assigned issues, PRs, reviews, and engineering follow-ups.",
  Jira: "Track product execution signals, blockers, and launch risk work.",
  Linear: "Sync assigned issues and project execution signals.",
  Asana: "Watch operational tasks and cross-functional handoffs.",
  QuickBooks: "Surface invoices, finance approvals, and vendor blockers.",
  Stripe: "Read revenue changes, payments, and customer risk signals.",
  HubSpot: "Connect sales pipeline context to renewals and customer actions.",
  Salesforce: "Read account and opportunity context for customer work.",
  Notion: "Use docs, memos, and operating notes as source-backed context.",
  "Google Drive": "Read shared docs and evidence folders for prepared work.",
  Zendesk: "Watch support tickets and customer escalations.",
  Intercom: "Read customer conversations and recurring support themes.",
  Shopify: "Monitor commerce updates, launch pages, and store operations.",
};

const iconSlugs: Record<string, string> = {
  Slack: "slack",
  Gmail: "gmail",
  Outlook: "microsoft-outlook",
  "Google Calendar": "google-calendar",
  GitHub: "github",
  Jira: "jira",
  Linear: "linear",
  Asana: "asana",
  QuickBooks: "quickbooks",
  Stripe: "stripe",
  HubSpot: "hubspot",
  Salesforce: "salesforce",
  Notion: "notion",
  "Google Drive": "google-drive",
  Zendesk: "zendesk",
  Intercom: "intercom",
  Shopify: "shopify",
};

export function DemoWorkspace({ lead, onExit }: DemoWorkspaceProps) {
  const [view, setView] = useState<DemoView>("dashboard");
  const [selectedActionId, setSelectedActionId] = useState(demoActions[0]?.id ?? "");
  const [selectedMeetingId, setSelectedMeetingId] = useState(demoMeetings[0]?.id ?? "");
  const [selectedMemoryId, setSelectedMemoryId] = useState(demoMemories[0]?.id ?? "");
  const [selectedPromptId, setSelectedPromptId] = useState("");
  const [actionStates, setActionStates] = useState<Record<string, DemoActionStatus>>({});
  const [memoryEvents, setMemoryEvents] = useState<Record<string, DemoActionStatus>>({});
  const [queryState, setQueryState] = useState<DemoActionStatus>("idle");
  const [toast, setToast] = useState("Hermes demo loaded with sample company data.");
  const timers = useRef<Array<ReturnType<typeof setTimeout>>>([]);

  useEffect(() => {
    const savedActions = window.localStorage.getItem(actionStorageKey);
    if (savedActions) {
      try {
        setActionStates(JSON.parse(savedActions) as Record<string, DemoActionStatus>);
      } catch {
        window.localStorage.removeItem(actionStorageKey);
      }
    }

    const savedQuery = window.localStorage.getItem(askStorageKey);
    if (savedQuery && demoAskPrompts.some((prompt) => prompt.id === savedQuery)) {
      setSelectedPromptId(savedQuery);
      setQueryState("done");
    }

    const savedMemoryEvents = window.localStorage.getItem(memoryStorageKey);
    if (savedMemoryEvents) {
      try {
        setMemoryEvents(JSON.parse(savedMemoryEvents) as Record<string, DemoActionStatus>);
      } catch {
        window.localStorage.removeItem(memoryStorageKey);
      }
    }

    return () => timers.current.forEach((timer) => clearTimeout(timer));
  }, []);

  useEffect(() => {
    window.scrollTo({ top: 0, left: 0 });
  }, [view]);

  const selectedAction =
    demoActions.find((action) => action.id === selectedActionId) ?? demoActions[0];
  const selectedMeeting =
    demoMeetings.find((meeting) => meeting.id === selectedMeetingId) ?? demoMeetings[0];
  const selectedPrompt =
    demoAskPrompts.find((prompt) => prompt.id === selectedPromptId) ?? null;
  const selectedMemory =
    demoMemories.find((memory) => memory.id === selectedMemoryId) ?? demoMemories[0];
  const completedCount = useMemo(
    () => Object.values(actionStates).filter((state) => state === "done").length,
    [actionStates],
  );

  function persistActions(next: Record<string, DemoActionStatus>) {
    window.localStorage.setItem(actionStorageKey, JSON.stringify(next));
  }

  function persistMemoryEvents(next: Record<string, DemoActionStatus>) {
    window.localStorage.setItem(memoryStorageKey, JSON.stringify(next));
  }

  function recordMemoryUpdate(sourceId: string) {
    const memoryId = memoryIdForSource(sourceId);
    if (!memoryId) return;
    setMemoryEvents((current) => {
      const next = { ...current, [memoryId]: "done" as DemoActionStatus };
      persistMemoryEvents(next);
      return next;
    });
  }

  function runAction(id: string, doneLabel: string) {
    if (actionStates[id] === "loading" || actionStates[id] === "done") return;

    setActionStates((current) => {
      const next = { ...current, [id]: "loading" as DemoActionStatus };
      persistActions(next);
      return next;
    });
    setToast("Hermes is preparing the approval state...");

    const timer = setTimeout(() => {
      setActionStates((current) => {
        const next = { ...current, [id]: "done" as DemoActionStatus };
        persistActions(next);
        return next;
      });
      recordMemoryUpdate(id);
      setToast(`${doneLabel}. Company memory updated.`);
    }, 1800);
    timers.current.push(timer);
  }

  function runPrompt(id: string) {
    setSelectedPromptId(id);
    setQueryState("loading");
    setToast("Hermes is reading the prepared source trail...");

    const timer = setTimeout(() => {
      setQueryState("done");
      window.localStorage.setItem(askStorageKey, id);
      setToast("Answer prepared from demo sources.");
    }, 1500);
    timers.current.push(timer);
  }

  return (
    <section
      aria-label="Hermes interactive product demo"
      className="hermes-product-demo min-h-svh overflow-x-hidden bg-background text-foreground"
      style={{ fontFamily: "var(--font-web-sans), ui-sans-serif, system-ui, sans-serif" }}
    >
      <aside className="border-b border-sidebar-border bg-sidebar transition-[width] duration-200 md:fixed md:inset-y-0 md:left-0 md:z-50 md:h-svh md:w-[268px] md:border-b-0 md:border-r">
        <div className="flex h-full flex-col">
          <div className="px-3 py-3">
            <button
              type="button"
              onClick={onExit}
              className="mb-2 inline-flex h-8 items-center gap-2 rounded-lg px-2 text-xs text-muted-foreground transition-colors hover:bg-sidebar-accent hover:text-foreground"
            >
              <ArrowLeftIcon className="size-3.5" />
              Landing
            </button>

            <button
              type="button"
              onClick={() => setView("dashboard")}
              className="flex w-full items-center justify-between rounded-xl px-2 py-2 transition-colors hover:bg-sidebar-accent"
            >
              <div className="flex min-w-0 items-center gap-2">
                <div className="grid size-8 shrink-0 place-items-center rounded-lg bg-[#f0642f] text-white shadow-sm">
                  <ActivityIcon className="size-4" />
                </div>
                <div className="min-w-0 text-left">
                  <div className="truncate text-[15px] font-semibold leading-tight">Hermes</div>
                  <div className="truncate text-xs text-muted-foreground">Action OS</div>
                </div>
              </div>
              <ChevronDownIcon className="size-4 shrink-0 text-muted-foreground" />
            </button>

            <div className="mt-2 flex items-center gap-2">
              <button
                type="button"
                className="flex h-9 min-w-0 flex-1 items-center justify-between rounded-lg border border-sidebar-border bg-card px-3 text-left text-xs text-muted-foreground shadow-sm"
              >
                <span className="truncate">Personal workspace</span>
                <SearchIcon className="size-3.5" />
              </button>
              <button
                type="button"
                aria-label="Collapse sidebar"
                className="hidden size-9 shrink-0 place-items-center rounded-lg border border-sidebar-border bg-card text-muted-foreground shadow-sm md:grid"
              >
                <PanelLeftCloseIcon className="size-4" />
              </button>
            </div>
          </div>

          <nav className="grid gap-1 px-3">
            {navItems.map((item) => {
              const Icon = item.icon;
              const active = view === item.id;
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => setView(item.id)}
                  className={`group flex h-9 min-w-0 items-center gap-2 rounded-lg px-2.5 text-sm transition-colors ${
                    active
                      ? "bg-card text-foreground shadow-sm ring-1 ring-sidebar-border"
                      : "text-sidebar-foreground/80 hover:bg-sidebar-accent hover:text-foreground"
                  }`}
                >
                  <Icon className="size-4 shrink-0" />
                  <span className="truncate">{item.label}</span>
                  {item.id === "sources" ? (
                    <span className="ml-auto size-1.5 rounded-full bg-emerald-500" />
                  ) : null}
                  {item.id === "memory" ? (
                    <span className="ml-auto size-1.5 rounded-full bg-hermes" />
                  ) : null}
                </button>
              );
            })}
          </nav>

          <div className="mt-auto hidden px-3 py-3 md:block">
            <div className="mb-2 grid gap-1 border-t border-sidebar-border pt-3">
              <button
                type="button"
                className="flex h-9 min-w-0 items-center gap-2 rounded-lg px-2.5 text-sm text-muted-foreground transition-colors hover:bg-sidebar-accent hover:text-foreground"
              >
                <ShieldCheckIcon className="size-4 shrink-0" />
                <span className="truncate">Trust & settings</span>
              </button>
            </div>

            <div className="flex items-center gap-2 rounded-xl p-2 transition-colors hover:bg-sidebar-accent">
              <div className="grid size-8 shrink-0 place-items-center rounded-full bg-muted text-xs font-medium">
                {(lead?.name || "M").slice(0, 1).toUpperCase()}
              </div>
              <div className="min-w-0 flex-1">
                <div className="truncate text-sm font-medium">{lead?.name || "Manikanth Martha"}</div>
                <div className="truncate text-xs text-muted-foreground">
                  {lead?.email || "srimanikanth04@gmail.com"}
                </div>
              </div>
              <LogOutIcon className="size-4 text-muted-foreground" />
            </div>
          </div>
        </div>
      </aside>

      <main className="min-w-0 md:pl-[268px]">
        <ToastBar message={toast} />
        {view === "dashboard" ? (
          <DashboardView
            completedCount={completedCount}
            memoryUpdateCount={Object.values(memoryEvents).filter((state) => state === "done").length}
            onOpenView={setView}
          />
        ) : null}
        {view === "actions" && selectedAction ? (
          <ActionsView
            selectedId={selectedAction.id}
            actionStates={actionStates}
            onSelect={setSelectedActionId}
            onRunAction={runAction}
          />
        ) : null}
        {view === "meetings" && selectedMeeting ? (
          <MeetingsView
            selectedId={selectedMeeting.id}
            prepareState={actionStates[`meeting-${selectedMeeting.id}`] ?? "idle"}
            onPrepare={() =>
              runAction(`meeting-${selectedMeeting.id}`, "Meeting prep refreshed")
            }
            onSelect={setSelectedMeetingId}
          />
        ) : null}
        {view === "sources" ? <SourcesView /> : null}
        {view === "memory" && selectedMemory ? (
          <MemoryView
            selectedId={selectedMemory.id}
            memoryEvents={memoryEvents}
            onSelect={setSelectedMemoryId}
            onOpenView={setView}
          />
        ) : null}
        {view === "ask" ? (
          <AskView
            selectedPrompt={selectedPrompt}
            queryState={queryState}
            onRunPrompt={runPrompt}
          />
        ) : null}
      </main>
    </section>
  );
}

function ToastBar({ message }: { message: string }) {
  return (
    <div className="fixed bottom-4 left-1/2 z-[70] hidden -translate-x-1/2 items-center gap-2 rounded-full border border-border bg-card px-3 py-1.5 text-xs text-muted-foreground shadow-sm md:flex">
      <SparklesIcon className="size-3.5 text-hermes" />
      {message}
    </div>
  );
}

function DashboardView({
  completedCount,
  memoryUpdateCount,
  onOpenView,
}: {
  completedCount: number;
  memoryUpdateCount: number;
  onOpenView: (view: DemoView) => void;
}) {
  const topAction = demoActions[0];
  const nextMeeting = demoMeetings[0];
  const conflictedMemories = demoMemories.filter((memory) => memory.status === "conflicted").length;

  return (
    <main className="min-h-svh bg-background">
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-5 px-6 py-6 lg:px-10">
        <section className="flex flex-col gap-3 border-b border-border pb-5 md:flex-row md:items-end md:justify-between">
          <div>
            <div className="mb-2 inline-flex items-center gap-2 rounded-full border border-border bg-card px-3 py-1 text-xs text-muted-foreground">
              <span className="size-2 rounded-full bg-emerald-500" />
              Daily briefing
            </div>
            <h1 className="product-page-title">
              Today&apos;s briefing
            </h1>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">
              {demoActions.length} actions need attention before today&apos;s launch and board prep.
            </p>
          </div>
          <button
            type="button"
            onClick={() => onOpenView("ask")}
            className="inline-flex h-10 w-fit items-center gap-2 rounded-xl border border-border bg-card px-4 text-sm font-medium shadow-sm hover:border-foreground/20"
          >
            <MessageSquareIcon className="size-4" />
            Ask Hermes
          </button>
        </section>

        <section className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_320px]">
          <article className="rounded-2xl border border-border bg-card p-4 shadow-sm">
            <div className="flex items-start justify-between gap-4">
              <div>
                <div className="mb-3 flex items-center gap-2 text-sm font-medium text-muted-foreground">
                  <InboxIcon className="size-4" />
                  Top action
                </div>
                <h2 className="text-xl font-semibold tracking-tight">{topAction.title}</h2>
                <p className="mt-3 max-w-2xl text-sm leading-6 text-muted-foreground">
                  {topAction.description}
                </p>
              </div>
              <span className="rounded-full border border-hermes/30 bg-hermes/10 px-2.5 py-1 text-xs font-medium text-hermes">
                pending approval
              </span>
            </div>

            <div className="mt-4 grid gap-3 rounded-xl border border-border bg-background p-3 text-sm md:grid-cols-3">
              <Fact label="Evidence" value={`${topAction.evidence.length} sources`} />
              <Fact label="Impact" value={topAction.priority} />
              <Fact label="Approved" value={`${completedCount}/${demoActions.length}`} />
            </div>

            <button
              type="button"
              onClick={() => onOpenView("actions")}
              className="mt-5 inline-flex h-10 items-center gap-2 rounded-xl bg-primary px-4 text-sm font-medium text-primary-foreground"
            >
              Open review
              <ArrowRightIcon className="size-4" />
            </button>
          </article>

          <aside className="grid gap-5">
            <article className="rounded-2xl border border-border bg-card p-4 shadow-sm">
              <div className="mb-3 flex items-center gap-2 text-sm font-medium text-muted-foreground">
                <CalendarDaysIcon className="size-4" />
                Next meeting
              </div>
              <h2 className="text-xl font-semibold tracking-tight">{nextMeeting.title}</h2>
              <p className="mt-2 text-sm leading-6 text-muted-foreground">
                {nextMeeting.time} / prepared
              </p>
              <button
                type="button"
                onClick={() => onOpenView("meetings")}
                className="mt-4 inline-flex h-9 items-center gap-2 rounded-lg border border-border px-3 text-sm font-medium"
              >
                Open prep
                <ArrowRightIcon className="size-4" />
              </button>
            </article>

            <article className="rounded-2xl border border-border bg-card p-4 shadow-sm">
              <div className="mb-3 flex items-center gap-2 text-sm font-medium text-muted-foreground">
                <CheckCircle2Icon className="size-4" />
                Source coverage
              </div>
              <p className="text-sm text-muted-foreground">
                {demoIntegrations.length} demo systems provide sample signals for this workspace.
              </p>
            </article>

            <article className="rounded-2xl border border-border bg-card p-4 shadow-sm">
              <div className="mb-3 flex items-center gap-2 text-sm font-medium text-muted-foreground">
                <BrainIcon className="size-4" />
                Company memory
              </div>
              <h2 className="text-xl font-semibold tracking-tight">
                {memoryUpdateCount || demoMemories.length} memories in play
              </h2>
              <p className="mt-2 text-sm leading-6 text-muted-foreground">
                Decisions, commitments, risks, and ownership stay tied to evidence.
                {conflictedMemories ? ` ${conflictedMemories} conflict needs review.` : ""}
              </p>
              <button
                type="button"
                onClick={() => onOpenView("memory")}
                className="mt-4 inline-flex h-9 items-center gap-2 rounded-lg border border-border px-3 text-sm font-medium"
              >
                Open memory
                <ArrowRightIcon className="size-4" />
              </button>
            </article>
          </aside>
        </section>

        <section className="rounded-2xl border border-border bg-card p-4 shadow-sm">
          <div className="mb-4 flex items-center justify-between">
            <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
              <InboxIcon className="size-4" />
              Inbox preview
            </div>
            <button type="button" onClick={() => onOpenView("actions")} className="text-sm font-medium">
              View all
            </button>
          </div>
          <div className="divide-y divide-border rounded-2xl border border-border">
            {demoActions.slice(0, 3).map((action) => (
              <button
                key={action.id}
                type="button"
                onClick={() => onOpenView("actions")}
                className="grid w-full gap-2 px-4 py-3 text-left transition-colors hover:bg-muted/60 md:grid-cols-[minmax(0,1fr)_160px]"
              >
                <div className="min-w-0">
                  <div className="truncate text-sm font-medium">{action.title}</div>
                  <div className="mt-1 truncate text-sm text-muted-foreground">
                    {action.description}
                  </div>
                </div>
                <div className="text-sm text-muted-foreground md:text-right">
                  pending approval
                </div>
              </button>
            ))}
          </div>
        </section>
      </div>
    </main>
  );
}

function ActionsView({
  selectedId,
  actionStates,
  onSelect,
  onRunAction,
}: {
  selectedId: string;
  actionStates: Record<string, DemoActionStatus>;
  onSelect: (id: string) => void;
  onRunAction: (id: string, doneLabel: string) => void;
}) {
  const [tab, setTab] = useState<ActionTab>("summary");
  const selected = demoActions.find((action) => action.id === selectedId) ?? demoActions[0];
  const status = actionStates[selected.id] ?? "idle";
  const linkedMemory = demoMemories.find((memory) => memory.id === memoryIdForSource(selected.id));

  useEffect(() => setTab("summary"), [selected.id]);

  return (
    <main className="min-h-svh bg-background text-foreground">
      <section className="px-6 py-5 lg:px-10">
        <div className="mx-auto flex max-w-5xl flex-col gap-4 border-b border-border pb-5 md:flex-row md:items-end md:justify-between">
          <div className="max-w-3xl">
            <div className="mb-2 inline-flex items-center gap-2 rounded-full border border-border bg-card px-3 py-1 text-xs text-muted-foreground">
              <ShieldCheckIcon className="size-3" />
              approval desk
            </div>
            <h1 className="product-page-title">
              Approval desk
            </h1>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">
              Review work Hermes prepared, inspect the evidence, edit the draft, and decide what is allowed to happen outside Hermes.
            </p>
          </div>

          <button
            type="button"
            className="inline-flex h-9 items-center gap-2 rounded-lg border border-border bg-background px-3 text-xs font-medium text-muted-foreground"
          >
            <RefreshCwIcon className="size-3.5" />
            refresh
          </button>
        </div>
      </section>

      <section className="mx-auto grid min-h-[calc(100svh-150px)] max-w-[min(1480px,calc(100vw-2rem))] grid-cols-1 border border-border bg-card lg:grid-cols-[390px_minmax(0,1fr)]">
        <aside className="border-b border-border lg:border-b-0 lg:border-r">
          <div className="border-b border-border/70 p-3">
            <div className="mb-2 flex items-center gap-2 text-xs font-medium text-muted-foreground">
              <SlidersHorizontalIcon className="size-3.5" />
              Review list
            </div>
            <div className="flex flex-wrap gap-2">
              {["All", "Drafted", "Approved"].map((filter, index) => (
                <button
                  key={filter}
                  type="button"
                  className={`rounded-full border px-2.5 py-1 text-[11px] transition-colors ${
                    index === 0
                      ? "border-foreground bg-foreground text-background"
                      : "border-border bg-card text-muted-foreground hover:text-foreground"
                  }`}
                >
                  {filter}
                </button>
              ))}
            </div>
          </div>

          <div className="divide-y divide-border">
            {demoActions.map((action) => {
              const itemStatus = actionStates[action.id] ?? "idle";
              return (
                <button
                  key={action.id}
                  type="button"
                  onClick={() => onSelect(action.id)}
                  className={`block w-full px-4 py-4 text-left transition-colors ${
                    selected.id === action.id ? "bg-hermes/10" : "hover:bg-card/70"
                  }`}
                >
                  <div className="mb-2 flex items-start justify-between gap-3">
                    <h2 className="line-clamp-2 text-sm font-semibold">{action.title}</h2>
                    <StatusPill status={itemStatus === "done" ? "approved" : "pending_approval"} />
                  </div>
                  <p className="line-clamp-2 text-xs leading-5 text-muted-foreground">
                    {action.description}
                  </p>
                  <div className="mt-3 flex items-center justify-between text-[11px] text-muted-foreground">
                    <span>{action.source}</span>
                    <span>{action.priority}</span>
                  </div>
                </button>
              );
            })}
          </div>
        </aside>

        <section className="min-w-0">
          <div className="min-h-full min-w-0">
            <div className="sticky top-0 z-10 border-b border-border bg-card/95 px-5 py-3 backdrop-blur md:px-6">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-2">
                  <StatusPill status={status === "done" ? "approved" : "pending_approval"} />
                  <span className="text-xs text-muted-foreground">
                    {selected.source} / now
                  </span>
                </div>
                <div className="flex flex-wrap gap-2">
                  <ActionButton
                    icon={<CheckIcon className="size-3.5" />}
                    label="Approve"
                    busy={status === "loading"}
                    disabled={status !== "idle"}
                    onClick={() => onRunAction(selected.id, selected.doneLabel)}
                  />
                  <ActionButton icon={<XIcon className="size-3.5" />} label="Reject" disabled={status !== "idle"} />
                  <ActionButton icon={<Clock3Icon className="size-3.5" />} label="Snooze" disabled={status !== "idle"} />
                  <ActionButton icon={<UserPlusIcon className="size-3.5" />} label="Delegate" disabled={status !== "idle"} />
                </div>
              </div>
            </div>

            <div className="p-5 md:p-6">
              <div className="mb-5">
                <h2 className="product-detail-title max-w-4xl">
                  {selected.title}
                </h2>
                <p className="mt-3 max-w-3xl text-sm leading-6 text-muted-foreground">
                  {selected.description}
                </p>
              </div>

              <div className="grid gap-3 md:grid-cols-4">
                <Metric label="kind" value={selected.department} />
                <Metric label="impact" value={selected.priority} />
                <Metric label="risk" value={selected.priority === "Critical" ? "High" : "Medium"} />
                <Metric label="confidence" value="91%" />
              </div>

              <div className="mt-5 flex flex-wrap gap-1 border-b border-border">
                <TabButton active={tab === "summary"} icon={<ListChecksIcon className="size-3.5" />} label="Summary" onClick={() => setTab("summary")} />
                <TabButton active={tab === "draft"} icon={<SendIcon className="size-3.5" />} label="Draft" onClick={() => setTab("draft")} />
                <TabButton active={tab === "evidence"} icon={<FileTextIcon className="size-3.5" />} label="Evidence" onClick={() => setTab("evidence")} />
                <TabButton active={tab === "history"} icon={<HistoryIcon className="size-3.5" />} label="History" onClick={() => setTab("history")} />
              </div>

              {tab === "summary" ? (
                <section className="mt-4 border border-border bg-background/65 p-4">
                  <div className="mb-2 text-xs font-medium text-muted-foreground">
                    Why Hermes surfaced this
                  </div>
                  <p className="text-sm leading-6">{selected.description}</p>
                  <div className="mt-4 grid gap-3 md:grid-cols-2">
                    <SummaryRow label="Proposed work" value={selected.title} />
                    <SummaryRow label="Approval" value="Required before sending" />
                    <SummaryRow label="Owner" value={selected.owner} />
                    <SummaryRow label="Source" value={selected.source} />
                  </div>
                  {linkedMemory ? (
                    <div className="mt-4 rounded-xl border border-hermes/30 bg-hermes/5 p-3">
                      <div className="mb-2 flex items-center gap-2 text-xs font-medium text-hermes">
                        <BrainIcon className="size-3.5" />
                        Memory that will update
                      </div>
                      <div className="text-sm font-medium">{linkedMemory.title}</div>
                      <p className="mt-1 text-xs leading-5 text-muted-foreground">
                        {linkedMemory.summary}
                      </p>
                    </div>
                  ) : null}
                </section>
              ) : null}

              {tab === "draft" ? (
                <section className="mt-4 border border-border bg-background/65">
                  <div className="border-b border-border px-4 py-3">
                    <div className="flex items-center gap-2 text-xs font-medium text-muted-foreground">
                      <SendIcon className="size-3.5" />
                      Draft to review
                    </div>
                  </div>
                  <textarea
                    value={`${selected.cta}: ${selected.description}\n\nEvidence: ${selected.evidence.join(", ")}.`}
                    readOnly
                    className="min-h-64 w-full resize-y bg-transparent p-4 text-sm leading-6 outline-none"
                    spellCheck={false}
                  />
                  <div className="border-t border-border px-4 py-3">
                    <button type="button" className="inline-flex h-9 items-center gap-2 rounded-lg bg-foreground px-3 text-xs font-medium text-background">
                      <FileClockIcon className="size-3.5" />
                      Save draft
                    </button>
                  </div>
                </section>
              ) : null}

              {tab === "evidence" ? (
                <section className="mt-4 border border-border bg-background/65 p-4">
                  <div className="mb-3 text-xs font-medium text-muted-foreground">Evidence</div>
                  <div className="mt-4 flex flex-wrap gap-2">
                    {selected.evidence.map((source, index) => (
                      <span
                        key={source}
                        className="rounded-lg border border-border bg-card px-2.5 py-1.5 font-mono text-[11px] text-muted-foreground"
                      >
                        Evidence source {index + 1}: {source}
                      </span>
                    ))}
                  </div>
                </section>
              ) : null}

              {tab === "history" ? (
                <section className="mt-4 border border-border bg-background/65 p-4">
                  <div className="mb-4 text-xs font-medium text-muted-foreground">Review history</div>
                  <div className="space-y-3">
                    {["detected from source sync", "draft prepared by Hermes", status === "done" ? "approved in demo" : "waiting for approval"].map((event) => (
                      <div key={event} className="border-l border-hermes/50 pl-3">
                        <div className="text-xs font-medium">{event}</div>
                        <div className="mt-1 text-[11px] text-muted-foreground">Today</div>
                      </div>
                    ))}
                  </div>
                </section>
              ) : null}
            </div>
          </div>
        </section>
      </section>
    </main>
  );
}

function MeetingsView({
  selectedId,
  prepareState,
  onPrepare,
  onSelect,
}: {
  selectedId: string;
  prepareState: DemoActionStatus;
  onPrepare: () => void;
  onSelect: (id: string) => void;
}) {
  const meeting = demoMeetings.find((item) => item.id === selectedId) ?? demoMeetings[0];
  const linkedMemories = demoMemories.filter((memory) =>
    memory.relatedMeetings.includes(meeting.title),
  );

  return (
    <div className="min-h-svh overflow-x-hidden bg-background text-foreground">
      <header className="px-6 py-5 lg:px-10">
        <div className="mx-auto flex w-full max-w-5xl min-w-0 flex-col gap-4 border-b border-border pb-5 md:flex-row md:items-end md:justify-between">
          <div className="min-w-0">
            <div className="mb-4 flex flex-wrap items-center gap-2">
              <span className="inline-flex h-7 items-center gap-2 rounded-full border border-border bg-card px-3 text-xs font-medium text-muted-foreground">
                <CalendarClockIcon className="size-3.5 text-hermes" />
                Meeting intelligence
              </span>
            </div>
            <h1 className="product-page-title">
              Meetings
            </h1>
            <p className="mt-3 max-w-[23rem] break-words text-sm leading-6 text-muted-foreground sm:max-w-3xl">
              Upcoming meetings prepared with source-backed context, agenda notes, risks, and follow-ups.
            </p>
          </div>

          <div className="flex flex-wrap gap-2">
            <button type="button" className="inline-flex h-9 items-center gap-2 rounded-lg border border-border bg-background px-3 text-xs font-medium text-muted-foreground">
              <RefreshCwIcon className="size-3.5" />
              Refresh
            </button>
            <button type="button" className="inline-flex h-9 items-center gap-2 rounded-lg bg-primary px-3 text-xs font-medium text-primary-foreground">
              <CalendarClockIcon className="size-3.5" />
              Sync Google
            </button>
            <button type="button" className="inline-flex h-9 items-center gap-2 rounded-lg bg-hermes px-3 text-xs font-medium text-hermes-foreground">
              <CalendarClockIcon className="size-3.5" />
              Sync Outlook
            </button>
          </div>
        </div>
      </header>

      <main className="mx-auto w-full max-w-[min(1480px,calc(100vw-2rem))] px-6 pb-6 lg:px-10">
        <div className="grid gap-4 lg:grid-cols-[360px_minmax(0,1fr)]">
          <section className="border border-border bg-card">
            <div className="flex items-center justify-between border-b border-border/70 px-4 py-3">
              <div className="flex items-center gap-2 text-xs uppercase text-muted-foreground">
                <CalendarClockIcon className="size-3.5 text-hermes" />
                Upcoming meetings
              </div>
              <span className="text-[11px] text-muted-foreground">{demoMeetings.length}</span>
            </div>

            <div className="grid gap-2 p-3">
              {demoMeetings.map((item) => {
                const active = selectedId === item.id;
                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => onSelect(item.id)}
                    className={`min-w-0 rounded-xl border px-3 py-3 text-left transition-colors ${
                      active
                        ? "border-hermes/70 bg-hermes/10"
                        : "border-border/70 bg-background/35 hover:border-hermes/40"
                    }`}
                  >
                    <div className="mb-3 flex items-start justify-between gap-3">
                      <h2 className="line-clamp-2 text-sm font-medium leading-5">{item.title}</h2>
                      <PrepPill status="prepared" />
                    </div>
                    <div className="flex flex-wrap gap-x-4 gap-y-2 text-xs text-muted-foreground">
                      <span>{item.time}</span>
                      <span>{item.people.length} attendees</span>
                    </div>
                  </button>
                );
              })}
            </div>
          </section>

          <section className="space-y-5">
            <div className="border border-border bg-card">
              <div className="grid gap-5 p-5 lg:grid-cols-[minmax(0,1fr)_240px]">
                <div className="min-w-0">
                  <div className="mb-4 flex flex-wrap items-center gap-2">
                    <PrepPill status="prepared" />
                    <span className="inline-flex h-7 items-center border border-border/70 bg-background/45 px-2.5 text-[11px] text-muted-foreground">
                      Today
                    </span>
                    <span className="inline-flex h-7 items-center border border-border/70 bg-background/45 px-2.5 text-[11px] text-muted-foreground">
                      {meeting.time}
                    </span>
                  </div>

                  <h2 className="product-detail-title max-w-4xl">
                    {meeting.title}
                  </h2>

                  <div className="mt-6 flex flex-wrap gap-2">
                    <button
                      type="button"
                      onClick={onPrepare}
                      disabled={prepareState !== "idle"}
                      className="inline-flex h-10 items-center gap-2 bg-hermes px-3 text-xs font-medium text-hermes-foreground transition-opacity disabled:opacity-60"
                    >
                      {prepareState === "loading" ? (
                        <Loader2Icon className="size-3.5 animate-spin" />
                      ) : (
                        <SparklesIcon className="size-3.5" />
                      )}
                      {prepareState === "done" ? "Prep refreshed" : "Prepare brief"}
                    </button>
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-2 lg:grid-cols-1">
                  <Metric label="Attendees" value={`${meeting.people.length}`} />
                  <Metric label="Sources" value={`${meeting.sources.length}`} />
                  <Metric label="Prepared" value="16m ago" />
                </div>
              </div>
            </div>

            <div className="grid gap-5 xl:grid-cols-[minmax(0,1.35fr)_minmax(360px,0.65fr)]">
              <section className="border border-border/70 bg-card/40 p-5">
                <div className="mb-3 flex items-center gap-2 text-xs uppercase text-muted-foreground">
                  <FileTextIcon className="size-3.5 text-hermes" />
                  Calendar details
                </div>
                <p className="max-w-5xl whitespace-pre-wrap text-sm leading-7 text-muted-foreground">
                  {meeting.context}
                </p>
              </section>
              <section className="border border-border/70 bg-card/40 p-5">
                <div className="mb-3 flex items-center gap-2 text-xs uppercase text-muted-foreground">
                  <UsersIcon className="size-3.5 text-hermes" />
                  People
                </div>
                <div className="flex flex-wrap gap-2">
                  {meeting.people.map((person) => (
                    <span key={person} className="max-w-full truncate border border-border/70 bg-background/45 px-2.5 py-1.5 text-xs text-muted-foreground">
                      {person}
                    </span>
                  ))}
                </div>
              </section>
            </div>

            <section className="space-y-5">
              <div className="border border-border/70 bg-card/55 p-5 xl:p-7">
                <div className="mb-4 flex items-center gap-2 text-xs uppercase text-muted-foreground">
                  <CheckCircle2Icon className="size-3.5 text-hermes" />
                  Prep brief
                </div>
                <p className="max-w-5xl text-base leading-8 text-foreground/90">
                  {meeting.context}
                </p>
              </div>
              <div className="grid gap-5 xl:grid-cols-2">
                <ListPanel title="Agenda" items={meeting.agenda} />
                <ListPanel title="Risks" items={meeting.risks} />
              </div>
              <section className="border border-border/70 bg-card/45 p-5 xl:p-6">
                <div className="mb-5 flex items-center gap-2 text-xs uppercase text-muted-foreground">
                  <BrainIcon className="size-3.5 text-hermes" />
                  Memory brought into this meeting
                </div>
                <div className="grid gap-3 md:grid-cols-2">
                  {linkedMemories.map((memory) => (
                    <div key={memory.id} className="rounded-xl border border-border bg-background/55 p-3">
                      <div className="mb-2 flex items-center justify-between gap-2">
                        <span className="text-xs font-medium text-muted-foreground">
                          {memory.category}
                        </span>
                        <MemoryStatusPill status={memory.status} />
                      </div>
                      <div className="text-sm font-medium">{memory.title}</div>
                      <p className="mt-2 line-clamp-3 text-xs leading-5 text-muted-foreground">
                        {memory.summary}
                      </p>
                    </div>
                  ))}
                </div>
              </section>
            </section>
          </section>
        </div>
      </main>
    </div>
  );
}

function SourcesView() {
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState("Slack");
  const filtered = demoIntegrations.filter((connection) =>
    `${connection.name} ${connection.category}`.toLowerCase().includes(query.toLowerCase()),
  );
  const connected = demoIntegrations.filter((item) => item.status !== "Ready").length;
  const issues = demoIntegrations.filter((item) => item.status === "Ready").length;

  return (
    <main className="min-h-svh bg-background">
      <div className="mx-auto flex w-full max-w-5xl flex-col gap-5 px-6 py-6 lg:px-10">
        <section className="flex flex-col gap-5 md:flex-row md:items-end md:justify-between">
          <div>
            <h1 className="product-page-title">
              Sources
            </h1>
            <p className="mt-3 max-w-2xl text-sm leading-6 text-muted-foreground">
              Manage the apps Hermes can use to prepare briefs, actions, and source-backed answers. Connected apps stay user-owned and writes remain approval-gated.
            </p>
          </div>

          <button type="button" className="inline-flex h-10 w-fit items-center gap-2 rounded-xl border border-border bg-card px-3 text-sm font-medium shadow-sm">
            <RefreshCwIcon className="size-4" />
            Refresh
          </button>
        </section>

        <section className="overflow-hidden rounded-2xl border border-border bg-card shadow-sm">
          <div className="flex flex-col gap-3 border-b border-border p-4 md:flex-row md:items-center md:justify-between">
            <div>
              <h2 className="product-card-title">
                Enabled apps
                <span className="ml-2 text-sm font-normal text-muted-foreground">
                  {connected}/{demoIntegrations.length} / {issues} need attention
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
                key={connection.name}
                connection={connection}
                open={open === connection.name}
                onToggle={() => setOpen((current) => current === connection.name ? "" : connection.name)}
              />
            ))}
          </div>
        </section>
      </div>
    </main>
  );
}

function IntegrationRow({
  connection,
  open,
  onToggle,
}: {
  connection: DemoIntegration;
  open: boolean;
  onToggle: () => void;
}) {
  const attention = connection.status === "Ready";
  return (
    <article>
      <button
        type="button"
        onClick={onToggle}
        className="flex w-full items-center gap-4 px-4 py-4 text-left transition-colors hover:bg-muted/50"
      >
        <div className="grid size-11 shrink-0 place-items-center overflow-hidden rounded-full bg-muted text-sm font-semibold">
          <img
            src={`https://thesvg.org/icons/${iconSlugs[connection.name] ?? "app-store"}/default.svg`}
            alt=""
            className="size-5 object-contain"
            loading="lazy"
          />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex min-w-0 flex-wrap items-center gap-2">
            <h3 className="truncate text-base font-semibold">{connection.name}</h3>
            <StatusLabel connected={!attention} attention={attention} />
          </div>
          <p className="mt-1 line-clamp-1 text-sm text-muted-foreground">
            {descriptions[connection.name] ?? `${connection.category} source for demo workspace context.`}
          </p>
        </div>
        <ChevronRightIcon className={`size-5 shrink-0 text-muted-foreground transition-transform ${open ? "rotate-90" : ""}`} />
      </button>

      {open ? (
        <div className="border-t border-border bg-background/60 px-4 py-4">
          <div className="ml-[60px] grid gap-4 md:grid-cols-[minmax(0,1fr)_auto]">
            <div className="grid gap-2 text-sm text-muted-foreground sm:grid-cols-3">
              <Fact label="Category" value={connection.category} />
              <Fact label="Last sync" value={connection.status === "Ready" ? "Needs auth" : "Today"} />
              <Fact label="Access" value={`${connection.signals} sample signals`} />
            </div>
            <div className="flex flex-wrap gap-2 md:justify-end">
              <button type="button" className="inline-flex h-9 items-center gap-2 rounded-lg bg-primary px-3 text-sm font-medium text-primary-foreground">
                <ArrowRightIcon className="size-4" />
                {attention ? "Connect" : "Reconnect"}
              </button>
              <button type="button" className="inline-flex h-9 items-center gap-2 rounded-lg border border-border bg-card px-3 text-sm font-medium">
                <RefreshCwIcon className="size-4" />
                Sync
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </article>
  );
}

function MemoryView({
  selectedId,
  memoryEvents,
  onSelect,
  onOpenView,
}: {
  selectedId: string;
  memoryEvents: Record<string, DemoActionStatus>;
  onSelect: (id: string) => void;
  onOpenView: (view: DemoView) => void;
}) {
  const [filter, setFilter] = useState<"all" | DemoMemory["category"] | DemoMemoryStatus>("all");
  const selected = demoMemories.find((memory) => memory.id === selectedId) ?? demoMemories[0];
  const updatedCount = Object.values(memoryEvents).filter((state) => state === "done").length;
  const confirmedCount = demoMemories.filter((memory) => memory.status === "confirmed").length;
  const conflictCount = demoMemories.filter((memory) => memory.status === "conflicted").length;
  const filterOptions = [
    "all",
    "Decision",
    "Commitment",
    "Risk",
    "Workflow",
    "conflicted",
  ] as const;
  const filtered = demoMemories.filter((memory) => {
    if (filter === "all") return true;
    return memory.category === filter || memory.status === filter;
  });

  return (
    <main className="min-h-svh bg-background text-foreground">
      <section className="px-6 py-5 lg:px-10">
        <div className="mx-auto flex max-w-[min(1480px,calc(100vw-2rem))] flex-col gap-4 border-b border-border pb-5 md:flex-row md:items-end md:justify-between">
          <div className="max-w-3xl">
            <div className="mb-2 inline-flex items-center gap-2 rounded-full border border-border bg-card px-3 py-1 text-xs text-muted-foreground">
              <BrainIcon className="size-3.5 text-hermes" />
              Company memory
            </div>
            <h1 className="product-page-title">Memory</h1>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">
              Decisions, commitments, risks, people, and workflows stay current,
              source-backed, and visible before Hermes acts.
            </p>
          </div>

          <div className="grid w-full grid-cols-3 gap-2 text-sm md:w-auto">
            <MemoryStat label="confirmed" value={`${confirmedCount}`} tone="good" />
            <MemoryStat label="conflicts" value={`${conflictCount}`} tone="warn" />
            <MemoryStat label="updated" value={`${updatedCount}`} tone="brand" />
          </div>
        </div>
      </section>

      <section className="mx-auto grid min-h-[calc(100svh-150px)] max-w-[min(1480px,calc(100vw-2rem))] grid-cols-1 overflow-hidden rounded-2xl border border-border bg-card shadow-sm lg:grid-cols-[390px_minmax(0,1fr)]">
        <aside className="border-b border-border lg:border-b-0 lg:border-r">
          <div className="border-b border-border/70 bg-background/35 p-3">
            <div className="mb-2 flex items-center justify-between gap-3">
              <div className="flex items-center gap-2 text-xs font-medium text-muted-foreground">
                <SlidersHorizontalIcon className="size-3.5" />
                Memory ledger
              </div>
              <span className="text-[11px] text-muted-foreground">{filtered.length} shown</span>
            </div>
            <div className="flex flex-wrap gap-2">
              {filterOptions.map((option) => (
                <button
                  key={option}
                  type="button"
                  onClick={() => setFilter(option)}
                  className={`rounded-full border px-2.5 py-1 text-[11px] transition-colors ${
                    filter === option
                      ? "border-foreground bg-foreground text-background"
                      : "border-border bg-card text-muted-foreground hover:text-foreground"
                  }`}
                >
                  {option === "all" ? "All" : option}
                </button>
              ))}
            </div>
          </div>

          <div className="divide-y divide-border">
            {filtered.map((memory) => {
              const active = selected.id === memory.id;
              const updated = memoryEvents[memory.id] === "done";
              return (
                <button
                  key={memory.id}
                  type="button"
                  onClick={() => onSelect(memory.id)}
                  className={`relative block w-full px-4 py-4 text-left transition-colors ${
                    active ? "bg-hermes/10" : "hover:bg-muted/35"
                  }`}
                >
                  {active ? (
                    <span className="absolute inset-y-3 left-0 w-1 rounded-r-full bg-hermes" />
                  ) : null}
                  <div className="mb-2 flex items-start justify-between gap-3">
                    <h2 className="line-clamp-2 text-sm font-semibold">{memory.title}</h2>
                    <MemoryStatusPill status={memory.status} />
                  </div>
                  <p className="line-clamp-2 text-xs leading-5 text-muted-foreground">
                    {memory.summary}
                  </p>
                  <div className="mt-3 flex items-center justify-between gap-3 text-[11px] text-muted-foreground">
                    <span>{memory.category}</span>
                    <span>{updated ? "updated in demo" : memory.lastSeen}</span>
                  </div>
                </button>
              );
            })}
          </div>
        </aside>

        <section className="min-w-0">
          <div className="sticky top-0 z-10 border-b border-border bg-card/95 px-5 py-3 backdrop-blur md:px-6">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <MemoryStatusPill status={selected.status} />
                <span className="text-xs text-muted-foreground">
                  {selected.category} / {selected.lastSeen}
                </span>
              </div>
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => onOpenView("actions")}
                  className="inline-flex h-9 items-center gap-2 rounded-lg border border-border bg-background px-3 text-xs transition-colors hover:border-hermes/60 hover:text-hermes"
                >
                  <InboxIcon className="size-3.5" />
                  Related actions
                </button>
                <button
                  type="button"
                  onClick={() => onOpenView("ask")}
                  className="inline-flex h-9 items-center gap-2 rounded-lg border border-border bg-background px-3 text-xs transition-colors hover:border-hermes/60 hover:text-hermes"
                >
                  <MessageSquareIcon className="size-3.5" />
                  Ask from memory
                </button>
              </div>
            </div>
          </div>

          <div className="p-5 md:p-6">
            <section className="rounded-2xl border border-border bg-background/55 p-4 md:p-5">
              <div className="mb-3 flex flex-wrap items-center gap-2">
                <span className="inline-flex h-7 items-center gap-2 rounded-full border border-border bg-card px-2.5 text-[11px] font-medium text-muted-foreground">
                  <BrainIcon className="size-3.5 text-hermes" />
                  Current truth
                </span>
                <span className="text-xs text-muted-foreground">
                  verified from {selected.sources.length} sources
                </span>
              </div>
              <h2 className="product-detail-title max-w-4xl">{selected.title}</h2>
              <p className="mt-3 max-w-3xl text-sm leading-6 text-muted-foreground">
                {selected.summary}
              </p>
            </section>

            <div className="mt-5 grid gap-3 md:grid-cols-4">
              <MemoryMetric label="owner" value={selected.owner} />
              <MemoryMetric label="confidence" value={`${selected.confidence}%`} />
              <MemoryMetric label="valid from" value={selected.validFrom} />
              <MemoryMetric label="valid until" value={selected.validUntil ?? "Current"} />
            </div>

            {selected.status === "conflicted" ? (
              <section className="mt-5 rounded-2xl border border-amber-300/60 bg-amber-100/40 p-4">
                <div className="mb-2 flex items-center gap-2 text-sm font-medium text-amber-800">
                  <AlertTriangleIcon className="size-4" />
                  Conflict visible before action
                </div>
                <p className="text-sm leading-6 text-amber-900/80">
                  Hermes does not silently overwrite this fact. It keeps the old
                  and new sources visible until a user confirms the current owner.
                </p>
              </section>
            ) : null}

            <div className="mt-5 grid gap-5 2xl:grid-cols-[minmax(0,1.25fr)_minmax(320px,0.75fr)]">
              <section className="rounded-2xl border border-border/70 bg-background/65 p-4">
                <div className="mb-4 flex items-center gap-2 text-xs uppercase text-muted-foreground">
                  <HistoryIcon className="size-3.5 text-hermes" />
                  Timeline
                </div>
                <div className="space-y-4">
                  {selected.timeline.map((item, index) => (
                    <div key={item} className="grid grid-cols-[28px_minmax(0,1fr)] gap-4 text-sm leading-7">
                      <span className="mt-0.5 grid size-6 place-items-center border border-border bg-card text-[10px] text-hermes">
                        {index + 1}
                      </span>
                      <p className="min-w-0 break-words text-muted-foreground">{item}</p>
                    </div>
                  ))}
                </div>
              </section>

              <aside className="space-y-5">
                <section className="rounded-2xl border border-border/70 bg-background/65 p-4">
                  <div className="mb-3 flex items-center gap-2 text-xs uppercase text-muted-foreground">
                    <FileTextIcon className="size-3.5 text-hermes" />
                    Source trail
                  </div>
                  <div className="space-y-2">
                    {selected.sources.map((source, index) => (
                      <div key={source} className="flex items-center gap-2 rounded-lg border border-border bg-card px-3 py-2 text-xs text-muted-foreground">
                        <span className="grid size-5 shrink-0 place-items-center rounded-full bg-hermes/10 text-[10px] text-hermes">
                          {index + 1}
                        </span>
                        {source}
                      </div>
                    ))}
                  </div>
                </section>

                <section className="rounded-2xl border border-border/70 bg-background/65 p-4">
                  <div className="mb-3 flex items-center gap-2 text-xs uppercase text-muted-foreground">
                    <ListChecksIcon className="size-3.5 text-hermes" />
                    Used by Hermes
                  </div>
                  <div className="space-y-4">
                    <MemoryRelation title="Actions" items={selected.relatedActions} />
                    <MemoryRelation title="Meetings" items={selected.relatedMeetings} />
                  </div>
                </section>
              </aside>
            </div>
          </div>
        </section>
      </section>
    </main>
  );
}

function MemoryRelation({ title, items }: { title: string; items: string[] }) {
  return (
    <div>
      <div className="text-[11px] font-medium text-muted-foreground">{title}</div>
      <div className="mt-2 space-y-2">
        {items.map((item) => (
          <div key={item} className="rounded-lg border border-border bg-card px-3 py-2 text-xs text-muted-foreground transition-colors hover:border-hermes/40 hover:text-foreground">
            {item}
          </div>
        ))}
      </div>
    </div>
  );
}

function MemoryStat({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone: "good" | "warn" | "brand";
}) {
  const dot =
    tone === "good"
      ? "bg-emerald-500"
      : tone === "warn"
        ? "bg-amber-500"
        : "bg-hermes";
  return (
    <div className="min-w-[96px] rounded-xl border border-border bg-card px-3 py-2 shadow-sm">
      <div className="flex items-center gap-2 text-[10px] uppercase text-muted-foreground">
        <span className={`size-1.5 rounded-full ${dot}`} />
        {label}
      </div>
      <div className="mt-1 text-xl font-semibold leading-none text-foreground">{value}</div>
    </div>
  );
}

function MemoryMetric({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0 rounded-xl border border-border/80 bg-card px-3 py-3">
      <div className="text-[10px] uppercase text-muted-foreground">{label}</div>
      <div className="mt-2 truncate text-sm font-semibold text-foreground">{value}</div>
    </div>
  );
}

function AskView({
  selectedPrompt,
  queryState,
  onRunPrompt,
}: {
  selectedPrompt: (typeof demoAskPrompts)[number] | null;
  queryState: DemoActionStatus;
  onRunPrompt: (id: string) => void;
}) {
  return (
    <div className="flex h-svh bg-background text-foreground font-sans">
      <aside className="hidden w-72 shrink-0 border-r border-border bg-card/55 md:flex md:flex-col">
        <div className="flex items-center justify-between border-b border-border px-4 py-3">
          <div className="text-sm font-semibold text-foreground">Sessions</div>
          <button className="inline-flex h-8 items-center gap-1 rounded-lg border border-border bg-background px-2.5 text-xs font-medium shadow-sm">
            + New
          </button>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto p-2">
          <div className="space-y-1">
            {sessions.map((session, index) => (
              <button
                key={session.title}
                type="button"
                className={`group flex w-full items-start gap-2 rounded-xl border px-3 py-3 text-left transition-colors hover:border-border hover:bg-background ${
                  index === 0 ? "border-border bg-background shadow-sm" : "border-transparent"
                }`}
              >
                <MessageSquareIcon className={`mt-0.5 size-4 shrink-0 ${index === 0 ? "text-hermes" : "text-muted-foreground"}`} />
                <span className="min-w-0 flex-1">
                  <span className="line-clamp-2 block text-sm font-medium leading-snug text-foreground">
                    {session.title}
                  </span>
                  <span className="mt-1 block text-xs text-muted-foreground">{session.meta}</span>
                </span>
              </button>
            ))}
          </div>
        </div>
      </aside>

      <main className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-40 border-b border-border bg-card/80 backdrop-blur-sm">
          <div className="mx-auto flex h-12 max-w-5xl items-center justify-between gap-4 px-6 text-xs">
            <div className="flex items-center gap-2 text-sm leading-none tracking-tight">
              <span aria-hidden className="font-medium text-hermes">△</span>
              <span className="font-medium text-foreground">hermes</span>
              <span className="text-[11px] uppercase tracking-[0.12em] text-muted-foreground/80">
                v0.1
              </span>
            </div>
            <div className="hidden items-center gap-3 text-muted-foreground sm:flex">
              <span className={queryState === "loading" ? "text-hermes" : "text-muted-foreground"}>
                {queryState === "loading" ? "thinking" : "Ready"}
              </span>
              <span className="text-muted-foreground/30">/</span>
              <span className="tabular-nums text-muted-foreground">00:45</span>
            </div>
          </div>
        </header>

        <div className="relative flex-1 overflow-y-auto">
          <div className="mx-auto flex w-full max-w-4xl flex-col gap-8 px-6 py-6">
            {!selectedPrompt ? (
              <div className="mx-auto flex min-h-[30vh] max-w-3xl flex-col justify-end pb-4">
                <div className="border-b border-border pb-6">
                  <div className="mb-3 inline-flex items-center gap-2 rounded-full border border-border bg-card px-3 py-1 text-xs font-medium text-muted-foreground">
                    <MessageSquareIcon className="size-3.5 text-hermes" />
                    Ask Hermes
                  </div>
                  <h1 className="product-display-title text-foreground">
                    Ask across your workday.
                  </h1>
                  <p className="mt-3 max-w-xl text-sm leading-6 text-muted-foreground">
                    Ask about actions, meetings, decisions, and saved context. Hermes will use your connected sources and keep the answer tied to evidence.
                  </p>
                  <div className="mt-5 flex flex-wrap gap-2">
                    {demoAskPrompts.map((prompt) => (
                      <button
                        key={prompt.id}
                        type="button"
                        onClick={() => onRunPrompt(prompt.id)}
                        className="rounded-full border border-border bg-card px-3 py-1.5 text-left text-sm leading-5 text-foreground shadow-sm transition-colors hover:border-hermes/40 hover:bg-hermes/5"
                      >
                        {prompt.question}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            ) : (
              <div className="flex flex-col gap-8">
                <Turn role="you" text={selectedPrompt.question} />
                <div className="flex flex-col gap-2">
                  <div className="flex items-center gap-2 text-[10.5px] font-medium uppercase tracking-[0.18em] text-hermes">
                    <span aria-hidden>*</span>
                    <span>hermes</span>
                    {queryState === "loading" ? <span className="ml-1 text-[11px]">|</span> : null}
                  </div>
                  <div className="border-l-2 border-hermes/35 pl-5">
                    {queryState === "loading" ? (
                      <div className="flex items-center gap-3 text-sm text-muted-foreground">
                        <Loader2Icon className="size-4 animate-spin text-hermes" />
                        Reading Slack, email, CRM, finance, and project sources...
                      </div>
                    ) : (
                      <div className="max-w-none text-[13.5px] leading-[1.65] text-foreground">
                        <p>{selectedPrompt.answer}</p>
                        <div className="mt-4 rounded-xl border border-border bg-card p-4">
                          <div className="text-sm font-medium">Suggested actions</div>
                          <ul className="mt-3 space-y-2 text-sm text-muted-foreground">
                            {selectedPrompt.suggestedActions.map((item) => (
                              <li key={item}>{item}</li>
                            ))}
                          </ul>
                        </div>
                        <div className="mt-4 flex flex-wrap gap-2">
                          {selectedPrompt.sources.map((source) => (
                            <span key={source} className="rounded-full border border-border bg-muted px-3 py-1.5 text-xs text-muted-foreground">
                              {source}
                            </span>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>

        <form className="border-t border-border bg-background/95">
          <div className="mx-auto w-full max-w-3xl px-6 py-5">
            <div className="flex items-start gap-3 rounded-2xl border border-border bg-card px-4 py-3 shadow-sm">
              <span aria-hidden className="mt-[3px] shrink-0 select-none text-[13px] text-hermes">
                &gt;
              </span>
              <input
                readOnly
                value=""
                placeholder="Choose one of the prepared demo prompts above"
                className="min-h-[1.5rem] w-full bg-transparent text-sm leading-[1.6] text-foreground outline-none placeholder:text-muted-foreground"
              />
              <button
                type="button"
                className="inline-flex h-8 shrink-0 items-center gap-1.5 rounded-lg border border-border/70 px-3 text-xs font-medium text-muted-foreground/60"
              >
                {queryState === "loading" ? <SquareIcon className="size-2.5 fill-current" /> : "Send"}
                {queryState !== "loading" ? <ArrowRightIcon className="size-3" /> : null}
              </button>
            </div>
            <div className="mt-2 flex items-center gap-2 px-1 text-[11px] text-muted-foreground">
              <Kbd>demo</Kbd>
              <span>fixed prompts only</span>
            </div>
          </div>
        </form>
      </main>
    </div>
  );
}

function Turn({ role, text }: { role: "you" | "hermes"; text: string }) {
  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center gap-2 text-[10.5px] font-medium uppercase tracking-[0.18em] text-muted-foreground">
        <span aria-hidden>{role === "you" ? ">" : "*"}</span>
        <span>{role}</span>
      </div>
      <div className="pl-5 text-[13.5px] leading-[1.6] text-foreground">{text}</div>
    </div>
  );
}

function StatusPill({ status }: { status: string }) {
  const tone =
    status === "approved"
      ? "border-emerald-500/40 bg-emerald-500/10 text-emerald-700"
      : "border-hermes/50 bg-hermes/10 text-hermes";
  return (
    <span className={`shrink-0 border px-2 py-1 text-[10px] uppercase ${tone}`}>
      {status.replaceAll("_", " ")}
    </span>
  );
}

function MemoryStatusPill({ status }: { status: DemoMemoryStatus }) {
  const tone =
    status === "confirmed"
      ? "border-emerald-500/40 bg-emerald-500/10 text-emerald-700"
      : status === "candidate"
        ? "border-hermes/50 bg-hermes/10 text-hermes"
        : status === "conflicted"
          ? "border-amber-500/50 bg-amber-500/10 text-amber-700"
          : "border-border bg-muted text-muted-foreground";
  return (
    <span className={`shrink-0 border px-2 py-1 text-[10px] uppercase ${tone}`}>
      {status}
    </span>
  );
}

function PrepPill({ status }: { status: string }) {
  return (
    <span className="shrink-0 border border-emerald-500/40 bg-emerald-500/10 px-2 py-1 text-[10px] uppercase text-emerald-700">
      {status}
    </span>
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
  return <span className="rounded-full bg-muted px-2 py-0.5 text-xs font-medium text-muted-foreground">Not connected</span>;
}

function ActionButton({
  icon,
  label,
  busy = false,
  disabled = false,
  onClick,
}: {
  icon: React.ReactNode;
  label: string;
  busy?: boolean;
  disabled?: boolean;
  onClick?: () => void;
}) {
  return (
    <button
      type="button"
      disabled={busy || disabled}
      onClick={onClick}
      className="inline-flex h-9 items-center gap-2 border border-border bg-card px-3 text-xs transition-colors hover:border-hermes/60 hover:text-hermes disabled:opacity-50"
    >
      {busy ? <Loader2Icon className="size-3.5 animate-spin" /> : icon}
      {busy ? "working" : label}
    </button>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0 border border-border/70 bg-background/45 p-3">
      <div className="text-[10px] uppercase text-muted-foreground">{label}</div>
      <div className="mt-2 truncate text-sm font-medium">{value}</div>
    </div>
  );
}

function Fact({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className="mt-1 font-medium text-foreground">{value}</div>
    </div>
  );
}

function TabButton({
  active,
  icon,
  label,
  onClick,
}: {
  active: boolean;
  icon: React.ReactNode;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`-mb-px inline-flex h-10 items-center gap-2 border-b px-3 text-xs font-medium transition-colors ${
        active
          ? "border-foreground text-foreground"
          : "border-transparent text-muted-foreground hover:text-foreground"
      }`}
    >
      {icon}
      {label}
    </button>
  );
}

function SummaryRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-border bg-card px-3 py-2">
      <div className="text-[11px] text-muted-foreground">{label}</div>
      <div className="mt-1 text-sm font-medium">{value}</div>
    </div>
  );
}

function ListPanel({ title, items }: { title: string; items: string[] }) {
  return (
    <section className="border border-border/70 bg-card/45 p-5 xl:p-6">
      <div className="mb-5 text-xs uppercase text-muted-foreground">{title}</div>
      <div className="space-y-4">
        {items.map((item, index) => (
          <div key={item} className="grid grid-cols-[28px_minmax(0,1fr)] gap-4 text-sm leading-7 text-muted-foreground">
            <span className="mt-0.5 grid size-6 place-items-center border border-border bg-background/45 text-[10px] text-hermes">
              {index + 1}
            </span>
            <p className="min-w-0 break-words">{item}</p>
          </div>
        ))}
      </div>
    </section>
  );
}

function Kbd({ children }: { children: React.ReactNode }) {
  return (
    <kbd className="rounded-md border border-border bg-card px-1.5 py-0.5 font-mono text-[10px] leading-none text-foreground/80">
      {children}
    </kbd>
  );
}

function memoryIdForSource(sourceId: string) {
  const mapping: Record<string, string> = {
    "investor-prep": "investor-pack-style",
    "acme-renewal": "acme-commitment",
    "finance-approval": "invoice-blocker",
    "support-risk": "pricing-risk",
    "hiring-followup": "owner-conflict",
    "meeting-board-sync": "launch-decision",
    "meeting-sales-handoff": "acme-commitment",
    "meeting-marketing-launch": "invoice-blocker",
  };
  return mapping[sourceId];
}
