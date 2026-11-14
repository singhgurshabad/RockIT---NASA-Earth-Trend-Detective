# rockIT front end

Next.js + TypeScript + Tailwind. Landing page → Region/Time, Variables, Data tabs.

## Run it
```bash
npm install
npm run dev      # http://localhost:3000
```
Needs Node 18.17 or newer (https://nodejs.org).

## Where things are
- `app/page.tsx`: page state (which screen, selections, saved runs)
- `components/`: Header, Footer, RegionTime, Variables, DataHistory
- `lib/constants.ts`: regions, variables, data date limits, validation
- `app/globals.css`: colors (light and dark) as CSS variables

## Next steps
- Replace the globe placeholder in `RegionTime.tsx` with MapLibre GL JS.
- In `run()` in `app/page.tsx`, call the FastAPI backend and show results with Plotly.
