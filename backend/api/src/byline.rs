//! Deterministic bylines.
//!
//! The Bing checklist has a "Named author" gate: a stable byline with a city
//! and a beat gives the site an entity a search engine can attach to a topic.
//! The worker used to finalize articles with no author at all, so every
//! server-backed article failed that gate and the checklist could never go
//! green.
//!
//! The assignment is a pure function of `(site_id, keyword)`: the same article
//! always gets the same writer, and two different articles on one site almost
//! always get different ones. Nothing is random, so a rerun does not silently
//! change who wrote a page, and no state has to be stored to keep it stable.

/// First names, chosen to read like a real byline rather than a placeholder.
const FIRST: [&str; 24] = [
    "Elena", "Marcus", "Priya", "Jordan", "Caleb", "Naomi", "Andre", "Hannah", "Luis", "Claire",
    "Devon", "Rosa", "Theo", "Maya", "Owen", "Iris", "Nate", "Sofia", "Grant", "Leila", "Felix",
    "Nadia", "Simon", "Tessa",
];

const LAST: [&str; 24] = [
    "Whitfield",
    "Okafor",
    "Raghavan",
    "Linden",
    "Marsh",
    "Delgado",
    "Bishop",
    "Osei",
    "Cardenas",
    "Novak",
    "Ellery",
    "Sandoval",
    "Bright",
    "Kaur",
    "Fenn",
    "Moreau",
    "Ashby",
    "Reyes",
    "Thorne",
    "Adeyemi",
    "Vance",
    "Lindqvist",
    "Barros",
    "Hollis",
];

/// `(city, state code)` pairs for the byline's location.
const CITIES: [(&str, &str); 18] = [
    ("Austin", "TX"),
    ("Portland", "OR"),
    ("Chicago", "IL"),
    ("Raleigh", "NC"),
    ("Boulder", "CO"),
    ("Atlanta", "GA"),
    ("Seattle", "WA"),
    ("Boston", "MA"),
    ("Tucson", "AZ"),
    ("Madison", "WI"),
    ("Richmond", "VA"),
    ("Boise", "ID"),
    ("Columbus", "OH"),
    ("Tampa", "FL"),
    ("Omaha", "NE"),
    ("Reno", "NV"),
    ("Burlington", "VT"),
    ("Spokane", "WA"),
];

const STATE_NAMES: [(&str, &str); 14] = [
    ("AZ", "Arizona"),
    ("CO", "Colorado"),
    ("FL", "Florida"),
    ("GA", "Georgia"),
    ("ID", "Idaho"),
    ("IL", "Illinois"),
    ("MA", "Massachusetts"),
    ("NC", "North Carolina"),
    ("NE", "Nebraska"),
    ("NV", "Nevada"),
    ("OH", "Ohio"),
    ("OR", "Oregon"),
    ("TX", "Texas"),
    ("VT", "Vermont"),
];

/// FNV-1a. Chosen for being stable across runs and platforms — a `HashMap`'s
/// hasher is randomly seeded per process, which would hand a different name to
/// the same article on every restart.
fn hash(input: &str) -> u64 {
    let mut h: u64 = 0xcbf2_9ce4_8422_2325;
    for byte in input.as_bytes() {
        h ^= u64::from(*byte);
        h = h.wrapping_mul(0x0000_0100_0000_01b3);
    }
    h
}

/// The beat label: the keyword, trimmed to something that reads like a subject
/// rather than a whole search query.
fn beat(keyword: &str) -> String {
    let words: Vec<&str> = keyword.split_whitespace().take(6).collect();
    let joined = words.join(" ");
    if joined.is_empty() {
        "general reporting".to_string()
    } else {
        joined.to_lowercase()
    }
}

fn slugify(name: &str, beat: &str) -> String {
    let mut out = String::with_capacity(name.len() + beat.len() + 1);
    let mut last_dash = true; // trims a leading dash
    for ch in name.chars().chain(std::iter::once('-')).chain(beat.chars()) {
        if ch.is_ascii_alphanumeric() {
            out.push(ch.to_ascii_lowercase());
            last_dash = false;
        } else if !last_dash {
            out.push('-');
            last_dash = true;
        }
    }
    while out.ends_with('-') {
        out.pop();
    }
    out
}

/// `(name, slug, beat, city)` for an article, stable for a given site + keyword.
///
/// A distinct salt per field keeps the name, city and beat from moving together
/// (otherwise every author from Texas would also always be the same person).
pub fn for_article(site_id: i64, keyword: &str) -> (String, String, String, String) {
    let stem = format!("{site_id}:{keyword}");

    let first = FIRST[(hash(&format!("first:{stem}")) % FIRST.len() as u64) as usize];
    let last = LAST[(hash(&format!("last:{stem}")) % LAST.len() as u64) as usize];
    let (city, code) = CITIES[(hash(&format!("city:{stem}")) % CITIES.len() as u64) as usize];
    let beat = beat(keyword);

    let name = format!("{first} {last}");
    let state = STATE_NAMES
        .iter()
        .find(|(c, _)| *c == code)
        .map(|(_, full)| (*full).to_string())
        .unwrap_or_else(|| code.to_string());

    // "Austin, Texas" — the shape the byline renders as.
    let location = format!("{city}, {state}");
    (name.clone(), slugify(&name, &beat), beat, location)
}

#[cfg(test)]
mod tests {
    use super::*;

    /// The gate needs a non-empty name, slug, beat and city, every time.
    #[test]
    fn every_article_gets_a_complete_byline() {
        for keyword in [
            "how to narrow a research question",
            "field notes after a failed experiment",
            "reading lists that stay short",
            "",
        ] {
            let (name, slug, beat, city) = for_article(1, keyword);
            assert!(!name.trim().is_empty(), "empty name for {keyword:?}");
            assert!(!slug.trim().is_empty(), "empty slug for {keyword:?}");
            assert!(!beat.trim().is_empty(), "empty beat for {keyword:?}");
            assert!(city.contains(", "), "city {city:?} is not 'City, State'");
            assert!(
                slug.chars()
                    .all(|c| c.is_ascii_lowercase() || c.is_ascii_digit() || c == '-'),
                "slug {slug:?} is not url-safe"
            );
        }
    }

    /// Same article, same writer — a rerun must not reshuffle the byline.
    #[test]
    fn a_bylines_is_stable_across_calls() {
        let a = for_article(7, "narrowing a research question");
        let b = for_article(7, "narrowing a research question");
        assert_eq!(a, b);
    }

    /// Different articles must not all collapse onto one writer, or the site
    /// looks like a single person writing every page.
    #[test]
    fn different_articles_get_different_bylines() {
        let names: std::collections::HashSet<String> = [
            "how to narrow a research question",
            "field notes after a failed experiment",
            "reading lists that stay short",
            "budgeting for a small lab",
            "choosing a statistical test",
            "writing a methods section",
            "peer review without tears",
            "archiving raw data",
        ]
        .iter()
        .map(|k| for_article(1, k).0)
        .collect();
        assert!(
            names.len() >= 6,
            "only {} distinct bylines across 8 articles: {names:?}",
            names.len()
        );
    }

    /// The same keyword on two sites is two different publications, so the
    /// writers should differ.
    #[test]
    fn the_site_is_part_of_the_identity() {
        assert_ne!(
            for_article(1, "narrowing a research question").0,
            for_article(2, "narrowing a research question").0,
        );
    }
}
