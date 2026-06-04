// Data + statistics engine for the research piece:
//   "Three Roads to ROE: What the Source of Profitability Predicts"
//
// Rebuild vs. v1 (per senior-quant review). v1 was a one-year accounting
// decomposition; this version is a panel study that tests whether the SOURCE of
// ROE predicts anything. Key upgrades:
//  - Multi-year EDGAR panel (2010–2025), AVERAGE beginning/ending balances for
//    every denominator (ROE, turnover, multiplier) — not ending-only.
//  - Separates the operating EQUITY MULTIPLIER (assets/equity, inflated by
//    buybacks) from TRUE financial leverage (net debt / equity, net debt /
//    EBITDA). The two are not the same, and the rate test below shows only the
//    latter is rate-sensitive — refuting v1's central error.
//  - Adds ROIC, operating profitability (RMW-style), gross profitability.
//  - Reproducible classifier: log(ROE)=log(margin)+log(turn)+log(mult); a firm's
//    "road" is the term whose deviation from the universe median is largest.
//  - Formal ROE Quality Score: z(ROE)+z(margin)+z(ROIC)−z(mult)−z(netDebt/EBITDA)
//    −z(marginVol). Sector-neutral z-scores too.
//  - Valuation overlay (trailing P/E, EV/EBITDA, FCF yield, ROIC) from EDGAR+price.
//  - FORWARD TESTS by driver group: forward 1y ROE retention, forward 12m return,
//    forward return volatility, max drawdown; plus a persistence regression.
//  - RATE test as long-short portfolios: high-minus-low equity-multiplier vs
//    high-minus-low true-leverage, regressed on [mkt, Δ10y] with HAC t.
//  - Return attribution: decade stock return → margin / revenue / buyback / multiple.
// Sources: SEC EDGAR companyfacts (XBRL, no key) + Yahoo monthly + FRED DGS10.
// Run: node scripts/research/profit-dupont.mjs

import fs from "node:fs";
import path from "node:path";

const UA = "quantamental-research anthonyhuang@aya.yale.edu";
const H = { "User-Agent": UA, Accept: "application/json" };
const OUT = path.join("content", "research", "2026-04-15-profit-dupont", "data");
const HAC_L = 6;

// ── Universe ─────────────────────────────────────────────────────────────────
// Selection rule (stated in the article): a fixed basket of large, continuously
// EDGAR- and price-listed US common stocks since 2009, spanning every GICS
// sector EX-Financials/Utilities/Real Estate (where asset turnover is not
// economically comparable). This is a survivor basket by construction — the
// survivorship caveat is confronted in the body, not buried.
const UNIVERSE = [
  ["AAPL", "Apple", "Technology"], ["MSFT", "Microsoft", "Technology"], ["NVDA", "NVIDIA", "Technology"],
  ["AVGO", "Broadcom", "Technology"], ["ORCL", "Oracle", "Technology"], ["CSCO", "Cisco", "Technology"],
  ["ACN", "Accenture", "Technology"], ["ADBE", "Adobe", "Technology"], ["CRM", "Salesforce", "Technology"],
  ["TXN", "Texas Instr.", "Technology"], ["QCOM", "Qualcomm", "Technology"], ["IBM", "IBM", "Technology"],
  ["GOOGL", "Alphabet", "Comm Services"], ["META", "Meta Platforms", "Comm Services"], ["NFLX", "Netflix", "Comm Services"],
  ["DIS", "Disney", "Comm Services"], ["CMCSA", "Comcast", "Comm Services"], ["VZ", "Verizon", "Comm Services"], ["T", "AT&T", "Comm Services"],
  ["AMZN", "Amazon", "Cons Discretionary"], ["HD", "Home Depot", "Cons Discretionary"], ["MCD", "McDonald's", "Cons Discretionary"],
  ["NKE", "Nike", "Cons Discretionary"], ["LOW", "Lowe's", "Cons Discretionary"], ["SBUX", "Starbucks", "Cons Discretionary"],
  ["TJX", "TJX Companies", "Cons Discretionary"], ["BKNG", "Booking", "Cons Discretionary"],
  ["WMT", "Walmart", "Cons Staples"], ["COST", "Costco", "Cons Staples"], ["PG", "Procter & Gamble", "Cons Staples"],
  ["KO", "Coca-Cola", "Cons Staples"], ["PEP", "PepsiCo", "Cons Staples"], ["MDLZ", "Mondelez", "Cons Staples"],
  ["CL", "Colgate", "Cons Staples"], ["MO", "Altria", "Cons Staples"], ["PM", "Philip Morris", "Cons Staples"],
  ["UNH", "UnitedHealth", "Health Care"], ["JNJ", "Johnson & Johnson", "Health Care"], ["LLY", "Eli Lilly", "Health Care"],
  ["MRK", "Merck", "Health Care"], ["ABBV", "AbbVie", "Health Care"], ["PFE", "Pfizer", "Health Care"],
  ["TMO", "Thermo Fisher", "Health Care"], ["ABT", "Abbott", "Health Care"], ["DHR", "Danaher", "Health Care"], ["AMGN", "Amgen", "Health Care"],
  ["XOM", "Exxon Mobil", "Energy"], ["CVX", "Chevron", "Energy"], ["COP", "ConocoPhillips", "Energy"], ["SLB", "Schlumberger", "Energy"],
  ["CAT", "Caterpillar", "Industrials"], ["DE", "Deere", "Industrials"], ["HON", "Honeywell", "Industrials"],
  ["UPS", "UPS", "Industrials"], ["BA", "Boeing", "Industrials"], ["GE", "GE Aerospace", "Industrials"],
  ["LMT", "Lockheed Martin", "Industrials"], ["UNP", "Union Pacific", "Industrials"],
  ["LIN", "Linde", "Materials"], ["SHW", "Sherwin-Williams", "Materials"], ["APD", "Air Products", "Materials"],
];

// ── XBRL tag fallback lists ──────────────────────────────────────────────────
const TAGS = {
  rev: ["RevenueFromContractWithCustomerExcludingAssessedTax", "Revenues", "RevenueFromContractWithCustomerIncludingAssessedTax", "SalesRevenueNet"],
  ni: ["NetIncomeLoss"],
  gp: ["GrossProfit"],
  oi: ["OperatingIncomeLoss"],
  assets: ["Assets"],
  eq: ["StockholdersEquity", "StockholdersEquityIncludingPortionAttributableToNoncontrollingInterest"],
  da: ["DepreciationDepletionAndAmortization", "DepreciationAmortizationAndAccretionNet", "DepreciationAndAmortization", "DepreciationDepletionAndAmortizationExcludingNonproductionAssets"],
  pretax: ["IncomeLossFromContinuingOperationsBeforeIncomeTaxesExtraordinaryItemsNoncontrollingInterest", "IncomeLossFromContinuingOperationsBeforeIncomeTaxesMinorityInterestAndIncomeLossFromEquityMethodInvestments"],
  tax: ["IncomeTaxExpenseBenefit"],
  ltdNC: ["LongTermDebtNoncurrent", "LongTermDebt"],
  ltdC: ["LongTermDebtCurrent"],
  std: ["ShortTermBorrowings", "DebtCurrent", "CommercialPaper"],
  cash: ["CashAndCashEquivalentsAtCarryingValue", "CashCashEquivalentsRestrictedCashAndRestrictedCashEquivalents"],
  sti: ["ShortTermInvestments", "MarketableSecuritiesCurrent", "AvailableForSaleSecuritiesCurrent"],
  ocf: ["NetCashProvidedByUsedInOperatingActivities", "NetCashProvidedByUsedInOperatingActivitiesContinuingOperations"],
  capex: ["PaymentsToAcquirePropertyPlantAndEquipment", "PaymentsToAcquireProductiveAssets"],
  buyback: ["PaymentsForRepurchaseOfCommonStock"],
  shares: ["WeightedAverageNumberOfDilutedSharesOutstanding", "WeightedAverageNumberOfSharesOutstandingBasic"],
};

// ── fetch helpers ────────────────────────────────────────────────────────────
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
async function facts(cik) {
  for (let t = 0; t < 4; t++) {
    try { const res = await fetch(`https://data.sec.gov/api/xbrl/companyfacts/CIK${cik}.json`, { headers: H }); if (res.ok) return (await res.json()).facts; } catch {}
    await sleep(500 * (t + 1));
  }
  return null;
}
async function yahooMonthly(sym) {
  const p1 = Math.floor(new Date("2008-01-01") / 1000), p2 = Math.floor(Date.now() / 1000);
  const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(sym)}?period1=${p1}&period2=${p2}&interval=1mo&events=div,split`;
  for (let t = 0; t < 4; t++) {
    try {
      const res = await fetch(url, { headers: { "User-Agent": "Mozilla/5.0", Accept: "application/json" } });
      if (res.ok) {
        const r = (await res.json())?.chart?.result?.[0];
        const ts = r?.timestamp ?? [], adj = r?.indicators?.adjclose?.[0]?.adjclose ?? r?.indicators?.quote?.[0]?.close ?? [];
        const m = new Map();
        for (let i = 0; i < ts.length; i++) if (typeof adj[i] === "number") m.set(new Date(ts[i] * 1000).toISOString().slice(0, 7), adj[i]);
        if (m.size) return m;
      }
    } catch {}
    await sleep(500 * (t + 1));
  }
  return new Map();
}
async function fredMonthly(id) {
  const url = `https://fred.stlouisfed.org/graph/fredgraph.csv?id=${id}&cosd=2008-01-01`;
  for (let t = 0; t < 5; t++) {
    try {
      const res = await fetch(url, { headers: { "User-Agent": "Mozilla/5.0" } });
      if (res.ok) { const m = new Map(); for (const ln of (await res.text()).trim().split("\n").slice(1)) { const [d, v] = ln.split(","); if (v && v !== ".") m.set(d.slice(0, 7), parseFloat(v)); } if (m.size) return m; }
    } catch {}
    await sleep(700 * (t + 1));
  }
  return new Map();
}

// ── XBRL extraction: annual (10-K) value at each fiscal-year end ──────────────
// Returns entries [{end, val, filed}] sorted desc by end, best tag per end.
function annual(f, key, flow) {
  const byEnd = new Map();
  for (const tag of TAGS[key]) {
    const units = f?.["us-gaap"]?.[tag]?.units;
    const node = units?.USD ?? units?.shares ?? (units ? units[Object.keys(units)[0]] : null);
    if (!node) continue;
    for (const e of node) {
      if (!/10-K/.test(e.form ?? "")) continue;
      if (flow) { const dur = e.start && e.end ? (new Date(e.end) - new Date(e.start)) / 86400000 : 0; if (!(dur > 340 && dur < 380)) continue; }
      const prev = byEnd.get(e.end);
      if (!prev || (e.filed ?? "") > (prev.filed ?? "")) byEnd.set(e.end, { end: e.end, val: e.val, filed: e.filed, tag });
    }
  }
  return [...byEnd.values()].sort((a, b) => new Date(b.end) - new Date(a.end));
}
const flowKeys = new Set(["rev", "ni", "gp", "oi", "da", "pretax", "tax", "ocf", "capex", "buyback", "shares"]);
const round = (x, n = 2) => (x == null || !Number.isFinite(x) ? null : Number(x.toFixed(n)));
const sharesLatest = (f) => { const n = f?.dei?.EntityCommonStockSharesOutstanding?.units?.shares; if (!n) return null; const tenK = n.filter((e) => /10-K/.test(e.form ?? "")); const arr = (tenK.length ? tenK : n).sort((a, b) => (a.end < b.end ? 1 : -1)); return arr[0]?.val ?? null; };

// ── stats / linear algebra (OLS + Newey-West HAC) ────────────────────────────
function meanSd(a) { const x = a.filter((v) => v != null && Number.isFinite(v)); if (x.length < 2) return { m: x[0] ?? 0, sd: 0, n: x.length }; const m = x.reduce((s, v) => s + v, 0) / x.length; const sd = Math.sqrt(x.reduce((s, v) => s + (v - m) ** 2, 0) / (x.length - 1)); return { m, sd, n: x.length }; }
function median(a) { const x = a.filter((v) => v != null && Number.isFinite(v)).sort((p, q) => p - q); if (!x.length) return null; const k = Math.floor(x.length / 2); return x.length % 2 ? x[k] : (x[k - 1] + x[k]) / 2; }
const zeros = (r, c) => Array.from({ length: r }, () => new Array(c).fill(0));
const T = (A) => A[0].map((_, j) => A.map((r) => r[j]));
function mm(A, B) { const r = A.length, k = B.length, c = B[0].length, C = zeros(r, c); for (let i = 0; i < r; i++) for (let l = 0; l < k; l++) { const a = A[i][l]; for (let j = 0; j < c; j++) C[i][j] += a * B[l][j]; } return C; }
function inv(A) { const n = A.length, M = A.map((row, i) => [...row, ...Array.from({ length: n }, (_, j) => (i === j ? 1 : 0))]); for (let c = 0; c < n; c++) { let p = c; for (let r = c + 1; r < n; r++) if (Math.abs(M[r][c]) > Math.abs(M[p][c])) p = r;[M[c], M[p]] = [M[p], M[c]]; const d = M[c][c]; if (Math.abs(d) < 1e-13) return null; for (let j = 0; j < 2 * n; j++) M[c][j] /= d; for (let r = 0; r < n; r++) { if (r === c) continue; const fct = M[r][c]; for (let j = 0; j < 2 * n; j++) M[r][j] -= fct * M[c][j]; } } return M.map((r) => r.slice(n)); }
function olsHAC(X, y, L = HAC_L) {
  const n = X.length; if (n < 24) return null; const k = X[0].length, Xt = T(X);
  const XtXi = inv(mm(Xt, X)); if (!XtXi) return null;
  const beta = mm(XtXi, mm(Xt, y.map((v) => [v]))).map((r) => r[0]);
  const e = y.map((yi, i) => yi - X[i].reduce((s, x, j) => s + x * beta[j], 0));
  const S = zeros(k, k), add = (c, xa, xb) => { for (let a = 0; a < k; a++) for (let b = 0; b < k; b++) S[a][b] += c * xa[a] * xb[b]; };
  for (let t = 0; t < n; t++) add(e[t] * e[t], X[t], X[t]);
  for (let l = 1; l <= L; l++) { const w = 1 - l / (L + 1); for (let t = l; t < n; t++) { const c = w * e[t] * e[t - l]; add(c, X[t], X[t - l]); add(c, X[t - l], X[t]); } }
  const V = mm(mm(XtXi, S), XtXi), se = V.map((r, i) => Math.sqrt(Math.max(r[i], 0)));
  const ybar = y.reduce((s, v) => s + v, 0) / n, sst = y.reduce((s, v) => s + (v - ybar) ** 2, 0), ssr = e.reduce((s, v) => s + v * v, 0);
  return { beta, se, t: beta.map((b, i) => (se[i] ? b / se[i] : 0)), r2: 1 - ssr / sst, n };
}
// plain OLS with classical SE (for the cross-sectional persistence panel)
function ols(X, y) {
  const n = X.length; if (n < X[0].length + 2) return null; const k = X[0].length, Xt = T(X);
  const XtXi = inv(mm(Xt, X)); if (!XtXi) return null;
  const beta = mm(XtXi, mm(Xt, y.map((v) => [v]))).map((r) => r[0]);
  const e = y.map((yi, i) => yi - X[i].reduce((s, x, j) => s + x * beta[j], 0));
  const ssr = e.reduce((s, v) => s + v * v, 0), sigma2 = ssr / (n - k);
  const V = XtXi.map((r) => r.map((v) => v * sigma2)), se = V.map((r, i) => Math.sqrt(Math.max(r[i], 0)));
  const ybar = y.reduce((s, v) => s + v, 0) / n, sst = y.reduce((s, v) => s + (v - ybar) ** 2, 0);
  return { beta, se, t: beta.map((b, i) => (se[i] ? b / se[i] : 0)), r2: 1 - ssr / sst, n };
}

fs.mkdirSync(OUT, { recursive: true });

// ── load CIK map ─────────────────────────────────────────────────────────────
const tk = await (await fetch("https://www.sec.gov/files/company_tickers.json", { headers: H })).json();
const cikMap = {}; for (const k in tk) cikMap[tk[k].ticker] = String(tk[k].cik_str).padStart(10, "0");
let DGS10 = await fredMonthly("DGS10");
if (!DGS10.size) { // FRED rate-limits its daily series; fall back to Yahoo ^TNX
  const tnx = await yahooMonthly("^TNX");
  const vals = [...tnx.values()];
  const med = vals.sort((a, b) => a - b)[Math.floor(vals.length / 2)] ?? 4;
  const scale = med > 20 ? 10 : 1; // ^TNX is sometimes quoted as 10× the yield
  DGS10 = new Map([...tnx].map(([k, v]) => [k, v / scale]));
  console.log(`DGS10 <- Yahoo ^TNX n=${DGS10.size} (scale ÷${scale}, median ${(med / scale).toFixed(2)}%)`);
}
const SPY = await yahooMonthly("SPY");
console.log(`DGS10 n=${DGS10.size}  SPY n=${SPY.size}`);

// A firm-year's ROE/equity-multiplier is "meaningful" only when the equity base
// is not buyback-shrunk to near zero; beyond ~15× the denominator is distorted
// and ROE ceases to measure profitability (the article's central refinement).
const MULT_CAP = 15;
const meaningfulROE = (mult, roe) => mult != null && mult > 0 && mult <= MULT_CAP && roe != null && Number.isFinite(roe) && Math.abs(roe) < 400;

// ── build the panel ──────────────────────────────────────────────────────────
// firm -> { ticker,name,sector, prices:Map, sharesNow, fy:[{year,end,filed, ...metrics}] }
const FIRMS = [];
for (const [ticker, name, sector] of UNIVERSE) {
  const cik = cikMap[ticker];
  const f = cik ? await facts(cik) : null;
  if (!f) { console.log(`${ticker} skip (no facts)`); continue; }
  const ser = {}; for (const key of Object.keys(TAGS)) ser[key] = annual(f, key, flowKeys.has(key));
  const at = (key, end) => { const e = ser[key].find((x) => x.end === end) ?? ser[key].filter((x) => new Date(x.end) <= new Date(end))[0]; return e ? e.val : null; };
  const niArr = ser.ni;
  if (niArr.length < 3) { console.log(`${ticker} skip (short history)`); continue; }
  const prices = await yahooMonthly(ticker);
  const sharesNow = sharesLatest(f);

  const fy = [];
  for (let i = 0; i < niArr.length; i++) {
    const end = niArr[i].end, prevEnd = niArr[i + 1]?.end ?? null, year = +end.slice(0, 4);
    if (year < 2009) continue;
    const ni = niArr[i].val, rev = at("rev", end), assets = at("assets", end), eq = at("eq", end);
    if (rev == null || assets == null || eq == null || !(rev > 0)) continue;
    const assetsPrev = prevEnd ? at("assets", prevEnd) : null, eqPrev = prevEnd ? at("eq", prevEnd) : null;
    const avgAssets = assetsPrev != null ? (assets + assetsPrev) / 2 : assets;
    const avgEq = eqPrev != null ? (eq + eqPrev) / 2 : eq;
    const oi = at("oi", end), gp = at("gp", end), da = at("da", end), pretax = at("pretax", end), tax = at("tax", end);
    const ltdNC = at("ltdNC", end) ?? 0, ltdC = at("ltdC", end) ?? 0, std = at("std", end) ?? 0;
    const totalDebt = ltdNC + ltdC + std;
    const cash = (at("cash", end) ?? 0) + (at("sti", end) ?? 0);
    const netDebt = totalDebt - cash;
    const ebitda = oi != null && da != null ? oi + da : null;
    const ocf = at("ocf", end), capex = at("capex", end);
    const fcf = ocf != null && capex != null ? ocf - capex : null;
    const effTax = pretax != null && tax != null && pretax > 0 ? Math.min(0.45, Math.max(0, tax / pretax)) : 0.21;
    const ebitForRoic = oi ?? pretax; // pharma/others often don't tag OperatingIncomeLoss; pre-tax income is a close proxy for low-leverage names
    const nopat = ebitForRoic != null ? ebitForRoic * (1 - effTax) : null;
    const investedCap = totalDebt + eq - (at("cash", end) ?? 0); // debt + equity − excess cash
    const investedCapPrev = prevEnd ? (at("ltdNC", prevEnd) ?? 0) + (at("ltdC", prevEnd) ?? 0) + (at("std", prevEnd) ?? 0) + (eqPrev ?? 0) - (at("cash", prevEnd) ?? 0) : null;
    const avgInvested = investedCapPrev != null && investedCap > 0 && investedCapPrev > 0 ? (investedCap + investedCapPrev) / 2 : investedCap;

    const equityMult = avgEq > 0 ? avgAssets / avgEq : null;
    const roe = avgEq > 0 ? (ni / avgEq) * 100 : null; // null when avg equity ≤ 0 (denominator breaks down)
    fy.push({
      year, end, filed: niArr[i].filed,
      revenue: rev, ni, oi, gp, assets, eq, avgAssets, avgEq, totalDebt, cash, netDebt, ebitda, fcf,
      shares: at("shares", end), buyback: at("buyback", end),
      netMargin: (ni / rev) * 100,
      opMargin: oi != null ? (oi / rev) * 100 : null,
      grossMargin: gp != null ? (gp / rev) * 100 : null,
      assetTurn: rev / avgAssets,
      equityMult, roe, roeOK: meaningfulROE(equityMult, roe),
      roa: (ni / avgAssets) * 100,
      roic: nopat != null && avgInvested > 0 ? (nopat / avgInvested) * 100 : null,
      grossProf: gp != null ? (gp / avgAssets) * 100 : null, // Novy-Marx gross profitability
      opProf: oi != null ? (oi / avgAssets) * 100 : null,
      netDebtEbitda: ebitda != null && ebitda > 0 ? netDebt / ebitda : null,
      netDebtEq: eq > 0 ? netDebt / eq : null,
      debtAssets: totalDebt / assets,
      negEquity: !(eq > 0),
    });
  }
  if (fy.length < 3) { console.log(`${ticker} skip (few usable FYs)`); continue; }
  FIRMS.push({ ticker, name, sector, prices, sharesNow, fy: fy.sort((a, b) => a.year - b.year) });
  process.stdout.write(`${ticker} `);
}
console.log(`\nloaded ${FIRMS.length} firms`);

// trailing margin volatility per firm-year (stdev of net margin, trailing ≤5y incl current)
for (const fm of FIRMS) for (let i = 0; i < fm.fy.length; i++) { const w = fm.fy.slice(Math.max(0, i - 4), i + 1).map((r) => r.netMargin); fm.fy[i].marginVol = w.length >= 3 ? meanSd(w).sd : null; }

// ── helper: latest fiscal year per firm + trailing-3y averaged ratios ─────────
function latest(fm) { return fm.fy[fm.fy.length - 1]; }
function trailing3(fm) {
  const last3 = fm.fy.slice(-3);
  const avg = (sel) => { const v = last3.map(sel).filter((x) => x != null && Number.isFinite(x)); return v.length ? v.reduce((a, b) => a + b, 0) / v.length : null; };
  const med = (sel) => median(last3.map(sel)); // robust to a single near-zero-equity year
  return {
    netMargin: avg((r) => r.netMargin), opMargin: avg((r) => r.opMargin), grossMargin: avg((r) => r.grossMargin),
    assetTurn: avg((r) => r.assetTurn), equityMult: med((r) => r.equityMult), roe: med((r) => r.roe),
    roic: avg((r) => r.roic), grossProf: avg((r) => r.grossProf), opProf: avg((r) => r.opProf),
    netDebtEbitda: avg((r) => r.netDebtEbitda), netDebtEq: avg((r) => r.netDebtEq), marginVol: latest(fm).marginVol,
  };
}

// ── log-decomposition classifier (reproducible) ──────────────────────────────
// For a cross-section, log(ROE)=log(margin)+log(turn)+log(mult). Each firm's
// "road" is the component whose deviation from the cross-section median log is
// largest; contribution shares = deviations normalised to sum to the ROE deviation.
function classify(rows) {
  // rows: [{key, margin, turn, mult}] with positive margin & mult
  const lm = rows.map((r) => Math.log(r.margin)), lt = rows.map((r) => Math.log(r.turn)), ll = rows.map((r) => Math.log(r.mult));
  const mm0 = median(lm), mt0 = median(lt), ml0 = median(ll);
  return rows.map((r, i) => {
    const dM = lm[i] - mm0, dT = lt[i] - mt0, dL = ll[i] - ml0;
    const tot = dM + dT + dL; // = logROE_i − medianLogROE
    const driver = dM >= dT && dM >= dL ? "margin" : dT >= dL ? "turnover" : "leverage";
    const denom = Math.abs(dM) + Math.abs(dT) + Math.abs(dL) || 1;
    return { key: r.key, driver, shareMargin: dM / denom, shareTurn: dT / denom, shareLev: dL / denom, dM, dT, dL, totLog: tot };
  });
}

// ── SNAPSHOT (latest FY, trailing-3y ratios) ─────────────────────────────────
const snap = FIRMS.map((fm) => {
  const L = latest(fm), t3 = trailing3(fm);
  const roeOK = meaningfulROE(t3.equityMult, t3.roe) && !L.negEquity;
  // distorted (buyback-shrunk) firms: ROE & multiplier are not meaningful — show ROIC/true-leverage instead
  return { ticker: fm.ticker, name: fm.name, sector: fm.sector, fye: L.end, year: L.year, revenue: L.revenue / 1e9, ...t3, roeOK, distorted: !roeOK, negEquity: L.negEquity, equityMultRaw: t3.equityMult, roe: roeOK ? t3.roe : null, equityMult: roeOK ? t3.equityMult : null };
});
// classify on trailing-3y ratios where ROE is meaningful & margin>0
const classRows = snap.filter((s) => s.roeOK && s.netMargin > 0 && s.equityMult > 0 && s.assetTurn > 0)
  .map((s) => ({ key: s.ticker, margin: s.netMargin, turn: s.assetTurn, mult: s.equityMult }));
const classes = new Map(classify(classRows).map((c) => [c.key, c]));
for (const s of snap) { const c = classes.get(s.ticker); s.driver = c?.driver ?? "n/m"; s.shareMargin = c ? round(c.shareMargin * 100, 0) : null; s.shareTurn = c ? round(c.shareTurn * 100, 0) : null; s.shareLev = c ? round(c.shareLev * 100, 0) : null; }

// ── ROE QUALITY SCORE (cross-sectional z) ────────────────────────────────────
function zmap(rows, sel) { const { m, sd } = meanSd(rows.map(sel)); return new Map(rows.map((r) => [r.ticker, sd ? ((sel(r) ?? m) - m) / sd : 0])); }
const qRows = snap.filter((s) => s.roe != null && s.roic != null);
const zRoe = zmap(qRows, (r) => r.roe), zMgn = zmap(qRows, (r) => r.netMargin), zRoic = zmap(qRows, (r) => r.roic),
  zMult = zmap(qRows, (r) => r.equityMult), zNde = zmap(qRows, (r) => r.netDebtEbitda ?? 0), zMv = zmap(qRows, (r) => r.marginVol ?? 0);
for (const s of qRows) s.quality = round((zRoe.get(s.ticker) + zMgn.get(s.ticker) + zRoic.get(s.ticker) - zMult.get(s.ticker) - zNde.get(s.ticker) - zMv.get(s.ticker)), 2);
// sector-neutral margin/turn/mult z (within sector)
const bySector = {}; for (const s of snap) (bySector[s.sector] ??= []).push(s);
for (const arr of Object.values(bySector)) { const zm = zmap(arr, (r) => r.netMargin), zt = zmap(arr, (r) => r.assetTurn), zl = zmap(arr, (r) => r.equityMult ?? 0); for (const s of arr) { s.zMarginSec = round(zm.get(s.ticker), 2); s.zTurnSec = round(zt.get(s.ticker), 2); s.zMultSec = round(zl.get(s.ticker), 2); } }

// round snapshot for output
const snapOut = snap.map((s) => ({
  ticker: s.ticker, name: s.name, sector: s.sector, fye: s.fye, revenue: round(s.revenue, 1),
  netMargin: round(s.netMargin, 1), opMargin: round(s.opMargin, 1), grossMargin: round(s.grossMargin, 1),
  assetTurn: round(s.assetTurn, 2), equityMult: round(s.equityMult, 2), roe: round(s.roe, 1), roic: round(s.roic, 1),
  grossProf: round(s.grossProf, 1), opProf: round(s.opProf, 1),
  netDebtEbitda: round(s.netDebtEbitda, 2), netDebtEq: round(s.netDebtEq, 2), marginVol: round(s.marginVol, 1),
  driver: s.driver, shareMargin: s.shareMargin, shareTurn: s.shareTurn, shareLev: s.shareLev,
  quality: s.quality ?? null, zMarginSec: s.zMarginSec, zTurnSec: s.zTurnSec, zMultSec: s.zMultSec,
  negEquity: s.negEquity, distorted: s.distorted, equityMultRaw: round(s.equityMultRaw, 1),
})).sort((a, b) => (b.roe ?? -999) - (a.roe ?? -999));
fs.writeFileSync(path.join(OUT, "companies.json"), JSON.stringify(snapOut));

// ── VALUATION OVERLAY (current price × EDGAR) ────────────────────────────────
const valuation = [];
for (const fm of FIRMS) {
  const L = latest(fm), t3 = trailing3(fm);
  const px = [...fm.prices.entries()].sort()[fm.prices.size - 1]?.[1] ?? [...fm.prices.values()].at(-1);
  if (!px || !fm.sharesNow) continue;
  const mcap = px * fm.sharesNow;
  const ev = mcap + L.totalDebt - L.cash;
  valuation.push({
    ticker: fm.ticker, sector: fm.sector, driver: classes.get(fm.ticker)?.driver ?? "n/m",
    pe: L.ni > 0 ? round(mcap / L.ni, 1) : null,
    evEbitda: L.ebitda > 0 ? round(ev / L.ebitda, 1) : null,
    fcfYield: L.fcf != null && mcap > 0 ? round((L.fcf / mcap) * 100, 1) : null,
    roic: round(t3.roic, 1), quality: snap.find((s) => s.ticker === fm.ticker)?.quality ?? null,
  });
}
fs.writeFileSync(path.join(OUT, "valuation.json"), JSON.stringify(valuation));

// ── FORWARD TESTS by driver group (panel 2010–2024) ──────────────────────────
// Each firm-year is classified (log-decomp vs that YEAR's cross-section median),
// then we measure forward outcomes. Returns are measured from 4 months after the
// fiscal-end (≈ filing) over the next 12 months (no look-ahead).
function monthAdd(ym, k) { const [y, m] = ym.split("-").map(Number); const d = new Date(y, m - 1 + k, 1); return d.toISOString().slice(0, 7); }
function fwdReturn(prices, startYM, months) {
  const a = prices.get(startYM); if (a == null) return null;
  const b = prices.get(monthAdd(startYM, months)); if (b == null) return null;
  return (b / a - 1) * 100;
}
function fwdPath(prices, startYM, months) { const out = []; for (let k = 0; k <= months; k++) { const v = prices.get(monthAdd(startYM, k)); if (v != null) out.push(v); } return out; }

// build per-year cross-sections and classify
const years = []; for (let y = 2010; y <= 2024; y++) years.push(y);
const panel = []; // {ticker, sector, year, driver, roe, roeNext, fwdRet, fwdVol, fwdMdd, fwdMarginVol, mult, netDebtEq, logMcap, priorRet}
for (const y of years) {
  const cross = [];
  for (const fm of FIRMS) {
    const r = fm.fy.find((x) => x.year === y); if (!r || !r.roeOK || r.netMargin <= 0) continue; // meaningful ROE only — excludes buyback-distorted denominators
    cross.push({ key: fm.ticker, margin: r.netMargin, turn: r.assetTurn, mult: r.equityMult, fm, r });
  }
  if (cross.length < 8) continue;
  const cls = new Map(classify(cross.map((c) => ({ key: c.key, margin: c.margin, turn: c.turn, mult: c.mult }))).map((c) => [c.key, c.driver]));
  for (const c of cross) {
    const fm = c.fm, r = c.r;
    const nextRaw = fm.fy.find((x) => x.year === y + 1);
    const next = nextRaw && nextRaw.roeOK ? nextRaw : null; // forward ROE only when next year's denominator is also meaningful
    const startYM = monthAdd(r.end.slice(0, 7), 4); // ≈ filing month
    const path = fwdPath(fm.prices, startYM, 12);
    let fwdVol = null, fwdMdd = null;
    if (path.length >= 8) {
      const rets = []; for (let i = 1; i < path.length; i++) rets.push(path[i] / path[i - 1] - 1);
      fwdVol = meanSd(rets).sd * Math.sqrt(12) * 100;
      let peak = path[0], mdd = 0; for (const p of path) { peak = Math.max(peak, p); mdd = Math.min(mdd, p / peak - 1); } fwdMdd = mdd * 100;
    }
    // prior 12m return (momentum control), ending at startYM
    const pr0 = fm.prices.get(monthAdd(startYM, -12)), pr1 = fm.prices.get(startYM);
    const priorRet = pr0 && pr1 ? (pr1 / pr0 - 1) * 100 : null;
    const fwdMarginVol = (() => { const w = []; for (let k = 1; k <= 3; k++) { const fyk = fm.fy.find((x) => x.year === y + k); if (fyk) w.push(fyk.netMargin); } return w.length >= 2 ? meanSd([r.netMargin, ...w]).sd : null; })();
    panel.push({
      ticker: fm.ticker, sector: fm.sector, year: y, driver: cls.get(c.key),
      roe: r.roe, roeNext: next?.roe ?? null, roeRetain: next?.roe != null && r.roe > 0 ? next.roe / r.roe : null,
      fwdRet: fwdReturn(fm.prices, startYM, 12), fwdVol, fwdMdd, fwdMarginVol,
      mult: r.equityMult, netDebtEq: r.netDebtEq, logMcap: null, priorRet,
    });
  }
}
// group medians
const groups = ["margin", "turnover", "leverage"];
const forwardGroups = groups.map((g) => {
  const rows = panel.filter((p) => p.driver === g);
  return {
    driver: g, n: rows.length,
    roeRetain: round(median(rows.map((r) => r.roeRetain)) * 100, 0),
    roeNextChg: round(median(rows.map((r) => (r.roeNext != null ? r.roeNext - r.roe : null))), 1),
    fwdRet: round(median(rows.map((r) => r.fwdRet)), 1),
    fwdVol: round(median(rows.map((r) => r.fwdVol)), 1),
    fwdMdd: round(median(rows.map((r) => r.fwdMdd)), 1),
    fwdMarginVol: round(median(rows.map((r) => r.fwdMarginVol)), 1),
  };
});
// persistence regression: roeNext ~ marginDriven + turnoverDriven (leverage omitted) + roe + logRev + sector FE
const persRows = panel.filter((p) => p.roeNext != null && p.roe != null);
const sectorsList = [...new Set(persRows.map((p) => p.sector))];
const Xp = [], yp = [];
for (const p of persRows) {
  const fe = sectorsList.slice(1).map((s) => (p.sector === s ? 1 : 0));
  Xp.push([1, p.driver === "margin" ? 1 : 0, p.driver === "turnover" ? 1 : 0, p.roe, ...fe]);
  yp.push(p.roeNext);
}
const persFit = ols(Xp, yp);
const persistence = persFit ? {
  marginVsLev: { est: round(persFit.beta[1], 2), t: round(persFit.t[1], 1) },
  turnoverVsLev: { est: round(persFit.beta[2], 2), t: round(persFit.t[2], 1) },
  roeLoad: { est: round(persFit.beta[3], 2), t: round(persFit.t[3], 1) },
  n: persFit.n, r2: round(persFit.r2, 2),
} : null;
fs.writeFileSync(path.join(OUT, "forward.json"), JSON.stringify({ groups: forwardGroups, persistence, nPanel: panel.length, years: [years[0], years.at(-1)] }));

// ── RATE TEST: long-short portfolios on multiplier vs true leverage ──────────
// Each month, rank firms (within the cross-section that has data filed ≥4m ago)
// by (a) equity multiplier and (b) net-debt/equity; sector-neutralised. HML =
// top tercile − bottom tercile, equal weight. Regress monthly HML on [mkt, Δ10y].
const allMonths = [...SPY.keys()].sort().filter((m) => m >= "2010-07" && m <= "2026-05");
const mktRet = new Map(); for (let i = 1; i < allMonths.length; i++) { const a = SPY.get(allMonths[i - 1]), b = SPY.get(allMonths[i]); if (a && b) mktRet.set(allMonths[i], (b / a - 1) * 100); }
const dY = new Map(); for (let i = 1; i < allMonths.length; i++) { const a = DGS10.get(allMonths[i - 1]), b = DGS10.get(allMonths[i]); if (a != null && b != null) dY.set(allMonths[i], b - a); }
// firm monthly return + as-of fundamentals (most recent FY filed ≥4 months before month)
function asOfFY(fm, ym) { const cut = monthAdd(ym, -4); let best = null; for (const r of fm.fy) { const fEnd = r.end.slice(0, 7); if (fEnd <= cut) best = r; } return best; }
function hmlSeries(selKey) {
  const out = new Map();
  for (let i = 1; i < allMonths.length; i++) {
    const ym = allMonths[i];
    const cross = [];
    for (const fm of FIRMS) {
      const r = asOfFY(fm, ym); if (!r) continue; const v = r[selKey]; if (v == null || !Number.isFinite(v)) continue;
      const p0 = fm.prices.get(allMonths[i - 1]), p1 = fm.prices.get(ym); if (!p0 || !p1) continue;
      cross.push({ sector: fm.sector, v, ret: (p1 / p0 - 1) * 100 });
    }
    if (cross.length < 12) continue;
    // sector-neutralise: subtract sector mean of v
    const secMean = {}; const secCnt = {};
    for (const c of cross) { secMean[c.sector] = (secMean[c.sector] ?? 0) + c.v; secCnt[c.sector] = (secCnt[c.sector] ?? 0) + 1; }
    for (const s in secMean) secMean[s] /= secCnt[s];
    for (const c of cross) c.adj = c.v - secMean[c.sector];
    cross.sort((a, b) => a.adj - b.adj);
    const k = Math.max(3, Math.floor(cross.length / 3));
    const low = cross.slice(0, k), high = cross.slice(-k);
    const mean = (a) => a.reduce((s, x) => s + x.ret, 0) / a.length;
    out.set(ym, mean(high) - mean(low));
  }
  return out;
}
function rateReg(hml) {
  const X = [], y = [];
  for (const ym of allMonths) { const h = hml.get(ym), mk = mktRet.get(ym), d = dY.get(ym); if (h == null || mk == null || d == null) continue; X.push([1, mk, d]); y.push(h); }
  const f = olsHAC(X, y); return f ? { alpha: round(f.beta[0], 2), mkt: round(f.beta[1], 2), tMkt: round(f.t[1], 1), rate: round(f.beta[2], 2), tRate: round(f.t[2], 1), n: f.n } : null;
}
const multHML = hmlSeries("equityMult"), levHML = hmlSeries("netDebtEq");
// cross-sectional: does the equity multiplier measure financial leverage? (no)
function corr(a, b) { const xs = [], ys = []; for (let i = 0; i < a.length; i++) if (a[i] != null && b[i] != null && Number.isFinite(a[i]) && Number.isFinite(b[i])) { xs.push(a[i]); ys.push(b[i]); } const n = xs.length; if (n < 5) return null; const mx = xs.reduce((s, v) => s + v, 0) / n, my = ys.reduce((s, v) => s + v, 0) / n; let sxy = 0, sxx = 0, syy = 0; for (let i = 0; i < n; i++) { const dx = xs[i] - mx, dy = ys[i] - my; sxy += dx * dy; sxx += dx * dx; syy += dy * dy; } return { r: round(sxy / Math.sqrt(sxx * syy), 2), n }; }
const multArr = snapOut.map((s) => s.equityMultRaw), ndeArr = snapOut.map((s) => s.netDebtEbitda), ndeqArr = snapOut.map((s) => s.netDebtEq);
const corrMultNde = corr(multArr, ndeArr), corrMultNdeq = corr(multArr, ndeqArr);
// among the meaningful-ROE firms ranked by ROE, how many top names carry NET CASH?
const topRoeFirms = snapOut.filter((s) => s.roe != null).slice(0, 15);
const netCashTop = topRoeFirms.filter((s) => s.netDebtEbitda != null && s.netDebtEbitda < 0.5).length;
const rates = {
  equityMult: rateReg(multHML), trueLev: rateReg(levHML),
  corrMultNde, corrMultNdeq, netCashTop, nTop: topRoeFirms.length,
  note: "rate beta = % HML return per +100bp Δ10y; HAC t (Newey-West, 6 lags). corr = cross-sectional correlation across the universe.",
};
fs.writeFileSync(path.join(OUT, "rates.json"), JSON.stringify(rates));

// ── RETURN ATTRIBUTION: decade stock return → margin / revenue / buyback / multiple
// Δlog(price) = Δlog(netMargin) + Δlog(revenue) − Δlog(shares) + Δlog(P/E), per firm 2015→latest.
const attrib = [];
for (const fm of FIRMS) {
  const a = fm.fy.find((x) => x.year === 2015) ?? fm.fy[0], b = latest(fm);
  if (!a || !b || a.year >= b.year || a.netMargin <= 0 || b.netMargin <= 0 || !a.shares || !b.shares) continue;
  const pA = fm.prices.get(`${a.year + 1}-04`), pB = fm.prices.get(`${b.year + 1}-04`) ?? [...fm.prices.values()].at(-1);
  if (!pA || !pB) continue;
  const epsA = (a.ni / a.shares), epsB = (b.ni / b.shares); if (!(epsA > 0 && epsB > 0)) continue;
  const peA = pA / epsA, peB = pB / epsB; if (!(peA > 0 && peB > 0)) continue;
  const dPrice = Math.log(pB / pA), dMargin = Math.log(b.netMargin / a.netMargin), dRev = Math.log(b.revenue / a.revenue), dShares = -Math.log(b.shares / a.shares), dPE = Math.log(peB / peA);
  attrib.push({ ticker: fm.ticker, yrs: b.year - a.year, dPrice, dMargin, dRev, dShares, dPE });
}
const attrMed = (sel) => round(median(attrib.map(sel)) * 100, 0);
const attribution = {
  nFirms: attrib.length, fromYear: 2015,
  median: { price: attrMed((a) => a.dPrice), margin: attrMed((a) => a.dMargin), revenue: attrMed((a) => a.dRev), buyback: attrMed((a) => a.dShares), multiple: attrMed((a) => a.dPE) },
};
fs.writeFileSync(path.join(OUT, "attribution.json"), JSON.stringify(attribution));

// ── SECTORS + MARGIN TREND (basket-scoped, survivorship-flagged) ─────────────
const secAgg = {};
for (const s of snapOut) { const a = (secAgg[s.sector] ??= { sector: s.sector, ni: 0, rev: 0, roes: [], n: 0 }); a.ni += (s.netMargin / 100) * s.revenue; a.rev += s.revenue; if (s.roe != null) a.roes.push(s.roe); a.n++; }
const sectors = Object.values(secAgg).map((a) => ({ sector: a.sector, netMargin: round((a.ni / a.rev) * 100, 1), medianRoe: round(median(a.roes), 1), n: a.n })).sort((a, b) => b.netMargin - a.netMargin);
fs.writeFileSync(path.join(OUT, "sectors.json"), JSON.stringify(sectors));

const trendAgg = new Map();
for (const fm of FIRMS) for (const r of fm.fy) { if (r.year < 2015 || r.year > 2025) continue; const cur = trendAgg.get(r.year) ?? { ni: 0, rev: 0, oi: 0, oiRev: 0 }; cur.ni += r.ni; cur.rev += r.revenue; if (r.oi != null) { cur.oi += r.oi; cur.oiRev += r.revenue; } trendAgg.set(r.year, cur); }
const trend = [...trendAgg.entries()].sort((a, b) => a[0] - b[0]).map(([year, v]) => ({ year: String(year), netMargin: round((v.ni / v.rev) * 100, 1), opMargin: v.oiRev > 0 ? round((v.oi / v.oiRev) * 100, 1) : null }));
fs.writeFileSync(path.join(OUT, "margin_trend.json"), JSON.stringify(trend));

// ── SUMMARY ─────────────────────────────────────────────────────────────────
const negEq = snapOut.filter((s) => s.negEquity).map((s) => s.ticker);
const summary = {
  asOf: "2026-04-15", nFirms: FIRMS.length, nPanel: panel.length, years: [years[0], years.at(-1)],
  topQuality: [...qRows].sort((a, b) => b.quality - a.quality).slice(0, 5).map((s) => ({ t: s.ticker, q: round(s.quality, 2), driver: s.driver })),
  forwardGroups, persistence, rates, attribution, negEquity: negEq,
  trendEnds: { first: trend[0], last: trend.at(-1) },
};
fs.writeFileSync(path.join(OUT, "summary.json"), JSON.stringify(summary, null, 2));

// ── console ──────────────────────────────────────────────────────────────────
console.log("\n=== SNAPSHOT (top 12 by ROE, trailing-3y avg) ===");
for (const s of snapOut.slice(0, 12)) console.log(`${s.ticker.padEnd(5)} ROE ${String(s.roe).padStart(6)} nm ${String(s.netMargin).padStart(5)} at ${String(s.assetTurn).padStart(5)} mult ${String(s.equityMult).padStart(5)} ndE ${String(s.netDebtEq).padStart(6)} roic ${String(s.roic).padStart(5)} Q ${String(s.quality).padStart(5)} ${s.driver}`);
console.log("\nneg-equity firms (ROE N/M):", negEq.join(" "));
console.log("\n=== FORWARD TESTS by driver ===");
for (const g of forwardGroups) console.log(`${g.driver.padEnd(9)} n=${String(g.n).padStart(4)}  ROE retain ${g.roeRetain}%  fwd12m ret ${g.fwdRet}%  vol ${g.fwdVol}%  maxDD ${g.fwdMdd}%  fwdMarginVol ${g.fwdMarginVol}`);
console.log("persistence (vs leverage-driven):", JSON.stringify(persistence));
console.log("\n=== RATE TEST (HML portfolios) ===");
console.log("equity-multiplier HML:", JSON.stringify(rates.equityMult));
console.log("true-leverage  HML:", JSON.stringify(rates.trueLev));
console.log(`corr(mult, netDebt/EBITDA)=${JSON.stringify(corrMultNde)}  corr(mult, netDebt/equity)=${JSON.stringify(corrMultNdeq)}  net-cash in top ${rates.nTop} ROE: ${netCashTop}`);
console.log("\n=== RETURN ATTRIBUTION (median, since 2015) ===", JSON.stringify(attribution.median));
console.log("\n=== MARGIN TREND ===", trend.map((t) => `${t.year}:${t.netMargin}%`).join("  "));
console.log(`\nwrote JSON to ${OUT}`);
