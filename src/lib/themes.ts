/**
 * Rule 7 — custom theme system.
 * Twelve hand-built themes, all our own. Each one must define the COMPLETE token
 * set (styles.css mirrors these values under `html[data-theme="…"]`, and the
 * release gate test compares the two so they can never drift).
 *
 * `editorial` and `telemetry` are the Mobbin-derived pair: a warm paper
 * workspace (Hilos) and a dark telemetry room (Modal / Fey / SoundCloud), so the
 * app has a light and a dark face built from the same references.
 */

export const THEMES = [
  { id: "midnight", label: "Midnight", canvas: "#09090b", accent: "#818cf8" },
  { id: "paper", label: "Paper", canvas: "#fafafa", accent: "#4338ca" },
  { id: "forest", label: "Forest", canvas: "#0c1410", accent: "#3ecf8e" },
  { id: "rose", label: "Rose", canvas: "#fbf4f6", accent: "#be3a5a" },
  { id: "sepia", label: "Sepia", canvas: "#f4efe4", accent: "#8a5424" },
  { id: "ocean", label: "Ocean", canvas: "#06141c", accent: "#2aa7c9" },
  { id: "editorial", label: "Editorial", canvas: "#faf8f5", accent: "#8a4b2a" },
  { id: "telemetry", label: "Telemetry", canvas: "#090a0c", accent: "#34d399" },
  { id: "crimson", label: "Crimson", canvas: "#0b0709", accent: "#ff1e56" },
  { id: "clay", label: "Clay", canvas: "#fdf6f4", accent: "#b3261e" },
  { id: "graphite", label: "Graphite", canvas: "#010b17", accent: "#5b9dff" },
  { id: "daylight", label: "Daylight", canvas: "#f4f6fa", accent: "#1f5fd0" },
] as const;

/**
 * The reference-matched pair is the default: Graphite is the Revolut-style navy
 * dark room (sampled straight from the Mobbin screen — page #010B17, cards
 * #1E2530, rail #0B274B), and Daylight is its light counterpart.
 */
export const DEFAULT_THEME: ThemeId = "graphite";

export type ThemeId = (typeof THEMES)[number]["id"];

/** Every theme defines all of these, in both TS and CSS. */
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
    bg: "#09090b",
    elev: "#111114",
    surface: "#18181c",
    "surface-2": "#242429",
    line: "#303036",
    "line-strong": "#474750",
    fg: "#f4f4f5",
    muted: "#b4b4bd",
    faint: "#8c8c98",
    brass: "#818cf8",
    "brass-2": "#c7d2fe",
    ink: "#101020",
    ok: "#3dcfb0",
    danger: "#fb7185",
    paper: "#f4f7fb",
    "paper-ink": "#0d1524",
    "paper-muted": "#52627a",
  },
  paper: {
    bg: "#fafafa",
    elev: "#ffffff",
    surface: "#ffffff",
    "surface-2": "#f4f4f5",
    line: "#e4e4e7",
    "line-strong": "#a1a1aa",
    fg: "#18181b",
    muted: "#52525b",
    faint: "#71717a",
    brass: "#4338ca",
    "brass-2": "#312e81",
    ink: "#ffffff",
    ok: "#0f8f72",
    danger: "#c4364e",
    paper: "#ffffff",
    "paper-ink": "#0d1524",
    "paper-muted": "#52627a",
  },
  forest: {
    bg: "#0c1410",
    elev: "#121c16",
    surface: "#17261c",
    "surface-2": "#203528",
    line: "#2c4636",
    "line-strong": "#3d6450",
    fg: "#e7f5ec",
    muted: "#a3c4b0",
    faint: "#7d9e8c",
    brass: "#3ecf8e",
    "brass-2": "#b7f0d2",
    ink: "#052016",
    ok: "#5ee0a0",
    danger: "#ff8b7a",
    paper: "#f3faf5",
    "paper-ink": "#122117",
    "paper-muted": "#3f5c4c",
  },
  rose: {
    bg: "#fbf4f6",
    elev: "#ffffff",
    surface: "#ffffff",
    "surface-2": "#f6e4ea",
    line: "#ecd3dc",
    "line-strong": "#d7aebc",
    fg: "#2a1219",
    muted: "#6b3c4b",
    faint: "#8a5566",
    brass: "#be3a5a",
    "brass-2": "#6e1e34",
    ink: "#fff7f8",
    ok: "#0f7a56",
    danger: "#a61b32",
    paper: "#fff8fa",
    "paper-ink": "#2a1219",
    "paper-muted": "#6d4554",
  },
  sepia: {
    bg: "#f4efe4",
    elev: "#fffaf3",
    surface: "#fffaf3",
    "surface-2": "#efe4d2",
    line: "#e0d0b8",
    "line-strong": "#c4ae8e",
    fg: "#2a2118",
    muted: "#5e4b38",
    faint: "#74604c",
    brass: "#8a5424",
    "brass-2": "#5c3816",
    ink: "#fff8ee",
    ok: "#2f6b45",
    danger: "#9c2f2f",
    paper: "#fbf6ee",
    "paper-ink": "#2a2118",
    "paper-muted": "#5e4e3c",
  },
  ocean: {
    bg: "#06141c",
    elev: "#0a1c28",
    surface: "#0e2433",
    "surface-2": "#143246",
    line: "#1e4660",
    "line-strong": "#2d6588",
    fg: "#e7f4fb",
    muted: "#9ec0d4",
    faint: "#7d9eb3",
    brass: "#2aa7c9",
    "brass-2": "#9be4f5",
    ink: "#041018",
    ok: "#3dcfb0",
    danger: "#ff8a9a",
    paper: "#f3f9fc",
    "paper-ink": "#0c1c28",
    "paper-muted": "#3e5a6c",
  },
  /**
   * Hilos warm editorial workspace. The brief's `#9C968C` faint grey measures
   * 2.77:1 on this canvas and fails the 3:1 gate, so it is darkened to #8A8478
   * (3.50:1) — same warm cast, still legible. Line colours are the brief's
   * rgba(28,27,25,.08/.18) borders flattened onto the canvas, because a theme
   * token must be a hex colour.
   */
  editorial: {
    bg: "#faf8f5",
    elev: "#f7f4ee",
    surface: "#ffffff",
    "surface-2": "#f3f0ea",
    line: "#e8e6e3",
    "line-strong": "#d2d0cd",
    fg: "#1c1b19",
    muted: "#6e6a63",
    faint: "#8a8478",
    brass: "#8a4b2a",
    "brass-2": "#c98a63",
    ink: "#faf8f5",
    ok: "#15803d",
    danger: "#b91c1c",
    paper: "#ffffff",
    "paper-ink": "#1c1b19",
    "paper-muted": "#6e6a63",
  },
  /**
   * Modal / Fey / SoundCloud telemetry room. Emerald is the live-accent, crimson
   * the failure colour, as in the references. Line colours are the brief's
   * rgba(255,255,255,.07/.18) borders flattened onto the canvas.
   */
  telemetry: {
    bg: "#090a0c",
    elev: "#1a1d23",
    surface: "#121418",
    "surface-2": "#0d0e11",
    line: "#1a1b1d",
    "line-strong": "#35363a",
    fg: "#f3f4f6",
    muted: "#9ca3af",
    faint: "#6b7280",
    brass: "#34d399",
    "brass-2": "#6ee7b7",
    ink: "#06110c",
    ok: "#34d399",
    danger: "#f87171",
    paper: "#f3f4f6",
    "paper-ink": "#090a0c",
    "paper-muted": "#6b7280",
  },
  /**
   * Posh-style crimson: near-black warm charcoal with the reference's #FF1E56 as
   * the accent. The bar-chart magenta is the same hue, so the whole surface reads
   * red rather than merely carrying a red button.
   */
  crimson: {
    bg: "#0b0709",
    elev: "#14090e",
    surface: "#1a0d13",
    "surface-2": "#220f17",
    line: "#331722",
    "line-strong": "#4a2130",
    fg: "#f9eff2",
    muted: "#cbb0b8",
    faint: "#9d828b",
    brass: "#ff1e56",
    "brass-2": "#ff6f93",
    ink: "#12050a",
    ok: "#4ade80",
    danger: "#f87171",
    paper: "#f9eff2",
    "paper-ink": "#14090e",
    "paper-muted": "#6b5a60",
  },
  /** The light half of the red pair: warm paper with a fired-clay accent. */
  clay: {
    bg: "#fdf6f4",
    elev: "#fbeeea",
    surface: "#ffffff",
    "surface-2": "#f7e6e1",
    line: "#eaddd8",
    "line-strong": "#d8c3bc",
    fg: "#241715",
    muted: "#6f5b56",
    faint: "#8a736d",
    brass: "#b3261e",
    "brass-2": "#d4534a",
    ink: "#fdf6f4",
    ok: "#15803d",
    danger: "#b91c1c",
    paper: "#ffffff",
    "paper-ink": "#241715",
    "paper-muted": "#6f5b56",
  },
  /**
   * Sampled from the reference screen: page #010B17, cards #1E2530, nav rail
   * #0B274B, white text. The accent is the reference's link/nav blue lifted far
   * enough off the canvas to stay legible (7.3:1) instead of the screen's own
   * #0C2E59, which is a surface tint rather than an action colour.
   */
  graphite: {
    bg: "#010b17",
    elev: "#1e2530",
    surface: "#1e2530",
    "surface-2": "#0b274b",
    line: "#2a3341",
    "line-strong": "#3a4757",
    fg: "#ffffff",
    muted: "#9aa7b8",
    faint: "#7c8b9c",
    brass: "#5b9dff",
    "brass-2": "#8dbcff",
    ink: "#03101f",
    ok: "#4ade80",
    danger: "#f87171",
    paper: "#f5f7fa",
    "paper-ink": "#0b1622",
    "paper-muted": "#4a5766",
  },
  /** The same structure in daylight: white cards on a cool grey page. */
  daylight: {
    bg: "#f4f6fa",
    elev: "#ffffff",
    surface: "#ffffff",
    "surface-2": "#eef1f7",
    line: "#e3e8f0",
    "line-strong": "#cbd4e1",
    fg: "#0d1b2a",
    muted: "#5a6b80",
    faint: "#71808f",
    brass: "#1f5fd0",
    "brass-2": "#3f7ae0",
    ink: "#ffffff",
    ok: "#15803d",
    danger: "#b91c1c",
    paper: "#ffffff",
    "paper-ink": "#0d1b2a",
    "paper-muted": "#5a6b80",
  },
};

export function themeTokens(id: ThemeId): ThemeTokens {
  return THEME_TOKENS[id];
}

export function themeLabel(id: ThemeId): string {
  return THEMES.find((theme) => theme.id === id)?.label ?? id;
}

/** Relative luminance + contrast ratio helpers (used by the release gate). */
export function relativeLuminance(hex: string): number {
  const clean = hex.replace("#", "");
  const full = clean.length === 3 ? clean.split("").map((char) => `${char}${char}`).join("") : clean;
  const channels = [0, 2, 4].map((offset) => Number.parseInt(full.slice(offset, offset + 2), 16) / 255);
  const [r, g, b] = channels.map((value) => (value <= 0.03928 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4));
  return 0.2126 * r! + 0.7152 * g! + 0.0722 * b!;
}

export function contrastRatio(a: string, b: string): number {
  const first = relativeLuminance(a);
  const second = relativeLuminance(b);
  const [light, dark] = first > second ? [first, second] : [second, first];
  return (light! + 0.05) / (dark! + 0.05);
}

export function readStoredTheme(): ThemeId {
  try {
    const saved = localStorage.getItem("gaw-theme");
    if (saved === "light") return "daylight";
    if (saved === "dark" || saved == null || saved === "") return DEFAULT_THEME;
    if (THEMES.some((theme) => theme.id === saved)) return saved as ThemeId;
  } catch {
    /* private mode */
  }
  return "midnight";
}

export function applyTheme(id: ThemeId) {
  const theme = THEMES.find((item) => item.id === id) ?? THEMES[0];
  document.documentElement.dataset.theme = theme.id;
  document.documentElement.classList.remove("light");
  try {
    localStorage.setItem("gaw-theme", theme.id);
  } catch {
    /* ignore */
  }
  document.querySelector('meta[name="theme-color"]')?.setAttribute("content", theme.canvas);
  window.dispatchEvent(new Event("gaw-theme"));
}
