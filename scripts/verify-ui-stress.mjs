/**
 * UI stress test: clicks through all 20 sidebar areas, submits keywords,
 * queues a topic plan, starts research, toggles switches, and asserts that
 * no "Maximum update depth exceeded" loop ever appears.
 */
import assert from "node:assert/strict";
import { chromium } from "playwright";
import { AREAS } from "../src/lib/areas.ts";

const base = process.env.UI_BASE_URL ?? "http://127.0.0.1:8080";
const browser = await chromium.launch({ headless: true });

const LOOP = /Maximum update depth exceeded/i;
const failures = [];

async function watch(page, label) {
  const errors = [];
  page.on("pageerror", (error) => {
    if (LOOP.test(error.message)) errors.push(error.message);
  });
  page.on("console", (message) => {
    if (message.type() === "error" && LOOP.test(message.text())) errors.push(message.text());
  });
  return () => {
    if (errors.length || page.__gawCrash) failures.push(`${label}: ${[...errors, page.__gawCrash].join(" | ")}`);
    return errors.length;
  };
}

const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
page.__gawCrash = undefined;
page.on("pageerror", (error) => {
  if (/Maximum update depth|Something went wrong/i.test(error.message)) page.__gawCrash = error.message;
});
page.on("console", (message) => {
  if (message.type() === "error" && /Maximum update depth/i.test(message.text())) page.__gawCrash ??= message.text();
});

// Click through every sidebar area.
for (const area of AREAS) {
  const check = await watch(page, `nav ${area.href}`);
  await page.goto(new URL(area.href, base).href, { waitUntil: "domcontentloaded", timeout: 30000 });
  const crash = await page.evaluate(() => window.__lastCrash ?? null);
  assert.equal(crash, null);
  const domText = await page.locator("body").innerText();
  assert.equal(LOOP.test(domText), false, `loop text rendered on ${area.href}`);
  check();
}
console.log(`nav: ${AREAS.length}/${AREAS.length} areas visited without a render loop`);

async function tryStep(label, fn) {
  const check = await watch(page, label);
  try {
    await fn();
  } finally {
    check();
  }
}

// /create — submit keywords with the default (no credential) pool and let the
// six-stage engine + worker interval churn.
await page.goto(`${base}/create`, { waitUntil: "domcontentloaded" });
await tryStep("create submit", async () => {
  const box = page.locator("textarea[placeholder='One keyword per line']").first();
  await box.fill("how to plan a calm publishing week\nwhy research notes drift over time");
  await page.locator("button:has-text('Start run')").first().click();
  // Soak while jobs advance stages, the humanizer fires, and the tick writes.
  await page.waitForTimeout(9000);
  const store = await page.evaluate(() => {
    const s = window.__gawStore?.getState?.();
    return { jobs: s?.jobs.length, running: s?.jobs.filter((j) => j.status === "running").length, articles: s?.articles.length };
  });
  console.log("after run:", JSON.stringify(store));
  assert.equal(await page.evaluate(() => window.__lastCrash ?? null), null);
  const domText = await page.locator("body").innerText();
  assert.equal(LOOP.test(domText), false);
});

// /topic-plans — visit detail and attempt a queue action.
await page.goto(`${base}/topic-plans`, { waitUntil: "domcontentloaded" });
await tryStep("topic plans", async () => {
  const link = page.locator("a[href^='/topic-plans/']").first();
  if (await link.count()) {
    await link.click();
    await page.waitForTimeout(1200);
  }
  assert.equal(await page.evaluate(() => window.__lastCrash ?? null), null);
});

// /research — start a research project.
await page.goto(`${base}/research`, { waitUntil: "domcontentloaded" });
await tryStep("research start", async () => {
  const input = page.locator("input").first();
  if (await input.count()) await input.fill("camping coffee routines");
  const run = page.locator("button:has-text('Research'), button:has-text('Start'), button:has-text('Add'), button[type='submit']").first();
  if (await run.count()) await run.click();
  await page.waitForTimeout(1500);
  assert.equal(await page.evaluate(() => window.__lastCrash ?? null), null);
});

// Toggle switches on calendar / ai-keys / authors / static-delivery.
for (const path of ["/calendar", "/ai-keys", "/authors", "/static-delivery"]) {
  await page.goto(`${base}${path}`, { waitUntil: "domcontentloaded" });
  await tryStep(`toggles ${path}`, async () => {
    const switches = page.locator("[role='switch']");
    const count = Math.min(await switches.count(), 2);
    for (let index = 0; index < count; index++) {
      await switches.nth(index).click();
      await page.waitForTimeout(150);
    }
    assert.equal(await page.evaluate(() => window.__lastCrash ?? null), null);
    const domText = await page.locator("body").innerText();
    assert.equal(LOOP.test(domText), false);
  });
}

// Soak: sit on the busiest page while the worker tick runs.
await page.goto(`${base}/`, { waitUntil: "domcontentloaded" });
await tryStep("soak overview 5s", async () => {
  await page.waitForTimeout(5000);
  assert.equal(await page.evaluate(() => window.__lastCrash ?? null), null);
  const domText = await page.locator("body").innerText();
  assert.equal(LOOP.test(domText), false);
});

await browser.close();

if (failures.length) {
  console.error(failures.join("\n"));
  process.exit(1);
}
console.log("stress: no Maximum update depth exceeded, no __lastCrash, no loop markup");
