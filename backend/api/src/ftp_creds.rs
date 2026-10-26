//! Server-side cPanel credentials, encrypted at rest.
//!
//! The reference sends the password to the server and says it is stored encrypted;
//! ours kept it in browser `localStorage`, which is neither encrypted at rest nor
//! part of the account. It now lives in `ftp_connections`, sealed with the same
//! AES-256-GCM key as provider credentials.
//!
//! Two rules this module enforces so the secret cannot leak back out:
//!   1. `load` never returns the password — only `has_password`.
//!   2. `target` (which does decrypt) is for server-side calls to the FTP client and
//!      is never serialised into a response.

use crate::ftp::FtpTarget;
use crate::secrets;
use serde::{Deserialize, Serialize};
use sqlx::SqlitePool;

#[derive(Debug, Serialize)]
pub struct SavedFtp {
    pub workspace_id: i64,
    pub host: String,
    pub username: String,
    pub port: i64,
    pub remote_dir: String,
    pub public_url: String,
    pub trust_cert: bool,
    /// Whether a sealed password is on file. The password itself is never returned.
    pub has_password: bool,
    pub verified_at: Option<String>,
}

#[derive(Debug, Deserialize)]
pub struct SaveRequest {
    pub workspace_id: i64,
    pub host: String,
    pub username: String,
    /// Leave empty to keep the password already on file — the form never has to
    /// echo a secret back to the browser to change the other fields.
    #[serde(default)]
    pub password: String,
    #[serde(default)]
    pub port: Option<i64>,
    #[serde(default)]
    pub remote_dir: Option<String>,
    #[serde(default)]
    pub public_url: Option<String>,
    #[serde(default = "trusted")]
    pub trust_cert: bool,
    #[serde(default)]
    pub verified: bool,
}

fn trusted() -> bool {
    true
}

type Row = (
    String,
    String,
    String,
    i64,
    String,
    String,
    i64,
    Option<String>,
);

fn shape(workspace_id: i64, row: Row) -> SavedFtp {
    SavedFtp {
        workspace_id,
        host: row.0,
        username: row.1,
        // row.2 is password_enc; never handed to a caller of `load`.
        has_password: !row.2.is_empty(),
        port: row.3,
        remote_dir: row.4,
        public_url: row.5,
        trust_cert: row.6 != 0,
        verified_at: row.7,
    }
}

pub async fn load(pool: &SqlitePool, workspace_id: i64) -> Result<Option<SavedFtp>, String> {
    let row: Option<Row> = sqlx::query_as(
        "SELECT host, username, password_enc, port, remote_dir, public_url, trust_cert, verified_at \
         FROM ftp_connections WHERE workspace_id = ?1",
    )
    .bind(workspace_id)
    .fetch_optional(pool)
    .await
    .map_err(|error| error.to_string())?;
    Ok(row.map(|row| shape(workspace_id, row)))
}

pub async fn save(pool: &SqlitePool, req: &SaveRequest, now: &str) -> Result<SavedFtp, String> {
    let host = req.host.trim();
    let username = req.username.trim();
    if host.is_empty() || username.is_empty() {
        return Err("Hostname and username are both required.".into());
    }
    let existing: Option<(String,)> =
        sqlx::query_as("SELECT password_enc FROM ftp_connections WHERE workspace_id = ?1")
            .bind(req.workspace_id)
            .fetch_optional(pool)
            .await
            .map_err(|error| error.to_string())?;
    let password = req.password.trim();
    let password_enc = if password.is_empty() {
        match existing {
            Some((sealed,)) if !sealed.is_empty() => sealed,
            // Nothing typed and nothing on file: this would be an unusable connection,
            // so say that instead of storing an empty secret that fails at upload time.
            _ => return Err("A password is required the first time a connection is saved.".into()),
        }
    } else {
        secrets::seal_secret(password)
    };
    sqlx::query(
        "INSERT INTO ftp_connections \
           (workspace_id, host, username, password_enc, port, remote_dir, public_url, trust_cert, verified_at, updated_at) \
         VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10) \
         ON CONFLICT(workspace_id) DO UPDATE SET \
           host=excluded.host, username=excluded.username, password_enc=excluded.password_enc, \
           port=excluded.port, remote_dir=excluded.remote_dir, public_url=excluded.public_url, \
           trust_cert=excluded.trust_cert, \
           verified_at=CASE WHEN excluded.verified_at IS NULL THEN ftp_connections.verified_at ELSE excluded.verified_at END, \
           updated_at=excluded.updated_at",
    )
    .bind(req.workspace_id)
    .bind(host)
    .bind(username)
    .bind(&password_enc)
    .bind(req.port.unwrap_or(21))
    .bind(req.remote_dir.as_deref().unwrap_or("/public_html").trim())
    .bind(req.public_url.as_deref().unwrap_or("").trim())
    .bind(if req.trust_cert { 1 } else { 0 })
    .bind(if req.verified { Some(now) } else { None::<&str> })
    .bind(now)
    .execute(pool)
    .await
    .map_err(|error| error.to_string())?;
    load(pool, req.workspace_id)
        .await?
        .ok_or_else(|| "The connection was written but could not be read back.".to_string())
}

pub async fn forget(pool: &SqlitePool, workspace_id: i64) -> Result<bool, String> {
    let result = sqlx::query("DELETE FROM ftp_connections WHERE workspace_id = ?1")
        .bind(workspace_id)
        .execute(pool)
        .await
        .map_err(|error| error.to_string())?;
    Ok(result.rows_affected() > 0)
}

/// A ready-to-use target with the decrypted password, for server-side calls only.
///
/// `overrides` is what the browser typed this time; a blank password means "use the
/// one on file", which is what lets the form stop holding the secret.
pub async fn target(
    pool: &SqlitePool,
    workspace_id: i64,
    overrides: Option<FtpTarget>,
) -> Result<FtpTarget, String> {
    let saved = load(pool, workspace_id).await?;
    let sealed: Option<(String,)> =
        sqlx::query_as("SELECT password_enc FROM ftp_connections WHERE workspace_id = ?1")
            .bind(workspace_id)
            .fetch_optional(pool)
            .await
            .map_err(|error| error.to_string())?;
    let stored = sealed.and_then(|(value,)| secrets::open_secret(&value).or(Some(value)));

    let typed = overrides.unwrap_or(FtpTarget {
        host: String::new(),
        user: String::new(),
        password: String::new(),
        port: None,
        path: None,
        trust_cert: None,
    });

    let host = if typed.host.trim().is_empty() {
        saved
            .as_ref()
            .map(|row| row.host.clone())
            .unwrap_or_default()
    } else {
        typed.host.clone()
    };
    let user = if typed.user.trim().is_empty() {
        saved
            .as_ref()
            .map(|row| row.username.clone())
            .unwrap_or_default()
    } else {
        typed.user.clone()
    };
    let password = if typed.password.trim().is_empty() {
        stored.ok_or_else(|| "No password is stored for this connection.".to_string())?
    } else {
        typed.password.clone()
    };
    if host.is_empty() || user.is_empty() {
        return Err("No cPanel connection is saved yet.".into());
    }
    Ok(FtpTarget {
        host,
        user,
        password,
        port: typed
            .port
            .or_else(|| saved.as_ref().map(|row| row.port as u16)),
        path: typed
            .path
            .filter(|value| !value.trim().is_empty())
            .or_else(|| saved.as_ref().map(|row| row.remote_dir.clone())),
        trust_cert: typed
            .trust_cert
            .or_else(|| saved.as_ref().map(|row| row.trust_cert)),
    })
}

#[cfg(test)]
mod tests {
    use super::*;

    async fn pool() -> SqlitePool {
        let pool = SqlitePool::connect("sqlite::memory:").await.unwrap();
        sqlx::query("CREATE TABLE workspaces (id INTEGER PRIMARY KEY)")
            .execute(&pool)
            .await
            .unwrap();
        sqlx::query("INSERT INTO workspaces (id) VALUES (1)")
            .execute(&pool)
            .await
            .unwrap();
        sqlx::query(
            "CREATE TABLE ftp_connections (
               workspace_id INTEGER PRIMARY KEY REFERENCES workspaces(id),
               host TEXT NOT NULL, username TEXT NOT NULL, password_enc TEXT NOT NULL,
               port INTEGER NOT NULL DEFAULT 21, remote_dir TEXT NOT NULL DEFAULT '/public_html',
               public_url TEXT NOT NULL DEFAULT '', trust_cert INTEGER NOT NULL DEFAULT 1,
               verified_at TEXT, updated_at TEXT NOT NULL)",
        )
        .execute(&pool)
        .await
        .unwrap();
        pool
    }

    fn request(password: &str) -> SaveRequest {
        SaveRequest {
            workspace_id: 1,
            host: "ftp.example.com".into(),
            username: "u605638561".into(),
            password: password.into(),
            port: Some(21),
            remote_dir: Some("/public_html".into()),
            public_url: Some("https://example.com".into()),
            trust_cert: true,
            verified: false,
        }
    }

    #[tokio::test]
    async fn the_password_is_sealed_and_never_read_back() {
        let pool = pool().await;
        let saved = save(&pool, &request("hunter2-secret"), "2026-01-01T00:00:00Z")
            .await
            .expect("save");
        assert!(saved.has_password);
        let json = serde_json::to_string(&saved).unwrap();
        assert!(
            !json.contains("hunter2-secret"),
            "the password must not be serialised back"
        );

        let stored: String = sqlx::query_scalar("SELECT password_enc FROM ftp_connections")
            .fetch_one(&pool)
            .await
            .unwrap();
        assert_ne!(
            stored, "hunter2-secret",
            "stored at rest must be ciphertext"
        );
        assert!(
            secrets::looks_sealed(&stored),
            "must use the sealed envelope"
        );
        assert_eq!(
            secrets::open_secret(&stored).as_deref(),
            Some("hunter2-secret"),
            "the sealed value must decrypt for server-side use"
        );
    }

    #[tokio::test]
    async fn saving_without_a_password_keeps_the_one_on_file() {
        let pool = pool().await;
        save(&pool, &request("keep-me"), "2026-01-01T00:00:00Z")
            .await
            .expect("first");
        let mut second = request("");
        second.host = "ftp2.example.com".into();
        let saved = save(&pool, &second, "2026-01-02T00:00:00Z")
            .await
            .expect("second");
        assert_eq!(saved.host, "ftp2.example.com");
        assert!(saved.has_password);
        let target = target(&pool, 1, None).await.expect("target");
        assert_eq!(target.password, "keep-me");
        assert_eq!(target.host, "ftp2.example.com");
    }

    #[tokio::test]
    async fn a_first_save_with_no_password_is_refused() {
        let pool = pool().await;
        let error = save(&pool, &request(""), "2026-01-01T00:00:00Z")
            .await
            .unwrap_err();
        assert!(error.contains("password"), "got {error}");
    }

    #[tokio::test]
    async fn a_typed_password_wins_over_the_stored_one() {
        let pool = pool().await;
        save(&pool, &request("old"), "2026-01-01T00:00:00Z")
            .await
            .expect("save");
        let typed = FtpTarget {
            host: String::new(),
            user: String::new(),
            password: "new".into(),
            port: None,
            path: None,
            trust_cert: None,
        };
        let target = target(&pool, 1, Some(typed)).await.expect("target");
        assert_eq!(target.password, "new");
        assert_eq!(
            target.host, "ftp.example.com",
            "blank fields fall back to the saved row"
        );
    }

    #[tokio::test]
    async fn forgetting_removes_the_row() {
        let pool = pool().await;
        save(&pool, &request("x"), "2026-01-01T00:00:00Z")
            .await
            .expect("save");
        assert!(forget(&pool, 1).await.expect("forget"));
        assert!(load(&pool, 1).await.expect("load").is_none());
    }
}
