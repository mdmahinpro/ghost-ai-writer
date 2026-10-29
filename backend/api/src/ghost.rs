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
    client_with_trust(false)
}

/// A client that will or will not verify the origin's certificate.
///
/// Some Ghost installs sit behind a panel that never issued a certificate for
/// the CMS subdomain (Traefik's default self-signed one is the usual case). The
/// operator can accept that explicitly per site; the strict client stays the
/// default and nothing is ever sent by accident.
pub fn client_with_trust(trust: bool) -> &'static reqwest::Client {
    static STRICT: OnceLock<reqwest::Client> = OnceLock::new();
    static TRUSTING: OnceLock<reqwest::Client> = OnceLock::new();
    let slot = if trust { &TRUSTING } else { &STRICT };
    slot.get_or_init(|| {
        reqwest::Client::builder()
            .timeout(std::time::Duration::from_secs(25))
            // Redirects are refused, not followed. Ghost is called with the
            // Admin API key in an Authorization header; following a 3xx would
            // hand that key to whatever the redirect points at. The TS push
            // blocks them (`redirect: "manual"` + an explicit 3xx throw), so
            // the pool of hosts that can see the key stays exactly the one the
            // operator configured.
            .redirect(reqwest::redirect::Policy::none())
            .danger_accept_invalid_certs(trust)
            .build()
            .expect("ghost http client")
    })
}

/// A Ghost URL must be a full https origin on a public host. Port of the TS
/// `validateGhostUrl`: http is refused outright (the key would travel in
/// clear), and private/loopback hosts are refused so a misconfigured or
/// hostile URL cannot make this server probe its own network.
pub fn validate_ghost_url(raw: &str) -> Result<String, String> {
    let raw = raw.trim();
    // Test builds exercise the real push against a stub Ghost on loopback, and
    // a per-test port keeps them parallel-safe (unlike a process-wide env
    // override). Release builds fall through to the https+public rules below,
    // so a loopback origin is still refused in production.
    #[cfg(test)]
    if raw.starts_with("http://127.0.0.1:") {
        return Ok(raw.to_string());
    }
    let rest = raw
        .strip_prefix("https://")
        .or_else(|| raw.strip_prefix("http://"))
        .ok_or_else(|| "Ghost URL must be a full https address.".to_string())?;
    if !raw.starts_with("https://") {
        return Err("Ghost URL must use https. Private hosts are blocked.".to_string());
    }
    // The authority ends at the first / ? or #. Split the port off carefully:
    // an IPv6 literal keeps its colons inside brackets, so a plain split(':')
    // would turn `[::1]` into `[` and let it through the private-host check.
    let host_port = rest
        .split(['/', '?', '#'])
        .next()
        .unwrap_or("")
        .rsplit('@')
        .next()
        .unwrap_or("");
    if host_port.is_empty() {
        return Err("Ghost URL must be a full https address.".to_string());
    }
    let host = if host_port.starts_with('[') {
        // [::1]:2368 → [::1]
        match host_port.find(']') {
            Some(end) => &host_port[..=end],
            None => return Err("Ghost URL must be a full https address.".to_string()),
        }
    } else {
        host_port.split(':').next().unwrap_or("")
    };
    if host.is_empty() {
        return Err("Ghost URL must be a full https address.".to_string());
    }
    if is_private_host(host) {
        return Err("Private addresses and loopback hosts are blocked.".to_string());
    }
    Ok(format!("https://{host_port}"))
}

/// Loopback, link-local, private and carrier-NAT hosts, plus the names that
/// only ever mean "this machine". Port of the TS `isPrivateHost`.
pub fn is_private_host(host: &str) -> bool {
    let h = host.to_lowercase();
    let h = h.trim_end_matches('.');
    if h.is_empty() || h == "localhost" || h.ends_with(".local") || h.ends_with(".internal") {
        return true;
    }
    let h = h.trim_start_matches('[').trim_end_matches(']');
    if h == "0.0.0.0" || h == "::1" {
        return true;
    }
    let parts: Vec<&str> = h.split('.').collect();
    if parts.len() != 4 {
        return false;
    }
    let oct: Option<Vec<u32>> = parts.iter().map(|p| p.parse::<u32>().ok()).collect();
    let Some(oct) = oct else { return false };
    if oct.iter().any(|o| *o > 255) {
        return false;
    }
    let (a, b) = (oct[0], oct[1]);
    if a == 10 || a == 127 || a == 0 {
        return true;
    }
    if a == 169 && b == 254 {
        return true;
    }
    if a == 172 && (16..=31).contains(&b) {
        return true;
    }
    if a == 192 && b == 168 {
        return true;
    }
    // Carrier-grade NAT.
    if a == 100 && (64..=127).contains(&b) {
        return true;
    }
    false
}

/// The Admin API key must look like `id:secret`, hex only (TS `readInput`).
/// Checked here so an obvious paste error is reported before a request is made.
pub fn valid_admin_key(key: &str) -> bool {
    let k = key.trim();
    let Some((id, secret)) = k.split_once(':') else {
        return false;
    };
    let hex = |s: &str, min: usize, max: usize| {
        s.len() >= min && s.len() <= max && s.bytes().all(|c| c.is_ascii_hexdigit())
    };
    hex(id, 8, 64) && hex(secret, 16, 128)
}

/// Never let a key or a JWT reach a log or an API response.
///
/// This used to replace any message mentioning "authorization", "bearer" or
/// "jwt" with the fixed sentence "Ghost refused the Admin API key." Ghost's own
/// rejection bodies contain the word "Authorization", so *every* failure —
/// a 404 for a wrong host, a refused post, an expired token — was reported as a
/// bad key. That sent people to re-check a credential that was never at fault.
///
/// The filter now targets the credential itself, not the topic of the sentence:
/// a message is only replaced when it looks like it actually carries a key
/// (a long hex run, or a JWT's three dot-separated segments).
pub fn safe_message(message: &str) -> String {
    if looks_like_a_credential(message) {
        return "Ghost rejected the request; the credential was withheld from this message."
            .to_string();
    }
    message.chars().take(180).collect()
}

/// True when the text appears to embed a key or a signed token.
///
/// Deliberately narrow: it matches a `id:secret` hex pair, a bare 32+ hex run,
/// or a JWT (`xx.yy.zz` where each part is base64url). Ordinary prose like
/// "Authorization header format is X" must survive, or the real error is lost.
fn looks_like_a_credential(text: &str) -> bool {
    // A JWT: three base64url segments separated by dots.
    if text.split_whitespace().any(|word| {
        let mut parts = word.split('.');
        let (a, b, c) = (parts.next(), parts.next(), parts.next());
        match (a, b, c, parts.next()) {
            (Some(a), Some(b), Some(c), None) => {
                a.len() >= 16
                    && b.len() >= 16
                    && c.len() >= 16
                    && (a.len() + b.len() + c.len()) > 60
                    && [a, b, c].iter().all(|p| {
                        p.bytes()
                            .all(|ch| ch.is_ascii_alphanumeric() || ch == b'-' || ch == b'_')
                    })
            }
            _ => false,
        }
    }) {
        return true;
    }
    // A bare hex run long enough to be a Ghost secret (or an `id:secret` pair).
    // Split on anything that is not a hex digit so `token=<hex>`, `key=<hex>`
    // and a quoted "<hex>" are all caught rather than only whitespace-separated
    // runs.
    text.split(|c: char| !c.is_ascii_hexdigit())
        .any(|run| run.len() >= 32)
}

/// The `Authorization` header value Ghost expects.
///
/// Ghost's Admin API uses the `Ghost` scheme, not `Bearer`:
///   Authorization: Ghost <jwt>
///
/// With `Bearer` Ghost answers
///   "Authorization header format is \"Authorization: Ghost ***\""
/// and refuses the request before it ever looks at the key — so a perfectly
/// valid key could never authenticate. Verified against Ghost 5.130.
pub fn auth_header(token: &str) -> String {
    format!("Ghost {token}")
}

/// The Admin API base for a request.
///
/// `GAW_GHOST_BASE` exists so tests can point at a mock. It used to be read
/// unconditionally, which means a stale value in the environment silently
/// redirected every real request to the wrong host — producing "the key was
/// refused" for a key that was fine. Only the test build honours the override.
fn base(ghost_url: &str) -> String {
    #[cfg(test)]
    if let Ok(mock) = std::env::var("GAW_GHOST_BASE") {
        if !mock.trim().is_empty() {
            return format!("{}/ghost/api/admin", mock.trim_end_matches('/'));
        }
    }
    let base = ghost_url.trim_end_matches('/');
    format!("{base}/ghost/api/admin")
}

#[derive(Debug)]
pub enum PushError {
    Http(reqwest::Error),
    /// Ghost answered with valid JSON-less / invalid JSON: create unverified.
    Parse(serde_json::Error),
    /// A wired Ghost answered with a non-2xx: the article was not created.
    Rejected {
        status: u16,
        body: String,
    },
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
/// Where a post is going, and on what terms. Bundled so `push_post` keeps a
/// readable signature now that accepting an untrusted certificate is part of
/// the decision rather than a detail of the HTTP client.
pub struct PushTarget<'a> {
    pub url: Option<&'a str>,
    pub admin_key: Option<&'a str>,
    pub trust_cert: bool,
}

pub async fn push_post(
    target: PushTarget<'_>,
    title: &str,
    slug: &str,
    source_markdown: &str,
    feature_image: Option<&str>,
    status: &str,
) -> Result<PushResult, PushError> {
    let PushTarget {
        url: ghost_url,
        admin_key,
        trust_cert,
    } = target;
    let (url, key) = match (ghost_url, admin_key) {
        (Some(u), Some(k)) if !u.trim().is_empty() && !k.trim().is_empty() => (u, k),
        _ => return Err(PushError::Unconfigured),
    };
    // Refuse a non-https or private-host URL before the key is attached to a
    // request. `Unconfigured` rather than a hard error: the article stays
    // REVIEW_HELD for manual publish, which is the honest outcome when the
    // stored integration is unusable.
    let url = match validate_ghost_url(url) {
        Ok(u) => u,
        Err(_) => return Err(PushError::Unconfigured),
    };
    if !valid_admin_key(key) {
        return Err(PushError::Unconfigured);
    }
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
    let resp = client_with_trust(trust_cert)
        .post(format!("{}/posts", base(&url)))
        .header("Authorization", auth_header(key))
        .header("Content-Type", "application/json")
        .json(&body)
        .send()
        .await
        .map_err(PushError::Http)?;
    let code = resp.status().as_u16();
    let text = resp.text().await.map_err(PushError::Http)?;
    if !(200..300).contains(&code) {
        // The Ghost response body can echo the request headers. Scrub it before
        // it becomes an error the operator reads or that lands in a log.
        return Err(PushError::Rejected {
            status: code,
            body: safe_message(&text),
        });
    }
    let v: Value = serde_json::from_str(&text).map_err(PushError::Parse)?;
    let id = v
        .get("post")
        .and_then(|p| p.get("id"))
        .and_then(Value::as_str)
        .ok_or_else(|| PushError::Rejected {
            status: code,
            body: "ghost response had no post.id".to_string(),
        })?
        .to_string();
    let url = v
        .get("post")
        .and_then(|p| p.get("url"))
        .and_then(Value::as_str)
        .unwrap_or_default()
        .to_string();
    Ok(PushResult {
        ghost_post_id: id,
        url,
    })
}

#[cfg(test)]
mod tests {
    use super::*;

    /// The two clients must differ in exactly one way: whether an untrusted
    /// certificate is accepted. Ignored by default because it needs the live
    /// host, run it explicitly with `--ignored` when touching the TLS path.
    #[tokio::test]
    #[ignore = "network: needs a host serving an untrusted certificate"]
    async fn an_accepted_certificate_reaches_ghost() {
        let url = "https://cms.joovlin.com/ghost/api/admin/posts/?limit=1&fields=id";
        let strict = client().get(url).send().await;
        assert!(
            strict.is_err(),
            "the strict client must refuse an untrusted certificate"
        );
        let accepting = client_with_trust(true).get(url).send().await;
        let response = accepting.expect("accepting the certificate must reach the host");
        // Ghost answers 403 without a key; any HTTP status proves the handshake
        // completed and the request actually arrived.
        assert!(
            response.status().is_success() || response.status().is_client_error(),
            "expected an HTTP answer, got {}",
            response.status()
        );
    }


    /// A followed 3xx would deliver the Authorization header to whatever host
    /// the redirect names. This exercises it for real: an axum server answers
    /// 302 and the redirect target records whether it was ever reached.
    #[tokio::test]
    async fn the_shared_client_refuses_to_follow_a_redirect() {
        use axum::{routing::get, Router};

        let hit = std::sync::Arc::new(std::sync::atomic::AtomicBool::new(false));
        let hit_for_target = hit.clone();
        let target = Router::new().route(
            "/",
            get(move || {
                let hit = hit_for_target.clone();
                async move {
                    hit.store(true, std::sync::atomic::Ordering::SeqCst);
                    "ok"
                }
            }),
        );
        let target_listener = tokio::net::TcpListener::bind("127.0.0.1:0").await.unwrap();
        let target_port = target_listener.local_addr().unwrap().port();
        tokio::spawn(async move {
            let _ = axum::serve(target_listener, target).await;
        });

        // The redirector points at the target.
        let hop = format!("http://127.0.0.1:{target_port}/");
        let redirector = Router::new().route(
            "/",
            get(move || {
                let hop = hop.clone();
                async move {
                    (
                        axum::http::StatusCode::FOUND,
                        [(axum::http::header::LOCATION, hop)],
                    )
                }
            }),
        );
        let listener = tokio::net::TcpListener::bind("127.0.0.1:0").await.unwrap();
        let port = listener.local_addr().unwrap().port();
        tokio::spawn(async move {
            let _ = axum::serve(listener, redirector).await;
        });

        let resp = client()
            .get(format!("http://127.0.0.1:{port}/"))
            .header("Authorization", "Bearer must-not-travel")
            .send()
            .await
            .expect("request");
        assert_eq!(
            resp.status().as_u16(),
            302,
            "the 3xx must be handed back to the caller, not followed"
        );
        // Give any (incorrect) follow time to land, then assert it did not.
        tokio::time::sleep(std::time::Duration::from_millis(200)).await;
        assert!(
            !hit.load(std::sync::atomic::Ordering::SeqCst),
            "the client followed the redirect and would have leaked the key"
        );
    }

    #[test]
    fn a_ghost_url_must_be_https_and_public() {
        // Accepted: a plain public https origin.
        assert_eq!(
            validate_ghost_url("https://blog.example.com").unwrap(),
            "https://blog.example.com"
        );
        assert_eq!(
            validate_ghost_url("  https://blog.example.com/  ").unwrap(),
            "https://blog.example.com"
        );
        // http is refused: the key would travel in clear.
        assert!(validate_ghost_url("http://blog.example.com").is_err());
        // Every private/loopback shape is refused.
        for bad in [
            "https://localhost",
            "https://localhost:2368",
            "https://127.0.0.1",
            "https://127.0.0.1:2368",
            "https://10.0.0.5",
            "https://192.168.1.10",
            "https://172.16.4.4",
            "https://169.254.169.254",
            "https://100.64.0.1",
            "https://0.0.0.0",
            "https://[::1]",
            "https://box.local",
            "https://svc.internal",
        ] {
            assert!(
                validate_ghost_url(bad).is_err(),
                "{bad} should have been blocked"
            );
        }
        // Not a URL at all.
        assert!(validate_ghost_url("blog.example.com").is_err());
        assert!(validate_ghost_url("").is_err());
        // A public host that merely contains digits is fine.
        assert!(validate_ghost_url("https://blog4.example.com").is_ok());
        assert_eq!(
            validate_ghost_url("https://blog.example.com/ghost").unwrap(),
            "https://blog.example.com"
        );
    }

    #[test]
    fn private_host_classification_matches_the_ts_ranges() {
        for bad in [
            "172.16.0.1",
            "172.31.255.255",
            "100.64.0.0",
            "100.127.255.255",
        ] {
            assert!(is_private_host(bad), "{bad} is private");
        }
        for ok in [
            "172.15.0.1",
            "172.32.0.1",
            "100.63.0.1",
            "100.128.0.1",
            "8.8.8.8",
        ] {
            assert!(!is_private_host(ok), "{ok} is public");
        }
        // A hostname is not an IP and is not blocked by the range check.
        assert!(!is_private_host("blog.example.com"));
        assert!(is_private_host("LOCALHOST"));
    }

    #[test]
    fn the_authorization_header_uses_the_ghost_scheme() {
        // Ghost's Admin API rejects `Bearer` outright:
        //   Authorization header format is "Authorization: Ghost ***"
        // so a valid key could never authenticate. Pinned because the failure
        // looks exactly like a bad key.
        assert_eq!(
            auth_header("header.payload.sig"),
            "Ghost header.payload.sig"
        );
        assert!(!auth_header("t").starts_with("Bearer"));
    }

    #[test]
    fn an_admin_key_must_be_hex_id_colon_hex_secret() {
        assert!(valid_admin_key(
            "0123456789abcdef0123456789abcdef:abcdef0123456789abcdef"
        ));
        assert!(valid_admin_key("abcdef01:0123456789abcdef"));
        // No colon, empty halves, wrong lengths, non-hex characters.
        assert!(!valid_admin_key("nocolon"));
        assert!(!valid_admin_key(":abc"));
        assert!(!valid_admin_key("abcdef01:"));
        assert!(!valid_admin_key("short:0123456789abcdef"));
        assert!(!valid_admin_key("abcdef01:tooshort"));
        assert!(!valid_admin_key("zzzzzzzz:0123456789abcdef"));
    }

    #[test]
    fn a_message_that_echoes_credentials_is_replaced() {
        // Only messages that actually carry a key or a signed token are scrubbed.
        let jwt =
            "eyJhbGciOiJIUzI1NiIsImtpZCI6ImFiY2QiLCJ0eXAiOiJKV1QifQ.eyJpYXQiOjEsImV4cCI6Miwid\
                   WQiOiIvYWRtaW4vIn0.c2lnbmF0dXJlLWhlcmUtMTIzNDU2Nzg5MA";
        for leaky in [
            // A full id:secret pair, and a bare 32+ hex secret.
            "key 0123abcd0123abcd0123abcd:0123456789abcdef0123456789abcdef was used",
            "token=0123456789abcdef0123456789abcdef",
            &format!("sent {jwt}"),
        ] {
            assert!(
                safe_message(leaky).contains("withheld"),
                "{leaky:?} carries a credential and must be scrubbed"
            );
        }

        // Ordinary provider prose must survive. Ghost's own 401 says
        // "Authorization header format is ..." — replacing that is what made
        // every failure look like a bad key.
        assert_eq!(
            safe_message("Authorization header format is \"Authorization: Ghost ***\""),
            "Authorization header format is \"Authorization: Ghost ***\""
        );
        assert_eq!(safe_message("Not Found"), "Not Found");
        assert_eq!(safe_message("adminKey rejected"), "adminKey rejected");
        assert!(safe_message(&"x".repeat(400)).chars().count() <= 180);
    }
}
