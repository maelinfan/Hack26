import { connection } from "next/server";
import personas from "@/data/personas.json";
import { db } from "@/lib/db";
import type { UserSummary } from "@/lib/types";

// GET /api/users -> the list the login/sim screens use to show "Continue as ...".
export async function GET() {
  await connection(); // read the live database on every request, never a build-time snapshot

  // 1. Ask the database for the public columns only (never bio, tags or coordinates).
  const { data, error } = await db
    .from("users")
    .select("id, name, handle, age, gender, avatar_url, verified");

  if (error) return Response.json({ error: error.message }, { status: 500 });

  // 2. The database doesn't promise an order, so sort like the seed file (Maya first).
  const order = personas.users.map((u) => u.id);
  const rank = (id: string) => (order.includes(id) ? order.indexOf(id) : order.length);
  const users = (data as UserSummary[]).sort((a, b) => rank(a.id) - rank(b.id));

  // 3. Send it back as JSON with status 200.
  return Response.json(users);
}
