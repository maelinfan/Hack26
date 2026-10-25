import { ReelsIcon } from "@/components/Icons";

// Placeholder; Reels isn't part of the demo.
export default function ReelsPage() {
  return (
    <div className="flex min-h-[70dvh] flex-col items-center justify-center px-8 text-center text-neutral-500">
      <ReelsIcon />
      <p className="mt-3 font-semibold text-neutral-900">Reels</p>
      <p className="mt-1 text-sm">Short videos from people you follow will show up here.</p>
    </div>
  );
}
