# S2 verification — lease-based worker, resumable stages, heartbeat

Host: Linux x86_64, rustc 1.99.1, SQLite (bundled), no Docker/sudo/Postgres.
`cargo build` clean, **zero warnings**; `cargo test` **23/23 pass** in 0.85 s.

## Why a server-side worker at all

Their `/api/config` reports `worker: { alive, lastTickAt }`, and their run page keeps
advancing with the browser tab closed. Ours has to do the same: the job lives in the
queue, not in a React effect.

## What was built

`backend/api/src/worker.rs` (511 lines) + `backend/migrations/0003_worker.sql`:

| piece | contract |
|---|---|
| `claim(pool, worker, lease_secs)` | picks the oldest claimable job, sets `status=RUNNING`, `locked_by`, `lease_until`, `attempts+1`; emits event `CLAIMED` |
| claimable predicate | `status IN ('QUEUED','pending','RETRY')` **or** `status='RUNNING' AND lease_until <= now`, and `not_before` passed |
| `renew_lease` | extends the lease only while `locked_by` still matches; emits `LEASE_RENEWED` |
| `stage_transaction` | renames the lease **and** advances `stage_index` in one transaction |
| `fail(job, reason)` | `attempts < 3` → `RETRY` with `not_before = now + 30 s × 2^(n-1)`; else `FAILED` + `last_error` |
| `heartbeat` | upsert into `worker_heartbeats` (`last_tick_at`, `jobs_done`, `version`) |
| `process_claim` | walks stages from the **saved** `stage_index`; a lost lease aborts without writing; a stage error routes to `fail` |
| restart | `ROLE=api \| worker \| all` (default `all`) |
| routes | `GET /api/v1/worker` → `{workers:[{worker_id, last_tick_at, alive, jobs_done}]}`, `POST /api/v1/worker/run-once` |

`alive` mirrors their field: `last_tick_at` within 30 s.

## Live proof: worker killed mid-queue, another resumes

`backend/scripts/verify-s2.py` (real processes, real SIGKILL, no mocks):

```
queued 2000 jobs in 60 ms
marked 5 jobs as crashed mid-article (stage_index=3, expired lease) on [1,2,3,4,5]
before worker start: QUEUED=1995 RUNNING(stale)=5
after hard kill: {'COMPLETED': 180, 'QUEUED': 1820}
jobs still outstanding while no worker runs: 1820
second worker drained 2000/2000 jobs in 4.5s (441 jobs/s, 6 stages each)
final statuses: {'COMPLETED': 2000}
```

Per-worker attribution from `worker_heartbeats`: `worker-253308: 180`, `worker-253318: 1820`.
Event ledger: `CLAIMED 1995`, `LEASE_EXPIRED 5`, `STAGE_DONE 11985`, `COMPLETED 2000`
— 11,985 stage writes for 2,000 jobs = 6 stages minus the 15 the crashed run had already
banked, which is exactly the "don't re-run, don't re-charge" property.

The five crashed jobs resumed at stage 3 and finished all six stages:

```
(1, 'worker-253308', 'LEASE_EXPIRED', 3) ... (1, 'worker-253308', 'COMPLETED', 6)
STAGE_DONE counts (3 before crash + 3 after = 6): [(1, 3), (2, 3), (3, 3), (4, 3), (5, 3)]
```

## Two real defects found by running it, both fixed

1. **Dead-worker jobs were unreclaimable.** The first claim query only accepted
   `QUEUED/pending/RETRY`; a crash leaves `status='RUNNING'` with a dead lease, so those
   jobs would have been stranded forever. The predicate now includes expired `RUNNING`
   leases and tags the reclaim `LEASE_EXPIRED`.
2. **11 jobs/s.** Each stage wrote the lease, the progress row and the event as three
   separate autocommitted statements — one fsync each. Fixed with `journal_mode=WAL`,
   `synchronous=NORMAL`, `busy_timeout=10s` on the pool and one transaction per stage:
   **441 jobs/s, 40× faster**, with the same durability story.

The failure path was also dead code (nothing called `fail`); a stage error now routes
through it, so a poisoned job retries with backoff and then stops instead of looping.

## Tests (9 new, 23 total)

`claim_locks_and_two_workers_never_share_a_job`,
`expired_lease_is_reclaimed_and_resumes_from_saved_stage`,
`concurrent_workers_do_not_double_process` (two tasks × 50 claims, every job id seen once),
`failure_backs_off_then_stops_at_max_attempts`, `retry_is_not_claimable_before_its_backoff`,
`renew_lease_extends_ownership_for_long_stages`, `heartbeat_accumulates_jobs_done`,
`run_once_processes_one_job_and_reports_none_when_drained`,
`iso_format_is_sortable_and_correct`.

## Honest gaps

- Stage bodies are no-ops until S3; these numbers measure queue mechanics, not generation.
- SQLite by design for dev. The claim query uses `UPDATE ... WHERE lease_until <= ?` with
  ISO strings — portable to Postgres as `FOR UPDATE SKIP LOCKED` when the driver is swapped,
  but **that swap is not written or tested here** (no Postgres on this host).
- Default lease 90 s; a stuck `RUNNING` job therefore waits up to 90 s before another worker
  takes it. Acceptable now, must become `lease_secs` env-driven when real stages land.
