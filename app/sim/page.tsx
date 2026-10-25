"use client";

import { useEffect, useRef, useState } from "react";
import users from "@/data/mock/users.json";
import personas from "@/data/personas.json";
import venues from "@/data/venues.json";
import Avatar from "@/components/Avatar";

// Simulated location (SPEC section 2): no GPS, pins are dragged here. Not part of the Instagram UI,
// so this page is a wide desktop control panel outside the (ui) layout (no login, no bottom nav).

type Pin = { lat: number; lng: number };
type View = { latMin: number; latMax: number; lngMin: number; lngMax: number };

// Spans chosen so the 4:3 map is roughly square on the ground (1 deg lng ~ 0.86 deg lat in Austin).
const VIEWS: Record<"campus" | "wide", View & { label: string }> = {
  campus: { label: "Campus", latMin: 30.256, latMax: 30.296, lngMin: -97.766, lngMax: -97.704 },
  wide: { label: "Wide (all)", latMin: 30.25, latMax: 30.4, lngMin: -97.846, lngMax: -97.614 },
};

const PINS_KEY = "sim:pins";
const MILE_M = 1609.34;
const M_PER_DEG_LAT = 111320;

const defaultPins = (): Record<string, Pin> =>
  Object.fromEntries(personas.presence.map((p) => [p.user_id, { lat: p.lat, lng: p.lng }]));

function loadPins(): Record<string, Pin> {
  try {
    const raw = localStorage.getItem(PINS_KEY);
    return { ...defaultPins(), ...(raw ? JSON.parse(raw) : {}) };
  } catch {
    return defaultPins();
  }
}

function haversineMi(a: Pin, b: Pin) {
  const R = 3958.8;
  const rad = (d: number) => (d * Math.PI) / 180;
  const dLat = rad(b.lat - a.lat);
  const dLng = rad(b.lng - a.lng);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

const post = (url: string, body: unknown) =>
  fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) }).catch(() => {});

export default function SimPage() {
  const [pins, setPins] = useState<Record<string, Pin>>(defaultPins);
  const [loaded, setLoaded] = useState(false);
  const [viewKey, setViewKey] = useState<"campus" | "wide">("campus");
  const [selected, setSelected] = useState("maya");
  const [note, setNote] = useState("");
  const mapRef = useRef<HTMLDivElement>(null);
  const dragging = useRef<string | null>(null);
  const lastDragAt = useRef<Record<string, number>>({});
  const view = VIEWS[viewKey];

  useEffect(() => {
    // Load saved pins after mount (localStorage is not available during server render).
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setPins(loadPins());
    setLoaded(true);
  }, []);

  // Phones using real GPS: pull everyone's live position (GET /api/sim/presence) so their pins
  // move on this map. Only people who are "on" are followed, and not while being dragged here.
  useEffect(() => {
    let cancelled = false;
    const tick = async () => {
      try {
        const res = await fetch("/api/sim/presence", { cache: "no-store" });
        const rows = await res.json();
        if (cancelled || !Array.isArray(rows)) return;
        setPins((prev) => {
          let next = prev;
          for (const r of rows as { user_id: string; lat: number; lng: number; active: boolean }[]) {
            if (!r.active || dragging.current === r.user_id) continue;
            if (Date.now() - (lastDragAt.current[r.user_id] ?? 0) < 3000) continue; // just dragged here
            const cur = prev[r.user_id];
            if (cur && Math.abs(cur.lat - r.lat) < 1e-5 && Math.abs(cur.lng - r.lng) < 1e-5) continue;
            if (next === prev) next = { ...prev };
            next[r.user_id] = { lat: r.lat, lng: r.lng };
          }
          return next;
        });
      } catch {
        // server not reachable: keep the pins as they are
      }
    };
    tick();
    const id = setInterval(tick, 2000);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, []);

  const toPct = (p: Pin) => ({
    x: ((p.lng - view.lngMin) / (view.lngMax - view.lngMin)) * 100,
    y: ((view.latMax - p.lat) / (view.latMax - view.latMin)) * 100,
  });
  const inView = (p: Pin) => {
    const { x, y } = toPct(p);
    return x >= 0 && x <= 100 && y >= 0 && y <= 100;
  };

  function moveTo(id: string, clientX: number, clientY: number) {
    const rect = mapRef.current?.getBoundingClientRect();
    if (!rect) return;
    const fx = Math.min(1, Math.max(0, (clientX - rect.left) / rect.width));
    const fy = Math.min(1, Math.max(0, (clientY - rect.top) / rect.height));
    const lng = view.lngMin + fx * (view.lngMax - view.lngMin);
    const lat = view.latMax - fy * (view.latMax - view.latMin);
    setPins((prev) => ({ ...prev, [id]: { lat: +lat.toFixed(5), lng: +lng.toFixed(5) } }));
  }

  function endDrag(id: string) {
    dragging.current = null;
    lastDragAt.current[id] = Date.now();
    const p = pinsRef.current[id];
    try {
      localStorage.setItem(PINS_KEY, JSON.stringify(pinsRef.current));
    } catch {
      // storage unavailable: pins just won't survive a refresh
    }
    // Backend (POST /api/presence) may not exist yet; failures are ignored.
    post("/api/presence", { user_id: id, lat: p.lat, lng: p.lng });
  }

  // Latest pins for the pointerup handler (state in the closure would be one render behind).
  const pinsRef = useRef(pins);
  useEffect(() => {
    pinsRef.current = pins;
  }, [pins]);

  async function reset() {
    try {
      localStorage.removeItem(PINS_KEY);
    } catch {
      // ignore
    }
    setPins(defaultPins());
    await post("/api/sim/reset", {});
    setNote("Pins reset. Backend reset sent (ignored until /api/sim/reset exists).");
  }

  const me = pins[selected];
  const radiusMi = 1; // SPEC default radius
  const rxPct = ((radiusMi * MILE_M) / (M_PER_DEG_LAT * Math.cos((me.lat * Math.PI) / 180)) / (view.lngMax - view.lngMin)) * 100;
  const ryPct = ((radiusMi * MILE_M) / M_PER_DEG_LAT / (view.latMax - view.latMin)) * 100;
  const center = toPct(me);

  return (
    <div className="min-h-dvh bg-neutral-50 p-4 text-neutral-900 sm:p-6">
      <div className="mx-auto max-w-5xl">
        <div className="flex flex-wrap items-center gap-3">
          <h1 className="bg-gradient-to-r from-pink-500 via-purple-500 to-orange-400 bg-clip-text text-2xl font-semibold text-transparent">
            Nearby sim
          </h1>
          <p className="flex-1 text-sm text-neutral-500">Drag pins to move people. The circle is the selected user&apos;s 1 mi radius.</p>
          <div className="flex overflow-hidden rounded-lg border border-neutral-300 text-sm">
            {(Object.keys(VIEWS) as (keyof typeof VIEWS)[]).map((k) => (
              <button
                key={k}
                onClick={() => setViewKey(k)}
                className={`px-3 py-1.5 ${viewKey === k ? "bg-neutral-900 text-white" : "bg-white"}`}
              >
                {VIEWS[k].label}
              </button>
            ))}
          </div>
          <button onClick={reset} className="rounded-lg border border-red-300 bg-white px-3 py-1.5 text-sm font-semibold text-red-600">
            Reset
          </button>
        </div>
        {note && <p className="mt-2 text-xs text-neutral-500">{note}</p>}

        <div className="mt-4 grid gap-4 md:grid-cols-[1fr_300px]">
          <div
            ref={mapRef}
            className="relative aspect-[4/3] w-full touch-none select-none overflow-hidden rounded-xl border border-neutral-200 bg-[linear-gradient(#e5e5e5_1px,transparent_1px),linear-gradient(90deg,#e5e5e5_1px,transparent_1px)] bg-[length:10%_10%] bg-white"
            onPointerMove={(e) => dragging.current && moveTo(dragging.current, e.clientX, e.clientY)}
            onPointerUp={() => dragging.current && endDrag(dragging.current)}
            onPointerCancel={() => dragging.current && endDrag(dragging.current)}
          >
            {venues.filter(inView).map((v) => {
              const { x, y } = toPct({ lat: v.lat, lng: v.lng });
              return (
                <div
                  key={v.id}
                  title={`${v.name} (${v.category})`}
                  className="absolute h-2 w-2 -translate-x-1/2 -translate-y-1/2 rounded-full bg-neutral-300"
                  style={{ left: `${x}%`, top: `${y}%` }}
                />
              );
            })}

            {loaded && inView(me) && (
              <div
                className="pointer-events-none absolute -translate-x-1/2 -translate-y-1/2 rounded-full border border-pink-400 bg-pink-400/10"
                style={{ left: `${center.x}%`, top: `${center.y}%`, width: `${rxPct * 2}%`, height: `${ryPct * 2}%` }}
              />
            )}

            {users.filter((u) => inView(pins[u.id])).map((u) => {
              const { x, y } = toPct(pins[u.id]);
              const isSel = u.id === selected;
              return (
                <div
                  key={u.id}
                  className={`absolute flex -translate-x-1/2 -translate-y-1/2 cursor-grab flex-col items-center active:cursor-grabbing ${isSel ? "z-20" : "z-10"}`}
                  style={{ left: `${x}%`, top: `${y}%` }}
                  onPointerDown={(e) => {
                    e.currentTarget.setPointerCapture(e.pointerId);
                    dragging.current = u.id;
                    setSelected(u.id);
                  }}
                >
                  <Avatar src={u.avatar_url} name={u.name} size={36} ring={isSel} />
                  <span className="mt-0.5 rounded bg-white/90 px-1 text-[10px] font-medium shadow-sm">{u.name}</span>
                </div>
              );
            })}
          </div>

          <ul className="divide-y divide-neutral-200 self-start rounded-xl border border-neutral-200 bg-white">
            {users.map((u) => {
              const mi = u.id === selected ? null : haversineMi(me, pins[u.id]);
              return (
                <li
                  key={u.id}
                  onClick={() => setSelected(u.id)}
                  className={`flex cursor-pointer items-center gap-2 px-3 py-2 ${u.id === selected ? "bg-pink-50" : ""}`}
                >
                  <Avatar src={u.avatar_url} name={u.name} size={32} />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold">{u.name}</p>
                    <p className="text-xs text-neutral-500">
                      {mi === null ? "selected" : `${mi.toFixed(2)} mi away`}
                      {!inView(pins[u.id]) && " · off-map"}
                    </p>
                  </div>
                  <a
                    href={`/?as=${u.id}`}
                    target="_blank"
                    rel="noreferrer"
                    onClick={(e) => e.stopPropagation()}
                    className="rounded-md bg-gradient-to-r from-pink-500 to-purple-500 px-2.5 py-1 text-xs font-semibold text-white"
                  >
                    Open as
                  </a>
                </li>
              );
            })}
          </ul>
        </div>
      </div>
    </div>
  );
}
