// Small helpers shared by the SVG charts: scales, tidy axis ticks, line paths.

export type Scale = ((value: number) => number) & { domain: [number, number]; range: [number, number] };

export function linear(domain: [number, number], range: [number, number]): Scale {
  const [d0, d1] = domain;
  const [r0, r1] = range;
  const span = d1 - d0 || 1;
  const fn = ((value: number) => r0 + ((value - d0) / span) * (r1 - r0)) as Scale;
  fn.domain = domain;
  fn.range = range;
  return fn;
}

/** Round tick values covering [min, max], about `count` of them. */
export function ticks(min: number, max: number, count = 5): number[] {
  if (!Number.isFinite(min) || !Number.isFinite(max)) return [];
  if (min === max) return [min];
  const rough = (max - min) / Math.max(1, count);
  const power = Math.pow(10, Math.floor(Math.log10(rough)));
  const candidates = [1, 2, 2.5, 5, 10].map((m) => m * power);
  const step = candidates.find((c) => c >= rough) ?? candidates[candidates.length - 1];
  const first = Math.ceil(min / step - 1e-9) * step;
  const out: number[] = [];
  for (let v = first; v <= max + step * 1e-9; v += step) out.push(Math.abs(v) < step * 1e-9 ? 0 : Number(v.toPrecision(12)));
  return out;
}

/** Extends [min, max] a little so marks do not sit on the frame, and so a flat series still has height. */
export function padded(min: number, max: number, share = 0.06): [number, number] {
  if (!Number.isFinite(min) || !Number.isFinite(max)) return [0, 1];
  if (min === max) {
    const bump = Math.abs(min) * 0.1 || 1;
    return [min - bump, max + bump];
  }
  const pad = (max - min) * share;
  return [min - pad, max + pad];
}

export function extent(values: (number | null | undefined)[]): [number, number] {
  let min = Infinity;
  let max = -Infinity;
  for (const v of values) {
    if (v === null || v === undefined || !Number.isFinite(v)) continue;
    if (v < min) min = v;
    if (v > max) max = v;
  }
  return [min, max];
}

/** SVG path for a line. A null value breaks the line, so missing months show as gaps. */
export function linePath(xs: number[], ys: (number | null)[]): string {
  let path = "";
  let pen = false;
  for (let i = 0; i < xs.length; i += 1) {
    const y = ys[i];
    if (y === null || !Number.isFinite(y)) {
      pen = false;
      continue;
    }
    path += `${pen ? "L" : "M"}${xs[i].toFixed(1)},${y.toFixed(1)}`;
    pen = true;
  }
  return path;
}

/** Decimals needed to print tick labels at this step without repeating values. */
export function tickDecimals(values: number[]): number {
  if (values.length < 2) return 1;
  const step = Math.abs(values[1] - values[0]);
  if (step >= 1) return 0;
  return Math.min(4, Math.max(1, Math.ceil(-Math.log10(step) - 1e-9)));
}

/** Year + fraction for a "YYYY-MM-DD" month, e.g. 2010-07-01 -> 2010.5 */
export function decimalYear(date: string): number {
  return Number(date.slice(0, 4)) + (Number(date.slice(5, 7)) - 1) / 12;
}
