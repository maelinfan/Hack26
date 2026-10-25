"use client";

import { useEffect } from "react";
import { usePathname, useRouter } from "next/navigation";
import { signIn, useUserId } from "./useSession";
import users from "@/data/mock/users.json";

/** Sends logged-out users to /login and shows the bottom nav only when logged in. */
export default function AuthGate({ children, nav }: { children: React.ReactNode; nav: React.ReactNode }) {
  const userId = useUserId();
  const pathname = usePathname();
  const router = useRouter();
  const onLogin = pathname === "/login";

  useEffect(() => {
    // /sim "open as" links: /?as=jordan signs this tab in as that persona, then cleans the URL.
    const as = new URLSearchParams(window.location.search).get("as");
    if (as && users.some((u) => u.id === as)) {
      signIn(as);
      window.history.replaceState(null, "", pathname === "/login" ? "/" : pathname);
      return;
    }
    if (userId === null && !onLogin) router.replace("/login");
    if (userId && onLogin) router.replace("/");
  }, [userId, onLogin, router, pathname]);

  if (userId === undefined) return null;
  if (!userId && !onLogin) return null;
  return (
    <>
      <main className={onLogin ? "" : "pb-14"}>{children}</main>
      {!onLogin && nav}
    </>
  );
}
