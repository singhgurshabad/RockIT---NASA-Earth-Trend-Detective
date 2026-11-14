import { VARIABLES } from "@/lib/constants";
import type { Selection } from "@/lib/types";

export default function Variables({
  sel,
  onChange,
}: {
  sel: Selection;
  onChange: (s: Selection) => void;
}) {
  function toggle(v: string) {
    const has = sel.variables.includes(v);
    onChange({
      ...sel,
      variables: has ? sel.variables.filter((x) => x !== v) : [...sel.variables, v],
    });
  }
  return (
    <div className="min-w-[260px] rounded-2xl border-[3px] border-line bg-card p-[18px]">
      {VARIABLES.map((v) => (
        <label key={v} className="my-2 flex items-center gap-2 text-lg">
          <input type="checkbox" checked={sel.variables.includes(v)} onChange={() => toggle(v)} />
          {v}
        </label>
      ))}
    </div>
  );
}
