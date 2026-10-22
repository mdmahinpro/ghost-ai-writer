import { i as __toESM } from "../_runtime.mjs";
import { $ as keyCallsModel, C as authorVoiceBlock, Ft as uniquenessAgainst, bt as relTime, et as keyPool, j as composeArticle, jt as stripVerify, ot as measureArticle, q as inboundCount, v as applyFetchedImages, x as articleImageSrc } from "./engine-DWsB6FrJ.mjs";
import { C as require_jsx_runtime, X as require_react, b as Link } from "../_libs/@tanstack/react-router+[...].mjs";
import { h as useHydrated, m as useApp } from "./store-CO3BA3x3.mjs";
import { B as fieldClass, F as Empty, H as statusTone, L as PageIntro, M as Badge, N as Button, P as Card, R as SkeletonRows, _ as nearDuplicateSibling, f as HumanizeBanner, h as bingScore, m as bingChecks, p as alignKeywordToQuery, v as articleFromMarkdown, y as ensureMarkdownLinks, z as StateNote } from "./router-DMHI1rJE.mjs";
import { t as AuthorAvatar } from "./authors-D2pc4RAf.mjs";
//#region node_modules/.nitro/vite/services/ssr/assets/articles-VpRdXWqP.js
var import_react = /* @__PURE__ */ __toESM(require_react());
var import_jsx_runtime = require_jsx_runtime();
function ArticlesPage() {
	const hydrated = useHydrated();
	const siteId = useApp((s) => s.activeSiteId);
	const allArticles = useApp((s) => s.articles);
	const articles = (0, import_react.useMemo)(() => allArticles.filter((article) => article.siteId === siteId), [allArticles, siteId]);
	const [q, setQ] = (0, import_react.useState)("");
	const [status, setStatus] = (0, import_react.useState)("all");
	const [engine, setEngine] = (0, import_react.useState)("all");
	const [picked, setPicked] = (0, import_react.useState)([]);
	const deleteArticles = useApp((s) => s.deleteArticles);
	const rows = (0, import_react.useMemo)(() => articles.filter((article) => {
		const hit = `${article.title} ${article.slug} ${article.keyword}`.toLowerCase().includes(q.trim().toLowerCase());
		const statusOk = status === "all" || article.status === status;
		const engineOk = engine === "all" || article.engine === engine;
		return hit && statusOk && engineOk;
	}), [
		articles,
		q,
		status,
		engine
	]);
	function exportCsv() {
		const header = [
			"title",
			"slug",
			"engine",
			"status",
			"links",
			"images",
			"uniqueness",
			"published"
		];
		const body = rows.map((article) => [
			article.title,
			article.slug,
			article.engine,
			article.status,
			String(article.links.length),
			String(article.images.length),
			String(article.uniqueness),
			new Date(article.publishedAt).toISOString()
		].map((cell) => `"${cell.replace(/"/g, "\"\"")}"`).join(","));
		const blob = new Blob([[header.join(","), ...body].join("\n")], { type: "text/csv" });
		const url = URL.createObjectURL(blob);
		const a = document.createElement("a");
		a.href = url;
		a.download = "articles.csv";
		a.click();
		URL.revokeObjectURL(url);
	}
	if (!hydrated) return /* @__PURE__ */ (0, import_jsx_runtime.jsx)(SkeletonRows, { rows: 4 });
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [
		/* @__PURE__ */ (0, import_jsx_runtime.jsx)(PageIntro, {
			eyebrow: "Content",
			title: "Articles",
			lede: "Inventory from single-shot writes. Search stays on this website."
		}),
		articles.some((article) => article.humanState === "needs-key") ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
			className: "mb-4",
			children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(StateNote, {
				tone: "partial",
				title: `${articles.filter((article) => article.humanState === "needs-key").length} article(s) waiting on humanization`,
				body: "Those drafts were written and are held honestly: the bulletproof humanization pass has not finished yet. Live publishing stays blocked until the blader humanizer marks them done."
			})
		}) : null,
		/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
			className: "mb-4 flex flex-wrap gap-2",
			children: [
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)("input", {
					className: `${fieldClass} max-w-sm`,
					value: q,
					onChange: (e) => setQ(e.target.value),
					placeholder: "Search title, slug, keyword",
					"aria-label": "Filter articles"
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("select", {
					className: `${fieldClass} max-w-40`,
					value: status,
					onChange: (e) => setStatus(e.target.value),
					"aria-label": "Status",
					children: [
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)("option", {
							value: "all",
							children: "All statuses"
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)("option", {
							value: "draft",
							children: "Draft"
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)("option", {
							value: "published",
							children: "Published"
						})
					]
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("select", {
					className: `${fieldClass} max-w-40`,
					value: engine,
					onChange: (e) => setEngine(e.target.value),
					"aria-label": "Engine",
					children: [
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)("option", {
							value: "all",
							children: "All engines"
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)("option", {
							value: "llm",
							children: "LLM"
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)("option", {
							value: "fallback",
							children: "Fallback"
						})
					]
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Button, {
					variant: "ghost",
					onClick: exportCsv,
					disabled: !rows.length,
					children: "Export CSV"
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Button, {
					variant: "ghost",
					disabled: !picked.length,
					onClick: () => {
						deleteArticles(picked);
						setPicked([]);
					},
					children: ["Delete selected", picked.length ? ` (${picked.length})` : ""]
				})
			]
		}),
		!rows.length ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Empty, {
			title: "No articles",
			body: "Completed jobs land here with a Ghost ledger, downloaded photos, and internal links."
		}) : /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Card, {
			className: "overflow-x-auto",
			children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("table", {
				className: "w-full min-w-xl text-left text-sm",
				children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("thead", {
					className: "border-b border-line text-xs uppercase tracking-widest text-faint",
					children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("tr", { children: [
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)("th", {
							className: "px-3 py-3 font-medium",
							children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)("input", {
								type: "checkbox",
								"aria-label": "Select all shown articles",
								checked: rows.length > 0 && rows.every((article) => picked.includes(article.id)),
								onChange: (event) => setPicked(event.target.checked ? rows.map((article) => article.id) : [])
							})
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)("th", {
							className: "px-4 py-3 font-medium",
							children: "Title"
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)("th", {
							className: "px-3 py-3 font-medium",
							children: "Engine"
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)("th", {
							className: "px-3 py-3 font-medium",
							children: "Status"
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)("th", {
							className: "px-3 py-3 font-medium",
							children: "Links"
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)("th", {
							className: "px-3 py-3 font-medium",
							children: "Images"
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)("th", {
							className: "px-3 py-3 font-medium",
							children: "Unique"
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)("th", {
							className: "px-3 py-3 font-medium",
							children: "When"
						})
					] })
				}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("tbody", { children: rows.map((article) => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("tr", {
					className: "border-b border-line last:border-0",
					children: [
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)("td", {
							className: "px-3 py-3",
							children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)("input", {
								type: "checkbox",
								"aria-label": `Select ${article.title}`,
								checked: picked.includes(article.id),
								onChange: (event) => setPicked((current) => event.target.checked ? [...current, article.id] : current.filter((id) => id !== article.id))
							})
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("td", {
							className: "px-4 py-3",
							children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Link, {
								to: "/articles/$id",
								params: { id: article.id },
								className: "font-medium",
								children: article.title
							}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
								className: "text-xs text-faint",
								children: [
									"/",
									article.slug,
									article.authorName ? ` · ${article.authorName}` : ""
								]
							})]
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)("td", {
							className: "px-3 py-3",
							children: article.engine
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)("td", {
							className: "px-3 py-3",
							children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Badge, {
								tone: statusTone(article.status),
								children: article.status
							})
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("td", {
							className: "px-3 py-3",
							children: [
								article.links.length,
								" out · ",
								inboundCount(articles, article.slug),
								" in"
							]
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)("td", {
							className: "px-3 py-3",
							children: article.images.filter((image) => image.selected).length
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("td", {
							className: "px-3 py-3",
							children: [Math.round(uniquenessAgainst(article.title, article.keyword, articles.filter((other) => other.id !== article.id).map((other) => ({
								keyword: other.keyword,
								title: other.title,
								slug: other.slug,
								sample: `${other.title}. ${other.sections.map((section) => section.heading).join(". ")}`
							})), article.sections) * 100), "%"]
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)("td", {
							className: "px-3 py-3 text-muted",
							children: relTime(article.publishedAt)
						})
					]
				}, article.id)) })]
			})
		})
	] });
}
function ArticleDetail({ id }) {
	const hydrated = useHydrated();
	const articles = useApp((s) => s.articles);
	const siteId = useApp((s) => s.activeSiteId);
	const site = useApp((s) => s.sites.find((item) => item.id === siteId));
	const authors = useApp((s) => s.authors);
	const article = articles.find((item) => item.id === id);
	const corpus = (0, import_react.useMemo)(() => articles.filter((item) => item.siteId === siteId), [articles, siteId]);
	const author = authors.find((item) => item.id === article?.authorId);
	const patchSite = useApp((s) => s.patchSite);
	const [publicUrl, setPublicUrl] = (0, import_react.useState)(site?.publicUrl ?? "");
	const [copied, setCopied] = (0, import_react.useState)("");
	const [busy, setBusy] = (0, import_react.useState)(false);
	const [note, setNote] = (0, import_react.useState)("");
	if (!hydrated) return /* @__PURE__ */ (0, import_jsx_runtime.jsx)(SkeletonRows, { rows: 5 });
	if (!article) return /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Empty, {
		title: "Article missing",
		body: "It is not in this studio ledger."
	});
	const checks = bingChecks(article, corpus, site);
	const score = bingScore(checks);
	function fixCheck(id) {
		if (!article) return;
		if (id === "index") {
			const url = publicUrl.trim();
			patchSite({
				robots: "index,follow",
				...url ? { publicUrl: url } : {}
			});
			setNote(url ? "Robots set to index,follow and the public URL saved. Submit the URL list with IndexNow from Static Delivery." : "Robots set to index,follow. Add the public URL above to finish this check.");
			return;
		}
		if (id === "query") {
			useApp.getState().patchArticle(article.id, alignKeywordToQuery(article));
			setNote("The query now leads the title and the opening paragraph in plain language — no heading stuffing.");
			return;
		}
		if (id === "unique") {
			const other = nearDuplicateSibling(article, corpus);
			if (other) {
				const withLink = (target, source) => target.links.some((link) => link.targetSlug === source.slug) ? target.links : [...target.links, {
					anchor: source.title,
					targetSlug: source.slug,
					state: "LOCAL"
				}];
				useApp.getState().patchArticle(article.id, { links: withLink(article, other) });
				useApp.getState().patchArticle(other.id, { links: withLink(other, article) });
				setNote(`Kept one URL per intent: linked this page and “${other.title}” to each other instead of rewriting the same angle.`);
			} else setNote("This draft overlaps its own corpus. Use “Regenerate draft” to rewrite it from a new angle.");
			return;
		}
		setNote("That check is informational — it is reported, but there is nothing to auto-fix.");
	}
	async function copy(kind) {
		await navigator.clipboard.writeText(kind === "html" ? article.html : article.markdown);
		setCopied(kind);
	}
	async function humanize() {
		setBusy(true);
		setNote("");
		try {
			const { humanizeWithBlader } = await import("./engine-DWsB6FrJ.mjs").then((n) => n.L).then((n) => n.X);
			const { keyPoolChat } = await import("../_libs/_2.mjs").then((n) => n.o);
			const state = useApp.getState();
			const result = await humanizeWithBlader({
				chat: keyPoolChat({
					keys: keyPool(state, site?.voice.modelKeyId, Date.now()).filter((key) => keyCallsModel(key)),
					onPenalty: (keyId, status, error) => useApp.getState().penalizeKey(keyId, status, error)
				}),
				markdown: article.markdown,
				keyword: article.keyword,
				title: article.title,
				authorName: author?.name ?? article.authorName,
				authorVoice: author ? authorVoiceBlock(author) : void 0,
				authorBannedPhrases: [...site?.voice.bannedPhrases ?? [], ...author?.voice.bannedPhrases ?? []]
			});
			const linked = ensureMarkdownLinks(result.markdown, article.links.map((link) => ({
				anchor: link.anchor,
				slug: link.targetSlug
			})));
			const body = articleFromMarkdown(linked);
			const withImages = applyFetchedImages(body.html, body.markdown, article.images, article.keyword);
			useApp.getState().patchArticle(article.id, {
				...body,
				html: withImages.html,
				markdown: withImages.markdown,
				humanized: true,
				humanNote: result.note,
				humanizerScore: result.score,
				humanizerStripped: result.stripped,
				humanizerPasses: result.passes,
				humanizerNote: result.note,
				bulletproof: true
			});
			setNote(`${result.note} · prose purity ${result.score}/100`);
		} catch (error) {
			setNote(error instanceof Error ? error.message : "Humanization failed.");
		} finally {
			setBusy(false);
		}
	}
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
		className: "grid gap-4 lg:grid-cols-5",
		children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
			className: "space-y-4 lg:col-span-3",
			children: [
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)(PageIntro, {
					eyebrow: article.keyword,
					title: article.title,
					lede: article.excerpt
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)(HumanizeBanner, {}),
				!article.humanized ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Card, {
					className: "p-4 text-sm leading-6 text-muted",
					children: article.humanState === "running" || article.humanState === "pending" ? "Blader humanizer is auditing this draft for AI tells." : article.humanNote || "Blader humanizer queued. A deterministic pass always runs; a live key adds the surgical audit + rewrite."
				}) : /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Card, {
					className: "p-4 text-sm text-muted",
					children: article.humanNote || "Blader humanizer pass is done."
				}),
				article.humanized && typeof article.humanizerScore === "number" ? /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Card, {
					className: "space-y-3 p-4",
					children: [
						/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
							className: "flex flex-wrap items-center justify-between gap-2",
							children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
								className: "text-xs uppercase tracking-widest text-faint",
								children: "Blader humanizer"
							}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
								className: "flex gap-2",
								children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Badge, {
									tone: article.humanizerScore >= 90 ? "ok" : article.humanizerScore >= 70 ? "brass" : "danger",
									children: [
										"prose purity ",
										article.humanizerScore,
										"/100"
									]
								}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Badge, {
									tone: "muted",
									children: article.humanizerPasses === 2 ? "audit + rewrite (2 passes)" : "deterministic pass"
								})]
							})]
						}),
						article.humanizerStripped?.length ? /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
							className: "text-xs text-faint",
							children: "AI patterns stripped in Stage 3 revision:"
						}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("ul", {
							className: "mt-1 flex flex-wrap gap-1.5",
							children: article.humanizerStripped.map((pattern, index) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)("li", {
								className: "rounded border border-line px-2 py-0.5 font-mono text-xs text-muted",
								children: pattern
							}, `${pattern}-${index}`))
						})] }) : /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
							className: "text-xs text-faint",
							children: "No AI patterns remained after the pass."
						}),
						article.humanizerNote ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
							className: "text-xs text-faint",
							children: article.humanizerNote
						}) : null
					]
				}) : null,
				/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
					className: "flex flex-wrap gap-2",
					children: [
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Badge, {
							tone: statusTone(article.status),
							children: article.status
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Badge, {
							tone: "muted",
							children: article.engine
						}),
						article.tags.map((tag) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Badge, { children: tag }, tag))
					]
				}),
				!article.html.includes("<img") ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Card, {
					className: "p-4 text-sm text-muted",
					children: article.imageState === "empty" ? "No Bing photo passed the size check for this draft." : "Matching a Bing photo for this draft…"
				}) : null,
				/* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Card, {
					className: "p-5",
					children: [
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)("article", {
							className: "reading-prose mx-auto text-fg [&_a]:text-brass",
							onClick: (event) => {
								if (!event.target.closest("a")) return;
								event.preventDefault();
							},
							dangerouslySetInnerHTML: { __html: stripVerify(article.html) }
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
							className: "mt-4 flex flex-wrap gap-2",
							children: [
								/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Button, {
									variant: "ghost",
									onClick: () => void copy("html"),
									children: copied === "html" ? "HTML copied" : "Copy HTML"
								}),
								/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Button, {
									variant: "ghost",
									onClick: () => void copy("md"),
									children: copied === "md" ? "Markdown copied" : "Copy Markdown"
								}),
								/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Button, {
									onClick: () => void humanize(),
									disabled: busy,
									children: busy ? "Humanizing…" : "Bulletproof humanize"
								}),
								/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Button, {
									variant: "ghost",
									onClick: () => useApp.getState().patchArticle(article.id, {
										imageSalt: (article.imageSalt ?? 0) + 1,
										imageState: "pending",
										images: article.images.map((image) => ({
											...image,
											src: void 0,
											selected: false
										}))
									}),
									children: "Refresh photos"
								}),
								/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Button, {
									onClick: () => {
										const state = useApp.getState();
										const keyId = site?.voice.modelKeyId;
										const key = state.keys.find((item) => item.id === keyId);
										if (key?.secret && key.baseUrl) {
											state.patchArticle(article.id, {
												liveState: "pending",
												liveError: void 0,
												imageSalt: (article.imageSalt ?? 0) + 1,
												imageState: "pending",
												images: article.images.map((image) => ({
													...image,
													src: void 0,
													selected: false
												}))
											});
											setNote("Regenerating with your model. Photos are fetched after the new draft.");
											return;
										}
										const angles = [
											"time",
											"money",
											"skip",
											"alternative",
											"daily",
											"compare",
											"conversation",
											"stop"
										];
										const angle = angles[((article.imageSalt ?? 0) + 1) % angles.length];
										const composed = composeArticle({
											title: article.title,
											keyword: article.keyword,
											angle,
											tone: site?.voice.tone ?? "plain",
											sectionCount: site?.voice.sections ?? 5,
											imageCount: site?.voice.sectionImages ?? 2,
											links: article.links.map((link) => ({
												anchor: link.anchor,
												slug: link.targetSlug
											})),
											nicheTag: site?.nicheTag ?? "notes",
											corpus: corpus.filter((item) => item.id !== article.id).map((item) => ({
												keyword: item.keyword,
												title: item.title,
												slug: item.slug,
												sample: `${item.title}. ${item.sections.map((section) => section.heading).join(". ")}`
											}))
										});
										state.patchArticle(article.id, {
											html: composed.html,
											markdown: composed.markdown,
											excerpt: composed.excerpt,
											sections: composed.sections,
											words: composed.words,
											uniqueness: composed.uniqueness,
											engine: "fallback",
											liveState: "skipped",
											imageSalt: (article.imageSalt ?? 0) + 1,
											imageState: "pending",
											images: composed.images
										});
										setNote("Rewrote the draft from the next angle and queued new photos.");
									},
									children: "Regenerate draft"
								}),
								article.ghostPush === "error" ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Button, {
									variant: "ghost",
									onClick: () => useApp.getState().patchArticle(article.id, {
										ghostPush: "pending",
										liveError: void 0
									}),
									children: "Retry Ghost publish"
								}) : null,
								/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Link, {
									to: "/preview/$slug",
									params: { slug: article.slug },
									className: "inline-flex min-h-11 items-center text-sm text-brass",
									children: "Preview static page"
								})
							]
						}),
						note || article.humanNote || article.liveError || article.liveState === "running" || article.liveState === "pending" ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
							className: "mt-3 text-sm text-muted",
							children: article.liveState === "pending" || article.liveState === "running" ? "Live model is writing this draft." : note || article.liveError || article.humanNote
						}) : null
					]
				})
			]
		}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
			className: "space-y-4 lg:col-span-2",
			children: [
				/* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Card, {
					className: "grid grid-cols-2 gap-3 p-4 text-sm",
					children: [
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Stat, {
							k: "Uniqueness",
							v: `${Math.round(uniquenessAgainst(article.title, article.keyword, corpus.filter((item) => item.id !== article.id).map((item) => ({
								keyword: item.keyword,
								title: item.title,
								slug: item.slug,
								sample: `${item.title}. ${item.sections.map((section) => section.heading).join(". ")}`
							})), article.sections) * 100)}%`
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Stat, {
							k: "Coverage",
							v: `${Math.round(measureArticle(article).coverage * 100)}%`
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Stat, {
							k: "Intent match",
							v: `${Math.round(measureArticle(article).intent * 100)}%`
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Stat, {
							k: "Words",
							v: String(article.words)
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Stat, {
							k: "Links",
							v: `${article.links.length} out · ${inboundCount(corpus, article.slug)} in`
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Stat, {
							k: "Bing",
							v: `${Math.floor(score * 100)}%`
						})
					]
				}),
				author ? /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Card, {
					className: "p-4 text-sm",
					children: [
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
							className: "text-xs uppercase tracking-widest text-faint",
							children: "Author"
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
							className: "mt-2 flex items-start gap-3",
							children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(AuthorAvatar, {
								author,
								size: 48
							}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
								className: "min-w-0",
								children: [
									/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Link, {
										to: "/authors/$id",
										params: { id: author.id },
										className: "block text-lg font-semibold tracking-tight",
										children: author.name
									}),
									/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("p", {
										className: "text-muted",
										children: [
											author.role,
											" · ",
											author.city,
											", ",
											author.region,
											", US"
										]
									}),
									/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("p", {
										className: "mt-1 text-xs text-faint",
										children: [
											author.articleCount,
											"/",
											author.maxArticles,
											" articles · ",
											author.ghostAuthorId ? `Ghost · ${author.ghostAuthorId}` : "local byline"
										]
									})
								]
							})]
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
							className: "mt-2 leading-6 text-muted",
							children: author.shortBio
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
							className: "mt-2 flex flex-wrap gap-1.5",
							children: author.expertise.map((tag) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
								className: "rounded-full border border-line px-2 py-0.5 text-xs text-muted",
								children: tag
							}, tag))
						})
					]
				}) : null,
				/* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Card, {
					className: "p-4 text-sm",
					children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h2", {
						className: "text-lg font-semibold tracking-tight",
						children: "Bing checklist"
					}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("ul", {
						className: "mt-3 space-y-2",
						children: checks.map((check) => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("li", { children: [
							/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
								className: "flex items-center justify-between gap-2",
								children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { children: check.label }), check.pass ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Badge, {
									tone: "ok",
									children: "pass"
								}) : /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", {
									className: "flex items-center gap-2",
									children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Badge, {
										tone: "danger",
										children: "fix"
									}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Button, {
										variant: "ghost",
										className: "min-h-8 px-2 text-xs",
										onClick: () => fixCheck(check.id),
										children: "Fix"
									})]
								})]
							}),
							!check.pass ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
								className: "mt-1 text-xs leading-5 text-muted",
								children: check.tip
							}) : null,
							check.id === "index" && !check.pass && !site?.publicUrl ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("input", {
								className: `${fieldClass} mt-2 text-xs`,
								value: publicUrl,
								onChange: (event) => setPublicUrl(event.target.value),
								placeholder: "https://your-site.com",
								"aria-label": "Public URL"
							}) : null
						] }, check.id))
					})]
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Card, {
					className: "p-4 text-sm",
					children: [
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h2", {
							className: "font-display text-xl",
							children: "Ghost publish ledger"
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("p", {
							className: "mt-2 text-muted",
							children: ["CONFIRMED · single-shot invariant. shots = ", article.ledger.shots]
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("dl", {
							className: "mt-3 space-y-1 text-xs",
							children: [
								/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: ["Mode ", article.ledger.mode] }),
								/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: ["Post ", article.ledger.postId] }),
								/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: ["Dispatched ", new Date(article.ledger.dispatchedAt).toISOString()] }),
								/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: ["Confirmed ", new Date(article.ledger.confirmedAt).toISOString()] })
							]
						})
					]
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Card, {
					className: "p-4",
					children: [
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h2", {
							className: "font-display text-xl",
							children: "Internal links"
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("p", {
							className: "mt-1 text-xs text-faint",
							children: [
								inboundCount(corpus, article.slug),
								" inbound · ",
								article.links.length,
								" outbound · /post/slug/"
							]
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("ul", {
							className: "mt-2 space-y-2 text-sm",
							children: [article.links.map((link) => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("li", {
								className: "flex items-center justify-between gap-2",
								children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", { children: [link.anchor, /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", {
									className: "mt-0.5 block font-mono text-xs text-faint",
									children: [
										"/post/",
										link.targetSlug,
										"/"
									]
								})] }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Badge, {
									tone: statusTone(link.state),
									children: link.state
								})]
							}, link.targetSlug)), !article.links.length ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("li", {
								className: "text-muted",
								children: "No verified target in inventory yet."
							}) : null]
						})
					]
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Card, {
					className: "space-y-3 p-4",
					children: [
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h2", {
							className: "font-display text-xl",
							children: "Images"
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
							className: "text-xs leading-5 text-muted",
							children: "Every slot resolves a real, topic-matched Bing thumbnail URL (dynamic, zero disk). A downloaded copy is uploaded to Ghost only when Ghost is live; the exported static site keeps the Bing URL."
						}),
						article.images.map((image) => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)("img", {
								src: articleImageSrc(image, article.keyword || article.title),
								alt: image.alt,
								width: image.width || 474,
								height: image.height || 274,
								loading: "lazy",
								decoding: "async",
								referrerPolicy: "no-referrer",
								className: "aspect-video w-full rounded-lg object-cover"
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
								className: "mt-1 text-xs text-muted",
								children: [
									image.role,
									" · ",
									image.width || "…",
									"×",
									image.height || "…",
									" · c=7 · ",
									image.selected ? "SELECTED" : "waiting",
									" · ",
									image.license ?? "unknown-bing"
								]
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
								className: "mt-1 break-all font-mono text-xs text-faint",
								children: articleImageSrc(image, article.keyword || article.title)
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
								className: "text-xs text-muted",
								children: image.alt
							})
						] }, `${image.role}-${image.query}`))
					]
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Card, {
					className: "p-4 text-sm",
					children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h2", {
						className: "font-display text-xl",
						children: "Stage tokens"
					}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("ul", {
						className: "mt-2 space-y-1 font-mono text-xs text-muted",
						children: article.stageTokens.map((tokens, index) => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("li", { children: [
							"Stage ",
							index + 1,
							": ",
							tokens,
							index === 5 ? " · validation is 0 LLM tokens" : ""
						] }, index))
					})]
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Card, {
					className: "p-4 text-sm",
					children: [
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h2", {
							className: "font-display text-xl",
							children: "Revision notes"
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
							className: "mt-2 leading-6 text-muted",
							children: article.revisionNotes
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h3", {
							className: "mt-4 text-fg",
							children: "Must-cover"
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)("ul", {
							className: "mt-2 list-disc space-y-1 pl-4 text-muted",
							children: article.mustCover.map((item) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)("li", { children: item }, item))
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h3", {
							className: "mt-4 text-fg",
							children: "Verify"
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
							className: "mt-1 text-xs text-muted",
							children: "Verify before publish"
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)("ul", {
							className: "mt-2 space-y-1 text-brass-2",
							children: article.verifyFlags.map((flag) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)("li", { children: flag }, flag))
						})
					]
				})
			]
		})]
	});
}
function Stat({ k, v }) {
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
		className: "text-xs uppercase tracking-widest text-faint",
		children: k
	}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
		className: "font-display text-2xl",
		children: v
	})] });
}
//#endregion
export { ArticlesPage as n, ArticleDetail as t };
