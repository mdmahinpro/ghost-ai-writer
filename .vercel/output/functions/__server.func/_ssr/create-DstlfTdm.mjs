import { i as __toESM } from "../_runtime.mjs";
import { $ as keyCallsModel, et as keyPool } from "./engine-DWsB6FrJ.mjs";
import { C as require_jsx_runtime, X as require_react, b as Link, x as useNavigate } from "../_libs/@tanstack/react-router+[...].mjs";
import { h as useHydrated, m as useApp, s as classifyLines } from "./store-CO3BA3x3.mjs";
import { B as fieldClass, I as Field, L as PageIntro, M as Badge, N as Button, P as Card, x as proposePlan } from "./router-DMHI1rJE.mjs";
//#region node_modules/.nitro/vite/services/ssr/assets/create-DstlfTdm.js
var import_react = /* @__PURE__ */ __toESM(require_react());
var import_jsx_runtime = require_jsx_runtime();
var SAMPLE = "how to narrow a research question\nfield notes after a failed experiment\nreading lists that stay short";
function CreatePage() {
	const navigate = useNavigate();
	const hydrated = useHydrated();
	const siteId = useApp((s) => s.activeSiteId);
	const site = useApp((s) => s.sites.find((item) => item.id === s.activeSiteId) ?? s.sites[0]);
	const keys = useApp((s) => s.keys);
	const limits = useApp((s) => s.limits);
	const ideas = useApp((s) => s.ideas);
	const plansAll = useApp((s) => s.plans);
	const plans = (0, import_react.useMemo)(() => plansAll.filter((plan) => plan.siteId === siteId), [plansAll, siteId]);
	const nicheIdeas = ideas?.siteId === siteId ? ideas : null;
	const queueKeywords = useApp((s) => s.queueKeywords);
	const runIdeas = useApp((s) => s.runIdeas);
	const clearCooldowns = useApp((s) => s.clearCooldowns);
	const makePlan = useApp((s) => s.makePlan);
	const failPlan = useApp((s) => s.failPlan);
	const installModelPlan = useApp((s) => s.installModelPlan);
	const [planning, setPlanning] = (0, import_react.useState)(false);
	const [tab, setTab] = (0, import_react.useState)("keywords");
	const [lines, setLines] = (0, import_react.useState)("");
	const [publishMode, setPublishMode] = (0, import_react.useState)("draft");
	const [modelKeyId, setModelKeyId] = (0, import_react.useState)("default");
	const [variants, setVariants] = (0, import_react.useState)(false);
	const [bulletproof, setBulletproof] = (0, import_react.useState)(false);
	const [research, setResearch] = (0, import_react.useState)("");
	const [niche, setNiche] = (0, import_react.useState)(site.nicheTag.replace(/-/g, " "));
	const [ideaCount, setIdeaCount] = (0, import_react.useState)(8);
	const [thinking, setThinking] = (0, import_react.useState)(false);
	const [added, setAdded] = (0, import_react.useState)([]);
	const [ideaMode, setIdeaMode] = (0, import_react.useState)("ideas");
	const [topic, setTopic] = (0, import_react.useState)("");
	const { marks, kept } = classifyLines(lines, limits.keywordCap);
	const ideaOptions = (0, import_react.useMemo)(() => [
		8,
		12,
		16,
		20,
		50,
		100
	].filter((count) => limits.ideaCap == null || count <= limits.ideaCap), [limits.ideaCap]);
	const effective = publishMode === "default" ? site.voice.publishAs : publishMode;
	const chosen = keys.find((key) => key.id === (modelKeyId === "default" ? site.voice.modelKeyId : modelKeyId));
	const needsKey = Boolean(chosen && chosen.kind === "custom" && !chosen.secret && chosen.provider !== "Studio");
	function addKeyword(keyword) {
		setLines((prev) => prev.trim() ? `${prev.replace(/\s*$/, "")}\n${keyword}` : keyword);
		setAdded((prev) => prev.includes(keyword) ? prev : [...prev, keyword]);
	}
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [
		/* @__PURE__ */ (0, import_jsx_runtime.jsx)(PageIntro, {
			eyebrow: "Content",
			title: "Create",
			lede: "A run turns keywords into articles. Each keyword is written in six stages, then sent to Ghost once. Ideas are suggestions only — nothing is queued until you start the run."
		}),
		/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
			className: "segmented mb-6",
			"aria-label": "Create mode",
			children: ["keywords", "plan"].map((item) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
				onClick: () => setTab(item),
				"aria-pressed": tab === item,
				children: item === "keywords" ? "Keywords" : "Topic plan"
			}, item))
		}),
		tab === "keywords" ? /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
			className: "grid gap-4 lg:grid-cols-5",
			children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Card, {
				className: "space-y-4 p-5 lg:col-span-3",
				children: [
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Field, {
						label: "Keywords (one per line)",
						hint: `${kept.length}${limits.keywordCap == null ? "" : `/${limits.keywordCap}`} will be submitted — ${limits.keywordCap == null ? "no cap; 10,000+ is fine" : "cap set in Settings"}. Blank lines and repeats are dropped. Lines over 200 characters are marked Too long.`,
						children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)("textarea", {
							value: lines,
							onChange: (e) => setLines(e.target.value),
							rows: 8,
							className: fieldClass,
							placeholder: "One keyword per line"
						})
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
						className: "flex flex-wrap gap-2",
						children: [
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Button, {
								variant: "ghost",
								onClick: () => setLines(SAMPLE),
								children: "Add sample keywords"
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Button, {
								variant: "ghost",
								onClick: () => clearCooldowns(),
								title: "Clear key cooldowns and re-queue failed jobs",
								children: "Clear cooldown & retry all pending jobs"
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Button, {
								disabled: !hydrated || !kept.length || needsKey,
								title: hydrated ? void 0 : "Still connecting to the workspace store…",
								onClick: () => {
									(async () => {
										const runId = await queueKeywords({
											lines: kept.join("\n"),
											publishMode,
											modelKeyId,
											allowVariants: variants,
											bulletproof,
											researchUrls: research.split("\n").map((line) => line.trim()).filter(Boolean)
										});
										if (runId) navigate({
											to: "/runs/$id",
											params: { id: runId }
										});
									})();
								},
								children: [
									"Start run (",
									kept.length,
									")"
								]
							})
						]
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
						className: "grid gap-3 sm:grid-cols-2",
						children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Field, {
							label: "Publish as",
							hint: `Effective: ${effective === "live" ? "Publish live in Ghost" : "Save as Ghost draft"}. Frozen when the run starts.`,
							children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("select", {
								className: fieldClass,
								value: publishMode,
								onChange: (e) => setPublishMode(e.target.value),
								children: [
									/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("option", {
										value: "default",
										children: [
											"Site default (",
											site.voice.publishAs,
											")"
										]
									}),
									/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("option", {
										value: "live",
										disabled: site.ghost.mode !== "live",
										children: ["Publish live in Ghost", site.ghost.mode === "live" ? "" : " (locked — draft only)"]
									}),
									/* @__PURE__ */ (0, import_jsx_runtime.jsx)("option", {
										value: "draft",
										children: "Save as Ghost draft (review first)"
									})
								]
							})
						}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Field, {
							label: "AI model",
							hint: needsKey ? "This model needs a key." : "Account default uses the model on Content settings.",
							children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("select", {
								className: fieldClass,
								value: modelKeyId,
								onChange: (e) => setModelKeyId(e.target.value),
								children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("option", {
									value: "default",
									children: "Account default"
								}), keys.map((key) => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("option", {
									value: key.id,
									disabled: key.disabled,
									children: [
										key.label,
										" · ",
										key.model,
										key.disabled ? " · needs a key" : ""
									]
								}, key.id))]
							})
						})]
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("label", {
						className: "flex items-start gap-3 text-sm",
						children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("input", {
							type: "checkbox",
							className: "mt-1 size-4 accent-brass",
							checked: variants,
							onChange: (e) => setVariants(e.target.checked)
						}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
							className: "block text-fg",
							children: "Allow intentional variants"
						}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
							className: "text-muted",
							children: "Leave this off. Exact matches are refused unless you deliberately want a second angle."
						})] })]
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("label", {
						className: "flex items-start gap-3 text-sm",
						children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("input", {
							type: "checkbox",
							className: "mt-1 size-4 accent-brass",
							checked: bulletproof,
							onChange: (e) => setBulletproof(e.target.checked)
						}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
							className: "block text-fg",
							children: "Bulletproof humanization"
						}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
							className: "text-muted",
							children: "After the draft, the native Blader humanizer rewrites it (deterministic pass, plus a two-pass surgical audit + rewrite on the AI Keys pool). The run still passes the duplicate gate."
						})] })]
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Field, {
						label: "Research URLs",
						hint: "Optional. One https URL per line. When the web-search switch is Tavily, Firecrawl, or Auto-Fallback (Settings → AI Keys & Usage), these pages are fetched before the model writes.",
						children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)("textarea", {
							className: fieldClass,
							rows: 3,
							value: research,
							onChange: (e) => setResearch(e.target.value),
							placeholder: "https://example.com/source"
						})
					})
				]
			}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
				className: "space-y-4 lg:col-span-2",
				children: [
					/* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Card, {
						className: "p-5",
						children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h2", {
							className: "font-display text-xl",
							children: "Normalized preview"
						}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("ul", {
							className: "mt-3 space-y-2 font-mono text-[13px] leading-6 text-muted",
							children: marks.some((mark) => mark.state !== "blank") ? marks.filter((mark) => mark.state !== "blank").map((mark, index) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)("li", {
								className: mark.state === "ok" ? "text-fg" : "text-danger",
								children: mark.state === "ok" ? mark.text : `${mark.text} — ${mark.state === "too-long" ? "Too long" : mark.state === "over-limit" ? "Over limit" : "Repeat"}`
							}, `${mark.text}-${index}`)) : /* @__PURE__ */ (0, import_jsx_runtime.jsx)("li", { children: "Nothing yet." })
						})]
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Card, {
						className: "p-5",
						children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h2", {
							className: "font-display text-xl",
							children: "What happens next"
						}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("ol", {
							className: "mt-4 list-decimal space-y-3 pl-5 text-sm leading-6 text-muted",
							children: [
								/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("li", { children: [
									"Up to ",
									limits.concurrency,
									" article",
									limits.concurrency === 1 ? "" : "s",
									" write at a time on this website — raise it in Settings → Content."
								] }),
								/* @__PURE__ */ (0, import_jsx_runtime.jsx)("li", { children: "Six stages: Intent & Blueprint, Draft, Revision, Metadata, Enrichment, Validation & Publish." }),
								/* @__PURE__ */ (0, import_jsx_runtime.jsx)("li", { children: "Duplicates are refused at exact, lexical, then semantic. Close calls wait as Review held." }),
								/* @__PURE__ */ (0, import_jsx_runtime.jsx)("li", { children: "Stage 6 writes to Ghost once. A timeout reconciles by slug. It does not POST again." }),
								/* @__PURE__ */ (0, import_jsx_runtime.jsx)("li", { children: "Photos come from Bing thumbnails: the query is the article title, and the frame is 1200×630 for the hero or 575×274 in the column, cropped with c=7." }),
								/* @__PURE__ */ (0, import_jsx_runtime.jsx)("li", { children: "Internal links use phrases already in the paragraph and only point at pages on this site." })
							]
						})]
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Card, {
						className: "p-5",
						children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
							className: "segmented mb-4",
							"aria-label": "Idea source",
							children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
								"aria-pressed": ideaMode === "ideas",
								onClick: () => setIdeaMode("ideas"),
								children: "AI ideas"
							}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
								"aria-pressed": ideaMode === "research",
								onClick: () => setIdeaMode("research"),
								children: "Research (live sources)"
							})]
						}), ideaMode === "ideas" ? /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(import_jsx_runtime.Fragment, { children: [
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h2", {
								className: "text-lg font-semibold",
								children: "AI keyword ideas"
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
								className: "mt-2 text-sm leading-6 text-muted",
								children: "Suggestions are not search volume. Ideas already covered by articles, queued work, or Ghost posts are left out. Adding one does not start a run."
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
								className: "mt-3 grid gap-2 sm:grid-cols-[1fr_auto_auto]",
								children: [
									/* @__PURE__ */ (0, import_jsx_runtime.jsx)("input", {
										className: fieldClass,
										value: niche,
										onChange: (e) => setNiche(e.target.value),
										"aria-label": "Seed topic",
										placeholder: "Seed topic"
									}),
									/* @__PURE__ */ (0, import_jsx_runtime.jsx)("select", {
										className: fieldClass,
										value: ideaCount,
										onChange: (e) => setIdeaCount(Number(e.target.value)),
										"aria-label": "How many ideas",
										children: ideaOptions.map((count) => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("option", {
											value: count,
											children: [count, " ideas"]
										}, count))
									}),
									/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Button, {
										variant: "ghost",
										disabled: niche.trim().length < 3 || thinking,
										onClick: () => {
											setThinking(true);
											window.setTimeout(() => {
												runIdeas(niche, ideaCount);
												setAdded([]);
												setThinking(false);
											}, 500);
										},
										children: thinking ? "Thinking…" : "Suggest"
									})
								]
							}),
							nicheIdeas ? /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
								className: "mt-3",
								children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
									className: "mb-2 flex items-center justify-between gap-2 text-xs text-faint",
									children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", { children: [
										"Suggestions for “",
										nicheIdeas.niche,
										"” · ",
										nicheIdeas.engine,
										" · ",
										nicheIdeas.filtered,
										" filtered · ",
										nicheIdeas.tokens.toLocaleString(),
										" tokens"
									] }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
										className: "text-brass",
										onClick: () => {
											const room = nicheIdeas.items.filter((idea) => !added.includes(idea.keyword)).slice(0, limits.keywordCap == null ? void 0 : Math.max(0, limits.keywordCap - kept.length));
											for (const idea of room) addKeyword(idea.keyword);
										},
										children: "Add all"
									})]
								}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("ul", {
									className: "space-y-2",
									children: [
										nicheIdeas.items.map((idea) => {
											const on = added.includes(idea.keyword);
											return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("li", {
												className: "flex items-start justify-between gap-2 rounded-lg border border-line p-3",
												children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
													className: "text-sm",
													children: idea.keyword
												}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
													className: "mt-1 flex flex-wrap items-center gap-2 text-xs text-faint",
													children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Badge, { children: idea.intent }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { children: idea.reason })]
												})] }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
													className: `grid size-11 shrink-0 place-items-center rounded-lg border ${on ? "border-ok text-ok" : "border-line text-brass"}`,
													onClick: () => addKeyword(idea.keyword),
													"aria-label": `Add ${idea.keyword}`,
													children: on ? "✓" : "+"
												})]
											}, idea.keyword);
										}),
										!nicheIdeas.items.length ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("li", {
											className: "text-sm text-muted",
											children: "Every suggestion was already covered or rejected as commodity."
										}) : null,
										nicheIdeas.rejected?.length ? /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("li", {
											className: "text-xs text-faint",
											children: [
												nicheIdeas.rejected.length,
												" model suggestions rejected by the ",
												nicheIdeas.rejected.map((item) => item.layer).join(", "),
												" gate."
											]
										}) : null
									]
								})]
							}) : null
						] }) : /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h2", {
								className: "text-lg font-semibold",
								children: "Research from live sources"
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
								className: "mt-2 text-xs leading-5 text-muted",
								children: "Paste pages you actually read, one https URL per line. With the web-search switch on (Tavily / Firecrawl / Auto-Fallback), those pages are fetched before the draft. Nothing here is search volume."
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)("textarea", {
								className: `${fieldClass} mt-3`,
								rows: 5,
								value: research,
								onChange: (e) => setResearch(e.target.value),
								placeholder: "https://gophd.com/post/…",
								"aria-label": "Research URLs"
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
								className: "mt-2 text-xs text-faint",
								children: "Commodity headings — tips, tools, challenges, “effectively” — are filtered out of idea rounds."
							})
						] })]
					})
				]
			})]
		}) : /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
			className: "grid gap-4 lg:grid-cols-5",
			children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Card, {
				className: "space-y-4 p-5 lg:col-span-3",
				children: [
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Field, {
						label: "Topic",
						hint: "At least 3 characters. Broad enough for a main guide, specific enough to own. A single word usually comes back vague.",
						children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)("input", {
							className: fieldClass,
							value: topic,
							onChange: (e) => setTopic(e.target.value),
							placeholder: "home espresso"
						})
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Button, {
						disabled: topic.trim().length < 3 || planning,
						onClick: () => {
							setPlanning(true);
							(async () => {
								try {
									const pool = keyPool(useApp.getState(), site.voice.modelKeyId, Date.now()).filter((key) => keyCallsModel(key));
									if (pool.length) {
										const proposed = await proposePlan({
											keys: pool,
											topic
										});
										if (proposed) {
											const saved = installModelPlan(topic, proposed.pillar, proposed.clusters);
											if (saved.planId) {
												navigate({
													to: "/topic-plans/$id",
													params: { id: saved.planId }
												});
												return;
											}
										}
										const failedId = failPlan(topic, "The model could not return 6 distinct supporting clusters after one expansion retry. Check the key pool on AI Keys.");
										navigate({
											to: "/topic-plans/$id",
											params: { id: failedId }
										});
										return;
									}
									const planId = makePlan(topic);
									if (planId) navigate({
										to: "/topic-plans/$id",
										params: { id: planId }
									});
								} finally {
									setPlanning(false);
								}
							})();
						},
						children: planning ? "Asking your model…" : "Generate topic plan"
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
						className: "text-sm leading-6 text-muted",
						children: "If a model key with a base URL is saved, that model writes the pillar and the cluster titles. Otherwise the studio uses a local outline. Nothing is written until you queue the plan. Clusters run before the pillar."
					})
				]
			}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Card, {
				className: "p-5 lg:col-span-2",
				children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h2", {
					className: "font-display text-xl",
					children: "Recent plans"
				}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("ul", {
					className: "mt-3 divide-y divide-line",
					children: [plans.slice(0, 6).map((plan) => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("li", {
						className: "flex items-center justify-between gap-2 py-3 text-sm",
						children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Link, {
							to: "/topic-plans/$id",
							params: { id: plan.id },
							className: "truncate",
							children: plan.topic
						}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Badge, {
							tone: plan.status === "completed" ? "ok" : "brass",
							children: plan.status
						})]
					}, plan.id)), !plans.length ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("li", {
						className: "py-4 text-sm text-muted",
						children: "No plans yet."
					}) : null]
				})]
			})]
		})
	] });
}
var SplitComponent = CreatePage;
//#endregion
export { SplitComponent as component };
