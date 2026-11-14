export type Selection = {
  region: string;
  start: string; // YYYY-MM-DD
  end: string;   // YYYY-MM-DD
  variables: string[];
};

export type Run = Selection & { id: number; name: string };

export type Stage = "landing" | "menu" | "panel";
