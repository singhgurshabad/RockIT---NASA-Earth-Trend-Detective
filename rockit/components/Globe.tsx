"use client";

import { useEffect, useRef } from "react";
import "maplibre-gl/dist/maplibre-gl.css";
import type { Map as MapLibreMap } from "maplibre-gl";
import { REGION_VIEWS } from "@/lib/constants";

// Free demo basemap from MapLibre. Fine for a prototype; swap in your own style later.
const STYLE_URL = "https://demotiles.maplibre.org/style.json";

export default function Globe({ region }: { region: string }) {
  const box = useRef<HTMLDivElement>(null);
  const map = useRef<MapLibreMap | null>(null);
  const regionRef = useRef(region); // lets the map's first view use the current region
  regionRef.current = region;

  // create the map once
  useEffect(() => {
    let cancelled = false;
    import("maplibre-gl").then((maplibregl) => {
      if (cancelled || !box.current) return;
      const v = REGION_VIEWS[regionRef.current];
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
    const v = REGION_VIEWS[region];
    if (v && map.current) map.current.flyTo({ center: v.center, zoom: v.zoom, duration: 1500 });
  }, [region]);

  return (
    <div
      ref={box}
      className="aspect-square w-[min(260px,40vw)] overflow-hidden rounded-full border-[3px] border-line"
    />
  );
}
