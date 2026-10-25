"use client";

import { useEffect, useState } from "react";
import Avatar from "@/components/Avatar";
import ProposalCard from "@/components/ProposalCard";
import { NearbyIcon, ShieldCheckIcon } from "@/components/Icons";
import { useCurrentUser } from "@/components/useSession";

const DURATIONS = [
  { minutes: 30, label: "30 min" },
  { minutes: 60, label: "1 hr" },
  { minutes: 120, label: "2 hrs" },
];

const PROPOSAL_DELAY_MS = 4000;

function formatRemaining(ms: number) {
  const total = Math.ceil(ms / 1000);
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  const pad = (n: number) => String(n).padStart(2, "0");
  return h > 0 ? `${h}:${pad(m)}:${pad(s)}` : `${pad(m)}:${pad(s)}`;
}

export default function NearbyPage() {
  const user = useCurrentUser();
  const [minutes, setMinutes] = useState(120);
  // Fake state: epoch ms when availability ends, null = off.
  const [endsAt, setEndsAt] = useState<number | null>(null);
  const [now, setNow] = useState(0);
  const [showProposal, setShowProposal] = useState(false);
  const [proposalKey, setProposalKey] = useState(0);

  useEffect(() => {
    if (endsAt === null) return;
    const tick = () => setNow(Date.now());
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [endsAt]);

  // Fake matching: a proposal appears a few seconds after turning on.
  const on0 = endsAt !== null;
  useEffect(() => {
    if (!on0) {
      setShowProposal(false);
      return;
    }
    const id = setTimeout(() => {
      setProposalKey((k) => k + 1);
      setShowProposal(true);
    }, PROPOSAL_DELAY_MS);
    return () => clearTimeout(id);
  }, [on0, endsAt]);

  if (!user) return null;

  const remaining = endsAt === null ? 0 : Math.max(0, endsAt - now);
  const on = endsAt !== null && remaining > 0;
  const durationLabel = DURATIONS.find((d) => d.minutes === minutes)!.label;

  const turnOn = (mins: number) => {
    const start = Date.now();
    setNow(start);
    setEndsAt(start + mins * 60_000);
  };
  const toggle = () => (on ? setEndsAt(null) : turnOn(minutes));
  const pickDuration = (mins: number) => {
    setMinutes(mins);
    if (on) turnOn(mins);
  };

  return (
    <div className="px-4 py-6">
      <h1 className="text-xl font-semibold">Meet nearby</h1>
      <p className="mt-1 text-sm text-neutral-500">
        Get matched with someone close by who shares your interests, then meet at a public spot.
      </p>

      <div className="mt-6 flex flex-col items-center">
        <div className={on ? "rounded-full bg-gradient-to-tr from-yellow-400 via-pink-500 to-purple-600 p-[3px]" : "rounded-full bg-neutral-200 p-[3px]"}>
          <div className="rounded-full bg-white p-1">
            <Avatar src={user.avatar_url} name={user.name} size={112} />
          </div>
        </div>
        <p className="mt-3 text-sm font-semibold">{user.handle}</p>
      </div>

      <div className="mt-6 flex items-center gap-3 rounded-xl border border-neutral-200 p-4">
        <NearbyIcon className={on ? "text-pink-500" : "text-neutral-400"} filled={on} />
        <div className="flex-1">
          <p className="font-semibold">{on ? "Open to meeting" : "Meet nearby is off"}</p>
          <p className="text-sm text-neutral-500">
            {on ? (
              <>
                Open for <span className="font-semibold tabular-nums text-neutral-900">{formatRemaining(remaining)}</span> more
              </>
            ) : (
              `Open for ${durationLabel} once on`
            )}
          </p>
        </div>
        <button
          role="switch"
          aria-checked={on}
          aria-label="Meet nearby"
          onClick={toggle}
          className={`relative h-8 w-14 shrink-0 rounded-full transition-colors ${
            on ? "bg-gradient-to-r from-pink-500 to-purple-600" : "bg-neutral-300"
          }`}
        >
          <span
            className={`absolute left-1 top-1 h-6 w-6 rounded-full bg-white shadow transition-transform ${
              on ? "translate-x-6" : ""
            }`}
          />
        </button>
      </div>

      {showProposal && (
        <div className="mt-6">
          <ProposalCard key={proposalKey} excludeId={user.id} />
        </div>
      )}

      <p className="mt-6 text-sm font-semibold">Stay open for</p>
      <div className="mt-2 grid grid-cols-3 gap-2">
        {DURATIONS.map((d) => (
          <button
            key={d.minutes}
            onClick={() => pickDuration(d.minutes)}
            className={`rounded-lg border py-2 text-sm font-semibold ${
              d.minutes === minutes
                ? "border-transparent bg-gradient-to-r from-pink-500 to-purple-600 text-white"
                : "border-neutral-300 text-neutral-700"
            }`}
          >
            {d.label}
          </button>
        ))}
      </div>
      {on && <p className="mt-2 text-xs text-neutral-500">Changing the duration restarts the timer.</p>}

      <div className="mt-8 flex items-start gap-3 rounded-xl bg-neutral-50 p-4">
        <ShieldCheckIcon className="shrink-0 text-neutral-700" />
        <p className="text-sm text-neutral-600">
          <span className="font-semibold text-neutral-900">18+ only, public places only, verified.</span> You&apos;ll only
          be matched with verified adults, and every meetup happens at a public venue.
        </p>
      </div>
    </div>
  );
}
