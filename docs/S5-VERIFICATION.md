# S5 verification — the image pipeline (stage 5, images half)

`backend/api/src/image.rs`. `cargo test` **44/44**, build zero warnings.

## Their technique, copied exactly

```
https://tse1.mm.bing.net/th?q=<urlencoded scene>&w=<w>&h=<h>&c=7
FEATURED 474x274 · CONTENT 624x352
```

Up to three scene variations per article, a byte-level sanity check (`>8 KB`, a
placeholder is smaller), then a vision model that must answer `RELEVANT` with
`confidence >= 0.6`. The recorded reason uses their format verbatim:

```
vision confirmed: <sentence> [vision:RELEVANT | conf=0.9]
```

All twelve of their rejection codes are modelled (`SELECTED`, `BING_PROXY_ERROR`,
`NO_CANDIDATES`, `INVALID_IMAGE`, `QUALITY_REJECTED`, `IRRELEVANT`, `UNCERTAIN`,
`NO_RELEVANT_IMAGE`, `SKIPPED_VISION_UNAVAILABLE`, `SKIPPED_VISION_BUDGET`,
`IMAGE_DRIFT_DETECTED`, `BROKEN_LINK`). Three are unreachable until stage 6 re-checks
links and images — they are `#[allow(dead_code)]` with that reason, not silently absent.

## Live proof (`scripts/verify-s5-image.py`)

Real Bing bytes, only the vision model is faked (twice, statefully):

```
no-vision  -> SKIPPED_VISION_UNAVAILABLE | candidates: 3
            attempts: ['200 OK image/jpeg 20861B q="phd student funding office paperwork"', ...]
            fetched: 20861 bytes image/jpeg
vision     -> SELECTED | conf: 0.93 | candidates: 3
            reason: vision confirmed: a student desk with funding paperwork, matching the topic [vision:RELEVANT | conf=0.9]
            vision calls: 2      # candidate 1 was refused, candidate 2 accepted
```

The gate is not decorative: the fake model calls candidate 1 `IRRELEVANT conf=0.2`
and only candidate 2 is taken.

## Defect this slice found

`load_engine` falls back to the **mock** engine whenever no provider row exists. For
text stages that is the right dev behaviour. For the vision gate it was a lie: with no
vision key the mock answers `RELEVANT 0.9`, so an article would have recorded
"vision confirmed" from a fixture. `load_vision()` now returns `Option<Engine>` with no
mock fallback, and an absent vision key yields `SKIPPED_VISION_UNAVAILABLE` — an image
used unchecked, and said so.

Also fixed: the scene query was built from `qualityReport.notes` (a QC sentence) instead
of the article title. It now uses the blueprint `titleHint`, e.g.
`should first few hours phd stipend stops`.

## Full pipeline after this slice

`verify-s4.py` drives one keyword through **five** stages against a local vendor:

```
stages: blueprint, draft, revision, metadata, enrichment     all DONE
jobs: {'PARTIAL': 1}        # 5 of 6: stage 6 (validation) still to write
```

The enrichment payload is explicit when a stage cannot do its job:

```
image: BING_PROXY_ERROR (with the attempt string)   links: SKIPPED_NO_SITE_INDEX
```

## Honest gaps

- **Internal links are not implemented** — the payload says `SKIPPED_NO_SITE_INDEX`
  rather than pretending. Insert → read-back → verify is the next slice.
- Stage 6 (Final Validation / publish gate) does not exist, so jobs end `PARTIAL`.
- `INVALID_IMAGE`, `BROKEN_LINK`, `IMAGE_DRIFT_DETECTED` are declared but unreachable.
- The vision call sends an image URL, not bytes; a provider that refuses URLs (some
  gateways do) needs the base64 path, which is not written.
- Images are Bing thumbnails: they are someone else's photograph. Attribution is the
  site's problem, and the licence is not tracked.
