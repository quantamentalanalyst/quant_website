// Number formatting helpers. Decimal-aligned numerics are enforced via the <Num /> component;
// these helpers just produce strings.

export function fmtPrice(n: number, decimals = 2): string {
  return n.toLocaleString("en-US", {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });
}

export function fmtPct(n: number, decimals = 2): string {
  const v = n.toFixed(decimals);
  return `${n >= 0 ? "+" : ""}${v}%`;
}

export function fmtDate(d: Date | string): string {
  const date = typeof d === "string" ? new Date(d) : d;
  return date.toISOString().slice(0, 10);
}
