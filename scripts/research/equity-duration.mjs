// Data pipeline for the research piece:
//   "Rates as the Master Factor: Equity Duration and the Growth-Value Rotation"
// Sources: FRED (no-key CSV) + Yahoo Finance (v8 daily). Data cut 2026-01-31.
// Writes JSON for the article charts and prints a summary of the statistics
// cited in the prose. Re-run to refresh: node scripts/research/equity-duration.mjs

import fs from "node:fs";
import path from "node:path";

const UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36";
const START = "2021-01-01";
const END = "2026-01-31";
const OUT = path.join("content", "research", "2026-02-01-equity-duration", "data");

// ── fetchers ────────────────────────────────────────────────────────────────
async function fred(id) {
  const url = `https://fred.stlouisfed.org/graph/fredgraph.csv?id=${id}&cosd=${START}&coed=${END}`;
  const res = await fetch(url, { headers: { "User-Agent": UA } });
  const txt = await res.text();
  const map = new Map();
  for (const line of txt.trim().split("\n").slice(1)) {
    const [d, v] = line.split(",");
    if (v && v !== ".") map.set(d, parseFloat(v));
  }
  return map; // Map<YYYY-MM-DD, number>
}
async function yahoo(sym) {
  const p1 = Math.floor(new Date(START).getTime() / 1000);
  const p2 = Math.floor(new Date(END).getTime() / 1000);
  const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(sym)}?period1=${p1}&period2=${p2}&interval=1d`;
  const res = await fetch(url, { headers: { "User-Agent": UA, Accept: "application/json" } });
  const j = await res.json();
  const r = j?.chart?.result?.[0];
  const ts = r?.timestamp ?? [];
  const closes = r?.indicators?.quote?.[0]?.close ?? [];
  const map = new Map();
  for (let i = 0; i < ts.length; i++) {
    const v = closes[i];
    if (typeof v === "number" && Number.isFinite(v)) {
      map.set(new Date(ts[i] * 1000).toISOString().slice(0, 10), v);
    }
  }
  return map;
}

// ── stats ───────────────────────────────────────────────────────────────────
const mean = (a) => a.reduce((s, x) => s + x, 0) / a.length;
function ols(xs, ys) {
  const n = xs.length;
  const mx = mean(xs), my = mean(ys);
  let sxx = 0, sxy = 0, syy = 0;
  for (let i = 0; i < n; i++) {
    const dx = xs[i] - mx, dy = ys[i] - my;
    sxx += dx * dx; sxy += dx * dy; syy += dy * dy;
  }
  const beta = sxy / sxx;
  const alpha = my - beta * mx;
  let ssr = 0;
  for (let i = 0; i < n; i++) { const e = ys[i] - (alpha + beta * xs[i]); ssr += e * e; }
  const r2 = 1 - ssr / syy;
  const se = Math.sqrt(ssr / (n - 2) / sxx);
  const t = beta / se;
  return { beta, alpha, r2, t, n };
}
function corr(xs, ys) {
  const n = xs.length, mx = mean(xs), my = mean(ys);
  let sxy = 0, sxx = 0, syy = 0;
  for (let i = 0; i < n; i++) { const dx = xs[i]-mx, dy = ys[i]-my; sxy+=dx*dy; sxx+=dx*dx; syy+=dy*dy; }
  return sxy / Math.sqrt(sxx * syy);
}

// ── load ────────────────────────────────────────────────────────────────────
const SECTORS = [
  ["XLK", "Technology"], ["XLC", "Comm Svcs"], ["XLY", "Cons Disc"], ["XLP", "Cons Staples"],
  ["XLE", "Energy"], ["XLF", "Financials"], ["XLV", "Health Care"], ["XLI", "Industrials"],
  ["XLB", "Materials"], ["XLRE", "Real Estate"], ["XLU", "Utilities"],
];

const dgs10 = await fred("DGS10");
const dfii10 = await fred("DFII10");
const dgs2 = await fred("DGS2");
const curve = await fred("T10Y2Y");
const spy = await yahoo("SPY");
const iwf = await yahoo("IWF");
const iwd = await yahoo("IWD");
const sectorPx = {};
for (const [sym] of SECTORS) sectorPx[sym] = await yahoo(sym);

// Common trading dates (intersection of SPY + DGS10), sorted.
const tradeDates = [...spy.keys()].filter((d) => dgs10.has(d)).sort();

// Daily aligned series of (Δ10Y in pp, SPY return) on consecutive trade dates.
const dYield = [], spyRet = [], alignDates = [];
for (let i = 1; i < tradeDates.length; i++) {
  const d0 = tradeDates[i - 1], d1 = tradeDates[i];
  if (dgs10.has(d0) && dgs10.has(d1) && spy.has(d0) && spy.has(d1)) {
    dYield.push(dgs10.get(d1) - dgs10.get(d0));
    spyRet.push(spy.get(d1) / spy.get(d0) - 1);
    alignDates.push(d1);
  }
}

fs.mkdirSync(OUT, { recursive: true });
const round = (x, n = 4) => Number(x.toFixed(n));

// ── 1. yields regime ─────────────────────────────────────────────────────────
const yields = tradeDates
  .filter((d) => dfii10.has(d))
  .map((d) => ({ date: d, nominal: round(dgs10.get(d), 2), real: round(dfii10.get(d), 2) }));
fs.writeFileSync(path.join(OUT, "yields.json"), JSON.stringify(yields));

// ── 2. rolling 63d corr(Δ10Y, SPY ret) ───────────────────────────────────────
const W = 63;
const rollCorr = [];
for (let i = W; i <= dYield.length; i++) {
  const c = corr(dYield.slice(i - W, i), spyRet.slice(i - W, i));
  rollCorr.push({ date: alignDates[i - 1], corr: round(c, 3) });
}
fs.writeFileSync(path.join(OUT, "rolling_corr.json"), JSON.stringify(rollCorr));
const fullCorr = corr(dYield, spyRet);
// sub-period correlations
function periodCorr(y0, y1) {
  const xs = [], ys = [];
  for (let i = 0; i < alignDates.length; i++) {
    const yr = +alignDates[i].slice(0, 4);
    if (yr >= y0 && yr <= y1) { xs.push(dYield[i]); ys.push(spyRet[i]); }
  }
  return { corr: round(corr(xs, ys), 3), n: xs.length };
}

// ── 3. sector rate-betas: sector daily ret ~ Δ10Y(pp) ────────────────────────
const sectorBetas = [];
for (const [sym, label] of SECTORS) {
  const px = sectorPx[sym];
  const xs = [], ys = [];
  for (let i = 1; i < tradeDates.length; i++) {
    const d0 = tradeDates[i - 1], d1 = tradeDates[i];
    if (px.has(d0) && px.has(d1) && dgs10.has(d0) && dgs10.has(d1)) {
      xs.push(dgs10.get(d1) - dgs10.get(d0));
      ys.push(px.get(d1) / px.get(d0) - 1);
    }
  }
  const f = ols(xs, ys);
  // return (%) for a +100bp (=+1.00pp) move in the 10y
  sectorBetas.push({ sym, label, sens100: round(f.beta * 100, 2), tstat: round(f.t, 1), r2: round(f.r2, 3), n: f.n });
}
sectorBetas.sort((a, b) => a.sens100 - b.sens100);
fs.writeFileSync(path.join(OUT, "sector_betas.json"), JSON.stringify(sectorBetas));

// ── 4. growth-value as a duration trade ──────────────────────────────────────
// time series: G/V ratio rebased to 100 + 10y level
const gvDates = tradeDates.filter((d) => iwf.has(d) && iwd.has(d) && dgs10.has(d));
const r0 = iwf.get(gvDates[0]) / iwd.get(gvDates[0]);
const gvSeries = gvDates.map((d) => ({
  date: d,
  gv: round((iwf.get(d) / iwd.get(d)) / r0 * 100, 2),
  y10: round(dgs10.get(d), 2),
}));
fs.writeFileSync(path.join(OUT, "growth_value.json"), JSON.stringify(gvSeries));

// scatter: monthly G-V excess return vs monthly Δ10Y
function monthKey(d) { return d.slice(0, 7); }
const months = [...new Set(gvDates.map(monthKey))].sort();
const scat = [];
for (let i = 1; i < months.length; i++) {
  const m0 = months[i - 1], m1 = months[i];
  const last = (m) => gvDates.filter((d) => monthKey(d) === m).at(-1);
  const a = last(m0), b = last(m1);
  if (!a || !b) continue;
  const gvRet = (iwf.get(b) / iwf.get(a) - 1) - (iwd.get(b) / iwd.get(a) - 1); // growth minus value
  const dy = dgs10.get(b) - dgs10.get(a); // monthly Δ10y in pp
  scat.push({ x: round(dy, 2), y: round(gvRet * 100, 2), date: m1 }); // y in %
}
const gvFit = ols(scat.map((p) => p.x), scat.map((p) => p.y));
fs.writeFileSync(path.join(OUT, "gv_scatter.json"), JSON.stringify({
  points: scat,
  fit: { beta: round(gvFit.beta, 2), alpha: round(gvFit.alpha, 2), r2: round(gvFit.r2, 3), t: round(gvFit.t, 1), n: gvFit.n },
}));

// ── 5. curve slope vs financials ─────────────────────────────────────────────
const curveDates = tradeDates.filter((d) => curve.has(d) && sectorPx["XLF"].has(d));
const xlf0 = sectorPx["XLF"].get(curveDates[0]);
const curveSeries = curveDates.map((d) => ({
  date: d,
  curve: round(curve.get(d), 2),
  xlf: round(sectorPx["XLF"].get(d) / xlf0 * 100, 2),
}));
fs.writeFileSync(path.join(OUT, "curve.json"), JSON.stringify(curveSeries));

// ── summary (cited in prose) ─────────────────────────────────────────────────
const summary = {
  asOf: END,
  span: `${tradeDates[0]} -> ${tradeDates.at(-1)}`,
  nObs: dYield.length,
  yields: {
    nominal: { start: yields[0].nominal, end: yields.at(-1).nominal },
    real: { start: yields[0].real, end: yields.at(-1).real },
    two: { start: round(dgs2.get(tradeDates.find((d)=>dgs2.has(d))),2), end: round(dgs2.get([...dgs2.keys()].sort().at(-1)),2) },
    curveEnd: round(curve.get([...curve.keys()].sort().at(-1)), 2),
  },
  stockBondCorr: {
    full: round(fullCorr, 3),
    y2021: periodCorr(2021, 2021), y2022: periodCorr(2022, 2022),
    y2023: periodCorr(2023, 2023), y2024_25: periodCorr(2024, 2025),
  },
  sectorBetas,
  gvFit: { beta: round(gvFit.beta, 2), r2: round(gvFit.r2, 3), t: round(gvFit.t, 1), n: gvFit.n },
};
fs.writeFileSync(path.join(OUT, "summary.json"), JSON.stringify(summary, null, 2));

console.log("=== SUMMARY ===");
console.log(JSON.stringify(summary, null, 2));
console.log(`\nwrote JSON to ${OUT}`);
