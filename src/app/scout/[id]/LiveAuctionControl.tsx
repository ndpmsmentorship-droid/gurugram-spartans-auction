"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { assignPlayer, unassignPlayer } from "@/app/admin/auction/actions";

export type LiveTeam = { id: string; name: string; division: string | null };
export type LiveStatus = { teamId: string; teamName: string; price: number | null; acquired: string | null };

const inr = (n: number | null) => "₹" + Math.round(n || 0).toLocaleString("en-IN");
const catCode = (c: string | null) => (c ?? "").toUpperCase().replace(/\s+/g, "");
const isLegend = (c: string | null) => catCode(c).includes("LEGEND");
const basePrice = (c: string | null) => (!isLegend(c) && catCode(c).endsWith("A") ? 15000 : 5000);
const DIVS = ["Elite", "Challengers", "Fighters"];

export default function LiveAuctionControl({
  playerId,
  category,
  teams,
  status,
  isAdmin,
}: {
  playerId: string;
  category: string | null;
  teams: LiveTeam[];
  status: LiveStatus | null;
  isAdmin: boolean;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [teamId, setTeamId] = useState("");
  const [price, setPrice] = useState(String(basePrice(category)));
  const [msg, setMsg] = useState<string | null>(null);

  const label =
    status?.acquired === "retained" ? "Retained by" : status?.acquired === "owner" ? "Owner" : "Sold to";

  function sell() {
    if (!teamId) return setMsg("Pick a team.");
    const amt = Number(price);
    if (!Number.isFinite(amt) || amt < 0) return setMsg("Enter a valid price.");
    if (amt > 100000) return setMsg("Max bid is ₹1,00,000.");
    setMsg(null);
    start(async () => {
      const res = await assignPlayer(playerId, teamId, amt);
      if (res?.error) setMsg(res.error);
      else router.refresh();
    });
  }

  function undo() {
    setMsg(null);
    start(async () => {
      const res = await unassignPlayer(playerId);
      if (res?.error) setMsg(res.error);
      else router.refresh();
    });
  }

  return (
    <section className="card">
      <p className="eyebrow mb-2">Live auction</p>

      {status ? (
        <div className="flex flex-wrap items-center gap-3">
          <span className="badge bg-accent text-ink">
            {label} {status.teamName}
            {status.acquired === "auction" || status.acquired == null ? ` · ${inr(status.price)}` : ""}
          </span>
          {isAdmin && (
            <button onClick={undo} disabled={pending} className="text-sm text-muted hover:text-down disabled:opacity-60">
              Undo
            </button>
          )}
        </div>
      ) : isAdmin ? (
        <div className="flex flex-wrap items-end gap-2">
          <div>
            <label className="mb-1 block text-xs text-muted">Team</label>
            <select
              value={teamId}
              onChange={(e) => setTeamId(e.target.value)}
              className="input w-48"
            >
              <option value="">Select team…</option>
              {DIVS.map((d) => (
                <optgroup key={d} label={d}>
                  {teams.filter((t) => t.division === d).map((t) => (
                    <option key={t.id} value={t.id}>{t.name}</option>
                  ))}
                </optgroup>
              ))}
            </select>
          </div>
          <div>
            <label className="mb-1 block text-xs text-muted">Price (₹)</label>
            <input
              type="number"
              inputMode="numeric"
              value={price}
              onChange={(e) => setPrice(e.target.value)}
              className="input w-28 tabular-nums"
            />
          </div>
          <button onClick={sell} disabled={pending} className="btn-primary">
            {pending ? "Saving…" : "Sell (live)"}
          </button>
        </div>
      ) : (
        <span className="badge bg-wash text-muted">Available in the auction pool</span>
      )}

      {msg && <p className="mt-2 text-sm text-down">{msg}</p>}
    </section>
  );
}
