# Governor audit — Ghost AI Writer (own panel)

- Date (Asia/Dhaka): 2026-09-30
- Scope: this repository as it sits on disk. No live Ghost counts, no token totals, no uniqueness percentiles. Those were not measured in this pass.
- Contracts: `docs/GHOST-AI-WRITER-V2-GOVERNOR.md` §3–§5, §21, §22. Companion map: `docs/GHOST-AI-WRITER-V2-WORKFLOW-MAP.md`.
- Decision for a production brand: **NO_GO** for unattended live Ghost publish and auto-deploy. The panel runs in the browser store. Several contracts exist only in part.

This file is the handoff. Repair against the contract text. Do not treat a Partial row as done.

## Score

| | Count |
|---|---|
| Fulfilled | 1 |
| Partial | 14 |
| Not built | 0 |

## Contract lines

| Contract | Status | What is actually in the code |
|---|---|---|
| §3.1 Niche Intelligence | Partial | `suggestIdeas` in `src/lib/engine.ts` filters with `gateText` plus a commodity regex and does not queue jobs. Ideas are fixed frames in that function, not a model `{ideas:[{keyword, why}]}` call. The round settles the constant `IDEA_TOKENS` from `src/lib/types.ts`. There is no `IdeaRound` table. An empty niche returns an error string, not an HTTP 4xx. |
| §3.2 Keyword intake | Partial | `normalizeKeyword` and `submitKeywords` in `src/lib/engine.ts` trim, case-fold, cap at `KEYWORD_CAP` (100), freeze `publishMode` on the run, and store refused jobs with L1/L2/L3 reasons. `CONCURRENCY` is 2 in `advance`. `restartJob` sets `stageIndex` to `-1` and calls `blankStages()`, so a restart does not resume `Job.stage`. There is no database unique index on `(websiteId, normalizedKeyword)`. `corpusFor` uses articles and pending jobs only, not `site.ghost.inventory`. |
| §3.3 Metering | Partial | `usableKey` compares settled USD + open reserved USD + an estimate to `allowanceUsd`. `settle` writes `SETTLED`. Stage 6 settles 0 tokens in `finishRunningStage`. Provider embed spend is settled when `meter.spent() > 0`. `RELEASED` is a type on `UsageEvent` and a parameter of `settle`, but no caller passes `"RELEASED"` (`cancelRun` does not). Chat 401/429 in `src/lib/providers.functions.ts` returns an error and does not disable the key or set `cooldownUntil`. Money is USD via `usdFor`, not micro-USD. Idea rounds settle `IDEA_TOKENS` even though no model was called. |
| §3.4 Pillar supporting | Partial | `queuePlan` sets the pillar job `dependsOn` the non-refused cluster job ids. `advance` will not `startJob` until `depsResolved`. `publishArticle` uses 7–8 sections when `job.kind === "pillar"`. `generatePlan` / `clusterTitles` build at most 8 template titles and reject only when fewer than 4. That is not a 6–10 model plan with semantic dedupe above 0.88. Status values are `review` / `queued` / `running` / `completed` / `partial`, not the handbook QUEUED/READY set. |
| §3.5 Link re-weave | Partial | `buildAudit` only appends an audit with proposals and says nothing was written. `applyAudit` is a second call. `applyAudit` edits `article.html` / `markdown` and sets link state `LOCAL`. It does not `PUT` Ghost with `updated_at`. There is no nightly `links.audit`. The scan is every article on the site, not a 5-post cap. Orphan count is `inboundCount(...) === 0` inside `buildAudit`. Intensity bands come from `intensityBand`. |
| §4 Six-stage pipeline | Partial | `STAGES` in `src/lib/types.ts` names Intent & Blueprint, Draft, Quality & Coverage Revision, Metadata & Packaging, Site Enrichment, Final Validation & Publication. `finishRunningStage` calls the provider only for `draft` and `revision`, and only when `keyCallsModel` is true (secret and base URL). Other stages settle 0 and the note `estimated — no model called` when no model key is present. There is no Zod/JSON-schema check per stage and no `promptVersion`. `VoiceSettings` in `src/lib/types.ts` is `tone`, `voice`, `sections`, `sectionImages`, `linkIntensity`, `imageProvider`, `publishAs`, `modelKeyId` — no `bannedPhrases`, `brandFacts`, `pov`, or `readingLevel`. `composeArticle` sets `verifyFlags` to `[]` and fills `coverage` / `intentMatch` with `score()` (a hash range), not a model revision. `restartJob` rebuilds stages from scratch. `publishArticle` refuses a second shot when `job.shots >= 1` and an `articleId` already exists. |
| §5 Duplicate protection | Partial | `gateText` refuses L1 on normalized keyword or slug, L2 when `lexicalSimilarity` is above `L2` (0.85), L3 when cosine is above `L3` (0.88). `publishArticle` calls `gateText` with `allowVariants` false. `submitKeywords` refuses while `ghost.corpus` is `EMPTY` or `SYNCING`. Embeddings go through `embedAllForL3` (provider, else hash). `src/lib/l3-embed.test.ts` checks dimension match and hash fallback, not normalize or each gate layer. There is no persistent embedding row written after publish beyond `job.embedSource` / `job.embedNote`. |
| §21.1 Static intent | Partial | `createBuild` in `src/lib/engine.ts` pushes a new `StaticBuild`. `staticFiles` in `src/lib/static-site.ts` renders HTML from the current article list. Upload uses that live list (`uploadAutoBuild` / the delivery page). An old build row is not mutated, but there is no frozen file snapshot per build id. |
| §21.2 Why static | Fulfilled | No copy in `src/` claims that static delivery is itself a ranking win. Checked `src/components/pages/delivery.tsx` and `src/lib/static-site.ts`. |
| §21.3 Zero-duplication URLs | Partial | `postHref` in `src/lib/link-graph.ts` and `staticFiles` publish `/post/<slug>/` (three path pieces: `post`, slug, `index.html`). Home, post pages, `sitemap.xml`, `robots.txt`, and canonicals use `site.publicUrl`. The builder does not emit tag, author, or date archives. Orphans are counted in `buildAudit`, not in the static builder. |
| §21.4 Static UI | Partial | `src/components/pages/delivery.tsx` has the auto-rebuild toggle, template ids `classic-editorial`, `minimal-authority`, `affiliate-review`, Public URL, robots, footer, header/footer menus, head HTML, body-end, analytics snippet, build cards, and `probePublicUrl`. Cloudflare, GitHub, and Vercel are not deploy paths. |
| §21.5 Static acceptance | Partial | `createBuild` returns `status: "failed"` when `validatePublicUrl` fails. `probePublicUrl` in `src/lib/ghost.functions.ts` is called with `site.publicUrl`. A site with zero articles still succeeds because `pages = articleCount + 1`. `StaticBuild` has no `includedIds` or `excluded`. Auto-rebuild sets `pendingRebuildAt = now + 2500`, not ~60 seconds. |
| §22.1 Discovery priority | Partial | `staticFiles` always adds `sitemap.xml`. Internal links are a pipeline feature. IndexNow is `submitIndexNow` in `src/lib/ops.functions.ts`, started from `src/components/pages/analytics.tsx`. It is not a batch fired after a successful live probe. |
| §22.2 IndexNow checklist | Partial | `indexNowKeyFile` is pushed by `staticFiles` when `site.indexNowKey` is set. `submitIndexNow` uploads that key file through the verified cPanel FTPS path, fetches the key URL, and only then POSTs to `https://api.indexnow.org/indexnow`, returning the HTTP status. Nothing in `advance` calls it after deploy. There is no Bing Webmaster report reader. |
| §22.3 Answer-engine content | Partial | `composeArticle` prefixes the opening paragraph with the keyword as the question the page answers. Cluster titles from `clusterTitles` are question-shaped. `verifyFlags` is initialized to `[]` and not filled. Permalinks are `/post/<slug>/`. |

## Repair order for the next agent

Do these in order. Do not turn on live publish or auto-rebuild as part of a drive-by fix.

1. **Metering honesty (§3.3).** Stop settling `IDEA_TOKENS` when `suggestIdeas` did not call a model. Write `RELEASED` from `cancelRun` for any open `RESERVED` pair. On provider 401, set the key `disabled` and log a danger activity line. On 429/5xx, set `cooldownUntil`. Keep stage 6 at 0 LLM tokens.
2. **Resume, don't rewind (§3.2, §4).** `restartJob` must keep completed stage outputs and continue at the failed `stageIndex`. Do not call `blankStages()` if `shots >= 1` except to reconcile by slug.
3. **Corpus (§5, §3.2).** `corpusFor` must include synced `site.ghost.inventory` titles/slugs, not only local articles. Add tests for `normalizeKeyword` and L1/L2/L3 fixtures.
4. **Ideas (§3.1).** When the active key has `secret` and `baseUrl`, call the provider and store the returned ideas. Keep the current frames only as the no-key path, and settle 0 tokens on that path. Do not auto-queue.
5. **Topic plans (§3.4).** Generate 6–10 clusters from the model when a key exists. Keep the pillar `dependsOn` barrier. Reject counts outside 6–10 instead of accepting 4.
6. **Re-weave (§3.5).** `applyAudit` on a live Ghost connection must `PUT` the post with the current `updated_at` (see the existing update path in `src/lib/ghost.functions.ts`). Never `POST` a new post for a re-weave. Local demo mode must stay labeled local.
7. **Pipeline voice and stage checks (§4).** Extend `VoiceSettings` with `pov`, `readingLevel`, `bannedPhrases`, and `brandFacts`, and pass that block into draft and revision. Do not invent coverage numbers with `score()` once a model revision returns real coverage.
8. **Static snapshot (§21).** Persist `includedIds` and `excluded[{id, reason}]` on `StaticBuild`. Fail a build that includes zero articles unless the operator confirms. Debounce auto-rebuild to about 60 seconds. Upload the files of that build, not a later regeneration.
9. **IndexNow (§22).** After a live probe succeeds, submit the changed public URLs. Keep the current refusal when cPanel is not verified. Do not claim Google reads IndexNow.

## Explicit non-goals for that pass

- Do not enable live Ghost publish by default.
- Do not mark Cloudflare, GitHub, or Vercel as deployable until one of them actually uploads `staticFiles`.
- Do not add a Postgres migration unless the store stops being the browser `gaw-v2` blob. The governor's Prisma/pgvector checklist is **not** this app's runtime.
- Do not paste Admin keys, FTP passwords, or API secrets into prompts or logs.

## Where the behavior lives

| Area | File |
|---|---|
| Gates, ideas, plans, stages, builds, audit | `src/lib/engine.ts` |
| Stage names, caps, thresholds | `src/lib/types.ts` |
| Embeddings | `src/lib/l3-embed.ts`, `src/lib/providers.functions.ts` (`getEmbedding`) |
| Model draft | `src/lib/providers.functions.ts` (`generateDraft`), `src/components/model-stages.tsx` |
| Ghost read/write | `src/lib/ghost.functions.ts` |
| IndexNow | `src/lib/ops.functions.ts` (`submitIndexNow`) |
| Static HTML | `src/lib/static-site.ts` |
| Auto upload | `src/lib/auto-upload.ts` |
| Delivery UI | `src/components/pages/delivery.tsx` |
| Analytics / IndexNow UI | `src/components/pages/analytics.tsx` |
| Persistence | `src/lib/store.ts`, `src/lib/durable-storage.ts` |
