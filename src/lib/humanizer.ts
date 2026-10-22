/**
 * blader/humanizer — native rule-driven humanization engine.
 *
 * Implements the open-source `blader/humanizer` skill (v3.1.0, MIT; spec snapshot
 * in `knowledge-base/blader-humanizer/SKILL.md`) as a first-class pipeline module:
 *  - `BLADER_RULES`       — the 26 anti-patterns, strongest first (Wikipedia "Signs of AI writing").
 *  - `scanAiPatterns`     — deterministic detector over markdown (code blocks, inline code and
 *                           link targets are protected; table rows are scanned but never rewritten).
 *  - `humanizerScore`     — 0–100 purity score with the exact remaining hits.
 *  - `deterministicScrub` — safe offline rewrite: dashes, curly quotes, chatbot residue,
 *                           filler conclusions/closers, banned vocabulary, not-X-it's-Y contrasts.
 *  - `humanizeWithBlader` — the full two-pass surgical rewrite (pass 1: identify remaining
 *                           AI-isms; pass 2: rewrite into natural prose) through the studio's
 *                           multi-key pool, with the assigned US author's voice; falls back to
 *                           the deterministic pass when no model key is usable, and refuses an
 *                           LLM result that breaks Bing SEO structure (headings/tables/links).
 */
/**
 * Injected LLM transport (built on the studio's multi-key pool by the caller).
 * Kept as a parameter so this module stays dependency-light and unit-testable
 * without server functions.
 */
export type BladerChat = (
  system: string,
  user: string,
) => Promise<
  | { ok: true; text: string; keyId: string; usage?: { prompt: number; completion: number; total: number } }
  | { ok: false; error: string }
>;

export const BLADER_SOURCE = "blader/humanizer v3.1.0 · Wikipedia 'Signs of AI writing'";
export const BLADER_VERSION = "blader@1";

export type BladerRule = {
  id: number;
  name: string;
  group: string;
  /** Phrases that count as this tell wherever they appear. */
  watch: string[];
  /** Extra structural detector for patterns that are not plain phrase matches. */
  regex?: RegExp;
  /** Score penalty per sighting. Structural tells cost more. */
  weight: number;
};

/** The 26 patterns, numbered like the skill (§1 strongest first). */
export const BLADER_RULES: BladerRule[] = [
  { id: 1, name: "Not X but Y contrast", group: "staging", weight: 6, watch: ["not just", "not only", "not merely", "isn't just", "is not a tool but"], regex: /\b(?:it'?s|it is|this is|that's|they'?re|they are|isn'?t)\s+not\s+(?:just|only|merely)\b[^.!?\n]*[,;:]\s*(?:it|this|that)\s*(?:'s|\s+is\b)\b/i },
  { id: 2, name: "One-line closer / dramatic fragment", group: "staging", weight: 5, watch: ["that is the real win", "that's the real win", "that distinction matters", "read that again", "let that sink in", "the message was clear", "it was a lesson in", "this shows the importance of"] },
  { id: 3, name: "Saying that sounds deep", group: "staging", weight: 5, watch: ["the real question is", "at its core", "what really matters", "the deeper issue", "the heart of the matter", "becomes a trap"] },
  { id: 4, name: "Staged run-up", group: "staging", weight: 5, watch: ["let's dive in", "let's dive into", "let's explore", "let's break this down", "here's what you need to know", "now let's look at", "without further ado", "here's the thing", "let's be honest", "real talk"] },
  { id: 5, name: "Arguing with no one", group: "staging", weight: 5, watch: ["this isn't about", "i'm not saying", "don't get me wrong", "this is not to say", "some might say", "a tempting approach", "one might be tempted", "an obvious approach would be", "you might think", "it would be easy to just"] },
  { id: 6, name: "Forced triad", group: "rhythm", weight: 3, watch: [] },
  { id: 7, name: "Repeated sentence openings", group: "rhythm", weight: 2, watch: [] },
  { id: 8, name: "Dash as universal connector", group: "rhythm", weight: 3, watch: [] },
  { id: 9, name: "Stacked qualifiers", group: "rhythm", weight: 2, watch: ["to be fair,", "could potentially", "might arguably", "in some cases it may", "it's also possible"] },
  { id: 10, name: "Hyphenated pair after the noun", group: "rhythm", weight: 1, watch: [], regex: /\b(?:report|process|plan|result|output|system|data)\s+is\s+(?:high-quality|well-known|well-documented|long-term|real-time|client-facing)\b/i },
  { id: 11, name: "Passive voice / missing subject", group: "rhythm", weight: 1, watch: [] },
  { id: 12, name: "Overused AI word", group: "inflation", weight: 3, watch: ["delve", "tapestry", "pivotal", "crucial", "meticulous", "meticulously", "showcase", "showcases", "underscores", "underscore", "garner", "intricate", "intricacies", "interplay", "bolstered", "enduring", "testament", "robust", "seamless", "seamlessly", "vibrant", "utilize", "utilization", "facilitate", "additionally", "in conclusion"] },
  { id: 13, name: "Inflated significance", group: "inflation", weight: 5, watch: ["stands as a testament", "a pivotal moment", "plays a key role", "plays a crucial role", "underscores its importance", "reflects a broader", "lasting legacy", "enduring legacy", "setting the stage for", "evolving landscape", "indelible mark", "continues to thrive", "challenges and legacy", "future outlook", "the future looks bright", "exciting times", "a step in the right direction", "shaping the future"] },
  { id: 14, name: "Vague association", group: "inflation", weight: 3, watch: ["associated with", "in association with", "in connection with", "tied to"] },
  { id: 15, name: "Shallow -ing rider", group: "inflation", weight: 4, watch: ["highlighting", "underscoring", "emphasizing", "ensuring", "reflecting", "symbolizing", "cultivating", "fostering", "encompassing", "showcasing"] },
  { id: 16, name: "Sales language", group: "inflation", weight: 4, watch: ["nestled", "in the heart of", "must-visit", "breathtaking", "stunning", "renowned", "groundbreaking", "rich cultural heritage", "natural beauty", "diverse array", "commitment to", "exemplifies", "profound"] },
  { id: 17, name: "Borrowed authority", group: "inflation", weight: 4, watch: ["experts argue", "observers have cited", "industry reports", "some critics", "several publications", "active social media presence"] },
  { id: 18, name: "Avoiding is/are/has", group: "inflation", weight: 2, watch: ["serves as", "stands as", "functions as", "operates as", "boasts"] },
  { id: 19, name: "Bold as decoration", group: "formatting", weight: 3, watch: [] },
  { id: 20, name: "Decorative heading / emoji label", group: "formatting", weight: 3, watch: ["🚀", "💡", "✨", "→"] },
  { id: 21, name: "Curly quotation marks", group: "formatting", weight: 1, watch: [] },
  { id: 22, name: "Chatbot residue", group: "leftovers", weight: 6, watch: ["i hope this helps", "of course!", "certainly!", "great question!", "you're absolutely right", "would you like", "want me to", "should i continue", "let me know if"] },
  { id: 23, name: "Knowledge-limit disclaimer", group: "leftovers", weight: 5, watch: ["as of my", "up to my last", "while specific details are limited", "based on available information", "not publicly available", "not widely documented", "maintains a low profile", "keeps personal details private", "it is believed that"] },
  { id: 24, name: "Heading repeated in first sentence", group: "leftovers", weight: 3, watch: [] },
  { id: 25, name: "Writing about the document", group: "leftovers", weight: 3, watch: ["was added to replace", "generated from", "compiled from", "the table below compares", "this section is organized"] },
  { id: 26, name: "Re-explaining to the reader", group: "wrong-reader", weight: 2, watch: [] },
];

export type AiPatternHit = { id: number; pattern: string; rule: string; excerpt: string };

/** Deterministic scan for AI tells. Word scans skip inline code and link targets. */
export function scanAiPatterns(text: unknown): AiPatternHit[] {
  // Mask inline code and link URLs so their text is never treated as prose.
  const body = String(text ?? "")
    .replace(/```[\s\S]*?```/g, " ")
    .replace(/`[^`\n]*`/g, " ")
    .replace(/\[[^\]]*\]\([^)]*\)/g, (link) => link.replace(/\([^)]*\)/, "()"));
  const hits: AiPatternHit[] = [];
  let overflow = false;
  const push = (id: number, excerpt: string) => {
    if (overflow) return;
    if (hits.length >= 400) {
      overflow = true;
      return;
    }
    const rule = BLADER_RULES.find((r) => r.id === id)!;
    hits.push({ id, pattern: rule.name, rule: rule.group, excerpt: excerpt.trim().replace(/\s+/g, " ").slice(0, 140) });
  };
  // Phrase bans — word-boundary aware, case-insensitive.
  for (const rule of BLADER_RULES) {
    for (const phrase of rule.watch) {
      const safe = phrase.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      const re = new RegExp(`(^|[^\\p{L}])${safe}(?![\\p{L}])`, "giu");
      let match: RegExpExecArray | null;
      while ((match = re.exec(body))) {
        push(rule.id, body.slice(Math.max(0, match.index - 30), match.index + match[0].length + 80));
        re.lastIndex = match.index + match[0].length;
        if (overflow) break;
      }
      if (overflow) break;
    }
    if (rule.regex && !overflow) {
      const re = new RegExp(rule.regex.source, rule.regex.flags.includes("g") ? rule.regex.flags : `${rule.regex.flags}g`);
      let match: RegExpExecArray | null;
      while ((match = re.exec(body))) {
        push(rule.id, body.slice(Math.max(0, match.index - 20), match.index + match[0].length + 40));
        if (overflow) break;
      }
    }
    if (overflow) break;
  }
  // §8 dashes used as connectors.
  if (/(?:^|[\s("[])(?:--|—|–)(?:$|[\s,.)\]]|[a-z])/im.test(body)) push(8, "em/en dash used as a connector");
  // §21 curly quotes.
  if (/[“”][^“”]*[“”]/.test(body)) push(21, "curly quotation marks");
  // §6 forced triads: "alpha, beta, and gamma" of single words in one clause.
  const triad = /\b\p{Lu}?\p{L}[\p{L}-]{1,18},\s+\p{L}[\p{L}-]{1,18},\s+(?:and|or)\s+\p{L}[\p{L}-]{1,18}\b/gu;
  let tri: RegExpExecArray | null;
  while ((tri = triad.exec(body))) {
    push(6, tri[0]);
    if (overflow) break;
  }
  // §7 three sentences in a row opening with the same word.
  const sentences = body.split(/(?<=[.!?])\s+/);
  for (let i = 0; i + 2 < sentences.length; i++) {
    const first = sentences[i]!.trim().split(/\s+/)[0]?.toLowerCase().replace(/\W/g, "");
    if (!first || first.length < 3) continue;
    if (sentences[i + 1]!.trim().toLowerCase().startsWith(first) && sentences[i + 2]!.trim().toLowerCase().startsWith(first)) {
      push(7, `${sentences[i]!.slice(0, 60)}…`);
      i += 2;
    }
    if (overflow) break;
  }
  // Same rule id + same excerpt start = one tell counted once (word watch + regex overlap).
  const deduped: AiPatternHit[] = [];
  const seen = new Set<string>();
  for (const hit of hits) {
    const key = `${hit.id}:${hit.excerpt.slice(0, 60)}`;
    if (seen.has(key)) continue;
    seen.add(key);
    deduped.push(hit);
  }
  return deduped;
}

/** 0–100 human-prose score. Every tell costs its rule weight; 100 = none found. */
export function humanizerScore(text: string): { score: number; hits: AiPatternHit[] } {
  const hits = scanAiPatterns(text);
  const penalty = hits.reduce((sum, hit) => sum + (BLADER_RULES.find((rule) => rule.id === hit.id)?.weight ?? 2), 0);
  return { score: Math.max(0, Math.min(100, 100 - penalty)), hits };
}

export type BladerFingerprint = { h1: number; h2: number; h3: number; tables: number; links: number; words: number };

/** Structure counts a rewrite must preserve for Bing SEO. */
export function structuralFingerprint(text: unknown): BladerFingerprint {
  const source = String(text ?? "");
  return {
    h1: (source.match(/^# (?!#)/gm) ?? []).length,
    h2: (source.match(/^## (?!#)/gm) ?? []).length,
    h3: (source.match(/^### (?!#)/gm) ?? []).length,
    tables: (source.match(/^\|.+\|$/gm) ?? []).length,
    links: (source.match(/\]\([^)]+\)/g) ?? []).length,
    words: source.split(/\s+/).filter(Boolean).length,
  };
}

function structureIntact(before: BladerFingerprint, after: BladerFingerprint): boolean {
  const close = (a: number, b: number, tol: number) => Math.abs(a - b) <= tol;
  return (
    close(before.h2, after.h2, 0) &&
    close(before.h3, after.h3, 1) &&
    close(before.tables, after.tables, 0) &&
    close(before.links, after.links, Math.max(1, Math.floor(before.links * 0.1))) &&
    after.words > before.words * 0.6 &&
    after.words < before.words * 1.5
  );
}

/** Safe word swaps — `match` → `replacement`, applied outside protected segments. */
const BANNED_SWAPS: [RegExp, string][] = [
  [/\bdelving into\b/gi, "examining"],
  [/\bdelves into\b/gi, "examines"],
  [/\bdelved into\b/gi, "examined"],
  [/\bdelve into\b/gi, "examine"],
  [/\bdelving\b/gi, "probing"],
  [/\bdelve\b/gi, "probe"],
  [/\btapestr(?:y|ies)\b/gi, "mix"],
  [/\bmeticulously\b/gi, "carefully"],
  [/\bmeticulous\b/gi, "careful"],
  [/\bserves as\b/gi, "is"],
  [/\bstands as\b/gi, "is"],
  [/\bfunctions as\b/gi, "works as"],
  [/\bboasts\b/gi, "has"],
  [/\bshowcas(?:es|ing|ed|e)?\b/gi, "shows"],
  [/\bunderscor(?:es|ing|ed|e)?\b/gi, "points to"],
  [/\butiliz(?:es|ed|e|ing)?\b/gi, "uses"],
  [/\butilization\b/gi, "use"],
  [/\bleverag(?:es|ed|e|ing)\b/gi, "uses"],
  [/\bfacilitat(?:es|ed|e|ing)\b/gi, "helps"],
  [/\bgarner(?:s|ed|ing)?\b/gi, "earns"],
  [/\bbolstered\b/gi, "strengthened"],
  [/\bseamless(?:ly)?\b/gi, "smooth"],
  [/\benduring\b/gi, "lasting"],
  [/\bpivotal\b/gi, "important"],
  [/\bcrucial\b/gi, "important"],
  [/\bvibrant\b/gi, "lively"],
  [/\bbreathtaking\b/gi, "striking"],
  [/\bstunning\b/gi, "striking"],
  [/\brenowned\b/gi, "well known"],
  [/\bgroundbreaking\b/gi, "new"],
  [/\bnestled\b/gi, "set"],
  [/\bdiverse array of\b/gi, "range of"],
  [/\bintricate\b/gi, "complex"],
  [/\bprofound\b/gi, "deep"],
  [/\bAdditionally,?\s*/gi, "Also "],
  [/\bin conclusion,?\s*/gi, ""],
];

const RESIDUE_LINE =
  /^\s*(?:i hope this helps|of course!|certainly!|great question!|you're absolutely right(?:[!,.]|$)|would you like[^.?!]*\?|want me to[^.?!]*\?|should i continue\??|let me know if[^.?!]*[.?!]?)\s*$/i;

const RESIDUE_SENTENCE =
  /^\s*(?:i hope this helps!?|of course!?|certainly!?|great question!?|you're absolutely right!?|would you like[^.?!]*\?|want me to[^.?!]*\?|should i continue\?|let me know (?:if|whether)[^.?!]*[.?!]?)\s*$/i;

const CLOSER_LINE =
  /^\s*(?:that is the real win\.?|that's the real win\.?|that distinction matters\.?|read that again\.?|let that sink in\.?|the future looks bright[^.?!]*\.?|exciting times (?:lie|are) ahead[^.?!]*\.?)\s*$/i;

const FILLER_HEADING = /^#{1,6}\s*(?:future outlook|challenges and legacy|challenges and future outlook|awards and recognition)\s*$/gim;

/** Protect code blocks, inline code, markdown links and table rows from edits. */
function protectSegments(text: string, keepTables: boolean): { masked: string; unprotect: (value: string) => string } {
  const keep: string[] = [];
  const table = keepTables ? "|(?:^\\|.+\\|$)" : "";
  const pattern = new RegExp("```[\\s\\S]*?```|`[^`\\n]*`|\\[[^\\]]*\\]\\([^)]*\\)" + table, "gm");
  const masked = text.replace(pattern, (segment) => {
    keep.push(segment);
    return `\u0000K${keep.length - 1}\u0000`;
  });
  // eslint-disable-next-line no-control-regex -- \u0000 is an internal sentinel, never user content
  return { masked, unprotect: (value) => value.replace(/\u0000K(\d+)\u0000/g, (_, index: string) => keep[Number(index)] ?? "") };
}

/**
 * Deterministic pass (no model key needed): removes chatbot residue, filler
 * closers/sections, em-dash chaining, curly quotes, the not-X-it's-Y contrast
 * and banned vocabulary — without touching code blocks, inline code, link
 * targets, link anchors, or markdown table rows.
 */
export function deterministicScrub(
  markdown: unknown,
  bannedPhrases: Array<string | null | undefined> = [],
): { markdown: string; stripped: string[] } {
  const stripped: string[] = [];
  const note = (label: string) => {
    if (!stripped.includes(label)) stripped.push(label);
  };
  let text = typeof markdown === "string" ? markdown : "";
  if (/i hope this helps|great question!|certainly!|of course!|you're absolutely right|would you like|want me to|should i continue|let me know if/i.test(text)) {
    note("§22 chatbot residue");
    const residue = new RegExp(RESIDUE_SENTENCE.source, "i");
    const wholeLine = new RegExp(RESIDUE_LINE.source, "i");
    text = text
      .split("\n")
      .map((line) => {
        if (wholeLine.test(line)) return "";
        return line
          .split(/(?<=[.!?])\s+/)
          .filter((sentence) => !residue.test(sentence))
          .join(" ")
          .trim();
      })
      .filter((line) => line !== "")
      .join("\n");
  }
  if (/the future looks bright|exciting times|read that again|let that sink in|that's the real win|that distinction matters/i.test(text)) {
    note("§2/§13 filler closer or send-off");
    const closer = new RegExp(CLOSER_LINE.source, "i");
    const wholeCloser = new RegExp(CLOSER_LINE.source, "im");
    text = text
      .split("\n")
      .map((line) => {
        if (wholeCloser.test(line)) return "";
        return line
          .split(/(?<=[.!?])\s+/)
          .filter((sentence) => !closer.test(sentence))
          .join(" ")
          .trim();
      })
      .filter((line) => line !== "")
      .join("\n");
  }
  if (FILLER_HEADING.test(text)) {
    note("§13 stock section heading");
    text = text.replace(FILLER_HEADING, "");
  }
  // §8 dashes → commas, outside protected segments.
  if (/[—–]|\s--\s/.test(text)) {
    note("§8 dashes as connectors");
    const { masked, unprotect } = protectSegments(text, false);
    text = unprotect(masked.replace(/\s*[—–]+\s*|\s--\s/g, ", "));
  }
  // §21 curly quotes.
  if (/[“”‘’]/.test(text)) {
    note("§21 curly quotes");
    text = text.replace(/[“”]/g, '"').replace(/[‘’]/g, "'");
  }
  // §1 not X, it's Y → "X, and Y" — applied per sentence so a rewrite can sit
  // next to other sentences on the same line.
  if (/\bnot\s+(?:just|only|merely)\b/i.test(text)) {
    const contrast =
      /^(it'?s|it is|this is|that's|they'?re|they are)\s+not\s+(?:just|only|merely)\s+(?<x>[^.!?\n]+?)\s*[,;:]?\s*(?:—|--)?\s*(?:it|this|that)\s*(?:'s|\s+is)\s+(?<y>[^.!?\n]+?)\.?\s*$/im;
    note("§1 not-X-but-Y contrast");
    const { masked, unprotect } = protectSegments(text, true);
    const rewritten = masked
      .split("\n")
      .map((line) =>
        line
          .split(/(?<=[.!?])\s+/)
          .map((sentence) =>
            sentence.replace(contrast, (full, _prefix: string, x: string, y: string) => {
              const tail = full.trim().endsWith("!") ? "!" : full.trim().endsWith("?") ? "?" : ".";
              return `${x.trim().charAt(0).toUpperCase()}${x.trim().slice(1)}, and ${y.trim()}${tail}`;
            }),
          )
          .join(" "),
      )
      .join("\n");
    text = unprotect(rewritten);
  }
  // §12/§16/§18 banned vocabulary (word-scans skip protected segments).
  const { masked, unprotect } = protectSegments(text, true);
  let working = masked;
  for (const [pattern, replacement] of BANNED_SWAPS) {
    if (pattern.test(working)) {
      note(`§12 overused word: ${pattern.source.replace(/\\b/g, "").replace(/\((?:\?:)?[^)]*\)/g, "").slice(0, 30)}`);
      pattern.lastIndex = 0;
      working = working.replace(pattern, replacement);
    }
  }
  for (const phrase of bannedPhrases.map((item) => String(item ?? "").trim()).filter(Boolean)) {
    const safe = phrase.replace(/[.*+?^${}()|[\]\\]/g, "\\$&").replace(/\s+/g, "\\s+");
    const re = new RegExp(`(^|[^\\p{L}])${safe}[,;.:]?`, "giu");
    if (re.test(working)) {
      note(`banned phrase: ${phrase}`);
      re.lastIndex = 0;
      working = working.replace(re, "$1");
    }
  }
  text = unprotect(working);
  // Punctuation hygiene left behind by removals.
  text = text
    .replace(/[ \t]{2,}/g, " ")
    .replace(/ ([,.;:!?])/g, "$1")
    .replace(/,\s*\./g, ".")
    .replace(/\n{3,}/g, "\n\n")
    .replace(/^[ \t]+$/gm, "")
    .trim();
  return { markdown: text, stripped };
}

/** Prompt fragment: the full anti-pattern constitution injected into Stage 2 drafts. */
export const BLADER_DRAFT_RULES: string[] = [
  "State every point directly. Never stage it: no not-X-but-Y contrasts ('It's not just X, it's Y'), no one-line closers ('That is the real win.'), no sayings-that-sound-deep ('At its core…'), no run-ups ('Let's dive in…'), and no arguing against objections nobody made.",
  "Rhythm comes from meaning: no forced triads (X, Y, and Z) unless there really are three items, no em or en dashes (use a comma, colon, or full stop), no repeated sentence openings, no stacked qualifiers.",
  "No inflated vocabulary: never write delve, tapestry, pivotal, crucial, meticulous, testament, showcase, underscore, robust, seamless, vibrant, intricate, utilize, leverage, garner, or 'in conclusion'.",
  "No inflated significance: no 'pivotal moment', 'lasting legacy', 'evolving landscape', 'continues to thrive', no 'Future Outlook' section, no send-off paragraph. End on the last concrete fact.",
  "No sales language and no borrowed authority: no 'nestled', 'breathtaking', 'rich heritage', 'renowned', no unnamed 'experts say'. Use is/are/has instead of 'serves as', 'stands as', 'boasts'.",
  "No rule-based formatting: no decorative bold labels, no emoji or arrows in headings, sentence-case headings, straight quotes only, and never open a section by restating its heading.",
  "No chatbot residue ('I hope this helps'), no knowledge-limit disclaimers, no writing about the document instead of the subject.",
];

/** Pass-1 audit prompt: identify what still reads as machine-written. */
export const BLADER_AUDIT_CONTRACT = [
  "You audit prose for AI tells using the blader/humanizer ruleset (Wikipedia 'Signs of AI writing'). Return valid JSON only, no markdown fence.",
  'Return JSON matching {"issues":[{"id":number,"note":"what still sounds machine-written and why, one line"}]}.',
  "Look for: staging contrasts (not X but Y), one-line closers, deep-sounding sayings, staged run-ups, arguing with no one, forced triads, repeated sentence openings, em-dash chaining, stacked qualifiers, overused AI words (delve, tapestry, pivotal, robust…), inflated significance, vague association, shallow -ing riders, sales language, borrowed authority, avoided is/are/has verbs, decorative bold, emoji or arrow headings, curly quotes, chatbot residue, knowledge-limit disclaimers, a heading repeated in the first sentence, writing about the document instead of the subject.",
  "Report only what the sample actually contains. An empty issue list is valid.",
];

/** Pass-2 rewrite contract: preserve everything that carries SEO or meaning. */
export const BLADER_REWRITE_CONTRACT = [
  "You are the blader/humanizer surgical rewriter. Rewrite machine-sounding prose so it reads like the assigned human author, without changing what it says. Do not invent facts, names, numbers, dates, quotes, or citations.",
  "Preserve the Bing SEO skeleton EXACTLY: the same H1/H2/H3 headings (you may reword a heading only to de-AI it while keeping the same meaning and question shape), every markdown table and all of its rows, every markdown link with its exact href and anchor, and the direct-answer opening.",
  "Remove the flagged AI tells: state each point plainly instead of patching phrases. Vary sentence length; alternate short and long. No em/en dashes anywhere — use commas, colons, or full stops. Use is/are/has. No banned vocabulary, no staged contrasts, no one-line closers, no filler conclusion — end on the last concrete fact.",
  "Match the author's voice block: rhythm, diction, sentence-length band, signature moves, point of view. Keep specific details, honest mixed feelings, and grounded asides.",
  'Return valid JSON only matching {"markdown":"the full rewritten article markdown"}. No markdown fence, no commentary.',
];

export type BladerResult = {
  markdown: string;
  score: number;
  stripped: string[];
  passes: number;
  llm: boolean;
  note: string;
  keyId?: string;
  usage?: { prompt: number; completion: number; total: number };
};

/** Full surgical two-pass humanization. Without `chat` it stays deterministic. */
export async function humanizeWithBlader(input: {
  markdown: string;
  keyword?: string;
  title?: string;
  authorName?: string;
  authorVoice?: string;
  authorBannedPhrases?: string[];
  chat?: BladerChat;
}): Promise<BladerResult> {
  const markdown = typeof input.markdown === "string" ? input.markdown : "";
  const banned = [...(input.authorBannedPhrases ?? [])];
  const fingerprint = structuralFingerprint(markdown);
  const before = humanizerScore(markdown);
  const det = deterministicScrub(markdown, banned);
  let text = det.markdown;
  const stripped = det.stripped;
  let passes = 1;
  let llm = false;
  let keyId: string | undefined;
  let usage: { prompt: number; completion: number; total: number } | undefined;
  let note = "Blader humanizer · deterministic pass only";

  if (input.chat) {
    try {
      const call = input.chat;
      const voice = [
        input.authorVoice ? `Author voice (adopt exactly):\n${input.authorVoice}` : input.authorName ? `You write as ${input.authorName}, a US staff writer with a plain, grounded human voice.` : "",
        input.title ? `Article title: ${input.title}` : "",
        input.keyword ? `Target query: ${input.keyword}` : "",
      ]
        .filter(Boolean)
        .join("\n");

      // Pass 1 — audit what the deterministic pass could not see.
      let issues: { id?: number; note?: string }[] = [];
      const audit = await call(BLADER_AUDIT_CONTRACT.join(" "), [voice, "Sample to audit:", det.markdown].filter(Boolean).join("\n\n"));
      if (audit.ok) {
        usage = audit.usage;
        keyId = audit.keyId;
        try {
          const parsed = JSON.parse(String(audit.text ?? "").replace(/^```json\s*|```$/g, "").trim()) as { issues?: { id?: number; note?: string }[] };
          issues = (parsed.issues ?? []).filter((issue) => typeof issue.note === "string").slice(0, 12);
        } catch {
          issues = [];
        }
      }
      if (!issues.length && before.hits.length) {
        issues = before.hits.slice(0, 12).map((hit) => ({ id: hit.id, note: `${hit.pattern}: ${hit.excerpt}` }));
      }

      // Pass 2 — surgical rewrite; keep the deterministic result if the model broke structure.
      if (issues.length) {
        const rewrite = await call(
          [...BLADER_REWRITE_CONTRACT, voice].filter(Boolean).join("\n\n"),
          ["AI tells to remove (detected by the audit pass):", ...issues.map((issue, index) => `${index + 1}. [${issue.id ?? "?"}] ${issue.note}`), "", "Article to rewrite:", det.markdown].join("\n"),
        );
        if (rewrite.ok) {
          usage = rewrite.usage;
          keyId = rewrite.keyId;
          try {
            const parsed = JSON.parse(String(rewrite.text ?? "").replace(/^```json\s*|```$/g, "").trim()) as { markdown?: string };
            const candidate = (parsed.markdown ?? "").trim();
            if (candidate.length > 200 && structureIntact(fingerprint, structuralFingerprint(candidate))) {
              text = candidate;
              llm = true;
              passes = 2;
              note = "Blader humanizer · audit + surgical rewrite (2 passes, key pool)";
            } else {
              stripped.push("rewriter broke the markdown structure — deterministic result kept");
              note = "Blader humanizer · deterministic pass (LLM rewrite failed the structure check)";
            }
          } catch {
            stripped.push("rewriter returned invalid JSON — deterministic result kept");
          }
        }
      } else {
        note = "Blader humanizer · audit found no remaining tells";
      }
    } catch (error) {
      stripped.push(`LLM pass unavailable: ${error instanceof Error ? error.message : "failed"}`);
    }
  }
  const final = humanizerScore(text);
  return { markdown: text, score: final.score, stripped, passes, llm, note, keyId, usage };
}
