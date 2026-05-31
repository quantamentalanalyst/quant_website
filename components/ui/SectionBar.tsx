// Solid amber Bloomberg-style section bar — dark text, uppercase, tracked.
// Used for major section headers (e.g. ABOUT ME, NEWS).
export default function SectionBar({ children }: { children: React.ReactNode }) {
  return (
    <div className="inline-block bg-accent px-2.5 py-1 text-[11px] font-medium uppercase tracking-[0.1em] text-bg">
      {children}
    </div>
  );
}
