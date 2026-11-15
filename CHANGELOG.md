# Taste-guided frontend and plot refresh

- Applied the requested GPT Taste reference to a functional Earth explorer rather than adding marketing sections.
- Replaced the old stylesheet with a coherent navy/neutral/orange system, self-hosted Geist type, clearer controls, and compact methods disclosure.
- Removed numbered section labels, field-book slogans, and italic editorial headings.
- Replaced custom SVG time-series charts with locally bundled Plotly.js: dates, units, comparison line styles, hover inspection, zoom/pan/reset, source-fit overlays, anomaly views, and SVG export. Cloud sharing is removed from the toolbar.
- Kept monthly tables, confidence intervals, scientific notes, CSV/JSON exports, history, comparisons, and ML integration.
- Added GSAP entry/reveal motion with reduced-motion handling and cleanup.
- Kept the entire Python backend, original scientific assets, model outputs, and analytical contracts unchanged.

The original integration change log follows for context.

# Complete mission integration

## Backend

- `api/main.py`: one validated `/api/mission` request for series, trends, comparisons, trained fingerprints, neighbors, and provenance; `/api/clusters` and display geometry endpoint; shared strict date bounds; cluster run-ID consistency check; configurable CORS.
- `api/analysis_engine.py`: notebook estimator copied for scientifically consistent custom windows; no retraining or altered source exports.
- `api/schemas.py`: custom-window trend type and insufficient-data handling.
- `api/data/variables.json`: precipitation description corrected to monthly mean rate in mm/day; numerical data unchanged.
- `api/data/rockit/map_regions.geojson`: simplified source-derived geometry for display only. The original analytical geometry is untouched.
- `api/tests/test_missions.py`: 96 real-data integration checks.

## Frontend

- `rockit/app/page.tsx`: real mission lifecycle, two-region configuration, date validation, cancellation/retry, saved-history snapshots, quieter editorial styling, footer in document flow.
- `rockit/components/MissionResults.tsx`: graphs, evidence tables, actual ML fingerprints, nearest-region comparison, model explanation, provenance, CSV/JSON exports.
- `rockit/components/TrendChart.tsx`: two-series monthly/anomaly views, source-model overlays, pointer/keyboard inspection, paginated data tables, distinct series styles.
- `rockit/components/MissionMap.tsx`, `AtlasFallback.tsx`: local geographic map sources, source-derived region outlines, globe/atlas fallback, accessible region selection.
- `rockit/components/Icon.tsx`: coherent line icons.
- `rockit/lib/api.ts`: typed full-stack contract, same-origin API proxy requests, exports and error handling.
- `rockit/app/globals.css`: refined typography, subdued colors, responsive controls/results, static small footer.
- `rockit/next.config.mjs`: server-side proxy to the Python API.
- `rockit/scripts/dev.mjs`, `rockit/package.json`: integrated two-service dev command with optional frontend-only mode.
- `rockit/public/world.geojson` and `licenses/world-atlas.txt`: local Natural Earth basemap and asset license.

## Setup and handoff

- Root `start.py` installs isolated dependencies and starts/checks both services with one command. `Start_RockIT.command` is a Mac convenience entry point.
- `.env.example`, README, and ML explanation document local configuration and actual analysis scope.
- Datasets, notebooks, original analysis exports, and trained model artifacts were compared against the supplied updated ZIP and are unchanged. No Git branch, commit, push, merge, or deployment was made.

## Verified

- 96 API tests passed.
- TypeScript and optimized Next.js build passed.
- Browser: real Run, comparisons, ML neighbor navigation, evidence, custom periods, paginated tables, CSV download, history rename/reopen, invalid date handling.
- Narrow CSS viewports 681/454/340 px: no page-level horizontal overflow in checked views.
- One-command launcher reached a successful API proxy health response on test ports.

## Not verified

- WebGL globe rendering (disabled by this browser environment). The selectable geographic atlas fallback was exercised instead.
- macOS/native phone execution and the first-time dependency installation on the user's device.
- Public hosting/deployment. The deliverable is a complete local application.
