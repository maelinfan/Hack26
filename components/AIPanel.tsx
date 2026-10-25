"use client";

import { useState } from "react";
import Link from "next/link";
import { ChevronDownIcon } from "@/components/Icons";
import { loadInterests } from "@/components/nearbyPrefs";
import { useUserId } from "@/components/useSession";

// Matches SPEC.md section 6 `tool_calls`.
export type ToolCall = { step: number; tool: string; args: Record<string, unknown>; result: unknown };

export type AIPanelProposal = {
  why: string;
  shared_tags: string[];
  score?: number | null;
  tool_calls?: ToolCall[] | null;
};

const timeFmt = (iso: unknown) =>
  typeof iso === "string" ? new Date(iso).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" }) : "?";

const oneLine = (v: unknown): string => {
  if (v && typeof v === "object" && !Array.isArray(v)) {
    return Object.entries(v)
      .map(([k, x]) => `${k}: ${typeof x === "string" ? x : JSON.stringify(x)}`)
      .join(", ");
  }
  return JSON.stringify(v);
};

function summarizeResult(c: ToolCall): string {
  const r = c.result as Record<string, unknown> | unknown[] | null;
  if (c.tool === "get_nearby_venues" && Array.isArray(r)) return `${r.length} venue${r.length === 1 ? "" : "s"} found`;
  if (c.tool === "get_open_hours" && r && !Array.isArray(r)) {
    return r.open ? `open until ${timeFmt(r.closes_at)}` : "closed";
  }
  if (c.tool === "propose_plan" && r && !Array.isArray(r)) return r.ok ? "plan proposed" : "plan rejected";
  return JSON.stringify(c.result);
}

export default function AIPanel({ proposal }: { proposal: AIPanelProposal }) {
  const [open, setOpen] = useState(false);
  const userId = useUserId();
  const interests = userId ? loadInterests(userId) : [];
  const calls = proposal.tool_calls;

  return (
    <div className="rounded-2xl border border-neutral-200 bg-white">
      <button
        onClick={() => setOpen(!open)}
        aria-expanded={open}
        className="flex w-full items-center justify-between p-4 text-left"
      >
        <span className="font-semibold">How AI picked this</span>
        <ChevronDownIcon className={`text-neutral-500 transition-transform ${open ? "rotate-180" : ""}`} />
      </button>

      {open && (
        <div className="space-y-5 border-t border-neutral-200 p-4">
          <section>
            <Heading>Extracted tags</Heading>
            {interests.length ? (
              <div className="mt-2 flex flex-wrap gap-2">
                {interests.map((t) => (
                  <Chip key={t}>{t}</Chip>
                ))}
              </div>
            ) : (
              <p className="mt-2 text-sm text-neutral-500">
                No interests yet.{" "}
                <Link href="/nearby/interests" className="font-semibold text-pink-600">
                  Add some
                </Link>
              </p>
            )}
          </section>

          <section>
            <Heading>Match reasoning</Heading>
            <p className="mt-2 text-sm text-neutral-800">{proposal.why}</p>
            {proposal.shared_tags.length > 0 && (
              <div className="mt-2 flex flex-wrap gap-2">
                {proposal.shared_tags.map((t) => (
                  <Chip key={t}>#{t}</Chip>
                ))}
              </div>
            )}
            {proposal.score != null && (
              <p className="mt-2 text-xs text-neutral-500">
                Match score: <span className="font-semibold text-neutral-800">{proposal.score.toFixed(2)}</span>
              </p>
            )}
          </section>

          {calls && (
            <section>
              <Heading>Venue agent</Heading>
              <ol className="mt-2 space-y-2">
                {calls.map((c) => (
                  <Step key={c.step} call={c} />
                ))}
              </ol>
            </section>
          )}
        </div>
      )}
    </div>
  );
}

function Step({ call }: { call: ToolCall }) {
  const [open, setOpen] = useState(false);
  return (
    <li className="rounded-lg bg-neutral-50">
      <button onClick={() => setOpen(!open)} aria-expanded={open} className="flex w-full items-start gap-3 p-3 text-left">
        <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-gradient-to-tr from-pink-500 to-purple-600 text-xs font-semibold text-white">
          {call.step}
        </span>
        <span className="min-w-0 flex-1">
          <span className="block font-mono text-sm font-semibold">{call.tool}</span>
          <span className="block truncate text-xs text-neutral-500">{oneLine(call.args)}</span>
          <span className="block text-xs text-neutral-800">&rarr; {summarizeResult(call)}</span>
        </span>
        <ChevronDownIcon className={`shrink-0 text-neutral-400 transition-transform ${open ? "rotate-180" : ""}`} />
      </button>
      {open && (
        <div className="space-y-2 px-3 pb-3">
          <Json label="args" value={call.args} />
          <Json label="result" value={call.result} />
        </div>
      )}
    </li>
  );
}

const Json = ({ label, value }: { label: string; value: unknown }) => (
  <div>
    <p className="text-[10px] font-semibold uppercase tracking-wide text-neutral-500">{label}</p>
    <pre className="mt-1 overflow-x-auto rounded-md bg-white p-2 text-[11px] leading-snug text-neutral-800">
      {JSON.stringify(value, null, 2)}
    </pre>
  </div>
);

const Heading = ({ children }: { children: string }) => (
  <p className="text-xs font-semibold uppercase tracking-wide text-neutral-500">{children}</p>
);

const Chip = ({ children }: { children: React.ReactNode }) => (
  <span className="rounded-full bg-neutral-100 px-3 py-1 text-xs font-semibold text-neutral-700">{children}</span>
);
