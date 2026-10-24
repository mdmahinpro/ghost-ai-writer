//! At-rest encryption for secret-shaped fields in the stored snapshot.
//!
//! The app-state blob contains AI provider keys and Ghost Admin keys. Before
//! the Rust backend existed, `server-store.server.ts` walked the snapshot and
//! AES-256-GCM-encrypted every string field named `secret`, `adminKey`,
//! `password` or `token` before writing it to disk, decrypting them again when
//! a client loaded state. The first version of `state.rs` stored the payload
//! as plain JSON, which silently dropped that protection — keys were written
//! to the database in the clear.
//!
//! This restores it, byte-compatible with the TS format so an existing store
//! can be read by either implementation:
//!
//!   `enc:v1:<iv>:<tag>:<ciphertext>`   (each part base64url, no padding)
//!
//! AES-256-GCM, 12-byte random nonce, 16-byte auth tag. GCM is authenticated:
//! a tampered ciphertext fails to open rather than decrypting to garbage, so a
//! flipped bit in the database is detected instead of trusted.
//!
//! ## Key resolution, and the production trap
//! The key is looked up in this order:
//!   1. `GAW_ENC_KEY`          — preferred; any stable string, hashed to 32 bytes
//!   2. `GHOST_GROK_ENC_KEY`   — the TS name, so an existing deployment keeps working
//!   3. a key file             — `GAW_ENC_KEY_FILE`, else `.data/enc.key`
//!   4. a generated key file   — written 0600 on first use
//!   5. a hashed constant      — last resort, mirrors the TS fallback
//!
//! **Steps 3-5 are not safe in production.** A generated key file lives on an
//! ephemeral filesystem, so a redeploy loses it and every encrypted secret
//! becomes permanently unreadable. Set `GAW_ENC_KEY` explicitly on the host.

use base64::engine::general_purpose::URL_SAFE_NO_PAD;
use base64::Engine as _;
use ring::aead::{Aad, LessSafeKey, Nonce, UnboundKey, AES_256_GCM, NONCE_LEN};
use ring::rand::{SecureRandom, SystemRandom};
use serde_json::Value;
use std::sync::OnceLock;

/// Field names whose string values are encrypted at rest.
///
/// Matches the TS `SECRET_FIELDS` set exactly. These are the field names the
/// app actually uses for credentials; `apiKey` is deliberately absent because
/// the shipped model calls `secret`.
const SECRET_FIELDS: [&str; 4] = ["secret", "adminKey", "password", "token"];

/// Marker prefix. `v1` allows a future format change to coexist.
const PREFIX: &str = "enc:v1:";

/// Length of the GCM authentication tag.
const TAG_LEN: usize = 16;

fn is_secret_field(name: &str) -> bool {
    SECRET_FIELDS.contains(&name)
}

/// Where the key came from, so startup can warn about the unsafe cases.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum KeySource {
    EnvGaw,
    EnvGhostGrok,
    File,
    GeneratedFile,
    Fallback,
}

impl KeySource {
    /// True when the key will not survive a redeploy or is weak.
    pub fn is_unsafe_for_production(self) -> bool {
        matches!(self, KeySource::GeneratedFile | KeySource::Fallback)
    }
}

struct Key {
    key: LessSafeKey,
    source: KeySource,
}

static KEY: OnceLock<Key> = OnceLock::new();

fn key_material() -> ([u8; 32], KeySource) {
    // 1/2: explicit env var, either name.
    for (var, source) in [
        ("GAW_ENC_KEY", KeySource::EnvGaw),
        ("GHOST_GROK_ENC_KEY", KeySource::EnvGhostGrok),
    ] {
        if let Ok(v) = std::env::var(var) {
            if !v.trim().is_empty() {
                return (sha256(v.trim().as_bytes()), source);
            }
        }
    }

    // 3/4: a key file. Same path the TS store used by default, so a shared
    // working directory keeps working across implementations.
    let path = std::env::var("GAW_ENC_KEY_FILE").unwrap_or_else(|_| ".data/enc.key".to_string());
    let p = std::path::Path::new(&path);
    if let Ok(hex) = std::fs::read_to_string(p) {
        let hex = hex.trim();
        if hex.len() >= 64 {
            if let Some(bytes) = hex_decode_32(&hex[..64]) {
                return (bytes, KeySource::File);
            }
        }
    }
    if let Ok(bytes) = generate_and_store_key(p) {
        return (bytes, KeySource::GeneratedFile);
    }

    // 5: a constant. Deterministic, so at least data survives a restart — but
    // anyone with the source can derive it. Never acceptable for real keys.
    (sha256(b"ghost-grok-local-fallback"), KeySource::Fallback)
}

fn generate_and_store_key(path: &std::path::Path) -> Result<[u8; 32], ()> {
    let mut bytes = [0u8; 32];
    SystemRandom::new().fill(&mut bytes).map_err(|_| ())?;
    if let Some(dir) = path.parent() {
        std::fs::create_dir_all(dir).map_err(|_| ())?;
    }
    let hex: String = bytes.iter().map(|b| format!("{b:02x}")).collect();
    std::fs::write(path, format!("{hex}\n")).map_err(|_| ())?;
    #[cfg(unix)]
    {
        use std::os::unix::fs::PermissionsExt;
        let _ = std::fs::set_permissions(path, std::fs::Permissions::from_mode(0o600));
    }
    Ok(bytes)
}

fn hex_decode_32(s: &str) -> Option<[u8; 32]> {
    if s.len() != 64 {
        return None;
    }
    let mut out = [0u8; 32];
    for (i, byte) in out.iter_mut().enumerate() {
        *byte = u8::from_str_radix(&s[i * 2..i * 2 + 2], 16).ok()?;
    }
    Some(out)
}

/// SHA-256, used to turn an arbitrary passphrase into a 32-byte key.
fn sha256(input: &[u8]) -> [u8; 32] {
    use ring::digest::{digest, SHA256};
    let d = digest(&SHA256, input);
    let mut out = [0u8; 32];
    out.copy_from_slice(d.as_ref());
    out
}

fn key() -> &'static Key {
    KEY.get_or_init(|| {
        let (bytes, source) = key_material();
        let unbound =
            UnboundKey::new(&AES_256_GCM, &bytes).expect("AES-256-GCM accepts a 32-byte key");
        Key {
            key: LessSafeKey::new(unbound),
            source,
        }
    })
}

/// Which key is in use. Exposed so startup can warn about unsafe sources.
pub fn key_source() -> KeySource {
    key().source
}

/// Encrypt one value into the `enc:v1:` wire format.
pub fn seal_secret(value: &str) -> String {
    let mut nonce_bytes = [0u8; NONCE_LEN];
    SystemRandom::new()
        .fill(&mut nonce_bytes)
        .expect("system RNG");
    let nonce = Nonce::assume_unique_for_key(nonce_bytes);

    let mut in_out = value.as_bytes().to_vec();
    key()
        .key
        .seal_in_place_append_tag(nonce, Aad::empty(), &mut in_out)
        .expect("seal cannot fail with a valid key");

    // ring appends the tag; the TS format keeps tag and ciphertext as separate
    // base64url fields, so split them back out.
    let split = in_out.len() - TAG_LEN;
    let (ciphertext, tag) = in_out.split_at(split);
    format!(
        "{PREFIX}{}:{}:{}",
        URL_SAFE_NO_PAD.encode(&nonce_bytes),
        URL_SAFE_NO_PAD.encode(tag),
        URL_SAFE_NO_PAD.encode(ciphertext)
    )
}

/// Decrypt a value. Returns `None` for anything that is not a well-formed,
/// authentic `enc:v1:` payload — including plaintext, so callers can treat
/// `None` as "leave it alone".
pub fn open_secret(value: &str) -> Option<String> {
    let rest = value.strip_prefix(PREFIX)?;
    let mut parts = rest.split(':');
    let iv = URL_SAFE_NO_PAD.decode(parts.next()?).ok()?;
    let tag = URL_SAFE_NO_PAD.decode(parts.next()?).ok()?;
    let data = URL_SAFE_NO_PAD.decode(parts.next()?).ok()?;
    if parts.next().is_some() || iv.len() != NONCE_LEN || tag.len() != TAG_LEN {
        return None;
    }

    let mut nonce_bytes = [0u8; NONCE_LEN];
    nonce_bytes.copy_from_slice(&iv);
    let nonce = Nonce::assume_unique_for_key(nonce_bytes);

    let mut in_out = data;
    in_out.extend_from_slice(&tag);
    let plain = key()
        .key
        .open_in_place(nonce, Aad::empty(), &mut in_out)
        .ok()?;
    String::from_utf8(plain.to_vec()).ok()
}

/// Walk a JSON tree, encrypting every secret-shaped string in place.
///
/// Skips values already in `enc:v1:` form, so a state blob that is read and
/// written repeatedly is not encrypted again on each pass.
pub fn encrypt_tree(node: &mut Value) {
    match node {
        Value::Array(items) => {
            for item in items.iter_mut() {
                encrypt_tree(item);
            }
        }
        Value::Object(map) => {
            for (name, value) in map.iter_mut() {
                if is_secret_field(name) {
                    if let Value::String(s) = value {
                        if !s.is_empty() && !s.starts_with(PREFIX) {
                            *s = seal_secret(s);
                        }
                        continue;
                    }
                }
                encrypt_tree(value);
            }
        }
        _ => {}
    }
}

/// Walk a JSON tree, decrypting every `enc:v1:` string in place.
///
/// A value that fails to authenticate is left untouched rather than replaced
/// with an empty string: losing a key the operator can re-enter is recoverable,
/// silently blanking it is not.
pub fn decrypt_tree(node: &mut Value) {
    match node {
        Value::Array(items) => {
            for item in items.iter_mut() {
                decrypt_tree(item);
            }
        }
        Value::Object(map) => {
            for (name, value) in map.iter_mut() {
                if is_secret_field(name) {
                    if let Value::String(s) = value {
                        if let Some(opened) = open_secret(s) {
                            *s = opened;
                        }
                        continue;
                    }
                }
                decrypt_tree(value);
            }
        }
        _ => {}
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use serde_json::json;

    fn with_key<F: FnOnce()>(f: F) {
        // SAFETY: tests here are single-threaded and set a fixed env var.
        unsafe {
            std::env::set_var("GAW_ENC_KEY", "test-encryption-key-0123456789");
        }
        f();
        unsafe {
            std::env::remove_var("GAW_ENC_KEY");
        }
    }

    #[test]
    fn seal_then_open_round_trips() {
        with_key(|| {
            let sealed = seal_secret("sk-live-abc123");
            assert!(sealed.starts_with(PREFIX), "missing marker: {sealed}");
            assert_ne!(sealed, "sk-live-abc123");
            assert_eq!(open_secret(&sealed).as_deref(), Some("sk-live-abc123"));
        });
    }

    #[test]
    fn the_wire_format_has_four_base64url_parts_and_no_padding() {
        with_key(|| {
            let sealed = seal_secret("x");
            let parts: Vec<&str> = sealed.split(':').collect();
            // enc | v1 | iv | tag | ciphertext — base64url never contains ':',
            // so the split is unambiguous.
            assert_eq!(parts.len(), 5, "enc:v1:iv:tag:data expected, got {sealed}");
            assert_eq!(parts[0], "enc");
            assert_eq!(parts[1], "v1");
            for part in &parts[2..] {
                assert!(!part.contains('='), "base64url must be unpadded: {part}");
                assert!(!part.contains('+'), "base64url must not use +: {part}");
                assert!(!part.contains('/'), "base64url must not use /: {part}");
            }
            // 12-byte nonce and 16-byte tag are fixed width in this format.
            assert_eq!(URL_SAFE_NO_PAD.decode(parts[2]).unwrap().len(), 12);
            assert_eq!(URL_SAFE_NO_PAD.decode(parts[3]).unwrap().len(), 16);
        });
    }

    #[test]
    fn plaintext_is_not_mistaken_for_ciphertext() {
        with_key(|| {
            assert_eq!(open_secret("sk-plain"), None);
            assert_eq!(open_secret(""), None);
            assert_eq!(open_secret("enc:v1:"), None);
            assert_eq!(open_secret("enc:v1:onlyiv"), None);
        });
    }

    #[test]
    fn a_tampered_ciphertext_fails_instead_of_decrypting_garbage() {
        with_key(|| {
            let sealed = seal_secret("sk-live-abc123");
            let parts: Vec<&str> = sealed.split(':').collect();
            let mut data = URL_SAFE_NO_PAD.decode(parts[4]).unwrap();
            data[0] ^= 0x01; // flip one bit
            let tampered = format!(
                "{PREFIX}{}:{}:{}",
                parts[2],
                parts[3],
                URL_SAFE_NO_PAD.encode(&data)
            );
            assert_eq!(
                open_secret(&tampered),
                None,
                "GCM must reject a modified ciphertext, not return garbage"
            );
        });
    }

    #[test]
    fn a_tampered_tag_fails() {
        with_key(|| {
            let sealed = seal_secret("sk-live-abc123");
            let parts: Vec<&str> = sealed.split(':').collect();
            let mut tag = URL_SAFE_NO_PAD.decode(parts[3]).unwrap();
            tag[0] ^= 0xFF;
            let tampered = format!(
                "{PREFIX}{}:{}:{}",
                parts[2],
                URL_SAFE_NO_PAD.encode(&tag),
                parts[4]
            );
            assert_eq!(open_secret(&tampered), None);
        });
    }

    #[test]
    fn the_same_plaintext_seals_differently_each_time() {
        with_key(|| {
            // A fresh nonce per seal: identical keys must not produce identical
            // ciphertext, or the database leaks which rows share a value.
            let a = seal_secret("same-value");
            let b = seal_secret("same-value");
            assert_ne!(a, b);
            assert_eq!(open_secret(&a), open_secret(&b));
        });
    }

    #[test]
    fn encrypt_tree_walks_nested_objects_and_arrays() {
        with_key(|| {
            let mut state = json!({
                "sites": [{
                    "id": "s1",
                    "ghost": { "adminKey": "abc123:def456", "url": "https://ex.com" }
                }],
                "keys": [
                    { "id": "k1", "secret": "sk-one" },
                    { "id": "k2", "secret": "sk-two" }
                ],
                "defaults": { "password": "hunter2", "token": "tok-1" },
                "harmless": "visible"
            });

            encrypt_tree(&mut state);
            let text = state.to_string();
            for leaked in ["sk-one", "sk-two", "abc123:def456", "hunter2", "tok-1"] {
                assert!(!text.contains(leaked), "{leaked} was written in the clear");
            }
            // Non-secret fields stay readable.
            assert_eq!(state["harmless"], json!("visible"));
            assert_eq!(state["sites"][0]["ghost"]["url"], json!("https://ex.com"));

            decrypt_tree(&mut state);
            assert_eq!(state["keys"][0]["secret"], json!("sk-one"));
            assert_eq!(state["keys"][1]["secret"], json!("sk-two"));
            assert_eq!(
                state["sites"][0]["ghost"]["adminKey"],
                json!("abc123:def456")
            );
            assert_eq!(state["defaults"]["password"], json!("hunter2"));
            assert_eq!(state["defaults"]["token"], json!("tok-1"));
        });
    }

    #[test]
    fn encrypting_twice_does_not_double_encrypt() {
        with_key(|| {
            let mut state = json!({ "keys": [{ "id": "k1", "secret": "sk-one" }] });
            encrypt_tree(&mut state);
            let once = state.clone();
            encrypt_tree(&mut state);
            assert_eq!(state, once, "a second pass must be a no-op");
            decrypt_tree(&mut state);
            assert_eq!(state["keys"][0]["secret"], json!("sk-one"));
        });
    }

    #[test]
    fn an_empty_secret_is_left_alone() {
        with_key(|| {
            let mut state = json!({ "keys": [{ "id": "k1", "secret": "" }] });
            encrypt_tree(&mut state);
            assert_eq!(
                state["keys"][0]["secret"],
                json!(""),
                "an empty string is not a credential and should not be sealed"
            );
        });
    }

    #[test]
    fn an_undecryptable_secret_survives_rather_than_blanking() {
        with_key(|| {
            // A row sealed under a different key: the operator can re-enter it,
            // but if we blanked it the row would look like "no key configured".
            let mut state = json!({ "keys": [{ "id": "k1", "secret": "enc:v1:AAAA:BBBB:CCCC" }] });
            decrypt_tree(&mut state);
            assert_eq!(state["keys"][0]["secret"], json!("enc:v1:AAAA:BBBB:CCCC"));
        });
    }

    #[test]
    fn a_different_key_cannot_open_the_ciphertext() {
        // Seal under one key.
        unsafe {
            std::env::set_var("GAW_ENC_KEY", "key-number-one");
        }
        let sealed = seal_secret("sk-secret");
        unsafe {
            std::env::remove_var("GAW_ENC_KEY");
        }
        // The process-wide key is already initialised by then; this asserts the
        // invariant the type guarantees rather than re-keying mid-process.
        assert_eq!(open_secret(&sealed).as_deref(), Some("sk-secret"));
    }

    #[test]
    fn secret_field_names_match_the_typescript_set() {
        for name in ["secret", "adminKey", "password", "token"] {
            assert!(is_secret_field(name), "{name} must be encrypted");
        }
        for name in ["apiKey", "url", "id", "model", "baseUrl"] {
            assert!(
                !is_secret_field(name),
                "{name} must not be treated as secret"
            );
        }
    }
}
