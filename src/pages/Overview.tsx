import { Link } from "react-router-dom";
import { useMemo } from "react";
import { useStore } from "../lib/store";
import { addDays, formatLong, formatShort, relativeDay, todayKey, weekStart } from "../lib/date";
import { inRange, muscleSetsFor, prTimeline, recommendations, weeklySummaries, fmtKg } from "../lib/training";
import { dayTotals, referenceFor } from "../lib/nutrition";
import { NUTRIENT_BY_KEY, formatNumber } from "../lib/nutrients";
import type { NutrientKey } from "../lib/nutrients";
import { Blob, CardHead, Empty, FieldMap, GoalMeter, SectionTitle, SunIllustration, ThinMeter } from "../components/ui";
import { Sparkline } from "../components/charts";

const KEY_MICROS: NutrientKey[] = ["potassium", "magnesium", "vitC", "vitA", "vitD", "iron", "calcium", "vitB12"];

function greeting() {
  const h = new Date().getHours();
  if (h < 5) return "God natt";
  if (h < 10) return "God morgon";
  if (h < 17) return "Hej";
  return "God kväll";
}

export default function Overview() {
  const { data, workouts } = useStore();
  const today = todayKey();
  const hasTraining = workouts.length > 0;

  const week = useMemo(() => {
    const start = weekStart(today);
    const ws = inRange(workouts, start, addDays(start, 6));
    return { start, workouts: ws, sets: muscleSetsFor(ws, data.overrides) };
  }, [workouts, today, data.overrides]);
  const weeks = useMemo(() => weeklySummaries(workouts, data.overrides, 8, today), [workouts, data.overrides, today]);
  const prs = useMemo(() => prTimeline(workouts).slice(0, 4), [workouts]);
  const recs = useMemo(() => recommendations(workouts, data.overrides, today).slice(0, 2), [workouts, data.overrides, today]);
  const day = dayTotals(data.days[today], today);
  const g = data.goals;

  const last = workouts[0];
  const thisWeekVol = weeks[weeks.length - 1]?.volume ?? 0;
  const lastWeekVol = weeks[weeks.length - 2]?.volume ?? 0;
  const trainedDays = new Set(week.workouts.map((w) => w.date));

  const weights = [...data.weights].sort((a, b) => a.date.localeCompare(b.date));
  const currentW = weights[weights.length - 1];
  const monthAgo = weights.filter((w) => w.date <= addDays(today, -28)).pop();

  return (
    <>
      <div className="page-head">
        <div>
          <div className="label">{formatLong(today)}</div>
          <h1 className="page-title" style={{ marginTop: 8 }}>
            {greeting()}.
          </h1>
        </div>
      </div>

      {!hasTraining && Object.keys(data.days).length === 0 && (
        <div className="card tint-lavender" style={{ marginBottom: 14 }}>
          <Blob color="var(--yellow)" variant={1} style={{ width: 180, right: -50, top: -60, opacity: 0.7 }} />
          <Empty
            title="Välkommen till Fält"
            action={
              <div className="row" style={{ justifyContent: "center" }}>
                <Link className="btn" to="/data">
                  Importera Hevy-CSV
                </Link>
                <Link className="btn secondary" to="/kost">
                  Lägg in dagens makron
                </Link>
              </div>
            }
          >
            Börja med att importera din träningshistorik från Hevy och logga dagens makron från Lifesum. Vill du titta
            runt först kan du ladda exempeldata under Data.
          </Empty>
        </div>
      )}

      <SectionTitle color="var(--green)">Träning</SectionTitle>
      <div className="grid">
        <Link to="/traning" className="card tint-green span-5 workout-card" style={{ color: "inherit" }}>
          <Blob color="var(--green)" style={{ width: 160, right: -60, bottom: -70, opacity: 0.25 }} />
          <CardHead label="Senaste pass" sub={last ? `${relativeDay(last.date, today)} · ${last.durationMin ?? "–"} min` : undefined} />
          {last ? (
            <>
              <div className="display" style={{ fontSize: 30, marginBottom: 14 }}>
                {last.title}
              </div>
              <div className="stat-row" style={{ marginBottom: 14 }}>
                <div className="stat">
                  <span className="label">Volym</span>
                  <span className="mid-num">
                    {formatNumber(last.volume / 1000, 1)}
                    <span className="unit">ton</span>
                  </span>
                </div>
                <div className="stat">
                  <span className="label">Set</span>
                  <span className="mid-num">{last.workingSets}</span>
                </div>
                <div className="stat">
                  <span className="label">Reps</span>
                  <span className="mid-num">{last.totalReps}</span>
                </div>
              </div>
              <ul className="list small">
                {last.exercises.slice(0, 4).map((e) => (
                  <li key={e.name} className="list-row" style={{ borderColor: "rgba(0,0,0,.08)", padding: "8px 0" }}>
                    <span>{e.name}</span>
                    <span className="tnum" style={{ fontWeight: 600 }}>
                      {e.bestSet ? `${fmtKg(e.bestSet.weightKg)} × ${e.bestSet.reps}` : `${e.workingSets.length} set`}
                    </span>
                  </li>
                ))}
              </ul>
            </>
          ) : (
            <p className="muted">Inga pass importerade ännu.</p>
          )}
        </Link>

        <div className="card span-3 wide-mobile">
          <CardHead label="Veckans pass" sub={`v. från ${formatShort(week.start)}`} />
          <div className="big-num">{week.workouts.length}</div>
          <div className="row" style={{ gap: 6, margin: "14px 0" }} aria-label="Träningsdagar den här veckan">
            {Array.from({ length: 7 }, (_, i) => {
              const d = addDays(week.start, i);
              const on = trainedDays.has(d);
              return (
                <div key={d} style={{ textAlign: "center" }}>
                  <div
                    style={{
                      width: 26,
                      height: 26,
                      borderRadius: "40% 55% 45% 50%",
                      background: on ? "var(--green)" : d > today ? "transparent" : "var(--paper-2)",
                      border: d > today ? "1.5px dashed var(--line-strong)" : "none",
                    }}
                    title={on ? "Tränat" : "Vila"}
                  />
                  <div className="sublabel" style={{ marginTop: 4 }}>{"MTOTFLS"[i]}</div>
                </div>
              );
            })}
          </div>
          <div className="label" style={{ marginBottom: 4 }}>Volym</div>
          <div className="tnum">
            <strong>{formatNumber(thisWeekVol / 1000, 1)} ton</strong>{" "}
            <span className="muted small">
              {lastWeekVol > 0 ? `(förra v. ${formatNumber(lastWeekVol / 1000, 1)})` : ""}
            </span>
          </div>
        </div>

        <div className="card span-4">
          <CardHead label="Muskelgrupper · veckan" sub="set per grupp mot riktmärke" link={{ to: "/traning", text: "Mer" }} />
          <FieldMap sets={week.sets} compact />
        </div>
      </div>

      <SectionTitle color="var(--blue)">Kost idag</SectionTitle>
      <div className="grid">
        <div className="card tint-blue span-5">
          <Blob color="var(--blue)" variant={1} style={{ width: 170, right: -70, top: -80, opacity: 0.22 }} />
          <CardHead
            label="Dagens kalorier"
            sub={day.macroSource === "lifesum" ? "från Lifesum" : day.macroSource === "matfrågor" ? "från matfrågor" : "inget loggat än"}
            link={{ to: "/kost", text: "Logga" }}
          />
          <div className="big-num" style={{ marginBottom: 16 }}>
            {day.macros.kcal == null ? "–" : formatNumber(day.macros.kcal)}
            <span className="unit">/ {formatNumber(g.kcal)} kcal</span>
          </div>
          <GoalMeter value={day.macros.kcal} goal={g.kcal} unit="kcal" gradient="linear-gradient(90deg, #f6e1a6, #f3b98e 55%, var(--orange))" />
        </div>

        <div className="card span-7">
          <CardHead label="Makron" sub="faktiskt mot mål" />
          <div className="grid" style={{ gap: 18 }}>
            {(
              [
                ["protein", "Protein", g.protein, "var(--blue)"],
                ["carbs", "Kolhydrater", g.carbs, "var(--yellow)"],
                ["fat", "Fett", g.fat, "var(--orange)"],
                ["fiber", "Fiber", g.fiber, "var(--green)"],
              ] as const
            ).map(([k, label, goal, color]) => {
              const v = day.macros[k];
              return (
                <div key={k} className="span-6" style={{ gridColumn: "span 6" }}>
                  <div className="spread" style={{ marginBottom: 6 }}>
                    <span className="label">{label}</span>
                    <span className="small muted tnum">mål {goal} g</span>
                  </div>
                  <div className="mid-num" style={{ marginBottom: 8 }}>
                    {v == null ? "–" : formatNumber(v)}
                    <span className="unit">g</span>
                  </div>
                  <ThinMeter ratio={v == null ? null : v / goal} color={color} />
                </div>
              );
            })}
          </div>
        </div>

        <div className="card span-12">
          <CardHead
            label="Viktiga mikronäringsämnen"
            sub={day.foodCount ? `från ${day.foodCount} livsmedel loggade via matfrågor · % av referensvärde` : "logga livsmedel via Matfråga för att se vitaminer och mineraler"}
            link={{ to: "/mat", text: "Matfråga" }}
          />
          <div className="nutri-grid" style={{ gridTemplateColumns: "repeat(auto-fill, minmax(190px, 1fr))", gap: "14px 22px" }}>
            {KEY_MICROS.map((k) => {
              const info = NUTRIENT_BY_KEY[k];
              const v = day.micros[k] ?? null;
              const ref = referenceFor(g, k);
              const ratio = v != null && ref ? v / ref : null;
              return (
                <div key={k}>
                  <div className="spread small" style={{ marginBottom: 6 }}>
                    <span style={{ fontWeight: 600 }}>{info.label}</span>
                    <span className="tnum muted">
                      {v == null ? "–" : `${formatNumber(v, info.decimals)} ${info.unit}`}
                      {ratio != null && <strong style={{ color: "var(--ink)" }}> · {Math.round(ratio * 100)} %</strong>}
                    </span>
                  </div>
                  <ThinMeter ratio={ratio} color="var(--blue)" />
                </div>
              );
            })}
          </div>
        </div>
      </div>

      <SectionTitle color="var(--yellow)">Progression</SectionTitle>
      <div className="grid">
        <div className="card tint-yellow span-4">
          <CardHead label="Senaste rekord" link={{ to: "/progress", text: "Alla" }} />
          {prs.length ? (
            <ul className="list">
              {prs.map((p) => (
                <li key={p.date + p.exercise} className="list-row" style={{ borderColor: "rgba(0,0,0,.08)" }}>
                  <div style={{ minWidth: 0 }}>
                    <div style={{ fontWeight: 600, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{p.exercise}</div>
                    <div className="sublabel">
                      {relativeDay(p.date, today)} · {p.kind === "e1rm" ? "uppsk. 1RM" : "tyngsta vikt"}
                    </div>
                  </div>
                  <div className="tnum" style={{ textAlign: "right", flex: "none" }}>
                    <strong>{p.kind === "e1rm" ? `${Math.round(p.value)} kg` : fmtKg(p.value)}</strong>
                    <div className="small muted">{p.detail}</div>
                  </div>
                </li>
              ))}
            </ul>
          ) : (
            <p className="muted">Rekord visas när du har minst två pass med samma övning.</p>
          )}
        </div>

        <Link to="/progress" className="card tint-pink span-4 workout-card" style={{ color: "inherit" }}>
          <CardHead label="Kroppsvikt" sub={currentW ? `senast ${relativeDay(currentW.date, today)}` : undefined} />
          {currentW ? (
            <>
              <div className="big-num">
                {formatNumber(currentW.kg, 1)}
                <span className="unit">kg</span>
              </div>
              <div className="spread" style={{ marginTop: 14, alignItems: "flex-end" }}>
                <div className="small">
                  {monthAgo ? (
                    <>
                      <strong className="tnum">
                        {currentW.kg - monthAgo.kg > 0 ? "+" : ""}
                        {formatNumber(currentW.kg - monthAgo.kg, 1)} kg
                      </strong>{" "}
                      <span className="muted">senaste 4 v.</span>
                    </>
                  ) : (
                    <span className="muted">Logga fler vägningar för trend</span>
                  )}
                  {g.targetWeightKg && <div className="muted">mål {formatNumber(g.targetWeightKg, 1)} kg</div>}
                </div>
                <Sparkline values={weights.slice(-20).map((w) => w.kg)} color="var(--pink)" />
              </div>
            </>
          ) : (
            <p className="muted">Lägg in din vikt under Progress.</p>
          )}
        </Link>

        <div className="card span-4">
          <div className="spread" style={{ alignItems: "flex-start" }}>
            <CardHead label="Trender" sub="volym per vecka, 8 v." link={{ to: "/traning", text: "Mer" }} />
          </div>
          <div className="spread" style={{ alignItems: "flex-end", marginBottom: 12 }}>
            <Sparkline values={weeks.map((w) => w.volume)} color="var(--green)" width={150} height={44} />
            <SunIllustration color="var(--orange)" />
          </div>
          {recs.length ? (
            recs.map((r) => (
              <div key={r.title} className="small" style={{ borderTop: "1px solid var(--line)", padding: "10px 0 0", marginTop: 10 }}>
                <strong>{r.title}</strong>
                <div className="muted">{r.body}</div>
              </div>
            ))
          ) : (
            <p className="muted small">Rekommendationer visas när det finns några veckors träningsdata.</p>
          )}
        </div>
      </div>
    </>
  );
}
