"use client";

import { useEffect, useRef } from "react";
import "maplibre-gl/dist/maplibre-gl.css";
import type { GeoJSONSource, Map as MapLibreMap } from "maplibre-gl";
import { REGION_VIEWS } from "@/lib/constants";

// Free demo basemap from MapLibre. Fine for a prototype; swap in your own style later.
const STYLE_URL = "https://demotiles.maplibre.org/style.json";

// Globe colors: edit these to restyle it.
const COLORS = {
  space: "#050b14",     // behind the globe
  ocean: "#0b1d33",
  land: "#24415f",
  border: "#5b82ad",    // country borders and coastlines
  highlight: "#ffb84d", // the selected region
};

// Turns a bounds box into a polygon the map can draw. Later you can swap in real region outlines (GeoJSON).
function regionShape(region: string) {
  const [w, s, e, n] = REGION_VIEWS[region].bounds;
  return {
    type: "Feature" as const,
    properties: {},
    geometry: { type: "Polygon" as const, coordinates: [[[w, s], [e, s], [e, n], [w, n], [w, s]]] },
  };
}

export default function Globe({ region }: { region: string }) {
  const box = useRef<HTMLDivElement>(null);
  const map = useRef<MapLibreMap | null>(null);
  const ready = useRef(false);
  const regionRef = useRef(region); // lets the first setup use the current region
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

      m.on("style.load", () => {
        m.setProjection({ type: "globe" });

        // recolor the demo basemap (each line is skipped if that layer doesn't exist)
        const paint = (id: string, prop: string, color: string) => {
          if (m.getLayer(id)) m.setPaintProperty(id, prop, color);
        };
        paint("background", "background-color", COLORS.ocean);
        paint("countries-fill", "fill-color", COLORS.land);
        paint("countries-boundary", "line-color", COLORS.border);
        paint("coastline", "line-color", COLORS.border);

        // the highlighted region
        m.addSource("region", { type: "geojson", data: regionShape(regionRef.current) });
        m.addLayer({
          id: "region-fill", type: "fill", source: "region",
          paint: { "fill-color": COLORS.highlight, "fill-opacity": 0.3 },
        });
        m.addLayer({
          id: "region-outline", type: "line", source: "region",
          paint: { "line-color": COLORS.highlight, "line-width": 2 },
        });
        ready.current = true;
      });
      map.current = m;
    });
    return () => {
      cancelled = true;
      ready.current = false;
      map.current?.remove();
      map.current = null;
    };
  }, []);

  // when the dropdown changes: move the highlight and fly there
  useEffect(() => {
    const m = map.current;
    const v = REGION_VIEWS[region];
    if (!m || !v) return;
    if (ready.current) m.getSource<GeoJSONSource>("region")?.setData(regionShape(region));
    m.flyTo({ center: v.center, zoom: v.zoom, duration: 1500 });
  }, [region]);

  return (
    <div
      ref={box}
      style={{ background: COLORS.space }}
      className="aspect-square w-[min(260px,40vw)] overflow-hidden rounded-full border-[3px] border-line"
    />
  );
}
