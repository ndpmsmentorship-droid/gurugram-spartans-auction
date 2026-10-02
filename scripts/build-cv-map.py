"""Map USCL pool names -> CricVideos (Ball Library) player names.

Library names are short or decorated ("Abhilash N", "Harchit Sanan (harry)",
"Vikas 10"); pool names are full ("Abhilash Nair"). Matching, in order, and
only when the answer is unique:
  1. exact name after lower-casing and dropping (...) and digits
  2. same first name + same surname initial ("abhilash n" ~ "abhilash nair")
  3. same words in any order ("Shergill Harinder" ~ "Harinder Shergill")
  4. first + last word, ignoring middle names ("Karamvir Lall" ~ "Karamvir Singh Lall")
  5. the same after evening out spelling (doubled letters, ee/i, oo/u, silent h:
     "Shubhendu" ~ "Subhendu", "Mahalawat" ~ "Mahlawat")
Writes src/data/cv-map.json: { poolName: { batter?: libName, bowler?: libName } }

  python3 scripts/build-cv-map.py <manifest.json> <uscl cards.json>
"""
import json, re, sys, os, collections

man = json.load(open(sys.argv[1]))
cards = json.load(open(sys.argv[2]))
# a plain list of names (from the database) or the USCL card scrape
pool = sorted(set(cards) if cards and isinstance(cards[0], str) else {c["text"].split("\n")[0].strip() for c in cards} | {"Kanishk Sheel", "Kuldeep Negi", "Gaurav Verma", "Nikhil Dhingra", "Prateek Suneja"})

def norm(n):
    n = re.sub(r"\(.*?\)", " ", n.lower())
    n = re.sub(r"[^a-z ]", " ", n)
    return " ".join(n.split())

lib = collections.defaultdict(dict)  # norm -> kind -> name
for p in man["players"]:
    lib[norm(p["name"])].setdefault(p["kind"], p["name"])

exact = {k: v for k, v in lib.items()}
def spell(w):
    w = re.sub(r"([a-z])\1+", r"\1", w)
    w = w.replace("ee", "i").replace("oo", "u").replace("ph", "f")
    w = re.sub(r"(?<=[bcdgkpst])h", "", w)
    return re.sub(r"a(?=[a-z])", "", w[:1]) + re.sub(r"a", "", w[1:])  # vowels 'a' are the loosest

def keys(k):
    w = k.split()
    yield "set", " ".join(sorted(w))
    if len(w) >= 2:
        yield "ends", " ".join(sorted([w[0], w[-1]]))
    yield "spell", " ".join(sorted(spell(x) for x in w))
    if len(w) >= 2:
        yield "spellends", " ".join(sorted([spell(w[0]), spell(w[-1])]))

loose = collections.defaultdict(set)  # (rule, key) -> lib norms
for k in lib:
    for rk in keys(k):
        loose[rk].add(k)

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
    if not hit:
        for rk in keys(k):
            c = loose.get(rk, set())
            if len(c) == 1:
                hit = lib[next(iter(c))]
                print(f"  loose {rk[0]:9} {name!r} -> {next(iter(c))!r}")
                break
    if hit:
        out[name] = hit
dst = os.path.join(os.path.dirname(__file__), "..", "src", "data", "cv-map.json")
json.dump(out, open(dst, "w"), indent=0, separators=(",", ":"))
print(f"{len(out)} of {len(pool)} USCL players have CricVideos clips")
print(list(out.items())[:12])
