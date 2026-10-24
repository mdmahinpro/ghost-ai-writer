# Design spec — Ghost AI Writer

Redesign of the existing 24-screen app, grounded in three Mobbin references. This is a
**system-first** rebuild: tokens and primitives decide the look, so every screen changes
together instead of drifting per page.

## References (what each one gives us)

| reference | what we take | what we do *not* take |
|---|---|---|
| [AirOps — campaign home](https://mobbin.com/screens/5df1c6e4-b94a-4a91-a085-11fe97d5443c) | app shell: 260px sidebar, `+ Create` as the first thing in it, grouped collapsible nav, footer with Upgrade/More/Settings; serif display headline paired with sans UI; pill quick actions under a prompt field | their green brand colour, their copy |
| [Unify — scheduled tasks](https://mobbin.com/screens/4efc49e6-8bf9-492c-b953-1b51abb95b69) | monochrome base with exactly one accent, white cards on a tinted page, 8–12px card radius, generous page padding | modal-first layout, orange dots |
| [Plane — pages list](https://mobbin.com/screens/67893578-2fa9-4dce-8c52-f1fcce15aa4d) | list grammar: breadcrumb header with one primary action on the right, tab row with underline, filter bar directly under it, 44px rows, right-aligned row actions | blue accent, 4px radii (too tight at our density) |

Density rule of thumb from the three: **lists are dense (44px rows), pages are airy**
(32px padding, 24px between blocks). Headings carry the personality, chrome stays quiet.

## Design language — "Editorial Ops"

A writing tool should look like it belongs to writers: warm paper, near-black ink, one
serif voice for titles, and a single restrained accent used only for actions and live
status. No gradient, no glow, no purple.

### Colour tokens (light — `paper`, default)

| token | value | use |
|---|---|---|
| `bg` | `#FBFAF7` | page background (warm, not grey) |
| `elev` | `#FFFFFF` | cards, popovers |
| `surface` | `#F5F3EE` | inset rows, sidebar, table header |
| `surface-2` | `#EDEAE3` | hover on surface |
| `line` | `#E3DFD6` | 1px borders everywhere |
| `line-strong` | `#CFC9BC` | hover borders, dividers on emphasis |
| `fg` | `#171613` | primary text (15.9:1 on `bg`) |
| `muted` | `#5E594F` | secondary text (7.4:1) |
| `faint` | `#8B857A` | tertiary, captions (4.6:1 — still AA) |
| `accent` | `#14654A` | primary actions, links, active nav |
| `accent-hover` | `#0E4B37` | hover/press |
| `on-accent` | `#FFFFFF` | text on accent (7.1:1) |
| `ok` | `#14654A` | completed |
| `warn` | `#A8621B` | review-held, partial |
| `danger` | `#B3261E` | failed, destructive |

Dark (`midnight`) mirrors the same structure on `#101010` / `#171715` / `#1F1F1C` with
`fg #F2EFE8`, `accent #55C79B`, `on-accent #08110D`. `forest`, `sepia`, `rose`, `ocean`
keep their names and hue families but are re-tuned to the same luminance ramps, so every
theme passes the same contrast bar.

### Type

| role | family | size / weight / tracking |
|---|---|---|
| display | Instrument Serif (400) | 34/38 desktop, 28/32 mobile, `-0.01em` |
| h1 | Inter 600 | 22/28, `-0.02em` |
| h2 | Inter 600 | 17/24, `-0.01em` |
| body | Inter 400 | 14/22 |
| ui label | Inter 500 | 13/18 |
| caption / eyebrow | Inter 600 | 11/16, `+0.08em`, uppercase |
| data / id | JetBrains Mono 500 | 12/18, tabular numerals |

Body stays 14px because the app is dense; prose the user *reads* (article body, preview)
uses 17/30 with `text-wrap: pretty` and a 68ch measure.

### Space, radius, elevation

- 4px base scale: 4 8 12 16 20 24 32 40 48 64.
- Page padding 32 desktop / 20 mobile; block gap 24; card padding 20.
- Radius: `sm 6` (inputs, chips) · `md 10` (buttons, cards) · `lg 14` (panels, modals) · `full` (pills, avatars).
- Elevation: `xs` `0 1px 2px rgb(23 22 19 / .06)` on cards; `sm` for popovers; **no shadow on nav**.
- Focus: `0 0 0 2px var(--color-bg), 0 0 0 4px color-mix(in oklab, var(--color-accent) 45%, transparent)` — visible on every theme.

## Shell

```
┌───────────────┬──────────────────────────────────────────────┐
│ brand + ws    │ breadcrumb ········ status · ⌘K · avatar     │ 56px topbar
│ + Create      ├──────────────────────────────────────────────┤
│ ─────────     │                                              │
│ WORKSPACE     │  page: display title + one primary action    │
│  Overview     │  tabs / filter bar                           │
│  Articles     │  content (cards or 44px rows)                │
│  Runs         │                                              │
│  Research     │                                              │
│  Calendar     │                                              │
│ ─────────     │                                              │
│ SETTINGS      │                                              │
│  Website      │                                              │
│  Keys         │                                              │
│ ─────────     │                                              │
│ Upgrade       │                                              │
│ Settings ⚙    │                                              │
└───────────────┴──────────────────────────────────────────────┘
```

- Sidebar 260px, `surface` background, no right border (contrast separates it).
- Active item: `accent` at 8% + `accent` text + 2px left bar. Never a filled pill.
- Group labels: caption style, collapsible, state remembered.
- Below 768px the sidebar is gone entirely: navigation is the bottom tab bar plus the
  drawer behind "More"; every table collapses to a stacked card list; page padding 16;
  **zero horizontal overflow at 390px**.

### Responsive shell (device pass)

One markup tree, three modes, all driven by `--shell-rail` / `--shell-panel` /
`--tabbar-h` in `@theme` — never by JS width listeners:

| width | sidebar | navigation | page padding |
|---|---|---|---|
| < 768 | hidden | 5-slot bottom tab bar (`Overview · Articles · Create · Calendar · More`), More opens the full drawer | 16 + 82 bottom (clears the bar) |
| 768–1279 | 72px icon rail, labels screen-reader-only, group words replaced by hairlines | rail only | 32 |
| ≥ 1280 | 240px panel, labels + collapsible groups | panel + ⌘K palette | 32 |

References for this pass, and what each one settles:
[Supabase](https://mobbin.com/screens/5a658394-5d52-49f1-816e-381f7700b08d) (dense rail,
data-first panels), [Amplitude](https://mobbin.com/screens/948986c4-509e-43d9-8a3f-eaac0f560f9f)
(KPI row that survives 390px as a 2×2), [Twenty](https://mobbin.com/sites/sections/abe261e4-d901-42f1-bea3-0a806e2d0669)
and [ClickUp](https://mobbin.com/sites/sections/8327bdfc-5c9d-4240-b4af-9431eebd0f9e) for the
public landing rhythm.

- Safe areas: `viewport-fit=cover` + `env(safe-area-inset-*)` (header top, tab bar bottom,
  toast offset) so a standalone install is edge-to-edge on notched phones.
- PWA identity: `name` Ghost AI Writer, 192/512 **any** + 512 **maskable** icons rendered
  from the studio mark (`node scripts/render-icons.mjs`), paper background — the installability
  floor Chrome requires, so "Add to Home Screen" gives a real app icon, not a shortcut.
- Phone type ramp: page titles 24px (36 from `sm`), KPI values 24px (36 from `sm`).
- A web app cannot choose the browser or force a private window; installable standalone is
  the honest ceiling for "opens like an app".

### Previewing the UI without the admin token

The studio talks to the deployed Rust API, which needs `GAW_ADMIN_TOKEN`. For UI work run the
fixture server instead — it answers the state + lease routes from this workspace's own
`.data/appstate.json` and 200s everything else:

```bash
node scripts/ui-preview-api.mjs &                 # :8787
VITE_GAW_API=http://127.0.0.1:8787 npm run dev    # :8080 (not 5173 — strictPort in vite.config)
```

The token gate reads `sessionStorage` once at mount, so unlock it with a stub and reload:

```js
sessionStorage.setItem('gaw_admin_token', 'ui-preview'); location.reload()
```

Fixture previews never claim the dispatch lease (`granted: false`), so a preview tab cannot
run jobs against real state.

## Component inventory (what each screen is built from)

`Button` (primary / secondary / ghost / danger / quiet, `sm` 32 · `md` 40 · `lg` 48),
`IconButton`, `Card`, `Panel`, `StatTile`, `Badge` (status dot + label), `Tabs`
(underline), `FilterBar` (search + 2 selects + sort), `DataList` (44px row, 3 columns:
primary, meta, actions), `EmptyState`, `InlineAlert`, `Field` (label + hint + error),
`Select`, `Toggle`, `Modal`, `Drawer`, `Toast`, `ProgressSteps` (six-stage pipeline),
`StageTimeline` (per-article), `LintReport` (score + findings), `CodeBlock`, `Avatar`,
`ThemePicker`, `CommandPalette` (⌘K).

## Per-screen layout

| screen | reference | layout |
|---|---|---|
| Overview | AirOps | display headline + one-line status sentence, prompt-style "New article" field with 3 pill quick actions, then 3 stat tiles and the last 6 runs as rows |
| Articles | Plane | breadcrumb + `New article`, status tabs (All · Drafting · Review held · Published), filter bar, 44px rows with title / keyword / stage progress / actions |
| Article detail | — | two columns ≥1280: prose (17/30, 68ch) + sticky rail (stage timeline, lint, image, links, publish); tabs on mobile |
| Runs | Plane | rows with run id (mono), article count, spend, duration, status; detail page = stage-by-stage timeline with tokens/cost per stage |
| Research / Topic plans | Plane | master list + detail panel, 11-stage progress chips |
| Calendar | — | month grid, day cells with 2-line article chips, side panel for the selected day |
| Analytics | Unify | 4 stat tiles then one chart card and one table card; no chart without a number to read |
| Create | AirOps | single centred column 640px, steps as pills, nothing else on screen |
| Keys / Connections / Website settings | — | settings pattern: left sub-nav (md+) / stacked sections, 2-col form, save bar pinned bottom |
| Billing | — | plan card + usage meters + invoice rows; prices in mono |
| Account / Workspaces | — | list of workspaces with role chips, invite form, danger zone last |
| Inbox / Help / Preview | — | simple list/detail, same chrome, no new patterns |

## Non-negotiables

1. Every number is mono and tabular; every status is a dot **plus** a word (never colour alone).
2. One primary action per screen, top right.
3. Contrast ≥ 4.5:1 for text in all six themes.
4. No layout depends on hover; focus states are always visible.
5. 390px: no horizontal scroll; tap targets ≥ 44px.
