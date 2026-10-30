import { redirect } from "next/navigation";

// My Squad is part of the owners' portal now.
export default function MyTeamPage() {
  redirect("/owners");
}
