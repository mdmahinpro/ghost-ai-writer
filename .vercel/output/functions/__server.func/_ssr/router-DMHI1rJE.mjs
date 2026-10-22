import { i as __toESM } from "../_runtime.mjs";
import { $ as keyCallsModel, C as authorVoiceBlock, Dt as sanitizeCmsImage, Ft as uniquenessAgainst, Ht as wordCount, K as humanizeWithBlader, Ot as sectionsFromMarkdown, Pt as uid, Ut as __exportAll, Y as insertAnchor, Z as isFakeCmsImage, bt as relTime, et as keyPool, h as alreadyLinked, i as BLADER_SOURCE, it as markdownToHtml, jt as stripVerify, k as cn, mt as planImages, s as MIN_ARTICLE_WORDS, tt as lexicalSimilarity, u as TARGET_ARTICLE_WORDS, v as applyFetchedImages, z as excerptOf } from "./engine-DWsB6FrJ.mjs";
import { a as number, c as union, i as literal, o as object, s as string } from "../_libs/zod.mjs";
import { C as require_jsx_runtime, S as useRouter, X as require_react, _ as lazyRouteComponent, b as Link, d as Scripts, f as HeadContent, g as Outlet, h as createRouter, p as useRouterState, v as createFileRoute, x as useNavigate, y as createRootRoute } from "../_libs/@tanstack/react-router+[...].mjs";
import { t as createServerFn } from "./ssr.mjs";
import { a as placeImages, s as submitIndexNow, t as createSsrRpc } from "./ops.functions-CQ9mdiWn.mjs";
import { n as generateDraft, o as scrapePage, s as tavilySearch, t as firecrawlSearch } from "./providers.functions-CtXM7JdH.mjs";
import { r as create } from "../_libs/zustand.mjs";
import { f as runWithKeyPool, g as useVaultPhase, h as useHydrated, i as allowPersistWrites, m as useApp, p as unlockVault } from "./store-CO3BA3x3.mjs";
import { r as withEdgeState } from "./reweave-DcomsvO9.mjs";
import { C as Cable, D as Activity, E as ArchiveRestore, S as CalendarDays, T as Bell, _ as Files, a as SlidersHorizontal, b as ChevronDown, c as Rocket, d as Menu, f as ListTree, g as Globe, h as Inbox, i as TriangleAlert, l as Plus, m as KeyRound, n as Users, o as Settings2, p as LayoutDashboard, r as UserRound, s as Search, t as X, u as PenLine, v as CreditCard, w as BookOpen, x as ChartColumn, y as CircleHelp } from "../_libs/lucide-react.mjs";
//#region node_modules/.nitro/vite/services/ssr/assets/ui-C6LRGx4_.js
var import_react = /* @__PURE__ */ __toESM(require_react());
var import_jsx_runtime = require_jsx_runtime();
function Button({ variant = "primary", className, type = "button", ...props }) {
	return /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
		type,
		className: cn("inline-flex min-h-11 items-center justify-center gap-2 rounded-lg px-5 py-2.5 text-sm font-semibold transition-colors duration-150 disabled:cursor-not-allowed disabled:opacity-45", variant === "primary" && "bg-brass text-ink shadow-sm hover:bg-brass-2", variant === "ghost" && "border border-line/60 bg-surface text-fg hover:border-line-strong hover:bg-surface-2", variant === "danger" && "border border-danger/40 bg-transparent text-danger hover:bg-danger/10", variant === "quiet" && "bg-transparent text-muted hover:text-fg", className),
		...props
	});
}
function Card({ className, children, id }) {
	return /* @__PURE__ */ (0, import_jsx_runtime.jsx)("section", {
		id,
		"data-surface": "card",
		className: cn("rounded-xl border border-line/60 bg-elev p-5 shadow-sm", className),
		children
	});
}
function Badge({ children, tone = "muted" }) {
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", {
		"data-surface": "badge",
		className: cn("inline-flex items-center gap-1.5 rounded-md border px-2 py-0.5 text-xs font-medium leading-5", tone === "ok" && "border-ok/25 bg-ok/10 text-ok", tone === "danger" && "border-danger/25 bg-danger/10 text-danger", tone === "brass" && "border-brass/25 bg-brass/10 text-brass-2", tone === "muted" && "border-line/60 bg-surface-2 text-muted"),
		children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
			"aria-hidden": "true",
			className: "size-1.5 rounded-full bg-current"
		}), children]
	});
}
function statusTone(status) {
	const ok = [
		"completed",
		"succeeded",
		"connected",
		"verified",
		"published",
		"PUBLISHED",
		"done",
		"STATIC_CONFIRMED",
		"GHOST_CONFIRMED",
		"draft-saved"
	];
	const bad = [
		"failed",
		"refused",
		"error",
		"disconnected",
		"BROKEN",
		"FAILED",
		"cancelled"
	];
	const mid = [
		"running",
		"queued",
		"partial",
		"SYNCING",
		"packaged",
		"draft",
		"review",
		"LOCAL",
		"GHOST_PENDING",
		"PLANNED",
		"review-held",
		"publish-held",
		"configured",
		"writing",
		"scheduled",
		"live",
		"cooldown"
	];
	if (ok.includes(status)) return "ok";
	if (bad.includes(status)) return "danger";
	if (mid.includes(status)) return "brass";
	return "muted";
}
function jobBadge(status) {
	return {
		queued: "PENDING",
		running: "RUNNING",
		completed: "COMPLETED",
		failed: "FAILED",
		refused: "DUPLICATE REFUSED",
		cancelled: "CANCELLED",
		"review-held": "REVIEW HELD",
		"publish-held": "PUBLISH HELD"
	}[status] ?? status.replaceAll("-", " ");
}
function Field({ label, hint, children }) {
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("label", {
		className: "block",
		children: [
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
				className: "mb-2 block text-sm font-medium text-fg",
				children: label
			}),
			children,
			hint ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
				className: "mt-1.5 block text-xs leading-5 text-faint",
				children: hint
			}) : null
		]
	});
}
var fieldClass = "min-h-11 w-full rounded-lg border border-line/60 bg-bg px-4 py-2.5 text-sm text-fg outline-none placeholder:text-faint focus:border-brass focus:ring-2 focus:ring-brass/15";
function PageIntro({ eyebrow, title, lede }) {
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("header", {
		className: "mb-8 max-w-prose",
		children: [
			eyebrow ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
				className: "mb-2 text-xs font-semibold uppercase tracking-wider text-brass-2",
				children: eyebrow
			}) : null,
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h1", {
				className: "font-display text-3xl font-semibold tracking-tight text-fg md:text-4xl",
				children: title
			}),
			lede ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
				className: "mt-3 text-[15px] leading-7 text-muted",
				children: lede
			}) : null
		]
	});
}
function Empty({ title, body, action }) {
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
		className: "rounded-xl border border-dashed border-line px-5 py-10 text-center",
		children: [
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h2", {
				className: "font-display text-2xl text-fg",
				children: title
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
				className: "mx-auto mt-2 max-w-md text-sm leading-6 text-muted",
				children: body
			}),
			action ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
				className: "mt-4",
				children: action
			}) : null
		]
	});
}
/** Rule 7: shimmer placeholder. Decorative only — never announced to screen readers. */
function Skeleton({ className }) {
	return /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
		"aria-hidden": "true",
		className: cn("skeleton block h-4 w-full", className)
	});
}
/** A stack of skeleton lines sized like real content rows. */
function SkeletonRows({ rows = 4, className }) {
	return /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
		className: cn("space-y-3", className),
		role: "status",
		"aria-live": "polite",
		"aria-label": "Loading",
		children: Array.from({ length: rows }, (_, index) => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
			className: "rounded-xl border border-line bg-elev/60 p-4",
			children: [
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Skeleton, { className: "h-4 w-1/3" }),
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Skeleton, { className: "mt-3 h-3 w-2/3" }),
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Skeleton, { className: "mt-2 h-3 w-1/2" })
			]
		}, index))
	});
}
/**
* Rule 7: one honest note for the four long-running view states —
* loading, empty, partial, error. Copy is ours; no marketing filler.
*/
function StateNote({ tone, title, body, action }) {
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
		className: cn("rounded-xl border px-4 py-4", tone === "error" ? "border-danger/40 bg-danger/5" : tone === "partial" ? "border-brass/40 bg-brass/5" : "border-line bg-elev/60"),
		role: tone === "error" ? "alert" : "status",
		children: [
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
				className: "flex items-center gap-2",
				children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Badge, {
					tone: tone === "error" ? "danger" : tone === "partial" ? "brass" : "muted",
					children: tone
				}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
					className: "text-sm font-medium text-fg",
					children: title
				})]
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
				className: "mt-2 text-sm leading-6 text-muted",
				children: body
			}),
			action ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
				className: "mt-3",
				children: action
			}) : null
		]
	});
}
//#endregion
//#region node_modules/.nitro/vite/services/ssr/assets/ghost.functions-Bp7ztJJv.js
var ghost_functions_exports = /* @__PURE__ */ __exportAll({
	probePublicUrl: () => probePublicUrl,
	publishGhostPost: () => publishGhostPost,
	syncGhostPosts: () => syncGhostPosts,
	testGhostConnection: () => testGhostConnection,
	updateGhostPostHtml: () => updateGhostPostHtml
});
function readInput(input) {
	const o = input;
	const url = typeof o?.url === "string" ? o.url : "";
	const adminKey = typeof o?.adminKey === "string" ? o.adminKey : "";
	if (!url || !adminKey) throw new Error("Ghost URL and Admin API key are required.");
	if (!/^[a-f0-9]{8,64}:[a-f0-9]{16,128}$/i.test(adminKey.trim())) throw new Error("Admin API key must look like id:secret, hex only. It is not stored.");
	return {
		url,
		adminKey: adminKey.trim()
	};
}
var testGhostConnection = createServerFn({ method: "POST" }).validator(readInput).handler(createSsrRpc("eae7185a3ff74f8e9042eadba3dc4602b7468deaa007e81eacba13448cebcb1b"));
var syncGhostPosts = createServerFn({ method: "POST" }).validator(readInput).handler(createSsrRpc("bbd266faf88d85ad2cfd2f3f833637e6855156a3de6cb47cb034b01efff53b43"));
var probePublicUrl = createServerFn({ method: "POST" }).validator((input) => {
	const url = typeof input?.url === "string" ? input.url : "";
	if (!url) throw new Error("Public URL is required.");
	return { url };
}).handler(createSsrRpc("54bbbc0816cf5d1855364bad106dc9001743730877a621541c5e384c8c5e44d2"));
function readPublish(input) {
	const raw = input;
	const base = readInput(raw);
	const slug = String(raw?.slug ?? "").replace(/[^a-z0-9-]/gi, "").slice(0, 80);
	if (!slug) throw new Error("A slug is required.");
	const images = Array.isArray(raw?.images) ? raw.images.slice(0, 6) : [];
	const rawAuthor = raw?.author;
	return {
		...base,
		author: rawAuthor && typeof rawAuthor.name === "string" ? {
			name: String(rawAuthor.name).slice(0, 120),
			slug: typeof rawAuthor.slug === "string" ? rawAuthor.slug.slice(0, 120) : void 0,
			bio: typeof rawAuthor.bio === "string" ? rawAuthor.bio.slice(0, 400) : void 0,
			profileImage: typeof rawAuthor.profileImage === "string" && /^https:\/\//i.test(rawAuthor.profileImage) ? rawAuthor.profileImage : void 0,
			knownGhostAuthorId: typeof rawAuthor.knownGhostAuthorId === "string" ? rawAuthor.knownGhostAuthorId : void 0
		} : void 0,
		...base,
		title: String(raw?.title ?? "Untitled").slice(0, 200),
		slug,
		html: String(raw?.html ?? "").slice(0, 2e5),
		excerpt: String(raw?.excerpt ?? "").slice(0, 300),
		metaDescription: typeof raw?.metaDescription === "string" && raw.metaDescription.trim() ? raw.metaDescription.trim().slice(0, 155) : void 0,
		status: raw?.status === "published" ? "published" : "draft",
		tags: (Array.isArray(raw?.tags) ? raw.tags : []).map((tag) => String(tag).slice(0, 40)).slice(0, 5),
		images: images.map((image) => {
			const src = typeof image?.src === "string" && !isFakeCmsImage(image.src) ? image.src : void 0;
			const rawRemote = typeof image?.remote === "string" ? image.remote : void 0;
			return {
				src,
				remote: rawRemote ? sanitizeCmsImage(rawRemote, String(image?.alt ?? "")) : void 0,
				role: image?.role === "section" ? "section" : "featured",
				alt: String(image?.alt ?? "").slice(0, 180)
			};
		})
	};
}
var publishGhostPost = createServerFn({ method: "POST" }).validator(readPublish).handler(createSsrRpc("f8948c87b38c0990578588229ff1439a03ee6ef1579465ad59298e6ed29ef8c1"));
function readReWeave(input) {
	const raw = input;
	const base = readInput(raw);
	const html = typeof raw?.html === "string" ? raw.html.slice(0, 4e5) : "";
	if (!html.trim()) throw new Error("Post HTML is required for a re-weave.");
	const postId = typeof raw?.postId === "string" && raw.postId.trim() ? raw.postId.trim().slice(0, 64) : void 0;
	const slug = typeof raw?.slug === "string" && raw.slug.trim() ? raw.slug.trim().replace(/[^a-z0-9-]/gi, "").slice(0, 80) : void 0;
	if (!postId && !slug) throw new Error("A post id or slug is required.");
	return {
		...base,
		postId,
		slug,
		html,
		expectedUpdatedAt: typeof raw?.expectedUpdatedAt === "string" ? raw.expectedUpdatedAt : void 0,
		acknowledgeHandEdited: Boolean(raw?.acknowledgeHandEdited)
	};
}
/**
* Rule 6 — PUT-only re-weave. Reads Ghost's current updated_at, refuses to touch
* a post that changed since our last publish (unless acknowledged), then PUTs the
* new HTML with the lock it just read. Ghost is never asked to create anything.
*/
var updateGhostPostHtml = createServerFn({ method: "POST" }).validator(readReWeave).handler(createSsrRpc("5e83bbd4f61659027274ec2f10bdc171aacff15df6cdc1d89a020cf3d774b200"));
//#endregion
//#region node_modules/.nitro/vite/services/ssr/assets/rewrite-F5_NR5Oa.js
function webSearchPlan(mode, hasTavily, hasFirecrawl) {
	if (mode === "tavily") return ["tavily"];
	if (mode === "firecrawl") return ["firecrawl"];
	if (mode === "auto-fallback") {
		if (hasTavily && hasFirecrawl) return ["tavily", "firecrawl"];
		if (hasTavily) return ["tavily"];
		if (hasFirecrawl) return ["firecrawl"];
		return [];
	}
	return [];
}
var COOLDOWN_MS = 3e5;
function config() {
	return useApp.getState().webSearch;
}
function markSuccess(key) {
	useApp.getState().setWebSearchKey(key.id, {
		failCount: 0,
		lastError: void 0,
		lastUsedAt: Date.now()
	});
}
function markFailure(key, status, error) {
	const dead = status === 401 || status === 403;
	useApp.getState().setWebSearchKey(key.id, {
		failCount: key.failCount + 1,
		disabled: dead || key.failCount + 1 >= 4,
		cooldownUntil: status === 429 || status >= 500 || status === 0 ? Date.now() + COOLDOWN_MS : key.cooldownUntil,
		lastError: error
	});
}
/**
* Rule 5 — unified live web search.
* Mode Off returns nothing. Tavily / Firecrawl run their own pool in failover
* order. Auto-Fallback tries Tavily then Firecrawl, whichever keys exist.
*/
async function searchWeb(query, maxResults = 5) {
	const cfg = config();
	const trimmed = query.trim();
	if (!trimmed) return {
		results: [],
		errors: []
	};
	const plan = webSearchPlan(cfg.mode, cfg.tavilyKeys.length > 0, cfg.firecrawlKeys.length > 0);
	const errors = [];
	for (const provider of plan) {
		const key = useApp.getState().takeWebSearchKey(provider);
		if (!key) {
			errors.push(`${provider}: no live key available`);
			continue;
		}
		const result = provider === "tavily" ? await tavilySearch({ data: {
			apiKey: key.secret,
			query: trimmed,
			maxResults
		} }) : await firecrawlSearch({ data: {
			apiKey: key.secret,
			query: trimmed,
			maxResults
		} });
		if (result.ok) {
			markSuccess(key);
			return {
				results: result.results.map((row) => ({
					...row,
					provider
				})),
				errors
			};
		}
		markFailure(key, result.status ?? 0, result.error);
		errors.push(`${provider}: ${result.error}`);
	}
	return {
		results: [],
		errors
	};
}
/**
* Rule 5 — scrape one URL. Uses the Firecrawl pool (page fetch is Firecrawl's
* strength). Respects the switch: Off refuses so the operator knows why nothing
* was fetched.
*/
async function scrapeSource(url) {
	const cfg = config();
	if (cfg.mode === "off") return {
		ok: false,
		error: "Web search is Off. Turn it on in Settings → AI Keys & Usage to fetch live sources."
	};
	if (!cfg.firecrawlKeys.length) return {
		ok: false,
		error: "No Firecrawl key saved. Add one to scrape live sources."
	};
	let last = "No Firecrawl key answered.";
	for (let index = 0; index < cfg.firecrawlKeys.length; index++) {
		const key = useApp.getState().takeWebSearchKey("firecrawl");
		if (!key) break;
		const result = await scrapePage({ data: {
			apiKey: key.secret,
			url
		} });
		if (result.ok) {
			markSuccess(key);
			return {
				ok: true,
				title: result.title,
				markdown: result.markdown,
				provider: "firecrawl"
			};
		}
		last = result.error;
		markFailure(key, 0, result.error);
	}
	return {
		ok: false,
		error: last
	};
}
var rewrite_exports = /* @__PURE__ */ __exportAll({
	articleFromMarkdown: () => articleFromMarkdown,
	ensureMarkdownLinks: () => ensureMarkdownLinks,
	humanizeMarkdown: () => humanizeMarkdown,
	keyPoolChat: () => keyPoolChat,
	proposePlan: () => proposePlan,
	researchDigest: () => researchDigest,
	siteChat: () => siteChat,
	writeWithModel: () => writeWithModel
});
/**
* Build the blader/humanizer LLM transport from the studio's AI key pool:
* sequential auto-failover through `runWithKeyPool`, metering `generateDraft`.
*/
function keyPoolChat(input) {
	return async (system, user) => {
		const outcome = await runWithKeyPool({
			keys: input.keys,
			onPenalty: input.onPenalty ?? (() => {}),
			call: async (key) => {
				const result = await generateDraft({ data: {
					baseUrl: key.baseUrl,
					apiKey: key.secret,
					model: key.model,
					system,
					user
				} });
				if (result.ok) return {
					ok: true,
					value: result
				};
				return {
					ok: false,
					status: result.status ?? 0,
					error: result.error
				};
			}
		});
		if (!outcome.ok) return {
			ok: false,
			error: outcome.error
		};
		return {
			ok: true,
			text: outcome.value.text,
			keyId: outcome.keyId,
			usage: outcome.value.usage
		};
	};
}
/** Convenience: the active site's usable model pool as a BladerChat transport. */
function siteChat(onPenalty) {
	const state = useApp.getState();
	const site = state.sites.find((item) => item.id === state.activeSiteId);
	return keyPoolChat({
		keys: keyPool(state, site?.voice.modelKeyId, Date.now()).filter((key) => keyCallsModel(key)),
		onPenalty
	});
}
/**
* Humanization entry point used by the live-writer bulletproof pass.
* Delegates to the native blader/humanizer engine (deterministic pass +
* two-pass LLM surgical rewrite through the studio's AI key pool, in the
* assigned author's voice). The external Metric37 API is gone.
*/
async function humanizeMarkdown(markdown, bulletproof) {
	const state = useApp.getState();
	const site = state.sites.find((item) => item.id === state.activeSiteId);
	const result = await humanizeWithBlader({
		markdown,
		chat: siteChat(),
		authorBannedPhrases: site?.voice.bannedPhrases ?? []
	});
	return {
		markdown: result.markdown,
		note: bulletproof ? `${result.note} · score ${result.score}` : result.note
	};
}
async function researchDigest(urls, query) {
	if (useApp.getState().webSearch.mode === "off") return "";
	const notes = [];
	const list = urls.map((url) => url.trim()).filter(Boolean).slice(0, 5);
	if (list.length) for (const url of list.slice(0, 3)) {
		const result = await scrapeSource(url);
		if (!result.ok) {
			notes.push(`Source failed (${url}): ${result.error}`);
			continue;
		}
		notes.push(`Source: ${result.title}\n${result.markdown}`);
	}
	else if (query?.trim()) {
		const { results, errors } = await searchWeb(query, 5);
		for (const row of results.slice(0, 3)) notes.push(`Source: ${row.title} (${row.provider})\n${row.url}\n${row.snippet}`);
		if (!results.length && errors.length) notes.push(`Web search failed: ${errors.join("; ")}`);
	}
	return notes.join("\n\n").slice(0, 7e3);
}
async function writeWithModel(input) {
	const linkList = input.links.map((link) => `- [${link.anchor}](/post/${link.slug}/)`).join("\n") || "- none yet";
	const avoid = input.avoid.slice(0, 12).map((title) => `- ${title}`).join("\n") || "- none";
	const system = [
		input.authorVoice ? `You write as this assigned author. Stay inside their expertise, rhythm, diction, signature moves, and banned phrases so the byline reads like a distinct human:\n${input.authorVoice}` : `You write as ${input.authorName}, a US staff writer.`,
		"Return markdown only. No preamble.",
		"Use 5 ## headings. Each heading names one concrete decision. Do not use Introduction, Conclusion, or the article title as a heading.",
		`Write at least ${MIN_ARTICLE_WORDS} words (aim ${TARGET_ARTICLE_WORDS}). Answer the title in the first two sentences. Short sentences. No fake statistics, no 'delve', no 'tapestry'.`,
		"Do not copy the research notes. Use only facts you can phrase yourself. Never write a [verify] tag or a source placeholder.",
		"The page must take a different angle from the titles listed under Avoid.",
		"If links are provided, mention each anchor once as a markdown link using the exact href. Do not invent URLs. Do not add images."
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
		input.research ? `Research notes:\n${input.research}` : "No scraped sources. Stay concrete and modest."
	].join("\n");
	const outcome = await runWithKeyPool({
		keys: input.keys,
		onPenalty: (keyId, status, error) => useApp.getState().penalizeKey(keyId, status, error),
		call: async (key) => {
			const result = await generateDraft({ data: {
				baseUrl: key.baseUrl,
				apiKey: key.secret,
				model: key.model,
				system,
				user
			} });
			if (result.ok) return {
				ok: true,
				value: result.text
			};
			return {
				ok: false,
				status: result.status ?? 0,
				error: result.error
			};
		}
	});
	if (!outcome.ok) throw new Error(outcome.error);
	return {
		markdown: outcome.value,
		keyId: outcome.keyId
	};
}
async function proposePlan(input) {
	const request = (more) => runWithKeyPool({
		keys: input.keys,
		onPenalty: (keyId, status, error) => useApp.getState().penalizeKey(keyId, status, error),
		call: async (key) => {
			const result = await generateDraft({ data: {
				baseUrl: key.baseUrl,
				apiKey: key.secret,
				model: key.model,
				system: [
					"You plan a pillar page and supporting articles for one website.",
					"Return JSON only, no markdown fence.",
					"{\"pillar\":\"headline\",\"clusters\":[{\"title\":\"headline\",\"blurb\":\"one sentence\"}]}",
					more ? "The first response was too short. Return at least 6 and at most 10 genuinely distinct clusters now." : "Write 8 clusters. Each title is a different decision a reader can finish.",
					"Do not paste the operator topic into every title.",
					"No tips, tools, challenges, or 'how to do X effectively'."
				].join(" "),
				user: `Topic: ${input.topic}`
			} });
			if (result.ok) return {
				ok: true,
				value: result.text
			};
			return {
				ok: false,
				status: result.status ?? 0,
				error: result.error
			};
		}
	});
	for (const more of [false, true]) {
		const outcome = await request(more);
		if (!outcome.ok) return null;
		const raw = outcome.value.replace(/```json|```/gi, "");
		const start = raw.indexOf("{");
		const end = raw.lastIndexOf("}");
		if (start < 0 || end <= start) continue;
		try {
			const parsed = JSON.parse(raw.slice(start, end + 1));
			const clusters = (parsed.clusters ?? []).map((row) => ({
				title: String(row.title ?? "").trim(),
				blurb: String(row.blurb ?? "").trim()
			})).filter((row) => row.title).slice(0, 10);
			if (parsed.pillar && clusters.length >= 6) return {
				pillar: parsed.pillar.trim(),
				clusters
			};
		} catch {}
	}
	return null;
}
function articleFromMarkdown(markdown) {
	return {
		markdown,
		html: markdownToHtml(markdown),
		excerpt: excerptOf(markdown),
		words: wordCount(markdown)
	};
}
function ensureMarkdownLinks(markdown, links) {
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
//#endregion
//#region node_modules/.nitro/vite/services/ssr/assets/theme-picker-Dn2JPEjD.js
/**
* Rule 7 — custom theme system.
* Six hand-built themes, all our own. Each one must define the COMPLETE token
* set (styles.css mirrors these values under `html[data-theme="…"]`, and the
* release gate test compares the two so they can never drift).
*/
var THEMES = [
	{
		id: "midnight",
		label: "Midnight",
		canvas: "#09090b",
		accent: "#818cf8"
	},
	{
		id: "paper",
		label: "Paper",
		canvas: "#fafafa",
		accent: "#4338ca"
	},
	{
		id: "forest",
		label: "Forest",
		canvas: "#0c1410",
		accent: "#3ecf8e"
	},
	{
		id: "rose",
		label: "Rose",
		canvas: "#fbf4f6",
		accent: "#be3a5a"
	},
	{
		id: "sepia",
		label: "Sepia",
		canvas: "#f4efe4",
		accent: "#8a5424"
	},
	{
		id: "ocean",
		label: "Ocean",
		canvas: "#06141c",
		accent: "#2aa7c9"
	}
];
function readStoredTheme() {
	try {
		const saved = localStorage.getItem("gaw-theme");
		if (saved === "light") return "paper";
		if (saved === "dark" || saved == null || saved === "") return "midnight";
		if (THEMES.some((theme) => theme.id === saved)) return saved;
	} catch {}
	return "midnight";
}
function applyTheme(id) {
	const theme = THEMES.find((item) => item.id === id) ?? THEMES[0];
	document.documentElement.dataset.theme = theme.id;
	document.documentElement.classList.remove("light");
	try {
		localStorage.setItem("gaw-theme", theme.id);
	} catch {}
	document.querySelector("meta[name=\"theme-color\"]")?.setAttribute("content", theme.canvas);
	window.dispatchEvent(new Event("gaw-theme"));
}
function ThemePicker({ variant = "menu" }) {
	const [theme, setTheme] = (0, import_react.useState)("midnight");
	const [open, setOpen] = (0, import_react.useState)(false);
	const root = (0, import_react.useRef)(null);
	(0, import_react.useLayoutEffect)(() => {
		const id = readStoredTheme();
		applyTheme(id);
		setTheme(id);
	}, []);
	(0, import_react.useEffect)(() => {
		function sync() {
			setTheme(readStoredTheme());
		}
		window.addEventListener("gaw-theme", sync);
		return () => window.removeEventListener("gaw-theme", sync);
	}, []);
	(0, import_react.useEffect)(() => {
		if (!open) return;
		function close(event) {
			if (!root.current?.contains(event.target)) setOpen(false);
		}
		document.addEventListener("mousedown", close);
		return () => document.removeEventListener("mousedown", close);
	}, [open]);
	function choose(id) {
		applyTheme(id);
		setTheme(id);
		setOpen(false);
	}
	if (variant === "section") return /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
		className: "grid gap-2 sm:grid-cols-2 lg:grid-cols-3",
		children: THEMES.map((item) => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("button", {
			type: "button",
			onClick: () => choose(item.id),
			"aria-pressed": theme === item.id,
			className: `flex min-h-11 items-center gap-3 rounded-lg border px-3 py-2 text-left text-sm ${theme === item.id ? "border-brass bg-brass/10" : "border-line"}`,
			children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", {
				className: "flex shrink-0 -space-x-1",
				children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
					className: "size-5 rounded-full border border-line",
					style: { background: item.canvas }
				}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
					className: "size-5 rounded-full border border-line",
					style: { background: item.accent }
				})]
			}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { children: item.label })]
		}, item.id))
	});
	const current = THEMES.find((item) => item.id === theme) ?? THEMES[0];
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
		className: "relative",
		ref: root,
		children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
			type: "button",
			className: "grid size-11 place-items-center rounded-lg border border-line",
			"aria-label": "Theme",
			"aria-expanded": open,
			"aria-haspopup": "listbox",
			onClick: () => setOpen((value) => !value),
			children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
				className: "size-4 rounded-full border border-line",
				style: { background: current.accent }
			})
		}), open ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
			className: "absolute right-0 top-12 z-30 w-48 rounded-xl border border-line bg-elev p-1",
			role: "listbox",
			"aria-label": "Themes",
			children: THEMES.map((item) => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("button", {
				type: "button",
				role: "option",
				"aria-selected": theme === item.id,
				onClick: () => choose(item.id),
				className: `flex min-h-11 w-full items-center gap-2 rounded-lg px-2 text-left text-sm ${theme === item.id ? "bg-surface text-fg" : "text-muted"}`,
				children: [
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
						className: "size-4 shrink-0 rounded-full border border-line",
						style: { background: item.canvas }
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
						className: "size-2 shrink-0 rounded-full",
						style: { background: item.accent }
					}),
					item.label
				]
			}, item.id))
		}) : null]
	});
}
//#endregion
//#region node_modules/.nitro/vite/services/ssr/assets/router-DMHI1rJE.js
var FALLBACK_MESSAGE = "An unexpected error occurred. Try reloading the page.";
function errorMessage(error) {
	if (error instanceof Error && error.message) return error.message;
	if (typeof error === "string" && error) return error;
	return FALLBACK_MESSAGE;
}
var AppCrashBoundary = class extends import_react.Component {
	state = { error: null };
	static getDerivedStateFromError(error) {
		return { error };
	}
	componentDidCatch(error, errorInfo) {
		console.error("[GAW_CRASH]", error.message, errorInfo.componentStack);
		window.__lastCrash = {
			message: error.message,
			stack: error.stack,
			componentStack: errorInfo.componentStack
		};
	}
	render() {
		if (this.state.error) return /* @__PURE__ */ (0, import_jsx_runtime.jsx)(ErrorView, { error: this.state.error });
		return this.props.children;
	}
};
function ErrorView({ error }) {
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("main", {
		className: "flex min-h-screen flex-col items-center justify-center gap-3 bg-bg px-6 text-center text-fg",
		children: [
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
				className: "text-danger",
				"aria-hidden": "true",
				children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(TriangleAlert, {
					className: "size-10",
					strokeWidth: 2
				})
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h1", {
				className: "font-display text-3xl",
				children: "Something went wrong"
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
				className: "max-w-md text-sm break-words text-muted",
				children: errorMessage(error)
			})
		]
	});
}
function AppErrorComponent({ error }) {
	return /* @__PURE__ */ (0, import_jsx_runtime.jsx)(ErrorView, { error });
}
/**
* App-wide client provider mounted once near the root (in `src/routes/__root.tsx`):
*
*   <AuthProvider><Outlet /></AuthProvider>
*
* Better Auth's React client (`@/lib/auth/client`) needs NO context provider —
* its `useSession()` works standalone — so this is a passthrough today. It's
* kept as the single, stable mount point for any future client-side providers
* (e.g. a toast or theme provider) without churning the root shell.
*/
function AuthProvider({ children }) {
	return /* @__PURE__ */ (0, import_jsx_runtime.jsx)(import_jsx_runtime.Fragment, { children });
}
var CONNECTOR_TOKEN_READY_EVENT = "grok:connector-token-ready";
function isGrokEmbedderOrigin(origin) {
	try {
		const url = new URL(origin);
		if (url.protocol !== "https:" && url.protocol !== "http:") return false;
		const host = url.hostname.toLowerCase();
		if (host === "grok.com" || host.endsWith(".grok.com")) return true;
		if (host === "localhost" || host === "127.0.0.1" || host === "[::1]") return true;
		return false;
	} catch {
		return false;
	}
}
function isSandboxPreviewGuestHost(hostname) {
	const host = hostname.toLowerCase();
	return host === "grok-sandbox.com" || host.endsWith(".grok-sandbox.com");
}
function isRemintPreviewPair(guestHost, parentHost) {
	const guest = guestHost.toLowerCase();
	const parent = parentHost.toLowerCase();
	const i = guest.indexOf(".preview.");
	if (i <= 0) return false;
	const label = guest.slice(0, i);
	const rest = guest.slice(i + 9);
	if (label.includes(".") || !rest.includes(".")) return false;
	return parent === rest || parent === `grok.${rest}`;
}
function resolveParentEmbedderOrigin(parentIsSelf, referrer, ancestorOrigin, guestHostname = "") {
	if (parentIsSelf) return null;
	for (const candidate of [referrer, ancestorOrigin ?? ""].filter(Boolean)) try {
		const url = new URL(candidate.includes("://") ? candidate : `https://${candidate}`);
		if (url.protocol !== "https:" && url.protocol !== "http:") continue;
		if (isGrokEmbedderOrigin(url.origin)) return url.origin;
		if (isSandboxPreviewGuestHost(guestHostname) || isRemintPreviewPair(guestHostname, url.hostname)) return url.origin;
	} catch {}
	return null;
}
/**
* Guest side of the grok-web ↔ sandbox preview postMessage bridge.
*
* Activates only when this page is framed by an allowlisted Grok embedder.
* Top-level runs (download/export, local `npm run dev`, deployed sites) noop.
*/
var PREVIEW_BRIDGE_CHANNEL = "grok-preview-bridge";
var EnvelopeSchema = object({
	channel: literal(PREVIEW_BRIDGE_CHANNEL),
	version: number().int().positive(),
	type: string().min(1)
});
var HelloSchema = EnvelopeSchema.extend({ type: literal("hello") });
var NavigateSchema = EnvelopeSchema.extend({
	type: literal("navigate"),
	path: string().min(1)
});
var HistorySchema = EnvelopeSchema.extend({
	type: literal("history"),
	delta: union([literal(-1), literal(1)])
});
var ConnectorTokenReadySchema = EnvelopeSchema.extend({ type: literal("connector-token-ready") });
function isSafeBridgePath(path) {
	if (!path.startsWith("/") || path.startsWith("//") || path.includes("\\")) return false;
	try {
		return new URL(path, "https://preview.invalid").origin === "https://preview.invalid";
	} catch {
		return false;
	}
}
/**
* Origin of the Grok embedder framing this page, or null when the page runs
* top-level (download/export, local `npm run dev`, deployed sites) or under a
* non-Grok parent. Client-only; null during SSR.
*/
function resolveCurrentEmbedderOrigin() {
	if (typeof window === "undefined") return null;
	const ancestorOrigin = typeof location.ancestorOrigins !== "undefined" && location.ancestorOrigins.length > 0 ? location.ancestorOrigins[0] : null;
	return resolveParentEmbedderOrigin(window.parent === window, document.referrer, ancestorOrigin, window.location.hostname);
}
/**
* Install host↔guest messaging. Returns a dispose function.
* Noops (returns a no-op dispose) when not embedded under a Grok parent.
*/
function installPreviewHostBridge(options = {}) {
	const parentOrigin = resolveCurrentEmbedderOrigin();
	if (parentOrigin === null) return () => {};
	const ROOT_STATE_KEY = "__grokPreviewBridgeRoot";
	const originalPushState = window.history.pushState.bind(window.history);
	const originalReplaceState = window.history.replaceState.bind(window.history);
	const isAtHistoryRoot = () => {
		const state = window.history.state;
		return Boolean(state && typeof state === "object" && state[ROOT_STATE_KEY] === true);
	};
	try {
		const current = window.history.state;
		if (!(current !== null && typeof current === "object" && Object.prototype.hasOwnProperty.call(current, ROOT_STATE_KEY))) {
			const isRoot = window.history.length <= 1;
			originalReplaceState(current && typeof current === "object" ? {
				...current,
				[ROOT_STATE_KEY]: isRoot
			} : { [ROOT_STATE_KEY]: isRoot }, "", window.location.href);
		}
	} catch {}
	const post = (message) => {
		window.parent.postMessage(message, parentOrigin);
	};
	const reportLocation = () => {
		post({
			channel: PREVIEW_BRIDGE_CHANNEL,
			version: 1,
			type: "location",
			path: window.location.pathname || "/",
			search: window.location.search,
			hash: window.location.hash
		});
	};
	const reportRoutes = () => {
		const paths = options.getRoutePaths?.() ?? [];
		post({
			channel: PREVIEW_BRIDGE_CHANNEL,
			version: 1,
			type: "routes",
			paths
		});
	};
	const defaultNavigate = (path) => {
		if (!isSafeBridgePath(path)) return;
		try {
			const url = new URL(path, window.location.origin);
			if (url.origin !== window.location.origin) return;
			const next = `${url.pathname}${url.search}${url.hash}`;
			window.history.pushState(window.history.state, "", next);
			window.dispatchEvent(new PopStateEvent("popstate", { state: window.history.state }));
		} catch {}
	};
	const navigate = (path) => {
		if (!isSafeBridgePath(path)) return;
		if (options.navigate) {
			options.navigate(path);
			return;
		}
		defaultNavigate(path);
	};
	const announce = () => {
		reportLocation();
		reportRoutes();
		post({
			channel: PREVIEW_BRIDGE_CHANNEL,
			version: 1,
			type: "ready"
		});
	};
	const onHello = (data) => {
		if (!HelloSchema.safeParse(data).success) return;
		announce();
	};
	const onNavigate = (data) => {
		const parsed = NavigateSchema.safeParse(data);
		if (!parsed.success) return;
		navigate(parsed.data.path);
		queueMicrotask(reportLocation);
	};
	const onHistory = (data) => {
		const parsed = HistorySchema.safeParse(data);
		if (!parsed.success) return;
		if (parsed.data.delta === -1 && isAtHistoryRoot()) return;
		window.history.go(parsed.data.delta);
	};
	const onConnectorTokenReady = (data) => {
		if (!ConnectorTokenReadySchema.safeParse(data).success) return;
		window.dispatchEvent(new Event(CONNECTOR_TOKEN_READY_EVENT));
	};
	const hostMessageHandlers = /* @__PURE__ */ new Map([
		["hello", onHello],
		["navigate", onNavigate],
		["history", onHistory],
		["connector-token-ready", onConnectorTokenReady]
	]);
	const onMessage = (event) => {
		if (event.source !== window.parent) return;
		if (event.origin !== parentOrigin) return;
		const envelope = EnvelopeSchema.safeParse(event.data);
		if (!envelope.success || envelope.data.version !== 1) return;
		hostMessageHandlers.get(envelope.data.type)?.(event.data);
	};
	const onPopState = () => {
		reportLocation();
	};
	const onHashChange = () => {
		reportLocation();
	};
	window.history.pushState = (data, unused, url) => {
		const next = data && typeof data === "object" ? {
			...data,
			[ROOT_STATE_KEY]: false
		} : data;
		originalPushState(next, unused, url);
		reportLocation();
	};
	window.history.replaceState = (data, unused, url) => {
		const next = isAtHistoryRoot() ? {
			...data && typeof data === "object" ? data : {},
			[ROOT_STATE_KEY]: true
		} : data;
		originalReplaceState(next, unused, url);
		reportLocation();
	};
	window.addEventListener("message", onMessage);
	window.addEventListener("popstate", onPopState);
	window.addEventListener("hashchange", onHashChange);
	announce();
	return () => {
		window.removeEventListener("message", onMessage);
		window.removeEventListener("popstate", onPopState);
		window.removeEventListener("hashchange", onHashChange);
		window.history.pushState = originalPushState;
		window.history.replaceState = originalReplaceState;
	};
}
/** Collect static path patterns from a TanStack route tree (best-effort). */
function collectRoutePathsFromTree(routeTree) {
	const paths = /* @__PURE__ */ new Set();
	const walk = (node) => {
		if (!node || typeof node !== "object") return;
		const record = node;
		const full = typeof record.fullPath === "string" ? record.fullPath : typeof record.path === "string" ? record.path : null;
		if (full !== null && full !== "") paths.add(full.startsWith("/") ? full : `/${full}`);
		else if (full === "") paths.add("/");
		const children = record.children;
		if (Array.isArray(children)) for (const child of children) walk(child);
		else if (children && typeof children === "object") for (const child of Object.values(children)) walk(child);
	};
	walk(routeTree);
	return [...paths];
}
/**
* Mount once in `__root.tsx` so the Grok preview chrome can drive navigation
* (and later receive registered routes). Noops when the app is not embedded.
*/
function PreviewHostBridge() {
	const router = useRouter();
	(0, import_react.useEffect)(() => {
		return installPreviewHostBridge({
			navigate: (path) => {
				router.history.push(path);
			},
			getRoutePaths: () => collectRoutePathsFromTree(router.routeTree)
		});
	}, [router]);
	return null;
}
var AREAS$1 = [
	{
		id: "workspaces",
		group: "Workspace",
		href: "/workspaces",
		label: "Websites",
		icon: "Globe"
	},
	{
		id: "overview",
		group: "Content",
		href: "/",
		label: "Overview",
		icon: "LayoutDashboard"
	},
	{
		id: "create",
		group: "Content",
		href: "/create",
		label: "Create",
		icon: "PenLine"
	},
	{
		id: "topic-plans",
		group: "Content",
		href: "/topic-plans",
		label: "Topic Plans",
		icon: "ListTree"
	},
	{
		id: "research",
		group: "Content",
		href: "/research",
		label: "Research",
		icon: "BookOpen"
	},
	{
		id: "calendar",
		group: "Content",
		href: "/calendar",
		label: "Calendar",
		icon: "CalendarDays"
	},
	{
		id: "runs",
		group: "Content",
		href: "/runs",
		label: "Runs",
		icon: "Activity"
	},
	{
		id: "articles",
		group: "Content",
		href: "/articles",
		label: "Articles",
		icon: "Files"
	},
	{
		id: "analytics",
		group: "Website",
		href: "/analytics",
		label: "Analytics",
		icon: "ChartColumn"
	},
	{
		id: "connections",
		group: "Website",
		href: "/connections",
		label: "Connections",
		icon: "Cable"
	},
	{
		id: "static-delivery",
		group: "Website",
		href: "/static-delivery",
		label: "Static Delivery",
		icon: "Rocket"
	},
	{
		id: "authors",
		group: "Website",
		href: "/authors",
		label: "Authors & Bylines",
		icon: "Users"
	},
	{
		id: "ai-keys",
		group: "Settings",
		href: "/ai-keys",
		label: "AI Keys & Usage",
		icon: "KeyRound"
	},
	{
		id: "content-defaults",
		group: "Settings",
		href: "/settings/content",
		label: "Content Defaults",
		icon: "SlidersHorizontal"
	},
	{
		id: "website-settings",
		group: "Settings",
		href: "/settings/website",
		label: "Website Settings",
		icon: "Settings2"
	},
	{
		id: "backup",
		group: "Settings",
		href: "/settings/website#backup",
		label: "Backup & Recovery",
		icon: "ArchiveRestore"
	},
	{
		id: "inbox",
		group: "Settings",
		href: "/inbox",
		label: "Funding / Inbox",
		icon: "Inbox"
	},
	{
		id: "account",
		group: "Account",
		href: "/account",
		label: "Account",
		icon: "UserRound"
	},
	{
		id: "billing",
		group: "Account",
		href: "/billing",
		label: "Billing & Plan",
		icon: "CreditCard"
	},
	{
		id: "help",
		group: "Account",
		href: "/help",
		label: "Help",
		icon: "CircleHelp"
	}
];
var SHELL_GROUPS$1 = [
	"Workspace",
	"Content",
	"Website",
	"Settings",
	"Account"
];
var NAV_AREAS = AREAS$1;
var PALETTE_ACTIONS$1 = [
	{
		id: "new-batch",
		label: "New Keyword Batch",
		hint: "Action",
		href: "/create",
		build: false
	},
	{
		id: "new-research",
		label: "New Research Project",
		hint: "Action",
		href: "/research",
		build: false
	},
	{
		id: "calendar-automation",
		label: "Open Calendar Automation",
		hint: "Action",
		href: "/calendar",
		build: false
	},
	{
		id: "build-static",
		label: "Build Static Site",
		hint: "Action",
		href: "/static-delivery",
		build: true
	}
];
function UnlockGate() {
	const [pass, setPass] = (0, import_react.useState)("");
	const [error, setError] = (0, import_react.useState)("");
	const [busy, setBusy] = (0, import_react.useState)(false);
	return /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
		className: "grid min-h-screen place-items-center bg-bg p-6 text-fg",
		children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Card, {
			className: "w-full max-w-md p-6",
			children: [
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h1", {
					className: "font-display text-3xl",
					children: "Unlock the studio"
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
					className: "mt-2 text-sm leading-6 text-muted",
					children: "The saved workspace is encrypted. This browser keeps a salt and a check, not the passphrase."
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("form", {
					className: "mt-4",
					onSubmit: (event) => {
						event.preventDefault();
						if (pass.length < 8 || busy) return;
						setBusy(true);
						setError("");
						unlockVault(pass).then((message) => {
							setBusy(false);
							if (message) setError(message);
						});
					},
					children: [
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Field, {
							label: "Passphrase",
							children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)("input", {
								className: fieldClass,
								type: "password",
								autoFocus: true,
								value: pass,
								onChange: (event) => setPass(event.target.value),
								placeholder: "At least 8 characters",
								autoComplete: "current-password"
							})
						}),
						error ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
							className: "mt-2 text-sm text-danger",
							children: error
						}) : null,
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Button, {
							className: "mt-3",
							type: "submit",
							disabled: busy || pass.length < 8,
							children: busy ? "Checking…" : "Unlock"
						})
					]
				})
			]
		})
	});
}
function LiveWriter() {
	const stateRef = (0, import_react.useRef)(useApp.getState());
	const busy = (0, import_react.useRef)(/* @__PURE__ */ new Set());
	const cooldown = (0, import_react.useRef)(/* @__PURE__ */ new Map());
	const active = useApp((s) => s.articles.some((item) => item.liveState === "pending" || item.liveState === "running"));
	(0, import_react.useEffect)(() => {
		if (!active) return;
		const pass = () => {
			stateRef.current = useApp.getState();
			const { articles, jobs, runs } = stateRef.current;
			const waiting = articles.filter((item) => item.liveState === "pending" || item.liveState === "running");
			const skipIds = waiting.filter((item) => {
				if (busy.current.has(item.id)) return false;
				const job = jobs.find((row) => row.id === item.jobId);
				const run = runs.find((row) => row.id === job?.runId);
				return keyPool(useApp.getState(), run?.modelKeyId, Date.now()).length === 0;
			}).map((item) => item.id);
			if (skipIds.length) {
				const skip = new Set(skipIds);
				useApp.setState((s) => ({ articles: s.articles.map((article) => skip.has(article.id) ? {
					...article,
					liveState: "skipped"
				} : article) }));
				return;
			}
			const article = waiting.find((item) => !busy.current.has(item.id));
			if (!article) return;
			const job = jobs.find((item) => item.id === article.jobId);
			const run = runs.find((item) => item.id === job?.runId);
			const pool = keyPool(useApp.getState(), run?.modelKeyId, Date.now()).filter((key) => keyCallsModel(key));
			if (!pool.length) return;
			if (Date.now() < (cooldown.current.get(article.id) ?? 0)) return;
			busy.current.add(article.id);
			useApp.getState().patchArticle(article.id, {
				liveState: "running",
				liveError: void 0
			});
			(async () => {
				try {
					await writeArticleFromPool(article, job, run, pool);
				} catch (error) {
					useApp.getState().patchArticle(article.id, {
						liveState: "error",
						liveError: error instanceof Error ? error.message : "Live generation failed."
					});
				} finally {
					cooldown.current.set(article.id, Date.now() + 500);
					window.setTimeout(() => busy.current.delete(article.id), 500);
				}
			})();
		};
		pass();
		const timer = window.setInterval(pass, 1500);
		return () => window.clearInterval(timer);
	}, [active]);
	return null;
}
async function writeArticleFromPool(article, job, run, pool) {
	const research = await researchDigest(run?.researchUrls ?? [], article.title);
	const author = useApp.getState().authors.find((item) => item.id === article.authorId) ?? useApp.getState().authors.find((item) => item.id === job?.authorId);
	const written = await writeWithModel({
		keys: pool,
		keyword: article.keyword,
		title: article.title,
		authorName: author?.name ?? article.authorName ?? "the desk",
		authorVoice: author ? authorVoiceBlock(author) : void 0,
		links: article.links.map((link) => ({
			anchor: link.anchor,
			slug: link.targetSlug
		})),
		avoid: useApp.getState().articles.filter((item) => item.siteId === article.siteId && item.id !== article.id).map((item) => item.title),
		research
	});
	if (job) useApp.setState((s) => ({ jobs: s.jobs.map((row) => row.id === job.id ? {
		...row,
		keyId: written.keyId
	} : row) }));
	let markdown = written.markdown;
	let humanNote;
	let humanized = false;
	if (article.bulletproof || run?.bulletproof) {
		const human = await humanizeMarkdown(markdown, true);
		markdown = human.markdown;
		humanNote = human.note;
		humanized = true;
	}
	markdown = stripVerify(ensureMarkdownLinks(markdown, article.links.map((link) => ({
		anchor: link.anchor,
		slug: link.targetSlug
	}))));
	const body = articleFromMarkdown(markdown);
	const sections = sectionsFromMarkdown(markdown);
	const site = useApp.getState().sites.find((item) => item.id === article.siteId);
	const images = planImages(article.keyword, article.title, site?.voice.sectionImages ?? 2, sections.map((section) => ({
		heading: section.heading,
		words: section.paragraphs.join(" ").split(/\s+/).filter(Boolean).length
	}))).map((image) => ({
		...image,
		src: void 0,
		selected: false
	}));
	const uniqueness = uniquenessAgainst(article.title, article.keyword, useApp.getState().articles.filter((item) => item.siteId === article.siteId && item.id !== article.id).map((item) => ({
		keyword: item.keyword,
		title: item.title,
		slug: item.slug,
		sample: `${item.title}. ${item.sections.map((section) => section.heading).join(". ")}`
	})), sections);
	useApp.getState().patchArticle(article.id, {
		...body,
		sections,
		images,
		html: body.html,
		markdown: body.markdown,
		uniqueness,
		imageState: "pending",
		researchDigest: research.slice(0, 500),
		humanized,
		humanNote,
		engine: "llm",
		liveState: "done",
		liveError: void 0
	});
}
function bingChecks(article, siblings, site) {
	const outbound = article.links.length;
	const inbound = siblings.filter((other) => other.links.some((link) => link.targetSlug === article.slug)).length;
	const near = siblings.some((other) => other.id !== article.id && lexicalSimilarity(`${article.title} ${article.keyword}`, `${other.title} ${other.keyword}`) >= .72);
	const first = (article.sections[0]?.paragraphs[0] ?? article.excerpt ?? "").toLowerCase();
	const keyword = article.keyword.toLowerCase();
	const headings = article.sections.length;
	return [
		{
			id: "links-out",
			label: "Outbound internal links",
			pass: outbound >= 2 || siblings.length < 2,
			tip: "Bing crawls the graph, not isolated URLs. Every page should point to at least two real siblings so none of them is a dead end or a copy of another URL."
		},
		{
			id: "links-in",
			label: "Inbound internal links",
			pass: inbound >= 1 || siblings.length === 0,
			tip: "A page with no inbound links is hard for Bing to discover. Weave it from an older, already-indexed URL."
		},
		{
			id: "unique",
			label: "Not a near-duplicate",
			pass: !near && article.uniqueness >= .8,
			tip: "If two drafts share a title stem, Bing folds them. Keep one URL per intent and link the other angle instead of rewriting the same page."
		},
		{
			id: "query",
			label: "Keyword in title and opening",
			pass: article.title.toLowerCase().includes(keyword.split(" ")[0] ?? "") && first.includes((keyword.split(" ")[0] ?? "").toLowerCase()),
			tip: "Put the query in the title and the first paragraph in plain language. Do not stuff the exact phrase into every heading."
		},
		{
			id: "headings",
			label: "Headings that answer the query",
			pass: headings >= 3,
			tip: "Three or more specific H2s help Bing match sub-intent. Generic headings like Introduction do not."
		},
		{
			id: "author",
			label: "Named author",
			pass: Boolean(article.authorName),
			tip: "A stable byline with a city and beat gives the site an entity Bing can associate with the topic."
		},
		{
			id: "human",
			label: "Bulletproof humanization",
			pass: Boolean(article.humanized),
			tip: article.humanized ? `Blader humanizer rewrote this draft${typeof article.humanizerScore === "number" ? ` (prose purity ${article.humanizerScore}/100)` : ""}.` : article.humanState === "running" || article.humanState === "pending" ? "Blader humanizer is auditing this draft for AI tells." : article.humanState === "error" ? article.humanNote || "Blader humanizer did not finish this draft." : "Humanization is queued. The deterministic pass always runs; a usable model key adds the surgical rewrite."
		},
		{
			id: "index",
			label: "Indexable public URL",
			pass: Boolean(site?.publicUrl) && site?.robots !== "noindex,nofollow",
			tip: "Bing will not rank a noindex host. Set the public URL, allow index,follow, then submit the URL list with IndexNow."
		}
	];
}
function bingScore(checks) {
	if (!checks.length) return 0;
	return checks.filter((check) => check.pass).length / checks.length;
}
/** The single token the "Keyword in title and opening" check matches on. */
function queryToken(keyword) {
	return (keyword.trim().split(/\s+/)[0] ?? "").toLowerCase();
}
function titleCase(text) {
	return text.replace(/\w\S*/g, (word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase());
}
/** The opening paragraph the checklist reads (sections first, then rendered HTML). */
function openingText(article) {
	const fromSections = article.sections[0]?.paragraphs[0];
	if (fromSections) return fromSections;
	return ((/<p[^>]*>([\s\S]*?)<\/p>/i.exec(article.html)?.[1])?.replace(/<[^>]+>/g, " ").trim() || article.excerpt || "").trim();
}
/**
* The sibling Bing is most likely to fold this page into, when the two title
* stems overlap. This is what the "Not a near-duplicate" check flags.
*/
function nearDuplicateSibling(article, siblings) {
	return siblings.filter((other) => other.id !== article.id).map((other) => ({
		other,
		score: lexicalSimilarity(`${article.title} ${article.keyword}`, `${other.title} ${other.keyword}`)
	})).sort((a, b) => b.score - a.score).find((entry) => entry.score >= .72)?.other;
}
/**
* Deterministic repair for "Keyword in title and opening": put the query in the
* title and lead the opening paragraph with it in plain language — no exact
* phrase stuffed into headings. Returns the exact fields the checklist reads.
*/
function alignKeywordToQuery(article) {
	const token = queryToken(article.keyword);
	const keyword = article.keyword.trim();
	if (!token) return {
		title: article.title,
		html: article.html,
		markdown: article.markdown,
		sections: article.sections
	};
	let title = article.title;
	if (!title.toLowerCase().includes(token)) {
		const cased = titleCase(keyword);
		title = cased.length <= 70 ? cased : cased.slice(0, 70).replace(/\s+\S*$/, "");
	}
	if (openingText(article).toLowerCase().includes(token)) return {
		title,
		html: article.html,
		markdown: article.markdown,
		sections: article.sections
	};
	const lead = `What you need to know about ${keyword}.`;
	const sections = article.sections.length ? article.sections.map((section, index) => index === 0 && section.paragraphs.length ? {
		...section,
		paragraphs: [`${lead} ${section.paragraphs[0]}`.trim(), ...section.paragraphs.slice(1)]
	} : section) : [{
		heading: title,
		paragraphs: [lead]
	}];
	const html = /<p(\s[^>]*)?>/i.test(article.html) ? article.html.replace(/<p(\s[^>]*)?>/i, (match) => `${match}${lead} `) : `<p>${lead}</p>\n${article.html}`;
	return {
		title,
		html,
		markdown: `${lead}\n\n${article.markdown.trimStart()}`,
		sections
	};
}
function duplicatePairs(articles) {
	const pairs = [];
	for (let i = 0; i < articles.length; i++) for (let j = i + 1; j < articles.length; j++) {
		const left = articles[i];
		const right = articles[j];
		const score = lexicalSimilarity(`${left.title} ${left.keyword}`, `${right.title} ${right.keyword}`);
		if (score >= .62) pairs.push({
			left,
			right,
			score
		});
	}
	return pairs.sort((a, b) => b.score - a.score).slice(0, 8);
}
function HumanizePipeline() {
	const stateRef = (0, import_react.useRef)(useApp.getState());
	const busy = (0, import_react.useRef)(/* @__PURE__ */ new Set());
	const cooldown = (0, import_react.useRef)(/* @__PURE__ */ new Map());
	const active = useApp((s) => s.articles.some((item) => !item.humanized && item.humanState !== "running" && item.humanState !== "error" && item.liveState !== "pending" && item.liveState !== "running"));
	(0, import_react.useEffect)(() => {
		if (!active) return;
		const pass = () => {
			stateRef.current = useApp.getState();
			const { articles, sites } = stateRef.current;
			const article = articles.find((item) => !item.humanized && item.humanState !== "running" && item.humanState !== "error" && item.liveState !== "pending" && item.liveState !== "running");
			if (!article || busy.current.has(article.id)) return;
			if (Date.now() < (cooldown.current.get(article.id) ?? 0)) return;
			const site = sites.find((item) => item.id === article.siteId);
			const author = useApp.getState().authors.find((item) => item.id === article.authorId);
			busy.current.add(article.id);
			useApp.getState().patchArticle(article.id, {
				humanState: "running",
				humanNote: "Blader humanizer is rewriting this draft."
			});
			(async () => {
				try {
					await runHumanizer(article, site, author);
				} catch (error) {
					const message = error instanceof Error ? error.message : "Humanization failed.";
					useApp.getState().patchArticle(article.id, {
						humanized: false,
						humanState: "error",
						humanNote: message
					});
				} finally {
					cooldown.current.set(article.id, Date.now() + 500);
					window.setTimeout(() => busy.current.delete(article.id), 500);
				}
			})();
		};
		pass();
		const timer = window.setInterval(pass, 1500);
		return () => window.clearInterval(timer);
	}, [active]);
	return null;
}
async function runHumanizer(article, site, author) {
	const current = useApp.getState().articles.find((item) => item.id === article.id) ?? article;
	const result = await humanizeWithBlader({
		chat: siteChat((keyId, status, error) => useApp.getState().penalizeKey(keyId, status, error)),
		markdown: current.markdown,
		keyword: current.keyword,
		title: current.title,
		authorName: author?.name ?? article.authorName,
		authorVoice: author ? authorVoiceBlock(author) : void 0,
		authorBannedPhrases: [...site?.voice.bannedPhrases ?? [], ...author?.voice.bannedPhrases ?? []]
	});
	if (result.usage) useApp.setState((s) => ({ events: [{
		id: uid("evt"),
		pairId: `hum_${article.id}:${Date.now()}`,
		siteId: article.siteId,
		keyId: result.keyId ?? "key_studio",
		at: Date.now(),
		state: "SETTLED",
		provider: "Blader humanizer",
		model: result.llm ? "audit+rewrite" : "deterministic",
		stage: "humanize",
		tokens: result.usage.total,
		usd: 0
	}, ...s.events] }));
	const linked = ensureMarkdownLinks(result.markdown, current.links.map((link) => ({
		anchor: link.anchor,
		slug: link.targetSlug
	})));
	const body = articleFromMarkdown(linked);
	const withMedia = applyFetchedImages(body.html, linked, current.images, current.keyword);
	useApp.getState().patchArticle(article.id, {
		...body,
		html: withMedia.html,
		markdown: withMedia.markdown,
		sections: current.sections,
		humanized: true,
		humanState: "done",
		humanizerScore: result.score,
		humanizerStripped: result.stripped,
		humanizerPasses: result.passes,
		humanizerNote: result.note,
		humanNote: `${result.note} · score ${result.score}`,
		bulletproof: true,
		ghostPush: current.ghostPush === "held" ? "pending" : current.ghostPush
	});
}
function HumanizeBanner() {
	const siteId = useApp((s) => s.activeSiteId);
	const site = useApp((s) => s.sites.find((item) => item.id === siteId));
	const articleList = useApp((s) => s.articles);
	const articles = (0, import_react.useMemo)(() => articleList.filter((item) => item.siteId === siteId), [articleList, siteId]);
	const ready = articles.length ? articles.reduce((sum, article) => sum + bingScore(bingChecks(article, articles, site)), 0) / articles.length : 0;
	const pct = Math.floor(ready * 100);
	const scored = articles.filter((article) => typeof article.humanizerScore === "number");
	const avgScore = scored.length ? Math.round(scored.reduce((sum, article) => sum + (article.humanizerScore ?? 0), 0) / scored.length) : null;
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Card, {
		className: "mb-4 p-4",
		children: [
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
				className: "flex flex-wrap items-center justify-between gap-2",
				children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
					className: "font-mono text-xs uppercase tracking-widest text-faint",
					children: "Blader humanizer"
				}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", {
					className: "rounded border border-line px-1.5 py-0.5 font-mono text-xs uppercase tracking-wider text-faint",
					children: ["native · ", BLADER_SOURCE]
				})]
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
				className: "mt-2 text-2xl font-semibold tracking-tight",
				children: articles.length ? `${avgScore === null ? "—" : `${avgScore}% prose purity`}` : "—"
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
				className: "mt-2 text-sm leading-6 text-muted",
				children: articles.length ? avgScore === null ? "No article has humanized yet. The next draft runs the deterministic pass, and a usable model key adds the surgical audit + rewrite." : `${scored.length} of ${articles.length} articles humanized. The Bing humanization check passes at ${pct}%.` : "Drafts run through the blader/humanizer ruleset: 26 AI-writing patterns detected and stripped, with the assigned author's voice."
			})
		]
	});
}
function digestOf(src) {
	return (src?.split("/").pop() ?? "").replace(/\.(jpg|jpeg|png|webp)$/i, "");
}
function repairLinks(article) {
	let html = stripVerify(article.html);
	let markdown = stripVerify(article.markdown);
	let changed = html !== article.html || markdown !== article.markdown;
	for (const link of article.links) {
		const bare = `href="/${link.targetSlug}"`;
		const bareSlash = `href="/${link.targetSlug}/"`;
		if (html.includes(bare) || html.includes(bareSlash)) {
			html = html.split(bare).join(`href="/post/${link.targetSlug}/"`).split(bareSlash).join(`href="/post/${link.targetSlug}/"`);
			changed = true;
		}
		if (alreadyLinked(html, markdown, link.targetSlug)) continue;
		const inserted = insertAnchor(html, markdown, link.anchor, link.targetSlug);
		if (!inserted.inserted) continue;
		html = inserted.html;
		markdown = inserted.markdown;
		changed = true;
	}
	return changed ? {
		html,
		markdown
	} : null;
}
function DeskWorkers() {
	const stateRef = (0, import_react.useRef)(useApp.getState());
	const imageBusy = (0, import_react.useRef)(/* @__PURE__ */ new Set());
	const imageCooldown = (0, import_react.useRef)(/* @__PURE__ */ new Map());
	const ghostBusy = (0, import_react.useRef)(/* @__PURE__ */ new Set());
	const ghostCooldown = (0, import_react.useRef)(/* @__PURE__ */ new Map());
	const reweaveBusy = (0, import_react.useRef)(/* @__PURE__ */ new Set());
	const reweaveCooldown = (0, import_react.useRef)(/* @__PURE__ */ new Map());
	const repaired = (0, import_react.useRef)(/* @__PURE__ */ new Set());
	const active = useApp((s) => s.articles.some((item) => item.liveState === "pending" || item.liveState === "running" || item.imageState === "pending" || item.ghostPush === "pending" || item.ghostPush === "held" || item.ghostPush === "done" && item.links.some((link) => link.state === "LOCAL")));
	(0, import_react.useEffect)(() => {
		if (!active) return;
		/** Fix bare internal links and verify every edge points at a real target. */
		function repairPass() {
			const articles = stateRef.current.articles;
			const patches = [];
			for (const article of articles) {
				if (repaired.current.has(article.id)) continue;
				repaired.current.add(article.id);
				const patch = repairLinks(article);
				if (patch) patches.push({
					id: article.id,
					patch
				});
			}
			if (!patches.length) return;
			useApp.setState((s) => ({ articles: s.articles.map((article) => {
				const hit = patches.find((item) => item.id === article.id);
				return hit ? {
					...article,
					...hit.patch
				} : article;
			}) }));
		}
		/** Fetch and place photos for drafts that finished writing. */
		function imagePass() {
			const { articles, sites } = stateRef.current;
			const article = articles.find((item) => item.imageState !== "ready" && item.imageState !== "empty" && item.liveState !== "pending" && item.liveState !== "running" && !imageBusy.current.has(item.id) && Date.now() >= (imageCooldown.current.get(item.id) ?? 0));
			if (!article) return;
			const site = sites.find((item) => item.id === article.siteId);
			imageBusy.current.add(article.id);
			const sectionCount = Math.max(1, article.images.filter((image) => image.role === "section").length || site?.voice.sectionImages || 1);
			const slots = planImages(article.keyword, article.title, sectionCount, (article.sections ?? []).map((section) => ({
				heading: section.heading,
				words: section.paragraphs.join(" ").split(/\s+/).filter(Boolean).length
			}))).slice(0, 4);
			const avoid = articles.flatMap((item) => item.images.map((image) => digestOf(image.src))).filter(Boolean);
			(async () => {
				try {
					const images = (await placeImages({ data: {
						provider: site?.voice.imageProvider ?? "bing",
						salt: article.imageSalt ?? 0,
						avoid,
						slots: slots.map((slot) => ({
							query: slot.query,
							alt: slot.alt,
							role: slot.role,
							width: slot.width,
							height: slot.height
						}))
					} })).images.map((image) => ({
						role: image.role,
						query: image.query,
						alt: image.alt,
						http: image.http,
						selected: image.selected,
						src: image.src,
						remote: image.remote,
						width: image.width,
						height: image.height,
						bytes: image.bytes,
						license: image.license,
						attempts: image.attempts
					}));
					const seen = /* @__PURE__ */ new Set();
					const unique = images.map((image) => {
						const digest = digestOf(image.src);
						if (!image.selected || !digest || seen.has(digest)) return {
							...image,
							selected: false,
							src: void 0
						};
						seen.add(digest);
						return image;
					});
					const current = useApp.getState().articles.find((item) => item.id === article.id) ?? article;
					const body = applyFetchedImages(stripVerify(current.html), stripVerify(current.markdown), unique, current.keyword);
					const placed = unique.some((image) => image.selected && image.src);
					const salt = article.imageSalt ?? 0;
					useApp.getState().patchArticle(article.id, {
						images: unique,
						html: body.html,
						markdown: body.markdown,
						imageState: placed ? "ready" : salt < 2 ? "pending" : "empty",
						imageSalt: placed ? salt : salt + 1,
						ghostPush: placed && article.ghostPush === "done" ? "pending" : article.ghostPush
					});
				} catch {
					useApp.getState().patchArticle(article.id, { imageState: "empty" });
				} finally {
					imageCooldown.current.set(article.id, Date.now() + 500);
					window.setTimeout(() => imageBusy.current.delete(article.id), 500);
				}
			})();
		}
		/** Publish humanized drafts that target a LIVE Ghost site. */
		function ghostPass() {
			const { articles, sites } = stateRef.current;
			const waiting = articles.filter((item) => item.ghostPush === "pending" || item.ghostPush === "held");
			const skipIds = waiting.filter((item) => {
				const site = sites.find((row) => row.id === item.siteId);
				return site?.ghost.mode !== "live" || !site.ghost.adminKey;
			}).filter((item) => item.ghostPush === "pending").map((item) => item.id);
			if (skipIds.length) {
				const skip = new Set(skipIds);
				useApp.setState((s) => ({ articles: s.articles.map((article) => skip.has(article.id) && article.ghostPush === "pending" ? {
					...article,
					ghostPush: "skipped"
				} : article) }));
				return;
			}
			const article = waiting.find((item) => !ghostBusy.current.has(item.id) && Date.now() >= (ghostCooldown.current.get(item.id) ?? 0) && (item.imageState === "ready" || item.imageState === "empty"));
			if (!article) return;
			if (article.status === "published" && article.humanState !== "done") {
				const note = "Held at publish policy: blader humanization is still running on this article. This note frees the publish when the pass finishes.";
				if (article.ghostPush !== "held") {
					useApp.getState().patchArticle(article.id, {
						ghostPush: "held",
						liveState: "skipped"
					});
					useApp.setState((s) => ({ articles: s.articles.map((row) => row.id === article.id && !row.humanNote ? {
						...row,
						humanNote: note
					} : row) }));
				}
				return;
			}
			const site = sites.find((item) => item.id === article.siteId);
			if (!site?.ghost.adminKey) return;
			ghostBusy.current.add(article.id);
			useApp.getState().patchArticle(article.id, { ghostPush: "running" });
			const author = useApp.getState().authors.find((item) => item.id === article.authorId);
			(async () => {
				const result = await publishGhostPost({ data: {
					url: site.ghost.url,
					adminKey: site.ghost.adminKey ?? "",
					title: article.title,
					slug: article.slug,
					html: article.html,
					excerpt: article.excerpt,
					metaDescription: article.metaDescription,
					status: article.status === "published" ? "published" : "draft",
					tags: article.tags,
					images: article.images.filter((image) => image.selected && image.src).map((image) => ({
						src: image.src,
						remote: image.remote,
						role: image.role,
						alt: image.alt
					})),
					author: author ? {
						name: author.name,
						slug: author.slug,
						bio: author.shortBio,
						profileImage: author.avatarUrl,
						knownGhostAuthorId: author.ghostAuthorId ?? void 0
					} : void 0
				} });
				if (!result.ok) useApp.getState().patchArticle(article.id, {
					ghostPush: "error",
					liveError: result.error
				});
				else {
					if (author && result.author) useApp.getState().patchAuthor(author.id, { ghostAuthorId: result.author.ghostAuthorId ?? author.ghostAuthorId ?? null });
					useApp.getState().patchArticle(article.id, {
						ghostPush: "done",
						ghostMedia: result.imaged ? true : article.ghostMedia,
						html: result.html || article.html,
						liveError: void 0,
						links: article.links.map((link) => link.state === "BROKEN" || link.state === "FAILED" ? link : {
							...link,
							state: "GHOST_CONFIRMED"
						}),
						ledger: {
							...article.ledger,
							postId: result.postId,
							confirmed: true,
							shots: 1
						}
					});
					if (article.status === "published" && site.indexNowKey && site.publicUrl.startsWith("https://")) {
						const ftp = site.providers.find((provider) => provider.id === "cpanel" && provider.status === "verified")?.ftp;
						const url = `${site.publicUrl.replace(/\/$/, "")}/post/${article.slug}/`;
						submitIndexNow({ data: {
							publicUrl: site.publicUrl,
							key: site.indexNowKey,
							urls: [url],
							verified: Boolean(ftp),
							ftp: ftp ?? {
								host: "",
								user: "",
								password: "",
								port: 21,
								path: "/",
								via: "ftps"
							}
						} }).then((ping) => {
							useApp.getState().logEvent(site.id, ping.ok ? "ok" : "warn", ping.ok ? `IndexNow ping submitted · ${url}` : `IndexNow skipped after live publish: ${ping.error}`);
						});
					} else if (article.status === "published") useApp.getState().logEvent(site.id, "info", "IndexNow skipped: this site has no verified key-file configuration yet.");
				}
				ghostCooldown.current.set(article.id, Date.now() + 500);
				window.setTimeout(() => ghostBusy.current.delete(article.id), 500);
			})();
		}
		/**
		* Rule 6 autoReweave: a published post with LOCAL link edges (proposed by the
		* calendar re-weave) is updated on Ghost through the PUT-only path. The
		* optimistic lock protects hand-edited posts — a mismatch skips the write and
		* says so instead of clobbering the edit.
		*/
		function reweavePass() {
			const { articles, sites, calendars } = stateRef.current;
			const candidate = articles.find((article) => {
				if (article.ghostPush !== "done" || !article.links.some((link) => link.state === "LOCAL")) return false;
				if (reweaveBusy.current.has(article.id)) return false;
				if (Date.now() < (reweaveCooldown.current.get(article.id) ?? 0)) return false;
				const site = sites.find((item) => item.id === article.siteId);
				if (!site || site.ghost.mode !== "live" || !site.ghost.adminKey) return false;
				const calendar = calendars.find((item) => item.siteId === article.siteId && item.autoReweave && item.items.some((entry) => entry.articleId === article.id && entry.status === "PUBLISHED"));
				return Boolean(calendar);
			});
			if (!candidate) return;
			const site = sites.find((item) => item.id === candidate.siteId);
			const edge = candidate.links.find((link) => link.state === "LOCAL");
			if (!edge) return;
			reweaveBusy.current.add(candidate.id);
			(async () => {
				try {
					const inserted = insertAnchor(candidate.html, candidate.markdown, edge.anchor, edge.targetSlug);
					if (!inserted.inserted) {
						useApp.getState().patchArticle(candidate.id, { links: withEdgeState(candidate.links, edge.targetSlug, "GHOST_CONFIRMED") });
						return;
					}
					const result = await updateGhostPostHtml({ data: {
						url: site.ghost.url,
						adminKey: site.ghost.adminKey ?? "",
						postId: candidate.ledger.postId ?? void 0,
						slug: candidate.slug,
						html: inserted.html,
						expectedUpdatedAt: candidate.ghostUpdatedAt
					} });
					if (!result.ok) {
						if (result.code === "STALE_LOCAL_COPY") {
							useApp.getState().logEvent(site.id, "warn", `Re-weave skipped for “${candidate.title}”: the post was hand-edited on Ghost after publish. The edit was protected.`);
							useApp.getState().patchArticle(candidate.id, { links: withEdgeState(candidate.links, edge.targetSlug, "FAILED") });
							return;
						}
						useApp.getState().logEvent(site.id, "warn", `Re-weave failed for “${candidate.title}”: ${result.error}`);
						useApp.getState().patchArticle(candidate.id, { links: withEdgeState(candidate.links, edge.targetSlug, "FAILED") });
						return;
					}
					useApp.getState().patchArticle(candidate.id, {
						html: inserted.html,
						markdown: inserted.markdown,
						ghostUpdatedAt: result.updatedAt,
						links: withEdgeState(candidate.links, edge.targetSlug, "GHOST_CONFIRMED")
					});
					useApp.getState().logEvent(site.id, "ok", `Re-weave applied on Ghost · “${candidate.title}” → /post/${edge.targetSlug}/ · lock ${result.updatedAt.slice(0, 19)}`);
				} finally {
					reweaveCooldown.current.set(candidate.id, Date.now() + 500);
					window.setTimeout(() => reweaveBusy.current.delete(candidate.id), 500);
				}
			})();
		}
		const timer = window.setInterval(() => {
			stateRef.current = useApp.getState();
			repairPass();
			imagePass();
			ghostPass();
			reweavePass();
		}, 1500);
		return () => window.clearInterval(timer);
	}, [active]);
	return null;
}
function ghostMark(site) {
	if (site.ghost.status === "error") return {
		dot: "bg-danger",
		label: "Ghost refused the key",
		tone: "danger"
	};
	if (site.ghost.lastError) return {
		dot: "bg-brass",
		label: "Degraded",
		tone: "brass"
	};
	if (site.ghost.status === "connected" && site.ghost.mode === "studio") return {
		dot: "bg-ok",
		label: "Sandbox",
		tone: "ok"
	};
	if (site.ghost.status === "connected") return {
		dot: "bg-ok",
		label: "Connected",
		tone: "ok"
	};
	return {
		dot: "bg-faint",
		label: "Ghost not connected",
		tone: "muted"
	};
}
function WorkspacesPage() {
	const sites = useApp((s) => s.sites);
	const activeSiteId = useApp((s) => s.activeSiteId);
	const articles = useApp((s) => s.articles);
	const runs = useApp((s) => s.runs);
	const builds = useApp((s) => s.builds);
	const setSite = useApp((s) => s.setSite);
	const createWorkspace = useApp((s) => s.createWorkspace);
	const deleteWorkspace = useApp((s) => s.deleteWorkspace);
	const runIdeas = useApp((s) => s.runIdeas);
	const ideas = useApp((s) => s.ideas);
	const [name, setName] = (0, import_react.useState)("");
	const [niche, setNiche] = (0, import_react.useState)("");
	const [confirmId, setConfirmId] = (0, import_react.useState)(null);
	const [typed, setTyped] = (0, import_react.useState)("");
	const navigate = useNavigate();
	const pending = sites.find((site) => site.id === confirmId);
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [
		/* @__PURE__ */ (0, import_jsx_runtime.jsx)(PageIntro, {
			eyebrow: "Owner",
			title: "Website workspaces",
			lede: "Each website is an isolated tenant — its own Ghost connection, articles, link graph and static site. This studio is yours: there is no workspace cap."
		}),
		/* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Card, {
			className: "mb-4 p-5",
			children: [
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h2", {
					className: "text-lg font-semibold",
					children: "Find a niche"
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
					className: "mt-1 text-sm text-muted",
					children: "Describe an interest. You get qualitative niche ideas only — no search volume or competition numbers."
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
					className: "mt-3 flex flex-wrap gap-2",
					children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("input", {
						className: `${fieldClass} max-w-md`,
						value: niche,
						onChange: (event) => setNiche(event.target.value),
						placeholder: "What do you want to write about?",
						"aria-label": "Niche interest"
					}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Button, {
						variant: "ghost",
						disabled: niche.trim().length < 3,
						onClick: () => runIdeas(niche.trim(), 8),
						children: "Discover"
					})]
				}),
				ideas?.items.length ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("ul", {
					className: "mt-3 grid gap-2 sm:grid-cols-2",
					children: ideas.items.slice(0, 8).map((idea) => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("li", {
						className: "rounded-lg border border-line px-3 py-2 text-sm",
						children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
							className: "block font-medium",
							children: idea.keyword
						}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
							className: "text-xs text-faint",
							children: idea.reason
						})]
					}, idea.keyword))
				}) : null
			]
		}),
		/* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Card, {
			className: "mb-4 flex flex-wrap items-end gap-3 p-5",
			children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
				className: "min-w-0 flex-1",
				children: [
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
						className: "text-sm font-medium",
						children: "New website workspace"
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("p", {
						className: "mt-1 text-xs text-faint",
						children: [sites.length, " in use · unlimited · owner"]
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("input", {
						className: `${fieldClass} mt-3`,
						value: name,
						onChange: (event) => setName(event.target.value),
						placeholder: "The Coffee Journal",
						"aria-label": "Website name"
					})
				]
			}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Button, {
				disabled: name.trim().length < 2,
				onClick: () => {
					createWorkspace(name);
					setName("");
					navigate({ to: "/" });
				},
				children: "Create workspace"
			})]
		}),
		!sites.length ? /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Card, {
			className: "p-10 text-center",
			children: [
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h2", {
					className: "text-2xl font-semibold",
					children: "Create your first workspace"
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
					className: "mt-2 text-sm text-muted",
					children: "This studio starts completely empty — no demo data. Create one workspace per website; it is saved to the server database so every browser and incognito window loads the exact same workspaces, keys, and articles."
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
					className: "mt-3 text-xs text-faint",
					children: "Workspaces you create here sync to every device. Nothing is shared until you create it."
				})
			]
		}) : /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
			className: "grid gap-3 md:grid-cols-2",
			children: sites.map((site) => {
				const mark = ghostMark(site);
				const count = articles.filter((article) => article.siteId === site.id).length;
				const runCount = runs.filter((run) => run.siteId === site.id).length;
				const buildCount = builds.filter((item) => item.siteId === site.id).length;
				const open = confirmId === site.id;
				return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Card, {
					className: `p-5 ${site.id === activeSiteId ? "border-brass" : ""}`,
					children: [
						/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("button", {
							className: "flex w-full items-start gap-3 text-left",
							onClick: () => {
								setSite(site.id);
								navigate({ to: "/" });
							},
							children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { className: `mt-1.5 size-2.5 shrink-0 rounded-full ${mark.dot}` }), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", {
								className: "min-w-0",
								children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
									className: "block truncate text-lg font-semibold tracking-tight",
									children: site.name
								}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", {
									className: "mt-1 flex flex-wrap items-center gap-2 text-xs text-muted",
									children: [
										/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Badge, {
											tone: mark.tone,
											children: mark.label
										}),
										/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", { children: [count, " articles"] }),
										/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", { children: [runCount, " runs"] }),
										/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", { children: [buildCount, " builds"] }),
										site.id === activeSiteId ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
											className: "text-brass",
											children: "Active"
										}) : null
									]
								})]
							})]
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
							className: "mt-4 flex flex-wrap gap-2",
							children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Button, {
								variant: "ghost",
								onClick: () => {
									setSite(site.id);
									navigate({ to: "/settings/website" });
								},
								children: "Rename"
							}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Button, {
								variant: "danger",
								onClick: () => {
									setConfirmId(open ? null : site.id);
									setTyped("");
								},
								children: "Delete"
							})]
						}),
						open && pending ? /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
							className: "mt-3 rounded-lg border border-danger/30 p-3",
							children: [
								/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
									className: "text-sm text-muted",
									children: "Deletes articles, runs, plans, the link graph, builds, and the saved Ghost connection in this studio. Posts already on Ghost stay there."
								}),
								/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
									className: "mt-2 text-xs text-faint",
									children: "Type the workspace name to confirm"
								}),
								/* @__PURE__ */ (0, import_jsx_runtime.jsx)("input", {
									className: `${fieldClass} mt-2`,
									value: typed,
									onChange: (event) => setTyped(event.target.value),
									"aria-label": "Type the workspace name to confirm"
								}),
								/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Button, {
									className: "mt-2",
									variant: "danger",
									disabled: typed !== pending.name,
									onClick: () => {
										deleteWorkspace(pending.id);
										setConfirmId(null);
										setTyped("");
									},
									children: "Delete workspace"
								})
							]
						}) : null
					]
				}, site.id);
			})
		})
	] });
}
function StudioMark({ className }) {
	const ref = (0, import_react.useRef)(null);
	function move(event) {
		const box = ref.current?.getBoundingClientRect();
		if (!box) return;
		const x = (event.clientX - box.left) / box.width - .5;
		const y = (event.clientY - box.top) / box.height - .5;
		ref.current?.style.setProperty("--tx", `${x * 16}deg`);
		ref.current?.style.setProperty("--ty", `${y * -16}deg`);
	}
	function leave() {
		ref.current?.style.setProperty("--tx", "0deg");
		ref.current?.style.setProperty("--ty", "0deg");
	}
	return /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
		ref,
		className: cn("studio-mark", className),
		onPointerMove: move,
		onPointerLeave: leave,
		"aria-hidden": true,
		children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("svg", {
			viewBox: "0 0 64 64",
			fill: "none",
			children: [
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)("circle", {
					cx: "32",
					cy: "32",
					r: "30",
					className: "fill-brass"
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)("circle", {
					cx: "32",
					cy: "32",
					r: "24",
					stroke: "white",
					strokeOpacity: "0.45",
					strokeWidth: "1.25"
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)("g", {
					className: "mark-spin",
					children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)("circle", {
						cx: "32",
						cy: "8",
						r: "2.2",
						fill: "white"
					})
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)("path", {
					d: "M24 44V20h11.2c3.7 0 6 2 6 5.1 0 2.2-1.3 4-3.5 4.6 2.5.5 4.1 2.4 4.1 5 0 3.4-2.5 5.3-6.6 5.3H24Zm4.2-11.6h6.2c1.6 0 2.6-.8 2.6-2.1s-1-2.1-2.6-2.1h-6.2v4.2Zm0 8.8h6.9c1.9 0 3-.8 3-2.2s-1.1-2.2-3-2.2h-6.9V41.2Z",
					fill: "white"
				})
			]
		})
	});
}
/** Rule 7 / §1 — the 20 canonical route areas with their shell icons attached. */
var ICONS = {
	Activity,
	BookOpen,
	Cable,
	CalendarDays,
	ChartColumn,
	CircleHelp,
	CreditCard,
	Files,
	Globe,
	Inbox,
	KeyRound,
	LayoutDashboard,
	ListTree,
	PenLine,
	Rocket,
	Settings2,
	SlidersHorizontal,
	UserRound,
	Users,
	ArchiveRestore
};
var AREAS = AREAS$1.map((area) => ({
	...area,
	Icon: ICONS[area.icon] ?? LayoutDashboard
}));
var SHELL_GROUPS = SHELL_GROUPS$1;
var NAV = NAV_AREAS.map((area) => ({
	...area,
	Icon: ICONS[area.icon] ?? LayoutDashboard
}));
/** Rule 7 quick actions in the Ctrl+K palette (beyond the 20 area jumps). */
var PALETTE_ACTIONS = PALETTE_ACTIONS$1;
var useBeat = create(() => ({ at: 0 }));
/** Palette matching that ignores punctuation and spacing (people type "rose", not "Theme · Rose"). */
function normQuery(value) {
	return value.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
}
function active(href, path) {
	if (href === "/") return path === "/";
	return path === href || path.startsWith(`${href}/`);
}
function AppShell({ children }) {
	const path = useRouterState({ select: (s) => s.location.pathname });
	const [open, setOpen] = (0, import_react.useState)(false);
	const [palette, setPalette] = (0, import_react.useState)(false);
	const [query, setQuery] = (0, import_react.useState)("");
	const [bell, setBell] = (0, import_react.useState)(false);
	const [workerPanel, setWorkerPanel] = (0, import_react.useState)(false);
	const [switcher, setSwitcher] = (0, import_react.useState)(false);
	const notice = useApp((s) => s.notice);
	const clearNotice = useApp((s) => s.clearNotice);
	const sites = useApp((s) => s.sites);
	const activeSiteId = useApp((s) => s.activeSiteId);
	const setSite = useApp((s) => s.setSite);
	const articles = useApp((s) => s.articles);
	const runs = useApp((s) => s.runs);
	const plans = useApp((s) => s.plans);
	const activity = useApp((s) => s.activity);
	const setSetup = useApp((s) => s.setSetup);
	const workerPaused = useApp((s) => s.workerPaused);
	const worker = useApp((s) => s.worker);
	const setWorker = useApp((s) => s.setWorker);
	const site = sites.find((item) => item.id === activeSiteId) ?? sites[0];
	const hydrated = useHydrated();
	const gate = useVaultPhase();
	const searchRef = (0, import_react.useRef)(null);
	const navigate = useNavigate();
	const beatBusy = useApp((s) => Boolean(!s.workerPaused && (s.jobs.some((item) => item.status === "queued" || item.status === "running") || s.sites.some((site) => site.ghost.corpus === "SYNCING" && site.ghost.syncReadyAt && site.ghost.syncReadyAt <= Date.now() || Boolean(site.pendingRebuildAt && site.pendingRebuildAt <= Date.now())))));
	(0, import_react.useEffect)(() => {
		useBeat.setState({ at: Date.now() });
		const pulse = window.setInterval(() => useBeat.setState({ at: Date.now() }), 3e3);
		return () => window.clearInterval(pulse);
	}, []);
	(0, import_react.useEffect)(() => {
		if (!hydrated) return;
		allowPersistWrites();
		useApp.getState().ensureAuthors();
		useApp.getState().tick();
		const cadence = beatBusy ? 1500 : 6e3;
		const tick = window.setInterval(() => useApp.getState().tick(), cadence);
		return () => window.clearInterval(tick);
	}, [beatBusy, hydrated]);
	(0, import_react.useEffect)(() => {
		function onKey(event) {
			if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
				event.preventDefault();
				setPalette((openNow) => !openNow);
				setQuery("");
			}
		}
		window.addEventListener("keydown", onKey);
		return () => window.removeEventListener("keydown", onKey);
	}, []);
	(0, import_react.useEffect)(() => {
		if (!notice) return;
		const t = window.setTimeout(() => clearNotice(), 4200);
		return () => window.clearTimeout(t);
	}, [notice, clearNotice]);
	(0, import_react.useEffect)(() => {
		setOpen(false);
		setQuery("");
		setSwitcher(false);
		setBell(false);
		setWorkerPanel(false);
	}, [path]);
	const commands = (0, import_react.useMemo)(() => {
		const rows = [...PALETTE_ACTIONS.map((action) => ({
			href: action.href,
			label: action.label,
			hint: action.hint,
			build: Boolean("build" in action && action.build)
		})), {
			href: "__setup",
			label: "Restart setup guide",
			hint: "Action",
			build: false
		}];
		const q = query.trim().toLowerCase();
		if (!q) return rows;
		return rows.filter((row) => row.label.toLowerCase().includes(q));
	}, [query]);
	/** Rule 7: theme switching straight from the palette (matching ignores punctuation). */
	const themeCommands = (0, import_react.useMemo)(() => {
		const q = normQuery(query);
		return THEMES.filter((theme) => !q || normQuery(`theme ${theme.label}`).includes(q)).map((theme) => ({
			...theme,
			label: `Theme · ${theme.label}`
		}));
	}, [query]);
	const results = (0, import_react.useMemo)(() => {
		const q = query.trim().toLowerCase();
		if (q.length < 2) return [];
		const nav = AREAS.filter((area) => `${area.label} ${area.group} ${area.id}`.toLowerCase().includes(q)).map((area) => ({
			href: area.href,
			label: area.label,
			hint: area.group
		}));
		const arts = articles.filter((article) => article.siteId === site?.id && `${article.title} ${article.keyword}`.toLowerCase().includes(q)).slice(0, 5).map((article) => ({
			href: `/articles/${article.id}`,
			label: article.title,
			hint: "Article"
		}));
		const runHits = runs.filter((run) => run.siteId === site?.id && run.title.toLowerCase().includes(q)).slice(0, 4).map((run) => ({
			href: `/runs/${run.id}`,
			label: run.title,
			hint: "Run"
		}));
		const planHits = plans.filter((plan) => plan.siteId === site?.id && plan.topic.toLowerCase().includes(q)).slice(0, 4).map((plan) => ({
			href: `/topic-plans/${plan.id}`,
			label: plan.topic,
			hint: "Topic plan"
		}));
		return [
			...nav,
			...arts,
			...runHits,
			...planHits
		].slice(0, 8);
	}, [
		query,
		articles,
		runs,
		plans,
		site?.id
	]);
	if (gate !== "open") return gate === "locked" ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)(UnlockGate, {}) : /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
		className: "grid min-h-screen place-items-center bg-bg text-sm text-muted",
		children: "Opening the studio…"
	});
	if (path.startsWith("/preview")) return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(import_jsx_runtime.Fragment, { children: [
		/* @__PURE__ */ (0, import_jsx_runtime.jsx)(LiveWriter, {}),
		/* @__PURE__ */ (0, import_jsx_runtime.jsx)(HumanizePipeline, {}),
		/* @__PURE__ */ (0, import_jsx_runtime.jsx)(DeskWorkers, {}),
		children
	] });
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
		className: "flex min-h-screen bg-bg text-fg",
		children: [
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("aside", {
				className: "sticky top-0 hidden h-screen w-68 shrink-0 flex-col border-r border-line/60 bg-elev md:flex",
				children: [
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Brand, {}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)(SidebarNav, { path }),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
						className: "border-t border-line/60 px-5 py-4 text-xs leading-5 text-faint",
						children: "Six stages. One publishing desk."
					})
				]
			}),
			open ? /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
				className: "fixed inset-0 z-40 md:hidden",
				children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
					className: "absolute inset-0 bg-bg/70",
					"aria-label": "Close menu",
					onClick: () => setOpen(false)
				}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
					className: "relative flex h-full w-[min(20rem,88vw)] flex-col border-r border-line/60 bg-elev shadow-2xl",
					children: [
						/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
							className: "flex items-center justify-between",
							children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Brand, {}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
								className: "mr-3 grid size-11 place-items-center text-muted",
								onClick: () => setOpen(false),
								"aria-label": "Close",
								children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(X, { className: "size-5" })
							})]
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
							className: "mx-3 mb-2 rounded-lg border border-line/60 bg-surface p-2",
							children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
								className: "px-2 py-1 text-xs font-semibold uppercase tracking-wider text-faint",
								children: "Workspace"
							}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
								className: "max-h-36 overflow-y-auto",
								children: sites.map((item) => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("button", {
									type: "button",
									"aria-current": item.id === site?.id ? "true" : void 0,
									className: cn("flex min-h-10 w-full items-center gap-2 rounded-md px-2 text-left text-sm hover:bg-surface-2", item.id === site?.id && "text-brass-2"),
									onClick: () => {
										setSite(item.id);
										setOpen(false);
									},
									children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { className: cn("size-2 shrink-0 rounded-full", ghostDot(item.ghost)) }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
										className: "truncate",
										children: item.name
									})]
								}, item.id))
							})]
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)(SidebarNav, {
							path,
							onNavigate: () => setOpen(false)
						})
					]
				})]
			}) : null,
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
				className: "flex min-w-0 flex-1 flex-col",
				children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("header", {
					"data-shell-header": true,
					className: "sticky top-0 z-20 flex items-center gap-2 border-b border-line/60 bg-bg/95 px-3 py-3 backdrop-blur md:px-8",
					children: [
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
							className: "grid size-11 place-items-center rounded-lg border border-line md:hidden",
							onClick: () => setOpen(true),
							"aria-label": "Open menu",
							children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Menu, { className: "size-5" })
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("button", {
							type: "button",
							onClick: () => {
								setPalette(true);
								setQuery("");
							},
							className: "flex min-h-11 min-w-0 flex-1 items-center gap-2 rounded-lg border border-line/60 bg-elev px-3 text-left text-sm text-muted hover:border-line-strong hover:bg-surface",
							children: [
								/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Search, { className: "size-4 shrink-0" }),
								/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
									className: "truncate",
									children: "Search or jump"
								}),
								/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
									className: "ml-auto hidden rounded-md border border-line px-1.5 py-0.5 font-mono text-xs sm:inline",
									children: "Ctrl K"
								})
							]
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
							className: "relative hidden sm:block",
							children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("button", {
								type: "button",
								className: "flex min-h-11 max-w-48 items-center gap-2 rounded-lg border border-line bg-surface px-3 text-sm",
								"aria-label": "Workspace switcher",
								onClick: () => setSwitcher((value) => !value),
								children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { className: cn("size-2 shrink-0 rounded-full", site ? ghostDot(site.ghost) : "bg-faint") }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
									className: "truncate",
									children: site?.name ?? "No workspace"
								})]
							}), switcher ? /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
								className: "absolute right-0 top-12 z-30 w-72 rounded-xl border border-line bg-elev p-2",
								children: [
									/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
										className: "px-2 py-1 font-mono text-xs uppercase tracking-widest text-faint",
										children: "Website workspaces"
									}),
									sites.map((item) => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("button", {
										className: "flex min-h-11 w-full items-center gap-2 rounded-lg px-2 text-left text-sm hover:bg-surface",
										onClick: () => {
											setSite(item.id);
											setSwitcher(false);
										},
										children: [
											/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { className: cn("size-2 rounded-full", ghostDot(item.ghost)) }),
											/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
												className: "truncate",
												children: item.name
											}),
											item.id === site?.id ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
												className: "ml-auto text-xs text-brass",
												children: "Active"
											}) : null
										]
									}, item.id)),
									/* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Link, {
										to: "/workspaces",
										className: "mt-1 flex min-h-11 items-center gap-2 rounded-lg px-2 text-sm text-brass hover:bg-surface",
										onClick: () => setSwitcher(false),
										children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Plus, { className: "size-4" }), "New workspace"]
									})
								]
							}) : null]
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
							className: "relative",
							children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
								type: "button",
								className: "grid size-11 place-items-center rounded-lg border border-line",
								"aria-label": "Recent activity",
								onClick: () => setBell((value) => !value),
								children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Bell, { className: "size-4" })
							}), bell ? /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
								className: "absolute right-0 top-12 z-30 w-80 rounded-xl border border-line bg-elev p-2",
								children: [
									/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
										className: "px-2 py-1 text-xs uppercase tracking-widest text-faint",
										children: "Recent activity"
									}),
									activity.filter((item) => !site || item.siteId === site.id).slice(0, 8).map((item) => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("p", {
										className: "border-t border-line px-2 py-2 text-sm",
										children: [item.message, /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
											className: "mt-0.5 block text-xs text-faint",
											children: relTime(item.at)
										})]
									}, item.id)),
									!activity.filter((item) => !site || item.siteId === site.id).length ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
										className: "px-2 py-3 text-sm text-muted",
										children: "No activity yet."
									}) : null
								]
							}) : null]
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)(ThemePicker, {}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
							className: "relative",
							children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("button", {
								type: "button",
								"aria-expanded": workerPanel,
								"aria-label": "Writing service status",
								onClick: () => setWorkerPanel((value) => !value),
								className: cn("flex shrink-0 items-center gap-2 rounded-full border px-3 py-2 text-xs", workerPaused ? "border-danger/40 bg-danger/10 text-danger" : worker.online ? "border-brass/30 bg-brass/10 text-brass-2" : "border-line bg-elev text-muted"),
								children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { className: cn("size-2 rounded-full", workerPaused ? "bg-danger" : worker.online ? "pulse-dot bg-brass" : "bg-faint") }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
									className: "hidden sm:inline",
									children: workerPaused ? "Writing service paused" : worker.online ? `Writing service online · ${relTime(worker.lastBeatAt)}` : "Writing service starting…"
								})]
							}), workerPanel ? /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
								className: "absolute right-0 top-12 z-30 w-80 rounded-xl border border-line bg-elev p-3 text-sm",
								children: [
									/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
										className: "font-mono text-xs uppercase tracking-widest text-faint",
										children: "Writing service"
									}),
									/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("dl", {
										className: "mt-2 space-y-1.5",
										children: [
											/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
												className: "flex justify-between gap-3",
												children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("dt", {
													className: "text-muted",
													children: "State"
												}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("dd", {
													className: workerPaused ? "text-danger" : worker.online ? "text-ok" : "text-muted",
													children: workerPaused ? "paused by operator" : worker.online ? "online" : "no heartbeat yet"
												})]
											}),
											/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
												className: "flex justify-between gap-3",
												children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("dt", {
													className: "text-muted",
													children: "Last server beat"
												}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("dd", {
													className: "tnum",
													children: worker.lastBeatAt ? `${new Date(worker.lastBeatAt).toLocaleTimeString()} · ${relTime(worker.lastBeatAt)}` : "never"
												})]
											}),
											/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
												className: "flex justify-between gap-3",
												children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("dt", {
													className: "text-muted",
													children: "Active jobs"
												}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("dd", {
													className: "tnum",
													children: worker.activeJobs
												})]
											}),
											/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
												className: "flex justify-between gap-3",
												children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("dt", {
													className: "text-muted",
													children: "Next calendar pulse"
												}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("dd", {
													className: "tnum",
													children: worker.nextCalendarPulseAt ? new Date(worker.nextCalendarPulseAt).toLocaleString() : "nothing scheduled"
												})]
											}),
											/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
												className: "flex justify-between gap-3",
												children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("dt", {
													className: "text-muted",
													children: "Dispatch lease"
												}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("dd", {
													className: "truncate text-right",
													children: worker.leaseHolder ? `${worker.leaseHolder.slice(0, 14)}… ${worker.leaseExpiresAt ? `until ${new Date(worker.leaseExpiresAt).toLocaleTimeString()}` : ""}` : "free"
												})]
											}),
											/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
												className: "flex justify-between gap-3",
												children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("dt", {
													className: "text-muted",
													children: "Source"
												}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("dd", { children: worker.source })]
											})
										]
									}),
									/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
										className: "mt-2 text-xs leading-5 text-faint",
										children: "The lease is the single-dispatch guard: only one tab or server tick can advance the queue or publish at a time."
									}),
									/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Button, {
										className: "mt-3 min-h-9 w-full py-1.5 text-xs",
										variant: workerPaused ? "primary" : "ghost",
										onClick: () => setWorker(!workerPaused),
										children: workerPaused ? "Resume writing" : "Pause writing"
									})
								]
							}) : null]
						})
					]
				}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("main", {
					className: "min-w-0 flex-1 px-4 py-7 md:px-10 md:py-10",
					children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
						className: "mx-auto w-full max-w-6xl rise",
						children: site ? children : /* @__PURE__ */ (0, import_jsx_runtime.jsx)(WorkspacesPage, {})
					})
				})]
			}),
			palette ? /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
				className: "fixed inset-0 z-50 flex items-start justify-center bg-bg/80 px-4 pt-[12vh] backdrop-blur-sm",
				role: "dialog",
				"aria-modal": "true",
				"aria-label": "Search and commands",
				onKeyDown: (event) => {
					if (event.key === "Escape") setPalette(false);
				},
				children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
					className: "absolute inset-0",
					"aria-label": "Close search",
					onClick: () => setPalette(false)
				}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
					className: "relative w-full max-w-xl overflow-hidden rounded-xl border border-line/60 bg-elev shadow-2xl",
					children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("input", {
						ref: searchRef,
						autoFocus: true,
						value: query,
						onChange: (event) => setQuery(event.target.value),
						placeholder: "Search articles, runs, plans, or type a command",
						className: "min-h-12 w-full border-b border-line bg-transparent px-4 text-sm outline-none",
						"aria-label": "Search the studio"
					}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
						className: "max-h-80 overflow-y-auto p-2",
						children: [
							commands.map((row) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)(CommandRow, {
								label: row.label,
								hint: row.hint,
								onPick: () => {
									setPalette(false);
									if (row.href === "__setup") {
										setSetup(1);
										navigate({ to: "/" });
										return;
									}
									if (row.build) useApp.getState().buildSite();
								},
								href: row.href === "__setup" ? void 0 : row.href
							}, row.label)),
							themeCommands.map((theme) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)(CommandRow, {
								label: theme.label,
								hint: "Theme",
								onPick: () => {
									applyTheme(theme.id);
									setPalette(false);
								}
							}, theme.id)),
							results.map((result) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)(CommandRow, {
								label: result.label,
								hint: result.hint,
								href: result.href,
								onPick: () => setPalette(false)
							}, result.href + result.label))
						]
					})]
				})]
			}) : null,
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)(LiveWriter, {}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)(HumanizePipeline, {}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)(DeskWorkers, {}),
			notice ? /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
				className: "fixed bottom-4 left-4 right-4 z-50 mx-auto max-w-md rounded-lg border border-line bg-elev px-4 py-3 text-sm text-fg md:left-auto md:right-6",
				children: [notice.text, /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
					className: "ml-2 text-faint",
					children: relTime(Date.now())
				})]
			}) : null
		]
	});
}
function Brand() {
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Link, {
		to: "/",
		className: "flex items-center gap-3 px-4 py-5",
		children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(StudioMark, {}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
			className: "block text-sm font-semibold tracking-tight text-fg",
			children: "Ghost AI Writer"
		}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
			className: "mt-0.5 block text-xs text-faint",
			children: "Content desk"
		})] })]
	});
}
function SidebarNav({ path, onNavigate }) {
	const [expanded, setExpanded] = (0, import_react.useState)(() => Object.fromEntries(SHELL_GROUPS.map((group) => [group, true])));
	(0, import_react.useEffect)(() => {
		const current = NAV.find((item) => item.id !== "backup" && active(item.href, path));
		if (current) setExpanded((previous) => previous[current.group] ? previous : {
			...previous,
			[current.group]: true
		});
	}, [path]);
	return /* @__PURE__ */ (0, import_jsx_runtime.jsx)("nav", {
		"aria-label": "Main navigation",
		className: "min-h-0 flex-1 overflow-y-auto px-3 py-4",
		children: SHELL_GROUPS.map((group) => {
			const items = NAV.filter((item) => item.group === group);
			const isOpen = Boolean(expanded[group]);
			return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("section", {
				className: "mb-3",
				children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("button", {
					type: "button",
					"aria-expanded": isOpen,
					"aria-controls": `nav-${group.replaceAll(/[^a-z]+/gi, "-")}`,
					onClick: () => setExpanded((previous) => ({
						...previous,
						[group]: !previous[group]
					})),
					className: "flex min-h-10 w-full items-center justify-between rounded-lg px-3 text-left text-xs font-bold uppercase tracking-[0.08em] text-muted hover:bg-surface hover:text-fg",
					children: [group, /* @__PURE__ */ (0, import_jsx_runtime.jsx)(ChevronDown, {
						"aria-hidden": "true",
						className: cn("size-3.5 transition-transform", !isOpen && "-rotate-90")
					})]
				}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
					id: `nav-${group.replaceAll(/[^a-z]+/gi, "-")}`,
					hidden: !isOpen,
					className: "mt-1 space-y-1 pb-2",
					children: items.map((item) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)(NavLink, {
						item,
						path,
						onNavigate
					}, item.id))
				})]
			}, group);
		})
	});
}
function ghostDot(ghost) {
	if (ghost.status === "error") return "bg-danger";
	if (ghost.lastError) return "bg-brass";
	if (ghost.status === "connected") return "bg-ok";
	return "bg-faint";
}
function CommandRow({ label, hint, href, onPick }) {
	const className = "flex min-h-11 w-full items-center justify-between gap-3 rounded-lg px-3 text-left text-sm hover:bg-surface";
	if (!href) return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("button", {
		className,
		onClick: onPick,
		children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
			className: "truncate",
			children: label
		}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
			className: "shrink-0 font-mono text-xs uppercase tracking-wider text-faint",
			children: hint
		})]
	});
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Link, {
		to: href,
		className,
		onClick: onPick,
		children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
			className: "truncate",
			children: label
		}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
			className: "shrink-0 font-mono text-xs uppercase tracking-wider text-faint",
			children: hint
		})]
	});
}
function NavLink({ item, path, onNavigate }) {
	const Icon = item.Icon ?? LayoutDashboard;
	const on = item.id !== "backup" && active(item.href, path);
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Link, {
		to: item.href,
		onClick: onNavigate,
		"aria-current": on ? "page" : void 0,
		className: cn("flex min-h-11 items-center gap-3 rounded-xl px-3 text-sm font-medium transition-colors duration-150", on ? "bg-brass/10 font-semibold text-fg shadow-[inset_3px_0_0_var(--color-brass)]" : "text-muted hover:bg-surface hover:text-fg"),
		children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Icon, { className: cn("size-4 shrink-0", on ? "text-brass" : "text-faint") }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
			className: "truncate",
			children: item.label
		})]
	});
}
var styles_default = "/assets/styles-BU8lhhUq.css";
var Route$27 = createRootRoute({
	head: () => ({
		meta: [
			{ charSet: "utf-8" },
			{
				name: "viewport",
				content: "width=device-width, initial-scale=1"
			},
			{ title: "Ghost AI Writer" },
			{
				name: "description",
				content: "Six-stage content automation for Ghost. Single-shot writes, link graph, static delivery."
			}
		],
		links: [
			{
				rel: "icon",
				type: "image/svg+xml",
				href: "/favicon.svg"
			},
			{
				rel: "preconnect",
				href: "https://fonts.googleapis.com"
			},
			{
				rel: "preconnect",
				href: "https://fonts.gstatic.com",
				crossOrigin: "anonymous"
			},
			{
				rel: "stylesheet",
				href: "https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=JetBrains+Mono:wght@400;500;600;700&family=Plus+Jakarta+Sans:wght@400;500;600;700&display=swap"
			},
			{
				rel: "stylesheet",
				href: styles_default
			},
			{
				rel: "manifest",
				href: "/__grok/manifest.webmanifest"
			},
			{
				rel: "apple-touch-icon",
				href: "/__grok/icon-180.png"
			}
		]
	}),
	component: () => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("html", {
		lang: "en",
		suppressHydrationWarning: true,
		children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("head", { children: [
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("meta", {
				name: "theme-color",
				content: "#09090b"
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("script", { dangerouslySetInnerHTML: { __html: "(function(){try{var raw=localStorage.getItem(\"gaw-theme\");var t=raw;if(t===\"light\")t=\"paper\";if(t===\"dark\"||!t)t=\"midnight\";var ok={midnight:1,paper:1,forest:1,rose:1,sepia:1,ocean:1};if(!ok[t])t=\"midnight\";if(raw!==t)localStorage.setItem(\"gaw-theme\",t);var el=document.documentElement;el.setAttribute(\"data-theme\",t);el.classList.remove(\"light\");var c={midnight:\"#09090b\",paper:\"#fafafa\",forest:\"#0c1410\",rose:\"#fbf4f6\",sepia:\"#f4efe4\",ocean:\"#06141c\"}[t];var m=document.querySelector('meta[name=\"theme-color\"]');if(m)m.setAttribute(\"content\",c);}catch(e){}})();" } }),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)(HeadContent, {})
		] }), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("body", { children: [
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)(PreviewHostBridge, {}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)(AppCrashBoundary, { children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(AuthProvider, { children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(AppShell, { children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Outlet, {}) }) }) }),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Scripts, {})
		] })]
	})
});
var $$splitComponentImporter$26 = () => import("./routes-DunCUKo6.mjs");
var Route$26 = createFileRoute("/")({ component: lazyRouteComponent($$splitComponentImporter$26, "component") });
var $$splitComponentImporter$25 = () => import("./account-Cq3Xxy6K.mjs");
var Route$25 = createFileRoute("/account")({ component: lazyRouteComponent($$splitComponentImporter$25, "component") });
var $$splitComponentImporter$24 = () => import("./ai-keys-BOpp3Ecm.mjs");
var Route$24 = createFileRoute("/ai-keys")({ component: lazyRouteComponent($$splitComponentImporter$24, "component") });
var $$splitComponentImporter$23 = () => import("./analytics-GYwJs61f.mjs");
var Route$23 = createFileRoute("/analytics")({ component: lazyRouteComponent($$splitComponentImporter$23, "component") });
var $$splitComponentImporter$22 = () => import("./billing-Ce6tKj9u.mjs");
var Route$22 = createFileRoute("/billing")({ component: lazyRouteComponent($$splitComponentImporter$22, "component") });
var $$splitComponentImporter$21 = () => import("./connections-D2YrsRdz.mjs");
var Route$21 = createFileRoute("/connections")({ component: lazyRouteComponent($$splitComponentImporter$21, "component") });
var $$splitComponentImporter$20 = () => import("./create-DstlfTdm.mjs");
var Route$20 = createFileRoute("/create")({ component: lazyRouteComponent($$splitComponentImporter$20, "component") });
var $$splitComponentImporter$19 = () => import("./help-CeXI5B-e.mjs");
var Route$19 = createFileRoute("/help")({ component: lazyRouteComponent($$splitComponentImporter$19, "component") });
var $$splitComponentImporter$18 = () => import("./inbox-DF8_3MeI.mjs");
var Route$18 = createFileRoute("/inbox")({ component: lazyRouteComponent($$splitComponentImporter$18, "component") });
var $$splitComponentImporter$17 = () => import("./research-DLfGdpnk.mjs");
var Route$17 = createFileRoute("/research")({ component: lazyRouteComponent($$splitComponentImporter$17, "component") });
var $$splitComponentImporter$16 = () => import("./static-delivery-BuU8cRGt.mjs");
var Route$16 = createFileRoute("/static-delivery")({ component: lazyRouteComponent($$splitComponentImporter$16, "component") });
var $$splitComponentImporter$15 = () => import("./verify-email-lytm8R43.mjs");
var Route$15 = createFileRoute("/verify-email")({
	validateSearch: (search) => ({ token: typeof search.token === "string" ? search.token : "" }),
	component: lazyRouteComponent($$splitComponentImporter$15, "component")
});
var $$splitComponentImporter$14 = () => import("./workspaces-yMRJkkx7.mjs");
var Route$14 = createFileRoute("/workspaces")({ component: lazyRouteComponent($$splitComponentImporter$14, "component") });
var $$splitComponentImporter$13 = () => import("./articles.index-Cd1iqBtF.mjs");
var Route$13 = createFileRoute("/articles/")({ component: lazyRouteComponent($$splitComponentImporter$13, "component") });
var $$splitComponentImporter$12 = () => import("./articles._id-DilksRoh.mjs");
var Route$12 = createFileRoute("/articles/$id")({ component: lazyRouteComponent($$splitComponentImporter$12, "component") });
var $$splitComponentImporter$11 = () => import("./authors.index-DX64-1mq.mjs");
var Route$11 = createFileRoute("/authors/")({ component: lazyRouteComponent($$splitComponentImporter$11, "component") });
var $$splitComponentImporter$10 = () => import("./authors._id-XzgNid-l.mjs");
var Route$10 = createFileRoute("/authors/$id")({ component: lazyRouteComponent($$splitComponentImporter$10, "component") });
var $$splitComponentImporter$9 = () => import("./calendar.index-DkipTDYo.mjs");
var Route$9 = createFileRoute("/calendar/")({ component: lazyRouteComponent($$splitComponentImporter$9, "component") });
var $$splitComponentImporter$8 = () => import("./calendar._id-BAm2JZc4.mjs");
var Route$8 = createFileRoute("/calendar/$id")({ component: lazyRouteComponent($$splitComponentImporter$8, "component") });
var $$splitComponentImporter$7 = () => import("./preview.index-DtLkcieZ.mjs");
var Route$7 = createFileRoute("/preview/")({ component: lazyRouteComponent($$splitComponentImporter$7, "component") });
var $$splitComponentImporter$6 = () => import("./preview._slug-RwLYh-NN.mjs");
var Route$6 = createFileRoute("/preview/$slug")({ component: lazyRouteComponent($$splitComponentImporter$6, "component") });
var $$splitComponentImporter$5 = () => import("./runs.index-BbnwrTQC.mjs");
var Route$5 = createFileRoute("/runs/")({ component: lazyRouteComponent($$splitComponentImporter$5, "component") });
var $$splitComponentImporter$4 = () => import("./runs._id-CWdFlpYt.mjs");
var Route$4 = createFileRoute("/runs/$id")({ component: lazyRouteComponent($$splitComponentImporter$4, "component") });
var $$splitComponentImporter$3 = () => import("./settings.content-c3TMlmMx.mjs");
var Route$3 = createFileRoute("/settings/content")({ component: lazyRouteComponent($$splitComponentImporter$3, "component") });
var $$splitComponentImporter$2 = () => import("./settings.website-BNjp7sFN.mjs");
var Route$2 = createFileRoute("/settings/website")({ component: lazyRouteComponent($$splitComponentImporter$2, "component") });
var $$splitComponentImporter$1 = () => import("./topic-plans.index-DFI8eMwE.mjs");
var Route$1 = createFileRoute("/topic-plans/")({ component: lazyRouteComponent($$splitComponentImporter$1, "component") });
var $$splitComponentImporter = () => import("./topic-plans._id-v3zOFjsG.mjs");
var Route = createFileRoute("/topic-plans/$id")({ component: lazyRouteComponent($$splitComponentImporter, "component") });
var IndexRoute = Route$26.update({
	id: "/",
	path: "/",
	getParentRoute: () => Route$27
});
var AccountRoute = Route$25.update({
	id: "/account",
	path: "/account",
	getParentRoute: () => Route$27
});
var AiKeysRoute = Route$24.update({
	id: "/ai-keys",
	path: "/ai-keys",
	getParentRoute: () => Route$27
});
var AnalyticsRoute = Route$23.update({
	id: "/analytics",
	path: "/analytics",
	getParentRoute: () => Route$27
});
var BillingRoute = Route$22.update({
	id: "/billing",
	path: "/billing",
	getParentRoute: () => Route$27
});
var ConnectionsRoute = Route$21.update({
	id: "/connections",
	path: "/connections",
	getParentRoute: () => Route$27
});
var CreateRoute = Route$20.update({
	id: "/create",
	path: "/create",
	getParentRoute: () => Route$27
});
var HelpRoute = Route$19.update({
	id: "/help",
	path: "/help",
	getParentRoute: () => Route$27
});
var InboxRoute = Route$18.update({
	id: "/inbox",
	path: "/inbox",
	getParentRoute: () => Route$27
});
var ResearchRoute = Route$17.update({
	id: "/research",
	path: "/research",
	getParentRoute: () => Route$27
});
var StaticDeliveryRoute = Route$16.update({
	id: "/static-delivery",
	path: "/static-delivery",
	getParentRoute: () => Route$27
});
var VerifyEmailRoute = Route$15.update({
	id: "/verify-email",
	path: "/verify-email",
	getParentRoute: () => Route$27
});
var WorkspacesRoute = Route$14.update({
	id: "/workspaces",
	path: "/workspaces",
	getParentRoute: () => Route$27
});
var ArticlesIndexRoute = Route$13.update({
	id: "/articles/",
	path: "/articles/",
	getParentRoute: () => Route$27
});
var ArticlesIdRoute = Route$12.update({
	id: "/articles/$id",
	path: "/articles/$id",
	getParentRoute: () => Route$27
});
var AuthorsIndexRoute = Route$11.update({
	id: "/authors/",
	path: "/authors/",
	getParentRoute: () => Route$27
});
var AuthorsIdRoute = Route$10.update({
	id: "/authors/$id",
	path: "/authors/$id",
	getParentRoute: () => Route$27
});
var CalendarIndexRoute = Route$9.update({
	id: "/calendar/",
	path: "/calendar/",
	getParentRoute: () => Route$27
});
var CalendarIdRoute = Route$8.update({
	id: "/calendar/$id",
	path: "/calendar/$id",
	getParentRoute: () => Route$27
});
var PreviewIndexRoute = Route$7.update({
	id: "/preview/",
	path: "/preview/",
	getParentRoute: () => Route$27
});
var PreviewSlugRoute = Route$6.update({
	id: "/preview/$slug",
	path: "/preview/$slug",
	getParentRoute: () => Route$27
});
var RunsIndexRoute = Route$5.update({
	id: "/runs/",
	path: "/runs/",
	getParentRoute: () => Route$27
});
var RunsIdRoute = Route$4.update({
	id: "/runs/$id",
	path: "/runs/$id",
	getParentRoute: () => Route$27
});
var SettingsContentRoute = Route$3.update({
	id: "/settings/content",
	path: "/settings/content",
	getParentRoute: () => Route$27
});
var SettingsWebsiteRoute = Route$2.update({
	id: "/settings/website",
	path: "/settings/website",
	getParentRoute: () => Route$27
});
var TopicPlansIndexRoute = Route$1.update({
	id: "/topic-plans/",
	path: "/topic-plans/",
	getParentRoute: () => Route$27
});
var rootRouteChildren = {
	IndexRoute,
	AccountRoute,
	AiKeysRoute,
	AnalyticsRoute,
	BillingRoute,
	ConnectionsRoute,
	CreateRoute,
	HelpRoute,
	InboxRoute,
	ResearchRoute,
	StaticDeliveryRoute,
	VerifyEmailRoute,
	WorkspacesRoute,
	ArticlesIdRoute,
	AuthorsIdRoute,
	CalendarIdRoute,
	PreviewSlugRoute,
	RunsIdRoute,
	SettingsContentRoute,
	SettingsWebsiteRoute,
	TopicPlansIdRoute: Route.update({
		id: "/topic-plans/$id",
		path: "/topic-plans/$id",
		getParentRoute: () => Route$27
	}),
	ArticlesIndexRoute,
	AuthorsIndexRoute,
	CalendarIndexRoute,
	PreviewIndexRoute,
	RunsIndexRoute,
	TopicPlansIndexRoute
};
var routeTree = Route$27._addFileChildren(rootRouteChildren)._addFileTypes();
var router_exports = /* @__PURE__ */ __exportAll({ getRouter: () => getRouter });
function getRouter() {
	return createRouter({
		routeTree,
		defaultErrorComponent: AppErrorComponent
	});
}
//#endregion
export { testGhostConnection as A, fieldClass as B, rewrite_exports as C, probePublicUrl as D, ghost_functions_exports as E, Empty as F, statusTone as H, Field as I, PageIntro as L, Badge as M, Button as N, publishGhostPost as O, Card as P, SkeletonRows as R, researchDigest as S, writeWithModel as T, jobBadge as V, nearDuplicateSibling as _, Route$8 as a, humanizeMarkdown as b, Route$15 as c, ThemePicker as d, HumanizeBanner as f, duplicatePairs as g, bingScore as h, Route$6 as i, updateGhostPostHtml as j, syncGhostPosts as k, useBeat as l, bingChecks as m, Route as n, Route$10 as o, alignKeywordToQuery as p, Route$4 as r, Route$12 as s, router_exports as t, WorkspacesPage as u, articleFromMarkdown as v, siteChat as w, proposePlan as x, ensureMarkdownLinks as y, StateNote as z };
