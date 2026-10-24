import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  getAdminToken,
  hasAdminToken,
  isTokenRejected,
  setAdminToken,
} from "./api-client.ts";

test("no token is held until one is supplied", () => {
  // Node has no sessionStorage, which is also the server-render case.
  assert.equal(getAdminToken(), "");
  assert.equal(hasAdminToken(), false);
  assert.equal(isTokenRejected(), false);
});

test("a supplied token is trimmed and remembered in memory", () => {
  setAdminToken("  rw-secret-value  ");
  assert.equal(getAdminToken(), "rw-secret-value");
  assert.equal(hasAdminToken(), true);
});

test("clearing the token forgets it", () => {
  setAdminToken("");
  assert.equal(getAdminToken(), "");
  assert.equal(hasAdminToken(), false);
});

test("the token is never read from the build environment", () => {
  // A `VITE_*` value is inlined into the JS bundle, which would hand the
  // credential to anyone who loads the page. This test exists so that
  // convenience cannot quietly reintroduce it.
  const source = readFileSync(new URL("./api-client.ts", import.meta.url), "utf8");
  assert.equal(
    source.includes("VITE_GAW_ADMIN_TOKEN"),
    false,
    "api-client must not read the token from import.meta.env",
  );
  assert.ok(
    source.includes("sessionStorage"),
    "the token must be held in sessionStorage",
  );
});
