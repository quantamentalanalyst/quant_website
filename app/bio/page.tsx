import { site } from "@/lib/site";

export const metadata = { title: "bio" };

// /bio — two-column layout, no facts table.
//   ┌─────────────────────────────────────┬────────────────┐
//   │ [▮ ABOUT ME ▮]                      │                │
//   │                                     │   HEADSHOT     │
//   │ ⟨mono terminal prose, 2 paragraphs⟩ │                │
//   │                                     │                │
//   └─────────────────────────────────────┴────────────────┘
// Prose is JetBrains Mono (site body face) to match the terminal aesthetic of
// the nav badge / WEI board — not the serif used elsewhere for long-form.

export default function Bio() {
  return (
    <div className="mx-auto max-w-[1080px] pb-12">
      <div className="grid grid-cols-12 gap-6">
        <div className="col-span-12 md:col-span-7 lg:col-span-8">
          <SectionBar>about me</SectionBar>
          <div className="mt-5 max-w-[70ch] space-y-4 font-mono text-[13px] leading-[22px] text-text">
            {site.bio.prose.map((p, i) => (
              <p key={i}>{renderInline(p)}</p>
            ))}
          </div>
        </div>

        <div className="col-span-12 md:col-span-5 lg:col-span-4">
          <div className="aspect-[3/4] w-full overflow-hidden border border-rule-strong bg-bg-elev">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={site.bio.photoPath}
              alt={`${site.name} headshot`}
              className="block h-full w-full object-cover"
            />
          </div>
        </div>
      </div>
    </div>
  );
}

// Inline markup for bio prose: supports markdown-style [label](url) links,
// rendered like Bloomberg news-article hyperlinks — cornflower blue
// (--color-link), no underline, opening external targets in a new tab.
function renderInline(text: string): React.ReactNode[] {
  const re = /\[([^\]]+)\]\(([^)]+)\)/g;
  const out: React.ReactNode[] = [];
  let last = 0;
  let key = 0;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text)) !== null) {
    if (m.index > last) out.push(text.slice(last, m.index));
    const [full, label, href] = m;
    const external = /^https?:\/\//.test(href!);
    out.push(
      <a
        key={key++}
        href={href}
        {...(external ? { target: "_blank", rel: "noopener noreferrer" } : {})}
        className="text-link no-underline hover:opacity-80"
      >
        {label}
      </a>,
    );
    last = m.index + full!.length;
  }
  if (last < text.length) out.push(text.slice(last));
  return out;
}

// Amber Bloomberg-style "section bar" — solid amber rectangle with dark text,
// uppercase + tracked. Used for major section dividers on this page.
function SectionBar({ children }: { children: React.ReactNode }) {
  return (
    <div className="inline-block bg-accent px-2.5 py-1 text-[11px] font-medium uppercase tracking-[0.1em] text-bg">
      {children}
    </div>
  );
}
