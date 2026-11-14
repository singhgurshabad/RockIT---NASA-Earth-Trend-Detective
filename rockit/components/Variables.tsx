"use client";

import { useEffect, useState } from "react";
import { getVariables, type ApiVariable } from "@/lib/api";
import type { Selection } from "@/lib/types";

export default function Variables({
  sel,
  onChange,
}: {
  sel: Selection;
  onChange: (s: Selection) => void;
}) {
  const [variables, setVariables] = useState<ApiVariable[]>([]);
  const [error, setError] = useState("");

  useEffect(() => {
    getVariables()
      .then(setVariables)
      .catch((e) => setError(e.message));
  }, []);

  function toggle(id: string) {
    const has = sel.variables.includes(id);
    onChange({
      ...sel,
      variables: has ? sel.variables.filter((x) => x !== id) : [...sel.variables, id],
    });
  }

  return (
    <div className="min-w-[260px] rounded-2xl border-[3px] border-line bg-card p-[18px]">
      {error && <p>Could not load variables ({error}). Is the API running?</p>}
      {!error && variables.length === 0 && <p>Loading…</p>}
      {variables.map((v) => (
        <label key={v.id} title={v.description} className="my-2 flex items-center gap-2 text-lg">
          <input type="checkbox" checked={sel.variables.includes(v.id)} onChange={() => toggle(v.id)} />
          {v.label}
        </label>
      ))}
    </div>
  );
}