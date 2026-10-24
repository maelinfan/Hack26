"use client";

import { signIn } from "@/components/useSession";

// Mock auth: "Connect" signs in as Maya (demo user A). Other personas are opened from /sim.
const DEFAULT_USER = "maya";

export default function LoginPage() {
  return (
    <div className="flex min-h-dvh flex-col items-center justify-center px-8 text-center">
      <h1 className="bg-gradient-to-r from-pink-500 via-purple-500 to-orange-400 bg-clip-text text-5xl font-semibold text-transparent">
        Nearby
      </h1>
      <p className="mt-3 text-sm text-neutral-500">Meet people near you, in person.</p>
      <button
        onClick={() => signIn(DEFAULT_USER)}
        className="mt-10 w-full rounded-lg bg-gradient-to-r from-pink-500 via-purple-500 to-orange-400 py-3 text-sm font-semibold text-white active:opacity-90"
      >
        Connect your Meta account
      </button>
      <p className="mt-4 text-xs text-neutral-400">18+ only. Public places only.</p>
    </div>
  );
}
