import type { Selection, Stage } from "@/lib/types";

export default function Footer({
  stage, info, sel, onStart, onRun,
}: {
  stage: Stage;
  info: string;
  sel: Selection;
  onStart: () => void;
  onRun: () => void;
}) {
  return (
    <footer className="relative z-50 flex h-[150px] flex-wrap items-center gap-4 overflow-hidden bg-page px-6 py-4">
      <div className="flex min-w-[200px] flex-1 justify-center">
        {stage === "landing" ? (
          <button
            onClick={onStart}
            className="rounded-xl bg-btn px-[52px] py-2.5 text-[clamp(28px,4vw,48px)] text-ink transition hover:-translate-y-0.5 hover:bg-btn-hover"
          >
            Start
          </button>
        ) : (
          <p className="m-0 max-w-[900px] text-center text-[clamp(16px,2vw,22px)]">{info}</p>
        )}
      </div>

      {stage !== "landing" && (
        <div className="ml-auto flex items-center gap-3.5 text-right text-[15px] leading-snug">
          <div className="w-[min(340px,100%)]">
            <div>Region: {sel.region}</div>
            <div>Time: {sel.start || "?"} to {sel.end || "?"}</div>
            <div className="max-h-[4.1em] overflow-y-auto">
              Variables: {sel.variables.length ? sel.variables.join(", ") : "none selected"}
            </div>
          </div>
          <button
            onClick={onRun}
            className="rounded-xl bg-btn px-7 py-3 text-lg text-ink transition hover:-translate-y-0.5 hover:bg-btn-hover"
          >
            Run
          </button>
        </div>
      )}
    </footer>
  );
}
