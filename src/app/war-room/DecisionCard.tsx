"use client";

import { useState } from "react";
import { DATA_LABEL, type Rated, type Verdict } from "@/lib/auction/planner";
import { inr } from "@/lib/auction/rules";

// The live verdict on the player on the block: worth it or walk away, what he
// does to our playing XII, how often he ends up ours, and why.
export default function DecisionCard({ p, v }: { p: Rated; v: Verdict }) {
  const [tab, setTab] = useState<"why" | "risk" | "alt">("why");
  const delta = v.xiiWith - v.xiiWithout;
  return (
    <div className="mt-3 rounded-[12px] border border-line p-3">
      <div className="grid grid-cols-3 gap-2 text-center">
        <div>
          <p className="num text-lg font-semibold leading-tight">
            {v.xiiWithout} → <span className={delta > 0 ? "text-up" : delta < 0 ? "text-red" : ""}>{v.xiiWith}</span>
          </p>
          <p className="text-[0.688rem] text-muted">Our XII, runs a match</p>
        </div>
        <div>
          <p className="num text-lg font-semibold leading-tight">{v.worth ? inr(v.ceiling) : "—"}</p>
          <p className="text-[0.688rem] text-muted">Our ceiling</p>
        </div>
        <div>
          <p className="num text-lg font-semibold leading-tight">{v.chance} in 10</p>
          <p className="text-[0.688rem] text-muted">He ends up ours</p>
        </div>
      </div>

      <p className={`mt-3 rounded-[10px] px-3 py-2 text-sm font-medium ${v.worth ? "bg-[color-mix(in_srgb,var(--up)_10%,transparent)] text-up" : "bg-[color-mix(in_srgb,var(--red)_8%,transparent)] text-red-deep"}`}>
        {v.worth ? `Worth it up to ${inr(v.ceiling)}` : "Walk away · not for this squad"}
        {p.data !== "ok" && <span className="ml-2 rounded-full bg-gold-fill px-2 py-0.5 text-[0.688rem] text-gold">{DATA_LABEL[p.data]}</span>}
      </p>

      <div className="mt-3 flex gap-1 text-sm">
        {([["why", "Why"], ["risk", "Risk"], ["alt", "Alternative"]] as const).map(([k, l]) => (
          <button
            key={k}
            type="button"
            onClick={() => setTab(k)}
            className={`rounded-full px-3 py-1 ${tab === k ? "bg-ink text-white" : "border border-line text-muted"}`}
          >
            {l}
          </button>
        ))}
      </div>
      <ul className="mt-2 space-y-1 text-sm leading-snug">
        {tab === "why" && v.why.map((w) => <li key={w}>{w}</li>)}
        {tab === "risk" && v.risk.map((w) => <li key={w}>{w}</li>)}
        {tab === "alt" &&
          (v.alternatives.length
            ? v.alternatives.map((a) => (
                <li key={a.id} className="flex justify-between gap-2">
                  <span>
                    {a.full_name} <span className="text-muted">· {a.cat}{a.data !== "ok" ? ` · ${DATA_LABEL[a.data]}` : ""}</span>
                  </span>
                  <span className="num text-muted">≈ {inr(a.price)}</span>
                </li>
              ))
            : <li>Nobody comparable is left after him.</li>)}
      </ul>
      <p className="mt-2 text-[0.688rem] text-muted">Estimates from Sarda/SCCL and Ball Library records. Private to your team.</p>
    </div>
  );
}
