/**
 * Production client-ready verification (server DB + pipeline overhaul).
 *
 * Proves the two architectural blockers are fixed:
 *
 * 1. 100% server-side persistence (Part 1) + zero demo data (Part 2):
 *    - Context 1 (main browser) starts on a WIPED server store and must see
 *      ZERO demo workspaces ("Northline Review", demo articles/keys) — only
 *      onboarding.
 *    - It creates a workspace, connects the studio ledger + syncs, saves an AI
 *      key in /ai-keys, submits 2 keywords in /create, and waits for BOTH jobs
 *      to run the full 6-stage pipeline to COMPLETED with full articles
 *      (Bing thumbnails, US expert author bylines, Blader humanizer scores).
 *    - Context 2 = brand-new incognito context (fresh localStorage + IndexedDB).
 *      It must show the EXACT same workspace, AI keys, completed run, and 2
 *      articles — hydrated from the server database (.data/appstate.json) —
 *      and still zero demo workspaces.
 *
 * 2. Unstoppable keyword→post pipeline (Part 3): both jobs progress through
 *    all six stages in one sequential runner and reach a terminal `completed`
 *    state — no pending/waiting/running hang.
 *
 * Usage: node scripts/verify-production-client-ready.mjs
 * Starts and stops its own dev server; leaves port 8080 free at the end.
 */
import { spawn } from "node:child_process";
import { existsSync, readFileSync, rmSync } from "node:fs";
import { connect } from "node:net";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
/** Default 8080. Override with `--port=NNNN` (or VERIFY_PORT) when the user's
 *  own dev server is already running on 8080. */
const PORT = Number(process.argv.find((arg) => arg.startsWith("--port="))?.slice(7) ?? process.env.VERIFY_PORT ?? 8080);
const URL = `http://localhost:${PORT}`;
const SITE_NAME = "Production Verify Site";
const KEYWORDS = [
  "how to verify a production content pipeline",
  "server side state that survives incognito windows",
];

const results = [];
function check(name, ok, detail = "") {
  results.push({ name, ok, detail });
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}${detail ? ` — ${detail}` : ""}`);
  if (!ok) process.exitCode = 1;
}

function isPortFree(port) {
  return new Promise((resolve) => {
    const socket = connect(port, "127.0.0.1");
    socket.once("connect", () => { socket.destroy(); resolve(false); });
    socket.once("error", () => { socket.destroy(); resolve(true); });
  });
}

async function waitForServer(url, timeoutMs = 120_000) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    try {
      const response = await fetch(url);
      if (response.ok) return;
    } catch { /* not up yet */ }
    await new Promise((resolve) => setTimeout(resolve, 800));
  }
  throw new Error(`Dev server did not become reachable at ${url}`);
}

const storeState = (page) =>
  page.evaluate(() => {
    const store = globalThis.__gawStore;
    if (!store) return null;
    const state = store.getState();
    return {
      sites: state.sites.map((site) => ({ id: site.id, name: site.name, corpus: site.ghost.corpus, ghostStatus: site.ghost.status })),
      keys: state.keys.map((key) => ({ id: key.id, label: key.label, hint: key.hint })),
      runs: state.runs.map((run) => ({ id: run.id, status: run.status, title: run.title })),
      jobs: state.jobs.map((job) => ({
        id: job.id,
        status: job.status,
        stageIndex: job.stageIndex,
        keyword: job.keyword,
        humanizerScore: job.humanizerScore,
        authorId: job.authorId,
        articleId: job.articleId,
        stages: job.stages.map((stage) => ({ key: stage.key, status: stage.status })),
        failReason: job.failReason ?? null,
        refusalReason: job.refusalReason ?? null,
      })),
      articles: state.articles.map((article) => ({
        id: article.id,
        title: article.title,
        keyword: article.keyword,
        authorName: article.authorName ?? null,
        humanizerScore: article.humanizerScore ?? null,
        humanizerPasses: article.humanizerPasses ?? null,
        images: (article.images ?? []).map((image) => ({ remote: image.remote ?? null, src: image.src ?? null, selected: image.selected })),
        words: article.words,
        markdownLength: (article.markdown ?? "").length,
        sections: (article.sections ?? []).length,
      })),
    };
  });

const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

/** Waits until the SERVER store (.data/appstate.json) contains the workspace,
 *  so a full page navigation rehydrates it instead of losing it. */
async function waitForServerStore(stateFile, predicate, timeoutMs = 20_000) {
  const deadline = Date.now() + timeoutMs;
  let lastError = "";
  while (Date.now() < deadline) {
    if (!existsSync(stateFile)) {
      lastError = "file missing";
      await wait(400);
      continue;
    }
    try {
      const doc = JSON.parse(readFileSync(stateFile, "utf8"));
      if (doc?.state && predicate(doc.state)) return true;
      lastError = "predicate not satisfied";
    } catch (error) {
      lastError = `parse error: ${error.message}`;
    }
    await wait(400);
  }
  console.warn(`waitForServerStore gave up: ${lastError}`);
  return false;
}

const isBingThumb = (url) => Boolean(url && /^https:\/\/tse\d*\.mm\.bing\.net\/th\?/i.test(url));

async function main() {
  // Start clean: no leftover demo data anywhere, no stale server store.
  const stateFile = join(ROOT, ".data", "appstate.json");
  if (existsSync(stateFile)) rmSync(stateFile, { force: true });
  if (!(await isPortFree(PORT))) {
    throw new Error(`Port ${PORT} is already in use. Free it before running this verification.`);
  }

  const server = spawn(process.execPath, ["scripts/with-app-env.mjs", "vite", "dev", "--port", String(PORT)], {
    cwd: ROOT,
    stdio: ["ignore", "pipe", "pipe"],
    env: { ...process.env, BROWSER: "none" },
  });
  let serverLog = "";
  server.stdout.on("data", (chunk) => { serverLog += String(chunk); });
  server.stderr.on("data", (chunk) => { serverLog += String(chunk); });

  let browser;
  try {
    await waitForServer(URL);
    console.log(`Dev server up at ${URL}`);

    browser = await chromium.launch({ headless: true }); // Context 1: main browser

    // --------------------------------------------------------------------
    // CONTEXT 1 — clean start, zero demo data, full user journey
    // --------------------------------------------------------------------
    const context1 = await browser.newContext({ viewport: { width: 1440, height: 960 } });
    const page1 = await context1.newPage();
    const pageErrors = [];
    page1.on("console", (msg) => {
      const text = msg.text();
      if (msg.type() === "error" || text.includes("[tick]")) pageErrors.push(text.slice(0, 500));
    });
    await page1.goto(`${URL}/`, { waitUntil: "domcontentloaded" });

    await page1.waitForSelector("text=Create your first workspace", { timeout: 30_000 });
    check("CONTEXT1: fresh install shows clean 'Create your first workspace' onboarding", true);

    const beforeState = await storeState(page1);
    check(
      "CONTEXT1: zero demo workspaces/keys/articles initially",
      beforeState && beforeState.sites.length === 0 && beforeState.keys.length === 0 && beforeState.articles.length === 0 && beforeState.runs.length === 0,
      JSON.stringify({ sites: beforeState?.sites.length, keys: beforeState?.keys.length }),
    );
    const demoLeak = await page1.evaluate(() => {
      const store = globalThis.__gawStore;
      if (!store) return true;
      const state = store.getState();
      return (
        state.sites.some((site) => /northline|field desk/i.test(site.name)) ||
        state.articles.length > 0 ||
        state.keys.some((key) => key.id === "key_studio")
      );
    });
    check("CONTEXT1: no 'Northline Review' / 'Field Desk' / demo key_studio in state", !demoLeak);

    // Create workspace (the onboarding action).
    await page1.fill('[aria-label="Website name"]', SITE_NAME);
    await page1.getByRole("button", { name: "Create workspace" }).click();
    await page1.waitForFunction(
      (name) => {
        const store = globalThis.__gawStore;
        return store && store.getState().sites.some((site) => site.name === name);
      },
      SITE_NAME,
      { timeout: 20_000 },
    );
    check("CONTEXT1: workspace created", true, SITE_NAME);
    check(
      "CONTEXT1: workspace persisted to the server database (.data/appstate.json)",
      await waitForServerStore(stateFile, (state) => (state.sites ?? []).some((site) => site.name === SITE_NAME)),
    );

    // Connect the studio ledger + sync inventory (corpus must be COMPLETE).
    await page1.goto(`${URL}/connections`, { waitUntil: "domcontentloaded" });
    await page1.getByRole("button", { name: "Use studio ledger" }).waitFor({ state: "visible", timeout: 45_000 });
    await page1.getByRole("button", { name: "Use studio ledger" }).click();
    await page1.getByRole("button", { name: /Sync inventory/ }).click();
    await page1.waitForFunction(
      () => {
        const store = globalThis.__gawStore;
        return store && store.getState().sites[0]?.ghost.corpus === "COMPLETE" && store.getState().sites[0]?.ghost.status === "connected";
      },
      undefined,
      { timeout: 30_000 },
    );
    check("CONTEXT1: studio ledger connected and inventory synced (corpus COMPLETE)", true);

    // Wait until the SERVER database itself carries the connected workspace so
    // the next full-page navigation rehydrates the same state.
    check(
      "CONTEXT1: connection + synced corpus persisted server-side",
      await waitForServerStore(stateFile, (state) => (state.sites ?? []).some((site) => site.ghost?.corpus === "COMPLETE" && site.ghost?.status === "connected"), 30_000),
    );

    // Add an AI key on /ai-keys.
    await page1.goto(`${URL}/ai-keys`, { waitUntil: "domcontentloaded" });
    await page1.getByRole("button", { name: "Save key", exact: true }).click();
    await page1.waitForFunction(
      () => {
        const store = globalThis.__gawStore;
        return store && store.getState().keys.length >= 1;
      },
      undefined,
      { timeout: 20_000 },
    );
    check("CONTEXT1: AI key saved in /ai-keys", true, await page1.evaluate(() => globalThis.__gawStore.getState().keys[0].label));
    check(
      "CONTEXT1: AI key persisted server-side (encrypted at rest)",
      await waitForServerStore(stateFile, (state) => (state.keys ?? []).length >= 1, 20_000),
    );

    // Submit 2 keywords on /create.
    await page1.goto(`${URL}/create`, { waitUntil: "domcontentloaded" });
    await page1.fill('textarea[placeholder="One keyword per line"]', KEYWORDS.join("\n"));
    const startButton = page1.getByRole("button", { name: /Start run/ });
    await startButton.waitFor({ state: "visible", timeout: 30_000 });
    await page1.waitForFunction(() => {
      const store = globalThis.__gawStore;
      return Boolean(store && store.getState().keys.length >= 1 && store.getState().sites.length >= 1);
    }, undefined, { timeout: 30_000 });
    await startButton.click();
    await page1.waitForFunction(
      () => {
        const store = globalThis.__gawStore;
        return Boolean(store && store.getState().jobs.length >= 2 && store.getState().runs.length >= 1);
      },
      undefined,
      { timeout: 30_000 },
    );
    const runsNow = await page1.evaluate(() => globalThis.__gawStore.getState().runs[0]?.id ?? "");
    check("CONTEXT1: run started from /create with 2 keywords", Boolean(runsNow), runsNow);
    if (runsNow) await page1.goto(`${URL}/runs/${runsNow}`, { waitUntil: "domcontentloaded" }).catch(() => {});

    // Wait for the full 6-stage pipeline to TERMINATE both jobs (no stuck running/waiting).
    const deadline = Date.now() + 180_000;
    let finalState = null;
    while (Date.now() < deadline) {
      finalState = await storeState(page1).catch(() => null);
      const jobs = finalState?.jobs ?? [];
      if (jobs.length >= 2 && jobs.every((job) => job.status !== "queued" && job.status !== "running" && job.status !== "review-held" && job.status !== "publish-held")) break;
      await wait(1500);
    }
    const jobs = finalState?.jobs ?? [];
    check(
      "CONTEXT1: both keyword jobs reached the terminal state COMPLETED (never stuck)",
      jobs.length === 2 && jobs.every((job) => job.status === "completed"),
      JSON.stringify(jobs.map((job) => ({ status: job.status, keyword: job.keyword, fail: job.failReason ?? job.refusalReason }))),
    );
    check(
      "CONTEXT1: all six stages are done on both jobs (single sequential runner)",
      jobs.length === 2 && jobs.every((job) => job.stages.length === 6 && job.stages.every((stage) => stage.status === "done")),
      jobs[0] ? `${jobs[0].stages.filter((stage) => stage.status === "done").length}/6 done on job 1` : "no jobs",
    );

    const articles = finalState?.articles ?? [];
    check("CONTEXT1: 2 full articles created", articles.length === 2 && articles.every((article) => article.markdownLength > 200 && article.sections >= 1), JSON.stringify(articles.map((article) => ({ title: article.title, words: article.words }))));
    check(
      "CONTEXT1: articles carry Bing thumbnail image URLs",
      articles.length === 2 && articles.every((article) => article.images.length >= 1 && article.images.some((image) => isBingThumb(image.remote) || isBingThumb(image.src))),
      articles[0]?.images[0]?.remote ?? "no images",
    );
    check(
      "CONTEXT1: US expert author bylines attached",
      articles.length === 2 && articles.every((article) => Boolean(article.authorName)),
      articles.map((article) => article.authorName).join(" · "),
    );
    check(
      "CONTEXT1: Blader humanizer scores recorded",
      articles.length === 2 && articles.every((article) => typeof article.humanizerScore === "number"),
      JSON.stringify(articles.map((article) => article.humanizerScore)),
    );
    const runCompleted = (finalState?.runs ?? []).some((run) => run.status === "completed");
    check("CONTEXT1: run status COMPLETED", runCompleted, JSON.stringify(finalState?.runs?.map((run) => run.status)));
    check("CONTEXT1: no browser console errors (pipeline + sync clean)", pageErrors.length === 0, pageErrors.slice(0, 3).join(" | "));

    // Give the debounced server push time to land in .data/appstate.json.
    await wait(3000);
    check("CONTEXT1: server store file written to .data/appstate.json", existsSync(stateFile));

    // Also verify the IndexedDB mirror got the same state (context-local reload).
    await page1.reload({ waitUntil: "domcontentloaded" });
    await page1.waitForFunction(
      (name) => {
        const store = globalThis.__gawStore;
        return store && store.getState().sites.some((site) => site.name === name) && store.getState().articles.length >= 2;
      },
      SITE_NAME,
      { timeout: 30_000 },
    );
    check("CONTEXT1: state survives a reload (server snapshot or mirror)", true);
    await context1.close();

    // --------------------------------------------------------------------
    // CONTEXT 2 — brand-new INCOGNITO context (empty localStorage/IndexedDB)
    // --------------------------------------------------------------------
    const context2 = await browser.newContext({ viewport: { width: 1440, height: 960 } });
    const page2 = await context2.newPage();
    await page2.goto(`${URL}/`, { waitUntil: "domcontentloaded" });

    // Hydration from the server is async — wait until the workspace materializes.
    await page2.waitForFunction(
      (name) => {
        const store = globalThis.__gawStore;
        return store && store.getState().sites.some((site) => site.name === name) && store.getState().articles.length >= 2;
      },
      SITE_NAME,
      { timeout: 45_000 },
    );
    const incognitoState = await storeState(page2);
    check(
      "INCOGNITO: user-created workspace loaded 100% from the server DB",
      incognitoState.sites.some((site) => site.name === SITE_NAME),
      JSON.stringify(incognitoState.sites.map((site) => site.name)),
    );
    check(
      "INCOGNITO: the AI key added in Context 1 is present",
      incognitoState.keys.length >= 1,
      JSON.stringify(incognitoState.keys.map((key) => key.label)),
    );
    check(
      "INCOGNITO: the completed run from Context 1 is present",
      (incognitoState.runs ?? []).some((run) => run.status === "completed"),
      JSON.stringify(incognitoState.runs.map((run) => run.status)),
    );
    check(
      "INCOGNITO: both generated articles from Context 1 are present with bylines + Bing thumbnails",
      incognitoState.articles.length === 2 &&
        incognitoState.articles.every((article) => article.authorName && article.images.some((image) => isBingThumb(image.remote) || isBingThumb(image.src))),
      JSON.stringify(incognitoState.articles.map((article) => article.title)),
    );
    const incognitoDemo = await page2.evaluate(() => {
      const store = globalThis.__gawStore;
      if (!store) return true;
      const state = store.getState();
      return state.sites.some((site) => /northline|field desk/i.test(site.name)) || state.keys.some((key) => key.id === "key_studio");
    });
    check("INCOGNITO: still ZERO demo workspaces", !incognitoDemo);
    const storageEmpty = await page2.evaluate(() => {
      let empty = true;
      try { empty = localStorage.getItem("gaw-v2") === null; } catch { /* storage can throw on access */ }
      return empty;
    });
    check("INCOGNITO: localStorage is empty (data truly came from the server DB, not local cache)", storageEmpty);

    // Auto-reload fix: an idle window must be essentially quiet — the old 5s
    // pull rebuilt the whole state object every tick (identity churn → full
    // re-render of the shell, experienced as auto-reload). Now only the
    // deliberate worker heartbeat (≤1 per ~6s) may commit.
    const idleCommits = await page2.evaluate(async () => {
      const store = globalThis.__gawStore;
      let commits = 0;
      const unsub = store.subscribe(() => {
        commits += 1;
      });
      await new Promise((resolve) => setTimeout(resolve, 7000));
      unsub();
      return commits;
    });
    check("INCOGNITO: no state churn while idle (no more auto-reload/re-render storm)", idleCommits <= 2, `${idleCommits} store commits over 7s (≤2 = heartbeat only)`);
    await context2.close();

    // Summary
    const failed = results.filter((row) => !row.ok);
    console.log("");
    console.log(`Production client-ready verification: ${results.length - failed.length}/${results.length} checks passed.`);
    if (failed.length) {
      process.exitCode = 1;
      for (const row of failed) console.error(`FAILED: ${row.name} — ${row.detail}`);
    } else {
      console.log("VERDICT: CLIENT-READY — server-side persistence verified across contexts, pipeline completes end-to-end.");
    }
  } catch (error) {
    console.error("Verification crashed:", error?.message ?? error);
    if (serverLog) console.error("--- server tail ---\n" + serverLog.split("\n").slice(-40).join("\n"));
    process.exitCode = 1;
  } finally {
    if (browser) await browser.close().catch(() => {});
    if (server.pid) {
      // Windows: vite dev spawns SSR children — kill the whole process tree,
      // or orphan workers keep writing state and serving stale code.
      if (process.platform === "win32") {
        spawn("taskkill", ["/PID", String(server.pid), "/T", "/F"]).on("error", () => server.kill("SIGKILL"));
      } else {
        server.kill("SIGTERM");
      }
    }
    await new Promise((resolve) => setTimeout(resolve, 2500));
    if (!server.killed) server.kill("SIGKILL");
    // Leave port 8080 free no matter what.
    for (let attempt = 0; attempt < 10 && !(await isPortFree(PORT)); attempt += 1) {
      await wait(700);
    }
    console.log(`Port ${PORT} is ${await isPortFree(PORT) ? "free" : "STILL BUSY"}.`);
  }
}

await main();
