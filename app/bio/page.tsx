import { site } from "@/lib/site";

export const metadata = { title: "bio" };

// /bio — two-column layout, no facts table.
//   ┌─────────────────────────────────────┬────────────────┐
//   │ [▮ ABOUT ME ▮]                      │                │
//   │                                     │   HEADSHOT     │
//   │ ⟨serif prose, two paragraphs⟩       │                │
//   │                                     │                │
//   └─────────────────────────────────────┴────────────────┘

export default function Bio() {
  return (
    <div className="mx-auto max-w-[1080px] pb-12">
      <div className="grid grid-cols-12 gap-6">
        <div className="col-span-12 md:col-span-7 lg:col-span-8">
          <SectionBar>about me</SectionBar>
          <div className="prose-serif mt-5">
            {site.bio.prose.map((p, i) => (
              <p key={i}>{p}</p>
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

// Amber Bloomberg-style "section bar" — solid amber rectangle with dark text,
// uppercase + tracked. Used for major section dividers on this page.
function SectionBar({ children }: { children: React.ReactNode }) {
  return (
    <div className="inline-block bg-accent px-2.5 py-1 text-[11px] font-medium uppercase tracking-[0.1em] text-bg">
      {children}
    </div>
  );
}
