import { createAdminClient } from "@/lib/supabase/admin";
import { HONOURS, SPARTANS_TAGLINE } from "./honours";
import SpartansStars from "../SpartansStars";

const SPARTANS_TEAM_NAME = "Gurugram Spartans";

// Public, no login. Rendered with the service-role client selecting ONLY
// non-PII columns, so anonymous visitors never see contact/ID data.
export const dynamic = "force-dynamic";

type Stats = {
  batting_avg: number | null;
  batting_sr: number | null;
  wickets: number | null;
  economy: number | null;
};

type RosterRow = {
  player_id: string;
  is_captain: boolean;
  is_vice_captain: boolean;
  is_keeper: boolean;
  batting_order: number | null;
  players: {
    full_name: string;
    primary_role: string | null;
    photo_url: string | null;
  } | null;
  stats?: Stats;
};

function roleGroup(role: string | null): string {
  const r = (role ?? "").toLowerCase();
  if (r.includes("keep")) return "Wicketkeepers";
  if (r.includes("bowl") || r.includes("spin") || r.includes("fast")) return "Bowlers";
  if (r.includes("all")) return "All-rounders";
  if (r.includes("bat")) return "Batters";
  return "Squad";
}

const GROUP_ORDER = ["Batters", "All-rounders", "Bowlers", "Wicketkeepers", "Squad"];

export default async function TeamPage() {
  const supabase = createAdminClient();

  const { data: season } = await supabase
    .from("seasons")
    .select("id, name")
    .eq("is_active", true)
    .maybeSingle();

  const { data: team } = season
    ? await supabase
        .from("teams")
        .select("id")
        .eq("season_id", season.id)
        .eq("name", SPARTANS_TEAM_NAME)
        .maybeSingle()
    : { data: null };

  const { data: roster } = team
    ? await supabase
        .from("roster_entries")
        .select(
          "player_id, is_captain, is_vice_captain, is_keeper, batting_order, " +
            "players(full_name, primary_role, photo_url)"
        )
        .eq("season_id", season!.id)
        .eq("team_id", team.id)
    : { data: null };

  const rows = (roster ?? []) as unknown as RosterRow[];

  // Merge in per-season stats (keyed by player_id + season_id, no direct FK from roster_entries).
  if (rows.length > 0 && season) {
    const { data: statsRows } = await supabase
      .from("player_season_stats")
      .select("player_id, batting_avg, batting_sr, wickets, economy")
      .eq("season_id", season.id)
      .in(
        "player_id",
        rows.map((r) => r.player_id)
      );
    const byPlayer = new Map((statsRows ?? []).map((s) => [s.player_id, s]));
    for (const r of rows) r.stats = byPlayer.get(r.player_id) as Stats | undefined;
  }

  const groups = GROUP_ORDER.map((g) => ({
    name: g,
    players: rows
      .filter((r) => roleGroup(r.players?.primary_role ?? null) === g)
      .sort(
        (a, b) =>
          (a.batting_order ?? 999) - (b.batting_order ?? 999) ||
          (a.players?.full_name ?? "").localeCompare(b.players?.full_name ?? "")
      ),
  })).filter((g) => g.players.length > 0);

  return (
    <main className="mx-auto w-full max-w-5xl flex-1 p-6">
      <section className="rounded-2xl border border-border bg-surface p-8 text-center">
        <h1 className="inline-flex items-center gap-2 text-3xl font-bold">
          Gurugram Spartans <SpartansStars />
        </h1>
        <p className="mt-2 text-muted">{SPARTANS_TAGLINE}</p>
        <div className="mt-6 flex justify-center gap-8">
          {HONOURS.map((h) => (
            <div key={h.label}>
              <p className="text-3xl font-bold text-accent">{h.count}</p>
              <p className="text-xs uppercase tracking-wide text-muted">
                {h.label}
              </p>
            </div>
          ))}
        </div>
      </section>

      <section className="mt-8">
        <h2 className="text-lg font-semibold">
          Squad {season?.name ? `— ${season.name}` : ""}
        </h2>
        {rows.length === 0 ? (
          <p className="mt-3 text-muted">
            No players signed yet. The squad appears here as it&apos;s built at
            auction.
          </p>
        ) : (
          groups.map((group) => (
            <div key={group.name} className="mt-6">
              <h3 className="mb-3 text-sm font-medium uppercase tracking-wide text-muted">
                {group.name}
              </h3>
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {group.players.map((r, i) => (
                  <SquadCard key={i} row={r} />
                ))}
              </div>
            </div>
          ))
        )}
      </section>
    </main>
  );
}

function SquadCard({ row }: { row: RosterRow }) {
  const stats = row.stats;
  const badges = [
    row.is_captain && "C",
    row.is_vice_captain && "VC",
    row.is_keeper && "WK",
  ].filter(Boolean) as string[];

  return (
    <div className="card">
      <div className="flex items-start justify-between gap-2">
        <div>
          <p className="font-medium">{row.players?.full_name}</p>
          <p className="text-sm text-muted">{row.players?.primary_role ?? "—"}</p>
        </div>
        <div className="flex gap-1">
          {badges.map((b) => (
            <span key={b} className="badge bg-primary/15 text-primary">
              {b}
            </span>
          ))}
        </div>
      </div>
      {stats && (
        <p className="mt-2 text-xs text-muted">
          Bat avg {stats.batting_avg ?? "—"} · SR {stats.batting_sr ?? "—"} · Wkts{" "}
          {stats.wickets ?? "—"} · Econ {stats.economy ?? "—"}
        </p>
      )}
    </div>
  );
}
