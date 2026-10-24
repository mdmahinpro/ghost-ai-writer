/**
 * Provider calls that run on the server.
 *
 * Keys live in `ai_keys`, encrypted, with the pool and health rules. Nothing
 * here needs — or accepts — a raw key: the browser asks for text and the server
 * decides which key serves it. That is what lets the store stop holding
 * secrets at all.
 */
import { post } from "./api-client.ts";
import type { ApiResponse } from "./api-client.ts";

/** The numeric `ai_keys.id` a browser key was saved as. */
export type SavedProvider = { id: number };

export type ServerGeneration = {
  text: string;
  tokensIn: number;
  tokensOut: number;
  costUsd: number;
  /** Which key served it, so spend can be attributed to the right row. */
  keyId: number | null;
  model: string;
  provider: string;
};

type RawProvider = { id: number; provider: unknown };

/**
 * Save a provider key on the server and return its id.
 *
 * The secret is sent once, sealed in transit by TLS and sealed again at rest in
 * `ai_keys.key_enc`; it is never returned, and the caller keeps only the id and
 * the hint.
 */
export async function addProvider(input: {
  workspaceId: number;
  provider: string;
  label: string;
  apiKey: string;
  modelId: string;
  baseUrl?: string;
  kind?: string;
  priority?: number;
  role?: string;
}): Promise<ApiResponse<SavedProvider>> {
  const res = await post<RawProvider>("/api/v1/providers", {
    workspace_id: input.workspaceId,
    provider: input.provider,
    label: input.label,
    api_key: input.apiKey,
    model_id: input.modelId,
    base_url: input.baseUrl,
    kind: input.kind,
    priority: input.priority,
    role: input.role,
  });
  if (!res.ok) return res;
  return { ok: true, data: { id: res.data.id } };
}

/**
 * Ask the server for one completion.
 *
 * `preferredKeyId` pins the key the user picked for this site; omit it and the
 * server walks its own failover chain. The server owns retries and demotions,
 * so a failed call here means every eligible key was tried.
 */
export async function generate(input: {
  workspaceId: number;
  system: string;
  user: string;
  preferredKeyId?: number;
  role?: "text" | "vision";
  json?: boolean;
  images?: string[];
  schema?: string;
}): Promise<ApiResponse<ServerGeneration>> {
  const res = await post<{
    text: string;
    tokens_in: number;
    tokens_out: number;
    cost_usd: number;
    key_id: number | null;
    model: string;
    provider: string;
  }>("/api/v1/generate", {
    workspace_id: input.workspaceId,
    system: input.system,
    user: input.user,
    preferred_key_id: input.preferredKeyId,
    role: input.role,
    json: input.json,
    images: input.images,
    schema: input.schema,
  });
  if (!res.ok) return res;
  return {
    ok: true,
    data: {
      text: res.data.text,
      tokensIn: res.data.tokens_in,
      tokensOut: res.data.tokens_out,
      costUsd: res.data.cost_usd,
      keyId: res.data.key_id,
      model: res.data.model,
      provider: res.data.provider,
    },
  };
}
