// Historical price series for the index detail chart.
// GET /api/history?symbol=^GSPC&range=1y
// Symbol is whitelisted to the site's configured indices + tickers so this
// cannot be used as an open Yahoo proxy. Range is validated against the
// allowed set. 60s cache; failure returns 200 with empty points (the client
// renders an "unavailable" state rather than erroring).

import { NextResponse } from "next/server";
import { fetchHistory, HISTORY_RANGES } from "@/lib/yahoo";
import { site } from "@/lib/site";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const ALLOWED = new Set<string>([
  ...site.indices.map((i) => i.symbol),
  ...site.tickers,
]);

export async function GET(req: Request) {
  const url = new URL(req.url);
  const symbol = url.searchParams.get("symbol") ?? "";
  const range = url.searchParams.get("range") ?? "1y";

  if (!ALLOWED.has(symbol) || !HISTORY_RANGES.includes(range)) {
    return NextResponse.json({ points: [], error: "bad request" }, { status: 400 });
  }

  const points = await fetchHistory(symbol, range);
  return NextResponse.json(
    { symbol, range, points: points ?? [] },
    {
      headers: {
        "Cache-Control": "public, max-age=0, s-maxage=60, stale-while-revalidate=600",
      },
    },
  );
}
