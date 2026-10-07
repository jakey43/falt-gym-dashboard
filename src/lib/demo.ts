// Exempeldata för att prova appen innan du importerar egen data.
// Genereras som en Hevy-liknande CSV så att samma importväg används.
import { addDays, fromDateKey, todayKey } from "./date";
import { analyzeQuery } from "./foodParser";
import { parseHevyCsv } from "./hevy";
import { DEFAULT_GOALS, newId } from "./nutrition";
import type { DayLog, FoodEntry } from "./nutrition";
import type { AppData } from "./store";

function rng(seed: number) {
  return () => {
    seed = (seed * 1664525 + 1013904223) % 4294967296;
    return seed / 4294967296;
  };
}

type Ex = [name: string, startKg: number, incPerWeek: number, sets: number, reps: number];

const ROUTINES: { title: string; exercises: Ex[] }[] = [
  {
    title: "Push",
    exercises: [
      ["Bench Press (Barbell)", 70, 1.0, 4, 8],
      ["Incline Bench Press (Dumbbell)", 24, 0.5, 3, 10],
      ["Overhead Press (Barbell)", 40, 0.5, 3, 8],
      ["Lateral Raise (Dumbbell)", 10, 0.15, 3, 12],
      ["Triceps Pushdown (Cable)", 25, 0.5, 3, 12],
    ],
  },
  {
    title: "Pull",
    exercises: [
      ["Lat Pulldown (Cable)", 55, 1.0, 4, 10],
      ["Seated Cable Row - V Grip (Cable)", 50, 1.0, 3, 10],
      ["Face Pull", 20, 0.3, 3, 15],
      ["Bicep Curl (Dumbbell)", 12, 0.2, 3, 10],
      ["Hammer Curl (Dumbbell)", 14, 0, 2, 10],
    ],
  },
  {
    title: "Ben",
    exercises: [
      ["Squat (Barbell)", 80, 1.25, 4, 6],
      ["Romanian Deadlift (Barbell)", 70, 1.0, 3, 8],
      ["Leg Press (Machine)", 140, 2.5, 3, 10],
      ["Leg Extension (Machine)", 45, 0, 3, 12],
    ],
  },
];

const DAY_FOODS = [
  "100 g havregryn och 3 dl mjölk och 1 banan",
  "150 g kycklingfilé stekt och 250 g ris kokt och 150 g broccoli",
  "333 g sötpotatis, rå",
  "4 ägg och 2 skivor bröd",
  "250 g keso och 100 g blåbär",
  "125 g lax stekt och 300 g potatis kokt",
];

export function buildDemoData(today = todayKey()): AppData {
  const rand = rng(42);
  const weeks = 10;
  const start = addDays(today, -weeks * 7 + 1);
  const header =
    "title,start_time,end_time,description,exercise_title,superset_id,exercise_notes,set_index,set_type,weight_kg,reps,distance_km,duration_seconds,rpe";
  const lines = [header];
  let routineIdx = 0;
  for (let d = 0; d < weeks * 7; d++) {
    const date = addDays(start, d);
    const dow = (fromDateKey(date).getDay() + 6) % 7; // 0 = mån
    // Mån, ons, fre + ibland lör. Hoppa över enstaka pass.
    const planned = dow === 0 || dow === 2 || dow === 4 || (dow === 5 && rand() < 0.4);
    if (!planned || rand() < 0.1) continue;
    const routine = ROUTINES[routineIdx++ % ROUTINES.length];
    const week = d / 7;
    const hour = 17 + Math.floor(rand() * 2);
    const startTime = `${date} ${hour}:${rand() < 0.5 ? "05" : "35"}:00`;
    const endTime = `${date} ${hour + 1}:${rand() < 0.5 ? "10" : "20"}:00`;
    for (const [name, startKg, inc, sets, reps] of routine.exercises) {
      // Bänkpressen planar ut de sista veckorna för att visa en rekommendation.
      const effectiveWeek = name.startsWith("Bench") ? Math.min(week, 6.5) : week;
      const kg = Math.round((startKg + inc * effectiveWeek) / 1.25) * 1.25;
      lines.push(`"${routine.title}","${startTime}","${endTime}","","${name}",,"",0,warmup,${Math.round(kg * 0.5)},10,,,`);
      for (let s = 1; s <= sets; s++) {
        const r = Math.max(4, reps + Math.round((rand() - 0.6) * 2) - (s === sets ? 1 : 0));
        const rpe = 7 + Math.round(rand() * 2 * 2) / 2;
        lines.push(`"${routine.title}","${startTime}","${endTime}","","${name}",,"",${s},normal,${kg},${r},,,${rpe}`);
      }
    }
  }
  const { sets } = parseHevyCsv(lines.join("\n"));

  const days: Record<string, DayLog> = {};
  for (let d = 0; d < 21; d++) {
    const date = addDays(today, -d);
    if (rand() < 0.12) continue;
    const foods: FoodEntry[] = [];
    if (d < 7) {
      const q = DAY_FOODS[d % DAY_FOODS.length];
      for (const item of analyzeQuery(q)) {
        if (!item.food || item.grams == null) continue;
        foods.push({
          id: newId(),
          text: item.text,
          foodId: item.food.id,
          foodName: item.food.name,
          source: item.food.source,
          sourceUrl: item.food.sourceUrl,
          grams: item.grams,
          nutrients: item.nutrients,
          addedAt: `${date}T12:00:00`,
        });
      }
    }
    const kcal = Math.round(2350 + rand() * 500);
    days[date] = {
      date,
      lifesum: {
        kcal,
        protein: Math.round(135 + rand() * 45),
        carbs: Math.round(250 + rand() * 90),
        fat: Math.round(65 + rand() * 25),
        fiber: Math.round(22 + rand() * 14),
      },
      foods,
    };
  }

  const weights = [];
  for (let d = weeks * 7; d >= 0; d -= 2) {
    weights.push({ date: addDays(today, -d), kg: Math.round((81.8 - (weeks * 7 - d) * 0.025 + (rand() - 0.5) * 0.8) * 10) / 10 });
  }

  return {
    sets,
    days,
    weights,
    goals: { ...DEFAULT_GOALS, targetWeightKg: 79 },
    overrides: {},
    settings: { usdaApiKey: "", isDemo: true },
  };
}
