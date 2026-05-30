// Top status-bar ticker feed.
// - One raw v8 chart request per symbol (see lib/yahoo). Same crumb-free path
//   as the indices board, so it is not 429'd like yahoo-finance2's quote().
// - 60s cache; failures degrade to last-cached values + stale flag.

import { NextResponse } from "next/server";
import { fetchChartYTD, downsample } from "@/lib/yahoo";
import { site } from "@/lib/site";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type TickerOut = {
  symbol: string;
  display: string;
  last: number;
  change: number;
  changePct: number;
  spark: number[];
  stale: boolean;
};

const DISPLAY: Record<string, string> = {
  SPY: "SPY",
  QQQ: "QQQ",
  "^TNX": "10Y",
  "^VIX": "VIX",
  "BTC-USD": "BTC",
};

const lastGood = new Map<string, TickerOut>();

async function fetchOne(symbol: string): Promise<TickerOut | null> {
  const data = await fetchChartYTD(symbol);
  if (!data) {
    const prev = lastGood.get(symbol);
    return prev ? { ...prev, stale: true } : null;
  }
  const change = data.price - data.prevClose;
  const changePct = data.prevClose ? (change / data.prevClose) * 100 : 0;
  // Short trailing sparkline for the strip — last ~30 daily closes.
  const tail = data.closes.slice(-30);
  const out: TickerOut = {
    symbol,
    display: DISPLAY[symbol] ?? symbol,
    last: data.price,
    change,
    changePct,
    spark: tail.length >= 2 ? downsample(tail, 30) : [data.price, data.price],
    stale: false,
  };
  lastGood.set(symbol, out);
  return out;
}

export async function GET() {
  const results = await Promise.all(site.tickers.map(fetchOne));
  return NextResponse.json(
    { tickers: results.filter((r): r is TickerOut => r !== null), asOf: Date.now() },
    {
      headers: {
        "Cache-Control": "public, max-age=0, s-maxage=60, stale-while-revalidate=600",
      },
    },
  );
}
