#!/usr/bin/env python3
"""
Equity duration: cross-sectional decomposition of rate beta, 2021-2026.

Research code behind the rates article. The short version of the method:
decompose daily nominal 10y moves into real (TIPS) and breakeven components,
then estimate sector-level rate betas four ways (univariate nominal / real /
breakeven, and real controlling for the market factor). Everything gets
Newey-West (HAC) standard errors because daily returns are fat-tailed and
serially correlated, and OLS t-stats flatter you otherwise.

Data: FRED (DGS10, DFII10 - no key needed) and Yahoo daily adjusted closes.
Output: JSON files the article page reads, under
content/research/2026-02-01-equity-duration/data/

Run from the repo root:
    python analysis/equity_duration.py

Takes a couple of minutes; FRED 504s on long date ranges so the yield series
come down in 3-year chunks.
"""

import json
import time
from pathlib import Path

import numpy as np
import pandas as pd
import requests
import statsmodels.api as sm

UA = {"User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/124.0"}
START, END = "2010-01-01", "2026-01-31"
FOCUS = "2021-01-01"          # the inflation-regime window for the headline tables
HAC_LAGS = 5
OUT = Path("content/research/2026-02-01-equity-duration/data")

SECTORS = [
    ("XLK", "Technology"), ("XLC", "Comm Svcs"), ("XLY", "Cons Disc"), ("XLP", "Cons Staples"),
    ("XLE", "Energy"), ("XLF", "Financials"), ("XLV", "Health Care"), ("XLI", "Industrials"),
    ("XLB", "Materials"), ("XLRE", "Real Estate"), ("XLU", "Utilities"),
]
GV = [  # growth minus value, three definitions
    ("IWF", "IWD", "Russell 1000 G/V"),
    ("SPYG", "SPYV", "S&P 500 G/V"),
    ("QQQ", "RSP", "Nasdaq-100 / EW S&P"),
]


# ---------------------------------------------------------------- data pulls
def fred(series_id: str) -> pd.Series:
    """Daily FRED series, fetched in 3y chunks (the graph endpoint times out
    on a 16-year request more often than not)."""
    frames = []
    y0, y1 = int(START[:4]), int(END[:4])
    for y in range(y0, y1 + 1, 3):
        coed = min(f"{y + 2}-12-31", END)
        url = (f"https://fred.stlouisfed.org/graph/fredgraph.csv"
               f"?id={series_id}&cosd={y}-01-01&coed={coed}")
        for attempt in range(4):
            try:
                r = requests.get(url, headers=UA, timeout=30)
                if r.ok and r.text.startswith("observation_date"):
                    df = pd.read_csv(pd.io.common.StringIO(r.text), na_values=".")
                    df.columns = ["date", "val"]
                    frames.append(df.dropna())
                    break
            except requests.RequestException:
                pass
            time.sleep(0.7 * (attempt + 1))
        time.sleep(0.25)
    if not frames:
        return pd.Series(dtype=float)
    out = pd.concat(frames).drop_duplicates("date").set_index("date")["val"]
    out.index = pd.to_datetime(out.index)
    return out.sort_index()


def yahoo_daily(sym: str) -> pd.Series:
    p1 = int(pd.Timestamp(START).timestamp())
    p2 = int(pd.Timestamp(END).timestamp())
    url = (f"https://query1.finance.yahoo.com/v8/finance/chart/{sym}"
           f"?period1={p1}&period2={p2}&interval=1d")
    for attempt in range(4):
        try:
            r = requests.get(url, headers={**UA, "Accept": "application/json"}, timeout=30)
            if r.ok:
                res = r.json()["chart"]["result"][0]
                ts = res.get("timestamp", [])
                px = res["indicators"]["quote"][0].get("close", [])
                idx = pd.to_datetime(ts, unit="s").normalize()
                s = pd.Series(px, index=idx, dtype=float).dropna()
                if len(s):
                    return s[~s.index.duplicated(keep="last")].sort_index()
        except (requests.RequestException, KeyError, IndexError, TypeError):
            pass
        time.sleep(0.6 * (attempt + 1))
    return pd.Series(dtype=float)


# ------------------------------------------------------------------- stats
def nw(y: pd.Series, X: pd.DataFrame, lags: int = HAC_LAGS):
    """OLS with Newey-West errors. Returns the fitted results or None if the
    overlap is too thin to bother."""
    d = pd.concat([y.rename("y"), X], axis=1).dropna()
    if len(d) < 30:
        return None
    Xc = sm.add_constant(d[X.columns])
    return sm.OLS(d["y"], Xc).fit(cov_type="HAC", cov_kwds={"maxlags": lags})


def r(x, n=2):
    if x is None or (isinstance(x, float) and not np.isfinite(x)):
        return None
    v = round(float(x), n)
    return 0.0 if v == 0 else v   # kill the "-0.0" display artifact


def sens(beta):
    """Coefficient is decimal return per pp of yield -> % return per +100bp."""
    return r(beta * 100, 2)


def main():
    OUT.mkdir(parents=True, exist_ok=True)

    nom = fred("DGS10")
    real = fred("DFII10")
    print(f"FRED  DGS10 n={len(nom)}  DFII10 n={len(real)}")
    if nom.empty or real.empty:
        raise SystemExit("FRED unavailable (rate-limited?). Real yields have no "
                         "substitute - refusing to write empty data.")

    need = ["SPY", "^VIX", "CL=F"] + [s for s, _ in SECTORS] + \
           sorted({t for g in GV for t in g[:2]})
    px = {}
    for s in need:
        px[s] = yahoo_daily(s)
        print(f"{s}:{len(px[s])}", end=" ", flush=True)
        time.sleep(0.2)
    print()

    # one master frame of daily changes / returns, aligned on dates where
    # SPY and both yield series all exist
    dates = px["SPY"].index.intersection(nom.index).intersection(real.index)
    df = pd.DataFrame(index=dates)
    df["d_nom"] = nom.reindex(dates).diff()
    df["d_real"] = real.reindex(dates).diff()
    df["d_be"] = df["d_nom"] - df["d_real"]
    df["mkt"] = px["SPY"].reindex(dates).pct_change()
    df["d_vix"] = px["^VIX"].reindex(dates).diff()
    df["oil"] = px["CL=F"].reindex(dates).pct_change()
    for s, _ in SECTORS:
        df[s] = px[s].reindex(dates).pct_change()
    for g, v, label in GV:
        df[label] = px[g].reindex(dates).pct_change() - px[v].reindex(dates).pct_change()

    focus = df.loc[FOCUS:END]

    # ---- sector decomposition (Table 1 of the article) ----------------------
    decomp = []
    for s, label in SECTORS:
        f_nom = nw(focus[s], focus[["d_nom"]])
        f_real = nw(focus[s], focus[["d_real"]])
        f_be = nw(focus[s], focus[["d_be"]])
        f_ctrl = nw(focus[s], focus[["d_real", "mkt"]])
        if f_nom is None or f_real is None:
            continue
        decomp.append({
            "sym": s, "label": label,
            "nom": sens(f_nom.params["d_nom"]), "tNom": r(f_nom.tvalues["d_nom"], 1),
            "real": sens(f_real.params["d_real"]), "tReal": r(f_real.tvalues["d_real"], 1),
            "be": sens(f_be.params["d_be"]), "tBE": r(f_be.tvalues["d_be"], 1),
            "realCtrl": sens(f_ctrl.params["d_real"]), "tRealCtrl": r(f_ctrl.tvalues["d_real"], 1),
            "mktBeta": r(f_ctrl.params["mkt"], 2),
            "r2": r(f_nom.rsquared, 3), "n": int(f_nom.nobs),
        })
    decomp.sort(key=lambda d: d["realCtrl"])
    (OUT / "sector_decomp.json").write_text(json.dumps(decomp))

    # ---- full five-factor model for the exemplars ---------------------------
    mf = []
    for s in ["XLK", "XLRE", "XLF", "XLE"]:
        f = nw(focus[s], focus[["d_real", "d_be", "mkt", "d_vix", "oil"]])
        if f is None:
            continue
        mf.append({
            "sym": s,
            "real": sens(f.params["d_real"]), "tReal": r(f.tvalues["d_real"], 1),
            "be": sens(f.params["d_be"]), "tBE": r(f.tvalues["d_be"], 1),
            "mkt": r(f.params["mkt"], 2), "tMkt": r(f.tvalues["mkt"], 1),
            "vix": r(f.params["d_vix"] * 100, 3), "tVix": r(f.tvalues["d_vix"], 1),
            "oil": r(f.params["oil"], 2), "tOil": r(f.tvalues["oil"], 1),
            "r2": r(f.rsquared, 3), "n": int(f.nobs),
        })
    (OUT / "multifactor.json").write_text(json.dumps(mf))

    # ---- sub-period stability of the market-controlled real-rate beta -------
    periods = [("2010-20", "2010-01-01", "2020-12-31"),
               ("2021-22", "2021-01-01", "2022-12-31"),
               ("2023-26", "2023-01-01", END)]
    stability = []
    for s, label in SECTORS:
        row = {"sym": s, "label": label}
        for name, lo, hi in periods:
            f = nw(df.loc[lo:hi, s], df.loc[lo:hi, ["d_real", "mkt"]])
            row[name] = sens(f.params["d_real"]) if f is not None else None
        stability.append(row)
    stability.sort(key=lambda x: x["2021-22"] if x["2021-22"] is not None else 0)
    (OUT / "stability.json").write_text(json.dumps(stability))

    # ---- rolling 252d beta, re-estimated every 5 trading days ---------------
    ROLL = ["XLRE", "XLU", "XLK", "XLF", "XLE"]
    W = 252
    span = df.loc["2011-01-01":END]
    roll_rows = []
    for i in range(W, len(span), 5):
        win = span.iloc[i - W:i]
        pt = {"date": span.index[i - 1].strftime("%Y-%m-%d")}
        for s in ROLL:
            f = nw(win[s], win[["d_real", "mkt"]], lags=5)
            pt[s] = sens(f.params["d_real"]) if f is not None else None
        roll_rows.append(pt)
    (OUT / "rolling_betas.json").write_text(json.dumps(roll_rows))

    # ---- growth-value at daily frequency, three definitions -----------------
    gv_out = []
    for _, _, label in GV:
        f_n = nw(focus[label], focus[["d_nom"]])
        f_r = nw(focus[label], focus[["d_real"]])
        f_c = nw(focus[label], focus[["d_real", "mkt"]])
        if f_n is None:
            continue
        gv_out.append({
            "label": label,
            "nom": sens(f_n.params["d_nom"]), "tNom": r(f_n.tvalues["d_nom"], 1),
            "real": sens(f_r.params["d_real"]) if f_r is not None else None,
            "tReal": r(f_r.tvalues["d_real"], 1) if f_r is not None else None,
            "realCtrl": sens(f_c.params["d_real"]) if f_c is not None else None,
            "tRealCtrl": r(f_c.tvalues["d_real"], 1) if f_c is not None else None,
            "r2": r(f_n.rsquared, 3), "n": int(f_n.nobs),
        })

    # the popular monthly IWF/IWD version, for the frequency-artifact point
    me = pd.DataFrame({
        "g": px["IWF"].reindex(dates), "v": px["IWD"].reindex(dates),
        "y": nom.reindex(dates),
    }).loc[FOCUS:END].resample("ME").last().dropna()
    gv_m = (me["g"].pct_change() - me["v"].pct_change())
    f_m = nw(gv_m, me[["y"]].diff().rename(columns={"y": "d_nom"}), lags=2)
    gv_monthly = None
    if f_m is not None:
        gv_monthly = {"nom": sens(f_m.params["d_nom"]), "tNom": r(f_m.tvalues["d_nom"], 1),
                      "r2": r(f_m.rsquared, 3), "n": int(f_m.nobs)}
    (OUT / "gv_defs.json").write_text(json.dumps({"daily": gv_out, "monthlyIWF": gv_monthly}))

    # scatter for the visual (every other point keeps the payload small)
    sc = focus[["Russell 1000 G/V", "d_real"]].dropna()
    f_sc = nw(sc["Russell 1000 G/V"], sc[["d_real"]])
    pts = [{"x": r(x, 3), "y": r(y * 100, 2)}
           for x, y in zip(sc["d_real"], sc["Russell 1000 G/V"])][::2]
    fit = {"beta": r(f_sc.params["d_real"] * 100, 2), "alpha": r(f_sc.params["const"] * 100, 3),
           "r2": r(f_sc.rsquared, 3), "t": r(f_sc.tvalues["d_real"], 1), "n": int(f_sc.nobs)} \
        if f_sc is not None else {"beta": 0, "alpha": 0, "r2": 0, "t": 0, "n": 0}
    (OUT / "gv_scatter.json").write_text(json.dumps({"points": pts, "fit": fit}))

    # ---- hedge backtest on the worst rate-up days ---------------------------
    up = focus[["d_nom"]].dropna().sort_values("d_nom", ascending=False)
    top = up.head(round(len(up) * 0.10))

    def mean_ret(sym, days):
        return focus.loc[days.index, sym].mean()

    legs = {
        "short XLK (tech)": lambda d: -mean_ret("XLK", d),
        "short XLRE+XLU (bond proxies)": lambda d: -(mean_ret("XLRE", d) + mean_ret("XLU", d)) / 2,
        "long XLE+XLF / short XLRE+XLU":
            lambda d: (mean_ret("XLE", d) + mean_ret("XLF", d)) / 2
                      - (mean_ret("XLRE", d) + mean_ret("XLU", d)) / 2,
    }
    hedge = [{"name": name,
              "topDecile": r(fn(top) * 100, 2),
              "allDays": r(fn(up) * 100, 3),
              "avgDyTop": r(top["d_nom"].mean() * 100, 1)}
             for name, fn in legs.items()]
    (OUT / "hedge.json").write_text(json.dumps({"hedge": hedge, "nTop": len(top), "nAll": len(up)}))

    # ---- level series for Fig 1 / Fig 2 -------------------------------------
    lv = pd.DataFrame({"nominal": nom, "real": real}).loc[FOCUS:END].dropna()
    yields = [{"date": d.strftime("%Y-%m-%d"), "nominal": r(row["nominal"]),
               "real": r(row["real"]), "be": r(row["nominal"] - row["real"])}
              for d, row in lv.iterrows()]
    (OUT / "yields.json").write_text(json.dumps(yields))

    rc = focus[["d_nom", "mkt"]].dropna()
    corr63 = rc["d_nom"].rolling(63).corr(rc["mkt"]).dropna()
    (OUT / "rolling_corr.json").write_text(json.dumps(
        [{"date": d.strftime("%Y-%m-%d"), "corr": r(v, 3)} for d, v in corr63.items()]))

    summary = {
        "asOf": "2026-02-01", "focus": f"{FOCUS} -> {END}", "hacLag": HAC_LAGS,
        "realYield": {"start": yields[0]["real"], "end": yields[-1]["real"]},
        "breakeven": {"start": yields[0]["be"], "end": yields[-1]["be"]},
        "decomp": decomp, "multifactor": mf, "stability": stability,
        "gv": {"daily": gv_out, "monthlyIWF": gv_monthly}, "hedge": hedge,
    }
    (OUT / "summary.json").write_text(json.dumps(summary, indent=2))

    print("\nsector decomp (real|mkt, % per +100bp):")
    for d in decomp:
        print(f"  {d['sym']:<5} {d['realCtrl']:>7}  (t {d['tRealCtrl']})")
    print(f"\nwrote JSON to {OUT}")


if __name__ == "__main__":
    main()
