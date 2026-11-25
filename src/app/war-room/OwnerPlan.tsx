"use client";

import { useEffect, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { normCategory } from "@/lib/scout/tier";
import { DEFAULT_RULES, SLL2_SQUAD, inr } from "@/lib/auction/rules";
import { LEAGUE } from "@/lib/league";
import type { PlanPlayer } from "@/lib/auction/planner";
import { catLabel } from "@/lib/scout/tier";
import TeamCrest from "@/app/TeamCrest";
import { Tile } from "./WarRoom";
import DreamXII from "./DreamXII";
import { MarkerKey } from "./Markers";

export type PlanTeam = { id: string; name: string; purse_total: number; purse_max: number | null; logo_url?: string | null };
export type PoolPlayer = Omit<PlanPlayer, "cat"> & { auction_category: string | null; photo_url?: string | null };

const R = DEFAULT_RULES;

// The Plan tab (25 Nov 2026, Nikhil): the owner's own playing XII is the job — owners first,
// then each slot picked from the live pool with our sorted suggestions in the right column
// (DreamXII). The purse tiles stay on top, the War Room's own row, so planning is practice for
// auction night. The old strategy cards, batting-order / bowling-attack boxes and to-buy list
// were replaced by the XII builder (old version in git history before this change).
export default function OwnerPlan(props: { seasonId: string; profileId: string; team: PlanTeam; players: PoolPlayer[]; leagueName?: string }) {
  const [players, setPlayers] = useState(props.players);
  const [synced, setSynced] = useState<number | null>(null);
  const [team, setTeam] = useState(props.team);

  // Sales and top-ups land while the owner plans: refresh every 10 s.
  useEffect(() => {
    const sb = createClient();
    let alive = true;
    const pull = async () => {
      const [sold, t] = await Promise.all([
        sb.from("scout_players").select("id, team_id, sold_price").not("team_id", "is", null),
        sb.from("teams").select("purse_total, purse_max").eq("id", props.team.id).maybeSingle(),
      ]);
      if (!alive) return;
      setSynced(Date.now());
      if (sold.data) {
        const m = new Map((sold.data as unknown as { id: string; team_id: string; sold_price: number | null }[]).map((r) => [r.id, r]));
        setPlayers((ps) =>
          ps.map((p) => {
            const s = m.get(p.id);
            const team_id = s?.team_id ?? null, sold_price = s?.sold_price ?? null;
            return p.team_id === team_id && p.sold_price === sold_price ? p : { ...p, team_id, sold_price };
          }),
        );
      }
      const row = t.data as unknown as { purse_total: number; purse_max: number | null } | null;
      if (row) setTeam((x) => (x.purse_total === Number(row.purse_total) && x.purse_max === row.purse_max ? x : { ...x, purse_total: Number(row.purse_total), purse_max: row.purse_max }));
    };
    const id = setInterval(pull, 10000);
    return () => {
      alive = false;
      clearInterval(id);
    };
  }, [props.team.id]);

  const mine = useMemo(() => players.filter((p) => p.team_id === team.id), [players, team.id]);
  const spent = mine.reduce((a, p) => a + (p.sold_price ?? 0), 0);
  const purseLeft = team.purse_total - spent;
  const sll2 = LEAGUE === "sdll";
  const target = sll2 ? SLL2_SQUAD.size : Math.max(R.squadMin, 12);
  const floor = sll2 ? SLL2_SQUAD.base.B : R.base.B; // cheapest way to fill a slot
  const maxSafe = Math.max(0, purseLeft - Math.max(0, target - mine.length - 1) * floor);
  const topUp = Math.max(0, (team.purse_max ?? team.purse_total) - team.purse_total);
  const cats = useMemo(() => {
    const c: Record<string, number> = { "A+": 0, A: 0, B: 0, Special: 0 };
    for (const p of mine) {
      const k = normCategory(p.auction_category) ?? "B";
      c[k] = (c[k] ?? 0) + 1;
    }
    return c;
  }, [mine]);

  return (
    <div className="mx-auto w-full max-w-[1280px] pb-24">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="eyebrow">
            Plan · <span className="sm:hidden">SLL Season 2</span>
            <span className="hidden sm:inline">{props.leagueName ?? "SLL Season 2"}</span>
          </p>
          <h1 className="mt-1 flex items-center gap-3 text-3xl sm:text-4xl">
            {team.logo_url && <TeamCrest name={team.name} logoUrl={team.logo_url} size={52} />}
            {team.name}
          </h1>
        </div>
        <span className="flex items-center gap-1.5 text-xs text-muted">
          <span className="h-2 w-2 animate-pulse rounded-full bg-up" /> live{synced ? ` · ${new Date(synced).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit", second: "2-digit" })}` : ""}
        </span>
      </div>

      <section className="mt-4 grid grid-cols-1 gap-2 lg:grid-cols-[2fr_5fr]">
        <div className="grid grid-cols-2 gap-2">
          <Tile k="Purse left" v={inr(purseLeft)} sub={`of ${inr(team.purse_total)}${topUp ? ` · +${inr(topUp)} top-ups available` : ""}`} strong />
          <Tile k="Max safe bid" v={inr(maxSafe)} sub={`keeps ${Math.max(0, target - mine.length - 1)} slots at ${inr(floor)}`} strong />
        </div>
        {sll2 ? (
          <div className="grid grid-cols-3 gap-2 sm:grid-cols-5">
            <Tile k="Squad" v={`${mine.length}/${SLL2_SQUAD.size}`} sub="rules: squad of 18" compact />
            {(["Legend", "A+", "A", "B"] as const).map((c) => {
              const have = cats[c === "Legend" ? "Special" : c] ?? 0;
              return <Tile key={c} k={c} v={`${have}/${SLL2_SQUAD.mix[c]}`} sub={`base ${inr(SLL2_SQUAD.base[c])}`} warn={have > SLL2_SQUAD.mix[c]} compact />;
            })}
          </div>
        ) : (
          <div className="grid grid-cols-3 gap-2 sm:grid-cols-5">
            <Tile k="Squad" v={`${mine.length}`} sub={`${R.squadMin}–${R.squadMax}`} compact />
            {(["A+", "A", "B", "Special"] as const).map((c) => (
              <Tile key={c} k={catLabel(c)} v={`${cats[c] ?? 0}`} sub={`max ${R.cap[c]}`} warn={c !== "B" && (cats[c] ?? 0) >= R.cap[c]} compact />
            ))}
          </div>
        )}
      </section>

      <DreamXII profileId={props.profileId} team={team.name} />

      <MarkerKey />
    </div>
  );
}
