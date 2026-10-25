import { connection } from "next/server";
import { modelUsage } from "@/lib/ai";
import { db } from "@/lib/db";

// GET /api/sim/status -> demo diagnostics: can the server reach the database, how many paid
// AI calls have been used, and whether the demo clock override (PLAN_NOW) is on. No secrets.
export async function GET() {
  await connection(); // always run at request time (never pre-rendered at build)

  const { error } = await db.from("users").select("id").limit(1);
  return Response.json({
    ok: !error,
    database: error ? `error: ${error.message}` : "connected",
    model_calls: await modelUsage(), // used so far / hard cap
    plan_now: process.env.PLAN_NOW ?? null, // set = the venue agent pretends it is this time
  });
}
