// Data + statistics engine for the research piece:
//   "Equity Duration Is Not Where Investors Think: A Cross-Sectional
//    Decomposition of Rate Beta, 2021–2026"
//
// Upgrades vs. v1 (per senior-quant review):
//  - Newey-West HAC standard errors (Bartlett, 5 daily lags) everywhere.
//  - Decompose Δnominal = Δreal + Δbreakeven; estimate sector betas to each.
//  - Market-orthogonalized rate beta: ret ~ Δrate + mkt (separates duration
//    from equity beta × rate-return correlation).
//  - Sub-period (2021-22 vs 2023-26 vs 2010-20) + rolling 252d beta stability.
//  - Growth-value at DAILY frequency across multiple definitions (IWF/IWD,
//    SPYG/SPYV, QQQ/RSP) — apples-to-apples with the sector regressions.
//  - Yield-up-day hedge backtest.
// Sources: FRED (DGS10, DFII10; breakeven = nominal − real) + Yahoo daily.
// Run: node scripts/research/equity-duration.mjs

import fs from "node:fs";
import path from "node:path";

const UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/124.0 Safari/537.36";
const START = "2010-01-01";
const END = "2026-01-31";
const FOCUS0 = "2021-01-01"; // headline inflation-regime window
const OUT = path.join("content", "research", "2026-02-01-equity-duration", "data");
const HAC_L = 5; // Newey-West Bartlett lag

// ── fetchers ────────────────────────────────────────────────────────────────
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
async function fredChunk(id, cosd, coed) {
  const url = `https://fred.stlouisfed.org/graph/fredgraph.csv?id=${id}&cosd=${cosd}&coed=${coed}`;
  for (let t = 0; t < 4; t++) {
    try {
      const res = await fetch(url, { headers: { "User-Agent": UA } });
      if (res.ok) {
        const m = new Map();
        for (const line of (await res.text()).trim().split("\n").slice(1)) {
          const [d, v] = line.split(",");
          if (v && v !== ".") m.set(d, parseFloat(v));
        }
        return m;
      }
    } catch {}
    await sleep(700 * (t + 1));
  }
  return null;
}
// FRED 504s on large date ranges; fetch in 3-year chunks and merge.
async function fredMap(id) {
  const merged = new Map();
  const endY = +END.slice(0, 4);
  for (let y = +START.slice(0, 4); y <= endY; y += 3) {
    const coed = `${Math.min(y + 2, endY)}-12-31`;
    const m = await fredChunk(id, `${y}-01-01`, coed > END ? END : coed);
    if (m) for (const [k, v] of m) merged.set(k, v);
    await sleep(250);
  }
  return merged;
}
async function yahooMap(sym) {
  const p1 = Math.floor(new Date(START) / 1000), p2 = Math.floor(new Date(END) / 1000);
  const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(sym)}?period1=${p1}&period2=${p2}&interval=1d`;
  for (let t = 0; t < 4; t++) {
    try {
      const res = await fetch(url, { headers: { "User-Agent": UA, Accept: "application/json" } });
      if (res.ok) {
        const r = (await res.json())?.chart?.result?.[0];
        const ts = r?.timestamp ?? [], cl = r?.indicators?.quote?.[0]?.close ?? [];
        const m = new Map();
        for (let i = 0; i < ts.length; i++) if (typeof cl[i] === "number") m.set(new Date(ts[i] * 1000).toISOString().slice(0, 10), cl[i]);
        if (m.size) return m;
      }
    } catch {}
    await sleep(600 * (t + 1));
  }
  return new Map();
}

// ── linear algebra ──────────────────────────────────────────────────────────
const zeros = (r, c) => Array.from({ length: r }, () => new Array(c).fill(0));
const transpose = (A) => A[0].map((_, j) => A.map((row) => row[j]));
function matmul(A, B) {
  const r = A.length, k = B.length, c = B[0].length, C = zeros(r, c);
  for (let i = 0; i < r; i++) for (let l = 0; l < k; l++) { const a = A[i][l]; for (let j = 0; j < c; j++) C[i][j] += a * B[l][j]; }
  return C;
}
function inv(A) {
  const n = A.length, M = A.map((row, i) => [...row, ...Array.from({ length: n }, (_, j) => (i === j ? 1 : 0))]);
  for (let col = 0; col < n; col++) {
    let piv = col;
    for (let r = col + 1; r < n; r++) if (Math.abs(M[r][col]) > Math.abs(M[piv][col])) piv = r;
    [M[col], M[piv]] = [M[piv], M[col]];
    const d = M[col][col]; if (Math.abs(d) < 1e-13) return null;
    for (let j = 0; j < 2 * n; j++) M[col][j] /= d;
    for (let r = 0; r < n; r++) { if (r === col) continue; const f = M[r][col]; for (let j = 0; j < 2 * n; j++) M[r][j] -= f * M[col][j]; }
  }
  return M.map((row) => row.slice(n));
}

// OLS with Newey-West HAC (Bartlett) standard errors. X includes intercept col.
function olsHAC(X, y, L = HAC_L) {
  const n = X.length; if (n < 30) return null;
  const k = X[0].length;
  const Xt = transpose(X);
  const XtXinv = inv(matmul(Xt, X)); if (!XtXinv) return null;
  const Xty = matmul(Xt, y.map((v) => [v])).map((r) => r[0]);
  const beta = matmul(XtXinv, Xty.map((v) => [v])).map((r) => r[0]);
  const e = y.map((yi, i) => yi - X[i].reduce((s, xij, j) => s + xij * beta[j], 0));
  const S = zeros(k, k);
  const addOuter = (c, xa, xb) => { for (let a = 0; a < k; a++) for (let b = 0; b < k; b++) S[a][b] += c * xa[a] * xb[b]; };
  for (let t = 0; t < n; t++) addOuter(e[t] * e[t], X[t], X[t]);
  for (let l = 1; l <= L; l++) { const w = 1 - l / (L + 1); for (let t = l; t < n; t++) { const c = w * e[t] * e[t - l]; addOuter(c, X[t], X[t - l]); addOuter(c, X[t - l], X[t]); } }
  const V = matmul(matmul(XtXinv, S), XtXinv);
  const se = V.map((row, i) => Math.sqrt(Math.max(row[i], 0)));
  const tstat = beta.map((b, i) => (se[i] ? b / se[i] : 0));
  const ybar = y.reduce((s, v) => s + v, 0) / n;
  const sst = y.reduce((s, v) => s + (v - ybar) ** 2, 0);
  const ssr = e.reduce((s, v) => s + v * v, 0);
  return { beta, se, t: tstat, r2: 1 - ssr / sst, n };
}

// ── load ──────────────────────────────────────────────────────────────────
const SECTORS = [
  ["XLK", "Technology"], ["XLC", "Comm Svcs"], ["XLY", "Cons Disc"], ["XLP", "Cons Staples"],
  ["XLE", "Energy"], ["XLF", "Financials"], ["XLV", "Health Care"], ["XLI", "Industrials"],
  ["XLB", "Materials"], ["XLRE", "Real Estate"], ["XLU", "Utilities"],
];
const GV = [
  ["IWF", "IWD", "Russell 1000 G/V"],
  ["SPYG", "SPYV", "S&P 500 G/V"],
  ["QQQ", "RSP", "Nasdaq-100 / EW S&P"],
];

const nom = await fredMap("DGS10");
const real = await fredMap("DFII10");
console.log(`FRED DGS10:${nom.size} DFII10:${real.size}`);
if (!nom.size || !real.size) {
  console.error("ABORT: FRED unavailable (rate-limited). Real yields have no substitute; not writing empty data.");
  process.exit(1);
}
const px = {};
const need = ["SPY", "^VIX", "CL=F", ...SECTORS.map((s) => s[0]), ...new Set(GV.flatMap((g) => [g[0], g[1]]))];
for (const s of need) { px[s] = await yahooMap(s); process.stdout.write(`${s}:${px[s].size} `); }
console.log("");

// common daily dates with nominal + real + SPY
const dates = [...px["SPY"].keys()].filter((d) => nom.has(d) && real.has(d)).sort();

// daily diffs/returns keyed by date (t vs t-1 on consecutive available dates)
function dailyChange(map, isReturn) {
  const out = new Map();
  for (let i = 1; i < dates.length; i++) {
    const a = map.get(dates[i - 1]), b = map.get(dates[i]);
    if (a != null && b != null) out.set(dates[i], isReturn ? b / a - 1 : b - a);
  }
  return out;
}
const dNom = dailyChange(nom, false);
const dReal = dailyChange(real, false);
const dBE = new Map(); for (const d of dNom.keys()) if (dReal.has(d)) dBE.set(d, dNom.get(d) - dReal.get(d));
const rMkt = dailyChange(px["SPY"], true);
const dVix = dailyChange(px["^VIX"], false);
const rOil = dailyChange(px["CL=F"], true);
const sectorRet = {}; for (const [s] of SECTORS) sectorRet[s] = dailyChange(px[s], true);
const gvRet = {}; // growth-minus-value daily
for (const [g, v, label] of GV) {
  const rg = dailyChange(px[g], true), rv = dailyChange(px[v], true);
  const m = new Map(); for (const d of rg.keys()) if (rv.has(d)) m.set(d, rg.get(d) - rv.get(d));
  gvRet[label] = m;
}

const inWin = (d, lo, hi) => d >= lo && d <= hi;
const round = (x, n = 2) => (x == null || !Number.isFinite(x) ? null : Number(x.toFixed(n)));

// Build aligned arrays for a regression over a window. cols: array of Maps; y: Map.
function design(yMap, xMaps, lo = FOCUS0, hi = END) {
  const Y = [], X = [];
  for (const d of dates) {
    if (!inWin(d, lo, hi)) continue;
    if (!yMap.has(d)) continue;
    const xs = xMaps.map((m) => m.get(d));
    if (xs.some((v) => v == null)) continue;
    Y.push(yMap.get(d));
    X.push([1, ...xs]);
  }
  return { Y, X };
}
// sens per +100bp (=+1pp): coefficient is decimal return per pp → ×100 for %
const sens = (b) => round(b * 100, 2);

// ── sector decomposition (focus 2021–2026) ──────────────────────────────────
const decomp = [];
for (const [s, label] of SECTORS) {
  const y = sectorRet[s];
  const uniNom = (() => { const { Y, X } = design(y, [dNom]); return olsHAC(X, Y); })();
  const uniReal = (() => { const { Y, X } = design(y, [dReal]); return olsHAC(X, Y); })();
  const uniBE = (() => { const { Y, X } = design(y, [dBE]); return olsHAC(X, Y); })();
  const ctrlReal = (() => { const { Y, X } = design(y, [dReal, rMkt]); return olsHAC(X, Y); })(); // ret ~ Δreal + mkt
  if (!uniNom || !uniReal) continue;
  decomp.push({
    sym: s, label,
    nom: sens(uniNom.beta[1]), tNom: round(uniNom.t[1], 1),
    real: sens(uniReal.beta[1]), tReal: round(uniReal.t[1], 1),
    be: sens(uniBE.beta[1]), tBE: round(uniBE.t[1], 1),
    realCtrl: sens(ctrlReal.beta[1]), tRealCtrl: round(ctrlReal.t[1], 1),
    mktBeta: round(ctrlReal.beta[2], 2),
    r2: round(uniNom.r2, 3),
    n: uniNom.n,
  });
}
decomp.sort((a, b) => a.realCtrl - b.realCtrl);
fs.writeFileSync(path.join(OUT, "sector_decomp.json"), JSON.stringify(decomp));

// ── full multifactor for two exemplars (XLK, XLRE) ───────────────────────────
function multifactor(s) {
  const { Y, X } = design(sectorRet[s], [dReal, dBE, rMkt, dVix, rOil]);
  const f = olsHAC(X, Y);
  if (!f) return null;
  return {
    sym: s,
    real: sens(f.beta[1]), tReal: round(f.t[1], 1),
    be: sens(f.beta[2]), tBE: round(f.t[2], 1),
    mkt: round(f.beta[3], 2), tMkt: round(f.t[3], 1),
    vix: round(f.beta[4] * 100, 3), tVix: round(f.t[4], 1),
    oil: round(f.beta[5], 2), tOil: round(f.t[5], 1),
    r2: round(f.r2, 3), n: f.n,
  };
}
const mf = ["XLK", "XLRE", "XLF", "XLE"].map(multifactor).filter(Boolean);
fs.writeFileSync(path.join(OUT, "multifactor.json"), JSON.stringify(mf));

// ── sub-period stability: real-rate market-controlled beta ───────────────────
const periods = [["2010-20", "2010-01-01", "2020-12-31"], ["2021-22", "2021-01-01", "2022-12-31"], ["2023-26", "2023-01-01", END]];
const stability = [];
for (const [s, label] of SECTORS) {
  const row = { sym: s, label };
  for (const [name, lo, hi] of periods) {
    const { Y, X } = design(sectorRet[s], [dReal, rMkt], lo, hi);
    const f = olsHAC(X, Y);
    row[name] = f ? sens(f.beta[1]) : null;
  }
  stability.push(row);
}
stability.sort((a, b) => (a["2021-22"] ?? 0) - (b["2021-22"] ?? 0));
fs.writeFileSync(path.join(OUT, "stability.json"), JSON.stringify(stability));

// ── rolling 252d real-rate (market-controlled) beta for key sectors ──────────
const ROLL = ["XLRE", "XLU", "XLK", "XLF", "XLE"];
const W = 252;
const rollRows = []; // {date, XLRE, XLU, ...}
const focusDates = dates.filter((d) => inWin(d, "2011-01-01", END));
for (let i = W; i < focusDates.length; i += 5) { // every 5 trading days
  const winDates = focusDates.slice(i - W, i);
  const pt = { date: focusDates[i - 1] };
  for (const s of ROLL) {
    const Y = [], X = [];
    for (const d of winDates) {
      const y = sectorRet[s].get(d), xr = dReal.get(d), xm = rMkt.get(d);
      if (y != null && xr != null && xm != null) { Y.push(y); X.push([1, xr, xm]); }
    }
    const f = olsHAC(X, Y, 5);
    pt[s] = f ? sens(f.beta[1]) : null;
  }
  rollRows.push(pt);
}
fs.writeFileSync(path.join(OUT, "rolling_betas.json"), JSON.stringify(rollRows));

// ── growth-value: daily across definitions (nominal, real, real|mkt) + monthly
const gvOut = [];
for (const [, , label] of GV) {
  const y = gvRet[label];
  const dN = (() => { const { Y, X } = design(y, [dNom]); return olsHAC(X, Y); })();
  const dR = (() => { const { Y, X } = design(y, [dReal]); return olsHAC(X, Y); })();
  const dRC = (() => { const { Y, X } = design(y, [dReal, rMkt]); return olsHAC(X, Y); })();
  if (!dN) continue;
  gvOut.push({
    label,
    nom: sens(dN.beta[1]), tNom: round(dN.t[1], 1),
    real: dR ? sens(dR.beta[1]) : null, tReal: dR ? round(dR.t[1], 1) : null,
    realCtrl: dRC ? sens(dRC.beta[1]) : null, tRealCtrl: dRC ? round(dRC.t[1], 1) : null,
    r2: round(dN.r2, 3), n: dN.n,
  });
}
// monthly IWF/IWD for the frequency-comparison point
function monthlyGV() {
  const g = px["IWF"], v = px["IWD"], n2 = nom;
  const months = [...new Set(dates.filter((d) => inWin(d, FOCUS0, END)).map((d) => d.slice(0, 7)))].sort();
  const lastOf = (m) => dates.filter((d) => d.slice(0, 7) === m && g.has(d) && v.has(d) && n2.has(d)).at(-1);
  const Y = [], X = [];
  for (let i = 1; i < months.length; i++) {
    const a = lastOf(months[i - 1]), b = lastOf(months[i]);
    if (!a || !b) continue;
    const gv = (g.get(b) / g.get(a) - 1) - (v.get(b) / v.get(a) - 1);
    Y.push(gv); X.push([1, n2.get(b) - n2.get(a)]);
  }
  const f = olsHAC(X, Y, 2);
  return f ? { nom: sens(f.beta[1]), tNom: round(f.t[1], 1), r2: round(f.r2, 3), n: f.n } : null;
}
const gvMonthly = monthlyGV();
fs.writeFileSync(path.join(OUT, "gv_defs.json"), JSON.stringify({ daily: gvOut, monthlyIWF: gvMonthly }));

// gv scatter (daily IWF/IWD vs Δreal) for visual
const scatter = [];
{ const { Y, X } = design(gvRet["Russell 1000 G/V"], [dReal]);
  for (let i = 0; i < Y.length; i += 1) scatter.push({ x: round(X[i][1], 3), y: round(Y[i] * 100, 2) }); }
const sFit = (() => { const { Y, X } = design(gvRet["Russell 1000 G/V"], [dReal]); const f = olsHAC(X, Y); return f ? { beta: round(f.beta[1] * 100, 2), alpha: round(f.beta[0] * 100, 3), r2: round(f.r2, 3), t: round(f.t[1], 1), n: f.n } : { beta: 0, alpha: 0, r2: 0, t: 0, n: 0 }; })();
fs.writeFileSync(path.join(OUT, "gv_scatter.json"), JSON.stringify({ points: scatter.filter((_, i) => i % 2 === 0), fit: sFit }));

// ── yield-up-day hedge backtest ──────────────────────────────────────────────
// Top-decile Δnominal days in the focus window; mean sector & hedge returns.
const upDays = dates.filter((d) => inWin(d, FOCUS0, END) && dNom.has(d)).map((d) => ({ d, dy: dNom.get(d) }));
upDays.sort((a, b) => b.dy - a.dy);
const topDec = upDays.slice(0, Math.round(upDays.length * 0.1));
const meanRet = (s, set) => { const xs = set.map((o) => sectorRet[s].get(o.d)).filter((v) => v != null); return xs.reduce((a, b) => a + b, 0) / xs.length; };
const hedgeLegs = {
  "short XLK (tech)": (set) => -meanRet("XLK", set),
  "short XLRE+XLU (bond proxies)": (set) => -(meanRet("XLRE", set) + meanRet("XLU", set)) / 2,
  "long XLE+XLF / short XLRE+XLU": (set) => (meanRet("XLE", set) + meanRet("XLF", set)) / 2 - (meanRet("XLRE", set) + meanRet("XLU", set)) / 2,
};
const hedge = Object.entries(hedgeLegs).map(([name, fn]) => ({
  name,
  topDecile: round(fn(topDec) * 100, 2), // mean % return on worst rate-up days
  allDays: round(fn(upDays) * 100, 3),
  avgDyTop: round(topDec.reduce((a, b) => a + b.dy, 0) / topDec.length * 100, 1), // avg Δy in bp
}));
fs.writeFileSync(path.join(OUT, "hedge.json"), JSON.stringify({ hedge, nTop: topDec.length, nAll: upDays.length }));

// ── regime series (focus window) + stock-bond rolling corr ───────────────────
const yields = dates.filter((d) => inWin(d, FOCUS0, END) && real.has(d)).map((d) => ({
  date: d, nominal: round(nom.get(d), 2), real: round(real.get(d), 2), be: round(nom.get(d) - real.get(d), 2),
}));
fs.writeFileSync(path.join(OUT, "yields.json"), JSON.stringify(yields));

function corr(xs, ys) { const n = xs.length, mx = xs.reduce((a, b) => a + b, 0) / n, my = ys.reduce((a, b) => a + b, 0) / n; let sxy = 0, sxx = 0, syy = 0; for (let i = 0; i < n; i++) { const dx = xs[i] - mx, dy = ys[i] - my; sxy += dx * dy; sxx += dx * dx; syy += dy * dy; } return sxy / Math.sqrt(sxx * syy); }
const fdates = dates.filter((d) => inWin(d, FOCUS0, END) && dNom.has(d) && rMkt.has(d));
const rollCorr = [];
for (let i = 63; i <= fdates.length; i++) { const w = fdates.slice(i - 63, i); rollCorr.push({ date: w.at(-1), corr: round(corr(w.map((d) => dNom.get(d)), w.map((d) => rMkt.get(d))), 3) }); }
fs.writeFileSync(path.join(OUT, "rolling_corr.json"), JSON.stringify(rollCorr));

// ── summary ─────────────────────────────────────────────────────────────────
const summary = {
  asOf: "2026-02-01", focus: `${FOCUS0} → ${END}`, hacLag: HAC_L,
  realYield: { start: yields[0].real, end: yields.at(-1).real },
  breakeven: { start: yields[0].be, end: yields.at(-1).be },
  decomp, multifactor: mf, stability, gv: { daily: gvOut, monthlyIWF: gvMonthly }, hedge,
};
fs.writeFileSync(path.join(OUT, "summary.json"), JSON.stringify(summary, null, 2));

console.log("\n=== SECTOR DECOMP (focus 2021–2026, HAC t, sens per +100bp) ===");
console.log("sec     nom(t)     real(t)    be(t)      real|mkt(t)  mktβ  R²");
for (const d of decomp)
  console.log(`${d.sym.padEnd(5)} ${String(d.nom).padStart(6)}(${String(d.tNom).padStart(5)}) ${String(d.real).padStart(6)}(${String(d.tReal).padStart(5)}) ${String(d.be).padStart(6)}(${String(d.tBE).padStart(5)}) ${String(d.realCtrl).padStart(6)}(${String(d.tRealCtrl).padStart(5)}) ${String(d.mktBeta).padStart(5)} ${d.r2}`);
console.log("\n=== STABILITY (real|mkt beta by period) ===");
for (const s of stability) console.log(`${s.sym.padEnd(5)} 2010-20 ${String(s["2010-20"]).padStart(6)}  2021-22 ${String(s["2021-22"]).padStart(6)}  2023-26 ${String(s["2023-26"]).padStart(6)}`);
console.log("\n=== GROWTH-VALUE (daily, HAC) ===");
for (const g of gvOut) console.log(`${g.label.padEnd(22)} nom ${String(g.nom).padStart(6)}(t${g.tNom})  real ${String(g.real).padStart(6)}(t${g.tReal})  real|mkt ${String(g.realCtrl).padStart(6)}(t${g.tRealCtrl})  n=${g.n}`);
console.log(`monthly IWF/IWD: nom ${gvMonthly?.nom} (t${gvMonthly?.tNom}, n=${gvMonthly?.n})`);
console.log("\n=== MULTIFACTOR (XLK, XLRE, XLF, XLE) ===");
for (const m of mf) console.log(`${m.sym.padEnd(5)} real ${String(m.real).padStart(6)}(t${m.tReal})  be ${String(m.be).padStart(6)}(t${m.tBE})  mktβ ${m.mkt}(t${m.tMkt})  R² ${m.r2}`);
console.log("\n=== HEDGE (top-decile yield-up days) ===");
for (const h of hedge) console.log(`${h.name.padEnd(34)} top-decile ${String(h.topDecile).padStart(6)}%  (avg Δy ${h.avgDyTop}bp)`);
console.log(`\nwrote JSON to ${OUT}`);
