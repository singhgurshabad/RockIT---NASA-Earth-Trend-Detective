// Links between pages. A run's settings travel in the address, so any result can be
// shared or bookmarked, and the Discover page can hand a comparison to Explore.

export function exploreHref(options: { regions: string[]; variables?: string[]; start?: string; end?: string; run?: boolean; link?: boolean }): string {
  const q = new URLSearchParams();
  options.regions.forEach((r) => q.append("region", r));
  options.variables?.forEach((v) => q.append("variable", v));
  if (options.start) q.set("start", options.start);
  if (options.end) q.set("end", options.end);
  if (options.run) q.set("run", "1");
  if (options.link) q.set("link", "1");
  return `/?${q.toString()}`;
}

export type ExploreQuery = { regions: string[]; variables: string[]; start: string | null; end: string | null; run: boolean; link: boolean };

export function readExploreQuery(search: string): ExploreQuery | null {
  const q = new URLSearchParams(search);
  const regions = q.getAll("region");
  if (!regions.length) return null;
  return {
    regions,
    variables: q.getAll("variable"),
    start: q.get("start"),
    end: q.get("end"),
    run: q.get("run") === "1",
    link: q.get("link") === "1",
  };
}
