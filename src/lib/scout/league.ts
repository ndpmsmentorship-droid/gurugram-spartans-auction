import "server-only";
import type { CleanPlayer } from "./importer";

// Live pull of the auction pool straight from the Sarda Corporate Cricket League
// dashboard (anantanity), so the pool can be refreshed with one click instead of
// exporting a spreadsheet by hand. Credentials live in env, never in the repo:
//   SCCL_USERNAME, SCCL_PASSWORD   (the club's owner login)
//   SCCL_SEASON                    (optional, defaults to 6 — the current auction)

const BASE = process.env.SCCL_BASE_URL || "https://sarda-corporate-league.anantanity.com";
const PAGE_SIZE = 100;

type LeagueRow = Record<string, unknown>;

const num = (v: unknown): number | null => {
  if (v === null || v === undefined || v === "") return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
};
// prefer the first finite, non-zero value — the lower_snake dupes (batting_avg,
// batting_sr…) are often zeroed while the Title-Case columns hold the real number.
const pickNum = (...vals: unknown[]): number | null => {
  const nums = vals.map(num);
  return nums.find((n) => n != null && n !== 0) ?? nums.find((n) => n != null) ?? null;
};
const str = (v: unknown): string | null => {
  const s = v == null ? "" : String(v).trim();
  return s === "" ? null : s;
};
const absUrl = (v: unknown): string | null => {
  const s = str(v);
  if (!s) return null;
  return s.startsWith("/") ? BASE + s : s;
};
const oversToBalls = (overs: number | null): number | null => {
  if (overs == null) return null;
  const whole = Math.floor(overs);
  const balls = Math.round((overs - whole) * 10);
  if (balls > 5) return null;
  return whole * 6 + balls;
};

async function login(): Promise<string> {
  const username = process.env.SCCL_USERNAME;
  const password = process.env.SCCL_PASSWORD;
  if (!username || !password) {
    throw new Error(
      "League login not configured. Set SCCL_USERNAME and SCCL_PASSWORD in the environment."
    );
  }
  const res = await fetch(`${BASE}/api/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ username, password }),
    cache: "no-store",
  });
  const data = await res.json().catch(() => null);
  const token = data?.data?.token?.token;
  if (!res.ok || !token) {
    throw new Error(`League login failed: ${data?.error || res.status}`);
  }
  return token as string;
}

function toCleanPlayer(p: LeagueRow): CleanPlayer {
  const role = str(p["playingAs"]) || str(p["skill"]);
  const overs = num(p["overs"]);
  let wickets = pickNum(p["Wickets"], p["wickets"]);
  const balls = oversToBalls(overs);
  if (wickets != null && balls != null && wickets > balls) wickets = null; // fat-finger guard
  const roleLc = (role ?? "").toLowerCase();

  return {
    full_name: String(p["Name"] ?? "").trim(),
    age: num(p["age"]) != null ? Math.round(num(p["age"])!) : null,
    primary_role: role,
    auction_category: str(p["category"]) ?? str(p["Category"]) ?? null,
    photo_url: absUrl(p["Player Image"]),
    cricheroes_link: str(p["Cric Heroes Profile"]),
    email: null,
    phone: null,
    bat_matches: pickNum(p["batting_matches"], p["Matches"]),
    bat_innings: num(p["batting_innings"]),
    not_out: num(p["not_out"]),
    runs: num(p["batting_runs"]),
    highest_score: str(p["highest_runs"]),
    bat_avg: pickNum(p["Batting Avg"], p["batting_avg"]),
    bat_sr: pickNum(p["Batting SR"], p["batting_sr"]),
    fifties: num(p["50s"]),
    hundreds: num(p["100s"]),
    fours: num(p["bating_4s"]),
    sixes: num(p["bating_6s"]),
    ducks: num(p["ducks"]),
    bowl_matches: num(p["bowling_matches"]),
    bowl_innings: num(p["bowling_innings"]),
    overs,
    maidens: num(p["maidens"]),
    wickets,
    bowl_runs: num(p["bowling_runs"]),
    economy: pickNum(p["Economy"], p["economy"]),
    bowl_avg: num(p["bowling_avg"]),
    bowl_sr: num(p["bowling_sr"]),
    three_w: num(p["3_wickets"]),
    five_w: num(p["5_wickets"]),
    dot_balls: num(p["dot_balls"]),
    bowl_fours: num(p["bowling_4s"]),
    bowl_sixes: num(p["bowling_6s"]),
    wides: num(p["wides"]),
    noballs: num(p["noballs"]),
    catches: num(p["Catches"]),
    run_outs: num(p["Run outs"]),
    is_keeper: /keep|wicket ?keeper|(^|\W)wk(\W|$)/i.test(roleLc),
    stumpings: num(p["Stumpings"]),
    keeping_catches: num(p["Caught behind"]),
  };
}

export type LeaguePool = { players: CleanPlayer[]; season: number; fetched: number };

// Pull every registered player for the given season, cleaned into the same shape
// the spreadsheet importer produces.
export async function fetchLeaguePool(seasonArg?: number): Promise<LeaguePool> {
  const season = seasonArg ?? (Number(process.env.SCCL_SEASON) || 6);
  const token = await login();
  const headers = { Authorization: `Bearer ${token}` };

  const first = await fetch(
    `${BASE}/api/players?limit=${PAGE_SIZE}&page=1&season=${season}`,
    { headers, cache: "no-store" }
  );
  const firstJson = await first.json().catch(() => null);
  if (!first.ok || !firstJson?.success) {
    throw new Error(`League players fetch failed: ${firstJson?.error || first.status}`);
  }
  const rowsOf = (j: { data?: { players?: LeagueRow[] } | LeagueRow[] } | null): LeagueRow[] => {
    const d = j?.data;
    return Array.isArray(d) ? d : ((d as { players?: LeagueRow[] })?.players ?? []);
  };
  const total: number = Number(firstJson.total) || rowsOf(firstJson).length;
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  const raw: LeagueRow[] = [...rowsOf(firstJson)];
  for (let page = 2; page <= totalPages; page++) {
    const res = await fetch(
      `${BASE}/api/players?limit=${PAGE_SIZE}&page=${page}&season=${season}`,
      { headers, cache: "no-store" }
    );
    const json = await res.json().catch(() => null);
    if (!res.ok || !json?.success) {
      throw new Error(`League players page ${page} failed: ${json?.error || res.status}`);
    }
    raw.push(...rowsOf(json));
  }

  const players = raw
    .map(toCleanPlayer)
    .filter((p) => p.full_name !== "");
  return { players, season, fetched: players.length };
}
