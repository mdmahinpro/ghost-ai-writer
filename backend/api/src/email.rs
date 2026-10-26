//! Outbound email: verification letters and notification digests.
//!
//! Ported from the TS `src/lib/email.functions.ts`. Two vendors, both plain
//! HTTP with a bearer key — no SMTP, no SDK:
//!   * Resend   — POST https://api.resend.com/emails
//!   * SendGrid — POST https://api.sendgrid.com/v3/mail/send
//!
//! Three rules are worth stating out loud, because each one is a real failure
//! the TS code guards against and losing them would be a silent regression:
//!
//! 1. **Redirects are blocked, not followed.** A 3xx means something
//!    intercepted the request (a proxy, a captive portal, a hijacked DNS
//!    answer) and the key would have been handed to it. Following it would
//!    leak the bearer token, so a 3xx is reported as a failure.
//! 2. **Errors are scrubbed.** A vendor error body can echo the request
//!    headers, which include the API key. Every error string goes through
//!    [`scrub`], which rewrites `Bearer …` to `Bearer` and caps the length.
//! 3. **A preview key sends nothing.** The literal secrets `preview-resend` /
//!    `preview-sendgrid` return success without a network call, so the UI can
//!    demo the flow with no vendor account. This is not a mock of the send
//!    path — the real path is untouched; it merely never runs.

use serde::Deserialize;

use serde::Serialize;

/// How long a vendor request may take before it is abandoned. Matches TS
/// `AbortSignal.timeout(15000)`.
const TIMEOUT_SECS: u64 = 15;

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize)]
#[serde(rename_all = "lowercase")]
pub enum Vendor {
    Resend,
    Sendgrid,
}

impl Vendor {
    /// Parse the vendor name. The TS validator maps anything unrecognised to
    /// "" and then rejects it, so an unknown vendor is an error, not a default.
    pub fn parse(name: &str) -> Option<Vendor> {
        match name {
            "resend" => Some(Vendor::Resend),
            "sendgrid" => Some(Vendor::Sendgrid),
            _ => None,
        }
    }

    pub fn as_str(&self) -> &'static str {
        match self {
            Vendor::Resend => "resend",
            Vendor::Sendgrid => "sendgrid",
        }
    }
}

/// The vendor's own spelling, for a message a user reads.
fn display_name(vendor: Vendor) -> &'static str {
    match vendor {
        Vendor::Resend => "Resend",
        Vendor::Sendgrid => "SendGrid",
    }
}

#[derive(Debug, Clone, Serialize)]
pub struct Sent {
    pub ok: bool,
    /// True when no vendor was called because a preview key was supplied.
    pub preview: bool,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub error: Option<String>,
}

impl Sent {
    fn preview() -> Sent {
        Sent {
            ok: true,
            preview: true,
            error: None,
        }
    }
    fn delivered() -> Sent {
        Sent {
            ok: true,
            preview: false,
            error: None,
        }
    }
    fn failed(msg: String) -> Sent {
        Sent {
            ok: false,
            preview: false,
            error: Some(scrub(&msg)),
        }
    }
}

/// Strip a bearer token from a message and cap its length, so a vendor error
/// body can never put a key in a log, an API response or the UI.
pub fn scrub(message: &str) -> String {
    // Case-insensitive rewrite of "bearer <token>" → "bearer".
    let mut out = String::with_capacity(message.len());
    let lower = message.to_lowercase();
    let mut i = 0usize;
    while i < message.len() {
        if lower[i..].starts_with("bearer") {
            out.push_str(&message[i..i + 6]);
            i += 6;
            // Eat the whitespace separator and the token after it.
            let bytes = message.as_bytes();
            while i < message.len() && (bytes[i] == b' ' || bytes[i] == b'\t') {
                i += 1;
            }
            while i < message.len() {
                let c = bytes[i] as char;
                if c.is_whitespace() || c == '"' || c == '\'' || c == ',' || c == '}' {
                    break;
                }
                i += 1;
            }
        } else {
            // Advance one char, respecting UTF-8 boundaries.
            let step = message[i..]
                .chars()
                .next()
                .map(|c| c.len_utf8())
                .unwrap_or(1);
            out.push_str(&message[i..i + step]);
            i += step;
        }
    }
    out.chars().take(240).collect()
}

/// The same shape the TS validator accepts: one `@`, a dot in the domain, and a
/// sane length. Deliberately not a full RFC 5322 parser — the vendor is the
/// authority on deliverability and this only catches obvious typos.
pub fn email_ok(value: &str) -> bool {
    if value.is_empty() || value.len() > 200 || value.chars().any(|c| c.is_whitespace()) {
        return false;
    }
    let parts: Vec<&str> = value.split('@').collect();
    if parts.len() != 2 {
        return false;
    }
    let (local, domain) = (parts[0], parts[1]);
    !local.is_empty()
        && domain.contains('.')
        && !domain.starts_with('.')
        && !domain.ends_with('.')
        && domain.len() > 2
}

/// Field bounds from the TS validator, shared by both senders.
fn secret_ok(secret: &str) -> bool {
    (8..=200).contains(&secret.len())
}

/// Which endpoint a vendor posts to.
fn endpoint(vendor: Vendor) -> &'static str {
    match vendor {
        Vendor::Resend => "https://api.resend.com/emails",
        Vendor::Sendgrid => "https://api.sendgrid.com/v3/mail/send",
    }
}

/// Build the vendor-specific request body. Kept separate from the send so the
/// payload shape is unit-testable without a network.
fn payload(vendor: Vendor, from: &str, to: &str, subject: &str, text: &str) -> serde_json::Value {
    match vendor {
        Vendor::Resend => serde_json::json!({
            "from": from,
            "to": [to],
            "subject": subject,
            "text": text,
        }),
        Vendor::Sendgrid => serde_json::json!({
            "personalizations": [{ "to": [{ "email": to }] }],
            "from": { "email": from },
            "subject": subject,
            "content": [{ "type": "text/plain", "value": text }],
        }),
    }
}

/// Send one plain-text message.
///
/// `what` names the message in the error text ("email" / "digest"), matching the
/// TS phrasing so a user reading either pipeline's output sees the same words.
async fn send(
    vendor: Vendor,
    secret: &str,
    from: &str,
    to: &str,
    subject: &str,
    text: &str,
    what: &str,
) -> Sent {
    // The preview short-circuit: no vendor call, no key needed. The literal is
    // `preview-<vendor>`, built from the vendor name so the two cannot drift.
    if secret == format!("preview-{}", vendor.as_str()) {
        return Sent::preview();
    }
    let client = crate::ghost::client();
    let body = payload(vendor, from, to, subject, text);
    let resp = match client
        .post(endpoint(vendor))
        // `redirect: manual` in TS is `redirect::Policy::none()` here: a 3xx is
        // returned to us instead of being followed, so we can refuse it.
        .timeout(std::time::Duration::from_secs(TIMEOUT_SECS))
        .header("Authorization", format!("Bearer {secret}"))
        .header("Content-Type", "application/json")
        .json(&body)
        .send()
        .await
    {
        Ok(r) => r,
        Err(e) => return Sent::failed(e.to_string()),
    };
    let status = resp.status().as_u16();
    if (300..400).contains(&status) {
        return Sent::failed(format!("{} redirected. Blocked.", display_name(vendor)));
    }
    // SendGrid answers 202 Accepted. Resend answers any 2xx.
    let ok = match vendor {
        Vendor::Resend => (200..300).contains(&status),
        Vendor::Sendgrid => status == 202 || (200..300).contains(&status),
    };
    if !ok {
        return Sent::failed(format!(
            "{} returned HTTP {status}. The {what} was not sent.",
            display_name(vendor)
        ));
    }
    Sent::delivered()
}

/// Validate the pieces both senders need. Returns the scrubbed error message a
/// user should see, or Ok when the request may proceed.
fn validate_common(
    vendor: Option<Vendor>,
    secret: &str,
    from: &str,
    to: &str,
    noun: &str,
) -> Result<Vendor, String> {
    let vendor = vendor.ok_or_else(|| "Choose Resend or SendGrid.".to_string())?;
    if !secret_ok(secret) {
        return Err(format!("Add an email key before sending{noun}."));
    }
    if !email_ok(from) || !email_ok(to) {
        return Err("From and to must be email addresses.".to_string());
    }
    Ok(vendor)
}

/// The pieces of a verification link this module must check. Parsed with a
/// regex rather than a URL crate: no new dependency, and the checks are only
/// about scheme, path suffix and the presence of a token.
struct VerifyLink {
    scheme: String,
    path: String,
    has_token: bool,
}

fn parse_verify_link(raw: &str) -> Option<VerifyLink> {
    // scheme://host/path?query#frag  — permissive on host, strict on the parts
    // that matter. A string with no scheme is not a URL.
    let re = regex::Regex::new(r"^([A-Za-z][A-Za-z0-9+.\-]*)://([^/?#]+)([^?#]*)(?:\?([^#]*))?")
        .expect("verify link regex");
    let caps = re.captures(raw)?;
    let scheme = caps.get(1)?.as_str().to_lowercase();
    let host = caps.get(2)?.as_str();
    if host.is_empty() {
        return None;
    }
    let path = caps
        .get(3)
        .map(|m| m.as_str().to_string())
        .unwrap_or_default();
    let query = caps.get(4).map(|m| m.as_str()).unwrap_or("");
    // Match the TS check: a `token` parameter with a non-empty value.
    let has_token = query.split('&').any(|pair| {
        let mut it = pair.splitn(2, '=');
        matches!((it.next(), it.next()), (Some("token"), Some(v)) if !v.is_empty())
    });
    Some(VerifyLink {
        scheme,
        path,
        has_token,
    })
}

/// Ask a vendor to send the address-verification letter.
///
/// `verify_url` must be the real link the reader will click: an http(s) URL
/// ending in `/verify-email` and carrying a `token`. That is enforced here
/// rather than at the call site because a bad link produces a letter that
/// cannot work, and the vendor has already accepted the send by then.
pub async fn send_verification(
    vendor: &str,
    secret: &str,
    from: &str,
    to: &str,
    verify_url: &str,
) -> Sent {
    let vendor = match validate_common(
        Vendor::parse(vendor),
        secret.trim(),
        from.trim(),
        to.trim(),
        "",
    ) {
        Ok(v) => v,
        Err(e) => return Sent::failed(e),
    };
    let link = match parse_verify_link(verify_url.trim()) {
        Some(l) => l,
        None => return Sent::failed("The verification link is not a URL.".to_string()),
    };
    if link.scheme != "https" && link.scheme != "http" {
        return Sent::failed("The verification link must be http or https.".to_string());
    }
    if !link.path.ends_with("/verify-email") || !link.has_token {
        return Sent::failed("The verification link is missing its token.".to_string());
    }
    let (from, to) = (from.trim(), to.trim());
    let text = format!(
        "Verify {to} for this studio.\n\nOpen this link:\n{}\n\n\
         It expires in 30 minutes. If you did not ask for this, ignore it.",
        verify_url.trim()
    );
    send(
        vendor,
        secret.trim(),
        from,
        to,
        "Verify your studio email",
        &text,
        "email",
    )
    .await
}

/// Send a notification digest. `body` is capped, matching the TS slice, so a
/// runaway digest cannot be turned into a giant vendor request.
pub async fn send_digest(vendor: &str, secret: &str, from: &str, to: &str, body: &str) -> Sent {
    let vendor = match validate_common(
        Vendor::parse(vendor),
        secret.trim(),
        from.trim(),
        to.trim(),
        " a digest",
    ) {
        Ok(v) => v,
        Err(e) => return Sent::failed(e),
    };
    let body: String = body.trim().chars().take(8000).collect();
    if body.is_empty() {
        return Sent::failed("There is nothing to put in the digest.".to_string());
    }
    send(
        vendor,
        secret.trim(),
        from.trim(),
        to.trim(),
        "Studio notification digest",
        &body,
        "digest",
    )
    .await
}

use crate::ApiError;
use axum::Json;

/// Send a verification letter. The key is used for this one request and
/// discarded; it is never written to the database.
pub(crate) async fn send_email_verification(
    Json(req): Json<SendEmailRequest>,
) -> Result<Json<crate::email::Sent>, ApiError> {
    let verify_url = req
        .verify_url
        .as_deref()
        .ok_or(ApiError::BadRequest("verify_url is required"))?;
    Ok(Json(
        crate::email::send_verification(&req.vendor, &req.secret, &req.from, &req.to, verify_url)
            .await,
    ))
}
/// Send a notification digest.
pub(crate) async fn send_email_digest(
    Json(req): Json<SendEmailRequest>,
) -> Result<Json<crate::email::Sent>, ApiError> {
    let body = req
        .body
        .as_deref()
        .ok_or(ApiError::BadRequest("body is required"))?;
    Ok(Json(
        crate::email::send_digest(&req.vendor, &req.secret, &req.from, &req.to, body).await,
    ))
}

#[derive(Deserialize)]
pub(crate) struct SendEmailRequest {
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

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn the_error_scrubber_removes_a_bearer_token() {
        // A vendor echoing the request headers must not put the key anywhere.
        let scrubbed = scrub("denied for header Authorization: Bearer sk_live_abc123XYZ done");
        assert!(!scrubbed.contains("sk_live_abc123XYZ"), "{scrubbed}");
        assert!(scrubbed.contains("Bearer"), "{scrubbed}");
        // Case-insensitive: a lowercased echo still gets scrubbed.
        let scrubbed = scrub("authorization: bearer re_1234567890!");
        assert!(!scrubbed.contains("re_1234567890"), "{scrubbed}");
        // Length is capped.
        assert!(scrub(&"x".repeat(1000)).chars().count() <= 240);
    }

    #[test]
    fn a_multibyte_message_survives_scrubbing() {
        // Slicing on byte offsets would panic or corrupt here.
        let scrubbed = scrub("বাংলা Bearer secret123 টোকেন");
        assert!(!scrubbed.contains("secret123"), "{scrubbed}");
        assert!(scrubbed.contains("বাংলা"), "{scrubbed}");
    }

    #[test]
    fn email_accepts_the_ordinary_and_refuses_the_obvious() {
        assert!(email_ok("writer@example.com"));
        assert!(email_ok("a.b+tag@sub.example.co"));
        // No @, no dot, whitespace, over-length, empty local part.
        assert!(!email_ok("writer"));
        assert!(!email_ok("writer@example"));
        assert!(!email_ok("wri ter@example.com"));
        assert!(!email_ok("@example.com"));
        assert!(!email_ok(&format!("{}@example.com", "x".repeat(200))));
    }

    #[test]
    fn an_unknown_vendor_is_an_error_not_a_default() {
        assert_eq!(Vendor::parse("resend"), Some(Vendor::Resend));
        assert_eq!(Vendor::parse("sendgrid"), Some(Vendor::Sendgrid));
        // The TS validator maps anything else to "" and rejects it, so a typo
        // must not silently become Resend.
        assert_eq!(Vendor::parse("Resend"), None);
        assert_eq!(Vendor::parse("mailgun"), None);
        assert_eq!(Vendor::parse(""), None);
    }

    #[test]
    fn each_vendor_gets_its_own_payload_shape() {
        let resend = payload(Vendor::Resend, "a@b.com", "c@d.com", "S", "T");
        assert_eq!(resend["from"], "a@b.com");
        assert_eq!(resend["to"][0], "c@d.com");
        assert_eq!(resend["text"], "T");

        let sg = payload(Vendor::Sendgrid, "a@b.com", "c@d.com", "S", "T");
        assert_eq!(sg["personalizations"][0]["to"][0]["email"], "c@d.com");
        assert_eq!(sg["from"]["email"], "a@b.com");
        assert_eq!(sg["content"][0]["type"], "text/plain");
        assert_eq!(sg["content"][0]["value"], "T");
        // The wrong vendor must not receive the other's shape.
        assert!(sg.get("text").is_none());
        assert!(resend.get("personalizations").is_none());
    }

    #[tokio::test]
    async fn a_preview_key_sends_nothing_but_reports_success() {
        // No network is reachable in tests; a preview send must not try.
        let out = send_verification(
            "resend",
            "preview-resend",
            "from@example.com",
            "to@example.com",
            "https://app.example.com/verify-email?token=abc",
        )
        .await;
        assert!(out.ok);
        assert!(out.preview, "a preview send must be flagged as a preview");
        assert!(out.error.is_none());
    }

    #[tokio::test]
    async fn validation_happens_before_any_network_call() {
        let cases: Vec<(&str, &str, &str, &str, &str, &str)> = vec![
            // vendor, secret, from, to, url, expected fragment
            (
                "mailgun",
                "realkey12345",
                "a@b.com",
                "c@d.com",
                "https://x.com/verify-email?token=t",
                "Choose Resend",
            ),
            (
                "resend",
                "short",
                "a@b.com",
                "c@d.com",
                "https://x.com/verify-email?token=t",
                "Add an email key",
            ),
            (
                "resend",
                "realkey12345",
                "notanemail",
                "c@d.com",
                "https://x.com/verify-email?token=t",
                "email addresses",
            ),
            (
                "resend",
                "realkey12345",
                "a@b.com",
                "c@d.com",
                "not-a-url",
                "not a URL",
            ),
            (
                "resend",
                "realkey12345",
                "a@b.com",
                "c@d.com",
                "ftp://x.com/verify-email?token=t",
                "http or https",
            ),
            (
                "resend",
                "realkey12345",
                "a@b.com",
                "c@d.com",
                "https://x.com/wrong?token=t",
                "missing its token",
            ),
            (
                "resend",
                "realkey12345",
                "a@b.com",
                "c@d.com",
                "https://x.com/verify-email",
                "missing its token",
            ),
        ];
        for (vendor, secret, from, to, url, fragment) in cases {
            let out = send_verification(vendor, secret, from, to, url).await;
            assert!(!out.ok, "should have been rejected: {fragment}");
            let err = out.error.unwrap_or_default();
            assert!(err.contains(fragment), "expected {fragment:?} in {err:?}");
        }
    }

    #[tokio::test]
    async fn an_empty_digest_is_refused_before_sending() {
        let out = send_digest("resend", "realkey12345", "a@b.com", "c@d.com", "   ").await;
        assert!(!out.ok);
        assert!(
            out.error.unwrap_or_default().contains("nothing to put"),
            "an empty digest must not reach the vendor"
        );
    }
}
