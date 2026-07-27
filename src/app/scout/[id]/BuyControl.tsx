"use client";

import { useState, useTransition } from "react";
import { markBought, unmarkBought, setRejected } from "@/app/scout/actions";

export default function BuyControl({
  playerId,
  isBought,
  isRejected,
  boughtPrice,
}: {
  playerId: string;
  isBought: boolean;
  isRejected: boolean;
  boughtPrice: number | null;
}) {
  const [buying, setBuying] = useState(false);
  const [price, setPrice] = useState("");
  const [pending, startTransition] = useTransition();

  if (isRejected) {
    return (
      <div className="flex items-center gap-3">
        <span className="badge bg-down/15 text-down">Disqualified</span>
        <button
          onClick={() =>
            startTransition(async () => {
              await setRejected(playerId, false);
            })
          }
          disabled={pending}
          className="text-sm text-muted hover:text-accent-text"
        >
          Restore to pool
        </button>
      </div>
    );
  }

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
      <div className="flex items-center gap-2">
        <button onClick={() => setBuying(true)} className="btn-primary">
          Mark bought
        </button>
        <button
          onClick={() =>
            startTransition(async () => {
              await setRejected(playerId, true);
            })
          }
          disabled={pending}
          className="btn-ghost hover:border-down hover:text-down"
        >
          Reject
        </button>
      </div>
    );
  }

  const submit = () => {
    const p = Number(price);
    if (Number.isFinite(p) && p > 0)
      startTransition(async () => {
        await markBought(playerId, p);
      });
  };

  return (
    <div className="flex gap-2">
      <input
        type="number"
        autoFocus
        className="input w-32"
        placeholder="Price"
        value={price}
        onChange={(e) => setPrice(e.target.value)}
        onKeyDown={(e) => e.key === "Enter" && submit()}
      />
      <button onClick={submit} disabled={pending} className="btn-primary">
        Confirm
      </button>
      <button onClick={() => setBuying(false)} className="btn-ghost">
        Cancel
      </button>
    </div>
  );
}
