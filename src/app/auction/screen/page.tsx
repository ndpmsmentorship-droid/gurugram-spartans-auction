import { loadBoard } from "@/lib/auction/board-data";
import BigScreen from "./BigScreen";

export const dynamic = "force-dynamic";

export const metadata = { title: "SDLL Auction — Big Screen" };

// The hall screen: what the projector shows on auction day. Public like the
// live board (read-only), and follows the operator pad over realtime.
export default async function ScreenPage() {
  const board = await loadBoard({ queue: 5 });
  if (!board) return <p className="p-6 text-muted">Auction season not found.</p>;
  // the pad's full search list isn't needed here — keep the payload light
  return <BigScreen board={{ ...board, available: [] }} />;
}
