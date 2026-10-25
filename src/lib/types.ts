export const STAGES = [
  { key: "intent", label: "Intent & Blueprint", tokens: [730, 790], ms: 1600 },
  { key: "draft", label: "Draft", tokens: [2100, 2400], ms: 2200 },
  { key: "revision", label: "Quality & Coverage Revision", tokens: [2300, 2800], ms: 1800 },
  { key: "metadata", label: "Metadata & Packaging", tokens: [450, 490], ms: 700 },
  { key: "enrichment", label: "Site Enrichment", tokens: [1400, 1520], ms: 1000 },
  { key: "publish", label: "Final Validation & Publication", tokens: [0, 0], ms: 650 },
] as const;

export type StageKey = (typeof STAGES)[number]["key"];

export type StageRecord = {
  key: StageKey;
  label: string;
  status: "pending" | "running" | "done" | "failed";
  tokens: number;
  durationMs: number;
  startedAt?: number;
  finishedAt?: number;
  /** Why the token count is what it is. Empty when a model stage settled provider usage. */
  note?: string;
  promptVersion?: string;
  /** Failure text for a failed stage (watchdog or model failure detail). */
  error?: string;
};

export type JobStatus =
  | "queued"
  | "running"
  | "completed"
  | "failed"
  | "refused"
  | "cancelled"
  | "review-held"
  | "publish-held";
export type RunStatus = "queued" | "running" | "completed" | "partial" | "failed" | "cancelled";

/** Rule 3a — stage 1 blueprint: direct answer + question H2s + table plan. */
export type IntentBlueprint = {
  intent: string;
  audience: string;
  /** 40–60 word direct answer quoted alone by answer engines. */
  answerBlock: string;
  questionH2s: string[];
  tablePlan: boolean;
  mustCover: string[];
};

export type Job = {
  id: string;
  runId: string;
  siteId: string;
  keyword: string;
  title: string;
  kind: "keyword" | "cluster" | "pillar";
  variant: boolean;
  dependsOn: string[];
  status: JobStatus;
  refusalReason?: string;
  refusalLayer?: "L1" | "L2" | "L3" | "policy";
  failReason?: string;
  stageIndex: number;
  stages: StageRecord[];
  articleId?: string;
  shots: number;
  tokens: number;
  costUsd: number;
  createdAt: number;
  attempt?: number;
  /**
   * Set when this job is owned by the Rust worker rather than the browser.
   * Server-owned jobs are read-only here: the engine must not advance them, or
   * a tab and the worker would both run the same stages and pay twice.
   */
  origin?: "server";
  /** Written, but stage 6 must not send it to Ghost until the calendar releases it. */
  publishHold?: boolean;
  /** How the semantic gate was scored for this job. */
  embedSource?: "provider" | "hash-fallback";
  embedNote?: string;
  /** Markdown returned by generateDraft for the draft and revision stages. */
  modelText?: { draft?: string; revision?: string };
  /** Rule 3a: stage 1 blueprint (model or fallback-derived). */
  modelIntent?: IntentBlueprint;
  /** Provider usage for the model stages. Absent when no model was called. */
  modelUsage?: {
    intent?: { prompt: number; completion: number; total: number };
    draft?: { prompt: number; completion: number; total: number };
    revision?: { prompt: number; completion: number; total: number };
    metadata?: { prompt: number; completion: number; total: number };
    enrichment?: { prompt: number; completion: number; total: number };
  };
  modelError?: string;
  modelVerifyFlags?: string[];
  promptVersions?: Partial<Record<StageKey, string>>;
  /** Key that actually served the model calls. Differs from Run.modelKeyId after auto-failover. */
  keyId?: string;
  /** Ordered key ids tried for this job, oldest first. Recorded so failover is auditable. */
  failoverChain?: string[];
  /** Automatic restarts already consumed. Compared against Limits.restartLimit (null = unlimited). */
  restarts?: number;
  /** Rule 2: author assigned by the auto-author engine at dispatch. */
  authorId?: string;
  /** Blader humanizer result from the Stage 3 revision pass (0–100 human-prose purity). */
  humanizerScore?: number;
  /** AI tells stripped during the Stage 3 revision pass. */
  humanizerStripped?: string[];
  /** 1 = deterministic pass only, 2 = deterministic + LLM surgical rewrite. */
  humanizerPasses?: number;
  /**
   * Single-runner workspace: stage 4 (metadata) and stage 5 (enrichment) hand
   * their output straight to stage 6 inside the same sequential job execution.
   * `links` are picked siblings, `images` are placed Bing photos, `excerpt` /
   * `tags` are computed metadata.
   */
  enrich?: {
    links?: { anchor: string; slug: string }[];
    images?: ArticleImage[];
    excerpt?: string;
    tags?: string[];
    /** Stage 4 packaging title ≤60 chars (SEO/H1 packaging, not the working title). */
    title?: string;
    /** Stage 4 SEO description ≤155 chars. */
    metaDescription?: string;
    /** Stage 4 slug, already checked unique against this site's articles. */
    slug?: string;
    /** Stage 3 / Blader humanizer note threaded through to the article. */
    humanizerNote?: string;
  };
};

export type Run = {
  id: string;
  siteId: string;
  type: "keywords" | "topic-plan";
  title: string;
  publishMode: "draft" | "live";
  modelKeyId: string;
  allowVariants: boolean;
  topicPlanId?: string;
  createdAt: number;
  status: RunStatus;
  bulletproof?: boolean;
  researchUrls?: string[];
};

export type LinkState =
  | "PLANNED"
  | "LOCAL"
  | "GHOST_PENDING"
  | "GHOST_CONFIRMED"
  | "STATIC_CONFIRMED"
  | "FAILED"
  | "BROKEN";

export type ArticleLink = {
  anchor: string;
  targetSlug: string;
  state: LinkState;
};

export type ArticleImage = {
  role: "featured" | "section";
  query: string;
  alt: string;
  http: number;
  selected: boolean;
  src?: string;
  remote?: string;
  width?: number;
  height?: number;
  bytes?: number;
  /** unknown-bing means the photo was copied from a Bing result. Confirm rights before the page is public. */
  license?: string;
  attempts?: number;
};

export type ArticleSection = { heading: string; paragraphs: string[] };

export type Article = {
  id: string;
  siteId: string;
  jobId: string;
  title: string;
  slug: string;
  keyword: string;
  html: string;
  markdown: string;
  excerpt: string;
  sections: ArticleSection[];
  /** Stage 4 (Metadata & Packaging) SEO title ≤60 chars. Falls back to `title` when the model did not run. */
  metaTitle?: string;
  /** Stage 4 SEO description ≤155 chars. Falls back to `excerpt` when the model did not run. */
  metaDescription?: string;
  status: "draft" | "published";
  engine: "llm" | "fallback";
  words: number;
  uniqueness: number;
  coverage: number;
  intentMatch: number;
  tags: string[];
  mustCover: string[];
  revisionNotes: string;
  images: ArticleImage[];
  links: ArticleLink[];
  stageTokens: number[];
  verifyFlags: string[];
  ledger: {
    mode: "draft" | "live";
    confirmed: boolean;
    dispatchedAt: number;
    confirmedAt: number;
    postId: string;
    shots: number;
  };
  publishedAt: number;
  promptVersions?: Partial<Record<StageKey, string>>;
  authorId?: string;
  authorName?: string;
  /**
   * The author's beat and city, carried on server-generated rows so a byline can
   * render without a matching `AuthorProfile` in the client store.
   */
  authorBeat?: string;
  authorCity?: string;
  /** Rule 2 idempotency: set once when the author's articleCount was incremented for this article. */
  authorCounted?: boolean;
  humanized?: boolean;
  humanNote?: string;
  /** Why bulletproof humanization has or has not run. */
  humanState?: "pending" | "running" | "done" | "needs-key" | "error";
  /** Blader humanizer (Wikipedia AI-signs ruleset): 0–100 purity after the last pass. */
  humanizerScore?: number;
  /** AI tells stripped by the blader humanizer (pattern names/phrases, deduped). */
  humanizerStripped?: string[];
  /** Column "2 passes" = deterministic + LLM surgical rewrite. 1 = deterministic only. */
  humanizerPasses?: number;
  humanizerNote?: string;
  liveState?: "pending" | "running" | "done" | "error" | "skipped";
  liveError?: string;
  bulletproof?: boolean;
  researchDigest?: string;
  /** Bumped on every photo refresh so Bing is asked for a different frame. */
  imageSalt?: number;
  /** Bing (or Wikimedia fallback) photo placement. */
  imageState?: "pending" | "ready" | "empty";
  /** Live Ghost single-shot create. Skipped in studio ledger mode. Held when Rule 3d humanization has not finished yet. */
  ghostPush?: "pending" | "running" | "done" | "error" | "skipped" | "held";
  /** Rule 6: Ghost's updated_at from the confirming publish — the optimistic lock for PUT re-weaves. */
  ghostUpdatedAt?: string;
  /** True after a Ghost push that included an uploaded photo. */
  ghostMedia?: boolean;
  /** How many times an existing Ghost post was queued again for a photo. */
  photoTries?: number;
};

export type TopicCluster = {
  id: string;
  title: string;
  angle: string;
  excluded: boolean;
  jobId?: string;
  source?: "ai" | "you";
  selected?: boolean;
};

export type TopicPlan = {
  id: string;
  siteId: string;
  topic: string;
  pillarTitle: string;
  pillarAngle: string;
  clusters: TopicCluster[];
  status: "review" | "queued" | "running" | "completed" | "partial" | "failed";
  error?: string;
  runId?: string;
  createdAt: number;
};

export type UsageState = "RESERVED" | "SETTLED" | "RELEASED";

export type UsageEvent = {
  id: string;
  pairId: string;
  siteId: string;
  keyId: string;
  at: number;
  state: UsageState;
  provider: string;
  model: string;
  stage: string;
  tokens: number;
  usd: number;
};

export type AiKey = {
  id: string;
  provider: string;
  model: string;
  label: string;
  hint: string;
  priority: number;
  chat: boolean;
  semantic: boolean;
  allowanceUsd: number;
  disabled: boolean;
  cooldownUntil?: number;
  /** Exact HTTP status + provider message from the most recent failed call. */
  lastError?: string;
  lastErrorAt?: number;
  lastUsedAt?: number;
  pricePerM: number;
  /** OpenAI-compatible origin, including /v1 when the provider uses it. */
  baseUrl?: string;
  /** Stored only in this browser. Sent to your provider when you generate. */
  secret?: string;
  /**
   * Numeric `ai_keys.id` once the key is saved on the server. Generation goes
   * through the server with this id, so the browser never needs the secret.
   *
   * Unset means the key exists only here (added before keys moved server-side,
   * or saved without a secret) and cannot be used to generate until it is
   * pushed — see the one-time migration on hydrate.
   */
  serverKeyId?: number;
  kind?: "studio" | "custom";
  /** Rule 4: which provider family this key belongs to. Custom = any OpenAI-compatible endpoint. */
  providerKind?: "openai" | "openrouter" | "custom";
  /** Catalog model id when the key was added from the built-in catalog. Custom ids keep this unset. */
  catalogId?: string;
  /**
   * GOVERNOR §3 capability match (chat vs semantic): the exact model id sent to
   * /embeddings for this key. Unset means the provider family default is used
   * (OpenAI → text-embedding-3-small); a provider family without a resolvable
   * embedding model keeps the L3 hash fallback instead of guessing.
   */
  embeddingModel?: string;
};

export type InventoryPost = {
  id: string;
  title: string;
  slug: string;
  status: "PUBLISHED" | "DRAFT" | "MISSING";
  syncedAt: number;
};

export type CorpusMemory = {
  id: string;
  siteId: string;
  title: string;
  keyword: string;
  slug: string;
  permalink: string;
  embedding: number[];
  embedSource: "provider" | "hash-fallback";
  createdAt: number;
};

export type GhostConn = {
  mode: "studio" | "live" | "off";
  status: "connected" | "disconnected" | "error";
  url: string;
  keyHint: string;
  version: string;
  corpus: "EMPTY" | "SYNCING" | "COMPLETE";
  inventory: InventoryPost[];
  lastTestAt?: number;
  lastSyncAt?: number;
  syncReadyAt?: number;
  lastError?: string;
  /** Kept only in this browser so live publish can upload images and POST once. Cleared on disconnect. */
  adminKey?: string;
  /** ghost = Admin API pages. local-demo = this browser's articles, Ghost was not called. */
  inventorySource?: "ghost" | "local-demo";
};

export type DeployProviderId = "cloudflare" | "github" | "vercel" | "cpanel";

export type DeployProvider = {
  id: DeployProviderId;
  name: string;
  capability: string;
  status: "not_connected" | "configured" | "verified";
  hint: string;
  ftp?: { host: string; user: string; path: string; password: string; port?: number; publicUrl?: string; via?: "ftps" | "sftp"; trust_cert?: boolean };
  /** Rule 6: API credential slot for Cloudflare Pages / Vercel / GitHub Pages. Secrets stay in this browser and are never logged. */
  api?: {
    accountId?: string;
    projectName?: string;
    /** repo "owner/name" for GitHub Pages */
    repo?: string;
    branch?: string;
    token?: string;
    /** Only the tail is ever displayed. */
    tokenHint?: string;
  };
};

export type VoiceSettings = {
  modelKeyId: string;
  publishAs: "draft" | "live";
  tone: string;
  sections: number;
  sectionImages: number;
  linkIntensity: "light" | "standard" | "dense";
  voice: string;
  imageProvider: string;
  bannedPhrases: string[];
  brandFacts: string[];
  pov: "first-person" | "second-person" | "third-person";
  readingLevel: "grade-7" | "general" | "expert";
};

/** Rule 6: the 7 live ad slot ids (LIVE_REA_REALTIME_AUDIT, 2026-10-16). */
export const AD_SLOT_IDS = [
  "site_top",
  "home_feed",
  "article_top",
  "article_inline",
  "article_bottom",
  "article_sidebar",
  "site_bottom",
] as const;

export type AdSlotId = (typeof AD_SLOT_IDS)[number];

/** Per-slot ad code limit enforced client and server side (live contract: 16 KiB). */
export const AD_CODE_LIMIT = 16 * 1024;

export type AdSlotConfig = {
  id: AdSlotId;
  enabled: boolean;
  /** Internal label shown in the builder. */
  name: string;
  adType: "custom_code" | "adsense_responsive";
  code: string;
  /** Placement map metadata (desktop/mobile), incl. the 300px rail ≥1200px for article_sidebar. */
  position: { desktop: string; mobile: string };
};

export const AD_SLOT_LABELS: Record<AdSlotId, string> = {
  site_top: "Below header",
  home_feed: "Between homepage posts",
  article_top: "Before article content",
  article_inline: "Inside article",
  article_bottom: "After article content",
  article_sidebar: "Article side column",
  site_bottom: "Above footer",
};

export const AD_SLOT_POSITIONS: Record<AdSlotId, { desktop: string; mobile: string }> = {
  site_top: { desktop: "Full width below header", mobile: "Full width below header" },
  home_feed: { desktop: "After the sixth card when there are at least seven posts", mobile: "After the sixth card when there are at least seven posts" },
  article_top: { desktop: "Above the first paragraph", mobile: "Above the first paragraph" },
  article_inline: { desktop: "After paragraph three when there are at least six top-level paragraphs", mobile: "After paragraph two when there are at least six top-level paragraphs" },
  article_bottom: { desktop: "After the last paragraph", mobile: "After the last paragraph" },
  article_sidebar: { desktop: "300px right rail, viewport ≥1200px", mobile: "Hidden (no rail under 1200px)" },
  site_bottom: { desktop: "Above footer", mobile: "Above footer" },
};

export function defaultAdSlots(): AdSlotConfig[] {
  return AD_SLOT_IDS.map((id) => ({ id, enabled: false, name: AD_SLOT_LABELS[id], adType: "custom_code" as const, code: "", position: AD_SLOT_POSITIONS[id] }));
}

export type Site = {
  id: string;
  /**
   * Numeric id of this site in the Rust backend, set the first time it queues
   * work. The UI keys on the uid string; the server tables key on integers, so
   * this is the link between them (`POST /api/v1/sites/ensure`).
   */
  serverSiteId?: number;
  name: string;
  createdAt: number;
  staticName: string;
  nicheTag: string;
  publicUrl: string;
  logoUrl: string;
  faviconUrl: string;
  robots: "index,follow" | "noindex,nofollow";
  footer: string;
  headerMenu: string;
  footerMenu: string;
  headHtml: string;
  bodyEnd: string;
  analyticsSnippet: string;
  autoRebuild: boolean;
  pendingRebuildAt?: number | null;
  template: "classic-editorial" | "minimal-authority" | "affiliate-review";
  indexNowKey?: string;
  authors: string;
  /** Rule 2: auto-match expert authors at dispatch (250-cap). Default true. */
  autoAuthors?: boolean;
  /** Rule 6: master ad switch + 7 slot configs + ads.txt body. */
  adsEnabled?: boolean;
  ads?: AdSlotConfig[];
  adsTxt?: string;
  voice: VoiceSettings;
  ghost: GhostConn;
  providers: DeployProvider[];
  /** 1–7 while the setup guide is open. 8 means finished. */
  setupStep?: number;
  setupSkipped?: boolean;
};

export type StaticBuild = {
  id: string;
  siteId: string;
  status: "succeeded" | "failed";
  pages: number;
  bytes: number;
  ms: number;
  at: number;
  auto: boolean;
  detail?: string;
  template: string;
  includedIds: string[];
  excluded: { id: string; reason: string }[];
  artifact: { name: string; text: string; hash: string }[];
  /** Rule 6: route set of this build (route-diff input). */
  routes?: string[];
  /** Rule 6: deterministic hash over ad slot configs. */
  adsConfigHash?: string;
};

export type DeployRecord = {
  id: string;
  siteId: string;
  buildId: string;
  providerId: string;
  status: "packaged" | "verified" | "failed" | "hold-route-diff";
  at: number;
  probe: string;
  /** Route-diff gate evidence (present on hold-route-diff, kept after resolution). */
  routeDiff?: {
    removedRoutes: string[];
    addedRoutes: string[];
    unchangedCount: number;
    acknowledged: boolean;
  };
  /** Provider-reported live URL after a successful adapter deploy. */
  liveUrl?: string;
};

/** Rule 6: server-side worker heartbeat + lease state. */
export type WorkerState = {
  /** Last heartbeat from the durable worker bridge. */
  lastBeatAt: number;
  online: boolean;
  activeJobs: number;
  nextCalendarPulseAt?: number;
  source: "browser" | "server";
  /** Lease owner currently allowed to advance the queue (single-dispatch guarantee). */
  leaseHolder?: string;
  leaseExpiresAt?: number;
};

export type AuditProposal = {
  id: string;
  articleId: string;
  articleTitle: string;
  kind: "insert" | "rewrite" | "remove";
  detail: string;
  anchor: string;
  targetSlug: string;
  /** Previous target when kind is rewrite. */
  fromSlug?: string;
  selected: boolean;
};

export type AuditReport = {
  id: string;
  siteId: string;
  at: number;
  scanned: number;
  healthy: number;
  missingLinks: number;
  broken: number;
  wouldInsert: number;
  wouldRewrite: number;
  wouldRemove: number;
  orphans: number;
  proposals: AuditProposal[];
  applied: boolean;
};

export type Activity = {
  id: string;
  at: number;
  siteId: string;
  tone: "info" | "ok" | "warn" | "danger";
  message: string;
  read?: boolean;
};

export type SessionRow = {
  id: string;
  label: string;
  current: boolean;
  seenAt: number;
};

export type EmailProviderConfig = {
  vendor: "resend" | "sendgrid";
  secret: string;
  from: string;
};

export type Account = {
  name: string;
  email: string;
  emailVerified: boolean;
  adminApproved: boolean;
  passwordUpdatedAt?: number;
  sessions: SessionRow[];
  emailProvider?: EmailProviderConfig;
  emailVerifyToken?: string;
  emailVerifyExpires?: number;
};

export type AuthorProfile = {
  id: string;
  siteId: string;
  name: string;
  role: string;
  /** Credentialed short bio tailored to the author's niche. */
  shortBio: string;
  city: string;
  /** US state, e.g. "Texas" (badge shows "Austin, TX"). */
  region: string;
  /** Rule 2: US-based expert personas only. */
  country: "US";
  expertise: string[];
  /** Primary niche/domain this author owns. */
  topic: string;
  slug: string;
  /** External avatar reference only — NEVER a downloaded file. Zero disk storage. */
  avatarUrl: string;
  /** Humanized voice block feeding stages 1–3 prompts. */
  voice: AuthorVoice;
  /** Rule 2: articles written so far. Increment once per confirmed article. */
  articleCount: number;
  /** Rule 2 cap. Default 250; after it the author retires and the niche rotates to a fresh expert. */
  maxArticles: number;
  status: "active" | "retired";
  /** Real Ghost CMS author id/slug. Populated only after a Ghost Admin API resolve — never invented. */
  ghostAuthorId?: string | null;
  ghostSlug?: string | null;
  createdAt: number;
  origin: "auto" | "manual";
};

export type AuthorVoice = {
  /** Sentence rhythm, e.g. "short declaratives, one longer breath per paragraph". */
  rhythm: string;
  /** Word choice, e.g. "plain words, one precise term per idea". */
  diction: string;
  /** e.g. "8–16 words". */
  sentenceLengthBand: string;
  pov: "first-person" | "second-person" | "third-person";
  tone: string;
  readingLevel: "grade-7" | "general" | "expert";
  /** Verbal tics that make drafts recognizably this author's. */
  signatureMoves: string[];
  /** Robotic AI clichés this author refuses. */
  bannedPhrases: string[];
};

/** Rule 2: 250-article cap per auto author before rotation to a fresh US expert. */
export const DEFAULT_AUTHOR_CAP = 250;

export type FirecrawlConfig = {
  secret: string;
  hint: string;
};

/** Rule 5: web-search switch. Off | Tavily | Firecrawl | Auto-Fallback. */
export type WebSearchMode = "off" | "tavily" | "firecrawl" | "auto-fallback";

export type WebSearchKey = {
  id: string;
  hint: string;
  secret: string;
  disabled: boolean;
  failCount: number;
  cooldownUntil?: number;
  lastUsedAt?: number;
  lastError?: string;
};

export type WebSearchConfig = {
  mode: WebSearchMode;
  tavilyKeys: WebSearchKey[];
  firecrawlKeys: WebSearchKey[];
  tavilyCursor: number;
  firecrawlCursor: number;
};

/** Rule 1: zero-limitation knobs. null means unlimited. */
export type Limits = {
  /** Max keywords accepted in one run. null = unlimited (10,000+). */
  keywordCap: number | null;
  /** Article jobs generating at once per website. */
  concurrency: number;
  /** Max idea suggestions per round. null = unlimited. */
  ideaCap: number | null;
  /** Max automatic restarts of a failed job. null = unlimited. */
  restartLimit: number | null;
  /** Static builds kept in history per studio. null = unlimited. */
  buildHistory: number | null;
};

export const DEFAULT_LIMITS: Limits = {
  keywordCap: null,
  concurrency: 24,
  ideaCap: null,
  restartLimit: null,
  buildHistory: 500,
};

export type Idea = { keyword: string; reason: string; intent: string };
export type IdeaRejection = { keyword: string; reason: string; layer: "L1" | "L2" | "L3" | "policy" };

/** Rule 6 / live API: calendar publish mode and the 3 independent automation switches. */
export type CalendarPublishMode = "published" | "draft";
export type CalendarEntryStatus = "SCHEDULED" | "WRITING" | "READY" | "PUBLISHED" | "DRAFT_SAVED" | "SKIPPED" | "FAILED";
export type CalendarStrategy = "PILLAR_FIRST";
export type CalendarMode = "MANUAL" | "AUTOMATED";

export type ContentCalendar = {
  id: string;
  siteId: string;
  name: string;
  timezone: string;
  /** 1–7 (Sunday=0), the days articles may publish. */
  activeDays: number[];
  /** 1–21 articles per week. */
  articlesPerWeek: number;
  /** Local publish clock, "HH:MM". */
  publishTime: string;
  /** 1–336 hours between write_at and publish_at. */
  generationLeadHours: number;
  strategy: CalendarStrategy;
  publishMode: CalendarPublishMode;
  mode: CalendarMode;
  planningRangeDays: number;
  defaultModelCatalogId?: string | null;
  /** Scheduling order hint (internal; pillars-first is the live default). */
  order: "pillars-first" | "one-cluster" | "balanced" | "my-order";
  /** The 3 independent, default-OFF automation switches. */
  autoGenerate: boolean;
  autoPublish: boolean;
  autoReweave: boolean;
  /** Server-computed summaries (recomputed on every mutation, like the live panel). */
  cadence: string;
  automation: string;
  sourcePlanId?: string;
  createdAt: number;
  items: CalendarEntry[];
};

export type CalendarEntry = {
  id: string;
  title: string;
  angle: string;
  kind: "pillar" | "cluster" | "keyword";
  /** write_at !== publish_at: the lead time is subtracted when scheduling. */
  writeAt: number;
  publishAt: number;
  status: CalendarEntryStatus;
  jobId?: string;
  articleId?: string;
  runId?: string;
  attempts?: number;
  note?: string;
};

export type ResearchFact = {
  id: string;
  label: "From your site" | "Calculated" | "AI interpretation" | "You wrote this";
  text: string;
};

/** Rule 3/§4: live-confirmed stage names R1–R11 (LIVE_REA_REALTIME_AUDIT, 2026-10-16). */
export const RESEARCH_STAGES = [
  { key: "niche", name: "Niche understanding", engine: "llm" },
  { key: "audience", name: "Audience map", engine: "llm" },
  { key: "problem", name: "Problem map", engine: "llm" },
  { key: "topic-universe", name: "Topic universe", engine: "llm" },
  { key: "query-expansion", name: "Query expansion", engine: "llm" },
  { key: "intent-class", name: "Intent classification", engine: "llm" },
  { key: "semantic-consolidation", name: "Semantic consolidation", engine: "derived" },
  { key: "coverage", name: "Existing coverage mapping", engine: "llm" },
  { key: "cluster-construction", name: "Cluster construction", engine: "llm" },
  { key: "action-class", name: "Content action classification", engine: "derived" },
  { key: "priority", name: "Strategic priority inputs", engine: "llm" },
] as const;

export type ResearchStageKey = (typeof RESEARCH_STAGES)[number]["key"];

export type ResearchStageRecord = {
  key: ResearchStageKey;
  name: string;
  engine: "llm" | "derived";
  status: "pending" | "running" | "done" | "failed";
  tokens: number;
  durationMs?: number;
  startedAt?: number;
  finishedAt?: number;
  attempts: number;
  error?: string;
  note?: string;
};

export type ResearchQuery = {
  id: string;
  query: string;
  topic?: string;
  intent?: "informational" | "comparison" | "transactional" | "crisis" | "how-to";
  embedSource?: "provider" | "hash-fallback";
  /** R7 dedupe: merged rows point at the canonical query id. */
  status: "keep" | "merged";
  mergedInto?: string;
};

export type ResearchAction = { queryId: string; query: string; action: "write" | "refresh" | "skip"; reason: string };

export type ResearchCluster = { id: string; title: string; angle: string; queries: string[] };

export type ResearchOutput = {
  niche?: { entityMap: string; subNiches: string[]; terminology: string[]; purpose: string };
  audience?: { persona: string; intent: string; pain: string }[];
  problems?: { persona: string; problem: string }[];
  topicUniverse?: { pillar: string; clusters: { title: string; angle?: string }[] };
  queries?: ResearchQuery[];
  coverage?: { queryId: string; query?: string; state: "covered" | "partial" | "weak" | "missing"; evidence: string }[];
  clusters?: ResearchCluster[];
  actions?: ResearchAction[];
  priority?: { note: string; scores: { topic: string; score: number; why: string }[] };
};

export type ResearchProject = {
  id: string;
  siteId: string;
  niche: string;
  notes: string;
  createdAt: number;
  status: "ready" | "partial" | "failed";
  breadth: "compact" | "standard" | "wide";
  stages: ResearchStageRecord[];
  stagesCompleted: number;
  attempts: number;
  output: ResearchOutput;
  facts: ResearchFact[];
  archived?: boolean;
};

export type WorkspaceBackup = {
  id: string;
  siteId: string;
  siteName: string;
  at: number;
  articles: number;
  edges: number;
  bytes: number;
  checksum: string;
  verified: boolean | null;
  /** JSON of the workspace only. Never includes Ghost, AI, or humanizer secrets. */
  payload: string;
};

export type Persisted = {
  activeSiteId: string;
  sites: Site[];
  runs: Run[];
  jobs: Job[];
  articles: Article[];
  plans: TopicPlan[];
  events: UsageEvent[];
  keys: AiKey[];
  builds: StaticBuild[];
  deploys: DeployRecord[];
  audits: AuditReport[];
  activity: Activity[];
  account: Account;
  defaults: VoiceSettings;
  ideas: { siteId: string; niche: string; items: Idea[]; tokens: number; filtered: number; engine: "llm" | "fallback"; usage?: { prompt: number; completion: number; total: number }; rejected?: IdeaRejection[] } | null;
  notice: { text: string; tone: "info" | "ok" | "warn" | "danger" } | null;
  authors: AuthorProfile[];
  firecrawl: FirecrawlConfig;
  calendars: ContentCalendar[];
  research: ResearchProject[];
  workerPaused: boolean;
  /** Rule 6: durable worker bridge heartbeat + single-dispatch lease. */
  worker: WorkerState;
  backups: WorkspaceBackup[];
  corpus: CorpusMemory[];
  /** Rule 1: user-configurable scale limits. */
  limits: Limits;
  /** Rule 5: Tavily / Firecrawl web-search switch and key pools. */
  webSearch: WebSearchConfig;
};

export const PRICE_PER_M = 6;
export const EMBED_TOKENS = 180;
export const IDEA_TOKENS = 18400;
export const L2 = 0.85;
export const L3 = 0.88;

export function intensityBand(level: VoiceSettings["linkIntensity"]): [number, number] {
  if (level === "light") return [1, 2];
  if (level === "dense") return [4, 6];
  return [2, 4];
}
