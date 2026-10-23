#!/usr/bin/env python3
"""S4 live proof: stages 3 (Quality & Coverage Revision) and 4 (Metadata & Packaging)
run against a *stateful* fake vendor that deliberately omits a mustCover item on its
first answer — so the coverage gate has to reject it and drive a real repair.
"""
import json
import os
import signal
import socketserver
import sqlite3
import subprocess
import sys
import threading
import time
import http.server
import urllib.request

BIN = "target/debug/gaw-api"
DB = "/opt/data/cache/scratch/s4demo.db"
API_PORT = 8797
PROVIDER_PORT = 8903
ENV = {**os.environ, "GAW_ENGINE": "provider"}
ENV.setdefault("GAW_BING_BASE", "http://127.0.0.1:9")  # deterministic stage 5

MUST_COVER = [
    "the first 72 hours",
    "department bridge funding",
    "graduate school emergency grants",
    "teaching assistantship options",
    "decision timeline and escalation",
]

BLUEPRINT = {
    "intent": "informational",
    "angle": "order of operations when funding disappears",
    "titleHint": "What To Do When Your PhD Stipend Stops",
    "mustCover": MUST_COVER,
    "sections": [
        {"heading": "What should you do in the first 72 hours?", "covers": MUST_COVER[0]},
        {"heading": "Which department funds can bridge the gap?", "covers": MUST_COVER[1]},
        {"heading": "Where do emergency grants come from?", "covers": MUST_COVER[2]},
        {"heading": "Do teaching assistantships pay enough?", "covers": MUST_COVER[3]},
        {"heading": "When do you escalate?", "covers": MUST_COVER[4]},
    ],
}

DRAFT = {
    "intro": (
        "A stipend that stops without warning is a logistics problem before it is an academic "
        "one. You need to know who approves money, how long each route takes, and what to write "
        "in the email that starts it. This walks through the order that works, and keeps every "
        "answer in writing so a verbal maybe becomes a payment."
    ),
    "body": (
        "Ask the graduate coordinator first and put it in writing the same day. Departments hold "
        "a small bridge pool for this situation. The graduate school keeps an emergency fund that "
        "answers in ten working days. Keep a timeline of every request so escalation has dates.\n"
    ) * 3,
    "faq": [{"question": "Can a stipend be restored mid-term?",
             "answer": "Sometimes. Ask in writing and cite the funding commitment letter."}],
    "claims": [{"text": "A written request creates a record you can escalate.", "status": "SUPPORTED"}],
    "answerBlock": (
        "Email your department in writing within the first 72 hours, then file the graduate "
        "school emergency request. Both routes usually answer within ten working days."
    ),
}

# Covers 3 of 5 -> coverage 0.60, below the 0.80 gate. This must be rejected.
REVISION_PARTIAL = {
    "intro": (
        "A stipend that stops without warning is a logistics problem first. You need to know who "
        "approves money, which route answers fastest, and what to put in writing. The order below "
        "gets a real answer instead of a sympathetic conversation about the first 72 hours."
    ),
    "body": (
        "## What should you do in the first few hours?\n"
        "Ask the person who signs off on money, in writing, on the same day. The first 72 hours "
        "matter because funding queues are real queues.\n\n"
        "## Which department funds can bridge a gap?\n"
        "A department bridge funding pool exists for exactly this case and is the fastest yes.\n\n"
        "## Where do emergency grants come from?\n"
        "Graduate school emergency grants sit with the graduate school office. One form covers "
        "several of them.\n\n"
        "## When do you escalate?\n"
        "Escalate when the decision timeline passes ten working days without an answer. Keep the "
        "dates in writing so the escalation has a record behind it.\n"
    ),
    "faq": [{"question": "Is a bridge loan worth it?",
             "answer": "Only against a dated promise of future funding."}],
    "claims": [{"text": "A written request creates a record you can escalate.", "status": "SUPPORTED"}],
    "answerBlock": (
        "Ask your department in writing on the same day, then file the graduate school emergency "
        "request. Both routes usually answer within ten working days."
    ),
    "qualityReport": {"intentMatch": 0.91, "coverage": 0.99, "repetition": 0.1,
                      "unsupportedClaims": [], "notes": "Claims full coverage."},
    "critique": {"unnaturalTransitions": [], "formattingIssues": [], "genericFiller": [],
                 "revisionNeeded": False},
}

# Covers all 5 -> accepted.
REVISION_FULL = json.loads(json.dumps(REVISION_PARTIAL))
REVISION_FULL["body"] += (
    "\n## How do teaching assistantships fit in?\n"
    "Teaching assistantship options are posted as openings, not gifts, so apply to the posted "
    "slot and tell the department you can start next term. That keeps the decision timeline "
    "moving while the escalation request is pending.\n"
)

METADATA = {
    "title": "When A PhD Stipend Stops: The Order That Works",
    "metaDescription": (
        "A stipend can stop mid-term with no warning. Here is the order that actually moves "
        "money: department bridge, graduate school emergency grant, then a teaching slot."
    ),
    "excerpt": (
        "Who to ask first, what to put in writing, and how long each funding route really takes "
        "when a stipend stops."
    ),
    "tags": ["phd funding", "stipend", "emergency grants", "graduate school"],
    "slug": "when-a-phd-stipend-stops",
}

CALLS = {"blueprint": 0, "draft": 0, "revision": 0, "metadata": 0}
REJECTED = {"n": 0}


class Handler(http.server.BaseHTTPRequestHandler):
    def log_message(self, *a):
        pass

    def do_POST(self):
        n = int(self.headers.get("Content-Length", 0))
        req = json.loads(self.rfile.read(n) or b"{}")
        system = " ".join(m.get("content", "") for m in req.get("messages", []))
        user = " ".join(
            m.get("content", "")
            for m in req.get("messages", [])
            if m.get("role") == "user"
        )
        if "You plan articles" in system:
            kind, payload = "blueprint", BLUEPRINT
        elif "You write the article body" in system:
            kind, payload = "draft", DRAFT
        elif "You check whether an image fits a topic" in system:
            kind = "vision"
            payload = {"verdict": "RELEVANT", "confidence": 0.91,
                       "sentence": "a desk with funding paperwork, matching the topic"}
        elif "You revise an article draft" in system:
            kind = "revision"
            # First answer skips a mustCover item; the repair prompt says so.
            if "was rejected by validation" in user:
                REJECTED["n"] += 1
                payload = REVISION_FULL
            else:
                payload = REVISION_PARTIAL
        else:
            kind, payload = "metadata", METADATA
        CALLS[kind] += 1
        body = json.dumps({
            "id": "chatcmpl-local",
            "choices": [{"index": 0,
                         "message": {"role": "assistant", "content": json.dumps(payload)},
                         "finish_reason": "stop"}],
            "usage": {"prompt_tokens": 1200, "completion_tokens": 800},
        }).encode()
        self.send_response(200)
        self.send_header("Content-Type", "application/json")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)


def wait_health(port, timeout=20):
    t0 = time.time()
    while time.time() - t0 < timeout:
        try:
            urllib.request.urlopen(f"http://127.0.0.1:{port}/health", timeout=1).read()
            return True
        except Exception:
            time.sleep(0.15)
    return False


def post_json(port, path, payload):
    req = urllib.request.Request(
        f"http://127.0.0.1:{port}{path}",
        data=json.dumps(payload).encode(),
        headers={"Content-Type": "application/json"},
    )
    with urllib.request.urlopen(req, timeout=120) as r:
        return r.status, json.load(r)


for suffix in ("", "-wal", "-shm"):
    if os.path.exists(DB + suffix):
        os.remove(DB + suffix)

socketserver.TCPServer.allow_reuse_address = True
vendor = socketserver.TCPServer(("127.0.0.1", PROVIDER_PORT), Handler)
threading.Thread(target=vendor.serve_forever, daemon=True).start()

api = subprocess.Popen(
    [BIN],
    env={**ENV, "DATABASE_URL": f"sqlite:{DB}?mode=rwc", "SEED": "1", "ROLE": "all",
         "PORT": str(API_PORT), "RUST_LOG": "warn"},
    stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL,
)
if not wait_health(API_PORT):
    print("FAIL: api did not start")
    sys.exit(1)

status, created = post_json(API_PORT, "/api/v1/providers", {
    "workspace_id": 1, "provider": "local-vendor", "label": "My own endpoint",
    "api_key": "sk-local-1234", "kind": "openai_compatible",
    "base_url": f"http://127.0.0.1:{PROVIDER_PORT}/v1", "model_id": "local-test-1",
    "price_in_per_mtok": 3.0, "price_out_per_mtok": 15.0, "is_default": True,
})
assert status == 201, status

st, intake = post_json(API_PORT, "/api/v1/keywords", {
    "workspace_id": 1, "site_id": 1,
    "keywords": ["what to do when a phd stipend stops"],
})
print(f"queued {intake['inserted']} job")

deadline = time.time() + 90
while time.time() < deadline:
    c = sqlite3.connect(DB)
    done, total = c.execute(
        "SELECT COUNT(*) FILTER (WHERE status IN ('COMPLETED','PARTIAL','FAILED')), COUNT(*) FROM jobs"
    ).fetchone()
    c.close()
    if done == total:
        break
    time.sleep(0.2)

c = sqlite3.connect(DB)
print("jobs:", dict(c.execute("SELECT status, COUNT(*) FROM jobs GROUP BY status").fetchall()))
print("stages:", c.execute("SELECT GROUP_CONCAT(key, ',') FROM (SELECT key FROM article_stages ORDER BY idx)").fetchone()[0])
for row in c.execute("SELECT idx, key, status, ROUND(cost_usd,4) FROM article_stages ORDER BY idx"):
    print("   ", row)
print("ledger:", c.execute("SELECT GROUP_CONCAT(stage, ',') FROM (SELECT stage FROM usage_ledger ORDER BY id)").fetchone()[0])
print("spend:", c.execute("SELECT ROUND(SUM(cost_usd),4) FROM usage_ledger").fetchone()[0], "USD")

rev_payload = json.loads(c.execute("SELECT payload_json FROM article_stages WHERE idx = 3").fetchone()[0])
print("\nrevision stage:")
print("   computed:", rev_payload["computed"])
print("   model self-report:", rev_payload["qualityReport"]["coverage"], "coverage")
print("   repairs:", rev_payload["repairs"])
print("   lint_before.passed:", rev_payload["lint_before"]["passed"],
      "| lint_after.passed:", rev_payload["lint_after"]["passed"])

meta_payload = json.loads(c.execute("SELECT payload_json FROM article_stages WHERE idx = 4").fetchone()[0])
print("metadata stage:")
print("   slug:", meta_payload["slug"], "| tags:", len(meta_payload["metadata"]["tags"]),
      "| metaDescription chars:", len(meta_payload["metadata"]["metaDescription"]))
art = c.execute("SELECT status, slug, coverage_score, intent_match, meta_json FROM articles").fetchone()
print("article row: status=%s slug=%s coverage=%s intent=%s" % art[:4])

print("\nvendor calls:", CALLS, "| repairs driven:", REJECTED["n"])

assert REJECTED["n"] == 1, "the coverage gate did not reject the partial answer"
assert CALLS["revision"] == 2, f"expected 2 revision calls, got {CALLS['revision']}"
assert CALLS["metadata"] == 1, "metadata stage did not run exactly once"
assert rev_payload["computed"]["coverage"] == 1.0, rev_payload["computed"]
assert rev_payload["computed"]["passes"] == 1, rev_payload["computed"]
assert rev_payload["repairs"] == 1, rev_payload["repairs"]
assert rev_payload["lint_after"]["passed"] is True, rev_payload["lint_after"]
assert art[0] == "REVIEW_HELD", art[0]

api.send_signal(signal.SIGTERM)
api.wait(timeout=15)
vendor.shutdown()
print("\nOK")
