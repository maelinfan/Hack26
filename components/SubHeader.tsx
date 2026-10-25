"use client";

import { useRouter } from "next/navigation";
import { ChevronLeftIcon } from "@/components/Icons";

export default function SubHeader({ title, onSave, canSave = true }: { title: string; onSave: () => void; canSave?: boolean }) {
  const router = useRouter();
  return (
    <div className="sticky top-0 z-10 flex items-center border-b border-neutral-200 bg-white px-2 py-2">
      <button onClick={() => router.back()} aria-label="Back" className="p-2">
        <ChevronLeftIcon />
      </button>
      <h1 className="flex-1 text-center text-base font-semibold">{title}</h1>
      <button
        onClick={onSave}
        disabled={!canSave}
        className="px-3 py-2 text-sm font-semibold text-pink-600 disabled:text-neutral-300"
      >
        Save
      </button>
    </div>
  );
}
