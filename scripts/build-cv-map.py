"""Map USCL pool names -> CricVideos (Ball Library) player names.

Library names are short or decorated ("Abhilash N", "Harchit Sanan (harry)",
"Vikas 10"); pool names are full ("Abhilash Nair"). Matching, in order, and
only when the answer is unique:
  1. exact name after lower-casing and dropping (...) and digits
  2. same first name + same surname initial ("abhilash n" ~ "abhilash nair")
Writes src/data/cv-map.json: { poolName: { batter?: libName, bowler?: libName } }

  python3 scripts/build-cv-map.py <manifest.json> <uscl cards.json>
"""
import json, re, sys, os, collections

man = json.load(open(sys.argv[1]))
cards = json.load(open(sys.argv[2]))
pool = sorted({c["text"].split("\n")[0].strip() for c in cards} | {"Kanishk Sheel", "Kuldeep Negi", "Gaurav Verma", "Nikhil Dhingra", "Prateek Suneja"})

def norm(n):
    n = re.sub(r"\(.*?\)", " ", n.lower())
    n = re.sub(r"[^a-z ]", " ", n)
    return " ".join(n.split())

lib = collections.defaultdict(dict)  # norm -> kind -> name
for p in man["players"]:
    lib[norm(p["name"])].setdefault(p["kind"], p["name"])

exact = {k: v for k, v in lib.items()}
by_initial = collections.defaultdict(list)
for k in lib:
    w = k.split()
    if len(w) >= 2:
        by_initial[(w[0], w[-1][0])].append(k)

out = {}
for name in pool:
    k = norm(name)
    hit = exact.get(k)
    if not hit:
        w = k.split()
        if len(w) >= 2:
            cands = [c for c in by_initial.get((w[0], w[-1][0]), []) if len(c.split()[-1]) <= 2 or c.split()[-1] == w[-1]]
            if len(cands) == 1:
                hit = lib[cands[0]]
    if hit:
        out[name] = hit
dst = os.path.join(os.path.dirname(__file__), "..", "src", "data", "cv-map.json")
json.dump(out, open(dst, "w"), indent=0, separators=(",", ":"))
print(f"{len(out)} of {len(pool)} USCL players have CricVideos clips")
print(list(out.items())[:12])
