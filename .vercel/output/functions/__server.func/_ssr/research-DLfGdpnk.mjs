import { i as __toESM } from "../_runtime.mjs";
import { bt as relTime } from "./engine-DWsB6FrJ.mjs";
import { C as require_jsx_runtime, X as require_react, b as Link, x as useNavigate } from "../_libs/@tanstack/react-router+[...].mjs";
import { h as useHydrated, m as useApp } from "./store-CO3BA3x3.mjs";
import { B as fieldClass, F as Empty, I as Field, L as PageIntro, M as Badge, N as Button, P as Card, R as SkeletonRows, z as StateNote } from "./router-DMHI1rJE.mjs";
//#region node_modules/.nitro/vite/services/ssr/assets/research-DLfGdpnk.js
var import_react = /* @__PURE__ */ __toESM(require_react());
var import_jsx_runtime = require_jsx_runtime();
var TABS = [
	"Overview",
	"Niche",
	"Audiences",
	"Problems",
	"Topic map",
	"Queries",
	"Coverage",
	"Clusters & plan"
];
function statusPill(project) {
	if (project.status === "ready") return /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
		className: "rounded-full border border-emerald-400/40 bg-emerald-500/10 px-2 py-0.5 text-xs text-emerald-600",
		children: "READY"
	});
	if (project.status === "failed") return /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
		className: "rounded-full border border-red-400/40 bg-red-500/10 px-2 py-0.5 text-xs text-red-500",
		children: "FAILED"
	});
	return /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
		className: "rounded-full border border-amber-400/40 bg-amber-500/10 px-2 py-0.5 text-xs text-amber-600",
		children: "PARTIAL"
	});
}
function StageCard({ project, stageKey }) {
	const retryResearchStage = useApp((s) => s.retryResearchStage);
	const stage = project.stages.find((record) => record.key === stageKey);
	const failed = stage.status === "failed";
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
		className: "rounded-lg border border-line p-3",
		children: [
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
				className: "flex flex-wrap items-center justify-between gap-2",
				children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
					className: "font-medium",
					children: stage.name
				}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
					className: "ml-2 rounded-full border border-line px-2 py-0.5 text-xs uppercase tracking-widest text-faint",
					children: stage.engine
				})] }), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
					className: "flex items-center gap-2",
					children: [
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Badge, {
							tone: stage.status === "done" ? "ok" : failed ? "danger" : "muted",
							children: stage.status
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
							className: "text-xs text-faint",
							children: stage.tokens ? `${stage.tokens.toLocaleString()} tok` : stage.engine === "derived" ? "0 tok (derived)" : "—"
						}),
						stage.durationMs ? /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", {
							className: "text-xs text-faint",
							children: [(stage.durationMs / 1e3).toFixed(1), "s"]
						}) : null,
						stage.attempts ? /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", {
							className: "text-xs text-faint",
							children: ["×", stage.attempts]
						}) : null,
						failed ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Button, {
							className: "min-h-8 px-2 py-1 text-xs",
							onClick: () => retryResearchStage(project.id, stageKey),
							children: "Retry from here"
						}) : null
					]
				})]
			}),
			failed && stage.error ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
				className: "mt-2 text-xs leading-5 text-red-500",
				children: stage.error
			}) : null,
			stage.note ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
				className: "mt-2 text-xs leading-5 text-faint",
				children: stage.note
			}) : null,
			stage.status === "done" ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Provenance, {
				project,
				stageKey
			}) : null
		]
	});
}
function Provenance({ project, stageKey }) {
	const [open, setOpen] = (0, import_react.useState)(false);
	const output = project.output;
	const slice = (0, import_react.useMemo)(() => {
		switch (stageKey) {
			case "niche": return output.niche ? {
				entityMap: output.niche.entityMap,
				subNiches: output.niche.subNiches,
				terminology: output.niche.terminology,
				purpose: output.niche.purpose
			} : null;
			case "audience": return output.audience;
			case "problem": return output.problems;
			case "topic-universe": return output.topicUniverse;
			case "query-expansion": return output.queries?.map((query) => ({
				query: query.query,
				topic: query.topic
			}));
			case "intent-class": return output.queries?.filter((query) => query.intent).map((query) => ({
				query: query.query,
				intent: query.intent
			}));
			case "semantic-consolidation": return output.queries?.filter((query) => query.status === "merged").map((query) => ({
				merged: query.query,
				into: query.mergedInto
			}));
			case "coverage": return output.coverage;
			case "cluster-construction": return output.clusters;
			case "action-class": return output.actions;
			case "priority": return output.priority;
			default: return null;
		}
	}, [output, stageKey]);
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
		className: "mt-2",
		children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
			type: "button",
			className: "text-xs text-brass",
			onClick: () => setOpen(!open),
			children: open ? "Hide provenance" : "Show provenance"
		}), open ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("pre", {
			className: "mt-2 max-h-56 overflow-auto rounded-lg bg-paper/70 p-2 text-xs leading-5",
			children: JSON.stringify(slice, null, 2)
		}) : null]
	});
}
function ClusterList({ project }) {
	const queuePlanFromResearch = useApp((s) => s.queuePlanFromResearch);
	const navigate = useNavigate();
	const clusters = project.output.clusters ?? [];
	const universe = project.output.topicUniverse;
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [
		/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
			className: "rounded-lg border border-line p-3",
			children: [
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Badge, {
					tone: "ok",
					children: "pillar"
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
					className: "mt-2 font-semibold",
					children: universe?.pillar ?? "—"
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
					className: "mt-1 text-xs leading-5 text-faint",
					children: "Queued last; each cluster writes first."
				})
			]
		}),
		/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("ul", {
			className: "mt-3 space-y-2",
			children: [clusters.map((cluster) => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("li", {
				className: "rounded-lg border border-line p-3",
				children: [
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
						className: "font-medium",
						children: cluster.title
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
						className: "mt-1 text-sm text-muted",
						children: cluster.angle
					}),
					cluster.queries.length ? /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
						className: "mt-1 text-xs text-faint",
						children: [
							"Owns ",
							cluster.queries.length,
							" query(ies)"
						]
					}) : null
				]
			}, cluster.id)), !clusters.length ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("li", {
				className: "text-sm text-muted",
				children: "R9 has not produced clusters yet."
			}) : null]
		}),
		/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Button, {
			className: "mt-3",
			onClick: () => {
				const planId = queuePlanFromResearch(project.id);
				if (planId) navigate({
					to: "/topic-plans/$id",
					params: { id: planId }
				});
			},
			children: "Build the topic plan from these clusters"
		})
	] });
}
function ProjectDetail({ project }) {
	const [tab, setTab] = (0, import_react.useState)("Overview");
	const runResearch = useApp((s) => s.runResearch);
	const archiveResearch = useApp((s) => s.archiveResearch);
	const done = project.stages.filter((stage) => stage.status === "done").length;
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Card, {
		className: "p-5",
		children: [
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
				className: "flex flex-wrap items-baseline justify-between gap-2",
				children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h2", {
					className: "font-display text-2xl",
					children: project.niche
				}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
					className: "flex items-center gap-2",
					children: [statusPill(project), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", {
						className: "text-xs text-faint",
						children: [
							done,
							"/11 stages · ",
							project.breadth,
							" · attempt ",
							project.attempts,
							" · ",
							relTime(project.createdAt)
						]
					})]
				})]
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
				className: "mt-3 flex flex-wrap gap-2",
				children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Button, {
					className: "min-h-9 px-3 py-1.5 text-sm",
					onClick: () => void runResearch(project.id),
					children: done ? "Resume the missing stages" : "Run the 11-stage engine"
				}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Button, {
					className: "min-h-9 px-3 py-1.5 text-sm",
					variant: "ghost",
					onClick: () => archiveResearch(project.id),
					children: project.archived ? "Restore" : "Archive"
				})]
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
				className: "segmented mt-5",
				"aria-label": "Research sections",
				children: TABS.map((entry) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
					type: "button",
					"aria-pressed": tab === entry,
					onClick: () => setTab(entry),
					children: entry
				}, entry))
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
				className: "mt-4 space-y-2 text-sm",
				children: [
					tab === "Overview" ? /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(import_jsx_runtime.Fragment, { children: [
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
							className: "max-w-prose text-sm leading-6 text-muted",
							children: "AI interpretation — an AI reading of your description and corpus. Your corrections take precedence. Never shows volume, difficulty, rankings, or traffic."
						}),
						project.facts.map((fact) => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
							className: "rounded-lg border border-line p-3",
							children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Badge, { children: fact.label }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
								className: "mt-2 max-w-prose leading-7 text-muted",
								children: fact.text
							})]
						}, fact.id)),
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
							className: "mt-3 space-y-2",
							children: project.stages.map((stage) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)(StageCard, {
								project,
								stageKey: stage.key
							}, stage.key))
						})
					] }) : null,
					tab === "Niche" ? project.output.niche ? /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
						className: "space-y-2",
						children: [
							/* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Card, {
								className: "p-3",
								children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
									className: "text-xs uppercase tracking-widest text-faint",
									children: "Entity map"
								}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
									className: "mt-2 leading-6",
									children: project.output.niche.entityMap
								})]
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Card, {
								className: "p-3",
								children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
									className: "text-xs uppercase tracking-widest text-faint",
									children: "Purpose"
								}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
									className: "mt-2 leading-6",
									children: project.output.niche.purpose
								})]
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
								className: "flex flex-wrap gap-1.5",
								children: [...project.output.niche.subNiches, ...project.output.niche.terminology].map((tag) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
									className: "rounded-full border border-line px-2 py-0.5 text-xs text-muted",
									children: tag
								}, tag))
							})
						]
					}) : /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
						className: "text-muted",
						children: "R1 has not completed yet."
					}) : null,
					tab === "Audiences" ? (project.output.audience ?? []).map((row, index) => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Card, {
						className: "p-3",
						children: [
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
								className: "font-medium",
								children: row.persona
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("p", {
								className: "mt-1 text-sm text-muted",
								children: ["Intent: ", row.intent]
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("p", {
								className: "mt-1 text-sm text-muted",
								children: ["Pain: ", row.pain]
							})
						]
					}, index)) : null,
					tab === "Problems" ? (project.output.problems ?? []).map((row, index) => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Card, {
						className: "p-3",
						children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Badge, {
							tone: "danger",
							children: row.persona
						}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
							className: "mt-2 leading-6",
							children: row.problem
						})]
					}, index)) : null,
					tab === "Topic map" ? project.output.topicUniverse ? /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
						className: "font-semibold",
						children: project.output.topicUniverse.pillar
					}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("ul", {
						className: "mt-2 space-y-1 text-sm text-muted",
						children: project.output.topicUniverse.clusters.map((cluster) => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("li", { children: ["· ", cluster.title] }, cluster.title))
					})] }) : /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
						className: "text-muted",
						children: "R4 has not completed yet."
					}) : null,
					tab === "Queries" ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)(QueryTable, { project }) : null,
					tab === "Coverage" ? (project.output.coverage ?? []).map((row) => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
						className: "flex items-start justify-between gap-3 rounded-lg border border-line p-3",
						children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
							className: "font-medium",
							children: row.query
						}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
							className: "mt-1 text-xs text-faint",
							children: row.evidence
						})] }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Badge, {
							tone: row.state === "covered" ? "ok" : row.state === "partial" ? "muted" : "danger",
							children: row.state
						})]
					}, row.queryId)) : null,
					tab === "Clusters & plan" ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)(ClusterList, { project }) : null
				]
			})
		]
	});
}
function QueryTable({ project }) {
	const queries = project.output.queries ?? [];
	return /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
		className: "overflow-x-auto rounded-lg border border-line",
		children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("table", {
			className: "w-full text-sm",
			children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("thead", { children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("tr", {
				className: "bg-paper/70 text-left text-xs uppercase tracking-widest text-faint",
				children: [
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("th", {
						className: "p-2",
						children: "Query"
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("th", {
						className: "p-2",
						children: "Intent"
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("th", {
						className: "p-2",
						children: "State"
					})
				]
			}) }), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("tbody", {
				className: "divide-y divide-line",
				children: [queries.map((query) => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("tr", {
					className: query.status === "merged" ? "opacity-50" : "",
					children: [
						/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("td", {
							className: "p-2",
							children: [query.query, query.status === "merged" ? /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
								className: "text-xs text-faint",
								children: ["merged into ", query.mergedInto]
							}) : null]
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)("td", {
							className: "p-2",
							children: query.intent ?? "—"
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)("td", {
							className: "p-2",
							children: query.status
						})
					]
				}, query.id)), !queries.length ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("tr", { children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)("td", {
					className: "p-3 text-muted",
					colSpan: 3,
					children: "R5 has not produced queries yet."
				}) }) : null]
			})]
		})
	});
}
function ResearchPage() {
	const hydrated = useHydrated();
	const siteId = useApp((s) => s.activeSiteId);
	const projects = useApp((s) => s.research);
	const addResearch = useApp((s) => s.addResearch);
	const mine = (0, import_react.useMemo)(() => projects.filter((project) => project.siteId === siteId && !project.archived), [projects, siteId]);
	const archived = (0, import_react.useMemo)(() => projects.filter((project) => project.siteId === siteId && project.archived), [projects, siteId]);
	const [niche, setNiche] = (0, import_react.useState)("");
	const [notes, setNotes] = (0, import_react.useState)("");
	const [breadth, setBreadth] = (0, import_react.useState)("standard");
	const [openId, setOpenId] = (0, import_react.useState)(null);
	if (!hydrated) return /* @__PURE__ */ (0, import_jsx_runtime.jsx)(SkeletonRows, { rows: 4 });
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [
		/* @__PURE__ */ (0, import_jsx_runtime.jsx)(PageIntro, {
			eyebrow: "Content",
			title: "Research",
			lede: "An 11-stage engine studies the niche you describe — niche, audiences, problems, topic universe, real queries, intent, semantic consolidation, coverage, clusters, actions, priority. It never shows search volume, difficulty, rankings, or traffic, and stage retries continue from what is missing without re-charging the rest."
		}),
		/* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Card, {
			className: "mb-4 space-y-3 p-5",
			children: [
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Field, {
					label: "Niche",
					hint: "At least 3 characters. Example: specialty coffee brewing at home.",
					children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)("input", {
						className: fieldClass,
						value: niche,
						onChange: (e) => setNiche(e.target.value)
					})
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Field, {
					label: "Notes you want kept",
					hint: "Saved with the evidence label You wrote this.",
					children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)("textarea", {
						className: fieldClass,
						rows: 4,
						value: notes,
						onChange: (e) => setNotes(e.target.value)
					})
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Field, {
					label: "Corpus breadth",
					hint: "How wide R5 casts for real user queries.",
					children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
						className: "flex gap-2",
						children: [
							"compact",
							"standard",
							"wide"
						].map((option) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
							type: "button",
							"aria-pressed": breadth === option,
							className: `rounded-lg border px-3 py-1.5 text-sm capitalize ${breadth === option ? "border-brass bg-brass/10 text-brass" : "border-line"}`,
							onClick: () => setBreadth(option),
							children: option
						}, option))
					})
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Button, {
					disabled: niche.trim().length < 3,
					onClick: () => {
						addResearch(niche, notes, breadth);
						setNotes("");
					},
					children: "Research this niche"
				})
			]
		}),
		!mine.length ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Empty, {
			title: "No research yet",
			body: "Start from your own description. The engine completes 11 stages, and a good run turns into a topic plan with clusters first."
		}) : /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
			className: "space-y-4",
			children: [mine.map((project) => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
				className: "text-xs text-faint",
				children: ["breadth: ", project.breadth]
			}), openId === project.id ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)(ProjectDetail, { project }) : /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Card, {
				className: "p-5",
				children: [
					/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
						className: "flex flex-wrap items-baseline justify-between gap-2",
						children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h2", {
							className: "font-display text-2xl",
							children: project.niche
						}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
							className: "flex items-center gap-2",
							children: [statusPill(project), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
								className: "text-xs text-faint",
								children: relTime(project.createdAt)
							})]
						})]
					}),
					project.status !== "ready" && project.stages.some((stage) => stage.status === "failed") ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
						className: "mt-3",
						children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(StateNote, {
							tone: project.stagesCompleted ? "partial" : "error",
							title: project.stagesCompleted ? `${project.stagesCompleted}/11 stages complete` : "The first stage failed",
							body: project.stages.find((stage) => stage.status === "failed")?.error ?? "A model stage stopped safely. Retry continues from what is missing without re-charging finished stages."
						})
					}) : null,
					/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
						className: "mt-3 flex flex-wrap gap-2",
						children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Button, {
							onClick: () => setOpenId(project.id),
							children: "Open the 11-stage detail"
						}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Link, {
							to: "/create",
							className: "inline-flex min-h-11 items-center text-sm text-brass",
							children: "Or get keyword ideas"
						})]
					})
				]
			})] }, project.id)), archived.length ? /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Card, {
				className: "p-5",
				children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("h3", {
					className: "font-semibold",
					children: [
						"Archived (",
						archived.length,
						")"
					]
				}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("ul", {
					className: "mt-2 space-y-2 text-sm",
					children: archived.map((project) => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("li", {
						className: "flex items-center justify-between gap-3",
						children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", {
							className: "text-muted",
							children: [
								project.niche,
								" · ",
								project.status
							]
						}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(ArchivedToggle, { project })]
					}, project.id))
				})]
			}) : null]
		})
	] });
}
function ArchivedToggle({ project }) {
	const archiveResearch = useApp((s) => s.archiveResearch);
	return /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Button, {
		className: "min-h-8 px-2 py-1 text-xs",
		onClick: () => archiveResearch(project.id),
		children: "Restore"
	});
}
var SplitComponent = ResearchPage;
//#endregion
export { SplitComponent as component };
