import { useEffect, useMemo, useState } from "react";
import { useLocation } from "react-router-dom";
import { EMPTY_DATA, useStore } from "../lib/store";
import type { AppData } from "../lib/store";
import { mergeSets, parseHevyCsv } from "../lib/hevy";
import type { ImportResult } from "../lib/hevy";
import { buildDemoData } from "../lib/demo";
import { MUSCLES, guessMuscles } from "../lib/muscles";
import type { MuscleGroup } from "../lib/muscles";
import { unmappedExercises } from "../lib/training";
import { SLV_META } from "../lib/foodDb";
import { formatShort, todayKey } from "../lib/date";
import { CardHead, SectionTitle } from "../components/ui";
import { IconUpload } from "../components/icons";

export default function DataPage() {
  const { data, workouts, update, replace } = useStore();
  const { hash } = useLocation();
  const [importResult, setImportResult] = useState<(ImportResult & { fileName: string }) | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [dragging, setDragging] = useState(false);
  const [goalForm, setGoalForm] = useState(() => ({ ...data.goals, targetWeightKg: data.goals.targetWeightKg ?? ("" as number | "") }));
  const [goalSaved, setGoalSaved] = useState(false);
  const [showAllEx, setShowAllEx] = useState(false);

  useEffect(() => {
    if (hash.includes("mal")) document.getElementById("mal")?.scrollIntoView();
  }, [hash]);

  async function handleFile(file: File) {
    setError(null);
    setImportResult(null);
    try {
      const text = await file.text();
      const result = parseHevyCsv(text);
      if (result.sets.length === 0) throw new Error("Filen innehöll inga set.");
      update((d) => ({
        ...d,
        sets: mergeSets(d.settings.isDemo ? [] : d.sets, result.sets),
        // Byter man från exempeldata rensas exemplets kost och vikt också.
        ...(d.settings.isDemo ? { days: {}, weights: [], settings: { ...d.settings, isDemo: false } } : {}),
      }));
      setImportResult({ ...result, fileName: file.name });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Kunde inte läsa filen.");
    }
  }

  const exercises = useMemo(() => {
    const counts = new Map<string, number>();
    for (const w of workouts) for (const e of w.exercises) counts.set(e.name, (counts.get(e.name) ?? 0) + 1);
    return [...counts].sort((a, b) => b[1] - a[1]);
  }, [workouts]);
  const unmapped = unmappedExercises(workouts, data.overrides);

  function setOverride(name: string, value: string) {
    update((d) => {
      const overrides = { ...d.overrides };
      if (value === "") delete overrides[name];
      else overrides[name] = value as MuscleGroup | "ignore";
      return { ...d, overrides };
    });
  }

  function saveGoals(e: React.FormEvent) {
    e.preventDefault();
    const num = (v: unknown, fallback: number) => {
      const n = Number(String(v).replace(",", "."));
      return Number.isFinite(n) && n > 0 ? n : fallback;
    };
    update((d) => ({
      ...d,
      goals: {
        ...d.goals,
        kcal: num(goalForm.kcal, d.goals.kcal),
        protein: num(goalForm.protein, d.goals.protein),
        carbs: num(goalForm.carbs, d.goals.carbs),
        fat: num(goalForm.fat, d.goals.fat),
        fiber: num(goalForm.fiber, d.goals.fiber),
        profile: goalForm.profile,
        targetWeightKg: goalForm.targetWeightKg === "" ? null : num(goalForm.targetWeightKg, 0) || null,
      },
    }));
    setGoalSaved(true);
  }

  function exportBackup() {
    const blob = new Blob([JSON.stringify(data, null, 1)], { type: "application/json" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `falt-backup-${todayKey()}.json`;
    a.click();
    URL.revokeObjectURL(a.href);
  }

  async function importBackup(file: File) {
    try {
      const parsed = JSON.parse(await file.text()) as AppData;
      if (!Array.isArray(parsed.sets) || typeof parsed.days !== "object") throw new Error();
      replace(parsed);
      setError(null);
      alert("Backupen är återställd.");
    } catch {
      setError("Filen är ingen giltig Fält-backup.");
    }
  }

  const firstDate = workouts.length ? workouts[workouts.length - 1].date : null;

  return (
    <>
      <div className="page-head">
        <div>
          <h1 className="page-title">Data</h1>
          <div className="page-sub">Import, mål och inställningar. Allt sparas bara i den här webbläsaren.</div>
        </div>
      </div>

      <SectionTitle color="var(--green)">Träning från Hevy</SectionTitle>
      <div className="grid">
        <div className="card span-7">
          <CardHead label="Importera CSV" sub={workouts.length ? `${workouts.length} pass sedan ${formatShort(firstDate!)} i appen` : "inga pass ännu"} />
          <label
            className="card flat"
            style={{
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              gap: 8,
              padding: 28,
              borderStyle: "dashed",
              borderWidth: 2,
              cursor: "pointer",
              background: dragging ? "var(--green-soft)" : "transparent",
              textAlign: "center",
            }}
            onDragOver={(e) => {
              e.preventDefault();
              setDragging(true);
            }}
            onDragLeave={() => setDragging(false)}
            onDrop={(e) => {
              e.preventDefault();
              setDragging(false);
              const f = e.dataTransfer.files[0];
              if (f) handleFile(f);
            }}
          >
            <span style={{ width: 28, height: 28, display: "flex" }}>
              <IconUpload />
            </span>
            <strong>Välj eller släpp workouts.csv</strong>
            <span className="small muted">Pass som redan finns ersätts, nya läggs till.</span>
            <input type="file" accept=".csv,text/csv" className="sr-only" onChange={(e) => e.target.files?.[0] && handleFile(e.target.files[0])} />
          </label>
          {importResult && (
            <div className="notice good" style={{ marginTop: 12, display: "block" }}>
              <strong>{importResult.fileName}</strong>: {importResult.workouts} pass, {importResult.sets.length} set importerade (vikt i{" "}
              {importResult.weightUnit}
              {importResult.weightUnit === "lbs" ? ", omräknat till kg" : ""}).
              {importResult.skipped > 0 && ` ${importResult.skipped} rader hoppades över.`}
              {importResult.warnings.map((w) => (
                <div key={w}>{w}</div>
              ))}
            </div>
          )}
          {error && (
            <div className="notice bad" style={{ marginTop: 12 }}>
              {error}
            </div>
          )}
        </div>
        <div className="card tint-green span-5">
          <CardHead label="Så exporterar du från Hevy" />
          <ol style={{ paddingLeft: 18, margin: 0, lineHeight: 1.7 }}>
            <li>Öppna Hevy → Profil → kugghjulet (Inställningar)</li>
            <li>Välj <strong>Export & Import Data</strong></li>
            <li>Tryck <strong>Export Workouts</strong> och spara CSV-filen</li>
            <li>Importera filen här – upprepa när du vill uppdatera</li>
          </ol>
          <p className="small" style={{ marginTop: 12, marginBottom: 0, color: "var(--ink-2)" }}>
            Hevys officiella API kräver Hevy Pro. Utan Pro är CSV-exporten det legitima sättet att få ut din data. Exporten
            innehåller inte muskelgrupper – de gissas utifrån övningens namn och kan ändras nedan.
          </p>
        </div>
      </div>

      {exercises.length > 0 && (
        <div className="card" style={{ marginTop: 14 }}>
          <CardHead
            label="Övningar → muskelgrupper"
            sub={unmapped.length ? `${unmapped.length} övningar kunde inte mappas automatiskt` : "alla övningar är mappade"}
          />
          <div className="table-wrap">
            <table className="data">
              <thead>
                <tr>
                  <th>Övning</th>
                  <th className="num">Pass</th>
                  <th>Muskelgrupp</th>
                </tr>
              </thead>
              <tbody>
                {exercises
                  .filter(([name]) => showAllEx || unmapped.includes(name) || data.overrides[name])
                  .concat(showAllEx || unmapped.length ? [] : exercises.slice(0, 6))
                  .filter((v, i, arr) => arr.findIndex((x) => x[0] === v[0]) === i)
                  .map(([name, n]) => {
                    const guess = guessMuscles(name);
                    return (
                      <tr key={name}>
                        <td style={{ fontWeight: 600 }}>{name}</td>
                        <td className="num muted">{n}</td>
                        <td>
                          <select className="select" style={{ minHeight: 36, maxWidth: 240 }} value={data.overrides[name] ?? ""} onChange={(e) => setOverride(name, e.target.value)}>
                            <option value="">{guess ? `Auto: ${MUSCLES.find((m) => m.key === guess.primary)?.label}` : "Okänd – välj"}</option>
                            {MUSCLES.map((m) => (
                              <option key={m.key} value={m.key}>
                                {m.label}
                              </option>
                            ))}
                            <option value="ignore">Räkna inte (t.ex. kondition)</option>
                          </select>
                        </td>
                      </tr>
                    );
                  })}
              </tbody>
            </table>
          </div>
          <button className="table-toggle" style={{ marginTop: 10 }} onClick={() => setShowAllEx((s) => !s)}>
            {showAllEx ? "Visa färre" : `Visa alla ${exercises.length} övningar`}
          </button>
        </div>
      )}

      <SectionTitle color="var(--blue)">
        <span id="mal">Mål</span>
      </SectionTitle>
      <form className="card" onSubmit={saveGoals}>
        <div className="form-grid">
          {(
            [
              ["kcal", "Kalorier (kcal)"],
              ["protein", "Protein (g)"],
              ["carbs", "Kolhydrater (g)"],
              ["fat", "Fett (g)"],
              ["fiber", "Fiber (g)"],
              ["targetWeightKg", "Målvikt (kg)"],
            ] as const
          ).map(([k, label]) => (
            <label key={k} className="field">
              <span className="label">{label}</span>
              <input
                className="input"
                inputMode="decimal"
                value={String(goalForm[k] ?? "")}
                onChange={(e) => {
                  setGoalForm({ ...goalForm, [k]: e.target.value });
                  setGoalSaved(false);
                }}
              />
            </label>
          ))}
          <label className="field">
            <span className="label">Referensvärden</span>
            <select className="select" value={goalForm.profile} onChange={(e) => setGoalForm({ ...goalForm, profile: e.target.value as "man" | "kvinna" })}>
              <option value="man">Vuxen man (NNR 2023)</option>
              <option value="kvinna">Vuxen kvinna (NNR 2023)</option>
            </select>
          </label>
        </div>
        <div className="row" style={{ marginTop: 14 }}>
          <button className="btn" type="submit">
            Spara mål
          </button>
          {goalSaved && <span className="small">Sparat ✓</span>}
        </div>
        <p className="small muted" style={{ marginBottom: 0 }}>
          Referensvärdena för vitaminer och mineraler är ungefärliga riktmärken för vuxna, inte individuella krav.
        </p>
      </form>

      <SectionTitle color="var(--orange)">Livsmedelskällor</SectionTitle>
      <div className="grid">
        <div className="card span-7">
          <CardHead label="Källor" />
          <ul className="list small">
            <li className="list-row">
              <span>
                <strong>Livsmedelsverket</strong> – primär källa, paketerad i appen ({SLV_META.fetchedAt}, {SLV_META.license})
              </span>
              <span className="tag" style={{ background: "var(--green-soft)" }}>
                offline
              </span>
            </li>
            <li className="list-row">
              <span>
                <strong>Open Food Facts</strong> – märkesvaror och streckkoder (mikronäringsämnen saknas ofta)
              </span>
              <span className="tag">online</span>
            </li>
            <li className="list-row">
              <span>
                <strong>USDA FoodData Central</strong> – reserv, sök på engelska
              </span>
              <span className="tag">online</span>
            </li>
          </ul>
        </div>
        <div className="card span-5">
          <CardHead label="USDA API-nyckel (valfri)" sub="gratis på api.data.gov/signup" />
          <input
            className="input"
            value={data.settings.usdaApiKey}
            placeholder="Klistra in nyckel"
            onChange={(e) => update((d) => ({ ...d, settings: { ...d.settings, usdaApiKey: e.target.value.trim() } }))}
          />
          <p className="small muted" style={{ marginBottom: 0 }}>
            Sparas bara lokalt i din webbläsare. Utan nyckel används en delad demonyckel med låg gräns.
          </p>
        </div>
      </div>

      <SectionTitle color="var(--lavender)">Säkerhetskopia & exempeldata</SectionTitle>
      <div className="grid">
        <div className="card span-6">
          <CardHead label="Backup" sub="flytta data mellan enheter eller spara en kopia" />
          <div className="row">
            <button className="btn secondary" onClick={exportBackup}>
              Ladda ner backup (.json)
            </button>
            <label className="btn secondary">
              Återställ backup
              <input type="file" accept="application/json,.json" className="sr-only" onChange={(e) => e.target.files?.[0] && importBackup(e.target.files[0])} />
            </label>
          </div>
        </div>
        <div className="card span-6">
          <CardHead label="Exempeldata" sub={data.settings.isDemo ? "exempeldata är laddad" : "prova appen med påhittad data"} />
          <div className="row">
            {!data.settings.isDemo && (
              <button
                className="btn secondary"
                onClick={() => {
                  if (workouts.length || Object.keys(data.days).length) {
                    if (!confirm("Exempeldata ersätter din nuvarande data. Ladda ner en backup först om du vill behålla den. Fortsätta?")) return;
                  }
                  replace(buildDemoData());
                }}
              >
                Ladda exempeldata
              </button>
            )}
            <button
              className="btn danger"
              onClick={() => {
                if (confirm(data.settings.isDemo ? "Ta bort exempeldata?" : "Radera ALL data i appen? Detta går inte att ångra.")) replace({ ...EMPTY_DATA, goals: data.goals, settings: { ...EMPTY_DATA.settings, usdaApiKey: data.settings.usdaApiKey } });
              }}
            >
              {data.settings.isDemo ? "Ta bort exempeldata" : "Radera all data"}
            </button>
          </div>
        </div>
      </div>
    </>
  );
}
