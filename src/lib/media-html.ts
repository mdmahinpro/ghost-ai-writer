import type { ArticleImage } from "./types.ts";
import { esc } from "./utils.ts";
import { articleImageSrc } from "./image-urls.ts";

/**
 * Figure HTML for an article image. The dynamic Bing thumbnail (image.remote)
 * is preferred so the app preview and the exported static site always resolve a
 * real photo; a local /media asset is used only when no remote exists. The
 * image's own query wins over the article-level fallback so each figure stays
 * tied to its own section instead of all repeating the article title.
 */
export function figureHtml(image: ArticleImage, fallbackQuery = ""): string {
  if (!image.selected && !image.remote && !image.src) return "";
  const src = articleImageSrc(image, image.query?.trim() || image.alt || fallbackQuery);
  const loading = image.role === "featured" ? "eager" : "lazy";
  const width = image.width ? ` width="${image.width}"` : "";
  const height = image.height ? ` height="${image.height}"` : "";
  return `<figure class="kg-card kg-image-card"><img src="${esc(src)}" alt="${esc(image.alt)}"${width}${height} loading="${loading}" decoding="async" referrerpolicy="no-referrer" /></figure>`;
}

/** Hard ceiling on in-body figures so one article never becomes a photo album. */
const MAX_SECTION_FIGURES = 3;

/**
 * Insert the featured figure once, then one figure before each section heading —
 * but only for distinct photos. Two slots that resolve to the same URL are
 * collapsed so the page never shows the same image several times in a row.
 */
export function applyFetchedImages(
  html: string,
  markdown: string,
  images: ArticleImage[],
  fallbackQuery = "",
): { html: string; markdown: string } {
  let nextHtml = html
    .replace(/<!--gaw-image:\d+-->/g, "")
    .replace(/<figure class="kg-card kg-image-card">[\s\S]*?<\/figure>\n?/g, "");
  let nextMd = markdown
    .replace(/!\[[^\]]*\]\(slot:\d+\)\n?/g, "")
    .replace(/!\[[^\]]*\]\(\/media\/[^)]+\)\n?/g, "");
  const placed = images.filter((image) => (image.selected || image.remote) && (image.src || image.remote));
  // Resolve every candidate to the exact URL the renderer will emit, so slots
  // that collapse to the same photo are inserted only once.
  const srcOf = (image: ArticleImage) => articleImageSrc(image, image.query?.trim() || image.alt || fallbackQuery);
  const used = new Set<string>();
  const featured = placed.find((image) => image.role === "featured") ?? placed[0];
  if (featured) used.add(srcOf(featured));
  const sections: ArticleImage[] = [];
  for (const image of placed) {
    if (image === featured) continue;
    const src = srcOf(image);
    if (used.has(src)) continue;
    used.add(src);
    sections.push(image);
    if (sections.length >= MAX_SECTION_FIGURES) break;
  }
  if (featured) {
    nextHtml = `${figureHtml(featured, fallbackQuery)}\n${nextHtml.trim()}`;
    nextMd = `![${featured.alt}](${srcOf(featured)})\n\n${nextMd.trim()}`;
  }
  let seen = 0;
  nextHtml = nextHtml.replace(/<h2>/g, (match) => {
    const image = sections[seen];
    seen += 1;
    return image ? `${figureHtml(image, fallbackQuery)}\n${match}` : match;
  });
  sections.forEach((image) => {
    nextMd += `\n\n![${image.alt}](${srcOf(image)})\n`;
  });
  return { html: nextHtml, markdown: nextMd };
}

export function mediaRefs(html: string): string[] {
  return [...html.matchAll(/\/media\/([a-f0-9]{16,64}\.(?:jpg|png|webp))/gi)].map((match) => match[1]!.toLowerCase());
}

export function rewriteMedia(html: string, map: (src: string) => string): string {
  return html.replace(/src="(\/media\/[^"]+)"/g, (_match, src: string) => `src="${map(src)}"`);
}
