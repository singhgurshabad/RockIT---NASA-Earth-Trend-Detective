"""Builds data/rockit/regions_display.geojson from the full-resolution regions.geojson.

Why: regions.geojson is the analysis geometry (about 17 MB, one region alone has more
than 400,000 vertices). That is far too heavy to draw in a browser. This script makes a
lightweight copy FOR DRAWING ONLY. The trend analysis never used and never uses it.

What it does (all disclosed in the output file's "rockit_display" block):
  * simplifies every outline with Douglas-Peucker (topology preserving)
  * drops polygon parts smaller than MIN_PART_KM2 (tiny islands / slivers)
  * rounds coordinates to 3 decimals (about 100 m)
  * adds a label point that is guaranteed to lie inside the region
  * records which regions overlap each other, from the full-resolution shapes

Needs shapely (dev-only dependency, not needed to run the API):
    pip install shapely
    python scripts/build_display_geometry.py
"""
import hashlib
import json
from pathlib import Path

import numpy as np
import shapely
from shapely.geometry import MultiPolygon, Polygon, mapping, shape
from shapely.validation import make_valid

BUNDLE = Path(__file__).resolve().parents[1] / "data" / "rockit"
SOURCE = BUNDLE / "regions.geojson"
OUT = BUNDLE / "regions_display.geojson"

TOLERANCE_DEG = 0.03      # about 3 km at the equator
MIN_PART_KM2 = 150.0      # parts smaller than this are not drawn
OVERLAP_MIN_SHARE = 0.01  # report an overlap when it covers at least 1% of the smaller region
KEEP_PROPERTIES = ["region_id", "name", "type"]


def equal_area(geom):
    """Lon/lat -> cylindrical equal-area kilometres (good enough for area shares)."""
    radius = 6371.0088

    def project(coords):
        return np.column_stack([radius * np.radians(coords[:, 0]), radius * np.sin(np.radians(coords[:, 1]))])

    return shapely.transform(geom, project)


def polygons_of(geom):
    if isinstance(geom, Polygon):
        return [geom]
    if isinstance(geom, MultiPolygon):
        return list(geom.geoms)
    return [g for g in getattr(geom, "geoms", []) if isinstance(g, Polygon)]


def round_coords(obj):
    if isinstance(obj, (list, tuple)):
        if obj and isinstance(obj[0], (int, float)):
            return [round(obj[0], 3), round(obj[1], 3)]
        return [round_coords(o) for o in obj]
    return obj


def main():
    raw = SOURCE.read_bytes()
    source = json.loads(raw)
    full = {}
    features = []
    for feature in source["features"]:
        props = feature["properties"]
        rid = props["region_id"]
        geom = make_valid(shape(feature["geometry"]))
        full[rid] = geom
        full_area = equal_area(geom).area

        kept = []
        for part in polygons_of(geom):
            if equal_area(part).area < MIN_PART_KM2:
                continue
            simple = part.simplify(TOLERANCE_DEG, preserve_topology=True)
            if not simple.is_empty:
                kept.extend(polygons_of(simple))
        if not kept:  # never drop a whole region
            kept = [max(polygons_of(geom), key=lambda p: p.area)]
        display = MultiPolygon(kept) if len(kept) > 1 else kept[0]

        largest = max(kept, key=lambda p: p.area)
        label = largest.representative_point()
        west, south, east, north = geom.bounds
        features.append({
            "type": "Feature",
            "properties": {
                **{k: props[k] for k in KEEP_PROPERTIES if k in props},
                "label_point": [round(label.x, 3), round(label.y, 3)],
                "bbox": [round(west, 3), round(south, 3), round(east, 3), round(north, 3)],
                "area_km2": round(full_area, 1),
                "display_area_share": round(equal_area(display).area / full_area, 4),
                "source_vertices": sum(len(p.exterior.coords) + sum(len(i.coords) for i in p.interiors) for p in polygons_of(geom)),
            },
            "geometry": {"type": mapping(display)["type"], "coordinates": round_coords(mapping(display)["coordinates"])},
        })

    overlaps = []
    ids = sorted(full)
    for i, a in enumerate(ids):
        for b in ids[i + 1:]:
            if not full[a].intersects(full[b]):
                continue
            shared = equal_area(full[a].intersection(full[b])).area
            smaller = min(equal_area(full[a]).area, equal_area(full[b]).area)
            if smaller > 0 and shared / smaller >= OVERLAP_MIN_SHARE:
                overlaps.append({"region_a": a, "region_b": b, "share_of_smaller_region": round(shared / smaller, 3)})

    out = {
        "type": "FeatureCollection",
        "rockit_display": {
            "purpose": "Simplified outlines for drawing only. The analysis used the full-resolution regions.geojson.",
            "source_file": SOURCE.name,
            "source_sha256": hashlib.sha256(raw).hexdigest(),
            "simplify_tolerance_deg": TOLERANCE_DEG,
            "min_part_km2": MIN_PART_KM2,
            "coordinate_decimals": 3,
            "overlap_min_share": OVERLAP_MIN_SHARE,
            "overlaps": overlaps,
        },
        "features": features,
    }
    OUT.write_text(json.dumps(out, separators=(",", ":")))
    print(f"wrote {OUT} ({OUT.stat().st_size / 1024:.0f} KB)")
    for f in features:
        p = f["properties"]
        n = sum(1 for _ in _points(f["geometry"]["coordinates"]))
        print(f"  {p['region_id']:<24} {p['source_vertices']:>7} -> {n:>5} vertices, drawn area share {p['display_area_share']:.3f}, bbox {p['bbox']}")
    print("overlaps:", overlaps)


def _points(coords):
    if coords and isinstance(coords[0], (int, float)):
        yield coords
    else:
        for c in coords:
            yield from _points(c)


if __name__ == "__main__":
    main()
