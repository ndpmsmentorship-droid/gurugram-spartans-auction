# Handoff — Shanti Devi Legend League Auction App

_Local Claude memory does not transfer across machines — this file is the source of truth. Last updated 2026-08-14._

## What this is
Next.js 16 app, now the **Shanti Devi Legend's League (SDLL) Season 2** live-auction site — rebranded and
cut over from the finished SARDA Corporate Cricket League (SCCL) Season 6 on **2026-08-14**, and **LIVE in
production** the same day. Deployed on Vercel; served at **https://www.ndpms.in/spartansscout** via a rewrite
in the LMS repo (`ycwism-lms` `next.config.ts`). `basePath: "/spartansscout"`.
Repo: `ndpmsmentorship-droid/gurugram-spartans-auction`.

## ⚠️ SDLL CUTOVER — read before touching data (2026-08-14)
- **The DB was migrated in place** (Supabase project `hlouwxtyotrmlehaxgav`, migration in `supabase/sdll_migration.sql`, already executed):
  - SCCL S6 archived: `scout_players` (766 rows, 442 allocated, ₹74,03,000 checksum) → `sccl_s6_players`; `jersey_sizes` → `sccl_s6_jersey_sizes`. Then both live tables cleared.
  - **295 SDLL players imported clean-slate** (nobody assigned, no Season-1 results) from the league's own platform via `scripts/import-sdll.mts` — idempotent upsert on `source_id`, safe to re-run near auction day to refresh stats/registrations; it never touches `team_id`/`sold_price`.
  - **12 teams**, Group A (ACCI, Bengal Tigers, Chennai Thalaiva, Lucknow Strikers, NCR Turbo Chargers, Patna Panthers) / Group B (Bhojpuri Dabangs, Goan Monks, Gurugram Spartans, Jaipur Royals, Punjab Royals Legends, Uttrakhand Yoddhas). Purse ₹3,00,000 base, `purse_max` ₹4,50,000 (top-ups manual SQL for now).
  - **Rules** (`auction_rules`, enforced in `place_raise`): categories A+ ₹30,000 base / cap 3 · A ₹20,000 / 8 · B ₹10,000 / 13 · Special ₹5,000 / 3; squad 16–25; max bid ₹4,00,000; min increment ₹500 (steps widen at ₹20k/₹50k).
  - **Live bidding engine** (`supabase/live_auction_schema.sql`): `auction_lot` + `auction_event` + SECURITY DEFINER fns `put_up_lot`/`place_raise`/`hammer_lot`/`pass_lot`/`undo_last_sale`; Supabase Realtime on `auction_lot` verified end-to-end (board syncs 0–3s, no reload; 5s poll fallback).
- **⛔ Do NOT run the SCCL-era scripts** (`import-from-api.mts`, `import-final-list.mts`) — they target Anantanity SCCL S6 and would pollute the SDLL pool. The SCCL squad/curation notes from the old HANDOFF are preserved in git history (see `sccl_s6_players` for the data).
- **Auctioneer login**: `auctioneer@shantidevi.com` (admin role, dedicated — the human admin is nikhil@ndpms.in). Console at `/admin/auction`; owners watch `/auction` (public).
- Known quirks: "Harvinder Yadav" appears **twice** in the platform pool (skip one on auction day); ~57 players' photos are on `media.cricheroes.in` whose upstream resizer 502s — the app falls back gracefully, not fixable our side.

## Secrets (recreate `.env.local` on a new machine — it's gitignored)
- `NEXT_PUBLIC_SUPABASE_URL` = https://hlouwxtyotrmlehaxgav.supabase.co
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY` (Supabase project `hlouwxtyotrmlehaxgav`)
- `SDLL_EMAIL` = Teamowners@shantidevi.com · `SDLL_PASSWORD` = Season1 — for `scripts/import-sdll.mts` (platform API `services.sdll.anantanity.com/api`; ⚠️ its pagination has no stable sort — the importer deliberately fetches ONE oversized page and hard-fails on duplicate ids).
- Do **not** set `SPARTANS_DEV_FIXTURE` outside local dev.
- Deploy: `vercel deploy --prod --yes` (CLI login `ndpmsmentorship-2641`, project `gurugram-spartans-auction`). Project has **no Git integration** — must deploy via CLI. Repo-local git pushes use `credential.helper=store --file=C:/Users/lovet/.git-credentials-ndpms` (Windows machine).

## Pages
- **Public:** `/auction` (live board — on-the-block lot + 12 team cards, Realtime), `/squad` (squad display, season banner from DB), `/jersey`, `/sarda` (SCCL league record, not in nav), `/scout/[id]` (player profiles, admin-gated edit controls), `/login`.
- **Login-gated:** `/scout` (pool board, category filters A+/A/B/Special), `/admin/auction` (auctioneer console: search → put up lot → per-team raise buttons with purse/cap enforcement → hammer/pass/undo), `/admin`, `/players`, `/my-team`.

## Pending / next
1. **Projector mode** view for the public board (venue screen).
2. Restyle secondary pages to the SDLL brand (`/login`, `/my-team`, `/players`, `/team`, `/jersey`, `/scout/compare`, `/scout/import`).
3. Purse **top-up control** for organizers (₹50k/₹1L increments — currently manual SQL on `teams.purse_total/purse_remaining`).
4. Re-run `scripts/import-sdll.mts` shortly before auction day to catch late registrations.
5. 2026-08-13 SquadsBoard "Top Batters / Top Bowlers chips" commits were merged in git but superseded by the SDLL board redesign (conflict resolved in favour of the redesign) — re-graft onto the new board if wanted.

## BALL LIBRARY — status 2026-08-12 (LIVE at ndpms.in/spartans, actively growing)
Broadcast-redesigned (dark/sports-app), **multi-match** (per-player tab bar: All / vs OPP). Static site in LMS repo `public/spartans/`. Deep-link `/spartans?p=<kind>-<name>` (kind ∈ batter|bowler).

**⚠️ PIPELINE IS LOCAL, NOT IN GIT: `~/spartans-tools/` (2.8 GB, mostly regenerable video).** The irreplaceable part (scripts + every match's DATA json = marks/skeletons/charts) is now a git repo there + bundled to **`~/Desktop/spartans-tools-pipeline.tgz` (238 KB)**. **On a NEW machine:** (1) clone `ycwism-lms` → you get the deployed clips in `public/spartans/`; (2) extract the bundle → `~/spartans-tools` (source pipeline + match data); (3) re-download match videos only if re-cutting: `~/Library/Python/3.9/bin/yt-dlp --extractor-args "youtube:player_client=android" -f 18 -o video/<ytid>.mp4 <url>`. No dedicated GitHub repo yet (gh not authed) — create `spartans-tools` repo + push for true auto-sync when convenient.

**Matches** (`matches/<id>-inn1|inn2/` = meta.json+rosters.json+skeleton.json+marks.json+clips/):
- `22328280` ACCI Final — live
- `22101793` Bengal Tigers Semi Final — timed+clipped, **DEPLOYED LIVE**
- `21990344` Bangalore KS Blasters Quarter Final (GS 277/3 won by 144) — **inn2 (your bowlers) TIMED+CLIPPED+DEPLOYED** (via commentary pre-fill); **inn1 (GS batting) still NEEDS TIMING** (`timer.html?m=21990344-inn1`, bowler pre-filled ~90%), then recut→rebuild→deploy. Video downloaded: `video/TEuSCMM-uts.mp4`.

**Workflow (proven):** `cd ~/spartans-tools && python3 serve_nocache.py` → localhost:8765/admin.html (no-cache server; if a page looks stale, hard-refresh or append `?v=N`). Add match = paste **YouTube + CricHeroes links** → Claude reads the **CricHeroes scorecard PDF** (`pip install --user pypdf`; poppler NOT installed so Read-tool PDF render fails, use pypdf text) → builds both innings (crease pairs walked from batting order + FoW; bare "10 ov" FoW = skeleton 9.6). User times each innings in `timer.html` → export `<id>_marks.json` (time field = `delivery` seconds) → `recut_match.py matches/<id>` → `build_library.py` + `build_index.py` + `build_admin.py`.
**DEPLOY:** `cd ~/ycwism-lms; git fetch; git merge --ff-only origin/main; rm -rf public/spartans/*; cp -R ~/spartans-tools/site/* public/spartans/; git add public/spartans; git commit` (**author MUST be ndpmsmentorship@ndpms.in or Vercel silently blocks**) `; git push --no-thin origin main`. Verify live: `curl -L https://ndpms.in/spartans` (grep a new marker) + a video URL = 200. Vercel auto-deploys ~15-60s.

**OPEN TODOs (user-requested):**
1. **Ball-by-ball SCORES on player cards — DONE/LIVE** for matches with per-ball runs (currently 138 balls, 70 wickets). Runs come from commentary OCR merged into marks. Matches without commentary still show dots — backfill via their commentary recordings if wanted.
2. **Move library videos OFF-repo** (object storage) — ycwism-lms `.git` bloats ~618 MB per deploy, will crawl clones/pushes. `URLBASE` indirection in build_index.py already makes this a small change (point at absolute video URLs).
3. **Commentary-OCR pre-fill — WORKS** (`parse_commentary2.py`): OCRs a full-scroll CricHeroes Commentary screen-record → per-ball `Bowler to Batsman, outcome`, fuzzy-matched to rosters (difflib), innings-segmented (batter's roster → which innings). Overlay expands bowler to the whole over (→~90% bowler pre-fill on inn1) + striker/runs where the scroll caught them. Feeds ball-by-ball scores (merge runs into marks by over.ball). **Caveat: commentary gives WHAT not WHEN — user STILL taps delivery times** (no timestamp source exists). CricHeroes labels the 6th ball "N.0" = our "(N-1).6". Coverage ∝ how slowly they scroll. The inn1 recording is on Desktop (`Screen Recording 2026-08-12 at 22.51.04.mov`) — transfer it to pre-fill inn1.
4. **Ball Library ↔ profile cross-link** (original plan, not started): on `/scout/[id]` a "Ball Library" button (read manifest.json live) → `/spartans?p=<kind>-<name>`; and library→profile "Analysis ↗" → `/spartansscout/scout/<uuid>` (map by name; near-matches: Nitin→Nitin Yadav, Vikas 10→Vikas Grover, Vishal Salgy→Vishal Salgotra, Naveen Gujjar→Naveen (Gujjar) Tanwar).

See local memory [[gurugram-spartans-video-clips]] for deep pipeline detail.

## Handy scripts (`scripts/`, run with `node scripts/*.mts` — Node 26 strips TS types)
- `import-sdll.mts` — **the current importer** (SDLL platform → `scout_players`, clean-slate semantics above).
- `import-from-api.mts`, `import-final-list.mts`, `extract-roster.py` — **SCCL S6 era, do not run** (kept for the archive).
