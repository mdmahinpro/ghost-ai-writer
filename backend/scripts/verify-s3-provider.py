#!/usr/bin/env python3
"""S3 live proof: a *custom provider* added through the API drives stages 1-2.

A tiny OpenAI-compatible server stands in for a real vendor so the HTTP adapter,
the zod-parity validators, the ledger and the worker are all exercised for real
(no mock engine, no external network, no spend).
"""
import http.server, json, os, signal, socketserver, sqlite3, subprocess, threading, time
import urllib.request

BIN = "/opt/data/projects/ghost-ai-writer/backend/target/debug/gaw-api"
DB = "/opt/data/cache/scratch/s3demo.db"
ENV = {**os.environ, "HOME": "/opt/data"}
PROVIDER_PORT = 8901
API_PORT = 8795

BLUEPRINT = {
    "intent": "informational",
    "angle": "order of operations when funding disappears",
    "titleHint": "What To Do When Your PhD Stipend Stops",
    "mustCover": [
        "the first 72 hours",
        "department bridge funding",
        "graduate school emergency grants",
        "teaching assistantship options",
        "decision timeline and escalation",
    ],
    "sections": [
        {"heading": "What should you do in the first 72 hours?", "covers": "the first 72 hours"},
        {"heading": "Which department funds can bridge the gap?", "covers": "department bridge funding"},
        {"heading": "Where do emergency grants come from?", "covers": "graduate school emergency grants"},
        {"heading": "Do teaching assistantships pay enough?", "covers": "teaching assistantship options"},
        {"heading": "When do you escalate?", "covers": "decision timeline and escalation"},
    ],
}
BODY = (
    "Ask the graduate coordinator first. Put the request in writing so the timeline is on record. "
    "Departments usually hold a small bridge pool for exactly this situation, and the graduate "
    "school keeps an emergency fund that answers within ten working days. Teaching "
    "assistantships cover tuition and a monthly stipend, but hiring runs on a semester clock. "
) * 3
DRAFT = {
    "intro": (
        "A stipend that stops without warning is a logistics problem before it is an academic one. "
        "You need to know who approves money, how long each route takes, and what to write in the "
        "email that starts it. This walks through the order that works, from the first 72 hours to "
        "the moment you escalate. Keep every answer in writing; a paper trail is what turns a "
        "verbal maybe into a payment."
    ),
    "body": BODY,
    "faq": [
        {"question": "Can a stipend be restored mid-term?", "answer": "Sometimes. Ask the graduate school in writing and cite the funding commitment letter."},
        {"question": "Is a bridge loan worth it?", "answer": "Only against a dated promise of future funding."},
    ],
    "claims": [
        {"text": "Graduate schools often hold emergency funds for this exact case.", "status": "OPINION"},
        {"text": "A written request creates a record you can escalate.", "status": "SUPPORTED"},
    ],
    "answerBlock": (
        "Email your department in writing within 72 hours, then file the graduate school's "
        "emergency request. Both routes typically answer within ten working days."
    ),
}


class Handler(http.server.BaseHTTPRequestHandler):
    def log_message(self, *a):
        pass

    def do_POST(self):
        n = int(self.headers.get("Content-Length", 0))
        req = json.loads(self.rfile.read(n) or b"{}")
        system = " ".join(m.get("content", "") for m in req.get("messages", []))
        kind = "draft" if "article body" in system else "blueprint"
        payload = DRAFT if kind == "draft" else BLUEPRINT
        body = json.dumps({
            "id": "chatcmpl-local",
            "choices": [{"index": 0, "message": {"role": "assistant", "content": json.dumps(payload)},
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
    req = urllib.request.Request(f"http://127.0.0.1:{port}{path}",
                                 data=json.dumps(payload).encode(),
                                 headers={"Content-Type": "application/json"})
    with urllib.request.urlopen(req, timeout=120) as r:
        return r.status, json.load(r)


def get_json(port, path):
    with urllib.request.urlopen(f"http://127.0.0.1:{port}{path}", timeout=30) as r:
        return json.load(r)


for suffix in ("", "-wal", "-shm"):
    if os.path.exists(DB + suffix):
        os.remove(DB + suffix)

# fake vendor
socketserver.TCPServer.allow_reuse_address = True
vendor = socketserver.TCPServer(("127.0.0.1", PROVIDER_PORT), Handler)
threading.Thread(target=vendor.serve_forever, daemon=True).start()
print(f"fake OpenAI-compatible vendor listening on :{PROVIDER_PORT}")

api = subprocess.Popen([BIN], env={**ENV, "DATABASE_URL": f"sqlite:{DB}?mode=rwc",
                                   "SEED": "1", "ROLE": "all", "PORT": str(API_PORT),
                                   "RUST_LOG": "warn"},
                       stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
assert wait_health(API_PORT), "api did not start"

# --- add a custom provider through the public API
status, created = post_json(API_PORT, "/api/v1/providers", {
    "workspace_id": 1,
    "provider": "local-vendor",
    "label": "My own endpoint",
    "api_key": "sk-test-ABCDEFGH1234",
    "kind": "openai_compatible",
    "base_url": f"http://127.0.0.1:{PROVIDER_PORT}/v1",
    "model_id": "local-test-1",
    "price_in_per_mtok": 3.0,
    "price_out_per_mtok": 15.0,
    "is_default": True,
})
print(f"POST /api/v1/providers -> {status} id={created['id']} "
      f"hint={created['provider']['key_hint']} model={created['provider']['model_id']}")
assert status == 201

listing = get_json(API_PORT, "/api/v1/providers?workspace_id=1")
raw = json.dumps(listing)
assert "sk-test-ABCDEFGH1234" not in raw, "SEGFAULT: api key leaked in list response"
assert listing["items"][0]["key_hint"] == "••••1234"
print(f"GET /api/v1/providers -> {len(listing['items'])} item(s), no key in payload, hint={listing['items'][0]['key_hint']}")

# --- queue work and let the worker run stages 1-2 against the real adapter
st, intake = post_json(API_PORT, "/api/v1/keywords", {
    "workspace_id": 1, "site_id": 1,
    "keywords": ["what to do when a phd stipend stops", "phd funding gap options"],
})
print(f"queued {intake['inserted']} jobs in {intake['elapsed_ms']} ms")

deadline = time.time() + 60
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
print("\n--- database after the worker drained the queue ---")
print("jobs:", dict(c.execute("SELECT status, COUNT(*) FROM jobs GROUP BY status").fetchall()))
print("articles:", c.execute("SELECT COUNT(*) FROM articles").fetchone()[0],
      "| titles:", [r[0] for r in c.execute("SELECT title FROM articles").fetchall()])
print("article_stages:")
for row in c.execute("SELECT article_id, idx, key, status, tokens_in, tokens_out, "
                     "ROUND(cost_usd, 6) FROM article_stages ORDER BY article_id, idx"):
    print("   ", row)
print("usage_ledger:")
for row in c.execute("SELECT stage, provider, model_id, tokens_in, tokens_out, ROUND(cost_usd,6) "
                     "FROM usage_ledger ORDER BY id"):
    print("   ", row)
print("total spend:", c.execute("SELECT ROUND(SUM(cost_usd), 6) FROM usage_ledger").fetchone()[0], "USD")

payload = c.execute("SELECT payload_json FROM article_stages WHERE idx = 2 LIMIT 1").fetchone()[0]
p = json.loads(payload)
print("\ndraft payload keys:", sorted(p.keys()))
print("lint (writing gate):", {k: v for k, v in p["lint"].items() if k in ("word_count", "score", "passed", "high_count")} if isinstance(p["lint"], dict) else p["lint"])
print("repairs used:", p.get("repairs"), "| provider:", p.get("provider"), "| model:", p.get("model"))
print("answerBlock present:", bool(p["draft"].get("answerBlock")))
c.close()

api.send_signal(signal.SIGTERM)
api.wait(timeout=15)
vendor.shutdown()
print("\nOK")
