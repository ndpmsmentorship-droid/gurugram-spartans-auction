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

// Category badge — handles Legend (gold), which tierStyle doesn't colour.
function catBadge(cat: string | null): { bg: string; fg: string; label: string } | null {
  if (!cat) return null;
  if (/legend/i.test(cat)) {
    return { bg: "color-mix(in srgb, #E3A81B 20%, transparent)", fg: "#B4820F", label: cat };
  }
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
}: {
  team: { name: string; purse_total: number } | null;
  squad: SquadCard[];
  jerseyByPlayer?: Record<string, string | number | null>;
}) {
  const jersey = (id: string) => {
    const v = jerseyByPlayer[id];
    return v === null || v === undefined || v === "" ? null : String(v);
  };
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
  const aCount = squad.filter((p) => /A$/.test(cc(p.auction_category))).length; // U35A + 35+A
  const u35Count = squad.filter((p) => cc(p.auction_category).startsWith("U35")).length;
  const legendCount = squad.filter((p) => /LEGEND/.test(cc(p.auction_category))).length;

  return (
    <main className="mx-auto w-full max-w-4xl flex-1 px-4 py-8 sm:px-6">
      <header className="border-b border-border pb-6">
        <p className="eyebrow">SARDA Corporate Cricket League · Season 6</p>
        <h1 className="mt-1 flex flex-wrap items-center gap-2 font-display text-3xl font-bold tracking-tight sm:text-4xl">
          The {team?.name ?? "Gurugram Spartans"} <SpartansStars />
        </h1>
        <p className="mt-1 text-muted">Final squad · {squad.length} players</p>

        <div className="mt-4 grid grid-cols-3 gap-3">
          <Stat label="Players" value={String(squad.length)} />
          <Stat label="Spent" value={inr(spent)} />
          <Stat label="Purse left" value={inr(remaining)} tone={remaining < 0 ? "down" : "up"} />
        </div>

        <div className="mt-3 grid gap-3 sm:grid-cols-3">
          <Bar label={`Category A · ${aCount}`} value={aCount} total={squad.length} color="#E0453A" />
          <Bar label={`Under-35 · ${u35Count}`} value={u35Count} total={squad.length} color="#4a6bb5" />
          <Bar label="Spend" value={spent} total={budget} color="#E3A81B" display={`${inr(spent)} / ${inr(budget)}`} />
        </div>
        {legendCount > 0 && (
          <p className="mt-2 text-xs text-muted">
            {legendCount} Legend{legendCount > 1 ? "s" : ""} · A-category {aCount} · Under-35 {u35Count}
          </p>
        )}
      </header>

      <div className="mt-5 overflow-x-auto rounded-2xl border border-border">
        <table className="w-full min-w-[640px] text-sm">
          <thead className="bg-wash text-left text-muted">
            <tr>
              <th className="w-14 px-3 py-3 text-center font-medium">#</th>
              <th className="px-3 py-3 font-medium">Player</th>
              <th className="px-3 py-3 font-medium">Category</th>
              <th className="px-3 py-3 font-medium">Role</th>
              <th className="px-3 py-3 text-right font-medium">Overall</th>
              <th className="px-3 py-3 text-right font-medium">Price</th>
            </tr>
          </thead>
          <tbody>
            {sorted.map((p) => {
              const cb = catBadge(p.auction_category);
              const jn = jersey(p.id);
              const tag = acqTag(p.acquired);
              const role = p.is_keeper ? "Keeper" : roleGroup(p.primary_role, !!p.is_keeper);
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
                  <td className="px-3 py-2.5 text-muted">{role}</td>
                  <td className="px-3 py-2.5 text-right font-semibold tabular-nums">
                    {p.overall_index == null ? "—" : Math.round(p.overall_index)}
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

function Bar({
  label,
  value,
  total,
  color,
  display,
}: {
  label: string;
  value: number;
  total: number;
  color: string;
  display?: string;
}) {
  const pct = total > 0 ? Math.min(100, (value / total) * 100) : 0;
  return (
    <div className="rounded-xl border border-border bg-surface p-3">
      <div className="flex items-baseline justify-between gap-2">
        <span className="text-[0.7rem] font-medium uppercase tracking-wide text-muted">{label}</span>
        <span className="font-display text-xs font-bold tabular-nums">{display ?? `${value}/${total}`}</span>
      </div>
      <div className="mt-2 h-2 overflow-hidden rounded-full bg-wash">
        <div className="h-full rounded-full" style={{ width: `${pct}%`, background: color }} />
      </div>
    </div>
  );
}

function Stat({ label, value, tone }: { label: string; value: string; tone?: "down" | "up" }) {
  return (
    <div className="rounded-xl bg-wash px-4 py-2">
      <p
        className={`font-display text-lg font-bold tabular-nums ${
          tone === "down" ? "text-down" : tone === "up" ? "text-up" : ""
        }`}
      >
        {value}
      </p>
      <p className="text-[0.62rem] font-medium uppercase tracking-wide text-muted">{label}</p>
    </div>
  );
}
