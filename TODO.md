# SDLL Portal — To-do

Running list. New items go under the right heading; tick with `[x]` when done (move to Done at the bottom).
Last updated: 2026-09-30

## Domain and hosting (Playful Ventures)
- [ ] Confirm Playful Ventures owns playfulventures.com and playfulventures.in (both on GoDaddy, owner hidden)
- [ ] Decide: subdomain (auction.playfulventures.com / sdll.playfulventures.com) or a new domain
      (free on 30 Sep: playfulleague.com/.in, playfulscout.com/.in, playfulcricket.com/.in, shantidevileague.com/.in)
- [ ] Avoid "playfulauction" — playfulauction.com is an unrelated adult chat/auction site
- [ ] Playful Ventures adds the DNS record at GoDaddy (or buy the new domain)
- [ ] Add the domain to the Vercel project (keep the project in our account)
- [ ] Decide whether the portal serves at the domain root (needs a basePath change) or at /spartansscout

## Quotation and contract
- [ ] Confirm the company spelling: "Foundary Tek Private Ltd" vs "Foundry" (must match the incorporation certificate)
- [ ] Add GSTIN, CIN and registered address for Foundary Tek and Playful Ventures to the quotation header
- [ ] Confirm my suggested numbers: ₹2.5L per season from Season 3, ₹4,000 per match for the Ball Library
- [ ] Send the quotation (PDF: ~/Downloads/SDLL-Portal-Quotation-Foundary-Tek.pdf)
- [ ] Meeting and demo with Playful Ventures
- [ ] Draft the MSA + SOW (Foundary Tek ↔ Playful Ventures): IP stays with Foundary Tek, non-exclusive licence, 40/40/20
- [ ] Lawyer review, e-stamp / eSign
- [ ] Invoice the 40% advance (₹4,00,000 + GST)

## Portal — before the Season 2 auction
- [ ] Check the live board shows exactly the 12 SDLL teams (Lucknow and Bhojpuri are in the DB)
- [ ] Header shows "AUCTION LIVE" because a lot was left live on 29 Sep — pass/withdraw it before demos
- [ ] Link the 12 team owner logins (2 done: ACCI, Bengal Tigers) — need the other 10 owners' emails
- [ ] Set DEMO_MODE = false at launch (src/app/site-config.ts)
- [ ] 32 players still show initials instead of a photo
- [ ] More Kanishk award photos for the carousel (candidates on the picker: 23, 43, 44–56, 59–62)

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

## Client feedback — registration form (30 Sep)
- [x] 1. Declaration: "my information is true" (checkbox) — live
- [x] 2. Consent: "I will share important documents if asked" (checkbox) — live
- [x] 3. Veg / non-veg — live
- [x] 4. Food allergies — live
- [ ] 5. "Only Shanti Devi … other leagues" — clarify: a declaration to play only SDLL this season, or a question listing other leagues played?
- [ ] 6. "Attire professional" — clarify: profile photo in professional attire (guidance on the photo upload), or a dress code for the auction night?
- [ ] 7. Animated manual video — short explainer on how to register (script + animation), embed on /register

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
- [ ] Nitin Ruhela: deck = Chennai retained, USCL pool still lists him available — ask organisers
