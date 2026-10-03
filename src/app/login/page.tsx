import LoginForm from "./LoginForm";
import HonoursInfographic from "../HonoursInfographic";
import SpartansStars from "../SpartansStars";
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
              <Image src={sdllCrest} alt="Shanti Devi Legend League" className="h-24 w-auto drop-shadow-[0_14px_24px_rgba(0,0,0,0.45)]" sizes="80px" />
              <span className="font-mono text-[0.6rem] uppercase tracking-[0.2em] text-white/55">Powered by SDLL</span>
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

  return (
    <main className="grid flex-1 md:grid-cols-2">
      {/* brand / honours panel */}
      <section className="flex flex-col justify-center gap-8 bg-[#1d1d1f] px-8 py-12 text-white sm:px-12">
        <div>
          <p className="inline-flex items-center gap-2 text-sm font-semibold text-white/80">
            The Gurugram Spartans <SpartansStars />
          </p>
          <h1 className="mt-4 text-4xl font-semibold leading-[1.1] tracking-tight sm:text-5xl">
            Teamwork.
            <br />
            Loyalty.
            <br />
            Keep it simple.
          </h1>
          <p className="mt-4 max-w-sm text-[0.95rem] leading-relaxed text-white/70">
            We win as a team, we stay loyal to each other, and we keep it simple
            (and stupid). Four seasons of it — and counting.
          </p>
        </div>

        <HonoursInfographic dark />
      </section>

      {/* login form */}
      <section className="flex items-center justify-center bg-background px-6 py-16">
        <LoginForm next={next || "/scout"} />
      </section>
    </main>
  );
}
