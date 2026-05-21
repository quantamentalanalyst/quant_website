// Section header drawn ON a 1px rule, e.g.  ─── LATEST NOTES ───
// Uppercase, tracked, tiny — sits on the rule so density is preserved.

export default function SectionLabel({
  children,
  align = "left",
  className = "",
}: {
  children: React.ReactNode;
  align?: "left" | "center";
  className?: string;
}) {
  return (
    <div className={`relative mb-3 flex items-center gap-2 ${className}`}>
      <span className="h-px flex-none bg-rule" style={{ width: align === "left" ? "12px" : "100%" }} />
      <span className="section-label whitespace-nowrap text-text-dim">{children}</span>
      <span className="h-px flex-1 bg-rule" />
    </div>
  );
}
