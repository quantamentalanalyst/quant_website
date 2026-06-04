// Data + statistics engine for the macro-driver piece:
//   "Macro Regimes, Not Macro Prints: A Growth × Inflation Framework
//    for Equity Allocation"
//
// Rebuild vs. v1 (per senior-quant review). The single most important change is
// that the regime classification is now built on EXPANDING-WINDOW (real-time)
// standardization — at each month t the growth composite is z-scored using only
// data available through t — so the headline "regime sorts forward returns"
// result is no longer contaminated by look-ahead. Other upgrades:
//  - Block-bootstrap 95% CIs on every regime cell mean (returns overlap and
//    regimes persist, so the effective sample is far smaller than n).
//  - Newey-West HAC regression of forward 3m returns on regime dummies
//    (stagflation omitted) → are the spreads statistically real?
//  - A robustness grid: 3m vs 6m momentum, core CPI vs core PCE, YoY vs 3m-ann
//    growth, equal-weight vs PCA composite, full-sample vs expanding vs rolling
//    z, ex-COVID, ex-GFC, price vs total return, and leave-one-growth-series-out.
//  - Unconditional lead-lag with an effective-n (overlap) correction, plus a
//    pre/post-2022 split that separates the Fed reaction function from
//    state-dependent risk premia.
//  - A hard/soft divergence factor (z(hard) − z(Michigan)) sorted into quintiles.
//  - Regime-conditioned forward returns for style/size/cyclical factor spreads
//    and the best/worst sector tilt per regime.
//  - A tradeable allocation backtest driven by the real-time regime label
//    (CAGR, vol, Sharpe, max DD, hit, worst 12m, turnover, by decade).
// Sources: FRED (no key) + Yahoo (SPY, S&P 500 TR, factor/sector ETFs).
// Run: node scripts/research/macro-regime.mjs

import fs from "node:fs";
import path from "node:path";

const UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/124.0 Safari/537.36";
const FRED_START = "1990-01-01"; // burn-in so the 2000+ expanding z-scores have ~10y of history
const SAMPLE0 = "2000-01";       // analysis sample start (equities + ETFs available)
const END = "2026-05-31";
const OUT = path.join("content", "research", "2026-05-30-macro-regime", "data");
const HAC_L = 6;                 // Newey-West lag: covers the 3m-return overlap (MA(2)) + regime persistence

// ── fetchers ────────────────────────────────────────────────────────────────
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
async function fredRaw(id, tries = 5) {
  const url = `https://fred.stlouisfed.org/graph/fredgraph.csv?id=${id}&cosd=${FRED_START}&coed=${END}`;
  for (let t = 0; t < tries; t++) {
    try {
      const res = await fetch(url, { headers: { "User-Agent": UA } });
      if (res.ok) {
        const out = [];
        for (const line of (await res.text()).trim().split("\n").slice(1)) {
          const [d, v] = line.split(",");
          if (v && v !== ".") out.push({ date: d, val: parseFloat(v) });
        }
        if (out.length) return out;
      }
    } catch { /* retry */ }
    await sleep(800 * (t + 1));
  }
  return null;
}
// Resample to month-end (last observation in each calendar month). Map<YYYY-MM,val>.
function toMonthly(rows) {
  const m = new Map();
  if (!rows) return m;
  for (const r of rows) m.set(r.date.slice(0, 7), r.val);
  return m;
}
async function fredM(id) { return toMonthly(await fredRaw(id)); }

async function yahooMonthly(sym) {
  const p1 = Math.floor(new Date("1990-01-01") / 1000), p2 = Math.floor(new Date(END) / 1000);
  const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(sym)}?period1=${p1}&period2=${p2}&interval=1mo`;
  for (let t = 0; t < 4; t++) {
    try {
      const res = await fetch(url, { headers: { "User-Agent": UA, Accept: "application/json" } });
      if (res.ok) {
        const r = (await res.json())?.chart?.result?.[0];
        const ts = r?.timestamp ?? [], cl = r?.indicators?.quote?.[0]?.close ?? [];
        const m = new Map();
        for (let i = 0; i < ts.length; i++) if (typeof cl[i] === "number") m.set(new Date(ts[i] * 1000).toISOString().slice(0, 7), cl[i]);
        if (m.size) return m;
      }
    } catch { /* retry */ }
    await sleep(600 * (t + 1));
  }
  return new Map();
}

// ── load FRED ────────────────────────────────────────────────────────────────
const S = {};
const want = {
  PAYEMS: "PAYEMS", UNRATE: "UNRATE", ICSA: "ICSA",
  CPI: "CPIAUCSL", CORECPI: "CPILFESL", PCE: "PCEPI", COREPCE: "PCEPILFE",
  RSAFS: "RSAFS", INDPRO: "INDPRO", FEDFUNDS: "FEDFUNDS", T10Y3M: "T10Y3M",
  NFCI: "NFCI", UMCSENT: "UMCSENT", VIX: "VIXCLS", SAHM: "SAHMCURRENT",
  PHILLY: "GACDFSA066MSFRBPHI", TB3MS: "TB3MS",
};
for (const [k, id] of Object.entries(want)) {
  S[k] = await fredM(id);
  console.log(`${k.padEnd(9)} ${id.padEnd(20)} ${S[k].size ? `n=${S[k].size}` : "UNAVAILABLE"}`);
  await sleep(650);
}
if (!S.VIX.size) { S.VIX = await yahooMonthly("^VIX"); console.log(`VIX  <- Yahoo ^VIX  n=${S.VIX.size}`); }

// ── load Yahoo (equities + factor/sector ETFs, monthly) ──────────────────────
const SPY = await yahooMonthly("SPY");
const SPXTR = await yahooMonthly("^SP500TR"); // S&P 500 total-return index (dividends reinvested)
const ETF = {};
const etfList = ["IWF", "IWD", "IWM", "IWB", "RSP", "IEF", "GLD",
  "XLK", "XLF", "XLE", "XLU", "XLP", "XLY", "XLI", "XLV", "XLB"];
for (const s of etfList) { ETF[s] = await yahooMonthly(s); process.stdout.write(`${s}:${ETF[s].size} `); }
console.log(`\nSPY:${SPY.size} SP500TR:${SPXTR.size}`);

// ── month grid + transforms ──────────────────────────────────────────────────
const months = (() => {
  const out = []; let d = new Date(FRED_START); const end = new Date(END);
  while (d <= end) { out.push(d.toISOString().slice(0, 7)); d = new Date(d.getFullYear(), d.getMonth() + 1, 1); }
  return out;
})();
const idxOf = new Map(months.map((m, i) => [m, i]));
const prevYM = (ym, n) => { const [y, m] = ym.split("-").map(Number); const d = new Date(y, m - 1 - n, 1); return d.toISOString().slice(0, 7); };
const yoy = (map, ym) => { const a = map.get(ym), b = map.get(prevYM(ym, 12)); return a != null && b ? (a / b - 1) * 100 : null; };
const mom = (map, ym) => { const a = map.get(ym), b = map.get(prevYM(ym, 1)); return a != null && b ? (a / b - 1) * 100 : null; };
const ann3 = (map, ym) => { const a = map.get(ym), c = map.get(prevYM(ym, 3)); return a != null && c && a / c > 0 ? ((a / c) ** 4 - 1) * 100 : null; };
const nz = (x) => (Object.is(x, -0) ? 0 : x);
const round = (x, n = 2) => (x == null || !Number.isFinite(x) ? null : nz(Number(x.toFixed(n))));
function meanSd(arr) { const a = arr.filter((x) => x != null); if (!a.length) return { m: 0, sd: 0, n: 0 }; const m = a.reduce((s, x) => s + x, 0) / a.length; const sd = Math.sqrt(a.reduce((s, x) => s + (x - m) ** 2, 0) / a.length); return { m, sd, n: a.length }; }
function pearson(xs, ys) {
  const n = xs.length; const mx = xs.reduce((s, x) => s + x, 0) / n, my = ys.reduce((s, y) => s + y, 0) / n;
  let sxy = 0, sxx = 0, syy = 0;
  for (let i = 0; i < n; i++) { const dx = xs[i] - mx, dy = ys[i] - my; sxy += dx * dy; sxx += dx * dx; syy += dy * dy; }
  return sxx && syy ? sxy / Math.sqrt(sxx * syy) : 0;
}

// ── linear algebra + OLS/HAC (Newey-West, Bartlett) ──────────────────────────
const zeros = (r, c) => Array.from({ length: r }, () => new Array(c).fill(0));
const transpose = (A) => A[0].map((_, j) => A.map((row) => row[j]));
function matmul(A, B) { const r = A.length, k = B.length, c = B[0].length, C = zeros(r, c); for (let i = 0; i < r; i++) for (let l = 0; l < k; l++) { const a = A[i][l]; for (let j = 0; j < c; j++) C[i][j] += a * B[l][j]; } return C; }
function inv(A) {
  const n = A.length, M = A.map((row, i) => [...row, ...Array.from({ length: n }, (_, j) => (i === j ? 1 : 0))]);
  for (let col = 0; col < n; col++) {
    let piv = col; for (let r = col + 1; r < n; r++) if (Math.abs(M[r][col]) > Math.abs(M[piv][col])) piv = r;
    [M[col], M[piv]] = [M[piv], M[col]];
    const d = M[col][col]; if (Math.abs(d) < 1e-13) return null;
    for (let j = 0; j < 2 * n; j++) M[col][j] /= d;
    for (let r = 0; r < n; r++) { if (r === col) continue; const f = M[r][col]; for (let j = 0; j < 2 * n; j++) M[r][j] -= f * M[col][j]; }
  }
  return M.map((row) => row.slice(n));
}
function olsHAC(X, y, L = HAC_L) {
  const n = X.length; if (n < 24) return null;
  const k = X[0].length, Xt = transpose(X);
  const XtXinv = inv(matmul(Xt, X)); if (!XtXinv) return null;
  const Xty = matmul(Xt, y.map((v) => [v])).map((r) => r[0]);
  const beta = matmul(XtXinv, Xty.map((v) => [v])).map((r) => r[0]);
  const e = y.map((yi, i) => yi - X[i].reduce((s, xij, j) => s + xij * beta[j], 0));
  const Sm = zeros(k, k);
  const addOuter = (c, xa, xb) => { for (let a = 0; a < k; a++) for (let b = 0; b < k; b++) Sm[a][b] += c * xa[a] * xb[b]; };
  for (let t = 0; t < n; t++) addOuter(e[t] * e[t], X[t], X[t]);
  for (let l = 1; l <= L; l++) { const w = 1 - l / (L + 1); for (let t = l; t < n; t++) { const c = w * e[t] * e[t - l]; addOuter(c, X[t], X[t - l]); addOuter(c, X[t - l], X[t]); } }
  const V = matmul(matmul(XtXinv, Sm), XtXinv);
  const se = V.map((row, i) => Math.sqrt(Math.max(row[i], 0)));
  const tstat = beta.map((b, i) => (se[i] ? b / se[i] : 0));
  return { beta, se, t: tstat, n };
}

fs.mkdirSync(OUT, { recursive: true });

// ── z-score series (three standardization regimes) ───────────────────────────
// Returns an array aligned to `months`. method: 'full' | 'exp' | 'roll'(120m).
function zSeries(getter, method) {
  const vals = months.map(getter);
  if (method === "full") { const { m, sd } = meanSd(vals); return vals.map((v) => (v == null || !sd ? null : (v - m) / sd)); }
  const out = new Array(months.length).fill(null);
  for (let i = 0; i < months.length; i++) {
    if (vals[i] == null) continue;
    const lo = method === "roll" ? Math.max(0, i - 119) : 0;
    const win = vals.slice(lo, i + 1).filter((x) => x != null); // through t (inclusive)
    if (win.length < 24) continue;
    const { m, sd } = meanSd(win);
    if (sd) out[i] = (vals[i] - m) / sd;
  }
  return out;
}
const GROWTH = { INDPRO: S.INDPRO, PAYEMS: S.PAYEMS, RSAFS: S.RSAFS };
const growthZ = {}; // growthZ[method][series] = array
for (const method of ["full", "exp", "roll"]) {
  growthZ[method] = {};
  for (const [k, map] of Object.entries(GROWTH)) growthZ[method][k] = zSeries((ym) => yoy(map, ym), method);
}
// 3m-annualized variant (full + exp) for the growth-transform robustness row
const growthZann = { full: {}, exp: {} };
for (const method of ["full", "exp"]) for (const [k, map] of Object.entries(GROWTH)) growthZann[method][k] = zSeries((ym) => ann3(map, ym), method);

// PCA leading eigenvector of the three full-sample z YoY series → composite weights
function pcaWeights() {
  const rows = [];
  for (let i = 0; i < months.length; i++) {
    const v = [growthZ.full.INDPRO[i], growthZ.full.PAYEMS[i], growthZ.full.RSAFS[i]];
    if (v.every((x) => x != null)) rows.push(v);
  }
  const C = zeros(3, 3);
  for (const r of rows) for (let a = 0; a < 3; a++) for (let b = 0; b < 3; b++) C[a][b] += r[a] * r[b] / rows.length;
  let v = [1, 1, 1];
  for (let it = 0; it < 200; it++) { const nv = [0, 0, 0]; for (let a = 0; a < 3; a++) for (let b = 0; b < 3; b++) nv[a] += C[a][b] * v[b]; const nrm = Math.hypot(...nv); v = nv.map((x) => x / nrm); }
  if (v.reduce((s, x) => s + x, 0) < 0) v = v.map((x) => -x); // orient so "up" = growth up
  return v;
}
const PCAW = pcaWeights();

// Build a growth composite array under given options.
function growthComposite({ method = "exp", transform = "yoy", weight = "ew", drop = null }) {
  const z = transform === "ann3" ? growthZann[method === "roll" ? "exp" : method] : growthZ[method];
  const keys = Object.keys(GROWTH).filter((k) => k !== drop);
  return months.map((_, i) => {
    if (weight === "pca") { // PCA only defined for the equal full set, yoy
      const v = [z.INDPRO[i], z.PAYEMS[i], z.RSAFS[i]];
      if (v.some((x) => x == null)) return null;
      return PCAW[0] * v[0] + PCAW[1] * v[1] + PCAW[2] * v[2];
    }
    const a = keys.map((k) => z[k][i]).filter((x) => x != null);
    return a.length ? a.reduce((s, x) => s + x, 0) / a.length : null;
  });
}

// ── forward returns ──────────────────────────────────────────────────────────
function fwd3Map(px) { const m = new Map(); for (const ym of months) { const a = px.get(ym), b = px.get(prevYM(ym, -3)); if (a && b) m.set(ym, (b / a - 1) * 100); } return m; }
const fwdPrice = fwd3Map(SPY);
const fwdTotal = SPXTR.size ? fwd3Map(SPXTR) : fwdPrice;

// ── regime assignment for a set of options ───────────────────────────────────
const inSample = (ym) => ym >= SAMPLE0;
const REG_NAMES = { "G↑ I↓": "Goldilocks", "G↑ I↑": "Reflation", "G↓ I↑": "Stagflation", "G↓ I↓": "Slowdown" };
function classify(opts) {
  const gc = growthComposite(opts);
  const inflMap = opts.infl === "pce" ? S.COREPCE : S.CORECPI;
  const gLag = opts.gLag ?? 3, iLag = opts.iLag ?? 3;
  const fwd = opts.returns === "total" ? fwdTotal : fwdPrice;
  const drop = opts.sampleDrop; // fn(ym)->bool to exclude
  const labels = [], rets = [], ms = [];
  let current = null;
  for (let i = 12; i < months.length; i++) {
    const ym = months[i];
    const gNow = gc[i], gPast = gc[i - gLag];
    const iNow = yoy(inflMap, ym), iPast = yoy(inflMap, months[i - iLag]);
    if (gNow == null || gPast == null || iNow == null || iPast == null) continue;
    const gUp = gNow >= gPast, iUp = iNow > iPast;
    const key = `${gUp ? "G↑" : "G↓"} ${iUp ? "I↑" : "I↓"}`;
    // most recent classifiable month (for the live call) — regardless of sample/return
    current = { ym, key, name: REG_NAMES[key], gNow, gPast, iNow, iPast };
    if (!inSample(ym)) continue;
    if (drop && drop(ym)) continue;
    const fr = fwd.get(ym);
    if (fr == null) continue;
    labels.push(REG_NAMES[key]); rets.push(fr); ms.push(ym);
  }
  return { labels, rets, ms, current };
}
const GROUPS = ["Reflation", "Goldilocks", "Slowdown", "Stagflation"];
function cellStats(labels, rets) {
  const out = {};
  for (const g of GROUPS) {
    const xs = rets.filter((_, i) => labels[i] === g);
    out[g] = xs.length ? { mean: xs.reduce((a, b) => a + b, 0) / xs.length, hit: xs.filter((x) => x > 0).length / xs.length * 100, n: xs.length } : { mean: null, hit: null, n: 0 };
  }
  return out;
}

// ── block bootstrap (circular, L=6) for cell-mean CIs ────────────────────────
function blockBootstrap(labels, rets, B = 3000, L = 6) {
  const N = labels.length;
  const dist = Object.fromEntries(GROUPS.map((g) => [g, []]));
  for (let b = 0; b < B; b++) {
    const sum = Object.fromEntries(GROUPS.map((g) => [g, [0, 0]]));
    let filled = 0;
    while (filled < N) {
      const start = Math.floor(Math.random() * N);
      for (let j = 0; j < L && filled < N; j++) { const idx = (start + j) % N; const g = labels[idx]; sum[g][0] += rets[idx]; sum[g][1]++; filled++; }
    }
    for (const g of GROUPS) if (sum[g][1] > 0) dist[g].push(sum[g][0] / sum[g][1]);
  }
  const out = {};
  for (const g of GROUPS) { const a = dist[g].sort((x, y) => x - y); const m = a.reduce((s, x) => s + x, 0) / a.length; const sd = Math.sqrt(a.reduce((s, x) => s + (x - m) ** 2, 0) / a.length); out[g] = { se: sd, lo: a[Math.floor(0.025 * a.length)], hi: a[Math.floor(0.975 * a.length)] }; }
  return out;
}

// ── HEADLINE regime (expanding window, YoY, equal-weight, core CPI, price) ────
const headOpts = { method: "exp", transform: "yoy", weight: "ew", infl: "cpi", returns: "price" };
const head = classify(headOpts);
const headCells = cellStats(head.labels, head.rets);
const boot = blockBootstrap(head.labels, head.rets);
// effective n: 3m overlap → ~/3 (and regimes persist; this is a generous upper bound)
const regime = GROUPS.map((g) => ({
  key: Object.keys(REG_NAMES).find((k) => REG_NAMES[k] === g),
  name: g,
  mean: round(headCells[g].mean, 1),
  se: round(boot[g].se, 2),
  lo: round(boot[g].lo, 1), hi: round(boot[g].hi, 1),
  hit: round(headCells[g].hit, 0),
  n: headCells[g].n, nEff: Math.round(headCells[g].n / 3),
})).sort((a, b) => b.mean - a.mean);
fs.writeFileSync(path.join(OUT, "regime.json"), JSON.stringify(regime));

// ── HAC regression: fwd3 ~ Reflation + Slowdown + Goldilocks (stag omitted) ──
function regimeRegression(labels, rets) {
  const X = [], y = [];
  for (let i = 0; i < labels.length; i++) {
    const g = labels[i];
    X.push([1, g === "Reflation" ? 1 : 0, g === "Slowdown" ? 1 : 0, g === "Goldilocks" ? 1 : 0]);
    y.push(rets[i]);
  }
  const f = olsHAC(X, y, HAC_L);
  // single contrast: not-stagflation vs stagflation
  const Xc = labels.map((g) => [1, g === "Stagflation" ? 0 : 1]);
  const fc = olsHAC(Xc, rets, HAC_L);
  return {
    stagMean: round(f.beta[0], 2), stagT: round(f.t[0], 1),
    contrasts: [
      { name: "Reflation − Stagflation", est: round(f.beta[1], 2), t: round(f.t[1], 1) },
      { name: "Slowdown − Stagflation", est: round(f.beta[2], 2), t: round(f.t[2], 1) },
      { name: "Goldilocks − Stagflation", est: round(f.beta[3], 2), t: round(f.t[3], 1) },
    ],
    joint: { name: "Non-stagflation − Stagflation", est: round(fc.beta[1], 2), t: round(fc.t[1], 1) },
    hacLag: HAC_L, n: labels.length,
  };
}
const regReg = regimeRegression(head.labels, head.rets);
fs.writeFileSync(path.join(OUT, "regime_reg.json"), JSON.stringify(regReg));

// ── ROBUSTNESS GRID ──────────────────────────────────────────────────────────
const isCovid = (ym) => ym >= "2020-02" && ym <= "2021-04";
const isGFC = (ym) => ym >= "2008-06" && ym <= "2009-12";
function variantRow(label, opts) {
  const { labels, rets } = classify({ ...headOpts, ...opts });
  const c = cellStats(labels, rets);
  const means = GROUPS.map((g) => c[g].mean);
  const stag = c.Stagflation.mean;
  const others = ["Reflation", "Goldilocks", "Slowdown"].map((g) => c[g].mean);
  const minOther = Math.min(...others);
  return {
    label,
    refl: round(c.Reflation.mean, 1), gold: round(c.Goldilocks.mean, 1),
    slow: round(c.Slowdown.mean, 1), stag: round(stag, 1),
    n: rets.length,
    stagLowest: stag <= Math.min(...means),
    stagOnlyNeg: stag < 0 && others.every((m) => m > 0),
    spread: round(others.reduce((a, b) => a + b, 0) / 3 - stag, 1),
    margin: round(minOther - stag, 1), // worst non-stag minus stag (>0 ⇒ stag still last)
  };
}
const robustness = [
  variantRow("Baseline (expanding z, 3m, YoY, EW, core CPI, price)", {}),
  variantRow("6-month growth/inflation momentum", { gLag: 6, iLag: 6 }),
  variantRow("Inflation = core PCE", { infl: "pce" }),
  variantRow("Growth = 3-month annualized", { transform: "ann3" }),
  variantRow("Growth composite = PCA-weighted", { weight: "pca" }),
  variantRow("Full-sample z (look-ahead)", { method: "full" }),
  variantRow("Rolling 10-year z", { method: "roll" }),
  variantRow("Ex-COVID (drop 2020-02…2021-04)", { sampleDrop: isCovid }),
  variantRow("Ex-GFC (drop 2008-06…2009-12)", { sampleDrop: isGFC }),
  variantRow("S&P 500 total return", { returns: "total" }),
  variantRow("Drop industrial production", { drop: "INDPRO" }),
  variantRow("Drop payrolls", { drop: "PAYEMS" }),
  variantRow("Drop retail sales", { drop: "RSAFS" }),
];
fs.writeFileSync(path.join(OUT, "robustness.json"), JSON.stringify(robustness));

// ── UNCONDITIONAL LEAD-LAG (level + 3m change) with effective-n correction ───
function corrWith(getter, sign = 1) {
  const xs = [], ys = [];
  for (const ym of months) { if (!inSample(ym)) continue; const x = getter(ym), y = fwdPrice.get(ym); if (x != null && y != null) { xs.push(x * sign); ys.push(y); } }
  if (xs.length < 36) return null;
  const r = pearson(xs, ys);
  const n = xs.length, nEff = Math.max(4, Math.round(n / 3));
  const tEff = r * Math.sqrt((nEff - 2) / Math.max(1e-9, 1 - r * r));
  return { corr: round(r, 2), n, nEff, tEff: round(tEff, 1) };
}
function chg3(map, ym) { const a = yoy(map, ym), b = yoy(map, prevYM(ym, 3)); return a != null && b != null ? a - b : null; }
const leadDefs = [
  ["Initial claims", (ym) => S.ICSA.get(ym), (ym) => { const a = S.ICSA.get(ym), b = S.ICSA.get(prevYM(ym, 3)); return a != null && b != null ? a - b : null; }],
  ["Unemployment rate", (ym) => S.UNRATE.get(ym), (ym) => { const a = S.UNRATE.get(ym), b = S.UNRATE.get(prevYM(ym, 3)); return a != null && b != null ? a - b : null; }],
  ["VIX", (ym) => S.VIX.get(ym), (ym) => { const a = S.VIX.get(ym), b = S.VIX.get(prevYM(ym, 3)); return a != null && b != null ? a - b : null; }],
  ["Michigan sentiment", (ym) => S.UMCSENT.get(ym), (ym) => { const a = S.UMCSENT.get(ym), b = S.UMCSENT.get(prevYM(ym, 3)); return a != null && b != null ? a - b : null; }],
  ["Retail sales YoY", (ym) => yoy(S.RSAFS, ym), (ym) => chg3(S.RSAFS, ym)],
  ["Industrial prod. YoY", (ym) => yoy(S.INDPRO, ym), (ym) => chg3(S.INDPRO, ym)],
  ["Payrolls YoY", (ym) => yoy(S.PAYEMS, ym), (ym) => chg3(S.PAYEMS, ym)],
  ["Core CPI YoY", (ym) => yoy(S.CORECPI, ym), (ym) => chg3(S.CORECPI, ym)],
  ["Fin. conditions (NFCI)", (ym) => S.NFCI.get(ym), (ym) => { const a = S.NFCI.get(ym), b = S.NFCI.get(prevYM(ym, 3)); return a != null && b != null ? a - b : null; }],
];
const leadlag = leadDefs.map(([label, lvl, chg]) => {
  const L = corrWith(lvl), C = corrWith(chg);
  return { label, corr: L?.corr ?? null, corrChg: C?.corr ?? null, n: L?.n ?? null, nEff: L?.nEff ?? null, tEff: L?.tEff ?? null };
}).filter((r) => r.corr != null).sort((a, b) => b.corr - a.corr);
fs.writeFileSync(path.join(OUT, "leadlag.json"), JSON.stringify(leadlag));

// reaction-function vs state-dependent-risk-premium: split the "wrong sign" leaders pre/post-2022
function corrSplit(getter, lo, hi) {
  const xs = [], ys = [];
  for (const ym of months) { if (ym < lo || ym > hi) continue; const x = getter(ym), y = fwdPrice.get(ym); if (x != null && y != null) { xs.push(x); ys.push(y); } }
  return xs.length >= 18 ? round(pearson(xs, ys), 2) : null;
}
const reaction = {
  claims: { pre: corrSplit((ym) => S.ICSA.get(ym), "2000-01", "2021-12"), post: corrSplit((ym) => S.ICSA.get(ym), "2022-01", END) },
  vix: { pre: corrSplit((ym) => S.VIX.get(ym), "2000-01", "2021-12"), post: corrSplit((ym) => S.VIX.get(ym), "2022-01", END) },
  unrate: { pre: corrSplit((ym) => S.UNRATE.get(ym), "2000-01", "2021-12"), post: corrSplit((ym) => S.UNRATE.get(ym), "2022-01", END) },
};
fs.writeFileSync(path.join(OUT, "reaction.json"), JSON.stringify(reaction));

// ── HARD/SOFT DIVERGENCE FACTOR ──────────────────────────────────────────────
// hard composite = mean expanding-z of {INDPRO YoY, PAYEMS YoY, RSAFS YoY, −UNRATE level, −ICSA level};
// soft = expanding-z of Michigan sentiment. gap = z(hard) − z(soft).
const zUnrate = zSeries((ym) => S.UNRATE.get(ym), "exp");
const zClaims = zSeries((ym) => S.ICSA.get(ym), "exp");
const zMich = zSeries((ym) => S.UMCSENT.get(ym), "exp");
const hardComposite = months.map((_, i) => {
  const parts = [growthZ.exp.INDPRO[i], growthZ.exp.PAYEMS[i], growthZ.exp.RSAFS[i],
    zUnrate[i] == null ? null : -zUnrate[i], zClaims[i] == null ? null : -zClaims[i]].filter((x) => x != null);
  return parts.length >= 4 ? parts.reduce((s, x) => s + x, 0) / parts.length : null;
});
const gapSeries = months.map((_, i) => (hardComposite[i] != null && zMich[i] != null ? hardComposite[i] - zMich[i] : null));
const gapRows = [];
for (let i = 0; i < months.length; i++) { if (!inSample(months[i])) continue; const g = gapSeries[i], fr = fwdPrice.get(months[i]); if (g != null && fr != null) gapRows.push({ ym: months[i], gap: g, fr }); }
gapRows.sort((a, b) => a.gap - b.gap);
const qn = Math.floor(gapRows.length / 5);
const hardsoftQuint = [];
for (let q = 0; q < 5; q++) {
  const slice = gapRows.slice(q * qn, q === 4 ? gapRows.length : (q + 1) * qn);
  const xs = slice.map((r) => r.fr);
  hardsoftQuint.push({ q: q + 1, mean: round(xs.reduce((a, b) => a + b, 0) / xs.length, 1), hit: round(xs.filter((x) => x > 0).length / xs.length * 100, 0), n: xs.length, gapLo: round(slice[0].gap, 2), gapHi: round(slice.at(-1).gap, 2) });
}
// current gap (latest available month)
const lastGapI = months.map((m, i) => (gapSeries[i] != null ? i : -1)).filter((i) => i >= 0).at(-1);
const hardsoft = { quint: hardsoftQuint, currentGap: round(gapSeries[lastGapI], 2), currentHardZ: round(hardComposite[lastGapI], 2), currentMichZ: round(zMich[lastGapI], 2), asOf: months[lastGapI] };
fs.writeFileSync(path.join(OUT, "hardsoft.json"), JSON.stringify(hardsoft));

// ── REGIME-CONDITIONED FACTOR / SECTOR FORWARD RETURNS ───────────────────────
// Use the headline (expanding-window) regime label at each month; forward 3m
// relative return of each long-short spread.
function fwd3Rel(longPx, shortPx) {
  const m = new Map();
  for (const ym of months) {
    const la = longPx.get(ym), lb = longPx.get(prevYM(ym, -3)), sa = shortPx.get(ym), sb = shortPx.get(prevYM(ym, -3));
    if (la && lb && sa && sb) m.set(ym, ((lb / la - 1) - (sb / sa - 1)) * 100);
  }
  return m;
}
const labelAt = new Map(head.ms.map((ym, i) => [ym, head.labels[i]]));
function regimeMeans(relMap) {
  const acc = Object.fromEntries(GROUPS.map((g) => [g, []]));
  let n = 0;
  for (const [ym, g] of labelAt) { const v = relMap.get(ym); if (v != null) { acc[g].push(v); n++; } }
  const out = {}; for (const g of GROUPS) out[g] = acc[g].length ? round(acc[g].reduce((a, b) => a + b, 0) / acc[g].length, 1) : null;
  return { byRegime: out, n };
}
const cyc = ["XLY", "XLF", "XLI", "XLB", "XLE"], def = ["XLP", "XLU", "XLV"];
function basket(syms) { const m = new Map(); for (const ym of months) { const v = syms.map((s) => ETF[s]?.get(ym)).filter((x) => x != null); if (v.length === syms.length) m.set(ym, v.reduce((a, b) => a + b, 0) / v.length); } return m; }
function basketFwdRel(longSyms, shortSyms) {
  const m = new Map();
  for (const ym of months) {
    const lr = []; const sr = [];
    for (const s of longSyms) { const a = ETF[s]?.get(ym), b = ETF[s]?.get(prevYM(ym, -3)); if (a && b) lr.push(b / a - 1); }
    for (const s of shortSyms) { const a = ETF[s]?.get(ym), b = ETF[s]?.get(prevYM(ym, -3)); if (a && b) sr.push(b / a - 1); }
    if (lr.length === longSyms.length && sr.length === shortSyms.length) m.set(ym, (lr.reduce((a, b) => a + b, 0) / lr.length - sr.reduce((a, b) => a + b, 0) / sr.length) * 100);
  }
  return m;
}
const factorSpreads = [
  { label: "Value − Growth (IWD−IWF)", ...regimeMeans(fwd3Rel(ETF.IWD, ETF.IWF)) },
  { label: "Small − Large (IWM−IWB)", ...regimeMeans(fwd3Rel(ETF.IWM, ETF.IWB)) },
  { label: "Cyclicals − Defensives", ...regimeMeans(basketFwdRel(cyc, def)) },
  { label: "Equal-wt − Cap-wt (RSP−SPY)", ...(() => { const m = new Map(); for (const ym of months) { const la = ETF.RSP?.get(ym), lb = ETF.RSP?.get(prevYM(ym, -3)), sa = SPY.get(ym), sb = SPY.get(prevYM(ym, -3)); if (la && lb && sa && sb) m.set(ym, ((lb / la - 1) - (sb / sa - 1)) * 100); } return regimeMeans(m); })() },
];
// best / worst single-sector tilt per regime (forward 3m absolute return)
const sectorList = ["XLK", "XLF", "XLE", "XLU", "XLP", "XLY", "XLI", "XLV", "XLB"];
const sectorFwd = {}; for (const s of sectorList) sectorFwd[s] = fwd3Map(ETF[s]);
const sectorByRegime = {}; // regime -> {sym:meanFwd}
for (const g of GROUPS) sectorByRegime[g] = {};
for (const [ym, g] of labelAt) for (const s of sectorList) { const v = sectorFwd[s].get(ym); if (v != null) (sectorByRegime[g][s] ??= []).push(v); }
const sectorTilt = GROUPS.map((g) => {
  const means = sectorList.map((s) => ({ sym: s, ret: sectorByRegime[g][s]?.length ? sectorByRegime[g][s].reduce((a, b) => a + b, 0) / sectorByRegime[g][s].length : null })).filter((x) => x.ret != null).sort((a, b) => b.ret - a.ret);
  return { regime: g, best: means[0] ? { sym: means[0].sym, ret: round(means[0].ret, 1) } : null, worst: means.at(-1) ? { sym: means.at(-1).sym, ret: round(means.at(-1).ret, 1) } : null };
});
fs.writeFileSync(path.join(OUT, "factors.json"), JSON.stringify({ spreads: factorSpreads, sectorTilt, n: factorSpreads[0].n }));

// ── ALLOCATION BACKTEST (tradeable, real-time regime) ────────────────────────
// Regime at month t (expanding-window label) sets next-month weights.
const WEIGHTS = {
  Reflation: { SPY: 1.0 }, Goldilocks: { SPY: 1.0 },
  Slowdown: { SPY: 0.75, IEF: 0.25 },
  Stagflation: { SPY: 0.40, IEF: 0.20, GLD: 0.20, CASH: 0.20 },
};
function mret(px, ym) { const a = px.get(prevYM(ym, 1)), b = px.get(ym); return a && b ? b / a - 1 : null; }
const BT0 = "2005-01"; // GLD inception is 2004-11; start once all sleeves exist
const btMonths = months.filter((m) => m >= BT0 && m <= "2026-05");
let stratEq = 1, spyEq = 1, prevW = null, turnoverSum = 0, turnoverCnt = 0;
const curve = []; const stratR = [], spyR = [];
let cashAnnAvg = [];
for (let k = 1; k < btMonths.length; k++) {
  const tm = btMonths[k - 1]; // decision month
  const ym = btMonths[k];     // return month
  const lab = labelAt.get(tm) || head.labels[head.ms.indexOf(tm)];
  const w = WEIGHTS[lab] || { SPY: 1.0 };
  // turnover
  if (prevW) { let d = 0; for (const a of ["SPY", "IEF", "GLD", "CASH"]) d += Math.abs((w[a] || 0) - (prevW[a] || 0)); turnoverSum += d / 2; turnoverCnt++; }
  prevW = w;
  const rSPY = mret(SPY, ym) ?? 0;
  const rIEF = mret(ETF.IEF, ym) ?? 0;
  const rGLD = mret(ETF.GLD, ym) ?? 0;
  const rCash = (S.TB3MS.get(ym) ?? S.TB3MS.get(prevYM(ym, 1)) ?? 2) / 100 / 12;
  cashAnnAvg.push((S.TB3MS.get(ym) ?? 2));
  const rPort = (w.SPY || 0) * rSPY + (w.IEF || 0) * rIEF + (w.GLD || 0) * rGLD + (w.CASH || 0) * rCash;
  stratEq *= 1 + rPort; spyEq *= 1 + rSPY;
  stratR.push(rPort); spyR.push(rSPY);
  curve.push({ date: ym + "-01", strat: round(stratEq, 4), spy: round(spyEq, 4) });
}
function perf(rets, eqEnd, nMonths, rfMonthly) {
  const cagr = (eqEnd ** (12 / nMonths) - 1) * 100;
  const m = rets.reduce((a, b) => a + b, 0) / rets.length;
  const sd = Math.sqrt(rets.reduce((s, x) => s + (x - m) ** 2, 0) / rets.length);
  const vol = sd * Math.sqrt(12) * 100;
  const sharpe = sd ? (m - rfMonthly) / sd * Math.sqrt(12) : 0;
  // max drawdown + worst rolling 12m on the equity path
  let eq = 1, peak = 1, mdd = 0; const path = [1];
  for (const r of rets) { eq *= 1 + r; path.push(eq); peak = Math.max(peak, eq); mdd = Math.min(mdd, eq / peak - 1); }
  let worst12 = Infinity; for (let i = 12; i < path.length; i++) worst12 = Math.min(worst12, path[i] / path[i - 12] - 1);
  const hit = rets.filter((x) => x > 0).length / rets.length * 100;
  return { cagr: round(cagr, 1), vol: round(vol, 1), sharpe: round(sharpe, 2), maxdd: round(mdd * 100, 1), worst12: round(worst12 * 100, 1), hit: round(hit, 0) };
}
const rfM = (cashAnnAvg.reduce((a, b) => a + b, 0) / cashAnnAvg.length) / 100 / 12;
const nM = stratR.length;
// by-decade CAGR
function decadeCAGR(rets, mlist) {
  const buckets = {};
  for (let i = 0; i < rets.length; i++) { const y = +mlist[i + 1].slice(0, 4); const d = y < 2010 ? "2005–09" : y < 2020 ? "2010–19" : "2020–26"; (buckets[d] ??= []).push(rets[i]); }
  const out = {};
  for (const [d, rs] of Object.entries(buckets)) { let eq = 1; for (const r of rs) eq *= 1 + r; out[d] = round((eq ** (12 / rs.length) - 1) * 100, 1); }
  return out;
}
const alloc = {
  start: BT0, end: "2026-05",
  strategy: { ...perf(stratR, stratEq, nM, rfM), byDecade: decadeCAGR(stratR, btMonths), turnover: round(turnoverSum / turnoverCnt * 100, 0) },
  spy: { ...perf(spyR, spyEq, nM, rfM), byDecade: decadeCAGR(spyR, btMonths) },
  curve, weights: WEIGHTS, rfAnn: round(rfM * 12 * 100, 1),
};
fs.writeFileSync(path.join(OUT, "alloc.json"), JSON.stringify(alloc));

// ── CURRENT-REGIME CONFIDENCE (real-time, expanding window) ──────────────────
const gcExp = growthComposite({ method: "exp", transform: "yoy", weight: "ew" });
const cur = head.current;
const ci = idxOf.get(cur.ym);
const gChg = gcExp[ci] - gcExp[ci - 3];
const iChg = cur.iNow - cur.iPast;
// historical dispersion of the 3m changes (in-sample) → express current move in σ and percentile
const gChgHist = [], iChgHist = [];
for (let i = 15; i < months.length; i++) { if (!inSample(months[i])) continue; if (gcExp[i] != null && gcExp[i - 3] != null) gChgHist.push(gcExp[i] - gcExp[i - 3]); const a = yoy(S.CORECPI, months[i]), b = yoy(S.CORECPI, months[i - 3]); if (a != null && b != null) iChgHist.push(a - b); }
function pctile(arr, v) { const a = [...arr].sort((x, y) => x - y); let c = 0; for (const x of a) if (Math.abs(x) <= Math.abs(v)) c++; return c / a.length; }
const gSd = meanSd(gChgHist).sd, iSd = meanSd(iChgHist).sd;
const gStrength = pctile(gChgHist, gChg), iStrength = pctile(iChgHist, iChg);
const confScore = Math.min(gStrength, iStrength);
const strengthLabel = (p) => (p >= 0.66 ? "strong" : p >= 0.33 ? "moderate" : "weak");
const confidence = {
  asOf: cur.ym, regime: cur.name,
  growth: { dir: gChg >= 0 ? "accelerating" : "decelerating", sigma: round(gChg / gSd, 2), strength: strengthLabel(gStrength) },
  infl: { dir: iChg > 0 ? "rising" : "falling", sigma: round(iChg / iSd, 2), strength: strengthLabel(iStrength) },
  confidence: confScore >= 0.66 ? "high" : confScore >= 0.33 ? "moderate" : "low",
  confPct: round(confScore * 100, 0),
};
fs.writeFileSync(path.join(OUT, "confidence.json"), JSON.stringify(confidence));

// ── DASHBOARD (latest, 1y ago, trailing-10y z, data-driven interpretation) ───
function dash(label, map, kind, unit, decimals, interp) {
  const ks = [...map.keys()].sort(); const last = ks.at(-1); if (!last) return null;
  const series = ks.map((ym) => (kind === "yoy" ? yoy(map, ym) : kind === "mom" ? mom(map, ym) : map.get(ym)));
  const lastVal = series.at(-1);
  const i12 = ks.indexOf(prevYM(last, 12)); const prior = i12 >= 0 ? series[i12] : null;
  const tail = series.slice(-120).filter((x) => x != null); const { m, sd } = meanSd(tail);
  return { label, unit, last: round(lastVal, decimals), prior: round(prior, decimals), z: round(sd ? (lastVal - m) / sd : 0, 2), asOf: last, interp: interp(lastVal, prior) };
}
const ICSAk = new Map([...S.ICSA].map(([k, v]) => [k, v / 1000])); // claims in thousands for display
const dashboard = [
  dash("Core CPI", S.CORECPI, "yoy", "% YoY", 1, (v) => v > 2.5 ? "above the 2% target" : "near target"),
  dash("Core PCE", S.COREPCE, "yoy", "% YoY", 1, (v, p) => v > p ? "re-accelerating" : "easing"),
  dash("CPI", S.CPI, "yoy", "% YoY", 1, (v) => v > 3 ? "headline sticky" : "contained"),
  dash("Unemployment", S.UNRATE, "level", "%", 1, (v) => v < 4.5 ? "cooling, not breaking" : "loosening"),
  dash("Initial claims", ICSAk, "level", "k", 0, (v) => v < 250 ? "labor stress low" : "rising stress"),
  dash("Payrolls", S.PAYEMS, "mom", "% MoM", 2, (v) => v > 0 ? "still adding jobs" : "shedding jobs"),
  dash("Retail sales", S.RSAFS, "yoy", "% YoY", 1, (v) => v > 3 ? "consumer resilient" : "consumer softening"),
  dash("Industrial prod.", S.INDPRO, "yoy", "% YoY", 1, (v) => v > 0 ? "goods cycle positive" : "goods cycle contracting"),
  dash("Mfg pulse (Philly)", S.PHILLY, "level", "idx", 1, (v) => v > 0 ? "factory expansion" : "factory soft"),
  dash("Sahm rule", S.SAHM, "level", "pp", 2, (v) => v < 0.5 ? "recession trigger dormant" : "recession signal"),
  dash("Fed funds", S.FEDFUNDS, "level", "%", 2, (v, p) => v < p ? "easing cycle" : "restrictive"),
  dash("Fin. conditions", S.NFCI, "level", "idx", 2, (v) => v < 0 ? "accommodative" : "tight"),
  dash("Michigan sent.", S.UMCSENT, "level", "idx", 0, (v) => v < 65 ? "soft-data stress" : "consumer steady"),
  dash("VIX", S.VIX, "level", "", 1, (v) => v < 20 ? "risk calm" : "risk elevated"),
].filter(Boolean);
if (S.T10Y3M.size) dashboard.splice(11, 0, dash("10y−3m curve", S.T10Y3M, "level", "pp", 2, (v) => v < 0 ? "inverted" : "positively sloped"));
fs.writeFileSync(path.join(OUT, "dashboard.json"), JSON.stringify(dashboard));

// keep narrative series for the inflation + growth-signal figures
const inflMonths = months.filter((m) => m >= "2015-01");
fs.writeFileSync(path.join(OUT, "inflation.json"), JSON.stringify(inflMonths.map((ym) => ({ date: ym + "-01", cpi: round(yoy(S.CPI, ym), 1), core: round(yoy(S.CORECPI, ym), 1), pce: round(yoy(S.PCE, ym), 1), corePce: round(yoy(S.COREPCE, ym), 1) })).filter((r) => r.cpi != null)));
// growth/inflation signal series (expanding z growth composite + core-CPI 3m change) 2000→
const signal = months.filter((m) => m >= "2000-01").map((ym) => { const i = idxOf.get(ym); const ic = (() => { const a = yoy(S.CORECPI, ym), b = yoy(S.CORECPI, prevYM(ym, 3)); return a != null && b != null ? a - b : null; })(); return { date: ym + "-01", growth: round(gcExp[i], 2), inflChg: round(ic, 2) }; }).filter((r) => r.growth != null);
fs.writeFileSync(path.join(OUT, "signal.json"), JSON.stringify(signal));
const labor = inflMonths.map((ym) => ({ date: ym + "-01", unrate: round(S.UNRATE.get(ym), 1), claims: round(S.ICSA.get(ym) ? S.ICSA.get(ym) / 1000 : null, 0) })).filter((r) => r.unrate != null);
fs.writeFileSync(path.join(OUT, "labor.json"), JSON.stringify(labor));

// ── summary ─────────────────────────────────────────────────────────────────
const summary = {
  asOf: "2026-05-30", sample: `${SAMPLE0} → ${months.filter((m) => head.ms.includes(m)).at(-1)}`, hacLag: HAC_L,
  current: confidence, regime, regReg, robustness, leadlag, reaction, hardsoft, factors: { spreads: factorSpreads, sectorTilt }, alloc, confidence,
  pcaWeights: PCAW.map((x) => round(x, 2)),
};
fs.writeFileSync(path.join(OUT, "summary.json"), JSON.stringify(summary, null, 2));

// ── console ──────────────────────────────────────────────────────────────────
console.log("\n=== REGIME (expanding window, fwd 3m SPY) ===");
for (const r of regime) console.log(`${r.name.padEnd(12)} mean ${String(r.mean).padStart(5)}%  95% CI [${r.lo}, ${r.hi}]  hit ${r.hit}%  n=${r.n} (nEff≈${r.nEff})`);
console.log("\n=== HAC REGRESSION (stagflation omitted) ===");
console.log(`stagflation mean ${regReg.stagMean}% (t ${regReg.stagT})`);
for (const c of regReg.contrasts) console.log(`  ${c.name.padEnd(28)} ${String(c.est).padStart(6)}pp  (HAC t ${c.t})`);
console.log(`  ${regReg.joint.name.padEnd(28)} ${String(regReg.joint.est).padStart(6)}pp  (HAC t ${regReg.joint.t})`);
console.log("\n=== ROBUSTNESS ===");
for (const v of robustness) console.log(`${v.label.padEnd(48)} R ${String(v.refl).padStart(5)} G ${String(v.gold).padStart(5)} Sl ${String(v.slow).padStart(5)} St ${String(v.stag).padStart(5)}  ${v.stagLowest ? "stag=last" : "STAG NOT LAST"}${v.stagOnlyNeg ? " · only<0" : ""}`);
console.log("\n=== LEAD-LAG (unconditional, fwd 3m) ===");
for (const l of leadlag) console.log(`${l.label.padEnd(24)} level ${String(l.corr).padStart(5)}  Δ3m ${String(l.corrChg).padStart(5)}  n=${l.n} nEff≈${l.nEff} tEff ${l.tEff}`);
console.log("\nreaction split (pre/post-2022):", JSON.stringify(reaction));
console.log("\n=== HARD/SOFT GAP QUINTILES ===");
for (const q of hardsoft.quint) console.log(`Q${q.q} [${q.gapLo},${q.gapHi}]  fwd ${String(q.mean).padStart(5)}%  hit ${q.hit}%  n=${q.n}`);
console.log("current gap", hardsoft.currentGap, "(hardZ", hardsoft.currentHardZ, "michZ", hardsoft.currentMichZ, ")");
console.log("\n=== FACTOR SPREADS (fwd 3m by regime) ===");
for (const f of factorSpreads) console.log(`${f.label.padEnd(30)} Refl ${f.byRegime.Reflation}  Gold ${f.byRegime.Goldilocks}  Slow ${f.byRegime.Slowdown}  Stag ${f.byRegime.Stagflation}  (n=${f.n})`);
console.log("sector tilt:", JSON.stringify(sectorTilt));
console.log("\n=== ALLOCATION BACKTEST (2005→2026) ===");
console.log("strategy", JSON.stringify(alloc.strategy));
console.log("spy     ", JSON.stringify(alloc.spy));
console.log("\n=== CONFIDENCE ===", JSON.stringify(confidence));
console.log("\nPCA weights [INDPRO,PAYEMS,RSAFS]:", PCAW.map((x) => round(x, 2)));
console.log(`\nwrote JSON to ${OUT}`);
