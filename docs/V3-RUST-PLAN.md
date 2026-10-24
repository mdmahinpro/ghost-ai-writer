# Ghost AI Writer v3 — Rust backend + split frontend: step-by-step plan

Status: proposed. Owner: Mission Ghost. Date: 2026-10-22.
Inputs: measured baseline (§1), `PROGRESS_STATE.md` (M1–M5 shipped), `MASTER_SPEC.md` (7 rules + invariants).

---

## 0. The problem, stated precisely

The app is not "slow because React". It is slow and fragile because **all business logic and all data live in the browser**:

| Evidence (measured on this host) | Number |
|---|---|
| Files in `src/` | 159 |
| TypeScript LOC in `src/` | 31,129 |
| `src/lib/store.ts` (zustand + IndexedDB persist + migrations) | 2,416 lines |
| `src/lib/engine.ts` (pipeline, gates, metering, publish orchestration) | 3,279 lines |
| Client-side data layer total (`store`+`engine`+`operator`+`durable-storage`+`vault`) | 6,326 lines |
| TanStack `createServerFn` calls | 37 across 8 files |
| App data persisted in | IndexedDB (`gaw-db`) + localStorage mirror, not SQL |
| SQL usage | better-auth only — `getSql()` has **zero** app call sites |

Consequences that match every unchecked item in `MASTER_SPEC §8`:

1. **Nothing runs without an open tab.** The "worker" is a 400 ms browser interval; calendar automation, job execution and publish all die on tab close. Server heartbeat + lease exist, execution does not.
2. **No real multi-tenancy.** Data is per-browser-profile, not per-account. Two devices = two worlds.
3. **10k-scale generation is unprovable.** Intake is proven at 10k; generation is bounded by a browser loop.
4. **Every large list is client-rendered from a blob.** Hydration + JSON parse of the whole workspace on load is the "slow" the owner sees.
5. **Secrets live in the browser blob** (keys, FTP passwords), sealed only optionally.

> Verdict: the frontend is doing a backend's job. The Rust split is not a style preference — it is the fix for 4 of the 5 open acceptance items.

### 0.1 Measured bundle reality (production build on this host, 2026-10-22)

| Measurement | Value |
|---|---|
| `npm run build` | ✅ exit 0, 1.99 s |
| Client JS shipped — raw | 1.3 MB |
| Client JS shipped — **gzip** | **0.4 MB** (acceptable) |
| Largest chunks (gzip) | `index` 112 KB · `analytics` 103 KB · `store` 90 KB |
| Virtualized lists (`react-window`/`useVirtualizer`) | **none — every list renders in full** |
| `JSON.stringify`/`structuredClone` sites in `store.ts`+`engine.ts` | 30 |
| Persistence per store write | whole state graph serialized + optionally encrypted (`durable-storage.ts` — already coalesced as a hotfix) |

**Honest conclusion: the bundle is not why the site feels slow.** 0.4 MB gzip is normal. The cost is runtime:
1. **No virtualization** — runs/articles/inventory render fully, so 1,000 rows = 1,000 DOM nodes.
2. **The 3,279-line engine runs on the main thread** — ticks, gates and packing compete with rendering.
3. **Whole-graph serialize on persist** — coalesced, but each write still walks the entire workspace.

The Rust backend fixes tab-independence, tenancy and server-side scale. It does **not** by itself fix perceived slowness — that needs server-paginated queries + virtualized lists + engine off the main thread. Those three are quick wins that ship now and survive the migration, so they are pulled forward to **P0.5**.


---

## 1. Target architecture

```
┌────────────────────────────┐        HTTPS/JSON (OpenAPI 3.1)        ┌─────────────────────────────┐
│  Frontend — React 19 SPA   │ ────────────────────────────────────►  │  Backend — Rust             │
│  Vite 8 · TanStack Router  │ ◄────────────────────────────────────  │  axum 0.8 · tokio · sqlx    │
│  TanStack Query · Tailwind │        SSE for run/job progress        │  Postgres 16 (+ PgBouncer)  │
│  Radix · existing themes   │                                        │  utoipa (OpenAPI)           │
└────────────────────────────┘                                        │  tower-http, tracing        │
                                                                      └──────────┬──────────────────┘
                                                                                 │
                                                    ┌────────────────────────────┴───────────────┐
                                                    │ Worker (same binary, separate process)     │
                                                    │ tokio tasks: calendar pulse, job runner,   │
                                                    │ Ghost publish, IndexNow, deploy, research  │
                                                    └────────────────────────────────────────────┘
```

### Frontend choice: **React 19 + Vite 8 SPA + TanStack Query + Tailwind 4 (reuse the existing UI)**

| Option | Verdict |
|---|---|
| **React 19 + Vite SPA** | ✅ **Chosen.** 159 files / 31k LOC of React UI already exists and is good. Talk to Rust over typed REST + SSE. Drops TanStack Start/SSR (not needed for an authed studio app), removes the server-function layer that currently hides business logic. |
| SvelteKit | Faster runtime, smaller bundle — but a full UI rewrite (~31k LOC) for a gain we can get from pagination + virtualization. Rejected on cost/risk. |
| Leptos / Yew (Rust frontend) | Maximum speed, minimum hireability, weakest design-system ecosystem, longest build. Rejected for a design-heavy product. |
| Next.js | Reintroduces Node server we are explicitly removing. Rejected. |

"Better looking" is achieved by design work, not by framework: keep the 6 own themes + token system, add the missing surface states, and replace blob-driven lists with server-paginated, virtualized tables.

### Backend stack (Rust)

- **axum 0.8** (tokio, tower-http) — HTTP API
- **sqlx** with compile-time-checked queries + **Postgres 16** — replaces zustand/IndexedDB
- **utoipa** → OpenAPI 3.1 → `openapi-typescript` generates the TS client (no hand-written fetch types)
- **SSE** (`axum::response::sse`) for run/stage progress instead of polling
- **argon2** + `tower-sessions` or JWT — auth stays compatible with existing `better-auth` rows during migration (expand/contract: read both, write new)
- **object store** (local dir now, S3-compatible later) for media/artifacts
- Same binary runs API and worker; `--role=api|worker|all`

---

## 2. Migration phases (each phase ships, each has a rollback)

### P0 — Make the repo buildable anywhere (today, ~1 h)
- Commit **no** `node_modules`; add to `.gitignore`: `node_modules/`, `.vercel/`, `dist/`, `.output/`, `data/`, `public/media/`.
- `git rm -r --cached` those paths (untrack only, no history rewrite).
- Add `.nvmrc` (24.20.0) + `rust-toolchain.toml` (stable).
- **Gate:** fresh clone + `npm ci` + `npm run build` succeeds on Linux and Windows.

### P0.5 — Perceived-speed quick wins (2–3 days, ships before the rewrite)
- Add list virtualization (`@tanstack/react-virtual`) to runs, articles, inventory, calendar.
- Paginate/limit what the UI renders from the blob (`slice` at the data boundary, not at the DOM).
- Move the engine tick out of the render path (`requestIdleCallback`/`setInterval` outside React state churn; batch commits already partly done).
- **Gate:** 1,000 runs + 1,000 articles: 60 fps scroll, no main-thread task > 50 ms, boot < 500 ms. These wins survive P2/P3.

### P1 — Rust API skeleton + one vertical slice (2–3 days)
- `backend/` cargo workspace: `api`, `worker`, `domain`, `infra`.
- Endpoints: `GET /health`, `GET /api/v1/workspaces`, `GET /api/v1/sites`, `POST /api/v1/keywords` (intake), `GET /api/v1/jobs?cursor=`.
- Postgres schema v1 for the first 6 models (workspace, site, job, article, calendar_entry, api_key) via `sqlx migrate`.
- **Gate:** API serves 10k jobs with cursor pagination < 100 ms p95; OpenAPI validates; TS client generates.

### P2 — Move the engine server-side (the big one, ~1–2 weeks)
- Port `engine.ts` stages (intent → draft → revision → metadata → enrichment → validate/publish) into `domain/pipeline`, one stage per PR, each with the existing zod/TS behaviour as the reference spec.
- Duplicate gates L1/L2/L3 in SQL + pgvector; metering RESERVED/SETTLED as a ledger table.
- Worker executes jobs; progress streamed over SSE; resume after restart.
- **Gate:** parity suite — same inputs produce the same stage outputs as the TS engine on 30 fixtures; tab close no longer stops anything.

### P3 — Frontend cutover, feature by feature (1–2 weeks, can overlap P2)
- Replace `store.ts` reads with TanStack Query hooks, one area per PR (20 areas).
- Delete IndexedDB persistence path only after its area is server-backed.
- **Gate:** each area passes its existing smoke test against the Rust API; no client-side business logic left in that area.

### P4 — Auth + tenancy (3–4 days)
- Migrate `better-auth` sessions (expand/contract), enforce workspace scoping on every query (invariant #9).
- **Gate:** two accounts cannot read each other's rows — proven by test.

### P5 — Live audit parity: make it better than ghost.bloggent.com (see §3)
- Implement the delta features captured in the audit with our own design.
- **Gate:** every audited feature either implemented or explicitly declined in writing.

### P6 — Performance + polish
- Budgets: LCP < 1.5 s on a cold cache, route chunk < 150 kB gzip, API p95 < 120 ms, workspace boot < 300 ms.
- **Gate:** measured on the production build, not dev.

---

## 3. Live audit (REA + installed skills)

Two audits, run and saved as `docs/audit/`:

1. **Competitor surface — ghost.bloggent.com** (`docs/audit/ghost-bloggent-2026-10.md`)
   - Public surface: pages, navigation, feature copy, free-tool behaviour.
   - Authenticated surface: **needs the owner's session cookies** (`knowledge-base/cookies.json`, gitignored). Without them, authed audit is skipped and labelled — no auth bypass, no paywall circumvention.
   - Method: REA MCP (`npx rea-agents setup`) for JS bundle/network/behaviour analysis on pages we are entitled to inspect; Playwright for interaction evidence; screenshots + network captures stored as evidence.
2. **Our own app — feature health** (`docs/audit/self-2026-10.md`)
   - Drive each of the 20 areas in a real browser, record: renders, console errors, empty/error states, and the honest "not working" list with repro steps.
   - Cross-check against `MASTER_SPEC §8` unchecked items.

Deliverable of the audit: a delta table `feature | competitor | ours | gap | decision | owner`, which becomes the P5 backlog.

---

## 4. Risks

| Risk | Mitigation |
|---|---|
| Big-bang rewrite stalls | Vertical slices only; the app stays shippable after every phase |
| Behaviour drift between TS engine and Rust engine | 30-fixture parity suite is a merge gate, not a nice-to-have |
| Auth migration breaks existing users | expand/contract: dual-read sessions for one release |
| Two data sources during migration | Each area is cut over atomically; no area reads both |
| Cost of running Postgres/Rust on current host | Local Postgres + single binary first; hosting decision stays with owner |

## 5. Non-goals

- No UI framework rewrite (React stays).
- No feature removal to hit performance budgets.
- No changes to Ghost publish invariants (single-shot, ledger-before-POST, reconcile-by-slug).
- No copying of competitor copy, CSS, or assets — behaviour parity only, own design.
