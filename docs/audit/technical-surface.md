# Technical surface — ghost.bloggent.com (public, 2026-10-22)

Captured without authentication: page loads, resource timing, public API responses, 38 help pages.
Raw: `docs/audit/api-config.json`, `docs/audit/help-pages.json`.

## Stack (observed)

| Layer | Observation |
|---|---|
| Framework | **Next.js** (turbopack chunks under `/_next/static/chunks/*`), React server components (`?_rsc=` prefetches) |
| Edge | Cloudflare (`cdn-cgi/speculation`, Cloudflare Insights beacon) |
| JS weight on /login | **15 chunks ≈ 200 KB transferred**; largest 72 KB, 43 KB, 15 KB |
| API style | same-origin REST JSON under `/api/*`, envelope `{ok, data}` |
| Anonymous calls on login page | `GET /api/config`, `GET /api/auth/me` (→ `{ok:true,data:{user:null}}`) |
| Session | no cookies visible to JS on the login page (httpOnly session), no localStorage/sessionStorage keys set |

## `/api/config` — their own machine-readable spec (HTTP 200, 4,586 bytes)

```json
{
  "keywordLimit": 100,
  "demoMode": false,
  "managedEngine": "UNAVAILABLE",
  "mail": { "mode": "real", "inboxAvailable": false },
  "worker": { "alive": true, "lastTickAt": "2026-10-22T23:13:49.196Z", "version": "1" }
}
```

**Six stages, verbatim names + descriptions (this is the pipeline spec to implement):**

| # | Name | Their description |
|---|---|---|
| 1 | Intent & Blueprint | Analyze search intent and build the content outline |
| 2 | Draft Generation | Write full article sections from the blueprint |
| 3 | Quality & Coverage Revision | Close coverage gaps and remove repetition |
| 4 | Metadata & Packaging | Title, meta description, slug, tags, excerpt |
| 5 | Site Enrichment | Internal links from verified inventory + image queries |
| 6 | Final Validation & Publication | Duplicate protection, assembly, single-shot Ghost publish |

**Model catalog exposed to clients (15 entries, provider · model · tier · $/1M in · $/1M out):**
`gpt-4o-mini` fast 0.15/0.60 · `gpt-5.6-luna` fast 0.20/1.20 · `gpt-5-mini` balanced 0.25/2.00 · `gpt-4.1-mini` balanced 0.40/1.60 · `gpt-5.4-mini` fast 0.75/4.50 · `gpt-5.6-terra` balanced 2.00/12.00 · `gpt-4o` flagship 2.50/10.00 · `gpt-5.6-sol` flagship 4.00/20.00 · `gpt-6-astra` flagship 10.00/50.00 · openrouter: `llama-3.3-70b-instruct:free` 0/0 · `deepseek-chat-v3:free` 0/0 · `llama-3.3-70b-instruct` 0.12/0.30 (plus 3 more).
Provider list: **openai only** (`requiresKey: true`, "encrypted at rest"). `managedEngine: UNAVAILABLE` → they do not sell model access; BYO key.

**Their hard limit:** `keywordLimit: 100` — server-enforced, global, not per plan.

## What this tells us for our build

1. **Their server owns the worker** (`worker.alive`, `worker.lastTickAt` ticking). Ours runs in a browser tab — this is the P2 item.
2. Their stage names/descriptions are the cleanest possible acceptance spec for our P2 port; we can implement the same six stages with the same boundaries.
3. Their model catalog is a **client-visible table** (id, provider, modelId, displayName, modelGroup, prices, isDefault, eligible) — ours already has `model-catalog.ts`; we should serve it from the API instead of bundling it.
4. `keywordLimit: 100` is server-enforced for everyone. **Our unlimited keyword intake is a real, defensible differentiator** and should be surfaced in the UI (owner directive: "mine version will be unlimited for everything").

## Not captured (needs an authenticated session)

Everything behind `/app`: workspace setup, Ghost connection, key management with daily limits, research R1–R11 screens, plans, calendar automation, run detail/progress, article review/publish, duplicate refusal, link audit/repair, static site build/deploy, usage/analytics, orders. No auth bypass was attempted.
