// Decimal-aligned numeric cell. Splits integer / decimal parts and pads with
// a hair space so a column of <Num /> elements aligns on the decimal point
// even when the integer part varies in width.
//
// Use inside table cells with `text-align: right` and `font-variant-numeric:
// tabular-nums slashed-zero` already on the row.

export function Num({
  value,
  decimals = 2,
  signed = false,
  pct = false,
  className = "",
}: {
  value: number | null | undefined;
  decimals?: number;
  signed?: boolean;
  pct?: boolean;
  className?: string;
}) {
  if (value === null || value === undefined || Number.isNaN(value)) {
    return <span className={`text-text-faint font-tabular ${className}`}>—</span>;
  }
  const isNeg = value < 0;
  const abs = Math.abs(value);
  const str = abs.toLocaleString("en-US", {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });
  const [intPart, decPart] = str.split(".");
  const sign = signed ? (isNeg ? "−" : "+") : isNeg ? "−" : "";
  const cls =
    signed && !isNeg ? "text-pos" : signed && isNeg ? "text-neg" : className;

  return (
    <span className={`font-tabular ${cls}`}>
      <span>{sign}</span>
      <span>{intPart}</span>
      {decPart !== undefined && (
        <>
          <span>.</span>
          <span>{decPart}</span>
        </>
      )}
      {pct && <span>%</span>}
    </span>
  );
}
