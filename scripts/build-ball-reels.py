#!/usr/bin/env python3
"""Ball Library highlights for the auction big screen.

Reads the library's OPEN manifest (the one non-members see, so the Spartans
lock holds) and keeps, per player, up to 10 YouTube-timed deliveries:
a batter's sixes and fours, a bowler's wickets and dots. Writes
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


# Library cards filed under a CricHeroes handle instead of the player's name
# (checked against player_master's cricheroes_link).
ALIAS = {"@Vinny": "Vishal Dullu"}


def key(name):
    # Same rule as src/app/auction/reel/route.ts: drop "(nick)" and digits.
    return re.sub(r"[^a-z]", "", re.sub(r"\(.*?\)", "", name.lower()))


# Only the player's good moments: a batter's sixes and fours (never his
# dismissal), a bowler's wickets and dots (never the boundaries he conceded).
# None = leave the ball out.
def rank(b, kind):
    r, w = b.get("r"), b.get("w")
    if kind == "batter":
        if w: return None
        return {6: 0, 4: 1}.get(r, 3)
    if w: return 0
    if r in (4, 6): return None
    return 2 if r == 0 else 3


def label(b, kind):
    r = b.get("r")
    if kind == "batter":
        return {6: "Six", 4: "Four"}.get(r, "Batting")
    if b.get("w"): return "Wicket"
    return "Dot ball" if r == 0 else "Bowling"


players = json.loads(SRC.read_text())["players"]
reels = {}
for p in players:
    matches = {m["mid"]: m for m in p["matches"]}
    balls = []
    for i, b in enumerate(p["log"]):
        m = matches.get(b["mid"])
        rk = rank(b, p["kind"])
        if b.get("t") is None or not m or not m.get("yt") or rk is None:
            continue
        balls.append((rk, i, {
            "yt": m["yt"],
            "s": max(0, round(b["t"] - BEFORE, 1)),
            "e": round(b["t"] + AFTER, 1),
            "what": label(b, p["kind"]),
            "vs": m.get("opp") or b.get("opp") or "",
            "comp": m.get("comp") or "",
        }))
    if not balls:
        continue
    name = ALIAS.get(p["name"], p["name"])
    r = reels.setdefault(key(name), {"name": name, "balls": []})
    r["balls"].extend(balls)

for r in reels.values():
    # Best first, but never more than CAP, and spread across bat + bowl cards.
    r["balls"] = [b for _, _, b in sorted(r["balls"], key=lambda x: (x[0], x[1]))[:CAP]]

OUT.write_text(json.dumps(reels, separators=(",", ":")))
print(f"{len(reels)} players, {sum(len(r['balls']) for r in reels.values())} clips -> {OUT} ({OUT.stat().st_size // 1024} KB)")
