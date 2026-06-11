#!/usr/bin/env python3
"""
Three roads to ROE: what the source of profitability predicts, 2010-2025.

Research code behind the DuPont article. This is a panel study, not a
snapshot: pull full 10-K histories from SEC EDGAR (companyfacts XBRL, no key),
build fiscal-year fundamentals on AVERAGE beginning/ending balances, classify
each firm-year by which DuPont term drives its ROE (log decomposition vs the
cross-section median - no hand labels), then test what the source predicts:
forward ROE persistence, forward 12m returns, volatility, drawdown, and rate
sensitivity (sector-neutral high-minus-low portfolios on the equity multiplier
vs true net leverage).

The methodological hill I die on here: the equity multiplier (assets/equity)
is NOT financial leverage. Buybacks shrink the equity denominator without
adding a dollar of debt, so for the buyback-heavy cohort ROE and the
multiplier are denominator artifacts. Those firm-years get flagged not-
meaningful and excluded from ROE statistics; net-debt/EBITDA and ROIC carry
the load instead.

Data: SEC EDGAR companyfacts + Yahoo monthly prices + FRED DGS10 (Yahoo ^TNX
fallback when FRED rate-limits).
Output: JSON under content/research/2026-04-15-profit-dupont/data/

Run from the repo root:
    python analysis/dupont_roe.py

EDGAR asks for a contact in the User-Agent; full run is ~5 minutes with
polite pacing.
"""

import json
import time
from pathlib import Path

import numpy as np
import pandas as pd
import requests
import statsmodels.api as sm

EDGAR_UA = {"User-Agent": "quantamental-research anthonyhuang@aya.yale.edu",
            "Accept": "application/json"}
WEB_UA = {"User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/124.0"}
OUT = Path("content/research/2026-04-15-profit-dupont/data")
HAC_L = 6
MULT_CAP = 15        # beyond ~15x assets/equity the denominator is buyback noise
PANEL_YEARS = range(2010, 2025)

# Universe rule (stated in the article): large, continuously listed US
# non-financials since 2009, every GICS sector ex-Financials/Utilities/REITs
# where asset turnover isn't comparable. Survivor basket by construction;
# the survivorship section of the article deals with it head-on.
UNIVERSE = [
    ("AAPL", "Apple", "Technology"), ("MSFT", "Microsoft", "Technology"),
    ("NVDA", "NVIDIA", "Technology"), ("AVGO", "Broadcom", "Technology"),
    ("ORCL", "Oracle", "Technology"), ("CSCO", "Cisco", "Technology"),
    ("ACN", "Accenture", "Technology"), ("ADBE", "Adobe", "Technology"),
    ("CRM", "Salesforce", "Technology"), ("TXN", "Texas Instr.", "Technology"),
    ("QCOM", "Qualcomm", "Technology"), ("IBM", "IBM", "Technology"),
    ("GOOGL", "Alphabet", "Comm Services"), ("META", "Meta Platforms", "Comm Services"),
    ("NFLX", "Netflix", "Comm Services"), ("DIS", "Disney", "Comm Services"),
    ("CMCSA", "Comcast", "Comm Services"), ("VZ", "Verizon", "Comm Services"),
    ("T", "AT&T", "Comm Services"),
    ("AMZN", "Amazon", "Cons Discretionary"), ("HD", "Home Depot", "Cons Discretionary"),
    ("MCD", "McDonald's", "Cons Discretionary"), ("NKE", "Nike", "Cons Discretionary"),
    ("LOW", "Lowe's", "Cons Discretionary"), ("SBUX", "Starbucks", "Cons Discretionary"),
    ("TJX", "TJX Companies", "Cons Discretionary"), ("BKNG", "Booking", "Cons Discretionary"),
    ("WMT", "Walmart", "Cons Staples"), ("COST", "Costco", "Cons Staples"),
    ("PG", "Procter & Gamble", "Cons Staples"), ("KO", "Coca-Cola", "Cons Staples"),
    ("PEP", "PepsiCo", "Cons Staples"), ("MDLZ", "Mondelez", "Cons Staples"),
    ("CL", "Colgate", "Cons Staples"), ("MO", "Altria", "Cons Staples"),
    ("PM", "Philip Morris", "Cons Staples"),
    ("UNH", "UnitedHealth", "Health Care"), ("JNJ", "Johnson & Johnson", "Health Care"),
    ("LLY", "Eli Lilly", "Health Care"), ("MRK", "Merck", "Health Care"),
    ("ABBV", "AbbVie", "Health Care"), ("PFE", "Pfizer", "Health Care"),
    ("TMO", "Thermo Fisher", "Health Care"), ("ABT", "Abbott", "Health Care"),
    ("DHR", "Danaher", "Health Care"), ("AMGN", "Amgen", "Health Care"),
    ("XOM", "Exxon Mobil", "Energy"), ("CVX", "Chevron", "Energy"),
    ("COP", "ConocoPhillips", "Energy"), ("SLB", "Schlumberger", "Energy"),
    ("CAT", "Caterpillar", "Industrials"), ("DE", "Deere", "Industrials"),
    ("HON", "Honeywell", "Industrials"), ("UPS", "UPS", "Industrials"),
    ("BA", "Boeing", "Industrials"), ("GE", "GE Aerospace", "Industrials"),
    ("LMT", "Lockheed Martin", "Industrials"), ("UNP", "Union Pacific", "Industrials"),
    ("LIN", "Linde", "Materials"), ("SHW", "Sherwin-Williams", "Materials"),
    ("APD", "Air Products", "Materials"),
]

# XBRL tag fallbacks - issuers are wildly inconsistent about which us-gaap
# concept they file revenue (and everything else) under.
TAGS = {
    "rev": ["RevenueFromContractWithCustomerExcludingAssessedTax", "Revenues",
            "RevenueFromContractWithCustomerIncludingAssessedTax", "SalesRevenueNet"],
    "ni": ["NetIncomeLoss"],
    "gp": ["GrossProfit"],
    "oi": ["OperatingIncomeLoss"],
    "assets": ["Assets"],
    "eq": ["StockholdersEquity",
           "StockholdersEquityIncludingPortionAttributableToNoncontrollingInterest"],
    "da": ["DepreciationDepletionAndAmortization", "DepreciationAmortizationAndAccretionNet",
           "DepreciationAndAmortization",
           "DepreciationDepletionAndAmortizationExcludingNonproductionAssets"],
    "pretax": ["IncomeLossFromContinuingOperationsBeforeIncomeTaxesExtraordinaryItemsNoncontrollingInterest",
               "IncomeLossFromContinuingOperationsBeforeIncomeTaxesMinorityInterestAndIncomeLossFromEquityMethodInvestments"],
    "tax": ["IncomeTaxExpenseBenefit"],
    "ltd_nc": ["LongTermDebtNoncurrent", "LongTermDebt"],
    "ltd_c": ["LongTermDebtCurrent"],
    "std": ["ShortTermBorrowings", "DebtCurrent", "CommercialPaper"],
    "cash": ["CashAndCashEquivalentsAtCarryingValue",
             "CashCashEquivalentsRestrictedCashAndRestrictedCashEquivalents"],
    "sti": ["ShortTermInvestments", "MarketableSecuritiesCurrent",
            "AvailableForSaleSecuritiesCurrent"],
    "ocf": ["NetCashProvidedByUsedInOperatingActivities",
            "NetCashProvidedByUsedInOperatingActivitiesContinuingOperations"],
    "capex": ["PaymentsToAcquirePropertyPlantAndEquipment", "PaymentsToAcquireProductiveAssets"],
    "shares": ["WeightedAverageNumberOfDilutedSharesOutstanding",
               "WeightedAverageNumberOfSharesOutstandingBasic"],
}
FLOWS = {"rev", "ni", "gp", "oi", "da", "pretax", "tax", "ocf", "capex", "shares"}
GROUPS = ["margin", "turnover", "leverage"]


# data pulls
def get_json(url, headers, tries=4):
    for attempt in range(tries):
        try:
            resp = requests.get(url, headers=headers, timeout=30)
            if resp.ok:
                return resp.json()
        except requests.RequestException:
            pass
        time.sleep(0.5 * (attempt + 1))
    return None


def yahoo_monthly(sym):
    """Monthly adjusted close as {Period('M'): price}."""
    p1 = int(pd.Timestamp("2008-01-01").timestamp())
    p2 = int(time.time())
    url = (f"https://query1.finance.yahoo.com/v8/finance/chart/{sym}"
           f"?period1={p1}&period2={p2}&interval=1mo&events=div,split")
    j = get_json(url, {**WEB_UA, "Accept": "application/json"})
    out = {}
    try:
        res = j["chart"]["result"][0]
        ts = res.get("timestamp", [])
        ind = res["indicators"]
        px = (ind.get("adjclose", [{}])[0].get("adjclose")
              or ind["quote"][0].get("close") or [])
        for t, v in zip(ts, px):
            if v is not None:
                out[pd.Period(pd.Timestamp(t, unit="s"), freq="M")] = float(v)
    except (KeyError, IndexError, TypeError):
        pass
    return out


def fred_dgs10_monthly():
    url = "https://fred.stlouisfed.org/graph/fredgraph.csv?id=DGS10&cosd=2008-01-01"
    for attempt in range(5):
        try:
            resp = requests.get(url, headers=WEB_UA, timeout=30)
            if resp.ok and resp.text.startswith("observation_date"):
                df = pd.read_csv(pd.io.common.StringIO(resp.text), na_values=".").dropna()
                df.columns = ["date", "val"]
                s = pd.Series(df["val"].values,
                              index=pd.PeriodIndex(pd.to_datetime(df["date"]), freq="M"))
                return s.groupby(level=0).last().to_dict()
        except requests.RequestException:
            pass
        time.sleep(0.7 * (attempt + 1))
    # FRED rate-limits the dailies; ^TNX is the same yield (sometimes quoted x10)
    tnx = yahoo_monthly("^TNX")
    if tnx:
        med = np.median(list(tnx.values()))
        scale = 10 if med > 20 else 1
        print(f"DGS10 <- Yahoo ^TNX (scale /{scale})")
        return {k: v / scale for k, v in tnx.items()}
    return {}


def annual(facts, key, flow):
    """Latest-filed 10-K value per fiscal-year end for a tag-fallback list.
    Flows must span ~a year (rejects the quarterly durations that sneak into
    companyfacts)."""
    by_end = {}
    for tag in TAGS[key]:
        units = facts.get("us-gaap", {}).get(tag, {}).get("units", {})
        node = units.get("USD") or units.get("shares") or \
            (next(iter(units.values())) if units else None)
        if not node:
            continue
        for e in node:
            if "10-K" not in (e.get("form") or ""):
                continue
            if flow:
                if not (e.get("start") and e.get("end")):
                    continue
                dur = (pd.Timestamp(e["end"]) - pd.Timestamp(e["start"])).days
                if not 340 < dur < 380:
                    continue
            prev = by_end.get(e["end"])
            if prev is None or (e.get("filed") or "") > (prev.get("filed") or ""):
                by_end[e["end"]] = e
    return sorted(by_end.values(), key=lambda e: e["end"], reverse=True)


def value_at(entries, end):
    for e in entries:
        if e["end"] == end:
            return e["val"]
    older = [e for e in entries if e["end"] <= end]
    return older[0]["val"] if older else None


def shares_outstanding(facts):
    node = facts.get("dei", {}).get("EntityCommonStockSharesOutstanding", {}) \
        .get("units", {}).get("shares")
    if not node:
        return None
    tenk = [e for e in node if "10-K" in (e.get("form") or "")] or node
    return sorted(tenk, key=lambda e: e["end"], reverse=True)[0]["val"]


# helpers
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


def nanmean(xs):
    xs = [x for x in xs if x is not None and np.isfinite(x)]
    return float(np.mean(xs)) if xs else None


def zmap(rows, key, default=None):
    vals = [(row[key] if row.get(key) is not None else default) for row in rows]
    vals = [v for v in vals if v is not None]
    m, sd = np.mean(vals), np.std(vals)
    return {row["ticker"]: ((row[key] if row.get(key) is not None else default) - m) / sd
            if sd else 0.0 for row in rows}


def meaningful_roe(mult, roe):
    return (mult is not None and 0 < mult <= MULT_CAP
            and roe is not None and np.isfinite(roe) and abs(roe) < 400)


def classify_cross_section(rows):
    """rows: [{key, margin, turn, mult}] all positive. Log decomposition vs
    the cross-section median; the road is the largest deviation, shares are
    deviations normalized by total absolute deviation."""
    lm = np.log([row["margin"] for row in rows])
    lt = np.log([row["turn"] for row in rows])
    ll = np.log([row["mult"] for row in rows])
    m0, t0, l0 = np.median(lm), np.median(lt), np.median(ll)
    out = {}
    for i, row in enumerate(rows):
        dm, dt, dl = lm[i] - m0, lt[i] - t0, ll[i] - l0
        driver = ("margin" if dm >= dt and dm >= dl
                  else "turnover" if dt >= dl else "leverage")
        denom = abs(dm) + abs(dt) + abs(dl) or 1.0
        out[row["key"]] = {"driver": driver, "shareMargin": dm / denom,
                           "shareTurn": dt / denom, "shareLev": dl / denom}
    return out


def main():
    OUT.mkdir(parents=True, exist_ok=True)

    tk = get_json("https://www.sec.gov/files/company_tickers.json", EDGAR_UA)
    cik = {v["ticker"]: str(v["cik_str"]).zfill(10) for v in tk.values()}
    dgs10 = fred_dgs10_monthly()
    spy = yahoo_monthly("SPY")
    print(f"DGS10 n={len(dgs10)}  SPY n={len(spy)}")

    # build the firm panel
    firms = []
    for ticker, name, sector in UNIVERSE:
        facts = get_json(f"https://data.sec.gov/api/xbrl/companyfacts/CIK{cik[ticker]}.json",
                         EDGAR_UA)
        facts = facts.get("facts") if facts else None
        if not facts:
            print(f"{ticker} skip (no facts)")
            continue
        ser = {k: annual(facts, k, k in FLOWS) for k in TAGS}
        if len(ser["ni"]) < 3:
            print(f"{ticker} skip (short history)")
            continue

        fy = []
        ni_entries = ser["ni"]
        for i, e in enumerate(ni_entries):
            end, year = e["end"], int(e["end"][:4])
            if year < 2009:
                continue
            prev_end = ni_entries[i + 1]["end"] if i + 1 < len(ni_entries) else None
            at = lambda k, d=end: value_at(ser[k], d)
            ni, rev, assets, eq = e["val"], at("rev"), at("assets"), at("eq")
            if rev is None or assets is None or eq is None or rev <= 0:
                continue
            assets_prev = value_at(ser["assets"], prev_end) if prev_end else None
            eq_prev = value_at(ser["eq"], prev_end) if prev_end else None
            avg_assets = (assets + assets_prev) / 2 if assets_prev is not None else assets
            avg_eq = (eq + eq_prev) / 2 if eq_prev is not None else eq

            oi, gp, da = at("oi"), at("gp"), at("da")
            pretax, tax = at("pretax"), at("tax")
            total_debt = (at("ltd_nc") or 0) + (at("ltd_c") or 0) + (at("std") or 0)
            cash = (at("cash") or 0) + (at("sti") or 0)
            net_debt = total_debt - cash
            ebitda = oi + da if oi is not None and da is not None else None
            ocf, capex = at("ocf"), at("capex")
            fcf = ocf - capex if ocf is not None and capex is not None else None
            eff_tax = (min(0.45, max(0.0, tax / pretax))
                       if pretax and tax is not None and pretax > 0 else 0.21)
            # plenty of pharma never tags OperatingIncomeLoss; pre-tax income
            # is a serviceable stand-in for low-leverage names
            ebit_for_roic = oi if oi is not None else pretax
            nopat = ebit_for_roic * (1 - eff_tax) if ebit_for_roic is not None else None
            inv_cap = total_debt + eq - (at("cash") or 0)
            if prev_end:
                inv_prev = ((value_at(ser["ltd_nc"], prev_end) or 0)
                            + (value_at(ser["ltd_c"], prev_end) or 0)
                            + (value_at(ser["std"], prev_end) or 0)
                            + (eq_prev or 0) - (value_at(ser["cash"], prev_end) or 0))
                avg_inv = ((inv_cap + inv_prev) / 2
                           if inv_cap > 0 and inv_prev > 0 else inv_cap)
            else:
                avg_inv = inv_cap

            mult = avg_assets / avg_eq if avg_eq > 0 else None
            roe = ni / avg_eq * 100 if avg_eq > 0 else None
            fy.append({
                "year": year, "end": end,
                "revenue": rev, "ni": ni, "oi": oi, "gp": gp, "eq": eq,
                "totalDebt": total_debt, "cash": cash, "netDebt": net_debt,
                "ebitda": ebitda, "fcf": fcf, "shares": at("shares"),
                "netMargin": ni / rev * 100,
                "opMargin": oi / rev * 100 if oi is not None else None,
                "grossMargin": gp / rev * 100 if gp is not None else None,
                "assetTurn": rev / avg_assets,
                "equityMult": mult, "roe": roe,
                "roeOK": meaningful_roe(mult, roe),
                "roic": nopat / avg_inv * 100 if nopat is not None and avg_inv > 0 else None,
                "grossProf": gp / avg_assets * 100 if gp is not None else None,
                "opProf": oi / avg_assets * 100 if oi is not None else None,
                "netDebtEbitda": net_debt / ebitda if ebitda and ebitda > 0 else None,
                "netDebtEq": net_debt / eq if eq > 0 else None,
                "negEquity": eq <= 0,
            })
        if len(fy) < 3:
            print(f"{ticker} skip (few usable FYs)")
            continue
        fy.sort(key=lambda x: x["year"])
        for i in range(len(fy)):
            window = [x["netMargin"] for x in fy[max(0, i - 4):i + 1]]
            fy[i]["marginVol"] = float(np.std(window, ddof=1)) if len(window) >= 3 else None
        firms.append({"ticker": ticker, "name": name, "sector": sector,
                      "fy": fy, "prices": yahoo_monthly(ticker),
                      "sharesNow": shares_outstanding(facts)})
        print(ticker, end=" ", flush=True)
        time.sleep(0.25)
    print(f"\nloaded {len(firms)} firms")

    # snapshot on trailing-3y ratios
    def trailing3(fm):
        last3 = fm["fy"][-3:]
        avg = lambda k: nanmean([x[k] for x in last3])
        med = lambda k: nanmedian([x[k] for x in last3])  # robust to one near-zero-equity year
        return {
            "netMargin": avg("netMargin"), "opMargin": avg("opMargin"),
            "grossMargin": avg("grossMargin"), "assetTurn": avg("assetTurn"),
            "equityMult": med("equityMult"), "roe": med("roe"),
            "roic": avg("roic"), "grossProf": avg("grossProf"), "opProf": avg("opProf"),
            "netDebtEbitda": avg("netDebtEbitda"), "netDebtEq": avg("netDebtEq"),
            "marginVol": fm["fy"][-1]["marginVol"],
        }

    snap = []
    for fm in firms:
        latest, t3 = fm["fy"][-1], trailing3(fm)
        roe_ok = meaningful_roe(t3["equityMult"], t3["roe"]) and not latest["negEquity"]
        snap.append({"ticker": fm["ticker"], "name": fm["name"], "sector": fm["sector"],
                     "fye": latest["end"], "revenue": latest["revenue"] / 1e9, **t3,
                     "roeOK": roe_ok, "distorted": not roe_ok,
                     "negEquity": latest["negEquity"],
                     "equityMultRaw": t3["equityMult"],
                     "roe": t3["roe"] if roe_ok else None,
                     "equityMult": t3["equityMult"] if roe_ok else None})

    cls_rows = [{"key": s["ticker"], "margin": s["netMargin"],
                 "turn": s["assetTurn"], "mult": s["equityMult"]}
                for s in snap if s["roeOK"] and s["netMargin"] > 0
                and (s["equityMult"] or 0) > 0 and s["assetTurn"] > 0]
    cls = classify_cross_section(cls_rows)
    for s in snap:
        c = cls.get(s["ticker"])
        s["driver"] = c["driver"] if c else "n/m"
        for js, py in (("shareMargin", "shareMargin"), ("shareTurn", "shareTurn"),
                       ("shareLev", "shareLev")):
            s[js] = round(c[py] * 100) if c else None

    # quality score over firms with both ROE and ROIC
    q_rows = [s for s in snap if s["roe"] is not None and s["roic"] is not None]
    z_roe, z_mgn = zmap(q_rows, "roe"), zmap(q_rows, "netMargin")
    z_roic, z_mult = zmap(q_rows, "roic"), zmap(q_rows, "equityMult")
    z_nde = zmap(q_rows, "netDebtEbitda", default=0.0)
    z_mv = zmap(q_rows, "marginVol", default=0.0)
    for s in q_rows:
        t = s["ticker"]
        s["quality"] = round(z_roe[t] + z_mgn[t] + z_roic[t]
                             - z_mult[t] - z_nde[t] - z_mv[t], 2)

    # sector-neutral z (within GICS sector)
    for sector in {s["sector"] for s in snap}:
        sub = [s for s in snap if s["sector"] == sector]
        zm = zmap(sub, "netMargin")
        zt = zmap(sub, "assetTurn")
        zl = zmap(sub, "equityMult", default=0.0)
        for s in sub:
            s["zMarginSec"], s["zTurnSec"], s["zMultSec"] = \
                r(zm[s["ticker"]]), r(zt[s["ticker"]]), r(zl[s["ticker"]])

    snap_out = sorted([{
        "ticker": s["ticker"], "name": s["name"], "sector": s["sector"], "fye": s["fye"],
        "revenue": r(s["revenue"], 1), "netMargin": r(s["netMargin"], 1),
        "opMargin": r(s["opMargin"], 1), "grossMargin": r(s["grossMargin"], 1),
        "assetTurn": r(s["assetTurn"]), "equityMult": r(s["equityMult"]),
        "roe": r(s["roe"], 1), "roic": r(s["roic"], 1),
        "grossProf": r(s["grossProf"], 1), "opProf": r(s["opProf"], 1),
        "netDebtEbitda": r(s["netDebtEbitda"]), "netDebtEq": r(s["netDebtEq"]),
        "marginVol": r(s["marginVol"], 1), "driver": s["driver"],
        "shareMargin": s["shareMargin"], "shareTurn": s["shareTurn"], "shareLev": s["shareLev"],
        "quality": s.get("quality"), "zMarginSec": s["zMarginSec"],
        "zTurnSec": s["zTurnSec"], "zMultSec": s["zMultSec"],
        "negEquity": s["negEquity"], "distorted": s["distorted"],
        "equityMultRaw": r(s["equityMultRaw"], 1),
    } for s in snap], key=lambda x: -(x["roe"] if x["roe"] is not None else -999))
    (OUT / "companies.json").write_text(json.dumps(snap_out))

    # valuation overlay
    valuation = []
    for fm in firms:
        latest, t3 = fm["fy"][-1], trailing3(fm)
        px = fm["prices"]
        if not px or not fm["sharesNow"]:
            continue
        price = px[max(px)]
        mcap = price * fm["sharesNow"]
        ev = mcap + latest["totalDebt"] - latest["cash"]
        valuation.append({
            "ticker": fm["ticker"], "sector": fm["sector"],
            "driver": cls.get(fm["ticker"], {}).get("driver", "n/m"),
            "pe": r(mcap / latest["ni"], 1) if latest["ni"] > 0 else None,
            "evEbitda": r(ev / latest["ebitda"], 1)
                if latest["ebitda"] and latest["ebitda"] > 0 else None,
            "fcfYield": r(latest["fcf"] / mcap * 100, 1)
                if latest["fcf"] is not None and mcap > 0 else None,
            "roic": r(t3["roic"], 1),
            "quality": next((s.get("quality") for s in snap if s["ticker"] == fm["ticker"]), None),
        })
    (OUT / "valuation.json").write_text(json.dumps(valuation))

    # forward tests by driver group
    panel = []
    for year in PANEL_YEARS:
        cross = []
        for fm in firms:
            row = next((x for x in fm["fy"] if x["year"] == year), None)
            if row and row["roeOK"] and row["netMargin"] > 0:
                cross.append((fm, row))
        if len(cross) < 8:
            continue
        year_cls = classify_cross_section(
            [{"key": fm["ticker"], "margin": row["netMargin"],
              "turn": row["assetTurn"], "mult": row["equityMult"]} for fm, row in cross])
        for fm, row in cross:
            nxt = next((x for x in fm["fy"] if x["year"] == year + 1), None)
            nxt = nxt if nxt and nxt["roeOK"] else None
            start = pd.Period(row["end"][:7], "M") + 4   # ~ filing month, no look-ahead
            px = fm["prices"]
            path = [px[start + k] for k in range(13) if (start + k) in px]
            fwd_ret = (px[start + 12] / px[start] - 1) * 100 \
                if start in px and (start + 12) in px else None
            fwd_vol = fwd_mdd = None
            if len(path) >= 8:
                rts = np.diff(path) / path[:-1]
                fwd_vol = float(np.std(rts) * np.sqrt(12) * 100)
                peak = np.maximum.accumulate(path)
                fwd_mdd = float((np.array(path) / peak - 1).min() * 100)
            prior = (px[start] / px[start - 12] - 1) * 100 \
                if start in px and (start - 12) in px else None
            future_m = [x["netMargin"] for k in (1, 2, 3)
                        for x in fm["fy"] if x["year"] == year + k]
            fwd_mvol = (float(np.std([row["netMargin"]] + future_m, ddof=1))
                        if len(future_m) >= 2 else None)
            panel.append({
                "ticker": fm["ticker"], "sector": fm["sector"], "year": year,
                "driver": year_cls[fm["ticker"]]["driver"],
                "roe": row["roe"], "roeNext": nxt["roe"] if nxt else None,
                "roeRetain": nxt["roe"] / row["roe"] if nxt and row["roe"] > 0 else None,
                "fwdRet": fwd_ret, "fwdVol": fwd_vol, "fwdMdd": fwd_mdd,
                "fwdMarginVol": fwd_mvol, "priorRet": prior,
            })

    fwd_groups = []
    for g in GROUPS:
        rows = [p for p in panel if p["driver"] == g]
        retain = nanmedian([p["roeRetain"] for p in rows])
        fwd_groups.append({
            "driver": g, "n": len(rows),
            "roeRetain": r(retain * 100, 0) if retain is not None else None,
            "roeNextChg": r(nanmedian([p["roeNext"] - p["roe"] for p in rows
                                       if p["roeNext"] is not None]), 1),
            "fwdRet": r(nanmedian([p["fwdRet"] for p in rows]), 1),
            "fwdVol": r(nanmedian([p["fwdVol"] for p in rows]), 1),
            "fwdMdd": r(nanmedian([p["fwdMdd"] for p in rows]), 1),
            "fwdMarginVol": r(nanmedian([p["fwdMarginVol"] for p in rows]), 1),
        })

    # persistence: fwd ROE on road dummies (leverage omitted) + level + sector FE
    pers = [p for p in panel if p["roeNext"] is not None and p["roe"] is not None]
    pdf = pd.DataFrame(pers)
    X = pd.DataFrame({
        "margin_d": (pdf["driver"] == "margin").astype(float),
        "turnover_d": (pdf["driver"] == "turnover").astype(float),
        "roe": pdf["roe"],
    })
    X = pd.concat([X, pd.get_dummies(pdf["sector"], drop_first=True, dtype=float)], axis=1)
    fit = sm.OLS(pdf["roeNext"], sm.add_constant(X)).fit()
    persistence = {
        "marginVsLev": {"est": r(fit.params["margin_d"]), "t": r(fit.tvalues["margin_d"], 1)},
        "turnoverVsLev": {"est": r(fit.params["turnover_d"]), "t": r(fit.tvalues["turnover_d"], 1)},
        "roeLoad": {"est": r(fit.params["roe"]), "t": r(fit.tvalues["roe"], 1)},
        "n": int(fit.nobs), "r2": r(fit.rsquared),
    }
    (OUT / "forward.json").write_text(json.dumps(
        {"groups": fwd_groups, "persistence": persistence,
         "nPanel": len(panel), "years": [min(PANEL_YEARS), max(PANEL_YEARS)]}))

    # rate test: multiplier HML vs true-leverage HML
    all_m = sorted(p for p in spy if pd.Period("2010-07", "M") <= p <= pd.Period("2026-05", "M"))
    mkt_ret = {p: (spy[p] / spy[q] - 1) * 100 for q, p in zip(all_m, all_m[1:])
               if q in spy and p in spy}
    d_y = {p: dgs10[p] - dgs10[q] for q, p in zip(all_m, all_m[1:])
           if q in dgs10 and p in dgs10}

    def as_of_fy(fm, p):
        cutoff = p - 4    # need the 10-K to actually be out
        best = None
        for row in fm["fy"]:
            if pd.Period(row["end"][:7], "M") <= cutoff:
                best = row
        return best

    def hml(sel_key):
        out = {}
        for q, p in zip(all_m, all_m[1:]):
            cross = []
            for fm in firms:
                row = as_of_fy(fm, p)
                if not row or row.get(sel_key) is None:
                    continue
                px = fm["prices"]
                if q not in px or p not in px:
                    continue
                cross.append({"sector": fm["sector"], "v": row[sel_key],
                              "ret": (px[p] / px[q] - 1) * 100})
            if len(cross) < 12:
                continue
            sec_mean = pd.DataFrame(cross).groupby("sector")["v"].mean().to_dict()
            for c in cross:
                c["adj"] = c["v"] - sec_mean[c["sector"]]
            cross.sort(key=lambda c: c["adj"])
            k = max(3, len(cross) // 3)
            out[p] = (np.mean([c["ret"] for c in cross[-k:]])
                      - np.mean([c["ret"] for c in cross[:k]]))
        return out

    def rate_reg(series):
        rows = [(series[p], mkt_ret[p], d_y[p]) for p in all_m
                if p in series and p in mkt_ret and p in d_y]
        if len(rows) < 24:
            return None
        df = pd.DataFrame(rows, columns=["hml", "mkt", "dy"])
        f = sm.OLS(df["hml"], sm.add_constant(df[["mkt", "dy"]])) \
            .fit(cov_type="HAC", cov_kwds={"maxlags": HAC_L})
        return {"alpha": r(f.params["const"]), "mkt": r(f.params["mkt"]),
                "tMkt": r(f.tvalues["mkt"], 1), "rate": r(f.params["dy"]),
                "tRate": r(f.tvalues["dy"], 1), "n": int(f.nobs)}

    def xcorr(a_key, b_key):
        pairs = [(s[a_key], s[b_key]) for s in snap_out
                 if s.get(a_key) is not None and s.get(b_key) is not None]
        if len(pairs) < 5:
            return None
        a, b = zip(*pairs)
        return {"r": r(np.corrcoef(a, b)[0, 1]), "n": len(pairs)}

    top_roe = [s for s in snap_out if s["roe"] is not None][:15]
    rates = {
        "equityMult": rate_reg(hml("equityMult")),
        "trueLev": rate_reg(hml("netDebtEq")),
        "corrMultNde": xcorr("equityMultRaw", "netDebtEbitda"),
        "corrMultNdeq": xcorr("equityMultRaw", "netDebtEq"),
        "netCashTop": sum(1 for s in top_roe
                          if s["netDebtEbitda"] is not None and s["netDebtEbitda"] < 0.5),
        "nTop": len(top_roe),
        "note": ("rate beta = % HML return per +100bp d10y; HAC t (Newey-West, 6 lags). "
                 "corr = cross-sectional correlation across the universe."),
    }
    (OUT / "rates.json").write_text(json.dumps(rates))

    # return attribution since 2015
    # dlog(P) = dlog(margin) + dlog(rev) - dlog(shares) + dlog(P/E)
    attrib = []
    for fm in firms:
        a = next((x for x in fm["fy"] if x["year"] == 2015), fm["fy"][0])
        b = fm["fy"][-1]
        if (a["year"] >= b["year"] or a["netMargin"] <= 0 or b["netMargin"] <= 0
                or not a["shares"] or not b["shares"]):
            continue
        px = fm["prices"]
        pa = px.get(pd.Period(f"{a['year'] + 1}-04", "M"))
        pb = px.get(pd.Period(f"{b['year'] + 1}-04", "M")) or px[max(px)]
        if not pa or not pb:
            continue
        eps_a, eps_b = a["ni"] / a["shares"], b["ni"] / b["shares"]
        if eps_a <= 0 or eps_b <= 0:
            continue
        pe_a, pe_b = pa / eps_a, pb / eps_b
        if pe_a <= 0 or pe_b <= 0:
            continue
        attrib.append({"dPrice": np.log(pb / pa),
                       "dMargin": np.log(b["netMargin"] / a["netMargin"]),
                       "dRev": np.log(b["revenue"] / a["revenue"]),
                       "dShares": -np.log(b["shares"] / a["shares"]),
                       "dPE": np.log(pe_b / pe_a)})
    med = lambda k: r(nanmedian([x[k] for x in attrib]) * 100, 0)
    attribution = {"nFirms": len(attrib), "fromYear": 2015,
                   "median": {"price": med("dPrice"), "margin": med("dMargin"),
                              "revenue": med("dRev"), "buyback": med("dShares"),
                              "multiple": med("dPE")}}
    (OUT / "attribution.json").write_text(json.dumps(attribution))

    # sector aggregates + basket margin trend
    sec_agg = {}
    for s in snap_out:
        a = sec_agg.setdefault(s["sector"], {"ni": 0.0, "rev": 0.0, "roes": [], "n": 0})
        a["ni"] += s["netMargin"] / 100 * s["revenue"]
        a["rev"] += s["revenue"]
        if s["roe"] is not None:
            a["roes"].append(s["roe"])
        a["n"] += 1
    sectors = sorted([{"sector": k, "netMargin": r(v["ni"] / v["rev"] * 100, 1),
                       "medianRoe": r(nanmedian(v["roes"]), 1), "n": v["n"]}
                      for k, v in sec_agg.items()], key=lambda x: -x["netMargin"])
    (OUT / "sectors.json").write_text(json.dumps(sectors))

    trend_agg = {}
    for fm in firms:
        for row in fm["fy"]:
            if 2015 <= row["year"] <= 2025:
                t = trend_agg.setdefault(row["year"], {"ni": 0, "rev": 0, "oi": 0, "oiRev": 0})
                t["ni"] += row["ni"]
                t["rev"] += row["revenue"]
                if row["oi"] is not None:
                    t["oi"] += row["oi"]
                    t["oiRev"] += row["revenue"]
    trend = [{"year": str(y), "netMargin": r(v["ni"] / v["rev"] * 100, 1),
              "opMargin": r(v["oi"] / v["oiRev"] * 100, 1) if v["oiRev"] else None}
             for y, v in sorted(trend_agg.items())]
    (OUT / "margin_trend.json").write_text(json.dumps(trend))

    neg_eq = [s["ticker"] for s in snap_out if s["negEquity"]]
    summary = {
        "asOf": "2026-04-15", "nFirms": len(firms), "nPanel": len(panel),
        "years": [min(PANEL_YEARS), max(PANEL_YEARS)],
        "topQuality": sorted([s for s in snap_out if s["quality"] is not None],
                             key=lambda s: -s["quality"])[:5],
        "forwardGroups": fwd_groups, "persistence": persistence, "rates": rates,
        "attribution": attribution, "negEquity": neg_eq,
        "trendEnds": {"first": trend[0], "last": trend[-1]},
    }
    (OUT / "summary.json").write_text(json.dumps(summary, indent=2))

    print("\nforward tests by driver:")
    for g in fwd_groups:
        print(f"  {g['driver']:<9} n={g['n']:>4}  retain {g['roeRetain']}%  "
              f"fwd12m {g['fwdRet']}%  marginVol {g['fwdMarginVol']}")
    print(f"persistence vs leverage: margin {persistence['marginVsLev']['est']}pp "
          f"(t {persistence['marginVsLev']['t']})")
    print(f"rate test - mult HML t={rates['equityMult']['tRate'] if rates['equityMult'] else None}, "
          f"true-lev HML t={rates['trueLev']['tRate'] if rates['trueLev'] else None}")
    print(f"corr(mult, netDebt/eq) = {rates['corrMultNdeq']}")
    print(f"\nwrote JSON to {OUT}")


if __name__ == "__main__":
    main()
