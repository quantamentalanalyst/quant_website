// Data pipeline for the macro-driver piece:
//   "The Macro Maze: Most Indicators Are Noise, Regime Is Signal"
// Sources: FRED (no key) + Yahoo (SPY). Builds a current-conditions dashboard,
// inflation/labor/growth series, lead-lag correlations vs forward equity returns,
// and growth×inflation regime-quadrant forward returns.
// Run: node scripts/research/macro-regime.mjs

import fs from "node:fs";
import path from "node:path";

const UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/124.0 Safari/537.36";
const START = "1998-01-01";
const END = "2026-04-15";
const OUT = path.join("content", "research", "2026-04-15-macro-regime", "data");

async function fredRaw(id) {
  const url = `https://fred.stlouisfed.org/graph/fredgraph.csv?id=${id}&cosd=${START}&coed=${END}`;
  const res = await fetch(url, { headers: { "User-Agent": UA } });
  if (!res.ok) return null;
  const out = [];
  for (const line of (await res.text()).trim().split("\n").slice(1)) {
    const [d, v] = line.split(",");
    if (v && v !== ".") out.push({ date: d, val: parseFloat(v) });
  }
  return out.length ? out : null;
}
// Resample to month-end (last observation in each calendar month). Returns Map<YYYY-MM, val>.
function toMonthly(rows) {
  const m = new Map();
  if (!rows) return m;
  for (const r of rows) m.set(r.date.slice(0, 7), r.val); // later dates overwrite → last in month
  return m;
}
async function fredM(id) { return toMonthly(await fredRaw(id)); }

async function yahooMonthly(sym) {
  const p1 = Math.floor(new Date(START) / 1000), p2 = Math.floor(new Date(END) / 1000);
  const url = `https://query1.finance.yahoo.com/v8/finance/chart/${sym}?period1=${p1}&period2=${p2}&interval=1mo`;
  const res = await fetch(url, { headers: { "User-Agent": UA, Accept: "application/json" } });
  const r = (await res.json())?.chart?.result?.[0];
  const ts = r?.timestamp ?? [], cl = r?.indicators?.quote?.[0]?.close ?? [];
  const m = new Map();
  for (let i = 0; i < ts.length; i++) if (typeof cl[i] === "number") m.set(new Date(ts[i] * 1000).toISOString().slice(0, 7), cl[i]);
  return m;
}

// ── load ──────────────────────────────────────────────────────────────────
const S = {};
const want = {
  PAYEMS: "PAYEMS", UNRATE: "UNRATE", ICSA: "ICSA",
  CPI: "CPIAUCSL", CORECPI: "CPILFESL", PCE: "PCEPI", COREPCE: "PCEPILFE",
  RSAFS: "RSAFS", INDPRO: "INDPRO", FEDFUNDS: "FEDFUNDS", T10Y3M: "T10Y3M",
  NFCI: "NFCI", UMCSENT: "UMCSENT", VIX: "VIXCLS", SAHM: "SAHMCURRENT",
  EMPIRE: "GACDISA066MSFRBNY", PHILLY: "GACDFSA066MSFRBPHI",
};
for (const [k, id] of Object.entries(want)) {
  S[k] = await fredM(id);
  console.log(`${k.padEnd(9)} ${id.padEnd(20)} ${S[k].size ? `n=${S[k].size}` : "UNAVAILABLE"}`);
}
const SPY = await yahooMonthly("SPY");
console.log(`SPY (Yahoo monthly) n=${SPY.size}`);

// ── helpers on monthly maps ─────────────────────────────────────────────────
const months = (() => {
  const out = [];
  let d = new Date("1998-01-01");
  const end = new Date(END);
  while (d <= end) { out.push(d.toISOString().slice(0, 7)); d = new Date(d.getFullYear(), d.getMonth() + 1, 1); }
  return out;
})();
const prevYM = (ym, n) => { const [y, m] = ym.split("-").map(Number); const d = new Date(y, m - 1 - n, 1); return d.toISOString().slice(0, 7); };
const yoy = (map, ym) => { const a = map.get(ym), b = map.get(prevYM(ym, 12)); return a != null && b ? (a / b - 1) * 100 : null; };
const mom = (map, ym) => { const a = map.get(ym), b = map.get(prevYM(ym, 1)); return a != null && b ? (a / b - 1) * 100 : null; };
const round = (x, n = 2) => (x == null || !Number.isFinite(x) ? null : Number(x.toFixed(n)));
function stats(arr) { const a = arr.filter((x) => x != null); const m = a.reduce((s, x) => s + x, 0) / a.length; const sd = Math.sqrt(a.reduce((s, x) => s + (x - m) ** 2, 0) / a.length); return { m, sd }; }
function pearson(xs, ys) {
  const n = xs.length; const mx = xs.reduce((s, x) => s + x, 0) / n, my = ys.reduce((s, y) => s + y, 0) / n;
  let sxy = 0, sxx = 0, syy = 0;
  for (let i = 0; i < n; i++) { const dx = xs[i] - mx, dy = ys[i] - my; sxy += dx * dy; sxx += dx * dx; syy += dy * dy; }
  return sxy / Math.sqrt(sxx * syy);
}

fs.mkdirSync(OUT, { recursive: true });

// ── inflation series (YoY) 2015→ ─────────────────────────────────────────────
const inflMonths = months.filter((m) => m >= "2015-01");
const inflation = inflMonths.map((ym) => ({
  date: ym + "-01",
  cpi: round(yoy(S.CPI, ym), 1), core: round(yoy(S.CORECPI, ym), 1),
  pce: round(yoy(S.PCE, ym), 1), corePce: round(yoy(S.COREPCE, ym), 1),
})).filter((r) => r.cpi != null);
fs.writeFileSync(path.join(OUT, "inflation.json"), JSON.stringify(inflation));

// ── labor series 2015→ ───────────────────────────────────────────────────────
const labor = inflMonths.map((ym) => {
  const pay = S.PAYEMS.get(ym), payPrev = S.PAYEMS.get(prevYM(ym, 1));
  return {
    date: ym + "-01",
    unrate: round(S.UNRATE.get(ym), 1),
    payroll: pay != null && payPrev != null ? Math.round(pay - payPrev) : null, // MoM change, thousands
    claims: round(S.ICSA.get(ym) ? S.ICSA.get(ym) / 1000 : null, 0), // thousands
  };
}).filter((r) => r.unrate != null);
fs.writeFileSync(path.join(OUT, "labor.json"), JSON.stringify(labor));

// ── growth pulse 2015→ (YoY) ─────────────────────────────────────────────────
// Manufacturing pulse: ISM PMI is not freely redistributable on FRED, so we
// proxy with the Philly Fed manufacturing diffusion index (PMI-like, monthly).
const growth = inflMonths.map((ym) => ({
  date: ym + "-01",
  indpro: round(yoy(S.INDPRO, ym), 1),
  retail: round(yoy(S.RSAFS, ym), 1),
  philly: round(S.PHILLY.get(ym), 1),
})).filter((r) => r.indpro != null);
fs.writeFileSync(path.join(OUT, "growth.json"), JSON.stringify(growth));

// ── dashboard: latest value, 1y ago, z-score over trailing 10y ───────────────
function dash(label, map, kind, unit, decimals = 1) {
  const ks = [...map.keys()].sort();
  const last = ks.at(-1); if (!last) return null;
  const series = ks.map((ym) => (kind === "yoy" ? yoy(map, ym) : kind === "mom" ? mom(map, ym) : map.get(ym)));
  const lastVal = series.at(-1);
  // value 12m ago
  const i12 = ks.indexOf(prevYM(last, 12));
  const prior = i12 >= 0 ? series[i12] : null;
  // z over trailing 120 months
  const tail = series.slice(-120).filter((x) => x != null);
  const { m, sd } = stats(tail);
  return { label, unit, last: round(lastVal, decimals), prior: round(prior, decimals), z: round(sd ? (lastVal - m) / sd : 0, 2), asOf: last };
}
const dashboard = [
  dash("Core CPI", S.CORECPI, "yoy", "% YoY"),
  dash("CPI", S.CPI, "yoy", "% YoY"),
  dash("Core PCE", S.COREPCE, "yoy", "% YoY"),
  dash("Unemployment", S.UNRATE, "level", "%"),
  dash("Initial claims", S.ICSA, "level", "k", 0),
  dash("Payrolls (MoM)", S.PAYEMS, "mom", "% MoM", 2),
  dash("Retail sales", S.RSAFS, "yoy", "% YoY"),
  dash("Industrial prod.", S.INDPRO, "yoy", "% YoY"),
  dash("Mfg pulse (Philly)", S.PHILLY, "level", "idx", 1),
  dash("Sahm rule", S.SAHM, "level", "pp", 2),
  dash("Fed funds", S.FEDFUNDS, "level", "%"),
  dash("10y−3m curve", S.T10Y3M, "level", "pp", 2),
  dash("Fin. conditions", S.NFCI, "level", "idx", 2),
  dash("Michigan sent.", S.UMCSENT, "level", "idx", 0),
  dash("VIX", S.VIX, "level", "", 1),
].filter(Boolean);
fs.writeFileSync(path.join(OUT, "dashboard.json"), JSON.stringify(dashboard));

// ── lead-lag: correlation of indicator (transformed) with forward 3m SPY return
const fwd3 = new Map();
for (const ym of months) { const a = SPY.get(ym), b = SPY.get(prevYM(ym, -3)); if (a && b) fwd3.set(ym, (b / a - 1) * 100); }
function leadlag(label, getter, sign = 1) {
  const xs = [], ys = [];
  for (const ym of months) { const x = getter(ym), y = fwd3.get(ym); if (x != null && y != null) { xs.push(x * sign); ys.push(y); } }
  if (xs.length < 36) return null;
  return { label, corr: round(pearson(xs, ys), 2), n: xs.length };
}
// Raw correlations (no sign flips) of each indicator level/transform with the
// forward 3-month SPY return. The point is the near-zero magnitudes.
const leads = [
  leadlag("Unemployment rate", (ym) => S.UNRATE.get(ym)),
  leadlag("Initial claims", (ym) => S.ICSA.get(ym)),
  leadlag("VIX", (ym) => S.VIX.get(ym)),
  leadlag("Fin. conditions (NFCI)", (ym) => S.NFCI.get(ym)),
  leadlag("Michigan sentiment", (ym) => S.UMCSENT.get(ym)),
  leadlag("Retail sales YoY", (ym) => yoy(S.RSAFS, ym)),
  leadlag("Payrolls MoM", (ym) => mom(S.PAYEMS, ym)),
  leadlag("Industrial prod. YoY", (ym) => yoy(S.INDPRO, ym)),
  leadlag("Core CPI YoY", (ym) => yoy(S.CORECPI, ym)),
  leadlag("10y−3m curve", (ym) => S.T10Y3M.get(ym)),
].filter(Boolean).sort((a, b) => b.corr - a.corr);
fs.writeFileSync(path.join(OUT, "leadlag.json"), JSON.stringify(leads));

// ── regime quadrants: growth×inflation direction → forward 3m SPY return ─────
// growth composite = mean z of {INDPRO YoY, PAYEMS YoY, RSAFS YoY}; direction = sign(3m change)
function zSeries(getter) {
  const vals = months.map(getter);
  const { m, sd } = stats(vals);
  return months.map((ym, i) => (vals[i] == null ? null : (vals[i] - m) / sd));
}
const zIndpro = zSeries((ym) => yoy(S.INDPRO, ym));
const zPay = zSeries((ym) => yoy(S.PAYEMS, ym));
const zRetail = zSeries((ym) => yoy(S.RSAFS, ym));
const gc = months.map((_, i) => {
  const a = [zIndpro[i], zPay[i], zRetail[i]].filter((x) => x != null);
  return a.length ? a.reduce((s, x) => s + x, 0) / a.length : null;
});
const idx = (ym) => months.indexOf(ym);
const regimes = { "G↑ I↓": [], "G↑ I↑": [], "G↓ I↑": [], "G↓ I↓": [] };
const regimeNames = { "G↑ I↓": "Goldilocks", "G↑ I↑": "Reflation", "G↓ I↑": "Stagflation", "G↓ I↓": "Slowdown" };
let currentRegime = null;
for (let i = 6; i < months.length; i++) {
  const ym = months[i];
  const gNow = gc[i], gPast = gc[i - 3];
  const infNow = yoy(S.CORECPI, ym), infPast = yoy(S.CORECPI, months[i - 3]);
  const fr = fwd3.get(ym);
  if (gNow == null || gPast == null || infNow == null || infPast == null) continue;
  const gUp = gNow >= gPast, iUp = infNow > infPast;
  const key = `${gUp ? "G↑" : "G↓"} ${iUp ? "I↑" : "I↓"}`;
  if (fr != null) regimes[key].push(fr);
  if (S.UNRATE.get(ym) != null) currentRegime = { ym, key, name: regimeNames[key], gUp, iUp };
}
const regime = Object.entries(regimes).map(([key, arr]) => ({
  key, name: regimeNames[key],
  avgFwd3: round(arr.reduce((s, x) => s + x, 0) / arr.length, 1),
  hit: round((arr.filter((x) => x > 0).length / arr.length) * 100, 0),
  n: arr.length,
})).sort((a, b) => b.avgFwd3 - a.avgFwd3);
fs.writeFileSync(path.join(OUT, "regime.json"), JSON.stringify(regime));

const summary = {
  asOf: END, sample: `${months[0]} → ${months.at(-1)}`,
  current: currentRegime,
  dashboard, regime, leads,
  inflationLast: inflation.at(-1), laborLast: labor.at(-1),
};
fs.writeFileSync(path.join(OUT, "summary.json"), JSON.stringify(summary, null, 2));

console.log("\n=== DASHBOARD ===");
for (const d of dashboard) console.log(`${d.label.padEnd(18)} ${String(d.last).padStart(8)} ${d.unit.padEnd(6)} (1y ${String(d.prior).padStart(7)})  z=${String(d.z).padStart(6)}`);
console.log("\n=== LEAD-LAG (corr w/ fwd 3m SPY) ===");
for (const l of leads) console.log(`${l.label.padEnd(28)} ${String(l.corr).padStart(6)}  n=${l.n}`);
console.log("\n=== REGIME (fwd 3m SPY return) ===");
for (const r of regime) console.log(`${(r.key + " " + r.name).padEnd(22)} avgFwd=${String(r.avgFwd3).padStart(6)}%  hit=${String(r.hit).padStart(3)}%  n=${r.n}`);
console.log("\ncurrent regime:", currentRegime);
console.log(`\nwrote JSON to ${OUT}`);
