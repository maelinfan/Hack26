const ISO = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d+)?Z$/;

/** Mock timestamps are fixed; shift every ISO timestamp so `anchorIso` (the mock's server_now) becomes now. */
export function rebaseTimes<T>(value: T, anchorIso: string): T {
  const shift = Date.now() - Date.parse(anchorIso);
  const walk = (v: unknown, key?: string): unknown => {
    if (typeof v === "string" && ISO.test(v)) {
      const t = new Date(Date.parse(v) + shift);
      // Venues close on the hour (venues.json hours), so snap closing times up to the next full hour.
      if (key === "open_until" || key === "closes_at") t.setMinutes(60, 0, 0);
      return t.toISOString();
    }
    if (Array.isArray(v)) return v.map((x) => walk(x));
    if (v && typeof v === "object") return Object.fromEntries(Object.entries(v).map(([k, x]) => [k, walk(x, k)]));
    return v;
  };
  return walk(value) as T;
}
