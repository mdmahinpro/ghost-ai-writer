/**
 * Milestone 4 UI smoke — Calendar 100% + Ad-Ready Static.
 * Requires the dev server on http://localhost:8080.
 * Verifies:
 *  1. /calendar shows the unlocked 3 automation switches, mode-aware publish
 *     label, cadence summary, and the manual/automation pill
 *  2. creating a calendar runs the real flow and lands on the detail view with
 *     List/Month/Cluster views and per-entry controls
 *  3. /static-delivery shows all 7 ad slots, the 16 KiB budget, the ads.txt
 *     editor, preview mode, and the four deploy providers
 *  4. zero console errors
 * Evidence: %TEMP%\kilo\rea-live\m4-ui\ui-verify.json
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { chromium } from "playwright";

const BASE = process.env.SMOKE_BASE ?? "http://localhost:8080";
const OUT = process.env.SMOKE_OUT ?? `${process.env.TEMP ?? "."}\\kilo\\rea-live\\m4-ui`;
mkdirSync(OUT, { recursive: true });

const results = [];
const check = (name, ok, detail = "") => {
  results.push({ name, ok, detail });
  console.log(`${ok ? "  ok  " : "FAIL  "}${name}${detail ? ` -- ${detail}` : ""}`);
};

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
const consoleErrors = [];
page.on("console", (msg) => {
  if (msg.type() === "error") consoleErrors.push(msg.text().slice(0, 300));
});
page.on("pageerror", (err) => consoleErrors.push(String(err).slice(0, 300)));

try {
  // ---------- 1 + 2. Calendar ----------
  await page.goto(`${BASE}/calendar`, { waitUntil: "domcontentloaded", timeout: 90000 });
  await page.waitForTimeout(4000);
  let body = (await page.textContent("body")) ?? "";
  if (!/Calendar/i.test(body)) {
    await page.waitForTimeout(3000);
    body = (await page.textContent("body")) ?? "";
  }
  check("calendar: creation form with publish mode", /Publish mode/i.test(body) && /Write lead hours/i.test(body));

  await page.getByPlaceholder("Autumn schedule").fill("Smoke calendar");
  await page.getByPlaceholder("Autumn schedule").press("Tab");
  const lines = page.locator("textarea").last();
  await lines.fill("smoke calendar entry alpha\nsmoke calendar entry beta");
  await page.getByRole("button", { name: "Create calendar" }).click();
  // Wait for the router to land on the new calendar instead of a fixed sleep.
  await page.waitForURL(/\/calendar\/cal_/, { timeout: 20000 }).catch(() => {});
  await page.waitForTimeout(2500);
  body = (await page.textContent("body")) ?? "";
  check("calendar: created and opened detail", /Smoke calendar/i.test(body));

  const switchLabels = ["Write automatically", "Automatic internal linking"];
  const switchesPresent = switchLabels.every((label) => body.includes(label));
  const modeAware = /Publish automatically|Save drafts automatically/.test(body);
  check("calendar: 3 switches incl. mode-aware publish label", switchesPresent && modeAware, modeAware ? "" : "publish label missing");
  check("calendar: cadence + automation summary", /\/week/.test(body) && /Automation off|Writes automatically/.test(body));
  const pillBefore = /automation on/i.test(body) ? "automation on" : "manual";
  check("calendar: manual by default", pillBefore === "manual", pillBefore);
  check("calendar: entry statuses visible", /SCHEDULED/.test(body));
  const viewButtons = ["list", "month", "cluster"].map((name) => page.getByRole("button", { name, exact: true }));
  const present = (await Promise.all(viewButtons.map((button) => button.count()))).every((count) => count > 0);
  check("calendar: List / Month / Cluster view controls", present);
  if (present) {
    await viewButtons[1].click();
    await page.waitForTimeout(500);
    const monthBody = (await page.textContent("body")) ?? "";
    check("calendar: Month view groups by month", /20\d\d/.test(monthBody));
    await viewButtons[2].click();
    await page.waitForTimeout(500);
    const clusterBody = (await page.textContent("body")) ?? "";
    check("calendar: Cluster view groups entries by kind", /entries \(/.test(clusterBody));
    await viewButtons[0].click();
    await page.waitForTimeout(300);
  }

  const autoGenerate = page.locator('input[type="checkbox"]').first();
  await autoGenerate.check();
  await page.waitForTimeout(600);
  body = (await page.textContent("body")) ?? "";
  check("calendar: turning a switch on flips the pill to automation on", /automation on/i.test(body));
  await page.screenshot({ path: `${OUT}\\calendar.png`, fullPage: true });

  // ---------- 3. Static delivery ----------
  await page.goto(`${BASE}/static-delivery`, { waitUntil: "domcontentloaded", timeout: 90000 });
  await page.waitForTimeout(3500);
  body = (await page.textContent("body")) ?? "";
  const slotIds = ["site_top", "home_feed", "article_top", "article_inline", "article_bottom", "article_sidebar", "site_bottom"];
  const missingSlots = slotIds.filter((id) => !body.includes(id));
  check("delivery: all 7 ad slots listed", missingSlots.length === 0, missingSlots.join(",") || "all 7");
  check("delivery: 16 KiB budget shown", /16,384|16 KiB/i.test(body));
  check("delivery: ads.txt editor", /ads\.txt/i.test(body) && (await page.locator("textarea").count()) > 0);
  check("delivery: preview mode toggle", /Preview mode/i.test(body));
  const providers = ["cPanel", "Cloudflare Pages", "Vercel", "GitHub Pages"];
  const missingProviders = providers.filter((name) => !body.includes(name));
  check("delivery: four deploy providers", missingProviders.length === 0, missingProviders.join(",") || "all 4");
  check("delivery: adapter deploy controls", /Deploy/.test(body) && /Verify/.test(body));
  await page.screenshot({ path: `${OUT}\\static-delivery.png`, fullPage: true });

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
