"use client";

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { BootGate, useAppData } from "@/components/AppData";
import Console from "@/components/Console";
import ExplorerGlobe from "@/components/ExplorerGlobe";
import History from "@/components/History";
import Icon from "@/components/Icon";
import RegionFacts from "@/components/RegionFacts";
import Results from "@/components/Results";
import { ApiError, getMapTrends, getRegionsGeoJson, isAbort } from "@/lib/api";
import { windowLabel } from "@/lib/format";
import { loadHistory, saveHistory } from "@/lib/history";
import { readExploreQuery } from "@/lib/links";
import { VARIABLE_TINT } from "@/lib/palette";
import { freeze, problems as findProblems, sameConfig, toggleRegion, withRegions } from "@/lib/selection";
import { useRun } from "@/lib/useRun";
import type { ApiAnalysis, ApiMapTrends, Draft, GeoJsonCollection, RunConfig, SavedRun } from "@/lib/types";

const PREFERRED_REGION = "amazon";
const PREFERRED_VARIABLES = ["surface_temperature", "precipitation"];

// One-click starting points. Each is a real, supported result in the reviewed run.
const EXAMPLES = [
  { label: "Amazon vs Congo rain", regions: ["amazon", "congo"], variables: ["precipitation"], tint: "precipitation" },
  { label: "Desert heat", regions: ["sahara", "arabian_desert"], variables: ["surface_temperature"], tint: "surface_temperature" },
  { label: "Pampas soils", regions: ["pampas"], variables: ["soil_moisture"], tint: "soil_moisture" },
  { label: "Alaska's Earth Twin", regions: ["alaska_tundra", "kazakh_steppe"], variables: ["surface_temperature", "precipitation", "soil_moisture", "evapotranspiration"], tint: "evapotranspiration" },
];

function goTo(id: string) {
  const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  document.getElementById(id)?.scrollIntoView({ behavior: reduce ? "auto" : "smooth", block: "start" });
}

function errorText(error: unknown): string {
  return error instanceof ApiError ? error.message : "Something went wrong.";
}

export default function Explore() {
  const router = useRouter();
  const { boot, retry } = useAppData();
  const [draft, setDraft] = useState<Draft | null>(null);

  const [geojson, setGeojson] = useState<GeoJsonCollection | null>(null);
  const [geojsonError, setGeojsonError] = useState<string | null>(null);
  const [geojsonAttempt, setGeojsonAttempt] = useState(0);

  const [colorBy, setColorBy] = useState("selection");
  const [mapTrends, setMapTrends] = useState<ApiMapTrends | null>(null);
  const [mapTrendsError, setMapTrendsError] = useState<string | null>(null);
  const [hovered, setHovered] = useState<string | null>(null);
  const [link, setLink] = useState<{ a: string; b: string } | null>(null);
  const frameKey = 0; // the camera re-frames whenever the selection or the twin line changes

  const [history, setHistory] = useState<SavedRun[]>([]);
  const [persisted, setPersisted] = useState(true);
  const historyRef = useRef<SavedRun[]>([]);
  historyRef.current = history;

  const ready = boot.status === "ready" ? boot : null;
  const readyRef = useRef(ready);
  readyRef.current = ready;

  // ---- saved runs ----------------------------------------------------------------
  useEffect(() => {
    setHistory(loadHistory());
  }, []);
  const updateHistory = useCallback((next: SavedRun[]) => {
    setHistory(next);
    setPersisted(saveHistory(next));
  }, []);

  const onRunSuccess = useCallback(
    (config: RunConfig, analysis: ApiAnalysis) => {
      const current = historyRef.current;
      if (current[0] && sameConfig(current[0].config, config)) return; // the same run twice in a row is listed once
      const names = config.regions.map((r) => readyRef.current?.regions.find((x) => x.id === r.id)?.name ?? r.id);
      const entry: SavedRun = {
        id: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
        name: `${names.join(" and ")}, ${windowLabel(config.start, config.end)}`.slice(0, 80),
        savedAt: new Date().toISOString(),
        config,
        runId: analysis.provenance.run_id,
      };
      updateHistory([entry, ...current]);
    },
    [updateHistory],
  );

  const { state: run, run: startRun, cancel, retryPatterns } = useRun(onRunSuccess);

  const runConfig = useCallback(
    (config: Draft, scroll = true) => {
      startRun(freeze(config));
      if (scroll) goTo("results");
    },
    [startRun],
  );

  // ---- first settings: from the address (a shared link or Discover), else a default ----
  useEffect(() => {
    if (!ready || draft) return;
    const { meta, regions, variables } = ready;
    const query = readExploreQuery(window.location.search);
    const known = (ids: string[], list: { id: string }[]) => ids.filter((id) => list.some((x) => x.id === id));
    if (query) {
      const regionIds = known(query.regions, regions).slice(0, meta.max_regions_per_run);
      const variableIds = variables.map((v) => v.id).filter((id) => query.variables.includes(id));
      const next: Draft = {
        regions: withRegions(regionIds),
        variables: variableIds.length ? variableIds : PREFERRED_VARIABLES.filter((id) => variables.some((v) => v.id === id)),
        start: query.start && /^\d{4}-\d{2}$/.test(query.start) ? query.start : meta.period.start,
        end: query.end && /^\d{4}-\d{2}$/.test(query.end) ? query.end : meta.period.end,
      };
      setDraft(next);
      if (query.link && regionIds.length === 2) setLink({ a: regionIds[0], b: regionIds[1] });
      if (query.run && regionIds.length && findProblems(next, meta).length === 0) {
        startRun(freeze(next));
        window.setTimeout(() => goTo("results"), 50);
      }
      return;
    }
    const region = regions.find((r) => r.id === PREFERRED_REGION) ?? regions[0];
    const chosen = variables.filter((v) => PREFERRED_VARIABLES.includes(v.id)).map((v) => v.id);
    setDraft({
      regions: region ? withRegions([region.id]) : [],
      variables: chosen.length ? chosen : variables.slice(0, 1).map((v) => v.id),
      start: meta.period.start,
      end: meta.period.end,
    });
  }, [ready, draft, startRun]);

  // Keep the address in step with the results on screen, so the link can be shared.
  useEffect(() => {
    if (!run.shown) return;
    const q = new URLSearchParams();
    run.shown.regions.forEach((r) => q.append("region", r.id));
    run.shown.variables.forEach((v) => q.append("variable", v));
    q.set("start", run.shown.start);
    q.set("end", run.shown.end);
    window.history.replaceState(null, "", `/?${q.toString()}`);
  }, [run.shown]);

  // ---- map extras that may fail without stopping the page -----------------------------
  useEffect(() => {
    if (!ready) return;
    const controller = new AbortController();
    setGeojsonError(null);
    getRegionsGeoJson(controller.signal).then(setGeojson).catch((error) => {
      if (!isAbort(error)) setGeojsonError(errorText(error));
    });
    return () => controller.abort();
  }, [ready, geojsonAttempt]);

  useEffect(() => {
    if (colorBy === "selection") return;
    const controller = new AbortController();
    setMapTrends(null);
    setMapTrendsError(null);
    getMapTrends(colorBy, controller.signal).then(setMapTrends).catch((error) => {
      if (!isAbort(error)) setMapTrendsError(errorText(error));
    });
    return () => controller.abort();
  }, [colorBy]);

  const changeDraft = useCallback((next: Draft) => {
    setDraft((previous) => {
      if (previous && previous.regions.map((r) => r.id).join("|") !== next.regions.map((r) => r.id).join("|")) setLink(null);
      return next;
    });
  }, []);

  if (!ready || !draft) return <BootGate boot={boot} retry={retry} />;

  const { meta, regions, variables } = ready;
  const problems = findProblems(draft, meta);
  const stale = Boolean(run.shown) && !sameConfig(run.shown, draft);
  const running = run.phase === "running";
  const canAdd = draft.regions.length < meta.max_regions_per_run;
  const lastSelected = draft.regions[draft.regions.length - 1]?.id ?? null;
  const factsRegion = regions.find((r) => r.id === (hovered ?? lastSelected)) ?? null;
  const frame = link ? [link.a, link.b] : draft.regions.map((r) => r.id);

  return (
    <>
      <a href="#results" className="sr-only focus:not-sr-only focus:absolute focus:left-3 focus:top-3 focus:z-50 focus:rounded-md focus:bg-panel focus:px-3 focus:py-2">Skip to results</a>
      <main>
        <section id="explore" className="hero" aria-label="Explore">
          <div className="hero-intro">
            <h1 className="text-[clamp(26px,2.2vw,33px)]">Where is the land changing?</h1>
            <p className="mt-2.5 max-w-[58ch] text-[15px] text-ink-2">
              Land-surface trends for {regions.length} regions from NASA GLDAS, {meta.period.start.slice(0, 4)} to {meta.period.end.slice(0, 4)}, each with its uncertainty.
            </p>
            <div className="mt-3 flex flex-wrap items-center gap-1.5" aria-label="Example analyses">
              <span className="mr-1 text-[13px] text-ink-3">Try:</span>
              {EXAMPLES.filter((e) => e.regions.every((id) => regions.some((r) => r.id === id))).map((example) => {
                const tint = VARIABLE_TINT[example.tint];
                return (
                  <button
                    key={example.label}
                    type="button"
                    className="example-chip"
                    style={{ ["--tint" as string]: tint }}
                    disabled={running}
                    onClick={() => {
                      const next: Draft = { regions: withRegions(example.regions), variables: example.variables, start: meta.period.start, end: meta.period.end };
                      changeDraft(next);
                      if (example.regions.length === 2 && example.label.includes("Twin")) setLink({ a: example.regions[0], b: example.regions[1] });
                      runConfig(next);
                    }}
                  >
                    <span className="h-2 w-2 flex-none rounded-full" style={{ background: tint }} aria-hidden="true" />
                    {example.label}
                  </button>
                );
              })}
            </div>
          </div>

          <div className="hero-globe">
            <div className="hero-globe-map">
              <ExplorerGlobe
                regions={regions}
                variables={variables}
                geojson={geojson}
                geojsonError={geojsonError}
                onRetryGeojson={() => setGeojsonAttempt((n) => n + 1)}
                selected={draft.regions}
                canAdd={canAdd}
                onToggle={(id) => changeDraft(toggleRegion(draft, id, meta.max_regions_per_run))}
                onHover={setHovered}
                colorBy={colorBy}
                onColorBy={setColorBy}
                mapTrends={mapTrends}
                mapTrendsError={mapTrendsError}
                link={link}
                frame={frame}
                frameKey={frameKey}
              />
            </div>
            <div className="border-t border-line bg-deep px-5 py-4 sm:px-6">
              {link && (
                <p className="mb-3 flex flex-wrap items-center gap-x-3 gap-y-1 text-[13.5px] text-ink-2">
                  <svg width="26" height="6" aria-hidden="true"><line x1="1" x2="25" y1="3" y2="3" stroke="#6cc7e6" strokeWidth="2" strokeDasharray="3 4" strokeLinecap="round" /></svg>
                  Earth Twins: {regions.find((r) => r.id === link.a)?.name} and {regions.find((r) => r.id === link.b)?.name}
                  <button className="btn-quiet" onClick={() => setLink(null)}><Icon name="close" size={15} /> Clear the line</button>
                </p>
              )}
              <RegionFacts region={factsRegion} all={regions} hovering={Boolean(hovered)} />
            </div>
          </div>

          <div className="hero-console">
            <Console
              meta={meta}
              regions={regions}
              variables={variables}
              draft={draft}
              onChange={changeDraft}
              problems={problems}
              phase={run.phase}
              stale={stale}
              onRun={() => runConfig(draft)}
              onCancel={cancel}
            />
          </div>
        </section>

        <Results
          run={run}
          stale={stale}
          canRun={problems.length === 0 && !running}
          variables={variables}
          regions={regions}
          onRunDraft={() => runConfig(draft, false)}
          onRetry={(config) => startRun(config)}
          onRetryPatterns={retryPatterns}
          onFindTwin={(region) => router.push(`/discover?twin=${encodeURIComponent(region)}`)}
        />

        <History
          runs={history}
          persisted={persisted}
          regions={regions}
          variables={variables}
          running={running}
          currentRunId={meta.run_id}
          onOpen={(saved) => {
            // Saved settings may name regions or variables that no longer exist. Keep only what the service still offers.
            const next: Draft = {
              regions: saved.config.regions.filter((r) => regions.some((x) => x.id === r.id)).slice(0, meta.max_regions_per_run),
              variables: saved.config.variables.filter((v) => variables.some((x) => x.id === v)),
              start: saved.config.start,
              end: saved.config.end,
            };
            changeDraft(next);
            if (findProblems(next, meta).length === 0) runConfig(next);
            else goTo("explore");
          }}
          onRename={(id, name) => updateHistory(history.map((r) => (r.id === id ? { ...r, name } : r)))}
          onDelete={(id) => updateHistory(history.filter((r) => r.id !== id))}
          onClear={() => updateHistory([])}
        />
      </main>
    </>
  );
}
