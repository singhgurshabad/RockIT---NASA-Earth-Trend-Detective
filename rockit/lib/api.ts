import type {
  ApiAnalysis,
  ApiClusters,
  ApiDiscoveries,
  ApiGlossaryEntry,
  ApiMapTrends,
  ApiMeta,
  ApiPatternContext,
  ApiRegion,
  ApiTwins,
  ApiVariable,
  GeoJsonCollection,
  RunConfig,
} from "./types";

export const API_URL = (process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000").replace(/\/$/, "");

/** An error with a message that is safe to show to the person using the app. */
export class ApiError extends Error {
  status: number | null;
  constructor(message: string, status: number | null) {
    super(message);
    this.name = "ApiError";
    this.status = status;
  }
}

export function isAbort(error: unknown): boolean {
  return error instanceof DOMException && error.name === "AbortError";
}

type Params = Record<string, string | string[] | undefined>;

function query(params?: Params): string {
  if (!params) return "";
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value === undefined) continue;
    if (Array.isArray(value)) value.forEach((v) => search.append(key, v));
    else search.set(key, value);
  }
  const text = search.toString();
  return text ? `?${text}` : "";
}

async function get<T>(path: string, params?: Params, signal?: AbortSignal): Promise<T> {
  let res: Response;
  try {
    res = await fetch(`${API_URL}${path}${query(params)}`, { signal });
  } catch (error) {
    if (isAbort(error)) throw error;
    throw new ApiError(`Could not reach the data service at ${API_URL}. Check that the API is running.`, null);
  }
  if (!res.ok) {
    let detail = "";
    try {
      const body = await res.json();
      if (typeof body?.detail === "string") detail = body.detail;
      else if (Array.isArray(body?.detail)) detail = body.detail.map((d: { msg?: string }) => d.msg).filter(Boolean).join("; ");
    } catch {
      // The body was not JSON. Fall through to the generic message.
    }
    throw new ApiError(detail || `The data service returned an error (HTTP ${res.status}).`, res.status);
  }
  return res.json() as Promise<T>;
}

function runParams(config: RunConfig): Params {
  return {
    region: config.regions.map((r) => r.id),
    variable: config.variables,
    start: config.start,
    end: config.end,
  };
}

export const getVariables = (signal?: AbortSignal) => get<ApiVariable[]>("/api/variables", undefined, signal);
export const getRegions = (signal?: AbortSignal) => get<ApiRegion[]>("/api/regions", undefined, signal);
export const getMeta = (signal?: AbortSignal) => get<ApiMeta>("/api/meta", undefined, signal);
export const getGlossary = (signal?: AbortSignal) => get<ApiGlossaryEntry[]>("/api/glossary", undefined, signal);
export const getRegionsGeoJson = (signal?: AbortSignal) => get<GeoJsonCollection>("/api/regions/geojson", undefined, signal);

export const getAnalysis = (config: RunConfig, signal?: AbortSignal) => get<ApiAnalysis>("/api/analysis", runParams(config), signal);
export const getPatternContext = (regions: string[], signal?: AbortSignal) =>
  get<ApiPatternContext>("/api/pattern-context", { region: regions }, signal);

export const getClusters = (signal?: AbortSignal) => get<ApiClusters>("/api/clusters", undefined, signal);
export const getTwins = (region: string, signal?: AbortSignal) => get<ApiTwins>("/api/twins", { region }, signal);
export const getDiscoveries = (signal?: AbortSignal) => get<ApiDiscoveries>("/api/discoveries", undefined, signal);
export const getMapTrends = (variable: string, signal?: AbortSignal) => get<ApiMapTrends>("/api/map-trends", { variable }, signal);

export function exportUrl(config: RunConfig, kind: "monthly" | "trends"): string {
  return `${API_URL}/api/export${query({ ...runParams(config), kind })}`;
}
