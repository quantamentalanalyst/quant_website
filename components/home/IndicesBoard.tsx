"use client";
import { useState } from "react";
import useSWR from "swr";
import { site } from "@/lib/site";
import { Num } from "@/components/ui/Num";
import { Sparkline } from "@/components/ui/Sparkline";
import IndexChartModal from "./IndexChartModal";

type IndexRow = {
  symbol: string;
  label: string;
  region: string;
  last: number;
  change: number;
  changePct: number;
  ytdPct: number | null;
  time: number | null;
  spark: number[];
  stale: boolean;
};

type Resp = { rows: IndexRow[]; asOf: number };

const fetcher = (url: string) => fetch(url).then((r) => r.json());

// Column grid — shared by the header row and every data row so everything
// stays decimal-aligned. name | spark | last | net chg | %chg | %ytd | time
const COLS =
  "grid grid-cols-[minmax(0,1fr)_46px_72px_60px_52px_52px_42px] items-center gap-x-2";

export default function IndicesBoard() {
  const { data } = useSWR<Resp>("/api/indices", fetcher, {
    refreshInterval: 60_000,
    revalidateOnFocus: false,
  });

  const rows = data?.rows;
  const [selected, setSelected] = useState<IndexRow | null>(null);

  // Preserve the config's region order; group rows under each region header.
  const regions: string[] = [];
  for (const c of site.indices) if (!regions.includes(c.region)) regions.push(c.region);

  return (
    <div className="select-none text-[11px] leading-none">
      {/* Column header */}
      <div className={`${COLS} border-b border-rule-strong pb-1.5 text-[9px] uppercase tracking-[0.06em] text-text-faint`}>
        <span>index</span>
        <span className="text-center">ytd</span>
        <span className="text-right">last</span>
        <span className="text-right">net chg</span>
        <span className="text-right">%chg</span>
        <span className="text-right">%ytd</span>
        <span className="text-right">time</span>
      </div>

      {!rows && <LoadingRows regions={regions} />}

      {rows &&
        regions.map((region) => {
          const regionRows = rows.filter((r) => r.region === region);
          if (regionRows.length === 0) return null;
          return (
            <div key={region}>
              <div className="border-b border-rule bg-bg-elev/40 px-0 py-1 text-[9px] uppercase tracking-[0.12em] text-data">
                {region}
              </div>
              {regionRows.map((r) => (
                <Row key={r.symbol} r={r} onOpen={() => setSelected(r)} />
              ))}
            </div>
          );
        })}

      {selected && <IndexChartModal row={selected} onClose={() => setSelected(null)} />}
    </div>
  );
}

function Row({ r, onOpen }: { r: IndexRow; onOpen: () => void }) {
  const dayPos = r.change >= 0;
  const ytdPos = (r.ytdPct ?? 0) >= 0;
  return (
    <button
      type="button"
      onClick={onOpen}
      title={`${r.label} — open chart`}
      className={`${COLS} w-full cursor-pointer border-b border-rule py-[5px] text-left font-tabular hover:bg-bg-elev/60`}
    >
      <span className="flex min-w-0 items-center gap-1 truncate text-text">
        {r.label}
        {r.stale && (
          <span className="text-warn text-[9px]" title="cached value (live fetch failed / market closed)">
            *
          </span>
        )}
      </span>

      <span className="flex justify-center">
        <Sparkline data={r.spark} pos={ytdPos} width={46} height={13} />
      </span>

      <span className="text-right text-text">
        <Num value={r.last} decimals={2} />
      </span>

      <span className={`text-right ${dayPos ? "text-pos" : "text-neg"}`}>
        <Num value={r.change} decimals={2} signed />
      </span>

      <span className={`text-right ${dayPos ? "text-pos" : "text-neg"}`}>
        <Num value={r.changePct} decimals={2} signed pct />
      </span>

      <span className={`text-right ${ytdPos ? "text-pos" : "text-neg"}`}>
        {r.ytdPct === null ? (
          <span className="text-text-faint">—</span>
        ) : (
          <Num value={r.ytdPct} decimals={1} signed pct />
        )}
      </span>

      <span className="text-right text-text-faint">{fmtTime(r.time)}</span>
    </button>
  );
}

function fmtTime(t: number | null): string {
  if (!t) return "—";
  try {
    return new Intl.DateTimeFormat([], {
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    }).format(new Date(t));
  } catch {
    return "—";
  }
}

function LoadingRows({ regions }: { regions: string[] }) {
  return (
    <>
      {regions.map((region) => (
        <div key={region}>
          <div className="border-b border-rule py-1 text-[9px] uppercase tracking-[0.12em] text-text-faint">
            {region}
          </div>
          {site.indices
            .filter((c) => c.region === region)
            .map((c) => (
              <div key={c.symbol} className={`${COLS} border-b border-rule py-[5px] text-text-faint`}>
                <span className="truncate">{c.label}</span>
                <span className="text-center">·····</span>
                <span className="text-right font-tabular">······</span>
                <span className="text-right font-tabular">·····</span>
                <span className="text-right font-tabular">····</span>
                <span className="text-right font-tabular">····</span>
                <span className="text-right">··</span>
              </div>
            ))}
        </div>
      ))}
    </>
  );
}
