"use client";

import { useMemo } from "react";
import { MONTH_NAMES, groupLabel, monthsBetween, unitLabel } from "@/lib/format";
import { seriesStyle, variableTint } from "@/lib/palette";
import { toggleRegion } from "@/lib/selection";
import type { Phase } from "@/lib/useRun";
import type { ApiMeta, ApiRegion, ApiVariable, Draft } from "@/lib/types";
import Icon from "./Icon";

type Props = {
  meta: ApiMeta;
  regions: ApiRegion[];
  variables: ApiVariable[];
  draft: Draft;
  onChange: (draft: Draft) => void;
  problems: string[];
  phase: Phase;
  /** True when results are on screen and the controls no longer match them. */
  stale: boolean;
  onRun: () => void;
  onCancel: () => void;
};

function MonthPicker({
  id, label, value, min, max, onChange,
}: { id: string; label: string; value: string; min: string; max: string; onChange: (value: string) => void }) {
  const [year, month] = value.split("-").map(Number);
  const minYear = Number(min.slice(0, 4));
  const maxYear = Number(max.slice(0, 4));
  const years = Array.from({ length: maxYear - minYear + 1 }, (_, i) => minYear + i);
  const set = (y: number, m: number) => onChange(`${y}-${String(m).padStart(2, "0")}`);
  return (
    <fieldset className="min-w-0 flex-1">
      <legend className="label mb-1.5 sm:sr-only">{label}</legend>
      <div className="flex gap-2">
        <select id={`${id}-month`} aria-label={`${label} month`} className="field !pl-2.5" value={month} onChange={(e) => set(year, Number(e.target.value))}>
          {MONTH_NAMES.map((name, index) => (
            <option key={name} value={index + 1}>{name}</option>
          ))}
        </select>
        <select id={`${id}-year`} aria-label={`${label} year`} className="field !pl-2.5" value={year} onChange={(e) => set(Number(e.target.value), month)}>
          {years.map((y) => (
            <option key={y} value={y}>{y}</option>
          ))}
        </select>
      </div>
    </fieldset>
  );
}

export default function Console({ meta, regions, variables, draft, onChange, problems, phase, stale, onRun, onCancel }: Props) {
  const max = meta.max_regions_per_run;
  const running = phase === "running";
  const full = draft.start === meta.period.start && draft.end === meta.period.end;
  const validWindow = draft.start <= draft.end;
  const months = validWindow ? monthsBetween(draft.start, draft.end) : 0;

  const grouped = useMemo(() => {
    const groups = new Map<string, ApiRegion[]>();
    for (const region of [...regions].sort((a, b) => a.name.localeCompare(b.name))) {
      const key = groupLabel(region.group);
      groups.set(key, [...(groups.get(key) ?? []), region]);
    }
    return [...groups.entries()].sort((a, b) => a[0].localeCompare(b[0]));
  }, [regions]);

  const presets = useMemo(() => {
    const startYear = Number(meta.period.start.slice(0, 4));
    const endYear = Number(meta.period.end.slice(0, 4));
    const middle = startYear + Math.floor((endYear - startYear + 1) / 2);
    return [
      { label: "Full record", start: meta.period.start, end: meta.period.end },
      { label: `${startYear} to ${middle - 1}`, start: `${startYear}-01`, end: `${middle - 1}-12` },
      { label: `${middle} to ${endYear}`, start: `${middle}-01`, end: `${endYear}-12` },
      { label: "Last 10 years", start: `${endYear - 9}-01`, end: `${endYear}-12` },
    ].filter((p) => p.start >= meta.period.start && p.end <= meta.period.end);
  }, [meta]);

  const toggleVariable = (id: string) => {
    const has = draft.variables.includes(id);
    // Keep the variables in the catalogue's order, whatever order they were clicked in.
    const next = variables.map((v) => v.id).filter((v) => (v === id ? !has : draft.variables.includes(v)));
    onChange({ ...draft, variables: next });
  };

  return (
    <form
      className="flex flex-col gap-3.5"
      onSubmit={(event) => {
        event.preventDefault();
        if (!running && problems.length === 0) onRun();
      }}
      aria-label="Analysis settings"
    >
      {/* regions */}
      <section aria-labelledby="regions-heading">
        <div className="mb-1.5 flex items-baseline justify-between gap-3">
          <h2 id="regions-heading" className="text-[17px]">Regions</h2>
          <span className="label num">{draft.regions.length} of {max}</span>
        </div>
        {draft.regions.length > 0 && (
          <ul className="mb-2.5 flex flex-wrap gap-1.5">
            {[...draft.regions].sort((a, b) => a.slot - b.slot).map((item) => {
              const region = regions.find((r) => r.id === item.id);
              const style = seriesStyle(item.slot);
              return (
                <li key={item.id} className="flex max-w-full items-center gap-2 rounded-full border border-line-strong bg-deep py-0.5 pl-1.5 pr-0.5">
                  <span className="slot" style={{ background: style.color }}>{item.slot}</span>
                  <span className="min-w-0 truncate text-[14px]" title={region ? `${region.name} (${groupLabel(region.group)})` : item.id}>{region?.name ?? item.id}</span>
                  <button
                    type="button"
                    className="btn-quiet !min-h-[30px] !rounded-full !px-1.5"
                    onClick={() => onChange(toggleRegion(draft, item.id, max))}
                    aria-label={`Remove ${region?.name ?? item.id}`}
                  >
                    <Icon name="close" size={15} />
                  </button>
                </li>
              );
            })}
          </ul>
        )}
        <label htmlFor="add-region" className="sr-only">Add a region</label>
        <select
          id="add-region"
          className="field"
          value=""
          disabled={draft.regions.length >= max}
          onChange={(event) => {
            if (event.target.value) onChange(toggleRegion(draft, event.target.value, max));
          }}
        >
          <option value="">
            {draft.regions.length >= max ? `${max} regions is the most one run compares` : draft.regions.length ? "Add a region to compare" : "Choose a region"}
          </option>
          {grouped.map(([group, items]) => (
            <optgroup key={group} label={group}>
              {items.map((r) => (
                <option key={r.id} value={r.id} disabled={draft.regions.some((s) => s.id === r.id)}>{r.name}</option>
              ))}
            </optgroup>
          ))}
        </select>
      </section>

      {/* window */}
      <section aria-labelledby="window-heading">
        <div className="mb-1.5 flex items-baseline justify-between gap-3">
          <h2 id="window-heading" className="text-[17px]">Time window</h2>
          <span className="label num">{validWindow ? `${months} months` : ""}</span>
        </div>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:gap-2.5">
          <MonthPicker id="start" label="From" value={draft.start} min={meta.period.start} max={meta.period.end} onChange={(start) => onChange({ ...draft, start })} />
          <span className="hidden text-[13.5px] text-ink-3 sm:inline" aria-hidden="true">to</span>
          <MonthPicker id="end" label="To" value={draft.end} min={meta.period.start} max={meta.period.end} onChange={(end) => onChange({ ...draft, end })} />
        </div>
        <div className="mt-2 flex flex-wrap gap-1.5">
          {presets.map((preset) => {
            const active = draft.start === preset.start && draft.end === preset.end;
            return (
              <button
                key={preset.label}
                type="button"
                className="badge transition-colors hover:border-[#3a5078] hover:text-ink"
                style={active ? { borderColor: "var(--accent)", color: "var(--ink)" } : undefined}
                aria-pressed={active}
                onClick={() => onChange({ ...draft, start: preset.start, end: preset.end })}
              >
                {preset.label}
              </button>
            );
          })}
        </div>
        {!full && (
          <p className="mt-2 text-[13px] text-ink-3">
            A custom window is re-analyzed on request with the reviewed run&apos;s method (at least {meta.min_window_months} months). The full record uses the reviewed results as they are.
          </p>
        )}
      </section>

      {/* variables */}
      <section aria-labelledby="variables-heading">
        <h2 id="variables-heading" className="mb-1.5 text-[17px]">Variables</h2>
        <div className="grid grid-cols-2 gap-2">
          {variables.map((v) => {
            const on = draft.variables.includes(v.id);
            const tint = variableTint(v.id);
            return (
              <button
                key={v.id}
                type="button"
                aria-pressed={on}
                title={v.description}
                onClick={() => toggleVariable(v.id)}
                className="flex min-h-[48px] items-center gap-2 rounded-lg border px-2.5 py-1.5 text-left transition-colors"
                style={{
                  borderColor: on ? tint : "var(--line-strong)",
                  background: on ? `color-mix(in srgb, ${tint} 12%, transparent)` : "transparent",
                }}
              >
                <span
                  className="grid h-7 w-7 flex-none place-items-center rounded-md"
                  style={{ background: `color-mix(in srgb, ${tint} ${on ? 22 : 12}%, transparent)`, color: tint }}
                >
                  <Icon name={v.icon} size={18} />
                </span>
                <span className="min-w-0 flex-1">
                  {/* A soft hyphen lets the longest label break cleanly on narrow screens. */}
                  <span className="block text-[13.5px] font-medium leading-tight">{v.label.replace(" (0-10 cm)", "").replace("Evapotranspiration", "Evapo\u00ADtranspiration")}</span>
                  <span className="block text-[12.5px] text-ink-3">{unitLabel(v.unit)}</span>
                </span>
                <span
                  className="grid h-[18px] w-[18px] flex-none place-items-center rounded-[5px] border"
                  style={{ borderColor: on ? tint : "var(--line-strong)", background: on ? tint : "transparent", color: "#04070d" }}
                  aria-hidden="true"
                >
                  {on && <Icon name="check" size={13} />}
                </span>
              </button>
            );
          })}
        </div>
      </section>

      {/* run */}
      <div>
        <div className="flex flex-wrap items-center gap-3">
          <button type="submit" className="btn-primary min-w-[190px] flex-1 sm:flex-none" disabled={running || problems.length > 0} aria-describedby="run-status">
            {running ? <span className="spinner" aria-hidden="true" /> : <Icon name="play" size={17} />}
            {running ? "Running analysis" : "Run analysis"}
          </button>
          {running && (
            <button type="button" className="btn !min-h-[48px]" onClick={onCancel}>
              <Icon name="stop" size={15} /> Cancel
            </button>
          )}
        </div>
        <div id="run-status" className="mt-2.5 min-h-[22px] text-[13.5px] text-ink-2" role="status" aria-live="polite">
          {running && "Waiting for the data service. Results appear below when it answers."}
          {!running && problems.length > 0 && (
            <ul className="flex flex-col gap-0.5">
              {problems.map((problem) => (
                <li key={problem} className="flex items-start gap-2"><Icon name="info" size={16} className="mt-[3px] flex-none text-ink-3" />{problem}</li>
              ))}
            </ul>
          )}
          {!running && problems.length === 0 && stale && "These settings differ from the results below. Run again to update them."}
          {!running && problems.length === 0 && !stale && phase === "done" && "Results below match these settings."}
          {!running && problems.length === 0 && !stale && phase === "cancelled" && "Run cancelled."}
        </div>
      </div>
    </form>
  );
}
