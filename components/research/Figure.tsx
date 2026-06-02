// Numbered figure wrapper for research articles: a thin-ruled frame with a
// figure label + title above and a "Source: …" caption below every chart.
export default function Figure({
  n,
  title,
  source,
  children,
}: {
  n: number;
  title: string;
  source: string;
  children: React.ReactNode;
}) {
  return (
    <figure className="my-7 border border-rule">
      <figcaption className="flex items-baseline gap-2 border-b border-rule bg-bg-elev px-3 py-1.5">
        <span className="section-label text-accent">Fig. {n}</span>
        <span className="text-[12px] text-text">{title}</span>
      </figcaption>
      <div className="px-3 py-3">{children}</div>
      <div className="border-t border-rule px-3 py-1.5 text-[10px] leading-snug text-text-faint">
        Source: {source}
      </div>
    </figure>
  );
}
