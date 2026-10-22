/**
 * Rule 2 — Smart Auto-Author Engine.
 *
 * Every author is a US-based expert persona with an explicit expertise list, a
 * unique humanized voice block, and a small external avatar URL string
 * (an on-the-fly resize CDN in front of thispersondoesnotexist.com). Avatars are
 * never downloaded: static builds store ~130 bytes of URL text per author, so
 * 10,000+ articles add zero disk bloat and no image bytes.
 */
import type { AuthorProfile, AuthorVoice, Persisted, Site } from "./types.ts";
import { DEFAULT_AUTHOR_CAP } from "./types.ts";
import { hashStr, uid } from "./utils.ts";
import { avatarSourceUrl, isOurAvatarUrl } from "./avatar.ts";

const FIRST = [
  "Elena", "Marcus", "Priya", "Jordan", "Caleb", "Naomi", "Andre", "Hannah", "Luis", "Claire",
  "Owen", "Maya", "Nathan", "Sophie", "Derek", "Amelia", "Isaac", "Grace", "Malik", "Fiona",
  "Jonah", "Rebecca", "Adrian", "Lauren", "Cole", "Vanessa", "Ethan", "Iris", "Grant", "Camille",
  "Trevor", "Dana", "Wyatt", "Leah", "Curtis", "Paige", "Ronan", "Alice", "Devin", "Tessa",
  "Brady", "Jenna", "Sawyer", "Noelle", "Gavin", "Rosa", "Hunter", "Elena", "Chase", "Brianna",
];

const LAST = [
  "Bennett", "Okonkwo", "Alvarez", "Chen", "Patel", "Brooks", "Nguyen", "Harper", "Delgado", "Walsh",
  "Kim", "Foster", "Rahman", "Ellis", "Murphy", "Shah", "Brennan", "Ortiz", "Blake", "Carter",
  "Whitfield", "Langley", "Mercer", "Ashford", "Calder", "Thibodeaux", "Vance", "Hargrove", "Sinclair", "Pruitt",
  "Kowalski", "Maddox", "Reyes", "Thornton", "Quinn", "Barlowe", "Kensington", "Ueda", "Voss", "Winslow",
];

const STATES: [string, string][] = [
  ["Austin", "TX"], ["Denver", "CO"], ["Portland", "OR"], ["Chicago", "IL"], ["Seattle", "WA"],
  ["Boston", "MA"], ["Atlanta", "GA"], ["Minneapolis", "MN"], ["Raleigh", "NC"], ["Phoenix", "AZ"],
  ["San Diego", "CA"], ["Columbus", "OH"], ["Nashville", "TN"], ["Madison", "WI"], ["Ann Arbor", "MI"],
  ["Pittsburgh", "PA"], ["Savannah", "GA"], ["Burlington", "VT"], ["Sacramento", "CA"], ["Boulder", "CO"],
  ["Boise", "ID"], ["Tucson", "AZ"], ["Omaha", "NE"], ["Louisville", "KY"], ["Richmond", "VA"],
  ["Salt Lake City", "UT"], ["Kansas City", "MO"], ["Providence", "RI"], ["Charleston", "SC"], ["Asheville", "NC"],
];

/** Full state names kept for bios; badges use the two-letter code above. */
const STATE_NAMES: Record<string, string> = {
  TX: "Texas", CO: "Colorado", OR: "Oregon", IL: "Illinois", WA: "Washington", MA: "Massachusetts",
  GA: "Georgia", MN: "Minnesota", NC: "North Carolina", AZ: "Arizona", CA: "California", OH: "Ohio",
  TN: "Tennessee", WI: "Wisconsin", MI: "Michigan", PA: "Pennsylvania", VT: "Vermont", ID: "Idaho",
  NE: "Nebraska", KY: "Kentucky", VA: "Virginia", UT: "Utah", MO: "Missouri", RI: "Rhode Island", SC: "South Carolina",
};

const RHYTHMS = [
  "short declaratives; one longer breathing sentence closes each paragraph",
  "front-loaded answers, then two supporting beats; never a sentence over 22 words",
  "question-shaped opener, plain middle, single punchline per section",
  "staccato start, list cadence, soft landing on the practical takeaway",
  "varied bursts: three tight sentences, one long, one fragment for emphasis",
];

const DICTIONS = [
  "plain American English; one precise term per idea, no jargon stacking",
  "concrete nouns and active verbs; zero hedging adverbs",
  "conversational but exact; contractions allowed, buzzwords banned",
  "numbers written out below ten; specific beats vague every time",
  "second-nature clarity: the reader ran out of patience two scrolls ago",
];

const MOVES = [
  "opens with the decision, not the definition",
  "names the exception before the rule",
  "turns every list item into a mini consequence",
  "ends each section with one sentence you could screenshot",
  "compares against a cheaper or slower alternative",
  "answers the follow-up question before it is asked",
  "quotes a realistic ballpark figure with two sig-figs",
  "retells one tiny anecdote (freshmen-in-their-dorm specificity)",
  "flags the one thing people get illegally wrong",
  "closes by handing the reader the next step, not a summary",
];

const BANNED = [
  "in today's fast-paced world", "delve", "tapestry", "unlock", "game-changer", "seamless",
  "look no further", "robust", "leverage", "navigate the landscape", "in conclusion",
  "it is important to note", "revolutionize", "cutting-edge", "harness the power",
];

const STOP = new Set(["how", "to", "a", "an", "the", "for", "of", "and", "in", "on", "your", "with", "from", "that", "this", "best", "guide", "what", "why"]);

const label = (value: string) => value.replace(/\b\w/g, (c) => c.toUpperCase());

const STEM_CACHE = new Map<string, string>();

export function topicStem(keyword: string): string {
  const raw = String(keyword ?? "");
  const cached = STEM_CACHE.get(raw);
  if (cached !== undefined) return cached;
  const words = raw
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/)
    .filter((word) => word.length > 3 && !STOP.has(word));
  const stem = (words.slice(0, 2).join(" ") || raw.toLowerCase().trim() || "general").slice(0, 48);
  if (STEM_CACHE.size > 20000) STEM_CACHE.clear();
  STEM_CACHE.set(raw, stem);
  return stem;
}

function slugify(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 56);
}

/** Normalized expertise tokens used for niche → author matching (memoized — intake can process 10k+ jobs). */
const TOKEN_CACHE = new Map<string, string[]>();

export function expertiseTokens(topic: string): string[] {
  const cached = TOKEN_CACHE.get(topic);
  if (cached) return cached;
  const stem = topicStem(topic);
  const extra = stem
    .split(" ")
    .filter((word) => word.length > 3 && !STOP.has(word));
  const tokens = [...new Set([stem, ...extra].filter(Boolean))];
  if (TOKEN_CACHE.size > 20000) TOKEN_CACHE.clear();
  TOKEN_CACHE.set(topic, tokens);
  return tokens;
}

function expertiseForTopic(topic: string, stem: string, tags: string[] = []): string[] {
  const domain = label(stem);
  const tokens = expertiseTokens(topic);
  const tail = tokens.length > 1 ? label(tokens[1]!) : "Search-ready explainers";
  return [...new Set([domain, tail, ...tags, "Source-checked guides"])].slice(0, 3);
}

/* ------------------------------- Rule 2 persona engine -------------------------------
 * The pipeline never defaults every author to a generic "Staff Reporter" again. The
 * topic, niche and angle decide the persona first: an academic topic yields a real
 * current doctoral researcher at a US university, a trades topic yields a working
 * tradesperson, and an experiential or practitioner guide is written in the FIRST
 * PERSON from lived experience. Deterministic per topic, so retries and rehydrations
 * always resolve the same persona.
 */

const ACADEMIC_FIELDS = [
  "Computational Biology", "Materials Science", "Public Health", "Computer Science",
  "Neuroscience", "Environmental Engineering", "Sociology", "Chemical Engineering",
  "Psychology", "Economics", "Mechanical Engineering", "Immunology", "Statistics",
  "Biomedical Engineering", "Astrophysics",
];

/** [university, city, state code] — the persona's affiliation is kept internally consistent. */
const UNIVERSITIES: [string, string, string][] = [
  ["UC Berkeley", "Berkeley", "CA"],
  ["University of Michigan", "Ann Arbor", "MI"],
  ["Georgia Tech", "Atlanta", "GA"],
  ["UT Austin", "Austin", "TX"],
  ["University of Washington", "Seattle", "WA"],
  ["Purdue University", "West Lafayette", "IN"],
  ["University of Florida", "Gainesville", "FL"],
  ["Penn State", "State College", "PA"],
  ["Ohio State University", "Columbus", "OH"],
  ["Arizona State University", "Tempe", "AZ"],
  ["MIT", "Cambridge", "MA"],
  ["Stanford University", "Stanford", "CA"],
];

const PHD_YEARS = ["2nd", "3rd", "3rd", "4th", "5th"];

const ACADEMIC_CUES = [
  "phd", "ph.d", "doctoral", "doctorate", "grad school", "graduate school", "graduate student",
  "dissertation", "thesis", "master's", "masters", "postdoc", "post-doc", "qualifying exam",
  "academic", "academia", "tenure", "faculty", "professor", "university", "undergrad", "college",
  "campus", "fellowship", "grad student", "grad life", "phd life",
];

type PersonaFamily = {
  id: string;
  cues: string[];
  roles: string[];
  tags: string[];
  /** Lived, practitioner experience → first-person narration. */
  experiential: boolean;
};

const PERSONA_FAMILIES: PersonaFamily[] = [
  {
    id: "health",
    cues: ["nurse", "nursing", "dietitian", "nutrition", "therapist", "therapy", "mental health", "anxiety", "depression", "counseling", "fitness", "workout", "strength training", "marathon", "running", "sleep", "insomnia", "recovery", "physical therapy"],
    roles: ["Registered Nurse (BSN, RN)", "Registered Dietitian Nutritionist", "Licensed Clinical Social Worker", "Certified Strength and Conditioning Specialist", "Behavioral Sleep Medicine Specialist"],
    tags: ["Patient-facing care", "Evidence-based practice"],
    experiential: true,
  },
  {
    id: "tech",
    cues: ["software", "developer", "programming", "coding", "front-end", "frontend", "back-end", "backend", "api", "web development", "javascript", "react", "python", "devops", "kubernetes", "cloud", "cybersecurity", "security engineer", "data science", "data engineer", "machine learning", "artificial intelligence", "database", "docker"],
    roles: ["Senior Software Engineer", "Frontend Engineer", "Platform and DevOps Engineer", "Data Scientist", "Security Engineer"],
    tags: ["Production systems", "Developer tooling"],
    experiential: false,
  },
  {
    id: "finance",
    cues: ["investing", "investment", "stocks", "portfolio", "retirement", "401k", "tax", "taxes", "accounting", "budget", "budgeting", "saving", "debt", "credit", "mortgage", "real estate", "insurance", "personal finance", "salary"],
    roles: ["Chartered Financial Analyst (CFA)", "Certified Public Accountant (CPA)", "Accredited Financial Counselor", "Licensed Real Estate Broker"],
    tags: ["Personal finance", "Planning and risk"],
    experiential: false,
  },
  {
    id: "business",
    cues: ["marketing", "seo", "branding", "startup", "entrepreneur", "founder", "ecommerce", "e-commerce", "sales", "growth", "social media", "advertising", "freelance", "freelancing", "consulting", "remote work"],
    roles: ["Growth Marketing Lead", "Founder and Operator", "Enterprise Sales Director", "Independent Consultant"],
    tags: ["Growth and operations", "Client work"],
    experiential: false,
  },
  {
    id: "legal",
    cues: ["law", "legal", "lawyer", "attorney", "immigration", "patent", "contract", "lawsuit", "court"],
    roles: ["Immigration Attorney", "Contract Attorney", "Patent Attorney"],
    tags: ["Compliance", "Client advocacy"],
    experiential: false,
  },
  {
    id: "education",
    cues: ["teacher", "teaching", "classroom", "curriculum", "pedagogy", "lesson plan", "homeschool", "school district", "esl", "language learning"],
    roles: ["High School Teacher (M.Ed.)", "Curriculum Designer", "ESL Instructor"],
    tags: ["Classroom practice", "Learning design"],
    experiential: true,
  },
  {
    id: "creative",
    cues: ["writing", "writer", "copywriting", "novel", "author", "blogging", "design", "ux", "graphic design", "photography", "camera", "music", "guitar", "video", "filmmaking", "youtube"],
    roles: ["Freelance Writer and Editor", "Product Designer", "Professional Photographer", "Video Producer"],
    tags: ["Creative practice", "Portfolio craft"],
    experiential: true,
  },
  {
    id: "home",
    cues: ["recipe", "cooking", "baking", "kitchen", "chef", "meal", "home improvement", "diy", "renovation", "repair", "plumbing", "woodworking", "gardening", "landscaping", "lawn", "auto repair", "car maintenance"],
    roles: ["Chef and Recipe Developer", "Home Improvement Contractor", "Master Gardener", "Automotive Technician"],
    tags: ["Hands-on work", "Real-world results"],
    experiential: true,
  },
  {
    id: "travel",
    cues: ["travel", "backpacking", "nomad", "itinerary", "flight", "hotel", "road trip"],
    roles: ["Travel Writer", "Full-time Traveler and Guide"],
    tags: ["Itineraries", "On-the-ground travel"],
    experiential: true,
  },
  {
    id: "parenting",
    cues: ["parenting", "parent", "newborn", "toddler", "childcare", "baby sleep"],
    roles: ["Certified Pediatric Sleep Consultant", "Parenting Coach and Former NICU Nurse"],
    tags: ["Child development", "Family routines"],
    experiential: true,
  },
];

const EXPERIENTIAL_CUES = [
  "my ", " i ", "how i ", "experience", "journey", "day in the life", "week in", "life of",
  "routine", "schedule", "diary", "lessons", "mistakes", "beginner", "getting started",
  "first year", "final year", "surviving", "survival", "personal", "story", "stories",
  "what i learned", "advice", "tips", "guide", "walkthrough", "step by step", "practical",
  "day-to-day", "day to day", "real talk", "honest",
];

/** True when a topic reads like lived/experiential/practitioner content. */
export function hasExperientialCue(text: string): boolean {
  const hay = ` ${text.toLowerCase()} `;
  return EXPERIENTIAL_CUES.some((cue) => hay.includes(cue));
}

export type PersonaSpec = {
  family: string;
  /** Credentialed role line, e.g. "3rd-Year PhD Candidate in Computational Biology at UC Berkeley". */
  role: string;
  /** Bio lead-in that reads correctly after "X is …" ("a former desk editor…", "a Registered Nurse…"). */
  credential: string;
  /** Extra expertise tags appended after the primary domain. */
  tags: string[];
  /** Lived, practitioner experience → the article is written in the first person. */
  experiential: boolean;
  /** Academic personas pin the real university city so role and bio never contradict each other. */
  affiliation?: { city: string; stateCode: string };
};

function detectAcademicField(hay: string): string {
  for (const field of ACADEMIC_FIELDS) {
    const lower = field.toLowerCase();
    if (hay.includes(lower)) return field;
  }
  return ACADEMIC_FIELDS[hashStr(`field:${hay}`) % ACADEMIC_FIELDS.length]!;
}

/** Analyze topic + niche and return the topic-matched persona (never a generic staff reporter). */
export function personaForTopic(cue: string, niche = ""): PersonaSpec {
  const hay = ` ${`${cue} ${niche}`.toLowerCase()} `;
  const h = hashStr(`persona:${cue.toLowerCase()}:${niche.toLowerCase()}`);
  if (ACADEMIC_CUES.some((keyword) => hay.includes(keyword))) {
    const field = detectAcademicField(hay);
    const [university, city, stateCode] = UNIVERSITIES[h % UNIVERSITIES.length]!;
    const year = PHD_YEARS[(h >> 3) % PHD_YEARS.length]!;
    return {
      family: "academic",
      role: `${year}-Year PhD Candidate in ${field} at ${university}`,
      credential: `a ${year}-year doctoral researcher in ${field}`,
      tags: ["Graduate research", "Dissertation and academic writing"],
      experiential: true,
      affiliation: { city, stateCode },
    };
  }
  for (const family of PERSONA_FAMILIES) {
    if (family.cues.some((keyword) => hay.includes(keyword))) {
      const role = family.roles[h % family.roles.length]!;
      return {
        family: family.id,
        role,
        credential: `a ${role}`,
        tags: family.tags,
        experiential: family.experiential,
      };
    }
  }
  const stem = topicStem(cue || niche || "general research");
  const domain = label(stem);
  return {
    family: "practitioner",
    role: `${domain} Practitioner`,
    credential: `a hands-on ${domain.toLowerCase()} practitioner`,
    tags: [domain, "Real-world practice"],
    experiential: hasExperientialCue(hay),
  };
}

/** Deterministic, distinct humanized voice baked from the author seed. */
export function voiceFor(siteId: string, stem: string, pov?: AuthorVoice["pov"]): AuthorVoice {
  const h = hashStr(`voice:${siteId}:${stem}`);
  const moves = [MOVES[h % MOVES.length], MOVES[(h >> 3) % MOVES.length], MOVES[(h >> 6) % MOVES.length]]
    .filter((move, index, list) => list.indexOf(move) === index);
  return {
    rhythm: RHYTHMS[h % RHYTHMS.length]!,
    diction: DICTIONS[(h >> 2) % DICTIONS.length]!,
    sentenceLengthBand: `${8 + (h % 5)}–${14 + ((h >> 4) % 8)} words`,
    pov: pov ?? ((h >> 5) % 5 === 0 ? "second-person" : (h >> 5) % 11 === 0 ? "first-person" : "third-person"),
    tone: ["direct, specific, unsentimental", "practical and dry-humored", "warm but factual", "clinical to friendly", "plain-spoken authority"][(h >> 7) % 5]!,
    readingLevel: (h >> 9) % 6 === 0 ? "grade-7" : (h >> 9) % 7 === 0 ? "expert" : "general",
    signatureMoves: moves.length ? moves : [MOVES[0]!],
    bannedPhrases: [BANNED[h % BANNED.length]!, BANNED[(h >> 4) % BANNED.length]!, BANNED[(h >> 8) % BANNED.length]!].filter(
      (phrase, index, list) => list.indexOf(phrase) === index,
    ),
  };
}

/**
 * External avatar URL string only. Each author gets a unique token so a fresh,
 * distinct portrait resolves per person. Nothing is ever fetched or written to
 * disk — the static build stores this short string, not an image file. The URL
 * points straight at thispersondoesnotexist.com, which renders a brand-new face
 * on every request, so the byline portrait keeps changing over time.
 */
export function avatarUrlFor(seed: string): string {
  const token = hashStr(`avatar:${seed}`).toString(36) + hashStr(`avatar2:${seed}`).toString(36);
  return avatarSourceUrl(token.slice(0, 20));
}

export function generateAuthorForTopic(topic: string, siteId: string, options: { niche?: string } = {}): AuthorProfile {
  const stem = topicStem(topic);
  const h = hashStr(`${siteId}:${stem}`);
  const first = FIRST[h % FIRST.length]!;
  const last = LAST[Math.floor(h / 7) % LAST.length]!;
  const persona = personaForTopic(topic, options.niche);
  let city: string;
  let stateCode: string;
  if (persona.affiliation) {
    city = persona.affiliation.city;
    stateCode = persona.affiliation.stateCode;
  } else {
    [city, stateCode] = STATES[Math.floor(h / 13) % STATES.length]!;
  }
  const name = `${first} ${last}`;
  const expertise = expertiseForTopic(topic, stem, persona.tags);
  const bio = `${name} is ${persona.credential} based in ${city}, ${STATE_NAMES[stateCode] ?? stateCode}. ${label(stem)} is the beat: every piece answers one real decision, keeps the sourcing honest, and stays inside ${expertise[0]!.toLowerCase()}.`;
  // Experiential/practitioner topics are written in the first person from lived experience.
  const pov: AuthorVoice["pov"] | undefined = persona.experiential || hasExperientialCue(`${topic} ${options.niche ?? ""}`) ? "first-person" : undefined;
  return {
    id: uid("author"),
    siteId,
    name,
    role: persona.role,
    shortBio: bio,
    city,
    region: STATE_NAMES[stateCode] ?? stateCode,
    country: "US",
    expertise,
    topic: stem,
    slug: slugify(`${first}-${last}-${stem}`),
    avatarUrl: avatarUrlFor(`${siteId}:${stem}:${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`),
    voice: voiceFor(siteId, stem, pov),
    articleCount: 0,
    maxArticles: DEFAULT_AUTHOR_CAP,
    status: "active",
    ghostAuthorId: null,
    ghostSlug: null,
    createdAt: Date.now(),
    origin: "auto",
  };
}

export function authorIsEligible(author: AuthorProfile): boolean {
  return author.status === "active" && author.articleCount < author.maxArticles;
}

/** Score how well an author's expertise covers the topic's tokens. Higher wins. Caches per author. */
const EXPERTISE_SET_CACHE = new WeakMap<AuthorProfile, Set<string>>();

export function expertiseScore(author: AuthorProfile, topic: string): number {
  let tokens = EXPERTISE_SET_CACHE.get(author);
  if (!tokens) {
    tokens = new Set(author.expertise.flatMap((tag) => expertiseTokens(tag)).concat(expertiseTokens(author.topic)));
    EXPERTISE_SET_CACHE.set(author, tokens);
  }
  const topicTokens = expertiseTokens(topic);
  let score = 0;
  for (const token of topicTokens) if (tokens.has(token)) score += 1;
  if (author.topic === topicTokens[0]) score += 2;
  return score;
}

/** Above this pool size the matcher skips the fuzzy token pass (exact stem only) — keeps 10k-batch intake sub-minute. */
const FUZZY_MATCH_LIMIT = 2000;

export type AuthorMatch = { author: AuthorProfile; created: boolean };

/**
 * Rule 2 matcher. Idempotent per job: pass the job and the assigned author wins
 * every retry. Picks the best-matching, least-loaded active author under the
 * cap; only when none exists does it generate a brand-new US expert.
 * Pure decision + optional mutation of `authors`.
 */
export function matchOrCreateAuthorForTopic(
  site: Pick<Site, "id" | "nicheTag">,
  authors: AuthorProfile[],
  keywordOrTopic: string,
  options: { niche?: string; autoMatch?: boolean; existingAuthorId?: string } = {},
): AuthorMatch {
  const existing = options.existingAuthorId ? authors.find((author) => author.id === options.existingAuthorId) : undefined;
  if (existing) return { author: existing, created: false };

  const cue = String(keywordOrTopic ?? "").trim() || options.niche || site.nicheTag;
  const stem = topicStem(cue);
  const autoMatch = options.autoMatch !== false;
  const fuzzy = autoMatch && authors.length <= FUZZY_MATCH_LIMIT;
  let best: AuthorProfile | null = null;
  let bestScore = 0;
  let bestLoad = 0;
  if (autoMatch) {
    for (const author of authors) {
      if (author.siteId !== site.id || !authorIsEligible(author)) continue;
      let score: number;
      if (author.topic === stem) score = 3;
      else if (author.expertise.includes(stem)) score = 2;
      else {
        if (!fuzzy) continue;
        score = expertiseScore(author, cue) || (author.topic === topicStem(cue) ? 1 : 0);
      }
      if (score <= 0) continue;
      const better = !best || score > bestScore || (score === bestScore && author.articleCount < bestLoad);
      if (better) {
        best = author;
        bestScore = score;
        bestLoad = author.articleCount;
      }
    }
  }
  if (best) return { author: best, created: false };
  const author = generateAuthorForTopic(cue || site.nicheTag, site.id, { niche: options.niche ?? site.nicheTag });
  authors.push(author);
  return { author, created: true };
}

/**
 * Rule 2 counter: increments once per article (guarded by article.authorCounted)
 * and retires the author at the 250 cap so the niche rotates to a fresh expert.
 */
export function markAuthorPublished(
  data: Pick<Persisted, "authors" | "activity" | "articles">,
  article: { authorId?: string; authorCounted?: boolean; title?: string },
  now: number,
): boolean {
  if (!article.authorId || article.authorCounted) return false;
  const author = data.authors.find((item) => item.id === article.authorId);
  if (!author) return false;
  article.authorCounted = true;
  author.articleCount += 1;
  if (author.articleCount >= author.maxArticles) {
    author.status = "retired";
    data.activity.unshift({
      id: uid("act"),
      at: now,
      siteId: author.siteId,
      tone: "warn",
      message: `${author.name} retired at the ${author.maxArticles}-article cap. The next ${author.topic} piece spawns a fresh US expert.`,
    });
  }
  return true;
}

/** Persist-v8 migration: upgrade an old-shape stored author without losing data. */
export function normalizeAuthorProfile(raw: AuthorProfile | Partial<AuthorProfile>, articleCounts?: Map<string, number>): AuthorProfile {
  const legacy = raw as AuthorProfile & { bio?: string };
  const topic = raw.topic ?? topicStem(raw.expertise?.[0] ?? "general research");
  const persona = personaForTopic(topic);
  // Legacy rows (and the old deterministic seed) shipped a generic "Staff writer"
  // byline; replace it with the topic-matched persona role instead of preserving it.
  const genericRole = !raw.role || /^staff\s+(writer|reporter)/i.test(raw.role);
  const base: AuthorProfile = {
    id: raw.id ?? uid("author"),
    siteId: raw.siteId ?? "",
    name: raw.name ?? "Unassigned Writer",
    role: genericRole ? persona.role : raw.role!,
    shortBio: legacy.shortBio ?? legacy.bio ?? "",
    city: raw.city ?? "Austin",
    region: raw.region ?? "TX",
    country: "US",
    expertise: Array.isArray(raw.expertise) && raw.expertise.length ? raw.expertise : [label(topic)],
    topic,
    slug: raw.slug ?? slugify(raw.name ?? "author"),
    // Migrate every app-managed portrait (the retired resize-CDN form included)
    // to the current direct thispersondoesnotexist.com URL; keep third-party URLs.
    avatarUrl: raw.avatarUrl && !isOurAvatarUrl(raw.avatarUrl) ? raw.avatarUrl : avatarUrlFor(raw.id ?? raw.name ?? uid("author")),
    voice: raw.voice ?? voiceFor(raw.siteId ?? "studio", topic, persona.experiential ? "first-person" : undefined),
    articleCount: raw.articleCount ?? articleCounts?.get(raw.id ?? "") ?? 0,
    maxArticles: raw.maxArticles ?? DEFAULT_AUTHOR_CAP,
    status: raw.status === "retired" || raw.articleCount != null && raw.articleCount >= (raw.maxArticles ?? DEFAULT_AUTHOR_CAP) ? "retired" : "active",
    ghostAuthorId: raw.ghostAuthorId ?? null,
    ghostSlug: raw.ghostSlug ?? null,
    createdAt: raw.createdAt ?? Date.now(),
    origin: raw.origin ?? "auto",
  };
  return base;
}

/** Prompt-facing voice block injected into stages 1–3 so drafts adopt the persona. */
export function authorVoiceBlock(author: AuthorProfile): string {
  const voice = author.voice;
  const povLine =
    voice.pov === "first-person"
      ? `Point of view: FIRST PERSON. Write as ${author.name} — a real practitioner sharing specific, lived experience in "I" / "my experience", never a detached staff-reporter voice.`
      : `Point of view: ${voice.pov}.`;
  return [
    `Author: ${author.name} (${author.role}) based in ${author.city}, ${author.region}, US.`,
    `Expertise: ${(author.expertise ?? []).join("; ")}.`,
    `Bio: ${author.shortBio}`,
    `Voice: ${voice.tone}; ${voice.rhythm}; ${voice.diction}; average sentences ${voice.sentenceLengthBand}; reading level ${voice.readingLevel}.`,
    povLine,
    `Signature moves: ${(voice.signatureMoves ?? []).join("; ")}.`,
    `Never write these robotic AI phrases anywhere: ${(voice.bannedPhrases ?? []).concat(["delve", "tapestry", "in today's fast-paced world"]).join(" | ")}.`,
  ].join("\n");
}

/** Dry-run helper for the Authors UI simulator: does this niche already have an under-cap expert? */
export function previewAuthorMatch(
  siteId: string,
  authors: AuthorProfile[],
  topic: string,
): { matched: AuthorProfile | null; wouldGenerate: boolean; stem: string } {
  const stem = topicStem(topic);
  const pool = authors.filter((author) => author.siteId === siteId && authorIsEligible(author));
  let best: AuthorProfile | null = null;
  let bestScore = 0;
  for (const author of pool) {
    const score = expertiseScore(author, topic) || (author.topic === stem ? 1 : 0);
    if (score > bestScore) {
      best = author;
      bestScore = score;
    }
  }
  return { matched: bestScore > 0 ? best : null, wouldGenerate: bestScore === 0, stem };
}

/** Legacy alias kept for the seed/migration call sites. */
export function attachAuthor(data: Pick<Persisted, "authors">, siteId: string, topic: string): AuthorProfile {
  const stem = topicStem(topic);
  const existing = data.authors.find((author) => author.siteId === siteId && author.topic === stem);
  if (existing) return existing;
  const profile = generateAuthorForTopic(topic, siteId);
  data.authors.push(profile);
  return profile;
}
