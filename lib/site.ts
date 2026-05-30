// Single source of truth for personal details. Edit this file to swap identity site-wide.

export const site = {
  name: "Anthony Huang",
  // One-line role for the status bar. Keep tight — fits next to ticker data.
  role: "Quantamental Research",
  // Longer one-line used on /bio header and meta tags.
  roleLong: "quantitative researcher — factor investing, alternative data, signal construction in global equities",
  location: "New York, NY",
  // Optional tagline used on /bio. Keep short.
  tagline: "Where fundamentals meet factors.",
  // Contact + presence. Leave any blank to hide it from the bio links list.
  email: "anthonyhuang@aya.yale.edu",
  handles: {
    github: "", // e.g. "anthonyhuang55555" — used by the research log ticker
    twitter: "", // X handle without the @
    linkedin: "", // e.g. "anthony-huang"
    ssrn: "", // SSRN author id
  },
  // Tickers shown in the top status bar. Add/remove freely. Index symbols use ^.
  tickers: ["SPY", "QQQ", "^TNX", "^VIX", "BTC-USD"],
  // /bio page content. Edit here to update the About Me copy + photo.
  bio: {
    photoPath: "/headshot.jpg",
    prose: [
      "I currently work as an Assistant Vice President, Quantitative Investment Analyst in the Chief Investment Office at Bank of America. My research interests sit at the intersection of quantitative research and fundamental investing. I enjoy staying curious and keep learning in the field of quantitative investing.",
      "I graduated from the Yale School of Management in 2023 with a Master's in Asset Management. Prior to that, I earned an Honours Bachelor of Science in Financial Economics from the University of Toronto in 2022.",
    ],
  },
  // World Equity Indices board (homepage centerpiece). Region-grouped, live via
  // Yahoo. Add/remove rows freely; symbols are Yahoo tickers. Order within a
  // region is preserved; regions render in first-seen order.
  indices: [
    { region: "Americas", symbol: "^DJI", label: "DOW JONES" },
    { region: "Americas", symbol: "^GSPC", label: "S&P 500" },
    { region: "Americas", symbol: "^IXIC", label: "NASDAQ" },
    { region: "Americas", symbol: "^RUT", label: "RUSSELL 2000" },
    { region: "Americas", symbol: "^GSPTSE", label: "S&P/TSX" },
    { region: "EMEA", symbol: "^STOXX50E", label: "EURO STOXX 50" },
    { region: "EMEA", symbol: "^FTSE", label: "FTSE 100" },
    { region: "EMEA", symbol: "^GDAXI", label: "DAX" },
    { region: "APAC", symbol: "^N225", label: "NIKKEI 225" },
    { region: "APAC", symbol: "^HSI", label: "HANG SENG" },
  ],
  // Homepage centerpiece config.
  homepage: {
    indices: {
      label: "world equity indices · WEI",
    },
    // Retained for reuse on backtest pages (phase 4) — not on the homepage.
    chart: {
      label: "equity curve · qmj-x · 2021–2026",
      dataPath: "equity.json",
      yLabel: "NAV (rebased=100)",
    },
  },
} as const;

export type Site = typeof site;
