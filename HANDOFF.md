# Handoff — Gurugram Spartans Auction App

_Local Claude memory does not transfer across machines — this file is the source of truth. Last updated 2026-08-11._

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

## NEXT UP — Ball Library ↔ Analysis cross-link (cross-repo; user wants **UI redesign FIRST**)
Ball Library = **static site in the LMS repo** at `public/spartans/` (`index.html`, `manifest.json` = `{team, match_count, players[]}`, `players/*.mp4`). 20 players, ball-by-ball logs w/ pitch coords, **1 match so far (vs ACCI)**. Deep-link: **`/spartans?p=<kind>-<name>`** (e.g. `?p=batter-Abhinav Jain`; `kind` ∈ batter|bowler).
User's asks: (1) two-way link profile↔library, (2) **better UI (do first)**, (3) add more matches / enrich.
- Profile → library: on `/scout/[id]`, show a "Ball Library" button when the player has clips — read `manifest.json` live so it auto-updates as matches are added → link `/spartans?p=<kind>-<name>`.
- Library → profile: add "Analysis ↗" per player → `/spartansscout/scout/<uuid>`; map by name. **11/20 match the auction DB exactly**; near-matches to hardcode: Nitin→Nitin Yadav, Vikas 10→Vikas Grover, Russell→Russell Stamets, Vishal Salgy→Vishal Salgotra, Naveen Gujjar→Naveen (Gujjar) Tanwar. No profile: Asgar Khan, Rajiv Rishi, Kundan, Chandan Jha (opponents).

## Handy scripts (`scripts/`, run with `node scripts/*.mts` — Node 26 strips TS types)
- `import-from-api.mts` — full re-import from Anantanity (⚠️ replaces pool; would overwrite manual squad — don't run casually now).
- `extract-roster.py` (owners/retained categories from the Team-Owners xlsx colours), `import-final-list.mts` (xlsx import).
