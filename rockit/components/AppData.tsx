"use client";

import { createContext, useContext, useEffect, useMemo, useState } from "react";
import { API_URL, ApiError, getGlossary, getMeta, getRegions, getVariables, isAbort } from "@/lib/api";
import type { ApiGlossaryEntry, ApiMeta, ApiRegion, ApiVariable } from "@/lib/types";
import Icon from "./Icon";
import { GlossaryContext } from "./Term";

export type Boot =
  | { status: "loading" }
  | { status: "error"; message: string }
  | { status: "ready"; meta: ApiMeta; regions: ApiRegion[]; variables: ApiVariable[] };

type AppData = { boot: Boot; glossary: ApiGlossaryEntry[]; retry: () => void };

const Ctx = createContext<AppData>({ boot: { status: "loading" }, glossary: [], retry: () => undefined });

/** Loads what every page needs (coverage, regions, variables, glossary) once, and shares it. */
export function AppDataProvider({ children }: { children: React.ReactNode }) {
  const [boot, setBoot] = useState<Boot>({ status: "loading" });
  const [glossary, setGlossary] = useState<ApiGlossaryEntry[]>([]);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    const controller = new AbortController();
    setBoot({ status: "loading" });
    Promise.all([getMeta(controller.signal), getRegions(controller.signal), getVariables(controller.signal)])
      .then(([meta, regions, variables]) => setBoot({ status: "ready", meta, regions, variables }))
      .catch((error) => {
        if (!isAbort(error)) setBoot({ status: "error", message: error instanceof ApiError ? error.message : "Something went wrong." });
      });
    getGlossary(controller.signal).then(setGlossary).catch(() => undefined); // terms then show as plain text
    return () => controller.abort();
  }, [attempt]);

  const value = useMemo(() => ({ boot, glossary, retry: () => setAttempt((n) => n + 1) }), [boot, glossary]);
  const glossaryMap = useMemo(() => new Map(glossary.map((entry) => [entry.id, entry])), [glossary]);
  return (
    <Ctx.Provider value={value}>
      <GlossaryContext.Provider value={glossaryMap}>{children}</GlossaryContext.Provider>
    </Ctx.Provider>
  );
}

export function useAppData() {
  return useContext(Ctx);
}

/** Shown in place of a page until the data service has answered. */
export function BootGate({ boot, retry }: { boot: Boot; retry: () => void }) {
  return (
    <main className="page flex min-h-[60vh] flex-col justify-center py-20">
      {boot.status === "error" ? (
        <div className="max-w-[60ch]" role="alert">
          <h1 className="text-[30px]">RockIT cannot reach its data service</h1>
          <p className="mt-4 text-ink-2">{boot.message}</p>
          <p className="mt-3 text-ink-2">
            The app expects the RockIT API at <span className="text-ink">{API_URL}</span>. To start it locally, open a terminal in the project&apos;s <span className="text-ink">api</span> folder and run <span className="text-ink">uvicorn main:app --port 8000</span>.
          </p>
          <button className="btn-primary mt-6" onClick={retry}><Icon name="retry" size={17} /> Try again</button>
        </div>
      ) : (
        <p className="flex items-center gap-3 text-ink-2" role="status"><span className="spinner" /> Loading regions, variables and data coverage</p>
      )}
    </main>
  );
}
