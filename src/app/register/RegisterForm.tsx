"use client";

import { useState } from "react";
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
  const [profile, setProfile] = useState<Profile | null>(null);
  const [matchedBy, setMatchedBy] = useState<"phone" | "name" | null>(null);
  const [nameQ, setNameQ] = useState("");
  const [results, setResults] = useState<Profile[] | null>(null);

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

  const returning = !!profile;

  async function findProfile(e: React.FormEvent) {
    e.preventDefault();
    setErr(null);
    if (!normalizePhone(phone)) return setErr("Enter a 10-digit mobile number.");
    setBusy(true);
    const res = await lookupPlayer(phone);
    setBusy(false);
    if ("error" in res) return setErr(res.error);
    if (res.alreadyRegistered)
      return setErr("This number is already registered for Season 2. Contact the league to change your details.");
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
    setBusy(true);
    const res = await searchByName(nameQ);
    setBusy(false);
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
    if (!returning) {
      const age = dob ? ageOn(dob) : null;
      if (age == null) return setErr("Please enter your date of birth.");
      if (age < MIN_AGE) return setErr(`The league is open to players aged ${MIN_AGE} and above.`);
      if (!photo || !aadhaar) return setErr("Please add your photo and your Aadhaar card.");
    }
    if (!feeAck) return setErr("Please tick the registration fee declaration.");

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
      <form onSubmit={findProfile} className="card space-y-5 p-6 sm:p-8">
        <div>
          <p className="eyebrow">Step 1</p>
          <h2 className="mt-2 text-2xl sm:text-3xl">Your mobile number</h2>
          <p className="mt-2 text-sm text-muted">
            Played in a Shanti Devi or SARDA season before? We&apos;ll find your profile so you
            don&apos;t have to type it again.
          </p>
        </div>
        <Field label="Mobile number">
          <input
            id="reg-phone"
            className="input"
            inputMode="numeric"
            autoComplete="tel-national"
            placeholder="10-digit mobile"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
          />
        </Field>
        {error}
        <button type="submit" className="btn-primary" disabled={busy}>
          {busy ? "Looking up…" : "Continue"}
        </button>
      </form>
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
        <form onSubmit={runSearch} className="flex flex-col gap-3 sm:flex-row">
          <input
            id="reg-search"
            className="input"
            placeholder="Your name, e.g. Kanishk Sheel"
            value={nameQ}
            onChange={(e) => setNameQ(e.target.value)}
            autoComplete="name"
          />
          <button type="submit" className="btn-primary shrink-0" disabled={busy}>
            {busy ? "Searching…" : "Search"}
          </button>
        </form>
        {error}
        {results && results.length === 0 && (
          <p className="text-sm text-muted">No one by that name. Try your surname only, or register as new.</p>
        )}
        {results && results.length > 0 && (
          <ul className="grid gap-3">
            {results.map((r) => (
              <li key={r.id}>
                <button
                  type="button"
                  onClick={() => pick(r)}
                  className="flex w-full items-center gap-4 rounded-[12px] border border-line bg-surface p-3 text-left transition hover:border-red"
                >
                  <PlayerPhoto src={r.photo_url} name={r.full_name} className="h-20 w-16 shrink-0 rounded-[8px]" sizes="64px" />
                  <span className="min-w-0 flex-1">
                    <span className="block font-display text-xl uppercase leading-tight">{r.full_name}</span>
                    <span className="mt-1 block text-sm text-muted">
                      {[r.is_owner ? "Team owner" : null, r.last_team, prettyRole(r.primary_role)].filter(Boolean).join(" · ")}
                    </span>
                  </span>
                  <span className="label-mono shrink-0 text-red">That&apos;s me →</span>
                </button>
              </li>
            ))}
          </ul>
        )}
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

      <label className="flex cursor-pointer gap-3 rounded-[12px] border border-gold-line bg-gold-fill p-4 text-sm text-ink">
        <input
          id="reg-fee"
          type="checkbox"
          className="mt-0.5 h-4 w-4 shrink-0 accent-[var(--red-deep)]"
          checked={feeAck}
          onChange={(e) => setFeeAck(e.target.checked)}
        />
        <span>
          I understand that if I am selected in the auction, I must pay a{" "}
          <strong>mandatory registration fee of ₹3,000</strong>. I confirm the details above are
          accurate and agree to be contacted about my registration.
        </span>
      </label>

      {error}

      <div className="flex flex-wrap items-center gap-3">
        <button type="submit" className="btn-primary" disabled={busy || !feeAck}>
          {busy ? "Submitting…" : "Submit registration"}
        </button>
        <button type="button" className="btn-ghost" onClick={() => { setStage("phone"); setProfile(null); setMatchedBy(null); setResults(null); setErr(null); }}>
          Start over
        </button>
      </div>
    </form>
  );
}
