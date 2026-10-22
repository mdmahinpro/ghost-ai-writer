/**
 * Canonical article-image URLs.
 *
 * Every generated/section/featured image resolves to the dynamic Bing thumbnail
 * endpoint so the app preview, the Ghost payload and the exported Static Site
 * HTML all show a real, topic-matched photo without shipping placeholder CMS
 * paths (cms.* covers, /content/images/... demo paths) or local media files.
 *
 * Zero disk: this module only ever builds URL strings.
 */

export const BING_THUMB_HOST = "https://tse1.mm.bing.net";
export const BING_THUMB_WIDTH = 474;
export const BING_THUMB_HEIGHT = 274;

const STOP_WORDS = new Set([
  "a", "an", "the", "how", "to", "of", "for", "and", "in", "on", "your", "with", "from",
  "that", "this", "is", "are", "be", "it", "at", "by", "or", "as", "you",
]);

/**
 * Normalize free text (keyword / title / section heading) into a clean,
 * lowercase, hyphenated search slug: "How to plan a PhD weekly research
 * schedule" → "plan-phd-weekly-research-schedule".
 */
export function bingQuerySlug(input: string, maxWords = 8): string {
  const words = input
    .toLowerCase()
    .replace(/[^a-z0-9\s-]+/g, " ")
    .split(/[\s-]+/)
    .filter((word) => word.length > 1 && !STOP_WORDS.has(word));
  const picked = (words.length ? words : input.toLowerCase().replace(/[^a-z0-9]+/g, " ").split(/\s+/).filter(Boolean)).slice(0, maxWords);
  return picked.join("-").slice(0, 80) || "editorial-cover";
}

/** The exact dynamic Bing thumbnail URL format used everywhere. */
export function bingThumbUrl(query: string, width = BING_THUMB_WIDTH, height = BING_THUMB_HEIGHT): string {
  return `${BING_THUMB_HOST}/th?q=${encodeURIComponent(bingQuerySlug(query))}&w=${width}&h=${height}&c=7`;
}

export function isBingThumb(url?: string): boolean {
  return Boolean(url && /^https:\/\/tse\d*\.mm\.bing\.net\/th\?/i.test(url));
}

/** Detects placeholder CMS cover paths that must never ship in generated output. */
export function isFakeCmsImage(url?: string): boolean {
  if (!url) return false;
  return /^https?:\/\/cms\.[^/]+\//i.test(url) || /\/content\/images\//i.test(url);
}

/** Matches an absolute or relative Ghost `/content/images/...` URL inside text. */
const CMS_IMAGE_IN_TEXT = /https?:\/\/cms\.[^\s"'()<>\\]+\/content\/images\/[^\s"'()<>\\]+|\/content\/images\/[^\s"'()<>\\]+/gi;

/**
 * Rewrites every `/content/images/...` (absolute cms.* or root-relative Ghost)
 * URL in a block of HTML/markdown into a topic-matched Bing thumbnail, so a
 * previously-published Ghost media path can never leak back into previews,
 * static builds, or a fresh Ghost payload.
 */
export function rewriteCmsImageUrls(text: unknown, fallbackQuery: string): string {
  const source = typeof text === "string" ? text : "";
  if (!source || !/content\/images/i.test(source)) return source;
  return source.replace(CMS_IMAGE_IN_TEXT, () => bingThumbUrl(fallbackQuery));
}

/** A single image field: keep a real URL, convert a fake CMS path to Bing. */
export function sanitizeCmsImage(url: string | undefined, fallbackQuery: string): string | undefined {
  if (!url) return url;
  return isFakeCmsImage(url) ? bingThumbUrl(fallbackQuery) : url;
}

type SanitizableImage = { remote?: string; src?: string };
type SanitizableArticle = { keyword?: string; title?: string; slug?: string; html?: string; markdown?: string; images?: SanitizableImage[] };

/**
 * Persist-migration entry point (v12): strip every placeholder CMS image path
 * from stored articles — both the `images[]` fields and any `/content/images/`
 * URL baked into the stored html/markdown — and replace each with a valid Bing
 * thumbnail derived from the article keyword/title. Pure and in-place so the
 * zustand `migrate` (and a unit test) can run it with no browser APIs.
 */
export function sanitizeArticleImages(articles: SanitizableArticle[] | undefined): number {
  let changed = 0;
  for (const article of articles ?? []) {
    const query = article.keyword || article.title || article.slug || "editorial-cover";
    for (const image of article.images ?? []) {
      if (image.remote && isFakeCmsImage(image.remote)) {
        image.remote = bingThumbUrl(query);
        changed++;
      }
      if (image.src && isFakeCmsImage(image.src)) {
        image.src = bingThumbUrl(query);
        changed++;
      }
    }
    const html = rewriteCmsImageUrls(article.html, query);
    if (html !== (article.html ?? "")) {
      article.html = html;
      changed++;
    }
    const markdown = rewriteCmsImageUrls(article.markdown, query);
    if (markdown !== (article.markdown ?? "")) {
      article.markdown = markdown;
      changed++;
    }
  }
  return changed;
}

/**
 * The URL every renderer uses for an article image: the stored Bing thumbnail
 * when present, otherwise a freshly derived topic-matched Bing thumbnail.
 */
export function articleImageSrc(
  image: { remote?: string; src?: string; query?: string; width?: number; height?: number },
  fallbackQuery: string,
): string {
  const remote = image.remote;
  if (remote && !isFakeCmsImage(remote)) return remote;
  const query = image.query?.trim() || fallbackQuery;
  return bingThumbUrl(query, image.width || BING_THUMB_WIDTH, image.height || BING_THUMB_HEIGHT);
}
