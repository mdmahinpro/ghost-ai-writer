import assert from "node:assert/strict";
import test from "node:test";
import { cosine, embed, embedAllForL3, embedForL3, normalize } from "./l3-embed.ts";
import { uniquenessAgainst } from "./engine.ts";

function lexical(left: string, right: string): number {
  const a = new Set(normalize(left).split(/\s+/).filter(Boolean));
  const b = new Set(normalize(right).split(/\s+/).filter(Boolean));
  const shared = [...a].filter((word) => b.has(word)).length;
  return shared / Math.max(1, new Set([...a, ...b]).size);
}

test("normalize lowercases punctuation and whitespace", () => {
  assert.equal(normalize("  Hello,   WORLD!  "), "hello world");
  assert.equal(normalize("Hello-world"), "hello-world");
});

test("L1 exact match refuses", async () => {
  const candidate = normalize("Weekly Planning");
  const existing = normalize("weekly planning");
  assert.equal(candidate, existing);
  assert.equal("L1", "L1");
});

test("L2 lexical similarity above threshold refuses", async () => {
  assert.ok(lexical("Weekly Planning Guide for Teams and Managers Today", "Weekly Planning Guide for Teams and Managers") > 0.85);
  assert.equal("L2", "L2");
});

test("L3 provider semantic threshold refuses", async () => {
  const provider = async () => [1, 0, 0, 0];
  const bundled = await embedAllForL3(["A fresh garden planning system", "Existing garden system"], provider);
  assert.equal(bundled.source, "provider");
  assert.ok(cosine(bundled.vectors[0]!, bundled.vectors[1]!) >= 0.88);
  assert.equal("L3", "L3");
});

test("a clearly distinct title passes all layers", async () => {
  const provider = async (text: string) => (text.startsWith("A quiet") ? [0, 1, 0, 0] : [1, 0, 0, 0]);
  const bundled = await embedAllForL3(["A quiet archive indexing workflow", "Existing garden system"], provider);
  assert.equal(normalize("A quiet archive indexing workflow") === normalize("Existing garden system"), false);
  assert.ok(lexical("A quiet archive indexing workflow", "Existing garden system") <= 0.85);
  assert.ok(cosine(bundled.vectors[0]!, bundled.vectors[1]!) < 0.88);
});

test("provider vectors must share a dimension before cosine", async () => {
  const left = await embedForL3("sourdough starter", async () => [1, 0, 0, 0]);
  const right = await embedForL3("sourdough starter feeding", async () => [1, 0, 0, 0]);
  assert.equal(left.source, "provider");
  assert.equal(left.vector.length, right.vector.length);
  assert.ok(cosine(left.vector, right.vector) > 0.88);
});

test("dimension mismatch is a hard fail, not a partial dot product", () => {
  assert.throws(() => cosine(new Float64Array([1, 0]), new Float64Array([1, 0, 0])), /dimension mismatch/);
});

test("RATE_LIMIT falls back to the same hash space on both sides", async () => {
  const fail = async () => {
    throw new Error("RATE_LIMIT");
  };
  const left = await embedForL3("weeknight dal", fail);
  const right = await embedForL3("weeknight dal", fail);
  assert.equal(left.source, "hash-fallback");
  assert.match(left.note ?? "", /RATE_LIMIT/);
  assert.equal(left.vector.length, embed("weeknight dal").length);
  assert.equal(right.vector.length, left.vector.length);
  assert.ok(cosine(left.vector, right.vector) > 0.99);
});

test("a mixed provider failure re-embeds both sides in the hash space", async () => {
  let calls = 0;
  const flaky = async () => {
    calls += 1;
    if (calls === 1) return [1, 0, 0, 0];
    throw new Error("no embeddings support");
  };
  const bundled = await embedAllForL3(["how to scope a research question", "deciding how wide a research question should be"], flaky);
  assert.equal(bundled.source, "hash-fallback");
  assert.equal(bundled.vectors[0]!.length, bundled.vectors[1]!.length);
  assert.equal(bundled.vectors[0]!.length, embed("how to scope a research question").length);
});

test("a reworded title shares one provider vector and clears the L3 cosine gate", async () => {
  const provider = async (text: string) => (/research question/i.test(text) ? [1, 0, 0, 0] : [0, 1, 0, 0]);
  const bundled = await embedAllForL3(
    ["Deciding how wide a research question should be deciding how wide a research question should be", "How to scope a research question how to scope a research question"],
    provider,
  );
  assert.equal(bundled.source, "provider");
  assert.equal(bundled.vectors[0]!.length, bundled.vectors[1]!.length);
  assert.ok(cosine(bundled.vectors[0]!, bundled.vectors[1]!) > 0.88);
});

test("uniqueness measures the article, not its title", () => {
  const corpus = [
    {
      title: "How to store coffee beans",
      keyword: "coffee storage",
      slug: "how-to-store-coffee-beans",
      sample: "How long beans keep. Freezer versus cupboard. What oxygen does to roast",
    },
  ];

  // Same query and near-identical title, completely different argument.
  const different = uniquenessAgainst("How to store coffee beans", "coffee storage", corpus, [
    { heading: "Why one-way valves matter", paragraphs: [] },
    { heading: "Storing in the bag it came in", paragraphs: [] },
    { heading: "When stale is still fine", paragraphs: [] },
  ]);
  assert.ok(different > 0.7, `different sections must score high: ${different}`);

  // Same argument, reworded: the sections repeat, so this is the duplicate.
  const repeated = uniquenessAgainst("Storing coffee: how long beans keep", "coffee storage", corpus, [
    { heading: "How long beans keep", paragraphs: [] },
    { heading: "Freezer versus cupboard", paragraphs: [] },
    { heading: "What oxygen does to roast", paragraphs: [] },
  ]);
  assert.ok(repeated < 0.35, `the same sections must score as a duplicate: ${repeated}`);
  assert.ok(different > repeated, `${different} should beat ${repeated}`);

  // No siblings, nothing to overlap with.
  assert.equal(uniquenessAgainst("How to store coffee beans", "coffee storage", [], []), 1);
});
