// Placeholder index — phase 3 builds the full screener with tag filter + counts.
import Link from "next/link";
import { getAllResearch } from "@/lib/content";
import SectionLabel from "@/components/ui/SectionLabel";

export const metadata = { title: "research" };

export default async function ResearchIndex() {
  const items = await getAllResearch();
  return (
    <div className="max-w-4xl">
      <SectionLabel>research · {items.length} entries</SectionLabel>
      <ul className="divide-y divide-rule">
        {items.map((r) => (
          <li key={r.slug} className="py-3">
            <Link href={`/research/${r.slug}`} className="no-underline">
              <div className="flex items-baseline gap-4">
                <span className="font-tabular w-24 shrink-0 text-text-faint">{r.date}</span>
                {/* Content text matches the Bio section: JetBrains Mono 13/22. */}
                <span className="font-mono text-[13px] leading-[22px] text-text hover:text-accent">{r.title}</span>
              </div>
              <p className="ml-28 mt-1 font-mono text-[13px] leading-[22px] text-text-dim">{r.abstract}</p>
              {r.tags.length > 0 && (
                <div className="ml-28 mt-1 flex flex-wrap gap-3 text-[10px] text-text-faint">
                  {r.tags.map((t) => (
                    <span key={t}>#{t}</span>
                  ))}
                </div>
              )}
            </Link>
          </li>
        ))}
      </ul>
      <p className="mt-6 text-[11px] text-text-faint">phase 3 wires the tag-filter screener and per-entry MDX rendering.</p>
    </div>
  );
}
