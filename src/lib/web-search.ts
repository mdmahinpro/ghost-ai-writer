import { firecrawlSearch, scrapePage, tavilySearch } from "./providers.functions";
import { useApp } from "./store";
import { webSearchPlan, type WebProvider } from "./web-search-plan";
import type { WebSearchKey, WebSearchMode } from "./types";

export { webSearchPlan };
export type { WebProvider };

export type WebResult = { title: string; url: string; snippet: string; provider: WebProvider };

export type ScrapeOutcome =
  | { ok: true; title: string; markdown: string; provider: WebProvider }
  | { ok: false; error: string };

const COOLDOWN_MS = 5 * 60_000;

function config() {
  return useApp.getState().webSearch;
}

export function webSearchStatus(): { mode: WebSearchMode; tavily: number; firecrawl: number; label: string } {
  const cfg = config();
  const tavily = cfg.tavilyKeys.filter((key) => !key.disabled).length;
  const firecrawl = cfg.firecrawlKeys.filter((key) => !key.disabled).length;
  const label =
    cfg.mode === "off"
      ? "Off — no live web context"
      : `${cfg.mode} · ${cfg.mode === "tavily" || cfg.mode === "auto-fallback" ? `${tavily} Tavily` : ""}${cfg.mode === "auto-fallback" ? " + " : ""}${cfg.mode === "firecrawl" || cfg.mode === "auto-fallback" ? `${firecrawl} Firecrawl` : ""}`;
  return { mode: cfg.mode, tavily, firecrawl, label };
}

function markSuccess(key: WebSearchKey) {
  useApp.getState().setWebSearchKey(key.id, { failCount: 0, lastError: undefined, lastUsedAt: Date.now() });
}

function markFailure(key: WebSearchKey, status: number, error: string) {
  const dead = status === 401 || status === 403;
  useApp.getState().setWebSearchKey(key.id, {
    failCount: key.failCount + 1,
    disabled: dead || key.failCount + 1 >= 4,
    cooldownUntil: status === 429 || status >= 500 || status === 0 ? Date.now() + COOLDOWN_MS : key.cooldownUntil,
    lastError: error,
  });
}

/**
 * Rule 5 — unified live web search.
 * Mode Off returns nothing. Tavily / Firecrawl run their own pool in failover
 * order. Auto-Fallback tries Tavily then Firecrawl, whichever keys exist.
 */
export async function searchWeb(query: string, maxResults = 5): Promise<{ results: WebResult[]; errors: string[] }> {
  const cfg = config();
  const trimmed = query.trim();
  if (!trimmed) return { results: [], errors: [] };
  const plan = webSearchPlan(cfg.mode, cfg.tavilyKeys.length > 0, cfg.firecrawlKeys.length > 0);
  const errors: string[] = [];
  for (const provider of plan) {
    const key = useApp.getState().takeWebSearchKey(provider);
    if (!key) {
      errors.push(`${provider}: no live key available`);
      continue;
    }
    const result =
      provider === "tavily"
        ? await tavilySearch({ data: { apiKey: key.secret, query: trimmed, maxResults } })
        : await firecrawlSearch({ data: { apiKey: key.secret, query: trimmed, maxResults } });
    if (result.ok) {
      markSuccess(key);
      return { results: result.results.map((row) => ({ ...row, provider })), errors };
    }
    markFailure(key, result.status ?? 0, result.error);
    errors.push(`${provider}: ${result.error}`);
  }
  return { results: [], errors };
}

/**
 * Rule 5 — scrape one URL. Uses the Firecrawl pool (page fetch is Firecrawl's
 * strength). Respects the switch: Off refuses so the operator knows why nothing
 * was fetched.
 */
export async function scrapeSource(url: string): Promise<ScrapeOutcome> {
  const cfg = config();
  if (cfg.mode === "off") return { ok: false, error: "Web search is Off. Turn it on in Settings → AI Keys & Usage to fetch live sources." };
  if (!cfg.firecrawlKeys.length) return { ok: false, error: "No Firecrawl key saved. Add one to scrape live sources." };
  let last = "No Firecrawl key answered.";
  for (let index = 0; index < cfg.firecrawlKeys.length; index++) {
    const key = useApp.getState().takeWebSearchKey("firecrawl");
    if (!key) break;
    const result = await scrapePage({ data: { apiKey: key.secret, url } });
    if (result.ok) {
      markSuccess(key);
      return { ok: true, title: result.title, markdown: result.markdown, provider: "firecrawl" };
    }
    last = result.error;
    markFailure(key, 0, result.error);
  }
  return { ok: false, error: last };
}

/** One-line summary for activity logs and notices. */
export function webSearchSummary(): string {
  const status = webSearchStatus();
  return status.label;
}
