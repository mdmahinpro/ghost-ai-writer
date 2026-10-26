//! Provider probes and web retrieval: model test, model list, embeddings,
//! Firecrawl scrape/search, Tavily search.
//!
//! These were Node server functions. They only existed to reach a third-party API
//! and to keep the operator's key off the page, which is what the API already
//! does for every other provider call. Endpoints are normalised from whatever
//! base URL the operator typed, and every target must be public https so the API
//! cannot be pointed at its own network.

use serde::Deserialize;
use serde_json::{json, Value};

const FIRECRAWL: &str = "https://api.firecrawl.dev";
const TAVILY: &str = "https://api.tavily.com";

fn failure(error: impl Into<String>) -> Value {
    json!({ "ok": false, "error": error.into() })
}

fn failure_status(status: u16, error: impl Into<String>) -> Value {
    json!({ "ok": false, "status": status, "error": error.into() })
}

/// A provider error body can echo the Authorization header.
fn safe_message(text: &str) -> String {
    let lower = text.to_ascii_lowercase();
    if ["api_key", "apikey", "authorization", "bearer", "secret"]
        .iter()
        .any(|needle| lower.contains(needle))
    {
        return "The provider refused the key.".to_string();
    }
    text.chars().take(180).collect()
}

fn trim_base(base: &str) -> String {
    base.trim().trim_end_matches('/').to_string()
}

/// The path component of an absolute URL, without a trailing slash.
fn path_of(url: &str) -> String {
    let after_scheme = match url.split_once("://") {
        Some((_, rest)) => rest,
        None => url,
    };
    match after_scheme.find('/') {
        Some(index) => after_scheme[index..].trim_end_matches('/').to_string(),
        None => String::new(),
    }
}

fn chat_endpoint(base: &str) -> String {
    let trimmed = trim_base(base);
    if trimmed.ends_with("/chat/completions") {
        return trimmed;
    }
    if !path_of(&trimmed).is_empty() {
        format!("{trimmed}/chat/completions")
    } else {
        format!("{trimmed}/v1/chat/completions")
    }
}

fn without_chat(base: &str) -> String {
    let trimmed = trim_base(base);
    match trimmed.strip_suffix("/chat/completions") {
        Some(rest) => rest.trim_end_matches('/').to_string(),
        None => trimmed,
    }
}

fn models_endpoint(base: &str) -> String {
    let trimmed = trim_base(base);
    if trimmed.ends_with("/models") {
        return trimmed;
    }
    let base = without_chat(base);
    if !path_of(&base).is_empty() {
        format!("{base}/models")
    } else {
        format!("{base}/v1/models")
    }
}

fn embeddings_endpoint(base: &str) -> String {
    let trimmed = trim_base(base);
    if trimmed.ends_with("/embeddings") {
        return trimmed;
    }
    let base = without_chat(base);
    if !path_of(&base).is_empty() {
        format!("{base}/embeddings")
    } else {
        format!("{base}/v1/embeddings")
    }
}

/// Public https only: the API must never be a proxy into its own network.
fn require_public_https(raw: &str) -> Result<String, String> {
    let trimmed = raw.trim();
    let Some(rest) = trimmed.strip_prefix("https://") else {
        return Err("Use a full https URL.".to_string());
    };
    let host = rest
        .split(['/', '?', '#'])
        .next()
        .unwrap_or("")
        .split(':')
        .next()
        .unwrap_or("");
    if host.is_empty() {
        return Err("Use a full https URL.".to_string());
    }
    if crate::ghost::is_private_host(host) {
        return Err("That host resolves to a private address. Blocked.".to_string());
    }
    Ok(trimmed.to_string())
}

fn client(timeout_s: u64) -> reqwest::Client {
    reqwest::Client::builder()
        .redirect(reqwest::redirect::Policy::none())
        .timeout(std::time::Duration::from_secs(timeout_s))
        .build()
        .unwrap_or_default()
}

/// The text of `choices[0].message`, whether it is a string or a content array.
fn content_text(message: &Value) -> String {
    match message {
        Value::String(text) => text.clone(),
        Value::Object(map) => match map.get("content") {
            Some(Value::String(text)) => text.clone(),
            Some(Value::Array(parts)) => parts
                .iter()
                .filter_map(|part| part.get("text").and_then(|t| t.as_str()))
                .collect::<Vec<_>>()
                .join(""),
            _ => String::new(),
        },
        _ => String::new(),
    }
}

#[derive(Debug, Deserialize)]
pub struct ModelRequest {
    #[serde(default)]
    pub base_url: String,
    #[serde(default)]
    pub api_key: String,
    #[serde(default)]
    pub model: String,
}

/// One tiny completion: proves the key, the endpoint and the model id agree.
pub async fn test_model(req: &ModelRequest) -> Value {
    let endpoint = chat_endpoint(&req.base_url);
    if let Err(error) = require_public_https(&endpoint) {
        return failure(error);
    }
    if req.api_key.trim().is_empty() || req.model.trim().is_empty() {
        return failure("Base URL, API key, and model name are required.");
    }
    let body = json!({
        "model": req.model,
        "temperature": 0,
        "max_tokens": 16,
        "messages": [{ "role": "user", "content": "Reply with the single word ready." }],
    });
    let response = client(20)
        .post(&endpoint)
        .header("Authorization", format!("Bearer {}", req.api_key.trim()))
        .header("Content-Type", "application/json")
        .body(body.to_string())
        .send()
        .await;
    let response = match response {
        Ok(response) => response,
        Err(error) => return failure(safe_message(&error.to_string())),
    };
    let status = response.status().as_u16();
    if (300..400).contains(&status) {
        return failure("Redirects are blocked.");
    }
    if status == 401 || status == 403 {
        return failure("The provider refused the API key.");
    }
    if !(200..300).contains(&status) {
        return failure(format!("Provider returned HTTP {status}."));
    }
    let parsed: Value = response.json().await.unwrap_or(Value::Null);
    let text = content_text(
        parsed
            .get("choices")
            .and_then(|c| c.get(0))
            .and_then(|c| c.get("message"))
            .unwrap_or(&Value::Null),
    );
    let sample = if text.trim().is_empty() {
        "ok".to_string()
    } else {
        text.trim().chars().take(80).collect()
    };
    json!({ "ok": true, "sample": sample })
}

#[derive(Debug, Deserialize)]
pub struct BaseKeyRequest {
    #[serde(default)]
    pub base_url: String,
    #[serde(default)]
    pub api_key: String,
}

/// Live model discovery: `GET {base}/models` → the ids the operator can pick.
pub async fn list_models(req: &BaseKeyRequest) -> Value {
    let endpoint = models_endpoint(&req.base_url);
    if let Err(error) = require_public_https(&endpoint) {
        return failure(error);
    }
    if req.api_key.trim().is_empty() {
        return failure("Base URL and API key are required to fetch models.");
    }
    let response = client(20)
        .get(&endpoint)
        .header("Authorization", format!("Bearer {}", req.api_key.trim()))
        .header("Accept", "application/json")
        .send()
        .await;
    let response = match response {
        Ok(response) => response,
        Err(error) => return failure(safe_message(&error.to_string())),
    };
    let status = response.status().as_u16();
    if (300..400).contains(&status) {
        return failure("Redirects are blocked.");
    }
    if status == 401 || status == 403 {
        return failure("The provider refused the API key.");
    }
    if status == 404 {
        return failure("This endpoint does not expose /models. Type the model id manually.");
    }
    if !(200..300).contains(&status) {
        return failure(format!("Provider returned HTTP {status}."));
    }
    let body: Value = response.json().await.unwrap_or(Value::Null);
    let rows = body
        .get("data")
        .and_then(|v| v.as_array())
        .or_else(|| body.get("models").and_then(|v| v.as_array()))
        .cloned()
        .unwrap_or_default();
    let mut seen: Vec<String> = Vec::new();
    for row in rows {
        if let Some(id) = row.get("id").and_then(|v| v.as_str()) {
            let id = id.trim();
            if !id.is_empty() && !seen.iter().any(|existing| existing == id) {
                seen.push(id.to_string());
            }
            if seen.len() >= 500 {
                break;
            }
        }
    }
    if seen.is_empty() {
        return failure("The endpoint returned no model ids. Type the model id manually.");
    }
    json!({ "ok": true, "models": seen })
}

#[derive(Debug, Deserialize)]
pub struct EmbeddingRequest {
    #[serde(default)]
    pub base_url: String,
    #[serde(default)]
    pub api_key: String,
    #[serde(default)]
    pub model: String,
    #[serde(default)]
    pub input: String,
    /// Use a key already saved on this server instead of credentials from the
    /// browser. Browser state never holds a secret for a saved key, so this is the
    /// only way semantic recall works for one.
    #[serde(default)]
    pub key_id: Option<i64>,
}

/// Resolve base URL and credential, preferring a server-saved key.
async fn embedding_credentials(
    pool: &sqlx::SqlitePool,
    req: &EmbeddingRequest,
) -> Result<(String, String), String> {
    if let Some(id) = req.key_id {
        return crate::provider::credentials(pool, id).await;
    }
    Ok((req.base_url.clone(), req.api_key.clone()))
}

pub async fn embedding(pool: &sqlx::SqlitePool, req: &EmbeddingRequest) -> Value {
    let (base_url, api_key) = match embedding_credentials(pool, req).await {
        Ok(pair) => pair,
        Err(error) => return failure(error),
    };
    let endpoint = embeddings_endpoint(&base_url);
    if let Err(error) = require_public_https(&endpoint) {
        return failure(error);
    }
    let text: String = req.input.trim().chars().take(8000).collect();
    if text.is_empty() {
        return failure("Nothing to embed.");
    }
    let body = json!({ "model": req.model, "input": text });
    let response = client(20)
        .post(&endpoint)
        .header("Authorization", format!("Bearer {}", api_key.trim()))
        .header("Content-Type", "application/json")
        .body(body.to_string())
        .send()
        .await;
    let response = match response {
        Ok(response) => response,
        Err(error) => return failure(safe_message(&error.to_string())),
    };
    let status = response.status().as_u16();
    if (300..400).contains(&status) {
        return failure("Redirects are blocked.");
    }
    if status == 401 || status == 403 {
        return failure("The provider refused the API key.");
    }
    if matches!(status, 400 | 404 | 422) {
        return failure("This model has no embeddings support.");
    }
    if !(200..300).contains(&status) {
        return failure(format!("Provider returned HTTP {status}."));
    }
    let body: Value = response.json().await.unwrap_or(Value::Null);
    let vector = body
        .get("data")
        .and_then(|d| d.get(0))
        .and_then(|d| d.get("embedding"))
        .and_then(|v| v.as_array())
        .cloned()
        .unwrap_or_default();
    let numbers: Vec<f64> = vector.iter().filter_map(|n| n.as_f64()).collect();
    if numbers.len() < 2 || numbers.len() != vector.len() {
        return failure("This model has no embeddings support.");
    }
    let tokens = body
        .get("usage")
        .and_then(|u| {
            u.get("total_tokens")
                .or_else(|| u.get("prompt_tokens"))
                .and_then(|t| t.as_f64())
        })
        .unwrap_or(0.0)
        .max(0.0)
        .round() as u64;
    json!({ "ok": true, "vector": numbers, "tokens": tokens })
}

#[derive(Debug, Deserialize)]
pub struct ScrapeRequest {
    #[serde(default)]
    pub api_key: String,
    #[serde(default)]
    pub url: String,
}

pub async fn scrape(req: &ScrapeRequest) -> Value {
    let target = match require_public_https(&req.url) {
        Ok(target) => target,
        Err(error) => return failure(error),
    };
    if req.api_key.trim().is_empty() {
        return failure("Firecrawl key and URL are required.");
    }
    let host = target
        .trim_start_matches("https://")
        .split(['/', '?', '#'])
        .next()
        .unwrap_or("")
        .to_string();
    let body = json!({ "url": target, "formats": ["markdown"], "onlyMainContent": true });
    let response = client(25)
        .post(format!("{FIRECRAWL}/v1/scrape"))
        .header("Authorization", format!("Bearer {}", req.api_key.trim()))
        .header("Content-Type", "application/json")
        .body(body.to_string())
        .send()
        .await;
    let response = match response {
        Ok(response) => response,
        Err(error) => return failure(safe_message(&error.to_string())),
    };
    let status = response.status().as_u16();
    if status == 401 || status == 403 {
        return failure("Firecrawl refused the API key.");
    }
    if !(200..300).contains(&status) {
        return failure(format!("Firecrawl HTTP {status}."));
    }
    let parsed: Value = response.json().await.unwrap_or(Value::Null);
    let markdown = parsed
        .get("data")
        .and_then(|d| d.get("markdown"))
        .and_then(|m| m.as_str())
        .unwrap_or("")
        .trim()
        .to_string();
    if markdown.is_empty() {
        return failure("Firecrawl returned no markdown.");
    }
    let title = parsed
        .get("data")
        .and_then(|d| d.get("metadata"))
        .and_then(|m| m.get("title"))
        .and_then(|t| t.as_str())
        .filter(|t| !t.is_empty())
        .unwrap_or(&host)
        .to_string();
    json!({
        "ok": true,
        "title": title,
        "markdown": markdown.chars().take(4000).collect::<String>(),
    })
}

#[derive(Debug, Deserialize)]
pub struct SearchRequest {
    #[serde(default)]
    pub api_key: String,
    #[serde(default)]
    pub query: String,
    #[serde(default)]
    pub max_results: Option<i64>,
}

fn clamp_results(value: Option<i64>) -> i64 {
    value.unwrap_or(5).clamp(1, 10)
}

pub async fn tavily_search(req: &SearchRequest) -> Value {
    let query: String = req.query.trim().chars().take(400).collect();
    if req.api_key.trim().is_empty() || query.is_empty() {
        return failure_status(0, "Tavily key and query are required.");
    }
    // Rule 5 — Tavily takes the key both in the body (classic) and as a bearer.
    let body = json!({
        "api_key": req.api_key.trim(),
        "query": query,
        "max_results": clamp_results(req.max_results),
        "search_depth": "basic",
        "include_answer": true,
    });
    let response = client(25)
        .post(format!("{TAVILY}/search"))
        .header("Authorization", format!("Bearer {}", req.api_key.trim()))
        .header("Content-Type", "application/json")
        .body(body.to_string())
        .send()
        .await;
    let response = match response {
        Ok(response) => response,
        Err(error) => return failure_status(0, safe_message(&error.to_string())),
    };
    let status = response.status().as_u16();
    if status == 401 || status == 403 {
        return failure_status(status, "Tavily refused the API key.");
    }
    if status == 429 {
        return failure_status(429, "Tavily rate limit.");
    }
    if !(200..300).contains(&status) {
        return failure_status(status, format!("Tavily HTTP {status}."));
    }
    let parsed: Value = response.json().await.unwrap_or(Value::Null);
    let results: Vec<Value> = parsed
        .get("results")
        .and_then(|r| r.as_array())
        .map(|rows| {
            rows.iter()
                .filter_map(|row| {
                    let url = row.get("url").and_then(|u| u.as_str()).unwrap_or("");
                    if !url.starts_with("http") {
                        return None;
                    }
                    Some(json!({
                        "title": row.get("title").and_then(|t| t.as_str()).unwrap_or("").chars().take(200).collect::<String>(),
                        "url": url,
                        "snippet": row.get("content").and_then(|c| c.as_str()).unwrap_or("").chars().take(1200).collect::<String>(),
                    }))
                })
                .collect()
        })
        .unwrap_or_default();
    if results.is_empty() {
        return failure_status(200, "Tavily returned no results.");
    }
    let answer = parsed
        .get("answer")
        .and_then(|a| a.as_str())
        .map(|a| a.chars().take(1200).collect::<String>());
    json!({ "ok": true, "results": results, "answer": answer })
}

pub async fn firecrawl_search(req: &SearchRequest) -> Value {
    let query: String = req.query.trim().chars().take(400).collect();
    if req.api_key.trim().is_empty() || query.is_empty() {
        return failure_status(0, "Firecrawl key and query are required.");
    }
    let body = json!({
        "query": query,
        "limit": clamp_results(req.max_results),
        "scrapeOptions": { "formats": ["markdown"], "onlyMainContent": true },
    });
    let response = client(30)
        .post(format!("{FIRECRAWL}/v1/search"))
        .header("Authorization", format!("Bearer {}", req.api_key.trim()))
        .header("Content-Type", "application/json")
        .body(body.to_string())
        .send()
        .await;
    let response = match response {
        Ok(response) => response,
        Err(error) => return failure_status(0, safe_message(&error.to_string())),
    };
    let status = response.status().as_u16();
    if status == 401 || status == 403 {
        return failure_status(status, "Firecrawl refused the API key.");
    }
    if status == 429 {
        return failure_status(429, "Firecrawl rate limit.");
    }
    if !(200..300).contains(&status) {
        return failure_status(status, format!("Firecrawl HTTP {status}."));
    }
    let parsed: Value = response.json().await.unwrap_or(Value::Null);
    let results: Vec<Value> = parsed
        .get("data")
        .and_then(|d| d.as_array())
        .map(|rows| {
            rows.iter()
                .filter_map(|row| {
                    let url = row.get("url").and_then(|u| u.as_str()).unwrap_or("");
                    if !url.starts_with("http") {
                        return None;
                    }
                    let snippet = row
                        .get("markdown")
                        .and_then(|m| m.as_str())
                        .or_else(|| row.get("description").and_then(|d| d.as_str()))
                        .unwrap_or("");
                    Some(json!({
                        "title": row.get("title").and_then(|t| t.as_str()).unwrap_or("").chars().take(200).collect::<String>(),
                        "url": url,
                        "snippet": snippet.chars().take(1200).collect::<String>(),
                    }))
                })
                .collect()
        })
        .unwrap_or_default();
    if results.is_empty() {
        return failure_status(200, "Firecrawl returned no results.");
    }
    json!({ "ok": true, "results": results })
}

use crate::{default_workspace, ApiError, AppState, NOW};
use axum::{
    extract::{Query, State},
    http::StatusCode,
    Json,
};

pub(crate) async fn test_model_handler(
    Json(req): Json<crate::providers::ModelRequest>,
) -> Json<serde_json::Value> {
    Json(crate::providers::test_model(&req).await)
}
pub(crate) async fn list_custom_models(
    Json(req): Json<crate::providers::BaseKeyRequest>,
) -> Json<serde_json::Value> {
    Json(crate::providers::list_models(&req).await)
}
pub(crate) async fn get_embedding(
    State(st): State<AppState>,
    Json(req): Json<crate::providers::EmbeddingRequest>,
) -> Json<serde_json::Value> {
    Json(crate::providers::embedding(&st.pool, &req).await)
}
pub(crate) async fn scrape_page(
    Json(req): Json<crate::providers::ScrapeRequest>,
) -> Json<serde_json::Value> {
    Json(crate::providers::scrape(&req).await)
}
pub(crate) async fn tavily_search_handler(
    Json(req): Json<crate::providers::SearchRequest>,
) -> Json<serde_json::Value> {
    Json(crate::providers::tavily_search(&req).await)
}
pub(crate) async fn firecrawl_search_handler(
    Json(req): Json<crate::providers::SearchRequest>,
) -> Json<serde_json::Value> {
    Json(crate::providers::firecrawl_search(&req).await)
}
pub(crate) async fn list_provider_routes(
    State(st): State<AppState>,
    Query(q): Query<ProviderQuery>,
) -> Result<Json<serde_json::Value>, ApiError> {
    let ws = q.workspace_id.unwrap_or(1);
    let items = crate::provider::list_providers(&st.pool, ws)
        .await
        .map_err(ApiError::Db)?;
    Ok(Json(serde_json::json!({ "items": items })))
}
/// Add any OpenAI-compatible provider. No cap on how many a workspace may add.
pub(crate) async fn create_provider(
    State(st): State<AppState>,
    Json(req): Json<crate::provider::NewProvider>,
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
    let id = crate::provider::insert_provider(&st.pool, NOW, &req)
        .await
        .map_err(ApiError::Db)?;
    let items = crate::provider::list_providers(&st.pool, req.workspace_id)
        .await
        .map_err(ApiError::Db)?;
    let created = items.into_iter().find(|p| p.id == id);
    Ok((
        StatusCode::CREATED,
        Json(serde_json::json!({ "id": id, "provider": created })),
    ))
}
/// Update a saved key in place. A blank secret keeps the sealed credential on file.
/// Returns the updated id. The browser re-binds its local row to this id, which is
/// what lets an orphaned key (saved while the server was broken) be rescued by a
/// single edit-and-save.
pub(crate) async fn patch_provider(
    State(st): State<AppState>,
    axum::extract::Path(id): axum::extract::Path<i64>,
    Json(req): Json<crate::provider::UpdateProvider>,
) -> Result<Json<serde_json::Value>, ApiError> {
    let updated = crate::provider::update_provider(&st.pool, id, &req)
        .await
        .map_err(|e| match e {
            sqlx::Error::RowNotFound => ApiError::BadRequest("unknown key id"),
            other => ApiError::Db(other),
        })?;
    Ok(Json(
        serde_json::json!({ "id": updated, "workspace_id": req.workspace_id }),
    ))
}
/// The failover pool in order: which key runs next, and why any are demoted.
/// Reports the masked hint, never the key.
pub(crate) async fn key_pool(
    State(st): State<AppState>,
    Query(q): Query<ProviderQuery>,
) -> Result<Json<serde_json::Value>, ApiError> {
    let ws = q.workspace_id.unwrap_or(1);
    let role = q.role.as_deref().unwrap_or("text");
    let items = crate::provider::key_statuses(&st.pool, ws, role)
        .await
        .map_err(ApiError::Db)?;
    Ok(Json(serde_json::json!({ "items": items })))
}
/// One chat completion on the server, through the workspace's key pool.
///
/// This is what lets the browser stop holding provider keys: it asks for text
/// and never sees a credential. Spend is recorded in the usage ledger the same
/// way a pipeline stage records it, so cost accounting stays complete.
pub(crate) async fn generate(
    State(st): State<AppState>,
    Json(req): Json<GenerateRequest>,
) -> Result<Json<serde_json::Value>, ApiError> {
    if req.user.trim().is_empty() {
        return Err(ApiError::BadRequest("user must not be empty"));
    }
    let role = req.role.as_deref().unwrap_or("text");
    let schema = req.schema.unwrap_or_else(|| "ad-hoc".to_string());
    let chat = crate::provider::ChatRequest {
        schema: schema.clone(),
        system: req.system,
        user: req.user,
        json: req.json,
        images: req.images,
    };

    let out = crate::provider::complete_chain(
        &st.pool,
        req.workspace_id,
        role,
        req.preferred_key_id,
        &chat,
    )
    .await
    .map_err(|e| {
        // Error bodies can echo the request, so the detail stays in the
        // log and only a bounded message reaches the client.
        tracing::warn!("generate failed: {e}");
        ApiError::Upstream(crate::provider::safe_message(&e))
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

#[derive(Deserialize)]
pub(crate) struct ProviderQuery {
    workspace_id: Option<i64>,
    /// Which capability's pool to report: `text` (default) or `vision`.
    role: Option<String>,
}
#[derive(Deserialize)]
pub(crate) struct GenerateRequest {
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

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn a_bare_host_gets_the_v1_path_and_a_custom_path_does_not() {
        assert_eq!(
            chat_endpoint("https://api.example.com"),
            "https://api.example.com/v1/chat/completions"
        );
        assert_eq!(
            chat_endpoint("https://api.example.com/v1/custom/"),
            "https://api.example.com/v1/custom/chat/completions"
        );
        assert_eq!(
            chat_endpoint("https://api.example.com/v1/chat/completions"),
            "https://api.example.com/v1/chat/completions"
        );
    }

    #[test]
    fn models_and_embeddings_reuse_the_same_base_rules() {
        assert_eq!(
            models_endpoint("https://api.example.com"),
            "https://api.example.com/v1/models"
        );
        assert_eq!(
            models_endpoint("https://api.example.com/v1/chat/completions"),
            "https://api.example.com/v1/models"
        );
        assert_eq!(
            embeddings_endpoint("https://api.example.com/v1"),
            "https://api.example.com/v1/embeddings"
        );
        assert_eq!(
            embeddings_endpoint("https://api.example.com/v1/embeddings"),
            "https://api.example.com/v1/embeddings"
        );
    }

    #[test]
    fn only_public_https_targets_are_allowed() {
        assert!(require_public_https("https://api.example.com/v1/chat").is_ok());
        assert!(require_public_https("http://api.example.com/v1").is_err());
        assert!(require_public_https("https://127.0.0.1/v1").is_err());
        assert!(require_public_https("https://localhost/v1").is_err());
        assert!(require_public_https("not a url").is_err());
    }

    #[test]
    fn a_message_can_be_a_string_or_a_content_array() {
        assert_eq!(content_text(&json!("ready")), "ready");
        assert_eq!(content_text(&json!({ "content": "ready" })), "ready");
        assert_eq!(
            content_text(&json!({ "content": [{ "text": "rea" }, { "text": "dy" }] })),
            "ready"
        );
    }
}
