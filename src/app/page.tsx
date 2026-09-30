import Image from "next/image";
import Link from "next/link";
import { getCurrentProfile } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import crest from "./brand/crest.png";
// Instagram, @shantidevilegendsleague, 29 Mar 2026 (Fighter of the Match).
import heroPhoto from "./brand/hero-manoj-kanishk.jpg";
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
import PhotoGallery, { type Photo } from "./home/PhotoGallery";
import Countdown from "./home/Countdown";
import { getAuctionSeasonId } from "@/lib/auction/target";
import { readLiveLot } from "@/lib/auction/read";
import { LEAGUE } from "@/lib/league";
import { PlayerPhoto } from "./register/PlayerCard";
import { FRANCHISES, findFranchise } from "./franchises";
import { TITLE_SPONSOR, PRESENTED_BY, PARTNERS, logoSize } from "./sponsors";
import { DEMO_MODE, PORTAL_PAGES } from "./site-config";

// Public front door of the league (no login — see PUBLIC_PATHS in proxy.ts).
// Laid out on the lines of the SARDA league site (hero, stats strip, about,
// honours, franchises, owners, gallery, sponsors, opportunities) in the SDLL
// brand kit: maroon bands, brand red, Oswald display type.

// Award photos Nikhil picked (Kanishk presenting), from the league's Drive
// (SLL'26 Repository › FINALS DATA › MOM & FOM), resized.
const PHOTOS: Photo[] = [
  { src: k01, caption: "Match awards · Opening day · 14 Mar 2026" },
  { src: k02, caption: "Match awards · Opening day · 14 Mar 2026" },
  { src: k03, caption: "Match awards · 15 Mar 2026" },
  { src: k04, caption: "Match awards · 22 Mar 2026" },
  { src: k05, caption: "Match awards · Season 1" },
  { src: k06, caption: "Match awards · Season 1" },
];

// Season 2 facts, from the published schedule and the auction pool.
const STATS = [
  { value: "12", label: "Franchises" },
  { value: "295", label: "Players in the pool" },
  { value: "34", label: "Matches" },
  { value: "6", label: "Weekends" },
  { value: "30+", label: "Age to play" },
];

// Where the season stands. `now` marks the current step.
const ROAD = [
  { when: "Open now", what: "Player registration", note: "Returning players in two taps", now: true },
  { when: "Date to be announced", what: "Live auction", note: "12 owners, one room, one purse each" },
  { when: "20 Feb 2027", what: "Season opener", note: "Three matches, 8 AM to 4 PM" },
  { when: "27–28 Mar 2027", what: "Knockout weekend", note: "Semi-finals, third place and the final" },
];

const OPENER = "2027-02-20T08:00:00+05:30";

const AT_A_GLANCE = [
  { k: "Season window", v: "20 Feb – 28 Mar 2027" },
  { k: "Venue", v: "SportsCube, Gurugram" },
  { k: "Format", v: "Two groups of six, round robin, semi-finals and final" },
  { k: "Match days", v: "Saturdays and Sundays · 8 AM, 12 PM, 4 PM" },
  { k: "Squads", v: "16 to 25 players, built at a live auction" },
];

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
    body: "Played with us before? Enter your phone number or name and your profile comes up ready. New players fill one short form.",
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

// From the Season 2 partnership deck; prices stay in the deck.
const OPPORTUNITIES = [
  {
    title: "Premium positions",
    items: [
      "Title Sponsor — naming rights, chest of all 12 jerseys",
      "Co-Sponsor — limited to two",
      "Associate Sponsor",
      "Commercial advertising packages",
    ],
  },
  {
    title: "On the ground",
    items: [
      "Boundary Sponsor — 12 boards at all 34 matches",
      "Side Screen Sponsor — in frame for every delivery",
      "Refreshment Sponsor — stalls, meal boxes, cups",
      "Wickets, Fours & Sixes Partner",
    ],
  },
  {
    title: "Media & broadcast",
    items: [
      "Live-stream advertising spots",
      "Branded highlight reels",
      "Media Partner",
      "Radio Partner",
    ],
  },
];

// Season 1 owners from the merged player master (is_owner), grouped by team.
// Some rows carry placeholder images from the old platform; only real photo
// hosts are used, and PlayerPhoto falls back to initials.
const PHOTO_HOSTS = /res\.cloudinary\.com|anantanity\.com|media\.cricheroes\.in\/user_profile/;
type Owner = { name: string; team: string; photo: string | null };

async function getOwners(): Promise<Owner[]> {
  try {
    const sb = createAdminClient() as unknown as {
      from: (t: string) => { select: (c: string) => { eq: (k: string, v: boolean) => Promise<{ data: Record<string, string | null>[] | null }> } };
    };
    const { data } = await sb.from("player_master").select("full_name, last_team, photo_url").eq("is_owner", true);
    const order = (t: string) => FRANCHISES.findIndex((f) => f.name === t);
    return (data ?? [])
      .map((r) => {
        const f = findFranchise(r.last_team);
        return f
          ? {
              name: String(r.full_name).replace(/\d+/g, "").trim(),
              team: f.name,
              photo: r.photo_url && PHOTO_HOSTS.test(r.photo_url) ? r.photo_url : null,
            }
          : null;
      })
      .filter((o): o is Owner => !!o)
      .sort((a, b) => order(a.team) - order(b.team) || a.name.localeCompare(b.name));
  } catch {
    return [];
  }
}

// The player on the block right now, if a lot is live.
async function getLiveNow(): Promise<{ name: string; photo: string | null; bid: number | null } | null> {
  // The USCL demo auction is private; never surface its lot on the SDLL page.
  if (LEAGUE !== "sdll") return null;
  try {
    const lot = await readLiveLot(await getAuctionSeasonId());
    if (lot.status !== "live" || !lot.player_id) return null;
    const sb = createAdminClient() as unknown as {
      from: (t: string) => { select: (c: string) => { eq: (k: string, v: string) => { maybeSingle: () => Promise<{ data: { full_name: string; photo_url: string | null } | null }> } } };
    };
    const { data } = await sb.from("scout_players").select("full_name, photo_url").eq("id", lot.player_id).maybeSingle();
    return data ? { name: data.full_name, photo: data.photo_url, bid: lot.current_bid ?? lot.base_price } : null;
  } catch {
    return null;
  }
}

function Heading({ kicker, lead, accent }: { kicker: string; lead: string; accent: string }) {
  return (
    <>
      <p className="eyebrow">{kicker}</p>
      <h2 className="mt-2 text-4xl sm:text-5xl">
        {lead} <span className="text-red">{accent}</span>
      </h2>
    </>
  );
}

export default async function Home() {
  const [profile, owners, live] = await Promise.all([getCurrentProfile(), getOwners(), getLiveNow()]);
  const ownersOf = (team: string) => owners.filter((o) => o.team === team);

  const portal =
    profile?.role === "admin"
      ? [
          { href: "/admin/auction", label: "Auction console" },
          { href: "/admin/registrations", label: "Registrations" },
          { href: "/scout", label: "Player pool" },
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
        {/* floodlights */}
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0"
          style={{
            background:
              "radial-gradient(40% 55% at 12% 0%, rgba(255,255,255,0.13), transparent 70%), radial-gradient(35% 50% at 88% 0%, rgba(255,255,255,0.1), transparent 70%), radial-gradient(60% 60% at 70% 110%, rgba(177,37,32,0.45), transparent 70%)",
          }}
        />
        <div className="relative mx-auto grid max-w-[1200px] items-center gap-10 px-4 py-12 sm:px-7 md:py-16 lg:grid-cols-[1.05fr_0.95fr]">
          <div className="flex flex-col items-center gap-6 text-center sm:flex-row sm:items-center sm:text-left">
            <Image
              src={crest}
              alt="Shanti Devi Legend's League crest"
              className="h-40 w-auto shrink-0 drop-shadow-[0_18px_30px_rgba(0,0,0,0.45)] md:h-52"
              loading="eager"
              fetchPriority="high"
              sizes="200px"
            />
            <div>
              <p className="font-mono text-[0.688rem] uppercase tracking-[0.24em] text-white/60">
                Building legends together
              </p>
              <h1 className="mt-3 leading-[0.88]">
                <span className="block text-[3.4rem] sm:text-7xl">SDLL</span>
                <span className="block text-[3.4rem] text-[#ff5a4f] sm:text-7xl">Season 2</span>
              </h1>
              <p className="mt-4 font-display text-lg uppercase tracking-[0.06em] text-white/85 sm:text-xl">
                Gurugram&apos;s 30+ T20 league
              </p>
              <div className="mt-5">
                <Countdown to={OPENER} label="To the Season 2 opener" />
              </div>
            </div>
          </div>

          <div className="relative mx-auto w-full max-w-[440px] lg:mx-0 lg:justify-self-end">
            <div className="rotate-[1.5deg] rounded-[18px] bg-white/10 p-2 shadow-[0_30px_60px_-20px_rgba(0,0,0,0.6)] ring-1 ring-white/15">
              <Image
                src={heroPhoto}
                alt="Manoj Tiwari and Kanishk Sheel presenting the Fighter of the Match award"
                className="h-auto w-full rounded-[12px]"
                sizes="(max-width: 1024px) 90vw, 440px"
                loading="eager"
                fetchPriority="high"
                placeholder="blur"
              />
            </div>
            <span className="absolute -bottom-3 left-4 rounded-full bg-[var(--red)] px-4 py-1.5 font-mono text-[0.625rem] uppercase tracking-[0.2em] text-white shadow-lg">
              Fighter of the Match · 29 Mar 2026
            </span>
          </div>
        </div>

        <div className="relative border-t border-white/10">
          <div className="mx-auto flex max-w-[1200px] flex-col items-center gap-5 px-4 pb-24 pt-8 text-center sm:px-7 md:flex-row md:items-end md:justify-between md:text-left">
            <div className="max-w-2xl">
              <p className="inline-block rounded-full border border-white/25 px-3 py-1 font-mono text-[0.625rem] uppercase tracking-[0.2em] text-white/80">
                Season 2 · Feb 2027 · SportsCube
              </p>
              <p className="mt-4 text-white/75">
                Twelve franchises, one ground and a live auction that builds every squad. Presented
                by {PRESENTED_BY.name}, title sponsor {TITLE_SPONSOR.name}.
              </p>
            </div>
            <div className="flex flex-wrap justify-center gap-3">
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

      {/* ---------- live now (only while a lot is on the block) ---------- */}
      {live && (
        <Link
          href="/auction"
          className="group order-first flex items-center gap-4 bg-[var(--red)] px-4 py-2.5 text-white sm:px-7"
        >
          <span className="relative flex h-2.5 w-2.5 shrink-0">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-white/80" />
            <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-white" />
          </span>
          <PlayerPhoto src={live.photo} name={live.name} className="h-10 w-10 shrink-0 rounded-full" sizes="40px" />
          <span className="min-w-0 flex-1">
            <span className="block font-mono text-[0.594rem] uppercase tracking-[0.2em] text-white/75">Auction live · on the block</span>
            <span className="block truncate font-display text-xl uppercase leading-tight">{live.name}</span>
          </span>
          {live.bid != null && (
            <span className="font-display text-2xl">₹{live.bid.toLocaleString("en-IN")}</span>
          )}
          <span className="hidden text-sm underline-offset-4 group-hover:underline sm:inline">Watch live →</span>
        </Link>
      )}

      {/* ---------- stats strip ---------- */}
      <section className="relative z-10 mx-auto -mt-14 w-full max-w-[1100px] px-4 sm:px-7">
        <ul className="grid grid-cols-2 overflow-hidden rounded-[16px] border border-line bg-surface shadow-[var(--elev)] sm:grid-cols-5">
          {STATS.map((s, i) => (
            <li
              key={s.label}
              className={`px-4 py-5 text-center ${i > 0 ? "sm:border-l sm:border-line" : ""} ${
                i === STATS.length - 1 ? "col-span-2 border-t border-line sm:col-span-1 sm:border-t-0" : i > 1 ? "border-t border-line sm:border-t-0" : ""
              }`}
            >
              <p className="font-display text-4xl text-red">{s.value}</p>
              <p className="label-mono mt-2">{s.label}</p>
            </li>
          ))}
        </ul>
      </section>

      {/* ---------- road to season 2 ---------- */}
      <section className="mx-auto w-full max-w-[1200px] px-4 pt-14 sm:px-7">
        <p className="eyebrow">Road to Season 2</p>
        <ol className="relative mt-6 grid gap-6 md:grid-cols-4 md:gap-4">
          <span aria-hidden className="absolute left-[11px] top-3 bottom-3 w-px bg-line md:left-3 md:right-3 md:top-[11px] md:bottom-auto md:h-px md:w-auto" />
          {ROAD.map((r) => (
            <li key={r.what} className="relative flex gap-4 md:flex-col md:gap-3">
              <span
                className={`relative z-10 mt-0.5 grid h-6 w-6 shrink-0 place-items-center rounded-full border-2 ${
                  r.now ? "border-red bg-red" : "border-line2 bg-surface"
                }`}
              >
                {r.now && <span className="h-2 w-2 animate-pulse rounded-full bg-white" />}
              </span>
              <div>
                <p className={`font-mono text-[0.625rem] uppercase tracking-[0.16em] ${r.now ? "text-red" : "text-muted"}`}>
                  {r.when}
                </p>
                <p className="mt-1 font-display text-xl uppercase leading-tight">{r.what}</p>
                <p className="mt-1 text-sm text-muted">{r.note}</p>
                {r.now && (
                  <Link href="/register" className="mt-2 inline-block text-sm font-medium text-red underline underline-offset-4">
                    Register →
                  </Link>
                )}
              </div>
            </li>
          ))}
        </ol>
      </section>

      {portal && (
        <section className="mx-auto mt-8 w-full max-w-[1200px] px-4 sm:px-7">
          <div className="flex flex-wrap items-center gap-3 rounded-[12px] border border-line bg-wash px-4 py-3">
            <span className="label-mono">Signed in · your pages</span>
            {portal.map((p) => (
              <Link key={p.href} href={p.href} className="pill">
                {p.label}
              </Link>
            ))}
          </div>
        </section>
      )}

      {/* ---------- about ---------- */}
      <section className="mx-auto grid w-full max-w-[1200px] gap-10 px-4 pt-16 sm:px-7 lg:grid-cols-[1.2fr_1fr]">
        <div>
          <Heading kicker="About the league" lead="About" accent="SDLL" />
          <div className="mt-6 space-y-4 text-[0.95rem] leading-relaxed text-muted">
            <p>
              The Shanti Devi Legend&apos;s League is cricket for the ones who never stopped
              playing. It is a 30+ league built around a full franchise auction: players register,
              are graded into categories, and go under the hammer to twelve team owners working a
              fixed purse.
            </p>
            <p>
              What follows is a real season, not an exhibition. Two groups of six play a round
              robin, then semi-finals and a final, to a published schedule across six weekends at
              SportsCube, Gurugram.
            </p>
            <p>
              The players are working professionals in their thirties and forties, founders,
              senior managers and business owners, who bring their families and colleagues to the
              ground and spend the day there.
            </p>
          </div>
        </div>
        <aside className="band self-start rounded-[16px] p-6 text-white shadow-[var(--elev)] sm:p-7">
          <p className="font-mono text-[0.625rem] uppercase tracking-[0.24em] text-[#ff8a82]">
            Season 2 at a glance
          </p>
          <dl className="mt-5 divide-y divide-white/10">
            {AT_A_GLANCE.map((r) => (
              <div key={r.k} className="flex flex-col gap-1 py-3 sm:flex-row sm:gap-4">
                <dt className="w-32 shrink-0 font-mono text-[0.625rem] uppercase tracking-[0.14em] text-white/55">
                  {r.k}
                </dt>
                <dd className="text-sm text-white/90">{r.v}</dd>
              </div>
            ))}
          </dl>
          <Link href="/schedule" className="mt-5 inline-block text-sm text-white underline underline-offset-4">
            Full fixture list →
          </Link>
        </aside>
      </section>

      {/* ---------- Season 1 honours ---------- */}
      <section className="mx-auto w-full max-w-[1200px] px-4 pt-20 sm:px-7">
        <Heading kicker="Season 1 · 2026 honours" lead="The teams" accent="to beat" />
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
                  />
                </div>
                {h.gold && <span className="honour-sheen" aria-hidden />}
              </div>
              <p className="mt-3 text-sm text-muted">{h.note}</p>
            </article>
          ))}
        </div>
      </section>

      {/* ---------- franchises ---------- */}
      <section className="mt-20 bg-wash py-16">
        <div className="mx-auto w-full max-w-[1200px] px-4 sm:px-7">
          <Heading kicker="Season 2 · owners" lead="The twelve" accent="franchises" />
          <p className="mt-3 max-w-2xl text-muted">Each franchise and the owners who will be bidding for it at the auction.</p>
          {(["A", "B"] as const).map((g) => (
            <div key={g} className="mt-8">
              <p className="label-mono">Group {g}</p>
              <ul className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
                {FRANCHISES.filter((f) => f.group === g).map((f) => {
                  const own = ownersOf(f.name);
                  const champs = f.name === "ACCI" ? "★ S1 champions" : f.name === "Goan Monks" ? "S1 runners-up" : null;
                  return (
                    <li
                      key={f.name}
                      className="group relative flex flex-col overflow-hidden rounded-[16px] border border-line bg-surface shadow-[var(--elev-sm)] transition hover:-translate-y-1 hover:shadow-[var(--elev)]"
                    >
                      <div className="relative flex items-center justify-center bg-gradient-to-b from-[var(--blush-b)] to-[var(--blush-a)] px-4 pb-3 pt-5">
                        {champs && (
                          <span className="absolute left-2 top-2 rounded-full bg-gold-fill px-2 py-0.5 font-mono text-[0.531rem] uppercase tracking-[0.12em] text-gold ring-1 ring-gold-line">
                            {champs}
                          </span>
                        )}
                        <Image src={f.logo} alt="" className="h-24 w-24 object-contain transition duration-500 group-hover:scale-110" sizes="96px" />
                      </div>
                      <div className="flex flex-1 flex-col gap-2 p-3">
                        <p className="font-display text-base uppercase leading-tight">{f.name}</p>
                        {own.length > 0 && (
                          <div className="mt-auto flex items-center gap-2">
                            <span className="flex -space-x-2">
                              {own.slice(0, 3).map((o) => (
                                <PlayerPhoto
                                  key={o.name}
                                  src={o.photo}
                                  name={o.name}
                                  className="h-7 w-7 shrink-0 rounded-full ring-2 ring-surface [&_span]:!text-[0.6rem]"
                                  sizes="28px"
                                />
                              ))}
                            </span>
                            <span className="min-w-0 truncate text-[0.688rem] text-muted" title={own.map((o) => o.name).join(", ")}>
                              {own.map((o) => o.name.split(" ")[0]).join(", ")}
                            </span>
                          </div>
                        )}
                      </div>
                    </li>
                  );
                })}
              </ul>
            </div>
          ))}
        </div>
      </section>

      {/* ---------- gallery ---------- */}
      <section className="mx-auto w-full max-w-[1200px] px-4 pt-16 sm:px-7">
        <Heading kicker="Season 1 in pictures" lead="Photo" accent="gallery" />
        <div className="mt-8">
          <PhotoGallery photos={PHOTOS} />
        </div>
      </section>

      {/* ---------- registration ---------- */}
      <section id="register" className="mx-auto w-full max-w-[1200px] scroll-mt-32 px-4 pt-16 sm:px-7">
        <div className="card p-6 sm:p-8">
          <Heading kicker="Player registration · Season 2" lead="Enter the" accent="pool" />
          <p className="mt-3 max-w-2xl text-muted">
            Returning players won&apos;t fill anything twice: enter your mobile number or name and
            your profile, stats and photo come up ready. You only add your kit details.
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
            A mandatory registration fee of ₹3,000 applies only if you are selected in the auction.
            Registering does not guarantee selection.
          </p>
        </div>
      </section>

      {/* ---------- sponsors ---------- */}
      <section className="mx-auto w-full max-w-[1200px] px-4 pt-20 text-center sm:px-7">
        <p className="eyebrow">Season 2</p>
        <h2 className="mt-2 text-4xl sm:text-5xl">
          Our <span className="text-red">sponsors &amp; partners</span>
        </h2>

        <div className="mx-auto mt-10 grid max-w-3xl gap-4 sm:grid-cols-2">
          {[TITLE_SPONSOR, PRESENTED_BY].map((s) => (
            <div key={s.name} className="rounded-[16px] border-2 border-red/70 bg-surface p-6 shadow-[var(--elev)]">
              <p className="label-mono">{s.role}</p>
              <div className="mt-4 flex h-24 items-center justify-center">
                <Image src={s.logo} alt={s.name} style={logoSize(s.logo, 11000, 90)} sizes="240px" />
              </div>
              <p className="mt-3 text-sm font-medium">{s.name}</p>
            </div>
          ))}
        </div>

        <p className="label-mono mt-12">Partners</p>
        <ul className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
          {PARTNERS.map((s) => (
            <li key={s.name} className="flex flex-col items-center gap-3 rounded-[12px] border border-line bg-surface p-4">
              <div className="flex h-16 items-center">
                <Image src={s.logo} alt={s.name} style={logoSize(s.logo, 5200, 60)} sizes="200px" />
              </div>
              <p className="label-mono">{s.role}</p>
            </li>
          ))}
        </ul>
      </section>

      {/* ---------- sponsorship opportunities ---------- */}
      <section className="mx-auto w-full max-w-[1200px] px-4 pt-20 sm:px-7">
        <div className="text-center">
          <p className="eyebrow">Partner with the league</p>
          <h2 className="mt-2 text-4xl sm:text-5xl">
            Sponsorship <span className="text-red">opportunities</span>
          </h2>
          <p className="mx-auto mt-3 max-w-2xl text-muted">
            Six weekends of senior professionals and their families at one ground, plus the live
            stream and this portal. Every position is priced against Season 2&apos;s 34 matches.
          </p>
        </div>
        <div className="mt-10 grid gap-5 md:grid-cols-3">
          {OPPORTUNITIES.map((o, i) => (
            <div key={o.title} className="overflow-hidden rounded-[16px] border border-line bg-surface shadow-[var(--elev)]">
              <p
                className="px-5 py-3.5 font-display text-lg uppercase tracking-[0.04em] text-white"
                style={{ background: ["var(--maroon)", "var(--red)", "var(--header-b)"][i] }}
              >
                {String.fromCharCode(65 + i)}. {o.title}
              </p>
              <ol className="space-y-3 p-5">
                {o.items.map((it, k) => (
                  <li key={it} className="flex gap-3 text-sm">
                    <span
                      className="num grid h-6 w-6 shrink-0 place-items-center rounded-full text-[0.688rem] text-white"
                      style={{ background: ["var(--maroon)", "var(--red)", "var(--header-b)"][i] }}
                    >
                      {k + 1}
                    </span>
                    <span className="pt-0.5">{it}</span>
                  </li>
                ))}
              </ol>
            </div>
          ))}
        </div>
      </section>

      {/* ---------- portal directory (demo only, admins only) ---------- */}
      {DEMO_MODE && profile?.role === "admin" && (
        <section className="mx-auto w-full max-w-[1200px] px-4 pt-20 sm:px-7">
          <Heading kicker="Explore the portal" lead="Every" accent="page" />
          <p className="mt-2 max-w-2xl text-sm text-muted">Pages marked with a lock ask you to sign in first.</p>
          <ul className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {PORTAL_PAGES.map((pg) => (
              <li key={pg.href}>
                <Link
                  href={pg.href}
                  className="flex h-full flex-col gap-1.5 rounded-[12px] border border-line bg-surface p-4 transition hover:border-red"
                >
                  <span className="flex items-center justify-between gap-2">
                    <span className="font-display text-lg uppercase leading-tight">{pg.label}</span>
                    <span className={`badge shrink-0 ${pg.access === "Public" ? "bg-wash text-up" : "bg-wash text-muted"}`}>
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

      {/* ---------- footer ---------- */}
      <footer className="band mt-20 text-white">
        <div className="mx-auto flex max-w-[1200px] flex-col items-center gap-5 px-4 py-10 text-center sm:px-7">
          <Image src={crest} alt="" className="h-16 w-auto" sizes="60px" />
          <p className="max-w-xl text-sm text-white/75">
            SportsCube Center for Excellence, Darbaripur Road, Sector 70, Gurugram, Haryana 122101
          </p>
          <div className="flex flex-wrap justify-center gap-3">
            <Link href="/register" className="btn-accent">
              Register
            </Link>
            <Link href="/login" className="rounded-full border border-white/30 px-6 py-2.5 text-[0.813rem] font-medium text-white hover:border-white">
              Owner login
            </Link>
          </div>
          <p className="border-t border-white/10 pt-5 font-mono text-[0.625rem] uppercase tracking-[0.18em] text-white/45">
            © 2026 Shanti Devi Legend&apos;s League · Presented by {PRESENTED_BY.name}
          </p>
        </div>
      </footer>
    </main>
  );
}
