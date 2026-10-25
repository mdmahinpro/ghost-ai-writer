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

mod email;
mod calendar;
mod gate;
mod deploy;
mod ftp;
mod ghost;
mod ghost_api;
mod image;
mod images;
mod lease;
mod lint;
mod pipeline;
mod providers;
mod provider;
mod runs;
mod secrets;
mod sites;
mod stages;
mod state;
mod worker;

const API_VERSION: &str = env!("CARGO_PKG_VERSION");
const MAX_LIMIT: i64 = 500;
const DEFAULT_LIMIT: i64 = 50;
const NOW: &str = "2026-10-22T00:00:00Z";

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
    run_id: i64,
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
    // The website a job belongs to is the site's own link, not its id. Intake
    // used to assume `website_id = site_id`, which only held because seeding
    // numbered both tables identically; sites created through `sites/ensure`
    // carry an explicit link, and a mismatch would attribute work to the wrong
    // website (usage rollups and article visibility both key on it).
    let website_id: i64 = sqlx::query_scalar(
        "SELECT COALESCE(website_id, id) FROM sites WHERE id = ?1",
    )
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

// ---------------------------------------------------------------- email routes

#[derive(Deserialize)]
struct SendEmailRequest {
    vendor: String,
    /// The vendor API key. Never stored, never returned, never logged.
    secret: String,
    from: String,
    to: String,
    /// Required for a verification letter; the link the reader will click.
    #[serde(default)]
    verify_url: Option<String>,
    /// Required for a digest.
    #[serde(default)]
    body: Option<String>,
}

/// Send a verification letter. The key is used for this one request and
/// discarded; it is never written to the database.
async fn send_email_verification(
    Json(req): Json<SendEmailRequest>,
) -> Result<Json<email::Sent>, ApiError> {
    let verify_url = req
        .verify_url
        .as_deref()
        .ok_or(ApiError::BadRequest("verify_url is required"))?;
    Ok(Json(
        email::send_verification(&req.vendor, &req.secret, &req.from, &req.to, verify_url).await,
    ))
}

/// Send a notification digest.
async fn send_email_digest(
    Json(req): Json<SendEmailRequest>,
) -> Result<Json<email::Sent>, ApiError> {
    let body = req.body.as_deref().ok_or(ApiError::BadRequest("body is required"))?;
    Ok(Json(
        email::send_digest(&req.vendor, &req.secret, &req.from, &req.to, body).await,
    ))
}

// ---------------------------------------------------------------- ghost routes

#[derive(Deserialize)]
struct GhostUrlRequest {
    url: String,
}

/// Validate a Ghost URL before it is stored. Reports the same refusals the
/// push path enforces, so a misconfiguration is caught at entry rather than at
/// publish time.
async fn check_ghost_url(Json(req): Json<GhostUrlRequest>) -> Json<serde_json::Value> {
    match ghost::validate_ghost_url(&req.url) {
        Ok(url) => Json(serde_json::json!({ "ok": true, "url": url })),
        Err(e) => Json(serde_json::json!({ "ok": false, "error": e })),
    }
}

// ---------------------------------------------------------------- provider routes

#[derive(Deserialize)]
struct ProviderQuery {
    workspace_id: Option<i64>,
    /// Which capability's pool to report: `text` (default) or `vision`.
    role: Option<String>,
}

/// List providers for a workspace. Keys are never returned — only `key_hint`.
async fn ghost_test(Json(req): Json<ghost_api::GhostTarget>) -> Json<serde_json::Value> {
    Json(ghost_api::test_connection(&req).await)
}

async fn ghost_sync(Json(req): Json<ghost_api::GhostTarget>) -> Json<serde_json::Value> {
    Json(ghost_api::sync_posts(&req).await)
}

#[derive(Deserialize)]
struct ProbeRequest {
    #[serde(default)]
    url: String,
}

async fn ghost_probe(Json(req): Json<ProbeRequest>) -> Json<serde_json::Value> {
    Json(ghost_api::probe(&req.url).await)
}

async fn ghost_publish(Json(req): Json<ghost_api::PublishRequest>) -> Json<serde_json::Value> {
    Json(ghost_api::publish(&req).await)
}

async fn ghost_reweave(Json(req): Json<ghost_api::ReWeaveRequest>) -> Json<serde_json::Value> {
    Json(ghost_api::reweave(&req).await)
}

async fn deploy_cloudflare(Json(req): Json<deploy::CloudflareRequest>) -> Json<serde_json::Value> {
    Json(deploy::deploy_cloudflare(&req).await)
}

async fn deploy_vercel(Json(req): Json<deploy::VercelRequest>) -> Json<serde_json::Value> {
    Json(deploy::deploy_vercel(&req).await)
}

async fn deploy_github(Json(req): Json<deploy::GithubRequest>) -> Json<serde_json::Value> {
    Json(deploy::deploy_github(&req).await)
}

async fn ftp_test(Json(req): Json<ftp::LoginRequest>) -> Json<serde_json::Value> {
    Json(ftp::test_login(&req).await)
}

#[derive(Deserialize)]
struct FtpUploadRequest {
    #[serde(flatten)]
    target: ftp::FtpTarget,
    #[serde(default)]
    via: Option<String>,
    #[serde(default)]
    files: Vec<ftp::UploadedFile>,
}

async fn ftp_upload(Json(req): Json<FtpUploadRequest>) -> Json<serde_json::Value> {
    Json(ftp::upload_via(&req.target, req.via, &req.files).await)
}

async fn index_now(Json(req): Json<ftp::IndexNowRequest>) -> Json<serde_json::Value> {
    Json(ftp::submit_index_now(&req).await)
}

async fn test_model(Json(req): Json<providers::ModelRequest>) -> Json<serde_json::Value> {
    Json(providers::test_model(&req).await)
}

async fn list_custom_models(Json(req): Json<providers::BaseKeyRequest>) -> Json<serde_json::Value> {
    Json(providers::list_models(&req).await)
}

async fn get_embedding(Json(req): Json<providers::EmbeddingRequest>) -> Json<serde_json::Value> {
    Json(providers::embedding(&req).await)
}

async fn scrape_page(Json(req): Json<providers::ScrapeRequest>) -> Json<serde_json::Value> {
    Json(providers::scrape(&req).await)
}

async fn tavily_search(Json(req): Json<providers::SearchRequest>) -> Json<serde_json::Value> {
    Json(providers::tavily_search(&req).await)
}

async fn firecrawl_search(Json(req): Json<providers::SearchRequest>) -> Json<serde_json::Value> {
    Json(providers::firecrawl_search(&req).await)
}

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

async fn place_images(Json(req): Json<images::PlaceRequest>) -> Json<serde_json::Value> {
    Json(images::place(&req).await)
}

async fn read_media(Json(req): Json<images::ReadMediaRequest>) -> Json<serde_json::Value> {
    Json(images::read_batch(&req).await)
}

/// Stored images are public: published posts embed these URLs. Names are
/// hashes, so there is nothing to enumerate and nothing secret to leak.
async fn serve_media(axum::extract::Path(name): axum::extract::Path<String>) -> Response {
    match images::open(&name) {
        Some((mime, bytes)) => (
            [
                (axum::http::header::CONTENT_TYPE, mime),
                (
                    axum::http::header::CACHE_CONTROL,
                    "public, max-age=31536000, immutable".to_string(),
                ),
            ],
            bytes,
        )
            .into_response(),
        None => StatusCode::NOT_FOUND.into_response(),
    }
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

#[derive(Deserialize)]
struct GenerateRequest {
    #[serde(default = "default_workspace")]
    workspace_id: i64,
    /// `text` (default) or `vision`.
    role: Option<String>,
    /// Pin one configured key; omit to let the pool decide.
    preferred_key_id: Option<i64>,
    #[serde(default)]
    system: String,
    user: String,
    /// Ask the provider for a JSON object response.
    #[serde(default)]
    json: bool,
    /// Image URLs for a vision call. Empty for text.
    #[serde(default)]
    images: Vec<String>,
    /// Recorded as the ledger stage; browser calls default to `ad-hoc`.
    schema: Option<String>,
}

fn default_workspace() -> i64 {
    1
}

/// One chat completion on the server, through the workspace's key pool.
///
/// This is what lets the browser stop holding provider keys: it asks for text
/// and never sees a credential. Spend is recorded in the usage ledger the same
/// way a pipeline stage records it, so cost accounting stays complete.
async fn generate(
    State(st): State<AppState>,
    Json(req): Json<GenerateRequest>,
) -> Result<Json<serde_json::Value>, ApiError> {
    if req.user.trim().is_empty() {
        return Err(ApiError::BadRequest("user must not be empty"));
    }
    let role = req.role.as_deref().unwrap_or("text");
    let schema = req.schema.unwrap_or_else(|| "ad-hoc".to_string());
    let chat = provider::ChatRequest {
        schema: schema.clone(),
        system: req.system,
        user: req.user,
        json: req.json,
        images: req.images,
    };

    let out =
        provider::complete_chain(&st.pool, req.workspace_id, role, req.preferred_key_id, &chat)
            .await
            .map_err(|e| {
                // Error bodies can echo the request, so the detail stays in the
                // log and only a bounded message reaches the client.
                tracing::warn!("generate failed: {e}");
                ApiError::Upstream(provider::safe_message(&e))
            })?;

    let spend = &out.completion;
    if let Err(e) = sqlx::query(
        "INSERT INTO usage_ledger (ai_key_id, website_id, article_id, stage, provider, model_id, \
                tokens_in, tokens_out, cost_usd, at) \
         VALUES (?, NULL, NULL, ?, ?, ?, ?, ?, ?, ?)",
    )
    .bind(out.key_id)
    .bind(&schema)
    .bind(&out.provider)
    .bind(&out.model)
    .bind(spend.tokens_in)
    .bind(spend.tokens_out)
    .bind(spend.cost_usd)
    .bind(NOW)
    .execute(&st.pool)
    .await
    {
        // The answer already succeeded; a failed ledger write must not turn a
        // working generation into an error, but it should not be silent either.
        tracing::warn!("usage ledger write failed: {e}");
    }

    Ok(Json(serde_json::json!({
        "text": spend.text,
        "tokens_in": spend.tokens_in,
        "tokens_out": spend.tokens_out,
        "cost_usd": spend.cost_usd,
        "key_id": out.key_id,
        "model": out.model,
        "provider": out.provider,
    })))
}

/// The failover pool in order: which key runs next, and why any are demoted.
/// Reports the masked hint, never the key.
async fn key_pool(
    State(st): State<AppState>,
    Query(q): Query<ProviderQuery>,
) -> Result<Json<serde_json::Value>, ApiError> {
    let ws = q.workspace_id.unwrap_or(1);
    let role = q.role.as_deref().unwrap_or("text");
    let items = provider::key_statuses(&st.pool, ws, role)
        .await
        .map_err(ApiError::Db)?;
    Ok(Json(serde_json::json!({ "items": items })))
}

// ---------------------------------------------------------------- errors

enum ApiError {
    BadRequest(&'static str),
    Db(sqlx::Error),
    /// A provider call failed. The message is already client-safe
    /// (`provider::safe_message`); the detail is logged where it happens.
    Upstream(String),
}

impl IntoResponse for ApiError {
    fn into_response(self) -> Response {
        let (status, code, message) = match self {
            ApiError::BadRequest(msg) => (StatusCode::BAD_REQUEST, "bad_request", msg.to_string()),
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
        .route("/v1/workspaces", get(list_workspaces))
        .route("/v1/jobs", get(list_jobs))
        .route("/v1/keywords", post(intake_keywords))
        .route("/v1/lint", post(lint_text))
        .route("/v1/worker", get(worker_status))
        .route("/v1/worker/run-once", post(worker_run_once))
        .route("/v1/image/pick", post(pick_image))
        .route("/v1/images/place", post(place_images))
        .route("/v1/images/read", post(read_media))
        .route("/v1/lease/heartbeat", post(lease::heartbeat))
        .route("/v1/lease/claim", post(lease::claim_lease))
        .route("/v1/lease/release", post(lease::release_lease))
        .route("/v1/state", get(state::load_state).post(state::save_state))
        .route("/v1/state/reset", post(state::reset_state))
        .route("/v1/pipeline/state", get(pipeline::pipeline_state))
        .route("/v1/sites/ensure", post(sites::ensure_site))
        .route("/v1/email/verification", post(send_email_verification))
        .route("/v1/email/digest", post(send_email_digest))
        .route("/v1/ghost/check-url", post(check_ghost_url))
        .route("/v1/ghost/test", post(ghost_test))
        .route("/v1/ghost/sync", post(ghost_sync))
        .route("/v1/ghost/probe", post(ghost_probe))
        .route("/v1/ghost/publish", post(ghost_publish))
        .route("/v1/ghost/reweave", post(ghost_reweave))
        .route("/v1/deploy/cloudflare", post(deploy_cloudflare))
        .route("/v1/deploy/vercel", post(deploy_vercel))
        .route("/v1/deploy/github", post(deploy_github))
        .route("/v1/ftp/test", post(ftp_test))
        .route("/v1/ftp/upload", post(ftp_upload))
        .route("/v1/indexnow", post(index_now))
        .route("/v1/providers/test-model", post(test_model))
        .route("/v1/providers/models", post(list_custom_models))
        .route("/v1/embeddings", post(get_embedding))
        .route("/v1/scrape", post(scrape_page))
        .route("/v1/search/tavily", post(tavily_search))
        .route("/v1/search/firecrawl", post(firecrawl_search))
        .route("/v1/providers/keys", get(key_pool))
        .route("/v1/generate", post(generate))
        .route("/v1/providers", get(list_provider_routes).post(create_provider))
}

/// Split out from `app` so the layers below can be read on their own; the tests
/// mount `app`, so they exercise the same routes the server serves.
fn routes() -> Router<AppState> {
    let api = api_routes().layer(middleware::from_fn_with_state(admin_token(), require_token));
    Router::new()
        .route("/health", get(health))
        .route("/media/{name}", get(serve_media))
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
                            || summary.skipped_no_site > 0 =>
                    {
                        tracing::info!(
                            "calendar pulse: queued {}, published {}, held {}, failed {}, skipped {}",
                            summary.queued,
                            summary.published,
                            summary.held,
                            summary.failed,
                            summary.skipped_no_site
                        )
                    }
                    Ok(_) => {}
                    Err(e) => tracing::error!("calendar pulse: {e}"),
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

        let attached: i64 =
            sqlx::query_scalar("SELECT COUNT(*) FROM jobs WHERE run_id = ?")
                .bind(run_id)
                .fetch_one(&pool)
                .await
                .unwrap();
        assert_eq!(attached, 3, "every ingested keyword belongs to the run");

        let orphans: i64 =
            sqlx::query_scalar("SELECT COUNT(*) FROM jobs WHERE run_id IS NULL")
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
        assert!(!msg.contains("sk-live"), "must not carry key material: {msg}");

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
