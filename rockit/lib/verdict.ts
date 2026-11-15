import { lowerFirst, prob, signed, trendDecimals, unitLabel } from "./format";
import type { ApiRegionResult, ApiTrend } from "./types";

/**
 * One plain sentence about a trend, built only from the numbers the analysis returned.
 * "Supported" is used only when the trend passed the multiple-testing check.
 */
export function verdict(trend: ApiTrend, variableLabel: string, familySize: number): string {
  if (trend.status !== "ok" || trend.slope_per_decade === null) {
    return `No trend could be estimated${trend.reason ? ` (${trend.reason})` : ""}. Nothing was filled in or guessed.`;
  }
  const q = prob(trend.q_value);
  if (trend.significant) {
    const verb = trend.slope_per_decade > 0 ? "Rising" : "Falling";
    return `${verb}. Supported after correcting for ${familySize} tests (q ${q.startsWith("<") ? q : `= ${q}`}).`;
  }
  const excludesZero = trend.ci_low !== null && trend.ci_high !== null && (trend.ci_low > 0 || trend.ci_high < 0);
  if (excludesZero) {
    return `Inconclusive. The range leaves out zero, but the trend does not pass the correction for ${familySize} tests (q = ${q}).`;
  }
  return `Inconclusive. The range includes zero (q = ${q}). That is not evidence of no change.`;
}

/** A fuller sentence for the screen-reader summary and the statistics table caption. */
export function sentence(result: ApiRegionResult, variableLabel: string, unit: string): string {
  const t = result.trend;
  if (t.status !== "ok" || t.slope_per_decade === null) return `${result.name}: no trend could be estimated.`;
  const d = trendDecimals([t.slope_per_decade, t.ci_low, t.ci_high]);
  return `${result.name}: ${lowerFirst(variableLabel)} changed by ${signed(t.slope_per_decade, d)} ${unitLabel(unit)} per decade (95% range ${signed(t.ci_low, d)} to ${signed(t.ci_high, d)}), ${t.significant ? "supported" : "inconclusive"}.`;
}
