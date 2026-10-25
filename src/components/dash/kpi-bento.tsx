/**
 * The four bento KPIs at the top of the desk.
 *
 * Each card carries one accent from the Mobbin references (coral = queued,
 * butter = drafting, pink = shipped, sky = health). The accent is applied with
 * `color-mix` against the theme's own surface token rather than a hardcoded
 * pastel, so the same card reads as a warm tint on Editorial and as a subtly
 * bordered tile on Telemetry — one implementation, correct in all eight themes,
 * no per-theme branching.
 */

export type BentoCard = {
  label: string;
  value: string;
  hint: string;
  /** One of the four reference accents. */
  accent: string;
  /** Optional hero delta, e.g. "+100%". */
  delta?: { text: string; positive: boolean };
};

export const BENTO_CORAL = "#f4b8a4";
export const BENTO_BUTTER = "#f7dc86";
export const BENTO_PINK = "#f5c6d6";
export const BENTO_SKY = "#b6d7f2";

export function KpiBento({ cards }: { cards: BentoCard[] }) {
  return (
    <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
      {cards.map((card) => (
        <section
          key={card.label}
          data-surface="card"
          className="rounded-lg border border-line p-4 sm:p-5"
          style={{ background: `color-mix(in oklab, ${card.accent} 16%, var(--color-surface))` }}
        >
          <div className="text-[10px] font-medium uppercase leading-4 tracking-[0.14em] text-muted sm:text-xs sm:tracking-[0.16em]">
            {card.label}
          </div>
          <div className="mt-2 flex items-baseline gap-2 sm:mt-3">
            <span className="text-2xl font-semibold tracking-tight tabular-nums sm:text-4xl">{card.value}</span>
            {card.delta ? (
              <span
                className="text-sm font-semibold tabular-nums"
                style={{ color: card.delta.positive ? "var(--color-ok)" : "var(--color-danger)" }}
              >
                {card.delta.text}
              </span>
            ) : null}
          </div>
          <div className="mt-1.5 text-xs text-muted sm:mt-2 sm:text-sm">{card.hint}</div>
        </section>
      ))}
    </div>
  );
}
