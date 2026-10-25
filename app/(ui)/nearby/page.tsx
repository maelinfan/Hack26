"use client";

import { useEffect, useRef, useState } from "react";
import Avatar from "@/components/Avatar";
import Link from "next/link";
import { useRouter } from "next/navigation";
import ProposalCard, { type ApiProposal } from "@/components/ProposalCard";
import personas from "@/data/personas.json";
import { ChevronRightIcon, NearbyIcon, ShieldCheckIcon, SlidersIcon, TagIcon } from "@/components/Icons";
import { useCurrentUser } from "@/components/useSession";
import { isFinished } from "@/components/nearbyPrefs";

const DURATIONS = [
  { minutes: 30, label: "30 min" },
  { minutes: 60, label: "1 hr" },
  { minutes: 120, label: "2 hrs" },
];

// Where this user's pin is: the /sim pin if they dragged one, else the persona's default position.
function pinFor(userId: string) {
  try {
    const raw = localStorage.getItem("sim:pins");
    const p = raw ? JSON.parse(raw)?.[userId] : null;
    if (typeof p?.lat === "number" && typeof p?.lng === "number") return { lat: p.lat as number, lng: p.lng as number };
  } catch {
    // fall through to the default
  }
  const d = personas.presence.find((x) => x.user_id === userId);
  return { lat: d?.lat ?? 30.2849, lng: d?.lng ?? -97.7341 };
}

// The server has no "am I on?" read, so remember the window per tab to survive leaving this page.
const untilKey = (userId: string) => `presence:${userId}`;
const readUntil = (userId: string) => {
  try {
    const t = Date.parse(sessionStorage.getItem(untilKey(userId)) ?? "");
    return Number.isFinite(t) && t > Date.now() ? t : null;
  } catch {
    return null;
  }
};
const writeUntil = (userId: string, iso: string | null) => {
  try {
    if (iso) sessionStorage.setItem(untilKey(userId), iso);
    else sessionStorage.removeItem(untilKey(userId));
  } catch {
    // storage unavailable: ignore
  }
};

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
  // Epoch ms of the server's available_until, null = off.
  const [endsAt, setEndsAt] = useState<number | null>(null);
  const [now, setNow] = useState(0);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [live, setLive] = useState<{ proposal: ApiProposal; skewMs: number } | null>(null);
  const [notice, setNotice] = useState<"expired" | "declined" | null>(null);
  const [responding, setResponding] = useState(false);
  const pollRef = useRef<(() => Promise<void>) | null>(null);
  const lastSeen = useRef<{ id: string; state: string } | null>(null);
  const router = useRouter();
  const userId = user?.id;

  // POST /api/proposal/:id/respond, then re-poll right away. A 409 just means it already ended: re-poll.
  const respond = async (proposalId: string, response: "accept" | "decline", reason?: "not_now" | "not_interested") => {
    if (responding || !userId) return;
    setResponding(true);
    setError(null);
    try {
      const res = await fetch(`/api/proposal/${proposalId}/respond`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ user_id: userId, response, ...(response === "decline" ? { reason } : {}) }),
      });
      if (!res.ok && res.status !== 409) {
        const body = await res.json().catch(() => null);
        throw new Error(body?.error ?? `Request failed (${res.status})`);
      }
      await pollRef.current?.();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't send your answer. Try again.");
    } finally {
      setResponding(false);
    }
  };

  // Coming back to this page: restore the window we remembered for this tab.
  useEffect(() => {
    if (userId) setEndsAt(readUntil(userId));
  }, [userId]);

  useEffect(() => {
    if (endsAt === null) return;
    const tick = () => setNow(Date.now());
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [endsAt]);

  const remaining = endsAt === null ? 0 : Math.max(0, endsAt - now);
  const on = endsAt !== null && remaining > 0;

  // While on, poll GET /api/proposal every 1.5s. Stops on toggle off / unmount.
  useEffect(() => {
    if (!on || !userId) {
      setLive(null);
      setNotice(null);
      return;
    }
    let cancelled = false;
    let inFlight = false;
    const poll = async () => {
      if (inFlight) return;
      inFlight = true;
      try {
        const res = await fetch(`/api/proposal?user_id=${encodeURIComponent(userId)}`, { cache: "no-store" });
        const body = await res.json().catch(() => null);
        if (cancelled || !res.ok || !body) return;
        if (body.proposal && isFinished(userId, body.proposal.id)) {
          // A plan the user already marked done: treat it as "no proposal" and keep searching.
          lastSeen.current = null;
          setLive(null);
        } else if (body.proposal) {
          setNotice(null);
          setLive({ proposal: body.proposal, skewMs: Date.parse(body.proposal.server_now) - Date.now() });
          // Go to the confirmed screen when a proposal we were watching becomes confirmed. (Landing here with
          // an already-confirmed one doesn't redirect, so Back from /nearby/confirmed isn't a trap.)
          const prev = lastSeen.current;
          if (prev && prev.id === body.proposal.id && prev.state !== "confirmed" && body.proposal.state === "confirmed") {
            router.push("/nearby/confirmed");
          }
          lastSeen.current = { id: body.proposal.id, state: body.proposal.state };
        } else {
          lastSeen.current = null;
          setLive(null);
          if (body.last_outcome) setNotice(body.last_outcome); // arrives once
          // The server says we're not on (e.g. after a sim reset): follow it.
          if (body.searching === false) {
            writeUntil(userId, null);
            setEndsAt(null);
          }
        }
      } catch {
        // network blip: the next tick retries
      } finally {
        inFlight = false;
      }
    };
    pollRef.current = poll;
    poll();
    const id = setInterval(poll, 1500);
    return () => {
      cancelled = true;
      pollRef.current = null;
      clearInterval(id);
    };
  }, [on, userId, router]);

  if (!user) return null;

  const durationLabel = DURATIONS.find((d) => d.minutes === minutes)!.label;

  // POST /api/presence turns it on (or restarts the window); the countdown follows available_until.
  const turnOn = async (mins: number) => {
    if (busy) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/presence", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ user_id: user.id, ...pinFor(user.id), minutes: mins }),
      });
      const body = await res.json().catch(() => null);
      if (!res.ok || !body?.active || !body.available_until) throw new Error(body?.error ?? `Request failed (${res.status})`);
      writeUntil(user.id, body.available_until);
      setNow(Date.now());
      setEndsAt(Date.parse(body.available_until));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't turn on Meet nearby. Try again.");
    } finally {
      setBusy(false);
    }
  };
  // DELETE /api/presence?user_id= turns it off.
  const turnOff = async () => {
    if (busy) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/presence?user_id=${encodeURIComponent(user.id)}`, { method: "DELETE" });
      const body = await res.json().catch(() => null);
      if (!res.ok || !body?.ok) throw new Error(body?.error ?? `Request failed (${res.status})`);
      writeUntil(user.id, null);
      setEndsAt(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't turn off Meet nearby. Try again.");
    } finally {
      setBusy(false);
    }
  };
  const toggle = () => (on ? turnOff() : turnOn(minutes));
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
          disabled={busy}
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

      <div className="mt-4 overflow-hidden rounded-xl border border-neutral-200">
        <Link href="/nearby/interests" className="flex items-center gap-3 p-4">
          <TagIcon className="text-neutral-700" />
          <span className="flex-1 font-semibold">Interests</span>
          <ChevronRightIcon className="text-neutral-400" />
        </Link>
        <Link href="/nearby/filters" className="flex items-center gap-3 border-t border-neutral-200 p-4">
          <SlidersIcon className="text-neutral-700" />
          <span className="flex-1 font-semibold">Filters</span>
          <ChevronRightIcon className="text-neutral-400" />
        </Link>
      </div>

      {error && (
        <p role="alert" className="mt-4 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">
          {error}
        </p>
      )}

      {on && notice && !live && (
        <p className="mt-4 rounded-lg bg-neutral-50 px-3 py-2 text-center text-sm text-neutral-600">
          {notice === "expired" ? "That suggestion expired." : "That suggestion didn't go through."} Looking for someone
          else...
        </p>
      )}
      {on && live && live.proposal.state === "confirmed" && (
        <Link
          href="/nearby/confirmed"
          className="mt-6 block rounded-2xl border border-neutral-200 bg-white p-4 text-center shadow-sm"
        >
          <p className="font-semibold">Your plan with {live.proposal.other.name} is confirmed</p>
          <p className="mt-1 text-sm font-semibold text-pink-600">View plan</p>
        </Link>
      )}
      {on && live && live.proposal.state !== "confirmed" && (
        <div className="mt-6">
          <ProposalCard
            key={live.proposal.id}
            proposal={live.proposal}
            skewMs={live.skewMs}
            busy={responding}
            onRespond={(r, reason) => respond(live.proposal.id, r, reason)}
          />
        </div>
      )}
      {on && !live && (
        <div className="mt-6 flex items-center justify-center gap-2 rounded-xl border border-dashed border-neutral-300 py-6 text-sm text-neutral-500">
          <span className="h-2 w-2 animate-pulse rounded-full bg-pink-500" />
          Searching for someone nearby...
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
