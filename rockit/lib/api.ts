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