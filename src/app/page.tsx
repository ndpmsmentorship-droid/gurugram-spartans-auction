import Image from "next/image";
import Link from "next/link";
import { getCurrentProfile } from "@/lib/auth";
import crest from "./brand/crest.png";
import acciChampions from "./brand/season1/acci-champions.jpg";
import goanRunnersUp from "./brand/season1/goan-monks-runners-up.jpg";
import acciLogo from "./brand/season1/acci-logo.png";
import goanLogo from "./brand/season1/goan-monks-logo.png";
import k01 from "./brand/gallery/k01.jpg";
import k02 from "./brand/gallery/k02.jpg";
import k03 from "./brand/gallery/k03.jpg";
import k04 from "./brand/gallery/k04.jpg";
import k05 from "./brand/gallery/k05.jpg";
import k06 from "./brand/gallery/k06.jpg";
import Season1Gallery, { type Slide } from "./Season1Gallery";
import { TITLE_SPONSOR, PRESENTED_BY, PARTNERS, logoSize } from "./sponsors";
import { DEMO_MODE, PORTAL_PAGES } from "./site-config";

// Public front door of the league (no login — see PUBLIC_PATHS in proxy.ts).
// Season 1 honours lead the page: ACCI (champions) and Goan Monks (runners-up).
// Carousel: the award photos Nikhil picked (Kanishk presenting), from the
// league's Drive (SLL'26 Repository › FINALS DATA › MOM & FOM), resized.
// Picked by number from the 63-photo sheet; add more the same way.
const SLIDES: Slide[] = [
  { src: k01, caption: "Match awards · Opening day · 14 Mar 2026" },
  { src: k02, caption: "Match awards · Opening day · 14 Mar 2026" },
  { src: k03, caption: "Match awards · 15 Mar 2026" },
  { src: k04, caption: "Match awards · 22 Mar 2026" },
  { src: k05, caption: "Match awards · Season 1" },
  { src: k06, caption: "Match awards · Season 1" },
]

// Identical blocks so the two finalists line up; only the frame (gold vs
// silver) and the sheen mark the champions.
const HONOURS = [
  {
    team: "American Cricket Club of India",
    title: "Champions",
    note: "ACCI lifted the first Shanti Devi Legend's League trophy.",
    logo: acciLogo,
    banner: acciChampions,
    gold: true,
  },
  {
    team: "Goan Monks",
    title: "Runners-up",
    note: "Goan Monks reached the Season 1 final against ACCI.",
    logo: goanLogo,
    banner: goanRunnersUp,
    gold: false,
  },
];

const STEPS = [
  {
    title: "Register",
    body: "Played with us before? Enter your phone number and your profile comes up ready. New players fill one short form.",
  },
  {
    title: "Review",
    body: "The league checks every registration before the auction pool is published.",
  },
  {
    title: "Auction",
    body: "Twelve franchises bid live for their squads. Selected players pay the ₹3,000 registration fee.",
  },
];

export default async function Home() {
  const profile = await getCurrentProfile();

  const portal =
    profile?.role === "admin"
      ? [
          { href: "/admin/auction", label: "Auction console" },
          { href: "/scout", label: "Player pool" },
          { href: "/admin/owners", label: "Team owners" },
          { href: "/schedule", label: "Schedule" },
        ]
      : profile?.role === "owner"
        ? [
            { href: "/my-team", label: "My squad" },
            { href: "/my-team/targets", label: "Targets" },
            { href: "/auction", label: "Live board" },
            { href: "/schedule", label: "Schedule" },
          ]
        : null;

  return (
    <main className="flex flex-1 flex-col">
      {/* ---------- hero ---------- */}
      <section className="band relative overflow-hidden text-white">
        <div
          aria-hidden
          className="pointer-events-none absolute -right-24 -top-24 h-[420px] w-[420px] rounded-full opacity-[0.07]"
          style={{ background: "radial-gradient(circle, #fff 0%, transparent 70%)" }}
        />
        <div className="relative mx-auto grid max-w-[1200px] items-center gap-8 px-4 py-12 sm:px-7 md:grid-cols-[auto_1fr] md:py-16">
          <Image
            src={crest}
            alt="Shanti Devi Legend's League crest"
            className="mx-auto h-40 w-auto drop-shadow-[0_18px_30px_rgba(0,0,0,0.45)] md:h-56"
            loading="eager"
            fetchPriority="high"
            sizes="220px"
          />
          <div className="text-center md:text-left">
            <p className="font-mono text-[0.688rem] uppercase tracking-[0.24em] text-white/60">
              {TITLE_SPONSOR.name.replace(" Development Centre", "")} presents · Season 2
            </p>
            <h1 className="mt-3 text-[2.6rem] leading-[0.95] sm:text-6xl">
              Shanti Devi
              <br />
              Legend&apos;s League
            </h1>
            <p className="mx-auto mt-4 max-w-xl text-white/75 md:mx-0">
              Twelve franchises, one ground at SportsCube, Gurugram, and a live auction
              that builds every squad. Presented by {PRESENTED_BY.name}.
            </p>
            <div className="mt-7 flex flex-wrap justify-center gap-3 md:justify-start">
              <Link href="/register" className="btn-accent">
                Register for Season 2
              </Link>
              <Link
                href="/auction"
                className="rounded-full border border-white/30 px-6 py-2.5 text-[0.813rem] font-medium text-white transition hover:border-white"
              >
                Live auction board
              </Link>
            </div>
          </div>
        </div>
      </section>

      {portal && (
        <section className="border-b border-line bg-wash">
          <div className="mx-auto flex max-w-[1200px] flex-wrap items-center gap-3 px-4 py-4 sm:px-7">
            <span className="label-mono">Signed in · your pages</span>
            {portal.map((p) => (
              <Link key={p.href} href={p.href} className="pill">
                {p.label}
              </Link>
            ))}
          </div>
        </section>
      )}

      {/* ---------- Season 1 honours ---------- */}
      <section className="mx-auto w-full max-w-[1200px] px-4 pt-14 sm:px-7">
        <p className="eyebrow">Season 1 · 2026 honours</p>
        <h2 className="mt-2 text-4xl sm:text-5xl">The teams to beat</h2>

        <div className="mt-8 grid gap-10 lg:grid-cols-2 lg:gap-8">
          {HONOURS.map((h) => (
            <article key={h.team}>
              <div className="mb-4 flex items-center gap-4">
                <Image src={h.logo} alt="" className="h-16 w-16 object-contain" sizes="64px" />
                <div>
                  <p
                    className={`font-mono text-[0.688rem] uppercase tracking-[0.2em] ${
                      h.gold ? "text-gold" : "text-muted"
                    }`}
                  >
                    {h.gold ? "★ " : ""}
                    {h.title}
                  </p>
                  <h3 className="mt-1 text-2xl sm:text-3xl">{h.team}</h3>
                </div>
              </div>
              <div className={`honour-frame${h.gold ? "" : " silver"}`}>
                <div className="honour-inner">
                  <Image
                    src={h.banner}
                    alt={`${h.team}, Season 1 ${h.title.toLowerCase()}`}
                    className="h-auto w-full"
                    sizes="(max-width: 1024px) 100vw, 580px"
                    loading="eager"
                  />
                </div>
                {h.gold && <span className="honour-sheen" aria-hidden />}
              </div>
              <p className="mt-3 text-sm text-muted">{h.note}</p>
            </article>
          ))}
        </div>
      </section>

      {/* ---------- gallery ---------- */}
      <section className="mx-auto w-full max-w-[1200px] px-4 pt-16 sm:px-7">
        <p className="eyebrow">Season 1 in pictures</p>
        <h2 className="mt-2 mb-6 text-3xl sm:text-4xl">Match-day awards</h2>
        <Season1Gallery slides={SLIDES} />
      </section>

      {/* ---------- registration ---------- */}
      <section id="register" className="mx-auto w-full max-w-[1200px] scroll-mt-32 px-4 pt-16 sm:px-7">
        <div className="card p-6 sm:p-8">
          <p className="eyebrow">Player registration · Season 2</p>
          <h2 className="mt-2 text-3xl sm:text-4xl">Enter the pool</h2>
          <p className="mt-3 max-w-2xl text-muted">
            Returning players won&apos;t fill anything twice: enter your mobile number and your
            profile, stats and photo come up ready. You only add your kit details.
          </p>
          <Link href="/register" className="btn-primary mt-5 inline-block">
            Start registration
          </Link>
          <ol className="mt-7 grid gap-4 md:grid-cols-3">
            {STEPS.map((s, k) => (
              <li key={s.title} className="tile p-5">
                <p className="label-mono">Step {k + 1}</p>
                <h3 className="mt-2 text-xl">{s.title}</h3>
                <p className="mt-2 text-sm text-muted">{s.body}</p>
              </li>
            ))}
          </ol>
          <p className="mt-6 rounded-[10px] border border-gold-line bg-gold-fill px-4 py-3 text-sm text-gold">
            A mandatory registration fee of ₹3,000 applies only if you are selected in
            the auction. Registering does not guarantee selection.
          </p>
        </div>
      </section>

      {/* ---------- portal directory (demo only) ---------- */}
      {DEMO_MODE && (
        <section className="mx-auto w-full max-w-[1200px] px-4 pt-16 sm:px-7">
          <p className="eyebrow">Explore the portal</p>
          <h2 className="mt-2 text-3xl sm:text-4xl">Every page</h2>
          <p className="mt-2 max-w-2xl text-sm text-muted">
            Pages marked with a lock ask you to sign in first.
          </p>
          <ul className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {PORTAL_PAGES.map((pg) => (
              <li key={pg.href}>
                <Link
                  href={pg.href}
                  className="flex h-full flex-col gap-1.5 rounded-[12px] border border-line bg-surface p-4 transition hover:border-red"
                >
                  <span className="flex items-center justify-between gap-2">
                    <span className="font-display text-lg uppercase leading-tight">{pg.label}</span>
                    <span
                      className={`badge shrink-0 ${pg.access === "Public" ? "bg-wash text-up" : "bg-wash text-muted"}`}
                    >
                      {pg.access === "Public" ? "Open" : `🔒 ${pg.access}`}
                    </span>
                  </span>
                  <span className="text-sm text-muted">{pg.what}</span>
                  <span className="num mt-auto pt-1 text-[0.688rem] text-faint">/spartansscout{pg.href}</span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}

      {/* ---------- sponsors ---------- */}
      <section className="mx-auto w-full max-w-[1200px] px-4 py-16 sm:px-7">
        <p className="eyebrow">Our sponsors &amp; partners</p>
        <div className="mt-6 grid gap-4 sm:grid-cols-2">
          {[TITLE_SPONSOR, PRESENTED_BY].map((s) => (
            <div key={s.name} className="card flex items-center gap-5">
              <div className="flex h-20 w-40 shrink-0 items-center justify-center">
                <Image src={s.logo} alt={s.name} style={logoSize(s.logo, 9000, 76)} sizes="200px" />
              </div>
              <div>
                <p className="label-mono">{s.role}</p>
                <p className="mt-1 font-medium">{s.name}</p>
              </div>
            </div>
          ))}
        </div>
        <ul className="mt-4 grid grid-cols-2 gap-4 sm:grid-cols-3">
          {PARTNERS.map((s) => (
            <li key={s.name} className="flex flex-col items-center gap-3 rounded-[10px] border border-line bg-surface p-4 text-center">
              <div className="flex h-16 items-center">
                <Image src={s.logo} alt={s.name} style={logoSize(s.logo, 5200, 60)} sizes="200px" />
              </div>
              <p className="label-mono">{s.role}</p>
            </li>
          ))}
        </ul>
      </section>
    </main>
  );
}
