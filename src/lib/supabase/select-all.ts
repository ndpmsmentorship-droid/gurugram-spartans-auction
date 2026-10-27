// PostgREST returns at most 1,000 rows per request, and the SDLL pool is past
// that (1,050 on 27 Oct 2026). A plain select("*") silently drops the rest, so
// ranks came out of a different partial pool on every load. Pages that need the
// whole table go through here: fixed order, one request per 1,000 rows.
/* eslint-disable @typescript-eslint/no-explicit-any */
export async function selectAll<T = any>(
  sb: { from: (t: any) => any },
  table: string,
  columns = "*"
): Promise<{ data: T[] | null; error: { message: string } | null }> {
  const out: T[] = [];
  for (let from = 0; ; from += 1000) {
    const { data, error } = await sb.from(table).select(columns).order("id").range(from, from + 999);
    if (error) return { data: null, error };
    out.push(...((data ?? []) as T[]));
    if (!data || data.length < 1000) return { data: out, error: null };
  }
}
