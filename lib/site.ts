// Single source of truth for personal details. Edit this file to swap identity site-wide.

export const site = {
  name: "Anthony Huang",
  // One-line role for the status bar. Keep tight — fits next to ticker data.
  role: "quantamental research",
  // Longer one-line used on /bio header and meta tags.
  roleLong: "quantitative researcher — factor investing, alternative data, signal construction in global equities",
  location: "Cambridge, MA", // EDIT ME
  // Optional tagline used on /bio. Keep short.
  tagline: "Where fundamentals meet factors.",
  // Contact + presence. Leave any blank to hide it from the bio links list.
  email: "anthonyhuang55555@gmail.com",
  handles: {
    github: "", // e.g. "anthonyhuang55555" — used by the research log ticker
    twitter: "", // X handle without the @
    linkedin: "", // e.g. "anthony-huang"
    ssrn: "", // SSRN author id
  },
  // Tickers shown in the top status bar. Add/remove freely. Index symbols use ^.
  tickers: ["SPY", "QQQ", "^TNX", "^VIX", "BTC-USD"],
  // Homepage centerpiece config.
  homepage: {
    chart: {
      // Label printed above the chart in the section-label style.
      label: "equity curve · qmj-x · 2021–2026",
      // Path (under /content) for the JSON the chart reads.
      dataPath: "equity.json",
      // Currency/unit label for the y-axis (printed bottom-right).
      yLabel: "NAV (rebased=100)",
    },
  },
} as const;

export type Site = typeof site;
