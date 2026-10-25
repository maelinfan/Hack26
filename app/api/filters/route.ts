import { z } from "zod";
import { db } from "@/lib/db";
import { parseBody, UNKNOWN_USER, unknownUser } from "@/lib/api";

// The rules a request must follow. Anything else is rejected with a 400 and a clear message.
const FiltersBody = z
  .object({
    user_id: z.string().min(1),
    age_min: z.number().int().min(18), // 18+ only
    age_max: z.number().int().max(120),
    genders: z.array(z.enum(["woman", "man", "nonbinary"])).min(1),
    follow_statuses: z
      .array(z.enum(["close_friends", "mutual", "following", "follows_you", "anyone"]))
      .min(1),
    radius_mi: z.number().min(0.1).max(5),
  })
  .refine((f) => f.age_max >= f.age_min, { message: "age_max must be >= age_min", path: ["age_max"] });

// PUT /api/filters -> save who this user is willing to meet.
export async function PUT(req: Request) {
  // 1. Validate the body.
  const { data, error } = await parseBody(req, FiltersBody);
  if (error) return error;

  // 2. Upsert: create the user's filters row, or overwrite it if it already exists.
  const { error: dbError } = await db.from("filters").upsert(data);
  if (dbError) {
    if (dbError.code === UNKNOWN_USER) return unknownUser();
    return Response.json({ ok: false, error: dbError.message }, { status: 500 });
  }

  return Response.json({ ok: true });
}
