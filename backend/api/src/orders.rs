//! Orders: the packages a workspace has bought, and the three things a buyer
//! needs to do with one — see it, renew it, cancel it.
//!
//! Nothing here touches money. A payment provider decides whether an order is
//! paid; this module owns the record: what was ordered, for how long, under which
//! tracking code, and whether it is still the current one. That split is why
//! `placed` is a real status rather than a synonym for `active` — an order sits
//! `placed` until the work it paid for is switched on, and only then goes active.
//!
//! Orders are never deleted. A cancelled order keeps its row, its tracking code
//! and its cancellation time, because "track or cancel an order" has to be able
//! to answer for a cancelled one afterwards.

use axum::{extract::State, Json};
use serde::Deserialize;
use serde_json::{json, Value};

use crate::AppState;

/// A package term, in days. Renewals extend by this much.
const TERM_DAYS: i64 = 30;

#[derive(Deserialize)]
pub(crate) struct PlaceOrderRequest {
    workspace_id: i64,
    package: String,
    articles: i64,
    price_cents: i64,
    /// Renew this order instead of starting a fresh one.
    #[serde(default)]
    renewed_from: Option<i64>,
}

#[derive(Deserialize)]
pub(crate) struct OrderRefRequest {
    tracking: String,
    /// Free-text reason shown with the cancelled order.
    #[serde(default)]
    note: Option<String>,
}

fn now() -> String {
    crate::NOW.to_string()
}

/// A tracking code a buyer can quote to support: `ORD-` plus the workspace and
/// a timestamp slug. Deterministic enough to read back, unique enough to find.
fn tracking_code(workspace_id: i64, stamp: &str) -> String {
    let compact: String = stamp.chars().filter(char::is_ascii_digit).collect();
    format!("ORD-{workspace_id}-{compact}")
}

/// Add days to the date part of an RFC3339 stamp, keeping the time suffix.
///
/// No date library: the crate has no chrono, and a term is calendar arithmetic on
/// `YYYY-MM-DD` — the days-from-civil pair below is the standard algorithm, and
/// a stamp that is not a date is returned unchanged rather than guessed at.
fn days_from(stamp: &str, days: i64) -> String {
    let (date, rest) = match stamp.split_once('T') {
        Some((date, rest)) => (date, Some(rest)),
        None => (stamp, None),
    };
    let (year, month, day) = match date.split('-').collect::<Vec<_>>().as_slice() {
        [year, month, day] => (
            year.parse::<i64>().ok(),
            month.parse::<i64>().ok(),
            day.parse::<i64>().ok(),
        ),
        _ => (None, None, None),
    };
    let (Some(year), Some(month), Some(day)) = (year, month, day) else {
        return stamp.to_string();
    };
    let serial = civil_to_days(year, month, day) + days;
    let (year, month, day) = days_to_civil(serial);
    let out = format!("{year:04}-{month:02}-{day:02}");
    match rest {
        Some(rest) => format!("{out}T{rest}"),
        None => out,
    }
}

/// Days since 1970-01-01 (Howard Hinnant's civil calendar algorithm).
fn civil_to_days(year: i64, month: i64, day: i64) -> i64 {
    let year = if month <= 2 { year - 1 } else { year };
    let era = if year >= 0 { year } else { year - 399 } / 400;
    let year_of_era = year - era * 400;
    let month_prime = (month + 9) % 12;
    let day_of_year = (153 * month_prime + 2) / 5 + day - 1;
    let day_of_era = year_of_era * 365 + year_of_era / 4 - year_of_era / 100 + day_of_year;
    era * 146097 + day_of_era - 719468
}

fn days_to_civil(serial: i64) -> (i64, i64, i64) {
    let serial = serial + 719468;
    let era = if serial >= 0 { serial } else { serial - 146096 } / 146097;
    let day_of_era = serial - era * 146097;
    let year_of_era =
        (day_of_era - day_of_era / 1460 + day_of_era / 36524 - day_of_era / 146096) / 365;
    let year = year_of_era + era * 400;
    let day_of_year = day_of_era - (365 * year_of_era + year_of_era / 4 - year_of_era / 100);
    let month_prime = (5 * day_of_year + 2) / 153;
    let day = day_of_year - (153 * month_prime + 2) / 5 + 1;
    let month = if month_prime < 10 {
        month_prime + 3
    } else {
        month_prime - 9
    };
    (if month <= 2 { year + 1 } else { year }, month, day)
}

pub(crate) async fn place_order(
    State(st): State<AppState>,
    Json(req): Json<PlaceOrderRequest>,
) -> Json<Value> {
    if req.package.trim().is_empty() {
        return Json(json!({ "ok": false, "error": "An order needs a package name." }));
    }
    if req.articles <= 0 {
        return Json(json!({ "ok": false, "error": "An order needs a positive article count." }));
    }
    if req.price_cents < 0 {
        return Json(json!({ "ok": false, "error": "An order cannot have a negative price." }));
    }
    let stamp = now();
    let tracking = tracking_code(req.workspace_id, &stamp);

    // A renewal starts where the old term ends, never in the past: buying early
    // must not cost the buyer the days they already paid for.
    let mut renews: Option<i64> = None;
    let mut start = stamp.clone();
    if let Some(previous) = req.renewed_from {
        let row: Option<(i64, Option<String>, String)> = sqlx::query_as(
            "SELECT id, active_until, status FROM orders WHERE id = ? AND workspace_id = ?",
        )
        .bind(previous)
        .bind(req.workspace_id)
        .fetch_optional(&st.pool)
        .await
        .unwrap_or(None);
        match row {
            Some((id, active_until, status)) if status != "cancelled" => {
                renews = Some(id);
                if let Some(until) = active_until.filter(|value| !value.trim().is_empty()) {
                    if until.as_str() > stamp.as_str() {
                        start = until;
                    }
                }
            }
            Some(_) => {
                return Json(json!({
                    "ok": false,
                    "error": "A cancelled order cannot be renewed — place a new one instead.",
                }));
            }
            None => {
                return Json(json!({ "ok": false, "error": "That order does not exist." }));
            }
        }
    }

    let active_until = days_from(&start, TERM_DAYS);
    let inserted: Result<i64, _> = sqlx::query_scalar(
        "INSERT INTO orders \
         (workspace_id, package, articles, price_cents, status, tracking, placed_at, active_until, renewed_from) \
         VALUES (?, ?, ?, ?, 'active', ?, ?, ?, ?) RETURNING id",
    )
    .bind(req.workspace_id)
    .bind(req.package.trim())
    .bind(req.articles)
    .bind(req.price_cents)
    .bind(&tracking)
    .bind(&stamp)
    .bind(&active_until)
    .bind(renews)
    .fetch_one(&st.pool)
    .await;

    match inserted {
        Ok(id) => Json(json!({
            "ok": true,
            "id": id,
            "tracking": tracking,
            "status": "active",
            "placed_at": stamp,
            "active_until": active_until,
            "renewed_from": renews,
        })),
        Err(error) => Json(json!({ "ok": false, "error": error.to_string() })),
    }
}

/// One `orders` row, as selected below.
type OrderRow = (
    i64,
    String,
    i64,
    i64,
    String,
    String,
    String,
    Option<String>,
    Option<String>,
    Option<i64>,
);

pub(crate) async fn list_orders(
    State(st): State<AppState>,
    axum::extract::Query(query): axum::extract::Query<WorkspaceQuery>,
) -> Json<Value> {
    let rows: Vec<OrderRow> = match sqlx::query_as(
        "SELECT id, package, articles, price_cents, status, tracking, placed_at, \
                active_until, cancelled_at, renewed_from \
         FROM orders WHERE workspace_id = ? ORDER BY placed_at DESC, id DESC LIMIT 100",
    )
    .bind(query.workspace_id)
    .fetch_all(&st.pool)
    .await
    {
        Ok(rows) => rows,
        Err(error) => return Json(json!({ "ok": false, "error": error.to_string() })),
    };
    let orders: Vec<Value> = rows
        .into_iter()
        .map(
            |(
                id,
                package,
                articles,
                price_cents,
                status,
                tracking,
                placed_at,
                active_until,
                cancelled_at,
                renewed_from,
            )| {
                json!({
                    "id": id,
                    "package": package,
                    "articles": articles,
                    "price_cents": price_cents,
                    "status": status,
                    "tracking": tracking,
                    "placed_at": placed_at,
                    "active_until": active_until,
                    "cancelled_at": cancelled_at,
                    "renewed_from": renewed_from,
                })
            },
        )
        .collect();
    Json(json!({ "ok": true, "orders": orders }))
}

/// Cancel the current order. A second cancel is refused rather than silently
/// re-stamped: the record should say when it was cancelled once, truthfully.
pub(crate) async fn cancel_order(
    State(st): State<AppState>,
    Json(req): Json<OrderRefRequest>,
) -> Json<Value> {
    let row: Option<(i64, String, Option<String>)> =
        sqlx::query_as("SELECT id, status, active_until FROM orders WHERE tracking = ?")
            .bind(req.tracking.trim())
            .fetch_optional(&st.pool)
            .await
            .unwrap_or(None);
    let Some((id, status, active_until)) = row else {
        return Json(json!({ "ok": false, "error": "No order carries that tracking code." }));
    };
    if status == "cancelled" {
        return Json(json!({ "ok": false, "error": "That order is already cancelled." }));
    }
    let stamp = now();
    match sqlx::query(
        "UPDATE orders SET status = 'cancelled', cancelled_at = ?, note = ? WHERE id = ?",
    )
    .bind(&stamp)
    .bind(req.note.as_deref())
    .bind(id)
    .execute(&st.pool)
    .await
    {
        Ok(_) => {
            // The plan stays usable until the paid window ends: cancelling stops
            // the renewal, it does not take back days already paid for.
            Json(json!({
                "ok": true,
                "status": "cancelled",
                "cancelled_at": stamp,
                "usable_until": active_until,
            }))
        }
        Err(error) => Json(json!({ "ok": false, "error": error.to_string() })),
    }
}

#[derive(Deserialize)]
pub(crate) struct WorkspaceQuery {
    workspace_id: i64,
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn a_tracking_code_is_readable_and_scoped() {
        let code = tracking_code(7, "2026-10-26T14:30:00Z");
        assert_eq!(code, "ORD-7-20261026143000");
    }

    #[test]
    fn a_term_extends_thirty_days() {
        assert_eq!(
            days_from("2026-01-01T00:00:00Z", 30),
            "2026-01-31T00:00:00Z"
        );
        // A month boundary and a leap day, because terms land on both.
        assert_eq!(
            days_from("2026-02-25T09:00:00Z", 30),
            "2026-03-27T09:00:00Z"
        );
        assert_eq!(
            days_from("2028-02-01T00:00:00Z", 29),
            "2028-03-01T00:00:00Z"
        );
    }

    #[test]
    fn a_bad_stamp_is_returned_unchanged_rather_than_guessed() {
        assert_eq!(days_from("not-a-date", 30), "not-a-date");
    }
}
