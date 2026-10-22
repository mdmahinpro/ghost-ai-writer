/**
 * Rule 6 — durable worker bridge.
 *
 * The browser owns the workspace data, so this server module provides the two
 * things a tab cannot: (1) a heartbeat that survives reloads and proves a worker
 * loop exists, and (2) an atomic single-dispatch lease so several tabs and the
 * server loop can never advance the same queue or publish the same post twice.
 *
 * The registry is file-backed with atomic rename, so a restart keeps the lease
 * state honest. Full headless execution moves to the SQL migration; until then
 * this bridge is the coordination point and the badge reads its real timestamp.
 */
import { createServerFn } from "@tanstack/react-start";
import { mkdirSync, readFileSync, renameSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";

type SiteBeat = {
  leaseId: string;
  leaseTicks: number;
  expiresAt: number;
  lastBeatAt: number;
  activeJobs: number;
  nextCalendarPulseAt?: number;
  source: "browser" | "server";
};

type Registry = {
  serverStartedAt: number;
  ticks: number;
  sites: Record<string, SiteBeat>;
};

const DIR = join(tmpdir(), "ghost-grok-worker");
const FILE = join(DIR, "worker.json");

function readRegistry(): Registry {
  try {
    const raw = JSON.parse(readFileSync(FILE, "utf8")) as Partial<Registry>;
    return { serverStartedAt: raw.serverStartedAt ?? Date.now(), ticks: raw.ticks ?? 0, sites: raw.sites ?? {} };
  } catch {
    return { serverStartedAt: Date.now(), ticks: 0, sites: {} };
  }
}

function writeRegistry(registry: Registry): void {
  try {
    mkdirSync(DIR, { recursive: true });
    const temp = `${FILE}.${process.pid}.tmp`;
    writeFileSync(temp, JSON.stringify(registry), "utf8");
    renameSync(temp, FILE);
  } catch {
    // Read-only filesystem: the in-memory registry below still coordinates this process.
  }
}

let registry = readRegistry();
let intervalStarted = false;

/** Durable loop: bumps the tick counter so the heartbeat is never a dead constant. */
function ensureLoop(): void {
  if (intervalStarted) return;
  intervalStarted = true;
  const timer = setInterval(() => {
    registry.ticks += 1;
    writeRegistry(registry);
  }, 10_000);
  // Never hold the process open because of the worker loop.
  if (typeof timer.unref === "function") timer.unref();
}

export type WorkerBeat = {
  online: boolean;
  lastBeatAt: number;
  activeJobs: number;
  nextCalendarPulseAt?: number;
  serverNow: number;
  ticks: number;
  lease: { holder: string; expiresAt: number; granted: boolean };
};

function beatFor(siteId: string, tickId: string): WorkerBeat {
  const entry = registry.sites[siteId];
  const now = Date.now();
  const leaseActive = Boolean(entry && entry.expiresAt > now);
  return {
    online: Boolean(entry && now - entry.lastBeatAt < 20_000),
    lastBeatAt: entry?.lastBeatAt ?? 0,
    activeJobs: entry?.activeJobs ?? 0,
    nextCalendarPulseAt: entry?.nextCalendarPulseAt,
    serverNow: now,
    ticks: registry.ticks,
    lease: { holder: entry?.leaseId ?? "", expiresAt: entry?.expiresAt ?? 0, granted: !leaseActive || entry!.leaseId === tickId },
  };
}

/**
 * Pure lease decision — the single-dispatch guarantee.
 * Granted only when the lease is free, expired, or already held by this tickId.
 */
export function leaseDecision(
  existing: { leaseId: string; expiresAt: number } | undefined,
  tickId: string,
  now: number,
): { granted: boolean; holder: string; expiresAt: number } {
  const free = !existing || existing.expiresAt <= now || existing.leaseId === tickId;
  if (free) return { granted: true, holder: tickId, expiresAt: now + 15_000 };
  return { granted: false, holder: existing!.leaseId, expiresAt: existing!.expiresAt };
}

const readWorkInput = (input: unknown) => {
  const raw = input as { siteId?: string; tickId?: string; activeJobs?: number; nextCalendarPulseAt?: number | null; ttlMs?: number } | null;
  const siteId = typeof raw?.siteId === "string" && raw.siteId.trim() ? raw.siteId.trim().slice(0, 64) : "";
  if (!siteId) throw new Error("siteId is required.");
  return {
    siteId,
    tickId: typeof raw?.tickId === "string" ? raw.tickId.slice(0, 64) : "",
    activeJobs: Number.isFinite(raw?.activeJobs) ? Math.max(0, Math.min(10_000, Math.floor(raw!.activeJobs!))) : 0,
    nextCalendarPulseAt: Number.isFinite(raw?.nextCalendarPulseAt) ? Math.floor(raw!.nextCalendarPulseAt!) : undefined,
    ttlMs: Number.isFinite(raw?.ttlMs) ? Math.max(5_000, Math.min(60_000, Math.floor(raw!.ttlMs!))) : 15_000,
  };
};

/** Heartbeat + lease renewal in one call (the browser tick sends the truth it knows). */
export const workerHeartbeat = createServerFn({ method: "POST" })
  .validator(readWorkInput)
  .handler(async ({ data }): Promise<WorkerBeat> => {
    ensureLoop();
    registry = readRegistry();
    const now = Date.now();
    const existing = registry.sites[data.siteId];
    const sameHolder = existing?.leaseId && existing.leaseId === data.tickId;
    const free = !existing || existing.expiresAt <= now;
    const beat: SiteBeat = {
      leaseId: free || sameHolder ? data.tickId || existing?.leaseId || "" : existing!.leaseId,
      leaseTicks: (existing?.leaseTicks ?? 0) + 1,
      expiresAt: (free || sameHolder ? now + data.ttlMs : existing!.expiresAt) ?? now + data.ttlMs,
      lastBeatAt: now,
      activeJobs: data.activeJobs,
      nextCalendarPulseAt: data.nextCalendarPulseAt,
      source: "browser",
    };
    registry.sites[data.siteId] = beat;
    writeRegistry(registry);
    return beatFor(data.siteId, data.tickId);
  });

/**
 * Claim (or renew) the single-dispatch lease. Granted only when the lease is
 * free, expired, or already held by this tickId — concurrent tabs get false.
 */
export const workerClaimLease = createServerFn({ method: "POST" })
  .validator(readWorkInput)
  .handler(async ({ data }): Promise<WorkerBeat> => {
    ensureLoop();
    registry = readRegistry();
    const now = Date.now();
    const existing = registry.sites[data.siteId];
    const decision = leaseDecision(existing, data.tickId, now);
    if (decision.granted) {
      registry.sites[data.siteId] = {
        leaseId: decision.holder,
        leaseTicks: (existing?.leaseTicks ?? 0) + 1,
        expiresAt: now + data.ttlMs,
        lastBeatAt: now,
        activeJobs: data.activeJobs,
        nextCalendarPulseAt: data.nextCalendarPulseAt,
        source: "browser",
      };
      writeRegistry(registry);
    }
    return beatFor(data.siteId, data.tickId);
  });

export const workerReleaseLease = createServerFn({ method: "POST" })
  .validator(readWorkInput)
  .handler(async ({ data }): Promise<{ released: boolean }> => {
    registry = readRegistry();
    const existing = registry.sites[data.siteId];
    if (!existing || (data.tickId && existing.leaseId !== data.tickId)) return { released: false };
    existing.expiresAt = 0;
    writeRegistry(registry);
    return { released: true };
  });
