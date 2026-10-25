"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import SubHeader from "@/components/SubHeader";
import { CheckIcon } from "@/components/Icons";
import { useCurrentUser } from "@/components/useSession";
import {
  FOLLOW_OPTIONS,
  GENDER_OPTIONS,
  MAX_AGE,
  MIN_AGE,
  loadFilters,
  saveFilters,
  type Filters,
} from "@/components/nearbyPrefs";

const RADIUS_STEPS = [0.25, 0.5, 0.75, 1];

function toggle(list: string[], v: string) {
  return list.includes(v) ? list.filter((x) => x !== v) : [...list, v];
}

function Chips({ options, value, onChange }: { options: { value: string; label: string }[]; value: string[]; onChange: (v: string[]) => void }) {
  return (
    <div className="mt-2 flex flex-wrap gap-2">
      {options.map((o) => {
        const on = value.includes(o.value);
        return (
          <button
            key={o.value}
            onClick={() => onChange(toggle(value, o.value))}
            aria-pressed={on}
            className={`flex items-center gap-1.5 rounded-full border px-3.5 py-1.5 text-sm font-semibold ${
              on ? "border-transparent bg-gradient-to-r from-pink-500 to-purple-600 text-white" : "border-neutral-300 text-neutral-700"
            }`}
          >
            {on && <CheckIcon />}
            {o.label}
          </button>
        );
      })}
    </div>
  );
}

function Slider({ label, value, min, max, step = 1, onChange }: { label: string; value: number; min: number; max: number; step?: number; onChange: (n: number) => void }) {
  return (
    <label className="mt-3 flex items-center gap-3 text-sm">
      <span className="w-10 text-neutral-500">{label}</span>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="h-1 flex-1 accent-pink-500"
      />
      <span className="w-8 text-right font-semibold tabular-nums">{value}</span>
    </label>
  );
}

function Editor({ userId }: { userId: string }) {
  const router = useRouter();
  const [f, setF] = useState<Filters>(() => loadFilters(userId));
  const set = (patch: Partial<Filters>) => setF((p) => ({ ...p, ...patch }));

  const valid = f.genders.length > 0 && f.follow_statuses.length > 0 && f.radius_mi !== null;
  const save = () => {
    saveFilters(userId, f);
    router.back();
  };

  return (
    <>
      <SubHeader title="Filters" onSave={save} canSave={valid} />
      <div className="px-4 py-6">
        <div className="flex items-baseline justify-between">
          <p className="text-sm font-semibold">Age range</p>
          <p className="text-sm text-neutral-500">
            {f.age_min} – {f.age_max}
          </p>
        </div>
        <Slider label="Min" value={f.age_min} min={MIN_AGE} max={MAX_AGE} onChange={(n) => set({ age_min: n, age_max: Math.max(n, f.age_max) })} />
        <Slider label="Max" value={f.age_max} min={MIN_AGE} max={MAX_AGE} onChange={(n) => set({ age_max: n, age_min: Math.min(n, f.age_min) })} />
        <p className="mt-1 text-xs text-neutral-400">Meet nearby is 18+ only.</p>

        <div className="mt-8 flex items-baseline justify-between">
          <p className="text-sm font-semibold">Open to meeting</p>
          <p className="text-xs text-neutral-500">Select all that apply</p>
        </div>
        <Chips options={GENDER_OPTIONS} value={f.genders} onChange={(genders) => set({ genders })} />

        <div className="mt-8 flex items-baseline justify-between">
          <p className="text-sm font-semibold">People I&apos;m connected to</p>
          <p className="text-xs text-neutral-500">Select all that apply</p>
        </div>
        <Chips options={FOLLOW_OPTIONS} value={f.follow_statuses} onChange={(follow_statuses) => set({ follow_statuses })} />

        <div className="mt-8 flex items-baseline justify-between">
          <p className="text-sm font-semibold">Max distance</p>
          <p className="text-sm text-neutral-500">{f.radius_mi === null ? "Slide to set" : `${f.radius_mi} mi`}</p>
        </div>
        <input
          type="range"
          aria-label="Max distance"
          min={0}
          max={RADIUS_STEPS.length - 1}
          step={1}
          value={f.radius_mi === null ? 0 : RADIUS_STEPS.indexOf(f.radius_mi)}
          onChange={(e) => set({ radius_mi: RADIUS_STEPS[Number(e.target.value)] })}
          // Also set on a plain tap of the thumb, which fires no change event.
          onPointerUp={(e) => set({ radius_mi: RADIUS_STEPS[Number(e.currentTarget.value)] })}
          className={`mt-3 h-1 w-full accent-pink-500 ${f.radius_mi === null ? "opacity-40" : ""}`}
        />
        <div className="mt-1 flex justify-between text-xs text-neutral-400">
          {RADIUS_STEPS.map((r) => (
            <span key={r}>{r} mi</span>
          ))}
        </div>

        {!valid && <p className="mt-6 text-sm text-red-500">Pick at least one option for each group.</p>}
      </div>
    </>
  );
}

export default function FiltersPage() {
  const user = useCurrentUser();
  if (!user) return null;
  return <Editor userId={user.id} />;
}
