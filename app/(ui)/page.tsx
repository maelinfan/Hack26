"use client";

import Avatar from "@/components/Avatar";
import { signOut, useCurrentUser } from "@/components/useSession";

export default function HomePage() {
  const user = useCurrentUser();
  if (!user) return null;
  return (
    <div className="px-4 py-6">
      <div className="flex items-center gap-3">
        <Avatar src={user.avatar_url} name={user.name} size={64} ring />
        <div className="flex-1">
          <p className="font-semibold">{user.handle}</p>
          <p className="text-sm text-neutral-500">Signed in as {user.name}</p>
        </div>
        <button onClick={signOut} className="rounded-lg border border-neutral-300 px-3 py-1.5 text-sm font-semibold">
          Log out
        </button>
      </div>
    </div>
  );
}
