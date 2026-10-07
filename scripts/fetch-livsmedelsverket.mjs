// Hämtar Livsmedelsverkets livsmedelsdatabas (CC BY 4.0) och sparar en kompakt
// JSON-fil som appen paketerar. Kör: npm run data:slv
import { writeFile } from "node:fs/promises";

const BASE = "https://dataportal.livsmedelsverket.se/livsmedel/api/v1";
const OUT = new URL("../src/data/livsmedelsverket.json", import.meta.url);

// Intern nyckel -> [euroFIR-kod, enhet] (enheten behövs för att skilja kJ/kcal)
const NUTRIENTS = {
  kcal: ["ENERC", "kcal"],
  protein: ["PROT"],
  carbs: ["CHO"],
  fat: ["FAT"],
  fiber: ["FIBT"],
  sugar: ["SUGAR"],
  satFat: ["FASAT"],
  salt: ["NACL"],
  sodium: ["NA"],
  potassium: ["K"],
  magnesium: ["MG"],
  calcium: ["CA"],
  iron: ["FE"],
  zinc: ["ZN"],
  phosphorus: ["P"],
  iodine: ["ID"],
  selenium: ["SE"],
  vitA: ["VITA"],
  vitD: ["VITD"],
  vitE: ["VITE"],
  vitC: ["VITC"],
  thiamin: ["THIACLHCL"],
  riboflavin: ["RIBF"],
  niacin: ["NIA"],
  vitB6: ["VITB6"],
  vitB12: ["VITB12"],
  folate: ["FOL"],
};
const KEYS = Object.keys(NUTRIENTS);

async function getJson(url, tries = 4) {
  for (let i = 0; ; i++) {
    try {
      const res = await fetch(url);
      if (!res.ok) throw new Error(`${res.status} ${url}`);
      return await res.json();
    } catch (err) {
      if (i >= tries) throw err;
      await new Promise((r) => setTimeout(r, 1000 * 2 ** i));
    }
  }
}

const list = await getJson(`${BASE}/livsmedel?offset=0&limit=5000&sprak=1`);
const foods = list.livsmedel;
console.log(`${foods.length} livsmedel, hämtar näringsvärden…`);

const rows = new Array(foods.length);
let next = 0;
let done = 0;
async function worker() {
  while (next < foods.length) {
    const i = next++;
    const f = foods[i];
    const values = await getJson(`${BASE}/livsmedel/${f.nummer}/naringsvarden?sprak=1`);
    const row = KEYS.map((key) => {
      const [code, unit] = NUTRIENTS[key];
      const v = values.find((n) => n.euroFIRkod === code && (!unit || n.enhet === unit));
      return v ? Math.round(v.varde * 1000) / 1000 : null;
    });
    rows[i] = [f.nummer, f.namn.trim(), row];
    if (++done % 250 === 0) console.log(`  ${done}/${foods.length}`);
  }
}
await Promise.all(Array.from({ length: 8 }, worker));

const data = {
  source: "Livsmedelsverkets livsmedelsdatabas",
  license: "CC BY 4.0",
  url: "https://www.livsmedelsverket.se/om-oss/psidata/livsmedelsdatabasen",
  fetchedAt: new Date().toISOString().slice(0, 10),
  per: "100 g ätlig del",
  keys: KEYS,
  foods: rows,
};
await writeFile(OUT, JSON.stringify(data));
console.log(`Sparade ${rows.length} livsmedel till ${OUT.pathname}`);
