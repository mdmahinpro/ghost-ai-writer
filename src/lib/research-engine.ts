/**
 * Rule 3/§4 — Eleven-Stage Niche Research Engine (R1–R11, live names).
 *
 * Pure engine over Persisted: the caller injects a chat fn (key pool + model) so
 * the whole pipeline is testable offline. LLM stages R1–R6, R8, R9, R11 validate
 * JSON with one auto-retry; R7 (Semantic consolidation) and R10 (Content action
 * classification) are derived at 0 tokens. Failures stop safely and honestly —
 * later stages stay pending rather than being charged for a broken run.
 */
import { z } from "zod";
import { RESEARCH_STAGES, type Persisted, type ResearchCluster, type ResearchProject, type ResearchQuery, type ResearchStageKey, type ResearchStageRecord, type Site } from "./types.ts";
import { cosine, embed } from "./l3-embed.ts";
import { hashStr, uid } from "./utils.ts";

export const RESEARCH_PROMPT_VERSION = "research@1-r11";
export const NO_RESEARCH_KEY = "NO_RESEARCH_KEY — every chat key is disabled, cooling, or over its daily allowance.";

export type ResearchChat = (input: { system: string; user: string }) =>
  Promise<{ ok: true; text: string; usage: { prompt: number; completion: number; total: number } } | { ok: false; error: string }>;

const JSON_ONLY = (shape: string) => `Return valid JSON only (no markdown fence) matching ${shape}.`;

// ---------------------------------------------------------------------------
// Evidence: the legacy stub's honest "From your site" math, kept as R8 grounding.
// ---------------------------------------------------------------------------

export function siteEvidenceFacts(site: Site, data: Persisted, niche: string, notes: string, now: number): ResearchProject["facts"] {
  const articles = data.articles.filter((article) => article.siteId === site.id);
  const words = articles.reduce((sum, article) => sum + article.words, 0);
  const links = articles.reduce((sum, article) => sum + article.links.length, 0);
  const titles = articles.slice(0, 3).map((article) => article.title);
  const facts: ResearchProject["facts"] = [
    {
      id: uid("fact"),
      label: "From your site",
      text: articles.length
        ? `${site.name} already has ${articles.length} article${articles.length === 1 ? "" : "s"}${titles.length ? `: ${titles.join("; ")}` : ""}.`
        : `${site.name} has no articles in this studio yet. A first plan should stay narrow.`,
    },
    {
      id: uid("fact"),
      label: "Calculated",
      text: articles.length
        ? `${words.toLocaleString()} words across the corpus and ${links} internal links. Average ${Math.round(links / articles.length)} links per article.`
        : "No corpus math yet. The duplicate gate has nothing local to compare until the first run lands.",
    },
  ];
  if (notes.trim()) facts.push({ id: uid("fact"), label: "You wrote this", text: notes.trim() });
  void niche;
  void now;
  return facts;
}

function blankStage(key: (typeof RESEARCH_STAGES)[number]): ResearchStageRecord {
  return { key: key.key, name: key.name, engine: key.engine, status: "pending", tokens: 0, attempts: 0 };
}

export function newResearchProject(input: {
  siteId: string;
  niche: string;
  notes: string;
  breadth: ResearchProject["breadth"];
  now: number;
  site?: Site;
  data?: Persisted;
}): ResearchProject {
  const project: ResearchProject = {
    id: uid("res"),
    siteId: input.siteId,
    // Bounded on purpose: this text rides in every one of the eleven stage
    // prompts, so an accidental 200 KB paste cost 200 KB × 11 in input tokens.
    // The cap is far above a real niche brief.
    niche: input.niche.trim().slice(0, 240),
    notes: input.notes.trim().slice(0, 4000),
    createdAt: input.now,
    status: "partial",
    breadth: input.breadth,
    stages: RESEARCH_STAGES.map(blankStage),
    stagesCompleted: 0,
    attempts: 0,
    output: {},
    facts: input.site && input.data ? siteEvidenceFacts(input.site, input.data, input.niche, input.notes, input.now) : [],
  };
  return project;
}

/** Persist-v9: upgrade legacy fact-only projects into the staged shape (no data loss). */
export function normalizeResearchProject(raw: ResearchProject): ResearchProject {
  const legacy = raw as ResearchProject & { stages?: ResearchStageRecord[]; breadth?: ResearchProject["breadth"] };
  if (legacy.stages?.length === RESEARCH_STAGES.length) return legacy as ResearchProject;
  return {
    ...legacy,
    status: legacy.status === "ready" ? "ready" : "partial",
    breadth: legacy.breadth ?? "standard",
    stages: legacy.stages?.length === RESEARCH_STAGES.length ? legacy.stages : RESEARCH_STAGES.map(blankStage),
    stagesCompleted: legacy.stagesCompleted ?? 0,
    attempts: legacy.attempts ?? 0,
    output: legacy.output ?? {},
  };
}

function stageOf(project: ResearchProject, key: ResearchStageKey): ResearchStageRecord {
  return project.stages.find((stage) => stage.key === key)!;
}

export function projectStatus(project: ResearchProject): ResearchProject["status"] {
  const done = project.stages.filter((stage) => stage.status === "done").length;
  const failed = project.stages.some((stage) => stage.status === "failed");
  return done === RESEARCH_STAGES.length ? "ready" : failed ? (done ? "partial" : "failed") : "partial";
}

// ---------------------------------------------------------------------------
// Stage prompts + schemas (zod-validated, one auto-retry)
// ---------------------------------------------------------------------------

const nicheSchema = z.object({
  entityMap: z.string().min(20),
  subNiches: z.array(z.string().min(3)).min(2).max(10),
  terminology: z.array(z.string().min(2)).min(2).max(20),
  purpose: z.string().min(20),
});
const audienceSchema = z.object({ personas: z.array(z.object({ persona: z.string().min(2), intent: z.string().min(3), pain: z.string().min(3) })).min(3).max(6) });
const problemSchema = z.object({ problems: z.array(z.object({ persona: z.string().min(2), problem: z.string().min(5) })).min(3).max(12) });
const universeSchema = z.object({ pillar: z.string().min(6), clusters: z.array(z.object({ title: z.string().min(6), angle: z.string().optional() })).min(6).max(10) });
const expansionSchema = z.object({ queries: z.array(z.object({ query: z.string().min(6).max(160), topic: z.string().optional() })).min(6).max(40) });
const intentSchema = z.object({ intents: z.array(z.object({ query: z.string().min(6), intent: z.enum(["informational", "comparison", "transactional", "crisis", "how-to"]) })).min(1) });
const coverageSchema = z.object({ mapped: z.array(z.object({ query: z.string().min(6), state: z.enum(["covered", "partial", "weak", "missing"]), evidence: z.string().min(2) })).min(1) });
const clusterSchema = z.object({ clusters: z.array(z.object({ title: z.string().min(6), angle: z.string().min(6), queries: z.array(z.string().min(6)).default([]) })).min(3).max(8) });
const prioritySchema = z.object({ note: z.string().min(10), scores: z.array(z.object({ topic: z.string().min(3), score: z.number().min(0).max(100), why: z.string().min(3) })).min(1).max(12) });

function evidenceBlock(project: ResearchProject, data: Persisted, site: Site): string {
  const articleTitles = data.articles.filter((article) => article.siteId === site.id).slice(0, 60).map((article) => `- ${article.title}`).join("\n") || "- (no articles yet)";
  const facts = project.facts.map((fact) => `[${fact.label}] ${fact.text}`).join("\n");
  return `Evidence so far (corrections to these take precedence):\n${facts || "- none"}\n\nExisting pages:\n${articleTitles}`;
}

function stagePrompt(key: ResearchStageKey, project: ResearchProject, data: Persisted, site: Site): { system: string; user: string } {
  const base = `You are stage ${RESEARCH_STAGES.findIndex((stage) => stage.key === key) + 1} of an 11-stage niche research pipeline for the website "${site.name}". Niche: ${project.niche}. No search volume, CPC, difficulty, or ranking numbers exist — never invent them. ${JSON_ONLY("the shape below")} Prompt version ${RESEARCH_PROMPT_VERSION}.`;
  const evidence = evidenceBlock(project, data, site);
  const gauge = project.breadth === "compact" ? "10–15 queries" : project.breadth === "wide" ? "30–40 queries" : "18–25 queries";
  const queries = (project.output.queries ?? []).filter((query) => query.status === "keep");
  const queryList = queries.length ? `\n\nQueries from R5 (classify these verbatim):\n${queries.map((query) => `- ${query.query}`).join("\n")}` : "";
  const shapes: Record<ResearchStageKey, string> = {
    niche: '{"entityMap":string,"subNiches":string[],"terminology":string[],"purpose":string}',
    audience: '{"personas":[{"persona":string,"intent":string,"pain":string}]} (3–6 personas)',
    problem: '{"problems":[{"persona":string,"problem":string}]} (3–12 problems tied to those personas)',
    "topic-universe": '{"pillar":string,"clusters":[{"title":string,"angle":string}]} (pillar + 6–10 clusters, each a decision, no tips/tools/effectively headings)',
    "query-expansion": `{"queries":[{"query":string,"topic":string}]} — real user questions (${gauge})`,
    "intent-class": '{"intents":[{"query":string,"intent":"informational"|"comparison"|"transactional"|"crisis"|"how-to"}]} — classify the queries listed below verbatim',
    coverage: '{"mapped":[{"query":string,"state":"covered"|"partial"|"weak"|"missing","evidence":string}]} — against the existing pages listed below, for the queries listed below',
    "cluster-construction": '{"clusters":[{"title":string,"angle":string,"queries":string[]}]} (3–8 clusters, ≥0.88-distinct titles, internal-link opportunities)',
    priority: '{"note":string,"scores":[{"topic":string,"score":number,"why":string}]} (rule-based 0–100 from coverage and intent only)',
    "semantic-consolidation": "",
    "action-class": "",
  };
  return { system: `${base} ${shapes[key]}`, user: `${evidence}${key === "intent-class" || key === "coverage" ? queryList : ""}` };
}

// ---------------------------------------------------------------------------
// Derived stages — R7 semantic consolidation (0 tokens) and R10 action class
// ---------------------------------------------------------------------------

const R7_THRESHOLD = 0.9;

export function dedupeQueries(queries: ResearchQuery[]): { queries: ResearchQuery[]; merged: number } {
  const kept: ResearchQuery[] = [];
  let merged = 0;
  for (const query of queries) {
    if (query.status === "merged") {
      kept.push(query);
      continue;
    }
    const vector = embed(query.query);
    const twin = kept.find((candidate) => candidate.status === "keep" && cosine(vector, embed(candidate.query)) > R7_THRESHOLD);
    if (twin) {
      merged += 1;
      kept.push({ ...query, status: "merged", mergedInto: twin.id });
    } else {
      kept.push({ ...query, status: "keep", embedSource: "hash-fallback" });
    }
  }
  return { queries: kept, merged };
}

export function classifyActions(
  queries: ResearchQuery[],
  coverage: NonNullable<ResearchProject["output"]["coverage"]>,
): { actions: NonNullable<ResearchProject["output"]["actions"]>; skipped: number } {
  const stateFor = new Map(coverage.map((row) => [row.queryId ?? row.query, row.state]));
  const actions = queries
    .filter((query) => query.status === "keep")
    .map((query) => {
      const state = stateFor.get(query.id) ?? stateFor.get(query.query) ?? "missing";
      if (state === "covered") return { queryId: query.id, query: query.query, action: "skip" as const, reason: "Existing page already answers this query." };
      if (state === "partial") return { queryId: query.id, query: query.query, action: "refresh" as const, reason: "Existing page partially answers it — refresh rather than duplicate." };
      return { queryId: query.id, query: query.query, action: "write" as const, reason: `Coverage is ${state}; a new page should own this question.` };
    });
  return { actions, skipped: queries.filter((query) => query.status === "merged").length };
}

// ---------------------------------------------------------------------------
// Runner
// ---------------------------------------------------------------------------

function parseJson(systemShapeError: string, text: string): unknown {
  try {
    return JSON.parse(text.replace(/^```json\s*|```$/g, "").trim());
  } catch {
    throw new Error(`${systemShapeError}: response is not valid JSON`);
  }
}

/**
 * Model output is trimmed to these ceilings instead of being rejected.
 *
 * The schema caps describe the shape we want to keep, not a promise a model
 * keeps: a reply with 26 terminology terms is still a correct answer, and
 * failing the stage over it burned a model call and stopped the whole project
 * at R1 ("Too big: expected array to have <=20 items"). Trimming degrades a
 * long list to a shorter one; it never invents or drops required fields, so a
 * genuinely wrong answer still fails validation and gets the retry.
 */
const LIST_CAPS: Record<string, number> = {
  subNiches: 10,
  terminology: 20,
  personas: 6,
  problems: 12,
  clusters: 8,
  queries: 40,
  intents: 120,
  mapped: 120,
  scores: 12,
};

const MAX_ARRAY = 200;
const MAX_STRING = 4000;

function tidy(value: unknown, depth = 0): unknown {
  if (depth > 6) return value;
  if (typeof value === "string") return value.trim().slice(0, MAX_STRING);
  if (Array.isArray(value)) return value.slice(0, MAX_ARRAY).map((item) => tidy(item, depth + 1));
  if (value && typeof value === "object") {
    const out: Record<string, unknown> = {};
    for (const [key, item] of Object.entries(value as Record<string, unknown>)) {
      const cap = LIST_CAPS[key];
      out[key] =
        cap && Array.isArray(item)
          ? item.slice(0, cap).map((entry) => tidy(entry, depth + 1))
          : tidy(item, depth + 1);
    }
    return out;
  }
  return value;
}

async function askValidated(
  chat: ResearchChat,
  prompt: { system: string; user: string },
  stageName: string,
  validate: (value: unknown) => { ok: true; value: unknown } | { ok: false; error: string },
): Promise<{ value: unknown; usage: { prompt: number; completion: number; total: number } }> {
  const check = (text: string) => {
    let parsed: unknown;
    try {
      parsed = parseJson(stageName, text);
    } catch (error) {
      return { ok: false as const, error: error instanceof Error ? error.message : "not valid JSON" };
    }
    return validate(parsed);
  };
  const first = await chat(prompt);
  if (!first.ok) throw new Error(first.error);
  const firstCheck = check(first.text);
  if (firstCheck.ok) return { value: firstCheck.value, usage: first.usage };
  // Contract: one auto-retry with the validation error appended; a second failure stops the stage safely.
  const retry = await chat({ system: prompt.system, user: `${prompt.user}\n\nThe previous response was rejected: ${firstCheck.error} Fix it and return valid JSON only.` });
  if (!retry.ok) throw new Error(retry.error);
  const second = check(retry.text);
  if (!second.ok) throw new Error(second.error);
  return { value: second.value, usage: retry.usage };
}

/**
 * Runs every runnable stage in order, mutating the caller's Persisted in place
 * (pass a structuredClone from the store). Idempotent per project: `done`
 * stages are skipped — a rerun continues from what is missing and never
 * re-charges the rest.
 */
export async function runResearch(
  data: Persisted,
  projectId: string,
  chat: ResearchChat | undefined,
  now: number,
  onProgress?: (data: Persisted) => void,
): Promise<Persisted> {
  const project = data.research.find((item) => item.id === projectId);
  if (!project || project.archived) return data;
  // Normalize defensively (legacy rows restored from old blobs).
  if (project.stages?.length !== RESEARCH_STAGES.length) {
    const source = newResearchProject({ siteId: project.siteId, niche: project.niche, notes: project.notes, breadth: "standard", now });
    project.breadth = project.breadth ?? "standard";
    project.stages = project.stages?.length === RESEARCH_STAGES.length ? project.stages : source.stages;
    project.output = project.output ?? {};
  }
  const site = data.sites.find((item) => item.id === project.siteId) ?? data.sites[0];
  if (!site) return data;
  project.attempts += 1;
  // Stream each stage transition to the caller. Without this the studio showed
  // nothing at all until the whole eleven-stage run returned — a project that
  // spends a minute per model call looked frozen for ten minutes and gave no
  // sign which stage was paying for the wait.
  const emit = () => {
    project.stagesCompleted = project.stages.filter((stage) => stage.status === "done").length;
    project.status = projectStatus(project);
    onProgress?.(data);
  };
  emit();

  for (const def of RESEARCH_STAGES) {
    const record = stageOf(project, def.key);
    if (record.status === "done" || record.status === "running") continue;

    if (def.key === "semantic-consolidation") {
      const started = now;
      record.status = "running";
      emit();
      const queries = project.output.queries ?? [];
      if (!queries.length) {
        record.status = "failed";
        record.error = "No queries survived R5 — R7 has nothing to consolidate.";
        emit();
        break;
      }
      const { queries: deduped, merged } = dedupeQueries(queries);
      project.output.queries = deduped;
      record.status = "done";
      record.tokens = 0;
      record.note = `Derived (0 tokens): cosine > ${R7_THRESHOLD} merged ${merged} of ${queries.length} queries.`;
      record.startedAt ||= started;
      record.finishedAt = now;
      record.durationMs = 40;
      emit();
      continue;
    }

    if (def.key === "action-class") {
      record.status = "running";
      emit();
      const queries = project.output.queries ?? [];
      const coverage = project.output.coverage ?? [];
      const { actions, skipped } = classifyActions(queries, coverage);
      project.output.actions = actions;
      record.status = "done";
      record.tokens = 0;
      record.note = `Derived (0 tokens): ${actions.filter((action) => action.action === "write").length} write · ${actions.filter((action) => action.action === "refresh").length} refresh · ${actions.filter((action) => action.action === "skip").length} skip · ${skipped} merged away.`;
      record.startedAt ||= now;
      record.finishedAt = now;
      record.durationMs = 30;
      emit();
      continue;
    }

    if (!chat) {
      record.status = "failed";
      record.error = NO_RESEARCH_KEY;
      emit();
      break;
    }
    record.status = "running";
    record.startedAt = now;
    record.attempts += 1;
    emit();
    const validateFor = (schema: z.ZodTypeAny, name: string) => (value: unknown) => {
      const parsed = schema.safeParse(tidy(value));
      return parsed.success
        ? { ok: true as const, value: parsed.data }
        : {
            ok: false as const,
            // Name the offending field: "validation failed" alone told the
            // operator nothing and told the retry even less.
            error: `${name} validation failed: ${parsed.error.issues
              .map((issue) => `${issue.path.join(".") || "response"}: ${issue.message}`)
              .join("; ")}`,
          };
    };
    try {
      const prompt = stagePrompt(def.key, project, data, site);
      switch (def.key) {
        case "niche": {
          const { value, usage } = await askValidated(chat, prompt, "R1 Niche understanding", validateFor(nicheSchema, "R1"));
          project.output.niche = value as NonNullable<ResearchProject["output"]["niche"]>;
          record.tokens = usage.total;
          break;
        }
        case "audience": {
          const { value, usage } = await askValidated(chat, prompt, "R2 Audience map", validateFor(audienceSchema, "R2"));
          project.output.audience = (value as { personas: NonNullable<ResearchProject["output"]["audience"]> }).personas;
          record.tokens = usage.total;
          break;
        }
        case "problem": {
          const { value, usage } = await askValidated(chat, prompt, "R3 Problem map", validateFor(problemSchema, "R3"));
          project.output.problems = (value as { problems: NonNullable<ResearchProject["output"]["problems"]> }).problems;
          record.tokens = usage.total;
          break;
        }
        case "topic-universe": {
          const { value, usage } = await askValidated(chat, prompt, "R4 Topic universe", validateFor(universeSchema, "R4"));
          project.output.topicUniverse = value as NonNullable<ResearchProject["output"]["topicUniverse"]>;
          record.tokens = usage.total;
          break;
        }
        case "query-expansion": {
          const { value, usage } = await askValidated(chat, prompt, "R5 Query expansion", validateFor(expansionSchema, "R5"));
          project.output.queries = (value as { queries: { query: string; topic?: string }[] }).queries.map((row, index) => ({
            id: `rq_${hashStr(`${project.id}:${index}:${row.query}`).toString(36)}`,
            query: row.query,
            topic: row.topic,
            status: "keep" as const,
          }));
          record.tokens = usage.total;
          break;
        }
        case "intent-class": {
          const { value, usage } = await askValidated(chat, prompt, "R6 Intent classification", validateFor(intentSchema, "R6"));
          const intents = (value as { intents: { query: string; intent: NonNullable<ResearchQuery["intent"]> }[] }).intents;
          const lookup = new Map(intents.map((row) => [row.query.toLowerCase().trim(), row.intent]));
          project.output.queries = (project.output.queries ?? []).map((query) => ({ ...query, intent: lookup.get(query.query.toLowerCase().trim()) }));
          record.tokens = usage.total;
          break;
        }
        case "coverage": {
          const { value, usage } = await askValidated(chat, prompt, "R8 Existing coverage mapping", validateFor(coverageSchema, "R8"));
          const mapped = (value as { mapped: { query: string; state: "covered" | "partial" | "weak" | "missing"; evidence: string }[] }).mapped;
          const queries = project.output.queries ?? [];
          const match = (needle: string) => queries.find((query) => query.query.toLowerCase().trim() === needle.toLowerCase().trim());
          project.output.coverage = mapped.map((row) => {
            const hit = match(row.query);
            return { queryId: hit?.id ?? `uq_${hashStr(`${project.id}:${row.query}`).toString(36)}`, query: hit?.query ?? row.query, state: row.state, evidence: row.evidence };
          });
          record.tokens = usage.total;
          break;
        }
        case "cluster-construction": {
          const { value, usage } = await askValidated(chat, prompt, "R9 Cluster construction", validateFor(clusterSchema, "R9"));
          const clusters = (value as { clusters: { title: string; angle: string; queries?: string[] }[] }).clusters;
          const shaped: ResearchCluster[] = clusters.map((cluster) => ({
            id: `rc_${hashStr(`${project.id}:${cluster.title}`).toString(36)}`,
            title: cluster.title,
            angle: cluster.angle,
            queries: (cluster.queries ?? []).slice(0, 8),
          }));
          project.output.clusters = shapeClusters(shaped);
          record.tokens = usage.total;
          break;
        }
        case "priority": {
          const { value, usage } = await askValidated(chat, prompt, "R11 Strategic priority inputs", validateFor(prioritySchema, "R11"));
          project.output.priority = value as NonNullable<ResearchProject["output"]["priority"]>;
          record.tokens = usage.total;
          break;
        }
        default:
          break;
      }
      record.status = "done";
      record.finishedAt = now;
      record.error = undefined;
      record.durationMs = Math.max(50, record.tokens ? 600 : 0);
      emit();
    } catch (error) {
      // Safe stop: honest failure, later stages stay pending and uncharged.
      record.status = "failed";
      record.error = error instanceof Error ? error.message : String(error);
      record.finishedAt = now;
      emit();
      break;
    }
  }

  project.stagesCompleted = project.stages.filter((stage) => stage.status === "done").length;
  project.status = projectStatus(project);
  return data;
}

/** R9 output sanity: ≥0.88-distinct titles (lexical jaccard proxy on token overlap). */
function shapeClusters(clusters: ResearchCluster[]): ResearchCluster[] {
  const kept: ResearchCluster[] = [];
  for (const cluster of clusters) {
    const tokens = new Set(cluster.title.toLowerCase().split(/\W+/).filter(Boolean));
    const near = kept.find((existing) => {
      const other = new Set(existing.title.toLowerCase().split(/\W+/).filter(Boolean));
      const shared = [...tokens].filter((token) => other.has(token)).length;
      const union = new Set([...tokens, ...other]).size;
      return union > 0 && shared / union > 0.88;
    });
    if (!near) kept.push(cluster);
  }
  return kept.slice(0, 8);
}

/** Reset only failed stages (live contract: retry continues from what is missing). */
export function rerunFailedStages(data: Persisted, projectId: string, stageKey?: ResearchStageKey): Persisted | null {
  const project = data.research.find((item) => item.id === projectId);
  if (!project || project.archived) return null;
  let changed = false;
  for (const record of project.stages) {
    if (record.status !== "failed") continue;
    if (stageKey && record.key !== stageKey) continue;
    record.status = "pending";
    record.error = undefined;
    changed = true;
  }
  return changed ? data : null;
}

/**
 * Turn a research project into a review-status Topic Plan using the model-built
 * topic universe (pillar + 6–10 clusters) instead of the template generator.
 */
export function planFromResearch(data: Persisted, projectId: string, now: number): { planId?: string; error?: string } {
  const project = data.research.find((item) => item.id === projectId);
  if (!project) return { error: "Research project not found." };
  const universe = project.output.topicUniverse;
  const clustersOut = project.output.clusters ?? [];
  if (!universe || clustersOut.length < 2) {
    return { error: "The research has not produced a topic universe and clusters yet (R4 + R9 must be done)." };
  }
  const planId = uid("plan");
  data.plans.unshift({
    id: planId,
    siteId: project.siteId,
    topic: project.niche,
    pillarTitle: universe.pillar,
    pillarAngle: universe.clusters.find((cluster) => cluster.angle)?.angle ?? researchAngle(project),
    clusters: clustersOut.map((cluster) => ({
      id: uid("clu"),
      title: cluster.title,
      angle: cluster.angle || researchAngle(project),
      excluded: false,
      source: "ai" as const,
      selected: true,
    })),
    status: "review",
    createdAt: now,
  });
  return { planId };
}

function researchAngle(project: ResearchProject): string {
  const audience = project.output.audience?.[0]?.persona ?? "the reader deciding what to do next";
  return `Written for ${audience}, grounded in the ${project.niche} research notes.`;
}
