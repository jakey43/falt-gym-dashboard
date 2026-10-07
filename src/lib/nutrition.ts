// Kostlogg: Lifesum-makron (manuellt inmatade) + livsmedel från matfrågor.
import { addDays, todayKey } from "./date";
import { REFERENCE_INTAKE, sumNutrients } from "./nutrients";
import type { NutrientKey, Nutrients, ReferenceProfile } from "./nutrients";

export interface LifesumEntry {
  kcal: number | null;
  protein: number | null;
  carbs: number | null;
  fat: number | null;
  fiber: number | null;
}

export interface FoodEntry {
  id: string;
  text: string; // det du skrev, t.ex. "333 g sötpotatis, rå"
  foodId: string;
  foodName: string;
  source: string;
  sourceUrl: string;
  grams: number;
  nutrients: Nutrients;
  addedAt: string;
}

export interface DayLog {
  date: string;
  lifesum: LifesumEntry | null;
  foods: FoodEntry[];
}

export interface Goals {
  kcal: number;
  protein: number;
  carbs: number;
  fat: number;
  fiber: number;
  profile: ReferenceProfile;
  micro: Nutrients; // eget referensvärde per mikronäringsämne
  targetWeightKg: number | null;
}

export const DEFAULT_GOALS: Goals = {
  kcal: 2600,
  protein: 160,
  carbs: 300,
  fat: 80,
  fiber: 35,
  profile: "man",
  micro: {},
  targetWeightKg: null,
};

export function referenceFor(goals: Goals, key: NutrientKey): number | null {
  return goals.micro[key] ?? REFERENCE_INTAKE[goals.profile][key] ?? null;
}

export const MACRO_KEYS = ["kcal", "protein", "carbs", "fat", "fiber"] as const;
export type MacroKey = (typeof MACRO_KEYS)[number];

export interface DayTotals {
  date: string;
  macros: Record<MacroKey, number | null>;
  macroSource: "lifesum" | "matfrågor" | "ingen";
  micros: Nutrients; // endast från matfrågor
  foodCount: number;
  hasData: boolean;
}

// Makron: Lifesum-summan används om den finns (den täcker hela dagen),
// annars summan av livsmedel du lagt till via matfrågor.
// Mikronäringsämnen: kommer bara från matfrågor, eftersom Lifesum inte lämnar ut dem.
export function dayTotals(day: DayLog | undefined, date: string): DayTotals {
  const foods = day?.foods ?? [];
  const foodSum = sumNutrients(foods.map((f) => f.nutrients));
  const ls = day?.lifesum;
  const lsHas = !!ls && MACRO_KEYS.some((k) => ls[k] != null);
  const macros = Object.fromEntries(
    MACRO_KEYS.map((k) => {
      if (lsHas) return [k, ls![k] ?? (k === "fiber" ? foodSum.fiber ?? null : null)];
      return [k, foods.length ? foodSum[k] ?? 0 : null];
    }),
  ) as Record<MacroKey, number | null>;
  return {
    date,
    macros,
    macroSource: lsHas ? "lifesum" : foods.length ? "matfrågor" : "ingen",
    micros: foodSum,
    foodCount: foods.length,
    hasData: lsHas || foods.length > 0,
  };
}

export function rangeTotals(days: Record<string, DayLog>, end: string, count: number): DayTotals[] {
  const out: DayTotals[] = [];
  for (let i = count - 1; i >= 0; i--) {
    const d = addDays(end, -i);
    out.push(dayTotals(days[d], d));
  }
  return out;
}

export function averageMacros(totals: DayTotals[]): Record<MacroKey, number | null> & { days: number } {
  const withData = totals.filter((t) => t.hasData);
  const avg = Object.fromEntries(
    MACRO_KEYS.map((k) => {
      const vals = withData.map((t) => t.macros[k]).filter((v): v is number => v != null);
      return [k, vals.length ? vals.reduce((a, b) => a + b, 0) / vals.length : null];
    }),
  ) as Record<MacroKey, number | null>;
  return { ...avg, days: withData.length };
}

export function weekTotals(days: Record<string, DayLog>, today = todayKey()) {
  return rangeTotals(days, today, 7);
}

export function newId(): string {
  return Math.random().toString(36).slice(2, 10) + Date.now().toString(36);
}
