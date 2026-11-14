"""Temporary trend calculation. Team ML's version will replace it."""
import pandas as pd
from scipy import stats

MIN_MONTHS = 36  # need at least three years of data


def compute_trend(dates, values, unit):
    series = pd.Series(values, index=pd.to_datetime(dates))
    total = len(series)
    series = series.dropna()
    if len(series) < MIN_MONTHS:
        raise ValueError(f"Only {len(series)} months of data in this range; at least {MIN_MONTHS} are needed.")

    # Remove the seasons: subtract each calendar month's own average.
    anomalies = series - series.groupby(series.index.month).transform("mean")

    # Fit a straight line through the anomalies.
    years = (series.index.year + (series.index.month - 1) / 12).to_numpy(dtype=float)
    fit = stats.linregress(years, anomalies.to_numpy(dtype=float))

    slope = fit.slope * 10  # per year -> per decade
    half_width = stats.t.ppf(0.975, len(series) - 2) * fit.stderr * 10

    return {
        "slope_per_decade": float(slope),
        "unit": unit,
        "p_value": float(fit.pvalue),
        "significant": bool(fit.pvalue < 0.05),
        "direction": "increasing" if slope > 0 else "decreasing" if slope < 0 else "flat",
        "confidence_interval": [float(slope - half_width), float(slope + half_width)],
        "method": "FALLBACK straight-line fit on monthly anomalies (does not account for month-to-month correlation; ML's version will replace this)",
        "n_months": len(series),
        "missing_fraction": round(1 - len(series) / total, 4),
    }