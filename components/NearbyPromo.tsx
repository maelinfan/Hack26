import Link from "next/link";
import { NearbyIcon } from "@/components/Icons";

/** Feed promo for the new Meet nearby feature. */
export default function NearbyPromo() {
  return (
    <div className="mx-3 my-3 rounded-2xl bg-gradient-to-tr from-yellow-400 via-pink-500 to-purple-600 p-[2px]">
      <div className="rounded-[14px] bg-white p-4">
        <p className="text-xs font-semibold uppercase tracking-wide text-pink-600">New</p>
        <div className="mt-1 flex items-center gap-2">
          <NearbyIcon className="text-pink-500" filled />
          <p className="text-lg font-semibold">Meet nearby</p>
        </div>
        <p className="mt-1 text-sm text-neutral-600">
          Get matched with someone close by who shares your interests, then meet at a public spot. 18+ only, verified.
        </p>
        <Link
          href="/nearby"
          className="mt-3 block rounded-lg bg-gradient-to-r from-pink-500 to-purple-600 py-2.5 text-center text-sm font-semibold text-white"
        >
          Try it
        </Link>
      </div>
    </div>
  );
}
