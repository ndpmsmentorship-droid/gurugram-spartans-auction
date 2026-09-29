// Player master import — the phone-number lookup behind /register.
//
// Reads any number of .xlsx/.csv files (every sheet), recognises columns by
// header name (fullName / Name / Player Name, phone / mobile / contact, …),
// normalises each mobile to its last 10 digits and merges rows across files by
// that number: the first non-empty value wins per field, and every season a
// player appears in is kept in `seasons`. Rows without a valid mobile are
// skipped and counted.
//
// DRY RUN by default (prints what it found). Add --write to upsert into
// player_master (on phone), which needs supabase/registration_schema.sql run.
//
//   node scripts/import-master.mts "Season 1.xlsx" "SARDA S6.xlsx" [--write]
//   A file can carry its season label: "SDLL S1=path/to/file.xlsx"
import * as fs from "node:fs";
import * as path from "node:path";
import { fileURLToPath } from "node:url";
import { createRequire } from "node:module";
import { createClient } from "@supabase/supabase-js";

const require = createRequire(import.meta.url);
const XLSX = require("xlsx");
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

const args = process.argv.slice(2);
const WRITE = args.includes("--write");
const inputs = args.filter((a) => a !== "--write");
if (!inputs.length) {
  console.error('Usage: node scripts/import-master.mts ["Season label="]file.xlsx … [--write]');
  process.exit(1);
}

function normalizePhone(raw: unknown): string | null {
  const d = String(raw ?? "").replace(/\D/g, "").slice(-10);
  return /^[6-9]\d{9}$/.test(d) ? d : null;
}
const str = (v: unknown) => {
  const s = v == null ? "" : String(v).trim();
  return s === "" || /^(na|n\/a|-|null)$/i.test(s) ? null : s;
};

// header text (lowercased, non-letters stripped) → our field
const FIELDS: [RegExp, keyof Rec][] = [
  [/^(fullname|name|playername|player)$/, "full_name"],
  [/^(phone|mobile|mobileno|mobilenumber|phonenumber|contact|contactnumber|whatsapp)$/, "phone"],
  [/^(email|emailid|mail)$/, "email"],
  [/^(dob|dateofbirth|birthdate)$/, "dob"],
  [/^(photo|photourl|image|picture)$/, "photo_url"],
  [/^(cricheroes|cricheroesprofile|cricheroeslink|cricheroesprofilelink)$/, "cricheroes_link"],
  [/^(linkedin|linkedinprofile|linkedinlink|linkedinprofilelink)$/, "linkedin_link"],
  [/^(role|primaryrole|playingas|playingrole|skill)$/, "primary_role"],
  [/^(battingstyle|batting|battinghand)$/, "batting_style"],
  [/^(bowlingstyle|bowling|bowlingtype|bowlingstyles)$/, "bowling_style"],
  [/^(team|teamname|lastteam|franchise|soldto|boughtbyteam)$/, "last_team"],
  [/^(category|auctioncategory)$/, "category"],
  [/^(isowner|owner)$/, "is_owner"],
  [/^(soldamount|soldprice)$/, "sold_amount"],
];

type Rec = {
  phone: string;
  full_name: string | null;
  email: string | null;
  dob: string | null;
  photo_url: string | null;
  cricheroes_link: string | null;
  linkedin_link: string | null;
  primary_role: string | null;
  batting_style: string | null;
  bowling_style: string | null;
  last_team: string | null;
  category: string | null;
  is_owner: boolean;
  sold_amount: number | null;
  stats: Record<string, string | number> | null;
  last_season: string | null;
  seasons: string[];
  source: string;
};

function toDate(v: unknown): string | null {
  if (v == null || v === "") return null;
  if (typeof v === "number") {
    const d = XLSX.SSF.parse_date_code(v);
    return d ? `${d.y}-${String(d.m).padStart(2, "0")}-${String(d.d).padStart(2, "0")}` : null;
  }
  const t = Date.parse(String(v));
  return Number.isFinite(t) ? new Date(t).toISOString().slice(0, 10) : null;
}

// Career numbers for the player card, keyed by normalised header. SDLL's export
// says "Runs"/"Strike Rate"; the SARDA sheet says "batting_runs"/"Batting SR".
const STATS: [RegExp, string][] = [
  [/^(battingmatches|matches)$/, "matches"],
  [/^(runs|battingruns)$/, "runs"],
  [/^(highestscore|highestruns)$/, "highest"],
  [/^(battingavg|battingaverage)$/, "bat_avg"],
  [/^(strikerate|battingsr)$/, "bat_sr"],
  [/^(fifties|s)$/, "fifties"],
  [/^(wickets)$/, "wickets"],
  [/^(economy)$/, "economy"],
  [/^(bowlingavg)$/, "bowl_avg"],
  [/^(bestbowling)$/, "best_bowling"],
  [/^(catches)$/, "catches"],
];
const num = (v: unknown) => {
  const n = Number(v);
  return v !== null && v !== "" && Number.isFinite(n) ? Math.round(n * 100) / 100 : null;
};

const merged = new Map<string, Rec>();
let skippedNoPhone = 0;

for (const input of inputs) {
  const eq = input.indexOf("=");
  const [label, file] = eq > 0 && !fs.existsSync(input) ? [input.slice(0, eq), input.slice(eq + 1)] : [null, input];
  const wb = XLSX.readFile(file);
  for (const sheetName of wb.SheetNames) {
    const rows: unknown[][] = XLSX.utils.sheet_to_json(wb.Sheets[sheetName], { header: 1, defval: null });
    // header row = first row with both a name-ish and a phone-ish column
    const hIdx = rows.findIndex((r) => {
      const keys = (r ?? []).map((c) => String(c ?? "").toLowerCase().replace(/[^a-z]/g, ""));
      const has = (f: string) => keys.some((k) => FIELDS.some(([re, fld]) => fld === f && re.test(k)));
      return has("full_name") && has("phone");
    });
    if (hIdx < 0) continue;
    const header = rows[hIdx].map((c) => String(c ?? "").toLowerCase().replace(/[^a-z]/g, ""));
    const col: Partial<Record<keyof Rec, number>> = {};
    header.forEach((h, i) => {
      const hit = FIELDS.find(([re]) => re.test(h));
      if (hit && col[hit[1]] === undefined) col[hit[1]] = i;
    });
    const statCol: [string, number][] = [];
    header.forEach((h, i) => {
      const hit = STATS.find(([re]) => re.test(h));
      if (hit && !statCol.some(([k]) => k === hit[1])) statCol.push([hit[1], i]);
    });
    const season = label ?? `${path.basename(file)} › ${sheetName}`;
    let n = 0;
    for (const r of rows.slice(hIdx + 1)) {
      const get = (f: keyof Rec) => (col[f] === undefined ? null : r[col[f]!]);
      const phone = normalizePhone(get("phone"));
      if (!phone) {
        if (str(get("full_name"))) skippedNoPhone++;
        continue;
      }
      n++;
      const incoming = {
        full_name: str(get("full_name")),
        email: str(get("email")),
        dob: toDate(get("dob")),
        photo_url: str(get("photo_url")),
        cricheroes_link: str(get("cricheroes_link")),
        linkedin_link: str(get("linkedin_link")),
        primary_role: str(get("primary_role")),
        batting_style: str(get("batting_style")),
        bowling_style: str(get("bowling_style")),
        last_team: str(get("last_team")),
        category: str(get("category")),
      };
      const stats: Record<string, string | number> = {};
      for (const [k, i] of statCol) {
        const v = k === "best_bowling" || k === "highest" ? str(r[i]) : num(r[i]);
        if (v !== null && v !== "") stats[k] = v;
      }
      const ownerRaw = get("is_owner");
      const isOwner = ownerRaw === true || /^(true|yes|y|1|owner)$/i.test(String(ownerRaw ?? ""));
      const cur = merged.get(phone);
      if (!cur) {
        merged.set(phone, {
          phone,
          ...incoming,
          is_owner: isOwner,
          sold_amount: num(get("sold_amount")),
          stats: Object.keys(stats).length ? stats : null,
          last_season: season,
          seasons: [season],
          source: path.basename(file),
        });
      } else {
        for (const [k, v] of Object.entries(incoming)) {
          if (v && !(cur as Record<string, unknown>)[k]) (cur as Record<string, unknown>)[k] = v;
        }
        if (!cur.seasons.includes(season)) cur.seasons.push(season);
        if (isOwner) cur.is_owner = true;
        cur.sold_amount ??= num(get("sold_amount"));
        if (!cur.stats && Object.keys(stats).length) cur.stats = stats;
      }
    }
    console.log(`  ${path.basename(file)} › ${sheetName}: ${n} rows with a valid mobile`);
  }
}

const recs = [...merged.values()].filter((r) => r.full_name);
const filled = (k: keyof Rec) => recs.filter((r) => r[k]).length;
console.log(
  `\n${recs.length} distinct players by mobile (${skippedNoPhone} named rows had no valid mobile).` +
    `\n  email ${filled("email")} · linkedin ${filled("linkedin_link")} · cricheroes ${filled("cricheroes_link")}` +
    ` · photo ${filled("photo_url")} · dob ${filled("dob")} · role ${filled("primary_role")} · team ${filled("last_team")}` +
    `\n  owners ${recs.filter((r) => r.is_owner).length} · category ${filled("category")} · stats ${filled("stats")}` +
    `\n  in 2+ seasons: ${recs.filter((r) => r.seasons.length > 1).length}`
);

if (!WRITE) {
  console.log("\nDry run. Re-run with --write to upsert into player_master.");
  process.exit(0);
}

const env: Record<string, string> = {};
for (const line of fs.readFileSync(path.join(ROOT, ".env.local"), "utf8").split("\n")) {
  const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
  if (m) env[m[1]] = m[2].replace(/^["']|["']$/g, "");
}
const sb = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });
// A player may already sit in the master WITHOUT a phone (added from the
// archive by enrich-master.mts). Give that row the number instead of creating
// a second copy of the same person.
const chId = (link: string | null) =>
  link?.match(/player-profile\/(\d+)/)?.[1] ?? link?.match(/\/(\d{4,})(?:\/|$)/)?.[1] ?? null;
const { data: phoneless } = await sb.from("player_master").select("id, cricheroes_link").is("phone", null).limit(20000);
const phonelessByCh = new Map<string, string>();
for (const r of phoneless ?? []) {
  const id = chId(r.cricheroes_link);
  if (id) phonelessByCh.set(id, r.id);
}
const { data: withPhone } = await sb.from("player_master").select("phone").not("phone", "is", null).limit(20000);
const known = new Set((withPhone ?? []).map((r: { phone: string }) => r.phone));
let claimed = 0;
for (const r of recs) {
  const rowId = !known.has(r.phone) && phonelessByCh.get(chId(r.cricheroes_link) ?? "");
  if (!rowId) continue;
  const { error } = await sb.from("player_master").update({ ...r, updated_at: new Date().toISOString() }).eq("id", rowId);
  if (error) throw new Error(`attach phone: ${error.message}`);
  known.add(r.phone);
  claimed++;
}
if (claimed) console.log(`  gave a phone to ${claimed} players already listed without one`);

for (let i = 0; i < recs.length; i += 200) {
  const batch = recs.slice(i, i + 200).map((r) => ({ ...r, updated_at: new Date().toISOString() }));
  const { error } = await sb.from("player_master").upsert(batch, { onConflict: "phone" });
  if (error) throw new Error(`upsert @${i}: ${error.message}`);
  console.log(`  upserted ${Math.min(i + 200, recs.length)}/${recs.length}`);
}
console.log("Done.");
