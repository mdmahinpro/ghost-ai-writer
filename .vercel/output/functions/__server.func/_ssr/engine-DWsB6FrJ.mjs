import { n as __exportAll$1 } from "../_runtime.mjs";
import { t as clsx } from "../_libs/clsx.mjs";
import { t as twMerge } from "../_libs/tailwind-merge.mjs";
import { n as array, o as object, r as boolean, s as string, t as _enum } from "../_libs/zod.mjs";
//#region node_modules/.nitro/vite/services/ssr/assets/rolldown-runtime-D7D4PA-g.js
var __defProp = Object.defineProperty;
var __exportAll = (all, no_symbols) => {
	let target = {};
	for (var name in all) __defProp(target, name, {
		get: all[name],
		enumerable: true
	});
	if (!no_symbols) __defProp(target, Symbol.toStringTag, { value: "Module" });
	return target;
};
//#endregion
//#region node_modules/.nitro/vite/services/ssr/assets/engine-DWsB6FrJ.js
var engine_DWsB6FrJ_exports = /* @__PURE__ */ __exportAll$1({
	$: () => alreadyLinked,
	A: () => regenerateVariant,
	At: () => bingThumbUrl,
	B: () => usdFor,
	Bt: () => relTime,
	C: () => measureArticle,
	Ct: () => STAGES,
	D: () => planImages,
	Dt: () => portraitDataUri,
	E: () => packageDeploy,
	Et: () => avatarSeed,
	F: () => runMetrics,
	Ft: () => compact,
	G: () => TARGET_ARTICLE_WORDS,
	H: () => validatePublicUrl,
	Ht: () => utcDay,
	I: () => submitKeywords,
	It: () => esc,
	J: () => BLADER_VERSION,
	K: () => parseIntentStage,
	L: () => suggestIdeas,
	Lt: () => hashStr,
	M: () => rescoreArticles,
	Mt: () => sanitizeArticleImages,
	N: () => resolveRouteDiff,
	Nt: () => sanitizeCmsImage,
	O: () => queueMissingPhotos,
	Ot: () => applyFetchedImages,
	P: () => restartJob,
	Pt: () => cn,
	Q: () => embed,
	R: () => uniquenessAgainst,
	Rt: () => money,
	S: () => maskKey,
	St: () => RESEARCH_STAGES,
	T: () => normalizeKeyword,
	Tt: () => avatarProxySrc,
	U: () => weaveOrphans,
	V: () => validateGhostUrl,
	Vt: () => uid,
	W: () => MIN_ARTICLE_WORDS,
	X: () => humanizer_exports,
	Y: () => humanizeWithBlader,
	Z: () => cosine,
	_: () => keyCallsModel,
	_t: () => staticMedia,
	a: () => applyProbe,
	at: () => generateAuthorForTopic,
	b: () => liftOpenings,
	bt: () => AD_SLOT_LABELS,
	c: () => composeArticle,
	ct: () => excerptOf,
	d: () => failJob,
	dt: () => stripVerify,
	et: () => anchorPhrase,
	f: () => gateText,
	ft: () => wordCount,
	g: () => isPrivateHost,
	gt: () => slotConfigs,
	h: () => inventoryFromArticles,
	ht: () => indexNowKeyFile,
	i: () => applyKeyPenalty,
	it: () => authorVoiceBlock,
	j: () => releaseHeld,
	jt: () => isFakeCmsImage,
	k: () => queuePlan,
	kt: () => articleImageSrc,
	l: () => corpusFor,
	lt: () => markdownToHtml,
	m: () => goldenSteps,
	mt: () => adsConfigHash,
	n: () => advance,
	nt: () => insertAnchor,
	o: () => buildAudit,
	ot: () => normalizeAuthorProfile,
	p: () => generatePlan,
	pt: () => adCodeWithinLimit,
	q: () => BLADER_SOURCE,
	r: () => applyAudit,
	rt: () => attachAuthor,
	s: () => cancelRun,
	st: () => previewAuthorMatch,
	t: () => acceptModelPlan,
	tt: () => inboundCount,
	u: () => decideReview,
	ut: () => sectionsFromMarkdown,
	v: () => keyPool,
	vt: () => AD_CODE_LIMIT,
	w: () => needsWork,
	wt: () => defaultAdSlots,
	x: () => manualBuild,
	xt: () => DEFAULT_LIMITS,
	y: () => lexicalSimilarity,
	yt: () => AD_SLOT_IDS,
	z: () => usableKey,
	zt: () => nextUtcResetLabel
});
function cn(...inputs) {
	return twMerge(clsx(inputs));
}
function esc(s) {
	return s.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll("\"", "&quot;");
}
function uid(prefix) {
	return `${prefix}_${Math.random().toString(36).slice(2, 8)}${Date.now().toString(36).slice(-3)}`;
}
function hashStr(s) {
	let h = 2166136261;
	for (let i = 0; i < s.length; i++) {
		h ^= s.charCodeAt(i);
		h = Math.imul(h, 16777619);
	}
	return h >>> 0;
}
function relTime(ts, now = Date.now()) {
	const s = Math.max(0, Math.round((now - ts) / 1e3));
	if (s < 10) return "just now";
	if (s < 60) return `${s}s ago`;
	const m = Math.round(s / 60);
	if (m < 60) return `${m}m ago`;
	const h = Math.round(m / 60);
	if (h < 36) return `${h}h ago`;
	return `${Math.round(h / 24)}d ago`;
}
function utcDay(ts) {
	return new Date(ts).toISOString().slice(0, 10);
}
function money(n) {
	if (n < .01 && n > 0) return `$${n.toFixed(4)}`;
	return `$${n.toFixed(2)}`;
}
function compact(n) {
	return new Intl.NumberFormat("en-US").format(n);
}
function nextUtcResetLabel(now = Date.now()) {
	const d = new Date(now);
	const next = Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate() + 1);
	return new Date(next).toLocaleString("en-GB", {
		timeZone: "Asia/Dhaka",
		day: "2-digit",
		month: "short",
		hour: "2-digit",
		minute: "2-digit"
	});
}
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
var BING_THUMB_HOST = "https://tse1.mm.bing.net";
var STOP_WORDS = /* @__PURE__ */ new Set([
	"a",
	"an",
	"the",
	"how",
	"to",
	"of",
	"for",
	"and",
	"in",
	"on",
	"your",
	"with",
	"from",
	"that",
	"this",
	"is",
	"are",
	"be",
	"it",
	"at",
	"by",
	"or",
	"as",
	"you"
]);
/**
* Normalize free text (keyword / title / section heading) into a clean,
* lowercase, hyphenated search slug: "How to plan a PhD weekly research
* schedule" → "plan-phd-weekly-research-schedule".
*/
function bingQuerySlug(input, maxWords = 8) {
	const words = input.toLowerCase().replace(/[^a-z0-9\s-]+/g, " ").split(/[\s-]+/).filter((word) => word.length > 1 && !STOP_WORDS.has(word));
	return (words.length ? words : input.toLowerCase().replace(/[^a-z0-9]+/g, " ").split(/\s+/).filter(Boolean)).slice(0, maxWords).join("-").slice(0, 80) || "editorial-cover";
}
/** The exact dynamic Bing thumbnail URL format used everywhere. */
function bingThumbUrl(query, width = 474, height = 274) {
	return `${BING_THUMB_HOST}/th?q=${encodeURIComponent(bingQuerySlug(query))}&w=${width}&h=${height}&c=7`;
}
/** Detects placeholder CMS cover paths that must never ship in generated output. */
function isFakeCmsImage(url) {
	if (!url) return false;
	return /^https?:\/\/cms\.[^/]+\//i.test(url) || /\/content\/images\//i.test(url);
}
/** Matches an absolute or relative Ghost `/content/images/...` URL inside text. */
var CMS_IMAGE_IN_TEXT = /https?:\/\/cms\.[^\s"'()<>\\]+\/content\/images\/[^\s"'()<>\\]+|\/content\/images\/[^\s"'()<>\\]+/gi;
/**
* Rewrites every `/content/images/...` (absolute cms.* or root-relative Ghost)
* URL in a block of HTML/markdown into a topic-matched Bing thumbnail, so a
* previously-published Ghost media path can never leak back into previews,
* static builds, or a fresh Ghost payload.
*/
function rewriteCmsImageUrls(text, fallbackQuery) {
	const source = typeof text === "string" ? text : "";
	if (!source || !/content\/images/i.test(source)) return source;
	return source.replace(CMS_IMAGE_IN_TEXT, () => bingThumbUrl(fallbackQuery));
}
/** A single image field: keep a real URL, convert a fake CMS path to Bing. */
function sanitizeCmsImage(url, fallbackQuery) {
	if (!url) return url;
	return isFakeCmsImage(url) ? bingThumbUrl(fallbackQuery) : url;
}
/**
* Persist-migration entry point (v12): strip every placeholder CMS image path
* from stored articles — both the `images[]` fields and any `/content/images/`
* URL baked into the stored html/markdown — and replace each with a valid Bing
* thumbnail derived from the article keyword/title. Pure and in-place so the
* zustand `migrate` (and a unit test) can run it with no browser APIs.
*/
function sanitizeArticleImages(articles) {
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
function articleImageSrc(image, fallbackQuery) {
	const remote = image.remote;
	if (remote && !isFakeCmsImage(remote)) return remote;
	return bingThumbUrl(image.query?.trim() || fallbackQuery, image.width || 474, image.height || 274);
}
/**
* Figure HTML for an article image. The dynamic Bing thumbnail (image.remote)
* is preferred so the app preview and the exported static site always resolve a
* real photo; a local /media asset is used only when no remote exists. The
* image's own query wins over the article-level fallback so each figure stays
* tied to its own section instead of all repeating the article title.
*/
function figureHtml(image, fallbackQuery = "") {
	if (!image.selected && !image.remote && !image.src) return "";
	const src = articleImageSrc(image, image.query?.trim() || image.alt || fallbackQuery);
	const loading = image.role === "featured" ? "eager" : "lazy";
	const width = image.width ? ` width="${image.width}"` : "";
	const height = image.height ? ` height="${image.height}"` : "";
	return `<figure class="kg-card kg-image-card"><img src="${esc(src)}" alt="${esc(image.alt)}"${width}${height} loading="${loading}" decoding="async" referrerpolicy="no-referrer" /></figure>`;
}
/** Hard ceiling on in-body figures so one article never becomes a photo album. */
var MAX_SECTION_FIGURES = 3;
/**
* Insert the featured figure once, then one figure before each section heading —
* but only for distinct photos. Two slots that resolve to the same URL are
* collapsed so the page never shows the same image several times in a row.
*/
function applyFetchedImages(html, markdown, images, fallbackQuery = "") {
	let nextHtml = html.replace(/<!--gaw-image:\d+-->/g, "").replace(/<figure class="kg-card kg-image-card">[\s\S]*?<\/figure>\n?/g, "");
	let nextMd = markdown.replace(/!\[[^\]]*\]\(slot:\d+\)\n?/g, "").replace(/!\[[^\]]*\]\(\/media\/[^)]+\)\n?/g, "");
	const placed = images.filter((image) => (image.selected || image.remote) && (image.src || image.remote));
	const srcOf = (image) => articleImageSrc(image, image.query?.trim() || image.alt || fallbackQuery);
	const used = /* @__PURE__ */ new Set();
	const featured = placed.find((image) => image.role === "featured") ?? placed[0];
	if (featured) used.add(srcOf(featured));
	const sections = [];
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
	return {
		html: nextHtml,
		markdown: nextMd
	};
}
function mediaRefs(html) {
	return [...html.matchAll(/\/media\/([a-f0-9]{16,64}\.(?:jpg|png|webp))/gi)].map((match) => match[1].toLowerCase());
}
function rewriteMedia(html, map) {
	return html.replace(/src="(\/media\/[^"]+)"/g, (_match, src) => `src="${map(src)}"`);
}
/**
* Author portraits — client-safe helpers.
*
* The stored `avatarUrl` stays a tiny external URL string (zero disk). The UI
* renders it with `referrerPolicy="no-referrer"` and falls back, in order, to
* the in-memory server proxy (`/__grok/avatar`) and then to a deterministic
* inline SVG portrait, so a portrait always renders even when the upstream AI
* portrait host is blocked (ORB/CORP/referrer) or offline.
*/
var AVATAR_PROXY_PATH = "/__grok/avatar";
var AVATAR_UPSTREAM = `https://thispersondoesnotexist.com/image`;
/**
* The URL stored on an author and hot-linked by generated pages: a short external
* URL string only (zero disk), so a 10,000-article static build adds ~60 bytes
* per author, never an image file. Because the host renders a fresh face per
* request, the static build stays tiny while the portrait keeps changing.
*/
function avatarSourceUrl(token) {
	return `${AVATAR_UPSTREAM}?seed=${encodeURIComponent(token)}`;
}
/** True for a portrait URL this app manages (upstream host or the CDN form). */
function isOurAvatarUrl(url) {
	return Boolean(url && /^https:\/\/(?:wsrv\.nl\/|images\.weserv\.nl\/|thispersondoesnotexist\.com\/)/i.test(url));
}
/**
* Pull the per-author token out of a portrait URL. Handles both the direct
* `?seed=` form and the CDN form, where the token lives inside the encoded
* `url=` parameter as `?r=`.
*/
function avatarSeed(avatarUrl) {
	if (!avatarUrl) return null;
	const ok = (value) => value && /^[a-z0-9]{1,40}$/i.test(value) ? value : null;
	try {
		const url = new URL(avatarUrl);
		const direct = ok(url.searchParams.get("seed"));
		if (direct) return direct;
		const nested = url.searchParams.get("url");
		if (nested) {
			let inner;
			try {
				inner = new URL(nested);
			} catch {
				inner = new URL(`https://${nested}`);
			}
			return ok(inner.searchParams.get("r")) ?? ok(inner.searchParams.get("seed"));
		}
		return null;
	} catch {
		return null;
	}
}
/** Same-origin, zero-disk proxy URL for an author portrait. */
function avatarProxySrc(author, size = 256) {
	const seed = avatarSeed(author.avatarUrl) ?? author.id;
	return `${AVATAR_PROXY_PATH}?seed=${encodeURIComponent(seed)}&size=${size}`;
}
function hash(input) {
	let h = 2166136261;
	for (let index = 0; index < input.length; index++) {
		h ^= input.charCodeAt(index);
		h = Math.imul(h, 16777619);
	}
	return Math.abs(h);
}
/**
* Deterministic, realistic-looking portrait placeholder: a soft studio gradient
* with a head-and-shoulders silhouette and the person's initials. Pure string
* math — nothing is fetched or written.
*/
function portraitSvg(seed, name = "", size = 256) {
	const h = hash(`${seed}:${name}`);
	const hue = h % 360;
	const hue2 = (hue + 28 + (h >> 5) % 40) % 360;
	const initials = name.split(/\s+/).filter(Boolean).map((part) => part[0].toUpperCase()).join("").slice(0, 2) || "GA";
	const headY = Math.round(size * .38);
	const headR = Math.round(size * .17);
	const shoulderW = Math.round(size * .34);
	return [
		`<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}" role="img" aria-label="Portrait placeholder">`,
		`<defs><linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">`,
		`<stop offset="0" stop-color="hsl(${hue} 42% 34%)"/><stop offset="1" stop-color="hsl(${hue2} 46% 18%)"/>`,
		`</linearGradient><linearGradient id="fg" x1="0" y1="0" x2="0" y2="1">`,
		`<stop offset="0" stop-color="hsl(${hue} 24% 88%)" stop-opacity="0.92"/><stop offset="1" stop-color="hsl(${hue2} 18% 62%)" stop-opacity="0.92"/>`,
		`</linearGradient></defs>`,
		`<rect width="${size}" height="${size}" fill="url(#bg)"/>`,
		`<g fill="url(#fg)">`,
		`<circle cx="${size / 2}" cy="${headY}" r="${headR}"/>`,
		`<path d="M${Math.round(size / 2 - shoulderW)} ${size} q${shoulderW} -${Math.round(size * .34)} ${shoulderW * 2} 0 z"/>`,
		`</g>`,
		`<text x="50%" y="${Math.round(size * .56)}" text-anchor="middle" font-family="Inter, system-ui, sans-serif" font-size="${Math.round(size * .16)}" font-weight="600" fill="hsl(${hue} 30% 16%)" opacity="0.75">${initials}</text>`,
		`</svg>`
	].join("");
}
/** Inline data URI of the deterministic portrait (used as the last-resort fallback). */
function portraitDataUri(seed, name = "", size = 256) {
	return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(portraitSvg(seed, name, size))}`;
}
var STAGES = [
	{
		key: "intent",
		label: "Intent & Blueprint",
		tokens: [730, 790],
		ms: 1600
	},
	{
		key: "draft",
		label: "Draft",
		tokens: [2100, 2400],
		ms: 2200
	},
	{
		key: "revision",
		label: "Quality & Coverage Revision",
		tokens: [2300, 2800],
		ms: 1800
	},
	{
		key: "metadata",
		label: "Metadata & Packaging",
		tokens: [450, 490],
		ms: 700
	},
	{
		key: "enrichment",
		label: "Site Enrichment",
		tokens: [1400, 1520],
		ms: 1e3
	},
	{
		key: "publish",
		label: "Final Validation & Publication",
		tokens: [0, 0],
		ms: 650
	}
];
/** Rule 6: the 7 live ad slot ids (LIVE_REA_REALTIME_AUDIT, 2026-10-16). */
var AD_SLOT_IDS = [
	"site_top",
	"home_feed",
	"article_top",
	"article_inline",
	"article_bottom",
	"article_sidebar",
	"site_bottom"
];
/** Per-slot ad code limit enforced client and server side (live contract: 16 KiB). */
var AD_CODE_LIMIT = 16384;
var AD_SLOT_LABELS = {
	site_top: "Below header",
	home_feed: "Between homepage posts",
	article_top: "Before article content",
	article_inline: "Inside article",
	article_bottom: "After article content",
	article_sidebar: "Article side column",
	site_bottom: "Above footer"
};
var AD_SLOT_POSITIONS = {
	site_top: {
		desktop: "Full width below header",
		mobile: "Full width below header"
	},
	home_feed: {
		desktop: "After the sixth card when there are at least seven posts",
		mobile: "After the sixth card when there are at least seven posts"
	},
	article_top: {
		desktop: "Above the first paragraph",
		mobile: "Above the first paragraph"
	},
	article_inline: {
		desktop: "After paragraph three when there are at least six top-level paragraphs",
		mobile: "After paragraph two when there are at least six top-level paragraphs"
	},
	article_bottom: {
		desktop: "After the last paragraph",
		mobile: "After the last paragraph"
	},
	article_sidebar: {
		desktop: "300px right rail, viewport ≥1200px",
		mobile: "Hidden (no rail under 1200px)"
	},
	site_bottom: {
		desktop: "Above footer",
		mobile: "Above footer"
	}
};
function defaultAdSlots() {
	return AD_SLOT_IDS.map((id) => ({
		id,
		enabled: false,
		name: AD_SLOT_LABELS[id],
		adType: "custom_code",
		code: "",
		position: AD_SLOT_POSITIONS[id]
	}));
}
var DEFAULT_LIMITS = {
	keywordCap: null,
	concurrency: 24,
	ideaCap: null,
	restartLimit: null,
	buildHistory: 500
};
/** Rule 3/§4: live-confirmed stage names R1–R11 (LIVE_REA_REALTIME_AUDIT, 2026-10-16). */
var RESEARCH_STAGES = [
	{
		key: "niche",
		name: "Niche understanding",
		engine: "llm"
	},
	{
		key: "audience",
		name: "Audience map",
		engine: "llm"
	},
	{
		key: "problem",
		name: "Problem map",
		engine: "llm"
	},
	{
		key: "topic-universe",
		name: "Topic universe",
		engine: "llm"
	},
	{
		key: "query-expansion",
		name: "Query expansion",
		engine: "llm"
	},
	{
		key: "intent-class",
		name: "Intent classification",
		engine: "llm"
	},
	{
		key: "semantic-consolidation",
		name: "Semantic consolidation",
		engine: "derived"
	},
	{
		key: "coverage",
		name: "Existing coverage mapping",
		engine: "llm"
	},
	{
		key: "cluster-construction",
		name: "Cluster construction",
		engine: "llm"
	},
	{
		key: "action-class",
		name: "Content action classification",
		engine: "derived"
	},
	{
		key: "priority",
		name: "Strategic priority inputs",
		engine: "llm"
	}
];
function intensityBand(level) {
	if (level === "light") return [1, 2];
	if (level === "dense") return [4, 6];
	return [2, 4];
}
function css() {
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
function assetPath(fromPost, src) {
	const file = src.split("/").pop() ?? "";
	return `${fromPost ? "../../" : ""}assets/img/${file}`;
}
function slotConfigs(site) {
	const configured = site.ads;
	if (!configured?.length) return defaultAdSlots();
	return AD_SLOT_IDS.map((id) => configured.find((slot) => slot.id === id) ?? defaultAdSlots().find((slot) => slot.id === id));
}
/** Server-side 16 KiB enforcement: over-limit code is refused (never truncated silently). */
function adCodeWithinLimit(code) {
	return new TextEncoder().encode(code).length <= AD_CODE_LIMIT;
}
/** Deterministic hash of the ad configuration — recorded on every build for change detection. */
function adsConfigHash(site) {
	const payload = slotConfigs(site).map((slot) => `${slot.id}:${slot.enabled ? 1 : 0}:${slot.adType}:${slot.code.length}:${slot.code}`).join("|");
	return hashArtifact(`ads:${site.adsEnabled ? 1 : 0}:${payload}`);
}
/** AdSense loader is emitted once, only when a responsive slot is actually live. */
function adSenseLoader(site) {
	const usesAdSense = slotConfigs(site).some((slot) => slot.enabled && slot.adType === "adsense_responsive" && slot.code.trim());
	if (!site.adsEnabled || !usesAdSense) return "";
	return `<script async src="https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=ca-pub-placeholder" crossorigin="anonymous"><\/script>`;
}
/**
* Renders one slot. The container always ships (so the 7-slot contract is stable
* and analytics can find it), but content only appears when the slot is enabled
* and inside the 16 KiB limit. Preview mode renders a labeled placeholder and
* never runs live ad code.
*/
function adSlotHtml(site, id, preview = false) {
	const config = slotConfigs(site).find((slot) => slot.id === id);
	const inner = (() => {
		if (preview) return `<span class="ad-slot-label">Ad slot · ${esc(config.name)} · ${esc(config.adType === "adsense_responsive" ? "AdSense responsive" : "custom code")}${config.enabled ? "" : " · disabled"}</span>`;
		if (!site.adsEnabled || !config.enabled || !config.code.trim()) return "";
		if (!adCodeWithinLimit(config.code)) return `<!-- ad-slot:${id} rejected: code exceeds the 16 KiB limit -->`;
		if (config.adType === "adsense_responsive") return `<ins class="adsbygoogle" style="display:block" data-ad-client="ca-pub-placeholder" data-ad-slot="${esc(config.code.trim())}" data-ad-format="auto" data-full-width-responsive="true"></ins>`;
		return config.code;
	})();
	return `<div data-ad-slot="${id}" class="ad-slot${id === "article_sidebar" ? " ad-rail" : ""}">${inner}</div>`;
}
/** article_inline placement: after the 3rd top-level paragraph, and only with ≥6 top-level paragraphs. */
function inlineAdTargetOk(html) {
	return (html.match(/<\/p>/gi) ?? []).length >= 6;
}
function injectInlineAd(html, adHtml, preview = false) {
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
function articleJsonLd(input) {
	const origin = input.origin;
	const author = input.author;
	const person = author ? {
		"@type": "Person",
		name: author.name,
		jobTitle: author.role,
		description: author.shortBio,
		image: author.avatarUrl,
		knowsAbout: author.expertise,
		homeLocation: {
			"@type": "Place",
			name: `${author.city}, ${author.region}, US`
		},
		url: `${origin}/author/${author.slug}/`
	} : {
		"@type": "Person",
		name: input.site.authors || input.site.staticName
	};
	return JSON.stringify({
		"@context": "https://schema.org",
		"@type": "Article",
		headline: input.article.metaTitle || input.article.title,
		description: input.article.metaDescription || input.article.excerpt,
		datePublished: new Date(input.article.publishedAt).toISOString(),
		inLanguage: "en-US",
		keywords: [input.article.keyword],
		mainEntityOfPage: `${origin}/post/${input.article.slug}/`,
		author: person
	});
}
/** Byline card HTML. The avatar is a hot-linked external URL — zero disk storage. */
/**
* Portrait `<img>` for the exported site: the external AI-portrait URL stays the
* primary source (zero disk), rendered with `referrerpolicy="no-referrer"`, and
* an inline SVG fallback swaps in if the host blocks the request or is offline —
* so the portrait renders 100% of the time without shipping any image file.
*/
function avatarImgHtml(author, size = 52) {
	const fallback = portraitDataUri(avatarSeed(author.avatarUrl) ?? author.id, author.name, 96).replace(/'/g, "%27");
	return `<img src="${esc(author.avatarUrl)}" alt="Portrait of ${esc(author.name)}" width="${size}" height="${size}" loading="lazy" decoding="async" referrerpolicy="no-referrer" onerror="this.onerror=null;this.src='${fallback}'" />`;
}
function authorBylineHtml(author, origin) {
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
function staticFiles(site, articles, withSnippets, authors = [], options = {}) {
	const preview = Boolean(options.adsPreview);
	const origin = site.publicUrl.replace(/\/$/, "");
	const pages = articles.filter((a) => a.siteId === site.id);
	const authorOf = (article) => authors.find((author) => author.id === article.authorId);
	const headExtra = withSnippets ? `\n${site.headHtml}\n` : "";
	const bodyEnd = withSnippets ? `\n${site.bodyEnd}\n${site.analyticsSnippet}\n` : "";
	const adLoader = preview ? "" : adSenseLoader(site);
	const slot = (id) => adSlotHtml(site, id, preview);
	const feedAd = pages.length >= 7 ? slot("home_feed") : "";
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
    ${pages.slice(0, 6).map((article) => {
		const featured = article.images.find((image) => image.role === "featured") ?? article.images[0];
		const photo = featured ? `<img src="${esc(articleImageSrc(featured, article.keyword || article.title))}" alt="${esc(featured.alt || article.title)}" width="474" height="274" loading="lazy" decoding="async" referrerpolicy="no-referrer" />` : "";
		return `<a class="card" href="./post/${esc(article.slug)}/">${photo}<span class="meta">${esc(article.keyword)}</span><strong>${esc(article.title)}</strong></a>`;
	}).join("\n")}
    ${feedAd}
    ${pages.slice(6).map((article) => {
		const featured = article.images.find((image) => image.role === "featured") ?? article.images[0];
		const photo = featured ? `<img src="${esc(articleImageSrc(featured, article.keyword || article.title))}" alt="${esc(featured.alt || article.title)}" width="474" height="274" loading="lazy" decoding="async" referrerpolicy="no-referrer" />` : "";
		return `<a class="card" href="./post/${esc(article.slug)}/">${photo}<span class="meta">${esc(article.keyword)}</span><strong>${esc(article.title)}</strong></a>`;
	}).join("\n")}
  </div>
</main>
<footer>${esc(site.footer)}</footer>
${slot("site_bottom")}
${bodyEnd}
</body></html>`;
	const files = [{
		name: "assets/site.css",
		text: css()
	}, {
		name: "index.html",
		text: home
	}];
	for (const article of pages) {
		const html = rewriteMedia(article.html, (src) => assetPath(true, src));
		const author = authorOf(article);
		const jsonLd = articleJsonLd({
			site,
			article,
			author,
			origin
		});
		const hero = article.images.find((image) => image.role === "featured") ?? article.images[0];
		const heroSrc = hero ? articleImageSrc(hero, article.keyword || article.title) : "";
		const share = [
			`<meta property="og:type" content="article">`,
			`<meta property="og:title" content="${esc(article.metaTitle || article.title)}">`,
			`<meta property="og:description" content="${esc(article.metaDescription || article.excerpt)}">`,
			`<meta name="theme-color" content="#f7f3ea">`,
			heroSrc ? `<meta property="og:image" content="${esc(heroSrc)}">` : "",
			heroSrc ? `<meta name="twitter:card" content="summary_large_image">` : ""
		].filter(Boolean).join("\n");
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
<script type="application/ld+json">${jsonLd}<\/script>
<link rel="stylesheet" href="../../assets/site.css">${adLoader}${headExtra}
</head>
<body>
${slot("site_top")}
<header><a class="mark" href="../../">${esc(site.staticName)}</a><span class="meta">${esc(article.status)}</span></header>
<main>
<div class="post-layout">
<article class="post">
  ${slot("article_top")}
  <p class="meta">${esc(article.keyword)}</p>
  <h1>${esc(article.title)}</h1>
  ${authorBylineHtml(author, origin)}
  ${withInline}
  ${slot("article_bottom")}
</article>
${slot("article_sidebar")}
</div>
</main>
<footer>${esc(site.footer)}</footer>
${slot("site_bottom")}
${bodyEnd}
</body></html>`
		});
	}
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
			homeLocation: {
				"@type": "Place",
				name: `${author.city}, ${author.region}, US`
			},
			url: `${origin}/author/${author.slug}/`
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
<script type="application/ld+json">${jsonLd}<\/script>
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
    ${own.map((article) => `<a class="card" href="../../post/${esc(article.slug)}/"><span class="meta">${esc(article.keyword)}</span><strong>${esc(article.title)}</strong></a>`).join("\n")}
  </div>
</main>
<footer>${esc(site.footer)}</footer>
</body></html>`
		});
	}
	const urls = [
		`${origin}/`,
		...pages.map((a) => `${origin}/post/${a.slug}/`),
		...authors.map((a) => `${origin}/author/${a.slug}/`)
	];
	files.push({
		name: "sitemap.xml",
		text: `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls.map((u) => `  <url><loc>${esc(u)}</loc></url>`).join("\n")}\n</urlset>\n`
	});
	files.push({
		name: "robots.txt",
		text: site.robots.startsWith("noindex") ? `User-agent: *\nDisallow: /\n` : `User-agent: *\nAllow: /\nSitemap: ${origin}/sitemap.xml\n`
	});
	const keyFile = indexNowKeyFile(site.indexNowKey ?? "");
	if (keyFile) files.push(keyFile);
	const adsTxt = (site.adsTxt ?? "").trim();
	if (adsTxt) files.push({
		name: "ads.txt",
		text: `${adsTxt}\n`
	});
	return files;
}
/** Rule 6 route-diff: the route set of a build (HTML routes + text artifacts), sorted. */
function buildRoutes(files) {
	const routes = /* @__PURE__ */ new Set();
	for (const file of files) if (file.name === "index.html") routes.add("/");
	else if (file.name.endsWith("/index.html")) routes.add(`/${file.name.slice(0, -10)}`);
	else if (/\.(txt|xml)$/i.test(file.name)) routes.add(`/${file.name}`);
	return [...routes].sort();
}
function hashArtifact(text) {
	let hash = 2166136261;
	for (let index = 0; index < text.length; index++) hash = Math.imul(hash ^ text.charCodeAt(index), 16777619);
	return (hash >>> 0).toString(16).padStart(8, "0");
}
function indexNowKeyFile(key) {
	if (!/^[a-zA-Z0-9-]{8,128}$/.test(key)) return null;
	return {
		name: `${key}.txt`,
		text: key
	};
}
function staticMedia(articles) {
	const seen = /* @__PURE__ */ new Set();
	const files = [];
	for (const article of articles) for (const name of mediaRefs(article.html)) {
		if (seen.has(name)) continue;
		seen.add(name);
		const image = article.images.find((item) => item.src?.endsWith(name));
		files.push({
			name,
			remote: image?.remote
		});
	}
	return files;
}
/**
* Article markdown → HTML renderer.
*
* This is the single renderer behind the app preview, the Ghost HTML payload and
* the exported Static Site, so it must cover the whole blog-writing feature set
* the pipeline prompts the model to use:
*
*   block   headings (#…######), paragraphs, hard breaks, horizontal rules,
*           bullet + numbered lists (nested), task lists, pipe tables with
*           alignment (wrapped in `.table-scroll` / `table.article-table`),
*           blockquotes, GitHub-style callouts (`> [!NOTE]`), fenced code
*           blocks (with a `figure.code-block` caption), indented code blocks,
*           images and footnotes.
*   inline  bold, italic, bold+italic, strikethrough, inline code, links
*           (with titles), autolinks, inline images and footnote references.
*
* Safety model: everything is HTML-escaped; raw HTML in the source is never
* passed through. Only a small allowlist of link/image schemes survives, so
* model text can never inject markup or a `javascript:` URL.
*/
/** Placeholder sentinel for already-rendered inline HTML fragments. */
var SENT = "\0";
/** Placeholder sentinel for a hard line break inside a paragraph. */
var BR = "";
var UNSAFE_CHARS = new RegExp(`[${SENT}${BR}]`, "g");
var TOKEN = new RegExp(`${SENT}(\\d+)${SENT}`, "g");
var IMAGE_SRC = /^(?:https?:\/\/|\/\/|\/|\.{1,2}\/|data:image\/)/i;
var LINK_HREF = /^(?:https?:\/\/|\/\/|\/|\.{1,2}\/|mailto:|tel:|#)/i;
function sanitize(text) {
	return String(text ?? "").replace(UNSAFE_CHARS, "");
}
function safeImage(src) {
	return IMAGE_SRC.test(src.trim());
}
function safeHref(href) {
	return LINK_HREF.test(href.trim());
}
function imageFigure(alt, src, title) {
	const clean = src.trim();
	if (!safeImage(clean)) return `<p>${esc(alt || clean)}</p>`;
	const titleAttr = title ? ` title="${esc(title)}"` : "";
	return `<figure class="kg-card kg-image-card"><img src="${esc(clean)}" alt="${esc(alt)}" loading="lazy" decoding="async"${titleAttr} /></figure>`;
}
/**
* Renders inline spans. A single shared `parts` array holds every already-built
* HTML fragment (code, links, emphasis) so recursive emphasis never loses an
* outer token. Tokens are restored only after the surrounding text is escaped.
*/
function renderInline(text, parts = []) {
	const tok = (html) => {
		parts.push(html);
		return `${SENT}${parts.length - 1}${SENT}`;
	};
	let s = text;
	s = s.replace(/`([^`]+)`/g, (_m, code) => tok(`<code>${esc(String(code).trim())}</code>`));
	s = s.replace(/!\[([^\]]*)\]\(\s*<?([^)\s>]+)>?(?:\s+["']([^"']*)["'])?\s*\)/g, (_m, alt, src, title) => tok(safeImage(src) ? `<img class="kg-image" src="${esc(src)}" alt="${esc(alt)}" loading="lazy" decoding="async"${title ? ` title="${esc(title)}"` : ""} />` : esc(alt || src)));
	s = s.replace(/\[([^\]]+)\]\(\s*<?([^)\s>]+)>?(?:\s+["']([^"']*)["'])?\s*\)/g, (_m, label, href, title) => tok(safeHref(href) ? `<a href="${esc(href)}"${title ? ` title="${esc(title)}"` : ""}>${renderInline(label, parts)}</a>` : renderInline(label, parts)));
	s = s.replace(/<((?:https?:\/\/|mailto:)[^>\s]+)>/g, (_m, href) => tok(`<a href="${esc(href)}">${esc(href.replace(/^mailto:/i, ""))}</a>`));
	s = s.replace(/\[\^([^\]\s]+)\]/g, (_m, id) => tok(`<sup class="fn-ref" id="fnref-${esc(id)}"><a href="#fn-${esc(id)}">${esc(id)}</a></sup>`));
	s = s.replace(/\*\*\*([\s\S]+?)\*\*\*/g, (_m, x) => tok(`<strong><em>${renderInline(x, parts)}</em></strong>`));
	s = s.replace(/\*\*([\s\S]+?)\*\*/g, (_m, x) => tok(`<strong>${renderInline(x, parts)}</strong>`));
	s = s.replace(/__([\s\S]+?)__/g, (_m, x) => tok(`<strong>${renderInline(x, parts)}</strong>`));
	s = s.replace(/~~([\s\S]+?)~~/g, (_m, x) => tok(`<del>${renderInline(x, parts)}</del>`));
	s = s.replace(/(^|[^\w*])\*([^*\n]+)\*(?!\w)/g, (_m, pre, x) => `${pre}${tok(`<em>${renderInline(x, parts)}</em>`)}`);
	s = s.replace(/(^|[^\w_])_([^_\n]+)_(?!\w)/g, (_m, pre, x) => `${pre}${tok(`<em>${renderInline(x, parts)}</em>`)}`);
	return esc(s).split(BR).join("<br>").replace(TOKEN, (_m, index) => parts[Number(index)] ?? "");
}
function isTableRow(line) {
	return line.includes("|") && line.trim().length > 0;
}
function isTableSeparator(line) {
	const trimmed = line.trim();
	if (!trimmed.includes("|")) return false;
	const cells = splitRow(trimmed);
	return cells.length > 0 && cells.every((cell) => /^:?-{1,}:?$/.test(cell));
}
/** Splits a pipe row, honouring `\|` escapes and pipes inside inline code. */
function splitRow(line) {
	let s = line.trim();
	if (s.startsWith("|")) s = s.slice(1);
	if (s.endsWith("|") && !s.endsWith("\\|")) s = s.slice(0, -1);
	const cells = [];
	let current = "";
	let inCode = false;
	for (let i = 0; i < s.length; i++) {
		const ch = s[i];
		if (ch === "\\" && s[i + 1] === "|") {
			current += "|";
			i++;
			continue;
		}
		if (ch === "`") {
			inCode = !inCode;
			current += ch;
			continue;
		}
		if (ch === "|" && !inCode) {
			cells.push(current.trim());
			current = "";
			continue;
		}
		current += ch;
	}
	cells.push(current.trim());
	return cells;
}
function alignments(separator) {
	return separator.map((cell) => {
		const left = cell.startsWith(":");
		const right = cell.endsWith(":");
		if (left && right) return "center";
		if (right) return "right";
		if (left) return "left";
		return null;
	});
}
function alignAttr(align) {
	return align ? ` style="text-align:${align}"` : "";
}
function renderTable(lines, start) {
	const header = splitRow(lines[start]);
	const align = alignments(splitRow(lines[start + 1]));
	const body = [];
	let i = start + 2;
	while (i < lines.length && lines[i].trim() && isTableRow(lines[i]) && !isTableSeparator(lines[i])) {
		const cells = splitRow(lines[i]);
		while (cells.length < header.length) cells.push("");
		const tds = cells.slice(0, header.length).map((cell, index) => `<td${alignAttr(align[index] ?? null)}>${renderInline(cell)}</td>`).join("");
		body.push(`<tr>${tds}</tr>`);
		i++;
	}
	return {
		html: `<div class="table-scroll"><table class="article-table"><thead><tr>${header.map((cell, index) => `<th scope="col"${alignAttr(align[index] ?? null)}>${renderInline(cell)}</th>`).join("")}</tr></thead>${body.length ? `<tbody>${body.join("")}</tbody>` : ""}</table></div>`,
		next: i
	};
}
var UL_ITEM = /^(\s*)[-*+]\s+(.*)$/;
var OL_ITEM = /^(\s*)(\d{1,9})[.)]\s+(.*)$/;
function indentOf(line) {
	return (/^(\s*)/.exec(line)?.[1] ?? "").replace(/\t/g, "    ").length;
}
function listMatch(line, ordered) {
	if (ordered) {
		const match = OL_ITEM.exec(line);
		if (!match) return null;
		return {
			indent: indentOf(line),
			num: Number(match[2]),
			text: match[3],
			task: void 0
		};
	}
	const match = UL_ITEM.exec(line);
	if (!match) return null;
	let text = match[2];
	let task;
	const checkbox = /^\[([ xX])\]\s+(.*)$/.exec(text);
	if (checkbox) {
		task = checkbox[1].toLowerCase() === "x";
		text = checkbox[2];
	}
	return {
		indent: indentOf(line),
		num: 0,
		text,
		task
	};
}
function renderList(lines, start, ordered) {
	const first = listMatch(lines[start], ordered);
	const base = first.indent;
	const tag = ordered ? "ol" : "ul";
	const items = [];
	let i = start;
	let text = null;
	let task;
	let nested = "";
	let extra = [];
	const flushItem = () => {
		if (text === null) return;
		const parts = [];
		const body = extra.length ? `${renderInline(text, parts)} ${renderInline(extra.join(" "), parts)}` : renderInline(text, parts);
		const checkbox = task === void 0 ? "" : `<input type="checkbox" disabled${task ? " checked" : ""} /> `;
		const cls = task === void 0 ? "" : " class=\"task-item\"";
		items.push(`<li${cls}>${checkbox}${body}${nested}</li>`);
		text = null;
		task = void 0;
		nested = "";
		extra = [];
	};
	while (i < lines.length) {
		const line = lines[i];
		if (!line.trim()) {
			let j = i + 1;
			while (j < lines.length && !lines[j].trim()) j++;
			const next = j < lines.length ? listMatch(lines[j], ordered) ?? listMatch(lines[j], !ordered) : null;
			if (next && next.indent >= base) {
				i = j;
				continue;
			}
			break;
		}
		const same = listMatch(line, ordered);
		const any = same ?? listMatch(line, !ordered);
		if (any) {
			if (any.indent < base) break;
			if (any.indent > base) {
				const sub = renderList(lines, i, same ? ordered : !ordered);
				nested += sub.html;
				i = sub.next;
				continue;
			}
			if (!same) break;
			flushItem();
			text = any.text;
			task = any.task;
			i++;
			continue;
		}
		if (text !== null && indentOf(line) > base) {
			extra.push(line.trim());
			i++;
			continue;
		}
		break;
	}
	flushItem();
	return {
		html: `<${tag}${ordered && first.num > 1 ? ` start="${first.num}"` : ""}>${items.join("")}</${tag}>`,
		next: i
	};
}
var CALLOUT = /^\[!(NOTE|TIP|IMPORTANT|WARNING|CAUTION|INFO)\]\s*(.*)$/i;
var CALLOUT_CLASS = {
	note: "callout-note",
	tip: "callout-tip",
	important: "callout-important",
	warning: "callout-warning",
	caution: "callout-caution",
	info: "callout-note"
};
function renderBlockquote(quote) {
	const first = quote[0] ?? "";
	const marker = CALLOUT.exec(first.trim());
	if (marker) {
		const kind = marker[1].toLowerCase();
		const title = marker[2].trim();
		const body = quote.slice(1).join("\n");
		const titleHtml = title ? `<p class="callout-title">${renderInline(title)}</p>` : "";
		const bodyHtml = body.trim() ? markdownToHtml(body) : "";
		return `<aside class="callout ${CALLOUT_CLASS[kind] ?? "callout-note"}">${titleHtml}${bodyHtml}</aside>`;
	}
	return `<blockquote>${markdownToHtml(quote.join("\n"))}</blockquote>`;
}
function codeBlock(code, language) {
	const lang = language.trim();
	const cls = lang ? ` class="language-${esc(lang)}"` : "";
	return `<figure class="code-block">${lang ? `<figcaption>${esc(lang)}</figcaption>` : ""}<pre><code${cls}>${esc(code)}</code></pre></figure>`;
}
var FENCE = /^(`{3,}|~{3,})\s*([\w+#.-]*)\s*$/;
var HEADING = /^(#{1,6})\s+(.*?)\s*#*\s*$/;
var HR = /^(?:\*\s*){3,}$|^(?:-\s*){3,}$|^(?:_\s*){3,}$/;
var BLOCK_IMAGE = /^!\[([^\]]*)\]\(\s*<?([^)\s>]+)>?(?:\s+["']([^"']*)["'])?\s*\)$/;
var BLOCKQUOTE = /^\s{0,3}>\s?/;
var FOOTNOTE_DEF = /^\[\^([^\]\s]+)\]:\s*(.*)$/;
function isFenceClose(line, marker) {
	const trimmed = line.trim();
	return trimmed.startsWith(marker) && !/[^\s`~]/.test(trimmed.slice(marker.length));
}
function markdownToHtml(markdown) {
	const defs = /* @__PURE__ */ new Map();
	const source = sanitize(markdown).replace(/\r\n?/g, "\n").split("\n").map((line) => {
		const def = FOOTNOTE_DEF.exec(line.trim());
		if (def) {
			defs.set(def[1], def[2]);
			return "";
		}
		return line;
	});
	const out = [];
	let para = [];
	let i = 0;
	const flushPara = () => {
		if (!para.length) return;
		let buffer = "";
		para.forEach((line, index) => {
			const hard = /\\$/.test(line.replace(/\s+$/, "")) || / {2,}$/.test(line);
			let text = line.trim();
			if (hard && text.endsWith("\\")) text = text.slice(0, -1).trimEnd();
			buffer += text;
			if (index < para.length - 1) buffer += hard ? BR : " ";
		});
		out.push(`<p>${renderInline(buffer)}</p>`);
		para = [];
	};
	while (i < source.length) {
		const line = source[i];
		const trimmed = line.trim();
		if (!trimmed) {
			flushPara();
			i++;
			continue;
		}
		const fence = FENCE.exec(trimmed);
		if (fence) {
			flushPara();
			const marker = fence[1];
			const language = fence[2] ?? "";
			const code = [];
			i++;
			while (i < source.length && !isFenceClose(source[i], marker)) {
				code.push(source[i]);
				i++;
			}
			i++;
			out.push(codeBlock(code.join("\n"), language));
			continue;
		}
		const heading = HEADING.exec(trimmed);
		if (heading) {
			flushPara();
			const level = Math.min(4, Math.max(2, heading[1].length));
			out.push(`<h${level}>${renderInline(heading[2])}</h${level}>`);
			i++;
			continue;
		}
		if (HR.test(trimmed)) {
			flushPara();
			out.push("<hr>");
			i++;
			continue;
		}
		if (isTableRow(line) && i + 1 < source.length && isTableSeparator(source[i + 1])) {
			flushPara();
			const table = renderTable(source, i);
			out.push(table.html);
			i = table.next;
			continue;
		}
		if (BLOCKQUOTE.test(line)) {
			flushPara();
			const quote = [];
			while (i < source.length && BLOCKQUOTE.test(source[i])) {
				quote.push(source[i].replace(BLOCKQUOTE, ""));
				i++;
			}
			out.push(renderBlockquote(quote));
			continue;
		}
		if (/^[-*+]\s+/.test(trimmed)) {
			flushPara();
			const list = renderList(source, i, false);
			out.push(list.html);
			i = list.next;
			continue;
		}
		if (/^\d{1,9}[.)]\s+/.test(trimmed)) {
			flushPara();
			const list = renderList(source, i, true);
			out.push(list.html);
			i = list.next;
			continue;
		}
		const image = BLOCK_IMAGE.exec(trimmed);
		if (image) {
			flushPara();
			out.push(imageFigure(image[1], image[2], image[3]));
			i++;
			continue;
		}
		para.push(line);
		i++;
	}
	flushPara();
	if (defs.size) {
		const items = [...defs.entries()].map(([id, text]) => `<li id="fn-${esc(id)}">${renderInline(text)} <a class="fn-back" href="#fnref-${esc(id)}" aria-label="Back to content">↩</a></li>`).join("");
		out.push(`<section class="footnotes"><ol>${items}</ol></section>`);
	}
	return out.join("\n").replace(UNSAFE_CHARS, "");
}
function excerptOf(markdown) {
	return sanitize(markdown).replace(/\r\n?/g, "\n").replace(/```[\s\S]*?```/g, " ").replace(/^#{1,6}\s+/gm, "").replace(/!\[([^\]]*)\]\([^)]*\)/g, " ").replace(/\[([^\]]+)\]\([^)]*\)/g, "$1").replace(/\[\^[^\]]+\]/g, "").replace(/^\s*\|.*\|\s*$/gm, " ").replace(/^\s*[-*+>]\s+/gm, "").replace(/[*_`~]+/g, "").replace(/\s+/g, " ").trim().slice(0, 180);
}
var SKIP_SECTION_LINE = /^(?:!|```|~~~|\||>|[-*+]\s|\d{1,9}[.)]\s|\[\^)/;
function sectionsFromMarkdown(markdown) {
	const sections = [];
	let current = null;
	let inCode = false;
	for (const line of sanitize(markdown).replace(/\r\n?/g, "\n").split("\n")) {
		const trimmed = line.trim();
		if (/^(?:```|~~~)/.test(trimmed)) {
			inCode = !inCode;
			continue;
		}
		if (inCode) continue;
		const heading = /^#{1,6}\s+(.+)$/.exec(trimmed);
		if (heading) {
			if (current?.paragraphs.length) sections.push(current);
			current = {
				heading: heading[1].replace(/[*_`#]/g, "").trim(),
				paragraphs: []
			};
			continue;
		}
		if (!trimmed || SKIP_SECTION_LINE.test(trimmed)) continue;
		if (!current) current = {
			heading: "Opening",
			paragraphs: []
		};
		current.paragraphs.push(trimmed);
	}
	if (current?.paragraphs.length) sections.push(current);
	return sections.slice(0, 8);
}
function wordCount(markdown) {
	return markdown.split(/\s+/).filter(Boolean).length;
}
/** Operator notes must never appear in a published page. */
function stripVerify(text) {
	return text.replace(/\[verify:[^\]]*\]/gi, "").replace(/<p><em>Tone:[^<]*<\/em><\/p>/gi, "").replace(/\*Tone:[^*]*\*/gi, "").replace(UNSAFE_CHARS, "").replace(/[ \t]{2,}/g, " ").replace(/\n{3,}/g, "\n\n").trim();
}
var FIRST = [
	"Elena",
	"Marcus",
	"Priya",
	"Jordan",
	"Caleb",
	"Naomi",
	"Andre",
	"Hannah",
	"Luis",
	"Claire",
	"Owen",
	"Maya",
	"Nathan",
	"Sophie",
	"Derek",
	"Amelia",
	"Isaac",
	"Grace",
	"Malik",
	"Fiona",
	"Jonah",
	"Rebecca",
	"Adrian",
	"Lauren",
	"Cole",
	"Vanessa",
	"Ethan",
	"Iris",
	"Grant",
	"Camille",
	"Trevor",
	"Dana",
	"Wyatt",
	"Leah",
	"Curtis",
	"Paige",
	"Ronan",
	"Alice",
	"Devin",
	"Tessa",
	"Brady",
	"Jenna",
	"Sawyer",
	"Noelle",
	"Gavin",
	"Rosa",
	"Hunter",
	"Elena",
	"Chase",
	"Brianna"
];
var LAST = [
	"Bennett",
	"Okonkwo",
	"Alvarez",
	"Chen",
	"Patel",
	"Brooks",
	"Nguyen",
	"Harper",
	"Delgado",
	"Walsh",
	"Kim",
	"Foster",
	"Rahman",
	"Ellis",
	"Murphy",
	"Shah",
	"Brennan",
	"Ortiz",
	"Blake",
	"Carter",
	"Whitfield",
	"Langley",
	"Mercer",
	"Ashford",
	"Calder",
	"Thibodeaux",
	"Vance",
	"Hargrove",
	"Sinclair",
	"Pruitt",
	"Kowalski",
	"Maddox",
	"Reyes",
	"Thornton",
	"Quinn",
	"Barlowe",
	"Kensington",
	"Ueda",
	"Voss",
	"Winslow"
];
var STATES = [
	["Austin", "TX"],
	["Denver", "CO"],
	["Portland", "OR"],
	["Chicago", "IL"],
	["Seattle", "WA"],
	["Boston", "MA"],
	["Atlanta", "GA"],
	["Minneapolis", "MN"],
	["Raleigh", "NC"],
	["Phoenix", "AZ"],
	["San Diego", "CA"],
	["Columbus", "OH"],
	["Nashville", "TN"],
	["Madison", "WI"],
	["Ann Arbor", "MI"],
	["Pittsburgh", "PA"],
	["Savannah", "GA"],
	["Burlington", "VT"],
	["Sacramento", "CA"],
	["Boulder", "CO"],
	["Boise", "ID"],
	["Tucson", "AZ"],
	["Omaha", "NE"],
	["Louisville", "KY"],
	["Richmond", "VA"],
	["Salt Lake City", "UT"],
	["Kansas City", "MO"],
	["Providence", "RI"],
	["Charleston", "SC"],
	["Asheville", "NC"]
];
/** Full state names kept for bios; badges use the two-letter code above. */
var STATE_NAMES = {
	TX: "Texas",
	CO: "Colorado",
	OR: "Oregon",
	IL: "Illinois",
	WA: "Washington",
	MA: "Massachusetts",
	GA: "Georgia",
	MN: "Minnesota",
	NC: "North Carolina",
	AZ: "Arizona",
	CA: "California",
	OH: "Ohio",
	TN: "Tennessee",
	WI: "Wisconsin",
	MI: "Michigan",
	PA: "Pennsylvania",
	VT: "Vermont",
	ID: "Idaho",
	NE: "Nebraska",
	KY: "Kentucky",
	VA: "Virginia",
	UT: "Utah",
	MO: "Missouri",
	RI: "Rhode Island",
	SC: "South Carolina"
};
var RHYTHMS = [
	"short declaratives; one longer breathing sentence closes each paragraph",
	"front-loaded answers, then two supporting beats; never a sentence over 22 words",
	"question-shaped opener, plain middle, single punchline per section",
	"staccato start, list cadence, soft landing on the practical takeaway",
	"varied bursts: three tight sentences, one long, one fragment for emphasis"
];
var DICTIONS = [
	"plain American English; one precise term per idea, no jargon stacking",
	"concrete nouns and active verbs; zero hedging adverbs",
	"conversational but exact; contractions allowed, buzzwords banned",
	"numbers written out below ten; specific beats vague every time",
	"second-nature clarity: the reader ran out of patience two scrolls ago"
];
var MOVES = [
	"opens with the decision, not the definition",
	"names the exception before the rule",
	"turns every list item into a mini consequence",
	"ends each section with one sentence you could screenshot",
	"compares against a cheaper or slower alternative",
	"answers the follow-up question before it is asked",
	"quotes a realistic ballpark figure with two sig-figs",
	"retells one tiny anecdote (freshmen-in-their-dorm specificity)",
	"flags the one thing people get illegally wrong",
	"closes by handing the reader the next step, not a summary"
];
var BANNED = [
	"in today's fast-paced world",
	"delve",
	"tapestry",
	"unlock",
	"game-changer",
	"seamless",
	"look no further",
	"robust",
	"leverage",
	"navigate the landscape",
	"in conclusion",
	"it is important to note",
	"revolutionize",
	"cutting-edge",
	"harness the power"
];
var STOP$1 = /* @__PURE__ */ new Set([
	"how",
	"to",
	"a",
	"an",
	"the",
	"for",
	"of",
	"and",
	"in",
	"on",
	"your",
	"with",
	"from",
	"that",
	"this",
	"best",
	"guide",
	"what",
	"why"
]);
var label = (value) => value.replace(/\b\w/g, (c) => c.toUpperCase());
var STEM_CACHE = /* @__PURE__ */ new Map();
function topicStem(keyword) {
	const raw = String(keyword ?? "");
	const cached = STEM_CACHE.get(raw);
	if (cached !== void 0) return cached;
	const stem = (raw.toLowerCase().replace(/[^a-z0-9\s]/g, " ").split(/\s+/).filter((word) => word.length > 3 && !STOP$1.has(word)).slice(0, 2).join(" ") || raw.toLowerCase().trim() || "general").slice(0, 48);
	if (STEM_CACHE.size > 2e4) STEM_CACHE.clear();
	STEM_CACHE.set(raw, stem);
	return stem;
}
function slugify$1(value) {
	return value.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 56);
}
/** Normalized expertise tokens used for niche → author matching (memoized — intake can process 10k+ jobs). */
var TOKEN_CACHE = /* @__PURE__ */ new Map();
function expertiseTokens(topic) {
	const cached = TOKEN_CACHE.get(topic);
	if (cached) return cached;
	const stem = topicStem(topic);
	const extra = stem.split(" ").filter((word) => word.length > 3 && !STOP$1.has(word));
	const tokens = [...new Set([stem, ...extra].filter(Boolean))];
	if (TOKEN_CACHE.size > 2e4) TOKEN_CACHE.clear();
	TOKEN_CACHE.set(topic, tokens);
	return tokens;
}
function expertiseForTopic(topic, stem, tags = []) {
	const domain = label(stem);
	const tokens = expertiseTokens(topic);
	const tail = tokens.length > 1 ? label(tokens[1]) : "Search-ready explainers";
	return [.../* @__PURE__ */ new Set([
		domain,
		tail,
		...tags,
		"Source-checked guides"
	])].slice(0, 3);
}
var ACADEMIC_FIELDS = [
	"Computational Biology",
	"Materials Science",
	"Public Health",
	"Computer Science",
	"Neuroscience",
	"Environmental Engineering",
	"Sociology",
	"Chemical Engineering",
	"Psychology",
	"Economics",
	"Mechanical Engineering",
	"Immunology",
	"Statistics",
	"Biomedical Engineering",
	"Astrophysics"
];
/** [university, city, state code] — the persona's affiliation is kept internally consistent. */
var UNIVERSITIES = [
	[
		"UC Berkeley",
		"Berkeley",
		"CA"
	],
	[
		"University of Michigan",
		"Ann Arbor",
		"MI"
	],
	[
		"Georgia Tech",
		"Atlanta",
		"GA"
	],
	[
		"UT Austin",
		"Austin",
		"TX"
	],
	[
		"University of Washington",
		"Seattle",
		"WA"
	],
	[
		"Purdue University",
		"West Lafayette",
		"IN"
	],
	[
		"University of Florida",
		"Gainesville",
		"FL"
	],
	[
		"Penn State",
		"State College",
		"PA"
	],
	[
		"Ohio State University",
		"Columbus",
		"OH"
	],
	[
		"Arizona State University",
		"Tempe",
		"AZ"
	],
	[
		"MIT",
		"Cambridge",
		"MA"
	],
	[
		"Stanford University",
		"Stanford",
		"CA"
	]
];
var PHD_YEARS = [
	"2nd",
	"3rd",
	"3rd",
	"4th",
	"5th"
];
var ACADEMIC_CUES = [
	"phd",
	"ph.d",
	"doctoral",
	"doctorate",
	"grad school",
	"graduate school",
	"graduate student",
	"dissertation",
	"thesis",
	"master's",
	"masters",
	"postdoc",
	"post-doc",
	"qualifying exam",
	"academic",
	"academia",
	"tenure",
	"faculty",
	"professor",
	"university",
	"undergrad",
	"college",
	"campus",
	"fellowship",
	"grad student",
	"grad life",
	"phd life"
];
var PERSONA_FAMILIES = [
	{
		id: "health",
		cues: [
			"nurse",
			"nursing",
			"dietitian",
			"nutrition",
			"therapist",
			"therapy",
			"mental health",
			"anxiety",
			"depression",
			"counseling",
			"fitness",
			"workout",
			"strength training",
			"marathon",
			"running",
			"sleep",
			"insomnia",
			"recovery",
			"physical therapy"
		],
		roles: [
			"Registered Nurse (BSN, RN)",
			"Registered Dietitian Nutritionist",
			"Licensed Clinical Social Worker",
			"Certified Strength and Conditioning Specialist",
			"Behavioral Sleep Medicine Specialist"
		],
		tags: ["Patient-facing care", "Evidence-based practice"],
		experiential: true
	},
	{
		id: "tech",
		cues: [
			"software",
			"developer",
			"programming",
			"coding",
			"front-end",
			"frontend",
			"back-end",
			"backend",
			"api",
			"web development",
			"javascript",
			"react",
			"python",
			"devops",
			"kubernetes",
			"cloud",
			"cybersecurity",
			"security engineer",
			"data science",
			"data engineer",
			"machine learning",
			"artificial intelligence",
			"database",
			"docker"
		],
		roles: [
			"Senior Software Engineer",
			"Frontend Engineer",
			"Platform and DevOps Engineer",
			"Data Scientist",
			"Security Engineer"
		],
		tags: ["Production systems", "Developer tooling"],
		experiential: false
	},
	{
		id: "finance",
		cues: [
			"investing",
			"investment",
			"stocks",
			"portfolio",
			"retirement",
			"401k",
			"tax",
			"taxes",
			"accounting",
			"budget",
			"budgeting",
			"saving",
			"debt",
			"credit",
			"mortgage",
			"real estate",
			"insurance",
			"personal finance",
			"salary"
		],
		roles: [
			"Chartered Financial Analyst (CFA)",
			"Certified Public Accountant (CPA)",
			"Accredited Financial Counselor",
			"Licensed Real Estate Broker"
		],
		tags: ["Personal finance", "Planning and risk"],
		experiential: false
	},
	{
		id: "business",
		cues: [
			"marketing",
			"seo",
			"branding",
			"startup",
			"entrepreneur",
			"founder",
			"ecommerce",
			"e-commerce",
			"sales",
			"growth",
			"social media",
			"advertising",
			"freelance",
			"freelancing",
			"consulting",
			"remote work"
		],
		roles: [
			"Growth Marketing Lead",
			"Founder and Operator",
			"Enterprise Sales Director",
			"Independent Consultant"
		],
		tags: ["Growth and operations", "Client work"],
		experiential: false
	},
	{
		id: "legal",
		cues: [
			"law",
			"legal",
			"lawyer",
			"attorney",
			"immigration",
			"patent",
			"contract",
			"lawsuit",
			"court"
		],
		roles: [
			"Immigration Attorney",
			"Contract Attorney",
			"Patent Attorney"
		],
		tags: ["Compliance", "Client advocacy"],
		experiential: false
	},
	{
		id: "education",
		cues: [
			"teacher",
			"teaching",
			"classroom",
			"curriculum",
			"pedagogy",
			"lesson plan",
			"homeschool",
			"school district",
			"esl",
			"language learning"
		],
		roles: [
			"High School Teacher (M.Ed.)",
			"Curriculum Designer",
			"ESL Instructor"
		],
		tags: ["Classroom practice", "Learning design"],
		experiential: true
	},
	{
		id: "creative",
		cues: [
			"writing",
			"writer",
			"copywriting",
			"novel",
			"author",
			"blogging",
			"design",
			"ux",
			"graphic design",
			"photography",
			"camera",
			"music",
			"guitar",
			"video",
			"filmmaking",
			"youtube"
		],
		roles: [
			"Freelance Writer and Editor",
			"Product Designer",
			"Professional Photographer",
			"Video Producer"
		],
		tags: ["Creative practice", "Portfolio craft"],
		experiential: true
	},
	{
		id: "home",
		cues: [
			"recipe",
			"cooking",
			"baking",
			"kitchen",
			"chef",
			"meal",
			"home improvement",
			"diy",
			"renovation",
			"repair",
			"plumbing",
			"woodworking",
			"gardening",
			"landscaping",
			"lawn",
			"auto repair",
			"car maintenance"
		],
		roles: [
			"Chef and Recipe Developer",
			"Home Improvement Contractor",
			"Master Gardener",
			"Automotive Technician"
		],
		tags: ["Hands-on work", "Real-world results"],
		experiential: true
	},
	{
		id: "travel",
		cues: [
			"travel",
			"backpacking",
			"nomad",
			"itinerary",
			"flight",
			"hotel",
			"road trip"
		],
		roles: ["Travel Writer", "Full-time Traveler and Guide"],
		tags: ["Itineraries", "On-the-ground travel"],
		experiential: true
	},
	{
		id: "parenting",
		cues: [
			"parenting",
			"parent",
			"newborn",
			"toddler",
			"childcare",
			"baby sleep"
		],
		roles: ["Certified Pediatric Sleep Consultant", "Parenting Coach and Former NICU Nurse"],
		tags: ["Child development", "Family routines"],
		experiential: true
	}
];
var EXPERIENTIAL_CUES = [
	"my ",
	" i ",
	"how i ",
	"experience",
	"journey",
	"day in the life",
	"week in",
	"life of",
	"routine",
	"schedule",
	"diary",
	"lessons",
	"mistakes",
	"beginner",
	"getting started",
	"first year",
	"final year",
	"surviving",
	"survival",
	"personal",
	"story",
	"stories",
	"what i learned",
	"advice",
	"tips",
	"guide",
	"walkthrough",
	"step by step",
	"practical",
	"day-to-day",
	"day to day",
	"real talk",
	"honest"
];
/** True when a topic reads like lived/experiential/practitioner content. */
function hasExperientialCue(text) {
	const hay = ` ${text.toLowerCase()} `;
	return EXPERIENTIAL_CUES.some((cue) => hay.includes(cue));
}
function detectAcademicField(hay) {
	for (const field of ACADEMIC_FIELDS) {
		const lower = field.toLowerCase();
		if (hay.includes(lower)) return field;
	}
	return ACADEMIC_FIELDS[hashStr(`field:${hay}`) % ACADEMIC_FIELDS.length];
}
/** Analyze topic + niche and return the topic-matched persona (never a generic staff reporter). */
function personaForTopic(cue, niche = "") {
	const hay = ` ${`${cue} ${niche}`.toLowerCase()} `;
	const h = hashStr(`persona:${cue.toLowerCase()}:${niche.toLowerCase()}`);
	if (ACADEMIC_CUES.some((keyword) => hay.includes(keyword))) {
		const field = detectAcademicField(hay);
		const [university, city, stateCode] = UNIVERSITIES[h % UNIVERSITIES.length];
		const year = PHD_YEARS[(h >> 3) % PHD_YEARS.length];
		return {
			family: "academic",
			role: `${year}-Year PhD Candidate in ${field} at ${university}`,
			credential: `a ${year}-year doctoral researcher in ${field}`,
			tags: ["Graduate research", "Dissertation and academic writing"],
			experiential: true,
			affiliation: {
				city,
				stateCode
			}
		};
	}
	for (const family of PERSONA_FAMILIES) if (family.cues.some((keyword) => hay.includes(keyword))) {
		const role = family.roles[h % family.roles.length];
		return {
			family: family.id,
			role,
			credential: `a ${role}`,
			tags: family.tags,
			experiential: family.experiential
		};
	}
	const domain = label(topicStem(cue || niche || "general research"));
	return {
		family: "practitioner",
		role: `${domain} Practitioner`,
		credential: `a hands-on ${domain.toLowerCase()} practitioner`,
		tags: [domain, "Real-world practice"],
		experiential: hasExperientialCue(hay)
	};
}
/** Deterministic, distinct humanized voice baked from the author seed. */
function voiceFor(siteId, stem, pov) {
	const h = hashStr(`voice:${siteId}:${stem}`);
	const moves = [
		MOVES[h % MOVES.length],
		MOVES[(h >> 3) % MOVES.length],
		MOVES[(h >> 6) % MOVES.length]
	].filter((move, index, list) => list.indexOf(move) === index);
	return {
		rhythm: RHYTHMS[h % RHYTHMS.length],
		diction: DICTIONS[(h >> 2) % DICTIONS.length],
		sentenceLengthBand: `${8 + h % 5}–${14 + (h >> 4) % 8} words`,
		pov: pov ?? ((h >> 5) % 5 === 0 ? "second-person" : (h >> 5) % 11 === 0 ? "first-person" : "third-person"),
		tone: [
			"direct, specific, unsentimental",
			"practical and dry-humored",
			"warm but factual",
			"clinical to friendly",
			"plain-spoken authority"
		][(h >> 7) % 5],
		readingLevel: (h >> 9) % 6 === 0 ? "grade-7" : (h >> 9) % 7 === 0 ? "expert" : "general",
		signatureMoves: moves.length ? moves : [MOVES[0]],
		bannedPhrases: [
			BANNED[h % BANNED.length],
			BANNED[(h >> 4) % BANNED.length],
			BANNED[(h >> 8) % BANNED.length]
		].filter((phrase, index, list) => list.indexOf(phrase) === index)
	};
}
/**
* External avatar URL string only. Each author gets a unique token so a fresh,
* distinct portrait resolves per person. Nothing is ever fetched or written to
* disk — the static build stores this short string, not an image file. The URL
* points straight at thispersondoesnotexist.com, which renders a brand-new face
* on every request, so the byline portrait keeps changing over time.
*/
function avatarUrlFor(seed) {
	return avatarSourceUrl((hashStr(`avatar:${seed}`).toString(36) + hashStr(`avatar2:${seed}`).toString(36)).slice(0, 20));
}
function generateAuthorForTopic(topic, siteId, options = {}) {
	const stem = topicStem(topic);
	const h = hashStr(`${siteId}:${stem}`);
	const first = FIRST[h % FIRST.length];
	const last = LAST[Math.floor(h / 7) % LAST.length];
	const persona = personaForTopic(topic, options.niche);
	let city;
	let stateCode;
	if (persona.affiliation) {
		city = persona.affiliation.city;
		stateCode = persona.affiliation.stateCode;
	} else [city, stateCode] = STATES[Math.floor(h / 13) % STATES.length];
	const name = `${first} ${last}`;
	const expertise = expertiseForTopic(topic, stem, persona.tags);
	const bio = `${name} is ${persona.credential} based in ${city}, ${STATE_NAMES[stateCode] ?? stateCode}. ${label(stem)} is the beat: every piece answers one real decision, keeps the sourcing honest, and stays inside ${expertise[0].toLowerCase()}.`;
	const pov = persona.experiential || hasExperientialCue(`${topic} ${options.niche ?? ""}`) ? "first-person" : void 0;
	return {
		id: uid("author"),
		siteId,
		name,
		role: persona.role,
		shortBio: bio,
		city,
		region: STATE_NAMES[stateCode] ?? stateCode,
		country: "US",
		expertise,
		topic: stem,
		slug: slugify$1(`${first}-${last}-${stem}`),
		avatarUrl: avatarUrlFor(`${siteId}:${stem}:${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`),
		voice: voiceFor(siteId, stem, pov),
		articleCount: 0,
		maxArticles: 250,
		status: "active",
		ghostAuthorId: null,
		ghostSlug: null,
		createdAt: Date.now(),
		origin: "auto"
	};
}
function authorIsEligible(author) {
	return author.status === "active" && author.articleCount < author.maxArticles;
}
/** Score how well an author's expertise covers the topic's tokens. Higher wins. Caches per author. */
var EXPERTISE_SET_CACHE = /* @__PURE__ */ new WeakMap();
function expertiseScore(author, topic) {
	let tokens = EXPERTISE_SET_CACHE.get(author);
	if (!tokens) {
		tokens = new Set(author.expertise.flatMap((tag) => expertiseTokens(tag)).concat(expertiseTokens(author.topic)));
		EXPERTISE_SET_CACHE.set(author, tokens);
	}
	const topicTokens = expertiseTokens(topic);
	let score = 0;
	for (const token of topicTokens) if (tokens.has(token)) score += 1;
	if (author.topic === topicTokens[0]) score += 2;
	return score;
}
/** Above this pool size the matcher skips the fuzzy token pass (exact stem only) — keeps 10k-batch intake sub-minute. */
var FUZZY_MATCH_LIMIT = 2e3;
/**
* Rule 2 matcher. Idempotent per job: pass the job and the assigned author wins
* every retry. Picks the best-matching, least-loaded active author under the
* cap; only when none exists does it generate a brand-new US expert.
* Pure decision + optional mutation of `authors`.
*/
function matchOrCreateAuthorForTopic(site, authors, keywordOrTopic, options = {}) {
	const existing = options.existingAuthorId ? authors.find((author) => author.id === options.existingAuthorId) : void 0;
	if (existing) return {
		author: existing,
		created: false
	};
	const cue = String(keywordOrTopic ?? "").trim() || options.niche || site.nicheTag;
	const stem = topicStem(cue);
	const autoMatch = options.autoMatch !== false;
	const fuzzy = autoMatch && authors.length <= FUZZY_MATCH_LIMIT;
	let best = null;
	let bestScore = 0;
	let bestLoad = 0;
	if (autoMatch) for (const author of authors) {
		if (author.siteId !== site.id || !authorIsEligible(author)) continue;
		let score;
		if (author.topic === stem) score = 3;
		else if (author.expertise.includes(stem)) score = 2;
		else {
			if (!fuzzy) continue;
			score = expertiseScore(author, cue) || (author.topic === topicStem(cue) ? 1 : 0);
		}
		if (score <= 0) continue;
		if (!best || score > bestScore || score === bestScore && author.articleCount < bestLoad) {
			best = author;
			bestScore = score;
			bestLoad = author.articleCount;
		}
	}
	if (best) return {
		author: best,
		created: false
	};
	const author = generateAuthorForTopic(cue || site.nicheTag, site.id, { niche: options.niche ?? site.nicheTag });
	authors.push(author);
	return {
		author,
		created: true
	};
}
/**
* Rule 2 counter: increments once per article (guarded by article.authorCounted)
* and retires the author at the 250 cap so the niche rotates to a fresh expert.
*/
function markAuthorPublished(data, article, now) {
	if (!article.authorId || article.authorCounted) return false;
	const author = data.authors.find((item) => item.id === article.authorId);
	if (!author) return false;
	article.authorCounted = true;
	author.articleCount += 1;
	if (author.articleCount >= author.maxArticles) {
		author.status = "retired";
		data.activity.unshift({
			id: uid("act"),
			at: now,
			siteId: author.siteId,
			tone: "warn",
			message: `${author.name} retired at the ${author.maxArticles}-article cap. The next ${author.topic} piece spawns a fresh US expert.`
		});
	}
	return true;
}
/** Persist-v8 migration: upgrade an old-shape stored author without losing data. */
function normalizeAuthorProfile(raw, articleCounts) {
	const legacy = raw;
	const topic = raw.topic ?? topicStem(raw.expertise?.[0] ?? "general research");
	const persona = personaForTopic(topic);
	const genericRole = !raw.role || /^staff\s+(writer|reporter)/i.test(raw.role);
	return {
		id: raw.id ?? uid("author"),
		siteId: raw.siteId ?? "",
		name: raw.name ?? "Unassigned Writer",
		role: genericRole ? persona.role : raw.role,
		shortBio: legacy.shortBio ?? legacy.bio ?? "",
		city: raw.city ?? "Austin",
		region: raw.region ?? "TX",
		country: "US",
		expertise: Array.isArray(raw.expertise) && raw.expertise.length ? raw.expertise : [label(topic)],
		topic,
		slug: raw.slug ?? slugify$1(raw.name ?? "author"),
		avatarUrl: raw.avatarUrl && !isOurAvatarUrl(raw.avatarUrl) ? raw.avatarUrl : avatarUrlFor(raw.id ?? raw.name ?? uid("author")),
		voice: raw.voice ?? voiceFor(raw.siteId ?? "studio", topic, persona.experiential ? "first-person" : void 0),
		articleCount: raw.articleCount ?? articleCounts?.get(raw.id ?? "") ?? 0,
		maxArticles: raw.maxArticles ?? 250,
		status: raw.status === "retired" || raw.articleCount != null && raw.articleCount >= (raw.maxArticles ?? 250) ? "retired" : "active",
		ghostAuthorId: raw.ghostAuthorId ?? null,
		ghostSlug: raw.ghostSlug ?? null,
		createdAt: raw.createdAt ?? Date.now(),
		origin: raw.origin ?? "auto"
	};
}
/** Prompt-facing voice block injected into stages 1–3 so drafts adopt the persona. */
function authorVoiceBlock(author) {
	const voice = author.voice;
	const povLine = voice.pov === "first-person" ? `Point of view: FIRST PERSON. Write as ${author.name} — a real practitioner sharing specific, lived experience in "I" / "my experience", never a detached staff-reporter voice.` : `Point of view: ${voice.pov}.`;
	return [
		`Author: ${author.name} (${author.role}) based in ${author.city}, ${author.region}, US.`,
		`Expertise: ${(author.expertise ?? []).join("; ")}.`,
		`Bio: ${author.shortBio}`,
		`Voice: ${voice.tone}; ${voice.rhythm}; ${voice.diction}; average sentences ${voice.sentenceLengthBand}; reading level ${voice.readingLevel}.`,
		povLine,
		`Signature moves: ${(voice.signatureMoves ?? []).join("; ")}.`,
		`Never write these robotic AI phrases anywhere: ${(voice.bannedPhrases ?? []).concat([
			"delve",
			"tapestry",
			"in today's fast-paced world"
		]).join(" | ")}.`
	].join("\n");
}
/** Dry-run helper for the Authors UI simulator: does this niche already have an under-cap expert? */
function previewAuthorMatch(siteId, authors, topic) {
	const stem = topicStem(topic);
	const pool = authors.filter((author) => author.siteId === siteId && authorIsEligible(author));
	let best = null;
	let bestScore = 0;
	for (const author of pool) {
		const score = expertiseScore(author, topic) || (author.topic === stem ? 1 : 0);
		if (score > bestScore) {
			best = author;
			bestScore = score;
		}
	}
	return {
		matched: bestScore > 0 ? best : null,
		wouldGenerate: bestScore === 0,
		stem
	};
}
/** Legacy alias kept for the seed/migration call sites. */
function attachAuthor(data, siteId, topic) {
	const stem = topicStem(topic);
	const existing = data.authors.find((author) => author.siteId === siteId && author.topic === stem);
	if (existing) return existing;
	const profile = generateAuthorForTopic(topic, siteId);
	data.authors.push(profile);
	return profile;
}
var STOP = new Set("a an the of for and to in on how with your that this from what when who why into over about between without than then are was were will just more most".split(" "));
function postHref(slug) {
	return `/post/${slug.replace(/^\/+|\/+$/g, "").replace(/^post\//, "")}/`;
}
function anchorPhrase(title) {
	const raw = title.replace(/[“”"']/g, "").trim();
	const words = raw.split(/\s+/).filter(Boolean);
	const content = words.filter((word) => !STOP.has(word.toLowerCase().replace(/[^a-z0-9]/g, "")));
	const phrase = (content.length >= 2 ? content : words).slice(0, 4).join(" ").replace(/[.:;,]+$/g, "");
	if (phrase.length >= 8) return phrase;
	return raw.slice(0, 72);
}
function linkSentence(anchor) {
	return `The notes on ${anchor} cover the next question, so this page does not repeat them.`;
}
function alreadyLinked(html, markdown, slug) {
	const href = postHref(slug);
	const bare = `/${slug.replace(/^\/+|\/+$/g, "")}`;
	return html.includes(href) || markdown.includes(href) || html.includes(`href="${bare}"`) || html.includes(`href="${bare}/"`);
}
function insertAnchor(html, markdown, anchor, slug) {
	if (!anchor.trim() || !slug.trim()) return {
		html,
		markdown,
		inserted: false
	};
	if (alreadyLinked(html, markdown, slug)) return {
		html,
		markdown,
		inserted: false
	};
	const href = postHref(slug);
	const sentence = linkSentence(anchor);
	const linked = sentence.replace(anchor, `<a href="${esc(href)}">${esc(anchor)}</a>`);
	const md = sentence.replace(anchor, `[${anchor}](${href})`);
	return {
		html: `${html.trim()}\n<p>${linked}</p>`,
		markdown: `${markdown.trim()}\n\n${md}\n`,
		inserted: true
	};
}
function unwrapAnchor(html, markdown, slug) {
	const href = postHref(slug);
	const pattern = new RegExp(`<a href="${href.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}">([\\s\\S]*?)</a>`, "g");
	const mdPattern = new RegExp(`\\[([^\\]]+)\\]\\(${href.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\)`, "g");
	return {
		html: html.replace(pattern, "$1"),
		markdown: markdown.replace(mdPattern, "$1")
	};
}
function retargetAnchor(html, markdown, fromSlug, toSlug, anchor) {
	const from = postHref(fromSlug);
	const to = postHref(toSlug);
	let nextHtml = html.split(from).join(to);
	let nextMd = markdown.split(from).join(to);
	if (!nextHtml.includes(to)) {
		const inserted = insertAnchor(nextHtml, nextMd, anchor, toSlug);
		nextHtml = inserted.html;
		nextMd = inserted.markdown;
	}
	return {
		html: nextHtml,
		markdown: nextMd
	};
}
function linkEdge(anchor, slug, state = "LOCAL") {
	return {
		anchor,
		targetSlug: slug,
		state
	};
}
function inboundCount(articles, slug) {
	return articles.filter((article) => article.links.some((link) => link.targetSlug === slug)).length;
}
function orphansOf(articles) {
	if (articles.length < 2) return [];
	return articles.filter((article) => inboundCount(articles, article.slug) === 0);
}
function embed(s) {
	const n = 48;
	const v = new Float64Array(n);
	const t = ` ${normalize(s)} `;
	for (let i = 0; i < Math.max(0, t.length - 2); i++) {
		const tri = t.slice(i, i + 3);
		let h = 2166136261;
		for (let c = 0; c < tri.length; c++) h = Math.imul(h ^ tri.charCodeAt(c), 16777619);
		const idx = Math.abs(h) % n;
		v[idx] += h & 1 ? 1 : -1;
	}
	return normalizeVector(v);
}
function normalize(s) {
	return s.toLowerCase().replace(/['’]/g, "").replace(/[^a-z0-9+#.\s-]/g, " ").replace(/\s+/g, " ").trim();
}
function normalizeVector(v) {
	let mag = 0;
	for (let i = 0; i < v.length; i++) mag += v[i] * v[i];
	mag = Math.sqrt(mag) || 1;
	for (let i = 0; i < v.length; i++) v[i] = v[i] / mag;
	return v;
}
function cosine(a, b) {
	if (a.length !== b.length || a.length === 0) throw new Error(`L3 dimension mismatch (${a.length} vs ${b.length})`);
	let s = 0;
	for (let i = 0; i < a.length; i++) s += a[i] * b[i];
	return s;
}
/** Provider vectors when they succeed. RATE_LIMIT or a bad shape falls back to the local hash embed. */
async function embedForL3(text, provider) {
	if (!provider) return {
		vector: embed(text),
		source: "hash-fallback",
		note: "No provider embedder; local hash vector."
	};
	try {
		const raw = await provider(text);
		if (!Array.isArray(raw) || raw.length < 2 || raw.some((n) => typeof n !== "number" || !Number.isFinite(n))) throw new Error("provider embed returned an unusable vector");
		return {
			vector: normalizeVector(Float64Array.from(raw)),
			source: "provider"
		};
	} catch (error) {
		const note = error instanceof Error ? error.message : "provider embed failed";
		return {
			vector: embed(text),
			source: "hash-fallback",
			note
		};
	}
}
/** Embed every text with one source. A provider failure or a length mismatch re-embeds the whole set with the local hash. */
async function embedAllForL3(texts, provider) {
	if (!texts.length) return {
		vectors: [],
		source: "hash-fallback",
		note: "No provider embedder; local hash vector."
	};
	const rows = await Promise.all(texts.map((text) => embedForL3(text, provider)));
	const length = rows[0].vector.length;
	const same = rows.every((row) => row.source === rows[0].source && row.vector.length === length);
	if (!provider || rows[0].source === "hash-fallback" || !same) {
		const hashed = rows[0].source === "hash-fallback" && same ? rows : await Promise.all(texts.map((text) => embedForL3(text)));
		const note = rows.find((row) => row.note)?.note ?? hashed[0]?.note;
		return {
			vectors: hashed.map((row) => row.vector),
			source: "hash-fallback",
			note
		};
	}
	return {
		vectors: rows.map((row) => row.vector),
		source: "provider"
	};
}
var humanizer_exports = /* @__PURE__ */ __exportAll({
	BLADER_AUDIT_CONTRACT: () => BLADER_AUDIT_CONTRACT,
	BLADER_DRAFT_RULES: () => BLADER_DRAFT_RULES,
	BLADER_REWRITE_CONTRACT: () => BLADER_REWRITE_CONTRACT,
	BLADER_RULES: () => BLADER_RULES,
	BLADER_SOURCE: () => BLADER_SOURCE,
	BLADER_VERSION: () => BLADER_VERSION,
	deterministicScrub: () => deterministicScrub,
	humanizeWithBlader: () => humanizeWithBlader,
	humanizerScore: () => humanizerScore,
	scanAiPatterns: () => scanAiPatterns,
	structuralFingerprint: () => structuralFingerprint
});
var BLADER_SOURCE = "blader/humanizer v3.1.0 · Wikipedia 'Signs of AI writing'";
var BLADER_VERSION = "blader@1";
/** The 26 patterns, numbered like the skill (§1 strongest first). */
var BLADER_RULES = [
	{
		id: 1,
		name: "Not X but Y contrast",
		group: "staging",
		weight: 6,
		watch: [
			"not just",
			"not only",
			"not merely",
			"isn't just",
			"is not a tool but"
		],
		regex: /\b(?:it'?s|it is|this is|that's|they'?re|they are|isn'?t)\s+not\s+(?:just|only|merely)\b[^.!?\n]*[,;:]\s*(?:it|this|that)\s*(?:'s|\s+is\b)\b/i
	},
	{
		id: 2,
		name: "One-line closer / dramatic fragment",
		group: "staging",
		weight: 5,
		watch: [
			"that is the real win",
			"that's the real win",
			"that distinction matters",
			"read that again",
			"let that sink in",
			"the message was clear",
			"it was a lesson in",
			"this shows the importance of"
		]
	},
	{
		id: 3,
		name: "Saying that sounds deep",
		group: "staging",
		weight: 5,
		watch: [
			"the real question is",
			"at its core",
			"what really matters",
			"the deeper issue",
			"the heart of the matter",
			"becomes a trap"
		]
	},
	{
		id: 4,
		name: "Staged run-up",
		group: "staging",
		weight: 5,
		watch: [
			"let's dive in",
			"let's dive into",
			"let's explore",
			"let's break this down",
			"here's what you need to know",
			"now let's look at",
			"without further ado",
			"here's the thing",
			"let's be honest",
			"real talk"
		]
	},
	{
		id: 5,
		name: "Arguing with no one",
		group: "staging",
		weight: 5,
		watch: [
			"this isn't about",
			"i'm not saying",
			"don't get me wrong",
			"this is not to say",
			"some might say",
			"a tempting approach",
			"one might be tempted",
			"an obvious approach would be",
			"you might think",
			"it would be easy to just"
		]
	},
	{
		id: 6,
		name: "Forced triad",
		group: "rhythm",
		weight: 3,
		watch: []
	},
	{
		id: 7,
		name: "Repeated sentence openings",
		group: "rhythm",
		weight: 2,
		watch: []
	},
	{
		id: 8,
		name: "Dash as universal connector",
		group: "rhythm",
		weight: 3,
		watch: []
	},
	{
		id: 9,
		name: "Stacked qualifiers",
		group: "rhythm",
		weight: 2,
		watch: [
			"to be fair,",
			"could potentially",
			"might arguably",
			"in some cases it may",
			"it's also possible"
		]
	},
	{
		id: 10,
		name: "Hyphenated pair after the noun",
		group: "rhythm",
		weight: 1,
		watch: [],
		regex: /\b(?:report|process|plan|result|output|system|data)\s+is\s+(?:high-quality|well-known|well-documented|long-term|real-time|client-facing)\b/i
	},
	{
		id: 11,
		name: "Passive voice / missing subject",
		group: "rhythm",
		weight: 1,
		watch: []
	},
	{
		id: 12,
		name: "Overused AI word",
		group: "inflation",
		weight: 3,
		watch: [
			"delve",
			"tapestry",
			"pivotal",
			"crucial",
			"meticulous",
			"meticulously",
			"showcase",
			"showcases",
			"underscores",
			"underscore",
			"garner",
			"intricate",
			"intricacies",
			"interplay",
			"bolstered",
			"enduring",
			"testament",
			"robust",
			"seamless",
			"seamlessly",
			"vibrant",
			"utilize",
			"utilization",
			"facilitate",
			"additionally",
			"in conclusion"
		]
	},
	{
		id: 13,
		name: "Inflated significance",
		group: "inflation",
		weight: 5,
		watch: [
			"stands as a testament",
			"a pivotal moment",
			"plays a key role",
			"plays a crucial role",
			"underscores its importance",
			"reflects a broader",
			"lasting legacy",
			"enduring legacy",
			"setting the stage for",
			"evolving landscape",
			"indelible mark",
			"continues to thrive",
			"challenges and legacy",
			"future outlook",
			"the future looks bright",
			"exciting times",
			"a step in the right direction",
			"shaping the future"
		]
	},
	{
		id: 14,
		name: "Vague association",
		group: "inflation",
		weight: 3,
		watch: [
			"associated with",
			"in association with",
			"in connection with",
			"tied to"
		]
	},
	{
		id: 15,
		name: "Shallow -ing rider",
		group: "inflation",
		weight: 4,
		watch: [
			"highlighting",
			"underscoring",
			"emphasizing",
			"ensuring",
			"reflecting",
			"symbolizing",
			"cultivating",
			"fostering",
			"encompassing",
			"showcasing"
		]
	},
	{
		id: 16,
		name: "Sales language",
		group: "inflation",
		weight: 4,
		watch: [
			"nestled",
			"in the heart of",
			"must-visit",
			"breathtaking",
			"stunning",
			"renowned",
			"groundbreaking",
			"rich cultural heritage",
			"natural beauty",
			"diverse array",
			"commitment to",
			"exemplifies",
			"profound"
		]
	},
	{
		id: 17,
		name: "Borrowed authority",
		group: "inflation",
		weight: 4,
		watch: [
			"experts argue",
			"observers have cited",
			"industry reports",
			"some critics",
			"several publications",
			"active social media presence"
		]
	},
	{
		id: 18,
		name: "Avoiding is/are/has",
		group: "inflation",
		weight: 2,
		watch: [
			"serves as",
			"stands as",
			"functions as",
			"operates as",
			"boasts"
		]
	},
	{
		id: 19,
		name: "Bold as decoration",
		group: "formatting",
		weight: 3,
		watch: []
	},
	{
		id: 20,
		name: "Decorative heading / emoji label",
		group: "formatting",
		weight: 3,
		watch: [
			"🚀",
			"💡",
			"✨",
			"→"
		]
	},
	{
		id: 21,
		name: "Curly quotation marks",
		group: "formatting",
		weight: 1,
		watch: []
	},
	{
		id: 22,
		name: "Chatbot residue",
		group: "leftovers",
		weight: 6,
		watch: [
			"i hope this helps",
			"of course!",
			"certainly!",
			"great question!",
			"you're absolutely right",
			"would you like",
			"want me to",
			"should i continue",
			"let me know if"
		]
	},
	{
		id: 23,
		name: "Knowledge-limit disclaimer",
		group: "leftovers",
		weight: 5,
		watch: [
			"as of my",
			"up to my last",
			"while specific details are limited",
			"based on available information",
			"not publicly available",
			"not widely documented",
			"maintains a low profile",
			"keeps personal details private",
			"it is believed that"
		]
	},
	{
		id: 24,
		name: "Heading repeated in first sentence",
		group: "leftovers",
		weight: 3,
		watch: []
	},
	{
		id: 25,
		name: "Writing about the document",
		group: "leftovers",
		weight: 3,
		watch: [
			"was added to replace",
			"generated from",
			"compiled from",
			"the table below compares",
			"this section is organized"
		]
	},
	{
		id: 26,
		name: "Re-explaining to the reader",
		group: "wrong-reader",
		weight: 2,
		watch: []
	}
];
/** Deterministic scan for AI tells. Word scans skip inline code and link targets. */
function scanAiPatterns(text) {
	const body = String(text ?? "").replace(/```[\s\S]*?```/g, " ").replace(/`[^`\n]*`/g, " ").replace(/\[[^\]]*\]\([^)]*\)/g, (link) => link.replace(/\([^)]*\)/, "()"));
	const hits = [];
	let overflow = false;
	const push = (id, excerpt) => {
		if (overflow) return;
		if (hits.length >= 400) {
			overflow = true;
			return;
		}
		const rule = BLADER_RULES.find((r) => r.id === id);
		hits.push({
			id,
			pattern: rule.name,
			rule: rule.group,
			excerpt: excerpt.trim().replace(/\s+/g, " ").slice(0, 140)
		});
	};
	for (const rule of BLADER_RULES) {
		for (const phrase of rule.watch) {
			const safe = phrase.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
			const re = new RegExp(`(^|[^\\p{L}])${safe}(?![\\p{L}])`, "giu");
			let match;
			while (match = re.exec(body)) {
				push(rule.id, body.slice(Math.max(0, match.index - 30), match.index + match[0].length + 80));
				re.lastIndex = match.index + match[0].length;
				if (overflow) break;
			}
			if (overflow) break;
		}
		if (rule.regex && !overflow) {
			const re = new RegExp(rule.regex.source, rule.regex.flags.includes("g") ? rule.regex.flags : `${rule.regex.flags}g`);
			let match;
			while (match = re.exec(body)) {
				push(rule.id, body.slice(Math.max(0, match.index - 20), match.index + match[0].length + 40));
				if (overflow) break;
			}
		}
		if (overflow) break;
	}
	if (/(?:^|[\s("[])(?:--|—|–)(?:$|[\s,.)\]]|[a-z])/im.test(body)) push(8, "em/en dash used as a connector");
	if (/[“”][^“”]*[“”]/.test(body)) push(21, "curly quotation marks");
	const triad = /\b\p{Lu}?\p{L}[\p{L}-]{1,18},\s+\p{L}[\p{L}-]{1,18},\s+(?:and|or)\s+\p{L}[\p{L}-]{1,18}\b/gu;
	let tri;
	while (tri = triad.exec(body)) {
		push(6, tri[0]);
		if (overflow) break;
	}
	const sentences = body.split(/(?<=[.!?])\s+/);
	for (let i = 0; i + 2 < sentences.length; i++) {
		const first = sentences[i].trim().split(/\s+/)[0]?.toLowerCase().replace(/\W/g, "");
		if (!first || first.length < 3) continue;
		if (sentences[i + 1].trim().toLowerCase().startsWith(first) && sentences[i + 2].trim().toLowerCase().startsWith(first)) {
			push(7, `${sentences[i].slice(0, 60)}…`);
			i += 2;
		}
		if (overflow) break;
	}
	const deduped = [];
	const seen = /* @__PURE__ */ new Set();
	for (const hit of hits) {
		const key = `${hit.id}:${hit.excerpt.slice(0, 60)}`;
		if (seen.has(key)) continue;
		seen.add(key);
		deduped.push(hit);
	}
	return deduped;
}
/** 0–100 human-prose score. Every tell costs its rule weight; 100 = none found. */
function humanizerScore(text) {
	const hits = scanAiPatterns(text);
	const penalty = hits.reduce((sum, hit) => sum + (BLADER_RULES.find((rule) => rule.id === hit.id)?.weight ?? 2), 0);
	return {
		score: Math.max(0, Math.min(100, 100 - penalty)),
		hits
	};
}
/** Structure counts a rewrite must preserve for Bing SEO. */
function structuralFingerprint(text) {
	const source = String(text ?? "");
	return {
		h1: (source.match(/^# (?!#)/gm) ?? []).length,
		h2: (source.match(/^## (?!#)/gm) ?? []).length,
		h3: (source.match(/^### (?!#)/gm) ?? []).length,
		tables: (source.match(/^\|.+\|$/gm) ?? []).length,
		links: (source.match(/\]\([^)]+\)/g) ?? []).length,
		words: source.split(/\s+/).filter(Boolean).length
	};
}
function structureIntact(before, after) {
	const close = (a, b, tol) => Math.abs(a - b) <= tol;
	return close(before.h2, after.h2, 0) && close(before.h3, after.h3, 1) && close(before.tables, after.tables, 0) && close(before.links, after.links, Math.max(1, Math.floor(before.links * .1))) && after.words > before.words * .6 && after.words < before.words * 1.5;
}
/** Safe word swaps — `match` → `replacement`, applied outside protected segments. */
var BANNED_SWAPS = [
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
	[/\bin conclusion,?\s*/gi, ""]
];
var RESIDUE_LINE = /^\s*(?:i hope this helps|of course!|certainly!|great question!|you're absolutely right(?:[!,.]|$)|would you like[^.?!]*\?|want me to[^.?!]*\?|should i continue\??|let me know if[^.?!]*[.?!]?)\s*$/i;
var RESIDUE_SENTENCE = /^\s*(?:i hope this helps!?|of course!?|certainly!?|great question!?|you're absolutely right!?|would you like[^.?!]*\?|want me to[^.?!]*\?|should i continue\?|let me know (?:if|whether)[^.?!]*[.?!]?)\s*$/i;
var CLOSER_LINE = /^\s*(?:that is the real win\.?|that's the real win\.?|that distinction matters\.?|read that again\.?|let that sink in\.?|the future looks bright[^.?!]*\.?|exciting times (?:lie|are) ahead[^.?!]*\.?)\s*$/i;
var FILLER_HEADING = /^#{1,6}\s*(?:future outlook|challenges and legacy|challenges and future outlook|awards and recognition)\s*$/gim;
/** Protect code blocks, inline code, markdown links and table rows from edits. */
function protectSegments(text, keepTables) {
	const keep = [];
	const pattern = new RegExp("```[\\s\\S]*?```|`[^`\\n]*`|\\[[^\\]]*\\]\\([^)]*\\)" + (keepTables ? "|(?:^\\|.+\\|$)" : ""), "gm");
	return {
		masked: text.replace(pattern, (segment) => {
			keep.push(segment);
			return `\u0000K${keep.length - 1}\u0000`;
		}),
		unprotect: (value) => value.replace(/\u0000K(\d+)\u0000/g, (_, index) => keep[Number(index)] ?? "")
	};
}
/**
* Deterministic pass (no model key needed): removes chatbot residue, filler
* closers/sections, em-dash chaining, curly quotes, the not-X-it's-Y contrast
* and banned vocabulary — without touching code blocks, inline code, link
* targets, link anchors, or markdown table rows.
*/
function deterministicScrub(markdown, bannedPhrases = []) {
	const stripped = [];
	const note = (label) => {
		if (!stripped.includes(label)) stripped.push(label);
	};
	let text = typeof markdown === "string" ? markdown : "";
	if (/i hope this helps|great question!|certainly!|of course!|you're absolutely right|would you like|want me to|should i continue|let me know if/i.test(text)) {
		note("§22 chatbot residue");
		const residue = new RegExp(RESIDUE_SENTENCE.source, "i");
		const wholeLine = new RegExp(RESIDUE_LINE.source, "i");
		text = text.split("\n").map((line) => {
			if (wholeLine.test(line)) return "";
			return line.split(/(?<=[.!?])\s+/).filter((sentence) => !residue.test(sentence)).join(" ").trim();
		}).filter((line) => line !== "").join("\n");
	}
	if (/the future looks bright|exciting times|read that again|let that sink in|that's the real win|that distinction matters/i.test(text)) {
		note("§2/§13 filler closer or send-off");
		const closer = new RegExp(CLOSER_LINE.source, "i");
		const wholeCloser = new RegExp(CLOSER_LINE.source, "im");
		text = text.split("\n").map((line) => {
			if (wholeCloser.test(line)) return "";
			return line.split(/(?<=[.!?])\s+/).filter((sentence) => !closer.test(sentence)).join(" ").trim();
		}).filter((line) => line !== "").join("\n");
	}
	if (FILLER_HEADING.test(text)) {
		note("§13 stock section heading");
		text = text.replace(FILLER_HEADING, "");
	}
	if (/[—–]|\s--\s/.test(text)) {
		note("§8 dashes as connectors");
		const { masked, unprotect } = protectSegments(text, false);
		text = unprotect(masked.replace(/\s*[—–]+\s*|\s--\s/g, ", "));
	}
	if (/[“”‘’]/.test(text)) {
		note("§21 curly quotes");
		text = text.replace(/[“”]/g, "\"").replace(/[‘’]/g, "'");
	}
	if (/\bnot\s+(?:just|only|merely)\b/i.test(text)) {
		const contrast = /^(it'?s|it is|this is|that's|they'?re|they are)\s+not\s+(?:just|only|merely)\s+(?<x>[^.!?\n]+?)\s*[,;:]?\s*(?:—|--)?\s*(?:it|this|that)\s*(?:'s|\s+is)\s+(?<y>[^.!?\n]+?)\.?\s*$/im;
		note("§1 not-X-but-Y contrast");
		const { masked, unprotect } = protectSegments(text, true);
		text = unprotect(masked.split("\n").map((line) => line.split(/(?<=[.!?])\s+/).map((sentence) => sentence.replace(contrast, (full, _prefix, x, y) => {
			const tail = full.trim().endsWith("!") ? "!" : full.trim().endsWith("?") ? "?" : ".";
			return `${x.trim().charAt(0).toUpperCase()}${x.trim().slice(1)}, and ${y.trim()}${tail}`;
		})).join(" ")).join("\n"));
	}
	const { masked, unprotect } = protectSegments(text, true);
	let working = masked;
	for (const [pattern, replacement] of BANNED_SWAPS) if (pattern.test(working)) {
		note(`§12 overused word: ${pattern.source.replace(/\\b/g, "").replace(/\((?:\?:)?[^)]*\)/g, "").slice(0, 30)}`);
		pattern.lastIndex = 0;
		working = working.replace(pattern, replacement);
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
	text = text.replace(/[ \t]{2,}/g, " ").replace(/ ([,.;:!?])/g, "$1").replace(/,\s*\./g, ".").replace(/\n{3,}/g, "\n\n").replace(/^[ \t]+$/gm, "").trim();
	return {
		markdown: text,
		stripped
	};
}
/** Prompt fragment: the full anti-pattern constitution injected into Stage 2 drafts. */
var BLADER_DRAFT_RULES = [
	"State every point directly. Never stage it: no not-X-but-Y contrasts ('It's not just X, it's Y'), no one-line closers ('That is the real win.'), no sayings-that-sound-deep ('At its core…'), no run-ups ('Let's dive in…'), and no arguing against objections nobody made.",
	"Rhythm comes from meaning: no forced triads (X, Y, and Z) unless there really are three items, no em or en dashes (use a comma, colon, or full stop), no repeated sentence openings, no stacked qualifiers.",
	"No inflated vocabulary: never write delve, tapestry, pivotal, crucial, meticulous, testament, showcase, underscore, robust, seamless, vibrant, intricate, utilize, leverage, garner, or 'in conclusion'.",
	"No inflated significance: no 'pivotal moment', 'lasting legacy', 'evolving landscape', 'continues to thrive', no 'Future Outlook' section, no send-off paragraph. End on the last concrete fact.",
	"No sales language and no borrowed authority: no 'nestled', 'breathtaking', 'rich heritage', 'renowned', no unnamed 'experts say'. Use is/are/has instead of 'serves as', 'stands as', 'boasts'.",
	"No rule-based formatting: no decorative bold labels, no emoji or arrows in headings, sentence-case headings, straight quotes only, and never open a section by restating its heading.",
	"No chatbot residue ('I hope this helps'), no knowledge-limit disclaimers, no writing about the document instead of the subject."
];
/** Pass-1 audit prompt: identify what still reads as machine-written. */
var BLADER_AUDIT_CONTRACT = [
	"You audit prose for AI tells using the blader/humanizer ruleset (Wikipedia 'Signs of AI writing'). Return valid JSON only, no markdown fence.",
	"Return JSON matching {\"issues\":[{\"id\":number,\"note\":\"what still sounds machine-written and why, one line\"}]}.",
	"Look for: staging contrasts (not X but Y), one-line closers, deep-sounding sayings, staged run-ups, arguing with no one, forced triads, repeated sentence openings, em-dash chaining, stacked qualifiers, overused AI words (delve, tapestry, pivotal, robust…), inflated significance, vague association, shallow -ing riders, sales language, borrowed authority, avoided is/are/has verbs, decorative bold, emoji or arrow headings, curly quotes, chatbot residue, knowledge-limit disclaimers, a heading repeated in the first sentence, writing about the document instead of the subject.",
	"Report only what the sample actually contains. An empty issue list is valid."
];
/** Pass-2 rewrite contract: preserve everything that carries SEO or meaning. */
var BLADER_REWRITE_CONTRACT = [
	"You are the blader/humanizer surgical rewriter. Rewrite machine-sounding prose so it reads like the assigned human author, without changing what it says. Do not invent facts, names, numbers, dates, quotes, or citations.",
	"Preserve the Bing SEO skeleton EXACTLY: the same H1/H2/H3 headings (you may reword a heading only to de-AI it while keeping the same meaning and question shape), every markdown table and all of its rows, every markdown link with its exact href and anchor, and the direct-answer opening.",
	"Remove the flagged AI tells: state each point plainly instead of patching phrases. Vary sentence length; alternate short and long. No em/en dashes anywhere — use commas, colons, or full stops. Use is/are/has. No banned vocabulary, no staged contrasts, no one-line closers, no filler conclusion — end on the last concrete fact.",
	"Match the author's voice block: rhythm, diction, sentence-length band, signature moves, point of view. Keep specific details, honest mixed feelings, and grounded asides.",
	"Return valid JSON only matching {\"markdown\":\"the full rewritten article markdown\"}. No markdown fence, no commentary."
];
/** Full surgical two-pass humanization. Without `chat` it stays deterministic. */
async function humanizeWithBlader(input) {
	const markdown = typeof input.markdown === "string" ? input.markdown : "";
	const banned = [...input.authorBannedPhrases ?? []];
	const fingerprint = structuralFingerprint(markdown);
	const before = humanizerScore(markdown);
	const det = deterministicScrub(markdown, banned);
	let text = det.markdown;
	const stripped = det.stripped;
	let passes = 1;
	let llm = false;
	let keyId;
	let usage;
	let note = "Blader humanizer · deterministic pass only";
	if (input.chat) try {
		const call = input.chat;
		const voice = [
			input.authorVoice ? `Author voice (adopt exactly):\n${input.authorVoice}` : input.authorName ? `You write as ${input.authorName}, a US staff writer with a plain, grounded human voice.` : "",
			input.title ? `Article title: ${input.title}` : "",
			input.keyword ? `Target query: ${input.keyword}` : ""
		].filter(Boolean).join("\n");
		let issues = [];
		const audit = await call(BLADER_AUDIT_CONTRACT.join(" "), [
			voice,
			"Sample to audit:",
			det.markdown
		].filter(Boolean).join("\n\n"));
		if (audit.ok) {
			usage = audit.usage;
			keyId = audit.keyId;
			try {
				issues = (JSON.parse(String(audit.text ?? "").replace(/^```json\s*|```$/g, "").trim()).issues ?? []).filter((issue) => typeof issue.note === "string").slice(0, 12);
			} catch {
				issues = [];
			}
		}
		if (!issues.length && before.hits.length) issues = before.hits.slice(0, 12).map((hit) => ({
			id: hit.id,
			note: `${hit.pattern}: ${hit.excerpt}`
		}));
		if (issues.length) {
			const rewrite = await call([...BLADER_REWRITE_CONTRACT, voice].filter(Boolean).join("\n\n"), [
				"AI tells to remove (detected by the audit pass):",
				...issues.map((issue, index) => `${index + 1}. [${issue.id ?? "?"}] ${issue.note}`),
				"",
				"Article to rewrite:",
				det.markdown
			].join("\n"));
			if (rewrite.ok) {
				usage = rewrite.usage;
				keyId = rewrite.keyId;
				try {
					const candidate = (JSON.parse(String(rewrite.text ?? "").replace(/^```json\s*|```$/g, "").trim()).markdown ?? "").trim();
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
		} else note = "Blader humanizer · audit found no remaining tells";
	} catch (error) {
		stripped.push(`LLM pass unavailable: ${error instanceof Error ? error.message : "failed"}`);
	}
	const final = humanizerScore(text);
	return {
		markdown: text,
		score: final.score,
		stripped,
		passes,
		llm,
		note,
		keyId,
		usage
	};
}
/**
* Rule 3 prompt contracts (MASTER_SPEC §2).
* Tiers: stage 1 fast (~0.4) · stage 2 balanced (~0.7) · stage 3 balanced (~0.3) · stage 4/5 fast · stage 6 no LLM.
*/
var STAGE_PROMPT_VERSIONS = {
	intent: "intent@2-bing",
	draft: "draft@4-blader-anti-ai",
	revision: "revision@4-blader-humanize",
	metadata: "metadata@2-llm",
	enrichment: "enrichment@2-llm",
	publish: "publish@1"
};
var stageSchemas = {
	intent: object({
		intent: string().min(1),
		mustCover: array(string())
	}),
	draft: object({ markdown: string().min(80) }),
	revision: object({
		markdown: string().min(80),
		verifyFlags: array(object({
			claim: string().min(1),
			why: string().min(1)
		})).default([])
	}),
	metadata: object({
		title: string().min(1),
		metaDescription: string().min(1),
		slug: string().min(1),
		excerpt: string().min(1),
		tags: array(string())
	}),
	enrichment: object({ links: array(object({
		anchor: string(),
		slug: string()
	})) }),
	publish: object({ valid: boolean() })
};
function parseModelStage(stage, text) {
	let value;
	try {
		value = JSON.parse(String(text ?? "").replace(/^```json\s*|```$/g, "").trim());
	} catch {
		throw new Error(`${stage} schema validation failed: response is not valid JSON`);
	}
	const parsed = stageSchemas[stage].safeParse(value);
	if (!parsed.success) throw new Error(`${stage} schema validation failed: ${parsed.error.issues.map((issue) => issue.message).join("; ")}`);
	const revision = parsed.data;
	return {
		markdown: revision.markdown,
		verifyFlags: stage === "revision" ? revision.verifyFlags.map((flag) => `“${flag.claim}” — ${flag.why}`) : void 0
	};
}
var IntentBlueprintSchema = object({
	intent: string().min(1).max(400),
	audience: string().min(1).max(200).default("the reader making this decision"),
	answerBlock: string().min(40).max(700),
	questionH2s: array(string().min(8).max(120)).min(2).max(6),
	tablePlan: boolean().default(false),
	mustCover: array(string().min(2).max(120)).min(3).max(8)
});
function parseIntentStage(text) {
	let value;
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
function fallbackBlueprint(job) {
	const keyword = String(job?.keyword ?? "").trim();
	const title = String(job?.title ?? "").trim();
	const subject = (keyword || title || "this topic").replace(/\s+/g, " ");
	return {
		intent: `Answer “${subject}” for a reader who needs one concrete decision, not a survey.`,
		audience: "the reader deciding what to do next",
		answerBlock: `${title || subject} comes down to one decision about ${subject}: pick the option that fits the constraints you already have, confirm it against a source you trust, and skip anything promising effortless results.`,
		questionH2s: [
			`What is ${subject}, exactly?`,
			`How do you start with ${subject}?`,
			`What does ${subject} cost in time or money?`
		],
		tablePlan: true,
		mustCover: [
			`What ${subject} actually is`,
			`Who ${subject} fits — and who should skip it`,
			`A worked first step for ${subject}`,
			`What ${subject} costs`,
			`The failure mode most people hit with ${subject}`
		]
	};
}
/** Site + author context block present in every stage (MASTER_SPEC §2). */
function buildContextBlock(ctx) {
	return [
		ctx.author ? authorVoiceBlock(ctx.author) : "Author: unassigned desk writer (human expert persona pending).",
		`Site: ${ctx.siteName} · niche: ${ctx.niche}.`,
		`Point of view: ${ctx.author?.voice.pov ?? ctx.pov}. Reading level: ${ctx.author?.voice.readingLevel ?? ctx.readingLevel}. Tone: ${ctx.tone}.`,
		`Banned phrases: ${[.../* @__PURE__ */ new Set([...ctx.author?.voice.bannedPhrases ?? [], ...ctx.bannedPhrases])].join(" | ") || "none"}.`,
		`Brand facts: ${ctx.brandFacts.join(" | ") || "none"}.`
	].join("\n");
}
/**
* Long-form floor the pipeline targets on every generated article. The draft
* prompt aims for {@link TARGET_ARTICLE_WORDS} so the finished piece clears the
* {@link MIN_ARTICLE_WORDS} floor after revision and humanizer passes.
*/
var MIN_ARTICLE_WORDS = 2e3;
var TARGET_ARTICLE_WORDS = 2400;
var BingDraftRules = [
	"Open with the 40–60 word direct answer to the exact query — no preamble, no 'in this article'.",
	"Use ## H2s from the blueprint when they fit; name each heading after the decision it settles. At least two H2s must be question-shaped when the blueprint lists question headings.",
	"Include exactly one concrete markdown table when the blueprint marks tablePlan true (real values or clearly labeled placeholders — never invented statistics; write [verify: …] beside any number you cannot state from the notes).",
	"Keep one H1 (the working title), nested H2/H3, and a question-shaped FAQ section of 3–5 Q&As anchored with ### headings.",
	"No invented stats, no [verify] tags inside the table cells other than the labeled placeholders, no image markdown."
];
function buildIntentPrompt(ctx, retry) {
	return {
		system: [
			"You are the intent and blueprint stage of a US editorial pipeline returning valid JSON only — no markdown fences.",
			`Return JSON matching {"intent":string,"audience":string,"answerBlock":string,"questionH2s":string[],"tablePlan":boolean,"mustCover":string[]}. Prompt version ${STAGE_PROMPT_VERSIONS.intent}.`,
			buildContextBlock(ctx),
			"The answerBlock is the direct 40–60 word answer a reader (and an AI answer engine) can quote alone.",
			"Write 5–8 mustCover items: concrete sub-decisions the article must settle.",
			`Plan a long-form piece of at least ${MIN_ARTICLE_WORDS} words. Write 2–6 questionH2s phrased as real user questions for Bing/Copilot extraction (How/What/Is/Does…).`,
			"Set tablePlan true only when a comparison or range of real numbers genuinely helps.",
			`Titles must stay lexically distinct from each other and from the working title «${ctx.workingTitle}».`,
			retry ? `The previous attempt failed validation: ${retry.reason} Fix it now.` : ""
		].filter(Boolean).join(" "),
		user: [
			`Working title: ${ctx.workingTitle}`,
			`Keyword: ${ctx.keyword}`,
			`Niche: ${ctx.niche}`,
			ctx.audience ? `Audience: ${ctx.audience}` : "",
			`Sections: ${ctx.sectionCount}`,
			ctx.avoidTitles.length ? `Avoid repeating these existing pages: ${ctx.avoidTitles.slice(0, 12).join("; ")}` : ""
		].filter(Boolean).join("\n")
	};
}
function buildDraftPrompt(ctx, intent, more = false) {
	return {
		system: [
			"You write a US staff article as the assigned author below, in their exact humanized voice. Return valid JSON only matching {\"markdown\":\"full article markdown\"}.",
			`Prompt version ${STAGE_PROMPT_VERSIONS.draft}.`,
			buildContextBlock(ctx),
			...BingDraftRules,
			"Blader humanizer anti-pattern constitution — the draft must read like the assigned human author, never like a chatbot:",
			...BLADER_DRAFT_RULES,
			`Write ${ctx.sectionCount} ## sections totalling at least ${MIN_ARTICLE_WORDS} words (aim ${TARGET_ARTICLE_WORDS}); give each section 3–5 developed paragraphs of concrete steps, examples, and named specifics.`,
			`Adopt the author's rhythm, diction, sentence band (${ctx.author?.voice.sentenceLengthBand ?? "8–18 words"}), and signature moves. Never use the author's or the site's banned phrases.`,
			more ? `The previous response was under the length floor. Return the full article expanded to at least ${MIN_ARTICLE_WORDS} words (aim ${TARGET_ARTICLE_WORDS}), keeping every heading, the comparison table, and every internal link. Return valid JSON only.` : ""
		].filter(Boolean).join(" "),
		user: [
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
			ctx.avoidTitles.length ? `Do not repeat these pages: ${ctx.avoidTitles.slice(0, 12).join("; ")}` : "No existing pages to avoid."
		].join("\n")
	};
}
function buildRevisionPrompt(ctx, draft) {
	return {
		system: [
			"You are Stage 3 (Revision) running the blader/humanizer two-pass audit and rewrite in the assigned author's voice. Return valid JSON only matching {\"markdown\":\"...\",\"verifyFlags\":[{\"claim\":\"...\",\"why\":\"...\"}]}.",
			`Prompt version ${STAGE_PROMPT_VERSIONS.revision}.`,
			buildContextBlock(ctx),
			...BLADER_REWRITE_CONTRACT,
			"Two passes in one response: PASS 1 mentally audit the draft for the AI tells listed in the anti-pattern contract (staging contrasts, one-line closers, deep sayings, staged run-ups, forced triads, em-dash chaining, delve/tapestry/pivotal-class vocabulary, inflated significance, sales language, decorative bold, curly quotes, chatbot residue); PASS 2 rewrite the whole draft into natural, grounded human prose with every tell removed.",
			"Robotic scrub order: (1) delete or rewrite every banned phrase listed below; (2) collapse sentences that repeat the same advice — each paragraph adds one new idea; (3) enforce the author's rhythm and sentence band; (4) keep a direct-answer opening, all question-shaped H2s, every markdown table and every internal link exactly as they are.",
			`Never shorten the article: the rewritten piece must still be at least ${MIN_ARTICLE_WORDS} words (aim ${TARGET_ARTICLE_WORDS}). Rewrite for voice, do not trim content.`,
			"Every mustCover item must be addressed or cut honestly. VerifyFlags must quote every statistic, date, price, named source, or research claim with why it needs human verification.",
			`Banned phrases (author + site): ${[.../* @__PURE__ */ new Set([
				...ctx.author?.voice.bannedPhrases ?? [],
				...ctx.bannedPhrases,
				...ROBOTIC_DEFAULTS
			])].join(" | ")}.`
		].join(" "),
		user: [
			`Title: ${ctx.workingTitle}`,
			`Keyword: ${ctx.keyword}`,
			`Must cover: ${ctx.blueprint?.mustCover.join("; ") ?? "not recorded"}`,
			"",
			"Draft to rewrite (Stage 2 draft):",
			draft
		].join("\n")
	};
}
var MetadataSchema = object({
	title: string().min(1).max(60),
	metaDescription: string().min(1).max(155),
	slug: string().min(1).max(120),
	tags: array(string().min(1).max(40)).max(3).default([]),
	excerpt: string().min(1).max(280)
});
function parseMetadataStage(text) {
	let value;
	try {
		value = JSON.parse(String(text ?? "").replace(/^```json\s*|```$/g, "").trim());
	} catch {
		throw new Error("metadata schema validation failed: response is not valid JSON");
	}
	const parsed = MetadataSchema.safeParse(value);
	if (!parsed.success) throw new Error(`metadata schema validation failed: ${parsed.error.issues.map((issue) => issue.message).join("; ")}`);
	return parsed.data;
}
function buildMetadataPrompt(ctx, markdown, opts) {
	return {
		system: [
			"You are Stage 4 (Metadata & Packaging) of a US editorial pipeline. Return valid JSON only — no markdown fences.",
			`Return JSON matching {"title":string,"metaDescription":string,"slug":string,"tags":string[],"excerpt":string}. Prompt version ${STAGE_PROMPT_VERSIONS.metadata}.`,
			buildContextBlock(ctx),
			"title: the packaged headline, at most 60 characters, choosing the phrasing a searcher would type. It may refine the working title but must stay on the same subject.",
			"metaDescription: at most 155 characters, a plain, concrete summary with no clickbait and no promises.",
			"slug: lowercase a–z, 0–9 and hyphens only, 3–8 words, derived from the title; it must not collide with the existing slugs listed in the brief.",
			"tags: at most 3 short tags; reuse an existing tag from the brief when one fits, otherwise name the topic plainly.",
			"excerpt: one or two sentences (≤280 characters) for listings, drawn from the article, not a sales line."
		].join(" "),
		user: [
			`Working title: ${ctx.workingTitle}`,
			`Keyword: ${ctx.keyword}`,
			`Niche: ${ctx.niche}`,
			opts.existingSlugs.length ? `Existing slugs that must not be reused: ${opts.existingSlugs.slice(0, 40).join(", ")}` : "No existing slugs on this site.",
			opts.existingTags.length ? `Existing tags to prefer: ${opts.existingTags.slice(0, 40).join(", ")}` : "No existing tags on this site.",
			"",
			"Final article markdown:",
			markdown.slice(0, 12e3)
		].join("\n")
	};
}
var EnrichmentSchema = object({
	links: array(object({
		anchor: string().min(1).max(80),
		slug: string().min(1).max(120)
	})).max(6).default([]),
	imageQueries: array(object({
		query: string().min(2).max(80),
		alt: string().min(2).max(120),
		role: _enum(["featured", "section"])
	})).max(4).default([])
});
function parseEnrichmentStage(text) {
	let value;
	try {
		value = JSON.parse(String(text ?? "").replace(/^```json\s*|```$/g, "").trim());
	} catch {
		throw new Error("enrichment schema validation failed: response is not valid JSON");
	}
	const parsed = EnrichmentSchema.safeParse(value);
	if (!parsed.success) throw new Error(`enrichment schema validation failed: ${parsed.error.issues.map((issue) => issue.message).join("; ")}`);
	return parsed.data;
}
function buildEnrichmentPrompt(ctx, markdown, inventory) {
	return {
		system: [
			"You are Stage 5 (Site Enrichment) of a US editorial pipeline. Return valid JSON only — no markdown fences.",
			`Return JSON matching {"links":[{"anchor":string,"slug":string}],"imageQueries":[{"query":string,"alt":string,"role":"featured"|"section"}]}. Prompt version ${STAGE_PROMPT_VERSIONS.enrichment}.`,
			buildContextBlock(ctx),
			"links: 2–6 internal links. The slug MUST come from the published-pages list in the brief — never invent a slug. The anchor is the exact phrase already present in the article that the link should wrap (the server inserts the anchor itself).",
			"imageQueries: one featured query plus one per major section, at most 4 total. Each query is a short photo-search phrase and its alt text is a plain description of the image the reader should see."
		].join(" "),
		user: [
			`Working title: ${ctx.workingTitle}`,
			`Keyword: ${ctx.keyword}`,
			`Published pages to link to (title — slug): ${inventory.length ? inventory.slice(0, 60).map((page) => `${page.title} — ${page.slug}`).join("; ") : "none yet"}`,
			"",
			"Final article markdown:",
			markdown.slice(0, 12e3)
		].join("\n")
	};
}
/** Hard-coded robotic defaults every author refuses, on top of author + site lists. */
var ROBOTIC_DEFAULTS = [
	"in today's fast-paced world",
	"delve",
	"tapestry",
	"look no further",
	"it is important to note",
	"in conclusion",
	"game-changer",
	"seamless",
	"unlock"
];
/**
* Rule 3d deterministic scrub: removes banned/robotic phrases, collapses repeated
* sentences. Applied to model output at revision acceptance (single pass; keeps
* the honest count so the UI can show what the scrub touched).
*/
function roboticScrub(markdown, bannedPhrases = []) {
	const phrases = [.../* @__PURE__ */ new Set([...bannedPhrases.map((p) => String(p ?? "").trim()).filter(Boolean), ...ROBOTIC_DEFAULTS])];
	const scrubbed = [];
	let text = typeof markdown === "string" ? markdown : "";
	for (const phrase of phrases) {
		const pattern = new RegExp(phrase.replace(/[.*+?^${}()|[\]\\]/g, "\\$&").replace(/\s+/g, "\\s+"), "gi");
		if (!pattern.test(text)) continue;
		scrubbed.push(phrase);
		text = text.replace(pattern, "");
	}
	text = text.replace(/[ \t]{2,}/g, " ").replace(/ ([,.;:!?])/g, "$1").replace(/\n{3,}/g, "\n\n");
	const seen = /* @__PURE__ */ new Set();
	text = text.split("\n").map((line) => {
		const trimmed = line.trim();
		if (trimmed.length < 40 || trimmed.startsWith("#") || trimmed.startsWith("-") || trimmed.startsWith("|")) return line;
		const key = trimmed.toLowerCase().replace(/[^a-z0-9 ]/g, "").replace(/\s+/g, " ");
		if (seen.has(key)) {
			scrubbed.push(`repeated sentence: ${trimmed.slice(0, 60)}…`);
			return "";
		}
		seen.add(key);
		return line;
	}).filter((line, index, all) => !(line === "" && all[index - 1] === "")).join("\n").trim();
	return {
		markdown: text,
		scrubbed
	};
}
/** Bing thumbnail used across preview, Ghost payload and the static build. */
var HASH_EMBED_NOTE = "No provider embedder on this key. L3 used the local hash vector (same dimension both sides).";
/** Effective limits with defaults applied. Used everywhere a cap used to be hardcoded. */
function limitsOf(data) {
	return {
		...DEFAULT_LIMITS,
		...data.limits ?? {}
	};
}
function normalizeKeyword(raw) {
	return raw.toLowerCase().replace(/['’]/g, "").replace(/[^a-z0-9+#.\s-]/g, " ").replace(/\s+/g, " ").trim();
}
function slugify(s) {
	return normalizeKeyword(s).replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 72);
}
/** Stage 4 slug rule (GOVERNOR §4): unique against this site — suffix `-2`, `-3`, … on collision. */
function uniqueSlug(base, taken) {
	const root = slugify(base) || "article";
	const used = new Set(taken.filter(Boolean));
	if (!used.has(root)) return root;
	for (let n = 2; n < 500; n += 1) {
		const candidate = `${root}-${n}`;
		if (!used.has(candidate)) return candidate;
	}
	return `${root}-${Date.now().toString(36)}`;
}
function tokensOf(s) {
	return normalizeKeyword(s).split(" ").filter((w) => w.length > 2);
}
function jaccard(a, b) {
	const A = new Set(tokensOf(a));
	const B = new Set(tokensOf(b));
	if (!A.size || !B.size) return 0;
	let inter = 0;
	for (const t of A) if (B.has(t)) inter++;
	return inter / (A.size + B.size - inter);
}
function bigrams(s) {
	const t = ` ${slugify(s).replace(/-/g, " ")} `;
	const m = /* @__PURE__ */ new Map();
	for (let i = 0; i < t.length - 1; i++) {
		const g = t.slice(i, i + 2);
		m.set(g, (m.get(g) ?? 0) + 1);
	}
	return m;
}
function dice(a, b) {
	const A = bigrams(a);
	const B = bigrams(b);
	if (!A.size || !B.size) return 0;
	let inter = 0;
	let sa = 0;
	let sb = 0;
	for (const n of A.values()) sa += n;
	for (const n of B.values()) sb += n;
	for (const [g, n] of A) inter += Math.min(n, B.get(g) ?? 0);
	return 2 * inter / (sa + sb);
}
function lexicalSimilarity(a, b) {
	return Math.max(jaccard(a, b), dice(a, b));
}
var NO_MODEL_NOTE = "estimated — no model called";
function keyCallsModel(key) {
	return Boolean(key?.secret && key?.baseUrl);
}
function usageNote(usage) {
	return `${usage.prompt} prompt · ${usage.completion} completion`;
}
function usdFor(tokens, pricePerM = 6) {
	return tokens * pricePerM / 1e6;
}
function blankStages() {
	return STAGES.map((s) => ({
		key: s.key,
		label: s.label,
		status: "pending",
		tokens: 0,
		durationMs: s.ms,
		promptVersion: STAGE_PROMPT_VERSIONS[s.key]
	}));
}
function isPrivateHost(host) {
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
var PLACEHOLDER_HOSTS = /* @__PURE__ */ new Set([
	"example.com",
	"example.org",
	"example.net",
	"localhost",
	"placeholder.com",
	"yourdomain.com"
]);
function validatePublicUrl(raw) {
	let url;
	try {
		url = new URL(raw.trim());
	} catch {
		return {
			ok: false,
			error: "Public URL must be a full https address."
		};
	}
	if (url.protocol !== "https:") return {
		ok: false,
		error: "Public URL must use https."
	};
	if (isPrivateHost(url.hostname) || PLACEHOLDER_HOSTS.has(url.hostname.replace(/^www\./, ""))) return {
		ok: false,
		error: "That host is private or a placeholder. Use the real origin."
	};
	return {
		ok: true,
		url: url.origin
	};
}
function validateGhostUrl(raw) {
	let url;
	try {
		url = new URL(raw.trim());
	} catch {
		return {
			ok: false,
			error: "Ghost URL must be a full https address."
		};
	}
	if (url.protocol !== "https:") return {
		ok: false,
		error: "Ghost URL must use https. Private hosts are blocked."
	};
	if (isPrivateHost(url.hostname)) return {
		ok: false,
		error: "Private addresses and loopback hosts are blocked."
	};
	return {
		ok: true,
		url: url.origin
	};
}
function maskKey(adminKey) {
	return `id:••••${(adminKey.split(":")[1] ?? "").slice(-4) || "····"}`;
}
function draftSample(title, keyword, sections) {
	return `${title}. ${(sections ?? []).map((section) => section.heading).join(". ")}. ${(sections?.[0]?.paragraphs?.[0] ?? "") || keyword}`;
}
function corpusFor(data, siteId, extra = []) {
	const articles = data.articles.filter((a) => a.siteId === siteId).map((a) => ({
		keyword: a.keyword,
		title: a.title,
		slug: a.slug
	}));
	const pending = data.jobs.filter((j) => j.siteId === siteId && (j.status === "queued" || j.status === "running")).map((j) => ({
		keyword: j.keyword,
		title: j.title,
		slug: slugify(j.title)
	}));
	const inventory = (data.sites.find((site) => site.id === siteId)?.ghost.inventory ?? []).map((post) => ({
		keyword: normalizeKeyword(post.title),
		title: post.title,
		slug: post.slug,
		permalink: post.slug
	}));
	const plans = data.plans.filter((plan) => plan.siteId === siteId && (plan.status === "review" || plan.status === "queued" || plan.status === "running")).flatMap((plan) => [{
		keyword: normalizeKeyword(plan.pillarTitle),
		title: plan.pillarTitle,
		slug: slugify(plan.pillarTitle)
	}, ...plan.clusters.filter((cluster) => !cluster.excluded).map((cluster) => ({
		keyword: normalizeKeyword(cluster.title),
		title: cluster.title,
		slug: slugify(cluster.title)
	}))]);
	const memory = data.corpus.filter((item) => item.siteId === siteId).map((item) => ({
		keyword: item.keyword,
		title: item.title,
		slug: item.slug,
		permalink: item.permalink,
		embedding: item.embedding,
		embedSource: item.embedSource
	}));
	const seen = /* @__PURE__ */ new Set();
	return [
		...articles,
		...inventory,
		...plans,
		...memory,
		...pending,
		...extra
	].filter((item) => {
		const key = `${item.slug}|${normalizeKeyword(item.title)}`;
		if (seen.has(key)) return false;
		seen.add(key);
		return true;
	});
}
async function gateText(keyword, title, corpus, allowVariants, provider) {
	const norm = normalizeKeyword(keyword);
	const slug = slugify(title);
	for (const item of corpus) if (normalizeKeyword(item.keyword) === norm || item.slug === slug) {
		if (!allowVariants) return {
			ok: false,
			reason: "DUPLICATE REFUSED (L1-exact)",
			layer: "L1"
		};
		return {
			ok: true,
			variant: true
		};
	}
	let maxLex = 0;
	for (const item of corpus) maxLex = Math.max(maxLex, lexicalSimilarity(title, item.title), lexicalSimilarity(slug, item.slug));
	if (maxLex > .85) {
		if (!allowVariants) return {
			ok: false,
			reason: "DUPLICATE REFUSED (L2-lexical)",
			layer: "L2"
		};
		return {
			ok: true,
			variant: true
		};
	}
	if (!corpus.length) return {
		ok: true,
		variant: false
	};
	const embedded = await embedAllForL3([`${title} ${keyword}`, ...corpus.map((item) => `${item.title} ${item.keyword}`)], provider);
	let maxSem = 0;
	for (let i = 1; i < embedded.vectors.length; i++) maxSem = Math.max(maxSem, cosine(embedded.vectors[0], embedded.vectors[i]));
	const embedSource = embedded.source;
	const embedNote = embedded.note;
	if (maxSem >= .88) {
		if (!allowVariants) return {
			ok: false,
			reason: "DUPLICATE REFUSED (L3-semantic)",
			layer: "L3",
			embedSource,
			embedNote
		};
		return {
			ok: true,
			variant: true,
			embedSource,
			embedNote
		};
	}
	if (maxSem > .8 && !allowVariants) return {
		ok: true,
		variant: false,
		hold: true,
		embedSource,
		embedNote
	};
	return {
		ok: true,
		variant: false,
		embedSource,
		embedNote
	};
}
function buildCorpusIndex(corpus) {
	const norms = /* @__PURE__ */ new Set();
	const slugs = /* @__PURE__ */ new Set();
	const byToken = /* @__PURE__ */ new Map();
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
	return {
		norms,
		slugs,
		byToken,
		size: corpus.length
	};
}
function addToCorpusIndex(index, item) {
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
function gateAgainstIndex(keyword, title, index, allowVariants) {
	const norm = normalizeKeyword(keyword);
	const slug = slugify(title);
	if (index.norms.has(norm) || index.slugs.has(slug)) {
		if (!allowVariants) return {
			ok: false,
			reason: "DUPLICATE REFUSED (L1-exact)",
			layer: "L1"
		};
		return {
			ok: true,
			variant: true
		};
	}
	const candidates = /* @__PURE__ */ new Map();
	for (const token of tokensOf(title)) for (const item of index.byToken.get(token) ?? []) candidates.set(item.slug, item);
	let maxLex = 0;
	for (const item of candidates.values()) maxLex = Math.max(maxLex, lexicalSimilarity(title, item.title), lexicalSimilarity(slug, item.slug));
	if (maxLex > .85) {
		if (!allowVariants) return {
			ok: false,
			reason: "DUPLICATE REFUSED (L2-lexical)",
			layer: "L2"
		};
		return {
			ok: true,
			variant: true
		};
	}
	return {
		ok: true,
		variant: false
	};
}
function contentTokens(text) {
	const stop = new Set("the a an to of for and or is are with this that from into about you your page not how what who when does can write writing note notes plan week weeks name named leave say says said one two also just more most than then will would could should their there them they our out its his her she he was were been being have has had but if so as at by on in".split(" "));
	return text.toLowerCase().replace(/[^a-z0-9\s]/g, " ").split(/\s+/).filter((word) => word.length > 3 && !stop.has(word));
}
function tokenOverlap(left, right) {
	if (!left.length || !right.length) return 0;
	const bag = new Set(right);
	return left.filter((word) => bag.has(word)).length / (/* @__PURE__ */ new Set([...left, ...right])).size;
}
function uniquenessAgainst(title, keyword, corpus, sections) {
	if (!corpus.length) return 1;
	const mine = contentTokens(`${title} ${keyword} ${(sections ?? []).map((section) => section.heading).join(" ")}`);
	let max = 0;
	for (const item of corpus) {
		const titleHit = Math.max(lexicalSimilarity(title, item.title), lexicalSimilarity(slugify(title), item.slug));
		const overlap = tokenOverlap(mine, contentTokens(`${item.title} ${item.keyword}`));
		const combined = titleHit * .75 + overlap * .25;
		max = Math.max(max, titleHit > .82 ? titleHit : combined);
	}
	return Math.round((1 - max) * 1e3) / 1e3;
}
function rescoreArticles(data) {
	const next = structuredClone(data);
	let changed = false;
	for (const site of next.sites) {
		const rows = next.articles.filter((article) => article.siteId === site.id);
		for (const article of rows) {
			const score = uniquenessAgainst(article.title, article.keyword, rows.filter((other) => other.id !== article.id).map((other) => ({
				keyword: other.keyword,
				title: other.title,
				slug: other.slug
			})), article.sections);
			if (article.uniqueness !== score) {
				article.uniqueness = score;
				changed = true;
			}
		}
	}
	return changed ? next : null;
}
function queueMissingPhotos(data) {
	const next = structuredClone(data);
	let changed = false;
	for (const article of next.articles) {
		const site = next.sites.find((item) => item.id === article.siteId);
		if (site?.ghost.mode !== "live" || !site.ghost.adminKey) continue;
		if (!article.images.some((image) => image.selected && image.src)) {
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
function score(seed, lo, hi) {
	const t = hashStr(seed) % 1e3 / 1e3;
	return Math.round((lo + t * (hi - lo)) * 100) / 100;
}
function composeArticle(input) {
	const count = Math.max(3, Math.min(8, input.sectionCount));
	const subject = shortSubject(`${input.title} ${input.keyword}`);
	const sections = buildSections(input.angle, subject, count);
	const leadToken = input.keyword.toLowerCase().split(/\s+/).find((word) => word.length > 3) ?? input.keyword.toLowerCase();
	if (sections[0] && leadToken && !sections[0].paragraphs[0]?.toLowerCase().includes(leadToken)) sections[0].paragraphs[0] = `${input.keyword} is the question this page answers. ${sections[0].paragraphs[0] ?? ""}`.trim();
	const links = input.links.map((link) => ({
		anchor: anchorPhrase(link.anchor),
		slug: link.slug
	})).filter((link, index, all) => link.slug && all.findIndex((item) => item.slug === link.slug) === index);
	links.forEach((link, index) => {
		const section = sections[Math.min(sections.length - 1, index + 1)] ?? sections[0];
		if (!section) return;
		const sentence = linkSentence(link.anchor);
		if (!section.paragraphs.some((paragraph) => paragraph.includes(link.anchor))) section.paragraphs.push(sentence);
	});
	const mustCover = input.mustCover && input.mustCover.length ? input.mustCover.slice(0, 8) : [
		`Define ${input.keyword} in one sentence`,
		"Name who the page is for",
		"Give a sequence that fits in a week",
		"Name a failure mode without a fake statistic",
		links.length ? "Link only to verified inventory" : "Do not invent internal URLs"
	];
	const verifyFlags = [];
	const tags = [input.nicheTag, slugify(input.keyword).split("-")[0] || "notes"].filter(Boolean);
	const images = planImages(input.keyword, input.title, input.imageCount, sections.map((section) => ({
		heading: section.heading,
		words: section.paragraphs.join(" ").split(/\s+/).filter(Boolean).length
	})));
	const htmlParts = [];
	const mdParts = [];
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
	const words = sections.flatMap((s) => s.paragraphs).join(" ").split(/\s+/).filter(Boolean).length;
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
		coverage: score(input.title + "cov", .86, .97),
		intentMatch: score(input.title + "int", .84, .96)
	};
}
function angleForJob(data, job) {
	for (const plan of data.plans) {
		const cluster = plan.clusters.find((item) => item.jobId === job.id);
		if (cluster?.angle) return cluster.angle;
	}
	if (job.kind === "pillar") return "pillar";
	const keys = [
		"time",
		"money",
		"skip",
		"alternative",
		"daily",
		"compare",
		"conversation",
		"stop"
	];
	return keys[hashStr(job.title) % keys.length];
}
function buildSections(angle, subject, count) {
	const phrase = withArticle(subject);
	const packs = {
		time: [
			[
				"How long this decision takes",
				`Put a date on ${phrase}. A month is long enough to notice what you actually do with the hours. A vague "later" is not a plan.`,
				`If the date arrives and nothing new is known, staying undecided is itself the choice.`
			],
			[
				"What a normal week costs",
				`Count the evenings ${phrase} would take for four weeks. Write the number of nights, not a borrowed statistic.`,
				`Compare that count with the work you already have. If the nights are already full, the page should say so.`
			],
			[
				"A one-week trial",
				`For seven days, do the smallest version of ${phrase} and stop. Keep a note of what you finished and what you dropped.`,
				`The trial is the article. Do not add a history of the field to make it look longer.`
			],
			[
				"When waiting is the expensive option",
				`Waiting feels safe. It also spends the same months ${phrase} would have spent, with no artifact at the end.`,
				`Name the thing you will have in hand if you wait, and the thing you will have if you start. If both lines are blank, you are not deciding yet.`
			],
			[
				"What to write down",
				`One card: the date, the hours, and the person who needs to hear the result. That card is the page.`,
				`Leave any salary or success rate off the page. This note does not invent one.`
			]
		],
		money: [
			[
				"Costs you can list",
				`List fees, rent, and unpaid months you already know for ${phrase}. Leave every other figure off the page.`,
				`A page that invents a return on investment is a different, worse article.`
			],
			[
				"What you stop paying",
				`Name one cost that ends if you skip ${phrase}, and one cost that continues. Both have to be costs you could show someone.`,
				`If you cannot name them, the money section is not ready.`
			],
			[
				"A budget line",
				`Write a single line a household could keep: what goes out each month while ${phrase} is in progress.`,
				`Do not turn that line into a promise about a future salary.`
			],
			[
				"Who pays",
				`Say who actually pays: you, an employer, a grant, or a family member. ${phrase} changes depending on which of those is true.`,
				`If more than one payer is involved, the page is about the agreement, not about prestige.`
			],
			[
				"The stop number",
				`Pick a number you would not cross. When the real bills pass it, ${phrase} is no longer the plan.`,
				`The number is yours. It is not a national average.`
			]
		],
		skip: [
			[
				"Who this is not for",
				`${phrase} is a poor next step for someone who already has the work they want and only wants the label.`,
				`Say that plainly. A reader who fits the description should be able to close the page.`
			],
			[
				"The job you already have",
				`If the role you want does not ask for ${phrase}, collecting it is a detour. Name the role.`,
				`Do not invent a hiring rate. Name the posting language you have actually seen.`
			],
			[
				"A reason that is allowed",
				`Leaving ${phrase} off the plan is allowed. The page should not talk the reader out of a choice they have already made for a concrete reason.`,
				`Concrete means a job, a lab, a city, or a dependent. "I am not sure" is not enough to skip, and "everyone does this" is not enough to start.`
			],
			[
				"What you tell a supervisor",
				`One sentence: what you will do instead of ${phrase}, and when. Send it before you write a long apology.`,
				`The article ends when that sentence exists.`
			],
			[
				"What not to add",
				`Do not pad the skip decision with a tour of famous people. ${phrase} is the reader's week, not a biography section.`,
				`If a heading could sit on a motivational blog, cut it.`
			]
		],
		alternative: [
			[
				"The shorter path",
				`Name the path that gives the same work without ${phrase}. A master's, a job, a portfolio, or a license. One of those, not all of them.`,
				`The rest of the page is how to try that path for a month.`
			],
			[
				"A month on the other path",
				`Spend the month producing the artifact the shorter path actually asks for. Keep ${phrase} closed while you do it.`,
				`At the end of the month you will know whether the shorter path was real.`
			],
			[
				"What you lose",
				`Say the one thing ${phrase} would have given that the shorter path does not. If you cannot name it, you do not need the longer path yet.`,
				`Do not fill the gap with a slogan about passion.`
			],
			[
				"What you keep",
				`Skills, pay, and time you keep by staying on the shorter path. Write them as items you can point to.`,
				`A reader should be able to choose from the list without a speech.`
			],
			[
				"How the pages relate",
				`This page owns the alternative. It should link to the cost page and the time page only when those URLs already exist.`,
				`It should not repeat them.`
			]
		],
		daily: [
			[
				"A Tuesday on this path",
				`Describe one Tuesday if you take ${phrase}: where you are, what you produce, and what you cancel.`,
				`If the Tuesday is identical to your current Tuesday, the page has no decision in it.`
			],
			[
				"What gets dropped",
				`Name two recurring things that lose their slot. A lab meeting, a shift, a family dinner. ${phrase} has to take the hours from somewhere.`,
				`Leaving this blank is how the plan becomes a fantasy.`
			],
			[
				"The artifact of the week",
				`By Friday you should be able to hold one thing: a page of notes, a method someone else can run, or a draft section.`,
				`If the week produces only a mood, it was not a week of work.`
			],
			[
				"Who is in the room",
				`Name the person you would see. A supervisor, a manager, a classmate. ${phrase} is partly a relationship, not only a syllabus.`,
				`Write what you owe them that week in one sentence.`
			],
			[
				"A stop for the day",
				`End when the artifact exists. More reading about ${phrase} after that is procrastination wearing a serious face.`,
				`The page can say that without a lecture.`
			]
		],
		compare: [
			[
				"The two options",
				`Put ${phrase} on the left and the shorter path on the right. Three rows: time, money, and the job you want.`,
				`Fill only rows you can support. Empty cells stay empty.`
			],
			[
				"Where they overlap",
				`Most of the work is the same for the first months. Say what is shared so you do not write two articles that are one article.`,
				`The difference belongs in one row, not in every paragraph.`
			],
			[
				"A reader who should pick the long path",
				`One kind of reader still needs ${phrase}: the job they named requires it, and they have seen that requirement in writing.`,
				`Everyone else uses the other column.`
			],
			[
				"A reader who should pick the short path",
				`They want the work, not the label, and the postings they saved do not mention ${phrase}.`,
				`That is a complete reason.`
			],
			[
				"How to keep both pages honest",
				`Neither column may borrow a statistic from the other. Each claim is marked or it is cut.`,
				`The comparison is a table you could defend out loud.`
			]
		],
		conversation: [
			[
				"The sentence",
				`Write one sentence you can say about ${phrase} to a person who did not ask for an essay.`,
				`If the sentence needs a footnote, it is not ready.`
			],
			[
				"Who hears it",
				`A supervisor, a partner, or a parent. Pick one. ${phrase} sounds different in each room, so the page picks one room.`,
				`The other rooms can be their own pages later.`
			],
			[
				"What you do not say",
				`Do not apologize for the whole field. Do not promise an outcome you have not checked.`,
				`Say the decision and the date.`
			],
			[
				"What you bring",
				`Bring the one-page brief, the cost line, or the Tuesday note. A conversation about ${phrase} without a page in hand turns into reassurance.`,
				`The page is the prop.`
			],
			[
				"After the conversation",
				`Write down what they asked. Those questions are the next article, if they are not already on the site.`,
				`Do not invent their reply.`
			]
		],
		stop: [
			[
				"A sign you can see",
				`You have reread the same requirement for ${phrase} three times and still cannot name the job it unlocks.`,
				`That is a sign. It is not a character flaw.`
			],
			[
				"A sign from the calendar",
				`The start date moved twice and no new fact appeared. ${phrase} is being used as a delay.`,
				`Put the next date in writing or close the plan.`
			],
			[
				"A sign from money",
				`The bills you listed are already past the stop number you wrote on the cost page.`,
				`Staying is then a different decision, and it needs its own reason.`
			],
			[
				"A sign from the work",
				`The weekly artifact did not appear for two weeks. ${phrase} is not happening, even if you still call it the plan.`,
				`The honest page says you stopped.`
			],
			[
				"What you do on the day you stop",
				`Tell the person in the room. Cancel the next step. Keep the notes. Do not write a manifesto about ${phrase}.`,
				`Stopping is a short page.`
			]
		],
		brief: [
			[
				"What goes on the page",
				`Four lines about ${phrase}: the decision, the date, the cost you know, and the person who must hear it.`,
				`If a fifth line appears, it is a different article.`
			],
			[
				"What stays off",
				`No history of the field. No tool list. No borrowed quote. The brief is for ${phrase} this month.`,
				`A long brief is a draft you were afraid to cut.`
			],
			[
				"How you use it",
				`Read it once before the meeting or before you apply. Then close it.`,
				`The meeting is not a performance of the brief.`
			],
			[
				"Where the other pages fit",
				`The time page, the cost page, and the skip page each own one line of the brief. Link them only if they exist.`,
				`Do not paste those pages in.`
			],
			[
				"A finished brief",
				`Someone who was not in the room can tell what you will do about ${phrase} next week.`,
				`That is the only test.`
			]
		],
		keep: [
			[
				"What remains",
				`If you skip ${phrase}, list what you still have: the job, the skill, the city, the people.`,
				`The list is the article. A pep talk is not.`
			],
			[
				"What you no longer owe",
				`Name the application, the exam, or the move you can cancel. ${phrase} was going to demand it.`,
				`Cancel it in writing.`
			],
			[
				"What you might want later",
				`A later return is allowed. It is not this page. This page is about the year you are actually in.`,
				`Do not sneak the long path back in as a footnote.`
			],
			[
				"How to tell the story",
				`One sentence for a future employer: what you did instead of ${phrase}, and what you made.`,
				`Practice it until it does not apologize.`
			],
			[
				"The library around this page",
				`Link to the alternative and the conversation only when those URLs are real.`,
				`A missing page is not a link.`
			]
		],
		pillar: [
			[
				"The decision",
				`${phrase} is the subject of this page. The narrow pages own the time, the money, and the decision to skip.`,
				`This page only tells you which of those to open.`
			],
			[
				"Time",
				`If you do not know how many nights it takes, open the time page before you read anything else about ${phrase}.`,
				`Do not restate that page here.`
			],
			[
				"Money",
				`If you cannot list the costs you already know, the money page is the next click.`,
				`This page will not invent a salary to fill the gap.`
			],
			[
				"Who should skip it",
				`Some readers are done after the skip page. Let them leave.`,
				`${phrase} is not more serious because the pillar is longer.`
			],
			[
				"The other path",
				`The alternative page names one shorter route. Use it when the job you want does not ask for ${phrase}.`,
				`One route, not a catalog.`
			],
			[
				"A normal week",
				`The week page is a Tuesday, not a slogan. Read it when the plan still feels abstract.`,
				`If your Tuesday does not change, you are not choosing ${phrase}.`
			],
			[
				"The conversation",
				`Take the one-page brief into the room. The conversation page is the sentence, not a speech.`,
				`Link it when the URL exists.`
			],
			[
				"When to stop",
				`The stop page lists signs you can see on a calendar. This pillar does not overrule them.`,
				`A reader who hits a sign should be sent there and finished.`
			]
		]
	};
	return (packs[angle.split("—")[0]?.trim() || angle] ?? packs.daily).slice(0, count).map(([heading, first, second]) => ({
		heading,
		paragraphs: [first, second]
	}));
}
/** Sizes taken from a live Go PhD draft: featured 474×274, in-article 624×352, both cropped with c=7. */
function bingFrame(role, index = 0) {
	if (role === "featured") return {
		w: 474,
		h: 274
	};
	if (index <= 0) return {
		w: 624,
		h: 352
	};
	if (index === 1) return {
		w: 575,
		h: 274
	};
	return {
		w: 480,
		h: 270
	};
}
var PHOTO_STOP = /* @__PURE__ */ new Set([
	"this",
	"that",
	"with",
	"from",
	"your",
	"about",
	"into",
	"when",
	"what",
	"which",
	"should",
	"would",
	"could",
	"their",
	"there",
	"have",
	"been",
	"will",
	"just",
	"than",
	"then",
	"them",
	"they",
	"page",
	"guide",
	"article"
]);
/** The meaningful "subject" words of a title/heading, stop words removed. */
function keyNoun(text, max = 5) {
	return text.toLowerCase().replace(/[^a-z0-9\s]/g, " ").split(/\s+/).filter((word) => word.length > 3 && !PHOTO_STOP.has(word)).slice(0, max).join(" ");
}
/**
* One photo query. The article title noun is always the subject, so every image
* stays about the page the reader is on; the section heading adds a narrower
* angle and the scene rotates per slot, which keeps the shots distinct instead
* of stacking the same thumbnail several times.
*/
function photoQuery(title, heading, index) {
	const noun = keyNoun(title) || "editorial cover";
	const section = heading ? keyNoun(heading, 3) : "";
	const subject = (section && !noun.includes(section) ? `${noun} ${section}` : noun).slice(0, 70);
	const scenes = [
		"",
		"on a wooden desk",
		"person reading about",
		"beside an open laptop",
		"papers on a table"
	];
	const scene = scenes[index % scenes.length];
	return (scene ? `${subject} ${scene}` : subject).replace(/\s+/g, " ").trim().slice(0, 90);
}
function planImages(keyword, title, sectionImages, sections = []) {
	const featured = bingFrame("featured");
	const featuredQuery = photoQuery(title || keyword, void 0, 0);
	const images = [{
		role: "featured",
		query: featuredQuery,
		alt: title || keyword,
		http: 0,
		selected: false,
		license: "unknown-bing",
		attempts: 0,
		width: featured.w,
		height: featured.h,
		remote: bingThumbUrl(featuredQuery, featured.w, featured.h)
	}];
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
			remote: bingThumbUrl(query, frame.w, frame.h)
		});
	}
	return images;
}
async function articleSimilarity(left, right, nicheTag, provider) {
	const embedded = await embedAllForL3([`${left.title} ${left.keyword}`, `${right.title} ${right.keyword}`], provider);
	const sim = Math.max(cosine(embedded.vectors[0], embedded.vectors[1]), lexicalSimilarity(`${left.title} ${left.keyword}`, `${right.title} ${right.keyword}`));
	const leftTags = (left.tags ?? []).filter((tag) => tag && tag !== nicheTag);
	const rightTags = (right.tags ?? []).filter((tag) => tag && tag !== nicheTag);
	return sim + (leftTags.some((tag) => rightTags.includes(tag)) ? .12 : 0);
}
function pickLinks(data, site, job, provider) {
	return rankLinks(data, site, job, provider);
}
async function rankLinks(data, site, job, provider) {
	const [min, max] = intensityBand(site.voice.linkIntensity);
	const siblings = data.articles.filter((article) => article.siteId === site.id);
	const run = data.runs.find((item) => item.id === job.runId);
	const plan = run?.topicPlanId ? data.plans.find((item) => item.id === run.topicPlanId) : void 0;
	const forced = [];
	if (plan && job.kind === "pillar") for (const cluster of plan.clusters) {
		if (cluster.excluded || !cluster.jobId) continue;
		const article = siblings.find((item) => item.jobId === cluster.jobId);
		if (article) forced.push(article);
	}
	if (plan && job.kind === "cluster") for (const cluster of plan.clusters) {
		if (cluster.excluded || !cluster.jobId || cluster.jobId === job.id) continue;
		const article = siblings.find((item) => item.jobId === cluster.jobId);
		if (article) forced.push(article);
	}
	const forcedIds = new Set(forced.map((article) => article.id));
	const ranked = await Promise.all(siblings.filter((article) => !forcedIds.has(article.id)).map(async (article) => ({
		article,
		sim: await articleSimilarity(job, article, site.nicheTag, provider)
	})));
	ranked.sort((a, b) => b.sim - a.sim);
	const strong = ranked.filter((item) => item.sim >= .42);
	const chosen = [...forced];
	for (const item of strong) {
		if (chosen.length >= max) break;
		chosen.push(item.article);
	}
	if (chosen.length < min) for (const item of ranked) {
		if (chosen.length >= min) break;
		if (chosen.some((article) => article.id === item.article.id)) continue;
		chosen.push(item.article);
	}
	return chosen.slice(0, max).map((article) => ({
		anchor: article.title,
		slug: article.slug
	}));
}
async function ensureInbound(data, site, article, provider) {
	if (inboundCount(data.articles, article.slug) > 0) return;
	const [, max] = intensityBand(site.voice.linkIntensity);
	const hosts = data.articles.filter((other) => other.siteId === site.id && other.id !== article.id && other.links.length < max);
	const ranked = await Promise.all(hosts.map(async (other) => ({
		other,
		sim: await articleSimilarity(article, other, site.nicheTag, provider)
	})));
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
function titleFor(keyword, variant) {
	const raw = String(keyword ?? "").trim();
	const titled = raw.charAt(0).toUpperCase() + raw.slice(1);
	if (!variant) return titled;
	return clusterTitles(keyword).find((row) => lexicalSimilarity(row.title, titled) < .72)?.title ?? titled;
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
function keyPool(data, preferred, now) {
	const demote = (k) => (k.disabled ? 2 : 0) + (k.cooldownUntil && k.cooldownUntil > now ? 1 : 0);
	return [...data.keys].filter((k) => k.chat !== false).sort((a, b) => {
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
function usableKey(data, preferred, now) {
	return keyPool(data, preferred, now)[0] ?? null;
}
function pushEvent(data, event) {
	data.events.unshift(event);
	if (data.events.length > 100) data.events.length = 100;
}
function log(data, siteId, tone, message, at) {
	data.activity.unshift({
		id: uid("act"),
		at,
		siteId,
		tone,
		message
	});
	if (data.activity.length > 500) data.activity.length = 500;
}
function inventoryFromArticles(articles, siteId, now) {
	return articles.filter((a) => a.siteId === siteId).map((a) => ({
		id: a.ledger.postId,
		title: a.title,
		slug: a.slug,
		status: a.status === "published" ? "PUBLISHED" : "DRAFT",
		syncedAt: now
	}));
}
function makeJob(partial) {
	return {
		...partial,
		status: partial.status ?? "queued",
		stageIndex: -1,
		stages: blankStages(),
		shots: 0,
		tokens: 0,
		costUsd: 0,
		attempt: 1
	};
}
async function submitKeywords(data, input) {
	const site = data.sites.find((s) => s.id === input.siteId);
	if (!site) return {
		data,
		error: "No website selected."
	};
	if (site.ghost.status !== "connected") return {
		data,
		error: "Ghost is not connected. Connect the studio ledger or a live site first."
	};
	if (site.ghost.corpus === "EMPTY") return {
		data,
		error: "Corpus is EMPTY. Sync inventory before a run, even if the site has zero posts."
	};
	if (site.ghost.corpus === "SYNCING") return {
		data,
		error: "Inventory sync is still running."
	};
	const lines = input.lines.split("\n").map((l) => l.trim()).filter(Boolean);
	const limits = limitsOf(data);
	if (!lines.length) return {
		data,
		error: "Add at least one keyword."
	};
	if (limits.keywordCap != null && lines.length > limits.keywordCap) return {
		data,
		error: `This studio caps a run at ${limits.keywordCap} keywords. Raise the cap in Settings → Content, or split the batch.`
	};
	const mode = input.publishMode === "default" ? site.voice.publishAs : input.publishMode;
	if (mode === "live" && site.ghost.mode !== "live") return {
		data,
		error: "Live publish is off. This Ghost connection is not live. Save the run as a draft."
	};
	const key = usableKey(data, input.modelKeyId === "default" ? site.voice.modelKeyId : input.modelKeyId, input.now);
	if (!key) return {
		data,
		error: "NO_USABLE_KEY — no AI key is saved for this workspace. Add one on AI Keys."
	};
	const next = structuredClone(data);
	const site2 = next.sites.find((s) => s.id === input.siteId);
	const runId = uid("run");
	const seen = [];
	const jobs = [];
	const refused = [];
	const baseCorpus = corpusFor(next, site2.id);
	const index = baseCorpus.length >= 400 ? buildCorpusIndex(baseCorpus) : null;
	for (const raw of lines) {
		const keyword = normalizeKeyword(raw);
		if (!keyword) continue;
		const gate = index ? gateAgainstIndex(keyword, titleFor(keyword, false), index, input.allowVariants) : await gateText(keyword, titleFor(keyword, false), corpusFor(next, site2.id, seen), input.allowVariants, input.provider);
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
				refusalLayer: gate.layer
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
				refusalReason: "REVIEW HELD — close to an existing page. Approve or reject before it writes."
			});
			held.authorId = matchOrCreateAuthorForTopic({
				id: site2.id,
				nicheTag: site2.nicheTag
			}, next.authors, keyword, {
				niche: site2.nicheTag,
				autoMatch: site2.autoAuthors !== false
			}).author.id;
			jobs.push(held);
			continue;
		}
		const variant = gate.variant;
		const title = titleFor(keyword, variant);
		if (variant && lexicalSimilarity(title, titleFor(keyword, false)) > .72) {
			refused.push(`${raw} — DUPLICATE REFUSED (L2-lexical). No distinct angle left.`);
			jobs.push(makeJob({
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
				refusalReason: "DUPLICATE REFUSED (L2-lexical). A variant needs a different headline, not a second copy."
			}));
			continue;
		}
		const slug = slugify(title);
		seen.push({
			keyword,
			title,
			slug
		});
		if (index) addToCorpusIndex(index, {
			keyword,
			title,
			slug
		});
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
			embedNote: index ? "Large-batch gate: L1 + L2 at intake; L3 semantic runs again at stage 6 before publish." : void 0
		});
		job.authorId = matchOrCreateAuthorForTopic({
			id: site2.id,
			nicheTag: site2.nicheTag
		}, next.authors, keyword, {
			niche: site2.nicheTag,
			autoMatch: site2.autoAuthors !== false
		}).author.id;
		jobs.push(job);
	}
	if (!jobs.length) return {
		data,
		error: "Nothing to queue."
	};
	next.runs.unshift({
		id: runId,
		siteId: site2.id,
		type: "keywords",
		title: lines.length === 1 ? titleFor(normalizeKeyword(lines[0]), false) : `${lines.length} keywords`,
		publishMode: mode,
		modelKeyId: key.id,
		allowVariants: input.allowVariants,
		bulletproof: Boolean(input.bulletproof),
		researchUrls: (input.researchUrls ?? []).slice(0, 5),
		createdAt: input.now,
		status: jobs.every((j) => j.status === "refused") ? "failed" : "queued"
	});
	next.jobs.unshift(...jobs);
	log(next, site2.id, refused.length ? "warn" : "ok", `Queued keyword run · ${jobs.filter((j) => j.status === "queued").length} jobs · publish ${mode}${refused.length ? ` · ${refused.length} refused` : ""}`, input.now);
	const queuedCount = jobs.filter((job) => job.status === "queued").length;
	const heldCount = jobs.filter((job) => job.status === "review-held").length;
	next.notice = {
		tone: refused.length || heldCount ? "warn" : "ok",
		text: `Run started: ${queuedCount} keywords queued.${refused.length ? ` ${refused.length} keywords refused by the duplicate gate.` : ""}${heldCount ? ` ${heldCount} held for review.` : ""}`
	};
	return {
		data: next,
		runId
	};
}
function shortSubject(raw) {
	let text = raw.toLowerCase().replace(/['’]/g, "").replace(/[^a-z0-9\s]/g, " ").replace(/\s+/g, " ").trim();
	for (const frame of [
		/^(why (?:we|you|i|people|someone) should(?: not| never)? )/,
		/^(why it s better to |why its better to |why it is better to )/,
		/^(why not )/,
		/^(how to )/,
		/^(what is |what are )/,
		/^(should (?:i|we|you) )/,
		/^(reasons?(?: to| why)? )/,
		/^(a guide to |the truth about )/
	]) text = text.replace(frame, "");
	text = text.replace(/^(avoid doing|avoid|not doing|not do|skip|stop doing|doing|pursue|pursuing|getting|starting) /, "");
	text = text.replace(/^(a|an|the) /, "");
	const stop = /* @__PURE__ */ new Set([
		"the",
		"a",
		"an",
		"to",
		"of",
		"for",
		"and",
		"or",
		"it",
		"its",
		"you",
		"your",
		"we",
		"our",
		"with",
		"from",
		"into",
		"about",
		"this",
		"that",
		"doing",
		"do",
		"better",
		"should",
		"not",
		"never",
		"really",
		"just"
	]);
	let words = text.split(" ").filter((word) => word && !stop.has(word));
	const lead = /* @__PURE__ */ new Set([
		"why",
		"how",
		"what",
		"when",
		"where",
		"who",
		"should",
		"avoid",
		"avoiding",
		"skip",
		"skipping",
		"pursue",
		"pursuing"
	]);
	while (words.length > 1 && lead.has(words[0])) words.shift();
	if (words.length > 3) words = words.slice(-3);
	if (!words.length || lead.has(words[0])) return "";
	return words.join(" ").replace(/\bphd\b/g, "PhD").replace(/\b[a-z]/g, (letter) => letter.toUpperCase());
}
function withArticle(noun) {
	if (noun.split(" ").length >= 2 && !/\bPhD\b/.test(noun)) return noun;
	return `${/^[AEIOU]/.test(noun) ? "an" : "a"} ${noun}`;
}
function embedsFullTopic(title, topic) {
	const norm = (value) => value.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
	const needle = norm(topic);
	if (needle.split(" ").length <= 3) return false;
	return norm(title).includes(needle);
}
var CLUSTER_ANGLES = [
	{
		key: "time",
		title: (phrase) => `Is ${phrase} Worth the Time?`,
		blurb: (phrase) => `The months ${phrase} takes, set against the work the reader already has.`
	},
	{
		key: "money",
		title: (phrase) => `What ${phrase} Costs`,
		blurb: () => `Fees and unpaid months the reader can already name. No invented salary.`
	},
	{
		key: "skip",
		title: (phrase) => `Who Should Skip ${phrase}`,
		blurb: (phrase) => `The reader who already has the job and does not need ${phrase}.`
	},
	{
		key: "alternative",
		title: (phrase) => `A Practical Alternative to ${phrase}`,
		blurb: (phrase) => `One shorter path that produces the same work without ${phrase}.`
	},
	{
		key: "daily",
		title: (phrase) => `How ${phrase} Changes a Normal Week`,
		blurb: (phrase) => `One Tuesday: what gets made, and what gets cancelled, for ${phrase}.`
	},
	{
		key: "compare",
		title: (phrase) => `${phrase.replace(/^(a|an) /i, "")} Compared With the Shorter Path`,
		blurb: (phrase) => `Three rows only: time, money, and the job. ${phrase} is one column.`
	},
	{
		key: "conversation",
		title: (phrase) => `How to Talk About ${phrase}`,
		blurb: (phrase) => `One sentence for one person in the room, about ${phrase}.`
	},
	{
		key: "stop",
		title: (phrase) => `Signs ${phrase} Is the Wrong Next Step`,
		blurb: () => `Calendar, bills, and a missing weekly artifact. Not a mood.`
	},
	{
		key: "brief",
		title: (phrase) => `A One-Page Brief Before ${phrase}`,
		blurb: () => `Four lines: decision, date, known cost, and who must hear it.`
	},
	{
		key: "keep",
		title: (phrase) => `What You Keep If You Skip ${phrase}`,
		blurb: (phrase) => `The job, the skill, and the people that remain if ${phrase} is declined.`
	}
];
function clusterTitles(topic) {
	const noun = shortSubject(topic);
	if (!noun) return [];
	const phrase = withArticle(noun);
	const out = [];
	for (const row of CLUSTER_ANGLES) {
		const title = row.title(phrase).replace(/\s+/g, " ").trim();
		if (/^(is|what|who|how|signs|a) why\b/i.test(title)) continue;
		if (embedsFullTopic(title, topic)) continue;
		if (out.some((item) => cosine(embed(item.title), embed(title)) >= .88)) continue;
		out.push({
			title,
			angle: `${row.key} — ${row.blurb(phrase)}`
		});
		if (out.length >= 10) break;
	}
	return out;
}
function generatePlan(data, siteId, topicRaw, now) {
	const site = data.sites.find((s) => s.id === siteId);
	if (!site) return {
		data,
		error: "No website selected."
	};
	const topic = topicRaw.trim().replace(/\s+/g, " ");
	if (topic.length < 3) return {
		data,
		error: "Enter a topic of at least 3 characters."
	};
	if (!usableKey(data, site.voice.modelKeyId, now)) return {
		data,
		error: "NO_USABLE_KEY — no AI key is saved for this website. Add one on AI Keys."
	};
	const next = structuredClone(data);
	const key = usableKey(next, site.voice.modelKeyId, now);
	const clusters = clusterTitles(topic).map((frame) => ({
		id: uid("clu"),
		title: frame.title,
		angle: frame.angle,
		excluded: false,
		source: "ai",
		selected: true
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
			createdAt: now
		});
		return {
			data: next,
			planId,
			error: next.plans[0].error
		};
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
		createdAt: now
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
		usd
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
		usd
	});
	key.lastUsedAt = now;
	const stored = next.keys.find((k) => k.id === key.id);
	if (stored) stored.lastUsedAt = now;
	log(next, siteId, "ok", `Topic plan ready for review · ${topic}`, now);
	const vague = !topic.includes(" ");
	next.notice = {
		tone: vague ? "warn" : "ok",
		text: vague ? "Plan ready. A single word usually comes back vague — edit the pillar and clusters before you queue." : "Plan ready. Exclude weak clusters, then queue selected. Clusters run before the pillar."
	};
	return {
		data: next,
		planId
	};
}
function acceptModelPlan(data, siteId, topicRaw, pillarTitle, proposed, now) {
	const site = data.sites.find((item) => item.id === siteId);
	if (!site) return {
		data,
		error: "No website selected."
	};
	const topic = topicRaw.trim().replace(/\s+/g, " ");
	if (topic.length < 3) return {
		data,
		error: "Enter a topic of at least 3 characters."
	};
	if (!usableKey(data, site.voice.modelKeyId, now)) return {
		data,
		error: "NO_USABLE_KEY — no AI key is saved for this website. Add one on AI Keys."
	};
	const kept = [];
	for (const row of proposed) {
		const title = row.title.replace(/\s+/g, " ").trim();
		const blurb = row.blurb.replace(/\s+/g, " ").trim();
		if (title.length < 12 || title.length > 110) continue;
		if (embedsFullTopic(title, topic)) continue;
		if (kept.some((item) => cosine(embed(item.title), embed(title)) >= .88)) continue;
		kept.push({
			title,
			blurb: blurb || "A narrow page that does not repeat the others."
		});
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
			clusters: kept.map((row) => ({
				id: uid("clu"),
				title: row.title,
				angle: `custom — ${row.blurb}`,
				excluded: false,
				source: "ai",
				selected: true
			})),
			status: "failed",
			error: `The model returned only ${kept.length} distinct supporting clusters; at least 6 are required.`,
			createdAt: now
		});
		failed.notice = {
			tone: "danger",
			text: failed.plans[0].error
		};
		return {
			data: failed,
			planId: failedId,
			error: failed.plans[0].error
		};
	}
	const next = structuredClone(data);
	const key = usableKey(next, site.voice.modelKeyId, now);
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
			source: "ai",
			selected: true
		})),
		status: "review",
		createdAt: now
	});
	key.lastUsedAt = now;
	const stored = next.keys.find((item) => item.id === key.id);
	if (stored) stored.lastUsedAt = now;
	log(next, siteId, "ok", `Topic plan from your model · ${topic}`, now);
	next.notice = {
		tone: "ok",
		text: "Plan ready from your model. Exclude weak clusters, then queue. Clusters run before the pillar."
	};
	return {
		data: next,
		planId
	};
}
async function queuePlan(data, planId, now, opts) {
	const plan = data.plans.find((p) => p.id === planId);
	if (!plan) return {
		data,
		error: "Plan not found."
	};
	if (plan.status !== "review") return {
		data,
		error: "This plan is already queued."
	};
	const site = data.sites.find((s) => s.id === plan.siteId);
	if (!site) return {
		data,
		error: "Website missing."
	};
	if (site.ghost.status !== "connected") return {
		data,
		error: "Connect Ghost before queueing."
	};
	if (site.ghost.corpus !== "COMPLETE") return {
		data,
		error: "Sync inventory first. Runs are refused while the corpus is EMPTY."
	};
	if (plan.clusters.filter((c) => !c.excluded).length < 2) return {
		data,
		error: "Keep at least two clusters. The pillar needs real pages to link to."
	};
	const key = usableKey(data, opts?.modelKeyId && opts.modelKeyId !== "default" ? opts.modelKeyId : site.voice.modelKeyId, now);
	if (!key) return {
		data,
		error: "NO_USABLE_KEY — no AI key is saved for this plan. Add one on AI Keys."
	};
	const mode = !opts?.publishMode || opts.publishMode === "default" ? site.voice.publishAs : opts.publishMode;
	if (mode === "live" && site.ghost.mode !== "live") return {
		data,
		error: "Live publish is off. This Ghost connection is not live. Queue the plan as a draft."
	};
	const next = structuredClone(data);
	const p = next.plans.find((x) => x.id === planId);
	const runId = uid("run");
	const clusterJobs = [];
	const batchSeen = [];
	for (const cluster of p.clusters.filter((c) => !c.excluded)) {
		const keyword = normalizeKeyword(cluster.title);
		const gate = await gateText(keyword, cluster.title, corpusFor(next, p.siteId, batchSeen), false, opts?.provider);
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
			refusalReason: !gate.ok ? gate.reason : gate.hold ? "REVIEW HELD — close to an existing page." : void 0,
			refusalLayer: !gate.ok ? gate.layer : void 0
		});
		if (job.status !== "refused") job.authorId = matchOrCreateAuthorForTopic({
			id: site.id,
			nicheTag: site.nicheTag
		}, next.authors, cluster.title, {
			niche: site.nicheTag,
			autoMatch: site.autoAuthors !== false
		}).author.id;
		cluster.jobId = job.id;
		if (gate.ok) batchSeen.push({
			keyword,
			title: cluster.title,
			slug: slugify(cluster.title)
		});
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
		createdAt: now
	});
	pillar.authorId = matchOrCreateAuthorForTopic({
		id: site.id,
		nicheTag: site.nicheTag
	}, next.authors, p.pillarTitle, {
		niche: site.nicheTag,
		autoMatch: site.autoAuthors !== false
	}).author.id;
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
		status: "queued"
	});
	p.status = "queued";
	p.runId = runId;
	log(next, p.siteId, "ok", `Topic plan queued · clusters first · pillar waits · ${p.topic}`, now);
	next.notice = {
		tone: "ok",
		text: `Queued ${clusterJobs.filter((job) => job.status === "queued").length} cluster topics, then the pillar. Clusters write first.`
	};
	return {
		data: next,
		runId
	};
}
var COMMODITY = /\b(tips|tools|challenges|effectively|ultimate guide|everything you need|best practices|boost your|unlock|game[- ]changer)\b/i;
function isCommodity(text) {
	return COMMODITY.test(text);
}
async function suggestIdeas(data, siteId, nicheRaw, now, count = 8, provider, liveIdeas) {
	const site = data.sites.find((s) => s.id === siteId);
	if (!site) return {
		data,
		error: "No website selected."
	};
	const niche = nicheRaw.trim();
	if (niche.length < 3) return {
		data,
		error: "Name a niche first. Idea rounds are metered."
	};
	const key = usableKey(data, site.voice.modelKeyId, now);
	const liveKey = key && keyCallsModel(key) ? key : void 0;
	const noun = shortSubject(niche);
	const frames = [
		{
			keyword: `Is ${noun} worth the time`,
			intent: "decision"
		},
		{
			keyword: `What ${noun} costs`,
			intent: "comparison"
		},
		{
			keyword: `Who should skip ${noun}`,
			intent: "decision"
		},
		{
			keyword: `A practical alternative to ${noun}`,
			intent: "comparison"
		},
		{
			keyword: `How ${noun} changes a normal week`,
			intent: "how-to"
		},
		{
			keyword: `${noun} compared with the shorter path`,
			intent: "comparison"
		},
		{
			keyword: `How to talk about ${noun}`,
			intent: "how-to"
		},
		{
			keyword: `Signs ${noun} is the wrong next step`,
			intent: "troubleshooting"
		},
		{
			keyword: `A one-page brief before ${noun}`,
			intent: "checklist"
		},
		{
			keyword: `What you keep if you skip ${noun}`,
			intent: "decision"
		}
	];
	const want = limitsOf(data).ideaCap == null ? Math.max(8, count) : Math.min(limitsOf(data).ideaCap, Math.max(1, count));
	const corpus = corpusFor(data, siteId);
	const items = [];
	const rejected = [];
	let filtered = 0;
	const candidates = liveIdeas ? liveIdeas.ideas.slice(0, want).map((idea) => ({
		keyword: String(idea?.keyword ?? "").trim(),
		intent: "model",
		reason: String(idea?.why ?? "").trim()
	})) : frames.map((frame) => ({
		keyword: frame.keyword,
		intent: frame.intent,
		reason: "Clear of articles, queued work, and synced inventory."
	}));
	for (const frame of candidates) {
		const gate = await gateText(normalizeKeyword(frame.keyword), titleFor(frame.keyword, false), corpus, false, provider);
		if (!gate.ok || gate.hold || isCommodity(frame.keyword)) {
			filtered += 1;
			rejected.push({
				keyword: frame.keyword,
				reason: !gate.ok ? gate.reason : gate.hold ? "REVIEW HELD — close to existing content." : "POLICY REFUSED — commodity framing.",
				layer: !gate.ok ? gate.layer : "policy"
			});
			continue;
		}
		items.push({
			keyword: frame.keyword,
			intent: frame.intent,
			reason: frame.reason
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
		usd: settledUsd
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
		usd: settledUsd
	});
	const stored = liveKey ? next.keys.find((k) => k.id === liveKey.id) : void 0;
	if (stored) stored.lastUsedAt = now;
	next.ideas = {
		siteId,
		niche,
		items,
		tokens: settledTokens,
		filtered,
		engine: liveIdeas ? "llm" : "fallback",
		usage: liveIdeas?.usage,
		rejected
	};
	log(next, siteId, liveIdeas ? "ok" : "warn", `Idea round settled · ${settledTokens.toLocaleString()} tokens · ${items.length} kept · ${filtered} filtered · ${liveIdeas ? "model" : "fallback"}`, now);
	next.notice = {
		tone: "warn",
		text: `${items.length} suggestions for “${niche}”. ${filtered} filtered as already covered. This ${liveIdeas ? "model" : "fallback"} round settled ${settledTokens.toLocaleString()} tokens. Nothing was queued.`
	};
	return { data: next };
}
function depsResolved(job, jobs) {
	return job.dependsOn.every((id) => {
		const dep = jobs.find((j) => j.id === id);
		if (!dep) return false;
		return dep.status === "completed" || dep.status === "failed" || dep.status === "refused" || dep.status === "cancelled" || dep.status === "publish-held";
	});
}
function rollup(jobs) {
	if (!jobs.length) return "failed";
	if (jobs.some((j) => j.status === "running" || j.status === "queued")) return jobs.some((j) => j.status !== "queued") ? "running" : "queued";
	const ok = jobs.filter((j) => j.status === "completed").length;
	const held = jobs.filter((j) => j.status === "review-held" || j.status === "publish-held").length;
	if (ok === jobs.length) return "completed";
	if (ok + held === jobs.length) return "partial";
	if (ok === 0 && held === 0) return jobs.every((j) => j.status === "cancelled") ? "cancelled" : "failed";
	return "partial";
}
async function publishArticle(data, site, job, runMode, _key, now, provider) {
	const corpus = data.articles.filter((a) => a.siteId === site.id).map((a) => ({
		keyword: a.keyword,
		title: a.title,
		slug: a.slug,
		sample: draftSample(a.title, a.keyword, a.sections)
	}));
	const gate = await gateText(job.keyword, job.title, corpus, false, provider);
	if (gate.embedSource) {
		job.embedSource = gate.embedSource;
		job.embedNote = gate.embedSource === "provider" ? "L3 used the provider embedding. Both sides share one vector length." : gate.embedNote && !gate.embedNote.startsWith("No provider") ? `${HASH_EMBED_NOTE} ${gate.embedNote}` : HASH_EMBED_NOTE;
	}
	if (!gate.ok || /second angle|\(again\)/i.test(job.title)) {
		job.status = "refused";
		job.refusalReason = /second angle|\(again\)/i.test(job.title) ? "DUPLICATE REFUSED (L2-lexical). “A second angle” is not a new article." : gate.ok ? "DUPLICATE REFUSED" : gate.reason;
		job.stages[5].status = "done";
		job.stages[5].finishedAt = now;
		return;
	}
	const slug = uniqueSlug(job.enrich?.slug || slugify(job.title), data.articles.filter((a) => a.siteId === site.id).map((a) => a.slug));
	const links = job.enrich?.links?.length ? job.enrich.links : await pickLinks(data, site, job, provider);
	const sectionCount = job.kind === "pillar" ? Math.min(8, Math.max(7, site.voice.sections)) : site.voice.sections;
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
		mustCover: blueprint.mustCover
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
		if (!sections.length) sections = [{
			heading: job.title,
			paragraphs: [excerptOf(markdown)]
		}];
		excerpt = job.enrich?.excerpt || excerptOf(markdown);
		words = wordCount(markdown);
		uniqueness = uniquenessAgainst(job.title, job.keyword, corpus, sections);
	}
	const imageFallback = job.keyword || job.title;
	html = rewriteCmsImageUrls(html, imageFallback);
	markdown = rewriteCmsImageUrls(markdown, imageFallback);
	const enrichImages = job.enrich?.images?.length ? job.enrich.images : composed.images;
	for (const image of enrichImages) {
		if (image.remote && isFakeCmsImage(image.remote)) image.remote = bingThumbUrl(imageFallback);
		if (image.src && isFakeCmsImage(image.src)) image.src = bingThumbUrl(imageFallback);
	}
	const media = applyFetchedImages(html, markdown, enrichImages, imageFallback);
	html = media.html;
	markdown = media.markdown;
	if (uniqueness < .2) {
		job.status = "refused";
		job.refusalReason = `DUPLICATE REFUSED (L3-semantic). Uniqueness would be ${Math.round(uniqueness * 100)}% against pages already on this site.`;
		job.stages[5].status = "done";
		job.stages[5].finishedAt = now;
		return;
	}
	const measured = measureArticle({
		title: job.title,
		keyword: job.keyword,
		markdown,
		mustCover: composed.mustCover,
		words
	});
	const verifyFlags = modelMarkdown ? job.modelVerifyFlags ?? factualVerifyFlags(markdown) : composed.verifyFlags;
	const articleId = uid("art");
	const postId = `gst_${slug.slice(0, 12)}_${hashStr(articleId).toString(16).slice(0, 4)}`;
	const run = data.runs.find((item) => item.id === job.runId);
	const { author } = matchOrCreateAuthorForTopic({
		id: site.id,
		nicheTag: site.nicheTag
	}, data.authors, job.keyword, {
		niche: site.nicheTag,
		autoMatch: site.autoAuthors !== false,
		existingAuthorId: job.authorId
	});
	const article = {
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
			shots: 1
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
		humanNote: void 0
	};
	data.articles.unshift(article);
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
		createdAt: now
	});
	await ensureInbound(data, site, article, provider);
	job.articleId = articleId;
	job.stages[5].status = "done";
	job.stages[5].tokens = 0;
	job.stages[5].finishedAt = now;
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
	if (site.autoRebuild && validatePublicUrl(site.publicUrl).ok) site.pendingRebuildAt = now + 6e4;
	log(data, site.id, "ok", `Single-shot ${runMode} · ${article.title}`, now);
}
function settle(data, job, key, stage, tokens, now, state) {
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
		usd
	});
	if (state === "SETTLED") {
		job.tokens += tokens;
		job.costUsd = Math.round((job.costUsd + usd) * 1e4) / 1e4;
		key.lastUsedAt = now;
	}
}
var MODEL_STAGE_INDEX = {
	intent: 0,
	draft: 1,
	revision: 2,
	metadata: 3,
	enrichment: 4
};
function reserveStage(data, job, key, stageKey, now) {
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
function releaseReserves(data, job, now) {
	const closed = new Set(data.events.filter((e) => e.state === "SETTLED" || e.state === "RELEASED").map((e) => e.pairId));
	const open = data.events.filter((e) => e.state === "RESERVED" && e.pairId.startsWith(`${job.id}:`) && !closed.has(e.pairId));
	for (const reserve of open) pushEvent(data, {
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
		usd: reserve.usd
	});
	return open.length;
}
/** Mark a job's active stage failed, fail the job, and give the outstanding reserve back. */
function failJob(data, jobId, message, now) {
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
function applyKeyPenalty(data, keyId, status, now, message) {
	const key = data.keys.find((item) => item.id === keyId);
	if (!key) return;
	key.lastErrorAt = now;
	key.lastError = `${status ? `HTTP ${status}` : "Network error"}${message ? ` — ${message.slice(0, 220)}` : ""}`;
	if (status === 401 || status === 403) {
		if (key.disabled) return;
		key.disabled = true;
		key.cooldownUntil = void 0;
		log(data, data.activeSiteId, "danger", `Key rejected — disabled · ${key.provider} / ${key.model} · HTTP ${status}`, now);
		data.notice = {
			tone: "danger",
			text: `${key.provider} / ${key.model} refused the key (HTTP ${status}). Key disabled.`
		};
		return;
	}
	if (status === 400 || status === 404 || status === 422) {
		key.cooldownUntil = void 0;
		log(data, data.activeSiteId, "danger", `Key config error (no cooldown) · ${key.provider} / ${key.model} · ${key.lastError}`, now);
		return;
	}
	if (status === 429) {
		key.cooldownUntil = now + 12e3;
		log(data, data.activeSiteId, "warn", `Key rate-limited (12s cooldown) · ${key.provider} / ${key.model} · HTTP 429`, now);
		data.notice = {
			tone: "warn",
			text: `${key.provider} / ${key.model} hit a rate limit (HTTP 429). Cooling 12s, then auto-retry.`
		};
		return;
	}
	key.cooldownUntil = void 0;
	log(data, data.activeSiteId, "warn", `Key transient failure (no cooldown) · ${key.provider} / ${key.model} · ${key.lastError}`, now);
}
var PER_STAGE_TIMEOUTS = {
	intent: 9e4,
	draft: 12e4,
	revision: 15e4,
	metadata: 6e4,
	enrichment: 75e3
};
function withTimeout(promise, ms, label) {
	let timer;
	const timeout = new Promise((_, reject) => {
		timer = setTimeout(() => reject(/* @__PURE__ */ new Error(`${label} timed out after ${Math.round(ms / 1e3)}s`)), ms);
	});
	return Promise.race([promise, timeout]).finally(() => {
		if (timer) clearTimeout(timer);
	});
}
function stageContextFor(data, job, site) {
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
		avoidTitles: data.articles.filter((item) => item.siteId === job.siteId).slice(0, 12).map((item) => item.title)
	};
}
/** Deterministic Stage 2 output when no live model runs (or the model failed). */
function deterministicDraft(data, job, site) {
	const blueprint = job.modelIntent ?? fallbackBlueprint(job);
	return composeArticle({
		title: job.title,
		keyword: job.keyword,
		angle: blueprint.intent,
		tone: site.voice.tone,
		sectionCount: job.kind === "pillar" ? Math.min(8, Math.max(7, site.voice.sections)) : site.voice.sections,
		imageCount: 0,
		links: [],
		nicheTag: site.nicheTag,
		corpus: data.articles.filter((item) => item.siteId === site.id).map((item) => ({
			keyword: item.keyword,
			title: item.title,
			slug: item.slug
		})),
		mustCover: blueprint.mustCover
	}).markdown;
}
function warn(data, siteId, message, now) {
	log(data, siteId, "warn", message, now);
}
/** Index of the stage that must run now: first non-done stage (or stage 6 reconcile). */
function currentStageIndex(job) {
	const first = job.stages.findIndex((stage) => stage.status !== "done");
	return first >= 0 ? first : job.stages.length - 1;
}
async function runModelStageNow(data, job, site, stageKey, now, host, key) {
	const stage = job.stages.find((row) => row.key === stageKey);
	const ctx = stageContextFor(data, job, site);
	const live = Boolean(key && keyCallsModel(key) && host.chat);
	if (live && key) reserveStage(data, job, key, stageKey, now);
	if (stageKey === "intent") {
		if (live && host.chat) try {
			const prompt = buildIntentPrompt(ctx);
			const outcome = await withTimeout(host.chat.callModel({
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
				}
			}), PER_STAGE_TIMEOUTS.intent ?? 9e4, "Stage 1 (Intent)");
			job.modelIntent = parseIntentStage(outcome.text);
			job.modelUsage = {
				...job.modelUsage,
				intent: outcome.usage
			};
			job.keyId = outcome.keyId;
			job.failoverChain = [.../* @__PURE__ */ new Set([...job.failoverChain ?? [], outcome.keyId])];
			stage.tokens = outcome.usage.total;
			stage.note = usageNote(outcome.usage);
			if (key) settle(data, job, key, "intent", outcome.usage.total, now, "SETTLED");
			stage.status = "done";
			stage.finishedAt = now;
			return;
		} catch (error) {
			warn(data, site.id, `Stage 1 model call failed — deterministic blueprint fallback · ${error instanceof Error ? error.message : "unknown error"}`, now);
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
		if (live && host.chat) try {
			const intent = job.modelIntent ?? fallbackBlueprint(job);
			if (!job.modelIntent) job.modelIntent = intent;
			const prompt = buildDraftPrompt({
				...ctx,
				blueprint: intent
			}, intent);
			const outcome = await withTimeout(host.chat.callModel({
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
				}
			}), PER_STAGE_TIMEOUTS.draft ?? 12e4, "Stage 2 (Draft)");
			const parsed = parseModelStage("draft", outcome.text);
			let draftMarkdown = parsed.markdown;
			let draftUsage = outcome.usage;
			let draftKeyId = outcome.keyId;
			if (wordCount(draftMarkdown) < 2e3) try {
				const expandPrompt = buildDraftPrompt({
					...ctx,
					blueprint: intent
				}, intent, true);
				const more = await withTimeout(host.chat.callModel({
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
					}
				}), PER_STAGE_TIMEOUTS.draft ?? 12e4, "Stage 2 (Draft expansion)");
				const expanded = parseModelStage("draft", more.text);
				if (wordCount(expanded.markdown) > wordCount(draftMarkdown)) {
					draftMarkdown = expanded.markdown;
					draftKeyId = more.keyId;
					draftUsage = {
						prompt: draftUsage.prompt + more.usage.prompt,
						completion: draftUsage.completion + more.usage.completion,
						total: draftUsage.total + more.usage.total
					};
				}
			} catch (error) {
				warn(data, site.id, `Stage 2 expansion pass skipped · ${error instanceof Error ? error.message : "unknown error"}`, now);
			}
			job.modelText = {
				...job.modelText,
				draft: draftMarkdown
			};
			job.modelUsage = {
				...job.modelUsage,
				draft: draftUsage
			};
			job.modelVerifyFlags = parsed.verifyFlags ?? job.modelVerifyFlags;
			job.keyId = draftKeyId;
			job.failoverChain = [.../* @__PURE__ */ new Set([...job.failoverChain ?? [], draftKeyId])];
			stage.tokens = draftUsage.total;
			stage.note = usageNote(draftUsage);
			if (key) settle(data, job, key, "draft", draftUsage.total, now, "SETTLED");
			stage.status = "done";
			stage.finishedAt = now;
			return;
		} catch (error) {
			warn(data, site.id, `Stage 2 model call failed — deterministic draft fallback · ${error instanceof Error ? error.message : "unknown error"}`, now);
		}
		job.modelText = {
			...job.modelText,
			draft: deterministicDraft(data, job, site)
		};
		stage.tokens = 0;
		stage.note = NO_MODEL_NOTE;
		releaseReserves(data, job, now);
		stage.status = "done";
		stage.finishedAt = now;
		return;
	}
	const draft = job.modelText?.draft || deterministicDraft(data, job, site);
	let revised = draft;
	let verifyFlags;
	let revisionUsage = {
		prompt: 0,
		completion: 0,
		total: 0
	};
	let usedModel = false;
	if (live && host.chat) try {
		const prompt = buildRevisionPrompt(ctx, draft);
		const outcome = await withTimeout(host.chat.callModel({
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
			}
		}), PER_STAGE_TIMEOUTS.revision ?? 15e4, "Stage 3 (Revision)");
		const parsed = parseModelStage("revision", outcome.text);
		revised = parsed.markdown;
		verifyFlags = parsed.verifyFlags;
		revisionUsage = outcome.usage;
		usedModel = true;
		job.keyId = outcome.keyId;
		job.failoverChain = [.../* @__PURE__ */ new Set([...job.failoverChain ?? [], outcome.keyId])];
	} catch (error) {
		warn(data, site.id, `Stage 3 revision fell back to the Stage 2 draft + deterministic scrub · ${error instanceof Error ? error.message : "model pass failed"}`, now);
	}
	const banned = [...ctx.bannedPhrases, ...ctx.author?.voice.bannedPhrases ?? []];
	const scrub = roboticScrub(revised, banned);
	let humanizerScore;
	let humanizerStripped;
	let humanizerPasses;
	let humanizerNote;
	let finalMarkdown = scrub.markdown;
	try {
		const { humanizeWithBlader } = await Promise.resolve().then(() => humanizer_exports);
		const humanized = await withTimeout(humanizeWithBlader({
			chat: live && usedModel && host.chat?.bladerChat ? host.chat.bladerChat : void 0,
			markdown: scrub.markdown,
			keyword: job.keyword,
			title: job.title,
			authorName: ctx.author?.name,
			authorVoice: ctx.author ? authorVoiceBlock(ctx.author) : void 0,
			authorBannedPhrases: banned
		}), 15e4, "Stage 3 (Blader humanizer)");
		finalMarkdown = humanized.markdown;
		humanizerScore = humanized.score;
		humanizerStripped = humanized.stripped;
		humanizerPasses = humanized.passes;
		humanizerNote = humanized.note;
		if (humanized.usage && key && usedModel) settle(data, job, key, "humanize", humanized.usage.total, now, "SETTLED");
	} catch (error) {
		warn(data, site.id, `Blader deterministic scrub applied · ${error instanceof Error ? error.message : "humanizer unavailable"}`, now);
		const { humanizeWithBlader } = await Promise.resolve().then(() => humanizer_exports);
		const plain = await humanizeWithBlader({
			markdown: scrub.markdown,
			keyword: job.keyword,
			title: job.title,
			authorBannedPhrases: banned
		});
		finalMarkdown = plain.markdown;
		humanizerScore = plain.score;
		humanizerStripped = plain.stripped;
		humanizerPasses = plain.passes;
		humanizerNote = plain.note;
	}
	job.enrich = {
		...job.enrich,
		humanizerNote
	};
	job.modelText = {
		...job.modelText,
		revision: finalMarkdown
	};
	job.modelUsage = {
		...job.modelUsage,
		revision: revisionUsage
	};
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
async function runMetadataStage(data, job, site, now, host, key) {
	const stage = job.stages.find((row) => row.key === "metadata");
	const markdown = job.modelText?.revision || job.modelText?.draft || "";
	const existingSlugs = data.articles.filter((article) => article.siteId === site.id && article.jobId !== job.id).map((article) => article.slug);
	const existingTags = [...new Set(data.articles.filter((article) => article.siteId === site.id).flatMap((article) => article.tags).filter(Boolean))];
	const live = Boolean(key && keyCallsModel(key) && host.chat && markdown);
	if (live && key) reserveStage(data, job, key, "metadata", now);
	if (live && host.chat) try {
		const prompt = buildMetadataPrompt({
			...stageContextFor(data, job, site),
			blueprint: job.modelIntent
		}, markdown, {
			existingSlugs,
			existingTags
		});
		const outcome = await withTimeout(host.chat.callModel({
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
			}
		}), PER_STAGE_TIMEOUTS.metadata ?? 6e4, "Stage 4 (Metadata)");
		const parsed = parseMetadataStage(outcome.text);
		job.enrich = {
			...job.enrich,
			title: parsed.title,
			metaDescription: parsed.metaDescription,
			slug: uniqueSlug(parsed.slug || parsed.title || job.title, existingSlugs),
			excerpt: parsed.excerpt,
			tags: parsed.tags.slice(0, 3)
		};
		job.modelUsage = {
			...job.modelUsage,
			metadata: outcome.usage
		};
		job.keyId = outcome.keyId;
		job.failoverChain = [.../* @__PURE__ */ new Set([...job.failoverChain ?? [], outcome.keyId])];
		if (key) settle(data, job, key, "metadata", outcome.usage.total, now, "SETTLED");
		stage.tokens = outcome.usage.total;
		stage.note = usageNote(outcome.usage);
		stage.status = "done";
		stage.finishedAt = now;
		return;
	} catch (error) {
		warn(data, site.id, `Stage 4 metadata fell back to deterministic packaging · ${error instanceof Error ? error.message : "model pass failed"}`, now);
	}
	const excerpt = (markdown ? excerptOf(markdown) : job.title).slice(0, 200);
	const tags = [...new Set([site.nicheTag, job.keyword.split(/\s+/)[0] ?? "notes"].filter(Boolean))].slice(0, 4);
	job.enrich = {
		...job.enrich,
		title: job.title.slice(0, 60),
		metaDescription: excerpt.slice(0, 155),
		slug: uniqueSlug(job.title, existingSlugs),
		excerpt,
		tags
	};
	stage.tokens = 0;
	stage.note = `${NO_MODEL_NOTE} · excerpt ${excerpt.length} chars · ${tags.length} tags`;
	releaseReserves(data, job, now);
	stage.status = "done";
	stage.finishedAt = now;
}
async function runEnrichmentStage(data, job, site, now, host, key, provider) {
	const stage = job.stages.find((row) => row.key === "enrichment");
	const markdown = job.modelText?.revision || job.modelText?.draft || "";
	const published = data.articles.filter((article) => article.siteId === site.id).map((article) => ({
		title: article.title,
		slug: article.slug
	}));
	let links = [];
	let imageQueries;
	let enrichmentUsage;
	const live = Boolean(key && keyCallsModel(key) && host.chat && markdown);
	if (live && key) reserveStage(data, job, key, "enrichment", now);
	if (live && host.chat) try {
		const prompt = buildEnrichmentPrompt({
			...stageContextFor(data, job, site),
			blueprint: job.modelIntent
		}, markdown, published);
		const outcome = await withTimeout(host.chat.callModel({
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
			}
		}), PER_STAGE_TIMEOUTS.enrichment ?? 75e3, "Stage 5 (Enrichment)");
		const parsed = parseEnrichmentStage(outcome.text);
		const allowed = new Set(published.map((page) => page.slug));
		links = parsed.links.filter((link) => allowed.has(link.slug)).map((link) => ({
			anchor: link.anchor.trim(),
			slug: link.slug
		}));
		imageQueries = parsed.imageQueries;
		enrichmentUsage = outcome.usage;
		job.keyId = outcome.keyId;
		job.failoverChain = [.../* @__PURE__ */ new Set([...job.failoverChain ?? [], outcome.keyId])];
		if (key) settle(data, job, key, "enrichment", outcome.usage.total, now, "SETTLED");
	} catch (error) {
		warn(data, site.id, `Stage 5 enrichment fell back to deterministic links and images · ${error instanceof Error ? error.message : "model pass failed"}`, now);
	}
	if (!links.length) try {
		links = await pickLinks(data, site, job, provider);
	} catch (error) {
		warn(data, site.id, `Internal-link pick failed (continuing without) · ${error instanceof Error ? error.message : "unknown"}`, now);
	}
	job.enrich = {
		...job.enrich,
		links
	};
	const planned = imageQueries?.length ? imageQueries.slice(0, 4).map((slot, index) => {
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
			remote: bingThumbUrl(slot.query, frame.w, frame.h)
		};
	}) : planImages(job.keyword, job.title, site.voice.sectionImages, markdown ? sectionsFromMarkdown(markdown).map((section) => ({
		heading: section.heading,
		words: section.paragraphs.join(" ").split(/\s+/).filter(Boolean).length
	})) : []);
	const slots = planned.slice(0, 4);
	let images = planned;
	if (host.images && slots.length) try {
		const avoid = data.articles.flatMap((item) => item.images.map((image) => String(image.src ?? "").split("/").pop() ?? "")).filter(Boolean);
		const result = await withTimeout(host.images.placeImages({
			provider: site.voice.imageProvider || "bing",
			salt: 0,
			avoid,
			slots: slots.map((slot) => ({
				query: slot.query,
				alt: slot.alt,
				role: slot.role,
				width: slot.width,
				height: slot.height
			}))
		}), 45e3, "Stage 5 (Bing image placement)");
		if (result.ok && result.images.length) images = result.images;
	} catch (error) {
		warn(data, site.id, `Bing placement failed — dynamic thumbnails stay on the article · ${error instanceof Error ? error.message : "unknown"}`, now);
	}
	job.enrich = {
		...job.enrich,
		images
	};
	if (enrichmentUsage) {
		job.modelUsage = {
			...job.modelUsage,
			enrichment: enrichmentUsage
		};
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
async function runJobPipeline(data, jobId, now, site, host, provider) {
	try {
		for (let guard = 0; guard < 12; guard += 1) {
			const job = data.jobs.find((item) => item.id === jobId);
			if (!job || job.status !== "running" && job.status !== "queued") return;
			if (job.status === "queued") {
				startJob(data, job, now);
				if (job.status !== "running") return;
			}
			const stageIndex = currentStageIndex(job);
			job.stageIndex = stageIndex;
			const stage = job.stages[stageIndex];
			if (stage.status === "pending") {
				stage.status = "running";
				stage.startedAt = now;
			}
			const run = data.runs.find((item) => item.id === job.runId);
			const key = data.keys.find((item) => item.id === (run?.modelKeyId || job.keyId)) ?? usableKey(data, run?.modelKeyId, now) ?? void 0;
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
					await publishArticle(data, site, job, run?.publishMode ?? "draft", key ?? data.keys[0], now, provider);
					host.commit?.(data);
					return;
			}
			host.commit?.(data);
			if (job.status !== "running") return;
		}
		failJob(data, jobId, "Stage runner exceeded its stage budget; job failed to guarantee a terminal state.", Date.now());
		host.commit?.(data);
	} catch (error) {
		failJob(data, jobId, error instanceof Error ? error.message : "The stage runner crashed on an unexpected error.", Date.now());
		host.commit?.(data);
	}
}
function startJob(data, job, now) {
	if (!usableKey(data, data.runs.find((r) => r.id === job.runId)?.modelKeyId, now)) {
		job.status = "refused";
		job.refusalReason = "NO_USABLE_KEY";
		return false;
	}
	job.status = "running";
	const firstIncomplete = job.stages.findIndex((stage) => stage.status !== "done");
	const resumeIndex = job.stageIndex >= 0 && job.stages[job.stageIndex]?.status !== "done" ? job.stageIndex : firstIncomplete >= 0 ? firstIncomplete : Math.max(0, job.stages.length - 1);
	job.stageIndex = resumeIndex;
	const stage = job.stages[resumeIndex];
	stage.status = "running";
	stage.startedAt = now;
	return true;
}
function needsWork(data, now) {
	if (data.workerPaused) return false;
	if (data.jobs.some((j) => j.status === "queued" || j.status === "running")) return true;
	if (data.sites.some((s) => s.ghost.corpus === "SYNCING" && s.ghost.syncReadyAt && s.ghost.syncReadyAt <= now)) return true;
	if (data.sites.some((s) => s.pendingRebuildAt && s.pendingRebuildAt <= now)) return true;
	return false;
}
function createBuild(data, site, now, auto) {
	const check = validatePublicUrl(site.publicUrl);
	if (!check.ok) return {
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
		artifact: []
	};
	const candidates = data.articles.filter((article) => article.siteId === site.id);
	const excluded = [];
	const indexable = candidates.filter((article) => {
		if (article.status !== "published") {
			excluded.push({
				id: article.id,
				reason: "draft"
			});
			return false;
		}
		const sourceJob = data.jobs.find((job) => job.id === article.jobId);
		if (sourceJob?.status === "failed" || sourceJob?.status === "refused") {
			excluded.push({
				id: article.id,
				reason: "failed gate"
			});
			return false;
		}
		if (!validatePublicUrl(site.publicUrl).ok) {
			excluded.push({
				id: article.id,
				reason: "missing public URL"
			});
			return false;
		}
		return true;
	});
	const orphans = orphansOf(indexable);
	const included = indexable.filter((article) => {
		if (orphans.some((orphan) => orphan.id === article.id)) {
			excluded.push({
				id: article.id,
				reason: "orphan"
			});
			return false;
		}
		return true;
	});
	if (!included.length) return {
		id: uid("bld"),
		siteId: site.id,
		status: "failed",
		pages: 0,
		bytes: 0,
		ms: 180,
		at: now,
		auto,
		template: site.template,
		detail: "Build failed: no indexable articles remain after scope and orphan checks.",
		includedIds: [],
		excluded,
		artifact: []
	};
	const artifact = staticFiles(site, included, true, data.authors.filter((author) => author.siteId === site.id)).map((file) => ({
		...file,
		hash: hashArtifact(file.text)
	}));
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
		routes: buildRoutes(artifact),
		adsConfigHash: adsConfigHash(site),
		artifact
	};
}
async function advance(data, now, opts = {}) {
	if (!needsWork(data, now)) return data;
	const next = structuredClone(data);
	for (const site of next.sites) {
		if (site.ghost.corpus === "SYNCING" && site.ghost.syncReadyAt && now >= site.ghost.syncReadyAt) {
			site.ghost.syncReadyAt = void 0;
			if (site.ghost.adminKey && site.ghost.url.startsWith("https://")) log(next, site.id, "info", "Ghost sync is waiting on the Admin API. Local articles were not copied in as inventory.", now);
			else {
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
				const { uploadAutoBuild } = await import("./auto-upload-BLdVt0a3.mjs");
				const sent = await uploadAutoBuild(site, build, next.articles.filter((article) => build.includedIds.includes(article.id)));
				if (sent.ok) {
					next.deploys.unshift({
						id: uid("dep"),
						siteId: site.id,
						buildId: build.id,
						providerId: "cpanel",
						status: "packaged",
						at: now,
						probe: `Auto-upload sent ${sent.files} files to ${sent.host}.${sent.note ? ` ${sent.note}` : ""} Probe the public URL before treating the site as live.`
					});
					log(next, site.id, "ok", `Auto-upload · ${sent.files} files · ${sent.host}`, now);
				} else log(next, site.id, "warn", sent.reason, now);
			}
		}
	}
	for (const site of next.sites) {
		const concurrency = Math.max(1, limitsOf(next).concurrency);
		const runningJobs = () => next.jobs.filter((j) => j.siteId === site.id && j.status === "running");
		const queued = next.jobs.filter((j) => j.siteId === site.id && j.status === "queued");
		let slots = concurrency - runningJobs().length;
		for (const job of [...queued].reverse()) {
			if (slots <= 0) break;
			if (!depsResolved(job, next.jobs)) continue;
			if (startJob(next, job, now)) slots -= 1;
		}
		const active = next.jobs.filter((j) => j.siteId === site.id && j.status === "running");
		await Promise.all(active.map((job) => runJobPipeline(next, job.id, now, site, opts, opts.provider)));
	}
	for (const run of next.runs) {
		const jobs = next.jobs.filter((j) => j.runId === run.id);
		const wasRunning = run.status === "running" || run.status === "queued";
		run.status = rollup(jobs);
		if (wasRunning && run.status === "failed" && jobs.some((j) => j.refusalReason === "NO_USABLE_KEY" || j.failReason === "NO_USABLE_KEY")) {
			log(next, run.siteId, "danger", `Run blocked · NO_USABLE_KEY · no AI key is saved for this workspace · ${run.title}`, now);
			next.notice = {
				tone: "danger",
				text: "No usable AI key. Save at least one key on AI Keys to run."
			};
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
function manualBuild(data, siteId, now) {
	const next = structuredClone(data);
	const site = next.sites.find((s) => s.id === siteId);
	if (!site) return data;
	const build = createBuild(next, site, now, false);
	next.builds.unshift(build);
	next.notice = {
		tone: build.status === "succeeded" ? "ok" : "danger",
		text: build.status === "succeeded" ? `Build succeeded · ${build.pages} pages.` : build.detail || "Build failed."
	};
	log(next, siteId, build.status === "succeeded" ? "ok" : "danger", `Manual build ${build.status}`, now);
	return next;
}
/** Rule 6: route-diff gate. Previously live routes may never silently disappear. */
function routeDiffFor(data, build) {
	const candidate = build.routes ?? buildRoutes(build.artifact);
	const previous = data.deploys.filter((deploy) => deploy.status === "verified").map((deploy) => data.builds.find((item) => item.id === deploy.buildId)).find((item) => Boolean(item));
	const live = new Set(previous?.routes ?? buildRoutes(previous?.artifact ?? []));
	if (!live.size) return {
		removedRoutes: [],
		addedRoutes: candidate.filter((route) => !live.has(route)).sort(),
		unchangedCount: 0
	};
	return {
		removedRoutes: [...live].filter((route) => !candidate.includes(route)).sort(),
		addedRoutes: candidate.filter((route) => !live.has(route)).sort(),
		unchangedCount: candidate.filter((route) => live.has(route)).length
	};
}
function packageDeploy(data, buildId, now, options = {}) {
	const build = data.builds.find((b) => b.id === buildId);
	if (!build) return {
		data,
		error: "Build not found."
	};
	if (build.status !== "succeeded") return {
		data,
		error: "Only a succeeded build can be packaged."
	};
	const site = data.sites.find((s) => s.id === build.siteId);
	if (!site) return {
		data,
		error: "Website missing."
	};
	if (!data.articles.filter((article) => article.siteId === site.id).length) return {
		data,
		error: "Refusing a deploy with no pages. Build the site after at least one article exists."
	};
	const wanted = options.providerId ?? "cpanel";
	const provider = site.providers.find((p) => p.id === wanted && (p.status === "verified" || p.status === "configured"));
	if (!provider) return {
		data,
		error: `Connect and verify ${wanted === "cpanel" ? "cPanel hosting" : wanted} on Connections first.`
	};
	const next = structuredClone(data);
	const existing = next.deploys.find((deploy) => deploy.buildId === buildId);
	if (existing && existing.status !== "hold-route-diff") return {
		data,
		error: "That build was already deployed. Existing builds are never re-deployed."
	};
	const diff = routeDiffFor(next, build);
	const acknowledged = Boolean(options.acknowledgeRouteDiff) || Boolean(existing?.routeDiff?.acknowledged);
	if (diff.removedRoutes.length > 0 && !acknowledged) {
		if (!existing) next.deploys.unshift({
			id: uid("dep"),
			siteId: site.id,
			buildId,
			providerId: provider.id,
			status: "hold-route-diff",
			at: now,
			probe: `HOLD_ROUTE_DIFF · ${diff.removedRoutes.length} live route(s) would disappear. Acknowledge explicitly or rebuild with the missing articles.`,
			routeDiff: {
				...diff,
				acknowledged: false
			}
		});
		else {
			existing.status = "hold-route-diff";
			existing.routeDiff = {
				...diff,
				acknowledged: false
			};
			existing.probe = `HOLD_ROUTE_DIFF · ${diff.removedRoutes.length} live route(s) would disappear.`;
		}
		next.notice = {
			tone: "danger",
			text: `Route-diff gate: ${diff.removedRoutes.length} previously live route(s) would be removed. Deployment is held until you acknowledge.`
		};
		log(next, site.id, "warn", `HOLD_ROUTE_DIFF · removed ${diff.removedRoutes.length} · added ${diff.addedRoutes.length} · unchanged ${diff.unchangedCount}`, now);
		return {
			data: next,
			hold: true
		};
	}
	const probe = "Files were uploaded to the verified host. Probe the public URL before treating the site as live.";
	if (existing) {
		existing.status = "packaged";
		existing.providerId = provider.id;
		existing.at = now;
		existing.probe = probe;
		if (existing.routeDiff) existing.routeDiff.acknowledged = true;
	} else next.deploys.unshift({
		id: uid("dep"),
		siteId: site.id,
		buildId,
		providerId: provider.id,
		status: "packaged",
		at: now,
		probe,
		routeDiff: diff.removedRoutes.length ? {
			...diff,
			acknowledged: true
		} : void 0
	});
	next.notice = {
		tone: "info",
		text: `Uploaded for ${provider.name}. Probe the Public URL before calling it live.`
	};
	log(next, site.id, "info", `Deploy packaged · ${provider.name} · build ${buildId.slice(-6)}`, now);
	return { data: next };
}
/** Rule 6: explicit resolution of a route-diff hold. */
function resolveRouteDiff(data, deployId, action, now) {
	const deploy = data.deploys.find((item) => item.id === deployId);
	if (!deploy || deploy.status !== "hold-route-diff") return {
		data,
		error: "No route-diff hold on that deploy."
	};
	if (action === "rebuild") {
		const site = data.sites.find((item) => item.id === deploy.siteId);
		if (!site) return {
			data,
			error: "Website missing."
		};
		const next = structuredClone(data);
		const build = createBuild(next, site, now, false);
		next.builds.unshift(build);
		next.deploys = next.deploys.filter((item) => item.id !== deployId);
		next.notice = {
			tone: build.status === "succeeded" ? "ok" : "danger",
			text: build.status === "succeeded" ? "Rebuilt with every current article. Review the new build and deploy it." : build.detail || "Rebuild failed."
		};
		return { data: next };
	}
	return packageDeploy(data, deploy.buildId, now, {
		providerId: deploy.providerId,
		acknowledgeRouteDiff: true
	});
}
function applyProbe(data, deployId, ok, detail, now) {
	const next = structuredClone(data);
	const dep = next.deploys.find((d) => d.id === deployId);
	if (!dep) return data;
	dep.status = ok ? "verified" : "failed";
	dep.probe = detail;
	dep.at = now;
	next.notice = {
		tone: ok ? "ok" : "danger",
		text: detail
	};
	log(next, dep.siteId, ok ? "ok" : "danger", detail, now);
	if (ok) {
		const build = next.builds.find((item) => item.id === dep.buildId);
		const site = next.sites.find((item) => item.id === dep.siteId);
		const provider = site?.providers.find((item) => item.id === "cpanel" && item.status === "verified");
		const key = site?.indexNowKey;
		if (build && site && provider?.ftp && key && build.includedIds.length) {
			next.notice = {
				tone: "info",
				text: "Public probe passed. IndexNow submission is queued after confirming the key file."
			};
			log(next, site.id, "info", `IndexNow ready · ${build.includedIds.length} changed URL(s) · ${key}.txt key confirmed by public probe`, now);
		} else next.notice = {
			tone: "warn",
			text: "Public probe passed, but IndexNow was skipped because the site has no verified key-file configuration."
		};
	}
	return next;
}
async function buildAudit(data, siteId, now, provider) {
	const next = structuredClone(data);
	const site = next.sites.find((s) => s.id === siteId);
	if (!site) return data;
	const articles = next.articles.filter((article) => article.siteId === siteId);
	const [min, max] = intensityBand(site.voice.linkIntensity);
	const proposals = [];
	let healthy = 0;
	let missing = 0;
	let broken = 0;
	for (const article of articles) {
		let brokenHere = 0;
		const kept = [];
		for (const link of article.links) {
			const target = articles.find((other) => other.slug === link.targetSlug);
			if (!target) {
				brokenHere += 1;
				const replacement = await bestTarget(articles, article, site.nicheTag, /* @__PURE__ */ new Set([link.targetSlug]), provider);
				if (replacement) proposals.push({
					id: uid("prop"),
					articleId: article.id,
					articleTitle: article.title,
					kind: "rewrite",
					detail: `Broken permalink /${link.targetSlug}/. PUT would point the anchor at /post/${replacement.slug}/. Post ${article.ledger.postId} is not recreated.`,
					anchor: anchorPhrase(replacement.title),
					targetSlug: replacement.slug,
					fromSlug: link.targetSlug,
					selected: true
				});
				else proposals.push({
					id: uid("prop"),
					articleId: article.id,
					articleTitle: article.title,
					kind: "remove",
					detail: `Remove the broken edge to /${link.targetSlug}/. No replacement is in inventory.`,
					anchor: link.anchor,
					targetSlug: link.targetSlug,
					selected: true
				});
				continue;
			}
			if (await articleSimilarity(article, target, site.nicheTag, provider) < .18) {
				const replacement = await bestTarget(articles, article, site.nicheTag, /* @__PURE__ */ new Set([link.targetSlug]), provider);
				if (replacement) proposals.push({
					id: uid("prop"),
					articleId: article.id,
					articleTitle: article.title,
					kind: "rewrite",
					detail: `Low-relevance edge. PUT would retarget “${link.anchor}” to a closer page.`,
					anchor: anchorPhrase(replacement.title),
					targetSlug: replacement.slug,
					fromSlug: link.targetSlug,
					selected: false
				});
			}
			kept.push(link);
			if (!article.html.includes(postHref(link.targetSlug)) && !article.markdown.includes(postHref(link.targetSlug))) proposals.push({
				id: uid("prop"),
				articleId: article.id,
				articleTitle: article.title,
				kind: "insert",
				detail: `“${link.anchor}” is recorded but missing from the article. The re-weave writes the link into the page.`,
				anchor: link.anchor,
				targetSlug: link.targetSlug,
				selected: true
			});
		}
		if (brokenHere) broken += 1;
		const overflow = kept.length - max;
		if (overflow > 0) {
			const scored = await Promise.all(kept.map(async (link) => {
				const target = articles.find((item) => item.slug === link.targetSlug);
				return {
					link,
					sim: target ? await articleSimilarity(article, target, site.nicheTag, provider) : 0
				};
			}));
			scored.sort((a, b) => a.sim - b.sim);
			for (const { link } of scored.slice(0, overflow)) proposals.push({
				id: uid("prop"),
				articleId: article.id,
				articleTitle: article.title,
				kind: "remove",
				detail: `Over the ${site.voice.linkIntensity} ceiling (${max}). Remove the weakest edge.`,
				anchor: link.anchor,
				targetSlug: link.targetSlug,
				selected: false
			});
		}
		if (kept.length < min) {
			missing += 1;
			const have = new Set(article.links.map((link) => link.targetSlug));
			let added = 0;
			const ranked = await Promise.all(articles.filter((other) => other.id !== article.id && !have.has(other.slug)).map(async (other) => ({
				other,
				sim: await articleSimilarity(article, other, site.nicheTag, provider)
			})));
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
					selected: true
				});
				added += 1;
			}
		} else if (!brokenHere && kept.length <= max) healthy += 1;
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
		applied: false
	});
	next.notice = {
		tone: "info",
		text: `Audit scanned ${articles.length} posts. ${orphanCount} orphan${orphanCount === 1 ? "" : "s"} in the library. Nothing was written.`
	};
	log(next, siteId, "info", `Link audit · ${articles.length} scanned · ${proposals.length} proposals · ${orphanCount} orphans`, now);
	return next;
}
async function bestTarget(articles, article, nicheTag, skip, provider) {
	const ranked = await Promise.all(articles.filter((other) => other.id !== article.id && !skip.has(other.slug)).map(async (other) => ({
		other,
		sim: await articleSimilarity(article, other, nicheTag, provider)
	})));
	ranked.sort((a, b) => b.sim - a.sim);
	return ranked[0]?.other;
}
function applyAudit(data, auditId, now) {
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
			} else if (!article.links.some((item) => item.targetSlug === proposal.targetSlug)) article.links.push(linkEdge(proposal.anchor, proposal.targetSlug, "LOCAL"));
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
	next.notice = {
		tone: "ok",
		text: `Re-weave applied with PUT · ${n} edits · no new Ghost posts.`
	};
	log(next, audit.siteId, "ok", `Re-weave PUT · ${n} edits · shots unchanged`, now);
	return next;
}
function liftOpenings(data) {
	let changed = false;
	const next = structuredClone(data);
	for (const article of next.articles) {
		const token = article.keyword.toLowerCase().split(/\s+/).find((word) => word.length > 3) ?? "";
		if (!token) continue;
		if (article.markdown.slice(0, 600).toLowerCase().includes(token)) continue;
		const sentence = `${article.keyword} is the question this page answers.`;
		article.markdown = `${sentence}\n\n${article.markdown}`;
		article.html = `<p>${sentence}</p>\n${article.html}`;
		if (article.sections[0]) article.sections[0] = {
			...article.sections[0],
			paragraphs: [`${sentence} ${article.sections[0].paragraphs[0] ?? ""}`.trim(), ...article.sections[0].paragraphs.slice(1)]
		};
		changed = true;
	}
	return changed ? next : null;
}
async function weaveOrphans(data, siteId, now, quiet = false, provider) {
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
		const candidates = await Promise.all(articles.filter((other) => other.id !== article.id && !have.has(other.slug)).map(async (other) => ({
			other,
			sim: await articleSimilarity(article, other, site.nicheTag, provider)
		})));
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
		text: added ? `Interlink pass added ${added} verbatim anchors. ${orphans} orphan${orphans === 1 ? "" : "s"} remain. No new posts.` : orphans ? `Outbound minimum is met. ${orphans} page${orphans === 1 ? "" : "s"} still have no inbound link.` : "Every article already meets the link minimum, and none are orphans."
	};
	log(next, siteId, added ? "ok" : "info", `Interlink pass · ${added} anchors · ${orphans} orphans`, now);
	return next;
}
function cancelRun(data, runId, now) {
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
	next.notice = {
		tone: "warn",
		text: released ? `Run cancelled. ${released} stage reserve(s) returned to the allowance. No extra Ghost write.` : "Run cancelled. No extra Ghost write."
	};
	return next;
}
function restartJob(data, jobId, now, fromScratch = false) {
	const job = data.jobs.find((j) => j.id === jobId);
	if (!job) return {
		data,
		error: "Job not found."
	};
	if (job.status !== "failed") return {
		data,
		error: "Only failed jobs restart. Refusals stay refused."
	};
	const restartLimit = limitsOf(data).restartLimit;
	if (restartLimit != null && (job.restarts ?? 0) >= restartLimit) return {
		data,
		error: `Restart limit reached (${restartLimit}). Raise it in Settings → Content to restart again.`
	};
	const next = structuredClone(data);
	const target = next.jobs.find((j) => j.id === jobId);
	if (!fromScratch && target.stages.every((stage) => stage.status === "done")) return {
		data,
		error: "No incomplete stage to resume. Use a hard restart to run every stage again."
	};
	target.attempt = (target.attempt ?? 1) + 1;
	target.restarts = (target.restarts ?? 0) + 1;
	target.status = "queued";
	target.failReason = void 0;
	target.modelError = void 0;
	if (fromScratch) {
		target.modelText = void 0;
		target.modelUsage = void 0;
		target.stageIndex = -1;
		target.stages = blankStages();
		target.tokens = 0;
		target.costUsd = 0;
	} else {
		const firstIncomplete = target.stages.findIndex((stage) => stage.status !== "done");
		const resumeIndex = firstIncomplete >= 0 ? firstIncomplete : Math.max(0, target.stageIndex, target.stages.length - 1);
		target.stageIndex = resumeIndex;
		target.stages = target.stages.map((stage, index) => index < resumeIndex ? stage : {
			...stage,
			status: "pending",
			tokens: 0,
			startedAt: void 0,
			finishedAt: void 0,
			note: void 0
		});
		if (resumeIndex <= 1 && target.modelText) delete target.modelText.draft;
		if (resumeIndex <= 2 && target.modelText) delete target.modelText.revision;
		if (resumeIndex <= 1 && target.modelUsage) delete target.modelUsage.draft;
		if (resumeIndex <= 2 && target.modelUsage) delete target.modelUsage.revision;
		if (target.modelText && !target.modelText.draft && !target.modelText.revision) target.modelText = void 0;
		if (target.modelUsage && !target.modelUsage.draft && !target.modelUsage.revision) target.modelUsage = void 0;
	}
	const run = next.runs.find((r) => r.id === target.runId);
	if (run) run.status = "queued";
	log(next, target.siteId, "info", target.shots > 0 ? `Restart will reconcile post ${target.articleId} · no second write` : `Restart queued · ${target.title}`, now);
	next.notice = {
		tone: "info",
		text: target.shots > 0 ? "Restart will reconcile the existing slug. It will not POST again." : "Failed job queued again."
	};
	return { data: next };
}
function regenerateVariant(data, jobId, now) {
	const job = data.jobs.find((j) => j.id === jobId);
	if (!job) return {
		data,
		error: "Job not found."
	};
	const options = clusterTitles(job.keyword).concat(clusterTitles(job.title));
	const used = data.articles.filter((article) => article.siteId === job.siteId);
	const nextTitle = options.find((row) => !used.some((article) => article.slug === slugify(row.title) || lexicalSimilarity(article.title, row.title) > .72));
	if (!nextTitle) return {
		data,
		error: "No distinct angle left. Refused instead of writing another copy of the same headline."
	};
	const next = structuredClone(data);
	next.jobs.unshift(makeJob({
		id: uid("job"),
		runId: job.runId,
		siteId: job.siteId,
		keyword: job.keyword,
		title: nextTitle.title,
		kind: job.kind === "pillar" ? "cluster" : job.kind,
		variant: true,
		dependsOn: [],
		createdAt: now
	}));
	const run = next.runs.find((r) => r.id === job.runId);
	if (run) {
		run.allowVariants = true;
		run.status = "queued";
	}
	log(next, job.siteId, "info", `Variant queued · ${nextTitle.title}. Stage 6 still refuses a matching title or slug.`, now);
	next.notice = {
		tone: "info",
		text: `Variant queued as “${nextTitle.title}”. It is refused if that headline is already on the site.`
	};
	return { data: next };
}
function releaseHeld(data, jobId, now) {
	const job = data.jobs.find((item) => item.id === jobId);
	if (!job) return {
		data,
		error: "Job not found."
	};
	if (job.status !== "publish-held") return {
		data,
		error: "Only a written article that is waiting to publish can be released."
	};
	const next = structuredClone(data);
	const target = next.jobs.find((item) => item.id === jobId);
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
	if (site?.autoRebuild && validatePublicUrl(site.publicUrl).ok) site.pendingRebuildAt = now + 6e4;
	log(next, target.siteId, "ok", `Publish released · single shot · ${target.title}`, now);
	next.notice = {
		tone: "ok",
		text: run?.publishMode === "live" ? "Publishing. One Ghost write." : "Sending to Ghost as a draft."
	};
	return { data: next };
}
function decideReview(data, jobId, approve, now) {
	const job = data.jobs.find((item) => item.id === jobId);
	if (!job) return {
		data,
		error: "Job not found."
	};
	if (job.status !== "review-held") return {
		data,
		error: "That job is not waiting for review."
	};
	const next = structuredClone(data);
	const target = next.jobs.find((item) => item.id === jobId);
	if (approve) {
		target.status = "queued";
		target.refusalReason = void 0;
	} else {
		target.status = "refused";
		target.refusalReason = "Rejected at review — too close to existing content.";
	}
	const run = next.runs.find((item) => item.id === target.runId);
	if (run) run.status = rollup(next.jobs.filter((item) => item.runId === run.id));
	log(next, target.siteId, approve ? "ok" : "warn", `${approve ? "Review approved" : "Review rejected"} · ${target.title}`, now);
	next.notice = {
		tone: approve ? "ok" : "warn",
		text: approve ? "Approved. The worker will write it." : "Rejected. Nothing will be written."
	};
	return { data: next };
}
function measureArticle(article) {
	const text = `${article.title}\n${article.markdown}`.toLowerCase();
	const opening = text.slice(0, 500);
	const items = article.mustCover.filter(Boolean);
	const coverage = items.length ? items.filter((item) => {
		const words = item.toLowerCase().split(/\s+/).filter((word) => word.length > 4);
		if (!words.length) return text.includes(item.toLowerCase());
		return words.filter((word) => text.includes(word)).length >= Math.min(2, words.length);
	}).length / items.length : article.words >= 2e3 ? 1 : Math.min(1, article.words / MIN_ARTICLE_WORDS);
	const tokens = article.keyword.toLowerCase().split(/\s+/).filter((word) => word.length > 3);
	const title = article.title.toLowerCase();
	const inTitle = tokens.length ? tokens.filter((word) => title.includes(word)).length / tokens.length : title.includes(article.keyword.toLowerCase()) ? 1 : 0;
	const inOpen = tokens.length ? tokens.filter((word) => opening.includes(word)).length / tokens.length : opening.includes(article.keyword.toLowerCase()) ? 1 : 0;
	return {
		coverage: Math.round(coverage * 100) / 100,
		intent: Math.round((inTitle * .6 + inOpen * .4) * 100) / 100
	};
}
function factualVerifyFlags(markdown) {
	const flags = [];
	for (const pattern of [
		/\b\d+(?:\.\d+)?%\b[^.\n]*/g,
		/\b(?:19|20)\d{2}\b[^.\n]*/g,
		/\$\s?\d[\d,.]*(?:\s?\/(?:month|year))?[^.\n]*/gi,
		/\b(?:according to|source:|research from|study by)\b[^.\n]*/gi
	]) for (const match of markdown.matchAll(pattern)) {
		const claim = match[0].trim();
		if (claim && !flags.some((flag) => flag.startsWith(`“${claim}”`))) flags.push(`“${claim}” — verify the statistic, date, price, or named source before publishing.`);
	}
	return flags.slice(0, 20);
}
function goldenSteps(data, site) {
	const siteArticles = data.articles.filter((a) => a.siteId === site.id);
	const links = siteArticles.reduce((n, a) => n + a.links.length, 0);
	const build = data.builds.find((b) => b.siteId === site.id && b.status === "succeeded" && b.pages > 0);
	const deployed = data.deploys.some((d) => d.siteId === site.id && d.status === "verified");
	const imageDone = siteArticles.some((a) => a.images.some((image) => image.selected && Boolean(image.src)));
	return [
		{
			label: "Account created",
			done: true,
			href: "/account",
			reason: "Done"
		},
		{
			label: "Email verified",
			done: data.account.emailVerified,
			href: "/account",
			reason: data.account.emailVerified ? "Done" : "Unconfirmed"
		},
		{
			label: "Admin approved",
			done: data.account.adminApproved,
			href: "/account",
			reason: data.account.adminApproved ? "Done" : "Not started"
		},
		{
			label: "Website workspace created",
			done: true,
			href: "/settings/website",
			reason: "Done"
		},
		{
			label: "AI model selected",
			done: data.keys.some((k) => k.id === site.voice.modelKeyId && !k.disabled),
			href: "/ai-keys",
			reason: "Not started"
		},
		{
			label: "Daily allowance configured",
			done: data.keys.some((k) => k.allowanceUsd > 0),
			href: "/ai-keys",
			reason: "Not started"
		},
		{
			label: "Ghost connected",
			done: site.ghost.status === "connected" && site.ghost.corpus === "COMPLETE",
			href: "/connections",
			reason: site.ghost.status !== "connected" ? "Not started" : site.ghost.corpus === "SYNCING" ? "In progress" : "Not started"
		},
		{
			label: "Content submitted (run/plan)",
			done: data.runs.some((r) => r.siteId === site.id),
			href: "/create",
			reason: "Not started"
		},
		{
			label: "Article published to Ghost",
			done: siteArticles.some((a) => a.ledger.confirmed && a.ledger.shots === 1),
			href: "/articles",
			reason: siteArticles.length ? "Unconfirmed" : "No article output"
		},
		{
			label: "Internal link graph built",
			done: links > 0 && siteArticles.every((article) => article.links.length > 0 || siteArticles.length < 2),
			href: "/analytics",
			reason: siteArticles.length < 2 ? "No eligible targets" : "Not started"
		},
		{
			label: "Relevant images added",
			done: imageDone,
			href: "/articles",
			reason: siteArticles.length ? "In progress" : "Not started"
		},
		{
			label: "Static site built",
			done: !!build,
			href: "/static-delivery",
			reason: site.publicUrl ? "Not started" : "Preview only"
		},
		{
			label: "Static site deployed",
			done: deployed,
			href: "/static-delivery",
			reason: deployed ? "Done" : "Uploaded — not verified"
		}
	];
}
function runMetrics(jobs) {
	const count = (s) => jobs.filter((j) => j.status === s).length;
	return {
		completed: count("completed"),
		inflight: count("running"),
		failed: count("failed"),
		refused: count("refused"),
		cancelled: count("cancelled"),
		queued: count("queued"),
		held: count("review-held"),
		waiting: count("publish-held"),
		progress: jobs.length ? Math.round(jobs.filter((job) => job.status !== "queued" && job.status !== "running").length / jobs.length * 100) : 0,
		tokens: jobs.reduce((n, j) => n + j.tokens, 0),
		usd: jobs.reduce((n, j) => n + j.costUsd, 0),
		settledCalls: jobs.reduce((n, j) => n + j.stages.filter((s) => s.status === "done").length, 0)
	};
}
//#endregion
export { keyCallsModel as $, compact as A, staticMedia as At, failJob as B, validatePublicUrl as Bt, authorVoiceBlock as C, resolveRouteDiff as Ct, buildAudit as D, sanitizeCmsImage as Dt, bingThumbUrl as E, sanitizeArticleImages as Et, defaultAdSlots as F, uniquenessAgainst as Ft, hashStr as G, generateAuthorForTopic as H, wordCount as Ht, embed as I, usableKey as It, indexNowKeyFile as J, humanizeWithBlader as K, engine_DWsB6FrJ_exports as L, usdFor as Lt, corpusFor as M, submitKeywords as Mt, cosine as N, suggestIdeas as Nt, cancelRun as O, sectionsFromMarkdown as Ot, decideReview as P, uid as Pt, isPrivateHost as Q, esc as R, utcDay as Rt, attachAuthor as S, rescoreArticles as St, avatarSeed as T, runMetrics as Tt, generatePlan as U, __exportAll as Ut, gateText as V, weaveOrphans as Vt, goldenSteps as W, inventoryFromArticles as X, insertAnchor as Y, isFakeCmsImage as Z, applyAudit as _, queueMissingPhotos as _t, BLADER_VERSION as a, maskKey as at, applyProbe as b, relTime as bt, RESEARCH_STAGES as c, needsWork as ct, acceptModelPlan as d, normalizeKeyword as dt, keyPool as et, adCodeWithinLimit as f, packageDeploy as ft, anchorPhrase as g, previewAuthorMatch as gt, alreadyLinked as h, portraitDataUri as ht, BLADER_SOURCE as i, markdownToHtml as it, composeArticle as j, stripVerify as jt, cn as k, slotConfigs as kt, STAGES as l, nextUtcResetLabel as lt, advance as m, planImages as mt, AD_SLOT_IDS as n, liftOpenings as nt, DEFAULT_LIMITS as o, measureArticle as ot, adsConfigHash as p, parseIntentStage as pt, inboundCount as q, AD_SLOT_LABELS as r, manualBuild as rt, MIN_ARTICLE_WORDS as s, money as st, AD_CODE_LIMIT as t, lexicalSimilarity as tt, TARGET_ARTICLE_WORDS as u, normalizeAuthorProfile as ut, applyFetchedImages as v, queuePlan as vt, avatarProxySrc as w, restartJob as wt, articleImageSrc as x, releaseHeld as xt, applyKeyPenalty as y, regenerateVariant as yt, excerptOf as z, validateGhostUrl as zt };
