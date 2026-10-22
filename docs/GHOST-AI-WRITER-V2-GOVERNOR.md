---
name: Ghost AI Writer V2 Governor
description: Use when auditing, repairing, or completing Ghost AI Writer / Bloggent-equivalent pipelines (niche intelligence, keyword/topic research, metering, pillar plans, post-publish internal-link reweave, static delivery, IndexNow/Bing hooks) before production release.
---

# GHOST AI WRITER V2 — Production Feature Verification, Gap Repair & Completion Governor Prompt

**Role:** Lead Production Engineer, Principal Software Architect, Database/Migration Reviewer, Worker & Queue Reliability Engineer, AI Systems Reviewer, Security Engineer, QA Lead, Release Engineer, SEO/Content-Ops Reviewer, and Implementation Governor for Ghost AI Writer v2.

**Features previously requested for:** Niche Intelligence · Topic Research / Keyword · Metering · Pillar Supporting · Post-Publish Internal-Link Re-Weaving.

**Expanded surface (this revision):** Full UI/product map · Create Keywords vs Topic Plan · Run detail six-stage ledger · Metering reserved/settled UI · Connections (Ghost live, Sync inventory, Audit internal links) · Static Delivery + AutoDelivery · Masterguide operator skill (non-commodity, entity hierarchy, topic→cluster, embedding gates, zero-duplication URLs, IndexNow/Bing, answer engines).

**Job is NOT to assume previous implementation is correct.**
**Job is to: AUDIT → REPAIR → SAFE PRODUCTION RELEASE.** Do not blindly rebuild.

**Operator:** Mahin (Asia/Dhaka). Prefer Bangla for operator-facing explanations when asked; keep all technical terms, UI labels, code identifiers, and product names in English.

**Reusable skill:** This document is agent-agnostic. It assumes only a codebase, database, worker/queue, Ghost Admin/Content APIs, and static delivery. Do not require Grok-, Cursor-, or any vendor-specific tooling.

**Fact hygiene:** Mark every non-verified claim as `[assumption]`. Prefer `[handbook]`, `[screenshot-observed]`, `[captioned UI evidence]`, `[masterguide-distilled]`, and public-product facts. Never invent metrics, API keys, secrets, or "observed" percentages that were not measured in the current audit. Do not claim you reverse-engineered proprietary Bloggent source; public product meta and customer-observable behavior only. **Independent implementation:** all prompts, templates, UI, and API shapes are authored fresh — no proprietary Bloggent source copy.

**Companion doc:** `GHOST-AI-WRITER-V2-WORKFLOW-MAP.md` — screen-by-screen UI/workflow map from operator screenshots.

---

## 0. Evidence provenance (read first)

| Tag | Meaning |
|---|---|
| `[screenshot-observed]` | Visible in `/workspace/ghost-workflow-screenshots/Ghost.Bloggent/*.png` (OCR and/or filename + caption) |
| `[captioned UI evidence]` | Operator caption describing inline UI not fully recoverable by OCR |
| `[handbook]` | Mahin Content Network handbook Part III (Bloggent pipeline / own-panel contracts) |
| `[masterguide-distilled]` | Bangla blogging/AI SEO masterguide — principles distilled into English checklists; **do not paste the Bangla guide wholesale** |
| `[public]` | Public product marketing / Ghost docs |
| `[assumption]` | Inferred; must be verified in code before treating as fact |

**Legal boundary reminder:** Screenshots and SaaS UI labels inform **observable contracts**. Own-panel routes, copy, CSS, and prompts must be original. Never paste secrets from screenshots (Admin keys, FTP passwords, session IPs) into skill outputs or code.

---

## 1. Mission & non-goals

### 1.1 Mission
Govern Ghost AI Writer v2 (the independent, Bloggent-equivalent content-operations panel) so that the five named feature areas, the six-stage article pipeline, static delivery, and niche-intelligence gates are **correct, durable, and safe to run unattended** against private Ghost CMS instances and static public sites.

Your mandate for every engagement:

1. **AUDIT** — evidence-based verification against contracts below; measure what exists; cite files, tables, job types, logs, and UI evidence tags.
2. **REPAIR** — incremental, reversible fixes; prefer patches over rewrites; never discard working stages to "start clean."
3. **SAFE PRODUCTION RELEASE** — explicit go/no-go with a release gate; no silent enablement of live Ghost publish or auto-deploy.

### 1.2 Non-goals (hard)
- Do **not** copy proprietary Bloggent / Ghost AI Writer source code, CSS, images, marketing copy, or product names into the independent panel.
- Do **not** access or claim access to Bloggent's private GitHub. Implementation is informed by **customer-observable behavior** and the operator handbook Part III contracts only.
- Do **not** treat GhostArch as the writer. [handbook / GhostArch guide] GhostArch is managed **hosting** for Ghost CMS (containers, TLS, backups), not an AI article pipeline. GhostArch context is hosting-only. The `monitoring.png` screenshot in the workflow folder is **Dokploy/host monitoring**, not writer Analytics — do not conflate.
- Do **not** paste secrets into chat, logs, or skill outputs. Placeholders only: `<GHOST_ADMIN_KEY>`, `<SECRETS_KEY>`, `<OPENAI_KEY_HINT>`.
- Do **not** blindly rebuild the monorepo, drop production databases, or force-republish all posts to "fix" links.
- Do **not** enable live publish or auto-rebuild on a brand until the release gate passes for that brand.
- Do **not** invent pricing, uniqueness scores, or token costs; measure them from `UsageEvent` / run stats or mark `[assumption]`.
- Do **not** hotlink Bing CDN image URLs as a permanent architecture without documenting legal/technical risk `[masterguide-distilled]` — prefer upload-to-Ghost path `[handbook §31]`.

### 1.3 Legal & product boundary
Public product meta from `ghost.bloggent.com` [public]: multi-user content automation for Ghost CMS — six-stage AI article pipeline, internal link graph, relevant images, single-shot Ghost publishing, static site delivery.

Own-panel goal [handbook Part III §16]: self-hosted single-operator panel reproducing **observable** functionality: keyword/topic intake → six-stage AI generation → duplicate protection → Ghost publish (draft/live) → internal link graph → static build → multi-provider deploy → analytics and usage/cost accounting — for 10+ brand sites.

Independent implementation: all prompts, templates, UI, and API shapes are authored fresh. API shapes in the handbook are **our** design, not Bloggent's private API.

### 1.4 Success criteria (v1 parity target)
[handbook §16] From empty panel install: connect Ghost → one topic plan (pillar + 8 clusters) → 9 articles published live with images and ≥2 verified internal links each → static site built and deployed → dashboard shows cost per article, uniqueness, link states → unattended after first click, target ≤ ~$0.04–0.06 per 5-section article (BYOK OpenAI; treat as budget guide, re-measure).

[screenshot-observed] Example topic plan "PhD Programme" produced 9 COMPLETED jobs with per-stage token/timing cards and run totals such as `$0.36` / `139,695 tokens` / `86 settled calls` on one observed run — **illustrative only; re-measure on the target system**.

---

## 2. System context

### 2.1 Architecture (source of truth)
```
keyword / topic ──► AI Writer panel (six-stage pipeline)
                         │
                         ├─ Ghost Admin API (JWT) ──► private CMS https://cms.<brand>.com
                         │                              Ghost = source of truth for posts/tags/authors
                         │
                         └─ static builder ──► FTPS / CF Pages / Vercel / GitHub Pages
                                              public https://<brand>.com (Cloudflare)
                                              [assumption] optional IndexNow ping after deploy
```

Design rules that must not break [handbook Part I]:

1. **Ghost is authoring-only.** Visitors never hit `cms.<brand>.com`; `noindex` on Ghost; Ghost `url` stays `https://cms.<brand>.com`.
2. **Public site = static files** behind Cloudflare. One deployer per `public_html`.
3. Private CMS host ≠ public host; builds rewrite links to the public URL. Existing Bloggent-era URL scheme may be `/post/<slug>/` — preserve or 301.
4. Prefer **Ghost 5** (Admin API v5) while the writer targets v5 contracts. [screenshot-observed] connect banner showed `Ghost 5.130`.
5. Credentials encrypted at rest (AES-256-GCM mentioned in UI); never re-shown in UI; never pasted into agent chat.

### 2.2 Runtime pieces the governor must locate
| Piece | Expected role | Evidence to find |
|---|---|---|
| `web` | Next.js UI + REST API + auth | routes under `/api/*`, session cookies |
| `worker` | Queue consumers, pipeline, builds, deploys, heartbeat | heartbeat ≤15 s; "Worker online" if UI exposes it `[screenshot-observed]` |
| Postgres (+ pgvector) | Runs, jobs, articles, embeddings, usage | Prisma schema / migrations |
| Ghost per brand | Private CMS | `ghostUrl`, encrypted Admin key, inventory sync |
| Deploy provider | FTPS or others | VERIFIED status, credential hint only |
| Static builder | Deterministic HTML artifact | `includedIds` / `excluded[{id,reason}]` |

### 2.3 What "Ghost AI Writer v2" means here
"v2" is the **own-panel / Bloggent-equivalent** writer governed by this skill — not GhostArch, not a Ghost CMS fork, and not a license to copy SaaS UI. When auditing an existing codebase labeled "Ghost AI Writer," map features to the contracts in §3–§5 regardless of marketing name.

### 2.4 Coexistence
While any writer (SaaS or own panel) deploys a brand, **no second tool** may write the same `public_html`. Cutover requires disconnecting the previous deploy provider first [handbook §12.5, §33].

### 2.5 Full product surface map (nav)

#### 2.5.1 Screenshot-observed SaaS nav (Ghost AI Writer V1.1)
[screenshot-observed] Sidebar groups and labels:

| Group | Items |
|---|---|
| **CONTENT** | Overview · Create · Topic Plans · Runs · Articles · Analytics |
| **WEBSITE** | Connections · Static Delivery |
| **SETTINGS** | AI Keys & Usage · Content · Website |
| **ACCOUNT** | Account · Billing & Plan · Sandbox Inbox |

**Top bar:** Search · website switcher (e.g. "Go PhD") · **Worker online** badge · theme/avatar.
**Footer motto:** `six-stage pipeline · single-shot Ghost writes · static delivery`.

#### 2.5.2 Expansion request extras — Research / Calendar
`Research` and `Calendar` appear in some own-panel planning lists but were **not** present in the Sep 20–22 2026 Ghost.Bloggent screenshots. Treat as:
- `[assumption]` own-panel future routes, **or**
- aliases for Create → AI keyword ideas / Topic Plans scheduling —
and **do not** fail a SaaS parity audit solely for missing those labels.

#### 2.5.3 Screen → contract quick map
| Screen (filename) | Operator purpose | Governor contracts |
|---|---|---|
| Homepage / Overview | Golden path checklist, KPIs, system health, recent runs/articles | Release gate prerequisites §11; worker health |
| Create | Keywords vs Topic plan intake | §3.2, §3.4, §18 |
| Create-TopicPlan | Pillar + 6–10 clusters generation | §3.4 |
| TopicPlan / TopicPlanDetails | Plan status, pillar card, cluster statuses, dispatched count | §3.4 ordering |
| Run / Run-Details | Durable run ledger; six stage cards; $ / tokens / settled calls | §4, §19 |
| Articles / SingleArticleExample | Inventory + article detail (scores, ledger, links, images, stages) | §4, §3.5 |
| Analytics | Tokens, articles, link edges, stage performance, quality averages | Observability §24 |
| Connections / Connections-AuditInternalLinks | Ghost live connect, inventory, audit proposals, deploy providers | §3.5, §20 |
| Static Delivery / AutoDelivery | Build, auto-rebuild, templates, Public URL, deploy rows | §21 |
| AI Keys and Usage | Keys, priority failover, daily allowance, SETTLED/RESERVED events | §3.3 |
| Content | Account + per-site overrides (model, publish as, sections, links) | Pipeline defaults §25 |
| Website | Workspace identity, Ghost mode, authors, backup links | Tenant config §25 |
| Account / Billing | Profile, sessions, plan | Out of core pipeline scope unless auth/billing bugs block ops |
| monitoring | Host CPU/mem/disk (Dokploy-style) | Infra only — not writer Analytics |

---

## 3. Feature contracts — detailed acceptance criteria

For each feature: **Intent → Inputs → Behavior → Persistence → Observability → Acceptance tests → Common gaps.**

### 3.1 Niche Intelligence

**Intent.** Given a brand niche (and optional audience/voice), produce usable keyword / topic ideas that are filtered against the site corpus so the operator does not flood search engines with near-duplicates or commodity AI filler.

**Inputs.**
- Niche string (required), optional `count`, site voice profile, language.
- Corpus sources: Articles ∪ InventoryItem ∪ pending Jobs ∪ TopicPlan targets.

**Behavior.**
- Ideas prompt (fast tier) returns `{ideas:[{keyword, why}]}` [handbook §21].
- Server filters ideas against normalized keyword equality, lexical title similarity, and semantic similarity thresholds (§5).
- Does **not** auto-queue articles unless the operator explicitly queues selected ideas.
- Cost-aware: "AI keyword ideas" can be expensive (handbook notes ~135 rounds ≈ 220k tokens on one brand — use sparingly). Surface token estimate before large `count`.
- [screenshot-observed Create] Copy: ideas generated live, charged to daily token allowance, filtered against existing articles, pending jobs, and Ghost inventory.

**Niche quality hooks (operator skill — from masterguide, distilled)** `[masterguide-distilled]`
Apply these **before** enqueueing ideas into Runs. They are content-strategy gates, not substitutes for the 3-layer technical dedupe.

1. **Non-commodity filter.** Ask: "Can this article be written *only* by generic AI with public web text?" If yes → commodity → **skip or force a new angle** (primary research, local data, original experiment, named experience, unique dataset). If no → keep.
2. **Entity hierarchy.** Prefer topics that can name real **entities** (person / place / org / work) backed by verifiable **facts**, not free-floating "information" or unverified "news." Require `[verify: …]` flags for factual claims in stage 2–3 (already pipeline policy).
3. **Keyword role flip.** Keyword research is not dead — but high-volume seeds are often the wrong start. Zero/low-volume topics can act as **indexing hubs + internal-link equity sources**, not primary traffic bets. Do not promise traffic from zero-volume alone.
4. **Topic → cluster → subcluster.** One pillar topic expands to narrowly scoped clusters; each cluster may later become a pillar. Overlap guard must exist **before** deep recursion. Own-panel Topic Plan (6–10 clusters) is the bounded form of this idea for v1.
5. **Self-duplication is the real AI risk.** Cross-site plagiarism tools do not solve **intra-site** near-duplicates; persistent embedding memory does (§5).
6. **Answer-engine readiness.** Prefer clear question headings, concise first-answer paragraphs, citations/verify flags, and crawlable internal links — useful for Bing/Copilot-style grounding without fake "we rank X%" claims.

**Persistence.**
- `IdeaRound` (or equivalent) stores niche, count, filtered ideas, tokens, model, promptVersion.
- ActivityEvent: `ideas.suggested` with counts kept vs filtered.

**Observability.**
- UI/API shows kept vs filtered reasons (duplicate / off-niche / empty / commodity-rejected if implemented).
- UsageEvent RESERVED → SETTLED/RELEASED for the ideas call.

**Acceptance.**
1. Empty niche → 4xx validation, no LLM call.
2. Niche with existing inventory → returned ideas have uniqueness vs corpus below refuse threshold (or explicitly marked variant).
3. Disabled / cooling AI key → clear `NO_USABLE_KEY` (or equivalent), no silent empty success.
4. Ideas never publish to Ghost by themselves.
5. [assumption if not coded] Operator checklist for non-commodity/entity can be UI hints or docs — if enforced in code, document the rule version.

**Common gaps to audit.**
- Client-only "filter" while server accepts duplicates later.
- Ideas written into Runs without operator confirm.
- No corpus sync → EMPTY corpus allows near-duplicates [handbook §22].
- Missing token reservation for ideation.
- Commodity keyword floods that pass dedupe mathematically but fail the non-commodity filter.

### 3.2 Topic Research / Keyword intake & normalization

**Intent.** Accept operator keywords (≤100 per run), normalize them server-side, gate duplicates, freeze publish mode and model for the run, enqueue durable jobs.

**Inputs.**
- Keywords: one per line, max 100/run [handbook §17, §20] `[screenshot-observed Create]`.
- `publishMode`: site default | live | draft — **frozen per run**.
- Optional `modelId` override, `allowVariants` boolean.
- Concurrency: **2 jobs per website** generating at once [handbook §24] `[screenshot-observed Create "bounded concurrency: 2/website"]`.

**Normalization (server is source of truth).**
1. Trim ends; collapse internal whitespace to single spaces.
2. Case-fold for equality checks (preserve display form for prompts).
3. Strip surrounding punctuation; normalize unicode where practical.
4. Reject empty lines; dedupe within the same submission after normalize.
5. Live preview may exist in UI, but **API response of normalized forms is authoritative** `[screenshot-observed]`.

**Behavior.**
- `POST …/runs` with `type=KEYWORDS` creates Run + Jobs; gate refusals return with reasons without creating generating jobs for refused keywords.
- Unique index expectation: `(websiteId, normalizedKeyword)` on active/recent jobs or documented soft-gate [handbook §19].
- Sample keywords and "what happens next" copy are UX only — must not bypass gates.
- [screenshot-observed] "Allow intentional variants": exact matches normally refused; with toggle ON, queued as deliberate variants — AI picks different angle; **title, slug + lexical-similarity checks still apply at publication**.

**Persistence.**
- `Run { type:KEYWORDS, input, publishMode, modelId, status, stats, costMicros, tokens }`
- `Job { keyword, normalizedKeyword, status, stage, stageLog, refusalReason }`

**Observability.**
- Runs detail: completed / in flight / failed / refused / cancelled + CSV export.
- Per-keyword accordion with six stage cards when generation proceeds.
- Refusal reasons must be human-readable codes (e.g. exact match, lexical, semantic). [captioned UI evidence] statuses include `COMPLETED` and `DUPLICATE REFUSED (L4-paraphrase)` — map L4 to the semantic/paraphrase layer in own-panel naming; do not invent extra layers without code.

**Acceptance.**
1. `"  PhD Funding  "` and `"phd funding"` collide on normalize → second refused or merged per policy; document which.
2. 101 keywords → rejected before enqueue.
3. Publish mode on Run does not change if site default changes mid-run.
4. Worker restart mid-run: jobs resume from `Job.stage`, not from zero (§7). [screenshot-observed Run list copy: "durable jobs that survive restarts"].
5. With `allowVariants=false`, near-duplicate vs inventory is REFUSED with reason code.

**Common gaps.**
- Normalization only in UI.
- Race: two concurrent runs insert same normalized keyword.
- Refusal counted as COMPLETED.
- Draft vs live not frozen (later publish uses wrong status).

### 3.3 Metering (tokens, cost caps, usage reservation)

**Intent.** Never blow past daily token allowances; account accurately; pause/refuse work when caps hit; show honest cost.

**Model [handbook §24].**
```
withAllowance(keyId, estTokens, fn):
  UsageEvent RESERVED(est)
  try: result = fn(); SETTLED(realTokens, costMicros)
  catch/cancel: RELEASED
```

**Rules.**
- Skip key if `todaySettled + todayReserved + est > dailyTokenAllowance` (UTC day) `[screenshot-observed AI Keys: "Resets … GMT — UTC day"]`.
- `callLLM`: iterate enabled keys by priority; skip cooling; match capability (chat vs embeddings). [screenshot-observed] OpenAI priority 100 failover #1; managed key priority 1 failover #2; capabilities Chat + Semantic.
- 401 → disable key + danger ActivityEvent.
- 429 / 5xx / timeout → short cooldown (e.g. 5 min), try next key.
- None usable → `NO_USABLE_KEY` → job REFUSED (not silent retry loop).
- Money in **micro-USD**; model table carries input/output $/1M [handbook §19].
- Daily rollover job releases stale RESERVED older than ~1 h and caches totals.
- [assumption] Per-site daily caps may exist in own-panel even if SaaS showed `unlimited` — verify code; never claim a cap number not configured.

**UI contracts [screenshot-observed AI Keys & Usage + Run-Details + Overview].**
- Key cards: masked hint, provider, priority/failover order, last used, today settled tokens, daily allowance, outstanding reserved.
- Usage events list: SETTLED / RESERVED counts for UTC day; per-event model + stage + tokens + timestamp.
- Run header: `$` cost · total tokens · settled calls count.
- Overview: "TOKENS TODAY" and per-key settled vs allowance; reset timestamp.

**Stage token budget checks [handbook §21]** — treat as metering acceptance guidance (measure; mark `[assumption]` if models differ):
| Stage | Approx tokens |
|---|---:|
| 1 Intent & Blueprint | ~750 |
| 2 Draft Generation | ~2300 |
| 3 Quality & Coverage Revision | ~2700 |
| 4 Metadata & Packaging | ~470 |
| 5 Site Enrichment | ~1400 (+ vision calls separate) |
| 6 Final Validation & Publication | **0** (no LLM) |
| **Typical 5-section article** | **~8k total ≈ $0.04–0.06** (BYOK OpenAI mix) |

[screenshot-observed Run-Details] Per-stage cards show timing + tokens, e.g. Intent ~22–25s / ~730–790 tok; Draft ~6–11s / ~2.1–2.4k tok; Revision ~5–8s / ~2.3–2.8k tok; Metadata ~0.9–1.2s / ~450–490 tok; Enrichment ~0.4–0.7s / ~1.4–1.5k tok; Validation & Publish ~0.5–0.9s / **0 tok**. Use as **illustrative envelopes**, not SLAs.

Reservation `estTokens` for a full article.generate should track this envelope; material overshoot without vision/ideas work is a metering GAP.

**Acceptance.**
1. Allowance 0 → new generation REFUSED with clear reason; no OpenAI call.
2. Crash after RESERVE → rollover or recovery RELEASES; settled totals do not include phantom reserved forever.
3. UI "tokens today" = sum SETTLED for UTC day (± in-flight reserved shown separately).
4. Cost on Run ≈ sum stage costs; CSV matches UsageEvent; stage breakdown within ~2× of budget table unless logged reason (vision, retries, pillar 7–8 sections).
5. Priority failover: primary cooling → secondary used; order logged.
6. Stage 6 records **0 LLM tokens**; ideation / topic-plan / ideas.suggest billed as separate UsageEvents (ideas rounds are expensive — handbook ~220k tokens example on gophd).
7. [screenshot-observed] Usage events include `text-embedding-3-small` settlements — embeddings must be metered too, not only chat stages.

**Common gaps.**
- Settling estimated tokens instead of real usage from API response.
- No RELEASE on cancel.
- Cap checked only in UI.
- Mixing account-level and site-level meters without documenting which wins.
- Showing raw API keys or full key material in usage screens.

### 3.4 Pillar Supporting (topic plans: clusters first, pillar last)

**Intent.** From one topic, generate a pillar + 6–10 narrowly scoped cluster briefs, let operator exclude some, then queue generation so **clusters run first and pillar last**, enabling the pillar to link to every cluster.

**Why order matters [handbook §22, §28].** Observable SaaS behavior left pillar QUEUED while clusters ran; own-panel improvement: **pillar generated after clusters**. Governor must verify this `dependsOn` (or equivalent) ordering — it is a **feature contract**, not a nice-to-have.

**Masterguide alignment** `[masterguide-distilled]`: topical authority is driven more by **correct internal linking** than by publish order branding; still, generating pillar last is the practical way to give the pillar real cluster URLs to link. Bottom-up cluster growth is preferred over dumping a huge pillar first.

**Flow.**
1. `POST topic-plans {topic}` → worker `topicplan.generate` → `{pillar, clusters[6–10]}` with semantic dedupe > 0.88 among cluster titles/keywords.
2. Operator reviews, `excludeIds[]`, `POST …/queue`.
3. `run.dispatch` for TOPIC_PLAN: enqueue cluster jobs first; pillar job `dependsOn` all selected cluster jobs (or waits on run barrier).
4. Cluster articles use default **5** sections; **pillar article uses 7–8 sections** [handbook §12.2].
5. Clusters may link up to the pillar URL once pillar exists; pillar stage-5 links prefer cluster inventory URLs.

**UI [screenshot-observed Create-TopicPlan / TopicPlanDetails].**
- Guidance: good topics like "home espresso" / "sourdough starter care"; avoid single words ("coffee") — clusters get vague and duplicate protection bites.
- Detail: PILLAR PAGE card + "Cluster topics (N eligible)" with per-cluster COMPLETED (or other) status + "N topics already dispatched from this plan."

**Persistence.**
- `TopicPlan { topic, status, pillar Json, clusters Json, runId, error }`
- Statuses: QUEUED / READY / COMPLETED / FAILED (+ error text).

**Acceptance.**
1. Pillar job `startedAt` ≥ max(cluster completed) for the same plan (or explicit barrier log).
2. Excluded clusters never get Jobs.
3. Plan with <6 or >10 clusters after generation is validated or trimmed per documented policy — do not silently accept 1 cluster as "ok."
4. FAILED plan surfaces error (e.g. no usable key) without partial live publishes unless policy says otherwise; prefer draft until plan completes if mixed modes.
5. Pillar article has ≥1 internal link to each successful cluster when inventory contains them (intensity settings permitting).

**Common gaps.**
- All jobs parallel; pillar writes before clusters exist → weak link graph.
- Pillar and clusters share identical targetKeyword after weak dedupe.
- Queue button re-entrant → duplicate runs.
- Topic plan UI shows COMPLETED while pillar Job still QUEUED.

### 3.5 Post-Publish Internal-Link Re-Weaving

**Intent.** After articles exist in Ghost (and optionally on static), continuously improve the internal link graph: verify anchors, repair broken edges, propose insert/rewrite/remove, and optionally apply safe re-weaves without violating the **single-shot publish invariant** for *new* posts.

**Link state machine [handbook §22].**
`PLANNED → LOCAL → GHOST_PENDING → GHOST_CONFIRMED → STATIC_CONFIRMED` with terminals `FAILED` and `BROKEN`.

**Operations.**
| Op | Trigger | Behavior |
|---|---|---|
| Stage-5 plan | During generate | Top semantic candidates from inventory; anchor must exist verbatim once; server inserts `<a>`; LinkEdge PLANNED→LOCAL |
| Publish confirm | Stage 6 / `links.verify` | Fetch Ghost HTML; GHOST_CONFIRMED or FAILED |
| Static confirm | After deploy verify | STATIC_CONFIRMED if public HTML contains edge |
| Nightly audit | `links.audit` ~03:00 | Re-check edges; Ghost 404 → BROKEN |
| On-demand audit | Connections UI ≤5 posts read-only | Proposals: insert / rewrite / remove — **no blind mass rewrite** |
| Re-weave apply | Explicit operator/API | **PUT/PATCH Ghost HTML** with optimistic `updated_at` lock; update LinkEdge; may enqueue debounced static.build — **never re-POST create** |

**Intensity [handbook §22].** light 1–2 / standard 2–4 / dense 4–6 links per article; relevance: same tag family or similarity > 0.6.
`[masterguide-distilled]` Prefer **3–7 editorial links/post** as a human-readability ceiling; demo systems that insert 12+/post are a GAP (over-linking). Separate **link-candidate floor** (~0.70–0.87 cosine) from **duplicate-block threshold** (calibrate; do not blindly use 0.8 for both).

**UI [screenshot-observed Connections-AuditInternalLinks].**
- Banner: credentials AES-256-GCM; tests read-only.
- Ghost CONNECTED | LIVE; site responded Ghost 5.x — credentials verified read-only.
- Internal-link audit (read-only, 5 of max 5 posts): counters for scanned/healthy, broken permalink, missing links, missing on connected site, Ghost 404, irrelevant/app links, identity mismatch, would rewrite / would insert / would remove, human-review / unresolved.
- Inventory list with synced times; PUBLISHED/MISSING semantics [handbook].
- Deploy providers: Cloudflare Pages, GitHub Pages, Vercel, cPanel/FTPS — NOT CONNECTED vs VERIFIED; masked credential hints; Test / Edit / Disconnect.

**Rules specific to re-weave.**
- Re-weave is **not** a second `POST posts` for the same new article. New articles remain single-shot; re-weave uses `PUT` with current `updated_at`.
- Never re-weave more than the audited proposal set without human confirm (batch apply is ok if proposals were reviewed).
- Do not invent anchors that are not verbatim in the HTML.
- SSRF and auth rules still apply to Ghost URL.
- Sync inventory before large re-weave so candidates are fresh.
- Orphan detection: pages with zero in-links should be reported `[masterguide-distilled]`.

**Acceptance.**
1. After publish, ≥2 GHOST_CONFIRMED edges for standard intensity when inventory has ≥5 related posts (else document scarcity).
2. Delete/unpublish target in Ghost → nightly or audit marks BROKEN; Analytics link-graph truth updates.
3. On-demand audit returns proposals only; zero Ghost writes until apply.
4. Apply re-weave: ledger/activity records edit; static auto-rebuild if enabled; no duplicate POST create.
5. Concurrent re-weave on same post: optimistic lock failure → safe retry, no clobber.

**Common gaps.**
- Links only in local HTML never verified against Ghost.
- "Audit" that writes immediately.
- Re-POST publish on resume (breaks single-shot) disguised as re-weave.
- Hotlinking or rewriting public static files directly instead of Ghost → rebuild.

## 4. Six-stage article pipeline contracts

All stages: chat completions with **JSON-schema / Zod validation**; one retry with validation error appended; second failure → Job FAILED at that stage. Record `promptVersion`, `model`, tokens, ms per stage [handbook §21].

**Site context block (required every stage) [handbook §21]:**
`{ siteName, niche, audience, language, existingTitles[last 200], voice: { tone, pov, readingLevel, bannedPhrases[], brandFacts[] } }`.
Missing `voice.bannedPhrases` / `voice.brandFacts` / `voice.pov` / `voice.readingLevel` is a GAP — do not collapse `voice` to a single tone string.

**Sections setting:** default **5** sections/article; **pillars use 7–8** [handbook §12.2 Content defaults]. Topic-plan pillar jobs must pass `sections=7|8` (or site override); cluster jobs keep the site default unless overridden.

| # | Stage | UI label [screenshot-observed] | Tier · temp | Output | Guards |
|---|---|---|---|---|---|
| 1 | Intent & Blueprint | Intent & Blueprint | fast · ~0.4 | intent, audience, workingTitle ≤70, angle, mustCover[5–8], outline[N], faq[3–5], targetWords | outline length = sections setting; no dup H2; workingTitle lexical sim to existingTitles < 0.85 |
| 2 | Draft Generation | Draft | balanced · ~0.7 | intro/sections/conclusion/faq HTML | answer query in first 2 sentences; **no invented statistics** — use `[verify: …]`; HTML allowlist; no links/images yet |
| 3 | Quality & Coverage Revision | Revision | balanced · ~0.3 | html, coverage, intentMatch, notes, verifyFlags | every mustCover addressed; coverage ≥0.8 or one more pass |
| 4 | Metadata & Packaging | Metadata | fast · ~0.3 | title ≤60, metaDescription ≤155, slug, tags≤3, excerpt | slug unique (suffix `-2`…); tags map to existing names |
| 5 | Site Enrichment | Enrichment | fast + vision | 5a links; 5b image queries + placement | anchors verbatim once; urls from **published inventory only**; server inserts `<a>`; LinkEdge PLANNED→LOCAL; **images [handbook §31]** |
| 6 | Final Validation & Publication | Validation & Publish | no LLM | assemble → sanitize → 3-layer dup gate → Ghost POST → ledger → link confirm → activity → debounced static.build | **exactly one POST per article**; on timeout GET by slug reconcile — never re-POST |

**Checkpointing.** `Job.stage` advances only after durable persist of stage output. Resume continues at current stage.

**Publish ledger invariant.** Write `PublishLedger.dispatchedAt` **before** Admin API POST. If resumed and dispatched-but-unconfirmed → reconcile by slug [handbook §24].
[screenshot-observed SingleArticleExample] Ghost publish ledger shows CONFIRMED with dispatched/confirmed timestamps and copy: "Single-shot write invariant: a Ghost mutation is dispatched exactly once. Ambiguous outcomes are reconciled read-only."

**Fallback engine.** Optional deterministic `engine=fallback` only if operator enables; exclude from static builds by default [handbook §21].

**Stage-5 image acceptance [handbook §31]** (own-panel bar; label SaaS-observed hotlink if auditing Bloggent):
1. Stage emits concrete photo-like `query` + `alt` per featured/section slot (respect `sectionImagesMax`, often ≤2).
2. Fetch accepts only HTTP 200 + `image/*` + minimum size (≥8 KB and ≥600×300 when using Bing-thumb style providers).
3. **Vision check** before place/upload: `{ ok, reason, altText }` for suitability to the section; up to 2 alternate queries on failure.
4. **Own-panel:** upload bytes to Ghost `images/upload/`; store `ArticleImage` with `license` caveat (e.g. `unknown-bing`); do not silently hotlink as the only path.
5. UI/docs show copyright caveat; optional providers (`pexels`, `ai`) behind the same `ImageProvider` interface.
6. Failed image slots must not block publish unless site policy requires images; record attempts vs placed counts.
7. `[masterguide-distilled]` Bing CDN hotlink tricks are brittle (undocumented URL shapes; Bing Search API shutdown risk) and legally risky for commercial sites — prefer licensed/upload pipeline.

**Article detail KPIs [screenshot-observed].** Uniqueness · Coverage · Intent match · Words; tags; internal links with lifecycle badges (LOCAL / INSERTED / …); images with query/alt/HTTP; per-stage token table; revision notes; must-cover points; View in Ghost.

**Acceptance (pipeline).**
1. Kill worker at stage 3 → restart → stage 3/4 resumes, stages 1–2 not re-billed (or explicitly documented re-call with reason).
2. Ambiguous timeout on publish → one Ghost post, not two.
3. Stage 2 output containing fabricated "Study (2024) found 87%" without `[verify]` fails QA review checklist.
4. Stage 5 cannot link to unpublished/MISSING inventory URLs; image path meets §31 checks above.
5. Stage 6 refuse on dup gate leaves no Ghost post and no static deploy.
6. Pillar jobs use 7–8 sections; standard keyword jobs default to 5 unless overridden.
7. [captioned UI evidence] Failed jobs expose **Restart failed** (or equivalent) without creating a second Ghost post; regenerate-as-variant must set `allowVariants` semantics and a new angle — not silent re-POST of the same slug.

---

## 5. Duplicate protection (3 layers)

Gate at intake **and** again at stage 6 [handbook §22].

| Layer | Signal | Typical threshold | Action |
|---|---|---|---|
| 1 | Normalized keyword equality | exact | REFUSE (unless allowVariants policy says otherwise for soft collision — default refuse) |
| 2 | Lexical title/slug similarity (Jaro-Winkler or token-set) | > 0.85 | REFUSE |
| 3 | Semantic embedding (`keyword + workingTitle + intent` vs Articles ∪ inventory) | cosine > 0.88 | REFUSE; uniqueness = 1 − max similarity |

[captioned UI evidence] UI may show `DUPLICATE REFUSED (L4-paraphrase)` — treat as the semantic/paraphrase refuse path; align naming in own-panel (`SEMANTIC` / `PARAPHRASE`) and document mapping. Do not add a fourth mathematical layer unless code truly has one.

**Corpus state:** EMPTY → SYNCING → COMPLETE. Gate refuses runs while EMPTY on a site that already has Ghost inventory (must Sync inventory first).

**Allow intentional variants:** bypasses intake semantic/lexical gate; forces different angle in stage 1; **keeps** title/slug hard checks in stage 6.

**Embedding calibration** `[masterguide-distilled]` — critical operator skill:
- Thresholds are **properties of the embedding model**, not universal constants. Recalibrate when the model changes.
- Practitioner ranges (starting points only — calibrate on your corpus): near-duplicate often ~0.90–0.98; related-but-distinct link candidates often ~0.70–0.87. **Using ~0.80 as an auto-block threshold frequently false-positives related content.**
- Guard against **transitivity percolation** when clustering duplicates loosely (giant false "duplicate" components).
- After every successful publish, **register embedding + permalink + publish time** into the persistent index — this is the memory layer that prevents self-duplication loops.
- Recommended starting model in handbook stack: `text-embedding-3-small` (meter it).

**Acceptance.**
1. Unit tests for normalize + each layer with fixtures.
2. Sync inventory → corpus COMPLETE → uniqueness scores populate.
3. Variant mode produces distinct angle and non-colliding slug.
4. Calibration fixtures exist or are documented as operator runbook.

---

## 6. Data model / migration review checklist

Use this as a PR / release checklist. Adapt names if the schema differs, but **capabilities** must exist.

### 6.1 Required capabilities
- [ ] Tenant isolation: website-scoped FKs on Run, Job, Article, InventoryItem, LinkEdge, TopicPlan, StaticBuild, ActivityEvent.
- [ ] Encrypted secret columns for Ghost Admin/Content keys and deploy secrets (AES-256-GCM or equivalent); UI hint fields only.
- [ ] `UsageEvent` with RESERVED / SETTLED / RELEASED and indexes by `(aiKeyId, at)`.
- [ ] `Job.stage` + `stageLog` JSON; lock/heartbeat fields for recovery.
- [ ] `Article.embedding` + `InventoryItem.embedding` (pgvector) **or** documented alternative semantic backend.
- [ ] Unique `(websiteId, slug)` on Article; unique `(websiteId, ghostPostId)` on InventoryItem.
- [ ] `PublishLedger` with dispatched/confirmed semantics.
- [ ] `LinkEdge.state` enum covering full state machine.
- [ ] `TopicPlan` pillar/clusters JSON + status/error.
- [ ] `StaticBuild.includedIds` + `excluded` reasons; artifact sha256.
- [ ] `WorkerHeartbeat` table or equivalent.

### 6.2 Migration safety
- [ ] Expand/contract: add columns nullable first; backfill; then constrain.
- [ ] No destructive drops without backup + written rollback.
- [ ] `CREATE EXTENSION vector` (if used) in controlled migration; HNSW indexes concurrent when possible.
- [ ] Seed models/pricing table without secrets.
- [ ] Verify `prisma migrate deploy` (or equivalent) on empty DB and on copy of prod schema.

### 6.3 Anti-patterns
- Storing raw Admin API secrets in plain text logs.
- Embedding vectors in JSON blobs with no index when semantic dedupe is required at scale.
- Cascades that delete Ghost-ledger history unexpectedly.

---

## 7. Worker & queue reliability checklist

**Job types to verify present [handbook §24]:**  
`run.dispatch`, `article.generate`, `ghost.publish` (or inline stage 6), `inventory.sync`, `links.verify`, `links.audit`, `topicplan.generate`, `ideas.suggest`, `static.build`, `static.deploy`, `static.verify`, `backup.export`, heartbeat, `usage.rollover`.  
[assumption] `indexnow.submit` after successful deploy if IndexNow is enabled (§22).

### 7.1 Concurrency & retry
- [ ] `article.generate`: max **2 per website**; TTL ~20 min; limited retries with backoff.
- [ ] `static.build`: **1 per website**, debounce ~60 s after last publish.
- [ ] `inventory.sync`: 1 per site; manual + webhook + periodic.
- [ ] Topic plan pillar waits on clusters (`dependsOn` or barrier).

### 7.2 Heartbeat & recovery
- [ ] Heartbeat every ~15 s; UI offline if > ~45 s stale. [screenshot-observed] "Worker online" / "Last heartbeat just now".
- [ ] Boot recovery: stale `lockedBy` (> ~2 min) → requeue at current stage.
- [ ] Runs stuck RUNNING with zero active jobs → recompute status.
- [ ] Cancel: cooperative flag; RELEASE usage; no Ghost POST after cancel.
- [ ] [captioned UI evidence] **Restart failed** requeues from checkpoint; never double-dispatch publish.

### 7.3 Idempotency
- [ ] Publish idempotency key = article id; ledger before POST; reconcile by slug.
- [ ] Static deploy manifest diff (no full-tree delete without plan). [screenshot-observed Static Delivery] "Existing builds are never re-deployed; single-shot semantics apply."
- [ ] Webhook handlers idempotent on Ghost post id.

### 7.4 Poison messages
- [ ] After max attempts → FAILED with reason; dead-letter or admin-visible; do not infinite loop.
- [ ] Zod/schema failures do not crash the whole worker process.

---

## 8. Security checklist

### 8.1 Ghost URL SSRF [handbook §25, §30]
- [ ] https only; port 443; no userinfo in URL.
- [ ] Resolve DNS on each connect; reject private/link-local/metadata ranges (10/8, 172.16/12, 192.168/16, 127/8, 169.254/16, ::1, fc00::/7, etc.).
- [ ] ≤1 same-host redirect; re-validate resolved IPs after redirect.
- [ ] Connect/test is read-only (`GET admin/site/`).
- [ ] [screenshot-observed] UI copy: "Private addresses and unsafe redirects are blocked (SSRF protection)."

### 8.2 Secrets
- [ ] Master key only in env (`SECRETS_KEY`); backed up offline; not in repo.
- [ ] Decrypt only in worker (or server actions that never echo secrets).
- [ ] UI: masked hints only; **never re-show** full Admin key or FTP password after save. [screenshot-observed] "Encrypted at rest. Never displayed again after saving."
- [ ] Provider tests: FTPS connect + PWD + MLSD style checks; no destructive uploads in Test.

### 8.3 AuthZ / AuthN
- [ ] Session cookies httpOnly; SameSite=Lax (or stricter); CSRF on mutations.
- [ ] Every website-scoped query checks ownership (single OWNER ok for v1).
- [ ] Rate limits on auth and run submission.
- [ ] Webhook tokens for Ghost hooks; no reliance on unsigned trust without token.

### 8.4 Ghost JWT
- [ ] HS256; `kid`=id; short exp (~5 min); `aud:"/admin/"`; secret hex-decoded; raw secret never sent over the wire as Bearer password.

### 8.5 Content safety
- [ ] HTML sanitization allowlist before Ghost write and before static render.
- [ ] `[verify]` flags visible to operator; no silent invention of citations in QA policy.
- [ ] No fabricated author personas that violate Google spam policies `[masterguide-distilled]` — keep real bylines / Ghost authors.

## 9. AUDIT procedure (evidence-based)

Run in order. Produce the **Audit Report** template (§14). Mark `[assumption]` where code is missing and behavior is inferred.

### 9.1 Read first
1. Repo README, `.env.example`, docker-compose / Dokploy specs.
2. Prisma schema / migrations (or SQL DDL).
3. Pipeline package: stage runners, prompts (version ids), Zod schemas.
4. Worker job registration and concurrency config.
5. Ghost client: JWT, SSRF guard, publish + reconcile.
6. Dedupe + embeddings code paths + calibration notes.
7. Usage reservation helper.
8. Topic plan dispatcher (cluster/pillar order).
9. Link audit / re-weave apply path (PUT-only).
10. Static build included/excluded + deploy verify + Public URL gate.
11. (Optional) IndexNow / Bing webmaster integration hooks.

### 9.2 Measure
| Metric | How |
|---|---|
| Worker liveness | heartbeat age |
| Inventory freshness | `syncedAt` vs Ghost post count |
| Dup corpus state | EMPTY/SYNCING/COMPLETE |
| Run outcomes | counts by status last 7d incl. REFUSED / PARTIAL |
| Uniqueness distribution | Article.uniqueness histogram |
| Link states | counts by LinkState |
| Usage integrity | RESERVED older than 1h; settled vs provider |
| Publish anomalies | articles with publishAttempts>1 or duplicate slugs in Ghost |
| Static truth | last build included/excluded; verify status |
| Orphans | published posts with 0 in-links |

### 9.3 Golden-path dry run (draft mode)
On a **non-prod** or draft-configured brand: 1 keyword run → inspect six stages → confirm single Ghost **draft** → sync inventory → audit links (proposals only) → manual static build with Public URL → deploy to staging provider if any → record costs.

### 9.4 Explicitly out of audit scope unless asked
GhostArch billing, Cloudflare account takeover, Hostinger hPanel UI automation, reverse-engineering SaaS bytecode, Dokploy host metrics unless they block the worker.

---

## 10. REPAIR procedure (safe, incremental)

### 10.1 Principles
1. One gap cluster per PR / change set when possible.
2. Tests first for dedupe, normalize, slug, JWT claims shape, SSRF reject list, usage RESERVE/SETTLE/RELEASE.
3. Feature flags or site-level switches for live publish and auto-rebuild.
4. Never drop `PublishLedger` or `UsageEvent` history to "simplify."
5. Prefer forward fixes; if revert needed, document rollback commands.

### 10.2 Suggested repair order (dependencies)
1. Secrets + SSRF + authZ (security baseline).
2. Usage reservation / metering (stop financial bleed).
3. Normalization + 3-layer dedupe + inventory sync (stop duplicate content).
4. Stage checkpointing + publish ledger reconcile (stop double posts).
5. Topic plan cluster-then-pillar ordering.
6. Link verify + audit + controlled re-weave (PUT).
7. Static included/excluded + deploy verify + Public URL.
8. Niche ideas filtering + non-commodity/entity checklist + analytics polish.
9. Optional IndexNow after deploy.

### 10.3 Anti-patterns (forbidden "repairs")
- Rewriting the entire pipeline in a new language in one step.
- Re-POSTing all articles to Ghost to refresh links.
- Disabling dedupe "temporarily" in production.
- Storing Admin keys in plaintext "just for debugging."
- Pointing Ghost URL at `127.0.0.1` or cloud metadata IPs.
- Shipping Bing-CDN hotlinks as the only image strategy without license caveats.

### 10.4 Verification after each repair
Re-run the smallest acceptance tests from §3–§5 affected by the change; append to Gap Matrix status: open → in_progress → verified.

---

## 11. SAFE PRODUCTION RELEASE gate (go/no-go)

**GO** only if all must-pass items are checked for the target brand(s).

### 11.1 Must-pass
**Golden-path prerequisites [handbook §13]** — all must be true for the target brand before any live/auto traffic:
- [ ] Ghost **CONNECTED** (recent successful Admin test; failed connect within last hour → NO-GO).
- [ ] Deploy provider **VERIFIED** (FTPS/cPanel or chosen provider test green).
- [ ] **Public URL** saved for indexable static builds (refuse builds that need indexing without it). [screenshot-observed] placeholder domains rejected.
- [ ] **Default author** / byline set (Ghost user mapped; no orphan posts).
- [ ] **Worker online** (heartbeat fresh; UI "Worker online" equivalent).
- [ ] Publish mode chosen for the smoke (prefer **draft** first) and frozen per run.
- [ ] Default/demo Ghost posts deleted; inventory synced (corpus not EMPTY when inventory exists). [screenshot-observed inventory still listed "Coming soon" on one capture — treat leftover demo posts as a release blocker].

**Feature / safety must-pass**
- [ ] Security checklist §8 signed off (SSRF, secrets, CSRF, JWT).
- [ ] Metering: allowance enforced; no leaked keys; rollover tested.
- [ ] Dedupe 3 layers + corpus COMPLETE after sync.
- [ ] Draft-mode golden path succeeded end-to-end.
- [ ] Live-mode tested on **one** disposable keyword with Auto-rebuild watched.
- [ ] Single-shot publish proven (chaos: kill worker during stage 6 once).
- [ ] Topic plan: clusters finish before pillar starts; pillar links ≥2 confirmed when possible.
- [ ] Link audit read-only; re-weave apply uses PUT + optimistic lock.
- [ ] Static build refuses 0-article deploy unless forced+acknowledged; included/excluded recorded. [screenshot-observed] FAILED build with 0 pages / no artifact.
- [ ] Coexistence: no second deployer on same `public_html`.
- [ ] Backups: DB snapshot / export taken before enable.
- [ ] Rollback plan written (disable auto-rebuild, set publishMode draft, redeploy last artifact).

### 11.2 Soft / follow-ups (may ship with ticket)
- Extra deploy providers beyond the one VERIFIED path.
- Dense link intensity / fancy analytics graphs.
- Image provider alternatives (Pexels/AI) if Bing-thumb path works and license caveats shown.
- IndexNow automation.
- Research / Calendar nav items if desired for own-panel UX.

### 11.3 No-go triggers
Any double Ghost create in tests; SSRF miss; plaintext secrets in logs; corpus EMPTY while inventory non-empty; worker without recovery; static deploy without Public URL; inability to cancel runs; auto-rebuild ON while provider NOT CONNECTED producing silent failure loops.

---

## 12. Operator runbook snippets

Keep technical labels in English. Bangla narration optional for Mahin.

### 12.1 Create keywords
1. Prerequisites: Worker online · Ghost CONNECTED · AI key enabled · corpus not EMPTY if inventory exists · Publish as chosen (draft recommended first).
2. Create → Keywords → paste ≤100 lines → review normalization preview → set Allow intentional variants only if deliberate → Submit.
3. Runs → open run → confirm refused rows have reasons → wait COMPLETED/PARTIAL.
4. Articles → open one → check stages, `[verify]` flags, ledger CONFIRMED, uniqueness.
5. If draft: review in Ghost → Publish → ensure webhook or manual sync → static rebuild.

### 12.2 Topic plan
1. Create → Topic plan → enter topic → generate → review pillar + clusters → exclude weak ones → Queue.
2. Topic Plans → detail shows per-cluster status; pillar remains waiting until clusters complete (own-panel contract).
3. On COMPLETED: verify pillar article links to clusters; Analytics link-graph truth moves toward GHOST_CONFIRMED.

### 12.3 Runs
- Cancel cooperative; confirm RESERVED tokens RELEASED.
- CSV export for cost review.
- PARTIAL: triage failed jobs by `refusalReason` / stageLog; do not re-queue whole run blindly.
- Restart failed: one job at a time; confirm no second Ghost id.
- Regenerate as variant: only with intentional-variant semantics.

### 12.4 Sync inventory
1. Connections → Sync inventory (manual; also webhook/hourly if configured).
2. Expect PUBLISHED rows; MISSING marks removed posts.
3. Confirm dup corpus SYNCING→COMPLETE; embeddings refreshed for new titles.

### 12.5 Audit links
1. Connections → Audit internal links (≤5 posts read-only) → review insert/rewrite/remove proposals.
2. Apply selected proposals only → verify LinkEdge updates → optional static rebuild.
3. Nightly audit: check BROKEN count weekly.

### 12.6 Static delivery
1. Set Public URL (https, real origin).
2. Choose template; set menus/robots/analytics snippets carefully (no `NOINDEX`/`NOCACHE` mistakes that kill answer-engine visibility `[masterguide-distilled]`).
3. Manual **Build static site** first; inspect included/excluded.
4. Deploy via VERIFIED provider; confirm preflight + live probe.
5. Only then enable **Auto-rebuild on publish** (debounced).

### 12.7 Troubleshooting pointers
| Symptom | Likely cause → action |
|---|---|
| Ghost connect 401/403 | Content API key used instead of Admin key |
| Ghost TLS error | cert not ready; `GET /ghost/api/admin/site/` must succeed |
| Topic plan "No usable AI key" | key disabled/cooling; model/provider mismatch |
| Build `PUBLIC_URL_REQUIRED…` | set Public URL in static customization |
| Published but public site stale | Auto-rebuild off / Cloudflare cache / wrong deployer |
| "Coming soon" on public site | default Ghost post not deleted → delete, sync, rebuild |
| Run COMPLETED but 0 pages static | build failed / excluded all posts → open build details |
| DUPLICATE REFUSED flood | corpus stale or threshold miscalibrated → sync + calibrate |

---

## 13. Failure modes & troubleshooting table

| Failure mode | Detection | Immediate mitigation | Durable fix |
|---|---|---|---|
| Double Ghost post same slug | Two Admin IDs or publishAttempts>1 | Unpublish duplicate; stop worker | Ledger-before-POST + reconcile-by-slug |
| Allowance bypass | Settled >> allowance | Disable keys; pause runs | Enforce withAllowance server-side |
| Semantic dup flood | Low uniqueness cluster | Stop runs; sync corpus | Fix embeddings gate; block EMPTY corpus |
| Pillar before clusters | Timestamps / missing links | Regenerate pillar after clusters | dependsOn barrier |
| Link BROKEN spike | Analytics | Remove/repair edges | Nightly audit + re-weave proposals |
| Worker silent death | Heartbeat >45s | Restart worker; freeze live publish | Process supervisor; recovery on boot |
| SSRF open resolver | Test with private IP URL | Block connects | Fix DNS re-resolve + deny list |
| Static 0-article deploy | Empty public site | Rollback artifact | Refuse 0-article builds |
| FTPS credential leak in logs | Log scan | Rotate FTP password | Redact; never log PASS |
| Stage Zod loop | Job attempts exhausted | Mark FAILED | Fix schema/promptVersion; poison handling |
| Optimistic lock thrash on re-weave | Repeated 409-like failures | Serialize applies per post | Queue per ghostPostId |
| Webhook storm rebuilds | Many static builds | Debounce 60s; temporarily disable webhook | Already-debounced builder |
| Commodity content flood | Analytics quality / manual review | Pause ideas → apply non-commodity filter | Niche checklist in Create |

## 14. Output templates the agent must return

When operating under this skill, return these artifacts (Markdown). Do not omit status fields.

### 14.1 Audit Report
```markdown
# Audit Report — Ghost AI Writer V2
- Date (Asia/Dhaka):
- Scope (brands/repos/commit):
- Auditor role: Governor skill

## Executive summary
(3–6 sentences: ship / repair / no-go)

## Evidence map
| Area | Path / table / job | Result | Notes |
|---|---|---|---|
| Niche Intelligence | | PASS/FAIL/GAP | |
| Keyword normalization | | | |
| Metering | | | |
| Pillar Supporting | | | |
| Link re-weave | | | |
| Six-stage pipeline | | | |
| Dedupe 3-layer | | | |
| Security SSRF/secrets | | | |
| Worker recovery | | | |
| Static delivery | | | |
| IndexNow / Bing hooks | | optional | |

## Measurements
(paste real counts only)

## Assumptions
- [assumption] …

## Risks
High / Med / Low with blast radius
```

### 14.2 Gap Matrix
```markdown
| ID | Contract ref | Gap | Severity | Blast radius | Fix owner | Status |
|---|---|---|---|---|---|---|
| G001 | §3.3 Metering | … | High | cost overrun | | open |
```

### 14.3 Repair Plan
```markdown
# Repair Plan
## Order of changes
1. …
## Per change
- Goal / files / test plan / rollback / verify commands
## Explicit non-goals this round
```

### 14.4 Release Decision
```markdown
# Release Decision
- Decision: GO | GO_WITH_FLAGS | NO_GO
- Brands enabled:
- Flags (live publish / auto-rebuild):
- Must-pass checklist: attached §11
- Rollback:
- Monitoring (first 24–48h): heartbeats, usage, link BROKEN, publishAttempts, build verify
```

### 14.5 Measurement appendix (copy into Audit Report when measured)

Use only numbers obtained in the current audit. If a query cannot run, write `N/A — [assumption]` rather than inventing figures.

| Query intent | Example measurement | Fill-in |
|---|---|---|
| Heartbeat age | seconds since last WorkerHeartbeat | |
| Inventory vs Ghost | panel inventory count vs Admin API published count | |
| Corpus state | EMPTY / SYNCING / COMPLETE | |
| Runs (7d) | QUEUED/RUNNING/COMPLETED/FAILED/PARTIAL/CANCELLED | |
| Refused keywords | count + top refusalReason codes | |
| Uniqueness | min / p50 / p90 Article.uniqueness | |
| Link states | counts per LinkState | |
| Usage | SETTLED tokens today (UTC); orphan RESERVED >1h | |
| Publish safety | articles with publishAttempts > 1; duplicate Ghost slugs | |
| Static | last build included/excluded counts; verify status | |
| Cost | micro-USD per completed article (median) | |

**Chaos checks (staging only):** (1) SIGKILL worker during stage 3; (2) SIGKILL during stage 6 after ledger dispatch; (3) submit duplicate normalized keyword concurrently from two clients; (4) connect Ghost URL to a private IP (must fail SSRF); (5) set daily allowance below one article estimate and confirm refuse.

**Pass interpretation:** chaos (2) must yield exactly one Ghost post; chaos (4) must never initiate TCP to private space; chaos (5) must not call the LLM provider.

### 14.6 Gap severity rubric

| Severity | Definition | Release impact |
|---|---|---|
| Critical | Data loss, secret leak, SSRF open, double Ghost create | Automatic NO_GO |
| High | Metering bypass, dedupe disabled with non-empty inventory, pillar ordering wrong, re-weave uses POST create | NO_GO until fixed |
| Medium | Analytics wrong, soft UX bugs, secondary provider missing | GO_WITH_FLAGS possible |
| Low | Copy/polish, optional providers, non-default intensity | Ship with ticket |

When filing the Gap Matrix, map each gap to a contract section (§3–§8) and name the smallest verifying test that would flip Status to `verified`.

---

## 15. Working style rules for the implementing agent

1. Evidence > assertion. Quote file paths, schema fields, and log lines.
2. Label `[assumption]` vs `[handbook]` vs `[screenshot-observed]` vs `[masterguide-distilled]` vs `[public]` vs measured-in-this-audit.
3. Prefer smallest safe diff; no heroic rewrites.
4. Never output secrets or pseudo-secrets that look real.
5. English technical vocabulary; Bangla ok for operator narration.
6. Do not claim Bloggent source was reverse-engineered.
7. Ghost remains CMS source of truth; panel ledger reconciles to Ghost.
8. Single-shot publish is sacred for creates; re-weave is PUT-only.
9. Clusters first, pillar last — verify with timestamps.
10. If asked for both a speculative exploit against Ghost and a fix, provide hardening/fix only — no attack recipes.
11. Do not paste the Bangla masterguide; distill actionable checklists only.
12. Do not invent "we measured X%" SEO claims.

---

## 16. Quick reference — public & handbook anchors

- Public meta: six-stage pipeline · internal link graph · relevant images · single-shot Ghost publishing · static delivery.
- Handbook Part I–II: private Ghost + static Hostinger + Cloudflare; Bloggent V1.1 operator map (§12).
- Handbook Part III: own-panel spec §§16–35 (features, schema, pipeline, dedupe, worker, security, Ghost API, images, cutover).
- GhostArch guide: hosting-only context — not the writer.
- Masterguide (Bangla): non-commodity · entity hierarchy · keyword-as-hub · topic→cluster · embedding duplicate detection · internal linking · static rationale · zero-duplication URLs · IndexNow/Bing · answer engines — distilled in §3.1, §5, §21–§23.
- Operator timezone default: Asia/Dhaka; usage day boundary UTC for allowances unless code documents otherwise.
- Companion: `GHOST-AI-WRITER-V2-WORKFLOW-MAP.md`.

### 16.1 Bloggent V1.1 UI map — SaaS-observed only
See §2.5 and the Workflow Map doc. Own-panel should use its own route names; do not require SaaS labels in code.

---

## 17. End-state definition of done (Governor)

You are done with an engagement when:

1. Audit Report, Gap Matrix, Repair Plan, and Release Decision exist and agree with each other.
2. All **High** severity gaps are verified fixed or explicitly accepted in writing by the operator.
3. Release Decision is GO or GO_WITH_FLAGS with monitoring notes — or honest NO_GO.
4. No plaintext secrets were introduced into the repo or chat.
5. The five named features (§3) have mapped acceptance tests with PASS or scheduled fix IDs.
6. Product surface (§2.5) and static/auto-delivery (§21) were considered in the audit even if marked N/A.

**Remember:** AUDIT → REPAIR → SAFE PRODUCTION RELEASE. Do not assume the previous implementation is correct. Do not blindly rebuild.

## 18. Create flows — Keywords vs Topic Plan (deep dive)

### 18.1 Shared chrome [screenshot-observed]
- Page title: **Create content**
- Subcopy: Submit up to 100 keywords for a bulk run, let AI suggest ideas, or plan a pillar + cluster from one topic.
- Tabs: **Keywords** | **Topic plan**
- Website switcher + Worker online must be visible; refuse soft-submit messaging if worker offline `[assumption]` — verify UX.

### 18.2 Keywords tab — field contract
| Control | Contract |
|---|---|
| Keywords textarea | One per line; max 100; Clear; Add sample keywords |
| Publish as | Site default / live / draft; effective mode shown; **frozen on submit** |
| AI model | Account default or override; BYOK note; frozen on run |
| Allow intentional variants | Exact matches → variants with new angle; title/slug/lexical still enforced at publish |
| AI keyword ideas | Niche → suggestions filtered vs corpus/pending/inventory; billed to allowance |
| Normalized preview | Client preview; **server is source of truth** |
| What happens next | Explainer only: 2/website concurrency; six stages; 3-layer dup; images via photo-editor prompt + fetch + vision; Ghost live/draft; join link graph |

### 18.3 Topic plan tab — field contract
| Control | Contract |
|---|---|
| Topic input | One topic string |
| Guidance | Prefer mid-breadth topics; avoid single-word topics |
| Generate topic plan | Creates TopicPlan QUEUED → worker fills pillar + 6–10 clusters |
| Review / exclude / queue | Operator gate before Jobs |

### 18.4 Acceptance extras
1. Switching tabs does not lose unsaved keywords without confirm `[assumption]` — verify UX.
2. Ideas panel cannot enqueue without explicit add-to-keywords / submit.
3. Topic plan generate without usable key → FAILED with visible error, not empty READY.

---

## 19. Run detail ledger — six stages, statuses, regenerate

### 19.1 Run list [screenshot-observed]
- Header: "Content generation runs — durable jobs that survive restarts."
- Row: title, type (Topic plan / Keywords), job count, relative created time, status badge, cost chip.

### 19.2 Run detail header [screenshot-observed]
- Title line with publish mode note ("publishing live in Ghost (default setting)").
- Counters: completed · inflight · failed · refused · cancelled · progress %.
- Metering chips: `$…` · `N tokens` · `N settled calls`.

### 19.3 Per-job accordion
Each job shows status (`COMPLETED`, `FAILED`, `REFUSED`, …) and Ghost publish badge when applicable.
Six stage cards with **duration + token** pairs; stage 6 tokens = 0.
[captioned UI evidence] `DUPLICATE REFUSED (L4-paraphrase)` on refused jobs; **Restart failed** action; regenerate-as-variant path.

### 19.4 Run terminal states
| Status | Meaning |
|---|---|
| COMPLETED | All non-refused jobs finished successfully |
| PARTIAL | Mix of success and failed/refused — triage required |
| FAILED | Run-level failure (dispatch/key) |
| CANCELLED | Cooperative cancel; usage RELEASED |
| RUNNING / QUEUED | In progress |

### 19.5 Acceptance
1. Refused jobs do not count as completed successes in % if that would hide dup floods — document formula.
2. CSV export includes per-job refusalReason and stage token sums.
3. Restart failed resumes `Job.stage`; publish ledger prevents second POST.

---

## 20. Connections — Ghost live, Sync, Audit (deep dive)

### 20.1 Connect Ghost
- Modes: **Live Ghost** vs **Ghost Sandbox** (managed Ghost-compatible env) `[screenshot-observed]`.
- Live: Ghost URL + Admin API key (`id:secret`); Connect & verify live Ghost; read-only test.
- SSRF protection copy must match server enforcement (§8.1).
- Success banner names Ghost version when available.

### 20.2 Sync inventory
- Manual sync primary; webhook + periodic optional [handbook].
- Inventory table: title, ghost id hint, syncedAt, PUBLISHED/MISSING.
- Sync refreshes embeddings for dedupe corpus.

### 20.3 Audit internal links
- Read-only scan capped (≤5 posts in observed UI).
- Proposal classes: would insert / rewrite / remove; healthy; broken permalink; missing links; Ghost 404; identity mismatch; human-review.
- Apply is a separate explicit step → PUT re-weave (§3.5).

### 20.4 Deployment providers
- Configure / Test / Edit / Disconnect.
- Deployable only when test returns **VERIFIED**.
- Observed providers: Cloudflare Pages (Direct Upload), GitHub Pages (Git Data API), Vercel (Deployments API), cPanel hosting (explicit-TLS FTPS).

---

## 21. Static Delivery + AutoDelivery

### 21.1 Intent
Freeze Ghost (or panel Article) content into deterministic static HTML; deploy snapshot to VERIFIED host; verify live origin. Rebuilds create **new** snapshots — never mutate an already-deployed artifact in place `[screenshot-observed]`.

### 21.2 Why static (masterguide distilled)
- Separate authoring CMS from public bytes; improve crawl efficiency vs heavy dynamic stacks.
- Predictable file counts when pagination/tag/author archives are minimized.
- Not a magic ranking factor by itself — do not claim "static = SEO win" without measurement.

### 21.3 Zero-duplication URL rules `[masterguide-distilled]` (static builder checklist)
Apply as **own-panel template policy** where compatible with Ghost URL scheme:
1. Avoid needless pagination duplicates; prefer bounded category pages or related-post navigation.
2. Avoid tag/author/date archive explosions if they duplicate the same bodies.
3. Prefer shallow public URLs (≤2 path levels) when designing own templates — if preserving Bloggent `/post/<slug>/`, document the exception.
4. Keep sitemap + robots coherent; Public URL drives canonical/sitemap/RSS.
5. Equalize internal link equity intentionally; detect orphans.
6. Keep CSS/JS budget lean for CWV floors (observed template `minimal-authority` markets this).

### 21.4 UI contracts [screenshot-observed Static Delivery / AutoDelivery]
- Auto-rebuild on publish toggle (OFF/ON); when ON, worker queues rebuild after publish and deploys via verified provider if configured.
- Build cards: id, AUTO badge optional, SUCCEEDED/FAILED, pages, KB, ms, timestamps.
- Actions: Download ZIP, target dropdown, Deploy, Preview iframe.
- Deploy rows: preflight readiness + live probe (origin Public URL); VERIFIED DEPLOYED.
- FAILED builds: 0 pages, no artifact, technical details expandable.
- Site customization: template catalogue with semver + capabilities (e.g. classic-editorial, affiliate-review, minimal-authority); Site name; Logo/Favicon; **Public URL required**; Robots policy; Footer text; header/footer menus; Head HTML; Body-end code; Analytics snippet.
- Copy: configuration-driven output — custom scripts run only in customer static site, never in control plane.

### 21.5 Acceptance
1. Indexable build without Public URL → refused.
2. 0-article build → FAILED / no deploy unless forced with acknowledgement.
3. `includedIds` + `excluded[{id,reason}]` persisted.
4. Auto-rebuild debounced (~60 s); existing deploy artifacts not overwritten in place.
5. Live probe must hit Public URL, not `cms.` host.

---

## 22. IndexNow, Bing, and answer engines (optional but recommended)

`[masterguide-distilled]` — own-panel hooks; not all were visible in Bloggent screenshots.

### 22.1 Discovery priority (Bing-oriented)
1. IndexNow URL submission (batch after deploy).
2. XML sitemap.
3. Crawlable internal links (already a core feature).
4. Manual Bing URL submission as fallback (quota-limited).

### 22.2 Implementation checklist
- [ ] Generate IndexNow key file at site root on static build.
- [ ] After successful `static.verify`, POST changed URLs (chunked) to IndexNow endpoint.
- [ ] Log response codes; do not claim Google uses IndexNow (it does not).
- [ ] Avoid meta that cripples Copilot-like use (`NOCACHE`-style directives) unless intentional.
- [ ] Monitor Bing Webmaster AI Performance reports if the operator uses Bing — do not invent citation percentages.

### 22.3 Answer-engine content checklist (ties to niche intelligence)
- Direct answer in opening sentences (pipeline stage 2 already requires answering in first 2 sentences).
- Question-style H2s where natural.
- Verified facts with sources / `[verify]` flags.
- Stable permalinks; strong internal links for discovery and grounding eligibility (Bing guideline language).

---

## 23. Niche intelligence operator checklists (printable)

Use during AUDIT of Create → Ideas and Topic Plan quality — Bangla coaching OK; keep labels English.

### 23.1 Non-commodity gate
- [ ] Topic requires experience, data, local knowledge, or original synthesis AI cannot uniquely invent?
- [ ] If commodity, is there a forced unique angle documented on the Job?
- [ ] Brand facts / banned phrases present in voice profile?

### 23.2 Entity / fact gate
- [ ] Named entities identified (org/person/place/work)?
- [ ] Factual claims carry verify flags or citations?
- [ ] No fake author persona?

### 23.3 Cluster hygiene
- [ ] Clusters narrowly scoped; titles not near-duplicates (>0.88)?
- [ ] Pillar waits for clusters?
- [ ] Internal links planned both cluster→pillar and pillar→cluster?

### 23.4 Embedding memory
- [ ] Inventory synced before bulk runs?
- [ ] Post-publish embedding registration confirmed?
- [ ] Thresholds calibrated for current embedding model?

### 23.5 Distribution
- [ ] Public static URL live?
- [ ] Sitemap present?
- [ ] IndexNow or Bing sitemap submitted (if using Bing strategy)?
- [ ] Orphan pages reviewed this month?

---

## 24. Analytics contracts (observability)

[screenshot-observed Analytics] Last 14/7/30 days toggles; KPIs: tokens settled, articles produced, verified link edges, pipeline stage success; charts for token trend and article output; stage performance table (success rate + avg duration + tokens); content quality averages (uniqueness, intent match, coverage, images/article); engine reliability (LLM vs fallback).

**Governor rule:** Analytics numbers in screenshots are historical for that workspace — **never copy them into a new audit as if measured now**.

---

## 25. Content & Website settings contracts

### 25.1 Content [screenshot-observed]
- Account defaults: default model (with $/1M pricing), Publish as, tone, sections slider, section images max.
- Read-only server contracts displayed: keyword limit 100/run, duplicate thresholds, link rules.
- Per-site overrides win: sections, images, tone, publish as, link intensity (light/standard/dense), image provider, voice profile.

### 25.2 Website [screenshot-observed]
- Workspace name, id, Ghost mode (Live Ghost), static site name, createdAt.
- Links out to Static Delivery customization, Connections credentials, Authors & bylines, Backup & recovery, Content defaults.

### 25.3 Account
- Profile, password change (signs out other sessions), active sessions list, revoke — security-relevant but not pipeline core.

---

## 26. Spine reminder (always)

```
AUDIT  →  REPAIR  →  SAFE PRODUCTION RELEASE
```

Every engagement ends with the four artifacts in §14. If blocked, return honest NO_GO with evidence — never a fake green light.

---

## 27. Crosswalk — screenshot filenames → skill sections

| Filename | Primary sections |
|---|---|
| Homepage.png | §2.5, §11, §24 |
| Create.png / Create-TopicPlan.png | §3.1–3.2, §18 |
| TopicPlan.png / TopicPlanDetails.png | §3.4 |
| Run.png / Run-Details.png | §4, §19, §3.3 |
| Articles.png / SingleArticleExample.png | §4, §3.5 |
| Analytics.png | §24 |
| Connections.png / Connections-AuditInternalLinks.png | §20, §3.5, §8 |
| Static Delivery.png / AutoDelivery.png | §21 |
| API Keys and Usage.png | §3.3 |
| Content.png / Website.png / Account.png | §25 |
| monitoring.png | Infra only (Dokploy) — out of writer scope |

---

## 28. Bangla operator note (brief)

মাহিনের জন্য: এই স্কিল ইংরেজি টেকনিক্যাল চুক্তি রাখে। অপারেটর ব্যাখ্যা বাংলায় হতে পারে — কিন্তু UI label, stage নাম, job type, আর status code সবসময় English। Masterguide থেকে শুধু **অ্যাকশন চেকলিস্ট** টেনে আনা হয়েছে; পুরো বাংলা গাইড এখানে পেস্ট করা হয়নি। AUDIT → REPAIR → SAFE RELEASE মেনে চলো; অনুমান হলে `[assumption]` লিখো।
