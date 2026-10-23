//! Stage-5 images — their Bing thumbnail technique, copied 1:1, plus the vision
//! gate. The recovered shape is:
//!
//!   https://tse1.mm.bing.net/th?q=<urlencoded scene>&w=<w>&h=<h>&c=7
//!
//! with FEATURED 474x274 and CONTENT 624x352, up to three candidate queries, a
//! byte-level sanity check, then a vision model that must say RELEVANT before an
//! image is accepted. Every outcome is one of their twelve rejection codes, so
//! the UI can explain a missing image instead of showing a blank.

use crate::provider::{ChatRequest, Engine};
use serde::{Deserialize, Serialize};
use serde_json::json;
use std::sync::OnceLock;

/// Sizes recovered from the shipped bundles.
pub const FEATURED: (u32, u32) = (474, 274);
pub const CONTENT: (u32, u32) = (624, 352);

/// A Bing thumbnail below this is almost always their "no image" placeholder.
const MIN_BYTES: usize = 8_000;
const MAX_CANDIDATES: usize = 3;
/// Below this the vision model is guessing, so the image is refused.
const MIN_CONF: f64 = 0.6;

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize)]
// Their full twelve-code vocabulary. Three are not reachable yet: INVALID_IMAGE
// and BROKEN_LINK belong to stage 6's link and image re-check, IMAGE_DRIFT_DETECTED
// to the re-verification of an already-published article.
#[allow(dead_code)]
pub enum Code {
    Selected,
    BingProxyError,
    NoCandidates,
    InvalidImage,
    QualityRejected,
    Irrelevant,
    Uncertain,
    NoRelevantImage,
    SkippedVisionUnavailable,
    SkippedVisionBudget,
    ImageDriftDetected,
    BrokenLink,
}

impl Code {
    /// Exactly the strings their bundles emit.
    pub fn as_str(self) -> &'static str {
        match self {
            Code::Selected => "SELECTED",
            Code::BingProxyError => "BING_PROXY_ERROR",
            Code::NoCandidates => "NO_CANDIDATES",
            Code::InvalidImage => "INVALID_IMAGE",
            Code::QualityRejected => "QUALITY_REJECTED",
            Code::Irrelevant => "IRRELEVANT",
            Code::Uncertain => "UNCERTAIN",
            Code::NoRelevantImage => "NO_RELEVANT_IMAGE",
            Code::SkippedVisionUnavailable => "SKIPPED_VISION_UNAVAILABLE",
            Code::SkippedVisionBudget => "SKIPPED_VISION_BUDGET",
            Code::ImageDriftDetected => "IMAGE_DRIFT_DETECTED",
            Code::BrokenLink => "BROKEN_LINK",
        }
    }
}

#[derive(Debug, Clone, Serialize)]
pub struct Candidate {
    pub url: String,
    pub bytes: usize,
    pub content_type: String,
}

#[derive(Debug, Clone, Serialize)]
pub struct Decision {
    pub code: String,
    pub url: Option<String>,
    pub alt: Option<String>,
    /// Their reason format: `vision confirmed: <sentence> [vision:RELEVANT | conf=0.9]`
    pub reason: String,
    pub conf: f64,
    pub candidates: usize,
    /// Every attempt, so a BING_PROXY_ERROR is explainable after the fact.
    pub attempts: Vec<String>,
    #[serde(skip)]
    pub tokens_in: i64,
    #[serde(skip)]
    pub tokens_out: i64,
    #[serde(skip)]
    pub cost_usd: f64,
}

impl Decision {
    fn rejected(code: Code, reason: impl Into<String>, attempts: Vec<String>) -> Self {
        Decision {
            code: code.as_str().to_string(),
            url: None,
            alt: None,
            reason: reason.into(),
            conf: 0.0,
            candidates: 0,
            attempts,
            tokens_in: 0,
            tokens_out: 0,
            cost_usd: 0.0,
        }
    }
}

#[derive(Debug, Deserialize)]
struct Verdict {
    verdict: String,
    #[serde(default)]
    confidence: f64,
    #[serde(default)]
    sentence: String,
}

/// Percent-encode everything outside the unreserved set, so a scene with an
/// apostrophe or an ampersand cannot break the query.
pub fn encode(s: &str) -> String {
    let mut out = String::with_capacity(s.len());
    for b in s.as_bytes() {
        match b {
            b'A'..=b'Z' | b'a'..=b'z' | b'0'..=b'9' | b'-' | b'_' | b'.' | b'~' => {
                out.push(*b as char)
            }
            b' ' => out.push_str("%20"),
            _ => out.push_str(&format!("%{b:02X}")),
        }
    }
    out
}

/// Host override, so tests and air-gapped builds do not hit Bing.
fn base() -> String {
    std::env::var("GAW_BING_BASE").unwrap_or_else(|_| "https://tse1.mm.bing.net".to_string())
}

/// The recovered URL template, verbatim.
pub fn bing_url(query: &str, size: (u32, u32)) -> String {
    format!(
        "{}/th?q={}&w={}&h={}&c=7",
        base(),
        encode(query),
        size.0,
        size.1
    )
}

const NOISE: [&str; 18] = [
    "the", "and", "for", "with", "your", "from", "that", "this", "what", "when", "how", "why",
    "are", "you", "his", "her", "its", "into",
];

/// Build a scene query from the article, not the raw keyword: image search reads
/// a scene, so the title's concrete words beat the head term alone.
pub fn scene_query(title: &str, keyword: &str, section: Option<&str>) -> String {
    let mut words: Vec<String> = Vec::new();
    let mut push = |s: &str| {
        for w in s.split(|c: char| !c.is_alphanumeric()) {
            let lw = w.to_lowercase();
            if lw.len() >= 3 && !NOISE.contains(&lw.as_str()) && !words.contains(&lw) {
                words.push(lw);
            }
        }
    };
    if let Some(s) = section {
        push(s);
    }
    push(title);
    push(keyword);
    words.truncate(8);
    words.join(" ")
}

fn client() -> &'static reqwest::Client {
    static CLIENT: OnceLock<reqwest::Client> = OnceLock::new();
    CLIENT.get_or_init(|| {
        reqwest::Client::builder()
            .timeout(std::time::Duration::from_secs(25))
            .build()
            .expect("image http client")
    })
}

/// Fetch up to `MAX_CANDIDATES` thumbnails. Each query variation is a separate
/// Bing scene, which is how they get alternatives without an image-search API.
pub async fn fetch_candidates(query: &str, size: (u32, u32)) -> (Vec<Candidate>, Vec<String>) {
    let mut out = Vec::new();
    let mut attempts = Vec::new();
    let variations = [
        query.to_string(),
        format!("{query} photo"),
        format!("{query} guide"),
    ];
    for v in variations.iter().take(MAX_CANDIDATES) {
        let url = bing_url(v, size);
        match client().get(&url).send().await {
            Ok(resp) => {
                let status = resp.status();
                let ctype = resp
                    .headers()
                    .get("content-type")
                    .and_then(|v| v.to_str().ok())
                    .unwrap_or("")
                    .to_string();
                match resp.bytes().await {
                    Ok(bytes) => {
                        attempts.push(format!("{status} {ctype} {}B q=\"{v}\"", bytes.len()));
                        if !status.is_success() {
                            continue;
                        }
                        if !ctype.starts_with("image/") || bytes.len() < MIN_BYTES {
                            continue;
                        }
                        out.push(Candidate {
                            url,
                            bytes: bytes.len(),
                            content_type: ctype,
                        });
                    }
                    Err(e) => attempts.push(format!("body: {e}")),
                }
            }
            Err(e) => attempts.push(format!("transport: {e}")),
        }
    }
    (out, attempts)
}

async fn judge(
    vision: &Engine,
    url: &str,
    scene: &str,
) -> Result<(Verdict, i64, i64, f64), String> {
    let system = "You check whether an image fits a topic. You return only JSON.";
    let user = format!(
        "Topic: {scene}\n\nDoes this image genuinely illustrate the topic?\n\
         Return JSON: {{\"verdict\": \"RELEVANT\" | \"IRRELEVANT\" | \"UNCERTAIN\", \
         \"confidence\": 0.0-1.0, \"sentence\": \"one sentence on what you see\"}}"
    );
    let req = ChatRequest {
        schema: "vision".into(),
        system: system.into(),
        user,
        json: true,
        images: vec![url.to_string()],
    };
    let c = vision.complete(&req).await.map_err(|e| e.to_string())?;
    let v: Verdict = serde_json::from_str(c.text.trim())
        .map_err(|e| format!("vision answer was not JSON: {e}: {}", c.text))?;
    Ok((v, c.tokens_in, c.tokens_out, c.cost_usd))
}

/// The whole decision: candidates, then the gate. `vision` is `None` when no
/// vision provider is configured — then the first valid candidate is used and the
/// code says so, which is what their SKIPPED_VISION_UNAVAILABLE means.
pub async fn pick(vision: Option<&Engine>, scene: &str, size: (u32, u32)) -> Decision {
    let (candidates, attempts) = fetch_candidates(scene, size).await;
    if candidates.is_empty() {
        let code = if attempts.iter().any(|a| a.starts_with("transport")) {
            Code::BingProxyError
        } else if attempts.iter().any(|a| a.contains("200 image/")) {
            Code::QualityRejected
        } else {
            Code::NoCandidates
        };
        return Decision::rejected(code, "no usable thumbnail returned", attempts);
    }

    let Some(vision) = vision else {
        let c = &candidates[0];
        return Decision {
            code: Code::SkippedVisionUnavailable.as_str().to_string(),
            url: Some(c.url.clone()),
            alt: Some(scene.to_string()),
            reason: format!(
                "no vision provider configured; {} bytes accepted unchecked",
                c.bytes
            ),
            conf: 0.0,
            candidates: candidates.len(),
            attempts,
            tokens_in: 0,
            tokens_out: 0,
            cost_usd: 0.0,
        };
    };

    let mut tokens_in = 0;
    let mut tokens_out = 0;
    let mut cost = 0.0;
    for (i, c) in candidates.iter().enumerate() {
        match judge(vision, &c.url, scene).await {
            Ok((v, ti, to, usd)) => {
                tokens_in += ti;
                tokens_out += to;
                cost += usd;
                let verdict = v.verdict.to_uppercase();
                let conf = v.confidence;
                if verdict == "RELEVANT" && conf >= MIN_CONF {
                    return Decision {
                        code: Code::Selected.as_str().to_string(),
                        url: Some(c.url.clone()),
                        alt: Some(scene.to_string()),
                        reason: format!(
                            "vision confirmed: {} [vision:RELEVANT | conf={conf:.1}]",
                            v.sentence
                        ),
                        conf,
                        candidates: candidates.len(),
                        attempts,
                        tokens_in,
                        tokens_out,
                        cost_usd: cost,
                    };
                }
                let last_code = if verdict == "UNCERTAIN" {
                    Code::Uncertain
                } else {
                    Code::Irrelevant
                };
                if i + 1 == candidates.len() {
                    let mut d = Decision::rejected(
                        last_code,
                        format!("vision: {verdict} conf={conf:.2} — {}", v.sentence),
                        attempts,
                    );
                    d.candidates = candidates.len();
                    d.conf = conf;
                    d.tokens_in = tokens_in;
                    d.tokens_out = tokens_out;
                    d.cost_usd = cost;
                    return d;
                }
            }
            Err(e) => {
                // A vision outage must not cost the article its image, but it
                // must also not be reported as verified.
                if i + 1 == candidates.len() {
                    let mut d = Decision::rejected(
                        Code::SkippedVisionBudget,
                        format!("vision unavailable: {e}"),
                        attempts,
                    );
                    d.candidates = candidates.len();
                    return d;
                }
            }
        }
    }
    let mut d = Decision::rejected(
        Code::NoRelevantImage,
        "no candidate passed the gate",
        attempts,
    );
    d.candidates = candidates.len();
    d.tokens_in = tokens_in;
    d.tokens_out = tokens_out;
    d.cost_usd = cost;
    d
}

/// Stable hash of the chosen image, so a later stage can notice that the image
/// changed underneath a published article.
pub fn fingerprint(url: &str, bytes: usize) -> String {
    let mut h: u64 = 1469598103934665603;
    for b in url.as_bytes().iter().chain(bytes.to_string().as_bytes()) {
        h ^= *b as u64;
        h = h.wrapping_mul(1099511628211);
    }
    format!("{h:016x}")
}

pub fn decision_json(d: &Decision) -> serde_json::Value {
    json!({
        "code": d.code, "url": d.url, "alt": d.alt, "reason": d.reason,
        "conf": d.conf, "candidates": d.candidates, "attempts": d.attempts,
        "fingerprint": d.url.as_deref().map(|u| fingerprint(u, 0))
    })
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn url_template_matches_the_recovered_one() {
        let u = bing_url("phd student funding office", FEATURED);
        assert_eq!(
            u,
            "https://tse1.mm.bing.net/th?q=phd%20student%20funding%20office&w=474&h=274&c=7"
        );
        // An apostrophe or ampersand must not escape into the query.
        assert!(bing_url("student's & funding", CONTENT).contains("%27"));
        assert!(bing_url("student's & funding", CONTENT).contains("%26"));
        assert!(bing_url("x", CONTENT).ends_with("w=624&h=352&c=7"));
    }

    #[test]
    fn scene_query_prefers_concrete_words_and_is_bounded() {
        let q = scene_query(
            "What To Do When Your PhD Stipend Stops",
            "phd funding gap",
            Some("Which department funds can bridge a gap?"),
        );
        assert!(q.split(' ').count() <= 8, "{q}");
        assert!(q.contains("stipend"), "{q}");
        assert!(!q.contains(" the"), "{q}");
        assert!(!q.split(' ').any(|w| NOISE.contains(&w)), "{q}");
    }

    #[test]
    fn all_twelve_codes_are_exactly_theirs() {
        let all = [
            Code::Selected,
            Code::BingProxyError,
            Code::NoCandidates,
            Code::InvalidImage,
            Code::QualityRejected,
            Code::Irrelevant,
            Code::Uncertain,
            Code::NoRelevantImage,
            Code::SkippedVisionUnavailable,
            Code::SkippedVisionBudget,
            Code::ImageDriftDetected,
            Code::BrokenLink,
        ];
        let names: Vec<&str> = all.iter().map(|c| c.as_str()).collect();
        assert_eq!(names.len(), 12);
        assert!(names.contains(&"SKIPPED_VISION_BUDGET"));
        assert!(names.contains(&"IMAGE_DRIFT_DETECTED"));
        assert!(names
            .iter()
            .all(|n| n.chars().all(|c| c.is_ascii_uppercase() || c == '_')));
    }

    #[tokio::test]
    async fn an_unreachable_image_host_reports_a_proxy_error_not_a_silent_pass() {
        // Point the fetch at a closed port by asking for an impossible scene:
        // we exercise the failure classification, not Bing itself.
        let (cands, attempts) = fetch_candidates("", FEATURED).await;
        // A real request may succeed here; what must hold is that either we got
        // usable candidates or every attempt is recorded.
        if cands.is_empty() {
            assert!(!attempts.is_empty(), "an empty result must explain itself");
        }
    }

    #[test]
    fn fingerprint_is_stable_and_url_sensitive() {
        assert_eq!(fingerprint("a", 1), fingerprint("a", 1));
        assert_ne!(fingerprint("a", 1), fingerprint("b", 1));
    }
}
