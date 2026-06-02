"use client";
import { useEffect, useRef, useState } from "react";
import * as d3 from "d3";

export type BarRow = { label: string; value: number; tag?: string; faint?: boolean };

// Horizontal bar chart from a zero baseline, P&L-colored (pos green / neg red),
// value label at the bar end and an optional right-aligned annotation (e.g. a
// t-statistic). Category labels sit on the left.
export default function BarH({
  rows,
  height,
  unit = "",
  decimals = 2,
  labelWidth = 96,
  tagWidth = 64,
  color,
}: {
  rows: BarRow[];
  height?: number;
  unit?: string;
  decimals?: number;
  labelWidth?: number;
  tagWidth?: number;
  // When set, all bars use this single color (for non-P&L metrics like ROE);
  // otherwise bars are green/red by sign.
  color?: string;
}) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(640);
  useEffect(() => {
    if (!wrapRef.current) return;
    const ro = new ResizeObserver((es) => { for (const e of es) { const w = Math.floor(e.contentRect.width); if (w>0) setWidth(w); } });
    ro.observe(wrapRef.current);
    return () => ro.disconnect();
  }, []);

  const rowH = 22, gap = 6;
  const h = height ?? rows.length * (rowH + gap) + 16;
  const plotL = labelWidth + 8;
  const plotR = tagWidth + 8;
  const innerW = Math.max(10, width - plotL - plotR);

  const maxAbs = Math.max(...rows.map((r) => Math.abs(r.value))) * 1.15 || 1;
  const x = d3.scaleLinear().domain([-maxAbs, maxAbs]).range([0, innerW]);
  const zero = x(0);

  return (
    <div ref={wrapRef} className="w-full">
      <svg width={width} height={h} className="block">
        {/* zero baseline */}
        <line x1={plotL + zero} x2={plotL + zero} y1={4} y2={h - 8} stroke="var(--color-rule-strong)" />
        {rows.map((r, i) => {
          const y = 8 + i * (rowH + gap);
          const pos = r.value >= 0;
          const bx = plotL + Math.min(zero, x(r.value));
          const bw = Math.abs(x(r.value) - zero);
          const barColor = color ?? (pos ? "var(--color-pos)" : "var(--color-neg)");
          return (
            <g key={r.label}>
              <text x={labelWidth} y={y + rowH / 2 + 3} textAnchor="end" fontSize="11" fontFamily="var(--font-mono)"
                fill={r.faint ? "var(--color-text-faint)" : "var(--color-text)"}>{r.label}</text>
              <rect x={bx} y={y} width={bw} height={rowH} fill={barColor} opacity={r.faint ? 0.35 : 0.85} />
              <text x={pos ? bx + bw + 4 : bx - 4} y={y + rowH / 2 + 3} textAnchor={pos ? "start" : "end"}
                fontSize="10" fontFamily="var(--font-mono)" fill={barColor} className="font-tabular">
                {pos ? "+" : "−"}{Math.abs(r.value).toFixed(decimals)}{unit}
              </text>
              {r.tag && (
                <text x={width - 4} y={y + rowH / 2 + 3} textAnchor="end" fontSize="10" fontFamily="var(--font-mono)"
                  fill="var(--color-text-faint)" className="font-tabular">{r.tag}</text>
              )}
            </g>
          );
        })}
      </svg>
    </div>
  );
}
