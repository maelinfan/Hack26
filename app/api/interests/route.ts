import { z } from "zod";
import { db } from "@/lib/db";
import { extractTags } from "@/lib/ai";
import { parseBody, unknownUser } from "@/lib/api";

const InterestsBody = z.object({
  user_id: z.string().min(1),
  text: z.string().trim().min(1).max(500),
});

// PUT /api/interests -> turn free text into tags, save them on the user, return them.
export async function PUT(req: Request) {
  // 1. Validate the body.
  const { data, error } = await parseBody(req, InterestsBody);
  if (error) return error;

  // 2. Make sure the user exists before spending an AI call on them.
  const { data: user } = await db.from("users").select("id").eq("id", data.user_id).maybeSingle();
  if (!user) return unknownUser();

  // 3. Ask the AI layer (cache -> model -> fallback) for the tags.
  const { tags, adjacent_tags, source } = await extractTags(data.text);

  // 4. Save on the user so matching can use them later.
  const { error: dbError } = await db
    .from("users")
    .update({ interests_raw: data.text, tags, adjacent_tags })
    .eq("id", data.user_id);
  if (dbError) return Response.json({ ok: false, error: dbError.message }, { status: 500 });

  // 5. Respond with exactly the shape in SPEC §6. (The x-ai-source header is just for debugging.)
  return Response.json({ tags, adjacent_tags }, { headers: { "x-ai-source": source } });
}
