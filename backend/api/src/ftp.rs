//! FTPS (explicit TLS) uploads and the IndexNow submission that depends on them.
//!
//! cPanel only accepts a *protected* data channel, and it pins TLS 1.2: the data
//! connection must resume the control connection's TLS session or the server
//! aborts the transfer with "TLS session reuse required". That is why the client
//! config is built once per request and reused for every data connection —
//! rustls keeps the ticket cache inside the config, so the reuse happens by
//! construction rather than by hand.
//!
//! The certificate is not verified, matching the previous behaviour: shared
//! cPanel hosts routinely present a certificate for the provider's hostname
//! rather than the customer's domain, and the connection is already carrying
//! credentials the operator entered for that exact host.

use std::sync::Arc;
use std::time::{Duration, Instant};

use rustls_pki_types::{CertificateDer, ServerName, UnixTime};
use serde::Deserialize;
use serde_json::{json, Value};
use tokio::io::{AsyncReadExt, AsyncWriteExt};
use tokio::net::TcpStream;
use tokio_rustls::client::TlsStream;
use tokio_rustls::rustls::client::danger::{
    HandshakeSignatureValid, ServerCertVerified, ServerCertVerifier,
};
use tokio_rustls::rustls::crypto::CryptoProvider;
use tokio_rustls::rustls::{ClientConfig, DigitallySignedStruct, SignatureScheme};
use tokio_rustls::TlsConnector;

const IO_TIMEOUT: Duration = Duration::from_secs(20);

#[derive(Debug)]
struct AcceptAnyCertificate {
    provider: Arc<CryptoProvider>,
}

impl ServerCertVerifier for AcceptAnyCertificate {
    fn verify_server_cert(
        &self,
        _end_entity: &CertificateDer<'_>,
        _intermediates: &[CertificateDer<'_>],
        _server_name: &ServerName<'_>,
        _ocsp: &[u8],
        _now: UnixTime,
    ) -> Result<ServerCertVerified, tokio_rustls::rustls::Error> {
        Ok(ServerCertVerified::assertion())
    }

    fn verify_tls12_signature(
        &self,
        _message: &[u8],
        _cert: &CertificateDer<'_>,
        _dss: &DigitallySignedStruct,
    ) -> Result<HandshakeSignatureValid, tokio_rustls::rustls::Error> {
        Ok(HandshakeSignatureValid::assertion())
    }

    fn verify_tls13_signature(
        &self,
        _message: &[u8],
        _cert: &CertificateDer<'_>,
        _dss: &DigitallySignedStruct,
    ) -> Result<HandshakeSignatureValid, tokio_rustls::rustls::Error> {
        Ok(HandshakeSignatureValid::assertion())
    }

    fn supported_verify_schemes(&self) -> Vec<SignatureScheme> {
        self.provider
            .signature_verification_algorithms
            .supported_schemes()
    }
}

fn tls_config() -> Arc<ClientConfig> {
    let provider = Arc::new(tokio_rustls::rustls::crypto::ring::default_provider());
    let mut config = ClientConfig::builder_with_provider(provider.clone())
        .with_protocol_versions(&[&tokio_rustls::rustls::version::TLS12])
        .expect("TLS 1.2 is compiled in")
        .dangerous()
        .with_custom_certificate_verifier(Arc::new(AcceptAnyCertificate { provider }))
        .with_no_client_auth();
    // The ticket cache lives in the config, so every data connection built from
    // it presents the control connection's session — what cPanel requires.
    config.resumption = tokio_rustls::rustls::client::Resumption::in_memory_sessions(32);
    Arc::new(config)
}

fn server_name(host: &str) -> Option<ServerName<'static>> {
    if let Ok(ip) = host.parse::<std::net::IpAddr>() {
        return Some(ServerName::IpAddress(ip.into()));
    }
    ServerName::try_from(host.to_string()).ok()
}

type Stream = TlsStream<TcpStream>;

/// Read one FTP reply, following multi-line replies (`230-...` until `230 `).
async fn read_reply(stream: &mut Stream) -> Result<String, String> {
    let mut reply = String::new();
    loop {
        let mut line = Vec::new();
        let mut byte = [0u8; 1];
        loop {
            let n = stream.read(&mut byte).await.map_err(|e| e.to_string())?;
            if n == 0 {
                return Err("The server closed the connection.".to_string());
            }
            if byte[0] == b'\n' {
                break;
            }
            if byte[0] != b'\r' {
                line.push(byte[0]);
            }
            if line.len() > 4096 {
                return Err("The server sent an oversized reply.".to_string());
            }
        }
        let text = String::from_utf8_lossy(&line).to_string();
        let continued = text.len() > 3 && text.as_bytes()[3] == b'-';
        reply.push_str(&text);
        reply.push('\n');
        if !continued {
            return Ok(reply);
        }
    }
}

async fn send(stream: &mut Stream, line: &str) -> Result<String, String> {
    stream
        .write_all(format!("{line}\r\n").as_bytes())
        .await
        .map_err(|e| e.to_string())?;
    stream.flush().await.map_err(|e| e.to_string())?;
    read_reply(stream).await
}

fn is_ok(reply: &str, codes: &[&str]) -> bool {
    codes.iter().any(|code| reply.starts_with(code))
}

#[derive(Debug, Deserialize, Clone)]
pub struct FtpTarget {
    #[serde(default)]
    pub host: String,
    #[serde(default)]
    pub user: String,
    #[serde(default)]
    pub password: String,
    #[serde(default)]
    pub port: Option<u16>,
    #[serde(default)]
    pub path: Option<String>,
}

impl FtpTarget {
    fn port(&self) -> u16 {
        self.port.filter(|p| *p > 0).unwrap_or(21)
    }

    fn path(&self) -> String {
        let path = self.path.clone().unwrap_or_else(|| "/".to_string());
        if path.trim().is_empty() {
            "/".to_string()
        } else {
            path
        }
    }
}

/// Loopback targets are blocked unless the operator opts in, so the API cannot
/// be used to reach services on its own network. The test harness sets this.
fn host_allowed(host: &str) -> bool {
    if host.is_empty() || host.contains('/') || host.contains(' ') {
        return false;
    }
    let private = crate::ghost::is_private_host(host);
    if private {
        return std::env::var("GAW_FTP_ALLOW_PRIVATE").ok().as_deref() == Some("1");
    }
    true
}

async fn open(target: &FtpTarget) -> Result<(Stream, Arc<ClientConfig>), String> {
    if !host_allowed(&target.host) {
        return Err("That host is not allowed.".to_string());
    }
    if target.user.is_empty() || target.password.is_empty() {
        return Err("FTP needs a username and password.".to_string());
    }
    let address = format!("{}:{}", target.host, target.port());
    let tcp = tokio::time::timeout(IO_TIMEOUT, TcpStream::connect(&address))
        .await
        .map_err(|_| "The FTP host did not answer.".to_string())?
        .map_err(|e| format!("Could not reach {}: {}", target.host, redact(&e.to_string())))?;

    // One config per request: its ticket cache is what makes the data connection
    // resume the control connection's session.
    let config = tls_config();
    let connector = TlsConnector::from(config.clone());
    let name = server_name(&target.host).ok_or_else(|| "That host is not a valid name.".to_string())?;
    let mut plain = tcp;
    let greeting = read_plain(&mut plain).await?;
    if !is_ok(&greeting, &["220"]) {
        return Err(format!("The server refused the connection: {}", trim(&greeting)));
    }
    plain
        .write_all(b"AUTH TLS\r\n")
        .await
        .map_err(|e| e.to_string())?;
    let auth = read_plain(&mut plain).await?;
    if !is_ok(&auth, &["234"]) {
        return Err("The server does not offer explicit TLS.".to_string());
    }
    let mut stream = tokio::time::timeout(IO_TIMEOUT, connector.connect(name, plain))
        .await
        .map_err(|_| "The TLS handshake timed out.".to_string())?
        .map_err(|e| format!("The TLS handshake failed: {}", redact(&e.to_string())))?;

    let user = send(&mut stream, &format!("USER {}", target.user)).await?;
    if !is_ok(&user, &["331", "230"]) {
        return Err("The server refused that username.".to_string());
    }
    let pass = send(&mut stream, &format!("PASS {}", target.password)).await?;
    if !is_ok(&pass, &["230", "202"]) {
        return Err("The server refused that password.".to_string());
    }
    Ok((stream, config))
}

async fn read_plain(plain: &mut TcpStream) -> Result<String, String> {
    let mut line = Vec::new();
    let mut byte = [0u8; 1];
    loop {
        let n = tokio::time::timeout(IO_TIMEOUT, plain.read(&mut byte))
            .await
            .map_err(|_| "The server stopped answering.".to_string())?
            .map_err(|e| e.to_string())?;
        if n == 0 {
            return Err("The server closed the connection.".to_string());
        }
        if byte[0] == b'\n' {
            break;
        }
        if byte[0] != b'\r' {
            line.push(byte[0]);
        }
    }
    Ok(String::from_utf8_lossy(&line).to_string())
}

/// A password must never be echoed back in an error string.
fn redact(message: &str) -> String {
    let scrubbed = regex::Regex::new(r"(?i)PASS\s+\S+")
        .map(|re| re.replace_all(message, "PASS •••").to_string())
        .unwrap_or_else(|_| message.to_string());
    scrubbed.chars().take(320).collect()
}

fn trim(reply: &str) -> String {
    reply.lines().last().unwrap_or(reply).trim().to_string()
}

/// `227 Entering Passive Mode (h1,h2,h3,h4,p1,p2)`.
fn parse_pasv(reply: &str, fallback_host: &str) -> Option<(String, u16)> {
    let start = reply.find('(')?;
    let end = reply[start..].find(')')? + start;
    let parts: Vec<u16> = reply[start + 1..end]
        .split(',')
        .filter_map(|n| n.trim().parse::<u16>().ok())
        .collect();
    if parts.len() != 6 {
        return None;
    }
    let ip = format!("{}.{}.{}.{}", parts[0], parts[1], parts[2], parts[3]);
    let port = parts[4] * 256 + parts[5];
    // A server behind NAT reports its internal address; fall back to the host we
    // actually connected to.
    let host = if crate::ghost::is_private_host(&ip) {
        fallback_host.to_string()
    } else {
        ip
    };
    Some((host, port))
}

/// Open the data connection, resuming the control connection's TLS session.
async fn open_data(stream: &mut Stream, host: &str, config: &Arc<ClientConfig>) -> Result<Stream, String> {
    let reply = send(stream, "PASV").await?;
    if !is_ok(&reply, &["227"]) {
        return Err("The server refused a passive connection.".to_string());
    }
    let (data_host, port) = parse_pasv(&reply, host)
        .ok_or_else(|| "The server sent an unreadable passive address.".to_string())?;
    let tcp = tokio::time::timeout(IO_TIMEOUT, TcpStream::connect(format!("{data_host}:{port}")))
        .await
        .map_err(|_| "The data connection did not open (passive ports may be blocked).".to_string())?
        .map_err(|_| "The data connection was refused (passive ports may be blocked).".to_string())?;
    let connector = TlsConnector::from(config.clone());
    let name = server_name(host).ok_or_else(|| "That host is not a valid name.".to_string())?;
    tokio::time::timeout(IO_TIMEOUT, connector.connect(name, tcp))
        .await
        .map_err(|_| "The data TLS handshake timed out.".to_string())?
        .map_err(|e| format!("The data channel was refused: {}", redact(&e.to_string())))
}

async fn store_one(
    control: &mut Stream,
    host: &str,
    config: &Arc<ClientConfig>,
    name: &str,
    bytes: Vec<u8>,
) -> Result<(), String> {
    let mut data = open_data(control, host, config).await?;
    let started = send(control, &format!("STOR {name}")).await?;
    if !is_ok(&started, &["150", "125"]) {
        return Err(format!("The server refused to store {name}."));
    }
    data.write_all(&bytes).await.map_err(|e| e.to_string())?;
    data.flush().await.map_err(|e| e.to_string())?;
    data.shutdown().await.map_err(|e| e.to_string())?;
    drop(data);
    let done = read_reply(control).await?;
    if !is_ok(&done, &["226", "250"]) {
        return Err(format!("The upload of {name} did not complete."));
    }
    Ok(())
}

#[derive(Debug, Deserialize)]
pub struct UploadedFile {
    #[serde(default)]
    pub name: String,
    #[serde(default)]
    pub base64: String,
}

pub async fn upload(target: &FtpTarget, files: &[UploadedFile]) -> Value {
    let failure = |error: String| json!({ "ok": false, "error": error });
    if files.is_empty() {
        return failure("There are no files to upload.".to_string());
    }
    let (mut control, config) = match open(target).await {
        Ok(pair) => pair,
        Err(error) => return failure(error),
    };
    let result = async {
        attach_protected(&mut control).await?;
        enter(&mut control, &target.path()).await?;
        let mut made: Vec<String> = Vec::new();
        for file in files {
            if file.name.is_empty() || file.name.contains("..") {
                return Err(format!("Unsafe file name: {}", file.name));
            }
            let parts: Vec<&str> = file.name.split('/').collect();
            let mut dir = String::new();
            for part in &parts[..parts.len().saturating_sub(1)] {
                dir = if dir.is_empty() {
                    part.to_string()
                } else {
                    format!("{}/{}", dir, part)
                };
                if made.contains(&dir) {
                    continue;
                }
                let reply = send(&mut control, &format!("MKD {dir}")).await?;
                made.push(dir.clone());
                if !is_ok(&reply, &["257", "250", "550"]) {
                    return Err(format!("Could not create the remote directory {dir}."));
                }
            }
            let bytes = base64_decode(&file.base64)?;
            store_one(&mut control, &target.host, &config, &file.name, bytes).await?;
        }
        Ok::<(), String>(())
    }
    .await;
    let _ = send(&mut control, "QUIT").await;
    match result {
        Ok(()) => json!({ "ok": true, "files": files.len() }),
        Err(error) => failure(error),
    }
}

fn base64_decode(text: &str) -> Result<Vec<u8>, String> {
    use base64::Engine as _;
    base64::engine::general_purpose::STANDARD
        .decode(text)
        .map_err(|_| "A file in the upload is not valid base64.".to_string())
}

async fn attach_protected(control: &mut Stream) -> Result<(), String> {
    let pbsz = send(control, "PBSZ 0").await?;
    if !is_ok(&pbsz, &["200"]) {
        return Err("The server refused to protect the data channel.".to_string());
    }
    let prot = send(control, "PROT P").await?;
    if !is_ok(&prot, &["200"]) {
        return Err("The server refused a protected data channel.".to_string());
    }
    let type_reply = send(control, "TYPE I").await?;
    if !is_ok(&type_reply, &["200"]) {
        return Err("The server refused a binary transfer.".to_string());
    }
    Ok(())
}

async fn enter(control: &mut Stream, path: &str) -> Result<(), String> {
    if path.is_empty() || path == "/" {
        return Ok(());
    }
    let reply = send(control, &format!("CWD {path}")).await?;
    if !is_ok(&reply, &["250"]) {
        return Err("Could not open the remote directory.".to_string());
    }
    Ok(())
}

#[derive(Debug, Deserialize)]
pub struct LoginRequest {
    #[serde(flatten)]
    pub target: FtpTarget,
    /// The saved connection's `via`. The sign-in test always probes FTPS
    /// first and falls back to SFTP itself, so this is accepted for
    /// compatibility and the result's `via` is what callers should store.
    #[serde(default)]
    #[allow(dead_code)]
    pub via: Option<String>,
}

fn step(name: &str, started: Instant, ok: bool, detail: String) -> Value {
    json!({
        "name": name,
        "ok": ok,
        "ms": started.elapsed().as_millis() as u64,
        "detail": detail,
    })
}

/// Sign in and read the directory: this is the connection test, not a write.
pub async fn test_login(req: &LoginRequest) -> Value {
    let mut steps: Vec<Value> = Vec::new();
    let target = &req.target;
    let connect_started = Instant::now();
    let opened = open(target).await;
    let (mut control, config) = match opened {
        Ok(pair) => {
            steps.push(step(
                "connect",
                connect_started,
                true,
                format!("Signed in to {}:{}", target.host, target.port()),
            ));
            pair
        }
        Err(error) => {
            steps.push(step("connect", connect_started, false, error.clone()));
            return json!({ "ok": false, "error": error, "steps": steps });
        }
    };
    let protected_started = Instant::now();
    match attach_protected(&mut control).await {
        Ok(()) => steps.push(step("PROT P", protected_started, true, "Protected data channel.".into())),
        Err(error) => {
            steps.push(step("PROT P", protected_started, false, error.clone()));
            let _ = send(&mut control, "QUIT").await;
            return json!({ "ok": false, "error": error, "steps": steps });
        }
    }
    let path = target.path();
    let cwd_started = Instant::now();
    match enter(&mut control, &path).await {
        Ok(()) => steps.push(step("CWD", cwd_started, true, format!("Opened {path}"))),
        Err(error) => {
            steps.push(step("CWD", cwd_started, false, error.clone()));
            let _ = send(&mut control, "QUIT").await;
            return json!({ "ok": false, "error": error, "steps": steps });
        }
    }
    let list_started = Instant::now();
    let listing = match open_data(&mut control, &target.host, &config).await {
        Ok(mut data) => match send(&mut control, "LIST").await {
            Ok(reply) if is_ok(&reply, &["150", "125"]) => {
                let mut buf = Vec::new();
                let _ = data.read_to_end(&mut buf).await;
                let text = String::from_utf8_lossy(&buf).to_string();
                let _ = read_reply(&mut control).await;
                Ok(text)
            }
            Ok(_) => Err("The server refused to list the directory.".to_string()),
            Err(error) => Err(error),
        },
        Err(error) => Err(error),
    };
    match listing {
        Ok(listing) => {
            let entries = listing
                .lines()
                .map(str::trim)
                .filter(|line| !line.is_empty())
                .count();
            steps.push(step(
                "LIST",
                list_started,
                true,
                format!("{entries} entries readable in {path}"),
            ));
            let _ = send(&mut control, "QUIT").await;
            json!({
                "ok": true,
                "steps": steps,
                "via": "ftps",
                "user": target.user,
                "banner": format!("cPanel verified over FTPS ({}:{}, {} readable)", target.host, target.port(), path),
            })
        }
        Err(error) => {
            // The old app did the same thing: passive ports blocked only the
            // data channel, so the sign-in counts and the connection is
            // re-proved over SFTP on the dedicated cPanel port.
            steps.push(step(
                "LIST",
                list_started,
                false,
                format!("Passive FTP failed: {error}. Trying SFTP on port {SFTP_PORT}."),
            ));
            let _ = send(&mut control, "QUIT").await;
            drop(control);
            let sftp_started = Instant::now();
            match sftp_list(&target.host, SFTP_PORT, &target.user, &target.password, &path).await {
                Ok(names) => {
                    steps.push(step(
                        "LIST (SFTP)",
                        sftp_started,
                        true,
                        format!(
                            "{} entries over SFTP port {}. Passive FTP is blocked, so files use SFTP.",
                            names.len(),
                            SFTP_PORT
                        ),
                    ));
                    json!({
                        "ok": true,
                        "steps": steps,
                        "via": "sftp",
                        "user": target.user,
                        "banner": format!(
                            "cPanel verified over SFTP ({}:{}, {} readable). Passive FTP ports are blocked.",
                            target.host, SFTP_PORT, path
                        ),
                    })
                }
                Err(sftp_error) => {
                    steps.push(step("LIST (SFTP)", sftp_started, false, sftp_error.clone()));
                    json!({
                        "ok": false,
                        "error": format!(
                            "Passive FTP failed ({error}) and the SFTP fallback failed: {sftp_error}"
                        ),
                        "steps": steps,
                    })
                }
            }
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn a_passive_reply_is_parsed_into_host_and_port() {
        let (host, port) = parse_pasv(
            "227 Entering Passive Mode (93,184,216,34,195,149).",
            "example.com",
        )
        .expect("pasv");
        assert_eq!(host, "93.184.216.34");
        assert_eq!(port, 195 * 256 + 149);
    }

    #[test]
    fn a_nat_private_address_falls_back_to_the_connected_host() {
        let (host, _) = parse_pasv("227 Entering Passive Mode (10,0,0,5,4,1).", "example.com")
            .expect("pasv");
        assert_eq!(host, "example.com");
    }

    #[test]
    fn an_unreadable_passive_reply_is_refused() {
        assert!(parse_pasv("227 Entering Passive Mode", "example.com").is_none());
        assert!(parse_pasv("227 (1,2,3).", "example.com").is_none());
    }

    #[test]
    fn a_password_can_never_reach_an_error_string() {
        assert!(!redact("PASS hunter2 failed").contains("hunter2"));
    }

    #[test]
    fn a_loopback_host_is_refused_unless_the_operator_opts_in() {
        assert!(!host_allowed("127.0.0.1"));
        assert!(!host_allowed(""));
        assert!(!host_allowed("host/with/slash"));
        assert!(host_allowed("ftp.example.com"));
    }
}

/// The IndexNow key file name: `<key>.txt`, key limited to 8–128 safe characters.
pub fn index_now_key_name(key: &str) -> Option<String> {
    let ok = key.len() >= 8
        && key.len() <= 128
        && key
            .chars()
            .all(|c| c.is_ascii_alphanumeric() || c == '-');
    ok.then(|| format!("{key}.txt"))
}

#[derive(Debug, Deserialize)]
pub struct IndexNowRequest {
    #[serde(default)]
    pub public_url: String,
    #[serde(default)]
    pub key: String,
    #[serde(default)]
    pub urls: Vec<String>,
    #[serde(default)]
    pub verified: bool,
    #[serde(default)]
    pub ftp: Option<FtpTarget>,
}

/// Upload the key file over FTPS, prove it is publicly served, then submit.
///
/// Bing is only called once the key file is confirmed live — a submission whose
/// key cannot be fetched is rejected anyway, and calling early would just teach
/// the engine that this host is broken.
pub async fn submit_index_now(req: &IndexNowRequest) -> Value {
    let failure = |status: u16, error: String| json!({ "ok": false, "status": status, "error": error });
    if !req.public_url.starts_with("https://") {
        return failure(0, "Set a public https URL before submitting IndexNow.".into());
    }
    let Some(name) = index_now_key_name(&req.key) else {
        return failure(0, "IndexNow key must be 8–128 letters, numbers, or dashes.".into());
    };
    if req.urls.is_empty() {
        return failure(0, "There are no article URLs to submit.".into());
    }
    let Some(target) = req.ftp.as_ref() else {
        return failure(
            0,
            "cPanel hosting is not verified. Verify Explicit-TLS FTPS on Connections before submitting IndexNow. Bing was not called.".into(),
        );
    };
    if !req.verified || target.host.is_empty() {
        return failure(
            0,
            "cPanel hosting is not verified. Verify Explicit-TLS FTPS on Connections before submitting IndexNow. Bing was not called.".into(),
        );
    }
    let base = req.public_url.trim_end_matches('/').to_string();
    let Some(host) = url_host(&base) else {
        return failure(0, "That public URL is not usable.".into());
    };

    let file = UploadedFile {
        name: name.clone(),
        base64: {
            use base64::Engine as _;
            base64::engine::general_purpose::STANDARD.encode(req.key.as_bytes())
        },
    };
    let uploaded = upload(target, std::slice::from_ref(&file)).await;
    if uploaded.get("ok").and_then(|v| v.as_bool()) != Some(true) {
        let detail = uploaded
            .get("error")
            .and_then(|v| v.as_str())
            .unwrap_or("The key file was not uploaded.");
        return failure(0, format!("The key file was not uploaded. {detail} Bing was not called."));
    }

    let key_location = format!("{base}/{name}");
    let probe = reqwest::Client::new()
        .get(&key_location)
        .header("Cache-Control", "no-store")
        .send()
        .await;
    match probe {
        Ok(response) => {
            let status = response.status().as_u16();
            if (300..400).contains(&status) {
                return failure(
                    status,
                    format!("The key file at {key_location} redirected. Bing was not called."),
                );
            }
            let body = response.text().await.unwrap_or_default();
            if status != 200 || body.trim() != req.key {
                return failure(
                    status,
                    format!("The key file at {key_location} did not return the key (HTTP {status}). Bing was not called."),
                );
            }
        }
        Err(error) => {
            return failure(
                0,
                format!(
                    "The key file at {key_location} could not be fetched. Bing was not called. {}",
                    redact(&error.to_string())
                ),
            )
        }
    }

    let payload = json!({
        "host": host,
        "key": req.key,
        "keyLocation": key_location,
        "urlList": req.urls.iter().take(100).collect::<Vec<_>>(),
    });
    let response = reqwest::Client::new()
        .post("https://api.indexnow.org/indexnow")
        .header("Content-Type", "application/json; charset=utf-8")
        .body(payload.to_string())
        .send()
        .await;
    match response {
        Err(error) => failure(0, redact(&error.to_string())),
        Ok(response) => {
            let status = response.status().as_u16();
            if (300..400).contains(&status) {
                return failure(status, "IndexNow redirected. Blocked.".into());
            }
            if response.status().is_success() || status == 202 {
                json!({ "ok": true, "status": status, "keyLocation": key_location })
            } else {
                failure(status, format!("IndexNow returned HTTP {status}."))
            }
        }
    }
}

fn url_host(url: &str) -> Option<String> {
    let rest = url.strip_prefix("https://")?;
    let host = rest.split('/').next()?.split(':').next()?;
    if host.is_empty() || crate::ghost::is_private_host(host) {
        return None;
    }
    Some(host.to_string())
}

// ---------------------------------------------------------------------------
// SFTP fallback, port 65002.
//
// cPanel's passive FTP ports are routinely blocked by the hosting network even
// though the Explicit-TLS control connection signs in fine. The old app dealt
// with it by falling back to SFTP on the dedicated cPanel port (65002), which
// carries the same credentials. The fallback lives here, in Rust, with the
// russh client: connect with a 10 second guard (the old readyTimeout), open the
// `sftp` subsystem, and write files with CREATE|TRUNCATE|WRITE. Directory
// creation mirrors the FTPS path: each parent of every file name, once per
// batch. The server host key is accepted, matching how the operator uses
// cPanel: SSH to a host the operator just typed credentials for.
// ---------------------------------------------------------------------------

/// cPanel's standard-and-only SFTP port; the old client hard-coded it too.
pub const SFTP_PORT: u16 = 65002;

/// The old client's `readyTimeout` for opening the SFTP channel.
const SFTP_IO_TIMEOUT: Duration = Duration::from_secs(10);

/// Client handler: accept the server's host key (see the module note).
struct AcceptKey;

impl russh::client::Handler for AcceptKey {
    type Error = russh::Error;

    async fn check_server_key(
        &mut self,
        _server_public_key: &russh::keys::PublicKeyOrCertificate,
    ) -> Result<bool, Self::Error> {
        Ok(true)
    }
}

/// An open SFTP connection. The russh handle must outlive the sftp session —
/// dropping it closes the SSH transport the sftp stream rides on.
struct SftpConn {
    /// Dropped before `_handle`, so the sftp session goes away before the
    /// transport it rides on.
    session: russh_sftp::client::SftpSession,
    _handle: russh::client::Handle<AcceptKey>,
}

/// `127.0.0.1` is private, so the in-process E2E test must not route through
/// the env-guarded public entry points. These internal helpers carry no host
/// check — the public fns below apply [`host_allowed`] first.
async fn sftp_open(
    host: &str,
    port: u16,
    user: &str,
    password: &str,
) -> Result<SftpConn, String> {
    let config = Arc::new(russh::client::Config::default());
    let mut handle = tokio::time::timeout(
        SFTP_IO_TIMEOUT,
        russh::client::connect(config, (host.to_string(), port), AcceptKey),
    )
    .await
    .map_err(|_| "The host did not answer over SFTP within 10 seconds.")?
    .map_err(|_| "Could not open the SSH connection to that host.")?;
    if !handle
        .authenticate_password(user, password)
        .await
        .map_err(|_| "The SSH connection dropped during sign-in.")?
        .success()
    {
        return Err("SFTP refused that username or password.".to_string());
    }
    let channel = handle
        .channel_open_session()
        .await
        .map_err(|e| format!("Could not open the SFTP channel ({e})."))?;
    channel
        .request_subsystem(true, "sftp")
        .await
        .map_err(|e| format!("The server rejected the sftp subsystem ({e})."))?;
    let session = russh_sftp::client::SftpSession::new(channel.into_stream())
        .await
        .map_err(|e| format!("The SFTP session did not open: {e:?}"))?;
    Ok(SftpConn { session, _handle: handle })
}

/// The old `sftpList`: `readdir` of the target path, names only.
async fn sftp_list(
    host: &str,
    port: u16,
    user: &str,
    password: &str,
    path: &str,
) -> Result<Vec<String>, String> {
    let conn = sftp_open(host, port, user, password).await?;
    let target = if path.is_empty() || path == "/" {
        ".".to_string()
    } else {
        path.trim_start_matches('/').to_string()
    };
    let dir = conn.session.read_dir(&target).await.map_err(|e| {
        format!("SFTP could not list {target} ({e:?})")
    })?;
    Ok(dir.map(|entry| entry.file_name()).collect())
}

/// The old `sftpUpload`: mkdir each parent once per batch, then write with
/// CREATE|TRUNCATE|WRITE. The target path is stripped of slashes both ends.
async fn sftp_upload(
    host: &str,
    port: u16,
    user: &str,
    password: &str,
    path: &str,
    files: &[UploadedFile],
) -> Result<(), String> {
    use russh_sftp::protocol::OpenFlags;

    let conn = sftp_open(host, port, user, password).await?;
    let root = path.trim_matches('/').to_string();
    let mut made: Vec<String> = Vec::new();
    for file in files {
        if file.name.is_empty() || file.name.contains("..") {
            return Err(format!("Unsafe file name: {}", file.name));
        }
        let name = if root.is_empty() {
            file.name.clone()
        } else {
            format!("{}/{}", root, file.name)
        };
        let parts: Vec<&str> = name.split('/').collect();
        let mut dir = String::new();
        for part in &parts[..parts.len() - 1] {
            dir = if dir.is_empty() {
                part.to_string()
            } else {
                format!("{dir}/{part}")
            };
            if made.contains(&dir) {
                continue;
            }
            conn.session
                .create_dir(&dir)
                .await
                .map_err(|e| format!("SFTP could not create {dir} ({e:?})"))?;
            made.push(dir.clone());
        }
        let bytes = base64_decode(&file.base64)?;
        let mut f = conn.session
            .open_with_flags(&name, OpenFlags::CREATE | OpenFlags::TRUNCATE | OpenFlags::WRITE)
            .await
            .map_err(|e| format!("SFTP could not open {name} ({e:?})"))?;
        use tokio::io::AsyncWriteExt as _;
        f.write_all(&bytes)
            .await
            .map_err(|e| format!("SFTP could not write {name} ({e})"))?;
        f.shutdown()
            .await
            .map_err(|e| format!("SFTP could not finish {name} ({e})"))?;
    }
    Ok(())
}

/// Public SFTP upload: the same host guard as the FTPS path.
pub async fn sftp_upload_public(
    target: &FtpTarget,
    files: &[UploadedFile],
) -> Result<(), String> {
    if !host_allowed(&target.host) {
        return Err("That host is not allowed.".to_string());
    }
    if target.user.is_empty() || target.password.is_empty() {
        return Err("SFTP needs a username and password.".to_string());
    }
    if files.is_empty() {
        return Err("There are no files to upload.".to_string());
    }
    sftp_upload(&target.host, SFTP_PORT, &target.user, &target.password, &target.path(), files).await
}

/// The `via` the operator's saved connection says to use.
pub enum Via {
    Ftp,
    Sftp,
}

pub fn parse_via(via: Option<String>) -> Via {
    match via.as_deref() {
        Some("sftp") => Via::Sftp,
        _ => Via::Ftp,
    }
}

/// Dispatch on `via`: FTPS is still the default, SFTP when the test phase
/// found the passive ports blocked.
pub async fn upload_via(target: &FtpTarget, via: Option<String>, files: &[UploadedFile]) -> Value {
    match parse_via(via) {
        Via::Sftp => match sftp_upload_public(target, files).await {
            Ok(()) => json!({ "ok": true, "files": files.len(), "via": "sftp" }),
            Err(error) => json!({ "ok": false, "via": "sftp", "error": error }),
        },
        Via::Ftp => upload(target, files).await,
    }
}

#[cfg(test)]
mod index_tests {
    use super::*;

    #[test]
    fn an_index_now_key_must_be_a_safe_file_name() {
        assert_eq!(index_now_key_name("abc12345").as_deref(), Some("abc12345.txt"));
        assert!(index_now_key_name("short").is_none());
        assert!(index_now_key_name("has space").is_none());
        assert!(index_now_key_name("with/slash").is_none());
        assert!(index_now_key_name(&"a".repeat(129)).is_none());
    }

    #[test]
    fn a_public_url_host_is_extracted_and_private_ones_are_refused() {
        assert_eq!(url_host("https://example.com").as_deref(), Some("example.com"));
        assert_eq!(
            url_host("https://example.com/blog/x").as_deref(),
            Some("example.com")
        );
        assert!(url_host("https://127.0.0.1/x").is_none());
        assert!(url_host("http://example.com").is_none());
    }
}

#[cfg(test)]
mod sftp_tests {
    use super::*;
    use std::collections::HashMap;
    use std::net::SocketAddr;
    use russh::server::{Auth, Msg, Server as SshServer, Session};
    use russh::{Channel, ChannelId};
    use russh_sftp::protocol::{File, FileAttributes, Handle, Name, Status, StatusCode, Version};
    use tokio::net::TcpListener;
    use tokio::sync::Mutex;

    /// What the fake server has seen on disk. Shared with the test so the test
    /// can assert on it after the client closes the connection.
    #[derive(Clone, Default)]
    struct World {
        dirs: Arc<Mutex<HashMap<String, bool>>>,
        files: Arc<Mutex<HashMap<String, Vec<u8>>>>,
    }

    struct SshServerForTest {
        world: World,
    }

    impl SshServerForTest {
        fn default_world() -> (Self, World) {
            let world = World::default();
            (Self { world: world.clone() }, world)
        }
    }

    impl russh::server::Server for SshServerForTest {
        type Handler = SshSessionForTest;

        fn new_client(&mut self, _: Option<SocketAddr>) -> Self::Handler {
            SshSessionForTest {
                world: self.world.clone(),
                channels: HashMap::new(),
            }
        }
    }

    struct SshSessionForTest {
        world: World,
        channels: HashMap<ChannelId, Channel<Msg>>,
    }

    impl russh::server::Handler for SshSessionForTest {
        type Error = russh::Error;

        async fn auth_password(&mut self, user: &str, password: &str) -> Result<Auth, Self::Error> {
            assert_eq!(user, "tester");
            assert_eq!(password, "secret");
            Ok(Auth::Accept)
        }

        async fn channel_open_session(
            &mut self,
            channel: Channel<Msg>,
            reply: russh::server::ChannelOpenHandle,
            _session: &mut Session,
        ) -> Result<(), Self::Error> {
            self.channels.insert(channel.id(), channel);
            let _ = reply.accept().await;
            Ok(())
        }

        async fn channel_eof(
            &mut self,
            channel: ChannelId,
            session: &mut Session,
        ) -> Result<(), Self::Error> {
            session.close(channel)?;
            Ok(())
        }

        async fn subsystem_request(
            &mut self,
            channel_id: ChannelId,
            name: &str,
            session: &mut Session,
        ) -> Result<(), Self::Error> {
            if name == "sftp" {
                let channel = self.channels.remove(&channel_id).unwrap();
                session.channel_success(channel_id)?;
                // The handler is awaited from the packet loop, so run the sftp
                // server on its own task; awaiting it here would stall the
                // loop that feeds the channel.
                let stream = channel.into_stream();
                let world = self.world.clone();
                tokio::spawn(async move {
                    let _ = russh_sftp::server::run(
                        stream,
                        SftpForTest {
                            world,
                            read_done: HashMap::new(),
                        },
                    )
                    .await;
                });
            } else {
                session.channel_failure(channel_id)?;
            }
            Ok(())
        }
    }

    /// The fake SFTP backend: in-memory dirs + files, exactly what the client
    /// operations need (mkdir / open / write / close / opendir / readdir /
    /// realpath). `readdir` answers once, then EOF, so the client's read_dir
    /// loop terminates.
    struct SftpForTest {
        world: World,
        read_done: HashMap<String, bool>,
    }

    impl SftpForTest {
        fn ok(id: u32) -> Status {
            Status {
                id,
                status_code: StatusCode::Ok,
                error_message: "OK".to_string(),
                language_tag: "en-US".to_string(),
            }
        }
    }

    impl russh_sftp::server::Handler for SftpForTest {
        type Error = StatusCode;

        fn unimplemented(&self) -> Self::Error {
            StatusCode::OpUnsupported
        }

        async fn init(
            &mut self,
            _version: u32,
            _extensions: HashMap<String, String>,
        ) -> Result<Version, Self::Error> {
            Ok(Version::new())
        }

        async fn open(
            &mut self,
            id: u32,
            filename: String,
            _pflags: russh_sftp::protocol::OpenFlags,
            _attrs: FileAttributes,
        ) -> Result<Handle, Self::Error> {
            self.world
                .files
                .lock()
                .await
                .insert(filename.clone(), Vec::new());
            Ok(Handle {
                id,
                handle: filename,
            })
        }

        async fn close(&mut self, id: u32, _handle: String) -> Result<Status, Self::Error> {
            Ok(Self::ok(id))
        }

        async fn write(
            &mut self,
            id: u32,
            handle: String,
            _offset: u64,
            data: Vec<u8>,
        ) -> Result<Status, Self::Error> {
            if let Some(bytes) = self.world.files.lock().await.get_mut(&handle) {
                bytes.extend(data);
            }
            Ok(Self::ok(id))
        }

        async fn mkdir(
            &mut self,
            id: u32,
            path: String,
            _attrs: FileAttributes,
        ) -> Result<Status, Self::Error> {
            self.world.dirs.lock().await.insert(path, true);
            Ok(Self::ok(id))
        }

        async fn realpath(&mut self, id: u32, path: String) -> Result<Name, Self::Error> {
            Ok(Name {
                id,
                files: vec![File::dummy(path)],
            })
        }

        async fn opendir(&mut self, id: u32, path: String) -> Result<Handle, Self::Error> {
            Ok(Handle { id, handle: path })
        }

        async fn readdir(&mut self, id: u32, handle: String) -> Result<Name, Self::Error> {
            if self.read_done.get(&handle).copied().unwrap_or(false) {
                return Err(StatusCode::Eof);
            }
            self.read_done.insert(handle, true);
            Ok(Name {
                id,
                files: vec![
                    File::new("index.html", FileAttributes::default()),
                    File::new("assets", FileAttributes::default()),
                ],
            })
        }
    }

    #[tokio::test]
    async fn an_in_process_sftp_round_trip_lists_and_uploads() {
        let (mut server, world) = SshServerForTest::default_world();
        let key = russh::keys::PrivateKey::random(&mut rand::rng(), ssh_key::Algorithm::Ed25519).unwrap();
        let config = Arc::new(russh::server::Config {
            keys: vec![key],
            ..Default::default()
        });
        let listener = TcpListener::bind("127.0.0.1:0").await.unwrap();
        let port = listener.local_addr().unwrap().port();
        let running = server.run_on_socket(config, &listener);
        let handle = running.handle();

        // upload: parent dirs created once per batch, then CREATE|TRUNCATE|WRITE
        use base64::Engine as _;
        let payload = b"hello from the sftp fallback";
        let b64 = base64::engine::general_purpose::STANDARD.encode(payload);
        let files = vec![UploadedFile {
            name: "assets/app.js".to_string(),
            base64: b64,
        }];

        let ops = async {
            // listing: "/" maps to "." on the wire and answers two entries
            let names = tokio::time::timeout(
                Duration::from_secs(60),
                sftp_list("127.0.0.1", port, "tester", "secret", "/"),
            )
            .await
            .expect("sftp_list hung")
            .expect("sftp_list failed");
            assert!(
                names.iter().any(|n| n == "index.html"),
                "expected index.html in listing, got {names:?}"
            );
            assert!(names.iter().any(|n| n == "assets"), "got {names:?}");

            tokio::time::timeout(
                Duration::from_secs(60),
                sftp_upload("127.0.0.1", port, "tester", "secret", "public_html", &files),
            )
            .await
            .expect("sftp_upload hung")
            .expect("sftp_upload failed");
        };

        // The server future borrows `server` and `listener`, so it cannot be
        // spawned; poll it beside the client instead. The client requests
        // shutdown when it is done, which ends the accept loop.
        let ((), _server) = tokio::join!(
            async {
                ops.await;
                handle.shutdown(String::from("test done"));
            },
            running
        );

        let mut dirs = world
            .dirs
            .lock()
            .await
            .keys()
            .cloned()
            .collect::<Vec<_>>();
        dirs.sort();
        assert_eq!(dirs, vec!["public_html", "public_html/assets"]);
        let stored = world
            .files
            .lock()
            .await
            .get("public_html/assets/app.js")
            .cloned()
            .unwrap_or_default();
        assert_eq!(stored.as_slice(), &payload[..], "bytes on the wire changed");
    }
}
