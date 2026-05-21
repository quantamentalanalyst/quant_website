// Synthesizes a realistic 5-year equity curve for the homepage centerpiece.
// Deterministic — seeded mulberry32. Includes a regime break (drawdown +
// recovery rally) so the chart has actual shape, not pure GBM mush.
//
// Run: node scripts/gen-equity.mjs

import fs from "node:fs";
import path from "node:path";

function mulberry32(a) {
  return function () {
    let t = (a += 0x6d2b79f5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
function gauss(rng) {
  const u = 1 - rng();
  const v = rng();
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
}

const rng = mulberry32(20260521);
const totalDays = 1260; // ~5 trading years
const sigmaAnn = 0.14;
const sigma = sigmaAnn / Math.sqrt(252);

const out = [];
let value = 100;
let d = new Date("2021-05-24"); // Monday

for (let i = 0; i < totalDays; i++) {
  while (d.getDay() === 0 || d.getDay() === 6) d.setDate(d.getDate() + 1);

  // Three-regime drift: trending up, a -20% drawdown, then a rally back.
  let muAnn = 0.11;
  if (i >= 560 && i < 700) muAnn = -0.08;
  if (i >= 700 && i < 820) muAnn = 0.22;
  const mu = muAnn / 252;

  const ret = mu + sigma * gauss(rng);
  value *= 1 + ret;

  out.push({ date: d.toISOString().slice(0, 10), value: +value.toFixed(2) });
  d.setDate(d.getDate() + 1);
}

const dest = path.join("content", "equity.json");
fs.writeFileSync(dest, JSON.stringify(out));
console.log(`wrote ${out.length} points; final NAV=${value.toFixed(2)}`);
