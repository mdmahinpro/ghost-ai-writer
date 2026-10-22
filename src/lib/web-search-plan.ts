/**
 * Rule 5 — pure provider-plan logic for the web-search switch.
 * Kept in its own module (no store / browser imports) so it is unit-testable.
 */
import type { WebSearchMode } from "./types";

export type WebProvider = "tavily" | "firecrawl";

export function webSearchPlan(mode: WebSearchMode, hasTavily: boolean, hasFirecrawl: boolean): WebProvider[] {
  if (mode === "tavily") return ["tavily"];
  if (mode === "firecrawl") return ["firecrawl"];
  if (mode === "auto-fallback") {
    if (hasTavily && hasFirecrawl) return ["tavily", "firecrawl"];
    if (hasTavily) return ["tavily"];
    if (hasFirecrawl) return ["firecrawl"];
    return [];
  }
  return [];
}
