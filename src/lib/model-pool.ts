import type { AiKey } from "./types";

export type PoolAttempt = { keyId: string; label: string; status: number; error: string };

export type PoolCallResult<T> = { ok: true; value: T } | { ok: false; status?: number; error: string };

export type PoolOutcome<T> =
  | { ok: true; value: T; keyId: string; attempted: PoolAttempt[] }
  | { ok: false; error: string; attempted: PoolAttempt[] };

/**
 * Rule 4 — sequential multi-key auto-failover.
 *
 * Tries each key in pool order (primary first, then by priority). On failure it
 * records the attempt, applies the penalty (the caller disables on 401/403 and
 * cools on 429/5xx/timeout via `onPenalty`), and moves on. The first success wins,
 * so a busy / rate-limited / exhausted primary key does not fail the job —
 * generation completes and can still auto-publish to Ghost.
 */
export async function runWithKeyPool<T>(opts: {
  keys: AiKey[];
  call: (key: AiKey) => Promise<PoolCallResult<T>>;
  onPenalty?: (keyId: string, status: number, error?: string) => void;
  onAttempt?: (key: AiKey, index: number) => void;
}): Promise<PoolOutcome<T>> {
  const attempted: PoolAttempt[] = [];
  // Unlimited by default: a paused or previously-rejected key is still tried as
  // a last-resort failover instead of being dropped, so a non-empty pool never
  // refuses locally. Only a genuinely empty pool returns NO_USABLE_KEY.
  const usable = opts.keys.filter((key) => key.chat !== false);
  if (!usable.length) return { ok: false, error: "NO_USABLE_KEY — no key in the pool can call a model. Add a key on AI Keys.", attempted };
  for (let index = 0; index < usable.length; index++) {
    const key = usable[index]!;
    opts.onAttempt?.(key, index);
    // `call` sends `preferredKeyId: key.serverKeyId` to the Rust service, so a key
    // saved there needs no local secret. Only a key with neither a server id nor
    // a local secret can reach no provider at all.
    if (key.serverKeyId === undefined && !(key.secret && key.baseUrl)) {
      attempted.push({ keyId: key.id, label: `${key.provider} · ${key.model}`, status: 0, error: "Not saved on the server and no local secret — add the key again." });
      opts.onPenalty?.(key.id, 0, "Not saved on the server and no local secret — add the key again.");
      continue;
    }
    const result = await opts.call(key);
    if (result.ok) return { ok: true, value: result.value, keyId: key.id, attempted };
    const status = result.status ?? 0;
    attempted.push({ keyId: key.id, label: `${key.provider} · ${key.model}`, status, error: result.error });
    if (status || result.error) opts.onPenalty?.(key.id, status, result.error);
  }
  const last = attempted[attempted.length - 1];
  return {
    ok: false,
    error: last ? `Every key in the pool failed (${attempted.length} tried). Last: ${last.label} — ${last.error}` : "NO_USABLE_KEY",
    attempted,
  };
}

/** Short one-line summary of the failover chain for activity logs. */
export function poolSummary(attempted: PoolAttempt[]): string {
  if (!attempted.length) return "";
  return attempted.map((row) => `${row.label}${row.status ? ` (HTTP ${row.status})` : ""}`).join(" → ");
}
