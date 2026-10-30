import type { StaticImageData } from "next/image";
import acci from "./brand/teams/acci.png";
import bengalTigers from "./brand/teams/bengal-tigers.png";
import chennaiThalaivas from "./brand/teams/chennai-thalaivas.png";
import goanMonks from "./brand/teams/goan-monks.png";
import jaipurRoyals from "./brand/teams/jaipur-royals.png";
import lucknowStrikers from "./brand/teams/lucknow-strikers.png";
import punjabRoyals from "./brand/teams/punjab-royals-legends.png";

// The fourteen Season 2 franchises, their groups (schedule draw) and owners, as
// in the owners' meet deck (30 Oct 2026). Logos are from the league's Drive
// (SLL'26 Repository › Team Logos), resized to 400px; teams without one yet
// show a lettered crest.
export type Franchise = { name: string; group: "A" | "B"; logo?: StaticImageData; owners: string[] };

export const FRANCHISES: Franchise[] = [
  { name: "ACCI", group: "A", logo: acci, owners: ["Russel A.", "Vishal Salgy", "Pardeep Mahalawat"] },
  { name: "Bengal Tigers", group: "A", logo: bengalTigers, owners: ["Dipak Singh", "K. Raj Bhansali"] },
  { name: "Chennai Thalaiva", group: "A", logo: chennaiThalaivas, owners: ["Vasant Kumar"] },
  { name: "Lucknow Strikers", group: "A", logo: lucknowStrikers, owners: ["Luvkesh", "Dr. Rohan"] },
  { name: "UP Warriors", group: "A", owners: ["Sandeep Kumar", "Bharat Sharma"] },
  { name: "SLL 10", group: "A", owners: ["Vikram Chaddha", "Sumit Talwar", "Saurabh Anand"] },
  { name: "Diplomats 1", group: "A", owners: [] },
  { name: "Goan Monks", group: "B", logo: goanMonks, owners: ["Sameer Bhalla", "Aditya Sharma"] },
  { name: "Gurugram Knights", group: "B", owners: ["Ayush Jagga"] },
  { name: "Jaipur Royals", group: "B", logo: jaipurRoyals, owners: ["Saurav Suneja", "Hemant Kumar"] },
  { name: "Punjab Royals", group: "B", logo: punjabRoyals, owners: ["Sunil Bansal"] },
  { name: "Diplomats 2", group: "B", owners: [] },
  { name: "SLL 13", group: "B", owners: [] },
  { name: "SLL 14", group: "B", owners: [] },
];

// Past sheets spell teams loosely ("Chennai Thalaiva", "Punjab Royals").
const key = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, "");
export function findFranchise(name: string | null | undefined): Franchise | undefined {
  if (!name) return undefined;
  const k = key(name);
  return FRANCHISES.find((f) => key(f.name).startsWith(k) || k.startsWith(key(f.name)));
}
