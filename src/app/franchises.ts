import type { StaticImageData } from "next/image";
import acci from "./brand/teams/acci.png";
import bengalTigers from "./brand/teams/bengal-tigers.png";
import bhojpuriDabangs from "./brand/teams/bhojpuri-dabangs.png";
import chennaiThalaivas from "./brand/teams/chennai-thalaivas.png";
import goanMonks from "./brand/teams/goan-monks.png";
import gurugramSpartans from "./brand/teams/gurugram-spartans.png";
import jaipurRoyals from "./brand/teams/jaipur-royals.png";
import lucknowStrikers from "./brand/teams/lucknow-strikers.png";
import ncrTurboChargers from "./brand/teams/ncr-turbo-chargers.png";
import patnaPanthers from "./brand/teams/patna-panthers.png";
import punjabRoyals from "./brand/teams/punjab-royals-legends.png";
import uttrakhandYoddhas from "./brand/teams/uttrakhand-yoddhas.png";

// The twelve Season 2 franchises and their groups (schedule draw). Logos are
// from the league's Drive (SLL'26 Repository › Team Logos), resized to 400px.
export type Franchise = { name: string; group: "A" | "B"; logo: StaticImageData };

export const FRANCHISES: Franchise[] = [
  { name: "ACCI", group: "A", logo: acci },
  { name: "Bengal Tigers", group: "A", logo: bengalTigers },
  { name: "Chennai Thalaivas", group: "A", logo: chennaiThalaivas },
  { name: "Lucknow Strikers", group: "A", logo: lucknowStrikers },
  { name: "NCR Turbo Chargers", group: "A", logo: ncrTurboChargers },
  { name: "Patna Panthers", group: "A", logo: patnaPanthers },
  { name: "Bhojpuri Dabangs", group: "B", logo: bhojpuriDabangs },
  { name: "Goan Monks", group: "B", logo: goanMonks },
  { name: "Gurugram Spartans", group: "B", logo: gurugramSpartans },
  { name: "Jaipur Royals", group: "B", logo: jaipurRoyals },
  { name: "Punjab Royals Legends", group: "B", logo: punjabRoyals },
  { name: "Uttrakhand Yoddhas", group: "B", logo: uttrakhandYoddhas },
];

// Past sheets spell teams loosely ("Chennai Thalaiva", "Punjab Royals").
const key = (s: string) => s.toLowerCase().replace(/[^a-z]/g, "");
export function findFranchise(name: string | null | undefined): Franchise | undefined {
  if (!name) return undefined;
  const k = key(name);
  return FRANCHISES.find((f) => key(f.name).startsWith(k) || k.startsWith(key(f.name)));
}
