# S3 verification — custom providers, stages 1–2, the writing gate

Host: Linux x86_64, rustc 1.99.1, SQLite (WAL). `cargo build` clean, **zero warnings**;
`cargo test` **33/33 pass** in 1.03 s.

## Providers are rows, not code

`backend/api/src/provider.rs` + `0004_providers.sql`. `ai_keys` became a full provider
record, so adding a provider is a data operation:

| column | purpose |
|---|---|
| `provider`, `kind` | vendor label; `openai_compatible` is the only wire protocol needed |
| `base_url`, `model_id` | any OpenAI-compatible endpoint: OpenAI, OpenRouter, Groq, DeepSeek, Together, vLLM, Ollama, a gateway |
| `price_in_per_mtok`, `price_out_per_mtok` | spend is computed from these, not from a vendor table |
| `role` | `text` \| `vision` \| `lint` — the vision gate may use a different key |
| `is_default`, `priority` | selection order |
| `key_enc`, `key_hint` | the key is stored to be used, never returned; the API shows `••••1234` only |
| `daily_allowance` | `NULL` = unlimited (owner directive) |

Routes: `POST /api/v1/providers` (201 + provider view, no key), `GET /api/v1/providers`.
No cap on how many a workspace adds. `GAW_ENGINE=mock` forces the deterministic dev
engine; with no provider configured the system still runs end to end instead of failing.

## Stages 1–2, pinned to the recovered contracts

`backend/api/src/stages.rs`:

* **Blueprint** — `mustCover` 3–10, `sections` 1–12, non-empty `titleHint`.
* **Draft** — `intro` 100–4000 chars, `body` 200–9000, `faq` ≤ 8, `claims[].status ∈
  {SUPPORTED, UNSUPPORTED, OPINION}`, optional `answerBlock` 80–600 (our addition).
* Out-of-bounds answers are **rejected, not clamped** — one repair round with the
  failure text fed back, then the stage fails and the job backs off.
* 429/5xx are retried inside the stage instead of spending the job's attempts.
* Every stage writes `article_stages` (payload + tokens + cost) and `usage_ledger`
  in one transaction; the draft also carries the humanizer `lint` report.
* `repairs` is recorded honestly (`attempts - 1`), so 0 means no repair happened.

`IMPLEMENTED_STAGES = 2`: a job that finishes the implemented stages is marked
**PARTIAL**, never COMPLETED. Completed-but-half-done jobs would be a lie the UI renders.

## Live proof (`backend/scripts/verify-s3-provider.py`)

A local OpenAI-compatible server stands in for a vendor, so the HTTP adapter, the
validators, the ledger and the worker all run for real — no mock engine, no network,
no spend:

```
POST /api/v1/providers -> 201 id=1 hint=••••1234 model=local-test-1
GET  /api/v1/providers -> 1 item(s), no key in payload, hint=••••1234
queued 2 jobs in 1 ms
jobs: {'PARTIAL': 2}
articles: 2 | titles: ['What To Do When Your PhD Stipend Stops', ...]
article_stages:
    (1, 1, 'blueprint', 'DONE', 1200, 800, 0.0156)
    (1, 2, 'draft',     'DONE', 1200, 800, 0.0156)
    (2, 1, 'blueprint', 'DONE', 1200, 800, 0.0156)
    (2, 2, 'draft',     'DONE', 1200, 800, 0.0156)
usage_ledger: 4 rows, provider=local-vendor model=local-test-1
total spend: 0.0624 USD      # 4 x (1200 in @ $3/Mtok + 800 out @ $15/Mtok) = 4 x 0.0156
draft payload keys: ['draft', 'lint', 'model', 'provider', 'repairs']
lint (writing gate): {'passed': True}; repairs used: 0; answerBlock present: True
```

The price maths is asserted implicitly: 1200 × $3/1M + 800 × $15/1M = $0.0156 exactly,
which is what the ledger holds — the cost model is real, not a placeholder.

## Three defects found by running it, all fixed

1. **`repairs` reported 1 when zero repairs happened** — it was returning `attempts`,
   not `attempts - 1`. Fixed in both stage runners; the live run now says 0.
2. **Jobs were marked COMPLETED with 2 of 6 stages implemented.** Now `PARTIAL` with
   `last_error = "stages 1-2 done; 2 of 6 stages implemented"` and a `PARTIAL` event.
3. **Stage re-entry after a crash doubled charges and then hit a UNIQUE constraint.**
   A SIGKILL between `record_stage` and `stage_transaction` left rows written but
   `stage_index` unadvanced; the retry re-ran the stage, tripped
   `UNIQUE(article_id, idx)`, and would have looped to FAILED. Two fixes:
   `stage_done()` skips stages that already committed (**never re-run, never
   re-charged**), and `record_stage` upserts instead of inserting.
   This surfaced as one `RETRY` job in a 2,000-job crash run.

   Fixing that introduced an **off-by-one**: `stage_index` is 0-based while
   `article_stages.idx` is 1-based, so the guard skipped the *draft* and re-ran the
   blueprint. The test passed anyway because the upsert hid the duplicate; the live
   run caught it (2 ledger rows for 2 jobs instead of 4). The test now asserts the
   exact stage rows `[(1,'blueprint'), (2,'draft')]` and that the draft row is DONE.

## Queue behaviour after the stage work landed

`verify-s2.py` (2,000 jobs, worker SIGKILLed mid-queue, second worker resumes):
`{'PARTIAL': 2000}`, zero retries, five crashed jobs reclaimed via `LEASE_EXPIRED`.
Drain rate 22–222 jobs/s across runs — each job now makes 2 provider calls and writes
5 rows per stage, so this measures the DB path, not the queue.

## Honest gaps

- Stages 3–6 (Quality & Coverage Revision, Metadata & Packaging, Site Enrichment,
  Final Validation) are not implemented; jobs stop at PARTIAL by design.
- API keys are stored as given (`key_enc`) and never returned, but **not encrypted at
  rest yet** — that needs a KMS/env secret before this carries real customer keys.
- `POST /api/v1/providers` is unauthenticated, as are all routes: auth/tenancy is P4.
- Only tested against SQLite. The provider adapter is transport-only, so Postgres
  parity is a driver swap, but it is unverified here (no Postgres on this host).
