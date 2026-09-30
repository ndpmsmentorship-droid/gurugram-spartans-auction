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
- [ ] Approved registrations flow into the auction pool
- [ ] Remove the mock teams from the board; add Lucknow and Bhojpuri
- [ ] Link the 12 team owner logins
- [ ] Set DEMO_MODE = false at launch (src/app/site-config.ts)
- [ ] 32 players still show initials instead of a photo
- [ ] More Kanishk award photos for the carousel (candidates on the picker: 23, 43, 44–56, 59–62)

## Paid add-ons (Phase 2, only if ordered)
- [ ] AI scout chat
- [ ] Squad tracker
- [ ] Mobile app (parked): installable web app first, then Play Store

## Security
- [ ] Revoke the Vercel token that was pasted in chat (Vercel → Account Settings → Tokens)

## Done
- [x] Quotation with the Launch Partner Package (₹10L + GST), in the name of Foundary Tek, for Playful Ventures — 30 Sep
