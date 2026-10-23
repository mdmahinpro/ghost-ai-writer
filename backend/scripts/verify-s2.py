#!/usr/bin/env python3
"""S2 live proof: a worker process dies mid-queue, another resumes without
re-running finished stages and without losing jobs."""
import json, os, signal, sqlite3, subprocess, time, urllib.request

BIN = "/opt/data/projects/ghost-ai-writer/backend/target/debug/gaw-api"
DB = "/opt/data/cache/scratch/s2demo.db"
ENV = {**os.environ, "HOME": "/opt/data"}

def wait_health(port, timeout=20):
    t0 = time.time()
    while time.time() - t0 < timeout:
        try:
            urllib.request.urlopen(f"http://127.0.0.1:{port}/health", timeout=1).read()
            return True
        except Exception:
            time.sleep(0.15)
    return False

def post(port, path, payload):
    req = urllib.request.Request(f"http://127.0.0.1:{port}{path}",
                                 data=json.dumps(payload).encode(),
                                 headers={"Content-Type": "application/json"})
    return json.load(urllib.request.urlopen(req, timeout=120))

def q(sql, args=()):
    c = sqlite3.connect(DB, timeout=10)
    try:
        return c.execute(sql, args).fetchall()
    finally:
        c.close()

if os.path.exists(DB):
    os.remove(DB)

# ---- phase A: API only, queue the work
api = subprocess.Popen([BIN], env={**ENV, "DATABASE_URL": f"sqlite:{DB}?mode=rwc",
                                   "SEED": "1", "ROLE": "api", "PORT": "8791"},
                       stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
assert wait_health(8791), "api did not start"

kws = [f"what to do when a phd stipend stops {i}" for i in range(2000)]
t0 = time.time()
r = post(8791, "/api/v1/keywords", {"workspace_id": 1, "site_id": 1, "keywords": kws})
print(f"queued {r['inserted']} jobs in {r['elapsed_ms']} ms")

# simulate a worker that crashed mid-article: 5 jobs left RUNNING with dead leases
q_conn = sqlite3.connect(DB)
ids = [row[0] for row in q_conn.execute("SELECT id FROM jobs ORDER BY id LIMIT 5")]
for jid in ids:
    q_conn.execute(
        "UPDATE jobs SET status='RUNNING', locked_by='dead-worker', attempts=1, "
        "lease_until='2000-01-01T00:00:00Z', stage_index=3, stage='metadata' WHERE id=?", (jid,))
q_conn.commit()
q_conn.close()
print(f"marked {len(ids)} jobs as crashed mid-article (stage_index=3, expired lease) on {ids}")

queued = q("SELECT COUNT(*) FROM jobs WHERE status='QUEUED'")[0][0]
print(f"before worker start: QUEUED={queued} RUNNING(stale)={len(ids)}")

# ---- phase B: worker drains, then is killed hard mid-flight
worker = subprocess.Popen([BIN], env={**ENV, "DATABASE_URL": f"sqlite:{DB}?mode=rwc",
                                      "ROLE": "worker", "PORT": "8792"},
                          stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
assert wait_health(8792), "worker did not start"
time.sleep(0.35)                     # let it get going
worker.send_signal(signal.SIGKILL)   # no graceful shutdown: leases are left behind
worker.wait()
mid = q("SELECT status, COUNT(*) FROM jobs GROUP BY status")
print("after hard kill:", dict(mid))

# no worker is running now; nothing can progress until one comes back
time.sleep(0.4)
stalled = q("SELECT COUNT(*) FROM jobs WHERE status IN ('QUEUED','RUNNING')")[0][0]
print(f"jobs still outstanding while no worker runs: {stalled}")

# ---- phase C: a second worker takes over
worker2 = subprocess.Popen([BIN], env={**ENV, "DATABASE_URL": f"sqlite:{DB}?mode=rwc",
                                       "ROLE": "worker", "PORT": "8793"},
                           stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
assert wait_health(8793), "worker2 did not start"
t_resume = time.time()

deadline = time.time() + 120
while time.time() < deadline:
    done, total = q("SELECT COUNT(*), (SELECT COUNT(*) FROM jobs) FROM jobs "
                    "WHERE status IN ('COMPLETED','PARTIAL')")[0]
    if done == total:
        break
    time.sleep(0.25)
drain = time.time() - t_resume
print(f"\nsecond worker drained {done}/{total} jobs in {drain:.1f}s "
      f"({done / max(drain, 0.001):.0f} jobs/s, 6 stages each)")

elapsed = round(time.time() - t0, 2)
final = dict(q("SELECT status, COUNT(*) FROM jobs GROUP BY status"))
print(f"\nfinal statuses: {final}  (total wall {elapsed}s incl. queueing + restart)")

resumed = q("""SELECT job_id, worker_id, kind, stage_index FROM job_events
               WHERE job_id IN (?,?,?,?,?) AND kind IN ('LEASE_EXPIRED','COMPLETED')
               ORDER BY job_id, id""", tuple(ids))
print("\nrecovery events for the crashed jobs:")
for row in resumed:
    print("  ", row)

stages_after_resume = q("""SELECT job_id, COUNT(*) FROM job_events
                           WHERE kind='STAGE_DONE' AND job_id IN (?,?,?,?,?) GROUP BY job_id""",
                        tuple(ids))
print("STAGE_DONE counts for the crashed jobs (all six stages implemented):", stages_after_resume)

for p in (api, worker2):
    p.send_signal(signal.SIGTERM)
    p.wait(timeout=10)
