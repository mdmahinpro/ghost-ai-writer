/**
 * Server data-plane API for the durable app store.
 *
 * `loadAppState`  — GET the whole snapshot (secrets decrypted in transit; they
 *                   are stored AES-256-GCM encrypted at rest in `.data/`).
 * `saveAppState`  — POST a snapshot; the server merges by row id with
 *                   pipeline-progress protection for jobs and tombstones for
 *                   deletions, so no browser context can rewind or resurrect
 *                   another context's work.
 * `resetAppState` — POST to wipe the server store (studio reset), bumping the
 *                   generation so stale windows cannot resurrect old rows.
 */
import { createServerFn } from "@tanstack/react-start";
import { loadServerState, mergeIntoDoc, resetServerState, type ServerPurges } from "./server-store.server";

type JsonValue = string | number | boolean | null | JsonValue[] | { [key: string]: JsonValue };

export type AppStateEnvelope = {
  savedAt: number;
  generation: string;
  state: { [key: string]: JsonValue } | null;
};

export const loadAppState = createServerFn({ method: "GET" }).handler((): AppStateEnvelope => {
  const result = loadServerState();
  return {
    savedAt: result.savedAt,
    generation: result.generation,
    state: (result.state ?? null) as { [key: string]: JsonValue } | null,
  };
});

type SaveInput = {
  state: Record<string, unknown>;
  purges?: ServerPurges;
};

export const saveAppState = createServerFn({ method: "POST" })
  .validator((input: unknown): SaveInput => {
    const raw = (input ?? {}) as Partial<SaveInput>;
    if (!raw.state || typeof raw.state !== "object" || Array.isArray(raw.state)) {
      throw new Error("saveAppState requires a state object.");
    }
    return {
      state: raw.state as Record<string, unknown>,
      purges: raw.purges ?? undefined,
    };
  })
  .handler(async ({ data }): Promise<{ success: boolean; savedAt: number; generation: string }> => {
    return mergeIntoDoc(data.state, data.purges);
  });

export const resetAppState = createServerFn({ method: "POST" }).handler((): { success: boolean; savedAt: number; generation: string } => {
  return resetServerState();
});
