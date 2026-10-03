import { loadBoard } from "@/lib/auction/board-data";
import OperatorPad from "./OperatorPad";

export const dynamic = "force-dynamic";

export const metadata = { title: "Operator pad — SDLL Auction" };

// The operator's screen on auction day (admin-only via admin/layout). Same
// data as the big screen, plus the full pool for search.
export default async function PadPage() {
  const board = await loadBoard({ queue: 8 });
  if (!board) return <p className="text-muted">Auction season not found.</p>;
  return <OperatorPad board={board} />;
}
