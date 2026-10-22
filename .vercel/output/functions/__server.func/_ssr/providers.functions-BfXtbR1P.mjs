import { Q as isPrivateHost } from "./engine-DWsB6FrJ.mjs";
import { n as array, o as object, s as string } from "../_libs/zod.mjs";
import { t as createServerFn } from "./ssr.mjs";
import { t as createServerRpc } from "./createServerRpc-A6pJPYTF.mjs";
//#region node_modules/.nitro/vite/services/ssr/assets/providers.functions-BfXtbR1P.js
function contentText(message) {
	const msg = message;
	const content = msg?.content;
	if (typeof content === "string" && content.trim()) return content;
	if (Array.isArray(content)) {
		const joined = content.map((part) => {
			if (typeof part === "string") return part;
			const text = part && typeof part === "object" ? part.text : void 0;
			return typeof text === "string" ? text : "";
		}).join("");
		if (joined.trim()) return joined;
	}
	const reasoning = msg?.reasoning_content;
	if (typeof reasoning === "string" && reasoning.trim()) return reasoning;
	const legacy = msg?.text;
	if (typeof legacy === "string" && legacy.trim()) return legacy;
	return typeof content === "string" ? content : "";
}
/** Long-form generation budget: real 2,500–4,000 token drafts plus 2-pass
*  Blader revisions routinely run for minutes, so every chat/completion call
*  gets a 3-minute ceiling instead of the old 10–45s abort. */
var LLM_TIMEOUT_MS = 18e4;
function safeMessage(error) {
	const msg = error instanceof Error ? error.message : "Request failed.";
	if (/api[_-]?key|authorization|bearer|secret/i.test(msg)) return "The provider refused the key.";
	return msg.slice(0, 180);
}
/**
* Opt-in escape hatch for LOCAL model runners (Ollama, LM Studio, llama.cpp,
* and test mocks): when LLM_ALLOW_PRIVATE_HOST=1, private-network and plain-
* http LLM endpoints are permitted. Production deployments leave it unset and
* keep the strict https + public-host SSRF guard.
*/
function allowsPrivateLlmHost() {
	return typeof process !== "undefined" && process.env?.LLM_ALLOW_PRIVATE_HOST === "1";
}
async function assertPublicHttps(raw, allowPath = false) {
	let url;
	try {
		url = new URL(raw.trim());
	} catch {
		throw new Error("Use a full https URL.");
	}
	if (allowsPrivateLlmHost()) {
		if (url.protocol !== "http:" && url.protocol !== "https:") throw new Error("Use an http(s) URL.");
		return url;
	}
	if (url.protocol !== "https:") throw new Error("Only https endpoints are allowed.");
	if (url.username || url.password) throw new Error("Put the key in the key field, not the URL.");
	if (isPrivateHost(url.hostname)) throw new Error("That host is private. Blocked.");
	const dns = await import("node:dns/promises");
	let records = [];
	try {
		records = await dns.lookup(url.hostname, { all: true });
	} catch {
		throw new Error("Could not resolve that host.");
	}
	for (const record of records) {
		const address = record.address.toLowerCase();
		const mapped = address.startsWith("::ffff:") ? address.slice(7) : address;
		if (mapped === "::1" || mapped.startsWith("fe80:") || mapped.startsWith("fc") || mapped.startsWith("fd") || isPrivateHost(mapped)) throw new Error("That host resolves to a private address. Blocked.");
	}
	if (!allowPath) url.hash = "";
	return url;
}
/**
* Resolve any operator-entered base URL to the exact /chat/completions endpoint:
* - "https://api.example.com"            → /v1/chat/completions (bare host)
* - "https://api.example.com/v1"         → /v1/chat/completions
* - "https://api.example.com/v1/custom"  → /v1/custom/chat/completions
* - "https://api.example.com/v1/chat/completions" → unchanged
*/
function chatEndpoint(base) {
	const trimmed = base.trim().replace(/\/+$/, "");
	if (trimmed.endsWith("/chat/completions")) return trimmed;
	let path = "";
	try {
		path = new URL(trimmed).pathname.replace(/\/+$/, "");
	} catch {
		path = "";
	}
	if (path && path !== "") return `${trimmed}/chat/completions`;
	return `${trimmed}/v1/chat/completions`;
}
/**
* Resolve any operator-entered base URL to the exact /models endpoint that lists
* the provider's model ids:
* - "https://api.example.com"            → /v1/models (bare host)
* - "https://api.example.com/v1"         → /v1/models
* - "https://api.example.com/v1/custom"  → /v1/custom/models
* - "https://api.example.com/v1/models"  → unchanged
*/
function modelsEndpoint(base) {
	const trimmed = base.trim().replace(/\/+$/, "");
	if (trimmed.endsWith("/models")) return trimmed;
	const withoutChat = trimmed.endsWith("/chat/completions") ? trimmed.slice(0, -17).replace(/\/+$/, "") : trimmed;
	let path = "";
	try {
		path = new URL(withoutChat).pathname.replace(/\/+$/, "");
	} catch {
		path = "";
	}
	if (path && path !== "") return `${withoutChat}/models`;
	return `${withoutChat}/v1/models`;
}
function embeddingsEndpoint(base) {
	const trimmed = base.trim().replace(/\/+$/, "");
	if (trimmed.endsWith("/embeddings")) return trimmed;
	const withoutChat = trimmed.endsWith("/chat/completions") ? trimmed.slice(0, -17).replace(/\/+$/, "") : trimmed;
	let path = "";
	try {
		path = new URL(withoutChat).pathname.replace(/\/+$/, "");
	} catch {
		path = "";
	}
	if (path && path !== "") return `${withoutChat}/embeddings`;
	return `${withoutChat}/v1/embeddings`;
}
function readModel(input) {
	const o = input;
	const baseUrl = typeof o?.baseUrl === "string" ? o.baseUrl.trim() : "";
	const apiKey = typeof o?.apiKey === "string" ? o.apiKey.trim() : "";
	const model = typeof o?.model === "string" ? o.model.trim() : "";
	if (!baseUrl || !apiKey || !model) throw new Error("Base URL, API key, and model name are required.");
	return {
		baseUrl,
		apiKey,
		model,
		prompt: typeof o?.prompt === "string" ? o.prompt : void 0
	};
}
/** The old embeddingsEndpoint — superseded by the normalized version below. */
var testCustomModel_createServerFn_handler = createServerRpc({
	id: "58109030f1785b371dd86ad88a716e8657a2162ba1f3bfb4c49d6712cc2b0829",
	name: "testCustomModel",
	filename: "src/lib/providers.functions.ts"
}, (opts) => testCustomModel.__executeServer(opts));
var testCustomModel = createServerFn({ method: "POST" }).validator(readModel).handler(testCustomModel_createServerFn_handler, async ({ data }) => {
	try {
		await assertPublicHttps(chatEndpoint(data.baseUrl), true);
		const response = await fetch(chatEndpoint(data.baseUrl), {
			method: "POST",
			redirect: "manual",
			signal: AbortSignal.timeout(2e4),
			headers: {
				Authorization: `Bearer ${data.apiKey}`,
				"Content-Type": "application/json"
			},
			body: JSON.stringify({
				model: data.model,
				temperature: 0,
				max_tokens: 16,
				messages: [{
					role: "user",
					content: "Reply with the single word ready."
				}]
			})
		});
		if (response.status >= 300 && response.status < 400) return {
			ok: false,
			error: "Redirects are blocked."
		};
		if (response.status === 401 || response.status === 403) return {
			ok: false,
			error: "The provider refused the API key."
		};
		if (!response.ok) return {
			ok: false,
			error: `Provider returned HTTP ${response.status}.`
		};
		return {
			ok: true,
			sample: (contentText((await response.json()).choices?.[0]?.message).trim() || "ok").slice(0, 80)
		};
	} catch (error) {
		return {
			ok: false,
			error: safeMessage(error)
		};
	}
});
var listCustomModels_createServerFn_handler = createServerRpc({
	id: "99f4984e83a6b9d6b2445c90982c80b1a46843f0ff6121e3cfe571b37b2a60e8",
	name: "listCustomModels",
	filename: "src/lib/providers.functions.ts"
}, (opts) => listCustomModels.__executeServer(opts));
var listCustomModels = createServerFn({ method: "POST" }).validator((input) => {
	const o = input;
	const baseUrl = typeof o?.baseUrl === "string" ? o.baseUrl.trim() : "";
	const apiKey = typeof o?.apiKey === "string" ? o.apiKey.trim() : "";
	if (!baseUrl || !apiKey) throw new Error("Base URL and API key are required to fetch models.");
	return {
		baseUrl,
		apiKey
	};
}).handler(listCustomModels_createServerFn_handler, async ({ data }) => {
	try {
		const endpoint = modelsEndpoint(data.baseUrl);
		await assertPublicHttps(endpoint, true);
		const response = await fetch(endpoint, {
			method: "GET",
			redirect: "manual",
			signal: AbortSignal.timeout(2e4),
			headers: {
				Authorization: `Bearer ${data.apiKey}`,
				Accept: "application/json"
			}
		});
		if (response.status >= 300 && response.status < 400) return {
			ok: false,
			error: "Redirects are blocked."
		};
		if (response.status === 401 || response.status === 403) return {
			ok: false,
			error: "The provider refused the API key."
		};
		if (response.status === 404) return {
			ok: false,
			error: "This endpoint does not expose /models. Type the model id manually."
		};
		if (!response.ok) return {
			ok: false,
			error: `Provider returned HTTP ${response.status}.`
		};
		const body = await response.json();
		const rows = Array.isArray(body.data) ? body.data : Array.isArray(body.models) ? body.models : [];
		const models = Array.from(new Set(rows.map((row) => typeof row?.id === "string" ? row.id.trim() : "").filter((id) => id.length > 0))).slice(0, 500);
		if (!models.length) return {
			ok: false,
			error: "The endpoint returned no model ids. Type the model id manually."
		};
		return {
			ok: true,
			models
		};
	} catch (error) {
		return {
			ok: false,
			error: safeMessage(error)
		};
	}
});
var getEmbedding_createServerFn_handler = createServerRpc({
	id: "f85a590559bd04a4d53e9d9e9fb5f508f20bafaff4355d13a66f81bd0f9a3f50",
	name: "getEmbedding",
	filename: "src/lib/providers.functions.ts"
}, (opts) => getEmbedding.__executeServer(opts));
var getEmbedding = createServerFn({ method: "POST" }).validator((input) => {
	const base = readModel(input);
	const o = input;
	const text = typeof o.input === "string" ? o.input.trim().slice(0, 8e3) : "";
	if (!text) throw new Error("Nothing to embed.");
	return {
		...base,
		input: text
	};
}).handler(getEmbedding_createServerFn_handler, async ({ data }) => {
	try {
		await assertPublicHttps(embeddingsEndpoint(data.baseUrl), true);
		const response = await fetch(embeddingsEndpoint(data.baseUrl), {
			method: "POST",
			redirect: "manual",
			signal: AbortSignal.timeout(2e4),
			headers: {
				Authorization: `Bearer ${data.apiKey}`,
				"Content-Type": "application/json"
			},
			body: JSON.stringify({
				model: data.model,
				input: data.input
			})
		});
		if (response.status >= 300 && response.status < 400) return {
			ok: false,
			error: "Redirects are blocked."
		};
		if (response.status === 401 || response.status === 403) return {
			ok: false,
			error: "The provider refused the API key."
		};
		if (response.status === 404 || response.status === 400 || response.status === 422) return {
			ok: false,
			error: "This model has no embeddings support."
		};
		if (!response.ok) return {
			ok: false,
			error: `Provider returned HTTP ${response.status}.`
		};
		const body = await response.json();
		const vector = body.data?.[0]?.embedding;
		if (!Array.isArray(vector) || vector.length < 2 || vector.some((n) => typeof n !== "number" || !Number.isFinite(n))) return {
			ok: false,
			error: "This model has no embeddings support."
		};
		return {
			ok: true,
			vector,
			tokens: Math.max(0, Math.round(body.usage?.total_tokens ?? body.usage?.prompt_tokens ?? 0))
		};
	} catch (error) {
		return {
			ok: false,
			error: safeMessage(error)
		};
	}
});
var generateDraft_createServerFn_handler = createServerRpc({
	id: "ff9fe4d17f7009129ef0ab0ce8c8e0ee32a3536baaa9d1753d1d9f3b4619f5c4",
	name: "generateDraft",
	filename: "src/lib/providers.functions.ts"
}, (opts) => generateDraft.__executeServer(opts));
var generateDraft = createServerFn({ method: "POST" }).validator((input) => {
	const base = readModel(input);
	const o = input;
	const system = typeof o.system === "string" ? o.system.slice(0, 4e3) : "";
	const user = typeof o.user === "string" ? o.user.slice(0, 14e3) : "";
	if (!system || !user) throw new Error("Prompt is empty.");
	return {
		...base,
		system,
		user
	};
}).handler(generateDraft_createServerFn_handler, async ({ data }) => {
	try {
		await assertPublicHttps(chatEndpoint(data.baseUrl), true);
		const response = await fetch(chatEndpoint(data.baseUrl), {
			method: "POST",
			redirect: "manual",
			signal: AbortSignal.timeout(LLM_TIMEOUT_MS),
			headers: {
				Authorization: `Bearer ${data.apiKey}`,
				"Content-Type": "application/json"
			},
			body: JSON.stringify({
				model: data.model,
				temperature: .7,
				max_tokens: 8e3,
				messages: [{
					role: "system",
					content: data.system
				}, {
					role: "user",
					content: data.user
				}]
			})
		});
		if (response.status >= 300 && response.status < 400) return {
			ok: false,
			status: response.status,
			error: "Redirects are blocked."
		};
		if (response.status === 401 || response.status === 403) return {
			ok: false,
			status: response.status,
			error: "The provider refused the API key."
		};
		if (!response.ok) return {
			ok: false,
			status: response.status,
			error: `Provider returned HTTP ${response.status}.`
		};
		const body = await response.json();
		const text = contentText(body.choices?.[0]?.message).trim();
		if (text.length < 80) return {
			ok: false,
			status: response.status,
			error: "The model returned an empty draft."
		};
		const prompt = Math.max(0, Math.round(body.usage?.prompt_tokens ?? body.usage?.input_tokens ?? 0));
		const completion = Math.max(0, Math.round(body.usage?.completion_tokens ?? body.usage?.output_tokens ?? 0));
		return {
			ok: true,
			text,
			usage: {
				prompt,
				completion,
				total: Math.max(0, Math.round(body.usage?.total_tokens ?? prompt + completion))
			}
		};
	} catch (error) {
		return {
			ok: false,
			status: 0,
			error: safeMessage(error)
		};
	}
});
var ideasResponseSchema = object({ ideas: array(object({
	keyword: string().min(3).max(140),
	why: string().min(8).max(500)
})).min(1) });
var generateIdeas_createServerFn_handler = createServerRpc({
	id: "0620b4cabe2bd16e83c6a7edaeb88207ce01036d4dd9afe07cc9c61f82820b58",
	name: "generateIdeas",
	filename: "src/lib/providers.functions.ts"
}, (opts) => generateIdeas.__executeServer(opts));
var generateIdeas = createServerFn({ method: "POST" }).validator((input) => {
	const base = readModel(input);
	const o = input;
	const niche = typeof o.niche === "string" ? o.niche.trim().slice(0, 500) : "";
	if (niche.length < 3) throw new Error("Niche is too short.");
	const corpus = Array.isArray(o.corpus) ? o.corpus.slice(0, 160).map((item) => ({
		title: String(item.title ?? "").slice(0, 180),
		slug: String(item.slug ?? "").slice(0, 180),
		permalink: String(item.permalink ?? "").slice(0, 300)
	})).filter((item) => item.title) : [];
	return {
		...base,
		niche,
		corpus
	};
}).handler(generateIdeas_createServerFn_handler, async ({ data }) => {
	try {
		await assertPublicHttps(chatEndpoint(data.baseUrl), true);
		const response = await fetch(chatEndpoint(data.baseUrl), {
			method: "POST",
			redirect: "manual",
			signal: AbortSignal.timeout(LLM_TIMEOUT_MS),
			headers: {
				Authorization: `Bearer ${data.apiKey}`,
				"Content-Type": "application/json"
			},
			body: JSON.stringify({
				model: data.model,
				temperature: .8,
				max_tokens: 1800,
				messages: [{
					role: "system",
					content: "You are a niche strategist. Return strict JSON only, with no markdown fences or prose outside JSON. The shape is {\"ideas\":[{\"keyword\":\"...\",\"why\":\"...\"}]}. Make ideas specific to the niche. Never repeat or lightly rephrase any existing or planned title."
				}, {
					role: "user",
					content: [
						`Niche: ${data.niche}`,
						"Existing or planned corpus:",
						JSON.stringify(data.corpus)
					].join("\n")
				}]
			})
		});
		if (response.status >= 300 && response.status < 400) return {
			ok: false,
			status: response.status,
			error: "Redirects are blocked."
		};
		if (response.status === 401 || response.status === 403) return {
			ok: false,
			status: response.status,
			error: "The provider refused the API key."
		};
		if (!response.ok) return {
			ok: false,
			status: response.status,
			error: `Provider returned HTTP ${response.status}.`
		};
		const body = await response.json();
		const raw = contentText(body.choices?.[0]?.message).trim();
		let parsed;
		try {
			parsed = JSON.parse(raw.replace(/^```json\s*|```$/gi, "").trim());
		} catch {
			return {
				ok: false,
				status: 200,
				error: "The model returned invalid JSON."
			};
		}
		const checked = ideasResponseSchema.safeParse(parsed);
		if (!checked.success) return {
			ok: false,
			status: 200,
			error: `Ideas schema validation failed: ${checked.error.issues.map((issue) => issue.message).join("; ")}`
		};
		const prompt = Math.max(0, Math.round(body.usage?.prompt_tokens ?? body.usage?.input_tokens ?? 0));
		const completion = Math.max(0, Math.round(body.usage?.completion_tokens ?? body.usage?.output_tokens ?? 0));
		const total = Math.max(0, Math.round(body.usage?.total_tokens ?? prompt + completion));
		return {
			ok: true,
			ideas: checked.data.ideas,
			usage: {
				prompt,
				completion,
				total
			}
		};
	} catch (error) {
		return {
			ok: false,
			status: 0,
			error: safeMessage(error)
		};
	}
});
var scrapePage_createServerFn_handler = createServerRpc({
	id: "af8f40e213312ca4942fe6995119351cf411d24bf280ce4a919cb270dcd28d08",
	name: "scrapePage",
	filename: "src/lib/providers.functions.ts"
}, (opts) => scrapePage.__executeServer(opts));
var scrapePage = createServerFn({ method: "POST" }).validator((input) => {
	const o = input;
	const apiKey = typeof o?.apiKey === "string" ? o.apiKey.trim() : "";
	const url = typeof o?.url === "string" ? o.url.trim() : "";
	if (!apiKey || !url) throw new Error("Firecrawl key and URL are required.");
	return {
		apiKey,
		url
	};
}).handler(scrapePage_createServerFn_handler, async ({ data }) => {
	try {
		const target = await assertPublicHttps(data.url, true);
		const response = await fetch("https://api.firecrawl.dev/v1/scrape", {
			method: "POST",
			redirect: "manual",
			signal: AbortSignal.timeout(25e3),
			headers: {
				Authorization: `Bearer ${data.apiKey}`,
				"Content-Type": "application/json"
			},
			body: JSON.stringify({
				url: target.toString(),
				formats: ["markdown"],
				onlyMainContent: true
			})
		});
		if (response.status === 401 || response.status === 403) return {
			ok: false,
			error: "Firecrawl refused the API key."
		};
		if (!response.ok) return {
			ok: false,
			error: `Firecrawl HTTP ${response.status}.`
		};
		const body = await response.json();
		const markdown = body.data?.markdown?.trim() ?? "";
		if (!markdown) return {
			ok: false,
			error: "Firecrawl returned no markdown."
		};
		return {
			ok: true,
			title: body.data?.metadata?.title || target.hostname,
			markdown: markdown.slice(0, 4e3)
		};
	} catch (error) {
		return {
			ok: false,
			error: safeMessage(error)
		};
	}
});
var tavilySearch_createServerFn_handler = createServerRpc({
	id: "48a3318f029d5c5582346277b69de7e60ad5911f9d55bdb65e28976a1b575f7b",
	name: "tavilySearch",
	filename: "src/lib/providers.functions.ts"
}, (opts) => tavilySearch.__executeServer(opts));
var tavilySearch = createServerFn({ method: "POST" }).validator((input) => {
	const o = input;
	const apiKey = typeof o?.apiKey === "string" ? o.apiKey.trim() : "";
	const query = typeof o?.query === "string" ? o.query.trim().slice(0, 400) : "";
	if (!apiKey || !query) throw new Error("Tavily key and query are required.");
	return {
		apiKey,
		query,
		maxResults: Math.min(10, Math.max(1, Math.round(Number(o?.maxResults) || 5)))
	};
}).handler(tavilySearch_createServerFn_handler, async ({ data }) => {
	try {
		const response = await fetch("https://api.tavily.com/search", {
			method: "POST",
			redirect: "manual",
			signal: AbortSignal.timeout(25e3),
			headers: {
				Authorization: `Bearer ${data.apiKey}`,
				"Content-Type": "application/json"
			},
			body: JSON.stringify({
				api_key: data.apiKey,
				query: data.query,
				max_results: data.maxResults,
				search_depth: "basic",
				include_answer: true
			})
		});
		if (response.status === 401 || response.status === 403) return {
			ok: false,
			status: response.status,
			error: "Tavily refused the API key."
		};
		if (response.status === 429) return {
			ok: false,
			status: 429,
			error: "Tavily rate limit."
		};
		if (!response.ok) return {
			ok: false,
			status: response.status,
			error: `Tavily HTTP ${response.status}.`
		};
		const body = await response.json();
		const results = (body.results ?? []).map((row) => ({
			title: String(row.title ?? "").slice(0, 200),
			url: String(row.url ?? ""),
			snippet: String(row.content ?? "").slice(0, 1200)
		})).filter((row) => row.url.startsWith("http"));
		if (!results.length) return {
			ok: false,
			status: 200,
			error: "Tavily returned no results."
		};
		return {
			ok: true,
			results,
			answer: body.answer ? body.answer.slice(0, 1200) : void 0
		};
	} catch (error) {
		return {
			ok: false,
			status: 0,
			error: safeMessage(error)
		};
	}
});
var firecrawlSearch_createServerFn_handler = createServerRpc({
	id: "41f8e2001e8bbb6f6104d21a4d44df3762728d1351f200c247433e77d3e33128",
	name: "firecrawlSearch",
	filename: "src/lib/providers.functions.ts"
}, (opts) => firecrawlSearch.__executeServer(opts));
var firecrawlSearch = createServerFn({ method: "POST" }).validator((input) => {
	const o = input;
	const apiKey = typeof o?.apiKey === "string" ? o.apiKey.trim() : "";
	const query = typeof o?.query === "string" ? o.query.trim().slice(0, 400) : "";
	if (!apiKey || !query) throw new Error("Firecrawl key and query are required.");
	return {
		apiKey,
		query,
		maxResults: Math.min(10, Math.max(1, Math.round(Number(o?.maxResults) || 5)))
	};
}).handler(firecrawlSearch_createServerFn_handler, async ({ data }) => {
	try {
		const response = await fetch("https://api.firecrawl.dev/v1/search", {
			method: "POST",
			redirect: "manual",
			signal: AbortSignal.timeout(3e4),
			headers: {
				Authorization: `Bearer ${data.apiKey}`,
				"Content-Type": "application/json"
			},
			body: JSON.stringify({
				query: data.query,
				limit: data.maxResults,
				scrapeOptions: {
					formats: ["markdown"],
					onlyMainContent: true
				}
			})
		});
		if (response.status === 401 || response.status === 403) return {
			ok: false,
			status: response.status,
			error: "Firecrawl refused the API key."
		};
		if (response.status === 429) return {
			ok: false,
			status: 429,
			error: "Firecrawl rate limit."
		};
		if (!response.ok) return {
			ok: false,
			status: response.status,
			error: `Firecrawl HTTP ${response.status}.`
		};
		const results = ((await response.json()).data ?? []).map((row) => ({
			title: String(row.title ?? "").slice(0, 200),
			url: String(row.url ?? ""),
			snippet: String(row.markdown ?? row.description ?? "").slice(0, 1200)
		})).filter((row) => row.url.startsWith("http"));
		if (!results.length) return {
			ok: false,
			status: 200,
			error: "Firecrawl returned no results."
		};
		return {
			ok: true,
			results
		};
	} catch (error) {
		return {
			ok: false,
			status: 0,
			error: safeMessage(error)
		};
	}
});
//#endregion
export { firecrawlSearch_createServerFn_handler, generateDraft_createServerFn_handler, generateIdeas_createServerFn_handler, getEmbedding_createServerFn_handler, listCustomModels_createServerFn_handler, scrapePage_createServerFn_handler, tavilySearch_createServerFn_handler, testCustomModel_createServerFn_handler };
