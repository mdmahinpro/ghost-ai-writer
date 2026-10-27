/**
 * Appearance — one design, two modes.
 *
 * The system is Midday's (Mobbin, the finance-ops dashboard): a strictly
 * neutral base, black as the accent, serif display headings over an Inter UI,
 * 12px cards and 8px controls on an 8px rhythm. Nothing in the chrome competes
 * with the content, which is the point for a studio whose subject is text.
 *
 *   · Paper    — white canvas, black accent, light hairlines.
 *   · Midnight — near-black canvas, white accent, dark hairlines.
 *
 * The accent inverts per mode: a black primary button on white, a white one on
 * black. Semantic colour is reserved for state (ok / danger) so a green badge
 * still means "healthy" and not "this is the brand".
 *
 * Every component reads CSS variables off a single
 * `html[data-theme="midnight"|"paper"]`, so switching touches no component
 * code: one attribute, the whole app follows. The 17 tokens below are mirrored
 * verbatim in src/styles.css, which the Rule 7 release gate asserts, so the TS
 * and CSS cannot drift.
 */

export type ThemeId = "midnight" | "paper";

export const THEMES: { id: ThemeId; canvas: string; label: string }[] = [
  { id: "midnight", canvas: "#07080B", label: "Midnight" },
  { id: "paper", canvas: "#F5F7FA", label: "Paper" },
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
    bg: "#07080B",
    elev: "#0D0F14",
    surface: "#0B0D12",
    "surface-2": "#141821",
    line: "#232B38",
    "line-strong": "#38424F",
    fg: "#E9EDF5",
    muted: "#9AA3B4",
    faint: "#7B8698",
    brass: "#34D399",
    "brass-2": "#6EE7B7",
    ink: "#07080B",
    ok: "#10B981",
    danger: "#F87171",
    paper: "#0D0F14",
    "paper-ink": "#E9EDF5",
    "paper-muted": "#9AA3B4",
  },
  paper: {
    bg: "#F5F7FA",
    elev: "#FFFFFF",
    surface: "#FFFFFF",
    "surface-2": "#F0F3F7",
    line: "#E3E7EE",
    "line-strong": "#CBD3DF",
    fg: "#0B1220",
    muted: "#4B5462",
    faint: "#67707E",
    brass: "#047857",
    "brass-2": "#065F46",
    ink: "#FFFFFF",
    ok: "#047857",
    danger: "#B91C1C",
    paper: "#FFFFFF",
    "paper-ink": "#0B1220",
    "paper-muted": "#4B5462",
  },
};

export function themeLabel(id: ThemeId): string {
  return THEMES.find((theme) => theme.id === id)?.label ?? "Paper";
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
