import { useDeferredValue, useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { useStore } from "../lib/store";
import { formatLong, todayKey } from "../lib/date";
import { SLV_META } from "../lib/foodDb";
import type { Food, FoodState } from "../lib/foodDb";
import { matchPart, parsePart, splitQuery } from "../lib/foodParser";
import type { MatchedItem } from "../lib/foodParser";
import { lookupBarcode, searchOpenFoodFacts, searchUsda } from "../lib/externalFood";
import { NUTRIENTS, NUTRIENT_BY_KEY, formatNumber, scaleNutrients, sumNutrients } from "../lib/nutrients";
import type { NutrientKey } from "../lib/nutrients";
import { newId, referenceFor } from "../lib/nutrition";
import type { FoodEntry } from "../lib/nutrition";
import { Blob, CardHead } from "../components/ui";

const EXAMPLES = ["333 g sötpotatis, rå", "4 ägg och 200 g ris", "150 g kycklingfilé stekt", "2 dl havregryn och 3 dl mjölk", "1 banan + 250 g keso"];
const HEADLINE: NutrientKey[] = ["kcal", "protein", "carbs", "fat", "fiber"];
const SHOW_MICROS: NutrientKey[] = ["magnesium", "potassium", "vitC", "vitA", "calcium", "iron", "zinc", "vitD", "vitE", "vitB6", "vitB12", "folate", "thiamin", "riboflavin", "niacin", "phosphorus", "selenium", "iodine", "sodium", "salt", "sugar", "satFat"];

interface Override {
  food?: Food;
  state?: FoodState;
  grams?: number;
}

export default function FoodQuery() {
  const { data, update } = useStore();
  const [params] = useSearchParams();
  const [query, setQuery] = useState("");
  const deferred = useDeferredValue(query);
  const [overrides, setOverrides] = useState<Record<string, Override>>({});
  const [date, setDate] = useState(params.get("dag") ?? todayKey());
  const [added, setAdded] = useState<string | null>(null);

  const parts = useMemo(() => splitQuery(deferred).map(parsePart), [deferred]);
  const items = useMemo(
    () =>
      parts.map((p, i) => {
        const key = `${i}|${p.text}`;
        const o = overrides[key];
        let m = matchPart(p, o?.food ?? null, o?.state);
        if (o?.grams != null && m.food) {
          m = { ...m, grams: o.grams, gramsNote: null, warnings: m.warnings.filter((w) => !w.startsWith("Uppskattad") && !w.includes("ange vikt")), nutrients: scaleNutrients(m.food.per100g, o.grams) };
        }
        return { key, item: m };
      }),
    [parts, overrides],
  );
  const total = sumNutrients(items.map((i) => i.item.nutrients));
  const ready = items.filter((i) => i.item.food && i.item.grams != null);

  const setOv = (key: string, o: Override) => setOverrides((prev) => ({ ...prev, [key]: { ...prev[key], ...o } }));

  function addToDiary() {
    const entries: FoodEntry[] = ready.map(({ item }) => ({
      id: newId(),
      text: item.text,
      foodId: item.food!.id,
      foodName: item.food!.name,
      source: item.food!.source,
      sourceUrl: item.food!.sourceUrl,
      grams: item.grams!,
      nutrients: item.nutrients,
      addedAt: new Date().toISOString(),
    }));
    update((d) => {
      const dl = d.days[date] ?? { date, lifesum: null, foods: [] };
      return { ...d, days: { ...d.days, [date]: { ...dl, foods: [...dl.foods, ...entries] } } };
    });
    setAdded(`${entries.length} livsmedel tillagda ${date === todayKey() ? "idag" : formatLong(date)}.`);
  }

  return (
    <>
      <div className="page-head">
        <div>
          <h1 className="page-title">Matfråga</h1>
          <div className="page-sub">Skriv vad du ätit och få näringsvärdena, med källa.</div>
        </div>
      </div>

      <div className="card tint-lavender">
        <Blob color="var(--yellow)" style={{ width: 200, right: -70, top: -90, opacity: 0.55 }} />
        <Blob color="var(--pink)" variant={1} style={{ width: 120, right: 60, top: -70, opacity: 0.4 }} />
        <label className="label" htmlFor="q">
          Vad har du ätit?
        </label>
        <textarea
          id="q"
          className="input query-box"
          placeholder="t.ex. 333 g sötpotatis, rå"
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setOverrides({});
            setAdded(null);
          }}
          rows={2}
          autoFocus
        />
        <div className="chips" style={{ marginTop: 6 }}>
          {EXAMPLES.map((ex) => (
            <button
              key={ex}
              className="chip"
              style={{ background: "rgba(255,255,255,.6)" }}
              onClick={() => {
                setQuery(ex);
                setOverrides({});
                setAdded(null);
              }}
            >
              {ex}
            </button>
          ))}
        </div>
        <p className="small" style={{ marginTop: 12, color: "var(--ink-2)", marginBottom: 0 }}>
          Ange gärna vikt i gram och om den gäller <strong>rå</strong> eller <strong>tillagad</strong> vara – 100 g okokt ris ger ungefär tre gånger så mycket energi som 100 g kokt.
          Separera flera livsmedel med ”och”, ”+” eller ny rad.
        </p>
      </div>

      {items.length > 0 && (
        <div className="grid" style={{ marginTop: 14 }}>
          <div className="card span-7">
            <CardHead label="Tolkning" sub={`${items.length} ${items.length === 1 ? "rad" : "rader"} · ändra om något blev fel`} />
            {items.map(({ key, item }) => (
              <FoodRow
                key={key}
                item={item}
                usdaKey={data.settings.usdaApiKey}
                onState={(s) => setOv(key, { state: s, food: undefined })}
                onFood={(f) => setOv(key, { food: f })}
                onGrams={(g) => setOv(key, { grams: g })}
              />
            ))}
          </div>

          <div className="span-5" style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            <div className="card tint-blue">
              <CardHead label="Totalt" sub={`${ready.length} av ${items.length} rader beräknade`} />
              <div className="big-num">
                {formatNumber(total.kcal ?? 0)}
                <span className="unit">kcal</span>
              </div>
              <div className="stat-row" style={{ marginTop: 16, gridTemplateColumns: "repeat(auto-fit, minmax(88px, 1fr))" }}>
                {HEADLINE.slice(1).map((k) => (
                  <div key={k}>
                    <span className="label" style={{ fontSize: 10 }}>
                      {NUTRIENT_BY_KEY[k].label}
                    </span>
                    <div className="mid-num" style={{ fontSize: 24 }}>
                      {formatNumber(total[k] ?? 0, k === "fiber" ? 1 : 0)}
                      <span className="unit">g</span>
                    </div>
                  </div>
                ))}
              </div>
              <div className="divider" style={{ background: "rgba(0,0,0,.08)" }} />
              <div className="row">
                <input className="input" type="date" value={date} max={todayKey()} onChange={(e) => e.target.value && setDate(e.target.value)} style={{ width: 160, minHeight: 44 }} aria-label="Datum för dagboken" />
                <button className="btn" disabled={ready.length === 0} onClick={addToDiary}>
                  Lägg till i dagboken
                </button>
              </div>
              {added && (
                <p className="small" style={{ marginBottom: 0 }}>
                  {added} <Link to={date === todayKey() ? "/kost" : `/kost?dag=${date}`}>Visa dagen →</Link>
                </p>
              )}
            </div>

            <div className="card">
              <CardHead label="Vitaminer & mineraler" sub="% av dagligt referensvärde" />
              <div>
                {SHOW_MICROS.map((k) => {
                  const info = NUTRIENT_BY_KEY[k];
                  const v = total[k];
                  const ref = referenceFor(data.goals, k);
                  const missing = items.some(({ item }) => item.food && item.food.per100g[k] == null);
                  return (
                    <div key={k} className="nutri-row">
                      <span>{info.label}</span>
                      <span>
                        <strong>{v == null ? "–" : formatNumber(v, info.decimals)}</strong> <span className="muted">{info.unit}</span>
                        {ref && v != null && <span className="muted"> · {Math.round((v / ref) * 100)} %</span>}
                        {missing && <span title="Värde saknas för minst ett livsmedel" className="muted"> *</span>}
                      </span>
                    </div>
                  );
                })}
              </div>
              <p className="sublabel" style={{ marginTop: 10 }}>* värde saknas för minst ett livsmedel</p>
            </div>
          </div>
        </div>
      )}

      <p className="small muted" style={{ marginTop: 22 }}>
        Källa: {SLV_META.source} (hämtad {SLV_META.fetchedAt}, licens {SLV_META.license}). Värden per 100 g ätlig del.
        Reservkällor: USDA FoodData Central och Open Food Facts. Styckvikter och volymomräkningar är uppskattningar och visas alltid.
      </p>
    </>
  );
}

function FoodRow({
  item,
  usdaKey,
  onState,
  onFood,
  onGrams,
}: {
  item: MatchedItem;
  usdaKey: string;
  onState: (s: FoodState) => void;
  onFood: (f: Food) => void;
  onGrams: (g: number) => void;
}) {
  const [more, setMore] = useState(false);
  const f = item.food;
  return (
    <div className="food-item">
      <div className="spread" style={{ alignItems: "flex-start" }}>
        <div style={{ minWidth: 0, flex: 1 }}>
          <div className="sublabel">”{item.text}”</div>
          <div className="display" style={{ fontSize: 22, marginTop: 4 }}>
            {f ? f.name : "Ingen träff"}
          </div>
          {f && (
            <div className="source-line" style={{ marginTop: 3 }}>
              <a href={f.sourceUrl} target="_blank" rel="noreferrer">
                {f.source} {f.source === "Livsmedelsverket" ? `#${f.number}` : ""}
              </a>{" "}
              · {formatNumber(f.per100g.kcal ?? 0)} kcal/100 g
            </div>
          )}
        </div>
        <label className="field" style={{ width: 110, flex: "none" }}>
          <span className="sublabel">Gram</span>
          <input
            className="input"
            inputMode="decimal"
            value={item.grams != null ? String(Math.round(item.grams * 10) / 10) : ""}
            placeholder="?"
            onChange={(e) => {
              const n = Number(e.target.value.replace(",", "."));
              if (Number.isFinite(n) && n >= 0) onGrams(n);
            }}
          />
        </label>
      </div>

      {(item.stateAmbiguous || item.state !== "neutral") && (
        <div className="row" style={{ marginTop: 10 }} role="group" aria-label="Rå eller tillagad">
          <span className="sublabel">Vikten gäller</span>
          {(["raw", "cooked"] as const).map((s) => (
            <button key={s} className="chip" aria-pressed={item.state === s} onClick={() => onState(s)}>
              {s === "raw" ? "Rå / okokt" : "Tillagad"}
            </button>
          ))}
        </div>
      )}

      {item.warnings.length > 0 && (
        <div className="stack" style={{ marginTop: 10 }}>
          {item.warnings.map((w) => (
            <div key={w} className={`notice${w.startsWith("Uppskattad") ? " info" : ""}`}>
              {w}
            </div>
          ))}
        </div>
      )}

      {f && item.grams != null && (
        <div className="row small tnum" style={{ marginTop: 10, gap: 14 }}>
          {HEADLINE.map((k) => (
            <span key={k}>
              <strong>{formatNumber(item.nutrients[k] ?? 0, k === "kcal" ? 0 : 1)}</strong> <span className="muted">{k === "kcal" ? "kcal" : `g ${NUTRIENT_BY_KEY[k].label.toLowerCase()}`}</span>
            </span>
          ))}
        </div>
      )}

      <div className="row" style={{ marginTop: 10 }}>
        {item.alternatives.length > 0 && (
          <select
            className="select"
            style={{ maxWidth: 340, minHeight: 38, fontSize: 14 }}
            value=""
            onChange={(e) => {
              const alt = item.alternatives.find((a) => a.id === e.target.value);
              if (alt) onFood(alt);
            }}
            aria-label="Byt livsmedel"
          >
            <option value="">Byt livsmedel…</option>
            {item.alternatives.map((a) => (
              <option key={a.id} value={a.id}>
                {a.name}
              </option>
            ))}
          </select>
        )}
        <button className="table-toggle" onClick={() => setMore((m) => !m)}>
          {more ? "Stäng" : "Sök i fler källor"}
        </button>
      </div>
      {more && <ExternalSearch initial={item.foodText} usdaKey={usdaKey} onPick={(food) => { onFood(food); setMore(false); }} />}
    </div>
  );
}

function ExternalSearch({ initial, usdaKey, onPick }: { initial: string; usdaKey: string; onPick: (f: Food) => void }) {
  const [q, setQ] = useState(initial);
  const [results, setResults] = useState<Food[]>([]);
  const [status, setStatus] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function run(kind: "off" | "usda" | "barcode") {
    setBusy(true);
    setStatus(null);
    setResults([]);
    try {
      let r: Food[] = [];
      if (kind === "usda") r = await searchUsda(q, usdaKey || "DEMO_KEY");
      else if (kind === "off") r = await searchOpenFoodFacts(q);
      else {
        const one = await lookupBarcode(q.replace(/\D/g, ""));
        r = one ? [one] : [];
      }
      setResults(r);
      if (!r.length) setStatus("Inga träffar.");
    } catch (e) {
      setStatus(e instanceof Error ? e.message : "Något gick fel.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="card flat" style={{ marginTop: 10, padding: 14 }}>
      <input className="input" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Sökord eller streckkod" />
      <div className="row" style={{ marginTop: 8 }}>
        <button className="btn small secondary" disabled={busy} onClick={() => run("off")}>
          Open Food Facts
        </button>
        <button className="btn small secondary" disabled={busy} onClick={() => run("barcode")}>
          Streckkod
        </button>
        <button className="btn small secondary" disabled={busy} onClick={() => run("usda")} title="USDA söker på engelska, t.ex. 'sweet potato raw'">
          USDA (engelska)
        </button>
      </div>
      {!usdaKey && <p className="sublabel" style={{ marginTop: 8 }}>USDA använder en delad demonyckel med låg gräns – lägg in en egen gratisnyckel under Data.</p>}
      {busy && <p className="small muted">Söker…</p>}
      {status && <p className="small">{status}</p>}
      {results.length > 0 && (
        <ul className="list" style={{ marginTop: 8 }}>
          {results.map((r) => (
            <li key={r.id} className="list-row">
              <div style={{ minWidth: 0 }}>
                <div style={{ fontWeight: 600 }}>{r.name}</div>
                <div className="source-line">
                  {r.source} · {formatNumber(r.per100g.kcal ?? 0)} kcal · {formatNumber(r.per100g.protein ?? 0, 1)} g protein /100 g ·{" "}
                  {NUTRIENTS.filter((n) => r.per100g[n.key] != null).length} näringsvärden
                </div>
              </div>
              <button className="btn small" onClick={() => onPick(r)}>
                Välj
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
