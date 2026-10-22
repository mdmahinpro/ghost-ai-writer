export const VAULT_ITERATIONS = 600_000;
const MARK = "gaw-vault-ok";

let sessionKey: CryptoKey | null = null;
let vaultOn = false;

export function hasSessionKey(): boolean {
  return sessionKey !== null;
}

export function clearSessionKey(): void {
  sessionKey = null;
}

export function writesMustEncrypt(): boolean {
  return vaultOn;
}

export function markVaultOn(): void {
  vaultOn = true;
}

function copy(bytes: Uint8Array): Uint8Array<ArrayBuffer> {
  return new Uint8Array(bytes);
}

export function bytesToB64(bytes: Uint8Array): string {
  let binary = "";
  for (let i = 0; i < bytes.length; i += 0x8000) {
    binary += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  }
  return btoa(binary);
}

export function b64ToBytes(value: string): Uint8Array {
  const binary = atob(value);
  const out = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) out[i] = binary.charCodeAt(i);
  return out;
}

export type VaultMeta = {
  v: 1;
  iterations: number;
  salt: string;
  iv: string;
  verifier: string;
};

export async function deriveKey(passphrase: string, salt: Uint8Array, iterations = VAULT_ITERATIONS): Promise<CryptoKey> {
  const base = await crypto.subtle.importKey("raw", new TextEncoder().encode(passphrase), "PBKDF2", false, ["deriveKey"]);
  return crypto.subtle.deriveKey(
    { name: "PBKDF2", salt: copy(salt), iterations, hash: "SHA-256" },
    base,
    { name: "AES-GCM", length: 256 },
    false,
    ["encrypt", "decrypt"],
  );
}

async function encryptBytes(key: CryptoKey, bytes: Uint8Array): Promise<{ iv: Uint8Array; cipher: Uint8Array }> {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const cipher = new Uint8Array(await crypto.subtle.encrypt({ name: "AES-GCM", iv: copy(iv) }, key, copy(bytes)));
  return { iv, cipher };
}

async function decryptBytes(key: CryptoKey, iv: Uint8Array, cipher: Uint8Array): Promise<Uint8Array | null> {
  try {
    const plain = await crypto.subtle.decrypt({ name: "AES-GCM", iv: copy(iv) }, key, copy(cipher));
    return new Uint8Array(plain);
  } catch {
    return null;
  }
}

export async function createVaultMeta(passphrase: string): Promise<{ meta: VaultMeta; key: CryptoKey }> {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const key = await deriveKey(passphrase, salt, VAULT_ITERATIONS);
  const sealed = await encryptBytes(key, new TextEncoder().encode(MARK));
  return {
    key,
    meta: {
      v: 1,
      iterations: VAULT_ITERATIONS,
      salt: bytesToB64(salt),
      iv: bytesToB64(sealed.iv),
      verifier: bytesToB64(sealed.cipher),
    },
  };
}

export async function passphraseMatches(passphrase: string, meta: VaultMeta): Promise<CryptoKey | null> {
  const key = await deriveKey(passphrase, b64ToBytes(meta.salt), meta.iterations || VAULT_ITERATIONS);
  const plain = await decryptBytes(key, b64ToBytes(meta.iv), b64ToBytes(meta.verifier));
  if (!plain) return null;
  if (new TextDecoder().decode(plain) !== MARK) return null;
  return key;
}

export function adoptKey(key: CryptoKey): void {
  sessionKey = key;
  vaultOn = true;
}

export async function sealState(plain: string): Promise<string> {
  if (!sessionKey) return plain;
  const sealed = await encryptBytes(sessionKey, new TextEncoder().encode(plain));
  return `gaw1.${bytesToB64(sealed.iv)}.${bytesToB64(sealed.cipher)}`;
}

export async function openState(saved: string): Promise<string | null> {
  if (!saved.startsWith("gaw1.")) return saved;
  if (!sessionKey) return null;
  const parts = saved.split(".");
  if (parts.length !== 3) return null;
  const plain = await decryptBytes(sessionKey, b64ToBytes(parts[1]!), b64ToBytes(parts[2]!));
  return plain ? new TextDecoder().decode(plain) : null;
}
