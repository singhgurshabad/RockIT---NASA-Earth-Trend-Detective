"use client";

import { useAppData } from "./AppData";

export default function Footer() {
  const { boot } = useAppData();
  const runId = boot.status === "ready" ? boot.meta.run_id : null;
  return (
    <footer className="mt-auto border-t border-line py-7 text-[13px] text-ink-3">
      <div className="page flex flex-wrap items-baseline justify-between gap-x-8 gap-y-2">
        <p>RockIT, a NASA Space Apps Challenge project. Not affiliated with or endorsed by NASA.</p>
        <p>Data: NASA GLDAS Noah v2.1 model estimates.{runId ? ` Analysis run ${runId}.` : ""} Results are provisional.</p>
      </div>
    </footer>
  );
}
