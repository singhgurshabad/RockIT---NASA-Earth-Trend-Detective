"use client";

import { useCallback, useRef, useState } from "react";
import { ApiError, getAnalysis, getPatternContext, isAbort } from "./api";
import { sameConfig } from "./selection";
import type { ApiAnalysis, ApiPatternContext, RunConfig } from "./types";

export type Phase = "idle" | "running" | "done" | "failed" | "cancelled";

export type PatternPart =
  | { status: "idle" }
  | { status: "loading" }
  | { status: "ok"; data: ApiPatternContext }
  | { status: "error"; message: string };

export type RunState = {
  phase: Phase;
  /** The request in flight, if any. */
  pending: RunConfig | null;
  /** The settings the results on screen were produced with. */
  shown: RunConfig | null;
  analysis: ApiAnalysis | null;
  patterns: PatternPart;
  /** Why the latest attempt failed, and what it was. The results on screen (if any) are older. */
  failure: { message: string; config: RunConfig } | null;
};

const INITIAL: RunState = { phase: "idle", pending: null, shown: null, analysis: null, patterns: { status: "idle" }, failure: null };

function message(error: unknown): string {
  if (error instanceof ApiError) return error.message;
  if (error instanceof Error) return error.message;
  return "Something went wrong.";
}

/** The server echoes the request it answered. Results are only shown if that matches what was asked. */
function answersRequest(analysis: ApiAnalysis, config: RunConfig): boolean {
  const r = analysis.request;
  return (
    r.start === config.start &&
    r.end === config.end &&
    r.regions.join("|") === config.regions.map((x) => x.id).join("|") &&
    r.variables.join("|") === config.variables.join("|")
  );
}

/**
 * Runs an analysis and keeps the result tied to the settings it was run with.
 *
 * - One run at a time. Starting a new run (or cancelling) aborts the previous request.
 * - Every run gets a sequence number. A response is ignored unless it belongs to the
 *   latest run, so a slow old response can never replace a newer one.
 * - The trend analysis and the pattern context are separate requests. If only one
 *   fails, the other is still shown and the failed one can be retried by itself.
 * - If a run fails, earlier results stay on screen, still labelled with their own settings.
 */
export function useRun(onSuccess?: (config: RunConfig, analysis: ApiAnalysis) => void) {
  const [state, setState] = useState<RunState>(INITIAL);
  const sequence = useRef(0);
  const controller = useRef<AbortController | null>(null);
  const patternController = useRef<AbortController | null>(null);
  const stateRef = useRef(state);
  stateRef.current = state;
  const successRef = useRef(onSuccess);
  successRef.current = onSuccess;

  const run = useCallback(async (config: RunConfig) => {
    const current = stateRef.current;
    if (current.phase === "running" && sameConfig(current.pending, config)) return; // already running exactly this

    controller.current?.abort();
    patternController.current?.abort();
    const mine = new AbortController();
    controller.current = mine;
    const id = ++sequence.current;

    setState((s) => ({ ...s, phase: "running", pending: config, failure: null }));

    const [analysis, patterns] = await Promise.allSettled([
      getAnalysis(config, mine.signal),
      getPatternContext(config.regions.map((r) => r.id), mine.signal),
    ]);

    if (id !== sequence.current || mine.signal.aborted) return; // superseded or cancelled

    if (analysis.status === "rejected") {
      if (isAbort(analysis.reason)) return;
      setState((s) => ({ ...s, phase: "failed", pending: null, failure: { message: message(analysis.reason), config } }));
      return;
    }
    if (!answersRequest(analysis.value, config)) {
      setState((s) => ({
        ...s,
        phase: "failed",
        pending: null,
        failure: { message: "The data service answered a different request than the one sent, so the result was discarded.", config },
      }));
      return;
    }

    setState({
      phase: "done",
      pending: null,
      shown: config,
      analysis: analysis.value,
      patterns: patterns.status === "fulfilled" ? { status: "ok", data: patterns.value } : { status: "error", message: message(patterns.reason) },
      failure: null,
    });
    successRef.current?.(config, analysis.value);
  }, []);

  const cancel = useCallback(() => {
    if (stateRef.current.phase !== "running") return;
    sequence.current += 1;
    controller.current?.abort();
    setState((s) => ({ ...s, phase: "cancelled", pending: null }));
  }, []);

  /** Retry only the pattern context, for the results already on screen. */
  const retryPatterns = useCallback(async () => {
    const shown = stateRef.current.shown;
    if (!shown) return;
    patternController.current?.abort();
    const mine = new AbortController();
    patternController.current = mine;
    const id = sequence.current;
    setState((s) => ({ ...s, patterns: { status: "loading" } }));
    try {
      const data = await getPatternContext(shown.regions.map((r) => r.id), mine.signal);
      if (id !== sequence.current) return;
      setState((s) => ({ ...s, patterns: { status: "ok", data } }));
    } catch (error) {
      if (isAbort(error) || id !== sequence.current) return;
      setState((s) => ({ ...s, patterns: { status: "error", message: message(error) } }));
    }
  }, []);

  return { state, run, cancel, retryPatterns };
}
