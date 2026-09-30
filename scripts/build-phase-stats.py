"""Powerplay / death bowling from the Ball Library (CricVideos) ball logs.

Source: the LMS repo's public/spartans/manifest.json. Only matches whose log is
complete and trusted are used — >=110 bowler balls, >=90% with a real X.Y over
and known runs, and >=0.8 runs/ball (older marker files store 0 for "unknown",
which would make a bowler look impossibly cheap). Today that is 24 SARDA S6
matches + USCL Edition 1 semi-final and final, all rebuilt from the CricHeroes
AI commentary.

Writes src/data/phase-stats.json: { source, matches, bowlers: { name: {team,
pp:{balls,runs,wkts,econ}, death:{...}, mid:{...}} }, top: {pp:[names], death:[names]} }

  python3 scripts/build-phase-stats.py ~/Claude/strategies/ycwism-lms-src/public/spartans/manifest.json
"""
import json, re, sys, collections, os

man = json.load(open(sys.argv[1]))
bal, known, runs = collections.Counter(), collections.Counter(), collections.Counter()
for p in man["players"]:
    if p["kind"] != "bowler":
        continue
    for b in p["log"]:
        mid = b["mid"].split("-inn")[0]
        bal[mid] += 1
        if b.get("r") is not None and re.match(r"^\d+\.\d$", str(b.get("o") or "")):
            known[mid] += 1
            runs[mid] += b["r"]
full = sorted(k for k, v in bal.items() if v >= 110 and known[k] >= 0.9 * v and runs[k] / known[k] >= 0.8)

def phase(ov):
    return "pp" if ov < 6 else "death" if ov >= 15 else "mid"

agg = {}
for p in man["players"]:
    if p["kind"] != "bowler":
        continue
    a = agg.setdefault(p["name"], {"team": p.get("s6team") or p.get("team"), "pp": [0, 0, 0], "mid": [0, 0, 0], "death": [0, 0, 0], "matches": set()})
    for b in p["log"]:
        mid = b["mid"].split("-inn")[0]
        if mid not in full:
            continue
        mt = re.match(r"^(\d+)\.(\d)$", str(b.get("o") or ""))
        if not mt or b.get("r") is None:
            continue
        v = a[phase(int(mt.group(1)))]
        if not b.get("x"):
            v[0] += 1
        v[1] += b["r"]
        v[2] += 1 if b.get("w") else 0
        a["matches"].add(mid)

def fmt(v):
    return {"balls": v[0], "runs": v[1], "wkts": v[2], "econ": round(v[1] / v[0] * 6, 2) if v[0] else None}

out = {}
for n, a in agg.items():
    if not a["matches"]:
        continue
    out[n] = {"team": a["team"], "matches": len(a["matches"]), "pp": fmt(a["pp"]), "mid": fmt(a["mid"]), "death": fmt(a["death"])}

# Top 10 per phase: enough balls to mean something, ranked by economy, then wickets.
def top(k, minb):
    q = [n for n, s in out.items() if s[k]["balls"] >= minb]
    q.sort(key=lambda n: (out[n][k]["econ"], -out[n][k]["wkts"]))
    return q[:10]

res = {
    "source": "CricVideos ball logs — SARDA S6 + USCL Edition 1, rebuilt from CricHeroes AI commentary",
    "matches": len(full),
    "bowlers": out,
    "top": {"pp": top("pp", 18), "death": top("death", 12)},
}
dst = os.path.join(os.path.dirname(__file__), "..", "src", "data", "phase-stats.json")
json.dump(res, open(dst, "w"), indent=0, separators=(",", ":"))
print(f"{len(full)} matches · {len(out)} bowlers · top pp {res['top']['pp']} · top death {res['top']['death']}")
