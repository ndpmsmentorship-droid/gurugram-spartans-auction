import { createAdminClient } from "@/lib/supabase/admin";
import { SEASON, BUCKET } from "@/app/register/shared";
import { addToPool, addAllApprovedToPool, removeFromPool } from "./actions";

export const dynamic = "force-dynamic";

/* eslint-disable @typescript-eslint/no-explicit-any */

// Owners' portal side of registrations: only approved players, and only the
// step that puts them into the auction pool with a category. Review, fees,
// vetting and exports are on the league admin (playfulventures.co.in/admin).
const LEAGUE_ADMIN = "https://playfulventures.co.in/admin";
const CATEGORIES = ["A+", "A", "B", "Special"];
const chId = (link: string | null | undefined) =>
  link?.match(/player-profile\/(\d+)/)?.[1] ?? link?.match(/\/(\d{4,})(?:\/|$)/)?.[1] ?? null;
const nameKey = (n: string | null | undefined) => (n ?? "").toLowerCase().replace(/\s+/g, " ").trim();

export default async function PoolFromRegistrationsPage() {
  const sb = createAdminClient() as unknown as { from: (t: string) => any; storage: any };
  const { data: rows } = await sb
    .from("registrations")
    .select("id, full_name, photo_path, photo_thumb_path, cricheroes_link, batting_hand, bowling_type, allrounder, is_keeper")
    .eq("season", SEASON)
    .eq("status", "approved")
    .order("full_name");
  const shown = (rows ?? []) as any[];

  const paths = shown.map((r) => r.photo_thumb_path ?? r.photo_path).filter(Boolean) as string[];
  const signed = new Map<string, string>();
  if (paths.length) {
    const { data } = await sb.storage.from(BUCKET).createSignedUrls(paths, 3600);
    (data ?? []).forEach((d: any) => d.signedUrl && signed.set(d.path, d.signedUrl));
  }

  const poolOf = new Map<string, { own: boolean; category: string | null; sold: boolean }>();
  if (shown.length) {
    const { data: pool } = await sb.from("scout_players").select("source_id, full_name, cricheroes_link, auction_category, team_id");
    for (const r of shown) {
      const ch = chId(r.cricheroes_link);
      const own = (pool ?? []).find((p: any) => p.source_id === `reg:${r.id}`);
      const other = own ? null : (pool ?? []).find((p: any) => (ch && chId(p.cricheroes_link) === ch) || nameKey(p.full_name) === nameKey(r.full_name));
      const hit = own ?? other;
      if (hit) poolOf.set(r.id, { own: !!own, category: hit.auction_category, sold: !!hit.team_id });
    }
  }
  const waiting = shown.filter((r) => !poolOf.has(r.id)).length;

  return (
    <div>
      <p className="eyebrow">Admin</p>
      <h1 className="mt-2 font-display text-2xl font-bold">Approved players → auction pool</h1>
      <p className="mt-2 max-w-2xl text-sm text-muted">
        {shown.length} approved. Review, fees, vetting and exports are on the{" "}
        <a className="text-accent-text underline" href={LEAGUE_ADMIN} target="_blank" rel="noopener noreferrer">
          league admin ↗
        </a>
        . Here you only give each approved player a category and put them in the pool.
      </p>

      {waiting > 0 && (
        <form action={addAllApprovedToPool} className="mt-5 flex flex-wrap items-center gap-3 rounded-[12px] border border-line bg-wash px-4 py-3">
          <p className="text-sm">
            <strong className="num">{waiting}</strong> approved {waiting === 1 ? "player isn't" : "players aren't"} in the auction pool yet.
          </p>
          <button className="btn-primary !py-2">Add all to pool</button>
        </form>
      )}

      <ul className="mt-6 space-y-3">
        {shown.length === 0 && <li className="text-sm text-muted">No approved players yet.</li>}
        {shown.map((r) => {
          const face = signed.get(r.photo_thumb_path ?? r.photo_path ?? "");
          const inPool = poolOf.get(r.id);
          const roles = [r.batting_hand, r.bowling_type, r.allrounder, r.is_keeper ? "Wicket keeper" : null].filter(Boolean);
          return (
            <li key={r.id} className="card flex flex-wrap items-center gap-4">
              {face ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={face} alt="" className="h-16 w-14 rounded-[8px] object-cover" />
              ) : (
                <span className="grid h-16 w-14 place-items-center rounded-[8px] bg-wash font-display text-xl">{String(r.full_name).slice(0, 1)}</span>
              )}
              <div className="min-w-0 flex-1">
                <p className="font-display text-lg uppercase leading-tight">{r.full_name}</p>
                {roles.length > 0 && <p className="text-sm text-muted">{roles.join(" · ")}</p>}
              </div>
              {inPool ? (
                <span className="badge bg-[color-mix(in_srgb,var(--up)_12%,transparent)] text-up">
                  {inPool.sold ? "Sold" : "In pool"}
                  {inPool.category ? ` · ${inPool.category}` : " · no category"}
                  {!inPool.own && " · from league list"}
                </span>
              ) : (
                <span className="badge bg-wash">Not in pool</span>
              )}
              {(!inPool || inPool.own) && !inPool?.sold && (
                <form action={addToPool} className="flex items-center gap-2">
                  <input type="hidden" name="id" value={r.id} />
                  <select name="category" defaultValue={inPool?.category ?? ""} className="input !w-auto !py-1.5 text-sm" aria-label="Auction category">
                    <option value="">Category…</option>
                    {CATEGORIES.map((c) => (
                      <option key={c} value={c}>{c}</option>
                    ))}
                  </select>
                  <button className="btn-primary !py-2">{inPool ? "Update" : "Add to pool"}</button>
                </form>
              )}
              {inPool?.own && !inPool.sold && (
                <form action={removeFromPool}>
                  <input type="hidden" name="id" value={r.id} />
                  <button className="btn-ghost !py-2">Remove</button>
                </form>
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
}
