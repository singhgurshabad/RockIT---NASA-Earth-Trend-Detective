"""RockIT API.

Serves the precomputed analysis bundle in data/rockit (one reviewed run of the
notebook in ../analysis) and, for custom date windows, re-runs the notebook's own
trend method on request (trend_engine.py).

Two rules this file is built around:
  1. Nothing synthetic. Every number comes from data/rockit or is computed from it.
  2. Scope is always stated. Full-record results come from the reviewed run. Window
     results are computed on request and are labelled as such. Clusters, twins and
     discoveries are only ever full-record results and are never relabelled.
"""
import csv
import io
import json
import os
import re
from datetime import datetime, timezone
from functools import lru_cache
from pathlib import Path
from typing import Optional

import numpy as np
import pandas as pd
from fastapi import FastAPI, HTTPException, Path as PathParam, Query
from fastapi.middleware.cors import CORSMiddleware
from fastapi.middleware.gzip import GZipMiddleware
from fastapi.responses import Response

from schemas import (
    AnalysisResponse,
    ClustersResponse,
    DiscoveriesResponse,
    GlossaryEntry,
    MapTrendsResponse,
    MetaResponse,
    PatternContextResponse,
    Region,
    TimeseriesResponse,
    TrendResponse,
    TwinsResponse,
    Variable,
)
from trend_engine import METHOD, MIN_WINDOW_MONTHS, analyze_trend, benjamini_hochberg

API_DIR = Path(__file__).parent
DATA_DIR = API_DIR / "data"
ML_DIR = DATA_DIR / "rockit"

# Most regions one run may compare. Four keeps every line on a chart tellable apart.
MAX_REGIONS_PER_RUN = 4

# ----------------------------------------------------------------------------
# Configuration (environment variables; see .env.example)
# ----------------------------------------------------------------------------
DEFAULT_ORIGINS = "http://localhost:3000,http://127.0.0.1:3000"
ALLOWED_ORIGINS = [o.strip() for o in os.getenv("ROCKIT_ALLOWED_ORIGINS", DEFAULT_ORIGINS).split(",") if o.strip()]
# The stability-check table. A copy ships inside the API folder so a container has it too;
# the original lives in ../analysis/results. Either way it is checked against trends.json at startup.
_ROBUSTNESS_DEFAULT = API_DIR / "data" / "rockit" / "robustness.csv"
if not _ROBUSTNESS_DEFAULT.exists():
    _ROBUSTNESS_DEFAULT = API_DIR.parent / "analysis" / "results" / "robustness.csv"
ROBUSTNESS_CSV = Path(os.getenv("ROCKIT_ROBUSTNESS_CSV", _ROBUSTNESS_DEFAULT))

app = FastAPI(
    title="RockIT API",
    description="Land-surface trends from NASA GLDAS model estimates, with the RockIT team's trend analysis and clustering.",
)

app.add_middleware(GZipMiddleware, minimum_size=2000)
app.add_middleware(
    CORSMiddleware,
    allow_origins=ALLOWED_ORIGINS,
    allow_methods=["GET"],
    allow_headers=["*"],
    expose_headers=["Content-Disposition"],
)


# ----------------------------------------------------------------------------
# Load the analysis bundle once, at startup
# ----------------------------------------------------------------------------
def load_json(filename):
    return json.loads((DATA_DIR / filename).read_text(encoding="utf-8"))


def read_ml(name):
    return json.loads((ML_DIR / name).read_text(encoding="utf-8"))


MANIFEST = read_ml("manifest.json")
TRENDS = read_ml("trends.json")
CHART = read_ml("chart_data.json")
DISCOVERIES = read_ml("discoveries.json")
CLUSTERS = read_ml("clusters.json")

RUN_ID = TRENDS["run_id"]
for _name, _doc in [("manifest", MANIFEST), ("chart_data", CHART), ("discoveries", DISCOVERIES), ("clusters", CLUSTERS)]:
    if _doc["run_id"] != RUN_ID:
        raise RuntimeError(f"{_name}.json has run_id {_doc['run_id']}, expected {RUN_ID}. Never mix files from different runs.")

CONFIG = MANIFEST["config"]
SOURCE = MANIFEST["source_metadata"]
REVIEW_STATUS = MANIFEST["status"]
MODEL_STATUS = CLUSTERS["status"]
FULL_START, FULL_END = SOURCE["period"]
FULL_MONTHS = len(pd.period_range(FULL_START, FULL_END, freq="M"))

VARIABLES = load_json("variables.json")
VARIABLE_BY_ID = {v["id"]: v for v in VARIABLES}
VARIABLE_IDS = [v["id"] for v in VARIABLES]

SERIES = {(s["region"], s["variable"]): s for s in CHART["series"]}
TREND_BY_KEY = {(t["region"], t["variable"]): t for t in TRENDS["results"]}

# Region outlines. The display file is a simplified copy for drawing (see
# scripts/build_display_geometry.py). The full file is only read if someone asks for it.
DISPLAY_PATH = ML_DIR / "regions_display.geojson"
FULL_GEOJSON_PATH = ML_DIR / "regions.geojson"
DISPLAY_GEOJSON = json.loads(DISPLAY_PATH.read_text(encoding="utf-8")) if DISPLAY_PATH.exists() else None


@lru_cache(maxsize=1)
def full_geojson():
    return json.loads(FULL_GEOJSON_PATH.read_text(encoding="utf-8"))


def all_points(coords):
    if isinstance(coords[0], (int, float)):
        yield coords
    else:
        for c in coords:
            yield from all_points(c)


def boundary_source(region_meta):
    """A short, human-readable name for where a region outline came from."""
    url = region_meta.get("source", "")
    if region_meta.get("source_dataset"):
        name = region_meta["source_dataset"]
    elif "hydrosheds" in url:
        name = "HydroSHEDS HydroBASINS (level 3)"
    elif "epa.gov" in url:
        name = "US EPA Level III Ecoregions"
    elif "census.gov" in url:
        name = "US Census Bureau cartographic boundary files (2024)"
    elif "HKH_Boundary" in url:
        name = "Hindu Kush Himalaya boundary (ICIMOD-associated publisher; reuse terms still to be verified)"
    else:
        name = "See source link"
    return {
        "name": name,
        "url": url,
        "license": region_meta.get("license"),
        "citation": region_meta.get("citation"),
    }


def build_regions():
    support = {s["region_id"]: s for s in SOURCE.get("region_support", [])}
    cluster_of = {a["region"]: a for a in CLUSTERS["assignments"]}
    if DISPLAY_GEOJSON is not None:
        shape_props = {f["properties"]["region_id"]: f["properties"] for f in DISPLAY_GEOJSON["features"]}
        overlaps = DISPLAY_GEOJSON.get("rockit_display", {}).get("overlaps", [])
    else:
        shape_props = {}
        for f in full_geojson()["features"]:
            points = list(all_points(f["geometry"]["coordinates"]))
            lons = [p[0] for p in points]
            lats = [p[1] for p in points]
            bbox = [min(lons), min(lats), max(lons), max(lats)]
            shape_props[f["properties"]["region_id"]] = {
                "bbox": bbox,
                "label_point": [(bbox[0] + bbox[2]) / 2, (bbox[1] + bbox[3]) / 2],
            }
        overlaps = []

    regions = []
    for r in SOURCE["regions"]:
        rid = r["region_id"]
        shape = shape_props[rid]
        bbox = shape["bbox"]
        sup = support.get(rid, {})
        assignment = cluster_of.get(rid, {})
        region_overlaps = []
        for o in overlaps:
            if rid in (o["region_a"], o["region_b"]):
                other = o["region_b"] if o["region_a"] == rid else o["region_a"]
                region_overlaps.append({"region": other, "share_of_smaller_region": o["share_of_smaller_region"]})
        regions.append({
            "id": rid,
            "name": r["name"],
            "group": r["type"],
            "anchor": r.get("anchor") or [(bbox[0] + bbox[2]) / 2, (bbox[1] + bbox[3]) / 2],
            "label_point": shape["label_point"],
            "bbox": bbox,
            "area_km2": round(sup["region_area_m2"] / 1e6, 1) if sup.get("region_area_m2") else r.get("hydrobasins_sub_area_km2"),
            "land_fraction": sup.get("baseline_land_fraction_of_region"),
            "grid_cells": sup.get("represented_grid_cells"),
            "selection": r.get("selection"),
            "clipping": r.get("clipping"),
            "boundary_source": boundary_source(r),
            "cluster": assignment.get("cluster"),
            "cluster_role": assignment.get("role"),
            "overlaps": region_overlaps,
        })
    return regions


REGIONS = build_regions()
REGION_BY_ID = {r["id"]: r for r in REGIONS}
REGION_IDS = set(REGION_BY_ID)
REGION_NAME = {r["id"]: r["name"] for r in REGIONS}

for _key in [(r, v) for r in REGION_IDS for v in VARIABLE_IDS]:
    if _key not in SERIES or _key not in TREND_BY_KEY:
        raise RuntimeError(f"Bundle is incomplete: no series or trend for {_key}")

ML_PROVENANCE = {
    "dataset": "NASA GLDAS Noah Land Surface Model L4 monthly 0.25 degree, v2.1 (model estimates, not observations)",
    "is_development_data": False,
    "run_id": RUN_ID,
    "review_status": REVIEW_STATUS,
}

# Fingerprints: each region's four standardized trends, exactly as the notebook builds
# them for Earth Twins and for clustering (trend per decade / SD of monthly anomalies).
FEATURES = CLUSTERS["features"]
FINGERPRINT = {
    r: {v: TREND_BY_KEY[(r, v)]["standardized_trend"] for v in FEATURES}
    for r in sorted(REGION_IDS)
    if all(TREND_BY_KEY[(r, v)]["status"] == "ok" and TREND_BY_KEY[(r, v)].get("standardized_trend") is not None for v in FEATURES)
}


def fingerprint_distance(a, b):
    return float(np.linalg.norm(np.array([FINGERPRINT[a][v] - FINGERPRINT[b][v] for v in FEATURES])))


# Every pair of regions, nearest first (the notebook publishes only the first ten).
PAIRS = sorted(
    (fingerprint_distance(a, b), a, b)
    for i, a in enumerate(sorted(FINGERPRINT))
    for b in sorted(FINGERPRINT)[i + 1:]
)
PAIR_RANK = {frozenset((a, b)): (rank + 1, d) for rank, (d, a, b) in enumerate(PAIRS)}
PUBLISHED_TWINS = {frozenset((t["region_a"], t["region_b"])) for t in DISCOVERIES["twins"]}
OVERLAP_SHARE = {
    frozenset((r["id"], o["region"])): o["share_of_smaller_region"] for r in REGIONS for o in r["overlaps"]
}

# Sensitivity checks from the reviewed run (optional file; the API works without it).
CHECK_LABELS = {
    "lag_6": "Allowing 6 months of residual correlation",
    "lag_12": "Allowing 12 months of residual correlation (the headline setting)",
    "lag_24": "Allowing 24 months of residual correlation",
    "trim_start": "Dropping the first two years",
    "trim_end": "Dropping the last two years",
}


def load_robustness():
    """Returns ({(region, variable): [rows]}, status message)."""
    if not ROBUSTNESS_CSV.exists():
        return {}, f"not found at {ROBUSTNESS_CSV}"
    table = pd.read_csv(ROBUSTNESS_CSV)
    out = {}
    for (region, variable), g in table.groupby(["region", "variable"]):
        headline = TREND_BY_KEY.get((region, variable))
        same_run = g[g.check == f"lag_{CONFIG['hac_lags']}"]
        if headline is None or same_run.empty or not np.isclose(
            same_run.iloc[0].slope_per_decade, headline["slope_per_decade"], rtol=1e-9, atol=1e-12
        ) or not np.isclose(same_run.iloc[0].ci_low, headline["ci_low"], rtol=1e-9, atol=1e-12):
            return {}, "robustness.csv does not match this run's trends.json, so it is not served"
        rows = []
        for row in g.itertuples():
            ok = row.status == "ok"
            rows.append({
                "check": row.check,
                "label": CHECK_LABELS.get(row.check, row.check),
                "status": row.status,
                "start": row.start,
                "end": row.end,
                "hac_lags": int(row.hac_lags) if ok else None,
                "slope_per_decade": float(row.slope_per_decade) if ok else None,
                "ci_low": float(row.ci_low) if ok else None,
                "ci_high": float(row.ci_high) if ok else None,
                "p_value": float(row.p_value) if ok else None,
            })
        out[(region, variable)] = rows
    return out, "ok"


ROBUSTNESS, ROBUSTNESS_STATUS = load_robustness()

REVIEW_NOTES_PATH = DATA_DIR / "review_notes.json"
REVIEW_NOTES = json.loads(REVIEW_NOTES_PATH.read_text(encoding="utf-8")) if REVIEW_NOTES_PATH.exists() else {"general": [], "series": []}
# A series note is only shown for the run it was written about.
SERIES_NOTES = {(n["region"], n["variable"]): n for n in REVIEW_NOTES.get("series", []) if n.get("run_id") == RUN_ID}


# ----------------------------------------------------------------------------
# Helpers
# ----------------------------------------------------------------------------
MONTH_PATTERN = re.compile(r"^(\d{4})-(\d{2})(-\d{2})?$")


def parse_month(text, name):
    """'2010-03' or '2010-03-15' -> '2010-03'. Anything else is a 422."""
    match = MONTH_PATTERN.match(text.strip())
    if not match or not 1 <= int(match.group(2)) <= 12:
        raise HTTPException(422, f"{name} must look like 2010-01 (year-month). Got '{text}'.")
    return f"{match.group(1)}-{match.group(2)}"


def month_count(start_ym, end_ym):
    return len(pd.period_range(start_ym, end_ym, freq="M"))


def lenient_window(start, end):
    """For the older single-purpose endpoints: missing or out-of-range dates fall back to the data's limits."""
    start_ym = parse_month(start, "start") if start else FULL_START
    end_ym = parse_month(end, "end") if end else FULL_END
    start_ym = max(start_ym, FULL_START)
    end_ym = min(end_ym, FULL_END)
    if start_ym > end_ym:
        raise HTTPException(422, f"start must not be after end, and both must overlap the data ({FULL_START} to {FULL_END}).")
    return start_ym, end_ym


def strict_window(start, end):
    """For a Run: the window must sit inside the data and be long enough for a trend."""
    start_ym = parse_month(start, "start") if start else FULL_START
    end_ym = parse_month(end, "end") if end else FULL_END
    if start_ym > end_ym:
        raise HTTPException(422, f"The start month ({start_ym}) is after the end month ({end_ym}).")
    if start_ym < FULL_START or end_ym > FULL_END:
        raise HTTPException(422, f"The data covers {FULL_START} to {FULL_END}. Pick a window inside that range (got {start_ym} to {end_ym}).")
    months = month_count(start_ym, end_ym)
    if months < MIN_WINDOW_MONTHS:
        raise HTTPException(422, f"A trend needs at least {MIN_WINDOW_MONTHS} months. {start_ym} to {end_ym} is only {months}.")
    return start_ym, end_ym


def is_full_record(start_ym, end_ym):
    return start_ym == FULL_START and end_ym == FULL_END


def check_variable(variable):
    if variable not in VARIABLE_BY_ID:
        raise HTTPException(404, f"Unknown variable '{variable}'. Options: {sorted(VARIABLE_BY_ID)}")


def check_region(region):
    if region not in REGION_IDS:
        raise HTTPException(404, f"Unknown region '{region}'. Options: {sorted(REGION_IDS)}")


def unique(items):
    seen = []
    for item in items:
        if item not in seen:
            seen.append(item)
    return seen


def clean(value):
    """NaN / numpy scalars -> plain JSON values."""
    if value is None:
        return None
    if isinstance(value, (np.floating, float)):
        return float(value) if np.isfinite(value) else None
    if isinstance(value, np.integer):
        return int(value)
    if isinstance(value, np.bool_):
        return bool(value)
    return value


def evidence_label(result):
    """Same wording rule as the notebook: only FDR-supported trends get a direction."""
    if result.get("status") != "ok":
        return "insufficient_data"
    return f"supported_{result['direction']}" if result.get("significant") else "inconclusive"


@lru_cache(maxsize=16)
def window_family(start_ym, end_ym):
    """Runs the notebook's trend method on every region and variable for one window.

    All 84 series are fitted, not just the requested ones, because the false-discovery
    correction is defined over the whole family of tests in a run. That way a window
    result gets the same kind of q-value as the reviewed full-record run.
    """
    results = {}
    details = {}
    for (region, variable), s in SERIES.items():
        points = s["series"]
        result, detail = analyze_trend(
            [p["date"] for p in points],
            [np.nan if p.get("value") is None else p["value"] for p in points],
            CONFIG,
            unit=s["unit"],
            start=start_ym,
            end=end_ym,
        )
        result.update(region=region, variable=variable, q_value=None, significant=False)
        results[(region, variable)] = result
        details[(region, variable)] = detail
    ok_keys = [k for k, r in results.items() if r["status"] == "ok"]
    q_values, reject = benjamini_hochberg([results[k]["p_value"] for k in ok_keys], CONFIG["alpha"])
    for key, q, rejected in zip(ok_keys, q_values, reject):
        results[key]["q_value"] = float(q)
        results[key]["significant"] = bool(rejected)
    for result in results.values():
        result["evidence"] = evidence_label(result)
    return results, details


def series_arrays(region, variable, start_ym, end_ym):
    """Monthly values and fitted components for one series and window.

    Full record: straight from the reviewed run's chart_data.json.
    Custom window: re-fitted for that window, so the fitted line, the trend line and the
    anomaly baseline all belong to the same window as the reported trend.
    """
    if is_full_record(start_ym, end_ym):
        points = SERIES[(region, variable)]["series"]
        return {
            "dates": [p["date"] for p in points],
            "values": [p.get("value") for p in points],
            "anomalies": [p.get("anomaly") for p in points],
            "fitted": [p.get("fitted") for p in points],
            "trend_component": [p.get("trend_component") for p in points],
        }
    _, details = window_family(start_ym, end_ym)
    detail = details[(region, variable)]
    if detail is None:
        # Not enough data for a fit: still return the raw values for the window.
        points = [p for p in SERIES[(region, variable)]["series"] if start_ym <= p["date"][:7] <= end_ym]
        blank = [None] * len(points)
        return {
            "dates": [p["date"] for p in points],
            "values": [p.get("value") for p in points],
            "anomalies": blank,
            "fitted": blank,
            "trend_component": blank,
        }
    return {
        "dates": [d.strftime("%Y-%m-%d") for d in detail["date"]],
        "values": [clean(v) for v in detail["value"]],
        "anomalies": [clean(v) for v in detail["anomaly"]],
        "fitted": [clean(v) for v in detail["fitted"]],
        "trend_component": [clean(v) for v in detail["trend_component"]],
    }


def trend_for(region, variable, start_ym, end_ym):
    if is_full_record(start_ym, end_ym):
        return TREND_BY_KEY[(region, variable)]
    results, _ = window_family(start_ym, end_ym)
    return {k: clean(v) if not isinstance(v, list) else [clean(x) for x in v] for k, v in results[(region, variable)].items()}


def annual_means(dates, values):
    """Mean of each calendar year that has all 12 months (the notebook's inspection view)."""
    by_year = {}
    for date, value in zip(dates, values):
        by_year.setdefault(int(date[:4]), []).append(value)
    years, means = [], []
    for year in sorted(by_year):
        vals = by_year[year]
        if len(vals) == 12 and all(v is not None for v in vals):
            years.append(year)
            means.append(float(np.mean(vals)))
    return {"years": years, "means": means}


def review_note_for(region, variable):
    """A hand-written review flag plus evidence computed from the data at request time."""
    note = SERIES_NOTES.get((region, variable))
    if note is None:
        return None
    points = SERIES[(region, variable)]["series"]
    annual = annual_means([p["date"] for p in points], [p.get("value") for p in points])
    evidence = None
    if len(annual["years"]) >= 2:
        steps = np.diff(annual["means"])
        biggest = int(np.argmax(np.abs(steps)))
        evidence = {
            "first_year": annual["years"][0],
            "first_year_mean": annual["means"][0],
            "last_year": annual["years"][-1],
            "last_year_mean": annual["means"][-1],
            "largest_step": float(steps[biggest]),
            "largest_step_from_year": annual["years"][biggest],
            "largest_step_to_year": annual["years"][biggest + 1],
            "unit": SERIES[(region, variable)]["unit"],
        }
    return {**{k: v for k, v in note.items() if k not in ("region", "variable", "run_id")}, "evidence": evidence}


def scope_block(start_ym, end_ym):
    full = is_full_record(start_ym, end_ym)
    return {
        "kind": "full_record" if full else "custom_window",
        "start": start_ym,
        "end": end_ym,
        "months": month_count(start_ym, end_ym),
        "full_record": {"start": FULL_START, "end": FULL_END, "months": FULL_MONTHS},
        "trend_source": "reviewed_run" if full else "computed_on_request",
        "note": (
            f"Full record ({FULL_START} to {FULL_END}). Trends, fitted lines and anomalies are the reviewed run's own exports (run {RUN_ID})."
            if full else
            f"Custom window ({start_ym} to {end_ym}). Trends were computed for this request with the reviewed run's method and settings, "
            "and corrected for multiple testing across all 84 region-variable series in the same window. "
            "They are not part of the reviewed run. Choosing a window after looking at the data can make a trend look more certain than it is, "
            "so treat window results as exploration and the full-record result as the reference."
        ),
        "anomaly_baseline": f"Each calendar month's own average over {start_ym} to {end_ym}",
    }


def pattern_scope():
    return {
        "start": FULL_START,
        "end": FULL_END,
        "run_id": RUN_ID,
        "note": (
            f"Clusters, twins and discoveries describe the full record ({FULL_START} to {FULL_END}) from the reviewed run. "
            "They are precomputed and are not recalculated for a custom date window."
        ),
    }


def trend_digest(region):
    """The four full-record trends behind a fingerprint, in their own units."""
    keep = ("unit", "slope_per_decade", "ci_low", "ci_high", "q_value", "significant", "evidence", "standardized_trend")
    return {v: {k: TREND_BY_KEY[(region, v)].get(k) for k in keep} for v in FEATURES}


def twin_entry(region, other):
    rank, distance = PAIR_RANK[frozenset((region, other))]
    return {
        "trends": trend_digest(other),
        "region": other,
        "name": REGION_NAME[other],
        "distance": distance,
        "pair_rank": rank,
        "pair_count": len(PAIRS),
        "in_published_top_10": frozenset((region, other)) in PUBLISHED_TWINS,
        "overlap_share": OVERLAP_SHARE.get(frozenset((region, other))),
        "same_cluster": REGION_BY_ID[region]["cluster"] == REGION_BY_ID[other]["cluster"],
        "cluster": REGION_BY_ID[other]["cluster"],
        "fingerprint": FINGERPRINT[other],
    }


def ranked_twins(region):
    if region not in FINGERPRINT:
        return []
    others = [r for r in FINGERPRINT if r != region]
    return sorted((twin_entry(region, o) for o in others), key=lambda t: t["distance"])


def cluster_summary():
    centers = {c["cluster"]: c["features"] for c in CLUSTERS["centers"]}
    members = {}
    for a in CLUSTERS["assignments"]:
        members.setdefault(a["cluster"], []).append(a["region"])
    # Which feature separates the cluster centres most? (Describes the fitted model; it is not a new analysis.)
    spread = sorted(
        ({"feature": f, "range": float(max(c[f] for c in centers.values()) - min(c[f] for c in centers.values()))} for f in FEATURES),
        key=lambda item: -item["range"],
    )
    return {
        "run_id": RUN_ID,
        "status": CLUSTERS["status"],
        "review_status": REVIEW_STATUS,
        "algorithm": CLUSTERS["algorithm"],
        "k": CLUSTERS["k"],
        "n_training_regions": CLUSTERS["n_training_regions"],
        "features": FEATURES,
        "scaling": CLUSTERS["scaling"],
        "evaluation": CLUSTERS["evaluation"],
        "candidates": CLUSTERS["candidates"],
        "checks": {
            "silhouette_at_least": 0.25,
            "min_group_size_at_least": 3,
            "seed_ari_at_least": 0.8,
            "endpoint_ari_at_least": 0.7,
            "source": "Heuristic cut-offs chosen by the RockIT team in the analysis notebook (section 7). They are not a NASA standard.",
        },
        "centers": [
            {"cluster": c, "features": centers[c], "size": len(members.get(c, [])), "members": sorted(members.get(c, []))}
            for c in sorted(centers)
        ],
        "feature_separation": spread,
        "assignments": [
            {**a, "name": REGION_NAME[a["region"]], "fingerprint": FINGERPRINT.get(a["region"])} for a in CLUSTERS["assignments"]
        ],
        "limitations": CLUSTERS["limitations"],
        "scope": pattern_scope(),
    }


# ----------------------------------------------------------------------------
# Status and reference endpoints
# ----------------------------------------------------------------------------
@app.get("/api/health", summary="Is the API up, and which run is it serving?")
def health():
    return {
        "status": "ok",
        "run_id": RUN_ID,
        "review_status": REVIEW_STATUS,
        "model_status": MODEL_STATUS,
        "period": {"start": FULL_START, "end": FULL_END},
        "regions": len(REGIONS),
        "variables": len(VARIABLES),
        "series": len(SERIES),
        "robustness": ROBUSTNESS_STATUS,
        "display_geometry": DISPLAY_GEOJSON is not None,
    }


@app.get("/api/meta", response_model=MetaResponse, summary="Everything the app needs to describe the data and methods")
def meta():
    """Coverage, limits, methods, sources and limitations of the run being served."""
    sources = {}
    for r in SOURCE["regions"]:
        src = boundary_source(r)
        entry = sources.setdefault(src["name"], {**src, "regions": []})
        entry["regions"].append(r["region_id"])
    return {
        "run_id": RUN_ID,
        "schema_version": MANIFEST["schema_version"],
        "review_status": REVIEW_STATUS,
        "model_status": MODEL_STATUS,
        "period": {"start": FULL_START, "end": FULL_END, "months": FULL_MONTHS},
        "min_window_months": MIN_WINDOW_MONTHS,
        "max_regions_per_run": MAX_REGIONS_PER_RUN,
        "completeness": {
            "series": len(SERIES),
            "values_expected": len(SERIES) * FULL_MONTHS,
            "values_missing": sum(1 for s in SERIES.values() for p in s["series"] if p.get("value") is None)
            + sum(FULL_MONTHS - len(s["series"]) for s in SERIES.values()),
        },
        "dataset": {
            "product": SOURCE["product"],
            "version": SOURCE["version"],
            "title": "NASA GLDAS Noah Land Surface Model L4 monthly 0.25 x 0.25 degree, Version 2.1",
            "kind": "Land-surface model estimates driven by weather analyses and observations. Not direct measurements.",
            "url": "https://www.earthdata.nasa.gov/data/catalog/ges-disc-gldas-noah025-m-2.1",
            "citation": "Beaudoing, H., Rodell, M., and NASA/GSFC/HSL (2020). GLDAS Noah Land Surface Model L4 monthly 0.25 x 0.25 degree, Version 2.1. NASA GES DISC.",
            "granules": len(SOURCE.get("source_granules", [])),
            "extracted_utc": SOURCE.get("created_utc"),
            "input_sha256": MANIFEST.get("input_sha256"),
            "native_units": SOURCE.get("native_units"),
            "unit_conversions": {
                "surface_temperature": "kelvin minus 273.15 gives degrees Celsius",
                "precipitation": "kg per square metre per second times 86,400 gives mm per day (the month's average daily rate)",
                "evapotranspiration": "kg per square metre per second times 86,400 gives mm per day (the month's average daily rate)",
                "soil_moisture": "kg per square metre, unchanged (1 kg per square metre is about 1 mm of water)",
            },
            "area_weighting": SOURCE.get("weighting"),
            "coverage_definition": SOURCE.get("coverage_definition"),
        },
        "methods": {
            "trend": (
                "Least-squares fit of the monthly values with a straight-line trend and one term per calendar month, so the seasonal cycle is "
                f"fitted rather than removed first. The slope's uncertainty allows for month-to-month correlation up to {CONFIG['hac_lags']} months "
                "(Bartlett / Newey-West). The 95% range is for the slope only and does not include uncertainty in the GLDAS model itself."
            ),
            "multiple_testing": (
                f"{MANIFEST['trend_test_count']} trends are tested in one run (every region and variable). A trend is called 'supported' only if its "
                f"Benjamini-Hochberg adjusted p-value (q) is at most {CONFIG['alpha']}. 'Inconclusive' means not enough evidence. It does not mean no change."
            ),
            "anomaly": "A month's value minus the average for that calendar month over the analysis window. Used for charts; the trend test uses the full fit.",
            "fingerprint": "A region's four trends, each divided by the standard deviation of that region's monthly anomalies, so variables with different units can be compared.",
            "twins": "Straight-line (Euclidean) distance between two regions' fingerprints. Smaller means more similar change since 2001. It is not a probability and does not mean a similar climate.",
            "clusters": (
                f"K-means on the fingerprints of {CLUSTERS['n_training_regions']} regions, trying 2 to 5 groups. "
                f"{CLUSTERS['k']} groups was the only choice that passed the team's stability checks."
            ),
            "trend_method_label": METHOD,
        },
        "config": CONFIG,
        "limitations": unique(MANIFEST["limitations"] + SOURCE.get("limitations", []) + CLUSTERS["limitations"]),
        "review_notes": REVIEW_NOTES.get("general", []),
        "boundary_sources": list(sources.values()),
        "display_geometry": (DISPLAY_GEOJSON or {}).get("rockit_display"),
        "robustness_available": bool(ROBUSTNESS),
        "packages": MANIFEST.get("packages", {}),
    }


@app.get("/api/variables", response_model=list[Variable], summary="List the environmental variables")
def variables():
    """Returns the four variables (surface temperature, precipitation, soil moisture,
    evapotranspiration) with their units and plain-language descriptions."""
    return VARIABLES


@app.get("/api/regions", response_model=list[Region], summary="List the regions")
def get_regions(group: Optional[str] = Query(None, description="Filter by region type, for example river_basin")):
    if group is None:
        return REGIONS
    return [r for r in REGIONS if r["group"] == group]


@app.get("/api/regions/geojson", summary="Region outlines for the map")
def regions_geojson(
    detail: str = Query("display", pattern="^(display|full)$", description="display = simplified for drawing (about 260 KB). full = the analysis geometry (about 17 MB)."),
):
    """Returns the outlines of all 21 regions as GeoJSON. Each feature's properties include region_id.

    The default is a simplified copy for drawing. The analysis itself used the full-resolution file."""
    if detail == "display" and DISPLAY_GEOJSON is not None:
        return DISPLAY_GEOJSON
    return full_geojson()


@app.get("/api/glossary", response_model=list[GlossaryEntry], summary="List all glossary terms")
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


@app.get("/api/glossary/{term_id}", response_model=GlossaryEntry, summary="Look up one glossary term")
def glossary_term(
    term_id: str = PathParam(..., description="The term's id, as shown in the `id` field of /api/glossary.", examples=["p_value"]),
):
    for entry in load_json("glossary.json"):
        if entry["id"] == term_id:
            return entry
    raise HTTPException(status_code=404, detail=f"Unknown glossary term '{term_id}'")


# ----------------------------------------------------------------------------
# The Run: one request, results tied to exactly what was asked
# ----------------------------------------------------------------------------
@app.get("/api/analysis", response_model=AnalysisResponse, summary="Run an analysis for chosen regions, variables and dates")
def analysis(
    region: list[str] = Query(..., description=f"Region id. Repeat to compare up to {MAX_REGIONS_PER_RUN} regions."),
    variable: list[str] = Query(..., description="Variable id. Repeat for several variables."),
    start: Optional[str] = Query(None, description="First month, YYYY-MM. Empty = start of the record.", examples=["2001-01"]),
    end: Optional[str] = Query(None, description="Last month, YYYY-MM. Empty = end of the record.", examples=["2024-12"]),
):
    """Validates the whole request, then returns, for every variable and region asked for:
    the monthly series for the window, the trend with its uncertainty, and where that trend came from.

    * Full record: the reviewed run's precomputed results, plus its sensitivity checks.
    * Custom window: the same method re-run for that window on request (clearly labelled),
      with the full-record trend alongside for reference.
    """
    regions = unique(region)
    variables_asked = unique(variable)
    if len(regions) > MAX_REGIONS_PER_RUN:
        raise HTTPException(422, f"Compare at most {MAX_REGIONS_PER_RUN} regions in one run (got {len(regions)}).")
    for r in regions:
        check_region(r)
    for v in variables_asked:
        check_variable(v)
    start_ym, end_ym = strict_window(start, end)
    full = is_full_record(start_ym, end_ym)
    scope = scope_block(start_ym, end_ym)

    results = []
    for v in variables_asked:
        info = VARIABLE_BY_ID[v]
        region_results = []
        for r in regions:
            trend = trend_for(r, v, start_ym, end_ym)
            series = series_arrays(r, v, start_ym, end_ym)
            region_results.append({
                "region": r,
                "name": REGION_NAME[r],
                "status": trend["status"],
                "reason": trend.get("reason"),
                "trend": trend,
                "trend_source": scope["trend_source"],
                "full_record_trend": None if full else TREND_BY_KEY[(r, v)],
                "series": series,
                "annual": annual_means(series["dates"], series["values"]),
                "robustness": ROBUSTNESS.get((r, v)) if full else None,
                "review_note": review_note_for(r, v),
            })
        results.append({
            "variable": v,
            "label": info["label"],
            "unit": SERIES[(regions[0], v)]["unit"],
            "gldas_field": info["gldas_field"],
            "regions": region_results,
        })

    return {
        "request": {"regions": regions, "variables": variables_asked, "start": start_ym, "end": end_ym},
        "scope": scope,
        "generated_utc": datetime.now(timezone.utc).isoformat(timespec="seconds"),
        "significance": {
            "alpha": CONFIG["alpha"],
            "family_size": MANIFEST["trend_test_count"],
            "method": "Benjamini-Hochberg false discovery rate across every region and variable in the same window",
        },
        "robustness_note": (
            None if not full else
            ("Sensitivity checks are the reviewed run's own re-fits." if ROBUSTNESS else f"Sensitivity checks are unavailable ({ROBUSTNESS_STATUS}).")
        ),
        "results": results,
        "provenance": ML_PROVENANCE,
    }


@app.get("/api/pattern-context", response_model=PatternContextResponse, summary="Clusters, twins and discoveries for chosen regions")
def pattern_context(
    region: list[str] = Query(..., description="Region id. Repeat for several regions."),
):
    """The precomputed machine-learning and discovery results that involve the chosen regions.

    Always the full record of the reviewed run. Never recalculated for a date window."""
    regions = unique(region)
    for r in regions:
        check_region(r)
    summary = cluster_summary()
    assignment = {a["region"]: a for a in CLUSTERS["assignments"]}
    items = []
    for r in regions:
        a = assignment.get(r)
        items.append({
            "region": r,
            "name": REGION_NAME[r],
            "cluster": a["cluster"] if a else None,
            "role": a["role"] if a else None,
            "distance_to_center": a["distance_to_center"] if a else None,
            "fingerprint": FINGERPRINT.get(r),
            "nearest": ranked_twins(r)[:3],
            "hotspots": [h for h in DISCOVERIES["hotspots"] if h["region"] == r],
            "opposites": [o for o in DISCOVERIES["opposites"] if r in (o["decreasing"]["region"], o["increasing"]["region"])],
        })
    pairs = []
    for i, a in enumerate(regions):
        for b in regions[i + 1:]:
            if a in FINGERPRINT and b in FINGERPRINT:
                rank, distance = PAIR_RANK[frozenset((a, b))]
                pairs.append({
                    "region_a": a, "region_b": b, "distance": distance, "pair_rank": rank, "pair_count": len(PAIRS),
                    "overlap_share": OVERLAP_SHARE.get(frozenset((a, b))),
                    "same_cluster": REGION_BY_ID[a]["cluster"] == REGION_BY_ID[b]["cluster"],
                })
    return {
        "scope": pattern_scope(),
        "review_status": REVIEW_STATUS,
        "model_status": MODEL_STATUS,
        "clustering": {k: summary[k] for k in ("algorithm", "k", "n_training_regions", "features", "scaling", "evaluation", "centers", "feature_separation", "limitations")},
        "regions": items,
        "pairs": pairs,
        "limitations": unique(MANIFEST["limitations"] + CLUSTERS["limitations"]),
    }


@app.get("/api/clusters", response_model=ClustersResponse, summary="The fitted clustering, with every region's fingerprint")
def clusters():
    """K-means groups of regions whose four trends changed in a similar way over the full record.

    Descriptive only: cluster ids are arbitrary, and no accuracy or prediction is claimed."""
    return cluster_summary()


@app.get("/api/twins", response_model=TwinsResponse, summary="Earth Twins: every other region ranked by similarity to one region")
def twins(region: str = Query(..., description="Region id, from /api/regions", examples=["alaska_tundra"])):
    """Ranks all other regions by how similar their 2001 to 2024 change was to the chosen region's.

    Uses the reviewed run's fingerprints and the notebook's distance. The notebook publishes
    the ten closest pairs overall; this endpoint lists every pairing for one region."""
    check_region(region)
    if region not in FINGERPRINT:
        raise HTTPException(404, f"Region '{region}' has no complete fingerprint in this run, so it cannot be compared.")
    ranking = ranked_twins(region)
    distances = [d for d, _, _ in PAIRS]
    return {
        "region": region,
        "name": REGION_NAME[region],
        "cluster": REGION_BY_ID[region]["cluster"],
        "fingerprint": FINGERPRINT[region],
        "trends": trend_digest(region),
        "features": FEATURES,
        "ranking": ranking,
        "all_pairs": {
            "count": len(PAIRS),
            "min": distances[0],
            "median": float(np.median(distances)),
            "max": distances[-1],
        },
        "scope": pattern_scope(),
        "review_status": REVIEW_STATUS,
        "limitations": [
            "Similar change since 2001, not a similar climate. Two very different places can share a fingerprint.",
            "Distance is not a probability and has no significance test.",
            "Fingerprints include trends that are individually inconclusive, so matches are exploratory.",
            "Some regions overlap on the map. Overlapping regions share grid cells, so their similarity is partly built in.",
        ],
    }


# ----------------------------------------------------------------------------
# Single-purpose endpoints (kept for other clients; same numbers as /api/analysis)
# ----------------------------------------------------------------------------
@app.get("/api/timeseries", response_model=TimeseriesResponse, summary="Monthly history for the chart")
def timeseries(
    variable: str = Query(..., description="Variable id, from /api/variables", examples=["soil_moisture"]),
    region: list[str] = Query(
        ...,
        description="Region id, from /api/regions. Repeat it to compare regions: ?region=sahara&region=amazon",
        examples=["sahara"],
    ),
    start: Optional[str] = Query(None, description="First month, as YYYY-MM. Leave empty for the earliest.", examples=["2010-01"]),
    end: Optional[str] = Query(None, description="Last month, as YYYY-MM. Leave empty for the latest.", examples=["2020-12"]),
):
    """Returns one list of monthly values per region, in the variable's unit.

    For a custom window the anomalies, fitted line and trend line are re-fitted for that window."""
    check_variable(variable)
    for r in region:
        check_region(r)
    start_ym, end_ym = lenient_window(start, end)
    if not is_full_record(start_ym, end_ym) and month_count(start_ym, end_ym) < MIN_WINDOW_MONTHS:
        # Too short for a fit: return raw values only.
        series = []
        for r in region:
            points = [p for p in SERIES[(r, variable)]["series"] if start_ym <= p["date"][:7] <= end_ym]
            series.append({"region": r, "dates": [p["date"] for p in points], "values": [p.get("value") for p in points],
                           "anomalies": None, "fitted": None, "trend_component": None})
    else:
        series = [{"region": r, **series_arrays(r, variable, start_ym, end_ym)} for r in region]
    all_dates = sorted(d for s in series for d in s["dates"])
    return {
        "variable": variable,
        "unit": SERIES[(region[0], variable)]["unit"],
        "start": all_dates[0] if all_dates else start_ym,
        "end": all_dates[-1] if all_dates else end_ym,
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
    check_variable(variable)
    check_region(region)
    start_ym, end_ym = lenient_window(start, end)
    if is_full_record(start_ym, end_ym):
        return {
            "region": region,
            "variable": variable,
            "kind": "precomputed",
            "note": f"Full-period analysis ({FULL_START} to {FULL_END}). Significance is corrected for testing many regions at once (q_value).",
            "result": TREND_BY_KEY[(region, variable)],
            "provenance": ML_PROVENANCE,
        }
    months = month_count(start_ym, end_ym)
    if months < MIN_WINDOW_MONTHS:
        raise HTTPException(422, f"A trend needs at least {MIN_WINDOW_MONTHS} months. {start_ym} to {end_ym} is only {months}.")
    return {
        "region": region,
        "variable": variable,
        "kind": "window_estimate",
        "note": scope_block(start_ym, end_ym)["note"],
        "result": trend_for(region, variable, start_ym, end_ym),
        "provenance": ML_PROVENANCE,
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
        "hotspots": [{**h, "name": REGION_NAME[h["region"]], "review_note": review_note_for(h["region"], h["variable"])} for h in DISCOVERIES["hotspots"]],
        "opposites": DISCOVERIES["opposites"],
        "twins": [{**t, "overlap_share": OVERLAP_SHARE.get(frozenset((t["region_a"], t["region_b"])))} for t in DISCOVERIES["twins"]],
        "limitations": MANIFEST["limitations"],
        "scope": pattern_scope(),
    }


@app.get("/api/map-trends", response_model=MapTrendsResponse, summary="One trend per region, for coloring the map")
def map_trends(
    variable: str = Query(..., description="Variable id, from /api/variables", examples=["precipitation"]),
):
    """Returns the full-period trend for all 21 regions for one variable."""
    check_variable(variable)
    items = []
    unit = ""
    for t in TRENDS["results"]:
        if t["variable"] != variable:
            continue
        unit = t["unit"]
        items.append({**t, "name": REGION_NAME[t["region"]], "under_review": (t["region"], variable) in SERIES_NOTES})
    return {
        "variable": variable,
        "unit": unit,
        "run_id": RUN_ID,
        "review_status": REVIEW_STATUS,
        "scope": pattern_scope(),
        "regions": items,
    }


# ----------------------------------------------------------------------------
# Downloads
# ----------------------------------------------------------------------------
@app.get("/api/export", summary="Download the results of a run as CSV")
def export(
    region: list[str] = Query(..., description="Region id. Repeat for several."),
    variable: list[str] = Query(..., description="Variable id. Repeat for several."),
    start: Optional[str] = Query(None, description="First month, YYYY-MM"),
    end: Optional[str] = Query(None, description="Last month, YYYY-MM"),
    kind: str = Query("monthly", pattern="^(monthly|trends)$", description="monthly = one row per month. trends = one row per region and variable."),
):
    """Same validation and same numbers as /api/analysis, as a CSV file."""
    payload = analysis(region=region, variable=variable, start=start, end=end)
    scope = payload["scope"]
    buffer = io.StringIO()
    writer = csv.writer(buffer, lineterminator="\n")
    if kind == "monthly":
        writer.writerow(["date", "region", "region_name", "variable", "unit", "value", "anomaly", "fitted", "trend_component",
                         "window_start", "window_end", "fit_source", "run_id"])
        for result in payload["results"]:
            for item in result["regions"]:
                s = item["series"]
                for i, date in enumerate(s["dates"]):
                    writer.writerow([
                        date, item["region"], item["name"], result["variable"], result["unit"],
                        _cell(s["values"][i]), _cell(s["anomalies"][i]), _cell(s["fitted"][i]), _cell(s["trend_component"][i]),
                        scope["start"], scope["end"], scope["trend_source"], RUN_ID,
                    ])
    else:
        columns = ["status", "slope_per_decade", "ci_low", "ci_high", "p_value", "q_value", "significant", "evidence", "direction",
                   "standardized_trend", "fitted_period_change", "n_observations", "expected_months", "coverage", "max_gap_months",
                   "hac_lags", "method"]
        writer.writerow(["region", "region_name", "variable", "unit", "window_start", "window_end", "fit_source", *columns,
                         "review_status", "under_review_note", "run_id"])
        for result in payload["results"]:
            for item in result["regions"]:
                t = item["trend"]
                writer.writerow([
                    item["region"], item["name"], result["variable"], result["unit"], scope["start"], scope["end"], scope["trend_source"],
                    *[_cell(t.get(c)) for c in columns],
                    REVIEW_STATUS, (item["review_note"] or {}).get("title", ""), RUN_ID,
                ])
    filename = f"rockit_{kind}_{scope['start']}_{scope['end']}.csv"
    return Response(
        content=buffer.getvalue(),
        media_type="text/csv; charset=utf-8",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )


def _cell(value):
    """Missing stays empty in the CSV. It is never written as 0."""
    return "" if value is None else value
