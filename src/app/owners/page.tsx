import type { Metadata } from "next";
import Link from "next/link";
import Image from "next/image";
import { redirect } from "next/navigation";
import { getCurrentProfile } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { getAuctionSeasonId, AUCTION_DIVISIONS } from "@/lib/auction/target";
import { readLiveLot } from "@/lib/auction/read";
import { loadOwnerPool } from "@/lib/auction/owner-pool";
import { DEFAULT_RULES, inr } from "@/lib/auction/rules";
import { findFranchise } from "@/app/franchises";
import TeamCrest from "@/app/TeamCrest";

export const metadata: Metadata = { title: "Owners’ portal" };
export const dynamic = "force-dynamic";

const AUCTION = new Date("2026-12-12T18:00:00+05:30");
const R = DEFAULT_RULES;
const daysTo = (d: Date) => Math.max(0, Math.ceil((d.getTime() - Date.now()) / 86400000));

// The owner's home after signing in: their franchise, their money, and the way
// into the three parts of the portal — Plan, Live pool, War Room — plus the AI scout.
export default async function OwnersHome({ searchParams }: { searchParams: Promise<{ team?: string }> }) {
  const profile = await getCurrentProfile();
  if (!profile) redirect("/login?next=/owners");
  const { team: teamParam } = await searchParams;

  const seasonId = await getAuctionSeasonId();
  const sb = createAdminClient() as unknown as { from: (t: string) => any }; // eslint-disable-line @typescript-eslint/no-explicit-any
  const [{ data: teams }, lot, pool] = await Promise.all([
    sb.from("teams").select("id, name, division, purse_total, purse_max, owner_profile_id, logo_url").eq("season_id", seasonId).in("division", AUCTION_DIVISIONS).order("name"),
    readLiveLot(seasonId),
    loadOwnerPool({ photos: false }),
  ]);
  type T = { id: string; name: string; division: string; purse_total: number; purse_max: number | null; owner_profile_id: string | null; logo_url: string | null };
  const list = (teams ?? []) as T[];
  const team =
    (profile.role === "owner" ? list.find((t) => t.owner_profile_id === profile.id) : null) ?? list.find((t) => t.name === teamParam) ?? list[0];
  if (!team) return <main className="mx-auto max-w-[900px] px-4 py-16 text-muted">No teams in the active season yet.</main>;

  const { data: bought } = await sb.from("scout_players").select("id, full_name, sold_price").eq("team_id", team.id);
  const squad = (bought ?? []) as { id: string; full_name: string; sold_price: number | null }[];
  const spent = squad.reduce((a, p) => a + (p.sold_price ?? 0), 0);
  const left = Number(team.purse_total) - spent;
  const target = Math.max(R.squadMin, 12);
  const maxSafe = Math.max(0, left - Math.max(0, target - squad.length - 1) * R.base.B);
  const topUp = Math.max(0, (team.purse_max ?? team.purse_total) - team.purse_total);

  let onBlock: string | null = null;
  if (lot.status === "live" && lot.player_id) {
    const { data } = await sb.from("scout_players").select("full_name").eq("id", lot.player_id).maybeSingle();
    onBlock = (data as { full_name: string } | null)?.full_name ?? null;
  }

  const counts = { selected: 0, review: 0, rejected: 0 };
  for (const p of pool ?? []) counts[p.status] += 1;
  const latest = (pool ?? []).slice(0, 3);

  const fr = findFranchise(team.name);
  const owners = fr?.owners ?? [];
  const days = daysTo(AUCTION);

  return (
    <main className="flex-1">
      {/* franchise band */}
      <section className="text-white" style={{ background: "radial-gradient(120% 120% at 10% 0%, var(--header-a) 0%, var(--header-b) 70%)" }}>
        <div className="mx-auto flex max-w-[1100px] flex-wrap items-center gap-5 px-4 py-8 sm:px-7">
          <span className="grid h-20 w-20 shrink-0 place-items-center rounded-[16px] bg-white/95 p-2">
            {fr?.logo ? <Image src={fr.logo} alt="" className="h-16 w-16 object-contain" sizes="64px" /> : <TeamCrest name={team.name} logoUrl={team.logo_url} size={64} />}
          </span>
          <div className="min-w-0 flex-1">
            <p className="font-mono text-[0.625rem] uppercase tracking-[0.24em]" style={{ color: "var(--steel)" }}>
              Owners’ portal · {team.division}
            </p>
            <h1 className="mt-1 font-display text-3xl font-bold uppercase leading-tight sm:text-4xl">{team.name}</h1>
            {owners.length > 0 && <p className="mt-1 text-sm text-white/75">{owners.join(" · ")}</p>}
          </div>
          <div className="text-right">
            <p className="font-display text-4xl font-bold leading-none">{days}</p>
            <p className="mt-1 font-mono text-[0.625rem] uppercase tracking-[0.2em] text-white/60">days to auction night · 12 Dec</p>
          </div>
        </div>
      </section>

      <div className="mx-auto max-w-[1100px] px-4 py-6 sm:px-7">
        {/* money */}
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <Tile k="Purse left" v={inr(left)} sub={`of ${inr(team.purse_total)}`} />
          <Tile k="Most you can bid" v={inr(maxSafe)} sub={`keeps ${Math.max(0, target - squad.length - 1)} places at ${inr(R.base.B)}`} />
          <Tile k="Squad" v={`${squad.length} / ${target}`} sub={squad.length ? `${inr(spent)} spent` : "no buys yet"} />
          <Tile k="Top-up" v={inr(topUp)} sub="in one go, during the auction" />
        </div>

        {/* the three parts */}
        <div className="mt-6 grid gap-4 md:grid-cols-3">
          <Card href="/war-room?tab=plan" kicker="01 · Plan" title="Plan your squad" cta="Open the planner">
            Five strategies, each the best squad your purse can still buy, scored on the playing XII. Mark players going for, hold or reject.
          </Card>
          <Card href="/war-room?tab=pool" kicker="02 · Live pool" title="Players as they register" cta="See the pool">
            <span className="mt-1 flex gap-2 text-[0.75rem]">
              <Pill c="text-up" n={counts.selected} l="selected" />
              <Pill c="text-gold" n={counts.review} l="under review" />
              <Pill c="text-red-deep" n={counts.rejected} l="rejected" />
            </span>
            {latest.length > 0 ? (
              <span className="mt-2 block text-[0.75rem]">Latest: {latest.map((p) => p.name).join(", ")}</span>
            ) : (
              <span className="mt-2 block text-[0.75rem]">Registrations open Mon 2 Nov 2026.</span>
            )}
          </Card>
          <Card href="/war-room?tab=live" kicker="03 · War Room" title="Auction night" cta="Enter the War Room">
            {onBlock ? (
              <span className="text-up">Live now: {onBlock} is on the block.</span>
            ) : (
              <>Purse, max safe bid, squad gaps, and a verdict on every player on the block: XII impact, your ceiling and the chance he ends up yours.</>
            )}
          </Card>
        </div>

        {/* AI scout */}
        <Link
          href="/war-room?tab=live"
          className="mt-4 flex items-center justify-between gap-4 rounded-[16px] border border-line bg-surface p-5 shadow-[var(--elev-sm)] transition hover:shadow-[var(--elev)]"
        >
          <span>
            <span className="label-mono">04 · AI scout</span>
            <span className="mt-1 block font-display text-xl uppercase leading-tight">Ask who to buy next</span>
            <span className="mt-1 block text-sm text-muted">
              On every tab of the portal: it reads your purse, slots, squad gaps and the player on the block, and suggests the best buy. Goes live on auction day.
            </span>
          </span>
          <span className="shrink-0 rounded-full bg-red px-4 py-2 font-display text-sm uppercase tracking-wide text-white">✦ AI scout</span>
        </Link>

        <p className="mt-6 text-[0.75rem] text-muted">
          Also: <Link className="underline" href="/my-team">My squad</Link> · <Link className="underline" href="/auction">Live board</Link> ·{" "}
          <Link className="underline" href="/schedule">Schedule</Link> · <a className="underline" href="https://www.ndpms.in/spartans">Ball Library</a>
        </p>
      </div>
    </main>
  );
}

function Tile({ k, v, sub }: { k: string; v: string; sub: string }) {
  return (
    <div className="rounded-[14px] border border-line bg-surface p-4">
      <p className="label-mono">{k}</p>
      <p className="num mt-1 text-xl font-semibold leading-tight">{v}</p>
      <p className="mt-0.5 text-[0.75rem] text-muted">{sub}</p>
    </div>
  );
}

function Card({ href, kicker, title, cta, children }: { href: string; kicker: string; title: string; cta: string; children: React.ReactNode }) {
  return (
    <Link
      href={href}
      className="group flex flex-col rounded-[16px] border border-line bg-surface p-5 shadow-[var(--elev-sm)] transition hover:-translate-y-0.5 hover:shadow-[var(--elev)]"
    >
      <span className="label-mono">{kicker}</span>
      <span className="mt-1 font-display text-xl uppercase leading-tight">{title}</span>
      <span className="mt-2 flex-1 text-sm text-muted">{children}</span>
      <span className="mt-4 text-sm font-medium text-red group-hover:underline">{cta} →</span>
    </Link>
  );
}

function Pill({ c, n, l }: { c: string; n: number; l: string }) {
  return (
    <span className="rounded-full border border-line px-2 py-0.5">
      <b className={`num ${c}`}>{n}</b> {l}
    </span>
  );
}
