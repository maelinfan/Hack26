"use client";

import NearbyPromo from "@/components/NearbyPromo";
import PostCard, { type Post } from "@/components/PostCard";
import Stories from "@/components/Stories";
import { CommentIcon, HeartIcon } from "@/components/Icons";
import { useCurrentUser } from "@/components/useSession";
import posts from "@/data/mock/posts.json";
import users from "@/data/mock/users.json";

/** Fake Instagram home: stories, a Meet nearby promo, then other people's posts. */
export default function HomePage() {
  const user = useCurrentUser();
  if (!user) return null;
  const feed = (posts as Post[]).filter((p) => p.user_id !== user.id);
  const [first, ...rest] = feed;
  const render = (p: Post) => {
    const author = users.find((u) => u.id === p.user_id);
    return author ? <PostCard key={p.id} post={p} author={author} /> : null;
  };

  return (
    <div>
      <header className="sticky top-0 z-10 flex items-center justify-between border-b border-neutral-100 bg-white px-4 py-2">
        <h1 className="font-serif text-2xl italic font-semibold">Instagram</h1>
        <div className="flex items-center gap-4">
          <HeartIcon />
          <CommentIcon />
        </div>
      </header>
      <Stories userId={user.id} />
      <div className="border-t border-neutral-100 pt-1" />
      {first && render(first)}
      <NearbyPromo />
      {rest.map(render)}
    </div>
  );
}
