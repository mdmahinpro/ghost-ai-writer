import { alreadyLinked, insertAnchor } from "./link-graph";
import { excerptOf, markdownToHtml, wordCount } from "./markdown";
import { runWithKeyPool } from "./model-pool";
import { generateDraft } from "./providers.functions";
import { humanizeWithBlader, type BladerChat } from "./humanizer";
import { keyCallsModel, keyPool } from "./engine";
import { MIN_ARTICLE_WORDS, TARGET_ARTICLE_WORDS } from "./stage-contracts";
import { scrapeSource, searchWeb } from "./web-search";
import { useApp } from "./store";
import type { Article, AiKey } from "./types";

/**
 * Build the blader/humanizer LLM transport from the studio's AI key pool:
 * sequential auto-failover through `runWithKeyPool`, metering `generateDraft`.
 */
export function keyPoolChat(input: { keys: AiKey[]; onPenalty?: (keyId: string, status: number, error?: string) => void }): BladerChat {
  return async (system, user) => {
    const outcome = await runWithKeyPool({
      keys: input.keys,
      onPenalty: input.onPenalty ?? (() => {}),
      call: async (key) => {
        const result = await generateDraft({
          data: { preferredKeyId: key.serverKeyId, system, user },
        });
        if (result.ok) return { ok: true as const, value: result };
        return { ok: false as const, status: result.status ?? 0, error: result.error };
      },
    });
    if (!outcome.ok) return { ok: false as const, error: outcome.error };
    return { ok: true as const, text: outcome.value.text, keyId: outcome.keyId, usage: outcome.value.usage };
  };
}

/** Convenience: the active site's usable model pool as a BladerChat transport. */
export function siteChat(onPenalty?: (keyId: string, status: number, error?: string) => void): BladerChat {
  const state = useApp.getState();
  const site = state.sites.find((item) => item.id === state.activeSiteId);
  const keys = keyPool(state, site?.voice.modelKeyId, Date.now()).filter((key) => keyCallsModel(key));
  return keyPoolChat({ keys, onPenalty });
}

/**
 * Humanization entry point used by the live-writer bulletproof pass.
 * Delegates to the native blader/humanizer engine (deterministic pass +
 * two-pass LLM surgical rewrite through the studio's AI key pool, in the
 * assigned author's voice). The external Metric37 API is gone.
 */
export async function humanizeMarkdown(markdown: string, bulletproof: boolean): Promise<{ markdown: string; note: string }> {
  const state = useApp.getState();
  const site = state.sites.find((item) => item.id === state.activeSiteId);
  const result = await humanizeWithBlader({
    markdown,
    chat: siteChat(),
    authorBannedPhrases: site?.voice.bannedPhrases ?? [],
  });
  void bulletproof;
  return {
    markdown: result.markdown,
    note: bulletproof ? `${result.note} · score ${result.score}` : result.note,
  };
}

export async function researchDigest(urls: string[], query?: string): Promise<string> {
  const cfg = useApp.getState().webSearch;
  if (cfg.mode === "off") return "";
  const notes: string[] = [];
  const list = urls.map((url) => url.trim()).filter(Boolean).slice(0, 5);
  if (list.length) {
    for (const url of list.slice(0, 3)) {
      const result = await scrapeSource(url);
      if (!result.ok) {
        notes.push(`Source failed (${url}): ${result.error}`);
        continue;
      }
      notes.push(`Source: ${result.title}\n${result.markdown}`);
    }
  } else if (query?.trim()) {
    const { results, errors } = await searchWeb(query, 5);
    for (const row of results.slice(0, 3)) notes.push(`Source: ${row.title} (${row.provider})\n${row.url}\n${row.snippet}`);
    if (!results.length && errors.length) notes.push(`Web search failed: ${errors.join("; ")}`);
  }
  return notes.join("\n\n").slice(0, 7000);
}

export async function writeWithModel(input: {
  keys: AiKey[];
  keyword: string;
  title: string;
  authorName: string;
  authorVoice?: string;
  links: { anchor: string; slug: string }[];
  avoid: string[];
  research: string;
}): Promise<{ markdown: string; keyId: string }> {
  const linkList = input.links.map((link) => `- [${link.anchor}](/post/${link.slug}/)`).join("\n") || "- none yet";
  const avoid = input.avoid.slice(0, 12).map((title) => `- ${title}`).join("\n") || "- none";
  const system = [
    input.authorVoice
      ? `You write as this assigned author. Stay inside their expertise, rhythm, diction, signature moves, and banned phrases so the byline reads like a distinct human:\n${input.authorVoice}`
      : `You write as ${input.authorName}, a US staff writer.`,
    "Return markdown only. No preamble.",
    "Use 5 ## headings. Each heading names one concrete decision. Do not use Introduction, Conclusion, or the article title as a heading.",
    `Write at least ${MIN_ARTICLE_WORDS} words (aim ${TARGET_ARTICLE_WORDS}). Answer the title in the first two sentences. Short sentences. No fake statistics, no 'delve', no 'tapestry'.`,
    "Do not copy the research notes. Use only facts you can phrase yourself. Never write a [verify] tag or a source placeholder.",
    "The page must take a different angle from the titles listed under Avoid.",
    "If links are provided, mention each anchor once as a markdown link using the exact href. Do not invent URLs. Do not add images.",
  ].join(" ");
  const user = [
    `Title: ${input.title}`,
    `Keyword: ${input.keyword}`,
    "",
    "Avoid repeating these existing pages:",
    avoid,
    "",
    "Internal links you may use:",
    linkList,
    "",
    input.research ? `Research notes:\n${input.research}` : "No scraped sources. Stay concrete and modest.",
  ].join("\n");
  const outcome = await runWithKeyPool({
    keys: input.keys,
    onPenalty: (keyId, status, error) => useApp.getState().penalizeKey(keyId, status, error),
    call: async (key) => {
      const result = await generateDraft({
        data: { preferredKeyId: key.serverKeyId, system, user },
      });
      if (result.ok) return { ok: true as const, value: result.text };
      return { ok: false as const, status: result.status ?? 0, error: result.error };
    },
  });
  if (!outcome.ok) throw new Error(outcome.error);
  return { markdown: outcome.value, keyId: outcome.keyId };
}

export async function proposePlan(input: {
  keys: AiKey[];
  topic: string;
}): Promise<{ pillar: string; clusters: { title: string; blurb: string }[] } | null> {
  const request = (more: boolean) =>
    runWithKeyPool({
      keys: input.keys,
      onPenalty: (keyId, status, error) => useApp.getState().penalizeKey(keyId, status, error),
      call: async (key) => {
        const result = await generateDraft({
          data: {
            preferredKeyId: key.serverKeyId,
            system: [
              "You plan a pillar page and supporting articles for one website.",
              "Return JSON only, no markdown fence.",
              '{"pillar":"headline","clusters":[{"title":"headline","blurb":"one sentence"}]}',
              more ? "The first response was too short. Return at least 6 and at most 10 genuinely distinct clusters now." : "Write 8 clusters. Each title is a different decision a reader can finish.",
              "Do not paste the operator topic into every title.",
              "No tips, tools, challenges, or 'how to do X effectively'.",
            ].join(" "),
            user: `Topic: ${input.topic}`,
          },
        });
        if (result.ok) return { ok: true as const, value: result.text };
        return { ok: false as const, status: result.status ?? 0, error: result.error };
      },
    });
  for (const more of [false, true]) {
    const outcome = await request(more);
    if (!outcome.ok) return null;
    const raw = outcome.value.replace(/```json|```/gi, "");
    const start = raw.indexOf("{");
    const end = raw.lastIndexOf("}");
    if (start < 0 || end <= start) continue;
    try {
      const parsed = JSON.parse(raw.slice(start, end + 1)) as { pillar?: string; clusters?: { title?: string; blurb?: string }[] };
      const clusters = (parsed.clusters ?? [])
        .map((row) => ({ title: String(row.title ?? "").trim(), blurb: String(row.blurb ?? "").trim() }))
        .filter((row) => row.title)
        .slice(0, 10);
      if (parsed.pillar && clusters.length >= 6) return { pillar: parsed.pillar.trim(), clusters };
    } catch {
      // Ask once more only for a short/invalid result; the caller will show the failure otherwise.
    }
  }
  return null;
}

export function articleFromMarkdown(markdown: string): Pick<Article, "html" | "markdown" | "excerpt" | "words"> {
  return {
    markdown,
    html: markdownToHtml(markdown),
    excerpt: excerptOf(markdown),
    words: wordCount(markdown),
  };
}

export function ensureMarkdownLinks(markdown: string, links: { anchor: string; slug: string }[]): string {
  let html = markdownToHtml(markdown);
  let next = markdown;
  for (const link of links) {
    if (alreadyLinked(html, next, link.slug)) continue;
    const inserted = insertAnchor(html, next, link.anchor, link.slug);
    html = inserted.html;
    next = inserted.markdown;
  }
  return next;
}
