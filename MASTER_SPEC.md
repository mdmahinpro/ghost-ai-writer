# MASTER_SPEC.md — Ghost AI Writer (Own Panel) — Ultimate Build Contract

**Version:** 1.0 · Phase 0 output · 2026-10-16 (Asia/Dhaka)
**Scope:** Single source of truth for the full upgrade. Merges every `/knowledge-base/*.md` contract with the **7 Ultimate Custom Requirements**.
**References:**
- `knowledge-base/ghost-ai-writer-application-audit.md` (Bloggent signed-in audit, 2026-10-10 — 20 areas, routes, runtime tests)
- `knowledge-base/LIVE_REA_REALTIME_AUDIT.md` (**live authenticated realtime inspection, 2026-10-16** — current model catalog, calendar automation API, research stage names R1–R11, ads system, billing — supersedes older markdown on conflict)
- `knowledge-base/GHOST-AI-WRITER-V2-GOVERNOR.md` (acceptance contracts §3–§8, §21, §22)
- `knowledge-base/GHOST-AI-WRITER-V2-WORKFLOW-MAP.md` (UI/workflow parity map)
- `knowledge-base/GOVERNOR-AUDIT.md` (repo audit + repair order)
- `knowledge-base/cookies.json` (live `ghost.bloggent.com` session — use with REA browser tools for runtime verification; REA MCP is active in VS Code, CLI verified via `npx rea-agents@6.5.0 capabilities`)

**Status flags:** `BUILT` (verified in repo) · `PARTIAL` · `GAP` (missing). Full per-file status lives in `PROGRESS_STATE.md`.

**Hard legal/behavior boundaries:** own original UI (Rule 7), Ghost = single-shot publish with ledger, audit-before-apply for link repair, secrets never in exports/logs, no fabricated metrics.

---

## 1. Canonical Route Map — 20 Authenticated Areas

All areas enforce workspace/account scoping server-side. Current route names use this repo's flat TanStack routes; Parity target keeps bloggent's `/app/sites/{siteId}/...` semantics via the existing workspace switcher.

| # | Area | Route(s) — parity contract | This repo | Status | Primary gaps |
|---|---|---|---|---|---|
| 1 | Websites / Workspaces | `/app/sites` | `/workspaces` | BUILT | niche-discovery + funded ideas optional |
| 2 | Overview | `/app/sites/{siteId}/overview` | `/` | BUILT | per-key tokens, worker health, latest build |
| 3 | Create (Keywords + Topic Plan tabs) | `…/create` | `/create` | BUILT | batch cap (Rule 1), live-source mode |
| 4 | Topic Plans | `…/plans`, `…/plans/{planId}` | `/topic-plans`, `/topic-plans/$id` | BUILT | clusters-first pillar-last (BUILT), 6–10 via model |
| 5 | Research | `…/research`, `…/research/{researchId}` | `/research` | **BUILT** | 11-stage engine + per-stage tokens/retry + plan builder (M3); `{researchId}` deep-link is an in-page tab pane |
| 6 | Calendar | `…/calendar` | `/calendar`, `/calendar/$id` | **BUILT** | 3 independent switches + re-weave + durable worker bridge/lease (M4) |
| 7 | Runs | `…/runs`, `…/runs/{runId}` | `/runs`, `/runs/$id` | BUILT | CSV export, refusal visibility |
| 8 | Articles | `…/articles`, `…/articles/{articleId}` | `/articles`, `/articles/$id` | BUILT | metadata editor edge cases, exports |
| 9 | Analytics | `…/analytics` | `/analytics` | BUILT | model-usage, link-graph truth views |
| 10 | Connections | `…/connections` | `/connections` | BUILT | deploy providers (Rule 6 route-diff) |
| 11 | Static Delivery | `…/static` | `/static-delivery` | **BUILT** | 7 ad slots + 16 KiB cap + ads.txt + preview + route-diff gate + 4 adapters (M4) |
| 12 | AI Keys & Usage | `…/ai-keys` | `/ai-keys` | **BUILT** | key-pool ordering, penalties, cooldowns, per-key usage (M1 Rule 4) |
| 13 | Funding / Unlimited | `…/funding` | `/inbox` (local stand-in) | BUILT (stand-in) | optional platform-funded ideas remain out of scope |
| 14 | Content Defaults | `…/settings/content` | `/settings/content` | BUILT | run/workspace/account precedence freeze |
| 15 | Website Settings | `…/settings` | `/settings/website` | BUILT | destructive-delete guard |
| 16 | Authors & Bylines | `…/settings/authors` | `/authors`, `/authors/$id` | **BUILT** | Smart Auto-Author Engine, 250 cap, voice, zero-disk avatars (M2) |
| 17 | Backup & Recovery | `…/settings/backup` | in `/settings/website` + `/account` | BUILT | rate limits removed per Rule 1 |
| 18 | Account | `/app/account` | `/account` | BUILT | real sessions list (better-auth) |
| 19 | Billing & Plan | `/app/billing(/orders)` | `/billing` | BUILT (invoice) | orders out of scope unless requested |
| 20 | Help | `/help(/{slug})` | `/help` | BUILT | content refresh |

Global shell (all screens): sidebar WORKSPACE header + CONTENT (Overview, Create, Topic Plans, **Research, Calendar — first-class areas, live-confirmed 2026-10-16**)/WEBSITE/SETTINGS/ACCOUNT, workspace switcher, `Ctrl+K` palette, activity indicator, **"Writing service online/offline" badge**, theme picker — `src/components/shell.tsx` (BUILT).

---

## 2. Six-Stage Article Pipeline (with Rule 3 Bing/Copilot upgrades)

Contract source: GOVERNOR §4. All stages = chat completions with **Zod/JSON-schema validation** (`src/lib/stage-contracts.ts` — bump `promptVersion` per change), 1 auto-retry with the validation error appended, 2nd failure → job FAILED at that stage. Site context block present in every stage:
`{ siteName, niche, audience, language, existingTitles[last 200], authorVoice: {…Rule 2 profile…}, voice: { tone, pov, readingLevel, bannedPhrases[], brandFacts[] } }`.

Pipeline (stage doors — updated for Bing):

| # | Stage | Tier/temp | Output | Bing/Copilot + author-voice guards |
|---|---|---|---|---|
| 1 | Intent & Blueprint | fast · ~0.4 | intent, audience, workingTitle ≤70, angle, mustCover[5–8], outline[N], faq[3–5], targetWords, **answerBlock (40–60-word direct answer)**, **question-shaped H2 candidates** | outline length = sections setting; no dup H2; workingTitle lexical < 0.85; blueprint marks tables/FAQ/answer blocks |
| 2 | Draft Generation | balanced · ~0.7 | intro/sections/conclusion/faq HTML | first 2 sentences = direct Q&A answer for the primary query (Bing/Copilot grounding); exact + semantic variants of H1/H2/H3 phrasing; **at least one concrete table** when the blueprint marks it; no invented stats — `[verify: …]`; HTML allowlist; assigned author's style profile applied (Rule 2) |
| 3 | Quality & Coverage Revision | balanced · ~0.3 | html, coverage, intentMatch, notes, verifyFlags | every mustCover addressed; blader/humanizer two-pass audit + rewrite (evision@4-blader-humanize): 26-pattern AI-tell sweep, banned-phrase scrub, repetitive-advice detection, humanized rhythm per author profile; coverage ≥ 0.8 else one more pass |
| 4 | Metadata & Packaging | fast · ~0.3 | title ≤60, metaDescription ≤155 (answer-shaped), slug, tags≤3, excerpt | slug unique (`-2` suffix); tags map to existing names |
| 5 | Site Enrichment | fast + vision | 5a links; 5b image queries + placement | anchors verbatim once; URLs from **published inventory only**; `LinkEdge PLANNED→LOCAL`; images per GOVERNOR §4 §31 rules |
| 6 | Validation & Publish | **no LLM** | assemble → sanitize → JSON-LD + schema → 3-layer dup gate → Ghost POST → ledger → link confirm → IndexNow hook → debounced static.build | inject **JSON-LD `Article` + `Person`** (author expertise from Rule 2 profile); exact **one POST per article**; ambiguous timeout → GET-by-slug reconcile, never re-POST; **on live publish success → fire Rule 3c IndexNow ping** |

Checkpointing: `Job.stage` advances only after durable persist; restart resumes at current stage (never `blankStages()` when `shots ≥ 1`). Publish ledger written **before** POST. Live API parity (from LIVE_REA_REALTIME_AUDIT): job exposes `attempts`, `restarts`, `restartLimit: 5`, `variantOf` (intent variant lineage), `publishHold` + `holdEvidence`; each stage records `tokensIn/tokensOut/durationMs/error` (stage 6 = 0/0).

### Rule 3 implementation items (binding)
- **3a Bing structure:** exact/semantic H1–H3 variants plan (stage 1), direct Q&A answer blocks (stage 2 opening + FAQ), ≥1 concrete data table where useful, section-anchored FAQs.
- **3b JSON-LD:** stage 6 emits `Article` schema (headline, datePublished, author ≥ `Person` with `name`, `jobTitle`, `knowsAbout[]` = author expertise, `image` avatar URL, `url` = author public profile) inside `<script type="application/ld+json">`; templates keep it in `<head>`.
- **3c Bing IndexNow auto-ping:** after a successful live Ghost publish **and** after every verified static deploy (GOVERNOR §22): chunked POST of changed URLs to `api.indexnow.org` with the site key file already verified publicly — `src/lib/ops.functions.ts` `submitIndexNow` (exists; wire into publish + deploy success path).
- **3d Humanization:** 100% humanized output in the assigned author's voice — native blader/humanizer engine (`src/lib/humanizer.ts`, ruleset spec at `knowledge-base/blader-humanizer/SKILL.md`): deterministic scrub + two-pass LLM audit/rewrite through the studio AI key pool; Stage 2 drafts carry the Blader anti-pattern constitution (`draft@4-blader-anti-ai`); articles record `humanizerScore` (0–100 prose purity) + `humanizerStripped` pattern list. The external Metric37 API and its dedicated key pool are removed.

---

## 3. 20 Authenticated Route Areas — Feature Contracts

Behavior contracts per area follow `ghost-ai-writer-application-audit.md` §Feature Specification (sections 1–13) and GOVERNOR §3. Summary of the binding rules per area that our build must satisfy:

1. **Overview** — read-only, evidence-based Golden Path (13 steps, `src/lib/engine.ts` `goldenSteps`), per-key tokens, latest build, recent runs/articles.
2. **Create** — keyword intake normalized server-side; **batch cap removed (Rule 1:** unlimited lines, chunked dispatch, progress CSV preview**)**; intentional-variant toggle; AI ideas (filtered vs corpus, billed honestly); topic-plan tab.
3. **Topic Plans** — pillar + 6–10 model-generated clusters, semantic dedupe > 0.88 among clusters, review/exclude, queue → clusters first, pillar `dependsOn`, pillar 7–8 sections, clusters 5.
4. **Research** — 11-stage engine (§4 below), corpus options Compact/Standard/Wide, evidence labels, stage rerun, archive, plans-from-research.
5. **Calendar** — timezone-safe `write_at` ≠ `publish_at`, 1–21/week, write-ahead 1–336 h, list/month/cluster views, fill/re-plan/reschedule/skip/restore/remove, `Write now` / `Publish now`, **three independent default-off automation switches (Rule 6)**.
6. **Runs** — durable ledger, 6 stage cards with duration+tokens, `$`/tokens/settled calls, terminal states COMPLETED/PARTIAL/FAILED/CANCELLED(+QUEUED/RUNNING), restart-failed from checkpoint, regenerate-as-variant, CSV export.
7. **Articles** — KPIs (uniqueness/coverage/intent/words), Ghost publish ledger, links with lifecycle badges, images with provenance, per-stage token table, exports (HTML/MD/CSV), delete = app + Ghost post with confirm.
8. **Analytics** — 7/14/30-day ranges; token/output/stage/quality/engine/link-graph truth; never visitor/ranking claims.
9. **Connections** — Ghost test read-only, inventory sync (no 15-min cap, Rule 1), link audit ≤5 posts read-only, apply = **PUT re-weave only** with `updated_at` optimistic lock.
10. **Static Delivery** — immutable builds, snapshot persisted (`includedIds`, `excluded`, artifact hashes), ~60 s debounce auto-rebuild, Public URL gate, hosts: cPanel FTPS/SFTP BUILT, Cloudflare/Vercel/GitHub Pages wire-up; **7 ad slots + `ads.txt` + Route-Diff protection (Rule 6)**.
11. **AI Keys & Usage** — Rule 4 pool; RESERVED/SETTLED/RELEASED ledger; UTC day; embeddings metered; 401 → disable, 429/5xx → cooldown.
12. **Funding** — optional; runs always fail over to user keys.
13. **Content Defaults** — account defaults ⊂ site overrides ⊂ run override; frozen at submission.
14. **Website Settings** — rename, delete blocked while runs/builds/deploy active, exact-name confirm.
15. **Authors** — Rule 2 engine.
16. **Backup & Recovery** — checksum, schema version, secrets excluded, additive restore, settings-replacement preview; **rate limits removed (Rule 1: unlimited backups/imports, no 25 MB / per-15-min caps — keep only sane request-size hardening)**.
17. **Account** — profile, password change (invalidates other sessions), real session list via better-auth, revoke.
18. **Billing** — packages + invoice from SETTLED usage events; order flow optional.
19. **Help** — searchable task guides.
20. **Websites** — create/switch/delete/delete-guard; sandbox→live quarantine.

---

## 4. Eleven-Stage Niche Research Engine (rebuild target for `/research`)

**Live-confirmed stage names (ghost.bloggent.com, 2026-10-16 — R1–R11; supersedes any earlier naming):**

| # | Live name | Type | Output |
|---|---|---|---|
| R1 | Niche understanding | LLM | niche entity map, sub-niches, terminology, site purpose summary |
| R2 | Audience map | LLM | 3–6 personas with intent/pain |
| R3 | Problem map | LLM | problem list per persona (live failure mode: validated safe-stop "content in a format we could not safely use") |
| R4 | Topic universe | LLM | pillar→cluster→subcluster graph (bounded) |
| R5 | Query expansion | LLM | real user queries/questions per topic (largest stage — observed 36k tokens) |
| R6 | Intent classification | LLM | intent per query (informational/comparison/transactional/crisis…) |
| R7 | Semantic consolidation | **derived (0 tokens)** — reuse `l3-embed.ts` | embed + dedupe queries > 0.90 cosine, merge |
| R8 | Existing coverage mapping | LLM(+) | queries×existing posts matrix; covered/partial/weak/missing |
| R9 | Cluster construction | LLM | 3–8 clusters ≥0.88 dedupe, internal-link opportunities |
| R10 | Content action classification | **derived (0 tokens)** | write/refresh/skip classification per topic |
| R11 | Strategic priority inputs | LLM | priority inputs → rule-based scores (no invented volume); export to Content Plan |

Requirements (live contracts): per-stage `Show provenance`, per-stage tokens, **stage-level Retry that "continues from what is missing and does not re-run or re-charge the rest"**, Archive/restore, terminal `READY | PARTIAL | FAILED`, tabs Overview/Niche/Audiences/Problems/Topic map/Queries/Coverage/Clusters & plan, evidence labels (`From your site` / `Calculated` / `AI interpretation` / `You wrote this`), `stagesRequested/stagesCompleted/activeStage/attempts` in the project payload. Replace the 4-fact stub (`src/lib/operator.ts` `buildResearch`). Optional **web-search enrichment** when the Rule 5 switch is on (Tavily/Firecrawl evidence with source URLs). No fabricated search volume/CPC; prompt 20–4,000 chars; corpus sizes Compact/Standard/Wide.

---

## 5. Domain Model — 22 Canonical Models

Target schema (merge of the audit's inferred model + this repo's types). Milestone 1 migrates core entities from the browser blob to real SQL tables (Postgres/PGLite via `getSql()` + Kysely), keeping PGLite dev parity and `migrations/*.sql` expand/contract discipline.

| # | Model | Key fields / notes | Repo anchor |
|---|---|---|---|
| 1 | `Account` | identity, verified email, approval/suspension, password, real sessions (better-auth tables exist) | `src/lib/types.ts:406` |
| 2 | `Workspace` (Site) | single-site tenancy, static config, ghost conn ref, setup state | `types.ts:300` |
| 3 | `AIKey` | provider **openai / openrouter / custom**, baseUrl, model, priority, capabilities, allowance, cooldown, disabled — Rule 4 | `types.ts:217` |
| 4 | `UsageEvent` | pairId `{jobId}:{stage}:{attempt}`, RESERVED/SETTLED/RELEASED, provider/model/stage/tokens/usd | `types.ts:203` |
| 5 | `GhostConnection` | mode studio/live/off, status, version, corpus state, encrypted admin key | `types.ts:258` |
| 6 | `GhostPostInventory` | ghost post id, title/slug/status, syncedAt, embedding for dedupe | `types.ts:238` + `corpus.ts` memory `types.ts:246` |
| 7 | `Run` | type, frozen publishMode/model/voice snapshot, allowVariants, researchUrls, status — **no caps** | `types.ts:74` |
| 8 | `ArticleJob` | keyword, kind keyword/cluster/pillar, dependsOn, status, stageIndex + `StageRecord[]`, refusalReason/Layer, shots, tokens, cost | `types.ts:36` |
| 9 | `Article` | html/markdown, metrics, tags, images, links, stageTokens, verifyFlags, ledger, authorId, humanized state | `types.ts:122` |
| 10 | `ArticleBrief` | frozen blueprint: intent, audience, mustCover, outline, FAQ, answerBlock, deliverables, constraints | stage-1 output (persist explicitly) |
| 11 | `VoiceProfile` | per-author voice: traits, formality, pov, readingLevel, rhythm, banned phrases, brand facts, sample-derived style | `types.ts:285` (extends to Rule 2) |
| 12 | `TopicPlan` | topic, pillar, clusters[], status, runId, review/exclude state | `types.ts:188` |
| 13 | `ResearchProject` | 11 stages w/ per-stage tokens/status/facts, evidence labels, archive | `types.ts:487` (rebuild) |
| 14 | `ContentCalendar` | timezone, activeDays, articlesPerWeek, publishTime, generationLeadHours, strategy PILLAR_FIRST, **publishMode "published"\|"draft"**, mode, planningRangeDays, **autoGenerate / autoPublish / autoReweave (3 independent default-off switches)**, cadence + automation summary strings + `CalendarEntry[]` (write_at ≠ publish_at, SCHEDULED/SKIPPED lifecycle) — live API names from LIVE_REA_REALTIME_AUDIT | `types.ts:450` |
| 15 | `AuthorProfile` | Rule 2: US-based, name, short bio, expertise[], style (voice ref), avatar URL string, **ghostAuthorId**, **articleCount**, active/default. Live parity notes: live UI caps at 20 profiles and demands operator-provided expertise/Ghost-IDs — our Rule 2 **deliberately diverges** (unlimited auto-generated authors, Ghost author auto-creation per user requirement) | `types.ts:418` (rebuild) |
| 16 | `ArticleImageSlot` | featured/section, status lifecycle EMPTY→…→SELECTED, policy, alt, retry history | `types.ts:104` |
| 17 | `ImageAsset` | provider, source URL, license/attribution, hash, dims, review decision | `src/lib/image-fetch.ts` |
| 18 | `PublishAttempt` (ledger) | dispatchedAt before POST, confirmedAt, ghostPostId, mode, shots — single-shot invariant | `types.ts:146` |
| 19 | `LinkEdge` / `LinkAudit` | 7-state machine PLANNED→…→STATIC_CONFIRMED / FAILED/BROKEN; audit proposals, applied state | `types.ts:89,355` |
| 20 | `StaticSettings` | template semver, identity, public URL, robots, menus, snippets, **7 ad slots + ads.txt entries** | `Site` fields `types.ts:300` (split) |
| 21 | `StaticBuild` | immutable artifact `{name,text,hash}[]`, pages/bytes/ms, includedIds, excluded — Rule 6 route-diff input | `types.ts:329` |
| 22 | `HostingConnection` / `Deployment` | provider, encrypted/tested host, build ref, packaged/verified-deployed/failed, rollback lineage | `types.ts:276,345` |

Extension tables (kept as JSON config, not separate domains): `WebSearchConfig` (Rule 5: tavily/firecrawl keys + mode), `Backup` (`types.ts:496`). The `HumanizerKey` pool was removed with the Metric37 API.

---

## 6. The 7 Ultimate Custom Requirements (binding)

### Rule 1 — Zero Limitations for 10,000+ Content
Remove every artificial cap and prove scale:
- **TULE DAO / remove:** `KEYWORD_CAP = 100` (`src/lib/types.ts:543`), `CONCURRENCY = 2` (`types.ts:544`), 20-author cap (n/a in repo — keep unlimited), backup/restore per-15-min and MB caps, inventory-sync 3/15-min limit, ideas 20/15-min limit.
- **Add:** configurable per-site and global concurrency (default high; UI slider), batch chunking for 10k keywords with resumable progress, unlimited calendar slots, DB-backed job queue that survives refresh and runs independent of an open tab (worker migration in Milestone 1/4).
- **Keep:** duplicate gates (L1/L2/L3), metering honesty, single-shot Ghost invariant — these are quality, not limits.
- **Target proof:** end-to-end run can queue 10,000 keywords; UI streams progress in chunks; worker stays responsive.

### Rule 2 — Smart Auto-Author Engine (250-article cap + zero disk storage)
Fully automatic; user never opens an authors screen:
- Every author **USA-based**: name (US name pools), city/region (US states), short bio, **explicit `expertise[]` (niche/topic)** displayed on profile, **unique humanized writing style** (voice profile fields: rhythm, diction, sentence-length band, signature moves → feeds stages 2–3 as the voice block), `ghostAuthorId`, `articleCount`.
- Avatar: **`https://thispersondoesnotexist.com/image?seed=<uniqueToken>` stored as DB string only** (unique query param per author). **Never download to server disk.** Static/templates reference the URL directly.
- Assignment: at job dispatch, pick author where `expertise` matches topic AND `articleCount < 250` AND least-loaded; **only** if no matching under-250 author exists → auto-generate a new US expert author for that niche.
- `articleCount` increments on ghost-confirmed publish; exposes 250-cap trigger.
- Authors render on articles (`Person` JSON-LD + byline card with expertise).
- Anchor: rebuild `src/lib/authors.ts` + `src/components/pages/authors.tsx` (auto mode UI optional inspector only).

### Rule 3 — Bing SEO + 100% Humanized Output
See §2. Binding additions: Bing/Copilot structure in stages 1–3, JSON-LD `Article`+`Person` in stage 6/templates, auto **IndexNow** ping on live publish + verified deploy, humanizer integration mandatory for every publishable draft, robotic-word/banned-phrase scrub, no repetition. Acceptance: every published article has answer-block opening, ≥1 table when appropriate, valid JSON-LD, humanState `done`, IndexNow log entry.

### Rule 4 — Multi-API Key Pool + Custom Endpoints + Auto-Failover
- Keys UI supports **OpenAI**, **OpenRouter**, and **Custom OpenAI-Compatible Endpoint** (Custom Base URL + API Key + Model ID). Live parity baseline (LIVE_REA_REALTIME_AUDIT): provider radio OpenAI/OpenRouter, source-confirmation checkbox, token allowance ≥1,000 or unlimited (UTC reset), advanced priority, separate Test/Save — our build adds the **custom-endpoint third option** and applies the pattern to the whole pool.
- Live model catalog must be configurable (2026-10-16: gpt-4o-mini/4o/4.1-mini, **gpt-5.4-mini, gpt-5.6 luna/terra/sol, gpt-6-astra**, OpenRouter: llama-3.3-70b(&free)/deepseek-v3(:free)/gemini-2.5-pro/gpt-4o/claude-sonnet-4) with `modelGroup` (fast/balanced/flagship) and $/1M pricing; retirement dates surfaced (e.g. "GPT-5 mini retires 2026-12-11").
- Unlimited keys per account; priority order; per-key daily allowance (optional/unlimited respected); reserved/settle ledger per key.
- **Auto-failover:** on busy/timeout, 429, coin/token-limit-exhausted, 5xx, or 401 (disable): cool the key, try the next eligible key by priority mid-run; **job must complete and still auto-publish to Ghost** — no job dies because one key hit a limit. Failover chain events logged per attempt (`Activity` + `Job.modelError` chain).
- Applies to chat, embeddings, ideas, research, humanizer fallback chain.

### Rule 5 — Web Search Switch (Tavily & Firecrawl)
- Settings gets **Tavily API key**, **Firecrawl API key**, and mode switch: `Off | Tavily | Firecrawl | Auto-Fallback`.
- `Auto-Fallback`: try primary per switch; on failure/empty results fall back to the other; both fail → run continues without web grounding (labeled).
- Consumers: stage 1/2 grounding + research engine (§4) + live writer research digest (`src/lib/rewrite.ts` `researchDigest` currently Firecrawl-only — generalize behind a `WebSearchProvider` adapter with SSRF guards from `assertPublicHttps`).
- Evidence labels carry source URLs into articles/verify flags.

### Rule 6 — 100% Working Calendar + Ad-Ready Ghost/Static Structure
- Calendar automation genuinely functional via background worker, using the **live API naming** (LIVE_REA_REALTIME_AUDIT, round-trip verified):
  - `autoGenerate` — "Write automatically" (queue + run pipeline at `write_at`; still waits before publishing)
  - `autoPublish` — "Publish automatically" (live) / **"Save drafts automatically"** when calendar `publishMode:"draft"` → resolves the draft-calendar toggle
  - `autoReweave` — "Automatic internal linking" (edits already-published cluster posts to link to new ones — re-weave PUT path only)
  - All default OFF; calendar model: `{timezone, activeDays[1–7], articlesPerWeek, publishTime"HH:MM", generationLeadHours(1–336), strategy PILLAR_FIRST, publishMode "published"|"draft", mode MANUAL|…, planningRangeDays, defaultModelCatalogId, computed cadence + automation summary strings, "automation on"/"manual" pill}`
  - API parity: `POST /calendars`, `GET/DELETE/PATCH /calendars/{id}`, `POST /calendars/{id}/plan {planId}` → `{unscheduled}`; items `PATCH {status SCHEDULED|SKIPPED, scheduledPublishAt}` / `DELETE` / `POST …/generate` / `POST …/publish` (mode-aware toasts)
- Worker runs server-side (no longer dependent on an open browser tab): heartbeat, recovery, idempotent retries.
- **Ghost HTML quality bar (AdSense/Mediavine-ready):** semantic structure (single H1, nested H2/H3, `<figure>`, `<table>`), CLS-safe (fixed image aspect boxes, no layout shift), lean CSS, no render-blocking junk.
- **Static Delivery ad system matching the live contract:** ad slot ids **`site_top, home_feed, article_top, article_inline, article_bottom, article_sidebar, site_bottom`** (7 slots, position map desktop/mobile, 300px right rail ≥1200px), per-slot: enable toggle + internal name + **Ad type: Custom HTML/JS | AdSense responsive display unit** + code max **16 KiB**; placement rules (home feed after 6th card ≥7 posts; in-article after paragraph 3 ≥6 top-level paragraphs; short feeds omit middle slots); preview shows placeholders and disables custom integrations; `adsConfigHash`; **plus `ads.txt` file editor** (our addition beyond live).
- **Route-Diff protection:** before any deploy, diff candidate route set vs live sitemap/last build; block deploy (require explicit resolution) when it would remove currently-live HTTP-200 routes — port from the audit's `jvndt0` incident.

### Rule 7 — Smooth Custom UI Theme (own identity, Bloggent-copied nai)
- Keep/extend the own design system: 6 themes (`src/lib/themes.ts`), Outfit/Georgia font pairing, custom tokens (`src/styles.css`), Radix primitives, command palette, toasts, smooth transitions (elevated surfaces, `color-mix` rings, micro-animations ≤200 ms, skeleton loaders for all async).
- **Never** copy marketing copy, CSS, or labels from Bloggent; keep a distinct layout language; accessibility (contrast, focus rings, prefers-reduced-motion).
- Every long-running feature surfaces loading/empty/error/partial states (acceptance from the audit).

---

## 7. Cross-Cutting Invariants (still binding)
1. Single-shot Ghost publish + ledger-before-POST + reconcile-by-slug.
2. Duplicate gates L1 (exact) / L2 (>0.85 lexical) / L3 (>0.88 cosine) at intake **and** stage 6; embedding memory after publish (persistent index).
3. Metering honesty: RESERVED→SETTLED/RELEASED, stage 6 = 0 tokens, embeddings metered, no phantom estimates when a real model ran.
4. Secrets encrypted at rest, never re-shown, never in backups/logs/exports.
5. SSRF guards on every outbound call (Ghost, images, scraping, FTP).
6. Audit-then-apply for link repair (typed `APPLY`), PUT-only re-weave, skip hand-edited posts.
7. Immutable builds; deploy = host-acceptance ≠ public verification; live probe on Public URL.
8. Frozen run snapshots (defaults + voice + brief) at submission.
9. Workspace-scoped authorization server-side on every content/job/query operation.
10. Evidence labels; never invent traffic/search metrics.

## 8. Acceptance Checklist (top-level)
- [x] All 20 route areas at contract parity (§1 gaps closed) — registered in `src/lib/areas.ts`, gate-proven to resolve, and 20/20 render in the browser smoke
- [x] §2 6-stage pipeline with Bing/JSON-LD/IndexNow; humanization mandatory (`intent@2-bing` · `draft@4-blader-anti-ai` · `revision@4-blader-humanize`, publish hold until humanized)
- [x] §4 11-stage research engine complete + rerunnable (R1–R11, derived R7/R10 at 0 tokens, retry-continues-from-missing)
- [ ] §5 22 models in SQL with tenant scoping + migrations
- [ ] Rule 1: 10k-batch scalable run demonstrated; all 4 legacy caps gone
- [x] Rule 2: auto author assign/rotate at 250; avatar URL-only; zero disk writes
- [x] Rule 3: JSON-LD valid; IndexNow fires on live publish + deploy; humanized output spot-check clean
- [ ] Rule 4: kill-format test — prime key 429s mid-draft → secondary finishes → Ghost publish happens
- [ ] Rule 5: switch Off/Tavily/Firecrawl/Auto-Fallback all behave
- [x] Rule 6: calendar 3 switches live-end tested on disposable Ghost; 7 ad slots + ads.txt + route-diff gate
- [x] Rule 7: distinct smooth theme, all states designed, a11y pass — 6 own themes with CSS↔TS parity + AA contrast gate, skeletons/StateNote across long views, keyboard+ARIA+focus-visible
- [x] GOVERNOR §11 safe-release gate green with evidence — see PROGRESS_STATE §8 (tsc 0 · eslint 0/0 · 105/105 tests · m1–m5 suites · build ✅ · 12/12 browser smoke)
