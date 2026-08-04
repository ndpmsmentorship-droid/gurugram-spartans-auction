// Non-destructive rebuild of scout_players from the ORGANIZERS' official
// registration spreadsheet (the "SSCL6 Registrations …4th Aug.xlsx" export),
// which carries two things the Anantinity API never did: batting handedness
// (battingStyle → LHB/RHB) and precise bowling style (bowlingStyles). Manual
// curation — marquee picks, category overrides, mock buys, scouting notes —
// is carried over (matched by CricHeroes profile id, else normalized name),
// and the whole pool is snapshotted to a backup file before anything changes.
//
//   node --experimental-strip-types --env-file=.env.local \
//     scripts/import-official-file.mjs "<path-to.xlsx>"
//
// Env: NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY
// Sheet: the players sheet is auto-detected (most rows / has a "fullName" col).

import { writeFileSync, readFileSync } from "node:fs";
import XLSX from "xlsx"; // CJS default export (has readFile/utils) under Node ESM
import { createClient } from "@supabase/supabase-js";
import { computeIndices } from "../src/lib/scout/rankings.ts";
import { mapPlayer, toRaw } from "./sarda-map.mjs";

const filePath = process.argv[2];
if (!filePath) {
  console.error('Usage: node scripts/import-official-file.mjs "<path-to.xlsx>"');
  process.exit(1);
}
if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
  throw new Error("Set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY.");
}

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { persistSession: false } }
);

// curation that must survive a rebuild
const PRESERVE_FIELDS = [
  "is_marquee",
  "scout_category",
  "is_bought",
  "bought_price",
  "suggested_batting_order",
  "utility_tag",
  "scouting_clip_url",
  "scouting_note",
];

const croId = (link) => {
  if (!link) return null;
  const m = String(link).match(/player-profile\/(\d+)/);
  return m ? m[1] : null;
};
const nameKey = (name) => (name || "").trim().toLowerCase().replace(/\s+/g, " ");
// Match on the CricHeroes id first (stable across name edits) but ALSO index by
// name, so curation still lands when a player's CricHeroes id changes between
// registration exports (which is what briefly dropped a marquee last refresh).
const croKey = (row) => {
  const id = croId(row.cricheroes_link);
  return id ? `cro:${id}` : null;
};

// "Right-hand bat" → "RHB", "Left-hand bat" → "LHB"
const battingHand = (v) => {
  const s = String(v ?? "").toLowerCase();
  if (s.includes("left")) return "LHB";
  if (s.includes("right")) return "RHB";
  return null;
};
// bowlingStyles is a JSON array string like ["Right-arm off-break"]; keep the
// real styles, drop the placeholder "Other", join if a player lists two.
const bowlingStyle = (v) => {
  if (v == null || v === "") return null;
  let arr = v;
  if (typeof v === "string") {
    try {
      arr = JSON.parse(v);
    } catch {
      arr = [v];
    }
  }
  if (!Array.isArray(arr)) arr = [arr];
  const styles = arr.map((s) => String(s).trim()).filter((s) => s && s !== "Other");
  return styles.length ? styles.join(", ") : null;
};

function pickPlayersSheet(wb) {
  let best = null;
  for (const name of wb.SheetNames) {
    const rows = XLSX.utils.sheet_to_json(wb.Sheets[name]);
    if (!rows.length) continue;
    const hasName = "fullName" in rows[0] || "Name" in rows[0];
    if (hasName && (!best || rows.length > best.rows.length)) best = { name, rows };
  }
  if (!best) throw new Error("No players sheet found (need a fullName/Name column).");
  return best;
}

async function main() {
  const wb = XLSX.readFile(filePath);
  const { name: sheetName, rows: raw } = pickPlayersSheet(wb);
  console.log(`Reading "${sheetName}" — ${raw.length} rows from ${filePath}`);

  // 1) snapshot current pool
  const { data: existing, error: exErr } = await supabase.from("scout_players").select("*");
  if (exErr) throw exErr;
  if ((existing || []).length > 0) {
    const backupPath = `pool-backup-${new Date().toISOString().replace(/[:.]/g, "-")}.json`;
    writeFileSync(backupPath, JSON.stringify(existing, null, 2));
    console.log(`Backed up ${existing.length} rows to ${backupPath}`);
  }
  // Index preserved curation by BOTH CricHeroes id and name, so a returning
  // player is matched even if one of those changed in the new export.
  const preserve = new Map();
  for (const e of existing || []) {
    const kept = {};
    for (const f of PRESERVE_FIELDS) if (e[f] != null) kept[f] = e[f];
    if (!Object.keys(kept).length) continue;
    const ck = croKey(e);
    if (ck) preserve.set(ck, kept);
    preserve.set(`name:${nameKey(e.full_name)}`, kept);
  }
  const lookupPreserved = (r) =>
    preserve.get(croKey(r)) || preserve.get(`name:${nameKey(r.full_name)}`) || null;
  const prevMarquee = (existing || []).filter((e) => e.is_marquee).length;
  const prevCat = (existing || []).filter((e) => e.scout_category).length;
  const prevBought = (existing || []).filter((e) => e.is_bought).length;
  console.log(
    `Existing pool: ${(existing || []).length} rows — preserving ${prevMarquee} marquee, ${prevCat} category, ${prevBought} bought.`
  );

  // Learn the table's real columns from the snapshot (PostgREST returns every
  // column, even when null) so we never send a key the schema lacks — a missing
  // column would otherwise fail the insert AFTER the delete and empty the pool.
  const tableCols = existing && existing.length ? new Set(Object.keys(existing[0])) : null;
  const filterToCols = (row) => {
    if (!tableCols) return row;
    const out = {};
    for (const k of Object.keys(row)) if (tableCols.has(k)) out[k] = row[k];
    return out;
  };

  // 2) map the file rows (mapPlayer reads the same column names the API used;
  // prefer the cleaner registration fields where the file has both)
  const rows = raw
    .map((p) => {
      const base = mapPlayer(p);
      const fullName = String(p.fullName || p.Name || base.full_name || "").trim();
      const chLink = p.cricHeroesProfile || p["Cric Heroes Profile"] || base.cricheroes_link || null;
      const photo = p.photoUrl || p["Player Image"] || base.photo_url || null;
      return {
        ...base,
        full_name: fullName,
        cricheroes_link: chLink,
        photo_url: photo,
        batting_style: battingHand(p.battingStyle),
        bowling_style: bowlingStyle(p.bowlingStyles),
        // organizers' auction tier (U35A / U35B / 35+A / 35+B) — official data,
        // refreshed straight from the file (not part of manual curation).
        auction_category: (() => {
          const c = String(p.category ?? "").trim().toUpperCase();
          return c || null;
        })(),
      };
    })
    .filter((r) => r.full_name);

  const idx = computeIndices(rows.map(toRaw));
  rows.forEach((r, i) => Object.assign(r, idx[i]));

  // 3) carry curation onto returning players (CricHeroes id, else name)
  let carried = 0;
  for (const r of rows) {
    const kept = lookupPreserved(r);
    if (kept && Object.keys(kept).length) {
      Object.assign(r, kept);
      carried++;
    }
  }
  console.log(`Carried curation onto ${carried} returning players.`);

  // 3b) overlay the committed lock manifest — marquee picks and mock buys the
  // owner has locked in are re-applied on every refresh (matched by CricHeroes
  // id, else name), so they can never be lost to a registration-list update.
  try {
    const lockUrl = new URL("./curation.lock.json", import.meta.url);
    const lock = JSON.parse(readFileSync(lockUrl, "utf8"));
    const byCro = new Map();
    const byName = new Map();
    for (const r of rows) {
      const ck = croKey(r);
      if (ck) byCro.set(ck, r);
      byName.set(nameKey(r.full_name), r);
    }
    let applied = 0;
    const missing = [];
    for (const L of lock.players || []) {
      const target = byCro.get(croKey(L)) || byName.get(nameKey(L.full_name));
      if (!target) {
        missing.push(L.full_name);
        continue;
      }
      if (L.is_marquee) target.is_marquee = true;
      if (L.is_bought) {
        target.is_bought = true;
        if (L.bought_price != null) target.bought_price = L.bought_price;
        if (L.suggested_batting_order != null)
          target.suggested_batting_order = L.suggested_batting_order;
      }
      if (L.scout_category != null) target.scout_category = L.scout_category;
      applied++;
    }
    console.log(
      `Lock: re-applied ${applied}/${(lock.players || []).length} locked players` +
        (missing.length ? ` — not in this file: ${missing.join(", ")}` : "")
    );
  } catch (e) {
    console.log(`Lock: skipped (${e.message})`);
  }

  const lhb = rows.filter((r) => r.batting_style === "LHB").length;
  const withBowl = rows.filter((r) => r.bowling_style).length;
  const tiers = rows.reduce((m, r) => ((m[r.auction_category || "—"] = (m[r.auction_category || "—"] || 0) + 1), m), {});
  console.log(`Handedness: ${lhb} LHB / ${rows.length - lhb} RHB-or-unknown; ${withBowl} with a bowling style.`);
  console.log(`Auction tiers: ${JSON.stringify(tiers)}`);

  // ensure NOT NULL booleans always have a value
  for (const r of rows) {
    if (r.is_bought == null) r.is_bought = false;
    if (r.is_rejected == null) r.is_rejected = false;
    if (r.is_marquee == null) r.is_marquee = false;
  }

  // 4) rebuild
  const { error: delErr } = await supabase
    .from("scout_players")
    .delete()
    .neq("id", "00000000-0000-0000-0000-000000000000");
  if (delErr) throw delErr;

  const payload = rows.map(filterToCols);
  const dropped = tableCols
    ? [...new Set(rows.flatMap((r) => Object.keys(r)))].filter((k) => !tableCols.has(k))
    : [];
  if (dropped.length) console.log(`Columns not in table (skipped): ${dropped.join(", ")}`);

  const CHUNK = 200;
  for (let i = 0; i < payload.length; i += CHUNK) {
    const { error } = await supabase.from("scout_players").insert(payload.slice(i, i + CHUNK));
    if (error) throw error;
  }
  console.log(`Done. Loaded ${payload.length} players from the official file; curation preserved.`);
}

main().catch((e) => {
  console.error(e.message || e);
  process.exit(1);
});
