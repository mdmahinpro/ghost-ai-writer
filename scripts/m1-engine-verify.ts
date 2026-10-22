/**
 * Milestone 1 engine verification (Rules 1 + 4 + 5).
 * Run: npx vite-node scripts/m1-engine-verify.ts
 *
 * Vite resolves the app's extensionless TS imports, so this exercises the real
 * engine functions (limits, large-batch intake, key pool, restart cap) as they
 * ship. Exits non-zero on the first failure.
 */
import assert from "node:assert/strict";
import { DEFAULT_LIMITS, type AiKey, type Job, type Persisted, type Site } from "../src/lib/types";
import { addToCorpusIndex, buildCorpusIndex, gateAgainstIndex, keyPool, limitsOf, restartJob, submitKeywords } from "../src/lib/engine";
import { classifyLines } from "../src/lib/operator";

let passed = 0;
const failures: string[] = [];
async function check(name: string, fn: () => void | Promise<void>) {
  try {
    await fn();
    passed += 1;
    console.log(`  ok  ${name}`);
  } catch (error) {
    failures.push(`${name}: ${error instanceof Error ? error.message : String(error)}`);
    console.log(`FAIL  ${name}`);
  }
}

function key(overrides: Partial<AiKey> = {}): AiKey {
  return {
    id: "k1",
    provider: "OpenAI",
    model: "gpt-5.6-luna",
    label: "primary",
    hint: "••••1",
    priority: 100,
    chat: true,
    semantic: false,
    allowanceUsd: 1000,
    disabled: false,
    pricePerM: 0.7,
    baseUrl: "https://api.example/v1",
    secret: "sk-test",
    ...overrides,
  };
}

function site(): Site {
  return {
    id: "s1",
    name: "Test",
    createdAt: 0,
    staticName: "Test",
    nicheTag: "notes",
    publicUrl: "https://notes.example",
    logoUrl: "",
    faviconUrl: "",
    robots: "index,follow",
    footer: "",
    headerMenu: "",
    footerMenu: "",
    headHtml: "",
    bodyEnd: "",
    analyticsSnippet: "",
    autoRebuild: false,
    pendingRebuildAt: null,
    template: "classic-editorial",
    authors: "Test",
    voice: {
      modelKeyId: "k1",
      publishAs: "draft",
      tone: "clear",
      sections: 5,
      sectionImages: 1,
      linkIntensity: "standard",
      voice: "clear",
      imageProvider: "bing",
      bannedPhrases: [],
      brandFacts: [],
      pov: "third-person",
      readingLevel: "general",
    },
    ghost: { mode: "studio", status: "connected", url: "studio://test", keyHint: "", version: "local-demo", corpus: "COMPLETE", inventory: [] },
    providers: [],
    setupStep: 8,
    setupSkipped: true,
  };
}

function fixture(patch: Partial<Persisted> = {}): Persisted {
  return {
    activeSiteId: "s1",
    sites: [site()],
    runs: [],
    jobs: [],
    articles: [],
    plans: [],
    events: [],
    keys: [key()],
    builds: [],
    deploys: [],
    audits: [],
    activity: [],
    account: { name: "T", email: "t@example.com", emailVerified: true, adminApproved: true, sessions: [] },
    defaults: site().voice,
    ideas: null,
    notice: null,
    authors: [],
    humanizerKeys: [],
    humanizerCursor: 0,
    firecrawl: { secret: "", hint: "" },
    calendars: [],
    research: [],
    workerPaused: false,
    backups: [],
    corpus: [],
    limits: { ...DEFAULT_LIMITS },
    webSearch: { mode: "off", tavilyKeys: [], firecrawlKeys: [], tavilyCursor: 0, firecrawlCursor: 0 },
    ...patch,
  };
}

/** Lexically distinct keywords so duplicate protection is not the thing under test. */
function distinct(n: number): string {
  return Array.from({ length: n }, (_, i) => `kw${i.toString(36).padStart(4, "0")}x${(i * 7919).toString(36)}`).join("\n");
}

function failedJob(): Job {
  return {
    id: "job1",
    runId: "run1",
    siteId: "s1",
    keyword: "a keyword",
    title: "A keyword",
    kind: "keyword",
    variant: false,
    dependsOn: [],
    status: "failed",
    stageIndex: 1,
    stages: [],
    shots: 0,
    tokens: 0,
    costUsd: 0,
    createdAt: 0,
  };
}

console.log("Milestone 1 engine verification\n");

await check("Rule 1: keyword cap defaults to unlimited", () => {
  assert.equal(limitsOf(fixture()).keywordCap, null);
  assert.equal(DEFAULT_LIMITS.concurrency > 2, true);
});

await check("Rule 1: 250 keywords all become jobs with no cap error (dedupe may hold close calls)", async () => {
  const data = fixture();
  const lines = distinct(250);
  const result = await submitKeywords(data, { siteId: "s1", lines, publishMode: "draft", modelKeyId: "default", allowVariants: false, now: 1000 });
  assert.equal(result.error, undefined);
  assert.ok(result.runId);
  const jobs = result.data.jobs.filter((job) => job.runId === result.runId);
  assert.equal(jobs.length, 250);
  assert.equal(jobs.filter((job) => job.status === "failed" || job.status === "cancelled").length, 0);
  assert.ok(jobs.filter((job) => job.status === "queued").length >= 100, "most keywords should queue");
});

await check("Rule 1: a configured cap still enforces", async () => {
  const data = fixture({ limits: { ...DEFAULT_LIMITS, keywordCap: 3 } });
  const result = await submitKeywords(data, { siteId: "s1", lines: ["one alpha", "two beta", "three gamma", "four delta"].join("\n"), publishMode: "draft", modelKeyId: "default", allowVariants: false, now: 1000 });
  assert.match(result.error ?? "", /caps a run at 3/i);
  assert.equal(result.runId, undefined);
});

await check("Rule 1: 10,000 keywords stay bounded by the intake index over a 500-page corpus", async () => {
  const corpus = Array.from({ length: 500 }, (_, i) => ({
    id: `c${i}`,
    siteId: "s1",
    title: `Existing page ${i}`,
    keyword: `existing page ${i}`,
    slug: `existing-page-${i}`,
    permalink: "",
    embedding: [] as number[],
    embedSource: "hash-fallback" as const,
    createdAt: 0,
  }));
  const data = fixture({ corpus });
  const lines = distinct(10000);
  const started = Date.now();
  const result = await submitKeywords(data, { siteId: "s1", lines, publishMode: "draft", modelKeyId: "default", allowVariants: false, now: 1000 });
  assert.equal(result.error, undefined);
  assert.equal(result.data.jobs.filter((job) => job.runId === result.runId).length, 10000);
  const sample = result.data.jobs.find((job) => job.runId === result.runId);
  assert.match(sample?.embedNote ?? "", /Large-batch gate/);
  assert.ok(Date.now() - started < 60000, `10,000-keyword intake took ${Date.now() - started}ms`);
});

await check("Rule 1: index gate refuses L1/L2, passes distinct, blocks same-batch repeats", () => {
  const index = buildCorpusIndex([
    { keyword: "phd funding", title: "PhD funding", slug: "phd-funding" },
    { keyword: "weekly cadence", title: "A weekly writing cadence", slug: "a-weekly-writing-cadence" },
  ]);
  assert.equal(gateAgainstIndex("phd funding", "PhD funding", index, false).ok, false);
  assert.equal(gateAgainstIndex("a weekly writing cadence tips", "A weekly writing cadence tips", index, false).ok, false);
  assert.equal(gateAgainstIndex("cold brew ratios", "Cold brew ratios", index, false).ok, true);
  addToCorpusIndex(index, { keyword: "cold brew ratios", title: "Cold brew ratios", slug: "cold-brew-ratios" });
  assert.equal(gateAgainstIndex("cold brew ratios", "Cold brew ratios", index, false).ok, false);
});

await check("Rule 4: keyPool pins the preferred healthy key first, orders the rest by priority, and demotes (never drops) cooling/disabled keys", () => {
  const now = 100_000;
  const data = fixture({
    keys: [
      key({ id: "low", priority: 10 }),
      key({ id: "primary", priority: 5 }),
      key({ id: "off", priority: 999, disabled: true }),
      key({ id: "cooling", priority: 900, cooldownUntil: now + 60_000 }),
      key({ id: "broke", priority: 800, allowanceUsd: 0 }),
    ],
  });
  const pool = keyPool(data, "primary", now).map((k) => k.id);
  assert.equal(pool[0], "primary", "the preferred healthy key leads the pool");
  assert.equal(pool.length, 5, "every saved key stays in the pool — demote, never drop");
  assert.deepEqual(pool, ["primary", "broke", "low", "cooling", "off"]);
  assert.ok(pool.indexOf("cooling") > pool.indexOf("low"), "an active 429 window demotes a key behind the healthy ones");
  assert.equal(pool[pool.length - 1], "off", "a disabled key is tried last, never removed");
});

await check("Rule 1: restart limit is enforced only when configured", () => {
  assert.equal(restartJob(fixture({ jobs: [failedJob()] }), "job1", 2000, true).error, undefined);
  assert.match(restartJob(fixture({ jobs: [failedJob()], limits: { ...DEFAULT_LIMITS, restartLimit: 0 } }), "job1", 2000).error ?? "", /Restart limit reached/);
});

await check("Rule 1: classifyLines is unlimited by default, caps when asked", () => {
  const raw = Array.from({ length: 150 }, (_, i) => `kw ${i}`).join("\n");
  assert.equal(classifyLines(raw, null).kept.length, 150);
  assert.equal(classifyLines(raw, 100).kept.length, 100);
  assert.equal(classifyLines(raw, 100).marks.filter((m) => m.state === "over-limit").length, 50);
});

console.log(`\n${passed} passed, ${failures.length} failed`);
if (failures.length) {
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}
