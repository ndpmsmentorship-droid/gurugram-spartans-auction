import Link from "next/link";
import { tierStyle, LEGEND_STYLE } from "@/lib/scout/tier";
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

// Composition-bar hues, matching the design comp's legend.
const ROLE_COLORS: Record<string, string> = {
  Batter: "#D9A82C",
  "All-rounder": "#4FA97A",
  Bowler: "#7B9FD4",
  Keeper: "#A99B99",
  Other: "#CFC7C6",
};

function catBadge(cat: string | null): { bg: string; fg: string; label: string } | null {
  if (!cat) return null;
  if (/legend/i.test(cat)) return { ...LEGEND_STYLE, label: cat };
  const ts = tierStyle(cat);
  return ts ? { bg: ts.bg, fg: ts.fg, label: cat } : { bg: "var(--chip)", fg: "var(--muted)", label: cat };
}

const acqTag = (a: string | null) =>
  a === "owner"
    ? { label: "Owner", cls: "bg-[color-mix(in_srgb,var(--red)_14%,#fff)] text-accent-text" }
    : a === "retained"
      ? { label: "Retained", cls: "bg-[var(--gold-fill)] text-gold" }
      : { label: "Auction", cls: "bg-chip text-muted" };

export default function SquadDisplay({
  seasonName,
  team,
  squad,
  jerseyByPlayer = {},
  displayByPlayer = {},
  sizesByPlayer = {},
}: {
  seasonName?: string | null;
  team: { name: string; purse_total: number } | null;
  squad: SquadCard[];
  jerseyByPlayer?: Record<string, string | number | null>;
  displayByPlayer?: Record<string, string | null>;
  sizesByPlayer?: Record<string, { tshirt: string | null; lower: string | null }>;
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
    <main className="flex-1">
      {/* Full-bleed maroon hero, per the design comp — the team's identity band. */}
      <header className="band">
        <div className="mx-auto flex w-full max-w-[1400px] flex-wrap items-center justify-between gap-8 px-5 py-10 sm:px-7">
          <div className="flex min-w-0 items-center gap-7">
            <span
              className="hidden h-[130px] w-[112px] shrink-0 items-center justify-center rounded-[8px_8px_46px_46px] border border-white/20 font-mono text-[0.563rem] uppercase tracking-[0.16em] text-white/45 sm:flex"
              style={{
                background:
                  "repeating-linear-gradient(135deg, rgba(255,255,255,.06) 0 7px, transparent 7px 14px)",
              }}
              aria-hidden
            >
              Team logo
            </span>
            <div className="min-w-0">
              <p className="font-mono text-[0.625rem] uppercase tracking-[0.24em] text-white/55">
                {seasonName ?? "Shanti Devi Legend's League"}
              </p>
              <h1 className="mt-3 flex flex-wrap items-center gap-3 font-display text-[2.5rem] leading-[0.95] text-white sm:text-[3.25rem]">
                The {team?.name ?? "Gurugram Spartans"}
                {/* the mark sizes in em, so it needs its own font-size here or
                    it scales to the 3.25rem headline */}
                <SpartansStars className="text-[1.25rem]" />
              </h1>
              <p className="num mt-3 text-[0.875rem] text-white/70">
                {squad.length} players · {inr(spent)} spent · {inr(remaining)} of{" "}
                {inr(budget)} left
              </p>
            </div>
          </div>

          <div className="grid shrink-0 grid-cols-2 gap-3 sm:grid-cols-4">
            <BandStat n={`${aCount}`} label="Category A" sub="max 8 · 6 in XI" color="#F0564A" />
            <BandStat n={`${u35Count}`} label="Under-35" sub="max 5 · 3 in XI" color="#7FA9EC" />
            <BandStat
              n={`${legendCount}`}
              label="Legends"
              sub="min 1 in XI"
              color="#E3B44A"
            />
            <BandStat
              n={`${Math.round((spent / budget) * 100)}%`}
              label="Purse used"
              sub={`${inrK(spent)} / ${inrK(budget)}`}
              color="#5FC48D"
            />
          </div>
        </div>
      </header>

      <div className="mx-auto w-full max-w-[1400px] px-5 py-8 sm:px-7">
        {/* role composition */}
        <div>
          <div className="flex h-2.5 gap-1 overflow-hidden">
            {roleCounts.map((r) =>
              r.n > 0 ? (
                <div
                  key={r.role}
                  className="rounded-full"
                  style={{
                    width: `${(r.n / Math.max(1, squad.length)) * 100}%`,
                    background: ROLE_COLORS[r.role],
                  }}
                  title={`${r.role}: ${r.n}`}
                />
              ) : null,
            )}
          </div>
          <div className="mt-3 flex flex-wrap gap-x-5 gap-y-1.5 text-[0.813rem] text-muted">
            {roleCounts.map((r) => (
              <span key={r.role} className="inline-flex items-center gap-2">
                <span
                  className="h-2.5 w-2.5 rounded-full"
                  style={{ background: ROLE_COLORS[r.role] }}
                />
                {r.role} <b className="num font-medium text-ink">{r.n}</b>
              </span>
            ))}
          </div>
        </div>

      {/* squad table */}
      {/* mobile: cards (sizes in-line on the right) */}
      <div className="mt-5 space-y-2 sm:hidden">
        {sorted.map((p) => {
          const cb = catBadge(p.auction_category);
          const jn = jersey(p.id);
          const sizes = sizesByPlayer[p.id];
          const dn = displayByPlayer[p.id];
          return (
            <div key={p.id} className="flex items-center gap-3 rounded-[12px] border border-line bg-surface p-3">
              <span className="num flex h-10 w-10 shrink-0 items-center justify-center rounded-[10px] bg-tile font-display text-[1.125rem] font-bold text-red">
                {jn ?? "—"}
              </span>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <Link href={`/scout/${p.id}`} className="truncate text-[0.938rem] text-ink transition hover:text-red">
                    {p.full_name}
                  </Link>
                  {cb && (
                    <span
                      className="badge shrink-0 uppercase"
                      style={{ background: cb.bg, color: cb.fg }}
                    >
                      {cb.label}
                    </span>
                  )}
                </div>
                <p className="mt-1 truncate text-[0.75rem] text-muted">
                  {roleOf(p)}
                  {dn ? ` · “${dn}”` : ""}
                </p>
              </div>
              <div className="num shrink-0 text-right text-[0.688rem] leading-relaxed text-muted">
                <div>Tee <b className="font-medium text-ink">{sizes?.tshirt || "—"}</b></div>
                <div>Low <b className="font-medium text-ink">{sizes?.lower || "—"}</b></div>
              </div>
            </div>
          );
        })}
      </div>

      {/* desktop: table */}
      <div className="mt-6 hidden overflow-x-auto rounded-[12px] border border-line sm:block">
        <table className="w-full min-w-[860px] border-separate border-spacing-0 text-[0.875rem]">
          <thead className="text-left">
            <tr>
              {["Jersey", "Player", "Category", "Role", "On jersey", "T-shirt", "Lower"].map(
                (h, i) => (
                  <th
                    key={h}
                    className={`label-mono border-b border-line px-4 py-3.5 ${
                      i >= 5 ? "text-center" : ""
                    }`}
                    style={{ background: "var(--wash)" }}
                  >
                    {h}
                  </th>
                ),
              )}
            </tr>
          </thead>
          <tbody>
            {sorted.map((p, i) => {
              const cb = catBadge(p.auction_category);
              const jn = jersey(p.id);
              const tag = acqTag(p.acquired);
              const sizes = sizesByPlayer[p.id];
              const dn = displayByPlayer[p.id];
              return (
                <tr
                  key={p.id}
                  style={{ background: i % 2 ? "var(--zebra)" : "var(--surface)" }}
                >
                  <td className="num border-b border-line px-4 py-3 font-display text-[1.25rem] font-bold text-red">
                    {jn ?? "—"}
                  </td>
                  <td className="border-b border-line px-4 py-3">
                    <Link
                      href={`/scout/${p.id}`}
                      className="text-ink transition hover:text-red"
                    >
                      {p.full_name}
                    </Link>
                    <span className={`badge ml-2.5 uppercase ${tag.cls}`}>{tag.label}</span>
                  </td>
                  <td className="border-b border-line px-4 py-3">
                    {cb ? (
                      <span
                        className="badge uppercase"
                        style={{ background: cb.bg, color: cb.fg }}
                      >
                        {cb.label}
                      </span>
                    ) : (
                      "—"
                    )}
                  </td>
                  <td className="border-b border-line px-4 py-3 text-muted">{roleOf(p)}</td>
                  <td className="border-b border-line px-4 py-3 text-muted">{dn || "—"}</td>
                  <td className="num border-b border-line px-4 py-3 text-center text-muted">
                    {sizes?.tshirt || "—"}
                  </td>
                  <td className="num border-b border-line px-4 py-3 text-center text-muted">
                    {sizes?.lower || "—"}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

        {squad.length === 0 && (
          <p className="py-16 text-center text-muted">No players in the squad yet.</p>
        )}
      </div>
    </main>
  );
}

// A stat tile sitting on the maroon hero band — the number carries the colour,
// the chrome stays neutral so four of them don't fight each other.
function BandStat({
  n,
  label,
  sub,
  color,
}: {
  n: string;
  label: string;
  sub: string;
  color: string;
}) {
  return (
    <div className="min-w-[8.25rem] rounded-[12px] border border-white/15 bg-white/[0.06] px-4 py-4 text-center">
      <p className="font-display text-[1.875rem] leading-none" style={{ color }}>
        {n}
      </p>
      <p className="mt-2.5 font-mono text-[0.594rem] uppercase tracking-[0.13em] text-white/80">
        {label}
      </p>
      <p className="num mt-1 text-[0.625rem] text-white/45">{sub}</p>
    </div>
  );
}

// SVG ring gauge
