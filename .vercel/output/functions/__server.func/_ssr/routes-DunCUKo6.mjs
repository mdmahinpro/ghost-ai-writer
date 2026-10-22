import { i as __toESM } from "../_runtime.mjs";
import { A as compact, Rt as utcDay, W as goldenSteps, bt as relTime, lt as nextUtcResetLabel } from "./engine-DWsB6FrJ.mjs";
import { C as require_jsx_runtime, X as require_react, b as Link, x as useNavigate } from "../_libs/@tanstack/react-router+[...].mjs";
import { m as useApp } from "./store-CO3BA3x3.mjs";
import { B as fieldClass, H as statusTone, M as Badge, N as Button, P as Card, l as useBeat } from "./router-DMHI1rJE.mjs";
//#region node_modules/.nitro/vite/services/ssr/assets/routes-DunCUKo6.js
var import_react = /* @__PURE__ */ __toESM(require_react());
var import_jsx_runtime = require_jsx_runtime();
var TITLES = [
	"Welcome",
	"Name your site",
	"Connect your blog",
	"Pick your AI writer",
	"Set a daily spending limit",
	"Write your first article",
	"You're set up"
];
function SetupGuide() {
	const site = useApp((s) => s.sites.find((item) => item.id === s.activeSiteId));
	const keys = useApp((s) => s.keys);
	const setSetup = useApp((s) => s.setSetup);
	const connectStudio = useApp((s) => s.connectStudio);
	const patchVoice = useApp((s) => s.patchVoice);
	const setKeyAllowance = useApp((s) => s.setKeyAllowance);
	const queueKeywords = useApp((s) => s.queueKeywords);
	const step = site?.setupStep ?? 8;
	const [topics, setTopics] = (0, import_react.useState)("");
	const [limit, setLimit] = (0, import_react.useState)("8");
	const navigate = useNavigate();
	if (!site || site.setupSkipped || step < 1 || step > 7) return null;
	function go(next) {
		setSetup(next);
	}
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("section", {
		className: "mb-4 rounded-xl border border-brass/40 bg-elev p-5",
		children: [
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
				className: "flex flex-wrap items-start justify-between gap-3",
				children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("p", {
					className: "font-mono text-xs uppercase tracking-widest text-brass",
					children: [
						"Setup guide · ",
						step,
						" / 7"
					]
				}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("h2", {
					className: "mt-1 text-2xl font-semibold tracking-tight",
					children: TITLES[step - 1]
				})] }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
					className: "text-sm text-muted hover:text-fg",
					onClick: () => setSetup(0),
					children: "Skip guide — I'll explore on my own"
				})]
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
				className: "mt-4 max-w-2xl text-sm leading-6 text-muted",
				children: [
					step === 1 ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", { children: "Name the site, connect Ghost or stay in the sandbox, pick a model, set a daily limit, then queue up to five topics. The last step starts real writing." }) : null,
					step === 2 ? /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("p", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
						className: "text-fg",
						children: site.name
					}), " is the label inside this studio. Visitors to the blog do not see it. Rename it any time under Website."] }) : null,
					step === 3 ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", { children: "Use the sandbox to practise. Nothing is sent to a real Ghost site until you connect an Admin API key on Connections." }) : null,
					step === 4 ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", { children: "The estimate is not a quote. Your provider bills the key you added. Studio writer stays available with no secret." }) : null,
					step === 5 ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", { children: "Daily limits belong to each AI key. Leave the studio key as-is, or set a number of at least 1,000 tokens worth of allowance in dollars." }) : null,
					step === 6 ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", { children: "Up to 5 topics, one per line. They queue immediately and publish as drafts unless Content defaults say otherwise." }) : null,
					step === 7 ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", { children: "Golden path on this page ticks off what the studio can prove. Watch the run, then review the article before it goes live." }) : null
				]
			}),
			step === 4 ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
				className: "mt-4 grid gap-2 sm:grid-cols-3",
				children: keys.map((key) => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("button", {
					className: `rounded-lg border px-3 py-3 text-left text-sm ${site.voice.modelKeyId === key.id ? "border-brass bg-brass/10" : "border-line"}`,
					onClick: () => patchVoice({ modelKeyId: key.id }),
					children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
						className: "block font-medium text-fg",
						children: key.label
					}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
						className: "text-xs text-faint",
						children: key.model
					})]
				}, key.id))
			}) : null,
			step === 5 ? /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("label", {
				className: "mt-4 block max-w-xs text-sm",
				children: ["Daily allowance (USD)", /* @__PURE__ */ (0, import_jsx_runtime.jsx)("input", {
					className: `${fieldClass} mt-1`,
					value: limit,
					onChange: (event) => setLimit(event.target.value),
					inputMode: "decimal"
				})]
			}) : null,
			step === 6 ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("textarea", {
				className: `${fieldClass} mt-4 min-h-28`,
				value: topics,
				onChange: (event) => setTopics(event.target.value),
				placeholder: "One topic per line",
				"aria-label": "Topics"
			}) : null,
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
				className: "mt-5 flex flex-wrap gap-2",
				children: [
					step > 1 ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Button, {
						variant: "ghost",
						onClick: () => go(step - 1),
						children: "Back"
					}) : null,
					step === 1 ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Button, {
						onClick: () => go(2),
						children: "Let's go"
					}) : null,
					step === 2 ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Button, {
						onClick: () => go(3),
						children: "Continue"
					}) : null,
					step === 3 ? /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(import_jsx_runtime.Fragment, { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Button, {
						onClick: () => {
							connectStudio();
							go(4);
						},
						children: "Use sandbox"
					}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Button, {
						variant: "ghost",
						onClick: () => navigate({ to: "/connections" }),
						children: "I have a real Ghost site"
					})] }) : null,
					step === 4 ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Button, {
						onClick: () => go(5),
						children: "Save choice"
					}) : null,
					step === 5 ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Button, {
						onClick: () => {
							const key = keys.find((item) => item.id === site.voice.modelKeyId) ?? keys[0];
							const amount = Number(limit);
							if (key && Number.isFinite(amount) && amount >= 0) setKeyAllowance(key.id, amount);
							go(6);
						},
						children: "Save limit"
					}) : null,
					step === 6 ? /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(import_jsx_runtime.Fragment, { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Button, {
						onClick: () => {
							const lines = topics.split("\n").map((line) => line.trim()).filter(Boolean).slice(0, 5).join("\n");
							if (!lines) return;
							queueKeywords({
								lines,
								publishMode: "draft",
								modelKeyId: site.voice.modelKeyId,
								allowVariants: false
							});
							go(8);
							navigate({ to: "/runs" });
						},
						children: "Start writing"
					}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Button, {
						variant: "ghost",
						onClick: () => go(7),
						children: "Skip this step"
					})] }) : null,
					step === 7 ? /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(import_jsx_runtime.Fragment, { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Button, {
						onClick: () => navigate({ to: "/runs" }),
						children: "Watch my articles"
					}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Button, {
						variant: "ghost",
						onClick: () => go(8),
						children: "Go to overview"
					})] }) : null
				]
			})
		]
	});
}
function OverviewPage() {
	const data = useApp();
	const beat = useBeat((s) => s.at);
	const site = data.sites.find((item) => item.id === data.activeSiteId) ?? data.sites[0];
	if (!site) return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [
		/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h1", {
			className: "text-4xl font-semibold tracking-tight",
			children: "No workspace yet"
		}),
		/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
			className: "mt-3 text-sm text-muted",
			children: "Create a website workspace to start. An owner account has no workspace cap."
		}),
		/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Link, {
			to: "/workspaces",
			className: "mt-4 inline-flex min-h-11 items-center rounded-lg bg-brass px-4 text-sm font-medium text-ink",
			children: "Website workspaces"
		})
	] });
	const articles = data.articles.filter((article) => article.siteId === site.id);
	const runs = data.runs.filter((run) => run.siteId === site.id);
	const jobs = data.jobs.filter((job) => job.siteId === site.id);
	const day = utcDay(Date.now());
	const tokensToday = data.events.filter((event) => event.state === "SETTLED" && utcDay(event.at) === day).reduce((sum, event) => sum + event.tokens, 0);
	const links = articles.reduce((sum, article) => sum + article.links.length, 0);
	const verified = articles.reduce((sum, article) => sum + article.links.filter((link) => link.state === "GHOST_CONFIRMED" || link.state === "STATIC_CONFIRMED").length, 0);
	const localLinks = Math.max(0, links - verified);
	const published = articles.filter((article) => article.status === "published" || article.ledger.confirmed).length;
	const build = data.builds.find((item) => item.siteId === site.id);
	const steps = goldenSteps(data, site);
	const done = steps.filter((step) => step.done).length;
	const pct = steps.length ? Math.round(done / steps.length * 100) : 0;
	const running = jobs.filter((job) => job.status === "running" || job.status === "queued").length;
	const completed = jobs.filter((job) => job.status === "completed").length;
	const failed = jobs.filter((job) => job.status === "failed").length;
	const ghostLive = site.ghost.mode === "live";
	const edges = articles.flatMap((article) => article.links.slice(0, 2).map((link) => ({
		from: article.title,
		anchor: link.anchor,
		slug: link.targetSlug
	}))).slice(0, 8);
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [
		/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("header", {
			className: "mb-6 flex flex-wrap items-end justify-between gap-4",
			children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
					className: "text-xs font-medium uppercase tracking-[0.18em] text-brass-2",
					children: "Desk"
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h1", {
					className: "mt-2 text-4xl font-semibold tracking-tight",
					children: "Overview"
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("p", {
					className: "mt-2 flex flex-wrap items-center gap-2 text-sm text-muted",
					children: [
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { children: site.name }),
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Badge, {
							tone: site.ghost.status === "connected" ? "ok" : site.ghost.status === "error" ? "danger" : "muted",
							children: site.ghost.status === "connected" ? "Connected" : site.ghost.status === "error" ? "Error" : "Not connected"
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { children: ghostLive ? "Ghost live" : site.ghost.mode === "studio" ? "Ghost sandbox" : "Ghost off" })
					]
				})
			] }), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
				className: "flex flex-wrap gap-2",
				children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Link, {
					to: "/create",
					className: "inline-flex min-h-11 items-center rounded-lg bg-brass px-4 text-sm font-medium text-ink",
					children: "Create content"
				}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Link, {
					to: "/connections",
					className: "inline-flex min-h-11 items-center rounded-lg border border-line px-4 text-sm",
					children: "Connections"
				})]
			})]
		}),
		/* @__PURE__ */ (0, import_jsx_runtime.jsx)(SetupGuide, {}),
		/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
			className: "grid gap-3 sm:grid-cols-2 xl:grid-cols-4",
			children: [
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Stat, {
					label: "Articles",
					value: String(articles.length),
					hint: `${published} published`
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Stat, {
					label: "Active runs",
					value: String(runs.filter((run) => run.status === "running" || run.status === "queued").length),
					hint: `${running} jobs queued`
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Stat, {
					label: "Link graph",
					value: String(links),
					hint: `${verified} verified · ${localLinks} local`
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Stat, {
					label: "Tokens today",
					value: compact(tokensToday),
					hint: tokensToday ? "settled today" : "no usage today"
				})
			]
		}),
		/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
			className: "mt-4 grid gap-4 lg:grid-cols-5",
			children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Card, {
				className: "p-5 lg:col-span-3",
				children: [
					/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
						className: "flex items-start justify-between gap-3",
						children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h2", {
							className: "text-lg font-semibold",
							children: "Golden path"
						}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
							className: "text-sm text-muted",
							children: "The full product journey — your progress to a deployed static site"
						})] }), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
							className: "text-right",
							children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
								className: "text-2xl font-semibold text-brass",
								children: [pct, "%"]
							}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
								className: "font-mono text-xs text-faint",
								children: [
									done,
									"/",
									steps.length,
									" steps"
								]
							})]
						})]
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
						className: "mt-3 h-1.5 overflow-hidden rounded-full bg-surface-2",
						children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
							className: "h-full rounded-full bg-brass",
							style: { width: `${pct}%` }
						})
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("ol", {
						className: "mt-4 grid gap-2 sm:grid-cols-2",
						children: steps.map((step) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)("li", { children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Link, {
							to: step.href,
							className: "flex items-center gap-2 rounded-lg border border-line px-3 py-2 text-sm hover:border-brass",
							children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
								className: step.done ? "text-brass" : "text-faint",
								children: step.done ? "✓" : "○"
							}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", {
								className: "min-w-0",
								children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
									className: step.done ? "block text-fg" : "block text-muted",
									children: step.label
								}), !step.done ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
									className: "block text-xs text-faint",
									children: step.reason
								}) : null]
							})]
						}) }, step.label))
					})
				]
			}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Card, {
				className: "p-5 lg:col-span-2",
				children: [
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h2", {
						className: "text-lg font-semibold",
						children: "System health"
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("dl", {
						className: "mt-4 space-y-2 text-sm",
						children: [
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Row, {
								k: "Worker",
								v: data.workerPaused ? "Offline" : "Connected"
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Row, {
								k: "This site · running",
								v: String(jobs.filter((job) => job.status === "running").length)
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Row, {
								k: "This site · completed / failed",
								v: `${completed} / ${failed}`
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Row, {
								k: "Last heartbeat",
								v: beat ? relTime(beat) : "just now"
							})
						]
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
						className: "mt-4 border-t border-line pt-3",
						children: [keyRows(data, day).map((row) => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
							className: "flex items-center justify-between py-1 text-sm",
							children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { children: row.label }), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", {
								className: "text-muted",
								children: [
									compact(row.tokens),
									" ",
									row.allowanceUsd > 0 ? "" : "(unlimited)"
								]
							})]
						}, row.id)), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("p", {
							className: "mt-2 text-xs text-faint",
							children: [
								"Resets ",
								nextUtcResetLabel(),
								" · UTC day"
							]
						})]
					})
				]
			})]
		}),
		/* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Card, {
			className: "mt-4 flex flex-wrap items-center justify-between gap-3 p-5",
			children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
				className: "text-xs uppercase tracking-widest text-faint",
				children: "Last static build"
			}), build ? /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
				className: "mt-2 flex flex-wrap items-center gap-2 text-sm",
				children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Badge, {
					tone: statusTone(build.status),
					children: build.status
				}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", { children: [
					build.pages,
					" pages · ",
					Math.round(build.bytes / 1024),
					" KB · ",
					relTime(build.at)
				] })]
			}) : /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
				className: "mt-2 text-sm text-muted",
				children: "No build yet."
			})] }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Link, {
				to: "/static-delivery",
				className: "text-sm text-brass",
				children: "Open delivery"
			})]
		}),
		/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
			className: "mt-4 grid min-w-0 gap-4 lg:grid-cols-2",
			children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Card, {
				className: "min-w-0 p-5",
				children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
					className: "flex items-center justify-between",
					children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h2", {
						className: "text-lg font-semibold",
						children: "Recent runs"
					}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Link, {
						to: "/runs",
						className: "text-sm text-brass",
						children: "View all"
					})]
				}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("ul", {
					className: "mt-3 divide-y divide-line",
					children: [runs.slice(0, 5).map((run) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)("li", { children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Link, {
						to: "/runs/$id",
						params: { id: run.id },
						className: "flex min-w-0 items-center justify-between gap-3 py-3 text-sm",
						children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", {
							className: "min-w-0",
							children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
								className: "block truncate",
								children: run.title
							}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", {
								className: "text-xs text-faint",
								children: [
									run.type,
									" · ",
									jobs.filter((job) => job.runId === run.id).length,
									" jobs · ",
									relTime(run.createdAt)
								]
							})]
						}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Badge, {
							tone: statusTone(run.status),
							children: run.status
						})]
					}) }, run.id)), !runs.length ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("li", {
						className: "py-6 text-sm text-muted",
						children: "No runs on this website yet."
					}) : null]
				})]
			}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Card, {
				className: "min-w-0 p-5",
				children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
					className: "flex items-center justify-between",
					children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h2", {
						className: "text-lg font-semibold",
						children: "Recent articles"
					}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Link, {
						to: "/articles",
						className: "text-sm text-brass",
						children: "View all"
					})]
				}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("ul", {
					className: "mt-3 divide-y divide-line",
					children: [articles.slice(0, 5).map((article) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)("li", { children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Link, {
						to: "/articles/$id",
						params: { id: article.id },
						className: "flex min-w-0 items-center justify-between gap-3 py-3 text-sm",
						children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", {
							className: "min-w-0",
							children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
								className: "block truncate",
								children: article.title
							}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", {
								className: "text-xs text-faint",
								children: [
									article.engine,
									" · ",
									article.status,
									" · ",
									relTime(article.publishedAt)
								]
							})]
						}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Badge, {
							tone: statusTone(article.status),
							children: article.status
						})]
					}) }, article.id)), !articles.length ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("li", {
						className: "py-6 text-sm text-muted",
						children: "No articles yet."
					}) : null]
				})]
			})]
		}),
		/* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Card, {
			className: "mt-4 p-5",
			children: [
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h2", {
					className: "text-lg font-semibold",
					children: "Internal link graph"
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("p", {
					className: "mt-1 text-xs text-faint",
					children: [links, " edges"]
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("ul", {
					className: "mt-3 divide-y divide-line",
					children: [edges.map((edge, index) => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("li", {
						className: "py-2 text-sm",
						children: [
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
								className: "text-muted",
								children: edge.from.slice(0, 48)
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
								className: "text-faint",
								children: " links to "
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", { children: [
								"“",
								edge.anchor,
								"”"
							] })
						]
					}, `${edge.slug}-${index}`)), !edges.length ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("li", {
						className: "py-4 text-sm text-muted",
						children: "Links appear after a second article is published."
					}) : null]
				})
			]
		})
	] });
}
function keyRows(data, day) {
	return data.keys.filter((key) => !key.disabled).slice(0, 3).map((key) => ({
		id: key.id,
		label: key.label,
		allowanceUsd: key.allowanceUsd,
		tokens: data.events.filter((event) => event.keyId === key.id && event.state === "SETTLED" && utcDay(event.at) === day).reduce((sum, event) => sum + event.tokens, 0)
	}));
}
function Stat({ label, value, hint }) {
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Card, {
		className: "px-5 py-5",
		children: [
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
				className: "text-xs font-medium uppercase tracking-[0.16em] text-faint",
				children: label
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
				className: "mt-3 text-4xl font-semibold tracking-tight tabular-nums",
				children: value
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
				className: "mt-2 text-sm text-muted",
				children: hint
			})
		]
	});
}
function Row({ k, v }) {
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
		className: "flex items-baseline justify-between gap-4 border-b border-line/70 py-1.5",
		children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("dt", {
			className: "text-muted",
			children: k
		}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("dd", {
			className: "text-right text-fg",
			children: v
		})]
	});
}
var SplitComponent = OverviewPage;
//#endregion
export { SplitComponent as component };
