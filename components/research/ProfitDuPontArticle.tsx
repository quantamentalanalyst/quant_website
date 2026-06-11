import Link from "next/link";
import { site } from "@/lib/site";
import type { ResearchMeta } from "@/lib/content";
import Figure from "./Figure";
import { TeX, TeXBlock } from "./TeX";
import { Num } from "@/components/ui/Num";
import LineChart from "./charts/LineChart";
import BarH from "./charts/BarH";
import Bubble from "./charts/Bubble";
import Scatter from "./charts/Scatter";

import companies from "@/content/research/2026-04-15-profit-dupont/data/companies.json";
import sectors from "@/content/research/2026-04-15-profit-dupont/data/sectors.json";
import marginTrend from "@/content/research/2026-04-15-profit-dupont/data/margin_trend.json";
import valuation from "@/content/research/2026-04-15-profit-dupont/data/valuation.json";
import forward from "@/content/research/2026-04-15-profit-dupont/data/forward.json";
import rates from "@/content/research/2026-04-15-profit-dupont/data/rates.json";
import attribution from "@/content/research/2026-04-15-profit-dupont/data/attribution.json";

const AMBER = "var(--color-accent)";
const CYAN = "var(--color-data)";
const POS = "var(--color-pos)";
const SEC = "SEC EDGAR company-facts (10-K / XBRL)";
const YH = "Yahoo Finance";
const CALC = "author's calculations";

type Co = (typeof companies)[number];
const find = (t: string) => companies.find((c) => c.ticker === t)!;

function P({ children }: { children: React.ReactNode }) {
  return <p className="mb-4 font-mono text-[13px] leading-[22px] text-text">{children}</p>;
}
function Section({ n, title }: { n: string; title: string }) {
  return (
    <h2 className="mb-3 mt-9 flex items-baseline gap-3 border-b border-rule pb-1.5">
      <span className="section-label text-accent">{n}</span>
      <span className="text-[16px] text-text">{title}</span>
    </h2>
  );
}
const Em = ({ children }: { children: React.ReactNode }) => <span className="text-data">{children}</span>;
const Th = ({ children, r }: { children: React.ReactNode; r?: boolean }) => (
  <th className={`px-2 py-1.5 font-medium ${r ? "text-right" : "text-left"}`}>{children}</th>
);
const sgn = (x: number) => (x < 0 ? "−" : "") + Math.abs(x);
const driverColor = (d: string) => (d === "margin" ? "text-data" : d === "turnover" ? "text-accent" : d === "leverage" ? "text-text-dim" : "text-text-faint");
function dominantShare(c: Co) {
  if (c.driver === "margin") return c.shareMargin;
  if (c.driver === "turnover") return c.shareTurn;
  if (c.driver === "leverage") return c.shareLev;
  return null;
}
// tiny OLS for the scatter fit
function linfit(pts: { x: number; y: number }[]) {
  const n = pts.length, mx = pts.reduce((s, p) => s + p.x, 0) / n, my = pts.reduce((s, p) => s + p.y, 0) / n;
  let sxy = 0, sxx = 0, syy = 0;
  for (const p of pts) { const dx = p.x - mx, dy = p.y - my; sxy += dx * dy; sxx += dx * dx; syy += dy * dy; }
  const beta = sxy / sxx, alpha = my - beta * mx, r = sxy / Math.sqrt(sxx * syy);
  const t = r * Math.sqrt((n - 2) / (1 - r * r));
  return { beta: Number(beta.toFixed(2)), alpha: Number(alpha.toFixed(2)), r2: Number((r * r).toFixed(3)), t: Number(t.toFixed(1)), n };
}

export default function ProfitDuPontArticle({ meta }: { meta: ResearchMeta }) {
  const meaningful = companies.filter((c) => c.roe != null).sort((a, b) => b.roe! - a.roe!);
  const distorted = companies.filter((c) => c.distorted);
  const nvda = find("NVDA"), aapl = find("AAPL"), hd = find("HD"), cost = find("COST"), meta_ = find("META");

  // Fig 1: ROE ranking (top 18 meaningful), annotated with true leverage (net debt/equity)
  const roeRows = meaningful.slice(0, 18).map((c) => ({
    label: c.ticker, value: c.roe!,
    tag: c.netDebtEq != null ? `${c.netDebtEq <= 0 ? "net cash" : c.netDebtEq.toFixed(1) + "×"}` : "—",
  }));
  // Fig 2: DuPont bubble (meaningful, drop the few with very high mult for scale)
  const bubblePts = meaningful.filter((c) => c.equityMult! <= 9).map((c) => ({ x: c.netMargin, y: c.assetTurn, size: c.equityMult!, label: c.ticker }));
  // Fig 3: quality vs FCF yield (is quality priced?)
  const qvPts = valuation.filter((v) => v.quality != null && v.fcfYield != null && v.fcfYield > -8 && v.fcfYield < 15).map((v) => ({ x: v.quality as number, y: v.fcfYield as number, label: v.ticker }));
  const qvFit = linfit(qvPts);
  // Fig 4: return attribution as % of decade price gain
  const a = attribution.median, attTot = a.revenue + a.multiple + a.margin + a.buyback;
  const attRows = [
    { label: "revenue growth", value: Math.round((a.revenue / attTot) * 100) },
    { label: "multiple re-rating", value: Math.round((a.multiple / attTot) * 100) },
    { label: "margin expansion", value: Math.round((a.margin / attTot) * 100) },
    { label: "buybacks (Δ share count)", value: Math.round((a.buyback / attTot) * 100) },
  ];
  // quality ranking
  const byQ = companies.filter((c) => c.quality != null).sort((x, y) => y.quality! - x.quality!);
  const topQ = byQ.slice(0, 7), botQ = byQ.slice(-5).reverse();
  const fg = (d: string) => forward.groups.find((g) => g.driver === d)!;
  const t0 = marginTrend[0], t1 = marginTrend[marginTrend.length - 1];

  return (
    <article className="mx-auto max-w-[880px] pb-16">
      <header className="border-b border-rule-strong pb-5">
        <div className="mb-3 flex flex-wrap items-center gap-3 text-[10px]">
          <span className="bg-accent px-1.5 py-0.5 font-medium uppercase tracking-[0.1em] text-bg">driver · {meta.driver}</span>
          <span className="font-tabular text-text-faint">{meta.date}</span>
          <span className="text-text-faint">·</span>
          <span className="text-text-faint">{meta.readingTime} min read</span>
          <span className="text-text-faint">·</span>
          <span className="text-text-faint">{site.name}</span>
        </div>
        <h1 className="text-[26px] leading-[1.15] text-text">{meta.title}</h1>
        <p className="mt-4 max-w-[74ch] font-mono text-[13px] leading-[22px] text-text-dim">{meta.abstract}</p>
      </header>

      {/* 00 thesis */}
      <Section n="00" title="Thesis" />
      <P>
        Return on equity is the headline summary of corporate profitability, but it is not one signal —
        it is three economically different engines bolted together: operating <em>margin</em>, asset{" "}
        <em>turnover</em>, and the <em>equity multiplier</em>. The 1920s DuPont identity separates them.
        This piece does two things v1 did not: it builds the decomposition on <em>average</em> balances
        and separates the buyback-inflated equity multiplier from genuine financial leverage, and it{" "}
        <em>tests</em> what the source of ROE predicts — persistence, forward returns, risk, and rate
        sensitivity — rather than asserting that one source is higher quality. The sample is {companies.length}{" "}
        large-cap US non-financials, every figure from 10-K/XBRL filings, 2010–2025.
      </P>
      <ul className="mb-4 ml-1 space-y-1.5 font-mono text-[13px] leading-[20px] text-text">
        {[
          <>Within this basket, the highest headline ROEs are largely a <em>denominator effect</em>. For {distorted.length} names buybacks have shrunk book equity so far that ROE is mechanically meaningless; for these the equity multiplier (assets/equity) bears almost no relation to debt — Home Depot's <Em>{hd.equityMultRaw}×</Em> multiplier is just <Em>{hd.netDebtEbitda}×</Em> net-debt/EBITDA.</>,
          <>The equity multiplier is <em>not</em> financial leverage. Across the universe it correlates only <Em>{rates.corrMultNdeq!.r}</Em> with true net-debt/equity, and a high-minus-low multiplier portfolio has <em>no</em> significant rate beta ({rates.equityMult!.rate >= 0 ? "+" : "−"}{Math.abs(rates.equityMult!.rate)}%/100bp, t = {rates.equityMult!.tRate}). The claim that buyback-built ROE is “rate-sensitive” does not survive the test.</>,
          <>A reproducible log-decomposition classifier and a formal quality score replace hand-labels. <Em>{nvda.ticker}</Em> tops the quality ranking (score {nvda.quality}) — {nvda.roic}% ROIC, net cash, a {nvda.equityMult}× multiplier — the genuine article, not a leverage artifact.</>,
          <>The forward tests are honest and nuanced: turnover-sourced ROE has the most stable margins and the best subsequent returns; leverage-sourced ROE is the most <em>persistent</em> — a buyback policy is stickier than a margin competition erodes — but that persistence is mechanical, not quality.</>,
        ].map((t, i) => (
          <li key={i} className="flex gap-2"><span className="text-accent">{String(i + 1).padStart(2, "0")}</span><span>{t}</span></li>
        ))}
      </ul>

      {/* 01 why ROE alone fails */}
      <Section n="01" title="Why ROE alone fails" />
      <P>
        Two firms, the same return on equity, opposite businesses. <Em>{meta_.name}</Em> earned a{" "}
        {meta_.roe!.toFixed(0)}% ROE last year on a <Em>{meta_.netMargin}%</Em> net margin turning assets{" "}
        {meta_.assetTurn}× — a pure <em>margin</em> machine. <Em>{cost.name}</Em> earned an almost
        identical {cost.roe!.toFixed(0)}% ROE on a <Em>{cost.netMargin}%</Em> net margin — a tenth of
        Meta's — by spinning assets <Em>{cost.assetTurn}×</Em> a year, a pure <em>turnover</em> machine.
        Same headline number; one is pricing power, the other is operational velocity, and they have
        completely different durability, capital needs, and rate exposure. A screen that ranks on ROE
        alone treats them as identical. The decomposition is the whole point.
      </P>

      {/* 02 the identity done right */}
      <Section n="02" title="The identity, measured properly" />
      <P>
        ROE factors, by construction, into three multiplicative terms. The denominators are{" "}
        <em>average</em> beginning-and-ending balances — not ending-only, which mechanically overstates
        ROE and the multiplier for firms repurchasing stock into year-end:
      </P>
      <TeXBlock eq="1">{"\\mathrm{ROE}=\\underbrace{\\frac{\\text{NI}}{\\text{Rev}}}_{\\text{margin}}\\times\\underbrace{\\frac{\\text{Rev}}{\\overline{\\text{Assets}}}}_{\\text{turnover}}\\times\\underbrace{\\frac{\\overline{\\text{Assets}}}{\\overline{\\text{Equity}}}}_{\\text{multiplier}}"}</TeXBlock>
      <P>
        The third term is where v1 — and most DuPont write-ups — go wrong. The equity multiplier{" "}
        <TeX>{"\\overline{\\text{Assets}}/\\overline{\\text{Equity}}"}</TeX> is <em>not</em> financial
        leverage. It rises for three quite different reasons: real debt, operating liabilities (payables,
        deferred revenue, lease liabilities), and — dominantly for mega-caps — <em>buyback-shrunk book
        equity</em>. Only the first is a debt-service exposure. So alongside the multiplier I measure
        genuine leverage directly — net debt / equity and net debt / EBITDA — and a robust,
        denominator-safe profitability measure, <Em>ROIC</Em> = NOPAT / invested capital, plus operating
        profitability on assets (the Fama-French RMW lens). When the equity base is distorted, these are
        what survive.
      </P>
      <div className="my-5 border-l-2 border-accent bg-bg-elev px-4 py-3">
        <div className="section-label mb-1.5 text-accent">classifier — the three roads, made reproducible</div>
        <p className="font-mono text-[12px] leading-[20px] text-text-dim">
          Because ROE is multiplicative, contributions are additive in logs:{" "}
          <TeX>{"\\log\\mathrm{ROE}=\\log m+\\log a+\\log \\ell"}</TeX>. A firm's <span className="text-text">road</span> is
          the term whose deviation from the cross-section median log is largest; the percentage shares
          (margin / turnover / leverage) report how far each term pushes ROE above or below the typical
          firm. No hand-labels — Coca-Cola is “margin” or “leverage” by the arithmetic, not by narrative.
        </p>
      </div>

      {/* 03 the decomposition */}
      <Section n="03" title="The mega-cap decomposition" />
      <P>
        Figure 1 ranks the {meaningful.length} firms whose ROE is meaningful, annotated with{" "}
        <em>true</em> leverage (net debt / equity). The annotation is the point: the highest ROEs are{" "}
        <em>not</em> the most levered. {aapl.name}'s {aapl.roe!.toFixed(0)}% sits on net-debt/equity of
        just {aapl.netDebtEq}× and {nvda.name}'s {nvda.roe!.toFixed(0)}% on <em>net cash</em>. Table 1
        gives the full decomposition with each firm's dominant road and contribution share.
      </P>
      <Figure n={1} title="Return on equity (average equity), meaningful-ROE firms — annotated with true leverage" source={`${SEC}; ${CALC}. Bars = ROE %; right label = net debt / equity (“net cash” if ≤ 0). Trailing-3y average balances.`}>
        <BarH rows={roeRows} unit="%" decimals={0} color={AMBER} labelWidth={52} tagWidth={64} />
      </Figure>
      <div className="my-6 overflow-x-auto border border-rule">
        <table className="w-full border-collapse font-mono text-[11px]">
          <thead>
            <tr className="border-b border-rule-strong bg-bg-elev text-[9px] uppercase tracking-[0.03em] text-text-faint">
              <Th>Company</Th><Th r>ROE</Th><Th r>Net mgn</Th><Th r>Turn</Th><Th r>Mult</Th><Th r>ND/EBITDA</Th><Th r>ROIC</Th><Th>Road (share)</Th>
            </tr>
          </thead>
          <tbody>
            {meaningful.slice(0, 22).map((c) => (
              <tr key={c.ticker} className="border-b border-rule">
                <td className="px-2 py-1 text-text">{c.ticker} <span className="text-text-faint">{c.name}</span></td>
                <td className="px-2 py-1 text-right text-text"><Num value={c.roe} decimals={0} />%</td>
                <td className="px-2 py-1 text-right text-text-dim"><Num value={c.netMargin} decimals={1} />%</td>
                <td className="px-2 py-1 text-right text-text-dim"><Num value={c.assetTurn} decimals={2} /></td>
                <td className="px-2 py-1 text-right text-text-dim"><Num value={c.equityMult} decimals={1} />×</td>
                <td className="px-2 py-1 text-right text-text-dim">{c.netDebtEbitda != null ? <><Num value={c.netDebtEbitda} decimals={1} />×</> : <span className="text-text-faint">—</span>}</td>
                <td className="px-2 py-1 text-right text-text-dim"><Num value={c.roic} decimals={0} />%</td>
                <td className="px-2 py-1"><span className={driverColor(c.driver)}>{c.driver}</span> <span className="text-text-faint">{dominantShare(c)}%</span></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="mb-4 text-[10px] text-text-faint">Table 1. DuPont decomposition on trailing-3y average balances, top 22 of {meaningful.length} meaningful-ROE firms by ROE. Road = largest log-deviation from the universe median; share = that term's % contribution to the firm's log-ROE deviation. Source: {SEC}, {YH}; {CALC}.</p>
      <Figure n={2} title="DuPont map: net margin × asset turnover, bubble size ∝ equity multiplier" source={`${SEC}; ${CALC}. x = net margin %, y = revenue/avg assets, radius ∝ √(multiplier). Firms with multiplier ≤ 9 shown.`}>
        <Bubble points={bubblePts} xLabel="net margin" xUnit="%" yLabel="asset turnover (rev/assets)" height={380} />
      </Figure>
      <P>
        The map separates the roads cleanly. The <Em>margin road</Em> runs up the right edge — NVIDIA,
        Microsoft, Meta, the software and pharma franchises earning 25–53 cents per revenue dollar at
        modest turnover. The <Em>turnover road</Em> sits top-left: Costco and Walmart, ~3% margins spun
        2.6–3.7× a year. Bubble size — the multiplier — is the leverage road, but as the next section
        shows, that size is mostly buybacks, not borrowing.
      </P>

      {/* 04 denominator breakdown */}
      <Section n="04" title="When the denominator breaks: the multiplier is not leverage" />
      <P>
        For {distorted.length} firms the equity base has been repurchased down so far that ROE — and the
        multiplier — stop measuring anything. Table 2 lists them. The headline is the gap between the two
        leverage columns: Home Depot's equity multiplier reads <Em>{hd.equityMultRaw}×</Em>, but its{" "}
        <em>actual</em> balance-sheet leverage is <Em>{hd.netDebtEbitda}×</Em> net-debt/EBITDA — a
        thoroughly ordinary credit profile. Colgate's “multiplier” is{" "}
        <Em>{find("CL").equityMultRaw}×</Em>; its net-debt/EBITDA is {find("CL").netDebtEbitda}×. These
        are not levered firms; they are firms that returned so much capital that book equity is a rounding
        error. Calling that “leverage,” as v1 did, is the central conceptual error — and note that for the
        negative-equity names even <em>ROIC</em> distorts (Philip Morris prints {find("PM").roic}% because
        invested capital is near zero too); the robust read for this group is asset-based operating
        profitability.
      </P>
      <div className="my-6 overflow-x-auto border border-rule">
        <table className="w-full border-collapse font-mono text-[11px]">
          <thead>
            <tr className="border-b border-rule-strong bg-bg-elev text-[9px] uppercase tracking-[0.03em] text-text-faint">
              <Th>Company</Th><Th>Why distorted</Th><Th r>Equity mult</Th><Th r>ND/EBITDA (true)</Th><Th r>Op. profit/assets</Th><Th r>ROIC</Th>
            </tr>
          </thead>
          <tbody>
            {distorted.sort((x, y) => (y.equityMultRaw ?? 999) - (x.equityMultRaw ?? 999)).map((c) => (
              <tr key={c.ticker} className="border-b border-rule">
                <td className="px-2 py-1 text-text">{c.ticker} <span className="text-text-faint">{c.name}</span></td>
                <td className="px-2 py-1 text-[10px] text-text-dim">{c.negEquity ? "negative book equity" : "equity < 7% of assets"}</td>
                <td className="px-2 py-1 text-right">{c.negEquity ? <span className="text-neg">neg.</span> : <span className="text-text"><Num value={c.equityMultRaw} decimals={0} />×</span>}</td>
                <td className="px-2 py-1 text-right text-data">{c.netDebtEbitda != null ? <><Num value={c.netDebtEbitda} decimals={1} />×</> : <span className="text-text-faint">—</span>}</td>
                <td className="px-2 py-1 text-right text-text-dim">{c.opProf != null ? <><Num value={c.opProf} decimals={0} />%</> : <span className="text-text-faint">—</span>}</td>
                <td className="px-2 py-1 text-right text-text-dim"><Num value={c.roic} decimals={0} />%</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="mb-4 text-[10px] text-text-faint">Table 2. The {distorted.length} denominator-distorted firms (excluded from all ROE-based statistics). The equity multiplier overstates leverage by 5–20× versus net-debt/EBITDA. Source: {SEC}; {CALC}.</p>

      {/* 05 quality score */}
      <Section n="05" title="A formal ROE quality score" />
      <P>
        “High-quality ROE” needs a definition, not an adjective. I define it as ROE that is high,
        operating-driven, well-covered by ROIC, lightly levered, and stable — and score it
        cross-sectionally:
      </P>
      <TeXBlock eq="2">{"Q=z(\\mathrm{ROE})+z(\\text{margin})+z(\\mathrm{ROIC})-z(\\text{multiplier})-z(\\tfrac{\\text{net debt}}{\\text{EBITDA}})-z(\\sigma_{\\text{margin}})"}</TeXBlock>
      <P>
        The ranking (Table 3) is intuitive in a way the raw ROE ranking is not. <Em>{topQ[0].ticker}</Em>{" "}
        and <Em>{topQ[1].ticker}</Em> top it — high ROIC, fat margins, net cash, low margin volatility —
        while the bottom is populated by the genuinely levered and the cyclically volatile (AT&T, Deere,
        the levered staples). This is the list a quality factor should hold; it is almost the inverse of a
        naïve ROE screen, which would put the buyback-distorted names on top.
      </P>
      <div className="grid gap-5 md:grid-cols-2">
        <div className="overflow-x-auto border border-rule">
          <table className="w-full border-collapse font-mono text-[11px]">
            <thead>
              <tr className="border-b border-rule-strong bg-bg-elev text-[9px] uppercase tracking-[0.03em] text-text-faint">
                <Th>Top quality</Th><Th r>score</Th><Th r>ROIC</Th><Th>road</Th>
              </tr>
            </thead>
            <tbody>
              {topQ.map((c) => (
                <tr key={c.ticker} className="border-b border-rule">
                  <td className="px-2 py-1 text-text">{c.ticker} <span className="text-text-faint">{c.name}</span></td>
                  <td className="px-2 py-1 text-right font-tabular text-pos">+{c.quality!.toFixed(1)}</td>
                  <td className="px-2 py-1 text-right text-text-dim">{c.roic}%</td>
                  <td className={`px-2 py-1 ${driverColor(c.driver)}`}>{c.driver}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="overflow-x-auto border border-rule">
          <table className="w-full border-collapse font-mono text-[11px]">
            <thead>
              <tr className="border-b border-rule-strong bg-bg-elev text-[9px] uppercase tracking-[0.03em] text-text-faint">
                <Th>Bottom quality</Th><Th r>score</Th><Th r>ROIC</Th><Th>road</Th>
              </tr>
            </thead>
            <tbody>
              {botQ.map((c) => (
                <tr key={c.ticker} className="border-b border-rule">
                  <td className="px-2 py-1 text-text">{c.ticker} <span className="text-text-faint">{c.name}</span></td>
                  <td className="px-2 py-1 text-right font-tabular text-neg">{c.quality!.toFixed(1)}</td>
                  <td className="px-2 py-1 text-right text-text-dim">{c.roic}%</td>
                  <td className={`px-2 py-1 ${driverColor(c.driver)}`}>{c.driver}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
      <p className="mb-4 mt-2 text-[10px] text-text-faint">Table 3. ROE quality score, cross-sectional z-scores over the {byQ.length} meaningful-ROE firms. Sector-neutral z-scores (margin/turnover/multiplier within GICS sector) are also computed in the data. Source: {SEC}, {YH}; {CALC}.</p>

      {/* 06 is quality priced */}
      <Section n="06" title="Is quality priced?" />
      <P>
        Quality is only an edge net of price. Figure 3 plots the quality score against free-cash-flow
        yield. The fit slopes down (β = {qvFit.beta}, t = {qvFit.t}): higher-quality names do trade
        richer — the market is not asleep. But the relationship is loose (R² = {qvFit.r2.toFixed(2)}), and
        the residuals are the opportunity. The marquee compounders — NVIDIA, Apple, Costco — sit
        bottom-right (top quality, ~2% FCF yields: quality you pay full freight for). The interesting
        quadrant is top-right: <Em>Adobe</Em> ({find("ADBE").quality! >= 0 ? "+" : ""}{find("ADBE").quality} quality,{" "}
        <Em>{valuation.find((v) => v.ticker === "ADBE")!.fcfYield}%</Em> FCF yield) and <Em>Accenture</Em>{" "}
        ({valuation.find((v) => v.ticker === "ACN")!.fcfYield}% yield) offer top-quartile quality at
        mid-teens P/Es. And the cheap, high-yield names on the left — AT&T, Verizon — are cheap precisely
        because the score flags their ROE as low-quality and levered. Cheapness without quality is a value
        trap with a DuPont signature.
      </P>
      <Figure n={3} title="Is quality priced? ROE quality score vs. free-cash-flow yield" source={`${SEC} and ${YH}; ${CALC}. x = quality score (z-composite), y = FCF / market cap %. Line = OLS fit.`}>
        <Scatter points={qvPts} fit={qvFit} height={340} xLabel="ROE quality score" yLabel="FCF yield %" />
      </Figure>

      {/* 07 forward tests */}
      <Section n="07" title="Does the source predict anything? The forward tests" />
      <P>
        This is the upgrade from description to research. I classify every firm-year 2010–2024 by road
        (log-decomposition vs that year's cross-section), then measure forward outcomes — the panel is{" "}
        {forward.nPanel.toLocaleString()} firm-years. The results (Table 4) are real but resist a tidy
        morality tale. <em>Turnover</em>-sourced ROE looks best on the metrics that matter: the highest
        median forward 12-month return (<Em>+{fg("turnover").fwdRet}%</Em> vs +{fg("margin").fwdRet}% and
        +{fg("leverage").fwdRet}%), the lowest forward volatility, and by far the most stable fundamentals
        — forward margin volatility of just <Em>{fg("turnover").fwdMarginVol}</Em> points, against{" "}
        {fg("margin").fwdMarginVol} for the high-margin names, whose fat margins swing the most. Risk
        (forward drawdown) is similar across all three.
      </P>
      <div className="my-6 overflow-x-auto border border-rule">
        <table className="w-full border-collapse font-mono text-[11px]">
          <thead>
            <tr className="border-b border-rule-strong bg-bg-elev text-[9px] uppercase tracking-[0.03em] text-text-faint">
              <Th>ROE source</Th><Th r>n (firm-yrs)</Th><Th r>fwd 1y ROE retain</Th><Th r>fwd 12m return</Th><Th r>fwd volatility</Th><Th r>fwd max DD</Th><Th r>fwd margin vol</Th>
            </tr>
          </thead>
          <tbody>
            {(["margin", "turnover", "leverage"] as const).map((d) => { const g = fg(d); return (
              <tr key={d} className="border-b border-rule">
                <td className={`px-2 py-1 ${driverColor(d)}`}>{d}-driven</td>
                <td className="px-2 py-1 text-right font-tabular text-text-faint">{g.n}</td>
                <td className="px-2 py-1 text-right font-tabular text-text-dim">{g.roeRetain}%</td>
                <td className="px-2 py-1 text-right font-tabular text-pos">+{g.fwdRet}%</td>
                <td className="px-2 py-1 text-right font-tabular text-text-dim">{g.fwdVol}%</td>
                <td className="px-2 py-1 text-right font-tabular text-neg">{sgn(g.fwdMdd)}%</td>
                <td className="px-2 py-1 text-right font-tabular text-text-dim">{g.fwdMarginVol}</td>
              </tr>
            ); })}
          </tbody>
        </table>
      </div>
      <p className="mb-4 text-[10px] text-text-faint">Table 4. Median forward outcomes by ROE-source road, panel of {forward.nPanel.toLocaleString()} firm-years, {forward.years[0]}–{forward.years[1]}. Returns measured from ≈4 months after fiscal-end (filing). Source: {SEC}, {YH}; {CALC}.</p>
      <P>
        Persistence is where the data overturns the intuition. Regressing next-year ROE on the road
        dummies, controlling for the current ROE level and sector (Table 5), ROE is highly persistent
        overall (autoregressive load <Em>{forward.persistence.roeLoad.est}</Em>, t = {forward.persistence.roeLoad.t}).
        But conditional on level, margin- and turnover-sourced ROE mean-<em>revert</em> significantly
        more than leverage-sourced ROE (<Em>{sgn(forward.persistence.marginVsLev.est)}pp</Em>, t ={" "}
        {forward.persistence.marginVsLev.t}; and {sgn(forward.persistence.turnoverVsLev.est)}pp, t ={" "}
        {forward.persistence.turnoverVsLev.t}). Read carefully: leverage-sourced ROE is the <em>most
        durable</em> — because a capital-structure choice is stickier than a fat margin, which competition
        erodes. But that durability is mechanical, not economic: it is the persistence of a buyback policy,
        and (§06, §08) it earns no valuation premium and no excess return. Durable is not the same as good.
      </P>
      <div className="my-6 overflow-x-auto border border-rule">
        <table className="w-full border-collapse font-mono text-[11px]">
          <thead>
            <tr className="border-b border-rule-strong bg-bg-elev text-[9px] uppercase tracking-[0.03em] text-text-faint">
              <Th>Forward ROE ~ road (vs leverage-driven), + ROE + sector FE</Th><Th r>estimate</Th><Th r>t</Th>
            </tr>
          </thead>
          <tbody>
            <tr className="border-b border-rule"><td className="px-2 py-1 text-data">margin-driven</td><td className="px-2 py-1 text-right font-tabular text-neg">{sgn(forward.persistence.marginVsLev.est)}pp</td><td className="px-2 py-1 text-right font-tabular text-text">{forward.persistence.marginVsLev.t}</td></tr>
            <tr className="border-b border-rule"><td className="px-2 py-1 text-accent">turnover-driven</td><td className="px-2 py-1 text-right font-tabular text-neg">{sgn(forward.persistence.turnoverVsLev.est)}pp</td><td className="px-2 py-1 text-right font-tabular text-text">{forward.persistence.turnoverVsLev.t}</td></tr>
            <tr className="border-b border-rule"><td className="px-2 py-1 text-text-dim">current ROE (persistence load)</td><td className="px-2 py-1 text-right font-tabular text-pos">+{forward.persistence.roeLoad.est}</td><td className="px-2 py-1 text-right font-tabular text-text">{forward.persistence.roeLoad.t}</td></tr>
          </tbody>
        </table>
      </div>
      <p className="mb-4 text-[10px] text-text-faint">Table 5. Pooled OLS, n = {forward.persistence.n.toLocaleString()}, R² = {forward.persistence.r2}; sector fixed effects included. Leverage-driven is the omitted category. Source: {SEC}, {YH}; {CALC}.</p>

      {/* 08 rates */}
      <Section n="08" title="The equity multiplier is not rate risk" />
      <P>
        v1 claimed the buyback-built ROE of names like Apple is rate-sensitive — “the cost of the borrowed
        denominator rises with rates.” It tests false, for the simple reason that the denominator was
        never borrowed. Three pieces of evidence. <span className="text-text">First</span>, the equity
        multiplier correlates only <Em>{rates.corrMultNdeq!.r}</Em> with true net-debt/equity across the
        universe — it explains {Math.round(rates.corrMultNdeq!.r ** 2 * 100)}% of the variation in actual
        leverage. <span className="text-text">Second</span>, <Em>{rates.netCashTop} of the top {rates.nTop}</Em>{" "}
        firms by ROE carry <em>net cash</em>; their multiplier reflects buybacks and operating liabilities,
        and rising rates <em>help</em> them (more interest income). <span className="text-text">Third</span>,
        the direct test: a sector-neutral long-short portfolio sorted on the equity multiplier has a rate
        beta of <Em>{rates.equityMult!.rate >= 0 ? "+" : "−"}{Math.abs(rates.equityMult!.rate)}%/100bp</Em>{" "}
        that is statistically zero (t = {rates.equityMult!.tRate}); the portfolio sorted on <em>true</em>{" "}
        net leverage is also insignificant (t = {rates.trueLev!.tRate}) at monthly frequency in these
        net-cash-rich mega-caps. The honest conclusion: the multiplier is a profitability-accounting
        artifact, not a financing exposure. Where these companies do carry rate sensitivity, it is in
        cash-flow <em>duration</em>, not the balance sheet — which is the subject of the{" "}
        <Link href="/research/2026-02-01-equity-duration" className="text-link no-underline hover:opacity-80">rates piece</Link>.
      </P>

      {/* 09 secular margin */}
      <Section n="09" title="The secular-margin question, scoped honestly" />
      <P>
        v1 closed with a macro flourish — “a decade of equity returns underwritten by widening margins.”
        The decomposition does not support that as stated. Decomposing each firm's stock return since 2015
        into <TeX>{"\\Delta\\log P=\\Delta\\log m+\\Delta\\log\\text{rev}-\\Delta\\log\\text{shares}+\\Delta\\log(\\mathrm{P/E})"}</TeX>,
        the median name's price gain came <em>more</em> from revenue growth and multiple re-rating than from
        margins (Fig. 4): of the total, <Em>{attRows[0].value}%</Em> revenue, <Em>{attRows[1].value}%</Em>{" "}
        multiple expansion, only <Em>{attRows[2].value}%</Em> margin expansion, and {attRows[3].value}%
        buybacks. Margins mattered — but they were the third-largest driver, not the headline.
      </P>
      <Figure n={4} title="What drove the decade's stock gains? Median return attribution, basket, since 2015" source={`${SEC} and ${YH}; ${CALC}. Δlog price decomposed into margin, revenue, share-count and P/E components; median across firms, as % of total.`}>
        <BarH rows={attRows} unit="%" decimals={0} color={CYAN} labelWidth={150} tagWidth={8} />
      </Figure>
      <P>
        Blended net margin across the basket did rise — from <Em>{t0.netMargin}%</Em> in {t0.year} to{" "}
        <Em>{t1.netMargin}%</Em> in {t1.year} (Fig. 5) — but two caveats neuter the macro claim.{" "}
        <span className="text-text">Survivorship</span>: this is a fixed basket of firms that{" "}
        <em>remained</em> large-cap, so margin expansion is partly selection, and partly weight drift
        toward the high-margin tech names that re-rated. <span className="text-text">Scope</span>: it is a
        statement about 59 survivors, not “the index.” The defensible version is narrow — within this
        basket, blended margin widened — and even there, the return attribution says the re-rating did more
        work than the margins.
      </P>
      <Figure n={5} title="Blended net margin of the basket, 2015–2025 (survivor-biased)" source={`${SEC}; ${CALC}. Aggregate = Σ net income / Σ revenue across the 59-firm basket.`}>
        <LineChart
          height={260} decimalsLeft={0} yLabelLeft="margin, %"
          series={[{ name: "blended net margin", color: AMBER, data: marginTrend.map((d) => ({ date: d.year, value: d.netMargin })) }]}
        />
      </Figure>

      {/* 10 implications */}
      <Section n="10" title="Implications" />
      <ul className="mb-4 ml-1 space-y-2 font-mono text-[13px] leading-[20px] text-text">
        <li className="flex gap-2"><span className="text-accent">→</span><span>Never screen on ROE alone, and never read the equity multiplier as leverage. Decompose, and check net-debt/EBITDA for the real balance-sheet risk; for the buyback-distorted cohort, switch the denominator to ROIC or operating-profit-on-assets.</span></li>
        <li className="flex gap-2"><span className="text-accent">→</span><span>Quality is a defined, scorable object — and partly priced. Hold the residual: top-quartile quality at non-trivial FCF yields (the Adobe/Accenture quadrant), not quality at any price.</span></li>
        <li className="flex gap-2"><span className="text-accent">→</span><span>Source predicts character, not a clean return premium here: turnover-sourced ROE is the most fundamentally stable, leverage-sourced the most mechanically persistent. Use the taxonomy to understand durability and risk, not as a standalone alpha signal in this survivor sample.</span></li>
      </ul>

      {/* appendix */}
      <Section n="A" title="Data & method" />
      <div className="space-y-2 font-mono text-[11px] leading-[18px] text-text-dim">
        <p><span className="text-text-faint">Universe.</span> A fixed basket of {companies.length} large, continuously-listed US common stocks since 2009, spanning every GICS sector ex-Financials/Utilities/Real Estate (where asset turnover is not economically comparable). This is a survivor basket by construction — the survivorship bias is confronted in §09, not buried.</p>
        <p><span className="text-text-faint">Source &amp; construction.</span> SEC EDGAR company-facts (XBRL from 10-Ks), Yahoo monthly prices, FRED/Yahoo 10-year yield. All denominators use <em>average</em> beginning-and-ending balances; ratios are trailing-3y for the snapshot to damp single-year noise. ROIC = NOPAT / avg invested capital (operating income, pre-tax income where un-tagged, taxed at the effective rate). Net debt = total debt − cash − short-term investments.</p>
        <p><span className="text-text-faint">Classifier &amp; tests.</span> Road = largest deviation of log(margin/turnover/multiplier) from the cross-section median. Forward tests classify each firm-year and measure median forward outcomes; persistence is pooled OLS with sector FE; the rate test regresses sector-neutral long-short portfolio returns on market and Δ10y with Newey-West HAC t (6 lags). Quality score is a six-term cross-sectional z-composite.</p>
        <p><span className="text-text-faint">Caveats.</span> Single-vendor XBRL tagging varies; some firms lack a clean OperatingIncome or D&amp;A tag (EV/EBITDA, op-margin then null). {distorted.length} firms are denominator-distorted (buyback-shrunk or negative equity) and excluded from ROE statistics. Trailing P/E is noisy for one-off-earnings years. Forward returns are survivor-biased upward in level; the cross-<em>road</em> differences are the signal. Reproducible via <code className="text-text-dim">analysis/dupont_roe.py</code>.</p>
        <p className="pt-1 text-text-faint">This is research, not investment advice.</p>
      </div>
    </article>
  );
}
