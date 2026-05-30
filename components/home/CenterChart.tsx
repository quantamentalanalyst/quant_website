"use client";
import { useEffect, useMemo, useRef, useState } from "react";
import * as d3 from "d3";

type Point = { date: string; value: number };

export default function CenterChart({
  data,
  yLabel = "",
  showStats = true,
  valueLabel = "NAV",
  height = 360,
  showDrawdown = true,
}: {
  data: Point[];
  yLabel?: string;
  // When false, the absolute stat header (NAV/ret/cagr/mdd) is hidden — used
  // when a caller (e.g. the index detail modal) renders its own header.
  showStats?: boolean;
  valueLabel?: string;
  height?: number;
  // When false, the faint red max-drawdown shading is omitted.
  showDrawdown?: boolean;
}) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(800);

  useEffect(() => {
    if (!wrapRef.current) return;
    const ro = new ResizeObserver((entries) => {
      for (const e of entries) {
        const w = Math.floor(e.contentRect.width);
        if (w > 0) setWidth(w);
      }
    });
    ro.observe(wrapRef.current);
    return () => ro.disconnect();
  }, []);

  const margin = { top: 12, right: 56, bottom: 24, left: 8 };
  const innerW = Math.max(10, width - margin.left - margin.right);
  const innerH = height - margin.top - margin.bottom;

  const parsed = useMemo(
    () => data.map((d) => ({ date: d.date, t: new Date(d.date), value: d.value })),
    [data],
  );

  const x = useMemo(
    () => d3.scaleTime().domain(d3.extent(parsed, (d) => d.t) as [Date, Date]).range([0, innerW]),
    [parsed, innerW],
  );
  const yDomain = useMemo(() => {
    const lo = d3.min(parsed, (d) => d.value)!;
    const hi = d3.max(parsed, (d) => d.value)!;
    const pad = (hi - lo) * 0.06;
    return [lo - pad, hi + pad] as [number, number];
  }, [parsed]);
  const y = useMemo(() => d3.scaleLinear().domain(yDomain).range([innerH, 0]), [yDomain, innerH]);

  const linePath = useMemo(() => {
    const line = d3
      .line<(typeof parsed)[number]>()
      .x((d) => x(d.t))
      .y((d) => y(d.value))
      .curve(d3.curveMonotoneX);
    return line(parsed) ?? "";
  }, [parsed, x, y]);

  // Compute peak-to-trough max drawdown shaded region for added meaning.
  const dd = useMemo(() => {
    let peak = parsed[0]?.value ?? 0;
    let peakIdx = 0;
    let worst = 0;
    let worstStart = 0;
    let worstEnd = 0;
    for (let i = 0; i < parsed.length; i++) {
      const v = parsed[i]!.value;
      if (v > peak) {
        peak = v;
        peakIdx = i;
      }
      const draw = v / peak - 1;
      if (draw < worst) {
        worst = draw;
        worstStart = peakIdx;
        worstEnd = i;
      }
    }
    return { worst, start: parsed[worstStart], end: parsed[worstEnd] };
  }, [parsed]);

  const xTicks = x.ticks(6);
  const yTicks = y.ticks(5);

  // Adaptive x-axis label format: short windows show month/day, medium windows
  // month + 2-digit year, long windows just the year. Avoids "2026 2026 2026".
  const spanDays =
    (parsed.at(-1)!.t.getTime() - parsed[0]!.t.getTime()) / (24 * 3600 * 1000);
  const xFmt =
    spanDays <= 95
      ? d3.timeFormat("%b %d")
      : spanDays <= 400
        ? d3.timeFormat("%b ’%y")
        : d3.timeFormat("%Y");

  const [hover, setHover] = useState<{ x: number; y: number; pt: Point } | null>(null);

  function onMove(e: React.MouseEvent<SVGRectElement>) {
    const rect = (e.currentTarget as SVGRectElement).getBoundingClientRect();
    const mx = e.clientX - rect.left;
    const t = x.invert(mx);
    const bi = d3.bisector<(typeof parsed)[number], Date>((d) => d.t).left;
    const idx = Math.min(Math.max(bi(parsed, t), 0), parsed.length - 1);
    const pt = parsed[idx]!;
    setHover({ x: x(pt.t), y: y(pt.value), pt: { date: pt.date, value: pt.value } });
  }

  const final = parsed[parsed.length - 1]?.value ?? 0;
  const initial = parsed[0]?.value ?? 100;
  const totalRet = final / initial - 1;
  const years = (parsed.at(-1)!.t.getTime() - parsed[0]!.t.getTime()) / (365.25 * 24 * 3600 * 1000);
  const cagr = Math.pow(final / initial, 1 / years) - 1;

  return (
    <div ref={wrapRef} className="relative w-full" style={{ height }}>
      {/* Summary stats line — Bloomberg-ish header */}
      {showStats && (
        <div className="absolute left-0 top-0 z-10 flex items-baseline gap-4 text-xs text-text-dim">
          <span>
            {valueLabel} <span className="font-tabular text-text">{final.toFixed(2)}</span>
          </span>
          <span>
            ret <span className={totalRet >= 0 ? "font-tabular text-pos" : "font-tabular text-neg"}>
              {(totalRet * 100).toFixed(1)}%
            </span>
          </span>
          <span>
            cagr <span className={cagr >= 0 ? "font-tabular text-pos" : "font-tabular text-neg"}>
              {(cagr * 100).toFixed(2)}%
            </span>
          </span>
          <span>
            mdd <span className="font-tabular text-neg">{(dd.worst * 100).toFixed(1)}%</span>
          </span>
        </div>
      )}

      <svg width={width} height={height} className="block overflow-visible">
        <g transform={`translate(${margin.left},${margin.top})`}>
          {/* Horizontal gridlines */}
          {yTicks.map((t) => (
            <line
              key={`gy-${t}`}
              x1={0}
              x2={innerW}
              y1={y(t)}
              y2={y(t)}
              stroke="var(--color-rule)"
              strokeWidth={1}
            />
          ))}
          {/* Vertical year gridlines */}
          {xTicks.map((t, i) => (
            <line
              key={`gx-${i}`}
              x1={x(t)}
              x2={x(t)}
              y1={0}
              y2={innerH}
              stroke="var(--color-rule)"
              strokeWidth={1}
              strokeDasharray="2 4"
              opacity={0.4}
            />
          ))}

          {/* Drawdown shading */}
          {showDrawdown && dd.start && dd.end && (
            <rect
              x={x(new Date(dd.start.date))}
              y={0}
              width={Math.max(0, x(new Date(dd.end.date)) - x(new Date(dd.start.date)))}
              height={innerH}
              fill="var(--color-neg)"
              opacity={0.04}
            />
          )}

          {/* The line */}
          <path d={linePath} fill="none" stroke="var(--color-accent)" strokeWidth={1.25} />

          {/* x-axis labels */}
          {xTicks.map((t, i) => (
            <text
              key={`xt-${i}`}
              x={x(t)}
              y={innerH + 14}
              fill="var(--color-text-faint)"
              textAnchor="middle"
              fontSize="10"
              fontFamily="var(--font-mono)"
            >
              {xFmt(t)}
            </text>
          ))}
          {/* y-axis labels on the right */}
          {yTicks.map((t, i) => (
            <text
              key={`yt-${i}`}
              x={innerW + 6}
              y={y(t) + 3}
              fill="var(--color-text-faint)"
              textAnchor="start"
              fontSize="10"
              fontFamily="var(--font-mono)"
            >
              {t.toFixed(0)}
            </text>
          ))}
          {/* y-axis title */}
          {yLabel && (
            <text
              x={innerW}
              y={innerH + 14}
              fill="var(--color-text-faint)"
              textAnchor="end"
              fontSize="9"
              fontFamily="var(--font-mono)"
              letterSpacing="0.06em"
            >
              {yLabel}
            </text>
          )}

          {/* Crosshair on hover */}
          {hover && (
            <>
              <line
                x1={hover.x}
                x2={hover.x}
                y1={0}
                y2={innerH}
                stroke="var(--color-text-dim)"
                strokeWidth={1}
                strokeDasharray="2 2"
              />
              <line
                x1={0}
                x2={innerW}
                y1={hover.y}
                y2={hover.y}
                stroke="var(--color-text-dim)"
                strokeWidth={1}
                strokeDasharray="2 2"
              />
              <circle cx={hover.x} cy={hover.y} r={2.5} fill="var(--color-accent)" />
            </>
          )}

          {/* Mouse capture */}
          <rect
            x={0}
            y={0}
            width={innerW}
            height={innerH}
            fill="transparent"
            onMouseMove={onMove}
            onMouseLeave={() => setHover(null)}
          />
        </g>
      </svg>

      {hover && (
        <div
          className="pointer-events-none absolute z-20 border border-rule-strong bg-bg-sunken px-2 py-1 text-[11px]"
          style={{
            left: Math.min(width - 120, hover.x + margin.left + 10),
            top: hover.y + margin.top - 4,
          }}
        >
          <div className="font-tabular text-text-dim">{hover.pt.date}</div>
          <div className="font-tabular text-text">{hover.pt.value.toFixed(2)}</div>
        </div>
      )}
    </div>
  );
}
