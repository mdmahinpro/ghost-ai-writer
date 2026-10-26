//! Site identity: give a browser site one identity on the server.
//!
//! The store creates a site with a uid string the moment the user adds one, and
//! scopes every run, job and article in the UI by that string. The Rust tables
//! key on numeric ids. Without a link, work the server runs cannot be attached
//! to a site the UI knows, which is what stopped the pipeline move at the
//! read-path stage.
//!
//! `ensure` is the whole contract: hand it the browser's uid and it returns the
//! numeric ids, creating the site (and the `websites` row every job needs) the
//! first time and returning the existing ones after that. Idempotent on
//! `(workspace_id, client_uid)`, so calling it on every queue is safe.

use axum::{extract::State, Json};
use serde::{Deserialize, Serialize};

use crate::ApiError;

#[derive(Debug, Deserialize)]
pub struct EnsureSiteRequest {
    pub workspace_id: i64,
    /// The browser's uid for this site, e.g. `site_1a2b3c`.
    pub client_uid: String,
    /// Display name; used for the `websites` row the worker reads.
    pub name: String,
    /// Optional domain. `sites.domain` is NOT NULL, so this falls back to the
    /// name when the UI has no public URL yet.
    #[serde(default)]
    pub domain: Option<String>,
}

#[derive(Debug, Serialize, Deserialize, PartialEq)]
pub struct EnsureSiteResponse {
    pub site_id: i64,
    pub website_id: i64,
    /// False when an existing row was found, so the client can tell a first
    /// link from a repeat call without comparing ids.
    pub created: bool,
}

fn iso_now() -> String {
    use std::time::SystemTime;
    let dur = SystemTime::now()
        .duration_since(SystemTime::UNIX_EPOCH)
        .unwrap_or_default();
    let secs = dur.as_secs();
    // Civil date from the Unix epoch (Howard Hinnant's algorithm), avoiding a
    // date crate for one timestamp.
    let days = (secs / 86_400) as i64;
    let rem = secs % 86_400;
    let z = days + 719_468;
    let era = z.div_euclid(146_097);
    let doe = z - era * 146_097;
    let yoe = (doe - doe / 1460 + doe / 36_524 - doe / 146_096) / 365;
    let y = yoe + era * 400;
    let doy = doe - (365 * yoe + yoe / 4 - yoe / 100);
    let mp = (5 * doy + 2) / 153;
    let d = doy - (153 * mp + 2) / 5 + 1;
    let m = if mp < 10 { mp + 3 } else { mp - 9 };
    let y = if m <= 2 { y + 1 } else { y };
    format!(
        "{y:04}-{m:02}-{d:02}T{:02}:{:02}:{:02}Z",
        rem / 3600,
        (rem % 3600) / 60,
        rem % 60
    )
}

/// POST /api/v1/sites/ensure
pub async fn ensure_site(
    State(st): State<crate::AppState>,
    Json(req): Json<EnsureSiteRequest>,
) -> Result<Json<EnsureSiteResponse>, ApiError> {
    let uid = req.client_uid.trim();
    if uid.is_empty() {
        return Err(ApiError::BadRequest("client_uid must not be empty"));
    }
    let ws_exists: i64 = sqlx::query_scalar("SELECT COUNT(*) FROM workspaces WHERE id = ?")
        .bind(req.workspace_id)
        .fetch_one(&st.pool)
        .await
        .map_err(ApiError::Db)?;
    if ws_exists == 0 {
        return Err(ApiError::BadRequest("unknown workspace_id"));
    }

    // Already linked? Return the existing ids. This is the common path: the
    // client calls ensure on every queue, not just the first.
    let existing: Option<(i64, Option<i64>)> = sqlx::query_as(
        "SELECT id, website_id FROM sites
          WHERE workspace_id = ?1 AND client_uid = ?2",
    )
    .bind(req.workspace_id)
    .bind(uid)
    .fetch_optional(&st.pool)
    .await
    .map_err(ApiError::Db)?;

    if let Some((site_id, Some(website_id))) = existing {
        return Ok(Json(EnsureSiteResponse {
            site_id,
            website_id,
            created: false,
        }));
    }

    let name = if req.name.trim().is_empty() {
        "Untitled site"
    } else {
        req.name.trim()
    };
    let domain = req
        .domain
        .as_deref()
        .map(str::trim)
        .filter(|d| !d.is_empty())
        .unwrap_or(name);
    let now = iso_now();

    let mut tx = st.pool.begin().await.map_err(ApiError::Db)?;

    // A site may exist from an earlier call that created the site row before
    // the website link was recorded; reuse it rather than creating a second.
    let site_id = match existing {
        Some((site_id, _)) => site_id,
        None => {
            let website_id: i64 = sqlx::query_scalar(
                "INSERT INTO websites (workspace_id, name, created_at)
                 VALUES (?, ?, ?) RETURNING id",
            )
            .bind(req.workspace_id)
            .bind(name)
            .bind(&now)
            .fetch_one(&mut *tx)
            .await
            .map_err(ApiError::Db)?;
            let site_id: i64 = sqlx::query_scalar(
                "INSERT INTO sites (workspace_id, domain, created_at, client_uid, website_id)
                 VALUES (?, ?, ?, ?, ?) RETURNING id",
            )
            .bind(req.workspace_id)
            .bind(domain)
            .bind(&now)
            .bind(uid)
            .bind(website_id)
            .fetch_one(&mut *tx)
            .await
            .map_err(ApiError::Db)?;
            tx.commit().await.map_err(ApiError::Db)?;
            return Ok(Json(EnsureSiteResponse {
                site_id,
                website_id,
                created: true,
            }));
        }
    };

    // Repair path: the site row predates the website link.
    let website_id: i64 = sqlx::query_scalar(
        "INSERT INTO websites (workspace_id, name, created_at)
         VALUES (?, ?, ?) RETURNING id",
    )
    .bind(req.workspace_id)
    .bind(name)
    .bind(&now)
    .fetch_one(&mut *tx)
    .await
    .map_err(ApiError::Db)?;
    sqlx::query("UPDATE sites SET website_id = ? WHERE id = ?")
        .bind(website_id)
        .bind(site_id)
        .execute(&mut *tx)
        .await
        .map_err(ApiError::Db)?;
    tx.commit().await.map_err(ApiError::Db)?;

    Ok(Json(EnsureSiteResponse {
        site_id,
        website_id,
        created: false,
    }))
}

#[cfg(test)]
mod tests {
    use super::*;
    use axum::body::Body;
    use axum::http::{Request, StatusCode};
    use axum::routing::post;
    use axum::Router;
    use sqlx::sqlite::SqlitePoolOptions;
    use sqlx::SqlitePool;
    use tower::ServiceExt;

    async fn pool() -> SqlitePool {
        let pool = SqlitePoolOptions::new()
            .max_connections(1)
            .connect("sqlite::memory:")
            .await
            .unwrap();
        for sql in [
            "CREATE TABLE workspaces (id INTEGER PRIMARY KEY, name TEXT, created_at TEXT)",
            "CREATE TABLE websites (id INTEGER PRIMARY KEY AUTOINCREMENT, workspace_id INTEGER NOT NULL,
                 name TEXT NOT NULL, ghost_mode TEXT NOT NULL DEFAULT 'SANDBOX', ghost_url TEXT,
                 ghost_admin_key_enc TEXT, static_site_name TEXT, created_at TEXT NOT NULL)",
            "CREATE TABLE sites (id INTEGER PRIMARY KEY AUTOINCREMENT, workspace_id INTEGER NOT NULL,
                 domain TEXT NOT NULL, created_at TEXT NOT NULL, client_uid TEXT, website_id INTEGER)",
        ] {
            sqlx::query(sql).execute(&pool).await.unwrap();
        }
        sqlx::query("INSERT INTO workspaces (id, name) VALUES (1, 'ws')")
            .execute(&pool)
            .await
            .unwrap();
        pool
    }

    fn app(pool: SqlitePool) -> Router {
        Router::new()
            .route("/api/v1/sites/ensure", post(ensure_site))
            .with_state(crate::AppState { pool })
    }

    async fn ensure(pool: SqlitePool, body: serde_json::Value) -> (StatusCode, String) {
        let resp = app(pool)
            .oneshot(
                Request::builder()
                    .method("POST")
                    .uri("/api/v1/sites/ensure")
                    .header("content-type", "application/json")
                    .body(Body::from(body.to_string()))
                    .unwrap(),
            )
            .await
            .unwrap();
        let status = resp.status();
        let bytes = axum::body::to_bytes(resp.into_body(), 65536).await.unwrap();
        (status, String::from_utf8_lossy(&bytes).to_string())
    }

    #[tokio::test]
    async fn first_call_creates_a_site_and_its_website() {
        let pool = pool().await;
        let (status, text) = ensure(
            pool.clone(),
            serde_json::json!({"workspace_id":1,"client_uid":"site_abc","name":"Espresso","domain":"ex.com"}),
        )
        .await;
        assert_eq!(status, StatusCode::OK, "{text}");
        let out: EnsureSiteResponse = serde_json::from_str(&text).unwrap();
        assert!(out.created);

        let (uid, wid): (String, Option<i64>) =
            sqlx::query_as("SELECT client_uid, website_id FROM sites WHERE id = ?")
                .bind(out.site_id)
                .fetch_one(&pool)
                .await
                .unwrap();
        assert_eq!(uid, "site_abc", "the browser's uid is recorded");
        assert_eq!(wid, Some(out.website_id), "the website link is real");

        let wname: String = sqlx::query_scalar("SELECT name FROM websites WHERE id = ?")
            .bind(out.website_id)
            .fetch_one(&pool)
            .await
            .unwrap();
        assert_eq!(wname, "Espresso");
    }

    #[tokio::test]
    async fn a_second_call_returns_the_same_ids_and_creates_nothing() {
        let pool = pool().await;
        let body = serde_json::json!({"workspace_id":1,"client_uid":"site_abc","name":"Espresso"});
        let (_, first) = ensure(pool.clone(), body.clone()).await;
        let (_, second) = ensure(pool.clone(), body).await;
        let a: EnsureSiteResponse = serde_json::from_str(&first).unwrap();
        let b: EnsureSiteResponse = serde_json::from_str(&second).unwrap();

        assert!(a.created);
        assert!(
            !b.created,
            "the second call must not claim to create anything"
        );
        assert_eq!(a.site_id, b.site_id);
        assert_eq!(a.website_id, b.website_id);

        let sites: i64 = sqlx::query_scalar("SELECT COUNT(*) FROM sites")
            .fetch_one(&pool)
            .await
            .unwrap();
        assert_eq!(sites, 1, "ensure must be idempotent, not accumulate sites");
    }

    #[tokio::test]
    async fn the_same_uid_in_another_workspace_is_a_different_site() {
        // Uids are generated per browser, so two workspaces could collide on a
        // string. The unique index is per workspace, and the lookup must match.
        let pool = pool().await;
        sqlx::query("INSERT INTO workspaces (id, name) VALUES (2, 'ws2')")
            .execute(&pool)
            .await
            .unwrap();

        let (_, a) = ensure(
            pool.clone(),
            serde_json::json!({"workspace_id":1,"client_uid":"site_x","name":"A"}),
        )
        .await;
        let (_, b) = ensure(
            pool.clone(),
            serde_json::json!({"workspace_id":2,"client_uid":"site_x","name":"B"}),
        )
        .await;
        let a: EnsureSiteResponse = serde_json::from_str(&a).unwrap();
        let b: EnsureSiteResponse = serde_json::from_str(&b).unwrap();

        assert_ne!(a.site_id, b.site_id);
        assert!(b.created);
    }

    #[tokio::test]
    async fn an_empty_uid_is_rejected() {
        let pool = pool().await;
        let (status, _) = ensure(
            pool,
            serde_json::json!({"workspace_id":1,"client_uid":"   ","name":"x"}),
        )
        .await;
        assert_eq!(status, StatusCode::BAD_REQUEST);
    }

    #[tokio::test]
    async fn an_unknown_workspace_is_a_bad_request_not_a_500() {
        let pool = pool().await;
        let (status, text) = ensure(
            pool,
            serde_json::json!({"workspace_id":99,"client_uid":"site_abc","name":"x"}),
        )
        .await;
        assert_eq!(status, StatusCode::BAD_REQUEST, "{text}");
        assert!(text.contains("unknown workspace_id"));
    }

    #[tokio::test]
    async fn a_missing_domain_falls_back_to_the_name() {
        // sites.domain is NOT NULL, so a site added before it has a public URL
        // must still be creatable.
        let pool = pool().await;
        let (_, text) = ensure(
            pool.clone(),
            serde_json::json!({"workspace_id":1,"client_uid":"site_nodomain","name":"My Site"}),
        )
        .await;
        let out: EnsureSiteResponse = serde_json::from_str(&text).unwrap();
        let domain: String = sqlx::query_scalar("SELECT domain FROM sites WHERE id = ?")
            .bind(out.site_id)
            .fetch_one(&pool)
            .await
            .unwrap();
        assert_eq!(domain, "My Site");
    }
}
