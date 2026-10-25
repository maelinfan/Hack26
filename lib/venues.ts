import type { Day, Venue } from "@/lib/types";

// Pure venue helpers for the meetup planner: distances, opening hours (Austin time).
// No imports besides types, so they are easy to test on their own.

const TZ = "America/Chicago";

export function metersBetween(a: { lat: number; lng: number }, b: { lat: number; lng: number }) {
  const R = 6371000;
  const rad = (d: number) => (d * Math.PI) / 180;
  const h =
    Math.sin(rad(b.lat - a.lat) / 2) ** 2 +
    Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(rad(b.lng - a.lng) / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

// The wall clock in Austin for a given instant: weekday, date, minutes since midnight.
function localClock(date: Date) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: TZ,
    weekday: "short",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(date);
  const get = (t: string) => parts.find((p) => p.type === t)!.value;
  return {
    day: get("weekday").slice(0, 3).toLowerCase() as Day,
    y: +get("year"),
    m: +get("month"),
    d: +get("day"),
    minutes: +get("hour") * 60 + +get("minute"),
  };
}

export function localLabel(date: Date) {
  return new Intl.DateTimeFormat("en-US", {
    timeZone: TZ,
    weekday: "long",
    hour: "numeric",
    minute: "2-digit",
  }).format(date);
}

// Austin local date + minutes-after-midnight -> the real instant (UTC).
function localToUtc(y: number, m: number, d: number, minutes: number, at: Date) {
  const c = localClock(at);
  const offset = Date.UTC(c.y, c.m - 1, c.d, 0, c.minutes) - Math.floor(at.getTime() / 60000) * 60000;
  return Date.UTC(y, m - 1, d, 0, minutes) - offset; // offset = local minus UTC at that moment
}

const toMinutes = (hhmm: string) => {
  const [h, m] = hhmm.split(":").map(Number);
  return h * 60 + m; // "24:00" -> 1440 = midnight
};

const DAYS: Day[] = ["sun", "mon", "tue", "wed", "thu", "fri", "sat"];

// The hours that apply on a weekday: an override (null = closed) or the default.
function hoursOn(venue: Venue, day: Day): { open: string; close: string } | null {
  const o = venue.hours.overrides?.[day];
  if (o === null) return null;
  return o ?? { open: venue.hours.open, close: venue.hours.close };
}

// Is the venue open at `at`, and until when? Back-to-back days (e.g. a 24-hour place) are chained.
export function openStatus(venue: Venue, at: Date): { open: boolean; closes_at: string | null } {
  const c = localClock(at);
  const today = hoursOn(venue, c.day);
  if (!today || c.minutes < toMinutes(today.open) || c.minutes >= toMinutes(today.close)) {
    return { open: false, closes_at: null };
  }
  let closeMinutes = toMinutes(today.close);
  let dayIndex = DAYS.indexOf(c.day);
  let dayOffset = 0;
  // Closes at midnight and the next day opens at midnight: keep going.
  for (let i = 0; i < 6 && closeMinutes === 1440; i++) {
    dayIndex = (dayIndex + 1) % 7;
    const next = hoursOn(venue, DAYS[dayIndex]);
    if (!next || toMinutes(next.open) !== 0) break;
    dayOffset += 1;
    closeMinutes = toMinutes(next.close);
  }
  const closesAt = localToUtc(c.y, c.m, c.d + dayOffset, closeMinutes, at);
  return { open: true, closes_at: new Date(closesAt).toISOString() };
}

// Minutes the venue stays open from `at` (0 if closed).
export function minutesOpen(venue: Venue, at: Date) {
  const s = openStatus(venue, at);
  return s.open && s.closes_at ? Math.floor((new Date(s.closes_at).getTime() - at.getTime()) / 60000) : 0;
}

// Venues within radius_m of a point, nearest first (the shape the agent sees: SPEC §6 tool_calls).
export function nearbyVenues(
  venues: Venue[],
  q: { lat: number; lng: number; radius_m: number; category?: string },
) {
  return venues
    .filter((v) => !q.category || v.category === q.category)
    .map((v) => ({ id: v.id, name: v.name, category: v.category, distance_m: Math.round(metersBetween(q, v)) }))
    .filter((v) => v.distance_m <= q.radius_m)
    .sort((a, b) => a.distance_m - b.distance_m);
}
