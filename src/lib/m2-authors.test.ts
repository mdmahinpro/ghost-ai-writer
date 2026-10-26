import { test } from "node:test";
import assert from "node:assert/strict";
import type { AuthorProfile, Persisted, Site } from "./types.ts";
import {
  authorVoiceBlock,
  avatarUrlFor,
  expertiseScore,
  generateAuthorForTopic,
  markAuthorPublished,
  matchOrCreateAuthorForTopic,
  normalizeAuthorProfile,
  personaForTopic,
  previewAuthorMatch,
  topicStem,
  voiceFor,
} from "./authors.ts";
import { articleJsonLd, avatarImgHtml, staticFiles } from "./static-site.ts";
import { avatarSeed, capturePortrait, freshPortraitToken, portraitSrc } from "./avatar.ts";

const AVATAR_HOST = "https://thispersondoesnotexist.com/random-person.jpeg?r=";

function site(id = "s1", niche = "research craft"): Site {
  return {
    id,
    name: "Test",
    createdAt: 0,
    staticName: "Test",
    nicheTag: niche,
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

function dataFixture(authors: AuthorProfile[] = []): Pick<Persisted, "authors" | "activity" | "articles"> {
  return { authors, activity: [], articles: [] };
}

test("Rule 2: generated personas are US-based with realistic names and unique zero-disk avatar URLs", () => {
  const seen = new Set<string>();
  for (let index = 0; index < 500; index++) {
    const author = generateAuthorForTopic(`niche ${index}`, "sX");
    assert.equal(author.country, "US");
    assert.ok(author.city.length > 1);
    assert.ok(author.region.length > 1, "US state present");
    assert.match(author.name, /^[A-Z][a-z]+ [A-Z][a-z]+$/);
    assert.match(author.avatarUrl, /^https:\/\/thispersondoesnotexist\.com\/random-person\.jpeg\?r=[a-z0-9]+$/);
    assert.ok(!seen.has(author.avatarUrl), "avatar seed must be unique per author");
    seen.add(author.avatarUrl);
    assert.equal(author.articleCount, 0);
    assert.equal(author.maxArticles, 250);
    assert.equal(author.status, "active");
  }
});

test("Rule 2: avatarUrlFor is stable per seed and never a file path", () => {
  const first = avatarUrlFor("id-1");
  assert.equal(avatarUrlFor("id-1"), first);
  assert.ok(first.startsWith(AVATAR_HOST));
  assert.ok(!/\.(png|jpe?g|webp)$/i.test(first));
});

test("Rule 2: matcher picks the existing under-cap expert for the niche", () => {
  const experts = [
    author({ articleCount: 100 }),
    author({ id: "a2", expertise: ["espresso gear"], topic: "espresso gear", articleCount: 30 }),
  ];
  const result = matchOrCreateAuthorForTopic({ id: "s1", nicheTag: "research craft" }, experts, "home espresso gear", {
    autoMatch: true,
  });
  assert.equal(result.created, false);
  assert.equal(result.author.id, "a2");
});

test("Rule 2: matcher is idempotent per job via existingAuthorId", () => {
  const experts = [author({ articleCount: 3 })];
  const again = matchOrCreateAuthorForTopic({ id: "s1", nicheTag: "research craft" }, experts, "research craft", {
    existingAuthorId: "a1",
  });
  assert.equal(again.created, false);
  assert.equal(again.author.id, "a1");
  assert.equal(experts.length, 1);
});

test("Rule 2: articleCount increments once per article (retry-proof) and retires at 250", () => {
  const data = dataFixture([author({ articleCount: 249 })]);
  const articleRef = { authorId: "a1", authorCounted: false };
  assert.equal(markAuthorPublished(data, articleRef, 1), true);
  assert.equal(articleRef.authorCounted, true);
  assert.equal(data.authors[0]!.articleCount, 250);
  assert.equal(data.authors[0]!.status, "retired");
  // A job retry re-runs against the SAME article, whose authorCounted flag is already persisted.
  assert.equal(markAuthorPublished(data, articleRef, 2), false, "retry must not double-increment");
  assert.equal(data.authors[0]!.articleCount, 250);
});

test("Rule 2: 251st article in a capped niche rotates to a brand-new US expert", () => {
  const experts = [author({ articleCount: 250, status: "retired" })];
  const result = matchOrCreateAuthorForTopic({ id: "s1", nicheTag: "research craft" }, experts, "research craft methods", {
    autoMatch: true,
  });
  assert.equal(result.created, true);
  assert.notEqual(result.author.id, "a1");
  assert.equal(result.author.articleCount, 0);
  assert.equal(result.author.country, "US");
  assert.match(result.author.avatarUrl, /^https:\/\/thispersondoesnotexist\.com\/random-person\.jpeg\?r=/);
});

test("Rule 2: voices are distinct across niches and feed readable blocks", () => {
  const a = voiceFor("s1", "phd funding");
  const b = voiceFor("s1", "espresso gear");
  const same = voiceFor("s1", "phd funding");
  assert.deepEqual(a, same);
  assert.notDeepEqual(a, b);
  const authorProfile = author({ voice: a });
  assert.ok(authorVoiceBlock(authorProfile).includes("Signature moves"));
});

test("Rule 2: previewAuthorMatch reports pick vs generate without mutating", () => {
  const experts = [author({ articleCount: 249 })];
  const pick = previewAuthorMatch("s1", experts, "research craft note systems");
  assert.ok(pick.matched);
  assert.equal(pick.wouldGenerate, false);
  const fresh = previewAuthorMatch("s1", experts, "underwater welding");
  assert.equal(fresh.matched, null);
  assert.equal(fresh.wouldGenerate, true);
  assert.equal(experts.length, 1);
});

test("Rule 2: expertise scoring prefers exact primary-domain matches", () => {
  const expert = author();
  assert.ok(expertiseScore(expert, "research craft note systems") > 0);
  assert.equal(expertiseScore(expert, "underwater welding"), 0);
  assert.ok(topicStem("How to build a note system for research").length > 0);
});

test("Rule 2: static build emits valid JSON-LD Article + Person (knowsAbout, image) and never stores avatars on disk", () => {
  const s = site();
  const expert = author();
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
    tags: [],
    mustCover: [],
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
  const files = staticFiles(s, [article], true, [expert]);
  const post = files.find((file) => file.name === `post/${article.slug}/index.html`)!;
  assert.ok(post.text.includes('<script type="application/ld+json">'));
  assert.ok(post.text.includes(expert.avatarUrl));
  assert.ok(post.text.includes("referrerpolicy"));
  // byline card + author archive must exist; avatars are URL text (~90 bytes), not media files
  assert.ok(files.some((file) => file.name === `author/${expert.slug}/index.html`));
  const media = files.filter((file) => file.name.startsWith("assets/img"));
  assert.equal(media.length, 0, "zero disk writes: avatars must never become build media files");
  assert.ok(expert.avatarUrl.length < 200, "avatar URL string stays tiny (<200 chars)");
});

test("Rule 2 persona: PhD/academic topics create a real doctoral candidate (never a staff reporter) written in first person", () => {
  const expert = generateAuthorForTopic("weekly research schedule for PhD students", "sX");
  assert.match(expert.role, /PhD Candidate in .+ at .+/);
  assert.ok(!/staff\s+(writer|reporter)/i.test(expert.role), "no generic byline for a PhD topic");
  assert.equal(expert.voice.pov, "first-person", "lived grad-school experience is first person");
  assert.ok(expert.shortBio.includes(expert.city), "academic bio pins a real university city");
  const block = authorVoiceBlock(expert);
  assert.match(block, /FIRST PERSON/);
  assert.ok(block.includes(expert.role));
});

test("Rule 2 persona: experiential/practitioner guides are first person with a field-matched role", () => {
  const strength = generateAuthorForTopic("how to start strength training at home", "sX");
  assert.match(strength.role, /(Strength and Conditioning|Registered Nurse|Dietitian|Social Worker|Sleep Medicine)/);
  assert.equal(strength.voice.pov, "first-person");
  const engineer = generateAuthorForTopic("my first year as a software engineer", "sX");
  assert.match(engineer.role, /Engineer|Data Scientist/);
  assert.equal(engineer.voice.pov, "first-person");
});

test("Rule 2 persona: informational concept topics keep a credentialed domain persona, never a generic byline", () => {
  const finance = generateAuthorForTopic("how index fund investing works", "sX");
  assert.ok(!/staff\s+(writer|reporter)/i.test(finance.role));
  assert.match(finance.role, /(Financial Analyst|Accountant|Financial Counselor|Real Estate Broker)/);
  const legal = matchOrCreateAuthorForTopic({ id: "s1", nicheTag: "immigration law" }, [], "immigration law basics", { autoMatch: true });
  assert.equal(legal.created, true);
  assert.match(legal.author.role, /Attorney/);
});

test("Rule 2 persona: legacy 'Staff writer' bylines are upgraded to the topic-matched persona", () => {
  const legacy = normalizeAuthorProfile({
    id: "a1",
    siteId: "s1",
    name: "Dana Whitfield",
    role: "Staff writer, Research craft",
    topic: "phd research methods",
    expertise: ["phd research methods"],
    city: "Austin",
    region: "TX",
    country: "US",
    slug: "dana-whitfield",
    avatarUrl: avatarUrlFor("a1"),
    articleCount: 0,
    maxArticles: 250,
    status: "active",
    createdAt: 0,
    origin: "auto",
  });
  assert.match(legacy.role, /PhD Candidate/);
  assert.equal(legacy.voice.pov, "first-person");
});

test("Rule 2 persona: personaForTopic is deterministic per topic", () => {
  const a = personaForTopic("graduate school funding", "academic life");
  const b = personaForTopic("graduate school funding", "academic life");
  assert.deepEqual(a, b);
  assert.equal(a.family, "academic");
});

test("a captured portrait is kept as-is, and a legacy generator URL is resized through the CDN", () => {
  const stored = `data:image/webp;base64,${"A".repeat(900)}`;
  assert.equal(portraitSrc({ id: "a1", avatarUrl: stored }, 128), stored);

  const legacy = avatarUrlFor("avatar:s1:ellen");
  assert.match(legacy, /random-person\.jpeg\?r=/);
  const resized = portraitSrc({ id: "a1", avatarUrl: legacy }, 128);
  const token = avatarSeed(legacy);
  assert.ok(token, "the token must be readable back out of the URL");
  assert.ok(resized.includes("wsrv.nl"), resized);
  assert.ok(resized.includes(encodeURIComponent(token)), "the per-author token must survive the resize");
  assert.ok(resized.includes("w=128&h=128"), resized);
  assert.ok(resized.includes("output=webp"), resized);
});

test("every capture asks the generator for a face the CDN has not seen", () => {
  const first = freshPortraitToken("a1");
  const second = freshPortraitToken("a1");
  assert.notEqual(first, second, "two captures must never resolve to the same face");
  assert.notEqual(freshPortraitToken("a1"), freshPortraitToken("a2"));
});

test("the static build ships the stored portrait instead of the 500 KB generator URL", () => {
  const stored = `data:image/webp;base64,${"B".repeat(900)}`;
  const captured = avatarImgHtml(author({ avatarUrl: stored }));
  assert.ok(captured.includes(stored), "the captured portrait must be embedded as-is");
  assert.ok(!captured.includes("thispersondoesnotexist.com"), captured);

  const legacy = avatarImgHtml(author({ avatarUrl: avatarUrlFor("avatar:s1:ellen") }));
  assert.ok(legacy.includes("wsrv.nl"), legacy);
  assert.ok(!legacy.includes("random-person.jpeg?r="), "the raw generator URL must never reach a page");
});

test("portrait capture returns null instead of throwing outside a browser", async () => {
  assert.equal(await capturePortrait("a1"), null);
});
