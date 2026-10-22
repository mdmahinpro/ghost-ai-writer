import { i as __toESM } from "../_runtime.mjs";
import { jt as stripVerify } from "./engine-DWsB6FrJ.mjs";
import { C as require_jsx_runtime, X as require_react, b as Link } from "../_libs/@tanstack/react-router+[...].mjs";
import { m as useApp } from "./store-CO3BA3x3.mjs";
//#region node_modules/.nitro/vite/services/ssr/assets/preview-Dmmg-9kp.js
var import_react = /* @__PURE__ */ __toESM(require_react());
var import_jsx_runtime = require_jsx_runtime();
/** Graceful state shown when the workspace has no website to preview yet. */
function NoSiteYet({ to, label }) {
	return /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
		className: "grid min-h-screen place-items-center bg-paper px-6 text-paper-ink",
		children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
			className: "text-center",
			children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", { children: "No website to preview yet. Create one in the studio first." }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Link, {
				to,
				className: "mt-3 inline-block text-sm underline",
				children: label
			})]
		})
	});
}
function PreviewHome() {
	const siteId = useApp((s) => s.activeSiteId);
	const site = useApp((s) => s.sites.find((item) => item.id === s.activeSiteId) ?? s.sites[0]);
	const allArticles = useApp((s) => s.articles);
	const articles = (0, import_react.useMemo)(() => allArticles.filter((article) => article.siteId === siteId), [allArticles, siteId]);
	if (!site) return /* @__PURE__ */ (0, import_jsx_runtime.jsx)(NoSiteYet, {
		to: "/static-delivery",
		label: "Back to studio"
	});
	return /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
		className: "min-h-screen bg-paper text-paper-ink",
		children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
			className: "mx-auto w-full max-w-2xl px-5 py-8",
			children: [
				/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
					className: "flex items-center justify-between gap-3",
					children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
						className: "font-sans text-xs uppercase tracking-widest text-paper-muted",
						children: site.staticName
					}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Link, {
						to: "/static-delivery",
						className: "font-sans text-xs text-paper-muted",
						children: "Back to studio"
					})]
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h1", {
					className: "mt-6 font-display text-5xl leading-none",
					children: site.staticName
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
					className: "mt-4 text-lg leading-8",
					children: site.footer
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)("ul", {
					className: "mt-8 grid gap-4 sm:grid-cols-2",
					children: articles.map((article) => {
						const photo = (article.images ?? []).find((image) => image.selected && image.src);
						return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("li", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Link, {
							to: "/preview/$slug",
							params: { slug: article.slug },
							className: "block",
							children: [photo ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("img", {
								src: photo.src,
								alt: "",
								className: "aspect-video w-full rounded-lg object-cover"
							}) : null, /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
								className: "mt-2 block font-display text-2xl",
								children: article.title
							})]
						}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("p", {
							className: "mt-1 font-sans text-sm text-paper-muted",
							children: [
								article.keyword,
								" · ",
								article.words,
								" words · ",
								article.links.length,
								" links"
							]
						})] }, article.id);
					})
				}),
				!articles.length ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
					className: "mt-8 text-paper-muted",
					children: "This website has no pages yet."
				}) : null,
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
					className: "mt-10 font-sans text-xs text-paper-muted",
					children: site.authors
				})
			]
		})
	});
}
function PreviewArticle({ slug }) {
	const site = useApp((s) => s.sites.find((item) => item.id === s.activeSiteId) ?? s.sites[0]);
	const article = useApp((s) => s.articles.find((item) => item.siteId === s.activeSiteId && item.slug === slug));
	if (!site) return /* @__PURE__ */ (0, import_jsx_runtime.jsx)(NoSiteYet, {
		to: "/static-delivery",
		label: "Back to studio"
	});
	if (!article) return /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
		className: "grid min-h-screen place-items-center bg-paper px-6 text-paper-ink",
		children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", { children: "That page is not in the current website." }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Link, {
			to: "/preview",
			className: "mt-3 inline-block text-sm",
			children: "Home"
		})] })
	});
	return /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
		className: "min-h-screen bg-paper text-paper-ink",
		children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("article", {
			className: "mx-auto w-full max-w-[72ch] px-5 py-8 sm:py-12",
			children: [
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Link, {
					to: "/preview",
					className: "font-sans text-xs uppercase tracking-widest text-paper-muted",
					children: site.staticName
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
					className: "mt-6 font-sans text-xs uppercase tracking-widest text-paper-muted",
					children: article.keyword
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h1", {
					className: "mt-2 font-display text-4xl leading-tight sm:text-5xl",
					children: article.title
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
					className: "reading-prose mt-8 text-lg [&_a]:underline",
					dangerouslySetInnerHTML: { __html: stripVerify(article.html) }
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
					className: "mt-10 font-sans text-sm text-paper-muted",
					children: site.footer
				})
			]
		})
	});
}
//#endregion
export { PreviewHome as n, PreviewArticle as t };
