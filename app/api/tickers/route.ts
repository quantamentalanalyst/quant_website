// Server-side ticker feed.
// - 60s server-side cache (unstable_cache); client SWR refreshes at the same cadence
// - Yahoo via yahoo-finance2; no key required
// - Failures degrade to last-cached values + stale flag, never throw

import { NextResponse } from "next/server";
import { unstable_cache } from "next/cache";
import yahooFinance from "yahoo-finance2";
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

// In-memory last-known values. Survives within the server process so a
// transient API failure shows the previous tick with a stale flag instead
// of breaking the strip.
const lastGood: Map<string, TickerOut> = new Map();

async function fetchOne(symbol: string): Promise<TickerOut | null> {
  try {
    const [quote, hist] = await Promise.all([
      yahooFinance.quote(symbol, {}, { validateResult: false }),
      yahooFinance.chart(symbol, {
        period1: new Date(Date.now() - 1000 * 60 * 60 * 24 * 5),
        interval: "1h",
      }, { validateResult: false }),
    ]);
    const last = (quote as any).regularMarketPrice ?? (quote as any).postMarketPrice ?? 0;
    const change = (quote as any).regularMarketChange ?? 0;
    const changePct = (quote as any).regularMarketChangePercent ?? 0;
    const spark = ((hist as any)?.quotes ?? [])
      .map((q: any) => q.close)
      .filter((v: unknown): v is number => typeof v === "number" && Number.isFinite(v))
      .slice(-30);
    const out: TickerOut = {
      symbol,
      display: DISPLAY[symbol] ?? symbol,
      last,
      change,
      changePct,
      spark: spark.length >= 2 ? spark : [last, last],
      stale: false,
    };
    lastGood.set(symbol, out);
    return out;
  } catch {
    const prev = lastGood.get(symbol);
    if (prev) return { ...prev, stale: true };
    return null;
  }
}

const fetchAll = unstable_cache(
  async () => {
    const results = await Promise.all(site.tickers.map(fetchOne));
    return {
      tickers: results.filter((r): r is TickerOut => r !== null),
      asOf: Date.now(),
    };
  },
  ["tickers"],
  { revalidate: 60, tags: ["tickers"] },
);

export async function GET() {
  const data = await fetchAll();
  return NextResponse.json(data, {
    headers: { "Cache-Control": "public, max-age=0, s-maxage=60, stale-while-revalidate=600" },
  });
}
