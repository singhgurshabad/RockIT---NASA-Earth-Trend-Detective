import type { SavedRun } from "./types";

// Saved runs live in this browser only (localStorage). Only the settings are stored,
// never the results: opening a saved run asks the data service again.
const KEY = "rockit.history.v1";
const LIMIT = 30;

export function loadHistory(): SavedRun[] {
  try {
    const raw = window.localStorage.getItem(KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(
      (r) => r && typeof r.id === "string" && r.config && Array.isArray(r.config.regions) && Array.isArray(r.config.variables),
    );
  } catch {
    return [];
  }
}

export function saveHistory(runs: SavedRun[]): boolean {
  try {
    window.localStorage.setItem(KEY, JSON.stringify(runs.slice(0, LIMIT)));
    return true;
  } catch {
    return false; // private mode or storage full: history then lasts for this visit only
  }
}
