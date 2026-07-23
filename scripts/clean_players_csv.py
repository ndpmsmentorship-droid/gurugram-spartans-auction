#!/usr/bin/env python3
"""
Clean a CricHeroes-exported player registration CSV (e.g. "Spartans - Season 4.csv")
into a JSON file ready for scripts/seed-players.mjs to load into Supabase.

Known data-quality issues this handles (found in the Season 4 export):
  - thousands-separator commas in numeric fields (e.g. overs: "1,344.00")
  - phone numbers Excel mangled into scientific notation (e.g. "9.20E+11")
  - stray text ("profile cases pending") sitting in numeric bowling columns
  - fat-finger outliers (wickets exceeding balls actually bowled)

Usage:
  python3 scripts/clean_players_csv.py "/path/to/Spartans - Season 4.csv" scripts/cleaned_players.json
"""

import csv
import json
import re
import sys

NUMERIC_JUNK_RE = re.compile(r"^-?[0-9]*\.?[0-9]+$")


def clean_number(raw):
    """Return a float, or None if the value is missing/unparseable junk."""
    if raw is None:
        return None
    value = raw.strip().replace(",", "")
    if value == "" or not NUMERIC_JUNK_RE.match(value):
        return None
    return float(value)


def clean_phone(raw):
    """Best-effort digits-only phone number. Scientific-notation values from
    Excel already lost precision upstream — this recovers what it can but
    flags the row so an admin can re-collect the real number if it matters."""
    if not raw:
        return None, False
    raw = raw.strip()
    if "E+" in raw.upper():
        try:
            digits = str(int(float(raw)))
            return digits, True  # flagged: lossy conversion
        except ValueError:
            return None, True
    digits = re.sub(r"\D", "", raw)
    return (digits or None), False


def overs_to_balls(overs):
    """Cricket overs notation X.Y = X overs + Y balls (Y is 0-5, not decimal)."""
    if overs is None:
        return None
    whole = int(overs)
    balls_part = round((overs - whole) * 10)
    if balls_part > 5:
        return None  # malformed overs value, can't trust it
    return whole * 6 + balls_part


def clean_row(row, flags):
    full_name = row["FULL NAME"].strip()
    phone, phone_flagged = clean_phone(row.get("CONTACT NUMBER"))
    if phone_flagged:
        flags.append(f"{full_name}: phone recovered from scientific notation, verify with player")

    wickets = clean_number(row.get("Wickets"))
    overs = clean_number(row.get("overs"))
    balls = overs_to_balls(overs)
    if wickets is not None and balls is not None and wickets > balls:
        flags.append(f"{full_name}: wickets ({wickets:g}) exceeds balls bowled ({balls}) - discarded")
        wickets = None

    return {
        "full_name": full_name,
        "age": int(clean_number(row.get("Age"))) if clean_number(row.get("Age")) is not None else None,
        "email": row.get("E MAIL ID", "").strip() or None,
        "phone": phone,
        "linkedin_link": row.get("PLEASE SHARE YOUR UPDATED LINKEDIN PROFILE LINK", "").strip() or None,
        "cricheroes_link": row.get(
            "PLEASE ADD RECENT UPDATED CRIC HEROS PROFILE LINK WITH LATEST PROFILE PHOTO", ""
        ).strip() or None,
        "photo_url": row.get("Player Image", "").strip() or None,
        "primary_role": row.get(
            "Please state your Cricketing skills (Keeper batsman/Fast Bowler/Spinner/All Rounder/ Pure Batsman)", ""
        ).strip() or None,
        "stats": {
            "batting_matches": clean_number(row.get("batting_matches")),
            "batting_innings": clean_number(row.get("batting_innings")),
            "batting_runs": clean_number(row.get("batting_runs")),
            "highest_score": row.get("highest_runs", "").strip() or None,
            "batting_avg": clean_number(row.get("Batting Avg")),
            "batting_sr": clean_number(row.get("Batting SR")),
            "fifties": clean_number(row.get("50s")),
            "hundreds": clean_number(row.get("100s")),
            "bowling_matches": clean_number(row.get("bowling_matches")),
            "overs": overs,
            "wickets": wickets,
            "best_bowling": row.get("Best Bowling", "").strip() or None,
            "economy": clean_number(row.get("Economy")),
            "bowling_avg": clean_number(row.get("bowling_avg")),
            "bowling_sr": clean_number(row.get("bowling_sr")),
            "five_wickets": clean_number(row.get("5_wickets")),
        },
    }


def main():
    if len(sys.argv) != 3:
        print(__doc__)
        sys.exit(1)

    src_path, out_path = sys.argv[1], sys.argv[2]
    flags = []

    with open(src_path, newline="", encoding="utf-8-sig") as f:
        reader = csv.DictReader(f)
        players = [clean_row(row, flags) for row in reader if row.get("FULL NAME", "").strip()]

    with open(out_path, "w", encoding="utf-8") as f:
        json.dump(players, f, indent=2)

    print(f"Cleaned {len(players)} players -> {out_path}")
    if flags:
        print(f"\n{len(flags)} rows flagged for manual review:")
        for flag in flags:
            print(f"  - {flag}")


if __name__ == "__main__":
    main()
