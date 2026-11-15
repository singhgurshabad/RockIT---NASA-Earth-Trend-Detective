"use client";

import { useMemo, useState } from "react";
import { extent, linear, padded, ticks } from "@/lib/chart";
import { signed } from "@/lib/format";
import { CLUSTER_MARK, INK, seriesStyle } from "@/lib/palette";
import { useMeasure } from "@/lib/useMeasure";

export type ScatterPoint = {
  id: string;
  name: string;
  cluster: number;
  values: Record<string, number>;
  /** Colour slot if the region is part of the current run, otherwise 0. */
  slot: number;
  validation: boolean;
};

type Props = {
  points: ScatterPoint[];
  centers: { cluster: number; features: Record<string, number> }[];
  features: string[];
  labels: Record<string, string>;
  groupNames: Record<number, string>;
  initialX: string;
  initialY: string;
};

const MARGIN = { top: 14, right: 18, bottom: 44, left: 52 };

function Mark({ shape, x, y, size, fill, stroke, strokeWidth }: { shape: string; x: number; y: number; size: number; fill: string; stroke: string; strokeWidth: number }) {
  if (shape === "square") return <rect x={x - size} y={y - size} width={size * 2} height={size * 2} rx={1.5} fill={fill} stroke={stroke} strokeWidth={strokeWidth} />;
  if (shape === "diamond") return <rect x={x - size} y={y - size} width={size * 2} height={size * 2} transform={`rotate(45 ${x} ${y})`} fill={fill} stroke={stroke} strokeWidth={strokeWidth} />;
  if (shape === "triangle") return <path d={`M${x},${y - size * 1.2} L${x + size * 1.1},${y + size} L${x - size * 1.1},${y + size} Z`} fill={fill} stroke={stroke} strokeWidth={strokeWidth} />;
  return <circle cx={x} cy={y} r={size * 1.08} fill={fill} stroke={stroke} strokeWidth={strokeWidth} />;
}

/**
 * Every region placed by two of its four standardized trends. Marker shape shows the K-means
 * group. The model used all four trends, so groups can overlap in any two-trend view.
 */
export default function ClusterScatter({ points, centers, features, labels, groupNames, initialX, initialY }: Props) {
  const [ref, width] = useMeasure<HTMLDivElement>();
  const [fx, setFx] = useState(initialX);
  const [fy, setFy] = useState(initialY);
  const [active, setActive] = useState<string | null>(null);
  const height = width < 520 ? 300 : 360;
  const innerWidth = Math.max(10, width - MARGIN.left - MARGIN.right);
  const innerHeight = height - MARGIN.top - MARGIN.bottom;

  const { sx, sy, xTicks, yTicks } = useMemo(() => {
    const xd = padded(...extent([...points.map((p) => p.values[fx]), ...centers.map((c) => c.features[fx]), 0]), 0.1);
    const yd = padded(...extent([...points.map((p) => p.values[fy]), ...centers.map((c) => c.features[fy]), 0]), 0.1);
    return {
      sx: linear(xd, [0, innerWidth]),
      sy: linear(yd, [innerHeight, 0]),
      xTicks: ticks(xd[0], xd[1], width < 520 ? 4 : 6),
      yTicks: ticks(yd[0], yd[1], 5),
    };
  }, [points, centers, fx, fy, innerWidth, innerHeight, width]);

  const ordered = useMemo(() => [...points].sort((a, b) => a.values[fx] - b.values[fx]), [points, fx]);
  const activePoint = points.find((p) => p.id === active) ?? null;

  const onMove = (event: React.PointerEvent<SVGRectElement>) => {
    const rect = event.currentTarget.getBoundingClientRect();
    const px = event.clientX - rect.left;
    const py = event.clientY - rect.top;
    let best: string | null = null;
    let bestDistance = 34; // only points within this many pixels respond
    for (const p of points) {
      const d = Math.hypot(sx(p.values[fx]) - px, sy(p.values[fy]) - py);
      if (d < bestDistance) {
        bestDistance = d;
        best = p.id;
      }
    }
    setActive(best);
  };

  const onKey = (event: React.KeyboardEvent) => {
    if (!ordered.length) return;
    const index = ordered.findIndex((p) => p.id === active);
    let next = index;
    if (event.key === "ArrowRight" || event.key === "ArrowDown") next = Math.min(ordered.length - 1, index + 1);
    else if (event.key === "ArrowLeft" || event.key === "ArrowUp") next = Math.max(0, index < 0 ? 0 : index - 1);
    else if (event.key === "Escape") {
      setActive(null);
      return;
    } else return;
    event.preventDefault();
    setActive(ordered[Math.max(0, next)].id);
  };

  const clusters = [...new Set(points.map((p) => p.cluster))].sort();
  const tipX = activePoint ? MARGIN.left + sx(activePoint.values[fx]) : 0;
  const tipY = activePoint ? MARGIN.top + sy(activePoint.values[fy]) : 0;

  return (
    <div>
      <div className="mb-3 flex flex-wrap items-end gap-3">
        <label className="flex flex-col gap-1">
          <span className="label">Across</span>
          <select className="field !min-h-[36px] !w-auto !text-[13.5px]" value={fx} onChange={(e) => setFx(e.target.value)}>
            {features.map((f) => <option key={f} value={f}>{labels[f] ?? f}</option>)}
          </select>
        </label>
        <label className="flex flex-col gap-1">
          <span className="label">Up</span>
          <select className="field !min-h-[36px] !w-auto !text-[13.5px]" value={fy} onChange={(e) => setFy(e.target.value)}>
            {features.map((f) => <option key={f} value={f}>{labels[f] ?? f}</option>)}
          </select>
        </label>
      </div>
      <div
        ref={ref}
        className="relative w-full rounded-md"
        tabIndex={0}
        role="group"
        aria-label={`Scatter of all ${points.length} regions by ${labels[fx]} trend and ${labels[fy]} trend, marked by group. Use the arrow keys to step through regions.`}
        onKeyDown={onKey}
        onBlur={() => setActive(null)}
      >
        {width > 0 && (
          <svg width={width} height={height} style={{ display: "block" }} role="img" aria-label="Regions by standardized trend, marked by K-means group">
            <g transform={`translate(${MARGIN.left},${MARGIN.top})`}>
              {yTicks.map((tick) => (
                <g key={`y${tick}`}>
                  <line x1={0} x2={innerWidth} y1={sy(tick)} y2={sy(tick)} stroke={tick === 0 ? INK.axis : INK.grid} />
                  <text x={-10} y={sy(tick)} dy="0.32em" textAnchor="end" fontSize={12} fill={INK.muted} style={{ fontVariantNumeric: "tabular-nums" }}>{tick === 0 ? "0" : signed(tick, 1)}</text>
                </g>
              ))}
              {xTicks.map((tick) => (
                <g key={`x${tick}`}>
                  <line x1={sx(tick)} x2={sx(tick)} y1={0} y2={innerHeight} stroke={tick === 0 ? INK.axis : INK.grid} />
                  <text x={sx(tick)} y={innerHeight + 18} textAnchor="middle" fontSize={12} fill={INK.muted} style={{ fontVariantNumeric: "tabular-nums" }}>{tick === 0 ? "0" : signed(tick, 1)}</text>
                </g>
              ))}
              <text x={innerWidth / 2} y={innerHeight + 38} textAnchor="middle" fontSize={12.5} fill={INK.secondary}>{labels[fx]} trend (SD per decade)</text>
              <text transform={`translate(${-38},${innerHeight / 2}) rotate(-90)`} textAnchor="middle" fontSize={12.5} fill={INK.secondary}>{labels[fy]} trend</text>

              {centers.map((c) => {
                const x = sx(c.features[fx]);
                const y = sy(c.features[fy]);
                const mark = CLUSTER_MARK[c.cluster % CLUSTER_MARK.length];
                return (
                  <g key={`c${c.cluster}`} stroke={mark.color} strokeWidth={1.5}>
                    <line x1={x - 9} x2={x + 9} y1={y} y2={y} />
                    <line x1={x} x2={x} y1={y - 9} y2={y + 9} />
                  </g>
                );
              })}
              {points.map((p) => {
                const mark = CLUSTER_MARK[p.cluster % CLUSTER_MARK.length];
                const x = sx(p.values[fx]);
                const y = sy(p.values[fy]);
                const picked = p.slot > 0;
                return (
                  <g key={p.id}>
                    <Mark
                      shape={mark.shape}
                      x={x}
                      y={y}
                      size={picked ? 6.5 : 5}
                      fill={picked ? seriesStyle(p.slot).color : mark.color}
                      stroke={p.id === active ? INK.primary : INK.surface}
                      strokeWidth={2}
                    />
                    {picked && (
                      <text x={x} y={y} dy="0.34em" textAnchor="middle" fontSize={9.5} fontWeight={700} fill="#04070d" pointerEvents="none">{p.slot}</text>
                    )}
                  </g>
                );
              })}
              <rect x={0} y={0} width={innerWidth} height={innerHeight} fill="transparent" onPointerMove={onMove} onPointerDown={onMove} onPointerLeave={(e) => { if (e.pointerType === "mouse") setActive(null); }} />
            </g>
          </svg>
        )}
        {activePoint && (
          <div
            className="pointer-events-none absolute z-10 w-max rounded-lg border border-line-strong bg-panel px-3 py-2 text-[13px] shadow-[0_8px_24px_rgba(0,0,0,0.5)]"
            style={{
              top: Math.max(4, tipY - 12),
              left: tipX > width * 0.5 ? undefined : tipX + 14,
              right: tipX > width * 0.5 ? width - tipX + 14 : undefined,
              maxWidth: Math.min(250, Math.max(120, (tipX > width * 0.5 ? tipX : width - tipX) - 18)),
            }}
          >
            <p className="font-medium text-ink">{activePoint.name}</p>
            <p className="text-ink-3">{groupNames[activePoint.cluster]}{activePoint.validation ? " (assigned after fitting)" : ""}</p>
            <p className="num mt-1 text-ink-2">{labels[fx]}: {signed(activePoint.values[fx], 2)}</p>
            <p className="num text-ink-2">{labels[fy]}: {signed(activePoint.values[fy], 2)}</p>
          </div>
        )}
        <span className="sr-only" aria-live="polite">
          {activePoint ? `${activePoint.name}, ${groupNames[activePoint.cluster]}, ${labels[fx]} ${signed(activePoint.values[fx], 2)}, ${labels[fy]} ${signed(activePoint.values[fy], 2)}` : ""}
        </span>
      </div>
      <ul className="mt-2 flex flex-wrap gap-x-5 gap-y-1 text-[13px] text-ink-2">
        {clusters.map((c) => {
          const mark = CLUSTER_MARK[c % CLUSTER_MARK.length];
          return (
            <li key={c} className="flex items-center gap-2">
              <svg width="14" height="14" aria-hidden="true"><Mark shape={mark.shape} x={7} y={7} size={4.5} fill={mark.color} stroke="none" strokeWidth={0} /></svg>
              {groupNames[c]}
            </li>
          );
        })}
        <li className="flex items-center gap-2">
          <svg width="14" height="14" aria-hidden="true"><line x1="1" x2="13" y1="7" y2="7" stroke={INK.secondary} strokeWidth="1.5" /><line x1="7" x2="7" y1="1" y2="13" stroke={INK.secondary} strokeWidth="1.5" /></svg>
          group centre
        </li>
      </ul>
    </div>
  );
}
