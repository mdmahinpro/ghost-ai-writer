# LIVE_REA_REALTIME_AUDIT.md — ghost.bloggent.com Realtime Authenticated Inspection

**Inspection date:** 2026-10-16 (Asia/Dhaka) · **Session:** authenticated, headed-mode disabled (headless Chrome via `playwright-core`, Chrome 140 installed binary)
**Method:** `knowledge-base/cookies.json` (`gw_session` session cookie was still VALID — no password login needed; `.env` email/password flow was coded as fallback). Playwright crawl of all 20 authenticated areas + DOM/control capture + full-page screenshots + XHR/fetch response recording (masked) + Next.js bundle JS download & grep + direct authenticated REST API probes (create → inspect → delete performed ONLY for one QA calendar; deleted afterwards, nothing left behind).
**RE A CLI:** `npx rea-agents@6.5.0 capabilities` verified in terminal (4 providers). Browser automation executed directly as this environment has no REA MCP session mounted.
**Raw evidence:** `%TEMP%\kilo\rea-live\evidence\` — `capture.json` (pages 1–20 + 687 network entries + bundle findings), `capture2.json` (per-page dialogs & details), `capture3.json`/`capture4.json` (API shape probes), `storage-state.json`, `shots/*.png` (25 full-page screenshots). Secrets/tokens masked in all captures; `.env` untouched.

---

## 1. Environment & Tenancy (live)

| Item | Live value (2026-10-16) |
|---|---|
| Active workspace | **Go PhD** — `siteId cmv749y800n3snw01cnh6idwu`, slug `go-phd`, ghostMode `LIVE`, ghostStatus `CONNECTED` |
| Ghost CMS URL (article API) | `https://cms.gophd.com` (subdomain pattern confirmed from `/api/articles/{id}` payload) |
| Managed engine | `managed-engine: "UNAVAILABLE"` — Bloggent Unlimited **not funding** this website |
| Owned key | 1 × OpenAI key, label "Bloggent", hint `••••1icA`, priority 100, **dailyTokenAllowance null = unlimited**, supports `{chat:true, embeddings:true}` |
| Platform worker | `/api/overview` → `worker {alive:true, jobsActive, completed:23541, failed:1956, scope:"platform"}` — numbers are platform-wide (other customers included) |
| Site stats | 73 articles / 73 published / linkCounts `{verified:0, local:136}` / imageCount 132 |
| Dup corpus state | **`dupCorpusState:"EMBEDDING_UNAVAILABLE"`** (new state), `dupCorpusSyncedAt` present |
| Entitlement | FREE plan, websiteLimit 1, upgrades Starter BDT 20,000 / Growth BDT 35,000 / Agency BDT 50,000 (5/10/50 sites, 365-day term), manual payments bKash/Nagad with collected payment details — orders ARE enabled now |
| Nav (sidebar) | WORKSPACE header: Websites · CONTENT: Overview, Create, Topic Plans, **Research, Calendar (first-class nav now)**, Runs, Articles, Analytics · WEBSITE: Connections, Static Delivery · SETTINGS: AI Keys & Usage, Bloggent Unlimited, Content, Website · ACCOUNT: Account, Billing & Plan |
| Worker badge copy | "Writing service **online/offline**" (renamed from "Worker online") |

---

## 2. Company-Wide Config — `/api/config` (live model catalog)

- `keywordLimit: 100` — still enforced server-side (our Rule 1 divergence is intentional).
- **Providers: only two** — `{id:"openai", label:"OpenAI", requiresKey:true}` (BYOK). OpenRouter models exist in the catalog but are gated by an OpenRouter key; **no custom-endpoint provider on live** (our Rule 4 adds it).
- **Model catalog (15 models, `modelGroup` fast/balanced/flagship + exact $/1M pricing):**

| provider | modelId | display | group | in $/1M | out $/1M |
|---|---|---|---|---|---|
| openai | gpt-4o-mini | OpenAI GPT-4o mini | fast | 0.15 | 0.6 |
| openai | **gpt-5.6-luna** | OpenAI **GPT-5.6 Luna** (current default in `/api/preferences`) | fast | 0.2 | 1.2 |
| openai | gpt-5-mini | GPT-5 mini (**retires 2026-12-11** — retirement dates now surfaced in UI) | balanced | 0.25 | 2 |
| openai | gpt-4.1-mini | GPT-4.1 mini | balanced | 0.4 | 1.6 |
| openai | gpt-5.4-mini | GPT-5.4 Mini | fast | 0.75 | 4.5 |
| openai | gpt-5.6-terra | GPT-5.6 Terra | balanced | 2 | 12 |
| openai | gpt-4o | GPT-4o | flagship | 2.5 | 10 |
| openai | gpt-5.6-sol | GPT-5.6 Sol | flagship | 4 | 20 |
| openai | **gpt-6-astra** | OpenAI **GPT-6 Astra** | flagship | 10 | 50 |
| openrouter | llama-3.3-70b-instruct:free / paid | Llama 3.3 70B (Free + paid) | fast/balanced | 0 / 0.12 | 0 / 0.3 |
| openrouter | deepseek/deepseek-chat-v3:free | DeepSeek Chat V3 Free | fast | 0 | 0 |
| openrouter | google/gemini-2.5-pro | Gemini 2.5 Pro | balanced | 1.25 | 10 |
| openrouter | openai/gpt-4o | GPT-4o (OpenRouter) | flagship | 2.5 | 10 |
| openrouter | anthropic/claude-sonnet-4 | Claude Sonnet 4 | flagship | 3 | 15 |

- Stage definitions unchanged (6 stages, same names/descriptions as Oct-10 audit).

---

## 3. Question (b) Answered — Calendar Detail & Automation (live-verified by real API round-trip)

Live list page still shows banner: **"Calendars are planning only in this release: nothing is generated or published automatically"** — but the shipped bundle contains the FULL automation implementation, and live API round-trip confirmed the data model (QA calendar created → inspected → toggles PATCHed → deleted):

**Calendar object (GET `/api/calendars/{id}`, created via POST):**
```json
{ "id":"…", "websiteName":"Go PhD", "name":"QA LIVE CHECK Oct16", "timezone":"Asia/Dhaka",
  "activeDays":[1,2,3,4,5], "articlesPerWeek":3, "publishTime":"09:00", "generationLeadHours":24,
  "publishMode":"published",          // "published" | "draft"  ← draft-calendar toggle lives here
  "defaultModelCatalogId":null, "strategy":"PILLAR_FIRST", "mode":"MANUAL",
  "planningRangeDays":30,
  "autoGenerate":false, "autoPublish":false, "autoReweave":false,   // ← THE 3 AUTOMATION SWITCHES
  "status":"ACTIVE", "cadence":"3 articles a week, published at 09:00 Asia/Dhaka on Mon–Fri. Each article is written 1 day before its publication time.",
  "items":[], "clusters":[],
  "automation":"Automation is off: nothing on this calendar is generated, published or linked automatically. Scheduled articles wait for you." }
```

**The 3 automation switches (bundle-verified labels/handlers + API-verified behavior):**
1. **`autoGenerate` — "Write automatically"** → `PATCH /api/calendars/{id} {autoGenerate}`; toast: "Automatic writing turned on — articles still wait before publishing".
2. **`autoPublish` — "Publish automatically" / "Save drafts automatically"** (label depends on `publishMode`); title: "Each article is sent to Ghost as an unpublished draft at its scheduled time." vs "…published on the live site at its scheduled time, without you present." → `PATCH …/calendars/{id} {autoPublish}`. **Draft calendar = `publishMode:"draft"` + autoPublish** (resolves the Oct-10 doc ambiguity).
3. **`autoReweave` — "Automatic internal linking"** → `PATCH …/calendars/{id} {autoReweave}`; bundle copy: "will edit the already-published posts in that cluster so they link to it. This changes posts that are already live."

List rows show an **"automation on" / "manual" pill** (amber when any of the 3 is on). A per-calendar `automation` summary string is computed server-side.

**Full calendar API contract (bundle + live round-trip):**
| Endpoint | Method/Body | Behavior |
|---|---|---|
| `/api/calendars` | POST `{websiteId, name, timezone, articlesPerWeek, publishTime:"09:00", generationLeadHours:24, strategy:"PILLAR_FIRST", activeDays:[1,2,3,4,5]}` | create; toast "fill it from a content plan" |
| `/api/calendars/{id}` | GET / DELETE | read (fields above) / remove (live-verified 200) |
| `/api/calendars/{id}` | PATCH `{autoGenerate\|autoPublish\|autoReweave, publishMode, defaultModelCatalogId, strategy, …}` | toggles/settings |
| `/api/calendars/{id}/plan` | POST `{planId}` | fill from content plan; response `{unscheduled:[…], n}` → toast "N article(s) did not fit in the planning range" |
| `/api/calendars/{id}/items/{itemId}` | PATCH `{status:"SCHEDULED"|"SKIPPED", scheduledPublishAt}` | skip / restore / reschedule |
| `/api/calendars/{id}/items/{itemId}` | DELETE | remove before work starts |
| `/api/calendars/{id}/items/{itemId}/generate` | POST | "Write now" — "Writing started — it will wait for you before publishing" |
| `/api/calendars/{id}/items/{itemId}/publish` | POST | "Publish now" — toast varies by draft/live mode |

New-calendar dialog fields: Name, Timezone (detected "Asia/Dhaka"), Publishing days (Sun–Sat), Articles per week (number), Publish at (local) "09:00", Write this many hours ahead (1–336), Order `PILLAR_FIRST` (pillars-first default; pillar scheduled before its supporting articles).

---

## 4. Research Engine — 11 Stages Live-Named (R1–R11)

Existing project: "Go PhD", status **PARTIAL ("10 of 11 stages complete · wide")**, R3 Problem map FAILED with honest validation-refusal messaging. Per-stage cards show: stage id, name, engine (`llm` | `derived`), tokens, **Show provenance**. Retry continues "from what is missing and does not re-run or re-charge the rest". Archive button present. Tabs: Overview · Niche · Audiences · Problems · Topic map · Queries · Coverage · Clusters & plan. Evidence labels incl. **"You wrote this"** for user description; section header: "AI interpretation — an AI reading of your description… your corrections take precedence."

| # | Live name | Engine | Observed tokens (this run) |
|---|---|---|---|
| R1 | Niche understanding | llm | 2,174 |
| R2 | Audience map | llm | 2,415 |
| R3 | Problem map | llm | 5,177 (FAILED once — safe stop) |
| R4 | Topic universe | llm | 8,337 |
| R5 | Query expansion | llm | **36,382** |
| R6 | Intent classification | llm | 22,177 |
| R7 | Semantic consolidation | **derived (0 tok)** | 0 |
| R8 | Existing coverage mapping | llm | 833 |
| R9 | Cluster construction | llm | 7,713 |
| R10 | Content action classification | **derived (0 tok)** | 0 |
| R11 | Strategic priority inputs | llm | 11,737 |

`GET /api/research` → `{projects:[{id,name,status:"PARTIAL",breadth:"wide",error,stagesRequested:11,stagesCompleted:10,activeStage,attempts,…}]}`. Header noted **"Later stages in the research pipeline (1) — not part of this project"** → the live pipeline has further stages beyond R11 available per project selection. Failure copy shown: "The AI returned content in a format we could not safely use, so we stopped instead of publishing something unusable."

---

## 5. Create, Runs, Articles (live)

- **Create · Keywords tab:** textarea "0/100" (server `keywordLimit:100`), Publish as / AI model / Content type selectors (model row shows "Account default — OpenAI GPT-5.6 Luna"), Allow intentional variants switch, normalized preview, AI-ideas block with **"12 ideas"** count selector + **"Research (live sources)"** mode, funding-status note, "What happens next" copy (bounded concurrency 2/website, six stages, 3-layer dup, Bing-proxy images, link graph).
- **Run detail API:** `GET /api/runs/{id}` → `{type, status, input, stats, sourceLabel, usage, jobs[]}`; job = `{keyword|topicTitle, status, stage(1–6), attempts, restarts, restartLimit:5, engine, error, variant, variantOf, article{ featuredImageUrl, …}, publishHold, holdEvidence, stages:[{stageIndex, name, status, tokensIn, tokensOut, durationMs, error}]}`. Observed healthy run: stage 6 tokens 0/0 confirmed. Vector: `variantOf` links intentional variants.
- **Article detail API:** `GET /api/articles/{id}` → `{ghostMode:"LIVE", ghostUrl:"https://cms.gophd.com", meta:{tags, media:{featured:{at, reason:"vision confirmed: … [vision:RELEVANT | conf=0.9 …]", source:"PIPELINE", status:"SELECTED", reasonCode:"SELECTED"}, excerpt}, mustCover[] …}}`. Featured image = Bing thumbnail `tse1.mm.bing.net/th?q=…&w=474&h=274&c=7` — still Bing-proxy hotlinking on live.
- **Articles list:** columns status / links in-out / image count ("2/3") / uniqueness % / engine llm.
- **Connections:** Ghost form + inventory "(97 shown · up to 200 recent records)" (was 25 on Oct-10).

---

## 6. Static Delivery — Ads + Templates (live)

- **4 templates** (semver 1.0.0, `professional-magazine` NEW — "Light, clean blog/magazine look (the studentsandparents.com professional theme)… no webfonts, no scripts"): classic-editorial (dark-first, emerald), affiliate-review (rating markup **"renders ONLY when rating data exists — never fabricated"**), minimal-authority (CWV floors), professional-magazine.
- **Every template capability set includes `jsonld:true`** and **`adSlots:"site_top,home_feed,article_top,article_inline,article_bottom,article_sidebar,site_bottom"` = 7 ad slots**; layouts `[index, article, 404, taxonomy]` — taxonomy (tag/author) archives now built.
- **Monetization / Ads UI:** master switch "Enable ads on this website" + 7 per-slot blocks: Below header · Between homepage posts · Before article content · Inside article · After article content · Article side column · Above footer (+ header/footer positions on the position map). Per slot: Enable toggle, Internal name, **Ad type: Custom HTML/JavaScript | AdSense responsive display unit**, Ad code **max 16 KiB**; placement rules ("After the sixth card when there are at least seven posts", "After paragraph three when there are at least six top-level paragraphs", side column 300px rail ≥1200px); **"Preview shows placeholders and disables custom integrations"**; `adsConfigHash` in static-config; "To remove live ads, disable them and build/deploy again."
- Auto-rebuild toggle OFF for this workspace; builds list empty; `deployTarget:"NONE"`.

## 7. AI Keys & Usage (live)

Add-key dialog: provider radio **OpenAI ("Direct OpenAI API key (sk-…)")** / **OpenRouter ("One key, many providers")**; Label*; API key* (≥20 chars); **source-confirmation checkbox** ("I copied this API key from OpenAI.") required before Test/Save enable; Daily **token** allowance (≥1,000 or empty = unlimited, UTC reset — "not a provider billing limit"); Advanced: key priority. Tests make small real writing + semantic requests (charge warning incl. Sandbox). Existing key shows per-key: Writing/Semantic support, Test, Delete, Enable, allowance editor, today settled/reserved, "Resets … UTC day". **No custom-endpoint option live** (ours adds it under Rule 4).

## 8. Other areas (live deltas)

- **Funding/Bloggent Unlimited:** "not funding this website… new runs use your own API key" + `/api/niches/discover/availability` → `{sponsored:{available:true, reason:"AVAILABLE", remaining:10, limit:10, resetAt:<UTC midnight>}, personalAvailable:true}` — 10/day funded niche discoveries.
- **Billing:** packages + `payment.methods` with **real collection details** (bKash personal number etc.) — paid ordering is now enabled on live (Oct-10 conflict resolved).
- **Backup:** `GET /api/websites/{id}/backup` → `{backups:[]}`; the settings/backup page documents limits (10 backups & 5 imports /15 min, 25 MB, 30 exports) — unchanged caps live.
- **Authors:** profiles list "0/20" **cap confirmed**; Add-author dialog: Avatar URL (optional), Name, Short bio, Expertise ("Shown on static author pages — **never auto-generated**"), Ghost author id ("never invented — paste from Ghost staff"), Default byline switch; profiles flow into **Ghost bylines + static Person structured data**. (Our Rule 2 deliberately diverges: fully automated generation **including Ghost author creation** — user requirement.)
- **Help:** same 37-guide index, plus new guides referenced for Research/Calendar.

## 9. Deltas vs 2026-10-10 audit (summary)

1. Research + Calendar are now **first-class sidebar areas** (they were assumption items before).
2. **Model catalog modernized** — GPT-5.6 Luna default; **GPT-6 Astra** flagship; retirement dates surfaced; OpenRouter catalog present but key-gated.
3. **Static Delivery ads system matured** to the documented 7-slot/16 KiB/AdSense architecture with position map + placeholders preview + `adsConfigHash`; professional-magazine template added; taxonomy layouts; JSON-LD everywhere.
4. **Calendar automation implemented in shipped UI bundle** (autoGenerate / autoPublish / autoReweave + draft-mode "Save drafts automatically") — though this *release* still gates it behind the "planning only" banner.
5. **Research stage names/engines live-confirmed** (R1–R11, 2 derived stages), with per-stage provenance, retry-from-missing, safe validation-refusal stops.
6. Run jobs expose **restartLimit:5, attempts, holdEvidence, variantOf**; stage token I/O split (`tokensIn/tokensOut`).
7. Billing/checkout enabled with real payment details; sponsored niche discovery has a concrete 10/remaining/day quota.
8. Ghost CMS = `cms.<brand>` subdomain confirmed; inventory shows "up to 200 recent records"; dup-corpus has new `EMBEDDING_UNAVAILABLE` state.

---
*All raw capture files and screenshots retained at `%TEMP%\kilo\rea-live\evidence\` for the governor trail. No public/publication/deploy/billable action was executed; the only write actions were one QA calendar (created, toggled revert, deleted) and zero-risk GET requests.*
