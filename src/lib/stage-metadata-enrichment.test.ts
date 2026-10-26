import assert from "node:assert/strict";
import test from "node:test";
import { DEFAULT_LIMITS, defaultAdSlots, type AiKey, type Article, type Persisted, type Site } from "./types.ts";
import { advance, uniqueSlug, submitKeywords } from "./engine.ts";
import { embeddingProvider } from "./embed-key.ts";
import { embeddingModelFor } from "./model-catalog.ts";
import { parseEnrichmentStage, parseMetadataStage } from "./stage-contracts.ts";

function key(overrides: Partial<AiKey> = {}): AiKey {
  return {
    id: "k1",
    provider: "OpenAI",
    model: "gpt-5.6-luna",
    label: "live",
    hint: "••••",
    priority: 100,
    chat: true,
    semantic: true,
    allowanceUsd: 1000,
    disabled: false,
    pricePerM: 0.7,
    // A saved key belongs to the workspace that saved it — and only that one.
    siteId: "s1",
    baseUrl: "https://api.openai.com/v1",
    secret: "sk-test-key",
    providerKind: "openai",
    ...overrides,
  };
}

function site(patch: Partial<Site> = {}): Site {
  return {
    id: "s1",
    name: "Northline Review",
    createdAt: 0,
    staticName: "Northline Review",
    nicheTag: "research craft",
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
    authors: "Northline",
    autoAuthors: true,
    adsEnabled: false,
    ads: defaultAdSlots(),
    adsTxt: "",
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
    ghost: { mode: "studio", status: "connected", url: "studio://test", keyHint: "", adminKey: "id:deadbeef", version: "local-demo", corpus: "COMPLETE", inventory: [] },
    providers: [],
    setupStep: 8,
    setupSkipped: true,
    ...patch,
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
    firecrawl: { secret: "", hint: "" },
    calendars: [],
    research: [],
    workerPaused: false,
    worker: { lastBeatAt: 0, online: false, activeJobs: 0, source: "browser" },
    backups: [],
    corpus: [],
    limits: { ...DEFAULT_LIMITS },
    webSearch: { mode: "off", tavilyKeys: [], firecrawlKeys: [], tavilyCursor: 0, firecrawlCursor: 0 },
    ...patch,
  };
}

test("Part A: embedding routing uses a semantic model, never the chat model", () => {
  const openai = embeddingProvider(key());
  assert.equal(openai.model, "text-embedding-3-small");
  assert.ok(openai.provider, "openai key exposes a provider embedder");

  const explicit = embeddingProvider(key({ providerKind: "custom", provider: "Custom", embeddingModel: "bge-large" }));
  assert.equal(explicit.model, "bge-large");

  const noModel = embeddingProvider(key({ providerKind: "openrouter", provider: "OpenRouter" }));
  assert.equal(noModel.model, undefined, "openrouter has no default embeddings route");
  assert.equal(noModel.provider, undefined, "no provider → honest hash fallback");

  const noSecret = embeddingProvider(key({ secret: "" }));
  assert.equal(noSecret.provider, undefined, "a key without a secret cannot embed");

  assert.equal(embeddingModelFor({ provider: "OpenAI", providerKind: "openai" }), "text-embedding-3-small");
  assert.equal(embeddingModelFor({ provider: "Custom", providerKind: "custom" }), undefined);
});

test("Part B: stage 4 metadata schema enforces the GOVERNOR §4 limits", () => {
  const good = parseMetadataStage(
    JSON.stringify({ title: "Notes that survive week three", metaDescription: "A weekly routine for keeping research notes alive.", slug: "notes-survive-week-three", tags: ["research craft"], excerpt: "Keep one page per week." }),
  );
  assert.equal(good.slug, "notes-survive-week-three");
  assert.throws(() => parseMetadataStage(JSON.stringify({ title: "x".repeat(61), metaDescription: "ok", slug: "a", tags: [], excerpt: "b" })), /metadata schema validation failed/);
  assert.throws(() => parseMetadataStage("not json"), /metadata schema validation failed/);
});

test("Part B: stage 5 enrichment schema keeps links and image queries shaped", () => {
  const good = parseEnrichmentStage(
    JSON.stringify({ links: [{ anchor: "weekly review", slug: "weekly-review-routine" }], imageQueries: [{ query: "research notes desk", alt: "A desk with notebooks", role: "featured" }] }),
  );
  assert.equal(good.links[0]!.slug, "weekly-review-routine");
  assert.throws(() => parseEnrichmentStage(JSON.stringify({ links: [], imageQueries: [{ query: "x", alt: "y", role: "hero" }] })), /enrichment schema validation failed/);
});

test("Part B: uniqueSlug suffixes on collision instead of refusing", () => {
  assert.equal(uniqueSlug("Weekly Planning", ["other"]), "weekly-planning");
  assert.equal(uniqueSlug("Weekly Planning", ["weekly-planning"]), "weekly-planning-2");
  assert.equal(uniqueSlug("Weekly Planning", ["weekly-planning", "weekly-planning-2"]), "weekly-planning-3");
});

function scriptedChat() {
  const draft = `## What the routine is\n\nA weekly review keeps research notes usable. ${"It turns scattered reading into one page you can act on. ".repeat(4)}\n\n## How to start\n\nSet a fixed hour, open every note from the week, and rewrite the useful parts.`;
  return {
    async callModel({ system, validate, preferredKeyId }: { system: string; user: string; validate: (text: string) => string; preferredKeyId?: string }) {
      const keyId = preferredKeyId ?? "k1";
      let text: string;
      if (system.includes("intent and blueprint")) {
        text = JSON.stringify({ intent: "Answer how to keep research notes alive", audience: "researchers", answerBlock: "A short weekly review keeps research notes usable by rewriting only the parts you will act on, so the pile never becomes an archive you avoid opening.", questionH2s: ["What is a weekly review?", "How do you start one?"], tablePlan: false, mustCover: ["What a weekly review is", "How to start one", "Why notes decay"] });
      } else if (system.includes("Stage 4 (Metadata")) {
        text = JSON.stringify({ title: "A weekly review routine that keeps notes alive", metaDescription: "A short weekly routine that keeps research notes usable instead of buried.", slug: "weekly-review-routine-notes", tags: ["research craft"], excerpt: "Keep one page per week of research." });
      } else if (system.includes("Stage 5 (Site Enrichment")) {
        text = JSON.stringify({ links: [{ anchor: "weekly review", slug: "scoping-a-research-question" }, { anchor: "made-up", slug: "invented-slug-not-published" }], imageQueries: [{ query: "research notebooks desk", alt: "A desk with open research notebooks", role: "featured" }, { query: "weekly review whiteboard", alt: "A whiteboard with a weekly plan", role: "section" }] });
      } else if (system.includes("Stage 3 (Revision")) {
        text = JSON.stringify({ markdown: draft, verifyFlags: [] });
      } else if (system.includes("You write a US staff article")) {
        text = JSON.stringify({ markdown: draft });
      } else {
        throw new Error(`scripted chat saw an unknown stage prompt: ${system.slice(0, 60)}`);
      }
      const problem = validate(text);
      if (problem) throw new Error(problem);
      return { keyId, text, usage: { prompt: 12, completion: 18, total: 30 } };
    },
  };
}

test("Part B: stages 4 and 5 run as model stages and record tokens + packaged output", async () => {
  const published: Article = {
    id: "art-pub",
    siteId: "s1",
    jobId: "job-pub",
    title: "Scoping a research question in one page",
    slug: "scoping-a-research-question",
    keyword: "scoping a research question",
    html: "<p>body</p>",
    markdown: "body",
    excerpt: "A one-page scope.",
    sections: [{ heading: "Scope", paragraphs: ["body"] }],
    status: "published",
    engine: "llm",
    words: 120,
    uniqueness: 0.9,
    coverage: 1,
    intentMatch: 1,
    tags: ["research craft"],
    mustCover: [],
    revisionNotes: "",
    images: [],
    links: [],
    stageTokens: [0, 0, 0, 0, 0, 0],
    verifyFlags: [],
    ledger: { mode: "draft", confirmed: true, dispatchedAt: 0, confirmedAt: 0, postId: "gst1", shots: 1 },
    publishedAt: 1,
  };
  let data = fixture({ articles: [published] });
  const intake = await submitKeywords(data, { siteId: "s1", lines: "a weekly review routine that keeps research notes alive", publishMode: "draft", modelKeyId: "default", allowVariants: false, now: 1_000_000 });
  assert.equal(intake.error, undefined);
  data = intake.data;
  const jobId = data.jobs[0]!.id;

  let clock = 2_000_000;
  const chat = scriptedChat();
  for (let step = 0; step < 40; step += 1) {
    if (data.jobs.find((item) => item.id === jobId)?.status === "completed") break;
    data = await advance(data, (clock += 6_000), { chat });
  }
  const job = data.jobs.find((item) => item.id === jobId)!;
  assert.equal(job.status, "completed", `job finished (status ${job.status}, reason ${job.failReason ?? job.refusalReason ?? "n/a"})`);
  const stage = (keyName: string) => job.stages.find((row) => row.key === keyName)!;
  assert.ok(stage("intent").tokens > 0, "stage 1 charged tokens");
  assert.ok(stage("draft").tokens > 0, "stage 2 charged tokens");
  assert.ok(stage("revision").tokens > 0, "stage 3 charged tokens");
  assert.equal(stage("metadata").tokens, 30, "stage 4 is a real model stage now");
  assert.equal(stage("enrichment").tokens, 30, "stage 5 is a real model stage now");
  assert.equal(stage("publish").tokens, 0, "stage 6 stays no-LLM");
  assert.equal(job.modelUsage?.metadata?.total, 30);
  assert.equal(job.modelUsage?.enrichment?.total, 30);

  const article = data.articles.find((item) => item.jobId === jobId)!;
  assert.equal(article.slug, "weekly-review-routine-notes", "stage 4 slug landed on the article");
  assert.equal(article.metaTitle, "A weekly review routine that keeps notes alive");
  assert.match(article.metaDescription!, /weekly routine/i);
  // GOVERNOR §4: urls come from published inventory only — the invented slug is dropped.
  assert.deepEqual(article.links.map((link) => link.targetSlug), ["scoping-a-research-question"]);
  assert.ok(article.images.some((image) => image.query === "research notebooks desk"), "stage 5 image queries reached the plan");
});
