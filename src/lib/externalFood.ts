// Reservkällor när Livsmedelsverket saknar ett livsmedel:
//  - USDA FoodData Central (kräver gratis API-nyckel från api.data.gov)
//  - Open Food Facts (märkesvaror, streckkoder; mikronäringsämnen saknas ofta)
import type { Food } from "./foodDb";
import type { NutrientKey, Nutrients } from "./nutrients";

// USDA nutrientNumber -> intern nyckel
const USDA_MAP: Record<string, NutrientKey> = {
  "208": "kcal", "203": "protein", "205": "carbs", "204": "fat", "291": "fiber",
  "269": "sugar", "606": "satFat", "307": "sodium", "306": "potassium", "304": "magnesium",
  "301": "calcium", "303": "iron", "309": "zinc", "305": "phosphorus", "317": "selenium",
  "320": "vitA", "328": "vitD", "323": "vitE", "401": "vitC", "404": "thiamin",
  "405": "riboflavin", "406": "niacin", "415": "vitB6", "418": "vitB12", "417": "folate",
};

interface UsdaFood {
  fdcId: number;
  description: string;
  dataType: string;
  foodNutrients: { nutrientNumber?: string; nutrientName?: string; unitName?: string; value?: number }[];
}

function usdaToFood(f: UsdaFood): Food {
  const per100g: Nutrients = {};
  for (const n of f.foodNutrients) {
    const key = n.nutrientNumber ? USDA_MAP[n.nutrientNumber] : undefined;
    if (key && typeof n.value === "number") per100g[key] = n.value;
    // Foundation Foods anger ibland energi enbart som Atwater-värden (957/958).
    if (per100g.kcal == null && (n.nutrientNumber === "958" || n.nutrientNumber === "957") && n.unitName === "KCAL") {
      per100g.kcal = n.value ?? null;
    }
  }
  if (per100g.sodium != null) per100g.salt = (per100g.sodium * 2.5) / 1000;
  const desc = f.description.toLowerCase();
  return {
    id: `usda:${f.fdcId}`,
    number: f.fdcId,
    name: `${f.description} (${f.dataType})`,
    source: "USDA",
    sourceUrl: `https://fdc.nal.usda.gov/food-details/${f.fdcId}/nutrients`,
    per100g,
    state: /\braw\b|\buncooked\b|\bdry\b/.test(desc) ? "raw" : /\bcooked\b|\bboiled\b|\bbaked\b|\broasted\b|\bfried\b|\bgrilled\b/.test(desc) ? "cooked" : "neutral",
    tokens: desc.split(/\W+/).filter(Boolean),
  };
}

export async function searchUsda(query: string, apiKey: string): Promise<Food[]> {
  const params = new URLSearchParams({
    api_key: apiKey,
    query,
    dataType: "Foundation,SR Legacy",
    pageSize: "10",
  });
  const res = await fetch(`https://api.nal.usda.gov/fdc/v1/foods/search?${params}`);
  if (res.status === 429) throw new Error("USDA: för många anrop – vänta en stund eller använd en egen API-nyckel.");
  if (!res.ok) throw new Error(`USDA svarade ${res.status}`);
  const data = (await res.json()) as { foods?: UsdaFood[] };
  return (data.foods ?? []).map(usdaToFood);
}

// Open Food Facts anger allt i gram per 100 g; mikronäringsämnen räknas om.
const OFF_MAP: [string, NutrientKey, number][] = [
  ["energy-kcal_100g", "kcal", 1],
  ["proteins_100g", "protein", 1],
  ["carbohydrates_100g", "carbs", 1],
  ["fat_100g", "fat", 1],
  ["fiber_100g", "fiber", 1],
  ["sugars_100g", "sugar", 1],
  ["saturated-fat_100g", "satFat", 1],
  ["salt_100g", "salt", 1],
  ["sodium_100g", "sodium", 1000],
  ["potassium_100g", "potassium", 1000],
  ["magnesium_100g", "magnesium", 1000],
  ["calcium_100g", "calcium", 1000],
  ["iron_100g", "iron", 1000],
  ["zinc_100g", "zinc", 1000],
  ["phosphorus_100g", "phosphorus", 1000],
  ["iodine_100g", "iodine", 1e6],
  ["selenium_100g", "selenium", 1e6],
  ["vitamin-a_100g", "vitA", 1e6],
  ["vitamin-d_100g", "vitD", 1e6],
  ["vitamin-e_100g", "vitE", 1000],
  ["vitamin-c_100g", "vitC", 1000],
  ["vitamin-b1_100g", "thiamin", 1000],
  ["vitamin-b2_100g", "riboflavin", 1000],
  ["vitamin-pp_100g", "niacin", 1000],
  ["vitamin-b6_100g", "vitB6", 1000],
  ["vitamin-b12_100g", "vitB12", 1e6],
  ["vitamin-b9_100g", "folate", 1e6],
];

interface OffProduct {
  code: string;
  product_name?: string;
  brands?: string;
  nutriments?: Record<string, number | string>;
}

export function offToFood(p: OffProduct): Food | null {
  const n = p.nutriments ?? {};
  const per100g: Nutrients = {};
  for (const [field, key, factor] of OFF_MAP) {
    const v = Number(n[field]);
    if (n[field] !== undefined && Number.isFinite(v)) per100g[key] = v * factor;
  }
  if (per100g.kcal == null && per100g.protein == null) return null;
  const name = [p.product_name, p.brands].filter(Boolean).join(" – ") || p.code;
  return {
    id: `off:${p.code}`,
    number: Number(p.code) || 0,
    name,
    source: "Open Food Facts",
    sourceUrl: `https://world.openfoodfacts.org/product/${p.code}`,
    per100g,
    state: "neutral",
    tokens: name.toLowerCase().split(/\s+/),
  };
}

const OFF_FIELDS = "code,product_name,brands,nutriments";

export async function lookupBarcode(code: string): Promise<Food | null> {
  const res = await fetch(`https://world.openfoodfacts.org/api/v2/product/${encodeURIComponent(code)}.json?fields=${OFF_FIELDS}`);
  if (!res.ok) throw new Error(`Open Food Facts svarade ${res.status}`);
  const data = (await res.json()) as { status: number; product?: OffProduct };
  return data.status === 1 && data.product ? offToFood({ ...data.product, code }) : null;
}

export async function searchOpenFoodFacts(query: string): Promise<Food[]> {
  const params = new URLSearchParams({
    search_terms: query,
    search_simple: "1",
    json: "1",
    page_size: "10",
    fields: OFF_FIELDS,
  });
  const res = await fetch(`https://world.openfoodfacts.org/cgi/search.pl?${params}`);
  if (!res.ok) throw new Error(`Open Food Facts-sökningen svarade ${res.status} – prova igen senare eller sök på streckkod.`);
  const data = (await res.json()) as { products?: OffProduct[] };
  return (data.products ?? []).map(offToFood).filter((f): f is Food => f !== null);
}
