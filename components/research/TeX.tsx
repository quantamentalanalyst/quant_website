import katex from "katex";
import "katex/dist/katex.min.css";

// Inline / display math rendered server-side via KaTeX. Display equations get
// the design-system treatment: thin rule above and below, centered, slightly
// larger, with an optional right-aligned equation number.
export function TeX({ children }: { children: string }) {
  const html = katex.renderToString(children, { throwOnError: false, displayMode: false });
  return <span dangerouslySetInnerHTML={{ __html: html }} />;
}

export function TeXBlock({ children, eq }: { children: string; eq?: string }) {
  const html = katex.renderToString(children, { throwOnError: false, displayMode: true });
  return (
    <div className="my-6 border-y border-rule py-5">
      <div className="relative flex items-center justify-center px-8 text-[1.05em]">
        <span dangerouslySetInnerHTML={{ __html: html }} />
        {eq && <span className="absolute right-2 text-[11px] text-text-dim">({eq})</span>}
      </div>
    </div>
  );
}
