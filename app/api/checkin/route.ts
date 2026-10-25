import { z } from "zod";
import { safetyStub } from "@/lib/api";

// POST /api/checkin {user_id, status} -> UI-only stub.
// SPEC says status is "here" | "leaving"; kept as a plain string so the UI's own wording
// (e.g. "on my way") doesn't get a 400 from a stub that stores nothing.
export const POST = safetyStub(z.object({ user_id: z.string().min(1), status: z.string().min(1) }));
