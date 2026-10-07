// Näringsämnen som appen visar. Nycklarna matchar scripts/fetch-livsmedelsverket.mjs.

export type NutrientKey =
  | "kcal" | "protein" | "carbs" | "fat" | "fiber" | "sugar" | "satFat" | "salt"
  | "sodium" | "potassium" | "magnesium" | "calcium" | "iron" | "zinc" | "phosphorus"
  | "iodine" | "selenium" | "vitA" | "vitD" | "vitE" | "vitC" | "thiamin"
  | "riboflavin" | "niacin" | "vitB6" | "vitB12" | "folate";

export type Nutrients = Partial<Record<NutrientKey, number | null>>;

export type NutrientGroup = "energi" | "makro" | "mineral" | "vitamin";

export interface NutrientInfo {
  key: NutrientKey;
  label: string;
  unit: string;
  group: NutrientGroup;
  decimals: number;
}

export const NUTRIENTS: NutrientInfo[] = [
  { key: "kcal", label: "Energi", unit: "kcal", group: "energi", decimals: 0 },
  { key: "protein", label: "Protein", unit: "g", group: "makro", decimals: 1 },
  { key: "carbs", label: "Kolhydrater", unit: "g", group: "makro", decimals: 1 },
  { key: "fat", label: "Fett", unit: "g", group: "makro", decimals: 1 },
  { key: "fiber", label: "Fiber", unit: "g", group: "makro", decimals: 1 },
  { key: "sugar", label: "varav socker", unit: "g", group: "makro", decimals: 1 },
  { key: "satFat", label: "varav mättat fett", unit: "g", group: "makro", decimals: 1 },
  { key: "salt", label: "Salt", unit: "g", group: "makro", decimals: 1 },
  { key: "potassium", label: "Kalium", unit: "mg", group: "mineral", decimals: 0 },
  { key: "magnesium", label: "Magnesium", unit: "mg", group: "mineral", decimals: 0 },
  { key: "calcium", label: "Kalcium", unit: "mg", group: "mineral", decimals: 0 },
  { key: "iron", label: "Järn", unit: "mg", group: "mineral", decimals: 1 },
  { key: "zinc", label: "Zink", unit: "mg", group: "mineral", decimals: 1 },
  { key: "phosphorus", label: "Fosfor", unit: "mg", group: "mineral", decimals: 0 },
  { key: "sodium", label: "Natrium", unit: "mg", group: "mineral", decimals: 0 },
  { key: "iodine", label: "Jod", unit: "µg", group: "mineral", decimals: 0 },
  { key: "selenium", label: "Selen", unit: "µg", group: "mineral", decimals: 0 },
  { key: "vitA", label: "A-vitamin", unit: "µg RE", group: "vitamin", decimals: 0 },
  { key: "vitC", label: "C-vitamin", unit: "mg", group: "vitamin", decimals: 0 },
  { key: "vitD", label: "D-vitamin", unit: "µg", group: "vitamin", decimals: 1 },
  { key: "vitE", label: "E-vitamin", unit: "mg", group: "vitamin", decimals: 1 },
  { key: "thiamin", label: "Tiamin (B1)", unit: "mg", group: "vitamin", decimals: 2 },
  { key: "riboflavin", label: "Riboflavin (B2)", unit: "mg", group: "vitamin", decimals: 2 },
  { key: "niacin", label: "Niacin (B3)", unit: "mg", group: "vitamin", decimals: 1 },
  { key: "vitB6", label: "B6-vitamin", unit: "mg", group: "vitamin", decimals: 2 },
  { key: "vitB12", label: "B12-vitamin", unit: "µg", group: "vitamin", decimals: 2 },
  { key: "folate", label: "Folat", unit: "µg", group: "vitamin", decimals: 0 },
];

export const NUTRIENT_BY_KEY = Object.fromEntries(NUTRIENTS.map((n) => [n.key, n])) as Record<
  NutrientKey,
  NutrientInfo
>;

export const MICRO_KEYS: NutrientKey[] = NUTRIENTS.filter(
  (n) => n.group === "mineral" || n.group === "vitamin",
).map((n) => n.key);

// Ungefärliga dagliga referensvärden för vuxna, baserade på de nordiska
// näringsrekommendationerna (NNR 2023). Avsedda som riktmärken, inte
// medicinska mål – de kan justeras under Mål.
export type ReferenceProfile = "man" | "kvinna";

export const REFERENCE_INTAKE: Record<ReferenceProfile, Nutrients> = {
  man: {
    fiber: 35, potassium: 3500, magnesium: 350, calcium: 950, iron: 9, zinc: 11.4,
    phosphorus: 550, iodine: 150, selenium: 90, vitA: 800, vitC: 110, vitD: 10,
    vitE: 11, thiamin: 1.2, riboflavin: 1.7, niacin: 18, vitB6: 1.8, vitB12: 4, folate: 330,
  },
  kvinna: {
    fiber: 25, potassium: 3500, magnesium: 300, calcium: 950, iron: 15, zinc: 9.3,
    phosphorus: 550, iodine: 150, selenium: 75, vitA: 700, vitC: 95, vitD: 10,
    vitE: 10, thiamin: 1.0, riboflavin: 1.5, niacin: 15, vitB6: 1.6, vitB12: 4, folate: 330,
  },
};

export function scaleNutrients(per100: Nutrients, grams: number): Nutrients {
  const out: Nutrients = {};
  for (const [k, v] of Object.entries(per100) as [NutrientKey, number | null][]) {
    out[k] = v == null ? null : (v * grams) / 100;
  }
  return out;
}

export function sumNutrients(list: Nutrients[]): Nutrients {
  const out: Nutrients = {};
  for (const n of list) {
    for (const [k, v] of Object.entries(n) as [NutrientKey, number | null][]) {
      if (v == null) continue;
      out[k] = (out[k] ?? 0) + v;
    }
  }
  return out;
}

export function formatNutrient(key: NutrientKey, value: number | null | undefined): string {
  if (value == null || Number.isNaN(value)) return "–";
  const info = NUTRIENT_BY_KEY[key];
  return formatNumber(value, info.decimals);
}

export function formatNumber(value: number, decimals = 0): string {
  return value.toLocaleString("sv-SE", {
    minimumFractionDigits: 0,
    maximumFractionDigits: decimals,
  });
}
