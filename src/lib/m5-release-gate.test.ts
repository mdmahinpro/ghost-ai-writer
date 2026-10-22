import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, existsSync } from "node:fs";
import { DEFAULT_LIMITS, defaultAdSlots, type AiKey, type Article, type Persisted, type Site } from "./types.ts";
import { THEMES, THEME_TOKENS, THEME_TOKEN_KEYS, contrastRatio } from "./themes.ts";
import { AREAS, PALETTE_ACTIONS, SHELL_GROUPS, routeFileCandidates } from "./areas.ts";
import { packWorkspace } from "./backup.ts";
import { advance, submitKeywords, packageDeploy, routeDiffFor } from "./engine.ts";
import { staticFiles } from "./static-site.ts";
import { bannedPhraseScan, ROBOTIC_DEFAULTS, fallbackBlueprint, parseIntentStage } from "./stage-contracts.ts";

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
    // Empty credentials ⇒ simulated stages that complete by duration (no network).
    baseUrl: "",
    secret: "",
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
      bannedPhrases: ["in today's fast-paced world"],
      brandFacts: [],
      pov: "third-person",
      readingLevel: "general",
    },
    ghost: { mode: "studio", status: "connected", url: "studio://test", keyHint: "", adminKey: "id:deadbeef" , version: "local-demo", corpus: "COMPLETE", inventory: [] },
    providers: [
      { id: "cpanel", name: "cPanel", capability: "FTPS", status: "verified", hint: "", ftp: { host: "ftp.example", user: "u", password: "super-secret-password", path: "/", via: "ftps" } },
      { id: "cloudflare", name: "Cloudflare Pages", capability: "Direct upload", status: "verified", hint: "", api: { accountId: "acct", projectName: "proj", token: "cf-secret-token" } },
    ],
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

async function drive(data: Persisted, predicate: (value: Persisted) => boolean, budget = 80): Promise<Persisted> {
  let current = data;
  let clock = 2_000_000;
  for (let step = 0; step < budget; step += 1) {
    if (predicate(current)) return current;
    current = await advance(current, (clock += 6_000));
  }
  return current;
}

test("Rule 7: all six themes define a complete, valid token set", () => {
  assert.equal(THEMES.length, 6);
  for (const theme of THEMES) {
    const tokens = THEME_TOKENS[theme.id];
    assert.ok(tokens, `${theme.id} has tokens`);
    for (const tokenKey of THEME_TOKEN_KEYS) {
      const value = tokens[tokenKey];
      assert.match(value, /^#[0-9a-f]{6}$/i, `${theme.id} · ${tokenKey} must be a hex color, got ${value}`);
    }
    assert.equal(tokens.bg, theme.canvas, `${theme.id} canvas matches its bg token`);
  }
});

test("Rule 7: themes pass contrast sanity for text, muted, faint, and accent pairs", () => {
  for (const theme of THEMES) {
    const tokens = THEME_TOKENS[theme.id];
    const body = contrastRatio(tokens.fg, tokens.bg);
    const muted = contrastRatio(tokens.muted, tokens.bg);
    const faint = contrastRatio(tokens.faint, tokens.bg);
    const accent = contrastRatio(tokens.brass, tokens.bg);
    const ink = contrastRatio(tokens.ink, tokens.brass);
    assert.ok(body >= 7, `${theme.id} body text contrast ${body.toFixed(2)} must be ≥ 7`);
    assert.ok(muted >= 4.5, `${theme.id} muted contrast ${muted.toFixed(2)} must be ≥ 4.5`);
    assert.ok(faint >= 3, `${theme.id} faint contrast ${faint.toFixed(2)} must be ≥ 3`);
    assert.ok(accent >= 3, `${theme.id} accent contrast ${accent.toFixed(2)} must be ≥ 3`);
    assert.ok(ink >= 4.5, `${theme.id} ink-on-accent contrast ${ink.toFixed(2)} must be ≥ 4.5`);
  }
});

test("Rule 7: styles.css mirrors the TS token source exactly (no drift)", () => {
  const css = readFileSync("src/styles.css", "utf8");
  for (const theme of THEMES) {
    const blockMatch = css.match(new RegExp(`html\\[data-theme="${theme.id}"\\]\\s*\\{([^}]*)\\}`));
    assert.ok(blockMatch, `styles.css has a ${theme.id} block`);
    const body = blockMatch![1]!;
    for (const tokenKey of THEME_TOKEN_KEYS) {
      const found = body.match(new RegExp(`--color-${tokenKey.replace(/[-]/g, "\\-")}:\\s*(#[0-9a-fA-F]{6})`));
      assert.ok(found, `styles.css ${theme.id} defines --color-${tokenKey}`);
      assert.equal(found![1]!.toLowerCase(), THEME_TOKENS[theme.id][tokenKey].toLowerCase(), `${theme.id} · --color-${tokenKey} drifted from themes.ts`);
    }
  }
});

test("Rule 7: all 20 canonical areas are registered, grouped, and resolvable", () => {
  assert.equal(AREAS.length, 20, "exactly the 20 canonical areas");
  assert.equal(new Set(AREAS.map((area) => area.id)).size, 20, "unique ids");
  assert.equal(new Set(AREAS.map((area) => `${area.group}:${area.label}`)).size, 20, "unique group+label");
  for (const area of AREAS) {
    assert.ok(SHELL_GROUPS.includes(area.group), `${area.label} sits in a known shell group (${area.group})`);
    assert.ok(area.href.startsWith("/"), `${area.label} has a root-relative href`);
    const candidates = routeFileCandidates(area.href);
    assert.ok(candidates.some((file) => existsSync(file)), `${area.label} (${area.href}) resolves to a route file — tried ${candidates.join(", ")}`);
  }
  for (const group of SHELL_GROUPS) {
    assert.ok(AREAS.some((area) => area.group === group), `group ${group} is not empty`);
  }
  assert.deepEqual(SHELL_GROUPS, ["Workspace", "Content", "Website", "Settings", "Account"]);
  assert.deepEqual(AREAS.filter((area) => area.group === "Workspace").map((area) => area.label), ["Websites"]);
  assert.deepEqual(AREAS.filter((area) => area.group === "Content").map((area) => area.label), ["Overview", "Create", "Topic Plans", "Research", "Calendar", "Runs", "Articles"]);
  assert.deepEqual(AREAS.filter((area) => area.group === "Website").map((area) => area.label), ["Analytics", "Connections", "Static Delivery", "Authors & Bylines"]);
  assert.deepEqual(AREAS.filter((area) => area.group === "Settings").map((area) => area.label), ["AI Keys & Usage", "Content Defaults", "Website Settings", "Backup & Recovery", "Funding / Inbox"]);
  assert.deepEqual(AREAS.filter((area) => area.group === "Account").map((area) => area.label), ["Account", "Billing & Plan", "Help"]);
});

test("Rule 7: palette exposes the 4 quick actions plus every area jump", () => {
  assert.deepEqual(
    PALETTE_ACTIONS.map((action) => action.label),
    ["New Keyword Batch", "New Research Project", "Open Calendar Automation", "Build Static Site"],
  );
  // Each action points at an existing area so the palette can never dead-end.
  for (const action of PALETTE_ACTIONS) {
    assert.ok(AREAS.some((area) => area.href === action.href), `${action.label} targets a registered area (${action.href})`);
  }
});

test("Golden path: intake → US author (<250) → six stages → JSON-LD · ads · route-diff", async () => {
  let data = fixture();
  const intake = await submitKeywords(data, { siteId: "s1", lines: "how to keep research notes that survive week three", publishMode: "draft", modelKeyId: "default", allowVariants: false, now: 1_000_000 });
  assert.equal(intake.error, undefined);
  data = intake.data;
  const job = data.jobs[0]!;
  // Rule 2: an author is assigned at intake with a zero-disk avatar URL and a 250 cap.
  assert.ok(job.authorId, "job carries an assigned author");
  const author = data.authors.find((item) => item.id === job.authorId)!;
  assert.equal(author.country, "US");
  assert.match(author.avatarUrl, /^https:\/\/thispersondoesnotexist\.com\/image\?seed=/);
  assert.equal(author.maxArticles, 250);
  // Drive the six stages to completion.
  data = await drive(data, (value) => value.jobs.find((item) => item.id === job.id)?.status === "completed");
  const finalJob = data.jobs.find((item) => item.id === job.id)!;
  assert.equal(finalJob.status, "completed", `job finished (status ${finalJob.status})`);
  const article = data.articles.find((item) => item.jobId === job.id);
  assert.ok(article, "stage 6 assembled an article");
  // Rule 3: the blueprint exists and the draft is scrubbed of robotic phrasing.
  const blueprint = finalJob.modelIntent ?? fallbackBlueprint(finalJob);
  assert.ok(blueprint.answerBlock.length >= 40);
  assert.equal(parseIntentStage(JSON.stringify(blueprint)).mustCover.length >= 3, true);
  assert.deepEqual(bannedPhraseScan(article!.markdown, ROBOTIC_DEFAULTS), []);
  assert.ok(article!.sections.length >= 5, "five named sections");
  assert.ok(article!.mustCover.length >= 3, "blueprint mustCover landed on the article");
  // Rule 2 counter: incremented exactly once.
  assert.equal(data.authors.find((item) => item.id === job.authorId)!.articleCount, 1);
  // Rule 6 single-shot ledger: one confirmed shot, nothing pending a second POST.
  assert.equal(article!.ledger.shots, 1);
  assert.equal(article!.ledger.confirmed, true);
  assert.notEqual(article!.ghostPush, "pending");
  // Stage 6 output: JSON-LD Article + Person, all 7 ad slots, /ads.txt.
  // A seven-post corpus is used so every slot (including home_feed) can render.
  const seven = Array.from({ length: 7 }, (_, index) => ({ ...article!, id: `art${index}`, slug: `${article!.slug}-${index}`, title: `${article!.title} ${index}` }));
  const files = staticFiles(site(), seven, true, [author]);
  const post = files.find((file) => file.name === `post/${article!.slug}-0/index.html`)!;
  const jsonLd = JSON.parse((post.text.match(/<script type="application\/ld\+json">(.+?)<\/script>/) ?? [])[1]!);
  assert.equal(jsonLd["@type"], "Article");
  assert.equal(jsonLd.author["@type"], "Person");
  assert.deepEqual(jsonLd.author.knowsAbout, author.expertise);
  assert.equal(jsonLd.author.image, author.avatarUrl);
  const shipped = new Set([
    ...(post.text.match(/data-ad-slot="([a-z_]+)"/g) ?? []),
    ...(files.find((file) => file.name === "index.html")!.text.match(/data-ad-slot="([a-z_]+)"/g) ?? []),
  ]);
  assert.equal(shipped.size, 7, `all seven ad slots render (got ${shipped.size})`);
  assert.ok(files.some((file) => file.name === "ads.txt"), "/ads.txt artifact ships");
  assert.equal(files.filter((file) => file.name.startsWith("assets/img")).length, 0, "zero avatar image files on disk");
  // Rule 6 route-diff: a build that drops a live route is held.
  const buildA = { id: "bldA", siteId: "s1", status: "succeeded" as const, pages: 1, bytes: 10, ms: 1, at: 1, auto: false, template: "classic-editorial", includedIds: [article!.id], excluded: [], artifact: files.map((file) => ({ ...file, hash: "h" })), routes: ["/", `/post/${article!.slug}/`, "/ads.txt"] };
  const live = { ...data, builds: [buildA], deploys: [{ id: "depA", siteId: "s1", buildId: "bldA", providerId: "cpanel", status: "verified" as const, at: 2, probe: "ok" }] };
  const pruned = { ...buildA, id: "bldB", artifact: files.filter((file) => file.name === "index.html").map((file) => ({ ...file, hash: "h" })), routes: ["/"] };
  const candidate = { ...live, builds: [pruned, buildA] };
  assert.deepEqual(routeDiffFor(candidate, pruned).removedRoutes.sort(), ["/ads.txt", `/post/${article!.slug}/`].sort());
  const held = packageDeploy(candidate, "bldB", 10, { providerId: "cpanel" });
  assert.equal(held.hold, true, "the disappearing route blocks the deploy");
  assert.equal(held.data.deploys.find((deploy) => deploy.buildId === "bldB")!.status, "hold-route-diff");
});

test("Security: backups never export credentials; avatars stay URLs, not files", async () => {
  let data = fixture({ articles: [] });
  const intake = await submitKeywords(data, { siteId: "s1", lines: "weekly review routine for researchers", publishMode: "draft", modelKeyId: "default", allowVariants: false, now: 1_000_000 });
  data = intake.data;
  const packed = packWorkspace(data, "s1");
  assert.ok(packed, "workspace packs");
  assert.equal(packed!.payload.includes("super-secret-password"), false, "FTP password excluded");
  assert.equal(packed!.payload.includes("cf-secret-token"), false, "provider API token excluded");
  assert.equal(packed!.payload.includes("id:deadbeef"), false, "Ghost admin key excluded");
  const article: Article | undefined = data.articles[0] ?? undefined;
  if (article) {
    const media = staticFiles(data.sites[0]!, [article], true, data.authors).filter((file) => /\.(png|jpe?g|webp)$/i.test(file.name));
    assert.equal(media.length, 0, "no image artifacts for avatars");
  }
});
