import { z } from "zod";
import { parseBody } from "@/lib/api";
import { requestLate } from "@/lib/proposals";

const LateBody = z.object({
  user_id: z.string().min(1),
  minutes: z.number().int().min(5).max(30),
});

// POST /api/proposal/:id/late -> "I'm running late": the venue agent re-plans (see SPEC §6).
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { data, error } = await parseBody(req, LateBody);
  if (error) return error;
  if (!/^[0-9a-f-]{36}$/i.test(id)) {
    return Response.json({ ok: false, error: "proposal not found" }, { status: 404 });
  }
  try {
    const result = await requestLate(id, data.user_id, data.minutes);
    return Response.json(result.body, { status: result.status });
  } catch (err) {
    return Response.json({ ok: false, error: err instanceof Error ? err.message : "server error" }, { status: 500 });
  }
}
