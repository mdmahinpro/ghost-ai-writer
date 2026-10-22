import { t as createServerFn } from "./ssr.mjs";
import { t as createServerRpc } from "./createServerRpc-A6pJPYTF.mjs";
import { createCipheriv, createDecipheriv, createHash, randomBytes } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from "node:fs";
import { join } from "node:path";
//#region node_modules/.nitro/vite/services/ssr/assets/server-store.functions-CcdRQ4FF.js
/**
* Production server-side app-state store (the single source of truth).
*
* Durability: the full Persisted snapshot is merged into `<cwd>/.data/appstate.json`
* with atomic rename writes. Every browser context (fresh incognito window,
* another machine, a cleared IndexedDB) hydrates from this file, so workspaces,
* AI keys, runs, and jobs are identical everywhere.
*
* Secrets at rest: any JSON string field named `secret`, `adminKey`, `password`,
* or `token` is AES-256-GCM encrypted before the file is written and decrypted
* just-in-time when a browser context loads state. The encryption key comes from
* `GHOST_GROK_ENC_KEY` (any stable string) or is generated once into `.data/enc.key`.
*
* Merge rules (mirrors the client `mergePersisted`):
* - rows match by id; incoming rows (the client that just acted) win, EXCEPT jobs,
*   where the fresher pipeline progress always wins so a stale window can never
*   rewind a job from running back to queued or wipe finished work;
* - server-only rows survive (a second window's adds are never lost);
* - explicit user deletions arrive as purges (tombstones) and remove rows on the
*   server permanently (deleting a site cascades across every collection);
* - a studio reset bumps the store generation so a stale window cannot resurrect
*   pre-reset rows.
*/
var DATA_DIR = process.env.APP_DATA_DIR ? resolveEnvPath(process.env.APP_DATA_DIR) : join(process.cwd(), ".data");
var STATE_FILE = join(DATA_DIR, "appstate.json");
var ENC_KEY_FILE = join(DATA_DIR, "enc.key");
function resolveEnvPath(raw) {
	return raw.replace(/^~/, process.env.HOME ?? process.cwd());
}
var SECRET_FIELDS = /* @__PURE__ */ new Set([
	"secret",
	"adminKey",
	"password",
	"token"
]);
var cachedKey = null;
function encryptionKey() {
	if (cachedKey) return cachedKey;
	if (process.env.GHOST_GROK_ENC_KEY) {
		cachedKey = createHash("sha256").update(String(process.env.GHOST_GROK_ENC_KEY)).digest();
		return cachedKey;
	}
	try {
		if (existsSync(ENC_KEY_FILE)) {
			const hex = readFileSync(ENC_KEY_FILE, "utf8").trim();
			if (hex.length >= 64) {
				cachedKey = Buffer.from(hex.slice(0, 64), "hex");
				return cachedKey;
			}
		}
		mkdirSync(DATA_DIR, { recursive: true });
		const hex = randomBytes(32).toString("hex");
		try {
			writeFileSync(ENC_KEY_FILE, hex + "\n", {
				encoding: "utf8",
				mode: 384
			});
		} catch {}
		cachedKey = Buffer.from(hex, "hex");
	} catch {
		cachedKey = createHash("sha256").update("ghost-grok-local-fallback").digest();
	}
	return cachedKey;
}
function sealSecret(value) {
	const iv = randomBytes(12);
	const cipher = createCipheriv("aes-256-gcm", encryptionKey(), iv);
	const enc = Buffer.concat([cipher.update(value, "utf8"), cipher.final()]);
	return `enc:v1:${iv.toString("base64url")}:${cipher.getAuthTag().toString("base64url")}:${enc.toString("base64url")}`;
}
function openSecret(value) {
	if (!value.startsWith("enc:v1:")) return null;
	const [iv64, tag64, data64] = value.slice(7).split(":");
	if (!iv64 || !tag64 || !data64) return null;
	try {
		const decipher = createDecipheriv("aes-256-gcm", encryptionKey(), Buffer.from(iv64, "base64url"));
		decipher.setAuthTag(Buffer.from(tag64, "base64url"));
		return Buffer.concat([decipher.update(Buffer.from(data64, "base64url")), decipher.final()]).toString("utf8");
	} catch {
		return null;
	}
}
function encryptTree(node) {
	if (Array.isArray(node)) {
		for (const row of node) encryptTree(row);
		return;
	}
	if (!node || typeof node !== "object") return;
	for (const [key, value] of Object.entries(node)) if (typeof value === "string" && SECRET_FIELDS.has(key) && value && !value.startsWith("enc:v1:")) node[key] = sealSecret(value);
	else encryptTree(value);
}
function decryptTree(node) {
	if (Array.isArray(node)) {
		for (const row of node) decryptTree(row);
		return;
	}
	if (!node || typeof node !== "object") return;
	for (const [key, value] of Object.entries(node)) if (typeof value === "string" && SECRET_FIELDS.has(key)) {
		const opened = openSecret(value);
		if (opened != null) node[key] = opened;
	} else decryptTree(value);
}
var TOMBSTONE_TTL_MS = 6048e5;
var CASCADE_COLLECTIONS = [
	"runs",
	"jobs",
	"articles",
	"plans",
	"calendars",
	"research",
	"authors",
	"builds",
	"deploys",
	"audits",
	"events",
	"activity",
	"backups",
	"corpus"
];
var doc = null;
var writeChain = Promise.resolve();
var writeTimer = null;
function emptyDoc() {
	return {
		version: 1,
		savedAt: 0,
		generation: randomBytes(8).toString("hex"),
		tombstones: [],
		state: null
	};
}
function readDoc() {
	if (doc) return doc;
	try {
		const raw = JSON.parse(readFileSync(STATE_FILE, "utf8"));
		if (raw.version !== 1 || typeof raw.state !== "object" || raw.state === null) throw new Error("bad doc");
		doc = {
			version: 1,
			savedAt: raw.savedAt ?? 0,
			generation: raw.generation ?? randomBytes(8).toString("hex"),
			tombstones: Array.isArray(raw.tombstones) ? raw.tombstones : [],
			state: raw.state
		};
	} catch {
		doc = emptyDoc();
	}
	return doc;
}
function flushToDisk() {
	const current = doc;
	if (!current) return;
	try {
		mkdirSync(DATA_DIR, { recursive: true });
		const temp = `${STATE_FILE}.${process.pid}.tmp`;
		writeFileSync(temp, JSON.stringify(current), "utf8");
		renameSync(temp, STATE_FILE);
	} catch {}
}
/** Debounced atomic write; serialized through one chain so renames never race. */
function scheduleWrite() {
	if (writeTimer) return;
	writeTimer = setTimeout(() => {
		writeTimer = null;
		writeChain = writeChain.then(() => flushToDisk()).catch(() => {});
	}, 120);
	if (typeof writeTimer.unref === "function") writeTimer.unref();
}
/** Coerce an immediate flush (used on first writes so a fast reload still sees data). */
function flushNow() {
	if (writeTimer) {
		clearTimeout(writeTimer);
		writeTimer = null;
	}
	writeChain = writeChain.then(() => flushToDisk()).catch(() => {});
}
function jobProgressRank(job) {
	if (!job || typeof job !== "object") return 0;
	const status = String(job.status ?? "");
	const stageIndex = Number(job.stageIndex ?? -1) || 0;
	const shots = Number(job.shots ?? 0) || 0;
	const finishedAt = Number(job.createdAt ?? 0) || 0;
	return (status === "completed" || status === "failed" || status === "refused" || status === "cancelled" || status === "publish-held" || status === "review-held" ? 1e5 : status === "running" ? 1e4 : status === "queued" ? 1e3 : 0) + (stageIndex + 1) * 100 + shots * 10 + finishedAt / 0x9184e72a000;
}
function purgeRows(state, tombstones) {
	if (!tombstones.length) return;
	const siteIds = new Set(tombstones.filter((row) => row.kind === "site").map((row) => row.id));
	const keyIds = new Set(tombstones.filter((row) => row.kind === "key").map((row) => row.id));
	const dropIds = new Set(tombstones.map((row) => row.id));
	if (siteIds.size) for (const collection of CASCADE_COLLECTIONS) {
		const rows = state[collection];
		if (Array.isArray(rows)) state[collection] = rows.filter((row) => !row || typeof row !== "object" || !siteIds.has(String(row.siteId ?? "")));
	}
	if (Array.isArray(state.sites)) state.sites = state.sites.filter((row) => !row || typeof row !== "object" || !dropIds.has(String(row.id ?? "")));
	if (Array.isArray(state.articles)) state.articles = state.articles.filter((row) => !row || typeof row !== "object" || !dropIds.has(String(row.id ?? "")));
	if (Array.isArray(state.keys)) state.keys = state.keys.filter((row) => {
		if (!row || typeof row !== "object") return true;
		return !dropIds.has(String(row.id ?? "")) && !keyIds.has(String(row.id ?? ""));
	});
	if (typeof state.activeSiteId === "string" && siteIds.has(state.activeSiteId)) state.activeSiteId = "";
}
/** Content identity ignoring the sync-only `_mst` marker (legacy stamped rows). */
function rowSignature(row) {
	if (!row || typeof row !== "object" || Array.isArray(row)) return JSON.stringify(row ?? null);
	const { _mst: _ignored, ...rest } = row;
	return JSON.stringify(rest);
}
/**
* Merge the incoming client snapshot into the server document.
* Per collection: upsert by id (incoming wins for non-job rows; jobs keep the
* fresher pipeline progress). Rows whose content is unchanged keep the stored
* value untouched, so an echo save from a pulling window is a true no-op.
* Rows only the server knows survive unless they were explicitly purged;
* deleting a site cascades across every collection.
*/
function mergeIntoDoc(incoming, purges, reset) {
	const current = readDoc();
	const now = Date.now();
	if (reset) {
		current.state = null;
		current.tombstones = [];
		current.generation = randomBytes(8).toString("hex");
		current.savedAt = now;
		flushNow();
		return {
			success: true,
			savedAt: now,
			generation: current.generation
		};
	}
	if (!incoming || typeof incoming !== "object") return {
		success: false,
		savedAt: current.savedAt,
		generation: current.generation
	};
	const incomingState = incoming;
	const newTombs = [];
	for (const id of purges?.sites ?? []) newTombs.push({
		id,
		kind: "site",
		at: now
	});
	for (const id of purges?.keys ?? []) newTombs.push({
		id,
		kind: "key",
		at: now
	});
	for (const id of purges?.articles ?? []) newTombs.push({
		id,
		kind: "article",
		at: now
	});
	if (newTombs.length) {
		const known = new Set(current.tombstones.map((row) => `${row.kind}:${row.id}`));
		current.tombstones.push(...newTombs.filter((row) => !known.has(`${row.kind}:${row.id}`)));
	}
	current.tombstones.length;
	current.tombstones = current.tombstones.filter((row) => now - row.at < TOMBSTONE_TTL_MS);
	const incomingGeneration = typeof incomingState.__generation === "string" ? incomingState.__generation : void 0;
	const next = Boolean(incomingGeneration && incomingGeneration !== current.generation) ? {} : current.state && typeof current.state === "object" ? current.state : {};
	const tombIds = new Set(current.tombstones.map((row) => row.id));
	const cascadingSites = new Set(current.tombstones.filter((row) => row.kind === "site").map((row) => row.id));
	for (const key of Object.keys(incomingState)) {
		if (key === "__generation") continue;
		const incomingRows = incomingState[key];
		if (!Array.isArray(incomingRows)) {
			if (rowSignature(next[key]) === rowSignature(incomingRows)) continue;
			next[key] = incomingRows;
			continue;
		}
		const existing = Array.isArray(next[key]) ? next[key] : [];
		const byId = /* @__PURE__ */ new Map();
		for (const row of existing) {
			if (!row || typeof row !== "object") continue;
			const id = String(row.id ?? "");
			if (!id || tombIds.has(id)) continue;
			byId.set(id, row);
		}
		for (const row of incomingRows) {
			if (!row || typeof row !== "object") continue;
			const id = String(row.id ?? "");
			if (!id || tombIds.has(id)) continue;
			if (cascadingSites.has(String(row.siteId ?? ""))) continue;
			const previous = byId.get(id);
			if (previous) {
				if (rowSignature(previous) === rowSignature(row)) continue;
				if (key === "jobs") {
					byId.set(id, jobProgressRank(row) >= jobProgressRank(previous) ? row : previous);
					continue;
				}
			}
			byId.set(id, row);
		}
		next[key] = [...byId.values()];
	}
	if (cascadingSites.size) for (const collection of CASCADE_COLLECTIONS) {
		const rows = next[collection];
		if (Array.isArray(rows)) next[collection] = rows.filter((row) => !row || typeof row !== "object" || !cascadingSites.has(String(row.siteId ?? "")));
	}
	purgeRows(next, current.tombstones);
	delete next.__generation;
	encryptTree(next);
	current.state = next;
	current.savedAt = now;
	scheduleWrite();
	return {
		success: true,
		savedAt: now,
		generation: current.generation
	};
}
/** Sync-internal markers must never reach clients: they break row identity/equality. */
function stripSyncMarkers(node) {
	if (Array.isArray(node)) {
		for (const row of node) stripSyncMarkers(row);
		return;
	}
	if (!node || typeof node !== "object") return;
	delete node._mst;
	for (const value of Object.values(node)) stripSyncMarkers(value);
}
function loadServerState() {
	const current = readDoc();
	if (!current.state) return {
		savedAt: 0,
		generation: current.generation,
		state: null
	};
	const clone = structuredClone(current.state);
	decryptTree(clone);
	stripSyncMarkers(clone);
	return {
		savedAt: current.savedAt,
		generation: current.generation,
		state: clone
	};
}
function resetServerState() {
	return mergeIntoDoc(null, void 0, randomBytes(8).toString("hex"));
}
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
var loadAppState_createServerFn_handler = createServerRpc({
	id: "eaae0f6751211a4d819ff973a09c6067d5dd29b8ca686c5034a12628509729a4",
	name: "loadAppState",
	filename: "src/lib/server-store.functions.ts"
}, (opts) => loadAppState.__executeServer(opts));
var loadAppState = createServerFn({ method: "GET" }).handler(loadAppState_createServerFn_handler, () => {
	const result = loadServerState();
	return {
		savedAt: result.savedAt,
		generation: result.generation,
		state: result.state ?? null
	};
});
var saveAppState_createServerFn_handler = createServerRpc({
	id: "abb28c6d0f7977d3af46328331addd8afe99e75b699ec01af6ee6c83c3ee45fc",
	name: "saveAppState",
	filename: "src/lib/server-store.functions.ts"
}, (opts) => saveAppState.__executeServer(opts));
var saveAppState = createServerFn({ method: "POST" }).validator((input) => {
	const raw = input ?? {};
	if (!raw.state || typeof raw.state !== "object" || Array.isArray(raw.state)) throw new Error("saveAppState requires a state object.");
	return {
		state: raw.state,
		purges: raw.purges ?? void 0
	};
}).handler(saveAppState_createServerFn_handler, async ({ data }) => {
	return mergeIntoDoc(data.state, data.purges);
});
var resetAppState_createServerFn_handler = createServerRpc({
	id: "45952c913aea06e84d1cd891f13e58cffb7adefd2faff1d1a26f1090c14d43d8",
	name: "resetAppState",
	filename: "src/lib/server-store.functions.ts"
}, (opts) => resetAppState.__executeServer(opts));
var resetAppState = createServerFn({ method: "POST" }).handler(resetAppState_createServerFn_handler, () => {
	return resetServerState();
});
//#endregion
export { loadAppState_createServerFn_handler, resetAppState_createServerFn_handler, saveAppState_createServerFn_handler };
