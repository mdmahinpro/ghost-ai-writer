import type { ArticleLink } from "./types.ts";
import { esc } from "./utils.ts";

const STOP = new Set(
  "a an the of for and to in on how with your that this from what when who why into over about between without than then are was were will just more most".split(" "),
);

export function postHref(slug: string): string {
  const clean = slug.replace(/^\/+|\/+$/g, "").replace(/^post\//, "");
  return `/post/${clean}/`;
}

export function anchorPhrase(title: string): string {
  const raw = title.replace(/[“”"']/g, "").trim();
  const words = raw.split(/\s+/).filter(Boolean);
  const content = words.filter((word) => !STOP.has(word.toLowerCase().replace(/[^a-z0-9]/g, "")));
  const pick = (content.length >= 2 ? content : words).slice(0, 4);
  const phrase = pick.join(" ").replace(/[.:;,]+$/g, "");
  if (phrase.length >= 8) return phrase;
  return raw.slice(0, 72);
}

export function linkSentence(anchor: string): string {
  return `The notes on ${anchor} cover the next question, so this page does not repeat them.`;
}

export function alreadyLinked(html: string, markdown: string, slug: string): boolean {
  const href = postHref(slug);
  const bare = `/${slug.replace(/^\/+|\/+$/g, "")}`;
  return html.includes(href) || markdown.includes(href) || html.includes(`href="${bare}"`) || html.includes(`href="${bare}/"`);
}

export function insertAnchor(
  html: string,
  markdown: string,
  anchor: string,
  slug: string,
): { html: string; markdown: string; inserted: boolean } {
  if (!anchor.trim() || !slug.trim()) return { html, markdown, inserted: false };
  if (alreadyLinked(html, markdown, slug)) return { html, markdown, inserted: false };
  const href = postHref(slug);
  const sentence = linkSentence(anchor);
  const linked = sentence.replace(anchor, `<a href="${esc(href)}">${esc(anchor)}</a>`);
  const md = sentence.replace(anchor, `[${anchor}](${href})`);
  return {
    html: `${html.trim()}\n<p>${linked}</p>`,
    markdown: `${markdown.trim()}\n\n${md}\n`,
    inserted: true,
  };
}

export function unwrapAnchor(html: string, markdown: string, slug: string): { html: string; markdown: string } {
  const href = postHref(slug);
  const pattern = new RegExp(`<a href="${href.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}">([\\s\\S]*?)</a>`, "g");
  const mdPattern = new RegExp(`\\[([^\\]]+)\\]\\(${href.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\)`, "g");
  return {
    html: html.replace(pattern, "$1"),
    markdown: markdown.replace(mdPattern, "$1"),
  };
}

export function retargetAnchor(
  html: string,
  markdown: string,
  fromSlug: string,
  toSlug: string,
  anchor: string,
): { html: string; markdown: string } {
  const from = postHref(fromSlug);
  const to = postHref(toSlug);
  let nextHtml = html.split(from).join(to);
  let nextMd = markdown.split(from).join(to);
  if (!nextHtml.includes(to)) {
    const inserted = insertAnchor(nextHtml, nextMd, anchor, toSlug);
    nextHtml = inserted.html;
    nextMd = inserted.markdown;
  }
  return { html: nextHtml, markdown: nextMd };
}

export function linkEdge(anchor: string, slug: string, state: ArticleLink["state"] = "LOCAL"): ArticleLink {
  return { anchor, targetSlug: slug, state };
}

export function inboundCount(articles: { slug: string; links: { targetSlug: string }[] }[], slug: string): number {
  return articles.filter((article) => article.links.some((link) => link.targetSlug === slug)).length;
}

export function orphansOf<T extends { slug: string; links: { targetSlug: string }[] }>(articles: T[]): T[] {
  if (articles.length < 2) return [];
  return articles.filter((article) => inboundCount(articles, article.slug) === 0);
}
