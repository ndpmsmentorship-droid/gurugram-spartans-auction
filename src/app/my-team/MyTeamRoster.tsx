"use client";

import { useState, useTransition } from "react";
import { setBattingOrder, setSquadRole, type SquadRole } from "./actions";

export type RosterRow = {
  id: string;
  sold_price: number;
  is_captain: boolean;
  is_vice_captain: boolean;
  is_keeper: boolean;
  batting_order: number | null;
  players: { full_name: string; primary_role: string | null } | null;
};

export default function MyTeamRoster({ rows }: { rows: RosterRow[] }) {
  return (
    <div className="mt-6 overflow-x-auto rounded-xl border border-border">
      <table className="w-full text-sm">
        <thead className="bg-background text-left text-xs uppercase text-muted">
          <tr>
            <th className="px-3 py-2">Player</th>
            <th className="px-3 py-2">Role</th>
            <th className="px-3 py-2">Bat order</th>
            <th className="px-3 py-2">C</th>
            <th className="px-3 py-2">VC</th>
            <th className="px-3 py-2">WK</th>
            <th className="px-3 py-2">Sold price</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <RosterRowItem key={row.id} row={row} />
          ))}
        </tbody>
      </table>
      {rows.length === 0 && (
        <p className="p-4 text-center text-muted">No players won yet.</p>
      )}
    </div>
  );
}

function RosterRowItem({ row }: { row: RosterRow }) {
  const [order, setOrder] = useState<string>(
    row.batting_order != null ? String(row.batting_order) : ""
  );
  const [pending, startTransition] = useTransition();

  function toggle(role: SquadRole, current: boolean) {
    startTransition(async () => {
      await setSquadRole(row.id, role, !current);
    });
  }

  function saveOrder() {
    const parsed = order.trim() === "" ? null : Number(order);
    startTransition(async () => {
      await setBattingOrder(row.id, parsed);
    });
  }

  return (
    <tr className="border-t border-border">
      <td className="px-3 py-2 font-medium">{row.players?.full_name}</td>
      <td className="px-3 py-2 text-muted">{row.players?.primary_role ?? "—"}</td>
      <td className="px-3 py-2">
        <input
          type="number"
          className="input w-16"
          value={order}
          onChange={(e) => setOrder(e.target.value)}
          onBlur={saveOrder}
        />
      </td>
      <td className="px-3 py-2">
        <RoleToggle active={row.is_captain} onClick={() => toggle("captain", row.is_captain)} disabled={pending} />
      </td>
      <td className="px-3 py-2">
        <RoleToggle active={row.is_vice_captain} onClick={() => toggle("vice_captain", row.is_vice_captain)} disabled={pending} />
      </td>
      <td className="px-3 py-2">
        <RoleToggle active={row.is_keeper} onClick={() => toggle("keeper", row.is_keeper)} disabled={pending} />
      </td>
      <td className="px-3 py-2">{row.sold_price.toLocaleString()}</td>
    </tr>
  );
}

function RoleToggle({
  active,
  onClick,
  disabled,
}: {
  active: boolean;
  onClick: () => void;
  disabled: boolean;
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={`h-6 w-6 rounded-full border text-xs transition disabled:opacity-50 ${
        active
          ? "border-primary bg-primary text-primary-foreground"
          : "border-border hover:border-primary"
      }`}
      aria-pressed={active}
    >
      {active ? "✓" : ""}
    </button>
  );
}
