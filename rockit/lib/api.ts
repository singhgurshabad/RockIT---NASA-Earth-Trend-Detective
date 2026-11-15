export const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

async function get<T>(path: string, params?: URLSearchParams): Promise<T> {
  const query = params ? `?${params.toString()}` : "";
  const res = await fetch(`${API_URL}${path}${query}`);
  if (!res.ok) throw new Error(`API error ${res.status}`);
  return res.json();
}

export type ApiVariable = {
  id: string;
  label: string;
  unit: string;
  description: string;
  why_it_matters: string;
  icon: string;
};

export function getVariables(): Promise<ApiVariable[]> {
  return get("/api/variables");
}

export type ApiRegion = {
  id: string;
  name: string;
  group: string;
  anchor: number[];
  bbox: number[];
  area_km2: number | null;
  description: string | null;
  why_it_matters: string | null;
};

export function getRegions(): Promise<ApiRegion[]> {
  return get("/api/regions");
}

export type ApiProvenance = {
  dataset: string;
  is_development_data: boolean;
  run_id: string | null;
  review_status: string | null;
};

export type ApiRegionSeries = {
  region: string;
  dates: string[];
  values: (number | null)[];
  anomalies: (number | null)[] | null;
  fitted: (number | null)[] | null;
  trend_component: (number | null)[] | null;
};

export type ApiTimeseries = {
  variable: string;
  unit: string;
  start: string;
  end: string;
  series: ApiRegionSeries[];
  provenance: ApiProvenance;
};

export function getTimeseries(
  variable: string,
  regions: string[],
  start?: string,
  end?: string
): Promise<ApiTimeseries> {
  const params = new URLSearchParams();
  params.set("variable", variable);
  regions.forEach((r) => params.append("region", r));
  if (start) params.set("start", start);
  if (end) params.set("end", end);
  return get("/api/timeseries", params);
}

export type ApiMlTrend = {
  region: string;
  variable: string;
  unit: string;
  status: string;
  start: string;
  end: string;
  n_observations: number;
  expected_months: number;
  coverage: number;
  max_gap_months: number | null;
  slope_per_decade: number | null;
  ci_low: number | null;
  ci_high: number | null;
  confidence_interval: number[] | null;
  p_value: number | null;
  q_value: number | null;
  direction: string | null;
  significant: boolean | null;
  evidence: string | null;
  standardized_trend: number | null;
  fitted_period_change: number | null;
  hac_lags: number | null;
  method: string;
};

export type ApiTrend = {
  region: string;
  variable: string;
  kind: "precomputed" | "quick_estimate";
  note: string;
  result: ApiMlTrend;
  provenance: ApiProvenance;
};

export function getTrend(
  variable: string,
  region: string,
  start?: string,
  end?: string
): Promise<ApiTrend> {
  const params = new URLSearchParams();
  params.set("variable", variable);
  params.set("region", region);
  if (start) params.set("start", start);
  if (end) params.set("end", end);
  return get("/api/trend", params);
}

export type ApiDiscoveries = {
  run_id: string;
  review_status: string;
  hotspots: (ApiMlTrend & { magnitude: number })[];
  opposites: { variable: string; decreasing: ApiMlTrend; increasing: ApiMlTrend }[];
  twins: { region_a: string; region_b: string; distance: number }[];
  limitations: string[];
};

export function getDiscoveries(): Promise<ApiDiscoveries> {
  return get("/api/discoveries");
}

export type ApiMapTrendItem = {
  region: string;
  name: string;
  slope_per_decade: number | null;
  standardized_trend: number | null;
  direction: string | null;
  significant: boolean | null;
  evidence: string | null;
  q_value: number | null;
};

export type ApiMapTrends = {
  variable: string;
  unit: string;
  run_id: string;
  review_status: string;
  regions: ApiMapTrendItem[];
};

export function getMapTrends(variable: string): Promise<ApiMapTrends> {
  const params = new URLSearchParams();
  params.set("variable", variable);
  return get("/api/map-trends", params);
}

export type ApiGeoJson = {
  type: "FeatureCollection";
  features: {
    type: "Feature";
    properties: Record<string, unknown>;
    geometry: { type: string; coordinates: unknown };
  }[];
};

export function getRegionsGeoJson(): Promise<ApiGeoJson> {
  return get("/api/regions/geojson");
}