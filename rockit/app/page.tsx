"use client";
import { useEffect, useRef, useState } from "react";
import MissionMap from "@/components/MissionMap";
import MissionResults from "@/components/MissionResults";
import Icon from "@/components/Icon";
import Reveal from "@/components/Reveal";
import { getRegions, getVariables, getMission, type ApiRegion, type ApiVariable, type Mission, type Selection, formatUnit } from "@/lib/api";
import { bundledRegions, bundledVariables } from "@/lib/catalog";
const initial: Selection = { regions: ["california"], variables: ["surface_temperature", "precipitation"], start: "2001-01", end: "2024-12" };
const colors = ["#96d4d5", "#91afd1", "#bac797", "#d8b68d"];
export default function Home() {
 const [regions, setRegions] = useState<ApiRegion[]>(bundledRegions);
 const [variables, setVariables] = useState<ApiVariable[]>(bundledVariables);
 const [selection, setSelection] = useState<Selection>(initial);
 const [connection, setConnection] = useState<"checking" | "online" | "offline">("checking");
 const [busy, setBusy] = useState(false);
 const [error, setError] = useState("");
 const [archiveNote, setArchiveNote] = useState("");
 const [saved, setSaved] = useState<Mission[]>([]);
 const [active, setActive] = useState<Mission | null>(null);
 const [tab, setTab] = useState("explorer");
 const [phase, setPhase] = useState("");
 const controller = useRef<AbortController | null>(null);
 const inFlight = useRef(false);
 const current = regions.find(r => r.id === selection.regions[0]) ?? regions[0];
 const validDate = (d: string) => /^\d{4}-(0[1-9]|1[0-2])$/.test(d);
 const invalid = !validDate(selection.start) || !validDate(selection.end) || selection.start > selection.end || selection.start < "2001-01" || selection.end > "2024-12" || !selection.variables.length;
 const stale = active && JSON.stringify(active.selection) !== JSON.stringify(selection);
 const patch = (p: Partial<Selection>) => setSelection(s => ({ ...s, ...p }));
 const name = (r: string) => regions.find(x => x.id === r)?.name ?? r;

 async function connect() {
  setConnection("checking");
  try {
   const [r, v] = await Promise.all([getRegions(), getVariables()]);
   if (!r.length || !v.length) throw new Error("Empty data catalog");
   setRegions(r); setVariables(v); setConnection("online");
  } catch { setConnection("offline"); }
 }
 useEffect(() => {
  void connect();
  try { const runs = JSON.parse(localStorage.getItem("rockit-missions-v2") || "[]"); if (Array.isArray(runs)) setSaved(runs.filter((r: Mission) => r?.id && r.selection?.regions?.length && r.results?.length && r.ml?.regions?.length && r.provenance?.run_id).slice(0, 8)); } catch { /* History is optional. */ }
  return () => controller.current?.abort();
 }, []);
 function saveRuns(runs: Mission[]) {
  setSaved(runs);
  try { localStorage.setItem("rockit-missions-v2", JSON.stringify(runs)); setArchiveNote(""); }
  catch { setArchiveNote("Browser storage is full or unavailable. These missions are kept for this session; download JSON to keep a copy."); }
 }
 async function run(explicit?: Selection) {
  if (inFlight.current || (!explicit && invalid)) return;
  inFlight.current = true; setBusy(true); setError(""); setPhase("Retrieving series, trend evidence, and trained fingerprints…");
  const c = new AbortController(); controller.current = c;
  const timeout = setTimeout(() => c.abort("timeout"), 60000);
  const snapshot = structuredClone(explicit ?? selection);
  try {
   const mission = await getMission(snapshot, c.signal);
   if (c.signal.aborted) return;
   if (!mission.results?.length || !mission.ml?.regions?.length) throw new Error("The backend response is incomplete. Run the API included with this project.");
   if (JSON.stringify(mission.selection) !== JSON.stringify(snapshot)) throw new Error("The returned selection did not match this mission. Please retry.");
   mission.name = `${name(snapshot.regions[0])}${snapshot.regions.length > 1 ? " comparison" : " exploration"}`;
   setActive(mission); saveRuns([mission, ...saved].slice(0, 8)); setConnection("online");
   setPhase("Analysis complete. Time series, trend evidence and regional similarity are ready.");
   setTimeout(() => document.getElementById("results")?.scrollIntoView({ behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "instant" : "smooth", block: "start" }), 100);
  } catch (e) {
   if (c.signal.aborted && c.signal.reason !== "timeout") { setPhase("Analysis canceled. Your previous results are unchanged."); }
   else { setError(c.signal.aborted ? "The mission timed out. Check the analysis server and retry." : e instanceof Error ? e.message : "The analysis could not complete."); setPhase("Analysis could not complete. Your previous results are unchanged."); }
  } finally { clearTimeout(timeout); inFlight.current = false; setBusy(false); }
 }
 function compare(id: string) {
  const base = active?.selection ?? selection;
  const next = { ...base, regions: [base.regions[0], id] };
  setSelection(next); setTab("explorer"); void run(next);
 }
 return <div className="mission-app">
  <a className="skip-link" href="#explorer">Skip to explorer</a>
  <header className="site-header"><a className="brand" href="#top" aria-label="RockIT home">RockIT</a><nav aria-label="Main navigation"><button className={tab === "explorer" ? "nav-active" : ""} onClick={() => setTab("explorer")}>Explorer</button><button className={tab === "history" ? "nav-active" : ""} onClick={() => setTab("history")}>Saved analyses <span className="count">{saved.length}</span></button><a href="#methods">Methods</a></nav><button className="connection" onClick={connect} title="Check API connection"><i className={connection}/>{connection === "online" ? "Data connected" : connection === "checking" ? "Connecting…" : "Reconnect API"}</button></header>
  <main id="top">
   <section className="intro"><div><p className="eyebrow">NASA SPACE APPS CHALLENGE</p><h1>Earth trend explorer</h1><p className="intro-copy">Explore land-surface change across 21 regions, from 2001 to 2024.</p></div><div className="intro-index"><span>2001 — 2024</span><p>24 YEARS OF LAND-SURFACE DATA<br/>NASA GLDAS / NOAH v2.1</p></div></section>
   {tab === "explorer" ? <>
    <section id="explorer" className="workspace" aria-label="Earth trend explorer">
     <aside className="controls"><div className="panel-heading"><span className="eyebrow">Analysis settings</span><Icon name="layers" size={16}/></div>
      <div className="control-section"><label className="step" htmlFor="region">Region</label><select id="region" value={selection.regions[0]} disabled={busy} onChange={e => patch({ regions: [e.target.value, ...selection.regions.slice(1).filter(r => r !== e.target.value)] })}>{regions.map(r => <option value={r.id} key={r.id}>{r.name}</option>)}</select><p className="field-note">{current.group.replaceAll("_", " ")} · {Math.abs(current.anchor[1]).toFixed(1)}° {current.anchor[1] < 0 ? "S" : "N"}, {Math.abs(current.anchor[0]).toFixed(1)}° {current.anchor[0] < 0 ? "W" : "E"}</p><label htmlFor="comparison" className="comparison-label">Compare with <span>optional</span></label><select id="comparison" disabled={busy} value={selection.regions[1] ?? ""} onChange={e => patch({ regions: e.target.value ? [selection.regions[0], e.target.value] : [selection.regions[0]] })}><option value="">One region for now</option>{regions.filter(r => r.id !== selection.regions[0]).map(r => <option key={r.id} value={r.id}>{r.name}</option>)}</select></div>
      <div className="control-section"><div className="step">Time range</div><div className="date-fields"><label>FROM<input aria-label="Start month" type="month" min="2001-01" max="2024-12" value={selection.start} disabled={busy} onInput={e => patch({ start: e.currentTarget.value })} onChange={e => patch({ start: e.target.value })}/></label><label>TO<input aria-label="End month" type="month" min="2001-01" max="2024-12" value={selection.end} disabled={busy} onInput={e => patch({ end: e.currentTarget.value })} onChange={e => patch({ end: e.target.value })}/></label></div><div className="date-presets">{["2001", "2010", "2020"].map(y => <button type="button" disabled={busy} key={y} onClick={() => patch({ start: `${y}-01`, end: "2024-12" })}>{y === "2001" ? "Full record" : `Since ${y}`}</button>)}</div></div>
      <fieldset className="control-section"><legend className="step">Variables</legend><div className="variable-options">{variables.map((v, i) => <label key={v.id} className={`variable-option ${selection.variables.includes(v.id) ? "selected" : ""}`} title={v.description}><Icon name={v.icon} style={{ color: colors[i] }}/><span>{v.label}<small>{formatUnit(v.unit)}</small></span><input disabled={busy} type="checkbox" checked={selection.variables.includes(v.id)} onChange={() => patch({ variables: selection.variables.includes(v.id) ? selection.variables.filter(id => id !== v.id) : [...selection.variables, v.id] })}/></label>)}</div></fieldset>
      <div className="run-controls"><button className="primary-button" disabled={invalid || busy} onClick={() => run()}>{busy ? <><span className="spinner"/> Analyzing</> : <>Run analysis <Icon name="arrow" size={17}/></>}</button>{busy && <button className="cancel-button" onClick={() => controller.current?.abort()}>Cancel request</button>}<p>{invalid ? "Select a signal and valid dates within 2001–2024." : "Time series, trend estimates and regional similarity"}</p></div>
     </aside>
     <div className="map-panel"><div className="map-top"><span className="eyebrow">Study regions</span><span className="map-mode">NASA GLDAS · 0.25°</span></div><MissionMap regions={regions} region={selection.regions[0]} comparison={selection.regions[1]} onSelect={r => { if (!busy) patch({ regions: [r, ...selection.regions.slice(1).filter(x => x !== r)] }); }}/><div className="map-caption"><div><p className="eyebrow">Selected region</p><h2>{current.name}</h2><p>{selection.regions[1] ? `Comparing with ${name(selection.regions[1])}` : current.group.replaceAll("_", " ")}</p></div><span className="map-instruction">Drag to rotate · scroll to zoom</span></div></div>
    </section>
    <p className="run-status" role="status" aria-live="polite">{phase}</p>
    {connection === "offline" && <div className="notice">The analysis server is not connected. Start the complete app with <code>python3 start.py</code>, then <button onClick={connect}>check connection</button>. The map and region controls remain available.</div>}
    {error && <div className="error" role="alert">{error} <button disabled={busy || invalid} onClick={() => run()}>Retry mission</button></div>}
    <section className="results-section" id="results"><div className="section-title"><div><p className="eyebrow">Results</p><h2>{active ? "Analysis results" : "Ready to explore"}</h2></div><span className="subtle">{active ? active.selection.regions.map(name).join(" / ") : "NASA GLDAS NOAH v2.1"}</span></div>{stale && <p className="notice">You changed the controls. These results still describe the completed mission below. Run again to apply your new selection.</p>}{active ? <Reveal key={active.id}><MissionResults mission={active} regions={regions} variables={variables} onCompare={compare}/></Reveal> : <div className="empty-results"><Icon name="globe" size={36}/><div><h3>Choose a region. Find what changed.</h3><p>Run an analysis to inspect the monthly record, quantify its trend,<br/>and compare it with regions that share a similar pattern.</p></div><span className="empty-label"></span></div>}</section>
   </> : <section className="history-section"><div className="section-title"><div><p className="eyebrow">Analysis history</p><h2>Saved analyses</h2></div><button className="text-button" onClick={() => setTab("explorer")}>Back to explorer ↗</button></div><p className="history-note">Saved in this browser. Download full results JSON from a mission to keep a portable copy.</p>{archiveNote && <p className="notice">{archiveNote}</p>}{!saved.length && <div className="empty-results"><p>Completed analyses will appear here.</p></div>}{saved.map(m => <article className="history-card" key={m.id}><div><label>Analysis name<input aria-label="Mission name" value={m.name ?? name(m.selection.regions[0])} onChange={e => saveRuns(saved.map(r => r.id === m.id ? { ...r, name: e.target.value } : r))}/></label><p>{m.selection.start} — {m.selection.end} · {m.selection.variables.length} signals · {m.selection.regions.length} region{m.selection.regions.length > 1 ? "s" : ""}</p></div><div className="history-actions"><button className="text-button" onClick={() => { setActive(m); setSelection(m.selection); setTab("explorer"); setError(""); }}>Open analysis ↗</button><button className="delete-button" onClick={() => saveRuns(saved.filter(x => x.id !== m.id))}>Delete</button></div></article>)}</section>}
   <section id="methods" className="science-note"><div><h2>Behind the analysis</h2><p>NASA GLDAS Noah v2.1 · monthly land-surface model estimates · 0.25° resolution</p></div><details><summary>Data, methods and limitations</summary><p>Full-record trends use seasonal regression, HAC uncertainty and multiple-testing correction. Custom windows are fitted separately and are not FDR corrected. The trained K-means groups use four standardized trends from 2001–2024; they describe historical similarity, not forecasts. All analytical outputs remain provisional pending scientific review.</p></details></section>
  </main><footer className="site-footer"><a className="brand" href="#top">RockIT</a><p>Built by Team RockIT · NASA Space Apps Challenge</p><span>LAND-SURFACE ESTIMATES / 2001–2024</span></footer>
 </div>;
}
