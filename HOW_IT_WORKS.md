# How RockIT's analysis and ML reach the website

## One Run, one submitted mission

The controls produce an immutable snapshot: up to two region IDs, one to four variable IDs, and a start/end month. The frontend requests `GET /backend/api/mission`. Next.js proxies the request to FastAPI's `/api/mission`.

The API validates all selections, filters the existing monthly chart data, obtains trend estimates for the same window, attaches the trained model's context, and returns everything with a mission UUID and source analysis run ID. The frontend builds charts, evidence tables, monthly tables, and exports from that response. Editing controls does not silently change the meaning of completed results.

## Measurements and trends

Source: GLDAS Noah monthly v2.1, 0.25-degree land-surface model estimates, January 2001–December 2024. Signals: surface temperature, precipitation rate, top-10-cm soil moisture, and evapotranspiration rate.

Full-window missions use the team's existing `trends.json` exports: OLS with month indicators, calendar-aware Bartlett HAC uncertainty, approximate t inference, and q-values for the original 84-test family.

Custom-window missions use `api/analysis_engine.py`, whose estimator was copied from `RockIT_Analysis_Training_Final.ipynb`. This uses the same seasonal design and covariance calculation but fits only the submitted months. It checks coverage and minimum calendar-month counts. Custom windows are **not FDR corrected**: the API deliberately returns no q-value or corrected significance verdict. Below the coverage threshold the graph is retained while the trend is unavailable.

Charts use the supplied series. Anomalies remain relative to the full-record calendar-month baseline. Optional dashed source-fit overlays likewise retain their 2001–2024 model; they are not represented as a new custom-window fit. These scopes are labeled on-screen and in CSV columns.

## The trained model

The provided notebook converts each region into a four-dimensional fingerprint:

`[temperature trend, precipitation trend, soil-moisture trend, evapotranspiration trend]`

Each feature is its physical slope per decade divided by that region/variable's monthly-anomaly standard deviation. The website does not fit a new StandardScaler or reinterpret these as raw climate levels.

K-means was fitted offline to **20 training regions**. California was excluded from fitting (to avoid duplicate representation alongside Central Valley) and assigned afterward. The notebook compared k=2–5, with multiple initializations, seed checks, and endpoint-trimming checks. Its selected export has **two groups**.

The bundled evaluation reports:

| Diagnostic | Value | Meaning |
| --- | ---: | --- |
| Silhouette | 0.327810 | Relative compactness/separation of the fitted groups |
| Seed agreement, minimum ARI | 1.000000 | Agreement across the tested random seeds |
| Endpoint sensitivity, minimum ARI | 0.800089 | Agreement after tested endpoint trims |

These are project diagnostics and heuristics, **not classification accuracy, probabilities, independent validation, or forecasting skill**. Cluster IDs have no intrinsic ordering. The interface numbers them 1 and 2 for readability while the source uses IDs 0 and 1.

## Serving the model without retraining

`api/data/rockit/clusters.json` contains the trained assignments, centers, features, scaling, and diagnostics. At startup the API checks that clusters, trends, charts, discoveries, and manifest share the same analysis run ID.

`/api/clusters` exposes the trained export. `/api/mission` attaches the selected region's assignment and its fingerprint. The API computes Euclidean distances from that fingerprint to all other complete regional fingerprints and returns the nearest five. This is the same distance space used for Earth Twins in the notebook, expanded to support any selected region rather than only the global top ten pairs.

The frontend's **Similar regions** view shows the actual group assignment, the four features, neighbor distances, evaluation, and limitations. Clicking **Compare time series** requests a new two-region mission with real time series and trend estimates. This closes the loop from ML similarity to inspectable evidence.

`models/clustering/models.joblib` is retained unchanged for reproducibility and future inference; the normal web request does **not** deserialize joblib or retrain the model. Serving the exported trained results is intentional and follows the notebook's backend-export design.

## Scope and limitations

ML fingerprints/groups use the full 2001–2024 record. A shorter date selection changes displayed observations and trend estimates, not the trained clustering. Similarity describes standardized historical change; it does not mean two places have the same absolute temperature or rainfall.

Regions overlap and vary in size/type. California/Valley overlap is flagged in the comparison view. Source model uncertainty is not fully represented by statistical confidence intervals. All analytical exports remain provisional pending human scientific review.

Central Andean puna's supplied surface-temperature series has an unusually large, step-shaped change. It is flagged for source/scientific review; the application preserves its values rather than declaring it a validated climate discovery or modifying it to fit expectations.
