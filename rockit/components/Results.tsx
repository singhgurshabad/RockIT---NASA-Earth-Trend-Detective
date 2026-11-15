"use client";

import { useEffect, useMemo, useState } from "react";
import { exportUrl } from "@/lib/api";
import { decimalYear } from "@/lib/chart";
import { monthLabel, num, percent, prob, signed, statusLabel, trendDecimals, unitLabel, windowLabel } from "@/lib/format";
import { seriesStyle, variableTint } from "@/lib/palette";
import type { RunState } from "@/lib/useRun";
import { verdict } from "@/lib/verdict";
import type { ApiAnalysis, ApiRegion, ApiRegionResult, ApiVariable, ApiVariableResult, RunConfig } from "@/lib/types";
import Icon from "./Icon";
import PatternContext from "./PatternContext";
import Term from "./Term";
import IntervalPlot, { type IntervalRow } from "./charts/IntervalPlot";
import TimeSeriesChart, { type ChartSeries } from "./charts/TimeSeriesChart";

type View = "anomalies" | "monthly" | "annual";

const VIEWS: { id: View; label: string }[] = [
  { id: "anomalies", label: "Anomalies and trend" },
  { id: "monthly", label: "Monthly values" },
  { id: "annual", label: "Annual means" },
];

type Props = {
  run: RunState;
  stale: boolean;
  canRun: boolean;
  variables: ApiVariable[];
  regions: ApiRegion[];
  onRunDraft: () => void;
  onRetry: (config: RunConfig) => void;
  onRetryPatterns: () => void;
  onFindTwin: (region: string) => void;
};

function ConfigSummary({ config, regions, variables }: { config: RunConfig; regions: ApiRegion[]; variables: ApiVariable[] }) {
  return (
    <span>
      {config.regions.map((r) => regions.find((x) => x.id === r.id)?.name ?? r.id).join(", ")}; {windowLabel(config.start, config.end)};{" "}
      {config.variables.map((v) => variables.find((x) => x.id === v)?.label.replace(" (0-10 cm)", "").toLowerCase() ?? v).join(", ")}
    </span>
  );
}

function downloadJson(analysis: ApiAnalysis) {
  const blob = new Blob([JSON.stringify(analysis, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `rockit_run_${analysis.scope.start}_${analysis.scope.end}.json`;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

export default function Results({ run, stale, canRun, variables, regions, onRunDraft, onRetry, onRetryPatterns, onFindTwin }: Props) {
  const { analysis, shown, phase, failure } = run;
  const [variable, setVariable] = useState<string | null>(null);

  // Keep the open variable valid when a new run arrives with a different list.
  const available = analysis?.results.map((r) => r.variable) ?? [];
  const availableKey = available.join("|");
  useEffect(() => {
    if (available.length && (!variable || !available.includes(variable))) setVariable(available[0]);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [availableKey]);

  const current = analysis?.results.find((r) => r.variable === variable) ?? analysis?.results[0] ?? null;
  const slotOf = (region: string) => shown?.regions.find((r) => r.id === region)?.slot ?? 1;

  return (
    <section id="results" className="section" aria-labelledby="results-heading">
      <div className="page">
        <h2 id="results-heading" className="section-title">Results</h2>

        {failure && (
          <div className="note note-error mt-5 flex items-start gap-3" role="alert">
            <Icon name="alert" className="mt-0.5 flex-none" />
            <div className="min-w-0">
              <p className="font-medium text-ink">The analysis did not finish.</p>
              <p className="mt-1">{failure.message}</p>
              <p className="mt-1 text-ink-3">Requested: <ConfigSummary config={failure.config} regions={regions} variables={variables} /></p>
              {analysis && <p className="mt-1 text-ink-3">The results below are from an earlier run and are unchanged.</p>}
              <button className="btn mt-3" onClick={() => onRetry(failure.config)}><Icon name="retry" size={16} /> Try again</button>
            </div>
          </div>
        )}

        {!analysis && !failure && phase !== "running" && (
          <div className="mt-6 max-w-[62ch] text-ink-2">
            <p className="text-[16px]">No analysis has been run yet.</p>
            <p className="mt-2">
              Choose up to four regions, a time window and at least one variable above, then press Run analysis. You will get the monthly record, the trend per decade with its uncertainty, and how each region fits the wider pattern.
            </p>
          </div>
        )}
        {!analysis && phase === "running" && (
          <p className="mt-6 flex items-center gap-2.5 text-ink-2" role="status"><span className="spinner" /> Running the analysis</p>
        )}

        {analysis && shown && current && (
          <div className="mt-5">
            {/* what these results belong to */}
            <div className="flex flex-wrap items-start justify-between gap-x-6 gap-y-4">
              <div className="min-w-0">
                <ul className="flex flex-wrap gap-2">
                  {[...shown.regions].sort((a, b) => a.slot - b.slot).map((r) => (
                    <li key={r.id} className="flex items-center gap-2 rounded-full border border-line-strong py-1 pl-1.5 pr-3 text-[14px]">
                      <span className="slot" style={{ background: seriesStyle(r.slot).color }}>{r.slot}</span>
                      {regions.find((x) => x.id === r.id)?.name ?? r.id}
                    </li>
                  ))}
                </ul>
                <p className="num mt-3 text-[16px] text-ink">
                  {windowLabel(analysis.scope.start, analysis.scope.end)} <span className="text-ink-3">({analysis.scope.months} months)</span>
                </p>
                <div className="mt-2.5 flex flex-wrap gap-2">
                  <span className="badge">
                    <Icon name={analysis.scope.kind === "full_record" ? "check" : "clock"} size={14} />
                    {analysis.scope.kind === "full_record" ? "Full record: reviewed run" : "Custom window: computed for this request"}
                  </span>
                  <span className="badge" style={{ borderColor: "rgba(226,165,58,0.5)", color: "var(--review)" }}>
                    <Icon name="alert" size={14} />
                    {statusLabel(analysis.provenance.review_status)}
                  </span>
                </div>
              </div>
              <div className="flex flex-wrap gap-2" aria-label="Downloads">
                <a className="btn" href={exportUrl(shown, "monthly")} download><Icon name="download" size={16} /> Monthly data (CSV)</a>
                <a className="btn" href={exportUrl(shown, "trends")} download><Icon name="download" size={16} /> Trends (CSV)</a>
                <button className="btn" onClick={() => downloadJson(analysis)}><Icon name="download" size={16} /> Full result (JSON)</button>
              </div>
            </div>

            {stale && phase !== "running" && (
              <div className="note mt-5 flex flex-wrap items-center gap-x-4 gap-y-2" role="status">
                <Icon name="info" className="flex-none text-accent" />
                <p className="min-w-0 flex-1">The settings above have changed. These results still belong to the run shown here.</p>
                <button className="btn" onClick={onRunDraft} disabled={!canRun}><Icon name="play" size={15} /> Run with the new settings</button>
              </div>
            )}
            {phase === "running" && (
              <p className="note mt-5 flex items-center gap-2.5" role="status"><span className="spinner" /> Running a new analysis. The results below are from the previous run until it finishes.</p>
            )}

            <div className={phase === "running" ? "opacity-55 transition-opacity" : "transition-opacity"}>
              <p className="mt-5 max-w-[78ch] text-[14px] text-ink-2">{analysis.scope.note}</p>

              {analysis.results.length > 1 && (
                <div className="segmented mt-7" role="group" aria-label="Variable">
                  {analysis.results.map((r) => (
                    <button key={r.variable} aria-pressed={r.variable === current.variable} onClick={() => setVariable(r.variable)} className="inline-flex items-center gap-2">
                      <span className="h-2 w-2 rounded-full" style={{ background: variableTint(r.variable) }} aria-hidden="true" />
                      {r.label.replace(" (0-10 cm)", "")}
                    </button>
                  ))}
                </div>
              )}

              <VariablePanel key={current.variable} result={current} analysis={analysis} slotOf={slotOf} variableInfo={variables.find((v) => v.id === current.variable)} />

              <PatternContext
                part={run.patterns}
                config={shown}
                analysis={analysis}
                variables={variables}
                regions={regions}
                onRetry={onRetryPatterns}
                onFindTwin={onFindTwin}
              />
            </div>
          </div>
        )}
      </div>
    </section>
  );
}

// ------------------------------------------------------------------------------

function VariablePanel({
  result, analysis, slotOf, variableInfo,
}: { result: ApiVariableResult; analysis: ApiAnalysis; slotOf: (region: string) => number; variableInfo?: ApiVariable }) {
  const [view, setView] = useState<View>("anomalies");
  const [showFit, setShowFit] = useState(false);
  const unit = result.unit;
  const label = result.label.replace(" (0-10 cm)", "");
  const first = result.regions[0];
  const custom = analysis.scope.kind === "custom_window";

  const chart = useMemo(() => {
    if (view === "annual") {
      const years = [...new Set(result.regions.flatMap((r) => r.annual.years))].sort((a, b) => a - b);
      const series: ChartSeries[] = result.regions.map((r) => ({
        key: r.region,
        slot: slotOf(r.region),
        name: r.name,
        data: years.map((y) => {
          const i = r.annual.years.indexOf(y);
          return i < 0 ? null : r.annual.means[i];
        }),
      }));
      return { x: years, xLabels: years.map(String), series };
    }
    const dates = first.series.dates;
    const x = dates.map(decimalYear);
    const xLabels = dates.map(monthLabel);
    const n = dates.length;
    const series: ChartSeries[] = result.regions.map((r) => {
      const ok = r.trend.status === "ok";
      if (view === "monthly") {
        return { key: r.region, slot: slotOf(r.region), name: r.name, data: r.series.values, model: showFit && ok ? r.series.fitted : undefined };
      }
      // Slope uncertainty around the trend line: the same line drawn with the low and the high end of the 95% range.
      const band = ok && r.trend.ci_low !== null && r.trend.ci_high !== null
        ? (() => {
            const low: number[] = [];
            const high: number[] = [];
            for (let i = 0; i < n; i += 1) {
              const decades = (i - (n - 1) / 2) / 120;
              const a = (r.trend.ci_low as number) * decades;
              const b = (r.trend.ci_high as number) * decades;
              low.push(Math.min(a, b));
              high.push(Math.max(a, b));
            }
            return { low, high };
          })()
        : undefined;
      return { key: r.region, slot: slotOf(r.region), name: r.name, data: r.series.anomalies, model: ok ? r.series.trend_component : undefined, band };
    });
    return { x, xLabels, series };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [result, view, showFit]);

  const caption =
    view === "anomalies"
      ? `Thin line: each month compared with the average for that calendar month (${analysis.scope.anomaly_baseline.toLowerCase()}). Thick line: the fitted trend. Shaded wedge: the trend line drawn at both ends of its 95% range.`
      : view === "monthly"
        ? `Monthly ${label.toLowerCase()} as estimated by GLDAS, in ${unitLabel(unit)}. The seasonal cycle is left in.${showFit ? " Thick line: the fitted seasonal cycle plus trend." : ""}`
        : "The mean of each calendar year that has all 12 months inside the window. For inspection only; the trend is fitted to the monthly values.";

  const rows: IntervalRow[] = result.regions.map((r) => ({
    key: r.region,
    slot: slotOf(r.region),
    name: r.name,
    value: r.trend.status === "ok" ? r.trend.slope_per_decade : null,
    low: r.trend.status === "ok" ? r.trend.ci_low : null,
    high: r.trend.status === "ok" ? r.trend.ci_high : null,
    supported: Boolean(r.trend.significant),
    note: verdict(r.trend, label, analysis.significance.family_size),
    reference:
      custom && r.full_record_trend && r.full_record_trend.slope_per_decade !== null && r.full_record_trend.ci_low !== null && r.full_record_trend.ci_high !== null
        ? {
            value: r.full_record_trend.slope_per_decade,
            low: r.full_record_trend.ci_low,
            high: r.full_record_trend.ci_high,
            supported: Boolean(r.full_record_trend.significant),
            label: `Full record: ${signed(r.full_record_trend.slope_per_decade)} per decade, ${r.full_record_trend.significant ? "supported" : "inconclusive"}.`,
          }
        : null,
  }));

  const flagged = result.regions.filter((r) => r.review_note);

  return (
    <div className="mt-7">
      <div className="flex flex-wrap items-baseline gap-x-4 gap-y-1">
        <h3 className="flex items-center gap-2.5 text-[22px]">
          <span className="inline-block h-[18px] w-[4px] rounded-full" style={{ background: variableTint(result.variable) }} aria-hidden="true" />
          {label}
        </h3>
        <span className="text-ink-3">{unitLabel(unit)}, GLDAS field {result.gldas_field}</span>
      </div>
      {variableInfo && <p className="mt-1.5 max-w-[78ch] text-[14px] text-ink-2">{variableInfo.description}</p>}

      {flagged.map((r) => (
        <div key={r.region} className="note note-review mt-4 flex items-start gap-3">
          <Icon name="alert" className="mt-0.5 flex-none text-review" />
          <div>
            <p className="font-medium text-ink">{r.name}: {r.review_note?.title}</p>
            <p className="mt-1">{r.review_note?.note}</p>
            {r.review_note?.evidence && (
              <p className="num mt-1.5 text-ink-2">
                In the data: yearly mean {num(r.review_note.evidence.first_year_mean)} {unitLabel(r.review_note.evidence.unit)} in {r.review_note.evidence.first_year} and{" "}
                {num(r.review_note.evidence.last_year_mean)} in {r.review_note.evidence.last_year}. Largest single-year step: {signed(r.review_note.evidence.largest_step)}{" "}
                {unitLabel(r.review_note.evidence.unit)} from {r.review_note.evidence.largest_step_from_year} to {r.review_note.evidence.largest_step_to_year}.
              </p>
            )}
            {r.review_note?.raised_by && <p className="mt-1 text-[12.5px] text-ink-3">Raised by {r.review_note.raised_by}. Not part of the analysis run.</p>}
          </div>
        </div>
      ))}

      {/* chart */}
      <div className="mt-6 grid gap-x-10 gap-y-8 lg:grid-cols-[minmax(0,1.55fr)_minmax(0,1fr)]">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="segmented" role="group" aria-label="Chart view">
              {VIEWS.map((v) => (
                <button key={v.id} aria-pressed={view === v.id} onClick={() => setView(v.id)}>{v.label}</button>
              ))}
            </div>
            {view === "monthly" && (
              <label className="flex cursor-pointer items-center gap-2 text-[13.5px] text-ink-2">
                <input type="checkbox" checked={showFit} onChange={(e) => setShowFit(e.target.checked)} className="h-4 w-4 accent-[#6cc7e6]" />
                Show the fitted line
              </label>
            )}
          </div>
          <ul className="mt-3 flex flex-wrap gap-x-5 gap-y-1 text-[13.5px] text-ink-2" aria-label="Regions in this chart">
            {result.regions.map((r) => {
              const style = seriesStyle(slotOf(r.region));
              return (
                <li key={r.region} className="flex items-center gap-2">
                  <span className="slot" style={{ background: style.color }}>{style.slot}</span>
                  {r.name}
                </li>
              );
            })}
          </ul>
          <div className="mt-2">
            <TimeSeriesChart
              x={chart.x}
              xLabels={chart.xLabels}
              series={chart.series}
              unit={unit}
              zeroLine={view === "anomalies"}
              markers={view === "annual"}
              dataLabel={view === "anomalies" ? "Monthly anomaly" : view === "monthly" ? "Monthly value" : "Annual mean, complete years only"}
              modelLabel={view === "anomalies" ? "trend line" : "fit"}
              description={`${label}, ${VIEWS.find((v) => v.id === view)?.label.toLowerCase()}, ${windowLabel(analysis.scope.start, analysis.scope.end)}, for ${result.regions.map((r) => r.name).join(", ")}.`}
            />
          </div>
          <p className="mt-2 max-w-[80ch] text-[13px] text-ink-3">{caption}</p>
          <details className="mt-3">
            <summary className="btn-quiet w-max cursor-pointer"><Icon name="table" size={16} /> Show these values as a table</summary>
            <div className="mt-2 max-h-[340px] overflow-auto rounded-lg border border-line" tabIndex={0} role="region" aria-label="Chart values">
              <table className="data-table num">
                <thead className="sticky top-0 bg-panel">
                  <tr>
                    <th scope="col">{view === "annual" ? "Year" : "Month"}</th>
                    {chart.series.map((s) => (
                      <th key={s.key} scope="col" className="text-right">{s.name} ({unitLabel(unit)})</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {chart.xLabels.map((xLabel, i) => (
                    <tr key={xLabel}>
                      <th scope="row" className="whitespace-nowrap border-b border-line px-3 py-1.5 text-left font-normal text-ink-2">{xLabel}</th>
                      {chart.series.map((s) => (
                        <td key={s.key} className="!py-1.5 text-right">{s.data[i] === null ? <span className="text-ink-3">no data</span> : num(s.data[i], 3)}</td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </details>
        </div>

        {/* trend readout */}
        <div className="min-w-0">
          <h4 className="text-[16px] font-semibold" style={{ fontStretch: "110%" }}>
            <Term id="trend">Trend</Term> per decade, with its <Term id="confidence_interval">95% range</Term>
          </h4>
          <div className="mt-4">
            <IntervalPlot
              rows={rows}
              unit={unit}
              description={`Trend in ${label.toLowerCase()} per decade for each region, with 95% ranges.`}
            />
          </div>
          <p className="mt-4 text-[13px] text-ink-3">
            A trend is called <Term id="evidence">supported</Term> only if its <Term id="q_value">q-value</Term> is {analysis.significance.alpha} or less, counting all {analysis.significance.family_size} region and variable trends tested in the same window. The range covers the fit only, not uncertainty in the GLDAS model.
          </p>
        </div>
      </div>

      {/* full statistics */}
      <details className="mt-7 border-t border-line pt-4">
        <summary className="cursor-pointer text-[15px] font-medium text-ink">All statistics for {label.toLowerCase()}</summary>
        <div className="mt-3 overflow-x-auto">
          <table className="data-table num min-w-[760px]">
            <thead>
              <tr>
                <th scope="col">Region</th>
                <th scope="col" className="text-right">Trend per decade</th>
                <th scope="col" className="text-right">95% range</th>
                <th scope="col" className="text-right">Change over window</th>
                <th scope="col" className="text-right"><Term id="p_value">p</Term></th>
                <th scope="col" className="text-right"><Term id="q_value">q</Term></th>
                <th scope="col">Evidence</th>
                <th scope="col" className="text-right">Months used</th>
                <th scope="col" className="text-right"><Term id="standardized_trend">Standardized</Term></th>
              </tr>
            </thead>
            <tbody>
              {result.regions.map((r) => {
                const t = r.trend;
                const d = trendDecimals([t.slope_per_decade, t.ci_low, t.ci_high]);
                return (
                  <tr key={r.region}>
                    <th scope="row" className="border-b border-line px-3 py-2 text-left font-medium">
                      <span className="flex items-center gap-2"><span className="slot" style={{ background: seriesStyle(slotOf(r.region)).color }}>{slotOf(r.region)}</span>{r.name}</span>
                    </th>
                    {t.status !== "ok" ? (
                      <td colSpan={8} className="text-ink-2">No trend: {t.reason ?? t.status}. {t.n_observations} of {t.expected_months} months have data.</td>
                    ) : (
                      <>
                        <td className="text-right">{signed(t.slope_per_decade, d)} {unitLabel(unit)}</td>
                        <td className="whitespace-nowrap text-right">{signed(t.ci_low, d)} to {signed(t.ci_high, d)}</td>
                        <td className="text-right">{signed(t.fitted_period_change, d)} {unitLabel(unit)}</td>
                        <td className="text-right">{prob(t.p_value)}</td>
                        <td className="text-right">{prob(t.q_value)}</td>
                        <td>
                          <span className="flex items-center gap-1.5 whitespace-nowrap">
                            <Icon name={t.significant ? (t.direction === "increasing" ? "up" : "down") : "flat"} size={15} />
                            {t.significant ? `Supported, ${t.direction === "increasing" ? "rising" : "falling"}` : "Inconclusive"}
                          </span>
                        </td>
                        <td className="whitespace-nowrap text-right">{t.n_observations} of {t.expected_months} ({percent(t.coverage)})</td>
                        <td className="text-right">{signed(t.standardized_trend, 2)}</td>
                      </>
                    )}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        <p className="mt-3 max-w-[90ch] text-[13px] text-ink-3">
          Method: {first.trend.method ?? "see Method and data"}. Residual correlation allowed for up to {first.trend.hac_lags ?? "the configured number of"} months.{" "}
          {custom ? "Computed for this request; not part of the reviewed run." : "From the reviewed run."}
        </p>

        {!custom && result.regions.some((r) => r.robustness?.length) && (
          <div className="mt-6">
            <h4 className="text-[15px] font-semibold" style={{ fontStretch: "108%" }}>How stable is each trend?</h4>
            <p className="mt-1 max-w-[80ch] text-[13px] text-ink-3">
              The reviewed run re-fitted every trend five ways: three settings for how long residual correlation may last, and two with the first or last two years removed. These are checks on one result, not five independent results.
            </p>
            <div className="mt-3 grid gap-5 md:grid-cols-2">
              {result.regions.filter((r) => r.robustness?.length).map((r) => (
                <RobustnessBlock key={r.region} item={r} unit={unit} slot={slotOf(r.region)} />
              ))}
            </div>
          </div>
        )}
        {custom && <p className="mt-4 text-[13px] text-ink-3">Stability checks exist for the full record only. Run the full record to see them.</p>}
      </details>
    </div>
  );
}

function RobustnessBlock({ item, unit, slot }: { item: ApiRegionResult; unit: string; slot: number }) {
  const checks = (item.robustness ?? []).filter((c) => c.status === "ok" && c.slope_per_decade !== null);
  const headline = item.trend.slope_per_decade ?? 0;
  const sameSign = checks.filter((c) => Math.sign(c.slope_per_decade as number) === Math.sign(headline)).length;
  const clear = checks.filter((c) => (c.ci_low as number) > 0 || (c.ci_high as number) < 0).length;
  const d = trendDecimals(checks.flatMap((c) => [c.slope_per_decade, c.ci_low, c.ci_high]));
  return (
    <div>
      <p className="flex items-center gap-2 text-[14px] font-medium">
        <span className="slot" style={{ background: seriesStyle(slot).color }}>{slot}</span>
        {item.name}
      </p>
      <p className="mt-1 text-[13px] text-ink-2">
        Same direction in {sameSign} of {checks.length} checks. The 95% range leaves out zero in {clear} of {checks.length}.
      </p>
      <table className="data-table num mt-2">
        <thead>
          <tr>
            <th scope="col">Check</th>
            <th scope="col" className="text-right">Trend ({unitLabel(unit)} per decade)</th>
            <th scope="col" className="text-right">95% range</th>
          </tr>
        </thead>
        <tbody>
          {checks.map((c) => (
            <tr key={c.check}>
              <th scope="row" className="border-b border-line px-3 py-1.5 text-left font-normal text-ink-2">{c.label}</th>
              <td className="!py-1.5 text-right">{signed(c.slope_per_decade, d)}</td>
              <td className="whitespace-nowrap !py-1.5 text-right">{signed(c.ci_low, d)} to {signed(c.ci_high, d)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
