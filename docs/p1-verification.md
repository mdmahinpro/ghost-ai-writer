# P1 verification — Rust API vertical slice (2026-10-22)

Host: Linux x86_64, rustc/cargo 1.99.1, Node 24.20.0. No Docker, no sudo, no system Postgres.
Command: `bash verify-api.sh` (tests → boot → intake → paging).

## Results (all observed, nothing estimated)

| Check | Result |
|---|---|
| `cargo test` | **4 / 4 pass** (six tables created, keyset walk over 10k rows, 10k intake in one transaction, limit clamp) |
| `GET /health` | 200 · **0.5 ms** |
| `GET /api/v1/workspaces?limit=3` | 200 · `next_cursor: 3`, `total: 10000` |
| `GET /api/v1/jobs?limit=200&cursor=9000` | **median 4.3 ms · p95 5.8 ms · max 6.8 ms** over 20k rows |
| `POST /api/v1/keywords` (10,000 keywords) | **201 · inserted 10000 · server 211 ms · client 227 ms** |
| Same intake, immediately again (write path under load) | **201 · server 312 ms · client 328 ms** |
| SQLite file after 20k jobs | 2.8 MB |

## Why this matters against the spec

- **Rule 1 (10k scale)** is now proven with numbers: 10,000 keywords accepted in a single transaction, **no cap**, 211–312 ms. The browser implementation could only prove 10k *intake into a queue*; this is 10k *rows durably committed*.
- **Rule 1 acceptance** still needs generation, not just intake — that is P2 (worker + stages).
- Keyset pagination at 5.8 ms p95 kills the reason the UI renders everything client-side: the list can now be served in pages.

## Storage decision (documented, not hidden)

No Postgres server is installable here (no Docker daemon, no sudo). SQLite with the **bundled** driver compiles from source, so the slice is verifiable today. The migration file and SQL are kept portable; `sqlx` swaps to the Postgres driver by changing the pool URL. **Postgres parity must be verified on a host that has it before P3 sign-off.**

## What is NOT done in P1

- No auth/tenancy enforcement yet (P4) — endpoints are unscoped.
- In-memory seeding only; no real import from the browser blob.
- OpenAPI generation (`utoipa`) not wired yet, so no generated TS client.
- No worker process yet (P2).

## Reproduce

```
cd backend
DATABASE_URL="sqlite:/tmp/gaw-test.db?mode=rwc" SEED=1 PORT=8788 ./target/debug/gaw-api
curl -s "http://127.0.0.1:8788/api/v1/jobs?limit=200&cursor=9000"
python3 <intake 10k payload>
```
