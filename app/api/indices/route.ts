// World Equity Indices feed for the homepage WEI board.
// - One raw v8 chart request per symbol (see lib/yahoo). Live value + daily
//   change (vs prior session close) + %YTD (vs first close of the year) + spark.
// - 60s cache via fetch revalidate; failures degrade to last-cached values
//   with a stale flag, never throw.
// - Index points are native (no FX); %YTD is therefore local-currency.

import { NextResponse } from "next/server";
import { fetchChartYTD, downsample } from "@/lib/yahoo";
import { site } from "@/lib/site";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type IndexOut = {
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

// Survives within the server process so a transient failure shows the previous
// reading with a stale flag instead of dropping the row.
const lastGood = new Map<string, IndexOut>();

async function fetchIndex(cfg: {
  region: string;
  symbol: string;
  label: string;
}): Promise<IndexOut | null> {
  const data = await fetchChartYTD(cfg.symbol);
  if (!data) {
    const prev = lastGood.get(cfg.symbol);
    return prev ? { ...prev, stale: true } : null;
  }
  const change = data.price - data.prevClose;
  const changePct = data.prevClose ? (change / data.prevClose) * 100 : 0;
  const ytdPct = data.ytdBase ? (data.price / data.ytdBase - 1) * 100 : null;
  const spark = downsample(data.closes);
  const out: IndexOut = {
    symbol: cfg.symbol,
    label: cfg.label,
    region: cfg.region,
    last: data.price,
    change,
    changePct,
    ytdPct,
    time: data.time,
    spark: spark.length >= 2 ? spark : [data.price, data.price],
    stale: false,
  };
  lastGood.set(cfg.symbol, out);
  return out;
}

export async function GET() {
  const rows = await Promise.all(site.indices.map((c) => fetchIndex(c)));
  return NextResponse.json(
    { rows: rows.filter((r): r is IndexOut => r !== null), asOf: Date.now() },
    {
      headers: {
        "Cache-Control": "public, max-age=0, s-maxage=60, stale-while-revalidate=600",
      },
    },
  );
}
