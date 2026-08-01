import LoginForm from "./LoginForm";
import HonoursInfographic from "../HonoursInfographic";
import SpartansStars from "../SpartansStars";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string }>;
}) {
  const { next } = await searchParams;

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
