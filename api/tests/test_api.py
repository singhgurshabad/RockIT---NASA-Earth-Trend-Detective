"""Integration tests for the RockIT API.

They use the real analysis bundle (no mocks, no synthetic data) and check three things:
  1. the API's trend engine reproduces the reviewed run's exported numbers;
  2. a Run returns results for exactly what was asked, with the right scope labels;
  3. bad requests fail with a clear message instead of a wrong answer.

Run from the api folder:  python -m pytest -q
"""
import csv
import hashlib
import io
import json
from pathlib import Path

import numpy as np
import pandas as pd
import pytest
from fastapi.testclient import TestClient

import main
from trend_engine import analyze_trend, benjamini_hochberg

REPO = Path(__file__).resolve().parents[2]
client = TestClient(main.app)


def series_inputs(region, variable):
    points = main.SERIES[(region, variable)]["series"]
    return [p["date"] for p in points], [p["value"] for p in points]


# ---- 1. the engine reproduces the reviewed run --------------------------------
def test_engine_reproduces_every_exported_trend_and_q_value():
    rows = []
    for (region, variable), expected in main.TREND_BY_KEY.items():
        dates, values = series_inputs(region, variable)
        got, _ = analyze_trend(dates, values, main.CONFIG, unit=expected["unit"])
        assert got["status"] == expected["status"] == "ok"
        for field in ["slope_per_decade", "ci_low", "ci_high", "p_value", "standardized_trend", "fitted_period_change", "coverage"]:
            assert got[field] == pytest.approx(expected[field], rel=1e-8, abs=1e-12), (region, variable, field)
        assert got["direction"] == expected["direction"]
        assert got["n_observations"] == expected["n_observations"]
        rows.append((got["p_value"], expected["q_value"], expected["significant"]))
    q, reject = benjamini_hochberg([r[0] for r in rows], main.CONFIG["alpha"])
    assert q == pytest.approx([r[1] for r in rows], rel=1e-8, abs=1e-12)
    assert list(reject) == [r[2] for r in rows]
    assert len(rows) == main.MANIFEST["trend_test_count"] == 84


def test_engine_reproduces_exported_chart_components():
    for key in [("amazon", "precipitation"), ("alaska_tundra", "surface_temperature"), ("pampas", "soil_moisture")]:
        dates, values = series_inputs(*key)
        _, detail = analyze_trend(dates, values, main.CONFIG)
        exported = pd.DataFrame(main.SERIES[key]["series"])
        for column in ["anomaly", "fitted", "trend_component"]:
            assert detail[column].to_numpy() == pytest.approx(exported[column].to_numpy(), rel=1e-8, abs=1e-9), (key, column)


def test_engine_reproduces_the_runs_window_and_lag_refits():
    """robustness.csv holds the notebook's own re-fits on shorter windows and other lag settings."""
    table = pd.read_csv(REPO / "analysis" / "results" / "robustness.csv")
    assert len(table) == 84 * 5
    for row in table.itertuples():
        dates, values = series_inputs(row.region, row.variable)
        got, _ = analyze_trend(dates, values, main.CONFIG, start=row.start, end=row.end, lags=row.hac_lags)
        assert got["slope_per_decade"] == pytest.approx(row.slope_per_decade, rel=1e-8, abs=1e-12)
        assert got["ci_low"] == pytest.approx(row.ci_low, rel=1e-8, abs=1e-12)
        assert got["p_value"] == pytest.approx(row.p_value, rel=1e-7, abs=1e-300)


def test_engine_keeps_missing_months_missing():
    dates = pd.date_range("2001-01-01", "2024-12-01", freq="MS")
    rng = np.random.default_rng(42)
    values = 10 + 2 * np.arange(len(dates)) / 120 + 3 * np.sin(2 * np.pi * np.arange(len(dates)) / 12) + rng.normal(0, 0.15, len(dates))
    values[60:64] = np.nan
    result, detail = analyze_trend(dates, values, main.CONFIG)
    assert result["status"] == "ok" and result["n_observations"] == 284 and result["max_gap_months"] == 4
    assert abs(result["slope_per_decade"] - 2) < 0.1
    assert detail["value"].isna().sum() == 4          # gaps are not filled in
    values[:200] = np.nan
    result, detail = analyze_trend(dates, values, main.CONFIG)
    assert result["status"] == "insufficient_data" and detail is None


# ---- 2. the data really is the run's data -------------------------------------
def test_processed_csv_is_the_file_the_run_was_computed_from():
    path = REPO / "data" / "processed" / "regional_monthly_multi.csv"
    assert hashlib.sha256(path.read_bytes()).hexdigest() == main.MANIFEST["input_sha256"]
    raw = pd.read_csv(path)
    assert not raw.value.isna().any()
    for (region, variable), group in raw.groupby(["region", "variable"]):
        native = group.sort_values("date").value.to_numpy()
        if variable == "surface_temperature":
            converted = native - 273.15
        elif variable == "soil_moisture":
            converted = native
        else:
            converted = native * 86400
        served = [p["value"] for p in main.SERIES[(region, variable)]["series"]]
        assert served == pytest.approx(converted, rel=1e-9, abs=1e-9)


def test_fingerprints_twins_and_clusters_match_the_model_bundle():
    saved = pd.read_csv(REPO / "models" / "clustering" / "fingerprints.csv", index_col="region")
    for region, fingerprint in main.FINGERPRINT.items():
        assert [fingerprint[f] for f in main.FEATURES] == pytest.approx(saved.loc[region, main.FEATURES].to_numpy(), rel=1e-12)
    # The ten closest pairs computed here are the ten the notebook exported.
    exported = main.DISCOVERIES["twins"]
    for (distance, a, b), twin in zip(main.PAIRS[:10], exported):
        assert {a, b} == {twin["region_a"], twin["region_b"]}
        assert distance == pytest.approx(twin["distance"], rel=1e-9)
    # Every region sits in the cluster whose centre is nearest, at the exported distance.
    centers = {c["cluster"]: np.array([c["features"][f] for f in main.FEATURES]) for c in main.CLUSTERS["centers"]}
    for a in main.CLUSTERS["assignments"]:
        point = np.array([main.FINGERPRINT[a["region"]][f] for f in main.FEATURES])
        distances = {c: float(np.linalg.norm(point - center)) for c, center in centers.items()}
        assert min(distances, key=distances.get) == a["cluster"]
        assert distances[a["cluster"]] == pytest.approx(a["distance_to_center"], rel=1e-9)


def test_saved_kmeans_model_agrees_with_clusters_json():
    pytest.importorskip("sklearn")
    joblib = pytest.importorskip("joblib")
    import warnings
    with warnings.catch_warnings():
        warnings.simplefilter("ignore")  # the model was saved with an older scikit-learn
        bundle = joblib.load(REPO / "models" / "clustering" / "models.joblib")
    assert bundle["run_id"] == main.RUN_ID and bundle["features"] == main.FEATURES
    model = bundle["model"]
    for center in main.CLUSTERS["centers"]:
        assert model.cluster_centers_[center["cluster"]] == pytest.approx([center["features"][f] for f in main.FEATURES], rel=1e-9)
    regions = sorted(main.FINGERPRINT)
    predicted = model.predict(np.array([[main.FINGERPRINT[r][f] for f in main.FEATURES] for r in regions]))
    expected = {a["region"]: a["cluster"] for a in main.CLUSTERS["assignments"]}
    assert [int(p) for p in predicted] == [expected[r] for r in regions]


# ---- 3. the Run ---------------------------------------------------------------
def test_full_record_run_serves_the_reviewed_results():
    r = client.get("/api/analysis", params={"region": ["amazon", "alaska_tundra"], "variable": ["precipitation", "soil_moisture"]})
    assert r.status_code == 200
    body = r.json()
    assert body["request"] == {"regions": ["amazon", "alaska_tundra"], "variables": ["precipitation", "soil_moisture"], "start": "2001-01", "end": "2024-12"}
    assert body["scope"]["kind"] == "full_record" and body["scope"]["trend_source"] == "reviewed_run"
    assert body["provenance"]["is_development_data"] is False and body["provenance"]["run_id"] == main.RUN_ID
    assert [v["variable"] for v in body["results"]] == ["precipitation", "soil_moisture"]
    assert body["results"][0]["unit"] == "mm/day" and body["results"][1]["unit"] == "kg/m2"
    item = body["results"][0]["regions"][0]
    assert item["region"] == "amazon" and item["trend_source"] == "reviewed_run" and item["full_record_trend"] is None
    assert item["trend"] == {**{"reason": None}, **{k: v for k, v in main.TREND_BY_KEY[("amazon", "precipitation")].items() if k != "spatial_excluded_rows"}}
    assert len(item["series"]["dates"]) == 288 and item["series"]["dates"][0] == "2001-01-01" and item["series"]["dates"][-1] == "2024-12-01"
    assert item["annual"]["years"] == list(range(2001, 2025))
    assert [c["check"] for c in item["robustness"]] == ["lag_6", "lag_12", "lag_24", "trim_start", "trim_end"]


def test_custom_window_run_is_refitted_for_exactly_that_window():
    params = {"region": ["congo"], "variable": ["evapotranspiration"], "start": "2003-01", "end": "2024-12"}
    body = client.get("/api/analysis", params=params).json()
    assert body["scope"]["kind"] == "custom_window" and body["scope"]["months"] == 264
    assert "not part of the reviewed run" in body["scope"]["note"]
    item = body["results"][0]["regions"][0]
    series, trend = item["series"], item["trend"]
    assert item["trend_source"] == "computed_on_request" and item["robustness"] is None
    assert series["dates"][0] == "2003-01-01" and series["dates"][-1] == "2024-12-01" and len(series["dates"]) == 264
    assert trend["start"] == "2003-01" and trend["end"] == "2024-12" and trend["expected_months"] == 264
    # Same window as the reviewed run's own "trim_start" re-fit, so the numbers must agree with it.
    reviewed = next(c for c in main.ROBUSTNESS[("congo", "evapotranspiration")] if c["check"] == "trim_start")
    assert trend["slope_per_decade"] == pytest.approx(reviewed["slope_per_decade"], rel=1e-9)
    assert trend["ci_low"] == pytest.approx(reviewed["ci_low"], rel=1e-9)
    assert trend["p_value"] == pytest.approx(reviewed["p_value"], rel=1e-7)
    # The fitted pieces belong to the window, not to the full record.
    anomalies = pd.Series(series["anomalies"], index=pd.to_datetime(series["dates"]))
    assert anomalies.groupby(anomalies.index.month).mean().abs().max() < 1e-9
    slope_from_line = (series["trend_component"][-1] - series["trend_component"][0]) / ((264 - 1) / 120)
    assert slope_from_line == pytest.approx(trend["slope_per_decade"], rel=1e-9)
    full = [p["value"] for p in main.SERIES[("congo", "evapotranspiration")]["series"]][24:]
    assert series["values"] == pytest.approx(full)
    # The full-record result is still given for reference, and is unchanged.
    assert item["full_record_trend"]["slope_per_decade"] == main.TREND_BY_KEY[("congo", "evapotranspiration")]["slope_per_decade"]
    assert trend["q_value"] >= trend["p_value"] and isinstance(trend["significant"], bool)


def test_different_windows_give_different_results_for_the_same_series():
    def slope(start, end):
        body = client.get("/api/analysis", params={"region": "sahara", "variable": "surface_temperature", "start": start, "end": end}).json()
        return body["results"][0]["regions"][0]["trend"]["slope_per_decade"], len(body["results"][0]["regions"][0]["series"]["dates"])
    assert slope("2001-01", "2012-12")[1] == 144 and slope("2013-01", "2024-12")[1] == 144
    assert slope("2001-01", "2012-12")[0] != slope("2013-01", "2024-12")[0] != slope("2001-01", "2024-12")[0]


def test_flagged_series_carries_its_review_note_with_evidence_from_the_data():
    body = client.get("/api/analysis", params={"region": "central_andean_puna", "variable": "surface_temperature"}).json()
    item = body["results"][0]["regions"][0]
    note = item["review_note"]
    assert note["status"] == "needs_review"
    annual = item["annual"]
    assert note["evidence"]["first_year_mean"] == pytest.approx(annual["means"][0])
    assert note["evidence"]["last_year_mean"] == pytest.approx(annual["means"][-1])
    assert note["evidence"]["largest_step"] == pytest.approx(max(np.diff(annual["means"]), key=abs))
    # The number itself is served exactly as the run computed it.
    assert item["trend"]["slope_per_decade"] == main.TREND_BY_KEY[("central_andean_puna", "surface_temperature")]["slope_per_decade"]
    other = client.get("/api/analysis", params={"region": "amazon", "variable": "surface_temperature"}).json()
    assert other["results"][0]["regions"][0]["review_note"] is None


@pytest.mark.parametrize("params, status, text", [
    ({"region": "atlantis", "variable": "precipitation"}, 404, "Unknown region"),
    ({"region": "amazon", "variable": "snow_cover"}, 404, "Unknown variable"),
    ({"region": "amazon", "variable": "precipitation", "start": "2020-01", "end": "2010-01"}, 422, "after the end month"),
    ({"region": "amazon", "variable": "precipitation", "start": "1990-01"}, 422, "data covers 2001-01 to 2024-12"),
    ({"region": "amazon", "variable": "precipitation", "end": "2026-12"}, 422, "data covers 2001-01 to 2024-12"),
    ({"region": "amazon", "variable": "precipitation", "start": "2020-01", "end": "2021-12"}, 422, "at least 36 months"),
    ({"region": "amazon", "variable": "precipitation", "start": "January 2010"}, 422, "must look like 2010-01"),
    ({"region": "amazon", "variable": "precipitation", "start": "2010-13"}, 422, "must look like 2010-01"),
    ({"region": ["amazon", "congo", "nile", "sahara", "alps"], "variable": "precipitation"}, 422, "at most 4 regions"),
])
def test_invalid_runs_are_rejected_with_a_reason(params, status, text):
    r = client.get("/api/analysis", params=params)
    assert r.status_code == status
    assert text in r.json()["detail"]


def test_run_without_regions_or_variables_is_rejected():
    assert client.get("/api/analysis", params={"variable": "precipitation"}).status_code == 422
    assert client.get("/api/analysis", params={"region": "amazon"}).status_code == 422


# ---- 4. machine-learning results keep their scope -----------------------------
def test_pattern_context_is_always_the_full_record():
    body = client.get("/api/pattern-context", params={"region": ["california", "central_valley", "sahara"]}).json()
    assert body["scope"]["start"] == "2001-01" and body["scope"]["end"] == "2024-12"
    assert "not recalculated" in body["scope"]["note"]
    assert body["model_status"] == "passed_heuristic_checks" and body["clustering"]["k"] == 2
    by_region = {r["region"]: r for r in body["regions"]}
    assert by_region["california"]["role"] == "validation_assignment"
    assert by_region["sahara"]["cluster"] != by_region["california"]["cluster"]
    assert by_region["sahara"]["nearest"][0]["region"] == "arabian_desert"
    assert any(h["variable"] == "surface_temperature" for h in by_region["sahara"]["hotspots"])
    pair = next(p for p in body["pairs"] if {p["region_a"], p["region_b"]} == {"california", "central_valley"})
    assert pair["overlap_share"] == 1.0 and pair["pair_rank"] == 3 and pair["pair_count"] == 210
    assert body["clustering"]["feature_separation"][0]["feature"] == "surface_temperature"


def test_twins_ranks_every_other_region_and_flags_overlap():
    body = client.get("/api/twins", params={"region": "great_plains"}).json()
    ranking = body["ranking"]
    assert len(ranking) == 20 and [t["distance"] for t in ranking] == sorted(t["distance"] for t in ranking)
    assert ranking[0]["region"] == "mississippi" and ranking[0]["in_published_top_10"] is True
    assert ranking[0]["overlap_share"] == pytest.approx(0.741, abs=0.01)   # the Great Plains lie mostly inside the Mississippi basin
    assert body["all_pairs"]["count"] == 210
    assert client.get("/api/twins", params={"region": "atlantis"}).status_code == 404


def test_clusters_endpoint_reports_the_model_honestly():
    body = client.get("/api/clusters").json()
    assert body["k"] == 2 and body["n_training_regions"] == 20 and len(body["assignments"]) == 21
    assert sum(c["size"] for c in body["centers"]) == 21
    assert [c["passes_checks"] for c in body["candidates"]] == [True, False, False, False]
    assert all(a["fingerprint"] is not None for a in body["assignments"])


# ---- 5. map, downloads, older endpoints, configuration -------------------------
def test_display_geometry_covers_all_regions_and_is_small():
    r = client.get("/api/regions/geojson")
    body = r.json()
    assert {f["properties"]["region_id"] for f in body["features"]} == main.REGION_IDS
    assert len(r.content) < 600_000
    assert body["rockit_display"]["source_sha256"] == hashlib.sha256((main.ML_DIR / "regions.geojson").read_bytes()).hexdigest()
    for region in client.get("/api/regions").json():
        west, south, east, north = region["bbox"]
        lon, lat = region["label_point"]
        assert west <= lon <= east and south <= lat <= north


def test_monthly_export_matches_the_run():
    params = {"region": ["nile", "alps"], "variable": ["surface_temperature", "precipitation"], "start": "2010-01", "end": "2019-12"}
    r = client.get("/api/export", params=params)
    assert r.status_code == 200 and r.headers["content-type"].startswith("text/csv")
    assert 'filename="rockit_monthly_2010-01_2019-12.csv"' in r.headers["content-disposition"]
    rows = list(csv.DictReader(io.StringIO(r.text)))
    assert len(rows) == 2 * 2 * 120
    assert {row["fit_source"] for row in rows} == {"computed_on_request"} and {row["unit"] for row in rows} == {"degC", "mm/day"}
    run = client.get("/api/analysis", params=params).json()
    first = run["results"][0]["regions"][0]["series"]
    assert float(rows[0]["value"]) == pytest.approx(first["values"][0]) and rows[0]["date"] == first["dates"][0] == "2010-01-01"
    trends = list(csv.DictReader(io.StringIO(client.get("/api/export", params={**params, "kind": "trends"}).text)))
    assert len(trends) == 4
    assert float(trends[0]["slope_per_decade"]) == pytest.approx(run["results"][0]["regions"][0]["trend"]["slope_per_decade"])
    assert client.get("/api/export", params={"region": "nile", "variable": "precipitation", "start": "2020-01", "end": "2020-06"}).status_code == 422


def test_older_endpoints_still_work_and_agree_with_the_run():
    ts = client.get("/api/timeseries", params={"variable": "soil_moisture", "region": ["pampas", "congo"], "start": "2005-01", "end": "2015-12"}).json()
    assert ts["unit"] == "kg/m2" and ts["start"] == "2005-01-01" and ts["end"] == "2015-12-01" and len(ts["series"]) == 2
    run = client.get("/api/analysis", params={"variable": "soil_moisture", "region": "pampas", "start": "2005-01", "end": "2015-12"}).json()
    assert ts["series"][0]["trend_component"] == run["results"][0]["regions"][0]["series"]["trend_component"]
    full = client.get("/api/trend", params={"variable": "soil_moisture", "region": "pampas"}).json()
    assert full["kind"] == "precomputed" and full["result"]["evidence"] == "supported_decreasing"
    window = client.get("/api/trend", params={"variable": "soil_moisture", "region": "pampas", "start": "2005-01", "end": "2015-12"}).json()
    assert window["kind"] == "window_estimate"
    assert window["result"]["slope_per_decade"] == run["results"][0]["regions"][0]["trend"]["slope_per_decade"]
    assert len(client.get("/api/map-trends", params={"variable": "precipitation"}).json()["regions"]) == 21
    discoveries = client.get("/api/discoveries").json()
    assert len(discoveries["hotspots"]) == 18 and len(discoveries["twins"]) == 10
    assert client.get("/api/glossary/p_value").json()["term"] == "p-value"


def test_meta_describes_coverage_units_and_limits():
    body = client.get("/api/meta").json()
    assert body["period"] == {"start": "2001-01", "end": "2024-12", "months": 288}
    assert body["min_window_months"] == 36 and body["max_regions_per_run"] == 4
    assert body["completeness"] == {"series": 84, "values_expected": 84 * 288, "values_missing": 0}
    assert body["dataset"]["product"] == "GLDAS_NOAH025_M" and body["dataset"]["granules"] == 288
    assert "Historical association, not causation or forecasting" in body["limitations"]
    assert any(s["license"] == "CC BY 4.0" for s in body["boundary_sources"])
    units = {v["id"]: v["unit"] for v in client.get("/api/variables").json()}
    assert units == {"surface_temperature": "degC", "precipitation": "mm/day", "soil_moisture": "kg/m2", "evapotranspiration": "mm/day"}
    for variable, unit in units.items():
        assert main.SERIES[("amazon", variable)]["unit"] == unit   # the labels match the data


def test_cors_allows_the_configured_frontend_only():
    ok = client.get("/api/health", headers={"Origin": "http://localhost:3000"})
    assert ok.headers.get("access-control-allow-origin") == "http://localhost:3000"
    other = client.get("/api/health", headers={"Origin": "https://example.org"})
    assert "access-control-allow-origin" not in other.headers
