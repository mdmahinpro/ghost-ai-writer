/**
 * Milestone 2 UI smoke — Smart Auto-Author Engine (Rule 2).
 * Requires the dev server on http://localhost:8080 (npm run dev).
 * Verifies:
 *  1. /authors renders the Auto-Author Engine banner + author cards with capacity meters
 *  2. the niche-match simulator dry-run picks an existing eligible expert
 *  3. "Auto-Generate US Expert Author" spawns a new US persona on the spot
 *  4. article detail shows the byline card with expertise badges + capacity
 *  5. zero console errors
 * Evidence JSON + screenshots go to %TEMP%\kilo\rea-live\m2-ui.
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { chromium } from "playwright";

const BASE = process.env.SMOKE_BASE ?? "http://localhost:8080";
const OUT = process.env.SMOKE_OUT ?? `${process.env.TEMP ?? "."}\\kilo\\rea-live\\m2-ui`;
mkdirSync(OUT, { recursive: true });

const results = [];
const check = (name, ok, detail = "") => {
  results.push({ name, ok, detail });
  console.log(`${ok ? "  ok  " : "FAIL  "}${name}${detail ? ` -- ${detail}` : ""}`);
};

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1400, height: 950 } });
const consoleErrors = [];
page.on("console", (msg) => {
  if (msg.type() === "error") consoleErrors.push(msg.text().slice(0, 300));
});
page.on("pageerror", (err) => consoleErrors.push(String(err).slice(0, 300)));

try {
  // ---------- 1. /authors inspector ----------
  await page.goto(`${BASE}/authors`, { waitUntil: "domcontentloaded", timeout: 90000 });
  await page.waitForTimeout(4000);
  let body = (await page.textContent("body")) ?? "";
  if (!/Auto-Author Engine Active/i.test(body)) {
    // The dashboard might need the client a beat longer to hydrate.
    await page.waitForTimeout(3000);
    body = (await page.textContent("body")) ?? "";
  }
  check("authors: engine banner", /Auto-Author Engine Active/i.test(body));
  check("authors: capacity meter (x / 250)", body.includes("/ 250"));
  check("authors: zero-disk avatar note", /Zero-Disk Avatars/i.test(body));

  await page.screenshot({ path: `${OUT}\\authors-before.png`, fullPage: true });

  const cardsBefore = await page.locator("a[href^='/authors/']").count();

  // ---------- 2. simulator dry-run: an existing niche picks the seeded expert ----------
  const input = page.locator('input[placeholder*="phd funding"]');
  await input.fill("research craft note systems");
  await page.getByRole("button", { name: "Dry-run match" }).click();
  await page.waitForTimeout(500);
  const afterPick = (await page.textContent("body")) ?? "";
  check("simulator: picks eligible under-250 expert", /Picked eligible expert/i.test(afterPick));

  // ---------- 3. auto-generate a fresh US expert ----------
  await input.fill("home espresso diagnostics");
  await page.getByRole("button", { name: "Auto-Generate US Expert Author" }).click();
  await page.waitForTimeout(1500);
  const afterGenerate = (await page.textContent("body")) ?? "";
  check("generator: new US expert author spawns", /Generated US expert/i.test(afterGenerate));
  const cardsAfter = await page.locator("a[href^='/authors/']").count();
  check("generator: author card count grows", cardsAfter > cardsBefore, `${cardsBefore} -> ${cardsAfter}`);
  await page.screenshot({ path: `${OUT}\\authors-after.png`, fullPage: true });

  // ---------- 4. article detail byline ----------
  await page.goto(`${BASE}/articles`, { waitUntil: "domcontentloaded", timeout: 90000 });
  await page.waitForTimeout(3000);
  const articleLink = page.locator('a[href*="/articles/"]').first();
  if (await articleLink.count()) {
    await articleLink.click();
    await page.waitForTimeout(2500);
    const detail = (await page.textContent("body")) ?? "";
    const hasByline = /,.*US/.test(detail) && !/staff\s+(writer|reporter)/i.test(detail);
    check("article detail: credentialed persona byline (no generic staff reporter) with US location", hasByline);
    const badgeCount = await page.locator("span.rounded-full").count();
    check("article detail: expertise badges", badgeCount >= 1, `${badgeCount} badge(s)`);
    check("article detail: capacity shown", /\d+ ?\/ ?250/.test(detail));
    await page.screenshot({ path: `${OUT}\\article-detail.png`, fullPage: true });
  } else {
    check("article detail reachable", false, "no article links on /articles");
  }

  // ---------- 5. console ----------
  check("zero console errors", consoleErrors.length === 0, consoleErrors.slice(0, 3).join(" | ").slice(0, 300));
} catch (error) {
  check("smoke completed without exception", false, String(error).slice(0, 300));
  await page.screenshot({ path: `${OUT}\\failure.png`, fullPage: true }).catch(() => {});
}

await browser.close();
const ok = results.every((row) => row.ok);
writeFileSync(`${OUT}\\ui-verify.json`, JSON.stringify({ ok, results, consoleErrors }, null, 2));
console.log(`\n${results.filter((row) => row.ok).length}/${results.length} checks passed -- evidence: ${OUT}\\ui-verify.json`);
process.exit(ok ? 0 : 1);
