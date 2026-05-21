"use client";
import useSWR from "swr";

type Entry = { kind: "commit" | "content"; when: string; text: string; href?: string };
type Resp = { entries: Entry[] };

const fetcher = (url: string) => fetch(url).then((r) => r.json());

export default function ResearchLogTicker({ handle }: { handle: string }) {
  const { data } = useSWR<Resp>(handle ? `/api/log?gh=${encodeURIComponent(handle)}` : "/api/log", fetcher, {
    refreshInterval: 5 * 60_000,
    revalidateOnFocus: false,
  });
  const entries = data?.entries ?? FALLBACK;

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
            <span className={e.kind === "commit" ? "text-data" : "text-accent"}>
              {e.kind === "commit" ? "commit" : "note"}
            </span>
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

const FALLBACK: Entry[] = [
  { kind: "commit", when: "2026-05-21 14:02", text: "init scaffold" },
  { kind: "content", when: "2026-05-18", text: "Cross-sectional momentum in EM small caps" },
  { kind: "content", when: "2026-04-30", text: "Notes on Asness '24" },
  { kind: "commit", when: "2026-04-20 09:11", text: "rebalance backtest engine" },
  { kind: "content", when: "2026-04-12", text: "Vol-targeting is a leverage rule, not a signal" },
];
