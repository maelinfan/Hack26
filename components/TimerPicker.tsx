"use client";

import { useEffect, useRef } from "react";

const ITEM = 40; // px per row
const ROWS = 5; // visible rows; the middle one is selected

function Wheel({ value, max, unit, onChange }: { value: number; max: number; unit: string; onChange: (n: number) => void }) {
  const ref = useRef<HTMLDivElement>(null);

  // Keep the scroll position in step with the value (first render, or changed from outside).
  useEffect(() => {
    const el = ref.current;
    if (el && Math.round(el.scrollTop / ITEM) !== value) el.scrollTop = value * ITEM;
  }, [value]);

  const onScroll = () => {
    const el = ref.current;
    if (!el) return;
    const i = Math.min(max, Math.max(0, Math.round(el.scrollTop / ITEM)));
    if (i !== value) onChange(i);
  };

  return (
    <div className="flex items-center gap-1">
      <div
        ref={ref}
        onScroll={onScroll}
        role="listbox"
        aria-label={unit}
        className="w-14 snap-y snap-mandatory overflow-y-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
        style={{ height: ITEM * ROWS }}
      >
        <div style={{ paddingTop: ITEM * 2, paddingBottom: ITEM * 2 }}>
          {Array.from({ length: max + 1 }, (_, i) => (
            <button
              key={i}
              type="button"
              role="option"
              aria-selected={i === value}
              onClick={() => ref.current?.scrollTo({ top: i * ITEM, behavior: "smooth" })}
              className={`flex w-full snap-center items-center justify-end pr-2 text-xl tabular-nums ${
                i === value ? "font-semibold text-neutral-900" : "text-neutral-400"
              }`}
              style={{ height: ITEM }}
            >
              {i}
            </button>
          ))}
        </div>
      </div>
      <span className="text-sm font-semibold">{unit}</span>
    </div>
  );
}

/** iPhone-timer style picker: an hours wheel and a minutes wheel. `minutes` is the total. */
export default function TimerPicker({ minutes, onChange }: { minutes: number; onChange: (total: number) => void }) {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return (
    <div className="relative mt-2 flex items-center justify-center gap-6 rounded-xl border border-neutral-200 py-2">
      {/* Highlight band behind the selected row. */}
      <div
        className="pointer-events-none absolute inset-x-3 rounded-lg bg-neutral-100"
        style={{ height: ITEM, top: "50%", transform: "translateY(-50%)" }}
      />
      <div className="relative">
        <Wheel value={h} max={23} unit="hr" onChange={(n) => onChange(n * 60 + m)} />
      </div>
      <div className="relative">
        <Wheel value={m} max={59} unit="min" onChange={(n) => onChange(h * 60 + n)} />
      </div>
    </div>
  );
}
