"use client";

import { useEffect, useMemo, useState } from "react";
import { ApiError, getTwins, isAbort } from "@/lib/api";
import { groupLabel, num, percent, signed, unitLabel, windowLabel } from "@/lib/format";
import { seriesStyle } from "@/lib/palette";
import { featureLabels, groupNames } from "@/lib/patterns";
import type { ApiClusters, ApiRegion, ApiTwins, ApiVariable } from "@/lib/types";
import Icon from "./Icon";
import Term from "./Term";
import ClusterScatter from "./charts/ClusterScatter";
import FingerprintBars from "./charts/FingerprintBars";

type Props = {
  regions: ApiRegion[];
  variables: ApiVariable[];
  clusters: { status: "loading" | "ok" | "error"; data: ApiClusters | null; message: string | null };
  onRetryClusters: () => void;
  region: string;
  onRegion: (region: string) => void;
  onShowOnGlobe: (a: string, b: string) => void;
  onCompare: (a: string, b: string) => void;
  running: boolean;
};

type Load = { status: "loading" } | { status: "ok"; data: ApiTwins } | { status: "error"; message: string };

/**
 * Earth Twins: for one region, every other region ranked by how similar its change since 2001 was.
 * Uses the reviewed run's fingerprints through /api/twins. Nothing is computed in the browser.
 */
export default function Twins({ regions, variables, clusters, onRetryClusters, region, onRegion, onShowOnGlobe, onCompare, running }: Props) {
  const [load, setLoad] = useState<Load>({ status: "loading" });
  const [partner, setPartner] = useState<string | null>(null);
  const [skipOverlap, setSkipOverlap] = useState(false);
  const [showAll, setShowAll] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const labels = useMemo(() => featureLabels(variables), [variables]);

  useEffect(() => {
    const controller = new AbortController();
    setLoad({ status: "loading" });
    setPartner(null);
    getTwins(region, controller.signal)
      .then((data) => setLoad({ status: "ok", data }))
      .catch((error) => {
        if (isAbort(error)) return;
        setLoad({ status: "error", message: error instanceof ApiError ? error.message : "Something went wrong." });
      });
    return () => controller.abort();
  }, [region, attempt]);

  const data = load.status === "ok" && load.data.region === region ? load.data : null;
  const ranking = useMemo(() => (data ? data.ranking.filter((t) => !skipOverlap || !t.overlap_share) : []), [data, skipOverlap]);
  const chosen = ranking.find((t) => t.region === partner) ?? ranking[0] ?? null;
  const visible = showAll ? ranking : ranking.slice(0, 6);
  const farthest = data ? data.ranking[data.ranking.length - 1] : null;
  const hasOverlap = Boolean(data?.ranking.some((t) => t.overlap_share));
  const names = clusters.data ? groupNames(clusters.data.centers, clusters.data.feature_separation, labels) : {};

  const sorted = useMemo(() => [...regions].sort((a, b) => a.name.localeCompare(b.name)), [regions]);

  return (
    <section id="twins" className="section" aria-labelledby="twins-heading">
      <div className="page">
        <h2 id="twins-heading" className="section-title">Earth Twins</h2>
        <p className="section-lede">
          Pick a region and see which other region&apos;s land surface changed most like it since 2001. Twins can be continents apart and look nothing alike: they share a pattern of change, not a climate.
        </p>

        <div className="mt-6 flex flex-wrap items-end gap-x-5 gap-y-3">
          <label className="flex min-w-[240px] flex-col gap-1.5">
            <span className="label">Find twins for</span>
            <select className="field" value={region} onChange={(event) => onRegion(event.target.value)}>
              {sorted.map((r) => (
                <option key={r.id} value={r.id}>{r.name}</option>
              ))}
            </select>
          </label>
          {hasOverlap && (
            <label className="flex min-h-[40px] cursor-pointer items-center gap-2 text-[14px] text-ink-2">
              <input type="checkbox" className="h-4 w-4 accent-[#6cc7e6]" checked={skipOverlap} onChange={(e) => { setSkipOverlap(e.target.checked); setPartner(null); }} />
              Leave out regions that overlap this one on the map
            </label>
          )}
        </div>

        {load.status === "loading" && <p className="mt-6 flex items-center gap-2.5 text-ink-2" role="status"><span className="spinner" /> Finding twins</p>}
        {load.status === "error" && (
          <div className="note note-error mt-6 flex items-start gap-3" role="alert">
            <Icon name="alert" className="mt-0.5 flex-none" />
            <div>
              <p className="font-medium text-ink">Twins could not be loaded.</p>
              <p className="mt-1">{load.message}</p>
              <button className="btn mt-3" onClick={() => setAttempt((n) => n + 1)}><Icon name="retry" size={16} /> Try again</button>
            </div>
          </div>
        )}

        {data && chosen && (
          <div className="mt-8 grid gap-x-12 gap-y-10 lg:grid-cols-[minmax(0,0.9fr)_minmax(0,1.25fr)]">
            {/* ranking */}
            <div className="min-w-0">
              <h3 className="text-[17px]">Most similar to {data.name}</h3>
              <ol className="mt-3 flex flex-col">
                {visible.map((t) => {
                  const active = t.region === chosen.region;
                  const rank = data.ranking.indexOf(t) + 1;
                  return (
                    <li key={t.region}>
                      <button
                        className="flex w-full items-center gap-3 border-b border-line px-2 py-2.5 text-left transition-colors hover:bg-raised"
                        style={active ? { background: "var(--raised)", boxShadow: "inset 2px 0 0 var(--accent)" } : undefined}
                        aria-pressed={active}
                        onClick={() => setPartner(t.region)}
                      >
                        <span className="num w-6 flex-none text-right text-[13px] text-ink-3">{rank}</span>
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-[14.5px]">{t.name}</span>
                          <span className="block text-[12.5px] text-ink-3">
                            {groupLabel(regions.find((r) => r.id === t.region)?.group ?? "")}
                            {t.overlap_share ? `, overlaps (${percent(t.overlap_share)} of the smaller one)` : ""}
                          </span>
                        </span>
                        <span className="flex w-[104px] flex-none items-center gap-2" title="Distance between fingerprints. Shorter bar: more alike.">
                          <span className="h-1.5 flex-1 rounded-full bg-line">
                            <span className="block h-1.5 rounded-full" style={{ width: `${Math.max(4, (t.distance / data.all_pairs.max) * 100)}%`, background: "var(--ink-2)" }} />
                          </span>
                          <span className="num w-9 text-right text-[13px] text-ink-2">{num(t.distance, 2)}</span>
                        </span>
                      </button>
                    </li>
                  );
                })}
              </ol>
              <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1">
                {ranking.length > 6 && (
                  <button className="btn-quiet -ml-2" onClick={() => setShowAll((v) => !v)} aria-expanded={showAll}>
                    <Icon name="chevron" size={16} className={showAll ? "rotate-180" : ""} />
                    {showAll ? "Show the closest six" : `Show all ${ranking.length}`}
                  </button>
                )}
                {farthest && !showAll && (
                  <button className="btn-quiet" onClick={() => { setShowAll(true); setPartner(farthest.region); }}>
                    Least similar: {farthest.name}
                  </button>
                )}
              </div>
              <p className="num mt-3 text-[13px] text-ink-3">
                Number: distance between <Term id="fingerprint">fingerprints</Term>, smaller is more alike. Across all {data.all_pairs.count} pairs of regions it runs from {num(data.all_pairs.min, 2)} to {num(data.all_pairs.max, 2)}, with a middle value of {num(data.all_pairs.median, 2)}.
              </p>
            </div>

            {/* evidence for the chosen pair */}
            <div className="min-w-0">
              <h3 className="text-[20px]">{data.name} and {chosen.name}</h3>
              <p className="num mt-2 text-[15px] text-ink-2">
                Distance {num(chosen.distance, 2)}: pair {chosen.pair_rank} of {chosen.pair_count}, counting from the most alike.{" "}
                {chosen.same_cluster ? "The model put them in the same group." : "The model put them in different groups."}
              </p>
              {chosen.overlap_share && (
                <p className="note note-review mt-3 flex items-start gap-2.5">
                  <Icon name="alert" className="mt-0.5 flex-none text-review" />
                  <span>
                    These two regions overlap on the map: {percent(chosen.overlap_share)} of the smaller one lies inside the other. They share GLDAS grid cells, so much of their similarity is built in rather than discovered.
                  </span>
                </p>
              )}

              <div className="mt-5">
                <FingerprintBars
                  features={data.features}
                  labels={labels}
                  entities={[
                    { key: data.region, slot: 1, name: data.name, values: data.fingerprint },
                    { key: chosen.region, slot: 2, name: chosen.name, values: chosen.fingerprint },
                  ]}
                  description={`Fingerprints of ${data.name} and ${chosen.name}.`}
                />
              </div>

              <div className="mt-6 overflow-x-auto">
                <table className="data-table num min-w-[480px]">
                  <caption className="mb-2 text-left text-[13.5px] text-ink-2">The trends behind the fingerprints, in their own units ({windowLabel(data.scope.start, data.scope.end)})</caption>
                  <thead>
                    <tr>
                      <th scope="col">Per decade</th>
                      <th scope="col" className="text-right"><span className="inline-flex items-center gap-1.5"><span className="slot" style={{ background: seriesStyle(1).color }}>1</span>{data.name}</span></th>
                      <th scope="col" className="text-right"><span className="inline-flex items-center gap-1.5"><span className="slot" style={{ background: seriesStyle(2).color }}>2</span>{chosen.name}</span></th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.features.map((f) => {
                      const a = data.trends[f];
                      const b = chosen.trends[f];
                      return (
                        <tr key={f}>
                          <th scope="row" className="border-b border-line px-3 py-2 text-left font-normal text-ink-2">{labels[f]} ({unitLabel(a.unit)})</th>
                          <td className="text-right">{signed(a.slope_per_decade)} <span className="text-ink-3">{a.significant ? "supported" : "inconclusive"}</span></td>
                          <td className="text-right">{signed(b.slope_per_decade)} <span className="text-ink-3">{b.significant ? "supported" : "inconclusive"}</span></td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
              <p className="mt-2 text-[13px] text-ink-3">
                {(() => {
                  const both = data.features.filter((f) => data.trends[f].significant && chosen.trends[f].significant).length;
                  return `${both} of the ${data.features.length} trends are supported for both regions. The match uses all ${data.features.length}, including inconclusive ones, so treat it as a lead to explore, not a finding.`;
                })()}
              </p>

              <div className="mt-5 flex flex-wrap gap-2.5">
                <button className="btn" onClick={() => onShowOnGlobe(data.region, chosen.region)}><Icon name="globe" size={16} /> Show both on the globe</button>
                <button className="btn" onClick={() => onCompare(data.region, chosen.region)} disabled={running}>
                  <Icon name="play" size={15} /> Compare their records
                </button>
              </div>

              <ul className="mt-6 flex max-w-[70ch] list-disc flex-col gap-1 pl-5 text-[13px] text-ink-3">
                {data.limitations.map((l) => <li key={l}>{l}</li>)}
              </ul>
            </div>
          </div>
        )}

        {data && !chosen && <p className="mt-6 text-ink-2">Every other region overlaps this one. Untick the box above to see them.</p>}

        {/* the whole field */}
        <div className="mt-14 border-t border-line pt-8">
          <h3 className="text-[20px]">All 21 regions at once</h3>
          <p className="mt-2 max-w-[74ch] text-[14px] text-ink-2">
            Each mark is a region, placed by two of its four standardized trends. Shape shows the group the <Term id="cluster">K-means model</Term> gave it. The model and the twin distance use all four trends, so two marks can sit close here and still differ on the other two.
          </p>
          <div className="mt-5 max-w-[860px]">
            {clusters.status === "loading" && <p className="flex items-center gap-2.5 text-ink-2" role="status"><span className="spinner" /> Loading the groups</p>}
            {clusters.status === "error" && (
              <div className="note note-error flex items-start gap-3" role="alert">
                <Icon name="alert" className="mt-0.5 flex-none" />
                <div>
                  <p className="font-medium text-ink">The groups could not be loaded.</p>
                  <p className="mt-1">{clusters.message}</p>
                  <button className="btn mt-3" onClick={onRetryClusters}><Icon name="retry" size={16} /> Try again</button>
                </div>
              </div>
            )}
            {clusters.data && (
              <ClusterScatter
                points={clusters.data.assignments.filter((a) => a.fingerprint).map((a) => ({
                  id: a.region,
                  name: a.name,
                  cluster: a.cluster,
                  values: a.fingerprint as Record<string, number>,
                  slot: a.region === region ? 1 : chosen && a.region === chosen.region ? 2 : 0,
                  validation: a.role === "validation_assignment",
                }))}
                centers={clusters.data.centers}
                features={clusters.data.features}
                labels={labels}
                groupNames={names}
                initialX={clusters.data.feature_separation[0]?.feature ?? clusters.data.features[0]}
                initialY={clusters.data.feature_separation[1]?.feature ?? clusters.data.features[1]}
              />
            )}
          </div>
        </div>
      </div>
    </section>
  );
}
