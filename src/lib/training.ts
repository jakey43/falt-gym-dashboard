// Träningsanalys: pass, volym, rekord, progression och rekommendationer.
import { addDays, daysBetween, todayKey, weekStart } from "./date";
import type { WorkoutSet } from "./hevy";
import { MUSCLES, musclesFor } from "./muscles";
import type { MuscleGroup } from "./muscles";

export type MuscleOverrides = Record<string, MuscleGroup | "ignore">;

export interface ExerciseInWorkout {
  name: string;
  sets: WorkoutSet[];
  workingSets: WorkoutSet[];
  volume: number;
  bestSet: WorkoutSet | null; // högst e1RM
  bestE1rm: number | null;
}

export interface Workout {
  key: string;
  title: string;
  start: string;
  date: string;
  durationMin: number | null;
  exercises: ExerciseInWorkout[];
  volume: number;
  workingSets: number;
  totalReps: number;
}

export const isWorking = (s: WorkoutSet) => s.setType !== "warmup";

// Epley-formel. Över 12 reps blir uppskattningen opålitlig, så vi räknar inte e1RM där.
export function e1rm(weightKg: number | null, reps: number | null): number | null {
  if (!weightKg || !reps || reps <= 0 || reps > 12) return null;
  if (reps === 1) return weightKg;
  return weightKg * (1 + reps / 30);
}

export const setVolume = (s: WorkoutSet) => (s.weightKg ?? 0) * (s.reps ?? 0);

export function buildWorkouts(sets: WorkoutSet[]): Workout[] {
  const byKey = new Map<string, WorkoutSet[]>();
  for (const s of sets) {
    const list = byKey.get(s.workoutKey);
    if (list) list.push(s);
    else byKey.set(s.workoutKey, [s]);
  }
  const workouts: Workout[] = [];
  for (const [key, list] of byKey) {
    const first = list[0];
    const exMap = new Map<string, WorkoutSet[]>();
    for (const s of list) {
      const l = exMap.get(s.exercise);
      if (l) l.push(s);
      else exMap.set(s.exercise, [s]);
    }
    const exercises: ExerciseInWorkout[] = [...exMap].map(([name, exSets]) => {
      const working = exSets.filter(isWorking);
      let bestSet: WorkoutSet | null = null;
      let bestE1rm: number | null = null;
      for (const s of working) {
        const e = e1rm(s.weightKg, s.reps);
        if (e != null && (bestE1rm == null || e > bestE1rm)) {
          bestE1rm = e;
          bestSet = s;
        }
      }
      return {
        name,
        sets: exSets,
        workingSets: working,
        volume: working.reduce((a, s) => a + setVolume(s), 0),
        bestSet,
        bestE1rm,
      };
    });
    const durationMin =
      first.end != null ? Math.round((new Date(first.end).getTime() - new Date(first.start).getTime()) / 60000) : null;
    workouts.push({
      key,
      title: first.workoutTitle,
      start: first.start,
      date: first.start.slice(0, 10),
      durationMin: durationMin != null && durationMin > 0 ? durationMin : null,
      exercises,
      volume: exercises.reduce((a, e) => a + e.volume, 0),
      workingSets: exercises.reduce((a, e) => a + e.workingSets.length, 0),
      totalReps: exercises.reduce((a, e) => a + e.workingSets.reduce((b, s) => b + (s.reps ?? 0), 0), 0),
    });
  }
  return workouts.sort((a, b) => b.start.localeCompare(a.start));
}

// ---- Muskelgrupper ----------------------------------------------------------

export type MuscleSets = Record<MuscleGroup, number>;

export function emptyMuscleSets(): MuscleSets {
  return Object.fromEntries(MUSCLES.map((m) => [m.key, 0])) as MuscleSets;
}

// Primär muskel räknas som 1 set, sekundär som 0,5.
export function muscleSetsFor(workouts: Workout[], overrides: MuscleOverrides): MuscleSets {
  const out = emptyMuscleSets();
  for (const w of workouts) {
    for (const ex of w.exercises) {
      const m = musclesFor(ex.name, overrides);
      if (!m) continue;
      const n = ex.workingSets.length;
      out[m.primary] += n;
      for (const s of m.secondary) out[s] += n * 0.5;
    }
  }
  return out;
}

export function lastTrained(workouts: Workout[], overrides: MuscleOverrides): Partial<Record<MuscleGroup, string>> {
  const out: Partial<Record<MuscleGroup, string>> = {};
  for (const w of workouts) {
    for (const ex of w.exercises) {
      const m = musclesFor(ex.name, overrides);
      if (!m || ex.workingSets.length === 0) continue;
      if (!out[m.primary] || out[m.primary]! < w.date) out[m.primary] = w.date;
    }
  }
  return out;
}

export function unmappedExercises(workouts: Workout[], overrides: MuscleOverrides): string[] {
  const names = new Set<string>();
  for (const w of workouts) for (const ex of w.exercises) if (!musclesFor(ex.name, overrides) && overrides[ex.name] !== "ignore") names.add(ex.name);
  return [...names].sort();
}

export function inRange(workouts: Workout[], from: string, to: string): Workout[] {
  return workouts.filter((w) => w.date >= from && w.date <= to);
}

// ---- Veckor --------------------------------------------------------------------

export interface WeekSummary {
  week: string; // måndagens datum
  sessions: number;
  volume: number;
  sets: number;
  muscles: MuscleSets;
}

export function weeklySummaries(workouts: Workout[], overrides: MuscleOverrides, weeks = 12, today = todayKey()): WeekSummary[] {
  const thisWeek = weekStart(today);
  const out: WeekSummary[] = [];
  for (let i = weeks - 1; i >= 0; i--) {
    const start = addDays(thisWeek, -7 * i);
    const end = addDays(start, 6);
    const ws = inRange(workouts, start, end);
    out.push({
      week: start,
      sessions: ws.length,
      volume: ws.reduce((a, w) => a + w.volume, 0),
      sets: ws.reduce((a, w) => a + w.workingSets, 0),
      muscles: muscleSetsFor(ws, overrides),
    });
  }
  return out;
}

// ---- Rekord & progression -------------------------------------------------------

export interface ExerciseRecord {
  exercise: string;
  heaviest: { weight: number; reps: number; date: string } | null;
  bestE1rm: { value: number; weight: number; reps: number; date: string } | null;
  mostReps: { reps: number; weight: number; date: string } | null;
  bestSessionVolume: { volume: number; date: string } | null;
  sessions: number;
  lastDate: string;
}

export function exerciseRecords(workouts: Workout[]): ExerciseRecord[] {
  const map = new Map<string, ExerciseRecord>();
  // Äldst först så att datum för rekord blir första gången det sattes.
  for (const w of [...workouts].reverse()) {
    for (const ex of w.exercises) {
      let r = map.get(ex.name);
      if (!r) {
        r = { exercise: ex.name, heaviest: null, bestE1rm: null, mostReps: null, bestSessionVolume: null, sessions: 0, lastDate: w.date };
        map.set(ex.name, r);
      }
      r.sessions++;
      r.lastDate = w.date;
      for (const s of ex.workingSets) {
        if (s.weightKg && s.reps && (!r.heaviest || s.weightKg > r.heaviest.weight)) {
          r.heaviest = { weight: s.weightKg, reps: s.reps, date: w.date };
        }
        if (s.reps && (!r.mostReps || s.reps > r.mostReps.reps)) {
          r.mostReps = { reps: s.reps, weight: s.weightKg ?? 0, date: w.date };
        }
        const e = e1rm(s.weightKg, s.reps);
        if (e != null && (!r.bestE1rm || e > r.bestE1rm.value)) {
          r.bestE1rm = { value: e, weight: s.weightKg!, reps: s.reps!, date: w.date };
        }
      }
      if (ex.volume > 0 && (!r.bestSessionVolume || ex.volume > r.bestSessionVolume.volume)) {
        r.bestSessionVolume = { volume: ex.volume, date: w.date };
      }
    }
  }
  return [...map.values()].sort((a, b) => b.sessions - a.sessions);
}

export interface PrEvent {
  date: string;
  exercise: string;
  kind: "e1rm" | "weight";
  value: number;
  detail: string;
}

// Alla tillfällen då ett nytt rekord sattes (e1RM eller tyngsta vikt).
export function prTimeline(workouts: Workout[]): PrEvent[] {
  const bestE = new Map<string, number>();
  const bestW = new Map<string, number>();
  const events: PrEvent[] = [];
  for (const w of [...workouts].reverse()) {
    for (const ex of w.exercises) {
      const prevE = bestE.get(ex.name);
      const prevW = bestW.get(ex.name);
      const heaviest = Math.max(0, ...ex.workingSets.map((s) => (s.reps ? s.weightKg ?? 0 : 0)));
      if (ex.bestE1rm != null && ex.bestSet) {
        if (prevE !== undefined && ex.bestE1rm > prevE + 0.01) {
          events.push({
            date: w.date,
            exercise: ex.name,
            kind: "e1rm",
            value: ex.bestE1rm,
            detail: `${fmtKg(ex.bestSet.weightKg)} × ${ex.bestSet.reps}`,
          });
        }
        bestE.set(ex.name, Math.max(prevE ?? 0, ex.bestE1rm));
      }
      if (heaviest > 0) {
        if (prevW !== undefined && heaviest > prevW && !(ex.bestE1rm != null && prevE !== undefined && ex.bestE1rm > prevE + 0.01)) {
          const reps = Math.max(...ex.workingSets.filter((s) => s.weightKg === heaviest).map((s) => s.reps ?? 0));
          events.push({ date: w.date, exercise: ex.name, kind: "weight", value: heaviest, detail: `${fmtKg(heaviest)} × ${reps}` });
        }
        bestW.set(ex.name, Math.max(prevW ?? 0, heaviest));
      }
    }
  }
  return events.reverse();
}

export interface ProgressPoint {
  date: string;
  e1rm: number | null;
  topWeight: number | null;
  volume: number;
  bestSet: string;
}

export function exerciseProgress(workouts: Workout[], exercise: string): ProgressPoint[] {
  const pts: ProgressPoint[] = [];
  for (const w of [...workouts].reverse()) {
    const ex = w.exercises.find((e) => e.name === exercise);
    if (!ex || ex.workingSets.length === 0) continue;
    const top = Math.max(0, ...ex.workingSets.map((s) => s.weightKg ?? 0));
    pts.push({
      date: w.date,
      e1rm: ex.bestE1rm,
      topWeight: top || null,
      volume: ex.volume,
      bestSet: ex.bestSet ? `${fmtKg(ex.bestSet.weightKg)} × ${ex.bestSet.reps}` : `${ex.workingSets[0].reps ?? "–"} reps`,
    });
  }
  return pts;
}

export function fmtKg(v: number | null | undefined): string {
  if (v == null) return "–";
  return `${v.toLocaleString("sv-SE", { maximumFractionDigits: 1 })} kg`;
}

// ---- Rekommendationer -----------------------------------------------------------

export type RecommendationKind = "volume-low" | "not-trained" | "stalled" | "increase-weight" | "progressing";

export interface Recommendation {
  kind: RecommendationKind;
  title: string;
  body: string;
  muscle?: MuscleGroup;
  exercise?: string;
}

export function recommendations(
  workouts: Workout[],
  overrides: MuscleOverrides,
  today = todayKey(),
): Recommendation[] {
  const recs: Recommendation[] = [];
  if (workouts.length === 0) return recs;

  // 1. Volym per muskelgrupp: snitt av de senaste 4 hela veckorna + innevarande.
  const from = addDays(today, -27);
  const recent = inRange(workouts, from, today);
  const sets = muscleSetsFor(recent, overrides);
  const last = lastTrained(workouts, overrides);
  for (const m of MUSCLES) {
    const perWeek = sets[m.key] / 4;
    const lastDate = last[m.key];
    const since = lastDate ? daysBetween(lastDate, today) : null;
    if (since == null || since > 10) {
      recs.push({
        kind: "not-trained",
        muscle: m.key,
        title: `${m.label}: ${since == null ? "inga loggade set" : `${since} dagar sedan senast`}`,
        body: `Lägg in ${m.key === "core" || m.key === "calves" ? "2–3" : "3–4"} set i nästa pass för att hålla igång utvecklingen.`,
      });
    } else if (perWeek < m.weeklyTarget * 0.6) {
      recs.push({
        kind: "volume-low",
        muscle: m.key,
        title: `${m.label}: ${perWeek.toLocaleString("sv-SE", { maximumFractionDigits: 1 })} set/vecka`,
        body: `Under riktmärket ~${m.weeklyTarget} set per vecka (snitt senaste 4 veckorna). Överväg 2–4 set till per vecka.`,
      });
    }
  }

  // 2. Progression per övning (övningar som körts minst 4 gånger senaste 8 veckorna).
  const window = inRange(workouts, addDays(today, -56), today);
  const counts = new Map<string, number>();
  for (const w of window) for (const ex of w.exercises) counts.set(ex.name, (counts.get(ex.name) ?? 0) + 1);
  const frequent = [...counts].filter(([, n]) => n >= 4).map(([name]) => name);

  for (const name of frequent) {
    const pts = exerciseProgress(window, name).filter((p) => p.e1rm != null);
    if (pts.length < 4) continue;
    const lastFour = pts.slice(-4);
    const earlier = Math.max(lastFour[0].e1rm!, lastFour[1].e1rm!);
    const later = Math.max(lastFour[2].e1rm!, lastFour[3].e1rm!);
    const lastWorkout = window.find((w) => w.exercises.some((e) => e.name === name));
    const ex = lastWorkout?.exercises.find((e) => e.name === name);
    const top = ex ? Math.max(...ex.workingSets.map((s) => s.weightKg ?? 0)) : 0;
    const topSets = ex ? ex.workingSets.filter((s) => (s.weightKg ?? 0) === top) : [];
    const minReps = topSets.length ? Math.min(...topSets.map((s) => s.reps ?? 0)) : 0;

    if (topSets.length >= 2 && minReps >= 12) {
      recs.push({
        kind: "increase-weight",
        exercise: name,
        title: `${name}: dags att öka vikten`,
        body: `Alla set på ${fmtKg(top)} landade på ${minReps}+ reps. Prova ${fmtKg(top + (top >= 40 ? 2.5 : 1))} och sikta på 8–10 reps.`,
      });
    } else if (later <= earlier * 1.005) {
      recs.push({
        kind: "stalled",
        exercise: name,
        title: `${name}: står still`,
        body: `Uppskattat 1RM har inte ökat på fyra pass (${Math.round(later)} kg). Prova att öka reps med 1–2 per set innan du höjer vikten, eller sänk 5–10 % och bygg upp igen.`,
      });
    } else if (later > earlier * 1.02) {
      recs.push({
        kind: "progressing",
        exercise: name,
        title: `${name}: stadig ökning`,
        body: `Uppskattat 1RM upp ${Math.round(((later - earlier) / earlier) * 100)} % på fyra pass. Fortsätt med samma upplägg.`,
      });
    }
  }
  const order: RecommendationKind[] = ["not-trained", "volume-low", "stalled", "increase-weight", "progressing"];
  return recs.sort((a, b) => order.indexOf(a.kind) - order.indexOf(b.kind));
}
