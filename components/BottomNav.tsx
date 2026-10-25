"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import Avatar from "./Avatar";
import { HomeIcon, NearbyIcon, ReelsIcon, SearchIcon } from "./Icons";
import { useCurrentUser } from "./useSession";

// The usual Instagram tabs, plus Meet nearby (/nearby and its sub-pages).
const tabs = [
  { href: "/", label: "Home", Icon: HomeIcon },
  { href: "/search", label: "Search", Icon: SearchIcon },
  { href: "/reels", label: "Reels", Icon: ReelsIcon },
  { href: "/nearby", label: "Meet nearby", Icon: NearbyIcon },
];

export default function BottomNav() {
  const pathname = usePathname();
  const user = useCurrentUser();
  const isActive = (href: string) => (href === "/" ? pathname === "/" : pathname.startsWith(href));
  const tabClass = (active: boolean) =>
    `flex h-full flex-1 items-center justify-center ${active ? "text-black" : "text-neutral-500"}`;
  return (
    <nav className="fixed bottom-0 left-1/2 z-10 flex h-14 w-full max-w-[430px] -translate-x-1/2 items-center justify-around border-t border-neutral-200 bg-white">
      {tabs.map(({ href, label, Icon }) => {
        const active = isActive(href);
        return (
          <Link key={href} href={href} aria-label={label} className={tabClass(active)}>
            <Icon filled={active} />
          </Link>
        );
      })}
      <Link href="/profile" aria-label="Profile" className={tabClass(isActive("/profile"))}>
        {user ? (
          <span className={`rounded-full p-[2px] ${isActive("/profile") ? "bg-black" : "bg-transparent"}`}>
            <span className="block rounded-full bg-white p-[1.5px]">
              <Avatar src={user.avatar_url} name={user.name} size={24} />
            </span>
          </span>
        ) : null}
      </Link>
    </nav>
  );
}
