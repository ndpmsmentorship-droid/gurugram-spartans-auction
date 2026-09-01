import { loadSchedule } from "@/lib/schedule/data";
import ScheduleManager from "./ScheduleManager";

export const dynamic = "force-dynamic";

export default async function AdminSchedulePage() {
  const { seasonName, teams, fixtures, config } = await loadSchedule();

  const groups = [...new Set(teams.map((t) => t.group))].sort();

  return (
    <div>
      <p className="eyebrow">Admin</p>
      <h1 className="mt-2 font-display text-[1.75rem]">Match Schedule</h1>
      <p className="mt-2 text-[0.875rem] text-muted">
        {seasonName} &middot; {teams.length} teams across{" "}
        {groups.length} groups ({groups.join(", ") || "none set"}).{" "}
        <a href="/schedule" className="underline underline-offset-2 hover:text-red">
          View the public schedule
        </a>
        .
      </p>

      <ScheduleManager config={config} fixtures={fixtures} teams={teams} />
    </div>
  );
}
