"use client";

import { createContext, useContext, useEffect, useId, useRef, useState } from "react";
import type { ApiGlossaryEntry } from "@/lib/types";

export const GlossaryContext = createContext<Map<string, ApiGlossaryEntry>>(new Map());

/** A word with a dotted underline. Press it to read its glossary definition. */
export default function Term({ id, children }: { id: string; children: React.ReactNode }) {
  const entry = useContext(GlossaryContext).get(id);
  const [open, setOpen] = useState(false);
  const wrap = useRef<HTMLSpanElement>(null);
  const panel = useId();

  useEffect(() => {
    if (!open) return;
    const close = (event: Event) => {
      if (event instanceof KeyboardEvent ? event.key === "Escape" : !wrap.current?.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener("pointerdown", close);
    document.addEventListener("keydown", close);
    return () => {
      document.removeEventListener("pointerdown", close);
      document.removeEventListener("keydown", close);
    };
  }, [open]);

  if (!entry) return <>{children}</>;
  return (
    <span ref={wrap} className="relative inline-block">
      <button
        type="button"
        className="cursor-help underline decoration-dotted decoration-[1.5px] underline-offset-[3px]"
        style={{ textDecorationColor: "var(--ink-3)", font: "inherit", color: "inherit" }}
        aria-expanded={open}
        aria-controls={panel}
        onClick={() => setOpen((v) => !v)}
      >
        {children}
      </button>
      {open && (
        <span
          id={panel}
          role="note"
          className="absolute left-0 top-[calc(100%+6px)] z-30 block w-[min(320px,80vw)] rounded-lg border border-line-strong bg-panel p-3 text-left text-[13.5px] font-normal leading-snug text-ink-2 shadow-[0_10px_30px_rgba(0,0,0,0.55)]"
          style={{ fontStretch: "100%", letterSpacing: 0 }}
        >
          <span className="block font-medium text-ink">{entry.term}</span>
          <span className="mt-1 block">{entry.definition}</span>
          {entry.explanation && <span className="mt-1.5 block text-ink-3">{entry.explanation}</span>}
        </span>
      )}
    </span>
  );
}
