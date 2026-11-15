"use client";

import { linear, ticks } from "@/lib/chart";
import { num, signed } from "@/lib/format";
import { INK, seriesStyle } from "@/lib/palette";
import { useMeasure } from "@/lib/useMeasure";

export type FingerprintEntity = { key: string; slot: number; name: string; values: Record<string, number> };

/**
 * A region's "fingerprint": four standardized trends, one bar each, from a shared zero line.
 * Bars to the right mean rising, to the left falling. Units are standard deviations per decade.
 */
export default function FingerprintBars({
  features, labels, entities, description,
}: { features: string[]; labels: Record<string, string>; entities: FingerprintEntity[]; description: string }) {
  const [ref, width] = useMeasure<HTMLDivElement>();
  const peak = Math.max(0.5, ...entities.flatMap((e) => features.map((f) => Math.abs(e.values[f] ?? 0)))) * 1.08;
  const labelRoom = 46; // space kept at each end for the value printed at the bar tip
  const sx = linear([-peak, peak], [labelRoom, Math.max(labelRoom + 20, width - labelRoom)]);
  const barHeight = entities.length > 2 ? 10 : 12;
  const gap = 3;
  const stripHeight = entities.length * (barHeight + gap) + 6;
  const axisTicks = ticks(-peak, peak, width < 480 ? 4 : 6);

  return (
    <div ref={ref} role="group" aria-label={description}>
      <div className="flex flex-col gap-3.5">
        {features.map((feature) => (
          <div key={feature}>
            <p className="mb-1 text-[13.5px] text-ink-2">{labels[feature] ?? feature}</p>
            {width > 0 && (
              <svg width={width} height={stripHeight} aria-hidden="true" style={{ display: "block" }}>
                <line x1={sx(0)} x2={sx(0)} y1={0} y2={stripHeight} stroke={INK.axis} />
                {entities.map((entity, index) => {
                  const value = entity.values[feature] ?? 0;
                  const y = 3 + index * (barHeight + gap);
                  const x0 = sx(0);
                  const x1 = sx(value);
                  const left = Math.min(x0, x1);
                  const w = Math.max(1.5, Math.abs(x1 - x0));
                  const r = Math.min(4, w / 2);
                  // Rounded at the data end only; square where the bar meets the zero line.
                  const d = value >= 0
                    ? `M${left},${y} h${w - r} a${r},${r} 0 0 1 ${r},${r} v${barHeight - 2 * r} a${r},${r} 0 0 1 -${r},${r} h-${w - r} z`
                    : `M${left + w},${y} h-${w - r} a${r},${r} 0 0 0 -${r},${r} v${barHeight - 2 * r} a${r},${r} 0 0 0 ${r},${r} h${w - r} z`;
                  return (
                    <g key={entity.key}>
                      <path d={d} fill={seriesStyle(entity.slot).color} />
                      <text
                        x={value >= 0 ? x1 + 6 : x1 - 6}
                        y={y + barHeight / 2}
                        dy="0.34em"
                        textAnchor={value >= 0 ? "start" : "end"}
                        fontSize={11.5}
                        fill={INK.secondary}
                        style={{ fontVariantNumeric: "tabular-nums" }}
                      >
                        {signed(value, 2)}
                      </text>
                    </g>
                  );
                })}
              </svg>
            )}
          </div>
        ))}
      </div>
      {width > 0 && (
        <svg width={width} height={28} aria-hidden="true" style={{ display: "block", marginTop: 4 }}>
          <line x1={labelRoom} x2={width - labelRoom} y1={1} y2={1} stroke={INK.axis} />
          {axisTicks.map((tick) => (
            <g key={tick} transform={`translate(${sx(tick)},1)`}>
              <line y2={5} stroke={INK.axis} />
              <text y={18} textAnchor="middle" fontSize={12} fill={INK.muted} style={{ fontVariantNumeric: "tabular-nums" }}>{tick === 0 ? "0" : signed(tick, 1)}</text>
            </g>
          ))}
        </svg>
      )}
      <p className="text-[12.5px] text-ink-3">Standard deviations per decade. Left of zero is falling, right is rising.</p>
      <ul className="mt-2 flex flex-wrap gap-x-5 gap-y-1 text-[13px] text-ink-2">
        {entities.map((entity) => (
          <li key={entity.key} className="flex items-center gap-2">
            <span className="slot" style={{ background: seriesStyle(entity.slot).color }}>{entity.slot}</span>
            {entity.name}
          </li>
        ))}
      </ul>
      <span className="sr-only">
        {entities.map((e) => `${e.name}: ${features.map((f) => `${labels[f] ?? f} ${num(e.values[f], 2)}`).join(", ")}`).join(". ")}
      </span>
    </div>
  );
}
