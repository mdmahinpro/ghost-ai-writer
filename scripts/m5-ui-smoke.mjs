/**
 * Milestone 5 browser smoke — Rule 7 shell, palette, themes, and all 20 areas.
 * Requires the dev server on http://localhost:8080.
 * Verifies: shell groups, Ctrl+K palette (area jump + theme switch + quick actions),
 * the real server heartbeat popover, every one of the 20 canonical routes rendering
 * without an error boundary, and zero console/page errors.
 * Evidence + screenshots: %TEMP%\kilo\rea-live\m5-ui\ui-verify.json
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { chromium } from "playwright";

const BASE = process.env.SMOKE_BASE ?? "http://localhost:8080";
const OUT = process.env.SMOKE_OUT ?? `${process.env.TEMP ?? "."}\\kilo\\rea-live\\m5-ui`;
mkdirSync(OUT, { recursive: true });

const results = [];
const check = (name, ok, detail = "") => {
  results.push({ name, ok, detail });
  console.log(`${ok ? "  ok  " : "FAIL  "}${name}${detail ? ` -- ${detail}` : ""}`);
};

/** The 20 canonical areas (Rule 7 / MASTER_SPEC §1). */
const AREAS = [
  ["Workspaces", "/workspaces"],
  ["Overview", "/"],
  ["Create", "/create"],
  ["Topic Plans", "/topic-plans"],
  ["Research", "/research"],
  ["Calendar", "/calendar"],
  ["Runs", "/runs"],
  ["Articles", "/articles"],
  ["Analytics", "/analytics"],
  ["Connections", "/connections"],
  ["Static Delivery", "/static-delivery"],
  ["Authors", "/authors"],
  ["AI Keys", "/ai-keys"],
  ["Content Defaults", "/settings/content"],
  ["Website Settings", "/settings/website"],
  ["Inbox", "/inbox"],
  ["Account", "/account"],
  ["Billing", "/billing"],
  ["Backup & Recovery", "/settings/website"],
  ["Help", "/help"],
];

const browser = await chromium.launch();
const context = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
const page = await context.newPage();
const consoleErrors = [];
page.on("console", (msg) => {
  if (msg.type() === "error") consoleErrors.push(msg.text().slice(0, 240));
});
page.on("pageerror", (err) => consoleErrors.push(String(err).slice(0, 240)));

try {
  // ---------- 1. Shell ----------
  await page.goto(`${BASE}/`, { waitUntil: "domcontentloaded", timeout: 90000 });
  await page.waitForTimeout(4500);
  let body = (await page.textContent("body")) ?? "";
  const groups = ["Overview & Create", "Research & Planning", "Execution & Library", "Distribution & Static", "System & Keys"];
  const missingGroups = groups.filter((group) => !body.includes(group));
  check("shell: five sidebar groups", missingGroups.length === 0, missingGroups.join(",") || groups.join(" · "));
  check("shell: heartbeat badge present", /Writing service (online|starting|paused)/i.test(body));
  check("shell: theme picker present", (await page.locator("[aria-label*='heme' i]").count()) > 0 || body.includes("Theme"));

  // ---------- 2. Command palette ----------
  await page.keyboard.press("Control+k");
  await page.waitForTimeout(600);
  const paletteInput = page.locator("input[aria-label='Search the studio']");
  check("palette: opens on Ctrl+K", (await paletteInput.count()) > 0);
  if (await paletteInput.count()) {
    await paletteInput.fill("calendar");
    await page.waitForTimeout(500);
    body = (await page.textContent("body")) ?? "";
    check("palette: area jump result", /Calendar/.test(body) && /Research & Planning/.test(body));
    await paletteInput.fill("new research");
    await page.waitForTimeout(400);
    body = (await page.textContent("body")) ?? "";
    check("palette: 'New Research Project' action", /New Research Project/.test(body));
    await paletteInput.fill("rose");
    await page.waitForTimeout(400);
    body = (await page.textContent("body")) ?? "";
    check("palette: theme command listed", /Theme · Rose/.test(body));
    // switch theme through the palette
    await page.getByText("Theme · Rose", { exact: true }).first().click();
    await page.waitForTimeout(600);
    const theme = await page.evaluate(() => document.documentElement.dataset.theme);
    check("palette: theme switch applies", theme === "rose", `data-theme=${theme}`);
    await page.screenshot({ path: `${OUT}\\palette-rose.png`, fullPage: false });
    // back to midnight for the rest of the run
    await page.keyboard.press("Control+k");
    await page.waitForTimeout(400);
    await paletteInput.fill("midnight");
    await page.waitForTimeout(400);
    await page.getByText("Theme · Midnight", { exact: true }).first().click();
    await page.waitForTimeout(500);
    const back = await page.evaluate(() => document.documentElement.dataset.theme);
    check("palette: theme switch back", back === "midnight", `data-theme=${back}`);
  }

  // ---------- 3. Heartbeat popover ----------
  const badge = page.locator("button[aria-label='Writing service status']");
  if (await badge.count()) {
    await badge.first().click();
    await page.waitForTimeout(500);
    body = (await page.textContent("body")) ?? "";
    check("heartbeat popover: lease + jobs detail", /Dispatch lease/.test(body) && /Active jobs/.test(body) && /next calendar pulse/i.test(body));
    await page.keyboard.press("Escape");
  } else {
    check("heartbeat popover: badge found", false, "aria-label missing");
  }

  // ---------- 4. Every canonical area renders ----------
  const failing = [];
  for (const [label, href] of AREAS) {
    const before = consoleErrors.length;
    await page.goto(`${BASE}${href}`, { waitUntil: "domcontentloaded", timeout: 60000 });
    await page.waitForTimeout(1800);
    const text = (await page.textContent("body")) ?? "";
    const crashed = /Something went wrong|Application error|Unhandled/i.test(text) || text.trim().length < 40;
    const newErrors = consoleErrors.length - before;
    if (crashed || newErrors > 0) failing.push(`${label}${crashed ? " (render)" : ""}${newErrors ? ` (${newErrors} console)` : ""}`);
  }
  check(`all ${AREAS.length} canonical areas render`, failing.length === 0, failing.join(", ") || `${AREAS.length}/${AREAS.length}`);
  check("zero console errors across the whole walk", consoleErrors.length === 0, consoleErrors.slice(0, 3).join(" | ").slice(0, 280));
  await page.screenshot({ path: `${OUT}\\final.png`, fullPage: false });
} catch (error) {
  check("smoke completed without exception", false, String(error).slice(0, 300));
  await page.screenshot({ path: `${OUT}\\failure.png`, fullPage: true }).catch(() => {});
}

await browser.close();
const ok = results.every((row) => row.ok);
writeFileSync(`${OUT}\\ui-verify.json`, JSON.stringify({ ok, results, consoleErrors }, null, 2));
console.log(`\n${results.filter((row) => row.ok).length}/${results.length} checks passed -- evidence: ${OUT}\\ui-verify.json`);
process.exit(ok ? 0 : 1);
