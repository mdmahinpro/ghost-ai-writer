//! Per-site single-dispatch lease for the browser tick.
//!
//! Ported from the TS `worker.functions.ts` triad: `workerHeartbeat`,
//! `workerClaimLease`, `workerReleaseLease`, plus the pure `leaseDecision`.
//!
//! ## Why a lease and not just "run it"
//! Every open studio tab runs the same interval tick. Without a lease, N tabs
//! process the same job N times: duplicate drafts, duplicate model spend, and
//! races on the same rows. The rule is that exactly one holder may dispatch
//! per site per tick window.
//!
//! ## The decision (identical to TS `leaseDecision`)
//! Granted when the lease is free, when it has expired, or when the caller
//! already holds it. Anything else is refused and the current holder is
//! reported back so the losing tab can stand down quietly.
//!
//! Expiry is what makes this safe to fail: a tab that closes mid-tick stops
//! renewing, and the next tick from any other tab takes over once the window
//! lapses. Liveness is a timestamp comparison, never a heartbeat we trust.

use axum::{extract::State, Json};
use serde::{Deserialize, Serialize};
use sqlx::SqlitePool;

use crate::{ApiError, AppState};

/// How long a granted lease stays valid. The TS defaults to 15s and clamps
/// caller requests to 5s..60s; the same bounds apply here.
pub const DEFAULT_TTL_MS: i64 = 15_000;
pub const MIN_TTL_MS: i64 = 5_000;
pub const MAX_TTL_MS: i64 = 60_000;

/// A worker is reported online while its last beat is younger than this.
/// TS uses 20s — two missed ticks of the 10s loop.
pub const ONLINE_WINDOW_MS: i64 = 20_000;

/// The shape the frontend expects back from all three calls.
#[derive(Debug, Clone, Serialize)]
pub struct WorkerBeat {
    pub online: bool,
    pub last_beat_at: i64,
    pub active_jobs: i64,
    pub next_calendar_pulse_at: Option<i64>,
    pub server_now: i64,
    pub lease: LeaseView,
}

#[derive(Debug, Clone, Serialize)]
pub struct LeaseView {
    pub holder: String,
    pub expires_at: i64,
    pub granted: bool,
}

/// A lease row as stored.
#[derive(Debug, Clone, sqlx::FromRow)]
pub struct LeaseRow {
    pub lease_id: String,
    pub lease_ticks: i64,
    pub expires_at: i64,
    pub last_beat_at: i64,
    pub active_jobs: i64,
    pub next_calendar_pulse_at: Option<i64>,
}

/// The input all three endpoints accept.
#[derive(Debug, Deserialize)]
pub struct WorkInput {
    pub site_id: String,
    #[serde(default)]
    pub tick_id: String,
    #[serde(default)]
    pub active_jobs: Option<i64>,
    #[serde(default)]
    pub next_calendar_pulse_at: Option<i64>,
    /// Ignored on the wire when absent; clamped by `clamp_ttl`.
    #[serde(default)]
    pub ttl_ms: Option<i64>,
}

/// Clamp a caller-supplied lease length into the safe window.
///
/// A caller asking for 0 would create a lease that is already expired, and one
/// asking for an hour would block every other tab long after it died. Both are
/// caller mistakes the server should absorb rather than honour.
pub fn clamp_ttl(ttl_ms: Option<i64>) -> i64 {
    match ttl_ms {
        Some(v) => v.clamp(MIN_TTL_MS, MAX_TTL_MS),
        None => DEFAULT_TTL_MS,
    }
}

/// The pure lease decision — the single-dispatch guarantee.
///
/// Granted when no lease exists, when the existing one has expired, or when
/// the caller already holds it. Otherwise refused, naming the current holder.
pub fn lease_decision(
    existing: Option<&LeaseRow>,
    tick_id: &str,
    now: i64,
    ttl_ms: i64,
) -> (bool, String, i64) {
    let holder_is_self = existing.map(|r| r.lease_id == tick_id).unwrap_or(false);
    let free = match existing {
        None => true,
        Some(r) => r.expires_at <= now || holder_is_self,
    };
    if free {
        (true, tick_id.to_string(), now + ttl_ms)
    } else {
        let r = existing.expect("free implies some row");
        (false, r.lease_id.clone(), r.expires_at)
    }
}

/// Read the lease view reported back to every caller.
pub fn beat_for(row: Option<&LeaseRow>, tick_id: &str, now: i64) -> WorkerBeat {
    let lease_active = row.map(|r| r.expires_at > now).unwrap_or(false);
    let holder = row.map(|r| r.lease_id.clone()).unwrap_or_default();
    WorkerBeat {
        online: row
            .map(|r| now - r.last_beat_at < ONLINE_WINDOW_MS)
            .unwrap_or(false),
        last_beat_at: row.map(|r| r.last_beat_at).unwrap_or(0),
        active_jobs: row.map(|r| r.active_jobs).unwrap_or(0),
        next_calendar_pulse_at: row.and_then(|r| r.next_calendar_pulse_at),
        server_now: now,
        lease: LeaseView {
            holder: holder.clone(),
            expires_at: row.map(|r| r.expires_at).unwrap_or(0),
            // Granted means "you may dispatch": either the lease is not held
            // by anyone else right now, or it is held by exactly this tick.
            granted: !lease_active || holder == tick_id,
        },
    }
}

fn now_ms() -> i64 {
    use std::time::{SystemTime, UNIX_EPOCH};
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .unwrap_or_default()
        .as_millis() as i64
}

async fn read_lease(pool: &SqlitePool, site_id: &str) -> Result<Option<LeaseRow>, sqlx::Error> {
    sqlx::query_as(
        "SELECT lease_id, lease_ticks, expires_at, last_beat_at, \
         active_jobs, next_calendar_pulse_at FROM worker_leases WHERE site_id = ?1",
    )
    .bind(site_id)
    .fetch_optional(pool)
    .await
}

fn read_input(input: WorkInput) -> Result<(String, String, i64, Option<i64>, i64), &'static str> {
    let site_id = input.site_id.trim().to_string();
    if site_id.is_empty() {
        return Err("site_id is required");
    }
    let site_id: String = site_id.chars().take(64).collect();
    let tick_id: String = input.tick_id.chars().take(64).collect();
    let active_jobs = input.active_jobs.unwrap_or(0).clamp(0, 10_000);
    let pulse = input.next_calendar_pulse_at;
    Ok((site_id, tick_id, active_jobs, pulse, clamp_ttl(input.ttl_ms)))
}

/// POST /api/v1/worker/heartbeat — beat plus lease renewal in one call.
pub async fn heartbeat(
    State(st): State<AppState>,
    Json(input): Json<WorkInput>,
) -> Result<Json<WorkerBeat>, ApiError> {
    let (site_id, tick_id, active_jobs, pulse, ttl_ms) =
        read_input(input).map_err(ApiError::BadRequest)?;
    let now = now_ms();
    let existing = read_lease(&st.pool, &site_id)
        .await
        .map_err(ApiError::Db)?;

    let holder_is_self = existing
        .as_ref()
        .map(|r| r.lease_id == tick_id && !tick_id.is_empty())
        .unwrap_or(false);
    let free = existing.as_ref().map(|r| r.expires_at <= now).unwrap_or(true);

    // A heartbeat keeps the lease alive only if this tick holds it or the
    // lease was free; it must never steal an active lease from another tab.
    let lease_id = if free || holder_is_self {
        if tick_id.is_empty() {
            existing.as_ref().map(|r| r.lease_id.clone()).unwrap_or_default()
        } else {
            tick_id.clone()
        }
    } else {
        existing.as_ref().map(|r| r.lease_id.clone()).unwrap_or_default()
    };
    let expires_at = if free || holder_is_self {
        now + ttl_ms
    } else {
        existing.as_ref().map(|r| r.expires_at).unwrap_or(now + ttl_ms)
    };
    let lease_ticks = existing.as_ref().map(|r| r.lease_ticks).unwrap_or(0) + 1;

    sqlx::query(
        "INSERT INTO worker_leases \
           (site_id, lease_id, lease_ticks, expires_at, last_beat_at, active_jobs, \
            next_calendar_pulse_at, source) \
         VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, 'browser') \
         ON CONFLICT(site_id) DO UPDATE SET \
           lease_id = excluded.lease_id, \
           lease_ticks = excluded.lease_ticks, \
           expires_at = excluded.expires_at, \
           last_beat_at = excluded.last_beat_at, \
           active_jobs = excluded.active_jobs, \
           next_calendar_pulse_at = excluded.next_calendar_pulse_at",
    )
    .bind(&site_id)
    .bind(&lease_id)
    .bind(lease_ticks)
    .bind(expires_at)
    .bind(now)
    .bind(active_jobs)
    .bind(pulse)
    .execute(&st.pool)
    .await
    .map_err(ApiError::Db)?;

    let row = read_lease(&st.pool, &site_id)
        .await
        .map_err(ApiError::Db)?;
    Ok(Json(beat_for(row.as_ref(), &tick_id, now)))
}

/// POST /api/v1/worker/claim — claim or renew the lease.
pub async fn claim_lease(
    State(st): State<AppState>,
    Json(input): Json<WorkInput>,
) -> Result<Json<WorkerBeat>, ApiError> {
    let (site_id, tick_id, active_jobs, pulse, ttl_ms) =
        read_input(input).map_err(ApiError::BadRequest)?;
    let now = now_ms();
    let existing = read_lease(&st.pool, &site_id)
        .await
        .map_err(ApiError::Db)?;

    let (granted, holder, expires_at) =
        lease_decision(existing.as_ref(), &tick_id, now, ttl_ms);

    if granted {
        let lease_ticks = existing.as_ref().map(|r| r.lease_ticks).unwrap_or(0) + 1;
        sqlx::query(
            "INSERT INTO worker_leases \
               (site_id, lease_id, lease_ticks, expires_at, last_beat_at, active_jobs, \
                next_calendar_pulse_at, source) \
             VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, 'browser') \
             ON CONFLICT(site_id) DO UPDATE SET \
               lease_id = excluded.lease_id, \
               lease_ticks = excluded.lease_ticks, \
               expires_at = excluded.expires_at, \
               last_beat_at = excluded.last_beat_at, \
               active_jobs = excluded.active_jobs, \
               next_calendar_pulse_at = excluded.next_calendar_pulse_at",
        )
        .bind(&site_id)
        .bind(&holder)
        .bind(lease_ticks)
        .bind(expires_at)
        .bind(now)
        .bind(active_jobs)
        .bind(pulse)
        .execute(&st.pool)
        .await
        .map_err(ApiError::Db)?;
    }

    let row = read_lease(&st.pool, &site_id)
        .await
        .map_err(ApiError::Db)?;
    Ok(Json(beat_for(row.as_ref(), &tick_id, now)))
}

/// POST /api/v1/worker/release — stand down, but only if you hold it.
#[derive(Debug, Serialize)]
pub struct ReleaseOut {
    pub released: bool,
}

pub async fn release_lease(
    State(st): State<AppState>,
    Json(input): Json<WorkInput>,
) -> Result<Json<ReleaseOut>, ApiError> {
    let (site_id, tick_id, _, _, _) = read_input(input).map_err(ApiError::BadRequest)?;
    let existing = read_lease(&st.pool, &site_id)
        .await
        .map_err(ApiError::Db)?;

    let Some(row) = existing else {
        return Ok(Json(ReleaseOut { released: false }));
    };
    // Only the holder may release. A tab that lost the race must not be able
    // to drop the winner's lease.
    if !tick_id.is_empty() && row.lease_id != tick_id {
        return Ok(Json(ReleaseOut { released: false }));
    }

    sqlx::query("UPDATE worker_leases SET expires_at = 0 WHERE site_id = ?1")
        .bind(&site_id)
        .execute(&st.pool)
        .await
        .map_err(ApiError::Db)?;

    Ok(Json(ReleaseOut { released: true }))
}

#[cfg(test)]
mod tests {
    use super::*;

    fn row(lease_id: &str, expires_at: i64, last_beat_at: i64) -> LeaseRow {
        LeaseRow {
            lease_id: lease_id.into(),
            lease_ticks: 3,
            expires_at,
            last_beat_at,
            active_jobs: 2,
            next_calendar_pulse_at: Some(999),
        }
    }

    #[test]
    fn a_free_lease_is_granted() {
        let (granted, holder, exp) = lease_decision(None, "tick-a", 1_000, 15_000);
        assert!(granted);
        assert_eq!(holder, "tick-a");
        assert_eq!(exp, 16_000);
    }

    #[test]
    fn a_live_lease_held_by_another_tick_is_refused() {
        let existing = row("tick-b", 50_000, 1_000);
        let (granted, holder, exp) = lease_decision(Some(&existing), "tick-a", 1_000, 15_000);
        assert!(!granted);
        assert_eq!(holder, "tick-b", "the loser must learn who won");
        assert_eq!(exp, 50_000);
    }

    #[test]
    fn an_expired_lease_is_taken_over() {
        // expires_at 500 <= now 1000: the previous holder stopped renewing.
        let existing = row("tick-b", 500, 1_000);
        let (granted, holder, _) = lease_decision(Some(&existing), "tick-a", 1_000, 15_000);
        assert!(granted);
        assert_eq!(holder, "tick-a");
    }

    #[test]
    fn the_holder_renews_its_own_lease() {
        let existing = row("tick-a", 50_000, 1_000);
        let (granted, holder, exp) = lease_decision(Some(&existing), "tick-a", 1_000, 15_000);
        assert!(granted);
        assert_eq!(holder, "tick-a");
        assert_eq!(exp, 16_000, "renewal extends from now, not from the old expiry");
    }

    #[test]
    fn exactly_one_of_many_concurrent_ticks_is_granted() {
        // The property the whole module exists for.
        let now = 1_000;
        let mut held: Option<LeaseRow> = None;
        let mut granted_count = 0;
        for tick in ["t1", "t2", "t3", "t4", "t5"] {
            let (granted, holder, exp) = lease_decision(held.as_ref(), tick, now, 15_000);
            if granted {
                granted_count += 1;
                held = Some(row(&holder, exp, now));
            }
        }
        assert_eq!(granted_count, 1, "more than one tab dispatched");
    }

    #[test]
    fn ttl_is_clamped_into_the_safe_window() {
        assert_eq!(clamp_ttl(None), DEFAULT_TTL_MS);
        assert_eq!(clamp_ttl(Some(0)), MIN_TTL_MS, "a zero lease is already dead");
        assert_eq!(clamp_ttl(Some(1)), MIN_TTL_MS);
        assert_eq!(clamp_ttl(Some(i64::MAX)), MAX_TTL_MS, "an hour would wedge the site");
        assert_eq!(clamp_ttl(Some(20_000)), 20_000);
    }

    #[test]
    fn a_beat_reports_online_only_inside_the_window() {
        let fresh = row("t", 50_000, 1_000);
        assert!(beat_for(Some(&fresh), "t", 15_000).online);
        // 20s stale: the loop missed two ticks.
        let stale = row("t", 50_000, 1_000);
        assert!(!beat_for(Some(&stale), "t", 21_001).online);
        assert!(!beat_for(None, "t", 1_000).online, "no row is never online");
    }

    #[test]
    fn granted_reflects_whether_this_tick_may_dispatch() {
        let live_other = row("other", 50_000, 1_000);
        let beat = beat_for(Some(&live_other), "me", 1_000);
        assert!(!beat.lease.granted);
        assert_eq!(beat.lease.holder, "other");

        let mine = row("me", 50_000, 1_000);
        assert!(beat_for(Some(&mine), "me", 1_000).lease.granted);

        let expired = row("other", 500, 1_000);
        assert!(beat_for(Some(&expired), "me", 1_000).lease.granted);
    }
}
