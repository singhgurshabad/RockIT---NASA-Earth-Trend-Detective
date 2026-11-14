import type { Run } from "@/lib/types";

export default function DataHistory({
  runs,
  onRename,
  onDelete,
}: {
  runs: Run[];
  onRename: (id: number, name: string) => void;
  onDelete: (id: number) => void;
}) {
  return (
    <div className="max-h-[min(50vh,360px)] w-[min(520px,80vw)] overflow-y-auto rounded-2xl border-[3px] border-line bg-card p-[18px]">
      {runs.length === 0 && <p className="m-0">No previous runs yet.</p>}
      {runs.map((r) => (
        <div key={r.id} className="flex flex-col gap-1.5 border-b-2 border-line py-3 last:border-b-0">
          <input
            aria-label="Run name"
            value={r.name}
            onChange={(e) => onRename(r.id, e.target.value)}
            className="rounded-lg border-2 border-line bg-page p-1.5 px-2 text-lg text-ink"
          />
          <div className="text-[15px]">
            {r.region} · {r.start} to {r.end} · {r.variables.join(", ")}
          </div>
          <button
            onClick={() => onDelete(r.id)}
            className="self-start rounded-xl bg-btn px-4 py-1.5 text-[15px] text-ink hover:bg-btn-hover"
          >
            Delete
          </button>
        </div>
      ))}
    </div>
  );
}
