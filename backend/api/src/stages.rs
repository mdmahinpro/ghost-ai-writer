//! Stages 1–2 of the six-stage pipeline, pinned to the contracts recovered from
//! their shipped bundles:
//!
//! * Blueprint  — `mustCover` 3–10 items, `sections` 1–12.
//! * Draft      — `intro` 100–4000 chars, `body` 200–9000 chars, `faq` ≤ 8,
//!                `claims[]` each `SUPPORTED | UNSUPPORTED | OPINION`.
//!
//! A stage that returns text outside those bounds is **rejected**, not clamped:
//! silently trimming produces an article that no longer matches its blueprint.
//! One repair round is allowed (the failure reason is fed back), then the job
//! fails and retries with backoff, exactly like theirs.

use crate::lint;
use crate::provider::{ChatRequest, Engine, EngineError};
use serde::{Deserialize, Serialize};
use serde_json::{json, Value};
use sqlx::SqlitePool;
use std::collections::HashSet;

pub const MAX_REPAIRS: usize = 1;

/// Revision passes allowed by the writing-quality contract: a second pass only
/// happens when the linter still finds High-severity slop after the first.
pub const MAX_REVISION_PASSES: usize = 2;

/// Every `mustCover` item must appear in the revised prose. A "must cover" that
/// 20% of the article ignores is a missing section, not a rounding error — their
/// own pipeline reports 0.99 coverage, so anything less is a rewrite.
pub const MIN_COVERAGE: f64 = 1.0;

/// How many of the six stages actually have implementations. Jobs stop here and
/// are marked PARTIAL — calling a job COMPLETED while stages 5-6 do nothing
/// would be a lie the UI would happily render.
pub const IMPLEMENTED_STAGES: i64 = 4;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Section {
    pub heading: String,
    #[serde(default)]
    pub covers: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Blueprint {
    pub intent: String,
    #[serde(default)]
    pub angle: Option<String>,
    #[serde(rename = "titleHint")]
    pub title_hint: String,
    #[serde(rename = "mustCover")]
    pub must_cover: Vec<String>,
    pub sections: Vec<Section>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Faq {
    pub question: String,
    pub answer: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Claim {
    pub text: String,
    pub status: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Draft {
    pub intro: String,
    pub body: String,
    #[serde(default)]
    pub faq: Vec<Faq>,
    #[serde(default)]
    pub claims: Vec<Claim>,
    #[serde(default, rename = "answerBlock")]
    pub answer_block: Option<String>,
}

pub fn validate_blueprint(v: &Value) -> Result<Blueprint, Vec<String>> {
    let mut errs = Vec::new();
    let bp: Blueprint = match serde_json::from_value(v.clone()) {
        Ok(b) => b,
        Err(e) => return Err(vec![format!("blueprint shape: {e}")]),
    };
    if !(3..=10).contains(&bp.must_cover.len()) {
        errs.push(format!(
            "mustCover must have 3-10 items (got {})",
            bp.must_cover.len()
        ));
    }
    if bp.must_cover.iter().any(|m| m.trim().is_empty()) {
        errs.push("mustCover items must be non-empty".into());
    }
    if !(1..=12).contains(&bp.sections.len()) {
        errs.push(format!(
            "sections must have 1-12 items (got {})",
            bp.sections.len()
        ));
    }
    if bp.sections.iter().any(|s| s.heading.trim().is_empty()) {
        errs.push("every section needs a heading".into());
    }
    if bp.title_hint.trim().is_empty() {
        errs.push("titleHint must be non-empty".into());
    }
    if !errs.is_empty() {
        return Err(errs);
    }
    Ok(bp)
}

pub fn validate_draft(v: &Value) -> Result<Draft, Vec<String>> {
    let mut errs = Vec::new();
    let d: Draft = match serde_json::from_value(v.clone()) {
        Ok(d) => d,
        Err(e) => return Err(vec![format!("draft shape: {e}")]),
    };
    let intro = d.intro.chars().count();
    if !(100..=4000).contains(&intro) {
        errs.push(format!("intro must be 100-4000 chars (got {intro})"));
    }
    let body = d.body.chars().count();
    if !(200..=9000).contains(&body) {
        errs.push(format!("body must be 200-9000 chars (got {body})"));
    }
    if d.faq.len() > 8 {
        errs.push(format!("faq allows at most 8 items (got {})", d.faq.len()));
    }
    for c in &d.claims {
        if !["SUPPORTED", "UNSUPPORTED", "OPINION"].contains(&c.status.as_str()) {
            errs.push(format!(
                "claim status must be SUPPORTED|UNSUPPORTED|OPINION (got {})",
                c.status
            ));
        }
    }
    if let Some(ab) = &d.answer_block {
        let n = ab.chars().count();
        if !(80..=600).contains(&n) {
            errs.push(format!("answerBlock must be 80-600 chars (got {n})"));
        }
    }
    if !errs.is_empty() {
        return Err(errs);
    }
    Ok(d)
}

/// Stage-3 self-assessment their pipeline carries alongside the revised prose.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct QualityReport {
    #[serde(default, rename = "intentMatch")]
    pub intent_match: f64,
    #[serde(default)]
    pub coverage: f64,
    #[serde(default)]
    pub repetition: f64,
    #[serde(default, rename = "unsupportedClaims")]
    pub unsupported_claims: Vec<String>,
    #[serde(default)]
    pub notes: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
pub struct Critique {
    #[serde(default, rename = "unnaturalTransitions")]
    pub unnatural_transitions: Vec<String>,
    #[serde(default, rename = "formattingIssues")]
    pub formatting_issues: Vec<String>,
    #[serde(default, rename = "genericFiller")]
    pub generic_filler: Vec<String>,
    #[serde(default, rename = "revisionNeeded")]
    pub revision_needed: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Revision {
    pub intro: String,
    pub body: String,
    #[serde(default)]
    pub faq: Vec<Faq>,
    #[serde(default)]
    pub claims: Vec<Claim>,
    #[serde(default, rename = "answerBlock")]
    pub answer_block: Option<String>,
    #[serde(default, rename = "qualityReport")]
    pub quality: Option<QualityReport>,
    #[serde(default)]
    pub critique: Option<Critique>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Metadata {
    #[serde(default)]
    pub title: Option<String>,
    #[serde(rename = "metaDescription")]
    pub meta_description: String,
    pub excerpt: String,
    #[serde(default)]
    pub tags: Vec<String>,
    #[serde(default)]
    pub slug: Option<String>,
}

const STOPWORDS: [&str; 24] = [
    "that", "this", "with", "from", "they", "what", "when", "your", "have", "will", "into",
    "about", "there", "their", "which", "would", "should", "could", "after", "before", "then",
    "than", "also", "just",
];

/// Crude stem so "decision"/"decisions" and "escalation"/"escalate" match. Without
/// it a correct rewrite fails the coverage gate on morphology alone.
fn stem(w: &str) -> String {
    w.chars()
        .take(if w.chars().count() > 6 {
            6
        } else {
            w.chars().count()
        })
        .collect()
}

fn significant_tokens(s: &str) -> HashSet<String> {
    s.to_lowercase()
        .split(|c: char| !c.is_alphanumeric())
        .filter(|w| w.len() >= 4 && !STOPWORDS.contains(w))
        .map(stem)
        .collect()
}

/// Does the prose actually cover the blueprint? Their pipeline trusts the model's
/// self-reported `coverage`; that number is recorded but never trusted, because a
/// model that skimmed a section still reports 0.99.
pub fn coverage_check(body: &str, must_cover: &[String]) -> (f64, Vec<String>) {
    if must_cover.is_empty() {
        return (1.0, Vec::new());
    }
    let body_tokens = significant_tokens(body);
    let mut missing = Vec::new();
    for item in must_cover {
        let want = significant_tokens(item);
        if want.is_empty() {
            // Nothing searchable in the item (e.g. "the first 72 hours"): fall
            // back to a substring test on the lowercased body.
            if !body.to_lowercase().contains(&item.to_lowercase()) {
                missing.push(item.clone());
            }
            continue;
        }
        let hits = want.iter().filter(|w| body_tokens.contains(*w)).count();
        if (hits as f64 / want.len() as f64) < 0.6 {
            missing.push(item.clone());
        }
    }
    let covered = (must_cover.len() - missing.len()) as f64 / must_cover.len() as f64;
    (covered, missing)
}

pub fn validate_revision(v: &Value) -> Result<Revision, Vec<String>> {
    // The revised article is still an article: the stage-2 bounds apply.
    let mut errs = match validate_draft(v) {
        Ok(_) => Vec::new(),
        Err(e) => e,
    };
    let r: Revision = match serde_json::from_value(v.clone()) {
        Ok(r) => r,
        Err(e) => return Err(vec![format!("revision shape: {e}")]),
    };
    if let Some(q) = &r.quality {
        for (name, val) in [
            ("intentMatch", q.intent_match),
            ("coverage", q.coverage),
            ("repetition", q.repetition),
        ] {
            if !(0.0..=1.0).contains(&val) {
                errs.push(format!("qualityReport.{name} must be 0..1 (got {val})"));
            }
        }
    }
    if !errs.is_empty() {
        return Err(errs);
    }
    Ok(r)
}

pub fn validate_metadata(v: &Value) -> Result<Metadata, Vec<String>> {
    let mut errs = Vec::new();
    let m: Metadata = match serde_json::from_value(v.clone()) {
        Ok(m) => m,
        Err(e) => return Err(vec![format!("metadata shape: {e}")]),
    };
    let md = m.meta_description.chars().count();
    if !(50..=300).contains(&md) {
        errs.push(format!("metaDescription must be 50-300 chars (got {md})"));
    }
    let ex = m.excerpt.chars().count();
    if !(30..=400).contains(&ex) {
        errs.push(format!("excerpt must be 30-400 chars (got {ex})"));
    }
    if m.tags.len() > 8 {
        errs.push(format!(
            "tags allows at most 8 items (got {})",
            m.tags.len()
        ));
    }
    if m.tags.iter().any(|t| t.trim().is_empty()) {
        errs.push("tags must be non-empty strings".into());
    }
    if let Some(t) = &m.title {
        let n = t.chars().count();
        if !(10..=120).contains(&n) {
            errs.push(format!("title must be 10-120 chars (got {n})"));
        }
    }
    if !errs.is_empty() {
        return Err(errs);
    }
    Ok(m)
}

/// Their stage-1 prompt shape: intent + coverage contract, no prose yet.
pub fn blueprint_prompt(keyword: &str, site: &str) -> (String, String) {
    let system = format!(
        "You plan articles for the site {site}. You return only JSON.\n\
         Work out what the searcher actually needs, then state the coverage contract \
         the draft must satisfy. Sections are questions or concrete claims, never \
         labels like 'Introduction' or 'Conclusion'. No marketing language."
    );
    let user = format!(
        "Keyword: {keyword}\n\n\
         Return JSON with exactly these keys:\n\
         - intent: the search intent in a few words\n\
         - angle: the specific angle this article takes\n\
         - titleHint: a working title\n\
         - mustCover: array of 3 to 10 facts or questions the draft must cover\n\
         - sections: array of 1 to 12 objects, each {{\"heading\": string, \"covers\": string}}\n\
         Every mustCover item must map to at least one section."
    );
    (system, user)
}

/// Stage-2 prompt: blueprint in, prose out, humanizer rules folded in so the
/// draft is close to publishable before the linter (S9) sees it.
pub fn draft_prompt(keyword: &str, bp: &Blueprint) -> (String, String) {
    let system = "You write the article body. You return only JSON.\n\
        Rules that are enforced afterwards by a linter, so follow them:\n\
        - Vary sentence length. Cut filler openings ('In today's world', 'It is important to note').\n\
        - No 'not only X but Y', no 'it's not just X, it's Y'. Say the thing plainly.\n\
        - No em dash spam. No 'delve', 'leverage', 'robust', 'seamless', 'unlock', 'elevate'.\n\
        - Never invent statistics, studies, quotes, dates or names. If a claim needs proof \
          you do not have, mark it OPINION or leave it out.\n\
        - Do not start every paragraph the same way."
        .to_string();
    let covers = bp
        .must_cover
        .iter()
        .map(|m| format!("- {m}"))
        .collect::<Vec<_>>()
        .join("\n");
    let headings = bp
        .sections
        .iter()
        .map(|s| format!("- {}", s.heading))
        .collect::<Vec<_>>()
        .join("\n");
    let user = format!(
        "Keyword: {keyword}\nTitle: {}\nAngle: {}\n\nMust cover:\n{covers}\n\nSections to write:\n{headings}\n\n\
         Return JSON with these keys:\n\
         - intro: 100-4000 characters, opens with the reader's actual situation\n\
         - body: 200-9000 characters of markdown, one '## ' heading per section above, covers every mustCover item\n\
         - faq: at most 8 objects {{\"question\", \"answer\"}}\n\
         - claims: array of {{\"text\", \"status\"}} where status is SUPPORTED, UNSUPPORTED or OPINION\n\
         - answerBlock: 80-600 characters, two sentences that answer the query directly and can be quoted",
        bp.title_hint, bp.angle.clone().unwrap_or_default()
    );
    (system, user)
}

/// Stage-3 prompt: revise for coverage and prose quality, and say what changed.
pub fn revision_prompt(
    keyword: &str,
    bp: &Blueprint,
    draft_json: &str,
    lint_note: &str,
) -> (String, String) {
    let system = "You revise an article draft. You return only JSON.\n\
        Fix, in this order: anything from the coverage contract that is missing, \
        then prose that a linter would flag, then repetition.\n\
        Keep every fact that was already there. Never add statistics, studies, quotes, \
        dates or names that were not in the draft. If a sentence cannot survive without \
        invented evidence, cut it.\n\
        Do not add headings for the sake of it, do not pad, do not restate the intro."
        .to_string();
    let covers = bp
        .must_cover
        .iter()
        .map(|m| format!("- {m}"))
        .collect::<Vec<_>>()
        .join("\n");
    let mut user = format!(
        "Keyword: {keyword}\nTitle: {}\n\nCoverage contract:\n{covers}\n\n\
         Current draft:\n{draft_json}\n\n\
         Return JSON with these keys:\n\
         - intro: 100-4000 characters\n\
         - body: 200-9000 characters of markdown, one '## ' heading per section, \
           every mustCover item genuinely covered\n\
         - faq: at most 8 objects {{\"question\", \"answer\"}}\n\
         - claims: array of {{\"text\", \"status\"}} where status is SUPPORTED, UNSUPPORTED or OPINION\n\
         - answerBlock: 80-600 characters that answer the query directly\n\
         - qualityReport: {{\"intentMatch\": 0..1, \"coverage\": 0..1, \"repetition\": 0..1, \
           \"unsupportedClaims\": [string], \"notes\": string}}\n\
         - critique: {{\"unnaturalTransitions\": [string], \"formattingIssues\": [string], \
           \"genericFiller\": [string], \"revisionNeeded\": boolean}}",
        bp.title_hint
    );
    if !lint_note.is_empty() {
        user.push_str(&format!(
            "\n\nA linter flagged the previous revision:\n{lint_note}\n\
             Fix those lines and keep the coverage."
        ));
    }
    (system, user)
}

/// Stage-4 prompt: the packaging that goes into meta tags, not the article body.
pub fn metadata_prompt(keyword: &str, bp: &Blueprint, prose: &str) -> (String, String) {
    let system = "You package a finished article. You return only JSON.\n\
        Write metadata a human would click on, not keyword soup. \
        No numbers you cannot see in the article."
        .to_string();
    let tail: String = prose.chars().take(3000).collect();
    let user = format!(
        "Keyword: {keyword}\nTitle: {}\n\nArticle:\n{tail}\n\n\
         Return JSON with these keys:\n\
         - title: 10-120 characters, specific to this article\n\
         - metaDescription: 50-300 characters, the reason to click\n\
         - excerpt: 30-400 characters for the index page\n\
         - tags: at most 8 short tags\n\
         - slug: lowercase, hyphenated",
        bp.title_hint
    );
    (system, user)
}

fn slugify(s: &str) -> String {
    let mut out = String::new();
    let mut dash = false;
    for ch in s.to_lowercase().chars() {
        if ch.is_ascii_alphanumeric() {
            out.push(ch);
            dash = false;
        } else if !dash && !out.is_empty() {
            out.push('-');
            dash = true;
        }
    }
    let trimmed = out.trim_end_matches('-').to_string();
    if trimmed.is_empty() {
        "article".to_string()
    } else {
        trimmed.chars().take(80).collect()
    }
}

/// What the provider actually billed, across every call a stage made — including
/// calls whose answer was rejected. A rejected answer is still a paid request;
/// charging only the accepted one would under-report spend in `usage_ledger`.
#[derive(Debug, Default, Clone, Copy)]
pub struct Spend {
    pub tokens_in: i64,
    pub tokens_out: i64,
    pub cost_usd: f64,
}

impl Spend {
    fn add(&mut self, c: &crate::provider::Completion) {
        self.tokens_in += c.tokens_in;
        self.tokens_out += c.tokens_out;
        self.cost_usd += c.cost_usd;
    }
}

/// Ask the engine for JSON, repairing once if validation rejects it.
async fn call_validated<T, F>(
    engine: &Engine,
    schema: &str,
    system: &str,
    user: &str,
    validate: F,
) -> Result<(T, Spend, usize), StageError>
where
    F: Fn(&Value) -> Result<T, Vec<String>>,
{
    let mut feedback: Option<String> = None;
    let mut attempts = 0;
    let mut spend = Spend::default();
    loop {
        attempts += 1;
        let user_msg = match &feedback {
            None => user.to_string(),
            Some(f) => format!(
                "{user}\n\nYour previous answer was rejected by validation:\n{f}\n\
                 Return corrected JSON that satisfies every rule."
            ),
        };
        let req = ChatRequest {
            schema: schema.to_string(),
            system: system.to_string(),
            user: user_msg,
            json: true,
        };
        let completion = match engine.complete(&req).await {
            Ok(c) => c,
            Err(e) => {
                // 429s and 5xx are the provider's problem, not the article's:
                // retry them here rather than spending one of the job's
                // attempts on a transient failure.
                if e.retryable() && attempts <= MAX_REPAIRS {
                    feedback = None;
                    continue;
                }
                return Err(StageError::Engine(e));
            }
        };
        let value: Value = match serde_json::from_str(completion.text.trim()) {
            Ok(v) => v,
            Err(e) => {
                let errs = vec![format!("response was not valid JSON: {e}")];
                if attempts > MAX_REPAIRS {
                    return Err(StageError::Validation(schema.to_string(), errs));
                }
                feedback = Some(errs.join("\n"));
                continue;
            }
        };
        spend.add(&completion);
        match validate(&value) {
            Ok(ok) => return Ok((ok, spend, attempts)),
            Err(errs) => {
                if attempts > MAX_REPAIRS {
                    return Err(StageError::Validation(schema.to_string(), errs));
                }
                feedback = Some(errs.join("\n"));
            }
        }
    }
}

#[derive(Debug)]
pub enum StageError {
    Engine(EngineError),
    Validation(String, Vec<String>),
    Db(sqlx::Error),
}

impl std::fmt::Display for StageError {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            StageError::Engine(e) => write!(f, "{e}"),
            StageError::Validation(schema, errs) => {
                write!(f, "{schema} rejected: {}", errs.join("; "))
            }
            StageError::Db(e) => write!(f, "db: {e}"),
        }
    }
}

impl From<sqlx::Error> for StageError {
    fn from(e: sqlx::Error) -> Self {
        StageError::Db(e)
    }
}

pub struct StageOutcome {
    pub tokens_in: i64,
    pub tokens_out: i64,
    pub cost_usd: f64,
    pub repairs: usize,
}

/// Find or create the article row a job writes into.
async fn ensure_article(
    pool: &SqlitePool,
    job_id: i64,
    site_id: i64,
    website_id: Option<i64>,
    keyword: &str,
    now: &str,
) -> Result<i64, sqlx::Error> {
    if let Some(id) = sqlx::query_scalar::<_, i64>("SELECT id FROM articles WHERE job_id = ?")
        .bind(job_id)
        .fetch_optional(pool)
        .await?
    {
        return Ok(id);
    }
    let slug = slugify(keyword);
    sqlx::query_scalar::<_, i64>(
        "INSERT INTO articles (job_id, site_id, website_id, keyword, title, slug, status, created_at) \
         VALUES (?, ?, ?, ?, ?, ?, 'DRAFTING', ?) RETURNING id",
    )
    .bind(job_id)
    .bind(site_id)
    .bind(website_id)
    .bind(keyword)
    .bind(keyword)
    .bind(slug)
    .bind(now)
    .fetch_one(pool)
    .await
}

/// Has this stage already committed for the job's article? A stage that ran to
/// completion before a crash must never be re-run: the model call was already
/// paid for and its output is still in `article_stages`.
pub async fn stage_done(pool: &SqlitePool, job_id: i64, idx: i64) -> Result<bool, sqlx::Error> {
    let n: i64 = sqlx::query_scalar(
        "SELECT COUNT(*) FROM article_stages s \
         JOIN articles a ON a.id = s.article_id \
         WHERE a.job_id = ? AND s.idx = ? AND s.status = 'DONE'",
    )
    .bind(job_id)
    .bind(idx)
    .fetch_one(pool)
    .await?;
    Ok(n > 0)
}

async fn record_stage(
    pool: &SqlitePool,
    article_id: i64,
    website_id: Option<i64>,
    idx: i64,
    key: &str,
    outcome: &StageOutcome,
    engine: &Engine,
    payload: &Value,
    now: &str,
) -> Result<(), sqlx::Error> {
    let mut tx = pool.begin().await?;
    // Upsert, not INSERT: if a previous attempt committed this stage and the
    // worker died before stage_index advanced, re-running must replace the row
    // instead of tripping the UNIQUE(article_id, idx) constraint.
    sqlx::query(
        "INSERT INTO article_stages (article_id, idx, key, status, tokens_in, tokens_out, \
                                    duration_ms, cost_usd, payload_json, started_at, finished_at) \
         VALUES (?, ?, ?, 'DONE', ?, ?, 0, ?, ?, ?, ?) \
         ON CONFLICT(article_id, idx) DO UPDATE SET status = 'DONE', tokens_in = excluded.tokens_in, \
             tokens_out = excluded.tokens_out, cost_usd = excluded.cost_usd, \
             payload_json = excluded.payload_json, finished_at = excluded.finished_at",
    )
    .bind(article_id)
    .bind(idx)
    .bind(key)
    .bind(outcome.tokens_in)
    .bind(outcome.tokens_out)
    .bind(outcome.cost_usd)
    .bind(payload.to_string())
    .bind(now)
    .bind(now)
    .execute(&mut *tx)
    .await?;
    sqlx::query(
        "INSERT INTO usage_ledger (website_id, article_id, stage, provider, model_id, \
                                   tokens_in, tokens_out, cost_usd, at) \
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)",
    )
    .bind(website_id)
    .bind(article_id)
    .bind(key)
    .bind(engine.provider())
    .bind(engine.model_id())
    .bind(outcome.tokens_in)
    .bind(outcome.tokens_out)
    .bind(outcome.cost_usd)
    .bind(now)
    .execute(&mut *tx)
    .await?;
    tx.commit().await
}

fn blueprint_of(payload: &Value) -> Option<Blueprint> {
    serde_json::from_value(payload.get("blueprint")?.clone()).ok()
}

fn blueprint_from_payload(pool_payload: &str) -> Option<Blueprint> {
    let v: Value = serde_json::from_str(pool_payload).ok()?;
    serde_json::from_value(v.get("blueprint")?.clone()).ok()
}

pub async fn run_blueprint(
    pool: &SqlitePool,
    engine: &Engine,
    job_id: i64,
    site_id: i64,
    website_id: Option<i64>,
    keyword: &str,
    site_name: &str,
    now: &str,
) -> Result<StageOutcome, StageError> {
    let article_id = ensure_article(pool, job_id, site_id, website_id, keyword, now).await?;
    let (system, user) = blueprint_prompt(keyword, site_name);
    let (bp, spend, attempts) =
        call_validated(engine, "blueprint", &system, &user, validate_blueprint).await?;
    let outcome = StageOutcome {
        tokens_in: spend.tokens_in,
        tokens_out: spend.tokens_out,
        cost_usd: spend.cost_usd,
        repairs: attempts.saturating_sub(1),
    };
    record_stage(
        pool,
        article_id,
        website_id,
        1,
        "blueprint",
        &outcome,
        engine,
        &json!({"blueprint": bp, "provider": engine.provider(), "model": engine.model_id(),
                "repairs": outcome.repairs}),
        now,
    )
    .await?;
    sqlx::query("UPDATE articles SET title = ? WHERE id = ?")
        .bind(&bp.title_hint)
        .bind(article_id)
        .execute(pool)
        .await?;
    Ok(outcome)
}

pub async fn run_draft(
    pool: &SqlitePool,
    engine: &Engine,
    job_id: i64,
    site_id: i64,
    website_id: Option<i64>,
    keyword: &str,
    now: &str,
) -> Result<StageOutcome, StageError> {
    let article_id = ensure_article(pool, job_id, site_id, website_id, keyword, now).await?;
    let payload: Option<String> = sqlx::query_scalar(
        "SELECT payload_json FROM article_stages WHERE article_id = ? AND idx = 1",
    )
    .bind(article_id)
    .fetch_optional(pool)
    .await?;
    let bp = payload
        .as_deref()
        .and_then(blueprint_from_payload)
        .ok_or_else(|| {
            StageError::Validation(
                "draft".into(),
                vec!["blueprint missing: stage 1 must succeed first".into()],
            )
        })?;

    let (system, user) = draft_prompt(keyword, &bp);
    let (draft, spend, attempts) =
        call_validated(engine, "draft", &system, &user, validate_draft).await?;
    let outcome = StageOutcome {
        tokens_in: spend.tokens_in,
        tokens_out: spend.tokens_out,
        cost_usd: spend.cost_usd,
        repairs: attempts.saturating_sub(1),
    };

    // The writing gate runs on the prose now, so the score is attached to the
    // draft rather than discovered at publish time.
    let prose = format!("{}\n\n{}", draft.intro, draft.body);
    let lint_report = lint::lint(&prose);

    record_stage(
        pool,
        article_id,
        website_id,
        2,
        "draft",
        &outcome,
        engine,
        &json!({
            "draft": draft,
            "lint": lint_report,
            "provider": engine.provider(),
            "model": engine.model_id(),
            "repairs": outcome.repairs
        }),
        now,
    )
    .await?;
    sqlx::query("UPDATE articles SET content_json = ?, content_format = 'markdown' WHERE id = ?")
        .bind(json!({"intro": draft.intro, "body": draft.body, "faq": draft.faq}).to_string())
        .bind(article_id)
        .execute(pool)
        .await?;
    Ok(outcome)
}

/// Load the payload of a committed stage for the job's article.
async fn stage_payload(
    pool: &SqlitePool,
    job_id: i64,
    idx: i64,
) -> Result<Option<Value>, StageError> {
    let row: Option<String> = sqlx::query_scalar(
        "SELECT s.payload_json FROM article_stages s JOIN articles a ON a.id = s.article_id \
         WHERE a.job_id = ? AND s.idx = ? AND s.status = 'DONE'",
    )
    .bind(job_id)
    .bind(idx)
    .fetch_optional(pool)
    .await?;
    Ok(row.and_then(|r| serde_json::from_str(&r).ok()))
}

fn lint_summary(r: &lint::Report) -> String {
    r.findings
        .iter()
        .filter(|f| matches!(f.severity, lint::Severity::High))
        .map(|f| format!("- {} ({}x): {}", f.rule, f.count, f.samples.join(" | ")))
        .collect::<Vec<_>>()
        .join("\n")
}

/// Stage 3 — Quality & Coverage Revision. The coverage contract is checked
/// against the actual prose (not the model's self-report); prose quality is
/// checked by the same linter that gates publishing, with at most two passes.
pub async fn run_revision(
    pool: &SqlitePool,
    engine: &Engine,
    job_id: i64,
    site_id: i64,
    website_id: Option<i64>,
    keyword: &str,
    now: &str,
) -> Result<StageOutcome, StageError> {
    let article_id = ensure_article(pool, job_id, site_id, website_id, keyword, now).await?;
    let bp = stage_payload(pool, job_id, 1)
        .await?
        .and_then(|v| blueprint_of(&v))
        .ok_or_else(|| {
            StageError::Validation(
                "revision".into(),
                vec!["blueprint missing: stage 1 must succeed first".into()],
            )
        })?;
    let draft_payload = stage_payload(pool, job_id, 2).await?.ok_or_else(|| {
        StageError::Validation(
            "revision".into(),
            vec!["draft missing: stage 2 must succeed first".into()],
        )
    })?;
    let draft_json = draft_payload
        .get("draft")
        .map(|v| v.to_string())
        .unwrap_or_else(|| "{}".to_string());
    // Re-derive the draft's lint state from the prose itself: `lint::Finding`
    // borrows &'static str, so the stored JSON is not deserializable — and a
    // stale stored report would be worse than a recomputed one anyway.
    let draft_prose = format!(
        "{}\n\n{}",
        draft_payload["draft"]["intro"].as_str().unwrap_or(""),
        draft_payload["draft"]["body"].as_str().unwrap_or("")
    );
    let lint_before = lint::lint(&draft_prose);

    let mut tokens_in = 0;
    let mut tokens_out = 0;
    let mut cost = 0.0;
    let mut repairs = 0usize;
    let mut passes = 0usize;
    let mut lint_note = lint_summary(&lint_before);

    let (revision, lint_after, coverage, missing) = loop {
        passes += 1;
        let (system, user) = revision_prompt(keyword, &bp, &draft_json, &lint_note);
        let covers = bp.must_cover.clone();
        let (rev, spend, attempts) = call_validated(
            engine,
            "revision",
            &system,
            &user,
            move |v| {
                let r = validate_revision(v)?;
                // A model that skips a mustCover item is rejected here, with the
                // missing items named — that is what makes the repair useful.
                let (score, missing) = coverage_check(&r.body, &covers);
                if score + 1e-9 < MIN_COVERAGE {
                    return Err(vec![format!(
                        "body does not cover the contract (score {score:.2} < {MIN_COVERAGE:.2}); missing: {}",
                        missing.join("; ")
                    )]);
                }
                Ok(r)
            },
        )
        .await?;
        tokens_in += spend.tokens_in;
        tokens_out += spend.tokens_out;
        cost += spend.cost_usd;
        repairs += attempts.saturating_sub(1);

        let prose = format!("{}\n\n{}", rev.intro, rev.body);
        let report = lint::lint(&prose);
        let (score, missing) = coverage_check(&rev.body, &bp.must_cover);
        // Second pass only when the first still trips the publish gate.
        if report.passed || passes >= MAX_REVISION_PASSES {
            break (rev, report, score, missing);
        }
        lint_note = lint_summary(&report);
    };

    let outcome = StageOutcome {
        tokens_in,
        tokens_out,
        cost_usd: cost,
        repairs,
    };
    let quality = revision.quality.clone();
    record_stage(
        pool,
        article_id,
        website_id,
        3,
        "revision",
        &outcome,
        engine,
        &json!({
            "revision": revision,
            "qualityReport": quality,
            "computed": {"coverage": coverage, "missing": missing, "passes": passes},
            "lint_before": lint_before,
            "lint_after": lint_after,
            "provider": engine.provider(),
            "model": engine.model_id(),
            "repairs": outcome.repairs
        }),
        now,
    )
    .await?;
    sqlx::query(
        "UPDATE articles SET content_json = ?, coverage_score = ?, intent_match = ? WHERE id = ?",
    )
    .bind(
        json!({
            "intro": revision.intro, "body": revision.body, "faq": revision.faq,
            "answerBlock": revision.answer_block
        })
        .to_string(),
    )
    .bind(coverage)
    .bind(quality.as_ref().map(|q| q.intent_match))
    .bind(article_id)
    .execute(pool)
    .await?;
    Ok(outcome)
}

/// Stage 4 — Metadata & Packaging. Bounds are theirs: metaDescription 50-300,
/// excerpt 30-400, tags ≤ 8.
pub async fn run_metadata(
    pool: &SqlitePool,
    engine: &Engine,
    job_id: i64,
    site_id: i64,
    website_id: Option<i64>,
    keyword: &str,
    now: &str,
) -> Result<StageOutcome, StageError> {
    let article_id = ensure_article(pool, job_id, site_id, website_id, keyword, now).await?;
    let bp = stage_payload(pool, job_id, 1)
        .await?
        .and_then(|v| blueprint_of(&v))
        .ok_or_else(|| {
            StageError::Validation(
                "metadata".into(),
                vec!["blueprint missing: stage 1 must succeed first".into()],
            )
        })?;
    let prose = stage_payload(pool, job_id, 3)
        .await?
        .and_then(|p| {
            let r = p.get("revision")?;
            Some(format!(
                "{}\n\n{}",
                r.get("intro")?.as_str()?,
                r.get("body")?.as_str()?
            ))
        })
        .ok_or_else(|| {
            StageError::Validation(
                "metadata".into(),
                vec!["revision missing: stage 3 must succeed first".into()],
            )
        })?;

    let (system, user) = metadata_prompt(keyword, &bp, &prose);
    let (meta, spend, attempts) =
        call_validated(engine, "metadata", &system, &user, validate_metadata).await?;
    let outcome = StageOutcome {
        tokens_in: spend.tokens_in,
        tokens_out: spend.tokens_out,
        cost_usd: spend.cost_usd,
        repairs: attempts.saturating_sub(1),
    };
    // Their UI shows a slug per article; deriving it here means packaging never
    // depends on the model getting the slug right.
    let slug = meta
        .slug
        .as_deref()
        .map(slugify)
        .filter(|s| !s.is_empty() && s != "article")
        .unwrap_or_else(|| slugify(meta.title.as_deref().unwrap_or(keyword)));

    record_stage(
        pool,
        article_id,
        website_id,
        4,
        "metadata",
        &outcome,
        engine,
        &json!({
            "metadata": meta,
            "slug": slug,
            "provider": engine.provider(),
            "model": engine.model_id(),
            "repairs": outcome.repairs
        }),
        now,
    )
    .await?;
    sqlx::query(
        "UPDATE articles SET meta_json = ?, title = COALESCE(?, title), slug = ?, \
         status = 'REVIEW_HELD' WHERE id = ?",
    )
    .bind(
        json!({
            "metaDescription": meta.meta_description, "excerpt": meta.excerpt,
            "tags": meta.tags, "slug": slug
        })
        .to_string(),
    )
    .bind(meta.title.clone())
    .bind(&slug)
    .bind(article_id)
    .execute(pool)
    .await?;
    Ok(outcome)
}

#[cfg(test)]
mod tests {
    use super::*;

    fn bp(must: usize, sections: usize) -> Value {
        json!({
            "intent": "informational",
            "titleHint": "T",
            "mustCover": (0..must).map(|i| format!("item {i}")).collect::<Vec<_>>(),
            "sections": (0..sections).map(|i| json!({"heading": format!("H{i}")})).collect::<Vec<_>>()
        })
    }

    fn draft(intro: usize, body: usize, faq: usize) -> Value {
        json!({
            "intro": "a".repeat(intro),
            "body": "b".repeat(body),
            "faq": (0..faq).map(|i| json!({"question": format!("q{i}"), "answer": "a"})).collect::<Vec<_>>(),
            "claims": [{"text": "x", "status": "SUPPORTED"}]
        })
    }

    #[test]
    fn blueprint_bounds_match_the_recovered_contract() {
        assert!(validate_blueprint(&bp(3, 1)).is_ok());
        assert!(validate_blueprint(&bp(10, 12)).is_ok());
        assert!(
            validate_blueprint(&bp(2, 5)).is_err(),
            "mustCover < 3 rejected"
        );
        assert!(
            validate_blueprint(&bp(11, 5)).is_err(),
            "mustCover > 10 rejected"
        );
        assert!(
            validate_blueprint(&bp(5, 0)).is_err(),
            "sections < 1 rejected"
        );
        assert!(
            validate_blueprint(&bp(5, 13)).is_err(),
            "sections > 12 rejected"
        );
    }

    #[test]
    fn draft_bounds_are_rejected_not_clamped() {
        assert!(validate_draft(&draft(100, 200, 0)).is_ok());
        assert!(validate_draft(&draft(4000, 9000, 8)).is_ok());
        assert!(
            validate_draft(&draft(99, 500, 0)).is_err(),
            "intro too short"
        );
        assert!(
            validate_draft(&draft(4001, 500, 0)).is_err(),
            "intro too long"
        );
        assert!(
            validate_draft(&draft(500, 199, 0)).is_err(),
            "body too short"
        );
        assert!(
            validate_draft(&draft(500, 9001, 0)).is_err(),
            "body too long"
        );
        assert!(validate_draft(&draft(500, 500, 9)).is_err(), "faq > 8");
    }

    #[test]
    fn claim_status_vocabulary_is_enforced() {
        let mut d = draft(500, 500, 0);
        d["claims"] = json!([{"text": "x", "status": "MAYBE"}]);
        assert!(validate_draft(&d).is_err());
        for ok in ["SUPPORTED", "UNSUPPORTED", "OPINION"] {
            let mut d = draft(500, 500, 0);
            d["claims"] = json!([{"text": "x", "status": ok}]);
            assert!(validate_draft(&d).is_ok(), "{ok} should pass");
        }
    }

    #[test]
    fn slug_is_readable_and_bounded() {
        assert_eq!(
            slugify("What To Do When A PhD Stipend Stops!"),
            "what-to-do-when-a-phd-stipend-stops"
        );
        assert_eq!(slugify("   "), "article");
        assert!(slugify(&"a ".repeat(200)).len() <= 80);
    }

    #[test]
    fn coverage_is_measured_on_the_prose_not_the_self_report() {
        let covers = vec![
            "emergency grants".to_string(),
            "teaching assistantships".to_string(),
            "department funding bridge".to_string(),
        ];
        // Body mentions one item only -> 1 of 3.
        let (score, missing) =
            coverage_check("Emergency grants exist at the graduate school.", &covers);
        assert!((score - 1.0 / 3.0).abs() < 1e-9, "got {score}");
        assert_eq!(missing.len(), 2);
        // Full body covers everything.
        let (score, missing) = coverage_check(
            "Emergency grants, teaching assistantships and a department funding bridge.",
            &covers,
        );
        assert!((score - 1.0).abs() < 1e-9);
        assert!(missing.is_empty());
        // An empty contract is vacuously covered, never a failure.
        assert_eq!(coverage_check("anything", &[]).0, 1.0);
    }

    #[test]
    fn revision_reuses_the_draft_bounds_and_checks_scores() {
        let mut v = draft(500, 500, 2);
        v["qualityReport"] = json!({"intentMatch": 0.9, "coverage": 1.0, "repetition": 0.1});
        assert!(validate_revision(&v).is_ok());
        // draft bounds still apply
        let mut bad = draft(99, 500, 0);
        bad["qualityReport"] = json!({"intentMatch": 0.9, "coverage": 1.0, "repetition": 0.1});
        assert!(validate_revision(&bad).is_err(), "intro below 100 rejected");
        // a score outside 0..1 is a shape error, not a silently trusted number
        let mut off = draft(500, 500, 0);
        off["qualityReport"] = json!({"intentMatch": 1.4, "coverage": 1.0, "repetition": 0.1});
        assert!(validate_revision(&off).is_err(), "intentMatch 1.4 rejected");
    }

    #[test]
    fn metadata_bounds_match_the_recovered_contract() {
        let ok = json!({
            "title": "When A PhD Stipend Stops",
            "metaDescription": "x".repeat(50),
            "excerpt": "y".repeat(30),
            "tags": ["a", "b"]
        });
        assert!(validate_metadata(&ok).is_ok());
        let long = json!({"metaDescription": "x".repeat(301), "excerpt": "y".repeat(30)});
        assert!(validate_metadata(&long).is_err(), "metaDescription > 300");
        let short = json!({"metaDescription": "x".repeat(49), "excerpt": "y".repeat(30)});
        assert!(validate_metadata(&short).is_err(), "metaDescription < 50");
        let thin = json!({"metaDescription": "x".repeat(60), "excerpt": "y".repeat(29)});
        assert!(validate_metadata(&thin).is_err(), "excerpt < 30");
        let tags = json!({
            "metaDescription": "x".repeat(60), "excerpt": "y".repeat(40),
            "tags": ["1","2","3","4","5","6","7","8","9"]
        });
        assert!(validate_metadata(&tags).is_err(), "tags > 8");
    }

    #[tokio::test]
    async fn mock_engine_answers_every_implemented_schema_validly() {
        let engine = Engine::Mock(crate::provider::MockEngine {
            model_id: "mock-1".into(),
        });
        let bp_json = engine
            .complete(&ChatRequest {
                schema: "blueprint".into(),
                system: "s".into(),
                user: "u".into(),
                json: true,
            })
            .await
            .unwrap();
        let bp: Blueprint = serde_json::from_str(&bp_json.text).unwrap();
        assert!(!bp.must_cover.is_empty());

        for schema in ["draft", "revision", "metadata"] {
            let c = engine
                .complete(&ChatRequest {
                    schema: schema.into(),
                    system: "s".into(),
                    user: "u".into(),
                    json: true,
                })
                .await
                .unwrap();
            let v: Value = serde_json::from_str(&c.text).unwrap();
            match schema {
                "draft" => assert!(validate_draft(&v).is_ok(), "mock draft invalid"),
                "revision" => {
                    assert!(validate_revision(&v).is_ok(), "mock revision invalid");
                    let (score, missing) =
                        coverage_check(v["body"].as_str().unwrap(), &bp.must_cover);
                    assert!(score >= MIN_COVERAGE, "mock revision misses {missing:?}");
                }
                _ => assert!(validate_metadata(&v).is_ok(), "mock metadata invalid"),
            }
        }
    }

    #[tokio::test]
    async fn a_rejected_answer_is_still_charged() {
        use std::cell::Cell;
        let engine = Engine::Mock(crate::provider::MockEngine {
            model_id: "mock-1".into(),
        });
        // One clean call, for the baseline spend.
        let (_, once, _) = call_validated(&engine, "blueprint", "s", "u", |_v| Ok(()))
            .await
            .unwrap();
        // One rejected call plus the accepted repair: both were billed.
        let calls = Cell::new(0);
        let (_, twice, attempts) = call_validated(&engine, "blueprint", "s", "u", |_v| {
            calls.set(calls.get() + 1);
            if calls.get() == 1 {
                Err(vec!["nope".to_string()])
            } else {
                Ok(())
            }
        })
        .await
        .unwrap();
        assert_eq!(attempts, 2);
        // Identical answers, so output tokens must be exactly doubled: the
        // rejected call was billed. (Input tokens grow with the repair prompt.)
        assert_eq!(
            twice.tokens_out,
            once.tokens_out * 2,
            "the rejected call was not charged"
        );
        assert!(
            twice.tokens_in > once.tokens_in,
            "input usage not accumulated"
        );
    }

    #[tokio::test]
    async fn validator_rejection_triggers_one_repair_then_succeeds() {
        use std::cell::Cell;
        let calls = Cell::new(0);
        let engine = Engine::Mock(crate::provider::MockEngine {
            model_id: "mock-1".into(),
        });
        // Rejects the first answer, accepts the second — exactly what happens
        // when a real model gets told what it got wrong.
        let out = call_validated(&engine, "blueprint", "s", "u", |_v| {
            calls.set(calls.get() + 1);
            if calls.get() == 1 {
                Err(vec!["mustCover must have 3-10 items (got 1)".into()])
            } else {
                Ok(())
            }
        })
        .await;
        assert!(out.is_ok(), "second answer accepted");
        assert_eq!(calls.get(), 2, "exactly one repair call");
        assert_eq!(out.unwrap().2, 2, "attempts reported to the caller");
    }

    #[tokio::test]
    async fn repair_is_bounded_and_then_the_stage_fails() {
        let engine = Engine::Mock(crate::provider::MockEngine {
            model_id: "mock-1".into(),
        });
        let err = call_validated(&engine, "draft", "s", "u", |_v| {
            Err::<(), _>(vec!["body must be 200-9000 chars (got 42)".into()])
        })
        .await
        .unwrap_err();
        match err {
            StageError::Validation(schema, errs) => {
                assert_eq!(schema, "draft");
                assert!(errs[0].contains("body must be"));
            }
            other => panic!("expected a validation failure, got {other}"),
        }
    }
}
