import * as XLSX from "xlsx";
import { getCurrentProfile, isVetter } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { SEASON } from "@/app/register/shared";

export const dynamic = "force-dynamic";

/* eslint-disable @typescript-eslint/no-explicit-any */

// Season 2 registrations as a workbook for vendors and the league.
//   ?sheet=jersey      kit maker: father's name (printed on the jersey), number, sizes, team
//   ?sheet=catering    caterer: meal preference and allergies, team
//   ?sheet=cricheroes  CricHeroes data entry: name, CricHeroes link, role, vetting
//   ?sheet=all         everything the league holds (admin only), one tab each + full list
// &status=approved (default for jersey/catering) | all
// Each vendor sheet carries only what that vendor needs: no phones, emails or Aadhaar.
const SHEETS = ["jersey", "catering", "cricheroes", "all"] as const;
type Sheet = (typeof SHEETS)[number];

export async function GET(req: Request) {
  const url = new URL(req.url);
  const sheet = (SHEETS as readonly string[]).includes(url.searchParams.get("sheet") ?? "")
    ? (url.searchParams.get("sheet") as Sheet)
    : "all";
  const me = await getCurrentProfile();
  const admin = me?.role === "admin";
  // A third-party vetter may pull the CricHeroes sheet only.
  if (!admin && !(sheet === "cricheroes" && (await isVetter())))
    return new Response("Not allowed.", { status: 403 });

  const status = url.searchParams.get("status") ?? (sheet === "jersey" || sheet === "catering" ? "approved" : "all");
  const sb = createAdminClient() as unknown as { from: (t: string) => any };
  let q = sb.from("registrations").select("*").eq("season", SEASON).order("full_name");
  if (status !== "all") q = q.eq("status", status);
  const { data: rows, error } = await q;
  if (error) return new Response(error.message, { status: 500 });

  // Team, once a registration is in the pool and sold.
  const ids = (rows ?? []).map((r: any) => `reg:${r.id}`);
  const team = new Map<string, string>();
  if (ids.length) {
    const { data: pool } = await sb.from("scout_players").select("source_id, team_id").in("source_id", ids);
    const teamIds = [...new Set((pool ?? []).map((p: any) => p.team_id).filter(Boolean))];
    const { data: teams } = teamIds.length ? await sb.from("teams").select("id, name").in("id", teamIds) : { data: [] };
    const tn = new Map((teams ?? []).map((t: any) => [t.id, t.name]));
    for (const p of pool ?? []) if (p.team_id) team.set(p.source_id.slice(4), String(tn.get(p.team_id) ?? ""));
  }
  const T = (r: any) => team.get(r.id) ?? "";
  const role = (r: any) => [r.batting_hand, r.bowling_type, r.allrounder, r.is_keeper ? "Wicket keeper" : null].filter(Boolean).join(" · ");

  const tabs: Record<Exclude<Sheet, "all">, () => (string | number | null)[][]> = {
    jersey: () => [
      ["Player", "Name on jersey (father's name)", "Jersey number", "T-shirt size", "Lower size", "Team", "Status"],
      ...(rows ?? []).map((r: any) => [r.full_name, r.jersey_name, r.jersey_number, r.tshirt_size, r.lower_size, T(r), r.status]),
    ],
    catering: () => [
      ["Player", "Meal preference", "Food allergies", "Team", "Status"],
      ...(rows ?? []).map((r: any) => [r.full_name, r.meal_pref, r.food_allergies, T(r), r.status]),
    ],
    cricheroes: () => [
      ["Player", "CricHeroes link", "Playing role", "Returning player", "Declared board/state/district cricket", "Level", "Last year", "Vetting", "Vetting notes"],
      ...(rows ?? []).map((r: any) => [
        r.full_name, r.cricheroes_link, role(r), r.is_returning ? "Yes" : "No",
        r.pro_declared == null ? "" : r.pro_declared ? "Yes" : "No", r.pro_level, r.pro_last_year, r.vet_status, r.vet_notes,
      ]),
    ],
  };

  const wb = XLSX.utils.book_new();
  const add = (name: string, aoa: (string | number | null)[][]) => {
    const ws = XLSX.utils.aoa_to_sheet(aoa);
    ws["!cols"] = aoa[0].map((h) => ({ wch: Math.max(12, Math.min(40, String(h).length + 4)) }));
    XLSX.utils.book_append_sheet(wb, ws, name);
  };
  if (sheet === "all") {
    add("All registrations", [
      ["Registered on", "Player", "Phone", "Email", "Age", "Company", "Designation", "LinkedIn", "LinkedIn 500+", "CricHeroes", "Instagram",
       "Playing role", "Declared board/state/district cricket", "Level", "Last year", "Fee ₹", "UTR", "Fee status", "Vetting", "Vetting notes",
       "Status", "Team", "Father's name (jersey)", "Jersey #", "T-shirt", "Lower", "Meal", "Allergies", "T&C version"],
      ...(rows ?? []).map((r: any) => [
        r.created_at?.slice(0, 10), r.full_name, r.phone, r.email,
        r.dob ? Math.floor((Date.now() - new Date(r.dob).getTime()) / (365.25 * 864e5)) : null,
        r.employer, r.designation, r.linkedin_link, r.linkedin_verified == null ? "" : r.linkedin_verified ? "Yes" : "No",
        r.cricheroes_link, r.instagram_link, role(r), r.pro_declared == null ? "" : r.pro_declared ? "Yes" : "No", r.pro_level, r.pro_last_year,
        r.fee_amount, r.fee_utr, r.fee_status, r.vet_status, r.vet_notes, r.status, T(r),
        r.jersey_name, r.jersey_number, r.tshirt_size, r.lower_size, r.meal_pref, r.food_allergies, r.terms_version,
      ]),
    ]);
    add("Jersey", tabs.jersey());
    add("Catering", tabs.catering());
    add("CricHeroes", tabs.cricheroes());
  } else {
    add(sheet === "jersey" ? "Jersey" : sheet === "catering" ? "Catering" : "CricHeroes", tabs[sheet]());
  }

  const buf = XLSX.write(wb, { bookType: "xlsx", type: "buffer" }) as Buffer;
  const day = new Date().toISOString().slice(0, 10);
  const filename = `SDLL-S2-${sheet === "all" ? "registrations" : sheet}${status !== "all" && sheet !== "all" ? `-${status}` : ""}-${day}.xlsx`;
  return new Response(new Uint8Array(buf), {
    headers: {
      "content-type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "content-disposition": `attachment; filename="${filename}"`,
      "cache-control": "no-store",
    },
  });
}
