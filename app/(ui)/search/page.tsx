/* eslint-disable @next/next/no-img-element */
import { SearchIcon } from "@/components/Icons";
import posts from "@/data/mock/posts.json";

// Placeholder explore grid; search isn't part of the demo.
export default function SearchPage() {
  return (
    <div>
      <div className="px-3 py-2">
        <div className="flex items-center gap-2 rounded-lg bg-neutral-100 px-3 py-2 text-neutral-500">
          <SearchIcon />
          <span className="text-sm">Search</span>
        </div>
      </div>
      <div className="grid grid-cols-3 gap-0.5">
        {posts.map((p) => (
          <img key={p.id} src={p.image} alt="" className="aspect-square w-full bg-neutral-100 object-cover" loading="lazy" />
        ))}
      </div>
    </div>
  );
}
