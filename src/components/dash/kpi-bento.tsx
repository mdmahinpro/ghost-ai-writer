export type BentoCard = {
  label: string;
  value: string;
  hint: string;
  accent: string;
  delta?: { text: string; positive: boolean };
};

export const BENTO_CORAL = "var(--color-brass)";
export const BENTO_BUTTER = "var(--color-warn)";
export const BENTO_PINK = "var(--color-brass-2)";
export const BENTO_SKY = "var(--color-faint)";

export function KpiBento({ cards }: { cards: BentoCard[] }) {
  return (
    <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
      {cards.map((card) => (
        <section
          key={card.label}
          data-surface="card"
          className="flex min-w-0 flex-col justify-between rounded-xl border border-line bg-elev p-4 sm:p-5"
        >
          <div className="eyebrow">{card.label}</div>
          <div className="mt-3 flex flex-wrap items-baseline gap-x-2 gap-y-1 sm:mt-4">
            <span className="font-display text-[30px] font-semibold leading-none tracking-[-0.02em] tabular-nums text-fg sm:text-[34px]">
              {card.value}
            </span>
            {card.delta ? (
              <span
                className={
                  card.delta.positive
                    ? "num text-[12px] font-medium text-ok"
                    : "num text-[12px] font-medium text-danger"
                }
              >
                {card.delta.text}
              </span>
            ) : null}
          </div>
          <div className="mt-3 border-t border-line pt-2.5 text-[12px] leading-5 text-muted sm:mt-4">{card.hint}</div>
        </section>
      ))}
    </div>
  );
}
