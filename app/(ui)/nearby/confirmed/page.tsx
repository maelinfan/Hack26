"use client";

import { useEffect, useState, type ReactNode } from "react";
import Link from "next/link";
import AIPanel from "@/components/AIPanel";
import Avatar from "@/components/Avatar";
import { CheckBadgeIcon, ChevronLeftIcon, ShieldCheckIcon, StarIcon } from "@/components/Icons";
import type { ApiProposal, Venue } from "@/components/ProposalCard";
import { useCurrentUser } from "@/components/useSession";
import users from "@/data/mock/users.json";

const gradientBtn = "rounded-lg bg-gradient-to-r from-pink-500 to-purple-600 text-sm font-semibold text-white";
const outlineBtn = "rounded-lg border border-neutral-300 text-sm font-semibold text-neutral-700";
const card = "mt-4 rounded-2xl border border-neutral-200 bg-white p-4";

const REPORT_REASONS = ["Made me uncomfortable", "Fake or misleading profile", "Inappropriate behavior", "Other"];

function formatTime(iso: string) {
  return new Date(iso).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
}

const Header = () => (
  <div className="sticky top-0 z-10 flex items-center border-b border-neutral-200 bg-white px-2 py-2">
    <Link href="/nearby" aria-label="Back" className="p-2">
      <ChevronLeftIcon />
    </Link>
    <h1 className="flex-1 pr-10 text-center text-base font-semibold">Confirmed</h1>
  </div>
);

// "loading" until the first poll lands, then the latest proposal (null = none).
type Loaded = { proposal: ApiProposal | null } | "loading";

export default function ConfirmedPage() {
  const user = useCurrentUser();
  const userId = user?.id;
  const [data, setData] = useState<Loaded>("loading");

  // Poll GET /api/proposal until the plan is confirmed (it stays visible while the user is on).
  useEffect(() => {
    if (!userId) return;
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout>;
    const poll = async () => {
      let done = false;
      try {
        const res = await fetch(`/api/proposal?user_id=${encodeURIComponent(userId)}`, { cache: "no-store" });
        const body = await res.json().catch(() => null);
        if (!cancelled && res.ok && body) {
          setData({ proposal: body.proposal ?? null });
          done = body.proposal?.state === "confirmed" || !body.proposal;
        }
      } catch {
        // retry on the next tick
      }
      if (!cancelled && !done) timer = setTimeout(poll, 1500);
    };
    poll();
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [userId]);

  if (!user) return null;

  const proposal = data === "loading" ? null : data.proposal;
  if (!proposal || proposal.state !== "confirmed" || !proposal.venue) {
    const planning = proposal?.state === "both_accepted";
    return (
      <div>
        <Header />
        <div className="px-4 pt-16 text-center">
          <p className="font-semibold">
            {data === "loading" ? "Loading..." : planning ? "Finding a spot..." : "No confirmed plan yet"}
          </p>
          <p className="mt-1 text-sm text-neutral-500">
            {planning
              ? "You both said yes. Picking a public place."
              : data === "loading"
                ? ""
                : "Turn on Meet nearby and accept a match to get a plan."}
          </p>
          {data !== "loading" && !planning && (
            <Link href="/nearby" className="mt-4 inline-block text-sm font-semibold text-pink-600">
              Back to Meet nearby
            </Link>
          )}
        </div>
      </div>
    );
  }

  const { other, venue, plan_reason, icebreakers } = proposal;

  return (
    <div className="pb-8">
      <Header />

      <div className="px-4">
        <div className="flex flex-col items-center pt-6">
          <div className="flex items-center">
            <Avatar src={user.avatar_url} name={user.name} size={80} ring />
            <div className="-ml-3">
              <Avatar src={other.avatar_url} name={other.name} size={80} ring />
            </div>
          </div>
          <h2 className="mt-4 text-xl font-semibold">You&apos;re meeting {other.name}</h2>
          <p className="mt-1 flex items-center gap-1 text-sm text-neutral-500">
            @{other.handle}
            {other.verified && (
              <span className="flex items-center gap-1 text-sky-500">
                <CheckBadgeIcon />
                <span className="text-xs font-semibold">Verified</span>
              </span>
            )}
          </p>
        </div>

        <VenueCard venue={venue} />

        <section className={card}>
          <p className="text-xs font-semibold uppercase tracking-wide text-neutral-500">Why this spot</p>
          <p className="mt-1 text-sm text-neutral-800">{plan_reason ?? ""}</p>
        </section>

        <IcebreakerCard options={icebreakers} />
        <SafetySection otherName={other.name} venueName={venue.name} excludeIds={[user.id, users.find((u) => u.handle === other.handle)?.id ?? ""]} />
        <FeedbackButton />

        <div className="mt-6">
          <AIPanel proposal={{ why: proposal.why, shared_tags: proposal.shared_tags, tool_calls: proposal.tool_calls }} />
        </div>
      </div>
    </div>
  );
}

function VenueCard({ venue }: { venue: Venue }) {
  return (
    <section className="mt-6 overflow-hidden rounded-2xl border border-neutral-200 bg-white">
      <MiniMap />
      <div className="p-4">
        <p className="text-lg font-semibold">{venue.name}</p>
        <p className="text-sm capitalize text-neutral-500">{venue.category}</p>
        <p className="mt-2 text-sm text-neutral-800">{venue.address}</p>
        <p className="mt-1 text-sm font-semibold text-green-600">Open until {formatTime(venue.open_until)}</p>
        <a
          href={`https://www.google.com/maps/search/?api=1&query=${venue.lat},${venue.lng}`}
          target="_blank"
          rel="noopener noreferrer"
          className={`mt-3 block py-2 text-center ${outlineBtn}`}
        >
          Open in Maps
        </a>
        <p className="mt-3 flex items-start gap-2 text-xs text-neutral-500">
          <ShieldCheckIcon className="shrink-0" />
          <span>This is a public place. Meet in the open, and leave any time you feel uncomfortable.</span>
        </p>
      </div>
    </section>
  );
}

/** Decorative stand-in for a real map: streets, a park, and a pin. */
function MiniMap() {
  return (
    <svg viewBox="0 0 400 160" className="block w-full bg-neutral-100" role="img" aria-label="Map of the venue area">
      <rect x="250" y="20" width="110" height="60" rx="10" fill="#dcfce7" />
      <path d="M0 110 Q120 90 200 100 T400 70" fill="none" stroke="#bae6fd" strokeWidth="14" />
      <g stroke="#fff" strokeWidth="8" fill="none">
        <path d="M0 40h400M0 130h400M80 0v160M200 0v160M320 0v160" />
        <path d="M0 160 400 0" strokeWidth="6" />
      </g>
      <g transform="translate(200 78)">
        <ellipse cx="0" cy="22" rx="9" ry="3" fill="rgba(0,0,0,0.15)" />
        <path d="M0 22C-14 6-18-2-18-10a18 18 0 0 1 36 0C18-2 14 6 0 22z" fill="#ec4899" />
        <circle cy="-10" r="6" fill="#fff" />
      </g>
    </svg>
  );
}

function IcebreakerCard({ options }: { options: string[] }) {
  return (
    <section className={card}>
      <p className="text-xs font-semibold uppercase tracking-wide text-neutral-500">Conversation starters</p>
      <p className="mt-1 text-xs text-neutral-500">Say one out loud when you meet. Keep the phone in your pocket.</p>
      <ul className="mt-3 space-y-2">
        {options.map((o) => (
          <li key={o} className="rounded-xl bg-neutral-50 px-3 py-2.5 text-sm italic text-neutral-800">
            &ldquo;{o}&rdquo;
          </li>
        ))}
      </ul>
    </section>
  );
}

type Confirm = "report" | "block" | null;

type Status = "on_my_way" | "arrived" | "heading_home";
const STATUSES: { value: Status; label: string }[] = [
  { value: "on_my_way", label: "On my way" },
  { value: "arrived", label: "I’ve arrived" },
  { value: "heading_home", label: "Heading home" },
];

function SafetySection({ otherName, venueName, excludeIds }: { otherName: string; venueName: string; excludeIds: string[] }) {
  // Mock "close friends": anyone who isn't me or the person I'm meeting.
  const friends = users.filter((u) => !excludeIds.includes(u.id)).slice(0, 4);
  const [friend, setFriend] = useState<string | null>(null);
  const [custom, setCustom] = useState(false);
  const [handle, setHandle] = useState("");
  const [sentTo, setSentTo] = useState<string | null>(null);
  const [note, setNote] = useState<string | null>(null);
  const [status, setStatus] = useState<Status | null>(null);
  const [confirm, setConfirm] = useState<Confirm>(null);
  const [reason, setReason] = useState<string | null>(null);
  const [done, setDone] = useState<string | null>(null);

  const target = custom ? handle.trim().replace(/^@/, "") : friend;
  const send = () => {
    if (!target) return;
    setSentTo(target);
    setNote("Sent!");
  };
  const sendUpdate = () => setNote("Updated just now");
  const pickStatus = (s: Status) => {
    const next = status === s ? null : s;
    setStatus(next);
    if (sentTo && next) setNote(`Updated: ${STATUSES.find((x) => x.value === next)!.label}`);
  };
  const closeSheet = () => {
    setConfirm(null);
    setReason(null);
  };
  const submitConfirm = () => {
    setDone(confirm === "report" ? `Thanks, we've received your report about ${otherName}.` : `${otherName} is blocked.`);
    closeSheet();
  };

  return (
    <section className={card}>
      <p className="text-xs font-semibold uppercase tracking-wide text-neutral-500">Safety</p>

      <p className="mt-3 text-sm font-semibold">Share my plans</p>
      <p className="mt-0.5 text-xs text-neutral-500">
        Your friend sees who you&apos;re meeting ({otherName}), {venueName} and the time, plus any status updates below. Never your
        live location.
      </p>

      {sentTo ? (
        <div className="mt-3 rounded-lg bg-neutral-50 p-3">
          <p className="flex items-center gap-2 text-sm font-semibold">
            <ShieldCheckIcon className="text-green-600" />
            {note} · @{sentTo}
          </p>
          <button onClick={sendUpdate} className={`mt-3 w-full py-2 ${outlineBtn}`}>
            Send update
          </button>
        </div>
      ) : (
        <div className="mt-3">
          <div className="flex flex-wrap gap-2">
            {friends.map((f) => (
              <button
                key={f.id}
                onClick={() => {
                  setCustom(false);
                  setFriend(f.handle);
                }}
                className={`flex items-center gap-2 rounded-full border py-1 pl-1 pr-3 text-sm ${
                  !custom && friend === f.handle ? "border-pink-500 font-semibold" : "border-neutral-300"
                }`}
              >
                <Avatar src={f.avatar_url} name={f.name} size={24} />
                {f.name}
              </button>
            ))}
            <button
              onClick={() => setCustom(true)}
              className={`rounded-full border px-3 py-1 text-sm ${custom ? "border-pink-500 font-semibold" : "border-neutral-300"}`}
            >
              Someone else
            </button>
          </div>
          {custom && (
            <input
              autoFocus
              value={handle}
              onChange={(e) => setHandle(e.target.value)}
              placeholder="Friend's handle"
              className="mt-2 w-full rounded-lg border border-neutral-300 px-3 py-2 text-sm outline-none focus:border-neutral-500"
            />
          )}
          <button onClick={send} disabled={!target} className={`mt-3 w-full py-2.5 disabled:opacity-40 ${gradientBtn}`}>
            {target ? `Send to @${target}` : "Choose who to send to"}
          </button>
        </div>
      )}

      <p className="mt-5 text-sm font-semibold">Where are you?</p>
      <div className="mt-2 grid grid-cols-3 rounded-lg bg-neutral-100 p-1">
        {STATUSES.map((s) => (
          <button
            key={s.value}
            onClick={() => pickStatus(s.value)}
            className={`rounded-md px-1 py-2 text-xs font-semibold ${status === s.value ? "bg-white shadow-sm" : "text-neutral-500"}`}
          >
            {s.label}
          </button>
        ))}
      </div>
      <p className="mt-1.5 text-xs text-neutral-500">
        {sentTo ? `@${sentTo} gets a heads-up each time you change this.` : "Send your plans to a friend and they'll get these updates."}
      </p>


      <div className="mt-3 grid grid-cols-2 gap-2">
        <button onClick={() => setConfirm("report")} className={`py-2 ${outlineBtn}`}>
          Report
        </button>
        <button onClick={() => setConfirm("block")} className={`py-2 text-red-600 ${outlineBtn}`}>
          Block
        </button>
      </div>
      {done && <p className="mt-3 text-center text-xs text-neutral-500">{done}</p>}

      {confirm && (
        <Sheet onClose={closeSheet} title={confirm === "report" ? `Report ${otherName}` : `Block ${otherName}?`}>
          {confirm === "report" ? (
            <div className="mt-3 space-y-2">
              {REPORT_REASONS.map((r) => (
                <button
                  key={r}
                  onClick={() => setReason(r)}
                  className={`w-full rounded-lg border px-3 py-2.5 text-left text-sm ${
                    reason === r ? "border-pink-500 font-semibold" : "border-neutral-300"
                  }`}
                >
                  {r}
                </button>
              ))}
            </div>
          ) : (
            <p className="mt-2 text-sm text-neutral-600">
              You won&apos;t be matched with {otherName} again, and they won&apos;t be able to see that you blocked them.
            </p>
          )}
          <div className="mt-4 grid grid-cols-2 gap-2">
            <button onClick={closeSheet} className={`py-2.5 ${outlineBtn}`}>
              Cancel
            </button>
            <button
              onClick={submitConfirm}
              disabled={confirm === "report" && !reason}
              className={`py-2.5 disabled:opacity-40 ${gradientBtn}`}
            >
              {confirm === "report" ? "Submit report" : "Block"}
            </button>
          </div>
        </Sheet>
      )}
    </section>
  );
}

function FeedbackButton() {
  const [open, setOpen] = useState(false);
  const [met, setMet] = useState<boolean | null>(null);
  const [rating, setRating] = useState(0);
  const [note, setNote] = useState("");
  const [submitted, setSubmitted] = useState(false);

  return (
    <>
      <button onClick={() => setOpen(true)} className={`mt-6 w-full py-3 ${gradientBtn}`}>
        Meetup done?
      </button>
      {open && (
        <Sheet onClose={() => setOpen(false)} title={submitted ? "Thank you!" : "How did it go?"}>
          {submitted ? (
            <>
              <p className="mt-2 text-sm text-neutral-600">Your feedback helps us make future meetups better and safer.</p>
              <button onClick={() => setOpen(false)} className={`mt-4 w-full py-2.5 ${gradientBtn}`}>
                Close
              </button>
            </>
          ) : (
            <>
              <p className="mt-3 text-sm font-semibold">Did you meet?</p>
              <div className="mt-2 grid grid-cols-2 gap-2">
                {[true, false].map((v) => (
                  <button
                    key={String(v)}
                    onClick={() => setMet(v)}
                    className={`rounded-lg border py-2 text-sm font-semibold ${
                      met === v ? "border-pink-500 text-pink-600" : "border-neutral-300 text-neutral-700"
                    }`}
                  >
                    {v ? "Yes" : "No"}
                  </button>
                ))}
              </div>
              <p className="mt-4 text-sm font-semibold">Rate it</p>
              <div className="mt-1 flex gap-1">
                {[1, 2, 3, 4, 5].map((n) => (
                  <button key={n} onClick={() => setRating(n)} aria-label={`${n} star${n > 1 ? "s" : ""}`}>
                    <StarIcon filled={n <= rating} className={n <= rating ? "text-pink-500" : "text-neutral-300"} />
                  </button>
                ))}
              </div>
              <textarea
                value={note}
                onChange={(e) => setNote(e.target.value)}
                placeholder="Anything else? (optional)"
                rows={3}
                className="mt-4 w-full resize-none rounded-lg border border-neutral-300 px-3 py-2 text-sm outline-none focus:border-neutral-500"
              />
              <button
                onClick={() => setSubmitted(true)}
                disabled={met === null || rating === 0}
                className={`mt-3 w-full py-2.5 disabled:opacity-40 ${gradientBtn}`}
              >
                Submit
              </button>
            </>
          )}
        </Sheet>
      )}
    </>
  );
}

function Sheet({ title, onClose, children }: { title: string; onClose: () => void; children: ReactNode }) {
  return (
    <div className="fixed inset-0 z-30 flex items-end justify-center bg-black/40" onClick={onClose}>
      <div
        role="dialog"
        aria-label={title}
        onClick={(e) => e.stopPropagation()}
        className="max-h-[90vh] w-full max-w-[430px] overflow-y-auto rounded-t-2xl bg-white p-4 pb-6"
      >
        <div className="mx-auto mb-3 h-1 w-10 rounded-full bg-neutral-300" />
        <h3 className="text-base font-semibold">{title}</h3>
        {children}
      </div>
    </div>
  );
}
