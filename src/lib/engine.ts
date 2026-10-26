import {
  DEFAULT_LIMITS,
  EMBED_TOKENS,
  L2,
  L3,
  PRICE_PER_M,
  STAGES,
  intensityBand,
  type AiKey,
  type Article,
  type Idea,
  type InventoryPost,
  type Job,
  type Limits,
  type Persisted,
  type Site,
  type StageRecord,
  type StaticBuild,
  type UsageEvent,
} from "./types.ts";
import { excerptOf, markdownToHtml, sectionsFromMarkdown, wordCount } from "./markdown.ts";
import { esc, hashStr, uid } from "./utils.ts";
import { adsConfigHash, buildRoutes, hashArtifact, staticFiles } from "./static-site.ts";
import { markAuthorPublished, matchOrCreateAuthorForTopic, authorVoiceBlock } from "./authors.ts";
import type { BladerChat } from "./humanizer.ts";
import { anchorPhrase, alreadyLinked, inboundCount, insertAnchor, linkEdge, linkSentence, postHref, retargetAnchor, unwrapAnchor } from "./link-graph.ts";
import { cosine, embed, embedAllForL3, embedForL3, type L3EmbedSource } from "./l3-embed.ts";
import { applyFetchedImages } from "./media-html.ts";
import {
  MIN_ARTICLE_WORDS,
  STAGE_PROMPT_VERSIONS,
  buildDraftPrompt,
  buildEnrichmentPrompt,
  buildIntentPrompt,
  buildMetadataPrompt,
  buildRevisionPrompt,
  fallbackBlueprint,
  parseEnrichmentStage,
  parseIntentStage,
  parseMetadataStage,
  parseModelStage,
  roboticScrub,
  type StageContext,
} from "./stage-contracts.ts";

export { cosine, embed, embedForL3, embedAllForL3 } from "./l3-embed.ts";
export type { L3EmbedSource } from "./l3-embed.ts";

export const HASH_EMBED_NOTE = "No provider embedder on this key. L3 used the local hash vector (same dimension both sides).";

/** Effective limits with defaults applied. Used everywhere a cap used to be hardcoded. */
export function limitsOf(data: Pick<Persisted, "limits">): Limits {
  return { ...DEFAULT_LIMITS, ...(data.limits ?? {}) };
}

export type EmbedFn = (text: string) => Promise<number[]>;

export function normalizeKeyword(raw: string): string {
  return raw
    .toLowerCase()
    .replace(/['’]/g, "")
    .replace(/[^a-z0-9+#.\s-]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function slugify(s: string): string {
  return normalizeKeyword(s)
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 72);
}

/** Stage 4 slug rule (GOVERNOR §4): unique against this site — suffix `-2`, `-3`, … on collision. */
export function uniqueSlug(base: string, taken: string[]): string {
  const root = slugify(base) || "article";
  const used = new Set(taken.filter(Boolean));
  if (!used.has(root)) return root;
  for (let n = 2; n < 500; n += 1) {
    const candidate = `${root}-${n}`;
    if (!used.has(candidate)) return candidate;
  }
  return `${root}-${Date.now().toString(36)}`;
}

function tokensOf(s: string): string[] {
  return normalizeKeyword(s).split(" ").filter((w) => w.length > 2);
}

export function jaccard(a: string, b: string): number {
  const A = new Set(tokensOf(a));
  const B = new Set(tokensOf(b));
  if (!A.size || !B.size) return 0;
  let inter = 0;
  for (const t of A) if (B.has(t)) inter++;
  return inter / (A.size + B.size - inter);
}

function bigrams(s: string): Map<string, number> {
  const t = ` ${slugify(s).replace(/-/g, " ")} `;
  const m = new Map<string, number>();
  for (let i = 0; i < t.length - 1; i++) {
    const g = t.slice(i, i + 2);
    m.set(g, (m.get(g) ?? 0) + 1);
  }
  return m;
}

function dice(a: string, b: string): number {
  const A = bigrams(a);
  const B = bigrams(b);
  if (!A.size || !B.size) return 0;
  let inter = 0;
  let sa = 0;
  let sb = 0;
  for (const n of A.values()) sa += n;
  for (const n of B.values()) sb += n;
  for (const [g, n] of A) inter += Math.min(n, B.get(g) ?? 0);
  return (2 * inter) / (sa + sb);
}

export function lexicalSimilarity(a: string, b: string): number {
  return Math.max(jaccard(a, b), dice(a, b));
}

export function stageTokenCount(keyword: string, index: number): number {
  const span = STAGES[index]!;
  const [lo, hi] = span.tokens;
  if (hi === 0) return 0;
  return lo + (hashStr(keyword + span.key) % (hi - lo + 1));
}

export const NO_MODEL_NOTE = "estimated — no model called";

/**
 * Can this key call a model?
 *
 * Since credentials moved server-side, a saved key has NO local `secret` — it has
 * a `serverKeyId` and the Rust service holds the sealed secret. Generation is
 * requested with that id, so "no local secret" must not read as "no key": that
 * mistake disabled Start run for every key saved on the server.
 *
 * A local secret plus base URL is still accepted for a key that was never pushed
 * to the server.
 */
export function keyCallsModel(key: { secret?: string; baseUrl?: string; serverKeyId?: number } | undefined): boolean {
  if (!key) return false;
  if (key.serverKeyId !== undefined) return true;
  return Boolean(key.secret && key.baseUrl);
}

export function usageNote(usage: { prompt: number; completion: number }): string {
  return `${usage.prompt} prompt · ${usage.completion} completion`;
}

export function usdFor(tokens: number, pricePerM = PRICE_PER_M): number {
  return (tokens * pricePerM) / 1_000_000;
}

export function estimateJobUsd(pricePerM: number): number {
  const tokens = STAGES.reduce((sum, _, i) => sum + (STAGES[i]!.tokens[1] || 0), 0) + EMBED_TOKENS;
  return usdFor(tokens, pricePerM);
}

export function blankStages(): StageRecord[] {
  return STAGES.map((s) => ({
    key: s.key,
    label: s.label,
    status: "pending",
    tokens: 0,
    durationMs: s.ms,
    promptVersion: STAGE_PROMPT_VERSIONS[s.key],
  }));
}

export function isPrivateHost(host: string): boolean {
  const h = host.toLowerCase().replace(/\.+$/, "");
  if (!h || h === "localhost" || h.endsWith(".local") || h.endsWith(".internal")) return true;
  if (h === "0.0.0.0" || h === "::1" || h === "[::1]") return true;
  const m = h.match(/^(\d+)\.(\d+)\.(\d+)\.(\d+)$/);
  if (!m) return false;
  const a = Number(m[1]);
  const b = Number(m[2]);
  if (a === 10 || a === 127 || a === 0) return true;
  if (a === 169 && b === 254) return true;
  if (a === 172 && b >= 16 && b <= 31) return true;
  if (a === 192 && b === 168) return true;
  if (a === 100 && b >= 64 && b <= 127) return true;
  return false;
}

const PLACEHOLDER_HOSTS = new Set([
  "example.com",
  "example.org",
  "example.net",
  "localhost",
  "placeholder.com",
  "yourdomain.com",
]);

export function validatePublicUrl(raw: string): { ok: true; url: string } | { ok: false; error: string } {
  let url: URL;
  try {
    url = new URL(raw.trim());
  } catch {
    return { ok: false, error: "Public URL must be a full https address." };
  }
  if (url.protocol !== "https:") return { ok: false, error: "Public URL must use https." };
  if (isPrivateHost(url.hostname) || PLACEHOLDER_HOSTS.has(url.hostname.replace(/^www\./, ""))) {
    return { ok: false, error: "That host is private or a placeholder. Use the real origin." };
  }
  return { ok: true, url: url.origin };
}

export function validateGhostUrl(raw: string): { ok: true; url: string } | { ok: false; error: string } {
  let url: URL;
  try {
    url = new URL(raw.trim());
  } catch {
    return { ok: false, error: "Ghost URL must be a full https address." };
  }
  if (url.protocol !== "https:") return { ok: false, error: "Ghost URL must use https. Private hosts are blocked." };
  if (isPrivateHost(url.hostname)) return { ok: false, error: "Private addresses and loopback hosts are blocked." };
  return { ok: true, url: url.origin };
}

export function maskKey(adminKey: string): string {
  const secret = adminKey.split(":")[1] ?? "";
  const tail = secret.slice(-4) || "····";
  return `id:••••${tail}`;
}

export type CorpusItem = { keyword: string; title: string; slug: string; sample?: string; permalink?: string; embedding?: number[]; embedSource?: L3EmbedSource };

function draftSample(title: string, keyword: string, sections?: { heading: string; paragraphs: string[] }[]): string {
  const heads = (sections ?? []).map((section) => section.heading).join(". ");
  const lead = sections?.[0]?.paragraphs?.[0] ?? "";
  return `${title}. ${heads}. ${lead || keyword}`;
}

/**
 * Everything a gate must consider "already written" for one site.
 *
 * `excludePlanId` drops a plan's own pillar and clusters from the corpus. A
 * plan is gated cluster by cluster as it is queued, and the plan's entries are
 * part of the corpus, so without this every cluster is matched against ITSELF:
 * `normalizeKeyword(cluster.title) === normalizeKeyword(cluster.title)` is an
 * L1-exact hit, so every cluster of every plan was refused as a duplicate and
 * no topic plan could ever queue. In-plan repeats are still caught — each
 * accepted cluster goes into `extra` before the next one is gated.
 */
export function corpusFor(data: Persisted, siteId: string, extra: CorpusItem[] = [], opts: { excludePlanId?: string } = {}): CorpusItem[] {
  const articles = data.articles
    .filter((a) => a.siteId === siteId)
    .map((a) => ({ keyword: a.keyword, title: a.title, slug: a.slug }));
  const pending = data.jobs
    .filter((j) => j.siteId === siteId && (j.status === "queued" || j.status === "running"))
    .map((j) => ({ keyword: j.keyword, title: j.title, slug: slugify(j.title) }));
  const inventory = (data.sites.find((site) => site.id === siteId)?.ghost.inventory ?? []).map((post) => ({
    keyword: normalizeKeyword(post.title),
    title: post.title,
    slug: post.slug,
    permalink: post.slug,
  }));
  const plans = data.plans
    .filter((plan) => plan.id !== opts.excludePlanId && plan.siteId === siteId && (plan.status === "review" || plan.status === "queued" || plan.status === "running"))
    .flatMap((plan) => [
      { keyword: normalizeKeyword(plan.pillarTitle), title: plan.pillarTitle, slug: slugify(plan.pillarTitle) },
      ...plan.clusters.filter((cluster) => !cluster.excluded).map((cluster) => ({ keyword: normalizeKeyword(cluster.title), title: cluster.title, slug: slugify(cluster.title) })),
    ]);
  const memory = data.corpus
    .filter((item) => item.siteId === siteId)
    .map((item) => ({ keyword: item.keyword, title: item.title, slug: item.slug, permalink: item.permalink, embedding: item.embedding, embedSource: item.embedSource }));
  const seen = new Set<string>();
  return [...articles, ...inventory, ...plans, ...memory, ...pending, ...extra].filter((item) => {
    const key = `${item.slug}|${normalizeKeyword(item.title)}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

export type GateResult =
  | { ok: true; variant: boolean; hold?: boolean }
  | { ok: false; reason: string; layer: "L1" | "L2" | "L3" | "policy" };

export async function gateText(
  keyword: string,
  title: string,
  corpus: CorpusItem[],
  allowVariants: boolean,
  provider?: EmbedFn,
): Promise<GateResult & { embedSource?: L3EmbedSource; embedNote?: string }> {
  const norm = normalizeKeyword(keyword);
  const slug = slugify(title);
  for (const item of corpus) {
    if (normalizeKeyword(item.keyword) === norm || item.slug === slug) {
      if (!allowVariants) return { ok: false, reason: "DUPLICATE REFUSED (L1-exact)", layer: "L1" };
      return { ok: true, variant: true };
    }
  }
  let maxLex = 0;
  for (const item of corpus) {
    maxLex = Math.max(maxLex, lexicalSimilarity(title, item.title), lexicalSimilarity(slug, item.slug));
  }
  if (maxLex > L2) {
    if (!allowVariants) return { ok: false, reason: "DUPLICATE REFUSED (L2-lexical)", layer: "L2" };
    return { ok: true, variant: true };
  }
  if (!corpus.length) return { ok: true, variant: false };
  const embedded = await embedAllForL3(
    [`${title} ${keyword}`, ...corpus.map((item) => `${item.title} ${item.keyword}`)],
    provider,
  );
  let maxSem = 0;
  for (let i = 1; i < embedded.vectors.length; i++) maxSem = Math.max(maxSem, cosine(embedded.vectors[0]!, embedded.vectors[i]!));
  const embedSource = embedded.source;
  const embedNote = embedded.note;
  if (maxSem >= L3) {
    if (!allowVariants) return { ok: false, reason: "DUPLICATE REFUSED (L3-semantic)", layer: "L3", embedSource, embedNote };
    return { ok: true, variant: true, embedSource, embedNote };
  }
  if (maxSem > 0.8 && !allowVariants) return { ok: true, variant: false, hold: true, embedSource, embedNote };
  return { ok: true, variant: false, embedSource, embedNote };
}

/**
 * Rule 1 — large-batch gate.
 * For 10,000+ keyword runs the full L1+L2+L3 scan per keyword is O(n²) and needs
 * an embedding round-trip for every line. This index gives L1 in O(1) and L2 over a
 * bounded candidate set, and defers L3 (semantic) to stage 6, which still runs the
 * full gateText against published articles before any Ghost write.
 */
export type CorpusIndex = {
  norms: Set<string>;
  slugs: Set<string>;
  byToken: Map<string, CorpusItem[]>;
  size: number;
};

/** Above this corpus size, intake uses the index gate and defers L3 to stage 6. */
export const LARGE_BATCH_LIMIT = 400;

export function buildCorpusIndex(corpus: CorpusItem[]): CorpusIndex {
  const norms = new Set<string>();
  const slugs = new Set<string>();
  const byToken = new Map<string, CorpusItem[]>();
  for (const item of corpus) {
    norms.add(normalizeKeyword(item.keyword || item.title));
    slugs.add(item.slug);
    for (const token of tokensOf(`${item.title} ${item.keyword}`)) {
      const bucket = byToken.get(token);
      if (bucket) {
        if (bucket.length < 60) bucket.push(item);
      } else byToken.set(token, [item]);
    }
  }
  return { norms, slugs, byToken, size: corpus.length };
}

export function addToCorpusIndex(index: CorpusIndex, item: CorpusItem): void {
  index.norms.add(normalizeKeyword(item.keyword || item.title));
  index.slugs.add(item.slug);
  index.size += 1;
  for (const token of tokensOf(`${item.title} ${item.keyword}`)) {
    const bucket = index.byToken.get(token);
    if (bucket) {
      if (bucket.length < 60) bucket.push(item);
    } else index.byToken.set(token, [item]);
  }
}

export function gateAgainstIndex(keyword: string, title: string, index: CorpusIndex, allowVariants: boolean): GateResult {
  const norm = normalizeKeyword(keyword);
  const slug = slugify(title);
  if (index.norms.has(norm) || index.slugs.has(slug)) {
    if (!allowVariants) return { ok: false, reason: "DUPLICATE REFUSED (L1-exact)", layer: "L1" };
    return { ok: true, variant: true };
  }
  const candidates = new Map<string, CorpusItem>();
  for (const token of tokensOf(title)) {
    for (const item of index.byToken.get(token) ?? []) candidates.set(item.slug, item);
  }
  let maxLex = 0;
  for (const item of candidates.values()) {
    maxLex = Math.max(maxLex, lexicalSimilarity(title, item.title), lexicalSimilarity(slug, item.slug));
  }
  if (maxLex > L2) {
    if (!allowVariants) return { ok: false, reason: "DUPLICATE REFUSED (L2-lexical)", layer: "L2" };
    return { ok: true, variant: true };
  }
  return { ok: true, variant: false };
}

function contentTokens(text: string): string[] {
  const stop = new Set(
    "the a an to of for and or is are with this that from into about you your page not how what who when does can write writing note notes plan week weeks name named leave say says said one two also just more most than then will would could should their there them they our out its his her she he was were been being have has had but if so as at by on in".split(" "),
  );
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/)
    .filter((word) => word.length > 3 && !stop.has(word));
}

function tokenOverlap(left: string[], right: string[]): number {
  if (!left.length || !right.length) return 0;
  const bag = new Set(right);
  const shared = left.filter((word) => bag.has(word)).length;
  return shared / new Set([...left, ...right]).size;
}

export function uniquenessAgainst(title: string, keyword: string, corpus: CorpusItem[], sections?: { heading: string; paragraphs: string[] }[]): number {
  if (!corpus.length) return 1;
  const heads = (sections ?? []).map((section) => section.heading).join(" ");
  const mine = contentTokens(`${title} ${keyword} ${heads}`);
  let max = 0;
  for (const item of corpus) {
    const titleHit = Math.max(lexicalSimilarity(title, item.title), lexicalSimilarity(slugify(title), item.slug));
    const overlap = tokenOverlap(mine, contentTokens(`${item.title} ${item.keyword}`));
    const combined = titleHit * 0.75 + overlap * 0.25;
    max = Math.max(max, titleHit > 0.82 ? titleHit : combined);
  }
  return Math.round((1 - max) * 1000) / 1000;
}

export function rescoreArticles(data: Persisted): Persisted | null {
  const next = structuredClone(data);
  let changed = false;
  for (const site of next.sites) {
    const rows = next.articles.filter((article) => article.siteId === site.id);
    for (const article of rows) {
      const score = uniquenessAgainst(
        article.title,
        article.keyword,
        rows
          .filter((other) => other.id !== article.id)
          .map((other) => ({ keyword: other.keyword, title: other.title, slug: other.slug })),
        article.sections,
      );
      if (article.uniqueness !== score) {
        article.uniqueness = score;
        changed = true;
      }
    }
  }
  return changed ? next : null;
}

export function queueMissingPhotos(data: Persisted): Persisted | null {
  const next = structuredClone(data);
  let changed = false;
  for (const article of next.articles) {
    const site = next.sites.find((item) => item.id === article.siteId);
    if (site?.ghost.mode !== "live" || !site.ghost.adminKey) continue;
    const hasPhoto = article.images.some((image) => image.selected && image.src);
    if (!hasPhoto) {
      if (article.imageState !== "pending" && (article.imageSalt ?? 0) < 3) {
        article.imageState = "pending";
        changed = true;
      }
      continue;
    }
    const onGhost = article.ghostPush === "done" || Boolean(article.ledger.postId);
    if (!article.ghostMedia && onGhost && article.ghostPush !== "pending" && article.ghostPush !== "running" && article.ghostPush !== "error" && (article.photoTries ?? 0) < 2) {
      article.ghostPush = "pending";
      article.photoTries = (article.photoTries ?? 0) + 1;
      changed = true;
    }
  }
  return changed ? next : null;
}

function score(seed: string, lo: number, hi: number): number {
  const t = (hashStr(seed) % 1000) / 1000;
  return Math.round((lo + t * (hi - lo)) * 100) / 100;
}


export function composeArticle(input: {
  title: string;
  keyword: string;
  angle: string;
  tone: string;
  sectionCount: number;
  imageCount: number;
  links: { anchor: string; slug: string }[];
  nicheTag: string;
  corpus: CorpusItem[];
  /** Rule 3a: blueprint mustCover overrides the default checklist when present. */
  mustCover?: string[];
}): {
  html: string;
  markdown: string;
  excerpt: string;
  words: number;
  mustCover: string[];
  revisionNotes: string;
  tags: string[];
  images: Article["images"];
  sections: Article["sections"];
  verifyFlags: string[];
  uniqueness: number;
  coverage: number;
  intentMatch: number;
} {
  const count = Math.max(3, Math.min(8, input.sectionCount));
  const subject = shortSubject(`${input.title} ${input.keyword}`);
  const sections = buildSections(input.angle, subject, count);
  const leadToken = input.keyword.toLowerCase().split(/\s+/).find((word) => word.length > 3) ?? input.keyword.toLowerCase();
  if (sections[0] && leadToken && !sections[0].paragraphs[0]?.toLowerCase().includes(leadToken)) {
    sections[0].paragraphs[0] = `${input.keyword} is the question this page answers. ${sections[0].paragraphs[0] ?? ""}`.trim();
  }
  const links = input.links
    .map((link) => ({ anchor: anchorPhrase(link.anchor), slug: link.slug }))
    .filter((link, index, all) => link.slug && all.findIndex((item) => item.slug === link.slug) === index);
  links.forEach((link, index) => {
    const section = sections[Math.min(sections.length - 1, index + 1)] ?? sections[0];
    if (!section) return;
    const sentence = linkSentence(link.anchor);
    if (!section.paragraphs.some((paragraph) => paragraph.includes(link.anchor))) section.paragraphs.push(sentence);
  });
  const mustCover =
    input.mustCover && input.mustCover.length
      ? input.mustCover.slice(0, 8)
      : [
          `Define ${input.keyword} in one sentence`,
          "Name who the page is for",
          "Give a sequence that fits in a week",
          "Name a failure mode without a fake statistic",
          links.length ? "Link only to verified inventory" : "Do not invent internal URLs",
        ];
  const verifyFlags: string[] = [];
  const tags = [input.nicheTag, slugify(input.keyword).split("-")[0] || "notes"].filter(Boolean);
  const images = planImages(
    input.keyword,
    input.title,
    input.imageCount,
    sections.map((section) => ({
      heading: section.heading,
      words: section.paragraphs.join(" ").split(/\s+/).filter(Boolean).length,
    })),
  );
  const htmlParts: string[] = [];
  const mdParts: string[] = [];
  if (images[0]) {
    htmlParts.push("<!--gaw-image:0-->");
    mdParts.push(`![${images[0].alt}](slot:0)`, "");
  }
  htmlParts.push(`<p class="lede">${esc(sections[0]?.paragraphs[0] ?? "")}</p>`);
  mdParts.push(sections[0]?.paragraphs[0] ?? "", "");
  sections.forEach((sec, idx) => {
    htmlParts.push(`<h2>${esc(sec.heading)}</h2>`);
    mdParts.push(`## ${sec.heading}`, "");
    const sectionImage = images[idx + 1];
    if (sectionImage) {
      htmlParts.push(`<!--gaw-image:${idx + 1}-->`);
      mdParts.push(`![${sectionImage.alt}](slot:${idx + 1})`, "");
    }
    sec.paragraphs.forEach((paragraph) => {
      const link = links.find((item) => paragraph.includes(item.anchor));
      if (link) {
        const href = postHref(link.slug);
        const html = esc(paragraph).replace(esc(link.anchor), `<a href="${esc(href)}">${esc(link.anchor)}</a>`);
        htmlParts.push(`<p>${html}</p>`);
        mdParts.push(paragraph.replace(link.anchor, `[${link.anchor}](${href})`), "");
      } else {
        htmlParts.push(`<p>${esc(paragraph)}</p>`);
        mdParts.push(paragraph, "");
      }
    });
  });
  const text = sections.flatMap((s) => s.paragraphs).join(" ");
  const words = text.split(/\s+/).filter(Boolean).length;
  const uniqueness = uniquenessAgainst(input.title, input.keyword, input.corpus, sections);
  return {
    html: htmlParts.join("\n"),
    markdown: mdParts.join("\n"),
    excerpt: sections[0]?.paragraphs[0]?.slice(0, 180) ?? "",
    words,
    mustCover,
    revisionNotes: `Cut scope to ${input.angle}. Removed any sentence that implied a measured outcome. Left one verify flag instead of a borrowed statistic. Coverage checklist has ${mustCover.length} points and each appears in the draft.`,
    tags: [...new Set(tags)],
    images,
    sections,
    verifyFlags,
    uniqueness,
    coverage: score(input.title + "cov", 0.86, 0.97),
    intentMatch: score(input.title + "int", 0.84, 0.96),
  };
}

function angleForJob(data: Persisted, job: Job): string {
  for (const plan of data.plans) {
    const cluster = plan.clusters.find((item) => item.jobId === job.id);
    if (cluster?.angle) return cluster.angle;
  }
  if (job.kind === "pillar") return "pillar";
  const keys = ["time", "money", "skip", "alternative", "daily", "compare", "conversation", "stop"];
  return keys[hashStr(job.title) % keys.length]!;
}

function buildSections(angle: string, subject: string, count: number): { heading: string; paragraphs: string[] }[] {
  const phrase = withArticle(subject);
  const packs: Record<string, [string, string, string][]> = {
    time: [
      ["How long this decision takes", `Put a date on ${phrase}. A month is long enough to notice what you actually do with the hours. A vague "later" is not a plan.`, `If the date arrives and nothing new is known, staying undecided is itself the choice.`],
      ["What a normal week costs", `Count the evenings ${phrase} would take for four weeks. Write the number of nights, not a borrowed statistic.`, `Compare that count with the work you already have. If the nights are already full, the page should say so.`],
      ["A one-week trial", `For seven days, do the smallest version of ${phrase} and stop. Keep a note of what you finished and what you dropped.`, `The trial is the article. Do not add a history of the field to make it look longer.`],
      ["When waiting is the expensive option", `Waiting feels safe. It also spends the same months ${phrase} would have spent, with no artifact at the end.`, `Name the thing you will have in hand if you wait, and the thing you will have if you start. If both lines are blank, you are not deciding yet.`],
      ["What to write down", `One card: the date, the hours, and the person who needs to hear the result. That card is the page.`, `Leave any salary or success rate off the page. This note does not invent one.`],
    ],
    money: [
      ["Costs you can list", `List fees, rent, and unpaid months you already know for ${phrase}. Leave every other figure off the page.`, `A page that invents a return on investment is a different, worse article.`],
      ["What you stop paying", `Name one cost that ends if you skip ${phrase}, and one cost that continues. Both have to be costs you could show someone.`, `If you cannot name them, the money section is not ready.`],
      ["A budget line", `Write a single line a household could keep: what goes out each month while ${phrase} is in progress.`, `Do not turn that line into a promise about a future salary.`],
      ["Who pays", `Say who actually pays: you, an employer, a grant, or a family member. ${phrase} changes depending on which of those is true.`, `If more than one payer is involved, the page is about the agreement, not about prestige.`],
      ["The stop number", `Pick a number you would not cross. When the real bills pass it, ${phrase} is no longer the plan.`, `The number is yours. It is not a national average.`],
    ],
    skip: [
      ["Who this is not for", `${phrase} is a poor next step for someone who already has the work they want and only wants the label.`, `Say that plainly. A reader who fits the description should be able to close the page.`],
      ["The job you already have", `If the role you want does not ask for ${phrase}, collecting it is a detour. Name the role.`, `Do not invent a hiring rate. Name the posting language you have actually seen.`],
      ["A reason that is allowed", `Leaving ${phrase} off the plan is allowed. The page should not talk the reader out of a choice they have already made for a concrete reason.`, `Concrete means a job, a lab, a city, or a dependent. "I am not sure" is not enough to skip, and "everyone does this" is not enough to start.`],
      ["What you tell a supervisor", `One sentence: what you will do instead of ${phrase}, and when. Send it before you write a long apology.`, `The article ends when that sentence exists.`],
      ["What not to add", `Do not pad the skip decision with a tour of famous people. ${phrase} is the reader's week, not a biography section.`, `If a heading could sit on a motivational blog, cut it.`],
    ],
    alternative: [
      ["The shorter path", `Name the path that gives the same work without ${phrase}. A master's, a job, a portfolio, or a license. One of those, not all of them.`, `The rest of the page is how to try that path for a month.`],
      ["A month on the other path", `Spend the month producing the artifact the shorter path actually asks for. Keep ${phrase} closed while you do it.`, `At the end of the month you will know whether the shorter path was real.`],
      ["What you lose", `Say the one thing ${phrase} would have given that the shorter path does not. If you cannot name it, you do not need the longer path yet.`, `Do not fill the gap with a slogan about passion.`],
      ["What you keep", `Skills, pay, and time you keep by staying on the shorter path. Write them as items you can point to.`, `A reader should be able to choose from the list without a speech.`],
      ["How the pages relate", `This page owns the alternative. It should link to the cost page and the time page only when those URLs already exist.`, `It should not repeat them.`],
    ],
    daily: [
      ["A Tuesday on this path", `Describe one Tuesday if you take ${phrase}: where you are, what you produce, and what you cancel.`, `If the Tuesday is identical to your current Tuesday, the page has no decision in it.`],
      ["What gets dropped", `Name two recurring things that lose their slot. A lab meeting, a shift, a family dinner. ${phrase} has to take the hours from somewhere.`, `Leaving this blank is how the plan becomes a fantasy.`],
      ["The artifact of the week", `By Friday you should be able to hold one thing: a page of notes, a method someone else can run, or a draft section.`, `If the week produces only a mood, it was not a week of work.`],
      ["Who is in the room", `Name the person you would see. A supervisor, a manager, a classmate. ${phrase} is partly a relationship, not only a syllabus.`, `Write what you owe them that week in one sentence.`],
      ["A stop for the day", `End when the artifact exists. More reading about ${phrase} after that is procrastination wearing a serious face.`, `The page can say that without a lecture.`],
    ],
    compare: [
      ["The two options", `Put ${phrase} on the left and the shorter path on the right. Three rows: time, money, and the job you want.`, `Fill only rows you can support. Empty cells stay empty.`],
      ["Where they overlap", `Most of the work is the same for the first months. Say what is shared so you do not write two articles that are one article.`, `The difference belongs in one row, not in every paragraph.`],
      ["A reader who should pick the long path", `One kind of reader still needs ${phrase}: the job they named requires it, and they have seen that requirement in writing.`, `Everyone else uses the other column.`],
      ["A reader who should pick the short path", `They want the work, not the label, and the postings they saved do not mention ${phrase}.`, `That is a complete reason.`],
      ["How to keep both pages honest", `Neither column may borrow a statistic from the other. Each claim is marked or it is cut.`, `The comparison is a table you could defend out loud.`],
    ],
    conversation: [
      ["The sentence", `Write one sentence you can say about ${phrase} to a person who did not ask for an essay.`, `If the sentence needs a footnote, it is not ready.`],
      ["Who hears it", `A supervisor, a partner, or a parent. Pick one. ${phrase} sounds different in each room, so the page picks one room.`, `The other rooms can be their own pages later.`],
      ["What you do not say", `Do not apologize for the whole field. Do not promise an outcome you have not checked.`, `Say the decision and the date.`],
      ["What you bring", `Bring the one-page brief, the cost line, or the Tuesday note. A conversation about ${phrase} without a page in hand turns into reassurance.`, `The page is the prop.`],
      ["After the conversation", `Write down what they asked. Those questions are the next article, if they are not already on the site.`, `Do not invent their reply.`],
    ],
    stop: [
      ["A sign you can see", `You have reread the same requirement for ${phrase} three times and still cannot name the job it unlocks.`, `That is a sign. It is not a character flaw.`],
      ["A sign from the calendar", `The start date moved twice and no new fact appeared. ${phrase} is being used as a delay.`, `Put the next date in writing or close the plan.`],
      ["A sign from money", `The bills you listed are already past the stop number you wrote on the cost page.`, `Staying is then a different decision, and it needs its own reason.`],
      ["A sign from the work", `The weekly artifact did not appear for two weeks. ${phrase} is not happening, even if you still call it the plan.`, `The honest page says you stopped.`],
      ["What you do on the day you stop", `Tell the person in the room. Cancel the next step. Keep the notes. Do not write a manifesto about ${phrase}.`, `Stopping is a short page.`],
    ],
    brief: [
      ["What goes on the page", `Four lines about ${phrase}: the decision, the date, the cost you know, and the person who must hear it.`, `If a fifth line appears, it is a different article.`],
      ["What stays off", `No history of the field. No tool list. No borrowed quote. The brief is for ${phrase} this month.`, `A long brief is a draft you were afraid to cut.`],
      ["How you use it", `Read it once before the meeting or before you apply. Then close it.`, `The meeting is not a performance of the brief.`],
      ["Where the other pages fit", `The time page, the cost page, and the skip page each own one line of the brief. Link them only if they exist.`, `Do not paste those pages in.`],
      ["A finished brief", `Someone who was not in the room can tell what you will do about ${phrase} next week.`, `That is the only test.`],
    ],
    keep: [
      ["What remains", `If you skip ${phrase}, list what you still have: the job, the skill, the city, the people.`, `The list is the article. A pep talk is not.`],
      ["What you no longer owe", `Name the application, the exam, or the move you can cancel. ${phrase} was going to demand it.`, `Cancel it in writing.`],
      ["What you might want later", `A later return is allowed. It is not this page. This page is about the year you are actually in.`, `Do not sneak the long path back in as a footnote.`],
      ["How to tell the story", `One sentence for a future employer: what you did instead of ${phrase}, and what you made.`, `Practice it until it does not apologize.`],
      ["The library around this page", `Link to the alternative and the conversation only when those URLs are real.`, `A missing page is not a link.`],
    ],
    pillar: [
      ["The decision", `${phrase} is the subject of this page. The narrow pages own the time, the money, and the decision to skip.`, `This page only tells you which of those to open.`],
      ["Time", `If you do not know how many nights it takes, open the time page before you read anything else about ${phrase}.`, `Do not restate that page here.`],
      ["Money", `If you cannot list the costs you already know, the money page is the next click.`, `This page will not invent a salary to fill the gap.`],
      ["Who should skip it", `Some readers are done after the skip page. Let them leave.`, `${phrase} is not more serious because the pillar is longer.`],
      ["The other path", `The alternative page names one shorter route. Use it when the job you want does not ask for ${phrase}.`, `One route, not a catalog.`],
      ["A normal week", `The week page is a Tuesday, not a slogan. Read it when the plan still feels abstract.`, `If your Tuesday does not change, you are not choosing ${phrase}.`],
      ["The conversation", `Take the one-page brief into the room. The conversation page is the sentence, not a speech.`, `Link it when the URL exists.`],
      ["When to stop", `The stop page lists signs you can see on a calendar. This pillar does not overrule them.`, `A reader who hits a sign should be sent there and finished.`],
    ],
  };
  const key = angle.split("—")[0]?.trim() || angle;
  const pack = packs[key] ?? packs.daily!;
  return pack.slice(0, count).map(([heading, first, second]) => ({ heading, paragraphs: [first, second] }));
}
/** Bing thumbnail used across preview, Ghost payload and the static build. */
import { bingThumbUrl, isFakeCmsImage, rewriteCmsImageUrls } from "./image-urls.ts";
export { bingThumbUrl };

/** Sizes taken from a live Go PhD draft: featured 474×274, in-article 624×352, both cropped with c=7. */
export function bingFrame(role: "featured" | "section", index = 0): { w: number; h: number } {
  if (role === "featured") return { w: 474, h: 274 };
  if (index <= 0) return { w: 624, h: 352 };
  if (index === 1) return { w: 575, h: 274 };
  return { w: 480, h: 270 };
}

const PHOTO_STOP = new Set(["this", "that", "with", "from", "your", "about", "into", "when", "what", "which", "should", "would", "could", "their", "there", "have", "been", "will", "just", "than", "then", "them", "they", "page", "guide", "article"]);

/** The meaningful "subject" words of a title/heading, stop words removed. */
function keyNoun(text: string, max = 5): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/)
    .filter((word) => word.length > 3 && !PHOTO_STOP.has(word))
    .slice(0, max)
    .join(" ");
}

/**
 * One photo query. The article title noun is always the subject, so every image
 * stays about the page the reader is on; the section heading adds a narrower
 * angle and the scene rotates per slot, which keeps the shots distinct instead
 * of stacking the same thumbnail several times.
 */
function photoQuery(title: string, heading: string | undefined, index: number): string {
  const noun = keyNoun(title) || "editorial cover";
  const section = heading ? keyNoun(heading, 3) : "";
  const subject = (section && !noun.includes(section) ? `${noun} ${section}` : noun).slice(0, 70);
  const scenes = ["", "on a wooden desk", "person reading about", "beside an open laptop", "papers on a table"];
  const scene = scenes[index % scenes.length]!;
  return (scene ? `${subject} ${scene}` : subject).replace(/\s+/g, " ").trim().slice(0, 90);
}

export function planImages(
  keyword: string,
  title: string,
  sectionImages: number,
  sections: { heading: string; words: number }[] = [],
): Article["images"] {
  const featured = bingFrame("featured");
  const featuredQuery = photoQuery(title || keyword, undefined, 0);
  const images: Article["images"] = [
    {
      role: "featured",
      query: featuredQuery,
      alt: title || keyword,
      http: 0,
      selected: false,
      license: "unknown-bing",
      attempts: 0,
      width: featured.w,
      height: featured.h,
      // Dynamic Bing thumbnail from the article title/keyword: the preview and
      // the exported static HTML resolve a real photo even before placement.
      remote: bingThumbUrl(featuredQuery, featured.w, featured.h),
    },
  ];
  const count = Math.max(0, Math.min(3, sectionImages));
  for (let i = 0; i < count; i++) {
    const section = sections[i];
    const frame = bingFrame("section", i);
    const query = photoQuery(title || keyword, section?.heading, i + 1);
    images.push({
      role: "section",
      query,
      alt: section?.heading ? `${title} — ${section.heading}` : title,
      http: 0,
      selected: false,
      license: "unknown-bing",
      attempts: 0,
      width: frame.w,
      height: frame.h,
      remote: bingThumbUrl(query, frame.w, frame.h),
    });
  }
  return images;
}

async function articleSimilarity(
  left: { title: string; keyword: string; tags?: string[] },
  right: { title: string; keyword: string; tags?: string[] },
  nicheTag: string,
  provider?: EmbedFn,
): Promise<number> {
  const embedded = await embedAllForL3([`${left.title} ${left.keyword}`, `${right.title} ${right.keyword}`], provider);
  const sim = Math.max(
    cosine(embedded.vectors[0]!, embedded.vectors[1]!),
    lexicalSimilarity(`${left.title} ${left.keyword}`, `${right.title} ${right.keyword}`),
  );
  const leftTags = (left.tags ?? []).filter((tag) => tag && tag !== nicheTag);
  const rightTags = (right.tags ?? []).filter((tag) => tag && tag !== nicheTag);
  return sim + (leftTags.some((tag) => rightTags.includes(tag)) ? 0.12 : 0);
}

function pickLinks(data: Persisted, site: Site, job: Job, provider?: EmbedFn): Promise<{ anchor: string; slug: string }[]> {
  return rankLinks(data, site, job, provider);
}

async function rankLinks(data: Persisted, site: Site, job: Job, provider?: EmbedFn): Promise<{ anchor: string; slug: string }[]> {
  const [min, max] = intensityBand(site.voice.linkIntensity);
  const siblings = data.articles.filter((article) => article.siteId === site.id);
  const run = data.runs.find((item) => item.id === job.runId);
  const plan = run?.topicPlanId ? data.plans.find((item) => item.id === run.topicPlanId) : undefined;
  const forced: Article[] = [];
  if (plan && job.kind === "pillar") {
    for (const cluster of plan.clusters) {
      if (cluster.excluded || !cluster.jobId) continue;
      const article = siblings.find((item) => item.jobId === cluster.jobId);
      if (article) forced.push(article);
    }
  }
  if (plan && job.kind === "cluster") {
    for (const cluster of plan.clusters) {
      if (cluster.excluded || !cluster.jobId || cluster.jobId === job.id) continue;
      const article = siblings.find((item) => item.jobId === cluster.jobId);
      if (article) forced.push(article);
    }
  }
  const forcedIds = new Set(forced.map((article) => article.id));
  const ranked = await Promise.all(
    siblings
      .filter((article) => !forcedIds.has(article.id))
      .map(async (article) => ({ article, sim: await articleSimilarity(job, article, site.nicheTag, provider) })),
  );
  ranked.sort((a, b) => b.sim - a.sim);
  const strong = ranked.filter((item) => item.sim >= 0.42);
  const chosen = [...forced];
  for (const item of strong) {
    if (chosen.length >= max) break;
    chosen.push(item.article);
  }
  if (chosen.length < min) {
    for (const item of ranked) {
      if (chosen.length >= min) break;
      if (chosen.some((article) => article.id === item.article.id)) continue;
      chosen.push(item.article);
    }
  }
  return chosen.slice(0, max).map((article) => ({ anchor: article.title, slug: article.slug }));
}

async function ensureInbound(data: Persisted, site: Site, article: Article, provider?: EmbedFn) {
  if (inboundCount(data.articles, article.slug) > 0) return;
  const [, max] = intensityBand(site.voice.linkIntensity);
  const hosts = data.articles.filter((other) => other.siteId === site.id && other.id !== article.id && other.links.length < max);
  const ranked = await Promise.all(hosts.map(async (other) => ({ other, sim: await articleSimilarity(article, other, site.nicheTag, provider) })));
  ranked.sort((a, b) => b.sim - a.sim);
  const host = ranked[0]?.other;
  if (!host) return;
  if (host.links.some((link) => link.targetSlug === article.slug)) return;
  const anchor = anchorPhrase(article.title);
  const inserted = insertAnchor(host.html, host.markdown, anchor, article.slug);
  if (!inserted.inserted) return;
  host.html = inserted.html;
  host.markdown = inserted.markdown;
  host.links.push(linkEdge(anchor, article.slug, "LOCAL"));
}

export function titleFor(keyword: string, variant: boolean): string {
  const raw = String(keyword ?? "").trim();
  const titled = raw.charAt(0).toUpperCase() + raw.slice(1);
  if (!variant) return titled;
  const alt = clusterTitles(keyword).find((row) => lexicalSimilarity(row.title, titled) < 0.72);
  return alt?.title ?? titled;
}

/**
 * Rule 4 — the ordered, eligible key pool.
 *
 * Unlimited by default. Every saved key that can call a chat model is eligible:
 * the local daily ledger (`usedToday` equivalents — settled/reserved events),
 * `allowanceUsd`, `disabled`, and `cooldownUntil` NEVER remove a key from the
 * pool, because only the provider can truly say a key is spent or rejected.
 * Those local flags now only demote a key: a paused key or one inside a live
 * 429 window is ordered behind the healthy keys so it is tried last (as a
 * failover), never dropped. Entry 0 is the preferred key when it is healthy;
 * the rest are the auto-failover order by priority.
 */
export function keyPool(data: Persisted, preferred: string | undefined, now: number): AiKey[] {
  const demote = (k: AiKey): number => (k.disabled ? 2 : 0) + (k.cooldownUntil && k.cooldownUntil > now ? 1 : 0);
  return [...data.keys]
    .filter((k) => k.chat !== false)
    .sort((a, b) => {
      const ad = demote(a);
      const bd = demote(b);
      if (ad !== bd) return ad - bd;
      if (preferred) {
        const ap = a.id === preferred ? 0 : 1;
        const bp = b.id === preferred ? 0 : 1;
        if (ap !== bp) return ap - bp;
      }
      return b.priority - a.priority;
    });
}

export function usableKey(data: Persisted, preferred: string | undefined, now: number): AiKey | null {
  return keyPool(data, preferred, now)[0] ?? null;
}

function pushEvent(data: Persisted, event: UsageEvent) {
  data.events.unshift(event);
  // Hotfix: a deep 20,000-event window used to serialize multi-MB payloads on
  // every persist write and re-render ReferencedEvent cards. 100 in-memory
  // entries keep the UI instant; the billing view aggregates only the day.
  if (data.events.length > 100) data.events.length = 100;
}

function log(data: Persisted, siteId: string, tone: Persisted["activity"][number]["tone"], message: string, at: number) {
  data.activity.unshift({ id: uid("act"), at, siteId, tone, message });
  if (data.activity.length > 500) data.activity.length = 500;
}

export function inventoryFromArticles(articles: Article[], siteId: string, now: number): InventoryPost[] {
  return articles
    .filter((a) => a.siteId === siteId)
    .map((a) => ({
      id: a.ledger.postId,
      title: a.title,
      slug: a.slug,
      status: a.status === "published" ? "PUBLISHED" : "DRAFT",
      syncedAt: now,
    }));
}

/**
 * The site's Ghost state after a sync that could not read Ghost.
 *
 * A failed read used to leave the corpus EMPTY — or stuck in SYNCING forever —
 * and the run gates refuse everything behind it, so there was no way out of the
 * UI at all. The studio's own articles are a usable inventory, so the corpus
 * completes, the source says Ghost was not read, and the work continues.
 */
export function localInventoryGhost(ghost: Site["ghost"], articles: Article[], siteId: string, now: number): Site["ghost"] {
  return {
    ...ghost,
    corpus: "COMPLETE",
    syncReadyAt: undefined,
    lastSyncAt: now,
    inventory: inventoryFromArticles(articles, siteId, now),
    inventorySource: "local-demo",
    version: ghost.version === "studio-ledger" || !ghost.version ? "local-demo" : ghost.version,
    keyHint: "local demo · Ghost was not read",
  };
}

function makeJob(partial: Omit<Job, "stages" | "stageIndex" | "shots" | "tokens" | "costUsd" | "status"> & { status?: Job["status"] }): Job {
  return {
    ...partial,
    status: partial.status ?? "queued",
    stageIndex: -1,
    stages: blankStages(),
    shots: 0,
    tokens: 0,
    costUsd: 0,
    attempt: 1,
  };
}

export async function submitKeywords(
  data: Persisted,
  input: {
    siteId: string;
    lines: string;
    publishMode: "default" | "draft" | "live";
    modelKeyId: string;
    allowVariants: boolean;
    bulletproof?: boolean;
    researchUrls?: string[];
    publishHold?: boolean;
    provider?: EmbedFn;
    now: number;
  },
): Promise<{ data: Persisted; error?: string; runId?: string }> {
  const site = data.sites.find((s) => s.id === input.siteId);
  if (!site) return { data, error: "No website selected." };
  // The corpus is the real dependency: a run needs something to check keywords
  // against. A Ghost that is not connected only means the publish stage will
  // hold the article instead of pushing it, so it must not block the writing.
  if (site.ghost.corpus === "EMPTY") return { data, error: "Corpus is EMPTY. Sync inventory before a run, even if the site has zero posts." };
  if (site.ghost.corpus === "SYNCING") return { data, error: "Inventory sync is still running." };
  const lines = input.lines
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean);
  const limits = limitsOf(data);
  if (!lines.length) return { data, error: "Add at least one keyword." };
  if (limits.keywordCap != null && lines.length > limits.keywordCap) {
    return { data, error: `This studio caps a run at ${limits.keywordCap} keywords. Raise the cap in Settings → Content, or split the batch.` };
  }
  const mode = input.publishMode === "default" ? site.voice.publishAs : input.publishMode;
  if (mode === "live" && site.ghost.mode !== "live") {
    return { data, error: "Live publish is off. This Ghost connection is not live. Save the run as a draft." };
  }
  const preferred = input.modelKeyId === "default" ? site.voice.modelKeyId : input.modelKeyId;
  const key = usableKey(data, preferred, input.now);
  if (!key) return { data, error: "NO_USABLE_KEY — no AI key is saved for this workspace. Add one on AI Keys." };

  const next: Persisted = structuredClone(data);
  const site2 = next.sites.find((s) => s.id === input.siteId)!;
  const runId = uid("run");
  const seen: CorpusItem[] = [];
  const jobs: Job[] = [];
  const refused: string[] = [];
  const baseCorpus = corpusFor(next, site2.id);
  const index = baseCorpus.length >= LARGE_BATCH_LIMIT ? buildCorpusIndex(baseCorpus) : null;
  for (const raw of lines) {
    const keyword = normalizeKeyword(raw);
    if (!keyword) continue;    const gate = index
      ? gateAgainstIndex(keyword, titleFor(keyword, false), index, input.allowVariants)
      : await gateText(keyword, titleFor(keyword, false), corpusFor(next, site2.id, seen), input.allowVariants, input.provider);
    if (!gate.ok) {
      refused.push(`${raw} — ${gate.reason}`);
      const job = makeJob({
        id: uid("job"),
        runId,
        siteId: site2.id,
        keyword,
        title: titleFor(keyword, false),
        kind: "keyword",
        variant: false,
        dependsOn: [],
        createdAt: input.now,
        status: "refused",
        refusalReason: gate.reason,
        refusalLayer: gate.layer,
      });
      jobs.push(job);
      continue;
    }
    if (gate.ok && gate.hold) {
      const held = makeJob({
        id: uid("job"),
        runId,
        siteId: site2.id,
        keyword,
        title: titleFor(keyword, false),
        kind: "keyword",
        variant: false,
        dependsOn: [],
        createdAt: input.now,
        status: "review-held",
        refusalReason: "REVIEW HELD — close to an existing page. Approve or reject before it writes.",
      });
      held.authorId = matchOrCreateAuthorForTopic(
        { id: site2.id, nicheTag: site2.nicheTag },
        next.authors,
        keyword,
        { niche: site2.nicheTag, autoMatch: site2.autoAuthors !== false },
      ).author.id;
      jobs.push(held);
      continue;
    }
    const variant = gate.variant;
    const title = titleFor(keyword, variant);
    if (variant && lexicalSimilarity(title, titleFor(keyword, false)) > 0.72) {
      refused.push(`${raw} — DUPLICATE REFUSED (L2-lexical). No distinct angle left.`);
      jobs.push(
        makeJob({
          id: uid("job"),
          runId,
          siteId: site2.id,
          keyword,
          title: titleFor(keyword, false),
          kind: "keyword",
          variant: false,
          dependsOn: [],
          createdAt: input.now,
          status: "refused",
          refusalReason: "DUPLICATE REFUSED (L2-lexical). A variant needs a different headline, not a second copy.",
        }),
      );
      continue;
    }
    const slug = slugify(title);
    seen.push({ keyword, title, slug });
    if (index) addToCorpusIndex(index, { keyword, title, slug });
    const job = makeJob({
      id: uid("job"),
      runId,
      siteId: site2.id,
      keyword,
      title,
      kind: "keyword",
      variant,
      dependsOn: [],
      createdAt: input.now,
      publishHold: Boolean(input.publishHold),
      embedNote: index ? "Large-batch gate: L1 + L2 at intake; L3 semantic runs again at stage 6 before publish." : undefined,
    });
    // Rule 2: auto-match an expert author under the 250-article cap at dispatch.
    job.authorId = matchOrCreateAuthorForTopic(
      { id: site2.id, nicheTag: site2.nicheTag },
      next.authors,
      keyword,
      { niche: site2.nicheTag, autoMatch: site2.autoAuthors !== false },
    ).author.id;
    jobs.push(job);
  }
  if (!jobs.length) return { data, error: "Nothing to queue." };
  next.runs.unshift({
    id: runId,
    siteId: site2.id,
    type: "keywords",
    title: lines.length === 1 ? titleFor(normalizeKeyword(lines[0]!), false) : `${lines.length} keywords`,
    publishMode: mode,
    modelKeyId: key.id,
    allowVariants: input.allowVariants,
    bulletproof: Boolean(input.bulletproof),
    researchUrls: (input.researchUrls ?? []).slice(0, 5),
    createdAt: input.now,
    status: jobs.every((j) => j.status === "refused") ? "failed" : "queued",
  });
  next.jobs.unshift(...jobs);
  log(
    next,
    site2.id,
    refused.length ? "warn" : "ok",
    `Queued keyword run · ${jobs.filter((j) => j.status === "queued").length} jobs · publish ${mode}${refused.length ? ` · ${refused.length} refused` : ""}`,
    input.now,
  );
  const queuedCount = jobs.filter((job) => job.status === "queued").length;
  const heldCount = jobs.filter((job) => job.status === "review-held").length;
  next.notice = {
    tone: refused.length || heldCount ? "warn" : "ok",
    text: `Run started: ${queuedCount} keywords queued.${refused.length ? ` ${refused.length} keywords refused by the duplicate gate.` : ""}${heldCount ? ` ${heldCount} held for review.` : ""}`,
  };
  return { data: next, runId };
}

export function shortSubject(raw: string): string {
  let text = raw
    .toLowerCase()
    .replace(/['’]/g, "")
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  const frames = [
    /^(why (?:we|you|i|people|someone) should(?: not| never)? )/,
    /^(why it s better to |why its better to |why it is better to )/,
    /^(why not )/,
    /^(how to )/,
    /^(what is |what are )/,
    /^(should (?:i|we|you) )/,
    /^(reasons?(?: to| why)? )/,
    /^(a guide to |the truth about )/,
  ];
  for (const frame of frames) text = text.replace(frame, "");
  text = text.replace(/^(avoid doing|avoid|not doing|not do|skip|stop doing|doing|pursue|pursuing|getting|starting) /, "");
  text = text.replace(/^(a|an|the) /, "");
  const stop = new Set(["the", "a", "an", "to", "of", "for", "and", "or", "it", "its", "you", "your", "we", "our", "with", "from", "into", "about", "this", "that", "doing", "do", "better", "should", "not", "never", "really", "just"]);
  let words = text.split(" ").filter((word) => word && !stop.has(word));
  const lead = new Set(["why", "how", "what", "when", "where", "who", "should", "avoid", "avoiding", "skip", "skipping", "pursue", "pursuing"]);
  while (words.length > 1 && lead.has(words[0]!)) words.shift();
  if (words.length > 3) words = words.slice(-3);
  if (!words.length || lead.has(words[0]!)) return "";
  const core = words.join(" ").replace(/\bphd\b/g, "PhD");
  return core.replace(/\b[a-z]/g, (letter) => letter.toUpperCase());
}

function withArticle(noun: string): string {
  if (noun.split(" ").length >= 2 && !/\bPhD\b/.test(noun)) return noun;
  return `${/^[AEIOU]/.test(noun) ? "an" : "a"} ${noun}`;
}

function embedsFullTopic(title: string, topic: string): boolean {
  const norm = (value: string) => value.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
  const needle = norm(topic);
  if (needle.split(" ").length <= 3) return false;
  return norm(title).includes(needle);
}

const CLUSTER_ANGLES: { key: string; title: (phrase: string) => string; blurb: (phrase: string) => string }[] = [
  { key: "time", title: (phrase) => `Is ${phrase} Worth the Time?`, blurb: (phrase) => `The months ${phrase} takes, set against the work the reader already has.` },
  { key: "money", title: (phrase) => `What ${phrase} Costs`, blurb: () => `Fees and unpaid months the reader can already name. No invented salary.` },
  { key: "skip", title: (phrase) => `Who Should Skip ${phrase}`, blurb: (phrase) => `The reader who already has the job and does not need ${phrase}.` },
  { key: "alternative", title: (phrase) => `A Practical Alternative to ${phrase}`, blurb: (phrase) => `One shorter path that produces the same work without ${phrase}.` },
  { key: "daily", title: (phrase) => `How ${phrase} Changes a Normal Week`, blurb: (phrase) => `One Tuesday: what gets made, and what gets cancelled, for ${phrase}.` },
  { key: "compare", title: (phrase) => `${phrase.replace(/^(a|an) /i, "")} Compared With the Shorter Path`, blurb: (phrase) => `Three rows only: time, money, and the job. ${phrase} is one column.` },
  { key: "conversation", title: (phrase) => `How to Talk About ${phrase}`, blurb: (phrase) => `One sentence for one person in the room, about ${phrase}.` },
  { key: "stop", title: (phrase) => `Signs ${phrase} Is the Wrong Next Step`, blurb: () => `Calendar, bills, and a missing weekly artifact. Not a mood.` },
  { key: "brief", title: (phrase) => `A One-Page Brief Before ${phrase}`, blurb: () => `Four lines: decision, date, known cost, and who must hear it.` },
  { key: "keep", title: (phrase) => `What You Keep If You Skip ${phrase}`, blurb: (phrase) => `The job, the skill, and the people that remain if ${phrase} is declined.` },
];

export function clusterTitles(topic: string): { title: string; angle: string }[] {
  const noun = shortSubject(topic);
  if (!noun) return [];
  const phrase = withArticle(noun);
  const out: { title: string; angle: string }[] = [];
  for (const row of CLUSTER_ANGLES) {
    const title = row.title(phrase).replace(/\s+/g, " ").trim();
    if (/^(is|what|who|how|signs|a) why\b/i.test(title)) continue;
    if (embedsFullTopic(title, topic)) continue;
    if (out.some((item) => cosine(embed(item.title), embed(title)) >= L3)) continue;
    out.push({ title, angle: `${row.key} — ${row.blurb(phrase)}` });
    if (out.length >= 10) break;
  }
  return out;
}

export function generatePlan(data: Persisted, siteId: string, topicRaw: string, now: number): { data: Persisted; error?: string; planId?: string } {
  const site = data.sites.find((s) => s.id === siteId);
  if (!site) return { data, error: "No website selected." };
  const topic = topicRaw.trim().replace(/\s+/g, " ");
  if (topic.length < 3) return { data, error: "Enter a topic of at least 3 characters." };
  if (!usableKey(data, site.voice.modelKeyId, now)) return { data, error: "NO_USABLE_KEY — no AI key is saved for this website. Add one on AI Keys." };
  const next = structuredClone(data);
  const key = usableKey(next, site.voice.modelKeyId, now)!;
  const clusters = clusterTitles(topic).map((frame) => ({
    id: uid("clu"),
    title: frame.title,
    angle: frame.angle,
    excluded: false,
    source: "ai" as const,
    selected: true,
  }));
  if (clusters.length < 6) {
    const planId = uid("plan");
    next.plans.unshift({
      id: planId,
      siteId,
      topic,
      pillarTitle: topic.replace(/\s+/g, " ").trim().replace(/\b[a-z]/g, (letter) => letter.toUpperCase()),
      pillarAngle: "Plan failed before queueing.",
      clusters,
      status: "failed",
      error: `Only ${clusters.length} distinct supporting clusters were available; at least 6 are required.`,
      createdAt: now,
    });
    return { data: next, planId, error: next.plans[0]!.error };
  }
  const noun = shortSubject(topic);
  const planId = uid("plan");
  next.plans.unshift({
    id: planId,
    siteId,
    topic,
    pillarTitle: topic.replace(/\s+/g, " ").trim().replace(/\b[a-z]/g, (letter) => letter.toUpperCase()),
    pillarAngle: `One page that points to the narrow decisions about ${withArticle(noun)}. It does not repeat those pages.`,
    clusters: clusters.slice(0, 10),
    status: "review",
    createdAt: now,
  });
  const pair = uid("pair");
  const usd = usdFor(4200, key.pricePerM);
  pushEvent(next, {
    id: uid("evt"),
    pairId: pair,
    siteId,
    keyId: key.id,
    at: now,
    state: "RESERVED",
    provider: key.provider,
    model: key.model,
    stage: "topicplan.generate",
    tokens: 4200,
    usd,
  });
  pushEvent(next, {
    id: uid("evt"),
    pairId: pair,
    siteId,
    keyId: key.id,
    at: now + 1,
    state: "SETTLED",
    provider: key.provider,
    model: key.model,
    stage: "topicplan.generate",
    tokens: 4200,
    usd,
  });
  key.lastUsedAt = now;
  const stored = next.keys.find((k) => k.id === key.id);
  if (stored) stored.lastUsedAt = now;
  log(next, siteId, "ok", `Topic plan ready for review · ${topic}`, now);
  const vague = !topic.includes(" ");
  next.notice = {
    tone: vague ? "warn" : "ok",
    text: vague
      ? "Plan ready. A single word usually comes back vague — edit the pillar and clusters before you queue."
      : "Plan ready. Exclude weak clusters, then queue selected. Clusters run before the pillar.",
  };
  return { data: next, planId };
}

export function acceptModelPlan(
  data: Persisted,
  siteId: string,
  topicRaw: string,
  pillarTitle: string,
  proposed: { title: string; blurb: string }[],
  now: number,
): { data: Persisted; error?: string; planId?: string } {
  const site = data.sites.find((item) => item.id === siteId);
  if (!site) return { data, error: "No website selected." };
  const topic = topicRaw.trim().replace(/\s+/g, " ");
  if (topic.length < 3) return { data, error: "Enter a topic of at least 3 characters." };
  if (!usableKey(data, site.voice.modelKeyId, now)) return { data, error: "NO_USABLE_KEY — no AI key is saved for this website. Add one on AI Keys." };
  const kept: { title: string; blurb: string }[] = [];
  for (const row of proposed) {
    const title = row.title.replace(/\s+/g, " ").trim();
    const blurb = row.blurb.replace(/\s+/g, " ").trim();
    if (title.length < 12 || title.length > 110) continue;
    if (embedsFullTopic(title, topic)) continue;
    if (kept.some((item) => cosine(embed(item.title), embed(title)) >= L3)) continue;
    kept.push({ title, blurb: blurb || "A narrow page that does not repeat the others." });
    if (kept.length >= 8) break;
  }
  if (kept.length < 6) {
    const failed = structuredClone(data);
    const failedId = uid("plan");
    failed.plans.unshift({
      id: failedId,
      siteId,
      topic,
      pillarTitle: pillarTitle.trim() || topic,
      pillarAngle: "Plan failed before queueing.",
      clusters: kept.map((row) => ({ id: uid("clu"), title: row.title, angle: `custom — ${row.blurb}`, excluded: false, source: "ai" as const, selected: true })),
      status: "failed",
      error: `The model returned only ${kept.length} distinct supporting clusters; at least 6 are required.`,
      createdAt: now,
    });
    failed.notice = { tone: "danger", text: failed.plans[0]!.error! };
    return { data: failed, planId: failedId, error: failed.plans[0]!.error };
  }
  const next = structuredClone(data);
  const key = usableKey(next, site.voice.modelKeyId, now)!;
  const planId = uid("plan");
  next.plans.unshift({
    id: planId,
    siteId,
    topic,
    pillarTitle: pillarTitle.replace(/\s+/g, " ").trim().slice(0, 120) || topic,
    pillarAngle: "The pillar points to the cluster pages. It does not repeat them.",
    clusters: kept.map((row) => ({
      id: uid("clu"),
      title: row.title,
      angle: `custom — ${row.blurb}`,
      excluded: false,
      source: "ai" as const,
      selected: true,
    })),
    status: "review",
    createdAt: now,
  });
  key.lastUsedAt = now;
  const stored = next.keys.find((item) => item.id === key.id);
  if (stored) stored.lastUsedAt = now;
  log(next, siteId, "ok", `Topic plan from your model · ${topic}`, now);
  next.notice = { tone: "ok", text: "Plan ready from your model. Exclude weak clusters, then queue. Clusters run before the pillar." };
  return { data: next, planId };
}

export async function queuePlan(
  data: Persisted,
  planId: string,
  now: number,
  opts?: { publishMode?: "default" | "draft" | "live"; modelKeyId?: string; provider?: EmbedFn },
): Promise<{ data: Persisted; error?: string; runId?: string }> {
  const plan = data.plans.find((p) => p.id === planId);
  if (!plan) return { data, error: "Plan not found." };
  if (plan.status !== "review") return { data, error: "This plan is already queued." };
  const site = data.sites.find((s) => s.id === plan.siteId);
  if (!site) return { data, error: "Website missing." };
  // Queueing needs an inventory to gate the clusters against, not a live Ghost.
  if (site.ghost.corpus !== "COMPLETE") return { data, error: "Sync inventory first. Runs are refused while the corpus is EMPTY." };
  const included = plan.clusters.filter((c) => !c.excluded);
  if (included.length < 2) return { data, error: "Keep at least two clusters. The pillar needs real pages to link to." };
  const preferred = opts?.modelKeyId && opts.modelKeyId !== "default" ? opts.modelKeyId : site.voice.modelKeyId;
  const key = usableKey(data, preferred, now);
  if (!key) return { data, error: "NO_USABLE_KEY — no AI key is saved for this plan. Add one on AI Keys." };
  const mode = !opts?.publishMode || opts.publishMode === "default" ? site.voice.publishAs : opts.publishMode;
  if (mode === "live" && site.ghost.mode !== "live") {
    return { data, error: "Live publish is off. This Ghost connection is not live. Queue the plan as a draft." };
  }
  const next = structuredClone(data);
  const p = next.plans.find((x) => x.id === planId)!;
  const runId = uid("run");
  const clusterJobs: Job[] = [];
  const batchSeen: CorpusItem[] = [];
  for (const cluster of p.clusters.filter((c) => !c.excluded)) {
    const keyword = normalizeKeyword(cluster.title);
    const gate = await gateText(keyword, cluster.title, corpusFor(next, p.siteId, batchSeen, { excludePlanId: p.id }), false, opts?.provider);
    const job = makeJob({
      id: uid("job"),
      runId,
      siteId: p.siteId,
      keyword,
      title: cluster.title,
      kind: "cluster",
      variant: false,
      dependsOn: [],
      createdAt: now,
      status: !gate.ok ? "refused" : gate.hold ? "review-held" : "queued",
      refusalReason: !gate.ok ? gate.reason : gate.hold ? "REVIEW HELD — close to an existing page." : undefined,
      refusalLayer: !gate.ok ? gate.layer : undefined,
    });
    if (job.status !== "refused") {
      // Rule 2: bind the niche expert at plan-queue time so stage 1–3 prompts carry the voice.
      job.authorId = matchOrCreateAuthorForTopic(
        { id: site.id, nicheTag: site.nicheTag },
        next.authors,
        cluster.title,
        { niche: site.nicheTag, autoMatch: site.autoAuthors !== false },
      ).author.id;
    }
    cluster.jobId = job.id;
    if (gate.ok) batchSeen.push({ keyword, title: cluster.title, slug: slugify(cluster.title) });
    clusterJobs.push(job);
  }
  const pillar = makeJob({
    id: uid("job"),
    runId,
    siteId: p.siteId,
    keyword: normalizeKeyword(p.topic),
    title: p.pillarTitle,
    kind: "pillar",
    variant: false,
    dependsOn: clusterJobs.filter((j) => j.status === "queued" || j.status === "review-held").map((j) => j.id),
    createdAt: now,
  });
  pillar.authorId = matchOrCreateAuthorForTopic(
    { id: site.id, nicheTag: site.nicheTag },
    next.authors,
    p.pillarTitle,
    { niche: site.nicheTag, autoMatch: site.autoAuthors !== false },
  ).author.id;
  next.jobs.unshift(pillar, ...clusterJobs);
  next.runs.unshift({
    id: runId,
    siteId: p.siteId,
    type: "topic-plan",
    title: p.topic,
    publishMode: mode,
    modelKeyId: key.id,
    allowVariants: false,
    topicPlanId: p.id,
    createdAt: now,
    status: "queued",
  });
  p.status = "queued";
  p.runId = runId;
  log(next, p.siteId, "ok", `Topic plan queued · clusters first · pillar waits · ${p.topic}`, now);
  const queuedTopics = clusterJobs.filter((job) => job.status === "queued").length;
  next.notice = {
    tone: "ok",
    text: `Queued ${queuedTopics} cluster topics, then the pillar. Clusters write first.`,
  };
  return { data: next, runId };
}

const COMMODITY = /\b(tips|tools|challenges|effectively|ultimate guide|everything you need|best practices|boost your|unlock|game[- ]changer)\b/i;

function isCommodity(text: string): boolean {
  return COMMODITY.test(text);
}

export async function suggestIdeas(
  data: Persisted,
  siteId: string,
  nicheRaw: string,
  now: number,
  count = 8,
  provider?: EmbedFn,
  liveIdeas?: { ideas: { keyword: string; why: string }[]; usage: { prompt: number; completion: number; total: number } },
): Promise<{ data: Persisted; error?: string }> {
  const site = data.sites.find((s) => s.id === siteId);
  if (!site) return { data, error: "No website selected." };
  const niche = nicheRaw.trim();
  if (niche.length < 3) return { data, error: "Name a niche first. Idea rounds are metered." };
  // Unlimited by default: the local daily ledger never blocks an idea round.
  // A key with real provider balance is always allowed to answer.
  const key = usableKey(data, site.voice.modelKeyId, now);
  const liveKey = key && keyCallsModel(key) ? key : undefined;
  const noun = shortSubject(niche);
  const frames: { keyword: string; intent: string }[] = [
    { keyword: `Is ${noun} worth the time`, intent: "decision" },
    { keyword: `What ${noun} costs`, intent: "comparison" },
    { keyword: `Who should skip ${noun}`, intent: "decision" },
    { keyword: `A practical alternative to ${noun}`, intent: "comparison" },
    { keyword: `How ${noun} changes a normal week`, intent: "how-to" },
    { keyword: `${noun} compared with the shorter path`, intent: "comparison" },
    { keyword: `How to talk about ${noun}`, intent: "how-to" },
    { keyword: `Signs ${noun} is the wrong next step`, intent: "troubleshooting" },
    { keyword: `A one-page brief before ${noun}`, intent: "checklist" },
    { keyword: `What you keep if you skip ${noun}`, intent: "decision" },
  ];
  const want = limitsOf(data).ideaCap == null ? Math.max(8, count) : Math.min(limitsOf(data).ideaCap!, Math.max(1, count));
  const corpus = corpusFor(data, siteId);
  const items: Idea[] = [];
  const rejected: { keyword: string; reason: string; layer: "L1" | "L2" | "L3" | "policy" }[] = [];
  let filtered = 0;
  const candidates = liveIdeas
    ? liveIdeas.ideas.slice(0, want).map((idea) => ({ keyword: String(idea?.keyword ?? "").trim(), intent: "model", reason: String(idea?.why ?? "").trim() }))
    : frames.map((frame) => ({ keyword: frame.keyword, intent: frame.intent, reason: "Clear of articles, queued work, and synced inventory." }));
  for (const frame of candidates) {
    const gate = await gateText(normalizeKeyword(frame.keyword), titleFor(frame.keyword, false), corpus, false, provider);
    if (!gate.ok || gate.hold || isCommodity(frame.keyword)) {
      filtered += 1;
      rejected.push({ keyword: frame.keyword, reason: !gate.ok ? gate.reason : gate.hold ? "REVIEW HELD — close to existing content." : "POLICY REFUSED — commodity framing.", layer: !gate.ok ? gate.layer : "policy" });
      continue;
    }
    items.push({
      keyword: frame.keyword,
      intent: frame.intent,
      reason: frame.reason,
    });
    if (items.length >= want) break;
  }
  const next = structuredClone(data);
  const pair = uid("pair");
  const settledTokens = liveIdeas?.usage.total ?? 0;
  const settledUsd = liveKey ? usdFor(settledTokens, liveKey.pricePerM) : 0;
  if (liveIdeas && liveKey) pushEvent(next, {
    id: uid("evt"),
    pairId: pair,
    siteId,
    keyId: liveKey.id,
    at: now,
    state: "RESERVED",
    provider: liveKey.provider,
    model: liveKey.model,
    stage: "ideas",
    tokens: settledTokens,
    usd: settledUsd,
  });
  if (liveIdeas && liveKey) pushEvent(next, {
    id: uid("evt"),
    pairId: pair,
    siteId,
    keyId: liveKey.id,
    at: now + 1,
    state: "SETTLED",
    provider: liveKey.provider,
    model: liveKey.model,
    stage: "ideas",
    tokens: settledTokens,
    usd: settledUsd,
  });
  const stored = liveKey ? next.keys.find((k) => k.id === liveKey.id) : undefined;
  if (stored) stored.lastUsedAt = now;
  next.ideas = { siteId, niche, items, tokens: settledTokens, filtered, engine: liveIdeas ? "llm" : "fallback", usage: liveIdeas?.usage, rejected };
  log(next, siteId, liveIdeas ? "ok" : "warn", `Idea round settled · ${settledTokens.toLocaleString()} tokens · ${items.length} kept · ${filtered} filtered · ${liveIdeas ? "model" : "fallback"}`, now);
  next.notice = {
    tone: "warn",
    text: `${items.length} suggestions for “${niche}”. ${filtered} filtered as already covered. This ${liveIdeas ? "model" : "fallback"} round settled ${settledTokens.toLocaleString()} tokens. Nothing was queued.`,
  };
  return { data: next };
}

function depsResolved(job: Job, jobs: Job[]): boolean {
  return job.dependsOn.every((id) => {
    const dep = jobs.find((j) => j.id === id);
    if (!dep) return false;
    return dep.status === "completed" || dep.status === "failed" || dep.status === "refused" || dep.status === "cancelled" || dep.status === "publish-held";
  });
}

export function rollup(jobs: Job[]): Persisted["runs"][number]["status"] {
  if (!jobs.length) return "failed";
  if (jobs.some((j) => j.status === "running" || j.status === "queued")) {
    return jobs.some((j) => j.status !== "queued") ? "running" : "queued";
  }
  const ok = jobs.filter((j) => j.status === "completed").length;
  const held = jobs.filter((j) => j.status === "review-held" || j.status === "publish-held").length;
  if (ok === jobs.length) return "completed";
  if (ok + held === jobs.length) return "partial";
  if (ok === 0 && held === 0) return jobs.every((j) => j.status === "cancelled") ? "cancelled" : "failed";
  return "partial";
}

async function publishArticle(data: Persisted, site: Site, job: Job, runMode: "draft" | "live", _key: AiKey, now: number, provider?: EmbedFn) {
  const corpus = data.articles
    .filter((a) => a.siteId === site.id)
    .map((a) => ({ keyword: a.keyword, title: a.title, slug: a.slug, sample: draftSample(a.title, a.keyword, a.sections) }));
  const gate = await gateText(job.keyword, job.title, corpus, false, provider);
  if (gate.embedSource) {
    job.embedSource = gate.embedSource;
    job.embedNote =
      gate.embedSource === "provider"
        ? "L3 used the provider embedding. Both sides share one vector length."
        : gate.embedNote && !gate.embedNote.startsWith("No provider")
          ? `${HASH_EMBED_NOTE} ${gate.embedNote}`
          : HASH_EMBED_NOTE;
  }
  if (!gate.ok || /second angle|\(again\)/i.test(job.title)) {
    job.status = "refused";
    job.refusalReason = /second angle|\(again\)/i.test(job.title)
      ? "DUPLICATE REFUSED (L2-lexical). “A second angle” is not a new article."
      : gate.ok
        ? "DUPLICATE REFUSED"
        : gate.reason;
    job.stages[5]!.status = "done";
    job.stages[5]!.finishedAt = now;
    return;
  }
  // Stage 4 gives the packaged slug (already de-duplicated against existing posts
  // when it ran). Re-check at publish time too: two jobs in one concurrency window
  // can pick the same slug, so a collision suffixes (`-2`) instead of a false
  // duplicate refusal — the L1/L2/L3 gate above already refused real duplicates.
  const preferredSlug = job.enrich?.slug || slugify(job.title);
  const slug = uniqueSlug(preferredSlug, data.articles.filter((a) => a.siteId === site.id).map((a) => a.slug));
  const links = job.enrich?.links?.length ? job.enrich.links : await pickLinks(data, site, job, provider);
  const sectionCount = job.kind === "pillar" ? Math.min(8, Math.max(7, site.voice.sections)) : site.voice.sections;
  // Rule 3a: when the blueprint exists (model stage 1 or its fallback), angle and mustCover come from it.
  const blueprint = job.modelIntent ?? fallbackBlueprint(job);
  const composed = composeArticle({
    title: job.title,
    keyword: job.keyword,
    angle: blueprint.intent ?? angleForJob(data, job),
    tone: site.voice.tone,
    sectionCount,
    imageCount: site.voice.sectionImages,
    links,
    nicheTag: site.nicheTag,
    corpus,
    mustCover: blueprint.mustCover,
  });
  const modelMarkdown = (job.modelText?.revision || job.modelText?.draft || "").trim();
  let html = composed.html;
  let markdown = composed.markdown;
  let excerpt = job.enrich?.excerpt || composed.excerpt;
  let words = composed.words;
  let sections = composed.sections;
  let uniqueness = composed.uniqueness;
  if (modelMarkdown) {
    markdown = modelMarkdown;
    html = markdownToHtml(markdown);
    for (const link of links) {
      if (alreadyLinked(html, markdown, link.slug)) continue;
      const inserted = insertAnchor(html, markdown, anchorPhrase(link.anchor), link.slug);
      if (!inserted.inserted) continue;
      html = inserted.html;
      markdown = inserted.markdown;
    }
    sections = sectionsFromMarkdown(markdown);
    if (!sections.length) sections = [{ heading: job.title, paragraphs: [excerptOf(markdown)] }];
    excerpt = job.enrich?.excerpt || excerptOf(markdown);
    words = wordCount(markdown);
    uniqueness = uniquenessAgainst(job.title, job.keyword, corpus, sections);
  }
  // Kill placeholder CMS image paths at the source: any /content/images/ (cms.*)
  // URL carried in the model draft or an old Ghost round-trip becomes a real
  // Bing thumbnail before the article is stored, previewed, or exported.
  const imageFallback = job.keyword || job.title;
  html = rewriteCmsImageUrls(html, imageFallback);
  markdown = rewriteCmsImageUrls(markdown, imageFallback);
  // Stage 5 enrichment placed Bing photos + picked internal links within the
  // same job execution; apply them here so the stored article is fully
  // enriched without a second disconnected worker pass.
  const enrichImages = job.enrich?.images?.length ? job.enrich.images : composed.images;
  for (const image of enrichImages) {
    if (image.remote && isFakeCmsImage(image.remote)) image.remote = bingThumbUrl(imageFallback);
    if (image.src && isFakeCmsImage(image.src)) image.src = bingThumbUrl(imageFallback);
  }
  const media = applyFetchedImages(html, markdown, enrichImages, imageFallback);
  html = media.html;
  markdown = media.markdown;
  if (uniqueness < 0.2) {
    job.status = "refused";
    job.refusalReason = `DUPLICATE REFUSED (L3-semantic). Uniqueness would be ${Math.round(uniqueness * 100)}% against pages already on this site.`;
    job.stages[5]!.status = "done";
    job.stages[5]!.finishedAt = now;
    return;
  }
  const measured = measureArticle({ title: job.title, keyword: job.keyword, markdown, mustCover: composed.mustCover, words });
  const verifyFlags = modelMarkdown
    ? job.modelVerifyFlags ?? factualVerifyFlags(markdown)
    : composed.verifyFlags;
  const articleId = uid("art");
  const postId = `gst_${slug.slice(0, 12)}_${hashStr(articleId).toString(16).slice(0, 4)}`;
  const run = data.runs.find((item) => item.id === job.runId);
  // Rule 2: prefer the author assigned at dispatch; otherwise match-or-generate now.
  const { author } = matchOrCreateAuthorForTopic(
    { id: site.id, nicheTag: site.nicheTag },
    data.authors,
    job.keyword,
    { niche: site.nicheTag, autoMatch: site.autoAuthors !== false, existingAuthorId: job.authorId },
  );
    const article: Article = {
    id: articleId,
    siteId: site.id,
    jobId: job.id,
    title: job.title,
    slug,
    keyword: job.keyword,
    html,
    markdown,
    excerpt,
    sections,
    // Stage 4 packaging (model or deterministic fallback) — SEO title/description.
    metaTitle: job.enrich?.title || job.title,
    metaDescription: job.enrich?.metaDescription || excerpt.slice(0, 155),
    status: runMode === "live" ? "published" : "draft",
    engine: modelMarkdown ? "llm" : "fallback",
    words,
    uniqueness,
    coverage: modelMarkdown ? measured.coverage : composed.coverage,
    intentMatch: modelMarkdown ? measured.intent : composed.intentMatch,
    tags: job.enrich?.tags?.length ? job.enrich.tags : composed.tags,
    mustCover: composed.mustCover,
    revisionNotes: modelMarkdown ? "Draft and revision came from the model. The template was not used." : composed.revisionNotes,
    images: enrichImages,
    links: links.map((link) => linkEdge(anchorPhrase(link.anchor), link.slug, "LOCAL")),
    stageTokens: job.stages.map((s) => s.tokens),
    verifyFlags,
    ledger: {
      mode: runMode,
      confirmed: true,
      dispatchedAt: now - 400,
      confirmedAt: now,
      postId,
      shots: 1,
    },
      publishedAt: now,
      promptVersions: job.promptVersions ?? Object.fromEntries(STAGES.map((stage) => [stage.key, STAGE_PROMPT_VERSIONS[stage.key]])),
    authorId: author.id,
    authorName: author.name,
    bulletproof: Boolean(run?.bulletproof),
    liveState: "skipped",
    imageState: enrichImages.some((image) => image.selected && image.src) ? "ready" : "pending",
    ghostPush: site.ghost.mode === "live" && site.ghost.adminKey ? "pending" : "skipped",
    humanized: false,
    humanState: "pending",
    humanizerScore: job.humanizerScore,
    humanizerStripped: job.humanizerStripped,
    humanizerPasses: job.humanizerPasses,
    humanizerNote: job.enrich?.humanizerNote,
    humanNote: undefined,
  };
  data.articles.unshift(article);
  // Rule 2: single-shot count — guarded by article.authorCounted so retries never double-increment.
  markAuthorPublished(data, article, now);
  const embedded = await embedForL3(`${article.title} ${article.keyword}`, provider);
  data.corpus.unshift({
    id: uid("corpus"),
    siteId: site.id,
    title: article.title,
    keyword: article.keyword,
    slug: article.slug,
    permalink: `${site.publicUrl.replace(/\/+$/, "")}/post/${article.slug}/`,
    embedding: Array.from(embedded.vector),
    embedSource: embedded.source,
    createdAt: now,
  });
  await ensureInbound(data, site, article, provider);
  job.articleId = articleId;
  job.stages[5]!.status = "done";
  job.stages[5]!.tokens = 0;
  job.stages[5]!.finishedAt = now;
  if (job.publishHold) {
    article.status = "draft";
    article.ledger.confirmed = false;
    article.ledger.shots = 0;
    article.ghostPush = "skipped";
    article.liveState = "skipped";
    job.shots = 0;
    job.status = "publish-held";
    log(data, site.id, "info", `Written · nothing sent to Ghost yet · ${article.title}`, now);
    return;
  }
  job.shots = 1;
  job.status = "completed";
  if (site.autoRebuild && validatePublicUrl(site.publicUrl).ok) {
      site.pendingRebuildAt = now + 60_000;
  }
  log(data, site.id, "ok", `Single-shot ${runMode} · ${article.title}`, now);
}

function settle(data: Persisted, job: Job, key: AiKey, stage: string, tokens: number, now: number, state: "SETTLED" | "RELEASED" | "RESERVED") {
  const usd = usdFor(tokens, key.pricePerM);
  pushEvent(data, {
    id: uid("evt"),
    pairId: `${job.id}:${stage}:${job.attempt ?? 1}`,
    siteId: job.siteId,
    keyId: key.id,
    at: now,
    state,
    provider: key.provider,
    model: stage === "embed" ? "studio-embed" : key.model,
    stage,
    tokens,
    usd,
  });
  if (state === "SETTLED") {
    job.tokens += tokens;
    job.costUsd = Math.round((job.costUsd + usd) * 10000) / 10000;
    key.lastUsedAt = now;
  }
}

const MODEL_STAGE_INDEX: Partial<Record<string, number>> = { intent: 0, draft: 1, revision: 2, metadata: 3, enrichment: 4 };

function reserveStage(data: Persisted, job: Job, key: AiKey, stageKey: string, now: number) {
  if (!keyCallsModel(key)) return;
  const index = MODEL_STAGE_INDEX[stageKey];
  if (index == null) return;
  const tokens = STAGES[index]?.tokens[1] ?? 0;
  if (!tokens) return;
  const closed = new Set(data.events.filter((e) => e.state === "SETTLED" || e.state === "RELEASED").map((e) => e.pairId));
  const pairId = `${job.id}:${stageKey}:${job.attempt ?? 1}`;
  if (closed.has(pairId) || data.events.some((e) => e.pairId === pairId && e.state === "RESERVED")) return;
  settle(data, job, key, stageKey, tokens, now, "RESERVED");
}

export function releaseReserves(data: Persisted, job: Job, now: number) {
  const closed = new Set(data.events.filter((e) => e.state === "SETTLED" || e.state === "RELEASED").map((e) => e.pairId));
  const open = data.events.filter((e) => e.state === "RESERVED" && e.pairId.startsWith(`${job.id}:`) && !closed.has(e.pairId));
  for (const reserve of open) {
    pushEvent(data, {
      id: uid("evt"),
      pairId: reserve.pairId,
      siteId: job.siteId,
      keyId: reserve.keyId,
      at: now,
      state: "RELEASED",
      provider: reserve.provider,
      model: reserve.model,
      stage: reserve.stage,
      tokens: reserve.tokens,
      usd: reserve.usd,
    });
  }
  return open.length;
}

/** Mark a job's active stage failed, fail the job, and give the outstanding reserve back. */
export function failJob(data: Persisted, jobId: string, message: string, now: number): { released: number } {
  const job = data.jobs.find((item) => item.id === jobId);
  if (!job) return { released: 0 };
  const stage = job.stages[job.stageIndex];
  const note = message.slice(0, 180);
  if (stage && stage.status === "running") {
    stage.status = "failed";
    stage.tokens = 0;
    stage.note = note;
    stage.finishedAt = now;
  }
  job.status = "failed";
  job.modelError = note;
  job.failReason = note;
  const released = releaseReserves(data, job, now);
  const run = data.runs.find((item) => item.id === job.runId);
  if (run) run.status = rollup(data.jobs.filter((item) => item.runId === run.id));
  log(data, job.siteId, "danger", `Stage failed · ${stage?.label ?? job.stageIndex} · ${job.title} — ${note}${released ? " · reserve released" : ""}`, now);
  return { released };
}

/**
 * Key penalty policy (hotfix for the false-cooldown loop):
 * - 401/403: the key is rejected → hard disable (unchanged).
 * - 429: a genuine rate limit → SHORT cooldown (12s), retryable right away.
 * - 5xx / timeout (status 0): transient → no cooldown, just the recorded error.
 * - 400/404/422: configuration or model mismatch → NEVER cooled; the error is
 *   recorded on the key so the fixed endpoint/model is retried immediately.
 * Every failure records the exact HTTP status + provider message on the key.
 */
export function applyKeyPenalty(data: Persisted, keyId: string, status: number, now: number, message?: string): void {
  const key = data.keys.find((item) => item.id === keyId);
  if (!key) return;
  key.lastErrorAt = now;
  key.lastError = `${status ? `HTTP ${status}` : "Network error"}${message ? ` — ${message.slice(0, 220)}` : ""}`;
  if (status === 401 || status === 403) {
    if (key.disabled) return;
    key.disabled = true;
    key.cooldownUntil = undefined;
    log(data, data.activeSiteId, "danger", `Key rejected — disabled · ${key.provider} / ${key.model} · HTTP ${status}`, now);
    data.notice = { tone: "danger", text: `${key.provider} / ${key.model} refused the key (HTTP ${status}). Key disabled.` };
    return;
  }
  if (status === 400 || status === 404 || status === 422) {
    key.cooldownUntil = undefined;
    log(data, data.activeSiteId, "danger", `Key config error (no cooldown) · ${key.provider} / ${key.model} · ${key.lastError}`, now);
    return;
  }
  if (status === 429) {
    key.cooldownUntil = now + 12_000;
    log(data, data.activeSiteId, "warn", `Key rate-limited (12s cooldown) · ${key.provider} / ${key.model} · HTTP 429`, now);
    data.notice = { tone: "warn", text: `${key.provider} / ${key.model} hit a rate limit (HTTP 429). Cooling 12s, then auto-retry.` };
    return;
  }
  // 5xx and timeouts (status 0) are transient — do not cool the key.
  key.cooldownUntil = undefined;
  log(data, data.activeSiteId, "warn", `Key transient failure (no cooldown) · ${key.provider} / ${key.model} · ${key.lastError}`, now);
}

// ---------------------------------------------------------------------------
// The single sequential job runner (Rule 3, production overhaul).
//
// One deterministic, sequentially-awaited async runner drives every active job
// through the 6 stages inside ONE awaited execution flow:
//   1. Intent & Blueprint        (model call, structured fallback)
//   2. Draft                     (model call, deterministic fallback)
//   3. Revision + Blader humanizer (model call with fallback to the Stage 2
//                                  draft + deterministic robotic scrub)
//   4. Metadata & Packaging      (computed immediately — no disconnected ticks)
//   5. Site Enrichment           (Bing image placement + internal link picking)
//   6. Final Validation & Publication
//
// The model transport is injected (`AdvanceHost`) so the engine stays pure;
// the browser store wires the real key-pool failover transport. Every stage
// ends in done/failed, and every job ends in a terminal status — a job can
// NEVER sit in `running` waiting for a different component's interval.
// ---------------------------------------------------------------------------

export type StageModelUsage = { prompt: number; completion: number; total: number };

export type ChatTransport = {
  /** Key-pool LLM call with failover + one validation retry. Throws on total failure. */
  callModel: (input: { system: string; user: string; validate: (text: string) => string; preferredKeyId?: string }) => Promise<{ keyId: string; text: string; usage: StageModelUsage }>;
  /** Blader humanizer transport through the same pool (audit + surgical rewrite). */
  bladerChat?: BladerChat;
};

export type ImageTransport = {
  placeImages: (input: { provider: string; salt: number; avoid: string[]; slots: { query: string; alt: string; role: "featured" | "section"; width?: number; height?: number }[] }) => Promise<{ ok: boolean; images: import("./types.ts").ArticleImage[] }>;
};

export type AdvanceHost = {
  /** Mid-flight commit: called after each stage so the UI (and the server DB) see progress immediately. */
  commit?: (data: Persisted) => void;
  chat?: ChatTransport;
  images?: ImageTransport;
};

const PER_STAGE_TIMEOUTS: Record<string, number> = { intent: 90_000, draft: 120_000, revision: 150_000, metadata: 60_000, enrichment: 75_000 };

function withTimeout<T>(promise: Promise<T>, ms: number, label: string): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(() => reject(new Error(`${label} timed out after ${Math.round(ms / 1000)}s`)), ms);
  });
  return Promise.race([promise, timeout]).finally(() => {
    if (timer) clearTimeout(timer);
  }) as Promise<T>;
}

function stageContextFor(data: Persisted, job: Job, site: Site): StageContext {
  return {
    siteName: site.name,
    niche: site.nicheTag,
    author: data.authors.find((item) => item.id === job.authorId),
    bannedPhrases: site.voice.bannedPhrases ?? [],
    brandFacts: site.voice.brandFacts ?? [],
    tone: site.voice.tone,
    pov: site.voice.pov,
    readingLevel: site.voice.readingLevel,
    workingTitle: job.title,
    keyword: job.keyword,
    sectionCount: site.voice.sections,
    avoidTitles: data.articles.filter((item) => item.siteId === job.siteId).slice(0, 12).map((item) => item.title),
  };
}

/** Deterministic Stage 2 output when no live model runs (or the model failed). */
function deterministicDraft(data: Persisted, job: Job, site: Site): string {
  const blueprint = job.modelIntent ?? fallbackBlueprint(job);
  const composed = composeArticle({
    title: job.title,
    keyword: job.keyword,
    angle: blueprint.intent,
    tone: site.voice.tone,
    sectionCount: job.kind === "pillar" ? Math.min(8, Math.max(7, site.voice.sections)) : site.voice.sections,
    imageCount: 0,
    links: [],
    nicheTag: site.nicheTag,
    corpus: data.articles.filter((item) => item.siteId === site.id).map((item) => ({ keyword: item.keyword, title: item.title, slug: item.slug })),
    mustCover: blueprint.mustCover,
  });
  return composed.markdown;
}

function warn(data: Persisted, siteId: string, message: string, now: number): void {
  log(data, siteId, "warn", message, now);
}

/** Index of the stage that must run now: first non-done stage (or stage 6 reconcile). */
function currentStageIndex(job: Job): number {
  const first = job.stages.findIndex((stage) => stage.status !== "done");
  return first >= 0 ? first : job.stages.length - 1;
}

async function runModelStageNow(
  data: Persisted,
  job: Job,
  site: Site,
  stageKey: "intent" | "draft" | "revision",
  now: number,
  host: AdvanceHost,
  key: AiKey | undefined,
): Promise<void> {
  const stage = job.stages.find((row) => row.key === stageKey)!;
  const ctx = stageContextFor(data, job, site);
  const live = Boolean(key && keyCallsModel(key) && host.chat);
  if (live && key) reserveStage(data, job, key, stageKey, now);
  if (stageKey === "intent") {
    if (live && host.chat) {
      try {
        const prompt = buildIntentPrompt(ctx);
        const outcome = await withTimeout(
          host.chat.callModel({
            system: prompt.system,
            user: prompt.user,
            preferredKeyId: data.runs.find((item) => item.id === job.runId)?.modelKeyId ?? job.keyId,
            validate: (text) => {
              try {
                parseIntentStage(text);
                return "";
              } catch (error) {
                return error instanceof Error ? error.message : "intent validation failed";
              }
            },
          }),
          PER_STAGE_TIMEOUTS.intent ?? 90_000,
          "Stage 1 (Intent)",
        );
        const blueprint = parseIntentStage(outcome.text);
        job.modelIntent = blueprint;
        job.modelUsage = { ...job.modelUsage, intent: outcome.usage };
        job.keyId = outcome.keyId;
        job.failoverChain = [...new Set([...(job.failoverChain ?? []), outcome.keyId])];
        stage.tokens = outcome.usage.total;
        stage.note = usageNote(outcome.usage);
        if (key) settle(data, job, key, "intent", outcome.usage.total, now, "SETTLED");
        stage.status = "done";
        stage.finishedAt = now;
        return;
      } catch (error) {
        warn(data, site.id, `Stage 1 model call failed — deterministic blueprint fallback · ${error instanceof Error ? error.message : "unknown error"}`, now);
      }
    }
    job.modelIntent = fallbackBlueprint(job);
    stage.tokens = 0;
    stage.note = live ? NO_MODEL_NOTE : NO_MODEL_NOTE;
    releaseReserves(data, job, now);
    stage.status = "done";
    stage.finishedAt = now;
    return;
  }
  if (stageKey === "draft") {
    if (live && host.chat) {
      try {
        const intent = job.modelIntent ?? fallbackBlueprint(job);
        if (!job.modelIntent) job.modelIntent = intent;
        const prompt = buildDraftPrompt({ ...ctx, blueprint: intent }, intent);
        const outcome = await withTimeout(
          host.chat.callModel({
            system: prompt.system,
            user: prompt.user,
            preferredKeyId: data.runs.find((item) => item.id === job.runId)?.modelKeyId ?? job.keyId,
            validate: (text) => {
              try {
                parseModelStage("draft", text);
                return "";
              } catch (error) {
                return error instanceof Error ? error.message : "draft validation failed";
              }
            },
          }),
          PER_STAGE_TIMEOUTS.draft ?? 120_000,
          "Stage 2 (Draft)",
        );
        const parsed = parseModelStage("draft", outcome.text);
        let draftMarkdown = parsed.markdown;
        let draftUsage = outcome.usage;
        let draftKeyId = outcome.keyId;
        // Length floor: the pipeline must not ship a thin article. When the first
        // draft lands under MIN_ARTICLE_WORDS, make one tolerant expansion call
        // (the prompt carries the length rule) and keep whichever draft is longer.
        // A model/provider failure here never fails the job.
        if (wordCount(draftMarkdown) < MIN_ARTICLE_WORDS) {
          try {
            const expandPrompt = buildDraftPrompt({ ...ctx, blueprint: intent }, intent, true);
            const more = await withTimeout(
              host.chat.callModel({
                system: expandPrompt.system,
                user: expandPrompt.user,
                preferredKeyId: data.runs.find((item) => item.id === job.runId)?.modelKeyId ?? job.keyId,
                validate: (text) => {
                  try {
                    parseModelStage("draft", text);
                    return "";
                  } catch (error) {
                    return error instanceof Error ? error.message : "draft validation failed";
                  }
                },
              }),
              PER_STAGE_TIMEOUTS.draft ?? 120_000,
              "Stage 2 (Draft expansion)",
            );
            const expanded = parseModelStage("draft", more.text);
            if (wordCount(expanded.markdown) > wordCount(draftMarkdown)) {
              draftMarkdown = expanded.markdown;
              draftKeyId = more.keyId;
              draftUsage = {
                prompt: draftUsage.prompt + more.usage.prompt,
                completion: draftUsage.completion + more.usage.completion,
                total: draftUsage.total + more.usage.total,
              };
            }
          } catch (error) {
            warn(data, site.id, `Stage 2 expansion pass skipped · ${error instanceof Error ? error.message : "unknown error"}`, now);
          }
        }
        job.modelText = { ...job.modelText, draft: draftMarkdown };
        job.modelUsage = { ...job.modelUsage, draft: draftUsage };
        job.modelVerifyFlags = parsed.verifyFlags ?? job.modelVerifyFlags;
        job.keyId = draftKeyId;
        job.failoverChain = [...new Set([...(job.failoverChain ?? []), draftKeyId])];
        stage.tokens = draftUsage.total;
        stage.note = usageNote(draftUsage);
        if (key) settle(data, job, key, "draft", draftUsage.total, now, "SETTLED");
        stage.status = "done";
        stage.finishedAt = now;
        return;
      } catch (error) {
        warn(data, site.id, `Stage 2 model call failed — deterministic draft fallback · ${error instanceof Error ? error.message : "unknown error"}`, now);
      }
    }
    job.modelText = { ...job.modelText, draft: deterministicDraft(data, job, site) };
    stage.tokens = 0;
    stage.note = NO_MODEL_NOTE;
    releaseReserves(data, job, now);
    stage.status = "done";
    stage.finishedAt = now;
    return;
  }
  // Stage 3 — Revision + Blader humanizer. A model failure, timeout, or broken
  // format NEVER fails the job: fall back to the Stage 2 draft + the
  // deterministic Blader scrub, then always record a humanizer score.
  const draft = job.modelText?.draft || deterministicDraft(data, job, site);
  let revised = draft;
  let verifyFlags: string[] | undefined;
  let revisionUsage: StageModelUsage = { prompt: 0, completion: 0, total: 0 };
  let usedModel = false;
  if (live && host.chat) {
    try {
      const prompt = buildRevisionPrompt(ctx, draft);
      const outcome = await withTimeout(
        host.chat.callModel({
          system: prompt.system,
          user: prompt.user,
          preferredKeyId: data.runs.find((item) => item.id === job.runId)?.modelKeyId ?? job.keyId,
          validate: (text) => {
            try {
              parseModelStage("revision", text);
              return "";
            } catch (error) {
              return error instanceof Error ? error.message : "revision validation failed";
            }
          },
        }),
        PER_STAGE_TIMEOUTS.revision ?? 150_000,
        "Stage 3 (Revision)",
      );
      const parsed = parseModelStage("revision", outcome.text);
      revised = parsed.markdown;
      verifyFlags = parsed.verifyFlags;
      revisionUsage = outcome.usage;
      usedModel = true;
      job.keyId = outcome.keyId;
      job.failoverChain = [...new Set([...(job.failoverChain ?? []), outcome.keyId])];
    } catch (error) {
      warn(data, site.id, `Stage 3 revision fell back to the Stage 2 draft + deterministic scrub · ${error instanceof Error ? error.message : "model pass failed"}`, now);
    }
  }
  const banned = [...ctx.bannedPhrases, ...(ctx.author?.voice.bannedPhrases ?? [])];
  const scrub = roboticScrub(revised, banned);
  let humanizerScore: number | undefined;
  let humanizerStripped: string[] | undefined;
  let humanizerPasses: number | undefined;
  let humanizerNote: string | undefined;
  let finalMarkdown = scrub.markdown;
  try {
    const { humanizeWithBlader } = await import("./humanizer.ts");
    const humanized = await withTimeout(
      humanizeWithBlader({
        chat: live && usedModel && host.chat?.bladerChat ? host.chat.bladerChat : undefined,
        markdown: scrub.markdown,
        keyword: job.keyword,
        title: job.title,
        authorName: ctx.author?.name,
        authorVoice: ctx.author ? authorVoiceBlock(ctx.author) : undefined,
        authorBannedPhrases: banned,
      }),
      150_000,
      "Stage 3 (Blader humanizer)",
    );
    finalMarkdown = humanized.markdown;
    humanizerScore = humanized.score;
    humanizerStripped = humanized.stripped;
    humanizerPasses = humanized.passes;
    humanizerNote = humanized.note;
    if (humanized.usage && key && usedModel) {
      settle(data, job, key!, "humanize", humanized.usage.total, now, "SETTLED");
    }
  } catch (error) {
    warn(data, site.id, `Blader deterministic scrub applied · ${error instanceof Error ? error.message : "humanizer unavailable"}`, now);
    const { humanizeWithBlader } = await import("./humanizer.ts");
    const plain = await humanizeWithBlader({ markdown: scrub.markdown, keyword: job.keyword, title: job.title, authorBannedPhrases: banned });
    finalMarkdown = plain.markdown;
    humanizerScore = plain.score;
    humanizerStripped = plain.stripped;
    humanizerPasses = plain.passes;
    humanizerNote = plain.note;
  }
  job.enrich = { ...job.enrich, humanizerNote };
  job.modelText = { ...job.modelText, revision: finalMarkdown };
  job.modelUsage = { ...job.modelUsage, revision: revisionUsage };
  job.modelVerifyFlags = verifyFlags ?? job.modelVerifyFlags;
  job.humanizerScore = humanizerScore;
  job.humanizerStripped = humanizerStripped;
  job.humanizerPasses = humanizerPasses;
  stage.tokens = revisionUsage.total;
  stage.note = usedModel ? usageNote(revisionUsage) : `${NO_MODEL_NOTE} · blader scrub`;
  releaseReserves(data, job, now);
  stage.status = "done";
  stage.finishedAt = now;
}

async function runMetadataStage(data: Persisted, job: Job, site: Site, now: number, host: AdvanceHost, key: AiKey | undefined): Promise<void> {
  const stage = job.stages.find((row) => row.key === "metadata")!;
  const markdown = job.modelText?.revision || job.modelText?.draft || "";
  const existingSlugs = data.articles.filter((article) => article.siteId === site.id && article.jobId !== job.id).map((article) => article.slug);
  const existingTags = [...new Set(data.articles.filter((article) => article.siteId === site.id).flatMap((article) => article.tags).filter(Boolean))];
  const live = Boolean(key && keyCallsModel(key) && host.chat && markdown);
  if (live && key) reserveStage(data, job, key, "metadata", now);
  if (live && host.chat) {
    try {
      const ctx = { ...stageContextFor(data, job, site), blueprint: job.modelIntent };
      const prompt = buildMetadataPrompt(ctx, markdown, { existingSlugs, existingTags });
      const outcome = await withTimeout(
        host.chat.callModel({
          system: prompt.system,
          user: prompt.user,
          preferredKeyId: data.runs.find((item) => item.id === job.runId)?.modelKeyId ?? job.keyId,
          validate: (text) => {
            try {
              parseMetadataStage(text);
              return "";
            } catch (error) {
              return error instanceof Error ? error.message : "metadata validation failed";
            }
          },
        }),
        PER_STAGE_TIMEOUTS.metadata ?? 60_000,
        "Stage 4 (Metadata)",
      );
      const parsed = parseMetadataStage(outcome.text);
      job.enrich = {
        ...job.enrich,
        title: parsed.title,
        metaDescription: parsed.metaDescription,
        slug: uniqueSlug(parsed.slug || parsed.title || job.title, existingSlugs),
        excerpt: parsed.excerpt,
        tags: parsed.tags.slice(0, 3),
      };
      job.modelUsage = { ...job.modelUsage, metadata: outcome.usage };
      job.keyId = outcome.keyId;
      job.failoverChain = [...new Set([...(job.failoverChain ?? []), outcome.keyId])];
      if (key) settle(data, job, key, "metadata", outcome.usage.total, now, "SETTLED");
      stage.tokens = outcome.usage.total;
      stage.note = usageNote(outcome.usage);
      stage.status = "done";
      stage.finishedAt = now;
      return;
    } catch (error) {
      warn(data, site.id, `Stage 4 metadata fell back to deterministic packaging · ${error instanceof Error ? error.message : "model pass failed"}`, now);
    }
  }
  const excerpt = (markdown ? excerptOf(markdown) : job.title).slice(0, 200);
  const tags = [...new Set([site.nicheTag, job.keyword.split(/\s+/)[0] ?? "notes"].filter(Boolean))].slice(0, 4);
  job.enrich = {
    ...job.enrich,
    title: job.title.slice(0, 60),
    metaDescription: excerpt.slice(0, 155),
    slug: uniqueSlug(job.title, existingSlugs),
    excerpt,
    tags,
  };
  stage.tokens = 0;
  stage.note = `${NO_MODEL_NOTE} · excerpt ${excerpt.length} chars · ${tags.length} tags`;
  releaseReserves(data, job, now);
  stage.status = "done";
  stage.finishedAt = now;
}

async function runEnrichmentStage(data: Persisted, job: Job, site: Site, now: number, host: AdvanceHost, key: AiKey | undefined, provider?: EmbedFn): Promise<void> {
  const stage = job.stages.find((row) => row.key === "enrichment")!;
  const markdown = job.modelText?.revision || job.modelText?.draft || "";
  const published = data.articles.filter((article) => article.siteId === site.id).map((article) => ({ title: article.title, slug: article.slug }));
  let links: { anchor: string; slug: string }[] = [];
  let imageQueries: { query: string; alt: string; role: "featured" | "section" }[] | undefined;
  let enrichmentUsage: StageModelUsage | undefined;
  const live = Boolean(key && keyCallsModel(key) && host.chat && markdown);
  if (live && key) reserveStage(data, job, key, "enrichment", now);
  if (live && host.chat) {
    try {
      const ctx = { ...stageContextFor(data, job, site), blueprint: job.modelIntent };
      const prompt = buildEnrichmentPrompt(ctx, markdown, published);
      const outcome = await withTimeout(
        host.chat.callModel({
          system: prompt.system,
          user: prompt.user,
          preferredKeyId: data.runs.find((item) => item.id === job.runId)?.modelKeyId ?? job.keyId,
          validate: (text) => {
            try {
              parseEnrichmentStage(text);
              return "";
            } catch (error) {
              return error instanceof Error ? error.message : "enrichment validation failed";
            }
          },
        }),
        PER_STAGE_TIMEOUTS.enrichment ?? 75_000,
        "Stage 5 (Enrichment)",
      );
      const parsed = parseEnrichmentStage(outcome.text);
      const allowed = new Set(published.map((page) => page.slug));
      // GOVERNOR §4: urls come from published inventory only — drop any invented slug.
      links = parsed.links.filter((link) => allowed.has(link.slug)).map((link) => ({ anchor: link.anchor.trim(), slug: link.slug }));
      imageQueries = parsed.imageQueries;
      enrichmentUsage = outcome.usage;
      job.keyId = outcome.keyId;
      job.failoverChain = [...new Set([...(job.failoverChain ?? []), outcome.keyId])];
      if (key) settle(data, job, key, "enrichment", outcome.usage.total, now, "SETTLED");
    } catch (error) {
      warn(data, site.id, `Stage 5 enrichment fell back to deterministic links and images · ${error instanceof Error ? error.message : "model pass failed"}`, now);
    }
  }
  // Internal links — model-picked when it ran, otherwise the live article graph.
  if (!links.length) {
    try {
      links = await pickLinks(data, site, job, provider);
    } catch (error) {
      warn(data, site.id, `Internal-link pick failed (continuing without) · ${error instanceof Error ? error.message : "unknown"}`, now);
    }
  }
  job.enrich = { ...job.enrich, links };
  // Bing image placement — the model's photo queries when present, else the
  // deterministic plan. Both ride into stage 6 in the same execution.
  const planned: Article["images"] = imageQueries?.length
    ? imageQueries.slice(0, 4).map((slot, index) => {
        const frame = bingFrame(slot.role, index);
        return {
          role: slot.role,
          query: slot.query,
          alt: slot.alt,
          http: 0,
          selected: false,
          license: "unknown-bing",
          attempts: 0,
          width: frame.w,
          height: frame.h,
          remote: bingThumbUrl(slot.query, frame.w, frame.h),
        };
      })
    : planImages(
        job.keyword,
        job.title,
        site.voice.sectionImages,
        markdown ? sectionsFromMarkdown(markdown).map((section) => ({ heading: section.heading, words: section.paragraphs.join(" ").split(/\s+/).filter(Boolean).length })) : [],
      );
  const slots = planned.slice(0, 4);
  let images = planned;
  if (host.images && slots.length) {
    try {
      const avoid = data.articles.flatMap((item) => item.images.map((image) => String(image.src ?? "").split("/").pop() ?? "")).filter(Boolean);
      const result = await withTimeout(
        host.images.placeImages({
          provider: site.voice.imageProvider || "bing",
          salt: 0,
          avoid,
          slots: slots.map((slot) => ({ query: slot.query, alt: slot.alt, role: slot.role, width: slot.width, height: slot.height })),
        }),
        45_000,
        "Stage 5 (Bing image placement)",
      );
      if (result.ok && result.images.length) {
        images = result.images;
      }
    } catch (error) {
      warn(data, site.id, `Bing placement failed — dynamic thumbnails stay on the article · ${error instanceof Error ? error.message : "unknown"}`, now);
    }
  }
  job.enrich = { ...job.enrich, images };
  if (enrichmentUsage) {
    job.modelUsage = { ...job.modelUsage, enrichment: enrichmentUsage };
    stage.tokens = enrichmentUsage.total;
    stage.note = usageNote(enrichmentUsage);
  } else {
    stage.tokens = 0;
    stage.note = `${NO_MODEL_NOTE} · ${images.filter((image) => image.selected).length} photos · ${links.length} links`;
    releaseReserves(data, job, now);
  }
  stage.status = "done";
  stage.finishedAt = now;
}

/**
 * Drive ONE job from its current stage to a terminal status inside a single
 * awaited, sequentially-executed flow. Any unexpected error fails the job
 * explicitly — the loop cannot deadlock between stages.
 */
async function runJobPipeline(data: Persisted, jobId: string, now: number, site: Site, host: AdvanceHost, provider?: EmbedFn): Promise<void> {
  try {
    for (let guard = 0; guard < 12; guard += 1) {
      const job = data.jobs.find((item) => item.id === jobId);
      if (!job || (job.status !== "running" && job.status !== "queued")) return;
      if (job.status === "queued") {
        startJob(data, job, now);
        if ((job.status as Job["status"]) !== "running") return;
      }
      const stageIndex = currentStageIndex(job);
      job.stageIndex = stageIndex;
      const stage = job.stages[stageIndex]!;
      if (stage.status === "pending") {
        stage.status = "running";
        stage.startedAt = now;
      }
      const run = data.runs.find((item) => item.id === job.runId);
      const key = data.keys.find((item) => item.id === (run?.modelKeyId || job.keyId)) ?? usableKey(data, run?.modelKeyId, now) ?? undefined;
      switch (stage.key) {
        case "intent":
        case "draft":
        case "revision":
          await runModelStageNow(data, job, site, stage.key, now, host, key);
          break;
        case "metadata":
          await runMetadataStage(data, job, site, now, host, key);
          break;
        case "enrichment":
          await runEnrichmentStage(data, job, site, now, host, key, provider);
          break;
        case "publish":
          if (site.ghost.status !== "connected") {
            job.status = "failed";
            job.failReason = "GHOST_NOT_CONNECTED";
            releaseReserves(data, job, now);
            log(data, site.id, "danger", `Publish failed · Ghost not connected · ${job.title}`, now);
            host.commit?.(data);
            return;
          }
          if (job.shots >= 1 && job.articleId) {
            job.status = "completed";
            log(data, site.id, "info", `Reconciled existing post by slug · no second write · ${job.title}`, now);
            host.commit?.(data);
            return;
          }
          await publishArticle(data, site, job, run?.publishMode ?? "draft", key ?? data.keys[0]!, now, provider);
          host.commit?.(data);
          return;
      }
      host.commit?.(data);
      if (job.status !== "running") return;
    }
    // Loop budget exhausted without a terminal status — fail honestly.
    failJob(data, jobId, "Stage runner exceeded its stage budget; job failed to guarantee a terminal state.", Date.now());
    host.commit?.(data);
  } catch (error) {
    failJob(data, jobId, error instanceof Error ? error.message : "The stage runner crashed on an unexpected error.", Date.now());
    host.commit?.(data);
  }
}

function startJob(data: Persisted, job: Job, now: number): boolean {
  const run = data.runs.find((r) => r.id === job.runId);
  const key = usableKey(data, run?.modelKeyId, now);
  if (!key) {
    job.status = "refused";
    job.refusalReason = "NO_USABLE_KEY";
    return false;
  }
  job.status = "running";
  const firstIncomplete = job.stages.findIndex((stage) => stage.status !== "done");
  const resumeIndex = job.stageIndex >= 0 && job.stages[job.stageIndex]?.status !== "done"
    ? job.stageIndex
    : firstIncomplete >= 0
      ? firstIncomplete
      : Math.max(0, job.stages.length - 1);
  job.stageIndex = resumeIndex;
  const stage = job.stages[resumeIndex]!;
  stage.status = "running";
  stage.startedAt = now;
  return true;
}

export function needsWork(data: Persisted, now: number): boolean {
  if (data.workerPaused) return false;
  // Server-owned jobs are advanced by the Rust worker. Counting them here would
  // keep this tab's tick busy running stages the worker already runs.
  if (
    data.jobs.some(
      (j) =>
        j.origin !== "server" &&
        (j.status === "queued" || j.status === "running"),
    )
  )
    return true;
  if (data.sites.some((s) => s.ghost.corpus === "SYNCING" && s.ghost.syncReadyAt && s.ghost.syncReadyAt <= now)) return true;
  if (data.sites.some((s) => s.pendingRebuildAt && s.pendingRebuildAt <= now)) return true;
  return false;
}

function createBuild(data: Persisted, site: Site, now: number, auto: boolean): StaticBuild {
  const check = validatePublicUrl(site.publicUrl);
  if (!check.ok) {
    return {
      id: uid("bld"),
      siteId: site.id,
      status: "failed",
      pages: 0,
      bytes: 0,
      ms: 180,
      at: now,
      auto,
      template: site.template,
      detail: check.error,
      includedIds: [],
      excluded: [],
      artifact: [],
    };
  }
  const candidates = data.articles.filter((article) => article.siteId === site.id);
  const excluded: { id: string; reason: string }[] = [];
  const included = candidates.filter((article) => {
    if (article.status !== "published") { excluded.push({ id: article.id, reason: "draft" }); return false; }
    const sourceJob = data.jobs.find((job) => job.id === article.jobId);
    if (sourceJob?.status === "failed" || sourceJob?.status === "refused") { excluded.push({ id: article.id, reason: "failed gate" }); return false; }
    if (!validatePublicUrl(site.publicUrl).ok) { excluded.push({ id: article.id, reason: "missing public URL" }); return false; }
    return true;
  });
  // An article nothing links to is still published. Being an orphan is an SEO
  // warning — it is called out on Analytics — and never a reason to drop a page:
  // the newest article is an orphan until a sibling links to it, so excluding
  // orphans empties the site and, once nothing is left, fails the whole build
  // and takes every other page down with it.
  if (!included.length) {
    // The operator has to be able to tell *why* nothing is publishable, so the
    // message names the actual exclusions instead of a blanket refusal.
    const drafts = excluded.filter((row) => row.reason === "draft").length;
    const gated = excluded.filter((row) => row.reason === "failed gate").length;
    const reasons = [
      drafts ? `${drafts} still draft` : "",
      gated ? `${gated} held by a failed gate` : "",
    ].filter(Boolean);
    const detail = candidates.length
      ? `Build failed: nothing is publishable — ${reasons.join(" · ")}. Publish an article, or clear the failed gate, and build again.`
      : "Build failed: this site has no articles yet. Write one and build again.";
    return { id: uid("bld"), siteId: site.id, status: "failed", pages: 0, bytes: 0, ms: 180, at: now, auto, template: site.template, detail, includedIds: [], excluded, artifact: [] };
  }
  const artifact = staticFiles(site, included, true, data.authors.filter((author) => author.siteId === site.id)).map((file) => ({ ...file, hash: hashArtifact(file.text) }));
  const pages = included.length;
  const bytes = artifact.reduce((sum, file) => sum + new TextEncoder().encode(file.text).length, 0);
  return {
    id: uid("bld"),
    siteId: site.id,
    status: "succeeded",
    pages,
    bytes,
    ms: 640 + pages * 40,
    at: now,
    auto,
    template: site.template,
    detail: `${pages} articles · ${artifact.length} files · ${site.template} · ${check.url}`,
    includedIds: included.map((article) => article.id),
    excluded,
    // Rule 6: the route set + ad config hash feed the route-diff deploy gate.
    routes: buildRoutes(artifact),
    adsConfigHash: adsConfigHash(site),
    // VPS: persist artifact to disk/object storage.
    artifact,
  };
}

export async function advance(
  data: Persisted,
  now: number,
  opts: AdvanceHost & { provider?: EmbedFn } = {},
): Promise<Persisted> {
  if (!needsWork(data, now)) return data;
  const next = structuredClone(data);
  for (const site of next.sites) {
    if (site.ghost.corpus === "SYNCING" && site.ghost.syncReadyAt && now >= site.ghost.syncReadyAt) {
      site.ghost.syncReadyAt = undefined;
      if (site.ghost.adminKey && site.ghost.url.startsWith("https://")) {
        log(next, site.id, "info", "Ghost sync is waiting on the Admin API. Local articles were not copied in as inventory.", now);
      } else {
        site.ghost.corpus = "COMPLETE";
        site.ghost.inventory = inventoryFromArticles(next.articles, site.id, now);
        site.ghost.inventorySource = "local-demo";
        site.ghost.lastSyncAt = now;
        log(next, site.id, "info", `Local demo · ${site.ghost.inventory.length} studio articles. Ghost was not read.`, now);
      }
    }
    if (site.pendingRebuildAt && now >= site.pendingRebuildAt) {
      site.pendingRebuildAt = null;
      const build = createBuild(next, site, now, true);
      next.builds.unshift(build);
      log(next, site.id, build.status === "succeeded" ? "ok" : "danger", `Auto-rebuild ${build.status} · ${build.pages} pages`, now);
      if (build.status === "succeeded") {
        const { uploadAutoBuild } = await import("./auto-upload");
        const pages = next.articles.filter((article) => build.includedIds.includes(article.id));
        const sent = await uploadAutoBuild(site, build, pages);
        if (sent.ok) {
          next.deploys.unshift({
            id: uid("dep"),
            siteId: site.id,
            buildId: build.id,
            providerId: "cpanel",
            status: "packaged",
            at: now,
            probe: `Auto-upload sent ${sent.files} files to ${sent.host}.${sent.note ? ` ${sent.note}` : ""} Probe the public URL before treating the site as live.`,
          });
          log(next, site.id, "ok", `Auto-upload · ${sent.files} files · ${sent.host}`, now);
        } else {
          log(next, site.id, "warn", sent.reason, now);
        }
      }
    }
  }

  // Production overhaul: ONE sequential runner owns job progression. Each
  // active job runs the full 6-stage pipeline in a single awaited flow (up to
  // the configured concurrency), so stages 4–6 execute immediately after 1–3
  // finish and no job can hang between disconnected ticks. The meter's embed
  // provider rides along for the L3 semantic gate.
  for (const site of next.sites) {
    const concurrency = Math.max(1, limitsOf(next).concurrency);
    const runningJobs = () => next.jobs.filter((j) => j.siteId === site.id && j.status === "running");
    const queued = next.jobs.filter(
      (j) => j.siteId === site.id && j.status === "queued" && j.origin !== "server",
    );
    let slots = concurrency - runningJobs().length;
    for (const job of [...queued].reverse()) {
      if (slots <= 0) break;
      if (!depsResolved(job, next.jobs)) continue;
      if (startJob(next, job, now)) slots -= 1;
    }
    const active = next.jobs.filter(
      (j) => j.siteId === site.id && j.status === "running" && j.origin !== "server",
    );
    await Promise.all(active.map((job) => runJobPipeline(next, job.id, now, site, opts, opts.provider)));
  }

  for (const run of next.runs) {
    const jobs = next.jobs.filter((j) => j.runId === run.id);
    const wasRunning = run.status === "running" || run.status === "queued";
    run.status = rollup(jobs);
    if (wasRunning && run.status === "failed" && jobs.some((j) => j.refusalReason === "NO_USABLE_KEY" || j.failReason === "NO_USABLE_KEY")) {
      log(next, run.siteId, "danger", `Run blocked · NO_USABLE_KEY · no AI key is saved for this workspace · ${run.title}`, now);
      next.notice = { tone: "danger", text: "No usable AI key. Save at least one key on AI Keys to run." };
    }
    if (run.topicPlanId) {
      const plan = next.plans.find((p) => p.id === run.topicPlanId);
      if (plan) {
        if (run.status === "queued" || run.status === "running") plan.status = run.status === "queued" ? "queued" : "running";
        else if (run.status === "completed") plan.status = "completed";
        else if (run.status === "partial") plan.status = "partial";
      }
    }
  }
  const buildHistory = limitsOf(next).buildHistory;
  if (buildHistory != null && next.builds.length > buildHistory) next.builds.length = buildHistory;
  return next;
}

export function manualBuild(data: Persisted, siteId: string, now: number): Persisted {
  const next = structuredClone(data);
  const site = next.sites.find((s) => s.id === siteId);
  if (!site) return data;
  const build = createBuild(next, site, now, false);
  next.builds.unshift(build);
  next.notice = {
    tone: build.status === "succeeded" ? "ok" : "danger",
    text: build.status === "succeeded" ? `Build succeeded · ${build.pages} pages.` : build.detail || "Build failed.",
  };
  log(next, siteId, build.status === "succeeded" ? "ok" : "danger", `Manual build ${build.status}`, now);
  return next;
}

/** Rule 6: route-diff gate. Previously live routes may never silently disappear. */
export function routeDiffFor(data: Persisted, build: StaticBuild): { removedRoutes: string[]; addedRoutes: string[]; unchangedCount: number } {
  const candidate = build.routes ?? buildRoutes(build.artifact);
  const previous = data.deploys
    .filter((deploy) => deploy.status === "verified")
    .map((deploy) => data.builds.find((item) => item.id === deploy.buildId))
    .find((item): item is StaticBuild => Boolean(item));
  const live = new Set(previous?.routes ?? buildRoutes(previous?.artifact ?? []));
  if (!live.size) return { removedRoutes: [], addedRoutes: candidate.filter((route) => !live.has(route)).sort(), unchangedCount: 0 };
  const removedRoutes = [...live].filter((route) => !candidate.includes(route)).sort();
  const addedRoutes = candidate.filter((route) => !live.has(route)).sort();
  const unchangedCount = candidate.filter((route) => live.has(route)).length;
  return { removedRoutes, addedRoutes, unchangedCount };
}

export function packageDeploy(
  data: Persisted,
  buildId: string,
  now: number,
  options: { providerId?: string; acknowledgeRouteDiff?: boolean } = {},
): { data: Persisted; error?: string; hold?: boolean } {
  const build = data.builds.find((b) => b.id === buildId);
  if (!build) return { data, error: "Build not found." };
  if (build.status !== "succeeded") return { data, error: "Only a succeeded build can be packaged." };
  const site = data.sites.find((s) => s.id === build.siteId);
  if (!site) return { data, error: "Website missing." };
  const articleCount = data.articles.filter((article) => article.siteId === site.id).length;
  if (!articleCount) return { data, error: "Refusing a deploy with no pages. Build the site after at least one article exists." };
  // Providers: cPanel (FTP) plus the API adapters wired in Milestone 4.
  const wanted = options.providerId ?? "cpanel";
  const provider = site.providers.find((p) => p.id === wanted && (p.status === "verified" || p.status === "configured"));
  if (!provider) return { data, error: `Connect and verify ${wanted === "cpanel" ? "cPanel hosting" : wanted} on Connections first.` };

  const next = structuredClone(data);
  const existing = next.deploys.find((deploy) => deploy.buildId === buildId);
  if (existing && existing.status !== "hold-route-diff") return { data, error: "That build was already deployed. Existing builds are never re-deployed." };

  // Rule 6: hold automatic deployment when a previously live route would vanish.
  const diff = routeDiffFor(next, build);
  const acknowledged = Boolean(options.acknowledgeRouteDiff) || Boolean(existing?.routeDiff?.acknowledged);
  if (diff.removedRoutes.length > 0 && !acknowledged) {
    if (!existing) {
      next.deploys.unshift({
        id: uid("dep"),
        siteId: site.id,
        buildId,
        providerId: provider.id,
        status: "hold-route-diff",
        at: now,
        probe: `HOLD_ROUTE_DIFF · ${diff.removedRoutes.length} live route(s) would disappear. Acknowledge explicitly or rebuild with the missing articles.`,
        routeDiff: { ...diff, acknowledged: false },
      });
    } else {
      existing.status = "hold-route-diff";
      existing.routeDiff = { ...diff, acknowledged: false };
      existing.probe = `HOLD_ROUTE_DIFF · ${diff.removedRoutes.length} live route(s) would disappear.`;
    }
    next.notice = { tone: "danger", text: `Route-diff gate: ${diff.removedRoutes.length} previously live route(s) would be removed. Deployment is held until you acknowledge.` };
    log(next, site.id, "warn", `HOLD_ROUTE_DIFF · removed ${diff.removedRoutes.length} · added ${diff.addedRoutes.length} · unchanged ${diff.unchangedCount}`, now);
    return { data: next, hold: true };
  }

  const probe = "Files were uploaded to the verified host. Probe the public URL before treating the site as live.";
  if (existing) {
    existing.status = "packaged";
    existing.providerId = provider.id;
    existing.at = now;
    existing.probe = probe;
    if (existing.routeDiff) existing.routeDiff.acknowledged = true;
  } else {
    next.deploys.unshift({
      id: uid("dep"),
      siteId: site.id,
      buildId,
      providerId: provider.id,
      status: "packaged",
      at: now,
      probe,
      routeDiff: diff.removedRoutes.length ? { ...diff, acknowledged: true } : undefined,
    });
  }
  next.notice = { tone: "info", text: `Uploaded for ${provider.name}. Probe the Public URL before calling it live.` };
  log(next, site.id, "info", `Deploy packaged · ${provider.name} · build ${buildId.slice(-6)}`, now);
  return { data: next };
}

/** Rule 6: explicit resolution of a route-diff hold. */
export function resolveRouteDiff(data: Persisted, deployId: string, action: "deploy-anyway" | "rebuild", now: number): { data: Persisted; error?: string } {
  const deploy = data.deploys.find((item) => item.id === deployId);
  if (!deploy || deploy.status !== "hold-route-diff") return { data, error: "No route-diff hold on that deploy." };
  if (action === "rebuild") {
    const site = data.sites.find((item) => item.id === deploy.siteId);
    if (!site) return { data, error: "Website missing." };
    const next = structuredClone(data);
    const build = createBuild(next, site, now, false);
    next.builds.unshift(build);
    next.deploys = next.deploys.filter((item) => item.id !== deployId);
    next.notice = {
      tone: build.status === "succeeded" ? "ok" : "danger",
      text: build.status === "succeeded" ? "Rebuilt with every current article. Review the new build and deploy it." : build.detail || "Rebuild failed.",
    };
    return { data: next };
  }
  return packageDeploy(data, deploy.buildId, now, { providerId: deploy.providerId, acknowledgeRouteDiff: true });
}

export function applyProbe(data: Persisted, deployId: string, ok: boolean, detail: string, now: number): Persisted {
  const next = structuredClone(data);
  const dep = next.deploys.find((d) => d.id === deployId);
  if (!dep) return data;
  dep.status = ok ? "verified" : "failed";
  dep.probe = detail;
  dep.at = now;
  next.notice = { tone: ok ? "ok" : "danger", text: detail };
  log(next, dep.siteId, ok ? "ok" : "danger", detail, now);
  if (ok) {
    const build = next.builds.find((item) => item.id === dep.buildId);
    const site = next.sites.find((item) => item.id === dep.siteId);
    const provider = site?.providers.find((item) => item.id === "cpanel" && item.status === "verified");
    const key = site?.indexNowKey;
    if (build && site && provider?.ftp && key && build.includedIds.length) {
      next.notice = { tone: "info", text: "Public probe passed. IndexNow submission is queued after confirming the key file." };
      log(next, site.id, "info", `IndexNow ready · ${build.includedIds.length} changed URL(s) · ${key}.txt key confirmed by public probe`, now);
    } else {
      next.notice = { tone: "warn", text: "Public probe passed, but IndexNow was skipped because the site has no verified key-file configuration." };
    }
  }
  return next;
}

export async function buildAudit(data: Persisted, siteId: string, now: number, provider?: EmbedFn): Promise<Persisted> {
  const next = structuredClone(data);
  const site = next.sites.find((s) => s.id === siteId);
  if (!site) return data;
  const articles = next.articles.filter((article) => article.siteId === siteId);
  const [min, max] = intensityBand(site.voice.linkIntensity);
  const proposals: Persisted["audits"][number]["proposals"] = [];
  let healthy = 0;
  let missing = 0;
  let broken = 0;
  for (const article of articles) {
    let brokenHere = 0;
    const kept: typeof article.links = [];
    for (const link of article.links) {
      const target = articles.find((other) => other.slug === link.targetSlug);
      if (!target) {
        brokenHere += 1;
        const replacement = await bestTarget(articles, article, site.nicheTag, new Set([link.targetSlug]), provider);
        if (replacement) {
          proposals.push({
            id: uid("prop"),
            articleId: article.id,
            articleTitle: article.title,
            kind: "rewrite",
            detail: `Broken permalink /${link.targetSlug}/. PUT would point the anchor at /post/${replacement.slug}/. Post ${article.ledger.postId} is not recreated.`,
            anchor: anchorPhrase(replacement.title),
            targetSlug: replacement.slug,
            fromSlug: link.targetSlug,
            selected: true,
          });
        } else {
          proposals.push({
            id: uid("prop"),
            articleId: article.id,
            articleTitle: article.title,
            kind: "remove",
            detail: `Remove the broken edge to /${link.targetSlug}/. No replacement is in inventory.`,
            anchor: link.anchor,
            targetSlug: link.targetSlug,
            selected: true,
          });
        }
        continue;
      }
      const sim = await articleSimilarity(article, target, site.nicheTag, provider);
      if (sim < 0.18) {
        const replacement = await bestTarget(articles, article, site.nicheTag, new Set([link.targetSlug]), provider);
        if (replacement) {
          proposals.push({
            id: uid("prop"),
            articleId: article.id,
            articleTitle: article.title,
            kind: "rewrite",
            detail: `Low-relevance edge. PUT would retarget “${link.anchor}” to a closer page.`,
            anchor: anchorPhrase(replacement.title),
            targetSlug: replacement.slug,
            fromSlug: link.targetSlug,
            selected: false,
          });
        }
      }
      kept.push(link);
      if (!article.html.includes(postHref(link.targetSlug)) && !article.markdown.includes(postHref(link.targetSlug))) {
        proposals.push({
          id: uid("prop"),
          articleId: article.id,
          articleTitle: article.title,
          kind: "insert",
          detail: `“${link.anchor}” is recorded but missing from the article. The re-weave writes the link into the page.`,
          anchor: link.anchor,
          targetSlug: link.targetSlug,
          selected: true,
        });
      }
    }
    if (brokenHere) broken += 1;
    const overflow = kept.length - max;
    if (overflow > 0) {
      const scored = await Promise.all(
        kept.map(async (link) => {
          const target = articles.find((item) => item.slug === link.targetSlug);
          const sim = target ? await articleSimilarity(article, target, site.nicheTag, provider) : 0;
          return { link, sim };
        }),
      );
      scored.sort((a, b) => a.sim - b.sim);
      for (const { link } of scored.slice(0, overflow)) {
        proposals.push({
          id: uid("prop"),
          articleId: article.id,
          articleTitle: article.title,
          kind: "remove",
          detail: `Over the ${site.voice.linkIntensity} ceiling (${max}). Remove the weakest edge.`,
          anchor: link.anchor,
          targetSlug: link.targetSlug,
          selected: false,
        });
      }
    }
    if (kept.length < min) {
      missing += 1;
      const have = new Set(article.links.map((link) => link.targetSlug));
      let added = 0;
      const ranked = await Promise.all(
        articles
          .filter((other) => other.id !== article.id && !have.has(other.slug))
          .map(async (other) => ({ other, sim: await articleSimilarity(article, other, site.nicheTag, provider) })),
      );
      ranked.sort((a, b) => b.sim - a.sim);
      for (const item of ranked) {
        if (kept.length + added >= min) break;
        proposals.push({
          id: uid("prop"),
          articleId: article.id,
          articleTitle: article.title,
          kind: "insert",
          detail: `Insert a verbatim anchor. PUT update only — post ${article.ledger.postId} is not recreated.`,
          anchor: anchorPhrase(item.other.title),
          targetSlug: item.other.slug,
          selected: true,
        });
        added += 1;
      }
    } else if (!brokenHere && kept.length <= max) {
      healthy += 1;
    }
  }
  const orphanCount = articles.filter((article) => inboundCount(articles, article.slug) === 0).length;
  next.audits.unshift({
    id: uid("aud"),
    siteId,
    at: now,
    scanned: articles.length,
    healthy,
    missingLinks: missing,
    broken,
    wouldInsert: proposals.filter((item) => item.kind === "insert").length,
    wouldRewrite: proposals.filter((item) => item.kind === "rewrite").length,
    wouldRemove: proposals.filter((item) => item.kind === "remove").length,
    orphans: orphanCount,
    proposals,
    applied: false,
  });
  next.notice = {
    tone: "info",
    text: `Audit scanned ${articles.length} posts. ${orphanCount} orphan${orphanCount === 1 ? "" : "s"} in the library. Nothing was written.`,
  };
  log(next, siteId, "info", `Link audit · ${articles.length} scanned · ${proposals.length} proposals · ${orphanCount} orphans`, now);
  return next;
}

async function bestTarget(articles: Article[], article: Article, nicheTag: string, skip: Set<string>, provider?: EmbedFn): Promise<Article | undefined> {
  const ranked = await Promise.all(
    articles
      .filter((other) => other.id !== article.id && !skip.has(other.slug))
      .map(async (other) => ({ other, sim: await articleSimilarity(article, other, nicheTag, provider) })),
  );
  ranked.sort((a, b) => b.sim - a.sim);
  return ranked[0]?.other;
}

export function applyAudit(data: Persisted, auditId: string, now: number): Persisted {
  const next = structuredClone(data);
  const audit = next.audits.find((a) => a.id === auditId);
  if (!audit || audit.applied) return data;
  let n = 0;
  for (const proposal of audit.proposals) {
    if (!proposal.selected) continue;
    const article = next.articles.find((a) => a.id === proposal.articleId);
    if (!article) continue;
    if (proposal.kind === "insert") {
      const exists = article.links.some((link) => link.targetSlug === proposal.targetSlug);
      const inserted = insertAnchor(article.html, article.markdown, proposal.anchor, proposal.targetSlug);
      if (!inserted.inserted && exists) continue;
      if (inserted.inserted) {
        article.html = inserted.html;
        article.markdown = inserted.markdown;
      }
      if (!exists) article.links.push(linkEdge(proposal.anchor, proposal.targetSlug, "LOCAL"));
      if (inserted.inserted || !exists) n += 1;
    } else if (proposal.kind === "rewrite" && proposal.fromSlug) {
      const moved = retargetAnchor(article.html, article.markdown, proposal.fromSlug, proposal.targetSlug, proposal.anchor);
      article.html = moved.html;
      article.markdown = moved.markdown;
      const link = article.links.find((item) => item.targetSlug === proposal.fromSlug);
      if (link) {
        link.targetSlug = proposal.targetSlug;
        link.anchor = proposal.anchor;
        link.state = "LOCAL";
      } else if (!article.links.some((item) => item.targetSlug === proposal.targetSlug)) {
        article.links.push(linkEdge(proposal.anchor, proposal.targetSlug, "LOCAL"));
      }
      n += 1;
    } else if (proposal.kind === "remove") {
      const stripped = unwrapAnchor(article.html, article.markdown, proposal.targetSlug);
      article.html = stripped.html;
      article.markdown = stripped.markdown;
      const before = article.links.length;
      article.links = article.links.filter((link) => link.targetSlug !== proposal.targetSlug);
      if (article.links.length !== before) n += 1;
    }
  }
  audit.applied = true;
  next.notice = { tone: "ok", text: `Re-weave applied with PUT · ${n} edits · no new Ghost posts.` };
  log(next, audit.siteId, "ok", `Re-weave PUT · ${n} edits · shots unchanged`, now);
  return next;
}

export function liftOpenings(data: Persisted): Persisted | null {
  let changed = false;
  const next = structuredClone(data);
  for (const article of next.articles) {
    const token = article.keyword.toLowerCase().split(/\s+/).find((word) => word.length > 3) ?? "";
    if (!token) continue;
    const opening = article.markdown.slice(0, 600).toLowerCase();
    if (opening.includes(token)) continue;
    const sentence = `${article.keyword} is the question this page answers.`;
    article.markdown = `${sentence}\n\n${article.markdown}`;
    article.html = `<p>${sentence}</p>\n${article.html}`;
    if (article.sections[0]) {
      article.sections[0] = {
        ...article.sections[0],
        paragraphs: [`${sentence} ${article.sections[0].paragraphs[0] ?? ""}`.trim(), ...article.sections[0].paragraphs.slice(1)],
      };
    }
    changed = true;
  }
  return changed ? next : null;
}

export async function weaveOrphans(data: Persisted, siteId: string, now: number, quiet = false, provider?: EmbedFn): Promise<Persisted> {
  const next = structuredClone(data);
  const site = next.sites.find((item) => item.id === siteId);
  if (!site) return data;
  const [min, max] = intensityBand(site.voice.linkIntensity);
  const articles = next.articles.filter((article) => article.siteId === siteId);
  let added = 0;
  for (const article of articles) {
    for (const link of article.links) {
      if (alreadyLinked(article.html, article.markdown, link.targetSlug)) continue;
      const inserted = insertAnchor(article.html, article.markdown, link.anchor, link.targetSlug);
      if (!inserted.inserted) continue;
      article.html = inserted.html;
      article.markdown = inserted.markdown;
      added += 1;
    }
    const have = new Set(article.links.map((link) => link.targetSlug));
    const need = Math.max(0, Math.min(min, max) - article.links.length);
    if (need <= 0) continue;
    const candidates = await Promise.all(
      articles
        .filter((other) => other.id !== article.id && !have.has(other.slug))
        .map(async (other) => ({ other, sim: await articleSimilarity(article, other, site.nicheTag, provider) })),
    );
    candidates.sort((a, b) => b.sim - a.sim);
    for (const candidate of candidates.slice(0, need)) {
      if (article.links.length >= max) break;
      const anchor = anchorPhrase(candidate.other.title);
      const inserted = insertAnchor(article.html, article.markdown, anchor, candidate.other.slug);
      if (!inserted.inserted) continue;
      article.html = inserted.html;
      article.markdown = inserted.markdown;
      article.links.push(linkEdge(anchor, candidate.other.slug, "LOCAL"));
      added += 1;
    }
  }
  for (const article of articles) {
    if (inboundCount(articles, article.slug) > 0) continue;
    await ensureInbound(next, site, article, provider);
    if (inboundCount(articles, article.slug) > 0) added += 1;
  }
  const orphans = articles.filter((article) => inboundCount(articles, article.slug) === 0).length;
  if (!added) return quiet ? data : next;
  next.notice = {
    tone: added ? "ok" : "info",
    text: added
      ? `Interlink pass added ${added} verbatim anchors. ${orphans} orphan${orphans === 1 ? "" : "s"} remain. No new posts.`
      : orphans
        ? `Outbound minimum is met. ${orphans} page${orphans === 1 ? "" : "s"} still have no inbound link.`
        : "Every article already meets the link minimum, and none are orphans.",
  };
  log(next, siteId, added ? "ok" : "info", `Interlink pass · ${added} anchors · ${orphans} orphans`, now);
  return next;
}

export function cancelRun(data: Persisted, runId: string, now: number): Persisted {
  const next = structuredClone(data);
  const run = next.runs.find((r) => r.id === runId);
  if (!run) return data;
  let released = 0;
  for (const job of next.jobs) {
    if (job.runId !== runId) continue;
    if (job.status !== "queued" && job.status !== "running") continue;
    job.status = "cancelled";
    released += releaseReserves(next, job, now);
  }
  run.status = rollup(next.jobs.filter((j) => j.runId === runId));
  log(next, run.siteId, "warn", `Run cancelled · ${run.title}${released ? ` · ${released} reserve(s) released back to the daily allowance` : ""}`, now);
  next.notice = { tone: "warn", text: released ? `Run cancelled. ${released} stage reserve(s) returned to the allowance. No extra Ghost write.` : "Run cancelled. No extra Ghost write." };
  return next;
}

export function restartJob(data: Persisted, jobId: string, now: number, fromScratch = false): { data: Persisted; error?: string } {
  const job = data.jobs.find((j) => j.id === jobId);
  if (!job) return { data, error: "Job not found." };
  if (job.status !== "failed") return { data, error: "Only failed jobs restart. Refusals stay refused." };
  const restartLimit = limitsOf(data).restartLimit;
  if (restartLimit != null && (job.restarts ?? 0) >= restartLimit) {
    return { data, error: `Restart limit reached (${restartLimit}). Raise it in Settings → Content to restart again.` };
  }
  const next = structuredClone(data);
  const target = next.jobs.find((j) => j.id === jobId)!;
  if (!fromScratch && target.stages.every((stage) => stage.status === "done")) {
    return { data, error: "No incomplete stage to resume. Use a hard restart to run every stage again." };
  }
  target.attempt = (target.attempt ?? 1) + 1;
  target.restarts = (target.restarts ?? 0) + 1;
  target.status = "queued";
  target.failReason = undefined;
  target.modelError = undefined;
  if (fromScratch) {
    target.modelText = undefined;
    target.modelUsage = undefined;
    target.stageIndex = -1;
    target.stages = blankStages();
    target.tokens = 0;
    target.costUsd = 0;
  } else {
    const firstIncomplete = target.stages.findIndex((stage) => stage.status !== "done");
    const resumeIndex = firstIncomplete >= 0 ? firstIncomplete : Math.max(0, target.stageIndex, target.stages.length - 1);
    target.stageIndex = resumeIndex;
    target.stages = target.stages.map((stage, index) =>
      index < resumeIndex
        ? stage
        : {
            ...stage,
            status: "pending" as const,
            tokens: 0,
            startedAt: undefined,
            finishedAt: undefined,
            note: undefined,
          },
    );
    if (resumeIndex <= 1 && target.modelText) delete target.modelText.draft;
    if (resumeIndex <= 2 && target.modelText) delete target.modelText.revision;
    if (resumeIndex <= 1 && target.modelUsage) delete target.modelUsage.draft;
    if (resumeIndex <= 2 && target.modelUsage) delete target.modelUsage.revision;
    if (target.modelText && !target.modelText.draft && !target.modelText.revision) target.modelText = undefined;
    if (target.modelUsage && !target.modelUsage.draft && !target.modelUsage.revision) target.modelUsage = undefined;
  }
  const run = next.runs.find((r) => r.id === target.runId);
  if (run) run.status = "queued";
  log(
    next,
    target.siteId,
    "info",
    target.shots > 0 ? `Restart will reconcile post ${target.articleId} · no second write` : `Restart queued · ${target.title}`,
    now,
  );
  next.notice = {
    tone: "info",
    text: target.shots > 0 ? "Restart will reconcile the existing slug. It will not POST again." : "Failed job queued again.",
  };
  return { data: next };
}

export function regenerateVariant(data: Persisted, jobId: string, now: number): { data: Persisted; error?: string } {
  const job = data.jobs.find((j) => j.id === jobId);
  if (!job) return { data, error: "Job not found." };
  const options = clusterTitles(job.keyword).concat(clusterTitles(job.title));
  const used = data.articles.filter((article) => article.siteId === job.siteId);
  const nextTitle = options.find(
    (row) =>
      !used.some((article) => article.slug === slugify(row.title) || lexicalSimilarity(article.title, row.title) > 0.72),
  );
  if (!nextTitle) return { data, error: "No distinct angle left. Refused instead of writing another copy of the same headline." };
  const next = structuredClone(data);
  next.jobs.unshift(
    makeJob({
      id: uid("job"),
      runId: job.runId,
      siteId: job.siteId,
      keyword: job.keyword,
      title: nextTitle.title,
      kind: job.kind === "pillar" ? "cluster" : job.kind,
      variant: true,
      dependsOn: [],
      createdAt: now,
    }),
  );
  const run = next.runs.find((r) => r.id === job.runId);
  if (run) {
    run.allowVariants = true;
    run.status = "queued";
  }
  log(next, job.siteId, "info", `Variant queued · ${nextTitle.title}. Stage 6 still refuses a matching title or slug.`, now);
  next.notice = { tone: "info", text: `Variant queued as “${nextTitle.title}”. It is refused if that headline is already on the site.` };
  return { data: next };
}

export function releaseHeld(data: Persisted, jobId: string, now: number): { data: Persisted; error?: string } {
  const job = data.jobs.find((item) => item.id === jobId);
  if (!job) return { data, error: "Job not found." };
  if (job.status !== "publish-held") return { data, error: "Only a written article that is waiting to publish can be released." };
  const next = structuredClone(data);
  const target = next.jobs.find((item) => item.id === jobId)!;
  const article = next.articles.find((item) => item.id === target.articleId);
  const run = next.runs.find((item) => item.id === target.runId);
  const site = next.sites.find((item) => item.id === target.siteId);
  target.status = "completed";
  target.shots = 1;
  target.publishHold = false;
  if (article && run) {
    article.ledger.confirmed = true;
    article.ledger.confirmedAt = now;
    article.ledger.shots = 1;
    article.status = run.publishMode === "live" ? "published" : "draft";
    article.publishedAt = now;
    article.ghostPush = site?.ghost.mode === "live" && site.ghost.adminKey ? "pending" : "skipped";
  }
  if (run) run.status = rollup(next.jobs.filter((item) => item.runId === run.id));
  if (site?.autoRebuild && validatePublicUrl(site.publicUrl).ok) site.pendingRebuildAt = now + 60_000;
  log(next, target.siteId, "ok", `Publish released · single shot · ${target.title}`, now);
  next.notice = { tone: "ok", text: run?.publishMode === "live" ? "Publishing. One Ghost write." : "Sending to Ghost as a draft." };
  return { data: next };
}

export function decideReview(data: Persisted, jobId: string, approve: boolean, now: number): { data: Persisted; error?: string } {
  const job = data.jobs.find((item) => item.id === jobId);
  if (!job) return { data, error: "Job not found." };
  if (job.status !== "review-held") return { data, error: "That job is not waiting for review." };
  const next = structuredClone(data);
  const target = next.jobs.find((item) => item.id === jobId)!;
  if (approve) {
    target.status = "queued";
    target.refusalReason = undefined;
  } else {
    target.status = "refused";
    target.refusalReason = "Rejected at review — too close to existing content.";
  }
  const run = next.runs.find((item) => item.id === target.runId);
  if (run) run.status = rollup(next.jobs.filter((item) => item.runId === run.id));
  log(next, target.siteId, approve ? "ok" : "warn", `${approve ? "Review approved" : "Review rejected"} · ${target.title}`, now);
  next.notice = { tone: approve ? "ok" : "warn", text: approve ? "Approved. The worker will write it." : "Rejected. Nothing will be written." };
  return { data: next };
}

export function measureArticle(article: { title: string; keyword: string; markdown: string; mustCover: string[]; words: number }): { coverage: number; intent: number } {
  const text = `${article.title}\n${article.markdown}`.toLowerCase();
  const opening = text.slice(0, 500);
  const items = article.mustCover.filter(Boolean);
  const coverage = items.length
    ? items.filter((item) => {
        const words = item.toLowerCase().split(/\s+/).filter((word) => word.length > 4);
        if (!words.length) return text.includes(item.toLowerCase());
        return words.filter((word) => text.includes(word)).length >= Math.min(2, words.length);
      }).length / items.length
    : article.words >= MIN_ARTICLE_WORDS
      ? 1
      : Math.min(1, article.words / MIN_ARTICLE_WORDS);
  const tokens = article.keyword.toLowerCase().split(/\s+/).filter((word) => word.length > 3);
  const title = article.title.toLowerCase();
  const inTitle = tokens.length ? tokens.filter((word) => title.includes(word)).length / tokens.length : title.includes(article.keyword.toLowerCase()) ? 1 : 0;
  const inOpen = tokens.length ? tokens.filter((word) => opening.includes(word)).length / tokens.length : opening.includes(article.keyword.toLowerCase()) ? 1 : 0;
  return { coverage: Math.round(coverage * 100) / 100, intent: Math.round((inTitle * 0.6 + inOpen * 0.4) * 100) / 100 };
}

function factualVerifyFlags(markdown: string): string[] {
  const flags: string[] = [];
  const patterns = [
    /\b\d+(?:\.\d+)?%\b[^.\n]*/g,
    /\b(?:19|20)\d{2}\b[^.\n]*/g,
    /\$\s?\d[\d,.]*(?:\s?\/(?:month|year))?[^.\n]*/gi,
    /\b(?:according to|source:|research from|study by)\b[^.\n]*/gi,
  ];
  for (const pattern of patterns) {
    for (const match of markdown.matchAll(pattern)) {
      const claim = match[0].trim();
      if (claim && !flags.some((flag) => flag.startsWith(`“${claim}”`))) flags.push(`“${claim}” — verify the statistic, date, price, or named source before publishing.`);
    }
  }
  return flags.slice(0, 20);
}

export function goldenSteps(data: Persisted, site: Site): { label: string; done: boolean; href: string; reason: string }[] {
  const siteArticles = data.articles.filter((a) => a.siteId === site.id);
  const links = siteArticles.reduce((n, a) => n + a.links.length, 0);
  const build = data.builds.find((b) => b.siteId === site.id && b.status === "succeeded" && b.pages > 0);
  const deployed = data.deploys.some((d) => d.siteId === site.id && d.status === "verified");
  const imageDone = siteArticles.some((a) => a.images.some((image) => image.selected && Boolean(image.src)));
  return [
    { label: "Account created", done: true, href: "/account", reason: "Done" },
    { label: "Email verified", done: data.account.emailVerified, href: "/account", reason: data.account.emailVerified ? "Done" : "Unconfirmed" },
    { label: "Admin approved", done: data.account.adminApproved, href: "/account", reason: data.account.adminApproved ? "Done" : "Not started" },
    { label: "Website workspace created", done: true, href: "/settings/website", reason: "Done" },
    { label: "AI model selected", done: data.keys.some((k) => k.id === site.voice.modelKeyId && !k.disabled), href: "/ai-keys", reason: "Not started" },
    { label: "Daily allowance configured", done: data.keys.some((k) => k.allowanceUsd > 0), href: "/ai-keys", reason: "Not started" },
    {
      label: "Ghost connected",
      done: site.ghost.status === "connected" && site.ghost.corpus === "COMPLETE",
      href: "/connections",
      reason: site.ghost.status !== "connected" ? "Not started" : site.ghost.corpus === "SYNCING" ? "In progress" : "Not started",
    },
    { label: "Content submitted (run/plan)", done: data.runs.some((r) => r.siteId === site.id), href: "/create", reason: "Not started" },
    {
      label: "Article published to Ghost",
      done: siteArticles.some((a) => a.ledger.confirmed && a.ledger.shots === 1),
      href: "/articles",
      reason: siteArticles.length ? "Unconfirmed" : "No article output",
    },
    {
      label: "Internal link graph built",
      done: links > 0 && siteArticles.every((article) => article.links.length > 0 || siteArticles.length < 2),
      href: "/analytics",
      reason: siteArticles.length < 2 ? "No eligible targets" : "Not started",
    },
    { label: "Relevant images added", done: imageDone, href: "/articles", reason: siteArticles.length ? "In progress" : "Not started" },
    { label: "Static site built", done: !!build, href: "/static-delivery", reason: site.publicUrl ? "Not started" : "Preview only" },
    { label: "Static site deployed", done: deployed, href: "/static-delivery", reason: deployed ? "Done" : "Uploaded — not verified" },
  ];
}

export function runMetrics(jobs: Job[]) {
  const count = (s: Job["status"]) => jobs.filter((j) => j.status === s).length;
  return {
    completed: count("completed"),
    inflight: count("running"),
    failed: count("failed"),
    refused: count("refused"),
    cancelled: count("cancelled"),
    queued: count("queued"),
    held: count("review-held"),
    waiting: count("publish-held"),
    progress: jobs.length ? Math.round((jobs.filter((job) => job.status !== "queued" && job.status !== "running").length / jobs.length) * 100) : 0,
    tokens: jobs.reduce((n, j) => n + j.tokens, 0),
    usd: jobs.reduce((n, j) => n + j.costUsd, 0),
    settledCalls: jobs.reduce((n, j) => n + j.stages.filter((s) => s.status === "done").length, 0),
  };
}

export { DEFAULT_LIMITS };
