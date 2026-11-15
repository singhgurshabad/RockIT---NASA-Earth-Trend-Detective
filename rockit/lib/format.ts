// Number, unit and date formatting. Kept in one place so every chart and table agrees.

const UNIT_LABELS: Record<string, string> = {
  degC: "°C",
  "kg/m2": "kg/m²",
  "mm/day": "mm/day",
};

export function unitLabel(unit: string): string {
  return UNIT_LABELS[unit] ?? unit;
}

const MINUS = "−";

/** Decimals that suit a value of this size (more for small numbers). */
function decimalsFor(reference: number): number {
  const a = Math.abs(reference);
  if (a === 0) return 2;
  if (a >= 100) return 0;
  if (a >= 10) return 1;
  if (a >= 1) return 2;
  if (a >= 0.1) return 2;
  return 3;
}

export function num(value: number | null | undefined, decimals?: number): string {
  if (value === null || value === undefined || !Number.isFinite(value)) return "no data";
  const d = decimals ?? decimalsFor(value);
  const text = Math.abs(value).toFixed(d);
  return (value < 0 && Number(text) !== 0 ? MINUS : "") + text;
}

/** Always shows a sign: +0.36 or −0.36. For changes and trends. */
export function signed(value: number | null | undefined, decimals?: number): string {
  if (value === null || value === undefined || !Number.isFinite(value)) return "no data";
  const d = decimals ?? decimalsFor(value);
  const text = Math.abs(value).toFixed(d);
  if (Number(text) === 0) return text;
  return (value < 0 ? MINUS : "+") + text;
}

/** Decimals shared by a slope and its range, so the three numbers line up. */
export function trendDecimals(values: (number | null | undefined)[]): number {
  const finite = values.filter((v): v is number => typeof v === "number" && Number.isFinite(v));
  if (!finite.length) return 2;
  return decimalsFor(Math.max(...finite.map(Math.abs)));
}

/** p and q values: 0.031, or "< 0.001" for very small ones. */
export function prob(value: number | null | undefined): string {
  if (value === null || value === undefined || !Number.isFinite(value)) return "no data";
  if (value < 0.001) return "< 0.001";
  // Three decimals near the 0.05 line, so 0.051 is not shown as 0.05.
  return value < 0.1 ? value.toFixed(3) : value.toFixed(2);
}

export function percent(share: number | null | undefined, decimals = 0): string {
  if (share === null || share === undefined || !Number.isFinite(share)) return "no data";
  return `${(share * 100).toFixed(decimals)}%`;
}

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
export const MONTH_NAMES = MONTHS;

/** "2010-03" or "2010-03-01" -> "Mar 2010" */
export function monthLabel(ym: string): string {
  const [y, m] = ym.split("-");
  return `${MONTHS[Number(m) - 1]} ${y}`;
}

export function windowLabel(start: string, end: string): string {
  return `${monthLabel(start)} to ${monthLabel(end)}`;
}

export function monthsBetween(start: string, end: string): number {
  const [ys, ms] = start.split("-").map(Number);
  const [ye, me] = end.split("-").map(Number);
  return (ye - ys) * 12 + (me - ms) + 1;
}

export function area(km2: number | null | undefined): string {
  if (!km2) return "no data";
  if (km2 >= 1e6) return `${(km2 / 1e6).toFixed(2)} million km²`;
  return `${Math.round(km2).toLocaleString("en-US")} km²`;
}

const GROUP_LABELS: Record<string, string> = {
  river_basin: "River basin",
  ecoregion: "Ecoregion",
  mountain_region: "Mountain region",
  mountain: "Mountain ecoregion",
  plain: "Plain",
  grassland: "Grassland",
  dryland: "Desert",
  steppe: "Steppe",
  tundra: "Tundra",
  boreal: "Boreal forest",
  state: "State (validation region)",
};

export function groupLabel(group: string): string {
  return GROUP_LABELS[group] ?? group.replace(/_/g, " ");
}

export function statusLabel(status: string | null | undefined): string {
  if (!status) return "Status unknown";
  if (status === "provisional_pending_scientific_review") return "Provisional, pending scientific review";
  if (status === "passed_heuristic_checks") return "Passed the team's stability checks";
  if (status === "exploratory_failed_checks") return "Exploratory: failed the team's stability checks";
  return status.replace(/_/g, " ");
}

export function lowerFirst(text: string): string {
  return text.charAt(0).toLowerCase() + text.slice(1);
}
