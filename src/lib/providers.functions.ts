import { z } from "zod";
import { post } from "./api-client";

/**
 * Provider calls, all executed by the Rust API.
 *
 * These used to be server functions because they needed to reach a provider with
 * a key the page must not hold. The API does that now, and this build is a static
 * SPA with no Node server behind it — so every call here is a plain fetch to
 * `gaw-api`. Nothing in this file accepts or needs a key for the studio's own
 * pool; the per-request keys below are the operator's own custom-endpoint and
 * search-provider credentials.
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

type ModelInput = { baseUrl?: string; apiKey?: string; model?: string; prompt?: string; keyId?: number };

/** One tiny completion: proves the key, the endpoint and the model id agree. */
export async function testCustomModel(input: { data: ModelInput }): Promise<
  { ok: true; sample: string } | { ok: false; error: string }
> {
  const d = input?.data ?? {};
  if (!d.baseUrl?.trim() || !d.apiKey?.trim() || !d.model?.trim()) {
    return { ok: false, error: "Base URL, API key, and model name are required." };
  }
  const res = await post<{ ok: boolean; sample?: string; error?: string }>(
    "/api/v1/providers/test-model",
    { base_url: d.baseUrl.trim(), api_key: d.apiKey.trim(), model: d.model.trim() },
  );
  if (!res.ok) return { ok: false, error: res.error };
  if (!res.data.ok) return { ok: false, error: res.data.error ?? "The model test failed." };
  return { ok: true, sample: res.data.sample ?? "ok" };
}

/** Live model discovery for a custom OpenAI-compatible endpoint. */
export async function listCustomModels(input: {
  data: { baseUrl?: string; apiKey?: string };
}): Promise<{ ok: true; models: string[] } | { ok: false; error: string }> {
  const d = input?.data ?? {};
  if (!d.baseUrl?.trim() || !d.apiKey?.trim()) {
    return { ok: false, error: "Base URL and API key are required to fetch models." };
  }
  const res = await post<{ ok: boolean; models?: string[]; error?: string }>(
    "/api/v1/providers/models",
    { base_url: d.baseUrl.trim(), api_key: d.apiKey.trim() },
  );
  if (!res.ok) return { ok: false, error: res.error };
  if (!res.data.ok) {
    return { ok: false, error: res.data.error ?? "The endpoint returned no model ids." };
  }
  return { ok: true, models: res.data.models ?? [] };
}

export async function getEmbedding(input: {
  data: ModelInput & { input?: string };
}): Promise<{ ok: true; vector: number[]; tokens: number } | { ok: false; error: string }> {
  const d = input?.data ?? {};
  const text = (d.input ?? "").trim().slice(0, 8000);
  if (!text) return { ok: false, error: "Nothing to embed." };
  // A key saved on the server has no local secret, so name it and let Rust use the
  // sealed credential. `model` still comes from the browser, which knows which
  // embedding model this key was configured with.
  const res = await post<{ ok: boolean; vector?: number[]; tokens?: number; error?: string }>(
    "/api/v1/embeddings",
    {
      base_url: d.baseUrl?.trim() ?? "",
      api_key: d.apiKey?.trim() ?? "",
      model: d.model?.trim() ?? "",
      input: text,
      key_id: d.keyId,
    },
  );
  if (!res.ok) return { ok: false, error: res.error };
  if (!res.data.ok) {
    return { ok: false, error: res.data.error ?? "This model has no embeddings support." };
  }
  return { ok: true, vector: res.data.vector ?? [], tokens: res.data.tokens ?? 0 };
}

export async function generateDraft(input: {
  data: { system?: string; user?: string; preferredKeyId?: number };
}): Promise<
  | { ok: true; text: string; usage: { prompt: number; completion: number; total: number } }
  | { ok: false; status: number; error: string }
> {
  const d = input?.data ?? {};
  // The prompt is what steers the draft. These caps used to be 4,000/14,000,
  // which silently amputated the blueprint and the research notes on a long
  // article — the model then answered with a stub, and the caller reported
  // "The model returned an empty draft." for what was really a truncated
  // prompt. The server enforces its own limits; this is only a sanity bound.
  const system = (d.system ?? "").slice(0, 12_000);
  const user = (d.user ?? "").slice(0, 48_000);
  if (!system || !user) return { ok: false, status: 0, error: "Prompt is empty." };
  const result = await serverCompletion({ system, user, preferredKeyId: d.preferredKeyId });
  if (!result.ok) return result;
  // A real draft is long. A stub is a failure, not a draft — but say which it
  // was, so the next person does not go looking for a provider outage.
  if (result.text.trim().length < 80) {
    return {
      ok: false,
      status: 200,
      error:
        "The model returned no usable draft (fewer than 80 characters). Two causes: the " +
        "answer was cut off at the provider's output limit, or the model answered with " +
        "nothing at all — usually a reasoning model spending the whole budget before its " +
        "first visible token. The article is retried, not lost.",
    };
  }
  return result;
}

const ideasResponseSchema = z.object({
  ideas: z
    .array(z.object({ keyword: z.string().min(3).max(140), why: z.string().min(8).max(500) }))
    .min(1),
});

export async function generateIdeas(input: {
  data: {
    niche?: string;
    corpus?: { title?: string; slug?: string; permalink?: string }[];
    preferredKeyId?: number;
  };
}): Promise<
  | { ok: true; ideas: { keyword: string; why: string }[]; usage: { prompt: number; completion: number; total: number } }
  | { ok: false; status: number; error: string }
> {
  const d = input?.data ?? {};
  const niche = (d.niche ?? "").trim().slice(0, 500);
  if (niche.length < 3) return { ok: false, status: 0, error: "Niche is too short." };
  const corpus = (d.corpus ?? [])
    .slice(0, 160)
    .map((item) => ({
      title: String(item.title ?? "").slice(0, 180),
      slug: String(item.slug ?? "").slice(0, 180),
      permalink: String(item.permalink ?? "").slice(0, 300),
    }))
    .filter((item) => item.title);
  const call = await serverCompletion({
    system:
      'You are a niche strategist. Return strict JSON only, with no markdown fences or prose outside JSON. The shape is {"ideas":[{"keyword":"...","why":"..."}]}. Make ideas specific to the niche. Never repeat or lightly rephrase any existing or planned title.',
    user: [`Niche: ${niche}`, "Existing or planned corpus:", JSON.stringify(corpus)].join("\n"),
    json: true,
    preferredKeyId: d.preferredKeyId,
  });
  if (!call.ok) return call;
  let parsed: unknown;
  try {
    parsed = JSON.parse(call.text.replace(/^```json\s*|```$/gi, "").trim());
  } catch {
    return { ok: false, status: 200, error: "The model returned invalid JSON." };
  }
  const checked = ideasResponseSchema.safeParse(parsed);
  if (!checked.success) {
    return {
      ok: false,
      status: 200,
      error: `Ideas schema validation failed: ${checked.error.issues.map((issue) => issue.message).join("; ")}`,
    };
  }
  return { ok: true, ideas: checked.data.ideas, usage: call.usage };
}

export async function scrapePage(input: {
  data: { apiKey?: string; url?: string };
}): Promise<{ ok: true; title: string; markdown: string } | { ok: false; error: string }> {
  const d = input?.data ?? {};
  if (!d.apiKey?.trim() || !d.url?.trim()) {
    return { ok: false, error: "Firecrawl key and URL are required." };
  }
  const res = await post<{ ok: boolean; title?: string; markdown?: string; error?: string }>(
    "/api/v1/scrape",
    { api_key: d.apiKey.trim(), url: d.url.trim() },
  );
  if (!res.ok) return { ok: false, error: res.error };
  if (!res.data.ok) return { ok: false, error: res.data.error ?? "Firecrawl returned no markdown." };
  return { ok: true, title: res.data.title ?? "", markdown: res.data.markdown ?? "" };
}

type SearchHit = { title: string; url: string; snippet: string };

/** Rule 5 — Tavily web search. */
export async function tavilySearch(input: {
  data: { apiKey?: string; query?: string; maxResults?: number };
}): Promise<
  | { ok: true; results: SearchHit[]; answer?: string }
  | { ok: false; status: number; error: string }
> {
  const d = input?.data ?? {};
  if (!d.apiKey?.trim() || !d.query?.trim()) {
    return { ok: false, status: 0, error: "Tavily key and query are required." };
  }
  const res = await post<{ ok: boolean; results?: SearchHit[]; answer?: string; status?: number; error?: string }>(
    "/api/v1/search/tavily",
    {
      api_key: d.apiKey.trim(),
      query: d.query.trim().slice(0, 400),
      max_results: d.maxResults ?? 5,
    },
  );
  if (!res.ok) return { ok: false, status: 0, error: res.error };
  if (!res.data.ok) {
    return { ok: false, status: res.data.status ?? 0, error: res.data.error ?? "Tavily failed." };
  }
  return { ok: true, results: res.data.results ?? [], answer: res.data.answer };
}

/** Rule 5 — Firecrawl web search. */
export async function firecrawlSearch(input: {
  data: { apiKey?: string; query?: string; maxResults?: number };
}): Promise<
  { ok: true; results: SearchHit[] } | { ok: false; status: number; error: string }
> {
  const d = input?.data ?? {};
  if (!d.apiKey?.trim() || !d.query?.trim()) {
    return { ok: false, status: 0, error: "Firecrawl key and query are required." };
  }
  const res = await post<{ ok: boolean; results?: SearchHit[]; status?: number; error?: string }>(
    "/api/v1/search/firecrawl",
    {
      api_key: d.apiKey.trim(),
      query: d.query.trim().slice(0, 400),
      max_results: d.maxResults ?? 5,
    },
  );
  if (!res.ok) return { ok: false, status: 0, error: res.error };
  if (!res.data.ok) {
    return { ok: false, status: res.data.status ?? 0, error: res.data.error ?? "Firecrawl failed." };
  }
  return { ok: true, results: res.data.results ?? [] };
}
