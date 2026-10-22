import { lexicalSimilarity } from "./engine";
import type { Article, Site } from "./types";

export type BingCheck = {
  id: string;
  label: string;
  pass: boolean;
  tip: string;
};

export function bingChecks(article: Article, siblings: Article[], site: Site | undefined): BingCheck[] {
  const outbound = article.links.length;
  const inbound = siblings.filter((other) => other.links.some((link) => link.targetSlug === article.slug)).length;
  const near = siblings.some(
    (other) => other.id !== article.id && lexicalSimilarity(`${article.title} ${article.keyword}`, `${other.title} ${other.keyword}`) >= 0.72,
  );
  const first = (article.sections[0]?.paragraphs[0] ?? article.excerpt ?? "").toLowerCase();
  const keyword = article.keyword.toLowerCase();
  const headings = article.sections.length;
  return [
    {
      id: "links-out",
      label: "Outbound internal links",
      pass: outbound >= 2 || siblings.length < 2,
      tip: "Bing crawls the graph, not isolated URLs. Every page should point to at least two real siblings so none of them is a dead end or a copy of another URL.",
    },
    {
      id: "links-in",
      label: "Inbound internal links",
      pass: inbound >= 1 || siblings.length === 0,
      tip: "A page with no inbound links is hard for Bing to discover. Weave it from an older, already-indexed URL.",
    },
    {
      id: "unique",
      label: "Not a near-duplicate",
      pass: !near && article.uniqueness >= 0.8,
      tip: "If two drafts share a title stem, Bing folds them. Keep one URL per intent and link the other angle instead of rewriting the same page.",
    },
    {
      id: "query",
      label: "Keyword in title and opening",
      pass: article.title.toLowerCase().includes(keyword.split(" ")[0] ?? "") && first.includes((keyword.split(" ")[0] ?? "").toLowerCase()),
      tip: "Put the query in the title and the first paragraph in plain language. Do not stuff the exact phrase into every heading.",
    },
    {
      id: "headings",
      label: "Headings that answer the query",
      pass: headings >= 3,
      tip: "Three or more specific H2s help Bing match sub-intent. Generic headings like Introduction do not.",
    },
    {
      id: "author",
      label: "Named author",
      pass: Boolean(article.authorName),
      tip: "A stable byline with a city and beat gives the site an entity Bing can associate with the topic.",
    },
    {
      id: "human",
      label: "Bulletproof humanization",
      pass: Boolean(article.humanized),
      tip: article.humanized
        ? `Blader humanizer rewrote this draft${typeof article.humanizerScore === "number" ? ` (prose purity ${article.humanizerScore}/100)` : ""}.`
        : article.humanState === "running" || article.humanState === "pending"
          ? "Blader humanizer is auditing this draft for AI tells."
          : article.humanState === "error"
            ? article.humanNote || "Blader humanizer did not finish this draft."
            : "Humanization is queued. The deterministic pass always runs; a usable model key adds the surgical rewrite.",
    },
    {
      id: "index",
      label: "Indexable public URL",
      pass: Boolean(site?.publicUrl) && site?.robots !== "noindex,nofollow",
      tip: "Bing will not rank a noindex host. Set the public URL, allow index,follow, then submit the URL list with IndexNow.",
    },
  ];
}

export function bingScore(checks: BingCheck[]): number {
  if (!checks.length) return 0;
  return checks.filter((check) => check.pass).length / checks.length;
}

/** The single token the "Keyword in title and opening" check matches on. */
export function queryToken(keyword: string): string {
  return (keyword.trim().split(/\s+/)[0] ?? "").toLowerCase();
}

function titleCase(text: string): string {
  return text.replace(/\w\S*/g, (word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase());
}

/** The opening paragraph the checklist reads (sections first, then rendered HTML). */
export function openingText(article: Article): string {
  const fromSections = article.sections[0]?.paragraphs[0];
  if (fromSections) return fromSections;
  const fromHtml = /<p[^>]*>([\s\S]*?)<\/p>/i.exec(article.html)?.[1];
  return (fromHtml?.replace(/<[^>]+>/g, " ").trim() || article.excerpt || "").trim();
}

/**
 * The sibling Bing is most likely to fold this page into, when the two title
 * stems overlap. This is what the "Not a near-duplicate" check flags.
 */
export function nearDuplicateSibling(article: Article, siblings: Article[]): Article | undefined {
  return siblings
    .filter((other) => other.id !== article.id)
    .map((other) => ({ other, score: lexicalSimilarity(`${article.title} ${article.keyword}`, `${other.title} ${other.keyword}`) }))
    .sort((a, b) => b.score - a.score)
    .find((entry) => entry.score >= 0.72)?.other;
}

/**
 * Deterministic repair for "Keyword in title and opening": put the query in the
 * title and lead the opening paragraph with it in plain language — no exact
 * phrase stuffed into headings. Returns the exact fields the checklist reads.
 */
export function alignKeywordToQuery(article: Article): {
  title: string;
  html: string;
  markdown: string;
  sections: Article["sections"];
} {
  const token = queryToken(article.keyword);
  const keyword = article.keyword.trim();
  if (!token) return { title: article.title, html: article.html, markdown: article.markdown, sections: article.sections };
  let title = article.title;
  if (!title.toLowerCase().includes(token)) {
    const cased = titleCase(keyword);
    title = cased.length <= 70 ? cased : cased.slice(0, 70).replace(/\s+\S*$/, "");
  }
  if (openingText(article).toLowerCase().includes(token)) {
    return { title, html: article.html, markdown: article.markdown, sections: article.sections };
  }
  const lead = `What you need to know about ${keyword}.`;
  const sections = article.sections.length
    ? article.sections.map((section, index) =>
        index === 0 && section.paragraphs.length
          ? { ...section, paragraphs: [`${lead} ${section.paragraphs[0]}`.trim(), ...section.paragraphs.slice(1)] }
          : section,
      )
    : [{ heading: title, paragraphs: [lead] }];
  const html = /<p(\s[^>]*)?>/i.test(article.html)
    ? article.html.replace(/<p(\s[^>]*)?>/i, (match) => `${match}${lead} `)
    : `<p>${lead}</p>\n${article.html}`;
  return { title, html, markdown: `${lead}\n\n${article.markdown.trimStart()}`, sections };
}

export function duplicatePairs(articles: Article[]): { left: Article; right: Article; score: number }[] {
  const pairs: { left: Article; right: Article; score: number }[] = [];
  for (let i = 0; i < articles.length; i++) {
    for (let j = i + 1; j < articles.length; j++) {
      const left = articles[i]!;
      const right = articles[j]!;
      const score = lexicalSimilarity(`${left.title} ${left.keyword}`, `${right.title} ${right.keyword}`);
      if (score >= 0.62) pairs.push({ left, right, score });
    }
  }
  return pairs.sort((a, b) => b.score - a.score).slice(0, 8);
}
