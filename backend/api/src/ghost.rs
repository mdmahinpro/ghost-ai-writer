//! The Ghost Admin API push — the one network hop a stage-6 publish makes.
//! Everything downstream of the release gate in the TS engine is a local data
//! change; the *only* remote call is `POST /ghost/api/admin/posts/`, so this
//! module is the single place that can fail on I/O and the single place it is
//! mocked in tests (`GAW_GHOST_BASE` overrides the URL, exactly like
//! `GAW_BING_BASE`).

use serde_json::{json, Value};
use std::sync::OnceLock;

#[derive(Debug, Clone)]
pub struct PushResult {
    pub ghost_post_id: String,
    pub url: String,
}

pub fn client() -> &'static reqwest::Client {
    static CLIENT: OnceLock<reqwest::Client> = OnceLock::new();
    CLIENT.get_or_init(|| {
        reqwest::Client::builder()
            .timeout(std::time::Duration::from_secs(25))
            .build()
            .expect("ghost http client")
    })
}

fn base(ghost_url: &str) -> String {
    let base = std::env::var("GAW_GHOST_BASE").unwrap_or_else(|_| ghost_url.trim_end_matches('/').to_string());
    format!("{base}/ghost/api/admin")
}

#[derive(Debug)]
pub enum PushError {
    Http(reqwest::Error),
    /// Ghost answered with valid JSON-less / invalid JSON: create unverified.
    Parse(serde_json::Error),
    /// A wired Ghost answered with a non-2xx: the article was not created.
    Rejected { status: u16, body: String },
    /// No usable Ghost URL/key — the article stays REVIEW_HELD for manual
    /// publish. This is *not* a failure: SANDBOX websites publish by hand.
    Unconfigured,
}

impl std::fmt::Display for PushError {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            PushError::Http(e) => write!(f, "ghost http: {e}"),
            PushError::Parse(e) => write!(f, "ghost response was not JSON: {e}"),
            PushError::Rejected { status, body } => {
                write!(f, "ghost rejected the post (HTTP {status}): {body}")
            }
            PushError::Unconfigured => write!(f, "no ghost url/key configured"),
        }
    }
}

/// Push a passing article to Ghost. `status` is `"draft"` for SANDBOX-mode
/// sites (created but unpublished) and `"published"` for LIVE. The returned
/// Ghost `post.id` is stored on the article so a re-run never double-publishes.
pub async fn push_post(
    ghost_url: Option<&str>,
    admin_key: Option<&str>,
    title: &str,
    slug: &str,
    source_markdown: &str,
    feature_image: Option<&str>,
    status: &str,
) -> Result<PushResult, PushError> {
    let (url, key) = match (ghost_url, admin_key) {
        (Some(u), Some(k)) if !u.trim().is_empty() && !k.trim().is_empty() => (u, k),
        _ => return Err(PushError::Unconfigured),
    };
    let mut body = json!({
        "title": title,
        "slug": slug,
        "source_markdown": source_markdown,
        "status": status,
    });
    if let Some(img) = feature_image {
        if !img.is_empty() {
            body["feature_image"] = json!(img);
        }
    }
    let resp = client()
        .post(format!("{}/posts", base(url)))
        .header("Authorization", format!("Bearer {key}"))
        .header("Content-Type", "application/json")
        .json(&body)
        .send()
        .await
        .map_err(PushError::Http)?;
    let code = resp.status().as_u16();
    let text = resp.text().await.map_err(PushError::Http)?;
    if !(200..300).contains(&code) {
        return Err(PushError::Rejected { status: code, body: text });
    }
    let v: Value = serde_json::from_str(&text).map_err(PushError::Parse)?;
    let id = v.get("post")
        .and_then(|p| p.get("id"))
        .and_then(Value::as_str)
        .ok_or_else(|| PushError::Rejected {
            status: code,
            body: "ghost response had no post.id".to_string(),
        })?
        .to_string();
    let url = v.get("post")
        .and_then(|p| p.get("url"))
        .and_then(Value::as_str)
        .unwrap_or_default()
        .to_string();
    Ok(PushResult { ghost_post_id: id, url })
}
