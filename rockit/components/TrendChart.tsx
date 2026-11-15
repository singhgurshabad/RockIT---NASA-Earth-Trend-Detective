"use client";
import { useEffect, useRef, useState } from "react";
import type { Data, Layout, Config } from "plotly.js";
import { type Analysis, type ApiRegion, formatUnit, number } from "@/lib/api";
const palette = ["#1768a2", "#bf5a24"];
export default function TrendChart({ data, label, regions }: { data: Analysis; label: string; regions: ApiRegion[] }) {
 const [mode, setMode] = useState<"values" | "anomalies">("values");
 const [fit, setFit] = useState(false);
 const [page, setPage] = useState(0);
 const [plotError, setPlotError] = useState("");
 const [loading,setLoading]=useState(true);
 const version=useRef(0);
 const graph = useRef<HTMLDivElement>(null);
 const dates = data.series[0]?.dates ?? [];
 const observations = data.series.map(s => mode === "values" ? s.values : s.anomalies ?? []);
 const name = (id: string) => regions.find(r => r.id === id)?.name.replace(" (validation region)", "") ?? id;
 const unit = formatUnit(data.unit);
 useEffect(() => {
  let disposed = false;
  const ticket=++version.current;setLoading(true);setPlotError("");
  let cleanup = () => {};
  import("plotly.js-basic-dist-min").then(async module => {
   if (disposed || !graph.current) return;
   const Plotly = module.default;
   const el = graph.current;
   const traces: Data[] = data.series.flatMap((s, i) => {
    const primary: Data = { x:s.dates, y:mode === "values" ? s.values : s.anomalies, type:"scatter", mode:dates.length < 3 ? "lines+markers" : "lines", name:name(s.region), connectgaps:false, line:{color:palette[i],width:1.7,dash:i===1?"dash":"solid"}, hovertemplate:`%{y:.3f} ${unit}<extra>${name(s.region)}</extra>` };
    const overlays: Data[] = fit ? [{ x:s.dates, y:mode === "values" ? s.fitted : s.trend_component, type:"scatter",mode:"lines", name:`${name(s.region)} · source ${mode === "values" ? "fit" : "trend"}`,connectgaps:false,line:{color:i===0?"#1e3547":"#7f3e1c",width:2.1,dash:"dot"},hovertemplate:`%{y:.3f} ${unit}<extra>2001–2024 source model</extra>` }] : [];
    return [primary,...overlays];
   });
   const layout: Partial<Layout> = {
    autosize:true,height:400,margin:{l:70,r:24,t:48,b:60},paper_bgcolor:"#fff",plot_bgcolor:"#fff",font:{family:"Geist, Arial, sans-serif",size:12,color:"#263b4c"},
    xaxis:{title:{text:"Year",standoff:16},type:"date",nticks:7,tickformat:dates.length>24?"%Y":"%b %Y",showgrid:false,zeroline:false,showline:true,linecolor:"#93a1ad",ticks:"outside",tickcolor:"#93a1ad",ticklen:5,fixedrange:false},
    yaxis:{title:{text:`${mode === "anomalies" ? "Anomaly" : label} (${unit})`,standoff:14},nticks:6,showgrid:true,gridcolor:"#e8edf1",gridwidth:1,zeroline:mode === "anomalies",zerolinecolor:"#8996a1",zerolinewidth:1,showline:false,ticks:"outside",tickcolor:"#93a1ad",ticklen:4,automargin:true},
    legend:{orientation:"h",x:0,y:1.15,xanchor:"left",yanchor:"top",font:{size:11}},hovermode:"x unified",hoverlabel:{bgcolor:"#fff",bordercolor:"#ccd6dd",font:{size:12,color:"#172b3a"}},dragmode:"zoom",uirevision:`${data.variable}-${mode}`,showlegend:true,
   };
   const config: Partial<Config> = {responsive:true,displaylogo:false,displayModeBar:true,scrollZoom:false,modeBarButtonsToRemove:["select2d","lasso2d","autoScale2d","sendChartToCloud"],toImageButtonOptions:{format:"svg",filename:`rockit-${data.variable}-${mode}`,width:1400,height:650,scale:1}};
   await Plotly.newPlot(el,traces,layout,config);
   if (disposed) { if(version.current===ticket) Plotly.purge(el); return; }
   setLoading(false);
   const resize = new ResizeObserver(() => { if (!disposed && el.isConnected && el.clientWidth > 0 && el.clientHeight > 0) void Promise.resolve(Plotly.Plots.resize(el)).catch(() => {}); }); resize.observe(el);
   cleanup = () => { resize.disconnect(); Plotly.purge(el); };
  }).catch(() => { if (!disposed) { setLoading(false);setPlotError("The interactive plot could not load. The data table and downloads remain available."); } });
  return () => { disposed=true;cleanup(); };
 }, [data,mode,fit]);
 return <>
  <div className="chart-heading"><div><h3>{label}</h3><p>{dates[0]?.slice(0,7)} – {dates[dates.length-1]?.slice(0,7)} · {dates.length} monthly observations per region</p></div><span className="chart-source">NASA GLDAS v2.1</span></div>
  <div className="chart-tools"><div className="segmented"><button aria-pressed={mode==="values"} onClick={()=>setMode("values")}>Monthly values</button><button aria-pressed={mode==="anomalies"} onClick={()=>setMode("anomalies")}>Anomalies</button></div><label className="fit-toggle"><input type="checkbox" checked={fit} onChange={e=>setFit(e.target.checked)}/>Show source model</label></div>
  {plotError && <p role="alert" className="plot-error">{plotError}</p>}
  <div className="plot-frame">{loading && <p className="plot-loading" role="status">Preparing plot…</p>}<div ref={graph} className="scientific-plot" role="region" aria-label={`${label}, ${mode}, ${data.start} to ${data.end}. Interactive plot; accessible monthly values in the table below.`}/></div>
  <p className="chart-context">{mode==="anomalies"?"Anomalies are relative to the 2001–2024 calendar-month average.":"Monthly regional means. Drag within the plot to zoom; double-click to reset."} {fit?"Dotted overlays use the full 2001–2024 source model, including when the selected window is shorter.":"Download a vector figure using the camera control."}</p>
  <details className="chart-table"><summary>Monthly data table <span>{dates.length} months</span></summary><div><table><caption>{label} · {unit} · {mode==="values"?"Monthly means":"Full-record baseline anomalies"}</caption><thead><tr><th scope="col">Month</th>{data.series.map(s=><th key={s.region} scope="col">{name(s.region)}<small>{unit}</small></th>)}</tr></thead><tbody>{dates.slice(page*12,page*12+12).map((d,j)=><tr key={d}><th scope="row">{d.slice(0,7)}</th>{observations.map((v,i)=><td key={i}>{number(v[page*12+j],3)}</td>)}</tr>)}</tbody></table></div><div className="table-pagination"><button disabled={page===0} onClick={()=>setPage(page-1)}>← Previous</button><span>{page*12+1}–{Math.min((page+1)*12,dates.length)} of {dates.length}</span><button disabled={(page+1)*12>=dates.length} onClick={()=>setPage(page+1)}>Next →</button></div></details>
 </>;
}
