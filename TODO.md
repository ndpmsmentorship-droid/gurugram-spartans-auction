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
- [x] Registration: declarations, veg/non-veg, food allergies live (SQL run, tested end to end) — 30 Sep
- [x] Landing: Manoj Tiwari + Kanishk hero, countdown, road to Season 2, owners in franchise cards, mosaic gallery, live-now bar — 30 Sep
- [x] Landing page redesigned on SARDA lines in the SDLL brand kit (hero, stats, about, honours, franchises, owners, gallery, sponsors, opportunities, footer) — 30 Sep
- [x] Master admin login `sdlladmin` created (full admin; password shared in chat, not stored in files) — 30 Sep
- [x] Approved registrations → auction pool (Add to pool / Add all / Remove, category picker) — 30 Sep
- [x] Quotation with the Launch Partner Package (₹10L + GST), in the name of Foundary Tek, for Playful Ventures — 30 Sep
