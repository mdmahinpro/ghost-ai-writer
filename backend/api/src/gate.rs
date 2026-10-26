//! The stage-6 release gate, ported one-to-one from the TS engine
//! (`gateText`, `uniqueSlug`, `link-graph.ts`). A stage-6 pass means the
//! article is genuinely publishable — not that all six stages happened to run:
//!
//! * L1 — exact keyword or slug match against the site corpus → refused.
//! * L2 — lexical (Jaccard ∪ bigram Dice) similarity > 0.85 → refused.
//! * L3 — semantic cosine ≥ 0.88 → refused. Without a provider embedder this
//!   is the local 48-dim FNV hash vector, exactly like the TS `hash-fallback`
//!   (same dimension both sides, so the score is meaningful, just coarse).
//!
//! The same module owns `unique_slug` (collision → `-2`, never a false L1
//! refusal) and the anchor insertion the TS pipeline uses to weave internal
//! links into the final markdown.

use std::collections::HashMap;

pub const L2: f64 = 0.85;
pub const L3: f64 = 0.88;

/// Two keywords this close are the same ask: the corpus already owns that
/// article, and a second run would land on `…-2` with a sibling title.
pub const SAME_KEYWORD: f64 = 0.9;
pub const EMBED_DIM: usize = 48;

#[derive(Debug, Clone, PartialEq)]
pub struct GateResult {
    pub ok: bool,
    pub reason: Option<String>,
    pub layer: &'static str,
    /// The highest similarity found across all layers — the article's
    /// uniqueness is `1.0 - max_similarity`, the number the UI shows.
    pub max_similarity: f64,
}

fn normalize(raw: &str) -> String {
    let mut out = String::with_capacity(raw.len());
    for ch in raw.to_lowercase().chars() {
        if ch == '\'' || ch == '\u{2019}' {
            continue;
        }
        if ch.is_ascii_lowercase()
            || ch.is_ascii_digit()
            || matches!(ch, '+' | '#' | '.' | '-' | ' ')
        {
            out.push(ch);
        } else {
            out.push(' ');
        }
    }
    let collapsed: String = out.split_whitespace().collect::<Vec<_>>().join(" ");
    collapsed.trim().to_string()
}

/// Both the token set (Jaccard) and the hash embed normalize the same way.
pub fn normalize_keyword(raw: &str) -> String {
    normalize(raw)
}

fn tokens_of(s: &str) -> Vec<String> {
    normalize(s)
        .split_whitespace()
        .filter(|w| w.len() > 2)
        .map(str::to_string)
        .collect()
}

pub fn jaccard(a: &str, b: &str) -> f64 {
    let set_a: std::collections::HashSet<String> = tokens_of(a).into_iter().collect();
    let set_b: std::collections::HashSet<String> = tokens_of(b).into_iter().collect();
    if set_a.is_empty() || set_b.is_empty() {
        return 0.0;
    }
    let inter = set_a.iter().filter(|t| set_b.contains(*t)).count();
    inter as f64 / (set_a.len() + set_b.len() - inter) as f64
}

fn bigrams(s: &str) -> HashMap<String, u32> {
    // The TS engine slugs first (NFD + casefold + non-alnum → '-') — the
    // ASCII-faithful equivalent before re-splitting on the dashes.
    let slug = crate::stages::slugify(s);
    let t = format!(" {} ", slug.replace('-', " "));
    let t: Vec<char> = t.chars().collect();
    let mut m: HashMap<String, u32> = HashMap::new();
    if t.len() > 1 {
        for w in t.windows(2) {
            let g: String = w.iter().collect();
            *m.entry(g).or_insert(0) += 1;
        }
    }
    m
}

pub fn dice(a: &str, b: &str) -> f64 {
    let (ga, gb) = (bigrams(a), bigrams(b));
    if ga.is_empty() || gb.is_empty() {
        return 0.0;
    }
    let sa: u32 = ga.values().sum();
    let sb: u32 = gb.values().sum();
    let mut inter = 0u32;
    for (g, n) in &ga {
        inter += (*n).min(gb.get(g).copied().unwrap_or(0));
    }
    2.0 * inter as f64 / (sa + sb) as f64
}

pub fn lexical_similarity(a: &str, b: &str) -> f64 {
    jaccard(a, b).max(dice(a, b))
}

/// The TS `hash-fallback` embed: 48 buckets, FNV-1a over character trigrams
/// of `" " + normalize(s) + " "`, one signed mass per trigram, L2-normalized.
/// `Math.imul` is 32-bit multiply; the TS `Math.abs(h) % n` treats h as the
/// *signed* i32 read of those bits, which in Rust is `i32::from_ne_bytes` of
/// the FNV-1a output rather than the u32 truncated.
pub fn hash_embed(s: &str) -> Vec<f64> {
    let n = EMBED_DIM;
    let mut v = vec![0.0f64; n];
    let t = format!(" {} ", normalize(s));
    let chars: Vec<char> = t.chars().collect();
    for i in 0..chars.len().saturating_sub(2) {
        let mut h: u32 = 0x2166_1361;
        for c in &chars[i..i + 3] {
            h = h.wrapping_mul(16_777_619) ^ (*c as u32);
        }
        let signed = i32::from_ne_bytes(h.to_ne_bytes());
        let idx = (signed.wrapping_abs() as usize) % n;
        if signed & 1 != 0 {
            v[idx] += 1.0;
        } else {
            v[idx] -= 1.0;
        }
    }
    let mut mag = 0.0;
    for x in &v {
        mag += x * x;
    }
    let mag = mag.sqrt().max(1.0);
    for x in &mut v {
        *x /= mag;
    }
    v
}

pub fn cosine(a: &[f64], b: &[f64]) -> f64 {
    if a.len() != b.len() || a.is_empty() {
        return 0.0;
    }
    a.iter().zip(b.iter()).map(|(x, y)| x * y).sum()
}

pub struct CorpusItem {
    pub title: String,
    pub keyword: String,
    pub slug: String,
}

/// `gateText` with `allowVariants = false` (the publish path), plus the
/// TS title check for the "second angle" trap.
pub fn gate_text(title: &str, keyword: &str, corpus: &[CorpusItem]) -> GateResult {
    let norm = normalize_keyword(keyword);
    for item in corpus {
        if normalize_keyword(&item.keyword) == norm || item.slug == crate::stages::slugify(title) {
            return GateResult {
                ok: false,
                reason: Some("DUPLICATE REFUSED (L1-exact)".to_string()),
                layer: "L1",
                max_similarity: 1.0,
            };
        }
        // The same ask, worded differently — "…transition from academia…" against
        // "…transition academia…". Exact normalization misses those, and they are
        // what produced a second article on one keyword: the twins whose slug
        // carries the -2 suffix and whose titles read like siblings.
        let theirs = normalize_keyword(&item.keyword);
        if !theirs.is_empty() && !norm.is_empty() {
            let keyword_sim = lexical_similarity(&norm, &theirs);
            if keyword_sim >= SAME_KEYWORD {
                return GateResult {
                    ok: false,
                    reason: Some(format!("DUPLICATE REFUSED (L1-keyword {keyword_sim:.2})")),
                    layer: "L1",
                    max_similarity: keyword_sim,
                };
            }
        }
    }
    let mut max_sim: f64 = 0.0;
    for item in corpus {
        // TS: max(lex(title, item.title), lex(slugify(title), item.slug))
        max_sim = max_sim.max(lexical_similarity(title, &item.title));
        max_sim = max_sim.max(lexical_similarity(
            &crate::stages::slugify(title),
            &item.slug,
        ));
    }
    if max_sim > L2 {
        return GateResult {
            ok: false,
            reason: Some("DUPLICATE REFUSED (L2-lexical)".to_string()),
            layer: "L2",
            max_similarity: max_sim,
        };
    }
    if corpus.is_empty() {
        return GateResult {
            ok: true,
            reason: None,
            layer: "none",
            max_similarity: 0.0,
        };
    }
    let mine = hash_embed(&format!("{title} {keyword}"));
    let mut max_sem: f64 = 0.0;
    for item in corpus {
        let their = hash_embed(&format!("{} {}", item.title, item.keyword));
        max_sem = max_sem.max(cosine(&mine, &their));
    }
    let max_sim = max_sim.max(max_sem);
    if max_sem >= L3 {
        return GateResult {
            ok: false,
            reason: Some("DUPLICATE REFUSED (L3-semantic)".to_string()),
            layer: "L3",
            max_similarity: max_sem,
        };
    }
    GateResult {
        ok: true,
        reason: None,
        layer: "L3",
        max_similarity: max_sim,
    }
}

/// A title that announces a repeat is a duplicate by construction — the TS
/// engine refuses it before the lexical check even runs.
pub fn is_repeat_title(title: &str) -> bool {
    let t = title.to_lowercase();
    t.contains("second angle") || t.contains("(again)")
}

/// `uniqueSlug`: the packaged slug wins; a collision takes `-2`, `-3`, …
/// (index form, matching TS exactly) so two jobs in the same window never
/// mask each other as false L1 duplicates.
pub fn unique_slug(base: &str, taken: &[String]) -> String {
    let root = {
        let s = crate::stages::slugify(base);
        if s.is_empty() {
            "article".to_string()
        } else {
            s
        }
    };
    let used: std::collections::HashSet<&str> = taken.iter().map(|s| s.as_str()).collect();
    if !used.contains(root.as_str()) {
        return root;
    }
    for n in 2..500 {
        let candidate = format!("{root}-{n}");
        if !used.contains(candidate.as_str()) {
            return candidate;
        }
    }
    format!("{root}-x")
}

/// `postHref` — the internal URL shape every link must use.
pub fn post_href(slug: &str) -> String {
    let clean = slug.trim_matches('/');
    let clean = clean
        .strip_prefix("post/")
        .unwrap_or(clean)
        .trim_matches('/');
    format!("/post/{clean}/")
}

const STOP: &[&str] = &[
    "a", "an", "the", "of", "for", "and", "to", "in", "on", "how", "with", "your", "that", "this",
    "from", "what", "when", "who", "why", "into", "over", "about", "between", "without", "than",
    "then", "are", "was", "were", "will", "just", "more", "most",
];

/// `anchorPhrase`: the first up-to-four content words of the target title
/// (falling back to the raw words when fewer than two survive the stop-list).
pub fn anchor_phrase(title: &str) -> String {
    let raw: String = title
        .chars()
        .filter(|c| !matches!(c, '\u{201c}' | '\u{201d}' | '"' | '\''))
        .collect::<String>()
        .trim()
        .to_string();
    let words: Vec<&str> = raw.split_whitespace().collect();
    let content: Vec<&str> = words
        .iter()
        .filter(|w| {
            let w = w.to_lowercase();
            let w: String = w.chars().filter(|c| c.is_ascii_alphanumeric()).collect();
            !STOP.contains(&w.as_str())
        })
        .copied()
        .collect();
    let pool = if content.len() >= 2 { &content } else { &words };
    let phrase: String = pool
        .iter()
        .copied()
        .take(4)
        .collect::<Vec<&str>>()
        .join(" ")
        .trim_end_matches(['.', ':', ';', ','])
        .to_string();
    if phrase.len() >= 8 {
        phrase
    } else {
        raw.chars().take(72).collect()
    }
}

/// `alreadyLinked` — an existing href to the target counts as linked.
pub fn already_linked(html_or_md: &str, slug: &str) -> bool {
    let href = post_href(slug);
    let bare = format!("/{}", slug.trim_matches('/'));
    html_or_md.contains(&href)
        || html_or_md.contains(&format!("href=\"{bare}\""))
        || html_or_md.contains(&format!("href=\"{bare}/\""))
}

/// `insertAnchor` for markdown: append the TS link sentence with the anchor
/// wrapped as a link. `html` is accepted so the signature mirrors theirs; the
/// Rust pipeline stores markdown.
pub fn insert_anchor_md(markdown: &str, anchor: &str, slug: &str) -> (String, bool) {
    if anchor.trim().is_empty() || slug.trim().is_empty() {
        return (markdown.to_string(), false);
    }
    if already_linked(markdown, slug) {
        return (markdown.to_string(), false);
    }
    let href = post_href(slug);
    let sentence = format!(
        "The notes on {anchor} cover the next question, so this page does not repeat them."
    );
    let linked = sentence.replace(anchor, &format!("[{anchor}]({href})"));
    let next = format!("{} \n\n{linked}\n", markdown.trim_end());
    (next, true)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn l1_exact_keyword_is_refused() {
        let corpus = [CorpusItem {
            title: "When A PhD Stipend Stops".into(),
            keyword: "stipend cut guidance".into(),
            slug: "when-a-phd-stipend-stops".into(),
        }];
        let g = gate_text("Totally Different Title", "Stipend Cut Guidance!", &corpus);
        assert!(matches!(g.layer, "L1"));
        assert!(!g.ok);
    }

    #[test]
    fn a_reworded_keyword_is_the_same_article() {
        // The shape that produced the -2 twins on the live site: the same ask,
        // entered again with a word added or dropped.
        let corpus = [CorpusItem {
            title: "From Academia to Industry R&D".into(),
            keyword: "phd career transition from academia to industry r&d".into(),
            slug: "phd-career-transition-academia-to-industry-rd".into(),
        }];
        let g = gate_text(
            "Leaving Academia For Industry",
            "PhD career transition academia to industry R&D",
            &corpus,
        );
        assert_eq!(g.layer, "L1");
        assert!(!g.ok, "a reworded keyword must be refused: {g:?}");
        assert!(g.max_similarity >= SAME_KEYWORD);
    }

    #[test]
    fn a_different_ask_in_the_same_niche_still_passes_l1() {
        let corpus = [CorpusItem {
            title: "From Academia to Industry R&D".into(),
            keyword: "phd career transition academia to industry r&d".into(),
            slug: "phd-career-transition-academia-to-industry-rd".into(),
        }];
        let g = gate_text(
            "How To Respond To Peer Review Comments",
            "how to respond to peer review comments",
            &corpus,
        );
        assert_ne!(
            g.layer, "L1",
            "an unrelated keyword is not a duplicate: {g:?}"
        );
    }

    #[test]
    fn l1_slug_collision_is_refused() {
        let corpus = [CorpusItem {
            title: "Something Else".into(),
            keyword: "unrelated keyword".into(),
            slug: "my-slug".into(),
        }];
        let g = gate_text("My Slug", "completely separate", &corpus);
        assert!(matches!(g.layer, "L1"), "slug match is L1: {g:?}");
    }

    #[test]
    fn l2_near_identical_title_is_refused() {
        let corpus = [CorpusItem {
            title: "The 2026 Guide To Resolving Herd Health Conflicts".into(),
            keyword: "herd health conflict guide".into(),
            slug: "g-a".into(),
        }];
        let g = gate_text(
            "The 2026 Guide To Resolving Herd Health Conflicts",
            "zz unrelated",
            &corpus,
        );
        assert!(!g.ok && g.layer == "L2", "{g:?}");
    }

    #[test]
    fn distinct_articles_pass() {
        let corpus = [
            CorpusItem {
                title: "Cold Storage For Winter Feed".into(),
                keyword: "winter feed storage".into(),
                slug: "winter-feed".into(),
            },
            CorpusItem {
                title: "Reading A Calfs Eye Teeth".into(),
                keyword: "calf age estimation".into(),
                slug: "calf-teeth".into(),
            },
        ];
        let g = gate_text(
            "Baling Hay When The Forecast Turns",
            "hay baling weather",
            &corpus,
        );
        assert!(g.ok, "{g:?}");
    }

    #[test]
    fn hash_embed_is_normalized_and_stable() {
        let a = hash_embed("the same text");
        let b = hash_embed("the same text");
        let c = hash_embed("different text entirely");
        let mag: f64 = a.iter().map(|x| x * x).sum::<f64>().sqrt();
        assert!((mag - 1.0).abs() < 1e-9, "unit vector, got {mag}");
        assert!(a == b, "deterministic");
        assert!(cosine(&a, &c) < 0.5, "different texts diverge");
    }

    #[test]
    fn unique_slug_suffers_collisions_like_ts() {
        let taken = vec!["root".to_string(), "root-2".to_string()];
        assert_eq!(unique_slug("Root", &taken), "root-3");
        assert_eq!(unique_slug("Fresh", &taken), "fresh");
    }

    #[test]
    fn anchor_insertion_appends_the_ts_sentence_once() {
        let md = "Existing body.\n";
        let (out, inserted) = insert_anchor_md(md, "Winter Feed", "winter-feed");
        assert!(inserted);
        assert_eq!(out.matches("/post/winter-feed/").count(), 1);
        let (out2, again) = insert_anchor_md(&out, "Winter Feed", "winter-feed");
        assert!(!again, "a target already linked is never linked twice");
        assert_eq!(out2.matches("/post/winter-feed/").count(), 1);
    }

    #[test]
    fn anchor_phrase_strips_stop_words() {
        // TS `anchorPhrase`: content words (stop-list removed), first four, so
        // "How To Feed A Growing Herd On A Budget" → Feed/Growing/Herd/Budget.
        // Verified against the real TS function, not transcribed by eye.
        assert_eq!(
            anchor_phrase("How To Feed A Growing Herd On A Budget"),
            "Feed Growing Herd Budget"
        );
    }
}
