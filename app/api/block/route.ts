import { z } from "zod";
import { safetyStub } from "@/lib/api";

// POST /api/block {user_id, blocked_id} -> UI-only stub.
export const POST = safetyStub(z.object({ user_id: z.string().min(1), blocked_id: z.string().min(1) }));
