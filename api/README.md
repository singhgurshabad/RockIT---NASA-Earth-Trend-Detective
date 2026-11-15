# RockIT data service (FastAPI)

Serves one reviewed run of the analysis notebook (`data/rockit/`, run id in `manifest.json`) and, for custom date windows, re-runs the notebook's trend method on request.

```bash
cd api
python3 -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
uvicorn main:app --port 8000          # docs: http://localhost:8000/docs
python -m pytest -q                   # integration tests
```

## Endpoints

| Endpoint | Purpose |
|---|---|
| `GET /api/health` | Up or not, and which run is being served |
| `GET /api/meta` | Coverage, limits (36-month minimum window, 4 regions per run), methods, sources, limitations, review notes |
| `GET /api/variables` | The four variables with units and descriptions |
| `GET /api/regions[?group=]` | The 21 regions: type, area, grid cells, outline source, group, overlaps, a label point |
| `GET /api/regions/geojson[?detail=display\|full]` | Outlines. `display` (default) is a simplified 260 KB copy for drawing. `full` is the 17 MB analysis geometry |
| **`GET /api/analysis?region=&region=&variable=&variable=&start=&end=`** | **The Run.** For every variable and region: the monthly series, the trend with its 95% range, p and q, where the trend came from, stability checks (full record only) and any review note |
| `GET /api/pattern-context?region=&region=` | Group, fingerprint, closest matches and hotspots for chosen regions. Always the full record |
| `GET /api/clusters` | The fitted K-means model: centres, evaluation, every region's fingerprint |
| `GET /api/twins?region=` | Earth Twins: every other region ranked by fingerprint distance, with overlap flags |
| `GET /api/discoveries` | The run's hotspots, opposites and ten closest twin pairs |
| `GET /api/map-trends?variable=` | One full-record trend per region, for colouring the map |
| `GET /api/export?...&kind=monthly\|trends` | The same numbers as `/api/analysis`, as CSV |
| `GET /api/timeseries`, `GET /api/trend` | Older single-purpose endpoints, kept for other clients. Same numbers as `/api/analysis` |
| `GET /api/glossary[/{id}]` | Plain-language definitions |

`start` and `end` are months, `YYYY-MM`. Leave both out for the full record.

## Scope rules the service enforces

1. **Full record** (`start`/`end` equal to the data's limits or left out): results are the notebook's own exports. `scope.trend_source` is `reviewed_run`.
2. **Custom window:** `trend_engine.py` re-fits all 84 series for that window, then applies the same Benjamini-Hochberg correction the notebook uses. `scope.trend_source` is `computed_on_request`, the response says the result is not part of the reviewed run, and the full-record trend is included next to it for reference. The anomalies, fitted line and trend line all belong to the window.
3. **Groups, twins, hotspots, opposites, map colours:** full record only. Every such response has a `scope` block saying so. They are never recalculated or relabelled for a window.
4. **Bad requests fail loudly:** unknown ids are 404; windows outside the data, shorter than 36 months, or with start after end are 422, each with a sentence explaining why.
5. **Missing stays missing.** `null` in JSON, empty in CSV, never 0. (This run has no missing months.)

## Files

| File | What it is |
|---|---|
| `main.py` | Routes and bundle loading |
| `trend_engine.py` | The notebook's `analyze_trend`, unchanged, plus Benjamini-Hochberg. Change it only together with the notebook |
| `schemas.py` | Response shapes (these drive `/docs`) |
| `tests/test_api.py` | Integration tests on the real bundle |
| `data/rockit/` | The analysis bundle from the notebook. `regions_display.geojson` is the one file not produced by the notebook: see below |
| `data/review_notes.json` | Hand-written review flags shown next to results. Not analysis output. Edit or remove entries as the science review resolves them |
| `data/variables.json`, `data/glossary.json` | Labels and definitions |
| `scripts/build_display_geometry.py` | Rebuilds `regions_display.geojson` from `regions.geojson` (needs `pip install shapely`) |

## After a new analysis run

1. Replace the six files in `data/rockit/` with the new bundle (never mix runs: the service refuses to start if run ids differ).
2. Run `python scripts/build_display_geometry.py` if the region outlines changed.
3. Copy the new `robustness.csv` to `../analysis/results/` (or point `ROCKIT_ROBUSTNESS_CSV` at it). If it does not match the bundle the service simply stops serving stability checks.
4. Review `data/review_notes.json`: series notes carry the run id they were written for and are ignored for any other run.
5. Run `python -m pytest -q`. Tests that pin this run's values (hotspot counts, specific twins) will need new expected values; the reproduction tests should pass unchanged.

## Deploying (for example on AWS)

Set `ROCKIT_ALLOWED_ORIGINS` to the web app's address, and build the web app with `NEXT_PUBLIC_API_URL` set to this service's public address. The service needs `../analysis/results/robustness.csv` only for the stability checks; everything else lives under `api/`.
