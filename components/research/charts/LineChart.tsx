"use client";
import { useEffect, useMemo, useRef, useState } from "react";
import * as d3 from "d3";

export type Series = {
  name: string;
  color: string; // CSS color (token var or hex)
  axis?: "left" | "right";
  data: { date: string; value: number }[];
};

// Multi-series time line chart in the site theme: thin gridlines, mono tick
// labels, optional second (right) y-axis, optional zero reference line, and a
// shared hover crosshair with a per-series tooltip.
export default function LineChart({
  series,
  height = 300,
  yLabelLeft = "",
  yLabelRight = "",
  zeroLine = false,
  decimalsLeft = 2,
  decimalsRight = 2,
}: {
  series: Series[];
  height?: number;
  yLabelLeft?: string;
  yLabelRight?: string;
  zeroLine?: boolean;
  decimalsLeft?: number;
  decimalsRight?: number;
}) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(640);
  useEffect(() => {
    if (!wrapRef.current) return;
    const ro = new ResizeObserver((es) => {
      for (const e of es) { const w = Math.floor(e.contentRect.width); if (w > 0) setWidth(w); }
    });
    ro.observe(wrapRef.current);
    return () => ro.disconnect();
  }, []);

  const hasRight = series.some((s) => s.axis === "right");
  const margin = { top: 8, right: hasRight ? 48 : 16, bottom: 22, left: 44 };
  const innerW = Math.max(10, width - margin.left - margin.right);
  const innerH = height - margin.top - margin.bottom;

  const parsed = useMemo(
    () => series.map((s) => ({ ...s, pts: s.data.map((d) => ({ t: new Date(d.date), v: d.value, date: d.date })) })),
    [series],
  );

  const allT = useMemo(() => parsed.flatMap((s) => s.pts.map((p) => p.t)), [parsed]);
  const x = useMemo(() => d3.scaleTime().domain(d3.extent(allT) as [Date, Date]).range([0, innerW]), [allT, innerW]);

  const mkY = (axis: "left" | "right") => {
    const vs = parsed.filter((s) => (s.axis ?? "left") === axis).flatMap((s) => s.pts.map((p) => p.v));
    if (vs.length === 0) return d3.scaleLinear().domain([0, 1]).range([innerH, 0]);
    let lo = Math.min(...vs), hi = Math.max(...vs);
    if (zeroLine && axis === "left") { lo = Math.min(lo, 0); hi = Math.max(hi, 0); }
    const pad = (hi - lo) * 0.08 || 1;
    return d3.scaleLinear().domain([lo - pad, hi + pad]).range([innerH, 0]);
  };
  const yL = useMemo(() => mkY("left"), [parsed, innerH, zeroLine]); // eslint-disable-line
  const yR = useMemo(() => mkY("right"), [parsed, innerH]); // eslint-disable-line

  const spanDays = allT.length ? (d3.max(allT)!.getTime() - d3.min(allT)!.getTime()) / 86400000 : 0;
  const xFmt = spanDays <= 95 ? d3.timeFormat("%b %d") : spanDays <= 400 ? d3.timeFormat("%b ’%y") : d3.timeFormat("%Y");

  const line = (s: (typeof parsed)[number]) => {
    const y = (s.axis ?? "left") === "right" ? yR : yL;
    return d3.line<{ t: Date; v: number }>().x((d) => x(d.t)).y((d) => y(d.v)).curve(d3.curveMonotoneX)(s.pts) ?? "";
  };

  const [hoverX, setHoverX] = useState<number | null>(null);
  const hoverPts = useMemo(() => {
    if (hoverX == null) return null;
    const t = x.invert(hoverX);
    const bi = d3.bisector<{ t: Date }, Date>((d) => d.t).left;
    return parsed.map((s) => {
      const i = Math.min(Math.max(bi(s.pts, t), 0), s.pts.length - 1);
      const p = s.pts[i]!;
      const y = (s.axis ?? "left") === "right" ? yR : yL;
      return { name: s.name, color: s.color, x: x(p.t), y: y(p.v), v: p.v, date: p.date, axis: s.axis ?? "left" };
    });
  }, [hoverX, parsed, x, yL, yR]);

  const xTicks = x.ticks(6), yLTicks = yL.ticks(5), yRTicks = yR.ticks(5);

  return (
    <div ref={wrapRef} className="relative w-full">
      {/* legend */}
      <div className="mb-1.5 flex flex-wrap gap-x-4 gap-y-1 text-[10px] text-text-dim">
        {series.map((s) => (
          <span key={s.name} className="inline-flex items-center gap-1.5">
            <span className="inline-block h-[2px] w-3.5" style={{ backgroundColor: s.color }} />
            {s.name}
          </span>
        ))}
      </div>
      <svg width={width} height={height} className="block">
        <g transform={`translate(${margin.left},${margin.top})`}>
          {yLTicks.map((t) => (
            <line key={`g${t}`} x1={0} x2={innerW} y1={yL(t)} y2={yL(t)} stroke="var(--color-rule)" />
          ))}
          {zeroLine && (
            <line x1={0} x2={innerW} y1={yL(0)} y2={yL(0)} stroke="var(--color-rule-strong)" strokeDasharray="3 3" />
          )}
          {parsed.map((s) => (
            <path key={s.name} d={line(s)} fill="none" stroke={s.color} strokeWidth={1.3} />
          ))}
          {xTicks.map((t, i) => (
            <text key={i} x={x(t)} y={innerH + 14} fill="var(--color-text-faint)" textAnchor="middle" fontSize="10" fontFamily="var(--font-mono)">
              {xFmt(t)}
            </text>
          ))}
          {yLTicks.map((t) => (
            <text key={`l${t}`} x={-6} y={yL(t) + 3} fill="var(--color-text-faint)" textAnchor="end" fontSize="10" fontFamily="var(--font-mono)">
              {t.toFixed(decimalsLeft)}
            </text>
          ))}
          {hasRight && yRTicks.map((t) => (
            <text key={`r${t}`} x={innerW + 6} y={yR(t) + 3} fill="var(--color-text-faint)" textAnchor="start" fontSize="10" fontFamily="var(--font-mono)">
              {t.toFixed(decimalsRight)}
            </text>
          ))}
          {yLabelLeft && (
            <text x={2} y={-1} fill="var(--color-text-faint)" textAnchor="start" fontSize="9" fontFamily="var(--font-mono)" letterSpacing="0.04em">{yLabelLeft}</text>
          )}
          {yLabelRight && hasRight && (
            <text x={innerW - 2} y={-1} fill="var(--color-text-faint)" textAnchor="end" fontSize="9" fontFamily="var(--font-mono)" letterSpacing="0.04em">{yLabelRight}</text>
          )}
          {hoverX != null && (
            <line x1={hoverX} x2={hoverX} y1={0} y2={innerH} stroke="var(--color-text-dim)" strokeDasharray="2 2" />
          )}
          {hoverPts?.map((p) => (
            <circle key={p.name} cx={p.x} cy={p.y} r={2.5} fill={p.color} />
          ))}
          <rect x={0} y={0} width={innerW} height={innerH} fill="transparent"
            onMouseMove={(e) => { const r = (e.currentTarget as SVGRectElement).getBoundingClientRect(); setHoverX(e.clientX - r.left); }}
            onMouseLeave={() => setHoverX(null)} />
        </g>
      </svg>
      {hoverPts && hoverX != null && (
        <div className="pointer-events-none absolute z-20 border border-rule-strong bg-bg-sunken px-2 py-1 text-[10px]"
          style={{ left: Math.min(width - 130, hoverX + margin.left + 8), top: 4 }}>
          <div className="font-tabular text-text-dim">{hoverPts[0]?.date}</div>
          {hoverPts.map((p) => (
            <div key={p.name} className="flex items-center justify-between gap-3">
              <span className="inline-flex items-center gap-1" style={{ color: p.color }}>
                <span className="inline-block h-[2px] w-2.5" style={{ backgroundColor: p.color }} />{p.name}
              </span>
              <span className="font-tabular text-text">{p.v.toFixed(p.axis === "right" ? decimalsRight : decimalsLeft)}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
