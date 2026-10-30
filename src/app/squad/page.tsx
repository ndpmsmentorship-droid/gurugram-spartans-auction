import { redirect } from "next/navigation";

// The old Gurugram Spartans squad showcase is retired; the live board shows every squad.
export default function SquadPage() {
  redirect("/auction");
}
