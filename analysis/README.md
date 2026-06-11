# Analysis

Research code behind the articles on the site. Each script is self-contained:
it pulls public data, runs the statistics, and writes the JSON that the
corresponding article page renders. The site never computes anything at
runtime — what you read on a page is exactly what these scripts produced.

| script | article | data |
| --- | --- | --- |
| `equity_duration.py` | Equity Duration Is Not Where Investors Think | FRED (DGS10, DFII10) + Yahoo daily |
| `macro_regime.py` | Macro Regimes, Not Macro Prints | FRED monthly + Yahoo monthly |
| `dupont_roe.py` | Three Roads to ROE | SEC EDGAR XBRL + Yahoo + FRED |

## Running

```
pip install -r requirements.txt
python analysis/macro_regime.py        # from the repo root
```

No API keys needed anywhere. Each run takes a few minutes — FRED and EDGAR
are paced deliberately (FRED rate-limits its daily series; EDGAR asks for a
contact email in the User-Agent and fair-use pacing).

Two practical notes:

- FRED will sometimes refuse the heavy daily series (VIXCLS, T10Y3M, DGS10).
  The scripts fall back to the Yahoo equivalent where one exists (^VIX, ^TNX)
  and drop the series where it doesn't, rather than publish a proxy.
- Re-running re-pulls live data, so numbers drift slightly as vintages revise
  and prices move. The committed JSON is the set the articles were written
  against.
