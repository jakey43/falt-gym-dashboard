// Enkla, handbyggda SVG-diagram: tunna linjer, rundade staplar, hover-tooltip
// och en tabellvy för tillgänglighet.
import { useEffect, useRef, useState } from "react";
import type { ReactNode } from "react";

function useWidth<T extends HTMLElement>(): [React.RefObject<T | null>, number] {
  const ref = useRef<T>(null);
  const [w, setW] = useState(0);
  useEffect(() => {
    if (!ref.current) return;
    const el = ref.current;
    setW(el.clientWidth);
    const ro = new ResizeObserver(() => setW(el.clientWidth));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  return [ref, w];
}

function niceTicks(min: number, max: number, count = 4): number[] {
  if (min === max) {
    const d = Math.abs(min) * 0.1 || 1;
    min -= d;
    max += d;
  }
  const span = max - min;
  const step0 = span / count;
  const mag = 10 ** Math.floor(Math.log10(step0));
  const norm = step0 / mag;
  const step = (norm >= 5 ? 10 : norm >= 2 ? 5 : norm >= 1.5 ? 2 : 1) * mag;
  const start = Math.floor(min / step) * step;
  const ticks: number[] = [];
  for (let v = start; v <= max + step * 0.5; v += step) ticks.push(Math.round(v * 1e6) / 1e6);
  return ticks;
}

export interface Point {
  x: string; // etikett (t.ex. datum)
  y: number | null;
  tip?: string; // extra rad i tooltip
}

interface LineChartProps {
  points: Point[];
  color: string;
  height?: number;
  format: (v: number) => string;
  xFormat?: (x: string) => string;
  goal?: number | null;
  goalLabel?: string;
  area?: boolean;
  ariaLabel: string;
}

export function LineChart({ points, color, height = 200, format, xFormat = (x) => x, goal, goalLabel, area = true, ariaLabel }: LineChartProps) {
  const [ref, width] = useWidth<HTMLDivElement>();
  const [hover, setHover] = useState<number | null>(null);
  const valid = points.map((p, i) => ({ ...p, i })).filter((p) => p.y != null) as (Point & { i: number; y: number })[];
  const padL = 40;
  const padR = 12;
  const padT = 12;
  const padB = 26;
  const innerW = Math.max(10, width - padL - padR);
  const innerH = height - padT - padB;

  const ys = valid.map((p) => p.y);
  if (goal != null) ys.push(goal);
  const lo = ys.length ? Math.min(...ys) : 0;
  const hi = ys.length ? Math.max(...ys) : 1;
  const ticks = niceTicks(lo, hi);
  const yMin = ticks[0];
  const yMax = ticks[ticks.length - 1];
  const x = (i: number) => padL + (points.length <= 1 ? innerW / 2 : (i / (points.length - 1)) * innerW);
  const y = (v: number) => padT + innerH - ((v - yMin) / (yMax - yMin || 1)) * innerH;

  const path = valid.map((p, k) => `${k === 0 ? "M" : "L"}${x(p.i).toFixed(1)},${y(p.y).toFixed(1)}`).join(" ");
  const areaPath = valid.length > 1 ? `${path} L${x(valid[valid.length - 1].i)},${padT + innerH} L${x(valid[0].i)},${padT + innerH} Z` : "";
  const gradId = `g-${ariaLabel.replace(/\W/g, "")}`;

  const xLabelEvery = Math.max(1, Math.ceil(points.length / Math.max(2, Math.floor(innerW / 70))));

  function onMove(e: React.PointerEvent<SVGSVGElement>) {
    const rect = e.currentTarget.getBoundingClientRect();
    const px = e.clientX - rect.left;
    let best: number | null = null;
    let bestD = Infinity;
    for (const p of valid) {
      const d = Math.abs(x(p.i) - px);
      if (d < bestD) {
        bestD = d;
        best = p.i;
      }
    }
    setHover(best);
  }

  const hp = hover != null ? points[hover] : null;

  return (
    <div className="chart" ref={ref}>
      {width > 0 && (
        <svg width={width} height={height} role="img" aria-label={ariaLabel} onPointerMove={onMove} onPointerLeave={() => setHover(null)}>
          <defs>
            <linearGradient id={gradId} x1="0" x2="0" y1="0" y2="1">
              <stop offset="0%" stopColor={color} stopOpacity="0.28" />
              <stop offset="100%" stopColor={color} stopOpacity="0" />
            </linearGradient>
          </defs>
          <g className="axis">
            {ticks.map((t) => (
              <g key={t}>
                <line className="grid-line" x1={padL} x2={width - padR} y1={y(t)} y2={y(t)} />
                <text x={padL - 8} y={y(t) + 3} textAnchor="end">
                  {format(t)}
                </text>
              </g>
            ))}
            {points.map((p, i) =>
              i % xLabelEvery === 0 || i === points.length - 1 ? (
                <text key={i} x={x(i)} y={height - 6} textAnchor={i === 0 ? "start" : i === points.length - 1 ? "end" : "middle"}>
                  {xFormat(p.x)}
                </text>
              ) : null,
            )}
          </g>
          {goal != null && (
            <g>
              <line x1={padL} x2={width - padR} y1={y(goal)} y2={y(goal)} stroke="var(--ink)" strokeDasharray="4 5" strokeWidth={1.5} opacity={0.6} />
              {goalLabel && (
                <text x={width - padR} y={y(goal) - 6} textAnchor="end" className="sublabel" style={{ fontFamily: "var(--font-mono)", fontSize: 10, fill: "var(--ink-2)" }}>
                  {goalLabel}
                </text>
              )}
            </g>
          )}
          {area && areaPath && <path d={areaPath} fill={`url(#${gradId})`} />}
          <path d={path} fill="none" stroke={color} strokeWidth={2.5} strokeLinejoin="round" strokeLinecap="round" />
          {valid.length <= 16 &&
            valid.map((p) => <circle key={p.i} cx={x(p.i)} cy={y(p.y)} r={3.5} fill="var(--card)" stroke={color} strokeWidth={2} />)}
          {hp && hp.y != null && (
            <g>
              <line x1={x(hover!)} x2={x(hover!)} y1={padT} y2={padT + innerH} stroke="var(--ink)" strokeWidth={1} opacity={0.3} />
              <circle cx={x(hover!)} cy={y(hp.y)} r={6} fill={color} stroke="var(--card)" strokeWidth={2.5} />
            </g>
          )}
        </svg>
      )}
      {hp && hp.y != null && (
        <div className="tooltip" style={{ left: x(hover!), top: y(hp.y) }}>
          <div className="t-label">{xFormat(hp.x)}</div>
          <strong>{format(hp.y)}</strong>
          {hp.tip && <div style={{ opacity: 0.8 }}>{hp.tip}</div>}
        </div>
      )}
    </div>
  );
}

export interface Bar {
  key: string;
  label: string;
  value: number | null;
  color?: string;
  tip?: string;
}

interface BarChartProps {
  bars: Bar[];
  color: string;
  height?: number;
  format: (v: number) => string;
  goal?: number | null;
  goalLabel?: string;
  ariaLabel: string;
  highlightLast?: boolean;
}

export function BarChart({ bars, color, height = 190, format, goal, goalLabel, ariaLabel, highlightLast }: BarChartProps) {
  const [ref, width] = useWidth<HTMLDivElement>();
  const [hover, setHover] = useState<number | null>(null);
  const padL = 40;
  const padR = 8;
  const padT = 14;
  const padB = 26;
  const innerW = Math.max(10, width - padL - padR);
  const innerH = height - padT - padB;
  const vals = bars.map((b) => b.value ?? 0);
  if (goal != null) vals.push(goal);
  const ticks = niceTicks(0, Math.max(1, ...vals));
  const yMax = ticks[ticks.length - 1];
  const slot = innerW / Math.max(1, bars.length);
  const bw = Math.max(4, Math.min(38, slot - 6)); // 2px+ mellanrum
  const y = (v: number) => padT + innerH - (v / yMax) * innerH;
  const r = Math.min(6, bw / 2);
  const labelEvery = Math.max(1, Math.ceil(bars.length / Math.max(2, Math.floor(innerW / 44))));

  return (
    <div className="chart" ref={ref}>
      {width > 0 && (
        <svg width={width} height={height} role="img" aria-label={ariaLabel} onPointerLeave={() => setHover(null)}>
          <g className="axis">
            {ticks.map((t) => (
              <g key={t}>
                <line className="grid-line" x1={padL} x2={width - padR} y1={y(t)} y2={y(t)} />
                <text x={padL - 8} y={y(t) + 3} textAnchor="end">
                  {format(t)}
                </text>
              </g>
            ))}
            {bars.map((b, i) =>
              i % labelEvery === 0 || i === bars.length - 1 ? (
                <text key={b.key} x={padL + slot * i + slot / 2} y={height - 6} textAnchor="middle">
                  {b.label}
                </text>
              ) : null,
            )}
          </g>
          {bars.map((b, i) => {
            const v = b.value ?? 0;
            const bx = padL + slot * i + (slot - bw) / 2;
            const by = y(v);
            const fill = b.color ?? color;
            const faded = highlightLast && i !== bars.length - 1 && hover == null;
            return (
              <g key={b.key} onPointerEnter={() => setHover(i)}>
                <rect x={padL + slot * i} y={padT} width={slot} height={innerH} fill="transparent" />
                {b.value == null ? (
                  <rect x={bx} y={padT + innerH - 3} width={bw} height={3} rx={1.5} fill="var(--line-strong)" />
                ) : (
                  <path
                    d={`M${bx},${padT + innerH} L${bx},${by + r} Q${bx},${by} ${bx + r},${by} L${bx + bw - r},${by} Q${bx + bw},${by} ${bx + bw},${by + r} L${bx + bw},${padT + innerH} Z`}
                    fill={fill}
                    opacity={hover != null && hover !== i ? 0.45 : faded ? 0.65 : 1}
                  />
                )}
              </g>
            );
          })}
          {goal != null && (
            <g pointerEvents="none">
              <line x1={padL} x2={width - padR} y1={y(goal)} y2={y(goal)} stroke="var(--ink)" strokeDasharray="4 5" strokeWidth={1.5} opacity={0.6} />
              {goalLabel && (
                <text x={width - padR} y={y(goal) - 6} textAnchor="end" style={{ fontFamily: "var(--font-mono)", fontSize: 10, fill: "var(--ink-2)" }}>
                  {goalLabel}
                </text>
              )}
            </g>
          )}
        </svg>
      )}
      {hover != null && bars[hover] && (
        <div className="tooltip" style={{ left: padL + slot * hover + slot / 2, top: y(bars[hover].value ?? 0) }}>
          <div className="t-label">{bars[hover].label}</div>
          <strong>{bars[hover].value == null ? "Ingen data" : format(bars[hover].value!)}</strong>
          {bars[hover].tip && <div style={{ opacity: 0.8 }}>{bars[hover].tip}</div>}
        </div>
      )}
    </div>
  );
}

// Ram runt ett diagram med växling till tabellvy.
export function ChartFrame({
  children,
  table,
}: {
  children: ReactNode;
  table: { head: string[]; rows: (string | number)[][] };
}) {
  const [showTable, setShowTable] = useState(false);
  return (
    <div>
      {showTable ? (
        <div className="table-wrap" style={{ maxHeight: 260, overflowY: "auto" }}>
          <table className="data">
            <thead>
              <tr>
                {table.head.map((h, i) => (
                  <th key={h} className={i > 0 ? "num" : ""}>
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {table.rows.map((r, i) => (
                <tr key={i}>
                  {r.map((c, j) => (
                    <td key={j} className={j > 0 ? "num" : ""}>
                      {c}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        children
      )}
      <div style={{ marginTop: 8, textAlign: "right" }}>
        <button className="table-toggle" onClick={() => setShowTable((s) => !s)}>
          {showTable ? "Visa diagram" : "Visa som tabell"}
        </button>
      </div>
    </div>
  );
}

export function Sparkline({ values, color, width = 120, height = 36 }: { values: (number | null)[]; color: string; width?: number; height?: number }) {
  const v = values.map((n, i) => ({ n, i })).filter((p) => p.n != null) as { n: number; i: number }[];
  if (v.length < 2) return null;
  const lo = Math.min(...v.map((p) => p.n));
  const hi = Math.max(...v.map((p) => p.n));
  const x = (i: number) => 3 + (i / (values.length - 1)) * (width - 6);
  const y = (n: number) => 3 + (height - 6) - ((n - lo) / (hi - lo || 1)) * (height - 6);
  const d = v.map((p, k) => `${k ? "L" : "M"}${x(p.i).toFixed(1)},${y(p.n).toFixed(1)}`).join(" ");
  const last = v[v.length - 1];
  return (
    <svg width={width} height={height} aria-hidden="true" style={{ overflow: "visible" }}>
      <path d={d} fill="none" stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
      <circle cx={x(last.i)} cy={y(last.n)} r={4} fill={color} stroke="var(--card)" strokeWidth={2} />
    </svg>
  );
}
