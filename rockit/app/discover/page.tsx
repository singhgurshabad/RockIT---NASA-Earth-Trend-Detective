"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useState } from "react";
import { BootGate, useAppData } from "@/components/AppData";
import Signals from "@/components/Signals";
import Twins from "@/components/Twins";
import { ApiError, getClusters, isAbort } from "@/lib/api";
import { exploreHref } from "@/lib/links";
import type { ApiClusters } from "@/lib/types";

export default function DiscoverPage() {
  return (
    <Suspense fallback={null}>
      <Discover />
    </Suspense>
  );
}

function Discover() {
  const router = useRouter();
  const askedTwin = useSearchParams().get("twin");
  const { boot, retry } = useAppData();
  const [twinRegion, setTwinRegion] = useState<string | null>(null);
  const [clusters, setClusters] = useState<{ status: "loading" | "ok" | "error"; data: ApiClusters | null; message: string | null }>({ status: "loading", data: null, message: null });
  const [attempt, setAttempt] = useState(0);
  const ready = boot.status === "ready" ? boot : null;

  useEffect(() => {
    if (!ready || twinRegion) return;
    const asked = askedTwin;
    const fallback = ready.regions.find((r) => r.id === "alaska_tundra") ?? ready.regions[0];
    setTwinRegion(ready.regions.some((r) => r.id === asked) ? (asked as string) : fallback?.id ?? null);
  }, [ready, twinRegion, askedTwin]);

  useEffect(() => {
    if (!ready) return;
    const controller = new AbortController();
    setClusters({ status: "loading", data: null, message: null });
    getClusters(controller.signal)
      .then((data) => setClusters({ status: "ok", data, message: null }))
      .catch((error) => {
        if (!isAbort(error)) setClusters({ status: "error", data: null, message: error instanceof ApiError ? error.message : "Something went wrong." });
      });
    return () => controller.abort();
  }, [ready, attempt]);

  if (!ready || !twinRegion) return <BootGate boot={boot} retry={retry} />;
  const { regions, variables, meta } = ready;

  return (
    <main>
      <section className="page-head">
        <div className="page">
          <h1 className="text-[clamp(28px,3vw,40px)]">Discover</h1>
          <p className="mt-3 max-w-[64ch] text-[16px] text-ink-2">
            Patterns across all {regions.length} regions at once: which places changed alike, and which changed the most. Everything here describes the full record, {meta.period.start.slice(0, 4)} to {meta.period.end.slice(0, 4)}. Open any of it in Explore for the full chart and uncertainty.
          </p>
          <nav className="mt-5 flex flex-wrap gap-2" aria-label="On this page">
            <a className="badge transition-colors hover:text-ink" href="#twins">Earth Twins</a>
            <a className="badge transition-colors hover:text-ink" href="#signals">Strongest signals</a>
          </nav>
        </div>
      </section>

      <Twins
        regions={regions}
        variables={variables}
        clusters={clusters}
        onRetryClusters={() => setAttempt((n) => n + 1)}
        region={twinRegion}
        onRegion={(id) => {
          setTwinRegion(id);
          window.history.replaceState(null, "", `/discover?twin=${encodeURIComponent(id)}`);
        }}
        running={false}
        onShowOnGlobe={(a, b) => router.push(exploreHref({ regions: [a, b], link: true }))}
        onCompare={(a, b) => router.push(exploreHref({ regions: [a, b], variables: variables.map((v) => v.id), run: true, link: true }))}
      />

      <Signals
        regions={regions}
        variables={variables}
        running={false}
        onExplore={(ids, variable) => router.push(exploreHref({ regions: ids, variables: [variable], run: true }))}
      />
    </main>
  );
}
