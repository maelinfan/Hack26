import { badRequest, unknownUser } from "@/lib/api";
import { getProposalFor } from "@/lib/proposals";

// GET /api/proposal?user_id=maya -> polled every ~1.5s by the UI.
export async function GET(req: Request) {
  const userId = new URL(req.url).searchParams.get("user_id");
  if (!userId) return badRequest("user_id query parameter is required");

  try {
    const body = await getProposalFor(userId);
    if (!body) return unknownUser();
    return Response.json(body);
  } catch (err) {
    return Response.json({ ok: false, error: err instanceof Error ? err.message : "server error" }, { status: 500 });
  }
}
