/**
 * Bucketing for the dashboard charts.
 *
 * Pure and clock-injected so it can be tested without a store or a browser. The
 * rule that matters: an event is counted in the bucket that contains it, and
 * anything outside the chosen window is *not* silently pulled into the edge
 * bucket — a 1D chart must not show last week's posts in its first column.
 */

export type Timeframe = "1D" | "1W" | "1M" | "ALL";

export type VelocityEvent = {
  at: number;
  /** `published` = article went live, `generated` = a job was produced. */
  kind: "published" | "generated";
  /** Optional magnitude (tokens, words). Defaults to 1. */
  amount?: number;
};

export type Bucket = {
  label: string;
  start: number;
  published: number;
  generated: number;
  tokens: number;
  words: number;
};

const HOUR = 3_600_000;
const DAY = 86_400_000;

/** Bucket width per timeframe: hourly for 1D, daily for 1W/1M, weekly for ALL. */
function width(timeframe: Timeframe): number {
  if (timeframe === "1D") return HOUR;
  if (timeframe === "ALL") return 7 * DAY;
  return DAY;
}

function bucketCount(timeframe: Timeframe, earliest: number, now: number): number {
  if (timeframe === "1D") return 24;
  if (timeframe === "1W") return 7;
  if (timeframe === "1M") return 30;
  // ALL: as many weeks as the data needs, kept between 4 and 26 so the axis
  // stays readable rather than growing a column per week forever.
  const weeks = Math.ceil((now - earliest) / (7 * DAY)) + 1;
  return Math.min(26, Math.max(4, weeks));
}

function label(start: number, timeframe: Timeframe): string {
  const date = new Date(start);
  if (timeframe === "1D") return `${String(date.getUTCHours()).padStart(2, "0")}:00`;
  const month = String(date.getUTCMonth() + 1).padStart(2, "0");
  const day = String(date.getUTCDate()).padStart(2, "0");
  return `${month}-${day}`;
}

/**
 * Bucket `events` into the window ending at `now`.
 *
 * Buckets are aligned to the window end (not to the epoch), so the last bucket
 * always contains `now` and the chart's right edge is "today".
 */
export function bucketEvents(events: VelocityEvent[], now: number, timeframe: Timeframe): Bucket[] {
  const size = width(timeframe);
  const earliest = events.length ? Math.min(...events.map((event) => event.at)) : now;
  const count = bucketCount(timeframe, earliest, now);
  const start = now - count * size;

  const buckets: Bucket[] = Array.from({ length: count }, (_, index) => {
    const from = start + index * size;
    return { label: label(from, timeframe), start: from, published: 0, generated: 0, tokens: 0, words: 0 };
  });

  for (const event of events) {
    if (event.at < start || event.at > now) continue;
    const index = Math.min(count - 1, Math.floor((event.at - start) / size));
    const bucket = buckets[index]!;
    if (event.kind === "published") bucket.published += 1;
    else bucket.generated += 1;
    if (event.kind === "published" && event.amount) bucket.words += event.amount;
    if (event.amount && event.kind === "generated") bucket.tokens += event.amount;
  }
  return buckets;
}

/**
 * Percentage change between the last 7 days and the 7 before it, as the brief's
 * hero delta. Returns null when there is no baseline — "+100%" against zero is
 * a claim we cannot make.
 */
export function weekOverWeek(publishedAt: number[], now: number): { deltaPct: number | null; thisWeek: number; lastWeek: number } {
  const week = 7 * DAY;
  const thisWeek = publishedAt.filter((at) => at > now - week && at <= now).length;
  const lastWeek = publishedAt.filter((at) => at > now - 2 * week && at <= now - week).length;
  if (lastWeek === 0) return { deltaPct: thisWeek === 0 ? 0 : null, thisWeek, lastWeek };
  return { deltaPct: Math.round(((thisWeek - lastWeek) / lastWeek) * 100), thisWeek, lastWeek };
}
