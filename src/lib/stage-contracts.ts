import { z } from "zod";
import type { AuthorProfile, IntentBlueprint, StageKey } from "./types.ts";
import { authorVoiceBlock } from "./authors.ts";
import { BLADER_DRAFT_RULES, BLADER_REWRITE_CONTRACT } from "./humanizer.ts";

/**
 * Rule 3 prompt contracts (MASTER_SPEC §2).
 * Tiers: stage 1 fast (~0.4) · stage 2 balanced (~0.7) · stage 3 balanced (~0.3) · stage 4/5 fast · stage 6 no LLM.
 */
export const STAGE_PROMPT_VERSIONS: Record<StageKey, string> = {
  intent: "intent@2-bing",
  draft: "draft@4-blader-anti-ai",
  revision: "revision@4-blader-humanize",
  metadata: "metadata@2-llm",
  enrichment: "enrichment@2-llm",
  publish: "publish@1",
};

export const stageSchemas = {
  intent: z.object({ intent: z.string().min(1), mustCover: z.array(z.string()) }),
  draft: z.object({ markdown: z.string().min(80) }),
  revision: z.object({ markdown: z.string().min(80), verifyFlags: z.array(z.object({ claim: z.string().min(1), why: z.string().min(1) })).default([]) }),
  metadata: z.object({ title: z.string().min(1), metaDescription: z.string().min(1), slug: z.string().min(1), excerpt: z.string().min(1), tags: z.array(z.string()) }),
  enrichment: z.object({ links: z.array(z.object({ anchor: z.string(), slug: z.string() })) }),
  publish: z.object({ valid: z.boolean() }),
} as const;

export type ModelStageKey = "draft" | "revision";
type RevisionOutput = { markdown: string; verifyFlags: { claim: string; why: string }[] };

export function parseModelStage(stage: ModelStageKey, text: unknown): { markdown: string; verifyFlags?: string[] } {
  let value: unknown;
  try {
    value = JSON.parse(String(text ?? "").replace(/^```json\s*|```$/g, "").trim());
  } catch {
    throw new Error(`${stage} schema validation failed: response is not valid JSON`);
  }
  const parsed = stageSchemas[stage].safeParse(value);
  if (!parsed.success) throw new Error(`${stage} schema validation failed: ${parsed.error.issues.map((issue) => issue.message).join("; ")}`);
  const revision = parsed.data as RevisionOutput;
  return { markdown: revision.markdown, verifyFlags: stage === "revision" ? revision.verifyFlags.map((flag) => `“${flag.claim}” — ${flag.why}`) : undefined };
}

// ---------------------------------------------------------------------------
// Rule 3a — Stage 1 (Intent & Blueprint): answer block, question H2s, table plan
// ---------------------------------------------------------------------------

export const IntentBlueprintSchema = z.object({
  intent: z.string().min(1).max(400),
  audience: z.string().min(1).max(200).default("the reader making this decision"),
  answerBlock: z.string().min(40).max(700),
  questionH2s: z.array(z.string().min(8).max(120)).min(2).max(6),
  tablePlan: z.boolean().default(false),
  mustCover: z.array(z.string().min(2).max(120)).min(3).max(8),
});

export function parseIntentStage(text: unknown): IntentBlueprint {
  let value: unknown;
  try {
    value = JSON.parse(String(text ?? "").replace(/^```json\s*|```$/g, "").trim());
  } catch {
    throw new Error("intent schema validation failed: response is not valid JSON");
  }
  const parsed = IntentBlueprintSchema.safeParse(value);
  if (!parsed.success) throw new Error(`intent schema validation failed: ${parsed.error.issues.map((issue) => issue.message).join("; ")}`);
  return parsed.data;
}

/** Deterministic stage-1 output when no model ran (estimation/fallback mode). */
export function fallbackBlueprint(job: { keyword: string; title: string }): IntentBlueprint {
  const keyword = String(job?.keyword ?? "").trim();
  const title = String(job?.title ?? "").trim();
  const subject = (keyword || title || "this topic").replace(/\s+/g, " ");
  return {
    intent: `Answer “${subject}” for a reader who needs one concrete decision, not a survey.`,
    audience: "the reader deciding what to do next",
    answerBlock: `${title || subject} comes down to one decision about ${subject}: pick the option that fits the constraints you already have, confirm it against a source you trust, and skip anything promising effortless results.`,
    questionH2s: [`What is ${subject}, exactly?`, `How do you start with ${subject}?`, `What does ${subject} cost in time or money?`],
    tablePlan: true,
    mustCover: [
      `What ${subject} actually is`,
      `Who ${subject} fits — and who should skip it`,
      `A worked first step for ${subject}`,
      `What ${subject} costs`,
      `The failure mode most people hit with ${subject}`,
    ],
  };
}

export type StageContext = {
  siteName: string;
  niche: string;
  audience?: string;
  author?: AuthorProfile;
  bannedPhrases: string[];
  brandFacts: string[];
  tone: string;
  pov: "first-person" | "second-person" | "third-person";
  readingLevel: "grade-7" | "general" | "expert";
  workingTitle: string;
  keyword: string;
  sectionCount: number;
  avoidTitles: string[];
  blueprint?: IntentBlueprint;
};

/** Site + author context block present in every stage (MASTER_SPEC §2). */
export function buildContextBlock(ctx: StageContext): string {
  return [
    ctx.author ? authorVoiceBlock(ctx.author) : "Author: unassigned desk writer (human expert persona pending).",
    `Site: ${ctx.siteName} · niche: ${ctx.niche}.`,
    `Point of view: ${ctx.author?.voice.pov ?? ctx.pov}. Reading level: ${ctx.author?.voice.readingLevel ?? ctx.readingLevel}. Tone: ${ctx.tone}.`,
    `Banned phrases: ${[...new Set([...(ctx.author?.voice.bannedPhrases ?? []), ...ctx.bannedPhrases])].join(" | ") || "none"}.`,
    `Brand facts: ${ctx.brandFacts.join(" | ") || "none"}.`,
  ].join("\n");
}

/**
 * Long-form floor the pipeline targets on every generated article. The draft
 * prompt aims for {@link TARGET_ARTICLE_WORDS} so the finished piece clears the
 * {@link MIN_ARTICLE_WORDS} floor after revision and humanizer passes.
 */
export const MIN_ARTICLE_WORDS = 2000;
export const TARGET_ARTICLE_WORDS = 2400;

const BingDraftRules = [
  "Open with the 40–60 word direct answer to the exact query — no preamble, no 'in this article'.",
  "Use ## H2s from the blueprint when they fit; name each heading after the decision it settles. At least two H2s must be question-shaped when the blueprint lists question headings.",
  "Include exactly one concrete markdown table when the blueprint marks tablePlan true (real values or clearly labeled placeholders — never invented statistics; write [verify: …] beside any number you cannot state from the notes).",
  "Keep one H1 (the working title), nested H2/H3, and a question-shaped FAQ section of 3–5 Q&As anchored with ### headings.",
  "No invented stats, no [verify] tags inside the table cells other than the labeled placeholders, no image markdown.",
] as const;

export function buildIntentPrompt(ctx: StageContext, retry?: { reason: string }): { system: string; user: string } {
  const system = [
    "You are the intent and blueprint stage of a US editorial pipeline returning valid JSON only — no markdown fences.",
    `Return JSON matching {"intent":string,"audience":string,"answerBlock":string,"questionH2s":string[],"tablePlan":boolean,"mustCover":string[]}. Prompt version ${STAGE_PROMPT_VERSIONS.intent}.`,
    buildContextBlock(ctx),
    "The answerBlock is the direct 40–60 word answer a reader (and an AI answer engine) can quote alone.",
    "Write 5–8 mustCover items: concrete sub-decisions the article must settle.",
    `Plan a long-form piece of at least ${MIN_ARTICLE_WORDS} words. Write 2–6 questionH2s phrased as real user questions for Bing/Copilot extraction (How/What/Is/Does…).`,
    "Set tablePlan true only when a comparison or range of real numbers genuinely helps.",
    `Titles must stay lexically distinct from each other and from the working title «${ctx.workingTitle}».`,
    retry ? `The previous attempt failed validation: ${retry.reason} Fix it now.` : "",
  ]
    .filter(Boolean)
    .join(" ");
  const user = [
    `Working title: ${ctx.workingTitle}`,
    `Keyword: ${ctx.keyword}`,
    `Niche: ${ctx.niche}`,
    ctx.audience ? `Audience: ${ctx.audience}` : "",
    `Sections: ${ctx.sectionCount}`,
    ctx.avoidTitles.length ? `Avoid repeating these existing pages: ${ctx.avoidTitles.slice(0, 12).join("; ")}` : "",
  ]
    .filter(Boolean)
    .join("\n");
  return { system, user };
}

export function buildDraftPrompt(ctx: StageContext, intent: IntentBlueprint, more = false): { system: string; user: string } {
  const system = [
    "You write a US staff article as the assigned author below, in their exact humanized voice. Return valid JSON only matching {\"markdown\":\"full article markdown\"}.",
    `Prompt version ${STAGE_PROMPT_VERSIONS.draft}.`,
    buildContextBlock(ctx),
    ...BingDraftRules,
    "Blader humanizer anti-pattern constitution — the draft must read like the assigned human author, never like a chatbot:",
    ...BLADER_DRAFT_RULES,
    `Write ${ctx.sectionCount} ## sections totalling at least ${MIN_ARTICLE_WORDS} words (aim ${TARGET_ARTICLE_WORDS}); give each section 3–5 developed paragraphs of concrete steps, examples, and named specifics.`,
    `Adopt the author's rhythm, diction, sentence band (${ctx.author?.voice.sentenceLengthBand ?? "8–18 words"}), and signature moves. Never use the author's or the site's banned phrases.`,
    more ? `The previous response was under the length floor. Return the full article expanded to at least ${MIN_ARTICLE_WORDS} words (aim ${TARGET_ARTICLE_WORDS}), keeping every heading, the comparison table, and every internal link. Return valid JSON only.` : "",
  ]
    .filter(Boolean)
    .join(" ");
  const user = [
    `Title: ${ctx.workingTitle}`,
    `Keyword: ${ctx.keyword}`,
    "",
    `Blueprint intent: ${intent.intent}`,
    `Direct opening answer to place in the first two sentences: ${intent.answerBlock}`,
    `Question headings to consider: ${intent.questionH2s.join(" | ")}`,
    `Must cover: ${intent.mustCover.join("; ")}`,
    `Length: at least ${MIN_ARTICLE_WORDS} words (aim ${TARGET_ARTICLE_WORDS}). Long enough to settle every must-cover point with concrete detail — never pad with filler.`,
    `Table: ${intent.tablePlan ? "include exactly one markdown table" : "no table required this time — only add one if genuinely comparative"}`,
    "",
    ctx.avoidTitles.length ? `Do not repeat these pages: ${ctx.avoidTitles.slice(0, 12).join("; ")}` : "No existing pages to avoid.",
  ].join("\n");
  return { system, user };
}

export function buildRevisionPrompt(ctx: StageContext, draft: string): { system: string; user: string } {
  const system = [
    "You are Stage 3 (Revision) running the blader/humanizer two-pass audit and rewrite in the assigned author's voice. Return valid JSON only matching {\"markdown\":\"...\",\"verifyFlags\":[{\"claim\":\"...\",\"why\":\"...\"}]}.",
    `Prompt version ${STAGE_PROMPT_VERSIONS.revision}.`,
    buildContextBlock(ctx),
    ...BLADER_REWRITE_CONTRACT,
    "Two passes in one response: PASS 1 mentally audit the draft for the AI tells listed in the anti-pattern contract (staging contrasts, one-line closers, deep sayings, staged run-ups, forced triads, em-dash chaining, delve/tapestry/pivotal-class vocabulary, inflated significance, sales language, decorative bold, curly quotes, chatbot residue); PASS 2 rewrite the whole draft into natural, grounded human prose with every tell removed.",
    "Robotic scrub order: (1) delete or rewrite every banned phrase listed below; (2) collapse sentences that repeat the same advice — each paragraph adds one new idea; (3) enforce the author's rhythm and sentence band; (4) keep a direct-answer opening, all question-shaped H2s, every markdown table and every internal link exactly as they are.",
    `Never shorten the article: the rewritten piece must still be at least ${MIN_ARTICLE_WORDS} words (aim ${TARGET_ARTICLE_WORDS}). Rewrite for voice, do not trim content.`,
    "Every mustCover item must be addressed or cut honestly. VerifyFlags must quote every statistic, date, price, named source, or research claim with why it needs human verification.",
    `Banned phrases (author + site): ${[...new Set([...(ctx.author?.voice.bannedPhrases ?? []), ...ctx.bannedPhrases, ...ROBOTIC_DEFAULTS])].join(" | ")}.`,
  ].join(" ");
  const user = [`Title: ${ctx.workingTitle}`, `Keyword: ${ctx.keyword}`, `Must cover: ${ctx.blueprint?.mustCover.join("; ") ?? "not recorded"}`, "", "Draft to rewrite (Stage 2 draft):", draft].join("\n");
  return { system, user };
}

// ---------------------------------------------------------------------------
// Stage 4 — Metadata & Packaging (GOVERNOR §4: fast LLM · title ≤60 ·
// metaDescription ≤155 · slug · tags ≤3 · excerpt)
// ---------------------------------------------------------------------------

export const MetadataSchema = z.object({
  title: z.string().min(1).max(60),
  metaDescription: z.string().min(1).max(155),
  slug: z.string().min(1).max(120),
  tags: z.array(z.string().min(1).max(40)).max(3).default([]),
  excerpt: z.string().min(1).max(280),
});
export type MetadataOutput = z.infer<typeof MetadataSchema>;

export function parseMetadataStage(text: unknown): MetadataOutput {
  let value: unknown;
  try {
    value = JSON.parse(String(text ?? "").replace(/^```json\s*|```$/g, "").trim());
  } catch {
    throw new Error("metadata schema validation failed: response is not valid JSON");
  }
  const parsed = MetadataSchema.safeParse(value);
  if (!parsed.success) throw new Error(`metadata schema validation failed: ${parsed.error.issues.map((issue) => issue.message).join("; ")}`);
  return parsed.data;
}

export function buildMetadataPrompt(ctx: StageContext, markdown: string, opts: { existingSlugs: string[]; existingTags: string[] }): { system: string; user: string } {
  const system = [
    "You are Stage 4 (Metadata & Packaging) of a US editorial pipeline. Return valid JSON only — no markdown fences.",
    `Return JSON matching {"title":string,"metaDescription":string,"slug":string,"tags":string[],"excerpt":string}. Prompt version ${STAGE_PROMPT_VERSIONS.metadata}.`,
    buildContextBlock(ctx),
    "title: the packaged headline, at most 60 characters, choosing the phrasing a searcher would type. It may refine the working title but must stay on the same subject.",
    "metaDescription: at most 155 characters, a plain, concrete summary with no clickbait and no promises.",
    "slug: lowercase a–z, 0–9 and hyphens only, 3–8 words, derived from the title; it must not collide with the existing slugs listed in the brief.",
    "tags: at most 3 short tags; reuse an existing tag from the brief when one fits, otherwise name the topic plainly.",
    "excerpt: one or two sentences (≤280 characters) for listings, drawn from the article, not a sales line.",
  ].join(" ");
  const user = [
    `Working title: ${ctx.workingTitle}`,
    `Keyword: ${ctx.keyword}`,
    `Niche: ${ctx.niche}`,
    opts.existingSlugs.length ? `Existing slugs that must not be reused: ${opts.existingSlugs.slice(0, 40).join(", ")}` : "No existing slugs on this site.",
    opts.existingTags.length ? `Existing tags to prefer: ${opts.existingTags.slice(0, 40).join(", ")}` : "No existing tags on this site.",
    "",
    "Final article markdown:",
    markdown.slice(0, 12000),
  ].join("\n");
  return { system, user };
}

// ---------------------------------------------------------------------------
// Stage 5 — Site Enrichment (GOVERNOR §4: fast + vision · internal links from
// published inventory only · image queries + placement)
// ---------------------------------------------------------------------------

export const EnrichmentSchema = z.object({
  links: z
    .array(z.object({ anchor: z.string().min(1).max(80), slug: z.string().min(1).max(120) }))
    .max(6)
    .default([]),
  imageQueries: z
    .array(z.object({ query: z.string().min(2).max(80), alt: z.string().min(2).max(120), role: z.enum(["featured", "section"]) }))
    .max(4)
    .default([]),
});
export type EnrichmentOutput = z.infer<typeof EnrichmentSchema>;

export function parseEnrichmentStage(text: unknown): EnrichmentOutput {
  let value: unknown;
  try {
    value = JSON.parse(String(text ?? "").replace(/^```json\s*|```$/g, "").trim());
  } catch {
    throw new Error("enrichment schema validation failed: response is not valid JSON");
  }
  const parsed = EnrichmentSchema.safeParse(value);
  if (!parsed.success) throw new Error(`enrichment schema validation failed: ${parsed.error.issues.map((issue) => issue.message).join("; ")}`);
  return parsed.data;
}

export function buildEnrichmentPrompt(ctx: StageContext, markdown: string, inventory: { title: string; slug: string }[]): { system: string; user: string } {
  const system = [
    "You are Stage 5 (Site Enrichment) of a US editorial pipeline. Return valid JSON only — no markdown fences.",
    `Return JSON matching {"links":[{"anchor":string,"slug":string}],"imageQueries":[{"query":string,"alt":string,"role":"featured"|"section"}]}. Prompt version ${STAGE_PROMPT_VERSIONS.enrichment}.`,
    buildContextBlock(ctx),
    "links: 2–6 internal links. The slug MUST come from the published-pages list in the brief — never invent a slug. The anchor is the exact phrase already present in the article that the link should wrap (the server inserts the anchor itself).",
    "imageQueries: one featured query plus one per major section, at most 4 total. Each query is a short photo-search phrase and its alt text is a plain description of the image the reader should see.",
  ].join(" ");
  const user = [
    `Working title: ${ctx.workingTitle}`,
    `Keyword: ${ctx.keyword}`,
    `Published pages to link to (title — slug): ${
      inventory.length ? inventory.slice(0, 60).map((page) => `${page.title} — ${page.slug}`).join("; ") : "none yet"
    }`,
    "",
    "Final article markdown:",
    markdown.slice(0, 12000),
  ].join("\n");
  return { system, user };
}

/** Hard-coded robotic defaults every author refuses, on top of author + site lists. */
export const ROBOTIC_DEFAULTS = [
  "in today's fast-paced world",
  "delve",
  "tapestry",
  "look no further",
  "it is important to note",
  "in conclusion",
  "game-changer",
  "seamless",
  "unlock",
];

/**
 * Rule 3d deterministic scrub: removes banned/robotic phrases, collapses repeated
 * sentences. Applied to model output at revision acceptance (single pass; keeps
 * the honest count so the UI can show what the scrub touched).
 */
export function roboticScrub(markdown: unknown, bannedPhrases: Array<string | null | undefined> = []): { markdown: string; scrubbed: string[] } {
  const phrases = [...new Set([...bannedPhrases.map((p) => String(p ?? "").trim()).filter(Boolean), ...ROBOTIC_DEFAULTS])];
  const scrubbed: string[] = [];
  let text = typeof markdown === "string" ? markdown : "";
  for (const phrase of phrases) {
    const pattern = new RegExp(phrase.replace(/[.*+?^${}()|[\]\\]/g, "\\$&").replace(/\s+/g, "\\s+"), "gi");
    if (!pattern.test(text)) continue;
    scrubbed.push(phrase);
    text = text.replace(pattern, "");
  }
  // Kill double spaces / orphan sentence punctuation left over from removals.
  text = text.replace(/[ \t]{2,}/g, " ").replace(/ ([,.;:!?])/g, "$1").replace(/\n{3,}/g, "\n\n");
  // Repetition collapse: identical (or near-identical) sentences within the same section.
  const seen = new Set<string>();
  const lines = text.split("\n").map((line) => {
    const trimmed = line.trim();
    if (trimmed.length < 40 || trimmed.startsWith("#") || trimmed.startsWith("-") || trimmed.startsWith("|")) return line;
    const key = trimmed.toLowerCase().replace(/[^a-z0-9 ]/g, "").replace(/\s+/g, " ");
    if (seen.has(key)) {
      scrubbed.push(`repeated sentence: ${trimmed.slice(0, 60)}…`);
      return "";
    }
    seen.add(key);
    return line;
  });
  text = lines.filter((line, index, all) => !(line === "" && all[index - 1] === "")).join("\n").trim();
  return { markdown: text, scrubbed };
}

/** Rule 3 meta check (used by tests/analytics): does the draft still carry robotic phrasing? */
export function bannedPhraseScan(markdown: string, bannedPhrases: string[] = []): string[] {
  const lower = markdown.toLowerCase();
  return [...new Set([...bannedPhrases, ...ROBOTIC_DEFAULTS])].filter((phrase) => lower.includes(phrase.toLowerCase()));
}
