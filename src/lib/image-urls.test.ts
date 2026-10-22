import { test } from "node:test";
import assert from "node:assert/strict";
import { bingThumbUrl, isFakeCmsImage, rewriteCmsImageUrls, sanitizeArticleImages } from "./image-urls.ts";

const FAKE = "https://cms.lesgouters.com/content/images/2026/10/386bf85d291bf240b1521d2a.jpg";

test("isFakeCmsImage flags cms.* and /content/images/ paths", () => {
  assert.equal(isFakeCmsImage(FAKE), true);
  assert.equal(isFakeCmsImage("/content/images/2026/10/x.jpg"), true);
  assert.equal(isFakeCmsImage("https://tse1.mm.bing.net/th?q=x&w=474&h=274&c=7"), false);
});

test("store migration v12 rewrites a persisted cms /content/images cover to a Bing thumbnail", () => {
  const articles = [
    {
      keyword: "Home espresso",
      title: "How to pull a better shot",
      slug: "home-espresso",
      html: `<figure><img src="${FAKE}" alt="shot" /></figure>`,
      markdown: `![shot](${FAKE})`,
      images: [{ remote: FAKE, src: FAKE }],
    },
  ];
  const changed = sanitizeArticleImages(articles);
  const expected = bingThumbUrl("Home espresso");

  assert.ok(changed > 0);
  assert.match(expected, /^https:\/\/tse1\.mm\.bing\.net\/th\?q=.+&w=474&h=274&c=7$/);
  assert.equal(articles[0]!.images[0]!.remote, expected);
  assert.equal(articles[0]!.images[0]!.src, expected);
  assert.ok(!articles[0]!.html.includes("/content/images/"));
  assert.ok(articles[0]!.html.includes(expected));
  assert.ok(articles[0]!.markdown.includes(expected));
});

test("rewriteCmsImageUrls leaves real (non-CMS) image URLs untouched", () => {
  const keep = "https://tse1.mm.bing.net/th?q=x&w=474&h=274&c=7";
  const html = `<img src="${keep}" /><img src="${FAKE}" />`;
  const out = rewriteCmsImageUrls(html, "keep me");
  assert.ok(out.includes(keep));
  assert.ok(!out.includes("/content/images/"));
});
