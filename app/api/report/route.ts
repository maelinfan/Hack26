import { z } from "zod";
import { safetyStub } from "@/lib/api";

// POST /api/report {user_id, reported_id, reason} -> UI-only stub.
export const POST = safetyStub(
  z.object({ user_id: z.string().min(1), reported_id: z.string().min(1), reason: z.string().optional() }),
);
