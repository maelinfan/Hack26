"use client";

import { useEffect, useRef, useState } from "react";
import AIPanel, { type ToolCall } from "@/components/AIPanel";
import Avatar from "@/components/Avatar";
import { CheckBadgeIcon } from "@/components/Icons";

// Matches SPEC.md section 6, GET /api/proposal (the requesting user's view).
export type Venue = {
  id: string;
  name: string;
  address: string;
  category: string;
  lat: number;
  lng: number;
  open_until: string;
};

export type ApiProposal = {
  id: string;
  state: "pending" | "both_accepted" | "confirmed";
  other: {
    name: string;
    handle: string;
    age: number;
    avatar_url: string;
    verified: boolean;
    relationship: string;
    distance: string;
  };
  why: string;
  shared_tags: string[];
  icebreakers: string[];
  my_response: "accept" | "decline" | null;
  other_responded: boolean;
  expires_at: string;
  server_now: string;
  venue: Venue | null;
  plan_reason: string | null;
  tool_calls: ToolCall[] | null;
};

const RELATIONSHIP: Record<string, string> = {
  close_friends: "Close friend",
  mutual: "You follow each other",
  following: "You follow them",
  follows_you: "Follows you",
  none: "Not connected yet",
};
const DISTANCE: Record<string, string> = {
  very_close: "Very close",
  nearby: "Nearby",
};

const PLAN_PATIENCE_MS = 45_000;
const RING = 64;
const STROKE = 5;
const R = (RING - STROKE) / 2;
const CIRC = 2 * Math.PI * R;

/**
 * One real proposal. The countdown is rebased on the server's clock: `skewMs` is
 * (server_now - client clock) measured when the response arrived, so a wrong device clock doesn't matter.
 */
export type Respond = (response: "accept" | "decline", reason?: "not_now" | "not_interested") => void;

export default function ProposalCard({
  proposal,
  skewMs,
  onRespond,
  busy = false,
}: {
  proposal: ApiProposal;
  skewMs: number;
  onRespond: Respond;
  busy?: boolean;
}) {
  const { other, why, shared_tags, icebreakers } = proposal;
  const expiresAt = Date.parse(proposal.expires_at);
  const [now, setNow] = useState(() => Date.now());
  // Ring total = the time left when this proposal first showed up (the server's TTL, 45s by default).
  const total = useRef({ id: proposal.id, ms: 0 });
  const remaining = Math.max(0, expiresAt - (now + skewMs));
  if (total.current.id !== proposal.id) total.current = { id: proposal.id, ms: 0 };
  total.current.ms = Math.max(total.current.ms, remaining);

  const expired = remaining === 0;
  const waiting = proposal.state === "pending" && proposal.my_response === "accept";
  const planning = proposal.state === "both_accepted";

  // Honest fallback: if the venue agent never finishes, say so instead of spinning forever.
  const planStart = useRef<number | null>(null);
  if (planning && planStart.current === null) planStart.current = Date.now();
  const stuck = planning && planStart.current !== null && now - planStart.current > PLAN_PATIENCE_MS;

  useEffect(() => {
    if (!planning) return;
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, [planning]);

  useEffect(() => {
    if (expired) return;
    const id = setInterval(() => setNow(Date.now()), 200);
    return () => clearInterval(id);
  }, [expired]);

  const secs = Math.ceil(remaining / 1000);
  const frac = total.current.ms ? remaining / total.current.ms : 0;
  const showRing = proposal.state === "pending" && !expired && !waiting;

  return (
    <div className="space-y-3">
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
          {showRing && (
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

        {icebreakers.length > 0 && (
          <div className="mt-4 rounded-xl bg-neutral-50 p-3">
            <p className="text-xs font-semibold uppercase tracking-wide text-neutral-500">Conversation starters</p>
            <ul className="mt-1 space-y-1">
              {icebreakers.map((q) => (
                <li key={q} className="text-sm italic text-neutral-800">
                  &ldquo;{q}&rdquo;
                </li>
              ))}
            </ul>
          </div>
        )}

        {planning ? (
          <div className="mt-4 rounded-lg bg-neutral-50 py-3 text-center">
            <p className="font-semibold">Finding a spot...</p>
            <p className="mt-1 text-xs text-neutral-500">
              {stuck
                ? "This is taking longer than expected. The venue planner hasn't finished on the server."
                : "You both said yes. Picking a public place."}
            </p>
          </div>
        ) : waiting ? (
          <div className="mt-4 rounded-lg bg-neutral-50 py-3 text-center">
            <p className="font-semibold">Waiting for them...</p>
            <p className="mt-1 text-xs text-neutral-500">We&apos;ll plan a spot if you both say yes.</p>
          </div>
        ) : expired ? (
          <div className="mt-4 text-center">
            <p className="font-semibold">This suggestion expired</p>
            <p className="mt-1 text-sm text-neutral-500">Finding someone else nearby...</p>
          </div>
        ) : (
          <div className="mt-4 space-y-2">
            <button
              onClick={() => onRespond("accept")}
              disabled={busy}
              className="w-full rounded-lg bg-gradient-to-r from-pink-500 to-purple-600 py-2.5 text-sm font-semibold text-white disabled:opacity-50"
            >
              Accept
            </button>
            <div className="grid grid-cols-2 gap-2">
              <button
                onClick={() => onRespond("decline", "not_now")}
                disabled={busy}
                className="rounded-lg border border-neutral-300 py-2 text-sm font-semibold text-neutral-700 disabled:opacity-50"
              >
                Not now
              </button>
              <button
                onClick={() => onRespond("decline", "not_interested")}
                disabled={busy}
                className="rounded-lg border border-neutral-300 py-2 text-sm font-semibold text-neutral-700 disabled:opacity-50"
              >
                Not interested
              </button>
            </div>
          </div>
        )}
      </div>
      {/* Sections 1-2 only until the venue agent has run. */}
      <AIPanel proposal={{ why, shared_tags, tool_calls: null }} />
    </div>
  );
}
