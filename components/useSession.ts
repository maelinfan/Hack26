"use client";

import { useSyncExternalStore } from "react";
import users from "@/data/mock/users.json";

const KEY = "user_id";

function subscribe(cb: () => void) {
  window.addEventListener("storage", cb);
  window.addEventListener("session-change", cb);
  return () => {
    window.removeEventListener("storage", cb);
    window.removeEventListener("session-change", cb);
  };
}

const read = () => localStorage.getItem(KEY);
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
  localStorage.setItem(KEY, id);
  window.dispatchEvent(new Event("session-change"));
}

export function signOut() {
  localStorage.removeItem(KEY);
  window.dispatchEvent(new Event("session-change"));
}
