/* eslint-disable react-refresh/only-export-components -- Rule 7 shell: NAV + useBeat are exported alongside the shell for the palette and overview. */
import { Link, useNavigate, useRouterState } from "@tanstack/react-router";
import type { ReactNode } from "react";
import type { LucideIcon } from "lucide-react";
import {
  Activity,
  BookOpen,
  Cable,
  CalendarDays,
  ChartColumn,
  CircleHelp,
  CreditCard,
  Files,
  Globe,
  Inbox,
  KeyRound,
  LayoutDashboard,
  ListTree,
  Menu,
  PenLine,
  Rocket,
  Search,
  SlidersHorizontal,
  UserRound,
  Users,
  X,
  Bell,
  ChevronDown,
  Plus,
  ArchiveRestore,
  Settings2,
} from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { ThemePicker } from "@/components/theme-picker";
import { AREAS as AREAS_SOURCE, NAV_AREAS, PALETTE_ACTIONS as ACTIONS_SOURCE, SHELL_GROUPS as GROUPS_SOURCE } from "@/lib/areas";
import { THEMES, applyTheme } from "@/lib/themes";
import { create } from "zustand";
import { useApp, useHydrated, useVaultPhase } from "@/lib/store";
import { allowPersistWrites } from "@/lib/durable-storage";
import { UnlockGate } from "@/components/unlock-gate";
// Production overhaul: ModelStages was removed — the single sequential job
// runner inside engine.advance() now owns the intent/draft/revision model
// stages (one awaited flow per job), so no React interval fights the engine
// over `worker` leases and stage refs anymore.
import { LiveWriter } from "@/components/live-writer";
import { HumanizePipeline } from "@/components/humanize-pipeline";
import { DeskWorkers } from "@/components/desk-workers";
import { WorkspacesPage } from "@/components/pages/workspaces";
import { StudioMark } from "@/components/mark";
import { Button } from "@/components/ui";
import { cn, relTime } from "@/lib/utils";

/** Rule 7 / §1 — the 20 canonical route areas with their shell icons attached. */
const ICONS: Record<string, LucideIcon> = {
  Activity,
  BookOpen,
  Cable,
  CalendarDays,
  ChartColumn,
  CircleHelp,
  CreditCard,
  Files,
  Globe,
  Inbox,
  KeyRound,
  LayoutDashboard,
  ListTree,
  PenLine,
  Rocket,
  Settings2,
  SlidersHorizontal,
  UserRound,
  Users,
  ArchiveRestore,
};

export const AREAS = AREAS_SOURCE.map((area) => ({ ...area, Icon: ICONS[area.icon] ?? LayoutDashboard }));

export type AreaId = (typeof AREAS_SOURCE)[number]["id"];

export const SHELL_GROUPS = GROUPS_SOURCE;

const NAV = NAV_AREAS.map((area) => ({ ...area, Icon: ICONS[area.icon] ?? LayoutDashboard }));

/** Rule 7 quick actions in the Ctrl+K palette (beyond the 20 area jumps). */
export const PALETTE_ACTIONS = ACTIONS_SOURCE;

export const useBeat = create<{ at: number }>(() => ({ at: 0 }));

/** Mode matching that ignores punctuation and spacing (people type "midnight", not "Appearance · Midnight"). */
function normQuery(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
}

function active(href: string, path: string) {
  if (href === "/") return path === "/";
  return path === href || path.startsWith(`${href}/`);
}

export function AppShell({ children }: { children: ReactNode }) {
  const path = useRouterState({ select: (s) => s.location.pathname });
  const [open, setOpen] = useState(false);
  const [palette, setPalette] = useState(false);
  const [query, setQuery] = useState("");
  const [bell, setBell] = useState(false);
  const [workerPanel, setWorkerPanel] = useState(false);
  const [switcher, setSwitcher] = useState(false);
  const notice = useApp((s) => s.notice);
  const clearNotice = useApp((s) => s.clearNotice);
  const sites = useApp((s) => s.sites);
  const activeSiteId = useApp((s) => s.activeSiteId);
  const setSite = useApp((s) => s.setSite);
  const articles = useApp((s) => s.articles);
  const runs = useApp((s) => s.runs);
  const plans = useApp((s) => s.plans);
  const activity = useApp((s) => s.activity);
  const setSetup = useApp((s) => s.setSetup);
  const workerPaused = useApp((s) => s.workerPaused);
  const worker = useApp((s) => s.worker);
  const setWorker = useApp((s) => s.setWorker);
  const site = sites.find((item) => item.id === activeSiteId) ?? sites[0];
  const hydrated = useHydrated();
  const gate = useVaultPhase();
  const searchRef = useRef<HTMLInputElement>(null);
  const navigate = useNavigate();

  // Boolean worker-load selector: 1.5s tick cadence only while jobs or site
  // syncs are actually in flight; a slow 6s heartbeat otherwise so the badge
  // stays honest without a 400ms full-state polling storm.
  const beatBusy = useApp((s) =>
    Boolean(
      !s.workerPaused &&
        (s.jobs.some((item) => item.status === "queued" || item.status === "running") ||
          s.sites.some(
            (site) =>
              (site.ghost.corpus === "SYNCING" && site.ghost.syncReadyAt && site.ghost.syncReadyAt <= Date.now()) ||
              Boolean(site.pendingRebuildAt && site.pendingRebuildAt <= Date.now()),
          )),
    ),
  );

  useEffect(() => {
    useBeat.setState({ at: Date.now() });
    const pulse = window.setInterval(() => useBeat.setState({ at: Date.now() }), 3000);
    return () => window.clearInterval(pulse);
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    allowPersistWrites();
    useApp.getState().ensureAuthors();
    useApp.getState().tick();
    const cadence = beatBusy ? 1500 : 6000;
    const tick = window.setInterval(() => useApp.getState().tick(), cadence);
    return () => window.clearInterval(tick);
  }, [beatBusy, hydrated]);

  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        setPalette((openNow) => !openNow);
        setQuery("");
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  useEffect(() => {
    if (!notice) return;
    const t = window.setTimeout(() => clearNotice(), 4200);
    return () => window.clearTimeout(t);
  }, [notice, clearNotice]);

  useEffect(() => {
    setOpen(false);
    setQuery("");
    setSwitcher(false);
    setBell(false);
    setWorkerPanel(false);
  }, [path]);

  const commands = useMemo(() => {
    const rows = [
      ...PALETTE_ACTIONS.map((action) => ({ href: action.href, label: action.label, hint: action.hint, build: Boolean("build" in action && action.build) })),
      { href: "__setup", label: "Restart setup guide", hint: "Action", build: false },
    ];
    const q = query.trim().toLowerCase();
    if (!q) return rows;
    return rows.filter((row) => row.label.toLowerCase().includes(q));
  }, [query]);

  /** Rule 7: appearance switching straight from the palette — two modes, nothing else. */
  const modeCommands = useMemo(() => {
    const q = normQuery(query);
    return THEMES.filter((theme) => !q || normQuery(`theme ${theme.label}`).includes(q) || normQuery(`mode ${theme.label}`).includes(q)).map((theme) => ({ ...theme, label: `Appearance · ${theme.label}` }));
  }, [query]);

  const results = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (q.length < 2) return [];
    // Rule 7: every one of the 20 areas is jumpable by name, group, or id.
    const nav = AREAS.filter((area) => `${area.label} ${area.group} ${area.id}`.toLowerCase().includes(q)).map((area) => ({
      href: area.href,
      label: area.label,
      hint: area.group,
    }));
    const arts = articles
      .filter((article) => article.siteId === site?.id && `${article.title} ${article.keyword}`.toLowerCase().includes(q))
      .slice(0, 5)
      .map((article) => ({ href: `/articles/${article.id}`, label: article.title, hint: "Article" }));
    const runHits = runs
      .filter((run) => run.siteId === site?.id && run.title.toLowerCase().includes(q))
      .slice(0, 4)
      .map((run) => ({ href: `/runs/${run.id}`, label: run.title, hint: "Run" }));
    const planHits = plans
      .filter((plan) => plan.siteId === site?.id && plan.topic.toLowerCase().includes(q))
      .slice(0, 4)
      .map((plan) => ({ href: `/topic-plans/${plan.id}`, label: plan.topic, hint: "Topic plan" }));
    return [...nav, ...arts, ...runHits, ...planHits].slice(0, 8);
  }, [query, articles, runs, plans, site?.id]);

  if (gate !== "open") {
    return gate === "locked" ? <UnlockGate /> : <div className="grid min-h-screen place-items-center bg-bg text-sm text-muted">Opening the studio…</div>;
  }

  if (path.startsWith("/preview")) {
    return (
      <>
        <LiveWriter />
        <HumanizePipeline />
        <DeskWorkers />
        {children}
      </>
    );
  }

  return (
    <div className="flex min-h-screen bg-bg text-fg">
       <aside className="sticky top-0 hidden h-[100dvh] shrink-0 flex-col border-r border-line bg-surface/60 md:flex md:w-[var(--shell-rail)] xl:w-[var(--shell-panel)]">
        <Brand />
        <CreateButton />
        <SidebarNav path={path} />
        <p className="hidden px-4 py-3 text-[11px] leading-5 text-faint xl:block">Six stages · one desk</p>
      </aside>

      {open ? (
        <div className="fixed inset-0 z-40 md:hidden">
           <button className="absolute inset-0 bg-bg/70" aria-label="Close menu" onClick={() => setOpen(false)} />
            <div className="relative flex h-full w-[min(18rem,88vw)] flex-col border-r border-line bg-surface shadow-sm">
             <div className="flex items-center justify-between">
               <Brand full />
               <button className="mr-3 grid size-11 place-items-center text-muted" onClick={() => setOpen(false)} aria-label="Close">
                 <X className="size-5" />
               </button>
             </div>
             <div className="mx-3 mb-2 rounded-lg border border-line/60 bg-surface p-2">
               <div className="px-2 py-1 text-xs font-semibold uppercase tracking-wider text-faint">Workspace</div>
               <div className="max-h-36 overflow-y-auto">
                 {sites.map((item) => (
                   <button key={item.id} type="button" aria-current={item.id === site?.id ? "true" : undefined} className={cn("flex min-h-10 w-full items-center gap-2 rounded-md px-2 text-left text-sm hover:bg-surface-2", item.id === site?.id && "text-brass-2")} onClick={() => { setSite(item.id); setOpen(false); }}>
                     <span className={cn("size-2 shrink-0 rounded-full", ghostDot(item.ghost))} />
                     <span className="truncate">{item.name}</span>
                   </button>
                 ))}
               </div>
             </div>
              <SidebarNav path={path} onNavigate={() => setOpen(false)} />
          </div>
        </div>
      ) : null}

      <div className="flex min-w-0 flex-1 flex-col">
         <header data-shell-header className="sticky top-0 z-20 flex min-h-14 items-center gap-2 border-b border-line bg-bg/90 px-3 pt-[var(--safe-top)] backdrop-blur md:px-6">
          <button className="grid size-9 place-items-center rounded-md text-muted hover:bg-surface hover:text-fg md:hidden" onClick={() => setOpen(true)} aria-label="Open menu">
            <Menu className="size-5" />
          </button>
          <button
            type="button"
            onClick={() => {
              setPalette(true);
              setQuery("");
            }}
            className="flex min-h-9 min-w-0 flex-1 max-w-md items-center gap-2 rounded-md border border-line bg-surface px-2.5 text-left text-[13px] text-muted hover:border-line-strong hover:bg-surface-2/60"
          >
            <Search className="size-4 shrink-0" />
            <span className="truncate">Search or jump</span>
            <span className="num ml-auto hidden rounded-sm border border-line px-1.5 py-0.5 text-[11px] text-faint sm:inline">⌘K</span>
          </button>
           <div className="relative hidden sm:block">
            <button
              type="button"
              className="flex min-h-9 max-w-48 items-center gap-2 rounded-md px-2 text-[13px] text-muted hover:bg-surface hover:text-fg"
              aria-label="Workspace switcher"
              onClick={() => setSwitcher((value) => !value)}
            >
              <span className={cn("size-2 shrink-0 rounded-full", site ? ghostDot(site.ghost) : "bg-faint")} />
              <span className="truncate">{site?.name ?? "No workspace"}</span>
            </button>
            {switcher ? (
              <div className="absolute right-0 top-12 z-30 w-72 rounded-lg border border-line bg-elev p-2">
                <div className="px-2 py-1 font-mono text-xs uppercase tracking-widest text-faint">Website workspaces</div>
                {sites.map((item) => (
                  <button
                    key={item.id}
                    className="flex min-h-11 w-full items-center gap-2 rounded-lg px-2 text-left text-sm hover:bg-surface"
                    onClick={() => {
                      setSite(item.id);
                      setSwitcher(false);
                    }}
                  >
                    <span className={cn("size-2 rounded-full", ghostDot(item.ghost))} />
                    <span className="truncate">{item.name}</span>
                    {item.id === site?.id ? <span className="ml-auto text-xs text-brass">Active</span> : null}
                  </button>
                ))}
                <Link to="/workspaces" className="mt-1 flex min-h-11 items-center gap-2 rounded-lg px-2 text-sm text-brass hover:bg-surface" onClick={() => setSwitcher(false)}>
                  <Plus className="size-4" />
                  New workspace
                </Link>
              </div>
            ) : null}
          </div>
          <div className="relative">
            <button type="button" className="grid size-9 place-items-center rounded-md text-muted hover:bg-surface hover:text-fg" aria-label="Recent activity" onClick={() => setBell((value) => !value)}>
              <Bell className="size-4" />
            </button>
            {bell ? (
              <div className="absolute right-0 top-12 z-30 w-80 rounded-lg border border-line bg-elev p-2">
                <div className="px-2 py-1 text-xs uppercase tracking-widest text-faint">Recent activity</div>
                {activity
                  .filter((item) => !site || item.siteId === site.id)
                  .slice(0, 8)
                  .map((item) => (
                    <p key={item.id} className="border-t border-line px-2 py-2 text-sm">
                      {item.message}
                      <span className="mt-0.5 block text-xs text-faint">{relTime(item.at)}</span>
                    </p>
                  ))}
                {!activity.filter((item) => !site || item.siteId === site.id).length ? <p className="px-2 py-3 text-sm text-muted">No activity yet.</p> : null}
              </div>
            ) : null}
          </div>
          <div className="hidden sm:block">
            <ThemePicker />
          </div>
          <div className="relative">
            <button
              type="button"
              aria-expanded={workerPanel}
              aria-label="Writing service status"
              onClick={() => setWorkerPanel((value) => !value)}
              className={cn(
                "flex shrink-0 items-center gap-2 rounded-full border px-3 py-2 text-xs",
                workerPaused ? "border-danger/40 bg-danger/10 text-danger" : worker.online ? "border-brass/30 bg-brass/10 text-brass-2" : "border-line bg-elev text-muted",
              )}
            >
              <span className={cn("size-2 rounded-full", workerPaused ? "bg-danger" : worker.online ? "pulse-dot bg-brass" : "bg-faint")} />
              <span className="hidden sm:inline">
                {workerPaused ? "Writing service paused" : worker.online ? `Writing service online · ${relTime(worker.lastBeatAt)}` : "Writing service starting…"}
              </span>
            </button>
            {workerPanel ? (
              <div className="absolute right-0 top-12 z-30 w-80 rounded-lg border border-line bg-elev p-3 text-sm">
                <div className="font-mono text-xs uppercase tracking-widest text-faint">Writing service</div>
                <dl className="mt-2 space-y-1.5">
                  <div className="flex justify-between gap-3">
                    <dt className="text-muted">State</dt>
                    <dd className={workerPaused ? "text-danger" : worker.online ? "text-ok" : "text-muted"}>
                      {workerPaused ? "paused by operator" : worker.online ? "online" : "no heartbeat yet"}
                    </dd>
                  </div>
                  <div className="flex justify-between gap-3">
                    <dt className="text-muted">Last server beat</dt>
                    <dd className="tnum">
                      {worker.lastBeatAt ? `${new Date(worker.lastBeatAt).toLocaleTimeString()} · ${relTime(worker.lastBeatAt)}` : "never"}
                    </dd>
                  </div>
                  <div className="flex justify-between gap-3">
                    <dt className="text-muted">Active jobs</dt>
                    <dd className="tnum">{worker.activeJobs}</dd>
                  </div>
                  <div className="flex justify-between gap-3">
                    <dt className="text-muted">Next calendar pulse</dt>
                    <dd className="tnum">{worker.nextCalendarPulseAt ? new Date(worker.nextCalendarPulseAt).toLocaleString() : "nothing scheduled"}</dd>
                  </div>
                  <div className="flex justify-between gap-3">
                    <dt className="text-muted">Dispatch lease</dt>
                    <dd className="truncate text-right">
                      {worker.leaseHolder ? `${worker.leaseHolder.slice(0, 14)}… ${worker.leaseExpiresAt ? `until ${new Date(worker.leaseExpiresAt).toLocaleTimeString()}` : ""}` : "free"}
                    </dd>
                  </div>
                  <div className="flex justify-between gap-3">
                    <dt className="text-muted">Source</dt>
                    <dd>{worker.source}</dd>
                  </div>
                </dl>
                <p className="mt-2 text-xs leading-5 text-faint">
                  The lease is the single-dispatch guard: only one tab or server tick can advance the queue or publish at a time.
                </p>
                <Button className="mt-3 min-h-9 w-full py-1.5 text-xs" variant={workerPaused ? "primary" : "ghost"} onClick={() => setWorker(!workerPaused)}>
                  {workerPaused ? "Resume writing" : "Pause writing"}
                </Button>
              </div>
            ) : null}
          </div>
        </header>
        <main className="min-w-0 flex-1 px-4 pb-[calc(var(--tabbar-h)+var(--safe-bottom)+1.25rem)] pt-5 md:px-8 md:py-8 md:pb-8">
          <div className="mx-auto w-full max-w-6xl">{site ? children : <WorkspacesPage />}</div>
        </main>
      </div>
      <MobileTabBar path={path} onMore={() => setOpen(true)} />
      {palette ? (
         <div className="fixed inset-0 z-50 flex items-start justify-center bg-bg/70 px-4 pt-[12vh] backdrop-blur-sm" role="dialog" aria-modal="true" aria-label="Search and commands" onKeyDown={(event) => { if (event.key === "Escape") setPalette(false); }}>
          <button className="absolute inset-0" aria-label="Close search" onClick={() => setPalette(false)} />
           <div className="relative w-full max-w-xl overflow-hidden rounded-lg border border-line bg-elev shadow-sm">
            <input
              ref={searchRef}
              autoFocus
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search articles, runs, plans, or type a command"
              className="min-h-12 w-full border-b border-line bg-transparent px-4 text-sm outline-none placeholder:text-faint"
              aria-label="Search the studio"
            />
            <div className="max-h-80 overflow-y-auto p-2">
              {commands.map((row) => (
                <CommandRow
                  key={row.label}
                  label={row.label}
                  hint={row.hint}
                  onPick={() => {
                    setPalette(false);
                    if (row.href === "__setup") {
                      setSetup(1);
                      void navigate({ to: "/" });
                      return;
                    }
                    if (row.build) {
                      // Rule 7 quick action: build the static site, then land on delivery.
                      useApp.getState().buildSite();
                    }
                  }}
                  href={row.href === "__setup" ? undefined : row.href}
                />
              ))}
              {modeCommands.map((theme) => (
                <CommandRow
                  key={theme.id}
                  label={theme.label}
                  hint="Mode"
                  onPick={() => {
                    applyTheme(theme.id);
                    setPalette(false);
                  }}
                />
              ))}
              {results.map((result) => (
                <CommandRow key={result.href + result.label} label={result.label} hint={result.hint} href={result.href} onPick={() => setPalette(false)} />
              ))}
            </div>
          </div>
        </div>
      ) : null}
      <LiveWriter />
      <HumanizePipeline />
      <DeskWorkers />
      {notice ? (
        <div className="fixed bottom-[calc(var(--tabbar-h)+var(--safe-bottom)+0.75rem)] left-4 right-4 z-50 mx-auto max-w-md rounded-md border border-line bg-elev px-4 py-3 text-sm text-fg shadow-sm md:bottom-6 md:left-auto md:right-6">
          {notice.text}
          <span className="ml-2 text-faint">{relTime(Date.now())}</span>
        </div>
      ) : null}
    </div>
  );
}

/**
 * Phone-first navigation (<md). Sidebar is hidden at this width, so the four
 * daily destinations plus one raised primary action live in a thumb-reachable
 * bar; everything else stays in the drawer behind "More".
 */
const TABS = [
  { id: "overview", href: "/", label: "Overview", Icon: LayoutDashboard },
  { id: "articles", href: "/articles", label: "Articles", Icon: Files },
  { id: "calendar", href: "/calendar", label: "Calendar", Icon: CalendarDays },
] as const;

function MobileTabBar({ path, onMore }: { path: string; onMore: () => void }) {
  const onCreate = active("/create", path);
  return (
    <nav
      aria-label="Primary"
      data-shell-tabbar
      className="fixed inset-x-0 bottom-0 z-30 grid min-h-[var(--tabbar-h)] grid-cols-5 items-stretch border-t border-line bg-bg/95 pb-[var(--safe-bottom)] backdrop-blur md:hidden"
    >
      {TABS.slice(0, 2).map((tab) => (
        <TabLink key={tab.id} tab={tab} path={path} />
      ))}
      <Link
        to="/create"
        aria-current={onCreate ? "page" : undefined}
        aria-label="Create content"
        className="flex flex-col items-center justify-center gap-1 pt-1.5"
      >
        <span className={cn("grid size-9 place-items-center rounded-full transition-colors", onCreate ? "bg-accent text-on-accent" : "bg-accent/14 text-accent")}>
          <Plus className="size-5" strokeWidth={2} />
        </span>
        <span className={cn("text-[10px] font-medium leading-4", onCreate ? "text-accent" : "text-faint")}>Create</span>
      </Link>
      {TABS.slice(2).map((tab) => (
        <TabLink key={tab.id} tab={tab} path={path} />
      ))}
      <button type="button" onClick={onMore} aria-label="More sections" className="flex flex-col items-center justify-center gap-1 pt-1.5 text-faint">
        <span className="grid size-9 place-items-center rounded-full">
          <Menu className="size-5" strokeWidth={1.75} />
        </span>
        <span className="text-[10px] font-medium leading-4">More</span>
      </button>
    </nav>
  );
}

function TabLink({ tab, path }: { tab: (typeof TABS)[number]; path: string }) {
  const on = tab.id !== "overview" ? active(tab.href, path) : path === "/";
  const Icon = tab.Icon;
  return (
    <Link
      to={tab.href}
      aria-current={on ? "page" : undefined}
      className={cn("flex flex-col items-center justify-center gap-1 pt-1.5 text-[10px] font-medium leading-4", on ? "text-accent" : "text-faint")}
    >
      <span className={cn("grid size-9 place-items-center rounded-full", on && "bg-accent/12")}>
        <Icon className="size-5" strokeWidth={on ? 2.1 : 1.75} />
      </span>
      {tab.label}
    </Link>
  );
}

function Brand({ full }: { full?: boolean }) {
  return (
    <Link to="/" className={cn("flex items-center gap-2.5 px-4 pb-3 pt-3", !full && "md:justify-center md:px-0 xl:justify-start xl:px-4")}>
      <StudioMark />
      <span className={cn("min-w-0", !full && "md:hidden xl:block")}>
        <span className="block truncate text-[13px] font-semibold tracking-[-0.01em] text-fg">Ghost AI Writer</span>
        <span className="mt-0.5 block text-[11px] text-faint">Content desk</span>
      </span>
    </Link>
  );
}

/** The one primary action in the sidebar (reference: AirOps puts + Create first). */
function CreateButton() {
  return (
    <div className="px-3 pb-2 md:px-2 xl:px-3">
      <Link
        to="/create"
        title="New article"
        className="flex min-h-8 w-full items-center gap-2 rounded-md border border-line-strong/70 px-2 text-[13px] font-medium text-fg transition-colors hover:border-accent/60 hover:bg-accent/[0.06] hover:text-accent md:justify-center md:px-0 xl:justify-start xl:px-2"
      >
        <Plus className="size-4 shrink-0 text-accent" />
        <span className="md:sr-only xl:not-sr-only">New article</span>
      </Link>
    </div>
  );
}

function SidebarNav({ path, onNavigate }: { path: string; onNavigate?: () => void }) {
  const [expanded, setExpanded] = useState<Record<string, boolean>>(() => Object.fromEntries(SHELL_GROUPS.map((group) => [group, true])));
  useEffect(() => {
    const current = NAV.find((item) => item.id !== "backup" && active(item.href, path));
    if (current) setExpanded((previous) => previous[current.group] ? previous : { ...previous, [current.group]: true });
  }, [path]);
  return (
    <nav aria-label="Main navigation" className="no-scrollbar min-h-0 flex-1 overflow-y-auto px-2 pb-2">
      {SHELL_GROUPS.map((group) => {
        const items = NAV.filter((item) => item.group === group);
        const isOpen = Boolean(expanded[group]);
        return (
          <section key={group} className="mb-3 md:mb-2">
            {/* Rail width (md–xl) has no room for the group word: a hairline keeps the rhythm. */}
            <div aria-hidden="true" className="mx-2 mb-1.5 hidden h-px bg-line/70 md:block xl:hidden" />
            <button type="button" aria-expanded={isOpen} aria-controls={`nav-${group.replaceAll(/[^a-z]+/gi, "-")}`} onClick={() => setExpanded((previous) => ({ ...previous, [group]: !previous[group] }))} className="flex min-h-7 w-full items-center justify-between rounded-sm px-2 text-left text-[11px] font-semibold uppercase tracking-[0.08em] text-faint hover:text-fg md:hidden xl:flex">
              {group}<ChevronDown aria-hidden="true" className={cn("size-3.5 transition-transform", !isOpen && "-rotate-90")} />
            </button>
            <div id={`nav-${group.replaceAll(/[^a-z]+/gi, "-")}`} className={cn("mt-0.5 space-y-px pb-2 md:block md:pb-0", !isOpen && "hidden")}>
              {items.map((item) => <NavLink key={item.id} item={item} path={path} onNavigate={onNavigate} />)}
            </div>
          </section>
        );
      })}
    </nav>
  );
}

function ghostDot(ghost: { status: string; lastError?: string }) {
  if (ghost.status === "error") return "bg-danger";
  if (ghost.lastError) return "bg-brass";
  if (ghost.status === "connected") return "bg-ok";
  return "bg-faint";
}

function CommandRow({ label, hint, href, onPick }: { label: string; hint: string; href?: string; onPick: () => void }) {
  const className = "flex min-h-10 w-full items-center justify-between gap-3 rounded-md px-3 text-left text-[13px] hover:bg-surface";
  if (!href) {
    return (
      <button className={className} onClick={onPick}>
        <span className="truncate">{label}</span>
        <span className="shrink-0 text-[11px] uppercase tracking-[0.06em] text-faint">{hint}</span>
      </button>
    );
  }
  return (
    <Link to={href} className={className} onClick={onPick}>
      <span className="truncate">{label}</span>
      <span className="shrink-0 text-[11px] uppercase tracking-[0.06em] text-faint">{hint}</span>
    </Link>
  );
}

function NavLink({ item, path, onNavigate }: { item: (typeof NAV)[number]; path: string; onNavigate?: () => void }) {
  const Icon = item.Icon ?? LayoutDashboard;
  const on = item.id !== "backup" && active(item.href, path);
  return (
    <Link
      to={item.href}
      onClick={onNavigate}
      title={item.label}
      aria-current={on ? "page" : undefined}
      aria-label={item.label}
      className={cn(
        "flex min-h-8 items-center gap-2 rounded-sm px-2 text-[13px] font-medium transition-colors duration-150 md:justify-center md:px-0 xl:justify-start xl:px-2",
        on
          ? "bg-accent/14 font-semibold text-fg shadow-[inset_2px_0_0_var(--color-accent)]"
          : "text-muted hover:bg-surface-2/70 hover:text-fg",
      )}
    >
      <Icon strokeWidth={1.75} className={cn("size-4 shrink-0", on ? "text-accent" : "text-faint")} />
       <span className="truncate md:sr-only xl:not-sr-only">{item.label}</span>
    </Link>
  );
}
