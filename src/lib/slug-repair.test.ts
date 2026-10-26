import assert from "node:assert/strict";
import test from "node:test";

import { repairArticleSlugs } from "./slug-repair.ts";

type Row = { id: string; siteId: string; slug: string; status: string; extra?: number };

const row = (id: string, slug: string, status: string, siteId = "s1"): Row => ({
  id,
  slug,
  status,
  siteId,
});

test("the live page takes the clean address from the draft that was holding it", () => {
  const live = row("a", "phd-career-transition-academia-to-industry-rd-2", "published");
  const draft = row("b", "phd-career-transition-academia-to-industry-rd", "draft");
  const out = repairArticleSlugs<Row>([live, draft]);
  const byId = new Map(out.articles.map((a) => [a.id, a.slug]));
  assert.equal(byId.get("a"), "phd-career-transition-academia-to-industry-rd");
  assert.equal(byId.get("b"), "phd-career-transition-academia-to-industry-rd-2");
  assert.equal(out.renamed.length, 2, "both moves are reported");
});

test("a free base is claimed without touching anyone else", () => {
  const live = row("a", "weekend-reading-3", "published");
  const other = row("b", "something-else", "published");
  const out = repairArticleSlugs<Row>([live, other]);
  assert.equal(out.articles[0]!.slug, "weekend-reading");
  assert.equal(out.articles[1]!.slug, "something-else", "unrelated articles keep their identity");
  assert.equal(out.articles[1], other, "and their object identity, so the store sees no change");
});

test("two live pages never get one address", () => {
  const one = row("a", "irb-approval-process", "published");
  const two = row("b", "irb-approval-process-2", "published");
  const out = repairArticleSlugs<Row>([one, two]);
  assert.equal(out.articles[1]!.slug, "irb-approval-process-2", "the number stays");
  assert.equal(out.renamed.length, 0);
});

test("slugs are scoped per site, not per workspace", () => {
  const mine = row("a", "shared-title-2", "published", "s1");
  const theirs = row("b", "shared-title", "draft", "s2");
  const out = repairArticleSlugs<Row>([mine, theirs]);
  assert.equal(out.articles[0]!.slug, "shared-title", "the other site's draft does not hold mine");
  assert.equal(out.articles[1]!.slug, "shared-title", "and theirs is untouched");
});

test("running it twice changes nothing", () => {
  const first = repairArticleSlugs<Row>([
    row("a", "guide-2", "published"),
    row("b", "guide", "draft"),
  ]);
  const second = repairArticleSlugs<Row>(first.articles);
  assert.equal(second.renamed.length, 0);
  assert.equal(second.articles, first.articles, "a clean snapshot is returned as-is");
});

test("a slug without a number, and an empty slug, are left alone", () => {
  const out = repairArticleSlugs<Row>([
    row("a", "plain-slug", "published"),
    row("b", "", "published"),
  ]);
  assert.equal(out.renamed.length, 0);
  assert.equal(out.articles[0]!.slug, "plain-slug");
  assert.equal(out.articles[1]!.slug, "");
});
