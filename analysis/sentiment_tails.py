#!/usr/bin/env python3
"""
Priced fear, unpriced gloom: sentiment and forward equity returns, 2000-2026.

Research code behind the sentiment article. The question, stated so it can
fail: does "sentiment" predict forward equity returns, and if so, WHICH
sentiment - the kind households report to a survey, or the kind the options
and credit markets charge for? The pipeline:

  1. pull five monthly sentiment proxies spanning three families - survey
     (Michigan), options-implied (VIX), credit/financial (Moody's Baa-Aaa
     spread, NFCI risk subindex), news-based (Baker-Bloom-Davis EPU) - plus
     SPY/^GSPC prices and the macro controls for the gap model
  2. standardize each proxy EXPANDING-WINDOW (the z at month t uses only data
     through t - same discipline as the macro-regime piece) and average into
     a fear composite, signed so higher = more fear
  3. sorts + predictive regressions at 1/3/12-month horizons with the
     overlap-corrected effective sample and Newey-West HAC t's
  4. the nonlinearity: quantile regressions (does fear move the mean of the
     forward-return distribution, or its tails?) with circular-block-
     bootstrap CIs, and a tiny exhaustive-split regression tree (numpy, no
     sklearn) that locates the fear threshold endogenously
  5. the honesty test: Campbell-Thompson out-of-sample R^2 vs the expanding
     historical mean, for the linear signal and for the tail rule
  6. the vibecession, quantified: expanding-window OLS of Michigan sentiment
     on unemployment, CPI inflation, gas-price inflation and the trailing
     12m market return; the residual is "unexplained gloom" - test whether
     it predicts the market or merely the mood
  7. fear-conditioned factor spreads and a real-time SPY/IEF overlay

Output: JSON under content/research/2026-07-04-sentiment-tails/data/

Run from the repo root:
    python analysis/sentiment_tails.py

FRED rate-limits daily series now and then; VIX falls back to Yahoo ^VIX.
"""

import json
import os
import time
import warnings
from pathlib import Path

import numpy as np
import pandas as pd
import requests
import statsmodels.api as sm
from statsmodels.tools.sm_exceptions import IterationLimitWarning

# benign: QuantReg IRLS on bootstrap resamples; nanmean over pre-listing months
warnings.simplefilter("ignore", IterationLimitWarning)
warnings.filterwarnings("ignore", message="Mean of empty slice")

UA = {"User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/124.0"}
# Official FRED API (api.stlouisfed.org) when a key is present - the website's
# fredgraph.csv endpoint tarpits scripted clients. Free key:
# https://fredaccount.stlouisfed.org/apikeys  ->  set FRED_API_KEY.
FRED_KEY = os.environ.get("FRED_API_KEY", "").strip()
FRED_START = "1985-01-01"          # EPU starts 1985; earlier is burn-in anyway
SAMPLE0 = pd.Period("2000-01", "M")
END = pd.Period("2026-06", "M")
HAC_L = 6                          # covers the 3m-return overlap plus persistence
OUT = Path("content/research/2026-07-04-sentiment-tails/data")

MONTHS = pd.period_range("1985-01", END, freq="M")
N = len(MONTHS)
IDX = {p: i for i, p in enumerate(MONTHS)}

# monthly aggregation: surveys/indices are point-in-time ("last"); daily
# market series are averaged within the month to damp month-end noise
FRED_IDS = {
    "UMCSENT":  ("UMCSENT", "last"),        # Michigan consumer sentiment
    "VIX":      ("VIXCLS", "mean"),         # CBOE VIX, daily
    "BAA":      ("BAA", "last"),            # Moody's Baa corporate yield, monthly
    "AAA":      ("AAA", "last"),            # Moody's Aaa corporate yield, monthly
    "NFCIRISK": ("NFCIRISK", "mean"),       # Chicago Fed NFCI risk subindex, weekly
    "EPU":      ("USEPUINDXM", "last"),     # news-based policy uncertainty, monthly
    "UNRATE":   ("UNRATE", "last"),
    "CPI":      ("CPIAUCSL", "last"),
    "GAS":      ("GASREGW", "mean"),        # regular gas price, weekly, 1990-08+
    "TB3MS":    ("TB3MS", "last"),
}
# fear composite members and their sign (higher composite = more fear).
# Credit leg is the Moody's Baa−Aaa quality spread, not HY OAS: ICE licensing
# caps BofA series on the FRED API to a trailing 3-year window, useless for
# expanding z-scores. Baa−Aaa is monthly since 1919 and is the canonical
# default-risk-premium series.
FEAR_SIGN = {"VIX": +1, "CREDIT": +1, "NFCIRISK": +1, "EPU": +1, "UMCSENT": -1}
PROXY_LABEL = {
    "VIX": "VIX (options)", "CREDIT": "Baa−Aaa spread (credit)",
    "NFCIRISK": "NFCI risk (financial)", "EPU": "Policy uncertainty (news)",
    "UMCSENT": "Michigan sentiment (survey)",
}
ETFS = ["IWD", "IWF", "IWM", "IWB", "QQQ", "RSP", "IEF",
        "XLY", "XLF", "XLI", "XLB", "XLE", "XLP", "XLU", "XLV"]


# ---------------------------------------------------------------- data pulls
def _to_monthly(dates, vals, how: str) -> np.ndarray:
    s = pd.Series(vals, index=pd.PeriodIndex(pd.to_datetime(dates), freq="M"))
    s = s.groupby(level=0).mean() if how == "mean" else s.groupby(level=0).last()
    return s.reindex(MONTHS).to_numpy(dtype=float)


def fred_monthly(sid: str, how: str) -> np.ndarray:
    if FRED_KEY:
        url = ("https://api.stlouisfed.org/fred/series/observations"
               f"?series_id={sid}&api_key={FRED_KEY}&file_type=json"
               f"&observation_start={FRED_START}&observation_end=2026-06-30")
        for attempt in range(4):
            try:
                resp = requests.get(url, headers=UA, timeout=60)
                if resp.ok:
                    obs = [(o["date"], float(o["value"]))
                           for o in resp.json().get("observations", [])
                           if o.get("value") not in (None, ".", "")]
                    if obs:
                        return _to_monthly([d for d, _ in obs], [v for _, v in obs], how)
            except (requests.RequestException, ValueError, KeyError):
                pass
            time.sleep(2 * (attempt + 1))
        return np.full(N, np.nan)
    # keyless fallback: the website CSV (tarpits scripted bursts; go slow)
    url = (f"https://fred.stlouisfed.org/graph/fredgraph.csv"
           f"?id={sid}&cosd={FRED_START}&coed=2026-06-30")
    for attempt in range(4):
        try:
            resp = requests.get(url, headers=UA, timeout=60)
            if resp.ok and resp.text.startswith("observation_date"):
                df = pd.read_csv(pd.io.common.StringIO(resp.text), na_values=".")
                df.columns = ["date", "val"]
                df = df.dropna()
                return _to_monthly(df["date"], df["val"].values, how)
        except requests.RequestException:
            pass
        time.sleep(8 * (attempt + 1))
    return np.full(N, np.nan)


def yahoo_monthly(sym: str, how: str = "last") -> np.ndarray:
    p1 = int(pd.Timestamp("1985-01-01").timestamp())
    p2 = int(pd.Timestamp("2026-06-30").timestamp())
    url = (f"https://query1.finance.yahoo.com/v8/finance/chart/{sym}"
           f"?period1={p1}&period2={p2}&interval=1mo&events=div,split")
    for attempt in range(4):
        try:
            resp = requests.get(url, headers={**UA, "Accept": "application/json"}, timeout=30)
            if resp.ok:
                res = resp.json()["chart"]["result"][0]
                ts = res.get("timestamp", [])
                ind = res["indicators"]
                px = (ind.get("adjclose", [{}])[0].get("adjclose")
                      or ind["quote"][0].get("close") or [])
                out = np.full(N, np.nan)
                for t, v in zip(ts, px):
                    if v is not None:
                        p = pd.Period(pd.Timestamp(t, unit="s"), freq="M")
                        if p in IDX:
                            out[IDX[p]] = float(v)
                if np.isfinite(out).any():
                    return out
        except (requests.RequestException, KeyError, IndexError, TypeError):
            pass
        time.sleep(0.6 * (attempt + 1))
    return np.full(N, np.nan)


# ---------------------------------------------------------------- transforms
def yoy(arr):
    out = np.full(N, np.nan)
    with np.errstate(invalid="ignore", divide="ignore"):
        out[12:] = (arr[12:] / arr[:-12] - 1) * 100
    return out


def fwd_ret(px, h):
    out = np.full(N, np.nan)
    with np.errstate(invalid="ignore", divide="ignore"):
        out[:-h] = (px[h:] / px[:-h] - 1) * 100
    return out


def trail_ret(px, h):
    out = np.full(N, np.nan)
    with np.errstate(invalid="ignore", divide="ignore"):
        out[h:] = (px[h:] / px[:-h] - 1) * 100
    return out


def z_exp(vals, min_obs=24):
    """Expanding-window z: mean/sd through t only. Population sd."""
    s = pd.Series(vals)
    m = s.expanding(min_obs).mean()
    sd = s.expanding(min_obs).std(ddof=0)
    return ((s - m) / sd.replace(0, np.nan)).to_numpy()


def r(x, n=2):
    if x is None:
        return None
    x = float(x)
    if not np.isfinite(x):
        return None
    v = round(x, n)
    return 0.0 if v == 0 else v


def hac_uni(y, x, lags=HAC_L, mask=None):
    """OLS y = a + b x with Newey-West HAC. Returns (b, t, n)."""
    m = np.isfinite(y) & np.isfinite(x)
    if mask is not None:
        m &= mask
    if m.sum() < 36:
        return None, None, int(m.sum())
    f = sm.OLS(y[m], sm.add_constant(x[m])).fit(cov_type="HAC", cov_kwds={"maxlags": lags})
    return float(f.params[1]), float(f.tvalues[1]), int(m.sum())


def block_idx(rng, n, L=6):
    """Circular moving-block bootstrap index."""
    starts = rng.integers(0, n, size=n // L + 1)
    return np.concatenate([np.arange(s, s + L) % n for s in starts])[:n]


def main():
    OUT.mkdir(parents=True, exist_ok=True)
    rng = np.random.default_rng(20260704)
    print(f"FRED route: {'official API (key set)' if FRED_KEY else 'website CSV (no key)'}",
          flush=True)

    # ---- pulls
    S = {}
    for key, (sid, how) in FRED_IDS.items():
        S[key] = fred_monthly(sid, how)
        n_ok = int(np.isfinite(S[key]).sum())
        print(f"{key:<9} {sid:<14} {'n=' + str(n_ok) if n_ok else 'UNAVAILABLE'}", flush=True)
        time.sleep(2.0)
    if not np.isfinite(S["VIX"]).any():
        S["VIX"] = yahoo_monthly("^VIX")
        print(f"VIX <- Yahoo ^VIX n={int(np.isfinite(S['VIX']).sum())}", flush=True)
    if not np.isfinite(S["UNRATE"]).any():
        raise SystemExit("FRED unreachable (all series empty) — wait for the "
                         "graylist to clear and rerun.")
    S["CREDIT"] = S["BAA"] - S["AAA"]        # Moody's quality spread, pp
    print(f"CREDIT    Baa-Aaa        n={int(np.isfinite(S['CREDIT']).sum())}", flush=True)

    spy = yahoo_monthly("SPY")
    gspc = yahoo_monthly("^GSPC")
    vix3m = yahoo_monthly("^VIX3M")          # 2007+; auxiliary only
    etf = {s: yahoo_monthly(s) for s in ETFS}
    print(f"SPY:{int(np.isfinite(spy).sum())} GSPC:{int(np.isfinite(gspc).sum())} "
          f"VIX3M:{int(np.isfinite(vix3m).sum())} "
          + " ".join(f"{s}:{int(np.isfinite(etf[s]).sum())}" for s in ETFS))

    fwd1, fwd3, fwd12 = fwd_ret(spy, 1), fwd_ret(spy, 3), fwd_ret(spy, 12)
    in_sample = np.array([p >= SAMPLE0 for p in MONTHS])

    # ---- expanding z per proxy; fear composite
    zs = {k: z_exp(S[k]) for k in FEAR_SIGN}
    signed = np.column_stack([FEAR_SIGN[k] * zs[k] for k in FEAR_SIGN])
    n_avail = np.isfinite(signed).sum(axis=1)
    fear = np.where(n_avail >= 4, np.nanmean(signed, axis=1), np.nan)
    # z the composite itself so "sigma" statements refer to its own history
    fear_z = z_exp(fear)

    # term-structure slope (auxiliary, 2007+): VIX - VIX3M > 0 = backwardation/stress
    slope = S["VIX"] - vix3m

    # ---- dashboard: current readings
    def pct_since(arr, i_last, since=SAMPLE0):
        m = in_sample & np.isfinite(arr) & (np.arange(N) <= i_last)
        if m.sum() < 24:
            return None
        return float(np.mean(arr[m] <= arr[i_last]) * 100)

    def dash_row(key, label, unit, dec, invert_note=""):
        arr = S[key]
        fin = [i for i in range(N) if np.isfinite(arr[i])]
        if not fin:
            return None
        i_last = fin[-1]
        return {
            "key": key, "label": label, "unit": unit,
            "last": r(arr[i_last], dec),
            "prior": r(arr[i_last - 12], dec) if i_last >= 12 else None,
            "z": r(zs[key][i_last] if key in zs else np.nan, 2),
            "pct": r(pct_since(arr, i_last), 0),
            "asOf": str(MONTHS[i_last]),
            "note": invert_note,
        }

    dashboard = [d for d in [
        dash_row("VIX", "VIX", "", 1),
        dash_row("CREDIT", "Credit spread (Baa−Aaa)", "pp", 2),
        dash_row("NFCIRISK", "NFCI risk subindex", "idx", 2),
        dash_row("EPU", "Policy uncertainty (EPU)", "idx", 0),
        dash_row("UMCSENT", "Michigan sentiment", "idx", 1, "enters composite inverted"),
    ] if d]
    i_fear = max(i for i in range(N) if np.isfinite(fear[i]))
    dashboard.append({
        "key": "FEAR", "label": "Fear composite", "unit": "z",
        "last": r(fear[i_fear], 2), "prior": r(fear[i_fear - 12], 2),
        "z": r(fear_z[i_fear], 2), "pct": r(pct_since(fear, i_fear), 0),
        "asOf": str(MONTHS[i_fear]), "note": "mean of five signed z-scores",
    })
    i_sl = max((i for i in range(N) if np.isfinite(slope[i])), default=None)
    if i_sl is not None:
        dashboard.append({
            "key": "SLOPE", "label": "VIX − VIX3M slope", "unit": "pts",
            "last": r(slope[i_sl], 1), "prior": r(slope[i_sl - 12], 1),
            "z": None, "pct": r(pct_since(slope, i_sl, pd.Period("2008-01", "M")), 0),
            "asOf": str(MONTHS[i_sl]), "note": "auxiliary; 2007+ only",
        })
    (OUT / "dashboard.json").write_text(json.dumps(dashboard, ensure_ascii=False), encoding="utf-8")

    # ---- lead-lag per proxy, three horizons, overlap-corrected
    def corr_eff(x, fwd, overlap):
        m = in_sample & np.isfinite(x) & np.isfinite(fwd)
        if m.sum() < 36:
            return None
        c = float(np.corrcoef(x[m], fwd[m])[0, 1])
        n = int(m.sum())
        n_eff = max(4, round(n / overlap))
        t = c * np.sqrt((n_eff - 2) / max(1e-9, 1 - c * c))
        return {"corr": r(c), "n": n, "nEff": n_eff, "tEff": r(t, 1)}

    leadlag = []
    for key in FEAR_SIGN:
        x = FEAR_SIGN[key] * zs[key]
        a1 = corr_eff(x, fwd1, 1)
        a3 = corr_eff(x, fwd3, 3)
        a12 = corr_eff(x, fwd12, 12)
        if a3:
            leadlag.append({"key": key, "label": PROXY_LABEL[key],
                            "c1": a1["corr"] if a1 else None,
                            "c3": a3["corr"], "t3": a3["tEff"],
                            "c12": a12["corr"] if a12 else None,
                            "t12": a12["tEff"] if a12 else None,
                            "n": a3["n"], "nEff": a3["nEff"]})
    a3 = corr_eff(fear, fwd3, 3)
    a1 = corr_eff(fear, fwd1, 1)
    a12 = corr_eff(fear, fwd12, 12)
    leadlag.append({"key": "FEAR", "label": "Fear composite",
                    "c1": a1["corr"], "c3": a3["corr"], "t3": a3["tEff"],
                    "c12": a12["corr"], "t12": a12["tEff"],
                    "n": a3["n"], "nEff": a3["nEff"]})
    sl3 = corr_eff(slope, fwd3, 3)
    if sl3:
        leadlag.append({"key": "SLOPE", "label": "VIX−VIX3M slope (2007+)",
                        "c1": (corr_eff(slope, fwd1, 1) or {}).get("corr"),
                        "c3": sl3["corr"], "t3": sl3["tEff"],
                        "c12": (corr_eff(slope, fwd12, 12) or {}).get("corr"),
                        "t12": (corr_eff(slope, fwd12, 12) or {}).get("tEff"),
                        "n": sl3["n"], "nEff": sl3["nEff"]})
    (OUT / "leadlag.json").write_text(json.dumps(leadlag, ensure_ascii=False), encoding="utf-8")

    # ---- quintile sort of fear -> fwd3, block-bootstrap CIs
    rows = [(i, fear[i], fwd3[i]) for i in range(N)
            if in_sample[i] and np.isfinite(fear[i]) and np.isfinite(fwd3[i])]
    fear_v = np.array([t[1] for t in rows])
    ret_v = np.array([t[2] for t in rows])
    order = np.argsort(fear_v, kind="stable")
    qn = len(rows) // 5
    quint, q_assign = [], np.empty(len(rows), dtype=int)
    for q in range(5):
        sel = order[q * qn:] if q == 4 else order[q * qn:(q + 1) * qn]
        q_assign[sel] = q
        xs = ret_v[sel]
        quint.append({"q": q + 1, "mean": xs.mean(), "hit": (xs > 0).mean() * 100,
                      "n": len(sel), "lo_f": fear_v[sel].min(), "hi_f": fear_v[sel].max()})
    B = 3000
    dist = {q: [] for q in range(5)}
    n_obs = len(rows)
    for _ in range(B):
        idx = block_idx(rng, n_obs)
        for q in range(5):
            sel = ret_v[idx][q_assign[idx] == q]
            if len(sel):
                dist[q].append(sel.mean())
    quintiles = []
    for q in range(5):
        d = np.sort(dist[q])
        c = quint[q]
        quintiles.append({
            "q": q + 1, "mean": r(c["mean"], 1),
            "lo": r(d[int(0.025 * len(d))], 1), "hi": r(d[int(0.975 * len(d))], 1),
            "hit": r(c["hit"], 0), "n": c["n"],
            "fearLo": r(c["lo_f"]), "fearHi": r(c["hi_f"]),
        })
    (OUT / "quintiles.json").write_text(json.dumps(quintiles, ensure_ascii=False), encoding="utf-8")

    # Q5-Q1 spread with bootstrap CI
    d51 = np.sort([np.mean(ret_v[idx][q_assign[idx] == 4]) - np.mean(ret_v[idx][q_assign[idx] == 0])
                   for idx in (block_idx(rng, n_obs) for _ in range(B))
                   if len(ret_v[idx][q_assign[idx] == 4]) and len(ret_v[idx][q_assign[idx] == 0])])
    spread51 = {"est": r(quint[4]["mean"] - quint[0]["mean"], 1),
                "lo": r(d51[int(0.025 * len(d51))], 1), "hi": r(d51[int(0.975 * len(d51))], 1)}

    # ---- quantile regressions: fwd3 ~ fear at tau grid, block-bootstrap CIs
    TAUS = [0.10, 0.25, 0.50, 0.75, 0.90]
    Xq = sm.add_constant(pd.Series(fear_v, name="fear"))
    yq = pd.Series(ret_v)
    qreg = []
    for tau in TAUS:
        f = sm.QuantReg(yq, Xq).fit(q=tau)
        bs = []
        for _ in range(600):
            idx = block_idx(rng, n_obs)
            try:
                bs.append(float(sm.QuantReg(yq.iloc[idx].reset_index(drop=True),
                                            Xq.iloc[idx].reset_index(drop=True)).fit(q=tau).params["fear"]))
            except Exception:
                continue
        bs = np.sort(bs)
        qreg.append({"tau": tau, "beta": r(float(f.params["fear"]), 2),
                     "lo": r(bs[int(0.025 * len(bs))], 2), "hi": r(bs[int(0.975 * len(bs))], 2)})
        print(f"qreg tau={tau}: beta={qreg[-1]['beta']} CI[{qreg[-1]['lo']},{qreg[-1]['hi']}]")
    b_ols, t_ols, _ = hac_uni(ret_v, fear_v)   # ret_v/fear_v already 2000+ only
    (OUT / "qreg.json").write_text(json.dumps(
        {"taus": qreg, "ols": {"beta": r(b_ols, 2), "t": r(t_ols, 1)}, "n": n_obs},
        ensure_ascii=False), encoding="utf-8")

    # ---- tiny exhaustive-split regression tree (depth 2, min leaf 24)
    def best_split(x, y, min_leaf=24):
        order = np.argsort(x, kind="stable")
        xs, ys = x[order], y[order]
        n = len(xs)
        best = None
        css = np.cumsum(ys)
        tot = css[-1]
        for i in range(min_leaf, n - min_leaf):
            if xs[i] == xs[i - 1]:
                continue
            nl, nr = i, n - i
            sl, sr = css[i - 1], tot - css[i - 1]
            gain = sl * sl / nl + sr * sr / nr        # SSE reduction ∝ this
            if best is None or gain > best[0]:
                best = (gain, (xs[i - 1] + xs[i]) / 2, nl, nr)
        if best is None:
            return None
        _, thr, nl, nr = best
        return {"thr": thr, "nl": nl, "nr": nr,
                "meanL": ys[:nl].mean(), "meanR": ys[nl:].mean()}

    root = best_split(fear_v, ret_v)
    mask_l = fear_v <= root["thr"]
    left = best_split(fear_v[mask_l], ret_v[mask_l])
    right = best_split(fear_v[~mask_l], ret_v[~mask_l])
    tree = {
        "root": {"thr": r(root["thr"]), "meanL": r(root["meanL"], 1),
                 "meanR": r(root["meanR"], 1), "nL": root["nl"], "nR": root["nr"]},
        "left": None if left is None else
            {"thr": r(left["thr"]), "meanL": r(left["meanL"], 1),
             "meanR": r(left["meanR"], 1), "nL": left["nl"], "nR": left["nr"]},
        "right": None if right is None else
            {"thr": r(right["thr"]), "meanL": r(right["meanL"], 1),
             "meanR": r(right["meanR"], 1), "nL": right["nl"], "nR": right["nr"]},
    }
    (OUT / "tree.json").write_text(json.dumps(tree, ensure_ascii=False), encoding="utf-8")

    # ---- horse race: univariate + multivariate HAC on the five z's
    horse = {"uni": [], "multi": []}
    for key in FEAR_SIGN:
        x = FEAR_SIGN[key] * zs[key]
        b, t, n = hac_uni(fwd3, x, mask=in_sample)
        horse["uni"].append({"key": key, "label": PROXY_LABEL[key],
                             "beta": r(b, 2), "t": r(t, 1), "n": n})
    cols = {k: FEAR_SIGN[k] * zs[k] for k in FEAR_SIGN}
    Mx = np.column_stack(list(cols.values()))
    mm = in_sample & np.isfinite(fwd3) & np.isfinite(Mx).all(axis=1)
    fm = sm.OLS(fwd3[mm], sm.add_constant(Mx[mm])) \
        .fit(cov_type="HAC", cov_kwds={"maxlags": HAC_L})
    for j, key in enumerate(cols):
        horse["multi"].append({"key": key, "label": PROXY_LABEL[key],
                               "beta": r(float(fm.params[j + 1]), 2),
                               "t": r(float(fm.tvalues[j + 1]), 1)})
    horse["multiN"] = int(mm.sum())
    horse["multiR2"] = r(float(fm.rsquared) * 100, 1)
    (OUT / "horserace.json").write_text(json.dumps(horse, ensure_ascii=False), encoding="utf-8")

    # ---- out-of-sample: Campbell-Thompson R^2_OOS vs expanding mean
    # forecasts of fwd3 formed at month t using data whose forward window has
    # CLOSED by t (train through t-3). OOS period 2010-01 .. END-3.
    oos0 = pd.Period("2010-01", "M")
    tr_i = [i for i in range(N) if in_sample[i] and np.isfinite(fear[i]) and np.isfinite(fwd3[i])]
    e_mean, e_lin, e_rule, n_oos = [], [], [], 0
    thr_rt = []
    for i in range(N):
        if MONTHS[i] < oos0 or not (np.isfinite(fear[i]) and np.isfinite(fwd3[i])):
            continue
        hist = [j for j in tr_i if j <= i - 3]
        if len(hist) < 60:
            continue
        yh = np.array([fwd3[j] for j in hist])
        xh = np.array([fear[j] for j in hist])
        mu = yh.mean()
        bh = sm.OLS(yh, sm.add_constant(xh)).fit()
        f_lin = float(bh.params[0] + bh.params[1] * fear[i])
        # tail rule: state means, threshold = +1 sigma of fear's own history
        sd_h = xh.std()
        thr = xh.mean() + sd_h
        thr_rt.append(thr)
        in_tail = xh >= thr
        f_rule = yh[in_tail].mean() if (fear[i] >= thr and in_tail.sum() >= 12) \
            else yh[~in_tail].mean()
        e_mean.append((fwd3[i] - mu) ** 2)
        e_lin.append((fwd3[i] - f_lin) ** 2)
        e_rule.append((fwd3[i] - f_rule) ** 2)
        n_oos += 1
    sse_m = float(np.sum(e_mean))
    oos = {"n": n_oos, "start": str(oos0), "end": str(END - 3),
           "r2Lin": r((1 - np.sum(e_lin) / sse_m) * 100, 1),
           "r2Rule": r((1 - np.sum(e_rule) / sse_m) * 100, 1),
           "thrAvg": r(float(np.mean(thr_rt)), 2)}
    # in-sample R2 for contrast
    mm2 = in_sample & np.isfinite(fear) & np.isfinite(fwd3)
    fis = sm.OLS(fwd3[mm2], sm.add_constant(fear[mm2])).fit()
    oos["r2InSample"] = r(float(fis.rsquared) * 100, 1)
    (OUT / "oos.json").write_text(json.dumps(oos, ensure_ascii=False), encoding="utf-8")
    print(f"OOS: lin {oos['r2Lin']}% rule {oos['r2Rule']}% (in-sample {oos['r2InSample']}%)")

    # ---- the vibecession model: expanding OLS of Michigan on fundamentals
    trail12 = trail_ret(gspc, 12)
    cpi_yoy = yoy(S["CPI"])
    gas_yoy = yoy(S["GAS"])
    Xg_cols = [S["UNRATE"], cpi_yoy, gas_yoy, trail12]
    gap_fit = np.full(N, np.nan)
    ok_g = np.isfinite(S["UMCSENT"]) & np.isfinite(np.column_stack(Xg_cols)).all(axis=1)
    idx_ok = np.where(ok_g)[0]
    MIN_G = 120
    for pos, i in enumerate(idx_ok):
        if pos < MIN_G:
            continue
        hist = idx_ok[:pos + 1]                     # through t: nowcast, not forecast
        Xh = np.column_stack([c[hist] for c in Xg_cols])
        yh = S["UMCSENT"][hist]
        fg = sm.OLS(yh, sm.add_constant(Xh)).fit()
        gap_fit[i] = float(fg.predict([1, *[c[i] for c in Xg_cols]])[0])
    gap = S["UMCSENT"] - gap_fit
    gap_z = z_exp(gap)
    # full-sample coefficient snapshot (descriptive) on 2000+
    mg = ok_g & in_sample
    fg_full = sm.OLS(S["UMCSENT"][mg], sm.add_constant(np.column_stack([c[mg] for c in Xg_cols]))) \
        .fit(cov_type="HAC", cov_kwds={"maxlags": 12})
    gap_model = {
        "coefs": [
            {"name": "Unemployment rate", "b": r(float(fg_full.params[1]), 1), "t": r(float(fg_full.tvalues[1]), 1)},
            {"name": "CPI inflation (YoY)", "b": r(float(fg_full.params[2]), 1), "t": r(float(fg_full.tvalues[2]), 1)},
            {"name": "Gas price (YoY)", "b": r(float(fg_full.params[3]), 2), "t": r(float(fg_full.tvalues[3]), 1)},
            {"name": "Trailing 12m S&P return", "b": r(float(fg_full.params[4]), 2), "t": r(float(fg_full.tvalues[4]), 1)},
        ],
        "r2": r(float(fg_full.rsquared) * 100, 0), "n": int(mg.sum()),
    }
    # does the gap predict the market, or the mood?
    d_ums12 = np.full(N, np.nan)
    d_ums12[:-12] = S["UMCSENT"][12:] - S["UMCSENT"][:-12]
    b_mkt, t_mkt, n_mkt = hac_uni(fwd12, gap_z, lags=12, mask=in_sample)
    b_mood, t_mood, n_mood = hac_uni(d_ums12, gap_z, lags=12, mask=in_sample)
    c_mkt = corr_eff(gap_z, fwd12, 12)
    m_moodc = in_sample & np.isfinite(gap_z) & np.isfinite(d_ums12)
    c_mood = float(np.corrcoef(gap_z[m_moodc], d_ums12[m_moodc])[0, 1])
    i_gap = max(i for i in range(N) if np.isfinite(gap[i]))
    gapstats = {
        "model": gap_model,
        "current": {"asOf": str(MONTHS[i_gap]), "actual": r(S["UMCSENT"][i_gap], 1),
                    "fitted": r(gap_fit[i_gap], 1), "gap": r(gap[i_gap], 1),
                    "gapZ": r(gap_z[i_gap], 2)},
        "predMarket": {"b": r(b_mkt, 2), "t": r(t_mkt, 1), "corr": c_mkt["corr"] if c_mkt else None,
                       "tEff": c_mkt["tEff"] if c_mkt else None, "n": n_mkt},
        "predMood": {"b": r(b_mood, 2), "t": r(t_mood, 1), "corr": r(c_mood), "n": n_mood},
    }
    # gap quintiles -> fwd3 (parallel to the fear sort)
    rows_g = [(gap_z[i], fwd3[i]) for i in range(N)
              if in_sample[i] and np.isfinite(gap_z[i]) and np.isfinite(fwd3[i])]
    rows_g.sort(key=lambda t: t[0])
    qng = len(rows_g) // 5
    gq = []
    for q in range(5):
        sl = rows_g[q * qng:] if q == 4 else rows_g[q * qng:(q + 1) * qng]
        xs = np.array([t[1] for t in sl])
        gq.append({"q": q + 1, "mean": r(xs.mean(), 1), "hit": r((xs > 0).mean() * 100, 0),
                   "n": len(sl), "gapLo": r(sl[0][0]), "gapHi": r(sl[-1][0])})
    gapstats["quint"] = gq
    (OUT / "gapstats.json").write_text(json.dumps(gapstats, ensure_ascii=False), encoding="utf-8")

    gap_series = [{"date": f"{MONTHS[i]}-01", "actual": r(S["UMCSENT"][i], 1),
                   "fitted": r(gap_fit[i], 1)}
                  for i in range(N)
                  if MONTHS[i] >= SAMPLE0 and np.isfinite(gap_fit[i]) and np.isfinite(S["UMCSENT"][i])]
    (OUT / "gap.json").write_text(json.dumps(gap_series), encoding="utf-8")

    # ---- fear terciles x factor spreads
    fin_f = np.sort(fear_v)
    t1, t2 = fin_f[len(fin_f) // 3], fin_f[2 * len(fin_f) // 3]
    TERC = ["Calm", "Neutral", "Fear"]

    def tercile(v):
        return "Calm" if v <= t1 else "Neutral" if v <= t2 else "Fear"

    def f3(px):
        return fwd_ret(px, 3)

    cyc = np.nanmean(np.column_stack([f3(etf[s]) for s in ["XLY", "XLF", "XLI", "XLB", "XLE"]]), axis=1)
    dfs = np.nanmean(np.column_stack([f3(etf[s]) for s in ["XLP", "XLU", "XLV"]]), axis=1)
    spread_defs = [
        ("Value − Growth (IWD−IWF)", f3(etf["IWD"]) - f3(etf["IWF"])),
        ("Small − Large (IWM−IWB)", f3(etf["IWM"]) - f3(etf["IWB"])),
        ("Nasdaq − S&P (QQQ−SPY)", f3(etf["QQQ"]) - f3(spy)),
        ("Cyclicals − Defensives", cyc - dfs),
        ("Equal-wt − Cap-wt (RSP−SPY)", f3(etf["RSP"]) - f3(spy)),
    ]
    factors = []
    for label, arr in spread_defs:
        acc = {g: [] for g in TERC}
        for i in range(N):
            if in_sample[i] and np.isfinite(fear[i]) and np.isfinite(arr[i]):
                acc[tercile(fear[i])].append(arr[i])
        factors.append({"label": label,
                        "byTercile": {g: r(np.mean(acc[g]), 1) if acc[g] else None for g in TERC},
                        "n": sum(len(acc[g]) for g in TERC)})
    (OUT / "factors.json").write_text(json.dumps(
        {"spreads": factors, "cuts": {"t1": r(t1), "t2": r(t2)}}, ensure_ascii=False), encoding="utf-8")

    # ---- real-time overlay: fear state sets next-month SPY/IEF weight
    bt0 = pd.Period("2003-01", "M")              # IEF lists mid-2002
    bt_months = [p for p in MONTHS if bt0 <= p <= END]
    W = {"fear": 1.00, "neutral": 0.70, "calm": 0.40}

    # real-time state uses fear's own expanding mean/sd (no full-sample cuts)
    fear_s = pd.Series(fear)
    f_mu = fear_s.expanding(60).mean().to_numpy()
    f_sd = fear_s.expanding(60).std(ddof=0).to_numpy()

    def state_at(i):
        if not (np.isfinite(fear[i]) and np.isfinite(f_mu[i]) and np.isfinite(f_sd[i]) and f_sd[i] > 0):
            return "neutral"
        z = (fear[i] - f_mu[i]) / f_sd[i]
        return "fear" if z >= 1.0 else "calm" if z <= -1.0 else "neutral"

    def mret(px, p):
        a, b = px[IDX[p - 1]], px[IDX[p]]
        return b / a - 1 if np.isfinite(a) and np.isfinite(b) else 0.0

    strat_eq = spy_eq = bench_eq = 1.0
    prev_w, turn_sum, turn_n = None, 0.0, 0
    curve, strat_r, spy_r, bench_r, cash_rates, state_n = [], [], [], [], [], {"fear": 0, "neutral": 0, "calm": 0}
    for k in range(1, len(bt_months)):
        decision, p = bt_months[k - 1], bt_months[k]
        st = state_at(IDX[decision])
        state_n[st] += 1
        w = W[st]
        if prev_w is not None:
            turn_sum += abs(w - prev_w)
            turn_n += 1
        prev_w = w
        tb = S["TB3MS"][IDX[p]]
        cash_rates.append(tb if np.isfinite(tb) else 2.0)
        r_spy, r_ief = mret(spy, p), mret(etf["IEF"], p)
        rp = w * r_spy + (1 - w) * r_ief
        rb = 0.70 * r_spy + 0.30 * r_ief
        strat_eq *= 1 + rp
        spy_eq *= 1 + r_spy
        bench_eq *= 1 + rb
        strat_r.append(rp)
        spy_r.append(r_spy)
        bench_r.append(rb)
        curve.append({"date": f"{p}-01", "strat": round(strat_eq, 4),
                      "spy": round(spy_eq, 4), "bench": round(bench_eq, 4)})
    rf_m = np.mean(cash_rates) / 100 / 12

    def perf(rets, eq_end):
        rets = np.array(rets)
        n = len(rets)
        mu, sd = rets.mean(), rets.std()
        path = np.concatenate([[1.0], np.cumprod(1 + rets)])
        peak = np.maximum.accumulate(path)
        worst12 = min(path[i] / path[i - 12] - 1 for i in range(12, len(path)))
        return {"cagr": r((eq_end ** (12 / n) - 1) * 100, 1),
                "vol": r(sd * np.sqrt(12) * 100, 1),
                "sharpe": r((mu - rf_m) / sd * np.sqrt(12), 2) if sd else 0,
                "maxdd": r((path / peak - 1).min() * 100, 1),
                "worst12": r(worst12 * 100, 1)}

    overlay = {"start": str(bt0), "end": str(END), "weights": W,
               "stateMonths": state_n,
               "strategy": {**perf(strat_r, strat_eq),
                            "turnover": r(turn_sum / turn_n * 100, 1)},
               "bench": perf(bench_r, bench_eq),
               "spy": perf(spy_r, spy_eq),
               "curve": curve, "rfAnn": r(rf_m * 12 * 100, 1)}
    (OUT / "overlay.json").write_text(json.dumps(overlay, ensure_ascii=False), encoding="utf-8")

    # ---- narrative series: fear composite + SPY drawdown
    dd = np.full(N, np.nan)
    peak = -np.inf
    for i in range(N):
        if np.isfinite(spy[i]):
            peak = max(peak, spy[i])
            dd[i] = (spy[i] / peak - 1) * 100
    composite = [{"date": f"{MONTHS[i]}-01", "fear": r(fear[i]), "dd": r(dd[i], 1)}
                 for i in range(N) if MONTHS[i] >= SAMPLE0 and np.isfinite(fear[i])]
    (OUT / "composite.json").write_text(json.dumps(composite), encoding="utf-8")

    summary = {
        "asOf": "2026-07-04", "sample": f"{SAMPLE0} → {END}", "hacLag": HAC_L,
        "dashboard": dashboard, "leadlag": leadlag,
        "quintiles": quintiles, "spread51": spread51,
        "qreg": {"taus": qreg, "ols": {"beta": r(b_ols, 2), "t": r(t_ols, 1)}},
        "tree": tree, "horserace": horse, "oos": oos,
        "gap": gapstats, "factors": factors, "overlay": {k: v for k, v in overlay.items() if k != "curve"},
    }
    (OUT / "summary.json").write_text(json.dumps(summary, indent=2, ensure_ascii=False), encoding="utf-8")

    print("\nfear quintiles (fwd 3m SPY):")
    for x in quintiles:
        print(f"  Q{x['q']}  {x['mean']:>5}%  CI[{x['lo']},{x['hi']}]  hit {x['hit']}%  n={x['n']}")
    print(f"Q5−Q1: {spread51['est']}pp CI[{spread51['lo']},{spread51['hi']}]")
    print(f"tree root thr={tree['root']['thr']} L={tree['root']['meanL']}% R={tree['root']['meanR']}%")
    print(f"gap current: {gapstats['current']}")
    print(f"overlay: strat Sharpe {overlay['strategy']['sharpe']} vs 70/30 {overlay['bench']['sharpe']} vs SPY {overlay['spy']['sharpe']}")
    print(f"\nwrote JSON to {OUT}")


if __name__ == "__main__":
    main()
