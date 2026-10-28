//! blader/humanizer v3.1.0, server-side.
//!
//! The browser had this engine and the pipeline did not, so every generated
//! article reached the CMS with its AI tells intact and the only way to clear
//! them was pressing Fix on the article page. Humanization is a pipeline step
//! now: `run_validation` calls `humanize` on the assembled markdown before the
//! publish gate, so nothing is published un-humanized.
//!
//! Two layers, same as the browser module this ports:
//!  - a deterministic scrub (no key needed) for the mechanical tells: chatbot
//!    residue, filler closers, em-dash chaining, curly quotes, the not-X-but-Y
//!    contrast, banned vocabulary;
//!  - two model passes — audit what still reads machine-written, then a
//!    surgical rewrite — that are refused if they break the Bing SEO skeleton
//!    (heading counts, tables, links, length).

use crate::provider::{ChatRequest, Engine};
use regex::Regex;
use serde_json::Value;
use std::sync::OnceLock;

pub const HUMANIZER_VERSION: &str = "blader@1";

/// One of the 26 anti-patterns, strongest first.
pub struct Rule {
    pub id: u8,
    pub name: &'static str,
    pub group: &'static str,
    /// Phrases that count as this tell wherever they appear.
    pub watch: &'static [&'static str],
    /// Score penalty per sighting. Structural tells cost more.
    pub weight: u32,
}

fn rules() -> &'static [Rule] {
    static RULES: OnceLock<Vec<Rule>> = OnceLock::new();
    RULES.get_or_init(|| {
        vec![
            Rule { id: 1, name: "Not X but Y contrast", group: "staging", weight: 6, watch: &["not just", "not only", "not merely", "isn't just", "is not a tool but"] },
            Rule { id: 2, name: "One-line closer / dramatic fragment", group: "staging", weight: 5, watch: &["that is the real win", "that's the real win", "that distinction matters", "read that again", "let that sink in", "the message was clear", "it was a lesson in", "this shows the importance of"] },
            Rule { id: 3, name: "Saying that sounds deep", group: "staging", weight: 5, watch: &["the real question is", "at its core", "what really matters", "the deeper issue", "the heart of the matter", "becomes a trap"] },
            Rule { id: 4, name: "Staged run-up", group: "staging", weight: 5, watch: &["let's dive in", "let's dive into", "let's explore", "let's break this down", "here's what you need to know", "now let's look at", "without further ado", "here's the thing", "let's be honest", "real talk"] },
            Rule { id: 5, name: "Arguing with no one", group: "staging", weight: 5, watch: &["this isn't about", "i'm not saying", "don't get me wrong", "this is not to say", "some might say", "a tempting approach", "one might be tempted", "an obvious approach would be", "you might think", "it would be easy to just"] },
            Rule { id: 6, name: "Forced triad", group: "rhythm", weight: 3, watch: &[] },
            Rule { id: 7, name: "Repeated sentence openings", group: "rhythm", weight: 2, watch: &[] },
            Rule { id: 8, name: "Dash as universal connector", group: "rhythm", weight: 3, watch: &[] },
            Rule { id: 9, name: "Stacked qualifiers", group: "rhythm", weight: 2, watch: &["to be fair,", "could potentially", "might arguably", "in some cases it may", "it's also possible"] },
            Rule { id: 10, name: "Hyphenated pair after the noun", group: "rhythm", weight: 1, watch: &[] },
            Rule { id: 11, name: "Passive voice / missing subject", group: "rhythm", weight: 1, watch: &[] },
            Rule { id: 12, name: "Overused AI word", group: "inflation", weight: 3, watch: &["delve", "tapestry", "pivotal", "crucial", "meticulous", "meticulously", "showcase", "showcases", "underscores", "underscore", "garner", "intricate", "intricacies", "interplay", "bolstered", "enduring", "testament", "robust", "seamless", "seamlessly", "vibrant", "utilize", "utilization", "facilitate", "additionally", "in conclusion"] },
            Rule { id: 13, name: "Inflated significance", group: "inflation", weight: 5, watch: &["stands as a testament", "a pivotal moment", "plays a key role", "plays a crucial role", "underscores its importance", "reflects a broader", "lasting legacy", "enduring legacy", "setting the stage for", "evolving landscape", "indelible mark", "continues to thrive", "challenges and legacy", "future outlook", "the future looks bright", "exciting times", "a step in the right direction", "shaping the future"] },
            Rule { id: 14, name: "Vague association", group: "inflation", weight: 3, watch: &["associated with", "in association with", "in connection with", "tied to"] },
            Rule { id: 15, name: "Shallow -ing rider", group: "inflation", weight: 4, watch: &["highlighting", "underscoring", "emphasizing", "ensuring", "reflecting", "symbolizing", "cultivating", "fostering", "encompassing", "showcasing"] },
            Rule { id: 16, name: "Sales language", group: "inflation", weight: 4, watch: &["nestled", "in the heart of", "must-visit", "breathtaking", "stunning", "renowned", "groundbreaking", "rich cultural heritage", "natural beauty", "diverse array", "commitment to", "exemplifies", "profound"] },
            Rule { id: 17, name: "Borrowed authority", group: "inflation", weight: 4, watch: &["experts argue", "observers have cited", "industry reports", "some critics", "several publications", "active social media presence"] },
            Rule { id: 18, name: "Avoiding is/are/has", group: "inflation", weight: 2, watch: &["serves as", "stands as", "functions as", "operates as", "boasts"] },
            Rule { id: 19, name: "Bold as decoration", group: "formatting", weight: 3, watch: &[] },
            Rule { id: 20, name: "Decorative heading / emoji label", group: "formatting", weight: 3, watch: &["🚀", "💡", "✨", "→"] },
            Rule { id: 21, name: "Curly quotation marks", group: "formatting", weight: 1, watch: &[] },
            Rule { id: 22, name: "Chatbot residue", group: "leftovers", weight: 6, watch: &["i hope this helps", "of course!", "certainly!", "great question!", "you're absolutely right", "would you like", "want me to", "should i continue", "let me know if"] },
            Rule { id: 23, name: "Knowledge-limit disclaimer", group: "leftovers", weight: 5, watch: &["as of my", "up to my last", "while specific details are limited", "based on available information", "not publicly available", "not widely documented", "maintains a low profile", "keeps personal details private", "it is believed that"] },
            Rule { id: 24, name: "Heading repeated in first sentence", group: "leftovers", weight: 3, watch: &[] },
            Rule { id: 25, name: "Writing about the document", group: "leftovers", weight: 3, watch: &["was added to replace", "generated from", "compiled from", "the table below compares", "this section is organized"] },
            Rule { id: 26, name: "Re-explaining to the reader", group: "wrong-reader", weight: 2, watch: &[] },
        ]
    })
}

#[derive(Debug, Clone)]
pub struct Hit {
    pub id: u8,
    pub pattern: &'static str,
    pub group: &'static str,
    pub excerpt: String,
}

fn rule(id: u8) -> &'static Rule {
    rules().iter().find(|r| r.id == id).expect("rule id")
}

/// Strip code blocks, inline code and link targets so their text never counts
/// as prose.
fn mask_prose(text: &str) -> String {
    static CODE: OnceLock<Regex> = OnceLock::new();
    static INLINE: OnceLock<Regex> = OnceLock::new();
    static LINK: OnceLock<Regex> = OnceLock::new();
    let code = CODE.get_or_init(|| Regex::new(r"(?s)```.*?```").expect("fence regex"));
    let inline = INLINE.get_or_init(|| Regex::new(r"`[^`\n]*`").expect("inline regex"));
    let link = LINK.get_or_init(|| Regex::new(r"\[[^\]]*\]\([^)]*\)").expect("link regex"));
    let out = code.replace_all(text, " ");
    let out = inline.replace_all(&out, " ");
    link.replace_all(&out, "[]()").to_string()
}

/// Split into sentences without lookbehind (the regex crate has none).
fn sentences(text: &str) -> Vec<String> {
    let mut out = Vec::new();
    let mut current = String::new();
    let chars: Vec<char> = text.chars().collect();
    for (index, ch) in chars.iter().enumerate() {
        current.push(*ch);
        if matches!(ch, '.' | '!' | '?') {
            let next_blank = chars.get(index + 1).map(|c| c.is_whitespace()).unwrap_or(true);
            if next_blank {
                out.push(current.trim().to_string());
                current.clear();
            }
        }
    }
    if !current.trim().is_empty() {
        out.push(current.trim().to_string());
    }
    out
}

/// Deterministic scan for AI tells.
pub fn scan(text: &str) -> Vec<Hit> {
    let body = mask_prose(text);
    let mut hits: Vec<Hit> = Vec::new();
    let mut push = |id: u8, excerpt: &str| {
        if hits.len() >= 400 {
            return;
        }
        let r = rule(id);
        hits.push(Hit {
            id,
            pattern: r.name,
            group: r.group,
            excerpt: excerpt.split_whitespace().collect::<Vec<_>>().join(" ").chars().take(140).collect(),
        });
    };

    for r in rules() {
        for phrase in r.watch {
            let pattern = format!(r"(?i)(?:^|[^\p{{L}}]){}(?:[^\p{{L}}]|$)", regex::escape(phrase));
            let Ok(re) = Regex::new(&pattern) else { continue };
            for found in re.find_iter(&body).take(40) {
                let start = found.start().saturating_sub(30);
                let end = (found.end() + 80).min(body.len());
                // Byte offsets can land inside a multi-byte char; clamp down.
                let slice = body
                    .get(..end)
                    .and_then(|s| s.get(start..).map(|tail| tail.to_string()))
                    .unwrap_or_default();
                push(r.id, &slice);
            }
        }
    }

    if Regex::new(r#"(?im)(?:^|[\s("\[])(?:--|—|–)(?:$|[\s,.)\]]|[a-z])"#).expect("dash").is_match(&body) {
        push(8, "em/en dash used as a connector");
    }
    if Regex::new(r#"[“”][^“”]*[“”]"#).expect("quote").is_match(&body) {
        push(21, "curly quotation marks");
    }
    if let Ok(triad) = Regex::new(r"\b\p{Lu}?\p{L}[\p{L}-]{1,18},\s+\p{L}[\p{L}-]{1,18},\s+(?:and|or)\s+\p{L}[\p{L}-]{1,18}\b") {
        for found in triad.find_iter(&body).take(20) {
            push(6, found.as_str());
        }
    }
    let parts = sentences(&body);
    let mut index = 0usize;
    while index + 2 < parts.len() {
        let first = parts[index]
            .split_whitespace()
            .next()
            .map(|word| word.to_lowercase().chars().filter(|c| c.is_alphanumeric()).collect::<String>())
            .unwrap_or_default();
        if first.len() >= 3
            && parts[index + 1].to_lowercase().starts_with(&first)
            && parts[index + 2].to_lowercase().starts_with(&first)
        {
            push(7, &parts[index].chars().take(60).collect::<String>());
            index += 2;
        }
        index += 1;
    }

    // Same rule id + same excerpt start = one tell counted once.
    let mut seen = std::collections::HashSet::new();
    hits.retain(|hit| seen.insert(format!("{}:{}", hit.id, hit.excerpt.chars().take(60).collect::<String>())));
    hits
}

/// 0–100 human-prose score. Every tell costs its rule weight; 100 = none found.
pub fn score(text: &str) -> (u32, Vec<Hit>) {
    let hits = scan(text);
    let penalty: u32 = hits.iter().map(|hit| rule(hit.id).weight).sum();
    (100u32.saturating_sub(penalty), hits)
}

#[derive(Debug, Clone, Copy)]
pub struct Fingerprint {
    pub h1: usize,
    pub h2: usize,
    pub h3: usize,
    pub tables: usize,
    pub links: usize,
    pub words: usize,
}

/// Structure counts a rewrite must preserve for Bing SEO.
pub fn fingerprint(text: &str) -> Fingerprint {
    let count = |pattern: &str| -> usize {
        Regex::new(pattern).map(|re| re.find_iter(text).count()).unwrap_or(0)
    };
    Fingerprint {
        h1: count(r"(?m)^# (?!#)"),
        h2: count(r"(?m)^## (?!#)"),
        h3: count(r"(?m)^### (?!#)"),
        tables: count(r"(?m)^\|.+\|$"),
        links: count(r"\]\([^)]+\)"),
        words: text.split_whitespace().count(),
    }
}

fn structure_intact(before: Fingerprint, after: Fingerprint) -> bool {
    let close = |a: usize, b: usize, tolerance: usize| a.abs_diff(b) <= tolerance;
    close(before.h1, after.h1, 0)
        && close(before.h2, after.h2, 0)
        && close(before.h3, after.h3, 1)
        && close(before.tables, after.tables, 0)
        && close(before.links, after.links, std::cmp::max(1, before.links / 10))
        && (after.words as f64) > before.words as f64 * 0.6
        && (after.words as f64) < before.words as f64 * 1.5
}

/// Protect code, inline code, links (and table rows) from edits.
fn protect(text: &str, keep_tables: bool) -> (String, Vec<String>) {
    let pattern = if keep_tables {
        r"(?m)```[\s\S]*?```|`[^`\n]*`|\[[^\]]*\]\([^)]*\)|^\|.+\|$"
    } else {
        r"(?m)```[\s\S]*?```|`[^`\n]*`|\[[^\]]*\]\([^)]*\)"
    };
    let re = Regex::new(pattern).expect("protect regex");
    let mut keep: Vec<String> = Vec::new();
    let masked = re
        .replace_all(text, |caps: &regex::Captures<'_>| {
            keep.push(caps[0].to_string());
            format!("\u{0}K{}\u{0}", keep.len() - 1)
        })
        .to_string();
    (masked, keep)
}

fn unprotect(text: &str, keep: &[String]) -> String {
    let re = Regex::new("\u{0}K(\\d+)\u{0}").expect("unprotect regex");
    re.replace_all(text, |caps: &regex::Captures<'_>| {
        caps[1]
            .parse::<usize>()
            .ok()
            .and_then(|index| keep.get(index).cloned())
            .unwrap_or_default()
    })
    .to_string()
}

/// Safe word swaps — pattern → replacement, applied outside protected segments.
fn swaps() -> &'static [(Regex, &'static str)] {
    static SWAPS: OnceLock<Vec<(Regex, &'static str)>> = OnceLock::new();
    SWAPS.get_or_init(|| {
        let table: &[(&str, &str)] = &[
            (r"\bdelving into\b", "examining"),
            (r"\bdelves into\b", "examines"),
            (r"\bdelved into\b", "examined"),
            (r"\bdelve into\b", "examine"),
            (r"\bdelving\b", "probing"),
            (r"\bdelve\b", "probe"),
            (r"\btapestr(?:y|ies)\b", "mix"),
            (r"\bmeticulously\b", "carefully"),
            (r"\bmeticulous\b", "careful"),
            (r"\bserves as\b", "is"),
            (r"\bstands as\b", "is"),
            (r"\bfunctions as\b", "works as"),
            (r"\bboasts\b", "has"),
            (r"\bshowcas(?:es|ing|ed|e)?\b", "shows"),
            (r"\bunderscor(?:es|ing|ed|e)?\b", "points to"),
            (r"\butiliz(?:es|ed|e|ing)?\b", "uses"),
            (r"\butilization\b", "use"),
            (r"\bleverag(?:es|ed|e|ing)\b", "uses"),
            (r"\bfacilitat(?:es|ed|e|ing)\b", "helps"),
            (r"\bgarner(?:s|ed|ing)?\b", "earns"),
            (r"\bbolstered\b", "strengthened"),
            (r"\bseamless(?:ly)?\b", "smooth"),
            (r"\benduring\b", "lasting"),
            (r"\bpivotal\b", "important"),
            (r"\bcrucial\b", "important"),
            (r"\bvibrant\b", "lively"),
            (r"\bbreathtaking\b", "striking"),
            (r"\bstunning\b", "striking"),
            (r"\brenowned\b", "well known"),
            (r"\bgroundbreaking\b", "new"),
            (r"\bnestled\b", "set"),
            (r"\bdiverse array of\b", "range of"),
            (r"\bintricate\b", "complex"),
            (r"\bprofound\b", "deep"),
            (r"\bAdditionally,?\s*", "Also "),
            (r"\bin conclusion,?\s*", ""),
        ];
        table
            .iter()
            .filter_map(|(pattern, replacement)| {
                Regex::new(&format!("(?i){pattern}"))
                    .ok()
                    .map(|re| (re, *replacement))
            })
            .collect()
    })
}

/// Deterministic pass (no key needed).
pub fn scrub(markdown: &str, banned_phrases: &[String]) -> (String, Vec<String>) {
    let mut stripped: Vec<String> = Vec::new();
    let mut note = |label: &str| {
        if !stripped.iter().any(|s| s == label) {
            stripped.push(label.to_string());
        }
    };
    let mut text = markdown.to_string();

    // §22 chatbot residue.
    if let Ok(residue) = Regex::new(r"(?i)i hope this helps|great question!|certainly!|of course!|you're absolutely right|would you like|want me to|should i continue|let me know if") {
        if residue.is_match(&text) {
            note("§22 chatbot residue");
            let whole = Regex::new(r"(?i)^\s*(?:i hope this helps|of course|certainly|great question|you're absolutely right|would you like[^.?!]*|want me to[^.?!]*|should i continue|let me know (?:if|whether)[^.?!]*)\s*[.!?]?\s*$").expect("residue line");
            let sentence = Regex::new(r"(?i)^\s*(?:i hope this helps|of course|certainly|great question|you're absolutely right|would you like[^.?!]*|want me to[^.?!]*|should i continue|let me know (?:if|whether)[^.?!]*)\s*[.!?]?\s*$").expect("residue sentence");
            text = strip_lines(&text, &whole, &sentence);
        }
    }
    // §2/§13 filler closer or send-off.
    if let Ok(closer) = Regex::new(r"(?i)the future looks bright|exciting times|read that again|let that sink in|that's the real win|that distinction matters") {
        if closer.is_match(&text) {
            note("§2/§13 filler closer or send-off");
            let whole = Regex::new(r"(?i)^\s*(?:that is the real win\.?|that's the real win\.?|that distinction matters\.?|read that again\.?|let that sink in\.?|the future looks bright[^.?!]*\.?|exciting times (?:lie|are) ahead[^.?!]*\.?)\s*$").expect("closer line");
            let sentence = Regex::new(r"(?i)^\s*(?:that is the real win\.?|that's the real win\.?|that distinction matters\.?|read that again\.?|let that sink in\.?)\s*$").expect("closer sentence");
            text = strip_lines(&text, &whole, &sentence);
        }
    }
    // §13 stock section heading.
    if let Ok(heading) = Regex::new(r"(?im)^#{1,6}\s*(?:future outlook|challenges and legacy|challenges and future outlook|awards and recognition)\s*$") {
        if heading.is_match(&text) {
            note("§13 stock section heading");
            text = heading.replace_all(&text, "").to_string();
        }
    }
    // §8 dashes as connectors.
    if Regex::new(r"[—–]|\s--\s").expect("dash detect").is_match(&text) {
        note("§8 dashes as connectors");
        let (masked, keep) = protect(&text, false);
        let dashes = Regex::new(r"\s*[—–]+\s*|\s--\s").expect("dash replace");
        text = unprotect(&dashes.replace_all(&masked, ", "), &keep);
    }
    // §21 curly quotes.
    if Regex::new(r"[“”‘’]").expect("quote detect").is_match(&text) {
        note("§21 curly quotes");
        text = text
            .replace(['“', '”'], "\"")
            .replace(['‘', '’'], "'");
    }
    // §1 not X, it's Y → "X, and Y".
    if Regex::new(r"(?i)\bnot\s+(?:just|only|merely)\b").expect("contrast detect").is_match(&text) {
        note("§1 not-X-but-Y contrast");
        let contrast = Regex::new(r"(?i)^(it'?s|it is|this is|that'?s|they'?re|they are)\s+not\s+(?:just|only|merely)\s+(.+?)\s*[,;:]?\s*(?:—|--)?\s*(?:it|this|that)\s*(?:'?s|\s+is)\s+(.+?)\.?$").expect("contrast regex");
        let (masked, keep) = protect(&text, true);
        let rewritten = masked
            .split('\n')
            .map(|line| {
                sentences(line)
                    .into_iter()
                    .map(|sentence| {
                        let trimmed = sentence.trim();
                        if let Some(caps) = contrast.captures(trimmed) {
                            let x = caps[2].trim();
                            let y = caps[3].trim();
                            let tail = if trimmed.ends_with('!') { "!" } else if trimmed.ends_with('?') { "?" } else { "." };
                            let mut chars = x.chars();
                            let head = chars.next().map(|c| c.to_uppercase().to_string()).unwrap_or_default();
                            format!("{head}{}, and {y}{tail}", chars.as_str())
                        } else {
                            trimmed.to_string()
                        }
                    })
                    .collect::<Vec<_>>()
                    .join(" ")
            })
            .collect::<Vec<_>>()
            .join("\n");
        text = unprotect(&rewritten, &keep);
    }
    // §12/§16/§18 banned vocabulary.
    {
        let (masked, keep) = protect(&text, true);
        let mut working = masked;
        for (pattern, replacement) in swaps() {
            if pattern.is_match(&working) {
                note(&format!("§12 overused word: {}", pattern.as_str()));
                working = pattern.replace_all(&working, *replacement).to_string();
            }
        }
        for phrase in banned_phrases.iter().map(|p| p.trim()).filter(|p| !p.is_empty()) {
            let pattern = format!(r"(?i)(^|[^\p{{L}}]){}(?:[^\p{{L}}]|$)", regex::escape(phrase));
            if let Ok(re) = Regex::new(&pattern) {
                if re.is_match(&working) {
                    note(&format!("banned phrase: {phrase}"));
                    working = re.replace_all(&working, "$1").to_string();
                }
            }
        }
        text = unprotect(&working, &keep);
    }
    // Punctuation hygiene left behind by removals.
    for (pattern, replacement) in [
        (r"[ \t]{2,}", " "),
        (r" ([,.;:!?])", "$1"),
        (r",\s*\.", "."),
    ] {
        if let Ok(re) = Regex::new(pattern) {
            text = re.replace_all(&text, replacement).to_string();
        }
    }
    if let Ok(re) = Regex::new(r"\n{3,}") {
        text = re.replace_all(&text, "\n\n").to_string();
    }
    (
        text.lines().map(|line| line.trim_end()).collect::<Vec<_>>().join("\n").trim().to_string(),
        stripped,
    )
}

/// Drop whole lines that are nothing but residue, and residue sentences inside
/// lines that carry real prose.
fn strip_lines(text: &str, whole: &Regex, sentence: &Regex) -> String {
    text.split('\n')
        .map(|line| {
            if whole.is_match(line) {
                return String::new();
            }
            sentences(line)
                .into_iter()
                .filter(|part| !sentence.is_match(part))
                .collect::<Vec<_>>()
                .join(" ")
                .trim()
                .to_string()
        })
        .filter(|line| !line.is_empty())
        .collect::<Vec<_>>()
        .join("\n")
}

/// Everything a rewrite needs to know about the article it is touching.
#[derive(Debug, Default, Clone)]
pub struct Context {
    pub title: String,
    pub keyword: String,
    pub author_name: String,
    pub author_voice: String,
    pub banned_phrases: Vec<String>,
}

#[derive(Debug, Clone, Default)]
pub struct Spend {
    pub tokens_in: i64,
    pub tokens_out: i64,
    pub cost_usd: f64,
}

#[derive(Debug, Clone)]
pub struct Humanized {
    pub markdown: String,
    pub score: u32,
    pub stripped: Vec<String>,
    pub passes: u32,
    pub llm: bool,
    pub note: String,
    pub spend: Spend,
}

const AUDIT_CONTRACT: &str = "You audit prose for AI tells using the blader/humanizer ruleset (Wikipedia 'Signs of AI writing'). Return valid JSON only, no markdown fence. Return JSON matching {\"issues\":[{\"id\":number,\"note\":\"what still sounds machine-written and why, one line\"}]}. Look for: staging contrasts (not X but Y), one-line closers, deep-sounding sayings, staged run-ups, arguing with no one, forced triads, repeated sentence openings, em-dash chaining, stacked qualifiers, overused AI words (delve, tapestry, pivotal, robust…), inflated significance, vague association, shallow -ing riders, sales language, borrowed authority, avoided is/are/has verbs, decorative bold, emoji or arrow headings, curly quotes, chatbot residue, knowledge-limit disclaimers, a heading repeated in the first sentence, writing about the document instead of the subject. Report only what the sample actually contains. An empty issue list is valid.";

const REWRITE_CONTRACT: &str = "You are the blader/humanizer surgical rewriter. Rewrite machine-sounding prose so it reads like the assigned human author, without changing what it says. Do not invent facts, names, numbers, dates, quotes, or citations. Preserve the Bing SEO skeleton EXACTLY: the same H1/H2/H3 headings (you may reword a heading only to de-AI it while keeping the same meaning and question shape), every markdown table and all of its rows, every markdown link with its exact href and anchor, and the direct-answer opening. Remove the flagged AI tells: state each point plainly instead of patching phrases. Vary sentence length; alternate short and long. No em/en dashes anywhere — use commas, colons, or full stops. Use is/are/has. No banned vocabulary, no staged contrasts, no one-line closers, no filler conclusion — end on the last concrete fact. Match the author's voice block: rhythm, diction, sentence-length band, signature moves, point of view. Keep specific details, honest mixed feelings, and grounded asides. Return valid JSON only matching {\"markdown\":\"the full rewritten article markdown\"}. No markdown fence, no commentary.";

fn voice_block(context: &Context) -> String {
    [
        if !context.author_voice.is_empty() {
            format!("Author voice (adopt exactly):\n{}", context.author_voice)
        } else if !context.author_name.is_empty() {
            format!("You write as {}, a US staff writer with a plain, grounded human voice.", context.author_name)
        } else {
            String::new()
        },
        if context.title.is_empty() { String::new() } else { format!("Article title: {}", context.title) },
        if context.keyword.is_empty() { String::new() } else { format!("Target query: {}", context.keyword) },
    ]
    .into_iter()
    .filter(|part| !part.is_empty())
    .collect::<Vec<_>>()
    .join("\n")
}

fn parse_json(text: &str) -> Option<Value> {
    let cleaned = text.trim().trim_start_matches("```json").trim_start_matches("```").trim_end_matches("```").trim();
    serde_json::from_str::<Value>(cleaned).ok()
}

/// Full humanization: deterministic scrub always, then the audit + rewrite
/// passes when an engine is available. An LLM answer that breaks the markdown
/// skeleton is thrown away rather than published.
pub async fn humanize(engine: Option<&Engine>, markdown: &str, context: &Context) -> Humanized {
    let before = score(markdown);
    let (scrubbed, mut stripped) = scrub(markdown, &context.banned_phrases);
    let skeleton = fingerprint(markdown);
    let mut text = scrubbed;
    let mut passes = 1u32;
    let mut llm = false;
    let mut note = format!("Blader humanizer {HUMANIZER_VERSION} · deterministic pass only");

    let mut spend = Spend::default();
    if let Some(engine) = engine {
        let voice = voice_block(context);
        let issues = audit(engine, &text, &voice, &mut spend).await;
        let issues = if issues.is_empty() {
            before
                .1
                .iter()
                .take(12)
                .map(|hit| format!("[{}] {} ({}) — {}", hit.id, hit.pattern, hit.group, hit.excerpt))
                .collect::<Vec<_>>()
        } else {
            issues
        };
        if issues.is_empty() {
            note = format!("Blader humanizer {HUMANIZER_VERSION} · audit found no remaining tells");
        } else {
            match rewrite(engine, &text, &voice, &issues, &mut spend).await {
                Some(candidate) if candidate.trim().len() > 200 && structure_intact(skeleton, fingerprint(&candidate)) => {
                    text = candidate;
                    llm = true;
                    passes = 2;
                    note = format!("Blader humanizer {HUMANIZER_VERSION} · audit + surgical rewrite (2 passes)");
                }
                Some(_) => {
                    stripped.push("rewriter broke the markdown structure — deterministic result kept".to_string());
                    note = format!("Blader humanizer {HUMANIZER_VERSION} · deterministic pass (LLM rewrite failed the structure check)");
                }
                None => {
                    stripped.push("rewriter returned invalid JSON — deterministic result kept".to_string());
                    note = format!("Blader humanizer {HUMANIZER_VERSION} · deterministic pass (LLM rewrite unusable)");
                }
            }
        }
    }

    let (final_score, _) = score(&text);
    Humanized { markdown: text, score: final_score, stripped, passes, llm, note, spend }
}

async fn audit(engine: &Engine, sample: &str, voice: &str, spend: &mut Spend) -> Vec<String> {
    let user = [voice.to_string(), "Sample to audit:".to_string(), sample.to_string()]
        .into_iter()
        .filter(|part| !part.is_empty())
        .collect::<Vec<_>>()
        .join("\n\n");
    let request = ChatRequest {
        schema: "humanize_audit".to_string(),
        system: AUDIT_CONTRACT.to_string(),
        user,
        json: true,
        images: Vec::new(),
    };
    let Ok(completion) = engine.complete(&request).await else {
        return Vec::new();
    };
    spend.tokens_in += completion.tokens_in;
    spend.tokens_out += completion.tokens_out;
    spend.cost_usd += completion.cost_usd;
    parse_json(&completion.text)
        .and_then(|value| value.get("issues").and_then(|issues| issues.as_array()).cloned())
        .map(|issues| {
            issues
                .iter()
                .filter_map(|issue| {
                    let note = issue.get("note").and_then(|n| n.as_str())?;
                    let id = issue.get("id").and_then(|i| i.as_u64()).unwrap_or(0);
                    Some(format!("[{id}] {note}"))
                })
                .take(12)
                .collect()
        })
        .unwrap_or_default()
}

async fn rewrite(
    engine: &Engine,
    article: &str,
    voice: &str,
    issues: &[String],
    spend: &mut Spend,
) -> Option<String> {
    let system = if voice.is_empty() {
        REWRITE_CONTRACT.to_string()
    } else {
        format!("{REWRITE_CONTRACT}\n\n{voice}")
    };
    let user = [
        "AI tells to remove (detected by the audit pass):".to_string(),
        issues
            .iter()
            .enumerate()
            .map(|(index, issue)| format!("{}. {issue}", index + 1))
            .collect::<Vec<_>>()
            .join("\n"),
        String::new(),
        "Article to rewrite:".to_string(),
        article.to_string(),
    ]
    .join("\n");
    let request = ChatRequest {
        schema: "humanize_rewrite".to_string(),
        system,
        user,
        json: true,
        images: Vec::new(),
    };
    let completion = engine.complete(&request).await.ok()?;
    spend.tokens_in += completion.tokens_in;
    spend.tokens_out += completion.tokens_out;
    spend.cost_usd += completion.cost_usd;
    parse_json(&completion.text)
        .and_then(|value| value.get("markdown").and_then(|m| m.as_str()).map(|s| s.to_string()))
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn a_clean_article_scores_a_hundred() {
        let clean = "# How to store coffee\n\nGrind beans just before brewing. Water sits at 92C. \
                     A burr grinder beats a blade one for even grounds.";
        assert_eq!(score(clean).0, 100, "no tells means a perfect score");
    }

    #[test]
    fn dashes_and_curly_quotes_are_stripped() {
        let dirty = "# Title\n\nThe grinder — the cheap one — is fine.\n\n“Grind fresh,” she said.";
        let (clean, stripped) = scrub(dirty, &[]);
        assert!(!clean.contains('—'), "em dashes go: {clean}");
        assert!(!clean.contains('“'), "curly quotes go: {clean}");
        assert!(stripped.iter().any(|s| s.contains("dashes")));
    }

    #[test]
    fn banned_vocabulary_is_swapped_outside_code() {
        let dirty = "We delve into the tapestry.\n\n```\ndelve\ntapestry\n```\n";
        let (clean, _) = scrub(dirty, &[]);
        assert!(clean.contains("examine the mix"), "prose is rewritten: {clean}");
        assert!(clean.contains("delve\ntapestry"), "code is untouched: {clean}");
    }

    #[test]
    fn chatbot_residue_and_filler_closers_do_not_survive() {
        let dirty = "# Title\n\nThe grinder is fine. I hope this helps.\n\nLet that sink in.\n";
        let (clean, _) = scrub(dirty, &[]);
        assert!(!clean.to_lowercase().contains("i hope this helps"), "{clean}");
        assert!(!clean.to_lowercase().contains("sink in"), "{clean}");
    }

    #[test]
    fn the_not_x_but_y_contrast_is_rewritten() {
        let dirty = "# Title\n\nIt's not just a grinder, it's a ritual.\n";
        let (clean, _) = scrub(dirty, &[]);
        assert!(clean.contains("A grinder, and a ritual."), "{clean}");
    }

    #[test]
    fn structure_intact_rejects_a_rewrite_that_drops_sections() {
        let before = fingerprint("# A\n\n## One\n\n## Two\n\n| a | b |\n| - | - |\n");
        let after = fingerprint("# A\n\nOne short paragraph.\n");
        assert!(!structure_intact(before, after), "a rewrite that loses headings is refused");
        assert!(structure_intact(before, fingerprint("# A\n\n## One\n\n## Two\n\n| a | b |\n| - | - |\n\nMore prose here.\n")));
    }

    #[tokio::test]
    async fn without_an_engine_the_deterministic_pass_still_runs() {
        let dirty = "# Title\n\nIt's not just a grinder — it's a ritual. I hope this helps.";
        let result = humanize(None, dirty, &Context::default()).await;
        assert!(!result.llm, "no engine, no model pass");
        assert_eq!(result.passes, 1);
        assert!(!result.markdown.contains('—'));
        assert!(result.score >= score(dirty).0, "the scrub cannot make the score worse");
    }
}
