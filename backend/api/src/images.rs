//! Image placement and media reads.
//!
//! The browser used to do this through a Node server function: search Bing,
//! download, sniff the dimensions, write the bytes into `public/media`, and
//! hand back a `/media/<hash>.<ext>` path. That only worked while the API and
//! the page shared a disk and an origin. Here the API owns the bytes and serves
//! them from `/media/<name>`, so the page and the API can live anywhere.
//!
//! Selection reuses [`crate::image`], which already implements the Bing
//! thumbnail technique and its quality gates.

use std::path::PathBuf;
use std::sync::OnceLock;

use serde::Deserialize;
use serde_json::{json, Value};

/// Where placed images are written. Both are kept so an existing deployment's
/// `/media` tree keeps working whichever one it used.
fn media_dirs() -> Vec<PathBuf> {
    let mut dirs = Vec::new();
    if let Ok(custom) = std::env::var("GAW_MEDIA_DIR") {
        if !custom.trim().is_empty() {
            dirs.push(PathBuf::from(custom));
        }
    }
    let cwd = std::env::current_dir().unwrap_or_else(|_| PathBuf::from("."));
    dirs.push(cwd.join("public").join("media"));
    dirs.push(cwd.join("data").join("media"));
    dirs
}

fn client() -> &'static reqwest::Client {
    static CLIENT: OnceLock<reqwest::Client> = OnceLock::new();
    CLIENT.get_or_init(|| {
        reqwest::Client::builder()
            .timeout(std::time::Duration::from_secs(20))
            .user_agent(
                "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 \
                 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
            )
            .build()
            .expect("image client")
    })
}

/// A stored name is a content hash plus a known image extension — nothing else
/// is permitted to reach the filesystem.
pub fn safe_name(name: &str) -> Option<String> {
    let lower = name.to_ascii_lowercase();
    let (stem, ext) = lower.rsplit_once('.')?;
    if !matches!(ext, "jpg" | "png" | "webp") {
        return None;
    }
    if stem.len() < 16 || stem.len() > 64 || !stem.bytes().all(|b| b.is_ascii_hexdigit()) {
        return None;
    }
    Some(lower)
}

fn hex(bytes: &[u8]) -> String {
    let mut out = String::with_capacity(bytes.len() * 2);
    for byte in bytes {
        out.push_str(&format!("{byte:02x}"));
    }
    out
}

/// Content-addressed name, matching what the Node version produced.
pub fn name_for(bytes: &[u8], mime: &str) -> String {
    let digest = ring::digest::digest(&ring::digest::SHA256, bytes);
    let stem: String = hex(digest.as_ref()).chars().take(24).collect();
    let ext = if mime.contains("png") {
        "png"
    } else if mime.contains("webp") {
        "webp"
    } else {
        "jpg"
    };
    format!("{stem}.{ext}")
}

/// Width and height from the bytes themselves, since providers lie in headers.
pub fn sniff_size(buf: &[u8]) -> Option<(u32, u32)> {
    // PNG: IHDR carries the dimensions at a fixed offset.
    if buf.len() > 24 && buf[0] == 0x89 && buf[1] == b'P' {
        let w = u32::from_be_bytes([buf[16], buf[17], buf[18], buf[19]]);
        let h = u32::from_be_bytes([buf[20], buf[21], buf[22], buf[23]]);
        return Some((w, h));
    }
    // JPEG: walk the marker chain to a start-of-frame segment.
    if buf.len() > 4 && buf[0] == 0xff && buf[1] == 0xd8 {
        let mut offset = 2usize;
        while offset + 9 < buf.len() {
            if buf[offset] != 0xff {
                break;
            }
            let marker = buf[offset + 1];
            if marker == 0xc0 || marker == 0xc1 || marker == 0xc2 {
                let h = u16::from_be_bytes([buf[offset + 5], buf[offset + 6]]);
                let w = u16::from_be_bytes([buf[offset + 7], buf[offset + 8]]);
                return Some((w as u32, h as u32));
            }
            let len = u16::from_be_bytes([buf[offset + 2], buf[offset + 3]]) as usize;
            if len < 2 {
                break;
            }
            offset += 2 + len;
        }
    }
    // WebP: VP8X holds 24-bit dimensions; VP8 holds 14-bit ones.
    if buf.len() >= 30 && &buf[0..4] == b"RIFF" && &buf[8..12] == b"WEBP" {
        match &buf[12..16] {
            b"VP8X" => {
                let w = 1 + u32::from_le_bytes([buf[24], buf[25], buf[26], 0]);
                let h = 1 + u32::from_le_bytes([buf[27], buf[28], buf[29], 0]);
                return Some((w, h));
            }
            b"VP8 " => {
                let w = u16::from_le_bytes([buf[26], buf[27]]) as u32 & 0x3fff;
                let h = u16::from_le_bytes([buf[28], buf[29]]) as u32 & 0x3fff;
                return Some((w, h));
            }
            _ => {}
        }
    }
    None
}

fn write_all_dirs(name: &str, bytes: &[u8]) -> std::io::Result<()> {
    for dir in media_dirs() {
        std::fs::create_dir_all(&dir)?;
        std::fs::write(dir.join(name), bytes)?;
    }
    Ok(())
}

/// A fetched image: the bytes, their real type, and the URL that served them.
pub struct Fetched {
    pub bytes: Vec<u8>,
    pub mime: String,
    pub final_url: String,
}

/// Download an image, refusing private hosts and non-photo payloads.
pub async fn fetch_image(remote: &str) -> Option<Fetched> {
    let parsed = reqwest::Url::parse(remote).ok()?;
    if parsed.scheme() != "https" {
        return None;
    }
    if crate::ghost::is_private_host(parsed.host_str()?) {
        return None;
    }
    let resp = client()
        .get(parsed.clone())
        .header("Accept", "image/webp,image/*,*/*;q=0.8")
        .send()
        .await
        .ok()?;
    if !resp.status().is_success() {
        return None;
    }
    let final_url = resp.url().to_string();
    // A redirect may land somewhere private; check again before reading.
    let final_host = reqwest::Url::parse(&final_url).ok()?.host_str()?.to_string();
    if crate::ghost::is_private_host(&final_host) {
        return None;
    }
    let mime = resp
        .headers()
        .get("content-type")
        .and_then(|v| v.to_str().ok())
        .unwrap_or("")
        .split(';')
        .next()
        .unwrap_or("")
        .trim()
        .to_ascii_lowercase();
    if !mime.starts_with("image/") || mime.contains("svg") || mime.contains("gif") {
        return None;
    }
    let bytes = resp.bytes().await.ok()?.to_vec();
    if bytes.len() < 8_000 || bytes.len() > 3_500_000 {
        return None;
    }
    Some(Fetched {
        bytes,
        mime,
        final_url,
    })
}

/// Store bytes under their content hash and return the name.
pub fn store(bytes: &[u8], mime: &str) -> Option<String> {
    let name = name_for(bytes, mime);
    write_all_dirs(&name, bytes).ok()?;
    Some(name)
}

#[derive(Debug, Deserialize)]
pub struct Slot {
    #[serde(default)]
    pub query: String,
    #[serde(default)]
    pub alt: String,
    #[serde(default)]
    pub role: Option<String>,
    #[serde(default)]
    pub width: Option<u32>,
    #[serde(default)]
    pub height: Option<u32>,
}

#[derive(Debug, Deserialize)]
pub struct PlaceRequest {
    /// Accepted from the old client contract. Only the Bing technique is
    /// implemented here, so this no longer changes selection — see the note on
    /// `place`. Kept so a caller that still sends it is not rejected.
    #[serde(default)]
    #[allow(dead_code)]
    pub provider: Option<String>,
    #[serde(default)]
    pub slots: Vec<Slot>,
    #[serde(default)]
    pub avoid: Vec<String>,
    #[serde(default)]
    pub salt: Option<u32>,
}

fn size_for(slot: &Slot) -> (u32, u32) {
    let featured = slot.role.as_deref() != Some("section");
    let (dw, dh) = if featured {
        crate::image::FEATURED
    } else {
        crate::image::CONTENT
    };
    (
        slot.width.filter(|w| *w > 0).map(|w| w.min(1600)).unwrap_or(dw),
        slot.height
            .filter(|h| *h > 0)
            .map(|h| h.min(1200))
            .unwrap_or(dh),
    )
}

/// Place one image for a slot, or explain why none was used.
///
/// A slot that cannot be filled is not an error: publishing continues without
/// it, which is what the previous implementation told the caller.
async fn place_one(slot: &Slot, avoid: &mut Vec<String>, salt: u32) -> Value {
    let role = slot.role.as_deref().unwrap_or("featured");
    let size = size_for(slot);
    let mut scene = crate::image::scene_query(&slot.alt, &slot.query, None);
    // The salt is how a re-run gets a different photo instead of the same
    // thumbnail, which would make every rebuild look identical.
    if salt > 0 {
        scene = format!("{scene} {salt}");
    }
    let (candidates, attempts) = crate::image::fetch_candidates(&scene, size).await;
    let mut tried = 0usize;
    let mut last_http = 0u16;

    for candidate in candidates {
        tried += 1;
        let fingerprint = crate::image::fingerprint(&candidate.url, candidate.bytes);
        if avoid.iter().any(|seen| seen == &fingerprint) {
            last_http = 409;
            continue;
        }
        let Some(fetched) = fetch_image(&candidate.url).await else {
            last_http = 415;
            continue;
        };
        // Trust the bytes over the header. The floor has to sit below the
        // requested thumbnail size (474×274 featured, 624×352 content) — a 480px
        // floor rejected every featured image the service itself asked for.
        let dims = sniff_size(&fetched.bytes);
        if let Some((w, h)) = dims {
            if w < 300 || h < 160 {
                last_http = 204;
                continue;
            }
        } else if fetched.bytes.len() < 20_000 {
            last_http = 204;
            continue;
        }
        avoid.push(fingerprint);
        let Some(name) = store(&fetched.bytes, &fetched.mime) else {
            last_http = 500;
            continue;
        };
        let (width, height) = dims.unwrap_or(size);
        return json!({
            "query": slot.query,
            "alt": slot.alt,
            "role": role,
            "http": 200,
            "selected": true,
            "src": format!("/media/{name}"),
            "remote": fetched.final_url,
            "width": width,
            "height": height,
            "bytes": fetched.bytes.len(),
            "license": "unknown-bing",
            "attempts": tried,
        });
    }

    let code = if attempts.iter().any(|a| a.starts_with("transport")) {
        502
    } else {
        last_http
    };
    json!({
        "query": slot.query,
        "alt": slot.alt,
        "role": role,
        "http": if code == 0 { 404 } else { code },
        "selected": false,
        "license": "unknown-bing",
        "attempts": tried,
        "error": "No photo passed the size check. Publish continues without this slot.",
    })
}

/// Place images for up to four slots.
///
/// The old client could ask for `wikimedia`; that path is gone with the Node
/// server, so every slot uses the Bing technique in [`crate::image`] and the
/// `provider` input is accepted but ignored.
pub async fn place(req: &PlaceRequest) -> Value {
    let mut avoid: Vec<String> = req
        .avoid
        .iter()
        .filter(|item| !item.trim().is_empty())
        .cloned()
        .collect();
    let salt = req.salt.unwrap_or(0);
    let mut images = Vec::new();
    for (index, slot) in req.slots.iter().take(4).enumerate() {
        images.push(place_one(slot, &mut avoid, salt + index as u32 * 3).await);
    }
    json!({ "images": images })
}

#[derive(Debug, Deserialize)]
pub struct MediaFile {
    #[serde(default)]
    pub name: String,
    #[serde(default)]
    pub remote: Option<String>,
}

#[derive(Debug, Deserialize)]
pub struct ReadMediaRequest {
    #[serde(default)]
    pub files: Vec<MediaFile>,
}

/// Read stored media as base64, fetching and caching a remote one if needed.
///
/// This is how an upload gets bytes without the browser holding a file path.
pub async fn read_batch(req: &ReadMediaRequest) -> Value {
    let mut out = Vec::new();
    for file in req.files.iter().take(24) {
        let Some(name) = safe_name(&file.name) else {
            continue;
        };
        let mut hit: Option<(String, Vec<u8>)> = None;
        for dir in media_dirs() {
            if let Ok(bytes) = std::fs::read(dir.join(&name)) {
                hit = Some((name.clone(), bytes));
                break;
            }
        }
        if let Some((name, bytes)) = hit {
            out.push(json!({
                "name": name,
                "base64": base64::Engine::encode(&base64::engine::general_purpose::STANDARD, &bytes),
            }));
            continue;
        }
        let Some(remote) = file.remote.as_deref() else {
            continue;
        };
        let Some(fetched) = fetch_image(remote).await else {
            continue;
        };
        let Some(stored) = store(&fetched.bytes, &fetched.mime) else {
            continue;
        };
        out.push(json!({
            "name": stored,
            "base64": base64::Engine::encode(&base64::engine::general_purpose::STANDARD, &fetched.bytes),
        }));
    }
    json!({ "files": out })
}

/// Serve a stored image. Public on purpose: published posts embed these URLs.
pub fn open(name: &str) -> Option<(String, Vec<u8>)> {
    let safe = safe_name(name)?;
    for dir in media_dirs() {
        if let Ok(bytes) = std::fs::read(dir.join(&safe)) {
            let mime = if safe.ends_with(".png") {
                "image/png"
            } else if safe.ends_with(".webp") {
                "image/webp"
            } else {
                "image/jpeg"
            };
            return Some((mime.to_string(), bytes));
        }
    }
    None
}

#[cfg(test)]
mod tests {
    use super::*;

    fn png_bytes(w: u32, h: u32) -> Vec<u8> {
        let mut buf = vec![0x89, b'P', b'N', b'G', 0x0d, 0x0a, 0x1a, 0x0a];
        buf.extend_from_slice(&[0, 0, 0, 13]);
        buf.extend_from_slice(b"IHDR");
        buf.extend_from_slice(&w.to_be_bytes());
        buf.extend_from_slice(&h.to_be_bytes());
        buf.extend_from_slice(&[8, 6, 0, 0, 0]);
        buf
    }

    #[test]
    fn a_stored_name_is_a_hash_and_a_known_extension() {
        assert_eq!(safe_name("0123456789abcdef01234567.jpg").as_deref(), Some("0123456789abcdef01234567.jpg"));
        assert_eq!(safe_name("../etc/passwd"), None);
        assert_eq!(safe_name("0123456789abcdef01234567.exe"), None);
        assert_eq!(safe_name("short.jpg"), None, "a short stem is not a hash");
        assert_eq!(safe_name("0123456789abcdef01234567.JPG").as_deref(), Some("0123456789abcdef01234567.jpg"));
    }

    #[test]
    fn png_dimensions_come_from_the_header() {
        let buf = png_bytes(474, 274);
        assert_eq!(sniff_size(&buf), Some((474, 274)));
    }

    #[test]
    fn unknown_bytes_yield_no_dimensions() {
        assert_eq!(sniff_size(b"not an image at all"), None);
    }

    #[test]
    fn the_name_is_derived_from_the_content() {
        let bytes = png_bytes(10, 10);
        let first = name_for(&bytes, "image/png");
        let second = name_for(&bytes, "image/png");
        assert_eq!(first, second, "the same bytes must map to the same name");
        assert!(first.ends_with(".png"));
        assert_eq!(first.len(), 24 + 4);
        let jpeg = name_for(b"different", "image/jpeg");
        assert_ne!(first, jpeg, "different bytes must not collide");
        assert!(jpeg.ends_with(".jpg"));
    }

    #[tokio::test]
    async fn a_private_host_is_refused() {
        // Loopback and friends must never be fetched, even for a redirect.
        assert!(fetch_image("https://127.0.0.1/x.jpg").await.is_none());
        assert!(fetch_image("https://localhost/x.jpg").await.is_none());
        assert!(fetch_image("http://example.com/x.jpg").await.is_none(), "https only");
        assert!(fetch_image("not a url").await.is_none());
    }
}
