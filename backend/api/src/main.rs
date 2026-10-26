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
    extract::{Request, State},
    http::StatusCode,
    middleware::{self, Next},
    response::{IntoResponse, Response},
    routing::{get, patch, post},
    Json, Router,
};
use serde::Serialize;
use sqlx::sqlite::{SqlitePool, SqlitePoolOptions};
use std::net::SocketAddr;

mod byline;
mod calendar;
mod deploy;
mod email;
mod ftp;
mod ftp_creds;
mod gate;
mod ghost;
mod ghost_api;
mod image;
mod images;
mod lease;
mod lint;
mod metrics;
mod pipeline;
mod provider;
mod providers;
mod runs;
mod secrets;
mod sites;
mod stages;
mod state;
mod worker;

const API_VERSION: &str = env!("CARGO_PKG_VERSION");
const MAX_LIMIT: i64 = 500;
const DEFAULT_LIMIT: i64 = 50;
pub(crate) const NOW: &str = "2026-10-22T00:00:00Z";

#[derive(Clone)]
pub struct AppState {
    pool: SqlitePool,
}

#[derive(Debug, Serialize)]
struct Health {
    status: &'static str,
    service: &'static str,
    version: &'static str,
    /// The commit this process was built from, so a deploy can prove it is
    /// serving. Render sets `RENDER_GIT_COMMIT`; otherwise `GIT_SHA`.
    commit: String,
}

fn build_commit() -> String {
    let raw = std::env::var("RENDER_GIT_COMMIT")
        .or_else(|_| std::env::var("GIT_SHA"))
        .or_else(|_| std::env::var("SOURCE_VERSION"))
        .unwrap_or_else(|_| "unknown".to_string());
    let trimmed = raw.trim();
    if trimmed.is_empty() {
        return "unknown".to_string();
    }
    trimmed.chars().take(7).collect()
}

async fn health() -> Json<Health> {
    Json(Health {
        status: "ok",
        service: "gaw-api",
        version: API_VERSION,
        commit: build_commit(),
    })
}

// ---------------------------------------------------------------- pagination

pub(crate) fn clamp_limit(limit: Option<i64>) -> i64 {
    limit.unwrap_or(DEFAULT_LIMIT).clamp(1, MAX_LIMIT)
}

// ---------------------------------------------------------------- rows

// ---------------------------------------------------------------- handlers

// ---------------------------------------------------------------- writing gate

// ---------------------------------------------------------------- worker routes

// ---------------------------------------------------------------- email routes

// ---------------------------------------------------------------- ghost routes

// ---------------------------------------------------------------- provider routes

pub(crate) fn default_workspace() -> i64 {
    1
}

// ---------------------------------------------------------------- errors

enum ApiError {
    BadRequest(&'static str),
    /// Like `BadRequest`, but the message is built at runtime (validation text from a
    /// module that owns the rule).
    Invalid(String),
    Db(sqlx::Error),
    /// A provider call failed. The message is already client-safe
    /// (`provider::safe_message`); the detail is logged where it happens.
    Upstream(String),
}

impl IntoResponse for ApiError {
    fn into_response(self) -> Response {
        let (status, code, message) = match self {
            ApiError::BadRequest(msg) => (StatusCode::BAD_REQUEST, "bad_request", msg.to_string()),
            ApiError::Invalid(msg) => (StatusCode::BAD_REQUEST, "bad_request", msg),
            ApiError::Upstream(msg) => (StatusCode::BAD_GATEWAY, "upstream", msg),
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

/// The route table, with no middleware.
///
/// The API surface, mounted under `/api`.
///
/// Kept separate from the public routes so the auth layer wraps only these:
/// when the token layer covered the whole router, an unknown path answered 401
/// instead of 404, which made it impossible to tell a missing route from a
/// missing credential — and impossible to prove from outside which build was
/// serving.
fn api_routes() -> Router<AppState> {
    Router::new()
        .route("/v1/workspaces", get(pipeline::list_workspaces))
        .route("/v1/jobs", get(pipeline::list_jobs))
        .route("/v1/keywords", post(pipeline::intake_keywords))
        .route("/v1/lint", post(lint::lint_text))
        .route("/v1/worker", get(worker::worker_status))
        .route("/v1/metrics", get(metrics::process_metrics))
        .route("/v1/worker/run-once", post(worker::worker_run_once))
        .route("/v1/image/pick", post(images::pick_image))
        .route("/v1/images/place", post(images::place_images))
        .route("/v1/images/read", post(images::read_media))
        .route("/v1/lease/heartbeat", post(lease::heartbeat))
        .route("/v1/lease/claim", post(lease::claim_lease))
        .route("/v1/lease/release", post(lease::release_lease))
        .route("/v1/state", get(state::load_state).post(state::save_state))
        .route("/v1/state/reset", post(state::reset_state))
        .route("/v1/pipeline/state", get(pipeline::pipeline_state))
        .route("/v1/articles/forget", post(pipeline::forget_articles))
        .route("/v1/pipeline/requeue", post(pipeline::requeue_job))
        .route("/v1/sites/ensure", post(sites::ensure_site))
        .route(
            "/v1/email/verification",
            post(email::send_email_verification),
        )
        .route("/v1/email/digest", post(email::send_email_digest))
        .route("/v1/ghost/check-url", post(ghost_api::check_ghost_url))
        .route("/v1/ghost/test", post(ghost_api::ghost_test))
        .route("/v1/ghost/sync", post(ghost_api::ghost_sync))
        .route("/v1/ghost/probe", post(ghost_api::ghost_probe))
        .route("/v1/ghost/publish", post(ghost_api::ghost_publish))
        .route("/v1/ghost/reweave", post(ghost_api::ghost_reweave))
        .route("/v1/ghost/mirror", post(ghost_api::ghost_mirror))
        .route(
            "/v1/deploy/cloudflare",
            post(deploy::deploy_cloudflare_handler),
        )
        .route("/v1/deploy/vercel", post(deploy::deploy_vercel_handler))
        .route("/v1/deploy/github", post(deploy::deploy_github_handler))
        .route("/v1/ftp/test", post(ftp::ftp_test))
        .route(
            "/v1/ftp/credentials",
            get(ftp_creds::load_ftp_credentials)
                .post(ftp_creds::save_ftp_credentials)
                .delete(ftp_creds::forget_ftp_credentials),
        )
        .route("/v1/ftp/upload", post(ftp::ftp_upload))
        .route("/v1/indexnow", post(ftp::index_now))
        .route(
            "/v1/providers/test-model",
            post(providers::test_model_handler),
        )
        .route("/v1/providers/models", post(providers::list_custom_models))
        .route("/v1/embeddings", post(providers::get_embedding))
        .route("/v1/scrape", post(providers::scrape_page))
        .route("/v1/search/tavily", post(providers::tavily_search_handler))
        .route(
            "/v1/search/firecrawl",
            post(providers::firecrawl_search_handler),
        )
        .route("/v1/providers/keys", get(providers::key_pool))
        .route("/v1/generate", post(providers::generate))
        .route(
            "/v1/providers",
            get(providers::list_provider_routes).post(providers::create_provider),
        )
        .route("/v1/providers/{id}", patch(providers::patch_provider))
}

/// Split out from `app` so the layers below can be read on their own; the tests
/// mount `app`, so they exercise the same routes the server serves.
fn routes() -> Router<AppState> {
    let api = api_routes().layer(middleware::from_fn_with_state(admin_token(), require_token));
    Router::new()
        .route("/health", get(health))
        .route("/media/{name}", get(images::serve_media))
        .nest("/api", api)
}

fn app(pool: SqlitePool) -> Router {
    routes()
        .layer(tower_http::trace::TraceLayer::new_for_http())
        .layer(cors_layer())
        .with_state(AppState { pool })
}

/// CORS for the SPA.
///
/// The frontend is served from a different origin than `gaw-api` (Vite in dev,
/// a separate static host in production), so every call is cross-origin. Two
/// things have to be right or the browser blocks everything:
///
///   1. The preflight `OPTIONS` must be answered *without* credentials, because
///      the browser does not attach `Authorization` to a preflight. The token
///      gate therefore skips OPTIONS and this layer answers it.
///   2. The origin must be echoed and the auth headers allowed, or the real
///      request is refused after a successful preflight.
///
/// A permissive origin is deliberate: this API is single-operator and gated by
/// the admin token, not by origin. A token in a browser bundle is readable by
/// anyone who loads the page, so origin-based restriction would buy nothing.
fn cors_layer() -> tower_http::cors::CorsLayer {
    tower_http::cors::CorsLayer::new()
        .allow_origin(tower_http::cors::Any)
        .allow_methods([
            axum::http::Method::GET,
            axum::http::Method::POST,
            axum::http::Method::OPTIONS,
        ])
        .allow_headers([
            axum::http::header::AUTHORIZATION,
            axum::http::header::CONTENT_TYPE,
            axum::http::HeaderName::from_static("x-api-token"),
        ])
        .max_age(std::time::Duration::from_secs(600))
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
    // A CORS preflight never carries credentials — the browser sends it before
    // it is allowed to send the Authorization header at all. Refusing it makes
    // every cross-origin call from the SPA fail before it starts, so preflight
    // is answered by the CORS layer alone and never reaches this gate.
    if req.method() == axum::http::Method::OPTIONS {
        return next.run(req).await;
    }
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
    // The browser is pinned to workspace 1 (`WORKSPACE_ID` in the store), and
    // providers, sites, jobs and app_state all carry a foreign key to
    // `workspaces`. A real deployment has no rows — `seed()` is dev-only — so
    // every write died on "unknown workspace_id" and API keys were never saved.
    ensure_default_workspace(&pool).await?;
    Ok(pool)
}

/// Create the default workspace if it is missing. Idempotent.
async fn ensure_default_workspace(pool: &SqlitePool) -> Result<(), sqlx::Error> {
    let exists: i64 = sqlx::query_scalar("SELECT COUNT(*) FROM workspaces WHERE id = 1")
        .fetch_one(pool)
        .await?;
    if exists == 0 {
        sqlx::query("INSERT INTO workspaces (id, name, created_at) VALUES (1, ?, ?)")
            .bind("Default workspace")
            .bind(NOW)
            .execute(pool)
            .await?;
    }
    Ok(())
}

/// Dev seeding: 10 workspaces + 10 websites, plus `jobs` queued rows.
/// `SEED=1` alone seeds structure only; `SEED_JOBS=N` adds N queued jobs.
async fn seed(pool: &SqlitePool, jobs: i64) -> Result<(), sqlx::Error> {
    // The bootstrap always creates workspace 1, so an empty table is no longer the
    // signal that nothing has been seeded. Seed when the default row is all there is.
    let existing: i64 = sqlx::query_scalar("SELECT COUNT(*) FROM workspaces WHERE id > 1")
        .fetch_one(pool)
        .await?;
    if existing > 0 {
        return Ok(());
    }
    let mut tx = pool.begin().await?;
    for id in 1..=10i64 {
        sqlx::query("INSERT OR IGNORE INTO workspaces (id, name, created_at) VALUES (?, ?, ?)")
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

    // Credentials in the stored snapshot are encrypted at rest. Warn loudly
    // when the key cannot survive a redeploy — losing it makes every stored
    // secret permanently unreadable, and the failure is silent at read time.
    let source = secrets::key_source();
    if source.is_unsafe_for_production() {
        tracing::warn!(
            "encryption key source is {:?}: stored credentials will NOT survive a \
             redeploy once the filesystem is reset. Set GAW_ENC_KEY on the host.",
            source
        );
    } else {
        tracing::info!("state encryption key source: {source:?}");
    }

    // Close the plaintext window left by the pre-encryption store.
    match state::seal_existing(&pool).await {
        Ok((0, 0)) => {}
        Ok((0, bad)) if bad > 0 => {
            tracing::warn!("{bad} stored state row(s) could not be parsed and were left alone");
        }
        Ok((fixed, bad)) => {
            tracing::info!(
                "sealed credentials in {fixed} previously-plaintext state row(s){}",
                if bad > 0 {
                    format!(", {bad} unparseable and skipped")
                } else {
                    String::new()
                }
            );
        }
        Err(e) => tracing::warn!("could not re-seal existing state rows: {e}"),
    }

    // Provider keys were written raw under a column named `key_enc`. Seal the
    // ones already on disk so a database copy is useless without the key.
    match provider::seal_existing_keys(&pool).await {
        Ok(0) => {}
        Ok(n) => tracing::info!("sealed {n} previously-plaintext provider key(s)"),
        Err(e) => tracing::warn!("could not re-seal existing provider keys: {e}"),
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

        // Calendar automation belongs here, not in a browser tab: the queue must
        // keep filling after every tab closes. Runs on its own task so a slow
        // pulse can never delay a job claim.
        let pool_cal = pool.clone();
        tokio::spawn(async move {
            let interval = std::time::Duration::from_secs(calendar::DEFAULT_INTERVAL_SECS);
            loop {
                let now_ms = std::time::SystemTime::now()
                    .duration_since(std::time::UNIX_EPOCH)
                    .map(|d| d.as_millis() as i64)
                    .unwrap_or(0);
                match calendar::pulse_all(&pool_cal, now_ms).await {
                    Ok(summary)
                        if summary.queued > 0
                            || summary.published > 0
                            || summary.held > 0
                            || summary.failed > 0
                            || summary.reweaved > 0
                            || summary.skipped_no_site > 0 =>
                    {
                        tracing::info!(
                            "calendar pulse: queued {}, published {}, held {}, failed {}, reweaved {}, skipped {}",
                            summary.queued,
                            summary.published,
                            summary.held,
                            summary.failed,
                            summary.reweaved,
                            summary.skipped_no_site
                        )
                    }
                    Ok(_) => {}
                    Err(error) => tracing::warn!("calendar pulse failed: {error}"),
                }
                tokio::time::sleep(interval).await;
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
    use std::time::Instant;

    async fn memory_pool() -> SqlitePool {
        connect("sqlite::memory:").await.expect("memory db")
    }

    /// The browser is pinned to workspace 1 and every write carries a foreign key to
    /// `workspaces`. A deployment has no rows (`seed()` is dev-only), so saving a
    /// provider answered "unknown workspace_id" and no API key ever persisted.
    #[tokio::test]
    async fn the_default_workspace_exists_so_writes_can_reference_it() {
        let pool = memory_pool().await;
        let before: i64 = sqlx::query_scalar("SELECT COUNT(*) FROM workspaces")
            .fetch_one(&pool)
            .await
            .expect("count");
        // `connect` bootstraps, so the row is there before any request arrives.
        assert_eq!(
            before, 1,
            "the default workspace must exist after migration"
        );
        let name: String = sqlx::query_scalar("SELECT name FROM workspaces WHERE id = 1")
            .fetch_one(&pool)
            .await
            .expect("workspace 1");
        assert!(!name.is_empty());
        // Idempotent: running it again must not fail or duplicate.
        ensure_default_workspace(&pool).await.expect("idempotent");
        let after: i64 = sqlx::query_scalar("SELECT COUNT(*) FROM workspaces")
            .fetch_one(&pool)
            .await
            .expect("count");
        assert_eq!(after, 1);
    }

    #[tokio::test]
    async fn a_provider_can_be_saved_because_the_workspace_exists() {
        let pool = memory_pool().await;
        let row = crate::provider::insert_provider(
            &pool,
            NOW,
            &crate::provider::NewProvider {
                workspace_id: 1,
                provider: "custom".into(),
                label: "My key".into(),
                api_key: "sk-test-1234567890".into(),
                kind: Some("custom".into()),
                base_url: Some("https://api.example.com/v1".into()),
                model_id: "some-model".into(),
                price_in_per_mtok: 0.0,
                price_out_per_mtok: 0.0,
                max_tokens: None,
                temperature: None,
                role: None,
                is_default: true,
            },
        )
        .await
        .expect("a key must save against the bootstrapped workspace");
        assert!(row >= 1);
    }

    #[tokio::test]
    async fn update_keeps_the_sealed_credential_on_a_blank_secret() {
        let pool = memory_pool().await;
        let id = crate::provider::insert_provider(
            &pool,
            NOW,
            &crate::provider::NewProvider {
                workspace_id: 1,
                provider: "custom".into(),
                label: "My key".into(),
                api_key: "sk-pro...4032".into(),
                kind: Some("openai_compatible".into()),
                base_url: Some("https://api.example.com/v1".into()),
                model_id: "model-a".into(),
                price_in_per_mtok: 0.5,
                price_out_per_mtok: 0.7,
                max_tokens: None,
                temperature: None,
                role: None,
                is_default: false,
            },
        )
        .await
        .expect("insert");
        let before: (String, String) =
            sqlx::query_as("SELECT key_enc, key_hint FROM ai_keys WHERE id = ?")
                .bind(id)
                .fetch_one(&pool)
                .await
                .expect("SELECT");
        assert!(before.0.starts_with("enc:v1:"));

        // Blank secret + a changed model/base URL: everything else holds.
        crate::provider::update_provider(
            &pool,
            id,
            &crate::provider::UpdateProvider {
                workspace_id: 1,
                label: "My key (edited)".into(),
                model_id: "model-b".into(),
                base_url: Some("https://api2.example.com/v1".into()),
                api_key: String::new(),
                priority: 55,
            },
        )
        .await
        .expect("update must not fail");

        let after: (String, String, String, String, i64) = sqlx::query_as(
            "SELECT key_enc, key_hint, model_id, base_url, priority FROM ai_keys WHERE id = ?",
        )
        .bind(id)
        .fetch_one(&pool)
        .await
        .expect("after");
        assert_eq!(after.0, before.0); // sealed credential untouched
        assert_eq!(after.1, before.1); // hint survives a blank-secret edit
        assert_eq!(after.2, "model-b");
        assert_eq!(after.3, "https://api2.example.com/v1");
        assert_eq!(after.4, 55);
    }

    #[tokio::test]
    async fn update_404s_on_an_unknown_id() {
        let pool = memory_pool().await;
        let err = crate::provider::update_provider(
            &pool,
            9999,
            &crate::provider::UpdateProvider {
                workspace_id: 1,
                label: "ghost".into(),
                model_id: "m".into(),
                base_url: None,
                api_key: "sk-x".into(),
                priority: 1,
            },
        )
        .await
        .expect_err("unknown id must be RowNotFound");
        assert!(matches!(err, sqlx::Error::RowNotFound));
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

    /// Intake groups its jobs under one run, so the UI has something to show
    /// as a run rather than a flat list of orphaned jobs.
    #[tokio::test]
    async fn intake_creates_one_run_and_attaches_every_job_to_it() {
        let pool = memory_pool().await;
        seed(&pool, 0).await.expect("seed");
        let app = app(pool.clone());

        let body = serde_json::json!({
            "workspace_id": 1,
            "site_id": 1,
            "keywords": ["a", "b", "c"]
        })
        .to_string();
        let (status, text) = call(app, "POST", "/api/v1/keywords", Some(body)).await;
        assert_eq!(status, StatusCode::CREATED, "body: {text}");
        let out: serde_json::Value = serde_json::from_str(&text).unwrap();
        let run_id = out["run_id"].as_i64().expect("run_id in the response");

        let runs: i64 = sqlx::query_scalar("SELECT COUNT(*) FROM runs WHERE id = ?")
            .bind(run_id)
            .fetch_one(&pool)
            .await
            .unwrap();
        assert_eq!(runs, 1, "one run per intake call");

        let attached: i64 = sqlx::query_scalar("SELECT COUNT(*) FROM jobs WHERE run_id = ?")
            .bind(run_id)
            .fetch_one(&pool)
            .await
            .unwrap();
        assert_eq!(attached, 3, "every ingested keyword belongs to the run");

        let orphans: i64 = sqlx::query_scalar("SELECT COUNT(*) FROM jobs WHERE run_id IS NULL")
            .fetch_one(&pool)
            .await
            .unwrap();
        assert_eq!(orphans, 0, "no job should be left without a run");
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

    /// The pool endpoint reports demotions in order and never leaks a key.
    #[tokio::test]
    async fn the_key_pool_reports_order_and_health_without_the_key() {
        unsafe {
            std::env::remove_var("GAW_ADMIN_TOKEN");
        }
        let pool = memory_pool().await;
        seed(&pool, 0).await.expect("seed");
        sqlx::query(
            "INSERT INTO ai_keys (id,workspace_id,provider,label,key_enc,key_hint,priority,status,role,created_at) \
             VALUES (1,1,'openai','main','sk-secret-value','••••1234',50,'VERIFIED','text','2026-01-01T00:00:00Z')",
        )
        .execute(&pool)
        .await
        .unwrap();
        sqlx::query("UPDATE ai_keys SET disabled = 1 WHERE id = 1")
            .execute(&pool)
            .await
            .unwrap();

        let (status, body) = call(
            app(pool.clone()),
            "GET",
            "/api/v1/providers/keys?workspace_id=1",
            None,
        )
        .await;
        assert_eq!(status, StatusCode::OK);
        let text = body;
        assert!(
            text.contains("Paused"),
            "a rejected key must be reported as paused: {text}"
        );
        assert!(
            text.contains("key_hint"),
            "the masked hint is how the UI identifies a key: {text}"
        );
        assert!(
            !text.contains("sk-secret-value"),
            "the key itself must never leave the API: {text}"
        );
    }

    /// With no provider configured the call must still answer (the mock
    /// fallback), and the spend must still reach the ledger — a browser fetch
    /// that skips cost accounting would make the usage numbers lie.
    #[tokio::test]
    async fn generate_without_a_configured_key_answers_and_records_spend() {
        let pool = memory_pool().await;
        seed(&pool, 0).await.expect("seed");
        let app = app(pool.clone());

        let body = serde_json::json!({
            "workspace_id": 1,
            "system": "be brief",
            "user": "say hi"
        })
        .to_string();
        let (status, text) = call(app, "POST", "/api/v1/generate", Some(body)).await;
        assert_eq!(status, StatusCode::OK, "body: {text}");
        let out: serde_json::Value = serde_json::from_str(&text).unwrap();
        assert!(
            out["text"].as_str().map(|t| !t.is_empty()).unwrap_or(false),
            "text should be non-empty: {text}"
        );
        assert!(out["model"].is_string(), "model is reported: {text}");

        let rows: i64 = sqlx::query_scalar("SELECT COUNT(*) FROM usage_ledger")
            .fetch_one(&pool)
            .await
            .unwrap();
        assert_eq!(rows, 1, "the call is recorded as spend");
    }

    #[tokio::test]
    async fn generate_rejects_an_empty_prompt() {
        let pool = memory_pool().await;
        seed(&pool, 0).await.expect("seed");
        let app = app(pool);
        let body = serde_json::json!({ "workspace_id": 1, "user": "   " }).to_string();
        let (status, _) = call(app, "POST", "/api/v1/generate", Some(body)).await;
        assert_eq!(status, StatusCode::BAD_REQUEST);
    }

    /// Provider error bodies are never forwarded to a browser: some echo the
    /// request, which would put key material in the page.
    #[test]
    fn provider_failures_never_echo_the_response_body() {
        let leaked = provider::EngineError::Http(500, "sk-live-abc123 rejected".into());
        let msg = provider::safe_message(&leaked);
        assert_eq!(msg, "provider returned http 500");
        assert!(
            !msg.contains("sk-live"),
            "must not carry key material: {msg}"
        );

        assert_eq!(
            provider::safe_message(&provider::EngineError::Http(401, "nope".into())),
            "The provider refused the key."
        );
        assert_eq!(
            provider::safe_message(&provider::EngineError::Transport("dns".into())),
            "provider unreachable"
        );
    }

    /// The browser preflight must succeed without credentials, or every
    /// cross-origin call from the SPA dies before it is sent. This is the
    /// exact request a browser makes before POST /api/v1/lease/claim.
    #[tokio::test]
    async fn cors_preflight_is_answered_without_a_token() {
        // SAFETY: single-threaded test setup, and the value is removed below.
        unsafe {
            std::env::set_var("GAW_ADMIN_TOKEN", "0123456789abcdef-test");
        }
        let pool = memory_pool().await;
        seed(&pool, 0).await.expect("seed");

        // The shared `call` helper has no header support, so build the request
        // directly — a preflight is exactly a header-driven request.
        let req = Request::builder()
            .method("OPTIONS")
            .uri("/api/v1/lease/claim")
            .header("origin", "https://studio.example")
            .header("access-control-request-method", "POST")
            .header(
                "access-control-request-headers",
                "authorization,content-type",
            )
            .body(Body::empty())
            .unwrap();
        let resp = app(pool).oneshot(req).await.unwrap();

        assert!(
            resp.status().is_success(),
            "preflight must not be rejected by the token gate, got {}",
            resp.status()
        );
        let allow_origin = resp
            .headers()
            .get("access-control-allow-origin")
            .and_then(|v| v.to_str().ok());
        assert!(
            allow_origin.is_some(),
            "no access-control-allow-origin: the browser would block the real call"
        );
        let allow_headers = resp
            .headers()
            .get("access-control-allow-headers")
            .and_then(|v| v.to_str().ok())
            .unwrap_or("")
            .to_lowercase();
        assert!(
            allow_headers.contains("authorization"),
            "the Authorization header must be allowed or the bearer token is stripped"
        );

        // SAFETY: single-threaded test teardown.
        unsafe {
            std::env::remove_var("GAW_ADMIN_TOKEN");
        }
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

    /// A missing route must answer 404 even when a token is configured. While
    /// the auth layer wrapped the whole router, every unknown path returned 401,
    /// so "route exists but you are unauthenticated" and "no such route" were
    /// indistinguishable from outside — which is why deploys could not be
    /// verified.
    #[tokio::test]
    async fn an_unknown_path_is_404_not_401() {
        // SAFETY: single-threaded test setup, and the value is removed below.
        unsafe {
            std::env::set_var("GAW_ADMIN_TOKEN", "0123456789abcdef-test");
        }
        let pool = memory_pool().await;
        seed(&pool, 0).await.expect("seed");
        let app = app(pool);

        for path in ["/api/v1/not-a-real-route", "/nope", "/api/v2/workspaces"] {
            let (status, _) = call(app.clone(), "GET", path, None).await;
            assert_eq!(
                status,
                StatusCode::NOT_FOUND,
                "{path} must be 404, not an auth failure"
            );
        }

        let (status, _) = call(app.clone(), "GET", "/api/v1/workspaces", None).await;
        assert_eq!(status, StatusCode::UNAUTHORIZED, "a real route stays gated");

        unsafe {
            std::env::remove_var("GAW_ADMIN_TOKEN");
        }
    }

    /// `/health` carries the build's commit so a deploy can prove what is live.
    #[tokio::test]
    async fn health_reports_a_build_commit() {
        let pool = memory_pool().await;
        seed(&pool, 0).await.expect("seed");
        let app = app(pool);

        let (status, body) = call(app, "GET", "/health", None).await;
        assert_eq!(status, StatusCode::OK);
        let json: serde_json::Value = serde_json::from_str(&body).expect("health is JSON");
        let commit = json
            .get("commit")
            .and_then(|value| value.as_str())
            .expect("health must report a commit");
        assert!(!commit.is_empty(), "commit must not be blank");
        assert!(
            commit == "unknown" || commit.chars().count() <= 7,
            "commit is short: {commit}"
        );
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
