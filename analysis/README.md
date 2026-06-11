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
