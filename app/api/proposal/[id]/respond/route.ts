import { z } from "zod";
import { parseBody } from "@/lib/api";
import { respondToProposal } from "@/lib/proposals";

const RespondBody = z.object({
  user_id: z.string().min(1),
  response: z.enum(["accept", "decline"]),
  reason: z.enum(["not_now", "not_interested"]).optional(), // only used with "decline"; defaults to not_now
});

// POST /api/proposal/:id/respond -> accept or decline a proposal.
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { data, error } = await parseBody(req, RespondBody);
  if (error) return error;

  // A malformed id would make the database reject the uuid, so treat it as "not found".
  if (!/^[0-9a-f-]{36}$/i.test(id)) {
    return Response.json({ ok: false, error: "proposal not found" }, { status: 404 });
  }

  try {
    const result = await respondToProposal(id, data.user_id, data.response, data.reason ?? "not_now");
    return Response.json(result.body, { status: result.status });
  } catch (err) {
    return Response.json({ ok: false, error: err instanceof Error ? err.message : "server error" }, { status: 500 });
  }
}
