import type { StaticImageData } from "next/image";
import playfulneuro from "./brand/sponsors/playfulneuro.png";
import playfulVentures from "./brand/sponsors/playful-ventures.png";
import khabarfast from "./brand/sponsors/khabarfast.png";
import sportscube from "./brand/sponsors/sportscube.png";
import mykos from "./brand/sponsors/mykos.png";
import anthlete from "./brand/sponsors/anthlete.png";
import saanvika from "./brand/sponsors/saanvika.png";
import smartstrength from "./brand/sponsors/smartstrength.png";
import machan from "./brand/sponsors/machan.png";
import satya from "./brand/sponsors/satya.png";
import fast1 from "./brand/sponsors/fast1.png";

// Season sponsors, in the order and with the roles printed on the league's own
// ground sponsor strip (Drive: SLL'26 Repository › Grounds PRINTABLES ›
// SPONSOR STRIP). The logos were cut from that strip so they share one scale.
// Change a sponsor here and every page's sponsor bar + the landing wall follow.
export type Sponsor = { name: string; role: string; logo: StaticImageData };

export const TITLE_SPONSOR: Sponsor = {
  name: "PlayfulNeuro Development Centre",
  role: "Title Sponsor",
  logo: playfulneuro,
};

export const PRESENTED_BY: Sponsor = {
  name: "Playful Ventures",
  role: "Presented By",
  logo: playfulVentures,
};

export const PARTNERS: Sponsor[] = [
  { name: "Saanvika Films", role: "Associate Sponsor", logo: saanvika },
  { name: "Machan", role: "Associate Sponsor", logo: machan },
  { name: "SportsCube", role: "Venue Partner", logo: sportscube },
  { name: "Khabarfast", role: "Media Partner", logo: khabarfast },
  { name: "Fast1", role: "Streaming Partner", logo: fast1 },
  { name: "Mykos", role: "Hospitality Partner", logo: mykos },
  { name: "Anthlete Nutritions", role: "Nutrition Partner", logo: anthlete },
  { name: "Smart Strength", role: "Fitness Partner", logo: smartstrength },
  { name: "Satya", role: "Wellness Partner", logo: satya },
];

// Equal-area sizing: a fixed height makes square marks (SportsCube, Mykos)
// look tiny beside wide wordmarks (Satya, Smart Strength). Giving every logo
// the same AREA instead balances their visual weight; maxH stops square marks
// from towering over the row.
export function logoSize(logo: StaticImageData, area: number, maxH: number) {
  const ratio = logo.width / logo.height;
  let h = Math.sqrt(area / ratio);
  if (h > maxH) h = maxH;
  return { width: Math.round(h * ratio), height: Math.round(h) };
}
