// Same-origin by default: Next proxies /backend to the Python API.
export const API_URL = (process.env.NEXT_PUBLIC_API_URL ?? "/backend").replace(/\/$/, "");
export async function request<T>(path: string, params?: URLSearchParams, signal?: AbortSignal): Promise<T> {
  const res = await fetch(`${API_URL}${path}${params ? `?${params}` : ""}`, { signal: signal ?? AbortSignal.timeout(20000), cache: "no-store" });
  if (!res.ok) {
    const error = await res.json().catch(() => null);
    throw new Error(typeof error?.detail === "string" ? error.detail : res.status === 502 || res.status === 503 ? "The analysis server is unavailable. Start RockIT with python3 start.py, then retry." : `Analysis request failed (${res.status}). Please check your selection and retry.`);
  }
  return res.json();
}
export type ApiVariable = { id: string; label: string; unit: string; description: string; why_it_matters: string; icon: string };
export type ApiRegion = { id: string; name: string; group: string; anchor: number[]; bbox: number[]; area_km2?: number | null; description?: string | null; why_it_matters?: string | null };
export type Provenance = { dataset: string; is_development_data: boolean; run_id: string; review_status: string };
export type RegionSeries = { region: string; dates: string[]; values: (number | null)[]; anomalies: (number | null)[]; fitted: (number | null)[]; trend_component: (number | null)[] };
export type Trend = { region: string; variable: string; kind: "precomputed" | "custom_window"; note: string; provenance: Provenance; result: { status: string; reason?: string; start: string; end: string; unit: string; n_observations: number; expected_months: number; coverage: number; slope_per_decade: number | null; ci_low: number | null; ci_high: number | null; p_value: number | null; q_value: number | null; significant: boolean | null; direction: string | null; standardized_trend: number | null; method: string } };
export type Analysis = { variable: string; unit: string; start: string; end: string; series: RegionSeries[]; trends: Trend[]; provenance: Provenance };
export type Selection = { regions: string[]; variables: string[]; start: string; end: string };
export type Fingerprint = Record<string, number | null>;
export type ClusterContext = { region: string; cluster: number | null; role: string; distance_to_center: number; fingerprint: Fingerprint; neighbors: { region: string; distance: number; cluster: number | null; fingerprint: Fingerprint }[] };
export type ML = { algorithm: string; k: number; status: string; period: string[]; features: string[]; scaling: string; n_training_regions: number; evaluation: { silhouette: number; seed_ari: number; endpoint_ari: number }; centers: { cluster: number; features: Fingerprint }[]; assignments: { region: string; cluster: number; role: string }[]; limitations: string[]; regions: ClusterContext[]; run_id: string };
export type Mission = { id: string; name?: string; created_at: string; selection: Selection; results: Analysis[]; ml: ML; provenance: Provenance; limitations: string[]; quality_notes: string[] };
export const getRegions = () => request<ApiRegion[]>("/api/regions");
export const getVariables = () => request<ApiVariable[]>("/api/variables");
export const getMission = (selection: Selection, signal: AbortSignal) => {
  const params = new URLSearchParams({ start: selection.start, end: selection.end });
  selection.regions.forEach(r => params.append("region", r));
  selection.variables.forEach(v => params.append("variable", v));
  return request<Mission>("/api/mission", params, signal);
};
export const formatUnit = (s: string) => s.replace("degC", "°C").replace("kg/m2", "kg/m²");
export const number = (n: number | null | undefined, places = 2) => typeof n === "number" && Number.isFinite(n) ? n.toFixed(places) : "—";
export function downloadFile(content: string, filename: string, type: string) {
  const url = URL.createObjectURL(new Blob([content], { type }));
  const a = document.createElement("a"); a.href = url; a.download = filename; a.click(); setTimeout(() => URL.revokeObjectURL(url), 1000);
}
export function csvFor(mission: Mission, regions: ApiRegion[], variables: ApiVariable[]) {
  const rows: (string | number | null)[][] = [["region_id", "region", "variable", "unit", "date", "value", "anomaly_full_record_baseline", "fitted_full_record", "trend_component_full_record", "analysis_run_id"]];
  mission.results.forEach(r => r.series.forEach(s => s.dates.forEach((date, i) => rows.push([s.region, regions.find(x => x.id === s.region)?.name ?? s.region, variables.find(x => x.id === r.variable)?.label ?? r.variable, r.unit, date, s.values[i], s.anomalies?.[i], s.fitted?.[i], s.trend_component?.[i], mission.provenance.run_id]))));
  return rows.map(row => row.map(v => `"${String(v ?? "").replaceAll('"', '""')}"`).join(",")).join("\r\n");
}
