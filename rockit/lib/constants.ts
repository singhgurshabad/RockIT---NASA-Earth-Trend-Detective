import type { Selection } from "./types";

export const REGIONS = ["California", "Himalayas", "Amazon Basin"];
// Where the globe points for each region. Smaller zoom = further out.
// center is [longitude, latitude]; bounds is [west, south, east, north] and draws the highlight box.
export const REGION_VIEWS: Record<
  string,
  { center: [number, number]; zoom: number; bounds: [number, number, number, number] }
> = {
  California: { center: [-119.5, 37.2], zoom: 2.4, bounds: [-124.5, 32.5, -114.1, 42] },
  Himalayas: { center: [86, 28], zoom: 2.4, bounds: [72, 26, 100, 36] },
  "Amazon Basin": { center: [-62, -5], zoom: 2, bounds: [-79, -16, -50, 5] },
};

export const VARIABLES = ["Surface temperature", "Precipitation", "Snow cover", "Vegetation index"];

// Data limits: change these when more data becomes available.
export const MIN_DATE = "0001-01-01";
export const MAX_DATE = "2026-12-31";

export const TAB_INFO = [
  "Pick where on Earth and which dates you want to study.",
  "Choose the variables to analyze, like temperature or rainfall.",
  "Look back at the analyses you have already run.",
];

export const DEFAULT_SELECTION: Selection = {
  region: REGIONS[0],
  start: "2000-01-01",
  end: "2024-12-31",
  variables: [VARIABLES[0]],
};

export function timeError(s: Selection): string {
  if (!s.start || !s.end) return "Please enter both a start and an end date.";
  if (s.start < MIN_DATE || s.end < MIN_DATE || s.start > MAX_DATE || s.end > MAX_DATE)
    return `Dates must be between ${MIN_DATE} and ${MAX_DATE}.`;
  if (s.end <= s.start) return "The end date must be after the start date.";
  return "";
}
