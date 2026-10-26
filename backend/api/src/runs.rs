//! Run rollups — the run-level status derived from its jobs.
//!
//! Ported from the TS engine's `rollup()`. A "run" is one intake (a batch of
//! keywords, or a topic plan) and its status is a pure function of the jobs it
//! produced: that is what the UI's progress column and the run badge read, and
//! it must never be stored as an independent field that can drift from the jobs
//! it summarizes.
//!
//! Status vocabulary note: the TS side uses lowercase job statuses
//! (`queued`/`running`/`completed`/`failed`/`refused`/`cancelled`/
//! `review-held`/`publish-held`); this crate stores them uppercase
//! (`QUEUED`/`RUNNING`/`COMPLETED`/`PARTIAL`/`FAILED`/`REFUSED`/`CANCELLED`/
//! `REVIEW_HELD`/`PUBLISH_HELD`/`RETRY`/`PENDING`). Comparison is done on the
//! uppercased form so a row written by either pipeline rolls up correctly.
//!
//! `depsResolved` is deliberately **not** ported: it needs a `jobs.depends_on`
//! column, and no migration declares one. Adding the function without the
//! column would be dead code that silently never gates anything.

/// A job that produced an article the gate let through (with or without a live
/// push). `REVIEW_HELD`/`PUBLISH_HELD` are deliberately *not* "ok" — the words
/// exist but a human still has to release them, which is the difference between
/// a `completed` run and a `partial` one.
fn is_ok(status: &str) -> bool {
    status.eq_ignore_ascii_case("COMPLETED")
}

fn is_held(status: &str) -> bool {
    matches!(
        status.to_uppercase().as_str(),
        "REVIEW_HELD" | "PUBLISH_HELD"
    )
}

fn is_active(status: &str) -> bool {
    matches!(
        status.to_uppercase().as_str(),
        "RUNNING" | "QUEUED" | "RETRY" | "PENDING"
    )
}

/// The run status for a set of jobs — the port of the TS `rollup()`.
///
/// - no jobs at all is `FAILED` (an empty run is not a success);
/// - any job still moving makes the run `running`, or `queued` when nothing has
///   started yet;
/// - all ok is `completed`; ok + held is `partial` (release is pending);
/// - nothing ok and nothing held is `cancelled` only when *every* job was
///   cancelled, otherwise `failed`;
/// - any other mixture is `partial`.
pub fn rollup<I, S>(statuses: I) -> String
where
    I: IntoIterator<Item = S>,
    S: AsRef<str>,
{
    let statuses: Vec<String> = statuses
        .into_iter()
        .map(|s| s.as_ref().to_uppercase())
        .collect();
    if statuses.is_empty() {
        return "FAILED".to_string();
    }
    if statuses.iter().any(|s| is_active(s)) {
        // Something started → running. All still waiting → queued.
        let started = statuses
            .iter()
            .any(|s| !s.eq_ignore_ascii_case("QUEUED") && !s.eq_ignore_ascii_case("PENDING"));
        return if started { "RUNNING" } else { "QUEUED" }.to_string();
    }
    let ok = statuses.iter().filter(|s| is_ok(s)).count();
    let held = statuses.iter().filter(|s| is_held(s)).count();
    if ok == statuses.len() {
        return "COMPLETED".to_string();
    }
    if ok + held == statuses.len() {
        return "PARTIAL".to_string();
    }
    if ok == 0 && held == 0 {
        return if statuses.iter().all(|s| s == "CANCELLED") {
            "CANCELLED".to_string()
        } else {
            "FAILED".to_string()
        };
    }
    "PARTIAL".to_string()
}

/// Roll up one run's status from its jobs. Returns true when the stored status
/// actually changed — a rollup is a derived value, so writing the same value
/// again is skipped rather than counted as activity.
pub async fn refresh_run(pool: &sqlx::SqlitePool, run_id: i64) -> Result<bool, sqlx::Error> {
    let statuses: Vec<String> =
        sqlx::query_scalar("SELECT status FROM jobs WHERE run_id = ? ORDER BY id")
            .bind(run_id)
            .fetch_all(pool)
            .await?;
    let next = rollup(statuses);
    let res = sqlx::query("UPDATE runs SET status = ? WHERE id = ? AND status != ?")
        .bind(&next)
        .bind(run_id)
        .bind(&next)
        .execute(pool)
        .await?;
    Ok(res.rows_affected() > 0)
}

#[cfg(test)]
mod tests {
    use super::*;

    fn r(items: &[&str]) -> String {
        rollup(items.iter().copied())
    }

    #[test]
    fn an_empty_run_is_a_failure_not_a_success() {
        assert_eq!(r(&[]), "FAILED");
    }

    #[test]
    fn all_queued_is_queued_and_anything_started_is_running() {
        assert_eq!(r(&["QUEUED", "QUEUED"]), "QUEUED");
        assert_eq!(r(&["QUEUED", "RUNNING"]), "RUNNING");
        assert_eq!(r(&["RUNNING", "COMPLETED"]), "RUNNING");
        // A retry still waiting its backoff is active work, not a finish.
        assert_eq!(r(&["COMPLETED", "RETRY"]), "RUNNING");
    }

    #[test]
    fn every_job_ok_is_a_completed_run() {
        assert_eq!(r(&["COMPLETED"]), "COMPLETED");
        assert_eq!(r(&["COMPLETED", "COMPLETED", "COMPLETED"]), "COMPLETED");
    }

    #[test]
    fn held_work_makes_the_run_partial_not_completed() {
        // The words are written but a human has to release them.
        assert_eq!(r(&["COMPLETED", "REVIEW_HELD"]), "PARTIAL");
        assert_eq!(r(&["COMPLETED", "PUBLISH_HELD"]), "PARTIAL");
        assert_eq!(r(&["REVIEW_HELD"]), "PARTIAL");
    }

    #[test]
    fn nothing_ok_and_nothing_held_is_cancelled_only_when_all_cancelled() {
        assert_eq!(r(&["CANCELLED", "CANCELLED"]), "CANCELLED");
        assert_eq!(r(&["CANCELLED", "FAILED"]), "FAILED");
        assert_eq!(r(&["FAILED", "FAILED"]), "FAILED");
        // A refusal is a legitimate gate outcome, not an ok and not a cancel.
        assert_eq!(r(&["REFUSED", "REFUSED"]), "FAILED");
    }

    #[test]
    fn mixed_outcomes_are_partial() {
        assert_eq!(r(&["COMPLETED", "FAILED"]), "PARTIAL");
        assert_eq!(r(&["COMPLETED", "REFUSED"]), "PARTIAL");
        assert_eq!(r(&["COMPLETED", "CANCELLED"]), "PARTIAL");
    }

    #[test]
    fn the_rollup_is_case_insensitive_so_either_pipeline_writes_the_same_run() {
        // The TS side stores lowercase statuses; the rollup must not care.
        assert_eq!(r(&["completed", "Completed"]), "COMPLETED");
        assert_eq!(r(&["queued"]), "QUEUED");
        assert_eq!(rollup(vec!["completed", "publish-held"]), "PARTIAL");
    }

    /// The rollup is only correct against the real schema if `refresh_run`
    /// finds the jobs a run actually owns and writes back only real changes.
    #[tokio::test]
    async fn refresh_run_derives_each_runs_status_from_its_jobs() {
        use sqlx::sqlite::SqlitePoolOptions;
        // One connection: an in-memory DB is private per connection, so the
        // migrations and the queries below must share it.
        let p = SqlitePoolOptions::new()
            .max_connections(1)
            .connect("sqlite::memory:")
            .await
            .expect("db");
        sqlx::migrate!("../migrations")
            .run(&p)
            .await
            .expect("migrate");
        sqlx::query(
            "INSERT INTO workspaces (id,name,created_at) VALUES (1,'W','2026-01-01T00:00:00Z')",
        )
        .execute(&p)
        .await
        .unwrap();
        sqlx::query("INSERT INTO sites (id,workspace_id,domain,created_at) VALUES (1,1,'a.com','2026-01-01T00:00:00Z')")
            .execute(&p)
            .await
            .unwrap();
        sqlx::query("INSERT INTO websites (id,workspace_id,name,created_at) VALUES (1,1,'W','2026-01-01T00:00:00Z')")
            .execute(&p)
            .await
            .unwrap();
        // run 1: all jobs complete. run 2: one held. run 3: no jobs at all.
        for id in 1..=3 {
            sqlx::query(
                "INSERT INTO runs (id,website_id,type,status,created_at) \
                 VALUES (?,1,'KEYWORDS','QUEUED','2026-01-01T00:00:00Z')",
            )
            .bind(id)
            .execute(&p)
            .await
            .unwrap();
        }
        for (job_id, run_id, status) in [
            (1i64, 1i64, "COMPLETED"),
            (2, 1, "COMPLETED"),
            (3, 2, "COMPLETED"),
            (4, 2, "REVIEW_HELD"),
        ] {
            sqlx::query(
                "INSERT INTO jobs (id,workspace_id,site_id,website_id,run_id,keyword,stage,status,created_at) \
                 VALUES (?,1,1,1,?,?,'blueprint',?,'2026-01-01T00:00:00Z')",
            )
            .bind(job_id)
            .bind(run_id)
            .bind(format!("kw {job_id}"))
            .bind(status)
            .execute(&p)
            .await
            .unwrap();
        }

        let wrote: Vec<bool> = {
            let mut v = Vec::new();
            for id in 1..=3 {
                v.push(refresh_run(&p, id).await.unwrap());
            }
            v
        };
        assert_eq!(
            wrote,
            vec![true, true, true],
            "every run's status changed once"
        );

        let got: Vec<(i64, String)> = sqlx::query_as("SELECT id, status FROM runs ORDER BY id")
            .fetch_all(&p)
            .await
            .unwrap();
        assert_eq!(
            got,
            vec![
                (1, "COMPLETED".to_string()),
                (2, "PARTIAL".to_string()),
                (3, "FAILED".to_string()),
            ]
        );

        // Second pass: nothing changed, so nothing is written.
        for id in 1..=3 {
            assert!(
                !refresh_run(&p, id).await.unwrap(),
                "a no-op rollup wrote rows"
            );
        }
    }
}
