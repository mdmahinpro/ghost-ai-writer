#!/usr/bin/env node
/**
 * Local fixture API for UI work — NOT part of the product.
 *
 * The studio's client talks to a deployed Rust API guarded by GAW_ADMIN_TOKEN,
 * which a design pass has no business needing. This server answers the two
 * state routes the app boots from (using the workspace's own saved snapshot in
 * `.data/appstate.json`) and returns an empty 200 for every other `/api/v1/*`
 * call, so pages render with real data and no auth wall.
 *
 * Usage: node scripts/ui-preview-api.mjs [port]
 *   then: VITE_GAW_API=http://127.0.0.1:8787 npm run dev
 */
import { createServer } from "node:http";
import { readFileSync, existsSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const PORT = Number(process.argv[2] ?? 8787);
const SNAPSHOT = join(ROOT, ".data", "appstate.json");

function snapshot() {
  if (!existsSync(SNAPSHOT)) return { savedAt: Date.now(), generation: 1, state: {} };
  try {
    const doc = JSON.parse(readFileSync(SNAPSHOT, "utf8"));
    return { savedAt: doc.savedAt ?? Date.now(), generation: doc.generation ?? 1, state: doc.state ?? {} };
  } catch {
    return { savedAt: Date.now(), generation: 1, state: {} };
  }
}

function send(res, status, body) {
  const payload = Buffer.from(JSON.stringify(body ?? {}), "utf8");
  res.statusCode = status;
  res.setHeader("content-type", "application/json; charset=utf-8");
  res.setHeader("access-control-allow-origin", "*");
  res.setHeader("access-control-allow-headers", "content-type, authorization, x-api-token");
  res.setHeader("access-control-allow-methods", "GET, POST, PATCH, PUT, DELETE, OPTIONS");
  res.setHeader("cache-control", "no-store");
  res.setHeader("content-length", String(payload.byteLength));
  res.end(payload);
}

createServer((req, res) => {
  const method = (req.method ?? "GET").toUpperCase();
  const path = (req.url ?? "/").split("?", 1)[0];
  if (method === "OPTIONS") return send(res, 204, null);
  if (path === "/health") return send(res, 200, { status: "ok", fixture: true });
  if (path === "/api/v1/state" && method === "GET") return send(res, 200, snapshot());
  if (path === "/api/v1/state") return send(res, 200, { success: true, generation: Date.now() });
  if (path === "/api/v1/keys" && method === "GET") return send(res, 200, []);
  if (path === "/api/v1/providers" && method === "GET") return send(res, 200, []);
  if (path === "/api/v1/providers/models") return send(res, 200, []);
  if (path === "/api/v1/worker") return send(res, 200, { paused: false, activeJobs: 0, source: "fixture" });
  // Lease/beat: shaped like the Rust worker beat (snake_case), never granted so a
  // preview tab cannot claim dispatch from the real worker.
  if (path === "/api/v1/lease/claim" || path === "/api/v1/lease/heartbeat") {
    const now = Date.now();
    return send(res, 200, {
      online: true,
      last_beat_at: now,
      active_jobs: 0,
      next_calendar_pulse_at: null,
      server_now: now,
      lease: { holder: "ui-preview", expires_at: now + 30_000, granted: false },
    });
  }
  if (path === "/api/v1/jobs" && method === "GET") return send(res, 200, []);
  console.log(`[ui-preview-api] ${method} ${path} -> 200`);
  return send(res, 200, { ok: true, fixture: true });
}).listen(PORT, "127.0.0.1", () => {
  console.log(`[ui-preview-api] listening on http://127.0.0.1:${PORT} (snapshot: ${SNAPSHOT})`);
});
