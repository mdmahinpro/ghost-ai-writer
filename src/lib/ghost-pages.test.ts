import assert from "node:assert/strict";
import test from "node:test";
import { collectGhostPages, ghostPostsQuery, mapGhostPost } from "./ghost-pages.ts";

test("post query asks for 100 rows per page, not 50", () => {
  const path = ghostPostsQuery(2);
  assert.match(path, /limit=100/);
  assert.match(path, /page=2/);
  assert.doesNotMatch(path, /limit=50/);
});

test("a site with more than 50 posts imports every page", async () => {
  const total = 115;
  const result = await collectGhostPages(async (page) => {
    const pages = 2;
    const start = (page - 1) * 100;
    const count = page === 1 ? 100 : total - 100;
    const rows = Array.from({ length: count }, (_, index) =>
      mapGhostPost({ id: `p${start + index}`, title: `Post ${start + index}`, slug: `post-${start + index}`, status: "published" }),
    );
    return { rows, pages };
  });
  assert.equal(result.rows.length, 115);
  assert.equal(result.pages, 2);
  assert.equal(result.truncated, false);
  assert.equal(result.rows[0]!.slug, "post-0");
  assert.equal(result.rows[114]!.slug, "post-114");
  assert.equal(result.rows.filter((row) => row.status === "PUBLISHED").length, 115);
});

test("page count above the cap is marked truncated", async () => {
  const result = await collectGhostPages(async (page) => ({ rows: [page], pages: 40 }), 30);
  assert.equal(result.rows.length, 30);
  assert.equal(result.truncated, true);
});
