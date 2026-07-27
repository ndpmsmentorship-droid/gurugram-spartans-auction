import ImportForm from "./ImportForm";

export default function ImportPage() {
  return (
    <main className="mx-auto w-full max-w-6xl flex-1 px-5 py-10">
      <p className="eyebrow">Step 1</p>
      <h1 className="mt-2 font-display text-2xl font-bold">Import the auction pool</h1>
      <p className="mt-1 max-w-xl text-muted">
        Upload the organizers&apos; player file. Every player is cleaned, scored,
        and ranked on batting, bowling, fielding and keeping.
      </p>
      <div className="mt-6">
        <ImportForm />
      </div>
    </main>
  );
}
