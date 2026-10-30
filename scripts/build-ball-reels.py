#!/usr/bin/env python3
"""Ball Library highlights for the auction big screen.

Reads the library's OPEN manifest (the one non-members see, so the Spartans
lock holds) and keeps, per player, up to 10 YouTube-timed deliveries:
wickets and sixes first, then fours, then anything else. Writes
src/data/ball-reels.json keyed by a normalised name.

  python3 scripts/build-ball-reels.py [path/to/open/manifest.json]
"""
import json, re, sys
from pathlib import Path

SRC = Path(sys.argv[1] if len(sys.argv) > 1 else
           Path.home() / "Claude/strategies/ycwism-lms-src/public/spartans/open/manifest.json")
OUT = Path(__file__).resolve().parent.parent / "src/data/ball-reels.json"
CAP = 10
BEFORE, AFTER = 3, 4.5  # same window as the library's clip montage


def key(name):
    # Same rule as src/app/auction/reel/route.ts: drop "(nick)" and digits.
    return re.sub(r"[^a-z]", "", re.sub(r"\(.*?\)", "", name.lower()))


def rank(b):
    if b.get("w"): return 0
    if b.get("r") == 6: return 1
    if b.get("r") == 4: return 2
    return 3


def label(b, kind):
    if b.get("w"): what = "Wicket"
    elif b.get("r") == 6: what = "Six"
    elif b.get("r") == 4: what = "Four"
    else: what = "Batting" if kind == "batter" else "Bowling"
    return what


players = json.loads(SRC.read_text())["players"]
reels = {}
for p in players:
    matches = {m["mid"]: m for m in p["matches"]}
    balls = []
    for i, b in enumerate(p["log"]):
        m = matches.get(b["mid"])
        if b.get("t") is None or not m or not m.get("yt"):
            continue
        balls.append((rank(b), i, {
            "yt": m["yt"],
            "s": max(0, round(b["t"] - BEFORE, 1)),
            "e": round(b["t"] + AFTER, 1),
            "what": label(b, p["kind"]),
            "vs": m.get("opp") or b.get("opp") or "",
            "comp": m.get("comp") or "",
        }))
    if not balls:
        continue
    r = reels.setdefault(key(p["name"]), {"name": p["name"], "balls": []})
    r["balls"].extend(balls)

for r in reels.values():
    # Best first, but never more than CAP, and spread across bat + bowl cards.
    r["balls"] = [b for _, _, b in sorted(r["balls"], key=lambda x: (x[0], x[1]))[:CAP]]

OUT.write_text(json.dumps(reels, separators=(",", ":")))
print(f"{len(reels)} players, {sum(len(r['balls']) for r in reels.values())} clips -> {OUT} ({OUT.stat().st_size // 1024} KB)")
