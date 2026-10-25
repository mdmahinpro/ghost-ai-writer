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
    pub priority: i64,
    /// 0/1. The provider rejected this key (401/403); only a human re-enables it.
    pub disabled: i64,
    /// Set on HTTP 429; the key rejoins the pool once this passes.
    pub cooldown_until: Option<String>,
}

/// Base URL and the decrypted credential for one saved provider.
///
/// Used when the server must call a provider on the workspace's behalf with no
/// browser involved (embeddings): the browser holds only `serverKeyId`, never the
/// secret.
pub async fn credentials(pool: &SqlitePool, id: i64) -> Result<(String, String), String> {
    let row: Option<(Option<String>, String)> =
        sqlx::query_as("SELECT base_url, key_enc FROM ai_keys WHERE id = ?1")
            .bind(id)
            .fetch_optional(pool)
            .await
            .map_err(|error| error.to_string())?;
    let (base_url, key_enc) = row.ok_or_else(|| format!("No saved key with id {id}."))?;
    let base_url = base_url.unwrap_or_default();
    if base_url.trim().is_empty() {
        return Err("That key has no base URL, so it cannot serve embeddings.".into());
    }
    let api_key = crate::secrets::open_secret(&key_enc).unwrap_or(key_enc);
    Ok((base_url, api_key))
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
    /// The provider hit `max_tokens` and cut the answer off. Distinct from
    /// `Malformed` because the cause is a budget, not a bad provider: the fix
    /// is a larger `max_tokens`, and the message needs to say so instead of
    /// surfacing as a JSON parse error.
    Truncated { tokens_out: i64 },
}

impl std::fmt::Display for EngineError {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            EngineError::Http(code, body) => write!(f, "provider http {code}: {body}"),
            EngineError::Transport(e) => write!(f, "provider transport: {e}"),
            EngineError::Malformed(e) => write!(f, "provider malformed response: {e}"),
            EngineError::Truncated { tokens_out } => write!(
                f,
                "the model stopped at its output limit after ~{tokens_out} tokens, so the answer \
                 was cut off mid-JSON. Raise this provider's max_tokens (a 2,000-word draft needs \
                 about 6,000) and run the job again."
            ),
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

/// Rough output-token count when the provider omits `usage` — used only for the
/// truncation message, never for billing.
fn tout_estimate(text: &str) -> i64 {
    (text.len() / 4) as i64
}

pub enum Engine {
    Mock(MockEngine),
    Http(Box<HttpEngine>),
}

/// A key's health, which only *demotes* it in the pool — never removes it.
/// Port of the TS `keyPool` demotion ladder:
///   healthy = 0, cooling (live 429 window) = 1, rejected (paused) = 2.
/// Ordering is stable per tier, so the pool is deterministic.
#[derive(Debug, Clone, Copy, PartialEq, Eq, PartialOrd, Ord, serde::Serialize)]
pub enum KeyHealth {
    Healthy = 0,
    Cooling = 1,
    Paused = 2,
}

/// One entry in the failover chain, in the order the worker should try it.
#[derive(Debug, Clone)]
pub struct PoolEntry {
    pub id: i64,
    pub provider: String,
    pub label: String,
    pub priority: i64,
    pub health: KeyHealth,
    pub disabled: bool,
    pub cooldown_until: Option<String>,
    pub key_hint: Option<String>,
}

/// Order a workspace's keys into the failover chain (TS `keyPool`).
///
/// Every key that can call a chat model stays in the pool: `disabled` and a
/// live cooldown only push a key behind the healthy ones. When `preferred` is
/// set it comes first *within its tier* — if the preferred key is paused it
/// must not be tried before a healthy one, but it still beats the other paused
/// keys. Ties break on priority (lower number first, matching the TS
/// `b.priority - a.priority` order), then id for determinism.
pub fn order_pool(mut entries: Vec<PoolEntry>, preferred: Option<i64>, now: &str) -> Vec<PoolEntry> {
    for e in &mut entries {
        let cooling = e
            .cooldown_until
            .as_deref()
            .map(|until| until > now)
            .unwrap_or(false);
        e.health = if e.disabled {
            KeyHealth::Paused
        } else if cooling {
            KeyHealth::Cooling
        } else {
            KeyHealth::Healthy
        };
    }
    entries.sort_by(|a, b| {
        a.health
            .cmp(&b.health)
            .then_with(|| {
                // Preferred first inside its tier.
                let ap = preferred.map(|p| a.id != p).unwrap_or(false);
                let bp = preferred.map(|p| b.id != p).unwrap_or(false);
                ap.cmp(&bp)
            })
            .then_with(|| a.priority.cmp(&b.priority))
            .then_with(|| a.id.cmp(&b.id))
    });
    entries
}

/// The health change a failure implies, and whether it is terminal. Port of the
/// TS `onKeyFailure` ladder:
///   * 401/403 — the provider rejected the key: pause it (terminal).
///   * 429 — rate limited: cool it for 12s, then it returns to the pool.
///   * 400/404/422 — a config error: no cooldown, do not blame the key.
///   * 5xx / transport — transient: no cooldown either.
pub fn failure_action(err: &EngineError) -> KeyFailure {
    match err {
        EngineError::Http(code, _) if *code == 401 || *code == 403 => KeyFailure::Pause,
        EngineError::Http(code, _) if *code == 429 => KeyFailure::Cool,
        _ => KeyFailure::None,
    }
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum KeyFailure {
    /// Stop using this key until a human re-enables it.
    Pause,
    /// Demote for the cooldown window, then it is healthy again.
    Cool,
    /// Not the key's fault: try the next key, change no health flag.
    None,
}

impl Engine {
    /// The `ai_keys.id` behind this engine, when it came from one. Used to
    /// attribute a failure to the key that earned it, so the pool can demote it.
    pub fn key_id(&self) -> Option<i64> {
        match self {
            Engine::Mock(_) => None,
            Engine::Http(h) => h.key_id,
        }
    }

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
                // First answer lands under the 2,000-word floor on purpose so
                // `run_draft`'s one-shot expansion pass fires; the expansion
                // prompt is recognisable by its marker line and gets the full
                // ~2,160-word body back. Deterministic: exactly two draft calls
                // per job, the second one adopted.
                let expanding = req.user.contains("expanded to at least");
                let body_filler = filler.repeat(if expanding { 180 } else { 3 });
                let intro_filler = filler.repeat(if expanding { 12 } else { 2 });
                serde_json::json!({
                    "intro": format!(
                        "A stipend that stops without warning is a logistics problem before it is an \
                         academic one. You need to know who approves money, how long each route takes, \
                         and what to say. This guide walks through the order that works. {intro_filler}"
                    ),
                    "body": body_filler,
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
                // A real revision of a 2,000-word draft stays 2,000+ words —
                // the prompt forbids shrinking — so the fixture is padded to
                // clear the same floor and the e2e can pin the full contract.
                let body = format!(
                    "{}{}",
                    "## What should you do in the first few hours?\n\
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
                    request so escalation has dates attached.\n\n",
                    "Funding gaps usually get solved by asking early and asking in writing. ".repeat(190)
                );
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
    /// The `ai_keys.id` this engine was built from, so a failure can be
    /// attributed to the key that actually earned it. `None` for a key inserted
    /// for a one-off test.
    pub key_id: Option<i64>,
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
    /// `length` means the provider cut the answer off at `max_tokens`. A
    /// truncated JSON body is the direct cause of the "EOF while parsing a
    /// string" rejections, so this has to be visible to the caller.
    #[serde(default)]
    finish_reason: Option<String>,
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

        // A `length` finish means the answer was cut off at max_tokens. For a
        // JSON stage that yields a truncated body, which surfaces downstream as
        // "EOF while parsing a string" — a confusing error for what is really a
        // budget problem. Report it as the truncation it is, and mark it
        // retryable so the stage can ask for a shorter or continued answer.
        if parsed
            .choices
            .first()
            .and_then(|c| c.finish_reason.as_deref())
            .is_some_and(|r| r.eq_ignore_ascii_case("length"))
        {
            return Err(EngineError::Truncated {
                tokens_out: tout_estimate(&text),
            });
        }

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
    // Health demotes, it does not exclude: a cooling key is still returned when
    // it is the only one, and `load_pool` is the failover order for callers that
    // want to walk the whole chain.
    let pool_chain = load_pool(pool, workspace_id, role, None).await?;
    if let Some(engine) = pool_chain.into_iter().next() {
        return Ok(engine);
    }
    // No provider configured: fall back to the mock engine so a fresh install
    // still runs end to end instead of failing every job.
    Ok(Engine::Mock(MockEngine {
        model_id: "mock-1".into(),
    }))
}

/// Load every eligible key for a role as an ordered failover chain (TS
/// `keyPool`). The worker walks the chain: a 429/5xx advances to the next key
/// without pausing anything; a 401/403 pauses the key that was tried. Every key
/// stays in the chain — see `order_pool`.
pub async fn load_pool(
    pool: &SqlitePool,
    workspace_id: i64,
    role: &str,
    preferred: Option<i64>,
) -> Result<Vec<Engine>, sqlx::Error> {
    let now = crate::worker::iso_now();
    let rows: Vec<ProviderRow> = sqlx::query_as(
        "SELECT id, workspace_id, provider, label, key_enc, key_hint, kind, base_url, model_id, \
                price_in_per_mtok, price_out_per_mtok, max_tokens, temperature, role, status, \
                priority, disabled, cooldown_until \
         FROM ai_keys \
         WHERE workspace_id = ? AND role = ? AND status != 'DELETED'",
    )
    .bind(workspace_id)
    .bind(role)
    .fetch_all(pool)
    .await?;
    let entries: Vec<PoolEntry> = rows
        .iter()
        .map(|r| PoolEntry {
            id: r.id,
            provider: r.provider.clone(),
            label: r.label.clone(),
            priority: r.priority,
            health: KeyHealth::Healthy,
            disabled: r.disabled != 0,
            cooldown_until: r.cooldown_until.clone(),
            key_hint: r.key_hint.clone(),
        })
        .collect();
    let by_id: std::collections::HashMap<i64, ProviderRow> =
        rows.into_iter().map(|r| (r.id, r)).collect();
    Ok(order_pool(entries, preferred, &now)
        .into_iter()
        .filter_map(|e| by_id.get(&e.id).cloned().map(engine_from_row))
        .collect())
}

/// What one successful call through the chain produced, plus which key served
/// it — the caller needs the key id to attribute spend in the usage ledger.
pub struct ChainSuccess {
    pub completion: Completion,
    pub key_id: Option<i64>,
    pub model: String,
    pub provider: String,
}

/// Run one chat completion through a workspace's failover chain.
///
/// The same walk the worker does per stage: a 429/5xx advances to the next key,
/// a 401/403 pauses the key that earned it, and every key stays in the chain.
/// Exposed for callers that are not pipeline stages — the browser's idea and
/// draft helpers — so the failover rules live in exactly one place instead of
/// being re-derived per entry point.
///
/// No provider configured falls back to the mock engine, matching `load_engine`
/// so a fresh install still answers instead of failing every request.
pub async fn complete_chain(
    pool: &SqlitePool,
    workspace_id: i64,
    role: &str,
    preferred: Option<i64>,
    req: &ChatRequest,
) -> Result<ChainSuccess, EngineError> {
    let mut chain = load_pool(pool, workspace_id, role, preferred)
        .await
        .map_err(|e| EngineError::Transport(e.to_string()))?;
    if chain.is_empty() {
        chain.push(
            load_engine(pool, workspace_id, role)
                .await
                .map_err(|e| EngineError::Transport(e.to_string()))?,
        );
    }

    let mut last: Option<EngineError> = None;
    for engine in chain {
        match engine.complete(req).await {
            Ok(completion) => {
                if let Some(key_id) = engine.key_id() {
                    let _ = record_key_success(pool, key_id).await;
                }
                return Ok(ChainSuccess {
                    completion,
                    key_id: engine.key_id(),
                    model: engine.model_id().to_string(),
                    provider: engine.provider().to_string(),
                });
            }
            Err(e) => {
                // Blame the key that earned it so the pool demotes it and the
                // next pass starts somewhere better.
                if let Some(key_id) = engine.key_id() {
                    let _ = record_key_failure(pool, key_id, &e).await;
                }
                if e.retryable() {
                    last = Some(e);
                    continue;
                }
                return Err(e);
            }
        }
    }
    Err(last.unwrap_or_else(|| EngineError::Malformed("no key answered".into())))
}

/// A client-safe explanation of a provider failure.
///
/// Provider error bodies are never forwarded: some echo the request, and this
/// text ends up in a browser. The full detail is logged server-side by the
/// caller instead, which is where debugging actually happens.
pub fn safe_message(e: &EngineError) -> String {
    match e {
        EngineError::Http(401 | 403, _) => "The provider refused the key.".to_string(),
        EngineError::Http(code, _) => format!("provider returned http {code}"),
        EngineError::Transport(_) => "provider unreachable".to_string(),
        EngineError::Malformed(_) => "provider returned an unexpected response".to_string(),
        // Not sensitive: it contains no provider body and naming the real cause
        // is the whole point, since "invalid JSON" sent people looking for a
        // format bug when the answer had simply been cut off at the budget.
        EngineError::Truncated { tokens_out } => format!(
            "the model stopped at its output limit after about {tokens_out} tokens and the answer \
             was cut off. Raise this provider's max_tokens (a 2,000-word draft needs about 6,000) \
             and run the job again."
        ),
    }
}

/// The pool as the UI shows it: which key is next, and why any are demoted.
/// Reads `provider`/`label`/`key_hint` (never the secret) so the settings screen
/// can explain a demotion without exposing a key.
pub async fn key_statuses(
    pool: &SqlitePool,
    workspace_id: i64,
    role: &str,
) -> Result<Vec<KeyStatus>, sqlx::Error> {
    let now = iso_now_utc();
    let rows: Vec<ProviderRow> = sqlx::query_as(
        "SELECT id, workspace_id, provider, label, key_enc, key_hint, kind, base_url, model_id, \
                price_in_per_mtok, price_out_per_mtok, max_tokens, temperature, role, status, \
                priority, disabled, cooldown_until \
         FROM ai_keys \
         WHERE workspace_id = ? AND role = ? AND status != 'DELETED'",
    )
    .bind(workspace_id)
    .bind(role)
    .fetch_all(pool)
    .await?;
    let entries: Vec<PoolEntry> = rows
        .iter()
        .map(|r| PoolEntry {
            id: r.id,
            provider: r.provider.clone(),
            label: r.label.clone(),
            priority: r.priority,
            health: KeyHealth::Healthy,
            disabled: r.disabled != 0,
            cooldown_until: r.cooldown_until.clone(),
            key_hint: r.key_hint.clone(),
        })
        .collect();
    Ok(order_pool(entries, None, &now)
        .into_iter()
        .map(|e| KeyStatus {
            id: e.id,
            provider: e.provider,
            label: e.label,
            key_hint: e.key_hint,
            health: e.health,
            cooldown_until: e.cooldown_until,
        })
        .collect())
}

/// One key as reported to the UI, in failover order.
#[derive(Debug, Clone, serde::Serialize)]
pub struct KeyStatus {
    pub id: i64,
    pub provider: String,
    pub label: String,
    /// The masked tail shown instead of the key. Never the key itself.
    pub key_hint: Option<String>,
    pub health: KeyHealth,
    pub cooldown_until: Option<String>,
}

/// Record a key failure: pause on 401/403, cool 12s on 429, otherwise leave the
/// key's health alone. Returns the action taken so the caller can log it.
pub async fn record_key_failure(
    pool: &SqlitePool,
    key_id: i64,
    err: &EngineError,
) -> Result<KeyFailure, sqlx::Error> {
    let action = failure_action(err);
    let now = iso_now_utc();
    let detail = err.to_string();
    match action {
        KeyFailure::Pause => {
            sqlx::query(
                "UPDATE ai_keys SET disabled = 1, cooldown_until = NULL, last_error = ?, \
                 last_error_at = ? WHERE id = ?",
            )
            .bind(&detail)
            .bind(&now)
            .bind(key_id)
            .execute(pool)
            .await?;
        }
        KeyFailure::Cool => {
            // 12s, matching the TS cooldown: long enough for a rate-limit window
            // to pass, short enough that the key returns within the same run.
            let until = iso_after_secs(12);
            sqlx::query(
                "UPDATE ai_keys SET cooldown_until = ?, last_error = ?, last_error_at = ? \
                 WHERE id = ?",
            )
            .bind(&until)
            .bind(&detail)
            .bind(&now)
            .bind(key_id)
            .execute(pool)
            .await?;
        }
        KeyFailure::None => {
            // Still record why, but do not demote the key.
            sqlx::query("UPDATE ai_keys SET last_error = ?, last_error_at = ? WHERE id = ?")
                .bind(&detail)
                .bind(&now)
                .bind(key_id)
                .execute(pool)
                .await?;
        }
    }
    Ok(action)
}

/// Clear a cooldown after a key answers successfully.
pub async fn record_key_success(pool: &SqlitePool, key_id: i64) -> Result<(), sqlx::Error> {
    let now = iso_now_utc();
    sqlx::query(
        "UPDATE ai_keys SET cooldown_until = NULL, last_error = NULL, last_error_at = NULL, \
         last_used_at = ? WHERE id = ?",
    )
    .bind(&now)
    .bind(key_id)
    .execute(pool)
    .await?;
    Ok(())
}

fn iso_now_utc() -> String {
    crate::worker::iso_now()
}

fn iso_after_secs(secs: i64) -> String {
    crate::worker::iso_after(secs)
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
        // Rows written before the column was actually sealed still hold the raw
        // key; `open_secret` returns None for plaintext, so fall back to it
        // rather than break every existing installation.
        api_key: crate::secrets::open_secret(&p.key_enc).unwrap_or(p.key_enc),
        price_in_per_mtok: p.price_in_per_mtok,
        price_out_per_mtok: p.price_out_per_mtok,
        max_tokens: p.max_tokens,
        temperature: p.temperature,
        key_id: Some(p.id),
    }))
}

/// Seal any `ai_keys.key_enc` rows that still hold a plaintext key.
///
/// Rows written before this column was actually encrypted must not be left
/// readable indefinitely: the whole point is that a database copy is useless
/// without the key. Idempotent — already-sealed rows are skipped, so running it
/// on every boot costs one pass over a small table.
pub async fn seal_existing_keys(pool: &SqlitePool) -> Result<usize, sqlx::Error> {
    let rows: Vec<(i64, String)> = sqlx::query_as(
        "SELECT id, key_enc FROM ai_keys WHERE key_enc IS NOT NULL AND key_enc != ''",
    )
    .fetch_all(pool)
    .await?;

    let mut sealed = 0usize;
    for (id, value) in rows {
        // Skip anything that already looks sealed, not just anything that
        // decrypts. A value that fails today may decrypt once the operator
        // restores the right GAW_ENC_KEY; re-sealing it would wrap the
        // ciphertext as plaintext and destroy that chance for good.
        if crate::secrets::looks_sealed(&value) {
            continue;
        }
        sqlx::query("UPDATE ai_keys SET key_enc = ? WHERE id = ?")
            .bind(crate::secrets::seal_secret(&value))
            .bind(id)
            .execute(pool)
            .await?;
        sealed += 1;
    }
    Ok(sealed)
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
    // `key_enc` is meant to hold ciphertext: the TypeScript app sealed this
    // column, and the port had been writing the raw key under the same name.
    .bind(crate::secrets::seal_secret(&new.api_key))
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
    .bind(new.max_tokens.unwrap_or(8192))
    .bind(new.temperature.unwrap_or(0.7))
    .bind(if new.is_default { 1i64 } else { 0i64 })
    .bind(&role)
    .bind(now)
    .fetch_one(&mut *tx)
    .await?;
    tx.commit().await?;
    Ok(id)
}



/// Partial update for a saved key. A blank optional `api_key` keeps the sealed
/// credential on file; a non-blank one replaces it (re-sealed at rest).
#[derive(Deserialize)]
pub struct UpdateProvider {
    pub workspace_id: i64,
    pub label: String,
    pub model_id: String,
    #[serde(default)]
    pub base_url: Option<String>,
    #[serde(default)]
    pub api_key: String,
    #[serde(default)]
    pub priority: i64,
}

/// Update a saved key in place. A blank (or absent) secret keeps the already-sealed
/// credential on file, so editing the model, label, base URL, or priority never
/// invalidates a working key. Returns the updated row's id so the browser can re-bind
/// its local row to this server id.
pub async fn update_provider(
    pool: &SqlitePool,
    id: i64,
    req: &UpdateProvider,
) -> Result<i64, sqlx::Error> {
    let existing: Option<(String, String, String)> =
        sqlx::query_as("SELECT key_enc, base_url, key_hint FROM ai_keys WHERE id = ?")
            .bind(id)
            .fetch_optional(pool)
            .await?;
    let (enc, old_base, hint_on_file) = match existing {
        None => return Err(sqlx::Error::RowNotFound),
        Some(row) => row,
    };

    // Carry over base_url when the client sends none.
    let base_url = req.base_url.clone().filter(|v| !v.trim().is_empty()).or(Some(old_base));

    // A blank secret keeps the sealed value AND its hint; a non-blank one re-seals
    // and re-derives the hint (masked last four). Decryption never happens here.
    let (new_enc, new_hint) = if req.api_key.trim().is_empty() {
        (enc, hint_on_file)
    } else {
        (crate::secrets::seal_secret(&req.api_key), hint(&req.api_key))
    };

    let res: i64 = sqlx::query_scalar(
        "UPDATE ai_keys SET label = ?, model_id = ?, base_url = ?, priority = ?, \
                 key_enc = ?, key_hint = ?, status = 'UNVERIFIED' \
         WHERE id = ? RETURNING id",
    )
    .bind(&req.label)
    .bind(&req.model_id)
    .bind(base_url)
    .bind(req.priority)
    .bind(new_enc)
    .bind(new_hint)
    .bind(id)
    .fetch_one(pool)
    .await?;
    Ok(res)
}

pub async fn list_providers(
    pool: &SqlitePool,
    workspace_id: i64,
) -> Result<Vec<ProviderView>, sqlx::Error> {
    let rows: Vec<ProviderRow> = sqlx::query_as(
        "SELECT id, workspace_id, provider, label, key_enc, key_hint, kind, base_url, model_id, \
                price_in_per_mtok, price_out_per_mtok, max_tokens, temperature, role, status, \
                priority, disabled, cooldown_until \
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

    fn entry(id: i64, priority: i64, disabled: bool, cooldown: Option<&str>) -> PoolEntry {
        PoolEntry {
            id,
            provider: "openai".into(),
            label: format!("key {id}"),
            priority,
            health: KeyHealth::Healthy,
            disabled,
            cooldown_until: cooldown.map(|c| c.to_string()),
            key_hint: None,
        }
    }

    fn ids(pool: &[PoolEntry]) -> Vec<i64> {
        pool.iter().map(|e| e.id).collect()
    }

    const NOW: &str = "2026-01-01T00:00:00Z";

    #[test]
    fn a_rate_limited_key_is_demoted_not_dropped() {
        // Key 1 is the default/priority winner but is inside its 429 window:
        // it must still be in the pool, just behind the healthy keys.
        let pool = order_pool(
            vec![
                entry(1, 1, false, Some("2026-01-01T00:00:12Z")), // cooling
                entry(2, 5, false, None),                         // healthy
            ],
            None,
            NOW,
        );
        assert_eq!(ids(&pool), vec![2, 1], "the cooling key must not be first");
        assert_eq!(pool.len(), 2, "a cooling key is never removed from the pool");
        assert_eq!(pool[1].health, KeyHealth::Cooling);
    }

    #[test]
    fn an_expired_cooldown_returns_the_key_to_priority_order() {
        // The window has passed: health is healthy again, so priority decides.
        let pool = order_pool(
            vec![
                entry(1, 1, false, Some("2025-12-31T23:59:00Z")),
                entry(2, 5, false, None),
            ],
            None,
            NOW,
        );
        assert_eq!(ids(&pool), vec![1, 2], "priority order restored after cooldown");
        assert_eq!(pool[0].health, KeyHealth::Healthy);
    }

    #[test]
    fn a_rejected_key_is_last_but_still_available() {
        // disabled = the provider answered 401/403. It is tried only if every
        // other key also failed — never silently dropped.
        let pool = order_pool(
            vec![
                entry(1, 1, true, None),
                entry(2, 9, false, None),
                entry(3, 3, false, Some("2026-01-01T00:00:12Z")),
            ],
            None,
            NOW,
        );
        assert_eq!(ids(&pool), vec![2, 3, 1], "order: healthy, cooling, paused");
        assert_eq!(pool.len(), 3, "a paused key stays in the failover chain");
        assert_eq!(pool[2].health, KeyHealth::Paused);
    }

    #[test]
    fn the_preferred_key_leads_its_tier_but_not_past_a_healthy_one() {
        // Preferred and healthy → first.
        let pool = order_pool(
            vec![entry(1, 50, false, None), entry(2, 1, false, None)],
            Some(1),
            NOW,
        );
        assert_eq!(ids(&pool), vec![1, 2], "preferred key wins over priority");
        // Preferred but cooling → still behind the healthy key.
        let pool = order_pool(
            vec![
                entry(1, 1, false, Some("2026-01-01T00:00:12Z")),
                entry(2, 50, false, None),
            ],
            Some(1),
            NOW,
        );
        assert_eq!(ids(&pool), vec![2, 1], "a preferred key cannot outrank health");
    }

    #[test]
    fn priority_order_is_deterministic() {
        let pool = order_pool(
            vec![
                entry(3, 10, false, None),
                entry(1, 10, false, None),
                entry(2, 5, false, None),
            ],
            None,
            NOW,
        );
        // Lower priority number first; equal priority breaks on id.
        assert_eq!(ids(&pool), vec![2, 1, 3]);
    }

    #[test]
    fn the_failure_ladder_matches_the_ts_on_key_failure() {
        // Provider rejected the key: pause it.
        assert_eq!(
            failure_action(&EngineError::Http(401, "bad key".into())),
            KeyFailure::Pause
        );
        assert_eq!(
            failure_action(&EngineError::Http(403, "forbidden".into())),
            KeyFailure::Pause
        );
        // Rate limited: cool for the window.
        assert_eq!(
            failure_action(&EngineError::Http(429, "slow down".into())),
            KeyFailure::Cool
        );
        // Config error, not the key's fault.
        assert_eq!(
            failure_action(&EngineError::Http(400, "bad model".into())),
            KeyFailure::None
        );
        assert_eq!(
            failure_action(&EngineError::Http(422, "unprocessable".into())),
            KeyFailure::None
        );
        // Transient: no cooldown, no pause.
        assert_eq!(
            failure_action(&EngineError::Http(503, "down".into())),
            KeyFailure::None
        );
        assert_eq!(
            failure_action(&EngineError::Transport("timeout".into())),
            KeyFailure::None
        );
    }

    #[test]
    fn only_a_rate_limit_advances_to_the_next_key_without_blaming_it() {
        // A 429 and a 5xx are both retryable, but only the 429 demotes the key.
        let rate_limited = EngineError::Http(429, "slow down".into());
        assert!(rate_limited.retryable());
        assert_eq!(failure_action(&rate_limited), KeyFailure::Cool);
        let transient = EngineError::Http(503, "down".into());
        assert!(transient.retryable());
        assert_eq!(failure_action(&transient), KeyFailure::None);
    }

    /// Against the real schema: the pool is built from `ai_keys`, a 429 demotes
    /// a key to the back of the chain, and a success clears the cooldown so it
    /// returns to priority order.
    #[tokio::test]
    async fn the_pool_reads_key_health_from_the_database() {
        use sqlx::sqlite::SqlitePoolOptions;
        // A single connection: `sqlite::memory:` gives each connection its own
        // private database, so migrations and queries must share one.
        let p = SqlitePoolOptions::new()
            .max_connections(1)
            .connect("sqlite::memory:")
            .await
            .expect("db");
        sqlx::migrate!("../migrations").run(&p).await.expect("migrate");
        sqlx::query("INSERT INTO workspaces (id,name,created_at) VALUES (1,'W','2026-01-01T00:00:00Z')")
            .execute(&p)
            .await
            .unwrap();
        // key 2 has the better (lower) priority, so it leads while healthy.
        for (id, priority) in [(1i64, 50i64), (2, 10)] {
            sqlx::query(
                "INSERT INTO ai_keys (id,workspace_id,provider,label,key_enc,priority,status,role,created_at) \
                 VALUES (?,1,'openai',?,'enc',?,'VERIFIED','text','2026-01-01T00:00:00Z')",
            )
            .bind(id)
            .bind(format!("key {id}"))
            .bind(priority)
            .execute(&p)
            .await
            .unwrap();
        }

        let chain = load_pool(&p, 1, "text", None).await.unwrap();
        assert_eq!(chain.len(), 2, "both keys are eligible");

        // A 429 on key 2 cools it: it must drop behind key 1, not disappear.
        assert_eq!(
            record_key_failure(&p, 2, &EngineError::Http(429, "slow down".into()))
                .await
                .unwrap(),
            KeyFailure::Cool
        );
        let chain = load_pool(&p, 1, "text", None).await.unwrap();
        assert_eq!(chain.len(), 2, "a cooling key is not dropped from the pool");
        assert_eq!(chain[0].model_id(), "gpt-4o-mini");

        // A 401 on key 1 pauses it — it is still in the chain, tried last.
        assert_eq!(
            record_key_failure(&p, 1, &EngineError::Http(401, "bad key".into()))
                .await
                .unwrap(),
            KeyFailure::Pause
        );
        let (disabled, cooldown): (i64, Option<String>) =
            sqlx::query_as("SELECT disabled, cooldown_until FROM ai_keys WHERE id = 1")
                .fetch_one(&p)
                .await
                .unwrap();
        assert_eq!(disabled, 1, "a rejected key is paused");
        assert!(cooldown.is_none(), "pausing clears any cooldown");

        // A success on key 2 clears its cooldown, so priority order returns.
        record_key_success(&p, 2).await.unwrap();
        let (cooldown, last_used): (Option<String>, Option<String>) =
            sqlx::query_as("SELECT cooldown_until, last_used_at FROM ai_keys WHERE id = 2")
                .fetch_one(&p)
                .await
                .unwrap();
        assert!(cooldown.is_none(), "success clears the cooldown");
        assert!(last_used.is_some(), "success records when the key was used");

        // No key for the role configured at all → the mock fallback, never an
        // error that fails every job on a fresh install.
        assert_eq!(
            load_engine(&p, 1, "nonexistent-role").await.unwrap().provider(),
            MOCK_PROVIDER
        );

        // The settings view reports the demotion with the mask, never the key.
        let statuses = key_statuses(&p, 1, "text").await.unwrap();
        assert_eq!(statuses.len(), 2);
        assert_eq!(
            statuses[0].id, 2,
            "key 2 shed its cooldown and leads on priority again"
        );
        assert_eq!(statuses[0].health, KeyHealth::Healthy);
        assert_eq!(statuses[1].id, 1);
        assert_eq!(
            statuses[1].health,
            KeyHealth::Paused,
            "key 1 was rejected and is reported as paused"
        );
        assert_eq!(statuses[0].label, "key 2");
    }

    /// A migrated database with a workspace row, using the real schema.
    async fn pool_with_workspace() -> sqlx::SqlitePool {
        use sqlx::sqlite::SqlitePoolOptions;
        let p = SqlitePoolOptions::new()
            .max_connections(1)
            .connect("sqlite::memory:")
            .await
            .expect("db");
        sqlx::migrate!("../migrations").run(&p).await.expect("migrate");
        sqlx::query("INSERT INTO workspaces (id,name,created_at) VALUES (1,'W','2026-01-01T00:00:00Z')")
            .execute(&p)
            .await
            .unwrap();
        p
    }

    fn new_provider(api_key: &str) -> NewProvider {
        NewProvider {
            workspace_id: 1,
            provider: "openai".into(),
            label: "K".into(),
            api_key: api_key.to_string(),
            kind: None,
            base_url: None,
            model_id: "gpt-4o-mini".into(),
            price_in_per_mtok: 0.0,
            price_out_per_mtok: 0.0,
            max_tokens: None,
            temperature: None,
            role: None,
            is_default: false,
        }
    }

    /// `key_enc` must actually hold ciphertext — the column was written raw by
    /// the port, which made a database copy as good as the live server.
    #[tokio::test]
    async fn provider_keys_are_sealed_at_rest_and_decrypt_for_use() {
        let p = pool_with_workspace().await;
        let id = insert_provider(&p, "2026-01-01T00:00:00Z", &new_provider("sk-live-abc123"))
            .await
            .unwrap();

        let raw: String = sqlx::query_scalar("SELECT key_enc FROM ai_keys WHERE id = ?")
            .bind(id)
            .fetch_one(&p)
            .await
            .unwrap();
        assert!(raw.starts_with("enc:v1:"), "stored value is ciphertext: {raw}");
        assert!(!raw.contains("sk-live"), "the raw key must not be readable");

        // A sealed key must still hand the exact original string to the engine.
        let chain = load_pool(&p, 1, "text", None).await.unwrap();
        assert_eq!(chain.len(), 1);
        match &chain[0] {
            Engine::Http(h) => assert_eq!(h.api_key, "sk-live-abc123"),
            Engine::Mock(_) => panic!("expected the http engine"),
        }
    }

    #[tokio::test]
    async fn legacy_plaintext_keys_are_sealed_once_and_still_work() {
        let p = pool_with_workspace().await;
        sqlx::query(
            "INSERT INTO ai_keys (id,workspace_id,provider,label,key_enc,priority,status,role,created_at) \
             VALUES (9,1,'openai','legacy','sk-legacy-plain',100,'VERIFIED','text','2026-01-01T00:00:00Z')",
        )
        .execute(&p)
        .await
        .unwrap();

        assert_eq!(seal_existing_keys(&p).await.unwrap(), 1);

        let raw: String = sqlx::query_scalar("SELECT key_enc FROM ai_keys WHERE id = 9")
            .fetch_one(&p)
            .await
            .unwrap();
        assert!(raw.starts_with("enc:v1:"), "legacy row was not sealed");

        // Sealing must not break the key it protects.
        let chain = load_pool(&p, 1, "text", None).await.unwrap();
        match &chain[0] {
            Engine::Http(h) => assert_eq!(h.api_key, "sk-legacy-plain"),
            Engine::Mock(_) => panic!("expected the http engine"),
        }

        // Idempotent: a second boot does not re-encrypt ciphertext.
        assert_eq!(seal_existing_keys(&p).await.unwrap(), 0);
    }

    #[tokio::test]
    async fn a_damaged_key_value_is_left_alone_rather_than_re_encrypted() {
        let p = pool_with_workspace().await;
        // Right prefix, garbage body: cannot be decrypted, so overwriting it
        // would destroy whatever the operator might still recover.
        sqlx::query(
            "INSERT INTO ai_keys (id,workspace_id,provider,label,key_enc,priority,status,role,created_at) \
             VALUES (11,1,'openai','broken','enc:v1:not:real:data',100,'VERIFIED','text','2026-01-01T00:00:00Z')",
        )
        .execute(&p)
        .await
        .unwrap();

        assert_eq!(seal_existing_keys(&p).await.unwrap(), 0);
        let raw: String = sqlx::query_scalar("SELECT key_enc FROM ai_keys WHERE id = 11")
            .fetch_one(&p)
            .await
            .unwrap();
        assert_eq!(raw, "enc:v1:not:real:data");
    }

    /// `list_providers` used to project fewer columns than its row type needs,
    /// which made `GET /api/v1/providers` a 500 on every request.
    #[tokio::test]
    async fn listing_providers_returns_the_saved_keys() {
        let p = pool_with_workspace().await;
        insert_provider(
            &p,
            "2026-01-01T00:00:00Z",
            &NewProvider {
                workspace_id: 1,
                provider: "openai".into(),
                label: "listed".into(),
                api_key: "sk-listed-0001".into(),
                kind: None,
                base_url: None,
                model_id: "gpt-4o-mini".into(),
                price_in_per_mtok: 0.0,
                price_out_per_mtok: 0.0,
                max_tokens: None,
                temperature: None,
                role: None,
                is_default: false,
            },
        )
        .await
        .unwrap();

        let items = list_providers(&p, 1).await.expect("listing must not fail");
        assert_eq!(items.len(), 1);
        assert_eq!(items[0].label, "listed");
        // The secret is never part of the view.
        let json = serde_json::to_string(&items[0]).unwrap();
        assert!(!json.contains("sk-listed"), "the view must not expose the key: {json}");
    }
}
