"use client";

import { useEffect, useRef } from "react";
import "maplibre-gl/dist/maplibre-gl.css";
import type { Map as MapLibreMap } from "maplibre-gl";
import { getRegions, type ApiRegion } from "@/lib/api";

// Free demo basemap from MapLibre. Fine for a prototype; swap in your own style later.
const STYLE_URL = "https://demotiles.maplibre.org/style.json";

type View = { center: [number, number]; zoom: number };

const WORLD: View = { center: [0, 20], zoom: 1 };

// Works out where to point the map from the region's bounding box [west, south, east, north].
function viewFor(list: ApiRegion[], key: string): View | null {
  const r = list.find((x) => x.id === key || x.name === key);
  if (!r) return null;
  const [west, south, east, north] = r.bbox;
  const span = Math.max(east - west, north - south);
  const zoom = Math.min(5, Math.max(1, Math.log2(360 / span) - 0.7));
  return { center: [(west + east) / 2, (south + north) / 2], zoom };
}

export default function Globe({ region }: { region: string }) {
  const box = useRef<HTMLDivElement>(null);
  const map = useRef<MapLibreMap | null>(null);
  const regionsRef = useRef<ApiRegion[]>([]);
  const regionRef = useRef(region); // lets the map's first view use the current region
  regionRef.current = region;

  // create the map once
  useEffect(() => {
    let cancelled = false;
    Promise.all([
      import("maplibre-gl"),
      getRegions().catch(() => [] as ApiRegion[]),
    ]).then(([maplibregl, list]) => {
      if (cancelled || !box.current) return;
      regionsRef.current = list;
      const v = viewFor(list, regionRef.current) ?? WORLD;
      const m = new maplibregl.Map({
        container: box.current,
        style: STYLE_URL,
        center: v.center,
        zoom: v.zoom,
        attributionControl: { compact: true },
      });
      m.on("style.load", () => m.setProjection({ type: "globe" }));
      map.current = m;
    });
    return () => {
      cancelled = true;
      map.current?.remove();
      map.current = null;
    };
  }, []);

  // fly to the region whenever the dropdown changes
  useEffect(() => {
    const v = viewFor(regionsRef.current, region);
    if (v && map.current) map.current.flyTo({ center: v.center, zoom: v.zoom, duration: 1500 });
  }, [region]);

  return (
    <div
      ref={box}
      className="aspect-square w-[min(260px,40vw)] overflow-hidden rounded-full border-[3px] border-line"
    />
  );
}