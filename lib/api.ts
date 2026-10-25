import type { z } from "zod";

// Shared helpers for the /app/api routes.

export function badRequest(message: string) {
  return Response.json({ ok: false, error: message }, { status: 400 });
}

// Reads the JSON body and checks it against a zod schema.
// Returns either { data } (typed and safe to use) or { error } (a 400 Response to return as-is).
export async function parseBody<T extends z.ZodType>(
  req: Request,
  schema: T,
): Promise<{ data: z.infer<T>; error?: never } | { data?: never; error: Response }> {
  let json: unknown;
  try {
    json = await req.json();
  } catch {
    return { error: badRequest("body must be valid JSON") };
  }
  const parsed = schema.safeParse(json);
  if (!parsed.success) {
    const message = parsed.error.issues
      .map((i) => `${i.path.join(".") || "body"}: ${i.message}`)
      .join("; ");
    return { error: badRequest(message) };
  }
  return { data: parsed.data };
}

// Builds a POST handler for the UI-only safety endpoints (block, report, share-plan, checkin).
// They only check the body is well-formed and answer { ok: true }; nothing is stored (SPEC §6).
export function safetyStub<T extends z.ZodType>(schema: T) {
  return async function POST(req: Request) {
    const { error } = await parseBody(req, schema);
    if (error) return error;
    return Response.json({ ok: true });
  };
}

// Postgres code 23503 = foreign key violation, i.e. the user_id doesn't exist in users.
export const UNKNOWN_USER = "23503";

export function unknownUser() {
  return Response.json({ ok: false, error: "unknown user_id" }, { status: 404 });
}
