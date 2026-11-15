"use client";

import { windowLabel } from "@/lib/format";
import { seriesStyle } from "@/lib/palette";
import type { ApiRegion, ApiVariable, SavedRun } from "@/lib/types";
import Icon from "./Icon";

type Props = {
  runs: SavedRun[];
  persisted: boolean;
  regions: ApiRegion[];
  variables: ApiVariable[];
  running: boolean;
  currentRunId: string | null;
  onOpen: (run: SavedRun) => void;
  onRename: (id: string, name: string) => void;
  onDelete: (id: string) => void;
  onClear: () => void;
};

export default function History({ runs, persisted, regions, variables, running, currentRunId, onOpen, onRename, onDelete, onClear }: Props) {
  return (
    <section id="history" className="section" aria-labelledby="history-heading">
      <div className="page">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <h2 id="history-heading" className="section-title">Saved runs</h2>
            <p className="section-lede">
              Every finished analysis is listed here. Only the settings are kept, {persisted ? "in this browser" : "for this visit (this browser is not allowing storage)"}; opening one runs it again against the data service.
            </p>
          </div>
          {runs.length > 0 && <button className="btn" onClick={onClear}><Icon name="trash" size={16} /> Clear all</button>}
        </div>

        {runs.length === 0 ? (
          <p className="mt-6 text-ink-2">Nothing saved yet. Run an analysis and it will appear here.</p>
        ) : (
          <ul className="mt-6 flex flex-col border-t border-line">
            {runs.map((run) => {
              const stale = Boolean(currentRunId && run.runId && run.runId !== currentRunId);
              return (
                <li key={run.id} className="flex flex-wrap items-center gap-x-5 gap-y-2 border-b border-line py-3.5">
                  <div className="min-w-[220px] flex-1">
                    <label className="sr-only" htmlFor={`name-${run.id}`}>Name of this saved run</label>
                    <input
                      id={`name-${run.id}`}
                      className="w-full rounded-md border border-transparent bg-transparent px-1.5 py-1 text-[15px] font-medium text-ink hover:border-line-strong focus:border-line-strong"
                      value={run.name}
                      maxLength={80}
                      onChange={(event) => onRename(run.id, event.target.value)}
                    />
                    <p className="mt-0.5 flex flex-wrap items-center gap-x-3 gap-y-1 px-1.5 text-[13px] text-ink-3">
                      <span className="flex items-center gap-1">
                        {[...run.config.regions].sort((a, b) => a.slot - b.slot).map((r) => (
                          <span key={r.id} className="slot" style={{ background: seriesStyle(r.slot).color }} title={regions.find((x) => x.id === r.id)?.name ?? r.id}>{r.slot}</span>
                        ))}
                      </span>
                      <span>{run.config.regions.map((r) => regions.find((x) => x.id === r.id)?.name ?? r.id).join(", ")}</span>
                      <span className="num">{windowLabel(run.config.start, run.config.end)}</span>
                      <span>{run.config.variables.map((v) => variables.find((x) => x.id === v)?.label.replace(" (0-10 cm)", "") ?? v).join(", ")}</span>
                    </p>
                    {stale && <p className="mt-1 px-1.5 text-[12.5px] text-review">Saved under an earlier analysis run. Opening it uses the current data.</p>}
                  </div>
                  <span className="num text-[13px] text-ink-3">{new Date(run.savedAt).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" })}</span>
                  <div className="flex gap-2">
                    <button className="btn !min-h-[36px]" disabled={running} onClick={() => onOpen(run)}><Icon name="play" size={14} /> Run again</button>
                    <button className="btn !min-h-[36px] !px-2.5" onClick={() => onDelete(run.id)} aria-label={`Delete saved run ${run.name}`}><Icon name="trash" size={16} /></button>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </section>
  );
}
