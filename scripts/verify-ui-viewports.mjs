import assert from "node:assert/strict";
import { chromium } from "playwright";
import { AREAS, SHELL_GROUPS } from "../src/lib/areas.ts";

const base = process.env.UI_BASE_URL ?? "http://127.0.0.1:8080";
const browser = await chromium.launch({ headless: true });
const failures = [];

try {
  for (const viewport of [{ width: 1440, height: 900 }, { width: 390, height: 844 }]) {
    const context = await browser.newContext({ viewport });
    const page = await context.newPage();
    const errors = [];
    page.on("pageerror", (error) => errors.push(error.message));
    page.on("console", (message) => {
      if (message.type() === "error") errors.push(message.text());
    });

    for (const area of AREAS) {
      try {
        const response = await page.goto(new URL(area.href, base).href, { waitUntil: "domcontentloaded", timeout: 30000 });
        await page.locator("body").waitFor();
        const result = await page.evaluate(() => {
          const body = getComputedStyle(document.body);
          const mono = document.querySelector(".font-mono, .tnum, [data-metric]");
          return {
            font: body.fontFamily,
            mono: mono ? getComputedStyle(mono).fontFamily : null,
            numeric: mono ? getComputedStyle(mono).fontVariantNumeric : null,
            overflow: document.documentElement.scrollWidth > innerWidth,
          };
        });
        if (response) assert.equal(response.status(), 200);
        else assert.equal(new URL(page.url()).pathname, new URL(area.href, base).pathname);
        assert.match(result.font, /Plus Jakarta Sans.*Inter/);
        assert.equal(result.overflow, false);
        const nav = page.getByRole("navigation", { name: "Main navigation" });
        if (viewport.width < 768 && !(await nav.isVisible())) await page.getByRole("button", { name: "Open menu" }).click();
        await nav.waitFor({ timeout: 10000 });
        for (const group of SHELL_GROUPS) {
          await nav.getByRole("button", { name: new RegExp(`^${group}$`, "i") }).waitFor();
        }
        assert.equal(await nav.getByRole("link").count(), AREAS.length);
        const mono = await page.locator(".font-mono, .tnum, [data-metric]").first().evaluate((node) => ({
          font: getComputedStyle(node).fontFamily,
          numeric: getComputedStyle(node).fontVariantNumeric,
        })).catch(() => null);
        if (mono) {
          assert.match(mono.font, /JetBrains Mono/);
          assert.match(mono.numeric, /tabular-nums/);
        }
        assert.deepEqual(errors.splice(0), []);
      } catch (error) {
        failures.push(`${viewport.width}x${viewport.height} ${area.href}: ${error.message}; console: ${errors.splice(0).join(" | ")}`);
      }
    }
    console.log(`${viewport.width}x${viewport.height}: ${AREAS.length - failures.filter((failure) => failure.startsWith(`${viewport.width}x`)).length}/${AREAS.length} areas passed`);
    await context.close();
  }
} finally {
  await browser.close();
}

if (failures.length) {
  console.error(failures.join("\n"));
  process.exitCode = 1;
}
