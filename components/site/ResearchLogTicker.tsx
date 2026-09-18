"use client";
import useSWR from "swr";

type Entry = { kind: "commit" | "research" | "note"; when: string; text: string; href?: string };
type Resp = { entries: Entry[] };

const fetcher = (url: string) => fetch(url).then((r) => r.json());

export default function ResearchLogTicker({ handle }: { handle: string }) {
  const { data } = useSWR<Resp>(handle ? `/api/log?gh=${encodeURIComponent(handle)}` : "/api/log", fetcher, {
    refreshInterval: 5 * 60_000,
    revalidateOnFocus: false,
  });
  const entries = data?.entries ?? [];
  if (entries.length === 0) return <div className="h-full flex-1" />;

  // The visible viewport is a flex row with overflow hidden; the inner track
  // contains entries duplicated for a seamless loop. We pause on hover.
  return (
    <div className="group relative h-full flex-1 overflow-hidden">
      <div
        className="flex h-full items-center gap-6 whitespace-nowrap group-hover:[animation-play-state:paused]"
        style={{ animation: `ticker-scroll ${Math.max(40, entries.length * 8)}s linear infinite` }}
      >
        {[...entries, ...entries].map((e, i) => (
          <span key={i} className="flex items-center gap-2">
            <span className="text-text-faint font-tabular">{e.when}</span>
            <span className={e.kind === "commit" ? "text-data" : "text-accent"}>{e.kind}</span>
            <span className="text-text-dim">{e.text}</span>
            <span className="text-rule-strong">·</span>
          </span>
        ))}
      </div>
      <style>{`
        @keyframes ticker-scroll {
          from { transform: translateX(0); }
          to   { transform: translateX(-50%); }
        }
      `}</style>
    </div>
  );
}
