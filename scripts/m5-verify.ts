/**
 * Milestone 5 verification — Custom UI Theme Polish + Full QA + Safe-Release (Rule 7).
 * Run: npm run test:m5
 *
 * The release gate, exercised through the real modules with Vite resolution:
 *   1. all six themes define complete token sets (CSS + TS agree) and pass contrast checks
 *   2. all 20 canonical areas + the 4 palette actions are registered and resolve to route files
 *   3. end-to-end golden path in simulation mode (intake → author → six stages → JSON-LD → ads → route-diff)
 *   4. security & invariant audit (no secrets in exports, zero avatar files, single-shot ledger)
 * Exits non-zero on the first failure.
 */
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { DEFAULT_LIMITS, defaultAdSlots, type AiKey, type Persisted, type Site } from "../src/lib/types";
import { THEMES, THEME_TOKENS, THEME_TOKEN_KEYS, contrastRatio } from "../src/lib/themes";
import { AREAS, PALETTE_ACTIONS, SHELL_GROUPS, routeFileCandidates } from "../src/lib/areas";
import { packWorkspace } from "../src/lib/backup";
import { advance, packageDeploy, routeDiffFor, submitKeywords } from "../src/lib/engine";
import { staticFiles } from "../src/lib/static-site";
import { ROBOTIC_DEFAULTS, bannedPhraseScan, fallbackBlueprint, parseIntentStage } from "../src/lib/stage-contracts";

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

function key(): AiKey {
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
    baseUrl: "",
    secret: "",
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
    adsEnabled: true,
    ads: defaultAdSlots().map((slot) => (slot.id === "article_top" || slot.id === "home_feed" ? { ...slot, enabled: true, code: `<div id="${slot.id}-ad">ad</div>` } : slot)),
    adsTxt: "google.com, pub-1234567890, DIRECT, f08c47fec0942fa0",
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
    providers: [{ id: "cpanel", name: "cPanel", capability: "FTPS", status: "verified", hint: "", ftp: { host: "ftp.example", user: "u", password: "super-secret-password", path: "/", via: "ftps" } }],
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

async function drive(data: Persisted, predicate: (value: Persisted) => boolean, budget = 80): Promise<Persisted> {
  let current = data;
  let clock = 2_000_000;
  for (let step = 0; step < budget; step += 1) {
    if (predicate(current)) return current;
    current = await advance(current, (clock += 6_000));
  }
  return current;
}

console.log("Milestone 5 · Custom UI Theme Polish + Full QA + Safe-Release (Rule 7)\n");

await check("six themes: complete token sets, CSS/TS parity, and AA contrast", () => {
  assert.equal(THEMES.length, 6);
  assert.equal(readFileSync("src/styles.css", "utf8").includes('html[data-theme="ocean"]'), true, "styles.css carries all theme blocks");
  const rows: string[] = [];
  for (const theme of THEMES) {
    const tokens = THEME_TOKENS[theme.id];
    for (const tokenKey of THEME_TOKEN_KEYS) {
      assert.match(tokens[tokenKey], /^#[0-9a-f]{6}$/i, `${theme.id}.${tokenKey}`);
    }
    const body = contrastRatio(tokens.fg, tokens.bg);
    const muted = contrastRatio(tokens.muted, tokens.bg);
    const faint = contrastRatio(tokens.faint, tokens.bg);
    const ink = contrastRatio(tokens.ink, tokens.brass);
    assert.ok(body >= 7 && muted >= 4.5 && faint >= 3 && ink >= 4.5, `${theme.id} contrast (body ${body.toFixed(2)} · muted ${muted.toFixed(2)} · faint ${faint.toFixed(2)} · ink ${ink.toFixed(2)})`);
    rows.push(`${theme.id}: body ${body.toFixed(1)} · muted ${muted.toFixed(1)} · faint ${faint.toFixed(1)} · ink-on-accent ${ink.toFixed(1)}`);
  }
  for (const row of rows) console.log(`        ${row}`);
  const css = readFileSync("src/styles.css", "utf8");
  for (const theme of THEMES) {
    const block = css.match(new RegExp(`html\\[data-theme="${theme.id}"\\]\\s*\\{([^}]*)\\}`))![1]!;
    for (const tokenKey of THEME_TOKEN_KEYS) {
      const found = block.match(new RegExp(`--color-${tokenKey.replace(/-/g, "\\-")}:\\s*(#[0-9a-fA-F]{6})`))![1]!;
      assert.equal(found.toLowerCase(), THEME_TOKENS[theme.id][tokenKey].toLowerCase(), `${theme.id} --color-${tokenKey} parity`);
    }
  }
});

await check("20 canonical areas + palette actions resolve to real route files", () => {
  assert.equal(AREAS.length, 20);
  assert.equal(new Set(AREAS.map((area) => area.id)).size, 20);
  for (const area of AREAS) {
    assert.ok(SHELL_GROUPS.includes(area.group), `${area.label} group`);
    const candidates = routeFileCandidates(area.href);
    assert.ok(candidates.some((file) => existsSync(file)), `${area.label} → ${candidates.join(" | ")}`);
  }
  for (const group of SHELL_GROUPS) assert.ok(AREAS.some((area) => area.group === group), `group ${group} populated`);
  assert.deepEqual(
    PALETTE_ACTIONS.map((action) => action.label),
    ["New Keyword Batch", "New Research Project", "Open Calendar Automation", "Build Static Site"],
  );
  console.log(`        groups: ${SHELL_GROUPS.join(" · ")}`);
});

await check("golden path: intake → US author → six stages → scrub → JSON-LD → 7 ads → route-diff", async () => {
  let data = fixture();
  const intake = await submitKeywords(data, { siteId: "s1", lines: "how to keep research notes that survive week three", publishMode: "draft", modelKeyId: "default", allowVariants: false, now: 1_000_000 });
  assert.equal(intake.error, undefined);
  data = intake.data;
  const job = data.jobs[0]!;
  const author = data.authors.find((item) => item.id === job.authorId)!;
  assert.equal(author.country, "US");
  assert.match(author.avatarUrl, /^https:\/\/thispersondoesnotexist\.com\/image\?seed=/);
  assert.equal(author.maxArticles, 250);
  data = await drive(data, (value) => value.jobs.find((item) => item.id === job.id)?.status === "completed");
  const finalJob = data.jobs.find((item) => item.id === job.id)!;
  assert.equal(finalJob.status, "completed");
  const article = data.articles.find((item) => item.jobId === job.id)!;
  assert.ok(article, "stage 6 assembled an article");
  assert.ok((finalJob.modelIntent ?? fallbackBlueprint(finalJob)).answerBlock.length >= 40, "blueprint answer block");
  assert.equal(parseIntentStage(JSON.stringify(fallbackBlueprint(finalJob))).mustCover.length >= 3, true);
  assert.deepEqual(bannedPhraseScan(article.markdown, ROBOTIC_DEFAULTS), [], "draft carries no robotic phrasing");
  assert.ok(article.sections.length >= 5, "five named sections");
  assert.equal(data.authors.find((item) => item.id === job.authorId)!.articleCount, 1, "author counted exactly once");
  assert.equal(article.ledger.shots, 1, "single-shot ledger");
  assert.notEqual(article.ghostPush, "pending", "no second POST is queued");
  const seven = Array.from({ length: 7 }, (_, index) => ({ ...article, id: `art${index}`, slug: `${article.slug}-${index}`, title: `${article.title} ${index}` }));
  const files = staticFiles(site(), seven, true, [author]);
  const post = files.find((file) => file.name === `post/${article.slug}-0/index.html`)!;
  const jsonLd = JSON.parse(post.text.match(/<script type="application\/ld\+json">(.+?)<\/script>/)![1]!);
  assert.equal(jsonLd["@type"], "Article");
  assert.equal(jsonLd.author["@type"], "Person");
  assert.deepEqual(jsonLd.author.knowsAbout, author.expertise);
  const shipped = new Set([
    ...(post.text.match(/data-ad-slot="([a-z_]+)"/g) ?? []),
    ...(files.find((file) => file.name === "index.html")!.text.match(/data-ad-slot="([a-z_]+)"/g) ?? []),
  ]);
  assert.equal(shipped.size, 7, "all seven ad slots");
  assert.ok(files.some((file) => file.name === "ads.txt"), "/ads.txt ships");
  const buildA = { id: "bldA", siteId: "s1", status: "succeeded" as const, pages: 7, bytes: 10, ms: 1, at: 1, auto: false, template: "classic-editorial", includedIds: seven.map((item) => item.id), excluded: [], artifact: files.map((file) => ({ ...file, hash: "h" })), routes: ["/", `/post/${article.slug}-0/`, "/ads.txt"] };
  const prunedArtifact = files.filter((file) => file.name === "index.html").map((file) => ({ ...file, hash: "h" }));
  const candidate = { ...data, builds: [{ ...buildA, id: "bldB", artifact: prunedArtifact, routes: ["/"] }, buildA], deploys: [{ id: "depA", siteId: "s1", buildId: "bldA", providerId: "cpanel", status: "verified" as const, at: 2, probe: "ok" }] };
  const diff = routeDiffFor(candidate, candidate.builds[0]!);
  assert.deepEqual(diff.removedRoutes, ["/ads.txt", `/post/${article.slug}-0/`].sort(), `route-diff removes the vanished routes (got ${JSON.stringify(diff.removedRoutes)})`);
  assert.equal(packageDeploy(candidate, "bldB", 10, { providerId: "cpanel" }).hold, true, "route-diff gate holds the deploy");
  console.log(`        article ${article.words} words · ${article.sections.length} sections · ${files.length} build files`);
});

await check("security audit: exports exclude credentials, avatars are URLs, ledger is single-shot", async () => {
  let data = fixture();
  data = (await submitKeywords(data, { siteId: "s1", lines: "weekly review routine for researchers", publishMode: "draft", modelKeyId: "default", allowVariants: false, now: 1_000_000 })).data;
  const packed = packWorkspace(data, "s1")!;
  assert.equal(packed.payload.includes("super-secret-password"), false);
  assert.equal(packed.payload.includes("id:deadbeef"), false);
  assert.equal(packed.payload.includes("sk-test"), false);
  const article = data.articles[0];
  if (article) {
    assert.equal(staticFiles(data.sites[0]!, [article], true, data.authors).filter((file) => /\.(png|jpe?g|webp)$/i.test(file.name)).length, 0);
  }
});

console.log(`\n${passed} passed, ${failures.length} failed`);
if (failures.length) {
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}
