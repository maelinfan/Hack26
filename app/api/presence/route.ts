import { z } from "zod";
import { db } from "@/lib/db";
import { badRequest, parseBody, UNKNOWN_USER, unknownUser } from "@/lib/api";

const PresenceBody = z.object({
  user_id: z.string().min(1),
  lat: z.number().min(-90).max(90),
  lng: z.number().min(-180).max(180),
  minutes: z.number().int().min(1).max(1440).optional(), // up to 24h
});

// POST /api/presence -> set where the user is, and (with `minutes`) turn "Meet nearby" on.
// The sim also calls this when a pin is dragged, without `minutes`.
export async function POST(req: Request) {
  const { data, error } = await parseBody(req, PresenceBody);
  if (error) return error;

  const now = Date.now();
  let availableUntil: string | null = null;

  if (data.minutes) {
    // Toggle turned on (or window changed): open from now for N minutes.
    availableUntil = new Date(now + data.minutes * 60_000).toISOString();
  } else {
    // Pin drag: keep the existing window if it hasn't run out yet.
    const { data: existing, error: readError } = await db
      .from("presence")
      .select("available_until")
      .eq("user_id", data.user_id)
      .maybeSingle();
    if (readError) return Response.json({ ok: false, error: readError.message }, { status: 500 });
    if (existing?.available_until && new Date(existing.available_until).getTime() > now) {
      availableUntil = new Date(existing.available_until).toISOString(); // same "...Z" format as above
    }
  }

  // No open window means the user is not "on", so a drag can't switch someone on by accident.
  const active = availableUntil !== null;

  const { error: dbError } = await db.from("presence").upsert({
    user_id: data.user_id,
    lat: data.lat,
    lng: data.lng,
    available_until: availableUntil,
    active,
  });
  if (dbError) {
    if (dbError.code === UNKNOWN_USER) return unknownUser();
    return Response.json({ ok: false, error: dbError.message }, { status: 500 });
  }

  // TODO (Phase 5): if (active) await runMatchForUser(data.user_id)
  return Response.json({ active, available_until: availableUntil });
}

// DELETE /api/presence?user_id=maya -> turn "Meet nearby" off.
export async function DELETE(req: Request) {
  const userId = new URL(req.url).searchParams.get("user_id");
  if (!userId) return badRequest("user_id query parameter is required");

  const { data, error } = await db
    .from("presence")
    .update({ active: false, available_until: null })
    .eq("user_id", userId)
    .select("user_id");
  if (error) return Response.json({ ok: false, error: error.message }, { status: 500 });
  if (!data || data.length === 0) return unknownUser();

  // TODO (Phase 6): also end any pending proposal this user is in.
  return Response.json({ ok: true, active: false });
}
