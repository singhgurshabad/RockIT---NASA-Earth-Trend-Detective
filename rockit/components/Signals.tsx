"use client";

import { useEffect, useState } from "react";
import { ApiError, getDiscoveries, isAbort } from "@/lib/api";
import { signed, trendDecimals, unitLabel, windowLabel } from "@/lib/format";
import { variableTint } from "@/lib/palette";
import { featureLabels } from "@/lib/patterns";
import type { ApiDiscoveries, ApiRegion, ApiVariable } from "@/lib/types";
import Icon from "./Icon";
import Term from "./Term";

type Props = {
  regions: ApiRegion[];
  variables: ApiVariable[];
  running: boolean;
  onExplore: (regions: string[], variable: string) => void;
};

type Load = { status: "loading" } | { status: "ok"; data: ApiDiscoveries } | { status: "error"; message: string };

/** The reviewed run's own discovery lists: the largest supported trends, and opposite pairs. */
export default function Signals({ regions, variables, running, onExplore }: Props) {
  const [load, setLoad] = useState<Load>({ status: "loading" });
  const [attempt, setAttempt] = useState(0);
  const [variable, setVariable] = useState(variables[0]?.id ?? "");
  const labels = featureLabels(variables);
  const nameOf = (id: string) => regions.find((r) => r.id === id)?.name ?? id;

  useEffect(() => {
    const controller = new AbortController();
    setLoad({ status: "loading" });
    getDiscoveries(controller.signal)
      .then((data) => setLoad({ status: "ok", data }))
      .catch((error) => {
        if (isAbort(error)) return;
        setLoad({ status: "error", message: error instanceof ApiError ? error.message : "Something went wrong." });
      });
    return () => controller.abort();
  }, [attempt]);

  return (
    <section id="signals" className="section" aria-labelledby="signals-heading">
      <div className="page">
        <h2 id="signals-heading" className="section-title">Strongest signals</h2>
        <p className="section-lede">
          The largest <Term id="evidence">supported</Term> trends in the full record, by variable. Use them as starting points: each opens in the analysis above with its full chart and uncertainty.
        </p>

        {load.status === "loading" && <p className="mt-6 flex items-center gap-2.5 text-ink-2" role="status"><span className="spinner" /> Loading the discovery lists</p>}
        {load.status === "error" && (
          <div className="note note-error mt-6 flex items-start gap-3" role="alert">
            <Icon name="alert" className="mt-0.5 flex-none" />
            <div>
              <p className="font-medium text-ink">The discovery lists could not be loaded.</p>
              <p className="mt-1">{load.message}</p>
              <button className="btn mt-3" onClick={() => setAttempt((n) => n + 1)}><Icon name="retry" size={16} /> Try again</button>
            </div>
          </div>
        )}

        {load.status === "ok" && (() => {
          const data = load.data;
          const hotspots = data.hotspots.filter((h) => h.variable === variable);
          const opposite = data.opposites.find((o) => o.variable === variable);
          const unit = hotspots[0]?.unit ?? variables.find((v) => v.id === variable)?.unit ?? "";
          const d = trendDecimals(hotspots.flatMap((h) => [h.slope_per_decade, h.ci_low, h.ci_high]));
          return (
            <>
              <div className="segmented mt-6" role="group" aria-label="Variable">
                {variables.map((v) => (
                  <button key={v.id} aria-pressed={v.id === variable} onClick={() => setVariable(v.id)} className="inline-flex items-center gap-2">
                    <span className="h-2 w-2 rounded-full" style={{ background: variableTint(v.id) }} aria-hidden="true" />
                    {labels[v.id]}
                  </button>
                ))}
              </div>
              <div className="mt-6 grid gap-x-12 gap-y-8 lg:grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)]">
                <div className="min-w-0">
                  <h3 className="text-[17px]"><Term id="hotspot">Hotspots</Term>: largest change per decade</h3>
                  {hotspots.length === 0 ? (
                    <p className="mt-3 text-ink-2">No supported trends for this variable in the reviewed run.</p>
                  ) : (
                    <ol className="mt-3 flex flex-col border-t border-line">
                      {hotspots.map((h, index) => (
                        <li key={h.region} className="flex flex-wrap items-center gap-x-4 gap-y-1 border-b border-line py-3">
                          <span className="num w-5 flex-none text-[13px] text-ink-3">{index + 1}</span>
                          <span className="min-w-[150px] flex-1">
                            <span className="block text-[15px]">{nameOf(h.region)}</span>
                            {h.review_note && (
                              <span className="mt-0.5 flex items-center gap-1.5 text-[12.5px] text-review"><Icon name="alert" size={14} /> {h.review_note.title}</span>
                            )}
                          </span>
                          <span className="num text-right text-[14.5px]">
                            <strong className="font-semibold">{signed(h.slope_per_decade, d)}</strong> <span className="text-ink-2">{unitLabel(unit)}</span>
                            <span className="block text-[12.5px] text-ink-3">{signed(h.ci_low, d)} to {signed(h.ci_high, d)}</span>
                          </span>
                          <button className="btn !min-h-[36px]" disabled={running} onClick={() => onExplore([h.region], variable)} aria-label={`Open ${nameOf(h.region)}, ${labels[variable]}, in the analysis`}>
                            <Icon name="play" size={14} /> View analysis
                          </button>
                        </li>
                      ))}
                    </ol>
                  )}
                  <p className="mt-3 text-[13px] text-ink-3">
                    Ranked by size of change, per decade, with the 95% range underneath. Full record ({data.scope ? windowLabel(data.scope.start, data.scope.end) : "all years"}). A large change in the GLDAS estimate is not an explanation of its cause.
                  </p>
                </div>
                <div className="min-w-0">
                  <h3 className="text-[17px]">Opposites</h3>
                  {opposite ? (
                    <>
                      <p className="num mt-3 text-[15px] text-ink-2">
                        Falling fastest: <span className="text-ink">{nameOf(opposite.decreasing.region)}</span>, {signed(opposite.decreasing.slope_per_decade)} {unitLabel(opposite.decreasing.unit)} per decade.
                      </p>
                      <p className="num mt-1.5 text-[15px] text-ink-2">
                        Rising fastest: <span className="text-ink">{nameOf(opposite.increasing.region)}</span>, {signed(opposite.increasing.slope_per_decade)} {unitLabel(opposite.increasing.unit)} per decade.
                      </p>
                      <button className="btn mt-4" disabled={running} onClick={() => onExplore([opposite.decreasing.region, opposite.increasing.region], variable)}>
                        <Icon name="play" size={15} /> Compare these two
                      </button>
                      <p className="mt-3 text-[13px] text-ink-3">
                        Both trends are supported on their own. The difference between them has not been tested.
                      </p>
                    </>
                  ) : (
                    <p className="mt-3 max-w-[52ch] text-ink-2">
                      No opposite pair for {labels[variable]?.toLowerCase()}. A pair needs one supported rising trend and one supported falling trend, and this variable has supported trends in one direction only.
                    </p>
                  )}
                </div>
              </div>
            </>
          );
        })()}
      </div>
    </section>
  );
}
