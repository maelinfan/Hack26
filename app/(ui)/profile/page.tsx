"use client";

/* eslint-disable @next/next/no-img-element */
import Avatar from "@/components/Avatar";
import { CheckBadgeIcon } from "@/components/Icons";
import { signOut, useCurrentUser } from "@/components/useSession";
import posts from "@/data/mock/posts.json";
import profiles from "@/data/mock/profiles.json";

export default function ProfilePage() {
  const user = useCurrentUser();
  if (!user) return null;
  const mine = posts.filter((p) => p.user_id === user.id);
  // Real bio and counts where we have them; everyone else gets made-up numbers from their age.
  const extra = (profiles as Record<string, { bio: string; followers: number; following: number }>)[user.id];
  const stat = (n: number | string, label: string) => (
    <div className="flex-1 text-center">
      <p className="font-semibold">{n}</p>
      <p className="text-sm text-neutral-600">{label}</p>
    </div>
  );

  return (
    <div>
      <header className="flex items-center justify-between border-b border-neutral-100 px-4 py-3">
        <p className="flex items-center gap-1 text-lg font-semibold">
          {user.handle}
          {user.verified && <CheckBadgeIcon className="text-sky-500" />}
        </p>
        <button onClick={signOut} className="rounded-lg border border-neutral-300 px-3 py-1.5 text-sm font-semibold">
          Log out
        </button>
      </header>

      <div className="flex items-center gap-4 px-4 py-4">
        <Avatar src={user.avatar_url} name={user.name} size={80} ring />
        {stat(mine.length, "posts")}
        {stat(extra?.followers ?? user.age * 11, "followers")}
        {stat(extra?.following ?? user.age * 6, "following")}
      </div>
      <p className="px-4 text-sm font-semibold">{user.name}</p>
      {extra?.bio && <p className="px-4 text-sm">{extra.bio}</p>}

      <div className="mt-4 grid grid-cols-3 gap-0.5 border-t border-neutral-100 pt-0.5">
        {mine.length === 0 && <p className="col-span-3 py-10 text-center text-sm text-neutral-500">No posts yet</p>}
        {mine.map((p) => (
          <img key={p.id} src={p.image} alt="" className="aspect-square w-full bg-neutral-100 object-cover" loading="lazy" />
        ))}
      </div>
    </div>
  );
}
