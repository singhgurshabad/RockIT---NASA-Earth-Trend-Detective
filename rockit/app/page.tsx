"use client";

import { useRef, useState } from "react";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import RegionTime from "@/components/RegionTime";
import Variables from "@/components/Variables";
import DataHistory from "@/components/DataHistory";
import { DEFAULT_SELECTION, TAB_INFO, timeError } from "@/lib/constants";
import type { Run, Selection, Stage } from "@/lib/types";

const cardBtn =
  "aspect-square w-full max-w-[260px] flex-1 rounded-2xl border-[3px] border-line bg-card text-[clamp(18px,2.5vw,28px)] text-ink transition hover:-translate-y-1.5 hover:scale-[1.03] hover:shadow-xl focus-visible:-translate-y-1.5 max-sm:aspect-auto max-sm:py-5";
const arrowBtn = "h-14 w-14 flex-none rounded-2xl bg-btn text-2xl text-ink hover:bg-btn-hover";

export default function Home() {
  const [stage, setStage] = useState<Stage>("landing");
  const [tab, setTab] = useState(0);
  const [sel, setSel] = useState<Selection>(DEFAULT_SELECTION);
  const [runs, setRuns] = useState<Run[]>([]);
  const [info, setInfo] = useState("");
  const nextId = useRef(1);

  const menuItems = ["Region / Time", "Variables", "Data"];
  const tucked = stage !== "landing";

  function openTab(i: number) {
    const t = Math.max(0, Math.min(2, i));
    setTab(t);
    setStage("panel");
    setInfo(TAB_INFO[t]);
  }

  function goHome() {
    setStage("landing");
    setInfo("");
  }

  function run() {
    if (!sel.variables.length) return setInfo("Pick at least one variable first.");
    const err = timeError(sel);
    if (err) return setInfo(err);
    // TODO: send `sel` to the FastAPI backend here and store the real result.
    const id = nextId.current++;
    setRuns((r) => [{ ...sel, id, name: `Run ${id}` }, ...r]);
    openTab(2);
    setInfo("Run saved. Rename it or delete it below.");
  }

  return (
    <div className="flex h-full flex-col">
      <Header onHome={goHome} />

      <main className="relative flex-1 overflow-hidden">
        <div className="bg-grid absolute inset-0" />

        {/* hero: slides up behind the header when Start is pressed */}
        <div
          className={`absolute inset-0 z-20 transition-all duration-700 ${
            tucked ? "pointer-events-none -translate-y-[105%] opacity-0" : ""
          }`}
        >
          <div className="absolute inset-0 bg-sky [clip-path:polygon(0_0,100%_0,100%_15%,0_85%)]" />
          <h2 className="absolute inset-0 m-0 grid place-items-center px-4 text-center text-[clamp(30px,6vw,72px)] font-normal leading-tight text-ink">
            <span>Discover Earth Trends<br />using NASA data</span>
          </h2>
        </div>

        {/* the three big buttons */}
        {stage === "menu" && (
          <div className="absolute inset-0 z-10 flex items-center justify-center gap-[5%] p-6 max-sm:flex-col max-sm:gap-3">
            {menuItems.map((label, i) => (
              <button
                key={label}
                className={cardBtn}
                onClick={() => openTab(i)}
                onMouseEnter={() => setInfo(TAB_INFO[i])}
                onFocus={() => setInfo(TAB_INFO[i])}
              >
                {label}
              </button>
            ))}
          </div>
        )}

        {/* one tab at a time, with arrows to move between them */}
        {stage === "panel" && (
          <div className="absolute inset-0 z-10 flex items-center justify-center gap-3 p-4">
            <button className={arrowBtn} aria-label="Previous tab" onClick={() => openTab(tab - 1)}
              style={{ visibility: tab === 0 ? "hidden" : "visible" }}>◀</button>
            <section className="flex max-w-[820px] flex-1 justify-center">
              {tab === 0 && <RegionTime sel={sel} onChange={setSel} />}
              {tab === 1 && <Variables sel={sel} onChange={setSel} />}
              {tab === 2 && (
                <DataHistory
                  runs={runs}
                  onRename={(id, name) => setRuns((rs) => rs.map((r) => (r.id === id ? { ...r, name } : r)))}
                  onDelete={(id) => setRuns((rs) => rs.filter((r) => r.id !== id))}
                />
              )}
            </section>
            <button className={arrowBtn} aria-label="Next tab" onClick={() => openTab(tab + 1)}
              style={{ visibility: tab === 2 ? "hidden" : "visible" }}>▶</button>
          </div>
        )}
      </main>

      <Footer
        stage={stage}
        info={info}
        sel={sel}
        onStart={() => { setStage("menu"); setInfo("Hover over a button to learn what it does."); }}
        onRun={run}
      />
    </div>
  );
}
