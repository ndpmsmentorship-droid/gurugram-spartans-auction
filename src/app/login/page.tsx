import LoginForm from "./LoginForm";
import Image from "next/image";
import usclCrest from "../brand/uscl-crest.png";
import sdllCrest from "../brand/crest.png";
import playfulWhite from "../brand/playful-ventures-white.png";
import { LEAGUE, usclClosed } from "@/lib/league";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string; closed?: string }>;
}) {
  const { next } = await searchParams;
  const closed = usclClosed();

  // USCL soft launch: every franchise signs in here, so no Spartans branding —
  // and the form comes first on phones.
  if (LEAGUE === "uscl")
    return (
      <main className="grid flex-1 md:grid-cols-2">
        <section className="order-2 flex flex-col justify-center gap-6 bg-[#1d1d1f] px-8 py-12 text-white sm:px-12 md:order-1">
          <div className="flex items-center gap-5">
            <Image src={usclCrest} alt="USCL — Urban Sports Champions League" className="h-36 w-auto drop-shadow-[0_14px_24px_rgba(0,0,0,0.45)]" sizes="120px" priority />
            <span className="h-24 w-px bg-white/20" aria-hidden />
            <div className="flex flex-col items-center gap-2">
              <Image src={sdllCrest} alt="Shanti Devi Legend’s League" className="h-24 w-auto drop-shadow-[0_14px_24px_rgba(0,0,0,0.45)]" sizes="80px" />
              <span className="font-mono text-[0.6rem] uppercase tracking-[0.2em] text-white/55">Powered by SLL</span>
            </div>
          </div>
          <div>
            <p className="font-mono text-[0.688rem] uppercase tracking-[0.22em] text-white/60">Urban Sports Champions League · Season 2</p>
            <h1 className="mt-3 text-4xl font-semibold leading-[1.1] tracking-tight sm:text-5xl">Your franchise war room.</h1>
            <ul className="mt-5 space-y-2 text-[0.95rem] leading-relaxed text-white/75">
              <li>• Purse, max safe bid and category slots — live as players are sold</li>
              <li>• Every player&apos;s stats, phase economies and video clips</li>
              <li>• Your own wishlist and squad suggestions — only you see them</li>
            </ul>
          </div>
          <div className="flex items-center gap-3 border-t border-white/15 pt-5">
            <span className="font-mono text-[0.6rem] uppercase tracking-[0.22em] text-white/55">Presented by</span>
            <Image src={playfulWhite} alt="Playful Ventures" className="h-12 w-auto" sizes="100px" />
          </div>
        </section>
        <section className="order-1 flex items-center justify-center bg-background px-6 py-12 md:order-2 md:py-16">
          <div className="w-full max-w-sm">
            {closed && (
              <p className="mb-5 rounded-[12px] border border-line bg-wash px-4 py-3 text-sm leading-relaxed text-ink">
                <strong>The USCL auction has closed.</strong> Owner access ended at midnight — thank you for taking part.
              </p>
            )}
            <LoginForm next={next || "/war-room"} title="USCL Auction" subtitle={closed ? "Admin sign-in" : "Franchise sign-in"} />
          </div>
        </section>
      </main>
    );

  // SLL-2 owners' portal: brand panel in the league kit, the form first on phones.
  return (
    <main className="grid flex-1 md:grid-cols-[1.1fr_1fr]">
      <section
        className="order-2 flex flex-col justify-center gap-8 px-8 py-12 text-white sm:px-12 md:order-1"
        style={{ background: "radial-gradient(120% 90% at 15% 0%, var(--header-a) 0%, var(--header-b) 65%)" }}
      >
        <div className="flex items-center gap-5">
          <Image src={sdllCrest} alt="Shanti Devi Legend’s League" className="h-32 w-auto drop-shadow-[0_14px_24px_rgba(0,0,0,0.45)]" sizes="96px" priority />
          <div>
            <p className="font-display text-2xl font-bold uppercase leading-none tracking-[0.02em]">Shanti Devi</p>
            <p className="mt-1.5 font-mono text-[0.625rem] uppercase tracking-[0.28em] text-white/60">Legend’s League · Season 2</p>
          </div>
        </div>
        <div>
          <p className="font-mono text-[0.688rem] uppercase tracking-[0.22em]" style={{ color: "var(--steel)" }}>Franchise owners</p>
          <h1 className="mt-3 font-display text-4xl font-bold uppercase leading-[1.05] sm:text-5xl">
            Your owners’ <span style={{ color: "var(--legend)" }}>portal.</span>
          </h1>
          <ul className="mt-6 space-y-3 text-[0.95rem] leading-relaxed text-white/80">
            <li><b className="text-white">Plan</b> · five squad strategies, the best squad your purse can buy</li>
            <li><b className="text-white">Live pool</b> · every player as they register, selected, under review or rejected</li>
            <li><b className="text-white">War Room</b> · purse, max safe bid and a verdict on every player on auction night</li>
            <li><b className="text-white">AI scout</b> · ask who to buy next</li>
          </ul>
        </div>
        <div className="flex flex-wrap items-center justify-between gap-4 border-t border-white/15 pt-5">
          <span className="flex items-center gap-3">
            <span className="font-mono text-[0.6rem] uppercase tracking-[0.22em] text-white/55">Presented by</span>
            <Image src={playfulWhite} alt="Playful Ventures" className="h-10 w-auto" sizes="90px" />
          </span>
          <span className="font-mono text-[0.6rem] uppercase tracking-[0.22em] text-white/55">Auction night · Sat 12 Dec 2026</span>
        </div>
      </section>

      <section className="order-1 flex items-center justify-center bg-background px-6 py-12 md:order-2 md:py-16">
        <LoginForm next={next || "/scout"} title="Owners’ portal" subtitle="Sign in with the username the league gave you." />
      </section>
    </main>
  );
}
