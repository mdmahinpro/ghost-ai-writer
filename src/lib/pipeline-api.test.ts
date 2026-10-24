/**
 * Contract tests for the server-pipeline client.
 *
 * These pin the snake_case → camelCase mapping and the request shape, because
 * a silent rename on either side (a Rust field renamed, or a mapping dropped)
 * would leave the UI rendering `undefined` for job progress rather than
 * failing loudly.
 */
import { test, afterEach } from "node:test";
import assert from "node:assert/strict";

import { enqueueKeywords, pipelineSnapshot } from "./pipeline-api.ts";

type Call = { url: string; init: RequestInit };

const realFetch = globalThis.fetch;
const calls: Call[] = [];

function stubFetch(reply: { status?: number; body: unknown; text?: string }) {
  calls.length = 0;
  globalThis.fetch = (async (url: string | URL, init?: RequestInit) => {
    calls.push({ url: String(url), init: init ?? {} });
    const status = reply.status ?? 200;
    const text = reply.text ?? JSON.stringify(reply.body);
    return {
      ok: status >= 200 && status < 300,
      status,
      text: async () => text,
    } as unknown as Response;
  }) as typeof fetch;
}

afterEach(() => {
  globalThis.fetch = realFetch;
});

test("a snapshot is mapped from snake_case to camelCase", async () => {
  stubFetch({
    body: {
      active: true,
      jobs: [
        {
          id: 7,
          run_id: 3,
          site_id: 1,
          keyword: "espresso machine",
          status: "RUNNING",
          stage: "draft",
          stage_index: 2,
          attempts: 1,
          last_error: null,
          article_id: null,
          tokens_in: 1910,
          tokens_out: 1422,
          cost_usd: 0.0421,
        },
      ],
      articles: [
        {
          id: 11,
          job_id: 7,
          site_id: 1,
          title: "Espresso",
          slug: "espresso",
          keyword: "espresso machine",
          status: "DRAFT",
          created_at: "2026-01-01T00:00:00Z",
          engine: "llm",
          uniqueness_score: 1.0,
          intent_match: 0.9,
          coverage_score: 0.8,
          featured_image_url: "https://example.com/i.jpg",
          featured_alt: "an espresso machine",
          content_json: '{"html":"<p>x</p>"}',
          meta_json: '{"excerpt":"y"}',
        },
      ],
      runs: [
        {
          id: 3,
          status: "RUNNING",
          created_at: "2026-01-01T00:00:00Z",
          completed_at: null,
          total: 2,
          completed: 1,
          failed: 0,
        },
      ],
    },
  });

  const res = await pipelineSnapshot({ workspaceId: 1 });
  assert.equal(res.ok, true);
  if (!res.ok) return;

  assert.equal(res.data.active, true);

  const job = res.data.jobs[0];
  assert.equal(job.runId, 3);
  assert.equal(job.siteId, 1);
  assert.equal(job.stageIndex, 2);
  assert.equal(job.articleId, null);
  assert.equal(job.tokensIn, 1910);
  assert.equal(job.tokensOut, 1422);
  assert.equal(job.costUsd, 0.0421);
  assert.equal(job.lastError, null);

  const article = res.data.articles[0];
  assert.equal(article.jobId, 7);
  assert.equal(article.uniquenessScore, 1.0);
  assert.equal(article.coverageScore, 0.8);
  assert.equal(article.featuredImageUrl, "https://example.com/i.jpg");
  assert.equal(article.contentJson, '{"html":"<p>x</p>"}');

  const run = res.data.runs[0];
  assert.equal(run.total, 2);
  assert.equal(run.completed, 1);
  assert.equal(run.completedAt, null);
});

test("the snapshot request carries workspace and optional site scope", async () => {
  stubFetch({ body: { jobs: [], articles: [], runs: [], active: false } });

  await pipelineSnapshot({ workspaceId: 4 });
  assert.match(calls[0].url, /\/api\/v1\/pipeline\/state\?/);
  assert.match(calls[0].url, /workspace_id=4/);
  assert.doesNotMatch(calls[0].url, /site_id=/);

  await pipelineSnapshot({ workspaceId: 4, siteId: 9 });
  assert.match(calls[1].url, /site_id=9/);
});

test("empty collections are tolerated rather than throwing", async () => {
  // A workspace with nothing queued still has to render.
  stubFetch({ body: { active: false } });
  const res = await pipelineSnapshot({ workspaceId: 1 });
  assert.equal(res.ok, true);
  if (!res.ok) return;
  assert.deepEqual(res.data.jobs, []);
  assert.deepEqual(res.data.articles, []);
  assert.deepEqual(res.data.runs, []);
  assert.equal(res.data.active, false);
});

test("enqueue posts snake_case and returns the camelCase run id", async () => {
  stubFetch({ status: 201, body: { inserted: 3, run_id: 42, elapsed_ms: 1 } });

  const res = await enqueueKeywords({
    workspaceId: 1,
    siteId: 2,
    keywords: ["a", "b", "c"],
  });
  assert.equal(res.ok, true);
  if (!res.ok) return;
  assert.equal(res.data.inserted, 3);
  assert.equal(res.data.runId, 42);

  const body = JSON.parse(String(calls[0].init.body));
  assert.deepEqual(body, {
    workspace_id: 1,
    site_id: 2,
    keywords: ["a", "b", "c"],
  });
  assert.equal(calls[0].init.method, "POST");
});

test("a backend error surfaces the server message, not a generic one", async () => {
  stubFetch({ status: 400, body: { error: "unknown workspace_id" } });

  const res = await enqueueKeywords({ workspaceId: 999, siteId: 1, keywords: ["a"] });
  assert.equal(res.ok, false);
  if (res.ok) return;
  assert.equal(res.status, 400);
  assert.equal(res.error, "unknown workspace_id");
});

test("a non-JSON body is reported, not thrown", async () => {
  stubFetch({ status: 502, body: null, text: "<html>bad gateway</html>" });

  const res = await pipelineSnapshot({ workspaceId: 1 });
  assert.equal(res.ok, false);
  if (res.ok) return;
  assert.match(res.error, /non-JSON response/);
});
