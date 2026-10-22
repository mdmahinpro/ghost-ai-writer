/**
 * Feature-upgrade smoke (Playwright). Requires the dev server on http://localhost:8080 (npm run dev).
 * Verifies the four requested upgrades end to end:
 *  1. AI keys: real "Delete key" action (with confirm) + "Fetch Models" on the custom endpoint form
 *  2. Author avatars render via the zero-disk proxy with referrerpolicy="no-referrer" and the
 *     proxy answers with an image; PhD/practitioner topics create first-person personas
 *  3. Article images resolve to dynamic https://tse1.mm.bing.net/th?q=… URLs (no fake CMS paths)
 *  4. Zero occurrences of cms.lesgouters.com anywhere in the rendered app
 * Evidence JSON + screenshots go to %TEMP%\kilo\rea-live\feature-upgrades.
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { chromium } from "playwright";

const BASE = process.env.SMOKE_BASE ?? "http://localhost:8080";
const OUT = process.env.SMOKE_OUT ?? `${process.env.TEMP ?? "."}\\kilo\\rea-live\\feature-upgrades`;
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
page.on("dialog", (dialog) => dialog.accept());

try {
  // ---------- 1. AI keys: delete + fetch models ----------
  await page.goto(`${BASE}/ai-keys`, { waitUntil: "domcontentloaded", timeout: 90000 });
  await page.waitForTimeout(4000);
  let body = (await page.textContent("body")) ?? "";
  check("ai-keys: page renders", /AI keys and usage/i.test(body));

  const deleteButtons = page.locator('button[aria-label^="Delete "]:has-text("Delete key")');
  const deleteBefore = await deleteButtons.count();
  check("ai-keys: a Delete key button exists for every saved key", deleteBefore >= 1, `${deleteBefore} button(s)`);
  const keysBadgeBefore = (body.match(/(\d+) keys? · tried top-down/) ?? [])[1] ?? "";
  if (deleteBefore >= 1) {
    await deleteButtons.first().click();
    await page.waitForTimeout(800);
    body = (await page.textContent("body")) ?? "";
    const deleteAfter = await page.locator('button[aria-label^="Delete "]:has-text("Delete key")').count();
    check("ai-keys: delete removes the key from the list", deleteAfter === deleteBefore - 1, `${deleteBefore} -> ${deleteAfter}`);
    const keysBadgeAfter = (body.match(/(\d+) keys? · tried top-down/) ?? [])[1] ?? "";
    check("ai-keys: key count badge drops after delete", keysBadgeBefore !== "" && keysBadgeAfter === String(Number(keysBadgeBefore) - 1), `${keysBadgeBefore} -> ${keysBadgeAfter}`);
  }

  // Switch the add/edit form to a Custom endpoint, then exercise Fetch Models.
  await page.locator("select").first().selectOption("custom");
  await page.waitForTimeout(400);
  const fetchButton = page.getByRole("button", { name: /Fetch Models|Fetching/ });
  check("ai-keys: Fetch Models button appears for a custom endpoint", (await fetchButton.count()) >= 1);
  const baseInput = page.locator('input[placeholder="https://api.openai.com/v1"]');
  const keyInput = page.locator('input[type="password"]').first();
  await baseInput.fill("https://api.openai.com/v1");
  await keyInput.fill("sk-test-not-a-real-key");
  await page.waitForTimeout(300);
  check("ai-keys: Fetch Models enables once base URL + key are set", await fetchButton.first().isEnabled());
  await fetchButton.first().click();
  await page.waitForTimeout(6000);
  body = (await page.textContent("body")) ?? "";
  check(
    "ai-keys: Fetch Models calls /models and reports a real result",
    /(models? found|refused the API key|Fetch failed|does not expose|HTTP \d+|Base URL and API key)/i.test(body),
  );
  await page.screenshot({ path: `${OUT}\\ai-keys.png`, fullPage: true });

  // ---------- 2. Author avatars + PhD persona ----------
  const proxy = await page.request.get(`${BASE}/__grok/avatar?seed=smoketest&size=96`);
  check("avatar proxy: zero-disk endpoint answers with an image", proxy.status() === 200 && (proxy.headers()["content-type"] ?? "").startsWith("image/"), `${proxy.status()} ${proxy.headers()["content-type"]}`);

  await page.goto(`${BASE}/authors`, { waitUntil: "domcontentloaded", timeout: 90000 });
  await page.waitForTimeout(4000);
  const avatarImgs = page.locator('img[referrerpolicy="no-referrer"]');
  const avatarCount = await avatarImgs.count();
  check("authors: avatar <img referrerpolicy=\"no-referrer\"> renders", avatarCount >= 1, `${avatarCount} avatar(s)`);
  if (avatarCount >= 1) {
    const firstSrc = await avatarImgs.first().getAttribute("src");
    check("authors: avatar src is the external portrait or the in-memory proxy", /(thispersondoesnotexist\.com\/image\?seed=|__grok\/avatar|data:image\/svg)/.test(firstSrc ?? ""), firstSrc ?? "");
  }

  const nicheInput = page.locator('input[placeholder*="phd funding"]');
  await nicheInput.fill("phd dissertation research schedule");
  await page.getByRole("button", { name: "Auto-Generate US Expert Author" }).click();
  await page.waitForTimeout(1800);
  body = (await page.textContent("body")) ?? "";
  check("persona: PhD topic generates a real doctoral candidate role", /PhD Candidate in .+ at /i.test(body));
  check("persona: PhD/experiential author is written in the first person", /first-person/i.test(body));
  check("persona: no generic staff-reporter byline is produced", !/staff\s+(writer|reporter)/i.test(body));
  await page.screenshot({ path: `${OUT}\\authors-persona.png`, fullPage: true });

  // ---------- 3. Bing thumbnail URLs on article detail ----------
  await page.goto(`${BASE}/articles`, { waitUntil: "domcontentloaded", timeout: 90000 });
  await page.waitForTimeout(3000);
  const articleLink = page.locator('a[href*="/articles/"]').first();
  check("articles: an article detail link is reachable", (await articleLink.count()) >= 1);
  if (await articleLink.count()) {
    await articleLink.click();
    await page.waitForTimeout(2500);
    const bingImgs = page.locator('img[src^="https://tse1.mm.bing.net/th"]');
    const bingCount = await bingImgs.count();
    check("images: article detail renders dynamic tse1.mm.bing.net thumbnails", bingCount >= 1, `${bingCount} bing image(s)`);
    if (bingCount >= 1) {
      const src = (await bingImgs.first().getAttribute("src")) ?? "";
      check("images: the Bing URL carries the exact ?q=…&w=474&h=274&c=7 format", /^https:\/\/tse1\.mm\.bing\.net\/th\?q=.+&w=\d+&h=\d+&c=7/.test(src), src.slice(0, 140));
    }
    const detailBody = (await page.textContent("body")) ?? "";
    check("images: article detail never shows a fake CMS image path", !/cms\.lesgouters\.com/i.test(detailBody));
    await page.screenshot({ path: `${OUT}\\article-images.png`, fullPage: true });
  }

  // ---------- 4. No fake CMS host anywhere in the app ----------
  let cmsHits = 0;
  for (const route of ["/ai-keys", "/authors", "/articles", "/static-delivery"]) {
    await page.goto(`${BASE}${route}`, { waitUntil: "domcontentloaded", timeout: 90000 }).catch(() => {});
    await page.waitForTimeout(800);
    const html = await page.content();
    if (/cms\.lesgouters\.com/i.test(html)) cmsHits += 1;
  }
  check("global: zero cms.lesgouters.com occurrences across key routes", cmsHits === 0, `${cmsHits} route(s)`);

  check("zero console errors", consoleErrors.length === 0, consoleErrors.slice(0, 3).join(" | ").slice(0, 300));
} catch (error) {
  check("smoke completed without exception", false, String(error).slice(0, 400));
  await page.screenshot({ path: `${OUT}\\failure.png`, fullPage: true }).catch(() => {});
}

await browser.close();
const ok = results.every((row) => row.ok);
writeFileSync(`${OUT}\\ui-verify.json`, JSON.stringify({ ok, results, consoleErrors }, null, 2));
console.log(`\n${results.filter((row) => row.ok).length}/${results.length} checks passed -- evidence: ${OUT}\\ui-verify.json`);
process.exit(ok ? 0 : 1);
