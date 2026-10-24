//! Read side of the server-run pipeline.
//!
//! The browser used to execute the whole pipeline itself: `engine.advance()`
//! walked every job through its six stages inside a `setInterval` tick, which
//! meant a run only progressed while a tab was open and cost the user's machine
//! the gating, image fetches and generation work.
//!
//! The Rust worker already runs those stages (`worker::process_claim` →
//! `stages::run_*`), persisting progress after each one. What was missing was a
//! way for the UI to see that progress. This module is that read path.
//!
//! One endpoint returns the whole run view rather than three separate lists:
//! the tick polls it repeatedly while a queue drains, and a single consistent
//! snapshot avoids the torn reads (jobs newer than their articles) that three
//! independent requests would produce.

use axum::{extract::Query, extract::State, Json};
use serde::{Deserialize, Serialize};
use std::collections::HashMap;

use crate::ApiError;

#[derive(Debug, Serialize, Deserialize, sqlx::FromRow)]
pub struct JobProgress {
    pub id: i64,
    /// Null for jobs enqueued by bare keyword intake, which does not create a run.
    pub run_id: Option<i64>,
    pub site_id: i64,
    pub keyword: String,
    pub status: String,
    pub stage: String,
    pub stage_index: i64,
    pub attempts: i64,
    pub last_error: Option<String>,
    /// Article this job produced, if any stage has committed one.
    pub article_id: Option<i64>,
    /// Summed from the usage ledger; zero for stages that make no model call.
    pub tokens_in: i64,
    pub tokens_out: i64,
    pub cost_usd: f64,
}

#[derive(Debug, Serialize, Deserialize, sqlx::FromRow)]
pub struct ArticleSummary {
    pub id: i64,
    pub job_id: Option<i64>,
    pub site_id: i64,
    pub title: String,
    pub slug: String,
    pub keyword: String,
    pub status: String,
    pub created_at: Option<String>,
    pub engine: Option<String>,
    pub uniqueness_score: Option<f64>,
    pub intent_match: Option<f64>,
    pub coverage_score: Option<f64>,
    pub featured_image_url: Option<String>,
    pub featured_alt: Option<String>,
    /// Full article payload (sections, faq, html). The UI renders from this.
    pub content_json: Option<String>,
    pub meta_json: Option<String>,
}

#[derive(Debug, Serialize, Deserialize, sqlx::FromRow)]
pub struct RunSummary {
    pub id: i64,
    pub status: String,
    pub created_at: Option<String>,
    pub completed_at: Option<String>,
    pub total: i64,
    pub completed: i64,
    pub failed: i64,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct PipelineState {
    pub jobs: Vec<JobProgress>,
    pub articles: Vec<ArticleSummary>,
    pub runs: Vec<RunSummary>,
    /// True while any job is queued or running, so the client can stop polling
    /// instead of hammering an idle workspace forever.
    pub active: bool,
}

fn param(params: &HashMap<String, String>, key: &str) -> Option<i64> {
    params.get(key).and_then(|v| v.parse().ok())
}

/// GET /api/v1/pipeline/state?workspace_id=1&site_id=1
///
/// `workspace_id` is required in practice — it scopes every query. `site_id`
/// narrows to one site, which is what a single-site view wants.
pub async fn pipeline_state(
    State(st): State<crate::AppState>,
    Query(params): Query<HashMap<String, String>>,
) -> Result<Json<PipelineState>, ApiError> {
    let workspace_id = param(&params, "workspace_id").unwrap_or(1);
    let site_id = param(&params, "site_id");
    let limit = param(&params, "limit").unwrap_or(200).clamp(1, 1000);

    // Jobs, with their article and spend attached. The two LEFT JOINs keep a
    // fresh job visible (article not yet written) and a spendless job visible
    // (no model calls yet) — an INNER JOIN here would hide work in progress,
    // which is exactly when the UI needs to show it.
    let jobs: Vec<JobProgress> = sqlx::query_as(
        "SELECT j.id,
                j.run_id,
                j.site_id,
                j.keyword,
                j.status,
                j.stage,
                j.stage_index,
                j.attempts,
                j.last_error,
                (SELECT a.id FROM articles a WHERE a.job_id = j.id
                  ORDER BY a.id DESC LIMIT 1) AS article_id,
                COALESCE(spend.tokens_in, 0)  AS tokens_in,
                COALESCE(spend.tokens_out, 0) AS tokens_out,
                COALESCE(spend.cost_usd, 0.0) AS cost_usd
           FROM jobs j
           LEFT JOIN (
                SELECT a.job_id,
                       SUM(u.tokens_in)  AS tokens_in,
                       SUM(u.tokens_out) AS tokens_out,
                       SUM(u.cost_usd)   AS cost_usd
                  FROM usage_ledger u
                  JOIN articles a ON a.id = u.article_id
                 GROUP BY a.job_id
           ) spend ON spend.job_id = j.id
          WHERE j.workspace_id = ?1
            AND (?2 IS NULL OR j.site_id = ?2)
          ORDER BY j.id DESC
          LIMIT ?3",
    )
    .bind(workspace_id)
    .bind(site_id)
    .bind(limit)
    .fetch_all(&st.pool)
    .await
    .map_err(ApiError::Db)?;

    let articles: Vec<ArticleSummary> = sqlx::query_as(
        "SELECT id, job_id, site_id, title, slug, keyword, status, created_at,
                engine, uniqueness_score, intent_match, coverage_score,
                featured_image_url, featured_alt, content_json, meta_json
           FROM articles
          WHERE site_id IN (SELECT id FROM sites WHERE workspace_id = ?1)
            AND (?2 IS NULL OR site_id = ?2)
          ORDER BY id DESC
          LIMIT ?3",
    )
    .bind(workspace_id)
    .bind(site_id)
    .bind(limit)
    .fetch_all(&st.pool)
    .await
    .map_err(ApiError::Db)?;

    let runs: Vec<RunSummary> = sqlx::query_as(
        "SELECT r.id,
                r.status,
                r.created_at,
                r.completed_at,
                COUNT(j.id) AS total,
                COALESCE(SUM(CASE WHEN j.status = 'COMPLETED' THEN 1 ELSE 0 END), 0) AS completed,
                COALESCE(SUM(CASE WHEN j.status = 'FAILED'   THEN 1 ELSE 0 END), 0) AS failed
           FROM runs r
           JOIN websites w ON w.id = r.website_id
           LEFT JOIN jobs j ON j.run_id = r.id
          WHERE w.workspace_id = ?1
            AND (?3 IS NULL OR r.website_id IN (
                  SELECT COALESCE(website_id, id) FROM sites WHERE id = ?3))
          GROUP BY r.id
          ORDER BY r.id DESC
          LIMIT ?2",
    )
    .bind(workspace_id)
    .bind(limit)
    .bind(site_id)
    .fetch_all(&st.pool)
    .await
    .map_err(ApiError::Db)?;

    let active = jobs.iter().any(|j| {
        let s = j.status.to_ascii_uppercase();
        s == "QUEUED" || s == "RUNNING" || s == "CLAIMED"
    });

    Ok(Json(PipelineState {
        jobs,
        articles,
        runs,
        active,
    }))
}

#[cfg(test)]
mod tests {
    use super::*;
    use axum::body::Body;
    use axum::http::{Request, StatusCode};
    use axum::routing::get;
    use axum::Router;
    use sqlx::sqlite::SqlitePoolOptions;
    use sqlx::SqlitePool;
    use tower::ServiceExt;

    /// Same schema the migrations produce for the tables this module reads.
    /// Kept explicit so a column rename here fails loudly in tests.
    async fn pool() -> SqlitePool {
        let pool = SqlitePoolOptions::new()
            .max_connections(1)
            .connect("sqlite::memory:")
            .await
            .unwrap();
        for sql in [
            "CREATE TABLE sites (id INTEGER PRIMARY KEY, workspace_id INTEGER NOT NULL,
                 domain TEXT NOT NULL, created_at TEXT, client_uid TEXT, website_id INTEGER)",
            "CREATE TABLE websites (id INTEGER PRIMARY KEY, workspace_id INTEGER NOT NULL,
                 name TEXT, ghost_mode TEXT, ghost_url TEXT, ghost_admin_key_enc TEXT,
                 static_site_name TEXT, created_at TEXT)",
            "CREATE TABLE runs (id INTEGER PRIMARY KEY AUTOINCREMENT, website_id INTEGER NOT NULL,
                 type TEXT, source_label TEXT, status TEXT, publish_mode TEXT, model_id TEXT,
                 created_at TEXT, started_at TEXT, completed_at TEXT)",
            "CREATE TABLE jobs (id INTEGER PRIMARY KEY AUTOINCREMENT, workspace_id INTEGER NOT NULL,
                 site_id INTEGER NOT NULL, keyword TEXT NOT NULL, stage TEXT NOT NULL,
                 status TEXT NOT NULL, created_at TEXT, run_id INTEGER, website_id INTEGER,
                 plan_item_id INTEGER, article_type TEXT, attempts INTEGER NOT NULL DEFAULT 0,
                 locked_by TEXT, lease_until TEXT, not_before TEXT, last_error TEXT,
                 spend_usd REAL NOT NULL DEFAULT 0, stage_index INTEGER NOT NULL DEFAULT 0,
                 claimed_at TEXT)",
            "CREATE TABLE articles (id INTEGER PRIMARY KEY AUTOINCREMENT, job_id INTEGER,
                 site_id INTEGER NOT NULL, title TEXT NOT NULL, slug TEXT NOT NULL,
                 status TEXT NOT NULL, created_at TEXT, website_id INTEGER, keyword TEXT,
                 engine TEXT, ghost_post_id TEXT, published_at TEXT, uniqueness_score REAL,
                 intent_match REAL, coverage_score REAL, featured_image_url TEXT,
                 featured_alt TEXT, content_json TEXT, meta_json TEXT, content_format TEXT)",
            "CREATE TABLE usage_ledger (id INTEGER PRIMARY KEY AUTOINCREMENT, ai_key_id INTEGER,
                 website_id INTEGER, article_id INTEGER, stage TEXT, provider TEXT, model_id TEXT,
                 tokens_in INTEGER NOT NULL DEFAULT 0, tokens_out INTEGER NOT NULL DEFAULT 0,
                 cost_usd REAL NOT NULL DEFAULT 0, at TEXT)",
        ] {
            sqlx::query(sql).execute(&pool).await.unwrap();
        }
        pool
    }

    async fn seed(pool: &SqlitePool) {
        sqlx::query("INSERT INTO websites (id, workspace_id, name) VALUES (1, 1, 'Site 1')")
            .execute(pool)
            .await
            .unwrap();
        sqlx::query("INSERT INTO websites (id, workspace_id, name) VALUES (2, 2, 'Other')")
            .execute(pool)
            .await
            .unwrap();
        // Articles are scoped by their site, so both workspaces need one.
        sqlx::query(
            "INSERT INTO sites (id, workspace_id, domain, client_uid, website_id)
             VALUES (1, 1, 'one.example', 'site_one', 1)",
        )
        .execute(pool)
        .await
        .unwrap();
        sqlx::query(
            "INSERT INTO sites (id, workspace_id, domain, client_uid, website_id)
             VALUES (2, 2, 'two.example', 'site_two', 2)",
        )
        .execute(pool)
        .await
        .unwrap();
        sqlx::query(
            "INSERT INTO runs (id, website_id, status, created_at)
             VALUES (1, 1, 'RUNNING', '2026-01-01T00:00:00Z')",
        )
        .execute(pool)
        .await
        .unwrap();
        // Job 1 completed with an article and spend; job 2 still queued.
        sqlx::query(
            "INSERT INTO jobs (id, workspace_id, site_id, keyword, stage, status, run_id, stage_index, attempts)
             VALUES (1, 1, 1, 'espresso machine', 'validation', 'COMPLETED', 1, 6, 1)",
        )
        .execute(pool)
        .await
        .unwrap();
        sqlx::query(
            "INSERT INTO jobs (id, workspace_id, site_id, keyword, stage, status, run_id, stage_index)
             VALUES (2, 1, 1, 'grinder burr', 'blueprint', 'QUEUED', 1, 0)",
        )
        .execute(pool)
        .await
        .unwrap();
        // A job in another workspace, which must never leak into workspace 1.
        sqlx::query(
            "INSERT INTO jobs (id, workspace_id, site_id, keyword, stage, status, stage_index)
             VALUES (3, 2, 2, 'foreign', 'blueprint', 'QUEUED', 0)",
        )
        .execute(pool)
        .await
        .unwrap();
        sqlx::query(
            "INSERT INTO articles (id, job_id, site_id, title, slug, status, website_id, keyword,
                 engine, content_json, uniqueness_score, coverage_score, intent_match)
             VALUES (1, 1, 1, 'Espresso', 'espresso', 'DRAFT', 1, 'espresso machine',
                 'llm', '{\"html\":\"<p>x</p>\"}', 1.0, 1.0, 0.9)",
        )
        .execute(pool)
        .await
        .unwrap();
        for (stage, tin, tout, cost) in [
            ("blueprint", 100, 50, 0.01),
            ("draft", 300, 900, 0.09),
        ] {
            sqlx::query(
                "INSERT INTO usage_ledger (article_id, stage, tokens_in, tokens_out, cost_usd, at)
                 VALUES (1, ?, ?, ?, ?, '2026-01-01T00:00:00Z')",
            )
            .bind(stage)
            .bind(tin)
            .bind(tout)
            .bind(cost)
            .execute(pool)
            .await
            .unwrap();
        }
    }

    fn app(pool: SqlitePool) -> Router {
        Router::new()
            .route("/api/v1/pipeline/state", get(pipeline_state))
            .with_state(crate::AppState { pool })
    }

    async fn get_state(pool: SqlitePool, uri: &str) -> PipelineState {
        let resp = app(pool)
            .oneshot(Request::builder().uri(uri).body(Body::empty()).unwrap())
            .await
            .unwrap();
        assert_eq!(resp.status(), StatusCode::OK);
        let body = axum::body::to_bytes(resp.into_body(), 4 * 1024 * 1024)
            .await
            .unwrap();
        serde_json::from_slice(&body).unwrap()
    }

    #[tokio::test]
    async fn returns_jobs_articles_and_runs_for_one_workspace() {
        let pool = pool().await;
        seed(&pool).await;
        let state = get_state(pool, "/api/v1/pipeline/state?workspace_id=1").await;

        // Workspace scoping: job 3 belongs to workspace 2.
        assert_eq!(state.jobs.len(), 2, "only workspace 1's jobs");
        assert!(state.jobs.iter().all(|j| j.id != 3), "no cross-workspace leak");
        assert_eq!(state.articles.len(), 1);
        assert_eq!(state.runs.len(), 1);
    }

    #[tokio::test]
    async fn a_job_in_progress_is_visible_before_any_article_exists() {
        let pool = pool().await;
        seed(&pool).await;
        let state = get_state(pool, "/api/v1/pipeline/state?workspace_id=1").await;

        // The queued job has no article and no spend: an INNER JOIN would hide
        // it, and that is exactly the state the UI must render.
        let queued = state.jobs.iter().find(|j| j.id == 2).expect("queued job");
        assert_eq!(queued.status, "QUEUED");
        assert_eq!(queued.article_id, None);
        assert_eq!(queued.tokens_in, 0);
    }

    #[tokio::test]
    async fn spend_is_summed_from_the_usage_ledger_per_job() {
        let pool = pool().await;
        seed(&pool).await;
        let state = get_state(pool, "/api/v1/pipeline/state?workspace_id=1").await;

        let done = state.jobs.iter().find(|j| j.id == 1).expect("job 1");
        assert_eq!(done.article_id, Some(1));
        assert_eq!(done.tokens_in, 400, "100 + 300");
        assert_eq!(done.tokens_out, 950, "50 + 900");
        assert!((done.cost_usd - 0.10).abs() < 1e-9, "0.01 + 0.09");
    }

    #[tokio::test]
    async fn active_reflects_whether_any_job_is_unfinished() {
        let pool = pool().await;
        seed(&pool).await;
        let state = get_state(pool.clone(), "/api/v1/pipeline/state?workspace_id=1").await;
        assert!(state.active, "a QUEUED job means the client should keep polling");

        sqlx::query("UPDATE jobs SET status = 'COMPLETED' WHERE id = 2")
            .execute(&pool)
            .await
            .unwrap();
        let state = get_state(pool, "/api/v1/pipeline/state?workspace_id=1").await;
        assert!(!state.active, "nothing left to poll for");
    }

    #[tokio::test]
    async fn site_filter_narrows_to_one_site() {
        let pool = pool().await;
        seed(&pool).await;
        sqlx::query(
            "INSERT INTO jobs (id, workspace_id, site_id, keyword, stage, status, stage_index)
             VALUES (4, 1, 2, 'elsewhere', 'blueprint', 'QUEUED', 0)",
        )
        .execute(&pool)
        .await
        .unwrap();

        let all = get_state(pool.clone(), "/api/v1/pipeline/state?workspace_id=1").await;
        assert_eq!(all.jobs.len(), 3);

        let one = get_state(pool, "/api/v1/pipeline/state?workspace_id=1&site_id=1").await;
        assert_eq!(one.jobs.len(), 2, "site 2's job is excluded");
    }

    #[tokio::test]
    async fn runs_are_scoped_to_the_requested_site() {
        // Regression: the runs query filtered by workspace only, so asking for
        // one site returned every site's runs — and the client re-labelled them
        // as the active site's.
        let pool = pool().await;
        seed(&pool).await;
        sqlx::query(
            "INSERT INTO websites (id, workspace_id, name) VALUES (3, 1, 'Site 3')",
        )
        .execute(&pool)
        .await
        .unwrap();
        sqlx::query(
            "INSERT INTO sites (id, workspace_id, domain, client_uid, website_id)
             VALUES (3, 1, 'three.example', 'site_three', 3)",
        )
        .execute(&pool)
        .await
        .unwrap();
        // seed() already owns run 1 for website 1; this is a second site in the
        // same workspace, which is what the workspace-only filter got wrong.
        sqlx::query("INSERT INTO runs (id, website_id, type, status) VALUES (9, 3, 'keyword', 'COMPLETED')")
            .execute(&pool)
            .await
            .unwrap();

        let one = get_state(
            pool.clone(),
            "/api/v1/pipeline/state?workspace_id=1&site_id=3",
        )
        .await;
        assert_eq!(one.runs.len(), 1, "only the requested site's run");
        assert_eq!(one.runs[0].id, 9);

        // Without a site filter the workspace still sees both.
        let all = get_state(pool, "/api/v1/pipeline/state?workspace_id=1").await;
        assert_eq!(all.runs.len(), 2);
    }

    #[tokio::test]
    async fn an_empty_workspace_is_an_empty_snapshot_not_an_error() {
        let pool = pool().await;
        seed(&pool).await;
        let state = get_state(pool, "/api/v1/pipeline/state?workspace_id=999").await;
        assert!(state.jobs.is_empty());
        assert!(state.articles.is_empty());
        assert!(state.runs.is_empty());
        assert!(!state.active);
    }

    #[tokio::test]
    async fn run_counts_track_their_jobs() {
        let pool = pool().await;
        seed(&pool).await;
        let state = get_state(pool, "/api/v1/pipeline/state?workspace_id=1").await;
        let run = &state.runs[0];
        assert_eq!(run.id, 1);
        assert_eq!(run.total, 2);
        assert_eq!(run.completed, 1);
        assert_eq!(run.failed, 0);
    }
}
