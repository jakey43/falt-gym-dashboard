import type { CSSProperties, ReactNode } from "react";
import { Link } from "react-router-dom";
import { MUSCLES } from "../lib/muscles";
import type { MuscleGroup } from "../lib/muscles";
import type { MuscleSets } from "../lib/training";
import { formatNumber } from "../lib/nutrients";

export function SectionTitle({ children, color, right }: { children: ReactNode; color: string; right?: ReactNode }) {
  return (
    <div className="section-title">
      <span className="pip" style={{ background: color }} />
      <h2>{children}</h2>
      <span style={{ flex: 1 }} />
      {right}
    </div>
  );
}

export function CardHead({ label, sub, link }: { label: string; sub?: ReactNode; link?: { to: string; text: string } }) {
  return (
    <div className="card-head">
      <div>
        <div className="label">{label}</div>
        {sub && <div className="sublabel" style={{ marginTop: 4 }}>{sub}</div>}
      </div>
      {link && (
        <Link className="card-link" to={link.to}>
          {link.text} →
        </Link>
      )}
    </div>
  );
}

// Organisk dekorform i kortens hörn.
export function Blob({ color, style, variant = 0 }: { color: string; style?: CSSProperties; variant?: number }) {
  const paths = [
    "M60,-58C76,-41,85,-20,84,-1C83,19,72,38,56,53C40,68,20,80,-2,82C-24,84,-48,77,-64,61C-80,45,-88,22,-86,1C-84,-20,-72,-40,-56,-57C-40,-74,-20,-87,0,-87C21,-87,43,-75,60,-58Z",
    "M48,-62C61,-50,69,-33,74,-14C79,5,80,26,70,40C60,54,39,62,18,68C-3,74,-24,78,-42,70C-60,62,-75,42,-80,20C-85,-2,-80,-26,-67,-44C-54,-62,-33,-74,-12,-76C9,-78,35,-74,48,-62Z",
  ];
  return (
    <svg className="blob" viewBox="-100 -100 200 200" style={style} aria-hidden="true">
      <path d={paths[variant % paths.length]} fill={color} />
    </svg>
  );
}

// Stor horisontell mätare för mål vs faktiskt (inspirerad av "visibility"-stapeln).
export function GoalMeter({
  value,
  goal,
  unit,
  gradient,
  decimals = 0,
}: {
  value: number | null;
  goal: number;
  unit: string;
  gradient: string;
  decimals?: number;
}) {
  const scaleMax = Math.max(goal * 1.25, value ?? 0);
  const pct = value == null ? 0 : Math.min(100, (value / scaleMax) * 100);
  const goalPct = (goal / scaleMax) * 100;
  const ratio = value == null ? null : value / goal;
  return (
    <div className="meter" role="meter" aria-valuenow={value ?? 0} aria-valuemin={0} aria-valuemax={scaleMax} aria-label={`${formatNumber(value ?? 0, decimals)} av ${goal} ${unit}`}>
      <div className="meter-fill" style={{ width: `${pct}%`, background: gradient }} />
      <div className="meter-goal" style={{ left: `calc(${goalPct}% - 1px)` }} title={`Mål ${goal} ${unit}`} />
      <div className="meter-text">
        <span className="mid-num" style={{ fontSize: 22 }}>
          {value == null ? "–" : formatNumber(value, decimals)}
          <span className="unit">{unit}</span>
        </span>
        <span className="small pill" style={{ color: "var(--ink-2)", fontWeight: 600 }}>
          {ratio == null ? `mål ${formatNumber(goal)}` : `${Math.round(ratio * 100)} % av ${formatNumber(goal)}`}
        </span>
      </div>
    </div>
  );
}

export function ThinMeter({ ratio, color }: { ratio: number | null; color: string }) {
  const pct = ratio == null ? 0 : Math.min(100, ratio * 100);
  return (
    <div className="thin-meter" aria-hidden="true">
      <span style={{ width: `${pct}%`, background: color }} />
    </div>
  );
}

// Fältkartan: varje muskelgrupp är en åkerlapp som "växer" med veckans set.
const SHAPES = [
  "28px 18px 22px 30px",
  "18px 30px 26px 20px",
  "24px 22px 30px 18px",
  "30px 20px 18px 26px",
  "20px 26px 22px 30px",
  "26px 30px 20px 22px",
  "22px 18px 30px 26px",
  "30px 24px 22px 18px",
];
const SPANS: Record<MuscleGroup, CSSProperties> = {
  chest: { gridColumn: "span 2" },
  back: { gridColumn: "span 2" },
  quads: { gridColumn: "span 1", gridRow: "span 2" },
  shoulders: { gridColumn: "span 1" },
  arms: { gridColumn: "span 1" },
  posterior: { gridColumn: "span 1", gridRow: "span 2" },
  core: { gridColumn: "span 1" },
  calves: { gridColumn: "span 1" },
};

export function FieldMap({ sets, compact }: { sets: MuscleSets; compact?: boolean }) {
  return (
    <div className={`fieldmap${compact ? " compact" : ""}`} role="list" aria-label="Set per muskelgrupp den här veckan">
      {MUSCLES.map((m, i) => {
        const v = sets[m.key] ?? 0;
        const ratio = Math.min(1, v / m.weeklyTarget);
        const under = v < m.weeklyTarget * 0.6;
        return (
          <div
            key={m.key}
            role="listitem"
            className={`field-plot${under ? " under" : ""}`}
            style={{
              ...(compact ? {} : SPANS[m.key]),
              borderRadius: SHAPES[i],
              background: `color-mix(in srgb, ${m.color} 16%, var(--card))`,
            }}
            title={`${m.label}: ${formatNumber(v, 1)} av ~${m.weeklyTarget} set`}
          >
            <svg className="rows" width="100%" height="100%" aria-hidden="true">
              <defs>
                <pattern id={`rows-${m.key}`} width="10" height="10" patternUnits="userSpaceOnUse" patternTransform="rotate(-8)">
                  <line x1="0" y1="5" x2="10" y2="5" stroke="var(--ink)" strokeWidth="1.2" />
                </pattern>
              </defs>
              <rect width="100%" height="100%" fill={`url(#rows-${m.key})`} />
            </svg>
            <div
              className="growth"
              style={{ height: `${ratio * 100}%`, background: `color-mix(in srgb, ${m.color} 62%, transparent)`, borderTop: ratio > 0 ? `3px solid ${m.color}` : "none" }}
            />
            <span className="f-label">{m.label}</span>
            <span className="f-num">
              {formatNumber(v, 1)}
              <small>/ {m.weeklyTarget}{compact ? "" : " set"}</small>
            </span>
          </div>
        );
      })}
    </div>
  );
}

export function Empty({ title, children, action }: { title: string; children?: ReactNode; action?: ReactNode }) {
  return (
    <div className="empty">
      <div className="display">{title}</div>
      {children && <p style={{ margin: "0 auto 16px", maxWidth: 420 }}>{children}</p>}
      {action}
    </div>
  );
}

// Liten solnedgångsinspirerad "sol" för översikten.
export function SunIllustration({ color = "var(--orange)" }: { color?: string }) {
  const rays = Array.from({ length: 11 }, (_, i) => -90 + (i - 5) * 15);
  return (
    <svg viewBox="0 0 120 70" width="96" height="56" aria-hidden="true">
      {rays.map((a) => {
        const r = (a * Math.PI) / 180;
        return (
          <line key={a} x1={60 + Math.cos(r) * 30} y1={62 + Math.sin(r) * 30} x2={60 + Math.cos(r) * 52} y2={62 + Math.sin(r) * 52} stroke={color} strokeWidth="2.5" strokeLinecap="round" />
        );
      })}
      <path d="M36 62 A24 24 0 0 1 84 62 Z" fill={color} />
      <line x1="10" y1="64" x2="110" y2="64" stroke="var(--ink)" strokeWidth="2.5" strokeLinecap="round" />
    </svg>
  );
}
