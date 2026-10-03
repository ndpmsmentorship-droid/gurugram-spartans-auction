// Build the SDLL pool from every player captured so far (Nikhil, 4 Oct 2026):
// the SDLL registrations (kept exactly as they are) + the USCL Season 2 pool (league_pool_archive)
// + SARDA/SCCL Season 6 (sccl_s6_players). One row per person:
//   1. same CricHeroes profile number = same person
//   2. else same name (case/spacing-insensitive) AND ages within a year (or one age unknown)
//   two people who share a name but not an age (two Chetan Sharmas) stay two players
// New rows get a fresh id, no team/sale, and source_id "uscl:…" / "sccl:…" so they can be told
// apart (or removed: delete where source_id like 'pool:%'). Nothing existing is changed.
//
//   node scripts/sdll-pool-merge.mts           # dry run: counts and samples
//   node scripts/sdll-pool-merge.mts --apply
import * as fs from "node:fs";
import * as path from "node:path";
import { randomUUID } from "node:crypto";
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
const APPLY = process.argv.includes("--apply");
type Row = Record<string, unknown>;

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function all(table: string, q = (x: any) => x): Promise<Row[]> {
  const out: Row[] = [];
  for (let from = 0; ; from += 1000) {
    const { data, error } = await q(sb.from(table).select("*")).range(from, from + 999);
    if (error) throw new Error(`${table}: ${error.message}`);
    out.push(...data);
    if (data.length < 1000) return out;
  }
}

const { data: active } = await sb.from("seasons").select("name").eq("is_active", true).single();
if (!/Shanti Devi/i.test(active?.name ?? "")) throw new Error(`active season is "${active?.name}" — switch to SDLL first`);

const sdll = await all("scout_players");
const uscl = (await all("league_pool_archive", (x) => x.eq("league", "uscl"))).map((r) => r.row as Row);
const sccl = await all("sccl_s6_players");
const cols = new Set(Object.keys(sdll[0]));

const chId = (r: Row) => String(r.cricheroes_link ?? "").match(/player-profile\/(\d+)/)?.[1] ?? null;
const nm = (r: Row) => String(r.full_name ?? "").toLowerCase().replace(/\(.*?\)/g, " ").replace(/[^a-z ]/g, " ").replace(/\s+/g, " ").trim();
const age = (r: Row) => (typeof r.age === "number" ? r.age : null);

const kept: Row[] = [...sdll];
const byCh = new Map<string, Row>(), byName = new Map<string, Row[]>();
const index = (r: Row) => {
  const c = chId(r); if (c) byCh.set(c, r);
  const n = nm(r); if (n) byName.set(n, [...(byName.get(n) ?? []), r]);
};
sdll.forEach(index);
const same = (r: Row): Row | null => {
  const c = chId(r); if (c && byCh.has(c)) return byCh.get(c)!;
  for (const o of byName.get(nm(r)) ?? []) {
    const a = age(r), b = age(o);
    if (c && chId(o) && chId(o) !== c) continue;            // both have CricHeroes ids and they differ
    if (a == null || b == null || Math.abs(a - b) <= 1) return o;
  }
  return null;
};

const SALE = ["team_id", "sold_price", "acquired", "rtm_against", "squad_slot", "is_bought", "bought_price"];
const added: Row[] = [], dupes: Record<string, number> = { uscl: 0, sccl: 0 };
for (const [src, rows] of [["uscl", uscl], ["sccl", sccl]] as const) {
  for (const r of rows) {
    if (!String(r.full_name ?? "").trim()) continue;
    if (same(r)) { dupes[src]++; continue; }
    const row: Row = {};
    for (const [k, v] of Object.entries(r)) if (cols.has(k) && !SALE.includes(k)) row[k] = v;
    row.id = randomUUID();
    row.source_id = `pool:${src}:${String(r.source_id ?? r.id)}`;
    row.is_rejected = false;
    if (!row.auction_category) row.auction_category = row.scout_category ?? null;
    // SARDA categories → SDLL (the original stays in scout_category)
    const CAT: Record<string, string> = { "35+A": "A", U35A: "A", "35+B": "B", U35B: "B", Legend: "Special" };
    if (CAT[String(row.auction_category)]) row.auction_category = CAT[String(row.auction_category)];
    added.push(row); kept.push(row); index(row);
  }
}
console.log(`SDLL registrations: ${sdll.length}`);
console.log(`USCL pool: ${uscl.length} → ${uscl.length - dupes.uscl} new, ${dupes.uscl} already in`);
console.log(`SARDA S6: ${sccl.length} → ${sccl.length - dupes.sccl} new, ${dupes.sccl} already in`);
console.log(`POOL TOTAL: ${kept.length}`);
console.log("sample new:", added.slice(0, 6).map((r) => `${r.full_name} (${r.source_id})`).join(" · "));
if (!APPLY) { console.log("\nDry run. Re-run with --apply to write."); process.exit(0); }
for (let i = 0; i < added.length; i += 200) {
  const { error } = await sb.from("scout_players").insert(added.slice(i, i + 200));
  if (error) throw new Error(`insert ${i}: ${error.message}`);
}
const { count } = await sb.from("scout_players").select("*", { count: "exact", head: true });
console.log(`written. scout_players now ${count}`);
