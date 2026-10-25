import { connection } from "next/server";
import { db } from "@/lib/db";

// GET /api/sim/presence -> positions for the /sim control panel (demo only, see SPEC §6).
export async function GET() {
  await connection(); // always read live positions, never a build-time snapshot

  const { data, error } = await db.from("presence").select("user_id,lat,lng,active,available_until");
  if (error) return Response.json({ ok: false, error: error.message }, { status: 500 });

  const now = Date.now();
  return Response.json(
    (data ?? []).map((p) => ({
      user_id: p.user_id,
      lat: p.lat,
      lng: p.lng,
      // "on" only while the window hasn't run out
      active: !!p.active && !!p.available_until && new Date(p.available_until).getTime() > now,
    })),
  );
}
