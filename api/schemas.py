from typing import Literal, Optional

from pydantic import BaseModel, Field


class Variable(BaseModel):
    id: str = Field(description="Short id used in other endpoints, e.g. soil_moisture")
    label: str = Field(description="Name to show on screen")
    gldas_field: str = Field(description="Name of this variable in NASA's GLDAS files")
    unit: str = Field(description="Unit of the values, e.g. kg/m²")
    description: str = Field(description="Plain-language definition for the hover bar")
    why_it_matters: str
    icon: str = Field(description="Icon name for the frontend, e.g. thermometer")


class Region(BaseModel):
    id: str
    name: str
    group: str
    anchor: list[float]
    bbox: list[float]
    area_km2: Optional[float] = None
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


class RegionSeries(BaseModel):
    region: str
    dates: list[str] = Field(description="First day of each month, YYYY-MM-DD")
    values: list[float | None] = Field(description="One value per date; null where data is missing")


class TimeseriesResponse(BaseModel):
    variable: str
    unit: str
    start: str
    end: str
    series: list[RegionSeries]
    provenance: Provenance

class TrendResult(BaseModel):
    slope_per_decade: float = Field(description="Change per decade, in the variable's unit")
    unit: str
    p_value: float = Field(description="Small (below 0.05) means chance alone is an unlikely explanation")
    significant: bool
    direction: Literal["increasing", "decreasing", "flat"] = Field(description="Sign of the slope only. Check `significant` too.")
    confidence_interval: list[float] = Field(description="95% range for the slope: [low, high]")
    method: str = Field(description="Which calculation produced this result")
    n_months: int = Field(description="Number of months with data that were used")
    missing_fraction: float = Field(description="Share of months in the range that had no data")


class TrendResponse(BaseModel):
    region: str
    variable: str
    result: TrendResult
    provenance: Provenance


class MlTrend(BaseModel):
    region: str
    variable: str
    unit: str
    status: str
    start: str
    end: str
    n_observations: int
    expected_months: int
    coverage: float
    max_gap_months: int
    slope_per_decade: Optional[float] = None
    ci_low: Optional[float] = None
    ci_high: Optional[float] = None
    p_value: Optional[float] = None
    q_value: Optional[float] = None
    direction: Optional[str] = None
    significant: Optional[bool] = None
    evidence: Optional[str] = None
    standardized_trend: Optional[float] = None
    fitted_period_change: Optional[float] = None
    hac_lags: Optional[int] = None
    method: str


class Hotspot(MlTrend):
    magnitude: float


class Opposite(BaseModel):
    variable: str
    decreasing: MlTrend
    increasing: MlTrend


class Twin(BaseModel):
    region_a: str
    region_b: str
    distance: float


class DiscoveriesResponse(BaseModel):
    run_id: str
    review_status: str
    hotspots: list[Hotspot]
    opposites: list[Opposite]
    twins: list[Twin]