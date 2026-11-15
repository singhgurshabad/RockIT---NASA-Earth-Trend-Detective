"""RockIT trend engine.

This is the trend calculation from analysis/RockIT_Analysis_Training_Final.ipynb
(section "1 · Trend engine"), moved here unchanged so the API can run the SAME method
for a custom date window that the reviewed full-period run used.

Method, in plain words:
  * ordinary least squares on the monthly values with an intercept, elapsed time in
    decades, and 11 calendar-month indicators (so the seasonal cycle is fitted, not
    subtracted beforehand);
  * the slope's uncertainty uses a Bartlett / Newey-West (HAC) covariance, which allows
    for month-to-month correlation in the residuals up to `hac_lags` months;
  * approximate Student-t p-value and 95% interval for the slope;
  * missing months stay missing. Nothing is interpolated.

tests/test_api.py checks that this file reproduces every trend in data/rockit/trends.json
and every window re-fit in analysis/results/robustness.csv. If you change the method in
the notebook, change it here too and re-run the tests.
"""
import numpy as np
import pandas as pd
from scipy.stats import t as student_t

METHOD = "OLS + month indicators; calendar-aware Bartlett HAC; approximate t inference"

# Fewer than this many months can never pass the checks below (see `valid.sum() < 36`).
MIN_WINDOW_MONTHS = 36


def longest_gap(mask):
    best = run = 0
    for missing in ~np.asarray(mask, dtype=bool):
        run = run + 1 if missing else 0
        best = max(best, run)
    return best


def analyze_trend(dates, values, config, unit="", start=None, end=None, lags=None):
    """Returns (summary dict, per-month DataFrame or None).

    `config` is the "config" block of the run's manifest.json (alpha, hac_lags,
    coverage thresholds, default start/end), so thresholds are never re-typed here.
    """
    periods = pd.DatetimeIndex(pd.to_datetime(dates)).to_period("M")
    if periods.has_duplicates:
        raise ValueError("Duplicate months in series")
    values = np.asarray(values, dtype=float)
    if len(values) != len(periods):
        raise ValueError("Dates and values differ in length")
    idx = pd.period_range(start or config["start"], end or config["end"], freq="M")
    s = pd.Series(values, index=periods).reindex(idx)
    valid = np.isfinite(s.to_numpy())
    counts = pd.Series(valid, index=idx).groupby(idx.month).sum()
    base = dict(
        unit=unit,
        n_observations=int(valid.sum()),
        expected_months=len(idx),
        coverage=float(valid.mean()),
        max_gap_months=longest_gap(valid),
        start=str(idx[0]),
        end=str(idx[-1]),
    )
    reasons = []
    if valid.mean() < config["min_temporal_coverage"]:
        reasons.append("temporal coverage")
    if longest_gap(valid) > config["max_gap_months"]:
        reasons.append("long missing interval")
    # Scale month-count requirement for intentionally shorter sensitivity windows.
    required = min(config["min_per_calendar_month"], max(3, len(idx) // 12 - 2))
    if len(counts) != 12 or counts.min() < required:
        reasons.append("calendar-month coverage")
    if valid.sum() < MIN_WINDOW_MONTHS:
        reasons.append("fewer than 36 observations")
    if reasons:
        return dict(base, status="insufficient_data", reason="; ".join(reasons)), None

    ordinals = np.array([p.ordinal for p in idx])
    time = (ordinals - ordinals[0]) / 120.0
    X = np.column_stack([np.ones(len(idx)), time] + [(idx.month == m).astype(float) for m in range(2, 13)])
    x, y = X[valid], s.to_numpy()[valid]
    if np.linalg.matrix_rank(x) < x.shape[1]:
        return dict(base, status="insufficient_data", reason="rank deficient design"), None
    beta = np.linalg.lstsq(x, y, rcond=None)[0]
    resid = y - x @ beta
    if np.std(resid) < 1e-12 * max(1, np.std(y)):
        return dict(base, status="degenerate", reason="zero or near-zero residual variance"), None

    scores = np.zeros_like(X)
    scores[valid] = x * resid[:, None]
    L = config["hac_lags"] if lags is None else int(lags)
    L = min(L, len(idx) - 1)
    meat = scores.T @ scores
    for lag in range(1, L + 1):
        cross = scores[lag:].T @ scores[:-lag]
        meat += (1 - lag / (L + 1)) * (cross + cross.T)
    bread = np.linalg.inv(x.T @ x)
    dof = len(y) - x.shape[1]
    cov = bread @ meat @ bread * len(y) / dof
    se = float(np.sqrt(max(0, cov[1, 1])))
    if se <= 0:
        return dict(base, status="degenerate", reason="zero trend uncertainty"), None
    p = float(2 * student_t.sf(abs(beta[1] / se), dof))
    critical = student_t.ppf(1 - config["alpha"] / 2, dof)
    ci = [float(beta[1] - critical * se), float(beta[1] + critical * se)]
    climatology = s.groupby(s.index.month).transform("mean")
    anomaly = s - climatology
    scale = float(anomaly.std(ddof=1))
    result = dict(
        base,
        status="ok",
        slope_per_decade=float(beta[1]),
        ci_low=ci[0],
        ci_high=ci[1],
        confidence_interval=ci,
        p_value=p,
        direction="increasing" if beta[1] > 0 else "decreasing",
        standardized_trend=float(beta[1] / scale) if scale > 1e-12 else None,
        fitted_period_change=float(beta[1] * (time[-1] - time[0])),
        hac_lags=L,
        method=METHOD,
    )
    details = pd.DataFrame(
        {
            "date": idx.to_timestamp(),
            "value": s.to_numpy(),
            "anomaly": anomaly.to_numpy(),
            "fitted": X @ beta,
            "residual": np.where(valid, s.to_numpy() - X @ beta, np.nan),
            "trend_component": beta[1] * (time - time.mean()),
        }
    )
    return result, details


def benjamini_hochberg(p_values, alpha):
    """Benjamini-Hochberg adjusted p-values (q-values) and reject flags.

    Same result as statsmodels `multipletests(p, alpha, method="fdr_bh")`, which the
    notebook uses; written out here so the API does not need statsmodels.
    """
    p = np.asarray(p_values, dtype=float)
    n = len(p)
    if n == 0:
        return np.array([]), np.array([], dtype=bool)
    order = np.argsort(p)
    ranked = p[order] * n / np.arange(1, n + 1)
    q_sorted = np.minimum(1.0, np.minimum.accumulate(ranked[::-1])[::-1])
    q = np.empty(n)
    q[order] = q_sorted
    return q, q <= alpha
