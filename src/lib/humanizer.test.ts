import { test } from "node:test";
import assert from "node:assert/strict";
import {
  BLADER_DRAFT_RULES,
  BLADER_RULES,
  deterministicScrub,
  humanizeWithBlader,
  humanizerScore,
  scanAiPatterns,
  structuralFingerprint,
} from "./humanizer.ts";

const ROBOTIC = `# Smart Ferret Care

## What is a smart ferret, exactly?

It's not just a pet choice, it's a lifestyle. Additionally, ferret experts delve into a vibrant tapestry of crucial habits that showcases their meticulous nature.

| Feeding | Amount |
| --- | --- |
| Kibble | 2 scoops |
| Water | fresh |

Ferrets need enrichment — puzzles, tunnels — every day. See the [feeding guide](/post/feeding-guide/) for amounts.

## Future Outlook

The future looks bright for ferret owners.

I hope this helps! Let me know if you'd like me to expand on any section.`;

test("blader ruleset holds the 26 patterns, strongest first, no gaps", () => {
  assert.equal(BLADER_RULES.length, 26);
  assert.deepEqual(BLADER_RULES.map((rule) => rule.id), Array.from({ length: 26 }, (_, index) => index + 1));
});

test("scanAiPatterns detects banned tropes: delve, tapestry, It's not just X it's Y, dashes, residue", () => {
  const hits = scanAiPatterns(ROBOTIC);
  const ids = hits.map((hit) => hit.id);
  assert.ok(ids.includes(1), "not-X-it's-Y contrast must be flagged");
  assert.ok(ids.includes(12), "overused AI words (delve/tapestry/crucial) must be flagged");
  assert.ok(ids.includes(13), "Future Outlook / future looks bright must be flagged");
  assert.ok(ids.includes(22), "chatbot residue must be flagged");
  assert.ok(ids.includes(8), "em dashes must be flagged");
});

test("deterministicScrub rewrites robotic text cleanly without a model key", () => {
  const { markdown, stripped } = deterministicScrub(ROBOTIC);
  assert.ok(!/It'?s not just/i.test(markdown), "the staging contrast must be rewritten");
  assert.match(markdown, /, and /, "the contrast becomes a plain conjunction");
  assert.ok(!/\bdelve\b|\btapestry\b|\bcrucial\b/i.test(markdown), "banned vocabulary must be swapped");
  assert.ok(!/[—–]/.test(markdown), "em dashes must be gone");
  assert.ok(!/I hope this helps/i.test(markdown), "chatbot residue must be removed");
  assert.ok(!/The future looks bright/i.test(markdown), "filler send-off must be removed");
  assert.ok(stripped.length >= 4, "the scrub should report what it stripped");
});

test("deterministicScrub keeps HTML tables and internal links intact", () => {
  const { markdown } = deterministicScrub(ROBOTIC);
  const fingerprints = structuralFingerprint(markdown);
  const before = structuralFingerprint(ROBOTIC);
  assert.equal(fingerprints.tables, before.tables, "table rows must survive");
  assert.equal(fingerprints.links, before.links, "markdown links must survive");
  assert.match(markdown, /\[feeding guide\]\(\/post\/feeding-guide\/\)/, "link href and anchor must be unchanged");
  assert.match(markdown, /\| Kibble \| 2 scoops \|/, "table cells must be unchanged");
});

test("code blocks, inline code and link targets are never rewritten", () => {
  const codeSample = "Use `npm run delve` like this:\n\n```\ndelve --tapestry=true — robust\n```\n\nIt's not just fast, it's [robust tooling](/post/robust-delve/).";
  const { markdown } = deterministicScrub(codeSample);
  assert.match(markdown, /```\ndelve --tapestry=true — robust\n```/, "code fence untouched");
  assert.match(markdown, /`npm run delve`/, "inline code untouched");
  assert.match(markdown, /\(\/post\/robust-delve\/\)/, "link targets untouched");
});

test("humanizeWithBlader scores higher than the input and reports the deterministic pass", async () => {
  const before = humanizerScore(ROBOTIC).score;
  const result = await humanizeWithBlader({ markdown: ROBOTIC, authorBannedPhrases: [] });
  assert.equal(result.llm, false);
  assert.equal(result.passes, 1);
  assert.ok(result.score > before, `score ${result.score} must beat the robotic baseline ${before}`);
  assert.ok(result.score >= 80, "a clean deterministic rewrite should score high");
  assert.ok(result.stripped.length >= 3);
});

test("humanizerScore is 100 for already-human prose", () => {
  const human = "# Feeding a ferret\n\n## How much kibble per day?\n\nHalf a cup, split into two meals. Watch the tail: a fat ferret is a slow ferret.\n\nTable check:\n\n| Meal | Amount |\n| --- | --- |\n| Morning | 1/4 cup |\n| Evening | 1/4 cup |\n\nLink: [water basics](/post/water/). She eats first; the water dish matters just because kibble is dry.";
  const { score } = humanizerScore(human);
  assert.equal(score, 100);
});

test("blader draft rules travel with the stage prompts", () => {
  const joined = BLADER_DRAFT_RULES.join(" ");
  for (const term of ["delve", "It's not just", "dash", "chatbot residue", "I hope this helps"]) {
    assert.ok(joined.toLowerCase().includes(term.toLowerCase()), `draft rules must mention ${term}`);
  }
});

test("a key pool that answers refreshes the score and reports the key; a failing pool falls back safely", async () => {
  // Live chat stub: pretends the audit pass and the rewrite pass both answered.
  const goodChat = async (system: string) => {
    if (system.includes("audit")) {
      return {
        ok: true as const,
        text: '{"issues":[{"id":1,"note":"staging contrast in the opening"}]}',
        keyId: "k1",
        usage: { prompt: 10, completion: 5, total: 15 },
      };
    }
    return {
      ok: true as const,
      text: JSON.stringify({ markdown: `# Smart Ferret Care\n\n## What is a smart ferret, exactly?\n\nA ferret that learns routines quickly. It reads the household's habits, and it adapts. Feeding stays simple: two meals, one water dish, one [feeding guide](/post/feeding-guide/).\n\n| Feeding | Amount |\n| --- | --- |\n| Kibble | 2 scoops |\n| Water | fresh |\n\nFerrets need daily enrichment. Puzzles work. Tunnels work better.\n\n## How much time does a ferret need?\n\nAbout an hour of play outside the cage per day. The rest is sleep.` }),
      keyId: "k1",
      usage: { prompt: 40, completion: 90, total: 130 },
    };
  };
  const good = await humanizeWithBlader({ markdown: ROBOTIC, authorBannedPhrases: [], chat: goodChat });
  assert.equal(good.llm, true, "a working chat transport should run both passes");
  assert.equal(good.passes, 2);
  assert.equal(good.keyId, "k1");
  assert.ok(good.score >= 90, `surgical rewrite should land clean (got ${good.score})`);

  const failingChat = async () => ({ ok: false as const, error: "Every key in the pool failed (1 tried)." });
  const fallback = await humanizeWithBlader({ markdown: ROBOTIC, authorBannedPhrases: [], chat: failingChat });
  assert.equal(fallback.llm, false, "a failing chat transport must keep the deterministic result");
  assert.ok(fallback.score >= 80);
});
