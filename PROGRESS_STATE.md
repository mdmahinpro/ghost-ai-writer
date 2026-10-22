# PROGRESS_STATE.md — Current Codebase Audit + Upgrade Milestones

**Date:** 2026-10-16 (Asia/Dhaka) · **Phase 0 output** · Companion contract: `MASTER_SPEC.md`
**Repo:** `D:\SAAS\Ghost Grok Latest` — React 19 + TanStack Start/Router 1.168 + Vite 8 + Tailwind 4 + Radix + zustand 5 + PGLite/Kysely + better-auth 1.6.30 + ssh2 + Playwright (`package.json`).

> Phase 0 rule honored: **no application code was edited.** Only this file and `MASTER_SPEC.md` were created.

---

## 1. Audit Summary — What Exists Today

### 1.1 Architecture reality
- **App data is a browser blob, not SQL.** All business data (sites/runs/jobs/articles/plans/authors/calendars/research/keys…) persists via zustand → IndexedDB (`gaw-db`/`kv`) with localStorage mirror + optional passphrase vault sealing: `src/lib/store.ts`, `src/lib/durable-storage.ts`, `src/lib/vault.ts`.
- **SQL layer only serves better-auth:** `src/lib/db.ts` (Neon/pg or PGLite), `migrations/auth/0001_auth.sql` (user/session/account/verification), `scripts/migrate.mjs`. `getSql()` has zero app call sites → domain models are not in SQL yet (MASTER_SPEC §5 target).
- **"Worker" is a 400 ms browser interval:** `src/components/shell.tsx` tick → `advance()` + `pulseCalendars()` (`src/lib/store.ts`, `src/lib/engine.ts`, `src/lib/operator.ts`). Server cron nai — jobs stop when the tab closes.
- **Server functions are TanStack `createServerFn`**, not REST; none are auth-gated with `authMiddleware` yet (`src/lib/auth/middleware.ts` exists, unused in prod fns).
- Ghost Admin API integration is real + hardened (JWT, SSRF DNS re-check, single-shot publish with slug reconcile): `src/lib/ghost.functions.ts`.
- Demo/estimation mode: deterministic simulation when no key secret (`engine.ts` + seeded "Northline Review" workspace in `store.ts`).

### 1.2 Feature inventory vs contract
| Area | Status | Evidence / gaps |
|---|---|---|
| 6-stage pipeline | PARTIAL | `STAGES` + stage contracts `src/lib/types.ts:1`, `src/lib/stage-contracts.ts`; real model calls for draft/revision via `src/components/model-stages.tsx`; promptVersion exists. GAP: Bing answer-block/tables/JSON-LD/IndexNow-on-publish; humanization not yet in-pipeline; stage validation partial |
| Humanizer | PARTIAL | Metric37 pool + 2-pass bulletproof: `src/components/humanize-pipeline.tsx`, `src/lib/rewrite.ts`, `humanizeChunk` in `src/lib/providers.functions.ts` |
| Duplicate gates | BUILT | L1/L2/L3 `gateText` in `engine.ts`; L3 `src/lib/l3-embed.ts`; persistent `corpus` memory — thresholds to recalibrate |
| Metering | BUILT (minor) | RESERVED/SETTLED/RELEASED, UTC day, 401 disable / 5-min cooldown: `engine.ts:1531-1627` |
| Keyword intake | PARTIAL | normalize + variant gates in `engine.ts`; **`KEYWORD_CAP = 100` and `CONCURRENCY = 2` still at `types.ts:543-544` (Rule 1)** |
| Topic plans | PARTIAL | clusters-first `dependsOn` BUILT; clusters template-based ≤8, not 6–10 model plans (`clusterTitles`/`proposePlan`) |
| Research | **GAP** | stub: `buildResearch` produces 4 static facts (`src/lib/operator.ts:167-197`); page admits engine absent (`src/components/pages/research.tsx:52`) |
| Calendar | PARTIAL | timezone-safe slots + `autoWrite`/`autoPublish` functional in-browser (`src/lib/operator.ts:199-285`, `src/components/pages/calendar.tsx`); GAP: **no `autoClusterLinking` switch**, no server worker |
| Auto-author | PARTIAL | deterministic generator `src/lib/authors.ts` (US names/cities, expertise[3], bio); GAP: no avatar URL, no `ghostAuthorId`, no `articleCount`, no 250 rotation, expertise matching not used for assignment |
| AI keys | PARTIAL | generic OpenAI-compatible endpoints + priority + allowance + cooldown (`types.ts:217`, `engine.ts` `usableKey`); GAP: failover often surfaces error instead of completing job via next key (Rule 4); provider-UX for OpenAI/OpenRouter/Custom presets |
| Web search | PARTIAL | Firecrawl scrape BUILT (`scrapePage`, `researchDigest` ≤3 urls); **Tavily nai; switch/mode nai (Rule 5)** |
| Images | BUILT (caveat) | Bing scrape/thumbnail + Wikimedia/Openverse fallback, sha-256 dedupe, license labels (`src/lib/image-fetch.ts`); downloads go to disk (`public/media`, `data/media`) — acceptable for article media; **avatar rule zero-disk separate (Rule 2)** |
| Ghost live publish | BUILT | single-shot `publishGhostPost` + image upload + desk push worker (`src/components/desk-workers.tsx`) |
| Static delivery | PARTIAL | immutable artifact snapshot + ZIP + FTPS/SFTP cPanel + auto-rebuild 60 s + IndexNow chain (`src/lib/static-site.ts`, `src/lib/auto-upload.ts`, `src/lib/ops.functions.ts`); GAP: Cloudflare/Vercel/GitHub unwired ("coming soon" `src/components/pages/delivery.tsx`), **no 7 ad slots, no ads.txt, no route-diff (Rule 6)**, only 1 real template CSS |
| Link audit/re-weave | PARTIAL | read-only propose + apply exists (`engine.ts:1943-2151`); PUT-with-`updated_at` re-weave to Ghost incomplete |
| Backup | BUILT | checksum, secrets excluded, additive restore (`src/lib/backup.ts`, `store.ts:576`) — rate limits n/a locally |
| Auth | BUILT (surface) | better-auth tri-mode + gates + isolation; app-data tenancy not enforced (blob is single-browser) |
| UI/UX | BUILT | 6 themes, sidebar shell, Ctrl+K palette, activity bell, worker pill, PWA (`src/components/shell.tsx`, `src/lib/themes.ts`); Rule 7 polish pending |
| Tests | BUILT (small) | `src/lib/*.test.ts` + `scripts/*.test.mjs`; Playwright smoke + brand scripts |

### 1.3 REA / live target status — **Phase 0.5 LIVE INSPECTION DONE (2026-10-16)**
- Full live authenticated inspection executed: `knowledge-base/LIVE_REA_REALTIME_AUDIT.md`. Cookies still valid (no password fallback needed; email/password flow staged from `.env` as backup). Headless Chrome via `playwright-core` + authenticated REST probes + bundle JS grep. Raw evidence: `%TEMP%\kilo\rea-live\evidence\` (20 pages, 687 network entries, 25 screenshots, API shape probes).
- **Key live deltas vs older markdown:** (1) Research + Calendar are first-class nav; (2) model catalog = GPT-5.6 Luna (default), GPT-5.6 Terra/Sol, **GPT-6 Astra**, GPT-5.4-mini, retirement dates surfaced, OpenRouter catalog key-gated; (3) Static ads system live with 7 slots `site_top,home_feed,article_top,article_inline,article_bottom,article_sidebar,site_bottom`, 16 KiB limit, AdSense option, `adsConfigHash`, JSON-LD in every template, `professional-magazine` 4th template, taxonomy layouts; (4) **calendar automation shipped in bundle**: `autoGenerate` / `autoPublish` / `autoReweave` + `publishMode:"draft"` ("Save drafts automatically") — release-gated behind "planning only" banner; API contract round-trip verified (create/PATCH/DELETE); (5) research stages R1–R11 live-named (2 derived), per-stage provenance/retry without re-charge, safe validation-refusal failures; (6) run jobs expose `restartLimit:5, variantOf, holdEvidence`, stage `tokensIn/tokensOut`; (7) billing/checkout enabled with real payment details; sponsored niche discovery quota 10/day; (8) Ghost CMS = `cms.gophd.com` subdomain confirmed; inventory cap "up to 200 recent records"; dup-corpus state `EMBEDDING_UNAVAILABLE`; (9) authors UI: 20-profile cap, expertise "never auto-generated" (our Rule 2 diverges by design).
- Though `KEYWORD_CAP`/concurrency/backup limits remain on live (server-enforced `keywordLimit:100`), our Rule 1 keeps zero-caps as an intentional own-panel feature.

### 1.4 Scoreline (vs GOVERNOR contracts + 7 Rules)
- GOVERNOR §3–§5/§21/§22: 1 Fulfilled · 14 Partial → several repaired since (voice fields, includedIds, artifact snapshot, corpus memory, live publish).
- 7 Ultimate Rules: **all 7 ✅ — R1 ✅ · R4 ✅ · R5 ✅ (M1) · R2 ✅ (M2) · R3 ✅ (M3) · R6 ✅ (M4) · R7 ✅ (M5)**

---

## 2. Milestone Plan (Milestone 1 → 5)

Legend: `[ ]` pending · `[x]` done. Each milestone ends with `npm run typecheck` + `npm test` + relevant smoke. Do not enable live Ghost publish / auto-deploy as a drive-by; test live actions on disposable Ghost only.

### Milestone 1 — Zero-Limit Engine + WebSearch + Key Pool (Rules 1, 4, 5) — ✅ COMPLETE (2026-10-16)
- [x] `src/lib/types.ts` — `KEYWORD_CAP`/`CONCURRENCY` removed; new `Limits` type + `DEFAULT_LIMITS { keywordCap: null, concurrency: 24, ideaCap: null, restartLimit: null, buildHistory: 500 }`; `DEFAULT_LIMITS` re-exported from engine; L1/L2/L3 thresholds untouched
- [x] `src/lib/engine.ts` — `limitsOf()` helper consumed everywhere; `submitKeywords` accepts unlimited batches (10,000 verified) and enforces only a *configured* cap; `advance` uses `limits.concurrency`; event window 240→20,000 and activity 60→500; build history window configurable; **new `CorpusIndex` fast gate** (`buildCorpusIndex`/`gateAgainstIndex`/`addToCorpusIndex`, `LARGE_BATCH_LIMIT = 400`) keeps large-batch intake sub-minute and defers L3 to stage 6
- [x] `src/lib/engine.ts` — `keyPool()` = ordered eligible pool (primary → priority; skips disabled/cooling/over-allowance); `usableKey()` = `keyPool()[0]`; `restartJob` honours `limits.restartLimit` with a `restarts` counter
- [x] `src/lib/model-pool.ts` (NEW) — `runWithKeyPool()` sequential auto-failover: 429/5xx/timeout cool + next key, 401/403 penalize + next key, jobs finish on a backup key (unit-tested)
- [x] `src/lib/model-catalog.ts` (NEW) — live catalog (GPT-5.6 Luna/Terra/Sol, GPT-6 Astra, GPT-5.4-mini, GPT-4o/4o-mini/4.1-mini/5-mini, OpenRouter set) + custom entries; `blendedPricePerMillion`, `pricePerMillionForModelId`
- [x] `src/lib/providers.functions.ts` — `tavilySearch` + `firecrawlSearch` server fns added (SSRF-safe, status-mapped); `scrapePage` unchanged
- [x] NEW `src/lib/web-search.ts` + `src/lib/web-search-plan.ts` — unified search/scrape with `off | tavily | firecrawl | auto-fallback`, per-provider key pools, cursor rotation, fail/cooldown handling
- [x] `src/components/pages/keys.tsx` — **failover-pool UI** (ordered cards, per-key allowance edit, enable/disable), **provider presets OpenAI / OpenRouter / Custom endpoint** (custom base URL + model id), catalog model picker, Test; **web-search switch** (4 modes) + Tavily/Firecrawl key pools; humanizer block preserved
- [x] `src/components/pages/settings.tsx` — **Scale & limits** card (keywords/run, concurrency, ideas/round, restarts, build history — empty = unlimited) + web-search read-out
- [x] `src/components/pages/create.tsx` — dynamic cap hint (`no cap; 10,000+ is fine`), idea options extended to 50/100, live concurrency copy, `keyPool` for topic plans
- [x] `src/components/model-stages.tsx` + `src/components/live-writer.tsx` + `src/lib/rewrite.ts` — draft/revision/live-writer/topic-plan/ideas paths all call through the key pool; `Job.keyId` + `failoverChain` record the actual key
- [x] `src/lib/rewrite.ts` — research digest routed through `web-search.ts` (URLs → `scrapeSource`, else `searchWeb`)
- [x] `src/lib/store.ts` — `limits` + `webSearch` persisted; actions `patchLimits`, `setWebSearchMode`, `importWebSearchKeys`, `clearWebSearchKeys`, `setWebSearchKey`, `takeWebSearchKey`; `addKey` accepts `providerKind`/`catalogId`/`label`/`pricePerM`; persist version 6→7 with migration (legacy `firecrawl.secret` → `firecrawlKeys`)
- [x] No artificial caps in `src/lib/backup.ts` (verified — local blob store has none; nothing to remove)
- [x] Tests: `src/lib/m1-limits.test.ts` (node:test, failover + web-search plan) in `npm test`; `scripts/m1-engine-verify.ts` (`npm run test:m1`, vite-node) covers unlimited cap, 250/10,000 batches, index gate, keyPool order, restart cap, classifyLines
- [x] Validation: `npx tsc --noEmit` clean · `npm test` **72/72** · `npm run test:m1` **8/8** · `npm run build` ✅ · live UI smoke **23/23** (Playwright vs dev server: Scale & limits, dynamic create hint, 50/100 ideas, provider presets, custom-endpoint field, 4-mode web-search switch, Tavily key add, custom key into pool, zero console errors)

**Milestone 1 deviations from the ticket (recorded honestly):**
- The repo never had a 20-author cap or the 15-minute sync/backup rate limits (those exist on the live SaaS). Nothing to remove; `limits` now exposes the knobs the repo does have.
- `restartLimit` did not exist in the repo either; it was *added* as a configurable limit (default unlimited) rather than removed.
- L3 semantic re-check for large batches is deferred to stage 6 by design (documented on the job via `embedNote`); this is what keeps 10,000-keyword intake fast while dup protection still runs before any Ghost write.


### Milestone 2 — Smart Auto-Author Engine (Rule 2) — ✅ COMPLETE (2026-10-16)
- [x] `src/lib/types.ts` — `AuthorProfile` upgraded: `avatarUrl` (external `https://thispersondoesnotexist.com/image?seed=<unique>` URL string — zero disk), `ghostAuthorId`/`ghostSlug` (real Ghost mapping only), `articleCount`, `maxArticles` (default `DEFAULT_AUTHOR_CAP` 250), `expertise[]`, `status: active|retired`, `country: "US"`, `voice: AuthorVoice` (rhythm/diction/sentenceLengthBand/pov/tone/readingLevel/signatureMoves/bannedPhrases), `shortBio`, `origin auto|manual`; `Job.authorId`; `Article.authorCounted` (idempotency); `Site.autoAuthors` toggle
- [x] `src/lib/authors.ts` — rebuilt: 50 US first names / 40 surnames / 30 US cities+states (2-letter codes + full names), credentialed bio pool, deterministic per-niche `voiceFor()` (no two authors sound alike), `avatarUrlFor()` unique seed per author; `matchOrCreateAuthorForTopic()` (expertise match + `articleCount < 250` + least-loaded; exact-stem fast path + fuzzy token pass capped at 2,000 authors so 10k intake stays sub-minute; memoized tokenization); `markAuthorPublished()` single-shot counter + retirement at 250; `normalizeAuthorProfile()` migration; `authorVoiceBlock()` prompt block; `previewAuthorMatch()` pure UI simulator
- [x] `src/lib/engine.ts` — author auto-assigned at every dispatch point: `submitKeywords` (keywords + calendar items) and `queuePlan` (clusters + pillar); `publishArticle` prefers `job.authorId` (idempotent per job) and increments the counter once via `article.authorCounted`; site static build now passes authors through
- [x] `src/lib/store.ts` — persist **v7 → v8** migration: every stored author normalized to the new shape in place (bio → shortBio, voice/avatar/articleCount derived from id, article counts recomputed from articles, ghost fields nulled), sites get `autoAuthors ?? true`; new actions `addExpertAuthor(niche)` + `patchAuthor(id, patch)`; backup-restore merges also run the normalizer so old backup files restore cleanly
- [x] `src/lib/ghost.functions.ts` — `publishGhostPost` accepts an `author` payload; resolves a REAL Ghost author (stored id verified via `/ghost/api/admin/authors/{id}/`, else slug/name lookup); never invents an id and never attempts creation — on no-match it keeps Ghost's default byline and reports the status; matched ids ride back to `AuthorProfile.ghostAuthorId`
- [x] `src/components/desk-workers.tsx` — live publish attaches `authors:[{id}]` when resolved; passes `avatarUrl` as `profile_image` URL string (never downloaded); stores the real Ghost id back on the profile
- [x] Stage 2/3 prompts consume the author voice block: `model-stages.tsx` (draft + revision system prompts, persona overrides pov/banned phrases) and `live-writer.tsx`/`rewrite.ts` `writeWithModel` — prompt versions bumped to `draft@2-author-voice` / `revision@2-author-voice`
- [x] JSON-LD `Article` + `Person` (name, jobTitle, description, `knowsAbout` = expertise, `image` = avatar URL, homeLocation "Austin, TX, US", url = author archive) emitted in `src/lib/static-site.ts` via `articleJsonLd()` + byline card (`authorBylineHtml()`, `referrerpolicy="no-referrer"`, lazy-loaded, graceful initials fallback in React) + `/author/{slug}/` archive pages on static builds
- [x] `src/components/pages/authors.tsx` + routes — Smart Auto-Author inspector: engine status banner, avatar with fallback initials, expertise badges, capacity meter (`{articleCount} / 250 articles` + bar), Active/Capped status, Ghost/local badge, voice signature card, **niche match simulator** (dry-run pick vs would-generate), **"Auto-Generate US Expert Author"** one-click generator, manual byline edit; article detail page shows the byline card + badges (no manual gate, no author-count cap)
- [x] Tests: `src/lib/m2-authors.test.ts` (9 node:test cases, in `npm test`) + `scripts/m2-authors-verify.ts` (`npm run test:m2`, vite-node, 8 real-engine checks: US personas + unique avatar seeds, distinct voices, niche matching, least-loaded ties, per-job idempotency, 249→250→251 rotation, offline 10-job intake assignment, zero-disk static build + JSON-LD); `scripts/m2-ui-smoke.mjs` (Playwright, 10 checks)
- [x] Validation: `npx tsc --noEmit` clean · `npm test` **82/82** · `npm run test:m1` **8/8** · `npm run test:m2` **8/8** · `npm run build` ✅ · Playwright UI smoke **10/10** (`/authors` banner+meter+simulator+generator, article byline card, zero console errors; evidence at `%TEMP%\kilo\rea-live\m2-ui\`)

**Milestone 2 validation note (recorded honestly):** the "publish draft on disposable Ghost" live check was **not** executed — no disposable Ghost Admin key was supplied this pass. The Ghost author-attach path is implemented defensively (verify-or-fallback, never invent ids) and the studio-ledger assignment/rotation/byline path is fully verified offline. First live publish against a disposable Ghost should confirm the author resolves before the 250-cap engine is trusted end-to-end.

### Milestone 3 — Bing SEO Pipeline + Humanization + 11-Stage Research (Rules 3, 5) — ✅ COMPLETE (2026-10-16)
- [x] `src/lib/stage-contracts.ts` — **intent@2-bing** (zod `IntentBlueprintSchema`: intent, audience, **answerBlock 40–60 words**, 2–6 question-shaped H2s, tablePlan, 5–8 mustCover; 1 auto-retry with the validation error appended; deterministic `fallbackBlueprint` when no model runs), **draft@3-bing-author-voice** (direct-answer opening, question H2s, exactly-one-table rule, single H1 + question-shaped FAQ, author voice block embedded), **revision@3-bing-scrub** (banned-phrase sweep, repetition collapse, rhythm enforcement with author+site+robotic defaults), deterministic `roboticScrub()` + `bannedPhraseScan()`, `buildContextBlock` (site + author voice in every stage)
- [x] `src/lib/engine.ts` + `src/components/model-stages.tsx` — **stage 1 (Intent) is now a real model stage** (`Job.modelIntent`, `modelUsage.intent`, gated in `finishRunningStage` like draft/revision); draft consumes the blueprint (answer block, question H2s, table plan); revision output passes through `roboticScrub` before persistence; **humanizer is a mandatory pipeline step** — `HumanizePipeline` scrubs with the assigned author's banned phrases after Metric37, and a live publish **holds** (`ghostPush: "held"`, honest label) until humanState is done, releasing automatically (no-key → held + labeled, never fabricated)
- [x] `src/lib/static-site.ts` — JSON-LD `Article`+`Person` (M2) + CLS-safe CSS (figure aspect boxes, table chrome, lazy images), single H1, and **7 ad-slot placeholders** (`site_top, home_feed, article_top, article_inline, article_bottom, article_sidebar, site_bottom` reserved with `data-ad-slot` + comments for Milestone 4 configuration)
- [x] `src/lib/ops.functions.ts` + `src/lib/ghost.functions.ts` + `desk-workers.tsx` — **IndexNow auto-ping after live-publish success** and on verified deploy (existing delivery flow): chunked ≤100 URLs via `submitIndexNow`, result logged to Activity honestly (skips are labeled with the reason, Bing is only called when the key file is verified)
- [x] Research engine rebuild — `src/lib/types.ts` (`RESEARCH_STAGES` R1–R11 live names, `ResearchStageRecord` with tokens/attempts/status/error, `ResearchQuery/Action/Cluster/Output`, `ResearchProject` with breadth + stagesRequested 11 + stagesCompleted + archive) and **new `src/lib/research-engine.ts`**: LLM stages R1–R6, R8, R9, R11 (zod-validated, 1 auto-retry, safe-stop on failure with later stages left pending and uncharged) via an injected chat fn (key pool + `generateDraft` in the store), derived **R7 Semantic consolidation** (cosine > 0.90 merge, 0 tokens, local embed) and **R10 Content action classification** (covered→skip / partial→refresh / weak|missing→write, 0 tokens), stage-level retry that continues from what is missing, archive/restore, `planFromResearch` (R4+R9 output → review-status TopicPlan, clusters first)
- [x] `src/components/pages/research.tsx` — 11-stage inspector: READY/PARTIAL/FAILED pills, 8 tabs (Overview/Niche/Audiences/Problems/Topic map/Queries/Coverage/Clusters & plan), per-stage tokens/duration/attempts with Show provenance, per-stage Retry, Resume, archive/restore, breadth (compact/standard/wide), Build-plan → Topic Plans
- [x] `src/lib/operator.ts` — `buildResearch` stub deleted (its honest "From your site"/"Calculated" math lives on as `siteEvidenceFacts` inside the engine's project facts); store persist **v8 → v9** normalizes legacy fact-only projects into the staged shape without data loss
- [x] Tests: `src/lib/m3-research.test.ts` (9 node:test cases in `npm test`: blueprint/stage zod fixtures, robotic scrub + banned-phrase scan, R7 dedupe threshold, R10 classes, full 11-stage scripted run, rerun idempotency, no-key honest failure, retry-continues-from-missing with zero re-charge of done stages, plan-from-research) + `scripts/m3-verify.ts` (`npm run test:m3`, 10 real-module checks incl. prompt-version asserts and static-build ad-slot/CLS/JSON-LD assertions) + `scripts/m3-ui-smoke.mjs` (Playwright, 8 checks)
- [x] Validation: `npx tsc --noEmit` clean · `npm test` **91/91** · `npm run test:m1` **8/8** · `npm run test:m2` **8/8** · `npm run test:m3` **10/10** · `npm run build` ✅ · Playwright UI smoke **8/8** on `/research` (engine copy, breadth, project creation, honest NO_RESEARCH_KEY failure with retry visible, all 11 stage names, zero console errors) + **10/10** M2 regression smoke on `/authors` + article detail

**Milestone 3 validation notes (recorded honestly):**
- The "one small live-key run" of the research engine was **not** executed — no live chat key was supplied this pass. The scripted-chat + no-key + retry paths are fully verified offline; a single live research run on a real key should be smoke-tested before production use.
- Stage 1's blueprint prompt is live in model-stages; the estimation/fallback path derives an equivalent blueprint deterministically (`fallbackBlueprint`) so drafts without a model still carry the answer-block/table plan.
- IndexNow on live Ghost publish pings the panel's static-domain key-file configuration; where no verified key file exists the skip is logged with the reason (Bing is never called unverifiable).

### Milestone 4 — Calendar 100% + Ad-Ready Static + Deploy Providers (Rule 6) — ✅ COMPLETE (2026-10-16)
- [x] `src/lib/worker.functions.ts` (new) + `src/components/shell.tsx` — durable worker bridge decoupled from a single browser tab: file-backed atomic registry (`%TEMP%/ghost-grok-worker/worker.json`), 10s server loop, honest heartbeat (`lastBeatAt`, `online`, `activeJobs`, `nextCalendarPulseAt`, ticks) and the pure `leaseDecision` **single-dispatch lease** (verified: second tab denied, expiry frees, same tick renews); `tick()` claims/renews the lease and the shell badge shows the real server heartbeat. Job execution still runs from the browser store until the SQL migration (honest limitation recorded below)
- [x] `src/lib/types.ts` — calendar on the live contract: `autoGenerate / autoPublish / autoReweave` (3 independent, default OFF, `mode` MANUAL), `publishMode "published"|"draft"`, `timezone`, `activeDays`, `articlesPerWeek`, `publishTime`, `generationLeadHours`, `strategy PILLAR_FIRST`, `planningRangeDays`, `defaultModelCatalogId`, computed `cadence`/`automation`; `CalendarEntry` statuses `SCHEDULED|WRITING|READY|PUBLISHED|DRAFT_SAVED|SKIPPED|FAILED`; ad/worker/route-diff types
- [x] `src/lib/operator.ts` — `pulseCalendars` honors all 3 switches independently (autoGenerate queues at write_at; autoPublish releases at publish_at per mode → PUBLISHED/DRAFT_SAVED; autoReweave proposes pillar-first sibling links); `buildCalendar` pillar-first with lead hours; `migrateCalendar` (persist v10) **always writes the switches OFF** so backup/restore can never auto-enable automation; `publishCalendarItemNow` (mode-aware Publish now / Save draft now)
- [x] Calendar item lifecycle + actions — store `patchCalendarItem` (reschedule `publishAt`/skip/restore), `removeCalendarItem`, `writeCalendarItem` (Write now → /generate semantics), `publishCalendarItem`, `fillCalendarFromPlan` reporting `{scheduled, unscheduled}`
- [x] Auto cluster-link re-weave — `reweaveCalendar` + desk-worker PUT pass using the **`updated_at` optimistic lock** (`src/lib/reweave.ts`: `reweaveDecision`, `reweavePutBody`, `withEdgeState` → `GHOST_CONFIRMED`/`FAILED`); hand-edited posts are skipped and reported, never clobbered; manual Connections "Audit → typed APPLY" untouched
- [x] `src/components/pages/calendar.tsx` — planning-only restriction removed and all 3 switches unlocked with the dynamic `"Publish automatically"` / `"Save drafts automatically"` label, timezone + lead-time + week controls, active-day picker, truthful cadence/automation summaries, `"automation on" | "manual"` pill, List / Month / Cluster views, Fill-from-plan, per-entry Write now / Publish now / Save draft now / Skip / Restore / Reschedule / Delete, server-heartbeat line
- [x] `src/lib/static-site.ts` — 7 live ad slots fully configured and rendered (`site_top, home_feed, article_top, article_inline, article_bottom, article_sidebar, site_bottom`), per-slot `enabled/name/adType (custom_code|adsense_responsive)/code` with **16 KiB cap** (over-limit refused + commented), AdSense unit wrap + single loader, exact placement rules (`home_feed` after card 6 only with ≥7 posts, omitted on short feeds; `article_inline` after top-level paragraph 3 only with ≥6), deterministic `adsConfigHash`, preview mode (labeled placeholders, live scripts off), 300px sidebar rail ≥1200px, **`/ads.txt` tracked artifact**
- [x] `src/components/pages/delivery.tsx` — ad-slot configurator (7 slots, byte budget, AdSense unit generator, position metadata), ads.txt editor, master ads switch, preview mode, route-diff HOLD card with `removedRoutes[]` + "Acknowledge & Deploy Anyway" / "Rebuild with missing articles", four provider cards (cPanel + Cloudflare/Vercel/GitHub with credential save/verify/deploy)
- [x] Route-Diff protection — `routeDiffFor` + gate in `packageDeploy`: any previously live route missing from the candidate build ⇒ `status: "hold-route-diff"` with `removedRoutes/addedRoutes/unchangedCount`, deployment blocked until explicit `resolveRouteDiff("deploy-anyway" | "rebuild")`
- [x] `src/lib/ops.functions.ts` — Cloudflare Pages (direct upload manifest), Vercel (v13), GitHub Pages (Contents API with sha) adapters: hardcoded https hosts (SSRF-proof), `readDeployFiles` guards (traversal/base64/32 MiB), credential validation, live-project honesty, IndexNow on `VERIFIED_DEPLOYED`
- [x] `src/lib/ghost.functions.ts` — `updateGhostPostHtml` PUT re-weave (GET current `updated_at` → guard → PUT with the lock), `publishGhostPost` returns `updatedAt` stored on the article
- [x] Tests: `src/lib/m4-calendar-static.test.ts` (7 node:test cases in `npm test`) + `scripts/m4-verify.ts` (`npm run test:m4`, 8 checks incl. a real offline pipeline run through the switches) + `scripts/m4-ui-smoke.mjs` (Playwright, 17 checks)
- [x] Validation: `npx tsc --noEmit` clean · `npm test` **98/98** · `test:m1` **8/8** · `test:m2` **8/8** · `test:m3` **10/10** · `test:m4` **8/8** · `npm run build` ✅ · Playwright **17/17** on `/calendar` + `/static-delivery` (M2 10/10 + M3 8/8 re-run)

**Milestone 4 notes (recorded honestly):** no live provider deploy was executed (no Cloudflare/Vercel/GitHub credentials supplied; hosts are hardcoded https and payloads validated — first real deploy should use throwaway projects). The worker bridge supplies the durable heartbeat + single-dispatch lease while job execution still runs from the browser store; server-owned execution remains the SQL migration item. Route-diff compares against the last verified deploy's route set (live-sitemap probe variant noted as future hardening).

### Milestone 5 — Custom UI Theme Polish + Full QA + Safe-Release (Rule 7) — ✅ COMPLETE (2026-10-16)
- [x] Repo-wide lint is clean again: the 3 tracked errors fixed (overview.tsx `useBeat` now runs before any early return; `client.server.ts` empty catch carries a real comment; `markdown.ts` builds its link-sentinel regex at runtime so the sanitizer keeps identical behavior without a control-char literal) **plus** all 23 warnings cleared (unused imports/args across engine/store/operator/pages/tests/scripts, hook deps in account/analytics, and two documented file-level `react-refresh` disables for the intentional token+component co-location in `ui.tsx`/`shell.tsx`) → `npx eslint .` exits **0 with zero output**
- [x] `src/lib/themes.ts` + `src/styles.css` — Rule 7 identity pass: **`THEME_TOKENS` is now the single source of truth** for all 6 themes × 17 tokens (midnight/paper/forest/rose/sepia/ocean) with `relativeLuminance`/`contrastRatio` helpers, and the release gate proves the CSS blocks mirror the TS exactly; refined surface hierarchy (`color-mix` borders, layered card shadows, ambient header glow via `header[data-shell-header]::after`), ≤200 ms cubic-bezier micro-transitions on buttons/tabs/pills/switches/inputs, `:focus-visible` ring with mixed brass, tabular numerals (`.tnum`), and a `prefers-reduced-motion` block that disables the shimmer
- [x] Accessibility fixes found **by** the new gate: midnight `--color-ink` was 3.15:1 on its accent (AA needs 4.5) → darkened to `#061326` (5.6:1); paper's near-white ink missed at 4.50 → pure `#ffffff` (4.7:1). All six themes now pass body ≥7, muted ≥4.5, faint ≥3, ink-on-accent ≥4.5
- [x] `src/components/ui.tsx` — new `Skeleton`, `SkeletonRows` (aria-live loading region), and `StateNote` (loading/empty/partial/error with our own copy) primitives
- [x] Long-running views wired to honest states: `/research` (hydration skeleton + per-project partial/error note), `/runs` (skeleton + "some runs did not finish cleanly"), `/articles` (skeleton + waiting-on-humanization partial note), `/calendar` (skeleton + paused-worker partial note), `/static-delivery` (skeleton + "delivery is not indexable yet" partial), `/analytics` (skeleton + empty-corpus note)
- [x] `src/lib/areas.ts` (new, pure) — the 20 canonical areas with their shell groups (`Workspace · Content · Website · Settings · Account`), the 4 palette quick actions, and `routeFileCandidates()` so the gate can prove every area resolves to a real route file; `src/components/shell.tsx` consumes it, renders the 5 groups, and keeps the duplicate Backup entry palette-only
- [x] `Ctrl+K` palette expanded: all 20 area jumps (matched punctuation-insensitively), the 4 quick actions (New Keyword Batch · New Research Project · Open Calendar Automation · Build Static Site — the last one really calls `buildSite()`), and 6 theme commands that switch live
- [x] `"Writing service"` badge now reflects the real M4 server heartbeat with an accessible popover (`aria-expanded`, `aria-label`): state, last server beat + relative time, active jobs, next calendar pulse, dispatch-lease holder/expiry, source, and a pause/resume control
- [x] Security invariant tightened while testing it: `packWorkspace` now redacts **provider** credentials too (`ftp.password`, `api.token`) alongside the Ghost admin key, and the gate asserts no secret string survives an export
- [x] Tests: `src/lib/m5-release-gate.test.ts` (7 node:test cases in `npm test`: token completeness, contrast, CSS↔TS parity, 20-area resolvability, palette actions, golden path, security audit) + `scripts/m5-verify.ts` (`npm run test:m5`, 4 checks incl. a full simulation-mode golden path and a printed contrast table) + `scripts/m5-ui-smoke.mjs` (Playwright, 12 checks)
- [x] **Safe-release gate, all green:** `npx tsc --noEmit` 0 · `npx eslint .` **0 errors, 0 warnings** · `npm test` **105/105** · `test:m1` 8/8 · `test:m2` 8/8 · `test:m3` 10/10 · `test:m4` 8/8 · `test:m5` 4/4 · `npm run build` ✅ · Playwright: M5 **12/12** (5 groups, palette area/action/theme, lease popover, **all 20 areas render**, zero console errors), M2 10/10, M3 8/8, M4 17/17 (re-run standalone; the triple-run 2/8 was a smoke timing flake, hardened with an explicit route wait)

**Milestone 5 notes (recorded honestly):** the "golden path" runs in simulation mode exactly as M1–M4 do (no live provider keys were supplied this pass); `scripts/browser-smoke.mjs` remains the guarded M1 helper and the M5 coverage lives in `m5-ui-smoke.mjs` rather than being bolted onto it; the GOVERNOR §11 evidence pack is this section plus the per-milestone §4–§7 handoffs.

---

## 3. Working Rules / Reminders
1. Follow MASTER_SPEC §7 invariants on every milestone (single-shot Ghost, gates, metering, secrets, SSRF).
2. Live Ghost publish + deploy tested only on disposable/test workspace; never against production brand.
3. Migrations: expand/contract, nullable first, never destructive drops without backup + rollback note.
4. English UI labels/status codes; Bangla operator notes allowed (GOVERNOR §28).
5. Unverified → label `[assumption]`; never claim metrics not measured.

---

## 4. Milestone 1 handoff (2026-10-16)

**What shipped (files):**
- `src/lib/types.ts` — `Limits`, `DEFAULT_LIMITS`, `WebSearchConfig`/`WebSearchKey`/`WebSearchMode`; `AiKey.providerKind`/`catalogId`; `Job.keyId`/`failoverChain`/`restarts`; `Persisted.limits`/`webSearch`; `KEYWORD_CAP`/`CONCURRENCY` deleted.
- `src/lib/model-catalog.ts` (new), `src/lib/model-pool.ts` (new), `src/lib/web-search.ts` (new), `src/lib/web-search-plan.ts` (new).
- `src/lib/engine.ts` — `limitsOf`, `keyPool`, `restartJob` cap + `restarts`, `CorpusIndex` fast gate (`buildCorpusIndex`/`gateAgainstIndex`/`addToCorpusIndex`, `LARGE_BATCH_LIMIT`), raised log windows, configurable build history.
- `src/lib/providers.functions.ts` — `tavilySearch`, `firecrawlSearch`.
- `src/lib/store.ts` — persist v7 + migration; `patchLimits`, `setWebSearchMode`, `importWebSearchKeys`, `clearWebSearchKeys`, `setWebSearchKey`, `takeWebSearchKey`; extended `addKey`.
- UI: `src/components/pages/keys.tsx` (pool + catalog/custom + web-search switch), `src/components/pages/settings.tsx` (Scale & limits), `src/components/pages/create.tsx` (dynamic caps/ideas), `src/components/model-stages.tsx`, `src/components/live-writer.tsx`, `src/lib/rewrite.ts`, `src/lib/operator.ts`.
- Tests: `src/lib/m1-limits.test.ts` (in `npm test`), `scripts/m1-engine-verify.ts` (`npm run test:m1`).

**How to run:**
- `npx tsc --noEmit` → clean · `npm test` → 72/72 · `npm run test:m1` → 8/8 · `npm run build` → succeeds.

**Evidence:** UI smoke 23/23 via Playwright against the dev server (screenshots + JSON at `%TEMP%\kilo\rea-live\evidence\ui-*.png`, `ui-verify.json`).

**Known limitations / next-milestone notes:**
- Rule 1 "10,000+" is verified at the **intake/queue** layer (10,000 jobs created sub-minute, no cap). Bulk *generation* throughput still depends on the browser tick + provider limits; moving the worker server-side is the Milestone 4 job.
- The large-batch index path runs L1+L2 at intake and defers L3 to stage 6 (recorded per job). If a stricter intake L3 is ever required at 10k scale, it needs a pgvector-backed index (Milestone 4 SQL migration).
- `webSearch` keys live in the browser blob like the other secrets; no server-side secret store yet (unchanged posture).
- 3 pre-existing ESLint errors remain in untouched files (`components/pages/overview.tsx` conditional `useBeat`, `lib/app-data/client.server.ts` empty block, `lib/markdown.ts` control-char regex). Left as-is per the no-drive-by rule; flag if lint must be green for CI.
- Web-search providers are wired to live Tavily/Firecrawl endpoints but were **not** called with a real key in this pass (no keys supplied); verification covered plan/mode/key-pool logic and UI. First real call should be smoke-tested with one throwaway key.


---

## 5. Milestone 2 handoff (2026-10-16) — Smart Auto-Author Engine (Rule 2)

**What shipped (files):**
- `src/lib/types.ts` — expanded `AuthorProfile` (avatarUrl, voice, articleCount/maxArticles, status, ghostAuthorId/ghostSlug, country US, shortBio, origin) + `DEFAULT_AUTHOR_CAP = 250`; `Job.authorId`, `Article.authorCounted` (single-shot counter guard), `Site.autoAuthors` (default-on toggle).
- `src/lib/authors.ts` — full rebuild: US name/city/state pools, credentialed bio pool, deterministic distinct `AuthorVoice` per niche, unique zero-disk `thispersondoesnotexist.com/image?seed=<token>` avatar URLs, memoized token/stem caches + `FUZZY_MATCH_LIMIT` fast paths so the matcher stays sub-minute on 10k batches, `matchOrCreateAuthorForTopic`, `markAuthorPublished` (idempotent + 250 retirement), `normalizeAuthorProfile` (v8 migration), `authorVoiceBlock` (stage prompt block), `previewAuthorMatch` (pure UI dry-run).
- `src/lib/engine.ts` — author assignment at intake (`submitKeywords` keywords/review-held + calendar items, `queuePlan` clusters + pillar — nothing in a run is authorless); publish binds `job.authorId` and counts exactly once; static build passes site authors.
- `src/lib/store.ts` — persist v8 + in-place author migration (no data loss), `addExpertAuthor`, `patchAuthor`, backup-restore normalizer.
- `src/lib/ghost.functions.ts` + `src/components/desk-workers.tsx` — Ghost author resolve/verify-or-fallback on publish, `authors:[{id}]` on the post, real `ghostAuthorId` stored back; avatar travels as an external URL string only.
- `src/lib/stage-contracts.ts`, `src/components/model-stages.tsx`, `src/components/live-writer.tsx`, `src/lib/rewrite.ts` — per-author humanized voice injected into draft/revision/live-write prompts (`draft@2-author-voice`, `revision@2-author-voice`).
- `src/lib/static-site.ts` — `articleJsonLd()` (Article + Person: knowsAbout/image/homeLocation/jobTitle), `authorBylineHtml()`, `/author/{slug}/` archives, sitemap includes author routes; avatars referenced as lazy external URLs.
- `src/components/pages/authors.tsx` + `src/components/pages/articles.tsx` — engine inspector UI (banner, capacities, badges, voice card, simulator, generator, manual edit) + article byline card.
- Tests/scripts: `src/lib/m2-authors.test.ts`, `scripts/m2-authors-verify.ts` (`npm run test:m2`), `scripts/m2-ui-smoke.mjs` (Playwright).

**How to run:**
- `npx tsc --noEmit` → clean · `npm test` → **82/82** · `npm run test:m1` → **8/8** · `npm run test:m2` → **8/8** · `npm run build` → ✅
- `node scripts/m2-ui-smoke.mjs` against `npm run dev` (:8080) → **10/10** (banner, capacity meters, simulator pick, generator spawn 3→4 cards, article byline + badges + capacity, zero console errors). Evidence: `%TEMP%\kilo\rea-live\m2-ui\ui-verify.json` + authors-before/after + article-detail PNGs.

**Avatar size policy (user requirement):** avatars are never downloaded or stored — the static build embeds only the URL string (~90 chars, far under the 50 KB budget) and renders it in a 52 px lazy-loaded `<img>` with `decoding="async"` and `referrerpolicy="no-referrer"`. Any future inlining/downloading of avatars is prohibited by Rule 2; if remote weight ever matters, swap the image host rather than caching files.

**Known limitations / next-milestone notes:**
- Ghost author attach is verify-or-fallback by design (Admin API cannot create staff authors); first disposable-Ghost publish must confirm the resolve path (see checklist note above).
- `articleCount` counts confirmed stage-6 completions; authors retire at 250 and the niche spawns a fresh US expert on the next job (verified 249→250→251).
- The engine created authors per distinct niche stem in the 10k batch test — the same O(1)-per-job fast path that keeps intake under a minute guards this; no hard author cap exists.
- 3 pre-existing ESLint errors remain in untouched files (unchanged from Milestone 1 handoff).

---

## 6. Milestone 3 handoff (2026-10-16) — Bing SEO Pipeline + Humanization + 11-Stage Research (Rules 3, 5)

**What shipped (files):**
- `src/lib/stage-contracts.ts` — Bing contract upgrade: `IntentBlueprintSchema` (answerBlock 40–60w, 2–6 question H2s, tablePlan, 5–8 mustCover) with 1-validation-retry + `fallbackBlueprint`; `buildIntentPrompt` / `buildDraftPrompt` (direct-answer opening, single-H1 + question-FAQ, exactly-one-table rule) / `buildRevisionPrompt` (robotic-AI scrub order); `roboticScrub()` + `bannedPhraseScan()`; `buildContextBlock` embeds the Rule 2 author voice in every prompt. Versions: intent@2-bing, draft@3-bing-author-voice, revision@3-bing-scrub.
- `src/lib/types.ts` — `IntentBlueprint`; `Job.modelIntent` + `modelUsage.intent`; `Article.ghostPush+"held"`; research domain (RESEARCH_STAGES R1–R11 live names, stage records, queries/coverage/clusters/actions/priority outputs, breadth, archive).
- `src/lib/engine.ts` — stage 1 gated as a model stage (reserve/settle like draft/revision via `MODEL_STAGE_INDEX.intent`); blueprint feeds `composeArticle` angle + mustCover; publish unchanged otherwise (single-shot invariant untouched).
- `src/components/model-stages.tsx` — intent + draft + revision model loop with the one-auto-retry contract; revision output scrubbed (`roboticScrub` with author+site phrases) before `acceptModelStage`.
- `src/lib/store.ts` — `acceptModelStage` accepts "intent" (parses blueprint); persist v9 (legacy research → staged shape); actions `runResearch` (Rule 4 key pool + honest SETTLED metering of research usage), `retryResearchStage` (resets failed only, continues), `archiveResearch`, `queuePlanFromResearch`, `logEvent` (client activity), `addResearch(niche, notes, breadth)`.
- `src/lib/research-engine.ts` (new, pure + chat-injected) — 11 stages: LLM R1–R6, R8, R9, R11 (zod, safe-stop, per-stage attempts/tokens), derived R7 (cosine > 0.90 merge, 0 tok) + R10 (write/refresh/skip, 0 tok), `siteEvidenceFacts` (old stub's honest math), `rerunFailedStages`, `planFromResearch`, `normalizeResearchProject` (v9 migration).
- `src/lib/ghost.functions.ts` + `src/components/desk-workers.tsx` — Rule 3d publish policy (`held` until humanization done; released by the humanize worker) + Rule 3c IndexNow auto-ping on live publish success (logged honestly, ≤100 URLs).
- `src/components/humanize-pipeline.tsx` — mandatory humanization keeps processing every non-humanized article; post-Metric37 author-voice scrub; releases held live publishes.
- `src/lib/static-site.ts` — 7 ad-slot placeholders (`data-ad-slot`) incl. placement comments for M4 (home_feed after 6th card, article_inline after paragraph 3); CLS-safe figure/table CSS.
- `src/lib/operator.ts` — `buildResearch` stub removed.
- UI: `src/components/pages/research.tsx` (full 11-stage inspector, 8 tabs, provenance, retry, archive, breadth, build-plan).
- Tests/scripts: `src/lib/m3-research.test.ts` (in `npm test`), `scripts/m3-verify.ts` (`npm run test:m3`), `scripts/m3-ui-smoke.mjs`.

**How to run:**
- `npx tsc --noEmit` → clean · `npm test` → **91/91** · `npm run test:m1` → **8/8** · `npm run test:m2` → **8/8** · `npm run test:m3` → **10/10** · `npm run build` → ✅
- `node scripts/m3-ui-smoke.mjs` against `npm run dev` → **8/8** (`/research` engine copy, breadth control, project creation, honest NO_RESEARCH_KEY failure, 11 stage names, retry control, zero console errors). Evidence: `%TEMP%\kilo\rea-live\m3-ui\` + M2 regression smoke 10/10 (`%TEMP%\kilo\rea-live\m2-ui\`).

**Known limitations / next-milestone notes:**
- Research has not been run with a live chat key (none supplied); scripted/no-key/retry paths verified offline. First live research run should be on a throwaway key.
- R5 uses the plain corpus + evidence; optional web-search enrichment (Rule 5 Tavily/Firecrawl inside research stages) is deliberately left for the M4 worker pass — the switch itself shipped in M1 and remains wired for ideas/digests/live-writer.
- Ad slots are reserved markup + comments only; per-slot config (enable/name/type/16 KiB cap), ads.txt and route-diff are the Milestone 4 scope, as planned.
- Calendar automation still ticks from the browser tab; the server-side worker migration (Rule 6) is Milestone 4.
- 3 pre-existing ESLint errors remain in untouched files (unchanged from M1 handoff).

---

## 7. Milestone 4 handoff (2026-10-16) — Calendar 100% + Ad-Ready Static + Deploy Providers (Rule 6)

**What shipped (files):**
- `src/lib/types.ts` — live calendar contract (3 independent default-off switches, publishMode, strategy PILLAR_FIRST, lead hours, computed cadence/automation), entry lifecycle, 7 ad slot ids + 16 KiB cap + position map, `WorkerState`, route-diff deploy fields, `DeployProvider.api`, `StaticBuild.routes`/`adsConfigHash`, `Article.ghostUpdatedAt`.
- `src/lib/operator.ts` — summaries/labels; `buildCalendar`; `pulseCalendars` with the three switches independent; `publishCalendarItemNow`; `reweaveCalendar`; `migrateCalendar` (v10; switches always OFF on migrate/restore).
- `src/lib/worker.functions.ts` (new) — durable file-backed heartbeat + `leaseDecision` single-dispatch lease; 10s server loop.
- `src/lib/reweave.ts` (new) + `ghost.functions.ts` — PUT-only re-weave with `updated_at` optimistic lock, hand-edit protection, `withEdgeState` LinkEdge transitions; publish returns `updatedAt`.
- `src/components/desk-workers.tsx` — autoReweave PUT pass + IndexNow on live publish.
- `src/lib/static-site.ts` — 7 slots rendered per config with placement rules, 16 KiB enforcement, AdSense wrap/loader, `adsConfigHash`, preview mode, `/ads.txt`, `buildRoutes`.
- `src/lib/engine.ts` — route-diff gate (`hold-route-diff`) + `resolveRouteDiff` + multi-provider packaging; build records routes + ads hash.
- `src/lib/ops.functions.ts` — Cloudflare Pages / Vercel / GitHub Pages adapters with payload guards over hardcoded https hosts.
- UI: `src/components/pages/calendar.tsx` (unlocked switches, 3 views, per-entry actions, heartbeat line), `src/components/pages/delivery.tsx` (ad configurator, ads.txt, preview, route-diff card, provider cards), `src/components/shell.tsx` (real server heartbeat badge).
- Tests/scripts: `src/lib/m4-calendar-static.test.ts`, `scripts/m4-verify.ts`, `scripts/m4-ui-smoke.mjs`.

**How to run:**
- `npx tsc --noEmit` → clean · `npm test` → **98/98** · `test:m1`/`test:m2` → **8/8** each · `test:m3` → **10/10** · `test:m4` → **8/8** · `npm run build` → ✅
- UI: `node scripts/m4-ui-smoke.mjs` vs `npm run dev` → **17/17** (`/calendar` switches + pill + views + entries, `/static-delivery` 7 slots + 16 KiB + ads.txt + 4 providers, zero console errors). Evidence `%TEMP%\kilo\rea-live\m4-ui\`.

**Known limitations / next steps:**
- Live provider deploys not executed (no credentials); adapters validated structurally only. Do one throwaway deploy per provider before trusting them.
- Worker: heartbeat + lease are server-durable, execution still browser-hosted. Moving job execution server-side (SQL-backed claims) is the remaining Rule 6 depth item.
- Route-diff currently diffs against the last verified build's routes; adding a live sitemap probe is a hardening follow-up.
- 3 pre-existing ESLint errors remain in untouched files (unchanged since M1).

---

## 8. Milestone 5 & Safe-Release Gate Handoff (2026-10-16) — Rule 7

**What shipped (files):**
- `src/lib/themes.ts` — `THEME_TOKENS` (6 themes × 17 tokens) as the single source of truth + `relativeLuminance`/`contrastRatio`/`themeLabel`; `src/styles.css` mirrors it token-for-token (the gate proves parity) and adds surface-hierarchy CSS, ambient header glow, ≤200 ms micro-transitions, `:focus-visible` ring, tabular numerals, and the motion-safe `.skeleton` shimmer.
- `src/components/ui.tsx` — `Skeleton`, `SkeletonRows` (aria-live), `StateNote` (loading/empty/partial/error).
- `src/lib/areas.ts` (new) — the 20 canonical areas + groups + palette actions + `routeFileCandidates()`; `src/components/shell.tsx` renders the 5 groups, the expanded `Ctrl+K` palette (20 area jumps, 4 quick actions, 6 theme switches), and the accessible heartbeat popover driven by the real M4 worker state.
- Long views wired: `research`, `runs`, `articles`, `calendar`, `delivery`, `analytics`.
- `src/lib/backup.ts` — provider credentials (`ftp.password`, `api.token`) redacted from exports alongside the Ghost key.
- Tests: `src/lib/m5-release-gate.test.ts`, `scripts/m5-verify.ts`, `scripts/m5-ui-smoke.mjs`.

**Final measurement evidence (the safe-release gate):**
| Gate | Result |
|---|---|
| `npx tsc --noEmit` | exit 0 |
| `npx eslint .` | exit 0 — **0 errors, 0 warnings** (was 3 errors + 23 warnings) |
| `npm test` | **105 / 105** passing (was 98; +7 release-gate cases) |
| `npm run test:m1` | 8 / 8 |
| `npm run test:m2` | 8 / 8 |
| `npm run test:m3` | 10 / 10 |
| `npm run test:m4` | 8 / 8 |
| `npm run test:m5` | 4 / 4 (with the printed per-theme contrast table) |
| `npm run build` | succeeded (client + SSR + nitro/vercel) |
| Playwright `m5-ui-smoke.mjs` | **12 / 12** — 5 shell groups · palette area jump/action/theme · lease popover · **20/20 areas render** · zero console errors |
| Playwright regressions | m2 10/10 · m3 8/8 · m4 17/17 (standalone) |

**Accessibility measurements (per theme, body / muted / faint / ink-on-accent):** midnight 17.7/8.8/6.3/5.6 · paper 16.9/7.5/4.6/4.7 · forest 16.6/9.9/6.4/8.6 · rose 16.2/8.2/5.4/5.1 · sepia 13.8/7.2/5.2/5.9 · ocean 16.7/9.7/6.6/6.8. Two real defects were found by the gate and fixed (midnight ink 3.15→5.6, paper ink 4.50→4.7).

**Known limitations / no-go list:**
- Live-key verification for research (M3 note) and provider deploys (M4 note) remain unexecuted — no external credentials were supplied. Everything else is machine-verified above.
- Worker execution still browser-hosted behind the durable lease; server-owned job execution is the remaining depth item (SQL-backed claims).
- `scripts/browser-smoke.mjs` stays the guarded M1 helper; M5 coverage lives in `m5-ui-smoke.mjs` by design.
- 10,000-article **generation** throughput is still bounded by provider/browser limits (intake at 10k is proven); the SQL worker migration is the documented next step.

---

## 9. Hotfix (2026-10-16) — Interactive-production bug triage: render loops, "Run missing", stalled pipelines

**Reproduction:** live Playwright interaction against the dev server (not static smokes): submit keywords → `/runs/$id`; duplicate submissions; topic-plan create → queue; research start; rapid navigation during worker ticks. Found via a temporary `window.__gawStore` handle + runs-array transition logger armed in the browser.

**Root causes & fixes (files):**
1. **Pipeline stalls / FAILED at stage 1** — `src/components/model-stages.tsx` and `live-writer.tsx` built their key pool via `keyPool(...)` WITHOUT filtering to credential-eligible keys, then raced the engine's simulation path: on every render while a stage was "running" they POSTed to the studio key's empty `baseUrl`, got "No base URL or secret stored in this browser", and `failModelStage` killed the job before the engine's duration-based simulated settle could land. Fix: pool filtered by `keyCallsModel(key)`; empty pool = simulation mode = engine settles by duration (matches the run header's "estimated — no model called" honestly). Same fix in `create.tsx` (topic-plan `proposePlan` fell back to the template `makePlan`).
2. **"Run missing / That run is not in this studio"** — three stale-snapshot wholesale spreads raced user commits: (a) the 400 ms worker `tick` spread `{...current, ...advance(clone)}` where the clone was taken before concurrent commits landed; (b) async actions `queueKeywords` / `queueTopic` / `writeCalendarItem` spread `result.data` from snapshots taken before their awaits; (c) `ensureAuthors` / `weaveLinks` / `auditNow` spread a state cloned seconds earlier after a long weave/audit chain — wiping the just-created run (and any concurrently committed jobs/articles) → `/runs/$id` rendered "Run missing". Fix: new `mergePersisted(base, incoming, CHURNED_COLLECTIONS)` upsert-merges those 12 collections by id (incoming replaces same-id entries, base-only entries survive) and every one of those set-sites now commits through it. UI hardening: detail routes (`RunDetail`, `ArticleDetail`, `PlanDetail`, `CalendarDetail`) show skeletons until the store hydrates — "…missing" can only be truthful after hydration — and mutating CTAs (Start run, Queue selected) are disabled with a "Still connecting…" hint until the store is hydrated, so a submission can no longer land in seed state and be wiped by rehydration.
3. **Render-loop class** — audited every `useApp` selector (no allocator selectors exist; all return stable slices) and effect-write chains (patch guards bound them). With (1) fixed, the fail→retry cascade that could hammer updates during navigation is gone. Verified: `Maximum update depth exceeded` zero occurrences across keyword runs, plan runs, research runs, and rapid 8-route navigation stress (`hotfix-interactive-verify.mjs` check 4).

**Verification:** `tsc` 0 · `eslint` 0/0 · `npm test` **105/105** · m1–m5 suites 8/8, 8/8, 10/10, 8/8, 4/4 · `npm run build` ✅ · **`scripts/hotfix-interactive-verify.mjs` 12/12** (keyword run e2e to COMPLETED + article, plan e2e, research honest failure, rapid-nav stress, zero update-depth, zero console errors; evidence `%TEMP%\kilo\rea-live\hotfix-verify\hotfix-verify.json`). Dev store handle `window.__gawStore` kept as a read-only debug aid.

---

## 10. Hotfix (2026-10-17) — External Metric37 humanizer replaced by the native blader/humanizer engine

**Decision:** the external Metric37 API (and its dedicated 500-key pool) is gone. Humanization is now a first-class in-app module implementing the open-source lader/humanizer skill (v3.1.0, MIT — Wikipedia "Signs of AI writing"), spec cloned at knowledge-base/blader-humanizer/SKILL.md.

**New module: src/lib/humanizer.ts** (dependency-light, unit-testable, no store/server imports):
- BLADER_RULES — all 26 anti-patterns from the skill, strongest first (staging contrasts, one-line closers, deep sayings, staged run-ups, arguing with no one, forced triads, repeated openings, em-dash chaining, stacked qualifiers, overused AI words, inflated significance, vague association, shallow -ing riders, sales language, borrowed authority, avoided is/are/has, formatting-by-rule, curly quotes, chatbot residue, knowledge-limit disclaimers, heading echo, document self-narration, wrong-reader replies).
- scanAiPatterns / humanizerScore — deterministic detector + 0–100 prose-purity score (code blocks, inline code, link targets and table cells are never misread as prose).
- deterministicScrub — offline rewrite: chatbot residue, filler closers/stock sections, em/en dashes, curly quotes, "It's not just X, it's Y" contrasts (sentence-scoped), banned-vocabulary swaps, author/site banned phrases. Structure-preserving by construction.
- humanizeWithBlader — the full two-pass surgical rewrite (pass 1 audit → BLADER_AUDIT_CONTRACT, pass 2 rewrite → BLADER_REWRITE_CONTRACT) through an injected BladerChat transport (built on unWithKeyPool() via keyPoolChat()/siteChat() in ewrite.ts), combined with the assigned US author's uthorVoiceBlock. A result that breaks the Bing skeleton (H1/H2/H3/table/link fingerprint) is refused and the deterministic outcome is kept.

**Pipeline wiring:**
- Stage 2 (Draft): BLADER_DRAFT_RULES anti-pattern constitution injected into uildDraftPrompt → prompt version draft@4-blader-anti-ai.
- Stage 3 (Revision): uildRevisionPrompt now runs the blader two-pass in prompts (evision@4-blader-humanize); model-stages.tsx additionally rewrites the scrubbed revision through humanizeWithBlader and records Job.humanizerScore/humanizerStripped/humanizerPasses.
- Post-draft pipeline (HumanizePipeline) rewrites every article (deterministic pass always; LLM passes when a usable model key exists), meters usage into the SETTLED ledger (stage: "humanize"), and stores humanizerScore/humanizerStripped/humanizerPasses/humanizerNote on the article.
- Stage 6 composition copies the job's humanizer metadata onto the article.

**Removals:** humanizeChunk server fn (api.metric37.com), HumanizerKey type + humanizerKeys/humanizerCursor persisted fields + importHumanizerKeys/clearHumanizerKeys/setHumanizerKey/takeHumanizerKey actions, the AI Keys pool UI; all Metric37 copy across bing/desk-workers/articles/create/analytics/help/keys.

**UI:** AI Keys → "Blader humanizer (native)" status card (ruleset, two passes, no extra key); Content Settings → engine card (lader@1); Article Detail → prose-purity badge + "AI patterns stripped in Stage 3 revision" list; Run Detail → per-job Blader badge (score, passes, stripped count).

**Verification:** 	sc --noEmit clean · eslint clean · 
pm test **114/114** (new src/lib/humanizer.test.ts 9/9: 26-pattern integrity, trope detection incl. "delve"/"tapestry"/"It's not just X, it's Y", deterministic rewrite, table/link/code preservation, score improvement, chat fall-back safety) · 
pm run build OK · live e2e 12/12 (scripts/hotfix-interactive-verify.mjs, zero update-depth/console errors) · live probe: a fresh keyword run's articles land with humanizerScore: 91, stripped list recorded, humanState: done, no keys configured (deterministic pass).

---

## 11. Hotfix (2026-10-17) — six-stage parity: stage 4/5 model stages + provider embeddings

**Report:** the live six-stage ledger shows real tokens on every stage (Intent & Blueprint 1,209 · Draft 4,431 · Revision 6,532 · **Metadata 1,287** · **Enrichment 1,795** · Validation & Publish 0), but our runs reported **0 tokens** for Metadata and Enrichment, and the L3 duplicate gate always logged `No provider embedder on this key … This model has no embeddings support.` Two distinct gaps vs `GHOST-AI-WRITER-V2-GOVERNOR.md §4` and `§3/§5`.

**Gap 1 — only stages 1–3 were model stages.** `MODEL_STAGE_INDEX` mapped `intent|draft|revision` only, and `runMetadataStage`/`runEnrichmentStage` hard-coded `stage.tokens = 0`. GOVERNOR §4 defines stage 4 (Metadata, fast LLM — title ≤60, metaDescription ≤155, slug, tags ≤3, excerpt) and stage 5 (Enrichment, fast + vision — links from published inventory only, image queries + placement) as real model stages; only stage 6 is "no LLM".
- `src/lib/engine.ts` — `MODEL_STAGE_INDEX` = `{intent,draft,revision,metadata,enrichment}`; per-stage timeouts (60s/75s); `reserveStage` now reserves for 4/5; both stages call the injected `host.chat` transport with Zod validation and settle provider usage; model failure still falls back to the deterministic packaging/links/images (never fails the job); new `uniqueSlug()` suffixes `-2`/`-3` on collision instead of a false L1 refusal.
- `src/lib/stage-contracts.ts` — `MetadataSchema`/`EnrichmentSchema` + `parseMetadataStage`/`parseEnrichmentStage` + `buildMetadataPrompt`/`buildEnrichmentPrompt`; prompt versions bumped `metadata@2-llm` / `enrichment@2-llm`.
- Output wiring — `Job.enrich.{title,metaDescription,slug}` + `Job.modelUsage.{metadata,enrichment}`; stage 6 lands them as `Article.metaTitle`/`metaDescription`, the packaged slug, tags and excerpt; `static-site.ts` uses metaTitle/metaDescription for `<title>`, meta description and JSON-LD; `ghost.functions.ts` sends `meta_description`.

**Gap 2 — the embed path sent the chat model to `/embeddings`.** `embed-key.ts` passed `key.model` (a chat model), so `/embeddings` answered "no embeddings support" and L3 always took the hash fallback.
- `src/lib/model-catalog.ts` — `DEFAULT_EMBEDDING_MODEL = "text-embedding-3-small"`, per-provider defaults (OpenAI yes; OpenRouter/custom need an explicit id), `providerForKind()`, `embeddingModelFor()`.
- `src/lib/types.ts` — `AiKey.embeddingModel?`.
- `src/lib/embed-key.ts` — capability match: resolve the embedding model (explicit → provider default), and return **no provider** when the family has no embeddings route so the honest hash fallback is taken instead of a doomed request; `getEmbedding` loaded lazily so the meter stays import-side-effect free.
- `src/lib/store.ts` + `src/components/pages/keys.tsx` — `addKey`/`patchKey` persist `embeddingModel` and derive `semantic`; the key card shows `Semantic (text-embedding-3-small)` or `Semantic: hash fallback`, and the add/edit form has a "Semantic model (embeddings)" field.

**Verification:** `tsc --noEmit` 0 · `eslint .` 0 errors/0 warnings · `npm test` **135/135** (+5 `src/lib/stage-metadata-enrichment.test.ts`: embedding routing, both schemas, `uniqueSlug`, and a scripted-chat run asserting stage 4/5 tokens = 30 each, stage 6 = 0, and that an invented link slug is dropped) · `test:m2`/`m3`/`m4`/`m5` green · `npm run build` ✅.
**Pre-existing, unrelated:** `npm run test:m1` reports 7/8 — its `keyPool` check expects disabled/cooling/over-allowance keys to be *dropped*, but `engine.ts:826-853` documents and implements the newer Rule 4 "demote, never drop" design. Left untouched (stale verifier assertion); flagged for a separate decision.

---

## 12. Fix (2026-10-17) — dev server reloaded the page forever

**Symptom:** the browser full-reloaded about every 1.3 s (Playwright: 7–8 `load` events in 10 s) with zero JS errors; Vite logged `{"type":"full-reload"}` each time.

**Root cause:** the app writes runtime artifacts *inside the Vite root* — `.data/appstate.json` on every server-state save (`src/lib/server-store.server.ts:171-182`), plus downloaded photos into `data/media` and `public/media` (`src/lib/image-fetch.ts:24`). Vite watched all of them, so each write triggered a full reload; the reloaded client synced state again, and the cycle never stopped. Nothing in the §11 work caused it — it is an always-present watcher conflict that any state save re-arms.

**Fix:** `vite.config.ts` — `server.watch.ignored` now excludes the runtime/derived dirs: `**/.data/**`, `**/data/**`, `**/public/media/**`, `**/.vercel/**`, `**/dist/**`, `**/.output/**`. Source dirs stay watched, so HMR is unchanged.

**Verification:** Playwright reload probe — before: 7 loads/12 s; after: **1 load/10 s** with one client-side route normalization and no reload on `/`, `/ai-keys`, `/create`, `/runs`. `tsc --noEmit` 0 · `eslint .` 0/0.

---

## 13. Fix (2026-10-18) — generated article page: repeated images, avatar source, checklist repair

**Report:** a generated article page showed several near-identical images stacked one by one, loosely related to the title; the author avatar was pinned to a cached CDN face instead of the live `thispersondoesnotexist.com` portrait; the static page read flat; and the Bing checklist permanently showed "fix" on three rows with no way to act.

**Root cause & fix:**
1. **Repeated images** — `applyFetchedImages` (`src/lib/media-html.ts`) inserted a figure before *every* `<h2>` from the whole `images[]` array with no dedupe. It now resolves each slot to its real URL, inserts the featured shot once, then only **distinct** photos (capped in-body), so two slots that collapse to the same thumbnail no longer repeat. `figureHtml` now prefers the image's own query over the article-level fallback.
2. **Weak relevance** — `photoQuery`/`planImages` (`src/lib/engine.ts`) keyed section shots off the section heading alone. Every query now leads with the article **title's subject noun** (featured = title only) plus a distinct scene, and the section `remote` uses that query instead of the bare heading — each image is about the page and different from its neighbours.
3. **Avatar source** — `src/lib/avatar.ts` + `src/lib/authors.ts` store the direct `https://thispersondoesnotexist.com/image?seed=<token>` URL (renders a fresh face per request; the reducer/tests already expected this form). The retired resize-CDN URL is migrated in `normalizeAuthorProfile`; the in-app proxy still serves a small WebP for the studio UI. Static builds ship a ~60-byte URL string and **zero** image bytes.
4. **Page polish (Rule 7/6)** — `src/lib/static-site.ts` shared stylesheet got a design pass (layered paper background, hero-cropped featured image, hover-lift feed cards, rounded tables/code, refined type/spacing) plus `og:`/Twitter share tags on post pages.
5. **Actable Bing checklist** — the article Detail card (`src/components/pages/articles.tsx`) now offers a **Fix** button per failing row backed by `src/lib/bing.ts` helpers: `index` sets `index,follow` (with an inline public-URL field), `query` runs `alignKeywordToQuery()` (query into title + opening, no heading stuffing), `unique` links the near-duplicate angle (`nearDuplicateSibling`) or points at Regenerate.

**Verifier realignment (stale asserts, not code regressions):** `scripts/m1-engine-verify.ts` keyPool check expected dropped keys, but Rule 4 is documented "demote, never drop"; `scripts/m3-verify.ts` still asserted `/Robotic-AI scrub/` and `draft@3-bing-author-voice` (superseded by the §10 humanizer refactor) and looked for `aspect-ratio` in post HTML rather than the shared `assets/site.css` (§7). All three now assert the current contract.

**Verification:** `tsc --noEmit` 0 · `eslint .` 0 errors/0 warnings · `npm test` **149/149** · `test:m1` **8/8** · `test:m2` **8/8** · `test:m3` **10/10** · `test:m4` **8/8** · `test:m5` **4/4** · `npm run build` ✅. Generated-page probe (planImages → applyFetchedImages → staticFiles): 4 figures, 4 unique URLs, featured = title-only query, avatar hot-link + `og:image` present, zero image files in the build.


