/**
 * Rule 7 — custom theme system.
 * Six hand-built themes, all our own. Each one must define the COMPLETE token
 * set (styles.css mirrors these values under `html[data-theme="…"]`, and the
 * release gate test compares the two so they can never drift).
 */

export const THEMES = [
  { id: "midnight", label: "Midnight", canvas: "#09090b", accent: "#818cf8" },
  { id: "paper", label: "Paper", canvas: "#fafafa", accent: "#4338ca" },
  { id: "forest", label: "Forest", canvas: "#0c1410", accent: "#3ecf8e" },
  { id: "rose", label: "Rose", canvas: "#fbf4f6", accent: "#be3a5a" },
  { id: "sepia", label: "Sepia", canvas: "#f4efe4", accent: "#8a5424" },
  { id: "ocean", label: "Ocean", canvas: "#06141c", accent: "#2aa7c9" },
] as const;

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
    if (saved === "light") return "paper";
    if (saved === "dark" || saved == null || saved === "") return "midnight";
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
