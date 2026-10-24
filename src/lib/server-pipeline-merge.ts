/**
 * Map the Rust pipeline's rows into the shapes the UI already renders.
 *
 * The worker owns the pipeline now, but every component still reads the store's
 * `Job` / `Article` / `Run` types. Rather than teach the whole UI a second data
 * model, this converts server rows into those types and marks them
 * `origin: "server"` so the browser engine leaves them alone.
 *
 * Two rules worth stating:
 *
 * - Ids are namespaced (`srv_job_7`). The browser generates uid strings, and a
 *   bare numeric id could collide with one, silently overwriting local state.
 *   Stable across polls so React keys and merges behave.
 * - Articles arrive as markdown (`content_json.markdown`); `html` and `sections`
 *   are derived with the project's own helpers, the same ones the local
 *   pipeline uses, so formatting does not diverge between the two paths.
 */
import { markdownToHtml, sectionsFromMarkdown, wordCount } from "./markdown.ts";
import { STAGES } from "./types.ts";
import type {
  Article,
  Job,
  JobStatus,
  Run,
  RunStatus,
  StageRecord,
} from "./types.ts";
import type {
  PipelineSnapshot,
  ServerArticle,
  ServerJob,
  ServerRun,
} from "./pipeline-api.ts";

/** Prefix that marks an id as server-originated. */
const ID = "srv" as const;

export const serverJobId = (n: number) => `${ID}_job_${n}`;
export const serverArticleId = (n: number) => `${ID}_art_${n}`;
export const serverRunId = (n: number) => `${ID}_run_${n}`;

/** Server job status → the UI's vocabulary. */
function jobStatus(raw: string): JobStatus {
  switch (raw.toUpperCase()) {
    case "QUEUED":
      return "queued";
    case "RUNNING":
    case "CLAIMED":
      return "running";
    case "COMPLETED":
      return "completed";
    case "CANCELLED":
      return "cancelled";
    // PARTIAL means the worker finished every stage it has but the pipeline is
    // not whole. Today IMPLEMENTED_STAGES covers all six, so this should not
    // occur; treating it as a failure surfaces it instead of hiding it.
    case "PARTIAL":
    case "FAILED":
    default:
      return "failed";
  }
}

function runStatus(raw: string): RunStatus {
  switch (raw.toUpperCase()) {
    case "QUEUED":
      return "queued";
    case "RUNNING":
      return "running";
    case "COMPLETED":
      return "completed";
    case "PARTIAL":
      return "partial";
    case "CANCELLED":
      return "cancelled";
    case "FAILED":
    default:
      return "failed";
  }
}

function articleStatus(raw: string): "draft" | "published" {
  return raw.toUpperCase() === "PUBLISHED" ? "published" : "draft";
}

/**
 * Rebuild per-stage records from `stageIndex`.
 *
 * The poll does not carry per-stage token counts, so these are progress-only:
 * stages below the index are done, the one at it is running while the job is
 * running, the rest pending. Job-level tokens and cost are real and come from
 * the ledger.
 */
function stagesFor(job: ServerJob): StageRecord[] {
  const running = job.status.toUpperCase() === "RUNNING";
  const failed = jobStatus(job.status) === "failed";
  return STAGES.map((stage, i) => {
    let status: StageRecord["status"] = "pending";
    if (i < job.stageIndex) status = "done";
    else if (i === job.stageIndex && failed) status = "failed";
    else if (i === job.stageIndex && running) status = "running";
    return {
      key: stage.key,
      label: stage.label,
      status,
      tokens: 0,
      durationMs: 0,
    };
  });
}

export function toUiJob(job: ServerJob, siteUid: string): Job {
  return {
    id: serverJobId(job.id),
    runId: job.runId === null ? "" : serverRunId(job.runId),
    siteId: siteUid,
    keyword: job.keyword,
    // The server does not store a job title until the article exists; the
    // keyword is what the queue rows show anyway.
    title: job.keyword,
    kind: "keyword",
    variant: false,
    dependsOn: [],
    status: jobStatus(job.status),
    failReason: job.lastError ?? undefined,
    stageIndex: job.stageIndex,
    stages: stagesFor(job),
    articleId: job.articleId === null ? undefined : serverArticleId(job.articleId),
    shots: 0,
    tokens: job.tokensIn + job.tokensOut,
    costUsd: job.costUsd,
    createdAt: 0,
    attempt: job.attempts,
    origin: "server",
  };
}

type ParsedContent = { markdown: string; faq: unknown };
type ParsedMeta = {
  excerpt?: string;
  metaDescription?: string;
  metaTitle?: string;
  tags?: unknown;
};

function parseJson<T>(raw: string | null): T | undefined {
  if (!raw) return undefined;
  try {
    return JSON.parse(raw) as T;
  } catch {
    // A malformed payload must not blank the whole article row.
    return undefined;
  }
}

export function toUiArticle(article: ServerArticle, siteUid: string): Article {
  const content = parseJson<ParsedContent>(article.contentJson);
  const meta = parseJson<ParsedMeta>(article.metaJson);
  const markdown = typeof content?.markdown === "string" ? content.markdown : "";
  const tags = Array.isArray(meta?.tags)
    ? (meta.tags as unknown[]).filter((t): t is string => typeof t === "string")
    : [];

  return {
    id: serverArticleId(article.id),
    siteId: siteUid,
    jobId: article.jobId === null ? "" : serverJobId(article.jobId),
    title: article.title,
    slug: article.slug,
    keyword: article.keyword,
    html: markdownToHtml(markdown),
    markdown,
    excerpt: meta?.excerpt ?? "",
    sections: sectionsFromMarkdown(markdown),
    metaTitle: meta?.metaTitle,
    metaDescription: meta?.metaDescription,
    status: articleStatus(article.status),
    engine: article.engine === "fallback" ? "fallback" : "llm",
    words: wordCount(markdown),
    uniqueness: article.uniquenessScore ?? 0,
    coverage: article.coverageScore ?? 0,
    intentMatch: article.intentMatch ?? 0,
    tags,
    mustCover: [],
    revisionNotes: "",
    images: article.featuredImageUrl
      ? [
          {
            role: "featured",
            query: article.keyword,
            alt: article.featuredAlt ?? "",
            http: 200,
            selected: true,
            src: article.featuredImageUrl,
            remote: article.featuredImageUrl,
          },
        ]
      : [],
    links: [],
    stageTokens: [],
    verifyFlags: [],
    ledger: {
      mode: "draft",
      confirmed: false,
      dispatchedAt: 0,
      confirmedAt: 0,
      postId: "",
      shots: 0,
    },
    publishedAt: 0,
  };
}

export function toUiRun(run: ServerRun, siteUid: string): Run {
  const done = `${run.completed}/${run.total} done`;
  return {
    id: serverRunId(run.id),
    siteId: siteUid,
    type: "keywords",
    title:
      run.failed > 0
        ? `Server run · ${done} · ${run.failed} failed`
        : `Server run · ${done}`,
    publishMode: "draft",
    modelKeyId: "server",
    allowVariants: false,
    createdAt: 0,
    status: runStatus(run.status),
  };
}

/**
 * Merge a snapshot into the store's collections for one site.
 *
 * Server rows replace any previous server rows for that site and local rows are
 * left untouched, so a site can still hold browser-run work mid-migration
 * without either side deleting the other's records.
 */
export function mergeSnapshot(
  siteUid: string,
  snapshot: PipelineSnapshot,
  existing: { jobs: Job[]; articles: Article[]; runs: Run[] },
): { jobs: Job[]; articles: Article[]; runs: Run[] } {
  const keepLocalJobs = existing.jobs.filter(
    (j) => j.siteId !== siteUid || j.origin !== "server",
  );
  const keepLocalArticles = existing.articles.filter(
    (a) => a.siteId !== siteUid || !a.id.startsWith(`${ID}_`),
  );
  const keepLocalRuns = existing.runs.filter(
    (r) => r.siteId !== siteUid || !r.id.startsWith(`${ID}_`),
  );

  return {
    jobs: [...snapshot.jobs.map((j) => toUiJob(j, siteUid)), ...keepLocalJobs],
    articles: [
      ...snapshot.articles.map((a) => toUiArticle(a, siteUid)),
      ...keepLocalArticles,
    ],
    runs: [
      ...snapshot.runs.map((r) => toUiRun(r, siteUid)),
      ...keepLocalRuns,
    ],
  };
}
