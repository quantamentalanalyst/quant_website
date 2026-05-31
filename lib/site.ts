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
      "I currently work as an Assistant Vice President, Quantitative Investment Analyst in the Chief Investment Office at Bank of America. My research interests sit at the intersection of quantitative research and fundamental investing. I enjoy staying curious in the quantamental space.",
      "I graduated from the Yale School of Management in 2023 with a Master's in Asset Management. Prior to that, I earned an Honours Bachelor of Science in Financial Economics Specialist, with a minor in Statistics, from the University of Toronto in 2022.",
      "Outside of work, the movie [Moneyball](https://www.youtube.com/watch?v=Tzin1DgexlE) sparked my appreciation for the quantitative side of sports, a passion I bring to life through fantasy basketball. I'll be honest: I'm an NBA nerd, so feel free to talk basketball with me anytime. I'm here for it.",
    ],
  },
  // /notes (the "News" tab) — dated announcements, newest first. Edit here to
  // add an item. `date` is YYYY-MM (or YYYY-MM-DD); `venue` is the dim source
  // line; `note` is an optional amber personal aside; `href` makes the
  // headline a clickable blue article link (leave "" for none); `image` is an
  // optional path (under /public) shown as a hover preview (leave "" for none).
  news: [
    {
      date: "2026-06",
      headline: "Invited talk on Quant Model, Factor Model, and Machine Learning",
      venue: "Commodity Trading Week Americas",
      note: "",
      href: "https://americas.commoditytradingweek.com/speakers",
      image: "",
    },
    {
      date: "2026-04",
      headline: "Invited talk on Asset Allocation Models and Empirical Risk Models",
      venue: "Future Alpha Conference",
      note: "",
      href: "https://www.alphaevents.com/events-futurealphaglobal/speakers",
      image: "/news/future-alpha-panel.jpg",
    },
    {
      date: "2023-07",
      headline: "Joined Bank of America",
      venue: "",
      note: "",
      href: "",
      image: "",
    },
    {
      date: "2022-04",
      headline: "Received offer and Dean's Scholarship from Yale SOM",
      venue: "",
      note: "Thanks, Yale!",
      href: "",
      image: "",
    },
  ],
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

// Canonical site origin, resolved at build/runtime:
//   1. NEXT_PUBLIC_SITE_URL — optional override (set in Vercel only if the
//      domain ever changes). Highest priority.
//   2. Production → the live custom domain.
//   3. localhost — local dev fallback.
// Drives metadataBase so Open Graph / canonical / social-preview URLs are
// absolute and correct in every environment.
export const PRODUCTION_URL = "https://quantamentalanthony.com";

export function siteUrl(): string {
  if (process.env.NEXT_PUBLIC_SITE_URL) return process.env.NEXT_PUBLIC_SITE_URL;
  if (process.env.NODE_ENV === "production") return PRODUCTION_URL;
  return "http://localhost:3022";
}
