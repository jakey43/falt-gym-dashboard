import { Link, useSearchParams } from "react-router-dom";
import { useMemo, useState } from "react";
import { useStore } from "../lib/store";
import { addDays, formatLong, formatShort, formatWeekday, todayKey } from "../lib/date";
import { averageMacros, dayTotals, rangeTotals, referenceFor } from "../lib/nutrition";
import type { LifesumEntry, MacroKey } from "../lib/nutrition";
import { MICRO_KEYS, NUTRIENT_BY_KEY, formatNumber } from "../lib/nutrients";
import { BarChart, ChartFrame } from "../components/charts";
import { CardHead, GoalMeter, SectionTitle, ThinMeter } from "../components/ui";
import { IconTrash } from "../components/icons";

const MACROS: { key: MacroKey; label: string; unit: string; color: string; gradient: string }[] = [
  { key: "kcal", label: "Kalorier", unit: "kcal", color: "var(--orange)", gradient: "linear-gradient(90deg, #f6e1a6, #f3b98e 55%, var(--orange))" },
  { key: "protein", label: "Protein", unit: "g", color: "var(--blue)", gradient: "linear-gradient(90deg, #dbe6f4, #9dbde4 60%, var(--blue))" },
  { key: "carbs", label: "Kolhydrater", unit: "g", color: "var(--yellow)", gradient: "linear-gradient(90deg, #f8eecb, #f0cf74 60%, var(--yellow))" },
  { key: "fat", label: "Fett", unit: "g", color: "var(--pink)", gradient: "linear-gradient(90deg, #f7e2ea, #eaa6c2 60%, var(--pink))" },
  { key: "fiber", label: "Fiber", unit: "g", color: "var(--green)", gradient: "linear-gradient(90deg, #e1eedf, #9fcca9 60%, var(--green))" },
];

const emptyForm = { kcal: "", protein: "", carbs: "", fat: "", fiber: "" };

export default function Nutrition() {
  const { data, update } = useStore();
  const today = todayKey();
  const [params, setParams] = useSearchParams();
  const date = params.get("dag") ?? today;
  const setDate = (d: string) => setParams(d === today ? {} : { dag: d });
  const day = data.days[date];
  const totals = dayTotals(day, date);
  const g = data.goals;

  function removeFood(id: string) {
    update((d) => {
      const dl = d.days[date];
      if (!dl) return d;
      return { ...d, days: { ...d.days, [date]: { ...dl, foods: dl.foods.filter((f) => f.id !== id) } } };
    });
  }

  const last14 = useMemo(() => rangeTotals(data.days, today, 14), [data.days, today]);
  const thisWeek = averageMacros(last14.slice(7));
  const prevWeek = averageMacros(last14.slice(0, 7));

  return (
    <>
      <div className="page-head">
        <div>
          <h1 className="page-title">Kost</h1>
          <div className="page-sub">{formatLong(date)}</div>
        </div>
        <div className="row">
          <button className="chip" onClick={() => setDate(addDays(date, -1))} aria-label="Föregående dag">
            ←
          </button>
          <input className="input" type="date" value={date} max={today} onChange={(e) => e.target.value && setDate(e.target.value)} style={{ width: 170, minHeight: 36 }} aria-label="Välj datum" />
          <button className="chip" onClick={() => setDate(addDays(date, 1))} disabled={date >= today} aria-label="Nästa dag">
            →
          </button>
          {date !== today && (
            <button className="chip" onClick={() => setDate(today)}>
              Idag
            </button>
          )}
        </div>
      </div>

      <div className="grid">
        <LifesumForm key={date} date={date} />

        <div className="card span-7">
          <CardHead
            label="Mål mot faktiskt"
            sub={totals.macroSource === "lifesum" ? "makron från Lifesum" : totals.macroSource === "matfrågor" ? "makron summerade från matfrågor" : "inget loggat"}
            link={{ to: "/data#mal", text: "Ändra mål" }}
          />
          <div className="stack">
            {MACROS.map((m) => (
              <div key={m.key}>
                <div className="label" style={{ marginBottom: 6 }}>
                  {m.label}
                </div>
                <GoalMeter value={totals.macros[m.key]} goal={g[m.key]} unit={m.unit} gradient={m.gradient} />
              </div>
            ))}
          </div>
        </div>

        <div className="card span-12">
          <CardHead
            label="Livsmedel från matfrågor"
            sub={`${totals.foodCount} st · med fullständiga näringsvärden`}
            link={{ to: `/mat?dag=${date}`, text: "Lägg till" }}
          />
          {day?.foods.length ? (
            <div className="table-wrap">
              <table className="data">
                <thead>
                  <tr>
                    <th>Livsmedel</th>
                    <th className="num">Mängd</th>
                    <th className="num">kcal</th>
                    <th className="num">Protein</th>
                    <th className="num">Kolh.</th>
                    <th className="num">Fett</th>
                    <th className="num">Fiber</th>
                    <th />
                  </tr>
                </thead>
                <tbody>
                  {day.foods.map((f) => (
                    <tr key={f.id}>
                      <td>
                        <div style={{ fontWeight: 600 }}>{f.foodName}</div>
                        <div className="source-line">
                          ”{f.text}” ·{" "}
                          <a href={f.sourceUrl} target="_blank" rel="noreferrer">
                            {f.source}
                          </a>
                        </div>
                      </td>
                      <td className="num">{formatNumber(f.grams)} g</td>
                      <td className="num">{formatNumber(f.nutrients.kcal ?? 0)}</td>
                      <td className="num">{formatNumber(f.nutrients.protein ?? 0, 1)}</td>
                      <td className="num">{formatNumber(f.nutrients.carbs ?? 0, 1)}</td>
                      <td className="num">{formatNumber(f.nutrients.fat ?? 0, 1)}</td>
                      <td className="num">{formatNumber(f.nutrients.fiber ?? 0, 1)}</td>
                      <td className="num">
                        <button className="chip" style={{ minHeight: 30, padding: "0 8px" }} onClick={() => removeFood(f.id)} aria-label={`Ta bort ${f.foodName}`}>
                          <IconTrash />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <p className="muted">
              Inga livsmedel loggade den här dagen. Använd <Link to={`/mat?dag=${date}`}>Matfråga</Link> för att få vitaminer och mineraler.
            </p>
          )}
        </div>

        <div className="card span-12">
          <CardHead
            label="Vitaminer & mineraler"
            sub={`endast från matfrågor · mot referensvärden (NNR 2023, ${g.profile})`}
          />
          {totals.foodCount === 0 ? (
            <p className="muted">Lifesum lämnar inte ut mikronäringsämnen. Logga måltider via Matfråga för att fylla den här vyn.</p>
          ) : (
            <div className="nutri-grid" style={{ gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))", gap: "12px 24px" }}>
              {MICRO_KEYS.filter((k) => k !== "sodium").map((k) => {
                const info = NUTRIENT_BY_KEY[k];
                const v = totals.micros[k] ?? null;
                const ref = referenceFor(g, k);
                const ratio = v != null && ref ? v / ref : null;
                return (
                  <div key={k}>
                    <div className="spread small" style={{ marginBottom: 5 }}>
                      <span style={{ fontWeight: 600 }}>{info.label}</span>
                      <span className="tnum">
                        {v == null ? "–" : formatNumber(v, info.decimals)} <span className="muted">{ref ? `/ ${formatNumber(ref, info.decimals)}` : ""} {info.unit}</span>
                      </span>
                    </div>
                    <ThinMeter ratio={ratio} color={info.group === "vitamin" ? "var(--orange)" : "var(--blue)"} />
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      <SectionTitle color="var(--blue)">Senaste två veckorna</SectionTitle>
      <div className="grid">
        <div className="card span-8">
          <CardHead label="Kalorier per dag" sub={`streckad linje = mål ${formatNumber(g.kcal)} kcal`} />
          <ChartFrame
            table={{
              head: ["Dag", "kcal", "Protein", "Kolh.", "Fett"],
              rows: last14.map((t) => [
                formatShort(t.date),
                t.macros.kcal == null ? "–" : formatNumber(t.macros.kcal),
                t.macros.protein == null ? "–" : formatNumber(t.macros.protein),
                t.macros.carbs == null ? "–" : formatNumber(t.macros.carbs),
                t.macros.fat == null ? "–" : formatNumber(t.macros.fat),
              ]),
            }}
          >
            <BarChart
              ariaLabel="Kalorier per dag senaste 14 dagarna"
              color="var(--orange)"
              goal={g.kcal}
              goalLabel="mål"
              bars={last14.map((t) => ({
                key: t.date,
                label: `${formatWeekday(t.date)} ${Number(t.date.slice(8))}`,
                value: t.macros.kcal,
                tip: t.macros.protein != null ? `${formatNumber(t.macros.protein)} g protein` : undefined,
              }))}
              format={(v) => formatNumber(v)}
            />
          </ChartFrame>
        </div>
        <div className="card tint-yellow span-4">
          <CardHead label="Veckosnitt" sub={`${thisWeek.days} av 7 dagar loggade`} />
          <table className="data">
            <thead>
              <tr>
                <th />
                <th className="num">Denna v.</th>
                <th className="num">Förra v.</th>
                <th className="num">Mål</th>
              </tr>
            </thead>
            <tbody>
              {MACROS.map((m) => (
                <tr key={m.key}>
                  <td>{m.label}</td>
                  <td className="num">
                    <strong>{thisWeek[m.key] == null ? "–" : formatNumber(thisWeek[m.key]!)}</strong>
                  </td>
                  <td className="num muted">{prevWeek[m.key] == null ? "–" : formatNumber(prevWeek[m.key]!)}</td>
                  <td className="num muted">{formatNumber(g[m.key])}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <p className="sublabel" style={{ marginTop: 10 }}>Snitt över dagar med loggad data (senaste 7 resp. 7 dagarna innan).</p>
        </div>
        <div className="card span-12">
          <CardHead label="Protein per dag" sub={`mål ${g.protein} g`} />
          <BarChart
            ariaLabel="Protein per dag senaste 14 dagarna"
            color="var(--blue)"
            goal={g.protein}
            goalLabel="mål"
            height={160}
            bars={last14.map((t) => ({ key: t.date, label: `${formatWeekday(t.date)} ${Number(t.date.slice(8))}`, value: t.macros.protein }))}
            format={(v) => `${formatNumber(v)} g`}
          />
        </div>
      </div>
    </>
  );
}

function LifesumForm({ date }: { date: string }) {
  const { data, update } = useStore();
  const ls = data.days[date]?.lifesum;
  const [form, setForm] = useState(() =>
    ls
      ? {
          kcal: ls.kcal?.toString() ?? "",
          protein: ls.protein?.toString() ?? "",
          carbs: ls.carbs?.toString() ?? "",
          fat: ls.fat?.toString() ?? "",
          fiber: ls.fiber?.toString() ?? "",
        }
      : emptyForm,
  );
  const [saved, setSaved] = useState(false);

  const parse = (s: string) => {
    const n = Number(s.replace(",", "."));
    return s.trim() === "" || !Number.isFinite(n) ? null : n;
  };

  function saveLifesum(e: React.FormEvent) {
    e.preventDefault();
    const entry: LifesumEntry = { kcal: parse(form.kcal), protein: parse(form.protein), carbs: parse(form.carbs), fat: parse(form.fat), fiber: parse(form.fiber) };
    const empty = Object.values(entry).every((v) => v == null);
    update((d) => ({
      ...d,
      days: { ...d.days, [date]: { date, foods: d.days[date]?.foods ?? [], lifesum: empty ? null : entry } },
    }));
    setSaved(true);
  }

  return (
    <form className="card tint-blue span-5" onSubmit={saveLifesum}>
      <CardHead label="Från Lifesum" sub="skriv av dagens totalsumma i dagboken" />
      <div className="form-grid">
        {MACROS.map((m) => (
          <label key={m.key} className="field">
            <span className="label">
              {m.label} ({m.unit})
            </span>
            <input
              className="input"
              inputMode="decimal"
              value={form[m.key]}
              placeholder={m.key === "fiber" ? "valfritt" : ""}
              onChange={(e) => {
                setForm({ ...form, [m.key]: e.target.value });
                setSaved(false);
              }}
            />
          </label>
        ))}
      </div>
      <div className="row" style={{ marginTop: 14 }}>
        <button className="btn" type="submit">
          Spara dagen
        </button>
        {saved && <span className="small">Sparat ✓</span>}
      </div>
      <p className="small" style={{ marginTop: 12, color: "var(--ink-2)" }}>
        Lifesum har inget öppet API, så makron förs in för hand. När Lifesum-värden finns används de för dagens makron;
        matfrågor bidrar då bara med vitaminer och mineraler.
      </p>
    </form>
  );
}
