import { Link } from "react-router-dom";
import { useMemo, useState } from "react";
import { useStore } from "../lib/store";
import { addDays, daysBetween, formatLong, formatShort, isoWeek, relativeDay, todayKey, weekStart } from "../lib/date";
import {
  exerciseProgress,
  exerciseRecords,
  fmtKg,
  inRange,
  lastTrained,
  muscleSetsFor,
  recommendations,
  weeklySummaries,
} from "../lib/training";
import type { Recommendation, Workout } from "../lib/training";
import { MUSCLES } from "../lib/muscles";
import { formatNumber } from "../lib/nutrients";
import { BarChart, ChartFrame, LineChart } from "../components/charts";
import { CardHead, Empty, FieldMap, SectionTitle } from "../components/ui";

const RANGES = [
  { weeks: 4, label: "4 v" },
  { weeks: 12, label: "12 v" },
  { weeks: 26, label: "6 mån" },
];

const REC_STYLE: Record<Recommendation["kind"], [string, string]> = {
  "not-trained": ["var(--orange-soft)", "!"],
  "volume-low": ["var(--yellow-soft)", "↓"],
  stalled: ["var(--lavender-soft)", "="],
  "increase-weight": ["var(--green-soft)", "↑"],
  progressing: ["var(--blue-soft)", "↗"],
};

export default function Training() {
  const { data, workouts } = useStore();
  const today = todayKey();
  const [weeks, setWeeks] = useState(12);
  const [openKey, setOpenKey] = useState<string | null>(null);
  const [showAll, setShowAll] = useState(false);

  const summaries = useMemo(() => weeklySummaries(workouts, data.overrides, weeks, today), [workouts, data.overrides, weeks, today]);
  const records = useMemo(() => exerciseRecords(workouts), [workouts]);
  const recs = useMemo(() => recommendations(workouts, data.overrides, today), [workouts, data.overrides, today]);
  const [exercise, setExercise] = useState<string>("");
  const selected = exercise || records[0]?.exercise || "";
  const progress = useMemo(() => (selected ? exerciseProgress(workouts, selected) : []), [workouts, selected]);

  const rangeStart = addDays(weekStart(today), -7 * (weeks - 1));
  const rangeWorkouts = inRange(workouts, rangeStart, today);
  const rangeSets = muscleSetsFor(rangeWorkouts, data.overrides);
  const weekSets = muscleSetsFor(inRange(workouts, weekStart(today), today), data.overrides);
  const last = lastTrained(workouts, data.overrides);
  const fullWeeks = Math.max(1, weeks);

  if (workouts.length === 0) {
    return (
      <>
        <div className="page-head">
          <h1 className="page-title">Träning</h1>
        </div>
        <div className="card">
          <Empty title="Inga pass än" action={<Link className="btn" to="/data">Importera Hevy-CSV</Link>}>
            Exportera din historik i Hevy (Profil → Inställningar → Export & Import Data → Export Workouts) och
            importera CSV-filen under Data.
          </Empty>
        </div>
      </>
    );
  }

  const recordByName = new Map(records.map((r) => [r.exercise, r]));
  const shownWorkouts = showAll ? workouts.slice(0, 40) : workouts.slice(0, 6);

  return (
    <>
      <div className="page-head">
        <div>
          <h1 className="page-title">Träning</h1>
          <div className="page-sub">
            {workouts.length} pass sedan {formatShort(workouts[workouts.length - 1].date)} · senast {relativeDay(workouts[0].date, today)}
          </div>
        </div>
        <div className="chips" role="group" aria-label="Tidsperiod">
          {RANGES.map((r) => (
            <button key={r.weeks} className="chip" aria-pressed={weeks === r.weeks} onClick={() => setWeeks(r.weeks)}>
              {r.label}
            </button>
          ))}
        </div>
      </div>

      <div className="grid">
        <div className="card span-8">
          <CardHead label="Volym per vecka" sub="kg × reps, arbetsset" />
          <ChartFrame
            table={{
              head: ["Vecka", "Pass", "Set", "Volym (kg)"],
              rows: summaries.map((s) => [`v. ${isoWeek(s.week)}`, s.sessions, s.sets, formatNumber(s.volume)]),
            }}
          >
            <BarChart
              ariaLabel="Träningsvolym per vecka"
              color="var(--green)"
              highlightLast
              bars={summaries.map((s) => ({
                key: s.week,
                label: `v${isoWeek(s.week)}`,
                value: s.volume,
                tip: `${s.sessions} pass · ${s.sets} set`,
              }))}
              format={(v) => (v >= 1000 ? `${formatNumber(v / 1000, 1)} t` : formatNumber(v))}
            />
          </ChartFrame>
        </div>
        <div className="card tint-green span-4">
          <CardHead label={`Snitt per vecka · ${RANGES.find((r) => r.weeks === weeks)?.label}`} />
          <div className="stack">
            <div>
              <span className="label">Pass</span>
              <div className="big-num">{formatNumber(rangeWorkouts.length / fullWeeks, 1)}</div>
            </div>
            <div className="stat-row">
              <div>
                <span className="label">Set</span>
                <div className="mid-num">{formatNumber(rangeWorkouts.reduce((a, w) => a + w.workingSets, 0) / fullWeeks, 0)}</div>
              </div>
              <div>
                <span className="label">Volym</span>
                <div className="mid-num">
                  {formatNumber(rangeWorkouts.reduce((a, w) => a + w.volume, 0) / fullWeeks / 1000, 1)}
                  <span className="unit">ton</span>
                </div>
              </div>
            </div>
            <div className="small muted">
              Snittlängd{" "}
              {formatNumber(
                rangeWorkouts.filter((w) => w.durationMin).reduce((a, w) => a + (w.durationMin ?? 0), 0) /
                  Math.max(1, rangeWorkouts.filter((w) => w.durationMin).length),
              )}{" "}
              min
            </div>
          </div>
        </div>
      </div>

      <SectionTitle color="var(--c-4)">Muskelgrupper</SectionTitle>
      <div className="grid">
        <div className="card span-7">
          <CardHead label="Fältkartan · den här veckan" sub="Fältet växer med antal set. Streckad kant = under 60 % av riktmärket." />
          <FieldMap sets={weekSets} />
        </div>
        <div className="card span-5">
          <CardHead label="Set per vecka" sub={`snitt ${RANGES.find((r) => r.weeks === weeks)?.label} · sekundära muskler räknas som ½ set`} />
          <table className="data">
            <thead>
              <tr>
                <th>Grupp</th>
                <th className="num">Set/v</th>
                <th className="num">Senast</th>
              </tr>
            </thead>
            <tbody>
              {MUSCLES.map((m) => {
                const perWeek = rangeSets[m.key] / fullWeeks;
                const lt = last[m.key];
                return (
                  <tr key={m.key}>
                    <td>
                      <span className="row" style={{ gap: 8 }}>
                        <span className="dot" style={{ background: m.color }} />
                        {m.label}
                      </span>
                    </td>
                    <td className="num">
                      <strong>{formatNumber(perWeek, 1)}</strong>
                      <span className="muted"> / {m.weeklyTarget}</span>
                    </td>
                    <td className="num muted">{lt ? `${daysBetween(lt, today)} d` : "–"}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      <SectionTitle color="var(--orange)">Rekommendationer</SectionTitle>
      <div className="card">
        {recs.length ? (
          recs.filter((r) => r.kind !== "progressing").map((r) => {
            const [bg, sym] = REC_STYLE[r.kind];
            return (
              <div key={r.title} className="rec">
                <div className="rec-icon" style={{ background: bg }} aria-hidden="true">
                  {sym}
                </div>
                <div>
                  <strong>{r.title}</strong>
                  <div className="muted small">{r.body}</div>
                </div>
              </div>
            );
          })
        ) : (
          <p className="muted">Inget att anmärka – fortsätt som du gör.</p>
        )}
        {recs.some((r) => r.kind === "progressing") && (
          <div className="rec">
            <div className="rec-icon" style={{ background: REC_STYLE.progressing[0] }} aria-hidden="true">
              {REC_STYLE.progressing[1]}
            </div>
            <div>
              <strong>Stadig ökning – fortsätt med samma upplägg</strong>
              <div className="muted small">
                {recs
                  .filter((r) => r.kind === "progressing")
                  .map((r) => `${r.exercise} (${r.body.match(/\d+ %/)?.[0] ?? ""})`)
                  .join(" · ")}
              </div>
            </div>
          </div>
        )}
        <p className="sublabel" style={{ marginTop: 14 }}>
          Enkla regler: ~10 set/vecka per stor muskelgrupp, ~6 för core och vader. Progression bedöms på uppskattat 1RM (Epley).
        </p>
      </div>

      <SectionTitle color="var(--yellow)">Progression per övning</SectionTitle>
      <div className="card">
        <div className="spread" style={{ marginBottom: 14 }}>
          <select className="select" style={{ maxWidth: 420 }} value={selected} onChange={(e) => setExercise(e.target.value)} aria-label="Välj övning">
            {records.map((r) => (
              <option key={r.exercise} value={r.exercise}>
                {r.exercise} ({r.sessions} pass)
              </option>
            ))}
          </select>
          {recordByName.get(selected)?.bestE1rm && (
            <span className="tag" style={{ background: "var(--yellow-soft)", color: "var(--ink)" }}>
              PR {Math.round(recordByName.get(selected)!.bestE1rm!.value)} kg uppsk. 1RM
            </span>
          )}
        </div>
        {progress.some((p) => p.e1rm != null) ? (
          <ChartFrame
            table={{
              head: ["Datum", "Bästa set", "Uppsk. 1RM", "Volym"],
              rows: progress.map((p) => [formatShort(p.date), p.bestSet, p.e1rm ? `${Math.round(p.e1rm)} kg` : "–", `${formatNumber(p.volume)} kg`]),
            }}
          >
            <LineChart
              ariaLabel={`Uppskattat 1RM för ${selected}`}
              points={progress.map((p) => ({ x: p.date, y: p.e1rm != null ? Math.round(p.e1rm * 10) / 10 : null, tip: `Bästa set ${p.bestSet}` }))}
              color="var(--yellow)"
              format={(v) => `${formatNumber(v)} kg`}
              xFormat={formatShort}
              height={230}
            />
          </ChartFrame>
        ) : (
          <p className="muted">Ingen viktdata för den här övningen.</p>
        )}
      </div>

      <SectionTitle color="var(--green)">Senaste pass</SectionTitle>
      <div className="grid">
        {shownWorkouts.map((w) => (
          <WorkoutCard key={w.key} w={w} open={openKey === w.key} onToggle={() => setOpenKey(openKey === w.key ? null : w.key)} prDates={recordByName} />
        ))}
      </div>
      {workouts.length > 6 && (
        <div style={{ textAlign: "center", marginTop: 14 }}>
          <button className="btn secondary" onClick={() => setShowAll((s) => !s)}>
            {showAll ? "Visa färre" : "Visa fler pass"}
          </button>
        </div>
      )}

      <SectionTitle color="var(--yellow)">Personliga rekord</SectionTitle>
      <div className="card">
        <div className="table-wrap">
          <table className="data">
            <thead>
              <tr>
                <th>Övning</th>
                <th className="num">Tyngsta</th>
                <th className="num">Uppsk. 1RM</th>
                <th className="num">Flest reps</th>
                <th className="num">Pass</th>
              </tr>
            </thead>
            <tbody>
              {records.map((r) => (
                <tr key={r.exercise}>
                  <td style={{ fontWeight: 600 }}>{r.exercise}</td>
                  <td className="num">
                    {r.heaviest ? `${fmtKg(r.heaviest.weight)} × ${r.heaviest.reps}` : "–"}
                    {r.heaviest && <div className="sublabel">{formatShort(r.heaviest.date)}</div>}
                  </td>
                  <td className="num">
                    {r.bestE1rm ? `${Math.round(r.bestE1rm.value)} kg` : "–"}
                    {r.bestE1rm && <div className="sublabel">{formatShort(r.bestE1rm.date)}</div>}
                  </td>
                  <td className="num">{r.mostReps ? `${r.mostReps.reps}${r.mostReps.weight ? ` @ ${fmtKg(r.mostReps.weight)}` : ""}` : "–"}</td>
                  <td className="num muted">{r.sessions}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </>
  );
}

function WorkoutCard({
  w,
  open,
  onToggle,
  prDates,
}: {
  w: Workout;
  open: boolean;
  onToggle: () => void;
  prDates: Map<string, ReturnType<typeof exerciseRecords>[number]>;
}) {
  return (
    <div className="card span-6">
      <button className="workout-card" style={{ background: "none", padding: 0 }} onClick={onToggle} aria-expanded={open}>
        <div className="spread" style={{ alignItems: "flex-start" }}>
          <div>
            <div className="sublabel">{formatLong(w.date)}</div>
            <div className="display" style={{ fontSize: 24, marginTop: 4 }}>
              {w.title}
            </div>
          </div>
          <div className="tnum" style={{ textAlign: "right" }}>
            <strong>{formatNumber(w.volume / 1000, 1)} ton</strong>
            <div className="small muted">
              {w.workingSets} set · {w.durationMin ?? "–"} min
            </div>
          </div>
        </div>
      </button>
      <div style={{ marginTop: 10 }}>
        {(open ? w.exercises : w.exercises.slice(0, 3)).map((e) => {
          const rec = prDates.get(e.name);
          return (
            <div key={e.name} className="exercise-line">
              <span style={{ fontWeight: 600 }}>{e.name}</span>
              <span className="small muted tnum">{formatNumber(e.volume)} kg</span>
              {open && (
                <div className="set-pills">
                  {e.sets.map((s, i) => {
                    const isPr = rec?.heaviest?.date === w.date && s.weightKg === rec.heaviest.weight && s.setType !== "warmup";
                    return (
                      <span key={i} className={`set-pill${s.setType === "warmup" ? " warmup" : ""}${isPr ? " pr" : ""}`} title={s.setType}>
                        {s.weightKg != null ? `${formatNumber(s.weightKg, 1)} kg` : ""}
                        {s.reps != null ? ` × ${s.reps}` : ""}
                        {s.durationS != null && s.reps == null ? `${Math.round(s.durationS)} s` : ""}
                        {s.rpe != null ? ` @${s.rpe}` : ""}
                        {s.setType === "dropset" ? " · drop" : s.setType === "failure" ? " · fail" : ""}
                      </span>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}
        {!open && w.exercises.length > 3 && (
          <button className="table-toggle" style={{ marginTop: 8 }} onClick={onToggle}>
            + {w.exercises.length - 3} övningar
          </button>
        )}
        {open && (
          <button className="table-toggle" style={{ marginTop: 8 }} onClick={onToggle}>
            Dölj set
          </button>
        )}
      </div>
    </div>
  );
}
