import assert from "node:assert/strict";
import test from "node:test";
import { bucketEvents, weekOverWeek, type VelocityEvent } from "./velocity-buckets.ts";

const NOW = Date.UTC(2026, 1, 23, 13, 0, 0); // Feb 23 13:00 UTC
const HOUR = 3_600_000;
const DAY = 86_400_000;

test("buckets: an empty dataset still yields a labelled axis", () => {
  assert.equal(bucketEvents([], NOW, "1D").length, 24);
  assert.equal(bucketEvents([], NOW, "1W").length, 7);
  assert.equal(bucketEvents([], NOW, "1M").length, 30);
  for (const bucket of bucketEvents([], NOW, "1W")) {
    assert.equal(bucket.published, 0);
    assert.equal(bucket.generated, 0);
  }
});

test("buckets: the newest event lands in the final bucket", () => {
  const events: VelocityEvent[] = [{ at: NOW - 1000, kind: "published", amount: 900 }];
  const buckets = bucketEvents(events, NOW, "1D");
  const last = buckets[buckets.length - 1]!;
  assert.equal(last.published, 1);
  assert.equal(last.words, 900);
});

test("buckets: events outside the window are dropped, not folded into the edge", () => {
  // 26 hours old: outside a 24-hour window entirely.
  const buckets = bucketEvents([{ at: NOW - 26 * HOUR, kind: "published" }], NOW, "1D");
  assert.equal(buckets.reduce((sum, bucket) => sum + bucket.published, 0), 0);
});

test("buckets: generated jobs and published articles stay separate series", () => {
  const events: VelocityEvent[] = [
    { at: NOW - 2 * HOUR, kind: "generated", amount: 120 },
    { at: NOW - 2 * HOUR, kind: "published", amount: 800 },
  ];
  const bucket = bucketEvents(events, NOW, "1D").find((row) => row.generated === 1)!;
  assert.equal(bucket.published, 1);
  assert.equal(bucket.tokens, 120);
  assert.equal(bucket.words, 800);
});

test("buckets: ALL grows with the data but stays readable", () => {
  const old = [{ at: NOW - 30 * DAY, kind: "generated" as const }];
  const buckets = bucketEvents(old, NOW, "ALL");
  assert.ok(buckets.length >= 4 && buckets.length <= 26, `got ${buckets.length}`);
  assert.equal(buckets.reduce((sum, bucket) => sum + bucket.generated, 0), 1);
});

test("weekOverWeek: no baseline means no percentage claim", () => {
  const fresh = weekOverWeek([NOW - DAY], NOW);
  assert.equal(fresh.thisWeek, 1);
  assert.equal(fresh.lastWeek, 0);
  assert.equal(fresh.deltaPct, null);

  const empty = weekOverWeek([], NOW);
  assert.equal(empty.deltaPct, 0);
});

test("weekOverWeek: compares against the previous seven days", () => {
  const published = [NOW - DAY, NOW - 2 * DAY, NOW - 9 * DAY];
  const { deltaPct, thisWeek, lastWeek } = weekOverWeek(published, NOW);
  assert.equal(thisWeek, 2);
  assert.equal(lastWeek, 1);
  assert.equal(deltaPct, 100);
});
