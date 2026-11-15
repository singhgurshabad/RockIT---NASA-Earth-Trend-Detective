"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import "maplibre-gl/dist/maplibre-gl.css";
import type { ExpressionSpecification, GeoJSONSource, Map as MapLibreMap, Marker, StyleSpecification } from "maplibre-gl";
import { groupLabel, signed, unitLabel } from "@/lib/format";
import { DIVERGING, SERIES, divergingClass, seriesStyle } from "@/lib/palette";
import type { ApiMapTrends, ApiRegion, ApiVariable, GeoJsonCollection, SelectedRegion } from "@/lib/types";
import Icon from "./Icon";

// The basemap is two small Natural Earth files served by this app (public/basemap).
// No tile service and no access token: the globe works offline and during a live demo.
// Satellite imagery: NASA Blue Marble (shaded relief and bathymetry), served free by NASA GIBS.
// GIBS accepts the time part of the address in two forms; if the first fails we switch to the second.
// If neither loads, the Natural Earth layers underneath stay visible, so the globe never goes blank.
const IMAGERY_TILES = [
  "https://gibs.earthdata.nasa.gov/wmts/epsg3857/best/BlueMarble_ShadedRelief_Bathymetry/default/GoogleMapsCompatible_Level8/{z}/{y}/{x}.jpeg",
  "https://gibs.earthdata.nasa.gov/wmts/epsg3857/best/BlueMarble_ShadedRelief_Bathymetry/default/EPSG3857_500m/{z}/{y}/{x}.jpeg",
  "https://gibs.earthdata.nasa.gov/wmts/epsg3857/best/BlueMarble_ShadedRelief_Bathymetry/default/default/GoogleMapsCompatible_Level8/{z}/{y}/{x}.jpeg",
  "https://gibs.earthdata.nasa.gov/wmts/epsg3857/best/BlueMarble_NextGeneration/default/GoogleMapsCompatible_Level8/{z}/{y}/{x}.jpeg",
  "https://gibs.earthdata.nasa.gov/wmts/epsg3857/best/BlueMarble_NextGeneration/default/EPSG3857_500m/{z}/{y}/{x}.jpeg",
];

const ATTRIBUTION =
  'Imagery: <a href="https://earthdata.nasa.gov/gibs" target="_blank" rel="noreferrer">NASA Blue Marble via GIBS</a>. ' +
  'Basemap: <a href="https://www.naturalearthdata.com/" target="_blank" rel="noreferrer">Natural Earth</a>. ' +
  "Region outlines: HydroSHEDS HydroBASINS, RESOLVE Ecoregions 2017 (CC BY 4.0), US EPA, US Census Bureau, ICIMOD-associated HKH boundary. " +
  "Outlines are simplified for display.";

const HOME_CENTER: [number, number] = [12, 18];

/**
 * The zoom at which the whole globe just fits inside a box of this size, for a view centerd
 * at `latitude`. MapLibre draws the globe larger the further the center is from the equator
 * (to stay consistent with flat-map zoom levels), so the latitude has to be taken out again.
 */
function wholeGlobeZoom(element: HTMLElement | null, latitude: number): number {
  const side = Math.min(element?.clientWidth ?? 600, element?.clientHeight ?? 600);
  const atEquator = Math.log2((Math.PI * side * 0.86) / 512);
  return atEquator + Math.log2(Math.max(0.12, Math.cos((latitude * Math.PI) / 180)));
}

function graticule() {
  const features = [];
  for (let lon = -180; lon <= 180; lon += 30) {
    const line = [];
    for (let lat = -80; lat <= 80; lat += 4) line.push([lon, lat]);
    features.push({ type: "Feature" as const, properties: {}, geometry: { type: "LineString" as const, coordinates: line } });
  }
  for (let lat = -60; lat <= 60; lat += 30) {
    const line = [];
    for (let lon = -180; lon <= 180; lon += 4) line.push([lon, lat]);
    features.push({ type: "Feature" as const, properties: {}, geometry: { type: "LineString" as const, coordinates: line } });
  }
  return { type: "FeatureCollection" as const, features };
}

const STYLE: StyleSpecification = {
  version: 8,
  projection: { type: "globe" },
  sources: {
    land: { type: "geojson", data: "/basemap/land.geojson" },
    borders: { type: "geojson", data: "/basemap/borders.geojson" },
    graticule: { type: "geojson", data: graticule() },
    imagery: { type: "raster", tiles: [IMAGERY_TILES[0]], tileSize: 256, maxzoom: 8 },
  },
  layers: [
    { id: "ocean", type: "background", paint: { "background-color": "#0b56b8" } },
    { id: "graticule", type: "line", source: "graticule", paint: { "line-color": "#4d9bf0", "line-opacity": 0.35, "line-width": 0.6 } },
    { id: "land", type: "fill", source: "land", paint: { "fill-color": "#2fa35f", "fill-antialias": true } },
    { id: "coast", type: "line", source: "land", paint: { "line-color": "#bff0c9", "line-opacity": 0.7, "line-width": 0.7 } },
    { id: "borders", type: "line", source: "borders", paint: { "line-color": "#0f6b3c", "line-width": 0.5 } },
    {
      id: "imagery",
      type: "raster",
      source: "imagery",
      paint: { "raster-saturation": 0.45, "raster-contrast": 0.15, "raster-brightness-min": 0.04, "raster-fade-duration": 300 },
    },
    { id: "graticule-top", type: "line", source: "graticule", paint: { "line-color": "#9ec3ff", "line-opacity": 0.08, "line-width": 0.6 } },
    { id: "borders-top", type: "line", source: "borders", paint: { "line-color": "#e6eefc", "line-opacity": 0.16, "line-width": 0.5 } },
  ],
  sky: {
    "sky-color": "#0b1e44",
    "horizon-color": "#5aa9ff",
    "atmosphere-blend": ["interpolate", ["linear"], ["zoom"], 0, 1, 3, 0.85, 5, 0.3, 6, 0],
  },
};

const slotState: ExpressionSpecification = ["coalesce", ["feature-state", "slot"], 0];
const trendState: ExpressionSpecification = ["coalesce", ["feature-state", "tclass"], -1];
const slotColor: ExpressionSpecification = ["match", slotState, 1, SERIES[0].color, 2, SERIES[1].color, 3, SERIES[2].color, 4, SERIES[3].color, "#8aa0c0"];
const trendColor: ExpressionSpecification = [
  "match", trendState,
  0, DIVERGING.classes[0], 1, DIVERGING.classes[1], 2, DIVERGING.classes[2], 3, DIVERGING.classes[3],
  4, DIVERGING.classes[4], 5, DIVERGING.classes[5], 6, DIVERGING.classes[6],
  "#8aa0c0",
];

const toRad = (d: number) => (d * Math.PI) / 180;
const toDeg = (r: number) => (r * 180) / Math.PI;
const unit = ([lon, lat]: [number, number]) => [Math.cos(toRad(lat)) * Math.cos(toRad(lon)), Math.cos(toRad(lat)) * Math.sin(toRad(lon)), Math.sin(toRad(lat))];

/** The point on the globe "in the middle" of several places, and how far (in degrees) the farthest one is from it. */
function middleOf(points: [number, number][]): { center: [number, number]; spread: number } {
  const sum = [0, 0, 0];
  for (const p of points) unit(p).forEach((v, i) => (sum[i] += v));
  const length = Math.hypot(sum[0], sum[1], sum[2]) || 1;
  const mean = sum.map((v) => v / length);
  const center: [number, number] = [toDeg(Math.atan2(mean[1], mean[0])), toDeg(Math.asin(Math.max(-1, Math.min(1, mean[2]))))];
  const spread = Math.max(...points.map((p) => {
    const u = unit(p);
    return toDeg(Math.acos(Math.max(-1, Math.min(1, u[0] * mean[0] + u[1] * mean[1] + u[2] * mean[2]))));
  }));
  return { center, spread };
}

/** Points along the great circle from a to b ([lon, lat]), with longitudes kept continuous. */
function greatCircle(a: [number, number], b: [number, number], steps = 72): [number, number][] {
  const rad = (d: number) => (d * Math.PI) / 180;
  const deg = (r: number) => (r * 180) / Math.PI;
  const vec = ([lon, lat]: [number, number]) => [Math.cos(rad(lat)) * Math.cos(rad(lon)), Math.cos(rad(lat)) * Math.sin(rad(lon)), Math.sin(rad(lat))];
  const va = vec(a);
  const vb = vec(b);
  const dot = Math.min(1, Math.max(-1, va[0] * vb[0] + va[1] * vb[1] + va[2] * vb[2]));
  const omega = Math.acos(dot);
  if (omega < 1e-6) return [a, b];
  const out: [number, number][] = [];
  let previous = a[0];
  for (let i = 0; i <= steps; i += 1) {
    const t = i / steps;
    const k1 = Math.sin((1 - t) * omega) / Math.sin(omega);
    const k2 = Math.sin(t * omega) / Math.sin(omega);
    const p = [k1 * va[0] + k2 * vb[0], k1 * va[1] + k2 * vb[1], k1 * va[2] + k2 * vb[2]];
    let lon = deg(Math.atan2(p[1], p[0]));
    while (lon - previous > 180) lon -= 360;
    while (lon - previous < -180) lon += 360;
    previous = lon;
    out.push([lon, deg(Math.asin(p[2]))]);
  }
  return out;
}

type Props = {
  regions: ApiRegion[];
  variables: ApiVariable[];
  geojson: GeoJsonCollection | null;
  geojsonError: string | null;
  onRetryGeojson: () => void;
  selected: SelectedRegion[];
  canAdd: boolean;
  onToggle: (id: string) => void;
  onHover: (id: string | null) => void;
  /** "selection" or a variable id. */
  colorBy: string;
  onColorBy: (value: string) => void;
  mapTrends: ApiMapTrends | null;
  mapTrendsError: string | null;
  /** A pair of regions to connect with an arc (Earth Twins). */
  link: { a: string; b: string } | null;
  /** Bump to make the camera frame `frame` again even if it did not change. */
  frameKey: number;
  /** Region ids the camera should frame. */
  frame: string[];
};

export default function ExplorerGlobe(props: Props) {
  const { regions, variables, geojson, geojsonError, selected, canAdd, colorBy, mapTrends, link, frame, frameKey } = props;
  const box = useRef<HTMLDivElement>(null);
  const map = useRef<MapLibreMap | null>(null);
  const markers = useRef<Marker[]>([]);
  const maplibre = useRef<typeof import("maplibre-gl") | null>(null);
  const [ready, setReady] = useState(false);
  const [failed, setFailed] = useState<string | null>(null);
  const [tip, setTip] = useState<{ x: number; y: number; id: string } | null>(null);
  const hovered = useRef<string | null>(null);
  /** Set when a selection change came from a click on the globe: the camera then stays where the person put it. */
  const keepCamera = useRef(false);

  const byId = useMemo(() => new Map(regions.map((r) => [r.id, r])), [regions]);
  const trendById = useMemo(() => new Map((mapTrends?.regions ?? []).map((t) => [t.region, t])), [mapTrends]);

  // Callbacks and values the map's event handlers need, kept current without re-binding handlers.
  const live = useRef({ props, byId });
  live.current = { props, byId };

  // ---- create the map once ----------------------------------------------------
  useEffect(() => {
    let cancelled = false;
    import("maplibre-gl")
      .then((lib) => {
        if (cancelled || !box.current) return;
        maplibre.current = lib;
        let m: MapLibreMap;
        try {
          m = new lib.Map({
            container: box.current,
            style: STYLE,
            center: HOME_CENTER,
            zoom: wholeGlobeZoom(box.current, HOME_CENTER[1]),
            minZoom: -1,
            maxZoom: 6.5,
            attributionControl: false,
            cooperativeGestures: true, // the page keeps scrolling; zoom with Ctrl + scroll or two fingers
            dragRotate: false,
            pitchWithRotate: false,
            touchPitch: false,
          });
        } catch {
          setFailed("This browser could not start WebGL, so the globe is unavailable. Use the region list instead.");
          return;
        }
        m.touchZoomRotate.disableRotation();
        m.addControl(new lib.AttributionControl({ compact: true, customAttribution: ATTRIBUTION }), "bottom-right");
        // Start with the attribution folded behind its (i) button so it does not cover the globe; one press opens it.
        box.current.querySelector(".maplibregl-ctrl-attrib")?.classList.remove("maplibregl-compact-show");
        box.current.querySelector(".maplibregl-ctrl-attrib")?.removeAttribute("open");
        m.addControl(new lib.NavigationControl({ showCompass: false }), "top-right");
        m.on("load", () => {
          if (!cancelled) setReady(true);
        });
        let imageryAttempt = 0;
        let imageryErrors = 0;
        m.on("error", (event) => {
          const sourceId = (event as unknown as { sourceId?: string }).sourceId;
          if (sourceId === "imagery") {
            imageryErrors += 1;
            if (imageryErrors < 4) return; // a single missing tile is normal
            imageryErrors = 0;
            imageryAttempt += 1;
            // Swap in the next imagery address, or drop the imagery and show the drawn Earth underneath.
            window.setTimeout(() => {
              try {
                if (m.getLayer("imagery")) m.removeLayer("imagery");
                if (m.getSource("imagery")) m.removeSource("imagery");
                if (imageryAttempt < IMAGERY_TILES.length) {
                  m.addSource("imagery", { type: "raster", tiles: [IMAGERY_TILES[imageryAttempt]], tileSize: 256, maxzoom: 8 });
                  m.addLayer(
                    { id: "imagery", type: "raster", source: "imagery", paint: { "raster-saturation": 0.45, "raster-contrast": 0.15, "raster-fade-duration": 300 } },
                    "graticule-top",
                  );
                }
              } catch {
                // The map was removed while we waited. Nothing to do.
              }
            }, 0);
            return;
          }
          // A missing basemap file is not fatal: the region outlines still draw.
          console.warn("Map resource problem:", event?.error?.message ?? event);
        });
        map.current = m;
      })
      .catch(() => setFailed("The map library could not be loaded. Use the region list instead."));
    return () => {
      cancelled = true;
      markers.current.forEach((marker) => marker.remove());
      markers.current = [];
      map.current?.remove();
      map.current = null;
    };
  }, []);

  // ---- add the region outlines when both the map and the data are there --------
  useEffect(() => {
    const m = map.current;
    if (!m || !ready || !geojson || m.getSource("regions")) return;
    // Largest first, so small regions inside big ones (Central Valley in California) stay on top.
    const sorted = {
      ...geojson,
      features: [...geojson.features].sort((a, b) => Number(b.properties.area_km2 ?? 0) - Number(a.properties.area_km2 ?? 0)),
    };
    m.addSource("regions", { type: "geojson", data: sorted as unknown as GeoJSON.FeatureCollection, promoteId: "region_id" });
    m.addSource("link", { type: "geojson", data: { type: "FeatureCollection", features: [] } });
    m.addLayer({
      id: "regions-fill",
      type: "fill",
      source: "regions",
      paint: {
        "fill-color": ["case", [">", slotState, 0], slotColor, [">=", trendState, 0], trendColor, "#ffffff"],
        "fill-opacity": [
          "case",
          [">", slotState, 0], 0.6,
          ["boolean", ["feature-state", "tfill"], false], 0.72,
          ["boolean", ["feature-state", "hover"], false], 0.3,
          0.08,
        ],
      },
    });
    m.addLayer({
      id: "regions-line",
      type: "line",
      source: "regions",
      layout: { "line-join": "round" },
      paint: {
        "line-color": [
          "case",
          [">", slotState, 0], slotColor,
          ["boolean", ["feature-state", "picked"], false], "#f2f6fb",
          [">=", trendState, 0], trendColor,
          ["boolean", ["feature-state", "hover"], false], "#ffffff",
          "#ffffff",
        ],
        "line-width": ["case", ["boolean", ["feature-state", "picked"], false], 2.4, ["boolean", ["feature-state", "hover"], false], 2.2, 1.5],
        "line-opacity": ["case", [">", slotState, 0], 1, ["boolean", ["feature-state", "picked"], false], 1, 0.95],
      },
    });
    m.addLayer({
      id: "link-line",
      type: "line",
      source: "link",
      layout: { "line-cap": "round" },
      paint: { "line-color": "#6cc7e6", "line-width": 1.6, "line-dasharray": [1.5, 2] },
    });

    const pick = (point: { x: number; y: number }) => {
      const hits = m.queryRenderedFeatures([point.x, point.y], { layers: ["regions-fill"] });
      if (!hits.length) return null;
      hits.sort((a, b) => Number(a.properties?.area_km2 ?? 0) - Number(b.properties?.area_km2 ?? 0));
      return String(hits[0].properties?.region_id ?? hits[0].id);
    };
    const setHover = (id: string | null) => {
      if (hovered.current === id) return;
      if (hovered.current) m.setFeatureState({ source: "regions", id: hovered.current }, { hover: false });
      if (id) m.setFeatureState({ source: "regions", id }, { hover: true });
      hovered.current = id;
      live.current.props.onHover(id);
    };
    m.on("mousemove", (event) => {
      const id = pick(event.point);
      setHover(id);
      m.getCanvas().style.cursor = id ? "pointer" : "";
      setTip(id ? { x: event.point.x, y: event.point.y, id } : null);
    });
    m.on("mouseout", () => {
      setHover(null);
      setTip(null);
    });
    m.on("click", (event) => {
      const id = pick(event.point);
      if (id) {
        keepCamera.current = true;
        live.current.props.onToggle(id);
      }
    });
  }, [ready, geojson]);

  // ---- paint selection and trend colors ----------------------------------------
  useEffect(() => {
    const m = map.current;
    if (!m || !ready || !geojson || !m.getSource("regions")) return;
    const trendMode = colorBy !== "selection" && mapTrends?.variable === colorBy;
    for (const region of regions) {
      const pickedSlot = selected.find((s) => s.id === region.id)?.slot ?? 0;
      const trend = trendById.get(region.id);
      m.setFeatureState(
        { source: "regions", id: region.id },
        {
          slot: trendMode ? 0 : pickedSlot,
          picked: pickedSlot > 0,
          tclass: trendMode && trend ? divergingClass(trend.standardized_trend) : -1,
          tfill: Boolean(trendMode && trend?.significant),
        },
      );
    }
  }, [ready, geojson, regions, selected, colorBy, mapTrends, trendById]);

  // ---- numbered labels on the selected regions -----------------------------------
  useEffect(() => {
    const m = map.current;
    const lib = maplibre.current;
    if (!m || !lib || !ready) return;
    markers.current.forEach((marker) => marker.remove());
    markers.current = [];
    for (const item of selected) {
      const region = byId.get(item.id);
      if (!region?.label_point) continue;
      const element = document.createElement("div");
      element.className = "region-tag";
      const badge = document.createElement("span");
      badge.className = "slot";
      badge.style.background = seriesStyle(item.slot).color;
      badge.textContent = String(item.slot);
      const text = document.createElement("span");
      text.textContent = region.name;
      element.append(badge, text);
      markers.current.push(new lib.Marker({ element, anchor: "left", offset: [-12, 0] }).setLngLat(region.label_point).addTo(m));
    }
    // The two ends of an Earth Twins line get a plain name tag if they are not already labelled.
    for (const id of link ? [link.a, link.b] : []) {
      const region = byId.get(id);
      if (!region?.label_point || selected.some((s) => s.id === id)) continue;
      const element = document.createElement("div");
      element.className = "region-tag";
      element.style.paddingLeft = "9px";
      element.textContent = region.name;
      markers.current.push(new lib.Marker({ element, anchor: "left", offset: [6, 0] }).setLngLat(region.label_point).addTo(m));
    }
  }, [ready, selected, byId, link]);

  // ---- the Earth Twins arc ---------------------------------------------------------
  useEffect(() => {
    const m = map.current;
    if (!m || !ready) return;
    const source = m.getSource("link") as GeoJSONSource | undefined;
    if (!source) return;
    const a = link ? byId.get(link.a)?.label_point : null;
    const b = link ? byId.get(link.b)?.label_point : null;
    source.setData(
      a && b
        ? { type: "FeatureCollection", features: [{ type: "Feature", properties: {}, geometry: { type: "LineString", coordinates: greatCircle(a, b) } }] }
        : { type: "FeatureCollection", features: [] },
    );
  }, [ready, geojson, link, byId]);

  // ---- camera: frame the regions asked for ---------------------------------------
  const frameSignature = frame.join("|");
  useEffect(() => {
    const m = map.current;
    if (!m || !ready) return;
    const boxes = frame.map((id) => byId.get(id)?.bbox).filter((b): b is [number, number, number, number] => Boolean(b));
    if (keepCamera.current) {
      keepCamera.current = false;
      return;
    }
    if (!boxes.length) return; // nothing selected: leave the view alone
    // Several regions: turn the globe to the point between them. Far apart, show the whole Earth;
    // close together, come in by up to a little over one zoom level.
    const points = frame.map((id) => byId.get(id)?.label_point).filter((p): p is [number, number] => Boolean(p));
    if (points.length > 1) {
      const { center, spread } = middleOf(points);
      const closer = Math.min(0.5, Math.max(0, Math.log2(35 / Math.max(spread, 8))));
      m.easeTo({ center, zoom: wholeGlobeZoom(box.current, center[1]) + closer, duration: 1300 });
      return;
    }
    const west = Math.min(...boxes.map((b) => b[0]));
    const south = Math.min(...boxes.map((b) => b[1]));
    const east = Math.max(...boxes.map((b) => b[2]));
    const north = Math.max(...boxes.map((b) => b[3]));
    // Turn the globe to face the regions, but stay far enough out that it still reads as a globe:
    // between "whole Earth in view" and a little over one zoom level closer.
    const camera = m.cameraForBounds([[west, south], [east, north]], { padding: 40 });
    const fallback: [number, number] = [(west + east) / 2, (south + north) / 2];
    const center = camera?.center ?? fallback;
    const whole = wholeGlobeZoom(box.current, (south + north) / 2);
    const wanted = (typeof camera?.zoom === "number" ? camera.zoom : whole) - 0.9;
    // Stay far enough out that the whole planet, and the stars around it, stay in view.
    m.easeTo({ center, zoom: Math.min(whole + 0.45, Math.max(whole, wanted)), duration: 1300 });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready, frameSignature, frameKey, byId]);

  const tipRegion = tip ? byId.get(tip.id) : null;
  const tipTrend = tip ? trendById.get(tip.id) : null;
  const tipSelected = tip ? selected.some((s) => s.id === tip.id) : false;
  const trendVariable = variables.find((v) => v.id === colorBy);
  const trendMode = colorBy !== "selection";

  return (
    <div className="globe-space absolute inset-0 overflow-hidden">
      {/* MapLibre's own stylesheet makes this element position: relative, so it is sized with height and width, not inset. */}
      <div ref={box} className="relative z-[1] h-full w-full" role="application" aria-label="Globe of the 21 study regions. Click a region outline to add or remove it. The region list beside the globe does the same thing." />

      {!ready && !failed && (
        <div className="absolute inset-0 grid place-items-center text-ink-3">
          <span className="flex items-center gap-2.5 text-[14px]"><span className="spinner" /> Loading the globe</span>
        </div>
      )}
      {failed && (
        <div className="absolute inset-0 grid place-items-center p-6">
          <p className="note note-error max-w-sm" role="alert">{failed}</p>
        </div>
      )}
      {ready && geojsonError && (
        <div className="absolute inset-x-4 top-16 z-10 mx-auto max-w-md">
          <div className="note note-error flex items-start gap-3" role="alert">
            <Icon name="alert" className="mt-0.5 flex-none" />
            <div>
              <p className="text-ink">Region outlines could not be loaded.</p>
              <p className="mt-1">{geojsonError} You can still choose regions from the list.</p>
              <button className="btn mt-3" onClick={props.onRetryGeojson}><Icon name="retry" size={16} /> Try again</button>
            </div>
          </div>
        </div>
      )}

      {/* color mode */}
      <div className="absolute left-3 top-3 z-10 flex max-w-[calc(100%-64px)] flex-wrap items-center gap-2 sm:left-4 sm:top-4">
        <label htmlFor="color-by" className="sr-only">Color regions by</label>
        <select
          id="color-by"
          className="field !min-h-[36px] !w-auto !bg-[rgba(11,21,36,0.92)] !text-[13.5px]"
          value={colorBy}
          onChange={(event) => props.onColorBy(event.target.value)}
        >
          <option value="selection">Color: my selection</option>
          {variables.map((v) => (
            <option key={v.id} value={v.id}>Color: {v.label.toLowerCase()} trend</option>
          ))}
        </select>
        <button
          className="btn !min-h-[36px] !bg-[rgba(11,21,36,0.92)] !px-2.5"
          onClick={() => map.current?.easeTo({ center: HOME_CENTER, zoom: wholeGlobeZoom(box.current, HOME_CENTER[1]), duration: 900 })}
          aria-label="Reset the globe to the whole-Earth view"
          title="Whole-Earth view"
        >
          <Icon name="globe" size={17} />
        </button>
      </div>

      {/* legend */}
      <div className={`pointer-events-none absolute bottom-3 left-3 z-10 max-w-[min(360px,calc(100%-64px))] rounded-lg border border-line bg-[rgba(7,13,24,0.9)] px-3 py-2.5 text-[12.5px] text-ink-2 sm:bottom-4 sm:left-4 ${trendMode ? "" : "hidden sm:block"}`}>
        {!trendMode && (
          <p>
            {selected.length === 0 ? "Click a region outline to select it." : canAdd ? "Click another outline to compare, or a selected one to remove it." : "Four regions selected. Remove one to add another."}
          </p>
        )}
        {trendMode && props.mapTrendsError && <p className="text-ink">Trend colors could not be loaded. {props.mapTrendsError}</p>}
        {trendMode && !props.mapTrendsError && !mapTrends && <p>Loading trend colors</p>}
        {trendMode && mapTrends && trendVariable && (
          <>
            <p className="text-ink">{trendVariable.label} trend, {mapTrends.scope?.start.slice(0, 4)} to {mapTrends.scope?.end.slice(0, 4)}</p>
            <div className="mt-2 flex items-center gap-1.5" aria-hidden="true">
              <span>falling</span>
              <span className="flex">
                {DIVERGING.classes.map((color) => (
                  <span key={color} className="h-2.5 w-6 first:rounded-l-sm last:rounded-r-sm" style={{ background: color, marginRight: 2 }} />
                ))}
              </span>
              <span>rising</span>
            </div>
            <p className="mt-2">
              Filled: supported trend. Outline only: inconclusive. Shade is the trend relative to the region&apos;s own month-to-month variability. Full record only; it does not follow your date window.
            </p>
          </>
        )}
      </div>

      {/* hover card */}
      {tip && tipRegion && (
        <div
          className="pointer-events-none absolute z-20 w-max max-w-[260px] rounded-lg border border-line-strong bg-panel px-3 py-2 text-[13px] shadow-[0_8px_24px_rgba(0,0,0,0.5)]"
          style={{ left: Math.min(tip.x + 14, (box.current?.clientWidth ?? 600) - 270), top: Math.max(8, tip.y - 12) }}
        >
          <p className="font-medium text-ink">{tipRegion.name}</p>
          <p className="text-ink-3">{groupLabel(tipRegion.group)}</p>
          {trendMode && tipTrend && mapTrends && (
            <p className="num mt-1 text-ink-2">
              {signed(tipTrend.slope_per_decade)} {unitLabel(mapTrends.unit)} per decade,{" "}
              {tipTrend.significant ? "supported" : "inconclusive"}
              {tipTrend.under_review ? " (under review)" : ""}
            </p>
          )}
          <p className="mt-1 text-ink-3">{tipSelected ? "Click to remove" : canAdd ? "Click to select" : "Selection is full"}</p>
        </div>
      )}
    </div>
  );
}
