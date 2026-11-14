export const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

export type ApiVariable = {
  id: string;
  label: string;
  unit: string;
  description: string;
  why_it_matters: string;
  icon: string;
};

export async function getVariables(): Promise<ApiVariable[]> {
  const res = await fetch(`${API_URL}/api/variables`);
  if (!res.ok) throw new Error(`API error ${res.status}`);
  return res.json();
}

export type ApiRegion = {
  id: string;
  name: string;
  group: string;
  bbox: number[];
  centroid: number[];
  boundary_type: string;
  description: string;
  why_it_matters: string;
};

export async function getRegions(): Promise<ApiRegion[]> {
  const res = await fetch(`${API_URL}/api/regions`);
  if (!res.ok) throw new Error(`API error ${res.status}`);
  return res.json();
}