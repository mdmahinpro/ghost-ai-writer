import { readRaw, writeRaw } from "./durable-storage";
import { adoptKey, clearSessionKey, createVaultMeta, markVaultOn, passphraseMatches, type VaultMeta } from "./vault-crypto";

const VAULT_KEY = "gaw-vault";

export type VaultPhase = "checking" | "locked" | "open";

let phase: VaultPhase = "checking";
const listeners = new Set<(phase: VaultPhase) => void>();

function publish(next: VaultPhase) {
  phase = next;
  for (const listener of listeners) listener(phase);
}

export function vaultPhase(): VaultPhase {
  return phase;
}

export function onVaultPhase(listener: (phase: VaultPhase) => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export async function readVaultMeta(): Promise<VaultMeta | null> {
  const raw = await readRaw(VAULT_KEY);
  if (!raw) return null;
  try {
    const meta = JSON.parse(raw) as VaultMeta;
    if (meta?.v !== 1 || !meta.salt || !meta.iv || !meta.verifier) return null;
    return meta;
  } catch {
    return null;
  }
}

export async function loadVaultGate(): Promise<void> {
  if (phase === "open" || phase === "locked") return;
  const meta = await readVaultMeta();
  if (meta) markVaultOn();
  publish(meta ? "locked" : "open");
}

export async function lockWithPassphrase(passphrase: string): Promise<void> {
  const { meta, key } = await createVaultMeta(passphrase);
  const encoded = JSON.stringify(meta);
  if (encoded.includes(passphrase)) throw new Error("Refusing to store the passphrase.");
  await writeRaw(VAULT_KEY, encoded);
  adoptKey(key);
  if (phase === "checking") publish("open");
}

export async function unlockVault(passphrase: string): Promise<string | null> {
  const meta = await readVaultMeta();
  if (!meta) return "No lock is set on this browser.";
  const key = await passphraseMatches(passphrase, meta);
  if (!key) return "That passphrase does not open this studio.";
  adoptKey(key);
  publish("open");
  return null;
}

export function lockStudio(): void {
  clearSessionKey();
  publish("locked");
}
