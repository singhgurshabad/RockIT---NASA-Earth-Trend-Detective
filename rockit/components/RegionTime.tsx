"use client";

import { useEffect, useState } from "react";
import { getRegions, type ApiRegion } from "@/lib/api";
import { MAX_DATE, MIN_DATE, REGIONS, timeError } from "@/lib/constants";
import type { Selection } from "@/lib/types";
import Globe from "./Globe";

const field = "w-full rounded-lg border-2 border-line bg-page p-2 text-[17px] text-ink";

export default function RegionTime({
  sel,
  onChange,
}: {
  sel: Selection;
  onChange: (s: Selection) => void;
}) {

     const [regions, setRegions] = useState<ApiRegion[]>([]);
  const [error, setError] = useState("");

  useEffect(() => {
    getRegions()
      .then(setRegions)
      .catch((e) => setError(e.message));
  }, []);

  const current = regions.find((r) => r.id === sel.region);

  return (
    <div className="flex flex-wrap items-start justify-center gap-6">
      <div>
        <Globe region={sel.region} />
        <div className="mt-3 rounded-[20px] border-[3px] border-line bg-card px-4 py-1.5 text-center">
          {current ? current.name : "…"}
        </div>
        {current && (
          <p className="mt-2 max-w-[260px] text-sm">{current.why_it_matters}</p>
        )}
      </div>

      <div className="min-w-[260px] rounded-2xl border-[3px] border-line bg-card p-[18px]">
        <label htmlFor="region" className="mb-1 mt-2 block">Region</label>
        <select
          id="region"
          className={field}
          value={sel.region}
          onChange={(e) => onChange({ ...sel, region: e.target.value })}
        >
          {regions.length === 0 && <option value={sel.region}>Loading…</option>}
          {regions.map((r) => (
            <option key={r.id} value={r.id}>{r.name}</option>
          ))}
        </select>

        <div className="mb-1 mt-4 text-lg">
          Time frame{" "}
          <span className="group relative inline-block cursor-help" tabIndex={0} aria-describedby="tip">
            ⓘ
            <span
              id="tip"
              role="tooltip"
              className="absolute left-0 top-[140%] z-10 hidden w-[260px] rounded-lg bg-ink p-2.5 text-sm leading-snug text-page group-hover:block group-focus:block"
            >
              The end date must be after the start date. Both dates must fall between {MIN_DATE} and {MAX_DATE}, the limits of our data for now.
            </span>
          </span>
        </div>
        <label htmlFor="start" className="mb-1 mt-2 block">Start date</label>
        <input id="start" type="date" className={field} min={MIN_DATE} max={MAX_DATE}
          value={sel.start} onChange={(e) => onChange({ ...sel, start: e.target.value })} />
        <label htmlFor="end" className="mb-1 mt-2 block">End date</label>
        <input id="end" type="date" className={field} min={MIN_DATE} max={MAX_DATE}
          value={sel.end} onChange={(e) => onChange({ ...sel, end: e.target.value })} />
        <p className="mt-2 min-h-[1.3em] text-sm text-red-600">{timeError(sel)}</p>
      </div>
    </div>
  );
}
