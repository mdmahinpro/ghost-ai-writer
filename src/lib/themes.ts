/**
 * Appearance — one design, two modes.
 *
 * The studio is a single editorial-green console pattern (pattern sources:
 * Supabase's dark console, Semrush and hilos' light dashboards, Klaviyo's SaaS
 * chrome in Mobbin) with exactly two modes:
 *
 *   · Midnight — near-black green canvas for long night sessions.
 *   · Paper    — tinted off-white canvas for bright rooms.
 *
 * Depth comes from a slightly lighter surface plus a 1px hairline border, not
 * from colour drama or stacked shadows. Text is three grades (fg / muted /
 * faint), numbers are mono with tabular figures, and the accent is forest
 * green — actions, links, and live status all sit on it.
 *
 * Every component reads CSS variables from a single
 * `html[data-theme="midnight"|“paper"]`, so switching modes touches no
 * component code: one attribute, the whole app follows. The 17 tokens below
 * are mirrored verbatim in src/styles.css, which the Rule 7 release gate
 * asserts byte-for-byte, so the TS and CSS cannot drift.
 */

export type ThemeId = "midnight" | "paper";

export const THEMES: { id: ThemeId; canvas: string; label: string }[] = [
  { id: "midnight", canvas: "#0a0d0b", label: "Midnight" },
  { id: "paper", canvas: "#f3f5f0", label: "Paper" },
];

export const DEFAULT_THEME: ThemeId = "midnight";

/** Every mode defines all of these, in both TS and CSS. */
export const THEME_TOKEN_KEYS = [
  "bg",
  "elev",
  "surface",
  "surface-2",
  "line",
  "line-strong",
  "fg",
  "muted",
  "faint",
  "brass",
  "brass-2",
  "ink",
  "ok",
  "danger",
  "paper",
  "paper-ink",
  "paper-muted",
] as const;

export type ThemeTokenKey = (typeof THEME_TOKEN_KEYS)[number];
export type ThemeTokens = Record<ThemeTokenKey, string>;

export const THEME_TOKENS: Record<ThemeId, ThemeTokens> = {
  midnight: {
    bg: "#0a0d0b",
    elev: "#101411",
    surface: "#141814",
    "surface-2": "#1c211c",
    line: "#232a24",
    "line-strong": "#36413a",
    fg: "#e8ede8",
    muted: "#9ea99f",
    faint: "#77837a",
    brass: "#62d3a5",
    "brass-2": "#7fe0b8",
    ink: "#08130d",
    ok: "#5ede9e",
    danger: "#f98a8a",
    paper: "#0a0d0b",
    "paper-ink": "#e8ede8",
    "paper-muted": "#9ea99f",
  },
  paper: {
    bg: "#f3f5f0",
    elev: "#eef1ec",
    surface: "#ffffff",
    "surface-2": "#f9faf8",
    line: "#e2e7e0",
    "line-strong": "#cdd6cc",
    fg: "#101511",
    muted: "#545e56",
    faint: "#5f6a5c",
    brass: "#1a4d3a",
    "brass-2": "#236349",
    ink: "#f3f5f0",
    ok: "#1a7a4a",
    danger: "#b91c1c",
    paper: "#ffffff",
    "paper-ink": "#101511",
    "paper-muted": "#545e56",
  },
};

export function themeLabel(id: ThemeId): string {
  return THEMES.find((theme) => theme.id === id)?.label ?? "Midnight";
}

export function contrastRatio(hexA: string, hexB: string): number {
  const channel = (hex: string, index: number): number => {
    const value = parseInt(hex.slice(index, index + 2), 16) / 255;
    return value <= 0.03928 ? value / 12.92 : Math.pow((value + 0.055) / 1.055, 2.4);
  };
  const luminance = (hex: string): number => {
    const h = hex.replace(/^#/, "");
    return 0.2126 * channel(h, 0) + 0.7152 * channel(h, 2) + 0.0722 * channel(h, 4);
  };
  const [la, lb] = [luminance(hexA), luminance(hexB)].sort((x, y) => y - x);
  return (la + 0.05) / (lb + 0.05);
}

/** The twelve-theme era is over: every legacy id maps to the mode it felt
 *  like, so a saved preference keeps its character across the redesign. */
const LEGACY_LIGHT = ["light", "paper", "daylight", "sepia", "rose", "clay", "editorial"];
const LEGACY_DARK = ["dark", "midnight", "forest", "ocean", "telemetry", "crimson", "graphite"];

export function readStoredTheme(): ThemeId {
  try {
    const saved = localStorage.getItem("gaw-theme");
    if (saved && (THEMES.some((theme) => theme.id === saved) || LEGACY_LIGHT.includes(saved) || LEGACY_DARK.includes(saved))) {
      if (LEGACY_LIGHT.includes(saved)) return "paper";
      if (LEGACY_DARK.includes(saved)) return "midnight";
      return saved as ThemeId;
    }
  } catch {
    /* private mode */
  }
  return DEFAULT_THEME;
}

export function applyTheme(id: ThemeId) {
  const theme = THEMES.find((item) => item.id === id) ?? THEMES[0];
  document.documentElement.dataset.theme = theme.id;
  try {
    localStorage.setItem("gaw-theme", theme.id);
  } catch {
    /* ignore */
  }
  document.querySelector('meta[name="theme-color"]')?.setAttribute("content", theme.canvas);
  window.dispatchEvent(new Event("gaw-theme"));
}
