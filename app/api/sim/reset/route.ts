import personas from "@/data/personas.json";
import { db } from "@/lib/db";

// POST /api/sim/reset -> wipe proposals (this also clears cooldowns, they live in the
// proposals table) and put the 10 seed personas back to their starting state.
export async function POST() {
  // Supabase refuses a delete with no filter, so we use one that matches every row.
  // The filter value must fit the column type: proposals.id is a uuid, the rest are text.
  const wipe = async (table: string, column: string, never: string) =>
    db.from(table).delete().neq(column, never);

  // 1. Clear tables that depend on users first, then (re)insert users.
  for (const [table, column, never] of [
    ["proposals", "id", "00000000-0000-0000-0000-000000000000"],
    ["follows", "follower_id", ""],
    ["filters", "user_id", ""],
    ["presence", "user_id", ""],
  ] as const) {
    const { error } = await wipe(table, column, never);
    if (error) return Response.json({ ok: false, step: `wipe ${table}`, error: error.message }, { status: 500 });
  }

  // 2. Upsert = insert, or overwrite if the id already exists. Keeps users' ids stable.
  const steps = [
    ["users", db.from("users").upsert(personas.users)],
    ["follows", db.from("follows").insert(personas.follows)],
    ["filters", db.from("filters").insert(personas.filters)],
    ["presence", db.from("presence").insert(personas.presence)],
  ] as const;

  for (const [name, request] of steps) {
    const { error } = await request;
    if (error) return Response.json({ ok: false, step: `seed ${name}`, error: error.message }, { status: 500 });
  }

  return Response.json({
    ok: true,
    users: personas.users.length,
    follows: personas.follows.length,
  });
}
