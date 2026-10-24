//! Ghost Admin API reads: connection test, post sync, and public URL probes.
//!
//! These were Node server functions that signed an HS256 Admin JWT with `jose`
//! and called Ghost from the page's origin. The signing key is the site's Admin
//! API key, which arrives with each request — it is never stored here.
//!
//! Publishing stays in [`crate::ghost::push_post`], which the pipeline already
//! uses, so there is one definition of a Ghost payload rather than two.

use std::time::{SystemTime, UNIX_EPOCH};

use base64::engine::general_purpose::URL_SAFE_NO_PAD;
use base64::Engine as _;
use ring::hmac;
use serde::Deserialize;
use serde_json::{json, Value};

use crate::ghost;

/// Ghost caps a page at 100 posts; a corpus beyond 30 pages is not a corpus.
pub const PAGE_LIMIT: u32 = 100;
pub const MAX_PAGES: u32 = 30;

fn now_secs() -> u64 {
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|d| d.as_secs())
        .unwrap_or(0)
}

fn hex_bytes(hex: &str) -> Option<Vec<u8>> {
    if hex.len() % 2 != 0 {
        return None;
    }
    let mut out = Vec::with_capacity(hex.len() / 2);
    let bytes = hex.as_bytes();
    for pair in bytes.chunks(2) {
        let hi = (pair[0] as char).to_digit(16)?;
        let lo = (pair[1] as char).to_digit(16)?;
        out.push((hi * 16 + lo) as u8);
    }
    Some(out)
}

/// Sign the Admin API JWT: HS256, `kid` = key id, audience `/admin/`, 5 minutes.
///
/// Ghost rejects a token whose `exp` is more than five minutes out, so the
/// window is deliberately short.
pub fn admin_token(admin_key: &str, issued_at: u64) -> Option<String> {
    let (id, secret) = admin_key.trim().split_once(':')?;
    if !ghost::valid_admin_key(admin_key) {
        return None;
    }
    let secret = hex_bytes(secret)?;
    let header = json!({ "alg": "HS256", "kid": id, "typ": "JWT" });
    let payload = json!({
        "iat": issued_at,
        "exp": issued_at + 300,
        "aud": "/admin/",
    });
    let enc = |v: &Value| -> String {
        URL_SAFE_NO_PAD.encode(serde_json::to_vec(v).unwrap_or_default())
    };
    let signing_input = format!("{}.{}", enc(&header), enc(&payload));
    let key = hmac::Key::new(hmac::HMAC_SHA256, &secret);
    let signature = hmac::sign(&key, signing_input.as_bytes());
    Some(format!(
        "{signing_input}.{}",
        URL_SAFE_NO_PAD.encode(signature.as_ref())
    ))
}

#[derive(Debug, Deserialize)]
pub struct GhostTarget {
    #[serde(default)]
    pub url: String,
    #[serde(default)]
    pub admin_key: String,
}

fn client() -> &'static reqwest::Client {
    ghost::client()
}

/// Call the Admin API. Redirects are refused: a redirect means the URL is not
/// the canonical origin, and the token must not be replayed to a new host.
async fn admin_get(origin: &str, path: &str, token: &str) -> Result<(u16, String), String> {
    let resp = client()
        .get(format!("{origin}{path}"))
        .header("Authorization", format!("Bearer {token}"))
        .header("Accept", "application/json")
        .send()
        .await
        .map_err(|e| ghost::safe_message(&e.to_string()))?;
    let status = resp.status();
    if status.is_redirection() {
        return Err("Redirects are blocked. Use the canonical https origin.".to_string());
    }
    let body = resp.text().await.unwrap_or_default();
    Ok((status.as_u16(), body))
}

fn resolve(target: &GhostTarget) -> Result<(String, String), String> {
    let origin = ghost::validate_ghost_url(&target.url)?;
    let token = admin_token(&target.admin_key, now_secs())
        .ok_or_else(|| "Admin API key must look like id:secret, hex only.".to_string())?;
    Ok((origin, token))
}

/// Prove the key works.
///
/// This deliberately hits `posts/?limit=1` rather than `site/`: some sites serve
/// `site/` to anonymous callers, so a wrong key would report itself as a working
/// connection. `posts` is behind the Admin API key, which is the thing being
/// tested. The version is a bonus from `site/` afterwards.
pub async fn test_connection(target: &GhostTarget) -> Value {
    let (origin, token) = match resolve(target) {
        Ok(pair) => pair,
        Err(error) => return json!({ "ok": false, "error": error }),
    };
    match admin_get(&origin, "/ghost/api/admin/posts/?limit=1&fields=id", &token).await {
        Ok((status, _)) => {
            if status == 401 || status == 403 {
                return json!({ "ok": false, "error": "Ghost refused the Admin API key." });
            }
            if !(200..300).contains(&status) {
                return json!({ "ok": false, "error": format!("Ghost returned HTTP {status}.") });
            }
        }
        Err(error) => return json!({ "ok": false, "error": error }),
    }
    let version = match admin_get(&origin, "/ghost/api/admin/site/", &token).await {
        Ok((status, body)) if (200..300).contains(&status) => {
            let parsed: Value = serde_json::from_str(&body).unwrap_or(Value::Null);
            parsed
                .get("site")
                .and_then(|s| s.get("version"))
                .and_then(|v| v.as_str())
                .filter(|v| !v.is_empty())
                .unwrap_or("unknown")
                .to_string()
        }
        _ => "unknown".to_string(),
    };
    json!({ "ok": true, "version": version, "origin": origin })
}

/// Walk every page of posts so the corpus the writer avoids is complete.
pub async fn sync_posts(target: &GhostTarget) -> Value {
    let (origin, token) = match resolve(target) {
        Ok(pair) => pair,
        Err(error) => return json!({ "ok": false, "error": error }),
    };
    let mut posts: Vec<Value> = Vec::new();
    let mut page = 1u32;
    let mut reported;
    loop {
        let path = format!(
            "/ghost/api/admin/posts/?limit={PAGE_LIMIT}&page={page}&formats=plaintext&fields=id,title,slug,status"
        );
        let (status, body) = match admin_get(&origin, &path, &token).await {
            Ok(result) => result,
            Err(error) => return json!({ "ok": false, "error": error }),
        };
        if status == 401 || status == 403 {
            return json!({ "ok": false, "error": "Ghost refused the Admin API key." });
        }
        if !(200..300).contains(&status) {
            return json!({ "ok": false, "error": format!("Ghost returned HTTP {status}.") });
        }
        let parsed: Value = match serde_json::from_str(&body) {
            Ok(value) => value,
            Err(_) => return json!({ "ok": false, "error": "Ghost returned a non-JSON body." }),
        };
        for post in parsed
            .get("posts")
            .and_then(|p| p.as_array())
            .map(|a| a.as_slice())
            .unwrap_or(&[])
        {
            let id = post.get("id").and_then(|v| v.as_str()).unwrap_or("");
            let slug = post.get("slug").and_then(|v| v.as_str()).unwrap_or("");
            if id.is_empty() || slug.is_empty() {
                continue;
            }
            let title: String = post
                .get("title")
                .and_then(|v| v.as_str())
                .unwrap_or("Untitled")
                .chars()
                .take(300)
                .collect();
            let state = if post.get("status").and_then(|v| v.as_str()) == Some("published") {
                "PUBLISHED"
            } else {
                "DRAFT"
            };
            posts.push(json!({ "id": id, "title": title, "slug": slug, "status": state }));
        }
        reported = parsed
            .get("meta")
            .and_then(|m| m.get("pagination"))
            .and_then(|p| p.get("pages"))
            .and_then(|v| v.as_u64())
            .map(|n| n.max(1) as u32)
            .unwrap_or(1);
        page += 1;
        if page > reported || page > MAX_PAGES {
            break;
        }
    }
    json!({
        "ok": true,
        "posts": posts,
        "pages": reported,
        "truncated": reported > MAX_PAGES,
    })
}

/// A public URL must be https and must not resolve to a private host.
pub fn validate_public_url(raw: &str) -> Result<String, String> {
    let trimmed = raw.trim();
    let rest = trimmed
        .strip_prefix("https://")
        .ok_or_else(|| "Public URL must be a full https address.".to_string())?;
    let host_port = rest
        .split(['/', '?', '#'])
        .next()
        .unwrap_or("")
        .rsplit('@')
        .next()
        .unwrap_or("");
    let host = if let Some(stripped) = host_port.strip_prefix('[') {
        stripped
            .split(']')
            .next()
            .unwrap_or("")
            .to_string()
    } else {
        host_port.split(':').next().unwrap_or("").to_string()
    };
    if host.is_empty() {
        return Err("Public URL must be a full https address.".to_string());
    }
    if ghost::is_private_host(&host) {
        return Err("That host resolves to a private address. Blocked.".to_string());
    }
    Ok(trimmed.trim_end_matches('/').to_string())
}

/// Fetch the public URL. A 2xx means the post is live; a redirect is refused
/// rather than followed, because a redirect is not evidence the URL is right.
pub async fn probe(url: &str) -> Value {
    let checked = match validate_public_url(url) {
        Ok(url) => url,
        Err(error) => return json!({ "ok": false, "error": error }),
    };
    match client().get(&checked).send().await {
        Ok(resp) => {
            let status = resp.status();
            if status.is_redirection() {
                return json!({
                    "ok": false,
                    "error": format!("Probe blocked a redirect ({}).", status.as_u16()),
                });
            }
            if status.is_success() {
                return json!({
                    "ok": true,
                    "detail": format!("Live probe {} · {checked}", status.as_u16()),
                });
            }
            json!({
                "ok": false,
                "error": format!("Live probe HTTP {} · {checked}", status.as_u16()),
            })
        }
        Err(error) => json!({ "ok": false, "error": ghost::safe_message(&error.to_string()) }),
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    const KEY: &str = "0123abcd0123abcd0123abcd0123abcd:0123456789abcdef0123456789abcdef";

    fn parts(token: &str) -> Vec<&str> {
        token.split('.').collect()
    }

    fn decode(part: &str) -> Value {
        let bytes = URL_SAFE_NO_PAD.decode(part).expect("base64url");
        serde_json::from_slice(&bytes).expect("json")
    }

    #[test]
    fn the_token_carries_the_key_id_audience_and_a_short_expiry() {
        let token = admin_token(KEY, 1_700_000_000).expect("token");
        let p = parts(&token);
        assert_eq!(p.len(), 3, "a JWT is three parts");
        let header = decode(p[0]);
        assert_eq!(header["alg"], "HS256");
        assert_eq!(header["kid"], "0123abcd0123abcd0123abcd0123abcd");
        let payload = decode(p[1]);
        assert_eq!(payload["aud"], "/admin/");
        assert_eq!(payload["iat"], 1_700_000_000u64);
        assert_eq!(payload["exp"], 1_700_000_300u64, "Ghost caps the window at 5 minutes");
    }

    #[test]
    fn the_signature_is_hmac_sha256_over_the_first_two_parts() {
        let token = admin_token(KEY, 1_700_000_000).expect("token");
        let p = parts(&token);
        let secret = hex_bytes("0123456789abcdef0123456789abcdef").unwrap();
        let key = hmac::Key::new(hmac::HMAC_SHA256, &secret);
        let expected = URL_SAFE_NO_PAD.encode(
            hmac::sign(&key, format!("{}.{}", p[0], p[1]).as_bytes()).as_ref(),
        );
        assert_eq!(p[2], expected);
    }

    #[test]
    fn a_key_that_is_not_hex_id_colon_secret_is_refused() {
        assert!(admin_token("not-a-key", 0).is_none());
        assert!(admin_token("abc:def", 0).is_none(), "secret must be long hex");
        assert!(admin_token(
            "0123abcd0123abcd0123abcd0123abcd:zzzz",
            0
        )
        .is_none());
    }

    #[test]
    fn a_probe_url_must_be_public_https() {
        assert!(validate_public_url("http://example.com/x").is_err());
        assert!(validate_public_url("https://localhost/x").is_err());
        assert!(validate_public_url("https://127.0.0.1/x").is_err());
        assert_eq!(
            validate_public_url("https://blog.example.com/post/").unwrap(),
            "https://blog.example.com/post"
        );
    }
}
