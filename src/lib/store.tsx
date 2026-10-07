// All data sparas lokalt i webbläsaren (IndexedDB). Inget skickas till någon server.
import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import type { ReactNode } from "react";
import { get, set } from "idb-keyval";
import type { WorkoutSet } from "./hevy";
import type { DayLog, Goals } from "./nutrition";
import { DEFAULT_GOALS } from "./nutrition";
import type { MuscleOverrides } from "./training";
import { buildWorkouts } from "./training";
import type { Workout } from "./training";

export interface WeightEntry {
  date: string;
  kg: number;
}

export interface Settings {
  usdaApiKey: string;
  isDemo: boolean;
}

export interface AppData {
  sets: WorkoutSet[];
  days: Record<string, DayLog>;
  weights: WeightEntry[];
  goals: Goals;
  overrides: MuscleOverrides;
  settings: Settings;
}

const EMPTY: AppData = {
  sets: [],
  days: {},
  weights: [],
  goals: DEFAULT_GOALS,
  overrides: {},
  settings: { usdaApiKey: "", isDemo: false },
};

const KEY = "falt:data:v1";

interface Store {
  data: AppData;
  workouts: Workout[];
  loaded: boolean;
  update: (fn: (d: AppData) => AppData) => void;
  replace: (d: AppData) => void;
}

const Ctx = createContext<Store | null>(null);

export function StoreProvider({ children }: { children: ReactNode }) {
  const [data, setData] = useState<AppData>(EMPTY);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    get<AppData>(KEY)
      .then((stored) => {
        if (stored) setData({ ...EMPTY, ...stored, goals: { ...DEFAULT_GOALS, ...stored.goals }, settings: { ...EMPTY.settings, ...stored.settings } });
      })
      .catch(() => {})
      .finally(() => setLoaded(true));
  }, []);

  useEffect(() => {
    if (loaded) set(KEY, data).catch(() => {});
  }, [data, loaded]);

  const update = useCallback((fn: (d: AppData) => AppData) => setData((d) => fn(d)), []);
  const replace = useCallback((d: AppData) => setData({ ...EMPTY, ...d }), []);
  const workouts = useMemo(() => buildWorkouts(data.sets), [data.sets]);

  const value = useMemo(() => ({ data, workouts, loaded, update, replace }), [data, workouts, loaded, update, replace]);
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useStore(): Store {
  const s = useContext(Ctx);
  if (!s) throw new Error("useStore utanför StoreProvider");
  return s;
}

export const EMPTY_DATA = EMPTY;
