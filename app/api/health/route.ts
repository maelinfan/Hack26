import { db } from "@/lib/db";
import { modelUsage } from "@/lib/ai";

// Temporary check that the server can reach Supabase. Safe to delete later.
export async function GET() {
  const { error } = await db.from("users").select("id").limit(1);

  // PGRST205 = "table not found": we reached the database, the tables just don't exist yet.
  if (error && error.code !== "PGRST205") {
    return Response.json({ ok: false, error: error.message }, { status: 500 });
  }
  return Response.json({
    ok: true,
    connected: true,
    users_table_exists: !error,
    model_calls: await modelUsage(), // paid AI calls used so far / hard cap
  });
}
