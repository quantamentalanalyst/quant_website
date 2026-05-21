"use client";
import useSWR from "swr";
import { fmtPrice } from "@/lib/format";
import { Sparkline } from "@/components/ui/Sparkline";

export type Ticker = {
  symbol: string;
  display: string;
  last: number;
  change: number;
  changePct: number;
  spark: number[];
  stale: boolean;
};

type Response = { tickers: Ticker[]; asOf: number };

const fetcher = (url: string) => fetch(url).then((r) => r.json());

// First-paint stub. Keeps the strip width stable until the real fetch lands.
const STUB_SYMBOLS = ["SPY", "QQQ", "10Y", "VIX", "BTC"];

export default function TickerStrip() {
  const { data } = useSWR<Response>("/api/tickers", fetcher, {
    refreshInterval: 60_000,
    revalidateOnFocus: false,
  });

  const tickers = data?.tickers;

  return (
    <div className="hidden items-center gap-5 md:flex">
      {(tickers ?? STUB_SYMBOLS.map((s) => null)).map((t, i) => (
        <TickerCell key={t?.symbol ?? STUB_SYMBOLS[i]} t={t} fallback={STUB_SYMBOLS[i]!} />
      ))}
    </div>
  );
}

function TickerCell({ t, fallback }: { t: Ticker | null; fallback: string }) {
  if (!t) {
    return (
      <div className="flex items-center gap-1.5 text-text-faint">
        <span>{fallback}</span>
        <span className="font-tabular">·····</span>
      </div>
    );
  }
  const pos = t.change >= 0;
  return (
    <div className="flex items-center gap-1.5">
      <span className="text-text-dim">{t.display}</span>
      <span className="font-tabular text-text">{fmtPrice(t.last)}</span>
      <span className={pos ? "text-pos" : "text-neg"}>
        {pos ? "+" : ""}
        {t.changePct.toFixed(2)}% {pos ? "▴" : "▾"}
      </span>
      <Sparkline data={t.spark} pos={pos} />
      {t.stale && (
        <span className="text-warn text-[10px]" title="cached value (live fetch failed)">
          *
        </span>
      )}
    </div>
  );
}
