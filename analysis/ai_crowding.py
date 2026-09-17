#!/usr/bin/env python3
"""
Factor or crowd? Measuring AI exposure and crowding in US equities, 2016-2026.

Research code behind the AI-crowding article. The question, stated so it can
fail: is "AI" a distinct, priced source of common return variation - a
factor - or a crowded position whose comovement, valuation and concentration
say more about who owns it than about what it earns? And since the AI basket
is too young to test the crowding -> crash link on its own history, what does
a century of survivorship-free industry run-ups say about episodes shaped
like this one?

The pipeline:

  1. universe: NYSE/Nasdaq 10-K filers ranked point-in-time by the dollar
     public float each 10-K reports on its cover page (dei:EntityPublicFloat,
     SEC XBRL frames); top 1,000 at each month-end
  2. AI exposure from text: download every 10-K primary document those firms
     filed 2015-2026 from EDGAR, strip HTML/inline-XBRL, and count a fixed
     AI dictionary per 10,000 words. The exposure a firm carries at month t
     comes from the latest 10-K filed ON OR BEFORE t - no look-ahead
  3. validation: does pre-ChatGPT disclosed exposure predict the Nov-2022 ->
     2023 repricing? (event study, FF5+UMD abnormal returns)
  4. the AI factor: value-weighted top-minus-bottom exposure portfolios,
     raw and within-industry; spanning regressions on FF5 + momentum
  5. crowding, four ways: excess residual comovement (Lou-Polk comomentum
     applied to the AI leg), valuation spread (P/S), concentration of the
     float-cap, and factor run-up/volatility; real-time (expanding) z's
  6. does crowding predict? HAC predictive regressions with an explicit
     power calculation, because ~115 months cannot say much
  7. borrowing power: the Greenwood-Shleifer-You (2019) run-up test on the
     Fama-French 49 industries since 1926 - survivorship-free - with crash
     probabilities conditional on run-up characteristics, then today's
     AI-linked industries located inside that distribution

Data: SEC EDGAR (submissions, full 10-K text, XBRL frames), Yahoo Finance
daily prices, Kenneth R. French Data Library (FF5 + momentum, 49 industry
portfolios, SIC definitions).
Output: JSON under content/research/2026-09-16-ai-crowding/data/

Run from the repo root:
    python analysis/ai_crowding.py            # fetch (cached) + analyze
    python analysis/ai_crowding.py --fetch    # downloads only

The first run downloads ~15,000 10-K documents at EDGAR's polite rate and
takes roughly an hour; everything is cached under analysis/.cache/ai_crowding
so re-runs take minutes. EDGAR asks for a contact in the User-Agent.
"""

import gzip
import html
import io
import json
import re
import sys
import threading
import time
import warnings
import zipfile
from concurrent.futures import ThreadPoolExecutor, as_completed
from pathlib import Path

import numpy as np
import pandas as pd
import requests

warnings.filterwarnings("ignore", message="Mean of empty slice")
warnings.filterwarnings("ignore", message="invalid value encountered")

EDGAR_UA = {"User-Agent": "quantamental-research anthonyhuang@aya.yale.edu",
            "Accept-Encoding": "gzip, deflate"}
WEB_UA = {"User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/124.0"}
CACHE = Path("analysis/.cache/ai_crowding")
OUT = Path("content/research/2026-09-16-ai-crowding/data")
FF_URL = "https://mba.tuck.dartmouth.edu/pages/faculty/ken.french/ftp/"

FILED0 = "2015-01-01"              # first 10-K filing date downloaded
FILED1 = "2026-08-31"
PX0, PX1 = "2014-01-01", "2026-08-31"
FLOAT_YEARS = range(2014, 2026)    # public-float measurement years
PREFILTER_N = 1300                 # per-year float rank to enter the download set
UNIVERSE_N = 1000                  # point-in-time universe size
FLOAT_MAX = 6e12                   # XBRL scale errors (Host Hotels: $13 quadrillion)
FLOAT_MIN = 5e7

# ------------------------------------------------------------ AI dictionary
# Case-insensitive phrases, plus the bare token "AI"/"GenAI"/"LLM" matched
# case-sensitively so "ai" inside words and lower-case noise cannot fire.
AI_TERMS = {
    "artificial_intelligence": re.compile(r"artificial[\s\-]+intelligence", re.I),
    "machine_learning": re.compile(r"machine[\s\-]+learning", re.I),
    "deep_learning": re.compile(r"deep[\s\-]+learning", re.I),
    "neural_network": re.compile(r"neural[\s\-]+net(?:work)?s?\b", re.I),
    "generative_ai": re.compile(r"generative[\s\-]+(?:ai\b|artificial)", re.I),
    "llm": re.compile(r"large[\s\-]+language[\s\-]+models?|(?<![A-Za-z0-9])LLMs?(?![A-Za-z0-9])"),
    "nlp": re.compile(r"natural[\s\-]+language[\s\-]+processing", re.I),
    "computer_vision": re.compile(r"computer[\s\-]+vision", re.I),
    "ai_token": re.compile(r"(?<![A-Za-z0-9.])(?:Gen)?AI(?![A-Za-z0-9])"),
}
# supply-chain vocabulary, counted separately (NOT part of the exposure score)
INFRA_TERMS = {
    "gpu": re.compile(r"(?<![A-Za-z0-9])GPUs?(?![A-Za-z0-9])|graphics[\s\-]+processing[\s\-]+units?", re.I),
    "accelerated_computing": re.compile(r"accelerated[\s\-]+computing", re.I),
    "data_center": re.compile(r"data[\s\-]+cent(?:er|re)s?", re.I),
    "hyperscale": re.compile(r"hyperscal(?:e|er|ers)\b", re.I),
}

_TAG = re.compile(r"(?s)<[^>]+>")
_HDR = re.compile(r"(?is)<ix:header>.*?</ix:header>")
_SCR = re.compile(r"(?is)<(script|style)[^>]*>.*?</\1>")
_WS = re.compile(r"\s+")


def doc_text(raw: str) -> str:
    t = _HDR.sub(" ", raw)          # inline-XBRL hidden facts are not prose
    t = _SCR.sub(" ", t)
    t = _TAG.sub(" ", t)
    t = html.unescape(t)
    return _WS.sub(" ", t)


def count_terms(text: str) -> dict:
    row = {"words": len(text.split())}
    for k, rx in AI_TERMS.items():
        row[k] = len(rx.findall(text))
    for k, rx in INFRA_TERMS.items():
        row[k] = len(rx.findall(text))
    return row


# ---------------------------------------------------------------- HTTP layer
class Throttle:
    """Global rate limiter: EDGAR's fair-access ceiling is 10 req/s."""

    def __init__(self, per_sec: float):
        self.gap = 1.0 / per_sec
        self.lock = threading.Lock()
        self.next = 0.0

    def wait(self):
        with self.lock:
            now = time.monotonic()
            if now < self.next:
                time.sleep(self.next - now)
            self.next = max(now, self.next) + self.gap


SEC_T = Throttle(7.5)
YH_T = Throttle(4.0)
_sess = threading.local()


def session():
    if not hasattr(_sess, "s"):
        _sess.s = requests.Session()
    return _sess.s


def sec_get(url: str, as_json=True, tries=5):
    for attempt in range(tries):
        SEC_T.wait()
        try:
            resp = session().get(url, headers=EDGAR_UA, timeout=90)
            if resp.status_code == 404:
                return None
            if resp.ok:
                return resp.json() if as_json else resp.text
            if resp.status_code in (403, 429, 503):
                time.sleep(10 * (attempt + 1))
        except (requests.RequestException, ValueError):
            time.sleep(2 * (attempt + 1))
    return None


def cached_json(name: str, url: str):
    p = CACHE / "json" / f"{name}.json.gz"
    if p.exists():
        return json.loads(gzip.decompress(p.read_bytes()))
    d = sec_get(url)
    if d is not None:
        p.parent.mkdir(parents=True, exist_ok=True)
        p.write_bytes(gzip.compress(json.dumps(d).encode()))
    return d


# ------------------------------------------------------------- SEC universe
def ticker_map() -> pd.DataFrame:
    d = cached_json("company_tickers_exchange", "https://www.sec.gov/files/company_tickers_exchange.json")
    df = pd.DataFrame(d["data"], columns=d["fields"])
    df = df[df["exchange"].isin(["NYSE", "Nasdaq"])]
    # preferred-stock lines (TRTN-PA) are not the equity; issuers whose only
    # listed security is a preferred drop out
    df = df[~df["ticker"].str.contains(r"-P[A-Z]?$")]
    # first listed ticker per CIK is the primary line (GOOGL before GOOG)
    return df.drop_duplicates("cik", keep="first").set_index("cik")


def public_floats() -> pd.DataFrame:
    rows = []
    for y in FLOAT_YEARS:
        for q in (1, 2, 3, 4):
            d = cached_json(f"float_CY{y}Q{q}I",
                            f"https://data.sec.gov/api/xbrl/frames/dei/EntityPublicFloat/USD/CY{y}Q{q}I.json")
            if not d:
                continue
            for o in d["data"]:
                rows.append((o["cik"], o["end"], float(o["val"]), o["accn"]))
    df = pd.DataFrame(rows, columns=["cik", "end", "float", "accn"])
    df = df[(df["float"] > FLOAT_MIN) & (df["float"] < FLOAT_MAX)]
    df["end"] = pd.to_datetime(df["end"])
    return df.drop_duplicates(["cik", "accn"])


def filing_index(cik: int):
    """All 10-K filings for a CIK (recent block + paginated history)."""
    d = cached_json(f"sub_{cik}", f"https://data.sec.gov/submissions/CIK{cik:010d}.json")
    if not d:
        return None
    blocks = [d["filings"]["recent"]]
    for f in d["filings"].get("files", []):
        if f.get("filingTo", "9999") >= FILED0:
            b = cached_json(f"sub_{cik}_{f['name'].replace('.json', '')}",
                            f"https://data.sec.gov/submissions/{f['name']}")
            if b:
                blocks.append(b)
    out = []
    for b in blocks:
        for i, form in enumerate(b["form"]):
            if form in ("10-K", "10-KT") and FILED0 <= b["filingDate"][i] <= FILED1 and b["primaryDocument"][i]:
                out.append({"cik": cik, "accn": b["accessionNumber"][i], "filed": b["filingDate"][i],
                            "report": b["reportDate"][i], "doc": b["primaryDocument"][i]})
    return {"cik": cik, "name": d.get("name"), "sic": d.get("sic"),
            "tickers": d.get("tickers"), "filings": out}


def tenk_counts(f: dict):
    acc = f["accn"].replace("-", "")
    url = f"https://www.sec.gov/Archives/edgar/data/{f['cik']}/{acc}/{f['doc']}"
    raw = sec_get(url, as_json=False)
    if raw is None:
        return None
    row = count_terms(doc_text(raw))
    return {**{k: f[k] for k in ("cik", "accn", "filed", "report")}, **row}


# ---------------------------------------------------------------- prices
def yahoo_daily(sym: str):
    p = CACHE / "px" / f"{sym}.csv.gz"
    if p.exists():
        return pd.read_csv(p, index_col=0, parse_dates=True)
    p1 = int(pd.Timestamp(PX0).timestamp())
    p2 = int(pd.Timestamp(PX1).timestamp()) + 86400
    url = (f"https://query1.finance.yahoo.com/v8/finance/chart/{sym}"
           f"?period1={p1}&period2={p2}&interval=1d&events=split")
    df = None
    for attempt in range(4):
        YH_T.wait()
        try:
            resp = session().get(url, headers={**WEB_UA, "Accept": "application/json"}, timeout=60)
            if resp.status_code == 404:
                break
            if resp.ok:
                res = resp.json()["chart"]["result"][0]
                ts = res.get("timestamp") or []
                ind = res["indicators"]
                adj = ind.get("adjclose", [{}])[0].get("adjclose") or [None] * len(ts)
                cls = ind["quote"][0].get("close") or [None] * len(ts)
                df = pd.DataFrame({"adj": adj, "close": cls},
                                  index=pd.to_datetime(ts, unit="s").normalize())
                df = df[~df.index.duplicated(keep="last")].dropna(how="all")
                # cumulative split factor AFTER each date: unadjusted = close * factor
                fac = pd.Series(1.0, index=df.index)
                for s in (res.get("events", {}) or {}).get("splits", {}).values():
                    d = pd.Timestamp(s["date"], unit="s").normalize()
                    fac[fac.index < d] *= s["numerator"] / s["denominator"]
                df["split"] = fac
                break
            time.sleep(1.5 * (attempt + 1))
        except (requests.RequestException, KeyError, IndexError, TypeError, ValueError):
            time.sleep(1.5 * (attempt + 1))
    if df is None:
        df = pd.DataFrame(columns=["adj", "close", "split"])
    p.parent.mkdir(parents=True, exist_ok=True)
    df.to_csv(p, compression="gzip")
    return df


def ff_zip(name: str) -> str:
    p = CACHE / "ff" / name
    if not p.exists():
        resp = requests.get(FF_URL + name, headers=WEB_UA, timeout=120)
        resp.raise_for_status()
        p.parent.mkdir(parents=True, exist_ok=True)
        p.write_bytes(resp.content)
    z = zipfile.ZipFile(io.BytesIO(p.read_bytes()))
    return z.read(z.namelist()[0]).decode("latin-1")


def xbrl_frames():
    """Shares outstanding (cover page, quarterly instants) and annual revenue."""
    sh, rv = [], []
    for y in range(2014, 2027):
        for q in (1, 2, 3, 4):
            d = cached_json(f"shares_CY{y}Q{q}I",
                            f"https://data.sec.gov/api/xbrl/frames/dei/EntityCommonStockSharesOutstanding/shares/CY{y}Q{q}I.json")
            for o in (d or {}).get("data", []):
                sh.append((o["cik"], o["end"], float(o["val"])))
    for y in range(2013, 2026):
        for tag in ("Revenues", "RevenueFromContractWithCustomerExcludingAssessedTax", "SalesRevenueNet"):
            d = cached_json(f"rev_{tag}_CY{y}",
                            f"https://data.sec.gov/api/xbrl/frames/us-gaap/{tag}/USD/CY{y}.json")
            for o in (d or {}).get("data", []):
                rv.append((o["cik"], o["end"], float(o["val"]), tag))
    shares = pd.DataFrame(sh, columns=["cik", "end", "shares"])
    rev = pd.DataFrame(rv, columns=["cik", "end", "rev", "tag"])
    return shares, rev


# ------------------------------------------------------------ fetch driver
def fetch():
    CACHE.mkdir(parents=True, exist_ok=True)
    tm = ticker_map()
    fl = public_floats()
    fl = fl[fl["cik"].isin(tm.index)]
    fl["yr"] = fl["end"].dt.year
    cand = set()
    for y, g in fl.groupby("yr"):
        cand |= set(g.sort_values("float", ascending=False).drop_duplicates("cik")["cik"].head(PREFILTER_N))
    cand = sorted(cand)
    print(f"tickers {len(tm)}; float obs {len(fl)}; download set {len(cand)} CIKs", flush=True)

    idx_path = CACHE / "filings.json.gz"
    if idx_path.exists():
        index = json.loads(gzip.decompress(idx_path.read_bytes()))
    else:
        index = []
        with ThreadPoolExecutor(6) as ex:
            futs = {ex.submit(filing_index, c): c for c in cand}
            for i, fu in enumerate(as_completed(futs)):
                r = fu.result()
                if r:
                    index.append(r)
                if i % 250 == 0:
                    print(f"  submissions {i}/{len(cand)}", flush=True)
        idx_path.write_bytes(gzip.compress(json.dumps(index).encode()))
    filings = [f for r in index for f in r["filings"]]
    print(f"10-K filings to process: {len(filings)}", flush=True)

    cnt_path = CACHE / "tenk_counts.csv"
    done = set(pd.read_csv(cnt_path)["accn"]) if cnt_path.exists() else set()
    todo = [f for f in filings if f["accn"] not in done]
    print(f"  cached {len(done)}, remaining {len(todo)}", flush=True)
    lock = threading.Lock()
    header = not cnt_path.exists()
    t0 = time.time()
    with ThreadPoolExecutor(8) as ex, open(cnt_path, "a", encoding="utf-8") as fh:
        futs = [ex.submit(tenk_counts, f) for f in todo]
        for i, fu in enumerate(as_completed(futs)):
            try:
                row = fu.result()
            except Exception as e:  # noqa: BLE001 - one bad document must not kill the run
                print("  doc error:", e, flush=True)
                continue
            if row is None:
                continue
            with lock:
                if header:
                    fh.write(",".join(row.keys()) + "\n")
                    header = False
                fh.write(",".join(str(v) for v in row.values()) + "\n")
                if i % 200 == 0:
                    fh.flush()
                    el = time.time() - t0
                    print(f"  10-K {i}/{len(todo)}  {el/60:.1f} min", flush=True)

    tick = {}
    for r in index:
        t = tm.loc[r["cik"], "ticker"] if r["cik"] in tm.index else None
        if t:
            tick[r["cik"]] = t
    syms = sorted(set(tick.values()))
    print(f"prices for {len(syms)} tickers", flush=True)
    with ThreadPoolExecutor(4) as ex:
        list(ex.map(yahoo_daily, syms))
    for f in ("F-F_Research_Data_5_Factors_2x3_daily_CSV.zip", "F-F_Momentum_Factor_daily_CSV.zip",
              "F-F_Research_Data_5_Factors_2x3_CSV.zip", "F-F_Momentum_Factor_CSV.zip",
              "49_Industry_Portfolios_CSV.zip", "49_Industry_Portfolios_daily_CSV.zip", "Siccodes49.zip"):
        ff_zip(f)
    xbrl_frames()
    for s in ("SPY", "QQQ", "SMH", "IGV", "BOTZ", "AIQ"):
        yahoo_daily(s)
    print("fetch complete", flush=True)


# =================================================================== analysis
AI_SCORE = ["artificial_intelligence", "machine_learning", "deep_learning", "neural_network",
            "llm", "nlp", "computer_vision", "ai_token"]   # generative_ai is inside ai_token
MIN_WORDS = 10_000       # below this the "10-K" is a wrapper incorporating the annual report by reference
M0, M1 = pd.Period("2015-12", "M"), pd.Period("2026-07", "M")   # French library ends 2026-07
CHATGPT = pd.Timestamp("2022-11-30")
HAC = 3


def r(x, n=2):
    if x is None:
        return None
    try:
        x = float(x)
    except (TypeError, ValueError):
        return None
    if not np.isfinite(x):
        return None
    v = round(x, n)
    return 0.0 if v == 0 else v


def ff_table(text: str, title: str | None = None, datelen: int = 6) -> pd.DataFrame:
    lines = text.splitlines()
    start = 0
    if title:
        start = next(i for i, l in enumerate(lines) if title in l)
    h = next(i for i in range(start, len(lines)) if lines[i].startswith(","))
    cols = [c.strip() for c in lines[h].split(",")[1:]]
    rows = []
    for l in lines[h + 1:]:
        parts = [p.strip() for p in l.split(",")]
        if not parts[0].isdigit() or len(parts[0]) != datelen:
            break
        rows.append(parts)
    df = pd.DataFrame([x[1:len(cols) + 1] for x in rows], index=[x[0] for x in rows], columns=cols)
    df = df.apply(pd.to_numeric, errors="coerce")
    df = df.mask((df <= -99.99) & (df >= -99.991)).mask(df <= -999)
    if datelen == 8:
        df.index = pd.to_datetime(df.index, format="%Y%m%d")
    elif datelen == 6:
        df.index = pd.PeriodIndex(pd.to_datetime(df.index, format="%Y%m"), freq="M")
    else:
        df.index = df.index.astype(int)
    return df


def sic_to_ff49() -> dict:
    text = ff_zip("Siccodes49.zip")
    out, cur = {}, None
    for l in text.splitlines():
        m = re.match(r"^\s*(\d+)\s+(\S+)\s+", l)
        if m and not re.match(r"^\s*\d{4}-\d{4}", l):
            cur = m.group(2)
            continue
        m = re.match(r"^\s*(\d{4})-(\d{4})", l)
        if m and cur:
            for s in range(int(m.group(1)), int(m.group(2)) + 1):
                out.setdefault(s, cur)
    return out


def hac_ols(y, X, lags):
    import statsmodels.api as sm
    m = np.isfinite(y) & np.all(np.isfinite(X), axis=1)
    if m.sum() < 24:
        return None
    return sm.OLS(y[m], sm.add_constant(X[m])).fit(cov_type="HAC", cov_kwds={"maxlags": lags})


def block_idx(rng, n, L=6):
    starts = rng.integers(0, n, size=n // L + 1)
    return np.concatenate([np.arange(s, s + L) % n for s in starts])[:n]


def max_dd(rets):
    w = np.cumprod(1 + np.asarray(rets))
    return float(np.min(w / np.maximum.accumulate(w) - 1))


def perf(rets, rf=None, per=12):
    x = np.asarray(rets, float)
    x = x[np.isfinite(x)]
    if len(x) < 12:
        return None
    ann = (np.prod(1 + x) ** (per / len(x)) - 1) * 100
    vol = np.std(x, ddof=1) * np.sqrt(per) * 100
    mean = np.mean(x) * per * 100
    t = np.mean(x) / (np.std(x, ddof=1) / np.sqrt(len(x)))
    return {"cagr": r(ann, 1), "mean": r(mean, 1), "vol": r(vol, 1), "sharpe": r(mean / vol, 2),
            "t": r(t, 2), "maxdd": r(max_dd(x) * 100, 1), "n": len(x)}


def load_prices(tickers):
    adj, cls, spl = {}, {}, {}
    for t in tickers:
        p = CACHE / "px" / f"{t}.csv.gz"
        if not p.exists():
            continue
        df = pd.read_csv(p, index_col=0, parse_dates=True)
        if df.empty or df["adj"].notna().sum() < 60:
            continue
        adj[t], cls[t], spl[t] = df["adj"], df["close"], df["split"]
    A = pd.DataFrame(adj).sort_index()
    C = pd.DataFrame(cls).sort_index()
    S = pd.DataFrame(spl).sort_index()
    return A, C, S


def analyze():
    import statsmodels.api as sm
    OUT.mkdir(parents=True, exist_ok=True)
    rng = np.random.default_rng(20260916)
    summary = {}

    # ------------------------------------------------------------ inputs
    index = json.loads(gzip.decompress((CACHE / "filings.json.gz").read_bytes()))
    tm = ticker_map()
    s2i = sic_to_ff49()
    firms = {}
    for rec in index:
        c = rec["cik"]
        if c not in tm.index:
            continue
        sic = int(rec["sic"]) if str(rec.get("sic") or "").isdigit() else None
        firms[c] = {"ticker": tm.loc[c, "ticker"], "name": tm.loc[c, "name"], "sic": sic,
                    "ind": s2i.get(sic) if sic else None}
    F = pd.DataFrame.from_dict(firms, orient="index")
    F.index.name = "cik"

    cnt = pd.read_csv(CACHE / "tenk_counts.csv")
    cnt = cnt.drop_duplicates("accn")
    cnt["filed"] = pd.to_datetime(cnt["filed"])
    cnt["ai"] = cnt[AI_SCORE].sum(axis=1)
    cnt["expo"] = np.where(cnt["words"] >= MIN_WORDS, 1e4 * cnt["ai"] / cnt["words"], np.nan)
    cnt["genai"] = cnt["generative_ai"] + cnt["llm"]
    summary["docs"] = int(len(cnt))
    summary["docsWrapper"] = int((cnt["words"] < MIN_WORDS).sum())
    summary["firmsText"] = int(cnt["cik"].nunique())
    summary["medianWords"] = int(cnt["words"].median())

    fl = public_floats()
    cnt = cnt.join(fl.drop_duplicates("accn").set_index("accn")[["float", "end"]], on="accn")
    miss = cnt["float"].isna()
    if miss.any():
        fb = pd.merge_asof(cnt.loc[miss, ["accn", "cik", "filed"]].sort_values("filed"),
                           fl.sort_values("end").rename(columns={"accn": "f_accn"}),
                           left_on="filed", right_on="end", by="cik", direction="backward",
                           tolerance=pd.Timedelta(days=500)).set_index("accn")
        cnt.loc[miss, "float"] = cnt.loc[miss, "accn"].map(fb["float"])
        cnt.loc[miss, "end"] = cnt.loc[miss, "accn"].map(fb["end"])
    cnt = cnt[cnt["cik"].isin(F.index)]

    tick = F["ticker"].to_dict()
    for t in set(tick.values()):
        yahoo_daily(t)               # no-op when cached
    A, C, S = load_prices(sorted(set(tick.values())))
    A = A.loc[:PX1]
    C, S = C.reindex(A.index), S.reindex(A.index)
    summary["tickersPriced"] = int(A.shape[1])
    summary["tickersWanted"] = int(len(set(tick.values())))

    # returns: monthly and weekly, with glitch filters (ticker reuse / bad prints)
    Am = A.resample("ME").last()
    Rm = Am.pct_change(fill_method=None)
    Rm = Rm.mask((Rm < -0.95) | (Rm > 5.0))
    Rm.index = Rm.index.to_period("M")
    Aw = A.resample("W-FRI").last()
    Rw = Aw.pct_change(fill_method=None)
    Rw = Rw.mask((Rw < -0.9) | (Rw > 3.0))
    Cm = C.resample("ME").last()
    Cm.index = Cm.index.to_period("M")
    Sm = S.resample("ME").last()
    Sm.index = Sm.index.to_period("M")

    # French library
    ff5d = ff_table(ff_zip("F-F_Research_Data_5_Factors_2x3_daily_CSV.zip"), datelen=8) / 100
    momd = ff_table(ff_zip("F-F_Momentum_Factor_daily_CSV.zip"), datelen=8) / 100
    ffd = ff5d.join(momd.rename(columns=lambda c: "MOM"), how="inner")
    ffw = (1 + ffd).resample("W-FRI").prod() - 1
    ffw = ffw[ffd.resample("W-FRI").size() > 0]
    ff5m = ff_table(ff_zip("F-F_Research_Data_5_Factors_2x3_CSV.zip")) / 100
    momm = ff_table(ff_zip("F-F_Momentum_Factor_CSV.zip")) / 100
    ffm = ff5m.join(momm.rename(columns=lambda c: "MOM"), how="inner")
    ind_txt = ff_zip("49_Industry_Portfolios_daily_CSV.zip")
    ind_d = ff_table(ind_txt, "Average Value Weighted Returns -- Daily", datelen=8) / 100
    ind_w = (1 + ind_d).resample("W-FRI").prod() - 1
    ind_w = ind_w[ind_d.resample("W-FRI").size() > 0]
    FAC = ["Mkt-RF", "SMB", "HML", "RMW", "CMA", "MOM"]

    # ---------------------------------------------- 1. adoption (by filing year)
    good = cnt[cnt["words"] >= MIN_WORDS].copy()
    good["fy"] = good["filed"].dt.year
    adoption = []
    for y, g in good.groupby("fy"):
        if y > 2026:
            continue
        adoption.append({
            "year": int(y), "n": int(len(g)),
            "share": r((g["ai"] > 0).mean() * 100, 1),
            "share5": r((g["expo"] >= 5).mean() * 100, 1),
            "shareGen": r((g["genai"] > 0).mean() * 100, 1),
            "mean": r(g["expo"].mean(), 2), "median": r(g["expo"].median(), 2),
            "p90": r(g["expo"].quantile(0.9), 2),
        })
    (OUT / "adoption.json").write_text(json.dumps(adoption), encoding="utf-8")
    # term mix, first vs last full year
    mix = []
    for y in (2016, 2019, 2022, 2025):
        g = good[good["fy"] == y]
        tot = g[AI_SCORE].sum()
        mix.append({"year": y, **{k: r(tot[k] / max(tot.sum(), 1) * 100, 1) for k in AI_SCORE}})
    (OUT / "termmix.json").write_text(json.dumps(mix), encoding="utf-8")

    # ---------------------------------------------- 2. point-in-time firm state
    months = pd.period_range(M0 - 12, M1, freq="M")
    mends = pd.DatetimeIndex([m.to_timestamp(how="end").normalize() for m in months])
    good_s = good.sort_values("filed")
    grid = pd.DataFrame([(d, c) for d in mends for c in F.index], columns=["date", "cik"])
    st = pd.merge_asof(grid.sort_values("date"), good_s[["cik", "filed", "accn", "expo", "ai", "words",
                                                         "genai", "float", "end", "gpu", "data_center",
                                                         "accelerated_computing", "hyperscale"]],
                       left_on="date", right_on="filed", by="cik", direction="backward",
                       tolerance=pd.Timedelta(days=548))
    st = st.dropna(subset=["expo", "float", "end"])
    st["tic"] = st["cik"].map(tick)
    st = st[st["tic"].isin(A.columns)]
    st["m"] = st["date"].dt.to_period("M")
    st["ind"] = st["cik"].map(F["ind"])

    # float value: cover-page float scaled by the split-adjusted price move since the float date
    Cf = C.ffill(limit=5)
    def px_at(tics, dates, D=None):
        D = Cf if D is None else D
        out = np.full(len(tics), np.nan)
        for t, ix in pd.Series(range(len(tics))).groupby(np.asarray(tics)):
            s = D[t].dropna()
            if s.empty:
                continue
            pos = s.index.searchsorted(pd.DatetimeIndex(np.asarray(dates)[ix.values]), side="right") - 1
            ok = pos >= 0
            vals = np.full(len(pos), np.nan)
            vals[ok] = s.values[pos[ok]]
            out[ix.values] = vals
        return out
    st["px_end"] = px_at(st["tic"].values, st["end"].values)
    st["px_t"] = [Cm.at[m, t] if m in Cm.index else np.nan for m, t in zip(st["m"], st["tic"])]
    st["fv"] = st["float"] * st["px_t"] / st["px_end"]
    st["unadj"] = [Cm.at[m, t] * Sm.at[m, t] if m in Cm.index else np.nan for m, t in zip(st["m"], st["tic"])]
    # next-month return (the portfolio holding period)
    nxt = {m: m + 1 for m in months}
    st["ret1"] = [Rm.at[nxt[m], t] if nxt[m] in Rm.index else np.nan for m, t in zip(st["m"], st["tic"])]
    st = st[np.isfinite(st["fv"]) & (st["fv"] > 0)]

    # market cap and P/S for valuation (split-consistent: unadjusted close x cover shares)
    shares, rev = xbrl_frames()
    shares["end"] = pd.to_datetime(shares["end"])
    shares = shares[(shares["shares"] > 1e5) & (shares["shares"] < 5e10)].sort_values("end")
    st = st.sort_values("date")
    st = pd.merge_asof(st, shares.rename(columns={"end": "sh_end"}), left_on="date", right_on="sh_end",
                       by="cik", direction="backward", tolerance=pd.Timedelta(days=400))
    st["mcap"] = st["unadj"] * st["shares"]

    # float sanity. The cover-page float can never exceed market cap on the
    # float date, yet a block of filers tag it with a 1,000x scale error (Onto
    # Innovation "reports" a $5.7 trillion float). Validate every float against
    # unadjusted price x cover shares on its own date: rescale exact 1,000x
    # errors, drop anything else that fails, and for issuers with no usable
    # share count (multi-class) require consistency with the firm's own history.
    UF = (C * S).ffill(limit=5)
    st["upx_end"] = px_at(st["tic"].values, st["end"].values, UF)
    se = pd.merge_asof(st[["end", "cik"]].reset_index().sort_values("end"),
                       shares.rename(columns={"end": "se"}), left_on="end", right_on="se", by="cik",
                       direction="nearest", tolerance=pd.Timedelta(days=400)).set_index("index")["shares"]
    ratio = st["float"] / (st["upx_end"] * se.reindex(st.index))
    ok_r = ratio.between(0.02, 2.0)     # slack for share-count dates that differ from the float date
    fix = (ratio / 1000).between(0.02, 2.0)
    summary["floatFixed"] = int(st.loc[fix, "accn"].nunique())
    st.loc[fix, "float"] /= 1000
    st.loc[fix, "fv"] /= 1000
    bad_f = ratio.notna() & ~ok_r & ~fix
    summary["floatDropped"] = int(st.loc[bad_f, "accn"].nunique())
    med = st.loc[~bad_f].groupby("cik")["float"].transform("median").reindex(st.index)
    unver = ratio.isna() & (((st["float"] > 20 * med) | (st["float"] < med / 20)) | (st["float"] > 5e12))
    summary["floatUnverifiedDropped"] = int(st.loc[unver, "accn"].nunique())
    summary["floatVerifiedShare"] = r(ratio.notna().mean() * 100, 1)
    st = st[~bad_f & ~unver].copy()
    bad = ~((st["mcap"] >= 0.5 * st["fv"]) & (st["mcap"] <= 50 * st["fv"]))
    st.loc[bad, "mcap"] = np.nan
    rev["end"] = pd.to_datetime(rev["end"])
    rev = rev.groupby(["cik", "end"], as_index=False)["rev"].max()
    rev["avail"] = rev["end"] + pd.Timedelta(days=90)
    rev = rev[rev["rev"] > 1e7].sort_values("avail")
    st = pd.merge_asof(st.sort_values("date"), rev[["cik", "avail", "rev"]], left_on="date",
                       right_on="avail", by="cik", direction="backward", tolerance=pd.Timedelta(days=500))
    st["lps"] = np.log(st["mcap"] / st["rev"])
    st.loc[(st["lps"] < np.log(0.01)) | (st["lps"] > np.log(500)), "lps"] = np.nan

    # universe: top UNIVERSE_N by float value each month
    st["rank"] = st.groupby("m")["fv"].rank(ascending=False, method="first")
    U = st[st["rank"] <= UNIVERSE_N].copy()

    # sorts: global, and within FF49 industry
    def legs(g):
        q30, q80 = g["expo"].quantile(0.3), g["expo"].quantile(0.8)
        hi = (g["expo"] > q80) & (g["expo"] > 0)
        lo = g["expo"] <= q30
        return pd.Series(np.where(hi, "H", np.where(lo, "L", "M")), index=g.index)
    U["leg"] = U.groupby("m", group_keys=False)[["expo"]].apply(legs)
    q90 = U.groupby("m")["expo"].transform(lambda x: x.quantile(0.9))
    U["top"] = (U["expo"] > q90) & (U["expo"] > 0)
    U["legI"] = "M"
    for (m, ind), g in U.groupby(["m", "ind"]):
        if len(g) >= 5:
            U.loc[g.index, "legI"] = legs(g)
    summary["universeMonths"] = int(U["m"].nunique())

    # ---------------------------------------------- 3. factor returns (monthly)
    rows = []
    for m, g in U.groupby("m"):
        if m < M0 or m >= M1:
            continue
        gg = g[np.isfinite(g["ret1"])]
        def vw(x):
            return float(np.average(x["ret1"], weights=x["fv"])) if len(x) else np.nan
        H, L = gg[gg["leg"] == "H"], gg[gg["leg"] == "L"]
        T = gg[gg["top"]]
        ind_rows = []
        for ind, gi in gg.groupby("ind"):
            h, l = gi[gi["legI"] == "H"], gi[gi["legI"] == "L"]
            if len(h) and len(l):
                ind_rows.append((vw(h) - vw(l), gi["fv"].sum()))
        rows.append({
            "m": m + 1, "H": vw(H), "L": vw(L), "Hew": H["ret1"].mean(), "Lew": L["ret1"].mean(),
            "IN": np.average([x for x, _ in ind_rows], weights=[w for _, w in ind_rows]) if ind_rows else np.nan,
            "T": vw(T), "mkt": vw(gg), "nH": len(H), "nL": len(L), "nU": len(gg),
            "capH": H["fv"].sum() / gg["fv"].sum(), "nInd": len(ind_rows),
        })
    fr = pd.DataFrame(rows).set_index("m")
    fr["AIX"] = fr["H"] - fr["L"]
    fr["AIXew"] = fr["Hew"] - fr["Lew"]
    fr["AIX10"] = fr["T"] - fr["L"]
    fr = fr.join(ffm, how="left")
    fr = fr[fr["RF"].notna()]
    summary["factorStart"], summary["factorEnd"] = str(fr.index[0]), str(fr.index[-1])
    # data validation: the survivor-built value-weighted universe vs the CRSP
    # value-weighted market in the French library
    crsp = fr["Mkt-RF"] + fr["RF"]
    summary["valCorr"] = r(np.corrcoef(fr["mkt"], crsp)[0, 1], 3)
    summary["valTE"] = r((fr["mkt"] - crsp).std() * np.sqrt(12) * 100, 2)
    summary["valDiff"] = r((fr["mkt"] - crsp).mean() * 1200, 2)
    summary["valBeta"] = r(np.polyfit(crsp, fr["mkt"], 1)[0], 2)
    summary["nH"] = r(fr["nH"].mean(), 0)
    summary["nL"] = r(fr["nL"].mean(), 0)
    summary["nUniverse"] = r(fr["nU"].mean(), 0)

    pre = fr.index <= pd.Period("2022-11", "M")
    post = ~pre
    fstats = []
    for key, lab in (("AIX", "AI − low-AI, value-weighted"), ("AIXew", "AI − low-AI, equal-weighted"),
                     ("IN", "AI − low-AI, within-industry"), ("AIX10", "Top-decile AI − low-AI, value-weighted"),
                     ("Mkt-RF", "Market excess (FF)")):
        row = {"key": key, "label": lab}
        for nm, msk in (("full", np.ones(len(fr), bool)), ("pre", pre), ("post", post)):
            row[nm] = perf(fr.loc[msk, key].values)
        fstats.append(row)

    def span(key, msk):
        y = fr.loc[msk, key].values
        X = fr.loc[msk, FAC].values
        f = hac_ols(y, X, HAC)
        if f is None:
            return None
        return {"alpha": r(f.params[0] * 1200, 1), "tA": r(f.tvalues[0], 2), "r2": r(f.rsquared * 100, 1),
                "n": int(f.nobs), "b": {k: r(f.params[i + 1], 2) for i, k in enumerate(FAC)},
                "t": {k: r(f.tvalues[i + 1], 1) for i, k in enumerate(FAC)}}
    spanning = {k: {nm: span(k, msk) for nm, msk in (("full", np.ones(len(fr), bool)), ("pre", pre), ("post", post))}
                for k in ("AIX", "AIXew", "IN", "AIX10")}
    curve = []
    g1 = np.cumprod(1 + fr["AIX"].fillna(0)); g2 = np.cumprod(1 + fr["IN"].fillna(0))
    g3 = np.cumprod(1 + fr["AIXew"].fillna(0)); g4 = np.cumprod(1 + (fr["Mkt-RF"] + fr["RF"]))
    for i, m in enumerate(fr.index):
        curve.append({"date": str(m), "vw": r(g1.iloc[i], 3), "ind": r(g2.iloc[i], 3),
                      "ew": r(g3.iloc[i], 3), "mkt": r(g4.iloc[i], 3), "capH": r(fr["capH"].iloc[i] * 100, 1)})
    # post-ChatGPT alpha is a repricing: test alpha stability with a Chow-style dummy
    d_post = post.astype(float)
    Xc = np.column_stack([d_post, fr[FAC].values])
    fch = hac_ols(fr["AIX"].values, Xc, HAC)
    spanning["breakAIX"] = {"diff": r(fch.params[1] * 1200, 1), "t": r(fch.tvalues[1], 2)}
    (OUT / "factor.json").write_text(json.dumps({"stats": fstats, "spanning": spanning, "curve": curve}),
                                     encoding="utf-8")

    # ---------------------------------------------- 4. ChatGPT event study (validation)
    ev_m = pd.Period("2022-11", "M")
    E = U[U["m"] == ev_m].copy()
    est = (ffw.index > pd.Timestamp("2019-11-29")) & (ffw.index <= pd.Timestamp("2022-11-25"))
    win = (ffw.index > pd.Timestamp("2022-11-25")) & (ffw.index <= pd.Timestamp("2023-06-30"))
    plc = (ffw.index > pd.Timestamp("2022-05-06")) & (ffw.index <= pd.Timestamp("2022-11-25"))
    win2 = (ffw.index > pd.Timestamp("2022-11-25")) & (ffw.index <= pd.Timestamp("2024-12-27"))
    Xw = ffw[FAC].values
    rfw = ffw["RF"].values
    Rwa = Rw.reindex(ffw.index)
    cars = []
    for _, row in E.iterrows():
        y = Rwa[row["tic"]].values - rfw
        m_e = est & np.isfinite(y)
        if m_e.sum() < 100:
            continue
        b = np.linalg.lstsq(np.column_stack([np.ones(m_e.sum()), Xw[m_e]]), y[m_e], rcond=None)[0]
        ab = y - Xw @ b[1:]          # alpha excluded: abnormal = excess - factor exposure
        def car(msk):
            v = ab[msk]
            return np.nansum(v) * 100 if np.isfinite(v).sum() >= 0.8 * msk.sum() else np.nan
        cars.append({"cik": row["cik"], "tic": row["tic"], "expo": row["expo"], "ind": row["ind"],
                     "lfv": np.log(row["fv"]), "car": car(win), "plc": car(plc), "car2": car(win2),
                     "raw": np.nansum(Rwa[row["tic"]].values[win]) * 100})
    EV = pd.DataFrame(cars).dropna(subset=["car", "plc"])
    EV["x"] = np.log1p(EV["expo"])
    EV["xz"] = (EV["x"] - EV["x"].mean()) / EV["x"].std()
    pos = EV["expo"] > 0
    EV["grp"] = "none"
    EV.loc[pos, "grp"] = pd.qcut(EV.loc[pos, "expo"], 5, labels=[f"Q{i}" for i in range(1, 6)]).astype(str)
    groups = []
    for gname in ["none", "Q1", "Q2", "Q3", "Q4", "Q5"]:
        g = EV[EV["grp"] == gname]
        bs = [g["car"].values[rng.integers(0, len(g), len(g))].mean() for _ in range(2000)]
        groups.append({"grp": gname, "n": int(len(g)), "car": r(g["car"].mean(), 1),
                       "lo": r(np.percentile(bs, 2.5), 1), "hi": r(np.percentile(bs, 97.5), 1),
                       "plc": r(g["plc"].mean(), 1), "car2": r(g["car2"].mean(), 1),
                       "expoLo": r(g["expo"].min(), 1), "expoHi": r(g["expo"].max(), 1)})

    def xsec(ycol, fe=True, wls=False):
        d = EV.dropna(subset=[ycol, "ind"]).copy()
        X = d[["xz", "lfv"]]
        if fe:
            X = X.join(pd.get_dummies(d["ind"], prefix="i", drop_first=True, dtype=float))
        X = sm.add_constant(X.astype(float))
        mdl = (sm.WLS(d[ycol].astype(float), X, weights=np.exp(d["lfv"])) if wls
               else sm.OLS(d[ycol].astype(float), X))
        f = mdl.fit(cov_type="cluster", cov_kwds={"groups": pd.factorize(d["ind"])[0]})
        return {"b": r(f.params["xz"], 2), "t": r(f.tvalues["xz"], 2), "n": int(f.nobs), "r2": r(f.rsquared * 100, 1)}
    event = {"groups": groups,
             "reg": {"car": xsec("car"), "plc": xsec("plc"), "car2": xsec("car2"), "carNoFE": xsec("car", False),
                     "carVW": xsec("car", True, True), "car2VW": xsec("car2", True, True),
                     "plcVW": xsec("plc", True, True)},
             "n": int(len(EV)), "shareZero": r((~pos).mean() * 100, 1)}
    # most-exposed names pre-event
    top_ev = EV.sort_values("expo", ascending=False).head(12)
    event["top"] = [{"tic": t, "expo": r(e, 1), "car": r(c, 0)} for t, e, c in
                    zip(top_ev["tic"], top_ev["expo"], top_ev["car"])]
    (OUT / "event.json").write_text(json.dumps(event), encoding="utf-8")

    # ---------------------------------------------- 5. crowding measures
    wk_by_month = {}
    for m in pd.period_range(M0 - 1, M1, freq="M"):
        me = m.to_timestamp(how="end").normalize()
        wks = ffw.index[(ffw.index <= me)][-52:]
        wk_by_month[m] = wks
    iw = ind_w.reindex(ffw.index)
    cm_rows = []
    core_info = {}
    for m, g in U.groupby("m"):
        if m < M0 - 1 or m > M1:
            continue
        wks = wk_by_month[m]
        if len(wks) < 52:
            continue
        g = g[g["ind"].notna()]
        R = Rw.reindex(index=wks, columns=g["tic"]).values
        ok = np.isfinite(R).all(axis=0)
        g = g[ok]
        R = R[:, ok]
        Xf = ffw.loc[wks, FAC].values
        rf_ = ffw.loc[wks, "RF"].values[:, None]
        Y = R - rf_
        # FF5 + momentum residuals. No own-industry regressor: for dominant
        # firms (NVIDIA is a large share of the Chips portfolio) it would absorb
        # the firm itself; industry shocks are removed instead by averaging
        # only cross-industry pairs.
        base = np.column_stack([np.ones(len(wks)), Xf])
        B = np.linalg.lstsq(base, Y, rcond=None)[0]
        E_ = Y - base @ B
        Z6 = (E_ - E_.mean(0)) / E_.std(0)
        base1 = base[:, :2]                      # market model only
        B1 = np.linalg.lstsq(base1, Y, rcond=None)[0]
        E1 = Y - base1 @ B1
        Z1 = (E1 - E1.mean(0)) / E1.std(0)
        inds = g["ind"].values
        legs_ = g["leg"].values
        dec = pd.qcut(np.log(g["fv"].values), 10, labels=False, duplicates="drop")

        def xcorr(ix, Z=Z6):
            if len(ix) < 20:
                return np.nan
            Cc = (Z[:, ix].T @ Z[:, ix]) / Z.shape[0]
            diff = inds[ix][:, None] != inds[ix][None, :]
            iu = np.triu(np.ones_like(diff, bool), 1) & diff
            return float(Cc[iu].mean())
        iH = np.where(legs_ == "H")[0]
        iL = np.where(legs_ == "L")[0]
        iT = np.where(g["top"].values)[0]
        cH, cL = xcorr(iH), xcorr(iL)
        cT, cT1 = xcorr(iT), xcorr(iT, Z1)
        cH1 = xcorr(iH, Z1)
        # size-matched benchmark from non-H stocks: same float-cap decile mix
        nonH = np.where(legs_ != "H")[0]
        bench, bench1 = [], []
        for _ in range(10):
            pick = []
            for d_ in dec[iH]:
                pool = nonH[dec[nonH] == d_]
                if len(pool):
                    pick.append(rng.choice(pool))
            pk = np.unique(np.array(pick))
            bench.append(xcorr(pk))
            bench1.append(xcorr(pk, Z1))
        cB = float(np.nanmean(bench))
        cB1 = float(np.nanmean(bench1))
        # same size-matched benchmark for the top-decile core
        nonT = np.where(~g["top"].values)[0]
        benchT = []
        for _ in range(10):
            pick = [rng.choice(nonT[dec[nonT] == d_]) for d_ in dec[iT] if (dec[nonT] == d_).any()]
            benchT.append(xcorr(np.unique(np.array(pick, dtype=int))))
        cBT = float(np.nanmean(benchT))
        if m == M1:
            # inference for the latest reading: resample WEEKS (block 4) and
            # recompute core-minus-benchmark on a fixed set of benchmark draws
            picks = [np.unique(np.array([rng.choice(nonT[dec[nonT] == d_]) for d_ in dec[iT]
                                         if (dec[nonT] == d_).any()], dtype=int)) for _ in range(10)]
            diffs = []
            for _ in range(500):
                wi = block_idx(rng, Z6.shape[0], 4)
                Zb = Z6[wi]
                Zb = (Zb - Zb.mean(0)) / Zb.std(0)
                diffs.append(xcorr(iT, Zb) - np.nanmean([xcorr(pk, Zb) for pk in picks]))
            gT = g.iloc[iT]
            wT = gT["fv"] / gT["fv"].sum()
            core_info = {
                "n": int(len(iT)), "lo": r(np.percentile(diffs, 2.5), 3), "hi": r(np.percentile(diffs, 97.5), 3),
                "inds": gT["ind"].value_counts().head(8).to_dict(),
                "ret6": r(float((np.prod(1 + np.nan_to_num(Rw.reindex(index=wks[-26:], columns=gT["tic"]).values), axis=0) - 1)
                               @ wT.values) * 100, 1),
                "ret6ew": r(float(np.mean(np.prod(1 + np.nan_to_num(Rw.reindex(index=wks[-26:], columns=gT["tic"]).values), axis=0) - 1)) * 100, 1),
                "names": gT.sort_values("fv", ascending=False)["tic"].head(15).tolist(),
            }
        # valuation spreads (raw and industry-adjusted log P/S)
        gv = U[(U["m"] == m)].copy()
        gv["lps_ind"] = gv["lps"] - gv.groupby("ind")["lps"].transform("median")
        vH, vL = gv[gv["leg"] == "H"], gv[gv["leg"] == "L"]
        w = gv["fv"] / gv["fv"].sum()
        hw = np.sort(vH["fv"].values)[::-1]
        cm_rows.append({
            "m": m, "coH": cH, "coL": cL, "coB": cB, "excess": cH - cB,
            "coH1": cH1, "coB1": cB1, "excess1": cH1 - cB1, "coT": cT, "coT1": cT1,
            "coBT": cBT, "excessT": cT - cBT, "nT": len(iT),
            "coAll": xcorr(np.arange(Z6.shape[1])), "coAll1": xcorr(np.arange(Z6.shape[1]), Z1),
            "val": vH["lps"].median() - vL["lps"].median(),
            "valInd": vH["lps_ind"].median() - vL["lps_ind"].median(),
            "valCov": float(gv["lps"].notna().mean()),
            "capH": vH["fv"].sum() / gv["fv"].sum(),
            "top10": hw[:10].sum() / gv["fv"].sum(),
            "hhiU": float((w ** 2).sum()),
            "nH": len(vH),
        })
    CR = pd.DataFrame(cm_rows).set_index("m")
    aix = fr["AIX"]
    # run-up (trailing 24m cumulative AIX) and trailing 26-week factor vol, as of month-end m
    wk_aix = []
    for m in fr.index:
        wks = ffw.index[(ffw.index.to_period("M") == m)]
        g = U[U["m"] == m - 1]
        g = g[np.isfinite(g["fv"])]
        H, L = g[g["leg"] == "H"], g[g["leg"] == "L"]
        for wk in wks:
            rh = Rw.loc[wk, H["tic"]].values
            rl = Rw.loc[wk, L["tic"]].values
            mh, ml = np.isfinite(rh), np.isfinite(rl)
            if mh.sum() and ml.sum():
                wk_aix.append((wk, np.average(rh[mh], weights=H["fv"].values[mh])
                               - np.average(rl[ml], weights=L["fv"].values[ml])))
    WA = pd.Series(dict(wk_aix)).sort_index()
    runup, fvol = {}, {}
    for m in CR.index:
        past = aix[(aix.index > m - 24) & (aix.index <= m)]
        runup[m] = np.prod(1 + past.values) - 1 if len(past) == 24 else np.nan
        me = m.to_timestamp(how="end").normalize()
        wv = WA[WA.index <= me].tail(26)
        fvol[m] = wv.std() * np.sqrt(52) if len(wv) == 26 else np.nan
    CR["runup"] = pd.Series(runup)
    CR["fvol"] = pd.Series(fvol)

    def z_exp(s, min_obs=24):
        return (s - s.expanding(min_obs).mean()) / s.expanding(min_obs).std(ddof=0)
    COMP = ["excess", "valInd", "capH", "runup"]
    for c in COMP + ["fvol", "val", "top10", "excess1", "excessT"]:
        CR[c + "_z"] = z_exp(CR[c])
    CR["crowd"] = CR[[c + "_z" for c in COMP]].mean(axis=1, skipna=False)
    # full-sample standardized composite (for regressions; stated as in-sample)
    CR["crowdFS"] = CR[COMP].apply(lambda s: (s - s.mean()) / s.std()).mean(axis=1)

    last = CR.index[-1]
    def pctile(s, v):
        s = s.dropna()
        return float((s <= v).mean() * 100)
    dash = []
    for c, lab, unit, dec_ in (("excess", "Excess residual comovement (AI vs size-matched)", "ρ", 3),
                               ("coH", "  — AI leg, cross-industry pairs", "ρ", 3),
                               ("coB", "  — size-matched non-AI benchmark", "ρ", 3),
                               ("excess1", "Excess comovement, market-model residuals", "ρ", 3),
                               ("excessT", "Excess comovement, top-decile AI core", "ρ", 3),
                               ("coT", "  — top-decile core, cross-industry pairs", "ρ", 3),
                               ("valInd", "Valuation spread, industry-adj. log P/S", "log", 2),
                               ("val", "Valuation spread, raw log P/S", "log", 2),
                               ("capH", "AI-leg share of universe float-cap", "%", 1),
                               ("top10", "Top-10 AI names' share of universe", "%", 1),
                               ("runup", "AI factor trailing 24m return", "%", 0),
                               ("fvol", "AI factor volatility (26w, ann.)", "%", 1),
                               ("crowd", "Crowding composite (real-time z)", "z", 2)):
        mult = 100 if unit == "%" else 1
        v = CR.at[last, c]
        yago = CR[c].get(last - 12, np.nan)
        dash.append({"key": c, "label": lab, "unit": unit, "last": r(v * mult, dec_),
                     "prior": r(yago * mult, dec_), "pre": r(CR.loc[:pd.Period("2022-11", "M"), c].mean() * mult, dec_),
                     "z": r(CR.at[last, c + "_z"], 2) if c + "_z" in CR else None,
                     "pct": r(pctile(CR[c], v), 0)})
    series = [{"date": str(m), **{k: r(CR.at[m, k], 4) for k in
               ("coH", "coL", "coB", "excess", "coH1", "coB1", "excess1", "coT", "coT1", "coBT", "excessT", "coAll", "coAll1", "val", "valInd", "capH", "top10", "runup", "fvol", "crowd")}}
              for m in CR.index]
    ccorr = CR[COMP].corr().round(2).values.tolist()
    (OUT / "crowding.json").write_text(json.dumps({"asOf": str(last), "dash": dash, "series": series,
                                                   "corr": {"labels": COMP, "m": ccorr, "n": int(CR[COMP].dropna().shape[0])},
                                                   "valCov": r(CR["valCov"].iloc[-1] * 100, 0), "core": core_info}),
                                       encoding="utf-8")

    # ---------------------------------------------- 6. does crowding predict?
    pred = []
    fwd = {}
    for h in (3, 6, 12):
        vals = {}
        for m in CR.index:
            f_ = aix[(aix.index > m) & (aix.index <= m + h)]
            vals[m] = np.prod(1 + f_.values) - 1 if len(f_) == h else np.nan
        fwd[f"r{h}"] = pd.Series(vals)
    dd = {}
    vol6 = {}
    for m in CR.index:
        f_ = aix[(aix.index > m) & (aix.index <= m + 12)]
        dd[m] = max_dd(f_.values) if len(f_) == 12 else np.nan
        me = m.to_timestamp(how="end").normalize()
        me6 = (m + 6).to_timestamp(how="end").normalize()
        wv = WA[(WA.index > me) & (WA.index <= me6)]
        vol6[m] = wv.std() * np.sqrt(52) if len(wv) >= 24 else np.nan
    fwd["dd12"] = pd.Series(dd)
    fwd["vol6"] = pd.Series(vol6)
    FW = pd.DataFrame(fwd)
    for c in COMP + ["crowdFS"]:
        x = (CR[c] - CR[c].mean()) / CR[c].std()
        for ycol, h, lab in (("r3", 3, "fwd 3m AIX"), ("r6", 6, "fwd 6m AIX"), ("r12", 12, "fwd 12m AIX"),
                             ("dd12", 12, "fwd 12m max drawdown"), ("vol6", 6, "fwd 6m factor vol")):
            y = FW[ycol].values * 100
            f = hac_ols(y, x.values[:, None], h)
            if f is None:
                continue
            se = f.bse[1]
            # HAC t's are unreliable with ~n/h independent observations, so
            # each slope also gets a circular block bootstrap (block = 2h) of
            # (x, y) pairs; p is two-sided from the bootstrap distribution
            # re-centred at zero, Bonferroni over the 25-cell grid
            msk = np.isfinite(y) & np.isfinite(x.values)
            xv, yv = x.values[msk], y[msk]
            bs = []
            for _ in range(2000):
                ii = block_idx(rng, len(xv), 2 * h)
                xb = xv[ii]
                if xb.std() == 0:
                    continue
                bs.append(np.polyfit(xb, yv[ii], 1)[0])
            bs = np.array(bs)
            p_bs = float(np.mean(np.abs(bs - bs.mean()) >= abs(f.params[1])))
            pred.append({"x": c, "y": ycol, "ylab": lab, "b": r(f.params[1], 2), "t": r(f.tvalues[1], 2),
                         "n": int(f.nobs), "neff": int(f.nobs // h), "mde": r(2.8 * se, 2),
                         "r2": r(f.rsquared * 100, 1),
                         "lo": r(np.percentile(bs, 2.5), 2), "hi": r(np.percentile(bs, 97.5), 2),
                         "p": r(p_bs, 3), "pBonf": r(min(1.0, p_bs * 25), 3)})
    (OUT / "predict.json").write_text(json.dumps(pred), encoding="utf-8")

    # ---------------------------------------------- 7. what did AI returns consist of? (re-rating decomposition)
    base_m, end_m = pd.Period("2022-11", "M"), CR.index[-1]
    b0 = U[(U["m"] == base_m)].set_index("cik")
    s1 = st[st["m"] == end_m].set_index("cik")
    decomp = []
    for leg, lab in (("H", "AI leg (fixed at Nov-2022)"), ("L", "Low-AI leg (fixed at Nov-2022)")):
        ids = b0.index[(b0["leg"] == leg)]
        ids = [c for c in ids if c in s1.index]
        a0, a1 = b0.loc[ids], s1.loc[ids]
        ok = (a0["mcap"].notna() & a0["rev"].notna() & a1["mcap"].notna() & a1["rev"].notna()).values
        a0, a1 = a0[ok], a1[ok]
        mc0, mc1, rv0, rv1 = a0["mcap"].sum(), a1["mcap"].sum(), a0["rev"].sum(), a1["rev"].sum()
        tot = np.log(mc1 / mc0)
        gs = np.log(rv1 / rv0)
        decomp.append({"leg": lab, "n": int(ok.sum()), "cap": r(tot * 100, 1), "sales": r(gs * 100, 1),
                       "rerate": r((tot - gs) * 100, 1), "ps0": r(mc0 / rv0, 2), "ps1": r(mc1 / rv1, 2),
                       "top5": r(np.sort((a1["mcap"] - a0["mcap"]).values)[::-1][:5].sum() / (mc1 - mc0) * 100, 0)})
    (OUT / "decomp.json").write_text(json.dumps(decomp), encoding="utf-8")

    # ---------------------------------------------- 8. latest cross-section: names and industries
    lastU = U[U["m"] == U["m"].max()].copy()
    lastU["name"] = lastU["cik"].map(F["name"])
    top = lastU.sort_values("expo", ascending=False).head(20)
    topnames = [{"tic": t, "name": n, "ind": i, "expo": r(e, 1), "fv": r(f / 1e9, 0), "filed": str(fd.date())}
                for t, n, i, e, f, fd in zip(top["tic"], top["name"], top["ind"], top["expo"], top["fv"], top["filed"])]
    bigH = lastU[lastU["leg"] == "H"].sort_values("fv", ascending=False).head(12)
    bignames = [{"tic": t, "name": n, "ind": i, "expo": r(e, 1), "w": r(f / lastU["fv"].sum() * 100, 1)}
                for t, n, i, e, f in zip(bigH["tic"], bigH["name"], bigH["ind"], bigH["expo"], bigH["fv"])]
    ind_tab = []
    u19 = U[U["m"] == pd.Period("2019-12", "M")]
    u22 = U[U["m"] == pd.Period("2022-11", "M")]
    for ind, g in lastU.groupby("ind"):
        if len(g) < 5:
            continue
        g19, g22 = u19[u19["ind"] == ind], u22[u22["ind"] == ind]
        ind_tab.append({"ind": ind, "n": int(len(g)),
                        "expo": r(np.average(g["expo"], weights=g["fv"]), 1),
                        "expo22": r(np.average(g22["expo"], weights=g22["fv"]), 1) if len(g22) else None,
                        "expo19": r(np.average(g19["expo"], weights=g19["fv"]), 1) if len(g19) else None,
                        "shareH": r((g["leg"] == "H").mean() * 100, 0),
                        "cap": r(g["fv"].sum() / lastU["fv"].sum() * 100, 1)})
    ind_tab.sort(key=lambda x: -x["expo"])
    (OUT / "names.json").write_text(json.dumps({"asOf": str(U["m"].max()), "top": topnames, "big": bignames,
                                                "ind": ind_tab}), encoding="utf-8")
    summary["legH_last"] = int((lastU["leg"] == "H").sum())
    summary["q80_last"] = r(lastU["expo"].quantile(0.8), 1)
    summary["q30_last"] = r(lastU["expo"].quantile(0.3), 1)

    # ---------------------------------------------- 9. a century of run-ups (Greenwood-Shleifer-You)
    gsy = run_gsy(rng)
    ai_inds = [x["ind"] for x in ind_tab[:6]]
    gsy["aiInds"] = ai_inds
    (OUT / "gsy.json").write_text(json.dumps(gsy), encoding="utf-8")

    summary["asOf"] = str(last)
    summary["hac"] = HAC
    (OUT / "summary.json").write_text(json.dumps(summary), encoding="utf-8")
    print(json.dumps(summary, indent=1))


def run_gsy(rng):
    """Greenwood, Shleifer & You (2019) on the Fama-French 49 value-weighted
    industries, 1926-2026. Run-up: trailing 24m return > threshold. Episode =
    first qualifying month with no episode in that industry in the prior 24m.
    Crash = the industry's cumulative return falls 40% below its episode-month
    level at any point in the next 24 months."""
    import statsmodels.api as sm
    txt = ff_zip("49_Industry_Portfolios_CSV.zip")
    R = ff_table(txt, "Average Value Weighted Returns -- Monthly") / 100
    NF = ff_table(txt, "Number of Firms in Portfolios")
    SZ = ff_table(txt, "Average Firm Size")
    BM = ff_table(txt, "Sum of BE / Sum of ME", datelen=4)
    ff3 = ff_table(ff_zip("F-F_Research_Data_Factors_CSV.zip")) / 100
    mkt = (ff3["Mkt-RF"] + ff3["RF"]).reindex(R.index)
    dtxt = ff_zip("49_Industry_Portfolios_daily_CSV.zip")
    D = ff_table(dtxt, "Average Value Weighted Returns -- Daily", datelen=8) / 100
    dvol = D.groupby(D.index.to_period("M")).std() * np.sqrt(252)
    vol12 = (D ** 2).groupby(D.index.to_period("M")).sum().rolling(12).sum() ** 0.5   # realized, trailing 12m
    CAP = NF * SZ
    share = CAP.div(CAP.sum(axis=1), axis=0)
    logbm = np.log(BM.where(BM > 0))
    relbm = logbm.sub(logbm.median(axis=1), axis=0)

    lr = np.log1p(R)
    lm = np.log1p(mkt)
    cum24 = np.expm1(lr.rolling(24).sum())
    cum12 = np.expm1(lr.rolling(12).sum())
    prev12 = np.expm1(lr.shift(12).rolling(12).sum())
    mk24 = np.expm1(lm.rolling(24).sum())
    net24 = cum24.sub(mk24, axis=0)
    idx = R.index
    n = len(idx)
    # forward paths
    L = lr.values

    def fwd_stats(i, j):
        f = L[i + 1:i + 25, j]
        if len(f) < 24 or not np.isfinite(f).all():
            return None
        path = np.exp(np.cumsum(f))
        fm = lm.values[i + 1:i + 25]
        return {"f12": float(path[11] - 1), "f24": float(path[23] - 1),
                "n24": float(path[23] - np.exp(np.sum(fm))),
                "n12": float(path[11] - np.exp(np.sum(fm[:12]))),
                "crash": bool(path.min() <= 0.6), "trough": float(path.min() - 1)}

    NFv = NF.values
    M_raw, M_net = cum24.values, net24.values

    def episodes(thr, net_thr=None, min_firms=10, since=None):
        """Run-up if the trailing 24m raw return > thr AND (optionally) the
        net-of-market return > net_thr; industries need >= min_firms."""
        out = []
        for j, ind in enumerate(R.columns):
            last_ev = -99
            for i in range(24, n):
                ok = np.isfinite(M_raw[i, j]) and M_raw[i, j] > thr
                if net_thr is not None:
                    ok = ok and np.isfinite(M_net[i, j]) and M_net[i, j] > net_thr
                ok = ok and np.isfinite(NFv[i, j]) and NFv[i, j] >= min_firms
                if not ok or i - last_ev <= 24:
                    continue
                last_ev = i
                p = idx[i]
                if since and str(p) < since:
                    continue
                yr = p.year if p.month >= 7 else p.year - 1   # BE/ME row formed each June
                ev = {"ind": ind, "date": str(p), "i": i, "j": j, "yr": p.year,
                      "run": float(M_raw[i, j]), "net": float(M_net[i, j]),
                      "vol": float(vol12.values[i, j]) if np.isfinite(vol12.values[i, j]) else None,
                      "accel": float(cum12.values[i, j] - prev12.values[i, j]),
                      "issue": float(np.log(NFv[i, j] / NFv[i - 24, j])) if NFv[i - 24, j] > 0 else None,
                      "dshare": float(np.log(share.values[i, j] / share.values[i - 24, j]))
                      if share.values[i - 24, j] > 0 else None,
                      "relbm": float(relbm.at[yr, ind]) if yr in relbm.index and np.isfinite(relbm.at[yr, ind]) else None,
                      "fwd": fwd_stats(i, j)}
                out.append(ev)
        return out

    def year_boot(evs, stat, B=4000):
        """Bootstrap that resamples calendar YEARS of episodes: run-ups and
        crashes cluster in time (Aug-2000 hits a dozen industries at once)."""
        yrs = sorted({e["yr"] for e in evs})
        by = {y: [e for e in evs if e["yr"] == y] for y in yrs}
        vals = []
        for _ in range(B):
            pick = rng.choice(len(yrs), len(yrs))
            s_ = [e for k in pick for e in by[yrs[k]]]
            vals.append(stat(s_))
        return np.percentile(vals, 2.5), np.percentile(vals, 97.5), len(yrs)

    # base rates: all industry-months (>= 10 firms) with a complete forward window
    base = [fwd_stats(i, j) for i in range(24, n) for j in range(R.shape[1])
            if np.isfinite(NFv[i, j]) and NFv[i, j] >= 10]
    base = [b for b in base if b]
    base_crash = np.mean([b["crash"] for b in base])
    base_f24 = np.mean([b["f24"] for b in base])
    base_n24 = np.mean([b["n24"] for b in base])
    base45 = [fwd_stats(i, j) for i in range(24, n) for j in range(R.shape[1])
              if str(idx[i]) >= "1945-01" and np.isfinite(NFv[i, j]) and NFv[i, j] >= 10]
    base45_crash = np.mean([b["crash"] for b in base45 if b])

    thr_tab = []
    specs = [("50% raw & net", 0.5, 0.5, None), ("100% raw & net (baseline)", 1.0, 1.0, None),
             ("150% raw & net", 1.5, 1.5, None), ("100% raw only", 1.0, None, None),
             ("100% raw & net, since 1945", 1.0, 1.0, "1945-01"),
             ("100% raw & net, since 1963", 1.0, 1.0, "1963-07")]
    for lab, thr, nthr, since in specs:
        evs = [e for e in episodes(thr, nthr, since=since) if e["fwd"]]
        cr = np.array([e["fwd"]["crash"] for e in evs], float)
        f24 = np.array([e["fwd"]["f24"] for e in evs])
        n24 = np.array([e["fwd"]["n24"] for e in evs])
        lo, hi, ny = year_boot(evs, lambda s_: np.mean([e["fwd"]["crash"] for e in s_]))
        nlo, nhi, _ = year_boot(evs, lambda s_: np.mean([e["fwd"]["n24"] for e in s_]), 2000)
        thr_tab.append({"label": lab, "n": len(evs), "years": ny, "crash": r(cr.mean() * 100, 0),
                        "lo": r(lo * 100, 0), "hi": r(hi * 100, 0),
                        "f24": r(np.mean(f24) * 100, 1), "n24": r(np.mean(n24) * 100, 1),
                        "nlo": r(nlo * 100, 1), "nhi": r(nhi * 100, 1),
                        "f24med": r(np.median(f24) * 100, 1), "pneg": r(np.mean(f24 < 0) * 100, 0)})

    # the baseline sample: characteristics of crashes vs non-crashes
    ev100 = [e for e in episodes(1.0, 1.0) if e["fwd"]]
    df = pd.DataFrame([{**{k: e[k] for k in ("ind", "date", "yr", "run", "net", "vol", "accel", "issue",
                                             "dshare", "relbm")},
                        "crash": int(e["fwd"]["crash"]), "f24": e["fwd"]["f24"], "n24": e["fwd"]["n24"],
                        "trough": e["fwd"]["trough"]} for e in ev100])
    chars = []
    for c, lab in (("run", "Run-up size (24m raw)"), ("vol", "Realized volatility (12m)"),
                   ("accel", "Acceleration (last 12m − prior 12m)"), ("issue", "Δ log number of firms (24m)"),
                   ("dshare", "Δ log share of market cap (24m)"), ("relbm", "log B/M vs median industry")):
        d = df.dropna(subset=[c])
        a, b = d.loc[d["crash"] == 1, c], d.loc[d["crash"] == 0, c]
        obs = a.mean() - b.mean()
        v = d[c].values
        yv = d["crash"].values
        perm = []
        for _ in range(5000):
            pz = rng.permutation(yv)
            perm.append(v[pz == 1].mean() - v[pz == 0].mean())
        p = float(np.mean(np.abs(perm) >= abs(obs)))
        z = (v - v.mean()) / v.std()
        try:
            lg = sm.Logit(yv, sm.add_constant(z)).fit(disp=0, cov_type="cluster",
                                                      cov_kwds={"groups": d["yr"].values})
            orat, lp = float(np.exp(lg.params[1])), float(lg.pvalues[1])
        except Exception:  # noqa: BLE001
            orat, lp = np.nan, np.nan
        chars.append({"key": c, "label": lab, "crash": r(a.mean(), 2), "nocrash": r(b.mean(), 2),
                      "p": r(p, 3), "or": r(orat, 2), "lp": r(lp, 3), "n": int(len(d))})

    # multivariate logit, pre-specified (size, volatility, acceleration,
    # issuance), year-clustered errors, leave-one-out AUC
    trip = ["run", "vol", "accel", "issue"]
    d = df.dropna(subset=trip).reset_index(drop=True)
    Zm = (d[trip] - d[trip].mean()) / d[trip].std()
    yv = d["crash"].values
    lg = sm.Logit(yv, sm.add_constant(Zm.values)).fit(disp=0, cov_type="cluster",
                                                      cov_kwds={"groups": d["yr"].values})
    loo = np.zeros(len(d))
    for k in range(len(d)):
        msk = np.arange(len(d)) != k
        mu, sd = d.loc[msk, trip].mean(), d.loc[msk, trip].std()
        Zk = ((d[trip] - mu) / sd).values
        try:
            fk = sm.Logit(yv[msk], sm.add_constant(Zk[msk])).fit(disp=0)
            loo[k] = fk.predict(np.r_[1.0, Zk[k]][None, :])[0]
        except Exception:  # noqa: BLE001
            loo[k] = yv[msk].mean()

    def auc(y, s):
        pos_, neg_ = s[y == 1], s[y == 0]
        return float(np.mean([(p_ > n_) + 0.5 * (p_ == n_) for p_ in pos_ for n_ in neg_]))
    multi = {"coef": {k: r(lg.params[i + 1], 2) for i, k in enumerate(trip)},
             "t": {k: r(lg.tvalues[i + 1], 2) for i, k in enumerate(trip)},
             "p": {k: r(lg.pvalues[i + 1], 3) for i, k in enumerate(trip)},
             "n": int(len(d)), "crashes": int(yv.sum()), "aucIn": r(auc(yv, lg.predict()), 2),
             "aucLoo": r(auc(yv, loo), 2), "mu": d[trip].mean().to_dict(), "sd": d[trip].std().to_dict()}

    # today: every industry's trailing 24m run-up, plus characteristics and fitted crash odds
    i_last = n - 1
    now = []
    for j, ind in enumerate(R.columns):
        if not np.isfinite(cum24.values[i_last, j]):
            continue
        if not (NFv[i_last, j] >= 10):
            continue
        x = {"run": cum24.values[i_last, j], "vol": vol12.values[i_last, j],
             "accel": cum12.values[i_last, j] - prev12.values[i_last, j],
             "issue": np.log(NF.values[i_last, j] / NF.values[i_last - 24, j]) if NF.values[i_last - 24, j] > 0 else np.nan}
        zv = np.array([(x[k] - multi["mu"][k]) / multi["sd"][k] for k in trip])
        ph = float(lg.predict(np.r_[1.0, zv][None, :])[0]) if np.isfinite(zv).all() else None
        # peak 24m run-up within the last 36 months (captures 2023-24 episodes already underway)
        peak = float(np.nanmax(cum24.values[i_last - 35:i_last + 1, j]))
        peak_n = float(np.nanmax(net24.values[i_last - 35:i_last + 1, j]))
        now.append({"ind": ind, "run": r(cum24.values[i_last, j] * 100, 0), "net": r(net24.values[i_last, j] * 100, 0),
                    "peak36": r(peak * 100, 0), "peakNet36": r(peak_n * 100, 0), "vol": r(x["vol"] * 100, 0), "accel": r(x["accel"] * 100, 0),
                    "issue": r(x["issue"] * 100, 0), "p": r(ph * 100, 0) if ph is not None else None,
                    "share": r(share.values[i_last, j] * 100, 1), "relbm": r(relbm.iloc[-1][ind], 2)})
    now.sort(key=lambda x: -(x["run"] or -999))

    # recent and named episodes
    named = []
    for e in episodes(1.0, 1.0):
        if e["date"] >= "1995-01" or e["ind"] in ("Chips", "Softw", "Hardw"):
            fs = e["fwd"]
            # realized path so far for episodes whose 24m window hasn't closed
            i, j = e["i"], e["j"]
            f = L[i + 1:, j]
            f = f[np.isfinite(f)][:24]
            path = np.exp(np.cumsum(f)) if len(f) else np.array([1.0])
            named.append({"ind": e["ind"], "date": e["date"], "run": r(e["run"] * 100, 0),
                          "vol": r((e["vol"] or np.nan) * 100, 0), "accel": r(e["accel"] * 100, 0),
                          "issue": r((e["issue"] if e["issue"] is not None else np.nan) * 100, 0),
                          "crash": fs["crash"] if fs else None, "f24": r(fs["f24"] * 100, 0) if fs else None,
                          "trough": r((path.min() - 1) * 100, 0), "sofar": r((path[-1] - 1) * 100, 0),
                          "months": int(len(f)), "open": fs is None})
    return {"start": str(idx[0]), "end": str(idx[-1]), "base": {"crash": r(base_crash * 100, 1),
            "f24": r(base_f24 * 100, 1), "n24": r(base_n24 * 100, 1), "n": len(base),
            "crash45": r(base45_crash * 100, 1)},
            "thr": thr_tab, "chars": chars, "multi": {k: v for k, v in multi.items() if k not in ("mu", "sd")},
            "now": now, "named": named,
            "episodes": [{"ind": a, "date": b, "run": r(c * 100, 0), "crash": int(d_), "f24": r(f * 100, 0)}
                         for a, b, c, d_, f in zip(df["ind"], df["date"], df["run"], df["crash"], df["f24"])]}


if __name__ == "__main__":
    fetch()
    if "--fetch" not in sys.argv:
        analyze()
