import { redirect } from "next/navigation";

// The planner now lives in the War Room, one page for the whole auction.
export default function PlanPage() {
  redirect("/war-room?tab=plan");
}
