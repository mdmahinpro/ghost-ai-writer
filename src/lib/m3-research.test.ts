import { test } from "node:test";
import assert from "node:assert/strict";
import { DEFAULT_LIMITS, RESEARCH_STAGES, type Persisted, type ResearchProject, type Site } from "./types.ts";
import { bannedPhraseScan, fallbackBlueprint, parseIntentStage, parseModelStage, roboticScrub } from "./stage-contracts.ts";
import { classifyActions, dedupeQueries, newResearchProject, planFromResearch, rerunFailedStages, runResearch, type ResearchChat as RChat } from "./research-engine.ts";

function site(id = "s1"): Site {
  return {
    id,
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
    authors: [],
    firecrawl: { secret: "", hint: "" },
    calendars: [],
    research: [],
    workerPaused: false,
    worker: { lastBeatAt: 0, online: false, activeJobs: 0, source: "browser" as const },
    backups: [],
    corpus: [],
    limits: { ...DEFAULT_LIMITS },
    webSearch: { mode: "off", tavilyKeys: [], firecrawlKeys: [], tavilyCursor: 0, firecrawlCursor: 0 },
    ...patch,
  };
}

function project(): ResearchProject {
  return newResearchProject({ siteId: "s1", niche: "research note systems", notes: "Keep it practical.", breadth: "standard", now: 1000, site: site(), data: fixture() });
}

function makeChat(): { chat: RChat; calls: string[] } {
  const calls: string[] = [];
  const chat: RChat = async ({ system }) => {
    const stage = Number(system.match(/stage (\d+) of an 11-stage/)?.[1] ?? "0");
    calls.push(`R${stage}`);
    const usage = { prompt: 500 + stage * 10, completion: 200 + stage * 10, total: 700 + stage * 20 };
    const json = (value: unknown) => ({ ok: true as const, text: JSON.stringify(value), usage });
    switch (stage) {
      case 1:
        return json({ entityMap: "Note systems, capture tools, review habits", subNiches: ["zettelkasten", "daily notes"], terminology: ["capture", "review"], purpose: "Help researchers keep notes that survive." });
      case 2:
        return json({ personas: [{ persona: "grad student", intent: "keep sources straight", pain: "notes pile up unread" }, { persona: "analyst", intent: "reuse findings", pain: "duplication" }, { persona: "writer", intent: "draft faster", pain: "blank page" }] });
      case 3:
        return json({ problems: [{ persona: "grad student", problem: "notes are never reviewed" }, { persona: "analyst", problem: "same research done twice" }, { persona: "writer", problem: "no starting point for drafts" }] });
      case 4:
        return json({ pillar: "A note system that survives week three", clusters: Array.from({ length: 8 }, (_, i) => ({ title: `Cluster decision ${i}: build the review loop`, angle: "one concrete outcome" })) });
      case 5:
        return json({ queries: [
          { query: "how do I start a research note system", topic: "starting" },
          { query: "how do you start a research note system", topic: "starting" },
          { query: "what does a note system cost in time", topic: "costs" },
          { query: "research note system failure modes", topic: "risks" },
          { query: "which notebook is best for research notes", topic: "tools" },
          { query: "how often should researchers review notes", topic: "cadence" },
          { query: "can a note system replace reference managers", topic: "tools" },
          { query: "what belongs in a research note template", topic: "starting" },
        ] });
      case 6:
        return json({ intents: [
          { query: "how do I start a research note system", intent: "how-to" },
          { query: "what does a note system cost in time", intent: "informational" },
          { query: "research note system failure modes", intent: "informational" },
          { query: "which notebook is best for research notes", intent: "comparison" },
          { query: "how often should researchers review notes", intent: "how-to" },
          { query: "can a note system replace reference managers", intent: "comparison" },
          { query: "what belongs in a research note template", intent: "how-to" },
        ] });
      case 8:
        return json({ mapped: [
          { query: "how do I start a research note system", state: "missing", evidence: "no page" },
          { query: "what does a note system cost in time", state: "partial", evidence: "one passing mention" },
          { query: "research note system failure modes", state: "covered", evidence: "failure-modes post" },
          { query: "which notebook is best for research notes", state: "weak", evidence: "single paragraph" },
          { query: "how often should researchers review notes", state: "missing", evidence: "no page" },
          { query: "what belongs in a research note template", state: "missing", evidence: "no page" },
        ] });
      case 9:
        return json({ clusters: [
          { title: "Starting a note system", angle: "first-week loop", queries: ["how do I start a research note system"] },
          { title: "Cost and upkeep of note systems", angle: "time budget", queries: ["what does a note system cost in time"] },
          { title: "Failure modes and recovery", angle: "what breaks first", queries: ["research note system failure modes"] },
          { title: "Review cadence that survives deadlines", angle: "weekly loop", queries: ["how often should researchers review notes"] },
        ] });
      case 11:
        return json({ note: "Write the missing pages first; refresh the partial one.", scores: [{ topic: "Starting a note system", score: 90, why: "missing coverage, how-to intent" }] });
      default:
        return { ok: false as const, error: "unexpected stage call" };
    }
  };
  return { chat, calls };
}

test("Rule 3a: intent blueprint zod fixture validates, and garbage is refused", () => {
  const good = fallbackBlueprint({ keyword: "research note systems", title: "A note system that survives week three" });
  const reparsed = parseIntentStage(JSON.stringify(good));
  assert.equal(reparsed.tablePlan, true);
  assert.ok(reparsed.answerBlock.length >= 40);
  assert.throws(() => parseIntentStage(JSON.stringify({ intent: "x" })), /validation failed/);
});

test("Rule 3: model stage fixtures parse (draft + revision with verify flags)", () => {
  const draft = parseModelStage("draft", JSON.stringify({ markdown: "## Heading\n\n" + "Body text long enough for the schema validation. ".repeat(5) }));
  assert.ok(draft.markdown.startsWith("## Heading"));
  const revision = parseModelStage("revision", JSON.stringify({ markdown: "## Revised\n\n" + "Revised body long enough for the schema. ".repeat(5), verifyFlags: [{ claim: "$4,000", why: "price" }] }));
  assert.match(revision.verifyFlags![0]!, /\$4,000/);
  assert.throws(() => parseModelStage("draft", "not json"), /validation failed/);
});

test("Rule 3d: robotic scrub removes banned phrases and repeated sentences; scan passes after", () => {
  const dirty = `In today's fast-paced world, research note systems matter.\n\nWe must delve into capture habits.\n\nWe must delve into capture habits.\n\nThe review loop closes every Friday.`;
  const scan = bannedPhraseScan(dirty, ["we must delve"]);
  assert.ok(scan.includes("delve") || scan.includes("we must delve"));
  const scrub = roboticScrub(dirty);
  assert.equal(bannedPhraseScan(scrub.markdown, ["we must delve"]).join(","), ""); // "delve" and the phrase are gone
  assert.ok(scrub.scrubbed.length >= 2, `expected phrase + repeat removals, got ${JSON.stringify(scrub.scrubbed)}`);
  assert.ok(!/We must delve into capture habits\.\n\nWe must delve/.test(scrub.markdown), "repeated sentence collapsed");
});

test("R7 semantic consolidation: cosine > 0.90 merges near-duplicates and keeps distinct queries at 0 tokens", () => {
  const { queries, merged } = dedupeQueries([
    { id: "q1", query: "how do I start a research note system", status: "keep" as const },
    { id: "q2", query: "how do you start a research note system", status: "keep" as const },
    { id: "q3", query: "research note system failure modes", status: "keep" as const },
  ]);
  assert.equal(merged, 1, "the you/I variant merges");
  assert.equal(queries.find((row) => row.id === "q1")?.status, "keep");
  assert.equal(queries.find((row) => row.id === "q2")?.status, "merged");
  assert.equal(queries.find((row) => row.id === "q3")?.status, "keep");
});

test("R10 action classification: covered→skip, partial→refresh, missing→write", () => {
  const coverage = [
    { queryId: "q1", query: "start a note system", state: "missing" as const, evidence: "none" },
    { queryId: "q2", query: "cost of a note system", state: "partial" as const, evidence: "mention" },
    { queryId: "q3", query: "failure modes", state: "covered" as const, evidence: "post" },
  ];
  const { actions } = classifyActions(
    [
      { id: "q1", query: "start a note system", status: "keep" },
      { id: "q2", query: "cost of a note system", status: "keep" },
      { id: "q3", query: "failure modes", status: "keep" },
    ],
    coverage,
  );
  assert.deepEqual(actions.map((row) => row.action), ["write", "refresh", "skip"]);
});

test("11-stage engine: scripted chat completes every stage, R7/R11 derived, rerun is idempotent", async () => {
  const { chat, calls } = makeChat();
  const data = fixture({ research: [project()] });
  const id = data.research[0]!.id;
  const first = await runResearch(data, id, chat, 2000);
  const done = first.research[0]!;
  assert.equal(done.status, "ready", `expected READY, got ${done.status}: ${done.stages.filter((s) => s.status === "failed").map((s) => `${s.key}:${s.error}`).join("; ")}`);
  assert.equal(done.stagesCompleted, 11);
  for (const stage of done.stages) {
    assert.equal(stage.status, "done", `${stage.key} not done`);
    if (stage.engine === "derived") assert.equal(stage.tokens, 0, "derived stages cost 0 tokens");
    else assert.ok(stage.tokens > 0, `${stage.key} should settle real tokens`);
  }
  assert.ok(done.output.queries?.some((query) => query.status === "merged"), "R7 merged the you/I variant");
  assert.ok(done.output.actions?.length, "R10 produced actions");
  const tokensFirst = done.stages.map((stage) => stage.tokens).join(",");
  const callsFirst = calls.join(",");
  // rerun: nothing is re-run or re-charged
  const second = await runResearch(structuredClone(first), id, chat, 3000);
  assert.equal(second.research[0]!.stagesCompleted, 11);
  assert.equal(calls.join(","), callsFirst, "rerun made zero model calls");
  assert.equal(second.research[0]!.stages.map((stage) => stage.tokens).join(","), tokensFirst, "rerun re-charged nothing");
});

test("11-stage engine: without a chat key the LLM stages stop honestly, project fails (not fabricated)", async () => {
  const data = fixture({ research: [project()] });
  const id = data.research[0]!.id;
  const result = await runResearch(data, id, undefined, 2000);
  const done = result.research[0]!;
  assert.equal(done.status, "failed");
  const first = done.stages.find((stage) => stage.key === "niche")!;
  assert.equal(first.status, "failed");
  assert.match(first.error ?? "", /NO_RESEARCH_KEY/);
  assert.ok(done.stages.every((stage) => stage.status !== "done"), "no stage should fake completion");
});

test("retry continues from what is missing and never re-charges finished stages", async () => {
  // chat that fails once on stage 3 then succeeds
  let failStage3 = true;
  const base = makeChat();
  const chat: RChat = async (input) => {
    if (input.system.includes("stage 3 of an 11-stage") && failStage3) {
      failStage3 = false;
      return { ok: false as const, error: "provider 429" };
    }
    return base.chat(input);
  };
  const data = fixture({ research: [project()] });
  const id = data.research[0]!.id;
  const partial = await runResearch(data, id, chat, 2000);
  const afterOne = partial.research[0]!;
  assert.equal(afterOne.status, "partial");
  assert.equal(afterOne.stagesCompleted, 2, "safe stop after R3: earlier stages done, later stages untouched");
  const nicheTokensBefore = afterOne.stages.find((stage) => stage.key === "niche")!.tokens;
  const callCountBefore = base.calls.length;
  // the failed stage keeps its honest error
  const r3 = afterOne.stages.find((stage) => stage.key === "problem")!;
  assert.equal(r3.status, "failed");
  assert.match(r3.error ?? "", /429/);
  // user retry resets ONLY failed stages
  const reset = rerunFailedStages(structuredClone(partial), id);
  assert.ok(reset);
  const done = await runResearch(reset!, id, chat, 3000);
  const finished = done.research[0]!;
  const stageIndex = (key: string) => RESEARCH_STAGES.findIndex((stage) => stage.key === key);
  assert.equal(finished.status, "ready");
  const niche = finished.stages[stageIndex("niche")]!;
  const problem = finished.stages[stageIndex("problem")]!;
  assert.equal(niche.tokens, nicheTokensBefore, "R1 not re-charged");
  assert.equal(base.calls.length - callCountBefore, 7, "retry recharged only the 7 LLM stages from R3 onward; finished two were skipped");
  assert.equal(problem.attempts, 2, "R3 shows its retry count");
  assert.ok(problem.tokens > 0, "R3 completed on retry");
});

test("plan from research builds a review plan from the model universe", async () => {
  const data = fixture({ research: [project()] });
  const id = data.research[0]!.id;
  const done = await runResearch(data, id, makeChat().chat, 2000);
  const before = done.plans.length;
  const result = planFromResearch(done, id, 4000);
  assert.ok(result.planId, result.error);
  const plan = done.plans[0]!;
  assert.equal(done.plans.length, before + 1);
  assert.equal(plan.status, "review");
  assert.equal(plan.pillarTitle, "A note system that survives week three");
  assert.ok(plan.clusters.length >= 2);
});
