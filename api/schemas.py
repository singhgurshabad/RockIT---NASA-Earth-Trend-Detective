from typing import Literal

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
    group: str = Field(description="Continent or climate group, used by the filter")
    bbox: list[float] = Field(description="Map box as [west, south, east, north] in degrees")
    centroid: list[float] = Field(description="Centre point as [longitude, latitude]")
    boundary_type: Literal["bbox_approximation", "polygon"]
    description: str
    why_it_matters: str


class GlossaryEntry(BaseModel):
    id: str
    term: str
    category: Literal["variable", "statistics", "dataset", "discovery"]
    definition: str = Field(description="One-sentence definition")
    explanation: str | None = None
    related: list[str] = Field(default=[], description="Ids of related terms")