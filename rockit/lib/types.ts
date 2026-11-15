// Shapes of the API responses (see api/schemas.py) and of the app's own state.

export type ApiVariable = {
  id: string;
  label: string;
  gldas_field: string;
  unit: string;
  description: string;
  why_it_matters: string;
  icon: string;
};

export type ApiRegion = {
  id: string;
  name: string;
  group: string;
  anchor: number[];
  label_point: [number, number] | null;
  bbox: [number, number, number, number];
  area_km2: number | null;
  land_fraction: number | null;
  grid_cells: number | null;
  selection: string | null;
  clipping: string | null;
  boundary_source: { name: string; url: string; license: string | null; citation: string | null } | null;
  cluster: number | null;
  cluster_role: string | null;
  overlaps: { region: string; share_of_smaller_region: number }[];
};

export type ApiProvenance = {
  dataset: string;
  is_development_data: boolean;
  run_id: string | null;
  review_status: string | null;
};

export type ApiTrend = {
  region: string;
  variable: string;
  unit: string;
  status: string;
  reason: string | null;
  start: string;
  end: string;
  n_observations: number;
  expected_months: number;
  coverage: number;
  max_gap_months: number | null;
  slope_per_decade: number | null;
  ci_low: number | null;
  ci_high: number | null;
  p_value: number | null;
  q_value: number | null;
  direction: string | null;
  significant: boolean | null;
  evidence: string | null;
  standardized_trend: number | null;
  fitted_period_change: number | null;
  hac_lags: number | null;
  method: string | null;
};

export type ApiReviewNote = {
  status: string;
  title: string;
  note: string;
  raised_by: string | null;
  evidence: {
    first_year: number;
    first_year_mean: number;
    last_year: number;
    last_year_mean: number;
    largest_step: number;
    largest_step_from_year: number;
    largest_step_to_year: number;
    unit: string;
  } | null;
};

export type ApiSeries = {
  dates: string[];
  values: (number | null)[];
  anomalies: (number | null)[];
  fitted: (number | null)[];
  trend_component: (number | null)[];
};

export type ApiRobustnessCheck = {
  check: string;
  label: string;
  status: string;
  start: string;
  end: string;
  hac_lags: number | null;
  slope_per_decade: number | null;
  ci_low: number | null;
  ci_high: number | null;
  p_value: number | null;
};

export type ApiRegionResult = {
  region: string;
  name: string;
  status: string;
  reason: string | null;
  trend: ApiTrend;
  trend_source: "reviewed_run" | "computed_on_request";
  full_record_trend: ApiTrend | null;
  series: ApiSeries;
  annual: { years: number[]; means: number[] };
  robustness: ApiRobustnessCheck[] | null;
  review_note: ApiReviewNote | null;
};

export type ApiVariableResult = {
  variable: string;
  label: string;
  unit: string;
  gldas_field: string;
  regions: ApiRegionResult[];
};

export type ApiScope = {
  kind: "full_record" | "custom_window";
  start: string;
  end: string;
  months: number;
  full_record: { start: string; end: string; months: number };
  trend_source: "reviewed_run" | "computed_on_request";
  note: string;
  anomaly_baseline: string;
};

export type ApiAnalysis = {
  request: { regions: string[]; variables: string[]; start: string; end: string };
  scope: ApiScope;
  generated_utc: string;
  significance: { alpha: number; family_size: number; method: string };
  robustness_note: string | null;
  results: ApiVariableResult[];
  provenance: ApiProvenance;
};

export type ApiPatternScope = { start: string; end: string; run_id: string; note: string };

export type ApiTrendDigest = {
  unit: string;
  slope_per_decade: number | null;
  ci_low: number | null;
  ci_high: number | null;
  q_value: number | null;
  significant: boolean | null;
  evidence: string | null;
  standardized_trend: number | null;
};

export type ApiTwinEntry = {
  trends: Record<string, ApiTrendDigest>;
  region: string;
  name: string;
  distance: number;
  pair_rank: number;
  pair_count: number;
  in_published_top_10: boolean;
  overlap_share: number | null;
  same_cluster: boolean;
  cluster: number | null;
  fingerprint: Record<string, number>;
};

export type ApiClusterCenter = { cluster: number; features: Record<string, number>; size: number; members: string[] };

export type ApiHotspot = ApiTrend & { magnitude: number; name?: string | null; review_note?: ApiReviewNote | null };
export type ApiOpposite = { variable: string; decreasing: ApiTrend; increasing: ApiTrend };

export type ApiPatternContext = {
  scope: ApiPatternScope;
  review_status: string;
  model_status: string;
  clustering: {
    algorithm: string;
    k: number;
    n_training_regions: number;
    features: string[];
    scaling: string;
    evaluation: Record<string, number | boolean>;
    centers: ApiClusterCenter[];
    feature_separation: { feature: string; range: number }[];
    limitations: string[];
  };
  regions: {
    region: string;
    name: string;
    cluster: number | null;
    role: string | null;
    distance_to_center: number | null;
    fingerprint: Record<string, number> | null;
    nearest: ApiTwinEntry[];
    hotspots: ApiHotspot[];
    opposites: ApiOpposite[];
  }[];
  pairs: {
    region_a: string;
    region_b: string;
    distance: number;
    pair_rank: number;
    pair_count: number;
    overlap_share: number | null;
    same_cluster: boolean;
  }[];
  limitations: string[];
};

export type ApiClusters = {
  run_id: string;
  status: string;
  review_status: string;
  algorithm: string;
  k: number;
  n_training_regions: number;
  features: string[];
  scaling: string;
  evaluation: Record<string, number | boolean>;
  candidates: Record<string, number | boolean>[];
  checks: Record<string, number | string>;
  centers: ApiClusterCenter[];
  feature_separation: { feature: string; range: number }[];
  assignments: {
    region: string;
    name: string;
    cluster: number;
    role: string;
    distance_to_center: number;
    model_status: string;
    fingerprint: Record<string, number> | null;
  }[];
  limitations: string[];
  scope: ApiPatternScope;
};

export type ApiTwins = {
  region: string;
  name: string;
  cluster: number | null;
  fingerprint: Record<string, number>;
  trends: Record<string, ApiTrendDigest>;
  features: string[];
  ranking: ApiTwinEntry[];
  all_pairs: { count: number; min: number; median: number; max: number };
  scope: ApiPatternScope;
  review_status: string;
  limitations: string[];
};

export type ApiDiscoveries = {
  run_id: string;
  review_status: string;
  hotspots: ApiHotspot[];
  opposites: ApiOpposite[];
  twins: { region_a: string; region_b: string; distance: number; overlap_share: number | null }[];
  limitations: string[];
  scope: ApiPatternScope | null;
};

export type ApiMapTrends = {
  variable: string;
  unit: string;
  run_id: string;
  review_status: string;
  scope: ApiPatternScope | null;
  regions: {
    region: string;
    name: string;
    slope_per_decade: number | null;
    ci_low: number | null;
    ci_high: number | null;
    standardized_trend: number | null;
    direction: string | null;
    significant: boolean | null;
    evidence: string | null;
    q_value: number | null;
    under_review: boolean;
  }[];
};

export type ApiMeta = {
  run_id: string;
  schema_version: string;
  review_status: string;
  model_status: string;
  period: { start: string; end: string; months: number };
  min_window_months: number;
  max_regions_per_run: number;
  completeness: { series: number; values_expected: number; values_missing: number };
  dataset: {
    product: string;
    version: string;
    title: string;
    kind: string;
    url: string;
    citation: string;
    granules: number;
    extracted_utc: string | null;
    input_sha256: string | null;
    native_units: Record<string, string> | null;
    unit_conversions: Record<string, string>;
    area_weighting: string | null;
    coverage_definition: string | null;
  };
  methods: Record<string, string>;
  config: Record<string, unknown>;
  limitations: string[];
  review_notes: { id: string; title: string; note: string; source_url: string | null; raised_by: string | null }[];
  boundary_sources: { name: string; url: string; license: string | null; citation: string | null; regions: string[] | null }[];
  display_geometry: Record<string, unknown> | null;
  robustness_available: boolean;
  packages: Record<string, string>;
};

export type ApiGlossaryEntry = {
  id: string;
  term: string;
  category: string;
  definition: string;
  explanation: string | null;
  related: string[];
};

export type GeoJsonCollection = {
  type: "FeatureCollection";
  features: {
    type: "Feature";
    properties: Record<string, unknown>;
    geometry: { type: string; coordinates: unknown };
  }[];
};

// ---- app state ---------------------------------------------------------------

/** A selected region keeps its color slot (1 to 4) for as long as it stays selected. */
export type SelectedRegion = { id: string; slot: number };

/** What the controls currently show. Not necessarily what the results below were run with. */
export type Draft = {
  regions: SelectedRegion[];
  variables: string[];
  start: string; // YYYY-MM
  end: string; // YYYY-MM
};

/** A frozen copy of the controls at the moment Run was pressed. Results belong to this. */
export type RunConfig = Draft;

export type SavedRun = {
  id: string;
  name: string;
  savedAt: string;
  config: RunConfig;
  runId: string | null;
};
