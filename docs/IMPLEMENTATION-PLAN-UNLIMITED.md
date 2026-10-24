# Build plan — Ghost AI Writer v3 "Unlimited"

Target: their six-stage pipeline and every surface captured in `docs/audit/ghost-bloggent-authenticated-2026-10.md`,
re-implemented as **Rust API + worker** with the existing React SPA, and **no caps** (owner directive: unlimited websites, keywords, runs, plans, research, articles).
Their limits we deliberately do NOT copy: `keywordLimit 100`, website caps, package terms. Their limits we KEEP: daily token allowance per key (safety), duplicate protection, verified-link semantics.

## S1 — Data model (Rust / sqlx) — replaces the IndexedDB blob

Tables (all tenant-scoped by `workspace_id` → `website_id`):

```
workspaces, users, memberships
websites(id, name, ghost_mode, ghost_url, ghost_admin_key_enc, static_site_name)
integrations(website_id, mode, ghost_url, status, verified_at)
inventory_posts(website_id, ghost_post_id, slug, title, url, html, synced_at)   -- link graph source
ai_keys(workspace_id, provider, key_enc, label, priority, daily_allowance, allowance_set_at)
runs(id, website_id, type(KEYWORDS|TOPIC_PLAN), source_label, status, spend_usd, tokens_in, tokens_out)
jobs(id, run_id, website_id, keyword, plan_item_id, status, stage, locked_by, lease_until, attempts)
articles(id, job_id, website_id, title, slug, status, engine, ghost_post_id, published_at,
         uniqueness_score, intent_match, coverage_score, content_json, meta_json, format)
article_stages(article_id, index, name, status, tokens_in, tokens_out, duration_ms, error)
article_images(article_id, role(FEATURED|CONTENT), query, url, alt, w, h, vision_label, vision_conf, reason)
article_links(article_id, direction, target_article_id, anchor, status, health, label, reason, verified_at)
plans(id, website_id, topic, pillar_title, pillar_summary, pillar_is_item, status, engine, run_id)
plan_items(id, plan_id, title, summary, status)
research_projects(id, website_id, name, breadth, status, stages_requested, stages_completed, active_stage, error)
research_stages(project_id, key, status, payload_json, provenance_json, error)
research_entities(project_id, kind(niche|audience|problem|query|coverage), data_json)  -- feeds plans
calendars(website_id, timezone, auto_write, auto_publish, auto_link, status)
calendar_entries(id, calendar_id, plan_item_id, publish_at, status)
static_builds(website_id, build_id, status, pages, bytes, duration_ms, zip_path, target, deployed_at)
activity_events(workspace_id, kind, payload_json, created_at)
usage_ledger(ai_key_id, article_id, stage, tokens_in, tokens_out, cost_usd, at)
```

Money/token accounting is a **ledger**, not a counter on the run — so `spend` can always be re-derived (their $0.0817/184,942 is exactly this).

## S2 — Worker (their `worker.alive/lastTickAt`, our missing depth)

One binary, `--role=api|worker|all`. Worker loop:
`claim jobs WHERE status='QUEUED' AND (lease_until IS NULL OR lease_until < now()) FOR UPDATE SKIP LOCKED` → set `locked_by=worker_id, lease_until=now()+90s` → run stage → renew lease per stage → commit → next.
Guarantees: jobs survive tab close/browser death/restart; `attempts` capped 3 with backoff; partial stage results persist so retry **continues from missing work and does not re-charge finished work** (their exact behavior).
Heartbeat: `worker_heartbeats(id, version, last_tick_at)` exposed at `GET /api/config` → `worker.alive`.

## S3 — The six stages (port, same boundaries)

Contracts are pinned to the zod bounds recovered from their own bundles — see **`docs/audit/reverse-engineering.md`** §2.
Prose quality is bound by **`docs/WRITING-QUALITY.md`** (SEO structure + humanizer linter), not left to the model's taste.


| # | Rust module | Inputs → outputs | Acceptance |
|---|---|---|---|
| 1 | `stages/intent.rs` | keyword/plan item + site context → `blueprint{intent, outline[], mustCover[], articleType, targetAudience}` | `mustCover` non-empty, ≥5 items |
| 2 | `stages/draft.rs` | blueprint → `content{intro, sections[], conclusion}` | section count == outline count |
| 3 | `stages/revise.rs` | draft + mustCover → revised draft + `qualityReport{coverage,repetition,intentMatch,unsupportedClaims,notes}` | coverage ≥ threshold per mustCover item |
| 4 | `stages/meta.rs` | revised → `meta{title, metaDescription, slug, tags, excerpt, searchIntent}` | slug unique per site |
| 5 | `stages/enrich.rs` | meta + `inventory_posts` + image service → `links{incoming}` + `images[]` | see S4/S5 |
| 6 | `stages/publish.rs` | all → duplicate check (`semanticDuplicateCheck`) → Ghost publish single-shot | exactly one publish call; `ghostPostId` stored |

Provider-agnostic: one `Llm` trait (`write_json`, `write_text`, `vision`) with OpenAI first; token/cost capture at the trait boundary so the ledger is provider-neutral.

## S4 — Image pipeline (their Bing technique + the vision gate I verified)

```
1. query  = <scene description> + " photo"            // lowercase, no brand, no "stock"
2. url    = https://tse1.mm.bing.net/th?q={query}&w={w}&h={h}&c=7
            FEATURED: w=474 h=274 · CONTENT: w=624 h=352 c=7
3. fetch bytes → vision(alt, image) → {label: RELEVANT|IRRELEVANT, confidence}
4. accept if RELEVANT && confidence ≥ 0.6, else next candidate query
5. persist reason: "vision confirmed: <label sentence> [vision:RELEVANT | conf=0.9]"
6. alt = one grammatical sentence describing the scene
```

Roles per article: exactly 1 `FEATURED`, `n` `CONTENT` (their `imageCount` excludes featured). Cache by query hash so repeat runs cost no vision calls. Store bytes locally (`/media/<sha256>.jpg`) so a Bing URL outage cannot break published posts.

## S5 — Internal linking (insert → read-back → verify)

```
1. sync  : pull all Ghost posts → inventory_posts (id, slug, title, url)
2. match : for each draft, find candidate targets by topic overlap against inventory
3. anchor: pick a phrase already present in the draft text (never rewrite the sentence)
4. insert: LOCAL_INSERTED (link saved in our DB + in the HTML we will publish)
5. verify: after publish, GET the live post, confirm <a href> exists and target resolves
           → health=verified | pending + label "Needs verification" + reason
6. repair: standalone audit pass re-checks every stored edge; broken → re-insert or drop
```
Never report a link as working without step 5 — that is the honesty property their UI encodes in `LOCAL_INSERTED / Needs verification`.

## S6 — Research (11 resumable stages) → plans

`intent/description → niche → audiences → problems → topic map → queries → coverage → clusters & plan` (+3 supporting),
each stage: own row, own status, own `provenance_json`, own error; **partial project = PARTIAL, resumable, no re-charge**.
`clusters & plan` emits `plans` + `plan_items` with `pillar{title,summary}` and `pillarIsItem`.

## S7 — Surfaces to reach parity (React cutover per area)

overview checklist + activity · create (keywords | plan, publish mode, model) · plans · research · calendar (+3 automation switches) · runs (+progress, spend, tokens) · run detail · articles (engine/category/tag filters, all counts) · article detail (quality scores, stages, images, links w/ verification labels) · analytics (tokens/day, articles/day, stage perf, link edges) · connections (connect, test read-only, sync, audit links) · static delivery (build, ZIP, deploy, auto-rebuild, single-shot) · ai-keys (priority, allowance, usage, test) · settings (content defaults, authors/bylines, backup/restore) · account · billing (unlimited: no caps, no orders).

## S8 — Unlimited layer (our differentiator, visible in UI)

- `keywordLimit: null` → intake accepts any N (already proven: 10k in 211 ms).
- websites/keys/runs/plans/research/articles: no plan gate.
- per-key daily allowance stays, **default off**, shown as a safety dial not a ceiling.
- surface it: "Unlimited keywords per run" on Create, "Unlimited websites" in Billing.

## Order of work

`S1 → S2 → S3(stages 1–2 first) → S4 → S5 → S6 → S7 → S8`, with the parity gate: for 30 fixture keywords, our six-stage output must match theirs on structure (sections == outline, mustCover covered, one featured image with vision reason, ≥1 verified link or explicit "needs verification") before any UI cutover.

## S9 — Writing quality gate (parallel to S3, finishes with it)

`humanizer` (34 patterns, installed) + `seo-playbook` (11 SEO skills, 514 playbooks, installed as `seo-playbook`):
linter in Rust (regex table in `docs/WRITING-QUALITY.md`) → stage-3 revision → linter again, max 2 passes.
Publish is blocked on high-severity tells, on missing `mustCover` coverage, and on invented facts (claims without `SUPPORTED`).
AEO addition over their pipeline: `content.answerBlock` (citation-ready 2-sentence answer) required in stage 1.

