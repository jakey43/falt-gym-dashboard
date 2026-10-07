// Sökning i Livsmedelsverkets livsmedelsdatabas (paketerad som JSON).
import raw from "../data/livsmedelsverket.json";
import type { NutrientKey, Nutrients } from "./nutrients";

export type FoodState = "raw" | "cooked" | "neutral";

export interface Food {
  id: string; // "slv:3765"
  number: number;
  name: string;
  source: "Livsmedelsverket" | "USDA" | "Open Food Facts";
  sourceUrl: string;
  per100g: Nutrients;
  state: FoodState;
  tokens: string[];
}

interface RawDb {
  source: string;
  license: string;
  fetchedAt: string;
  keys: NutrientKey[];
  foods: [number, string, (number | null)[]][];
}

const db = raw as unknown as RawDb;
export const SLV_META = { source: db.source, license: db.license, fetchedAt: db.fetchedAt };

const RAW_WORDS = ["rå", "rått", "råa", "okokt", "okokta", "okokat", "torkade", "torkad", "torr", "torra", "torrt"];
const COOKED_WORDS = [
  "kokt", "kokta", "kokat", "stekt", "stekta", "stekt", "ugnsstekt", "ugnsbakad", "ugnsbakade",
  "bakad", "bakade", "grillad", "grillat", "grillade", "tillagad", "tillagat", "tillagade",
  "wokad", "wokade", "ångkokt", "friterad", "rostad", "ugnsrostad", "värmd", "pocherad",
];
const RAW_SET = new Set(RAW_WORDS);
const COOKED_SET = new Set(COOKED_WORDS);

export function normalize(text: string): string {
  return text
    .toLowerCase()
    .replace(/[(),;:!?"]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function tokenize(text: string): string[] {
  return normalize(text)
    .split(" ")
    .map((t) => t.replace(/\.$/, ""))
    .filter(Boolean);
}

export function stateOf(tokens: string[]): FoodState {
  if (tokens.some((t) => COOKED_SET.has(t))) return "cooked";
  if (tokens.some((t) => RAW_SET.has(t))) return "raw";
  return "neutral";
}

export function isStateWord(t: string): boolean {
  return RAW_SET.has(t) || COOKED_SET.has(t);
}

export const SLV_FOODS: Food[] = db.foods.map(([number, name, values]) => {
  const per100g: Nutrients = {};
  db.keys.forEach((k, i) => (per100g[k] = values[i]));
  const tokens = tokenize(name);
  return {
    id: `slv:${number}`,
    number,
    name,
    source: "Livsmedelsverket",
    sourceUrl: `https://soknaringsinnehall.livsmedelsverket.se/Home/FoodDetails/${number}`,
    per100g,
    state: stateOf(tokens),
    tokens,
  };
});

const BY_NUMBER = new Map(SLV_FOODS.map((f) => [f.number, f]));
export function getSlvFood(number: number): Food | undefined {
  return BY_NUMBER.get(number);
}
export function getFoodById(id: string): Food | undefined {
  if (id.startsWith("slv:")) return BY_NUMBER.get(Number(id.slice(4)));
  return undefined;
}

// Ordgränser som fungerar med å, ä, ö och é (\b gör det inte).
const w = (pattern: string) => new RegExp(`(?<!\\p{L})(?:${pattern})(?!\\p{L})`, "gu");

// Sammansatta ord och vardagsnamn -> databasens namngivning.
const SYNONYMS: [RegExp, string][] = [
  [w("kycklingfil[ée](er)?|kycklingbröst"), "kyckling bröstfilé"],
  [w("kycklinglår"), "kyckling lår"],
  [w("kycklingfärs"), "kyckling färs"],
  [w("nötfärs"), "nöt färs"],
  [w("fläskfärs"), "gris färs"],
  [w("fläskfil[ée]"), "gris filé"],
  [w("oxfil[ée]"), "nöt oxfilé"],
  [w("ryggbiff"), "nöt ryggbiff"],
  [w("entrecote|entrecôte"), "nöt entrecôte"],
  [w("laxfil[ée]"), "lax"],
  [w("keso|(?<!färskost )cottage cheese"), "färskost cottage cheese"],
  [w("kesella"), "kvarg"],
  [w("basmatiris"), "ris basmati"],
  [w("jasminris"), "ris jasmin"],
  [w("fullkornsris|(?<!ris )råris"), "ris råris"],
  [w("fullkornspasta"), "pasta fullkorn"],
  [w("spaghetti|spagetti|makaroner|penne|fusilli"), "pasta"],
  [w("morötter"), "morot"],
  [w("äpplen"), "äpple"],
  [w("bananer"), "banan"],
  [w("apelsiner"), "apelsin"],
  [w("potatisar"), "potatis"],
  [w("sötpotatisar"), "sötpotatis"],
  [w("lättmjölk"), "mjölk fett 0,5%"],
  [w("mellanmjölk"), "mjölk fett 1,5%"],
  [w("standardmjölk|helmjölk"), "mjölk fett 3%"],
  [w("äggvitor"), "äggvita"],
  [w("äggulor"), "äggula"],
  [w("jordnötssmör"), "jordnötssmör"],
  [w("rapsolja"), "rapsolja"],
  [w("grekisk yoghurt"), "yoghurt grekisk"],
  [w("havregrynsgröt|gröt"), "havregrynsgröt"],
  [w("broccolin"), "broccoli"],
];

export function applySynonyms(text: string): string {
  let out = normalize(text);
  for (const [re, rep] of SYNONYMS) out = out.replace(re, rep);
  return out;
}

// Föredragna standardval när en sökning är bred (t.ex. bara "ris").
const PREFERRED: Record<string, { raw?: number; cooked?: number; neutral?: number }> = {
  ris: { raw: 2481, cooked: 2515 },
  pasta: { raw: 845, cooked: 846 },
  ägg: { raw: 1225, cooked: 1233, neutral: 1225 },
  mjölk: { neutral: 123 },
  havregryn: { raw: 702, neutral: 702 },
  kyckling: { raw: 1173, cooked: 1170 },
  lax: { raw: 1255, cooked: 1316 },
  potatis: { raw: 4457, cooked: 5153 },
  sötpotatis: { raw: 3765, cooked: 3772 },
  banan: { neutral: 553 },
  äpple: { neutral: 588 },
  kvarg: { neutral: 3243 },
  olivolja: { neutral: 35 },
  smör: { neutral: 29 },
  nöt: { raw: 951, cooked: 1014 },
  bulgur: { raw: 829, cooked: 830 },
  couscous: { raw: 831, cooked: 832 },
  broccoli: { raw: 325, cooked: 4939, neutral: 325 },
  morot: { raw: 289, cooked: 305, neutral: 289 },
  bröd: { neutral: 202 },
};

const PENALTY_WORDS = [
  "frysvara", "konserv", "kylvara", "restaurang", "storhushåll", "hemlagad", "hemlagade",
  "glutenfri", "glutenfritt", "pulver", "veg", "snabb", "snabbris", "typ",
];

function tokenMatches(q: string, n: string): boolean {
  if (n === q) return true;
  if (q.length >= 3 && n.startsWith(q)) return true;
  if (n.length >= 4 && q.startsWith(n) && q.length - n.length <= 3) return true; // plural: bananer -> banan
  return false;
}

export interface SearchOptions {
  state?: FoodState;
  method?: string;
  limit?: number;
}

export interface SearchHit {
  food: Food;
  score: number;
}

export function searchFoods(query: string, opts: SearchOptions = {}): SearchHit[] {
  const qTokensAll = tokenize(applySynonyms(query));
  const qState = opts.state ?? stateOf(qTokensAll);
  const method = opts.method ?? qTokensAll.find((t) => COOKED_SET.has(t));
  const qTokens = qTokensAll.filter((t) => !isStateWord(t) && t !== "m" && t !== "med" && t !== "och");
  if (qTokens.length === 0) return [];

  const head = qTokens[0];
  const pref = PREFERRED[head];
  const prefNumber =
    pref && qTokens.length <= 2
      ? qState === "raw"
        ? pref.raw ?? pref.neutral
        : qState === "cooked"
          ? pref.cooked ?? pref.neutral
          : pref.neutral ?? pref.raw
      : undefined;

  const hits: SearchHit[] = [];
  for (const food of SLV_FOODS) {
    const nt = food.tokens;
    let matched = 0;
    const used = new Set<number>();
    for (const q of qTokens) {
      const idx = nt.findIndex((n, i) => !used.has(i) && tokenMatches(q, n));
      if (idx >= 0) {
        used.add(idx);
        matched++;
      }
    }
    if (matched < qTokens.length) continue;

    let score = 100;
    if (nt[0] === head || (nt[0].length >= 4 && head.startsWith(nt[0]) && head.length - nt[0].length <= 3)) score += 40;
    else if (tokenMatches(head, nt[0])) score += 12;
    else score -= 10;
    const extra = nt.filter((t, i) => !used.has(i) && !isStateWord(t)).length;
    score -= extra * 4;
    if (nt.includes("m") && !qTokensAll.includes("med") && !qTokensAll.includes("m")) score -= 25;
    for (const p of PENALTY_WORDS) if (nt.includes(p) && !qTokens.includes(p)) score -= 8;

    if (qState !== "neutral") {
      if (food.state === qState) score += 25;
      else if (food.state !== "neutral") score -= 45;
      if (method && nt.includes(method)) score += 12;
    } else if (food.state === "neutral") {
      score += 4;
    }
    if (prefNumber === food.number) score += 30;
    hits.push({ food, score });
  }
  hits.sort((a, b) => b.score - a.score || a.food.name.length - b.food.name.length);
  return hits.slice(0, opts.limit ?? 8);
}

// Finns både en uttryckligen rå/okokt och en tillagad variant av samma livsmedel?
// ("torkad" räknas inte – torkad banan är inte "rå banan".)
const STRICT_RAW = new Set(["rå", "rått", "råa", "okokt", "okokta", "okokat"]);
export function hasStateVariants(query: string): boolean {
  const q = tokenize(query).filter((t) => !isStateWord(t)).join(" ");
  const head = tokenize(q)[0];
  const sameHead = (f: Food) => f.tokens[0] === head || f.tokens[0].startsWith(head);
  const rawHit = searchFoods(q, { state: "raw", limit: 3 }).some(
    (h) => sameHead(h.food) && h.food.tokens.some((t) => STRICT_RAW.has(t)),
  );
  const cookedHit = searchFoods(q, { state: "cooked", limit: 3 }).some(
    (h) => sameHead(h.food) && h.food.state === "cooked",
  );
  return rawHit && cookedHit;
}
