from typing import Any, Literal, Optional

from pydantic import BaseModel, Field


class Variable(BaseModel):
    id: str = Field(description="Short id used in other endpoints, e.g. soil_moisture")
    label: str = Field(description="Name to show on screen")
    gldas_field: str = Field(description="Name of this variable in NASA's GLDAS files")
    unit: str = Field(description="Unit of the values, e.g. kg/m²")
    description: str = Field(description="Plain-language definition for the hover bar")
    why_it_matters: str
    icon: str = Field(description="Icon name for the frontend, e.g. thermometer")


class BoundarySource(BaseModel):
    name: str
    url: str = ""
    license: Optional[str] = None
    citation: Optional[str] = None
    regions: Optional[list[str]] = None


class RegionOverlap(BaseModel):
    region: str
    share_of_smaller_region: float = Field(description="Share of the smaller of the two regions that lies inside the other")


class Region(BaseModel):
    id: str
    name: str
    group: str
    anchor: list[float]
    label_point: Optional[list[float]] = Field(default=None, description="[lon, lat] of a point inside the region, for a map label")
    bbox: list[float]
    area_km2: Optional[float] = None
    land_fraction: Optional[float] = Field(default=None, description="Share of the region covered by GLDAS land cells")
    grid_cells: Optional[int] = Field(default=None, description="Number of 0.25 degree GLDAS cells that contribute")
    selection: Optional[str] = Field(default=None, description="How the outline was selected from its source")
    clipping: Optional[str] = None
    boundary_source: Optional[BoundarySource] = None
    cluster: Optional[int] = Field(default=None, description="Cluster id from the fitted K-means model (ids are arbitrary)")
    cluster_role: Optional[str] = Field(default=None, description="training, or validation_assignment for a region assigned after fitting")
    overlaps: list[RegionOverlap] = []
    description: Optional[str] = None
    why_it_matters: Optional[str] = None


class GlossaryEntry(BaseModel):
    id: str
    term: str
    category: Literal["variable", "statistics", "dataset", "discovery"]
    definition: str = Field(description="One-sentence definition")
    explanation: str | None = None
    related: list[str] = Field(default=[], description="Ids of related terms")


class Provenance(BaseModel):
    dataset: str = Field(description="Where the numbers come from")
    is_development_data: bool = Field(description="True means the numbers are FAKE sample data")
    run_id: Optional[str] = Field(default=None, description="Which analysis run produced the numbers")
    review_status: Optional[str] = Field(default=None, description="For example provisional_pending_scientific_review")


class RegionSeries(BaseModel):
    region: str
    dates: list[str] = Field(description="First day of each month, YYYY-MM-DD")
    values: list[float | None] = Field(description="One value per date; null where data is missing")
    anomalies: Optional[list[float | None]] = Field(default=None, description="Value minus that calendar month's typical value (removes the seasons)")
    fitted: Optional[list[float | None]] = Field(default=None, description="The trend model's fitted line, seasons included")
    trend_component: Optional[list[float | None]] = Field(default=None, description="Just the trend part of the fit, for drawing the trend line")


class TimeseriesResponse(BaseModel):
    variable: str
    unit: str
    start: str
    end: str
    series: list[RegionSeries]
    provenance: Provenance


class MlTrend(BaseModel):
    region: str
    variable: str
    unit: str
    status: str
    reason: Optional[str] = Field(default=None, description="Why there is no trend, when status is not ok")
    start: str
    end: str
    n_observations: int
    expected_months: int
    coverage: float
    max_gap_months: Optional[int] = None
    confidence_interval: Optional[list[float]] = None
    slope_per_decade: Optional[float] = None
    ci_low: Optional[float] = None
    ci_high: Optional[float] = None
    p_value: Optional[float] = None
    q_value: Optional[float] = Field(default=None, description="p-value adjusted for testing every region and variable at once")
    direction: Optional[str] = Field(default=None, description="Sign of the slope only. Check `significant` too.")
    significant: Optional[bool] = None
    evidence: Optional[str] = Field(default=None, description="supported_increasing, supported_decreasing, inconclusive or insufficient_data")
    standardized_trend: Optional[float] = Field(default=None, description="Slope per decade divided by the SD of the region's monthly anomalies")
    fitted_period_change: Optional[float] = Field(default=None, description="Slope times the length of the window")
    hac_lags: Optional[int] = None
    method: Optional[str] = None


class ReviewEvidence(BaseModel):
    first_year: int
    first_year_mean: float
    last_year: int
    last_year_mean: float
    largest_step: float
    largest_step_from_year: int
    largest_step_to_year: int
    unit: str


class ReviewNote(BaseModel):
    status: str
    title: str
    note: str
    raised_by: Optional[str] = None
    evidence: Optional[ReviewEvidence] = Field(default=None, description="Computed from the series when the request is made")


class Hotspot(MlTrend):
    magnitude: float
    name: Optional[str] = None
    review_note: Optional[ReviewNote] = None


class Opposite(BaseModel):
    variable: str
    decreasing: MlTrend
    increasing: MlTrend


class Twin(BaseModel):
    region_a: str
    region_b: str
    distance: float
    overlap_share: Optional[float] = Field(default=None, description="Set when the two regions overlap on the map")


class PatternScope(BaseModel):
    start: str
    end: str
    run_id: str
    note: str


class DiscoveriesResponse(BaseModel):
    run_id: str
    review_status: str
    hotspots: list[Hotspot]
    opposites: list[Opposite]
    twins: list[Twin]
    limitations: list[str]
    scope: Optional[PatternScope] = None


class TrendResponse(BaseModel):
    region: str
    variable: str
    kind: Literal["precomputed", "window_estimate"] = Field(
        description="precomputed = the reviewed full-period run. window_estimate = the same method re-run for a custom date range on request."
    )
    note: str
    result: MlTrend
    provenance: Provenance


class MapTrendItem(BaseModel):
    region: str
    name: str
    slope_per_decade: Optional[float] = None
    ci_low: Optional[float] = None
    ci_high: Optional[float] = None
    standardized_trend: Optional[float] = Field(
        default=None, description="Trend in units of the region's own variability. Comparable across variables and regions, so good for map colors."
    )
    direction: Optional[str] = None
    significant: Optional[bool] = None
    evidence: Optional[str] = None
    q_value: Optional[float] = None
    under_review: bool = False


class MapTrendsResponse(BaseModel):
    variable: str
    unit: str
    run_id: str
    review_status: str
    scope: Optional[PatternScope] = None
    regions: list[MapTrendItem]


# ---- /api/analysis -----------------------------------------------------------
class AnalysisRequestEcho(BaseModel):
    regions: list[str]
    variables: list[str]
    start: str
    end: str


class Period(BaseModel):
    start: str
    end: str
    months: int


class AnalysisScope(BaseModel):
    kind: Literal["full_record", "custom_window"]
    start: str
    end: str
    months: int
    full_record: Period
    trend_source: Literal["reviewed_run", "computed_on_request"]
    note: str
    anomaly_baseline: str


class SeriesArrays(BaseModel):
    dates: list[str]
    values: list[float | None]
    anomalies: list[float | None]
    fitted: list[float | None]
    trend_component: list[float | None]


class AnnualMeans(BaseModel):
    years: list[int] = Field(description="Calendar years with all 12 months present")
    means: list[float]


class RobustnessCheck(BaseModel):
    check: str
    label: str
    status: str
    start: str
    end: str
    hac_lags: Optional[int] = None
    slope_per_decade: Optional[float] = None
    ci_low: Optional[float] = None
    ci_high: Optional[float] = None
    p_value: Optional[float] = None


class RegionResult(BaseModel):
    region: str
    name: str
    status: str
    reason: Optional[str] = None
    trend: MlTrend
    trend_source: Literal["reviewed_run", "computed_on_request"]
    full_record_trend: Optional[MlTrend] = Field(default=None, description="The reviewed full-record trend, given for reference when a custom window was run")
    series: SeriesArrays
    annual: AnnualMeans
    robustness: Optional[list[RobustnessCheck]] = Field(default=None, description="Reviewed run's sensitivity re-fits. Full record only.")
    review_note: Optional[ReviewNote] = None


class VariableResult(BaseModel):
    variable: str
    label: str
    unit: str
    gldas_field: str
    regions: list[RegionResult]


class Significance(BaseModel):
    alpha: float
    family_size: int
    method: str


class AnalysisResponse(BaseModel):
    request: AnalysisRequestEcho = Field(description="The request as the server understood it. Results belong to exactly this.")
    scope: AnalysisScope
    generated_utc: str
    significance: Significance
    robustness_note: Optional[str] = None
    results: list[VariableResult]
    provenance: Provenance


# ---- clusters / twins --------------------------------------------------------
class ClusterCenter(BaseModel):
    cluster: int
    features: dict[str, float]
    size: int
    members: list[str]


class FeatureSeparation(BaseModel):
    feature: str
    range: float = Field(description="Largest minus smallest cluster-centre value for this feature")


class ClusterAssignment(BaseModel):
    region: str
    name: str
    cluster: int
    role: str
    distance_to_center: float
    model_status: str
    fingerprint: Optional[dict[str, float]] = None


class ClustersResponse(BaseModel):
    run_id: str
    status: str
    review_status: str
    algorithm: str
    k: int
    n_training_regions: int
    features: list[str]
    scaling: str
    evaluation: dict[str, Any]
    candidates: list[dict[str, Any]]
    checks: dict[str, Any]
    centers: list[ClusterCenter]
    feature_separation: list[FeatureSeparation]
    assignments: list[ClusterAssignment]
    limitations: list[str]
    scope: PatternScope


class TrendDigest(BaseModel):
    unit: str
    slope_per_decade: Optional[float] = None
    ci_low: Optional[float] = None
    ci_high: Optional[float] = None
    q_value: Optional[float] = None
    significant: Optional[bool] = None
    evidence: Optional[str] = None
    standardized_trend: Optional[float] = None


class TwinEntry(BaseModel):
    trends: dict[str, TrendDigest] = Field(description="The four full-record trends behind this region's fingerprint")
    region: str
    name: str
    distance: float = Field(description="Euclidean distance between fingerprints. Smaller = more alike. Not a probability.")
    pair_rank: int = Field(description="Rank of this pair among all region pairs, 1 = closest")
    pair_count: int
    in_published_top_10: bool = Field(description="True if the pair is one of the ten the notebook exports in discoveries.json")
    overlap_share: Optional[float] = None
    same_cluster: bool
    cluster: Optional[int] = None
    fingerprint: dict[str, float]


class PairStats(BaseModel):
    count: int
    min: float
    median: float
    max: float


class TwinsResponse(BaseModel):
    region: str
    name: str
    cluster: Optional[int] = None
    fingerprint: dict[str, float]
    trends: dict[str, TrendDigest]
    features: list[str]
    ranking: list[TwinEntry]
    all_pairs: PairStats
    scope: PatternScope
    review_status: str
    limitations: list[str]


class PatternRegion(BaseModel):
    region: str
    name: str
    cluster: Optional[int] = None
    role: Optional[str] = None
    distance_to_center: Optional[float] = None
    fingerprint: Optional[dict[str, float]] = None
    nearest: list[TwinEntry]
    hotspots: list[Hotspot]
    opposites: list[Opposite]


class PatternPair(BaseModel):
    region_a: str
    region_b: str
    distance: float
    pair_rank: int
    pair_count: int
    overlap_share: Optional[float] = None
    same_cluster: bool


class PatternClustering(BaseModel):
    algorithm: str
    k: int
    n_training_regions: int
    features: list[str]
    scaling: str
    evaluation: dict[str, Any]
    centers: list[ClusterCenter]
    feature_separation: list[FeatureSeparation]
    limitations: list[str]


class PatternContextResponse(BaseModel):
    scope: PatternScope
    review_status: str
    model_status: str
    clustering: PatternClustering
    regions: list[PatternRegion]
    pairs: list[PatternPair]
    limitations: list[str]


# ---- /api/meta ---------------------------------------------------------------
class GeneralNote(BaseModel):
    id: str
    title: str
    note: str
    source_url: Optional[str] = None
    raised_by: Optional[str] = None


class MetaResponse(BaseModel):
    run_id: str
    schema_version: str
    review_status: str
    model_status: str
    period: Period
    min_window_months: int
    max_regions_per_run: int
    completeness: dict[str, int] = Field(description="How many monthly values the bundle should hold and how many are missing")
    dataset: dict[str, Any]
    methods: dict[str, str]
    config: dict[str, Any]
    limitations: list[str]
    review_notes: list[GeneralNote]
    boundary_sources: list[BoundarySource]
    display_geometry: Optional[dict[str, Any]] = None
    robustness_available: bool
    packages: dict[str, str]
