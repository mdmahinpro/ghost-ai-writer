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

use axum::{extract::Query, extract::State, http::StatusCode, Json};
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::time::Instant;

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
    /// Byline for the "Named author" checklist gate. Null until the article is
    /// regenerated, so the UI must treat absence as "unknown", not "failed".
    pub author_name: Option<String>,
    pub author_slug: Option<String>,
    pub author_beat: Option<String>,
    pub author_city: Option<String>,
}

/// One internal link row, as the checklist needs it: which article it belongs
/// to and which direction it points.
#[derive(Debug, Serialize, Deserialize, sqlx::FromRow)]
pub struct LinkSummary {
    pub article_id: i64,
    pub direction: String,
    pub target_slug: Option<String>,
    pub target_title: Option<String>,
    pub anchor: String,
    pub status: String,
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

#[derive(Debug, Serialize, Deserialize, sqlx::FromRow)]
pub struct StageSummary {
    /// The parent job id, so the client can group rows without a JOIN.
    pub job_id: i64,
    pub idx: i64,
    /// blueprint | draft | revision | metadata | enrichment | validation
    pub key: String,
    pub status: String,
    pub tokens_in: i64,
    pub tokens_out: i64,
    pub duration_ms: i64,
    pub cost_usd: f64,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct PipelineState {
    pub jobs: Vec<JobProgress>,
    pub articles: Vec<ArticleSummary>,
    pub runs: Vec<RunSummary>,
    /// Per-stage progress rows for the jobs in this snapshot, from
    /// `article_stages`. This is what lets the UI show real per-stage token
    /// counts instead of hard-coded zeros.
    pub stages: Vec<StageSummary>,
    /// Internal links belonging to the articles above. Without these the Bing
    /// checklist always reported "0 out · 0 in" for server-backed articles.
    pub links: Vec<LinkSummary>,
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
                featured_image_url, featured_alt, content_json, meta_json,
                author_name, author_slug, author_beat, author_city
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

    // Internal links for those articles, so the Bing checklist can count
    // outbound/inbound instead of always reporting "0 out · 0 in". Scoped to
    // the same article ids as the page above: an unbounded query here would
    // grow with the whole workspace as history accumulates.
    let links: Vec<LinkSummary> = sqlx::query_as(
        "SELECT l.article_id, l.direction, l.target_slug, l.target_title, l.anchor, l.status
           FROM article_links l
          WHERE l.article_id IN (
                SELECT id FROM articles
                 WHERE site_id IN (SELECT id FROM sites WHERE workspace_id = ?1)
                   AND (?2 IS NULL OR site_id = ?2)
                 ORDER BY id DESC
                 LIMIT ?3)",
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

    // Per-stage rows for the jobs above: the raw counts behind the UI's stage
    // tiles (tokens, duration, status). Grouped by (article, idx) — the
    // pipeline writes at most one row per (article_id, idx).
    let stages: Vec<StageSummary> = sqlx::query_as(
        "SELECT a.job_id AS job_id,
                s.idx        AS idx,
                s.key        AS key,
                s.status     AS status,
                s.tokens_in  AS tokens_in,
                s.tokens_out AS tokens_out,
                s.duration_ms AS duration_ms,
                s.cost_usd   AS cost_usd
           FROM article_stages s
           JOIN articles a ON a.id = s.article_id
          WHERE a.job_id IN (
                SELECT j.id FROM jobs j
                 WHERE j.workspace_id = ?1
                   AND (?2 IS NULL OR j.site_id = ?2)
              )
          ORDER BY a.job_id DESC, s.idx",
    )
    .bind(workspace_id)
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
        stages,
        links,
        active,
    }))
}

/// POST /api/v1/pipeline/requeue  `{"workspace_id": 1, "job_id": 12}`
///
/// Failed server jobs cannot be restarted from the browser: the local
/// `restartJob` only re-queues client-side rows, and the worker's claim SQL
/// takes QUEUED / pending / RETRY only, so FAILED stays dead forever.
/// This is the flip: FAILED → QUEUED, attempts reset, last_error cleared.
///
/// Scoping matches the rest of this module (workspace in the request, not
/// the path) and re-reads the status before the UPDATE so a stale-UI retry
/// of a COMPLETED job fails loudly instead of silently re-running it.
#[derive(Deserialize)]
pub struct RequeueRequest {
    workspace_id: i64,
    job_id: i64,
}

pub async fn requeue_job(
    State(st): State<crate::AppState>,
    Json(req): Json<RequeueRequest>,
) -> Result<Json<serde_json::Value>, ApiError> {
    let status: Option<String> =
        sqlx::query_scalar("SELECT status FROM jobs WHERE id = ? AND workspace_id = ?")
            .bind(req.job_id)
            .bind(req.workspace_id)
            .fetch_optional(&st.pool)
            .await
            .map_err(ApiError::Db)?;

    let status = status.ok_or_else(|| {
        ApiError::Invalid(format!(
            "job {} not found in workspace {}",
            req.job_id, req.workspace_id
        ))
    })?;

    if !status.eq_ignore_ascii_case("FAILED") {
        return Err(ApiError::Invalid(format!(
            "job {} is {} — only FAILED jobs can be requeued",
            req.job_id, status
        )));
    }

    let result = sqlx::query(
        "UPDATE jobs SET status = 'QUEUED', attempts = 1, stage_index = 0, last_error = NULL, \
         not_before = NULL, locked_by = NULL, lease_until = NULL \
         WHERE id = ? AND workspace_id = ?",
    )
    .bind(req.job_id)
    .bind(req.workspace_id)
    .execute(&st.pool)
    .await
    .map_err(ApiError::Db)?;

    // The status re-read and the UPDATE run back-to-back with no other writer
    // in between (single-process worker); if the row slips away anyway the
    // row-count check turns it into an error instead of a silent 200.
    if result.rows_affected() == 0 {
        return Err(ApiError::Invalid(format!(
            "job {} changed status before requeue",
            req.job_id
        )));
    }

    Ok(Json(
        serde_json::json!({ "ok": true, "job_id": req.job_id }),
    ))
}

use crate::{clamp_limit, AppState, NOW};

#[derive(Deserialize)]
pub(crate) struct ForgetArticlesRequest {
    /// The site as the studio names it (`sites.client_uid`), or a numeric id.
    site_ref: String,
    slugs: Vec<String>,
}

/// Mark articles deleted, by site and slug.
///
/// The studio drops the rows locally first, so this is what keeps the server's
/// copy honest: a row left alive here is a row the CMS mirror still pushes and a
/// later snapshot still carries. Deletion is a status, not a DELETE, so the
/// article's history stays inspectable.
pub(crate) async fn forget_articles(
    State(st): State<AppState>,
    Json(req): Json<ForgetArticlesRequest>,
) -> Json<serde_json::Value> {
    let site_id: Option<i64> = match sqlx::query_scalar::<_, i64>(
        "SELECT id FROM sites WHERE client_uid = ? OR CAST(id AS TEXT) = ? LIMIT 1",
    )
    .bind(&req.site_ref)
    .bind(&req.site_ref)
    .fetch_optional(&st.pool)
    .await
    {
        Ok(found) => found,
        Err(error) => return Json(serde_json::json!({ "ok": false, "error": error.to_string() })),
    };
    let Some(site_id) = site_id else {
        return Json(serde_json::json!({
            "ok": false,
            "error": format!("No site matches {}.", req.site_ref),
        }));
    };
    let mut deleted = 0usize;
    let mut missing: Vec<String> = Vec::new();
    for slug in req.slugs.iter().filter(|slug| !slug.trim().is_empty()) {
        match sqlx::query("UPDATE articles SET status = 'DELETED' WHERE site_id = ? AND slug = ?")
            .bind(site_id)
            .bind(slug)
            .execute(&st.pool)
            .await
        {
            Ok(done) if done.rows_affected() > 0 => deleted += 1,
            Ok(_) => missing.push(slug.clone()),
            Err(error) => missing.push(format!("{slug}: {error}")),
        }
    }
    Json(serde_json::json!({
        "ok": true,
        "deleted": deleted,
        "missing": missing,
    }))
}

pub(crate) async fn list_workspaces(
    State(st): State<AppState>,
    Query(q): Query<PageQuery>,
) -> Result<Json<Page<WorkspaceRow>>, ApiError> {
    let cursor = q.cursor.unwrap_or(0);
    let limit = clamp_limit(q.limit);
    let items: Vec<WorkspaceRow> = sqlx::query_as(
        "SELECT id, name, created_at FROM workspaces WHERE id > ? ORDER BY id LIMIT ?",
    )
    .bind(cursor)
    .bind(limit)
    .fetch_all(&st.pool)
    .await
    .map_err(ApiError::Db)?;
    let total: i64 = sqlx::query_scalar("SELECT COUNT(*) FROM workspaces")
        .fetch_one(&st.pool)
        .await
        .map_err(ApiError::Db)?;
    let next_cursor = if items.len() as i64 == limit {
        items.last().map(|r| r.id)
    } else {
        None
    };
    Ok(Json(Page {
        items,
        next_cursor,
        total,
    }))
}
pub(crate) async fn list_jobs(
    State(st): State<AppState>,
    Query(q): Query<PageQuery>,
) -> Result<Json<Page<JobRow>>, ApiError> {
    let cursor = q.cursor.unwrap_or(0);
    let limit = clamp_limit(q.limit);
    let items: Vec<JobRow> = sqlx::query_as(
        "SELECT id, workspace_id, site_id, keyword, stage, status \
         FROM jobs WHERE id > ? ORDER BY id LIMIT ?",
    )
    .bind(cursor)
    .bind(limit)
    .fetch_all(&st.pool)
    .await
    .map_err(ApiError::Db)?;
    let total: i64 = sqlx::query_scalar("SELECT COUNT(*) FROM jobs")
        .fetch_one(&st.pool)
        .await
        .map_err(ApiError::Db)?;
    let next_cursor = if items.len() as i64 == limit {
        items.last().map(|r| r.id)
    } else {
        None
    };
    Ok(Json(Page {
        items,
        next_cursor,
        total,
    }))
}
/// Keyword intake: one job row per keyword, single transaction, no cap.
/// This is the Rule 1 scale path the browser implementation cannot prove.
pub(crate) async fn intake_keywords(
    State(st): State<AppState>,
    Json(req): Json<IntakeRequest>,
) -> Result<(StatusCode, Json<IntakeResponse>), ApiError> {
    if req.keywords.is_empty() {
        return Err(ApiError::BadRequest("keywords must not be empty"));
    }
    // Parents must exist: with foreign keys on, an unknown workspace/site would
    // otherwise surface as an opaque 500.
    let ws_exists: i64 = sqlx::query_scalar("SELECT COUNT(*) FROM workspaces WHERE id = ?")
        .bind(req.workspace_id)
        .fetch_one(&st.pool)
        .await
        .map_err(ApiError::Db)?;
    if ws_exists == 0 {
        return Err(ApiError::BadRequest("unknown workspace_id"));
    }
    let site_exists: i64 = sqlx::query_scalar("SELECT COUNT(*) FROM sites WHERE id = ?")
        .bind(req.site_id)
        .fetch_one(&st.pool)
        .await
        .map_err(ApiError::Db)?;
    if site_exists == 0 {
        return Err(ApiError::BadRequest("unknown site_id"));
    }
    let started = Instant::now();
    // The website a job belongs to is the site's own link, not its id. Intake
    // used to assume `website_id = site_id`, which only held because seeding
    // numbered both tables identically; sites created through `sites/ensure`
    // carry an explicit link, and a mismatch would attribute work to the wrong
    // website (usage rollups and article visibility both key on it).
    let website_id: i64 =
        sqlx::query_scalar("SELECT COALESCE(website_id, id) FROM sites WHERE id = ?1")
            .bind(req.site_id)
            .fetch_one(&st.pool)
            .await
            .map_err(ApiError::Db)?;
    let mut tx = st.pool.begin().await.map_err(ApiError::Db)?;
    // One run per intake call. The UI groups its queue by run, and
    // `runs::refresh_run` already rolls status up from the jobs, so creating it
    // here is what makes a server-driven queue visible as a single run. Without
    // it the jobs exist but nothing in the UI can group them.
    let run_id: i64 = sqlx::query_scalar(
        "INSERT INTO runs (website_id, type, source_label, status, publish_mode, created_at)
         VALUES (?, 'keyword', 'keyword intake', 'RUNNING', 'default', ?)
         RETURNING id",
    )
    .bind(website_id)
    .bind(NOW)
    .fetch_one(&mut *tx)
    .await
    .map_err(ApiError::Db)?;
    for kw in &req.keywords {
        sqlx::query(
            "INSERT INTO jobs (workspace_id, site_id, website_id, run_id, keyword, stage, status, created_at) \
             VALUES (?, ?, ?, ?, ?, 'blueprint', 'QUEUED', ?)",
        )
        .bind(req.workspace_id)
        .bind(req.site_id)
        .bind(website_id)
        .bind(run_id)
        .bind(kw)
        .bind(NOW)
        .execute(&mut *tx)
        .await
        .map_err(ApiError::Db)?;
    }
    tx.commit().await.map_err(ApiError::Db)?;
    Ok((
        StatusCode::CREATED,
        Json(IntakeResponse {
            inserted: req.keywords.len(),
            run_id,
            elapsed_ms: started.elapsed().as_millis(),
        }),
    ))
}

#[derive(Debug, Deserialize)]
pub(crate) struct PageQuery {
    cursor: Option<i64>,
    limit: Option<i64>,
}
#[derive(Debug, Serialize)]
pub(crate) struct Page<T> {
    items: Vec<T>,
    next_cursor: Option<i64>,
    total: i64,
}
#[derive(Debug, Serialize, sqlx::FromRow)]
pub(crate) struct WorkspaceRow {
    id: i64,
    name: String,
    created_at: String,
}
#[derive(Debug, Serialize, sqlx::FromRow)]
pub(crate) struct JobRow {
    id: i64,
    workspace_id: i64,
    site_id: i64,
    keyword: String,
    stage: String,
    status: String,
}
#[derive(Debug, Deserialize)]
pub(crate) struct IntakeRequest {
    workspace_id: i64,
    site_id: i64,
    keywords: Vec<String>,
}
#[derive(Debug, Serialize)]
pub(crate) struct IntakeResponse {
    inserted: usize,
    run_id: i64,
    elapsed_ms: u128,
}

#[cfg(test)]
mod tests {
    use super::*;
    use axum::body::Body;
    use axum::http::{Request, StatusCode};
    use axum::routing::{get, post};
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
                 featured_alt TEXT, content_json TEXT, meta_json TEXT, content_format TEXT,
                 author_name TEXT, author_slug TEXT, author_beat TEXT, author_city TEXT)",
            "CREATE TABLE article_links (id INTEGER PRIMARY KEY AUTOINCREMENT,
                 article_id INTEGER NOT NULL, direction TEXT NOT NULL DEFAULT 'INCOMING',
                 target_article_id INTEGER, target_slug TEXT, target_title TEXT,
                 anchor TEXT NOT NULL, status TEXT NOT NULL DEFAULT 'LOCAL_INSERTED',
                 health TEXT NOT NULL DEFAULT 'pending', reason TEXT, verified_at TEXT,
                 created_at TEXT NOT NULL)",
            "CREATE TABLE usage_ledger (id INTEGER PRIMARY KEY AUTOINCREMENT, ai_key_id INTEGER,
                 website_id INTEGER, article_id INTEGER, stage TEXT, provider TEXT, model_id TEXT,
                 tokens_in INTEGER NOT NULL DEFAULT 0, tokens_out INTEGER NOT NULL DEFAULT 0,
                 cost_usd REAL NOT NULL DEFAULT 0, at TEXT)",
            "CREATE TABLE article_stages (id INTEGER PRIMARY KEY AUTOINCREMENT,
                 article_id INTEGER NOT NULL, idx INTEGER NOT NULL, key TEXT NOT NULL,
                 status TEXT NOT NULL DEFAULT 'PENDING', tokens_in INTEGER NOT NULL DEFAULT 0,
                 tokens_out INTEGER NOT NULL DEFAULT 0, duration_ms INTEGER NOT NULL DEFAULT 0,
                 cost_usd REAL NOT NULL DEFAULT 0, error TEXT, payload_json TEXT,
                 started_at TEXT, finished_at TEXT, UNIQUE (article_id, idx))",
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
        // Real per-stage rows for job 1: draft carries tokens, validation none.
        sqlx::query(
            "INSERT INTO article_stages (article_id, idx, key, status, tokens_in, tokens_out, duration_ms, cost_usd)
             VALUES (1, 1, 'blueprint', 'COMPLETED', 100, 50, 1200, 0.01),
                    (1, 2, 'draft', 'COMPLETED', 300, 900, 4300, 0.09)",
        )
        .execute(pool)
        .await
        .unwrap();
        for (stage, tin, tout, cost) in [("blueprint", 100, 50, 0.01), ("draft", 300, 900, 0.09)] {
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
            .route("/api/v1/pipeline/requeue", post(requeue_job))
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

    /// POST a JSON body to the requeue route on the shared router; returns
    /// (status, body). Kept separate from `get_state` because requeue is a
    /// write and the error shapes are the thing under test.
    async fn post_requeue(
        pool: &SqlitePool,
        body: serde_json::Value,
    ) -> (StatusCode, serde_json::Value) {
        let req = Request::builder()
            .method("POST")
            .uri("/api/v1/pipeline/requeue")
            .header("content-type", "application/json")
            .body(Body::from(body.to_string()))
            .unwrap();
        let resp = app(pool.clone()).oneshot(req).await.unwrap();
        let status = resp.status();
        let bytes = axum::body::to_bytes(resp.into_body(), 4 * 1024 * 1024)
            .await
            .unwrap();
        let json = serde_json::from_slice(&bytes).unwrap();
        (status, json)
    }

    #[tokio::test]
    async fn returns_jobs_articles_and_runs_for_one_workspace() {
        let pool = pool().await;
        seed(&pool).await;
        let state = get_state(pool, "/api/v1/pipeline/state?workspace_id=1").await;

        // Workspace scoping: job 3 belongs to workspace 2.
        assert_eq!(state.jobs.len(), 2, "only workspace 1's jobs");
        assert!(
            state.jobs.iter().all(|j| j.id != 3),
            "no cross-workspace leak"
        );
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

        // The snapshot now also carries real per-stage rows, so the UI can
        // show tokens per stage instead of hard-coded zeros.
        let draft = state
            .stages
            .iter()
            .find(|s| s.job_id == 1 && s.key == "draft")
            .expect("draft stage row");
        assert_eq!(draft.tokens_in, 300);
        assert_eq!(draft.tokens_out, 900);
        assert_eq!(draft.duration_ms, 4300);
        assert!(
            state.stages.iter().all(|s| s.job_id == 1),
            "workspace scoping"
        );
    }

    #[tokio::test]
    async fn active_reflects_whether_any_job_is_unfinished() {
        let pool = pool().await;
        seed(&pool).await;
        let state = get_state(pool.clone(), "/api/v1/pipeline/state?workspace_id=1").await;
        assert!(
            state.active,
            "a QUEUED job means the client should keep polling"
        );

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
        sqlx::query("INSERT INTO websites (id, workspace_id, name) VALUES (3, 1, 'Site 3')")
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
        sqlx::query(
            "INSERT INTO runs (id, website_id, type, status) VALUES (9, 3, 'keyword', 'COMPLETED')",
        )
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

    // ---------------------------------------------------------------- requeue

    #[tokio::test]
    async fn requeue_flips_a_failed_job_back_to_queued() {
        let pool = pool().await;
        seed(&pool).await;
        sqlx::query(
            "INSERT INTO jobs (id, workspace_id, site_id, keyword, stage, status, stage_index, attempts, last_error)
             VALUES (5, 1, 1, 'flat white', 'draft', 'FAILED', 3, 2, 'provider 500')",
        )
        .execute(&pool)
        .await
        .unwrap();

        let (status, body) =
            post_requeue(&pool, serde_json::json!({ "workspace_id": 1, "job_id": 5 })).await;
        assert_eq!(status, StatusCode::OK);
        assert_eq!(body["ok"], true);
        assert_eq!(body["job_id"], 5);

        let row: (String, i64, i64, Option<String>) = sqlx::query_as(
            "SELECT status, stage_index, attempts, last_error FROM jobs WHERE id = 5",
        )
        .fetch_one(&pool)
        .await
        .unwrap();
        assert_eq!(row.0, "QUEUED", "worker claim takes QUEUED rows");
        assert_eq!(row.1, 0, "stage progress reset");
        assert_eq!(row.2, 1, "attempt counter reset");
        assert_eq!(row.3, None, "stale last_error cleared");
    }

    #[tokio::test]
    async fn requeue_refuses_non_failed_jobs_loudly() {
        let pool = pool().await;
        seed(&pool).await;

        // Job 1 is COMPLETED — a stale-UI retry must not re-run it.
        let (status, body) =
            post_requeue(&pool, serde_json::json!({ "workspace_id": 1, "job_id": 1 })).await;
        assert_eq!(status, StatusCode::BAD_REQUEST);
        assert!(
            body["error"]["message"]
                .as_str()
                .unwrap()
                .contains("COMPLETED"),
            "actual status in the message: {body}"
        );

        let still: String = sqlx::query_scalar("SELECT status FROM jobs WHERE id = 1")
            .fetch_one(&pool)
            .await
            .unwrap();
        assert_eq!(still, "COMPLETED", "completed job untouched");

        // Unknown id.
        let (status, _) = post_requeue(
            &pool,
            serde_json::json!({ "workspace_id": 1, "job_id": 999 }),
        )
        .await;
        assert_eq!(status, StatusCode::BAD_REQUEST);
    }

    #[tokio::test]
    async fn requeue_is_scoped_to_the_requested_workspace() {
        let pool = pool().await;
        seed(&pool).await;
        // Job 3 lives in workspace 2 (see seed). Workspace 1 asking for it
        // gets not-found, not a silent cross-workspace write.
        let (status, body) =
            post_requeue(&pool, serde_json::json!({ "workspace_id": 1, "job_id": 3 })).await;
        assert_eq!(status, StatusCode::BAD_REQUEST);
        assert!(
            body["error"]["message"]
                .as_str()
                .unwrap()
                .contains("not found"),
            "cross-workspace id must not read like success: {body}"
        );

        // The right workspace still sees its own failed job… seed has no
        // FAILED jobs in workspace 2, so fail one and requeue from there.
        sqlx::query("UPDATE jobs SET status = 'FAILED' WHERE id = 3")
            .execute(&pool)
            .await
            .unwrap();
        let (status, _) =
            post_requeue(&pool, serde_json::json!({ "workspace_id": 2, "job_id": 3 })).await;
        assert_eq!(status, StatusCode::OK);
    }

    #[tokio::test]
    async fn a_requeued_job_is_viable_for_the_worker_again() {
        // End-to-end claim check: the worker's claim SQL is the only thing
        // that can rescue a job, so the requeue result must satisfy it —
        // QUEUED with a reset lease, nothing else.
        let pool = pool().await;
        seed(&pool).await;
        sqlx::query(
            "UPDATE jobs SET status = 'FAILED', locked_by = 'worker-a',
                  lease_until = '2999-01-01T00:00:00Z', attempts = 9 WHERE id = 2",
        )
        .execute(&pool)
        .await
        .unwrap();

        let (status, _) =
            post_requeue(&pool, serde_json::json!({ "workspace_id": 1, "job_id": 2 })).await;
        assert_eq!(status, StatusCode::OK);

        // Mirror of the exact claim predicate in worker.rs (`claim`): the
        // candidate query plus the guarded-UPDATE lease check. A requeued
        // row must satisfy both, or the rescue is a no-op.
        let now = sqlx::query_scalar::<_, String>("SELECT strftime('%Y-%m-%dT%H:%M:%fZ', 'now')")
            .fetch_one(&pool)
            .await
            .unwrap();
        let claimable: i64 = sqlx::query_scalar(
            "SELECT COUNT(*) FROM jobs WHERE id = 2 AND (
                 (status IN ('QUEUED', 'pending', 'RETRY') AND not_before IS NULL)
                 OR (status = 'RUNNING' AND lease_until IS NOT NULL AND lease_until <= ?)
               ) AND (lease_until IS NULL OR lease_until <= ?)",
        )
        .bind(&now)
        .bind(&now)
        .fetch_one(&pool)
        .await
        .unwrap();
        assert_eq!(claimable, 1, "requeue must leave a claimable row");
    }
}
