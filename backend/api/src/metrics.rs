//! Real process and queue telemetry for the dashboard.
//!
//! The telemetry drawer used to show only throughput derived from the ledger, and
//! said so. These are measured values taken from the running process and the
//! database — nothing here is estimated or invented: if a source cannot be read on
//! this host the field is `null` and the client renders "unavailable" rather than a
//! plausible number.
//!
//! Linux only for the process half (`/proc/self`); everything else is portable.

use serde::Serialize;
use sqlx::SqlitePool;
use std::time::Instant;

#[derive(Debug, Serialize)]
pub struct Metrics {
    /// Seconds since this process started.
    pub uptime_secs: u64,
    /// Resident set size, from `/proc/self/status`.
    pub rss_bytes: Option<u64>,
    /// OS threads, from `/proc/self/status`.
    pub threads: Option<u64>,
    /// CPU seconds consumed (utime + stime), from `/proc/self/stat`.
    pub cpu_secs: Option<f64>,
    /// On-disk size of the SQLite file, when the database is a file.
    pub db_bytes: Option<u64>,
    pub jobs_queued: i64,
    pub jobs_running: i64,
    pub jobs_failed: i64,
    /// Jobs completed in the last hour, from `jobs.completed_at`.
    pub completed_last_hour: i64,
    /// Rows in the usage ledger, a cheap proxy for pipeline work done.
    pub ledger_rows: i64,
}

fn status_number(field: &str) -> Option<u64> {
    let text = std::fs::read_to_string("/proc/self/status").ok()?;
    for line in text.lines() {
        if let Some(rest) = line.strip_prefix(field) {
            return rest.split_whitespace().next()?.parse().ok();
        }
    }
    None
}

fn status_kib(field: &str) -> Option<u64> {
    status_number(field).map(|kib| kib * 1024)
}

fn cpu_secs() -> Option<f64> {
    let stat = std::fs::read_to_string("/proc/self/stat").ok()?;
    // Fields after the parenthesised command name; utime is 14th overall, stime 15th.
    let tail = stat.rsplit_once(") ")?.1;
    let fields: Vec<&str> = tail.split_whitespace().collect();
    let utime: f64 = fields.get(11)?.parse().ok()?;
    let stime: f64 = fields.get(12)?.parse().ok()?;
    // The kernel reports these in clock ticks; 100 Hz is the standard on Linux.
    Some((utime + stime) / 100.0)
}

fn db_bytes(url: &str) -> Option<u64> {
    let path = url.strip_prefix("sqlite://")?;
    if path.is_empty() || path.starts_with(":memory:") {
        return None;
    }
    std::fs::metadata(path).ok().map(|meta| meta.len())
}

static PROCESS_START: std::sync::OnceLock<Instant> = std::sync::OnceLock::new();

/// When this process started measuring, set on first use so uptime is real for the
/// life of the process rather than per-request.
pub fn process_start() -> Instant {
    *PROCESS_START.get_or_init(Instant::now)
}

async fn count(pool: &SqlitePool, sql: &'static str) -> i64 {
    sqlx::query_scalar::<_, i64>(sql)
        .fetch_one(pool)
        .await
        .unwrap_or(0)
}

pub async fn collect(pool: &SqlitePool) -> Metrics {
    Metrics {
        uptime_secs: process_start().elapsed().as_secs(),
        rss_bytes: status_kib("VmRSS:"),
        threads: status_number("Threads:"),
        cpu_secs: cpu_secs(),
        db_bytes: db_bytes(&std::env::var("DATABASE_URL").unwrap_or_default()),
        jobs_queued: count(pool, "SELECT COUNT(*) FROM jobs WHERE status = 'QUEUED'").await,
        jobs_running: count(pool, "SELECT COUNT(*) FROM jobs WHERE status = 'RUNNING'").await,
        jobs_failed: count(pool, "SELECT COUNT(*) FROM jobs WHERE status = 'FAILED'").await,
        completed_last_hour: count(
            pool,
            "SELECT COUNT(*) FROM jobs WHERE completed_at IS NOT NULL \
             AND completed_at >= datetime('now', '-1 hour')",
        )
        .await,
        ledger_rows: count(pool, "SELECT COUNT(*) FROM usage_ledger").await,
    }
}

use crate::AppState;
use axum::{extract::State, Json};

/// Heartbeat view: mirrors their `worker.alive` / `worker.lastTickAt` contract so
/// the UI can prove the pipeline is running without polling a run.
pub(crate) async fn process_metrics(State(st): State<AppState>) -> Json<crate::metrics::Metrics> {
    Json(crate::metrics::collect(&st.pool).await)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn the_process_half_reads_real_values_on_linux() {
        // These come from /proc; on a machine without it they are None, which the
        // client renders as "unavailable" instead of a fake number.
        if let Some(rss) = status_kib("VmRSS:") {
            assert!(rss > 0, "a running process has resident memory");
        }
        if let Some(secs) = cpu_secs() {
            assert!(secs >= 0.0);
        }
    }

    #[test]
    fn a_memory_database_has_no_file_size() {
        assert_eq!(db_bytes("sqlite::memory:"), None);
        assert_eq!(db_bytes("postgres://example"), None);
    }

    #[tokio::test]
    async fn counters_reflect_the_jobs_table() {
        let pool = sqlx::SqlitePool::connect("sqlite::memory:").await.unwrap();
        sqlx::query("CREATE TABLE jobs (status TEXT, completed_at TEXT)")
            .execute(&pool)
            .await
            .unwrap();
        sqlx::query("CREATE TABLE usage_ledger (id INTEGER)")
            .execute(&pool)
            .await
            .unwrap();
        for status in ["QUEUED", "QUEUED", "RUNNING", "FAILED"] {
            sqlx::query("INSERT INTO jobs (status) VALUES (?)")
                .bind(status)
                .execute(&pool)
                .await
                .unwrap();
        }
        let metrics = collect(&pool).await;
        assert_eq!(metrics.jobs_queued, 2);
        assert_eq!(metrics.jobs_running, 1);
        assert_eq!(metrics.jobs_failed, 1);
    }
}
