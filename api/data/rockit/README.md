RockIT backend bundle | schema 1.0 | run 20261114T211652769653Z
Load these JSON files at backend startup. Serve trends, series, discoveries, clusters and region geometry through your API.
All analytical payloads have run_id/schema_version; never mix different runs.
trends.json: results array; chart_data.json: series array; discoveries.json: hotspots/opposites/twins; clusters.json: centers/assignments/evaluation/status.
regions.geojson contains source geometry and name/region_id properties. manifest.json contains methods, units, sources and configuration.
Model status: passed_heuristic_checks. Human scientific review remains required. Respect status in the frontend, including exploratory_failed_checks.
Cluster IDs are arbitrary. No supervised accuracy or future prediction is claimed. No significant trend means insufficient evidence, not proof of no change.
The joblib artifact is separately packaged in model_bundle.zip; it is not needed for displaying precomputed results.

Added by the web/API integration (not produced by the analysis run):
regions_display.geojson is a simplified copy of regions.geojson for drawing on the map only (see api/scripts/build_display_geometry.py). It records the sha256 of the regions.geojson it was made from. The analysis never uses it.
