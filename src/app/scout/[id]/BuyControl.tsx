"use client";

import { useState, useTransition } from "react";
import { markBought, unmarkBought } from "@/app/scout/actions";

export default function BuyControl({
  playerId,
  isBought,
  boughtPrice,
}: {
  playerId: string;
  isBought: boolean;
  boughtPrice: number | null;
}) {
  const [buying, setBuying] = useState(false);
  const [price, setPrice] = useState("");
  const [pending, startTransition] = useTransition();

  if (isBought) {
    return (
      <div className="flex items-center gap-3">
        <span className="badge bg-accent text-ink">
          Bought · {boughtPrice?.toLocaleString()}
        </span>
        <button
          onClick={() =>
            startTransition(async () => {
              await unmarkBought(playerId);
            })
          }
          disabled={pending}
          className="text-sm text-muted hover:text-down"
        >
          Undo purchase
        </button>
      </div>
    );
  }

  if (!buying) {
    return (
      <button onClick={() => setBuying(true)} className="btn-primary">
        Mark bought
      </button>
    );
  }

  return (
    <div className="flex gap-2">
      <input
        type="number"
        autoFocus
        className="input w-32"
        placeholder="Price"
        value={price}
        onChange={(e) => setPrice(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            const p = Number(price);
            if (Number.isFinite(p) && p > 0)
              startTransition(async () => {
                await markBought(playerId, p);
              });
          }
        }}
      />
      <button
        onClick={() => {
          const p = Number(price);
          if (Number.isFinite(p) && p > 0)
            startTransition(async () => {
              await markBought(playerId, p);
            });
        }}
        disabled={pending}
        className="btn-primary"
      >
        Confirm
      </button>
      <button onClick={() => setBuying(false)} className="btn-ghost">
        Cancel
      </button>
    </div>
  );
}
