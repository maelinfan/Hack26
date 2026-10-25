"use client";

import { useEffect, useState } from "react";
import AIPanel from "@/components/AIPanel";
import Avatar from "@/components/Avatar";
import { CheckBadgeIcon } from "@/components/Icons";
import mock from "@/data/mock/proposal-pending.json";
import users from "@/data/mock/users.json";

type Candidate = {
  id: string;
  other: (typeof mock.proposal)["other"];
  why: string;
  shared_tags: string[];
  icebreaker: string;
};

const asOther = (id: string, relationship: string, distance: string) => {
  const u = users.find((x) => x.id === id)!;
  return { name: u.name, handle: u.handle, age: u.age, avatar_url: u.avatar_url, verified: u.verified, relationship, distance };
};

// Fake queue of suggestions; Jordan comes from the mock proposal file.
const CANDIDATES: Candidate[] = [
  { id: "jordan", other: mock.proposal.other, why: mock.proposal.why, shared_tags: mock.proposal.shared_tags, icebreaker: mock.proposal.icebreakers[0] },
  { id: "priya", other: asOther("priya", "follows_you", "nearby"), why: "You both love sketching and ramen. Priya posts her café drawings every weekend.", shared_tags: ["sketching", "ramen"], icebreaker: "What are you drawing lately?" },
  { id: "sam", other: asOther("sam", "none", "very_close"), why: "You both play board games and love coffee. Sam hosts game nights near campus.", shared_tags: ["board games", "coffee"], icebreaker: "What's your all-time favorite board game?" },
  { id: "riley", other: asOther("riley", "following", "nearby"), why: "You both love hiking and birdwatching. Riley spotted a rare warbler last week.", shared_tags: ["hiking", "birding"], icebreaker: "What's the best trail you've done lately?" },
  { id: "ava", other: asOther("ava", "mutual", "nearby"), why: "You both love photography and live music. Ava shoots local shows.", shared_tags: ["photography", "live music"], icebreaker: "Best concert you've ever been to?" },
];

const RELATIONSHIP: Record<string, string> = {
  mutual: "You follow each other",
  following: "You follow them",
  follower: "Follows you",
  none: "Not connected yet",
};
const DISTANCE: Record<string, string> = {
  here: "Right here",
  nearby: "Nearby",
  close: "Close by",
  far: "A bit further",
};

const EXPIRED_SHOW_MS = 2500;
const RING = 64;
const STROKE = 5;
const R = (RING - STROKE) / 2;
const CIRC = 2 * Math.PI * R;

type Answer = "pending" | "accepted";

/** Shows suggestions one at a time; declining or expiring moves on to the next person. */
export default function ProposalCard({ excludeId }: { excludeId?: string }) {
  const queue = CANDIDATES.filter((c) => c.id !== excludeId);
  const [i, setI] = useState(0);
  const c = queue[i % queue.length];
  return (
    <div className="space-y-3">
      <Card key={`${c.id}-${i}`} candidate={c} onNext={() => setI((n) => n + 1)} />
      {/* Sections 1-2 only: the venue agent hasn't run yet (tool_calls null). */}
      <AIPanel key={`panel-${c.id}-${i}`} proposal={{ why: c.why, shared_tags: c.shared_tags, tool_calls: null }} />
    </div>
  );
}

function Card({ candidate, onNext }: { candidate: Candidate; onNext: () => void }) {
  const { other, why, shared_tags, icebreaker } = candidate;
  const onDismiss = onNext;
  // Mock timestamps are fixed, so keep only the TTL and rebase it to now.
  const ttlMs = Date.parse(mock.proposal.expires_at) - Date.parse(mock.proposal.server_now);
  const [expiresAt] = useState(() => Date.now() + ttlMs);
  const [now, setNow] = useState(() => Date.now());
  const [answer, setAnswer] = useState<Answer>("pending");

  const remaining = Math.max(0, expiresAt - now);
  const expired = remaining === 0;

  useEffect(() => {
    if (expired) return;
    const id = setInterval(() => setNow(Date.now()), 200);
    return () => clearInterval(id);
  }, [expired]);

  // Expired: show the notice briefly, then move on to the next person.
  useEffect(() => {
    if (!expired) return;
    const id = setTimeout(onNext, EXPIRED_SHOW_MS);
    return () => clearTimeout(id);
  }, [expired, onNext]);

  const secs = Math.ceil(remaining / 1000);
  const frac = remaining / ttlMs;

  return (
    <div className="rounded-2xl border border-neutral-200 bg-white p-4 shadow-sm">
      <div className="flex items-center gap-3">
        <Avatar src={other.avatar_url} name={other.name} size={64} ring />
        <div className="min-w-0 flex-1">
          <p className="flex items-center gap-1 font-semibold">
            {other.name}, {other.age}
            {other.verified && <CheckBadgeIcon className="text-sky-500" />}
          </p>
          <p className="truncate text-sm text-neutral-500">@{other.handle}</p>
          <p className="text-xs text-neutral-500">
            {RELATIONSHIP[other.relationship] ?? other.relationship} · {DISTANCE[other.distance] ?? other.distance}
          </p>
        </div>
        {!expired && answer === "pending" && (
          <div className="relative shrink-0" style={{ width: RING, height: RING }}>
            <svg width={RING} height={RING} className="-rotate-90">
              <defs>
                <linearGradient id="ring" x1="0" y1="1" x2="1" y2="0">
                  <stop offset="0%" stopColor="#facc15" />
                  <stop offset="50%" stopColor="#ec4899" />
                  <stop offset="100%" stopColor="#9333ea" />
                </linearGradient>
              </defs>
              <circle cx={RING / 2} cy={RING / 2} r={R} fill="none" stroke="#e5e5e5" strokeWidth={STROKE} />
              <circle
                cx={RING / 2}
                cy={RING / 2}
                r={R}
                fill="none"
                stroke="url(#ring)"
                strokeWidth={STROKE}
                strokeLinecap="round"
                strokeDasharray={CIRC}
                strokeDashoffset={CIRC * (1 - frac)}
              />
            </svg>
            <span className="absolute inset-0 flex items-center justify-center text-sm font-semibold tabular-nums">
              {secs}
            </span>
          </div>
        )}
      </div>

      <p className="mt-4 text-sm text-neutral-800">{why}</p>
      <div className="mt-3 flex flex-wrap gap-2">
        {shared_tags.map((t) => (
          <span key={t} className="rounded-full bg-neutral-100 px-3 py-1 text-xs font-semibold text-neutral-700">
            #{t}
          </span>
        ))}
      </div>

      <div className="mt-4 rounded-xl bg-neutral-50 p-3">
        <p className="text-xs font-semibold uppercase tracking-wide text-neutral-500">Icebreaker</p>
        <p className="mt-1 text-sm italic text-neutral-800">&ldquo;{icebreaker}&rdquo;</p>
      </div>

      {expired ? (
        <div className="mt-4 text-center">
          <p className="font-semibold">This suggestion expired</p>
          <p className="mt-1 text-sm text-neutral-500">Finding someone else nearby...</p>
        </div>
      ) : answer === "accepted" ? (
        <div className="mt-4 rounded-lg bg-neutral-50 py-3 text-center">
          <p className="font-semibold">Waiting for them...</p>
          <p className="mt-1 text-xs text-neutral-500">We&apos;ll plan a spot if you both say yes.</p>
        </div>
      ) : (
        <div className="mt-4 space-y-2">
          <button
            onClick={() => setAnswer("accepted")}
            className="w-full rounded-lg bg-gradient-to-r from-pink-500 to-purple-600 py-2.5 text-sm font-semibold text-white"
          >
            Accept
          </button>
          <div className="grid grid-cols-2 gap-2">
            <button onClick={onDismiss} className="rounded-lg border border-neutral-300 py-2 text-sm font-semibold text-neutral-700">
              Not now
            </button>
            <button onClick={onDismiss} className="rounded-lg border border-neutral-300 py-2 text-sm font-semibold text-neutral-700">
              Not interested
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
