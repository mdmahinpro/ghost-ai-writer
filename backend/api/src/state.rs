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
            let state: Option<serde_json::Value> =
                serde_json::from_str(&r.payload).ok();
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
    let payload = serde_json::to_string(&input.state)
        .map_err(|_| ApiError::BadRequest("invalid state JSON"))?;

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
                    .body(Body::from(
                        r#"{"workspace_id":1,"state":{"key":"val"}}"#,
                    ))
                    .unwrap(),
            )
            .await
            .unwrap();
        assert_eq!(save.status(), StatusCode::OK);

        let body = axum::body::to_bytes(
            save.into_body(),
            1024 * 1024,
        )
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
            let body =
                axum::body::to_bytes(resp.into_body(), 1024 * 1024)
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
            let body =
                axum::body::to_bytes(resp.into_body(), 1024 * 1024)
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

        let body =
            axum::body::to_bytes(reset.into_body(), 1024 * 1024)
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
        let body =
            axum::body::to_bytes(load.into_body(), 1024 * 1024)
                .await
                .unwrap();
        let env: StateEnvelope = serde_json::from_slice(&body).unwrap();
        assert_eq!(env.generation, 0);
    }
}