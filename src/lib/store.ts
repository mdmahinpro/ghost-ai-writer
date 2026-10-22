import { useEffect, useState } from "react";
import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import type { ChatTransport, ImageTransport } from "./engine";
import {
  advance,
  applyAudit,
  applyProbe,
  buildAudit,
  cancelRun,
  generatePlan,
  acceptModelPlan,
  inventoryFromArticles,
  manualBuild,
  needsWork,
  packageDeploy,
  resolveRouteDiff,
  queuePlan,
  regenerateVariant,
  restartJob,
  submitKeywords,
  suggestIdeas,
  usdFor,
  weaveOrphans,
  liftOpenings,
  rescoreArticles,
  queueMissingPhotos,
  releaseHeld,
  failJob,
  applyKeyPenalty,
  corpusFor,
  keyCallsModel,
  keyPool,
  usableKey,
  decideReview,
} from "./engine";
import { loadAppState, saveAppState, resetAppState } from "./server-store.functions";
import { placeImages } from "./images.functions";
import { buildCalendar, migrateCalendar, pulseCalendars, publishCalendarItemNow, publishSlots, queueCalendarItem, withSummaries } from "./operator";
import { workerClaimLease, workerHeartbeat } from "./worker.functions";
import { embeddingProvider } from "./embed-key";
import { attachAuthor, generateAuthorForTopic, normalizeAuthorProfile } from "./authors";
import { parseIntentStage } from "./stage-contracts";
import {
  newResearchProject,
  normalizeResearchProject,
  planFromResearch,
  rerunFailedStages,
  runResearch,
  type ResearchChat,
} from "./research-engine";
import { generateDraft } from "./providers.functions";
import { runWithKeyPool } from "./model-pool";
import {
  AD_CODE_LIMIT,
  AD_SLOT_IDS,
  DEFAULT_LIMITS,
  defaultAdSlots,
  type Account,
  type Activity,
  type AiKey,
  type Article,
  type AuthorProfile,
  type ContentCalendar,
  type DeployProvider,
  type GhostConn,
  type Job,
  type Limits,
  type Persisted,
  type ResearchProject,
  type ResearchStageKey,
  type Site,
  type VoiceSettings,
  type WebSearchConfig,
  type WebSearchKey,
  type WebSearchMode,
  type WorkspaceBackup,
} from "./types";
import { blendedPricePerMillion, catalogModel, embeddingModelFor, pricePerMillionForModelId } from "./model-catalog";
import { packWorkspace, readBackup, type WorkspaceBackupFile } from "./backup";
import { durableStorage } from "./durable-storage";
import { sanitizeArticleImages } from "./image-urls";
import { loadVaultGate, lockWithPassphrase, onVaultPhase, vaultPhase } from "./vault";
import { uid } from "./utils";
import { generateIdeas } from "./providers.functions";

const defaults: VoiceSettings = {
  modelKeyId: "",
  publishAs: "draft",
  tone: "clear, specific, no hype",
  sections: 5,
  sectionImages: 2,
  linkIntensity: "standard",
  voice: "A working editor. Short sentences. No borrowed statistics.",
  imageProvider: "bing",
  bannedPhrases: [],
  brandFacts: [],
  pov: "third-person",
  readingLevel: "general",
};

function providers(): DeployProvider[] {
  return [
    {
      id: "cloudflare",
      name: "Cloudflare Pages",
      capability: "Not yet wired — roadmap",
      status: "not_connected",
      hint: "",
    },
    { id: "github", name: "GitHub Pages", capability: "Not yet wired — roadmap", status: "not_connected", hint: "" },
    { id: "vercel", name: "Vercel", capability: "Not yet wired — roadmap", status: "not_connected", hint: "" },
    { id: "cpanel", name: "cPanel hosting", capability: "Explicit-TLS FTPS", status: "not_connected", hint: "" },
  ];
}

function freshGhost(): GhostConn {
  return { mode: "off", status: "disconnected", url: "", keyHint: "", version: "", corpus: "EMPTY", inventory: [] };
}

/**
 * Production initial state: ZERO demo workspaces, demo articles, demo runs, or
 * dummy plans. A fresh install (or a fresh incognito window on a fresh server
 * store) starts completely empty — only workspaces explicitly created by the
 * user exist. The shell redirects to the workspace onboarding when this state
 * has no sites, and the server `.data/appstate.json` store is hydrated on boot.
 */
function emptyPersisted(): Persisted {
  return {
    activeSiteId: "",
    sites: [],
    runs: [],
    jobs: [],
    articles: [],
    plans: [],
    events: [],
    keys: [],
    builds: [],
    deploys: [],
    audits: [],
    activity: [],
    account: {
      name: "",
      email: "",
      emailVerified: false,
      adminApproved: false,
      sessions: [{ id: "ses_now", label: "This browser", current: true, seenAt: Date.now() }],
    },
    defaults,
    ideas: null,
    notice: null,
    authors: [],
    firecrawl: { secret: "", hint: "" },
    calendars: [],
    research: [],
    workerPaused: false,
    worker: { lastBeatAt: 0, online: false, activeJobs: 0, source: "browser" },
    backups: [],
    corpus: [],
    limits: { ...DEFAULT_LIMITS },
    webSearch: { mode: "off", tavilyKeys: [], firecrawlKeys: [], tavilyCursor: 0, firecrawlCursor: 0 },
  };
}

export type AppState = Persisted & {
  tick: () => void;
  clearNotice: () => void;
  setSite: (id: string) => void;
  queueKeywords: (input: {
    lines: string;
    publishMode: "default" | "draft" | "live";
    modelKeyId: string;
    allowVariants: boolean;
    bulletproof?: boolean;
    researchUrls?: string[];
  }) => Promise<string | undefined>;
  runIdeas: (niche: string, count?: number) => void;
  makePlan: (topic: string) => string | undefined;
  failPlan: (topic: string, error: string) => string;
  installModelPlan: (topic: string, pillar: string, clusters: { title: string; blurb: string }[]) => { planId?: string; error?: string };
  setClusterExcluded: (planId: string, clusterId: string, excluded: boolean) => void;
  queueTopic: (planId: string, opts?: { publishMode?: "default" | "draft" | "live"; modelKeyId?: string }) => Promise<string | undefined>;
  stopRun: (runId: string) => void;
  retryJob: (jobId: string, fromScratch?: boolean) => void;
  variantJob: (jobId: string) => void;
  connectStudio: () => void;
  disconnectGhost: () => void;
  markLive: (url: string, version: string, hint: string, adminKey?: string) => void;
  failGhost: (message: string) => void;
  beginStudioSync: () => void;
  applyLiveInventory: (posts: { id: string; title: string; slug: string; status: "PUBLISHED" | "DRAFT" }[], note?: string) => void;
  auditNow: () => void;
  toggleProposal: (auditId: string, proposalId: string) => void;
  applyProposals: (auditId: string) => void;
  patchSite: (patch: Partial<Site>) => void;
  patchVoice: (patch: Partial<VoiceSettings>) => void;
  patchDefaults: (patch: Partial<VoiceSettings>) => void;
  patchAccount: (patch: Partial<Account>) => void;
  addKey: (input: {
    provider: string;
    model: string;
    allowanceUsd: number;
    priority: number;
    baseUrl?: string;
    secret?: string;
    label?: string;
    providerKind?: AiKey["providerKind"];
    catalogId?: string;
    pricePerM?: number;
    /** Semantic (embeddings) model id for the L3 duplicate gate; blank = provider family default. */
    embeddingModel?: string;
  }) => void;
  toggleKey: (id: string) => void;
  /** Permanently remove a key/custom endpoint from this browser. Usage ledger rows are kept. */
  deleteKey: (id: string) => void;
  /** Edit a saved key in place (model id, base URL, label, priority). */
  patchKey: (id: string, patch: Partial<Pick<AiKey, "provider" | "providerKind" | "model" | "baseUrl" | "secret" | "label" | "priority" | "allowanceUsd" | "pricePerM" | "hint" | "catalogId" | "embeddingModel" | "lastError" | "lastErrorAt" | "cooldownUntil">>) => void;
  patchLimits: (patch: Partial<Limits>) => void;
  setWebSearchMode: (mode: WebSearchMode) => void;
  importWebSearchKeys: (provider: "tavily" | "firecrawl", raw: string) => number;
  clearWebSearchKeys: (provider: "tavily" | "firecrawl") => void;
  setWebSearchKey: (id: string, patch: Partial<Pick<WebSearchKey, "disabled" | "failCount" | "cooldownUntil" | "lastError" | "lastUsedAt">>) => void;
  takeWebSearchKey: (provider: "tavily" | "firecrawl") => WebSearchKey | null;
  setFirecrawl: (secret: string) => void;
  patchArticle: (id: string, patch: Partial<Article>) => void;
  /** Rule 2: one-click niche test — generates a fresh US expert author for the active site. */
  addExpertAuthor: (niche: string) => void;
  patchAuthor: (id: string, patch: Partial<AuthorProfile>) => void;
  logEvent: (siteId: string, tone: Activity["tone"], message: string) => void;
  acceptModelStage: (
    jobId: string,
    stage: "intent" | "draft" | "revision",
    text: string,
    usage: { prompt: number; completion: number; total: number },
    promptVersion: string,
    verifyFlags?: string[],
  ) => void;
  failModelStage: (jobId: string, message: string) => void;
  penalizeKey: (keyId: string, status: number, message?: string) => void;
  /** Clears every key cooldown and re-queues failed jobs for immediate retry. */
  clearCooldowns: () => void;
  ensureAuthors: () => void;
  weaveLinks: () => void;
  buildSite: () => void;
  packageBuild: (buildId: string, providerId?: string) => string | undefined;
  acknowledgeRouteDiff: (deployId: string) => void;
  rebuildForRouteDiff: (deployId: string) => void;
  saveProviderApi: (providerId: DeployProvider["id"], api: NonNullable<DeployProvider["api"]>) => void;
  recordProbe: (deployId: string, ok: boolean, detail: string) => void;
  verifyProvider: (providerId: DeployProvider["id"], hint: string) => void;
  disconnectProvider: (providerId: DeployProvider["id"]) => void;
  revokeSession: (id: string) => void;
  confirmPassphrase: (passphrase: string) => Promise<void>;
  markActivityRead: (id: string) => void;
  markActivityReadAll: (siteId: string) => void;
  resetStudio: () => void;
  setWorker: (paused: boolean) => void;
  decideJob: (jobId: string, approve: boolean) => void;
  releaseJob: (jobId: string) => void;
  saveProvider: (providerId: DeployProvider["id"], hint: string) => void;
  saveFtp: (providerId: "cpanel", ftp: { host: string; user: string; path: string; password: string; port?: number; publicUrl?: string; via?: "ftps" | "sftp" }) => boolean;
  createWorkspace: (name: string) => void;
  deleteWorkspace: (id: string) => void;
  deleteArticles: (ids: string[]) => void;
  restoreWorkspace: (raw: string) => void;
  createBackup: () => void;
  verifyBackup: (id: string) => void;
  setSetup: (step: number) => void;
  setKeyAllowance: (id: string, allowanceUsd: number) => void;
  createCalendar: (input: {
    name: string;
    timezone: string;
    activeDays: number[];
    articlesPerWeek: number;
    publishTime: string;
    generationLeadHours: number;
    order: ContentCalendar["order"];
    publishMode?: ContentCalendar["publishMode"];
    planningRangeDays?: number;
    planId?: string;
    lines?: string;
  }) => string | undefined;
  patchCalendar: (
    id: string,
    patch: Partial<Pick<ContentCalendar, "autoGenerate" | "autoPublish" | "autoReweave" | "publishMode" | "mode" | "name" | "timezone" | "activeDays" | "articlesPerWeek" | "publishTime" | "generationLeadHours" | "planningRangeDays" | "order">>,
  ) => void;
  patchCalendarItem: (calendarId: string, itemId: string, patch: { publishAt?: number; status?: "SCHEDULED" | "SKIPPED" }) => void;
  removeCalendarItem: (calendarId: string, itemId: string) => void;
  writeCalendarItem: (calendarId: string, itemId: string) => void;
  /** Mode-aware Publish now / Save draft now for a READY entry. */
  publishCalendarItem: (calendarId: string, itemId: string) => void;
  /** Rule 6: fill an existing calendar from a topic plan; reports scheduled vs unscheduled. */
  fillCalendarFromPlan: (calendarId: string, planId: string) => void;
  addResearch: (niche: string, notes: string, breadth?: ResearchProject["breadth"]) => string | undefined;
  /** Rule 3: run the 11-stage research engine; continues from what is missing. */
  runResearch: (researchId: string) => Promise<void>;
  retryResearchStage: (researchId: string, stageKey?: ResearchStageKey) => void;
  archiveResearch: (researchId: string) => void;
  queuePlanFromResearch: (researchId: string) => string | undefined;
  updateCluster: (planId: string, clusterId: string, patch: { title?: string; angle?: string; selected?: boolean; excluded?: boolean }) => void;
  moveCluster: (planId: string, clusterId: string, direction: -1 | 1) => void;
  removeCluster: (planId: string, clusterId: string) => void;
  addCluster: (planId: string, title: string, angle: string, pillar: boolean) => void;
};

function snap(s: AppState): Persisted {
  return {
    activeSiteId: s.activeSiteId,
    sites: s.sites,
    runs: s.runs,
    jobs: s.jobs,
    articles: s.articles,
    plans: s.plans,
    events: s.events,
    keys: s.keys,
    builds: s.builds,
    deploys: s.deploys,
    audits: s.audits,
    activity: s.activity,
    account: s.account,
    defaults: s.defaults,
    ideas: s.ideas,
    notice: s.notice,
    authors: s.authors,
    firecrawl: s.firecrawl,
    calendars: s.calendars,
    research: s.research,
    workerPaused: s.workerPaused,
    worker: s.worker,
    backups: s.backups,
    corpus: s.corpus,
    limits: s.limits,
    webSearch: s.webSearch,
  };
}

function siteOf(data: Persisted): Site | undefined {
  return data.sites.find((site) => site.id === data.activeSiteId) ?? data.sites[0];
}

function addMissing<T extends { id: string }>(have: T[], incoming: T[] | undefined): T[] {
  const ids = new Set(have.map((row) => row.id));
  return [...have, ...(incoming ?? []).filter((row) => row?.id && !ids.has(row.id))];
}

function mergeBackup(state: AppState, file: WorkspaceBackupFile): AppState {
  const site: Site = { ...file.site, ghost: { ...file.site.ghost, adminKey: undefined } };
  const exists = state.sites.some((item) => item.id === site.id);
  return {
    ...state,
    sites: exists ? state.sites : [...state.sites, site],
    activeSiteId: state.activeSiteId || site.id,
    articles: addMissing(state.articles, file.articles),
    runs: addMissing(state.runs, file.runs),
    jobs: addMissing(state.jobs, file.jobs),
    plans: addMissing(state.plans, file.plans),
    calendars: addMissing(state.calendars, (file.calendars as (ContentCalendar & Record<string, unknown>)[] | undefined)?.map((calendar) => migrateCalendar(calendar))),
    research: addMissing(state.research, file.research).map((project) => normalizeResearchProject(project)),
    authors: addMissing(state.authors, file.authors).map((author) => normalizeAuthorProfile(author)),
    builds: addMissing(state.builds, file.builds),
    deploys: addMissing(state.deploys, file.deploys),
    audits: addMissing(state.audits, file.audits),
    events: addMissing(state.events, file.events),
  };
}

/** Rule 6: stable-per-tab lease id (a reload keeps its identity within the session). */
function leaseTickId(): string {
  const key = "__gawLeaseTick";
  const global = globalThis as Record<string, unknown>;
  if (!global[key]) global[key] = `tick_${Math.random().toString(36).slice(2, 10)}${Date.now().toString(36)}`;
  return String(global[key]);
}

/** Earliest scheduled write/publish time across a site's calendars (heartbeat detail). */
function nextCalendarPulseAt(calendars: ContentCalendar[], siteId: string): number | undefined {
  const times = calendars
    .filter((calendar) => calendar.siteId === siteId)
    .flatMap((calendar) => calendar.items.filter((item) => item.status === "SCHEDULED" || item.status === "READY").map((item) => (item.status === "READY" ? item.publishAt : item.writeAt)));
  return times.length ? Math.min(...times) : undefined;
}

function researchNoticeText(project: ResearchProject): string {
  if (project.status === "ready") return `Research READY · all 11 stages complete for “${project.niche}”.`;
  if (project.status === "failed") return `Research failed at “${project.stages.find((stage) => stage.status === "failed")?.name ?? project.niche}”. Retry continues from what is missing.`;
  const failedStage = project.stages.find((stage) => stage.status === "failed");
  return failedStage
    ? `Research PARTIAL · ${project.stagesCompleted}/11 stages · stopped safely at ${failedStage.name}: ${failedStage.error ?? "stage failed"}.`
    : `Research PARTIAL · ${project.stagesCompleted}/11 stages complete.`;
}

const STALL_TIMEOUT_MS = 20 * 60_000;

/**
 * Loop-hotfix watchdog: a job whose current stage has been "running" far past
 * any real model call is stuck forever (a dead endpoint, a lost lease handoff,
 * a tab throttled by the browser). It keeps `needsWork()` true every tick, so
 * the worker churns the whole store at 2.5x/sec — the nested-update storm
 * behind "Maximum update depth exceeded". Fail the job honestly once.
 */
function failStalledJobs(state: AppState): Persisted | null {
  const now = Date.now();
  let changed = false;
  const next = structuredClone(snap(state));
  for (const job of next.jobs) {
    if (job.status !== "running") continue;
    const stage = job.stages[job.stageIndex];
    if (!stage || stage.status !== "running") continue;
    if (stage.startedAt && now - stage.startedAt < STALL_TIMEOUT_MS) continue;
    stage.status = "failed";
    stage.error = "Watchdog: stage stalled over 20 min. Job failed — retry from the run or article page.";
    stage.finishedAt = now;
    job.status = "failed";
    job.modelError = stage.error;
    changed = true;
  }
  if (!changed) return null;
  return next;
}

function backupNotice(state: AppState, file: WorkspaceBackupFile): string {
  const addedArticles = file.articles.filter((article) => !state.articles.some((have) => have.id === article.id)).length;
  const known = state.sites.some((site) => site.id === file.site.id);
  return known
    ? `Restored ${addedArticles} missing articles into ${file.site.name}. Existing posts were kept. Reconnect Ghost if this is a new browser.`
    : `Workspace "${file.site.name}" added. ${addedArticles} articles restored. Reconnect Ghost — secrets are not in the file.`;
}

let advancing = false;

export const useApp = create<AppState>()(
  persist(
    (set, get) => ({
      ...emptyPersisted(),
      tick: () => {
        if (advancing) return;
        const now = Date.now();
        const s = get();
        if (s.workerPaused) return;
        advancing = true;
        void (async () => {
          try {
            const current = get();
            const siteId = current.activeSiteId;
            // No workspace yet (clean onboarding): there is no queue to claim
            // and the lease bridge refuses an empty siteId — idle out quietly.
            if (!siteId) return;
            const activeJobs = current.jobs.filter((job) => job.status === "running").length;
            const nextPulse = nextCalendarPulseAt(current.calendars, siteId);
            // Loop-hotfix watchdog: release jobs stuck "running" past the stall
            // timeout BEFORE claiming work, so a dead stage cannot keep the
            // store churning (and React re-rendering) forever.
            const unstuck = failStalledJobs(current);
            if (unstuck) set((cur) => ({ ...cur, ...unstuck, ...mergePersisted(cur, unstuck, CHURNED_COLLECTIONS), notice: { tone: "warn", text: "A stalled job was failed by the watchdog (stage stuck over 20 min). Retry it from the run page." } }));
            // Rule 6: single-dispatch lease. Concurrent tabs (and the server loop)
            // can never advance the same queue — only the holder ticks. The TTL
            // stretches while work is in flight: one advance() call now runs a
            // job's whole 6-stage pipeline (model calls can take minutes), and a
            // second tab must not claim the queue mid-pipeline.
            const busyNow = needsWork(current, now);
            const tickId = leaseTickId();
            const claimed = await workerClaimLease({ data: { siteId, tickId, activeJobs, nextCalendarPulseAt: nextPulse, ttlMs: busyNow ? 45_000 : 15_000 } });
            if (!claimed.lease.granted) {
              // Strict no-op: only write when the server beat actually moved.
              // An unconditional set() replaced the worker object every 400ms
              // while another tab held the lease, waking every subscriber and
              // re-firing every worker effect for no new data.
              const worker = get().worker;
              const beatChanged =
                worker.lastBeatAt !== claimed.lastBeatAt ||
                worker.online !== claimed.online ||
                worker.activeJobs !== claimed.activeJobs ||
                worker.nextCalendarPulseAt !== claimed.nextCalendarPulseAt;
              if (beatChanged) {
                set((cur) => ({ ...cur, worker: { ...cur.worker, lastBeatAt: claimed.lastBeatAt, online: claimed.online, activeJobs: claimed.activeJobs, nextCalendarPulseAt: claimed.nextCalendarPulseAt, source: "server" } }));
              }
              return;
            }
            // Hotfix: upsert-merge the advanced clone instead of a wholesale
            // spread. A clone taken before `advance`'s awaits (gateText, image
            // fetches) used to erase runs/jobs/articles committed concurrently
            // by queueKeywords → "Run missing".
            // Hotfix: upsert-merge the advanced clone instead of a wholesale
            // spread. A clone taken before `advance`'s awaits (gateText, image
            // fetches) used to erase runs/jobs/articles committed concurrently
            // by queueKeywords → "Run missing".
            let base = current;
            if (needsWork(current, now)) {
              // The sequential pipeline host: stage-by-stage commits stream job
              // progress into the live store (and the server DB) the moment each
              // stage finishes, so the UI and every other window see it instantly.
              const advanced = await advance(snap(current), now, {
                chat: chatTransport,
                images: imageTransport,
                provider: embeddingProvider(usableKey(snap(current), undefined, now) ?? undefined).provider,
                commit: (patchState) => {
                  useApp.setState((cur) => ({ ...cur, ...patchState, ...mergePersisted(cur, patchState, CHURNED_COLLECTIONS) }));
                },
              });
              base = { ...current, ...advanced, ...mergePersisted(current, advanced, CHURNED_COLLECTIONS) };
            }
            const pulsed = await pulseCalendars(snap(base), now);
            // Same hotfix for the calendar/queue pulse: never wipe what a concurrent
            // action (a just-queued run) committed while the pulse was awaiting.
            const afterPulse = pulsed ? { ...base, ...pulsed, ...mergePersisted(base, pulsed, CHURNED_COLLECTIONS) } : base;
            const beat = await workerHeartbeat({
              data: {
                siteId,
                tickId,
                activeJobs: afterPulse.jobs.filter((job) => job.status === "running").length,
                nextCalendarPulseAt: nextCalendarPulseAt(afterPulse.calendars, siteId),
                ttlMs: busyNow ? 45_000 : 15_000,
              },
            });
            const workerBeat = {
              lastBeatAt: beat.lastBeatAt,
              online: beat.online,
              activeJobs: beat.activeJobs,
              nextCalendarPulseAt: beat.nextCalendarPulseAt,
              source: "server" as const,
              leaseHolder: beat.lease.holder,
              leaseExpiresAt: beat.lease.expiresAt,
            };
            // Loop-hotfix: commit onto the LIVE state (implicitly via the set
            // callback) and overlay ONLY what this tick itself changed. Every
            // idle heartbeat previously replaced the entire store with a fresh
            // object graph, re-rendering every `useApp()` subscriber
            // (including OverviewPage's whole-store hook) 2.5x per second and
            // re-firing every worker effect behind "Maximum update depth
            // exceeded" once a queue stays busy.
            const cur = get();
            const worker = cur.worker;
            const beatChanged =
              worker.lastBeatAt !== workerBeat.lastBeatAt ||
              worker.online !== workerBeat.online ||
              worker.activeJobs !== workerBeat.activeJobs ||
              worker.nextCalendarPulseAt !== workerBeat.nextCalendarPulseAt ||
              worker.leaseHolder !== workerBeat.leaseHolder ||
              worker.leaseExpiresAt !== workerBeat.leaseExpiresAt;
            const next: Partial<AppState> = beatChanged ? { worker: { ...worker, ...workerBeat } } : {};
            const merged = mergePersisted(cur, afterPulse, CHURNED_COLLECTIONS);
            for (const key of CHURNED_COLLECTIONS) {
              const mergedList = (merged as Record<string, unknown>)[key as string];
              if (mergedList !== undefined) (next[key] as unknown) = mergedList;
            }
            for (const key of ["activeSiteId", "sites", "keys", "account", "defaults", "ideas", "notice", "firecrawl", "workerPaused", "limits", "webSearch"] as const) {
              if (afterPulse[key] !== current[key] && (cur[key] as unknown) === (current[key] as unknown)) (next[key] as unknown) = afterPulse[key];
            }
            // Strict no-op when nothing changed: an empty set() still swaps the
            // state object and wakes every useSyncExternalStore listener, which
            // re-renders the shell and re-runs effects for zero new data.
            if (Object.keys(next).length) set(next);
          } catch (error) {
            console.error("[tick] worker loop failed:", error);
          } finally {
            advancing = false;
          }
        })();
      },
      clearNotice: () => set({ notice: null }),
      setSite: (id) => set({ activeSiteId: id }),
      queueKeywords: async (input) => {
        const s = get();
        const site = s.sites.find((item) => item.id === s.activeSiteId);
        const keyId = input.modelKeyId === "default" ? site?.voice.modelKeyId : input.modelKeyId;
        const result = await submitKeywords(snap(s), {
          ...input,
          siteId: s.activeSiteId,
          now: Date.now(),
          provider: embeddingProvider(s.keys.find((key) => key.id === keyId)).provider,
        });
        set((cur) => {
          if (result.error && !result.runId) return { ...cur, notice: { tone: "danger", text: result.error } };
          // Hotfix: upsert-merge so a run committed by a concurrent action/tick survives.
          return { ...cur, ...result.data, ...mergePersisted(cur, result.data, CHURNED_COLLECTIONS), notice: result.error ? { tone: "danger", text: result.error } : result.data.notice };
        });
        return result.runId;
      },
      runIdeas: (niche, count = 8) => {
        void (async () => {
          const s = get();
          const site = s.sites.find((item) => item.id === s.activeSiteId);
          const snapshot = snap(s);
          const key = usableKey(snapshot, site?.voice.modelKeyId, Date.now());
          let liveIdeas: { ideas: { keyword: string; why: string }[]; usage: { prompt: number; completion: number; total: number } } | undefined;
          if (key && keyCallsModel(key)) {
            const generated = await generateIdeas({
              data: {
                baseUrl: key.baseUrl!,
                apiKey: key.secret!,
                model: key.model,
                niche,
                corpus: corpusFor(snapshot, s.activeSiteId).map((item) => ({ title: item.title, slug: item.slug, permalink: item.permalink })),
              },
            });
            if (!generated.ok) {
              set((cur) => ({ ...cur, notice: { tone: "danger", text: generated.error } }));
              return;
            }
            liveIdeas = { ideas: generated.ideas, usage: generated.usage };
          }
          const result = await suggestIdeas(
            snapshot,
            s.activeSiteId,
            niche,
            Date.now(),
            count,
            embeddingProvider(key ?? undefined).provider,
            liveIdeas,
          );
          set((cur) => (result.error ? { ...cur, notice: { tone: "danger", text: result.error } } : { ...cur, ...result.data }));
        })();
      },
      makePlan: (topic) => {
        let planId: string | undefined;
        set((s) => {
          const result = generatePlan(snap(s), s.activeSiteId, topic, Date.now());
          planId = result.planId;
          if (result.error) return { ...s, notice: { tone: "danger", text: result.error } };
          return { ...s, ...result.data };
        });
        return planId;
      },
      failPlan: (topic, error) => {
        const planId = uid("plan");
        set((s) => ({
          ...s,
          plans: [{ id: planId, siteId: s.activeSiteId, topic, pillarTitle: topic, pillarAngle: "Plan failed before queueing.", clusters: [], status: "failed", error, createdAt: Date.now() }, ...s.plans],
          notice: { tone: "danger", text: error },
        }));
        return planId;
      },
      installModelPlan: (topic: string, pillar: string, clusters: { title: string; blurb: string }[]) => {
        let planId: string | undefined;
        let error: string | undefined;
        set((s) => {
          const result = acceptModelPlan(snap(s), s.activeSiteId, topic, pillar, clusters, Date.now());
          planId = result.planId;
          error = result.error;
          if (result.error) return { ...s, notice: { tone: "danger", text: result.error } };
          return { ...s, ...result.data };
        });
        return { planId, error };
      },
      setClusterExcluded: (planId, clusterId, excluded) =>
        set((s) => ({
          ...s,
          plans: s.plans.map((plan) =>
            plan.id !== planId || plan.status !== "review"
              ? plan
              : { ...plan, clusters: plan.clusters.map((c) => (c.id === clusterId ? { ...c, excluded, selected: !excluded } : c)) },
          ),
        })),
      queueTopic: async (planId, opts) => {
        const s = get();
        const draft = snap(s);
        const plan = draft.plans.find((item) => item.id === planId);
        if (plan && plan.status === "review") {
          const anyOff = plan.clusters.some((cluster) => cluster.selected === false);
          if (anyOff) {
            for (const cluster of plan.clusters) cluster.excluded = cluster.selected === false || cluster.excluded;
          }
        }
        const site = draft.sites.find((item) => item.id === (plan?.siteId ?? s.activeSiteId));
        const keyId = opts?.modelKeyId && opts.modelKeyId !== "default" ? opts.modelKeyId : site?.voice.modelKeyId;
        const result = await queuePlan(draft, planId, Date.now(), {
          ...opts,
          provider: embeddingProvider(draft.keys.find((key) => key.id === keyId)).provider,
        });
        set((cur) => (result.error ? { ...cur, notice: { tone: "danger", text: result.error } } : { ...cur, ...result.data, ...mergePersisted(cur, result.data, CHURNED_COLLECTIONS) }));
        return result.runId;
      },
      stopRun: (runId) => set((s) => ({ ...s, ...cancelRun(snap(s), runId, Date.now()) })),
      retryJob: (jobId, fromScratch = false) =>
        set((s) => {
          const result = restartJob(snap(s), jobId, Date.now(), fromScratch);
          if (result.error) return { ...s, notice: { tone: "danger", text: result.error } };
          return { ...s, ...result.data };
        }),
      variantJob: (jobId) =>
        set((s) => {
          const job = s.jobs.find((item) => item.id === jobId);
          const article = job?.articleId ? s.articles.find((item) => item.id === job.articleId) : undefined;
          if (article) {
            return {
              ...s,
              notice: { tone: "info", text: "Regenerating this article. A new draft is written, then new photos are fetched." },
              articles: s.articles.map((item) =>
                item.id !== article.id
                  ? item
                  : {
                      ...item,
                      liveState: "pending" as const,
                      liveError: undefined,
                      imageState: "pending" as const,
                      imageSalt: (item.imageSalt ?? 0) + 1,
                      images: item.images.map((image) => ({ ...image, src: undefined, selected: false, remote: undefined })),
                    },
              ),
            };
          }
          const result = regenerateVariant(snap(s), jobId, Date.now());
          if (result.error) return { ...s, notice: { tone: "danger", text: result.error } };
          return { ...s, ...result.data };
        }),
      saveFtp: (providerId: "cpanel", ftp: { host: string; user: string; path: string; password: string; port?: number; publicUrl?: string; via?: "ftps" | "sftp" }) => {
        let saved = false;
        set((s) => {
          const host = ftp.host.trim();
          const user = ftp.user.trim();
          const current = s.sites.find((site) => site.id === s.activeSiteId)?.providers.find((provider) => provider.id === providerId)?.ftp;
          const password = ftp.password || current?.password || "";
          if (!host || !user || !password) {
            return { ...s, notice: { tone: "danger" as const, text: "FTP needs a hostname, username, and password before it can be saved." } };
          }
          saved = true;
          const path = ftp.path.trim() || "/";
          const hint = `${host} · ${user} · ${path}`;
          return {
            ...s,
            notice: { tone: "ok" as const, text: "FTP saved in this browser. Run Test connection before calling it verified." },
            sites: s.sites.map((site) =>
              site.id !== s.activeSiteId
                ? site
                : {
                    ...site,
                    publicUrl: ftp.publicUrl?.trim() || site.publicUrl,
                    providers: site.providers.map((provider) =>
                      provider.id === providerId
                        ? { ...provider, status: provider.status === "verified" ? "verified" : "configured", hint, ftp: { host, user, path, password, port: ftp.port || 21, publicUrl: ftp.publicUrl?.trim() || "", via: ftp.via || current?.via || "ftps" } }
                        : provider,
                    ),
                  },
            ),
          };
        });
        return saved;
      },
      connectStudio: () =>
        set((s) => {
          const now = Date.now();
          return {
            ...s,
            notice: { tone: "ok", text: "Studio ledger connected. Sync inventory before the first run." },
            sites: s.sites.map((site) =>
              site.id !== s.activeSiteId
                ? site
                : {
                    ...site,
                    ghost: {
                      ...site.ghost,
                      mode: "studio",
                      status: "connected",
                      url: site.ghost.url.startsWith("https://") ? site.ghost.url : `studio://${site.name.toLowerCase().replace(/\s+/g, "-")}`,
                      keyHint: site.ghost.adminKey ? site.ghost.keyHint : "local demo · Ghost was not read",
                      version: site.ghost.adminKey ? site.ghost.version : "local-demo",
                      inventorySource: site.ghost.adminKey ? site.ghost.inventorySource : "local-demo",
                      lastTestAt: now,
                      lastError: undefined,
                    },
                  },
            ),
          };
        }),
      disconnectGhost: () =>
        set((s) => ({
          ...s,
          notice: { tone: "warn", text: "Ghost disconnected. New runs are blocked until you reconnect and sync." },
          sites: s.sites.map((site) =>
            site.id !== s.activeSiteId
              ? site
              : {
                  ...site,
                  ghost: { ...site.ghost, mode: "off", status: "disconnected", corpus: "EMPTY", version: "", keyHint: "", url: "", adminKey: undefined },
                },
          ),
        })),
      markLive: (url, version, hint, adminKey) =>
        set((s) => ({
          ...s,
          notice: {
            tone: "ok",
            text: adminKey
              ? `Live Ghost answered · ${version}. The key stays in this browser so publish can upload images and POST once.`
              : `Live Ghost answered · ${version}. The Admin API key was not stored, so publish stays in the studio ledger.`,
          },
          sites: s.sites.map((site) =>
            site.id !== s.activeSiteId
              ? site
              : {
                  ...site,
                  ghost: {
                    ...site.ghost,
                    mode: "live",
                    status: "connected",
                    url,
                    version,
                    keyHint: hint,
                    adminKey: adminKey || undefined,
                    lastTestAt: Date.now(),
                    lastError: undefined,
                    corpus: "EMPTY",
                  },
                },
          ),
        })),
      failGhost: (message) =>
        set((s) => ({
          ...s,
          notice: { tone: "danger", text: message },
          sites: s.sites.map((site) =>
            site.id !== s.activeSiteId ? site : { ...site, ghost: { ...site.ghost, status: "error", lastError: message } },
          ),
        })),
      beginStudioSync: () => {
        const s = get();
        const site = s.sites.find((item) => item.id === s.activeSiteId);
        if (!site || site.ghost.status !== "connected") {
          set({ notice: { tone: "danger", text: "Connect Ghost before syncing." } });
          return;
        }
        const key = site.ghost.adminKey;
        const origin = site.ghost.url.startsWith("https://") ? site.ghost.url : "";
        if (key && origin) {
          set({
            notice: { tone: "info", text: "Reading every Ghost page…" },
            sites: s.sites.map((item) =>
              item.id !== site.id ? item : { ...item, ghost: { ...item.ghost, corpus: "SYNCING", syncReadyAt: undefined, lastError: undefined } },
            ),
          });
          void (async () => {
            const { syncGhostPosts } = await import("./ghost.functions");
            const result = await syncGhostPosts({ data: { url: origin, adminKey: key } });
            if (!result.ok) {
              get().failGhost(result.error);
              return;
            }
            get().applyLiveInventory(
              result.posts.map((post) => ({ ...post, status: post.status === "PUBLISHED" ? ("PUBLISHED" as const) : ("DRAFT" as const) })),
              result.truncated ? `Ghost import stopped at the page cap · ${result.posts.length} posts. There are more pages on the site.` : undefined,
            );
          })();
          return;
        }
        const now = Date.now();
        const inventory = inventoryFromArticles(s.articles, site.id, now);
        set({
          notice: {
            tone: "warn",
            text: "Local demo. No Ghost Admin key is saved, so this list is the studio's own articles. Ghost was not read.",
          },
          sites: s.sites.map((item) =>
            item.id !== site.id
              ? item
              : {
                  ...item,
                  ghost: {
                    ...item.ghost,
                    corpus: "COMPLETE",
                    syncReadyAt: undefined,
                    lastSyncAt: now,
                    inventory,
                    inventorySource: "local-demo",
                    version: item.ghost.version === "studio-ledger" || !item.ghost.version ? "local-demo" : item.ghost.version,
                    keyHint: "local demo · Ghost was not read",
                  },
                },
          ),
        });
      },
      applyLiveInventory: (posts, note) =>
        set((s) => {
          const now = Date.now();
          return {
            ...s,
            notice: {
              tone: note ? "warn" : "ok",
              text: note ?? `Ghost inventory synced · ${posts.length} posts across every page. Corpus is COMPLETE.`,
            },
            sites: s.sites.map((site) =>
              site.id !== s.activeSiteId
                ? site
                : {
                    ...site,
                    ghost: {
                      ...site.ghost,
                      corpus: "COMPLETE",
                      syncReadyAt: undefined,
                      lastSyncAt: now,
                      inventorySource: "ghost",
                      inventory: posts.map((post) => ({ ...post, status: post.status, syncedAt: now })),
                    },
                  },
            ),
          };
        }),
auditNow: () => {
        void (async () => {
          const s = get();
          // ... audit pipeline below; the final set upsert-merges so concurrent
          // user commits (a just-queued run) are never wiped by the audit pass.
          const site = s.sites.find((item) => item.id === s.activeSiteId);
          const next = await buildAudit(snap(s), s.activeSiteId, Date.now(), embeddingProvider(s.keys.find((key) => key.id === site?.voice.modelKeyId)).provider);
          set((cur) => ({ ...cur, ...next, ...mergePersisted(cur, next, CHURNED_COLLECTIONS) }));
        })();
      },
      toggleProposal: (auditId, proposalId) =>
        set((s) => ({
          ...s,
          audits: s.audits.map((audit) =>
            audit.id !== auditId
              ? audit
              : {
                  ...audit,
                  proposals: audit.proposals.map((p) => (p.id === proposalId ? { ...p, selected: !p.selected } : p)),
                },
          ),
        })),
      applyProposals: (auditId) => set((s) => ({ ...s, ...applyAudit(snap(s), auditId, Date.now()) })),
      patchSite: (patch) =>
        set((s) => ({
          ...s,
          sites: s.sites.map((site) => (site.id === s.activeSiteId ? { ...site, ...patch } : site)),
        })),
      patchVoice: (patch) =>
        set((s) => ({
          ...s,
          sites: s.sites.map((site) => (site.id === s.activeSiteId ? { ...site, voice: { ...site.voice, ...patch } } : site)),
        })),
      patchDefaults: (patch) => set((s) => ({ ...s, defaults: { ...s.defaults, ...patch } })),
      patchAccount: (patch) => set((s) => ({ ...s, account: { ...s.account, ...patch } })),
      addKey: (input) =>
        set((s) => {
          const id = uid("key");
          const secret = input.secret?.trim() ?? "";
          const tail = secret ? secret.slice(-4) : id.slice(-4);
          const baseUrl = input.baseUrl?.trim() ?? "";
          const model = input.model.trim() || "custom";
          const providerKind =
            input.providerKind ?? (baseUrl.includes("openrouter.ai") ? "openrouter" : baseUrl ? "custom" : "openai");
          const custom = providerKind === "custom";
          const catalog = catalogModel(input.catalogId);
          const pricePerM = input.pricePerM ?? (catalog ? blendedPricePerMillion(catalog) : pricePerMillionForModelId(model));
          const nextKey: AiKey = {
            id,
            provider: input.provider.trim() || "Custom",
            model,
            label: input.label?.trim() || input.provider.trim() || "Custom",
            hint: `••••${tail}`,
            priority: input.priority,
            chat: true,
            semantic: Boolean(embeddingModelFor({ provider: input.provider.trim(), providerKind, embeddingModel: input.embeddingModel })),
            allowanceUsd: input.allowanceUsd,
            disabled: false,
            pricePerM,
            baseUrl: baseUrl || undefined,
            secret: secret || undefined,
            kind: custom ? "custom" : "studio",
            providerKind,
            catalogId: input.catalogId,
            embeddingModel: input.embeddingModel?.trim() || undefined,
          };
          return {
            ...s,
            notice: {
              tone: "ok",
              text: custom
                ? "Custom endpoint saved in this browser. Set the base URL and key, then Test. The key is sent only when you test or generate."
                : `${input.label?.trim() || input.provider.trim() || "Key"} saved in this browser. It joins the failover pool by priority.`,
            },
            keys: [...s.keys, nextKey],
          };
        }),
      toggleKey: (id) =>
        set((s) => ({
          ...s,
          keys: s.keys.map((key) => (key.id === id ? { ...key, disabled: !key.disabled, cooldownUntil: key.disabled ? undefined : key.cooldownUntil } : key)),
        })),
      deleteKey: (id) =>
        set((s) => {
          const gone = s.keys.find((key) => key.id === id);
          if (!gone) return s;
          recordPurge("keys", id);
          return {
            ...s,
            keys: s.keys.filter((key) => key.id !== id),
            // A deleted key can no longer be a site default; runs fall back to the pool.
            sites: s.sites.map((site) =>
              site.voice.modelKeyId === id ? { ...site, voice: { ...site.voice, modelKeyId: "" } } : site,
            ),
            notice: {
              tone: "warn",
              text: `${gone.label} deleted from this browser. Usage ledger rows stay in Billing; saved runs keep their recorded key id.`,
            },
          };
        }),
      patchKey: (id, patch) =>
        set((s) => ({
          ...s,
          keys: s.keys.map((key) => (key.id === id ? { ...key, ...patch } : key)),
        })),
      patchLimits: (patch) =>
        set((s) => ({
          ...s,
          limits: { ...s.limits, ...patch },
          notice: { tone: "ok", text: "Scale limits saved. Caps apply to the next run." },
        })),
      setWebSearchMode: (mode) =>
        set((s) => ({
          ...s,
          webSearch: { ...s.webSearch, mode },
          notice: {
            tone: mode === "off" ? "warn" : "ok",
            text:
              mode === "off"
                ? "Live web search is off. Research and drafts stay offline."
                : mode === "auto-fallback"
                  ? "Web search: Auto-Fallback. Tavily runs first, Firecrawl catches failures."
                  : `Web search: ${mode}.`,
          },
        })),
      importWebSearchKeys: (provider, raw) => {
        const found = [
          ...new Set(
            raw
              .split(/[\s,;]+/)
              .map((item) => item.trim())
              .filter((item) => item.length >= 8 && !item.startsWith("#")),
          ),
        ].slice(0, 500);
        let added = 0;
        set((s) => {
          const list = provider === "tavily" ? s.webSearch.tavilyKeys : s.webSearch.firecrawlKeys;
          const existing = new Set(list.map((key) => key.secret));
          const next: WebSearchKey[] = found
            .filter((secret) => !existing.has(secret))
            .map((secret) => ({
              id: uid(provider === "tavily" ? "tvly" : "fcrl"),
              hint: `••••${secret.slice(-4)}`,
              secret,
              disabled: false,
              failCount: 0,
            }));
          added = next.length;
          const webSearch: WebSearchConfig =
            provider === "tavily"
              ? { ...s.webSearch, tavilyKeys: [...s.webSearch.tavilyKeys, ...next].slice(0, 500), mode: s.webSearch.mode === "off" ? "tavily" : s.webSearch.mode }
              : { ...s.webSearch, firecrawlKeys: [...s.webSearch.firecrawlKeys, ...next].slice(0, 500), mode: s.webSearch.mode === "off" ? "firecrawl" : s.webSearch.mode };
          return {
            ...s,
            webSearch,
            notice: { tone: "ok", text: `${provider} pool +${next.length}. Switch is now ${webSearch.mode}.` },
          };
        });
        return added;
      },
      clearWebSearchKeys: (provider) =>
        set((s) => ({
          ...s,
          webSearch:
            provider === "tavily"
              ? { ...s.webSearch, tavilyKeys: [], tavilyCursor: 0, mode: s.webSearch.mode === "tavily" ? "off" : s.webSearch.mode }
              : { ...s.webSearch, firecrawlKeys: [], firecrawlCursor: 0, mode: s.webSearch.mode === "firecrawl" ? "off" : s.webSearch.mode },
          notice: { tone: "warn", text: `${provider} keys cleared from this browser.` },
        })),
      setWebSearchKey: (id, patch) =>
        set((s) => ({
          ...s,
          webSearch: {
            ...s.webSearch,
            tavilyKeys: s.webSearch.tavilyKeys.map((key) => (key.id === id ? { ...key, ...patch } : key)),
            firecrawlKeys: s.webSearch.firecrawlKeys.map((key) => (key.id === id ? { ...key, ...patch } : key)),
          },
        })),
      takeWebSearchKey: (provider) => {
        const cfg = get().webSearch;
        const now = Date.now();
        const list = (provider === "tavily" ? cfg.tavilyKeys : cfg.firecrawlKeys).filter(
          (key) => !key.disabled && key.failCount < 4 && (!key.cooldownUntil || key.cooldownUntil <= now),
        );
        if (!list.length) return null;
        const cursor = provider === "tavily" ? cfg.tavilyCursor : cfg.firecrawlCursor;
        const picked = list[cursor % list.length]!;
        set((s) => ({
          webSearch:
            provider === "tavily"
              ? { ...s.webSearch, tavilyCursor: s.webSearch.tavilyCursor + 1 }
              : { ...s.webSearch, firecrawlCursor: s.webSearch.firecrawlCursor + 1 },
        }));
        return picked;
      },
      setFirecrawl: (secret) =>
        set((s) => {
          const trimmed = secret.trim();
          const nextKeys: WebSearchKey[] = trimmed
            ? [{ id: uid("fcrl"), hint: `••••${trimmed.slice(-4)}`, secret: trimmed, disabled: false, failCount: 0 }]
            : [];
          const mode: WebSearchMode = trimmed
            ? s.webSearch.mode === "off"
              ? "firecrawl"
              : s.webSearch.mode
            : s.webSearch.mode === "firecrawl"
              ? "off"
              : s.webSearch.mode;
          return {
            ...s,
            firecrawl: { secret: trimmed, hint: trimmed ? `••••${trimmed.slice(-4)}` : "" },
            webSearch: { ...s.webSearch, firecrawlKeys: nextKeys, mode },
            notice: { tone: "ok", text: trimmed ? "Firecrawl key saved in this browser." : "Firecrawl key removed." },
          };
        }),
      patchArticle: (id, patch) =>
        set((s) => {
          const current = s.articles.find((article) => article.id === id);
          if (!current) return s;
          if (Object.entries(patch).every(([key, value]) => Object.is(current[key as keyof Article], value))) return s;
          return {
            ...s,
            articles: s.articles.map((article) => (article.id === id ? { ...article, ...patch } : article)),
          };
        }),
      addExpertAuthor: (niche) =>
        set((s) => {
          const siteId = s.activeSiteId;
          const topic = niche.trim() || s.sites.find((site) => site.id === siteId)?.nicheTag || "general research";
          const author = generateAuthorForTopic(topic, siteId, { niche: s.sites.find((site) => site.id === siteId)?.nicheTag });
          author.origin = "manual";
          return {
            ...s,
            authors: [...s.authors, author],
            notice: {
              tone: "ok" as const,
              text: `Generated US expert ${author.name} for “${topic}”. Capacity ${author.articleCount}/${author.maxArticles}.`,
            },
          };
        }),
      patchAuthor: (id, patch) =>
        set((s) => ({
          ...s,
          authors: s.authors.map((author) => (author.id === id ? { ...author, ...patch } : author)),
        })),
      /** Client-side activity note (IndexNow hooks, humanizer policy, engine-adjacent workers). */
      logEvent: (siteId, tone, message) =>
        set((s) => ({
          ...s,
          activity: [{ id: uid("act"), at: Date.now(), siteId, tone, message }, ...s.activity].slice(0, 500),
        })),
      acceptModelStage: (jobId, stage, text, usage, promptVersion, verifyFlags) =>
        set((s) => ({
          ...s,
          jobs: s.jobs.map((job) =>
            job.id !== jobId
              ? job
              : {
                  ...job,
                  modelError: undefined,
                  modelText: stage === "intent" ? job.modelText : { ...job.modelText, [stage]: text },
                  modelUsage: { ...job.modelUsage, [stage]: usage },
                  // Rule 3a: the intent stage stores its parsed blueprint for stages 2–3.
                  modelIntent: stage === "intent" ? parseIntentStage(text) : job.modelIntent,
                  promptVersions: { ...job.promptVersions, [stage]: promptVersion },
                  modelVerifyFlags: stage === "revision" ? verifyFlags : job.modelVerifyFlags,
                  stages: job.stages.map((row) => row.key === stage ? { ...row, promptVersion } : row),
                },
          ),
        })),
      failModelStage: (jobId, message) =>
        set((s) => {
          const next = structuredClone(snap(s));
          failJob(next, jobId, message, Date.now());
          return { ...s, ...next };
        }),
      penalizeKey: (keyId, status, message) =>
        set((s) => {
          const next = structuredClone(snap(s));
          applyKeyPenalty(next, keyId, status, Date.now(), message);
          return { ...s, keys: next.keys, activity: next.activity, notice: next.notice ?? s.notice };
        }),
      clearCooldowns: () =>
        set((s) => {
          const cooled = s.keys.filter((key) => key.cooldownUntil || key.disabled);
          // Recover the whole key set: drop cooldowns AND re-enable anything a
          // previous auto-penalty disabled, so "Clear cooldown & retry" truly
          // restores every key to the pool.
          const keys = s.keys.map((key) =>
            key.cooldownUntil || key.disabled ? { ...key, cooldownUntil: undefined, disabled: false } : key,
          );
          // Re-queue every model-failed job so "Clear cooldown & retry" truly resumes work.
          let data = snap({ ...s, keys });
          const failed = data.jobs.filter((job) => job.status === "failed");
          for (const job of failed) {
            const result = restartJob(data, job.id, Date.now(), false);
            if (!result.error) data = { ...data, ...result.data };
          }
          return {
            ...s,
            keys,
            jobs: data.jobs,
            runs: data.runs,
            events: data.events,
            notice: { tone: "ok", text: `Recovered ${cooled.length} key${cooled.length === 1 ? "" : "s"} and re-queued ${failed.length} failed job${failed.length === 1 ? "" : "s"}.` },
          };
        }),
      ensureAuthors: () => {
        void (async () => {
          const s = get();
          const authors = [...s.authors];
          let changed = false;
          const articles = s.articles.map((article) => {
            if (article.authorId && authors.some((author) => author.id === article.authorId)) return article;
            changed = true;
            const author = attachAuthor({ authors }, article.siteId, article.keyword || article.title);
            return { ...article, authorId: author.id, authorName: author.name };
          });
          let dirty = changed;
          let next = snap(changed ? { ...s, authors, articles } : s);
          const lifted = liftOpenings(next);
          if (lifted) {
            next = lifted;
            dirty = true;
          }
          const scored = rescoreArticles(next);
          if (scored) {
            next = scored;
            dirty = true;
          }
          const now = Date.now();
          const siteKey = next.keys.find((key) => key.id === next.sites.find((item) => item.id === next.activeSiteId)?.voice.modelKeyId);
          const provider = embeddingProvider(siteKey).provider;
          for (const site of next.sites) {
            const woven = await weaveOrphans(next, site.id, now, true, provider);
            if (woven !== next) dirty = true;
            next = woven;
          }
          const queued = queueMissingPhotos(next);
          if (queued) {
            next = queued;
            dirty = true;
          }
          if (!dirty) return;
          set((cur) => ({ ...cur, ...next, ...mergePersisted(cur, next, CHURNED_COLLECTIONS) }));
        })();
      },
      weaveLinks: () => {
        void (async () => {
          const s = get();
          const site = s.sites.find((item) => item.id === s.activeSiteId);
          const next = await weaveOrphans(snap(s), s.activeSiteId, Date.now(), false, embeddingProvider(s.keys.find((key) => key.id === site?.voice.modelKeyId)).provider);
          set((cur) => ({ ...cur, ...next, ...mergePersisted(cur, next, CHURNED_COLLECTIONS) }));
        })();
      },
      buildSite: () => set((s) => ({ ...s, ...manualBuild(snap(s), s.activeSiteId, Date.now()) })),
      packageBuild: (buildId, providerId) => {
        let deployId: string | undefined;
        set((s) => {
          const result = packageDeploy(snap(s), buildId, Date.now(), { providerId });
          if (result.error) return { ...s, notice: { tone: "danger", text: result.error } };
          const deploy = result.data.deploys.find((item) => item.buildId === buildId);
          deployId = deploy?.id;
          return { ...s, ...result.data, ...(result.hold ? { notice: result.data.notice } : {}) };
        });
        return deployId;
      },
      acknowledgeRouteDiff: (deployId) =>
        set((s) => {
          const result = resolveRouteDiff(snap(s), deployId, "deploy-anyway", Date.now());
          return result.error ? { ...s, notice: { tone: "danger" as const, text: result.error } } : { ...s, ...result.data };
        }),
      rebuildForRouteDiff: (deployId) =>
        set((s) => {
          const result = resolveRouteDiff(snap(s), deployId, "rebuild", Date.now());
          return result.error ? { ...s, notice: { tone: "danger" as const, text: result.error } } : { ...s, ...result.data };
        }),
      saveProviderApi: (providerId, api) =>
        set((s) => ({
          ...s,
          sites: s.sites.map((site) =>
            site.id !== s.activeSiteId
              ? site
              : {
                  ...site,
                  providers: site.providers.map((provider) =>
                    provider.id === providerId
                      ? {
                          ...provider,
                          api: { ...provider.api, ...api, tokenHint: api.token ? `••••${api.token.slice(-4)}` : provider.api?.tokenHint },
                          status: api.token || provider.api?.token ? "configured" : provider.status,
                          hint: api.token || provider.api?.token ? `${provider.name} credentials saved locally. Verify before deploying.` : provider.hint,
                        }
                      : provider,
                  ),
                },
          ),
          notice: { tone: "ok", text: "Credentials saved in this browser only. Verify before deploying." },
        })),
      recordProbe: (deployId, ok, detail) => set((s) => ({ ...s, ...applyProbe(snap(s), deployId, ok, detail, Date.now()) })),
      verifyProvider: (providerId, hint) =>
        set((s) => {
          const provider = s.sites.find((site) => site.id === s.activeSiteId)?.providers.find((p) => p.id === providerId);
          // Rule 6: API adapters verify by credential presence; the live check happens on deploy + public URL probe.
          const apiReady = Boolean(provider?.api?.token);
          if (providerId !== "cpanel" && !apiReady) {
            return { ...s, notice: { tone: "warn" as const, text: `Save a ${providerId} token first — the adapter refuses to deploy without credentials.` } };
          }
          return {
            ...s,
            notice: {
              tone: "ok" as const,
              text: providerId === "cpanel" ? "cPanel marked verified after the FTP check." : `${providerId} credentials accepted. The next deploy proves the connection with a live probe.`,
            },
            sites: s.sites.map((site) =>
              site.id !== s.activeSiteId
                ? site
                : {
                    ...site,
                    providers: site.providers.map((p) => (p.id === providerId ? { ...p, status: "verified", hint: hint || p.hint } : p)),
                  },
            ),
          };
        }),
      disconnectProvider: (providerId) =>
        set((s) => ({
          ...s,
          sites: s.sites.map((site) =>
            site.id !== s.activeSiteId
              ? site
              : {
                  ...site,
                  providers: site.providers.map((p) => (p.id === providerId ? { ...p, status: "not_connected", hint: "" } : p)),
                },
          ),
        })),
      revokeSession: (id) =>
        set((s) => ({
          ...s,
          account: { ...s.account, sessions: s.account.sessions.filter((session) => session.current || session.id !== id) },
          notice: { tone: "ok", text: "Session revoked on this browser." },
        })),
      confirmPassphrase: async (passphrase) => {
        if (passphrase.trim().length < 8) {
          set((s) => ({ ...s, notice: { tone: "danger", text: "Use at least 8 characters." } }));
          return;
        }
        try {
          await lockWithPassphrase(passphrase);
        } catch {
          set((s) => ({ ...s, notice: { tone: "danger", text: "The passphrase could not be applied." } }));
          return;
        }
        set((s) => ({
          ...s,
          account: {
            ...s.account,
            passwordUpdatedAt: Date.now(),
            sessions: s.account.sessions.filter((session) => session.current),
          },
          notice: { tone: "ok", text: "Studio encrypted. The passphrase is not stored. A reload asks for it again." },
        }));
      },
      markActivityRead: (id) =>
        set((s) => ({
          ...s,
          activity: s.activity.map((item) => (item.id === id ? { ...item, read: true } : item)),
        })),
      markActivityReadAll: (siteId) =>
        set((s) => ({
          ...s,
          activity: s.activity.map((item) => (item.siteId === siteId ? { ...item, read: true } : item)),
        })),
      resetStudio: () => {
        // Server-authoritative reset: wipe the durable store first so another
        // window (or a fresh incognito context) can never resurrect old rows.
        lastServerGeneration = "";
        void resetAppState().then((result) => {
          lastServerGeneration = result.generation || "";
        }).catch(() => {});
        set({ ...emptyPersisted(), notice: { tone: "info", text: "Studio reset. Every workspace, key, and article was cleared across all devices." } });
      },
      setWorker: (paused) =>
        set((s) => ({
          ...s,
          workerPaused: paused,
          notice: {
            tone: paused ? "warn" : "ok",
            text: paused ? "Worker offline. Queued work is kept and continues when the worker is back." : "Worker online.",
          },
        })),
      decideJob: (jobId, approve) =>
        set((s) => {
          const result = decideReview(snap(s), jobId, approve, Date.now());
          if (result.error) return { ...s, notice: { tone: "danger", text: result.error } };
          return { ...s, ...result.data };
        }),
      releaseJob: (jobId) =>
        set((s) => {
          const result = releaseHeld(snap(s), jobId, Date.now());
          if (result.error) return { ...s, notice: { tone: "danger", text: result.error } };
          const pulsed = { ...s, ...result.data };
          for (const calendar of pulsed.calendars) {
            for (const item of calendar.items) {
              if (item.jobId === jobId) item.status = result.data.runs.find((run) => run.id === item.runId)?.publishMode === "live" ? "PUBLISHED" : "DRAFT_SAVED";
            }
          }
          return pulsed;
        }),
      saveProvider: (providerId, hint) =>
        set((s) => ({
          ...s,
          notice: { tone: "info", text: "Saved. A provider is deployable only after Test marks it verified." },
          sites: s.sites.map((site) =>
            site.id !== s.activeSiteId
              ? site
              : {
                  ...site,
                  providers: site.providers.map((provider) =>
                    provider.id === providerId ? { ...provider, status: "configured", hint: hint || provider.hint } : provider,
                  ),
                },
          ),
        })),
      createWorkspace: (name) =>
        set((s) => {
          const trimmed = name.trim();
          if (trimmed.length < 2) return { ...s, notice: { tone: "danger", text: "Name the workspace with at least 2 characters." } };
          const id = uid("site");
          const site: Site = {
            id,
            name: trimmed,
            createdAt: Date.now(),
            staticName: trimmed,
            nicheTag: "notes",
            publicUrl: "",
            logoUrl: "",
            faviconUrl: "",
            robots: "noindex,nofollow",
            footer: "",
            headerMenu: "",
            footerMenu: "",
            headHtml: "",
            bodyEnd: "",
            analyticsSnippet: "",
            autoRebuild: false,
            pendingRebuildAt: null,
            template: "minimal-authority",
            authors: trimmed,
            voice: { ...s.defaults, publishAs: "draft" },
            ghost: freshGhost(),
            providers: providers(),
            setupStep: 1,
            setupSkipped: false,
          };
          return {
            ...s,
            sites: [...s.sites, site],
            activeSiteId: id,
            activity: [
              { id: uid("act"), at: Date.now(), siteId: id, tone: "ok" as const, message: `Workspace "${trimmed}" created` },
              ...s.activity,
            ].slice(0, 40),
            notice: { tone: "ok", text: `Workspace "${trimmed}" created` },
          };
        }),
      deleteArticles: (ids) =>
        set((s) => {
          const drop = new Set(ids);
          const removed = s.articles.filter((article) => drop.has(article.id));
          if (!removed.length) return s;
          for (const id of ids) recordPurge("articles", id);
          const slugs = new Set(removed.map((article) => article.slug));
          return {
            ...s,
            articles: s.articles
              .filter((article) => !drop.has(article.id))
              .map((article) => ({
                ...article,
                links: article.links.filter((link) => !slugs.has(link.targetSlug)),
              })),
            notice: { tone: "warn", text: `Deleted ${removed.length} article${removed.length === 1 ? "" : "s"} from this studio. Ghost posts were not touched.` },
          };
        }),
      deleteWorkspace: (id) =>
        set((s) => {
          const busy =
            s.jobs.some((job) => job.siteId === id && (job.status === "queued" || job.status === "running")) ||
            s.runs.some((run) => run.siteId === id && (run.status === "queued" || run.status === "running"));
          if (busy) {
            return { ...s, notice: { tone: "danger", text: "Website has active runs, jobs, builds or deploys — cancel them first" } };
          }
          const sites = s.sites.filter((site) => site.id !== id);
          recordPurge("sites", id);
          const drop = <T extends { siteId: string }>(rows: T[]) => rows.filter((row) => row.siteId !== id);
          return {
            ...s,
            sites,
            activeSiteId: s.activeSiteId === id ? (sites[0]?.id ?? "") : s.activeSiteId,
            runs: drop(s.runs),
            jobs: drop(s.jobs),
            articles: drop(s.articles),
            plans: drop(s.plans),
            calendars: drop(s.calendars),
            research: drop(s.research),
            authors: drop(s.authors),
            builds: drop(s.builds),
            deploys: drop(s.deploys),
            audits: drop(s.audits),
            events: drop(s.events),
            activity: drop(s.activity),
            backups: s.backups.filter((item) => item.siteId !== id),
            ideas: s.ideas?.siteId === id ? null : s.ideas,
            notice: { tone: "warn", text: "Workspace deleted" },
          };
        }),
      createBackup: () =>
        set((s) => {
          const packed = packWorkspace(snap(s), s.activeSiteId);
          if (!packed) return { ...s, notice: { tone: "danger", text: "No workspace to back up." } };
          const row: WorkspaceBackup = {
            id: uid("bak"),
            siteId: s.activeSiteId,
            siteName: packed.siteName,
            at: Date.now(),
            articles: packed.articles,
            edges: packed.edges,
            bytes: packed.bytes,
            checksum: packed.checksum,
            verified: null,
            payload: packed.payload,
          };
          const kb = Math.max(1, Math.round(packed.bytes / 1024));
          return {
            ...s,
            backups: [row, ...s.backups].slice(0, 3),
            notice: {
              tone: "ok",
              text: `Backup created — ${packed.articles} articles, ${packed.edges} link edges (${kb} KB)`,
            },
          };
        }),
      verifyBackup: (id) =>
        set((s) => {
          const row = s.backups.find((item) => item.id === id);
          if (!row) return s;
          const checked = readBackup(row.payload);
          return {
            ...s,
            backups: s.backups.map((item) => (item.id === id ? { ...item, verified: checked.ok } : item)),
            notice: {
              tone: checked.ok ? "ok" : "danger",
              text: checked.ok ? `Verified — ${row.articles} articles, checksum ${row.checksum}` : checked.error,
            },
          };
        }),
      restoreWorkspace: (raw) =>
        set((s) => {
          const checked = readBackup(raw);
          if (!checked.ok) {
            return { ...s, notice: { tone: "danger" as const, text: checked.error } };
          }
          return { ...mergeBackup(s, checked.file), notice: { tone: "ok", text: backupNotice(s, checked.file) } };
        }),
      setSetup: (step) =>
        set((s) => ({
          ...s,
          sites: s.sites.map((site) =>
            site.id !== s.activeSiteId
              ? site
              : {
                  ...site,
                  setupStep: step,
                  setupSkipped: step >= 8 || step < 1,
                },
          ),
        })),
      setKeyAllowance: (id, allowanceUsd) =>
        set((s) => ({
          ...s,
          keys: s.keys.map((key) => (key.id === id ? { ...key, allowanceUsd: Math.max(0, allowanceUsd) } : key)),
          notice: { tone: "ok", text: "Daily limit saved on this key." },
        })),
      createCalendar: (input) => {
        let id: string | undefined;
        set((s) => {
          const name = input.name.trim();
          if (name.length < 2) return { ...s, notice: { tone: "danger", text: "Name the calendar with at least 2 characters." } };
          const plan = s.plans.find((item) => item.id === input.planId && item.siteId === s.activeSiteId);
          const fromPlan = plan
            ? [
                { title: plan.pillarTitle, angle: plan.pillarAngle, kind: "pillar" as const },
                ...plan.clusters.filter((cluster) => !cluster.excluded).map((cluster) => ({ title: cluster.title, angle: cluster.angle, kind: "cluster" as const })),
              ]
            : [];
          const fromLines = (input.lines ?? "")
            .split("\n")
            .map((line) => line.trim())
            .filter((line) => line.length >= 3)
            .map((title) => ({ title, angle: "Scheduled from the calendar", kind: "keyword" as const }));
          const topics = fromPlan.length ? fromPlan : fromLines;
          if (!topics.length) return { ...s, notice: { tone: "danger", text: "Add a topic plan or one title per line." } };
          const calendar = buildCalendar({
            siteId: s.activeSiteId,
            name,
            timezone: input.timezone || "UTC",
            activeDays: input.activeDays.length ? input.activeDays : [1, 3, 5],
            articlesPerWeek: input.articlesPerWeek,
            publishTime: input.publishTime,
            generationLeadHours: input.generationLeadHours,
            order: input.order,
            publishMode: input.publishMode ?? "published",
            planningRangeDays: input.planningRangeDays,
            topics,
            sourcePlanId: plan?.id,
            now: Date.now(),
          });
          id = calendar.id;
          return {
            ...s,
            calendars: [calendar, ...s.calendars],
            notice: { tone: "ok", text: `${calendar.items.length} articles scheduled (write_at ${calendar.generationLeadHours}h before publish_at). The 3 automation switches start OFF.` },
          };
        });
        return id;
      },
      patchCalendar: (id, patch) =>
        set((s) => ({
          ...s,
          calendars: s.calendars.map((calendar) => {
            if (calendar.id !== id) return calendar;
            const merged: ContentCalendar = { ...calendar, ...patch };
            // Schedule changes recompute write_at (write_at !== publish_at) and both summary strings.
            if (patch.generationLeadHours != null || patch.publishTime != null || patch.activeDays != null || patch.articlesPerWeek != null) {
              merged.items = merged.items.map((item) =>
                item.status === "SCHEDULED" ? { ...item, writeAt: item.publishAt - merged.generationLeadHours * 3600000 } : item,
              );
            }
            if (patch.autoGenerate || patch.autoPublish || patch.autoReweave) merged.mode = "AUTOMATED";
            else if (calendar.mode === "AUTOMATED" && !merged.autoGenerate && !merged.autoPublish && !merged.autoReweave) merged.mode = "MANUAL";
            return withSummaries(merged);
          }),
        })),
      patchCalendarItem: (calendarId, itemId, patch) =>
        set((s) => ({
          ...s,
          calendars: s.calendars.map((calendar) => {
            if (calendar.id !== calendarId) return calendar;
            return withSummaries({
              ...calendar,
              items: calendar.items.map((item) => {
                if (item.id !== itemId) return item;
                if (item.status !== "SCHEDULED" && item.status !== "SKIPPED") return item;
                const publishAt = patch.publishAt ?? item.publishAt;
                const status = patch.status ?? item.status;
                return {
                  ...item,
                  status,
                  publishAt,
                  writeAt: publishAt - calendar.generationLeadHours * 3600000,
                };
              }),
            });
          }),
        })),
      removeCalendarItem: (calendarId, itemId) =>
        set((s) => ({
          ...s,
          calendars: s.calendars.map((calendar) =>
            calendar.id === calendarId
              ? withSummaries({ ...calendar, items: calendar.items.filter((item) => item.id !== itemId || (item.status !== "SCHEDULED" && item.status !== "SKIPPED")) })
              : calendar,
          ),
        })),
      writeCalendarItem: (calendarId, itemId) => {
        void (async () => {
          const result = await queueCalendarItem(snap(get()), calendarId, itemId, Date.now());
          set((cur) => (result.error ? { ...cur, notice: { tone: "danger", text: result.error } } : { ...cur, ...result.data, ...mergePersisted(cur, result.data, CHURNED_COLLECTIONS) }));
        })();
      },
      publishCalendarItem: (calendarId, itemId) => {
        const result = publishCalendarItemNow(snap(get()), calendarId, itemId, Date.now());
        set((cur) => (result.error ? { ...cur, notice: { tone: "danger", text: result.error } } : { ...cur, ...result.data, notice: { tone: "ok", text: cur.calendars.find((calendar) => calendar.id === calendarId)?.publishMode === "draft" ? "Draft saved on the CMS." : "Published to the CMS." } }));
      },
      fillCalendarFromPlan: (calendarId, planId) =>
        set((s) => {
          const calendar = s.calendars.find((item) => item.id === calendarId);
          const plan = s.plans.find((item) => item.id === planId && item.siteId === calendar?.siteId);
          if (!calendar || !plan) return { ...s, notice: { tone: "danger", text: "That calendar or topic plan is not in this workspace." } };
          const existing = new Set(calendar.items.map((item) => item.title.toLowerCase()));
          const candidates = [
            { title: plan.pillarTitle, angle: plan.pillarAngle, kind: "pillar" as const },
            ...plan.clusters.filter((cluster) => !cluster.excluded).map((cluster) => ({ title: cluster.title, angle: cluster.angle, kind: "cluster" as const })),
          ].filter((topic) => !existing.has(topic.title.toLowerCase()));
          if (!candidates.length) return { ...s, notice: { tone: "info", text: "Every topic in that plan is already on this calendar." } };
          const [hour, minute] = calendar.publishTime.split(":").map((part) => Number(part) || 0);
          const after = calendar.items.reduce((max, item) => Math.max(max, item.publishAt), Date.now());
          const slots = publishSlots({
            count: candidates.length,
            days: calendar.activeDays,
            perWeek: calendar.articlesPerWeek,
            hour: hour ?? 9,
            minute: minute ?? 0,
            timeZone: calendar.timezone,
            from: after,
          });
          const added = candidates.slice(0, slots.length).map((topic, index) => ({
            id: uid("slot"),
            title: topic.title,
            angle: topic.angle,
            kind: topic.kind,
            publishAt: slots[index]!,
            writeAt: slots[index]! - calendar.generationLeadHours * 3600000,
            status: "SCHEDULED" as const,
          }));
          const unscheduled = candidates.length - added.length;
          return {
            ...s,
            calendars: s.calendars.map((item) => (item.id === calendarId ? withSummaries({ ...item, items: [...item.items, ...added] }) : item)),
            notice: {
              tone: unscheduled ? "warn" : "ok",
              text: `${added.length} scheduled${unscheduled ? ` · ${unscheduled} unscheduled (beyond the planning window — extend days/week or reschedule)` : ""}.`,
            },
          };
        }),
      addResearch: (niche, notes, breadth) => {
        let id: string | undefined;
        set((s) => {
          const site = siteOf(s);
          if (!site) return s;
          if (niche.trim().length < 3) return { ...s, notice: { tone: "danger", text: "Describe the niche in at least 3 characters." } };
          const now = Date.now();
          const project = newResearchProject({ siteId: site.id, niche, notes, breadth: breadth ?? "standard", now, site, data: snap(s) });
          id = project.id;
          return { ...s, research: [project, ...s.research], notice: { tone: "ok", text: "Research project created — the 11-stage engine is starting. Nothing is queued from research." } };
        });
        if (id) void (async () => { await get().runResearch(id!); })();
        return id;
      },
      /** Rule 4 key pool + research engine: runs stages, metering each model call honestly. */
      runResearch: async (researchId) => {
        const state = get();
        const project = state.research.find((item) => item.id === researchId);
        if (!project || project.archived) return;
        const site = state.sites.find((item) => item.id === project.siteId) ?? siteOf(state);
        if (!site) return;
        const pool = keyPool(state, site.voice.modelKeyId, Date.now()).filter((key) => keyCallsModel(key));
        const data = structuredClone(snap(get()));
        if (!data.research.find((item) => item.id === researchId)) return;
        const chat: ResearchChat | undefined = pool.length
          ? async ({ system, user }) => {
              const outcome = await runWithKeyPool({
                keys: pool,
                onPenalty: (keyId, status, error) => useApp.getState().penalizeKey(keyId, status, error),
                call: async (key) => {
                  const result = await generateDraft({ data: { baseUrl: key.baseUrl!, apiKey: key.secret!, model: key.model, system, user } });
                  if (result.ok) return { ok: true as const, value: result };
                  return { ok: false as const, status: result.status ?? 0, error: result.error };
                },
              });
              if (!outcome.ok) return { ok: false as const, error: outcome.error };
              const key = data.keys.find((item) => item.id === outcome.keyId) ?? pool[0]!;
              // Honest metering: research stage usage lands in the same SETTLED ledger as article stages.
              data.events.unshift({
                id: uid("evt"),
                pairId: `res_${researchId}:${outcome.keyId}:${Date.now()}`,
                siteId: site.id,
                keyId: key.id,
                at: Date.now(),
                state: "SETTLED",
                provider: key.provider,
                model: key.model,
                stage: "research",
                tokens: outcome.value.usage.total,
                usd: usdFor(outcome.value.usage.total, key.pricePerM),
              });
              return { ok: true as const, text: outcome.value.text, usage: outcome.value.usage };
            }
          : undefined;
        await runResearch(data, researchId, chat, Date.now());
        set((cur) => ({
          ...cur,
          research: cur.research.map((item) => (item.id === researchId ? data.research.find((row) => row.id === researchId) ?? item : item)),
          events: data.events,
          notice: {
            tone: "ok" as const,
            text: researchNoticeText(data.research.find((row) => row.id === researchId)!),
          },
        }));
      },
      retryResearchStage: (researchId, stageKey) => {
        set((s) => {
          const next = structuredClone(snap(s));
          const changed = rerunFailedStages(next, researchId, stageKey);
          if (!changed) return s;
          return { ...next };
        });
        void (async () => { await get().runResearch(researchId); })();
      },
      archiveResearch: (researchId) =>
        set((s) => ({
          ...s,
          research: s.research.map((project) => (project.id === researchId ? { ...project, archived: !project.archived } : project)),
        })),
      queuePlanFromResearch: (researchId) => {
        let planId: string | undefined;
        set((s) => {
          const next = structuredClone(snap(s));
          const result = planFromResearch(next, researchId, Date.now());
          if (result.error) {
            return { ...s, notice: { tone: "danger" as const, text: result.error } };
          }
          planId = result.planId;
          return { ...next, notice: { tone: "ok" as const, text: "Topic plan built from the research clusters. Review and queue it." } };
        });
        return planId;
      },
      updateCluster: (planId, clusterId, patch) =>
        set((s) => ({
          ...s,
          plans: s.plans.map((plan) =>
            plan.id !== planId || plan.status !== "review"
              ? plan
              : { ...plan, clusters: plan.clusters.map((cluster) => (cluster.id === clusterId ? { ...cluster, ...patch } : cluster)) },
          ),
        })),
      moveCluster: (planId, clusterId, direction) =>
        set((s) => ({
          ...s,
          plans: s.plans.map((plan) => {
            if (plan.id !== planId || plan.status !== "review") return plan;
            const index = plan.clusters.findIndex((cluster) => cluster.id === clusterId);
            const next = index + direction;
            if (index < 0 || next < 0 || next >= plan.clusters.length) return plan;
            const clusters = [...plan.clusters];
            const [row] = clusters.splice(index, 1);
            clusters.splice(next, 0, row!);
            return { ...plan, clusters };
          }),
        })),
      removeCluster: (planId, clusterId) =>
        set((s) => ({
          ...s,
          plans: s.plans.map((plan) =>
            plan.id !== planId || plan.status !== "review" ? plan : { ...plan, clusters: plan.clusters.filter((cluster) => cluster.id !== clusterId) },
          ),
        })),
      addCluster: (planId, title, angle, pillar) =>
        set((s) => ({
          ...s,
          plans: s.plans.map((plan) => {
            if (plan.id !== planId || plan.status !== "review") return plan;
            if (title.trim().length < 3) return plan;
            if (pillar) {
              return { ...plan, pillarTitle: title.trim(), pillarAngle: angle.trim() || plan.pillarAngle };
            }
            return {
              ...plan,
              clusters: [
                ...plan.clusters,
                { id: uid("clu"), title: title.trim(), angle: angle.trim() || "You wrote this", excluded: false, source: "you" as const, selected: true },
              ],
            };
          }),
        })),
    }),
    {
      name: "gaw-v2",
      version: 13,
      skipHydration: true,
      storage: createJSONStorage(() => durableStorage),
      migrate: (persisted, version) => migratePersistedSnapshot(persisted as Persisted, version),
      partialize: (s) => snap(s),
    },
  ),
);

/**
 * Normalizes any persisted snapshot (IndexedDB mirror or the server database)
 * to the current shape. Runs on every hydration path so both sources behave
 * identically.
 */
function migratePersistedSnapshot(persisted: Persisted, version?: number): Persisted {
        const data = persisted as Persisted;
        // Persist v13 (production server store): REMOVE every hard-coded demo
        // workspace/seed row a previous release shipped. Fresh installs and
        // upgrades must both land on zero demo data.
        if ((version ?? 0) < 13) {
          const seedSiteIds = new Set(["site_northline", "site_field"]);
          data.sites = (data.sites ?? []).filter((site) => !seedSiteIds.has(site.id));
          data.keys = (data.keys ?? []).filter((key) => key.id !== "key_studio");
          const seedArticleIds = new Set(["art_scope", "art_cadence", "art_links"]);
          data.articles = (data.articles ?? []).filter((article) => !seedArticleIds.has(article.id));
          const seedJobIds = new Set(["job_scope", "job_cadence", "job_links"]);
          data.jobs = (data.jobs ?? []).filter((job) => !seedJobIds.has(job.id));
          data.runs = (data.runs ?? []).filter((run) => run.id !== "run_seed");
          data.builds = (data.builds ?? []).filter((build) => build.id !== "bld_seed");
          data.events = (data.events ?? []).filter((event) => !event.id.startsWith("evt_hist_"));
          data.activity = (data.activity ?? []).filter((row) => row.id !== "act_1" && row.id !== "act_2");
          if (seedSiteIds.has(data.activeSiteId)) data.activeSiteId = data.sites[0]?.id ?? "";
        }
        data.limits = { ...DEFAULT_LIMITS, ...(data.limits ?? {}) };
        // Persist v11: keys are unlimited by default again. Clear every stale
        // local block a previous run left on a saved key (auto-disabled from an
        // old 401, a leftover cooldown, or a key flagged non-chat) so an
        // existing key is never filtered out by old ledger state. The allowance
        // ledger is advisory only and no longer gates the pool.
        for (const key of data.keys ?? []) {
          key.disabled = false;
          key.cooldownUntil = undefined;
          key.chat = true;
        }
        // Persist v12: never ship a placeholder CMS image path. Rewrite every
        // stored /content/images/ (cms.*) cover — and any such URL baked into
        // the article html/markdown from an old Ghost round-trip — into a valid
        // topic-matched Bing thumbnail.
        sanitizeArticleImages(data.articles);
        data.webSearch ??= { mode: "off", tavilyKeys: [], firecrawlKeys: [], tavilyCursor: 0, firecrawlCursor: 0 };
        data.webSearch.tavilyKeys ??= [];
        data.webSearch.firecrawlKeys ??= [];
        data.webSearch.tavilyCursor ??= 0;
        data.webSearch.firecrawlCursor ??= 0;
        if (data.firecrawl?.secret && !data.webSearch.firecrawlKeys.length) {
          data.webSearch.firecrawlKeys = [{ id: uid("fcrl"), hint: `••••${data.firecrawl.secret.slice(-4)}`, secret: data.firecrawl.secret, disabled: false, failCount: 0 }];
          if (data.webSearch.mode === "off") data.webSearch.mode = "firecrawl";
        }
        data.authors ??= [];
        // Rule 3 (persist v9): legacy fact-only research projects gain the 11-stage shape.
        data.research ??= [];
        data.research = (data.research as ResearchProject[]).map((project) => normalizeResearchProject(project));
        // Rule 2 (persist v8): upgrade every stored author to the smart-author shape without data loss.
        {
          const counts = new Map<string, number>();
          for (const article of data.articles ?? []) {
            if (!article.authorId) continue;
            counts.set(article.authorId, (counts.get(article.authorId) ?? 0) + 1);
          }
          data.authors = (data.authors as AuthorProfile[]).map((author) => {
            const fixed = normalizeAuthorProfile(author, counts);
            if (fixed.articleCount === 0 && counts.has(author.id)) fixed.articleCount = counts.get(author.id)!;
            return fixed;
          });
        }
        for (const article of data.articles ?? []) {
          const author = data.authors.find((item) => item.id === article.authorId);
          if (author && article.authorName !== author.name) article.authorName = author.name;
        }
        data.firecrawl ??= { secret: "", hint: "" };
        data.calendars ??= [];
        // Rule 6 (persist v10): calendars move to the live contract losslessly.
        data.calendars = (data.calendars as (ContentCalendar & Record<string, unknown>)[]).map((calendar) => migrateCalendar(calendar));
        data.workerPaused ??= false;
        data.worker ??= { lastBeatAt: 0, online: false, activeJobs: 0, source: "browser" };
        data.backups ??= [];
        data.corpus ??= [];
        for (const build of data.builds ?? []) {
          build.includedIds ??= [];
          build.excluded ??= [];
          build.artifact ??= [];
        }
        if (data.ideas && data.ideas.filtered == null) data.ideas.filtered = 0;
        for (const idea of data.ideas?.items ?? []) {
          if (!idea.intent) idea.intent = "guide";
        }
        for (const site of data.sites ?? []) {
          if (!site.voice?.imageProvider || site.voice.imageProvider === "studio-plates") site.voice.imageProvider = "bing";
          site.voice.bannedPhrases ??= [];
          site.voice.brandFacts ??= [];
          site.voice.pov ??= "third-person";
          site.voice.readingLevel ??= "general";
          site.autoAuthors ??= true;
          // Rule 6: ad settings exist on every site, always with all 7 slots.
          site.adsEnabled ??= false;
          site.adsTxt ??= "";
          const existing = Array.isArray(site.ads) ? site.ads : [];
          site.ads = AD_SLOT_IDS.map((id) => {
            const found = existing.find((slot) => slot.id === id);
            const fallback = defaultAdSlots().find((slot) => slot.id === id)!;
            if (!found) return fallback;
            return {
              ...fallback,
              ...found,
              position: found.position ?? fallback.position,
              name: found.name || fallback.name,
              code: typeof found.code === "string" && new TextEncoder().encode(found.code).length <= AD_CODE_LIMIT ? found.code : "",
            };
          });
        }
        data.defaults.bannedPhrases ??= [];
        data.defaults.brandFacts ??= [];
        data.defaults.pov ??= "third-person";
        data.defaults.readingLevel ??= "general";
        for (const audit of data.audits ?? []) audit.orphans ??= 0;
        for (const article of data.articles ?? []) {
          if (!article.imageState) article.imageState = article.images?.some((image) => image.src) ? "ready" : "pending";
        }
        if ((version ?? 0) < 6 && data.account) {
          data.account.adminApproved = false;
          data.account.emailVerified = false;
          data.account.emailProvider ??= { vendor: "resend" as const, secret: "", from: "" };
        }
  return data;
}

// ---------------------------------------------------------------------------
// Server-side persistence (production overhaul)
//
// The server database (.data/appstate.json) is the SINGLE SOURCE OF TRUTH:
// - hydration loads the server snapshot on boot (Incognito windows,
//   other browsers and machines all load the exact same workspaces, AI keys,
//   runs, and articles);
// - every store change is pushed to the server (debounced) with tombstones for
//   deletions so nothing is resurrected;
// - a slow pull merges server updates back so window A's workspaces appear in
//   window B within seconds.
// AI-key secrets etc. are AES-256-GCM encrypted at rest on the server
// (server-store.server.ts); the local IndexedDB mirror stays as an offline
// fallback only.
// ---------------------------------------------------------------------------

let lastServerGeneration = "";
let serverSyncStarted = false;
let serverPullStarted = false;
let pullInFlight = false;
let hydratingServer: Promise<void> | null = null;

const purgeRegistry: { sites: Set<string>; keys: Set<string>; articles: Set<string> } = { sites: new Set(), keys: new Set(), articles: new Set() };

/** Deleted rows are tombed so another window's next save cannot resurrect them. */
function recordPurge(kind: "sites" | "keys" | "articles", id: string): void {
  purgeRegistry[kind].add(id);
}

function drainPurges(): { sites?: string[]; keys?: string[]; articles?: string[] } {
  const out: { sites?: string[]; keys?: string[]; articles?: string[] } = {};
  for (const key of ["sites", "keys", "articles"] as const) {
    if (purgeRegistry[key].size) {
      out[key] = [...purgeRegistry[key]];
      purgeRegistry[key].clear();
    }
  }
  return out;
}

function keyPoolSnapshot(preferredKeyId: string | undefined) {
  const state = snap(useApp.getState());
  return { state, keys: keyPool(state, preferredKeyId, Date.now()) };
}

/** Key-pool LLM transport: sequential failover + one validation retry. */
const chatTransport: ChatTransport = {
  async callModel({ system, user, validate, preferredKeyId }) {
    const pool = (modifiedUser: string) => {
      const { keys } = keyPoolSnapshot(preferredKeyId);
      return runWithKeyPool({
        keys,
        onPenalty: (keyId, status, error) => useApp.getState().penalizeKey(keyId, status, error),
        call: async (key) => {
          const result = await generateDraft({ data: { baseUrl: key.baseUrl!, apiKey: key.secret!, model: key.model, system, user: modifiedUser } });
          if (result.ok) return { ok: true as const, value: result };
          return { ok: false as const, status: result.status ?? 0, error: result.error };
        },
      });
    };
    const first = await pool(user);
    if (!first.ok) throw new Error(first.error);
    const problem = validate(first.value.text);
    if (!problem) return { keyId: first.keyId, text: first.value.text, usage: first.value.usage };
    const retry = await pool(`${user}\n\nThe previous response was rejected: ${problem} Return valid JSON only, no markdown fences.`);
    if (!retry.ok) throw new Error(retry.error);
    const secondProblem = validate(retry.value.text);
    if (secondProblem) throw new Error(secondProblem);
    return { keyId: retry.keyId, text: retry.value.text, usage: retry.value.usage };
  },
  async bladerChat(system, user) {
    const { keys } = keyPoolSnapshot(undefined);
    const outcome = await runWithKeyPool({
      keys: keys.filter((key) => keyCallsModel(key)),
      onPenalty: (keyId, status, error) => useApp.getState().penalizeKey(keyId, status, error),
      call: async (key) => {
        const result = await generateDraft({ data: { baseUrl: key.baseUrl!, apiKey: key.secret!, model: key.model, system, user } });
        if (result.ok) return { ok: true as const, value: result.text };
        return { ok: false as const, status: result.status ?? 0, error: result.error };
      },
    });
    if (!outcome.ok) return { ok: false as const, error: outcome.error };
    return { ok: true as const, text: outcome.value, keyId: outcome.keyId };
  },
};

const imageTransport: ImageTransport = {
  placeImages: (input) => placeImages({ data: input }),
};

/**
 * Cross-window pull competition rules.
 * Equality is CONTENT equality (sync markers ignored): a pull whose rows are
 * byte-identical to the local rows keeps the local object references so
 * zustand subscribers never re-render. A row whose content differs is server
 * truth (someone saved it) and replaces the local copy.
 */
function jsonSame(a: unknown, b: unknown): boolean {
  if (a === b) return true;
  if (!a || !b || typeof a !== "object" || typeof b !== "object") return false;
  return JSON.stringify(a) === JSON.stringify(b);
}

function mergeRemoteRows<T extends { id: string }>(local: T[], incoming: T[]): T[] {
  let changed = false;
  const byId = new Map(local.map((row) => [row.id, row]));
  for (const row of incoming) {
    const hit = byId.get(row.id);
    if (hit) {
      if (!jsonSame(hit, row)) {
        byId.set(row.id, row);
        changed = true;
      }
    } else {
      byId.set(row.id, row);
      changed = true;
    }
  }
  return changed ? ([...byId.values()] as T[]) : local;
}

function stampedConfig<T>(local: T, incoming: T | undefined): { value: T; changed: boolean } {
  if (incoming === undefined || jsonSame(local, incoming)) return { value: local, changed: false };
  return { value: incoming, changed: true };
}

function ingestRemote(remoteRaw: unknown): void {
  if (!remoteRaw || typeof remoteRaw !== "object") return;
  const migrated = migratePersistedSnapshot(structuredClone(remoteRaw) as Persisted);
  // Work on a shallow copy so the live state object is never mutated in place.
  const cur = { ...useApp.getState() } as AppState;
  // Auto-reload fix: compute the merge FIRST and skip useApp.setState entirely
  // when the server snapshot is content-identical to local state. A pull that
  // swapped object identities every 5s re-rendered (and effect-re-fired) the
  // whole shell — the "auto reload" churn.
  let changed = false;

  for (const key of CHURNED_COLLECTIONS) {
    const localList = cur[key] as unknown as { id: string }[];
    const incomingList = migrated[key] as unknown as { id: string }[];
    if (key === "jobs") continue; // handled below with pipeline-progress rule
    const merged = mergeRemoteRows(localList, incomingList);
    if (merged !== localList) {
      (cur as Record<string, unknown>)[key] = merged;
      changed = true;
    }
  }
  // Jobs: incoming wins only when its pipeline progress is fresher; identical
  // jobs keep their local references.
  {
    const localList = cur.jobs;
    const incomingList = migrated.jobs;
    const byId = new Map(localList.map((row) => [row.id, row]));
    let jobsChanged = false;
    for (const row of incomingList) {
      const hit = byId.get(row.id);
      if (hit) {
        if (jsonSame(hit, row)) continue;
        if (jobProgressValue(row) >= jobProgressValue(hit)) {
          byId.set(row.id, row);
          jobsChanged = true;
        }
      } else {
        byId.set(row.id, row);
        jobsChanged = true;
      }
    }
    if (jobsChanged) {
      cur.jobs = [...byId.values()];
      changed = true;
    }
  }

  const sites = mergeRemoteRows(cur.sites, migrated.sites);
  if (sites !== cur.sites) {
    cur.sites = sites;
    changed = true;
  }
  const keys = mergeRemoteRows(cur.keys, migrated.keys);
  if (keys !== cur.keys) {
    cur.keys = keys;
    changed = true;
  }

  const limitsPatch = stampedConfig(cur.limits, migrated.limits);
  if (limitsPatch.changed) {
    cur.limits = limitsPatch.value;
    changed = true;
  }
  const defaultsPatch = stampedConfig(cur.defaults, migrated.defaults);
  if (defaultsPatch.changed) {
    cur.defaults = defaultsPatch.value;
    changed = true;
  }
  const webSearchPatch = stampedConfig(cur.webSearch, migrated.webSearch);
  if (webSearchPatch.changed) {
    cur.webSearch = webSearchPatch.value;
    changed = true;
  }
  const firecrawlPatch = stampedConfig(cur.firecrawl, migrated.firecrawl);
  if (firecrawlPatch.changed) {
    cur.firecrawl = firecrawlPatch.value;
    changed = true;
  }
  const accountPatch = stampedConfig(cur.account, migrated.account);
  if (accountPatch.changed) {
    cur.account = accountPatch.value;
    changed = true;
  }
  if (migrated.workerPaused !== cur.workerPaused) {
    cur.workerPaused = migrated.workerPaused;
    changed = true;
  }

  // Restore the pointer to the active workspace after a fresh boot (local
  // starts with no selection; the hydrated pointer or the first workspace wins).
  const localActiveValid = cur.activeSiteId !== "" && cur.sites.some((site) => site.id === cur.activeSiteId);
  if (!localActiveValid) {
    const nextActive = cur.sites.some((site) => site.id === migrated.activeSiteId)
      ? migrated.activeSiteId
      : cur.sites[0]?.id;
    if (nextActive && nextActive !== cur.activeSiteId) {
      cur.activeSiteId = nextActive;
      changed = true;
    }
  }

  if (!changed) return; // zero-op pull — no subscribers woken, no echo save
  useApp.setState(cur as AppState);
}

/** Pull the server snapshot; called on boot and periodically for cross-window sync. */
async function pullServerState(): Promise<void> {
  const remote = await loadAppState();
  lastServerGeneration = remote.generation || lastServerGeneration;
  ingestRemote(remote.state);
}

/** Debounced push of every store change into the server database. */
export function startServerSync(): void {
  if (serverSyncStarted || typeof window === "undefined") return;
  serverSyncStarted = true;
  let timer: number | undefined;
  const flush = async () => {
    timer = undefined;
    const data = snap(useApp.getState());
    try {
      const result = await saveAppState({ data: { state: { ...data, __generation: lastServerGeneration || undefined }, purges: drainPurges() } });
      if (result?.generation) lastServerGeneration = result.generation;
    } catch (error) {
      console.error("[server-sync] save failed:", error instanceof Error ? error.message : error);
      /* offline — the local durable mirror keeps the studio usable */
    }
  };
  useApp.subscribe(() => {
    if (timer == null) timer = window.setTimeout(() => void flush(), 600);
  });
  void flush();
}

/** Slow cross-window/context merge: window A's workspaces reach window B in seconds. */
function startServerPull(): void {
  if (serverPullStarted || typeof window === "undefined") return;
  serverPullStarted = true;
  window.setInterval(() => {
    // Auto-reload fix guards: never merge while a worker tick is advancing,
    // never overlap two pulls, and skip entirely in hidden tabs so background
    // churn cannot wake React (the next visible tick catches up).
    if (advancing || document.hidden || pullInFlight) return;
    pullInFlight = true;
    void pullServerState()
      .catch(() => {})
      .finally(() => {
        pullInFlight = false;
      });
  }, 5000);
}

function hydrateFromServer(): Promise<void> {
  if (!hydratingServer) {
    hydratingServer = (async () => {
      let fromServer = false;
      try {
        const remote = await loadAppState();
        lastServerGeneration = remote.generation || "";
        if (remote.state && typeof remote.state === "object") {
          fromServer = true;
          ingestRemote(remote.state);
        }
      } catch {
        fromServer = false;
      }
      if (!fromServer) {
        // No server snapshot (first ever run / server unreachable): fall back to
        // the local durable mirror so offline edits are not lost.
        try {
          await useApp.persist.rehydrate();
        } catch {
          /* fresh install */
        }
      }
    })();
  }
  return hydratingServer;
}

export function useVaultPhase(): "checking" | "locked" | "open" {
  const [phase, setPhase] = useState(vaultPhase());
  useEffect(() => onVaultPhase(setPhase), []);
  return phase;
}

export function useHydrated(): boolean {
  const phase = useVaultPhase();
  const [hydrated, setHydrated] = useState(false);
  useEffect(() => {
    void loadVaultGate();
  }, []);
  useEffect(() => {
    if (phase !== "open") return;
    let alive = true;
    // Server-authoritative hydration: load .data/appstate.json (single source
    // of truth) before the UI renders any data. The local IndexedDB mirror is
    // only consulted when the server has no snapshot (first run or offline).
    void hydrateFromServer().then(() => {
      if (!alive) return;
      startServerSync();
      startServerPull();
      setHydrated(true);
    });
    return () => {
      alive = false;
    };
  }, [phase]);
  return hydrated;
}

/** Collections the tick and async actions both write — merged per id, never wholesale. */
const CHURNED_COLLECTIONS = ["jobs", "runs", "articles", "plans", "calendars", "research", "events", "activity", "builds", "deploys", "audits", "authors"] as const;

/**
 * Hotfix (Rule 6/7 concurrency): upsert-merge two Persisted snapshots by id.
 * The worker tick and async actions (queueKeywords/queuePlan/queueCalendarItem/
 * runResearch) both clone → await → set. A wholesale spread of the clone used to
 * WIPE entities committed concurrently in the other path (a run created during an
 * in-flight advance vanished → "Run missing"). Merging per collection by id keeps
 * both: incoming replaces same-id entries; base-only entries survive; ordering of
 * incoming is preserved with base-only entries appended.
 */
/** Shallow per-row equality: advance() clones rows even when nothing changed, so CONTENT identity is what matters. */
function rowSame(a: unknown, b: unknown): boolean {
  if (Object.is(a, b)) return true;
  if (typeof a !== "object" || typeof b !== "object" || !a || !b) return false;
  const ak = Object.keys(a as object);
  const bk = Object.keys(b as object);
  if (ak.length !== bk.length) return false;
  for (const key of ak) {
    if (!Object.is((a as Record<string, unknown>)[key], (b as Record<string, unknown>)[key])) return false;
  }
  return true;
}

/**
 * Pipeline-progress protection: a stale snapshot may NEVER rewind a job.
 * Terminal statuses (completed/failed/refused/held) outrank running, which
 * outranks queued; deeper stage progress outranks shallower.
 */
export function jobProgressValue(job: unknown): number {
  const row = job as Partial<Job> | null;
  const status = String(row?.status ?? "");
  const terminal = status === "completed" || status === "failed" || status === "refused" || status === "cancelled" || status === "publish-held" || status === "review-held";
  const base = terminal ? 100_000 : status === "running" ? 10_000 : status === "queued" ? 1_000 : 0;
  return base + ((row?.stageIndex ?? -1) + 1) * 100 + (row?.shots ?? 0) * 10;
}

export function mergePersisted<K extends "jobs" | "runs" | "articles" | "plans" | "calendars" | "research" | "events" | "activity" | "builds" | "deploys" | "audits" | "authors">(
  base: Persisted,
  incoming: Persisted,
  collections: readonly K[],
): Pick<Persisted, K> {
  const out = {} as Pick<Persisted, K>;
  for (const key of collections) {
    const baseList = base[key] as unknown as { id: string }[];
    const incList = incoming[key] as unknown as { id: string }[];
    // Loop-hotfix: when the merged result is content-identical to the base
    // list, keep the BASE array reference. A fresh array for unchanged data
    // re-fires every effect keyed on these collections (live-writer,
    // model-stages, desk-workers) 2.5x/sec while a run is active — the
    // nested-update storm behind "Maximum update depth exceeded".
    if (
      incList.length === baseList.length &&
      incList.every((item, index) => rowSame(item, baseList[index]))
    ) {
      continue;
    }
    const incById = new Map(incList.map((item) => [item.id, item]));
    if (key === "jobs") {
      // Split-brain fix: for jobs, the row with newer pipeline progress wins —
      // never the mere fact that it arrived later or from a different writer.
      for (const item of baseList) {
        const inc = incById.get(item.id);
        if (inc && jobProgressValue(inc) < jobProgressValue(item)) incById.set(item.id, item);
      }
      (out[key] as unknown) = [...incById.values()];
      continue;
    }
    const incIds = new Set(incList.map((item) => item.id));
    (out[key] as unknown) = [...incList, ...baseList.filter((item) => !incIds.has(item.id))];
  }
  return out;
}

// Dev aid: expose the store for the hotfix verification harness (safe read-only usage).
if (typeof window !== "undefined") {
  (window as unknown as Record<string, unknown>).__gawStore = useApp;
}
