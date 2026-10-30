import { redirect } from "next/navigation";

// Targets became the Plan tab's going-for / hold / reject calls.
export default function TargetsPage() {
  redirect("/war-room?tab=plan");
}
