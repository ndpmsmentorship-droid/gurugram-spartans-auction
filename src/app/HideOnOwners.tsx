"use client";

import { usePathname } from "next/navigation";
import { isOwnersPage } from "./owners-chrome";

// Hides its children on the owners' portal pages (see owners-chrome.ts).
export default function HideOnOwners({ children }: { children: React.ReactNode }) {
  return isOwnersPage(usePathname()) ? null : <>{children}</>;
}
