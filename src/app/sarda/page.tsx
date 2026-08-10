import Link from "next/link";

export const metadata = {
  title: "SARDA Corporate Cricket League — Record",
  description: "How the SARDA Corporate Cricket League Season 6 was conducted, end to end.",
};

// A living record of how SCCL is run — from promotion to presentation — kept as a
// reference for future leagues (Shanti). Not linked in the nav; shared by URL.

const DIVISIONS: { name: string; teams: string[] }[] = [
  {
    name: "Elite",
    teams: ["ACCI", "Bengal Tigers", "Goa Monks", "Gurugram Spartans", "Jaipur Royals", "Japani Tsunami", "Punjab Royals", "UP Warriors"],
  },
  {
    name: "Challengers",
    teams: ["Bangalore KS Blasters", "Bharat Hunters", "Chennai Thalaivas", "Delhi Knights", "London Legends", "NCR Turbo Chargers", "Patna Panthers", "Uttarakhand Yoddhas"],
  },
  {
    name: "Fighters",
    teams: ["TDI Phoenix Giants", "Chandigarh Lions", "Haryana Titans", "J&K Homelanders", "KEI India Warriors", "Mumbai Titans", "Srinagar Sultans", "Texas Hold'em"],
  },
];

const PHASES: { tag: string; title: string; points: string[] }[] = [
  {
    tag: "Pre-season",
    title: "Branding & promotion",
    points: [
      "A dedicated social-media team was hired to run promotions and build hype in the weeks before the auction.",
      "Team jersey designs were finalised well ahead of the auction so kits were ready for the reveal.",
      "Venue was booked and the run-of-show (networking → auction → presentation) was planned in advance.",
    ],
  },
  {
    tag: "Registration",
    title: "Player registrations",
    points: [
      "766 players registered online through the league dashboard (anantanity), each with career stats and a photo.",
      "Every player was graded into a category: U35A, 35+A, 35+B, U35B, or Legend.",
      "Split — U35A 95 · 35+A 173 · 35+B 354 · U35B 116 · Legend 28.",
    ],
  },
  {
    tag: "Retentions & owners",
    title: "Cores locked before the auction",
    points: [
      "24 teams across 3 divisions; each team locked owners (playing) + retained players before auction day.",
      "Pre-auction costs deducted from the ₹2,00,000 purse — Owners: A ₹15,000 · B/Legend ₹6,000; Retained: A ₹20,000 · B/Legend ₹10,000.",
      "Non-playing owners carried no cost. 66 playing owners + 54 retained players in all.",
    ],
  },
  {
    tag: "Rules",
    title: "Auction regulations",
    points: [
      "Base price — 'A' ₹15,000 · 'B' ₹5,000. Maximum bid ₹65,000 (a tie is broken by sealed tender between ₹65,000–₹1,00,000).",
      "Raises — Category A in ₹5,000 steps; Category B & Legend in ₹2,000 steps.",
      "Squad — minimum 16, maximum 20 (incl. owners, retained & legend). Max 4 players aged 30–35 (max 3 in the playing 13); max 6 'A' in the playing 13; one Legend compulsory in the playing 13.",
      "Purse ₹2,00,000, top-up allowed up to ₹4,00,000. Bid overflow / squad shortfall returned at 60% of value.",
    ],
  },
  {
    tag: "Auction day",
    title: "The auction",
    points: [
      "2:00 PM networking, 2:30 PM auction start. Maximum 4 members from a team at the table.",
      "Dress code — league-provided polo T-shirts with black or blue lowers.",
      "In any dispute, the organizers held the right to the final decision.",
    ],
  },
  {
    tag: "Presentation",
    title: "Reveal & ceremony",
    points: [
      "The league trophy was presented on stage.",
      "An AV film was produced and displayed to launch the season.",
      "Final squads were shared live as sales rolled in.",
    ],
  },
];

function Section({ children, title }: { children: React.ReactNode; title?: string }) {
  return (
    <section className="mt-10">
      {title && <h2 className="mb-4 font-display text-xl font-bold tracking-tight">{title}</h2>}
      {children}
    </section>
  );
}

export default function SardaRecord() {
  return (
    <main className="mx-auto w-full max-w-4xl flex-1 px-4 py-10 sm:px-6">
      <p className="eyebrow">The record · for Shanti</p>
      <h1 className="mt-1 font-display text-4xl font-bold tracking-tight sm:text-5xl">
        SARDA Corporate Cricket League
      </h1>
      <p className="mt-2 max-w-2xl text-lg text-muted">
        How Season 6 was conducted, end to end — promotion, registration, retentions, the auction, and
        the presentation. Kept as a playbook for running the next league.
      </p>

      <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
        {[
          ["24", "Teams"],
          ["3", "Divisions"],
          ["766", "Registered"],
          ["Season 6", "Edition"],
        ].map(([v, l]) => (
          <div key={l} className="rounded-xl bg-wash px-4 py-3 text-center">
            <p className="font-display text-2xl font-bold">{v}</p>
            <p className="text-xs uppercase tracking-wide text-muted">{l}</p>
          </div>
        ))}
      </div>

      <Section title="How it ran">
        <ol className="relative space-y-6 border-l border-border pl-6">
          {PHASES.map((ph) => (
            <li key={ph.title} className="relative">
              <span className="absolute -left-[1.65rem] top-1 h-3 w-3 rounded-full bg-accent ring-4 ring-[var(--background)]" />
              <p className="eyebrow">{ph.tag}</p>
              <h3 className="mt-0.5 font-display text-lg font-bold">{ph.title}</h3>
              <ul className="mt-2 space-y-1.5 text-[0.95rem] text-muted">
                {ph.points.map((pt, i) => (
                  <li key={i} className="flex gap-2">
                    <span className="mt-2 h-1 w-1 shrink-0 rounded-full bg-muted" />
                    <span>{pt}</span>
                  </li>
                ))}
              </ul>
            </li>
          ))}
        </ol>
      </Section>

      <Section title="The 24 teams">
        <div className="grid gap-4 sm:grid-cols-3">
          {DIVISIONS.map((d) => (
            <div key={d.name} className="rounded-xl border border-border bg-surface p-4">
              <p className="eyebrow text-highlight-ink">{d.name}</p>
              <ul className="mt-2 space-y-1 text-sm">
                {d.teams.map((t) => (
                  <li key={t} className={t === "Gurugram Spartans" ? "font-semibold text-accent-text" : ""}>
                    {t}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </Section>

      <Section title="Gurugram Spartans">
        <p className="text-[0.95rem] text-muted">
          Our own campaign — the scouting, the index-based player analysis and the live auction board —
          is recorded in the app. See the{" "}
          <Link href="/squad" className="font-medium text-accent-text hover:underline">
            final squad
          </Link>{" "}
          and the{" "}
          <Link href="/auction" className="font-medium text-accent-text hover:underline">
            live squads board
          </Link>
          .
        </p>
      </Section>

      <Section title="Notes for Shanti">
        <div className="rounded-xl border border-dashed border-border p-4 text-[0.95rem] text-muted">
          <p>
            What worked, what to repeat, and what to change next time — to be added as we review Season 6.
            (Promotion cadence, venue logistics, kit timelines, auction pacing, budget/top-up rules, data &
            analytics.)
          </p>
        </div>
      </Section>

      <p className="mt-12 border-t border-border pt-4 text-xs text-muted">
        Internal record · not linked in the navigation.
      </p>
    </main>
  );
}
