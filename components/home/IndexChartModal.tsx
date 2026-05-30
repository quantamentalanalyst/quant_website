"use client";
import { useEffect, useState } from "react";
import useSWR from "swr";
import CenterChart from "./CenterChart";
import { Num } from "@/components/ui/Num";

type IndexRow = {
  symbol: string;
  label: string;
  region: string;
  last: number;
  change: number;
  changePct: number;
  ytdPct: number | null;
  time: number | null;
};

type HistResp = { symbol: string; range: string; points: { date: string; value: number }[] };

const fetcher = (url: string) => fetch(url).then((r) => r.json());

const RANGES: { key: string; label: string }[] = [
  { key: "1mo", label: "1M" },
  { key: "6mo", label: "6M" },
  { key: "ytd", label: "YTD" },
  { key: "1y", label: "1Y" },
  { key: "5y", label: "5Y" },
];

// Bloomberg GIP-style overlay: click an index row → its price history chart.
export default function IndexChartModal({
  row,
  onClose,
}: {
  row: IndexRow;
  onClose: () => void;
}) {
  const [range, setRange] = useState("1y");
  const { data, isLoading } = useSWR<HistResp>(
    `/api/history?symbol=${encodeURIComponent(row.symbol)}&range=${range}`,
    fetcher,
    { revalidateOnFocus: false, keepPreviousData: true },
  );

  // Close on Escape; lock body scroll while open.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [onClose]);

  const dayPos = row.change >= 0;
  const ytdPos = (row.ytdPct ?? 0) >= 0;
  const points = data?.points ?? [];

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4"
      onMouseDown={onClose}
      role="dialog"
      aria-modal="true"
      aria-label={`${row.label} price chart`}
    >
      <div
        className="w-full max-w-[920px] border border-rule-strong bg-bg-sunken"
        onMouseDown={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-start justify-between border-b border-rule px-5 py-3">
          <div className="flex flex-wrap items-baseline gap-x-4 gap-y-1 text-xs text-text-dim">
            <span className="text-sm font-medium text-text">{row.label}</span>
            <span className="font-tabular text-[10px] uppercase text-text-faint">
              {row.symbol}
            </span>
            <span>
              last <Num value={row.last} decimals={2} className="text-text" />
            </span>
            <span className={dayPos ? "text-pos" : "text-neg"}>
              <Num value={row.change} decimals={2} signed />{" "}
              (<Num value={row.changePct} decimals={2} signed pct />)
            </span>
            <span>
              ytd{" "}
              {row.ytdPct === null ? (
                <span className="text-text-faint">—</span>
              ) : (
                <span className={ytdPos ? "text-pos" : "text-neg"}>
                  <Num value={row.ytdPct} decimals={1} signed pct />
                </span>
              )}
            </span>
          </div>
          <button
            onClick={onClose}
            aria-label="close"
            className="ml-4 shrink-0 border border-rule-strong px-2 py-0.5 text-xs text-text-dim hover:border-accent hover:text-accent"
          >
            esc ✕
          </button>
        </div>

        {/* Range toggles */}
        <div className="flex items-center gap-px border-b border-rule px-5 py-2 text-[11px]">
          {RANGES.map((r) => {
            const active = r.key === range;
            return (
              <button
                key={r.key}
                onClick={() => setRange(r.key)}
                className={`px-2 py-0.5 font-tabular no-underline ${
                  active
                    ? "border-b border-accent text-accent"
                    : "text-text-faint hover:text-text"
                }`}
              >
                {r.label}
              </button>
            );
          })}
          <span className="ml-auto text-[10px] text-text-faint">
            index level · native currency
          </span>
        </div>

        {/* Chart */}
        <div className="px-5 py-4">
          {points.length >= 2 ? (
            <CenterChart data={points} showStats={false} showDrawdown={false} height={380} />
          ) : (
            <div className="flex h-[380px] items-center justify-center text-xs text-text-faint">
              {isLoading ? "loading…" : "history unavailable"}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
