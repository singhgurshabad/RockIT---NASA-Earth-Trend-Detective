// Colours that carry meaning in charts and on the map.
//
// Series colours identify a region. A region takes a slot when it is selected and keeps
// it until it is removed, so removing one region never repaints the others. The four
// colours were checked for colour-blind separation against the app's dark surface, and
// every series also gets its own dash pattern and number, so colour is never the only cue.

export const SERIES = [
  { slot: 1, color: "#3987e5", dash: "", name: "blue" },
  { slot: 2, color: "#d95926", dash: "7 4", name: "orange" },
  { slot: 3, color: "#199e70", dash: "2 4", name: "green" },
  { slot: 4, color: "#c98500", dash: "10 3 2 3", name: "yellow" },
] as const;

export function seriesStyle(slot: number) {
  return SERIES[(slot - 1) % SERIES.length];
}

// Diverging scale for "how did this region trend": blue = falling, red = rising,
// neutral grey = close to no change. Used for the map's trend colouring.
export const DIVERGING = {
  classes: ["#2f6fc0", "#4f8ad4", "#86a9d6", "#5b6472", "#d99a8f", "#e07a70", "#d9534f"],
  // Class edges in standard deviations per decade (standardized trend).
  edges: [-0.6, -0.3, -0.1, 0.1, 0.3, 0.6],
  neutral: "#5b6472",
};

export function divergingClass(value: number | null | undefined): number {
  if (value === null || value === undefined || !Number.isFinite(value)) return -1;
  let index = 0;
  while (index < DIVERGING.edges.length && value >= DIVERGING.edges[index]) index += 1;
  return index;
}

// One colour per variable, used for icons, tabs and accents (never for chart series, which
// belong to regions). Warm for heat, blue for rain, green for soil, teal for water returning to air.
export const VARIABLE_TINT: Record<string, string> = {
  surface_temperature: "#ff8a5c",
  precipitation: "#5aa9ff",
  soil_moisture: "#8fcf62",
  evapotranspiration: "#3fd0c0",
};

export function variableTint(id: string): string {
  return VARIABLE_TINT[id] ?? "#6cc7e6";
}

export const INK = {
  primary: "#e9eef6",
  secondary: "#a9b6ca",
  muted: "#7f8fa9",
  grid: "#16233a",
  axis: "#2a3b58",
  surface: "#070d18",
  review: "#e2a53a",
};

// The two K-means groups are told apart by marker shape first, tone second.
export const CLUSTER_MARK = [
  { shape: "circle", color: "#8fa3c2" },
  { shape: "square", color: "#c9b48a" },
  { shape: "diamond", color: "#9fc2b0" },
  { shape: "triangle", color: "#c29fb8" },
  { shape: "circle", color: "#b0b0b0" },
] as const;
