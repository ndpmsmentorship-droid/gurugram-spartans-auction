# Handoff — Shanti Devi Legend League Auction App

_Local Claude memory does not transfer across machines — this file is the source of truth. Last updated 2026-08-14._

## What this is
Next.js 16 app, now the **Shanti Devi Legend's League (SDLL) Season 2** live-auction site — rebranded and
cut over from the finished SARDA Corporate Cricket League (SCCL) Season 6 on **2026-08-14**, and **LIVE in
production** the same day. Deployed on Vercel; served at **https://www.ndpms.in/spartansscout** via a rewrite
in the LMS repo (`ycwism-lms` `next.config.ts`). `basePath: "/spartansscout"`.
Repo: `ndpmsmentorship-droid/gurugram-spartans-auction`.

## 🚚 NEW MACHINE SETUP (project moved off the Windows laptop 14-Aug-26)
Everything needed is in this repo + the Supabase/Vercel dashboards. Nothing on the old machine is required.

1. **Clone** (private repo — needs the `ndpmsmentorship-droid` PAT, minted 14-Aug-26 at github.com/settings/personal-access-tokens while logged in as droid):
   ```
   git clone https://ndpmsmentorship-droid@github.com/ndpmsmentorship-droid/gurugram-spartans-auction
   ```
   Store the PAT once via a credential file OUTSIDE any cloud-synced folder, and — if the machine's global git credential manager knows another GitHub account — clear the helper chain repo-locally first, or pushes 403 as the wrong user:
   ```
   git config --local --replace-all credential.helper ""
   git config --local --add credential.helper "store --file=<path>/.git-credentials-ndpms"
   ```
   (credential-store line format: `https://ndpmsmentorship-droid:<PAT>@github.com`)
2. **`.env.local`** (gitignored — recreate by hand). Vercel env vars are marked *sensitive*, so `vercel env pull` returns blanks; get the Supabase keys from the dashboard instead (project `hlouwxtyotrmlehaxgav` → Settings → API):
   ```
   NEXT_PUBLIC_SUPABASE_URL=https://hlouwxtyotrmlehaxgav.supabase.co
   NEXT_PUBLIC_SUPABASE_ANON_KEY=<dashboard>
   SUPABASE_SERVICE_ROLE_KEY=<dashboard>
   SDLL_EMAIL=Teamowners@shantidevi.com
   SDLL_PASSWORD=Season1
   ```
   Do NOT set `SPARTANS_DEV_FIXTURE` (dev-only stub that bypasses the real DB).
3. **Run locally**: `npm install && npm run dev` → http://localhost:3000/spartansscout (Node ≥ 20; repo built on Node 24/26).
4. **Deploy**: `vercel login` (the Vercel account owning project `gurugram-spartans-auction`, team `nikhil-dhingra-s-projects`) → `vercel link --yes --project gurugram-spartans-auction` → `vercel deploy --prod --yes`. No Git integration exists — CLI is the only deploy path. Production env vars are already set on the project; don't recreate them.
5. **Verify after any deploy**: https://www.ndpms.in/spartansscout/auction shows 12 SDLL teams + idle lot; `/squad` banner says "Shanti Devi Legend's League — Season 2"; login works at `/login` (`auctioneer@shantidevi.com`). Pool = 295 players.
6. **Not transferred, by design**: `supabase/backups/sccl_s6_allocations.csv` (player-PII, `.gitignore` blocks all CSVs) — the canonical S6 archive lives in the DB as `sccl_s6_players`/`sccl_s6_jersey_sizes`, nothing is lost. Build artifacts (`.next/`, `node_modules/`, `.vercel/`) regenerate.
7. If the clone lands under OneDrive/Dropbox: cloud sync can evict tracked files. On any mysteriously missing file run `git ls-files --deleted` first; restore with `git ls-files -d -z | xargs -0 git checkout --`. Prefer cloning outside synced folders.

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
- **Public:** `/auction` (live board — on-the-block lot + 12 team cards, Realtime), `/schedule` (match schedule — fixtures / weekend view / points tables / slot spread, see below), `/squad` (squad display, season banner from DB), `/jersey`, `/sarda` (SCCL league record, not in nav), `/scout/[id]` (player profiles, admin-gated edit controls), `/login`.
- **Login-gated:** `/scout` (pool board, category filters A+/A/B/Special), `/admin/auction` (auctioneer console: search → put up lot → per-team raise buttons with purse/cap enforcement → hammer/pass/undo), `/admin`, `/admin/schedule`, `/players`, `/my-team`.

## MATCH SCHEDULE PORTAL — added 2026-08-17
**⚠️ Needs its migration run once before use:** paste `supabase/schedule_schema.sql` into the Supabase
SQL Editor (project `hlouwxtyotrmlehaxgav`). It is additive — two new tables (`fixtures`,
`schedule_config`) plus a `touch_updated_at()` trigger fn; it touches nothing that already exists.
Until it runs, `/schedule` renders its empty state rather than erroring.

- **Format** (12 teams, Group A/B of six): single round robin inside each group, **one round of both
  groups per weekend** — so 6 matches a weekend (3 Sat + 3 Sun) and every team plays exactly once.
  "No team plays twice in a weekend" is therefore structural, not a solved constraint. 5 weekends =
  30 group matches, then a finals weekend (2 semis + 3rd place + final) = **34 fixtures**.
- **Generator** `src/lib/schedule/generate.ts` — pure, no Supabase/React, so it runs in an action, a
  route handler or a script. Circle-method round robin → seeded hill-climb that assigns matches to
  (day, slot) boxes. Cost function priorities: never lock a team out of a slot (40) > slot counts
  within one (6) > even Sat/Sun split (4) > no same slot two weekends running (2). Default config
  reaches **cost 0**: all 12 teams get 5 matches across all 3 slots (2-2-1) with a 3/2 day split.
  Same seed + config ⇒ identical schedule.
- **There is no home/away in this league** — one venue, so the concept was removed from every
  surface (2026-08-17). The `fixtures.home_team_id`/`away_team_id` columns are kept as the
  persistence contract but mean only "listed first"/"listed second"; the export calls them
  Team 1 / Team 2, and the slot-spread table has no home/away column.
- **Defaults**: start Sat **20 Feb 2027** (third weekend of Feb), slots 08:00/12:00/16:00,
  Sportscube Gurugram. All of it is editable in the admin UI, including blackout dates (any weekend
  touching one is skipped wholesale).
- **`/admin/schedule`** — generate/regenerate (destructive: replaces all fixtures and discards
  entered results; the UI warns), clear (needs an explicit confirm token in the form), and per-match
  result entry by weekend.
- **`/schedule`** — public, works signed out. Tabs: All Fixtures / By Weekend / Points Table / Slot
  Spread, plus a team filter and an **.xlsx export** (`/api/schedule/export`) whose sheet layout
  mirrors the SCCL workbook the league already circulates.
- **Standings are never stored** — `src/lib/schedule/standings.ts` recomputes them from `fixtures` on
  every read (win 2 / tie 1 / NR 1). Knockout placeholders ("Winner Group A") resolve to real team
  names only once *every* group match has a result. No NRR: scores are free text, which can't yield
  overs faced.
- **Reads go through `createAdminClient()`**, like `/auction` and `/squad` — `seasons`/`teams` are
  RLS-gated to signed-in users but the schedule must render for anyone. Server-only, and the team
  select is narrowed to id/name/division so no purse figures cross the boundary.
- Dev fixture (`SPARTANS_DEV_FIXTURE=1`) now covers all 12 teams and a generated season, so both
  pages can be designed against real-shaped data with no DB.

## PLANNED 2026-09-29 — registration + AI scout chat + owner squad tracker (NOT STARTED, no code yet)
Requested by Nikhil; discussion stage. Nothing built or deployed yet.

**Decisions made**
- **Owner logins: 12 accounts, one per team** — each owner sees only their own squad in the tracker.
- **Registration: combine the best of the USCL and SARDA forms.** The landing page + form design still
  needs a discussion with Nikhil before building.

**USCL reference form** (urbansportsstudio.in/register — Urban Sports Champions League S2, Champions Den,
Bandhwari, Gurugram; read from Nikhil's screenshots because WebFetch was blocked):
- Landing: logo, "Player Registration · Season 2 / ENTER THE POOL", "No account needed", age 30+,
  "Already registered? Add your Aadhaar card" link, 3 step cards (Register → Review → Auction).
- Personal: Full name · DOB (hint "Open to players aged 30+") · Contact number (10-digit) · Email ·
  Company · Work email ("prefer company email, personal is fine") · CricHeroes profile link ("Reviewers
  open this…") · LinkedIn profile link · Player photo (JPG/PNG/WEBP ≤5 MB) · Aadhaar (JPG/PNG/WEBP/PDF
  ≤5 MB, "visible only to league admins"). All required.
- Playing profile, one radio per group, can combine across groups: Batting (Left Hand / Right Hand
  Batsman) · Bowling (Left Arm Pacer / Left Arm Spinner / Right Arm Pacer / Right Arm Spin) · All
  Rounder (Batting / Bowling) · Wicket Keeper (WK Keeper Batsman).
- Career stats, all required, "NA" allowed: Matches, Runs, Bat avg, Bat SR, Wickets, Bowl SR, Economy.
- Kit & jersey: T-shirt size, Lower size (dropdowns), Jersey number, Name on jersey.
- Consent checkbox: ₹3,000 mandatory fee **only if selected at auction**; details accurate; OK to contact.
  Button "Submit Registration". Footer repeats the fee note.

**Nikhil's requirements for the SDLL version (2026-09-29, second pass)**
1. Attractive Shanti Devi landing page: previous-season winners featured + a photo carousel.
   NEEDS FROM NIKHIL: winner names/team photos per season + carousel photos.
2. Returning players pick their existing profile + data from our stored database — no re-registration.
3. Jersey name, number and kit sizes are collected inside the registration itself.
4. Fee disclaimer + mandatory checkbox (the USCL ₹3,000-if-selected wording).
5. Aadhaar is required ONLY for players not already in the database.
6. LinkedIn must show 500+ connections, otherwise the player goes to an "under review" category.

**Data findings (2026-09-29)**
- The DB has **no phone/email for any player**: scout_players 295 rows (SDLL S2) and sccl_s6_players
  766 (SARDA S6) both have email=0/phone=0. Photos/CricHeroes/age are well filled; batting/bowling style
  are filled for SDLL only. So a returning player can't be verified against the DB yet.
- Contact data lives in Nikhil's **Excel files across seasons** (only one is on this Mac:
  `~/Downloads/Faltu/For_owners_final_auction_list_7th_Aug.xlsx` → sheet "SSCL6 Registrations", 521 rows
  with fullName, email, phone, age, cricHeroesProfile, linkedinProfile + full bat/bowl/field stats;
  also "Team Owners" sheet: team, group, owners, retained players). The other seasons' files must be
  copied over. Plan: merge every file into one **player master** keyed on phone, then CricHeroes id,
  so returning players verify with an OTP sent to the phone/email on file before their profile is prefilled.
- **LinkedIn 500+ can't be checked automatically** (no API for connection counts; scraping is blocked
  and against LinkedIn's terms). Proposal: player uploads a LinkedIn screenshot showing "500+
  connections"; anyone without a verified one lands in "under review" until an admin ticks it.
- Owner logins already exist: `/admin/owners` creates a username/password per team
  (`src/lib/owner-auth.ts`, `@owners.sdll` internal emails) → the 12 accounts are data entry, not new code.
- `jersey_sizes` (19 rows) / `sccl_s6_jersey_sizes` (17) already hold kit data; the new form writes the same shape.

**Build plan (for discussion)**
1. `/register` (public, no account) → `scout_players` with a pending status + admin approve queue;
   Aadhaar goes to a PRIVATE Supabase Storage bucket (admin-only). Resolve the anantanity
   `import-sdll.mts` overlap first (dedupe on phone/CricHeroes link) so the importer can't clobber or
   duplicate our sign-ups. SARDA form fields not compared yet — pull them from
   `scripts/import-from-api.mts` / `sccl_s6_jersey_sizes`.
2. **AI scout chat** (owner asks e.g. "best left-arm spin options"): a server route filters the pool
   (bowling_style/role/category/unsold) → Claude ranks and comments only on those rows. Needs an
   `ANTHROPIC_API_KEY` Vercel env var. Many SDLL stats/indices are null → the commentary must say so.
3. **Squad tracker** `/my-team` per owner: purse, category caps, role mix, pace/spin + L/R arm, L/R bat,
   16–25 squad gaps, "fill this gap" suggestions (via the AI chat), live via Realtime.

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
