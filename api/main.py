import json
import pandas as pd
from pathlib import Path
from typing import Optional

from fastapi import FastAPI, HTTPException, Path as PathParam, Query
from fastapi.middleware.cors import CORSMiddleware

from schemas import GlossaryEntry, Region, Variable, TimeseriesResponse, TrendResponse, Provenance
from trend_calc import compute_trend

DATA_DIR = Path(__file__).parent / "data"
TABLE = pd.read_csv(DATA_DIR / "dev" / "sample.csv", parse_dates=["date"])
PROVENANCE = {"dataset": "DEVELOPMENT SAMPLE - fake data, NOT NASA data", "is_development_data": True}

app = FastAPI(
    title="RockIT API",
    description="Environmental trends from NASA GLDAS data.",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000", "http://127.0.0.1:3000"],
    allow_methods=["GET"],
    allow_headers=["*"],
)

def load_json(filename):
    return json.loads((DATA_DIR / filename).read_text())


@app.get("/api/health")
def health():
    return {"status": "ok"}

@app.get("/api/variables", 
         response_model=list[Variable], 
         summary="List the environmental variables")
def variables():
    """Returns the four variables (temperature, precipitation, soil moisture,
    evapotranspiration) with their units and plain-language descriptions."""
    return load_json("variables.json")

@app.get("/api/regions",
         response_model=list[Region], 
         summary="List the regions")
def regions(
    group: Optional[str] = Query(
        None,
        description="Only show regions in this group. Leave empty to see all regions.",
        examples=["Africa"],
    ),
):
    """Returns each region with its map box (`bbox`), centre point and descriptions.
    Groups: North America, South America, Oceania, Africa."""
    items = load_json("regions.json")
    if group:
        items = [r for r in items if r["group"].lower() == group.lower()]
    return items

@app.get("/api/glossary",
         response_model=list[GlossaryEntry], 
         summary="List all glossary terms")
def glossary(
    category: Optional[str] = Query(
        None,
        description="Only show terms in this category: variable, statistics, dataset or discovery. Leave empty for all.",
        examples=["statistics"],
    ),
):
    """Returns the dictionary of terms used in the app."""
    items = load_json("glossary.json")
    if category:
        items = [g for g in items if g["category"] == category]
    return items

@app.get("/api/glossary/{term_id}", 
         response_model=GlossaryEntry, 
         summary="Look up one glossary term")
def glossary_term(
    term_id: str = PathParam(..., description="The term's id, as shown in the `id` field of /api/glossary.",
        examples=["p_value"],),):
    for entry in load_json("glossary.json"):
        if entry["id"] == term_id:
            return entry
    raise HTTPException(status_code=404, detail=f"Unknown glossary term '{term_id}'")

@app.get("/api/timeseries", response_model=TimeseriesResponse, summary="Monthly history for the chart")
def timeseries(
    variable: str = Query(..., description="Variable id, from /api/variables", examples=["soil_moisture"]),
    region: list[str] = Query(
        ...,
        description="Region id, from /api/regions. Repeat it to compare regions: ?region=sahel&region=amazon_basin",
        examples=["sahel"],
    ),
    start: Optional[str] = Query(None, description="First month, as YYYY-MM. Leave empty for the earliest.", examples=["2010-01"]),
    end: Optional[str] = Query(None, description="Last month, as YYYY-MM. Leave empty for the latest.", examples=["2020-12"]),
):
    """Returns one list of monthly values per region, in the variable's unit."""
    variables_by_id = {v["id"]: v for v in load_json("variables.json")}
    region_ids = {r["id"] for r in load_json("regions.json")}

    if variable not in variables_by_id:
        raise HTTPException(404, f"Unknown variable '{variable}'. Options: {sorted(variables_by_id)}")
    for r in region:
        if r not in region_ids:
            raise HTTPException(404, f"Unknown region '{r}'. Options: {sorted(region_ids)}")

    try:
        start_date = pd.Timestamp(start) if start else TABLE["date"].min()
        end_date = pd.Timestamp(end) if end else TABLE["date"].max()
    except ValueError:
        raise HTTPException(422, "start and end must look like 2010-01")
    if start_date > end_date:
        raise HTTPException(422, "start must not be after end")

    series = []
    for r in region:
        rows = TABLE[(TABLE["variable"] == variable) & (TABLE["region"] == r)]
        rows = rows[(rows["date"] >= start_date) & (rows["date"] <= end_date)]
        series.append(
            {
                "region": r,
                "dates": rows["date"].dt.strftime("%Y-%m-%d").tolist(),
                "values": [None if pd.isna(v) else float(v) for v in rows["value"]],
            }
        )

    return {
        "variable": variable,
        "unit": variables_by_id[variable]["unit"],
        "start": start_date.strftime("%Y-%m-%d"),
        "end": end_date.strftime("%Y-%m-%d"),
        "series": series,
        "provenance": {"dataset": "DEVELOPMENT SAMPLE - fake data, NOT NASA data", "is_development_data": True},
    }

def check_request(variable, regions_wanted, start, end):
    """Validates the inputs and returns (variable info, start date, end date)."""
    variables_by_id = {v["id"]: v for v in load_json("variables.json")}
    region_ids = {r["id"] for r in load_json("regions.json")}
    if variable not in variables_by_id:
        raise HTTPException(404, f"Unknown variable '{variable}'. Options: {sorted(variables_by_id)}")
    for r in regions_wanted:
        if r not in region_ids:
            raise HTTPException(404, f"Unknown region '{r}'. Options: {sorted(region_ids)}")
    try:
        start_date = pd.Timestamp(start) if start else TABLE["date"].min()
        end_date = pd.Timestamp(end) if end else TABLE["date"].max()
    except ValueError:
        raise HTTPException(422, "start and end must look like 2010-01")
    if start_date > end_date:
        raise HTTPException(422, "start must not be after end")
    return variables_by_id[variable], start_date, end_date


@app.get("/api/trend", response_model=TrendResponse, summary="Trend and significance for one region")
def trend(
    variable: str = Query(..., description="Variable id, from /api/variables", examples=["soil_moisture"]),
    region: str = Query(..., description="Region id, from /api/regions", examples=["central_valley"]),
    start: Optional[str] = Query(None, description="First month, as YYYY-MM", examples=["2001-01"]),
    end: Optional[str] = Query(None, description="Last month, as YYYY-MM", examples=["2024-12"]),
):
    """Returns the rate of change per decade for one variable in one region, with a 95% range and a significance test."""
    var, start_date, end_date = check_request(variable, [region], start, end)
    rows = TABLE[(TABLE["variable"] == variable) & (TABLE["region"] == region)]
    rows = rows[(rows["date"] >= start_date) & (rows["date"] <= end_date)]
    try:
        result = compute_trend(rows["date"].tolist(), rows["value"].tolist(), var["unit"])
    except ValueError as error:
        raise HTTPException(422, str(error))
    return {"region": region, "variable": variable, "result": result, "provenance": PROVENANCE}