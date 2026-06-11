#!/usr/bin/env python3
"""
Macro regimes, not macro prints: growth x inflation framework, 2000-2026.

Research code behind the macro article. The pipeline, in order:

  1. pull ~16 monthly macro series from FRED (1990 start, so the expanding
     z-scores have a decade of burn-in by the 2000 sample start) and monthly
     prices from Yahoo (SPY, S&P 500 TR, a set of factor/sector ETFs)
  2. build a real-time growth composite: EXPANDING-window z of YoY industrial
     production / payrolls / retail sales (no look-ahead - the whole point)
  3. classify each month into a growth x inflation quadrant and sort forward
     3m SPY returns by regime
  4. inference that respects the overlap: circular block bootstrap CIs on the
     cell means, Newey-West dummy regression (stagflation omitted)
  5. a robustness grid over every discretionary choice in the construction
  6. side studies: unconditional lead-lag with effective-n correction,
     hard/soft sentiment gap quintiles, regime-conditioned factor spreads,
     and a tradeable allocation backtest driven by the real-time label

Output: JSON under content/research/2026-05-30-macro-regime/data/

Run from the repo root:
    python analysis/macro_regime.py

FRED rate-limits its daily series (VIX, the 10y-3m curve) fairly often.
VIX falls back to Yahoo ^VIX; the curve is dropped rather than proxied.
"""

import json
import time
from pathlib import Path

import numpy as np
import pandas as pd
import requests
import statsmodels.api as sm

UA = {"User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/124.0"}
FRED_START = "1990-01-01"
SAMPLE0 = pd.Period("2000-01", "M")
END = pd.Period("2026-05", "M")
HAC_L = 6                      # covers the 3m-return overlap plus regime persistence
OUT = Path("content/research/2026-05-30-macro-regime/data")

MONTHS = pd.period_range("1990-01", END, freq="M")
N = len(MONTHS)
IDX = {p: i for i, p in enumerate(MONTHS)}

FRED_IDS = {
    "PAYEMS": "PAYEMS", "UNRATE": "UNRATE", "ICSA": "ICSA",
    "CPI": "CPIAUCSL", "CORECPI": "CPILFESL", "PCE": "PCEPI", "COREPCE": "PCEPILFE",
    "RSAFS": "RSAFS", "INDPRO": "INDPRO", "FEDFUNDS": "FEDFUNDS", "T10Y3M": "T10Y3M",
    "NFCI": "NFCI", "UMCSENT": "UMCSENT", "VIX": "VIXCLS", "SAHM": "SAHMCURRENT",
    "PHILLY": "GACDFSA066MSFRBPHI", "TB3MS": "TB3MS",
}
ETFS = ["IWF", "IWD", "IWM", "IWB", "RSP", "IEF", "GLD",
        "XLK", "XLF", "XLE", "XLU", "XLP", "XLY", "XLI", "XLV", "XLB"]
GROUPS = ["Reflation", "Goldilocks", "Slowdown", "Stagflation"]
NAMES = {("up", "up"): "Reflation", ("up", "dn"): "Goldilocks",
         ("dn", "up"): "Stagflation", ("dn", "dn"): "Slowdown"}
KEYS = {"Reflation": "G↑ I↑", "Goldilocks": "G↑ I↓",
        "Stagflation": "G↓ I↑", "Slowdown": "G↓ I↓"}


# ---------------------------------------------------------------- data pulls
def fred_monthly(sid: str) -> np.ndarray:
    """FRED series resampled to month-end last observation, aligned to MONTHS."""
    url = (f"https://fred.stlouisfed.org/graph/fredgraph.csv"
           f"?id={sid}&cosd={FRED_START}&coed=2026-05-31")
    for attempt in range(5):
        try:
            resp = requests.get(url, headers=UA, timeout=30)
            if resp.ok and resp.text.startswith("observation_date"):
                df = pd.read_csv(pd.io.common.StringIO(resp.text), na_values=".")
                df.columns = ["date", "val"]
                df = df.dropna()
                s = pd.Series(df["val"].values,
                              index=pd.PeriodIndex(pd.to_datetime(df["date"]), freq="M"))
                s = s.groupby(level=0).last()
                return s.reindex(MONTHS).to_numpy(dtype=float)
        except requests.RequestException:
            pass
        time.sleep(0.8 * (attempt + 1))
    return np.full(N, np.nan)


def yahoo_monthly(sym: str) -> np.ndarray:
    p1 = int(pd.Timestamp("1990-01-01").timestamp())
    p2 = int(pd.Timestamp("2026-05-31").timestamp())
    url = (f"https://query1.finance.yahoo.com/v8/finance/chart/{sym}"
           f"?period1={p1}&period2={p2}&interval=1mo")
    for attempt in range(4):
        try:
            resp = requests.get(url, headers={**UA, "Accept": "application/json"}, timeout=30)
            if resp.ok:
                res = resp.json()["chart"]["result"][0]
                ts = res.get("timestamp", [])
                px = res["indicators"]["quote"][0].get("close", [])
                out = np.full(N, np.nan)
                for t, v in zip(ts, px):
                    if v is not None:
                        p = pd.Period(pd.Timestamp(t, unit="s"), freq="M")
                        if p in IDX:
                            out[IDX[p]] = v
                if np.isfinite(out).any():
                    return out
        except (requests.RequestException, KeyError, IndexError, TypeError):
            pass
        time.sleep(0.6 * (attempt + 1))
    return np.full(N, np.nan)


# ------------------------------------------------------------- transforms
def yoy(arr):
    out = np.full(N, np.nan)
    out[12:] = (arr[12:] / arr[:-12] - 1) * 100
    return out


def mom(arr):
    out = np.full(N, np.nan)
    out[1:] = (arr[1:] / arr[:-1] - 1) * 100
    return out


def ann3(arr):
    out = np.full(N, np.nan)
    with np.errstate(invalid="ignore"):
        ratio = arr[3:] / arr[:-3]
    ok = np.isfinite(ratio) & (ratio > 0)
    out[3:][ok] = (ratio[ok] ** 4 - 1) * 100
    return out


def z_series(vals, method):
    """Standardize a monthly array. 'full' uses the whole sample (look-ahead,
    kept only as a robustness row); 'exp' is expanding through t; 'roll' is a
    trailing 120m window. Population sd, 24-obs minimum."""
    s = pd.Series(vals)
    if method == "full":
        m, sd = np.nanmean(vals), np.nanstd(vals)
        return (vals - m) / sd if sd else np.full(N, np.nan)
    if method == "roll":
        m = s.rolling(120, min_periods=24).mean()
        sd = s.rolling(120, min_periods=24).std(ddof=0)
    else:
        m = s.expanding(24).mean()
        sd = s.expanding(24).std(ddof=0)
    return ((s - m) / sd.replace(0, np.nan)).to_numpy()


def r(x, n=2):
    if x is None:
        return None
    x = float(x)
    if not np.isfinite(x):
        return None
    v = round(x, n)
    return 0.0 if v == 0 else v


def nanmedian(xs):
    xs = [x for x in xs if x is not None and np.isfinite(x)]
    return float(np.median(xs)) if xs else None


def main():
    OUT.mkdir(parents=True, exist_ok=True)
    rng = np.random.default_rng(20260530)   # seeded so the bootstrap is reproducible

    S = {}
    for key, sid in FRED_IDS.items():
        S[key] = fred_monthly(sid)
        n_ok = int(np.isfinite(S[key]).sum())
        print(f"{key:<9} {sid:<20} {'n=' + str(n_ok) if n_ok else 'UNAVAILABLE'}")
        time.sleep(0.65)
    if not np.isfinite(S["VIX"]).any():
        S["VIX"] = yahoo_monthly("^VIX")
        print(f"VIX  <- Yahoo ^VIX  n={int(np.isfinite(S['VIX']).sum())}")

    spy = yahoo_monthly("SPY")
    spx_tr = yahoo_monthly("^SP500TR")
    etf = {s: yahoo_monthly(s) for s in ETFS}
    print(f"SPY:{int(np.isfinite(spy).sum())} TR:{int(np.isfinite(spx_tr).sum())} "
          + " ".join(f"{s}:{int(np.isfinite(etf[s]).sum())}" for s in ETFS))

    # forward 3m returns
    def fwd3(px):
        out = np.full(N, np.nan)
        out[:-3] = (px[3:] / px[:-3] - 1) * 100
        return out

    fwd_price, fwd_total = fwd3(spy), fwd3(spx_tr if np.isfinite(spx_tr).any() else spy)

    # growth z-blocks per standardization method and transform
    G_RAW = {"INDPRO": S["INDPRO"], "PAYEMS": S["PAYEMS"], "RSAFS": S["RSAFS"]}
    gz = {m: {k: z_series(yoy(v), m) for k, v in G_RAW.items()} for m in ("full", "exp", "roll")}
    gz_ann = {m: {k: z_series(ann3(v), m) for k, v in G_RAW.items()} for m in ("full", "exp")}

    # PCA weights from the full-sample z block (only used as a robustness row)
    M = np.column_stack([gz["full"][k] for k in G_RAW])
    ok = np.isfinite(M).all(axis=1)
    C = M[ok].T @ M[ok] / ok.sum()
    w_pca = np.linalg.eigh(C)[1][:, -1]
    if w_pca.sum() < 0:
        w_pca = -w_pca

    def growth_composite(method="exp", transform="yoy", weight="ew", drop=None):
        block = gz_ann[method if method != "roll" else "exp"] if transform == "ann3" else gz[method]
        keys = [k for k in G_RAW if k != drop]
        cols = np.column_stack([block[k] for k in keys])
        if weight == "pca":
            full = np.column_stack([block[k] for k in G_RAW])
            out = full @ w_pca
            out[~np.isfinite(full).all(axis=1)] = np.nan
            return out
        return np.nanmean(cols, axis=1)

    infl_yoy = {"cpi": yoy(S["CORECPI"]), "pce": yoy(S["COREPCE"])}

    COVID = (pd.Period("2020-02", "M"), pd.Period("2021-04", "M"))
    GFC = (pd.Period("2008-06", "M"), pd.Period("2009-12", "M"))

    def classify(g_lag=3, i_lag=3, infl="cpi", returns="price", drop_win=None, **gc_kw):
        gc = growth_composite(**gc_kw)
        iy = infl_yoy[infl]
        fwd = fwd_total if returns == "total" else fwd_price
        labels, rets, ms, current = [], [], [], None
        for i in range(12, N):
            g_now, g_past = gc[i], gc[i - g_lag]
            i_now, i_past = iy[i], iy[i - i_lag]
            if not all(np.isfinite([g_now, g_past, i_now, i_past])):
                continue
            name = NAMES[("up" if g_now >= g_past else "dn", "up" if i_now > i_past else "dn")]
            current = {"ym": str(MONTHS[i]), "name": name,
                       "gNow": g_now, "gPast": g_past, "iNow": i_now, "iPast": i_past}
            if MONTHS[i] < SAMPLE0:
                continue
            if drop_win and drop_win[0] <= MONTHS[i] <= drop_win[1]:
                continue
            if not np.isfinite(fwd[i]):
                continue
            labels.append(name)
            rets.append(fwd[i])
            ms.append(MONTHS[i])
        return labels, np.array(rets), ms, current

    def cells(labels, rets):
        out = {}
        for g in GROUPS:
            xs = rets[[l == g for l in labels]]
            out[g] = {"mean": xs.mean() if len(xs) else None,
                      "hit": (xs > 0).mean() * 100 if len(xs) else None, "n": len(xs)}
        return out

    # ---- headline classification (expanding window, the tradeable one) ------
    labels, rets, ms, current = classify()
    head_cells = cells(labels, rets)

    # circular block bootstrap on the cell means
    B, L = 3000, 6
    lab_arr = np.array(labels)
    dist = {g: [] for g in GROUPS}
    n_obs = len(rets)
    for _ in range(B):
        starts = rng.integers(0, n_obs, size=n_obs // L + 1)
        idx = np.concatenate([np.arange(s, s + L) % n_obs for s in starts])[:n_obs]
        for g in GROUPS:
            sel = rets[idx][lab_arr[idx] == g]
            if len(sel):
                dist[g].append(sel.mean())
    regime = []
    for g in GROUPS:
        d = np.sort(dist[g])
        c = head_cells[g]
        regime.append({
            "key": KEYS[g], "name": g,
            "mean": r(c["mean"], 1), "se": r(np.std(d), 2),
            "lo": r(d[int(0.025 * len(d))], 1), "hi": r(d[int(0.975 * len(d))], 1),
            "hit": r(c["hit"], 0), "n": c["n"], "nEff": round(c["n"] / 3),
        })
    regime.sort(key=lambda x: -(x["mean"] or -99))
    (OUT / "regime.json").write_text(json.dumps(regime, ensure_ascii=False))

    # ---- HAC dummy regression, stagflation omitted ---------------------------
    X = pd.DataFrame({
        "refl": [1 if l == "Reflation" else 0 for l in labels],
        "slow": [1 if l == "Slowdown" else 0 for l in labels],
        "gold": [1 if l == "Goldilocks" else 0 for l in labels],
    })
    f = sm.OLS(rets, sm.add_constant(X)).fit(cov_type="HAC", cov_kwds={"maxlags": HAC_L})
    not_stag = [0 if l == "Stagflation" else 1 for l in labels]
    fj = sm.OLS(rets, sm.add_constant(pd.Series(not_stag, name="ns"))) \
        .fit(cov_type="HAC", cov_kwds={"maxlags": HAC_L})
    reg_reg = {
        "stagMean": r(f.params["const"]), "stagT": r(f.tvalues["const"], 1),
        "contrasts": [
            {"name": "Reflation − Stagflation", "est": r(f.params["refl"]), "t": r(f.tvalues["refl"], 1)},
            {"name": "Slowdown − Stagflation", "est": r(f.params["slow"]), "t": r(f.tvalues["slow"], 1)},
            {"name": "Goldilocks − Stagflation", "est": r(f.params["gold"]), "t": r(f.tvalues["gold"], 1)},
        ],
        "joint": {"name": "Non-stagflation − Stagflation",
                  "est": r(fj.params["ns"]), "t": r(fj.tvalues["ns"], 1)},
        "hacLag": HAC_L, "n": len(labels),
    }
    (OUT / "regime_reg.json").write_text(json.dumps(reg_reg, ensure_ascii=False))

    # ---- robustness grid ------------------------------------------------------
    def variant(label, **kw):
        lab, rt, _, _ = classify(**kw)
        c = cells(lab, rt)
        means = {g: c[g]["mean"] for g in GROUPS}
        others = [means[g] for g in ("Reflation", "Goldilocks", "Slowdown")]
        stag = means["Stagflation"]
        return {
            "label": label,
            "refl": r(means["Reflation"], 1), "gold": r(means["Goldilocks"], 1),
            "slow": r(means["Slowdown"], 1), "stag": r(stag, 1), "n": len(rt),
            "stagLowest": stag <= min(means.values()),
            "stagOnlyNeg": stag < 0 and all(m > 0 for m in others),
            "spread": r(np.mean(others) - stag, 1),
            "margin": r(min(others) - stag, 1),
        }

    robustness = [
        variant("Baseline (expanding z, 3m, YoY, EW, core CPI, price)"),
        variant("6-month growth/inflation momentum", g_lag=6, i_lag=6),
        variant("Inflation = core PCE", infl="pce"),
        variant("Growth = 3-month annualized", transform="ann3"),
        variant("Growth composite = PCA-weighted", weight="pca"),
        variant("Full-sample z (look-ahead)", method="full"),
        variant("Rolling 10-year z", method="roll"),
        variant("Ex-COVID (drop 2020-02…2021-04)", drop_win=COVID),
        variant("Ex-GFC (drop 2008-06…2009-12)", drop_win=GFC),
        variant("S&P 500 total return", returns="total"),
        variant("Drop industrial production", drop="INDPRO"),
        variant("Drop payrolls", drop="PAYEMS"),
        variant("Drop retail sales", drop="RSAFS"),
    ]
    (OUT / "robustness.json").write_text(json.dumps(robustness, ensure_ascii=False))

    # ---- unconditional lead-lag, overlap-corrected ----------------------------
    in_sample = np.array([p >= SAMPLE0 for p in MONTHS])

    def corr_fwd(x):
        m = in_sample & np.isfinite(x) & np.isfinite(fwd_price)
        if m.sum() < 36:
            return None
        c = float(np.corrcoef(x[m], fwd_price[m])[0, 1])
        n = int(m.sum())
        n_eff = max(4, round(n / 3))   # fwd 3m returns sampled monthly overlap 2/3
        t = c * np.sqrt((n_eff - 2) / max(1e-9, 1 - c * c))
        return {"corr": r(c), "n": n, "nEff": n_eff, "tEff": r(t, 1)}

    def chg3(x):
        out = np.full(N, np.nan)
        out[3:] = x[3:] - x[:-3]
        return out

    lead_defs = [
        ("Initial claims", S["ICSA"], chg3(S["ICSA"])),
        ("Unemployment rate", S["UNRATE"], chg3(S["UNRATE"])),
        ("VIX", S["VIX"], chg3(S["VIX"])),
        ("Michigan sentiment", S["UMCSENT"], chg3(S["UMCSENT"])),
        ("Retail sales YoY", yoy(S["RSAFS"]), chg3(yoy(S["RSAFS"]))),
        ("Industrial prod. YoY", yoy(S["INDPRO"]), chg3(yoy(S["INDPRO"]))),
        ("Payrolls YoY", yoy(S["PAYEMS"]), chg3(yoy(S["PAYEMS"]))),
        ("Core CPI YoY", infl_yoy["cpi"], chg3(infl_yoy["cpi"])),
        ("Fin. conditions (NFCI)", S["NFCI"], chg3(S["NFCI"])),
    ]
    leadlag = []
    for label, lvl, chg in lead_defs:
        a, b = corr_fwd(lvl), corr_fwd(chg)
        if a:
            leadlag.append({"label": label, "corr": a["corr"],
                            "corrChg": b["corr"] if b else None,
                            "n": a["n"], "nEff": a["nEff"], "tEff": a["tEff"]})
    leadlag.sort(key=lambda x: -x["corr"])
    (OUT / "leadlag.json").write_text(json.dumps(leadlag, ensure_ascii=False))

    # pre/post-2022 split: reaction function vs state-dependent risk premium
    cut = pd.Period("2022-01", "M")

    def corr_window(x, lo, hi):
        m = np.array([lo <= p <= hi for p in MONTHS]) & np.isfinite(x) & np.isfinite(fwd_price)
        return r(np.corrcoef(x[m], fwd_price[m])[0, 1]) if m.sum() >= 18 else None

    reaction = {k: {"pre": corr_window(v, SAMPLE0, cut - 1),
                    "post": corr_window(v, cut, END)}
                for k, v in [("claims", S["ICSA"]), ("vix", S["VIX"]), ("unrate", S["UNRATE"])]}
    (OUT / "reaction.json").write_text(json.dumps(reaction))

    # ---- hard/soft divergence factor ------------------------------------------
    z_un = z_series(S["UNRATE"], "exp")
    z_cl = z_series(S["ICSA"], "exp")
    z_mi = z_series(S["UMCSENT"], "exp")
    parts = np.column_stack([gz["exp"]["INDPRO"], gz["exp"]["PAYEMS"], gz["exp"]["RSAFS"],
                             -z_un, -z_cl])
    hard = np.where(np.isfinite(parts).sum(axis=1) >= 4, np.nanmean(parts, axis=1), np.nan)
    gap = hard - z_mi
    rows = [(MONTHS[i], gap[i], fwd_price[i]) for i in range(N)
            if MONTHS[i] >= SAMPLE0 and np.isfinite(gap[i]) and np.isfinite(fwd_price[i])]
    rows.sort(key=lambda t: t[1])
    qn = len(rows) // 5
    quint = []
    for q in range(5):
        sl = rows[q * qn:] if q == 4 else rows[q * qn:(q + 1) * qn]
        xs = np.array([t[2] for t in sl])
        quint.append({"q": q + 1, "mean": r(xs.mean(), 1), "hit": r((xs > 0).mean() * 100, 0),
                      "n": len(sl), "gapLo": r(sl[0][1]), "gapHi": r(sl[-1][1])})
    last_i = max(i for i in range(N) if np.isfinite(gap[i]))
    hardsoft = {"quint": quint, "currentGap": r(gap[last_i]),
                "currentHardZ": r(hard[last_i]), "currentMichZ": r(z_mi[last_i]),
                "asOf": str(MONTHS[last_i])}
    (OUT / "hardsoft.json").write_text(json.dumps(hardsoft))

    # ---- regime-conditioned factor spreads -------------------------------------
    label_at = dict(zip(ms, labels))

    def fwd3_rel(long_px, short_px):
        return fwd3(long_px) - fwd3(short_px)

    def basket_fwd(symbols):
        return np.nanmean(np.column_stack([fwd3(etf[s]) for s in symbols]), axis=1)

    cyc, dfs = ["XLY", "XLF", "XLI", "XLB", "XLE"], ["XLP", "XLU", "XLV"]
    spread_defs = [
        ("Value − Growth (IWD−IWF)", fwd3_rel(etf["IWD"], etf["IWF"])),
        ("Small − Large (IWM−IWB)", fwd3_rel(etf["IWM"], etf["IWB"])),
        ("Cyclicals − Defensives", basket_fwd(cyc) - basket_fwd(dfs)),
        ("Equal-wt − Cap-wt (RSP−SPY)", fwd3_rel(etf["RSP"], spy)),
    ]
    spreads = []
    for label, arr in spread_defs:
        acc, n_tot = {g: [] for g in GROUPS}, 0
        for p, g in label_at.items():
            v = arr[IDX[p]]
            if np.isfinite(v):
                acc[g].append(v)
                n_tot += 1
        spreads.append({"label": label,
                        "byRegime": {g: r(np.mean(acc[g]), 1) if acc[g] else None for g in GROUPS},
                        "n": n_tot})

    sector_syms = ["XLK", "XLF", "XLE", "XLU", "XLP", "XLY", "XLI", "XLV", "XLB"]
    tilt = []
    for g in GROUPS:
        means = []
        for s in sector_syms:
            xs = [fwd3(etf[s])[IDX[p]] for p, lab in label_at.items()
                  if lab == g and np.isfinite(fwd3(etf[s])[IDX[p]])]
            if xs:
                means.append((s, np.mean(xs)))
        means.sort(key=lambda t: -t[1])
        tilt.append({"regime": g,
                     "best": {"sym": means[0][0], "ret": r(means[0][1], 1)},
                     "worst": {"sym": means[-1][0], "ret": r(means[-1][1], 1)}})
    (OUT / "factors.json").write_text(json.dumps(
        {"spreads": spreads, "sectorTilt": tilt, "n": spreads[0]["n"]}, ensure_ascii=False))

    # ---- allocation backtest (regime label sets next-month weights) ------------
    WEIGHTS = {"Reflation": {"SPY": 1.0}, "Goldilocks": {"SPY": 1.0},
               "Slowdown": {"SPY": 0.75, "IEF": 0.25},
               "Stagflation": {"SPY": 0.40, "IEF": 0.20, "GLD": 0.20, "CASH": 0.20}}
    bt0 = pd.Period("2005-01", "M")   # GLD lists late 2004
    bt_months = [p for p in MONTHS if bt0 <= p <= END]

    def mret(px, p):
        a, b = px[IDX[p - 1]], px[IDX[p]]
        return b / a - 1 if np.isfinite(a) and np.isfinite(b) else None

    strat_eq = spy_eq = 1.0
    prev_w, turn_sum, turn_n = None, 0.0, 0
    curve, strat_r, spy_r, cash_rates = [], [], [], []
    for k in range(1, len(bt_months)):
        decision, p = bt_months[k - 1], bt_months[k]
        w = WEIGHTS.get(label_at.get(decision), {"SPY": 1.0})
        if prev_w is not None:
            turn_sum += sum(abs(w.get(a, 0) - prev_w.get(a, 0))
                            for a in ("SPY", "IEF", "GLD", "CASH")) / 2
            turn_n += 1
        prev_w = w
        tb = S["TB3MS"][IDX[p]]
        tb = tb if np.isfinite(tb) else (S["TB3MS"][IDX[p - 1]] if np.isfinite(S["TB3MS"][IDX[p - 1]]) else 2.0)
        cash_rates.append(tb)
        r_parts = {"SPY": mret(spy, p) or 0.0, "IEF": mret(etf["IEF"], p) or 0.0,
                   "GLD": mret(etf["GLD"], p) or 0.0, "CASH": tb / 100 / 12}
        rp = sum(w.get(a, 0) * r_parts[a] for a in r_parts)
        strat_eq *= 1 + rp
        spy_eq *= 1 + r_parts["SPY"]
        strat_r.append(rp)
        spy_r.append(r_parts["SPY"])
        curve.append({"date": f"{p}-01", "strat": round(strat_eq, 4), "spy": round(spy_eq, 4)})

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
                "worst12": r(worst12 * 100, 1),
                "hit": r((rets > 0).mean() * 100, 0)}

    def by_decade(rets):
        buckets = {}
        for i, ret in enumerate(rets):
            y = bt_months[i + 1].year
            d = "2005–09" if y < 2010 else "2010–19" if y < 2020 else "2020–26"
            buckets.setdefault(d, []).append(ret)
        return {d: r((np.prod(1 + np.array(v)) ** (12 / len(v)) - 1) * 100, 1)
                for d, v in buckets.items()}

    alloc = {"start": str(bt0), "end": str(END),
             "strategy": {**perf(strat_r, strat_eq), "byDecade": by_decade(strat_r),
                          "turnover": r(turn_sum / turn_n * 100, 0)},
             "spy": {**perf(spy_r, spy_eq), "byDecade": by_decade(spy_r)},
             "curve": curve, "weights": WEIGHTS, "rfAnn": r(rf_m * 12 * 100, 1)}
    (OUT / "alloc.json").write_text(json.dumps(alloc, ensure_ascii=False))

    # ---- current-regime confidence ----------------------------------------------
    gc = growth_composite()
    ci = IDX[pd.Period(current["ym"], "M")]
    g_chg = gc[ci] - gc[ci - 3]
    i_chg = current["iNow"] - current["iPast"]
    g_hist = [gc[i] - gc[i - 3] for i in range(15, N)
              if MONTHS[i] >= SAMPLE0 and np.isfinite(gc[i]) and np.isfinite(gc[i - 3])]
    iy = infl_yoy["cpi"]
    i_hist = [iy[i] - iy[i - 3] for i in range(15, N)
              if MONTHS[i] >= SAMPLE0 and np.isfinite(iy[i]) and np.isfinite(iy[i - 3])]

    def pct_of(hist, v):
        return float(np.mean([abs(x) <= abs(v) for x in hist]))

    def strength(p):
        return "strong" if p >= 0.66 else "moderate" if p >= 0.33 else "weak"

    gs, is_ = pct_of(g_hist, g_chg), pct_of(i_hist, i_chg)
    conf = min(gs, is_)
    confidence = {
        "asOf": current["ym"], "regime": current["name"],
        "growth": {"dir": "accelerating" if g_chg >= 0 else "decelerating",
                   "sigma": r(g_chg / np.std(g_hist), 2), "strength": strength(gs)},
        "infl": {"dir": "rising" if i_chg > 0 else "falling",
                 "sigma": r(i_chg / np.std(i_hist), 2), "strength": strength(is_)},
        "confidence": "high" if conf >= 0.66 else "moderate" if conf >= 0.33 else "low",
        "confPct": r(conf * 100, 0),
    }
    (OUT / "confidence.json").write_text(json.dumps(confidence))

    # ---- dashboard ----------------------------------------------------------------
    def dash(label, arr, kind, unit, dec, interp):
        series = yoy(arr) if kind == "yoy" else mom(arr) if kind == "mom" else arr
        fin = [i for i in range(N) if np.isfinite(series[i])]
        if not fin:
            return None
        i_last = fin[-1]
        prior = series[i_last - 12] if i_last >= 12 and np.isfinite(series[i_last - 12]) else None
        tail = series[max(0, i_last - 119):i_last + 1]
        tail = tail[np.isfinite(tail)]
        m, sd = tail.mean(), tail.std()
        return {"label": label, "unit": unit, "last": r(series[i_last], dec),
                "prior": r(prior, dec), "z": r((series[i_last] - m) / sd if sd else 0, 2),
                "asOf": str(MONTHS[i_last]), "interp": interp(series[i_last], prior)}

    icsa_k = S["ICSA"] / 1000
    dashboard = [d for d in [
        dash("Core CPI", S["CORECPI"], "yoy", "% YoY", 1,
             lambda v, p: "above the 2% target" if v > 2.5 else "near target"),
        dash("Core PCE", S["COREPCE"], "yoy", "% YoY", 1,
             lambda v, p: "re-accelerating" if p is not None and v > p else "easing"),
        dash("CPI", S["CPI"], "yoy", "% YoY", 1,
             lambda v, p: "headline sticky" if v > 3 else "contained"),
        dash("Unemployment", S["UNRATE"], "level", "%", 1,
             lambda v, p: "cooling, not breaking" if v < 4.5 else "loosening"),
        dash("Initial claims", icsa_k, "level", "k", 0,
             lambda v, p: "labor stress low" if v < 250 else "rising stress"),
        dash("Payrolls", S["PAYEMS"], "mom", "% MoM", 2,
             lambda v, p: "still adding jobs" if v > 0 else "shedding jobs"),
        dash("Retail sales", S["RSAFS"], "yoy", "% YoY", 1,
             lambda v, p: "consumer resilient" if v > 3 else "consumer softening"),
        dash("Industrial prod.", S["INDPRO"], "yoy", "% YoY", 1,
             lambda v, p: "goods cycle positive" if v > 0 else "goods cycle contracting"),
        dash("Mfg pulse (Philly)", S["PHILLY"], "level", "idx", 1,
             lambda v, p: "factory expansion" if v > 0 else "factory soft"),
        dash("Sahm rule", S["SAHM"], "level", "pp", 2,
             lambda v, p: "recession trigger dormant" if v < 0.5 else "recession signal"),
        dash("Fed funds", S["FEDFUNDS"], "level", "%", 2,
             lambda v, p: "easing cycle" if p is not None and v < p else "restrictive"),
        dash("Fin. conditions", S["NFCI"], "level", "idx", 2,
             lambda v, p: "accommodative" if v < 0 else "tight"),
        dash("Michigan sent.", S["UMCSENT"], "level", "idx", 0,
             lambda v, p: "soft-data stress" if v < 65 else "consumer steady"),
        dash("VIX", S["VIX"], "level", "", 1,
             lambda v, p: "risk calm" if v < 20 else "risk elevated"),
    ] if d]
    if np.isfinite(S["T10Y3M"]).any():
        dashboard.insert(11, dash("10y−3m curve", S["T10Y3M"], "level", "pp", 2,
                                  lambda v, p: "inverted" if v < 0 else "positively sloped"))
    (OUT / "dashboard.json").write_text(json.dumps(dashboard, ensure_ascii=False))

    # narrative series for the figures
    p15 = pd.Period("2015-01", "M")
    inflation = [{"date": f"{MONTHS[i]}-01", "cpi": r(yoy(S['CPI'])[i], 1),
                  "core": r(infl_yoy['cpi'][i], 1), "pce": r(yoy(S['PCE'])[i], 1),
                  "corePce": r(infl_yoy['pce'][i], 1)}
                 for i in range(N) if MONTHS[i] >= p15 and np.isfinite(yoy(S["CPI"])[i])]
    (OUT / "inflation.json").write_text(json.dumps(inflation))

    signal = [{"date": f"{MONTHS[i]}-01", "growth": r(gc[i]),
               "inflChg": r(chg3(infl_yoy['cpi'])[i])}
              for i in range(N) if MONTHS[i] >= SAMPLE0 and np.isfinite(gc[i])]
    (OUT / "signal.json").write_text(json.dumps(signal))

    labor = [{"date": f"{MONTHS[i]}-01", "unrate": r(S['UNRATE'][i], 1),
              "claims": r(icsa_k[i], 0)}
             for i in range(N) if MONTHS[i] >= p15 and np.isfinite(S["UNRATE"][i])]
    (OUT / "labor.json").write_text(json.dumps(labor))

    summary = {"asOf": "2026-05-30", "sample": f"{SAMPLE0} → {ms[-1]}", "hacLag": HAC_L,
               "current": confidence, "regime": regime, "regReg": reg_reg,
               "robustness": robustness, "leadlag": leadlag, "reaction": reaction,
               "hardsoft": hardsoft, "factors": {"spreads": spreads, "sectorTilt": tilt},
               "alloc": alloc, "confidence": confidence,
               "pcaWeights": [r(w) for w in w_pca]}
    (OUT / "summary.json").write_text(json.dumps(summary, indent=2, ensure_ascii=False))

    print("\nregime (fwd 3m SPY, expanding-window):")
    for x in regime:
        print(f"  {x['name']:<12} {x['mean']:>5}%  CI[{x['lo']},{x['hi']}]  hit {x['hit']}%  n={x['n']}")
    print(f"non-stag - stag: {reg_reg['joint']['est']}pp (t {reg_reg['joint']['t']})")
    print(f"stag last in {sum(v['stagLowest'] for v in robustness)}/{len(robustness)} variants")
    print(f"current: {confidence['regime']} ({confidence['confidence']} confidence)")
    print(f"\nwrote JSON to {OUT}")


if __name__ == "__main__":
    main()
