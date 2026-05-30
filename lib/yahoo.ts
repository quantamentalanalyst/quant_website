// Yahoo Finance data access via the raw v8 chart JSON endpoint.
//
// Why not yahoo-finance2's quote()? Its quote endpoint requires a crumb+cookie
// handshake that Yahoo aggressively rate-limits (429 "Too Many Requests"). The
// public v8 chart endpoint needs no crumb and is not rate-limited the same way,
// so we hit it directly. One request per symbol returns live price, the daily
// change baseline, the YTD baseline, and a sparkline series.

const UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36";

export type ChartData = {
  price: number; // live / latest regular-market price
  prevClose: number; // last completed session close (daily-change baseline)
  ytdBase: number | null; // first close of the calendar year
  time: number | null; // epoch ms of last trade
  closes: number[]; // YTD daily closes (for sparkline)
};

// Even-stride downsample so sparkline paths stay cheap as the year fills in.
export function downsample(arr: number[], target = 44): number[] {
  if (arr.length <= target) return arr;
  const step = arr.length / target;
  const out: number[] = [];
  for (let i = 0; i < target; i++) out.push(arr[Math.floor(i * step)]!);
  out.push(arr[arr.length - 1]!);
  return out;
}

export async function fetchChartYTD(
  symbol: string,
  revalidate = 60,
): Promise<ChartData | null> {
  const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(
    symbol,
  )}?range=ytd&interval=1d`;
  try {
    const res = await fetch(url, {
      headers: { "User-Agent": UA, Accept: "application/json" },
      next: { revalidate },
    });
    if (!res.ok) return null;
    const j: any = await res.json();
    const r = j?.chart?.result?.[0];
    if (!r) return null;
    const m = r.meta ?? {};
    const closes: number[] = (r.indicators?.quote?.[0]?.close ?? []).filter(
      (v: unknown): v is number => typeof v === "number" && Number.isFinite(v),
    );
    if (closes.length === 0 && m.regularMarketPrice == null) return null;

    const price: number = m.regularMarketPrice ?? closes[closes.length - 1] ?? 0;
    // Daily-change baseline = the prior completed session close. With a YTD
    // daily series the second-to-last bar is yesterday; fall back to the
    // chart's previous close if the series is too short.
    const prevClose: number =
      closes.length >= 2
        ? closes[closes.length - 2]!
        : (m.chartPreviousClose ?? price);
    const ytdBase: number | null = closes.length ? closes[0]! : null;
    const time: number | null =
      typeof m.regularMarketTime === "number" ? m.regularMarketTime * 1000 : null;

    return { price, prevClose, ytdBase, time, closes };
  } catch {
    return null;
  }
}
