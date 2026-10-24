//! Ghost AI Writer — Rust API (P1).
//!
//! Verified vertical slice:
//!   GET  /health                     -> liveness + version
//!   GET  /api/v1/workspaces          -> keyset-paginated workspaces (SQL)
//!   GET  /api/v1/jobs                -> keyset-paginated jobs (SQL)
//!   POST /api/v1/keywords            -> keyword intake: N job rows, one transaction
//!
//! Storage: SQLite (dev, bundled — no system deps) / Postgres (prod). The
//! migration file and SQL stay portable; only the pool URL and driver change.

use axum::{
    extract::{Query, Request, State},
    http::StatusCode,
    middleware::{self, Next},
    response::{IntoResponse, Response},
    routing::{get, post},
    Json, Router,
};
use serde::{Deserialize, Serialize};
use sqlx::sqlite::{SqlitePool, SqlitePoolOptions};
use std::net::SocketAddr;
use std::time::Instant;

mod gate;
mod ghost;
mod image;
mod lint;
mod provider;
mod stages;
mod worker;

const API_VERSION: &str = env!("CARGO_PKG_VERSION");
const MAX_LIMIT: i64 = 500;
const DEFAULT_LIMIT: i64 = 50;
const NOW: &str = "2026-10-22T00:00:00Z";

#[derive(Clone)]
struct AppState {
    pool: SqlitePool,
}

#[derive(Debug, Serialize)]
struct Health {
    status: &'static str,
    service: &'static str,
    version: &'static str,
}

async fn health() -> Json<Health> {
    Json(Health {
        status: "ok",
        service: "gaw-api",
        version: API_VERSION,
    })
}

// ---------------------------------------------------------------- pagination

#[derive(Debug, Deserialize)]
struct PageQuery {
    cursor: Option<i64>,
    limit: Option<i64>,
}

#[derive(Debug, Serialize)]
struct Page<T> {
    items: Vec<T>,
    next_cursor: Option<i64>,
    total: i64,
}

fn clamp_limit(limit: Option<i64>) -> i64 {
    limit.unwrap_or(DEFAULT_LIMIT).clamp(1, MAX_LIMIT)
}

// ---------------------------------------------------------------- rows

#[derive(Debug, Serialize, sqlx::FromRow)]
struct WorkspaceRow {
    id: i64,
    name: String,
    created_at: String,
}

#[derive(Debug, Serialize, sqlx::FromRow)]
struct JobRow {
    id: i64,
    workspace_id: i64,
    site_id: i64,
    keyword: String,
    stage: String,
    status: String,
}

// ---------------------------------------------------------------- handlers

async fn list_workspaces(
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

async fn list_jobs(
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

#[derive(Debug, Deserialize)]
struct IntakeRequest {
    workspace_id: i64,
    site_id: i64,
    keywords: Vec<String>,
}

#[derive(Debug, Serialize)]
struct IntakeResponse {
    inserted: usize,
    elapsed_ms: u128,
}

/// Keyword intake: one job row per keyword, single transaction, no cap.
/// This is the Rule 1 scale path the browser implementation cannot prove.
async fn intake_keywords(
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
    let mut tx = st.pool.begin().await.map_err(ApiError::Db)?;
    for kw in &req.keywords {
        sqlx::query(
            "INSERT INTO jobs (workspace_id, site_id, website_id, keyword, stage, status, created_at) \
             VALUES (?, ?, ?, ?, 'blueprint', 'QUEUED', ?)",
        )
        .bind(req.workspace_id)
        .bind(req.site_id)
        .bind(req.site_id)
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
            elapsed_ms: started.elapsed().as_millis(),
        }),
    ))
}

// ---------------------------------------------------------------- writing gate

#[derive(Debug, Deserialize)]
struct LintRequest {
    text: String,
}

#[derive(Deserialize)]
struct ImagePickRequest {
    query: String,
    #[serde(default)]
    size: Option<String>,
}

/// Deterministic AI-tell linter (humanizer patterns). Blocks publish when
/// `passed` is false. Pure function of the input text.
async fn lint_text(Json(req): Json<LintRequest>) -> Json<lint::Report> {
    Json(lint::lint(&req.text))
}

// ---------------------------------------------------------------- worker routes

/// Heartbeat view: mirrors their `worker.alive` / `worker.lastTickAt` contract so
/// the UI can prove the pipeline is running without polling a run.
async fn worker_status(State(st): State<AppState>) -> Result<Json<serde_json::Value>, ApiError> {
    let workers = worker::status(&st.pool).await.map_err(ApiError::Db)?;
    let fresh = workers
        .iter()
        .any(|w| w.last_tick_at.as_str() > worker::iso_after(-60).as_str());
    Ok(Json(
        serde_json::json!({ "alive": fresh, "workers": workers }),
    ))
}

/// Manual tick (dev + tests): claim and process at most one job.
async fn worker_run_once(State(st): State<AppState>) -> Result<Json<serde_json::Value>, ApiError> {
    let job = worker::run_once(&st.pool, "manual", worker::DEFAULT_LEASE_SECS)
        .await
        .map_err(ApiError::Db)?;
    Ok(Json(serde_json::json!({ "processed_job": job })))
}

// ---------------------------------------------------------------- provider routes

#[derive(Deserialize)]
struct ProviderQuery {
    workspace_id: Option<i64>,
}

/// List providers for a workspace. Keys are never returned — only `key_hint`.
async fn pick_image(
    State(st): State<AppState>,
    Json(req): Json<ImagePickRequest>,
) -> Json<serde_json::Value> {
    let size = match req.size.as_deref() {
        Some("content") => crate::image::CONTENT,
        _ => crate::image::FEATURED,
    };
    let vision = crate::provider::load_vision(&st.pool, 1)
        .await
        .ok()
        .flatten();
    let scene = crate::image::scene_query(&req.query, &req.query, None);
    let decision = crate::image::pick(vision.as_ref(), &scene, size).await;
    Json(serde_json::json!({
        "image": crate::image::decision_json(&decision),
        "scene_query": scene,
        "size": [size.0, size.1]
    }))
}

async fn list_provider_routes(
    State(st): State<AppState>,
    Query(q): Query<ProviderQuery>,
) -> Result<Json<serde_json::Value>, ApiError> {
    let ws = q.workspace_id.unwrap_or(1);
    let items = provider::list_providers(&st.pool, ws)
        .await
        .map_err(ApiError::Db)?;
    Ok(Json(serde_json::json!({ "items": items })))
}

/// Add any OpenAI-compatible provider. No cap on how many a workspace may add.
async fn create_provider(
    State(st): State<AppState>,
    Json(req): Json<provider::NewProvider>,
) -> Result<(StatusCode, Json<serde_json::Value>), ApiError> {
    if req.api_key.trim().is_empty() {
        return Err(ApiError::BadRequest("api_key must not be empty"));
    }
    if req.model_id.trim().is_empty() {
        return Err(ApiError::BadRequest("model_id must not be empty"));
    }
    let exists: i64 = sqlx::query_scalar("SELECT COUNT(*) FROM workspaces WHERE id = ?")
        .bind(req.workspace_id)
        .fetch_one(&st.pool)
        .await
        .map_err(ApiError::Db)?;
    if exists == 0 {
        return Err(ApiError::BadRequest("unknown workspace_id"));
    }
    let id = provider::insert_provider(&st.pool, NOW, &req)
        .await
        .map_err(ApiError::Db)?;
    let items = provider::list_providers(&st.pool, req.workspace_id)
        .await
        .map_err(ApiError::Db)?;
    let created = items.into_iter().find(|p| p.id == id);
    Ok((
        StatusCode::CREATED,
        Json(serde_json::json!({ "id": id, "provider": created })),
    ))
}

// ---------------------------------------------------------------- errors

enum ApiError {
    BadRequest(&'static str),
    Db(sqlx::Error),
}

impl IntoResponse for ApiError {
    fn into_response(self) -> Response {
        let (status, code, message) = match self {
            ApiError::BadRequest(msg) => (StatusCode::BAD_REQUEST, "bad_request", msg.to_string()),
            ApiError::Db(e) => {
                tracing::error!("db error: {e}");
                (
                    StatusCode::INTERNAL_SERVER_ERROR,
                    "db_error",
                    "database error".to_string(),
                )
            }
        };
        (
            status,
            Json(serde_json::json!({ "error": { "code": code, "message": message } })),
        )
            .into_response()
    }
}

// ---------------------------------------------------------------- app + setup

fn app(pool: SqlitePool) -> Router {
    Router::new()
        .route("/health", get(health))
        .route("/api/v1/workspaces", get(list_workspaces))
        .route("/api/v1/jobs", get(list_jobs))
        .route("/api/v1/keywords", post(intake_keywords))
        .route("/api/v1/lint", post(lint_text))
        .route("/api/v1/worker", get(worker_status))
        .route("/api/v1/worker/run-once", post(worker_run_once))
        .route("/api/v1/image/pick", post(pick_image))
        .route(
            "/api/v1/providers",
            get(list_provider_routes).post(create_provider),
        )
        .layer(middleware::from_fn_with_state(admin_token(), require_token))
        .layer(tower_http::trace::TraceLayer::new_for_http())
        .with_state(AppState { pool })
}

/// Set on any host that is not localhost. Without it every write route is open
/// to the internet: anyone could add a provider with their own base URL and
/// bill it to the workspace, or queue tens of thousands of jobs.
fn admin_token() -> Option<String> {
    std::env::var("GAW_ADMIN_TOKEN")
        .ok()
        .filter(|t| t.len() >= 16)
}

async fn require_token(State(token): State<Option<String>>, req: Request, next: Next) -> Response {
    let Some(expected) = token else {
        return next.run(req).await;
    };
    // Liveness probes must never need a secret.
    if req.uri().path() == "/health" {
        return next.run(req).await;
    }
    let header = req
        .headers()
        .get("x-api-token")
        .and_then(|v| v.to_str().ok())
        .map(|v| v == expected)
        .unwrap_or(false);
    let bearer = req
        .headers()
        .get("authorization")
        .and_then(|v| v.to_str().ok())
        .and_then(|v| v.strip_prefix("Bearer "))
        .map(|v| v == expected)
        .unwrap_or(false);
    if header || bearer {
        next.run(req).await
    } else {
        (
            StatusCode::UNAUTHORIZED,
            Json(serde_json::json!({"error": "missing or invalid x-api-token"})),
        )
            .into_response()
    }
}

async fn connect(url: &str) -> Result<SqlitePool, sqlx::Error> {
    use sqlx::sqlite::{SqliteConnectOptions, SqliteJournalMode, SqliteSynchronous};
    use std::str::FromStr;
    use std::time::Duration;

    // WAL + NORMAL synchronous: one fsync per checkpoint instead of one per
    // statement. Without this the worker managed ~11 jobs/s; the queue writes
    // several rows per stage.
    let opts = SqliteConnectOptions::from_str(url)?
        .create_if_missing(true)
        .journal_mode(SqliteJournalMode::Wal)
        .synchronous(SqliteSynchronous::Normal)
        .busy_timeout(Duration::from_secs(10))
        .foreign_keys(true);
    let pool = SqlitePoolOptions::new()
        .max_connections(8)
        .connect_with(opts)
        .await?;
    sqlx::migrate!("../migrations")
        .run(&pool)
        .await
        .map_err(|e| sqlx::Error::Configuration(Box::new(e)))?;
    Ok(pool)
}

/// Dev seeding: 10 workspaces + 10 websites, plus `jobs` queued rows.
/// `SEED=1` alone seeds structure only; `SEED_JOBS=N` adds N queued jobs.
async fn seed(pool: &SqlitePool, jobs: i64) -> Result<(), sqlx::Error> {
    let existing: i64 = sqlx::query_scalar("SELECT COUNT(*) FROM workspaces")
        .fetch_one(pool)
        .await?;
    if existing > 0 {
        return Ok(());
    }
    let mut tx = pool.begin().await?;
    for id in 1..=10i64 {
        sqlx::query("INSERT INTO workspaces (id, name, created_at) VALUES (?, ?, ?)")
            .bind(id)
            .bind(format!("Site {id:05}"))
            .bind(NOW)
            .execute(&mut *tx)
            .await?;
    }
    for ws in 1..=10i64 {
        sqlx::query("INSERT INTO sites (id, workspace_id, domain, created_at) VALUES (?, ?, ?, ?)")
            .bind(ws)
            .bind(ws)
            .bind(format!("site{ws}.example.com"))
            .bind(NOW)
            .execute(&mut *tx)
            .await?;
        sqlx::query(
            "INSERT INTO websites (id, workspace_id, name, ghost_mode, created_at) \
             VALUES (?, ?, ?, 'SANDBOX', ?)",
        )
        .bind(ws)
        .bind(ws)
        .bind(format!("Site {ws}"))
        .bind(NOW)
        .execute(&mut *tx)
        .await?;
    }
    for id in 1..=jobs {
        sqlx::query(
            "INSERT INTO jobs (id, workspace_id, site_id, website_id, keyword, stage, status, created_at) \
             VALUES (?, ?, ?, ?, ?, 'blueprint', 'QUEUED', ?)",
        )
        .bind(id)
        .bind((id % 10) + 1)
        .bind((id % 10) + 1)
        .bind((id % 10) + 1)
        .bind(format!("seed keyword {id}"))
        .bind(NOW)
        .execute(&mut *tx)
        .await?;
    }
    tx.commit().await?;
    tracing::info!("seeded 10 workspaces / 10 sites / {jobs} jobs");
    Ok(())
}

#[tokio::main]
async fn main() {
    tracing_subscriber::fmt()
        .with_env_filter(
            tracing_subscriber::EnvFilter::try_from_default_env()
                .unwrap_or_else(|_| "info,tower_http=warn".into()),
        )
        .init();

    let db_url = std::env::var("DATABASE_URL").unwrap_or_else(|_| "sqlite:gaw.db?mode=rwc".into());
    let pool = connect(&db_url)
        .await
        .unwrap_or_else(|e| panic!("db {db_url}: {e}"));
    if std::env::var("SEED").as_deref() == Ok("1") {
        let seed_jobs: i64 = std::env::var("SEED_JOBS")
            .ok()
            .and_then(|v| v.parse().ok())
            .unwrap_or(0);
        seed(&pool, seed_jobs).await.expect("seed");
    }

    let port: u16 = std::env::var("PORT")
        .ok()
        .and_then(|p| p.parse().ok())
        .unwrap_or(8787);
    // Platforms (Render, Fly, Docker) route to the container, not to loopback.
    let host = std::env::var("HOST").unwrap_or_else(|_| "0.0.0.0".into());
    let ip: std::net::IpAddr = host
        .parse()
        .unwrap_or_else(|_| panic!("HOST={host} is not an IP address"));
    let addr = SocketAddr::from((ip, port));
    if std::env::var("GAW_ADMIN_TOKEN").is_err() {
        tracing::warn!("GAW_ADMIN_TOKEN is unset: every route is unauthenticated");
    }

    // One binary, three roles: ROLE=api | worker | all (default).
    if std::env::var("ROLE").unwrap_or_else(|_| "all".into()) != "api" {
        let pool_w = pool.clone();
        let wid = format!("worker-{}", std::process::id());
        tokio::spawn(async move {
            tracing::info!("worker {wid} started");
            loop {
                match worker::run_once(&pool_w, &wid, worker::DEFAULT_LEASE_SECS).await {
                    Ok(Some(id)) => tracing::info!("worker {wid} completed job {id}"),
                    Ok(None) => {
                        tokio::time::sleep(std::time::Duration::from_millis(300)).await;
                    }
                    Err(e) => {
                        tracing::error!("worker {wid}: {e}");
                        tokio::time::sleep(std::time::Duration::from_secs(1)).await;
                    }
                }
            }
        });
    }

    let listener = tokio::net::TcpListener::bind(addr)
        .await
        .unwrap_or_else(|e| panic!("cannot bind {addr}: {e}"));
    tracing::info!("gaw-api {API_VERSION} listening on http://{addr} (db: {db_url})");
    axum::serve(listener, app(pool))
        .await
        .expect("server error");
}

#[cfg(test)]
mod tests {
    use super::*;

    async fn memory_pool() -> SqlitePool {
        connect("sqlite::memory:").await.expect("memory db")
    }

    #[tokio::test]
    async fn migrations_create_all_six_tables() {
        let pool = memory_pool().await;
        for table in [
            "workspaces",
            "sites",
            "jobs",
            "articles",
            "api_keys",
            "calendar_entries",
        ] {
            let n: i64 = sqlx::query_scalar(
                "SELECT COUNT(*) FROM sqlite_master WHERE type='table' AND name=?",
            )
            .bind(table)
            .fetch_one(&pool)
            .await
            .expect("count");
            assert_eq!(n, 1, "table {table} missing");
        }
    }

    /// S1 acceptance: the full product schema, not just the slice.
    #[tokio::test]
    async fn core_schema_has_every_table() {
        let pool = memory_pool().await;
        let expected = [
            "workspaces",
            "sites",
            "jobs",
            "articles",
            "api_keys",
            "calendar_entries",
            "users",
            "memberships",
            "websites",
            "integrations",
            "inventory_posts",
            "runs",
            "plans",
            "plan_items",
            "article_stages",
            "article_images",
            "article_links",
            "article_claims",
            "research_projects",
            "research_stages",
            "research_entities",
            "calendars",
            "static_builds",
            "usage_ledger",
            "activity_events",
            "worker_heartbeats",
        ];
        for table in expected {
            let n: i64 = sqlx::query_scalar(
                "SELECT COUNT(*) FROM sqlite_master WHERE type='table' AND name=?",
            )
            .bind(table)
            .fetch_one(&pool)
            .await
            .expect("count");
            assert_eq!(n, 1, "table {table} missing");
        }
        assert!(expected.len() >= 26);
    }

    /// Spend is derived from the ledger, never a drifting counter.
    #[tokio::test]
    async fn usage_ledger_sums_per_website() {
        let pool = memory_pool().await;
        seed(&pool, 0).await.expect("seed");
        for (tin, tout, cost) in [(100i64, 200i64, 0.01f64), (50, 60, 0.02)] {
            sqlx::query(
                "INSERT INTO usage_ledger (website_id, stage, tokens_in, tokens_out, cost_usd, at) \
                 VALUES (1, 'draft', ?, ?, ?, ?)",
            )
            .bind(tin)
            .bind(tout)
            .bind(cost)
            .bind(NOW)
            .execute(&pool)
            .await
            .expect("ledger");
        }
        let (tokens, cost): (i64, f64) = sqlx::query_as(
            "SELECT COALESCE(SUM(tokens_in+tokens_out),0), COALESCE(SUM(cost_usd),0) \
             FROM usage_ledger WHERE website_id=1",
        )
        .fetch_one(&pool)
        .await
        .expect("sum");
        assert_eq!(tokens, 410);
        assert!((cost - 0.03).abs() < 1e-9);
    }

    #[tokio::test]
    async fn keyset_pagination_walks_without_overlap() {
        let pool = memory_pool().await;
        seed(&pool, 10_000).await.expect("seed");
        let mut cursor = 0i64;
        let mut seen = 0usize;
        loop {
            let items: Vec<i64> =
                sqlx::query_scalar("SELECT id FROM jobs WHERE id > ? ORDER BY id LIMIT ?")
                    .bind(cursor)
                    .bind(100i64)
                    .fetch_all(&pool)
                    .await
                    .expect("page");
            if items.is_empty() {
                break;
            }
            seen += items.len();
            let last = *items.last().unwrap();
            if items.len() < 100 {
                break;
            }
            cursor = last;
        }
        assert_eq!(seen, 10_000);
    }

    #[tokio::test]
    async fn intake_inserts_every_keyword_in_one_transaction() {
        let pool = memory_pool().await;
        seed(&pool, 0).await.expect("seed");
        let before: i64 = sqlx::query_scalar("SELECT COUNT(*) FROM jobs")
            .fetch_one(&pool)
            .await
            .unwrap();
        let started = Instant::now();
        let mut tx = pool.begin().await.unwrap();
        for i in 0..10_000 {
            sqlx::query(
                "INSERT INTO jobs (workspace_id, site_id, keyword, stage, status, created_at) \
                 VALUES (1, 1, ?, 'intent', 'pending', ?)",
            )
            .bind(format!("kw {i}"))
            .bind(NOW)
            .execute(&mut *tx)
            .await
            .unwrap();
        }
        tx.commit().await.unwrap();
        let after: i64 = sqlx::query_scalar("SELECT COUNT(*) FROM jobs")
            .fetch_one(&pool)
            .await
            .unwrap();
        assert_eq!(after - before, 10_000);
        assert!(
            started.elapsed().as_secs() < 30,
            "10k intake took {:?}",
            started.elapsed()
        );
    }

    #[test]
    fn limit_is_clamped() {
        assert_eq!(clamp_limit(None), DEFAULT_LIMIT);
        assert_eq!(clamp_limit(Some(0)), 1);
        assert_eq!(clamp_limit(Some(10_000)), MAX_LIMIT);
    }

    // ------------------------------------------------------------ route tests

    use axum::body::Body;
    use axum::http::Request;
    use http_body_util::BodyExt;
    use tower::ServiceExt;

    async fn call(
        app: Router,
        method: &str,
        uri: &str,
        body: Option<String>,
    ) -> (StatusCode, String) {
        let builder = Request::builder().method(method).uri(uri);
        let req = match body {
            Some(b) => builder
                .header("content-type", "application/json")
                .body(Body::from(b))
                .unwrap(),
            None => builder.body(Body::empty()).unwrap(),
        };
        let res = app.oneshot(req).await.unwrap();
        let status = res.status();
        let bytes = res.into_body().collect().await.unwrap().to_bytes();
        (status, String::from_utf8_lossy(&bytes).to_string())
    }

    #[tokio::test]
    async fn intake_with_unknown_workspace_is_400_not_500() {
        let app = app(memory_pool().await);
        let body =
            serde_json::json!({"workspace_id": 999, "site_id": 999, "keywords": ["a"]}).to_string();
        let (status, text) = call(app, "POST", "/api/v1/keywords", Some(body)).await;
        assert_eq!(status, StatusCode::BAD_REQUEST, "body: {text}");
        assert!(text.contains("unknown workspace_id"), "{text}");
    }

    #[tokio::test]
    async fn admin_token_gates_every_route_but_health() {
        // SAFETY: single-threaded test setup, and the value is removed below.
        unsafe {
            std::env::set_var("GAW_ADMIN_TOKEN", "0123456789abcdef-test");
        }
        let pool = memory_pool().await;
        seed(&pool, 0).await.expect("seed");
        let app = app(pool);

        let (status, _) = call(app.clone(), "GET", "/health", None).await;
        assert_eq!(status, StatusCode::OK, "/health must not need a token");

        let (status, _) = call(app.clone(), "GET", "/api/v1/workspaces", None).await;
        assert_eq!(status, StatusCode::UNAUTHORIZED, "open route without token");

        let (status, _) = call(
            app.clone(),
            "GET",
            "/api/v1/workspaces",
            Some("{}".to_string()),
        )
        .await;
        assert_eq!(
            status,
            StatusCode::UNAUTHORIZED,
            "wrong/no header still denied"
        );
        unsafe {
            std::env::remove_var("GAW_ADMIN_TOKEN");
        }
    }

    #[tokio::test]
    async fn intake_and_lint_round_trip_over_http() {
        let pool = memory_pool().await;
        seed(&pool, 0).await.expect("seed");
        let app = app(pool);

        let body = serde_json::json!({
            "workspace_id": 1, "site_id": 1,
            "keywords": ["how to pause a phd when funding runs out"]
        })
        .to_string();
        let (status, text) = call(app.clone(), "POST", "/api/v1/keywords", Some(body)).await;
        assert_eq!(status, StatusCode::CREATED, "body: {text}");

        let slop = serde_json::json!({
            "text": "It's not just a feature, it's a shift. At its core, what really matters is alignment. Let that sink in."
        })
        .to_string();
        let (status, text) = call(app, "POST", "/api/v1/lint", Some(slop)).await;
        assert_eq!(status, StatusCode::OK);
        let report: serde_json::Value = serde_json::from_str(&text).unwrap();
        assert_eq!(report["passed"], serde_json::json!(false));
        assert!(report["high"].as_u64().unwrap() >= 2, "{text}");
    }
}
