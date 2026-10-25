import Avatar from "@/components/Avatar";
import { PlusIcon } from "@/components/Icons";
import users from "@/data/mock/users.json";

/** Fake stories row: the user's own "Your story" first, then everyone else with a gradient ring. */
export default function Stories({ userId }: { userId: string }) {
  const me = users.find((u) => u.id === userId);
  const others = users.filter((u) => u.id !== userId);
  return (
    <div className="flex gap-3 overflow-x-auto px-3 py-3 [scrollbar-width:none]">
      {me && (
        <div className="flex w-[68px] shrink-0 flex-col items-center">
          <div className="relative">
            <Avatar src={me.avatar_url} name={me.name} size={64} />
            <span className="absolute -bottom-0.5 -right-0.5 flex h-5 w-5 items-center justify-center rounded-full border-2 border-white bg-sky-500 text-white">
              <PlusIcon />
            </span>
          </div>
          <p className="mt-1 w-full truncate text-center text-xs text-neutral-500">Your story</p>
        </div>
      )}
      {others.map((u) => (
        <div key={u.id} className="flex w-[68px] shrink-0 flex-col items-center">
          <Avatar src={u.avatar_url} name={u.name} size={60} ring />
          <p className="mt-1 w-full truncate text-center text-xs text-neutral-900">{u.handle}</p>
        </div>
      ))}
    </div>
  );
}
