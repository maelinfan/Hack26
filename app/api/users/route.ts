import personas from "@/data/personas.json";
import type { UserSummary } from "@/lib/types";

// GET /api/users -> the list the login/sim screens use to show "Continue as ...".
export async function GET() {
  // 1. Take every seed user from the personas file.
  // 2. Copy over only the public fields (never bio, tags or coordinates).
  const users: UserSummary[] = personas.users.map((u) => ({
    id: u.id,
    name: u.name,
    handle: u.handle,
    age: u.age,
    gender: u.gender as UserSummary["gender"],
    avatar_url: u.avatar_url,
    verified: u.verified,
  }));

  // 3. Send it back as JSON with status 200.
  return Response.json(users);
}
