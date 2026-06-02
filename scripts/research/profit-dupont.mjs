// Data pipeline for the research piece:
//   "Three Roads to ROE: A DuPont Decomposition of Mega-Cap Profitability"
// Source: SEC EDGAR company-facts (10-K/XBRL, no key). Fiscal-year aligned.
// DuPont identity: ROE = NetMargin × AssetTurnover × EquityMultiplier.
// Re-run: node scripts/research/profit-dupont.mjs

import fs from "node:fs";
import path from "node:path";

const UA = "quantamental-research anthonyhuang@aya.yale.edu";
const H = { "User-Agent": UA, Accept: "application/json" };
const OUT = path.join("content", "research", "2026-04-15-profit-dupont", "data");

// ticker, name, sector
const UNIVERSE = [
  ["AAPL", "Apple", "Technology"],
  ["MSFT", "Microsoft", "Technology"],
  ["NVDA", "NVIDIA", "Technology"],
  ["AVGO", "Broadcom", "Technology"],
  ["GOOGL", "Alphabet", "Comm Services"],
  ["META", "Meta Platforms", "Comm Services"],
  ["NFLX", "Netflix", "Comm Services"],
  ["AMZN", "Amazon", "Cons Discretionary"],
  ["HD", "Home Depot", "Cons Discretionary"],
  ["TJX", "TJX Companies", "Cons Discretionary"],
  ["WMT", "Walmart", "Cons Staples"],
  ["COST", "Costco", "Cons Staples"],
  ["PG", "Procter & Gamble", "Cons Staples"],
  ["KO", "Coca-Cola", "Cons Staples"],
  ["PEP", "PepsiCo", "Cons Staples"],
  ["UNH", "UnitedHealth", "Health Care"],
  ["JNJ", "Johnson & Johnson", "Health Care"],
  ["LLY", "Eli Lilly", "Health Care"],
  ["MRK", "Merck", "Health Care"],
  ["XOM", "Exxon Mobil", "Energy"],
  ["CVX", "Chevron", "Energy"],
  ["CAT", "Caterpillar", "Industrials"],
  ["DE", "Deere", "Industrials"],
];
// Financials (banks) and regulated utilities are intentionally excluded: DuPont
// asset-turnover is not economically comparable for balance-sheet-driven or
// rate-base businesses, and several use non-standard revenue XBRL tags.

const REV = ["Revenues", "RevenueFromContractWithCustomerExcludingAssessedTax", "SalesRevenueNet"];
const NI = ["NetIncomeLoss"];
const GP = ["GrossProfit"];
const OI = ["OperatingIncomeLoss"];
const ASSETS = ["Assets"];
const EQ = ["StockholdersEquity", "StockholdersEquityIncludingPortionAttributableToNoncontrollingInterest"];

function annualByEnd(facts, tags, flow) {
  const byEnd = new Map();
  for (const tag of tags) {
    const node = facts?.["us-gaap"]?.[tag]?.units?.USD;
    if (!node) continue;
    for (const e of node) {
      if (!/10-K/.test(e.form ?? "")) continue;
      if (flow) {
        const dur = e.start && e.end ? (new Date(e.end) - new Date(e.start)) / 86400000 : 0;
        if (!(dur > 340 && dur < 380)) continue;
      }
      const prev = byEnd.get(e.end);
      if (!prev || (e.filed ?? "") > (prev.filed ?? "")) byEnd.set(e.end, { end: e.end, val: e.val, tag, filed: e.filed });
    }
  }
  return [...byEnd.values()].sort((a, b) => new Date(b.end) - new Date(a.end));
}
const valAt = (entries, end) =>
  entries.find((e) => e.end === end) ?? entries.filter((e) => new Date(e.end) <= new Date(end))[0] ?? entries[0] ?? null;

async function facts(cik) {
  const res = await fetch(`https://data.sec.gov/api/xbrl/companyfacts/CIK${cik}.json`, { headers: H });
  if (!res.ok) return null;
  return (await res.json()).facts;
}

const tickers = await (await fetch("https://www.sec.gov/files/company_tickers.json", { headers: H })).json();
const cikMap = {};
for (const k in tickers) cikMap[tickers[k].ticker] = String(tickers[k].cik_str).padStart(10, "0");

const round = (x, n = 2) => (x == null || !Number.isFinite(x) ? null : Number(x.toFixed(n)));
const companies = [];
const trendAgg = new Map(); // calYear -> {ni, rev, oi}

for (const [ticker, name, sector] of UNIVERSE) {
  const cik = cikMap[ticker];
  const f = cik ? await facts(cik) : null;
  if (!f) { console.log(ticker, "skip (no facts)"); continue; }

  const niE = annualByEnd(f, NI, true);
  const revE = annualByEnd(f, REV, true);
  const oiE = annualByEnd(f, OI, true);
  const gpE = annualByEnd(f, GP, true);
  const asE = annualByEnd(f, ASSETS, false);
  const eqE = annualByEnd(f, EQ, false);
  if (!niE.length || !revE.length || !asE.length || !eqE.length) { console.log(ticker, "skip (missing core)"); continue; }

  const end = niE[0].end;
  const ni = niE[0].val, rev = valAt(revE, end)?.val, as = valAt(asE, end)?.val, eq = valAt(eqE, end)?.val;
  const oi = valAt(oiE, end)?.val ?? null, gp = valAt(gpE, end)?.val ?? null;

  if (!(rev > 0 && as > 0 && eq > 0)) { console.log(ticker, "skip (non-positive core / negative equity)"); continue; }

  const netMargin = (ni / rev) * 100;
  const assetTurn = rev / as;
  const leverage = as / eq;
  const roe = (ni / eq) * 100; // ROE% directly; equals nm×at×lev by identity
  console.log(`  ${ticker.padEnd(5)} rev=${(rev/1e9).toFixed(0)}B ni=${(ni/1e9).toFixed(0)}B nm=${netMargin.toFixed(1)}% roe=${roe.toFixed(1)}%`);
  companies.push({
    ticker, name, sector, fye: end,
    revenue: round(rev / 1e9, 1),
    netMargin: round(netMargin, 1),
    opMargin: oi != null ? round((oi / rev) * 100, 1) : null,
    grossMargin: gp != null ? round((gp / rev) * 100, 1) : null,
    assetTurn: round(assetTurn, 2),
    leverage: round(leverage, 2),
    roa: round((ni / as) * 100, 1),
    roe: round(roe, 1),
  });

  // historical aggregate margin trend (bucket by fiscal-end calendar year)
  for (const e of niE) {
    const yr = +e.end.slice(0, 4);
    if (yr < 2017) continue;
    const r = valAt(revE, e.end)?.val;
    if (!r) continue;
    const o = valAt(oiE, e.end)?.val ?? null;
    const cur = trendAgg.get(yr) ?? { ni: 0, rev: 0, oi: 0, oiRev: 0 };
    cur.ni += e.val; cur.rev += r;
    if (o != null) { cur.oi += o; cur.oiRev += r; }
    trendAgg.set(yr, cur);
  }
  process.stdout.write(`${ticker} `);
}
console.log("");

companies.sort((a, b) => b.roe - a.roe);

// sector aggregates (revenue-weighted net margin; median ROE)
const bySector = new Map();
for (const c of companies) {
  const s = bySector.get(c.sector) ?? { sector: c.sector, ni: 0, rev: 0, roes: [], n: 0 };
  s.ni += (c.netMargin / 100) * (c.revenue ?? 0);
  s.rev += c.revenue ?? 0;
  s.roes.push(c.roe);
  s.n++;
  bySector.set(c.sector, s);
}
const median = (a) => { const s = [...a].sort((x, y) => x - y); const m = Math.floor(s.length / 2); return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2; };
const sectors = [...bySector.values()]
  .map((s) => ({ sector: s.sector, netMargin: round((s.ni / s.rev) * 100, 1), medianRoe: round(median(s.roes), 1), n: s.n }))
  .sort((a, b) => b.netMargin - a.netMargin);

const trend = [...trendAgg.entries()]
  .filter(([y]) => y >= 2017 && y <= 2025)
  .sort((a, b) => a[0] - b[0])
  .map(([year, v]) => ({
    year: String(year),
    netMargin: round((v.ni / v.rev) * 100, 1),
    opMargin: v.oiRev > 0 ? round((v.oi / v.oiRev) * 100, 1) : null,
  }));

fs.mkdirSync(OUT, { recursive: true });
fs.writeFileSync(path.join(OUT, "companies.json"), JSON.stringify(companies));
fs.writeFileSync(path.join(OUT, "sectors.json"), JSON.stringify(sectors));
fs.writeFileSync(path.join(OUT, "margin_trend.json"), JSON.stringify(trend));

const summary = {
  asOf: "2026-04-15",
  nCompanies: companies.length,
  sectors: sectors.length,
  topRoe: companies.slice(0, 3).map((c) => ({ t: c.ticker, roe: c.roe, lev: c.leverage, nm: c.netMargin, at: c.assetTurn })),
  trendEnds: { first: trend[0], last: trend.at(-1) },
};
fs.writeFileSync(path.join(OUT, "summary.json"), JSON.stringify(summary, null, 2));

console.log("=== COMPANIES (by ROE) ===");
for (const c of companies)
  console.log(`${c.ticker.padEnd(6)} ${c.sector.padEnd(20)} ROE ${String(c.roe).padStart(6)}%  nm ${String(c.netMargin).padStart(5)}  at ${String(c.assetTurn).padStart(5)}  lev ${String(c.leverage).padStart(5)}`);
console.log("\n=== SECTORS ===");
for (const s of sectors) console.log(`${s.sector.padEnd(20)} netMgn ${String(s.netMargin).padStart(5)}%  medROE ${String(s.medianRoe).padStart(5)}%  n=${s.n}`);
console.log("\n=== MARGIN TREND ===");
console.log(trend.map((t) => `${t.year}:${t.netMargin}%`).join("  "));
console.log(`\nwrote JSON to ${OUT}`);
