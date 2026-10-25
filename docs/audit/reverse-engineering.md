# Reverse engineering — ghost.bloggent.com client contracts (2026-10-22)

Method: authenticated live walk + download of their client bundles (46 chunks, 1.9 MB) from
`/_next/static/chunks/*`, then static analysis of the zod schemas, enum tables and UI copy.
Everything below was read from their shipped code, not guessed. No auth bypass; no code copied.

Sources: `docs/audit/raw/app-audit.jsonl` (live DOM/API), bundles cached at `/opt/data/cache/scratch/gb-js/`.

## 1. Stage table (exact keys they use)

```
1 blueprint   Intent & Blueprint              "Analyze search intent and build the content outline"
2 draft       Draft Generation                "Write full article sections from the blueprint"
3 revision    Quality & Coverage Revision     "Close coverage gaps and remove repetition"
4 metadata    Metadata & Packaging            "Title, meta description, slug, tags, excerpt"
5 enrichment  Site Enrichment                 "Internal links from verified inventory + image queries"
6 validation  Final Validation & Publication  "Duplicate protection, assembly, single-shot Ghost publish"
```

Constants shipped in the same module: `KEYWORD_LIMIT = 100`, `PUBLISH_MODES = ["published","draft"]`,
`IMAGE_PLACED_STATUS = "SELECTED"`.

## 2. Per-stage output contracts (zod, verbatim bounds)

**1 blueprint output**
```
searchIntent: informational|commercial|transactional|navigational
targetAudience: 3..200
title: 3..160
mustCover: string(3..200)[]   min 3, max 10      ← the coverage contract
articleType: ARTICLE_TYPES (normalized) + articleTypeRationale ≤400
sections: { heading 3..120, brief 3..500, role ≤40 }[]  1..12
```

**2 draft output**
```
intro: 100..4000
sections: { heading 3..120, body 200..9000 }[]  1..12
conclusion: 80..3000
faq: { q 5..200, a 20..1200 }[]  max 8   (default [])
contentFormat: ≤40
```

**3 revision output** = draft shape **plus**
```
qualityReport: { intentMatch 0..1, coverage 0..1, repetition 0..1,
                 unsupportedClaims int 0..50, notes ≤600 }
```

**claims audit (supporting call)**
```
claims: { claim 10..400, supportStatus SUPPORTED|UNSUPPORTED|OPINION,
          confidence 0..1, source ≤300|null, retrievedAt ≤60|null }[]  max 30
```

**quality critique (drives whether revision re-runs)**
```
intentSatisfaction 0..1, missingCoverage ≤8, unsupportedClaims, genericFiller ≤6,
repetition 0..1, contradictions ≤4, unnaturalTransitions ≤4, formattingIssues ≤4,
revisionNeeded boolean
```
Note `unnaturalTransitions` and `formattingIssues` — they score *prose naturalness* explicitly. That is the hook for a humanizer pass.

**4 metadata output**
```
title 3..160, slug 2..120, metaDescription 50..300, excerpt 30..400, tags(2..40)[] max 8
```

**article patch** (owner edits): `slug` regex `^[a-z0-9]+(?:-[a-z0-9]+)*$`, tags max 10, `metaDescription`/`excerpt` ≤500.

## 3. Image pipeline — the full "Bing photo technique" (confirmed in code + data)

Their own UI copy, verbatim:

> "Images: a dedicated **photo-editor prompt** writes concrete search queries, fetched through the **Bing proxy** and **vision-checked**."

> "Re-runs only the featured slot from the saved image queries — no article text is regenerated. **Up to three candidates are fetched, byte-checked and vision-checked**; a LIVE published post is updated in place."

Observed URL shape on live articles (built server-side by the proxy):

```
https://tse1.mm.bing.net/th?q=<urlencoded query>&w=624&h=352&c=7     (CONTENT)
https://tse1.mm.bing.net/th?q=<urlencoded query>&w=474&h=274&c=7     (FEATURED)
```

**Failure/rejection reason codes they persist** (complete set found):

| code | meaning |
|---|---|
| `SELECTED` | passed everything, attached |
| `BING_PROXY_ERROR` | image search returned nothing usable |
| `NO_CANDIDATES` | no search could be run |
| `INVALID_IMAGE` | every candidate failed **byte validation** (too small / not decodable) |
| `QUALITY_REJECTED` | every candidate was the wrong **size or shape for a hero** |
| `IRRELEVANT` | vision saw the wrong subject in every candidate |
| `UNCERTAIN` | vision could not confirm any candidate shows the subject |
| `NO_RELEVANT_IMAGE` | none confirmed relevant |
| `SKIPPED_VISION_UNAVAILABLE` | vision needs an OpenAI key on the account; absent → skipped |
| `SKIPPED_VISION_BUDGET` | **per-article image-checking budget** ran out |
| `REMOVED_BY_OWNER` / `BROKEN` / `BROKEN_LINK` / `IMAGE_DRIFT_DETECTED` | post-hoc checks on an already-published image |

So the sequence is: photo-editor prompt → concrete queries → Bing proxy → ≤3 candidates → **byte check** → **dimensions/aspect check** → **vision check** (budgeted) → attach with `status SELECTED` + human-readable `reason` + confidence. Vision is optional and its absence is recorded, not hidden.

## 4. Link + article status vocabulary

- link counts are formatted as `verified` and `local` (`formatLinkCounts`), i.e. the two states that matter: verified against destination vs inserted locally.
- article/job statuses observed: `PENDING` (with `notBefore` → UI shows "waiting"), `RUNNING`, `COMPLETED`, `FAILED`, `DUPLICATE_REFUSED`, `REVIEW_HELD`, `UNCERTAIN`, `BLOCKED`, `INVALID`, `CANCELLED`.
- `isHeld` / `isReviewHeld` / `isPublishHeld` → held articles wait for a human decision instead of silently publishing.

**Duplicate protection: 3 layers** (their UI copy), enforced at validation.

## 5. Keyword research (their live sources)

```
sources: ["google","bing","duckduckgo","wikipedia"]   min 1, max 4
count: 5..20 (default 12)
evidenceLevel: "VERIFIED"
per-source status: AVAILABLE | SOURCE_UNAVAILABLE
reason: "" | TIMEOUT | HTTP_ERROR | MALFORMED_PAYLOAD | OVERSIZE
```
i.e. autocomplete harvesting per engine with an explicit evidence level and per-source failure reasons — never a silent empty result.

## 6. Operational constants worth matching

- `bounded concurrency: 2 per website` for article jobs (their cap; ours will be configurable and higher).
- six stages per article, sequential, each persisted with tokens in/out + duration.
- `KEYWORD_LIMIT 100` server-enforced — the cap we drop.
- publish modes: `published` | `draft` only; static builds are single-shot (never re-deployed).

## 7. What this changes in our plan

1. Port the **zod bounds as Rust validators** (serde + a small range checker) so stage output can never drift outside contract — this is what makes their runs deterministic where ours can wander.
2. `mustCover` (3–10) + `qualityReport` are the scoring spine — implement first.
3. Image service must carry the **same reason-code vocabulary** so the UI can explain a missing image instead of showing a blank.
4. `unnaturalTransitions` + `formattingIssues` get a dedicated **humanizer pass** in stage 3 (see `docs/WRITING-QUALITY.md`).
5. Keep `PENDING/notBefore`, `REVIEW_HELD`, `DUPLICATE_REFUSED` as first-class states — they are why their pipeline feels reliable.
