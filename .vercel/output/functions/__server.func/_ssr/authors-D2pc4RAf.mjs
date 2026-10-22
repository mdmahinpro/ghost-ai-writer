import { i as __toESM } from "../_runtime.mjs";
import { T as avatarSeed, gt as previewAuthorMatch, ht as portraitDataUri, w as avatarProxySrc } from "./engine-DWsB6FrJ.mjs";
import { C as require_jsx_runtime, X as require_react, b as Link } from "../_libs/@tanstack/react-router+[...].mjs";
import { m as useApp } from "./store-CO3BA3x3.mjs";
import { F as Empty, L as PageIntro, P as Card } from "./router-DMHI1rJE.mjs";
//#region node_modules/.nitro/vite/services/ssr/assets/authors-D2pc4RAf.js
var import_react = /* @__PURE__ */ __toESM(require_react());
var import_jsx_runtime = require_jsx_runtime();
/**
* Author portrait: the external AI-portrait URL first (with
* `referrerPolicy="no-referrer"` so ORB/CORP/referrer rules do not block the
* hotlink), then the in-memory server proxy, then a deterministic inline SVG
* portrait — so a portrait always renders, always with zero disk storage.
*/
function AuthorAvatar({ author, size = 44 }) {
	const [stage, setStage] = (0, import_react.useState)(0);
	const seed = avatarSeed(author.avatarUrl) ?? author.id;
	const initials = author.name.split(" ").map((part) => part[0]).join("").slice(0, 2);
	if (stage === 2) return /* @__PURE__ */ (0, import_jsx_runtime.jsx)("img", {
		src: portraitDataUri(seed, author.name, Math.max(96, size * 2)),
		alt: `Portrait of ${author.name}`,
		width: size,
		height: size,
		className: "shrink-0 rounded-full object-cover",
		style: {
			width: size,
			height: size
		}
	});
	const src = stage === 0 ? author.avatarUrl : avatarProxySrc({
		...author,
		avatarUrl: author.avatarUrl
	}, Math.max(96, size * 2));
	return /* @__PURE__ */ (0, import_jsx_runtime.jsx)("img", {
		src: src || portraitDataUri(seed, author.name, Math.max(96, size * 2)),
		alt: `Portrait of ${author.name}`,
		width: size,
		height: size,
		loading: "lazy",
		decoding: "async",
		referrerPolicy: "no-referrer",
		"data-avatar-stage": stage === 0 ? "direct" : "proxy",
		className: "shrink-0 rounded-full bg-surface-2 object-cover",
		style: {
			width: size,
			height: size
		},
		onError: () => setStage((current) => current === 0 ? 1 : 2),
		title: initials
	});
}
function CapacityMeter({ author }) {
	const pct = Math.min(100, Math.round(author.articleCount / Math.max(1, author.maxArticles) * 100));
	const capped = author.articleCount >= author.maxArticles;
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
		className: "min-w-36",
		children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
			className: "flex items-center justify-between gap-3 font-mono text-[13px] tabular-nums text-muted",
			children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", { children: [
				author.articleCount,
				" / ",
				author.maxArticles,
				" articles"
			] }), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", { children: [pct, "%"] })]
		}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
			role: "progressbar",
			"aria-label": `${author.name} article capacity`,
			"aria-valuenow": author.articleCount,
			"aria-valuemin": 0,
			"aria-valuemax": author.maxArticles,
			className: "mt-2 h-2 overflow-hidden rounded-full bg-line",
			children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
				className: capped ? "h-full rounded-full bg-red-500" : "h-full rounded-full bg-brass",
				style: { width: `${pct}%` }
			})
		})]
	});
}
function stateBadge(author) {
	if (author.articleCount >= author.maxArticles || author.status === "retired") return {
		label: `Capped at ${author.maxArticles}`,
		className: "border-red-400/40 bg-red-500/10 text-red-500"
	};
	return {
		label: "Active",
		className: "border-emerald-400/40 bg-emerald-500/10 text-emerald-600"
	};
}
function ghostBadge(author) {
	return author.ghostAuthorId ? `Ghost · ${author.ghostAuthorId.slice(0, 10)}…` : "local byline";
}
function EngineBanner() {
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
		className: "rounded-xl border border-line bg-brass/5 p-4 text-sm",
		children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
			className: "font-semibold tracking-tight",
			children: "Auto-Author Engine Active (250-article cap · US Personas · Zero-Disk Avatars)"
		}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
			className: "mt-1 text-muted",
			children: "Authors are created and assigned automatically by niche expertise — you never have to make one before a run. Each expert writes in a unique humanized voice, retires at 250 articles, and the niche rotates to a fresh US expert. Avatars live as external URL strings (thispersondoesnotexist.com) — nothing is ever downloaded to disk."
		})]
	});
}
function MatchSimulator() {
	const siteId = useApp((s) => s.activeSiteId);
	const authors = useApp((s) => s.authors);
	const addExpertAuthor = useApp((s) => s.addExpertAuthor);
	const [topic, setTopic] = (0, import_react.useState)("");
	const [result, setResult] = (0, import_react.useState)(null);
	const run = () => {
		const niche = topic.trim();
		if (niche.length < 3) return;
		const preview = previewAuthorMatch(siteId, authors, niche);
		setResult({
			matched: preview.matched ? `${preview.matched.name} (${preview.matched.articleCount}/${preview.matched.maxArticles} · ${preview.matched.expertise[0]})` : "",
			created: preview.wouldGenerate ? `New US expert author would be spawned for “${preview.stem}”.` : "",
			stem: preview.stem
		});
	};
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Card, {
		className: "p-4",
		children: [
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h2", {
				className: "font-semibold tracking-tight",
				children: "Test niche match / auto-generate expert"
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
				className: "mt-1 text-xs text-faint",
				children: "Type any niche or keyword and watch the engine either pick an eligible under-250 expert or plan a new US expert."
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
				className: "mt-3 flex flex-wrap gap-2",
				children: [
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("input", {
						className: "min-w-56 flex-1 rounded-lg border border-line bg-paper px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-brass/40",
						placeholder: "e.g. phd funding, home espresso, rrsp planning…",
						value: topic,
						onChange: (e) => setTopic(e.target.value),
						onKeyDown: (e) => {
							if (e.key === "Enter") run();
						}
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
						type: "button",
						className: "rounded-lg border border-line px-3 py-2 text-sm hover:bg-brass/10",
						onClick: run,
						children: "Dry-run match"
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
						type: "button",
						className: "rounded-lg bg-brass px-3 py-2 text-sm font-medium text-white hover:opacity-90",
						onClick: () => addExpertAuthor(topic.trim() || "general research"),
						children: "Auto-Generate US Expert Author"
					})
				]
			}),
			result ? /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
				className: "mt-3 rounded-lg border border-line bg-paper/60 p-3 text-sm",
				children: [result.matched ? /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: ["Picked eligible expert: ", /* @__PURE__ */ (0, import_jsx_runtime.jsx)("strong", { children: result.matched })] }) : /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
					className: "text-brass",
					children: result.created
				}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
					className: "mt-1 text-xs text-faint",
					children: ["Primary niche token: ", result.stem]
				})]
			}) : null
		]
	});
}
function AuthorsPage() {
	const siteId = useApp((s) => s.activeSiteId);
	const authorList = useApp((s) => s.authors);
	const authors = (0, import_react.useMemo)(() => authorList.filter((author) => author.siteId === siteId), [authorList, siteId]);
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(PageIntro, {
		eyebrow: "Settings",
		title: "Authors & Bylines",
		lede: "The smart auto-author engine assigns a US expert to every job. Manual control stays here for power users — there is no cap on how many experts the studio can hold."
	}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
		className: "space-y-4",
		children: [
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)(EngineBanner, {}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)(MatchSimulator, {}),
			!authors.length ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Empty, {
				title: "No authors yet",
				body: "They spawn automatically the moment a job in any niche is queued. Or use the generator above."
			}) : /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
				className: "grid gap-3 sm:grid-cols-2",
				children: authors.map((author) => {
					const badge = stateBadge(author);
					return /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Card, {
						className: "p-4",
						children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
							className: "flex items-start gap-3",
							children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(AuthorAvatar, { author }), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
								className: "min-w-0 flex-1",
								children: [
									/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
										className: "flex items-center justify-between gap-2",
										children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Link, {
											to: "/authors/$id",
											params: { id: author.id },
											className: "font-semibold tracking-tight",
											children: author.name
										}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
											className: `rounded-full border px-2 py-0.5 text-xs ${badge.className}`,
											children: badge.label
										})]
									}),
									/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
										className: "text-sm text-muted",
										children: [
											author.city,
											", ",
											author.region,
											" · US"
										]
									}),
									/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
										className: "mt-0.5 text-sm text-faint",
										children: author.role
									}),
									/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
										className: "mt-2 flex flex-wrap gap-1.5",
										children: author.expertise.map((tag) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
											className: "rounded-full border border-line px-2 py-0.5 text-xs text-muted",
											children: tag
										}, tag))
									}),
									/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
										className: "mt-3 flex flex-wrap items-center justify-between gap-3",
										children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(CapacityMeter, { author }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
											className: "rounded-full border border-line px-2 py-0.5 text-xs text-faint",
											children: ghostBadge(author)
										})]
									}),
									/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
										className: "mt-2 text-xs text-faint",
										children: [
											"Voice: ",
											author.voice.tone,
											" · ",
											author.voice.sentenceLengthBand,
											" · ",
											author.voice.pov
										]
									})
								]
							})]
						})
					}, author.id);
				})
			})
		]
	})] });
}
function AuthorDetail({ id }) {
	const author = useApp((s) => s.authors.find((item) => item.id === id));
	const articleList = useApp((s) => s.articles);
	const patchAuthor = useApp((s) => s.patchAuthor);
	const [editing, setEditing] = (0, import_react.useState)(false);
	const [draftName, setDraftName] = (0, import_react.useState)("");
	const [draftRole, setDraftRole] = (0, import_react.useState)("");
	const [draftBio, setDraftBio] = (0, import_react.useState)("");
	const articles = (0, import_react.useMemo)(() => articleList.filter((article) => article.authorId === id), [articleList, id]);
	if (!author) return /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Empty, {
		title: "Author missing",
		body: "This byline is not in the studio."
	});
	const badge = stateBadge(author);
	const startEdit = () => {
		setDraftName(author.name);
		setDraftRole(author.role);
		setDraftBio(author.shortBio);
		setEditing(true);
	};
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
		className: "grid gap-4 lg:grid-cols-5",
		children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Card, {
			className: "p-5 lg:col-span-2",
			children: [
				/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
					className: "flex items-start gap-4",
					children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(AuthorAvatar, {
						author,
						size: 64
					}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
						className: "min-w-0",
						children: [
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
								className: "text-xs uppercase tracking-widest text-faint",
								children: "Author"
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h1", {
								className: "mt-1 text-2xl font-semibold tracking-tight",
								children: author.name
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("p", {
								className: "mt-1 text-sm text-muted",
								children: [
									author.role,
									/* @__PURE__ */ (0, import_jsx_runtime.jsx)("br", {}),
									author.city,
									", ",
									author.region,
									", US"
								]
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
								className: "mt-2 flex flex-wrap gap-2 text-xs",
								children: [
									/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
										className: `rounded-full border px-2 py-0.5 ${badge.className}`,
										children: badge.label
									}),
									/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
										className: "rounded-full border border-line px-2 py-0.5 text-faint",
										children: author.ghostAuthorId ? `Ghost · ${author.ghostAuthorId}` : "local byline"
									}),
									/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
										className: "rounded-full border border-line px-2 py-0.5 text-faint",
										children: author.origin === "auto" ? "auto-generated" : "manual"
									})
								]
							})
						]
					})]
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)(CapacityMeter, { author }),
				editing ? /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
					className: "mt-4 space-y-2 text-sm",
					children: [
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)("input", {
							className: "w-full rounded-lg border border-line bg-paper px-3 py-2 outline-none focus:ring-2 focus:ring-brass/40",
							value: draftName,
							onChange: (e) => setDraftName(e.target.value)
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)("input", {
							className: "w-full rounded-lg border border-line bg-paper px-3 py-2 outline-none focus:ring-2 focus:ring-brass/40",
							value: draftRole,
							onChange: (e) => setDraftRole(e.target.value)
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)("textarea", {
							className: "w-full rounded-lg border border-line bg-paper px-3 py-2 outline-none focus:ring-2 focus:ring-brass/40",
							rows: 3,
							value: draftBio,
							onChange: (e) => setDraftBio(e.target.value)
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
							className: "flex gap-2",
							children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
								type: "button",
								className: "rounded-lg bg-brass px-3 py-1.5 text-sm font-medium text-white hover:opacity-90",
								onClick: () => {
									patchAuthor(author.id, {
										name: draftName.trim() || author.name,
										role: draftRole.trim() || author.role,
										shortBio: draftBio.trim() || author.shortBio
									});
									setEditing(false);
								},
								children: "Save"
							}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
								type: "button",
								className: "rounded-lg border border-line px-3 py-1.5 text-sm",
								onClick: () => setEditing(false),
								children: "Cancel"
							})]
						})
					]
				}) : /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(import_jsx_runtime.Fragment, { children: [
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
						className: "mt-4 text-sm leading-6",
						children: author.shortBio
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("ul", {
						className: "mt-4 flex flex-wrap gap-2",
						children: author.expertise.map((item) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)("li", {
							className: "rounded-full border border-line px-2 py-1 text-xs text-muted",
							children: item
						}, item))
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
						type: "button",
						className: "mt-4 rounded-lg border border-line px-3 py-1.5 text-xs hover:bg-brass/10",
						onClick: startEdit,
						children: "Edit byline"
					})
				] }),
				/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
					className: "mt-5 rounded-lg border border-line bg-paper/60 p-3 text-xs leading-5 text-muted",
					children: [
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
							className: "font-semibold text-foreground",
							children: "Voice signature"
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
							className: "mt-1",
							children: ["Tone: ", author.voice.tone]
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: ["Rhythm: ", author.voice.rhythm] }),
						/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: ["Diction: ", author.voice.diction] }),
						/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [
							"Sentences: ",
							author.voice.sentenceLengthBand,
							" · POV: ",
							author.voice.pov,
							" · Level: ",
							author.voice.readingLevel
						] }),
						/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
							className: "mt-1",
							children: ["Signature moves: ", author.voice.signatureMoves.join("; ")]
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: ["Refuses: ", author.voice.bannedPhrases.join(", ")] })
					]
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
					className: "mt-3 truncate text-xs text-faint",
					children: ["Avatar (external, zero-disk): ", author.avatarUrl]
				})
			]
		}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Card, {
			className: "p-5 lg:col-span-3",
			children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h2", {
				className: "font-semibold tracking-tight",
				children: "Articles on this beat"
			}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("ul", {
				className: "mt-3 divide-y divide-line",
				children: [articles.map((article) => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("li", {
					className: "py-3",
					children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Link, {
						to: "/articles/$id",
						params: { id: article.id },
						className: "font-medium",
						children: article.title
					}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
						className: "text-xs text-faint",
						children: ["/", article.slug]
					})]
				}, article.id)), !articles.length ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("li", {
					className: "py-4 text-sm text-muted",
					children: "No articles assigned yet."
				}) : null]
			})]
		})]
	});
}
//#endregion
export { AuthorDetail as n, AuthorsPage as r, AuthorAvatar as t };
