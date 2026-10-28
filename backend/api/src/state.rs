//! Durable app-state persistence.
//!
//! Replaces the file-based `server-store.server.ts` + AES-256-GCM encryption.
//! The full app snapshot is stored as a single JSON blob keyed by workspace id.
//! Encryption is deferred to the auth layer: the admin token gates every route,
//! and the state blob is opaque to the API.
//!
//! ## Merge rules (mirrors TS `mergePersisted`)
//! The client sends a snapshot; the server merges it into the stored state.
//! The merge is a simple deep merge at the top-level key granularity because
//! the Zustand store on the client already handles per-row id merging. The
//! server's job is durability + cross-window sync, not conflict resolution.

use axum::{extract::State, Json};
use serde::{Deserialize, Serialize};
use sqlx::SqlitePool;

use crate::ApiError;

// --- Schema ---------------------------------------------------------------

/// The stored row — one per workspace. The full Zustand snapshot is stored as
/// a JSON string in the `payload` column, with a `generation` counter that
/// rolls forward on every save so stale windows can detect conflicts.
#[derive(sqlx::FromRow, Serialize, Deserialize, Debug, Clone)]
pub struct StateRow {
    pub id: i64,
    pub workspace_id: i64,
    pub generation: i64,
    pub payload: String,
    pub updated_at: String,
}

// --- Public types ---------------------------------------------------------

/// What GET /api/v1/state returns.
#[derive(Serialize, Deserialize)]
pub struct StateEnvelope {
    pub saved_at: i64,
    pub generation: i64,
    pub state: Option<serde_json::Value>,
}

/// What POST /api/v1/state accepts.
#[derive(Deserialize)]
pub struct SaveStateInput {
    pub workspace_id: i64,
    pub state: serde_json::Value,
    /// Ids the browser deleted since its last save. Another window's stale copy
    /// used to be able to push a deleted article back into the shared snapshot;
    /// the tombstone is what makes a delete stick for every window.
    #[serde(default)]
    pub purges: Purges,
}

#[derive(Debug, Default, serde::Deserialize)]
pub struct Purges {
    #[serde(default)]
    pub sites: Vec<String>,
    #[serde(default)]
    pub keys: Vec<String>,
    #[serde(default)]
    pub articles: Vec<String>,
}

impl Purges {
    fn is_empty(&self) -> bool {
        self.sites.is_empty() && self.keys.is_empty() && self.articles.is_empty()
    }
}

/// Drop the tombstoned rows from a snapshot collection before it is stored.
fn drop_ids(state: &mut serde_json::Value, field: &str, ids: &[String]) {
    if ids.is_empty() {
        return;
    }
    let Some(rows) = state.get_mut(field).and_then(|v| v.as_array_mut()) else {
        return;
    };
    rows.retain(|row| {
        row.get("id")
            .and_then(|id| id.as_str())
            .map(|id| !ids.iter().any(|dead| dead == id))
            .unwrap_or(true)
    });
}

/// What POST /api/v1/state returns. Both Serialize (server → client) and
/// Deserialize (tests read the JSON back) are needed.
#[derive(Serialize, Deserialize)]
pub struct SaveStateOutput {
    pub success: bool,
    pub generation: i64,
}

/// What POST /api/v1/state/reset returns.
#[derive(Serialize, Deserialize)]
pub struct ResetStateOutput {
    pub success: bool,
    pub generation: i64,
}

// --- Routes ---------------------------------------------------------------

use crate::AppState;

/// GET /api/v1/state?workspace_id=1
pub async fn load_state(
    State(st): State<AppState>,
    axum::extract::Query(params): axum::extract::Query<std::collections::HashMap<String, String>>,
) -> Result<Json<StateEnvelope>, ApiError> {
    let ws_id: i64 = params
        .get("workspace_id")
        .and_then(|v| v.parse().ok())
        .unwrap_or(1);

    let row: Option<StateRow> = sqlx::query_as(
        "SELECT id, workspace_id, generation, payload, updated_at
         FROM app_state WHERE workspace_id = ?1",
    )
    .bind(ws_id)
    .fetch_optional(&st.pool)
    .await
    .map_err(ApiError::Db)?;

    match row {
        Some(r) => {
            let mut state: Option<serde_json::Value> = serde_json::from_str(&r.payload).ok();
            // Credentials are stored sealed; hand the client plaintext, exactly
            // as the TS store did on load.
            if let Some(v) = state.as_mut() {
                crate::secrets::decrypt_tree(v);
            }
            Ok(Json(StateEnvelope {
                saved_at: chrono_now_ms(),
                generation: r.generation,
                state,
            }))
        }
        None => Ok(Json(StateEnvelope {
            saved_at: chrono_now_ms(),
            generation: 0,
            state: Some(serde_json::json!({})),
        })),
    }
}

/// POST /api/v1/state
pub async fn save_state(
    State(st): State<AppState>,
    Json(input): Json<SaveStateInput>,
) -> Result<Json<SaveStateOutput>, ApiError> {
    // Seal every credential-shaped field before it reaches the database. The
    // client sends plaintext (it must, to render a masked hint); the store is
    // not the place to keep it in the clear.
    let mut state = input.state;
    if !input.purges.is_empty() {
        drop_ids(&mut state, "articles", &input.purges.articles);
        drop_ids(&mut state, "sites", &input.purges.sites);
        drop_ids(&mut state, "keys", &input.purges.keys);
    }
    crate::secrets::encrypt_tree(&mut state);
    let payload =
        serde_json::to_string(&state).map_err(|_| ApiError::BadRequest("invalid state JSON"))?;

    let existing: Option<(i64,)> =
        sqlx::query_as("SELECT id FROM app_state WHERE workspace_id = ?1")
            .bind(input.workspace_id)
            .fetch_optional(&st.pool)
            .await
            .map_err(ApiError::Db)?;

    let generation: i64;
    let now = iso_now();

    if let Some((id,)) = existing {
        // Bump generation — stale windows see a newer generation and
        // refuse to overwrite work that arrived in the meantime.
        generation = sqlx::query_scalar(
            "UPDATE app_state
             SET payload = ?1, generation = generation + 1, updated_at = ?2
             WHERE id = ?3
             RETURNING generation",
        )
        .bind(&payload)
        .bind(&now)
        .bind(id)
        .fetch_one(&st.pool)
        .await
        .map_err(ApiError::Db)?;
    } else {
        generation = 1;
        sqlx::query(
            "INSERT INTO app_state (workspace_id, generation, payload, updated_at)
             VALUES (?1, ?2, ?3, ?4)",
        )
        .bind(input.workspace_id)
        .bind(generation)
        .bind(&payload)
        .bind(&now)
        .execute(&st.pool)
        .await
        .map_err(ApiError::Db)?;
    }

    Ok(Json(SaveStateOutput {
        success: true,
        generation,
    }))
}

/// POST /api/v1/state/reset
pub async fn reset_state(
    State(st): State<AppState>,
    axum::extract::Query(params): axum::extract::Query<std::collections::HashMap<String, String>>,
) -> Result<Json<ResetStateOutput>, ApiError> {
    let ws_id: i64 = params
        .get("workspace_id")
        .and_then(|v| v.parse().ok())
        .unwrap_or(1);

    // Hard reset: delete the row so the next save starts fresh with
    // generation 1. A stale window with a saved pre-reset generation
    // will see a newer generation and refuse to resurrect old data.
    sqlx::query("DELETE FROM app_state WHERE workspace_id = ?1")
        .bind(ws_id)
        .execute(&st.pool)
        .await
        .map_err(ApiError::Db)?;

    Ok(Json(ResetStateOutput {
        success: true,
        generation: 0,
    }))
}

// --- Helpers --------------------------------------------------------------

/// Seal any credentials sitting in the store as plaintext.
///
/// Rows written before at-rest encryption existed hold raw keys. A client save
/// would eventually encrypt them, but "eventually" is unbounded — a workspace
/// that is created and then left alone would keep its key readable in the
/// database indefinitely. This runs once at startup so the exposure ends on
/// deploy rather than on the next edit.
///
/// Safe to run repeatedly: already-sealed values are skipped, so it is a no-op
/// on every boot after the first. Rows that cannot be parsed are left alone and
/// reported, never dropped.
pub async fn seal_existing(pool: &SqlitePool) -> Result<(usize, usize), sqlx::Error> {
    let rows: Vec<(i64, String)> = sqlx::query_as("SELECT id, payload FROM app_state")
        .fetch_all(pool)
        .await?;

    let mut sealed = 0usize;
    let mut unreadable = 0usize;

    for (id, payload) in rows {
        let Ok(mut value) = serde_json::from_str::<serde_json::Value>(&payload) else {
            unreadable += 1;
            continue;
        };
        // Normalise first: a value that arrived already sealed under another
        // key still needs no change, and one that is plaintext gets sealed.
        let before = value.clone();
        crate::secrets::encrypt_tree(&mut value);
        if value == before {
            continue;
        }
        let updated = match serde_json::to_string(&value) {
            Ok(s) => s,
            Err(_) => {
                unreadable += 1;
                continue;
            }
        };
        sqlx::query("UPDATE app_state SET payload = ?1 WHERE id = ?2")
            .bind(updated)
            .bind(id)
            .execute(pool)
            .await?;
        sealed += 1;
    }

    Ok((sealed, unreadable))
}

fn iso_now() -> String {
    use std::time::SystemTime;
    let dur = SystemTime::now()
        .duration_since(SystemTime::UNIX_EPOCH)
        .unwrap_or_default();
    let secs = dur.as_secs();
    let millis = dur.subsec_millis();
    // YYYY-MM-DDTHH:MM:SS.mmmZ — good enough for a log marker; exact
    // calendar date is not required (this is just a monotonic indication).
    format!("{secs}.{millis:03}")
}

fn chrono_now_ms() -> i64 {
    use std::time::SystemTime;
    SystemTime::now()
        .duration_since(SystemTime::UNIX_EPOCH)
        .unwrap_or_default()
        .as_millis() as i64
}

// --- Tests ----------------------------------------------------------------

#[cfg(test)]
mod tests {
    use super::*;
    use axum::{
        body::Body,
        http::{Request, StatusCode},
        routing::{get, post},
        Router,
    };
    use sqlx::{sqlite::SqlitePoolOptions, SqlitePool};
    use tower::ServiceExt;

    #[test]
    fn a_tombstoned_article_is_removed_from_the_stored_snapshot() {
        let mut state = serde_json::json!({
            "articles": [{"id": "srv_art_1"}, {"id": "srv_art_2"}],
            "sites": [{"id": "site_a"}],
            "keys": [{"id": "key_1"}],
        });
        drop_ids(&mut state, "articles", &["srv_art_1".to_string()]);
        drop_ids(&mut state, "sites", &["site_a".to_string()]);
        drop_ids(&mut state, "keys", &[]);

        let ids: Vec<&str> = state["articles"]
            .as_array()
            .unwrap()
            .iter()
            .map(|row| row["id"].as_str().unwrap())
            .collect();
        assert_eq!(ids, vec!["srv_art_2"], "only the tombstoned row goes");
        assert!(state["sites"].as_array().unwrap().is_empty());
        assert_eq!(state["keys"].as_array().unwrap().len(), 1);
    }

    async fn test_pool() -> SqlitePool {
        let pool = SqlitePoolOptions::new()
            .max_connections(1)
            .connect("sqlite::memory:")
            .await
            .unwrap();
        sqlx::query(
            "CREATE TABLE IF NOT EXISTS app_state (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                workspace_id INTEGER NOT NULL,
                generation INTEGER NOT NULL DEFAULT 0,
                payload TEXT NOT NULL DEFAULT '{}',
                updated_at TEXT
            )",
        )
        .execute(&pool)
        .await
        .unwrap();
        pool
    }

    fn app(pool: SqlitePool) -> Router {
        let state = AppState { pool };
        Router::new()
            .route("/api/v1/state", get(load_state).post(save_state))
            .route("/api/v1/state/reset", post(reset_state))
            .with_state(state)
    }

    #[tokio::test]
    async fn empty_store_returns_default() {
        let pool = test_pool().await;
        let resp = app(pool)
            .oneshot(
                Request::builder()
                    .uri("/api/v1/state?workspace_id=1")
                    .body(Body::empty())
                    .unwrap(),
            )
            .await
            .unwrap();
        assert_eq!(resp.status(), StatusCode::OK);
    }

    #[tokio::test]
    async fn save_then_load() {
        let pool = test_pool().await;
        let app = app(pool.clone());

        let save = app
            .clone()
            .oneshot(
                Request::builder()
                    .uri("/api/v1/state")
                    .method("POST")
                    .header("content-type", "application/json")
                    .body(Body::from(r#"{"workspace_id":1,"state":{"key":"val"}}"#))
                    .unwrap(),
            )
            .await
            .unwrap();
        assert_eq!(save.status(), StatusCode::OK);

        let body = axum::body::to_bytes(save.into_body(), 1024 * 1024)
            .await
            .unwrap();
        let out: SaveStateOutput = serde_json::from_slice(&body).unwrap();
        assert!(out.success);
        assert!(out.generation > 0);

        let load = app
            .oneshot(
                Request::builder()
                    .uri("/api/v1/state?workspace_id=1")
                    .body(Body::empty())
                    .unwrap(),
            )
            .await
            .unwrap();
        assert_eq!(load.status(), StatusCode::OK);
    }

    #[tokio::test]
    async fn generation_bumps_on_every_save() {
        let pool = test_pool().await;
        let app = app(pool);

        let g1: i64 = {
            let resp = app
                .clone()
                .oneshot(
                    Request::builder()
                        .uri("/api/v1/state")
                        .method("POST")
                        .header("content-type", "application/json")
                        .body(Body::from(r#"{"workspace_id":1,"state":{}}"#))
                        .unwrap(),
                )
                .await
                .unwrap();
            let body = axum::body::to_bytes(resp.into_body(), 1024 * 1024)
                .await
                .unwrap();
            serde_json::from_slice::<SaveStateOutput>(&body)
                .unwrap()
                .generation
        };

        let g2: i64 = {
            let resp = app
                .clone()
                .oneshot(
                    Request::builder()
                        .uri("/api/v1/state")
                        .method("POST")
                        .header("content-type", "application/json")
                        .body(Body::from(r#"{"workspace_id":1,"state":{}}"#))
                        .unwrap(),
                )
                .await
                .unwrap();
            let body = axum::body::to_bytes(resp.into_body(), 1024 * 1024)
                .await
                .unwrap();
            serde_json::from_slice::<SaveStateOutput>(&body)
                .unwrap()
                .generation
        };

        assert!(g2 > g1);
    }

    #[tokio::test]
    async fn reset_clears_state() {
        let pool = test_pool().await;
        let app = app(pool);

        // Save first
        app.clone()
            .oneshot(
                Request::builder()
                    .uri("/api/v1/state")
                    .method("POST")
                    .header("content-type", "application/json")
                    .body(Body::from(r#"{"workspace_id":1,"state":{"k":"v"}}"#))
                    .unwrap(),
            )
            .await
            .unwrap();

        // Reset
        let reset = app
            .clone()
            .oneshot(
                Request::builder()
                    .uri("/api/v1/state/reset?workspace_id=1")
                    .method("POST")
                    .body(Body::empty())
                    .unwrap(),
            )
            .await
            .unwrap();
        assert_eq!(reset.status(), StatusCode::OK);

        let body = axum::body::to_bytes(reset.into_body(), 1024 * 1024)
            .await
            .unwrap();
        let out: ResetStateOutput = serde_json::from_slice(&body).unwrap();
        assert_eq!(out.generation, 0);

        // Load should return default
        let load = app
            .oneshot(
                Request::builder()
                    .uri("/api/v1/state?workspace_id=1")
                    .body(Body::empty())
                    .unwrap(),
            )
            .await
            .unwrap();
        let body = axum::body::to_bytes(load.into_body(), 1024 * 1024)
            .await
            .unwrap();
        let env: StateEnvelope = serde_json::from_slice(&body).unwrap();
        assert_eq!(env.generation, 0);
    }

    /// All secret-touching tests pin the same key so the process-wide key
    /// resolves deterministically regardless of which test initialises first.
    fn init_test_key() {
        if std::env::var("GAW_ENC_KEY").is_err() {
            std::env::set_var("GAW_ENC_KEY", "state-test-key-0123456789");
        }
    }

    /// The whole point of the fix: a credential sent by the client must not be
    /// readable in the stored row, but must come back intact on load.
    #[tokio::test]
    async fn a_saved_credential_is_sealed_in_the_database() {
        init_test_key();
        let pool = test_pool().await;
        let app = app(pool.clone());

        app.clone()
            .oneshot(
                Request::builder()
                    .uri("/api/v1/state")
                    .method("POST")
                    .header("content-type", "application/json")
                    .body(Body::from(
                        r#"{"workspace_id":1,"state":{
                            "keys":[{"id":"k1","secret":"sk-live-SECRETVALUE"}],
                            "sites":[{"id":"s1","ghost":{"adminKey":"id:KEYVALUE"}}],
                            "harmless":"VISIBLE"
                        }}"#,
                    ))
                    .unwrap(),
            )
            .await
            .unwrap();

        // Read the row straight out of SQLite, bypassing the handler.
        let raw: (String,) = sqlx::query_as("SELECT payload FROM app_state WHERE workspace_id = 1")
            .fetch_one(&pool)
            .await
            .unwrap();

        assert!(
            !raw.0.contains("sk-live-SECRETVALUE"),
            "AI key was written to the database in the clear: {}",
            raw.0
        );
        assert!(
            !raw.0.contains("KEYVALUE"),
            "Ghost admin key was written to the database in the clear: {}",
            raw.0
        );
        assert!(
            raw.0.contains("enc:v1:"),
            "no sealed value in the stored payload: {}",
            raw.0
        );
        // Non-secret fields stay readable so the row can still be inspected.
        assert!(raw.0.contains("VISIBLE"));

        // And the client gets its plaintext back.
        let load = app
            .oneshot(
                Request::builder()
                    .uri("/api/v1/state?workspace_id=1")
                    .body(Body::empty())
                    .unwrap(),
            )
            .await
            .unwrap();
        let body = axum::body::to_bytes(load.into_body(), 1024 * 1024)
            .await
            .unwrap();
        let env: StateEnvelope = serde_json::from_slice(&body).unwrap();
        let state = env.state.expect("state");
        assert_eq!(
            state["keys"][0]["secret"],
            serde_json::json!("sk-live-SECRETVALUE")
        );
        assert_eq!(
            state["sites"][0]["ghost"]["adminKey"],
            serde_json::json!("id:KEYVALUE")
        );
        assert_eq!(state["harmless"], serde_json::json!("VISIBLE"));
    }

    /// Rows written before encryption existed are sealed on startup.
    #[tokio::test]
    async fn seal_existing_encrypts_a_plaintext_row() {
        init_test_key();
        let pool = test_pool().await;

        // Exactly what the pre-fix store would have written.
        let plaintext = r#"{"keys":[{"id":"k1","secret":"sk-OLDPLAINTEXT"}]}"#;
        sqlx::query(
            "INSERT INTO app_state (workspace_id, generation, payload)
             VALUES (1, 5, ?1)",
        )
        .bind(plaintext)
        .execute(&pool)
        .await
        .unwrap();

        let (sealed, unreadable) = seal_existing(&pool).await.unwrap();
        assert_eq!(sealed, 1, "the plaintext row should have been sealed");
        assert_eq!(unreadable, 0);

        let raw: (String,) = sqlx::query_as("SELECT payload FROM app_state WHERE workspace_id = 1")
            .fetch_one(&pool)
            .await
            .unwrap();
        assert!(
            !raw.0.contains("sk-OLDPLAINTEXT"),
            "still readable after sealing: {}",
            raw.0
        );

        // Generation is untouched by the backfill.
        let gen: (i64,) = sqlx::query_as("SELECT generation FROM app_state WHERE workspace_id = 1")
            .fetch_one(&pool)
            .await
            .unwrap();
        assert_eq!(gen.0, 5, "the backfill must not bump generation");

        // And it still reads back correctly through the handler.
        let load = app(pool)
            .oneshot(
                Request::builder()
                    .uri("/api/v1/state?workspace_id=1")
                    .body(Body::empty())
                    .unwrap(),
            )
            .await
            .unwrap();
        let body = axum::body::to_bytes(load.into_body(), 1024 * 1024)
            .await
            .unwrap();
        let env: StateEnvelope = serde_json::from_slice(&body).unwrap();
        assert_eq!(
            env.state.expect("state")["keys"][0]["secret"],
            serde_json::json!("sk-OLDPLAINTEXT")
        );
    }

    #[tokio::test]
    async fn seal_existing_is_a_no_op_after_the_first_run() {
        init_test_key();
        let pool = test_pool().await;
        sqlx::query(
            "INSERT INTO app_state (workspace_id, generation, payload)
             VALUES (1, 1, ?1)",
        )
        .bind(r#"{"keys":[{"id":"k1","secret":"sk-ONE"}]}"#)
        .execute(&pool)
        .await
        .unwrap();

        assert_eq!(seal_existing(&pool).await.unwrap(), (1, 0));
        // Second boot must not rewrite, or every restart would churn the row.
        assert_eq!(seal_existing(&pool).await.unwrap(), (0, 0));
    }

    #[tokio::test]
    async fn seal_existing_reports_but_does_not_destroy_unparseable_rows() {
        init_test_key();
        let pool = test_pool().await;
        sqlx::query(
            "INSERT INTO app_state (workspace_id, generation, payload)
             VALUES (1, 1, ?1)",
        )
        .bind("{not json at all")
        .execute(&pool)
        .await
        .unwrap();

        let (sealed, unreadable) = seal_existing(&pool).await.unwrap();
        assert_eq!(sealed, 0);
        assert_eq!(unreadable, 1);

        let raw: (String,) = sqlx::query_as("SELECT payload FROM app_state WHERE workspace_id = 1")
            .fetch_one(&pool)
            .await
            .unwrap();
        assert_eq!(
            raw.0, "{not json at all",
            "an unparseable row must be left exactly as found, never dropped"
        );
    }

    #[tokio::test]
    async fn a_row_without_secrets_is_not_rewritten() {
        init_test_key();
        let pool = test_pool().await;
        sqlx::query(
            "INSERT INTO app_state (workspace_id, generation, payload)
             VALUES (1, 1, ?1)",
        )
        .bind(r#"{"sites":[{"id":"s1","url":"https://example.com"}]}"#)
        .execute(&pool)
        .await
        .unwrap();

        assert_eq!(
            seal_existing(&pool).await.unwrap(),
            (0, 0),
            "a row with no secret-shaped fields needs no write"
        );
    }
}
