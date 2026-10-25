# Authenticated audit — ghost.bloggent.com (2026-10-22)

Account: Md Mahin Bin Raihan (USER, ACTIVE, email verified) · site workspace **Go PhD** (`cmv749y800n3snw01cnh6idwu`, LIVE Ghost at `cms.gophd.com`) ·
real production data: 15 plans, 8+ runs, **73 articles**, 1 research project, 2.4 M tokens settled.
Method: authenticated session, per-area route walk, live `fetch` of their own JSON APIs, DOM capture. Raw: `docs/audit/raw/app-audit.jsonl`.

## 1. Area map (18 authenticated routes)

| Group | Route | Purpose |
|---|---|---|
| WORKSPACE | `/app/sites` | website workspace list |
| CONTENT | `…/overview` | onboarding checklist + activity feed |
| | `…/create` | keyword batch intake (Keywords \| Topic plan, publish mode, model) |
| | `…/plans` | topic plans (pillar + cluster items) |
| | `…/research` → `…/research/<id>` | 11-stage research project |
| | `…/calendar` | content calendar + automation switches |
| | `…/runs` → `…/runs/<id>` | batch runs, per-article progress |
| | `…/articles` → `…/articles/<id>` | inventory w/ engine + category + tag filters |
| | `…/analytics` | tokens, output, link edges, stage performance |
| WEBSITE | `…/connections` | Ghost connect / test / sync / **audit internal links** |
| | `…/static` | static build, ZIP, Cloudflare Pages deploy |
| SETTINGS | `…/ai-keys` | keys, priority order, daily allowance, usage |
| | `…/funding` | "Bloggent Unlimited" |
| | `…/settings/content`, `…/settings` | content defaults, authors/bylines, backup/restore |
| ACCOUNT | `/app/account`, `/app/billing` | profile, plan, website cap, quotes |

Their API surface (observed): `/api/auth/me`, `/api/websites`, `/api/websites/<id>`, `/api/websites/<id>/inventory`,
`/api/websites/<id>/integrations`, `/api/websites/<id>/static-config`, `/api/websites/<id>/static-builds`,
`/api/config`, `/api/activity`, `/api/research`, `/api/research/<id>`, `/api/plans`, `/api/runs`, `/api/runs/<id>`,
`/api/articles`, `/api/articles/<id>`, `/api/calendars`, `/api/keys`, `/api/usage`, `/api/analytics`,
`/api/billing`, `/api/billing/quotes`.

## 2. The generation pipeline — 6 stages, measured on a real article

| # | Stage | tokens in/out | duration |
|---|---|---|---|
| 1 | Intent & Blueprint | 990 / 609 | 5.8 s |
| 2 | Draft Generation | 1,862 / 2,662 | 26.3 s |
| 3 | Quality & Coverage Revision | 3,899 / 2,980 | 20.1 s |
| 4 | Metadata & Packaging | 633 / 464 | 4.7 s |
| 5 | Site Enrichment | 1,526 / 389 | 0.86 s |
| 6 | Final Validation & Publication | 0 / 0 | 11.1 s |

Whole run: **7 articles · $0.0817 · 184,942 tokens · 75 AI requests**. Stage 6 spends no tokens → pure assembly + duplicate check + Ghost publish.

## 3. Article record (their real schema)

```
id, websiteId, websiteName, ghostMode(LIVE|SANDBOX), ghostUrl,
title, slug, keyword, status(PUBLISHED|…), engine(llm|…),
ghostPostId, publishedAt, createdAt,
uniquenessScore 0.87, intentMatch 0.98, coverageScore 0.99,
featuredImageUrl, featuredAlt, imageCount
+ images[]  + attempts[]  + stages[]  + meta{} + content{} + links{}
```

**`content`**: `{ intro, sections[6], faq[3], conclusion, html, contentFormat: "md-subset.v1" }`

**`meta`** (17 keys): `tags, media.featured{status,reason,reasonCode,source,at}, excerpt, mustCover[5], wordCount 2155, articleType "how-to", articleTypeSource "blueprint", articleTypeRationale, publishMode, searchIntent "informational", contentFormat, qualityReport{notes,coverage,repetition,intentMatch,unsupportedClaims}, contractReport{type,checks,summary,version}, promptVersions{1..5}, targetAudience, metaDescription, semanticDuplicateCheck`.

Key detail: **`mustCover[]` is the coverage contract** written at the blueprint stage and checked at stage 3 — that is how they score `coverageScore 0.99` instead of vibes.

## 4. The Bing photo technique (verified from live data)

They do **not** call an image search API. Every image is a **Bing thumbnail URL built from a natural-language scene query**:

```
https://tse1.mm.bing.net/th?q=<urlencoded scene query>&w=<w>&h=<h>&c=7
```

Observed on one article:

| role | query | size params |
|---|---|---|
| FEATURED | `person reading allegation notice desk photo` | `w=474&h=274&c=7` |
| CONTENT | `person writing response to allegation notice photo` | `w=624&h=352&c=7` |
| CONTENT | `allegation notice beside archived emails and files photo` | `w=624&h=352&c=7` |

Rules extracted:
1. Query = plain descriptive scene + literal suffix **`photo`** (never "stock photo", never keyword soup).
2. Role split: exactly one `FEATURED` (hero, 474×274) plus N `CONTENT` images (624×352); `imageCount` counts non-featured.
3. **Vision gate before selection** — `meta.media.featured.reason` reads
   `"vision confirmed: The image shows a hand holding an eviction notice… [vision:RELEVANT | conf=0.9]"`,
   with `status: SELECTED`, `reasonCode: SELECTED`, `source: PIPELINE`.
   So: propose query → fetch Bing thumbnail → send the bytes to a vision model with the alt text → accept only if relevant → record reason + confidence.
4. `alt` is a full grammatical sentence describing the scene, not the query string.
5. Featured is chosen at **stage 5 (Site Enrichment)**, not at publish — 0.86 s because the vision calls are batched.

## 5. Internal linking (their model)

```json
"links": {
  "outgoing": [],
  "incoming": [{
    "id": "...", "anchor": "might solve the first",
    "status": "LOCAL_INSERTED", "health": "pending",
    "label": "Needs verification",
    "reason": "Saved locally or awaiting a confirmed read-back from the destination.",
    "verifiedAt": "...", "source": { "title": "...", "slug": "..." }
  }],
  "history": [],
  "summary": { "verified": 0, "needsReview": … }
}
```

Mechanism: stage 5 reads a **verified site inventory** (`/api/websites/<id>/inventory`, built by "Sync posts"), picks an anchor phrase already present in the new draft, inserts the link locally (`LOCAL_INSERTED`), then **read-back verifies** it from Ghost before calling it `verified`. Anything unverified stays visibly labelled "Needs verification" — they never claim a link exists without reading it back. Connections also exposes a standalone **Audit internal links** repair action.

## 6. Research (11 stages) and plans

Research stages (tabs): `Overview · Niche · Audiences · Problems · Topic map · Queries · Coverage · Clusters & plan` (+ intent/description stages; `stagesRequested: 11`), each with **Show provenance**. `breadth: wide|narrow`. Live project: 10/11 finished, `status: PARTIAL`, `problem map` failed with
*"The AI returned content in a format we could not safely use… Retrying continues from what is missing and does not re-run or re-charge the rest."*
→ **partial-progress, resumable, per-stage errors** are first-class.

Plan record: `{ id, topic, pillar{title,summary}, pillarIsItem, status, engine: "research", runId, itemCount, completedCount, error }`.

## 7. Limits (theirs) vs ours (unlimited)

| Thing | Theirs | Ours (directive) |
|---|---|---|
| Keyword batch | **100 / run, server-enforced** | unlimited |
| Website workspaces | 1 on Free; ৳20k→5, ৳35k→10, ৳50k→50, 365-day term | unlimited |
| Model access | BYO key only (`managedEngine: UNAVAILABLE`) | same (BYO), no key cap |
| Daily allowance | per key, set by user | keep (safety), default off |
| Runs/research/plans/articles | plan/entitlement gated | unlimited |

## 8. Engineering signals worth copying

- `worker: { alive: true, lastTickAt: <ISO ticking>, version }` in `/api/config` → their **worker is server-side and self-reports heartbeat**; the UI can prove liveness. Confirms our P2 gap.
- Client bundle ~200 KB for the whole logged-in shell (Next.js server components).
- Every list is server-paginated with filters (`All engines`, category counts, tag counts) — no client-side full-table load.
- Static delivery: Astro-style build → `SUCCEEDED · 141 pages · 3.2 MB · 6.5 s`, downloadable ZIP, Cloudflare Pages target, **builds never re-deployed (single-shot)**, auto-rebuild-on-publish toggle.
- Error copy is specific and reassuring ("retrying continues from what is missing and does not re-run or re-charge the rest").
