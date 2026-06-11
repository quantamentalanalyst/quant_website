This is the source code for Anthony Huang's quantamental research website, quantamentalanthology.com. I'd love to keep building out my own "research hub" and maintaining my journal as a way to keep learning and stay curious about the markets.

In the analysis folder, you'll find the source code behind every data-driven analysis I wrote for each of the quantamental pieces.



## Repo layout

| folder | contents |
| --- | --- |
| `analysis/` | **Source code for each research article.** One self-contained Python script per piece — it pulls the raw data, runs the statistics, and writes the JSON the article renders. Start here if you want to check or reproduce any number on the site. |
| `app/` | Next.js routes (App Router) |
| `components/` | UI — terminal-style chrome, charts (D3), article layouts |
| `content/` | Article front-matter and the generated data each article reads |
| `lib/` | Site config and utilities |

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
