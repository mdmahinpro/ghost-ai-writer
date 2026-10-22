import { i as __toESM } from "../_runtime.mjs";
import { Rt as utcDay, bt as relTime, lt as nextUtcResetLabel, st as money } from "./engine-DWsB6FrJ.mjs";
import { C as require_jsx_runtime, X as require_react } from "../_libs/@tanstack/react-router+[...].mjs";
import { c as testCustomModel, i as listCustomModels } from "./providers.functions-CtXM7JdH.mjs";
import { c as embeddingModelFor, m as useApp, n as PROVIDER_BASE_URLS, o as blendedPricePerMillion, r as PROVIDER_LABELS, t as DEFAULT_EMBEDDING_MODEL, u as modelsForProvider } from "./store-CO3BA3x3.mjs";
import { B as fieldClass, H as statusTone, I as Field, L as PageIntro, M as Badge, N as Button, P as Card } from "./router-DMHI1rJE.mjs";
//#region node_modules/.nitro/vite/services/ssr/assets/ai-keys-BOpp3Ecm.js
var import_react = /* @__PURE__ */ __toESM(require_react());
var import_jsx_runtime = require_jsx_runtime();
var SEARCH_MODES = [
	{
		value: "off",
		label: "Off",
		hint: "No live sources. Ideas and drafts stay offline."
	},
	{
		value: "tavily",
		label: "Tavily",
		hint: "Tavily search + snippets power research."
	},
	{
		value: "firecrawl",
		label: "Firecrawl",
		hint: "Firecrawl search and page scraping."
	},
	{
		value: "auto-fallback",
		label: "Auto-Fallback",
		hint: "Tavily first; Firecrawl catches failures."
	}
];
function KeysPage() {
	const keys = useApp((s) => s.keys);
	const events = useApp((s) => s.events);
	const webSearch = useApp((s) => s.webSearch);
	const addKey = useApp((s) => s.addKey);
	const toggleKey = useApp((s) => s.toggleKey);
	const deleteKey = useApp((s) => s.deleteKey);
	const patchKey = useApp((s) => s.patchKey);
	const setKeyAllowance = useApp((s) => s.setKeyAllowance);
	const setWebSearchMode = useApp((s) => s.setWebSearchMode);
	const importWebSearchKeys = useApp((s) => s.importWebSearchKeys);
	const clearWebSearchKeys = useApp((s) => s.clearWebSearchKeys);
	const clearCooldowns = useApp((s) => s.clearCooldowns);
	const [providerKind, setProviderKind] = (0, import_react.useState)("openai");
	const [catalogId, setCatalogId] = (0, import_react.useState)("openai/gpt-5.6-luna");
	const [customModel, setCustomModel] = (0, import_react.useState)("glm-5.3-flash");
	const [label, setLabel] = (0, import_react.useState)("");
	const [baseUrl, setBaseUrl] = (0, import_react.useState)(PROVIDER_BASE_URLS.openai);
	const [secret, setSecret] = (0, import_react.useState)("");
	const [allowance, setAllowance] = (0, import_react.useState)(20);
	const [priority, setPriority] = (0, import_react.useState)(100);
	const [embeddingModel, setEmbeddingModel] = (0, import_react.useState)(DEFAULT_EMBEDDING_MODEL);
	const [testing, setTesting] = (0, import_react.useState)(false);
	const [testNote, setTestNote] = (0, import_react.useState)("");
	const [editingId, setEditingId] = (0, import_react.useState)(null);
	const [fetchingModels, setFetchingModels] = (0, import_react.useState)(false);
	const [fetchNote, setFetchNote] = (0, import_react.useState)("");
	const [fetchedModels, setFetchedModels] = (0, import_react.useState)([]);
	const [tavilyPool, setTavilyPool] = (0, import_react.useState)("");
	const [firecrawlPool, setFirecrawlPool] = (0, import_react.useState)("");
	const day = utcDay(Date.now());
	const today = events.filter((event) => utcDay(event.at) === day);
	const settled = today.filter((event) => event.state === "SETTLED");
	const reserved = today.filter((event) => event.state === "RESERVED");
	const released = today.filter((event) => event.state === "RELEASED");
	const closed = new Set(events.filter((event) => event.state !== "RESERVED").map((event) => event.pairId));
	const orderedKeys = (0, import_react.useMemo)(() => [...keys].sort((a, b) => b.priority - a.priority), [keys]);
	const providerModels = (0, import_react.useMemo)(() => modelsForProvider(providerKind), [providerKind]);
	const catalog = providerModels.find((model) => model.id === catalogId) ?? providerModels[0];
	const effectiveModel = providerKind === "custom" ? customModel.trim() : catalog?.modelId ?? "";
	const pricePerM = catalog ? blendedPricePerMillion(catalog) : 1;
	function pickProvider(next) {
		setProviderKind(next);
		setBaseUrl(PROVIDER_BASE_URLS[next]);
		const first = modelsForProvider(next)[0];
		if (first) setCatalogId(first.id);
		setEmbeddingModel(embeddingModelFor({
			provider: PROVIDER_LABELS[next],
			providerKind: next
		}) ?? "");
	}
	function resetForm() {
		setEditingId(null);
		setFetchNote("");
		setFetchedModels([]);
		setTestNote("");
		setProviderKind("custom");
		setBaseUrl("");
		setCustomModel("");
		setLabel("");
		setSecret("");
		setAllowance(20);
		setPriority(100);
		setEmbeddingModel("");
	}
	function startEdit(key) {
		const kind = key.providerKind ?? (key.catalogId ? "openai" : "custom");
		setEditingId(key.id);
		setProviderKind(kind);
		setBaseUrl(key.baseUrl ?? PROVIDER_BASE_URLS[kind]);
		setLabel(key.label);
		setAllowance(key.allowanceUsd);
		setPriority(key.priority);
		setSecret(key.secret ?? "");
		setEmbeddingModel(embeddingModelFor(key) ?? "");
		setFetchNote("");
		setFetchedModels([]);
		setTestNote("");
		if (kind === "custom") setCustomModel(key.model);
		else if (key.catalogId) setCatalogId(key.catalogId);
		else {
			const match = modelsForProvider(kind).find((model) => model.modelId === key.model);
			if (match) setCatalogId(match.id);
		}
	}
	function fetchModels() {
		const base = baseUrl.trim();
		if (!base || !secret.trim()) return;
		setFetchingModels(true);
		setFetchNote("");
		listCustomModels({ data: {
			baseUrl: base,
			apiKey: secret
		} }).then((result) => {
			if (result.ok) {
				setFetchedModels(result.models);
				setFetchNote(`${result.models.length} model${result.models.length === 1 ? "" : "s"} found. Pick one or keep typing your own.`);
			} else {
				setFetchedModels([]);
				setFetchNote(result.error);
			}
		}).catch(() => setFetchNote("Fetch failed.")).finally(() => setFetchingModels(false));
	}
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
		className: "stagger space-y-4",
		children: [
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)(PageIntro, {
				eyebrow: "Settings",
				title: "AI keys and usage",
				lede: "Build a multi-key pool with auto-failover. Add OpenAI, OpenRouter, or any OpenAI-compatible endpoint (custom base URL + model id). When the primary key is busy, rate-limited, or out of allowance, the next key finishes the job and still publishes to Ghost."
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Card, {
				className: "space-y-3 p-5",
				children: [
					/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
						className: "flex flex-wrap items-center justify-between gap-2",
						children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h2", {
							className: "text-base font-semibold tracking-tight",
							children: "Failover pool"
						}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Badge, {
							tone: orderedKeys.length ? "ok" : "muted",
							children: [
								orderedKeys.length,
								" key",
								orderedKeys.length === 1 ? "" : "s",
								" · tried top-down"
							]
						})]
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
						className: "text-sm text-muted",
						children: "Higher priority is tried first. 401/403 disables a key; 429 cools it for 12 seconds; config errors (400/404) and transient 5xx never cool the key. Remaining keys carry the run."
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", { children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Button, {
						variant: "ghost",
						onClick: () => clearCooldowns(),
						children: "Clear cooldown & retry all pending jobs"
					}) })
				]
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
				className: "grid gap-3 lg:grid-cols-2",
				children: orderedKeys.map((key, index) => {
					const spent = settled.filter((event) => event.keyId === key.id).reduce((sum, event) => sum + event.usd, 0);
					const open = events.filter((event) => event.keyId === key.id && event.state === "RESERVED" && !closed.has(event.pairId)).reduce((sum, event) => sum + event.usd, 0);
					const cooling = key.cooldownUntil && key.cooldownUntil > Date.now();
					return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Card, {
						className: "p-4",
						children: [
							/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
								className: "flex items-start justify-between gap-2",
								children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
									className: "font-medium",
									children: [
										"#",
										index + 1,
										" · ",
										key.provider,
										" · ",
										key.model
									]
								}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
									className: "mt-1 font-mono text-xs text-faint",
									children: [
										"priority ",
										key.priority,
										" · ",
										key.hint,
										key.baseUrl ? ` · ${key.baseUrl}` : ""
									]
								})] }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Badge, {
									tone: key.disabled ? "danger" : cooling ? "brass" : key.providerKind === "custom" ? "brass" : "ok",
									children: key.disabled ? "disabled" : cooling ? `cooling ${Math.max(1, Math.round((key.cooldownUntil - Date.now()) / 6e4))}m` : key.providerKind === "custom" ? "custom" : "active"
								})]
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("dl", {
								className: "mt-3 space-y-1 text-sm",
								children: [
									/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
										className: "flex justify-between gap-3",
										children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("dt", {
											className: "text-muted",
											children: "Capabilities"
										}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("dd", {
											className: "text-right",
											children: [
												key.chat ? "Chat" : "",
												embeddingModelFor(key) ? `Semantic (${embeddingModelFor(key)})` : "Semantic: hash fallback",
												key.secret ? "Live key" : ""
											].filter(Boolean).join(" + ")
										})]
									}),
									/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
										className: "flex justify-between",
										children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("dt", {
											className: "text-muted",
											children: "Today settled"
										}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("dd", {
											className: "font-mono",
											children: money(spent)
										})]
									}),
									/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
										className: "flex justify-between",
										children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("dt", {
											className: "text-muted",
											children: "Allowance"
										}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("dd", {
											className: "flex items-center gap-2 font-mono",
											children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)("input", {
												className: `${fieldClass} h-8 w-24 py-1`,
												type: "number",
												min: 0,
												step: .5,
												value: key.allowanceUsd,
												onChange: (e) => setKeyAllowance(key.id, Number(e.target.value)),
												"aria-label": "Daily allowance"
											})
										})]
									}),
									/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
										className: "flex justify-between",
										children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("dt", {
											className: "text-muted",
											children: "Reserved"
										}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("dd", {
											className: "font-mono",
											children: money(open)
										})]
									}),
									/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
										className: "flex justify-between",
										children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("dt", {
											className: "text-muted",
											children: "Last used"
										}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("dd", { children: key.lastUsedAt ? relTime(key.lastUsedAt) : "—" })]
									})
								]
							}),
							key.lastError ? /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("p", {
								className: "mt-2 rounded-lg border border-danger/30 bg-danger/5 px-2 py-1.5 font-mono text-xs break-words text-danger",
								children: [key.lastError, key.lastErrorAt ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
									className: "block text-faint",
									children: relTime(key.lastErrorAt)
								}) : null]
							}) : null,
							/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
								className: "mt-3 flex flex-wrap gap-2",
								children: [
									/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Button, {
										variant: "ghost",
										onClick: () => toggleKey(key.id),
										children: key.disabled ? "Enable" : "Disable"
									}),
									/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Button, {
										variant: "ghost",
										onClick: () => startEdit(key),
										children: editingId === key.id ? "Editing…" : "Edit"
									}),
									key.cooldownUntil ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Button, {
										variant: "ghost",
										onClick: () => clearCooldowns(),
										children: "Clear cooldown"
									}) : null,
									/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Button, {
										variant: "danger",
										"aria-label": `Delete ${key.label}`,
										onClick: () => {
											if (typeof window !== "undefined" && !window.confirm(`Delete "${key.label}" permanently? Usage ledger rows stay in Billing.`)) return;
											if (editingId === key.id) resetForm();
											deleteKey(key.id);
										},
										children: "Delete key"
									})
								]
							})
						]
					}, key.id);
				})
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Card, {
				className: "grid gap-3 p-5 md:grid-cols-2",
				children: [
					/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
						className: "md:col-span-2",
						children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
							className: "flex flex-wrap items-center justify-between gap-2",
							children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h2", {
								className: "text-base font-semibold tracking-tight",
								children: editingId ? "Edit custom endpoint" : "Add a key to the pool"
							}), editingId ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Badge, {
								tone: "brass",
								children: "editing a saved key"
							}) : null]
						}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
							className: "mt-1 text-sm text-muted",
							children: "OpenAI and OpenRouter use their catalogs. Custom points at any OpenAI-compatible gateway (GLM, DeepSeek, Groq, xAI, your own proxy). Enter the base URL and key, then Fetch Models to pick the exact model id."
						})]
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Field, {
						label: "Provider",
						children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)("select", {
							className: fieldClass,
							value: providerKind,
							onChange: (e) => pickProvider(e.target.value),
							children: Object.keys(PROVIDER_LABELS).map((value) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)("option", {
								value,
								children: PROVIDER_LABELS[value]
							}, value))
						})
					}),
					providerKind === "custom" ? /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Field, {
						label: "Custom model id",
						hint: "Pick a fetched model or type the exact model string your gateway expects.",
						children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("input", {
							className: `${fieldClass} font-mono`,
							value: customModel,
							onChange: (e) => setCustomModel(e.target.value),
							placeholder: "glm-5.3-flash",
							list: fetchedModels.length ? "custom-model-options" : void 0,
							autoComplete: "off"
						}), fetchedModels.length ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("datalist", {
							id: "custom-model-options",
							children: fetchedModels.map((model) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)("option", { value: model }, model))
						}) : null]
					}) : /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Field, {
						label: "Model",
						hint: catalog?.note ?? "Prices are blended input/output per 1M tokens.",
						children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)("select", {
							className: fieldClass,
							value: catalogId,
							onChange: (e) => setCatalogId(e.target.value),
							children: providerModels.map((model) => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("option", {
								value: model.id,
								children: [
									model.label,
									" · $",
									model.inputPricePerMillion,
									"/$",
									model.outputPricePerMillion
								]
							}, model.id))
						})
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Field, {
						label: "Label",
						hint: "Shown on the key card and in usage events.",
						children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)("input", {
							className: fieldClass,
							value: label,
							onChange: (e) => setLabel(e.target.value),
							placeholder: `${PROVIDER_LABELS[providerKind]} ${effectiveModel || "key"}`
						})
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Field, {
						label: "API base URL",
						hint: providerKind === "custom" ? "Include /v1 when the gateway expects it. Do not paste the key here." : "Defaults to the provider endpoint.",
						children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)("input", {
							className: `${fieldClass} font-mono`,
							value: baseUrl,
							onChange: (e) => setBaseUrl(e.target.value),
							placeholder: "https://api.openai.com/v1"
						})
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Field, {
						label: "API key",
						children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)("input", {
							className: `${fieldClass} font-mono`,
							type: "password",
							value: secret,
							onChange: (e) => setSecret(e.target.value),
							autoComplete: "off",
							placeholder: "sk-…"
						})
					}),
					providerKind === "custom" ? /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
						className: "flex flex-wrap items-center gap-2 md:col-span-2",
						children: [
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Button, {
								variant: "ghost",
								disabled: fetchingModels || !baseUrl.trim() || !secret.trim(),
								onClick: fetchModels,
								children: fetchingModels ? "Fetching…" : "Fetch Models"
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", {
								className: "text-xs text-faint",
								children: [
									"Calls ",
									baseUrl.trim() || "your base URL",
									"/models with your key, then fills a searchable model list. Manual typing still works."
								]
							}),
							fetchNote ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
								className: "w-full text-sm text-muted",
								children: fetchNote
							}) : null
						]
					}) : null,
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Field, {
						label: "Daily allowance ($)",
						hint: "Leave generous for unlimited-scale runs; per-key caps still apply.",
						children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)("input", {
							className: `${fieldClass} font-mono`,
							type: "number",
							min: .5,
							step: .5,
							value: allowance,
							onChange: (e) => setAllowance(Number(e.target.value))
						})
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Field, {
						label: "Priority",
						hint: "Higher runs first. Give backups a lower number.",
						children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)("input", {
							className: `${fieldClass} font-mono`,
							type: "number",
							value: priority,
							onChange: (e) => setPriority(Number(e.target.value))
						})
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Field, {
						label: "Semantic model (embeddings)",
						hint: "The L3 duplicate gate calls /embeddings with this model — never your chat model. Blank = provider default; a family with no embeddings route keeps the local hash fallback.",
						children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)("input", {
							className: `${fieldClass} font-mono`,
							value: embeddingModel,
							onChange: (e) => setEmbeddingModel(e.target.value),
							placeholder: providerKind === "openai" ? DEFAULT_EMBEDDING_MODEL : "text-embedding-3-small",
							autoComplete: "off"
						})
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
						className: "flex flex-wrap gap-2 md:col-span-2",
						children: [
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Button, {
								onClick: () => {
									if (!effectiveModel) return;
									const nextLabel = label.trim() || `${PROVIDER_LABELS[providerKind]} ${effectiveModel}`;
									if (editingId) {
										patchKey(editingId, {
											provider: PROVIDER_LABELS[providerKind],
											model: effectiveModel,
											label: nextLabel,
											allowanceUsd: allowance,
											priority,
											baseUrl,
											secret,
											providerKind,
											catalogId: providerKind === "custom" ? void 0 : catalogId,
											pricePerM,
											embeddingModel: embeddingModel.trim() || void 0
										});
										resetForm();
										return;
									}
									addKey({
										provider: PROVIDER_LABELS[providerKind],
										model: effectiveModel,
										label: nextLabel,
										allowanceUsd: allowance,
										priority,
										baseUrl,
										secret,
										providerKind,
										catalogId: providerKind === "custom" ? void 0 : catalogId,
										pricePerM,
										embeddingModel: embeddingModel.trim() || void 0
									});
									setSecret("");
									setLabel("");
								},
								disabled: !effectiveModel,
								children: editingId ? "Save changes" : "Save key"
							}),
							editingId ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Button, {
								variant: "quiet",
								onClick: resetForm,
								children: "Cancel"
							}) : null,
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Button, {
								variant: "ghost",
								disabled: testing || !secret || !baseUrl || !effectiveModel,
								onClick: () => {
									setTesting(true);
									setTestNote("");
									testCustomModel({ data: {
										baseUrl,
										apiKey: secret,
										model: effectiveModel
									} }).then((result) => setTestNote(result.ok ? `Connected. Sample: ${result.sample}` : result.error)).catch(() => setTestNote("Test failed.")).finally(() => setTesting(false));
								},
								children: testing ? "Testing…" : "Test connection"
							})
						]
					}),
					testNote ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
						className: "text-sm text-muted md:col-span-2",
						children: testNote
					}) : null
				]
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Card, {
				className: "space-y-3 p-5",
				children: [
					/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
						className: "flex flex-wrap items-start justify-between gap-2",
						children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h2", {
							className: "text-base font-semibold tracking-tight",
							children: "Web search switch"
						}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
							className: "mt-1 max-w-2xl text-sm leading-6 text-muted",
							children: "Powers live research: source scraping for runs and web context for the niche research engine. Each provider keeps its own key pool with failover."
						})] }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Badge, {
							tone: webSearch.mode === "off" ? "muted" : "ok",
							children: webSearch.mode
						})]
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
						className: "grid gap-2 sm:grid-cols-2 lg:grid-cols-4",
						"aria-label": "Web search mode",
						children: SEARCH_MODES.map((mode) => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("button", {
							type: "button",
							"aria-pressed": webSearch.mode === mode.value,
							onClick: () => setWebSearchMode(mode.value),
							className: `min-h-20 rounded-lg border p-4 text-left text-sm hover:border-line-strong ${webSearch.mode === mode.value ? "border-brass/60 bg-brass/10" : "border-line/60 bg-surface/40"}`,
							children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
								className: "block font-medium",
								children: mode.label
							}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
								className: "mt-1 block text-xs leading-5 text-muted",
								children: mode.hint
							})]
						}, mode.value))
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
						className: "grid gap-3 md:grid-cols-2",
						children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
							className: "space-y-2 rounded-xl border border-line p-3",
							children: [
								/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
									className: "flex items-center justify-between gap-2",
									children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
										className: "text-sm font-medium",
										children: "Tavily keys"
									}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Badge, {
										tone: webSearch.tavilyKeys.length ? "ok" : "muted",
										children: [
											webSearch.tavilyKeys.filter((key) => !key.disabled).length,
											"/",
											webSearch.tavilyKeys.length,
											" ready"
										]
									})]
								}),
								/* @__PURE__ */ (0, import_jsx_runtime.jsx)("textarea", {
									className: `${fieldClass} font-mono`,
									rows: 3,
									value: tavilyPool,
									onChange: (e) => setTavilyPool(e.target.value),
									placeholder: "tvly-… one per line"
								}),
								/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
									className: "flex flex-wrap gap-2",
									children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Button, {
										disabled: !tavilyPool.trim(),
										onClick: () => {
											importWebSearchKeys("tavily", tavilyPool);
											setTavilyPool("");
										},
										children: "Add Tavily keys"
									}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Button, {
										variant: "danger",
										disabled: !webSearch.tavilyKeys.length,
										onClick: () => clearWebSearchKeys("tavily"),
										children: "Clear"
									})]
								})
							]
						}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
							className: "space-y-2 rounded-xl border border-line p-3",
							children: [
								/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
									className: "flex items-center justify-between gap-2",
									children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
										className: "text-sm font-medium",
										children: "Firecrawl keys"
									}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Badge, {
										tone: webSearch.firecrawlKeys.length ? "ok" : "muted",
										children: [
											webSearch.firecrawlKeys.filter((key) => !key.disabled).length,
											"/",
											webSearch.firecrawlKeys.length,
											" ready"
										]
									})]
								}),
								/* @__PURE__ */ (0, import_jsx_runtime.jsx)("textarea", {
									className: `${fieldClass} font-mono`,
									rows: 3,
									value: firecrawlPool,
									onChange: (e) => setFirecrawlPool(e.target.value),
									placeholder: "fc-… one per line"
								}),
								/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
									className: "flex flex-wrap gap-2",
									children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Button, {
										disabled: !firecrawlPool.trim(),
										onClick: () => {
											importWebSearchKeys("firecrawl", firecrawlPool);
											setFirecrawlPool("");
										},
										children: "Add Firecrawl keys"
									}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Button, {
										variant: "danger",
										disabled: !webSearch.firecrawlKeys.length,
										onClick: () => clearWebSearchKeys("firecrawl"),
										children: "Clear"
									})]
								})
							]
						})]
					}),
					webSearch.tavilyKeys.length || webSearch.firecrawlKeys.length ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("ul", {
						className: "flex flex-wrap gap-2 text-xs",
						children: [...webSearch.tavilyKeys.map((key) => ({
							...key,
							provider: "tavily"
						})), ...webSearch.firecrawlKeys.map((key) => ({
							...key,
							provider: "firecrawl"
						}))].map((key) => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("li", {
							className: "rounded-lg border border-line px-2 py-1 font-mono",
							children: [
								key.provider,
								" ",
								key.hint,
								" · ",
								key.disabled ? "paused" : key.cooldownUntil && key.cooldownUntil > Date.now() ? "cooling" : "ready",
								key.lastError ? ` · ${key.lastError}` : ""
							]
						}, key.id))
					}) : null
				]
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Card, {
				className: "space-y-3 p-5",
				children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
					className: "flex flex-wrap items-start justify-between gap-3",
					children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h2", {
						className: "text-base font-semibold tracking-tight",
						children: "Blader humanizer (native)"
					}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
						className: "mt-1 max-w-2xl text-sm leading-6 text-muted",
						children: "The external Metric37 API is gone. Humanization runs in-app on the blader/humanizer ruleset (26 Wikipedia \"Signs of AI writing\" patterns): a deterministic pass always runs, and every usable model key on this page powers the two-pass surgical audit + rewrite in the assigned US author's voice."
					})] }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Badge, {
						tone: "ok",
						children: "engine on"
					})]
				}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("ul", {
					className: "grid gap-2 text-xs text-muted",
					children: [
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)("li", { children: "Pass 1 (audit): deterministic + LLM scan for staging contrasts, one-line closers, forced triads, dash chaining, banned vocabulary, inflated significance, sales language, formatting tells, and chatbot residue." }),
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)("li", { children: "Pass 2 (rewrite): surgical rewrite that preserves the Bing skeleton — H1/H2/H3, markdown tables, internal links, and the direct-answer opening." }),
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)("li", { children: "The humanization score and the stripped-pattern list land on each article; the revision stage records the same on the job." })
					]
				})]
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Card, {
				className: "p-5",
				children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
					className: "flex flex-wrap gap-4 font-mono text-sm",
					children: [
						/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", { children: ["SETTLED today ", settled.length] }),
						/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", { children: ["RESERVED today ", reserved.length] }),
						/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", {
							className: "text-muted",
							children: ["RELEASED today ", released.length]
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", {
							className: "text-muted",
							children: ["UTC reset ", nextUtcResetLabel()]
						})
					]
				}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("ul", {
					className: "mt-3 divide-y divide-line text-sm",
					children: events.slice(0, 12).map((event) => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("li", {
						className: "flex flex-wrap items-center justify-between gap-2 py-2",
						children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", {
							className: "flex items-center gap-2",
							children: [
								/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Badge, {
									tone: statusTone(event.state === "SETTLED" ? "completed" : event.state === "RELEASED" ? "cancelled" : "queued"),
									children: event.state
								}),
								/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", { children: [
									event.provider,
									" / ",
									event.model
								] }),
								/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
									className: "text-muted",
									children: event.stage
								})
							]
						}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", {
							className: "font-mono text-xs text-faint",
							children: [
								event.tokens,
								" tok · ",
								money(event.usd),
								" · ",
								relTime(event.at)
							]
						})]
					}, event.id))
				})]
			})
		]
	});
}
var SplitComponent = KeysPage;
//#endregion
export { SplitComponent as component };
