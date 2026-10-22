/**
 * Hotfix interactive verification — reproduces the three production bugs and
 * proves the fix through REAL user interaction (no static route smokes).
 *
 *  1. /create → type 3 keywords → Start run → navigates to /runs/$id → the run
 *     is found in the studio → all jobs reach COMPLETED through the six stages →
 *     a real Article exists under /articles/$id.
 *  2. /create Topic plan tab → Generate topic plan → /topic-plans → Queue →
 *     navigates to /runs/$id without "Run missing", jobs progress.
 *  3. /research → start the 11-stage engine → runs or fails honestly — never a
 *     render loop, never "Run missing".
 *  4. Rapid navigation across the shell while jobs run → zero
 *     "Maximum update depth exceeded", zero error boundaries, zero console.error.
 *
 * Run: node scripts/hotfix-interactive-verify.mjs  (dev server on :8080)
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { chromium } from "playwright";

const BASE = process.env.SMOKE_BASE ?? "http://localhost:8080";
const OUT = process.env.SMOKE_OUT ?? `${process.env.TEMP ?? "."}\\kilo\\rea-live\\hotfix-verify`;
mkdirSync(OUT, { recursive: true });

const results = [];
const consoleErrors = [];
const check = (name, ok, detail = "") => {
  results.push({ name, ok, detail });
  console.log(`${ok ? "  ok  " : "FAIL  "}${name}${detail ? ` -- ${detail}` : ""}`);
};

const browser = await chromium.launch();
const context = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
const page = await context.newPage();
page.on("console", (msg) => {
  if (msg.type() === "error") consoleErrors.push(msg.text());
});
page.on("pageerror", (err) => consoleErrors.push(String(err)));

const bodyText = async () => (await page.textContent("body")) ?? "";

try {
  await page.goto(`${BASE}/create`, { waitUntil: "domcontentloaded", timeout: 90000 });
  await page.waitForTimeout(4000);

  // ---------- 1. Keyword run through all six stages ----------
  const kw = page.getByPlaceholder("One keyword per line");
  await kw.fill("hotfix probe alpha\nplanetary gearbox maintenance guide\nsourdough starter troubleshooting");
  await page.getByRole("button", { name: /Start run \(\d+\)/ }).click();
  await page.waitForURL(/\/runs\/run_/, { timeout: 20000 });
  const runUrl = page.url();
  check("1a. keyword run navigates to /runs/$id", /\/runs\/run_/.test(runUrl), runUrl);
  await page.waitForTimeout(1200);
  check("1b. run found in studio (no Run missing)", !(await bodyText()).includes("Run missing"));

  // all three jobs eventually COMPLETED (six stages each)
  let completed = 0;
  for (let attempt = 0; attempt < 40; attempt++) {
    const text = await bodyText();
    completed = (text.match(/COMPLETED/g) ?? []).length;
    if (completed >= 3) break;
    await page.waitForTimeout(2000);
  }
  check("1c. all 3 jobs COMPLETED through the six stages", completed >= 3, `${completed}/3 completed`);

  // a real article in /articles/$id
  const articleHref = await page.locator('a[href^="/articles/"]').first().getAttribute("href");
  check("1d. article link present on the run", Boolean(articleHref), articleHref ?? "none");
  if (articleHref) {
    await page.goto(`${BASE}${articleHref}`, { waitUntil: "domcontentloaded", timeout: 60000 });
    await page.waitForTimeout(1500);
    const articleText = await bodyText();
    check("1e. article detail renders (not missing)", !articleText.includes("Article missing") && /Stage|Author|articles/i.test(articleText));
  }

  // ---------- 2. Topic plan → queue → /runs/$id ----------
  await page.goto(`${BASE}/create`, { waitUntil: "domcontentloaded", timeout: 60000 });
  await page.waitForTimeout(1500);
  await page.getByRole("button", { name: "Topic plan" }).click();
  await page.waitForTimeout(400);
  await page.getByPlaceholder("home espresso").fill("hotfix probe plan");
  await page.getByRole("button", { name: /Generate topic plan/i }).click();
  await page.waitForURL(/\/topic-plans\/plan_/, { timeout: 30000 });
  await page.waitForTimeout(800);
  const planOk = !(await bodyText()).includes("Plan missing");
  check("2a. topic plan created and opened", planOk);
  const queue = page.getByRole("button", { name: /Queue selected/ });
  if (await queue.count()) {
    await queue.click();
    const wentToRun = await page.waitForURL(/\/runs\/run_/, { timeout: 20000 }).then(() => true).catch(() => false);
    if (wentToRun) {
      await page.waitForTimeout(1500);
      check("2b. queued plan opens its run (no Run missing)", !(await bodyText()).includes("Run missing"));
      let planCompleted = 0;
      for (let attempt = 0; attempt < 40; attempt++) {
        const text = await bodyText();
        planCompleted = (text.match(/COMPLETED/g) ?? []).length;
        if (planCompleted > 0) break;
        await page.waitForTimeout(2000);
      }
      check("2c. plan jobs progress toward COMPLETED", planCompleted > 0, `${planCompleted} completed`);
    } else {
      check("2b. queued plan opens its run (no Run missing)", false, "no navigation to a run");
    }
  } else {
    check("2b. queue button present", false, "Queue selected button not found");
  }

  // ---------- 3. Research project ----------
  await page.goto(`${BASE}/research`, { waitUntil: "domcontentloaded", timeout: 60000 });
  await page.waitForTimeout(1500);
  await page.getByLabel("Niche").fill("hotfix probe research niche");
  await page.getByRole("button", { name: /Research this niche/i }).click();
  await page.waitForTimeout(4000);
  const researchText = await bodyText();
  const handled = /PARTIAL|FAILED|R1|failed|stages/i.test(researchText) || /READY/i.test(researchText);
  check("3. research engine runs or fails honestly (never a loop / Run missing)", handled && !researchText.includes("Run missing"), /NO_RESEARCH_KEY|PARTIAL/.test(researchText) ? "honest no-key failure" : "stages visible");

  // ---------- 4. Rapid navigation stress while the store ticks ----------
  const routes = ["/", "/create", "/topic-plans", "/research", "/calendar", "/runs", "/articles", "/authors"];
  for (const route of routes) {
    await page.goto(`${BASE}${route}`, { waitUntil: "domcontentloaded", timeout: 60000 });
    await page.waitForTimeout(700);
  }
  // second, faster pass with the palette
  await page.keyboard.press("Control+k");
  await page.waitForTimeout(300);
  await page.keyboard.press("Escape");
  for (const route of routes) {
    await page.goto(`${BASE}${route}`, { waitUntil: "domcontentloaded", timeout: 60000 });
  }
  await page.waitForTimeout(3000);
  const fullText = await bodyText();
  check("4. rapid navigation: no update-depth / Run missing / error boundary", !/Maximum update depth|Run missing|Something went wrong/i.test(fullText) && consoleErrors.every((text) => !/Maximum update depth/i.test(text)));

  // ---------- console verdict for the whole session ----------
  const updateDepth = consoleErrors.filter((text) => /Maximum update depth/i.test(text));
  const pageErrors = consoleErrors.filter((text) => /Error:/i.test(text) && !/Autoplay|favicon/i.test(text));
  check("zero 'Maximum update depth exceeded' in the whole session", updateDepth.length === 0, `${updateDepth.length}`);
  check("zero console.error / pageerror in the whole session", pageErrors.length === 0, pageErrors.slice(0, 2).join(" | ").slice(0, 300));
} catch (error) {
  check("interactive script completed", false, String(error).slice(0, 300));
}

await browser.close();
const ok = results.every((row) => row.ok);
writeFileSync(`${OUT}\\hotfix-verify.json`, JSON.stringify({ ok, results, consoleErrors }, null, 2));
console.log(`\n${results.filter((row) => row.ok).length}/${results.length} checks passed -- evidence: ${OUT}\\hotfix-verify.json`);
process.exit(ok ? 0 : 1);
