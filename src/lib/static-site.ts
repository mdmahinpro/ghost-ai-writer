import { mediaRefs, rewriteMedia } from "./media-html.ts";
import { articleImageSrc } from "./image-urls.ts";
import { portraitDataUri, avatarSeed, portraitSrc } from "./avatar.ts";
import { avatarUrlFor } from "./authors.ts";
import { AD_CODE_LIMIT, AD_SLOT_IDS, defaultAdSlots, type AdSlotConfig, type AdSlotId, type Article, type AuthorProfile, type Site } from "./types.ts";
import { esc } from "./utils.ts";

function css(): string {
  return `
    :root { color-scheme: light; --bg: #f7f3ea; --card: #fffdf8; --ink: #1b1813; --muted: #5b5449; --faint: #8a8171; --line: #e4dac6; --accent: #8a5a12; }
    * { box-sizing: border-box; }
    html { scroll-behavior: smooth; }
    body { margin: 0; background: radial-gradient(1200px 620px at 50% -12%, #fffaf1, transparent 68%), var(--bg); color: var(--ink); font: 18px/1.7 Georgia, "Iowan Old Style", serif; -webkit-font-smoothing: antialiased; }
    header, main, footer { width: min(1040px, calc(100% - 32px)); margin-inline: auto; }
    header { padding: 30px 0 14px; display: flex; justify-content: space-between; gap: 16px; align-items: baseline; border-bottom: 1px solid var(--line); }
    a { color: var(--accent); }
    a:hover { text-decoration-thickness: 2px; }
    .mark { font-family: "Outfit", "Avenir Next", sans-serif; letter-spacing: 0.16em; text-transform: uppercase; font-size: 12px; text-decoration: none; }
    h1 { font-weight: 500; font-size: clamp(30px, 4.6vw, 44px); line-height: 1.13; margin: 16px 0 10px; letter-spacing: -0.01em; }
    h2 { font-weight: 500; font-size: 26px; line-height: 1.2; margin: 34px 0 8px; }
    img { display: block; width: 100%; height: auto; border-radius: 12px; }
    figure { margin: 22px 0 10px; }
    .grid { display: grid; gap: 22px; grid-template-columns: repeat(auto-fill, minmax(260px, 1fr)); }
    .card { display: flex; flex-direction: column; gap: 8px; text-decoration: none; color: inherit; padding: 12px; border: 1px solid var(--line); border-radius: 16px; background: var(--card); transition: transform 0.18s ease, box-shadow 0.18s ease, border-color 0.18s ease; }
    .card:hover { transform: translateY(-3px); border-color: #d8cbae; box-shadow: 0 20px 40px -28px rgba(34, 24, 6, 0.6); }
    .card img { aspect-ratio: 16/9; object-fit: cover; margin-bottom: 2px; }
    /* The featured shot opens every post: wide 16:9 crop under the byline,
       matching the og:image that ships in the same page's head. */
    article.post figure.article-hero { margin: 6px 0 26px; border-radius: 16px; overflow: hidden; box-shadow: 0 16px 36px -26px rgba(34, 24, 6, 0.55); background: #eee4cf; }
    article.post figure.article-hero img { aspect-ratio: 16/9; object-fit: cover; width: 100%; height: auto; }
    .card strong { font-weight: 600; line-height: 1.3; }
    .meta { font-family: "Outfit", "Avenir Next", sans-serif; font-size: 13px; letter-spacing: 0.04em; color: var(--muted); }
    main > h1 + p { color: var(--muted); max-width: 60ch; }
    footer { margin-top: 40px; padding: 28px 0 48px; border-top: 1px solid var(--line); color: var(--muted); font-size: 14px; }
    article.post { width: min(720px, 100%); }
    /* Article body: the full markdown-subset the generator can emit. */
    article.post p { margin: 0 0 18px; }
    article.post h2, article.post h3, article.post h4 { font-family: "Outfit", "Avenir Next", sans-serif; line-height: 1.25; margin: 34px 0 10px; scroll-margin-top: 20px; }
    article.post h2 { font-size: 26px; }
    article.post h3 { font-size: 21px; margin-top: 26px; }
    article.post h4 { font-size: 18px; margin-top: 22px; }
    article.post a { color: var(--accent); text-decoration: underline; text-underline-offset: 3px; }
    article.post ul, article.post ol { margin: 0 0 18px; padding-left: 22px; }
    article.post li { margin: 5px 0; }
    article.post li.task-item { list-style: none; margin-left: -18px; }
    article.post strong { font-weight: 700; }
    article.post del { color: var(--faint); }
    article.post hr { border: 0; border-top: 1px solid var(--line); margin: 30px 0; }
    /* CLS safety: image cards reserve their space before load (code blocks do not). */
    article.post figure.kg-card { aspect-ratio: 16 / 10; background: #eee4cf; overflow: hidden; margin: 22px 0 10px; border-radius: 16px; box-shadow: 0 16px 36px -26px rgba(34, 24, 6, 0.55); }
    article.post figure.kg-card img { width: 100%; height: 100%; object-fit: cover; }
    /* The featured shot opens the post as a hero: wider crop, softer frame. */
    article.post > figure.kg-card:first-of-type { aspect-ratio: 16 / 9; margin: 6px 0 26px; }
    /* Tables scroll horizontally instead of clipping, and never shift layout. */
    article.post .table-scroll { overflow-x: auto; margin: 20px 0; -webkit-overflow-scrolling: touch; }
    article.post table { width: 100%; border-collapse: collapse; font-size: 16px; margin: 20px 0; }
    article.post .table-scroll table { margin: 0; }
    article.post th, article.post td { border: 1px solid var(--line); padding: 9px 11px; text-align: left; vertical-align: top; }
    article.post thead th { font-family: "Outfit", "Avenir Next", sans-serif; font-size: 13px; letter-spacing: 0.04em; text-transform: uppercase; background: #efe6d2; }
    article.post tbody tr:nth-child(even) td { background: #faf5ea; }
    article.post blockquote { margin: 20px 0; padding: 12px 18px; border-left: 4px solid #d9cdb4; background: var(--card); border-radius: 0 12px 12px 0; color: var(--muted); font-style: italic; }
    article.post blockquote p:last-child { margin-bottom: 0; }
    article.post pre { margin: 20px 0; padding: 15px 17px; overflow-x: auto; background: #f4efe3; border: 1px solid var(--line); border-radius: 12px; line-height: 1.5; }
    article.post code { font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace; font-size: 0.92em; background: #efe6d2; border-radius: 4px; padding: 1px 5px; }
    article.post pre code { display: block; background: none; padding: 0; font-size: 14px; white-space: pre; }
    article.post figure.code-block { margin: 20px 0; }
    article.post figure.code-block figcaption { font-family: "Outfit", "Avenir Next", sans-serif; font-size: 11px; letter-spacing: 0.08em; text-transform: uppercase; color: var(--faint); margin: 0 0 4px; }
    /* The card lede: real prose under the photo, never the keyword printed twice. */
    .card .lede { display: block; margin: 7px 0 2px; font-family: "Outfit", "Avenir Next", sans-serif; font-size: 12.5px; line-height: 1.5; text-transform: none; letter-spacing: 0; color: var(--faint); }
    article.post figure.code-block pre { margin: 0; }
    article.post aside.callout { margin: 20px 0; padding: 13px 17px; border: 1px solid var(--line); border-radius: 12px; background: var(--card); }
    article.post aside.callout .callout-title { margin: 0 0 6px; font-family: "Outfit", "Avenir Next", sans-serif; font-size: 13px; letter-spacing: 0.06em; text-transform: uppercase; }
    article.post aside.callout p:last-child { margin-bottom: 0; }
    article.post aside.callout-note, article.post aside.callout-important { border-left: 4px solid var(--accent); }
    article.post aside.callout-tip { border-left: 4px solid #2f6b3a; }
    article.post aside.callout-warning { border-left: 4px solid #b45309; }
    article.post aside.callout-caution { border-left: 4px solid #b91c1c; }
    article.post .footnotes { margin-top: 30px; padding-top: 12px; border-top: 1px solid var(--line); font-size: 14px; }
    article.post .footnotes ol { padding-left: 20px; }
    article.post sup.fn-ref a { text-decoration: none; }
    .byline { display: flex; gap: 14px; align-items: flex-start; margin: 20px 0 8px; padding: 16px; border: 1px solid var(--line); border-radius: 16px; background: var(--card); }
    .byline img { width: 52px; height: 52px; border-radius: 50%; object-fit: cover; flex: none; box-shadow: 0 8px 18px -12px rgba(34, 24, 6, 0.6); }
    .byline .badges { display: flex; flex-wrap: wrap; gap: 6px; margin-top: 6px; }
    .byline .badges span { font-family: "Outfit", "Avenir Next", sans-serif; font-size: 11px; letter-spacing: 0.04em; border: 1px solid var(--line); border-radius: 999px; padding: 2px 8px; color: var(--muted); background: var(--bg); }
    /* Rule 6 ad slots: empty slots collapse and cannot shift layout. */
    .ad-slot { margin: 20px 0; }
    .ad-slot:empty { display: none; margin: 0; }
    .ad-slot-label { display: block; font-family: "Outfit", "Avenir Next", sans-serif; font-size: 11px; letter-spacing: 0.14em; text-transform: uppercase; color: var(--faint); border: 1px dashed #d9cdb4; border-radius: 10px; padding: 10px 12px; text-align: center; background: var(--card); }
    .ad-rail { display: none; }
    @media (min-width: 1200px) {
      .post-layout { display: grid; grid-template-columns: minmax(0, 720px) 300px; gap: 32px; align-items: start; }
      .post-layout article.post { width: 100%; }
      .ad-rail { display: block; width: 300px; position: sticky; top: 24px; }
    }
  `;
}

function assetPath(fromPost: boolean, src: string): string {
  const file = src.split("/").pop() ?? "";
  return `${fromPost ? "../../" : ""}assets/img/${file}`;
}

// ---------------------------------------------------------------------------
// Rule 6 — the 7 ad slots
// ---------------------------------------------------------------------------

export function slotConfigs(site: Site): AdSlotConfig[] {
  const configured = site.ads;
  if (!configured?.length) return defaultAdSlots();
  return AD_SLOT_IDS.map((id) => configured.find((slot) => slot.id === id) ?? defaultAdSlots().find((slot) => slot.id === id)!);
}

/** Server-side 16 KiB enforcement: over-limit code is refused (never truncated silently). */
export function adCodeWithinLimit(code: string): boolean {
  return new TextEncoder().encode(code).length <= AD_CODE_LIMIT;
}

/** Deterministic hash of the ad configuration — recorded on every build for change detection. */
export function adsConfigHash(site: Site): string {
  const payload = slotConfigs(site).map((slot) => `${slot.id}:${slot.enabled ? 1 : 0}:${slot.adType}:${slot.code.length}:${slot.code}`).join("|");
  return hashArtifact(`ads:${site.adsEnabled ? 1 : 0}:${payload}`);
}

export function anyAdSlotEnabled(site: Site): boolean {
  return Boolean(site.adsEnabled) && slotConfigs(site).some((slot) => slot.enabled && slot.code.trim() && adCodeWithinLimit(slot.code));
}

/** AdSense loader is emitted once, only when a responsive slot is actually live. */
export function adSenseLoader(site: Site): string {
  const usesAdSense = slotConfigs(site).some((slot) => slot.enabled && slot.adType === "adsense_responsive" && slot.code.trim());
  if (!site.adsEnabled || !usesAdSense) return "";
  return `<script async src="https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=ca-pub-placeholder" crossorigin="anonymous"></script>`;
}

/**
 * Renders one slot. The container always ships (so the 7-slot contract is stable
 * and analytics can find it), but content only appears when the slot is enabled
 * and inside the 16 KiB limit. Preview mode renders a labeled placeholder and
 * never runs live ad code.
 */
export function adSlotHtml(site: Site, id: AdSlotId, preview = false): string {
  const config = slotConfigs(site).find((slot) => slot.id === id)!;
  const inner = (() => {
    if (preview) return `<span class="ad-slot-label">Ad slot · ${esc(config.name)} · ${esc(config.adType === "adsense_responsive" ? "AdSense responsive" : "custom code")}${config.enabled ? "" : " · disabled"}</span>`;
    if (!site.adsEnabled || !config.enabled || !config.code.trim()) return "";
    if (!adCodeWithinLimit(config.code)) return `<!-- ad-slot:${id} rejected: code exceeds the 16 KiB limit -->`;
    if (config.adType === "adsense_responsive") {
      return `<ins class="adsbygoogle" style="display:block" data-ad-client="ca-pub-placeholder" data-ad-slot="${esc(config.code.trim())}" data-ad-format="auto" data-full-width-responsive="true"></ins>`;
    }
    return config.code;
  })();
  const railClass = id === "article_sidebar" ? " ad-rail" : "";
  return `<div data-ad-slot="${id}" class="ad-slot${railClass}">${inner}</div>`;
}

/** M3 compatibility: reserved placeholder (kept for tests/templates that expect the empty container). */
export function adSlotPlaceholder(slot: AdSlotId): string {
  return `<div data-ad-slot="${slot}" class="ad-slot"></div>`;
}

/** article_inline placement: after the 3rd top-level paragraph, and only with ≥6 top-level paragraphs. */
export function inlineAdTargetOk(html: string): boolean {
  const matches = html.match(/<\/p>/gi) ?? [];
  return matches.length >= 6;
}

export function injectInlineAd(html: string, adHtml: string, preview = false): string {
  if (!adHtml) return html;
  if (!preview && !inlineAdTargetOk(html)) return html;
  let seen = 0;
  let index = 0;
  while (seen < 3) {
    const next = html.indexOf("</p>", index);
    if (next < 0) return html;
    seen += 1;
    index = next + 4;
    if (seen === 3) return `${html.slice(0, index)}\n${adHtml}\n${html.slice(index)}`;
  }
  return html;
}

/** Rule 3b/2: valid JSON-LD `Article` whose author is a rich `Person`. */
export function articleJsonLd(input: {
  site: Site;
  article: Pick<Article, "title" | "slug" | "excerpt" | "metaTitle" | "metaDescription" | "publishedAt" | "keyword">;
  author?: AuthorProfile;
  origin: string;
}): string {
  const origin = input.origin;
  const author = input.author;
  const person = author
    ? {
        "@type": "Person",
        name: author.name,
        jobTitle: author.role,
        description: author.shortBio,
        image: author.avatarUrl,
        knowsAbout: author.expertise,
        homeLocation: { "@type": "Place", name: `${author.city}, ${author.region}, US` },
        url: `${origin}/author/${author.slug}/`,
      }
    : { "@type": "Person", name: input.site.authors || input.site.staticName };
  return JSON.stringify({
    "@context": "https://schema.org",
    "@type": "Article",
    headline: input.article.metaTitle || input.article.title,
    description: input.article.metaDescription || input.article.excerpt,
    datePublished: new Date(input.article.publishedAt).toISOString(),
    inLanguage: "en-US",
    keywords: [input.article.keyword],
    mainEntityOfPage: `${origin}/post/${input.article.slug}/`,
    author: person,
  });
}

/** Byline card HTML. The avatar is a hot-linked external URL — zero disk storage. */
/**
 * Portrait `<img>` for the exported site: the external AI-portrait URL stays the
 * primary source (zero disk), rendered with `referrerpolicy="no-referrer"`, and
 * an inline SVG fallback swaps in if the host blocks the request or is offline —
 * so the portrait renders 100% of the time without shipping any image file.
 */
export function avatarImgHtml(author: AuthorProfile, size = 52): string {
  const fallback = portraitDataUri(avatarSeed(author.avatarUrl) ?? author.id, author.name, 96).replace(/'/g, "%27");
  // `portraitSrc` keeps a captured portrait verbatim and puts anything still
  // pointing at the face generator behind the resize CDN — a raw generator URL
  // is a ~500 KB download that returns a different stranger every request.
  const src = portraitSrc(author, Math.max(96, size * 2));
  return `<img src="${esc(src || fallback)}" alt="Portrait of ${esc(author.name)}" width="${size}" height="${size}" loading="lazy" decoding="async" referrerpolicy="no-referrer" onerror="this.onerror=null;this.src='${fallback}'" />`;
}

export function authorBylineHtml(author: AuthorProfile | undefined, origin: string): string {
  if (!author) return "";
  const badges = author.expertise.map((tag) => `<span>${esc(tag)}</span>`).join("");
  return `<div class="byline">
  ${avatarImgHtml(author)}
  <div>
    <a class="meta" href="${esc(origin)}/author/${esc(author.slug)}/">${esc(author.name)}</a>
    <div class="meta">${esc(author.role)} · ${esc(author.city)}, ${esc(author.region)} · ${author.articleCount}/${author.maxArticles} articles</div>
    <p style="margin:6px 0 0; font-size: 15px;">${esc(author.shortBio)}</p>
    <div class="badges">${badges}</div>
  </div>
</div>`;
}

/**
 * A byline for an article that has a name but no full author record.
 *
 * Server-generated articles carry `authorName`/`authorBeat`/`authorCity` on the
 * row itself and no matching `AuthorProfile` in the client store. Rendering
 * nothing for those left every generated page without a byline, which is the
 * exact condition the "Named author" checklist gate fails on. The avatar still
 * resolves, because it is derived from the name.
 */
export function authorNameBylineHtml(
  name: string,
  origin: string,
  beat?: string,
  city?: string,
): string {
  const label = name.trim();
  if (!label) return "";
  const slug = label.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
  const meta = [beat, city].map((part) => part?.trim()).filter(Boolean).join(" · ");
  const avatar = avatarImgHtml({
    name: label,
    avatarUrl: avatarUrlFor(`${slug}:${label}`),
  } as AuthorProfile);
  return `<div class="byline">
  ${avatar}
  <div>
    <a class="meta" href="${esc(origin)}/author/${esc(slug)}/">${esc(label)}</a>
    ${meta ? `<div class="meta">${esc(meta)}</div>` : ""}
  </div>
</div>`;
}

export function staticFiles(
  site: Site,
  articles: Article[],
  withSnippets: boolean,
  authors: AuthorProfile[] = [],
  options: { adsPreview?: boolean } = {},
): { name: string; text: string }[] {
  const preview = Boolean(options.adsPreview);
  const origin = site.publicUrl.replace(/\/$/, "");
  const pages = articles.filter((a) => a.siteId === site.id);
  // Resolve the byline by id first, then by name. Server-backed articles carry
  // the byline name straight from the article row and have no author record in
  // the client store, so matching on id alone rendered an empty byline for every
  // generated page — and the "Named author" checklist gate could never pass.
  const authorOf = (article: Article): AuthorProfile | undefined =>
    authors.find((author) => author.id === article.authorId) ??
    authors.find((author) => author.name === article.authorName);
  const headExtra = withSnippets ? `\n${site.headHtml}\n` : "";
  const bodyEnd = withSnippets ? `\n${site.bodyEnd}\n${site.analyticsSnippet}\n` : "";
  // Preview mode never loads live ad integrations.
  const adLoader = preview ? "" : adSenseLoader(site);
  const slot = (id: AdSlotId) => adSlotHtml(site, id, preview);
  // home_feed: after the sixth card, only when the feed has at least seven posts.
  const feedAd = pages.length >= 7 ? slot("home_feed") : "";
  // The card's caption. It used to be the raw keyword — "post phd career
// transition from academia to industry r d" printed above "From Academia to
// Industry R&D", the same words twice, the first one lowercase and unreadable.
// The description says something the title does not, which is what a lede is
// for; a card with neither falls back to the title alone.
function cardLede(article: { metaDescription?: string; excerpt?: string }): string {
  const text = (article.metaDescription || article.excerpt || "").replace(/\s+/g, " ").trim().slice(0, 118);
  return text ? `<span class="lede">${esc(text)}</span>` : "";
}

const home = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(site.staticName)}</title>
<link rel="canonical" href="${esc(origin)}/">
<meta name="robots" content="${esc(site.robots)}">
<link rel="stylesheet" href="assets/site.css">${adLoader}${headExtra}
</head>
<body>
${slot("site_top")}
<header><a class="mark" href="./">${esc(site.staticName)}</a><span class="meta">${esc(site.authors)}</span></header>
<main>
  <h1>${esc(site.staticName)}</h1>
  <p>${esc(site.footer)}</p>
  <div class="grid">
    ${pages
      .slice(0, 6)
      .map((article) => {
        const featured = article.images.find((image) => image.role === "featured") ?? article.images[0];
        const photo = featured ? `<img src="${esc(articleImageSrc(featured, article.keyword || article.title))}" alt="${esc(featured.alt || article.title)}" width="474" height="274" loading="lazy" decoding="async" referrerpolicy="no-referrer" />` : "";
        return `<a class="card" href="./post/${esc(article.slug)}/">${photo}${cardLede(article)}<strong>${esc(article.title)}</strong></a>`;
      })
      .join("\n")}
    ${feedAd}
    ${pages
      .slice(6)
      .map((article) => {
        const featured = article.images.find((image) => image.role === "featured") ?? article.images[0];
        const photo = featured ? `<img src="${esc(articleImageSrc(featured, article.keyword || article.title))}" alt="${esc(featured.alt || article.title)}" width="474" height="274" loading="lazy" decoding="async" referrerpolicy="no-referrer" />` : "";
        return `<a class="card" href="./post/${esc(article.slug)}/">${photo}${cardLede(article)}<strong>${esc(article.title)}</strong></a>`;
      })
      .join("\n")}
  </div>
</main>
<footer>${esc(site.footer)}</footer>
${slot("site_bottom")}
${bodyEnd}
</body></html>`;
  // One shared stylesheet instead of re-inlining ~2.5 KB of CSS into every page:
  // smaller artifacts, smaller deploys, and a cached stylesheet across the site.
  const files = [{ name: "assets/site.css", text: css() }, { name: "index.html", text: home }];
  for (const article of pages) {
    const html = rewriteMedia(article.html, (src) => assetPath(true, src));
    const author = authorOf(article);
    const jsonLd = articleJsonLd({ site, article, author, origin });
    const hero = article.images.find((image) => image.role === "featured") ?? article.images[0];
    const heroSrc = hero ? articleImageSrc(hero, article.keyword || article.title) : "";
    const share = [
      `<meta property="og:type" content="article">`,
      `<meta property="og:url" content="${esc(origin)}/post/${esc(article.slug)}/">`,
      `<meta property="og:title" content="${esc(article.metaTitle || article.title)}">`,
      // The byline and the publish date are what a crawler needs to attribute the
      // page; the keyword line below the H1 used to carry nothing at all.
      `<meta property="og:description" content="${esc(article.metaDescription || article.excerpt)}">`,
      `<meta name="theme-color" content="#f7f3ea">`,
      article.publishedAt
        ? `<meta property="article:published_time" content="${esc(new Date(article.publishedAt).toISOString())}">`
        : "",
      heroSrc ? `<meta property="og:image" content="${esc(heroSrc)}">` : "",
      heroSrc ? `<meta name="twitter:card" content="summary_large_image">` : "",
    ]
      .filter(Boolean)
      .join("\n");
    // article_inline: after top-level paragraph 3, only when a live article has ≥6 of them.
    const withInline = injectInlineAd(html, slot("article_inline"), preview);
    files.push({
      name: `post/${article.slug}/index.html`,
      text: `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(article.metaTitle || article.title)} · ${esc(site.staticName)}</title>
<link rel="canonical" href="${esc(origin)}/post/${esc(article.slug)}/">
<meta name="description" content="${esc(article.metaDescription || article.excerpt)}">
<meta name="robots" content="${esc(site.robots)}">
${share}
<script type="application/ld+json">${jsonLd}</script>
<link rel="stylesheet" href="../../assets/site.css">${adLoader}${headExtra}
</head>
<body>
${slot("site_top")}
<header><a class="mark" href="../../">${esc(site.staticName)}</a><span class="meta">${esc(article.status)}</span></header>
<main>
<div class="post-layout">
<article class="post">
  ${slot("article_top")}
  <h1>${esc(article.title)}</h1>
  ${authorBylineHtml(author, origin) ||
    authorNameBylineHtml(
      article.authorName ?? "",
      origin,
      article.authorBeat,
      article.authorCity,
    )}
  ${heroSrc ? `<figure class="article-hero"><img src="${esc(heroSrc)}" alt="${esc(hero?.alt || article.title)}" width="${hero?.width ?? 1200}" height="${hero?.height ?? 675}" loading="eager" decoding="async" referrerpolicy="no-referrer"></figure>` : ""}
  ${withInline}
  ${slot("article_bottom")}
</article>
${slot("article_sidebar")}
</div>
</main>
<footer>${esc(site.footer)}</footer>
${slot("site_bottom")}
${bodyEnd}
</body></html>`,
    });
  }
  // Rule 2: one author archive per author so the Person `url` anchor resolves.
  for (const author of authors) {
    const own = pages.filter((article) => article.authorId === author.id);
    if (!own.length) continue;
    const jsonLd = JSON.stringify({
      "@context": "https://schema.org",
      "@type": "Person",
      name: author.name,
      jobTitle: author.role,
      description: author.shortBio,
      image: author.avatarUrl,
      knowsAbout: author.expertise,
      homeLocation: { "@type": "Place", name: `${author.city}, ${author.region}, US` },
      url: `${origin}/author/${author.slug}/`,
    });
    files.push({
      name: `author/${author.slug}/index.html`,
      text: `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(author.name)} · ${esc(site.staticName)}</title>
<link rel="canonical" href="${esc(origin)}/author/${esc(author.slug)}/">
<meta name="robots" content="${esc(site.robots)}">
<script type="application/ld+json">${jsonLd}</script>
<link rel="stylesheet" href="../../assets/site.css">
</head>
<body>
<header><a class="mark" href="../../">${esc(site.staticName)}</a><span class="meta">Author</span></header>
<main>
  <div class="byline" style="max-width: 720px;">
    ${avatarImgHtml(author)}
    <div>
      <h1 style="font-size: 30px; margin: 0;">${esc(author.name)}</h1>
      <div class="meta">${esc(author.role)} · ${esc(author.city)}, ${esc(author.region)}, US · ${author.articleCount}/${author.maxArticles} articles</div>
      <p style="margin: 8px 0 0;">${esc(author.shortBio)}</p>
      <div class="badges">${author.expertise.map((tag) => `<span>${esc(tag)}</span>`).join("")}</div>
    </div>
  </div>
  <div class="grid" style="margin-top: 24px;">
    ${own
      .map(
        (article) =>
          `<a class="card" href="../../post/${esc(article.slug)}/">${cardLede(article)}<strong>${esc(article.title)}</strong></a>`,
      )
      .join("\n")}
  </div>
</main>
<footer>${esc(site.footer)}</footer>
</body></html>`,
    });
  }
  const urls = [`${origin}/`, ...pages.map((a) => `${origin}/post/${a.slug}/`), ...authors.map((a) => `${origin}/author/${a.slug}/`)];
  files.push({
    name: "sitemap.xml",
    text: `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls
      .map((u) => `  <url><loc>${esc(u)}</loc></url>`)
      .join("\n")}\n</urlset>\n`,
  });
  files.push({
    name: "robots.txt",
    text: site.robots.startsWith("noindex")
      ? `User-agent: *\nDisallow: /\n`
      : `User-agent: *\nAllow: /\nSitemap: ${origin}/sitemap.xml\n`,
  });
  const keyFile = indexNowKeyFile(site.indexNowKey ?? "");
  if (keyFile) files.push(keyFile);
  // Rule 6: ads.txt ships as a tracked build artifact whenever it is configured.
  const adsTxt = (site.adsTxt ?? "").trim();
  if (adsTxt) files.push({ name: "ads.txt", text: `${adsTxt}\n` });
  return files;
}

/** Rule 6 route-diff: the route set of a build (HTML routes + text artifacts), sorted. */
export function buildRoutes(files: { name: string }[]): string[] {
  const routes = new Set<string>();
  for (const file of files) {
    if (file.name === "index.html") routes.add("/");
    else if (file.name.endsWith("/index.html")) routes.add(`/${file.name.slice(0, -"index.html".length)}`);
    else if (/\.(txt|xml)$/i.test(file.name)) routes.add(`/${file.name}`);
  }
  return [...routes].sort();
}

export function hashArtifact(text: string): string {
  let hash = 2166136261;
  for (let index = 0; index < text.length; index++) hash = Math.imul(hash ^ text.charCodeAt(index), 16777619);
  return (hash >>> 0).toString(16).padStart(8, "0");
}

export function indexNowKeyFile(key: string): { name: string; text: string } | null {
  if (!/^[a-zA-Z0-9-]{8,128}$/.test(key)) return null;
  return { name: `${key}.txt`, text: key };
}

export function staticMedia(articles: Article[]): { name: string; remote?: string }[] {
  const seen = new Set<string>();
  const files: { name: string; remote?: string }[] = [];
  for (const article of articles) {
    for (const name of mediaRefs(article.html)) {
      if (seen.has(name)) continue;
      seen.add(name);
      const image = article.images.find((item) => item.src?.endsWith(name));
      files.push({ name, remote: image?.remote });
    }
  }
  return files;
}
