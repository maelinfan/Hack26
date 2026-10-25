"use client";

/* eslint-disable @next/next/no-img-element */
import { useState } from "react";
import Avatar from "@/components/Avatar";
import { BookmarkIcon, CheckBadgeIcon, CommentIcon, HeartIcon, SendIcon } from "@/components/Icons";

export type Post = { id: string; user_id: string; image: string; caption: string; likes: number; time: string };
type Author = { name: string; handle: string; avatar_url: string; verified: boolean };

/** One fake feed post. Like and save are local-only. */
export default function PostCard({ post, author }: { post: Post; author: Author }) {
  const [liked, setLiked] = useState(false);
  const [saved, setSaved] = useState(false);
  return (
    <article className="pb-4">
      <div className="flex items-center gap-3 px-3 py-2">
        <Avatar src={author.avatar_url} name={author.name} size={32} ring />
        <p className="flex flex-1 items-center gap-1 text-sm font-semibold">
          {author.handle}
          {author.verified && <CheckBadgeIcon className="text-sky-500" />}
        </p>
        <span className="text-xs text-neutral-500">{post.time}</span>
      </div>
      <img src={post.image} alt="" className="aspect-square w-full bg-neutral-100 object-cover" loading="lazy" />
      <div className="flex items-center gap-4 px-3 pt-3">
        <button onClick={() => setLiked(!liked)} aria-label="Like" aria-pressed={liked}>
          <HeartIcon filled={liked} className={liked ? "text-red-500" : ""} />
        </button>
        <CommentIcon />
        <SendIcon />
        <button onClick={() => setSaved(!saved)} aria-label="Save" aria-pressed={saved} className="ml-auto">
          <BookmarkIcon className={saved ? "fill-current" : ""} />
        </button>
      </div>
      <p className="px-3 pt-2 text-sm font-semibold">{(post.likes + (liked ? 1 : 0)).toLocaleString()} likes</p>
      <p className="px-3 pt-1 text-sm">
        <span className="font-semibold">{author.handle}</span> {post.caption}
      </p>
    </article>
  );
}
