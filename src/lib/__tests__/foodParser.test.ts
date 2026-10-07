import { describe, expect, it } from "vitest";
import { analyzeQuery, splitQuery, totalOf } from "../foodParser";

describe("splitQuery", () => {
  it("delar på 'och' men inte på beskrivande kommatecken", () => {
    expect(splitQuery("4 ägg och 200 g ris")).toEqual(["4 ägg", "200 g ris"]);
    expect(splitQuery("333 g sötpotatis, rå")).toEqual(["333 g sötpotatis, rå"]);
    expect(splitQuery("100 g lax, 2 dl ris")).toEqual(["100 g lax", "2 dl ris"]);
  });
});

describe("analyzeQuery", () => {
  it("matchar rå sötpotatis och skalar näringsvärden", () => {
    const [item] = analyzeQuery("333 g sötpotatis, rå");
    expect(item.food?.name).toBe("Sötpotatis rå");
    expect(item.grams).toBe(333);
    expect(item.stateAmbiguous).toBe(false);
    expect(item.nutrients.kcal).toBeCloseTo(71 * 3.33, 1);
    expect(item.nutrients.potassium).toBeCloseTo(486 * 3.33, 1);
  });

  it("skiljer tillagad från rå", () => {
    const [item] = analyzeQuery("333 g sötpotatis kokt");
    expect(item.food?.name).toMatch(/^Sötpotatis kokt/);
  });

  it("uppskattar ägg per styck och flaggar ris utan tillstånd", () => {
    const items = analyzeQuery("4 ägg och 200 g ris");
    expect(items).toHaveLength(2);
    expect(items[0].food?.name).toBe("Ägg rått");
    expect(items[0].grams).toBe(200);
    expect(items[0].gramsNote).toBeTruthy();
    expect(items[1].food?.name.startsWith("Ris")).toBe(true);
    expect(items[1].stateAmbiguous).toBe(true);
    expect(totalOf(items).kcal).toBeGreaterThan(400);
  });

  it("hanterar sammansatta ord och volym", () => {
    expect(analyzeQuery("150g kycklingfilé stekt")[0].food?.name).toMatch(/^Kyckling bröstfilé.*stekt/);
    const [milk] = analyzeQuery("2 dl mjölk");
    expect(milk.food?.name).toMatch(/^Mjölk/);
    expect(milk.grams).toBeCloseTo(206);
    expect(analyzeQuery("100 g havregryn")[0].food?.name).toBe("Havregryn fullkorn");
    expect(analyzeQuery("1 banan")[0].food?.name).toBe("Banan");
    expect(analyzeQuery("200 g nötfärs")[0].food?.name).toMatch(/^Nöt färs rå/);
    expect(analyzeQuery("250 g keso")[0].food?.name).toMatch(/cottage cheese naturell/);
  });
});
