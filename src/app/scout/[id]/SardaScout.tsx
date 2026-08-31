"use client";
import { useEffect, useState } from "react";

// Ball-library scouting analysis (Sarda-only) surfaced on the auction profile.
// Data is fetched same-origin from the ball library on www.ndpms.in.
const BASE = "https://www.ndpms.in";

type Row = {
  player: string; league: string; season: string; bowl_type: string | null;
  b_matches: number | null; b_innings: number | null; b_runs: number | null; b_hs: number | null;
  b_avg: number | null; b_sr: number | null; b_50: number | null; b_100: number | null;
  b_4s: number | null; b_6s: number | null; b_notout: number | null; b_balls: number | null;
  o_innings: number | null; o_overs: number | null; o_wkts: number | null; o_runs: number | null;
  o_econ: number | null; o_avg: number | null; o_maidens: number | null;
  f_matches: number | null; f_catches: number | null; f_runouts: number | null;
  f_stumpings: number | null; f_dismissals: number | null;
};
type Dis = { name: string; pace: number; spin: number; unknown: number; total: number; list: { how: string; bowler: string; t: string }[] };

const nzp = (s: string) => (s || "").toLowerCase().replace(/\([^)]*\)/g, " ").replace(/[^a-z0-9]+/g, " ").trim();
const nf = (v: number | null | undefined) => (v == null ? "—" : v);
const seasonNum = (s: string) => { const m = (s || "").match(/(\d+)/); return m ? +m[1] : 0; };

type Agg = { key: string; name: string; runs: number; inns: number; balls: number; sixes: number; no: number; wkts: number; oballs: number; oruns: number; catches: number; dismissals: number; bt: string | null; bi?: number; oi?: number; fi?: number; propn?: number; rank?: number };

function aggregate(rows: Row[]): Agg[] {
  const by: Record<string, Agg> = {};
  for (const r of rows) {
    const k = nzp(r.player);
    const a = by[k] || (by[k] = { key: k, name: r.player, runs: 0, inns: 0, balls: 0, sixes: 0, no: 0, wkts: 0, oballs: 0, oruns: 0, catches: 0, dismissals: 0, bt: null });
    if (r.b_innings != null) { a.runs += r.b_runs || 0; a.inns += r.b_innings || 0; a.balls += r.b_balls || 0; a.sixes += r.b_6s || 0; a.no += r.b_notout || 0; }
    if (r.o_innings != null) { a.wkts += r.o_wkts || 0; a.oruns += r.o_runs || 0; const ov = r.o_overs || 0, f = Math.floor(ov); a.oballs += f * 6 + Math.round((ov - f) * 10); if (!a.bt && r.bowl_type) a.bt = r.bowl_type; }
    if (r.f_dismissals != null) { a.catches += r.f_catches || 0; a.dismissals += r.f_dismissals || 0; }
  }
  return Object.values(by);
}
function computeProp(all: Agg[]) {
  const norm = (list: Agg[], get: (a: Agg) => number, inv = false) => {
    if (!list.length) return () => 0;
    const vs = list.map(get), mn = Math.min(...vs), mx = Math.max(...vs), rng = mx - mn || 1;
    return (a: Agg) => (inv ? mx - get(a) : get(a) - mn) / rng * 100;
  };
  const bat = all.filter((a) => a.inns >= 3), bowl = all.filter((a) => a.oballs / 6 >= 8), fld = all.filter((a) => a.dismissals > 0);
  const nR = norm(bat, (a) => a.runs), nA = norm(bat, (a) => (a.inns - a.no > 0 ? a.runs / (a.inns - a.no) : a.runs)), nS = norm(bat, (a) => (a.balls ? a.runs / a.balls * 100 : 0)), nX = norm(bat, (a) => (a.inns ? a.sixes / a.inns : 0));
  const nW = norm(bowl, (a) => a.wkts), nE = norm(bowl, (a) => (a.oballs ? a.oruns * 6 / a.oballs : 0), true), nBA = norm(bowl, (a) => (a.wkts ? a.oruns / a.wkts : 999), true);
  const nF = norm(fld, (a) => a.dismissals);
  for (const a of all) {
    a.bi = a.inns >= 3 ? 0.35 * nR(a) + 0.30 * nA(a) + 0.25 * nS(a) + 0.10 * nX(a) : 0;
    a.oi = a.oballs / 6 >= 8 ? 0.45 * nW(a) + 0.35 * nE(a) + 0.20 * nBA(a) : 0;
    a.fi = a.dismissals > 0 ? nF(a) : 0;
    const hi = Math.max(a.bi, a.oi), lo = Math.min(a.bi, a.oi);
    (a as Agg & { prop: number }).prop = hi + 0.4 * lo + 0.15 * a.fi;
  }
  const mx = Math.max(...all.map((a) => (a as Agg & { prop: number }).prop)) || 1;
  all.forEach((a) => (a.propn = (a as Agg & { prop: number }).prop / mx * 100));
  all.sort((x, y) => (y.propn || 0) - (x.propn || 0));
  all.forEach((a, i) => (a.rank = i + 1));
  return all;
}
const propRole = (a: Agg) => (a.bi! > 0 && a.oi! > 0 && Math.min(a.bi!, a.oi!) >= 30 ? "All-rounder" : a.bi! >= a.oi! ? "Batter" : "Bowler");

export default function SardaScout({ playerName }: { playerName: string }) {
  const [rows, setRows] = useState<Row[] | null>(null);
  const [pool, setPool] = useState<Agg[]>([]);
  const [dis, setDis] = useState<Dis | null>(null);
  const [err, setErr] = useState(false);

  useEffect(() => {
    const key = nzp(playerName);
    Promise.all([
      fetch(`${BASE}/api/spartans/stats`).then((r) => r.json()),
      fetch(`${BASE}/spartans/dismissals.json`).then((r) => r.json()).catch(() => ({})),
    ]).then(([sj, dj]) => {
      const all: Row[] = sj.rows || [];
      setRows(all.filter((r) => nzp(r.player) === key));
      setPool(computeProp(aggregate(all)));
      setDis((dj as Record<string, Dis>)[key] || null);
    }).catch(() => setErr(true));
  }, [playerName]);

  if (err || rows == null) return null;
  if (!rows.length && !dis) return null;

  const bat = rows.filter((r) => r.b_innings != null).sort((a, b) => seasonNum(b.season) - seasonNum(a.season));
  const bowl = rows.filter((r) => r.o_innings != null).sort((a, b) => seasonNum(b.season) - seasonNum(a.season));
  const fld = rows.filter((r) => r.f_dismissals != null).sort((a, b) => seasonNum(b.season) - seasonNum(a.season));
  const pr = pool.find((a) => a.key === nzp(playerName));

  const Bar = ({ label, v }: { label: string; v: number }) => (
    <div className="flex items-center gap-2.5 text-[0.78rem]">
      <span className="w-16 text-muted">{label}</span>
      <div className="h-[7px] flex-1 overflow-hidden rounded bg-white/[0.06]">
        <i className="block h-full" style={{ width: `${Math.round(v)}%`, background: "linear-gradient(90deg,var(--red-deep),var(--gold,#e3b44a))" }} />
      </div>
      <b className="w-6 text-right font-mono text-ink">{Math.round(v)}</b>
    </div>
  );
  const th = "px-2 py-1 text-right text-[0.62rem] font-semibold uppercase tracking-wider text-muted border-b border-line first:text-left";
  const td = "px-2 py-1.5 text-right text-[0.8rem] tabular-nums border-b border-line/40 first:text-left";

  return (
    <section className="card">
      <div className="flex items-center justify-between gap-2 border-b border-line pb-3">
        <h2 className="font-display text-[0.938rem] tracking-[0.16em]">SARDA SCOUT · BALL LIBRARY</h2>
        <span className="badge" style={{ background: "color-mix(in srgb, var(--gold,#e3b44a) 18%, transparent)", color: "var(--accent-text)" }}>S2–S5</span>
      </div>

      {pr && (
        <div className="mt-4 flex flex-col gap-3 border-b border-line pb-4">
          <div className="flex items-center gap-4">
            <div className="font-display text-[2.4rem] leading-none" style={{ color: "var(--gold,#e3b44a)" }}>{Math.round(pr.propn || 0)}<span className="text-[0.9rem] text-muted">/100</span></div>
            <div>
              <div className="font-mono text-[0.85rem] font-bold text-ink">Prop Rank #{pr.rank} of {pool.length}</div>
              <div className="text-[0.72rem] uppercase tracking-wide text-muted">{propRole(pr)}</div>
            </div>
          </div>
          <div className="flex flex-col gap-2">
            <Bar label="Batting" v={pr.bi || 0} /><Bar label="Bowling" v={pr.oi || 0} /><Bar label="Fielding" v={pr.fi || 0} />
          </div>
        </div>
      )}

      {bat.length > 0 && (
        <div className="mt-4"><h3 className="mb-2 font-display text-[0.78rem] uppercase tracking-wider" style={{ color: "var(--gold,#e3b44a)" }}>Batting — by season</h3>
          <div className="overflow-x-auto"><table className="w-full border-collapse"><thead><tr><th className={th}>Season</th><th className={th}>M</th><th className={th}>Inn</th><th className={th}>Runs</th><th className={th}>Avg</th><th className={th}>SR</th><th className={th}>50/100</th><th className={th}>4s</th><th className={th}>6s</th></tr></thead>
          <tbody>{bat.map((r) => <tr key={r.season}><td className={td}>{r.season}</td><td className={td}>{nf(r.b_matches)}</td><td className={td}>{nf(r.b_innings)}</td><td className={`${td} font-bold text-ink`}>{nf(r.b_runs)}</td><td className={td}>{nf(r.b_avg)}</td><td className={td}>{nf(r.b_sr)}</td><td className={td}>{nf(r.b_50)}/{nf(r.b_100)}</td><td className={td}>{nf(r.b_4s)}</td><td className={td}>{nf(r.b_6s)}</td></tr>)}</tbody></table></div>
        </div>
      )}
      {bowl.length > 0 && (
        <div className="mt-4"><h3 className="mb-2 font-display text-[0.78rem] uppercase tracking-wider" style={{ color: "var(--gold,#e3b44a)" }}>Bowling — by season</h3>
          <div className="overflow-x-auto"><table className="w-full border-collapse"><thead><tr><th className={th}>Season</th><th className={`${th} !text-left`}>Type</th><th className={th}>Ov</th><th className={th}>Wkts</th><th className={th}>Econ</th><th className={th}>Avg</th></tr></thead>
          <tbody>{bowl.map((r) => <tr key={r.season}><td className={td}>{r.season}</td><td className={`${td} !text-left capitalize`}>{r.bowl_type || "—"}</td><td className={td}>{nf(r.o_overs)}</td><td className={`${td} font-bold text-ink`}>{nf(r.o_wkts)}</td><td className={td}>{nf(r.o_econ)}</td><td className={td}>{nf(r.o_avg)}</td></tr>)}</tbody></table></div>
        </div>
      )}
      {fld.length > 0 && (
        <div className="mt-4"><h3 className="mb-2 font-display text-[0.78rem] uppercase tracking-wider" style={{ color: "var(--gold,#e3b44a)" }}>Fielding — by season</h3>
          <div className="overflow-x-auto"><table className="w-full border-collapse"><thead><tr><th className={th}>Season</th><th className={th}>M</th><th className={th}>Catches</th><th className={th}>Run-outs</th><th className={th}>Stumps</th><th className={th}>Total</th></tr></thead>
          <tbody>{fld.map((r) => <tr key={r.season}><td className={td}>{r.season}</td><td className={td}>{nf(r.f_matches)}</td><td className={`${td} font-bold text-ink`}>{nf(r.f_catches)}</td><td className={td}>{nf(r.f_runouts)}</td><td className={td}>{nf(r.f_stumpings)}</td><td className={td}>{nf(r.f_dismissals)}</td></tr>)}</tbody></table></div>
        </div>
      )}
      {dis && (dis.pace || dis.spin) && (() => {
        const tot = dis.pace + dis.spin, pp = Math.round(dis.pace / tot * 100), sp = 100 - pp;
        const mm: Record<string, Record<string, number>> = { pace: {}, spin: {} };
        (dis.list || []).forEach((e) => { if (mm[e.t]) mm[e.t][e.how] = (mm[e.t][e.how] || 0) + 1; });
        const md = (o: Record<string, number>) => { const ks = Object.keys(o); return ks.length ? ks.sort((a, b) => o[b] - o[a]).map((k) => `${o[k]} ${k}`).join(" · ") : "—"; };
        return (
          <div className="mt-4 border-t border-line pt-4">
            <h3 className="mb-2 font-display text-[0.78rem] uppercase tracking-wider" style={{ color: "var(--gold,#e3b44a)" }}>How they get out — pace vs spin</h3>
            <div className="flex h-6 overflow-hidden rounded border border-line text-[0.7rem] font-bold">
              {pp > 0 && <span className="flex items-center justify-center text-white" style={{ width: `${pp}%`, background: "linear-gradient(var(--red-deep),#c63f36)" }}>{dis.pace} pace</span>}
              {sp > 0 && <span className="flex items-center justify-center" style={{ width: `${sp}%`, background: "linear-gradient(var(--gold,#e3b44a),#b8891f)", color: "#241203" }}>{dis.spin} spin</span>}
            </div>
            <div className="mt-2 flex flex-col gap-1 text-[0.78rem] text-muted">
              <div><span className="mr-2 inline-block w-10 rounded text-center text-[0.6rem] font-bold" style={{ background: "rgba(227,180,74,.16)", color: "var(--gold,#e3b44a)" }}>SPIN</span>{md(mm.spin)}</div>
              <div><span className="mr-2 inline-block w-10 rounded text-center text-[0.6rem] font-bold" style={{ background: "rgba(240,101,90,.16)", color: "var(--red-deep,#f0655a)" }}>PACE</span>{md(mm.pace)}</div>
            </div>
          </div>
        );
      })()}
      <div className="mt-3 text-[0.66rem] text-faint">Sarda tournament figures + pace/spin dismissals from the Spartans ball library. Updates as more matches are tagged.</div>
    </section>
  );
}
