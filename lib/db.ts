import { createClient } from "@supabase/supabase-js";

// Server-only client. Uses the secret key, so never import this from /components or /app/(ui).
// Strip a trailing "/rest/v1/" in case it was pasted from the dashboard; the client adds paths itself.
const url = (process.env.SUPABASE_URL ?? "").replace(/\/rest\/v1\/?$/, "").replace(/\/$/, "");
const key = process.env.SUPABASE_SERVICE_KEY ?? "";

export const db = createClient(url, key, {
  auth: { persistSession: false },
});
