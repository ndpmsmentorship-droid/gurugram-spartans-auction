import type { Metadata } from "next";
import RegisterForm from "./RegisterForm";

export const metadata: Metadata = {
  title: "Register · Shanti Devi Legend League",
  description: "Player registration for Shanti Devi Legend's League Season 2.",
};

// Public, no login (see PUBLIC_PATHS in proxy.ts). Returning players find
// their profile by mobile number; new players fill one short form.
export default function RegisterPage() {
  return (
    <main className="flex flex-1 flex-col">
      <section className="band text-white">
        <div className="mx-auto max-w-[760px] px-4 py-10 sm:px-7 sm:py-12">
          <p className="font-mono text-[0.688rem] uppercase tracking-[0.24em] text-white/60">
            Player registration · Season 2
          </p>
          <h1 className="mt-3 text-4xl sm:text-5xl">Enter the pool</h1>
          <p className="mt-3 max-w-xl text-white/75">
            Register for the Shanti Devi Legend&apos;s League auction, open to players aged 30 and
            above. Returning players only add their kit details. Registering does not guarantee selection.
          </p>
        </div>
      </section>
      <div className="mx-auto w-full max-w-[760px] px-4 py-10 sm:px-7">
        <RegisterForm />
      </div>
    </main>
  );
}
