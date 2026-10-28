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
  LinkState,
  Run,
  RunStatus,
  StageRecord,
} from "./types.ts";
import type {
  PipelineSnapshot,
  ServerArticle,
  ServerJob,
  ServerLink,
  ServerRun,
  ServerStage,
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

/**
 * A row is publishable once its content is finished.
 *
 * `PUBLISHED` means the pipeline pushed it to Ghost. `REVIEW_HELD` and the
 * sandbox `DRAFT` are the pipeline's own "words written, push not made" states:
 * no Ghost wired, or a push the CMS refused. The static build is a delivery
 * channel of its own, and it is the operator who presses Build, so sealed
 * content is publishable — refusing it is how finished articles became
 * impossible to ship anywhere. A row still mid-pipeline has no `contentJson`
 * yet, and `REFUSED` never publishes whatever it holds.
 */
function articleStatus(raw: string, hasContent: boolean): "draft" | "published" {
  const status = raw.toUpperCase();
  if (status === "PUBLISHED") return "published";
  if (status === "REFUSED" || status === "DELETED") return "draft";
  return hasContent ? "published" : "draft";
}

/**
 * Rebuild per-stage records from the snapshot's real `article_stages` rows.
 *
 * Server keys map onto the UI's stage vocabulary (blueprint→intent,
 * validation→publish). A missing row (stage not yet reached, or a pre-fix
 * snapshot) renders as progress-only zeros, exactly as before, so old
 * snapshots and partial rows degrade gracefully.
 */
function stagesFor(job: ServerJob, stages: ServerStage[]): StageRecord[] {
  const running = job.status.toUpperCase() === "RUNNING";
  const failed = jobStatus(job.status) === "failed";
  const mine = new Map(stages.filter((s) => s.jobId === job.id).map((s) => [s.key, s]));
  return STAGES.map((stage, i) => {
    // Server key for this UI stage. `intent` is the server's `blueprint`,
    // `publish` its `validation`; the middle four share names.
    const serverKey =
      stage.key === "intent" ? "blueprint" : stage.key === "publish" ? "validation" : stage.key;
    const row = mine.get(serverKey);
    let status: StageRecord["status"] = "pending";
    if (row?.status.toUpperCase() === "COMPLETED") status = "done";
    else if (row && failed && row.status.toUpperCase() === "FAILED") status = "failed";
    else if (i < job.stageIndex) status = "done";
    else if (i === job.stageIndex && failed) status = "failed";
    else if (i === job.stageIndex && running) status = "running";
    return {
      key: stage.key,
      label: stage.label,
      status,
      tokens: row ? row.tokensIn + row.tokensOut : 0,
      durationMs: row?.durationMs ?? 0,
    };
  });
}

export function toUiJob(job: ServerJob, siteUid: string, stages: ServerStage[] = []): Job {
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
    stages: stagesFor(job, stages),
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

/**
 * Map a server link status onto the UI's `LinkState`.
 *
 * The server stores `LOCAL_INSERTED | VERIFIED | BROKEN | REMOVED`; the UI
 * understands `PLANNED | LOCAL | GHOST_PENDING | GHOST_CONFIRMED |
 * STATIC_CONFIRMED | FAILED | BROKEN`. VERIFIED means the link is live on the
 * published page.
 */
function linkState(status: string): LinkState {
  switch (status.toUpperCase()) {
    case "VERIFIED":
      return "STATIC_CONFIRMED";
    case "BROKEN":
      return "BROKEN";
    case "REMOVED":
      return "FAILED";
    case "LOCAL_INSERTED":
      return "LOCAL";
    default:
      return "LOCAL";
  }
}

export function toUiArticle(article: ServerArticle, siteUid: string, links: ServerLink[] = []): Article {
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
    // The byline the "Named author" checklist gate reads. Null on rows created
    // before the column existed, which the gate must treat as unknown.
    authorName: article.authorName ?? undefined,
    authorBeat: article.authorBeat ?? undefined,
    authorCity: article.authorCity ?? undefined,
    html: markdownToHtml(markdown),
    markdown,
    excerpt: meta?.excerpt ?? "",
    sections: sectionsFromMarkdown(markdown),
    metaTitle: meta?.metaTitle,
    metaDescription: meta?.metaDescription,
    status: articleStatus(article.status, markdown.trim().length > 0),
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
    links: links
      // Two filters, both needed:
      //  - only OUTGOING rows are this article's own link graph entries; an
      //    INCOMING row describes a link on some other page pointing here, so
      //    counting it as outbound would overstate this page's links;
      //  - only rows addressed to this article. The caller usually pre-groups,
      //    but this is public and must not hand an article another page's links
      //    (which would let the "two siblings" gate pass for the wrong reason).
      .filter((l) => l.articleId === article.id && l.direction.toUpperCase() === "OUTGOING")
      .map((l) => ({
        anchor: l.anchor,
        targetSlug: l.targetSlug ?? "",
        state: linkState(l.status),
      })),
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
    // The row's own creation stamp. This was hardcoded to 0, so every
    // server-backed article showed its age from 1970 ("20755d ago").
    publishedAt: article.createdAt ? Date.parse(article.createdAt) || 0 : 0,
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
    // The server sends an ISO timestamp and this used to hardcode 0, so every
    // server run rendered as "20754d ago" (1 Jan 1970).
    createdAt: run.createdAt ? Date.parse(run.createdAt) || 0 : 0,
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

  // Index the link rows once instead of scanning them per article.
  const linksByArticle = new Map<number, ServerLink[]>();
  for (const link of snapshot.links ?? []) {
    const bucket = linksByArticle.get(link.articleId);
    if (bucket) bucket.push(link);
    else linksByArticle.set(link.articleId, [link]);
  }

  // A row the operator deleted is gone, not a draft. Keeping it here meant the
  // next poll put every deleted article straight back on the page, which reads
  // as "deleting does nothing".
  const liveArticles = snapshot.articles.filter(
    (a) => a.status.toUpperCase() !== "DELETED",
  );

  return {
    jobs: [...snapshot.jobs.map((j) => toUiJob(j, siteUid, snapshot.stages ?? [])), ...keepLocalJobs],
    articles: [
      ...liveArticles.map((a) =>
        toUiArticle(a, siteUid, linksByArticle.get(a.id) ?? []),
      ),
      ...keepLocalArticles,
    ],
    runs: [
      ...snapshot.runs.map((r) => toUiRun(r, siteUid)),
      ...keepLocalRuns,
    ],
  };
}
