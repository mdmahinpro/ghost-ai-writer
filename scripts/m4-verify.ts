/**
 * Milestone 4 verification — Calendar 100% + Ad-Ready Static + Deploy Providers (Rule 6).
 * Run: npm run test:m4
 * Exercises the real operator/engine/static-site/reweave/worker/ops modules:
 * independent automation switches driven through a real offline pipeline run,
 * DST-safe slot math, backup-restore switch safety, 7 ad slots + ads.txt,
 * the route-diff gate, the Ghost PUT optimistic lock, adapter payload guards,
 * and the single-dispatch lease. Exits non-zero on the first failure.
 */
import assert from "node:assert/strict";
import { AD_CODE_LIMIT, DEFAULT_LIMITS, defaultAdSlots, type AiKey, type Article, type Persisted, type Site } from "../src/lib/types";
import { buildCalendar, migrateCalendar, pulseCalendars, publishSlots } from "../src/lib/operator";
import { advance, packageDeploy, resolveRouteDiff, routeDiffFor } from "../src/lib/engine";
import { adCodeWithinLimit, adSlotHtml, adsConfigHash, injectInlineAd, inlineAdTargetOk, staticFiles } from "../src/lib/static-site";
import { reweaveDecision, reweavePutBody, withEdgeState } from "../src/lib/reweave";
import { leaseDecision } from "../src/lib/worker.functions";
import { DEPLOY_HOSTS, readDeployFiles } from "../src/lib/ops.functions";

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
    provider: "Studio",
    model: "studio-writer",
    label: "simulated",
    hint: "••••",
    priority: 100,
    chat: true,
    semantic: false,
    allowanceUsd: 1000,
    disabled: false,
    pricePerM: 0.7,
    // Empty credentials ⇒ simulated stages (complete by duration, no network).
    baseUrl: "",
    secret: "",
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
    html: Array.from({ length: 6 }, (_, index) => `<p>Paragraph ${index + 1} of the article with enough text to count as a real block.</p>`).join(""),
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
    humanizerKeys: [],
    humanizerCursor: 0,
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

/** Drive the offline pipeline until a predicate holds (simulated stages complete by duration). */
async function drive(data: Persisted, predicate: (value: Persisted) => boolean, budget = 60): Promise<Persisted> {
  let current = data;
  let clock = 2_000_000;
  for (let step = 0; step < budget; step += 1) {
    if (predicate(current)) return current;
    current = await advance(current, (clock += 6_000));
  }
  return current;
}

console.log("Milestone 4 · Calendar 100% + Ad-Ready Static + Deploy Providers (Rule 6)\n");

await check("calendar slot math: timezone-aware, DST-safe, write_at = publish_at - lead hours, pillar-first", () => {
  const slots = publishSlots({ count: 6, days: [0, 1, 2, 3, 4, 5, 6], perWeek: 7, hour: 9, minute: 0, timeZone: "America/New_York", from: Date.parse("2026-03-05T12:00:00Z") });
  assert.equal(slots.length, 6);
  for (const slot of slots) {
    const local = new Intl.DateTimeFormat("en-GB", { timeZone: "America/New_York", hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).format(new Date(slot));
    assert.equal(local, "09:00", "local publish clock holds across DST");
  }
  assert.equal(new Date(slots.find((slot) => slot < Date.parse("2026-03-08T12:00:00Z"))!).getUTCHours(), 14, "EST offset");
  assert.equal(new Date(slots.find((slot) => slot > Date.parse("2026-03-09T00:00:00Z"))!).getUTCHours(), 13, "EDT offset");
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
      { title: "Pillar decides Z", angle: "c", kind: "pillar" },
    ],
    now: Date.parse("2026-03-05T12:00:00Z"),
  });
  assert.equal(calendar.items[0]!.kind, "pillar", "PILLAR_FIRST strategy ordering");
  assert.equal(calendar.items[0]!.publishAt - calendar.items[0]!.writeAt, 12 * 3600000);
  assert.match(calendar.cadence, /\/week/);
});

await check("3 switches are independent and OFF by default; restore never re-enables them", async () => {
  const base = fixture();
  const calendar = buildCalendar({
    siteId: "s1",
    name: "Runner",
    timezone: "UTC",
    activeDays: [0, 1, 2, 3, 4, 5, 6],
    articlesPerWeek: 7,
    publishTime: "09:00",
    generationLeadHours: 336,
    order: "one-cluster",
    publishMode: "draft",
    topics: [{ title: "offline calendar article alpha", angle: "a", kind: "cluster" }],
    now: 1_000_000,
  });
  assert.equal(calendar.autoGenerate, false);
  assert.equal(calendar.autoPublish, false);
  assert.equal(calendar.autoReweave, false);
  let data: Persisted = { ...base, calendars: [calendar] };
  // autoGenerate OFF → pulse must not queue anything.
  const untouched = await pulseCalendars(structuredClone(data), 2_000_000);
  const idle = (untouched ?? data).calendars[0]!;
  assert.equal(idle.items[0]!.status, "SCHEDULED", "autoGenerate off ⇒ nothing writes");
  // autoGenerate ON → the entry is queued at write_at (already passed with a 336h lead).
  if (untouched) data = untouched;
  data = { ...data, calendars: data.calendars.map((item) => ({ ...item, autoGenerate: true, mode: "AUTOMATED" })) };
  const pulsed = await pulseCalendars(structuredClone(data), 2_000_000);
  assert.ok(pulsed, "pulse acted");
  data = pulsed!;
  assert.equal(data.calendars[0]!.items[0]!.status, "WRITING");
  const jobId = data.calendars[0]!.items[0]!.jobId!;
  // Run the pipeline to READY (held before publish).
  data = await drive(data, (value) => value.jobs.find((job) => job.id === jobId)?.status === "publish-held");
  data = (await pulseCalendars(structuredClone(data), 2_000_000)) ?? data;
  const ready = data.calendars[0]!.items[0]!;
  assert.equal(ready.status, "READY", "job held before publish");
  // autoPublish OFF → still READY after publish time passes.
  const late = 9_000_000_000;
  const notPublished = await pulseCalendars(structuredClone(data), late);
  const stillReady = (notPublished ?? data).calendars[0]!.items[0]!;
  assert.equal(stillReady.status, "READY", "autoPublish off ⇒ nothing publishes");
  // autoPublish ON with publishMode draft → DRAFT_SAVED (mode-aware).
  if (notPublished) data = notPublished;
  data = { ...data, calendars: data.calendars.map((item) => ({ ...item, autoPublish: true })) };
  const published = await pulseCalendars(structuredClone(data), late);
  assert.ok(published);
  data = published!;
  assert.equal(data.calendars[0]!.items[0]!.status, "DRAFT_SAVED", "draft mode saves drafts, not live posts");
  // Restore/migration safety.
  const restored = migrateCalendar({ ...data.calendars[0]!, autoGenerate: true, autoPublish: true, autoReweave: true, mode: "AUTOMATED" } as never);
  assert.equal(restored.autoGenerate, false);
  assert.equal(restored.autoPublish, false);
  assert.equal(restored.autoReweave, false);
  assert.equal(restored.mode, "MANUAL");
});

await check("autoReweave links published siblings (pillars first) with LOCAL edges; manual stays untouched", async () => {
  const pillar = { title: "Pillar page", angle: "a", kind: "pillar" as const, writeAt: 1, publishAt: 2, status: "PUBLISHED" as const, articleId: "art_pillar", id: "e1" };
  const clusterA = { title: "Cluster a", angle: "b", kind: "cluster" as const, writeAt: 1, publishAt: 2, status: "PUBLISHED" as const, articleId: "art_cluster-a", id: "e2" };
  const clusterB = { title: "Cluster b", angle: "c", kind: "cluster" as const, writeAt: 1, publishAt: 2, status: "PUBLISHED" as const, articleId: "art_cluster-b", id: "e3" };
  const calendar = { ...migrateCalendar({ ...buildCalendar({
    siteId: "s1",
    name: "Weave",
    timezone: "UTC",
    activeDays: [1],
    articlesPerWeek: 1,
    publishTime: "09:00",
    generationLeadHours: 1,
    order: "pillars-first",
    publishMode: "published",
    topics: [{ title: "seed topic here", angle: "a", kind: "cluster" }],
    now: 0,
  }), items: [pillar, clusterA, clusterB] } as never) };
  const data = fixture({ articles: [article("pillar"), article("cluster-a"), article("cluster-b")], calendars: [{ ...calendar, autoReweave: true }] });
  const off = fixture({ articles: [article("pillar"), article("cluster-a"), article("cluster-b")], calendars: [{ ...calendar, autoReweave: false }] });
  const offResult = await pulseCalendars(structuredClone(off), 2_000_000);
  assert.equal((offResult ?? off).articles.every((item) => item.links.length === 0), true, "autoReweave off ⇒ no edges proposed");
  const woven = await pulseCalendars(structuredClone(data), 2_000_000);
  assert.ok(woven, "reweave changed state");
  const clusterLinks = woven!.articles.find((item) => item.slug === "cluster-a")!.links;
  assert.ok(clusterLinks.some((link) => link.targetSlug === "pillar" && link.state === "LOCAL"), "cluster links to the pillar first");
});

await check("7 ad slots: placement rules, 16 KiB cap, deterministic hash, preview mode, ads.txt artifact", () => {
  const config = defaultAdSlots().map((slot) => (slot.id === "article_top" || slot.id === "home_feed" ? { ...slot, enabled: true, code: `<div id="${slot.id}-ad">ad</div>` } : slot));
  const withAds = site({ adsEnabled: true, ads: config, adsTxt: "google.com, pub-123, DIRECT, f08c47fec0942fa0" });
  assert.equal(adsConfigHash(withAds), adsConfigHash(withAds));
  assert.notEqual(adsConfigHash(withAds), adsConfigHash(site()));
  assert.equal(adCodeWithinLimit("x".repeat(AD_CODE_LIMIT)), true);
  assert.equal(adCodeWithinLimit("x".repeat(AD_CODE_LIMIT + 1)), false, "16 KiB cap");
  assert.match(adSlotHtml(withAds, "article_top"), /article_top-ad/, "enabled slot renders code");
  assert.doesNotMatch(adSlotHtml(withAds, "article_top", true), /article_top-ad/, "preview disables live code");
  assert.match(adSlotHtml(withAds, "article_top", true), /Ad slot · /);
  const over = site({ adsEnabled: true, ads: config.map((slot) => (slot.id === "article_top" ? { ...slot, code: "x".repeat(AD_CODE_LIMIT + 5) } : slot)) });
  assert.match(adSlotHtml(over, "article_top"), /exceeds the 16 KiB limit/);
  assert.equal(inlineAdTargetOk("<p>a</p><p>b</p>"), false);
  const injected = injectInlineAd(article("a").html, '<div id="inline-ad"></div>');
  assert.ok(injected.indexOf('id="inline-ad"') > injected.indexOf("Paragraph 3"), "inline ad after paragraph 3");
  const six = ["a", "b", "c", "d", "e", "f"].map((slug) => article(slug));
  const seven = [...six, article("g")];
  const shortHome = staticFiles(site(), six, false, []).find((file) => file.name === "index.html")!;
  const home = staticFiles(withAds, seven, false, []).find((file) => file.name === "index.html")!;
  assert.ok(!shortHome.text.includes("home_feed-ad"), "short feed omits home_feed");
  assert.ok(home.text.includes("home_feed-ad"), "≥7 posts renders home_feed");
  const files = staticFiles(withAds, seven, true, []);
  assert.ok(files.some((file) => file.name === "ads.txt"), "/ads.txt artifact emitted");
  const homeHtml = files.find((file) => file.name === "index.html")!.text;
  const postHtml = files.find((file) => file.name === "post/a/index.html")!.text;
  const shipped = new Set([...(homeHtml.match(/data-ad-slot="([a-z_]+)"/g) ?? []), ...(postHtml.match(/data-ad-slot="([a-z_]+)"/g) ?? [])]);
  assert.equal(shipped.size, 7, `all 7 slot containers ship (got ${shipped.size}: ${[...shipped].join(", ")})`);
});

await check("route-diff gate: blocks a disappearing live route, clears only on explicit resolution", () => {
  const data = fixture({ articles: [article("a"), article("b")] });
  const artifactA = staticFiles(site(), data.articles, true, []).map((file) => ({ ...file, hash: "h" }));
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
    artifact: artifactA,
    routes: ["/", "/post/a/", "/post/b/"],
  };
  const live = { ...data, builds: [buildA], deploys: [{ id: "depA", siteId: "s1", buildId: "bldA", providerId: "cpanel", status: "verified" as const, at: 2, probe: "ok" }] };
  const pruned = staticFiles(site(), [data.articles[0]!], true, []).map((file) => ({ ...file, hash: "h" }));
  const buildB = { ...buildA, id: "bldB", artifact: pruned, routes: ["/", "/post/a/"] };
  const candidate = { ...live, builds: [buildB, buildA] };
  assert.deepEqual(routeDiffFor(candidate, buildB).removedRoutes, ["/post/b/"]);
  const held = packageDeploy(candidate, "bldB", 10, { providerId: "cpanel" });
  assert.equal(held.hold, true, "automatic deploy blocked");
  const hold = held.data.deploys.find((deploy) => deploy.buildId === "bldB")!;
  assert.equal(hold.status, "hold-route-diff");
  assert.equal(hold.routeDiff?.acknowledged, false);
  const acked = resolveRouteDiff(held.data, hold.id, "deploy-anyway", 11);
  assert.equal(acked.data.deploys.find((deploy) => deploy.id === hold.id)!.status, "packaged");
  const grown = { ...live, builds: [{ ...buildA, id: "bldC", routes: ["/", "/post/a/", "/post/b/", "/post/c/"] }, buildA] };
  assert.equal(packageDeploy(grown, "bldC", 12, { providerId: "cloudflare" }).hold, undefined, "growth deploys freely");
});

await check("Ghost PUT re-weave: updated_at optimistic lock + LinkEdge state transitions", () => {
  assert.equal(reweaveDecision({ remoteUpdatedAt: "B", expectedUpdatedAt: "A" }), "skip-stale");
  assert.equal(reweaveDecision({ remoteUpdatedAt: "B", expectedUpdatedAt: "B" }), "proceed");
  assert.equal(reweaveDecision({ remoteUpdatedAt: "B", expectedUpdatedAt: "A", acknowledgeHandEdited: true }), "proceed");
  assert.deepEqual(reweavePutBody("<p>x</p>", "T1"), { posts: [{ html: "<p>x</p>", updated_at: "T1" }] });
  const links = [{ anchor: "a", targetSlug: "p1", state: "LOCAL" as const }, { anchor: "b", targetSlug: "p2", state: "LOCAL" as const }];
  assert.equal(withEdgeState(links, "p1", "GHOST_CONFIRMED")[0]!.state, "GHOST_CONFIRMED");
  assert.equal(withEdgeState(links, "p1", "GHOST_CONFIRMED")[1]!.state, "LOCAL");
});

await check("deploy adapters: hardcoded https hosts + payload guards", () => {
  assert.equal(DEPLOY_HOSTS.cloudflare.startsWith("https://"), true);
  assert.equal(DEPLOY_HOSTS.vercel.startsWith("https://"), true);
  assert.equal(DEPLOY_HOSTS.github.startsWith("https://"), true);
  assert.match(readDeployFiles([]).error ?? "", /No files/);
  assert.match(readDeployFiles([{ name: "../../etc/passwd", base64: "AAAA" }]).error ?? "", /Unsafe file name/);
  assert.match(readDeployFiles([{ name: "ok.html", base64: "not base64!!" }]).error ?? "", /not valid base64/);
  const ok = readDeployFiles([{ name: "post/a/index.html", base64: "PGgxPmhpPC9oMT4=" }]);
  assert.equal(ok.error, undefined);
  assert.equal(ok.files.length, 1);
});

await check("single-dispatch lease: one holder at a time, expiry frees it, same tick renews", () => {
  const first = leaseDecision(undefined, "tab-a", 1000);
  assert.equal(first.granted, true);
  const second = leaseDecision({ leaseId: "tab-a", expiresAt: 1000 + 15_000 }, "tab-b", 2000);
  assert.equal(second.granted, false, "a second tab cannot double-dispatch");
  assert.equal(second.holder, "tab-a");
  const renew = leaseDecision({ leaseId: "tab-a", expiresAt: 16_000 }, "tab-a", 3000);
  assert.equal(renew.granted, true, "the holder renews");
  const afterExpiry = leaseDecision({ leaseId: "tab-a", expiresAt: 4000 }, "tab-b", 5000);
  assert.equal(afterExpiry.granted, true, "an expired lease frees for the next tick");
});

console.log(`\n${passed} passed, ${failures.length} failed`);
if (failures.length) {
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}
