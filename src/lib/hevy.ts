// Import av Hevys CSV-export (Profil → Inställningar → Exportera & importera data).
// En rad per set. Kolumnerna för vikt/distans följer dina enhetsinställningar i Hevy
// (weight_kg eller weight_lbs, distance_km eller distance_miles).
import Papa from "papaparse";

export type SetType = "normal" | "warmup" | "dropset" | "failure";

export interface WorkoutSet {
  workoutKey: string; // start + titel
  workoutTitle: string;
  start: string; // ISO
  end: string | null;
  exercise: string;
  supersetId: string | null;
  setIndex: number;
  setType: SetType;
  weightKg: number | null;
  reps: number | null;
  distanceKm: number | null;
  durationS: number | null;
  rpe: number | null;
}

export interface ImportResult {
  sets: WorkoutSet[];
  workouts: number;
  skipped: number;
  weightUnit: "kg" | "lbs" | "saknas";
  warnings: string[];
}

const LBS_TO_KG = 0.45359237;
const MILES_TO_KM = 1.609344;

const MONTHS: Record<string, number> = {
  jan: 0, feb: 1, mar: 2, apr: 3, may: 4, maj: 4, jun: 5, jul: 6, aug: 7, sep: 8, oct: 9, okt: 9, nov: 10, dec: 11,
};

// Hevy har använt både "2024-01-15 10:00:00" och "15 Jan 2024, 10:00".
export function parseHevyDate(value: string | undefined): Date | null {
  if (!value) return null;
  const s = value.trim();
  let m = s.match(/^(\d{4})-(\d{2})-(\d{2})[ T](\d{1,2}):(\d{2})(?::(\d{2}))?/);
  if (m) return new Date(+m[1], +m[2] - 1, +m[3], +m[4], +m[5], +(m[6] ?? 0));
  m = s.match(/^(\d{1,2}) ([A-Za-zåäö]{3})[a-zåäö]*\.? (\d{4}),? (\d{1,2}):(\d{2})/);
  if (m) {
    const month = MONTHS[m[2].toLowerCase()];
    if (month !== undefined) return new Date(+m[3], month, +m[1], +m[4], +m[5]);
  }
  const d = new Date(s);
  return Number.isNaN(d.getTime()) ? null : d;
}

function num(v: unknown): number | null {
  if (v === undefined || v === null || v === "") return null;
  const n = Number(String(v).replace(",", "."));
  return Number.isFinite(n) ? n : null;
}

function toIsoLocal(d: Date): string {
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}:${p(d.getSeconds())}`;
}

export function parseHevyCsv(text: string): ImportResult {
  const parsed = Papa.parse<Record<string, string>>(text.replace(/^﻿/, ""), {
    header: true,
    skipEmptyLines: true,
    transformHeader: (h) => h.trim().toLowerCase(),
  });
  const fields = parsed.meta.fields ?? [];
  const warnings: string[] = [];
  const required = ["title", "start_time", "exercise_title"];
  const missing = required.filter((f) => !fields.includes(f));
  if (missing.length) {
    throw new Error(
      `Filen ser inte ut som en Hevy-export (saknar kolumnerna ${missing.join(", ")}). Hittade: ${fields.join(", ") || "inga kolumner"}.`,
    );
  }
  const weightUnit = fields.includes("weight_kg") ? "kg" : fields.includes("weight_lbs") ? "lbs" : "saknas";
  if (weightUnit === "saknas") warnings.push("Ingen viktkolumn hittades (weight_kg/weight_lbs).");

  const sets: WorkoutSet[] = [];
  let skipped = 0;
  for (const row of parsed.data) {
    const start = parseHevyDate(row.start_time);
    if (!start || !row.exercise_title) {
      skipped++;
      continue;
    }
    const end = parseHevyDate(row.end_time);
    const w = weightUnit === "kg" ? num(row.weight_kg) : weightUnit === "lbs" ? num(row.weight_lbs) : null;
    const dist = fields.includes("distance_km") ? num(row.distance_km) : num(row.distance_miles);
    const rawType = (row.set_type ?? "normal").trim().toLowerCase();
    const setType: SetType =
      rawType === "warmup" || rawType === "dropset" || rawType === "failure" ? rawType : "normal";
    const startIso = toIsoLocal(start);
    sets.push({
      workoutKey: `${startIso}|${row.title}`,
      workoutTitle: row.title?.trim() || "Pass",
      start: startIso,
      end: end ? toIsoLocal(end) : null,
      exercise: row.exercise_title.trim(),
      supersetId: row.superset_id?.trim() || null,
      setIndex: num(row.set_index) ?? 0,
      setType,
      weightKg: w == null ? null : weightUnit === "lbs" ? Math.round(w * LBS_TO_KG * 100) / 100 : w,
      reps: num(row.reps),
      distanceKm: dist == null ? null : fields.includes("distance_km") ? dist : dist * MILES_TO_KM,
      durationS: num(row.duration_seconds),
      rpe: num(row.rpe),
    });
  }
  if (parsed.errors.length) warnings.push(`${parsed.errors.length} rader kunde inte läsas korrekt.`);
  const workouts = new Set(sets.map((s) => s.workoutKey)).size;
  return { sets, workouts, skipped, weightUnit, warnings };
}

// Slår ihop nyimporterade set med befintliga: ett pass ersätts helt om det finns i den nya filen.
export function mergeSets(existing: WorkoutSet[], incoming: WorkoutSet[]): WorkoutSet[] {
  const incomingKeys = new Set(incoming.map((s) => s.workoutKey));
  // Stabil sortering på starttid behåller övningarnas ordning inom passet.
  return [...existing.filter((s) => !incomingKeys.has(s.workoutKey)), ...incoming].sort((a, b) =>
    a.start.localeCompare(b.start),
  );
}
