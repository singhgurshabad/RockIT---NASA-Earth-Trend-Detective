"use client";

import { useId, useMemo, useState } from "react";
import { extent, linePath, linear, padded, tickDecimals, ticks } from "@/lib/chart";
import { num, unitLabel } from "@/lib/format";
import { INK, seriesStyle } from "@/lib/palette";
import { useMeasure } from "@/lib/useMeasure";

export type ChartSeries = {
  key: string;
  slot: number;
  name: string;
  /** The data: one value per x position. null draws a gap. */
  data: (number | null)[];
  /** Optional fitted line drawn over the data (for example the trend line). */
  model?: (number | null)[];
  /** Optional band around the model (uncertainty in the slope). */
  band?: { low: (number | null)[]; high: (number | null)[] };
};

type Props = {
  /** Numeric x positions (decimal years). */
  x: number[];
  /** Text for each x position, shown when inspecting a point ("Mar 2010"). */
  xLabels: string[];
  series: ChartSeries[];
  unit: string;
  dataLabel: string;
  modelLabel?: string;
  /** Draw a marker on every data point (for short series such as annual means). */
  markers?: boolean;
  zeroLine?: boolean;
  description: string;
};

const MARGIN = { top: 16, right: 34, bottom: 28, left: 50 };

export default function TimeSeriesChart({ x, xLabels, series, unit, dataLabel, modelLabel, markers, zeroLine, description }: Props) {
  const [ref, width] = useMeasure<HTMLDivElement>();
  const [active, setActive] = useState<number | null>(null);
  const clip = useId();
  const height = width < 520 ? 270 : 340;
  const innerWidth = Math.max(10, width - MARGIN.left - MARGIN.right);
  const innerHeight = height - MARGIN.top - MARGIN.bottom;

  const geometry = useMemo(() => {
    const all: (number | null)[] = [];
    for (const s of series) {
      all.push(...s.data);
      if (s.model) all.push(...s.model);
      if (s.band) all.push(...s.band.low, ...s.band.high);
    }
    if (zeroLine) all.push(0);
    const [lo, hi] = extent(all);
    const yDomain = padded(lo, hi);
    const xDomain: [number, number] = x.length ? [x[0], x[x.length - 1]] : [0, 1];
    const sx = linear(xDomain[0] === xDomain[1] ? [xDomain[0] - 1, xDomain[1] + 1] : xDomain, [0, innerWidth]);
    const sy = linear(yDomain, [innerHeight, 0]);
    const xs = x.map((v) => sx(v));
    const yTicks = ticks(yDomain[0], yDomain[1], height < 300 ? 4 : 5);
    const firstYear = Math.ceil(xDomain[0] - 1e-9);
    const lastYear = Math.floor(xDomain[1] + 1e-9);
    const room = Math.max(2, Math.floor(innerWidth / 58));
    const yearStep = [1, 2, 4, 5, 10].find((step) => (lastYear - firstYear) / step <= room) ?? 10;
    const xTicks: number[] = [];
    for (let year = Math.ceil(firstYear / yearStep) * yearStep; year <= lastYear; year += yearStep) xTicks.push(year);
    return { sx, sy, xs, yTicks, xTicks };
  }, [series, x, innerWidth, innerHeight, zeroLine, height]);

  const { sx, sy, xs, yTicks, xTicks } = geometry;
  const yDecimals = tickDecimals(yTicks);
  const toY = (values: (number | null)[]) => values.map((v) => (v === null || !Number.isFinite(v) ? null : sy(v)));

  // End-of-line number badges, nudged apart so they never sit on top of each other.
  const ends = useMemo(() => {
    const items = series
      .map((s) => {
        const source = s.model ?? s.data;
        for (let i = source.length - 1; i >= 0; i -= 1) {
          const v = source[i];
          if (v !== null && Number.isFinite(v)) return { slot: s.slot, y: sy(v), x: xs[i] };
        }
        return null;
      })
      .filter((e): e is { slot: number; y: number; x: number } => e !== null)
      .sort((a, b) => a.y - b.y);
    for (let i = 1; i < items.length; i += 1) {
      if (items[i].y - items[i - 1].y < 19) items[i].y = items[i - 1].y + 19;
    }
    return items;
  }, [series, sy, xs]);

  const nearest = (clientX: number, target: Element) => {
    const rect = target.getBoundingClientRect();
    const px = clientX - rect.left;
    let best = 0;
    for (let i = 1; i < xs.length; i += 1) if (Math.abs(xs[i] - px) < Math.abs(xs[best] - px)) best = i;
    return best;
  };

  const onKey = (event: React.KeyboardEvent) => {
    if (!x.length) return;
    const jump = event.shiftKey ? 12 : 1;
    let next = active;
    if (event.key === "ArrowRight") next = Math.min(x.length - 1, (active ?? -1) + jump);
    else if (event.key === "ArrowLeft") next = Math.max(0, (active ?? x.length) - jump);
    else if (event.key === "Home") next = 0;
    else if (event.key === "End") next = x.length - 1;
    else if (event.key === "Escape") next = null;
    else return;
    event.preventDefault();
    setActive(next);
  };

  const readout =
    active === null
      ? ""
      : `${xLabels[active]}: ` +
        series.map((s) => `${s.name} ${num(s.data[active])} ${unitLabel(unit)}`).join("; ");
  const tipLeft = active === null ? 0 : MARGIN.left + xs[active];
  const flip = tipLeft > width * 0.5;
  // The value card always fits inside the chart, whichever side of the cursor it sits on.
  const tipRoom = Math.max(120, (flip ? tipLeft : width - tipLeft) - 16);

  return (
    <div
      ref={ref}
      className="relative w-full select-none rounded-md"
      tabIndex={0}
      role="group"
      aria-label={`${description} Use the left and right arrow keys to read values; hold Shift to move a year at a time.`}
      onKeyDown={onKey}
      onBlur={() => setActive(null)}
    >
      {width > 0 && (
        <svg width={width} height={height} role="img" aria-label={description} style={{ display: "block" }}>
          <defs>
            <clipPath id={clip}><rect x={-7} y={-7} width={innerWidth + 14} height={innerHeight + 14} /></clipPath>
          </defs>
          <g transform={`translate(${MARGIN.left},${MARGIN.top})`}>
            {yTicks.map((tick) => (
              <g key={tick}>
                <line x1={0} x2={innerWidth} y1={sy(tick)} y2={sy(tick)} stroke={zeroLine && tick === 0 ? INK.axis : INK.grid} strokeWidth={1} />
                <text x={-10} y={sy(tick)} dy="0.32em" textAnchor="end" fontSize={12} fill={INK.muted} style={{ fontVariantNumeric: "tabular-nums" }}>
                  {num(tick, yDecimals)}
                </text>
              </g>
            ))}
            <text x={-MARGIN.left + 2} y={-4} fontSize={12} fill={INK.muted}>{unitLabel(unit)}</text>
            <line x1={0} x2={innerWidth} y1={innerHeight} y2={innerHeight} stroke={INK.axis} strokeWidth={1} />
            {xTicks.map((year) => (
              <g key={year} transform={`translate(${sx(year)},${innerHeight})`}>
                <line y2={5} stroke={INK.axis} />
                <text y={19} textAnchor="middle" fontSize={12} fill={INK.muted} style={{ fontVariantNumeric: "tabular-nums" }}>{year}</text>
              </g>
            ))}

            <g clipPath={`url(#${clip})`}>
              {series.map((s) => {
                if (!s.band) return null;
                const low = toY(s.band.low);
                const high = toY(s.band.high);
                const points: string[] = [];
                for (let i = 0; i < xs.length; i += 1) if (high[i] !== null) points.push(`${xs[i].toFixed(1)},${(high[i] as number).toFixed(1)}`);
                for (let i = xs.length - 1; i >= 0; i -= 1) if (low[i] !== null) points.push(`${xs[i].toFixed(1)},${(low[i] as number).toFixed(1)}`);
                return <polygon key={`band-${s.key}`} points={points.join(" ")} fill={seriesStyle(s.slot).color} opacity={0.13} />;
              })}
              {series.map((s) => {
                const style = seriesStyle(s.slot);
                const hasModel = Boolean(s.model);
                return (
                  <g key={s.key}>
                    <path
                      d={linePath(xs, toY(s.data))}
                      fill="none"
                      stroke={style.color}
                      strokeWidth={hasModel ? 1.1 : markers ? 2 : 1.6}
                      strokeOpacity={hasModel ? 0.62 : 1}
                      strokeLinejoin="round"
                      strokeLinecap="round"
                      strokeDasharray={!hasModel && markers ? style.dash : undefined}
                    />
                    {markers &&
                      s.data.map((v, i) =>
                        v === null ? null : (
                          <circle key={i} cx={xs[i]} cy={sy(v)} r={3.6} fill={style.color} stroke={INK.surface} strokeWidth={1.5} />
                        ),
                      )}
                    {s.model && (
                      <path d={linePath(xs, toY(s.model))} fill="none" stroke={style.color} strokeWidth={2.2} strokeDasharray={style.dash} strokeLinecap="round" />
                    )}
                  </g>
                );
              })}
            </g>

            {ends.map((end) => (
              <g key={end.slot} transform={`translate(${innerWidth + 16},${Math.min(innerHeight - 4, Math.max(8, end.y))})`}>
                <circle r={8.5} fill={seriesStyle(end.slot).color} stroke={INK.surface} strokeWidth={2} />
                <text textAnchor="middle" dy="0.34em" fontSize={11} fontWeight={700} fill="#04070d">{end.slot}</text>
              </g>
            ))}

            {active !== null && (
              <g pointerEvents="none">
                <line x1={xs[active]} x2={xs[active]} y1={0} y2={innerHeight} stroke={INK.secondary} strokeWidth={1} strokeOpacity={0.7} />
                {series.map((s) => {
                  const v = s.data[active];
                  if (v === null || !Number.isFinite(v)) return null;
                  return <circle key={s.key} cx={xs[active]} cy={sy(v)} r={4.5} fill={seriesStyle(s.slot).color} stroke={INK.surface} strokeWidth={2} />;
                })}
              </g>
            )}
            <rect
              x={0}
              y={0}
              width={innerWidth}
              height={innerHeight}
              fill="transparent"
              onPointerMove={(event) => setActive(nearest(event.clientX, event.currentTarget))}
              onPointerDown={(event) => setActive(nearest(event.clientX, event.currentTarget))}
              onPointerLeave={(event) => {
                if (event.pointerType === "mouse") setActive(null);
              }}
            />
          </g>
        </svg>
      )}

      {active !== null && width > 0 && (
        <div
          className="pointer-events-none absolute z-10 rounded-lg border border-line-strong bg-panel px-3 py-2 text-[13px] shadow-[0_8px_24px_rgba(0,0,0,0.5)]"
          style={{
            top: MARGIN.top + 6,
            left: flip ? undefined : tipLeft + 12,
            right: flip ? width - tipLeft + 12 : undefined,
            minWidth: Math.min(190, tipRoom),
            maxWidth: Math.min(290, tipRoom),
          }}
        >
          <p className="mb-1 text-ink-3">{xLabels[active]}</p>
          {series.map((s) => {
            const style = seriesStyle(s.slot);
            const value = s.data[active];
            const model = s.model?.[active];
            return (
              <div key={s.key} className="flex flex-wrap items-baseline gap-x-2 py-0.5">
                <svg width="16" height="8" aria-hidden="true" className="flex-none translate-y-[-1px]">
                  <line x1="0" x2="16" y1="4" y2="4" stroke={style.color} strokeWidth="2.5" />
                </svg>
                <span className="num font-semibold text-ink">{value === null ? "no data" : `${num(value)} ${unitLabel(unit)}`}</span>
                <span className="min-w-0 truncate text-ink-3">{s.name}</span>
                {model !== undefined && model !== null && modelLabel && (
                  <span className="num ml-auto whitespace-nowrap pl-2 text-ink-3">{modelLabel} {num(model)}</span>
                )}
              </div>
            );
          })}
          <p className="mt-1 text-[12px] text-ink-3">{dataLabel}</p>
        </div>
      )}
      <span className="sr-only" aria-live="polite">{readout}</span>
    </div>
  );
}
