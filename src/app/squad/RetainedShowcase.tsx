import SpartansStars from "@/app/SpartansStars";
import SquadPurse from "./SquadPurse";
import { RETAINED, SQUAD_RULES, type RetainedPlayer } from "./retained";

const GOLD = "#E3A81B";
const GOLD_HI = "#F6CB49";
// warm Spartans accent — orange→red, replacing the app's blue on this page
const WARM = "linear-gradient(135deg, #FF8A3D 0%, #E0453A 100%)";
const WARM_INK = "#D2451F";

const fmt = (n: number | null | undefined) =>
  n == null ? "—" : n.toLocaleString("en-IN");
const dec = (n: number | null | undefined) =>
  n == null ? "—" : n.toFixed(n >= 100 ? 0 : 1);

function initials(name: string) {
  return name
    .split(/\s+/)
    .slice(0, 2)
    .map((w) => w[0])
    .join("")
    .toUpperCase();
}

const TIER_STYLE: Record<RetainedPlayer["tier"], { label: string; bg: string; fg: string }> = {
  A: { label: "Category A", bg: "color-mix(in srgb, #E0453A 15%, transparent)", fg: "#C2371D" },
  B: { label: "Category B", bg: "var(--wash)", fg: "var(--muted)" },
  Legend: { label: "Legend", bg: "color-mix(in srgb, #E3A81B 18%, transparent)", fg: "#B4820F" },
};

/* ---------- little infographic pieces ---------- */

function Pips({ filled, total, color }: { filled: number; total: number; color: string }) {
  return (
    <div className="mt-3 flex flex-wrap gap-1.5">
      {Array.from({ length: total }).map((_, i) => (
        <span
          key={i}
          className="h-2.5 flex-1 rounded-full"
          style={{
            minWidth: 8,
            background: i < filled ? color : "var(--wash)",
            boxShadow: i < filled ? "none" : "inset 0 0 0 1px var(--border)",
          }}
        />
      ))}
    </div>
  );
}

function StatTile({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="rounded-[12px] bg-wash px-2.5 py-2 text-center">
      <p className="font-display text-[1.05rem] font-bold leading-none tabular-nums">{value}</p>
      <p className="mt-1 text-[0.62rem] font-medium uppercase tracking-wide text-muted">{label}</p>
      {sub ? <p className="mt-0.5 text-[0.6rem] text-muted">{sub}</p> : null}
    </div>
  );
}

/* ---------- player card ---------- */

function PlayerCard({ p }: { p: RetainedPlayer }) {
  const tier = TIER_STYLE[p.tier];
  const tiles = p.isKeeper
    ? [
        { label: "Matches", value: fmt(p.bat.matches) },
        { label: "Runs", value: fmt(p.bat.runs) },
        { label: "Stumpings", value: fmt(p.field.stumpings) },
        { label: "Catches", value: fmt(p.field.catches) },
      ]
    : [
        { label: "Runs", value: fmt(p.bat.runs) },
        { label: "Bat avg", value: dec(p.bat.avg) },
        { label: "Strike rate", value: dec(p.bat.sr) },
        { label: "Wickets", value: fmt(p.bowl.wickets) },
      ];

  return (
    <div className="card flex flex-col gap-3.5">
      <div className="flex items-center gap-3">
        <div className="relative h-14 w-14 shrink-0">
          {p.photo ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={p.photo}
              alt={p.name}
              className="h-14 w-14 rounded-full object-cover"
              style={{ boxShadow: `0 0 0 2px ${GOLD}` }}
            />
          ) : (
            <div
              className="flex h-14 w-14 items-center justify-center rounded-full font-display text-lg font-bold text-white"
              style={{ background: `linear-gradient(145deg, ${GOLD_HI}, ${GOLD})` }}
            >
              {initials(p.name)}
            </div>
          )}
          {p.isCaptain ? (
            <span
              className="absolute -bottom-1 -right-1 flex h-6 w-6 items-center justify-center rounded-full border-2 font-display text-[0.7rem] font-bold text-white"
              style={{ background: GOLD, borderColor: "var(--surface)" }}
              title="Captain"
            >
              C
            </span>
          ) : null}
        </div>

        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5">
            <h3 className="truncate font-display text-[1.05rem] font-semibold leading-tight">{p.name}</h3>
            {p.isKeeper ? (
              <span className="badge shrink-0" style={{ background: "var(--wash)", color: "var(--muted)" }}>
                WK
              </span>
            ) : null}
          </div>
          <p className="mt-0.5 truncate text-[0.8rem] text-muted">{p.tagline}</p>
          <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
            <span className="badge" style={{ background: tier.bg, color: tier.fg }}>
              {tier.label}
            </span>
            {p.secondTier ? (
              <span
                className="badge"
                style={{ background: TIER_STYLE[p.secondTier].bg, color: TIER_STYLE[p.secondTier].fg }}
              >
                {TIER_STYLE[p.secondTier].label}
              </span>
            ) : null}
            <span className="badge" style={{ background: "var(--wash)", color: "var(--muted)" }}>
              {p.order}
            </span>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-4 gap-1.5">
        {tiles.map((t) => (
          <StatTile key={t.label} label={t.label} value={t.value} />
        ))}
      </div>

      <div className="flex items-center justify-between text-[0.72rem] text-muted">
        <span>
          {fmt(p.bat.fifties)} fifties · {fmt(p.bat.hundreds)} tons
        </span>
        {p.cricheroes ? (
          <a
            href={p.cricheroes}
            target="_blank"
            rel="noopener noreferrer"
            className="font-medium hover:underline"
            style={{ color: WARM_INK }}
          >
            CricHeroes ↗
          </a>
        ) : null}
      </div>
    </div>
  );
}

/* ---------- main ---------- */

export default function RetainedShowcase() {
  const aUsed = RETAINED.filter((p) => p.tier === "A").length;
  const aNames = RETAINED.filter((p) => p.tier === "A").map((p) => p.name).join(", ");
  const retainedCount = RETAINED.length;
  const allrounders = RETAINED.filter((p) => !p.isKeeper && p.bowl.wickets >= 100).length;

  return (
    <section className="mt-2">
      <div className="flex flex-wrap items-center gap-2">
        <p className="eyebrow" style={{ color: WARM_INK }}>
          Season 6 · Retained core
        </p>
        <SpartansStars />
      </div>
      <h1 className="mt-1 font-display text-[1.9rem] font-bold leading-tight">
        {retainedCount} locked in, building to {SQUAD_RULES.minSquad}
      </h1>
      <p className="mt-1 max-w-2xl text-[0.95rem] text-muted">
        The Gurugram Spartans&rsquo; pre-auction core. {aUsed} of {SQUAD_RULES.maxCategoryA} Category-A
        slots already spent ({aNames}) — the rest gets built at the season-6 auction.
      </p>

      {/* infographic tiles */}
      <div className="mt-5 grid gap-3 sm:grid-cols-3">
        <div className="card">
          <div className="flex items-baseline justify-between">
            <p className="eyebrow">Squad built</p>
            <p className="font-display text-sm font-semibold text-muted">
              <span className="text-foreground">{retainedCount}</span> / {SQUAD_RULES.minSquad}
            </p>
          </div>
          <Pips filled={retainedCount} total={SQUAD_RULES.minSquad} color={GOLD} />
          <p className="mt-2 text-[0.72rem] text-muted">
            {SQUAD_RULES.minSquad - retainedCount} slots to fill (minimum squad).
          </p>
        </div>

        <div className="card">
          <div className="flex items-baseline justify-between">
            <p className="eyebrow">Category-A budget</p>
            <p className="font-display text-sm font-semibold text-muted">
              <span className="text-foreground">{aUsed}</span> / {SQUAD_RULES.maxCategoryA}
            </p>
          </div>
          <Pips filled={aUsed} total={SQUAD_RULES.maxCategoryA} color={WARM} />
          <p className="mt-2 text-[0.72rem] text-muted">
            {SQUAD_RULES.maxCategoryA - aUsed} A-category signings still available.
          </p>
        </div>

        <div className="card">
          <p className="eyebrow">Core balance</p>
          <div className="mt-3 flex items-end gap-4">
            <div>
              <p className="font-display text-2xl font-bold leading-none">{allrounders}</p>
              <p className="mt-1 text-[0.68rem] uppercase tracking-wide text-muted">All-rounders</p>
            </div>
            <div>
              <p className="font-display text-2xl font-bold leading-none">1</p>
              <p className="mt-1 text-[0.68rem] uppercase tracking-wide text-muted">Keeper</p>
            </div>
            <div>
              <p className="font-display text-2xl font-bold leading-none">1</p>
              <p className="mt-1 text-[0.68rem] uppercase tracking-wide text-muted">Captain</p>
            </div>
          </div>
          <p className="mt-2 text-[0.72rem] text-muted">Deep batting, all-round depth.</p>
        </div>
      </div>

      {/* combined: probable batting order + editable purse / retention */}
      <div className="mt-3">
        <SquadPurse
          players={RETAINED.map((p) => ({
            id: p.id,
            name: p.name,
            cost: p.cost,
            order: p.slot,
            role: p.role,
            isCaptain: p.isCaptain,
            isKeeper: p.isKeeper,
          }))}
          defaultBudget={SQUAD_RULES.budget}
          maxSquad={SQUAD_RULES.maxSquad}
          retainedCount={RETAINED.length}
        />
      </div>

      <div className="mt-6 grid gap-3 md:grid-cols-2">
        {RETAINED.map((p) => (
          <PlayerCard key={p.id} p={p} />
        ))}
      </div>
    </section>
  );
}
