import type { AiKey } from "./types";

/**
 * Rule 4 — model catalog.
 * Mirrors the live ghost.bloggent.com catalog captured in
 * knowledge-base/LIVE_REA_REALTIME_AUDIT.md (2026-10-16) and adds a Custom
 * OpenAI-compatible entry so an operator can point at any gateway
 * (GLM, DeepSeek, Groq, xAI, local proxy, …).
 */
export type ModelProvider = "openai" | "openrouter" | "custom";
export type ModelGroup = "fast" | "balanced" | "flagship" | "custom";

export type CatalogModel = {
  /** Stable id used by the key form. */
  id: string;
  provider: ModelProvider;
  /** Actual provider model string sent in the request body. */
  modelId: string;
  label: string;
  group: ModelGroup;
  inputPricePerMillion: number;
  outputPricePerMillion: number;
  /** Default OpenAI-compatible base URL for this provider. */
  baseUrl: string;
  note?: string;
};

export const PROVIDER_LABELS: Record<ModelProvider, string> = {
  openai: "OpenAI",
  openrouter: "OpenRouter",
  custom: "Custom endpoint",
};

export const PROVIDER_BASE_URLS: Record<ModelProvider, string> = {
  openai: "https://api.openai.com/v1",
  openrouter: "https://openrouter.ai/api/v1",
  custom: "",
};

/**
 * GOVERNOR §3/§5 — the semantic embedding model is a separate capability from
 * chat (WORKFLOW-MAP §10: usage events settle `text-embedding-3-small`). The L3
 * duplicate gate reuses the chat key but must call an embeddings-capable model,
 * never the chat model id.
 */
export const DEFAULT_EMBEDDING_MODEL = "text-embedding-3-small";

const PROVIDER_EMBEDDING_MODELS: Record<ModelProvider, string | undefined> = {
  openai: DEFAULT_EMBEDDING_MODEL,
  // OpenRouter does not expose a stable /embeddings route for every model, so an
  // operator must name one explicitly rather than have us guess.
  openrouter: undefined,
  custom: undefined,
};

export function providerForKind(kind: AiKey["providerKind"] | undefined, fallbackProvider = ""): ModelProvider {
  if (kind) return kind;
  const provider = fallbackProvider.toLowerCase();
  if (provider.includes("openrouter")) return "openrouter";
  if (provider.includes("openai")) return "openai";
  return "custom";
}

/**
 * The embedding model this key should call, or undefined when the provider
 * family has no known embeddings endpoint (fail honest → L3 hash fallback).
 */
export function embeddingModelFor(key: Pick<AiKey, "providerKind" | "provider" | "embeddingModel">): string | undefined {
  const explicit = key.embeddingModel?.trim();
  if (explicit) return explicit;
  return PROVIDER_EMBEDDING_MODELS[providerForKind(key.providerKind, key.provider)];
}

export const MODEL_CATALOG: CatalogModel[] = [
  // --- OpenAI (live catalog 2026-10-16) ---
  { id: "openai/gpt-4o-mini", provider: "openai", modelId: "gpt-4o-mini", label: "OpenAI GPT-4o mini", group: "fast", inputPricePerMillion: 0.15, outputPricePerMillion: 0.6, baseUrl: PROVIDER_BASE_URLS.openai },
  { id: "openai/gpt-5.6-luna", provider: "openai", modelId: "gpt-5.6-luna", label: "OpenAI GPT-5.6 Luna", group: "fast", inputPricePerMillion: 0.2, outputPricePerMillion: 1.2, baseUrl: PROVIDER_BASE_URLS.openai, note: "Live default" },
  { id: "openai/gpt-5-mini", provider: "openai", modelId: "gpt-5-mini", label: "OpenAI GPT-5 mini", group: "balanced", inputPricePerMillion: 0.25, outputPricePerMillion: 2, baseUrl: PROVIDER_BASE_URLS.openai, note: "Retires 2026-12-11" },
  { id: "openai/gpt-4.1-mini", provider: "openai", modelId: "gpt-4.1-mini", label: "OpenAI GPT-4.1 mini", group: "balanced", inputPricePerMillion: 0.4, outputPricePerMillion: 1.6, baseUrl: PROVIDER_BASE_URLS.openai },
  { id: "openai/gpt-5.4-mini", provider: "openai", modelId: "gpt-5.4-mini", label: "OpenAI GPT-5.4 Mini", group: "fast", inputPricePerMillion: 0.75, outputPricePerMillion: 4.5, baseUrl: PROVIDER_BASE_URLS.openai },
  { id: "openai/gpt-5.6-terra", provider: "openai", modelId: "gpt-5.6-terra", label: "OpenAI GPT-5.6 Terra", group: "balanced", inputPricePerMillion: 2, outputPricePerMillion: 12, baseUrl: PROVIDER_BASE_URLS.openai },
  { id: "openai/gpt-4o", provider: "openai", modelId: "gpt-4o", label: "OpenAI GPT-4o", group: "flagship", inputPricePerMillion: 2.5, outputPricePerMillion: 10, baseUrl: PROVIDER_BASE_URLS.openai },
  { id: "openai/gpt-5.6-sol", provider: "openai", modelId: "gpt-5.6-sol", label: "OpenAI GPT-5.6 Sol", group: "flagship", inputPricePerMillion: 4, outputPricePerMillion: 20, baseUrl: PROVIDER_BASE_URLS.openai },
  { id: "openai/gpt-6-astra", provider: "openai", modelId: "gpt-6-astra", label: "OpenAI GPT-6 Astra", group: "flagship", inputPricePerMillion: 10, outputPricePerMillion: 50, baseUrl: PROVIDER_BASE_URLS.openai },
  // --- OpenRouter (live catalog) ---
  { id: "openrouter/llama-3.3-70b:free", provider: "openrouter", modelId: "meta-llama/llama-3.3-70b-instruct:free", label: "Llama 3.3 70B Free", group: "fast", inputPricePerMillion: 0, outputPricePerMillion: 0, baseUrl: PROVIDER_BASE_URLS.openrouter },
  { id: "openrouter/deepseek-chat-v3:free", provider: "openrouter", modelId: "deepseek/deepseek-chat-v3:free", label: "DeepSeek Chat V3 Free", group: "fast", inputPricePerMillion: 0, outputPricePerMillion: 0, baseUrl: PROVIDER_BASE_URLS.openrouter },
  { id: "openrouter/llama-3.3-70b", provider: "openrouter", modelId: "meta-llama/llama-3.3-70b-instruct", label: "Llama 3.3 70B", group: "balanced", inputPricePerMillion: 0.12, outputPricePerMillion: 0.3, baseUrl: PROVIDER_BASE_URLS.openrouter },
  { id: "openrouter/gemini-2.5-pro", provider: "openrouter", modelId: "google/gemini-2.5-pro", label: "Gemini 2.5 Pro", group: "balanced", inputPricePerMillion: 1.25, outputPricePerMillion: 10, baseUrl: PROVIDER_BASE_URLS.openrouter },
  { id: "openrouter/gpt-4o", provider: "openrouter", modelId: "openai/gpt-4o", label: "GPT-4o", group: "flagship", inputPricePerMillion: 2.5, outputPricePerMillion: 10, baseUrl: PROVIDER_BASE_URLS.openrouter },
  { id: "openrouter/claude-sonnet-4", provider: "openrouter", modelId: "anthropic/claude-sonnet-4", label: "Claude Sonnet 4", group: "flagship", inputPricePerMillion: 3, outputPricePerMillion: 15, baseUrl: PROVIDER_BASE_URLS.openrouter },
  // --- Custom endpoints (any OpenAI-compatible gateway) ---
  { id: "custom/glm-5.3-flash", provider: "custom", modelId: "glm-5.3-flash", label: "GLM-5.3 Flash (custom)", group: "custom", inputPricePerMillion: 0.3, outputPricePerMillion: 0.3, baseUrl: "" },
  { id: "custom/deepseek-v4.1-flash", provider: "custom", modelId: "deepseek-v4.1-flash", label: "DeepSeek V4.1 Flash (custom)", group: "custom", inputPricePerMillion: 0.3, outputPricePerMillion: 0.3, baseUrl: "" },
  { id: "custom/grok-4", provider: "custom", modelId: "grok-4", label: "Grok 4 (custom)", group: "custom", inputPricePerMillion: 1, outputPricePerMillion: 1, baseUrl: "" },
  { id: "custom/any", provider: "custom", modelId: "", label: "Custom model id…", group: "custom", inputPricePerMillion: 1, outputPricePerMillion: 1, baseUrl: "" },
];

export function catalogModel(id: string | undefined): CatalogModel | undefined {
  if (!id) return undefined;
  return MODEL_CATALOG.find((model) => model.id === id);
}

export function modelsForProvider(provider: ModelProvider): CatalogModel[] {
  return MODEL_CATALOG.filter((model) => model.provider === provider);
}

/** Blended $/1M used for the local allowance meter. Conservative: average of in/out. */
export function blendedPricePerMillion(model: Pick<CatalogModel, "inputPricePerMillion" | "outputPricePerMillion">): number {
  const blended = (model.inputPricePerMillion + model.outputPricePerMillion) / 2;
  return Math.max(0, Math.round(blended * 1000) / 1000);
}

export function pricePerMillionForModelId(modelId: string, fallback = 6): number {
  const needle = modelId.trim().toLowerCase();
  const hit = MODEL_CATALOG.find((model) => model.modelId && model.modelId.toLowerCase() === needle);
  if (hit) return blendedPricePerMillion(hit);
  if (needle.includes("flash") || needle.includes("mini") || needle.includes("haiku")) return 0.3;
  if (needle.includes("deepseek")) return 0.3;
  if (needle.includes("llama") || needle.includes("gemini")) return 0.5;
  return fallback;
}

/** A human label for a key row, e.g. "OpenAI · GPT-5.6 Luna (custom)". */
export function keyLabel(key: AiKey): string {
  return `${key.provider} · ${key.model}`;
}
