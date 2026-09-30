"use client";

import { useEffect, useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import {
  lookupPlayer,
  searchByName,
  prepareUploads,
  submitRegistration,
  type CardProfile,
} from "./actions";
import PlayerCard, { PlayerPhoto, prettyRole } from "./PlayerCard";
import {
  BUCKET,
  MAX_FILE_BYTES,
  MIN_AGE,
  ageOn,
  SIZES,
  BATTING,
  BOWLING,
  ALLROUNDER,
  MEALS,
  normalizePhone,
} from "./shared";

type Profile = CardProfile;
type Stage = "phone" | "search" | "confirm" | "form" | "done";

function Field({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <label className="block">
      <span className="label-mono">{label}</span>
      <div className="mt-1.5">{children}</div>
      {hint && <span className="mt-1 block text-xs text-muted">{hint}</span>}
    </label>
  );
}

// One radio group per role category; a player can combine across groups
// (a right-hand bat who bowls left-arm spin). Tap again to clear.
function Choice({
  legend,
  options,
  value,
  onChange,
}: {
  legend: string;
  options: string[];
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <fieldset>
      <legend className="label-mono">{legend}</legend>
      <div className="mt-1.5 flex flex-wrap gap-2">
        {options.map((o) => (
          <button
            key={o}
            type="button"
            className="pill"
            data-active={value === o}
            aria-pressed={value === o}
            onClick={() => onChange(value === o ? "" : o)}
          >
            {o}
          </button>
        ))}
      </div>
    </fieldset>
  );
}

function FilePick({
  id,
  label,
  accept,
  file,
  onFile,
  hint,
}: {
  id: string;
  label: string;
  accept: string;
  file: File | null;
  onFile: (f: File | null) => void;
  hint: string;
}) {
  return (
    <div>
      <span className="label-mono">{label}</span>
      <label
        htmlFor={id}
        className="mt-1.5 flex cursor-pointer items-center gap-3 rounded-[12px] border border-dashed border-line2 bg-tile px-4 py-3 text-sm transition hover:border-red"
      >
        <span className="btn-ghost !px-4 !py-1.5">{file ? "Change" : "Choose file"}</span>
        <span className="min-w-0 truncate text-muted">{file ? file.name : hint}</span>
      </label>
      <input
        id={id}
        type="file"
        accept={accept}
        className="sr-only"
        onChange={(e) => onFile(e.target.files?.[0] ?? null)}
      />
    </div>
  );
}

export default function RegisterForm() {
  const [stage, setStage] = useState<Stage>("phone");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const [phone, setPhone] = useState("");
  // True once the number was checked on the first screen; a player who came in
  // by name (or straight to "new player") types it in the form instead.
  const [phoneFixed, setPhoneFixed] = useState(false);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [matchedBy, setMatchedBy] = useState<"phone" | "name" | null>(null);
  const [nameQ, setNameQ] = useState("");
  const [results, setResults] = useState<Profile[] | null>(null);
  const [searching, setSearching] = useState(false);
  // Last number looked up automatically, so editing around a valid number
  // doesn't fire the same lookup again.
  const lookedUp = useRef<string | null>(null);

  const [fullName, setFullName] = useState("");
  const [dob, setDob] = useState("");
  const [email, setEmail] = useState("");
  const [cricheroes, setCricheroes] = useState("");
  const [linkedin, setLinkedin] = useState("");
  const [batting, setBatting] = useState("");
  const [bowling, setBowling] = useState("");
  const [allrounder, setAllrounder] = useState("");
  const [keeper, setKeeper] = useState(false);
  const [photo, setPhoto] = useState<File | null>(null);
  const [aadhaar, setAadhaar] = useState<File | null>(null);
  const [tshirt, setTshirt] = useState("");
  const [lower, setLower] = useState("");
  const [jerseyNo, setJerseyNo] = useState("");
  const [jerseyName, setJerseyName] = useState("");
  const [feeAck, setFeeAck] = useState(false);
  const [infoDeclared, setInfoDeclared] = useState(false);
  const [docsConsent, setDocsConsent] = useState(false);
  const [meal, setMeal] = useState("");
  const [allergies, setAllergies] = useState("");

  const returning = !!profile;

  // Suggestions as the player types their name (3+ letters, 300 ms debounce).
  useEffect(() => {
    const q = nameQ.trim();
    if (q.length < 3) return;
    let live = true;
    const t = setTimeout(async () => {
      setSearching(true);
      const res = await searchByName(q);
      if (!live) return;
      setSearching(false);
      if (!res.error) setResults(res.results ?? []);
    }, 300);
    return () => {
      live = false;
      clearTimeout(t);
    };
  }, [nameQ]);

  function onNameInput(v: string) {
    setNameQ(v);
    if (v.trim().length < 3) {
      setResults(null);
      setSearching(false);
    }
  }

  // The number is looked up as soon as it's complete. Partial numbers never
  // suggest anyone: that would let a visitor fish for other players' mobiles.
  function onPhoneInput(v: string) {
    setPhone(v);
    const n = normalizePhone(v);
    if (n && v.replace(/\D/g, "").length >= 10 && lookedUp.current !== n && !busy) {
      lookedUp.current = n;
      void lookup(v);
    }
  }

  async function findProfile(e: React.FormEvent) {
    e.preventDefault();
    await lookup(phone);
  }

  async function lookup(value: string) {
    setErr(null);
    if (!normalizePhone(value)) return setErr("Enter a 10-digit mobile number.");
    setBusy(true);
    const res = await lookupPlayer(value);
    setBusy(false);
    if ("error" in res) return setErr(res.error);
    if (res.alreadyRegistered)
      return setErr("This number is already registered for Season 2. Contact the league to change your details.");
    setPhoneFixed(true);
    if (res.found) {
      setProfile(res.profile);
      setMatchedBy("phone");
      setLinkedin(res.profile.linkedin_link ?? "");
      setStage("confirm");
    } else {
      setProfile(null);
      setResults(null);
      setStage("search");
    }
  }

  async function runSearch(e: React.FormEvent) {
    e.preventDefault();
    setErr(null);
    setSearching(true);
    const res = await searchByName(nameQ);
    setSearching(false);
    if (res.error) return setErr(res.error);
    setResults(res.results ?? []);
  }

  function pick(p: Profile) {
    setProfile(p);
    setMatchedBy("name");
    setLinkedin("");
    setErr(null);
    setStage("confirm");
  }

  function newPlayer() {
    setProfile(null);
    setMatchedBy(null);
    setLinkedin("");
    setErr(null);
    setStage("form");
  }

  function notMe() {
    // A wrong phone match may still be a returning player under another
    // number, so offer the name search before the new-player form.
    setProfile(null);
    setMatchedBy(null);
    setLinkedin("");
    setResults(null);
    setStage("search");
  }

  function checkFile(f: File | null, label: string): string | null {
    if (f && f.size > MAX_FILE_BYTES) return `${label} is larger than 5 MB. Please choose a smaller file.`;
    return null;
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setErr(null);
    const tooBig = checkFile(photo, "Your photo") ?? checkFile(aadhaar, "The Aadhaar file");
    if (tooBig) return setErr(tooBig);
    if (!normalizePhone(phone)) return setErr("Please enter your 10-digit mobile number.");
    if (!returning) {
      const age = dob ? ageOn(dob) : null;
      if (age == null) return setErr("Please enter your date of birth.");
      if (age < MIN_AGE) return setErr(`The league is open to players aged ${MIN_AGE} and above.`);
      if (!photo || !aadhaar) return setErr("Please add your photo and your Aadhaar card.");
    }
    if (!meal) return setErr("Please choose veg or non-veg.");
    if (!infoDeclared || !docsConsent || !feeAck) return setErr("Please tick all three declarations.");

    setBusy(true);
    try {
      let photoPath: string | null = null;
      let aadhaarPath: string | null = null;
      const wanted = [
        ...(photo ? [{ kind: "photo" as const, file: photo }] : []),
        ...(aadhaar ? [{ kind: "aadhaar" as const, file: aadhaar }] : []),
      ];
      if (wanted.length) {
        const prep = await prepareUploads(
          phone,
          wanted.map((w) => ({ kind: w.kind, ext: w.file.name.split(".").pop() ?? "" }))
        );
        if (prep.error || !prep.uploads) throw new Error(prep.error ?? "Upload failed.");
        const storage = createClient().storage.from(BUCKET);
        for (const u of prep.uploads) {
          const file = wanted.find((w) => w.kind === u.kind)!.file;
          const { error } = await storage.uploadToSignedUrl(u.path, u.token, file, {
            contentType: file.type,
          });
          if (error) throw new Error("A file didn't upload. Check your connection and try again.");
          if (u.kind === "photo") photoPath = u.path;
          else aadhaarPath = u.path;
        }
      }

      const res = await submitRegistration({
        phone,
        masterId: profile?.id ?? null,
        matchedBy,
        full_name: returning ? profile!.full_name : fullName,
        dob,
        email,
        cricheroes_link: cricheroes,
        linkedin_link: linkedin,
        batting_hand: batting,
        bowling_type: bowling,
        allrounder,
        is_keeper: keeper,
        photo_path: photoPath,
        aadhaar_path: aadhaarPath,
        tshirt_size: tshirt,
        lower_size: lower,
        jersey_number: jerseyNo,
        jersey_name: jerseyName,
        fee_ack: feeAck,
        info_declared: infoDeclared,
        docs_consent: docsConsent,
        meal_pref: meal,
        food_allergies: allergies,
      });
      if (res.error) throw new Error(res.error);
      setStage("done");
      window.scrollTo({ top: 0, behavior: "smooth" });
    } catch (x) {
      setErr(x instanceof Error ? x.message : "Something went wrong. Please try again.");
    } finally {
      setBusy(false);
    }
  }

  const error = err && (
    <p role="alert" className="rounded-[10px] border border-red/30 bg-red/5 px-4 py-3 text-sm text-red-deep">
      {err}
    </p>
  );

  // Name search, shown on the first screen beside the mobile lookup and again
  // when a number isn't on file.
  const searchBox = (
    <div className="space-y-4">
      <form onSubmit={runSearch} className="space-y-4">
        <Field label="Your name">
          <input
            id="reg-search"
            className="input"
            placeholder="Start typing, e.g. Kanishk"
            value={nameQ}
            onChange={(e) => onNameInput(e.target.value)}
            autoComplete="off"
            aria-describedby="reg-search-hint"
          />
        </Field>
        <p id="reg-search-hint" className="-mt-2 text-xs text-muted">
          {searching ? "Searching…" : "Matching players appear as you type."}
        </p>
      </form>
      {results && results.length > 0 && (
        <p className="label-mono">
          {results.length === 8 ? "Top 8 matches · keep typing to narrow" : `${results.length} match${results.length === 1 ? "" : "es"}`}
        </p>
      )}
      {results && results.length === 0 && !searching && (
        <p className="text-sm text-muted">No one by that name. Try your surname only, or register as new.</p>
      )}
      {results && results.length > 0 && (
        <ul className="grid gap-3">
          {results.map((r) => (
            <li key={r.id}>
              <button
                type="button"
                onClick={() => pick(r)}
                className="flex w-full items-center gap-3 rounded-[12px] border border-line bg-surface p-2.5 text-left transition hover:border-red"
              >
                <PlayerPhoto src={r.photo_url} name={r.full_name} className="h-14 w-12 shrink-0 rounded-[8px]" sizes="48px" />
                <span className="min-w-0 flex-1">
                  <span className="block font-display text-lg uppercase leading-tight">{r.full_name}</span>
                  <span className="mt-0.5 block truncate text-[0.813rem] text-muted">
                    {[r.is_owner ? "Team owner" : null, r.last_team, prettyRole(r.primary_role)].filter(Boolean).join(" · ")}
                  </span>
                </span>
                <span className="label-mono shrink-0 text-red">That&apos;s me →</span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );

  if (stage === "done") {
    return (
      <div className="card p-8 text-center">
        <p className="eyebrow">Registration received</p>
        <h2 className="mt-2 text-3xl">You&apos;re in the queue</h2>
        <p className="mx-auto mt-3 max-w-md text-muted">
          The league reviews every registration before the auction pool is published.
          We&apos;ll contact you on {phone.replace(/\D/g, "").slice(-10)} if we need anything.
        </p>
      </div>
    );
  }

  if (stage === "phone") {
    return (
      <div className="space-y-5">
        <div>
          <p className="eyebrow">Step 1 · Find your profile</p>
          <h2 className="mt-2 text-2xl sm:text-3xl">Played with us before?</h2>
          <p className="mt-2 text-sm text-muted">
            Use your mobile number or search your name. Your profile, photo and stats come up
            ready, so you only add your kit details.
          </p>
        </div>
        {error}
        <div className="grid gap-5 lg:grid-cols-2">
          <form onSubmit={findProfile} className="card space-y-4 p-6">
            <h3 className="text-xl">By mobile number</h3>
            <Field label="Mobile number">
              <input
                id="reg-phone"
                className="input"
                inputMode="numeric"
                autoComplete="tel-national"
                placeholder="10-digit mobile"
                value={phone}
                onChange={(e) => onPhoneInput(e.target.value)}
              />
            </Field>
            <button type="submit" className="btn-primary" disabled={busy}>
              {busy ? "Looking up…" : "Continue"}
            </button>
          </form>
          <div className="card space-y-4 p-6">
            <h3 className="text-xl">By name</h3>
            {searchBox}
          </div>
        </div>
        <p className="text-sm text-muted">
          First time with the league?{" "}
          <button type="button" className="font-medium text-red underline" onClick={newPlayer}>
            Register as a new player
          </button>
        </p>
      </div>
    );
  }

  if (stage === "search") {
    return (
      <div className="card space-y-5 p-6 sm:p-8">
        <div>
          <p className="eyebrow">Number not on file</p>
          <h2 className="mt-2 text-2xl sm:text-3xl">Played with us before?</h2>
          <p className="mt-2 text-sm text-muted">
            We don&apos;t have {normalizePhone(phone)} on record. Search your name to find your
            profile, or register as a new player.
          </p>
        </div>
        {searchBox}
        {error}
        <div className="border-t border-line pt-5">
          <button type="button" className="btn-ghost" onClick={newPlayer}>
            I&apos;m new. Register as a new player
          </button>
        </div>
      </div>
    );
  }

  if (stage === "confirm" && profile) {
    return (
      <div className="space-y-5">
        <p className="eyebrow">{matchedBy === "phone" ? "We found you" : "Is this you?"}</p>
        <PlayerCard p={profile} />
        <div className="flex flex-wrap gap-3">
          <button type="button" className="btn-primary" onClick={() => setStage("form")}>
            This is me
          </button>
          <button type="button" className="btn-ghost" onClick={notMe}>
            Not me
          </button>
        </div>
      </div>
    );
  }

  return (
    <form onSubmit={submit} className="card space-y-8 p-6 sm:p-8">
      <div>
        <p className="eyebrow">{returning ? "Welcome back" : "New player"}</p>
        <h2 className="mt-2 text-2xl sm:text-3xl">
          {returning ? profile!.full_name : "Your details"}
        </h2>
        <p className="mt-2 text-sm text-muted">
          {returning
            ? "Your profile and stats carry over. Just add your kit details for Season 2."
            : "Fill this once. Every field is needed for the auction pool."}
        </p>
      </div>

      {!phoneFixed && (
        <section className="grid gap-5 sm:grid-cols-2">
          <Field label="Mobile number" hint="We contact you on this number about your registration.">
            <input
              id="reg-phone2"
              className="input"
              inputMode="numeric"
              autoComplete="tel-national"
              placeholder="10-digit mobile"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
            />
          </Field>
        </section>
      )}

      {!returning && (
        <section className="grid gap-5 sm:grid-cols-2">
          <Field label="Full name">
            <input id="reg-name" className="input" value={fullName} onChange={(e) => setFullName(e.target.value)} autoComplete="name" />
          </Field>
          <Field label="Date of birth" hint={`Open to players aged ${MIN_AGE} and above.`}>
            <input id="reg-dob" type="date" className="input" value={dob} onChange={(e) => setDob(e.target.value)} />
          </Field>
          <Field label="Email">
            <input id="reg-email" type="email" className="input" value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" />
          </Field>
          <Field label="CricHeroes profile link" hint="Reviewers open this to assess your game.">
            <input id="reg-ch" className="input" placeholder="cricheroes.com/player-profile/…" value={cricheroes} onChange={(e) => setCricheroes(e.target.value)} />
          </Field>
        </section>
      )}

      <section className="grid gap-5 sm:grid-cols-2">
        <Field
          label="LinkedIn profile link"
          hint={returning && linkedin ? "From our records. Update it if it has changed." : undefined}
        >
          <input id="reg-li" className="input" placeholder="linkedin.com/in/…" value={linkedin} onChange={(e) => setLinkedin(e.target.value)} />
        </Field>
      </section>

      {!returning && (
        <section className="space-y-4">
          <h3 className="text-xl">Playing role</h3>
          <p className="-mt-2 text-sm text-muted">Pick one in each group that applies to you.</p>
          <Choice legend="Batting" options={BATTING} value={batting} onChange={setBatting} />
          <Choice legend="Bowling" options={BOWLING} value={bowling} onChange={setBowling} />
          <Choice legend="All-rounder" options={ALLROUNDER} value={allrounder} onChange={setAllrounder} />
          <Choice
            legend="Wicket keeper"
            options={["WK Keeper Batsman"]}
            value={keeper ? "WK Keeper Batsman" : ""}
            onChange={(v) => setKeeper(!!v)}
          />
        </section>
      )}

      <section className="grid gap-5 sm:grid-cols-2">
        <FilePick
          id="reg-photo"
          label={returning ? "New photo (optional)" : "Your photo"}
          accept="image/jpeg,image/png,image/webp"
          file={photo}
          onFile={setPhoto}
          hint="JPG, PNG or WEBP, up to 5 MB"
        />
        {!returning && (
          <FilePick
            id="reg-aadhaar"
            label="Aadhaar card"
            accept="image/jpeg,image/png,image/webp,application/pdf"
            file={aadhaar}
            onFile={setAadhaar}
            hint="Photo or PDF, up to 5 MB. Seen only by league admins."
          />
        )}
      </section>

      <section className="space-y-4">
        <h3 className="text-xl">Kit &amp; jersey</h3>
        <div className="grid gap-5 sm:grid-cols-2">
          <Field label="Name on jersey">
            <input id="reg-jname" className="input" placeholder="As printed on the back" value={jerseyName} onChange={(e) => setJerseyName(e.target.value)} maxLength={16} />
          </Field>
          <Field label="Number on jersey">
            <input id="reg-jno" className="input" inputMode="numeric" placeholder="e.g. 7" value={jerseyNo} onChange={(e) => setJerseyNo(e.target.value.replace(/\D/g, "").slice(0, 3))} />
          </Field>
          <Field label="T-shirt size">
            <select id="reg-tshirt" className="input" value={tshirt} onChange={(e) => setTshirt(e.target.value)}>
              <option value="">Select size</option>
              {SIZES.map((s) => (
                <option key={s}>{s}</option>
              ))}
            </select>
          </Field>
          <Field label="Lower size">
            <select id="reg-lower" className="input" value={lower} onChange={(e) => setLower(e.target.value)}>
              <option value="">Select size</option>
              {SIZES.map((s) => (
                <option key={s}>{s}</option>
              ))}
            </select>
          </Field>
        </div>
      </section>

      <section className="space-y-4">
        <h3 className="text-xl">Food</h3>
        <div className="grid gap-5 sm:grid-cols-2">
          <Choice legend="Meal preference" options={MEALS} value={meal} onChange={setMeal} />
          <Field label="Food allergies (if any)">
            <input id="reg-allergies" className="input" placeholder="e.g. peanuts, or leave blank" value={allergies} onChange={(e) => setAllergies(e.target.value)} maxLength={200} />
          </Field>
        </div>
      </section>

      <fieldset className="space-y-3 rounded-[12px] border border-gold-line bg-gold-fill p-4 text-sm text-ink">
        <legend className="label-mono px-1">Declarations · tick all three</legend>
        {[
          {
            id: "reg-true",
            checked: infoDeclared,
            set: setInfoDeclared,
            text: <>I declare that all the information I have given is <strong>true and correct</strong>.</>,
          },
          {
            id: "reg-docs",
            checked: docsConsent,
            set: setDocsConsent,
            text: <>I agree to <strong>share important documents</strong> (such as ID or age proof) with the league if asked.</>,
          },
          {
            id: "reg-fee",
            checked: feeAck,
            set: setFeeAck,
            text: (
              <>
                I understand that if I am selected in the auction, I must pay a{" "}
                <strong>mandatory registration fee of ₹3,000</strong>, and I agree to be contacted about my registration.
              </>
            ),
          },
        ].map((d) => (
          <label key={d.id} className="flex cursor-pointer gap-3">
            <input
              id={d.id}
              type="checkbox"
              className="mt-0.5 h-4 w-4 shrink-0 accent-[var(--red-deep)]"
              checked={d.checked}
              onChange={(e) => d.set(e.target.checked)}
            />
            <span>{d.text}</span>
          </label>
        ))}
      </fieldset>

      {error}

      <div className="flex flex-wrap items-center gap-3">
        <button type="submit" className="btn-primary" disabled={busy || !feeAck || !infoDeclared || !docsConsent}>
          {busy ? "Submitting…" : "Submit registration"}
        </button>
        <button type="button" className="btn-ghost" onClick={() => { setStage("phone"); setProfile(null); setMatchedBy(null); setResults(null); setPhoneFixed(false); setErr(null); }}>
          Start over
        </button>
      </div>
    </form>
  );
}
