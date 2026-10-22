import { test } from "node:test";
import assert from "node:assert/strict";
import { contentText } from "./chat-content.ts";
import { fallbackBlueprint, parseIntentStage, parseModelStage, roboticScrub } from "./stage-contracts.ts";
import { deterministicScrub, humanizeWithBlader, humanizerScore, scanAiPatterns, type BladerChat } from "./humanizer.ts";

const DRAFT =
  "# How to pull a better shot\n\n## Grind size\n\nA finer grind raises resistance, so the pump works harder and the shot slows.\n\n## Freshness\n\nBeans rest best for a week after roast; older beans pull faster and taste flat.\n";

test("Stage 1 + Stage 2 parsing never throws a .trim() TypeError on empty content", () => {
  const empty = contentText({ content: null });
  assert.equal(empty, "");
  assert.throws(() => parseIntentStage(empty), /not valid JSON/);
  assert.throws(() => parseModelStage("draft", empty), /not valid JSON/);
  assert.throws(() => parseModelStage("revision", undefined), /not valid JSON/);
});

test("Stage 3 revision parsing + scrub tolerate null / undefined / array content", () => {
  assert.doesNotThrow(() => roboticScrub(contentText({ content: undefined }), [null, undefined, "delve"]));
  assert.equal(roboticScrub(contentText({ content: null })).markdown, "");
  assert.doesNotThrow(() => deterministicScrub(contentText({ content: null })));
  assert.doesNotThrow(() => humanizerScore(contentText({ content: null })));
  assert.doesNotThrow(() => scanAiPatterns(undefined));
  assert.equal(scanAiPatterns(undefined).length, 0);
  assert.equal(contentText({ content: [{ text: '{"markdown":"ok"}' }] }), '{"markdown":"ok"}');
});

test("fallbackBlueprint tolerates a missing keyword and title", () => {
  const bp = fallbackBlueprint({ keyword: undefined as unknown as string, title: undefined as unknown as string });
  assert.ok(bp.answerBlock.length > 0);
  assert.ok(!bp.answerBlock.includes("undefined"));
});

test("humanizeWithBlader never crashes when the model pass returns empty text or fails", async () => {
  const emptyChat: BladerChat = async () => ({ ok: true, text: undefined as unknown as string, keyId: "k" });
  const out = await humanizeWithBlader({ markdown: DRAFT, chat: emptyChat });
  assert.equal(typeof out.markdown, "string");
  assert.ok(out.markdown.length > 0);
  assert.ok(out.passes >= 1);

  const emptyArrayChat: BladerChat = async () => ({ ok: true, text: "" as string, keyId: "k" });
  const out2 = await humanizeWithBlader({ markdown: DRAFT, chat: emptyArrayChat });
  assert.ok(out2.markdown.length > 0);

  const failedChat: BladerChat = async () => ({ ok: false, error: "Network error — The operation was aborted due to timeout" });
  const out3 = await humanizeWithBlader({ markdown: DRAFT, chat: failedChat });
  assert.ok(out3.markdown.length > 0);
  assert.ok(out3.passes >= 1);
});
