import { describe, expect, it } from "vitest";
import { parseHevyCsv, parseHevyDate } from "../hevy";
import { guessMuscles } from "../muscles";
import { buildWorkouts, e1rm, exerciseRecords, muscleSetsFor, prTimeline, recommendations } from "../training";
import { buildDemoData } from "../demo";

const CSV = `title,start_time,end_time,description,exercise_title,superset_id,exercise_notes,set_index,set_type,weight_lbs,reps,distance_miles,duration_seconds,rpe
"Push","15 Jan 2024, 10:00","15 Jan 2024, 11:15","","Bench Press (Barbell)",,"",0,warmup,95,10,,,
"Push","15 Jan 2024, 10:00","15 Jan 2024, 11:15","","Bench Press (Barbell)",,"",1,normal,185,8,,,8
"Push","15 Jan 2024, 10:00","15 Jan 2024, 11:15","","Bench Press (Barbell)",,"",2,normal,185,7,,,9
"Pull","2024-01-17 10:00:00","2024-01-17 11:00:00","","Lat Pulldown (Cable)",,"",0,normal,120,10,,,
`;

describe("Hevy-import", () => {
  it("läser båda datumformaten", () => {
    expect(parseHevyDate("15 Jan 2024, 10:00")?.getDate()).toBe(15);
    expect(parseHevyDate("2024-01-17 10:00:00")?.getMonth()).toBe(0);
  });

  it("konverterar lbs till kg och grupperar pass", () => {
    const r = parseHevyCsv(CSV);
    expect(r.weightUnit).toBe("lbs");
    expect(r.workouts).toBe(2);
    expect(r.sets[1].weightKg).toBeCloseTo(83.91, 1);
    const workouts = buildWorkouts(r.sets);
    expect(workouts[0].title).toBe("Pull");
    const push = workouts[1];
    expect(push.workingSets).toBe(2); // uppvärmning räknas inte
    expect(push.durationMin).toBe(75);
  });

  it("ger tydligt fel för fel filformat", () => {
    expect(() => parseHevyCsv("a,b\n1,2")).toThrow(/Hevy-export/);
  });
});

describe("analys", () => {
  it("e1RM enligt Epley", () => {
    expect(e1rm(100, 1)).toBe(100);
    expect(e1rm(100, 10)).toBeCloseTo(133.3, 1);
    expect(e1rm(100, 15)).toBeNull();
  });

  it("mappar vanliga övningar till muskelgrupper", () => {
    expect(guessMuscles("Bench Press (Barbell)")?.primary).toBe("chest");
    expect(guessMuscles("Romanian Deadlift (Barbell)")?.primary).toBe("posterior");
    expect(guessMuscles("Leg Extension (Machine)")?.primary).toBe("quads");
    expect(guessMuscles("Lying Leg Curl (Machine)")?.primary).toBe("posterior");
    expect(guessMuscles("Triceps Extension (Cable)")?.primary).toBe("arms");
    expect(guessMuscles("Rear Delt Reverse Fly (Dumbbell)")?.primary).toBe("shoulders");
    expect(guessMuscles("Seated Cable Row - V Grip (Cable)")?.primary).toBe("back");
    expect(guessMuscles("Hanging Leg Raise")?.primary).toBe("core");
    expect(guessMuscles("Standing Calf Raise (Machine)")?.primary).toBe("calves");
    expect(guessMuscles("Knäböj")?.primary).toBe("quads");
  });

  it("räknar rekord, muskelset och rekommendationer på exempeldata", () => {
    const demo = buildDemoData("2026-10-07");
    const workouts = buildWorkouts(demo.sets);
    expect(workouts.length).toBeGreaterThan(20);
    const recs = exerciseRecords(workouts);
    expect(recs.find((r) => r.exercise === "Squat (Barbell)")?.bestE1rm?.value).toBeGreaterThan(90);
    const sets = muscleSetsFor(workouts.slice(0, 3), {});
    expect(sets.chest + sets.back + sets.quads).toBeGreaterThan(0);
    expect(prTimeline(workouts).length).toBeGreaterThan(5);
    const r = recommendations(workouts, {}, "2026-10-07");
    expect(r.some((x) => x.muscle === "calves")).toBe(true); // vader tränas aldrig i exemplet
    expect(Object.keys(demo.days).length).toBeGreaterThan(10);
  });
});
