import json
import os
import re
import uuid
import numpy as np
from functools import lru_cache
from datetime import datetime, timezone
import pandas as pd
from pathlib import Path
from typing import Optional

from fastapi import FastAPI, HTTPException, Path as PathParam, Query
from fastapi.middleware.cors import CORSMiddleware

from schemas import GlossaryEntry, Region, Variable, TimeseriesResponse, TrendResponse, Provenance, DiscoveriesResponse, MapTrendsResponse
from analysis_engine import analyze_trend

DATA_DIR = Path(__file__).parent / "data"

app = FastAPI(
    title="RockIT API",
    description="Environmental trends from NASA GLDAS data.",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=[origin.strip() for origin in os.getenv("CORS_ORIGINS", "http://localhost:3000,http://127.0.0.1:3000").split(",") if origin.strip()],
    allow_methods=["GET"],
    allow_headers=["*"],
)

def load_json(filename):
    return json.loads((DATA_DIR / filename).read_text())

ML_DIR = DATA_DIR / "rockit"


def read_ml(name):
    return json.loads((ML_DIR / name).read_text())


MANIFEST = read_ml("manifest.json")
TRENDS = read_ml("trends.json")
CHART = read_ml("chart_data.json")
DISCOVERIES = read_ml("discoveries.json")
CLUSTERS = read_ml("clusters.json")

RUN_ID = TRENDS["run_id"]
for _name, _doc in [("manifest", MANIFEST), ("chart_data", CHART), ("discoveries", DISCOVERIES), ("clusters", CLUSTERS)]:
    if _doc["run_id"] != RUN_ID:
        raise RuntimeError(f"{_name}.json has run_id {_doc['run_id']}, expected {RUN_ID}")

REVIEW_STATUS = MANIFEST["status"]

GEOJSON = read_ml("regions.geojson")


def all_points(coords):
    if isinstance(coords[0], (int, float)):
        yield coords
    else:
        for c in coords:
            yield from all_points(c)


def build_regions():
    shapes = {f["properties"]["region_id"]: f["geometry"] for f in GEOJSON["features"]}
    regions = []
    for r in MANIFEST["source_metadata"]["regions"]:
        points = list(all_points(shapes[r["region_id"]]["coordinates"]))
        lons = [p[0] for p in points]
        lats = [p[1] for p in points]
        regions.append({
            "id": r["region_id"],
            "name": r["name"],
            "group": r["type"],
            "anchor": r.get("anchor") or [(min(lons) + max(lons)) / 2, (min(lats) + max(lats)) / 2],
            "bbox": [min(lons), min(lats), max(lons), max(lats)],
            "area_km2": r.get("hydrobasins_sub_area_km2"),
        })
    return regions


REGIONS = build_regions()

SERIES = {(s["region"], s["variable"]): s for s in CHART["series"]}
REGION_IDS = {r["id"] for r in REGIONS}

ML_PROVENANCE = {
    "dataset": "NASA GLDAS Noah Land Surface Model L4 monthly 0.25 degree, v2.1 (model estimates, not observations)",
    "is_development_data": False,
    "run_id": RUN_ID,
    "review_status": REVIEW_STATUS,
}

FULL_START, FULL_END = MANIFEST["source_metadata"]["period"]
TREND_BY_KEY = {(t["region"], t["variable"]): t for t in TRENDS["results"]}

def validate_window(start, end):
    for value in (start, end):
        if value is not None and not re.fullmatch(r"[0-9]{4}-(0[1-9]|1[0-2])(?:-01)?", value):
            raise HTTPException(422, "Dates must be YYYY-MM (or the first day of a month).")
    first, last = (start or FULL_START)[:7], (end or FULL_END)[:7]
    if first > last:
        raise HTTPException(422, "Start must not be after end.")
    if first < FULL_START or last > FULL_END:
        raise HTTPException(422, f"Available data spans {FULL_START} through {FULL_END}.")
    return first, last


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

@app.get("/api/regions", response_model=list[Region])
def get_regions(group: Optional[str] = Query(None, description="Filter by region type, for example river_basin")):
    if group is None:
        return REGIONS
    return [r for r in REGIONS if r["group"] == group]

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
    
    if variable not in variables_by_id:
        raise HTTPException(404, f"Unknown variable '{variable}'. Options: {sorted(variables_by_id)}")
    for r in region:
        if r not in REGION_IDS:
            raise HTTPException(404, f"Unknown region '{r}'. Options: {sorted(REGION_IDS)}")

    start_ym, end_ym = validate_window(start, end)

    series = []
    for r in region:
        found = SERIES.get((r, variable))
        if found is None:
            raise HTTPException(404, f"No data for region '{r}' and variable '{variable}'")
        unit = found["unit"]
        points = [
            p for p in found["series"]
            if (not start_ym or p["date"][:7] >= start_ym) and (not end_ym or p["date"][:7] <= end_ym)
        ]
        series.append(
            {
                "region": r,
                "dates": [p["date"] for p in points],
                "values": [p.get("value") for p in points],
                "anomalies": [p.get("anomaly") for p in points],
                "fitted": [p.get("fitted") for p in points],
                "trend_component": [p.get("trend_component") for p in points],
            }
        )
    all_dates = sorted(d for s in series for d in s["dates"])
    return {
        "variable": variable,
        "unit": unit,
        "start": all_dates[0] if all_dates else (start or ""),
        "end": all_dates[-1] if all_dates else (end or ""),
        "series": series,
        "provenance": ML_PROVENANCE,
    }

@app.get("/api/trend", response_model=TrendResponse, summary="Trend and significance for one region")
def trend(
    variable: str = Query(..., description="Variable id, from /api/variables", examples=["soil_moisture"]),
    region: str = Query(..., description="Region id, from /api/regions", examples=["central_valley"]),
    start: Optional[str] = Query(None, description="First month, as YYYY-MM", examples=["2001-01"]),
    end: Optional[str] = Query(None, description="Last month, as YYYY-MM", examples=["2024-12"]),
):
    """Returns the rate of change per decade for one variable in one region, with a 95% range and a significance test."""
    variable_ids = {v["id"] for v in load_json("variables.json")}
    if variable not in variable_ids:
        raise HTTPException(404, f"Unknown variable '{variable}'. Options: {sorted(variable_ids)}")
    if region not in REGION_IDS:
        raise HTTPException(404, f"Unknown region '{region}'. Options: {sorted(REGION_IDS)}")

    start_ym, end_ym = validate_window(start, end)

    precomputed = TREND_BY_KEY.get((region, variable))
    found = SERIES.get((region, variable))
    if precomputed is None or found is None:
        raise HTTPException(404, f"No data for region '{region}' and variable '{variable}'")

    full_period = (start_ym is None or start_ym <= FULL_START) and (end_ym is None or end_ym >= FULL_END)
    if full_period:
        return {
            "region": region,
            "variable": variable,
            "kind": "precomputed",
            "note": f"Full-period analysis ({FULL_START} to {FULL_END}). Significance is corrected for testing many regions at once (q_value).",
            "result": precomputed,
            "provenance": ML_PROVENANCE,
        }

    points = [
        p for p in found["series"]
        if (not start_ym or p["date"][:7] >= start_ym) and (not end_ym or p["date"][:7] <= end_ym)
    ]
    result, details = analyze_trend(
        [p["date"] for p in points],
        [float("nan") if p.get("value") is None else p["value"] for p in points],
        precomputed["unit"], start_ym, end_ym,
    )
    result.update(region=region, variable=variable)
    # A per-request trend is not a member of the original 84-test FDR family.
    result["significant"] = None
    result["q_value"] = None
    return {
        "region": region, "variable": variable, "kind": "custom_window",
        "note": "Custom-window seasonal OLS with calendar-aware HAC uncertainty. No multiple-testing correction; do not interpret the raw p-value as a confirmed discovery.",
        "result": result, "provenance": ML_PROVENANCE,
    }


@app.get("/api/discoveries", response_model=DiscoveriesResponse, summary="Hotspots, Earth Opposites and Earth Twins")
def discoveries():
    """Returns the precomputed discoveries.

    - **hotspots**: the regions and variables changing the most, strongest first
    - **opposites**: for each variable, the region getting lower versus the region getting higher
    - **twins**: pairs of regions with similar behavior (smaller distance = more alike)

    The numbers are provisional until the science review is finished."""
    return {
        "run_id": RUN_ID,
        "review_status": REVIEW_STATUS,
        "hotspots": DISCOVERIES["hotspots"],
        "opposites": DISCOVERIES["opposites"],
        "twins": DISCOVERIES["twins"],
        "limitations": MANIFEST["limitations"],
    }

@app.get("/api/map-trends", response_model=MapTrendsResponse, summary="One trend per region, for coloring the map")
def map_trends(
    variable: str = Query(..., description="Variable id, from /api/variables", examples=["precipitation"]),
):
    """Returns the full-period trend for all 21 regions for one variable."""
    variable_ids = {v["id"] for v in load_json("variables.json")}
    if variable not in variable_ids:
        raise HTTPException(404, f"Unknown variable '{variable}'. Options: {sorted(variable_ids)}")

    names = {r["id"]: r["name"] for r in REGIONS}
    items = []
    unit = ""
    for t in TRENDS["results"]:
        if t["variable"] != variable:
            continue
        unit = t["unit"]
        items.append({**t, "name": names[t["region"]]})

    return {
        "variable": variable,
        "unit": unit,
        "run_id": RUN_ID,
        "review_status": REVIEW_STATUS,
        "regions": items,
    }


@app.get("/api/regions/geojson", summary="Region outlines for the map")
def regions_geojson():
    """Returns the outlines of all 21 regions as GeoJSON. Each feature's properties include region_id."""
    return GEOJSON

def cluster_context(region):
    if region not in REGION_IDS:
        raise HTTPException(404, f"Unknown region '{region}'")
    assignments = {r["region"]: r for r in CLUSTERS["assignments"]}
    features = CLUSTERS["features"]
    fingerprints = {
        rid: {v: TREND_BY_KEY.get((rid, v), {}).get("standardized_trend") for v in features}
        for rid in REGION_IDS
    }
    own = fingerprints[region]
    neighbors = []
    if all(isinstance(own[v], (int, float)) for v in features):
        for rid, values in fingerprints.items():
            if rid == region or not all(isinstance(values[v], (int, float)) for v in features):
                continue
            distance = float(np.linalg.norm([own[v] - values[v] for v in features]))
            neighbors.append({"region": rid, "distance": distance, "cluster": assignments.get(rid, {}).get("cluster"), "fingerprint": values})
    return {**assignments.get(region, {"region": region, "cluster": None}), "fingerprint": own,
            "neighbors": sorted(neighbors, key=lambda n: (n["distance"], n["region"]))[:5]}


@app.get("/api/clusters", summary="Trained K-means groups, fingerprints and nearest regions")
def clusters(region: Optional[str] = None):
    return {**CLUSTERS, "period": [FULL_START, FULL_END], "review_status": REVIEW_STATUS,
            "provenance": ML_PROVENANCE, "context": cluster_context(region) if region else None}


@lru_cache(maxsize=1)
def map_geometry():
    """Smaller source-derived outlines for the interactive map, never analytical masks."""
    path = DATA_DIR / "rockit" / "map_regions.geojson"
    return json.loads(path.read_text()) if path.exists() else GEOJSON


@app.get("/api/map-geometry", summary="Display outlines derived from source region geometry")
def display_geometry():
    return map_geometry()


@app.get("/api/mission", summary="One complete, reproducible exploration")
def mission(
    region: list[str] = Query(..., min_length=1, max_length=2),
    variable: list[str] = Query(..., min_length=1, max_length=4),
    start: Optional[str] = None,
    end: Optional[str] = None,
):
    first, last = validate_window(start, end)
    regions = list(dict.fromkeys(region))
    variables = list(dict.fromkeys(variable))
    for rid in regions:
        if rid not in REGION_IDS:
            raise HTTPException(404, f"Unknown region '{rid}'")
    known_variables = {v["id"] for v in load_json("variables.json")}
    if any(v not in known_variables for v in variables):
        raise HTTPException(404, "An unsupported variable was selected.")
    results = []
    for vid in variables:
        history = timeseries(variable=vid, region=regions, start=first, end=last)
        trends = [trend(variable=vid, region=rid, start=first, end=last) for rid in regions]
        results.append({**history, "trends": trends})
    return {
        "id": str(uuid.uuid4()), "created_at": datetime.now(timezone.utc).isoformat(),
        "selection": {"regions": regions, "variables": variables, "start": first, "end": last},
        "results": results,
        "ml": {"algorithm": CLUSTERS["algorithm"], "k": CLUSTERS["k"], "status": CLUSTERS["status"],
               "period": [FULL_START, FULL_END], "features": CLUSTERS["features"],
               "scaling": CLUSTERS["scaling"], "n_training_regions": CLUSTERS["n_training_regions"],
               "evaluation": CLUSTERS["evaluation"], "centers": CLUSTERS["centers"],
               "assignments": CLUSTERS["assignments"], "limitations": CLUSTERS["limitations"],
               "regions": [cluster_context(rid) for rid in regions], "run_id": RUN_ID},
        "provenance": ML_PROVENANCE,
        "limitations": MANIFEST["limitations"],
        "quality_notes": (["Central Andean puna temperature contains an unusually large step-shaped change. Values are retained as supplied and require source/scientific review before interpretation."] if "central_andean_puna" in regions else []),
    }
