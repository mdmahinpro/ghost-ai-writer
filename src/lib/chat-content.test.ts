import { test } from "node:test";
import assert from "node:assert/strict";
import { contentText } from "./chat-content.ts";

test("contentText reads a plain string content", () => {
  assert.equal(contentText({ content: "hello" }), "hello");
});

test("contentText never throws on null / undefined / missing content", () => {
  assert.equal(contentText({ content: null }), "");
  assert.equal(contentText({ content: undefined }), "");
  assert.equal(contentText({}), "");
  assert.equal(contentText(undefined), "");
  assert.equal(contentText(null), "");
});

test("contentText joins array-of-parts content (multimodal)", () => {
  assert.equal(contentText({ content: [{ type: "text", text: "a" }, { text: "b" }, "c"] }), "abc");
});

test("contentText falls back to reasoning_content then legacy text", () => {
  assert.equal(contentText({ content: null, reasoning_content: "reasoned" }), "reasoned");
  assert.equal(contentText({ content: "   ", reasoning_content: "reasoned" }), "reasoned");
  assert.equal(contentText({ content: null, text: "legacy" }), "legacy");
  assert.equal(contentText({ content: [] }), "");
});
