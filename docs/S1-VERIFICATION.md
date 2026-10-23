# S1 + S9 verification — schema, ledger and the writing gate (2026-10-23)

Host: Linux x86_64, rustc 1.99.1, no Docker, no sudo, no system Postgres.
Build: `cargo build` clean, **zero warnings**. Tests: **14/14 pass** (`cargo test`).

## Schema (S1)

`backend/migrations/0002_core.sql` applied on top of `0001_init.sql` → **27 tables** created in a
fresh database (verified by reading the DB, not by trusting the migration log):

```
activity_events  ai_keys          api_keys         article_claims   article_images
article_links    article_stages   articles         calendar_entries calendars
integrations     inventory_posts  jobs             memberships      plan_items
plans            research_entities research_projects research_stages runs
sites            static_builds    usage_ledger     users            websites
worker_heartbeats workspaces
```

Notes that came out of building it:

- `jobs` gained the queue columns (`run_id`, `website_id`, `plan_item_id`, `attempts`, `locked_by`,
  `lease_until`, `not_before`, `last_error`, `spend_usd`) plus `idx_jobs_claim` on
  `(status, not_before, lease_until)` — the index the S2 worker claims on.
- `articles` gained the fields their UI actually renders (`uniqueness_score`, `intent_match`,
  `coverage_score`, `featured_image_url`, `featured_alt`, `content_json`, `meta_json`, `content_format`).
- Money and tokens live in `usage_ledger` only. Article/run spend is derived, never a counter.
  Test `usage_ledger_sums_per_website` asserts the sum (410 tokens, $0.03) rather than trusting a cached field.
- `article_images` carries the full reason vocabulary recovered in `docs/audit/reverse-engineering.md`
  (`status`, `reason_code`, `vision_label`, `vision_conf`) so a missing image can be explained.
- `article_links` encodes insert-then-verify: default `status = LOCAL_INSERTED`, `health = pending`.

## Writing gate (S9)

`backend/api/src/lint.rs` — deterministic humanizer linter, exposed at `POST /api/v1/lint`.
It reports `words`, per-rule `findings` (rule, pattern number, severity, count, samples), and
`passed` (true only when no High-severity finding exists).

Live run against two real inputs:

| input | words | high | medium | passed |
|---|---|---|---|---|
| slop paragraph ("not just X, it's Y" / "at its core" / "let that sink in" / "pivotal" / "In conclusion" / Title Case heading) | 64 | **13** | 1 | **false** |
| plain product prose (export behaviour + limits) | 64 | **0** | 0 | **true** |

Rules implemented: patterns 1, 2, 3/27, 4/28, 5, 7, 8, 14 (em-dash density), 15 (boldface density),
17 (Title Case heading), 18 (emoji), 19 (curly quotes), 23/25 (filler closers), 26 (hyphen pairs),
29 (heading restates itself), 32 (rhetorical question), 33 (opener tics), 34 (reassurance kicker).

Two bugs found by its own tests and fixed rather than papered over:

1. Blank lines between a heading and its lead-in meant pattern 29 never fired. Now blank lines are skipped.
2. Density maths on short text: two em dashes in 13 words read as "154 per 1000". Now rates apply only
   at ≥120 words; below that an absolute cap (4 em dashes, 8 bold spans) is used.

## Scale (unchanged promise, re-proven on the new schema)

| check | result |
|---|---|
| 10,000-keyword intake, one transaction | **237 ms server / 253 ms wall**, `inserted: 10000`, no cap |
| keyset page `GET /api/v1/jobs?limit=200&cursor=9000` | 3.5 / 4.5 / 4.3 ms |
| rows after seed + intake | 20,000 jobs, 10 websites |

## Bug fixed on the way (real, not cosmetic)

sqlx enables `PRAGMA foreign_keys=ON`. Intake with an unknown `workspace_id` therefore failed as an
opaque **500**. The handler now checks parent rows and returns **400 `unknown workspace_id`**;
regression test `intake_with_unknown_workspace_is_400_not_500` covers it, and
`intake_and_lint_round_trip_over_http` drives both routes through a real `Router`.

## Still open

- Postgres parity: SQL is portable but has only been executed on SQLite here (no server available).
- S2 worker (claim/lease loop + heartbeat) is next; the schema and index it needs are in place.
- Stage validators (zod bounds → Rust range checks) land with S3.
