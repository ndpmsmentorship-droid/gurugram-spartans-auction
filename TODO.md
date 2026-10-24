# SDLL Portal — To-do

Running list. New items go under the right heading; tick with `[x]` when done (move to Done at the bottom).
Last updated: 2026-10-24

## Domain and hosting (Playful Ventures)
- [ ] Confirm Playful Ventures owns playfulventures.com and playfulventures.in (both on GoDaddy, owner hidden)
- [ ] Decide: subdomain (auction.playfulventures.com / sdll.playfulventures.com) or a new domain
      (free on 30 Sep: playfulleague.com/.in, playfulscout.com/.in, playfulcricket.com/.in, shantidevileague.com/.in)
- [ ] Avoid "playfulauction" — playfulauction.com is an unrelated adult chat/auction site
- [ ] Playful Ventures adds the DNS record at GoDaddy (or buy the new domain)
- [ ] Add the domain to the Vercel project (keep the project in our account)
- [ ] Decide whether the portal serves at the domain root (needs a basePath change) or at /spartansscout

## Quotation and contract
- [x] League entity for all legal agreements = Playful Ventures Pvt Ltd (Nikhil, 11 Oct); legal brief for counsel: https://claude.ai/code/artifact/975f6099-a6fc-4e4a-8fa7-dfbd1387e7e5
- [ ] Auction Rules & Regulations — ON HOLD (Nikhil, 11 Oct: rules still change a lot). Notes parked in the "On hold: Auction rules" tab of the legal brief; finalise and send to the lawyer before the 2 Jan 2027 auction
- [ ] Confirm the company spelling: "Foundary Tek Private Ltd" vs "Foundry" (must match the incorporation certificate)
- [ ] Add GSTIN, CIN and registered address for Foundary Tek and Playful Ventures to the quotation header
- [ ] Confirm my suggested numbers: ₹2.5L per season from Season 3, ₹4,000 per match for the Ball Library
- [ ] Send the quotation (PDF: ~/Downloads/SDLL-Portal-Quotation-Foundary-Tek.pdf)
- [ ] Meeting and demo with Playful Ventures
- [ ] Draft the MSA + SOW (Foundary Tek ↔ Playful Ventures): IP stays with Foundary Tek, non-exclusive licence, 40/40/20
- [ ] Lawyer review, e-stamp / eSign
- [ ] Invoice the 40% advance (₹4,00,000 + GST)
- [ ] Keep the work register up to date — add every product change and service the day it's delivered: https://claude.ai/code/artifact/309e6ebf-c086-4b96-8d4c-91700e7e725f (bill to Playful Ventures Pvt Ltd; services at ₹2,500/h, est. hours to confirm)
- [ ] Raise change requests for the built Phase 2 add-ons (venue mode ₹85,000, War Room/squad tracker ₹1,48,750) and the services (₹1,70,000 est.) before invoicing

## Portal — before the Season 2 auction
- [ ] Check the live board shows exactly the 12 SDLL teams (Lucknow and Bhojpuri are in the DB)
- [ ] Header shows "AUCTION LIVE" because a lot was left live on 29 Sep — pass/withdraw it before demos
- [ ] Link the 12 team owner logins (2 done: ACCI, Bengal Tigers) — need the other 10 owners' emails
- [ ] Set DEMO_MODE = false at launch (src/app/site-config.ts)
- [ ] 32 players still show initials instead of a photo
- [ ] More Kanishk award photos for the carousel (candidates on the picker: 23, 43, 44–56, 59–62)
- [ ] Instant SOLD clips for Instagram (quoted 13 Oct, FT-Q-2026-02 Part A features 50–55, inside the ₹5L Portal): on every `sell` event, auto-render a 9:16 reel (player photo + stats, bid war replayed, SOLD stamp, team crest + price, SDLL/sponsor branding), caption + hashtags, phone download page for the social team to post live. Need from league: Instagram handle, hashtags, sponsor logos for clips; decide if hall camera footage is added

## USCL auction — Sat 3 Oct (demo for Gurugram Spartans)
- [x] USCL season, 14 franchises, ₹3L purses, deck rules, 318-player pool + Spartans' 5 staged and switched in
- [x] War Room (/war-room): max safe bid, category slots, gaps + top-5 fits, on-the-block card, rivals, alternatives
- [x] ★ Death / ★ Powerplay stars from 26 SARDA S6 + USCL E1 matches; bowling tags; ▶ clips links (99 players)
- [x] Playful Ventures logo on CricVideos
- [x] No helper: War Room auction pad — Nikhil calls up each player and records sold/unsold/undo/RTM himself on the owner login (USCL only) — 1 Oct
- [ ] Friday 2 Oct: Nikhil solo dry run of the auction pad on his phone
- [x] USCL soft launch: owner login for all 14 franchises (`scripts/uscl-owner-logins.mts`, list in ~/Downloads/uscl-owner-logins.csv), per-owner wishlist, USCL masthead/login/nav, recording admin-only — 2 Oct
- [ ] Nikhil Tandan → Japani Tsunami ₹3,000 recorded on 2 Oct (not by Claude) — confirm real or undo
- [ ] Other 13 teams' owner/retention spends (so rival purses are exact) — Nikhil sending a screenshot
- [x] RTM: 6 existing franchises = Bengal Tigers, Chennai Thalaiva, Delhi Devil, Lucknow Lagers, Punjab Royals, Royal Challengers Gurgaon (Spartans hold none). Admin RTM panel + War Room RTM watch — 1 Oct (needs supabase/uscl_rtm.sql)
- [ ] Ask USCL: does a declined RTM still use up that franchise's RTM? (built as: only a matched RTM counts)
- [x] USCL section on the CricVideos page (?league=uscl): 96 pool players on film, by category, Bat/Bowl links — 1 Oct
- [ ] After the auction: `node scripts/league-switch.mts sdll`, set LEAGUE = "sdll", push

## League tech for other leagues — not priority (Nikhil, 15 Oct: start 16 Oct)
For league owners who reach us from the Instagram posts (08 league owners, 09 auction platform).
- [ ] Demo league: a fictional league (made-up name, teams, ~60 players, logo) on its own season — no SDLL/USCL names or real players
- [ ] Demo walkthrough: registration form → player pool → admin console → live big-screen board → War Room/owner login → results and league site
- [ ] Demo logins: a view-only owner login + an auctioneer pad that resets on a timer, so prospects can try bidding themselves
- [ ] Short screen-recorded demo video (2–3 min) + 1-page PDF pitch for WhatsApp
- [ ] Price sheet / packages: registrations only, + auction, + league site, + CricVideos ball library (base on FT-Q-2026-02)
- [ ] Onboarding checklist for a new league: what we need from them (logo, teams, purses, rules, categories, dates, domain)
- [ ] Enquiry intake: a "League tech" page or form on ndpms.in feeding WhatsApp/email, linked from the Instagram bio
- [ ] Confirm with Playful Ventures what of the SDLL build we may show other leagues (IP stays with Foundary Tek; their branding off the demo)

## Client feedback — registration form (30 Sep)
- [x] 1. Declaration: "my information is true" (checkbox) — live
- [x] 2. Consent: "I will share important documents if asked" (checkbox) — live
- [x] 3. Veg / non-veg — live
- [x] 4. Food allergies — live
- [ ] 5. "Only Shanti Devi … other leagues" — clarify: a declaration to play only SDLL this season, or a question listing other leagues played?
- [ ] 6. "Attire professional" — clarify: profile photo in professional attire (guidance on the photo upload), or a dress code for the auction night?
- [ ] 7. Animated manual video — short explainer on how to register (script + animation), embed on /register
- [ ] 8. Player Terms & Conditions + 4th tick box + "non-refundable" fee wording — BUILT on local branch `player-terms` (b4e823f), NOT live: Nikhil said wait for the lawyer (11 Oct). When approved: apply the lawyer's edits (bump TERMS_VERSION in register/shared.ts), merge to main, run the 2026-10-11 addendum in supabase/registration_schema.sql (terms_version column; the code saves without it until then)

## Landing page — content needed from the league
- [ ] A message from Kanishk / the league director (quote + photo) for the About section
- [ ] Promo or highlights video link (YouTube) for a "Watch" section
- [ ] Sponsorship contact (email / phone) for a "Become a sponsor" button
- [ ] Social links (Instagram, YouTube, Facebook) for the footer
- [ ] Season 1 reach numbers (views, followers, registrations) — only verified figures
- [ ] Owners' titles and companies for the owner cards (SARDA-style)
- [ ] More gallery photos (auction night, finals, team shots)
- [ ] Put the 12 team logos on the teams table so the live board, squads and schedule show them too

## Ideas (suggested, not yet agreed)
- [ ] Owner self-serve "Change password" (USCL franchise portal has it; ours doesn't)
- [ ] One-screen owner home in the USCL style: purse left / spent / squad / wishlist tiles, then pool with one-tap wishlist
- [ ] Share card after registering: "I'm in SDLL Season 2" image for WhatsApp/Instagram — free marketing
- [ ] Registration status check by mobile number (fewer calls to organisers)
- [ ] Excel export for admins: registrations list + kit order sheet (jersey name, number, sizes) for the vendor
- [ ] Auction countdown on the landing page; "Auction live" only when a lot is really live
- [ ] "SOLD" moment on the live board (stamp animation + sound) and a projector view
- [ ] Post-auction team sheets: one shareable page/PDF per team
- [ ] Sponsor report: page views and logo impressions per sponsor — helps sell Season 3 sponsorships
- [ ] Public player profile pages linking to their Ball Library clips

## Paid add-ons (Phase 2, only if ordered)
- [ ] AI scout chat
- [ ] Squad tracker
- [ ] Mobile app (parked): installable web app first, then Play Store

## Security
- [ ] Give the client their own admin login instead of sharing `sdlladmin`, so access can be removed per person
- [ ] Revoke the Vercel token that was pasted in chat (Vercel → Account Settings → Tokens)

## Done
- [x] Registration: live name suggestions, auto lookup on a full mobile, FAQ — 30 Sep
- [x] USCL S2 pool (319) merged into player_master: 204 matched + gap-filled, 115 new (photos copied, no phones) — master 1014 — 30 Sep
- [x] Registration: declarations, veg/non-veg, food allergies live (SQL run, tested end to end) — 30 Sep
- [x] Landing: Manoj Tiwari + Kanishk hero, countdown, road to Season 2, owners in franchise cards, mosaic gallery, live-now bar — 30 Sep
- [x] Landing page redesigned on SARDA lines in the SDLL brand kit (hero, stats, about, honours, franchises, owners, gallery, sponsors, opportunities, footer) — 30 Sep
- [x] Master admin login `sdlladmin` created (full admin; password shared in chat, not stored in files) — 30 Sep
- [x] Approved registrations → auction pool (Add to pool / Add all / Remove, category picker) — 30 Sep
- [x] Quotation with the Launch Partner Package (₹10L + GST), in the name of Foundary Tek, for Playful Ventures — 30 Sep

## 3 Oct 2026
- [x] Live board: "Still available" count (was blank); "Players signed" label
- [x] Ball Library: 14 USCL owner logins (same as auction, watch-only, expire 12 am Sun 4 Oct IST); "Back to USCL Auction" pill
- [x] RTM per rulebook: revised bid → matched / declined (pad)
- [x] Smart pool search + clickable "What we need next"
- [x] Ball Library panel (clips, phases, pitch map, wagon wheel) in the block card + profiles — library ?embed=1,
      LMS next.config.ts framing relaxed to SAMEORIGIN / frame-ancestors 'self' (Nikhil approved, TEMPORARY)
- [x] ⚠ self-reported flag on doubtful USCL stats (block card chip, pool, suggestions)
- [x] USCL auto switch-off at 12 am Sun 4 Oct IST (src/lib/league.ts USCL_CLOSES_AT): owners signed out + refused,
      admin only; ndpms.in USCL band + library back-pill hide themselves; owner library passes expire
- [ ] AFTER THE AUCTION (4 Oct): LMS next.config.ts → X-Frame-Options DENY + frame-ancestors 'none' (security back)
- [ ] AFTER THE AUCTION: `node scripts/league-switch.mts sdll`, LEAGUE = "sdll", push; remove USCL band code from cricvideos-home.tsx
- [ ] Check Shubhendu Kaushik's stats (500 mat / 20000 runs / SR 190 / econ 4 look like test values)
- [ ] 44 USCL pool players have doubtful self-entered stats (e.g. Shubhendu Kaushik 500 M / 20000 runs / SR 190 / econ 4; Vishal Tiwari avg 4668) — copied as-is from the USCL site
- [x] Final check 3 Oct: 14 owner logins OK (own War Room, no pad, /admin blocked), DB squads = official deck, rules = rulebook, RLS/RPC lock verified, public pages OK
- [ ] Library sign-in cap: 20 tries / hour per connection (LMS pass route `tooMany("pwlogin", ip, 20, 60)`) — owners on one venue Wi-Fi share it; raise for auction day only if Nikhil OKs
- [x] 3 Oct reconcile vs official USCL site: +Karan Sharma (B); Satish Kumar (Legend) hidden (left the pool); Japani owner Shashank Verma → Sachin Khatana (B, ₹3K, per public franchise page); Nikhil Tandan test sale removed; Ankit Bhargava (45) A→B; 12 players 34→35 per USCL ages (out of the 31–34 band); library sign-in cap 200/h until midnight
- [x] "Match with USCL" War Room button + Mac checker — 3 Oct
- [ ] Nitin Ruhela: deck = Chennai retained, USCL pool still lists him available — ask organisers
- [x] Spartans bought the ₹50,000 top-up (purse ₹2,25,000) — confirmed by Nikhil 3 Oct

## 4 Oct 2026 — after the USCL auction
- [x] Back to SDLL (league-switch sdll, LEAGUE = "sdll"), USCL owner logins banned, library framing DENY, ndpms.in band removed
- [ ] USCL Spartans data left as-is: Amit Sehrawat (39 or 40?) unrecorded; 2nd ₹25K top-up unrecorded (official spend ₹2,37,000)
- [x] SDLL big screen `/auction/screen` + operator pad `/admin/auction/pad` (4 Oct): one tap/key per team bids the next step, Enter = sold, Backspace = take back a bid
- [ ] Before 2 Jan 2027: clear the test rows from `auction_event` (the lot # counts put-ups), run a dry auction on the pad, swap sponsor placeholders for the S2 deck's signed partners
- [ ] Auction day only (approved): re-enable Ball Library framing for a clips panel on the big screen; put DENY back afterwards
- [x] SDLL pool = every player captured so far: 1,050 (295 SDLL + 321 USCL + 434 SARDA S6), deduped by CricHeroes id / name+age; new rows source_id `pool:uscl:…` / `pool:sccl:…` (scripts/sdll-pool-merge.mts) — 4 Oct
- [ ] SDLL auction (Sat 2 Jan 2027): big-screen display + War Room; sponsors = partnership-deck placeholders; up next + recent sales; library embed ON for the auction screen (same-origin, like USCL day)
- [ ] S6 M27 (NCR v BKB): scripted in s6-tagger (top preset) — awaiting Nikhil's time-tag, then publish + merge_m27

## CricVideos Ball Library + Instagram — 24 Oct 2026
- [ ] Insta redesign: new font + design system for posts/reels/covers (Nikhil, 25 Oct: current look feels generic; reference One7 Sports' Instagram)
Library: 78 matches, 649 profiles, audit clean; ground page 42 S6 matches (par 186, 240+ never chased). Detail in ycwism-lms-src `public/spartans/HANDOFF.md`.
- [x] M45 Japani v ACCI time-tagged and merged (243/247, card-exact) — 24 Oct
- [x] M47 KEI v Texas time-tagged and merged (226/231, card-exact) — 25 Oct
- [x] M46 Delhi Knights v Patna time-tagged and merged (211/214, card-exact) — 24 Oct
- [ ] M38 Spartans v UP: final scorecard (only 10.1-over copies so far; ground counts UP 196/6, card 197/6); 17.4 slip
- [ ] Shot passes owed: M47 KEI v Texas (129 + 97). All earlier S6 matches done. USCL final + semi-final dropped (recording quality too poor to shot-tag — Nikhil, 24 Oct)
- [ ] Legend list: ask Nikhil for every Sarda team's legend (runs count double till 30) — known: Russell (ACCI), Vipul (Japani)
- [ ] Insta: post Nikhil Raina's 6 every-ball reels (reels/Nikhil Raina; captions + songs in "00 Profile, bio and captions.txt")
- [ ] Insta: Tarun Yadav carousel (15) — M37 now shot-tagged: re-render the pitch slide (clips.mjs), then post
- [ ] Insta: Raina reel captions — add results for S4 SF, USCL SF, BBL M25, BBL final if Nikhil confirms them
- [ ] Punjab Royals sixes reel: 2 sixes missing (4.5, 18.5) — re-download and rebuild
- [ ] ACCI v Bengal directions (no tag source)
- [x] M43 Japani v Bengal shot pass, both innings (Japani 124 pitch/104 dir; Bengal 104/91) — 24 Oct
- [x] M44 merged card-exact; M43 card in — 24 Oct
- [x] Time Tagger 1×/1.5×/2× speed button; Shot Tagger same (was 1/0.5/0.25) — 24 Oct
- [x] Shot Tagger lists only pending innings, hides < 20 balls left — 23 Oct
- [x] Ground page tagline under the header — 23 Oct
- [x] Nikhil Raina: 220 (74) sixes reel + 6 every-ball innings reels with covers/thumbs — 24 Oct
