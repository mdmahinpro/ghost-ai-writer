# Audit — ghost.bloggent.com public surface (2026-10-22)

Method: public pages only (no login, no auth bypass). REA MCP not yet registered; this pass used direct HTTP fetch.
Limitation: the marketing root is a client-rendered SPA — fetch returned title only, so it needs a browser (or REA/Playwright) for the full landing-page read. `/pricing` is server-rendered and fully captured.

## 1. What the product is, in its own words

**Ghost AI Writer — "Autonomous content for Ghost CMS."** Sold as: *"Every package unlocks a number of isolated website workspaces for 365 days. Each workspace gets the whole product: the six-stage AI pipeline, duplicate protection, internal linking, images, single-shot Ghost publishing and static delivery."*

## 2. Commercial model (verified, 2026-10-22)

| Package | Price/year | Workspaces | Per-site | Notes |
|---|---|---|---|---|
| Free | ৳0 | 1 | — | "Every approved account includes 1 website workspace at no cost" |
| Starter | ৳20,000 | 5 | ≈৳4,000 | "Up to 100 keywords per run", BYO AI keys |
| Growth | ৳35,000 | 10 | ≈৳3,500 | same limits |
| Agency | ৳50,000 | 50 | ≈৳1,000 | same limits |

- **Currency: BDT.** Bangladeshi market.
- **Billing period: 365 days per workspace.** "Pay for websites, not for seats or words."
- **AI usage explicitly excluded** — "you add your own OpenAI / OpenRouter keys (encrypted at rest) and control daily token allowances per key."
- **Checkout is not open.** "Payment details have not been published yet, so packages cannot be ordered right now." Payment rails named: bKash, Nagad, Rocket, or bank.
- Renewal/upgrade rules: same-package renewal extends; different package starts a new 365-day term at full price, no proration; highest active cap applies.
- Promo codes: applied in Billing before sending money; server-confirmed discount; 24-hour quote validity; one code per order; not applied to renewals automatically.

## 3. Where we already beat them (factual, from their own page)

1. **`Up to 100 keywords per run`** — hard cap on every paid tier. Our M1 removed the cap entirely (`DEFAULT_LIMITS.keywordCap: null`, 10k intake verified). This is a marketing-grade differentiator we are currently not selling.
2. **Marketing site rendered client-side** — their own public landing fails to return content without JS. Ours can be static/SSR.
3. **No `ads.txt` editor, no route-diff gate** in their published feature list; both exist in our M4.

## 4. Gaps we must close (feature parity still owed on our side)

| Feature they advertise | Our state | Owner action |
|---|---|---|
| Isolated website workspaces (multi-tenant) | ❌ single-browser blob, no tenancy | P1+P4 (Rust + SQL) |
| Single-shot Ghost publishing | ✅ built (`publishGhostPost`) | — |
| Duplicate protection | ✅ L1/L2/L3 | recalibrate thresholds |
| Internal linking | ✅ audit + apply + re-weave | complete PUT re-weave |
| Images | ✅ Bing/Wikimedia/Openverse + dedupe | — |
| Static delivery | ✅ artifacts + 4 providers | live deploy unproven |
| Six-stage pipeline | ✅ M3 | — |
| **Seat/workspace billing + promo codes + quotes** | ❌ none | new scope (Phase 5+) |
| **Per-key daily token allowance, encrypted at rest** | ⚠️ allowance exists, blob-stored | P1 secret store |

## 5. What this audit changes in the plan

- Billing/workspace entitlement is a **product surface we do not have at all** — it is not in `MASTER_SPEC`. Adding it is a decision for the owner (it implies payment rails for BDT: bKash/Nagad/Rocket).
- Our uncapped keyword intake is the strongest single selling point against this competitor and should be a headline, not a settings footnote.

## 6. Not done (needs owner input)

- Authenticated-area audit (nav order, live feature deltas inside the app) requires the owner's session cookies (`knowledge-base/cookies.json`, gitignored) — no auth bypass attempted.
- REA MCP registration (`npx rea-agents setup`) for JS bundle/network analysis: pending owner approval to add an MCP server + `/reload-mcp`.
