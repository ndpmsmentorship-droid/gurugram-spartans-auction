// Registration FAQ. Answers reflect how /register and the admin review actually
// work — change them here if the rules change (MIN_AGE, fee, documents).
const FAQS: { q: string; a: React.ReactNode }[] = [
  {
    q: "Who can register?",
    a: "Any player aged 30 or above on the day they register. The league is built for working professionals who never stopped playing.",
  },
  {
    q: "I played Season 1 or in another league with you. Do I fill everything again?",
    a: "No. Type your mobile number or start typing your name, and your profile, photo and stats come up ready. Confirm it's you and add only your kit details.",
  },
  {
    q: "My name or number doesn't come up. What now?",
    a: "Try your surname alone, or a different number you may have used before. If you still aren't listed, choose \"Register as a new player\" and fill the short form.",
  },
  {
    q: "Is there a fee?",
    a: "Registering is free. A mandatory registration fee of ₹3,000 applies only if you are selected in the auction.",
  },
  {
    q: "Does registering guarantee a place in a team?",
    a: "No. The league reviews every registration and grades players into categories. Twelve franchise owners then pick their squads at a live auction.",
  },
  {
    q: "Which documents do I need?",
    a: "New players upload a photo and their Aadhaar card. Returning players need neither, but may upload a new photo. You also agree to share documents such as ID or age proof if the league asks.",
  },
  {
    q: "Who can see my Aadhaar and personal details?",
    a: "Only league admins. Files are kept in private storage and opened through short-lived links. Your phone, email and date of birth are never shown on the public pages.",
  },
  {
    q: "Why do you ask for my LinkedIn profile?",
    a: "The league checks each profile by hand as part of its review. Profiles with fewer than 500 connections are held under review rather than rejected.",
  },
  {
    q: "What happens after I submit?",
    a: "Your registration goes into the league's review queue. Approved players enter the auction pool with a category, and the league contacts you on the mobile number you gave.",
  },
  {
    q: "Why do you ask for kit sizes, meal preference and allergies?",
    a: "Your jersey name, number and sizes go to the kit maker if you're picked. Meal preference and allergies help the league plan food on match days and at events.",
  },
  {
    q: "I made a mistake in my registration. Can I change it?",
    a: "Each mobile number can register once. Contact the league and they will correct your details.",
  },
];

export default function Faq() {
  return (
    <section aria-labelledby="faq-h" className="mt-14">
      <p className="eyebrow">Questions</p>
      <h2 id="faq-h" className="mt-2 text-3xl sm:text-4xl">
        Registration <span className="text-red">FAQ</span>
      </h2>
      <div className="mt-6 divide-y divide-line overflow-hidden rounded-[14px] border border-line bg-surface">
        {FAQS.map((f) => (
          <details key={f.q} className="group">
            <summary className="flex cursor-pointer list-none items-center justify-between gap-4 px-5 py-4 font-medium transition hover:bg-wash [&::-webkit-details-marker]:hidden">
              <span>{f.q}</span>
              <span
                aria-hidden
                className="grid h-7 w-7 shrink-0 place-items-center rounded-full border border-line text-red transition group-open:rotate-45 group-open:border-red"
              >
                +
              </span>
            </summary>
            <p className="px-5 pb-5 text-sm leading-relaxed text-muted">{f.a}</p>
          </details>
        ))}
      </div>
    </section>
  );
}
