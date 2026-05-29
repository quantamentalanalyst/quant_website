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
