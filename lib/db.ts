import { createClient, type SupabaseClient } from "@supabase/supabase-js";

// Server-only client. Uses the secret key, so never import this from /components or /app/(ui).
// Created on first use (not at import time), so `npm run build` works on a machine that has no
// .env.local yet; a missing key then fails with a clear message only when a request needs the database.

let client: SupabaseClient | null = null;

function getClient() {
  if (!client) {
    // Strip a trailing "/rest/v1/" in case it was pasted from the dashboard; the client adds paths itself.
    const url = (process.env.SUPABASE_URL ?? "").replace(/\/rest\/v1\/?$/, "").replace(/\/$/, "");
    const key = process.env.SUPABASE_SERVICE_KEY ?? "";
    if (!url || !key) {
      throw new Error("SUPABASE_URL and SUPABASE_SERVICE_KEY must be set in .env.local");
    }
    client = createClient(url, key, { auth: { persistSession: false } });
  }
  return client;
}

// `db.from(...)` etc. work exactly as on a normal client; the real one is built on first access.
export const db = new Proxy({} as SupabaseClient, {
  get(_target, prop) {
    const real = getClient();
    const value = Reflect.get(real, prop);
    return typeof value === "function" ? value.bind(real) : value;
  },
});
