import { hasSessionKey, openState, sealState, writesMustEncrypt } from "./vault-crypto";

const DB = "gaw-db";
const STORE = "kv";

let allowWrite = false;

export function allowPersistWrites() {
  allowWrite = true;
}

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB, 1);
    request.onupgradeneeded = () => {
      if (!request.result.objectStoreNames.contains(STORE)) request.result.createObjectStore(STORE);
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

async function idbGet(name: string): Promise<string | null> {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const request = db.transaction(STORE, "readonly").objectStore(STORE).get(name);
    request.onsuccess = () => resolve(typeof request.result === "string" ? request.result : null);
    request.onerror = () => reject(request.error);
  });
}

async function idbSet(name: string, value: string): Promise<void> {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, "readwrite");
    tx.objectStore(STORE).put(value, name);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

export async function readRaw(name: string): Promise<string | null> {
  try {
    const saved = await idbGet(name);
    if (saved) return saved;
  } catch {
    /* IndexedDB unavailable */
  }
  try {
    return localStorage.getItem(name);
  } catch {
    return null;
  }
}

export async function writeRaw(name: string, value: string): Promise<void> {
  try {
    await idbSet(name, value);
  } catch {
    /* keep the localStorage copy below */
  }
  try {
    localStorage.setItem(name, value);
  } catch {
    /* quota */
  }
}

/**
 * Coalescing persistence queue: every store set() used to serialize the ENTIRE
 * state graph to IndexedDB AND localStorage and re-encrypt it, which blocked
 * interactions for seconds while a run was active.
 *
 * Hotfix: bursts now collapse into one serial writer — the LATEST value per
 * name replaces anything still queued, so a rapid run tick costs one write.
 * Crucially the write starts IMMEDIATELY (no trailing delay): a full page
 * unload can only ever race the single in-flight transaction, never an
 * 800 ms window, so saved keys and runs survive reloads.
 */
const queue: { name: string; payload: string }[] = [];
let draining = false;

async function drainQueue(): Promise<void> {
  if (draining) return;
  draining = true;
  try {
    while (queue.length) {
      const item = queue.shift()!;
      try {
        const sealed = await sealState(item.payload);
        await writeRaw(item.name, sealed);
      } catch {
        /* best effort — next write supersedes it anyway */
      }
    }
  } finally {
    draining = false;
    if (queue.length) void drainQueue();
  }
}

export const durableStorage = {
  getItem: async (name: string): Promise<string | null> => {
    const saved = await readRaw(name);
    if (!saved) return null;
    return openState(saved);
  },
  setItem: async (name: string, value: string): Promise<void> => {
    if (!allowWrite) return;
    if (writesMustEncrypt() && !hasSessionKey()) return;
    const existing = queue.find((item) => item.name === name);
    if (existing) existing.payload = value;
    else queue.push({ name, payload: value });
    void drainQueue();
  },
  removeItem: async (name: string): Promise<void> => {
    const index = queue.findIndex((item) => item.name === name);
    if (index >= 0) queue.splice(index, 1);
    if (!allowWrite) return;
    try {
      const db = await openDb();
      await new Promise<void>((resolve, reject) => {
        const tx = db.transaction(STORE, "readwrite");
        tx.objectStore(STORE).delete(name);
        tx.oncomplete = () => resolve();
        tx.onerror = () => reject(tx.error);
      });
    } catch {
      /* ignore */
    }
    try {
      localStorage.removeItem(name);
    } catch {
      /* ignore */
    }
  },
};
