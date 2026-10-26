import assert from "node:assert/strict";
import test from "node:test";

import { HELP_SECTIONS, HELP_TOPICS, findHelpTopic } from "./help-topics.ts";

test("every guide is reachable: unique slugs, and the index and the lookup agree", () => {
  const slugs = HELP_TOPICS.map((topic) => topic.slug);
  assert.equal(new Set(slugs).size, slugs.length, "two guides share a slug");
  for (const topic of HELP_TOPICS) {
    assert.equal(findHelpTopic(topic.slug)?.title, topic.title, `${topic.slug} is not findable`);
  }
});

test("every guide says something: a title, a lede and at least two paragraphs", () => {
  for (const topic of HELP_TOPICS) {
    assert.ok(topic.title.trim().length > 3, `${topic.slug} has no title`);
    assert.ok(topic.lede.trim().length > 10, `${topic.slug} has no lede`);
    assert.ok(topic.body.length >= 2, `${topic.slug} is not a guide, it is a sentence`);
    for (const paragraph of topic.body) {
      assert.ok(paragraph.trim().length > 40, `${topic.slug} has a stub paragraph`);
    }
  }
});

test("the library covers every area the studio's own screens have", () => {
  // The sections mirror the reference platform's help index. A section that
  // silently disappears would leave a whole area of the product undocumented.
  const sections = HELP_SECTIONS.map((section) => section.title);
  for (const expected of [
    "Start here",
    "Get into your account",
    "Set up a website",
    "Connect your blog and AI",
    "Research and plan content",
    "Write and publish articles",
    "Build and publish a static website",
    "Usage, plans and payments",
    "Protect your data",
  ]) {
    assert.ok(sections.includes(expected), `the ${expected} section is missing`);
  }
  assert.ok(HELP_TOPICS.length >= 30, `only ${HELP_TOPICS.length} guides; the reference ships ~35`);
});

test("the guides that describe our own work are present by name", () => {
  for (const slug of [
    "retry-a-photo",
    "edit-export-or-delete-an-article",
    "mirror-articles-to-your-cms",
    "submit-to-indexnow",
    "understand-a-duplicate-refusal",
    "audit-and-repair-internal-links",
    "track-or-cancel-an-order",
  ]) {
    assert.ok(findHelpTopic(slug), `${slug} is missing`);
  }
});
