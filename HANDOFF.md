# Handoff — Shanti Devi Legend League Auction App

_Local Claude memory does not transfer across machines — this file is the source of truth. Last updated 2026-09-30._

## ⚠️ USCL DEMO IS SWITCHED IN (since 1 Oct 2026) — read before anything else
The auction side (board, console, pool, owner pages, War Room) is running **USCL Season 2** data with the
SDLL look, for Gurugram Spartans at the USCL auction on **Sat 3 Oct**. `src/lib/league.ts` has
`LEAGUE = "uscl"`; the active season is "Urban Sports Champions League — Season 2"; the SDLL pool (295 + 19
jersey rows) is archived in `league_pool_archive` (league `sdll`). While USCL is in: /auction and /squad need a
login, the landing hides the live bar, registrations can't be added to the pool (they still register fine).
**Switch back after the auction:** `node scripts/league-switch.mts sdll`, then set `LEAGUE = "sdll"`, commit,
push. Logins: owner `gurugramspartans`, admin `sdlladmin` (passwords with Nikhil, not in the repo).
Setup is `scripts/uscl-setup.mts <cards.json>` (re-runnable while staged). Owner screen: **/war-room**
(purse, max safe bid, category slots per the USCL deck, gaps + best fits, on-the-block card with phase stars,
clips, who can still bid, alternatives). Phase stars: `src/data/phase-stats.json` from 26 trusted CricVideos
matches (`scripts/build-phase-stats.py`); clips map `src/data/cv-map.json` (`scripts/build-cv-map.py`).
Known gap: other USCL teams' owner/retention spends aren't loaded (all at ₹3,00,000) — rival purses are
approximate until Nikhil records them (he is sending a screenshot). **No helper on the day:** Nikhil runs the
War Room **auction pad** alone (see LATEST 2026-10-01).

## ▶ ADDENDUM — 2026-10-02 (USCL soft launch)
- **Every USCL franchise has an owner login** — `scripts/uscl-owner-logins.mts` (re-runnable; only fills teams
  without an owner) wrote usernames + passwords to `~/Downloads/uscl-owner-logins.csv` (never the repo).
  Usernames: bengaltigers, chennaithalaiva, delhidevil, doondruks, dubaivipers, haryanabulls, jkbrocode,
  japanitsunami, lucknowlagers, mirzapur, punjabroyals, rcgurgaon, texasgladiatorz (+ gurugramspartans).
- **Recording sales is admin-only again** (`ensureRecorder()`), the pad shows only on the admin login.
  Sales reach every owner's War Room via realtime + 5 s poll (tested with two logins).
- **Per-owner wishlist** in the War Room: `player_marks` rows (RLS = own rows), ☆ on pool / profile / on-block,
  a wishlist section (available vs gone), pool filter. Suggestions were already per team.
- **USCL branding while `LEAGUE === "uscl"`:** masthead "USCL Auction" + USCL crest (`brand/uscl-crest.png`),
  metadata, a USCL sign-in page (no Spartans panel), nav = War Room / Live Board / Ball Library (+ Admin),
  SDLL sponsor bar hidden, and `/` redirects to `/war-room` (or sign-in). All revert with `LEAGUE = "sdll"`.
- Seen in the DB, not made by Claude: Nikhil Tandan → Japani Tsunami ₹3,000 (auction) — ask Nikhil.
- **Security lockdown (audit, 2 Oct):** `scout_players` RLS let ANY signed-in user write, and the live-lot
  RPCs (put_up/raise/hammer/pass/undo/withdraw) are SECURITY DEFINER with no role check and were executable by
  anon/authenticated. `supabase/lockdown_2026_10_02.sql` makes pool writes admin-only and the RPCs
  service-role-only (the app already calls them with the service role). Pool import/sync actions now admin-only.
  `proxy.ts` role gate: `/scout/import` admin-only always; while USCL is in, owners only get /war-room,
  /auction, /players (everything else → /war-room).
- **Favicon / share card:** `public/brand/meta/{uscl,sdll}-{icon,apple-icon,og}.png`, wired in `layout.tsx`
  metadata by full `/spartansscout/...` path (the old file-based `/icon` resolved to the SMIFE site's icon).
- **Official pre-auction squads loaded (2 Oct, from the organisers' "Franchise Owners & Retentions" deck video):**
  `scripts/data/uscl-pre-auction.json` (42 owners / 28 retained / 8 legends) applied with
  `node scripts/uscl-sync.mts <cards.json> --apply`, which also re-syncs the pool with a fresh portal scrape
  (12 added, 22 withdrawn → is_rejected, Aman Raj A→B). Tushar Khattar is MIRZAPUR's owner (not Spartans);
  Spartans' 6th is Aakash Sharma (B owner). Spartans ₹50,000 spent. Re-run the script any time the portal changes.
- **USCL OFFICIAL RULEBOOK applied (2 Oct; ~/Downloads/nikhil/USCL_Rulebook Final.pdf):** auction base/step
  Legend 3K/1K · A+ 20K/5K · A 10K/3K · B 6K/2K (owner-pick prices unchanged: B/Legend 3K); purse ₹1,75,000
  after owner/retention value + optional top-ups ₹50K and ₹25K (teams.purse_total 175000, purse_max 250000; the
  admin console's Top up buttons are 50K/25K); squad 18–20; age 31–34 max 3 per squad; category mixes are
  MATCH-DAY only (no purchase caps). DB auction_rules updated to match. Nikhil earlier said 1.75L + 1.25L = 3L —
  the rulebook says 1.75L + 75K = 2.5L; rulebook wins, flagged to him.
- **Reconcile with the official USCL site (run any time, incl. during the auction):**
  `U=… P=… <venv>/python scripts/uscl-fetch.py /tmp/official.json` (read-only: pool export xlsx at
  /franchise/pool-export, Spartans' My Squad, public /franchises lists) then
  `node scripts/uscl-reconcile.mts /tmp/official.json [--apply] [--hide-gone]`. The export = players still
  AVAILABLE; a player who drops off is reported as "sold or withdrawn — record who bought him" (the site doesn't
  say who). --hide-gone only before the auction. The 2 Oct scrape-based sync had missed 18 players (lazy list);
  the export fixed it (15 un-hidden, 4 added, 3 withdrawn). USCL My Squad: Aakash Sharma RETAINED ₹6K, Nikhil
  OWNER ₹3K (deck had them swapped) — applied.
- SDLL crest shown beside the USCL crest in the masthead + sign-in ("Powered by SDLL") — Nikhil wants it as marketing.
- The ndpms.in "Owners login" button is in the LMS repo's components/cricvideos-home.tsx (ndpms.in = CricVideos
  home). app/page.tsx is the SMIFE home (smife.in) — a different business; keep auction links OFF it.
- ndpms.in (LMS repo) home has a "🏏 Owners login" button → /spartansscout/login.
- Pad records **Auction sale / Owner pick / Retained** (deck prices prefilled); team logos in
  `public/brand/uscl-teams/` + `teams.logo_url`. Retention spreadsheet ignored on purpose (Nikhil waiting for the
  official list).

## ▶ LATEST — 2026-10-01 (read this first)
Everything below is pushed to `main` and live (last commit "War Room: tap any squad player…"). Running list:
**`TODO.md`**. Tests were Playwright against the local dev server (which talks to the live DB); every test
sale was undone and checked in the database.

**USCL auction (Sat 3 Oct) — how Nikhil runs it, alone, on his phone**
- **One login for everything:** `sdlladmin` (admin). Opens every portal page incl. the War Room + pad, and — new
  today — the **ball library** too (an admin row in `spartans_passes`, LMS Supabase `zbximdxghhjpopiwdzhi`,
  expires Sep 2028). Same password on both; it lives in chat only. The owner login `gurugramspartans` still works.
  If the client gets the master login, they also get library admin — offer them a separate login.
- **Auction pad** (top of `/war-room`, `WarRoom.tsx`): type 2–3 letters → player goes on the block (full card)
  → *Us* / *Other team* + price (−1K/+1K/+5K/+10K) → **Sold**; *Unsold / clear*; *Undo last*; *RTM: X matched*.
  Optimistic UI. Recording is allowed for admins, and for owners only while `LEAGUE === "uscl"`
  (`ensureRecorder()` in `admin/auction/actions.ts`); purse top-ups stay admin-only.
- **Pad mirrors the live board:** calling up a player runs `withdrawLot()` + `putUpLot()` (admin login only;
  silently skipped for owners), sold/clear withdraws. `useLotSync` now also refreshes on `scout_players` UPDATE,
  so sales show on `/auction` at once. The big price on the War Room follows the pad price, never a stale lot.
- **RTM** (`src/lib/auction/rtm.ts`, SQL `supabase/uscl_rtm.sql` — **run, SUCCESS**): six existing franchises =
  Bengal Tigers, Chennai Thalaiva, Delhi Devil, Lucknow Lagers, Punjab Royals, Royal Challengers Gurgaon, one RTM
  each, max 2 against any team. **Spartans hold none.** A matched RTM sets `acquired='rtm'` + `rtm_against`.
  Admin console has an RTM panel; War Room shows RTM risk on the block card + an RTM-watch section.
  Open: does a *declined* RTM use up the RTM? (built: only matched counts).
- **Spartans squad = 6, ₹50,000** — matches the USCL franchise portal (read-only check 1 Oct): Kuldeep Negi A+
  25K retained, Prateek Suneja A 10K owner, Nikhil B 6K retained, **Tushar Khattar B 3K owner (added today)**,
  Gaurav Verma B 3K owner, Kanishk Sheel Legend 3K. Portal shows ₹1.75L purse; ours is ₹3L incl. the top-up.
- **Squad rules (deck p.2):** 0 A+ → max 6 A, 6+ B · 1 A+ → max 5 A, 6+ B · 2 A+ → max 3 A, 7+ B · Legend ≤1
  (must be 40+), "Playing Squad 12 + 1 Legend". War Room applies it to the whole squad (stricter) — ask the
  organisers whether it is playing-XII only. **No under-35 rule exists** in any USCL material.
- **War Room card restyle:** brand fonts only (no mono numerals), stat tiles with colour-coded Avg/SR/Econ and
  PP/Middle/Death economy tiles, red "Age N" chip, price row on phones. **Profile sheet:** tap any squad player or
  pool name. **▶ Watch clips** also on the live board + console block card (`src/lib/scout/clips.ts`), and
  Legend no longer shows as "Special" there.
- **CricVideos (LMS repo):** `ndpms.in/spartans/?league=uscl` has a "Season 2 auction pool · on film" section
  — 96 pool players by category with Bat/Bowl links (LMS commit ddf20b2).
- **USCL owners list:** the "Meet the franchises" cards show one owner per card on tap; only
  "Yogesh Pushkarna" captured so far. Their site was down (Vercel 402) for part of the day, back by afternoon.

**Landing + mobile**
- Hero is now the **ACCI (S1 champions) floodlit team photo** (`brand/hero-acci-champions.jpg`, a frame from the
  league's "ACCI First" AV, Drive `Final AVs/Champions_Runnersup/`). Honours cards: ACCI daylight team photo,
  Goan Monks floodlit huddle (from "Goa 2nd" AV). Manoj Tiwari + Kanishk photo moved into the gallery.
- iPhone "zoomed in, pinch out" fix: form fields are 16px on phones (Safari auto-zooms smaller ones);
  `html { overflow-x: clip }`. Nikhil to confirm on his phone.

**Before Saturday:** Friday solo dry run (pad on phone + live board on a laptop); load the other 13 teams'
owner/retention players when Nikhil sends the screenshot; ask organisers the A+/playing-XII and declined-RTM
questions. **After the auction:** `node scripts/league-switch.mts sdll`, set `LEAGUE = "sdll"`, push.
Known pre-existing lint error: `src/app/auction/useLotSync.ts:21` (ref written during render) — not new.

## PREVIOUS — 2026-09-30
Main is at the "TODO: registration feedback 1-4 live" commit. Every push to `main` deploys production (GitHub
integration); older notes below saying "CLI only / no Git integration" are wrong. The running to-do list is
**`TODO.md`** in the repo root — keep adding to it.

**Shipped today (all live, all tested end to end with Playwright, test data cleaned up):**
- **Approved registrations → auction pool** (`src/app/admin/registrations/actions.ts`): per-player *Add to pool* with a
  category picker (A+/A/B/Special), *Add all to pool*, *Remove* while unsold. Rows are keyed
  `scout_players.source_id = "reg:<registration id>"`; players already in the league-platform pool are matched by
  CricHeroes id or name, never duplicated. New players' photos are copied from the private `registrations` bucket
  to a public `player-photos` bucket. Old SARDA roles ("ALL_ROUNDER") are normalised; `.pdf` photo URLs are skipped.
  Indices recompute after every change.
- **Registration form — client feedback 1–4:** Food section (Veg/Non-veg required, allergies optional) and a
  Declarations box (information true · share documents if asked · ₹3,000 fee) — Submit stays disabled until all three
  are ticked. DB columns `info_declared, docs_consent, meal_pref, food_allergies` (addendum 2026-09-30 in
  `supabase/registration_schema.sql`, **already run**). Admin queue shows meal + allergies.
- **Broken photos fixed** on the auction console, live board and squads: SARDA-hosted photos send
  `Cross-Origin-Resource-Policy: same-origin`, so raw `<img>` was blocked. `PlayerIdentity` now uses `PlayerPhoto`
  (next/image proxy + initials fallback); `squad/Avatar.tsx` uses `viaProxy()` from `register/PlayerCard.tsx`.
- **Landing page redesigned** (`src/app/page.tsx`, `src/app/home/{Countdown,PhotoGallery}.tsx`, `src/app/franchises.ts`):
  floodlit maroon hero with the **Manoj Tiwari + Kanishk** Fighter-of-the-Match photo (Instagram, 29 Mar 2026 →
  `brand/hero-manoj-kanishk.jpg`), boxed countdown to the 20 Feb 2027 8 AM opener, stats strip, Road to Season 2
  timeline, About + Season 2 at a glance, S1 honours, the **12 franchise cards with their owners inside**
  (logos from Drive `Team Logos/` → `brand/teams/*.png`; owners = `player_master.is_owner`), mosaic gallery with a
  full-screen viewer, tiered sponsors, sponsorship opportunities (from the partnership deck, no prices), venue footer.
  A red **"on the block" bar** appears above the hero only while a lot is live. The "Every page" directory now shows
  only to signed-in admins. `Season1Gallery.tsx` was deleted.
- **Master admin login** created: username `sdlladmin` (→ `sdlladmin@owners.sdll`, role admin). Password was given
  to Nikhil in chat only — not stored anywhere in the repo. Suggest a separate admin login for the client.

**Open questions for Nikhil / the league (also in TODO.md):**
- Client feedback 5 ("Only Shanti Devi … other leagues" — exclusivity declaration or list other leagues?),
  6 ("Attire professional" — photo guidance or auction dress code?), 7 (animated how-to-register video).
- Auction date (for a second countdown + the Road timeline), director/Kanishk message, promo video, sponsor
  contact, social links, S1 reach numbers, owners' titles/companies.
- **14 teams on the console:** UP Warriors + Japani Tsunami (`is_mock`) still show; Gurugram Spartans purse ₹4L vs ₹3L.
  Nikhil hasn't confirmed removing/fixing them.
- Owner logins: only ACCI + Bengal Tigers linked; need the other 10 owners' emails.
- Offered, not done: put the 12 team logos into `teams.logo_url` so board/squads/schedule show them.

**Commercial (not code):** quotation doc https://claude.ai/code/artifact/f30af4a4-4d06-4640-bdb6-522bc5b35f25 —
from **Foundary Tek Private Ltd** to **Playful Ventures Pvt Ltd**; Launch Partner Package ₹10L + GST (40/40/20),
₹2.5L/season from S3, Foundary Tek keeps IP, non-exclusive. PDF: `~/Downloads/SDLL-Portal-Quotation-Foundary-Tek.pdf`.
Next: confirm the "Foundary" spelling, add GSTIN/CIN, draft MSA + SOW. Playful Ventures may host the portal on its
own domain (playfulventures.com/.in are on GoDaddy) — avoid "playfulauction" (unrelated adult site).

**Security:** a Vercel token was pasted in chat on 29 Sep — Nikhil should revoke it (Vercel → Account → Tokens).


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

**Decided 2026-09-29 (supersedes the OTP/screenshot proposals above) — keep the flow simple, few steps**
- Nikhil will supply ONE detailed master database of players (all seasons merged), with names + phone numbers.
  It gets imported as the lookup source.
- Returning players **look up their profile by phone number** → confirm it's them → add jersey/kit + fee tick → submit.
  No OTP. The lookup shows only name, photo, role and stats. Never echo email/Aadhaar/other PII, and every submission
  still lands in the admin queue, so a wrong claim gets caught there.
- New players (number not found) → full form + Aadhaar upload.
- LinkedIn 500+: **manual admin check** — a single tick in the review queue. No screenshot upload, no extra player step.
- Nikhil will upload the winners' photos (landing page) + carousel photos.

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

## SPEED, NAVIGATION, BUILD — 2026-09-29 (live)
- **Functions run in Mumbai** (`vercel.json` → `"regions": ["bom1"]`). They ran in iad1 (Washington) while Supabase
  answers from India, so pages took 2–4.5 s. Now 0.25–0.7 s. Don't remove it.
- **Fonts are self-hosted** (`src/app/fonts/*.woff2` via next/font/local). next/font/google's build-time download
  intermittently FAILED the Vercel production build ("next/font/google queries have exactly one entry").
- Tap feedback: root `loading.tsx` + `NavProgress.tsx` (red top bar on every internal link tap), touch-action CSS,
  layout reads profile + auction state in parallel, and the proxy skips Supabase auth on public paths.
- `DEMO_MODE` in `src/app/site-config.ts` (currently true): the header lists every major page for everyone, and the
  landing page has an "Every page" directory (`PORTAL_PAGES`). Flip to false at launch → Register + Sign in only.
- `Crumbs.tsx`: ← Back + breadcrumbs under the sponsor bar on every page except Home.

## POOL + PHOTOS — 2026-09-29 (live)
- `/scout` has tabs **All players (890, default) / SDLL pool (295) / SARDA S6 (766)**. SARDA rows are deduped
  against the SDLL pool (CricHeroes id or name), link to `/players/[id]`, and are never shown as sold. The
  auction still draws ONLY from `scout_players`.
- Photos: 96 of 295 SDLL pool photos were broken (28 junk CDN-speed-test URLs from the platform import, and the rest
  CricHeroes' own resizer returning 502). 64 were replaced in `scout_players.photo_url` (58 from the SARDA archive,
  6 from CricHeroes profile og:image); the old URLs are backed up in the session scratchpad only. **Re-running
  `scripts/import-sdll.mts` overwrites these** with the platform's broken URLs, so re-apply afterwards. 32 players
  still have no reachable photo and show initials.

## PLAYER CARD + NAME SEARCH — LIVE 2026-09-29 (merge abad035; the SQL addendum was run)
- Player card after the phone lookup (big photo, ★ Team owner badge, category, role, S1 stats), name-search fallback
  for numbers not on file ("matched by name" flag), S1 export import + archive enrich (adds phoneless players,
  e.g. Kanishk Sheel / Nikhil Dhingra of the Gurugram Spartans SARDA squad).
- DONE: ran the "2026-09-29 addendum" at the bottom of `supabase/registration_schema.sql` (phone nullable,
  is_owner/category/sold_amount/stats, registrations.matched_by). Then:
  `node scripts/import-master.mts "SDLL S1=<Drive: Player registered and owners/FINAL Post Auction Summary - SSL Season 1.xlsx>" "SARDA S6=<For_owners_final_auction_list_7th_Aug.xlsx>" --write`
  → `node scripts/enrich-master.mts` → e2e test → merge. Dry run: 711 players with a mobile (293 S1 + 521 SARDA,
  101 overlap), 36 owners. (Sheet "Post Auction Export"; the xlsx lib reads it only through openpyxl-safe paths.
  Node's xlsx reads the SARDA sheet fine.)
- player_master = **899** (711 with a phone incl. 36 owners, plus 188 phoneless from the archive). Master photos were repaired from the pool (64).
- Home carousel: DONE with Nikhil's picks 20,21,22,42,57,58 (`brand/gallery/k01–k06`). Candidates he may add: 23, 43, 44–56, 59–62.
- (old note) Home carousel: Nikhil wants ONLY photos of Kanishk bhaiya presenting awards. He's picking the numbers from
  https://claude.ai/artifact/J37YaFbzen4xBKHeSoeBzX (63 photos from Drive `FINALS DATA/MOM & FOM`). Don't guess by face.

## PLAYER REGISTRATION — LIVE 2026-09-29 (merge db41545)
- `/register` (public): mobile → lookup in `player_master` → returning player confirms ("This is me") + kit +
  LinkedIn + ₹3,000 fee tick; new player fills name, DOB (**min age 30**, enforced client + server), email,
  CricHeroes, LinkedIn, role pills, photo, Aadhaar, kit, fee tick. One registration per phone per season
  (`unique(season, phone)`). Files go browser → PRIVATE bucket `registrations` via signed upload URLs
  (Vercel's ~4.5 MB body cap rules out routing them through a server action).
- `/admin/registrations`: New / Under review / Approved / Rejected tabs; LinkedIn "500+ ✓" / "Under 500" manual
  tick; Approve without the 500+ tick → Under review. Photo/Aadhaar shown via 1-hour signed URLs.
- Tables `player_master` + `registrations` exist (Nikhil ran `supabase/registration_schema.sql` on 29 Sep). RLS on, no
  policies; verified that the anon key reads 0 rows from both.
- `player_master` = **521 SARDA S6 players** (`scripts/import-master.mts`, from the "SSCL6 Registrations" sheet),
  enriched by `scripts/enrich-master.mts` (CricHeroes-id match against the archive + pool: 407 photos, 226 teams).
  **The SDLL platform has phones for only 1 of 295 players**, so the rest of the ~723 need Nikhil's master file:
  `node scripts/import-master.mts "SDLL S1=file.xlsx" … --write`, then `node scripts/enrich-master.mts`.
- E2E tested with Playwright (under-30 blocked, new player, returning player, duplicate). Test rows and files deleted.
- Not built yet: approving a player doesn't add them to the auction pool (`scout_players`). That's the next step.
- Sponsors: `logoSize()` in `src/app/sponsors.ts` gives each logo equal area (square marks no longer tiny).

## LANDING PAGE + SPONSOR BAR — LIVE 2026-09-29 (commit 0d4b724)
- `/` is now the **public** league landing page (proxy allows "/" as an exact match only). It shows Season 1
  honours (ACCI champions in a gold frame, Goan Monks runners-up in silver), an award-photo carousel
  (replaced 2026-09-30 — see LATEST), registration steps + the ₹3,000 fee note, and the sponsor wall. Signed-in users get quick links.
- `SponsorBar.tsx` sits under the masthead on **every** page: title sponsor PlayfulNeuro + "Presented by"
  Playful Ventures fixed, 9 partners in a marquee. Sponsors and their roles live in `src/app/sponsors.ts`.
- Assets come from the league Drive "SLL'26 - Repository" (public link, folder id 1QVhk_CVlXpVctdO3VKJnjw5Y5OouOJ4S):
  the logos were cut from `Grounds PRINTABLES/SPONSOR STRIP (1).png`, the honours from `Final AVs/Stills/*.pdf`, and the
  photos from `FINALS DATA/MOM & FOM` (full-size downloads get rate-limited, so they're fetched via
  `drive.google.com/thumbnail?id=…&sz=w1600`). Everything is in `src/app/brand/{sponsors,season1,gallery}`.
- ⚠️ **DEPLOYS NOW HAPPEN ON EVERY PUSH TO `main`.** The Vercel project has GitHub integration (alias
  `gurugram-spartans-auction-git-main-…vercel.app`), so pushing 0d4b724 put the landing page live without a CLI deploy.
  Everything below saying "no Git integration / CLI only" is out of date. Treat every push to main as a production
  release; use a branch for work in progress (branch pushes get preview URLs).
- The Vercel **Preview** environment has NO Supabase env vars (only Production does). A CLI preview needs them passed
  per deploy: `-b NEXT_PUBLIC_SUPABASE_URL=… -b NEXT_PUBLIC_SUPABASE_ANON_KEY=… -e (same two) -e SUPABASE_SERVICE_ROLE_KEY=…`.
- `vercel link` rewrites `.env.local` from the Development env: the Supabase keys survive, but the SDLL_EMAIL/PASSWORD
  lines get dropped. Re-add them afterwards.
- Next up: the `/register` form (phone lookup against Nikhil's master player file) + the admin review queue.

## STATUS AUDIT 2026-09-29 — fix before SDLL auction day
Site map + status page: https://claude.ai/artifact/Lbv7FNUzAKaXoe6AijMZyo (private to Nikhil).
- The board, /squad, /my-team and /players/[id] still run in **prototype mode on borrowed SARDA S6 squads**
  (`teams.source_team_id` → `sccl_s6_players`, 443 assigned). 0 SDLL `scout_players` sold.
- **Owners: 0/12 SDLL teams have `owner_profile_id`.** 4 owner profiles exist from the SARDA prototype.
- `/auction` shows the 2 `is_mock` teams (UP Warriors, Japani Tsunami) and hides Lucknow Strikers + Bhojpuri
  Dabangs. The filter in `src/app/auction/page.tsx` is `source_team_id != null || has buys` and never checks `is_mock`.
- Gurugram Spartans purse is ₹4,00,000 while every other team has ₹3,00,000. Confirm with Nikhil.
- `/jersey` is meant for players, but `src/proxy.ts` only allows `/login`, `/auction`, `/squad` publicly → players
  can't open it. `/schedule` also needs a login now (contrary to the schedule section above).
- A stale SARDA-season `auction_lot` row has been `status='live'` since 14 Aug. Harmless: `isAuctionLive()` reads only the SDLL season.

## Pending / next
0. **PARKED (2026-09-30): mobile app.** Plan if revived: (1) PWA first — manifest + icons + minimal service
   worker, installable on Android/iOS, no store; optional push ("Auction is live"). (2) Play Store via Trusted Web
   Activity (Bubblewrap) — needs a Google Play dev account ($25 one-time). (3) iOS App Store is not advised
   (Apple rejects thin web wrappers; $99/yr).
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

## "Match with USCL" button (3 Oct 2026)
War Room admin pad → **⟳ Match with USCL**. The site never holds the USCL password: the button writes
`ops/uscl-match/request.json` (private Supabase bucket `ops`); `scripts/uscl-match-watch.mjs`, running on
Nikhil's Mac (`U=… P=… PY=<venv python> caffeinate -i node scripts/uscl-match-watch.mjs`), sees it within ~8 s,
runs uscl-fetch.py + uscl-reconcile.mts --apply (never --hide-gone, never the live lot) and writes
`report.json`; it also runs itself every 15 min 3–11 pm IST and posts a heartbeat (panel shows checker online/offline).
A match takes ~40 s. Mac must be on/awake with the checker running.
