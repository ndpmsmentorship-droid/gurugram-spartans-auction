/**
 * SDLL Season 2 fixture generator.
 *
 * 12 teams in two groups of six. Single round robin inside each group, so five
 * rounds per group of three matches each. One round of BOTH groups is played
 * every weekend, which is what makes the calendar work out so cleanly:
 *
 *   6 matches per weekend = 3 on Saturday + 3 on Sunday
 *   every team plays exactly once per weekend (structural, not a constraint we
 *   have to search for), so "no team plays twice in a weekend" is free
 *   5 weekends -> 30 group matches, then a finals weekend
 *
 * What actually needs solving is the *distribution*: which of the six weekend
 * matches lands in which (day, time-slot) box, so that over the season no team
 * is stuck with the 8 AM start every single week. That's the hill-climb below.
 *
 * Pure and dependency-free — no Supabase, no React — so it can run in a server
 * action, a route handler or a script, and be reasoned about on its own.
 */

export type TeamRef = { id: string; name: string; group: string };

export type ScheduleConfig = {
  /** ISO date of the first Saturday, e.g. "2027-02-20". */
  startDate: string;
  /** Day names in play order, e.g. ["Saturday", "Sunday"]. */
  matchDays: string[];
  /** 24h start times in play order, e.g. ["08:00", "12:00", "16:00"]. */
  slots: string[];
  /** Whole weekends containing any of these ISO dates are skipped. */
  blackoutDates: string[];
  venue: string;
  /** Any integer — same seed and config always produce the same schedule. */
  seed: number;
};

export type Stage = "group" | "semi" | "third" | "final";

export type GeneratedFixture = {
  matchNo: number;
  stage: Stage;
  /** Weekend number, 1-based. Knockouts carry the finals weekend number too. */
  round: number;
  date: string;
  dayName: string;
  slot: string;
  groupName: string | null;
  homeTeamId: string | null;
  awayTeamId: string | null;
  /** Placeholder text for knockout slots whose teams aren't known yet. */
  homeLabel: string | null;
  awayLabel: string | null;
  venue: string;
};

export type TeamSpread = {
  teamId: string;
  name: string;
  group: string;
  matches: number;
  /** How many of the configured slots this team plays in at least once. */
  distinctSlots: number;
  perSlot: Record<string, number>;
  perDay: Record<string, number>;
};

export type GenerateResult = {
  fixtures: GeneratedFixture[];
  spread: TeamSpread[];
  /** Human-readable notes about anything that couldn't be made perfect. */
  warnings: string[];
};

export const DAY_INDEX: Record<string, number> = {
  Sunday: 0,
  Monday: 1,
  Tuesday: 2,
  Wednesday: 3,
  Thursday: 4,
  Friday: 5,
  Saturday: 6,
};

export const DEFAULT_CONFIG: ScheduleConfig = {
  // Third weekend of February 2027.
  startDate: "2027-02-20",
  matchDays: ["Saturday", "Sunday"],
  slots: ["08:00", "12:00", "16:00"],
  blackoutDates: [],
  venue: "Sportscube, Gurugram",
  seed: 7,
};

/* ------------------------------------------------------------------ dates */

function parseISO(iso: string): Date {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d));
}

function toISO(date: Date): string {
  return date.toISOString().slice(0, 10);
}

function addDays(date: Date, n: number): Date {
  const out = new Date(date);
  out.setUTCDate(out.getUTCDate() + n);
  return out;
}

export function formatDate(iso: string): string {
  const d = parseISO(iso);
  const months = [
    "Jan", "Feb", "Mar", "Apr", "May", "Jun",
    "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
  ];
  return `${String(d.getUTCDate()).padStart(2, "0")}-${months[d.getUTCMonth()]}-${d.getUTCFullYear()}`;
}

export function formatSlot(slot: string): string {
  const [h, m] = slot.split(":").map(Number);
  const ampm = h >= 12 ? "PM" : "AM";
  const hour = h % 12 === 0 ? 12 : h % 12;
  return `${hour}:${String(m).padStart(2, "0")} ${ampm}`;
}

/**
 * The dates of weekend `n` (0-based), skipping any weekend that collides with a
 * blackout date. The anchor is the configured start date; each match day is
 * placed at its own offset from that anchor's weekday.
 */
function weekendDates(
  cfg: ScheduleConfig,
  weekendIndex: number,
  blackout: Set<string>
): { dayName: string; date: string }[] {
  const anchor = parseISO(cfg.startDate);
  const anchorDow = anchor.getUTCDay();

  let skipped = 0;
  for (let attempt = 0; attempt < 60; attempt++) {
    const base = addDays(anchor, (weekendIndex + skipped) * 7);
    const days = cfg.matchDays.map((dayName) => {
      // Offset forward from the anchor weekday, wrapping within the week, so a
      // Saturday anchor puts Sunday on the next day rather than six days back.
      const offset = (DAY_INDEX[dayName] - anchorDow + 7) % 7;
      return { dayName, date: toISO(addDays(base, offset)) };
    });
    if (days.some((d) => blackout.has(d.date))) {
      skipped++;
      continue;
    }
    return days;
  }
  // Too many consecutive blackouts — fall back to the unshifted weekend rather
  // than looping forever.
  const base = addDays(anchor, weekendIndex * 7);
  return cfg.matchDays.map((dayName) => ({
    dayName,
    date: toISO(addDays(base, (DAY_INDEX[dayName] - anchorDow + 7) % 7)),
  }));
}

/* -------------------------------------------------------------------- rng */

/** mulberry32 — small, seedable, good enough for shuffling fixtures. */
function rng(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/* ----------------------------------------------------------- round robin */

/**
 * There is no home/away in this league — every match is at the one venue.
 * `home`/`away` here mean nothing more than "listed first" and "listed
 * second", matching the `home_team_id`/`away_team_id` columns the fixtures
 * table persists them to.
 */
type Pair = { home: TeamRef; away: TeamRef };

/**
 * Circle method. Team 0 stays put, the rest rotate, which yields n-1 rounds
 * where every team appears exactly once per round.
 */
function roundRobin(teams: TeamRef[]): Pair[][] {
  const list = [...teams];
  const bye = list.length % 2 === 1;
  if (bye) list.push({ id: "__bye__", name: "BYE", group: "" });

  const n = list.length;
  const rounds: Pair[][] = [];

  for (let r = 0; r < n - 1; r++) {
    const pairs: Pair[] = [];
    for (let i = 0; i < n / 2; i++) {
      const a = list[i];
      const b = list[n - 1 - i];
      if (a.id === "__bye__" || b.id === "__bye__") continue;
      // Alternate which side is named first, purely so the same team isn't
      // always the left-hand name on every fixture card.
      pairs.push(r % 2 === 0 ? { home: a, away: b } : { home: b, away: a });
    }
    rounds.push(pairs);
    // rotate everything except the first entry
    list.splice(1, 0, list.pop()!);
  }
  return rounds;
}

/* -------------------------------------------------------- slot optimiser */

type Placement = { day: number; slot: number };

/** The (day, slot) boxes available in one weekend, in play order. */
function weekendPlacements(cfg: ScheduleConfig): Placement[] {
  const out: Placement[] = [];
  for (let d = 0; d < cfg.matchDays.length; d++) {
    for (let s = 0; s < cfg.slots.length; s++) out.push({ day: d, slot: s });
  }
  return out;
}

type Assignment = number[][]; // [weekend][boxIndex] -> match index within weekend

/**
 * Cost of a full assignment. Lower is better; 0 is a perfect spread.
 *
 * The weights encode the priority order we actually care about:
 *   1. never leave a team locked out of a time slot          (weight 40)
 *   2. keep each team's slot counts within one of each other (weight 6)
 *   3. keep each team's Saturday/Sunday split even           (weight 4)
 *   4. don't hand a team the same slot two weekends running  (weight 2)
 */
function cost(
  assignment: Assignment,
  weekendMatches: Pair[][],
  cfg: ScheduleConfig,
  teams: TeamRef[]
): number {
  const slotCount = new Map<string, number[]>();
  const dayCount = new Map<string, number[]>();
  const lastSlot = new Map<string, number>();
  const repeats = new Map<string, number>();

  for (const t of teams) {
    slotCount.set(t.id, new Array(cfg.slots.length).fill(0));
    dayCount.set(t.id, new Array(cfg.matchDays.length).fill(0));
    repeats.set(t.id, 0);
  }

  const boxes = weekendPlacements(cfg);

  for (let w = 0; w < assignment.length; w++) {
    const seen = new Map<string, number>();
    for (let b = 0; b < assignment[w].length; b++) {
      const matchIdx = assignment[w][b];
      if (matchIdx < 0) continue;
      const pair = weekendMatches[w][matchIdx];
      const box = boxes[b];
      for (const t of [pair.home, pair.away]) {
        slotCount.get(t.id)![box.slot]++;
        dayCount.get(t.id)![box.day]++;
        seen.set(t.id, box.slot);
      }
    }
    for (const [id, slot] of seen) {
      if (lastSlot.get(id) === slot) repeats.set(id, repeats.get(id)! + 1);
      lastSlot.set(id, slot);
    }
  }

  let total = 0;
  for (const t of teams) {
    const slots = slotCount.get(t.id)!;
    const days = dayCount.get(t.id)!;
    const played = slots.reduce((a, b) => a + b, 0);

    // 1. a slot this team never plays
    const unused = slots.filter((c) => c === 0).length;
    // Only punish unused slots the team could realistically have reached.
    if (played >= cfg.slots.length) total += unused * 40;

    // 2. slot imbalance
    total += (Math.max(...slots) - Math.min(...slots) > 1 ? 1 : 0) * 6;

    // 3. day imbalance
    total += Math.max(0, Math.max(...days) - Math.min(...days) - 1) * 4;

    // 4. same slot on consecutive weekends
    total += repeats.get(t.id)! * 2;
  }
  return total;
}

/**
 * Hill-climb with restarts over "which match goes in which box". The search
 * space is small (720 permutations per weekend) but the weekends are coupled
 * through the per-team season totals, so we perturb globally rather than
 * solving each weekend on its own.
 */
function optimise(
  weekendMatches: Pair[][],
  cfg: ScheduleConfig,
  teams: TeamRef[],
  rand: () => number
): Assignment {
  const boxes = weekendPlacements(cfg);

  const seed = (): Assignment =>
    weekendMatches.map((matches) => {
      const order = matches.map((_, i) => i);
      for (let i = order.length - 1; i > 0; i--) {
        const j = Math.floor(rand() * (i + 1));
        [order[i], order[j]] = [order[j], order[i]];
      }
      // Pad with -1 when there are more boxes than matches this weekend.
      while (order.length < boxes.length) order.push(-1);
      return order.slice(0, boxes.length);
    });

  let best: Assignment | null = null;
  let bestCost = Infinity;

  for (let restart = 0; restart < 24; restart++) {
    const current = seed();
    let currentCost = cost(current, weekendMatches, cfg, teams);

    for (let step = 0; step < 4000 && currentCost > 0; step++) {
      const w = Math.floor(rand() * current.length);
      const i = Math.floor(rand() * current[w].length);
      let j = Math.floor(rand() * current[w].length);
      if (i === j) j = (j + 1) % current[w].length;

      [current[w][i], current[w][j]] = [current[w][j], current[w][i]];
      const next = cost(current, weekendMatches, cfg, teams);
      if (next <= currentCost) {
        currentCost = next;
      } else {
        // revert
        [current[w][i], current[w][j]] = [current[w][j], current[w][i]];
      }
    }

    if (currentCost < bestCost) {
      bestCost = currentCost;
      best = current.map((r) => [...r]);
    }
    if (bestCost === 0) break;
  }

  return best!;
}

/* --------------------------------------------------------------- generate */

export function generateSchedule(
  teams: TeamRef[],
  config: Partial<ScheduleConfig> = {}
): GenerateResult {
  const cfg: ScheduleConfig = { ...DEFAULT_CONFIG, ...config };
  const warnings: string[] = [];
  const rand = rng(cfg.seed);
  const blackout = new Set(cfg.blackoutDates);

  const groups = [...new Set(teams.map((t) => t.group))].sort();
  if (groups.length === 0) {
    return { fixtures: [], spread: [], warnings: ["No teams to schedule."] };
  }

  // One round-robin per group.
  const perGroupRounds = groups.map((g) =>
    roundRobin(teams.filter((t) => t.group === g))
  );
  const roundCount = Math.max(...perGroupRounds.map((r) => r.length));

  // Weekend w plays round w of every group.
  const weekendMatches: Pair[][] = [];
  const weekendGroups: string[][] = [];
  for (let w = 0; w < roundCount; w++) {
    const matches: Pair[] = [];
    const owners: string[] = [];
    perGroupRounds.forEach((rounds, gi) => {
      (rounds[w] ?? []).forEach((p) => {
        matches.push(p);
        owners.push(groups[gi]);
      });
    });
    weekendMatches.push(matches);
    weekendGroups.push(owners);
  }

  const boxes = weekendPlacements(cfg);
  const perWeekendCapacity = boxes.length;
  const biggest = Math.max(...weekendMatches.map((m) => m.length));
  if (biggest > perWeekendCapacity) {
    warnings.push(
      `A weekend needs ${biggest} slots but the calendar only offers ` +
        `${perWeekendCapacity} (${cfg.matchDays.length} days x ${cfg.slots.length} slots). ` +
        `Add a slot or a match day, or matches will be dropped.`
    );
  }

  const assignment = optimise(weekendMatches, cfg, teams, rand);

  const fixtures: GeneratedFixture[] = [];
  let matchNo = 1;

  for (let w = 0; w < weekendMatches.length; w++) {
    const dates = weekendDates(cfg, w, blackout);
    // Walk the boxes in play order so match numbers run chronologically.
    for (let b = 0; b < boxes.length; b++) {
      const matchIdx = assignment[w][b];
      if (matchIdx < 0 || matchIdx >= weekendMatches[w].length) continue;
      const pair = weekendMatches[w][matchIdx];
      const box = boxes[b];
      const day = dates[box.day];
      fixtures.push({
        matchNo: matchNo++,
        stage: "group",
        round: w + 1,
        date: day.date,
        dayName: day.dayName,
        slot: cfg.slots[box.slot],
        groupName: weekendGroups[w][matchIdx],
        homeTeamId: pair.home.id,
        awayTeamId: pair.away.id,
        homeLabel: null,
        awayLabel: null,
        venue: cfg.venue,
      });
    }
  }

  // ---- finals weekend -------------------------------------------------
  // Top two from each group cross over. Teams aren't known yet, so these
  // carry labels and get filled in once the group tables are final.
  const finalsWeekend = weekendMatches.length;
  const finalsDates = weekendDates(cfg, finalsWeekend, blackout);
  const satDay = finalsDates[0];
  const sunDay = finalsDates[1] ?? finalsDates[0];
  const [gA, gB] = [groups[0] ?? "Group A", groups[1] ?? "Group B"];

  const knockouts: Array<{
    stage: Stage;
    day: { dayName: string; date: string };
    slot: string;
    home: string;
    away: string;
  }> = [
    { stage: "semi", day: satDay, slot: cfg.slots[0], home: `Winner ${gA}`, away: `Runner-up ${gB}` },
    { stage: "semi", day: satDay, slot: cfg.slots[1] ?? cfg.slots[0], home: `Winner ${gB}`, away: `Runner-up ${gA}` },
    { stage: "third", day: sunDay, slot: cfg.slots[0], home: "Loser Semi-Final 1", away: "Loser Semi-Final 2" },
    { stage: "final", day: sunDay, slot: cfg.slots[1] ?? cfg.slots[0], home: "Winner Semi-Final 1", away: "Winner Semi-Final 2" },
  ];

  for (const k of knockouts) {
    fixtures.push({
      matchNo: matchNo++,
      stage: k.stage,
      round: finalsWeekend + 1,
      date: k.day.date,
      dayName: k.day.dayName,
      slot: k.slot,
      groupName: null,
      homeTeamId: null,
      awayTeamId: null,
      homeLabel: k.home,
      awayLabel: k.away,
      venue: cfg.venue,
    });
  }

  return { fixtures, spread: spreadReport(fixtures, teams, cfg), warnings };
}

/* ------------------------------------------------------------ spread report */

export function spreadReport(
  fixtures: GeneratedFixture[],
  teams: TeamRef[],
  cfg: ScheduleConfig
): TeamSpread[] {
  const byId = new Map<string, TeamSpread>();
  for (const t of teams) {
    byId.set(t.id, {
      teamId: t.id,
      name: t.name,
      group: t.group,
      matches: 0,
      distinctSlots: 0,
      perSlot: Object.fromEntries(cfg.slots.map((s) => [s, 0])),
      perDay: Object.fromEntries(cfg.matchDays.map((d) => [d, 0])),
    });
  }

  for (const f of fixtures) {
    if (f.stage !== "group") continue;
    for (const id of [f.homeTeamId, f.awayTeamId]) {
      const team = id ? byId.get(id) : null;
      if (!team) continue;
      team.matches++;
      team.perSlot[f.slot] = (team.perSlot[f.slot] ?? 0) + 1;
      team.perDay[f.dayName] = (team.perDay[f.dayName] ?? 0) + 1;
    }
  }

  for (const t of byId.values()) {
    t.distinctSlots = Object.values(t.perSlot).filter((c) => c > 0).length;
  }

  return [...byId.values()].sort(
    (a, b) => a.group.localeCompare(b.group) || a.name.localeCompare(b.name)
  );
}
