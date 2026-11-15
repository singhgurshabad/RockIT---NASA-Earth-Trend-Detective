# RockIT — Earth trend explorer

A complete Earth-trend explorer using the team's NASA GLDAS data, seasonal trend analysis, and trained K-means fingerprints. The frontend, API, charts, tables, comparisons, and model outputs are connected.

## Start here — one command

1. Extract this ZIP into a new folder. You do not need to merge it into your old project to try it.
2. Open the extracted **RockIT-Complete** folder in VS Code (the folder containing this README and `start.py`). Choose **Terminal → New Terminal**.
3. Run:

```bash
python3 start.py
```

The launcher creates `.venv`, installs Python and frontend dependencies on the first run, starts the API and website, checks the connection, and opens **http://localhost:3000**. Keep the terminal open. Stop old servers first if ports 3000 or 8000 are busy. Internet is needed for first-time package installation; the map assets and analysis data are bundled.

Requirements: Python 3.10+ and Node.js 18.17+ (20+ recommended), with npm. macOS users can also try `Start_RockIT.command`; running the terminal command above is the most reliable option.

No account, paid API key, NASA login, or model retraining is needed to use the bundled analysis.

## Try your first mission

- Keep California and the full record selected.
- Select one or more of the four signals; click **Run analysis**.
- **Time series:** inspect monthly values, anomalies, source-model overlays, and paginated monthly tables.
- **Trend evidence:** see slopes per decade, confidence intervals, p/q values, and coverage.
- **Similar regions:** see the trained group, five nearest fingerprints, and four-signal comparison. Click **Compare time series** to run a real two-region mission.
- Download **CSV** for measurements or **Full results JSON** for the mission, trends, provenance, and ML context.
- Completed missions are saved in this browser. Rename or reopen them under **Saved analyses**.

The small footer appears only at the end of the page. Run is part of the control panel.

## What the ML actually does

The existing notebook trained K-means on four standardized trend features per region. The app reads that model's exported assignments and feature vectors; it does not retrain K-means on each click. Nearest-region distances are computed from the same vectors. ML groups always refer to **2001–2024**, even for shorter display windows. See `HOW_IT_WORKS.md` for the full explanation.

For the complete record, trend evidence comes directly from your exported results. For custom windows, the API uses the estimator copied from your notebook (seasonal OLS and calendar-aware Bartlett HAC). Custom-window results have no multiple-testing correction and are labeled accordingly. Short windows still return graphs; if they cannot support a trend, the app says so instead of inventing one.

All source findings remain provisional pending scientific review. GLDAS contains model estimates, not direct observations or forecasts. One supplied regional temperature series is flagged for source review without changing its values.

## Configuration

The browser calls `/backend/api/...` on the same website. Next.js forwards those requests to the Python API. This avoids local cross-origin problems.

Defaults:

- Website: http://localhost:3000
- API: http://127.0.0.1:8000
- API docs: http://127.0.0.1:8000/docs

Optional frontend `.env.local`:

```dotenv
BACKEND_URL=http://127.0.0.1:8000
```

`NEXT_PUBLIC_API_URL` is only needed for direct browser-to-API access. Leave it unset for the normal proxy flow. Existing `.env.local` files from an older project can override defaults; check them if you copy files manually.

Optional launcher environment variables: `ROCKIT_API_PORT`, `ROCKIT_PORT`, and `ROCKIT_NO_BROWSER=1`.

## Developer commands

After `start.py` has installed dependencies, `cd rockit` then `npm run dev` starts both services. To run the frontend alone against an already-running API, use `npm run dev -- --without-api`.

From `rockit/`:

```bash
npm run build
```

From the project root, with the Python environment activated:

```bash
python -m pytest api/tests -q
```

The final package contains no Git history and makes no commits, pushes, or deployments. Review it as a separate folder first. To use an existing experiment branch later, the actual implementation changes are listed in `CHANGELOG.md`.

## Verification and practical limits

96 real-data API integration tests passed, TypeScript passed, and the Next.js production build passed. Browser checks covered Run, full/custom windows, comparisons, ML, evidence, table pagination, CSV downloads, history, and invalid-date behavior. Narrow CSS viewports at 681, 454, and 340 pixels were checked without page-level horizontal overflow. The one-command startup reached a healthy frontend-to-backend proxy using test ports.

This browser has WebGL disabled, so the 3D renderer could not be visually verified here. The fully selectable local SVG atlas fallback was verified. Actual phone hardware, macOS execution, and first-time installation on your computer were not tested here; this is a local application package, not a hosted deployment.

## Design refresh

The frontend now uses Geist typography, a restrained dark explorer, clearer labels, and neutral scientific plotting surfaces. GPT Taste guidance was read from the user-requested source and adapted to this working research application: https://github.com/Leonxlnx/taste-skill-classics/blob/main/skills/gpt-tasteskill/SKILL.md . The skill was used as project design guidance; it was not globally installed.

Time-series figures now use Plotly.js rather than the handmade renderer. They include date axes and units, unified hover, legend controls, box zoom/pan/reset, and direct SVG export. Source-model and anomaly scopes are unchanged. Figures are bundled locally; no Plotly account or cloud upload is needed. GSAP provides restrained entry/scroll reveals and respects reduced-motion preferences.

The backend, data, notebooks, trained artifacts, analysis methods, and model outputs are byte-for-byte identical to the preceding working package. Only frontend presentation and its dependencies changed. The one-command launcher and existing APIs are preserved.
