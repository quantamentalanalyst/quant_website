"use client";
import { useEffect, useRef, useState } from "react";
import * as d3 from "d3";

export type Pt = { x: number; y: number; date?: string };
export type Fit = { beta: number; alpha: number; r2: number; t: number; n: number };

// Scatter with an OLS regression line and a stats box (β, R², t, n). Used for
// the monthly growth-minus-value vs Δ10y regression.
export default function Scatter({
  points,
  fit,
  height = 320,
  xLabel = "",
  yLabel = "",
}: {
  points: Pt[];
  fit: Fit;
  height?: number;
  xLabel?: string;
  yLabel?: string;
}) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(560);
  useEffect(() => {
    if (!wrapRef.current) return;
    const ro = new ResizeObserver((es) => { for (const e of es) { const w = Math.floor(e.contentRect.width); if (w>0) setWidth(w); } });
    ro.observe(wrapRef.current);
    return () => ro.disconnect();
  }, []);

  const margin = { top: 10, right: 14, bottom: 30, left: 40 };
  const innerW = Math.max(10, width - margin.left - margin.right);
  const innerH = height - margin.top - margin.bottom;

  const xe = d3.extent(points, (p) => p.x) as [number, number];
  const ye = d3.extent(points, (p) => p.y) as [number, number];
  const padX = (xe[1] - xe[0]) * 0.08 || 1, padY = (ye[1] - ye[0]) * 0.08 || 1;
  const x = d3.scaleLinear().domain([xe[0] - padX, xe[1] + padX]).range([0, innerW]);
  const y = d3.scaleLinear().domain([ye[0] - padY, ye[1] + padY]).range([innerH, 0]);

  const x0 = x.domain()[0], x1 = x.domain()[1];
  const fitY = (xv: number) => fit.alpha + fit.beta * xv;

  return (
    <div ref={wrapRef} className="w-full">
      <svg width={width} height={height} className="block">
        <g transform={`translate(${margin.left},${margin.top})`}>
          {y.ticks(5).map((t) => (
            <g key={`y${t}`}>
              <line x1={0} x2={innerW} y1={y(t)} y2={y(t)} stroke="var(--color-rule)" />
              <text x={-6} y={y(t)+3} textAnchor="end" fontSize="10" fontFamily="var(--font-mono)" fill="var(--color-text-faint)">{t.toFixed(0)}</text>
            </g>
          ))}
          {x.ticks(6).map((t) => (
            <text key={`x${t}`} x={x(t)} y={innerH+14} textAnchor="middle" fontSize="10" fontFamily="var(--font-mono)" fill="var(--color-text-faint)">{t.toFixed(2)}</text>
          ))}
          {/* zero axes */}
          {x0 < 0 && x1 > 0 && <line x1={x(0)} x2={x(0)} y1={0} y2={innerH} stroke="var(--color-rule-strong)" strokeDasharray="2 2" />}
          {y.domain()[0] < 0 && y.domain()[1] > 0 && <line x1={0} x2={innerW} y1={y(0)} y2={y(0)} stroke="var(--color-rule-strong)" strokeDasharray="2 2" />}
          {/* regression line */}
          <line x1={x(x0)} y1={y(fitY(x0))} x2={x(x1)} y2={y(fitY(x1))} stroke="var(--color-accent)" strokeWidth={1.4} />
          {/* points */}
          {points.map((p, i) => (
            <circle key={i} cx={x(p.x)} cy={y(p.y)} r={2.6} fill="var(--color-data)" opacity={0.75} />
          ))}
          {/* axis titles */}
          <text x={innerW} y={innerH + 26} textAnchor="end" fontSize="10" fontFamily="var(--font-mono)" fill="var(--color-text-dim)">{xLabel}</text>
          <text x={0} y={-1} textAnchor="start" fontSize="10" fontFamily="var(--font-mono)" fill="var(--color-text-dim)">{yLabel}</text>
          {/* stats box */}
          <g transform={`translate(${innerW - 116}, 6)`}>
            <rect x={0} y={0} width={116} height={56} fill="var(--color-bg-sunken)" stroke="var(--color-rule-strong)" />
            <text x={8} y={15} fontSize="10" fontFamily="var(--font-mono)" fill="var(--color-text-dim)">β = <tspan fill="var(--color-text)">{fit.beta.toFixed(2)}</tspan></text>
            <text x={8} y={29} fontSize="10" fontFamily="var(--font-mono)" fill="var(--color-text-dim)">t = <tspan fill="var(--color-text)">{fit.t.toFixed(1)}</tspan></text>
            <text x={8} y={43} fontSize="10" fontFamily="var(--font-mono)" fill="var(--color-text-dim)">R² = <tspan fill="var(--color-text)">{fit.r2.toFixed(3)}</tspan></text>
            <text x={70} y={43} fontSize="10" fontFamily="var(--font-mono)" fill="var(--color-text-dim)">n = <tspan fill="var(--color-text)">{fit.n}</tspan></text>
          </g>
        </g>
      </svg>
    </div>
  );
}
