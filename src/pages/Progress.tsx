import { useMemo, useState } from "react";
import { useStore } from "../lib/store";
import { addDays, daysBetween, formatShort, isoWeek, relativeDay, todayKey } from "../lib/date";
import { fmtKg, prTimeline, weeklySummaries } from "../lib/training";
import { averageMacros, rangeTotals } from "../lib/nutrition";
import { formatNumber } from "../lib/nutrients";
import { BarChart, ChartFrame, LineChart } from "../components/charts";
import { CardHead, SectionTitle } from "../components/ui";
import { IconTrash } from "../components/icons";

// Lutning (kg per dag) med minsta kvadrat.
function slopePerDay(points: { date: string; kg: number }[]): number | null {
  if (points.length < 3) return null;
  const x0 = points[0].date;
  const xs = points.map((p) => daysBetween(x0, p.date));
  const ys = points.map((p) => p.kg);
  const mx = xs.reduce((a, b) => a + b, 0) / xs.length;
  const my = ys.reduce((a, b) => a + b, 0) / ys.length;
  let num = 0;
  let den = 0;
  xs.forEach((x, i) => {
    num += (x - mx) * (ys[i] - my);
    den += (x - mx) ** 2;
  });
  return den ? num / den : null;
}

export default function Progress() {
  const { data, workouts, update } = useStore();
  const today = todayKey();
  const [kg, setKg] = useState("");
  const [date, setDate] = useState(today);

  const weights = useMemo(() => [...data.weights].sort((a, b) => a.date.localeCompare(b.date)), [data.weights]);
  const prs = useMemo(() => prTimeline(workouts), [workouts]);
  const weeks = useMemo(() => weeklySummaries(workouts, data.overrides, 26, today), [workouts, data.overrides, today]);
  const current = weights[weights.length - 1];

  const last28 = weights.filter((w) => w.date >= addDays(today, -28));
  const slope = slopePerDay(last28);
  const nutri7 = averageMacros(rangeTotals(data.days, today, 7));
  const vol4 = weeks.slice(-4).reduce((a, w) => a + w.volume, 0);
  const volPrev4 = weeks.slice(-8, -4).reduce((a, w) => a + w.volume, 0);
  const sess4 = weeks.slice(-4).reduce((a, w) => a + w.sessions, 0) / 4;
  const sessPrev4 = weeks.slice(-8, -4).reduce((a, w) => a + w.sessions, 0) / 4;
  const prs30 = prs.filter((p) => p.date >= addDays(today, -30)).length;

  function addWeight(e: React.FormEvent) {
    e.preventDefault();
    const n = Number(kg.replace(",", "."));
    if (!Number.isFinite(n) || n < 20 || n > 400) return;
    update((d) => ({ ...d, weights: [...d.weights.filter((w) => w.date !== date), { date, kg: n }] }));
    setKg("");
  }

  const trends: { label: string; value: string; note: string; color: string }[] = [];
  if (slope != null) {
    const perWeek = slope * 7;
    trends.push({
      label: "Vikttrend",
      value: `${perWeek > 0 ? "+" : ""}${formatNumber(perWeek, 2)} kg/v`,
      note: Math.abs(perWeek) < 0.1 ? "i stort sett stabil senaste 4 v." : perWeek > 0 ? "ökar senaste 4 v." : "minskar senaste 4 v.",
      color: "var(--pink)",
    });
  }
  if (nutri7.protein != null && current) {
    const perKg = nutri7.protein / current.kg;
    trends.push({
      label: "Protein per kg",
      value: `${formatNumber(perKg, 1)} g/kg`,
      note: perKg < 1.6 ? "under ~1,6 g/kg som ofta rekommenderas vid styrketräning" : "inom det vanliga intervallet 1,6–2,2 g/kg",
      color: "var(--blue)",
    });
  }
  if (nutri7.kcal != null) {
    const diff = nutri7.kcal - data.goals.kcal;
    trends.push({
      label: "Energi mot mål",
      value: `${diff > 0 ? "+" : ""}${formatNumber(diff)} kcal/d`,
      note: `snitt ${formatNumber(nutri7.kcal)} kcal senaste 7 d (${nutri7.days} dagar loggade)`,
      color: "var(--orange)",
    });
  }
  if (volPrev4 > 0) {
    const pct = ((vol4 - volPrev4) / volPrev4) * 100;
    trends.push({
      label: "Träningsvolym",
      value: `${pct > 0 ? "+" : ""}${formatNumber(pct)} %`,
      note: `senaste 4 v. mot 4 v. innan · ${formatNumber(sess4, 1)} pass/v (tidigare ${formatNumber(sessPrev4, 1)})`,
      color: "var(--green)",
    });
  }
  trends.push({ label: "Nya rekord", value: `${prs30}`, note: "senaste 30 dagarna", color: "var(--yellow)" });

  return (
    <>
      <div className="page-head">
        <div>
          <h1 className="page-title">Progress</h1>
          <div className="page-sub">Vikt, rekord och hur träningen utvecklas över tid.</div>
        </div>
      </div>

      <div className="grid">
        {trends.map((t) => (
          <div key={t.label} className="card span-3" style={{ borderTop: `5px solid ${t.color}` }}>
            <div className="label">{t.label}</div>
            <div className="mid-num" style={{ margin: "10px 0 6px" }}>
              {t.value}
            </div>
            <div className="small muted">{t.note}</div>
          </div>
        ))}
      </div>

      <SectionTitle color="var(--pink)">Kroppsvikt</SectionTitle>
      <div className="grid">
        <div className="card tint-pink span-4">
          <CardHead label="Senaste vägning" sub={current ? relativeDay(current.date, today) : "ingen ännu"} />
          <div className="big-num">
            {current ? formatNumber(current.kg, 1) : "–"}
            <span className="unit">kg</span>
          </div>
          {data.goals.targetWeightKg && current && (
            <p className="small" style={{ marginTop: 8 }}>
              {formatNumber(Math.abs(current.kg - data.goals.targetWeightKg), 1)} kg kvar till målet {formatNumber(data.goals.targetWeightKg, 1)} kg
            </p>
          )}
          <form onSubmit={addWeight} className="row" style={{ marginTop: 14, alignItems: "flex-end" }}>
            <label className="field" style={{ width: 150 }}>
              <span className="label">Datum</span>
              <input className="input" type="date" value={date} max={today} onChange={(e) => setDate(e.target.value)} />
            </label>
            <label className="field" style={{ width: 100 }}>
              <span className="label">Kg</span>
              <input className="input" inputMode="decimal" value={kg} onChange={(e) => setKg(e.target.value)} placeholder="80,5" />
            </label>
            <button className="btn" type="submit">
              Spara
            </button>
          </form>
        </div>
        <div className="card span-8">
          <CardHead label="Viktkurva" sub={data.goals.targetWeightKg ? `streckad linje = mål ${formatNumber(data.goals.targetWeightKg, 1)} kg` : undefined} />
          {weights.length >= 2 ? (
            <ChartFrame table={{ head: ["Datum", "Vikt"], rows: [...weights].reverse().map((w) => [formatShort(w.date), `${formatNumber(w.kg, 1)} kg`]) }}>
              <LineChart
                ariaLabel="Kroppsvikt över tid"
                points={weights.map((w) => ({ x: w.date, y: w.kg }))}
                color="var(--pink)"
                format={(v) => `${formatNumber(v, 1)}`}
                xFormat={formatShort}
                goal={data.goals.targetWeightKg}
                goalLabel="mål"
                height={230}
              />
            </ChartFrame>
          ) : (
            <p className="muted">Logga minst två vägningar för att se en kurva.</p>
          )}
        </div>
        {weights.length > 0 && (
          <div className="card span-12">
            <CardHead label="Vägningar" />
            <div className="chips">
              {[...weights].reverse().slice(0, 14).map((w) => (
                <span key={w.date} className="chip" style={{ cursor: "default" }}>
                  {formatShort(w.date)} · <strong>{formatNumber(w.kg, 1)}</strong>
                  <button
                    style={{ border: "none", background: "none", padding: 0, cursor: "pointer", display: "flex", color: "var(--muted)" }}
                    aria-label={`Ta bort vägning ${w.date}`}
                    onClick={() => update((d) => ({ ...d, weights: d.weights.filter((x) => x.date !== w.date) }))}
                  >
                    <IconTrash />
                  </button>
                </span>
              ))}
            </div>
          </div>
        )}
      </div>

      <SectionTitle color="var(--green)">Träningsutveckling</SectionTitle>
      <div className="grid">
        <div className="card span-8">
          <CardHead label="Volym per vecka · 6 månader" />
          <ChartFrame table={{ head: ["Vecka", "Pass", "Volym (kg)"], rows: weeks.map((w) => [`v. ${isoWeek(w.week)}`, w.sessions, formatNumber(w.volume)]) }}>
            <LineChart
              ariaLabel="Träningsvolym per vecka, 26 veckor"
              points={weeks.map((w) => ({ x: w.week, y: w.volume, tip: `${w.sessions} pass` }))}
              color="var(--green)"
              format={(v) => (v >= 1000 ? `${formatNumber(v / 1000, 1)} t` : formatNumber(v))}
              xFormat={(x) => `v${isoWeek(x)}`}
              height={220}
            />
          </ChartFrame>
        </div>
        <div className="card span-4">
          <CardHead label="Pass per vecka" />
          <BarChart
            ariaLabel="Antal pass per vecka, 12 veckor"
            color="var(--green)"
            height={220}
            bars={weeks.slice(-12).map((w) => ({ key: w.week, label: `v${isoWeek(w.week)}`, value: w.sessions }))}
            format={(v) => formatNumber(v)}
            highlightLast
          />
        </div>
      </div>

      <SectionTitle color="var(--yellow)">Rekordlogg</SectionTitle>
      <div className="card">
        {prs.length ? (
          <div className="table-wrap">
            <table className="data">
              <thead>
                <tr>
                  <th>Datum</th>
                  <th>Övning</th>
                  <th>Typ</th>
                  <th className="num">Värde</th>
                  <th className="num">Set</th>
                </tr>
              </thead>
              <tbody>
                {prs.slice(0, 40).map((p) => (
                  <tr key={p.date + p.exercise + p.kind}>
                    <td className="muted">{formatShort(p.date)}</td>
                    <td style={{ fontWeight: 600 }}>{p.exercise}</td>
                    <td>
                      <span className="tag" style={{ background: p.kind === "e1rm" ? "var(--yellow-soft)" : "var(--green-soft)", color: "var(--ink)" }}>
                        {p.kind === "e1rm" ? "Uppsk. 1RM" : "Tyngsta vikt"}
                      </span>
                    </td>
                    <td className="num">
                      <strong>{p.kind === "e1rm" ? `${Math.round(p.value)} kg` : fmtKg(p.value)}</strong>
                    </td>
                    <td className="num muted">{p.detail}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="muted">Inga rekord än – de dyker upp när du slår tidigare bästa resultat i en övning.</p>
        )}
      </div>
    </>
  );
}
