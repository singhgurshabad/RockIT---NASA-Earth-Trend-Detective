"use client";

import { extent, linear, padded, tickDecimals, ticks } from "@/lib/chart";
import { num, signed, trendDecimals, unitLabel } from "@/lib/format";
import { INK, seriesStyle } from "@/lib/palette";
import { useMeasure } from "@/lib/useMeasure";

export type IntervalRow = {
  key: string;
  slot: number;
  name: string;
  /** Trend per decade and its 95% range. null when there was not enough data. */
  value: number | null;
  low: number | null;
  high: number | null;
  supported: boolean;
  note: string;
  /** Optional second estimate for reference (the full-record trend when a custom window was run). */
  reference?: { value: number; low: number; high: number; supported: boolean; label: string } | null;
};

/**
 * Trend per decade for each region with its 95% range, on one shared axis.
 * A filled dot is a supported trend; a hollow dot is inconclusive. Every number is also printed.
 */
export default function IntervalPlot({ rows, unit, description }: { rows: IntervalRow[]; unit: string; description: string }) {
  const [ref, width] = useMeasure<HTMLDivElement>();
  const all: (number | null)[] = [0];
  for (const row of rows) {
    all.push(row.value, row.low, row.high);
    if (row.reference) all.push(row.reference.low, row.reference.high);
  }
  const [lo, hi] = extent(all);
  const domain = padded(lo, hi, 0.08);
  const pad = 10;
  const sx = linear(domain, [pad, Math.max(pad + 10, width - pad)]);
  const axisTicks = ticks(domain[0], domain[1], width < 520 ? 4 : 6);
  const decimals = trendDecimals(rows.flatMap((r) => [r.value, r.low, r.high]));
  const hasReference = rows.some((r) => r.reference);
  const stripHeight = hasReference ? 40 : 26;

  return (
    <div ref={ref} role="group" aria-label={description}>
      <ul className="flex flex-col gap-3">
        {rows.map((row) => {
          const style = seriesStyle(row.slot);
          return (
            <li key={row.key}>
              <div className="flex flex-wrap items-baseline gap-x-3 gap-y-0.5">
                <span className="flex min-w-0 items-center gap-2">
                  <span className="slot" style={{ background: style.color }}>{row.slot}</span>
                  <span className="truncate text-[14.5px] font-medium">{row.name}</span>
                </span>
                <span className="num ml-auto text-[14px] text-ink">
                  {row.value === null ? (
                    <span className="text-ink-2">No trend</span>
                  ) : (
                    <>
                      <strong className="font-semibold">{signed(row.value, decimals)}</strong>{" "}
                      <span className="text-ink-2">{unitLabel(unit)} per decade</span>{" "}
                      <span className="whitespace-nowrap text-ink-3">({signed(row.low, decimals)} to {signed(row.high, decimals)})</span>
                    </>
                  )}
                </span>
              </div>
              {width > 0 && (
                <svg width={width} height={stripHeight} aria-hidden="true" style={{ display: "block", marginTop: 4 }}>
                  <line x1={pad} x2={width - pad} y1={13} y2={13} stroke={INK.grid} />
                  <line x1={sx(0)} x2={sx(0)} y1={0} y2={stripHeight} stroke={INK.axis} />
                  {row.value !== null && row.low !== null && row.high !== null && (
                    <g>
                      <line x1={sx(row.low)} x2={sx(row.high)} y1={13} y2={13} stroke={style.color} strokeWidth={2.5} strokeLinecap="round" />
                      <line x1={sx(row.low)} x2={sx(row.low)} y1={8} y2={18} stroke={style.color} strokeWidth={2} />
                      <line x1={sx(row.high)} x2={sx(row.high)} y1={8} y2={18} stroke={style.color} strokeWidth={2} />
                      <circle cx={sx(row.value)} cy={13} r={6} fill={row.supported ? style.color : INK.surface} stroke={row.supported ? INK.surface : style.color} strokeWidth={row.supported ? 2 : 2.5} />
                    </g>
                  )}
                  {row.reference && (
                    <g>
                      <line x1={sx(row.reference.low)} x2={sx(row.reference.high)} y1={31} y2={31} stroke={INK.muted} strokeWidth={1.5} />
                      <rect
                        x={sx(row.reference.value) - 4}
                        y={27}
                        width={8}
                        height={8}
                        transform={`rotate(45 ${sx(row.reference.value)} 31)`}
                        fill={row.reference.supported ? INK.muted : INK.surface}
                        stroke={INK.muted}
                        strokeWidth={1.5}
                      />
                    </g>
                  )}
                </svg>
              )}
              <p className="mt-0.5 text-[13px] text-ink-3">
                {row.note}
                {row.reference ? ` ${row.reference.label}` : ""}
              </p>
            </li>
          );
        })}
      </ul>
      {width > 0 && (
        <svg width={width} height={30} aria-hidden="true" style={{ display: "block", marginTop: 6 }}>
          <line x1={pad} x2={width - pad} y1={1} y2={1} stroke={INK.axis} />
          {axisTicks.map((tick) => (
            <g key={tick} transform={`translate(${sx(tick)},1)`}>
              <line y2={5} stroke={INK.axis} />
              <text y={19} textAnchor="middle" fontSize={12} fill={tick === 0 ? INK.secondary : INK.muted} style={{ fontVariantNumeric: "tabular-nums" }}>
                {tick === 0 ? "0" : signed(tick, tickDecimals(axisTicks))}
              </text>
            </g>
          ))}
        </svg>
      )}
      <div className="mt-1 flex flex-wrap items-center gap-x-5 gap-y-1 text-[12.5px] text-ink-3">
        <span>Axis: change in {unitLabel(unit)} per decade</span>
        <span className="flex items-center gap-1.5">
          <svg width="14" height="14" aria-hidden="true"><circle cx="7" cy="7" r="5" fill={INK.secondary} /></svg> supported
        </span>
        <span className="flex items-center gap-1.5">
          <svg width="14" height="14" aria-hidden="true"><circle cx="7" cy="7" r="4.5" fill="none" stroke={INK.secondary} strokeWidth="2" /></svg> inconclusive
        </span>
        <span className="flex items-center gap-1.5">
          <svg width="22" height="14" aria-hidden="true"><line x1="1" x2="21" y1="7" y2="7" stroke={INK.secondary} strokeWidth="2" /><line x1="1" x2="1" y1="3" y2="11" stroke={INK.secondary} strokeWidth="2" /><line x1="21" x2="21" y1="3" y2="11" stroke={INK.secondary} strokeWidth="2" /></svg> 95% range
        </span>
        {hasReference && (
          <span className="flex items-center gap-1.5">
            <svg width="14" height="14" aria-hidden="true"><rect x="3.500" y="3.500" width="7" height="7" transform="rotate(45 7 7)" fill={INK.muted} /></svg> full record, for reference
          </span>
        )}
      </div>
      <span className="sr-only">{rows.map((r) => `${r.name}: ${r.value === null ? "no trend" : `${num(r.value, decimals)} ${unitLabel(unit)} per decade, range ${num(r.low, decimals)} to ${num(r.high, decimals)}, ${r.supported ? "supported" : "inconclusive"}`}`).join(". ")}</span>
    </div>
  );
}
