//! Worker: lease-based job claiming, resumable stages, heartbeat (S2).
//!
//! Why this exists: their pipeline runs server-side and reports
//! `worker: { alive, lastTickAt }` in `/api/config`. Ours ran in a browser tab,
//! so closing the tab killed every in-flight job. This module makes a job a row
//! with a lease: the worker can die at any point and another one picks the job
//! up, continuing from `stage_index` rather than starting over.
//!
//! Guarantees:
//!  * a job is claimed by exactly one worker at a time (lease + guarded UPDATE),
//!  * an expired lease is re-claimable (crash recovery),
//!  * finished stages are never re-run (`stage_index` persists),
//!  * failures back off and stop at MAX_ATTEMPTS instead of looping forever,
//!  * every transition is written to `job_events`, so resumption is auditable.

use sqlx::sqlite::SqlitePool;
use std::time::{SystemTime, UNIX_EPOCH};

pub const STAGES: [&str; 6] = [
    "blueprint",
    "draft",
    "revision",
    "metadata",
    "enrichment",
    "validation",
];

pub const MAX_ATTEMPTS: i64 = 3;
pub const DEFAULT_LEASE_SECS: i64 = 90;

/// ISO-8601 UTC, second precision, always the same shape so string comparison
/// against stored timestamps is correct.
pub fn iso_from_epoch(secs: i64) -> String {
    let days = secs.div_euclid(86_400);
    let rem = secs.rem_euclid(86_400);
    let (h, mi, s) = (rem / 3600, (rem % 3600) / 60, rem % 60);
    // civil-from-days (Howard Hinnant)
    let z = days + 719_468;
    let era = if z >= 0 { z } else { z - 146_096 } / 146_097;
    let doe = z - era * 146_097;
    let yoe = (doe - doe / 1460 + doe / 36_524 - doe / 146_096) / 365;
    let mut y = yoe + era * 400;
    let doy = doe - (365 * yoe + yoe / 4 - yoe / 100);
    let mp = (5 * doy + 2) / 153;
    let d = doy - (153 * mp + 2) / 5 + 1;
    let m = if mp < 10 { mp + 3 } else { mp - 9 };
    if m <= 2 {
        y += 1;
    }
    format!("{y:04}-{m:02}-{d:02}T{h:02}:{mi:02}:{s:02}Z")
}

pub fn iso_now() -> String {
    let secs = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|d| d.as_secs() as i64)
        .unwrap_or(0);
    iso_from_epoch(secs)
}

pub fn iso_after(secs: i64) -> String {
    let now = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|d| d.as_secs() as i64)
        .unwrap_or(0);
    iso_from_epoch(now + secs)
}

#[derive(Debug, Clone, sqlx::FromRow, serde::Serialize)]
pub struct ClaimedJob {
    pub id: i64,
    pub workspace_id: i64,
    pub site_id: i64,
    pub website_id: Option<i64>,
    pub keyword: String,
    pub stage_index: i64,
    pub attempts: i64,
    pub status: String,
}

async fn record_event(
    pool: &SqlitePool,
    job_id: i64,
    worker_id: &str,
    kind: &str,
    stage_index: Option<i64>,
    detail: Option<&str>,
) -> Result<(), sqlx::Error> {
    sqlx::query(
        "INSERT INTO job_events (job_id, worker_id, kind, stage_index, detail, at) \
         VALUES (?, ?, ?, ?, ?, ?)",
    )
    .bind(job_id)
    .bind(worker_id)
    .bind(kind)
    .bind(stage_index)
    .bind(detail)
    .bind(iso_now())
    .execute(pool)
    .await?;
    Ok(())
}

/// Claim the oldest claimable job. The guarded UPDATE means two workers racing
/// on the same row cannot both win: the loser sees 0 rows affected and returns
/// None instead of a phantom claim.
pub async fn claim(
    pool: &SqlitePool,
    worker_id: &str,
    lease_secs: i64,
) -> Result<Option<ClaimedJob>, sqlx::Error> {
    let now = iso_now();
    let lease = iso_after(lease_secs);
    // Claimable: fresh/queued work, retries past their backoff, AND jobs a dead
    // worker left in RUNNING with an expired lease (crash recovery).
    let candidate: Option<(i64, String)> = sqlx::query_as(
        "SELECT id, status FROM jobs \
         WHERE ( \
                 (status IN ('QUEUED', 'pending', 'RETRY') AND (not_before IS NULL OR not_before <= ?)) \
                 OR (status = 'RUNNING' AND lease_until IS NOT NULL AND lease_until <= ?) \
               ) \
         ORDER BY id LIMIT 1",
    )
    .bind(&now)
    .bind(&now)
    .fetch_optional(pool)
    .await?;

    let Some((id, prior_status)) = candidate else {
        return Ok(None);
    };

    let updated = sqlx::query(
        "UPDATE jobs SET status = 'RUNNING', locked_by = ?, lease_until = ?, claimed_at = ?, \
         attempts = attempts + 1 \
         WHERE id = ? AND (lease_until IS NULL OR lease_until <= ?)",
    )
    .bind(worker_id)
    .bind(&lease)
    .bind(&now)
    .bind(id)
    .bind(&now)
    .execute(pool)
    .await?;

    if updated.rows_affected() == 0 {
        return Ok(None);
    }

    let job: ClaimedJob = sqlx::query_as(
        "SELECT id, workspace_id, site_id, website_id, keyword, stage_index, attempts, status \
         FROM jobs WHERE id = ?",
    )
    .bind(id)
    .fetch_one(pool)
    .await?;

    let kind = if prior_status == "RUNNING" {
        "LEASE_EXPIRED"
    } else if job.attempts > 1 {
        "CLAIMED_AFTER_RETRY"
    } else {
        "CLAIMED"
    };
    record_event(pool, id, worker_id, kind, Some(job.stage_index), None).await?;
    Ok(Some(job))
}

/// Extend the lease and keep the row locked by this worker.
/// Used by S3's long stages mid-call (their draft stage runs ~26 s, longer than
/// a default lease) and by the stage runner; exercised in tests until then.
#[allow(dead_code)]
pub async fn renew_lease(
    pool: &SqlitePool,
    job_id: i64,
    worker_id: &str,
    lease_secs: i64,
) -> Result<bool, sqlx::Error> {
    let lease = iso_after(lease_secs);
    let res = sqlx::query(
        "UPDATE jobs SET lease_until = ? WHERE id = ? AND locked_by = ? AND status = 'RUNNING'",
    )
    .bind(lease)
    .bind(job_id)
    .bind(worker_id)
    .execute(pool)
    .await?;
    if res.rows_affected() > 0 {
        record_event(pool, job_id, worker_id, "LEASE_RENEWED", None, None).await?;
    }
    Ok(res.rows_affected() > 0)
}

/// Mark one stage finished. Progress is persisted, so a crash after this point
/// never repeats the stage and never re-charges the model call behind it.
/// `stage_transaction` is the atomic variant the worker uses; this single-step
/// form stays for seeding/tests and for S3 stages that persist their own output.
#[allow(dead_code)]
pub async fn complete_stage(
    pool: &SqlitePool,
    job_id: i64,
    worker_id: &str,
    stage_index: i64,
) -> Result<(), sqlx::Error> {
    let next = (stage_index + 1).clamp(0, STAGES.len() as i64);
    let stage_key = STAGES.get(next as usize).copied().unwrap_or("validation");
    sqlx::query("UPDATE jobs SET stage_index = ?, stage = ? WHERE id = ?")
        .bind(next)
        .bind(stage_key)
        .bind(job_id)
        .execute(pool)
        .await?;
    record_event(
        pool,
        job_id,
        worker_id,
        "STAGE_DONE",
        Some(stage_index),
        Some(stage_key),
    )
    .await?;
    Ok(())
}

pub async fn complete(pool: &SqlitePool, job_id: i64, worker_id: &str) -> Result<(), sqlx::Error> {
    sqlx::query(
        "UPDATE jobs SET status = 'COMPLETED', stage_index = ?, stage = 'validation', \
         locked_by = NULL, lease_until = NULL WHERE id = ?",
    )
    .bind(STAGES.len() as i64)
    .bind(job_id)
    .execute(pool)
    .await?;
    record_event(
        pool,
        job_id,
        worker_id,
        "COMPLETED",
        Some(STAGES.len() as i64),
        None,
    )
    .await?;
    Ok(())
}

/// Failure path: retry with backoff while attempts remain, otherwise FAILED.
/// Returns the resulting status so callers/tests never guess.
pub async fn fail(
    pool: &SqlitePool,
    job_id: i64,
    worker_id: &str,
    error: &str,
) -> Result<String, sqlx::Error> {
    let attempts: i64 = sqlx::query_scalar("SELECT attempts FROM jobs WHERE id = ?")
        .bind(job_id)
        .fetch_one(pool)
        .await?;
    let status = if attempts >= MAX_ATTEMPTS {
        "FAILED"
    } else {
        "RETRY"
    };
    let backoff = 30 * attempts.max(1);
    let not_before = if status == "RETRY" {
        Some(iso_after(backoff))
    } else {
        None
    };
    sqlx::query(
        "UPDATE jobs SET status = ?, last_error = ?, not_before = ?, \
         locked_by = NULL, lease_until = NULL WHERE id = ?",
    )
    .bind(status)
    .bind(error)
    .bind(not_before)
    .bind(job_id)
    .execute(pool)
    .await?;
    record_event(
        pool,
        job_id,
        worker_id,
        if status == "RETRY" { "RETRY" } else { "FAILED" },
        None,
        Some(error),
    )
    .await?;
    Ok(status.to_string())
}

/// Upsert this worker's heartbeat. `/api/v1/worker` reads it, mirroring their
/// `worker.alive` + `worker.lastTickAt` contract.
pub async fn heartbeat(
    pool: &SqlitePool,
    worker_id: &str,
    version: &str,
    jobs_done: i64,
) -> Result<(), sqlx::Error> {
    sqlx::query(
        "INSERT INTO worker_heartbeats (worker_id, version, last_tick_at, jobs_done) \
         VALUES (?, ?, ?, ?) \
         ON CONFLICT(worker_id) DO UPDATE SET \
           version = excluded.version, \
           last_tick_at = excluded.last_tick_at, \
           jobs_done = worker_heartbeats.jobs_done + excluded.jobs_done",
    )
    .bind(worker_id)
    .bind(version)
    .bind(iso_now())
    .bind(jobs_done)
    .execute(pool)
    .await?;
    Ok(())
}

#[derive(Debug, Clone, sqlx::FromRow, serde::Serialize)]
pub struct WorkerStatus {
    pub worker_id: String,
    pub version: String,
    pub last_tick_at: String,
    pub jobs_done: i64,
}

pub async fn status(pool: &SqlitePool) -> Result<Vec<WorkerStatus>, sqlx::Error> {
    sqlx::query_as("SELECT worker_id, version, last_tick_at, jobs_done FROM worker_heartbeats ORDER BY worker_id")
        .fetch_all(pool)
        .await
}

/// Run one stage and advance `stage_index` **atomically**: lease renewal and
/// progress commit in a single transaction. Doing them as separate statements
/// costs an fsync each (measured: ~11 jobs/s) and can lose progress.
/// Returns Ok(false) when the lease is no longer ours.
async fn stage_transaction(
    pool: &SqlitePool,
    job_id: i64,
    worker_id: &str,
    stage_index: i64,
    lease_secs: i64,
) -> Result<bool, sqlx::Error> {
    let next = (stage_index + 1).clamp(0, STAGES.len() as i64);
    let next_key = STAGES.get(next as usize).copied().unwrap_or("validation");
    let mut tx = pool.begin().await?;
    let res = sqlx::query(
        "UPDATE jobs SET lease_until = ?, stage_index = ?, stage = ? \
         WHERE id = ? AND locked_by = ? AND status = 'RUNNING'",
    )
    .bind(iso_after(lease_secs))
    .bind(next)
    .bind(next_key)
    .bind(job_id)
    .bind(worker_id)
    .execute(&mut *tx)
    .await?;
    if res.rows_affected() == 0 {
        tx.rollback().await.ok();
        return Ok(false);
    }
    sqlx::query(
        "INSERT INTO job_events (job_id, worker_id, kind, stage_index, detail, at) \
         VALUES (?, ?, 'STAGE_DONE', ?, ?, ?)",
    )
    .bind(job_id)
    .bind(worker_id)
    .bind(stage_index)
    .bind(next_key)
    .bind(iso_now())
    .execute(&mut *tx)
    .await?;
    tx.commit().await?;
    Ok(true)
}

/// Process one claimed job to completion, stage by stage.
/// Run the body of one stage. All six stages are implemented (blueprint,
/// draft, revision, metadata, enrichment, validation/release); the dispatch
/// arms below are 0-based and mirror `stages::run_*`.
async fn run_stage_body(
    pool: &SqlitePool,
    job: &ClaimedJob,
    idx: i64,
    engine: &crate::provider::Engine,
) -> Result<(), String> {
    let now = iso_now();
    let website_id = job.website_id;
    // Crash recovery: a stage that already committed is never re-run and never
    // re-charged. `stage_index` is 0-based (0 = blueprint) while
    // `article_stages.idx` is 1-based — mixing them silently skips a real stage.
    if crate::stages::stage_done(pool, job.id, idx + 1)
        .await
        .map_err(|e| e.to_string())?
    {
        return Ok(());
    }
    match idx {
        0 => {
            let site_name: String = sqlx::query_scalar("SELECT name FROM websites WHERE id = ?")
                .bind(website_id.unwrap_or(job.site_id))
                .fetch_optional(pool)
                .await
                .ok()
                .flatten()
                .unwrap_or_else(|| "the site".to_string());
            crate::stages::run_blueprint(
                pool,
                engine,
                job.id,
                job.site_id,
                website_id,
                &job.keyword,
                &site_name,
                &now,
            )
            .await
            .map(|_| ())
            .map_err(|e| e.to_string())
        }
        1 => crate::stages::run_draft(
            pool,
            engine,
            job.id,
            job.site_id,
            website_id,
            &job.keyword,
            &now,
        )
        .await
        .map(|_| ())
        .map_err(|e| e.to_string()),
        2 => crate::stages::run_revision(
            pool,
            engine,
            job.id,
            job.site_id,
            website_id,
            &job.keyword,
            &now,
        )
        .await
        .map(|_| ())
        .map_err(|e| e.to_string()),
        4 => crate::stages::run_enrichment(
            pool,
            engine,
            job.workspace_id,
            job.id,
            job.site_id,
            website_id,
            &job.keyword,
            &now,
        )
        .await
        .map(|_| ())
        .map_err(|e| e.to_string()),
        3 => crate::stages::run_metadata(
            pool,
            engine,
            job.id,
            job.site_id,
            website_id,
            &job.keyword,
            &now,
        )
        .await
        .map(|_| ())
        .map_err(|e| e.to_string()),
        5 => crate::stages::run_validation(
            pool,
            engine,
            job.id,
            job.site_id,
            website_id,
            &job.keyword,
            &now,
        )
        .await
        .map(|_| ())
        .map_err(|e| e.to_string()),
        _ => Ok(()),
    }
}

pub async fn process_claim(
    pool: &SqlitePool,
    worker_id: &str,
    job: ClaimedJob,
    lease_secs: i64,
) -> Result<(), sqlx::Error> {
    // One engine lookup per job, not per stage.
    let engine = match crate::provider::load_engine(pool, job.workspace_id, "text").await {
        Ok(e) => e,
        Err(e) => {
            fail(pool, job.id, worker_id, &e.to_string()).await?;
            return Ok(());
        }
    };
    let mut idx = job.stage_index;
    while idx < crate::stages::IMPLEMENTED_STAGES {
        if let Err(reason) = run_stage_body(pool, &job, idx, &engine).await {
            fail(pool, job.id, worker_id, &reason).await?;
            return Ok(());
        }
        match stage_transaction(pool, job.id, worker_id, idx, lease_secs).await {
            Ok(true) => idx += 1,
            Ok(false) => return Ok(()), // lease lost: another worker owns this job now
            Err(e) => {
                fail(pool, job.id, worker_id, &e.to_string()).await?;
                return Ok(());
            }
        }
    }
    // Only claim completion when every stage in the pipeline has actually run.
    if crate::stages::IMPLEMENTED_STAGES >= STAGES.len() as i64 {
        complete(pool, job.id, worker_id).await?;
    } else {
        mark_partial(
            pool,
            job.id,
            worker_id,
            &format!(
                "stages 1-{} done; {} of {} stages implemented",
                crate::stages::IMPLEMENTED_STAGES,
                crate::stages::IMPLEMENTED_STAGES,
                STAGES.len()
            ),
        )
        .await?;
    }
    Ok(())
}

/// Finished every implemented stage but the pipeline is not whole yet.
async fn mark_partial(
    pool: &SqlitePool,
    job_id: i64,
    worker_id: &str,
    note: &str,
) -> Result<(), sqlx::Error> {
    let mut tx = pool.begin().await?;
    sqlx::query(
        "UPDATE jobs SET status = 'PARTIAL', locked_by = NULL, lease_until = NULL, \
         last_error = ? WHERE id = ?",
    )
    .bind(note)
    .bind(job_id)
    .execute(&mut *tx)
    .await?;
    sqlx::query(
        "INSERT INTO job_events (job_id, worker_id, kind, stage_index, detail, at) \
         VALUES (?, ?, 'PARTIAL', NULL, ?, ?)",
    )
    .bind(job_id)
    .bind(worker_id)
    .bind(note)
    .bind(iso_now())
    .execute(&mut *tx)
    .await?;
    tx.commit().await
}
/// Claim and process a single job. Returns the job id when work was done.
pub async fn run_once(
    pool: &SqlitePool,
    worker_id: &str,
    lease_secs: i64,
) -> Result<Option<i64>, sqlx::Error> {
    match claim(pool, worker_id, lease_secs).await? {
        Some(job) => {
            let id = job.id;
            // The job's run_id, read before processing: the rollup below must
            // reflect the state this job just reached.
            let run_id: Option<i64> = sqlx::query_scalar("SELECT run_id FROM jobs WHERE id = ?")
                .bind(id)
                .fetch_one(pool)
                .await?;
            process_claim(pool, worker_id, job, lease_secs).await?;
            // Keep the run's status in step with its jobs. Cheap (one UPDATE per
            // run whose status actually changed) and idempotent, so a worker
            // crash between the two leaves the run stale but never wrong.
            if let Some(run_id) = run_id {
                let changed = crate::runs::refresh_run(pool, run_id).await?;
                if changed {
                    tracing::debug!(run_id, "run status rolled up");
                }
            }
            heartbeat(pool, worker_id, "1", 1).await?;
            Ok(Some(id))
        }
        None => {
            heartbeat(pool, worker_id, "1", 0).await?;
            Ok(None)
        }
    }
}

use crate::{ApiError, AppState};
use axum::{extract::State, Json};

pub(crate) async fn worker_status(
    State(st): State<AppState>,
) -> Result<Json<serde_json::Value>, ApiError> {
    let workers = crate::worker::status(&st.pool)
        .await
        .map_err(ApiError::Db)?;
    let fresh = workers
        .iter()
        .any(|w| w.last_tick_at.as_str() > crate::worker::iso_after(-60).as_str());
    Ok(Json(
        serde_json::json!({ "alive": fresh, "workers": workers }),
    ))
}
/// Manual tick (dev + tests): claim and process at most one job.
pub(crate) async fn worker_run_once(
    State(st): State<AppState>,
) -> Result<Json<serde_json::Value>, ApiError> {
    let job = crate::worker::run_once(&st.pool, "manual", crate::worker::DEFAULT_LEASE_SECS)
        .await
        .map_err(ApiError::Db)?;
    Ok(Json(serde_json::json!({ "processed_job": job })))
}

#[cfg(test)]
mod tests {
    use super::*;
    use sqlx::sqlite::SqlitePoolOptions;

    async fn pool() -> SqlitePool {
        // Nothing in the test suite may touch the network: point the image
        // fetcher at a closed port so stage 5 fails fast and deterministically.
        static INIT: std::sync::Once = std::sync::Once::new();
        INIT.call_once(|| std::env::set_var("GAW_BING_BASE", "http://127.0.0.1:9"));
        let p = SqlitePoolOptions::new()
            .max_connections(4)
            .connect("sqlite::memory:")
            .await
            .expect("db");
        sqlx::migrate!("../migrations")
            .run(&p)
            .await
            .expect("migrate");
        sqlx::query(
            "INSERT INTO workspaces (id, name, created_at) VALUES (1,'W','2026-01-01T00:00:00Z')",
        )
        .execute(&p)
        .await
        .unwrap();
        sqlx::query("INSERT INTO sites (id, workspace_id, domain, created_at) VALUES (1,1,'a.com','2026-01-01T00:00:00Z')")
            .execute(&p)
            .await
            .unwrap();
        sqlx::query("INSERT INTO websites (id, workspace_id, name, ghost_mode, created_at) VALUES (1,1,'W','SANDBOX','2026-01-01T00:00:00Z')")
            .execute(&p)
            .await
            .unwrap();
        p
    }

    async fn enqueue(p: &SqlitePool, n: i64) {
        for i in 0..n {
            sqlx::query(
                "INSERT INTO jobs (workspace_id, site_id, website_id, keyword, stage, status, created_at) \
                 VALUES (1, 1, 1, ?, 'blueprint', 'QUEUED', '2026-01-01T00:00:00Z')",
            )
            .bind(format!("kw {i}"))
            .execute(p)
            .await
            .unwrap();
        }
    }

    #[tokio::test]
    async fn claim_locks_and_two_workers_never_share_a_job() {
        let p = pool().await;
        enqueue(&p, 2).await;
        let a = claim(&p, "w1", DEFAULT_LEASE_SECS)
            .await
            .unwrap()
            .expect("job a");
        let b = claim(&p, "w2", DEFAULT_LEASE_SECS)
            .await
            .unwrap()
            .expect("job b");
        assert_ne!(a.id, b.id, "two workers were handed the same job");
        assert!(claim(&p, "w3", DEFAULT_LEASE_SECS).await.unwrap().is_none());
    }

    #[tokio::test]
    async fn expired_lease_is_reclaimed_and_resumes_from_saved_stage() {
        let p = pool().await;
        enqueue(&p, 1).await;
        let job = claim(&p, "w1", DEFAULT_LEASE_SECS).await.unwrap().unwrap();
        // simulate a crash right after the blueprint committed (stage 1 done),
        // with the lease left behind by a worker that never came back
        complete_stage(&p, job.id, "w1", 0).await.unwrap();
        sqlx::query("UPDATE jobs SET lease_until = '2000-01-01T00:00:00Z' WHERE id = ?")
            .bind(job.id)
            .execute(&p)
            .await
            .unwrap();

        // The crash happened after the blueprint committed: seed that stage so
        // the resumed run has real work left (draft) and real work done.
        let blueprint = serde_json::json!({
            "intent": "informational",
            "titleHint": "Resume Test",
            "mustCover": ["a", "b", "c"],
            "sections": [{"heading": "H1"}]
        });
        let article_id: i64 = sqlx::query_scalar(
            "INSERT INTO articles (job_id, site_id, website_id, keyword, title, slug, status, created_at) \
             VALUES (?, 1, 1, 'resume test', 'Resume Test', 'resume-test', 'DRAFTING', ?) RETURNING id",
        )
        .bind(job.id)
        .bind("2026-01-01T00:00:00Z")
        .fetch_one(&p)
        .await
        .unwrap();
        sqlx::query(
            "INSERT INTO article_stages (article_id, idx, key, status, payload_json, started_at, finished_at) \
             VALUES (?, 1, 'blueprint', 'DONE', ?, '2026-01-01T00:00:00Z', '2026-01-01T00:00:00Z')",
        )
        .bind(article_id)
        .bind(serde_json::json!({"blueprint": blueprint}).to_string())
        .execute(&p)
        .await
        .unwrap();

        let resumed = claim(&p, "w2", DEFAULT_LEASE_SECS)
            .await
            .unwrap()
            .expect("reclaimed");
        assert_eq!(resumed.id, job.id, "expired job was not re-claimed");
        assert_eq!(resumed.stage_index, 1, "progress was lost");
        assert_eq!(resumed.attempts, 2, "attempt counter did not advance");

        process_claim(&p, "w2", resumed.clone(), DEFAULT_LEASE_SECS)
            .await
            .unwrap();
        let (status, stage_index): (String, i64) =
            sqlx::query_as("SELECT status, stage_index FROM jobs WHERE id = ?")
                .bind(job.id)
                .fetch_one(&p)
                .await
                .unwrap();
        // All six stages are implemented now, so a job that clears every stage
        // is genuinely COMPLETED — not PARTIAL.
        assert_eq!(status, "COMPLETED");
        assert_eq!(stage_index, 6);

        // the blueprint must not be re-run: w2 records exactly the remaining
        // five stages (draft, revision, metadata, enrichment, validation),
        // never the finished one.
        let redo: i64 = sqlx::query_scalar(
            "SELECT COUNT(*) FROM job_events WHERE job_id = ? AND worker_id = 'w2' AND kind = 'STAGE_DONE'",
        )
        .bind(job.id)
        .fetch_one(&p)
        .await
        .unwrap();
        assert_eq!(redo, 5, "worker re-ran finished stages");
        // The seeded blueprint row never cost anything, so any charge for it
        // would mean w2 redid it.
        let blueprint_charges: i64 =
            sqlx::query_scalar("SELECT COUNT(*) FROM usage_ledger WHERE stage = 'blueprint'")
                .fetch_one(&p)
                .await
                .unwrap();
        assert_eq!(blueprint_charges, 0, "the finished stage was re-charged");
    }

    #[tokio::test]
    async fn failure_backs_off_then_stops_at_max_attempts() {
        let p = pool().await;
        enqueue(&p, 1).await;
        let mut statuses = Vec::new();
        for _ in 0..MAX_ATTEMPTS {
            // let the backoff window pass, as real time would
            sqlx::query(
                "UPDATE jobs SET not_before = '2000-01-01T00:00:00Z' WHERE status = 'RETRY'",
            )
            .execute(&p)
            .await
            .unwrap();
            let job = claim(&p, "w1", DEFAULT_LEASE_SECS)
                .await
                .unwrap()
                .expect("claim");
            statuses.push(
                fail(&p, job.id, "w1", "model returned malformed json")
                    .await
                    .unwrap(),
            );
        }
        assert_eq!(statuses, vec!["RETRY", "RETRY", "FAILED"]);

        // exhausted job never comes back, and the backoff is in the future
        let (status, not_before, err): (String, Option<String>, Option<String>) =
            sqlx::query_as("SELECT status, not_before, last_error FROM jobs WHERE id = 1")
                .fetch_one(&p)
                .await
                .unwrap();
        assert_eq!(status, "FAILED");
        assert_eq!(err.as_deref(), Some("model returned malformed json"));
        assert!(not_before.is_none());
        assert!(claim(&p, "w1", DEFAULT_LEASE_SECS).await.unwrap().is_none());
    }

    #[tokio::test]
    async fn retry_is_not_claimable_before_its_backoff() {
        let p = pool().await;
        enqueue(&p, 1).await;
        let job = claim(&p, "w1", DEFAULT_LEASE_SECS).await.unwrap().unwrap();
        assert_eq!(fail(&p, job.id, "w1", "boom").await.unwrap(), "RETRY");
        assert!(
            claim(&p, "w1", DEFAULT_LEASE_SECS).await.unwrap().is_none(),
            "retry ignored its backoff window"
        );
        // fast-forward the backoff
        sqlx::query("UPDATE jobs SET not_before = '2000-01-01T00:00:00Z' WHERE id = ?")
            .bind(job.id)
            .execute(&p)
            .await
            .unwrap();
        assert!(claim(&p, "w1", DEFAULT_LEASE_SECS).await.unwrap().is_some());
    }

    #[tokio::test]
    async fn renew_lease_extends_ownership_for_long_stages() {
        // A stage can outlive its lease (their draft stage takes ~26 s), so the
        // worker must be able to extend it mid-stage without giving up the job.
        let p = pool().await;
        enqueue(&p, 1).await;
        let job = claim(&p, "w1", DEFAULT_LEASE_SECS)
            .await
            .unwrap()
            .expect("claim");
        let before: String = sqlx::query_scalar("SELECT lease_until FROM jobs WHERE id = ?")
            .bind(job.id)
            .fetch_one(&p)
            .await
            .unwrap();
        assert!(renew_lease(&p, job.id, "w1", DEFAULT_LEASE_SECS * 10)
            .await
            .unwrap());
        let after: String = sqlx::query_scalar("SELECT lease_until FROM jobs WHERE id = ?")
            .bind(job.id)
            .fetch_one(&p)
            .await
            .unwrap();
        assert!(
            after > before,
            "lease should move forward: {before} -> {after}"
        );
        // a different worker may not renew someone else's lease
        assert!(!renew_lease(&p, job.id, "w2", DEFAULT_LEASE_SECS)
            .await
            .unwrap());
    }

    #[tokio::test]
    async fn heartbeat_accumulates_jobs_done() {
        let p = pool().await;
        heartbeat(&p, "w1", "1", 2).await.unwrap();
        heartbeat(&p, "w1", "1", 3).await.unwrap();
        let st = status(&p).await.unwrap();
        assert_eq!(st.len(), 1);
        assert_eq!(st[0].jobs_done, 5);
        assert!(
            st[0].last_tick_at.starts_with("20"),
            "tick: {}",
            st[0].last_tick_at
        );
    }

    #[tokio::test]
    async fn run_once_processes_one_job_and_reports_none_when_drained() {
        let p = pool().await;
        enqueue(&p, 1).await;
        assert_eq!(
            run_once(&p, "w1", DEFAULT_LEASE_SECS).await.unwrap(),
            Some(1)
        );
        assert_eq!(run_once(&p, "w1", DEFAULT_LEASE_SECS).await.unwrap(), None);
    }

    /// The run a job belongs to is rolled up as part of processing it: a batch
    /// that finishes must not leave its run stuck on QUEUED.
    #[tokio::test]
    async fn finishing_a_job_rolls_its_run_up_to_completed() {
        let p = pool().await;
        sqlx::query("INSERT INTO runs (id, website_id, type, status, created_at) VALUES (1,1,'KEYWORDS','QUEUED','2026-01-01T00:00:00Z')")
            .execute(&p)
            .await
            .unwrap();
        enqueue(&p, 1).await;
        sqlx::query("UPDATE jobs SET run_id = 1 WHERE id = 1")
            .execute(&p)
            .await
            .unwrap();

        run_once(&p, "w1", DEFAULT_LEASE_SECS).await.unwrap();

        let (job_status, run_status): (String, String) = sqlx::query_as(
            "SELECT j.status, r.status FROM jobs j JOIN runs r ON r.id = j.run_id WHERE j.id = 1",
        )
        .fetch_one(&p)
        .await
        .unwrap();
        assert_eq!(job_status, "COMPLETED");
        assert_eq!(
            run_status, "COMPLETED",
            "the run must roll up when its last job settles"
        );

        // A second pass over a settled run changes nothing.
        assert!(!crate::runs::refresh_run(&p, 1).await.unwrap());
    }

    #[tokio::test]
    async fn a_stage_that_already_committed_is_not_rerun_or_recharged() {
        let p = pool().await;
        enqueue(&p, 1).await;
        let job = claim(&p, "w1", DEFAULT_LEASE_SECS).await.unwrap().unwrap();

        // Stage 1 runs and commits, then the worker "dies" before advancing
        // stage_index — the exact window a SIGKILL produces.
        let engine = crate::provider::Engine::Mock(crate::provider::MockEngine {
            model_id: "mock-1".into(),
        });
        crate::stages::run_blueprint(
            &p,
            &engine,
            job.id,
            1,
            Some(1),
            "keyword",
            "Site",
            "2026-01-01T00:00:00Z",
        )
        .await
        .expect("blueprint");
        let ledger_after_first: i64 = sqlx::query_scalar("SELECT COUNT(*) FROM usage_ledger")
            .fetch_one(&p)
            .await
            .unwrap();

        // Same job, still stage_index 0: the worker must skip, not redo.
        process_claim(&p, "w1", job.clone(), DEFAULT_LEASE_SECS)
            .await
            .unwrap();

        let ledger_now: i64 = sqlx::query_scalar("SELECT COUNT(*) FROM usage_ledger")
            .fetch_one(&p)
            .await
            .unwrap();
        // New charges for every remaining stage (draft, revision, metadata,
        // enrichment, validation) — never a second blueprint. Stages 5 and 6
        // bill zero tokens, so the ledger only gains model-driven rows.
        assert!(ledger_now > ledger_after_first, "no stage was charged");
        let blueprint_charges: i64 =
            sqlx::query_scalar("SELECT COUNT(*) FROM usage_ledger WHERE stage = 'blueprint'")
                .fetch_one(&p)
                .await
                .unwrap();
        assert_eq!(blueprint_charges, 1, "the committed stage was re-charged");
        let rows: Vec<(i64, String)> =
            sqlx::query_as("SELECT idx, key FROM article_stages ORDER BY idx")
                .fetch_all(&p)
                .await
                .unwrap();
        assert_eq!(
            rows,
            vec![
                (1, "blueprint".to_string()),
                (2, "draft".to_string()),
                (3, "revision".to_string()),
                (4, "metadata".to_string()),
                (5, "enrichment".to_string()),
                (6, "validation".to_string()),
            ],
            "stage rows after a crash-recovered run"
        );
        let done: i64 =
            sqlx::query_scalar("SELECT COUNT(*) FROM article_stages WHERE status = 'DONE'")
                .fetch_one(&p)
                .await
                .unwrap();
        assert_eq!(done, 6, "a stage was skipped instead of run");
    }

    #[tokio::test]
    async fn concurrent_workers_do_not_double_process() {
        let p = pool().await;
        enqueue(&p, 20).await;
        let mut handles = Vec::new();
        for w in 0..4 {
            let pool = p.clone();
            handles.push(tokio::spawn(async move {
                let wid = format!("w{w}");
                let mut done = 0;
                while run_once(&pool, &wid, DEFAULT_LEASE_SECS)
                    .await
                    .unwrap()
                    .is_some()
                {
                    done += 1;
                }
                done
            }));
        }
        let mut total = 0;
        for h in handles {
            total += h.await.unwrap();
        }
        assert_eq!(total, 20, "jobs were processed twice or dropped");
        let terminal: i64 =
            sqlx::query_scalar("SELECT COUNT(*) FROM jobs WHERE status = 'COMPLETED'")
                .fetch_one(&p)
                .await
                .unwrap();
        assert_eq!(terminal, 20, "every job reached its terminal state");
    }

    /// End-to-end: a fresh job runs all six stages in one `run_once` and the
    /// article row is genuinely finalized by stage 6 — six stage rows, the
    /// status the site's ghost_mode implies, and real prose with a stored
    /// uniqueness/coverage measurement. This is the test that fails if stage 6
    /// is unwired (the job would stop at PARTIAL and the article would still be
    /// REVIEW_HELD with no content).
    #[tokio::test]
    async fn the_full_six_stage_run_finalizes_the_article() {
        let p = pool().await;
        enqueue(&p, 1).await;
        // The engine is mocked (no network, no ai_keys), exactly as the pipeline
        // tests do; SANDBOX + no ghost_url means publish is held, not pushed.
        run_once(&p, "w1", DEFAULT_LEASE_SECS).await.unwrap();

        let (status, stage_index): (String, i64) =
            sqlx::query_as("SELECT status, stage_index FROM jobs WHERE id = 1")
                .fetch_one(&p)
                .await
                .unwrap();
        assert_eq!(status, "COMPLETED", "job did not finish the whole pipeline");
        assert_eq!(stage_index, 6);

        let stages: Vec<(i64, String, String)> =
            sqlx::query_as("SELECT idx, key, status FROM article_stages ORDER BY idx")
                .fetch_all(&p)
                .await
                .unwrap();
        assert_eq!(stages.len(), 6, "a stage never committed: {stages:?}");
        for (idx, key, st) in &stages {
            assert_eq!(st, "DONE", "stage {idx} ({key}) is not DONE");
        }
        assert_eq!(
            stages
                .iter()
                .map(|(_, k, _)| k.as_str())
                .collect::<Vec<_>>(),
            vec![
                "blueprint",
                "draft",
                "revision",
                "metadata",
                "enrichment",
                "validation"
            ]
        );

        // The article itself must be finalized by stage 6, not left mid-draft.
        let (art_status, content, slug, uniqueness, coverage, intent): (
            String,
            Option<String>,
            String,
            Option<f64>,
            Option<f64>,
            Option<f64>,
        ) = sqlx::query_as(
            "SELECT status, content_json, slug, uniqueness_score, coverage_score, intent_match \
             FROM articles WHERE job_id = 1",
        )
        .fetch_one(&p)
        .await
        .unwrap();
        // SANDBOX: their pipeline stores the post as a draft, never live.
        assert_eq!(art_status, "DRAFT", "SANDBOX article must not publish live");
        assert!(!slug.is_empty(), "stage 6 must persist a slug");
        let content = content.expect("stage 6 must store the final markdown");
        let parsed: serde_json::Value = serde_json::from_str(&content).unwrap();
        let markdown = parsed["markdown"].as_str().expect("markdown key");
        // The quality contract: draft prompt targets 2000 words (2400 aim) and
        // the one-shot expansion pass fires under the floor. The stored final
        // article must clear the floor, not the old trivial-length regression.
        assert!(
            markdown.split_whitespace().count() >= 2000,
            "final article is under the 2000-word floor: {} words",
            markdown.split_whitespace().count()
        );
        // Both numbers are real measurements, not defaults.
        assert!(uniqueness.is_some(), "uniqueness was not measured");
        assert!(coverage.is_some(), "coverage was not measured");
        assert!(intent.is_some(), "intent match was not measured");

        // The stage-6 payload records the release decision for the audit trail.
        let payload: String = sqlx::query_scalar(
            "SELECT payload_json FROM article_stages WHERE idx = 6 AND status = 'DONE'",
        )
        .fetch_one(&p)
        .await
        .unwrap();
        let payload: serde_json::Value = serde_json::from_str(&payload).unwrap();
        // SANDBOX with no Ghost wired: nothing was pushed and nothing was held
        // for a push — the article is simply a draft. `push` is null, and the
        // result field carries the real outcome.
        assert!(payload["push"].is_null(), "no Ghost was wired: {payload}");
        assert_eq!(payload["result"], "DRAFT", "{payload}");
        assert_eq!(payload["links"], 0, "no siblings to link to: {payload}");
    }

    /// Re-running a finished job must not re-run or re-charge stage 6: the
    /// stage-`done` guard is what stops a double publish on a resumed lease.
    #[tokio::test]
    async fn stage_six_is_not_rerun_or_republished() {
        let p = pool().await;
        enqueue(&p, 1).await;
        run_once(&p, "w1", DEFAULT_LEASE_SECS).await.unwrap();
        let first_events: i64 =
            sqlx::query_scalar("SELECT COUNT(*) FROM job_events WHERE kind = 'STAGE_DONE'")
                .fetch_one(&p)
                .await
                .unwrap();
        assert_eq!(first_events, 6);

        // A worker that claims the already-finished job must do nothing.
        let finished = claim(&p, "w2", DEFAULT_LEASE_SECS).await.unwrap();
        assert!(finished.is_none(), "a COMPLETED job was re-claimable");

        let stage6_rows: i64 =
            sqlx::query_scalar("SELECT COUNT(*) FROM article_stages WHERE idx = 6")
                .fetch_one(&p)
                .await
                .unwrap();
        assert_eq!(stage6_rows, 1, "stage 6 committed twice");
    }

    /// The connection the operator saved in the studio must reach the worker.
    ///
    /// Nothing writes `websites.ghost_*`, so the publish stage resolves the
    /// connection from the synced snapshot (`sites.client_uid` is the bridge).
    /// Before that every LIVE run answered `Unconfigured` and held its article,
    /// so Ghost was never attempted at all and this is the first proof that a
    /// real push happens end to end.
    #[tokio::test]
    async fn a_ghost_connection_saved_in_the_studio_is_used_by_the_worker() {
        use tokio::io::{AsyncReadExt, AsyncWriteExt};

        let p = pool().await;

        // A stub Ghost that accepts the post.
        let listener = tokio::net::TcpListener::bind("127.0.0.1:0").await.unwrap();
        let port = listener.local_addr().unwrap().port();
        let stub = tokio::spawn(async move {
            let (mut sock, _) = listener.accept().await.unwrap();
            let mut buf = vec![0u8; 8192];
            let _ = sock.read(&mut buf).await.unwrap();
            let body = r#"{"post":{"id":"gh_1","url":"https://cms.example/p/gh-1"}}"#;
            let response = format!(
                "HTTP/1.1 201 Created\r\ncontent-type: application/json\r\ncontent-length: {}\r\nconnection: close\r\n\r\n{body}",
                body.len(),
            );
            sock.write_all(response.as_bytes()).await.unwrap();
            sock.flush().await.unwrap();
        });

        // The studio's saved connection, shaped exactly as the browser syncs it:
        // the site carries `ghost` (admin key included) and `client_uid` is that
        // site's id in the snapshot.
        let state = serde_json::json!({
            "sites": [{
                "id": "s1",
                "ghost": {
                    "mode": "live",
                    "status": "connected",
                    "url": format!("http://127.0.0.1:{port}"),
                    "adminKey": "64f1b2c3d4e5f607:00112233445566778899aabbccddeeff00112233445566778899aabbccddeeff"
                }
            }]
        });
        sqlx::query("UPDATE sites SET client_uid = 's1' WHERE id = 1")
            .execute(&p)
            .await
            .unwrap();
        sqlx::query(
            "INSERT INTO app_state (workspace_id, generation, payload, updated_at) VALUES (1, 1, ?, '2026-01-01T00:00:00Z')",
        )
        .bind(state.to_string())
        .execute(&p)
        .await
        .unwrap();

        enqueue(&p, 1).await;
        run_once(&p, "w1", DEFAULT_LEASE_SECS).await.unwrap();
        stub.await.unwrap();

        let (status, post_id): (String, Option<String>) =
            sqlx::query_as("SELECT status, ghost_post_id FROM articles WHERE site_id = 1")
                .fetch_one(&p)
                .await
                .unwrap();
        assert_eq!(
            status, "PUBLISHED",
            "a connection saved in the studio must be pushed with"
        );
        assert_eq!(post_id.as_deref(), Some("gh_1"));
    }

    /// Stage 5 must spend, and the links its model picks must reach the article.
    ///
    /// The stage used to be free: no model call at all, a payload that said
    /// SKIPPED_NO_SITE_INDEX, and stage 6 fell back to anchors assembled from
    /// titles — the operator saw a step that never consumed a token.
    #[tokio::test]
    async fn site_enrichment_spends_and_its_links_land_in_the_article() {
        let p = pool().await;
        // An earlier, finished job that left a published page behind — the page the
        // model is allowed to link to. Its title is deliberately unrelated to the
        // article's, so the L2 gate has nothing to refuse. It carries its own job
        // so the run under test cannot adopt the row as its own article.
        sqlx::query(
            "INSERT INTO jobs (workspace_id, site_id, website_id, keyword, stage, status, created_at) \
             VALUES (1, 1, 1, 'campus parking', 'validation', 'COMPLETED', '2025-12-01T00:00:00Z')",
        )
        .execute(&p)
        .await
        .unwrap();
        sqlx::query(
            "INSERT INTO articles (job_id, site_id, title, slug, status, created_at) \
             SELECT MAX(id), site_id, 'Campus Parking Rules That Matter', \
             'campus-parking-rules', 'PUBLISHED', '2025-12-02T00:00:00Z' FROM jobs",
        )
        .execute(&p)
        .await
        .unwrap();
        enqueue(&p, 1).await;
        let seeded: i64 =
            sqlx::query_scalar("SELECT COUNT(*) FROM articles WHERE slug = 'campus-parking-rules'")
                .fetch_one(&p)
                .await
                .unwrap();
        assert_eq!(seeded, 1, "the sibling row must be visible to the worker");

        run_once(&p, "w1", DEFAULT_LEASE_SECS).await.unwrap();

        let stage5: i64 = sqlx::query_scalar(
            "SELECT COALESCE(SUM(tokens_in + tokens_out), 0) FROM usage_ledger \
             WHERE stage = 'enrichment'",
        )
        .fetch_one(&p)
        .await
        .unwrap();
        assert!(stage5 > 0, "stage 5 must not be a free step");

        let (slug, content): (String, String) = sqlx::query_as(
            "SELECT slug, content_json FROM articles WHERE slug != 'campus-parking-rules'",
        )
        .fetch_one(&p)
        .await
        .unwrap();
        assert!(!slug.is_empty(), "the article should have finalized");
        assert!(
            content.contains("campus-parking-rules"),
            "the model's link must be in the final markdown"
        );
        let edges: i64 = sqlx::query_scalar(
            "SELECT COUNT(*) FROM article_links WHERE target_slug = 'campus-parking-rules'",
        )
        .fetch_one(&p)
        .await
        .unwrap();
        assert_eq!(edges, 1, "the chosen link must be recorded as an edge");
    }

    /// A Ghost that answers and REFUSES the push must hold the article, not fail
    /// the stage. The body is sealed either way, so failing the run threw away a
    /// fully written, fully billed article and left the row with no content for
    /// any other delivery channel — the static build included.
    #[tokio::test]
    async fn a_refused_ghost_push_holds_the_article_instead_of_failing_it() {
        use tokio::io::{AsyncReadExt, AsyncWriteExt};

        let p = pool().await;

        // A stub Ghost: read the request, answer like Ghost does when the key
        // is unknown. One connection is all this test needs.
        let listener = tokio::net::TcpListener::bind("127.0.0.1:0").await.unwrap();
        let port = listener.local_addr().unwrap().port();
        let stub = tokio::spawn(async move {
            let (mut sock, _) = listener.accept().await.unwrap();
            let mut buf = vec![0u8; 8192];
            let _ = sock.read(&mut buf).await.unwrap();
            let body = r#"{"errors":[{"message":"Unknown Admin API Key"}]}"#;
            let response = format!(
                "HTTP/1.1 401 Unauthorized\r\ncontent-type: application/json\r\ncontent-length: {}\r\nconnection: close\r\n\r\n{body}",
                body.len()
            );
            sock.write_all(response.as_bytes()).await.unwrap();
            sock.flush().await.unwrap();
        });

        // LIVE mode, a reachable origin, a well-formed Admin key. The test-only
        // relaxation in `validate_ghost_url` admits this loopback origin; a
        // release build still refuses it.
        sqlx::query(
            "UPDATE websites SET ghost_mode = 'LIVE', ghost_url = ?, ghost_admin_key_enc = ? WHERE id = 1",
        )
        .bind(format!("http://127.0.0.1:{port}"))
        .bind("64f1b2c3d4e5f607:00112233445566778899aabbccddeeff00112233445566778899aabbccddeeff")
        .execute(&p)
        .await
        .unwrap();

        enqueue(&p, 1).await;
        run_once(&p, "w1", DEFAULT_LEASE_SECS).await.unwrap();
        stub.await.unwrap();

        let (status, content): (String, Option<String>) =
            sqlx::query_as("SELECT status, content_json FROM articles WHERE site_id = 1")
                .fetch_one(&p)
                .await
                .unwrap();
        assert_eq!(
            status, "REVIEW_HELD",
            "a refused push must hold the article, never discard it"
        );
        assert!(
            content.is_some(),
            "the sealed content must survive so another channel can ship it"
        );

        let job: String = sqlx::query_scalar("SELECT status FROM jobs WHERE id = 1")
            .fetch_one(&p)
            .await
            .unwrap();
        assert_eq!(job, "COMPLETED", "a refused push must not fail the job");

        let payload: String =
            sqlx::query_scalar("SELECT payload_json FROM article_stages WHERE idx = 6")
                .fetch_one(&p)
                .await
                .unwrap();
        assert!(
            payload.contains("ghost push failed"),
            "the hold reason must be recorded on the stage: {payload}"
        );
        assert!(
            payload.contains("Unknown Admin API Key"),
            "Ghost's own message must reach the record, not a fixed sentence: {payload}"
        );
    }

    #[test]
    fn iso_format_is_sortable_and_correct() {
        assert_eq!(iso_from_epoch(0), "1970-01-01T00:00:00Z");
        assert_eq!(iso_from_epoch(1_700_000_000), "2023-11-14T22:13:20Z");
        assert!(iso_from_epoch(1_700_000_000) < iso_from_epoch(1_700_000_060));
    }
}
