"use client";

import { num, percent, signed, statusLabel, unitLabel, windowLabel } from "@/lib/format";
import { seriesStyle } from "@/lib/palette";
import { featureLabels, groupNames } from "@/lib/patterns";
import type { PatternPart } from "@/lib/useRun";
import type { ApiAnalysis, ApiRegion, ApiVariable, RunConfig } from "@/lib/types";
import Icon from "./Icon";
import Term from "./Term";
import FingerprintBars from "./charts/FingerprintBars";

type Props = {
  part: PatternPart;
  config: RunConfig;
  analysis: ApiAnalysis;
  variables: ApiVariable[];
  regions: ApiRegion[];
  onRetry: () => void;
  onFindTwin: (region: string) => void;
};

/** The precomputed machine-learning results for the regions in this run. Always the full record. */
export default function PatternContext({ part, config, analysis, variables, regions, onRetry, onFindTwin }: Props) {
  const labels = featureLabels(variables);
  const slotOf = (region: string) => config.regions.find((r) => r.id === region)?.slot ?? 1;
  const nameOf = (region: string) => regions.find((r) => r.id === region)?.name ?? region;

  return (
    <div className="mt-12 border-t border-line pt-8" aria-labelledby="pattern-heading">
      <h3 id="pattern-heading" className="text-[22px]">How these regions fit the wider pattern</h3>

      {part.status === "loading" || part.status === "idle" ? (
        <p className="mt-4 flex items-center gap-2.5 text-ink-2" role="status"><span className="spinner" /> Loading the pattern results</p>
      ) : part.status === "error" ? (
        <div className="note note-error mt-4 flex items-start gap-3" role="alert">
          <Icon name="alert" className="mt-0.5 flex-none" />
          <div>
            <p className="font-medium text-ink">The trend results above loaded, but the pattern results did not.</p>
            <p className="mt-1">{part.message}</p>
            <button className="btn mt-3" onClick={onRetry}><Icon name="retry" size={16} /> Load the pattern results again</button>
          </div>
        </div>
      ) : (
        (() => {
          const data = part.data;
          const names = groupNames(data.clustering.centers, data.clustering.feature_separation, labels);
          const top = data.clustering.feature_separation[0];
          const ordered = [...data.clustering.centers].sort((a, b) => (top ? b.features[top.feature] - a.features[top.feature] : a.cluster - b.cluster));
          const withFingerprint = data.regions.filter((r) => r.fingerprint);
          const evaluation = data.clustering.evaluation;
          return (
            <>
              <div className="mt-3 flex flex-wrap gap-2">
                <span className="badge"><Icon name="layers" size={14} /> Full record, {windowLabel(data.scope.start, data.scope.end)}: precomputed</span>
                <span className="badge">{statusLabel(data.model_status)}</span>
              </div>
              <p className="mt-3 max-w-[78ch] text-[14px] text-ink-2">
                {analysis.scope.kind === "custom_window"
                  ? `Your run covers ${windowLabel(analysis.scope.start, analysis.scope.end)}, but everything in this part describes the full record and does not change with the window. `
                  : ""}
                Each region has a <Term id="fingerprint">fingerprint</Term>: its four trends, each divided by how much that region normally varies, so they share one scale. A <Term id="cluster">K-means model</Term> grouped regions with similar fingerprints, and <Term id="twin">Earth Twins</Term> ranks how close two fingerprints are. These describe past change in the GLDAS estimates. They are not forecasts and say nothing about causes.
              </p>

              <div className="mt-7 grid gap-x-10 gap-y-8 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)]">
                <div className="min-w-0">
                  <h4 className="mb-3 text-[16px] font-semibold" style={{ fontStretch: "110%" }}>Fingerprints</h4>
                  {withFingerprint.length ? (
                    <FingerprintBars
                      features={data.clustering.features}
                      labels={labels}
                      entities={withFingerprint.map((r) => ({ key: r.region, slot: slotOf(r.region), name: r.name, values: r.fingerprint as Record<string, number> }))}
                      description="Standardized trends for the regions in this run, by variable."
                    />
                  ) : (
                    <p className="text-ink-2">None of these regions has a complete fingerprint in this run.</p>
                  )}
                </div>

                <div className="min-w-0">
                  <h4 className="mb-3 text-[16px] font-semibold" style={{ fontStretch: "110%" }}>Group and closest match</h4>
                  <ul className="flex flex-col divide-y divide-line border-y border-line">
                    {data.regions.map((r) => {
                      const nearest = r.nearest[0];
                      return (
                        <li key={r.region} className="py-3.5">
                          <p className="flex items-center gap-2 text-[15px] font-medium">
                            <span className="slot" style={{ background: seriesStyle(slotOf(r.region)).color }}>{slotOf(r.region)}</span>
                            {r.name}
                          </p>
                          <p className="mt-1.5 text-[14px] text-ink-2">
                            {r.cluster === null ? "Not placed in a group." : (
                              <>
                                Group: <span className="text-ink">{names[r.cluster].toLowerCase()}</span>
                                {r.role === "validation_assignment" ? ". This region was left out when the model was fitted and placed afterwards" : ""}.
                              </>
                            )}
                          </p>
                          {nearest && (
                            <p className="num mt-1 text-[14px] text-ink-2">
                              Closest match: <span className="text-ink">{nearest.name}</span>, distance {num(nearest.distance, 2)} (pair {nearest.pair_rank} of {nearest.pair_count}, closest first).
                              {nearest.overlap_share ? ` The two overlap on the map (${percent(nearest.overlap_share)} of the smaller one), so part of this is built in.` : ""}
                            </p>
                          )}
                          {r.hotspots.map((h) => (
                            <p key={h.variable} className="num mt-1 text-[14px] text-ink-2">
                              <Term id="hotspot">Hotspot</Term> for {(labels[h.variable] ?? h.variable).toLowerCase()}: {signed(h.slope_per_decade)} {unitLabel(h.unit)} per decade.
                              {h.review_note ? " This series is under review." : ""}
                            </p>
                          ))}
                          <button className="btn-quiet mt-1.5 -ml-2" onClick={() => onFindTwin(r.region)}>
                            <Icon name="twin" size={16} /> See all twins for this region
                          </button>
                        </li>
                      );
                    })}
                  </ul>
                  {data.pairs.length > 0 && (
                    <div className="mt-4">
                      <p className="label mb-1.5">Between the regions in this run</p>
                      <ul className="flex flex-col gap-1.5 text-[14px] text-ink-2">
                        {data.pairs.map((p) => (
                          <li key={`${p.region_a}-${p.region_b}`} className="num">
                            {nameOf(p.region_a)} and {nameOf(p.region_b)}: distance {num(p.distance, 2)}, pair {p.pair_rank} of {p.pair_count}.{" "}
                            {p.same_cluster ? "Same group." : "Different groups."}
                            {p.overlap_share ? ` They overlap on the map (${percent(p.overlap_share)} of the smaller one).` : ""}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              </div>

              <div className="mt-7 max-w-[86ch] text-[13.5px] text-ink-3">
                <p>
                  About the groups: {data.clustering.algorithm} with {data.clustering.k} groups, fitted on {data.clustering.n_training_regions} regions.{" "}
                  {top && ordered.length === 2 && (
                    <>
                      The two centers differ most in {(labels[top.feature] ?? top.feature).toLowerCase()} trend ({signed(ordered[0].features[top.feature], 2)} against {signed(ordered[1].features[top.feature], 2)} standard deviations per decade).{" "}
                    </>
                  )}
                  {ordered.map((c) => `${names[c.cluster]}: ${c.size} regions`).join(". ")}.
                </p>
                <p className="num mt-1.5">
                  Separation score (silhouette) {num(Number(evaluation.silhouette), 2)}, on a scale where 0 means overlapping groups and 1 means clearly separate. Agreement between random restarts {num(Number(evaluation.seed_ari), 2)}; agreement after dropping two years at either end {num(Number(evaluation.endpoint_ari), 2)} (1 means identical groups). No accuracy is claimed, because there are no true labels to compare with.
                </p>
              </div>
            </>
          );
        })()
      )}
    </div>
  );
}
