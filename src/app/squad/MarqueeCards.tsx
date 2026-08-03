import Link from "next/link";

const GOLD = "#E3A81B";
const GOLD_HI = "#F6CB49";
const GOLD_INK = "#7a5a06";

export type MarqueePlayer = {
  id: string;
  full_name: string;
  category: string;
  overall_index: number | null;
  photo_url: string | null;
};

function initials(name: string) {
  return name
    .split(/\s+/)
    .slice(0, 2)
    .map((w) => w[0])
    .join("")
    .toUpperCase();
}

export default function MarqueeCards({ players }: { players: MarqueePlayer[] }) {
  if (players.length === 0) return null;

  return (
    <section className="mt-10 border-t border-border pt-8">
      <div className="flex flex-wrap items-center gap-2">
        <span style={{ color: GOLD }}>★</span>
        <p className="eyebrow" style={{ color: GOLD_INK }}>
          Marquee targets · must buy
        </p>
        <span className="badge" style={{ background: `color-mix(in srgb, ${GOLD} 20%, transparent)`, color: GOLD_INK }}>
          top priority
        </span>
      </div>
      <p className="mt-1 text-[0.9rem] text-muted">
        {players.length} flagged from the pool — chase these first at the auction.
      </p>

      <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {players.map((p) => (
          <Link
            key={p.id}
            href={`/scout/${p.id}`}
            className="flex items-center gap-3 rounded-[14px] p-3 transition-colors"
            style={{
              background: `color-mix(in srgb, ${GOLD} 10%, var(--surface))`,
              boxShadow: `inset 0 0 0 1.5px color-mix(in srgb, ${GOLD} 55%, transparent)`,
            }}
          >
            <div className="relative h-11 w-11 shrink-0">
              {p.photo_url ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={p.photo_url}
                  alt={p.full_name}
                  className="h-11 w-11 rounded-full object-cover"
                  style={{ boxShadow: `0 0 0 2px ${GOLD}` }}
                />
              ) : (
                <div
                  className="flex h-11 w-11 items-center justify-center rounded-full font-display text-sm font-bold text-white"
                  style={{ background: `linear-gradient(145deg, ${GOLD_HI}, ${GOLD})` }}
                >
                  {initials(p.full_name)}
                </div>
              )}
            </div>
            <div className="min-w-0 flex-1">
              <p className="truncate font-display text-[0.98rem] font-semibold">{p.full_name}</p>
              <p className="truncate text-[0.75rem] text-muted">{p.category}</p>
            </div>
            {p.overall_index != null ? (
              <span className="shrink-0 font-display text-sm font-bold tabular-nums" style={{ color: GOLD_INK }}>
                {Math.round(p.overall_index)}
              </span>
            ) : null}
          </Link>
        ))}
      </div>
    </section>
  );
}
