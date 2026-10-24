import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { isPrivateHost } from "./engine";
import { contentText } from "./chat-content";
import { post } from "./api-client";

/**
 * One completion, executed by the Rust backend.
 *
 * These helpers used to call the provider directly with a key held in the
 * browser. Keys now live in `ai_keys`, sealed, and the pool's failover runs
 * server-side — so the prompt goes out and only text comes back. Nothing here
 * accepts or needs a secret.
 */
async function serverCompletion(input: {
  system: string;
  user: string;
  json?: boolean;
  preferredKeyId?: number;
}): Promise<
  | { ok: true; text: string; usage: { prompt: number; completion: number; total: number } }
  | { ok: false; status: number; error: string }
> {
  const res = await post<{ text: string; tokens_in: number; tokens_out: number }>(
    "/api/v1/generate",
    {
      workspace_id: 1,
      system: input.system,
      user: input.user,
      json: Boolean(input.json),
      preferred_key_id: input.preferredKeyId,
    },
  );
  if (!res.ok) return { ok: false as const, status: 0, error: res.error };
  const prompt = Math.max(0, Math.round(res.data.tokens_in ?? 0));
  const completion = Math.max(0, Math.round(res.data.tokens_out ?? 0));
  return {
    ok: true as const,
    text: res.data.text,
    usage: { prompt, completion, total: prompt + completion },
  };
}

function safeMessage(error: unknown): string {
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
function allowsPrivateLlmHost(): boolean {
  return typeof process !== "undefined" && process.env?.LLM_ALLOW_PRIVATE_HOST === "1";
}

async function assertPublicHttps(raw: string, allowPath = false): Promise<URL> {
  let url: URL;
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
  let records: { address: string }[] = [];
  try {
    records = await dns.lookup(url.hostname, { all: true });
  } catch {
    throw new Error("Could not resolve that host.");
  }
  for (const record of records) {
    const address = record.address.toLowerCase();
    const mapped = address.startsWith("::ffff:") ? address.slice(7) : address;
    if (mapped === "::1" || mapped.startsWith("fe80:") || mapped.startsWith("fc") || mapped.startsWith("fd") || isPrivateHost(mapped)) {
      throw new Error("That host resolves to a private address. Blocked.");
    }
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
function chatEndpoint(base: string): string {
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
function modelsEndpoint(base: string): string {
  const trimmed = base.trim().replace(/\/+$/, "");
  if (trimmed.endsWith("/models")) return trimmed;
  const withoutChat = trimmed.endsWith("/chat/completions") ? trimmed.slice(0, -"/chat/completions".length).replace(/\/+$/, "") : trimmed;
  let path = "";
  try {
    path = new URL(withoutChat).pathname.replace(/\/+$/, "");
  } catch {
    path = "";
  }
  if (path && path !== "") return `${withoutChat}/models`;
  return `${withoutChat}/v1/models`;
}

function embeddingsEndpoint(base: string): string {
  const trimmed = base.trim().replace(/\/+$/, "");
  if (trimmed.endsWith("/embeddings")) return trimmed;
  const withoutChat = trimmed.endsWith("/chat/completions") ? trimmed.slice(0, -"/chat/completions".length).replace(/\/+$/, "") : trimmed;
  let path = "";
  try {
    path = new URL(withoutChat).pathname.replace(/\/+$/, "");
  } catch {
    path = "";
  }
  if (path && path !== "") return `${withoutChat}/embeddings`;
  return `${withoutChat}/v1/embeddings`;
}

function readModel(input: unknown): { baseUrl: string; apiKey: string; model: string; prompt?: string } {
  const o = input as { baseUrl?: string; apiKey?: string; model?: string; prompt?: string } | null;
  const baseUrl = typeof o?.baseUrl === "string" ? o.baseUrl.trim() : "";
  const apiKey = typeof o?.apiKey === "string" ? o.apiKey.trim() : "";
  const model = typeof o?.model === "string" ? o.model.trim() : "";
  if (!baseUrl || !apiKey || !model) throw new Error("Base URL, API key, and model name are required.");
  return { baseUrl, apiKey, model, prompt: typeof o?.prompt === "string" ? o.prompt : undefined };
}

/** The old embeddingsEndpoint — superseded by the normalized version below. */

export const testCustomModel = createServerFn({ method: "POST" })
  .validator(readModel)
  .handler(async ({ data }) => {
    try {
      await assertPublicHttps(chatEndpoint(data.baseUrl), true);
      const response = await fetch(chatEndpoint(data.baseUrl), {
        method: "POST",
        redirect: "manual",
        signal: AbortSignal.timeout(20000),
        headers: {
          Authorization: `Bearer ${data.apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: data.model,
          temperature: 0,
          max_tokens: 16,
          messages: [{ role: "user", content: "Reply with the single word ready." }],
        }),
      });
      if (response.status >= 300 && response.status < 400) return { ok: false as const, error: "Redirects are blocked." };
      if (response.status === 401 || response.status === 403) return { ok: false as const, error: "The provider refused the API key." };
      if (!response.ok) return { ok: false as const, error: `Provider returned HTTP ${response.status}.` };
      const body = (await response.json()) as { choices?: { message?: unknown }[] };
      const text = contentText(body.choices?.[0]?.message).trim() || "ok";
      return { ok: true as const, sample: text.slice(0, 80) };
    } catch (error) {
      return { ok: false as const, error: safeMessage(error) };
    }
  });

/**
 * Live model discovery for a custom OpenAI-compatible endpoint. Requests
 * `{normalizedBaseUrl}/models` with `Authorization: Bearer {apiKey}` and returns
 * the parsed `data[].id` list so the operator can pick the exact model id.
 * Manual typing stays available when a provider does not expose /models.
 */
export const listCustomModels = createServerFn({ method: "POST" })
  .validator((input: unknown) => {
    const o = input as { baseUrl?: string; apiKey?: string } | null;
    const baseUrl = typeof o?.baseUrl === "string" ? o.baseUrl.trim() : "";
    const apiKey = typeof o?.apiKey === "string" ? o.apiKey.trim() : "";
    if (!baseUrl || !apiKey) throw new Error("Base URL and API key are required to fetch models.");
    return { baseUrl, apiKey };
  })
  .handler(async ({ data }) => {
    try {
      const endpoint = modelsEndpoint(data.baseUrl);
      await assertPublicHttps(endpoint, true);
      const response = await fetch(endpoint, {
        method: "GET",
        redirect: "manual",
        signal: AbortSignal.timeout(20000),
        headers: {
          Authorization: `Bearer ${data.apiKey}`,
          Accept: "application/json",
        },
      });
      if (response.status >= 300 && response.status < 400) return { ok: false as const, error: "Redirects are blocked." };
      if (response.status === 401 || response.status === 403) return { ok: false as const, error: "The provider refused the API key." };
      if (response.status === 404) return { ok: false as const, error: "This endpoint does not expose /models. Type the model id manually." };
      if (!response.ok) return { ok: false as const, error: `Provider returned HTTP ${response.status}.` };
      const body = (await response.json()) as { data?: { id?: unknown }[]; models?: { id?: unknown }[] };
      const rows = Array.isArray(body.data) ? body.data : Array.isArray(body.models) ? body.models : [];
      const models = Array.from(
        new Set(
          rows
            .map((row) => (typeof row?.id === "string" ? row.id.trim() : ""))
            .filter((id): id is string => id.length > 0),
        ),
      ).slice(0, 500);
      if (!models.length) return { ok: false as const, error: "The endpoint returned no model ids. Type the model id manually." };
      return { ok: true as const, models };
    } catch (error) {
      return { ok: false as const, error: safeMessage(error) };
    }
  });

export const getEmbedding = createServerFn({ method: "POST" })
  .validator((input: unknown) => {
    const base = readModel(input);
    const o = input as { input?: string };
    const text = typeof o.input === "string" ? o.input.trim().slice(0, 8000) : "";
    if (!text) throw new Error("Nothing to embed.");
    return { ...base, input: text };
  })
  .handler(async ({ data }) => {
    try {
      await assertPublicHttps(embeddingsEndpoint(data.baseUrl), true);
      const response = await fetch(embeddingsEndpoint(data.baseUrl), {
        method: "POST",
        redirect: "manual",
        signal: AbortSignal.timeout(20000),
        headers: {
          Authorization: `Bearer ${data.apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ model: data.model, input: data.input }),
      });
      if (response.status >= 300 && response.status < 400) return { ok: false as const, error: "Redirects are blocked." };
      if (response.status === 401 || response.status === 403) return { ok: false as const, error: "The provider refused the API key." };
      if (response.status === 404 || response.status === 400 || response.status === 422) {
        return { ok: false as const, error: "This model has no embeddings support." };
      }
      if (!response.ok) return { ok: false as const, error: `Provider returned HTTP ${response.status}.` };
      const body = (await response.json()) as {
        data?: { embedding?: number[] }[];
        usage?: { prompt_tokens?: number; total_tokens?: number };
      };
      const vector = body.data?.[0]?.embedding;
      if (!Array.isArray(vector) || vector.length < 2 || vector.some((n) => typeof n !== "number" || !Number.isFinite(n))) {
        return { ok: false as const, error: "This model has no embeddings support." };
      }
      const tokens = Math.max(0, Math.round(body.usage?.total_tokens ?? body.usage?.prompt_tokens ?? 0));
      return { ok: true as const, vector, tokens };
    } catch (error) {
      return { ok: false as const, error: safeMessage(error) };
    }
  });

export const generateDraft = createServerFn({ method: "POST" })
  .validator((input: unknown) => {
    const o = input as { system?: string; user?: string; preferredKeyId?: number } | null;
    const system = typeof o?.system === "string" ? o.system.slice(0, 4000) : "";
    const user = typeof o?.user === "string" ? o.user.slice(0, 14000) : "";
    if (!system || !user) throw new Error("Prompt is empty.");
    // No baseUrl/apiKey: the server owns keys and endpoints now.
    return { system, user, preferredKeyId: typeof o?.preferredKeyId === "number" ? o.preferredKeyId : undefined };
  })
  .handler(async ({ data }) => {
    const result = await serverCompletion({
      system: data.system,
      user: data.user,
      preferredKeyId: data.preferredKeyId,
    });
    if (!result.ok) return result;
    // Same floor the direct call enforced: a stub is a failure, not a draft.
    if (result.text.length < 80) {
      return { ok: false as const, status: 200, error: "The model returned an empty draft." };
    }
    return result;
  });

const ideasResponseSchema = z.object({
  ideas: z.array(z.object({ keyword: z.string().min(3).max(140), why: z.string().min(8).max(500) })).min(1),
});

export const generateIdeas = createServerFn({ method: "POST" })
  .validator((input: unknown) => {
    const o = input as { niche?: string; corpus?: { title?: string; slug?: string; permalink?: string }[]; preferredKeyId?: number } | null;
    const niche = typeof o?.niche === "string" ? o.niche.trim().slice(0, 500) : "";
    if (niche.length < 3) throw new Error("Niche is too short.");
    const corpus = Array.isArray(o?.corpus)
      ? o.corpus.slice(0, 160).map((item) => ({ title: String(item.title ?? "").slice(0, 180), slug: String(item.slug ?? "").slice(0, 180), permalink: String(item.permalink ?? "").slice(0, 300) })).filter((item) => item.title)
      : [];
    // No key or endpoint: the server owns both now.
    const preferredKeyId = typeof o?.preferredKeyId === "number" ? o.preferredKeyId : undefined;
    return { niche, corpus, preferredKeyId };
  })
  .handler(async ({ data }) => {
    const call = await serverCompletion({
      system: "You are a niche strategist. Return strict JSON only, with no markdown fences or prose outside JSON. The shape is {\"ideas\":[{\"keyword\":\"...\",\"why\":\"...\"}]}. Make ideas specific to the niche. Never repeat or lightly rephrase any existing or planned title.",
      user: [`Niche: ${data.niche}`, "Existing or planned corpus:", JSON.stringify(data.corpus)].join("\n"),
      json: true,
      preferredKeyId: data.preferredKeyId,
    });
    if (!call.ok) return call;
    let parsed: unknown;
    try {
      parsed = JSON.parse(call.text.replace(/^```json\s*|```$/gi, "").trim());
    } catch {
      return { ok: false as const, status: 200, error: "The model returned invalid JSON." };
    }
    const checked = ideasResponseSchema.safeParse(parsed);
    if (!checked.success) return { ok: false as const, status: 200, error: `Ideas schema validation failed: ${checked.error.issues.map((issue) => issue.message).join("; ")}` };
    return { ok: true as const, ideas: checked.data.ideas, usage: call.usage };
  });

export const scrapePage = createServerFn({ method: "POST" })
  .validator((input: unknown) => {
    const o = input as { apiKey?: string; url?: string } | null;
    const apiKey = typeof o?.apiKey === "string" ? o.apiKey.trim() : "";
    const url = typeof o?.url === "string" ? o.url.trim() : "";
    if (!apiKey || !url) throw new Error("Firecrawl key and URL are required.");
    return { apiKey, url };
  })
  .handler(async ({ data }) => {
    try {
      const target = await assertPublicHttps(data.url, true);
      const response = await fetch("https://api.firecrawl.dev/v1/scrape", {
        method: "POST",
        redirect: "manual",
        signal: AbortSignal.timeout(25000),
        headers: {
          Authorization: `Bearer ${data.apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          url: target.toString(),
          formats: ["markdown"],
          onlyMainContent: true,
        }),
      });
      if (response.status === 401 || response.status === 403) return { ok: false as const, error: "Firecrawl refused the API key." };
      if (!response.ok) return { ok: false as const, error: `Firecrawl HTTP ${response.status}.` };
      const body = (await response.json()) as { success?: boolean; data?: { markdown?: string; metadata?: { title?: string } } };
      const markdown = body.data?.markdown?.trim() ?? "";
      if (!markdown) return { ok: false as const, error: "Firecrawl returned no markdown." };
      return {
        ok: true as const,
        title: body.data?.metadata?.title || target.hostname,
        markdown: markdown.slice(0, 4000),
      };
    } catch (error) {
      return { ok: false as const, error: safeMessage(error) };
    }
  });

/**
 * Rule 5 — Tavily web search.
 * https://docs.tavily.com — POST /search with the key in the body (classic) and
 * an Authorization bearer header (current). SSRF is not relevant here because the
 * provider is a fixed host, but the query is length-capped.
 */
export const tavilySearch = createServerFn({ method: "POST" })
  .validator((input: unknown) => {
    const o = input as { apiKey?: string; query?: string; maxResults?: number } | null;
    const apiKey = typeof o?.apiKey === "string" ? o.apiKey.trim() : "";
    const query = typeof o?.query === "string" ? o.query.trim().slice(0, 400) : "";
    if (!apiKey || !query) throw new Error("Tavily key and query are required.");
    const maxResults = Math.min(10, Math.max(1, Math.round(Number(o?.maxResults) || 5)));
    return { apiKey, query, maxResults };
  })
  .handler(async ({ data }) => {
    try {
      const response = await fetch("https://api.tavily.com/search", {
        method: "POST",
        redirect: "manual",
        signal: AbortSignal.timeout(25000),
        headers: {
          Authorization: `Bearer ${data.apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          api_key: data.apiKey,
          query: data.query,
          max_results: data.maxResults,
          search_depth: "basic",
          include_answer: true,
        }),
      });
      if (response.status === 401 || response.status === 403) return { ok: false as const, status: response.status, error: "Tavily refused the API key." };
      if (response.status === 429) return { ok: false as const, status: 429, error: "Tavily rate limit." };
      if (!response.ok) return { ok: false as const, status: response.status, error: `Tavily HTTP ${response.status}.` };
      const body = (await response.json()) as {
        answer?: string;
        results?: { title?: string; url?: string; content?: string; score?: number }[];
      };
      const results = (body.results ?? [])
        .map((row) => ({
          title: String(row.title ?? "").slice(0, 200),
          url: String(row.url ?? ""),
          snippet: String(row.content ?? "").slice(0, 1200),
        }))
        .filter((row) => row.url.startsWith("http"));
      if (!results.length) return { ok: false as const, status: 200, error: "Tavily returned no results." };
      return { ok: true as const, results, answer: body.answer ? body.answer.slice(0, 1200) : undefined };
    } catch (error) {
      return { ok: false as const, status: 0, error: safeMessage(error) };
    }
  });

/**
 * Rule 5 — Firecrawl web search (as opposed to scrape of one URL).
 * POST https://api.firecrawl.dev/v1/search
 */
export const firecrawlSearch = createServerFn({ method: "POST" })
  .validator((input: unknown) => {
    const o = input as { apiKey?: string; query?: string; maxResults?: number } | null;
    const apiKey = typeof o?.apiKey === "string" ? o.apiKey.trim() : "";
    const query = typeof o?.query === "string" ? o.query.trim().slice(0, 400) : "";
    if (!apiKey || !query) throw new Error("Firecrawl key and query are required.");
    const maxResults = Math.min(10, Math.max(1, Math.round(Number(o?.maxResults) || 5)));
    return { apiKey, query, maxResults };
  })
  .handler(async ({ data }) => {
    try {
      const response = await fetch("https://api.firecrawl.dev/v1/search", {
        method: "POST",
        redirect: "manual",
        signal: AbortSignal.timeout(30000),
        headers: {
          Authorization: `Bearer ${data.apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          query: data.query,
          limit: data.maxResults,
          scrapeOptions: { formats: ["markdown"], onlyMainContent: true },
        }),
      });
      if (response.status === 401 || response.status === 403) return { ok: false as const, status: response.status, error: "Firecrawl refused the API key." };
      if (response.status === 429) return { ok: false as const, status: 429, error: "Firecrawl rate limit." };
      if (!response.ok) return { ok: false as const, status: response.status, error: `Firecrawl HTTP ${response.status}.` };
      const body = (await response.json()) as {
        success?: boolean;
        data?: { title?: string; url?: string; description?: string; markdown?: string }[];
      };
      const results = (body.data ?? [])
        .map((row) => ({
          title: String(row.title ?? "").slice(0, 200),
          url: String(row.url ?? ""),
          snippet: String(row.markdown ?? row.description ?? "").slice(0, 1200),
        }))
        .filter((row) => row.url.startsWith("http"));
      if (!results.length) return { ok: false as const, status: 200, error: "Firecrawl returned no results." };
      return { ok: true as const, results };
    } catch (error) {
      return { ok: false as const, status: 0, error: safeMessage(error) };
    }
  });
