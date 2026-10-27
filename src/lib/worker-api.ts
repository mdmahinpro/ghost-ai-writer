/**
 * Worker lease API — the single-dispatch guarantee.
 *
 * Every open studio tab runs the same interval tick. Without a lease they
 * would all process the same queue: duplicate drafts, duplicate model spend,
 * and races on the same rows. The server grants exactly one holder per site
 * per tick window.
 *
 * These replace the former `workerClaimLease` / `workerHeartbeat` server
 * functions. Shapes match the old contract so callers did not change.
 */
import { post, type ApiResponse } from "./api-client";

/** The lease view the server reports back. */
export type LeaseView = {
  holder: string;
  expiresAt: number;
  granted: boolean;
};

/** Worker liveness + lease, as the UI consumes it. */
export type WorkerBeat = {
  online: boolean;
  lastBeatAt: number;
  activeJobs: number;
  nextCalendarPulseAt?: number;
  serverNow: number;
  ticks: number;
  lease: LeaseView;
};

/** Wire shape from Rust (snake_case). */
type WireBeat = {
  online: boolean;
  last_beat_at: number;
  active_jobs: number;
  next_calendar_pulse_at: number | null;
  server_now: number;
  lease: { holder: string; expires_at: number; granted: boolean };
};

type WorkInput = {
  siteId: string;
  tickId: string;
  activeJobs?: number;
  nextCalendarPulseAt?: number;
  ttlMs?: number;
};

function toWire(input: WorkInput) {
  return {
    site_id: input.siteId,
    tick_id: input.tickId,
    active_jobs: input.activeJobs ?? 0,
    next_calendar_pulse_at: input.nextCalendarPulseAt ?? null,
    ttl_ms: input.ttlMs,
  };
}

function fromWire(w: WireBeat, ticks: number): WorkerBeat {
  // A response without a lease (an older API build, a proxy error page that
  // still parsed as JSON) used to throw a TypeError here, which took down the
  // whole worker tick. Treat a missing lease as "not granted" instead.
  const lease = w.lease ?? { holder: "", expires_at: 0, granted: false };
  return {
    online: Boolean(w.online),
    lastBeatAt: Number(w.last_beat_at) || 0,
    activeJobs: Number(w.active_jobs) || 0,
    nextCalendarPulseAt: w.next_calendar_pulse_at ?? undefined,
    serverNow: Number(w.server_now) || Date.now(),
    ticks,
    lease: {
      holder: String(lease.holder ?? ""),
      expiresAt: Number(lease.expires_at) || 0,
      granted: Boolean(lease.granted),
    },
  };
}

/**
 * A monotonic tick counter for the UI.
 *
 * The old server function kept this in a process registry; the Rust backend
 * does not need it for correctness (lease_ticks covers that), so it is derived
 * client-side. It exists only so the UI has a number that visibly moves.
 */
let tickCounter = 0;

/**
 * Claim or renew the lease. `granted: false` means another tab holds it and
 * this tick must stand down.
 */
export async function claimLease(input: WorkInput): Promise<ApiResponse<WorkerBeat>> {
  const res = await post<WireBeat>("/api/v1/lease/claim", toWire(input));
  if (!res.ok) return res;
  tickCounter += 1;
  return { ok: true, data: fromWire(res.data, tickCounter) };
}

/** Beat plus lease renewal in one call. */
export async function heartbeat(input: WorkInput): Promise<ApiResponse<WorkerBeat>> {
  const res = await post<WireBeat>("/api/v1/lease/heartbeat", toWire(input));
  if (!res.ok) return res;
  tickCounter += 1;
  return { ok: true, data: fromWire(res.data, tickCounter) };
}

/**
 * Stand down. Only the current holder can release — a tab that lost the race
 * cannot drop the winner's lease.
 */
export async function releaseLease(input: {
  siteId: string;
  tickId: string;
}): Promise<ApiResponse<{ released: boolean }>> {
  return post<{ released: boolean }>("/api/v1/lease/release", {
    site_id: input.siteId,
    tick_id: input.tickId,
  });
}
