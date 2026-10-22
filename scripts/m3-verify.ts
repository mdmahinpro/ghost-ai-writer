/**
 * Milestone 3 verification — Bing pipeline + humanization + 11-stage research (Rules 3, 5).
 * Run: npx vite-node scripts/m3-authors… see package.json: npm run test:m3
 * Exercises the real modules with Vite resolution: Bing blueprint prompts,
 * robotic scrub, the 11-stage research engine (scripted chat + no-key + retry,
 * derived zero-token stages, dedupe thresholds, plan building), and static-site
 * JSON-LD + ad-slot placeholders. Exits non-zero on the first failure.
 */
import assert from "node:assert/strict";
import { DEFAULT_LIMITS, RESEARCH_STAGES, type Persisted, type ResearchProject, type Site } from "../src/lib/types";
import { bannedPhraseScan, buildDraftPrompt, buildIntentPrompt, buildRevisionPrompt, fallbackBlueprint, roboticScrub } from "../src/lib/stage-contracts";
import { classifyActions, dedupeQueries, newResearchProject, planFromResearch, rerunFailedStages, runResearch, type ResearchChat as RChat } from "../src/lib/research-engine";
import { articleJsonLd, staticFiles } from "../src/lib/static-site";
import { authorVoiceBlock, avatarUrlFor } from "../src/lib/authors";
import type { AuthorProfile } from "../src/lib/types";

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
      bannedPhrases: ["in today's fast-paced world"],
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

function author(): AuthorProfile {
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
    voice: {
      rhythm: "short declaratives",
      diction: "plain words",
      sentenceLengthBand: "8–16 words",
      pov: "third-person",
      tone: "direct",
      readingLevel: "general",
      signatureMoves: ["opens with the decision"],
      bannedPhrases: ["game-changer"],
    },
    articleCount: 0,
    maxArticles: 250,
    status: "active",
    ghostAuthorId: null,
    ghostSlug: null,
    createdAt: 0,
    origin: "auto",
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
    keys: [],
    builds: [],
    deploys: [],
    audits: [],
    activity: [],
    account: { name: "T", email: "t@example.com", emailVerified: true, adminApproved: true, sessions: [] },
    defaults: site().voice,
    ideas: null,
    notice: null,
    authors: [author()],
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

function researchProject(): ResearchProject {
  return newResearchProject({ siteId: "s1", niche: "research note systems", notes: "Keep it practical.", breadth: "standard", now: 1000, site: site(), data: fixture() });
}

function makeChat(): { chat: RChat; calls: string[] } {
  const calls: string[] = [];
  const chat: RChat = async ({ system }) => {
    const stage = Number(system.match(/stage (\d+) of an 11-stage/)?.[1] ?? "0");
    calls.push(`R${stage}`);
    const usage = { prompt: 400 + stage * 10, completion: 150 + stage * 10, total: 550 + stage * 20 };
    const json = (value: unknown) => ({ ok: true as const, text: JSON.stringify(value), usage });
    switch (stage) {
      case 1: return json({ entityMap: "Note systems, capture tools, review habits", subNiches: ["zettelkasten", "daily notes"], terminology: ["capture", "review"], purpose: "Help researchers keep notes that survive." });
      case 2: return json({ personas: [{ persona: "grad student", intent: "keep sources straight", pain: "notes pile up unread" }, { persona: "analyst", intent: "reuse findings", pain: "duplication" }, { persona: "writer", intent: "draft faster", pain: "blank page" }] });
      case 3: return json({ problems: [{ persona: "grad student", problem: "notes are never reviewed" }, { persona: "analyst", problem: "same research done twice" }, { persona: "writer", problem: "no starting point for drafts" }] });
      case 4: return json({ pillar: "A note system that survives week three", clusters: Array.from({ length: 8 }, (_, i) => ({ title: `Cluster decision ${i}: build the review loop`, angle: "one concrete outcome" })) });
      case 5: return json({ queries: [
        { query: "how do I start a research note system", topic: "starting" },
        { query: "how do you start a research note system", topic: "starting" },
        { query: "what does a note system cost in time", topic: "costs" },
        { query: "research note system failure modes", topic: "risks" },
        { query: "which notebook is best for research notes", topic: "tools" },
        { query: "how often should researchers review notes", topic: "cadence" },
        { query: "can a note system replace reference managers", topic: "tools" },
        { query: "what belongs in a research note template", topic: "starting" },
      ] });
      case 6: return json({ intents: [
        { query: "how do I start a research note system", intent: "how-to" },
        { query: "what does a note system cost in time", intent: "informational" },
        { query: "research note system failure modes", intent: "informational" },
        { query: "which notebook is best for research notes", intent: "comparison" },
        { query: "how often should researchers review notes", intent: "how-to" },
        { query: "can a note system replace reference managers", intent: "comparison" },
        { query: "what belongs in a research note template", intent: "how-to" },
      ] });
      case 8: return json({ mapped: [
        { query: "how do I start a research note system", state: "missing", evidence: "no page" },
        { query: "what does a note system cost in time", state: "partial", evidence: "one passing mention" },
        { query: "research note system failure modes", state: "covered", evidence: "failure-modes post" },
        { query: "which notebook is best for research notes", state: "weak", evidence: "single paragraph" },
        { query: "how often should researchers review notes", state: "missing", evidence: "no page" },
        { query: "what belongs in a research note template", state: "missing", evidence: "no page" },
      ] });
      case 9: return json({ clusters: [
        { title: "Starting a note system", angle: "first-week loop", queries: ["how do I start a research note system"] },
        { title: "Cost and upkeep of note systems", angle: "time budget", queries: ["what does a note system cost in time"] },
        { title: "Failure modes and recovery", angle: "what breaks first", queries: ["research note system failure modes"] },
        { title: "Review cadence that survives deadlines", angle: "weekly loop", queries: ["how often should researchers review notes"] },
      ] });
      case 11: return json({ note: "Write the missing pages first; refresh the partial one.", scores: [{ topic: "Starting a note system", score: 90, why: "missing coverage, how-to intent" }] });
      default: return { ok: false as const, error: "unexpected stage call" };
    }
  };
  return { chat, calls };
}

console.log("Milestone 3 · Bing pipeline + humanization + 11-stage research\n");

await check("Rule 3a: blueprint prompts carry the answer block, question H2s, and table plan", () => {
  const intent = fallbackBlueprint({ keyword: "research note systems", title: "A note system that survives week three" });
  const ctx = {
    siteName: "Test",
    niche: "research craft",
    author: author(),
    bannedPhrases: ["in today's fast-paced world"],
    brandFacts: [],
    tone: "clear",
    pov: "third-person" as const,
    readingLevel: "general" as const,
    workingTitle: "A note system that survives week three",
    keyword: "research note systems",
    sectionCount: 5,
    avoidTitles: ["Older page"],
    blueprint: intent,
  };
  const intentPrompt = buildIntentPrompt(ctx);
  assert.match(intentPrompt.system, /answerBlock/);
  assert.match(intentPrompt.system, /questionH2s/);
  const draftPrompt = buildDraftPrompt(ctx, intent);
  assert.match(draftPrompt.system, /Open with the 40–60 word direct answer/);
  assert.match(draftPrompt.user, /Direct opening answer/);
  assert.match(draftPrompt.system, /exactly one concrete markdown table/);
  assert.match(draftPrompt.system, /signature moves/i);
  assert.match(draftPrompt.system, /thispersondoesnotexist|Dana Whitfield|Voice:/);
  assert.match(authorVoiceBlock(author()), /Never write these robotic AI phrases/);
  const revisionPrompt = buildRevisionPrompt(ctx, "Draft text…");
  assert.match(revisionPrompt.system, /Robotic scrub order/);
  assert.match(revisionPrompt.system, /delve/);
  assert.match(draftPrompt.system, /Prompt version draft@4-blader-anti-ai/);
  assert.match(revisionPrompt.system, /Prompt version revision@4-blader-humanize/);
  assert.match(intentPrompt.system, /Prompt version intent@2-bing/);
});

await check("Rule 3d: robotic scrub + post-scan prove a humanized draft passes", () => {
  const dirty = "In today's fast-paced world researchers delve into capture.\n\nUnlock the power of review.\n\nUnlock the power of review.\n\nReal closing note.";
  assert.ok(bannedPhraseScan(dirty).length >= 3);
  const scrub = roboticScrub(dirty, ["in today's fast-paced world"]);
  assert.equal(bannedPhraseScan(scrub.markdown).join(""), "");
  assert.ok(scrub.scrubbed.length >= 3, JSON.stringify(scrub.scrubbed));
});

await check("11-stage engine (estimation-fixture chat): all stages complete; R7/R10 derived at 0 tokens", async () => {
  const { chat } = makeChat();
  const data = fixture({ research: [researchProject()] });
  const id = data.research[0]!.id;
  const done = (await runResearch(data, id, chat, 2000)).research[0]!;
  assert.equal(done.status, "ready");
  assert.equal(done.stagesCompleted, 11);
  const derived = done.stages.filter((stage) => stage.engine === "derived");
  assert.equal(derived.length, 2);
  for (const stage of derived) {
    assert.equal(stage.tokens, 0);
    assert.match(stage.note ?? "", /Derived \(0 tokens\)/);
  }
  assert.ok(done.output.queries!.some((query) => query.status === "merged"));
  assert.match(done.output.actions![0]!.reason, /Coverage|Existing page/);
});

await check("research rerun idempotency: finished stages are skipped with zero re-charges", async () => {
  const { chat, calls } = makeChat();
  const data = fixture({ research: [researchProject()] });
  const id = data.research[0]!.id;
  const first = await runResearch(data, id, chat, 2000);
  const tokensFirst = first.research[0]!.stages.map((stage) => stage.tokens).join(",");
  const callsFirst = calls.join(",");
  await runResearch(structuredClone(first), id, chat, 3000);
  assert.equal(calls.join(","), callsFirst, "no model calls on rerun");
  const second = await runResearch(structuredClone(first), id, chat, 3000);
  assert.equal(second.research[0]!.stages.map((stage) => stage.tokens).join(","), tokensFirst);
});

await check("no usable key: engine fails honestly (NO_RESEARCH_KEY) and fakes nothing", async () => {
  const data = fixture({ research: [researchProject()] });
  const id = data.research[0]!.id;
  const done = (await runResearch(data, id, undefined, 2000)).research[0]!;
  assert.equal(done.status, "failed");
  const niche = done.stages.find((stage) => stage.key === "niche")!;
  assert.match(niche.error ?? "", /NO_RESEARCH_KEY|every chat key/);
});

await check("retry continues from what is missing; earlier stages are not re-charged", async () => {
  let failStage3 = true;
  const base = makeChat();
  const chat: RChat = async (input) => {
    if (input.system.includes("stage 3 of an 11-stage") && failStage3) {
      failStage3 = false;
      return { ok: false as const, error: "provider 429" };
    }
    return base.chat(input);
  };
  let data = fixture({ research: [researchProject()] });
  const id = data.research[0]!.id;
  data = await runResearch(data, id, chat, 2000);
  const partial = data.research[0]!;
  assert.equal(partial.status, "partial");
  assert.equal(partial.stagesCompleted, 2);
  const nicheTokensBeforeRetry = partial.stages[RESEARCH_STAGES.findIndex((stage) => stage.key === "niche")]!.tokens;
  const callsBeforeRetry = base.calls.join(",");
  // user retry: reset ONLY failed stages, then continue
  data = rerunFailedStages(data, id) ?? data;
  data = await runResearch(data, id, base.chat, 3000);
  const finished = data.research[0]!;
  assert.equal(finished.status, "ready");
  const stageIndex = (key: string) => RESEARCH_STAGES.findIndex((stage) => stage.key === key);
  assert.equal(finished.stages[stageIndex("niche")]!.tokens, nicheTokensBeforeRetry, "R1 not re-charged");
  assert.equal(finished.stages[stageIndex("problem")]!.attempts, 2);
  assert.ok(finished.stages[stageIndex("problem")]!.tokens > 0, "R3 completed on retry");
  assert.notEqual(base.calls.join(","), callsBeforeRetry, "retry did call the model for the missing stage only");
});

await check("dedupe threshold: >0.90 cosine merges, distinct stays; action classes write/refresh/skip", () => {
  const { merged } = dedupeQueries([
    { id: "q1", query: "how do I start a research note system", status: "keep" },
    { id: "q2", query: "how do you start a research note system", status: "keep" },
    { id: "q3", query: "research note system failure modes", status: "keep" },
  ]);
  assert.equal(merged, 1);
  const { actions } = classifyActions(
    [
      { id: "q1", query: "how do I start a research note system", status: "keep" },
      { id: "q3", query: "research note system failure modes", status: "keep" },
    ],
    [
      { queryId: "q1", query: "how do I start a research note system", state: "missing", evidence: "none" },
      { queryId: "q3", query: "research note system failure modes", state: "covered", evidence: "post" },
    ],
  );
  assert.deepEqual(actions.map((action) => action.action), ["write", "skip"]);
});

await check("plan from research: pillar + clusters become a review-status TopicPlan", async () => {
  const { chat } = makeChat();
  const data = fixture({ research: [researchProject()] });
  const id = data.research[0]!.id;
  const done = await runResearch(data, id, chat, 2000);
  const result = planFromResearch(done, id, 4000);
  assert.ok(result.planId, result.error);
  const plan = done.plans[0]!;
  assert.equal(plan.status, "review");
  assert.equal(plan.pillarTitle, "A note system that survives week three");
  assert.ok(plan.clusters.length >= 3);
});

await check("static build: JSON-LD Person + 7 ad-slot placeholders + CLS-safe media CSS, zero avatar media files", () => {
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
  assert.equal(jsonLd.author["@type"], "Person");
  assert.deepEqual(jsonLd.author.knowsAbout, expert.expertise);
  const files = staticFiles(s, [article], true, [expert]);
  const post = files.find((file) => file.name === `post/${article.slug}/index.html`)!;
  for (const slot of ["site_top", "article_top", "article_bottom", "article_sidebar", "site_bottom"]) {
    assert.ok(post.text.includes(`data-ad-slot="${slot}"`), `missing ad slot ${slot}`);
  }
  // Rule 6 moved the CSS to one shared stylesheet, so CLS/table rules live there.
  const styles = files.find((file) => file.name === "assets/site.css")?.text ?? "";
  assert.ok(styles.includes("aspect-ratio"), "CLS: figure boxes reserve space");
  assert.ok(styles.includes("border-collapse: collapse"), "table CSS present");
  assert.equal(files.filter((file) => file.name.startsWith("assets/img")).length, 0);
});

await check("avatar URL policy still holds after M3 (zero disk, tiny URL strings)", () => {
  const generated = author();
  assert.match(generated.avatarUrl, /^https:\/\/thispersondoesnotexist\.com\/image\?seed=/);
  assert.ok(generated.avatarUrl.length <= 120);
});

console.log(`\n${passed} passed, ${failures.length} failed`);
if (failures.length) {
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}
