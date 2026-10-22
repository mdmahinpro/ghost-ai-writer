import { i as __toESM } from "../_runtime.mjs";
import { bt as relTime } from "./engine-DWsB6FrJ.mjs";
import { C as require_jsx_runtime, X as require_react, b as Link, x as useNavigate } from "../_libs/@tanstack/react-router+[...].mjs";
import { h as useHydrated, m as useApp } from "./store-CO3BA3x3.mjs";
import { B as fieldClass, F as Empty, H as statusTone, I as Field, L as PageIntro, M as Badge, N as Button, P as Card, R as SkeletonRows } from "./router-DMHI1rJE.mjs";
//#region node_modules/.nitro/vite/services/ssr/assets/plans-C75GCAXk.js
var import_react = /* @__PURE__ */ __toESM(require_react());
var import_jsx_runtime = require_jsx_runtime();
function PlansPage() {
	const siteId = useApp((s) => s.activeSiteId);
	const plansAll = useApp((s) => s.plans);
	const plans = (0, import_react.useMemo)(() => plansAll.filter((plan) => plan.siteId === siteId), [plansAll, siteId]);
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(PageIntro, {
		eyebrow: "Content",
		title: "Topic plans",
		lede: "A plan is a pillar plus supporting topics. Review it before anything is written. Clusters dispatch first."
	}), !plans.length ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Empty, {
		title: "No topic plans",
		body: "Generate one from Create. Nothing is written to Ghost until you queue selected topics.",
		action: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Link, {
			to: "/create",
			className: "text-sm text-brass",
			children: "Open Create"
		})
	}) : /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
		className: "space-y-3",
		children: plans.map((plan) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Link, {
			to: "/topic-plans/$id",
			params: { id: plan.id },
			className: "block",
			children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Card, {
				className: "flex flex-wrap items-center justify-between gap-3 p-4",
				children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
					className: "font-display text-2xl",
					children: plan.topic
				}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
					className: "mt-1 text-xs text-muted",
					children: [
						plan.clusters.filter((c) => !c.excluded).length,
						" clusters kept",
						plan.error ? ` · ${plan.error}` : "",
						" · ",
						relTime(plan.createdAt)
					]
				})] }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Badge, {
					tone: statusTone(plan.status),
					children: plan.status === "review" ? "READY" : plan.status
				})]
			})
		}, plan.id))
	})] });
}
function PlanDetail({ id }) {
	const navigate = useNavigate();
	const hydrated = useHydrated();
	const plan = useApp((s) => s.plans.find((item) => item.id === id));
	const jobs = useApp((s) => s.jobs);
	const keys = useApp((s) => s.keys);
	const site = useApp((s) => s.sites.find((item) => item.id === s.activeSiteId) ?? s.sites[0]);
	const updateCluster = useApp((s) => s.updateCluster);
	const moveCluster = useApp((s) => s.moveCluster);
	const removeCluster = useApp((s) => s.removeCluster);
	const addCluster = useApp((s) => s.addCluster);
	const queueTopic = useApp((s) => s.queueTopic);
	const [publishMode, setPublishMode] = (0, import_react.useState)("draft");
	const [modelKeyId, setModelKeyId] = (0, import_react.useState)("default");
	const [editing, setEditing] = (0, import_react.useState)(null);
	const [draftTitle, setDraftTitle] = (0, import_react.useState)("");
	const [draftAngle, setDraftAngle] = (0, import_react.useState)("");
	const [ownTitle, setOwnTitle] = (0, import_react.useState)("");
	const [ownAngle, setOwnAngle] = (0, import_react.useState)("");
	const [asPillar, setAsPillar] = (0, import_react.useState)(false);
	if (!hydrated) return /* @__PURE__ */ (0, import_jsx_runtime.jsx)(SkeletonRows, { rows: 5 });
	if (!plan) return /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Empty, {
		title: "Plan missing",
		body: "That topic plan is not on this browser."
	});
	const review = plan.status === "review";
	const selected = plan.clusters.filter((cluster) => cluster.selected !== false && !cluster.excluded);
	const dispatched = plan.clusters.filter((cluster) => cluster.jobId && jobs.find((job) => job.id === cluster.jobId)?.status === "completed").length;
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [
		/* @__PURE__ */ (0, import_jsx_runtime.jsx)(PageIntro, {
			eyebrow: "Topic plan",
			title: plan.topic,
			lede: "Pillar and cluster topics. Unselected topics are excluded when you queue. Excluded topics are never generated."
		}),
		/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
			className: "mb-4 flex flex-wrap items-center gap-2",
			children: [
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Badge, {
					tone: statusTone(plan.status),
					children: plan.status === "review" ? "READY" : plan.status
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", {
					className: "text-sm text-muted",
					children: [dispatched, " cluster topics already completed"]
				}),
				plan.runId ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Link, {
					to: "/runs/$id",
					params: { id: plan.runId },
					className: "text-sm text-brass",
					children: "View run"
				}) : null
			]
		}),
		review ? /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Card, {
			className: "mb-4 grid gap-3 p-5 sm:grid-cols-2",
			children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Field, {
				label: "Publish as",
				hint: `Effective: ${publishMode === "default" ? site.voice.publishAs : publishMode}`,
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
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)("option", {
							value: "live",
							children: "Publish live in Ghost"
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)("option", {
							value: "draft",
							children: "Save as Ghost draft"
						})
					]
				})
			}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Field, {
				label: "AI model",
				children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("select", {
					className: fieldClass,
					value: modelKeyId,
					onChange: (e) => setModelKeyId(e.target.value),
					children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("option", {
						value: "default",
						children: "Account default"
					}), keys.map((key) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)("option", {
						value: key.id,
						children: key.label
					}, key.id))]
				})
			})]
		}) : null,
		/* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Card, {
			className: "p-5",
			children: [
				/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
					className: "flex flex-wrap items-center gap-2",
					children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
						className: "font-mono text-xs uppercase tracking-widest text-brass",
						children: "Pillar page"
					}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Badge, { children: "Pillar" })]
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h2", {
					className: "mt-2 font-display text-3xl",
					children: plan.pillarTitle
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
					className: "mt-2 text-sm text-muted",
					children: plan.pillarAngle
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
					className: "mt-2 text-xs text-faint",
					children: "Queued last, after every included cluster has resolved."
				})
			]
		}),
		/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("h2", {
			className: "mb-3 mt-6 font-display text-2xl",
			children: [
				"Pillar & cluster topics · ",
				selected.length,
				" selected"
			]
		}),
		/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
			className: "space-y-2",
			children: plan.clusters.map((cluster, index) => {
				const job = jobs.find((item) => item.id === cluster.jobId);
				const on = cluster.selected !== false && !cluster.excluded;
				return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Card, {
					className: "p-4",
					children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
						className: "flex flex-wrap items-start justify-between gap-3",
						children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("label", {
							className: "flex min-w-0 items-start gap-3",
							children: [review ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("input", {
								type: "checkbox",
								className: "mt-1 size-4 accent-brass",
								checked: on,
								onChange: (event) => updateCluster(plan.id, cluster.id, {
									selected: event.target.checked,
									excluded: !event.target.checked
								})
							}) : null, /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", { children: [
								/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
									className: on ? "block font-medium" : "block text-faint line-through",
									children: cluster.title
								}),
								/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
									className: "mt-1 block text-xs text-muted",
									children: cluster.angle.includes("—") ? cluster.angle.split("—").slice(1).join("—").trim() : cluster.angle
								}),
								/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", {
									className: "mt-1 block text-xs text-faint",
									children: [
										cluster.source === "you" ? "You wrote this" : "AI-suggested topic",
										" · ",
										job ? job.status : "PROPOSED"
									]
								})
							] })]
						}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
							className: "flex flex-wrap items-center gap-1",
							children: [job ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Badge, {
								tone: statusTone(job.status),
								children: job.status
							}) : null, review ? /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(import_jsx_runtime.Fragment, { children: [
								/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Button, {
									variant: "quiet",
									onClick: () => moveCluster(plan.id, cluster.id, -1),
									disabled: index === 0,
									"aria-label": "Move up",
									children: "Up"
								}),
								/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Button, {
									variant: "quiet",
									onClick: () => moveCluster(plan.id, cluster.id, 1),
									disabled: index === plan.clusters.length - 1,
									"aria-label": "Move down",
									children: "Down"
								}),
								/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Button, {
									variant: "ghost",
									onClick: () => {
										setEditing(cluster.id);
										setDraftTitle(cluster.title);
										setDraftAngle(cluster.angle);
									},
									children: "Edit"
								}),
								/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Button, {
									variant: "ghost",
									onClick: () => updateCluster(plan.id, cluster.id, {
										excluded: on,
										selected: !on
									}),
									children: on ? "Exclude" : "Restore"
								}),
								/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Button, {
									variant: "danger",
									onClick: () => removeCluster(plan.id, cluster.id),
									children: "Remove"
								})
							] }) : null]
						})]
					}), editing === cluster.id ? /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
						className: "mt-3 grid gap-2 sm:grid-cols-[1fr_1fr_auto]",
						children: [
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)("input", {
								className: fieldClass,
								value: draftTitle,
								onChange: (e) => setDraftTitle(e.target.value),
								"aria-label": "Title"
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)("input", {
								className: fieldClass,
								value: draftAngle,
								onChange: (e) => setDraftAngle(e.target.value),
								"aria-label": "Angle"
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Button, {
								onClick: () => {
									updateCluster(plan.id, cluster.id, {
										title: draftTitle.trim(),
										angle: draftAngle.trim()
									});
									setEditing(null);
								},
								children: "Save"
							})
						]
					}) : null]
				}, cluster.id);
			})
		}),
		review ? /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Card, {
			className: "mt-4 space-y-3 p-5",
			children: [
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h3", {
					className: "font-display text-xl",
					children: "Add topic"
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
					className: "grid gap-3 sm:grid-cols-2",
					children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Field, {
						label: "Article title",
						hint: "At least 3 characters.",
						children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)("input", {
							className: fieldClass,
							value: ownTitle,
							onChange: (e) => setOwnTitle(e.target.value)
						})
					}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Field, {
						label: "Angle",
						hint: "Optional. At least 10 characters if you write one.",
						children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)("input", {
							className: fieldClass,
							value: ownAngle,
							onChange: (e) => setOwnAngle(e.target.value)
						})
					})]
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("label", {
					className: "flex items-center gap-2 text-sm",
					children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("input", {
						type: "checkbox",
						className: "size-4 accent-brass",
						checked: asPillar,
						onChange: (e) => setAsPillar(e.target.checked)
					}), "Make this the pillar page for the plan"]
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
					className: "flex flex-wrap gap-2",
					children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Button, {
						variant: "ghost",
						disabled: ownTitle.trim().length < 3 || ownAngle.trim().length > 0 && ownAngle.trim().length < 10,
						onClick: () => {
							addCluster(plan.id, ownTitle, ownAngle, asPillar);
							setOwnTitle("");
							setOwnAngle("");
							setAsPillar(false);
						},
						children: "Add topic"
					}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Button, {
						disabled: !hydrated || selected.length < 2,
						title: hydrated ? void 0 : "Still connecting to the workspace store…",
						onClick: () => {
							(async () => {
								const runId = await queueTopic(plan.id, {
									publishMode,
									modelKeyId
								});
								if (runId) navigate({
									to: "/runs/$id",
									params: { id: runId }
								});
							})();
						},
						children: [
							"Queue selected (",
							selected.length,
							")"
						]
					})]
				})
			]
		}) : null
	] });
}
//#endregion
export { PlansPage as n, PlanDetail as t };
