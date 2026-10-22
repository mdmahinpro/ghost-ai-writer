import { embeddingModelFor } from "./model-catalog.ts";
import type { AiKey } from "./types";

export type EmbedMeter = {
  provider?: (text: string) => Promise<number[]>;
  spent: () => number;
  /** The embedding model this meter calls, or undefined when the key supports no provider embeddings. */
  model?: string;
};

/**
 * GOVERNOR §3 capability match (chat vs semantic): the L3 duplicate gate reuses
 * the chat key's credentials but must call an embeddings-capable model id — never
 * the chat model (a chat model answers `/embeddings` with "no embeddings
 * support"). When the provider family has no resolvable embedding model we return
 * no provider, so `embedForL3` takes the honest local-hash fallback instead of
 * firing a doomed request. Embedding tokens ride `spent()` and settle separately
 * (WORKFLOW-MAP §10).
 */
export function embeddingProvider(key: Pick<AiKey, "baseUrl" | "secret" | "model"> & Partial<Pick<AiKey, "provider" | "providerKind" | "embeddingModel">> | undefined): EmbedMeter {
  let tokens = 0;
  const cache = new Map<string, number[]>();
  if (!key?.secret || !key.baseUrl) return { spent: () => 0 };
  const model = embeddingModelFor({ provider: key.provider ?? "", providerKind: key.providerKind, embeddingModel: key.embeddingModel });
  if (!model) return { spent: () => 0 };
  const baseUrl = key.baseUrl;
  const secret = key.secret;
  return {
    spent: () => tokens,
    model,
    provider: async (text: string) => {
      const hit = cache.get(text);
      if (hit) return hit;
      const { getEmbedding } = await import("./providers.functions.ts");
      const result = await getEmbedding({
        data: { baseUrl, apiKey: secret, model, input: text },
      });
      if (!result.ok) throw new Error(result.error);
      tokens += result.tokens;
      cache.set(text, result.vector);
      return result.vector;
    },
  };
}
