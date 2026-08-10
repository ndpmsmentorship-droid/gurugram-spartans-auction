import Link from "next/link";
import { tierStyle } from "@/lib/scout/tier";
import { roleGroup } from "@/lib/scout/analytics";
import SpartansStars from "@/app/SpartansStars";

export type SquadCard = {
  id: string;
  full_name: string;
  auction_category: string | null;
  primary_role: string | null;
  is_keeper: boolean | null;
  acquired: string | null;
  sold_price: number | null;
  photo_url: string | null;
  overall_index: number | null;
};

const inr = (n: number) => "₹" + Math.round(n || 0).toLocaleString("en-IN");
const inrK = (n: number) => "₹" + Math.round((n || 0) / 1000) + "K";

const ROLE_COLORS: Record<string, string> = {
  Batter: "#E3A81B",
  "All-rounder": "#57ac7e",
  Bowler: "#4a6bb5",
  Keeper: "#9AA0A6",
  Other: "#c9ced3",
};

function catBadge(cat: string | null): { bg: string; fg: string; label: string } | null {
  if (!cat) return null;
  if (/legend/i.test(cat)) return { bg: "color-mix(in srgb, #E3A81B 20%, transparent)", fg: "#B4820F", label: cat };
  const ts = tierStyle(cat);
  return ts ? { bg: ts.bg, fg: ts.fg, label: cat } : { bg: "var(--wash)", fg: "var(--muted)", label: cat };
}

const acqTag = (a: string | null) =>
  a === "owner"
    ? { label: "Owner", cls: "bg-[color-mix(in_srgb,var(--accent)_16%,transparent)] text-accent-text" }
    : a === "retained"
      ? { label: "Retained", cls: "bg-[color-mix(in_srgb,#E3A81B_18%,transparent)] text-highlight-ink" }
      : { label: "Auction", cls: "bg-wash text-muted" };

export default function SquadDisplay({
  team,
  squad,
  jerseyByPlayer = {},
  rankByPlayer = {},
}: {
  team: { name: string; purse_total: number } | null;
  squad: SquadCard[];
  jerseyByPlayer?: Record<string, string | number | null>;
  rankByPlayer?: Record<string, number>;
}) {
  const jersey = (id: string) => {
    const v = jerseyByPlayer[id];
    return v === null || v === undefined || v === "" ? null : String(v);
  };
  const roleOf = (p: SquadCard) => (p.is_keeper ? "Keeper" : roleGroup(p.primary_role, !!p.is_keeper));

  const sorted = [...squad].sort((a, b) => {
    const ja = jersey(a.id);
    const jb = jersey(b.id);
    if (ja && jb) return Number(ja) - Number(jb);
    if (ja) return -1;
    if (jb) return 1;
    return (Number(b.sold_price) || 0) - (Number(a.sold_price) || 0);
  });

  const spent = squad.reduce((s, p) => s + (Number(p.sold_price) || 0), 0);
  const budget = team?.purse_total ?? 400000;
  const remaining = budget - spent;

  const cc = (c: string | null) => (c ?? "").toUpperCase().replace(/\s+/g, "");
  const aCount = squad.filter((p) => /A$/.test(cc(p.auction_category))).length;
  const u35Count = squad.filter((p) => cc(p.auction_category).startsWith("U35")).length;
  const legendCount = squad.filter((p) => /LEGEND/.test(cc(p.auction_category))).length;

  // role composition
  const roleOrder = ["Batter", "All-rounder", "Bowler", "Keeper"];
  const roleCounts = roleOrder.map((r) => ({ role: r, n: squad.filter((p) => roleOf(p) === r).length }));

  return (
    <main className="mx-auto w-full max-w-4xl flex-1 px-4 py-8 sm:px-6">
      <header className="border-b border-border pb-6">
        <p className="eyebrow">SARDA Corporate Cricket League · Season 6</p>
        <h1 className="mt-1 flex flex-wrap items-center gap-2 font-display text-3xl font-bold tracking-tight sm:text-4xl">
          The {team?.name ?? "Gurugram Spartans"} <SpartansStars />
        </h1>
        <p className="mt-1 text-sm text-muted tabular-nums">
          {squad.length} players · {inr(spent)} spent · {inr(remaining)} of {inr(budget)} left
        </p>

        {/* gauges */}
        <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
          <Ring value={aCount} total={8} center={`${aCount}`} label="Category A" sub="max 8 · 6 in XI" color="#E0453A" />
          <Ring value={u35Count} total={5} center={`${u35Count}`} label="Under-35" sub="max 5 · 3 in XI" color="#4a6bb5" />
          <Ring value={legendCount} total={Math.max(1, legendCount)} center={`${legendCount}`} label="Legends" sub="min 1 in XI" color="#E3A81B" />
          <Ring value={spent} total={budget} center={`${Math.round((spent / budget) * 100)}%`} label="Purse used" sub={`${inrK(spent)} / ${inrK(budget)}`} color="#57ac7e" />
        </div>

        {/* role composition */}
        <div className="mt-4">
          <div className="flex h-3 overflow-hidden rounded-full">
            {roleCounts.map((r) =>
              r.n > 0 ? (
                <div
                  key={r.role}
                  style={{ width: `${(r.n / squad.length) * 100}%`, background: ROLE_COLORS[r.role] }}
                  title={`${r.role}: ${r.n}`}
                />
              ) : null,
            )}
          </div>
          <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted">
            {roleCounts.map((r) => (
              <span key={r.role} className="inline-flex items-center gap-1.5">
                <span className="h-2.5 w-2.5 rounded-full" style={{ background: ROLE_COLORS[r.role] }} />
                {r.role} <b className="text-foreground">{r.n}</b>
              </span>
            ))}
          </div>
        </div>
      </header>

      {/* squad table */}
      <div className="mt-5 overflow-x-auto rounded-2xl border border-border">
        <table className="w-full min-w-[640px] text-sm">
          <thead className="bg-wash text-left text-muted">
            <tr>
              <th className="w-14 px-3 py-3 text-center font-medium">#</th>
              <th className="px-3 py-3 font-medium">Player</th>
              <th className="px-3 py-3 font-medium">Category</th>
              <th className="px-3 py-3 font-medium">Role</th>
              <th className="px-3 py-3 text-right font-medium">Pool rank</th>
              <th className="px-3 py-3 text-right font-medium">Price</th>
            </tr>
          </thead>
          <tbody>
            {sorted.map((p) => {
              const cb = catBadge(p.auction_category);
              const jn = jersey(p.id);
              const tag = acqTag(p.acquired);
              const rank = rankByPlayer[p.id];
              return (
                <tr key={p.id} className="border-t border-border hover:bg-wash/40">
                  <td className="px-3 py-2.5 text-center font-display text-lg font-bold tabular-nums text-accent-text">
                    {jn ?? "—"}
                  </td>
                  <td className="px-3 py-2.5">
                    <Link href={`/scout/${p.id}`} className="font-medium hover:text-accent-text">
                      {p.full_name}
                    </Link>
                    <span className={`ml-2 rounded-full px-1.5 py-0.5 text-[10px] font-semibold uppercase ${tag.cls}`}>
                      {tag.label}
                    </span>
                  </td>
                  <td className="px-3 py-2.5">
                    {cb ? (
                      <span
                        className="rounded-full px-2 py-0.5 text-[11px] font-bold uppercase tracking-wide"
                        style={{ background: cb.bg, color: cb.fg }}
                      >
                        {cb.label}
                      </span>
                    ) : (
                      "—"
                    )}
                  </td>
                  <td className="px-3 py-2.5 text-muted">{roleOf(p)}</td>
                  <td className="px-3 py-2.5 text-right font-semibold tabular-nums">
                    {rank ? `#${rank}` : "—"}
                  </td>
                  <td className="px-3 py-2.5 text-right tabular-nums">{inr(Number(p.sold_price) || 0)}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {squad.length === 0 && <p className="mt-10 text-center text-muted">No players in the squad yet.</p>}
    </main>
  );
}

// SVG ring gauge
function Ring({
  value,
  total,
  center,
  label,
  sub,
  color,
}: {
  value: number;
  total: number;
  center: string;
  label: string;
  sub: string;
  color: string;
}) {
  const r = 30;
  const c = 2 * Math.PI * r;
  const pct = total > 0 ? Math.min(1, value / total) : 0;
  return (
    <div className="flex flex-col items-center rounded-xl border border-border bg-surface p-3">
      <svg width="76" height="76" viewBox="0 0 76 76">
        <circle cx="38" cy="38" r={r} fill="none" stroke="var(--wash)" strokeWidth="7" />
        <circle
          cx="38"
          cy="38"
          r={r}
          fill="none"
          stroke={color}
          strokeWidth="7"
          strokeLinecap="round"
          strokeDasharray={c}
          strokeDashoffset={c * (1 - pct)}
          transform="rotate(-90 38 38)"
        />
        <text x="38" y="39" textAnchor="middle" dominantBaseline="central" fontSize="18" fontWeight="700" fill="var(--foreground)">
          {center}
        </text>
      </svg>
      <p className="mt-1.5 text-xs font-semibold">{label}</p>
      <p className="text-[0.62rem] text-muted">{sub}</p>
    </div>
  );
}
