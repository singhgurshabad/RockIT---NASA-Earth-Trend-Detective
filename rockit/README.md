# RockIT web app

Next.js 14 (App Router), TypeScript, Tailwind, MapLibre GL. One page: globe and controls, results, Earth Twins, strongest signals, method, saved runs.

## Run it

```bash
npm install
npm run dev          # http://localhost:3000
```

The data service must be running too (see `../api/README.md`). If it is somewhere other than `http://localhost:8000`, copy `.env.example` to `.env.local` and change the address.

```bash
npm run typecheck    # TypeScript only
npm run build        # production build
npm run start        # serve the production build
```

Needs Node 18.17 or newer.

## Where things are

| Path | What it does |
|---|---|
| `app/page.tsx` | Loads regions, variables and coverage; holds the controls' state; wires the sections together |
| `lib/useRun.ts` | The Run lifecycle: one run at a time, cancel, stale responses ignored, partial failure, retry |
| `lib/api.ts`, `lib/types.ts` | Calls to the data service and the shapes it returns |
| `lib/selection.ts` | Validation of the controls, colour slots for regions |
| `components/Console.tsx` | Regions, time window, variables and the Run button |
| `components/ExplorerGlobe.tsx` | The globe: region outlines, selection, trend colouring, Earth Twins line |
| `components/Results.tsx` | Results for one run: charts, trend ranges, statistics, stability checks, downloads |
| `components/PatternContext.tsx` | Groups and closest matches for the regions in a run |
| `components/Twins.tsx` | Earth Twins and the all-regions scatter |
| `components/Signals.tsx`, `Method.tsx`, `History.tsx` | Hotspots and opposites; method and data; saved runs |
| `components/charts/` | The four SVG charts (no chart library) |
| `lib/palette.ts` | Chart and map colours, with the reasoning |
| `public/basemap/` | Natural Earth land and borders for the globe. Rebuild with `scripts/build-basemap.mjs` |
| `app/globals.css`, `tailwind.config.ts` | Colours and type as CSS variables |

## Design notes

* The globe needs no map token and no tile service: the basemap is two local files.
* A selected region keeps its colour and number (1 to 4) everywhere: globe, chips, charts, tables.
* The controls and the results are separate. Results always show the settings they were run with; if the controls change, a notice says so until the next run finishes.
* Nothing is calculated in the browser except chart geometry. Every number comes from the data service.
* Saved runs keep settings only (in `localStorage`). Opening one asks the data service again.
