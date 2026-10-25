import { z } from "zod";
import { safetyStub } from "@/lib/api";

// POST /api/share-plan {user_id, friend_handle} -> UI-only stub.
export const POST = safetyStub(z.object({ user_id: z.string().min(1), friend_handle: z.string().min(1) }));
