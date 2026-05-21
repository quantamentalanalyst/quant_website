import Link from "next/link";
import type { ResearchMeta } from "@/lib/content";

export default function LatestNotes({ notes }: { notes: ResearchMeta[] }) {
  if (notes.length === 0) {
    return <div className="text-text-faint text-xs">no notes yet</div>;
  }
  return (
    <ul className="space-y-2">
      {notes.map((n) => (
        <li key={n.slug} className="leading-tight">
          <Link
            href={`/research/${n.slug}`}
            className="group block no-underline"
          >
            <div className="font-tabular text-[11px] text-text-faint">{n.date}</div>
            <div className="text-text group-hover:text-accent">{n.title}</div>
            {n.tags && n.tags.length > 0 && (
              <div className="mt-0.5 flex flex-wrap gap-1.5 text-[10px] text-text-dim">
                {n.tags.map((t) => (
                  <span key={t}>#{t}</span>
                ))}
              </div>
            )}
          </Link>
        </li>
      ))}
    </ul>
  );
}
