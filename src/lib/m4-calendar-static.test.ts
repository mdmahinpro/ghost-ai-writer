import { test } from "node:test";
import assert from "node:assert/strict";
import { DEFAULT_LIMITS, type AiKey, type Article, type Job, type Persisted, type Site, type TopicPlan } from "./types.ts";
import { AD_CODE_LIMIT, defaultAdSlots } from "./types.ts";
import { buildCalendar, migrateCalendar, publishSlots } from "./operator.ts";
import { localInventoryGhost, manualBuild, packageDeploy, queuePlan, resolveRouteDiff, routeDiffFor, submitKeywords } from "./engine.ts";
import { adCodeWithinLimit, adSlotHtml, adsConfigHash, injectInlineAd, inlineAdTargetOk, staticFiles } from "./static-site.ts";
import { reweaveDecision, reweavePutBody, withEdgeState } from "./reweave.ts";
import { mergeSnapshot } from "./server-pipeline-merge.ts";

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

function site(patch: Partial<Site> = {}): Site {
  return {
    id: "s1",
    name: "Test",
    createdAt: 0,
    staticName: "Test",
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
    authors: "Test",
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
    ghost: { mode: "studio", status: "connected", url: "studio://test", keyHint: "", version: "local-demo", corpus: "COMPLETE", inventory: [] },
    providers: [
      { id: "cpanel", name: "cPanel", capability: "FTPS", status: "verified", hint: "", ftp: { host: "ftp.example", user: "u", password: "p", path: "/", via: "ftps" } },
      { id: "cloudflare", name: "Cloudflare Pages", capability: "Direct upload", status: "configured", hint: "", api: { accountId: "acct", projectName: "proj", token: "cf-token" } },
      { id: "vercel", name: "Vercel", capability: "v13 deployments", status: "not_connected", hint: "" },
      { id: "github", name: "GitHub Pages", capability: "Contents API", status: "not_connected", hint: "" },
    ],
    setupStep: 8,
    setupSkipped: true,
    ...patch,
  };
}

function article(slug: string, patch: Partial<Article> = {}): Article {
  return {
    id: `art_${slug}`,
    siteId: "s1",
    jobId: "j1",
    title: slug.replace(/-/g, " "),
    slug,
    keyword: slug.replace(/-/g, " "),
    html: `${Array.from({ length: 6 }, (_, index) => `<p>Paragraph ${index + 1} of the article with enough text to count as a real block.</p>`).join("")}`,
    markdown: "Body.",
    excerpt: "Body.",
    sections: [],
    status: "published",
    engine: "llm",
    words: 120,
    uniqueness: 1,
    coverage: 1,
    intentMatch: 1,
    tags: [],
    mustCover: [],
    revisionNotes: "",
    images: [],
    links: [],
    stageTokens: [],
    verifyFlags: [],
    ledger: { mode: "draft", confirmed: true, dispatchedAt: 0, confirmedAt: 1, postId: "p1", shots: 1 },
    publishedAt: 1000,
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

test("Rule 6: calendar slot math is timezone-aware, DST-safe, and lead hours are subtracted", () => {
  // America/New_York DST starts 2026-03-08. Slots must keep 09:00 local on both sides.
  const from = Date.parse("2026-03-05T12:00:00Z");
  const slots = publishSlots({ count: 6, days: [0, 1, 2, 3, 4, 5, 6], perWeek: 7, hour: 9, minute: 0, timeZone: "America/New_York", from });
  assert.equal(slots.length, 6);
  assert.deepEqual(slots, [...slots].sort((a, b) => a - b), "slots are chronological");
  for (const slot of slots) {
    const local = new Intl.DateTimeFormat("en-GB", { timeZone: "America/New_York", hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).format(new Date(slot));
    assert.equal(local, "09:00", `slot ${new Date(slot).toISOString()} must be 09:00 local`);
  }
  // The DST shift changes the UTC offset by an hour across the boundary — proof the math is zone-correct.
  const before = slots.find((slot) => slot < Date.parse("2026-03-08T12:00:00Z"))!;
  const after = slots.find((slot) => slot > Date.parse("2026-03-09T00:00:00Z"))!;
  assert.equal(new Date(before).getUTCHours(), 14, "EST 09:00 local = 14:00Z");
  assert.equal(new Date(after).getUTCHours(), 13, "EDT 09:00 local = 13:00Z (DST moved the offset by one hour)");
});

test("Rule 6: buildCalendar is pillar-first and write_at = publish_at - lead hours", () => {
  const calendar = buildCalendar({
    siteId: "s1",
    name: "Spring",
    timezone: "America/New_York",
    activeDays: [1, 3, 5],
    articlesPerWeek: 3,
    publishTime: "09:00",
    generationLeadHours: 12,
    order: "pillars-first",
    publishMode: "published",
    topics: [
      { title: "Cluster one decides X", angle: "a", kind: "cluster" },
      { title: "Cluster two decides Y", angle: "b", kind: "cluster" },
      { title: "Pillar decides Z", angle: "c", kind: "pillar" },
    ],
    now: Date.parse("2026-03-05T12:00:00Z"),
  });
  assert.equal(calendar.items[0]!.kind, "pillar", "pillars-first ordering");
  assert.equal(calendar.items[0]!.status, "SCHEDULED");
  for (const item of calendar.items) {
    assert.equal(item.publishAt - item.writeAt, 12 * 3600000, "write_at is lead hours before publish_at");
    assert.notEqual(item.writeAt, item.publishAt);
  }
  assert.equal(calendar.autoGenerate, false);
  assert.equal(calendar.autoPublish, false);
  assert.equal(calendar.autoReweave, false);
  assert.equal(calendar.mode, "MANUAL");
  assert.match(calendar.cadence, /Mon, Wed, Fri/);
  assert.match(calendar.automation, /Automation off/);
});

test("Rule 6: a restored/migrated calendar never auto-enables the 3 switches", () => {
  const legacy = {
    id: "cal1",
    siteId: "s1",
    name: "Old",
    timezone: "Asia/Dhaka",
    days: [1, 3],
    perWeek: 5,
    publishHour: 7,
    publishMinute: 30,
    writeHoursAhead: 24,
    order: "pillars-first",
    autoWrite: true,
    autoPublish: true,
    createdAt: 1,
    items: [{ id: "i1", title: "T", angle: "a", kind: "cluster", writeAt: 10, publishAt: 20, status: "publish-held" }],
  } as unknown as Parameters<typeof migrateCalendar>[0];
  const migrated = migrateCalendar(legacy);
  assert.equal(migrated.autoGenerate, false, "autoWrite(true) must not become autoGenerate(true) on restore");
  assert.equal(migrated.autoPublish, false, "restore never re-enables publishing");
  assert.equal(migrated.autoReweave, false);
  assert.equal(migrated.mode, "MANUAL");
  assert.deepEqual(migrated.activeDays, [1, 3]);
  assert.equal(migrated.articlesPerWeek, 5);
  assert.equal(migrated.publishTime, "07:30");
  assert.equal(migrated.generationLeadHours, 24);
  assert.equal(migrated.items[0]!.status, "READY", "legacy publish-held maps to READY");
  // Even an already-modern calendar is forced off.
  const modern = migrateCalendar({ ...migrated, autoGenerate: true, autoPublish: true, autoReweave: true, mode: "AUTOMATED" });
  assert.equal(modern.autoGenerate, false);
  assert.equal(modern.autoPublish, false);
  assert.equal(modern.autoReweave, false);
});

test("Rule 6: ad slots — 16 KiB cap, deterministic hash, preview mode, placement rules", () => {
  const config = defaultAdSlots().map((slot) => (slot.id === "article_top" ? { ...slot, enabled: true, code: "<div>ad</div>" } : slot));
  const withAds = site({ adsEnabled: true, ads: config });
  const before = adsConfigHash(site());
  assert.equal(adsConfigHash(withAds), adsConfigHash(withAds), "hash is deterministic");
  assert.notEqual(adsConfigHash(withAds), before, "hash changes when config changes");
  assert.equal(adCodeWithinLimit("x".repeat(AD_CODE_LIMIT)), true);
  assert.equal(adCodeWithinLimit("x".repeat(AD_CODE_LIMIT + 1)), false, "16 KiB cap enforced");
  const html = adSlotHtml(withAds, "article_top");
  assert.ok(html.includes("<div>ad</div>"), "enabled slot renders code");
  assert.ok(html.includes('data-ad-slot="article_top"'));
  const preview = adSlotHtml(withAds, "article_top", true);
  assert.ok(!preview.includes("<div>ad</div>"), "preview never runs live ad code");
  assert.match(preview, /Ad slot · /);
  const disabled = adSlotHtml(site(), "article_top");
  assert.ok(!disabled.includes("<div>ad</div>"), "ads off ⇒ no ad code");
  // 16 KiB over-limit slot is refused with an honest comment.
  const over = site({ adsEnabled: true, ads: config.map((slot) => (slot.id === "article_top" ? { ...slot, code: "x".repeat(AD_CODE_LIMIT + 10) } : slot)) });
  assert.match(adSlotHtml(over, "article_top"), /exceeds the 16 KiB limit/);
  // placement: ≥6 paragraphs for inline, ≥7 posts for the feed slot
  assert.equal(inlineAdTargetOk("<p>1</p><p>2</p><p>3</p>"), false);
  assert.equal(inlineAdTargetOk(article("x").html), true);
  const injected = injectInlineAd(article("x").html, '<div id="ad"></div>');
  assert.equal((injected.match(/<p>Paragraph 3/g) ?? []).length, 1);
  assert.ok(injected.indexOf('id="ad"') > injected.indexOf("Paragraph 3"), "inline ad sits after paragraph 3");
  const short = injectInlineAd("<p>one</p><p>two</p>", '<div id="ad"></div>');
  assert.ok(!short.includes('id="ad"'), "short articles omit the inline slot");
  const six = [article("a"), article("b"), article("c"), article("d"), article("e"), article("f")];
  const seven = [...six, article("g")];
  const shortHome = staticFiles(site(), six, false, []).find((file) => file.name === "index.html")!;
  const longerHome = staticFiles(site({ adsEnabled: true, ads: config.map((slot) => (slot.id === "home_feed" ? { ...slot, enabled: true, code: "<div>feed-ad</div>" } : slot)) }), seven, false, []).find(
    (file) => file.name === "index.html",
  )!;
  assert.ok(!shortHome.text.includes("feed-ad"));
  assert.ok(longerHome.text.includes("feed-ad"), "home_feed renders with ≥7 posts");
  assert.ok(longerHome.text.indexOf("feed-ad") > longerHome.text.indexOf("Card"), "feed ad follows the sixth card");
});

test("Rule 6: ads.txt ships as a tracked build artifact", () => {
  const files = staticFiles(site({ adsTxt: "google.com, pub-123, DIRECT, f08c47fec0942fa0" }), [article("a")], true, []);
  const adsTxt = files.find((file) => file.name === "ads.txt");
  assert.ok(adsTxt, "ads.txt emitted when configured");
  assert.match(adsTxt!.text, /pub-123/);
  assert.equal(staticFiles(site(), [article("a")], true, []).some((file) => file.name === "ads.txt"), false, "no artifact when empty");
});

test("Rule 6: route-diff gate blocks a build that drops a live route and clears on acknowledgment", () => {
  const data = fixture({ articles: [article("a"), article("b")] });
  const first = staticFiles(site(), data.articles, true, []).map((file) => ({ ...file, hash: "h" }));
  const buildA = {
    id: "bldA",
    siteId: "s1",
    status: "succeeded" as const,
    pages: 2,
    bytes: 10,
    ms: 1,
    at: 1,
    auto: false,
    template: "classic-editorial",
    includedIds: data.articles.map((item) => item.id),
    excluded: [],
    artifact: first,
    routes: ["/", "/post/a/", "/post/b/"],
  };
  const withDeploy = {
    ...data,
    builds: [buildA],
    deploys: [{ id: "depA", siteId: "s1", buildId: "bldA", providerId: "cpanel", status: "verified" as const, at: 2, probe: "ok" }],
  };
  const prunedFiles = staticFiles(site(), [data.articles[0]!], true, []).map((file) => ({ ...file, hash: "h" }));
  const buildB = { ...buildA, id: "bldB", artifact: prunedFiles, routes: ["/", "/post/a/"] };
  const candidate = { ...withDeploy, builds: [buildB, buildA] };
  const diff = routeDiffFor(candidate, buildB);
  assert.deepEqual(diff.removedRoutes, ["/post/b/"]);
  assert.equal(diff.unchangedCount, 2);
  // Automatic deploy is held.
  const held = packageDeploy(candidate, "bldB", 10, { providerId: "cpanel" });
  assert.equal(held.hold, true);
  const holdDeploy = held.data.deploys.find((deploy) => deploy.buildId === "bldB")!;
  assert.equal(holdDeploy.status, "hold-route-diff");
  assert.deepEqual(holdDeploy.routeDiff?.removedRoutes, ["/post/b/"]);
  assert.equal(holdDeploy.routeDiff?.acknowledged, false);
  // Explicit acknowledgment proceeds.
  const acked = resolveRouteDiff(held.data, holdDeploy.id, "deploy-anyway", 11);
  assert.equal(acked.error, undefined);
  const released = acked.data.deploys.find((deploy) => deploy.id === holdDeploy.id)!;
  assert.equal(released.status, "packaged");
  assert.equal(released.routeDiff?.acknowledged, true);
  // A clean build (same routes plus one new page, no removals) deploys via an adapter with no hold.
  const grown = { ...withDeploy, builds: [{ ...buildA, id: "bldC", routes: ["/", "/post/a/", "/post/b/", "/post/c/"] }, buildA] };
  const clean = packageDeploy(grown, "bldC", 12, { providerId: "cloudflare" });
  assert.equal(clean.error, undefined);
  assert.equal(clean.hold, undefined);
  assert.equal(clean.data.deploys.find((deploy) => deploy.buildId === "bldC")?.providerId, "cloudflare");
  // An unverified API provider is refused with a clear instruction.
  const unverified = { ...grown, sites: [{ ...site(), providers: site().providers.map((provider) => (provider.id === "vercel" ? { ...provider, status: "not_connected" as const } : provider)) }] };
  assert.match(packageDeploy(unverified, "bldC", 13, { providerId: "vercel" }).error ?? "", /Connect and verify/);
});

test("Rule 6: Ghost PUT re-weave — optimistic lock payload + LinkEdge transitions", () => {
  assert.equal(reweaveDecision({ remoteUpdatedAt: "2026-01-01T00:00:00.000Z", expectedUpdatedAt: "2026-01-01T00:00:00.000Z" }), "proceed");
  assert.equal(reweaveDecision({ remoteUpdatedAt: "2026-02-02T00:00:00.000Z", expectedUpdatedAt: "2026-01-01T00:00:00.000Z" }), "skip-stale", "hand-edited post is protected");
  assert.equal(reweaveDecision({ remoteUpdatedAt: "2026-02-02T00:00:00.000Z", expectedUpdatedAt: "2026-01-01T00:00:00.000Z", acknowledgeHandEdited: true }), "proceed");
  assert.equal(reweaveDecision({ remoteUpdatedAt: "2026-02-02T00:00:00.000Z" }), "proceed", "no local lock ⇒ first write proceeds");
  const body = reweavePutBody("<p>new</p>", "2026-02-02T00:00:00.000Z");
  assert.deepEqual(body, { posts: [{ html: "<p>new</p>", updated_at: "2026-02-02T00:00:00.000Z" }] });
  const links = [
    { anchor: "a", targetSlug: "post-a", state: "LOCAL" as const },
    { anchor: "b", targetSlug: "post-b", state: "LOCAL" as const },
  ];
  const confirmed = withEdgeState(links, "post-a", "GHOST_CONFIRMED");
  assert.equal(confirmed[0]!.state, "GHOST_CONFIRMED");
  assert.equal(confirmed[1]!.state, "LOCAL", "other edges untouched");
  assert.equal(withEdgeState(links, "post-b", "FAILED")[1]!.state, "FAILED");
});

test("a published article nothing links to is still built, never dropped as an orphan", () => {
  // Two published articles with no internal links between them: every page is an
  // orphan. Excluding orphans used to leave nothing, fail the build, and take the
  // whole site down over what is only a linking warning.
  const data = fixture({ articles: [article("alpha"), article("beta")] });
  const build = manualBuild(data, "s1", 1000).builds[0]!;
  assert.equal(build.status, "succeeded");
  assert.equal(build.pages, 2, "both orphaned articles are published");
  assert.equal(build.includedIds.length, 2);
  assert.equal(build.excluded.some((row) => row.reason === "orphan"), false, "orphan is not an exclusion reason");
  const files = build.artifact.map((file) => file.name);
  assert.ok(files.some((name) => name.includes("alpha")), `expected a page for alpha: ${files.join(", ")}`);
  assert.ok(files.some((name) => name.includes("beta")), `expected a page for beta: ${files.join(", ")}`);
});

test("a build with nothing publishable still fails, and the reason names the scope checks", () => {
  const data = fixture({ articles: [article("alpha", { status: "draft" }), article("beta", { status: "draft" })] });
  const build = manualBuild(data, "s1", 1000).builds[0]!;
  assert.equal(build.status, "failed");
  assert.match(build.detail ?? "", /nothing is publishable/);
  assert.match(build.detail ?? "", /2 still draft/, "the operator is told what actually blocked it");
  assert.equal(build.excluded.every((row) => row.reason === "draft"), true);
  assert.equal(build.artifact.length, 0, "a failed build ships no files");
});

test("a build blocked by a failed gate says so instead of blaming orphans", () => {
  // Only id and status are read off the source job here.
  const job = { id: "j1", status: "failed" } as unknown as Job;
  const data = fixture({ articles: [article("alpha")], jobs: [job] });
  const build = manualBuild(data, "s1", 1000).builds[0]!;
  assert.equal(build.status, "failed");
  assert.match(build.detail ?? "", /held by a failed gate/);
  assert.equal(build.excluded[0]?.reason, "failed gate");
});

function topicPlan(patch: Partial<TopicPlan> = {}): TopicPlan {
  return {
    id: "p1",
    siteId: "s1",
    topic: "immigration clocks",
    pillarTitle: "Pillar on immigration clocks",
    pillarAngle: "cover the whole subject",
    clusters: [
      { id: "c1", title: "Cluster one explains alpha", angle: "a", excluded: false },
      { id: "c2", title: "Cluster two explains beta", angle: "b", excluded: false },
      { id: "c3", title: "Cluster three explains gamma", angle: "c", excluded: false },
    ],
    status: "review",
    createdAt: 0,
    ...patch,
  };
}

test("a sync that cannot read Ghost still completes the corpus from the studio's own articles", () => {
  // This is the state a failed sync used to leave behind: corpus stuck in
  // SYNCING (or EMPTY) with an empty inventory, so every run was refused and
  // the UI offered no way out.
  const wedged = {
    ...site().ghost,
    status: "error" as const,
    corpus: "SYNCING" as const,
    inventory: [],
    inventorySource: undefined,
    lastError: "ghost http: connection refused",
  };
  const ghost = localInventoryGhost(wedged, [article("alpha"), article("beta")], "s1", 1000);
  assert.equal(ghost.corpus, "COMPLETE", "runs are no longer refused behind a stuck sync");
  assert.equal(ghost.inventorySource, "local-demo", "the UI says Ghost was not read");
  assert.equal(ghost.inventory.length, 2, "the studio's own articles become the inventory");
  assert.equal(ghost.lastError, "ghost http: connection refused", "the connection error is kept for the operator");
});

test("a held server row reaches a built page instead of being dropped as a draft", () => {
  // The reported failure, end to end: the pipeline finished the article and the
  // Ghost push never happened, so the row is REVIEW_HELD with sealed content.
  // The merge used to call that "draft", the build refused every page, and the
  // site could not be built at all.
  const raw = {
    id: 4,
    jobId: 7,
    siteId: 11,
    title: "How to Descale an Espresso Machine",
    slug: "descale-espresso-machine",
    keyword: "descale espresso machine",
    status: "REVIEW_HELD",
    createdAt: null,
    engine: "llm",
    uniquenessScore: 0.92,
    intentMatch: 0.88,
    coverageScore: 0.9,
    featuredImageUrl: null,
    featuredAlt: null,
    contentJson: JSON.stringify({ markdown: "## Why scale matters\n\nIt kills temperature stability in the group head.\n\n## How often\n\nEvery three months, more with hard water.", faq: [] }),
    metaJson: JSON.stringify({ excerpt: "Scale ruins shots.", metaDescription: "A practical guide.", tags: ["espresso"] }),
    authorName: "Elena Whitfield",
    authorSlug: "elena-whitfield-espresso",
    authorBeat: "espresso maintenance",
    authorCity: "Portland",
  };
  const merged = mergeSnapshot(
    "s1",
    { jobs: [], articles: [raw as never], runs: [], stages: [], links: [], active: false },
    { jobs: [], articles: [], runs: [] },
  );
  assert.equal(merged.articles.length, 1);
  assert.equal(merged.articles[0]!.status, "published", "the held row is publishable");
  const build = manualBuild({ ...fixture(), articles: merged.articles }, "s1", 1000).builds[0]!;
  assert.equal(build.status, "succeeded", build.detail ?? "");
  assert.equal(build.pages, 1, "the article reaches a built page");
});

test("a topic plan queues its clusters instead of refusing each one as a duplicate of itself", async () => {
  // The plan's own pillar and clusters are part of the corpus a gate reads, so
  // gating a cluster against the corpus it belongs to matched the cluster
  // against itself — L1-exact — and every cluster of every plan was refused.
  const broken = site({ ghost: { ...site().ghost, status: "error", url: "https://cms.example", lastError: "Ghost refused the Admin API key." } });
  const data = fixture({ sites: [broken], plans: [topicPlan()] });
  const queued = await queuePlan(data, "p1", 1000, { publishMode: "draft" });
  assert.equal(queued.error, undefined, `queueing must not be refused: ${queued.error ?? ""}`);
  const jobs = queued.data.jobs.filter((job) => job.runId === queued.runId);
  assert.equal(jobs.length, 4, "three clusters and the pillar are queued");
  assert.equal(jobs.filter((job) => job.status === "refused").length, 0, "no cluster is refused as its own duplicate");
  assert.equal(queued.data.plans[0]!.status, "queued");
});

test("a plan cluster that matches a page the site already carries is still refused", async () => {
  // The guard has to keep working: only the plan's own entries are dropped from
  // the corpus, not the articles the site already published.
  const data = fixture({
    articles: [article("cluster-one-explains-alpha", { title: "Cluster one explains alpha", keyword: "cluster one explains alpha" })],
    plans: [topicPlan()],
  });
  const queued = await queuePlan(data, "p1", 1000, { publishMode: "draft" });
  assert.equal(queued.error, undefined);
  const jobs = queued.data.jobs.filter((job) => job.runId === queued.runId);
  assert.equal(jobs.length, 4, "all three clusters plus the pillar are on the run");
  const refused = jobs.filter((job) => job.status === "refused");
  assert.equal(refused.length, 1, "the cluster the site already carries is refused");
  assert.equal(refused[0]!.keyword, "cluster one explains alpha");
  assert.match(refused[0]!.refusalReason ?? "", /DUPLICATE REFUSED/);
});

test("a run is refused by an empty corpus, not by a Ghost that is merely disconnected", async () => {
  const broken = { ...site().ghost, status: "error" as const, url: "https://cms.example", lastError: "Ghost refused the Admin API key." };
  const ready = fixture({ sites: [site({ ghost: { ...broken, corpus: "COMPLETE" } })] });
  const intake = await submitKeywords(ready, {
    siteId: "s1",
    lines: "how to keep research notes that survive week three",
    publishMode: "draft",
    modelKeyId: "default",
    allowVariants: false,
    now: 1_000_000,
  });
  assert.equal(intake.error, undefined, `a broken Ghost connection must not block writing: ${intake.error ?? ""}`);
  assert.equal(intake.data.jobs.length, 1);

  const empty = fixture({ sites: [site({ ghost: { ...broken, corpus: "EMPTY" } })] });
  const refused = await submitKeywords(empty, {
    siteId: "s1",
    lines: "how to keep research notes that survive week three",
    publishMode: "draft",
    modelKeyId: "default",
    allowVariants: false,
    now: 1_000_000,
  });
  assert.match(refused.error ?? "", /Corpus is EMPTY/);
});
