import type { ApiClusterCenter } from "./types";

export function featureLabels(variables: { id: string; label: string }[]): Record<string, string> {
  return Object.fromEntries(variables.map((v) => [v.id, v.label.replace(" (0-10 cm)", "")]));
}

/**
 * Plain names for the K-means groups, derived from the fitted centres.
 * Cluster numbers are arbitrary, so with two groups each is named by where its centre sits
 * on the feature that separates the centres most. With more groups they are simply numbered.
 */
export function groupNames(
  centers: ApiClusterCenter[],
  separation: { feature: string; range: number }[],
  labels: Record<string, string>,
): Record<number, string> {
  const names: Record<number, string> = {};
  const feature = separation[0]?.feature;
  if (centers.length === 2 && feature) {
    const [low, high] = [...centers].sort((a, b) => a.features[feature] - b.features[feature]);
    const label = (labels[feature] ?? feature).toLowerCase();
    names[high.cluster] = `Stronger ${label} trend`;
    names[low.cluster] = `Weaker ${label} trend`;
    return names;
  }
  [...centers].sort((a, b) => a.cluster - b.cluster).forEach((c, index) => {
    names[c.cluster] = `Group ${index + 1}`;
  });
  return names;
}
