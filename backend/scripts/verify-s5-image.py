#!/usr/bin/env python3
"""S5 live proof — the image pipeline against the real Bing thumbnail endpoint,
plus a stateful vision gate that rejects the first candidate and accepts the second.

Nothing here is mocked except the vision model: the images are real bytes fetched
from tse1.mm.bing.net using their exact URL template.
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
import urllib.parse
import urllib.request

BIN = "target/debug/gaw-api"
DB = "/opt/data/cache/scratch/s5demo.db"
API_PORT = 8799
VISION_PORT = 8905
TOKEN = "s5-verify-token-0123456789"
ENV = {**os.environ, "GAW_ADMIN_TOKEN": TOKEN, "GAW_ENGINE": "provider"}
ENV.pop("GAW_BING_BASE", None)  # talk to the real Bing

# vision answers: reject the first image, accept the second
VISION_CALLS = {"n": 0}


class Handler(http.server.BaseHTTPRequestHandler):
    def log_message(self, *a):
        pass

    def do_POST(self):
        n = int(self.headers.get("Content-Length", 0))
        req = json.loads(self.rfile.read(n) or b"{}")
        joined = json.dumps(req)
        if "image_url" in joined:
            VISION_CALLS["n"] += 1
            first = VISION_CALLS["n"] == 1
            answer = {
                "verdict": "IRRELEVANT" if first else "RELEVANT",
                "confidence": 0.2 if first else 0.93,
                "sentence": "a generic office stock photo, unrelated to funding"
                if first
                else "a student desk with funding paperwork, matching the topic",
            }
        else:
            answer = {"ok": True}
        body = json.dumps({
            "id": "chatcmpl-vision",
            "choices": [{"index": 0,
                         "message": {"role": "assistant", "content": json.dumps(answer)},
                         "finish_reason": "stop"}],
            "usage": {"prompt_tokens": 900, "completion_tokens": 60},
        }).encode()
        self.send_response(200)
        self.send_header("Content-Type", "application/json")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)


def wait_health(port, timeout=25):
    t0 = time.time()
    while time.time() - t0 < timeout:
        try:
            urllib.request.urlopen(f"http://127.0.0.1:{port}/health", timeout=1).read()
            return True
        except Exception:
            time.sleep(0.15)
    return False


def post_json(port, path, payload, token=True):
    headers = {"Content-Type": "application/json"}
    if token:
        headers["x-api-token"] = TOKEN
    req = urllib.request.Request(f"http://127.0.0.1:{port}{path}",
                                 data=json.dumps(payload).encode(), headers=headers)
    with urllib.request.urlopen(req, timeout=120) as r:
        return r.status, json.load(r)


for suffix in ("", "-wal", "-shm"):
    if os.path.exists(DB + suffix):
        os.remove(DB + suffix)

socketserver.TCPServer.allow_reuse_address = True
vendor = socketserver.TCPServer(("127.0.0.1", VISION_PORT), Handler)
threading.Thread(target=vendor.serve_forever, daemon=True).start()

api = subprocess.Popen([BIN],
                       env={**ENV, "DATABASE_URL": f"sqlite:{DB}?mode=rwc", "SEED": "1",
                            "ROLE": "api", "PORT": str(API_PORT), "RUST_LOG": "warn"},
                       stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
if not wait_health(API_PORT):
    print("FAIL: api did not start")
    sys.exit(1)

QUERY = "phd student funding office paperwork"

# --- 1. no vision provider: image accepted, and the code says it was unchecked
status, a = post_json(API_PORT, "/api/v1/image/pick", {"query": QUERY})
img = a["image"]
print("no-vision  ->", img["code"], "| candidates:", img["candidates"])
print("            url:", (img["url"] or "")[:78])
print("            attempts:", img["attempts"][:2])
assert img["code"] == "SKIPPED_VISION_UNAVAILABLE", img["code"]
assert img["url"] and "tse1.mm.bing.net/th?q=" in img["url"], img["url"]

# the URL really resolves to image bytes
with urllib.request.urlopen(img["url"], timeout=25) as r:
    blob = r.read()
print("            fetched:", len(blob), "bytes", r.headers.get("content-type"))
assert r.headers.get("content-type", "").startswith("image/"), "not an image"
assert len(blob) > 8000, len(blob)

# --- 2. a vision provider that rejects the first candidate
status, _ = post_json(API_PORT, "/api/v1/providers", {
    "workspace_id": 1, "provider": "local-vision", "label": "vision lane",
    "api_key": "sk-vision-1234", "kind": "openai_compatible",
    "base_url": f"http://127.0.0.1:{VISION_PORT}/v1", "model_id": "vision-test-1",
    "price_in_per_mtok": 2.0, "price_out_per_mtok": 8.0,
    "is_default": True, "role": "vision",
})
assert status == 201, status

status, b = post_json(API_PORT, "/api/v1/image/pick", {"query": QUERY})
img2 = b["image"]
print("vision     ->", img2["code"], "| conf:", img2["conf"], "| candidates:", img2["candidates"])
print("            reason:", img2["reason"][:100])
print("            vision calls:", VISION_CALLS["n"])
assert img2["code"] == "SELECTED", img2
assert img2["reason"].startswith("vision confirmed:"), img2["reason"]
assert "[vision:RELEVANT | conf=0.9]" in img2["reason"], img2["reason"]
assert VISION_CALLS["n"] == 2, "the gate did not reject the first candidate"

api.send_signal(signal.SIGTERM)
api.wait(timeout=15)
vendor.shutdown()
print("\nOK")
