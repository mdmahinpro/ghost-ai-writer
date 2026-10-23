//! Humanizer linter — the deterministic half of the writing-quality gate.
//!
//! Implements the machine-checkable subset of blader/humanizer's 34 "signs of
//! AI writing" patterns (see docs/WRITING-QUALITY.md). The LLM revision pass
//! handles judgement calls; this module only reports what can be counted, so a
//! publish decision is never "the model said it was fine".
//!
//! Severity: `High` blocks publish. `Medium` is advisory but surfaced.

use regex::Regex;
use serde::Serialize;
use std::sync::OnceLock;

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize)]
#[serde(rename_all = "lowercase")]
pub enum Severity {
    High,
    Medium,
}

#[derive(Debug, Serialize)]
pub struct Finding {
    pub rule: &'static str,
    pub pattern: &'static str,
    pub severity: Severity,
    pub count: usize,
    pub samples: Vec<String>,
}

#[derive(Debug, Serialize)]
pub struct Report {
    pub words: usize,
    pub findings: Vec<Finding>,
    pub high: usize,
    pub medium: usize,
    /// Publish gate: true only when no High-severity finding exists.
    pub passed: bool,
}

struct Rule {
    id: &'static str,
    pattern: &'static str,
    severity: Severity,
    re: Regex,
    /// Hit count that starts to count, so one legitimate use is not a failure.
    threshold: usize,
}

fn rules() -> &'static [Rule] {
    static RULES: OnceLock<Vec<Rule>> = OnceLock::new();
    RULES.get_or_init(|| {
        let mk = |id, pattern, severity, re: &str, threshold| Rule {
            id,
            pattern,
            severity,
            re: Regex::new(re).expect("valid regex"),
            threshold,
        };
        vec![
            mk("not_x_but_y", "1", Severity::High,
               r"(?i)\bnot (just|only|merely)\b[^.!?\n]{0,60}\b(it'?s|it is|but)\b", 1),
            mk("one_line_closer", "2", Severity::High,
               r"(?i)\b(let that sink in|that'?s the real win|this is the part that matters|and that'?s the point)\b", 1),
            mk("deep_saying", "3/27", Severity::High,
               r"(?i)\b(at its core|the real question is|what really matters|the heart of the matter|the deeper issue|fundamentally,)\b", 1),
            mk("staged_runup", "4/28", Severity::High,
               r"(?i)\b(let'?s (dive|explore|break|unpack)|here'?s what you need to know|without further ado|let me be clear|let'?s take a step back)\b", 1),
            mk("ai_vocab", "7", Severity::High,
               r"(?i)\b(delve[sd]?|underscore[sd]?|testament|tapestry|vibrant|pivotal|intricate|showcase[sd]?|garner(ed|s)?|foster(ed|ing|s)?|enhanc(ed|ing|es)|landscape of)\b", 3),
            mk("copula_avoidance", "8", Severity::High,
               r"(?i)\b(serves as|stands as|functions as|boasts|nestled in|represents a)\b", 2),
            mk("filler_closer", "23/25", Severity::High,
               r"(?i)\b(in conclusion|in summary|it is important to note|at the end of the day|when it comes to|due to the fact that)\b", 1),
            mk("opener_tic", "33", Severity::Medium,
               r"(?mi)^\s*(so|look|honestly|frankly|interestingly|importantly|notably|crucially|ultimately)[,:]\s", 2),
            mk("rhetorical_question", "32", Severity::Medium,
               r"(?i)\b(ever wondered|think about it|what makes (a|an|the)\b[^?]{0,40}\?)", 1),
            mk("reassurance_kicker", "34", Severity::Medium,
               r"(?i)\b(and that'?s okay|and that'?s fine|there'?s nothing wrong with that|you'?re not alone|it'?s completely normal)\b", 1),
            mk("persuasive_trope", "5", Severity::Medium,
               r"(?i)\b(a tempting approach|this isn'?t mainly about|some might argue|it'?s tempting to)\b", 1),
            mk("hyphen_pair", "26", Severity::Medium,
               r"\b(third-party|cross-functional|client-facing|data-driven|decision-making|real-time|end-to-end|high-quality|well-known|long-term)\b", 4),
        ]
    })
}

/// Unicode that never appears in hand-typed prose.
fn unicode_checks(text: &str) -> Vec<Finding> {
    let mut out = Vec::new();
    let emoji: Vec<char> = text
        .chars()
        .filter(|c| matches!(*c as u32, 0x1F300..=0x1FAFF | 0x2600..=0x27BF))
        .collect();
    if !emoji.is_empty() {
        out.push(Finding {
            rule: "emoji",
            pattern: "18",
            severity: Severity::High,
            count: emoji.len(),
            samples: vec![emoji.iter().take(5).collect::<String>()],
        });
    }
    let curly: Vec<char> = text
        .chars()
        .filter(|c| matches!(*c, '\u{201C}' | '\u{201D}' | '\u{2018}' | '\u{2019}'))
        .collect();
    if !curly.is_empty() {
        out.push(Finding {
            rule: "curly_quotes",
            pattern: "19",
            severity: Severity::High,
            count: curly.len(),
            samples: vec![curly.iter().take(8).collect::<String>()],
        });
    }
    out
}

/// Density checks: style tells that only fail when overused.
fn density_checks(text: &str, words: usize) -> Vec<Finding> {
    let mut out = Vec::new();
    if words == 0 {
        return out;
    }
    // Rates need a real sample: on a 20-word snippet any dash is "500 per 1000".
    // Below 120 words use an absolute cap instead of a rate.
    let long_enough = words >= 120;
    let over = |n: usize, per_k_limit: f64, abs_limit: usize| {
        if long_enough {
            (n as f64) * 1000.0 / (words as f64) > per_k_limit
        } else {
            n > abs_limit
        }
    };
    let em_dashes = text.matches('\u{2014}').count();
    if over(em_dashes, 2.0, 4) {
        out.push(Finding {
            rule: "em_dash_density",
            pattern: "14",
            severity: Severity::High,
            count: em_dashes,
            samples: vec![format!("{em_dashes} em dashes in {words} words")],
        });
    }
    let bold = Regex::new(r"\*\*[^*\n]{1,80}\*\*")
        .unwrap()
        .find_iter(text)
        .count();
    if over(bold, 6.0, 8) {
        out.push(Finding {
            rule: "boldface_density",
            pattern: "15",
            severity: Severity::Medium,
            count: bold,
            samples: vec![format!("{bold} bold spans in {words} words")],
        });
    }
    out
}

/// A heading followed by a one-line paragraph that just restates it (pattern 29),
/// plus Title Case headings (pattern 17).
fn structure_checks(text: &str) -> Vec<Finding> {
    let mut frag = Vec::new();
    let mut title_case = Vec::new();
    let mut lines = text.lines().peekable();
    while let Some(line) = lines.next() {
        let t = line.trim();
        if !t.starts_with('#') {
            continue;
        }
        let heading = t.trim_start_matches('#').trim();
        if heading.is_empty() {
            continue;
        }
        let words: Vec<&str> = heading.split_whitespace().collect();
        if words.len() >= 3 {
            let capped = words
                .iter()
                .filter(|w| w.chars().next().map(|c| c.is_uppercase()).unwrap_or(false))
                .count();
            if capped as f64 / words.len() as f64 > 0.7 {
                title_case.push(heading.to_string());
            }
        }
        // next non-empty line (blank lines between a heading and its lead-in are normal)
        let mut next = None;
        for l in lines.clone() {
            let lt = l.trim();
            if lt.is_empty() {
                continue;
            }
            if !lt.starts_with('#') {
                next = Some(lt.to_string());
            }
            break;
        }
        if let Some(para) = next {
            if para.split_whitespace().count() <= 12 {
                frag.push(format!("{heading} -> {para}"));
            }
        }
    }
    let mut out = Vec::new();
    if !frag.is_empty() {
        out.push(Finding {
            rule: "fragmented_header",
            pattern: "29",
            severity: Severity::High,
            count: frag.len(),
            samples: frag.into_iter().take(3).collect(),
        });
    }
    if !title_case.is_empty() {
        out.push(Finding {
            rule: "title_case_heading",
            pattern: "17",
            severity: Severity::Medium,
            count: title_case.len(),
            samples: title_case.into_iter().take(3).collect(),
        });
    }
    out
}

pub fn word_count(text: &str) -> usize {
    text.split_whitespace()
        .filter(|w| w.chars().any(|c| c.is_alphanumeric()))
        .count()
}

/// Lint a draft. Pure function: same input, same report.
pub fn lint(text: &str) -> Report {
    let words = word_count(text);
    let mut findings: Vec<Finding> = Vec::new();

    for rule in rules() {
        let samples: Vec<String> = rule
            .re
            .find_iter(text)
            .take(3)
            .map(|m| {
                let s = m.as_str().trim().to_string();
                if s.chars().count() > 90 {
                    s.chars().take(90).collect::<String>() + "…"
                } else {
                    s
                }
            })
            .collect();
        let count = rule.re.find_iter(text).count();
        if count >= rule.threshold {
            findings.push(Finding {
                rule: rule.id,
                pattern: rule.pattern,
                severity: rule.severity,
                count,
                samples,
            });
        }
    }

    findings.extend(unicode_checks(text));
    findings.extend(density_checks(text, words));
    findings.extend(structure_checks(text));

    let high = findings
        .iter()
        .filter(|f| f.severity == Severity::High)
        .map(|f| f.count)
        .sum();
    let medium = findings
        .iter()
        .filter(|f| f.severity == Severity::Medium)
        .map(|f| f.count)
        .sum();
    Report {
        words,
        high,
        medium,
        passed: high == 0,
        findings,
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    const SLOP: &str = "## Strategic Negotiations And Global Partnerships\n\n\
Speed matters.\n\n\
I'm thrilled to share this. It's not just a feature, it's a whole new way to work. \
At its core, what really matters is collaboration. Let me be clear: this is pivotal. \
Teams will delve into a vibrant tapestry of workflows, fostering alignment and \
enhancing outcomes across the landscape of modern work. Let that sink in.\n\n\
In conclusion, it's important to note that the future looks bright. \u{201C}Exciting times\u{201D} ahead 🚀";

    const HUMAN: &str = "## What the export option does\n\n\
It writes every article to a zip file, one markdown file per article, plus a CSV \
index with the title, slug and publish date. The CSV opens in Sheets without \
conversion. Files keep the slug as their name, so a re-import lands on the same \
article instead of creating a duplicate.\n\n\
## Limits\n\n\
Images stay behind: the zip links to the CDN URL instead of embedding bytes, so an \
article exported today can lose its hero image later if the source moves it. That is \
the trade for a 40 KB export instead of a 200 MB one.";

    #[test]
    fn catches_the_classic_slop_paragraph() {
        let r = lint(SLOP);
        assert!(!r.passed, "slop must fail the gate");
        let ids: Vec<&str> = r.findings.iter().map(|f| f.rule).collect();
        for expected in [
            "not_x_but_y",
            "deep_saying",
            "staged_runup",
            "one_line_closer",
            "filler_closer",
            "curly_quotes",
            "emoji",
            "fragmented_header",
            "title_case_heading",
        ] {
            assert!(ids.contains(&expected), "missed {expected}; got {ids:?}");
        }
        assert!(
            r.high >= 6,
            "expected several high findings, got {}",
            r.high
        );
    }

    #[test]
    fn passes_plain_human_prose() {
        let r = lint(HUMAN);
        assert!(r.passed, "human prose blocked: {:?}", r.findings);
        assert_eq!(r.high, 0);
    }

    #[test]
    fn single_ai_vocab_hit_is_tolerated_but_three_is_not() {
        assert!(lint("We delve once.").passed);
        let r = lint("We delve, then showcase, then foster.");
        assert!(!r.passed);
    }

    #[test]
    fn em_dash_density_needs_overuse() {
        assert!(
            lint("One clause — a small aside — and then a normal sentence follows here.").passed
        );
        let heavy = "a — b — c — d — e — f — g — h.";
        assert!(!lint(heavy).passed);
    }

    #[test]
    fn heading_restating_itself_is_flagged() {
        let r = lint("## Performance\n\nSpeed matters.\n\nWhen users hit a slow page, they leave.");
        assert!(r.findings.iter().any(|f| f.rule == "fragmented_header"));
    }

    #[test]
    fn question_style_headings_are_fine() {
        let r = lint("## How do I export my articles?\n\nThe export button writes a zip with one markdown file per article and a CSV index of titles and slugs.");
        assert!(r.passed, "{:?}", r.findings);
    }
}
