//! Calendar automation on the server.
//!
//! The browser used to run this from its store tick (`pulseCalendars`): every
//! few seconds a tab looked for scheduled items and queued the due ones. That
//! meant a scheduled article started writing only while some tab stayed open —
//! close the laptop and the calendar silently stopped.
//!
//! The calendar lives in the persisted app state (`app_state.payload`), so the
//! same decision can be made here, on a loop that outlives every browser. This
//! module does the queueing half. It reads the stored payload, finds items whose
//! `writeAt` has arrived on a calendar with `autoGenerate` on, inserts the job
//! the worker will pick up, and marks the item `WRITING`.
//!
//! Two invariants matter and are both tested below:
//!   * a calendar with `autoGenerate` off is never touched, and
//!   * an item is queued once — `SCHEDULED` flips to `WRITING` in the same
//!     write, so the next pulse cannot queue it again.
//!
//! The payload is stored with credentials sealed (`secrets::encrypt_tree`). We
//! parse and re-serialise it without decrypting those fields, so they are
//! written back exactly as they were found.

use serde_json::Value;
use sqlx::SqlitePool;

/// How often the loop looks for due items. A minute is well inside the
/// scheduling granularity the calendar UI offers (minutes, not seconds).
pub const DEFAULT_INTERVAL_SECS: u64 = 60;

/// What one pulse did, for logging and tests.
#[derive(Debug, Default, PartialEq, Eq)]
pub struct Summary {
    /// Items whose job was created.
    pub queued: usize,
    /// Due items skipped because their site has no server id yet (the client
    /// assigns it on first queue through `POST /api/v1/sites/ensure`).
    pub skipped_no_site: usize,
}

/// A calendar item that is due to start writing.
#[derive(Debug, PartialEq, Eq)]
pub struct DueWrite {
    pub item_id: String,
    pub keyword: String,
}

/// Items whose `writeAt` has arrived and which no writer has started yet.
///
/// Mirrors the client rule exactly: only calendars with `autoGenerate` on, only
/// items still `SCHEDULED`, and only once `writeAt <= now_ms`.
pub fn due_writes(calendar: &Value, now_ms: i64) -> Vec<DueWrite> {
    if calendar.get("autoGenerate").and_then(Value::as_bool) != Some(true) {
        return Vec::new();
    }
    let Some(items) = calendar.get("items").and_then(Value::as_array) else {
        return Vec::new();
    };
    let mut due = Vec::new();
    for item in items {
        if item.get("status").and_then(Value::as_str) != Some("SCHEDULED") {
            continue;
        }
        // A missing writeAt can never be "due": defaulting to 0 would queue the
        // whole calendar on the first tick.
        let Some(write_at) = item.get("writeAt").and_then(Value::as_i64) else {
            continue;
        };
        if write_at > now_ms {
            continue;
        }
        let Some(item_id) = item.get("id").and_then(Value::as_str) else {
            continue;
        };
        let keyword = item
            .get("title")
            .and_then(Value::as_str)
            .unwrap_or("")
            .trim()
            .to_string();
        if keyword.is_empty() {
            continue;
        }
        due.push(DueWrite {
            item_id: item_id.to_string(),
            keyword,
        });
    }
    due
}

/// Record that `item_id` is now being written by `job_id`.
///
/// Returns false when the item vanished between the plan and the write, so the
/// caller does not count a job that nothing points at.
pub fn mark_queued(calendar: &mut Value, item_id: &str, job_id: i64) -> bool {
    let Some(items) = calendar.get_mut("items").and_then(Value::as_array_mut) else {
        return false;
    };
    for item in items {
        if item.get("id").and_then(Value::as_str) != Some(item_id) {
            continue;
        }
        item["status"] = Value::String("WRITING".into());
        item["jobId"] = Value::String(job_id.to_string());
        let attempts = item.get("attempts").and_then(Value::as_i64).unwrap_or(0);
        item["attempts"] = Value::from(attempts + 1);
        return true;
    }
    false
}

/// The numeric site id this calendar's work belongs to.
///
/// The calendar names its site with the UI's string id; the `sites`/`jobs`
/// tables key on integers. `serverSiteId` on the site row is the link, filled in
/// the first time the client queues work for that site.
pub fn server_site_id(state: &Value, calendar: &Value) -> Option<i64> {
    let wanted = calendar.get("siteId").and_then(Value::as_str)?;
    state
        .get("sites")
        .and_then(Value::as_array)?
        .iter()
        .find(|site| site.get("id").and_then(Value::as_str) == Some(wanted))
        .and_then(|site| site.get("serverSiteId"))
        .and_then(Value::as_i64)
}

/// One workspace's worth of work, decided before anything is mutated.
struct PlannedWrite {
    calendar_index: usize,
    site_id: i64,
    item_id: String,
    keyword: String,
}

/// Queue every due calendar item for one workspace.
///
/// The payload is read once, planned completely, then written back once — so a
/// failure part-way cannot leave the state half-updated.
pub async fn pulse(
    pool: &SqlitePool,
    workspace_id: i64,
    now_ms: i64,
) -> Result<Summary, sqlx::Error> {
    let row: Option<(String, i64)> = sqlx::query_as(
        "SELECT payload, generation FROM app_state WHERE workspace_id = ?1",
    )
    .bind(workspace_id)
    .fetch_optional(pool)
    .await?;
    let Some((payload, generation)) = row else {
        return Ok(Summary::default());
    };
    let mut state: Value = match serde_json::from_str(&payload) {
        Ok(value) => value,
        // A payload we cannot parse is not ours to rewrite.
        Err(_) => return Ok(Summary::default()),
    };
    let Some(calendars) = state.get("calendars").and_then(Value::as_array) else {
        return Ok(Summary::default());
    };

    let mut summary = Summary::default();
    let mut planned: Vec<PlannedWrite> = Vec::new();
    for (index, calendar) in calendars.iter().enumerate() {
        let due = due_writes(calendar, now_ms);
        if due.is_empty() {
            continue;
        }
        let Some(site_id) = server_site_id(&state, calendar) else {
            summary.skipped_no_site += due.len();
            continue;
        };
        for write in due {
            planned.push(PlannedWrite {
                calendar_index: index,
                site_id,
                item_id: write.item_id,
                keyword: write.keyword,
            });
        }
    }
    if planned.is_empty() {
        return Ok(summary);
    }

    let created_at = crate::worker::iso_now();
    let mut tx = pool.begin().await?;
    for write in planned {
        let inserted = sqlx::query(
            "INSERT INTO jobs (workspace_id, site_id, keyword, stage, status, created_at) \
             VALUES (?, ?, ?, 'blueprint', 'QUEUED', ?)",
        )
        .bind(workspace_id)
        .bind(write.site_id)
        .bind(&write.keyword)
        .bind(&created_at)
        .execute(&mut *tx)
        .await?;
        let job_id = inserted.last_insert_rowid();
        let queued = state
            .get_mut("calendars")
            .and_then(Value::as_array_mut)
            .and_then(|calendars| calendars.get_mut(write.calendar_index))
            .map(|calendar| mark_queued(calendar, &write.item_id, job_id))
            .unwrap_or(false);
        if queued {
            summary.queued += 1;
        }
    }
    let payload = serde_json::to_string(&state).unwrap_or(payload);
    sqlx::query(
        "UPDATE app_state SET payload = ?1, generation = ?2, updated_at = ?3 \
         WHERE workspace_id = ?4",
    )
    .bind(payload)
    .bind(generation + 1)
    .bind(&created_at)
    .bind(workspace_id)
    .execute(&mut *tx)
    .await?;
    tx.commit().await?;
    Ok(summary)
}

/// Pulse every workspace that has saved state.
pub async fn pulse_all(pool: &SqlitePool, now_ms: i64) -> Result<Summary, sqlx::Error> {
    let ids: Vec<(i64,)> = sqlx::query_as("SELECT workspace_id FROM app_state").fetch_all(pool).await?;
    let mut total = Summary::default();
    for (workspace_id,) in ids {
        let one = pulse(pool, workspace_id, now_ms).await?;
        total.queued += one.queued;
        total.skipped_no_site += one.skipped_no_site;
    }
    Ok(total)
}

#[cfg(test)]
mod tests {
    use super::*;
    use serde_json::json;

    fn calendar(items: Value, auto_generate: bool) -> Value {
        json!({
            "id": "cal_1",
            "siteId": "site_1",
            "autoGenerate": auto_generate,
            "items": items,
        })
    }

    #[test]
    fn only_due_scheduled_items_are_picked_up() {
        let cal = calendar(
            json!([
                { "id": "a", "title": "Due one", "status": "SCHEDULED", "writeAt": 1_000 },
                { "id": "b", "title": "Later", "status": "SCHEDULED", "writeAt": 9_000 },
                { "id": "c", "title": "Already writing", "status": "WRITING", "writeAt": 1_000 },
                { "id": "d", "title": "Published", "status": "PUBLISHED", "writeAt": 1_000 },
            ]),
            true,
        );
        let due = due_writes(&cal, 5_000);
        assert_eq!(due.len(), 1, "{due:?}");
        assert_eq!(due[0].item_id, "a");
        assert_eq!(due[0].keyword, "Due one");
    }

    #[test]
    fn a_calendar_with_automation_off_is_never_touched() {
        let cal = calendar(
            json!([{ "id": "a", "title": "Due", "status": "SCHEDULED", "writeAt": 1 }]),
            false,
        );
        assert!(due_writes(&cal, 5_000).is_empty());
    }

    #[test]
    fn a_missing_write_at_is_not_treated_as_epoch() {
        // Defaulting a missing timestamp to 0 would queue the calendar instantly.
        let cal = calendar(
            json!([{ "id": "a", "title": "No clock", "status": "SCHEDULED" }]),
            true,
        );
        assert!(due_writes(&cal, 5_000).is_empty());
    }

    #[test]
    fn marking_queued_moves_the_item_out_of_the_next_pulse() {
        let mut cal = calendar(
            json!([{ "id": "a", "title": "Due", "status": "SCHEDULED", "writeAt": 1 }]),
            true,
        );
        assert!(mark_queued(&mut cal, "a", 42));
        let item = &cal["items"][0];
        assert_eq!(item["status"], "WRITING");
        assert_eq!(item["jobId"], "42");
        assert_eq!(item["attempts"], 1);
        assert!(due_writes(&cal, 5_000).is_empty(), "a queued item must not queue twice");
    }

    #[test]
    fn the_server_site_id_links_the_calendar_to_the_sql_tables() {
        let state = json!({
            "sites": [
                { "id": "site_1", "serverSiteId": 7 },
                { "id": "site_2" },
            ],
        });
        assert_eq!(server_site_id(&state, &json!({ "siteId": "site_1" })), Some(7));
        // No server id yet: the client assigns it on first queue.
        assert_eq!(server_site_id(&state, &json!({ "siteId": "site_2" })), None);
        assert_eq!(server_site_id(&state, &json!({ "siteId": "absent" })), None);
    }
}
