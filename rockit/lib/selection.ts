import { monthsBetween } from "./format";
import type { ApiMeta, Draft, RunConfig, SelectedRegion } from "./types";

/** Lowest color slot not in use. */
export function nextSlot(regions: SelectedRegion[], max: number): number | null {
  for (let slot = 1; slot <= max; slot += 1) {
    if (!regions.some((r) => r.slot === slot)) return slot;
  }
  return null;
}

export function toggleRegion(draft: Draft, id: string, max: number): Draft {
  if (draft.regions.some((r) => r.id === id)) {
    return { ...draft, regions: draft.regions.filter((r) => r.id !== id) };
  }
  const slot = nextSlot(draft.regions, max);
  if (slot === null) return draft;
  return { ...draft, regions: [...draft.regions, { id, slot }] };
}

export function withRegions(ids: string[]): SelectedRegion[] {
  return ids.map((id, index) => ({ id, slot: index + 1 }));
}

/** Everything wrong with the current controls, in plain words. Empty means ready to run. */
export function problems(draft: Draft, meta: ApiMeta): string[] {
  const out: string[] = [];
  if (draft.regions.length === 0) out.push("Choose at least one region.");
  if (draft.regions.length > meta.max_regions_per_run) out.push(`Compare at most ${meta.max_regions_per_run} regions in one run.`);
  if (draft.variables.length === 0) out.push("Choose at least one variable.");
  if (draft.start > draft.end) out.push("The start month is after the end month.");
  else if (draft.start < meta.period.start || draft.end > meta.period.end) out.push(`The data covers ${meta.period.start} to ${meta.period.end}.`);
  else {
    const months = monthsBetween(draft.start, draft.end);
    if (months < meta.min_window_months) out.push(`A trend needs at least ${meta.min_window_months} months. This window has ${months}.`);
  }
  return out;
}

export function sameConfig(a: Draft | RunConfig | null, b: Draft | RunConfig | null): boolean {
  if (!a || !b) return false;
  return (
    a.start === b.start &&
    a.end === b.end &&
    a.variables.join("|") === b.variables.join("|") &&
    a.regions.map((r) => `${r.id}:${r.slot}`).join("|") === b.regions.map((r) => `${r.id}:${r.slot}`).join("|")
  );
}

export function freeze(draft: Draft): RunConfig {
  return {
    regions: draft.regions.map((r) => ({ ...r })),
    variables: [...draft.variables],
    start: draft.start,
    end: draft.end,
  };
}
