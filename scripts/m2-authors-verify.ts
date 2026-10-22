/**
 * Milestone 2 verification — Smart Auto-Author Engine (Rule 2).
 * Run: npx vite-node scripts/m2-authors-verify.ts
 *
 * Exercises the real authors.ts / engine.ts / static-site.ts modules with
 * Vite's resolution: US persona generation, niche matching, the 250-cap
 * rotation, retry idempotency, zero-disk avatars, and JSON-LD Person output.
 * Exits non-zero on the first failure.
 */
import assert from "node:assert/strict";
import { DEFAULT_LIMITS, type AiKey, type AuthorProfile, type Persisted, type Site } from "../src/lib/types";
import {
  authorVoiceBlock,
  avatarUrlFor,
  expertiseScore,
  generateAuthorForTopic,
  markAuthorPublished,
  matchOrCreateAuthorForTopic,
  previewAuthorMatch,
  voiceFor,
} from "../src/lib/authors";
import { articleJsonLd, staticFiles } from "../src/lib/static-site";
import { submitKeywords } from "../src/lib/engine";

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

function author(overrides: Partial<AuthorProfile> = {}): AuthorProfile {
  return {
    id: "a1",
    siteId: "s1",
    name: "Dana Whitfield",
    role: "Staff writer",
    shortBio: "Dana writes about research craft.",
    city: "Austin",
    region: "TX",
    country: "US",
    expertise: ["research craft", "note systems"],
    topic: "research craft",
    slug: "dana-whitfield-research-craft",
    avatarUrl: avatarUrlFor("a1"),
    voice: voiceFor("s1", "research craft"),
    articleCount: 0,
    maxArticles: 250,
    status: "active",
    ghostAuthorId: null,
    ghostSlug: null,
    createdAt: 0,
    origin: "auto",
    ...overrides,
  };
}

/** Lexically distinct keywords so duplicate protection is not what is under test. */
function distinctKeywords(n: number): string {
  return Array.from({ length: n }, (_, i) => `kw${i.toString(36).padStart(4, "0")}x${(i * 7919).toString(36)}`).join("\n");
}

console.log("Milestone 2 · Smart Auto-Author Engine (Rule 2)\n");

await check("US-only persona generation, unique thispersondoesnotexist seeds, zero-disk URL strings", () => {
  const seen = new Set<string>();
  for (let index = 0; index < 1000; index++) {
    const generated = generateAuthorForTopic(`niche ${index}`, "sX");
    assert.equal(generated.country, "US");
    assert.match(generated.name, /^[A-Z][a-z]+ [A-Z][a-z]+$/);
    assert.ok(generated.city.length > 1 && generated.region.length > 1);
    assert.ok(generated.shortBio.length > 40, "credentialed bio");
    assert.match(generated.avatarUrl, /^https:\/\/thispersondoesnotexist\.com\/image\?seed=[a-z0-9]+$/);
    assert.ok(generated.avatarUrl.length <= 120, "avatar stays a ~90-byte URL string, well under any 50 KB budget");
    assert.equal(generated.maxArticles, 250);
    assert.ok(!seen.has(generated.avatarUrl));
    seen.add(generated.avatarUrl);
  }
});

await check("distinct humanized voices per niche (rhythm, diction, band, moves, banned phrases)", () => {
  const voices = new Set(["phd funding", "espresso gear", "rrsp planning", "trail running"].map((topic) => JSON.stringify(voiceFor("s1", topic))));
  assert.equal(voices.size, 4, "no two generated authors sound identical");
  const block = authorVoiceBlock(author());
  for (const token of ["Signature moves", "Never write these robotic AI phrases", "Expertise", "Voice:"]) {
    assert.ok(block.includes(token), `voice block feeds stages: missing ${token}`);
  }
});

await check("niche matcher picks the existing under-cap expert, least-loaded on ties", () => {
  const experts = [author({ id: "a-heavy", articleCount: 120 }), author({ id: "a-light", expertise: ["espresso gear"], topic: "espresso gear", articleCount: 5 })];
  const result = matchOrCreateAuthorForTopic({ id: "s1", nicheTag: "research craft" }, experts, "home espresso gear", { autoMatch: true });
  assert.equal(result.created, false);
  assert.equal(result.author.id, "a-light");
  assert.ok(expertiseScore(experts[1]!, "home espresso gear") > 0);
});

await check("matcher is idempotent per job via existingAuthorId (retries rebind, never re-generate)", () => {
  const experts = [author({ articleCount: 3 })];
  const first = matchOrCreateAuthorForTopic({ id: "s1", nicheTag: "research craft" }, experts, "research craft", {});
  const retry = matchOrCreateAuthorForTopic({ id: "s1", nicheTag: "research craft" }, experts, "research craft", { existingAuthorId: first.author.id });
  assert.equal(retry.created, false);
  assert.equal(retry.author.id, first.author.id);
  assert.equal(experts.length, 1);
});

await check("249 -> 250 -> 251: cap retirement rotates the niche to a fresh US expert", async () => {
  const data = fixture({ authors: [author({ articleCount: 249 })] });
  const articleRef = { authorId: "a1", authorCounted: false, title: "Ninth under-cap article of the year" };
  assert.equal(markAuthorPublished(data, articleRef, 1000), true);
  assert.equal(data.authors[0]!.articleCount, 250);
  assert.equal(data.authors[0]!.status, "retired");
  // a retry of the same article never double-increments
  assert.equal(markAuthorPublished(data, articleRef, 1001), false);
  assert.equal(data.authors[0]!.articleCount, 250);
  // 251st article for the same niche spawns a new expert
  const rotation = matchOrCreateAuthorForTopic({ id: "s1", nicheTag: "research craft" }, data.authors, "research craft note systems", { autoMatch: true });
  assert.equal(rotation.created, true);
  assert.equal(rotation.author.articleCount, 0);
  assert.equal(rotation.author.country, "US");
  assert.match(rotation.author.avatarUrl, /^https:\/\/thispersondoesnotexist\.com\/image\?seed=/);
});

await check("job intake auto-assigns authors with no manual step (10-keyword batch, offline)", async () => {
  const data = fixture();
  const result = await submitKeywords(data, { siteId: "s1", lines: distinctKeywords(10), publishMode: "draft", modelKeyId: "default", allowVariants: false, now: 1000 });
  assert.equal(result.error, undefined);
  const queued = result.data.jobs.filter((job) => job.status === "queued" || job.status === "review-held");
  assert.ok(queued.length >= 8, "most keywords queue");
  const assigned = queued.filter((job) => job.authorId);
  assert.equal(assigned.length, queued.length, "every dispatched job carries an author");
  const used = new Set(assigned.map((job) => job.authorId));
  assert.ok(used.size <= result.data.authors.length, "assignments reuse generated experts");
  for (const jobAuthor of result.data.authors) {
    assert.match(jobAuthor.avatarUrl, /^https:\/\/thispersondoesnotexist\.com\/image\?seed=/);
  }
});

await check("zero disk writes: static build holds avatars as URL text only — no media files", () => {
  const s = site();
  const expert = author({ articleCount: 12 });
  const article = {
    id: "art1",
    siteId: "s1",
    jobId: "j1",
    title: "A note system that survives week three",
    slug: "a-note-system-that-survives-week-three",
    keyword: "research note system",
    html: "<p>Body.</p>",
    markdown: "Body.",
    excerpt: "Body.",
    sections: [],
    status: "published" as const,
    engine: "llm" as const,
    words: 100,
    uniqueness: 1,
    coverage: 1,
    intentMatch: 1,
    tags: [] as string[],
    mustCover: [] as string[],
    revisionNotes: "",
    images: [],
    links: [],
    stageTokens: [],
    verifyFlags: [],
    ledger: { mode: "draft" as const, confirmed: true, dispatchedAt: 0, confirmedAt: 1, postId: "p1", shots: 1 },
    publishedAt: 0,
    authorId: expert.id,
    authorName: expert.name,
  };
  const jsonLd = JSON.parse(articleJsonLd({ site: s, article, author: expert, origin: s.publicUrl }));
  assert.equal(jsonLd["@type"], "Article");
  assert.equal(jsonLd.author["@type"], "Person");
  assert.equal(jsonLd.author.image, expert.avatarUrl);
  assert.deepEqual(jsonLd.author.knowsAbout, expert.expertise);
  assert.equal(jsonLd.author.homeLocation.name, "Austin, TX, US");
  assert.equal(jsonLd.author.jobTitle, expert.role);
  const files = staticFiles(s, [article], true, [expert]);
  const post = files.find((file) => file.name === `post/${article.slug}/index.html`)!;
  assert.ok(post.text.includes('<script type="application/ld+json">'));
  assert.ok(post.text.includes("thispersondoesnotexist.com"));
  assert.ok(files.some((file) => file.name === `author/${expert.slug}/index.html`), "author archive page builds");
  const media = files.filter((file) => file.name.startsWith("assets/img"));
  assert.equal(media.length, 0, "avatars never become build media/disk files");
  assert.ok(files.every((file) => !file.name.match(/\.(png|jpe?g|webp)$/i)));
});

await check("UI preview helper stays pure and reports generate-vs-pick", () => {
  const experts = [author({ articleCount: 249 })];
  const pick = previewAuthorMatch("s1", experts, "research craft note systems");
  assert.ok(pick.matched && !pick.wouldGenerate);
  const fresh = previewAuthorMatch("s1", experts, "underwater welding");
  assert.equal(fresh.matched, null);
  assert.equal(fresh.wouldGenerate, true);
  assert.equal(experts.length, 1);
});

console.log(`\n${passed} passed, ${failures.length} failed`);
if (failures.length) {
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}
