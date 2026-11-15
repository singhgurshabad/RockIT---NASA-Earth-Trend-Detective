# RockIT update: handoff

## Apply it to your experiment branch (no manual merging)

```bash
# 1. in your repository, be on your experiment branch (not main)
cd /path/to/your/RockIT---NASA-Earth-Trend-Detective
git switch -c rockit-redesign          # or: git switch <your existing experiment branch>

# 2. from the unzipped update folder, preview, then apply
cd /path/to/unzipped/RockIT---NASA-Earth-Trend-Detective
bash handoff/apply_update.sh /path/to/your/RockIT---NASA-Earth-Trend-Detective --dry-run
bash handoff/apply_update.sh /path/to/your/RockIT---NASA-Earth-Trend-Detective
```

The script checks the folder is the RockIT git repository, refuses to run on `main`/`master`, lists every file it will add (37), replace (19) or remove (7), warns about any file edited since the ZIP was uploaded, asks you to type `yes`, backs up every replaced or removed file to a `rockit-backup-<date>` folder next to the repository, and then copies. It never touches `.env` files, `node_modules` or virtual environments, and it never commits, pushes, merges or deploys.

The unzipped folder is also a complete, runnable project by itself, if you would rather look before applying.

## Run it

Terminal 1:
```bash
cd api
python3 -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
uvicorn main:app --port 8000
```
Terminal 2:
```bash
cd rockit
npm install
npm run dev            # http://localhost:3000
```
Checks: `cd api && python -m pytest -q` and `cd rockit && npm run typecheck && npm run build`.

## Environment variables (all optional, none secret)

| Where | Variable | Example |
|---|---|---|
| `rockit/.env.local` | `NEXT_PUBLIC_API_URL` | `http://localhost:8000` |
| shell, or `api/.env` with `uvicorn ... --env-file .env` | `ROCKIT_ALLOWED_ORIGINS` | `http://localhost:3000,http://127.0.0.1:3000` |
| same | `ROCKIT_ROBUSTNESS_CSV` | `/absolute/path/to/robustness.csv` |

## Two-minute walkthrough

1. Open http://localhost:3000. Amazon Basin is preselected on the globe.
2. Add **Sahara desert core** from the Regions list (or click its outline on the globe).
3. Press **Run analysis**. Results show the settings they were run with, the anomaly chart with trend lines, and the trend per decade with its 95% range for each region.
4. Switch the chart to **Monthly values** or **Annual means**; open **All statistics** for p, q and the stability checks.
5. Change the window to 2010 to 2019. A notice says the results are now out of date. Run again: the badge changes to "Custom window: computed for this request" and a grey diamond shows the full-record trend for reference.
6. Scroll to **How these regions fit the wider pattern**: fingerprints, K-means group, closest match. This part always says "Full record ... precomputed".
7. In **Earth Twins**, choose Alaska tundra. Its closest match is the Kazakh steppe. Press **Show both on the globe** to see the line over the pole, then **Compare their records**.
8. In **Strongest signals**, open Central Andean puna under Surface temperature to see a result flagged for review.
9. **Saved runs** at the bottom lists every finished run; rename one, reload the page, and run it again.

## Changed files

Backend (`api/`):

| File | Change |
|---|---|
| `main.py` | New `/api/analysis` (the Run), `/api/pattern-context`, `/api/clusters`, `/api/twins`, `/api/meta`, `/api/export`; `clusters.json` and robustness checks now loaded; custom windows use the notebook's method; display geometry; CORS from an environment variable; gzip; stricter validation |
| `trend_engine.py` (new) | The notebook's `analyze_trend`, unchanged, plus Benjamini-Hochberg |
| `trend_calc.py` (removed) | The labelled FALLBACK least-squares estimate it contained is no longer used |
| `schemas.py` | Response shapes for the new endpoints |
| `tests/test_api.py`, `conftest.py` (new) | 29 integration tests on the real bundle |
| `data/rockit/regions_display.geojson` (new) | Simplified outlines for drawing (258 KB instead of 17 MB) |
| `scripts/build_display_geometry.py` (new) | Rebuilds that file |
| `data/review_notes.json` (new) | Hand-written review flags (see limitations) |
| `data/glossary.json`, `data/variables.json` | Precipitation and evapotranspiration correctly described as mm/day (was "mm per month" / "in a month"); 11 added terms; soil-moisture unit string matches the data |
| `requirements.txt` | Removed unused `pyarrow` |
| `.env.example` (new), `README.md`, `data/rockit/README.md` | Documentation |

Frontend (`rockit/`): `app/page.tsx`, `app/layout.tsx`, `app/globals.css`, `app/icon.svg`, `tailwind.config.ts`, `package.json`, `package-lock.json`, `.gitignore`, `.env.example`, `README.md`; everything in `components/` and `lib/` (old `Header`, `Globe`, `RegionTime`, `Variables`, `DataHistory`, `constants` removed); `public/basemap/` and `scripts/build-basemap.mjs` (new).

Root: `README.md`. Exact list with checksums: `handoff/CHANGED_FILES.txt`.

One new dependency: `@fontsource-variable/archivo` (the typeface, served by the app itself). No map token, no tile service, no new backend packages.
