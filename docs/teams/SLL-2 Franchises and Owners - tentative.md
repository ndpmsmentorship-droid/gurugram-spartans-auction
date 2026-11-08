# SLL-2 franchises and owners — tentative working list

_Working copy, last updated 8 Nov 2026 (Nikhil's list; Bengal Tigers and Chennai Thalaiva excluded). Not for circulation. The League's last
official list is [`SLL-2 Franchises and Owners (5 Nov 2026).pdf`](SLL-2%20Franchises%20and%20Owners%20(5%20Nov%202026).pdf)
(`teams.html`); this file is ahead of it and should be re-issued as the official list once
confirmed._

## The franchises (as of 8 Nov 2026)

| # | Franchise | Owner(s) | Owners | Portal login | Change since 5 Nov list | Still awaited |
|---|---|---|---|---|---|---|
| 1 | The American Cricket Club of India (ACCI) | Vishal Salgy, Russell Stamets, Pradeep Mahalawat | 3 | `theacciowner` | Full name was "American Club of India"; owners were spelled Russel A., Pardeep | — |
| 2 | Lucknow Strikers | Luvi Grover, Prashant Yadav | 2 | `lucknow` | "Luvkesh" → Luvi Grover | — |
| 3 | Goan Monks | Aditya Prakash Sharma, Sameer Bhalla | 2 | `goanmonks` | Aditya Sharma → full name | — |
| 4 | Punjab Warriors | Sunil Bansal | 1 | `punjab` | Renamed from Punjab Royals | New logo (old one is Punjab Royals) |
| 5 | Tokyo Drifters | Vikram Chaddha, Saurabh Anand, Sumit Talwar | 3 | `tokyodrifters` | — | Logo |
| 6 | Gurgaon Knights | Ayush Jagga, Sajal Sharma | 2 | `gknights` | Was "Gurugram Knights"; Sajal Sharma added | Logo; see note on Sajal |
| 7 | UP Warriors | Sandeep Kumar, Bharat Sharma | 2 | `upwarriors` | — | Logo |
| 8 | Jaipur Royals | Saurav Suneja | 1 | `jaipur` | Hemant Kumar no longer listed | Confirm Hemant Kumar is out |
| 9 | Team 9 (name awaited) | Puneet Jain, Sandeep Bharadwaj | 2 | none | Was "Puneet's team / SLL 13"; Sandeep Bharadwaj added | Team name, logo, login |
| 10 | Team 10 | _in consideration_ | 0 | none | Was "SLL 14 / name awaited" | Franchise, owners, name, logo |
| 11 | Diplomats | _to be announced_ | 0 | none | Was "Diplomats 1" | Owners, logo |
| 12 | Diplomats | _to be announced_ | 0 | none | Was "Diplomats 2" | Owners, logo; two teams can't share a name |

**Totals:** 12 franchises listed · 9 with owners · 18 owners named (out of 36 possible places,
3 per team) · 8 portal logins already exist for these teams.

## Excluded for now (Nikhil, 8 Nov 2026)

- **Bengal Tigers** (Dipak Kumar Singh, K. Raj Bhansali) — on the 5 Nov official list; has a
  portal login `thebengaltigers` and a logo.
- **Chennai Thalaiva** (Vasant Kumar) — on the 5 Nov official list; has a portal login
  `chennai` and a logo.

The league is therefore planned as **12 teams, not 14**. Still to follow from that:
- [ ] Schedule: rebuild for 12 teams (the 3 Nov schedule is 2 groups of 7, 45 matches, one game
      per team per weekend) — and decide the format (2 groups of 6 → 30 league matches + 2 semis +
      final = 33, or another format). Rule 5.2 (six league matches each) and the dates may change.
- [ ] Rule book: Rule 5.1 (14 teams, groups of seven) and Rule 2.15 (A places = 14 × 6 × 1.25 =
      105; for 12 teams = 90) need a new version.
- [ ] App: disable the two owner logins and remove the two teams from the active season
      (`teams` table, `src/app/franchises.ts`) — production change, needs Nikhil's go-ahead.
- [ ] Re-issue the official franchise list; update the sponsor deck, owners' deck and the plan.
- [ ] Tell both franchises in writing.

## Notes

- **Sajal Sharma** (Gurgaon Knights): TODO.md lists a "Sajal" on the League's core admin team.
  If that is the same person, an owner with League admin access can see other teams' data —
  decide how that's handled (captains' meet item E1) and give them an owner-only login.
- Team names and logos are allotted and owned by the League (decided 8 Nov), so the
  renames above (Punjab Warriors, Gurgaon Knights) are the League's call; the app
  (`src/app/franchises.ts`, the `teams` table) still uses the 5 Nov names.
- Groups are left out on purpose: Rule 5.1 says groups are decided by lottery, and the 3 Nov
  draw assumed 14 teams.

## What each franchise still has to give the League

From the draft Franchise Participation Agreement and the Rules (3 Nov):

- Signed agreement (League + franchise + every owner) — none yet
- Fee: 60% (₹3,00,000 + GST) by **5 Dec 2026**, 40% (₹2,00,000 + GST) by **15 Jan 2027**
- Owner KYC: PAN, Aadhaar/passport, address, DOB, LinkedIn; CricHeroes link for playing owners
- Lead owner + the up-to-3 owners cleared for the auction table (Rule 12.1)
- Playing owners: up to 2 Category A (aged 40+), at least 1 Category B (35+), none under 35
  (Rules 6.4, 6.11)
- Retained players, if any: 1 A + 1 B, both 40+, SLL-1 players only (Rule 6.5)

## Change log

- 8 Nov 2026 (later) — Nikhil's updated list: 12 teams; ACCI full name and owner spellings;
  Luvi Grover; Aditya Prakash Sharma; Punjab Royals → Punjab Warriors; Gurugram → Gurgaon
  Knights + Sajal Sharma; Jaipur without Hemant Kumar; Team 9 = Puneet Jain + Sandeep
  Bharadwaj; Team 10 in consideration; Bengal Tigers and Chennai Thalaiva excluded for now (confirmed by Nikhil).
- 8 Nov 2026 — first tentative list, built from the 5 Nov official list.
- Earlier: SLL 10 → Tokyo Drifters (5 Nov); Lucknow owner is Prashant Yadav, not Dr. Rohan;
  Gurugram Spartans → Gurugram Knights; the SCCL 6 "Team Owners" sheet (24 teams, used in Sep)
  is **not** the SLL-2 list.
