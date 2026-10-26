//! Calendar automation on the server.
//!
//! The browser used to run this from its store tick (`pulseCalendars`): every
//! few seconds a tab looked for scheduled items, queued the due ones, and
//! released the ones whose publish time had arrived. Close the laptop and the
//! calendar silently stopped — work that never happens is worse than work that
//! fails loudly.
//!
//! The calendar lives in the persisted app state (`app_state.payload`), so the
//! same decisions can be made here, on a loop that outlives every browser:
//!
//!   * **queue** — items still `SCHEDULED` on a calendar with `autoGenerate` on
//!     whose `writeAt` has arrived become jobs for the worker;
//!   * **publish** — items `READY` on a calendar with `autoPublish` on whose
//!     `publishAt` has arrived are released and pushed to Ghost.
//!
//! Both switches are default-OFF and are the only thing that authorises an
//! unattended write, so a calendar nobody armed is never touched.
//!
//! Invariants that are tested below:
//!   * a calendar with the switch off is never touched;
//!   * an item is queued once — `SCHEDULED` flips to `WRITING` in the same
//!     transaction, so the next pulse cannot queue it again;
//!   * a live publish still waits for the humanizer (Rule 3d), exactly as the
//!     desk worker did, and is reported as held rather than silently skipped.
//!
//! The payload is stored with credentials sealed (`secrets::encrypt_tree`). We
//! parse and re-serialise it without decrypting, so sealed fields are written
//! back exactly as found; only a throwaway copy is decrypted to read a site's
//! Ghost admin key while publishing.

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
    /// Items pushed to Ghost.
    pub published: usize,
    /// Items whose publish was withheld pending humanization (Rule 3d).
    pub held: usize,
    /// Items whose publish was attempted and refused.
    pub failed: usize,
    /// Calendars that gained at least one proposed link.
    pub reweaved: usize,
}

/// A calendar item that is due to start writing.
#[derive(Debug, PartialEq, Eq)]
pub struct DueWrite {
    pub item_id: String,
    pub keyword: String,
}

/// A calendar item that is due to publish.
#[derive(Debug, PartialEq, Eq)]
pub struct DuePublish {
    pub item_id: String,
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

/// Items whose `publishAt` has arrived and which already have an article.
///
/// Only `READY` items count: `WRITING` means the article is still being
/// produced, and everything else is already published or deliberately parked.
/// `autoPublish` must be on and `jobId` must be set — the client's
/// `publishCalendarItemNow` refuses an item it has not written yet, and an
/// unattended path must be stricter, not looser.
pub fn due_publishes(calendar: &Value, now_ms: i64) -> Vec<DuePublish> {
    if calendar.get("autoPublish").and_then(Value::as_bool) != Some(true) {
        return Vec::new();
    }
    let Some(items) = calendar.get("items").and_then(Value::as_array) else {
        return Vec::new();
    };
    let mut due = Vec::new();
    for item in items {
        if item.get("status").and_then(Value::as_str) != Some("READY") {
            continue;
        }
        if item.get("jobId").and_then(Value::as_str).is_none() {
            continue;
        }
        let Some(publish_at) = item.get("publishAt").and_then(Value::as_i64) else {
            continue;
        };
        if publish_at > now_ms {
            continue;
        }
        let Some(item_id) = item.get("id").and_then(Value::as_str) else {
            continue;
        };
        due.push(DuePublish {
            item_id: item_id.to_string(),
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

/// Record the outcome of a publish. Moving the item out of `READY` is what stops
/// the next pulse from publishing it again.
pub fn mark_published(
    calendar: &mut Value,
    item_id: &str,
    status: &str,
    note: Option<&str>,
) -> bool {
    let Some(items) = calendar.get_mut("items").and_then(Value::as_array_mut) else {
        return false;
    };
    for item in items {
        if item.get("id").and_then(Value::as_str) != Some(item_id) {
            continue;
        }
        item["status"] = Value::String(status.into());
        if let Some(note) = note {
            item["note"] = Value::String(note.into());
        }
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

fn row_by_id<'a>(state: &'a Value, key: &str, id: &str) -> Option<&'a Value> {
    state
        .get(key)
        .and_then(Value::as_array)?
        .iter()
        .find(|row| row.get("id").and_then(Value::as_str) == Some(id))
}

fn text(node: &Value, key: &str) -> String {
    node.get(key)
        .and_then(Value::as_str)
        .unwrap_or("")
        .to_string()
}

/// Why a due item could not be published.
#[derive(Debug, PartialEq, Eq)]
pub enum PublishBlock {
    /// Rule 3d: a live publish waits for the humanizer to finish.
    Held,
    /// The state is not ready for this item yet (no article, no Ghost key).
    Missing(String),
}

/// Build the Ghost publish body for one calendar item.
///
/// `state` must be a **decrypted** copy: the site's admin key is sealed at rest
/// and is the one secret this path genuinely needs.
pub fn publish_request(
    state: &Value,
    calendar: &Value,
    item_id: &str,
) -> Result<crate::ghost_api::PublishRequest, PublishBlock> {
    let item = calendar
        .get("items")
        .and_then(Value::as_array)
        .and_then(|items| {
            items
                .iter()
                .find(|item| item.get("id").and_then(Value::as_str) == Some(item_id))
        })
        .ok_or_else(|| PublishBlock::Missing("calendar item vanished".into()))?;
    let article_id = item
        .get("articleId")
        .and_then(Value::as_str)
        .ok_or_else(|| PublishBlock::Missing("item has no article yet".into()))?;
    let site_id = calendar
        .get("siteId")
        .and_then(Value::as_str)
        .ok_or_else(|| PublishBlock::Missing("calendar has no site".into()))?;
    let article = row_by_id(state, "articles", article_id)
        .ok_or_else(|| PublishBlock::Missing("article not found".into()))?;
    let site = row_by_id(state, "sites", site_id)
        .ok_or_else(|| PublishBlock::Missing("site not found".into()))?;
    let ghost = site.get("ghost").cloned().unwrap_or(Value::Null);
    let url = text(&ghost, "url");
    let admin_key = text(&ghost, "adminKey");
    if url.is_empty() || admin_key.is_empty() {
        return Err(PublishBlock::Missing("site has no Ghost connection".into()));
    }

    let article_status = text(article, "status");
    // Rule 3d: hold rather than publish prose that is mid-humanization.
    //
    // The flag is only ever set by the browser's HumanizePipeline, which is why
    // an ABSENT value is publishable rather than held: the Rust pipeline folds
    // the humanizer constitution into its own draft/revision prompts and has no
    // second pass to wait for. Holding on absence would mean an armed calendar
    // never publishes anything produced server-side — a silent deadlock.
    let human_state = text(article, "humanState");
    if article_status == "published" && matches!(human_state.as_str(), "running" | "pending") {
        return Err(PublishBlock::Held);
    }

    let images = article
        .get("images")
        .and_then(Value::as_array)
        .map(|rows| {
            rows.iter()
                .filter(|image| image.get("selected").and_then(Value::as_bool) == Some(true))
                .filter(|image| image.get("src").and_then(Value::as_str).is_some())
                .map(|image| crate::ghost_api::PublishImage {
                    src: image.get("src").and_then(Value::as_str).map(str::to_string),
                    remote: image
                        .get("remote")
                        .and_then(Value::as_str)
                        .map(str::to_string),
                    role: image
                        .get("role")
                        .and_then(Value::as_str)
                        .map(str::to_string),
                    alt: text(image, "alt"),
                })
                .collect()
        })
        .unwrap_or_default();

    // Rule 2: the byline travels as an external portrait URL, never a download.
    let author_id = text(article, "authorId");
    let author =
        row_by_id(state, "authors", &author_id).map(|author| crate::ghost_api::PublishAuthor {
            name: text(author, "name"),
            slug: Some(text(author, "slug")).filter(|value| !value.is_empty()),
            bio: Some(text(author, "shortBio")),
            profile_image: Some(text(author, "avatarUrl")),
            known_ghost_author_id: Some(text(author, "ghostAuthorId"))
                .filter(|value| !value.is_empty()),
        });

    Ok(crate::ghost_api::PublishRequest {
        url,
        admin_key,
        title: text(article, "title"),
        slug: text(article, "slug"),
        html: text(article, "html"),
        excerpt: text(article, "excerpt"),
        meta_description: Some(text(article, "metaDescription")).filter(|value| !value.is_empty()),
        status: Some(if article_status == "published" {
            "published".into()
        } else {
            "draft".into()
        }),
        tags: article
            .get("tags")
            .and_then(Value::as_array)
            .map(|tags| {
                tags.iter()
                    .filter_map(Value::as_str)
                    .map(str::to_string)
                    .collect()
            })
            .unwrap_or_default(),
        images,
        author,
    })
}

/// Words that make a poor anchor; mirrors `STOP` in `src/lib/link-graph.ts` so a
/// link proposed on the server reads the same as one proposed in the browser.
const ANCHOR_STOP: &[&str] = &[
    "a", "an", "the", "of", "for", "and", "to", "in", "on", "how", "with", "your", "that", "this",
    "from", "what", "when", "who", "why", "into", "over", "about", "between", "without", "than",
    "then", "are", "was", "were", "will", "just", "more", "most",
];

/// The words a link should hang on: up to four content words, or the raw title
/// when it is too short to be useful.
pub fn anchor_phrase(title: &str) -> String {
    let raw: String = title
        .chars()
        .filter(|c| !matches!(c, '"' | '\'' | '\u{201c}' | '\u{201d}'))
        .collect();
    let raw = raw.trim().to_string();
    let words: Vec<&str> = raw.split_whitespace().collect();
    let content: Vec<&str> = words
        .iter()
        .copied()
        .filter(|word| {
            let cleaned: String = word
                .to_lowercase()
                .chars()
                .filter(char::is_ascii_alphanumeric)
                .collect();
            !ANCHOR_STOP.contains(&cleaned.as_str())
        })
        .collect();
    let pick: Vec<&str> = if content.len() >= 2 {
        content
    } else {
        words.clone()
    };
    let phrase: String = pick
        .iter()
        .take(4)
        .copied()
        .collect::<Vec<_>>()
        .join(" ")
        .trim_end_matches(['.', ':', ';', ','])
        .to_string();
    if phrase.chars().count() >= 8 {
        phrase
    } else {
        raw.chars().take(72).collect()
    }
}

fn index_by_id(state: &Value, key: &str, id: &str) -> Option<usize> {
    state
        .get(key)
        .and_then(Value::as_array)?
        .iter()
        .position(|row| row.get("id").and_then(Value::as_str) == Some(id))
}

/// One published calendar item, as reweave sees it.
struct PublishedItem {
    article_id: String,
    kind: String,
}

/// Propose sibling links between the published items of one calendar.
///
/// Each article points at one sibling — a pillar when the calendar has one,
/// otherwise the first published sibling — and only once. Returns the number of
/// links added, so a pulse that changed nothing writes nothing.
pub fn reweave(state: &mut Value, calendar_index: usize, now_ms: i64) -> usize {
    let Some(calendar) = state
        .get("calendars")
        .and_then(Value::as_array)
        .and_then(|rows| rows.get(calendar_index))
    else {
        return 0;
    };
    if calendar.get("autoReweave").and_then(Value::as_bool) != Some(true) {
        return 0;
    }
    let site_id = text(calendar, "siteId");
    let published: Vec<PublishedItem> = calendar
        .get("items")
        .and_then(Value::as_array)
        .map(|items| {
            items
                .iter()
                .filter(|item| item.get("status").and_then(Value::as_str) == Some("PUBLISHED"))
                .filter_map(|item| {
                    let article_id = item.get("articleId").and_then(Value::as_str)?.to_string();
                    Some(PublishedItem {
                        article_id,
                        kind: text(item, "kind"),
                    })
                })
                .collect()
        })
        .unwrap_or_default();
    if published.len() < 2 {
        return 0;
    }

    let mut added: Vec<(String, String)> = Vec::new();
    for item in &published {
        let Some(own) = index_by_id(state, "articles", &item.article_id) else {
            continue;
        };
        let siblings: Vec<&PublishedItem> = published
            .iter()
            .filter(|other| other.article_id != item.article_id)
            .collect();
        let target = siblings
            .iter()
            .find(|other| other.kind == "pillar")
            .or_else(|| siblings.first());
        let Some(target) = target else { continue };
        let Some(theirs) = index_by_id(state, "articles", &target.article_id) else {
            continue;
        };
        let target_slug = text(&state["articles"][theirs], "slug");
        if target_slug.is_empty() {
            continue;
        }
        let linked = state["articles"][own]
            .get("links")
            .and_then(Value::as_array)
            .map(|links| {
                links.iter().any(|link| {
                    link.get("targetSlug").and_then(Value::as_str) == Some(target_slug.as_str())
                })
            })
            .unwrap_or(false);
        if linked {
            continue;
        }
        let anchor = anchor_phrase(&text(&state["articles"][theirs], "title"));
        let own_title = text(&state["articles"][own], "title");
        let target_title = text(&state["articles"][theirs], "title");

        let row = &mut state["articles"][own];
        if !row.get("links").map(Value::is_array).unwrap_or(false) {
            row["links"] = Value::Array(Vec::new());
        }
        if let Some(links) = row.get_mut("links").and_then(Value::as_array_mut) {
            links.push(serde_json::json!({
                "anchor": anchor,
                "targetSlug": target_slug,
                "state": "LOCAL",
            }));
        }
        added.push((own_title, target_title));
    }
    if added.is_empty() {
        return 0;
    }

    // Newest first, the same place the client logged it.
    for (offset, (from, to)) in added.iter().enumerate() {
        let entry = serde_json::json!({
            "id": format!("act_{}_{}", now_ms, offset),
            "at": now_ms,
            "siteId": site_id,
            "tone": "info",
            "message": format!("Auto-reweave proposed link · {from} → {to}"),
        });
        if !state.get("activity").map(Value::is_array).unwrap_or(false) {
            state["activity"] = Value::Array(Vec::new());
        }
        if let Some(activity) = state.get_mut("activity").and_then(Value::as_array_mut) {
            activity.insert(offset.min(activity.len()), entry);
        }
    }
    added.len()
}

/// One workspace's worth of queueing, decided before anything is mutated.
struct PlannedWrite {
    calendar_index: usize,
    site_id: i64,
    item_id: String,
    keyword: String,
}

/// Queue and publish everything due for one workspace.
///
/// The payload is read once, planned completely, then written back once — so a
/// failure part-way cannot leave the state half-updated. Ghost calls happen
/// outside the queue transaction: a slow publish must not hold a database lock.
pub async fn pulse(
    pool: &SqlitePool,
    workspace_id: i64,
    now_ms: i64,
) -> Result<Summary, sqlx::Error> {
    let row: Option<(String, i64)> =
        sqlx::query_as("SELECT payload, generation FROM app_state WHERE workspace_id = ?1")
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
    let mut publishes: Vec<(usize, String)> = Vec::new();
    for (index, calendar) in calendars.iter().enumerate() {
        for due in due_publishes(calendar, now_ms) {
            publishes.push((index, due.item_id));
        }
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
    // Reweave has no due-time of its own: it only needs published items, so a
    // workspace with reweave armed must still be visited when nothing queued.
    let reweave_armed = calendars
        .iter()
        .any(|calendar| calendar.get("autoReweave").and_then(Value::as_bool) == Some(true));
    if planned.is_empty() && publishes.is_empty() && !reweave_armed {
        return Ok(summary);
    }

    let created_at = crate::worker::iso_now();
    let mut changed = false;

    // --- queueing: one transaction, no network inside it ---
    if !planned.is_empty() {
        let mut tx = pool.begin().await?;
        for write in &planned {
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
        tx.commit().await?;
        changed = true;
    }

    // --- publishing: network, then a single state write below ---
    if !publishes.is_empty() {
        // Decrypt a throwaway copy: the admin key is sealed at rest, and the
        // sealed original must be written back untouched.
        let mut plain = state.clone();
        crate::secrets::decrypt_tree(&mut plain);
        for (index, item_id) in publishes {
            let Some(calendar_plain) = plain
                .get("calendars")
                .and_then(Value::as_array)
                .and_then(|rows| rows.get(index))
                .cloned()
            else {
                continue;
            };
            let outcome = match publish_request(&plain, &calendar_plain, &item_id) {
                Ok(request) => {
                    let result = crate::ghost_api::publish(&request).await;
                    if result.get("ok").and_then(Value::as_bool) == Some(true) {
                        // The status we asked Ghost for is the status to show.
                        if request.status.as_deref() == Some("published") {
                            Ok("PUBLISHED")
                        } else {
                            Ok("DRAFT_SAVED")
                        }
                    } else {
                        Err(PublishBlock::Missing(
                            result
                                .get("error")
                                .and_then(Value::as_str)
                                .unwrap_or("Ghost refused the post")
                                .to_string(),
                        ))
                    }
                }
                Err(block) => Err(block),
            };
            let Some(calendar) = state
                .get_mut("calendars")
                .and_then(Value::as_array_mut)
                .and_then(|rows| rows.get_mut(index))
            else {
                continue;
            };
            match outcome {
                Ok(status) => {
                    mark_published(calendar, &item_id, status, None);
                    summary.published += 1;
                }
                Err(PublishBlock::Held) => {
                    // Stay READY so the next pulse retries once the humanizer
                    // lands, and say why on the row.
                    mark_published(
                        calendar,
                        &item_id,
                        "READY",
                        Some("Held at publish policy: blader humanization is still running."),
                    );
                    summary.held += 1;
                }
                Err(PublishBlock::Missing(reason)) => {
                    // A hard failure must not retry forever: mark it FAILED so
                    // the operator sees it instead of an invisible loop.
                    mark_published(calendar, &item_id, "FAILED", Some(&reason));
                    summary.failed += 1;
                }
            }
            changed = true;
        }
    }

    // --- reweave: propose sibling links among what is already published ---
    //
    // After publishing, so an item that went live this pulse can take part.
    let calendar_count = state
        .get("calendars")
        .and_then(Value::as_array)
        .map(|rows| rows.len())
        .unwrap_or(0);
    for index in 0..calendar_count {
        let armed = state
            .get("calendars")
            .and_then(Value::as_array)
            .and_then(|rows| rows.get(index))
            .and_then(|calendar| calendar.get("autoReweave"))
            .and_then(Value::as_bool)
            == Some(true);
        if !armed {
            continue;
        }
        if reweave(&mut state, index, now_ms) > 0 {
            summary.reweaved += 1;
            changed = true;
        }
    }

    if changed {
        let payload = serde_json::to_string(&state).unwrap_or(payload);
        sqlx::query(
            "UPDATE app_state SET payload = ?1, generation = ?2, updated_at = ?3 \
             WHERE workspace_id = ?4",
        )
        .bind(payload)
        .bind(generation + 1)
        .bind(&created_at)
        .bind(workspace_id)
        .execute(pool)
        .await?;
    }
    Ok(summary)
}

/// Pulse every workspace that has saved state.
pub async fn pulse_all(pool: &SqlitePool, now_ms: i64) -> Result<Summary, sqlx::Error> {
    let ids: Vec<(i64,)> = sqlx::query_as("SELECT workspace_id FROM app_state")
        .fetch_all(pool)
        .await?;
    let mut total = Summary::default();
    for (workspace_id,) in ids {
        let one = pulse(pool, workspace_id, now_ms).await?;
        total.queued += one.queued;
        total.skipped_no_site += one.skipped_no_site;
        total.published += one.published;
        total.held += one.held;
        total.failed += one.failed;
        total.reweaved += one.reweaved;
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
            "autoPublish": false,
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
        assert!(
            due_writes(&cal, 5_000).is_empty(),
            "a queued item must not queue twice"
        );
    }

    #[test]
    fn the_server_site_id_links_the_calendar_to_the_sql_tables() {
        let state = json!({
            "sites": [
                { "id": "site_1", "serverSiteId": 7 },
                { "id": "site_2" },
            ],
        });
        assert_eq!(
            server_site_id(&state, &json!({ "siteId": "site_1" })),
            Some(7)
        );
        // No server id yet: the client assigns it on first queue.
        assert_eq!(server_site_id(&state, &json!({ "siteId": "site_2" })), None);
        assert_eq!(server_site_id(&state, &json!({ "siteId": "absent" })), None);
    }

    fn publishable_calendar() -> Value {
        json!({
            "id": "cal_1",
            "siteId": "site_1",
            "autoPublish": true,
            "items": [
                { "id": "p1", "status": "READY", "jobId": "9", "articleId": "art_1", "publishAt": 1_000 },
                { "id": "p2", "status": "WRITING", "jobId": "10", "articleId": "art_2", "publishAt": 1_000 },
                { "id": "p3", "status": "READY", "articleId": "art_3", "publishAt": 1_000 },
                { "id": "p4", "status": "READY", "jobId": "11", "articleId": "art_4", "publishAt": 9_999 },
            ],
        })
    }

    #[test]
    fn only_ready_written_and_due_items_are_published() {
        // Not yet written (p2), never written (p3), and not due yet (p4) stay put.
        let due = due_publishes(&publishable_calendar(), 5_000);
        assert_eq!(due.len(), 1, "{due:?}");
        assert_eq!(due[0].item_id, "p1");
    }

    #[test]
    fn publishing_off_means_nothing_is_published() {
        let mut cal = publishable_calendar();
        cal["autoPublish"] = json!(false);
        assert!(due_publishes(&cal, 5_000).is_empty());
        cal["autoPublish"] = json!("yes"); // a string is not a switch
        assert!(due_publishes(&cal, 5_000).is_empty());
    }

    #[test]
    fn publishing_again_cannot_happen_once_the_item_moves() {
        let mut cal = publishable_calendar();
        assert!(mark_published(&mut cal, "p1", "PUBLISHED", None));
        assert!(due_publishes(&cal, 5_000).is_empty());
    }

    fn state_with_article(human_state: &str, article_status: &str) -> Value {
        json!({
            "sites": [{
                "id": "site_1",
                "ghost": { "url": "https://cms.example.com", "adminKey": "kid:secret" },
            }],
            "authors": [{ "id": "auth_1", "name": "Dana Reed", "slug": "dana-reed" }],
            "articles": [{
                "id": "art_1",
                "title": "A post",
                "slug": "a-post",
                "html": "<p>body</p>",
                "excerpt": "short",
                "status": article_status,
                "humanState": human_state,
                "authorId": "auth_1",
                "tags": ["one", "two"],
                "images": [{ "selected": true, "src": "https://img/x.jpg", "alt": "x" }],
            }],
        })
    }

    #[test]
    fn anchor_phrases_match_the_client_rule() {
        // Up to four content words, stopwords dropped.
        assert_eq!(
            anchor_phrase("How to build a content calendar"),
            "build content calendar"
        );
        // A title that is already short keeps its whole self.
        assert_eq!(anchor_phrase("Pricing"), "Pricing");
        // Quotes are stripped, and "that" is a stopword like in the client set.
        assert_eq!(
            anchor_phrase("\u{201c}Caching strategies that work\u{201d}"),
            "Caching strategies work"
        );
    }

    fn reweave_state(auto_reweave: bool) -> Value {
        json!({
            "calendars": [{
                "id": "cal_1",
                "siteId": "site_1",
                "autoReweave": auto_reweave,
                "items": [
                    { "id": "i1", "status": "PUBLISHED", "articleId": "art_1", "kind": "pillar" },
                    { "id": "i2", "status": "PUBLISHED", "articleId": "art_2", "kind": "cluster" },
                    { "id": "i3", "status": "SCHEDULED", "articleId": "art_3", "kind": "cluster" },
                ],
            }],
            "articles": [
                { "id": "art_1", "title": "The Pillar Guide", "slug": "pillar-guide", "links": [] },
                { "id": "art_2", "title": "A Cluster Post", "slug": "cluster-post", "links": [] },
                { "id": "art_3", "title": "Not Published", "slug": "not-published", "links": [] },
            ],
            "activity": [],
        })
    }

    #[test]
    fn reweave_points_each_published_article_at_the_pillar() {
        let mut state = reweave_state(true);
        // Both published articles gain one link each: the cluster points at the
        // pillar, and the pillar at its only sibling.
        assert_eq!(reweave(&mut state, 0, 1_000), 2);
        // The cluster post gains a link to the pillar...
        let cluster = &state["articles"][1];
        assert_eq!(cluster["links"][0]["targetSlug"], "pillar-guide");
        assert_eq!(cluster["links"][0]["state"], "LOCAL");
        // ...and the pillar points at the only sibling it has.
        assert_eq!(
            state["articles"][0]["links"][0]["targetSlug"],
            "cluster-post"
        );
    }

    #[test]
    fn reweave_does_not_touch_unpublished_items_or_repeat_itself() {
        let mut state = reweave_state(true);
        reweave(&mut state, 0, 1_000);
        assert_eq!(state["articles"][2]["links"], json!([]));
        // A second pulse proposes nothing, so the caller writes nothing.
        let before = state.clone();
        assert_eq!(reweave(&mut state, 0, 2_000), 0);
        assert_eq!(state, before);
    }

    #[test]
    fn reweave_off_is_a_no_op() {
        let mut state = reweave_state(false);
        assert_eq!(reweave(&mut state, 0, 1_000), 0);
        assert_eq!(state["articles"][1]["links"], json!([]));
    }

    #[test]
    fn a_live_publish_waits_for_the_humanizer() {
        let cal = publishable_calendar();
        let state = state_with_article("running", "published");
        assert_eq!(
            publish_request(&state, &cal, "p1").unwrap_err(),
            PublishBlock::Held
        );
        // A draft is not a live publish, so the hold does not apply.
        let state = state_with_article("running", "draft");
        assert!(publish_request(&state, &cal, "p1").is_ok());
    }

    #[test]
    fn a_server_written_article_with_no_humanizer_flag_is_publishable() {
        // Nothing on the server ever sets humanState; holding on absence would
        // deadlock an armed calendar. Only a pass in flight may hold.
        let mut state = state_with_article("done", "published");
        state["articles"][0]
            .as_object_mut()
            .unwrap()
            .remove("humanState");
        assert!(publish_request(&state, &publishable_calendar(), "p1").is_ok());
        // An explicit in-flight pass still holds.
        let state = state_with_article("pending", "published");
        assert_eq!(
            publish_request(&state, &publishable_calendar(), "p1").unwrap_err(),
            PublishBlock::Held
        );
    }

    #[test]
    fn the_request_carries_the_ghost_target_and_the_byline() {
        let state = state_with_article("done", "published");
        let request = publish_request(&state, &publishable_calendar(), "p1").unwrap();
        assert_eq!(request.url, "https://cms.example.com");
        assert_eq!(request.admin_key, "kid:secret");
        assert_eq!(request.status.as_deref(), Some("published"));
        assert_eq!(request.tags, vec!["one", "two"]);
        assert_eq!(request.images.len(), 1);
        assert_eq!(
            request.author.as_ref().map(|author| author.name.as_str()),
            Some("Dana Reed")
        );
    }

    #[test]
    fn a_site_without_a_ghost_connection_is_reported_not_guessed() {
        let mut state = state_with_article("done", "published");
        state["sites"][0]["ghost"]["adminKey"] = json!("");
        assert_eq!(
            publish_request(&state, &publishable_calendar(), "p1").unwrap_err(),
            PublishBlock::Missing("site has no Ghost connection".into())
        );
    }
}
