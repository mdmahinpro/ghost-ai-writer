# Ghost AI Writer V2 — UI / Workflow Map

**Purpose:** Paste-ready companion to `GHOST-AI-WRITER-V2-GOVERNOR.md`. Maps **customer-observable** Ghost AI Writer (Bloggent) V1.1 screens to operator workflows and own-panel parity contracts.

**Evidence tags:** `[screenshot-observed]` · `[captioned UI evidence]` · `[handbook]` · `[assumption]`

**Source folder:** `/workspace/ghost-workflow-screenshots/Ghost.Bloggent/` (Sep 20–22 2026 captures). OCR used on key screens; filenames + captions fill gaps. **No secrets** from screenshots are reproduced here.

**Legal:** Independent implementation only — do not copy proprietary CSS, marketing copy, or source. Use this map as a **behavior checklist**, not a pixel-perfect redesign brief.

---

## 1. Global chrome (every screen)

[screenshot-observed]

| Element | Behavior |
|---|---|
| Product title | Ghost AI Writer · "content automation" · V1.1 badge |
| Sidebar groups | CONTENT · WEBSITE · SETTINGS · ACCOUNT |
| Top bar | Search · website switcher · **Worker online** · theme/avatar |
| Footer motto | `six-stage pipeline · single-shot Ghost writes · static delivery` |
| Website context | Active workspace name (e.g. Go PhD) scopes all content |

### 1.1 Sidebar inventory (observed)

| Group | Nav item | Typical route intent |
|---|---|---|
| CONTENT | Overview | Dashboard / golden path |
| CONTENT | Create | Keywords + Topic plan intake |
| CONTENT | Topic Plans | Plan list + detail |
| CONTENT | Runs | Run list + detail ledger |
| CONTENT | Articles | Inventory + article detail |
| CONTENT | Analytics | Usage / quality / stages |
| WEBSITE | Connections | Ghost + inventory + audit + deploy providers |
| WEBSITE | Static Delivery | Builds, auto-rebuild, templates, Public URL |
| SETTINGS | AI Keys & Usage | Keys, allowances, usage events |
| SETTINGS | Content | Account + site content defaults |
| SETTINGS | Website | Workspace identity, authors, backup links |
| ACCOUNT | Account | Profile / sessions |
| ACCOUNT | Billing & Plan | Plan management |
| ACCOUNT | Sandbox Inbox | Sandbox messaging `[assumption]` low priority for own-panel |

### 1.2 Not observed in screenshots
`Research` and `Calendar` nav items — treat as `[assumption]` own-panel extras; do not fail SaaS parity for absence.

### 1.3 Not the writer UI
`monitoring.png` — Dokploy/host CPU·mem·disk dashboard. Out of writer workflow scope.

---

## 2. Golden path (Overview → live static)

[screenshot-observed Homepage]

**Overview KPIs:** articles published · jobs queued · active runs · link graph · tokens today · images tracked · system health (worker, jobs active, completed/failed, heartbeat, per-key tokens, UTC reset) · last static build card · recent runs · recent articles.

**Golden path checklist (progress steps observed):**
1. Account created
2. Email verified
3. Admin approved
4. Website workspace created
5. AI model selected
6. Daily allowance configured
7. Ghost connected
8. Content submitted (run/plan)
9. Article published to Ghost
10. Relevant images added
11. Internal link graph built
12. Static site built
13. Static site deployed

**Operator sequence (handbook-aligned):**
Connect Ghost → Sync inventory → (draft) Create Keywords or Topic Plan → watch Runs → review Articles → set Public URL → Build → Deploy → enable Auto-rebuild → optionally Audit links.

---

## 3. Create — Keywords tab

**File:** `Create.png`

| UI block | Contract |
|---|---|
| Tab Keywords | One keyword per line, ≤100 |
| Sample keywords | UX only |
| Publish as | Site default / live / draft; effective mode shown; frozen on submit |
| AI model | Account default or override; BYOK note |
| Allow intentional variants | Exact matches become variants with new angle; title/slug/lexical still apply at publish |
| AI keyword ideas | Niche → filtered suggestions; billed to allowance; filters vs articles/pending/inventory |
| Normalized preview | Preview only; **server is source of truth** |
| What happens next | 2/website concurrency; six stages; 3-layer dup; images (photo-editor prompt → fetch → vision); Ghost live/draft; join link graph |

---

## 4. Create — Topic plan tab

**Files:** `Create-TopicPlan.png`, `TopicPlan.png`, `TopicPlanDetails.png`

| Step | UI | Contract |
|---|---|---|
| 1 | Enter one topic | Mid-breadth topics preferred; avoid single-word topics |
| 2 | Generate topic plan | Worker proposes pillar + 6–10 narrowly scoped clusters |
| 3 | Review / exclude | Operator gate |
| 4 | Queue | Creates run; clusters should generate before pillar `[handbook]` own-panel improvement |
| 5 | Topic Plan detail | PILLAR PAGE card · Cluster topics (N eligible) · per-cluster status · "N topics already dispatched" |

**Example observed:** topic "Understanding PhD Programmes" / "PhD Programme" with 9 cluster topics COMPLETED and dispatched count shown.

---

## 5. Runs — list and detail ledger

**Files:** `Run.png`, `Run-Details.png`

### 5.1 List
- Copy: "Content generation runs — durable jobs that survive restarts."
- Row fields: title, type (Topic plan / Keywords), job count, created relative time, status, cost.

### 5.2 Detail header
Counters: completed · inflight · failed · refused · cancelled · progress %.
Metering: `$` · tokens · settled calls.
Publish mode note on the run (e.g. publishing live in Ghost).

### 5.3 Six stage cards (per job)
Order `[screenshot-observed]` + `[captioned UI evidence]`:

1. **Intent & Blueprint**
2. **Draft**
3. **Revision**
4. **Metadata**
5. **Enrichment**
6. **Validation & Publish** (0 LLM tokens)

Each card: duration + token count. Job status badges include COMPLETED / Published.
[captioned UI evidence] Also: `DUPLICATE REFUSED (L4-paraphrase)`, **Restart failed**, regenerate-as-variant.

### 5.4 Illustrative stage envelopes (one observed run — re-measure)
Do **not** treat as SLAs:

| Stage | Approx duration | Approx tokens |
|---|---|---|
| Intent & Blueprint | ~22–25 s | ~730–790 |
| Draft | ~6–11 s | ~2.1–2.4k |
| Revision | ~5–8 s | ~2.3–2.8k |
| Metadata | ~0.9–1.2 s | ~450–490 |
| Enrichment | ~0.4–0.7 s | ~1.4–1.5k |
| Validation & Publish | ~0.5–0.9 s | **0** |

Example run totals observed: `$0.36` · `139,695` tokens · `86` settled calls for a 9-job topic plan — **illustrative only**.

### 5.5 Terminal run states
COMPLETED · PARTIAL · FAILED · CANCELLED · RUNNING/QUEUED — PARTIAL requires per-job triage.

---

## 6. Articles — inventory and single article

**Files:** `Articles.png`, `SingleArticleExample.png`

### 6.1 Inventory table
Columns/concepts: thumb · title · slug · engine (llm/fallback) · status · links in/out · images · uniqueness · published. Filters/search/CSV `[handbook]`.

### 6.2 Article detail
| Block | Observed fields |
|---|---|
| KPIs | Uniqueness · Coverage · Intent match · Words |
| Ghost publish ledger | CONFIRMED · dispatchedAt · confirmedAt · post id · single-shot invariant copy |
| Internal links | Lifecycle badges (LOCAL / INSERTED / …) · targets |
| Images | Featured + section · query · alt · HTTP 200 · SELECTED |
| Stage token table | Stages 1–6 tokens; stage 6 = 0 |
| Revision notes | Human-readable revision summary |
| Must-cover | Checklist points from blueprint |
| Content | Rendered HTML · Copy HTML/Markdown · tags · View in Ghost |

---

## 7. Analytics

**File:** `Analytics.png`

- Range toggles: 7 / 14 / 30 days
- KPI tiles: tokens settled · articles produced · verified link edges · pipeline stage success
- Charts: token usage trend · article output
- Stage performance: success rate + avg duration + tokens per stage
- Content quality averages: uniqueness, intent match, coverage, images/article
- Engine reliability: LLM vs fallback

**Rule:** Screenshot numbers are historical for that workspace — never paste them into a fresh audit as live measurements.

---

## 8. Connections

**Files:** `Connections.png`, `Connections-AuditInternalLinks.png`

### 8.1 Ghost connection
- Banner: credentials AES-256-GCM; tests read-only
- Status: CONNECTED | LIVE · Ghost version banner (e.g. 5.130)
- Modes: Live Ghost vs Ghost Sandbox
- Fields: Ghost URL · Admin API key (`id:secret`) — never re-shown after save
- Actions: Connect & verify · Test (read-only) · Sync inventory
- SSRF copy: private addresses and unsafe redirects blocked

### 8.2 Internal-link audit
- Cap: read-only, ≤5 posts (observed)
- Counters: scanned/healthy · broken permalink · missing links · missing on connected site · Ghost 404 · irrelevant/app links · identity mismatch · would rewrite / insert / remove · human-review / unresolved
- Apply proposals is a **separate** step (PUT re-weave — never re-POST create)

### 8.3 Ghost inventory
Title · id hint · syncedAt · PUBLISHED/MISSING. Demo "Coming soon" posts must be deleted before release.

### 8.4 Deployment providers
| Provider | Capability note (observed) | States |
|---|---|---|
| Cloudflare Pages | Direct Upload | NOT CONNECTED / VERIFIED |
| GitHub Pages | Git Data API | NOT CONNECTED / VERIFIED |
| Vercel | Deployments API | NOT CONNECTED / VERIFIED |
| cPanel hosting | Explicit-TLS FTPS | VERIFIED + masked host/user hint |

Actions: Test connection · Edit · Disconnect. Deployable only after VERIFIED.

---

## 9. Static Delivery + AutoDelivery

**Files:** `Static Delivery.png`, `AutoDelivery.png`

### 9.1 Build & deploy
- Copy: Astro-style static builds from Ghost; builds work without deploy credentials; deploy when ready
- **Auto-rebuild on publish** OFF/ON — when ON, worker queues rebuild (and deploys via verified provider); "Existing builds are never re-deployed; single-shot semantics apply"
- Build cards: id · AUTO badge · SUCCEEDED/FAILED · pages · KB · ms · time
- Actions: Download ZIP · target · Deploy · Preview
- Deploy rows: preflight + live probe (Public URL origin) · VERIFIED DEPLOYED
- FAILED example: 0 pages · no artifact · expandable technical details

### 9.2 Site customization
Templates with semver + capabilities (observed names): `classic-editorial`, `affiliate-review`, `minimal-authority`.
Fields: Site name · Logo URL · Favicon URL · **Public URL (required for indexable builds)** · Robots policy · Footer text · Header/Footer menus · Head HTML · Body-end code · Analytics snippet.
Placeholder domains rejected. Custom scripts run only in customer static site, never in control plane.

---

## 10. AI Keys & Usage

**File:** `API Keys and Usage.png`

- Keys encrypted at rest (AES-256-GCM); priority failover + daily allowances
- Key cards: provider · masked hint · failover order / priority · last used · Chat + Semantic capabilities · today settled · allowance · outstanding reserved
- Observed pattern: BYOK OpenAI priority 100 (#1) + managed key priority 1 (#2)
- Usage events (today): SETTLED count · RESERVED count · UTC day reset timestamp
- Event rows: SETTLED · provider/model · stage · tokens · time (includes embeddings e.g. `text-embedding-3-small`)
- `[assumption]` Daily caps may be finite in own-panel even when SaaS UI showed `unlimited`

---

## 11. Content / Website / Account

**Files:** `Content.png`, `Website.png`, `Account.png`

### Content
- Account defaults: model ($/1M shown) · Publish as · tone · sections/article · section images max
- Read-only contracts: keyword limit 100/run · duplicate thresholds · link rules
- Per-site overrides: sections · images · tone · publish as · link intensity (light/standard/dense) · image provider · voice

### Website
- Workspace name/id · Ghost mode Live Ghost · static site name · createdAt
- Deep links: Authors & bylines · Backup & recovery · Content defaults · Static customization · Connections

### Account
- Profile · change password (signs out other sessions) · active sessions · revoke · verify email

---

## 12. Workflow diagrams (text)

### 12.1 Keyword run
```
Create(Keywords) → normalize+gate → Run+Jobs
  → [×2 concurrency] article.generate stages 1→6
  → Ghost POST once (ledger) → links.verify
  → debounced static.build → optional deploy/verify
  → embedding register for next dedupe
```

### 12.2 Topic plan run
```
Create(Topic plan) → topicplan.generate → review/exclude → queue
  → cluster Jobs first → pillar Job dependsOn clusters
  → same six-stage path → pillar links to cluster URLs
```

### 12.3 Link re-weave
```
Connections → Sync inventory → Audit (read-only proposals)
  → Apply selected → Ghost PUT + optimistic lock
  → LinkEdge update → optional static rebuild
```

### 12.4 AutoDelivery
```
article_published → debounce ~60s → static.build (new snapshot)
  → static.deploy via VERIFIED provider → live probe Public URL
```

---

## 13. Own-panel parity checklist (from this map)

Use during AUDIT → mark PASS / GAP / N/A:

- [ ] Worker online badge + heartbeat
- [ ] Create Keywords + Topic plan tabs with contracts above
- [ ] Runs durable across restart; six stage cards; $ / tokens / settled calls
- [ ] Refusal reasons visible (incl. semantic/paraphrase)
- [ ] Restart failed / regenerate-as-variant without double POST
- [ ] Articles detail: ledger, links, images, stages, verify flags
- [ ] Connections: Live Ghost, Sync, Audit ≤N read-only, providers VERIFIED
- [ ] Static: Public URL gate, included/excluded, auto-rebuild single-shot snapshots
- [ ] AI Keys: RESERVED/SETTLED/RELEASED, UTC day, priority failover, embeddings metered
- [ ] Clusters-first pillar-last ordering
- [ ] Re-weave PUT-only

---

## 14. How to use this map with the Governor

1. Paste **Governor** as the skill/system prompt.
2. Attach or point to this **Workflow Map** when the task is UI parity, operator runbook, or screenshot-driven acceptance.
3. For code audits, prefer handbook schema/API sections; use this map to name screens and expected controls.
4. Always tag claims with evidence labels; never invent percentages.


---

## 15. Screen-by-screen operator actions (expanded)

### 15.1 Overview — first 60 seconds
1. Confirm **Worker online** and Ghost CONNECTED.
2. Check last static build — SUCCEEDED with pages > 0, or triage FAILED.
3. Skim tokens today vs allowance; if unexpectedly high, open AI Keys usage events.
4. Open most recent run; confirm no flood of REFUSED without knowing why.

### 15.2 Create Keywords — safe first smoke
1. Set Publish as **Draft** for first smoke on a new brand.
2. Paste 1–3 keywords only.
3. Leave Allow intentional variants **OFF** unless deliberately testing variants.
4. Submit → open Run detail → wait for stage cards → open Article → confirm ledger CONFIRMED as draft in Ghost.
5. Only then scale to larger batches (still ≤100/run).

### 15.3 Create Topic Plan — ordering watch
1. Generate plan → exclude vague/overlapping clusters.
2. Queue → open Topic Plan detail + linked Run.
3. Watch cluster jobs reach COMPLETED **before** pillar Intent stage starts (own-panel contract).
4. On pillar article, verify links toward cluster slugs.

### 15.4 Runs — PARTIAL triage
1. Expand failed/refused jobs first.
2. Note refusalReason (exact / lexical / semantic / NO_USABLE_KEY / …).
3. Restart failed one job at a time; after restart, confirm Ghost post count unchanged for that slug.
4. For semantic refuses, consider Sync inventory + calibrate threshold before forcing variants.

### 15.5 Articles — quality spot-check
1. Uniqueness not suspiciously low vs siblings.
2. Coverage / intent match present.
3. `[verify]` flags reviewed before promoting draft → live.
4. Images: HTTP 200 + sensible alt; license caveat acknowledged.
5. Internal links: anchors verbatim; states progressing toward GHOST_CONFIRMED / STATIC_CONFIRMED.

### 15.6 Connections — weekly hygiene
1. Test Ghost (read-only) monthly or after CMS moves.
2. Sync inventory after any manual Ghost edits.
3. Run Audit on a sample of 5 posts; apply only reviewed proposals.
4. Re-test deploy provider after password rotations.

### 15.7 Static Delivery — before Auto ON
1. Public URL set to real https origin.
2. Manual build SUCCEEDED with expected page count.
3. Deploy VERIFIED + live probe pass.
4. Delete demo "Coming soon" from Ghost; rebuild.
5. Then enable Auto-rebuild.

### 15.8 AI Keys — cost control
1. Keep a finite daily allowance on BYOK keys in production brands `[assumption]` if product supports it.
2. Watch RESERVED not stuck >1h.
3. Confirm embeddings appear as SETTLED events (dedupe is not "free").
4. On 401, expect key disabled + danger activity — rotate key offline.

---

## 16. Mapping masterguide principles → UI moments

| Masterguide principle | Where it shows up in UI/workflow |
|---|---|
| Non-commodity filter | Before Create submit / Ideas accept — operator checklist (Governor §23) |
| Entity / fact hierarchy | Article `[verify]` flags + voice brandFacts |
| Keyword as hub not traffic promise | Ideas + Topic plan scoping; Analytics must not invent CTR claims |
| Topic → cluster → subcluster | Topic Plans; limit recursion via exclude |
| Embedding duplicate detection | Create gate + stage 6 + AI Keys embedding settlements |
| Internal linking automation | Enrichment stage + Connections Audit + Analytics link edges |
| Static delivery rationale | Static Delivery builds + Public URL |
| Zero-duplication URL rules | Template/robots/sitemap choices in Static customization |
| IndexNow / Bing | Post-deploy hook `[assumption]` own-panel; not required for SaaS screenshot parity |
| Answer engines | Opening-answer draft rule + question H2s + crawlable links |

---

## 17. Failure → screen jump table

| Symptom | Open this screen first |
|---|---|
| Worker offline | Overview system health → host monitoring (infra) |
| Connect fails | Connections → Test |
| Dup flood | Runs refused counters → Connections Sync → AI Keys embeddings |
| Double post fear | Article Ghost publish ledger · Ghost Admin posts list |
| Public site empty | Static Delivery last build · deploy probe · Cloudflare cache |
| Cost spike | AI Keys usage events · Run settled calls |
| Weak pillar links | Topic Plan detail ordering · Article internal links · Audit |
| Image junk | Article images panel · Content image provider setting |

---

## 18. Acceptance smoke script (draft mode)

Copy into a QA checklist:

1. [ ] Worker online
2. [ ] Ghost CONNECTED (Live)
3. [ ] Inventory synced; no unwanted demo posts
4. [ ] AI key enabled; allowance > one article estimate
5. [ ] Create → 1 keyword → Draft → Run COMPLETED
6. [ ] Six stages present; stage 6 = 0 tok
7. [ ] Article ledger CONFIRMED; single Ghost draft
8. [ ] Sync inventory; uniqueness populated
9. [ ] Audit links read-only (no writes)
10. [ ] Public URL set; manual static build SUCCEEDED
11. [ ] Deploy to staging/VERIFIED provider; live probe OK
12. [ ] Record real $ / tokens for the smoke (measured, not copied from old screenshots)

---

## 19. Document maintenance

When new screenshots arrive:
1. Drop files into `Ghost.Bloggent/` with descriptive names.
2. OCR key screens if text-heavy.
3. Update §1 sidebar if nav changes.
4. Add rows to Governor §27 crosswalk.
5. Bump a one-line "Last screenshot review" date below.

**Last screenshot review:** 2026-09-25 (Asia/Dhaka) — OCR on Run-Details, Create, Connections-AuditInternalLinks, Static Delivery, API Keys and Usage, Homepage, AutoDelivery, Create-TopicPlan, TopicPlanDetails, Articles, Analytics, Content, Website, Account, SingleArticleExample; monitoring classified as host infra.
