"use client";

import { useEffect } from "react";
import { usePathname, useRouter } from "next/navigation";
import { useUserId } from "./useSession";

/** Sends logged-out users to /login and shows the bottom nav only when logged in. */
export default function AuthGate({ children, nav }: { children: React.ReactNode; nav: React.ReactNode }) {
  const userId = useUserId();
  const pathname = usePathname();
  const router = useRouter();
  const onLogin = pathname === "/login";

  useEffect(() => {
    if (userId === null && !onLogin) router.replace("/login");
    if (userId && onLogin) router.replace("/");
  }, [userId, onLogin, router]);

  if (userId === undefined) return null;
  if (!userId && !onLogin) return null;
  return (
    <>
      <main className={onLogin ? "" : "pb-14"}>{children}</main>
      {!onLogin && nav}
    </>
  );
}
