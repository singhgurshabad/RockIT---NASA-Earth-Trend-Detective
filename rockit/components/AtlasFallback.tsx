"use client";
import { useEffect, useState } from "react";
import type { ApiRegion } from "@/lib/api";
type Geometry = { type: string; coordinates: number[][][] | number[][][][] };
type World = { type: string; features: { geometry: Geometry; properties: { name?: string } }[] };
export default function AtlasFallback({ regions, region, comparison, onSelect }: { regions: ApiRegion[]; region: string; comparison?: string; onSelect: (id: string) => void }) {
 const [world, setWorld] = useState<World | null>(null);
 useEffect(() => { let disposed = false; fetch("/world.geojson").then(r => r.json()).then(w => { if (!disposed) setWorld(w); }).catch(() => {}); return () => { disposed = true; }; }, []);
 const project = (p: number[]) => [(p[0] + 180) * 2.5 + 25, (90 - p[1]) * 2.5 + 25];
 const polygon = (rings: number[][][]) => rings.map(r => r.map((p, i) => `${i ? "L" : "M"}${project(p).join(",")}`).join(" ") + "Z").join(" ");
 return <div className="atlas-fallback"><p className="atlas-mode">Atlas view</p><svg viewBox="0 0 950 500" aria-label="World atlas with selectable study regions" role="group">
  {[-60,-30,0,30,60].map(lat => <line key={`lat${lat}`} x1="25" x2="925" y1={project([0,lat])[1]} y2={project([0,lat])[1]} stroke="#49656a" strokeOpacity=".25" strokeWidth=".5"/>)}
  {[-120,-60,0,60,120].map(lon => <line key={lon} y1="25" y2="475" x1={project([lon,0])[0]} x2={project([lon,0])[0]} stroke="#49656a" strokeOpacity=".25" strokeWidth=".5"/>)}
  {world?.features.map((f, i) => <path key={i} d={f.geometry.type === "Polygon" ? polygon(f.geometry.coordinates as number[][][]) : (f.geometry.coordinates as number[][][][]).map(polygon).join(" ")} fill="#29405c" stroke="#697e9b" strokeWidth=".5"/>)}
  {regions.map(r => { const [x,y] = project(r.anchor); const selected = r.id === region, compared = r.id === comparison; return <g key={r.id}><circle cx={x} cy={y} r={selected || compared ? 10 : 5} fill={selected ? "#ff875d" : compared ? "#e3ae72" : "#7b9cc5"} fillOpacity={selected || compared ? .25 : .6}/><circle role="button" tabIndex={0} aria-label={`Explore ${r.name} on atlas`} aria-pressed={selected} cx={x} cy={y} r={selected || compared ? 5 : 3} fill={selected ? "#ffb28c" : compared ? "#e3ae72" : "#adc8ed"} onClick={() => onSelect(r.id)} onKeyDown={e => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); onSelect(r.id); } }}><title>{r.name}</title></circle>{selected && <text x={x > 650 ? x - 15 : x + 15} y={y - 13} fill="#dce8fa" fontSize="12" textAnchor={x > 650 ? "end" : "start"}>{r.name}</text>}</g>; })}
 </svg><p className="atlas-note">Select a study region on the map.</p></div>;
}
