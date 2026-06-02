"use client";
import { useEffect, useRef, useState } from "react";
import * as d3 from "d3";

export type BubblePt = { x: number; y: number; size: number; label: string };

// Bubble scatter for the DuPont map: x = net margin, y = asset turnover, bubble
// radius ∝ √(leverage). Single accent fill (palette-disciplined); the three
// "roads to ROE" are read from position (turnover = top-left, margin = right)
// and size (leverage = big bubbles). Tickers labelled beside each bubble.
export default function Bubble({
  points,
  height = 360,
  xLabel = "",
  yLabel = "",
  xUnit = "",
}: {
  points: BubblePt[];
  height?: number;
  xLabel?: string;
  yLabel?: string;
  xUnit?: string;
}) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(600);
  useEffect(() => {
    if (!wrapRef.current) return;
    const ro = new ResizeObserver((es) => { for (const e of es) { const w = Math.floor(e.contentRect.width); if (w>0) setWidth(w); } });
    ro.observe(wrapRef.current);
    return () => ro.disconnect();
  }, []);

  const margin = { top: 12, right: 16, bottom: 32, left: 42 };
  const innerW = Math.max(10, width - margin.left - margin.right);
  const innerH = height - margin.top - margin.bottom;

  const xe = d3.extent(points, (p) => p.x) as [number, number];
  const ye = d3.extent(points, (p) => p.y) as [number, number];
  const x = d3.scaleLinear().domain([Math.min(0, xe[0]), xe[1] * 1.08]).range([0, innerW]);
  const y = d3.scaleLinear().domain([0, ye[1] * 1.1]).range([innerH, 0]);
  const r = d3.scaleSqrt().domain([0, d3.max(points, (p) => p.size) ?? 1]).range([3, 26]);

  return (
    <div ref={wrapRef} className="w-full">
      <svg width={width} height={height} className="block">
        <g transform={`translate(${margin.left},${margin.top})`}>
          {y.ticks(5).map((t) => (
            <g key={`y${t}`}>
              <line x1={0} x2={innerW} y1={y(t)} y2={y(t)} stroke="var(--color-rule)" />
              <text x={-6} y={y(t) + 3} textAnchor="end" fontSize="10" fontFamily="var(--font-mono)" fill="var(--color-text-faint)">{t.toFixed(1)}</text>
            </g>
          ))}
          {x.ticks(6).map((t) => (
            <text key={`x${t}`} x={x(t)} y={innerH + 14} textAnchor="middle" fontSize="10" fontFamily="var(--font-mono)" fill="var(--color-text-faint)">{t.toFixed(0)}{xUnit}</text>
          ))}
          {points.map((p) => (
            <g key={p.label}>
              <circle cx={x(p.x)} cy={y(p.y)} r={r(p.size)} fill="var(--color-accent)" fillOpacity={0.16} stroke="var(--color-accent)" strokeWidth={1} />
              <text x={x(p.x) + r(p.size) + 3} y={y(p.y) + 3} fontSize="9.5" fontFamily="var(--font-mono)" fill="var(--color-text)">{p.label}</text>
            </g>
          ))}
          <text x={innerW} y={innerH + 26} textAnchor="end" fontSize="10" fontFamily="var(--font-mono)" fill="var(--color-text-dim)">{xLabel}</text>
          <text x={0} y={-1} textAnchor="start" fontSize="10" fontFamily="var(--font-mono)" fill="var(--color-text-dim)">{yLabel}</text>
        </g>
      </svg>
    </div>
  );
}
