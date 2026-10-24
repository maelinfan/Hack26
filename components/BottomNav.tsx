"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { HomeIcon, NearbyIcon } from "./Icons";

const tabs = [
  { href: "/", label: "Home", Icon: HomeIcon },
  { href: "/nearby", label: "Meet nearby", Icon: NearbyIcon },
];

export default function BottomNav() {
  const pathname = usePathname();
  return (
    <nav className="fixed bottom-0 left-1/2 z-10 flex h-14 w-full max-w-[430px] -translate-x-1/2 items-center justify-around border-t border-neutral-200 bg-white">
      {tabs.map(({ href, label, Icon }) => {
        const active = pathname === href;
        return (
          <Link
            key={href}
            href={href}
            aria-label={label}
            className={`flex h-full flex-1 items-center justify-center ${active ? "text-black" : "text-neutral-500"}`}
          >
            <Icon filled={active} />
          </Link>
        );
      })}
    </nav>
  );
}
