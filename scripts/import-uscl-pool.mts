// Add the USCL Season 2 player pool to player_master so those players can find
// themselves by name on /register. Input is the card dump taken from the USCL
// franchise portal (Gurugram Spartans login, read-only): an array of
// { text, ch, img } per player card. No phone numbers exist in that source.
//
// Matching (same rules as enrich-master.mts): numeric CricHeroes id first, then
// the exact lower-cased full name — but only for names of two or more words,
// so a bare "Amit" never lands on the wrong Amit. Existing values are never
// overwritten; matched rows only gain gaps and the "USCL S2 pool" season tag.
// Photos are copied into our public player-photos bucket (uscl/…) rather than
// hot-linked from their storage. USCL categories are NOT written to
// player_master.category (A+/A would read as SDLL auction categories).
//
//   node scripts/import-uscl-pool.mts <cards.json>            # dry run
//   node scripts/import-uscl-pool.mts <cards.json> --write
import * as fs from "node:fs";
import * as path from "node:path";
import { fileURLToPath } from "node:url";
import { createClient } from "@supabase/supabase-js";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const env: Record<string, string> = {};
for (const l of fs.readFileSync(path.join(ROOT, ".env.local"), "utf8").split("\n")) {
  const m = l.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
  if (m) env[m[1]] = m[2].replace(/^["']|["']$/g, "");
}
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const sb: any = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });

const [file, flag] = process.argv.slice(2);
const WRITE = flag === "--write";
const SEASON = "USCL S2 pool";
const PHOTOS = "player-photos";

const chId = (link: string | null) =>
  link?.match(/player-profile\/(\d+)/)?.[1] ?? link?.match(/\/(\d{4,})(?:\/|$)/)?.[1] ?? null;
const nameKey = (n: string | null) => (n ?? "").toLowerCase().replace(/\s+/g, " ").trim();

const BAT: Record<string, string> = { "Left Hand Batsman": "Left-hand bat", "Right Hand Batsman": "Right-hand bat" };
const BOWL: Record<string, string> = {
  "Left Arm Pacer": "Left-arm medium",
  "Left Arm Spinner": "Left-arm orthodox",
  "Right Arm Pacer": "Right-arm medium",
  "Right Arm Spin": "Right-arm off-break",
};
const STAT: Record<string, string> = {
  M: "matches", Runs: "runs", Avg: "bat_avg", SR: "bat_sr", Wkts: "wickets", "Bowl SR": "bowl_sr", Econ: "economy",
};

type Card = { text: string; ch: string | null; img: string | null };
type Row = {
  full_name: string; age: number | null; uscl_category: string | null; cricheroes_link: string | null;
  photo_src: string | null; batting_style: string | null; bowling_style: string | null;
  primary_role: string | null; stats: Record<string, number> | null;
};

function parse(c: Card): Row {
  const lines = c.text.split("\n").map((s) => s.trim()).filter(Boolean);
  const name = lines[0].replace(/\s+/g, " ");
  const cat = lines.find((l) => /^(CATEGORY|LEGEND)/.test(l)) ?? null;
  const ageLine = lines.find((l) => /^\d+ YRS$/.test(l));
  const tags = lines.slice(1, lines.indexOf("Wishlist") > 0 ? lines.indexOf("Wishlist") : undefined)
    .filter((l) => l !== cat && l !== ageLine);
  const stats: Record<string, number> = {};
  for (const l of lines) {
    const m = l.match(/^(M|Runs|Avg|SR|Wkts|Bowl SR|Econ) (.+)$/);
    if (!m) continue;
    const v = m[2].trim();
    // Self-reported: skip ranges ("10-15"), "Na", "32 03" and anything not a plain number.
    if (/^\d+(\.\d+)?$/.test(v)) stats[STAT[m[1]]] = Number(v);
  }
  if (stats.economy > 15) delete stats.economy; // "25.06", "21" are typos, not economies
  const allround = tags.some((t) => /All Rounder/.test(t));
  const keeper = tags.some((t) => /Keeper/.test(t));
  const bowl = tags.find((t) => BOWL[t]);
  const bat = tags.find((t) => BAT[t]);
  const role = allround ? "All-Rounder" : keeper ? "Wicket-Keeper" : bowl && !bat ? "Bowler" : bat ? "Batsman" : null;
  let photo: string | null = null;
  if (c.img) {
    try {
      const u = new URL(c.img);
      photo = u.searchParams.get("url") ?? c.img;
    } catch {}
  }
  return {
    full_name: name,
    age: ageLine ? Number(ageLine.split(" ")[0]) : null,
    uscl_category: cat ? cat.replace("CATEGORY ", "") : null,
    cricheroes_link: c.ch ? c.ch.replace(/\/(stats|matches|profile)\/?$/, "") : null,
    photo_src: photo,
    batting_style: bat ? BAT[bat] : null,
    bowling_style: bowl ? BOWL[bowl] : null,
    primary_role: role,
    stats: Object.keys(stats).length ? stats : null,
  };
}

async function copyPhoto(src: string): Promise<string | null> {
  try {
    const res = await fetch(src);
    if (!res.ok) return null;
    const type = res.headers.get("content-type") ?? "image/jpeg";
    if (!type.startsWith("image/")) return null;
    const name = src.split("/").pop()!.split("?")[0];
    const dest = `uscl/${name}`;
    const { error } = await sb.storage.from(PHOTOS).upload(dest, Buffer.from(await res.arrayBuffer()), { upsert: true, contentType: type });
    if (error) return null;
    return sb.storage.from(PHOTOS).getPublicUrl(dest).data.publicUrl;
  } catch {
    return null;
  }
}

const rows = (JSON.parse(fs.readFileSync(file, "utf8")) as Card[]).map(parse);
console.log(`${rows.length} USCL cards parsed`);

const { data: master, error } = await sb.from("player_master").select("*").limit(20000);
if (error) throw new Error(error.message);
const byCh = new Map<string, Record<string, unknown>>();
const nameCount = new Map<string, number>();
for (const m of master) nameCount.set(nameKey(m.full_name), (nameCount.get(nameKey(m.full_name)) ?? 0) + 1);
const byName = new Map<string, Record<string, unknown>>();
for (const m of master) {
  const id = chId(m.cricheroes_link);
  if (id) byCh.set(id, m);
  if (nameCount.get(nameKey(m.full_name)) === 1) byName.set(nameKey(m.full_name), m);
}

let matched = 0, filled = 0;
const inserts: Record<string, unknown>[] = [];
const seenNew = new Set<string>();
for (const r of rows) {
  const id = chId(r.cricheroes_link);
  const multiWord = r.full_name.trim().split(/\s+/).length >= 2;
  const m = (id && byCh.get(id)) || (multiWord ? byName.get(nameKey(r.full_name)) : undefined);
  if (m) {
    matched++;
    const patch: Record<string, unknown> = {};
    for (const k of ["cricheroes_link", "batting_style", "bowling_style", "primary_role", "stats"] as const) {
      if (!m[k] && r[k]) patch[k] = r[k];
    }
    const seasons = (m.seasons as string[]) ?? [];
    if (!seasons.includes(SEASON)) patch.seasons = [...seasons, SEASON];
    if (!m.photo_url && r.photo_src && WRITE) {
      const url = await copyPhoto(r.photo_src);
      if (url) patch.photo_url = url;
    }
    if (Object.keys(patch).length) {
      filled++;
      if (WRITE) {
        const { error: e } = await sb.from("player_master").update({ ...patch, updated_at: new Date().toISOString() }).eq("id", m.id);
        if (e) throw new Error(e.message);
      }
    }
    continue;
  }
  const key = id ?? `name:${nameKey(r.full_name)}:${r.age}`;
  if (seenNew.has(key)) continue;
  seenNew.add(key);
  inserts.push({
    phone: null,
    full_name: r.full_name,
    photo_url: r.photo_src, // replaced by our copy on --write
    cricheroes_link: r.cricheroes_link,
    primary_role: r.primary_role,
    batting_style: r.batting_style,
    bowling_style: r.bowling_style,
    last_team: null,
    last_season: SEASON,
    seasons: [SEASON],
    stats: r.stats,
    source: "USCL S2 franchise portal",
  });
}

console.log(`matched existing: ${matched} (${filled} gained data) · new: ${inserts.length}`);
if (!WRITE) {
  console.log("dry run — sample new rows:", JSON.stringify(inserts.slice(0, 3), null, 1));
  process.exit(0);
}

let copied = 0;
for (const r of inserts) {
  const src = r.photo_url as string | null;
  r.photo_url = src ? await copyPhoto(src) : null;
  if (r.photo_url) copied++;
}
for (let i = 0; i < inserts.length; i += 100) {
  const { error: e } = await sb.from("player_master").insert(inserts.slice(i, i + 100));
  if (e) throw new Error(`insert @${i}: ${e.message}`);
}
const { count } = await sb.from("player_master").select("*", { count: "exact", head: true });
console.log(`inserted ${inserts.length} (${copied} photos copied) · master now ${count}`);
