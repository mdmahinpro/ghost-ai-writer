import { test } from "node:test";
import assert from "node:assert/strict";
import type { AiKey } from "./types.ts";
import { runWithKeyPool } from "./model-pool.ts";
import { webSearchPlan } from "./web-search-plan.ts";

function key(overrides: Partial<AiKey> = {}): AiKey {
  return {
    id: "k1",
    provider: "OpenAI",
    model: "gpt-5.6-luna",
    label: "primary",
    hint: "••••1",
    priority: 100,
    chat: true,
    semantic: false,
    allowanceUsd: 1000,
    disabled: false,
    pricePerM: 0.7,
    baseUrl: "https://api.example/v1",
    secret: "sk-test",
    ...overrides,
  };
}

test("Rule 4: auto-failover moves off a 429 primary and finishes on the backup key", async () => {
  const penalized: { id: string; status: number }[] = [];
  const outcome = await runWithKeyPool({
    keys: [key({ id: "primary" }), key({ id: "backup", priority: 50 })],
    onPenalty: (id, status) => penalized.push({ id, status }),
    call: async (k) => (k.id === "primary" ? { ok: false as const, status: 429, error: "rate limited" } : { ok: true as const, value: "written" }),
  });
  assert.equal(outcome.ok, true);
  if (outcome.ok) {
    assert.equal(outcome.value, "written");
    assert.equal(outcome.keyId, "backup");
  }
  assert.deepEqual(penalized, [{ id: "primary", status: 429 }]);
});

test("Rule 4: a 401 primary is penalized and the next key serves; all-fail returns NO_USABLE_KEY", async () => {
  const outcome = await runWithKeyPool({
    keys: [key({ id: "a" }), key({ id: "b" })],
    call: async () => ({ ok: false as const, status: 401, error: "refused" }),
  });
  assert.equal(outcome.ok, false);
  assert.match(outcome.error, /Every key in the pool failed/);
  assert.equal(outcome.attempted.length, 2);
  const empty = await runWithKeyPool({ keys: [], call: async () => ({ ok: true as const, value: 1 }) });
  assert.equal(empty.ok, false);
  assert.match(empty.error, /NO_USABLE_KEY/);
});

test("Rule 4: a key saved on the server needs no local secret to serve", async () => {
  // The regression: every server-saved key has `secret: undefined` by design, and
  // the pool used to skip those — so a perfectly good key could never generate.
  let called = 0;
  const outcome = await runWithKeyPool({
    keys: [{ ...key({ id: "server" }), secret: undefined, serverKeyId: 42 }],
    call: async () => {
      called += 1;
      return { ok: true as const, value: "generated" };
    },
  });
  assert.equal(outcome.ok, true);
  assert.equal(called, 1, "the server-saved key must actually be attempted");
  if (outcome.ok) assert.equal(outcome.keyId, "server");
});

test("Rule 4: a key with neither a server id nor a local secret is still refused", async () => {
  const outcome = await runWithKeyPool({
    keys: [key({ id: "orphan", secret: undefined })],
    call: async () => ({ ok: true as const, value: "should not run" }),
  });
  assert.equal(outcome.ok, false);
  assert.match(outcome.error, /Not saved on the server/);
});

test("Rule 4: files without a secret are skipped but do not stop the pool", async () => {
  const outcome = await runWithKeyPool({
    keys: [key({ id: "nosecret", secret: undefined }), key({ id: "ok", priority: 1 })],
    call: async () => ({ ok: true as const, value: "done" }),
  });
  assert.equal(outcome.ok, true);
  if (outcome.ok) assert.equal(outcome.keyId, "ok");
  assert.equal(outcome.attempted[0]?.keyId, "nosecret");
});

test("Rule 5: web search plan honours Off / Tavily / Firecrawl / Auto-Fallback", () => {
  assert.deepEqual(webSearchPlan("off", true, true), []);
  assert.deepEqual(webSearchPlan("tavily", true, true), ["tavily"]);
  assert.deepEqual(webSearchPlan("firecrawl", true, true), ["firecrawl"]);
  assert.deepEqual(webSearchPlan("auto-fallback", true, true), ["tavily", "firecrawl"]);
  assert.deepEqual(webSearchPlan("auto-fallback", false, true), ["firecrawl"]);
  assert.deepEqual(webSearchPlan("auto-fallback", false, false), []);
});
