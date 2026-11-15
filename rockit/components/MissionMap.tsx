"use client";
import { useEffect, useRef, useState } from "react";
import type { Map as LibreMap, Marker } from "maplibre-gl";
import type { ApiRegion } from "@/lib/api";
import { request } from "@/lib/api";
import "maplibre-gl/dist/maplibre-gl.css";
import AtlasFallback from "./AtlasFallback";

export default function MissionMap({ regions, region, comparison, onSelect }: { regions: ApiRegion[]; region: string; comparison?: string; onSelect: (id: string) => void }) {
 const element = useRef<HTMLDivElement>(null);
 const map = useRef<LibreMap | null>(null);
 const markers = useRef<{ marker: Marker; id: string }[]>([]);
 const choose = useRef(onSelect); choose.current = onSelect;
 const activeRegion = useRef(region); activeRegion.current = region;
 const [ready, setReady] = useState(false);
 const [failed, setFailed] = useState(false);
 const [outlineError, setOutlineError] = useState(false);
 useEffect(() => {
  let disposed = false;
  let timer: ReturnType<typeof setTimeout>;
  const abort = new AbortController();
  import("maplibre-gl").then(lib => {
   if (disposed || !element.current) return;
   try {
    const m = new lib.Map({ container: element.current, style: { version: 8, sources: { world: { type: "geojson", data: "/world.geojson", attribution: "Natural Earth · public domain" } }, layers: [{ id: "ocean", type: "background", paint: { "background-color": "#0a1421" } }, { id: "land", type: "fill", source: "world", paint: { "fill-color": "#29405c", "fill-opacity": .96 } }, { id: "coast", type: "line", source: "world", paint: { "line-color": "#748ca7", "line-width": .55, "line-opacity": .65 } }] }, center: [-119, 37], zoom: .75, minZoom: .4, maxZoom: 7, attributionControl: false, renderWorldCopies: false, canvasContextAttributes: { antialias: true } });
    map.current = m;
    m.addControl(new lib.NavigationControl({ showCompass: true }), "top-right");
    m.addControl(new lib.AttributionControl({ compact: true, customAttribution: "Region display outlines derived from project source geometry" }), "bottom-right");
    timer = setTimeout(() => { if (!disposed) setFailed(true); }, 16000);
    m.on("error", () => { if (!disposed && !m.isStyleLoaded()) setFailed(true); });
    m.on("load", () => {
     if (disposed) return;
     clearTimeout(timer); m.setProjection({ type: "globe" });
     const lines = [];
     for (let lon = -180; lon < 180; lon += 30) lines.push({ type: "Feature" as const, properties: {}, geometry: { type: "LineString" as const, coordinates: Array.from({ length: 89 }, (_, i) => [lon, -88 + i * 2]) } });
     for (let lat = -60; lat <= 60; lat += 30) lines.push({ type: "Feature" as const, properties: {}, geometry: { type: "LineString" as const, coordinates: Array.from({ length: 181 }, (_, i) => [-180 + i * 2, lat]) } });
     m.addSource("graticule", { type: "geojson", data: { type: "FeatureCollection", features: lines } });
     m.addLayer({ id: "graticule", source: "graticule", type: "line", paint: { "line-color": "#a8b8d0", "line-width": .5, "line-opacity": .15 } });
     setFailed(false); setReady(true);
     request<GeoJSON.FeatureCollection>("/api/map-geometry", undefined, abort.signal).then(geo => {
      if (disposed || !map.current) return;
      m.addSource("regions", { type: "geojson", data: geo });
      m.addLayer({ id: "region-fill", source: "regions", type: "fill", paint: { "fill-color": "#e2b095", "fill-opacity": .045 } });
      m.addLayer({ id: "region-outlines", source: "regions", type: "line", paint: { "line-color": "#b6c3d5", "line-width": .7, "line-opacity": .25 } });
      m.addLayer({ id: "selected-boundary", source: "regions", type: "line", filter: ["==", ["get", "region_id"], activeRegion.current], paint: { "line-color": "#ff986e", "line-width": 1.6, "line-opacity": .95 } });
     }).catch(() => { if (!disposed) setOutlineError(true); });
    });
   } catch (error) { console.info("WebGL unavailable; using the interactive atlas."); setFailed(true); }
  }).catch(() => setFailed(true));
  return () => { disposed = true; abort.abort(); clearTimeout(timer); markers.current.forEach(x => x.marker.remove()); markers.current = []; map.current?.remove(); map.current = null; };
 }, []);
 useEffect(() => {
  if (!ready || !map.current) return;
  let canceled = false;
  import("maplibre-gl").then(lib => {
   if (canceled || !map.current) return;
   markers.current.forEach(x => x.marker.remove());
   markers.current = regions.filter(r => r.anchor?.length === 2).map(r => {
    const b = document.createElement("button"); b.className = `region-marker ${r.id === region ? "active" : ""} ${r.id === comparison ? "comparison" : ""}`;
    b.setAttribute("aria-label", `Explore ${r.name}`); b.setAttribute("aria-pressed", String(r.id === region)); b.title = r.name;
    b.addEventListener("click", () => choose.current(r.id));
    return { id: r.id, marker: new lib.Marker({ element: b }).setLngLat([r.anchor[0], r.anchor[1]]).addTo(map.current!) };
   });
   if (map.current.getLayer("selected-boundary")) map.current.setFilter("selected-boundary", ["in", ["get", "region_id"], ["literal", [region, ...(comparison ? [comparison] : [])]]]);
   const r = regions.find(r => r.id === region);
   if (r) map.current.flyTo({ center: [r.anchor[0], r.anchor[1]], zoom: 1.05, duration: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? 0 : 1300 });
  });
  return () => { canceled = true; };
 }, [ready, regions, region, comparison]);
 return <div className="map-stage"><div className="orbital-grid" aria-hidden="true"/><div ref={element} className={`live-map ${ready ? "ready" : ""}`} aria-label="Interactive Earth map"/>{failed && !ready ? <AtlasFallback regions={regions} region={region} comparison={comparison} onSelect={onSelect}/> : !ready && <div className="map-fallback"><div className="fallback-globe"><div/><span>+</span></div><p>{failed ? "Earth view unavailable. Region controls and analysis still work." : "Opening Earth view…"}</p></div>}{outlineError && <p className="outline-note">Regional outlines unavailable · location markers shown</p>}<span className="map-cross cross-one" aria-hidden="true">+</span><span className="map-cross cross-two" aria-hidden="true">+</span></div>;
}
