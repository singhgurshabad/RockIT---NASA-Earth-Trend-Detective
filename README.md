# RockIT: Earth trend detective

A NASA Space Apps Challenge project. RockIT shows how the land surface changed from 2001 to 2024 in 21 regions of the world, using NASA's GLDAS Noah v2.1 monthly land-surface model estimates: surface temperature, precipitation, soil moisture and evapotranspiration.

Pick regions on a globe, pick a time window and variables, press **Run analysis**, and get the monthly record, the trend per decade with its uncertainty, and how each region fits the wider pattern (K-means groups and "Earth Twins").

Not affiliated with or endorsed by NASA. Results are provisional and pending scientific review.

## What is in this repository

| Folder | What it is |
|---|---|
| `rockit/` | The web app (Next.js, TypeScript, Tailwind, MapLibre GL) |
| `api/` | The data service (FastAPI). Serves the analysis bundle in `api/data/rockit` |
| `analysis/` | The notebooks that produced the bundle, and their result tables |
| `models/` | The saved clustering model and its inputs |
| `data/` | The processed monthly dataset and its metadata |

## Run it (two terminals)

You need Python 3.10 or newer and Node 18.17 or newer.

**Terminal 1: the data service**

```bash
cd api
python3 -m venv .venv
source .venv/bin/activate          # Windows: .venv\Scripts\activate
pip install -r requirements.txt
uvicorn main:app --port 8000
```

Check it: open http://localhost:8000/api/health (should say `"status":"ok"`). Interactive docs are at http://localhost:8000/docs.

**Terminal 2: the web app**

```bash
cd rockit
npm install
npm run dev
```

Open http://localhost:3000.

## Settings

Nothing is required for local use. Both files below are optional and contain no secrets.

| File | Variable | Default | What it does |
|---|---|---|---|
| `rockit/.env.local` | `NEXT_PUBLIC_API_URL` | `http://localhost:8000` | Where the web app finds the data service |
| shell or `api/.env` | `ROCKIT_ALLOWED_ORIGINS` | `http://localhost:3000,http://127.0.0.1:3000` | Web addresses allowed to call the data service (comma-separated) |
| shell or `api/.env` | `ROCKIT_ROBUSTNESS_CSV` | `../analysis/results/robustness.csv` | Where the stability-check table lives |

Examples are in `rockit/.env.example` and `api/.env.example`. To make uvicorn read `api/.env`, start it with `uvicorn main:app --port 8000 --env-file .env`.

## Checks

```bash
cd api && python -m pytest -q        # 29 integration tests against the real bundle
cd rockit && npm run typecheck && npm run build
```

## How the numbers are made, briefly

* **Full record (2001-01 to 2024-12):** the app shows the analysis notebook's own exported results.
* **Custom window:** the data service re-runs the notebook's trend method (`api/trend_engine.py`) for that window, and corrects for multiple testing across all 84 series in the same window. The tests prove this code reproduces every exported trend and every window re-fit the notebook made.
* **Groups, Earth Twins, hotspots:** always the full record. They are never recalculated for a window, and the app says so wherever they appear.

More detail is in `api/README.md` and in the app's "Method and data" section.
