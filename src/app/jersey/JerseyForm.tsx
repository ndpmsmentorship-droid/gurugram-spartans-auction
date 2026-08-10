"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { saveJersey } from "./actions";

export type JerseyPlayer = {
  id: string;
  full_name: string;
  display_name?: string | null;
  jersey_number?: string | null;
  tshirt_size?: string | null;
  lower_size?: string | null;
};

const SIZES = ["XS", "S", "M", "L", "XL", "2XL", "3XL", "4XL"];

export default function JerseyForm({ players }: { players: JerseyPlayer[] }) {
  const router = useRouter();
  const [pid, setPid] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [jersey, setJersey] = useState("");
  const [tshirt, setTshirt] = useState("");
  const [lower, setLower] = useState("");
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<{ text: string; ok?: boolean } | null>(null);

  const selected = players.find((p) => p.id === pid) ?? null;
  const done = players.filter((p) => p.jersey_number || p.tshirt_size || p.lower_size).length;

  function pick(id: string) {
    setPid(id);
    const p = players.find((x) => x.id === id);
    setDisplayName(p?.display_name ?? "");
    setJersey(p?.jersey_number ?? "");
    setTshirt(p?.tshirt_size ?? "");
    setLower(p?.lower_size ?? "");
    setMsg(null);
  }

  async function submit() {
    if (!pid) return setMsg({ text: "Please select your name." });
    setSaving(true);
    const res = await saveJersey({
      player_id: pid,
      full_name: selected?.full_name ?? "",
      display_name: displayName,
      jersey_number: jersey,
      tshirt_size: tshirt,
      lower_size: lower,
    });
    setSaving(false);
    if (res?.error) setMsg({ text: res.error });
    else {
      setMsg({ text: "Saved — thank you! 🏏", ok: true });
      router.refresh();
    }
  }

  return (
    <main className="mx-auto w-full max-w-lg flex-1 px-4 py-10 sm:px-6">
      <p className="eyebrow">Gurugram Spartans · Season 6</p>
      <h1 className="mt-1 font-display text-3xl font-bold tracking-tight">Kit &amp; jersey sizes</h1>
      <p className="mt-2 text-muted">
        Pick your name and enter your jersey number and sizes. You can re-open this link to update.
      </p>

      <div className="mt-6 space-y-4 rounded-2xl border border-border bg-surface p-5">
        <div>
          <label className="mb-1 block text-xs font-medium text-muted">Your name</label>
          <select value={pid} onChange={(e) => pick(e.target.value)} className="input w-full">
            <option value="">Select your name…</option>
            {players.map((p) => (
              <option key={p.id} value={p.id}>
                {p.full_name}
                {p.jersey_number || p.tshirt_size || p.lower_size ? " ✓" : ""}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="mb-1 block text-xs font-medium text-muted">Name on jersey</label>
          <input
            value={displayName}
            onChange={(e) => setDisplayName(e.target.value)}
            placeholder="e.g. NIKHIL"
            className="input w-full"
          />
        </div>

        <div className="grid gap-4 sm:grid-cols-3">
          <div>
            <label className="mb-1 block text-xs font-medium text-muted">Jersey #</label>
            <input
              value={jersey}
              onChange={(e) => setJersey(e.target.value)}
              inputMode="numeric"
              placeholder="e.g. 7"
              className="input w-full"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-muted">T-shirt size</label>
            <input
              value={tshirt}
              onChange={(e) => setTshirt(e.target.value)}
              list="sizes"
              placeholder="L / 42"
              className="input w-full"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-muted">Lower size</label>
            <input
              value={lower}
              onChange={(e) => setLower(e.target.value)}
              list="sizes"
              placeholder="XL / 34"
              className="input w-full"
            />
          </div>
        </div>
        <datalist id="sizes">
          {SIZES.map((s) => (
            <option key={s} value={s} />
          ))}
        </datalist>

        <div className="flex items-center gap-3">
          <button
            onClick={submit}
            disabled={saving || !pid}
            className="rounded-lg bg-accent px-4 py-2 text-sm font-semibold text-white transition-opacity hover:opacity-90 disabled:opacity-60"
          >
            {saving ? "Saving…" : "Save my size"}
          </button>
          {msg && <span className={`text-sm ${msg.ok ? "text-up" : "text-down"}`}>{msg.text}</span>}
        </div>
      </div>

      <div className="mt-8">
        <h2 className="mb-2 text-sm font-semibold">
          Collected so far <span className="text-muted">({done}/{players.length})</span>
        </h2>
        <div className="overflow-x-auto rounded-xl border border-border">
          <table className="w-full min-w-[460px] text-sm">
            <thead className="bg-wash text-left text-muted">
              <tr>
                <th className="px-3 py-2.5 font-medium">Name</th>
                <th className="px-3 py-2.5 font-medium">On jersey</th>
                <th className="px-3 py-2.5 text-center font-medium">#</th>
                <th className="px-3 py-2.5 text-center font-medium">T-shirt</th>
                <th className="px-3 py-2.5 text-center font-medium">Lower</th>
              </tr>
            </thead>
            <tbody>
              {players.map((p) => (
                <tr key={p.id} className="border-t border-border">
                  <td className="px-3 py-2 font-medium">{p.full_name}</td>
                  <td className="px-3 py-2">{p.display_name || "—"}</td>
                  <td className="px-3 py-2 text-center tabular-nums">{p.jersey_number || "—"}</td>
                  <td className="px-3 py-2 text-center tabular-nums">{p.tshirt_size || "—"}</td>
                  <td className="px-3 py-2 text-center tabular-nums">{p.lower_size || "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </main>
  );
}
