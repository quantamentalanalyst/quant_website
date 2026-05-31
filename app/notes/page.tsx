import { site } from "@/lib/site";
import SectionBar from "@/components/ui/SectionBar";

export const metadata = { title: "news" };

// /notes — the "News" tab. Bloomberg news-headline list: a tabular date
// column on the left, headline + dim source (venue) line on the right, thin
// 1px rules between items. Newest first.
export default function News() {
  const items = [...site.news].sort((a, b) => b.date.localeCompare(a.date));

  return (
    <div className="mx-auto max-w-[1080px] pb-12">
      <SectionBar>news</SectionBar>

      <ul className="mt-4 border-t border-rule">
        {items.map((n, i) => (
          <li
            key={i}
            className="grid grid-cols-[84px_1fr] gap-4 border-b border-rule py-3"
          >
            <span className="pt-[2px] font-tabular text-[11px] text-text-faint">
              {n.date}
            </span>
            <div className="min-w-0">
              {/* Content text matches the Bio section: JetBrains Mono 13/22.
                  When an item has href, the headline is a blue article link.
                  When it has an image, hovering the headline pops up a preview
                  (pure CSS group-hover — no JS). */}
              <div className="font-mono text-[13px] leading-[22px]">
                <span className="group relative inline-block">
                  {n.href ? (
                    <a
                      href={n.href}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-link no-underline hover:opacity-80"
                    >
                      {n.headline}
                    </a>
                  ) : (
                    <span className="text-text">{n.headline}</span>
                  )}
                  {n.image && (
                    <span className="pointer-events-none invisible absolute left-0 top-full z-30 mt-2 block w-[380px] max-w-[80vw] border border-rule-strong bg-bg-sunken p-1 opacity-0 transition-opacity duration-150 group-hover:visible group-hover:opacity-100">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={n.image} alt={n.headline} className="block w-full" />
                      {n.venue && (
                        <span className="mt-1 block px-1 pb-0.5 text-[10px] text-text-faint">
                          {n.venue}
                        </span>
                      )}
                    </span>
                  )}
                </span>
              </div>
              {n.venue && (
                <div className="mt-1 font-mono text-[13px] leading-[22px] text-text-dim">{n.venue}</div>
              )}
              {n.note && (
                <div className="mt-1 font-mono text-[13px] leading-[22px] text-accent">{n.note}</div>
              )}
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
