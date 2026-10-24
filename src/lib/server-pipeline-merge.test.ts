import { test } from "node:test";
import assert from "node:assert/strict";

import {
  mergeSnapshot,
  serverArticleId,
  serverJobId,
  serverRunId,
  toUiArticle,
  toUiJob,
  toUiRun,
} from "./server-pipeline-merge.ts";
import type { Article, Job, Run } from "./types.ts";
import type { PipelineSnapshot, ServerJob } from "./pipeline-api.ts";

const SITE = "site_ui_abc123";

function job(over: Partial<ServerJob> = {}): ServerJob {
  return {
    id: 7,
    runId: 3,
    siteId: 11,
    keyword: "descale espresso machine",
    status: "RUNNING",
    stage: "draft",
    stageIndex: 1,
    attempts: 1,
    lastError: null,
    articleId: null,
    tokensIn: 171,
    tokensOut: 366,
    costUsd: 0.004,
    ...over,
  };
}

function serverArticle(over: Record<string, unknown> = {}) {
  return {
    id: 4,
    jobId: 7,
    siteId: 11,
    title: "How to Descale an Espresso Machine",
    slug: "descale-espresso-machine",
    keyword: "descale espresso machine",
    status: "DRAFT",
    createdAt: null,
    engine: "llm",
    uniquenessScore: 0.92,
    intentMatch: 0.88,
    coverageScore: 0.9,
    featuredImageUrl: "https://img.example/descale.jpg",
    featuredAlt: "Descaler in a reservoir",
    contentJson: JSON.stringify({
      markdown: "## Why scale matters\n\nIt kills temperature stability.\n\n## How often\n\nEvery three months.",
      faq: [],
    }),
    metaJson: JSON.stringify({
      excerpt: "Scale ruins shots.",
      metaDescription: "A practical guide.",
      tags: ["espresso", "maintenance"],
    }),
    ...over,
  } as never;
}

test("a server job is marked read-only for the browser engine", () => {
  const ui = toUiJob(job(), SITE);
  // Without this the browser tick would advance the job too and pay twice.
  assert.equal(ui.origin, "server");
  assert.equal(ui.siteId, SITE);
  assert.equal(ui.status, "running");
  assert.equal(ui.id, serverJobId(7));
});

test("ids are namespaced so they cannot collide with browser uids", () => {
  assert.match(serverJobId(7), /^srv_job_7$/);
  assert.match(serverArticleId(4), /^srv_art_4$/);
  assert.match(serverRunId(3), /^srv_run_3$/);
});

test("job spend is the real ledger sum, not an estimate", () => {
  const ui = toUiJob(job({ tokensIn: 171, tokensOut: 366, costUsd: 0.0042 }), SITE);
  assert.equal(ui.tokens, 537);
  assert.equal(ui.costUsd, 0.0042);
});

test("stage records follow stageIndex", () => {
  const ui = toUiJob(job({ stageIndex: 2, status: "RUNNING" }), SITE);
  assert.deepEqual(
    ui.stages.map((s) => s.status),
    ["done", "done", "running", "pending", "pending", "pending"],
  );
});

test("a failed job marks the stage it died on", () => {
  const ui = toUiJob(job({ status: "FAILED", stageIndex: 2, lastError: "provider 400" }), SITE);
  assert.equal(ui.status, "failed");
  assert.equal(ui.stages[2].status, "failed");
  assert.equal(ui.failReason, "provider 400");
});

test("PARTIAL is surfaced as a failure rather than hidden", () => {
  // Every stage is implemented today, so a partial run means something went
  // wrong; showing it as done would hide that.
  assert.equal(toUiJob(job({ status: "PARTIAL" }), SITE).status, "failed");
});

test("article html and sections are derived from the server markdown", () => {
  const ui = toUiArticle(serverArticle() as never, SITE);
  assert.equal(ui.id, serverArticleId(4));
  assert.equal(ui.jobId, serverJobId(7));
  assert.match(ui.html, /<h2/i);
  assert.equal(ui.sections.length, 2);
  assert.equal(ui.sections[0].heading, "Why scale matters");
  assert.ok(ui.words > 5);
  assert.deepEqual(ui.tags, ["espresso", "maintenance"]);
  assert.equal(ui.excerpt, "Scale ruins shots.");
});

test("the featured image becomes an image record with its alt text", () => {
  const ui = toUiArticle(serverArticle() as never, SITE);
  assert.equal(ui.images.length, 1);
  assert.equal(ui.images[0].role, "featured");
  assert.equal(ui.images[0].src, "https://img.example/descale.jpg");
  assert.equal(ui.images[0].alt, "Descaler in a reservoir");
});

test("a malformed content payload does not blank the article row", () => {
  const ui = toUiArticle(serverArticle({ contentJson: "{not json" }) as never, SITE);
  assert.equal(ui.title, "How to Descale an Espresso Machine");
  assert.equal(ui.markdown, "");
  assert.equal(ui.words, 0);
});

test("a run reports its progress in the title", () => {
  const ui = toUiRun({ id: 3, status: "RUNNING", completed: 2, total: 5, failed: 1 } as never, SITE);
  assert.equal(ui.id, serverRunId(3));
  assert.equal(ui.status, "running");
  assert.match(ui.title, /2\/5 done/);
  assert.match(ui.title, /1 failed/);
});

test("merging replaces stale server rows and keeps local ones", () => {
  const localJob = { id: "job_local_1", siteId: SITE, origin: undefined } as unknown as Job;
  const oldServerJob = { id: serverJobId(7), siteId: SITE, origin: "server" } as Job;
  const localArticle = { id: "art_local_1", siteId: SITE } as Article;
  const oldServerArticle = { id: serverArticleId(9), siteId: SITE } as Article;
  const localRun = { id: "run_local_1", siteId: SITE } as Run;
  const oldServerRun = { id: serverRunId(1), siteId: SITE } as Run;

  const snapshot: PipelineSnapshot = {
    active: false,
    jobs: [job()],
    articles: [],
    runs: [],
  };

  const merged = mergeSnapshot(SITE, snapshot, {
    jobs: [localJob, oldServerJob],
    articles: [localArticle, oldServerArticle],
    runs: [localRun, oldServerRun],
  });

  const ids = merged.jobs.map((j) => j.id);
  assert.ok(ids.includes("job_local_1"), "local job must survive");
  assert.ok(ids.includes(serverJobId(7)), "fresh server job must be present");
  assert.equal(ids.filter((id) => id === serverJobId(7)).length, 1, "no duplicate server job");

  assert.deepEqual(
    merged.articles.map((a) => a.id),
    ["art_local_1"],
    "stale server article is dropped because the snapshot has none",
  );
  assert.deepEqual(merged.runs.map((r) => r.id), ["run_local_1"]);
});

test("merging leaves a different site's server rows alone", () => {
  const otherSiteServerJob = {
    id: serverJobId(1),
    siteId: "site_other",
    origin: "server",
  } as Job;

  const merged = mergeSnapshot(
    SITE,
    { active: false, jobs: [job()], articles: [], runs: [] } as PipelineSnapshot,
    { jobs: [otherSiteServerJob], articles: [], runs: [] },
  );

  assert.ok(merged.jobs.some((j) => j.id === serverJobId(1)));
});
