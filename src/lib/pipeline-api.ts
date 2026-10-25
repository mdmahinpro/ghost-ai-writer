/**
 * Client for the server-run pipeline.
 *
 * The browser used to execute the six-stage pipeline itself: the store's tick
 * called `engine.advance()`, which walked every job through blueprint → draft →
 * revision → metadata → enrichment → validation inside a `setInterval`. A run
 * therefore progressed only while a tab was open, and the model calls, gating
 * and image work all ran on the user's machine.
 *
 * The Rust worker now owns that work (`worker::process_claim`), persisting each
 * stage as it completes. This module is the browser's side of that split:
 * enqueue keywords, then poll one snapshot until nothing is left to run.
 *
 * The wire format is snake_case; everything here is exposed in camelCase to
 * match the rest of `src/lib`.
 */
import { get, post, type ApiResponse } from "./api-client.ts";

const PIPELINE_BASE = "/api/v1/pipeline";

/** One job as the server reports it. */
export type ServerJob = {
  id: number;
  /** Null only for jobs created before intake grouped work into runs. */
  runId: number | null;
  siteId: number;
  keyword: string;
  /** QUEUED | RUNNING | COMPLETED | FAILED | PARTIAL | CANCELLED */
  status: string;
  /** Current stage key, e.g. "blueprint". */
  stage: string;
  /** 0-6; 6 means every stage finished. */
  stageIndex: number;
  attempts: number;
  lastError: string | null;
  /** Article this job produced, once a stage has committed one. */
  articleId: number | null;
  /** Summed from the usage ledger, so this is real spend, not an estimate. */
  tokensIn: number;
  tokensOut: number;
  costUsd: number;
};

/** One article as the server reports it. */
export type ServerArticle = {
  id: number;
  jobId: number | null;
  siteId: number;
  title: string;
  slug: string;
  keyword: string;
  status: string;
  createdAt: string | null;
  engine: string | null;
  uniquenessScore: number | null;
  intentMatch: number | null;
  coverageScore: number | null;
  featuredImageUrl: string | null;
  featuredAlt: string | null;
  /** JSON string: sections, faq, html. Parse before rendering. */
  contentJson: string | null;
  metaJson: string | null;
};

export type ServerRun = {
  id: number;
  status: string;
  createdAt: string | null;
  completedAt: string | null;
  total: number;
  completed: number;
  failed: number;
};

/** One stage row as the server reports it (per-job, from `article_stages`). */
export type ServerStage = {
  jobId: number;
  idx: number;
  /** Server key: blueprint | draft | revision | metadata | enrichment | validation */
  key: string;
  status: string;
  tokensIn: number;
  tokensOut: number;
  durationMs: number;
  costUsd: number;
};

export type PipelineSnapshot = {
  jobs: ServerJob[];
  articles: ServerArticle[];
  runs: ServerRun[];
  /** Real per-stage spend for these jobs; empty until stages have committed. */
  stages: ServerStage[];
  /**
   * True while any job is queued or running. The caller should stop polling
   * once this is false rather than hammering an idle workspace.
   */
  active: boolean;
};

export type EnqueueResult = {
  inserted: number;
  /** The run the new jobs were grouped under. */
  runId: number;
};

export type EnsureSiteResult = {
  siteId: number;
  websiteId: number;
  /** False when the site was already linked, so a repeat call is harmless. */
  created: boolean;
};

/** Raw shapes exactly as they arrive. */
type RawJob = {
  id: number;
  run_id: number | null;
  site_id: number;
  keyword: string;
  status: string;
  stage: string;
  stage_index: number;
  attempts: number;
  last_error: string | null;
  article_id: number | null;
  tokens_in: number;
  tokens_out: number;
  cost_usd: number;
};

/** One `article_stages` row: real per-stage spend, surfaced by the snapshot. */
type RawStage = {
  job_id: number;
  idx: number;
  key: string;
  status: string;
  tokens_in: number;
  tokens_out: number;
  duration_ms: number;
  cost_usd: number;
};

type RawArticle = {
  id: number;
  job_id: number | null;
  site_id: number;
  title: string;
  slug: string;
  keyword: string;
  status: string;
  created_at: string | null;
  engine: string | null;
  uniqueness_score: number | null;
  intent_match: number | null;
  coverage_score: number | null;
  featured_image_url: string | null;
  featured_alt: string | null;
  content_json: string | null;
  meta_json: string | null;
};

type RawRun = {
  id: number;
  status: string;
  created_at: string | null;
  completed_at: string | null;
  total: number;
  completed: number;
  failed: number;
};

type RawSnapshot = {
  jobs: RawJob[];
  articles: RawArticle[];
  runs: RawRun[];
  stages?: RawStage[];
  active: boolean;
};

type RawEnqueue = { inserted: number; run_id: number; elapsed_ms: number };

/**
 * Link a browser site to its server row.
 *
 * The store creates sites with uid strings while the Rust tables key on
 * numeric ids, so the first time a site queues work it must be registered and
 * the numeric ids kept. Idempotent: safe to call before every enqueue.
 */
export async function ensureSite(input: {
  workspaceId: number;
  clientUid: string;
  name: string;
  domain?: string;
}): Promise<ApiResponse<EnsureSiteResult>> {
  const res = await post<{ site_id: number; website_id: number; created: boolean }>(
    "/api/v1/sites/ensure",
    {
      workspace_id: input.workspaceId,
      client_uid: input.clientUid,
      name: input.name,
      domain: input.domain,
    },
  );
  if (!res.ok) return res;
  return {
    ok: true,
    data: {
      siteId: res.data.site_id,
      websiteId: res.data.website_id,
      created: res.data.created,
    },
  };
}

/**
 * Enqueue keywords for the server worker to process.
 *
 * Returns the run id the jobs were grouped under; the tick polls
 * `pipelineSnapshot` from there.
 */
export async function enqueueKeywords(input: {
  workspaceId: number;
  siteId: number;
  keywords: string[];
}): Promise<ApiResponse<EnqueueResult>> {
  const res = await post<RawEnqueue>("/api/v1/keywords", {
    workspace_id: input.workspaceId,
    site_id: input.siteId,
    keywords: input.keywords,
  });
  if (!res.ok) return res;
  return {
    ok: true,
    data: { inserted: res.data.inserted, runId: res.data.run_id },
  };
}

/**
 * One consistent snapshot of the run view.
 *
 * Deliberately a single request rather than three: the tick polls this
 * repeatedly while a queue drains, and separate jobs/articles/runs requests can
 * interleave so a job appears before the article that belongs to it.
 */
export async function pipelineSnapshot(input: {
  workspaceId: number;
  siteId?: number;
  limit?: number;
}): Promise<ApiResponse<PipelineSnapshot>> {
  const qs = new URLSearchParams({
    workspace_id: String(input.workspaceId),
  });
  if (input.siteId !== undefined) qs.set("site_id", String(input.siteId));
  if (input.limit !== undefined) qs.set("limit", String(input.limit));

  const res = await get<RawSnapshot>(`${PIPELINE_BASE}/state?${qs.toString()}`);
  if (!res.ok) return res;

  const raw = res.data;
  return {
    ok: true,
    data: {
      jobs: (raw.jobs ?? []).map(
        (j): ServerJob => ({
          id: j.id,
          runId: j.run_id,
          siteId: j.site_id,
          keyword: j.keyword,
          status: j.status,
          stage: j.stage,
          stageIndex: j.stage_index,
          attempts: j.attempts,
          lastError: j.last_error,
          articleId: j.article_id,
          tokensIn: j.tokens_in,
          tokensOut: j.tokens_out,
          costUsd: j.cost_usd,
        }),
      ),
      articles: (raw.articles ?? []).map(
        (a): ServerArticle => ({
          id: a.id,
          jobId: a.job_id,
          siteId: a.site_id,
          title: a.title,
          slug: a.slug,
          keyword: a.keyword,
          status: a.status,
          createdAt: a.created_at,
          engine: a.engine,
          uniquenessScore: a.uniqueness_score,
          intentMatch: a.intent_match,
          coverageScore: a.coverage_score,
          featuredImageUrl: a.featured_image_url,
          featuredAlt: a.featured_alt,
          contentJson: a.content_json,
          metaJson: a.meta_json,
        }),
      ),
      runs: (raw.runs ?? []).map(
        (r): ServerRun => ({
          id: r.id,
          status: r.status,
          createdAt: r.created_at,
          completedAt: r.completed_at,
          total: r.total,
          completed: r.completed,
          failed: r.failed,
        }),
      ),
      stages: (raw.stages ?? []).map(
        (s): ServerStage => ({
          jobId: s.job_id,
          idx: s.idx,
          key: s.key,
          status: s.status,
          tokensIn: s.tokens_in,
          tokensOut: s.tokens_out,
          durationMs: s.duration_ms,
          costUsd: s.cost_usd,
        }),
      ),
      active: Boolean(raw.active),
    },
  };
}

/** Wrap the endpoint for callers that want the raw path. */
export function pipelineStatePath(workspaceId: number, siteId?: number): string {
  const qs = new URLSearchParams({ workspace_id: String(workspaceId) });
  if (siteId !== undefined) qs.set("site_id", String(siteId));
  return `${PIPELINE_BASE}/state?${qs.toString()}`;
}

/**
 * Flip a FAILED server job back to QUEUED on the worker.
 *
 * The UI's local `retryJob` only re-queues browser rows; server jobs are the
 * worker's to re-dispatch. The server refuses anything that is not FAILED, so
 * the caller can surface the reason (e.g. the job already completed).
 */
export async function requeueServerJob(input: {
  workspaceId: number;
  serverJobId: number;
}): Promise<ApiResponse<{ ok: boolean; job_id: number }>> {
  const res = await post<{ ok: boolean; job_id: number }>(`${PIPELINE_BASE}/requeue`, {
    workspace_id: input.workspaceId,
    job_id: input.serverJobId,
  });
  return res;
}
