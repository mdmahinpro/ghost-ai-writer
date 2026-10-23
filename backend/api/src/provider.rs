//! Provider registry and engine adapters.
//!
//! Design rules:
//! * **No provider is hardcoded.** Every provider is a row: base URL, model,
//!   price, key. Anything that speaks the OpenAI chat-completions shape works,
//!   which covers OpenAI, OpenRouter, Groq, DeepSeek, Together, vLLM, Ollama and
//!   local gateways. The workspace may add as many as it wants (no cap).
//! * **Keys never travel outward.** They are read from the row, sent only to
//!   that provider's own base URL, and never returned by the API — only
//!   `key_hint` (`••••1icA`) is.
//! * **`mock` is a first-class dev engine**, not fake output: it returns a
//!   deterministic fixture so the pipeline, validation and accounting can be
//!   exercised with no network and no spend. Real runs are labelled by provider.

use serde::{Deserialize, Serialize};
use sqlx::SqlitePool;

pub const MOCK_PROVIDER: &str = "mock";

#[derive(Debug, Clone, sqlx::FromRow)]
pub struct ProviderRow {
    pub id: i64,
    pub workspace_id: i64,
    pub provider: String,
    pub label: String,
    pub key_enc: String,
    pub key_hint: Option<String>,
    pub kind: String,
    pub base_url: Option<String>,
    pub model_id: Option<String>,
    pub price_in_per_mtok: f64,
    pub price_out_per_mtok: f64,
    pub max_tokens: i64,
    pub temperature: f64,
    pub role: String,
    pub status: String,
}

#[derive(Debug, Deserialize)]
pub struct NewProvider {
    pub workspace_id: i64,
    pub provider: String,
    pub label: String,
    pub api_key: String,
    #[serde(default)]
    pub kind: Option<String>,
    #[serde(default)]
    pub base_url: Option<String>,
    pub model_id: String,
    #[serde(default)]
    pub price_in_per_mtok: f64,
    #[serde(default)]
    pub price_out_per_mtok: f64,
    #[serde(default)]
    pub max_tokens: Option<i64>,
    #[serde(default)]
    pub temperature: Option<f64>,
    #[serde(default)]
    pub role: Option<String>,
    #[serde(default)]
    pub is_default: bool,
}

/// Public view of a provider — deliberately has no key field.
#[derive(Debug, Serialize)]
pub struct ProviderView {
    pub id: i64,
    pub workspace_id: i64,
    pub provider: String,
    pub label: String,
    pub kind: String,
    pub base_url: Option<String>,
    pub model_id: Option<String>,
    pub key_hint: Option<String>,
    pub price_in_per_mtok: f64,
    pub price_out_per_mtok: f64,
    pub max_tokens: i64,
    pub temperature: f64,
    pub role: String,
    pub status: String,
}

impl From<ProviderRow> for ProviderView {
    fn from(r: ProviderRow) -> Self {
        Self {
            id: r.id,
            workspace_id: r.workspace_id,
            provider: r.provider,
            label: r.label,
            kind: r.kind,
            base_url: r.base_url,
            model_id: r.model_id,
            key_hint: r.key_hint,
            price_in_per_mtok: r.price_in_per_mtok,
            price_out_per_mtok: r.price_out_per_mtok,
            max_tokens: r.max_tokens,
            temperature: r.temperature,
            role: r.role,
            status: r.status,
        }
    }
}

/// `sk-abcdef123456` -> `••••3456`
pub fn hint(key: &str) -> String {
    let tail: String = key
        .chars()
        .rev()
        .take(4)
        .collect::<Vec<_>>()
        .into_iter()
        .rev()
        .collect();
    format!("••••{tail}")
}

#[derive(Debug, Clone)]
pub struct ChatRequest {
    /// Logical schema name (`blueprint`, `draft`, ...) — the mock engine keys
    /// its fixture off this, and the ledger records it as the stage.
    pub schema: String,
    pub system: String,
    pub user: String,
    pub json: bool,
    /// Image URLs for the vision gate. Empty for every text stage.
    pub images: Vec<String>,
}

#[derive(Debug, Clone, Default)]
pub struct Completion {
    pub text: String,
    pub tokens_in: i64,
    pub tokens_out: i64,
    pub cost_usd: f64,
}

#[derive(Debug)]
pub enum EngineError {
    /// The provider answered with a non-2xx status.
    Http(u16, String),
    /// Transport/DNS/timeout — retryable.
    Transport(String),
    /// Body was not the shape we need.
    Malformed(String),
}

impl std::fmt::Display for EngineError {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            EngineError::Http(code, body) => write!(f, "provider http {code}: {body}"),
            EngineError::Transport(e) => write!(f, "provider transport: {e}"),
            EngineError::Malformed(e) => write!(f, "provider malformed response: {e}"),
        }
    }
}

impl std::error::Error for EngineError {}

impl EngineError {
    pub fn retryable(&self) -> bool {
        match self {
            EngineError::Transport(_) => true,
            EngineError::Http(code, _) => *code == 429 || *code >= 500,
            _ => false,
        }
    }
}

pub enum Engine {
    Mock(MockEngine),
    Http(Box<HttpEngine>),
}

impl Engine {
    pub fn model_id(&self) -> &str {
        match self {
            Engine::Mock(m) => &m.model_id,
            Engine::Http(h) => &h.model_id,
        }
    }

    pub fn provider(&self) -> &str {
        match self {
            Engine::Mock(_) => MOCK_PROVIDER,
            Engine::Http(h) => &h.provider,
        }
    }

    pub async fn complete(&self, req: &ChatRequest) -> Result<Completion, EngineError> {
        match self {
            Engine::Mock(m) => m.complete(req),
            Engine::Http(h) => h.complete(req).await,
        }
    }
}

/// Deterministic fixtures. Deliberately boring content: it exists to prove the
/// contract, the bounds and the ledger, never to look like a real article.
pub struct MockEngine {
    pub model_id: String,
}

impl MockEngine {
    fn complete(&self, req: &ChatRequest) -> Result<Completion, EngineError> {
        let body = match req.schema.as_str() {
            "blueprint" => serde_json::json!({
                "intent": "informational",
                "angle": "what to do first, in order",
                "titleHint": "What To Do When A PhD Stipend Stops",
                "mustCover": [
                    "the first 72 hours",
                    "department funding bridge",
                    "emergency grants",
                    "teaching assistantships",
                    "timeline of decisions"
                ],
                "sections": [
                    {"heading": "What should you do in the first 72 hours?", "covers": "the first 72 hours"},
                    {"heading": "Which department funds can bridge a gap?", "covers": "department funding bridge"},
                    {"heading": "Where do emergency grants come from?", "covers": "emergency grants"},
                    {"heading": "How do teaching assistantships fit in?", "covers": "teaching assistantships"},
                    {"heading": "What is the decision timeline?", "covers": "timeline of decisions"}
                ]
            }),
            "draft" => {
                let filler =
                    "Funding gaps usually get solved by asking early and asking in writing. ";
                let long = filler.repeat(12); // > 200 chars, well under 9000
                serde_json::json!({
                    "intro": format!(
                        "A stipend that stops without warning is a logistics problem before it is an \
                         academic one. You need to know who approves money, how long each route takes, \
                         and what to say. This guide walks through the order that works. {long}"
                    ),
                    "body": long,
                    "faq": [
                        {"question": "Can a stipend be restored mid-term?", "answer": "Sometimes. Ask the graduate school in writing and cite the funding commitment letter."},
                        {"question": "Is a bridge loan worth it?", "answer": "Only against a dated promise of future funding."}
                    ],
                    "claims": [
                        {"text": "Graduate schools often hold emergency funds for exactly this case.", "status": "OPINION"},
                        {"text": "A written request creates a record you can escalate.", "status": "SUPPORTED"}
                    ],
                    "answerBlock": "Ask your department in writing within 72 hours, then file the graduate-school emergency request. Both routes usually answer within ten working days."
                })
            }
            "revision" => {
                // Deliberately covers every mustCover item from the mock
                // blueprint, so the coverage gate has something real to check.
                let body = "## What should you do in the first few hours?\n\
                    Start with the person who signs off on money, and put the request in \
                    writing the same day. The first hours matter because funding queues are \
                    real queues.\n\n\
                    ## Which department funds can bridge a gap?\n\
                    Ask about a department funding bridge before you ask anyone else. The \
                    bridge exists for exactly this case and is usually the fastest yes.\n\n\
                    ## Where do emergency grants come from?\n\
                    Emergency grants sit with the graduate school and with a few foundations. \
                    One form usually covers several of them.\n\n\
                    ## How do teaching assistantships fit in?\n\
                    Teaching assistantships are posted as openings, not gifts, so apply to the \
                    posted slot and tell the department you can start next term.\n\n\
                    ## What is the timeline of decisions?\n\
                    Expect a written answer in about ten working days. Keep a timeline of every \
                    request so escalation has dates attached.\n";
                serde_json::json!({
                    "intro": "A stipend that stops without warning is a logistics problem first. \
                        You need to know who approves money, which route answers fastest, and what \
                        to put in writing. The order below is what gets a real answer instead of a \
                        sympathetic conversation.",
                    "body": body,
                    "faq": [
                        {"question": "Can a stipend be restored mid-term?", "answer": "Sometimes. Ask in writing and cite the funding commitment letter."},
                        {"question": "Is a bridge loan worth it?", "answer": "Only against a dated promise of future funding."}
                    ],
                    "claims": [
                        {"text": "Graduate schools often hold emergency funds for this case.", "status": "OPINION"},
                        {"text": "A written request creates a record you can escalate.", "status": "SUPPORTED"}
                    ],
                    "answerBlock": "Ask your department in writing within the first few hours, then file the graduate-school emergency request. Both routes usually answer within ten working days.",
                    "qualityReport": {
                        "intentMatch": 0.93, "coverage": 1.0, "repetition": 0.12,
                        "unsupportedClaims": [], "notes": "Tightened the opening, cut a repeated paragraph."
                    },
                    "critique": {
                        "unnaturalTransitions": [], "formattingIssues": [],
                        "genericFiller": [], "revisionNeeded": false
                    }
                })
            }
            "vision" => serde_json::json!({
                "verdict": "RELEVANT",
                "confidence": 0.9,
                "sentence": "a desk with funding paperwork and a laptop, matching the topic"
            }),
            "metadata" => serde_json::json!({
                "title": "When A PhD Stipend Stops: The Order That Works",
                "metaDescription": "A stipend can stop mid-term with no warning. Here is the order that actually gets money moving: department bridge, emergency grant, teaching slot.",
                "excerpt": "Who to ask first, what to put in writing, and how long each funding route really takes when a stipend stops.",
                "tags": ["phd funding", "stipend", "emergency grants", "graduate school"],
                "slug": "when-a-phd-stipend-stops"
            }),
            _ => serde_json::json!({"ok": true}),
        };
        let text = serde_json::to_string(&body).unwrap_or_default();
        let tokens_in = (((req.system.len() + req.user.len()) / 4) as i64).max(1);
        let tokens_out = ((text.len() / 4) as i64).max(1);
        Ok(Completion {
            text,
            tokens_in,
            tokens_out,
            cost_usd: 0.0,
        })
    }
}

pub struct HttpEngine {
    pub provider: String,
    pub base_url: String,
    pub model_id: String,
    pub api_key: String,
    pub price_in_per_mtok: f64,
    pub price_out_per_mtok: f64,
    pub max_tokens: i64,
    pub temperature: f64,
}

#[derive(Deserialize)]
struct ChatResponse {
    choices: Vec<Choice>,
    #[serde(default)]
    usage: Option<Usage>,
}

#[derive(Deserialize)]
struct Choice {
    message: ChoiceMessage,
}

#[derive(Deserialize)]
struct ChoiceMessage {
    #[serde(default)]
    content: Option<String>,
}

#[derive(Deserialize)]
struct Usage {
    #[serde(default)]
    prompt_tokens: i64,
    #[serde(default)]
    completion_tokens: i64,
}

impl HttpEngine {
    async fn complete(&self, req: &ChatRequest) -> Result<Completion, EngineError> {
        let url = format!("{}/chat/completions", self.base_url.trim_end_matches('/'));
        // OpenAI-compatible vision request: the user message becomes a content
        // array of a text part plus one image_url part per image.
        let user_content = if req.images.is_empty() {
            serde_json::json!(req.user)
        } else {
            let mut parts = vec![serde_json::json!({"type": "text", "text": req.user})];
            for img in &req.images {
                parts.push(serde_json::json!({
                    "type": "image_url",
                    "image_url": {"url": img}
                }));
            }
            serde_json::Value::Array(parts)
        };
        let mut body = serde_json::json!({
            "model": self.model_id,
            "messages": [
                {"role": "system", "content": req.system},
                {"role": "user", "content": user_content}
            ],
            "temperature": self.temperature,
            "max_tokens": self.max_tokens
        });
        if req.json {
            body["response_format"] = serde_json::json!({"type": "json_object"});
        }

        let client = reqwest::Client::builder()
            .timeout(std::time::Duration::from_secs(120))
            .build()
            .map_err(|e| EngineError::Transport(e.to_string()))?;

        let resp = client
            .post(&url)
            .bearer_auth(&self.api_key)
            .json(&body)
            .send()
            .await
            .map_err(|e| EngineError::Transport(e.to_string()))?;

        let status = resp.status();
        let raw = resp
            .text()
            .await
            .map_err(|e| EngineError::Transport(e.to_string()))?;
        if !status.is_success() {
            // Truncate: provider error bodies can be long, and must not leak keys.
            let snippet: String = raw.chars().take(300).collect();
            return Err(EngineError::Http(status.as_u16(), snippet));
        }

        let parsed: ChatResponse = serde_json::from_str(&raw).map_err(|e| {
            EngineError::Malformed(format!(
                "{e}: {}",
                raw.chars().take(200).collect::<String>()
            ))
        })?;
        let text = parsed
            .choices
            .first()
            .and_then(|c| c.message.content.clone())
            .ok_or_else(|| EngineError::Malformed("empty choices[0].message.content".into()))?;

        let (tin, tout) = parsed
            .usage
            .map(|u| (u.prompt_tokens, u.completion_tokens))
            .unwrap_or_else(|| {
                // Provider omitted usage: estimate at 4 chars/token so spend is
                // never silently zero.
                (
                    ((req.system.len() + req.user.len()) / 4) as i64,
                    (text.len() / 4) as i64,
                )
            });
        let cost = (tin as f64 / 1_000_000.0) * self.price_in_per_mtok
            + (tout as f64 / 1_000_000.0) * self.price_out_per_mtok;

        Ok(Completion {
            text,
            tokens_in: tin,
            tokens_out: tout,
            cost_usd: cost,
        })
    }
}

/// Load the engine a workspace should use for `role` (text|vision|lint).
/// `GAW_ENGINE=mock` forces the mock engine regardless of configuration.
pub async fn load_engine(
    pool: &SqlitePool,
    workspace_id: i64,
    role: &str,
) -> Result<Engine, sqlx::Error> {
    if std::env::var("GAW_ENGINE").as_deref() == Ok(MOCK_PROVIDER) {
        return Ok(Engine::Mock(MockEngine {
            model_id: "mock-1".into(),
        }));
    }
    let row: Option<ProviderRow> = sqlx::query_as(
        "SELECT id, workspace_id, provider, label, key_enc, key_hint, kind, base_url, model_id, \
                price_in_per_mtok, price_out_per_mtok, max_tokens, temperature, role, status \
         FROM ai_keys \
         WHERE workspace_id = ? AND role = ? AND status != 'DISABLED' \
         ORDER BY is_default DESC, priority ASC, id ASC LIMIT 1",
    )
    .bind(workspace_id)
    .bind(role)
    .fetch_optional(pool)
    .await?;

    let Some(p) = row else {
        // No provider configured: fall back to the mock engine so a fresh
        // install still runs end to end instead of failing every job.
        return Ok(Engine::Mock(MockEngine {
            model_id: "mock-1".into(),
        }));
    };
    Ok(engine_from_row(p))
}

/// Vision has no mock fallback: an image must only be reported as
/// "vision confirmed" when a real vision model looked at it. The mock engine
/// answers every vision request with a canned RELEVANT, which would put a
/// fixture in the audit trail.
pub async fn load_vision(
    pool: &SqlitePool,
    workspace_id: i64,
) -> Result<Option<Engine>, sqlx::Error> {
    let row: Option<ProviderRow> = sqlx::query_as(
        "SELECT id, workspace_id, provider, label, key_enc, key_hint, kind, base_url, model_id, \
                price_in_per_mtok, price_out_per_mtok, max_tokens, temperature, role, status \
         FROM ai_keys \
         WHERE workspace_id = ? AND role = 'vision' AND status != 'DISABLED' \
         ORDER BY is_default DESC, priority ASC, id ASC LIMIT 1",
    )
    .bind(workspace_id)
    .fetch_optional(pool)
    .await?;
    Ok(row.map(engine_from_row))
}

fn engine_from_row(p: ProviderRow) -> Engine {
    if p.provider == MOCK_PROVIDER {
        return Engine::Mock(MockEngine {
            model_id: p.model_id.unwrap_or_else(|| "mock-1".into()),
        });
    }
    Engine::Http(Box::new(HttpEngine {
        provider: p.provider,
        base_url: p
            .base_url
            .unwrap_or_else(|| "https://api.openai.com/v1".to_string()),
        model_id: p.model_id.unwrap_or_else(|| "gpt-4o-mini".to_string()),
        api_key: p.key_enc,
        price_in_per_mtok: p.price_in_per_mtok,
        price_out_per_mtok: p.price_out_per_mtok,
        max_tokens: p.max_tokens,
        temperature: p.temperature,
    }))
}

pub async fn insert_provider(
    pool: &SqlitePool,
    now: &str,
    new: &NewProvider,
) -> Result<i64, sqlx::Error> {
    let role = new.role.clone().unwrap_or_else(|| "text".to_string());
    let mut tx = pool.begin().await?;
    if new.is_default {
        sqlx::query("UPDATE ai_keys SET is_default = 0 WHERE workspace_id = ? AND role = ?")
            .bind(new.workspace_id)
            .bind(&role)
            .execute(&mut *tx)
            .await?;
    }
    let id: i64 = sqlx::query_scalar(
        "INSERT INTO ai_keys (workspace_id, provider, label, key_enc, key_hint, kind, base_url, \
                             model_id, price_in_per_mtok, price_out_per_mtok, max_tokens, \
                             temperature, is_default, role, status, daily_allowance, created_at) \
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'UNVERIFIED', NULL, ?) RETURNING id",
    )
    .bind(new.workspace_id)
    .bind(&new.provider)
    .bind(&new.label)
    .bind(&new.api_key)
    .bind(hint(&new.api_key))
    .bind(
        new.kind
            .clone()
            .unwrap_or_else(|| "openai_compatible".into()),
    )
    .bind(new.base_url.clone())
    .bind(&new.model_id)
    .bind(new.price_in_per_mtok)
    .bind(new.price_out_per_mtok)
    .bind(new.max_tokens.unwrap_or(4096))
    .bind(new.temperature.unwrap_or(0.7))
    .bind(if new.is_default { 1i64 } else { 0i64 })
    .bind(&role)
    .bind(now)
    .fetch_one(&mut *tx)
    .await?;
    tx.commit().await?;
    Ok(id)
}

pub async fn list_providers(
    pool: &SqlitePool,
    workspace_id: i64,
) -> Result<Vec<ProviderView>, sqlx::Error> {
    let rows: Vec<ProviderRow> = sqlx::query_as(
        "SELECT id, workspace_id, provider, label, key_enc, key_hint, kind, base_url, model_id, \
                price_in_per_mtok, price_out_per_mtok, max_tokens, temperature, role, status \
         FROM ai_keys WHERE workspace_id = ? ORDER BY is_default DESC, id ASC",
    )
    .bind(workspace_id)
    .fetch_all(pool)
    .await?;
    Ok(rows.into_iter().map(ProviderView::from).collect())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn key_hint_shows_only_the_tail() {
        assert_eq!(hint("sk-proj-abcdefgh1234"), "••••1234");
        assert_eq!(hint("ab"), "••••ab");
        assert!(!hint("sk-secret-value").contains("secret"));
    }

    #[test]
    fn http_errors_classify_retryability() {
        assert!(EngineError::Http(429, "slow down".into()).retryable());
        assert!(EngineError::Http(503, "down".into()).retryable());
        assert!(!EngineError::Http(401, "bad key".into()).retryable());
        assert!(!EngineError::Malformed("nope".into()).retryable());
        assert!(EngineError::Transport("timeout".into()).retryable());
    }

    #[test]
    fn mock_engine_answers_every_stage_schema() {
        let e = MockEngine {
            model_id: "mock-1".into(),
        };
        for schema in ["blueprint", "draft"] {
            let out = e
                .complete(&ChatRequest {
                    schema: schema.into(),
                    system: "s".into(),
                    user: "u".into(),
                    json: true,
                    images: Vec::new(),
                })
                .unwrap();
            let v: serde_json::Value = serde_json::from_str(&out.text).expect("json");
            assert!(v.is_object(), "{schema} must be a json object");
            assert!(out.tokens_in > 0 && out.tokens_out > 0);
            assert_eq!(
                e.complete(&ChatRequest {
                    schema: schema.into(),
                    system: "s".into(),
                    user: "u".into(),
                    json: true,
                    images: Vec::new(),
                })
                .unwrap()
                .cost_usd,
                0.0,
                "the mock engine bills nothing"
            );
        }
    }
}
