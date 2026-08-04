import "server-only";
import * as XLSX from "xlsx";

// Parse an uploaded .xlsx/.csv of the auction pool into cleaned scout_players
// rows. Column headers vary between organizers, so we map by normalized header
// name (seeded from the known Season 4 export + common fielding/keeping variants)
// and clean the messy values these exports are known to contain:
//   - thousands-separator commas ("1,344.00")
//   - Excel scientific-notation numbers ("9.20E+11")
//   - stray text in numeric cells ("profile cases pending")
//   - fat-finger outliers (wickets exceeding balls bowled)

export type CleanPlayer = {
  full_name: string;
  age: number | null;
  primary_role: string | null;
  photo_url: string | null;
  cricheroes_link: string | null;
  email: string | null;
  phone: string | null;
  bat_matches: number | null;
  bat_innings: number | null;
  not_out: number | null;
  runs: number | null;
  highest_score: string | null;
  bat_avg: number | null;
  bat_sr: number | null;
  fifties: number | null;
  hundreds: number | null;
  fours: number | null;
  sixes: number | null;
  ducks: number | null;
  bowl_matches: number | null;
  bowl_innings: number | null;
  overs: number | null;
  maidens: number | null;
  wickets: number | null;
  bowl_runs: number | null;
  economy: number | null;
  bowl_avg: number | null;
  bowl_sr: number | null;
  three_w: number | null;
  five_w: number | null;
  dot_balls: number | null;
  bowl_fours: number | null;
  bowl_sixes: number | null;
  wides: number | null;
  noballs: number | null;
  catches: number | null;
  run_outs: number | null;
  is_keeper: boolean;
  stumpings: number | null;
  keeping_catches: number | null;
};

export type ImportResult = {
  players: CleanPlayer[];
  mapping: { field: string; header: string }[];
  unmappedHeaders: string[];
  warnings: string[];
};

// canonical field -> accepted header aliases (all matched case/space/punct-insensitively)
const FIELD_ALIASES: Record<keyof CleanPlayer, string[]> = {
  full_name: ["full name", "name", "player name", "player"],
  age: ["age"],
  primary_role: ["cricketing skills", "skills", "role", "player type", "please state your cricketing skills"],
  photo_url: ["player image", "photo", "profile photo", "passport size photograph"],
  cricheroes_link: ["cric heros profile", "cricheroes profile", "cricheroes", "cricheroes link"],
  email: ["e mail id", "email", "e-mail", "email id"],
  phone: ["contact number", "phone", "mobile", "contact"],
  bat_matches: ["batting_matches", "batting matches", "bat matches", "matches"],
  bat_innings: ["batting_innings", "batting innings", "innings", "inns"],
  not_out: ["not_out", "not out", "no"],
  runs: ["batting_runs", "runs", "total runs"],
  highest_score: ["highest_runs", "highest", "highest score", "hs"],
  bat_avg: ["batting avg", "batting average", "bat avg", "average", "avg"],
  bat_sr: ["batting sr", "batting strike rate", "strike rate", "sr"],
  fifties: ["50s", "fifties", "half centuries"],
  hundreds: ["100s", "hundreds", "centuries"],
  fours: ["bating_4s", "batting_4s", "4s", "fours"],
  sixes: ["bating_6s", "batting_6s", "6s", "sixes"],
  ducks: ["ducks"],
  bowl_matches: ["bowling_matches", "bowling matches", "bowl matches"],
  bowl_innings: ["bowling_innings", "bowling innings", "bowl innings"],
  overs: ["overs", "overs bowled"],
  maidens: ["maidens", "maiden"],
  wickets: ["wickets", "wkts", "wicket"],
  bowl_runs: ["bowling_runs", "runs conceded", "bowl runs"],
  economy: ["economy", "econ", "eco"],
  bowl_avg: ["bowling_avg", "bowling average", "bowl avg"],
  bowl_sr: ["bowling_sr", "bowling strike rate", "bowl sr"],
  three_w: ["3_wickets", "3w", "three wickets", "3 wickets"],
  five_w: ["5_wickets", "5w", "five wickets", "5 wickets"],
  dot_balls: ["dot_balls", "dot balls", "dots"],
  bowl_fours: ["bowling_4s", "bowling 4s", "bowl 4s", "bowling fours", "fours conceded"],
  bowl_sixes: ["bowling_6s", "bowling 6s", "bowl 6s", "bowling sixes", "sixes conceded"],
  wides: ["wides", "wide"],
  noballs: ["noballs", "no balls", "nb"],
  catches: ["catches", "ct", "catch", "fielding catches"],
  run_outs: ["run_outs", "run outs", "runouts", "ro", "run out"],
  is_keeper: ["is_keeper", "keeper", "wicketkeeper", "wk"],
  stumpings: ["stumpings", "st", "stumping", "stumps"],
  keeping_catches: ["keeping_catches", "keeper catches", "wk catches", "keeping catches"],
};

const NUMERIC_FIELDS = new Set<keyof CleanPlayer>([
  "age", "bat_matches", "bat_innings", "not_out", "runs", "bat_avg", "bat_sr",
  "fifties", "hundreds", "fours", "sixes", "ducks", "bowl_matches", "bowl_innings",
  "overs", "maidens", "wickets", "bowl_runs", "economy", "bowl_avg", "bowl_sr",
  "three_w", "five_w", "dot_balls", "bowl_fours", "bowl_sixes", "wides", "noballs", "catches", "run_outs",
  "stumpings", "keeping_catches",
]);

const normalize = (h: string) =>
  h.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();

function cleanNumber(raw: unknown): number | null {
  if (raw == null) return null;
  if (typeof raw === "number") return Number.isFinite(raw) ? raw : null;
  const s = String(raw).trim().replace(/,/g, "");
  if (s === "") return null;
  if (/e\+?\d+$/i.test(s)) {
    const n = Number(s);
    return Number.isFinite(n) ? n : null;
  }
  if (!/^-?\d*\.?\d+$/.test(s)) return null; // stray text like "profile cases pending"
  const n = Number(s);
  return Number.isFinite(n) ? n : null;
}

function cleanPhone(raw: unknown): string | null {
  if (raw == null) return null;
  let s = String(raw).trim();
  if (/e\+?\d+$/i.test(s)) {
    const n = Number(s);
    if (Number.isFinite(n)) s = String(Math.round(n));
  }
  const digits = s.replace(/\D/g, "");
  return digits || null;
}

// cricket overs X.Y = X overs + Y balls (Y is 0-5), used to sanity-check wickets
function oversToBalls(overs: number | null): number | null {
  if (overs == null) return null;
  const whole = Math.floor(overs);
  const balls = Math.round((overs - whole) * 10);
  if (balls > 5) return null;
  return whole * 6 + balls;
}

export function parseWorkbook(buffer: ArrayBuffer): ImportResult {
  const wb = XLSX.read(buffer, { type: "array" });
  const sheet = wb.Sheets[wb.SheetNames[0]];
  const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, { defval: null });

  if (rows.length === 0) {
    return { players: [], mapping: [], unmappedHeaders: [], warnings: ["No rows found in the file."] };
  }

  const headers = Object.keys(rows[0]);
  const normHeaders = headers.map((h) => ({ raw: h, norm: normalize(h) }));

  // build field -> header map
  const fieldToHeader = new Map<keyof CleanPlayer, string>();
  const usedHeaders = new Set<string>();
  (Object.keys(FIELD_ALIASES) as (keyof CleanPlayer)[]).forEach((field) => {
    for (const alias of FIELD_ALIASES[field]) {
      const na = normalize(alias);
      const hit =
        normHeaders.find((h) => h.norm === na) ||
        normHeaders.find((h) => h.norm.includes(na) && !usedHeaders.has(h.raw));
      if (hit && !usedHeaders.has(hit.raw)) {
        fieldToHeader.set(field, hit.raw);
        usedHeaders.add(hit.raw);
        break;
      }
    }
  });

  const mapping = [...fieldToHeader.entries()].map(([field, header]) => ({ field, header }));
  const unmappedHeaders = headers.filter((h) => !usedHeaders.has(h));
  const warnings: string[] = [];

  if (!fieldToHeader.has("full_name")) {
    warnings.push("Could not find a player-name column — check the file's headers.");
  }
  for (const grp of [
    { label: "fielding (catches/run-outs)", fields: ["catches", "run_outs"] as (keyof CleanPlayer)[] },
    { label: "keeping (stumpings)", fields: ["stumpings", "keeping_catches"] as (keyof CleanPlayer)[] },
  ]) {
    if (!grp.fields.some((f) => fieldToHeader.has(f))) {
      warnings.push(`No ${grp.label} columns detected — those ranks will be blank.`);
    }
  }

  const get = (row: Record<string, unknown>, field: keyof CleanPlayer): unknown => {
    const header = fieldToHeader.get(field);
    return header ? row[header] : null;
  };

  const players: CleanPlayer[] = [];
  for (const row of rows) {
    const name = get(row, "full_name");
    if (name == null || String(name).trim() === "") continue;

    const player = {} as CleanPlayer;
    player.full_name = String(name).trim();
    player.primary_role = strOrNull(get(row, "primary_role"));
    player.photo_url = strOrNull(get(row, "photo_url"));
    player.cricheroes_link = strOrNull(get(row, "cricheroes_link"));
    player.highest_score = strOrNull(get(row, "highest_score"));
    player.email = strOrNull(get(row, "email"));
    player.phone = cleanPhone(get(row, "phone"));

    const keeperRaw = get(row, "is_keeper");
    const roleStr = (player.primary_role ?? "").toLowerCase();
    player.is_keeper =
      truthy(keeperRaw) || roleStr.includes("keep") || roleStr.includes("wk");

    for (const field of NUMERIC_FIELDS) {
      (player[field] as number | null) = cleanNumber(get(row, field));
    }
    player.age = player.age != null ? Math.round(player.age) : null;

    // fat-finger guard: wickets can't exceed balls bowled
    const balls = oversToBalls(player.overs);
    if (player.wickets != null && balls != null && player.wickets > balls) {
      warnings.push(
        `${player.full_name}: wickets (${player.wickets}) exceed balls bowled (${balls}) — discarded.`
      );
      player.wickets = null;
    }

    players.push(player);
  }

  return { players, mapping, unmappedHeaders, warnings };
}

const strOrNull = (v: unknown): string | null => {
  if (v == null) return null;
  const s = String(v).trim();
  return s === "" ? null : s;
};

const truthy = (v: unknown): boolean => {
  if (v == null) return false;
  const s = String(v).trim().toLowerCase();
  return s === "true" || s === "yes" || s === "y" || s === "1";
};
