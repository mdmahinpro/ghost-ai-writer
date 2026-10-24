# Writing quality — SEO structure + humanized prose (binding spec)

Two libraries decide how our articles read. They are not optional and they are not applied "at the end":

| Skill | Where it acts | Never used for |
|---|---|---|
| `seo-playbook` (SEO-Skills-Pack v3.1, 11 skills / 514 playbooks) | stage 1 blueprint, stage 4 metadata, heading/query alignment | prose voice |
| `humanizer` (blader/humanizer, 34 patterns) | stage 3 revision, final prose pass | structure, keywords |

Rule: **SEO decides what is covered. Humanizer decides how it reads.** Coverage without voice is slop; voice without coverage ranks for nothing.

## Stage 1 — Intent & Blueprint (SEO drives it)

- One search intent per article, from `informational | commercial | transactional | navigational`.
- `mustCover` (3–10 items) comes from the query's real sub-questions, not from a template. Each item maps 1:1 to one H2 in the outline.
- Headings phrased the way people ask (`references/keyword-research/`, `references/seo-router/`), no keyword stuffing, no "Ultimate Guide" filler.
- Choose `articleType` deliberately (how-to, explainer, comparison, listicle, policy/best-practice) and record why.

## Stage 3 — Quality & Coverage Revision (humanizer drives it)

Their contract already scores prose: `unnaturalTransitions`, `formattingIssues`, `repetition`, `genericFiller`. We make that concrete with a **deterministic linter** that runs before the LLM critique, so failures are countable rather than vibes.

Machine checks (regex/AST on the draft markdown), any hit blocks publish:

| Check | What it catches |
|---|---|
| `\bnot (just|only|merely)\b.*\b(it'?s|but)\b` | pattern 1, "not X but Y" |
| `\b(let that sink in|that'?s the real win|this is the part that matters)\b` | pattern 2, one-line closers |
| `\b(at its core|the real question is|what really matters|fundamentally)\b` | pattern 3/27, deep-sounding sayings |
| `\b(let'?s (dive|explore|break)|here'?s what you need to know)\b` | pattern 4/28, staged run-up + signposting |
| `\b(delve|underscore|testament|tapestry|vibrant|pivotal|intricate|landscape of|showcase)\b` | pattern 7, AI vocabulary |
| `\b(serves as|stands as|functions as|boasts|nestled in)\b` | pattern 8, copula avoidance |
| `—` count per 1000 words > 2 | pattern 14, em dash overuse |
| `\*\*[^*]+\*\*` count per 1000 words > 6 | pattern 15, boldface |
| `[\U0001F300-\U0001FAFF\u2600-\u27BF]` | pattern 18, emojis |
| `[\u201C\u201D\u2018\u2019]` | pattern 19, curly quotes |
| `\b(in conclusion|in summary|it is important to note|at the end of the day)\b` | patterns 23/25, filler closers |
| three comma-separated items in one clause × 3 paragraphs | pattern 6/10, forced triads |
| `\b(honestly|frankly|look,|so,)\s` sentence-initial | pattern 33, opener tics |
| any `## heading` followed by a ≤12-word paragraph restating it | pattern 29, fragmented headers |

Then the LLM revision pass fixes what the linter flagged plus what it can sense (`unnaturalTransitions`, `contradictions`), and **must not invent facts**: any new name/number/date/citation is rejected unless it came from the blueprint or an existing claim record (their `claims[]` contract with `SUPPORTED | UNSUPPORTED | OPINION`).

Loop: linter → revision → linter. Max 2 revision passes; remaining hits are surfaced in `qualityReport.notes`, never silently shipped.

## Stage 4 — Metadata & Packaging (SEO drives it)

- `title` 3–160 but the visible part ≤60 chars, primary phrase inside the first 40.
- `metaDescription` 50–300: promise + differentiator, no "learn everything about".
- `slug` lowercase hyphenated from the primary phrase (their regex `^[a-z0-9]+(?:-[a-z0-9]+)*$`).
- `tags` 3–8, topical, reused across the cluster (feeds internal linking).
- `excerpt` 30–400 that states the payoff, distinct from the meta description.

## AEO layer (their blind spot)

`references/ai-search/` playbooks give us the answer-first structure that AI Overviews and Copilot quote: direct answer in the first 2 sentences, one canonical definition block, FAQ answers 20–1200 chars phrased as questions (`content.faq[]` already allows 8). Their pipeline has FAQ but no citation-ready answer block; we add `content.answerBlock` in stage 1 and validate it in stage 3.

## Acceptance for the writing slice

1. Linter clean at publish (0 high-severity hits) on 30 fixture articles.
2. Every `mustCover` item appears as an H2 and is scored ≥0.8 coverage.
3. `qualityReport` present with all five fields, `unsupportedClaims` ≤ 2 for opinion pieces, 0 for facts.
4. A human reader test: 10 articles, no "this is AI" in the top 3 reactions. That is the only test that matters for voice.
