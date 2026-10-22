import { test } from "node:test";
import assert from "node:assert/strict";
import { excerptOf, markdownToHtml, sectionsFromMarkdown } from "./markdown.ts";

const WAKE_TABLE = [
  "| Constraint | Wake time | At desk or bench | Notes |",
  "|---|---|---|---|",
  "| Default first-year target | 7:30 a.m. | 9:00 a.m. | 90-minute buffer |",
  "| 8 a.m. class | 6:30 a.m. | 7:45 a.m. | Keep within one hour of default |",
  "| Night-owl chronotype | 8:30 a.m. | 10:00 a.m. | Negotiate with advisor first |",
].join("\n");

test("pipe tables render as a real table, never as raw pipes", () => {
  const html = markdownToHtml(WAKE_TABLE);
  assert.ok(html.includes('<div class="table-scroll"><table class="article-table">'), html);
  assert.ok(html.includes("<thead><tr>"), html);
  assert.ok(html.includes('<th scope="col">Constraint</th>'), html);
  assert.ok(html.includes('<th scope="col">Wake time</th>'), html);
  assert.ok(html.includes("<tbody>"), html);
  assert.ok(html.includes("<td>7:30 a.m.</td>"), html);
  assert.ok(html.includes("<td>90-minute buffer</td>"), html);
  assert.ok(!html.includes("<p>|"), html);
  assert.ok(!/>\s*\|.*\|/.test(html), html);
});

test("table alignment markers map to inline text-align styles", () => {
  const html = markdownToHtml(["| L | C | R |", "|:--|:-:|--:|", "| a | b | c |"].join("\n"));
  assert.ok(html.includes('<th scope="col" style="text-align:left">L</th>'), html);
  assert.ok(html.includes('<th scope="col" style="text-align:center">C</th>'), html);
  assert.ok(html.includes('<th scope="col" style="text-align:right">R</th>'), html);
  assert.ok(html.includes('<td style="text-align:center">b</td>'), html);
});

test("headings map to h2/h3/h4 with a single top level", () => {
  assert.equal(markdownToHtml("# Title"), "<h2>Title</h2>");
  assert.equal(markdownToHtml("## Section"), "<h2>Section</h2>");
  assert.equal(markdownToHtml("### Question?"), "<h3>Question?</h3>");
  assert.equal(markdownToHtml("#### Deeper"), "<h4>Deeper</h4>");
  assert.equal(markdownToHtml("###### Deepest"), "<h4>Deepest</h4>");
});

test("bullet, numbered and nested lists render as lists", () => {
  const ul = markdownToHtml("- one\n- two\n- three");
  assert.ok(ul.startsWith("<ul>") && ul.endsWith("</ul>"), ul);
  assert.ok(ul.includes("<li>one</li>"), ul);

  const ol = markdownToHtml("3. three\n4. four");
  assert.ok(ol.startsWith('<ol start="3">'), ol);
  assert.ok(ol.includes("<li>four</li>"), ol);

  const nested = markdownToHtml("- parent\n  - child\n- sibling");
  assert.ok(/<ul><li>parent<ul><li>child<\/li><\/ul><\/li><li>sibling<\/li><\/ul>/.test(nested), nested);
});

test("task lists render disabled checkboxes", () => {
  const html = markdownToHtml("- [x] done\n- [ ] todo");
  assert.ok(html.includes('<li class="task-item"><input type="checkbox" disabled checked /> done</li>'), html);
  assert.ok(html.includes('<li class="task-item"><input type="checkbox" disabled /> todo</li>'), html);
});

test("blockquotes and GitHub-style callouts render", () => {
  const quote = markdownToHtml("> A plain quote.");
  assert.ok(quote.includes("<blockquote><p>A plain quote.</p></blockquote>"), quote);

  const callout = markdownToHtml("> [!WARNING] Read this\n> Keep within one hour of default.");
  assert.ok(callout.includes('<aside class="callout callout-warning">'), callout);
  assert.ok(callout.includes('<p class="callout-title">Read this</p>'), callout);
  assert.ok(callout.includes("Keep within one hour of default."), callout);
});

test("fenced code blocks render a captioned code figure", () => {
  const html = markdownToHtml("```ts\nconst a = 1 < 2;\n```");
  assert.ok(html.includes('<figure class="code-block"><figcaption>ts</figcaption>'), html);
  assert.ok(html.includes('<code class="language-ts">'), html);
  assert.ok(html.includes("const a = 1 &lt; 2;"), html);
});

test("horizontal rules render as hr", () => {
  assert.equal(markdownToHtml("---"), "<hr>");
  assert.equal(markdownToHtml("***"), "<hr>");
});

test("inline formatting covers bold, italic, strike, code and links", () => {
  assert.equal(markdownToHtml("**bold**"), "<p><strong>bold</strong></p>");
  assert.equal(markdownToHtml("*italic*"), "<p><em>italic</em></p>");
  assert.equal(markdownToHtml("~~gone~~"), "<p><del>gone</del></p>");
  assert.equal(markdownToHtml("`code`"), "<p><code>code</code></p>");
  assert.equal(markdownToHtml("[Ghost](https://ghost.org)"), '<p><a href="https://ghost.org">Ghost</a></p>');
  assert.equal(markdownToHtml("**bold and *italic* here**"), "<p><strong>bold and <em>italic</em> here</strong></p>");
  assert.equal(markdownToHtml("<https://ghost.org>"), '<p><a href="https://ghost.org">https://ghost.org</a></p>');
});

test("images render as CLS-safe figure cards", () => {
  const html = markdownToHtml("![A desk](/media/abc.png)");
  assert.ok(html.includes('<figure class="kg-card kg-image-card"><img src="/media/abc.png" alt="A desk"'), html);
});

test("footnotes render a reference and a footnotes section", () => {
  const html = markdownToHtml("A claim.[^1]\n\n[^1]: The supporting note.");
  assert.ok(html.includes('id="fnref-1"'), html);
  assert.ok(html.includes('<section class="footnotes"><ol><li id="fn-1">The supporting note.'), html);
  assert.ok(!html.includes("[^1]:"), html);
});

test("unsafe html and schemes are escaped, never passed through", () => {
  const html = markdownToHtml("<script>alert(1)</script> and [x](javascript:alert(1))");
  assert.ok(!html.includes("<script>"), html);
  assert.ok(html.includes("&lt;script&gt;"), html);
  assert.ok(!html.includes("javascript:"), html);
  assert.ok(html.includes("x"), html);
});

test("hard line breaks become br", () => {
  const html = markdownToHtml("line one  \nline two");
  assert.ok(html.includes("<br>"), html);
});

test("excerpts and section extraction ignore table and list scaffolding", () => {
  const md = `## Section\n\n${WAKE_TABLE}\n\n- a list item\n\nA real sentence about the decision.`;
  const excerpt = excerptOf(md);
  assert.ok(!excerpt.includes("|"), excerpt);
  assert.ok(excerpt.includes("A real sentence"), excerpt);
  const sections = sectionsFromMarkdown(md);
  assert.equal(sections[0]!.heading, "Section");
  assert.ok(!sections[0]!.paragraphs.some((p) => p.includes("|")), JSON.stringify(sections));
  assert.ok(!sections[0]!.paragraphs.some((p) => p.startsWith("- ")), JSON.stringify(sections));
});
