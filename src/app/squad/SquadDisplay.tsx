import Link from "next/link";
import { tierStyle } from "@/lib/scout/tier";
import { roleGroup } from "@/lib/scout/analytics";

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
  // Jersey number order when set, otherwise by price (stars first).
  const sorted = [...squad].sort((a, b) => {
    const ja = jersey(a.id);
    const jb = jersey(b.id);
    if (ja && jb) return Number(ja) - Number(jb);
    if (ja) return -1;
    if (jb) return 1;
    return (Number(b.sold_price) || 0) - (Number(a.sold_price) || 0);
  });

  return (
    <main className="mx-auto w-full max-w-4xl flex-1 px-4 py-8 sm:px-6">
      <header className="border-b border-border pb-5">
        <p className="eyebrow">SARDA Corporate Cricket League · Season 6</p>
        <h1 className="mt-1 font-display text-3xl font-bold tracking-tight sm:text-4xl">
          {team?.name ?? "Gurugram Spartans"}
        </h1>
        <p className="mt-1 text-muted">Final squad · {squad.length} players</p>
      </header>

      <div className="mt-5 overflow-x-auto rounded-2xl border border-border">
        <table className="w-full min-w-[520px] text-sm">
          <thead className="bg-wash text-left text-muted">
            <tr>
              <th className="w-16 px-4 py-3 font-medium">Jersey</th>
              <th className="px-4 py-3 font-medium">Name</th>
              <th className="px-4 py-3 font-medium">Category</th>
              <th className="px-4 py-3 font-medium">Role</th>
            </tr>
          </thead>
          <tbody>
            {sorted.map((p) => {
              const ts = tierStyle(p.auction_category);
              const jn = jersey(p.id);
              return (
                <tr key={p.id} className="border-t border-border">
                  <td className="px-4 py-2.5 font-display text-lg font-bold tabular-nums text-accent-text">
                    {jn ?? "—"}
                  </td>
                  <td className="px-4 py-2.5">
                    <Link href={`/scout/${p.id}`} className="font-medium hover:text-accent-text">
                      {p.full_name}
                    </Link>
                  </td>
                  <td className="px-4 py-2.5">
                    {ts ? (
                      <span
                        className="rounded-full px-2 py-0.5 text-[11px] font-bold uppercase tracking-wide"
                        style={{ background: ts.bg, color: ts.fg }}
                      >
                        {p.auction_category}
                      </span>
                    ) : (
                      "—"
                    )}
                  </td>
                  <td className="px-4 py-2.5 text-muted">
                    {p.is_keeper ? "Keeper" : roleGroup(p.primary_role, !!p.is_keeper)}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {squad.length === 0 && (
        <p className="mt-10 text-center text-muted">No players in the squad yet.</p>
      )}
    </main>
  );
}
