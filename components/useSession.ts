"use client";

import { useSyncExternalStore } from "react";
import users from "@/data/mock/users.json";

const KEY = "user_id";

// sessionStorage (per tab) so two windows can be signed in as different users (Maya + Jordan demo).
function subscribe(cb: () => void) {
  window.addEventListener("session-change", cb);
  return () => window.removeEventListener("session-change", cb);
}

const read = () => sessionStorage.getItem(KEY);
// Server render and first hydration pass: unknown yet.
const readServer = () => undefined;

/** undefined = not loaded yet, null = logged out, string = user id */
export function useUserId() {
  return useSyncExternalStore<string | null | undefined>(subscribe, read, readServer);
}

export function useCurrentUser() {
  const id = useUserId();
  if (id === undefined) return undefined;
  if (!id) return null;
  return users.find((u) => u.id === id) ?? null;
}

export function signIn(id: string) {
  sessionStorage.setItem(KEY, id);
  window.dispatchEvent(new Event("session-change"));
}

export function signOut() {
  sessionStorage.removeItem(KEY);
  window.dispatchEvent(new Event("session-change"));
}
