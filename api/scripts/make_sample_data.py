"""Makes FAKE sample data (NOT NASA data) so the API can be built before real data exists."""
from pathlib import Path

import numpy as np
import pandas as pd

OUT = Path(__file__).resolve().parents[1] / "data" / "dev" / "sample.csv"

# (baseline, seasonal swing, change per decade, noise, unit)
# All numbers are invented.
SPEC = {
    "central_valley": {
        "surface_temperature": (22.0, 12.0, 0.6, 0.8, "°C"),
        "precipitation": (35.0, 30.0, -2.0, 12.0, "mm/month"),
        "soil_moisture": (22.0, 6.0, -1.5, 1.2, "kg/m2"),
        "evapotranspiration": (45.0, 30.0, -1.0, 8.0, "mm/month"),
    },
    "amazon_basin": {
        "surface_temperature": (27.0, 1.5, 0.4, 0.4, "°C"),
        "precipitation": (200.0, 90.0, -6.0, 35.0, "mm/month"),
        "soil_moisture": (30.0, 3.0, -0.8, 0.9, "kg/m2"),
        "evapotranspiration": (105.0, 15.0, -2.0, 8.0, "mm/month"),
    },
    "murray_darling": {
        "surface_temperature": (21.0, 9.0, 0.3, 0.7, "°C"),
        "precipitation": (45.0, 8.0, 0.5, 20.0, "mm/month"),
        "soil_moisture": (20.0, 3.0, 0.1, 1.6, "kg/m2"),
        "evapotranspiration": (40.0, 22.0, 0.5, 8.0, "mm/month"),
    },
    "sahel": {
        "surface_temperature": (31.0, 4.0, 0.5, 0.6, "°C"),
        "precipitation": (60.0, 90.0, 3.0, 18.0, "mm/month"),
        "soil_moisture": (14.0, 5.0, 1.4, 1.1, "kg/m2"),
        "evapotranspiration": (35.0, 30.0, 1.5, 7.0, "mm/month"),
    },
}

rng = np.random.default_rng(42)  # fixed seed: same numbers every time
dates = pd.date_range("2001-01-01", "2024-12-01", freq="MS")
years = np.arange(len(dates)) / 12
season = -np.cos(2 * np.pi * (dates.month.to_numpy() - 1) / 12)

rows = []
for region, variables in SPEC.items():
    for variable, (base, swing, per_decade, noise, unit) in variables.items():
        values = base + swing * season + per_decade * years / 10 + rng.normal(0, noise, len(dates))
        if variable != "surface_temperature":
            values = np.clip(values, 0, None)
        for d, v in zip(dates, values):
            rows.append((d.strftime("%Y-%m-%d"), region, variable, round(float(v), 3), unit))

df = pd.DataFrame(rows, columns=["date", "region", "variable", "value", "unit"])
OUT.parent.mkdir(parents=True, exist_ok=True)
df.to_csv(OUT, index=False)
print(f"wrote {len(df)} rows to {OUT}")