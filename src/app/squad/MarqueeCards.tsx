import Link from "next/link";
import Avatar from "./Avatar";
import { tierStyle, handSkill } from "@/lib/scout/tier";

const GOLD = "#E3A81B";
const GOLD_INK = "#7a5a06";

export type MarqueePlayer = {
  id: string;
  full_name: string;
  category: string;
  primary_role: string | null;
  auction_category: string | null;
  batting_style: string | null;
  bowling_style: string | null;
  overall_rank: number | null;
  photo_url: string | null;
};

export default function MarqueeCards({ players }: { players: MarqueePlayer[] }) {
  if (players.length === 0) return null;

  return (
    <section className="card">
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
            <Avatar src={p.photo_url} name={p.full_name} size={44} />
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-1.5">
                <p className="truncate font-display text-[0.98rem] font-semibold">{p.full_name}</p>
                {(() => {
                  const ts = tierStyle(p.auction_category);
                  return ts ? (
                    <span
                      className="shrink-0 rounded-full px-1.5 py-0.5 text-[0.6rem] font-bold uppercase leading-none tracking-wide"
                      style={{ background: ts.bg, color: ts.fg }}
                      title="Organizers' auction category"
                    >
                      {p.auction_category}
                    </span>
                  ) : null;
                })()}
              </div>
              <p className="truncate text-[0.75rem] text-muted">
                {p.primary_role ? `${p.primary_role} · ` : ""}
                {p.category}
              </p>
              {handSkill(p.batting_style, p.bowling_style) ? (
                <p className="truncate text-[0.7rem] text-muted/90">
                  {handSkill(p.batting_style, p.bowling_style)}
                </p>
              ) : null}
            </div>
            {p.overall_rank != null ? (
              <div className="shrink-0 text-right" title="Overall rank in the pool (1 = best)">
                <p className="font-display text-sm font-bold leading-none tabular-nums" style={{ color: GOLD_INK }}>
                  #{p.overall_rank}
                </p>
                <p className="mt-0.5 text-[0.55rem] font-medium uppercase tracking-wide text-muted">
                  Rank
                </p>
              </div>
            ) : null}
          </Link>
        ))}
      </div>
    </section>
  );
}
