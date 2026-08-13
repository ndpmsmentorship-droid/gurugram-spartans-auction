# Handoff — Gurugram Spartans Auction App

_Local Claude memory does not transfer across machines — this file is the source of truth. Last updated 2026-08-12._

## What this is
Next.js 16 app for the SARDA Corporate Cricket League (SCCL) Season 6 auction + Spartans scouting.
Deployed on Vercel; served at **https://www.ndpms.in/spartansscout** via a rewrite in the LMS repo
(`ycwism-lms` `next.config.ts`). `basePath: "/spartansscout"`. Repo: `ndpmsmentorship-droid/gurugram-spartans-auction`.

## Secrets (recreate `.env.local` on the new machine — it's gitignored)
- `NEXT_PUBLIC_SUPABASE_URL` = https://hlouwxtyotrmlehaxgav.supabase.co
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY` (Supabase project `hlouwxtyotrmlehaxgav`)
- `SCCL_USERNAME` = SCCL6Owners · `SCCL_PASSWORD` = SCCL6Password · `SCCL_BASE_URL` = https://sarda-corporate-league.anantanity.com · `SCCL_SEASON` = 6
- Vercel deploy token (was rotated; get a fresh one at vercel.com/account/tokens if deploys 401).
- Deploy: `npx vercel@latest deploy --prod --yes --token=<TOKEN>`. Project has **no Git integration** — must deploy via CLI.

## Current state (auction is OVER)
- **Anantanity is the source of truth** (dashboard `sarda-corporate-league.anantanity.com`, login `SCCL6Owners`/`SCCL6Password`, `/api/auth/login` → `/api/players?season=6`).
- **Auto-sync is DISABLED** on purpose: `AuctionSync` removed from layout, `/api/sync-auction` is a no-op, "Sync now" button removed from the board. The squad is **curated manually** now — re-enabling sync would re-mirror Anantanity and undo manual edits.
- **Spartans squad LOCKED at 17** (`team_id` = Gurugram Spartans): Abhinav Jain, Ajay Dhar, Ankit Bajpai, Dinkar Sharma, Ganesh Singh, Himanshu Suneja, Hitesh Yadav, Kanishk Sheel, Nikhil Dhingra, Nitin **Yadav**, Rohit Jain, Rohit Tanwar, Shakib Hussain, Shubhendu Kaushik, Sourav Kumar, Sunny Girotra, Vikas Grover. **Deliberately removed:** Gaurav Verma, Shakti Singh Chauhan, Nitin **Kumar**. (Sunny/Himanshu/Ajay were manual adds not in Anantanity.) Any DB refresh must **skip `team_id`=Spartans rows**.
- Spartans purse set to ₹4,00,000; `purse_max` = ₹4L for all teams (top-up control in the admin console).

## Pages
- **Public:** `/auction` (live board), `/squad` (final squad display — mobile cards + SVG ring gauges A·/8, U35·/5, Legends, Purse-used; role bar; columns Jersey#/Player/Category/Role/On-jersey/T-shirt/Lower; honours mark = gold·silver·red-dot·silver·gold), `/jersey` (public kit form), `/sarda` (league record, **not** in nav), `/scout/[id]` (player profiles — public, admin-gated edit controls). Nav has a public **Squad** link.
- **Login-gated:** `/scout` (pool board — shows all 766 with **All / Unsold / Sold** filter; sold = has `team_id`, refreshed from Anantanity; uses admin client + 3× retry to dodge transient Supabase 522s), `/admin`, `/players`, `/my-team`.

## Pending
1. **Run `supabase/jersey_sizes.sql`** in Supabase — creates `jersey_sizes` (with `display_name`). Until then the `/jersey` form can't save and the squad's Jersey#/On-jersey/T-shirt/Lower stay blank.
2. **[LAST] Internet research on players** in the Anantanity rosters — confirm scope (Spartans 17 vs all rostered) before running.
3. Optional: Anantanity now has ~9 more registrations than our pool (775 vs 766) — import if wanted.

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
- `import-from-api.mts` — full re-import from Anantanity (⚠️ replaces pool; would overwrite manual squad — don't run casually now).
- `extract-roster.py` (owners/retained categories from the Team-Owners xlsx colours), `import-final-list.mts` (xlsx import).
