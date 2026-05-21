export function Sparkline({
  data,
  pos = true,
  width = 56,
  height = 14,
  className = "",
}: {
  data: number[];
  pos?: boolean;
  width?: number;
  height?: number;
  className?: string;
}) {
  if (!data || data.length < 2) return <svg width={width} height={height} aria-hidden="true" />;
  let min = Infinity, max = -Infinity;
  for (const v of data) { if (v < min) min = v; if (v > max) max = v; }
  const range = max - min || 1;
  const n = data.length - 1;
  let d = "";
  for (let i = 0; i < data.length; i++) {
    const x = (i / n) * width;
    const y = height - ((data[i]! - min) / range) * height;
    d += `${i === 0 ? "M" : "L"}${x.toFixed(1)} ${y.toFixed(1)} `;
  }
  return (
    <svg width={width} height={height} className={className} aria-hidden="true">
      <path d={d} fill="none" stroke={pos ? "var(--color-pos)" : "var(--color-neg)"} strokeWidth={1} />
    </svg>
  );
}
