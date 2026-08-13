/**
 * LOCAL DESIGN FIXTURE CLIENT — only ever constructed when SPARTANS_DEV_FIXTURE=1.
 *
 * A minimal stand-in for the Supabase query builder covering exactly the calls
 * the read paths make: .select().eq().not().order().limit().single()/.maybeSingle(),
 * plus auth.getUser(). Writes are accepted and discarded (design preview only).
 *
 * Deliberately NOT a general Supabase shim — if a page starts using a method
 * that isn't here it will throw loudly rather than silently return nothing.
 */

import {
  fixturePlayers,
  FIXTURE_TEAMS,
  FIXTURE_SEASON,
  FIXTURE_PROFILE,
} from "./fixture";

export const DEV_FIXTURE = process.env.SPARTANS_DEV_FIXTURE === "1";

type Row = Record<string, unknown>;

function tableRows(table: string): Row[] {
  switch (table) {
    case "scout_players":
      return fixturePlayers() as unknown as Row[];
    case "teams":
      return FIXTURE_TEAMS as unknown as Row[];
    case "seasons":
      return [FIXTURE_SEASON] as unknown as Row[];
    case "profiles":
      return [FIXTURE_PROFILE] as unknown as Row[];
    default:
      return [];
  }
}

class Query implements PromiseLike<{ data: unknown; error: null; count?: number }> {
  private rows: Row[];
  private head = false;
  private wantCount = false;

  constructor(table: string) {
    this.rows = tableRows(table).slice();
  }

  select(_cols?: string, opts?: { count?: string; head?: boolean }) {
    if (opts?.head) this.head = true;
    if (opts?.count) this.wantCount = true;
    return this;
  }
  eq(col: string, val: unknown) {
    this.rows = this.rows.filter((r) => r[col] === val);
    return this;
  }
  neq(col: string, val: unknown) {
    this.rows = this.rows.filter((r) => r[col] !== val);
    return this;
  }
  in(col: string, vals: unknown[]) {
    this.rows = this.rows.filter((r) => vals.includes(r[col]));
    return this;
  }
  // Supabase spells IS NULL as .not(col, "is", null) / .is(col, null)
  not(col: string, _op: string, val: unknown) {
    this.rows =
      val === null
        ? this.rows.filter((r) => r[col] != null)
        : this.rows.filter((r) => r[col] !== val);
    return this;
  }
  is(col: string, val: unknown) {
    this.rows = val === null ? this.rows.filter((r) => r[col] == null) : this.rows;
    return this;
  }
  order(col: string, opts?: { ascending?: boolean }) {
    const asc = opts?.ascending !== false;
    this.rows.sort((a, b) => {
      const av = a[col] as number | string;
      const bv = b[col] as number | string;
      if (av === bv) return 0;
      return (av > bv ? 1 : -1) * (asc ? 1 : -1);
    });
    return this;
  }
  limit(n: number) {
    this.rows = this.rows.slice(0, n);
    return this;
  }
  single() {
    return Promise.resolve({ data: this.rows[0] ?? null, error: null });
  }
  maybeSingle() {
    return Promise.resolve({ data: this.rows[0] ?? null, error: null });
  }
  // writes are no-ops in preview
  update() {
    return this;
  }
  insert() {
    return this;
  }
  upsert() {
    return this;
  }
  delete() {
    return this;
  }

  then<R1 = { data: unknown; error: null }, R2 = never>(
    onfulfilled?: ((v: { data: unknown; error: null; count?: number }) => R1 | PromiseLike<R1>) | null,
    onrejected?: ((reason: unknown) => R2 | PromiseLike<R2>) | null
  ): PromiseLike<R1 | R2> {
    const payload = {
      data: this.head ? null : this.rows,
      error: null as null,
      ...(this.wantCount ? { count: this.rows.length } : {}),
    };
    return Promise.resolve(payload).then(onfulfilled, onrejected);
  }
}

export function createFixtureClient() {
  return {
    from: (table: string) => new Query(table),
    auth: {
      getUser: async () => ({ data: { user: { id: FIXTURE_PROFILE.id } }, error: null }),
      getSession: async () => ({ data: { session: null }, error: null }),
      signOut: async () => ({ error: null }),
      signInWithPassword: async () => ({ data: null, error: null }),
    },
    channel: () => ({
      on() {
        return this;
      },
      subscribe() {
        return this;
      },
    }),
    removeChannel: () => {},
  };
}
