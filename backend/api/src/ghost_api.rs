//! Ghost Admin API reads: connection test, post sync, and public URL probes.
//!
//! These were Node server functions that signed an HS256 Admin JWT with `jose`
//! and called Ghost from the page's origin. The signing key is the site's Admin
//! API key, which arrives with each request — it is never stored here.
//!
//! The pipeline keeps its own narrow publisher in [`crate::ghost::push_post`];
//! this module owns the studio's richer path — images uploaded into Ghost, tags,
//! authors, and the PUT-only re-weave with its optimistic lock.

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
    if !hex.len().is_multiple_of(2) {
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
    let enc =
        |v: &Value| -> String { URL_SAFE_NO_PAD.encode(serde_json::to_vec(v).unwrap_or_default()) };
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
    /// Accept a certificate the OS does not trust (a hosting panel's default
    /// cert on a CMS subdomain is the common case). Off unless the operator
    /// ticks it, and the connection is reported as unverified when it is on.
    #[serde(default)]
    pub trust_cert: bool,
    #[serde(default)]
    pub url: String,
    #[serde(default)]
    pub admin_key: String,
    /// The browser site this connection belongs to. Without it a verified key
    /// was written to the *first* site in the workspace, so connecting a second
    /// site silently overwrote the first one's Ghost.
    #[serde(default)]
    pub site_ref: String,
}

fn client_with(trust: bool) -> &'static reqwest::Client {
    ghost::client_with_trust(trust)
}

/// Name why the request never reached Ghost.
///
/// reqwest's Display is the same "error sending request for url (…)" for every
/// transport failure — DNS, refused connection, timeout, and an untrusted
/// certificate all read alike. The cause is only in the source chain, so read
/// it and say what happened: the operator was shown "error sending request" for
/// a host serving its hosting panel's default certificate, and went looking for
/// a bad key when the problem was the domain's TLS.
fn transport_error(origin: &str, error: &reqwest::Error) -> String {
    let mut chain = String::new();
    let mut source: Option<&(dyn std::error::Error + 'static)> = std::error::Error::source(error);
    while let Some(cause) = source {
        chain.push_str(&cause.to_string().to_ascii_lowercase());
        chain.push(' ');
        source = std::error::Error::source(cause);
    }
    if chain.contains("certificate")
        || chain.contains("unknownissuer")
        || chain.contains("notvalidforname")
        || chain.contains("handshake")
    {
        return format!(
            "{origin} served a TLS certificate that is not trusted, so the request never reached \
             Ghost. This is not a key problem: fix the domain's certificate (a hosting panel's \
             default certificate is the usual cause) or accept this origin's certificate on \
             the Ghost card to connect anyway. Detail: {}",
            ghost::safe_message(chain.trim())
        );
    }
    if chain.contains("dns") || chain.contains("lookup") || chain.contains("name or service") {
        return format!(
            "{origin} does not resolve in DNS. Check the hostname — a cms. subdomain that was \
             never created lands here."
        );
    }
    if error.is_timeout() || chain.contains("timed out") {
        return format!(
            "{origin} did not answer within 25 s. The host may be down, or something in front of \
             it is dropping connections."
        );
    }
    if error.is_connect() || chain.contains("connection refused") {
        return format!(
            "Nothing accepted a connection at {origin}. The host resolved, but no HTTPS service \
             is listening there."
        );
    }
    ghost::safe_message(&error.to_string())
}

/// Call the Admin API. Redirects are refused: a redirect means the URL is not
/// the canonical origin, and the token must not be replayed to a new host.
async fn admin_get(
    origin: &str,
    path: &str,
    token: &str,
    trust: bool,
) -> Result<(u16, String), String> {
    let resp = client_with(trust)
        .get(format!("{origin}{path}"))
        .header("Authorization", ghost::auth_header(token))
        .header("Accept", "application/json")
        .send()
        .await
        .map_err(|e| transport_error(origin, &e))?;
    let status = resp.status();
    if status.is_redirection() {
        return Err("Redirects are blocked. Use the canonical https origin.".to_string());
    }
    let body = resp.text().await.unwrap_or_default();
    Ok((status.as_u16(), body))
}

/// Ghost's own explanation for a rejection, if the body is its error shape.
///
/// Ghost answers with `{"errors":[{"message":"...","type":"..."}]}`. That
/// message is the useful part: it distinguishes a malformed header from an
/// unknown key from an integration that lacks a scope. Returns `None` when the
/// body is not Ghost's JSON, so a proxy's HTML error page does not leak in.
fn ghost_error_message(body: &str) -> Option<String> {
    let parsed: Value = serde_json::from_str(body).ok()?;
    let message = parsed
        .get("errors")?
        .as_array()?
        .first()?
        .get("message")?
        .as_str()?
        .trim();
    if message.is_empty() {
        return None;
    }
    // Run it through the credential filter: a provider body must never echo a
    // key or a signed token back to a browser.
    Some(ghost::safe_message(message))
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
    match admin_get(&origin, "/ghost/api/admin/posts/?limit=1&fields=id", &token, target.trust_cert).await {
        Ok((status, body)) => {
            if status == 401 || status == 403 {
                // Say what Ghost actually objected to. The blanket "refused the
                // Admin API key" was wrong often enough to be actively harmful:
                // a wrong host, a refused origin, or an expired token all
                // reported as a bad key.
                let detail = ghost_error_message(&body);
                return json!({
                    "ok": false,
                    "error": match detail {
                        Some(reason) if reason.to_lowercase().contains("header format") => format!(
                            "Ghost at {origin} did not accept the token ({reason}). The key must be \
                             copied whole as id:secret — a truncated or re-typed key lands here."
                        ),
                        Some(reason) => format!(
                            "Ghost at {origin} rejected the request: {reason}"
                        ),
                        None => format!(
                            "Ghost at {origin} returned HTTP {status}. The key was not accepted."
                        ),
                    }
                });
            }
            // A 404 on the Admin API path usually means there is no Ghost at this
            // address at all: the host is up, but nothing serves /ghost/. Saying
            // just "HTTP 404" sends people hunting for a key problem that is
            // really a wrong-URL problem, so name the likely cause.
            if status == 404 {
                return json!({
                    "ok": false,
                    "error": format!(
                        "No Ghost Admin API at {origin}. The host answered 404, which means it is \
                         reachable but is not serving Ghost at this address. Check that the URL is \
                         the site's Ghost origin (for example https://example.com) and not a \
                         subdomain or path that points somewhere else."
                    )
                });
            }
            if !(200..300).contains(&status) {
                return json!({ "ok": false, "error": format!("Ghost returned HTTP {status}.") });
            }
        }
        Err(error) => return json!({ "ok": false, "error": error }),
    }
    let version = match admin_get(&origin, "/ghost/api/admin/site/", &token, target.trust_cert).await {
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
    json!({
        "ok": true,
        "version": version,
        "origin": origin,
        // The connection works, but if the operator accepted an untrusted
        // certificate the UI must say so rather than imply a verified host.
        "verified": !target.trust_cert,
    })
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
        let (status, body) = match admin_get(&origin, &path, &token, target.trust_cert).await {
            Ok(result) => result,
            Err(error) => return json!({ "ok": false, "error": error }),
        };
        if status == 401 || status == 403 {
            let reason = ghost_error_message(&body).unwrap_or_else(|| format!("HTTP {status}"));
            return json!({ "ok": false, "error": format!("Ghost rejected the request: {reason}") });
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
        stripped.split(']').next().unwrap_or("").to_string()
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
    match client_with(false).get(&checked).send().await {
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

use axum::Json;

/// Validate a Ghost URL before it is stored. Reports the same refusals the
/// push path enforces, so a misconfiguration is caught at entry rather than at
/// publish time.
pub(crate) async fn check_ghost_url(Json(req): Json<GhostUrlRequest>) -> Json<serde_json::Value> {
    match ghost::validate_ghost_url(&req.url) {
        Ok(url) => Json(serde_json::json!({ "ok": true, "url": url })),
        Err(e) => Json(serde_json::json!({ "ok": false, "error": e })),
    }
}
/// List providers for a workspace. Keys are never returned — only `key_hint`.
/// Test the key *and keep it*. A green test that forgets the key is how this
/// pipeline spent days reporting "no ghost url/key configured" against a
/// connection the operator had just verified — the credential lived only in
/// the browser snapshot, which the server cannot rely on. Persisting here
/// makes `websites` the single source of truth the publish path reads.
pub(crate) async fn ghost_test(
    axum::extract::State(st): axum::extract::State<crate::AppState>,
    Json(req): Json<crate::ghost_api::GhostTarget>,
) -> Json<serde_json::Value> {
    let mut out = crate::ghost_api::test_connection(&req).await;
    if out.get("ok").and_then(serde_json::Value::as_bool) == Some(true) {
        let origin = out
            .get("origin")
            .and_then(serde_json::Value::as_str)
            .unwrap_or(req.url.trim())
            .to_string();
        let key = req.admin_key.trim().to_string();
        if !key.is_empty() && !key.contains('•') {
            let sealed = crate::secrets::seal_secret(&key);
            let site_ref = req.site_ref.trim();
            let saved = sqlx::query(
                "UPDATE websites SET ghost_mode = 'LIVE', ghost_url = ?, ghost_admin_key_enc = ? \
                 ghost_trust_cert = ? \
                 WHERE id = (SELECT website_id FROM sites \
                             WHERE workspace_id = ?1 AND website_id IS NOT NULL \
                               AND (?2 = '' OR client_uid = ?2) \
                             ORDER BY CASE WHEN COALESCE(client_uid, '') != '' THEN 0 ELSE 1 END, \
                                      id LIMIT 1)",
            )
            .bind(&origin)
            .bind(&sealed)
            .bind(i64::from(req.trust_cert))
            .bind(crate::default_workspace())
            .bind(site_ref)
            .execute(&st.pool)
            .await;
            if let Some(object) = out.as_object_mut() {
                object.insert(
                    "saved".to_string(),
                    serde_json::Value::Bool(matches!(saved, Ok(r) if r.rows_affected() > 0)),
                );
            }
        }
    }
    Json(out)
}
pub(crate) async fn ghost_sync(
    Json(req): Json<crate::ghost_api::GhostTarget>,
) -> Json<serde_json::Value> {
    Json(crate::ghost_api::sync_posts(&req).await)
}
pub(crate) async fn ghost_probe(Json(req): Json<ProbeRequest>) -> Json<serde_json::Value> {
    Json(crate::ghost_api::probe(&req.url).await)
}
pub(crate) async fn ghost_publish(
    Json(req): Json<crate::ghost_api::PublishRequest>,
) -> Json<serde_json::Value> {
    Json(crate::ghost_api::publish(&req).await)
}
pub(crate) async fn ghost_reweave(
    Json(req): Json<crate::ghost_api::ReWeaveRequest>,
) -> Json<serde_json::Value> {
    Json(crate::ghost_api::reweave(&req).await)
}

/// Backfill the CMS: push every finished article this site owns into Ghost as a
/// draft, skipping the ones Ghost already has.
pub(crate) async fn ghost_mirror(
    axum::extract::State(st): axum::extract::State<crate::AppState>,
    Json(req): Json<MirrorRequest>,
) -> Json<serde_json::Value> {
    Json(crate::stages::mirror_to_ghost(&st.pool, &req.site_ref, req.website_id).await)
}

#[derive(Deserialize)]
pub(crate) struct MirrorRequest {
    /// The site as the studio names it (`sites.client_uid`), or a numeric id.
    site_ref: String,
    #[serde(default)]
    website_id: Option<i64>,
}

#[derive(Deserialize)]
pub(crate) struct GhostUrlRequest {
    url: String,
}
#[derive(Deserialize)]
pub(crate) struct ProbeRequest {
    #[serde(default)]
    url: String,
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
        assert_eq!(
            payload["exp"], 1_700_000_300u64,
            "Ghost caps the window at 5 minutes"
        );
    }

    #[test]
    fn the_signature_is_hmac_sha256_over_the_first_two_parts() {
        let token = admin_token(KEY, 1_700_000_000).expect("token");
        let p = parts(&token);
        let secret = hex_bytes("0123456789abcdef0123456789abcdef").unwrap();
        let key = hmac::Key::new(hmac::HMAC_SHA256, &secret);
        let expected = URL_SAFE_NO_PAD
            .encode(hmac::sign(&key, format!("{}.{}", p[0], p[1]).as_bytes()).as_ref());
        assert_eq!(p[2], expected);
    }

    #[test]
    fn a_key_that_is_not_hex_id_colon_secret_is_refused() {
        assert!(admin_token("not-a-key", 0).is_none());
        assert!(
            admin_token("abc:def", 0).is_none(),
            "secret must be long hex"
        );
        assert!(admin_token("0123abcd0123abcd0123abcd0123abcd:zzzz", 0).is_none());
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

/// One image to upload into Ghost before the post is written.
#[derive(Debug, Deserialize)]
pub struct PublishImage {
    #[serde(default)]
    pub src: Option<String>,
    #[serde(default)]
    pub remote: Option<String>,
    #[serde(default)]
    pub role: Option<String>,
    #[serde(default)]
    pub alt: String,
}

#[derive(Debug, Deserialize)]
pub struct PublishAuthor {
    #[serde(default)]
    pub name: String,
    #[serde(default)]
    pub slug: Option<String>,
    // Carried for the wire contract only: Ghost accepts these when *creating* an
    // author, and this path never creates one. The studio renders them into the
    // article HTML before publishing.
    #[serde(default)]
    #[allow(dead_code)]
    pub bio: Option<String>,
    #[serde(default)]
    #[allow(dead_code)]
    pub profile_image: Option<String>,
    #[serde(default)]
    pub known_ghost_author_id: Option<String>,
}

#[derive(Debug, Deserialize)]
pub struct PublishRequest {
    #[serde(default)]
    pub url: String,
    #[serde(default)]
    pub admin_key: String,
    /// Accept an untrusted certificate for this origin (see GhostTarget).
    #[serde(default)]
    pub trust_cert: bool,
    #[serde(default)]
    pub title: String,
    #[serde(default)]
    pub slug: String,
    #[serde(default)]
    pub html: String,
    #[serde(default)]
    pub excerpt: String,
    #[serde(default)]
    pub meta_description: Option<String>,
    #[serde(default)]
    pub status: Option<String>,
    #[serde(default)]
    pub tags: Vec<String>,
    #[serde(default)]
    pub images: Vec<PublishImage>,
    #[serde(default)]
    pub author: Option<PublishAuthor>,
}

/// A placeholder CMS path must never reach Ghost: it would come back as
/// `/content/images/...` and be served as a broken image forever.
fn is_fake_cms_image(url: &str) -> bool {
    let lower = url.to_ascii_lowercase();
    if let Some(rest) = lower
        .strip_prefix("http://")
        .or_else(|| lower.strip_prefix("https://"))
    {
        if rest.starts_with("cms.") && rest.contains('/') {
            return true;
        }
    }
    lower.contains("/content/images/")
}

fn slug_of(raw: &str) -> String {
    raw.chars()
        .filter(|c| c.is_ascii_alphanumeric() || *c == '-')
        .take(80)
        .collect()
}

fn post_from(body: &str) -> Option<Value> {
    let parsed: Value = serde_json::from_str(body).ok()?;
    parsed.get("posts")?.get(0).cloned()
}

fn field(post: &Value, name: &str) -> String {
    post.get(name)
        .and_then(|v| v.as_str())
        .unwrap_or("")
        .to_string()
}

async fn admin_json(
    origin: &str,
    path: &str,
    token: &str,
    method: &str,
    body: Option<Value>,
    trust: bool,
) -> Result<(u16, String), String> {
    let mut request = match method {
        "PUT" => client_with(trust).put(format!("{origin}{path}")),
        _ => client_with(trust).post(format!("{origin}{path}")),
    }
    .header("Authorization", ghost::auth_header(token))
    .header("Accept", "application/json");
    if let Some(body) = body {
        request = request
            .header("Content-Type", "application/json")
            .body(body.to_string());
    }
    let resp = request
        .send()
        .await
        .map_err(|e| transport_error(origin, &e))?;
    let status = resp.status();
    if status.is_redirection() {
        return Err("Redirects are blocked. Use the canonical https origin.".to_string());
    }
    let body = resp.text().await.unwrap_or_default();
    Ok((status.as_u16(), body))
}

/// Upload one image and return the URL Ghost serves it from.
async fn upload_image(
    origin: &str,
    token: &str,
    name: String,
    mime: String,
    bytes: Vec<u8>,
    trust: bool,
) -> Option<String> {
    let part = reqwest::multipart::Part::bytes(bytes)
        .file_name(name)
        .mime_str(&mime)
        .ok()?;
    let form = reqwest::multipart::Form::new().part("file", part);
    let resp = client_with(trust)
        .post(format!("{origin}/ghost/api/admin/images/upload/"))
        .header("Authorization", ghost::auth_header(token))
        .multipart(form)
        .send()
        .await
        .ok()?;
    if !resp.status().is_success() {
        return None;
    }
    let body: Value = resp.json().await.ok()?;
    body.get("images")?
        .get(0)?
        .get("url")?
        .as_str()
        .map(|s| s.to_string())
}

/// Resolve the assigned author. Only a real Ghost author id is ever attached —
/// creation is never attempted, and a failed lookup keeps Ghost's default byline
/// while the article HTML keeps its byline and Person JSON-LD.
async fn resolve_author(
    origin: &str,
    token: &str,
    wanted: &PublishAuthor,
    trust: bool,
) -> (String, String, bool) {
    let known = wanted.known_ghost_author_id.as_deref().unwrap_or("");
    if known.len() == 24 && known.chars().all(|c| c.is_ascii_hexdigit()) {
        let (status, _) = admin_get(origin, &format!("/ghost/api/admin/authors/{known}/"), token, trust)
            .await
            .unwrap_or((0, String::new()));
        if (200..300).contains(&status) {
            return (
                known.to_string(),
                "Existing Ghost author id verified and attached.".to_string(),
                true,
            );
        }
        return (
            String::new(),
            format!("Stored Ghost author id did not resolve (HTTP {status}). Ghost default byline kept; article byline + Person JSON-LD preserved."),
            false,
        );
    }
    let query = match wanted.slug.as_deref().filter(|s| !s.is_empty()) {
        Some(slug) => format!("/ghost/api/admin/authors/slug/{slug}/"),
        None => format!(
            "/ghost/api/admin/authors/?filter={}&limit=1",
            crate::image::encode(&format!("name:['{}']", wanted.name.replace('\'', "\\'")))
        ),
    };
    let (status, body) = admin_get(origin, &query, token, trust)
        .await
        .unwrap_or((0, String::new()));
    if !(200..300).contains(&status) {
        return (
            String::new(),
            format!("Ghost author lookup failed (HTTP {status}). Ghost default byline kept; article byline + Person JSON-LD preserved."),
            false,
        );
    }
    let parsed: Value = serde_json::from_str(&body).unwrap_or(Value::Null);
    let hit = parsed
        .get("authors")
        .and_then(|a| a.get(0))
        .and_then(|a| a.get("id"))
        .and_then(|v| v.as_str())
        .or_else(|| parsed.get("id").and_then(|v| v.as_str()));
    match hit {
        Some(id) => (
            id.to_string(),
            "Matched an existing Ghost author by slug/name and attached it.".to_string(),
            true,
        ),
        None => (
            String::new(),
            "No matching Ghost author; Admin-key role does not permit author creation. Ghost default byline kept; article byline + Person JSON-LD preserved.".to_string(),
            false,
        ),
    }
}

/// Publish (or reconcile) one article into Ghost.
pub async fn publish(req: &PublishRequest) -> Value {
    let target = GhostTarget {
        url: req.url.clone(),
        admin_key: req.admin_key.clone(),
        site_ref: String::new(),
        trust_cert: req.trust_cert,
    };
    let (origin, token) = match resolve(&target) {
        Ok(pair) => pair,
        Err(error) => return json!({ "ok": false, "error": error }),
    };
    let trust = target.trust_cert;
    let slug = slug_of(&req.slug);
    if slug.is_empty() {
        return json!({ "ok": false, "error": "A slug is required." });
    }

    let lookup = format!("/ghost/api/admin/posts/slug/{slug}/");
    let (mut post_id, mut updated_at, mut existing_url) =
        (String::new(), String::new(), String::new());
    if let Ok((status, body)) = admin_get(&origin, &lookup, &token, trust).await {
        if (200..300).contains(&status) {
            if let Some(post) = post_from(&body) {
                post_id = field(&post, "id");
                updated_at = field(&post, "updated_at");
                existing_url = field(&post, "url");
            }
        }
    }

    let mut html = req.html.clone();
    let (mut feature, mut feature_alt) = (String::new(), String::new());
    for image in req.images.iter().take(6) {
        let src = image
            .src
            .as_deref()
            .filter(|s| !is_fake_cms_image(s))
            .map(|s| s.to_string());
        let remote = image
            .remote
            .as_deref()
            .filter(|s| !is_fake_cms_image(s))
            .map(|s| s.to_string());
        // `src` arrives as `/media/<hash>.jpg`; the media store keys on the bare
        // filename.
        let src_name = src.as_deref().and_then(|s| s.rsplit('/').next());
        let Some((name, mime, bytes)) = crate::images::read_one(src_name, remote.as_deref()).await
        else {
            continue;
        };
        let Some(uploaded) = upload_image(&origin, &token, name, mime, bytes, trust).await else {
            continue;
        };
        let figure = format!(
            "<figure class=\"kg-card kg-image-card\"><img src=\"{uploaded}\" alt=\"{}\" /></figure>\n",
            image.alt.replace('"', "")
        );
        match src.as_deref() {
            Some(src) if html.contains(src) => html = html.replace(src, &uploaded),
            _ => html = format!("{figure}{html}"),
        }
        if image.role.as_deref() == Some("featured") && feature.is_empty() {
            feature = uploaded;
            feature_alt = image.alt.clone();
        }
    }

    let mut body = serde_json::Map::new();
    body.insert("title".into(), json!(req.title));
    body.insert("slug".into(), json!(slug));
    body.insert("html".into(), json!(html));
    body.insert("custom_excerpt".into(), json!(req.excerpt));
    let meta = req
        .meta_description
        .as_deref()
        .filter(|m| !m.trim().is_empty())
        .unwrap_or(&req.excerpt);
    body.insert("meta_description".into(), json!(meta));
    body.insert(
        "status".into(),
        json!(if req.status.as_deref() == Some("published") {
            "published"
        } else {
            "draft"
        }),
    );
    if !feature.is_empty() {
        body.insert("feature_image".into(), json!(feature));
        body.insert("feature_image_alt".into(), json!(feature_alt));
    }
    let tags: Vec<Value> = req
        .tags
        .iter()
        .filter(|t| !t.is_empty())
        .take(5)
        .map(|t| json!({ "name": t.chars().take(40).collect::<String>() }))
        .collect();
    body.insert("tags".into(), json!(tags));

    let mut author_result = Value::Null;
    if let Some(wanted) = req.author.as_ref().filter(|a| !a.name.is_empty()) {
        let (id, note, matched) = resolve_author(&origin, &token, wanted, trust).await;
        if !id.is_empty() {
            body.insert("authors".into(), json!([{ "id": id }]));
        }
        author_result = json!({
            "matched": matched,
            "ghostAuthorId": if id.is_empty() { Value::Null } else { json!(id) },
            "note": note,
        });
    }

    let mut reconciled = false;
    if !post_id.is_empty() {
        let mut put = body.clone();
        if !updated_at.is_empty() {
            put.insert("updated_at".into(), json!(updated_at));
        }
        let path = format!("/ghost/api/admin/posts/{post_id}/?source=html");
        if let Ok((status, response)) = admin_json(
            &origin,
            &path,
            &token,
            "PUT",
            Some(json!({ "posts": [put] })),
            trust,
        )
        .await
        {
            if (200..300).contains(&status) {
                let post = post_from(&response);
                return json!({
                    "ok": true,
                    "reconciled": true,
                    "postId": post_id,
                    "url": post.as_ref().map(|p| field(p, "url")).filter(|u| !u.is_empty()).unwrap_or(existing_url),
                    "html": html,
                    "imaged": !feature.is_empty(),
                    "author": author_result,
                    "updatedAt": post.as_ref().map(|p| field(p, "updated_at")).unwrap_or_default(),
                });
            }
        }
        reconciled = true;
    }

    let payload = json!({ "posts": [body] });
    match admin_json(
        &origin,
        "/ghost/api/admin/posts/?source=html",
        &token,
        "POST",
        Some(payload),
        trust,
    )
    .await
    {
        Err(error) => json!({ "ok": false, "error": error }),
        Ok((status, response)) => {
            if status == 422 {
                if let Ok((ok_status, body)) = admin_get(&origin, &lookup, &token, trust).await {
                    if (200..300).contains(&ok_status) {
                        if let Some(post) = post_from(&body) {
                            if !field(&post, "id").is_empty() {
                                return json!({
                                    "ok": true,
                                    "reconciled": true,
                                    "postId": field(&post, "id"),
                                    "url": field(&post, "url"),
                                    "html": html,
                                    "imaged": !feature.is_empty(),
                                    "author": author_result,
                                    "updatedAt": field(&post, "updated_at"),
                                });
                            }
                        }
                    }
                }
                return json!({ "ok": false, "error": "Ghost rejected the post. The slug may already exist, and it was not created again." });
            }
            if status == 401 || status == 403 {
                let reason =
                    ghost_error_message(&response).unwrap_or_else(|| format!("HTTP {status}"));
                return json!({
                    "ok": false,
                    "error": format!("Ghost rejected the push: {reason}")
                });
            }
            if !(200..300).contains(&status) {
                return json!({ "ok": false, "error": format!("Ghost returned HTTP {status}.") });
            }
            let post = post_from(&response).unwrap_or(Value::Null);
            let id = field(&post, "id");
            if id.is_empty() {
                return json!({ "ok": false, "error": "Ghost did not return a post id." });
            }
            json!({
                "ok": true,
                "reconciled": reconciled,
                "postId": id,
                "url": field(&post, "url"),
                "html": html,
                "imaged": !feature.is_empty(),
                "author": author_result,
                "updatedAt": field(&post, "updated_at"),
            })
        }
    }
}

/// Rule 6's guard, kept pure so the optimistic-lock behaviour is verifiable
/// without a live Ghost instance: skip only when a different revision is on
/// Ghost and the operator has not acknowledged the hand edit.
fn reweave_skips_stale(expected: &str, remote: &str, acknowledged: bool) -> bool {
    if expected.is_empty() || remote.is_empty() {
        return false;
    }
    expected != remote && !acknowledged
}

#[derive(Debug, Deserialize)]
pub struct ReWeaveRequest {
    #[serde(default)]
    pub url: String,
    #[serde(default)]
    pub admin_key: String,
    /// Accept an untrusted certificate for this origin (see GhostTarget).
    #[serde(default)]
    pub trust_cert: bool,
    #[serde(default)]
    pub post_id: Option<String>,
    #[serde(default)]
    pub slug: Option<String>,
    #[serde(default)]
    pub html: String,
    #[serde(default)]
    pub expected_updated_at: Option<String>,
    #[serde(default)]
    pub acknowledge_hand_edited: bool,
}

/// Rule 6 — PUT-only re-weave.
///
/// Reads Ghost's current `updated_at`, refuses to touch a post that changed
/// since our last publish (unless the operator acknowledged the hand edit), then
/// PUTs the new HTML with the lock it just read. Ghost is never asked to create
/// anything here.
pub async fn reweave(req: &ReWeaveRequest) -> Value {
    let fail = |code: &str, error: &str| json!({ "ok": false, "code": code, "error": error });
    if req.html.trim().is_empty() {
        return fail("ERROR", "Post HTML is required for a re-weave.");
    }
    let target = GhostTarget {
        url: req.url.clone(),
        admin_key: req.admin_key.clone(),
        site_ref: String::new(),
        trust_cert: req.trust_cert,
    };
    let (origin, token) = match resolve(&target) {
        Ok(pair) => pair,
        Err(error) => return fail("BAD_URL", &error),
    };
    let trust = target.trust_cert;
    let post_id = req
        .post_id
        .as_deref()
        .map(str::trim)
        .filter(|s| !s.is_empty());
    let slug = req.slug.as_deref().map(slug_of).filter(|s| !s.is_empty());
    let query = match (post_id, slug.as_deref()) {
        (Some(id), _) => format!("/ghost/api/admin/posts/{id}/?formats=html"),
        (None, Some(slug)) => format!("/ghost/api/admin/posts/slug/{slug}/?formats=html"),
        (None, None) => return fail("BAD_URL", "A post id or slug is required."),
    };

    let (status, body) = match admin_get(&origin, &query, &token, trust).await {
        Ok(pair) => pair,
        Err(error) => return fail("ERROR", &error),
    };
    if status == 401 || status == 403 {
        let reason = ghost_error_message(&body).unwrap_or_else(|| format!("HTTP {status}"));
        return fail(
            "FORBIDDEN",
            &format!("Ghost rejected the request: {reason}"),
        );
    }
    if status == 404 {
        return fail("NOT_FOUND", "That post is not on Ghost. Re-weave skipped.");
    }
    if !(200..300).contains(&status) {
        return fail("HTTP", &format!("Ghost returned HTTP {status}."));
    }
    let Some(post) = post_from(&body) else {
        return fail("NO_POST", "Ghost did not return the post.");
    };
    let id = field(&post, "id");
    if id.is_empty() {
        return fail("NO_POST", "Ghost did not return the post.");
    }
    let remote_updated_at = field(&post, "updated_at");

    // Hand-edit guard: our local copy is stale, so the write is skipped (never
    // clobbered) unless the operator says otherwise.
    let expected = req.expected_updated_at.as_deref().unwrap_or("");
    if reweave_skips_stale(expected, &remote_updated_at, req.acknowledge_hand_edited) {
        return json!({
            "ok": false,
            "code": "STALE_LOCAL_COPY",
            "error": "The post changed on Ghost since we published it (hand-edited). Re-weave skipped to protect the edit.",
            "postId": id,
            "remoteUpdatedAt": remote_updated_at,
        });
    }

    let mut lock = serde_json::Map::new();
    lock.insert("html".into(), json!(req.html));
    if !remote_updated_at.is_empty() {
        lock.insert("updated_at".into(), json!(remote_updated_at));
    }
    let path = format!("/ghost/api/admin/posts/{id}/?source=html");
    let (status, body) = match admin_json(
        &origin,
        &path,
        &token,
        "PUT",
        Some(json!({ "posts": [lock] })),
        trust,
    )
    .await
    {
        Ok(pair) => pair,
        Err(error) => return fail("ERROR", &error),
    };
    if status == 401 || status == 403 {
        let reason = ghost_error_message(&body).unwrap_or_else(|| format!("HTTP {status}"));
        return fail(
            "FORBIDDEN",
            &format!("Ghost rejected the request: {reason}"),
        );
    }
    if status == 422 {
        return fail(
            "LOCK_CONFLICT",
            "Ghost rejected the update (optimistic-lock conflict or invalid HTML). Nothing was written.",
        );
    }
    if !(200..300).contains(&status) {
        return fail("HTTP", &format!("Ghost returned HTTP {status}."));
    }
    let saved = post_from(&body).unwrap_or(Value::Null);
    let saved_id = field(&saved, "id");
    let saved_url = field(&saved, "url");
    let saved_at = field(&saved, "updated_at");
    json!({
        "ok": true,
        "code": "OK",
        "postId": if saved_id.is_empty() { id } else { saved_id },
        "url": if saved_url.is_empty() { field(&post, "url") } else { saved_url },
        "updatedAt": if saved_at.is_empty() { remote_updated_at } else { saved_at },
    })
}

#[cfg(test)]
mod publish_tests {
    use super::*;

    #[test]
    fn a_placeholder_cms_path_never_reaches_ghost() {
        assert!(is_fake_cms_image(
            "https://cms.example.com/content/images/2024/01/x.jpg"
        ));
        assert!(is_fake_cms_image("/content/images/2024/01/x.jpg"));
        assert!(!is_fake_cms_image("https://images.bing.com/th?id=OIP.abc"));
        assert!(!is_fake_cms_image("https://example.com/photo.jpg"));
    }

    #[test]
    fn slugs_lose_everything_ghost_would_reject() {
        assert_eq!(slug_of("Hello, World! 2026"), "HelloWorld2026");
        assert_eq!(slug_of("already-a-slug"), "already-a-slug");
        assert_eq!(slug_of("umlaut/../etc"), "umlautetc");
        assert_eq!(slug_of(&"a".repeat(200)).len(), 80);
    }

    #[test]
    fn a_hand_edit_is_never_clobbered() {
        // Nothing to compare on either side: write.
        assert!(!reweave_skips_stale("", "2026-01-01T00:00:00Z", false));
        assert!(!reweave_skips_stale("2026-01-01T00:00:00Z", "", false));
        // Same revision: our copy is current.
        assert!(!reweave_skips_stale(
            "2026-01-01T00:00:00Z",
            "2026-01-01T00:00:00Z",
            false
        ));
        // Ghost moved on: skip, unless the operator acknowledged the edit.
        assert!(reweave_skips_stale(
            "2026-01-01T00:00:00Z",
            "2026-02-02T00:00:00Z",
            false
        ));
        assert!(!reweave_skips_stale(
            "2026-01-01T00:00:00Z",
            "2026-02-02T00:00:00Z",
            true
        ));
    }
}
