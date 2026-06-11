# Quantamental Research

Personal website of Anthony Huang — equity research with a quantitative bent,
styled after the terminal I stare at all day.

**Live topics:** macro regimes, rate sensitivity in the equity cross-section,
and profitability decomposition. Every article is data-driven end to end: the
numbers, tables, and charts on each page come from reproducible analysis of
public data (FRED, SEC EDGAR, Yahoo Finance), not from screenshots or
hand-copied figures.

## What's here

- **Home** — a cross-asset monitor (equities, rates, vol) with live quotes,
  plus latest research notes and a "now" feed.
- **Research** — the long-form pieces. Each one is a full study with stated
  methodology, statistical tests, robustness checks, and honest caveats:
  - *Macro Regimes, Not Macro Prints* — a growth × inflation regime framework
    for equity allocation, built on real-time standardization.
  - *Equity Duration Is Not Where Investors Think* — a cross-sectional
    decomposition of rate beta, 2021–2026.
  - *Three Roads to ROE* — a DuPont panel study of what the source of
    profitability actually predicts.
- **Bio / Life Journey / Interests** — the person behind the research.

## Repo layout

| folder | contents |
| --- | --- |
| `analysis/` | **Source code for each research article.** One self-contained Python script per piece — it pulls the raw data, runs the statistics, and writes the JSON the article renders. Start here if you want to check or reproduce any number on the site. |
| `app/` | Next.js routes (App Router) |
| `components/` | UI — terminal-style chrome, charts (D3), article layouts |
| `content/` | Article front-matter and the generated data each article reads |
| `lib` / `scripts/` | Site utilities and the homepage market-data generator |

## Stack

Next.js 15 · React 19 · Tailwind v4 · D3 · KaTeX · MDX. Python
(pandas / numpy / statsmodels) for the research pipelines.

## Running locally

```
pnpm install
pnpm dev
```

To regenerate the research data, see `analysis/README.md` — each script runs
standalone against public sources, no API keys required.

---

This is research, not investment advice.
