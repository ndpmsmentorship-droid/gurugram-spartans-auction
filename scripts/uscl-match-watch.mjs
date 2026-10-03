// Checker behind the War Room "Match with USCL" button. Runs on Nikhil's Mac.
//
//   U=<franchise email> P=<password> PY=<python with playwright+openpyxl> \
//     node scripts/uscl-match-watch.mjs
//
// Every 8 s it looks for a new request in the private `ops` bucket. On one it
// runs the read-only fetch (scripts/uscl-fetch.py) and the reconcile with
// --apply (safe fixes only — never --hide-gone, never the live lot, never another
// team's sale), then uploads the report for the War Room to show. The USCL
// password stays in this process's environment and is never written anywhere.
import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { createClient } from "@supabase/supabase-js";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const env = {};
for (const l of fs.readFileSync(path.join(ROOT, ".env.local"), "utf8").split("\n")) {
  const m = l.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
  if (m) env[m[1]] = m[2].replace(/^["']|["']$/g, "");
}
if (!process.env.U || !process.env.P) throw new Error("set U and P (USCL franchise login) in the environment");
const PY = process.env.PY || "python3";
const sb = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });
const ops = sb.storage.from("ops");
const OUT = process.env.OUT || "/tmp/uscl-official.json";

const getJson = async (p) => {
  const { data } = await ops.download(p);
  if (!data) return null;
  try { return JSON.parse(await data.text()); } catch { return null; }
};
const put = (p, obj) => ops.upload(p, JSON.stringify(obj), { upsert: true, contentType: "application/json" });

// "Section title (N):" lines → the ones that need attention, in plain words
const PLAIN = [
  [/^GONE from USCL pool/, (n) => `${n} sold on USCL but not recorded here — record team + price`],
  [/^SOLD\/assigned here but still AVAILABLE/, (n) => `${n} recorded here but still available on USCL`],
  [/^NEW on USCL/, (n) => `${n} new in the USCL pool (added)`],
  [/^Listed on USCL but hidden/, (n) => `${n} back in the USCL pool (un-hidden)`],
  [/^Category changed/, (n) => `${n} category change${n > 1 ? "s" : ""} (fixed)`],
  [/^Our squad: fix/, (n) => `${n} Spartans squad fix${n > 1 ? "es" : ""} (applied)`],
  [/^On USCL My Squad, missing/, (n) => `${n} on USCL My Squad but missing here`],
  [/^On our squad, not on USCL/, (n) => `${n} in our squad but not on USCL My Squad`],
  [/^Public franchise lists/, (n) => `${n} team-page difference${n > 1 ? "s" : ""}`],
];
function summarise(text) {
  const needs = [];
  for (const m of text.matchAll(/^(?:⚠ )?(.+?) \((\d+)\):/gm)) {
    const n = Number(m[2]);
    const rule = PLAIN.find(([re]) => re.test(m[1]));
    if (n > 0 && rule) needs.push(rule[1](n));
  }
  return needs.length ? needs.join(" · ") : "✓ In sync with USCL";
}

async function runMatch(requestedAt) {
  const at = () => new Date().toISOString();
  try {
    execFileSync(PY, [path.join(ROOT, "scripts/uscl-fetch.py"), OUT], { cwd: ROOT, env: process.env, stdio: "pipe", timeout: 240000 });
    const text = execFileSync("node", [path.join(ROOT, "scripts/uscl-reconcile.mts"), OUT, "--apply"], {
      cwd: ROOT, stdio: ["ignore", "pipe", "ignore"], timeout: 120000,
    }).toString();
    await put("uscl-match/report.json", { at: at(), ok: true, requestedAt, summary: summarise(text), text });
    console.log(`${at()} match done: ${summarise(text)}`);
  } catch (e) {
    const msg = String(e?.stderr || e?.message || e).split("\n").filter(Boolean).slice(-3).join(" ");
    await put("uscl-match/report.json", { at: at(), ok: false, requestedAt, summary: "Couldn't reach or read the USCL site — try again in a minute", text: msg });
    console.log(`${at()} match FAILED: ${msg}`);
  }
}

let lastBeat = 0;
console.log("USCL match checker running — waiting for the War Room button");
for (;;) {
  try {
    if (Date.now() - lastBeat > 30000) { await put("uscl-match/heartbeat.json", { at: new Date().toISOString() }); lastBeat = Date.now(); }
    let req = await getJson("uscl-match/request.json");
    const rep = await getJson("uscl-match/report.json");
    // auction hours (3–11 pm IST): run by itself every 15 min as well
    const ist = new Date(Date.now() + 5.5 * 3600e3), h = ist.getUTCHours();
    if (h >= 15 && h < 23 && (!rep?.at || Date.now() - Date.parse(rep.at) > 15 * 60e3) && req?.requestedAt === rep?.requestedAt) {
      req = { requestedAt: new Date().toISOString() };
      await put("uscl-match/request.json", req);
    }
    if (req?.requestedAt && req.requestedAt !== rep?.requestedAt) {
      console.log(`${new Date().toISOString()} request ${req.requestedAt}`);
      await put("uscl-match/report.json", { ...(rep ?? {}), requestedAt: rep?.requestedAt, running: req.requestedAt });
      await runMatch(req.requestedAt);
    }
  } catch (e) {
    console.log("watch error:", e?.message || e);
  }
  await new Promise((r) => setTimeout(r, 8000));
}
