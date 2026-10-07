// Tolkar fritext som "333 g sötpotatis, rå" eller "4 ägg och 200 g ris"
// till rader med mängd i gram och ett matchat livsmedel.
import { applySynonyms, hasStateVariants, isStateWord, searchFoods, stateOf, tokenize } from "./foodDb";
import type { Food, FoodState } from "./foodDb";
import { scaleNutrients, sumNutrients } from "./nutrients";
import type { Nutrients } from "./nutrients";

// Ungefärlig vikt (ätlig del, gram) per styck. Används bara när ingen vikt anges.
const PIECE_GRAMS: [RegExp, number, string][] = [
  [/^äggvit/, 33, "1 äggvita ≈ 33 g"],
  [/^äggul/, 17, "1 äggula ≈ 17 g"],
  [/^ägg/, 50, "1 ägg (medelstort, utan skal) ≈ 50 g"],
  [/^banan/, 120, "1 banan (skalad) ≈ 120 g"],
  [/^äpple/, 150, "1 äpple ≈ 150 g"],
  [/^apelsin/, 140, "1 apelsin (skalad) ≈ 140 g"],
  [/^päron/, 150, "1 päron ≈ 150 g"],
  [/^kiwi/, 75, "1 kiwi ≈ 75 g"],
  [/^avokado/, 150, "1 avokado (utan kärna och skal) ≈ 150 g"],
  [/^sötpotatis/, 300, "1 sötpotatis ≈ 300 g"],
  [/^potatis/, 90, "1 potatis ≈ 90 g"],
  [/^morot/, 70, "1 morot ≈ 70 g"],
  [/^tomat/, 90, "1 tomat ≈ 90 g"],
  [/^paprika/, 150, "1 paprika ≈ 150 g"],
  [/^lök/, 100, "1 lök ≈ 100 g"],
  [/^vitlök/, 4, "1 vitlöksklyfta ≈ 4 g"],
  [/^knäckebröd/, 12, "1 knäckebröd ≈ 12 g"],
  [/^bröd/, 35, "1 brödskiva ≈ 35 g"],
  [/^kyckling/, 130, "1 kycklingfilé ≈ 130 g"],
  [/^lax/, 125, "1 laxfilé ≈ 125 g"],
  [/^tortilla|^wrap/, 40, "1 tortilla ≈ 40 g"],
];

// Ungefärlig densitet (gram per dl) för volymmått.
const GRAMS_PER_DL: [RegExp, number][] = [
  [/^havregryn|^müsli|^musli/, 35],
  [/^ris/, 85],
  [/^quinoa/, 85],
  [/^couscous/, 70],
  [/^bulgur/, 75],
  [/^linser|^kikärt|^bönor/, 85],
  [/^pasta/, 40],
  [/^mjölk|^yoghurt|^fil|^havredryck|^grädde|^kvarg|^juice|^vatten/, 103],
  [/^mjöl(?!k)|^vetemjöl/, 60],
  [/^socker/, 85],
  [/^olja|^olivolja|^rapsolja/, 92],
  [/^smör/, 95],
  [/^blåbär|^hallon|^jordgubb/, 65],
  [/^mjölk|^yoghurt|^fil|^havredryck|^grädde|^kvarg|^juice|^vatten/, 103],
  [/^färskost cottage/, 95],
  [/^jordnötssmör/, 110],
  [/^honung/, 140],
];

const UNIT_ALIASES: Record<string, { kind: "g" | "dl" | "piece"; factor: number }> = {
  g: { kind: "g", factor: 1 },
  gr: { kind: "g", factor: 1 },
  gram: { kind: "g", factor: 1 },
  kg: { kind: "g", factor: 1000 },
  hg: { kind: "g", factor: 100 },
  dl: { kind: "dl", factor: 1 },
  ml: { kind: "dl", factor: 0.01 },
  cl: { kind: "dl", factor: 0.1 },
  l: { kind: "dl", factor: 10 },
  liter: { kind: "dl", factor: 10 },
  msk: { kind: "dl", factor: 0.15 },
  tsk: { kind: "dl", factor: 0.05 },
  krm: { kind: "dl", factor: 0.01 },
  st: { kind: "piece", factor: 1 },
  styck: { kind: "piece", factor: 1 },
  skiva: { kind: "piece", factor: 1 },
  skivor: { kind: "piece", factor: 1 },
};

export interface ParsedPart {
  text: string; // ursprunglig delsträng
  quantity: number | null;
  unit: string | null;
  foodText: string; // t.ex. "sötpotatis rå"
  state: FoodState;
}

export interface MatchedItem extends ParsedPart {
  food: Food | null;
  alternatives: Food[];
  grams: number | null;
  gramsNote: string | null; // förklaring när vikten är uppskattad
  stateAmbiguous: boolean;
  nutrients: Nutrients;
  warnings: string[];
}

function parseNumber(s: string): number | null {
  const words: Record<string, number> = {
    en: 1, ett: 1, två: 2, tre: 3, fyra: 4, fem: 5, sex: 6, sju: 7, åtta: 8, nio: 9, tio: 10,
    halv: 0.5, halvt: 0.5, halva: 0.5,
  };
  if (s in words) return words[s];
  const m = s.replace(",", ".").match(/^\d+(\.\d+)?$/);
  if (m) return Number(m[0]);
  const frac = s.match(/^(\d+)\/(\d+)$/);
  if (frac) return Number(frac[1]) / Number(frac[2]);
  return null;
}

// Delar "4 ägg och 200 g ris" -> ["4 ägg", "200 g ris"]. Ett kommatecken följt av
// en siffra startar en ny rad, annars är det en beskrivning ("sötpotatis, rå").
export function splitQuery(input: string): string[] {
  return input
    .split(/\n|;|\+|(?:^|[^\p{L}])och(?=[^\p{L}]|$)|,(?=\s*\d)/iu)
    .map((s) => s.trim())
    .filter(Boolean);
}

export function parsePart(text: string): ParsedPart {
  let s = text.toLowerCase().trim();
  // "333g" -> "333 g", "1,5dl" -> "1,5 dl"
  s = s.replace(/(\d)([a-zåäö]+)/g, "$1 $2");
  const tokens = s.split(/\s+/);
  let quantity: number | null = null;
  let unit: string | null = null;
  let i = 0;
  const n = tokens[0] ? parseNumber(tokens[0]) : null;
  if (n != null) {
    quantity = n;
    i = 1;
  }
  if (tokens[i] && UNIT_ALIASES[tokens[i].replace(/\.$/, "")]) {
    unit = tokens[i].replace(/\.$/, "");
    i++;
  }
  const rest = tokens.slice(i).join(" ");
  const foodText = tokenize(applySynonyms(rest)).join(" ");
  return { text: text.trim(), quantity, unit, foodText, state: stateOf(tokenize(rest)) };
}

function pieceWeight(food: Food | null, foodText: string, unit: string | null): [number, string] | null {
  const name = (food?.name ?? foodText).toLowerCase();
  if (unit === "skiva" || unit === "skivor") {
    if (/^ost/.test(name)) return [10, "1 skiva ost ≈ 10 g"];
    if (/^bröd/.test(name)) return [35, "1 brödskiva ≈ 35 g"];
  }
  for (const [re, g, note] of PIECE_GRAMS) if (re.test(name) || re.test(foodText)) return [g, note];
  return null;
}

function gramsPerDl(food: Food | null, foodText: string): number | null {
  const name = (food?.name ?? foodText).toLowerCase();
  for (const [re, g] of GRAMS_PER_DL) if (re.test(name) || re.test(foodText)) return g;
  return null;
}

export function matchPart(part: ParsedPart, chosen?: Food | null, stateOverride?: FoodState): MatchedItem {
  const warnings: string[] = [];
  const state = stateOverride ?? part.state;
  const query = tokenize(part.foodText).filter((t) => !isStateWord(t)).join(" ");
  const hits = query ? searchFoods(query, { state, limit: 8 }) : [];
  const food = chosen ?? hits[0]?.food ?? null;
  const alternatives = hits.map((h) => h.food).filter((f) => f.id !== food?.id);

  const stateAmbiguous = state === "neutral" && query !== "" && hasStateVariants(query);
  if (stateAmbiguous) {
    warnings.push("Ange om vikten gäller rå eller tillagad vara – näringsvärdet per gram skiljer sig mycket.");
  }

  let grams: number | null = null;
  let gramsNote: string | null = null;
  const unitInfo = part.unit ? UNIT_ALIASES[part.unit] : null;
  const qty = part.quantity ?? 1;
  if (unitInfo?.kind === "g") {
    grams = qty * unitInfo.factor;
  } else if (unitInfo?.kind === "dl") {
    const density = gramsPerDl(food, part.foodText);
    if (density) {
      grams = qty * unitInfo.factor * density;
      gramsNote = `${qty} ${part.unit} ≈ ${Math.round(grams)} g (${density} g/dl)`;
    } else {
      warnings.push("Okänd densitet för volymmått – ange vikt i gram.");
    }
  } else {
    const pw = pieceWeight(food, part.foodText, part.unit);
    if (pw) {
      grams = qty * pw[0];
      gramsNote = `${qty} st × ${pw[0]} g = ${Math.round(grams)} g (${pw[1]})`;
    } else if (part.quantity != null && !part.unit) {
      warnings.push("Okänd styckvikt – ange vikt i gram, t.ex. \"150 g\".");
    } else {
      warnings.push("Ingen mängd angiven – ange vikt i gram.");
    }
  }
  if (gramsNote) warnings.push("Uppskattad vikt: " + gramsNote + ".");
  if (!food) warnings.push("Hittade inget matchande livsmedel i Livsmedelsverkets databas.");

  const nutrients = food && grams != null ? scaleNutrients(food.per100g, grams) : {};
  return { ...part, state, food, alternatives, grams, gramsNote, stateAmbiguous, nutrients, warnings };
}

export function analyzeQuery(input: string): MatchedItem[] {
  return splitQuery(input).map((p) => matchPart(parsePart(p)));
}

export function totalOf(items: MatchedItem[]): Nutrients {
  return sumNutrients(items.map((i) => i.nutrients));
}
