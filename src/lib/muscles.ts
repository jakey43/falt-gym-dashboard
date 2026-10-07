// Hevys CSV innehåller inte muskelgrupper, så övningar mappas här via nyckelord
// (engelska Hevy-namn och vanliga svenska namn). Okända övningar kan mappas
// manuellt under Data → Övningar.

export type MuscleGroup = "chest" | "back" | "quads" | "shoulders" | "arms" | "posterior" | "core" | "calves";

export interface MuscleInfo {
  key: MuscleGroup;
  label: string;
  color: string; // CSS-variabel
  weeklyTarget: number; // set per vecka, riktmärke
}

// Fast ordning = fast färg (validerad palett, se src/styles/tokens.css).
export const MUSCLES: MuscleInfo[] = [
  { key: "chest", label: "Bröst", color: "var(--c-1)", weeklyTarget: 10 },
  { key: "back", label: "Rygg", color: "var(--c-2)", weeklyTarget: 10 },
  { key: "quads", label: "Framsida lår", color: "var(--c-3)", weeklyTarget: 10 },
  { key: "shoulders", label: "Axlar", color: "var(--c-4)", weeklyTarget: 10 },
  { key: "arms", label: "Armar", color: "var(--c-5)", weeklyTarget: 10 },
  { key: "posterior", label: "Baksida & säte", color: "var(--c-6)", weeklyTarget: 10 },
  { key: "core", label: "Core", color: "var(--c-7)", weeklyTarget: 6 },
  { key: "calves", label: "Vader", color: "var(--c-8)", weeklyTarget: 6 },
];

export const MUSCLE_BY_KEY = Object.fromEntries(MUSCLES.map((m) => [m.key, m])) as Record<MuscleGroup, MuscleInfo>;

export interface MuscleMapping {
  primary: MuscleGroup;
  secondary: MuscleGroup[];
}

// Ordningen spelar roll: mer specifika mönster först.
const RULES: [RegExp, MuscleGroup, MuscleGroup[]][] = [
  [/calf|vad(lyft|press)|tåhäv/, "calves", []],
  [/romanian|rdl|stiff.?leg|good ?morning|leg curl|lårcurl|hamstring|nordic|glute|hip thrust|höftlyft|hip extension|back extension|hyperext|kickback.*(cable|glute)|rumplyft/, "posterior", ["back"]],
  [/deadlift|marklyft/, "posterior", ["back", "quads"]],
  [/rear delt|reverse fly|reverse pec|upright row|push press/, "shoulders", ["back"]],
  [/squat|knäböj|leg press|benpress|lunge|utfall|split squat|step.?up|leg extension|benspark|hack|sissy|wall sit/, "quads", ["posterior"]],
  [/pull.?up|chin.?up|chins|lat pull|latsdrag|pulldown|row|rodd|pullover|shrug|axelryck|face pull|back|rygg/, "back", ["arms"]],
  [/bench|bänk|chest|bröst|fly|flyes|pec deck|push.?up|armhävning|dip/, "chest", ["shoulders", "arms"]],
  [/overhead press|shoulder press|military|axelpress|arnold|lateral raise|sidolyft|front raise|rear delt|reverse fly|upright row|landmine press|handstand/, "shoulders", ["arms"]],
  [/curl|tricep|skull|pushdown|extension|kickback|close.?grip|french press|hammer|preacher|wrist|underarm/, "arms", []],
  [/plank|crunch|sit.?up|leg raise|benlyft|ab wheel|rollout|russian twist|hollow|dead bug|pallof|woodchop|v.?up|toes to bar|mage|core|oblique/, "core", []],
];

export function guessMuscles(exercise: string): MuscleMapping | null {
  const name = exercise.toLowerCase();
  for (const [re, primary, secondary] of RULES) {
    if (re.test(name)) {
      // Dips och close-grip-press är triceps-tunga.
      if (primary === "chest" && /tricep|close.?grip/.test(name)) return { primary: "arms", secondary: ["chest"] };
      return { primary, secondary };
    }
  }
  return null;
}

export function musclesFor(
  exercise: string,
  overrides: Record<string, MuscleGroup | "ignore">,
): MuscleMapping | null {
  const o = overrides[exercise];
  if (o === "ignore") return null;
  if (o) return { primary: o, secondary: [] };
  return guessMuscles(exercise);
}
