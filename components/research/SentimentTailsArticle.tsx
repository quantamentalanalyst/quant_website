import Link from "next/link";
import { site } from "@/lib/site";
import type { ResearchMeta } from "@/lib/content";
import Figure from "./Figure";
import { TeX, TeXBlock } from "./TeX";
import { Num } from "@/components/ui/Num";
import LineChart from "./charts/LineChart";
import BarH from "./charts/BarH";

import dashboard from "@/content/research/2026-07-04-sentiment-tails/data/dashboard.json";
import leadlag from "@/content/research/2026-07-04-sentiment-tails/data/leadlag.json";
import quintiles from "@/content/research/2026-07-04-sentiment-tails/data/quintiles.json";
import qreg from "@/content/research/2026-07-04-sentiment-tails/data/qreg.json";
import tree from "@/content/research/2026-07-04-sentiment-tails/data/tree.json";
import horserace from "@/content/research/2026-07-04-sentiment-tails/data/horserace.json";
import epurobust from "@/content/research/2026-07-04-sentiment-tails/data/epurobust.json";
import variance from "@/content/research/2026-07-04-sentiment-tails/data/variance.json";
import timing from "@/content/research/2026-07-04-sentiment-tails/data/timing.json";
import oos from "@/content/research/2026-07-04-sentiment-tails/data/oos.json";
import gapstats from "@/content/research/2026-07-04-sentiment-tails/data/gapstats.json";
import gapSeries from "@/content/research/2026-07-04-sentiment-tails/data/gap.json";
import factors from "@/content/research/2026-07-04-sentiment-tails/data/factors.json";
import corr from "@/content/research/2026-07-04-sentiment-tails/data/corr.json";
import overlay from "@/content/research/2026-07-04-sentiment-tails/data/overlay.json";
import composite from "@/content/research/2026-07-04-sentiment-tails/data/composite.json";
import summary from "@/content/research/2026-07-04-sentiment-tails/data/summary.json";

const AMBER = "var(--color-accent)";
const CYAN = "var(--color-data)";
const POS = "var(--color-pos)";
const FRED = "Federal Reserve Economic Data (FRED), St. Louis Fed";
const YH = "Yahoo Finance (SPY, ^GSPC, ^VIX, factor/sector ETFs)";
const CALC = "author's calculations";

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
function Takeaway({ children }: { children: React.ReactNode }) {
  return (
    <div className="my-5 border-l-2 border-accent bg-bg-elev px-4 py-3">
      <div className="section-label mb-1.5 text-accent">pm takeaway</div>
      <p className="font-mono text-[12.5px] leading-[20px] text-text">{children}</p>
    </div>
  );
}
const Em = ({ children }: { children: React.ReactNode }) => <span className="text-data">{children}</span>;
const mns = (x: number) => (x < 0 ? "−" : "") + Math.abs(x);
const Th = ({ children, r }: { children: React.ReactNode; r?: boolean }) => (
  <th className={`px-2 py-1.5 font-medium ${r ? "text-right" : "text-left"}`}>{children}</th>
);
function Pct({ v, d = 1, dim = false }: { v: number | null; d?: number; dim?: boolean }) {
  if (v == null) return <span className="text-text-faint">—</span>;
  return <span className={`font-tabular ${v >= 0 ? "text-pos" : "text-neg"} ${dim ? "opacity-55" : ""}`}>{v >= 0 ? "+" : "−"}{Math.abs(v).toFixed(d)}%</span>;
}
function ordinal(n: number | null): string {
  if (n == null) return "—";
  const k = Math.round(n);
  const v = k % 100;
  const suf = v >= 11 && v <= 13 ? "th" : k % 10 === 1 ? "st" : k % 10 === 2 ? "nd" : k % 10 === 3 ? "rd" : "th";
  return `${k}${suf}`;
}

export default function SentimentTailsArticle({ meta }: { meta: ResearchMeta }) {
  const byKey = (k: string) => dashboard.find((d) => d.key === k)!;
  const vix = byKey("VIX");
  const credit = byKey("CREDIT");
  const epu = byKey("EPU");
  const mich = byKey("UMCSENT");
  const fearRow = byKey("FEAR");
  const fearLL = leadlag.find((l) => l.key === "FEAR")!;
  const q1 = quintiles[0]!, q5 = quintiles[4]!;
  const s51 = summary.spread51;
  const t90 = qreg.taus.find((t) => t.tau === 0.9)!;
  const t75 = qreg.taus.find((t) => t.tau === 0.75)!;
  const t10 = qreg.taus.find((t) => t.tau === 0.1)!;
  const t50 = qreg.taus.find((t) => t.tau === 0.5)!;
  const c90 = qreg.ctrl.find((t) => t.tau === 0.9)!;
  const c75 = qreg.ctrl.find((t) => t.tau === 0.75)!;
  const epuUni = horserace.uni.find((h) => h.key === "EPU")!;
  const epuMulti = horserace.multi.find((h) => h.key === "EPU")!;
  const vrpUni = horserace.uni.find((h) => h.key === "VRP")!;
  const epuBase = epurobust[0]!;
  const epuDetr = epurobust.find((e) => e.label.startsWith("Rolling"))!;
  const epuLag = epurobust.find((e) => e.label.startsWith("Lagged"))!;
  const vRet = variance.rows[0]!;
  const vRV = variance.rows[1]!;
  const vDn = variance.rows[2]!;
  const vUp = variance.rows[3]!;
  const cur = gapstats.current;
  const rds = gapstats.redesign;
  const gq = gapstats.quint;
  const cycDef = factors.spreads.find((s) => s.label.startsWith("Cyclicals"))!;
  const smlLrg = factors.spreads.find((s) => s.label.startsWith("Small"))!;
  const qqq = factors.spreads.find((s) => s.label.startsWith("Nasdaq"))!;
  const sh = overlay.sharpeTest;
  const stTot = overlay.stateMonths.fear + overlay.stateMonths.neutral + overlay.stateMonths.calm;
  const qregRows = qreg.taus.map((t) => ({
    label: `τ = ${t.tau.toFixed(2)}`, value: t.beta!, tag: `[${t.lo}, ${t.hi}]`,
  }));
  const quintRows = quintiles.map((q) => ({
    label: `Q${q.q}${q.q === 1 ? " calm" : q.q === 5 ? " fear" : ""}`,
    value: q.mean!, tag: `${q.hit}%·n${q.n}`,
  }));
  const TERC = ["Calm", "Neutral", "Fear"] as const;

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

      {/* 00 Executive summary */}
      <Section n="00" title="Executive summary" />
      <P>
        “Sentiment” gets used as if it were one number. It is at least three different instruments —
        what households <em>say</em> (surveys), what option and credit markets <em>charge</em>{" "}
        (VIX, spreads), and what the news flow <em>worries about</em> (policy uncertainty) — and right
        now those instruments disagree with each other more than at any point in the sample. This piece
        builds a five-proxy fear composite the same way the{" "}
        <Link href="/research/2026-05-30-macro-regime" className="text-link no-underline hover:opacity-80">macro-regime piece</Link>{" "}
        built its growth composite — expanding-window z-scores, so the reading at month <TeX>{"t"}</TeX>{" "}
        uses only data available at <TeX>{"t"}</TeX> — and asks the question in a form that can fail:
        does the level predict the forward 3-month S&amp;P return, and if not, what exactly does it
        predict? This revision also turns the referee's guns on its own results: a vol-clustering
        control, four timing conventions, a beta hedge on the factor spreads, and a dummy for the
        Michigan survey's 2024 redesign. Two of the original headline numbers do not survive, and the
        text says so.
      </P>
      <ul className="mb-4 ml-1 space-y-1.5 font-mono text-[13px] leading-[20px] text-text">
        {[
          <>The level predicts almost nothing, under any timing convention. The composite's correlation with the forward 3-month return is <Em>{fearLL.c3!.toFixed(2)}</Em>; the top-minus-bottom quintile spread is +{s51.est}pp (bootstrap CI [{s51.lo}, {s51.hi}]) and ranges only {timing.rows[2]!.spread} to +{timing.rows[3]!.spread}pp across lagged-input, market-only and PCA variants. Out of sample the linear signal scores {oos.r2Lin}%.</>,
          <>Fear prices variance — literally, and not as a vol-clustering artifact. A 1σ rise predicts <Em>+{vRV.bFear} points</Em> of forward 3-month realized volatility (HAC t = {vRV.tFear}), and the 90th-percentile return coefficient is +{t90.beta}pp raw and <Em>+{c90.beta}pp</Em> after controlling for trailing realized vol (CI [{c90.lo}, {c90.hi}]). The composite knows something trailing vol does not.</>,
          <>Six horses, one survivor: news-based policy uncertainty, at <Em>+{epuMulti.beta}pp</Em> per σ (t = {epuMulti.t}), Bonferroni-adjusted p = {epuBase.pBonf}. It survives a one-month lag (t = {epuLag.t}) and both crisis exclusions; detrending is its weakest cut (t = {epuDetr.t}). The variance risk premium — the canonical benchmark — does not place (t = {vrpUni.t}).</>,
          <>Two honest deaths. The Michigan “vibecession” gap shrinks from {mns(cur.gapZ!)}σ to <Em>{mns(rds.gapZ!)}σ</Em> once the survey's 2024 phone-to-web redesign is dummied out (shift = {mns(rds.dummyCoef!)} points, t = {rds.dummyT}). And the fear-tercile factor spreads mostly collapse under a beta hedge — cyclicals−defensives goes from +{cycDef.detail.Fear.mean}% to {mns(cycDef.adj.Fear.mean!)}% — so what fear buys in the cross-section is largely market beta itself.</>,
        ].map((t, i) => (
          <li key={i} className="flex gap-2"><span className="text-accent">{String(i + 1).padStart(2, "0")}</span><span>{t}</span></li>
        ))}
      </ul>

      {/* 01 five instruments */}
      <Section n="01" title="One word, five instruments" />
      <P>
        Table 1 is the current state of the five gauges, each standardized against its own history
        (expanding-window z) with a percentile since 2000. Read the extremes first. The Baa−Aaa credit
        spread, at <Em>{credit.last}pp</Em>, is at its <Em>tightest reading since 2000</Em> — the
        {" "}{ordinal(credit.pct)} percentile; the credit market is pricing essentially no default-risk
        premium. The VIX sits at {vix.last}, its {ordinal(vix.pct)} percentile. Policy uncertainty is at
        its <Em>{ordinal(epu.pct)} percentile</Em>. And the Michigan survey is at <Em>{mich.last}</Em> —
        a level associated in every prior instance with deep recession, printed against a 4-handle
        unemployment rate (§09 examines how much of that is the survey itself). The five signed z-scores
        net to a composite of {fearRow.last} — the {ordinal(fearRow.pct)} percentile, i.e.{" "}
        <em>neutral</em>. That netting is the first result: when the instruments disagree this much, a
        single “sentiment” number is an average of contradictions, and anyone quoting one is choosing
        which contradiction to ignore.
      </P>
      <div className="my-6 overflow-x-auto border border-rule">
        <table className="w-full border-collapse font-mono text-[12px]">
          <thead>
            <tr className="border-b border-rule-strong bg-bg-elev text-[10px] uppercase tracking-[0.04em] text-text-faint">
              <Th>Gauge</Th><Th r>Latest</Th><Th r>1y ago</Th><Th r>z (real-time)</Th><Th r>pctile since ’00</Th>
            </tr>
          </thead>
          <tbody>
            {dashboard.map((d) => (
              <tr key={d.key} className={`border-b border-rule ${d.key === "FEAR" ? "bg-bg-sunken" : ""}`}>
                <td className="px-2 py-1 text-text">{d.label} <span className="text-text-faint">{d.unit}</span>{d.note && <span className="ml-1 text-[10px] text-text-faint">· {d.note}</span>}</td>
                <td className="px-2 py-1 text-right text-text"><Num value={d.last} decimals={d.unit === "idx" && d.key === "EPU" ? 0 : d.unit === "pp" ? 2 : 1} /></td>
                <td className="px-2 py-1 text-right text-text-dim"><Num value={d.prior} decimals={d.unit === "idx" && d.key === "EPU" ? 0 : d.unit === "pp" ? 2 : 1} /></td>
                <td className="px-2 py-1 text-right">{d.z == null ? <span className="text-text-faint">—</span> : <span className={d.z >= 0 ? "text-neg" : "text-pos"}><Num value={d.z} decimals={2} signed /></span>}</td>
                <td className="px-2 py-1 text-right font-tabular text-text-dim">{d.pct == null ? "—" : ordinal(d.pct)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="mb-4 text-[10px] text-text-faint">Table 1. Sentiment dashboard as of {fearRow.asOf} (Michigan: {mich.asOf}, publication lag). z is standardized on the expanding window; percentile vs 2000–2026. Sign convention: higher z = more fear, so the survey enters inverted; red = fear above its history. Source: {FRED}, {YH}; {CALC}.</p>
      <P>
        Why these five: they span the three ways “sentiment” is actually measured. The VIX is the
        option market's price of 30-day variance; Baa−Aaa is the bond market's price of quality (the
        series Moody's has published since 1919 — used here instead of the high-yield OAS because ICE
        licensing caps that series at a trailing three-year window, useless for a real-time z); the
        NFCI risk subindex aggregates ~50 financial-stress series; the Baker-Bloom-Davis EPU index
        counts newspaper coverage of policy uncertainty; Michigan asks roughly 600 households how they
        feel. One caveat belongs up front rather than in the appendix: the instruments are correlated —
        Baa−Aaa and the NFCI risk subindex at {corr.m[1]![2]}, VIX and NFCI at {corr.m[0]![2]} (the
        subindex actually contains the VIX among its inputs) — so an equal-weight composite implicitly
        overweights the market-priced family. The full correlation matrix is in the appendix, and §06
        re-runs the headline numbers on a market-only composite and a principal-component weighting.
      </P>

      {/* 02 construction */}
      <Section n="02" title="Construction: a fear composite and a disagreement index" />
      <P>
        Each proxy is standardized on an expanding window and signed so that higher always means more
        fear; the composite is the equal-weight mean, requiring at least four of five to be available.
        Alongside it I track the cross-sectional dispersion of the five z-scores — the “instruments
        disagree” observation from Table 1 turned into a monthly variable:
      </P>
      <TeXBlock eq="1">{"F_t=\\tfrac{1}{5}\\sum_{i} s_i\\, z^{\\,\\mathrm{RT}}_{i,t},\\qquad D_t=\\operatorname{sd}_i\\!\\left(s_i\\, z^{\\,\\mathrm{RT}}_{i,t}\\right),\\qquad z^{\\,\\mathrm{RT}}_{i,t}=\\frac{x_{i,t}-\\mu_{i,\\,1:t}}{\\sigma_{i,\\,1:t}}"}</TeXBlock>
      <P>
        The z at month <TeX>{"t"}</TeX> uses only data through <TeX>{"t"}</TeX>, so every sort and
        regression below is one an investor could have run in real time — with the honest qualifier
        that “real time” refers to the standardization, not to data vintages (revisions and publication
        lags are handled as explicit robustness checks in §06 rather than assumed away). Daily series
        are averaged within the month rather than sampled at month-end, which damps the noise in a
        series whose whole personality is spikes. Figure 1 plots the composite against the SPY
        drawdown; the spikes land where they should — 2001–02, 2008–09, the 2011 and 2015 growth
        scares, March 2020, 2022 — the eyeball check that the construction measures what it claims to.
      </P>
      <Figure n={1} title="The fear composite (z) vs the SPY drawdown, 2000–2026" source={`${FRED} and ${YH}; ${CALC}. Composite = equal-weight mean of five signed expanding-window z-scores. Drawdown from the running SPY peak.`}>
        <LineChart
          height={280} decimalsLeft={1} decimalsRight={0} zeroLine
          yLabelLeft="fear composite (z)" yLabelRight="SPY drawdown (%)"
          series={[
            { name: "fear composite (z, real-time)", color: AMBER, axis: "left", data: composite.map((d) => ({ date: d.date, value: d.fear! })) },
            { name: "SPY drawdown (%)", color: CYAN, axis: "right", data: composite.filter((d) => d.dd != null).map((d) => ({ date: d.date, value: d.dd! })) },
          ]}
        />
      </Figure>

      {/* 03 the level */}
      <Section n="03" title="The level tells you almost nothing about the mean" />
      <P>
        Start where a contrarian wants the answer to be: does high fear predict high forward returns?
        Table 2 reports the correlation of each proxy (signed, fear-positive) with the forward 1-, 3-
        and 12-month SPY return, alongside the composite, the disagreement index, and — as the external
        benchmark — the Bollerslev-Tauchen-Zhou variance risk premium. The composite's 3-month
        correlation is <Em>{fearLL.c3!.toFixed(2)}</Em>. The honest correction makes it worse: forward
        3-month returns sampled monthly overlap by two-thirds, so the {fearLL.n} months carry roughly{" "}
        {fearLL.nEff} independent observations, and the t-statistic is {fearLL.t3}. The quintile sort
        (Fig. 2, Table 3) says the same thing in portfolio form: a Q5−Q1 spread of <Em>+{s51.est}pp</Em>{" "}
        whose bootstrap interval, [{s51.lo}, {s51.hi}], contains zero with room to spare.
      </P>
      <P>
        One detail in Table 3 deserves more attention than the means: the <em>hit rate falls</em> as
        fear rises — {q1.hit}% of high-calm months are positive against {q5.hit}% of high-fear months —
        while the mean <em>rises</em>. More losing months, bigger winning ones. That is not a mean
        effect at all; it is a variance effect wearing a mean's clothes, and §§04–05 make it explicit.
      </P>
      <div className="my-6 overflow-x-auto border border-rule">
        <table className="w-full border-collapse font-mono text-[11px]">
          <thead>
            <tr className="border-b border-rule-strong bg-bg-elev text-[9px] uppercase tracking-[0.03em] text-text-faint">
              <Th>Proxy (fear-signed)</Th><Th r>corr fwd 1m</Th><Th r>corr fwd 3m</Th><Th r>t (eff.)</Th><Th r>corr fwd 12m</Th><Th r>t (eff.)</Th>
            </tr>
          </thead>
          <tbody>
            {leadlag.map((l) => (
              <tr key={l.key} className={`border-b border-rule ${l.key === "FEAR" ? "bg-bg-sunken" : ""}`}>
                <td className="px-2 py-1 text-text">{l.label}</td>
                <td className="px-2 py-1 text-right font-tabular text-text-dim"><Num value={l.c1} decimals={2} signed /></td>
                <td className="px-2 py-1 text-right font-tabular text-text"><Num value={l.c3} decimals={2} signed /></td>
                <td className={`px-2 py-1 text-right font-tabular ${Math.abs(l.t3!) >= 2 ? "text-text" : "text-text-faint"}`}>{mns(l.t3!)}</td>
                <td className="px-2 py-1 text-right font-tabular text-text"><Num value={l.c12} decimals={2} signed /></td>
                <td className={`px-2 py-1 text-right font-tabular ${l.t12 != null && Math.abs(l.t12) >= 2 ? "text-text" : "text-text-faint"}`}>{l.t12 == null ? "—" : mns(l.t12)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="mb-4 text-[10px] text-text-faint">Table 2. Correlation of each fear-signed variable with forward SPY returns, 2000–2026 (n = {fearLL.n} months). Effective n ≈ n/h corrects the overlap in h-month returns sampled monthly; t (eff.) is the corresponding t-statistic. VRP = VIX² − trailing 21-day realized variance. Source: {FRED}, {YH}; {CALC}.</p>
      <Figure n={2} title="Mean forward 3-month SPY return by fear-composite quintile (2000–2026)" source={`${FRED} and ${YH}; ${CALC}. Bar = mean forward 3m return; tag = hit rate · n months. Real-time composite, in-sample quintile breakpoints (descriptive).`}>
        <BarH rows={quintRows} unit="%" decimals={1} labelWidth={96} tagWidth={84} />
      </Figure>
      <div className="my-6 overflow-x-auto border border-rule">
        <table className="w-full border-collapse font-mono text-[11px]">
          <thead>
            <tr className="border-b border-rule-strong bg-bg-elev text-[9px] uppercase tracking-[0.03em] text-text-faint">
              <Th>Fear quintile</Th><Th r>composite range</Th><Th r>mean fwd 3m</Th><Th r>95% CI</Th><Th r>hit</Th><Th r>n</Th>
            </tr>
          </thead>
          <tbody>
            {quintiles.map((q) => (
              <tr key={q.q} className={`border-b border-rule ${q.q === 5 ? "bg-bg-sunken" : ""}`}>
                <td className="px-2 py-1 text-text">Q{q.q}{q.q === 1 ? " — calmest" : q.q === 5 ? " — most fearful" : ""}</td>
                <td className="px-2 py-1 text-right font-tabular text-text-dim">[{q.fearLo}, {q.fearHi}]</td>
                <td className="px-2 py-1 text-right"><Pct v={q.mean} /></td>
                <td className="px-2 py-1 text-right font-tabular text-text-dim">[{q.lo}, {q.hi}]</td>
                <td className="px-2 py-1 text-right font-tabular text-text-dim">{q.hit}%</td>
                <td className="px-2 py-1 text-right font-tabular text-text-faint">{q.n}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="mb-4 text-[10px] text-text-faint">Table 3. Forward 3-month SPY return by fear quintile with circular block-bootstrap 95% intervals (block = 6 months, 3,000 resamples). Q5−Q1 = +{s51.est}pp, CI [{s51.lo}, {s51.hi}]. Source: {FRED}, {YH}; {CALC}.</p>

      {/* 04 the shape */}
      <Section n="04" title="What fear prices: the shape — and the vol-clustering test" />
      <P>
        If fear changes the distribution of forward returns without changing its center, the right tool
        is quantile regression — the effect of the composite not on the conditional mean but on each
        conditional quantile:
      </P>
      <TeXBlock eq="2">{"Q_{\\tau}\\!\\left(R_{t,t+3}\\,\\middle|\\,F_t\\right)=\\alpha_{\\tau}+\\beta_{\\tau}F_t,\\qquad \\tau\\in\\{0.10,\\,0.25,\\,0.50,\\,0.75,\\,0.90\\}"}</TeXBlock>
      <P>
        Figure 3 is the article's central result. The OLS (mean) coefficient is {qreg.ols.beta}pp per 1σ
        of fear with a t of {qreg.ols.t} — nothing, as §03 promised. But the quantile coefficients fan
        out: at the 90th percentile a 1σ rise in fear adds <Em>+{t90.beta}pp</Em> (block-bootstrap CI
        [{t90.lo}, {t90.hi}]), at the 75th +{t75.beta}pp (CI [{t75.lo}, {t75.hi}]), while the median
        ({t50.beta}pp) and the lower quantiles ({t10.beta}pp at the 10th) are statistically
        indistinguishable from zero. A rise in fear does not shift the forward-return distribution; it{" "}
        <em>stretches</em> it, materially in the right tail. Buying fear buys a bigger rebound{" "}
        <em>if</em> the rebound comes, and no reliable protection if it doesn't.
      </P>
      <P>
        The obvious objection: volatility clusters, and two of the five composite legs are volatility
        measures, so “fear widens the quantiles” could be trailing vol wearing a costume. Table 4 runs
        the test — the same quantile regressions with trailing 63-day realized volatility as a control.
        The fan <em>survives</em>: the 90th-percentile coefficient is <Em>+{c90.beta}pp</Em> per σ of
        fear (CI [{c90.lo}, {c90.hi}]) and the 75th is +{c75.beta}pp (CI [{c75.lo}, {c75.hi}]), both
        holding trailing vol fixed. Whatever the composite carries about the width of the forward
        distribution, it is not simply a restatement of the vol the market already realized.
      </P>
      <Figure n={3} title="Quantile-regression coefficients: effect of a 1σ rise in fear on each quantile of the forward 3-month return" source={`${FRED} and ${YH}; ${CALC}. β in pp per 1σ of the composite; tags = circular block-bootstrap 95% CI (1,200 resamples per τ). OLS mean effect: ${qreg.ols.beta}pp (t ${qreg.ols.t}). Table 4 reports the vol-controlled version.`}>
        <BarH rows={qregRows} unit="pp" decimals={2} labelWidth={80} tagWidth={110} />
      </Figure>
      <div className="my-6 overflow-x-auto border border-rule">
        <table className="w-full border-collapse font-mono text-[11px]">
          <thead>
            <tr className="border-b border-rule-strong bg-bg-elev text-[9px] uppercase tracking-[0.03em] text-text-faint">
              <Th>Quantile</Th><Th r>β raw (pp/σ)</Th><Th r>95% CI</Th><Th r>β | trailing RV (pp/σ)</Th><Th r>95% CI</Th>
            </tr>
          </thead>
          <tbody>
            {qreg.taus.map((t, i) => {
              const c = qreg.ctrl[i]!;
              const sig = (x: { lo: number | null; hi: number | null }) => x.lo != null && x.hi != null && x.lo * x.hi > 0;
              return (
                <tr key={t.tau} className="border-b border-rule">
                  <td className="px-2 py-1 text-text">τ = {t.tau.toFixed(2)}</td>
                  <td className={`px-2 py-1 text-right font-tabular ${sig(t) ? "text-text" : "text-text-faint"}`}><Num value={t.beta} decimals={2} signed /></td>
                  <td className="px-2 py-1 text-right font-tabular text-text-dim">[{t.lo}, {t.hi}]</td>
                  <td className={`px-2 py-1 text-right font-tabular ${sig(c) ? "text-text" : "text-text-faint"}`}><Num value={c.beta} decimals={2} signed /></td>
                  <td className="px-2 py-1 text-right font-tabular text-text-dim">[{c.lo}, {c.hi}]</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <p className="mb-4 text-[10px] text-text-faint">Table 4. Quantile-regression coefficients on fear, raw and controlling for trailing 63-trading-day realized volatility (standardized). Block-bootstrap CIs (1,200 / 800 resamples). Faint = CI includes zero. Source: {FRED}, {YH}; {CALC}.</p>
      <P>
        A model-free cross-check: a depth-two regression tree (exhaustive SSE search, minimum leaf 24
        months) puts its root split at <Em>F = {tree.root.thr}</Em> — almost exactly the Q4/Q5 boundary
        — with {tree.root.meanR}% above versus {tree.root.meanL}% below. Inside the high-fear branch
        the moderately elevated band pays {tree.right!.meanL}% (n = {tree.right!.nL}) while deep panic
        beyond {tree.right!.thr}σ pays {tree.right!.meanR}% (n = {tree.right!.nR}) — both tails
        arriving together, as the quantile coefficients say. These are in-sample splits, read as
        description; §08 is the corrective.
      </P>
      <Takeaway>
        High fear is not a signal to add index exposure — the mean effect is zero under every test
        here. It is a statement that the payoff distribution is wider: more rebound convexity, and no
        less left-tail continuation risk. Size positions for the wider distribution; don't trade the
        average.
      </Takeaway>

      {/* 05 variance literally */}
      <Section n="05" title="Fear predicts variance — literally" />
      <P>
        “Fear buys variance” should not rest on return quantiles alone. Table 5 tests it directly:
        forward 3-month <em>realized</em> volatility (from daily SPY returns), its downside and upside
        halves, regressed on the composite — raw, then controlling for trailing realized vol, plus the
        disagreement index. The headline: a 1σ rise in fear predicts <Em>+{vRV.bFear} points</Em> of
        forward annualized volatility (t = {vRV.tFear}). Some of that is vol clustering — the control
        cuts it to +{vRV.bCtrl} (t = {vRV.tCtrl}) — but the effect persists — and it leans the right way: the upside semivolatility loading (+{vUp.bCtrl}, t = {vUp.tCtrl}) survives the
        control at least as well as the downside (+{vDn.bCtrl}, t = {vDn.tCtrl}). Fear predicts a wider
        realized distribution with, if anything, the wider half on top — the realized-vol counterpart
        of the quantile fan.
      </P>
      <P>
        The disagreement index earns its keep here too: it predicts forward realized vol
        (+{vDn.bDis} to +{vUp.bDis} points per σ across the semivols, t up to {vUp.tDis}) but not
        returns (t = {vRet.tDis}). Disagreement and the fear level are correlated
        ({variance.corrFearDis}), so I read them as two views of the same state rather than independent
        signals — but the pattern is consistent: when the instruments disagree, it is the width of what
        comes next that moves, not the direction.
      </P>
      <div className="my-6 overflow-x-auto border border-rule">
        <table className="w-full border-collapse font-mono text-[11px]">
          <thead>
            <tr className="border-b border-rule-strong bg-bg-elev text-[9px] uppercase tracking-[0.03em] text-text-faint">
              <Th>Dependent (fwd 3m)</Th><Th r>fear β</Th><Th r>t</Th><Th r>fear β | RV ctrl</Th><Th r>t</Th><Th r>disagree β</Th><Th r>t</Th>
            </tr>
          </thead>
          <tbody>
            {variance.rows.map((v) => (
              <tr key={v.label} className="border-b border-rule">
                <td className="px-2 py-1 text-text">{v.label}</td>
                <td className="px-2 py-1 text-right font-tabular text-text"><Num value={v.bFear} decimals={2} signed /></td>
                <td className={`px-2 py-1 text-right font-tabular ${v.tFear != null && Math.abs(v.tFear) >= 2 ? "text-text" : "text-text-faint"}`}>{v.tFear == null ? "—" : mns(v.tFear)}</td>
                <td className="px-2 py-1 text-right font-tabular text-text"><Num value={v.bCtrl} decimals={2} signed /></td>
                <td className={`px-2 py-1 text-right font-tabular ${v.tCtrl != null && Math.abs(v.tCtrl) >= 2 ? "text-text" : "text-text-faint"}`}>{v.tCtrl == null ? "—" : mns(v.tCtrl)}</td>
                <td className="px-2 py-1 text-right font-tabular text-text"><Num value={v.bDis} decimals={2} signed /></td>
                <td className={`px-2 py-1 text-right font-tabular ${v.tDis != null && Math.abs(v.tDis) >= 2 ? "text-text" : "text-text-faint"}`}>{v.tDis == null ? "—" : mns(v.tDis)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="mb-4 text-[10px] text-text-faint">Table 5. HAC regressions (lag {summary.hacLag}), 2000–2026. Vol measures annualized % from daily SPY returns over the next 63 trading days; semivols from the signed halves. “RV ctrl” = fear coefficient holding trailing 63-day realized vol fixed. Disagreement = cross-sectional σ of the five z's (corr with fear: {variance.corrFearDis}). Source: {YH}, {FRED}; {CALC}.</p>

      {/* 06 timing */}
      <Section n="06" title="Does the timing convention matter?" />
      <P>
        A fair objection to any month-<TeX>{"t"}</TeX> composite: could the investor actually have had
        every input at month-end? Michigan prints with a lag, EPU is compiled from the month's papers,
        CPI arrives mid-following-month. Table 6 re-runs the two headline numbers — the Q5−Q1 mean
        spread (the null) and the 90th-percentile quantile coefficient (the positive result) — under
        conservative conventions: every input lagged a full month; a market-priced-only composite
        (VIX, Baa−Aaa, NFCI risk — observable daily); market current with survey/news lagged; and a
        first-principal-component weighting. The null is robust: the spread ranges from{" "}
        {timing.rows[2]!.spread} to +{timing.rows[3]!.spread}pp and never approaches significance. And
        the tail coefficient is just as robust the other way: β(τ=0.90) stays between +{timing.rows[1]!.b90}{" "}
        and +{timing.rows[0]!.b90} across every variant. Neither result is an artifact of assuming
        same-month data.
      </P>
      <div className="my-6 overflow-x-auto border border-rule">
        <table className="w-full border-collapse font-mono text-[11px]">
          <thead>
            <tr className="border-b border-rule-strong bg-bg-elev text-[9px] uppercase tracking-[0.03em] text-text-faint">
              <Th>Composite / timing variant</Th><Th r>Q1 mean</Th><Th r>Q5 mean</Th><Th r>Q5−Q1</Th><Th r>β τ=0.90</Th><Th r>n</Th>
            </tr>
          </thead>
          <tbody>
            {timing.rows.map((t, i) => (
              <tr key={t.label} className={`border-b border-rule ${i === 0 ? "bg-bg-sunken" : ""}`}>
                <td className="px-2 py-1 text-text">{t.label}</td>
                <td className="px-2 py-1 text-right"><Pct v={t.q1} /></td>
                <td className="px-2 py-1 text-right"><Pct v={t.q5} /></td>
                <td className="px-2 py-1 text-right font-tabular text-text"><Num value={t.spread} decimals={1} signed /></td>
                <td className="px-2 py-1 text-right font-tabular text-text"><Num value={t.b90} decimals={2} signed /></td>
                <td className="px-2 py-1 text-right font-tabular text-text-faint">{t.n}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="mb-4 text-[10px] text-text-faint">Table 6. Headline statistics under alternative signal-timing and weighting conventions. β τ=0.90 is the point estimate (no bootstrap per variant). The PCA row uses full-sample weights ({Object.entries(timing.pcWeights).map(([k, v]) => `${k} ${v}`).join(", ")}) and is a look-ahead robustness row only, exactly as in the macro-regime piece. Source: {FRED}, {YH}; {CALC}.</p>

      {/* 07 horse race */}
      <Section n="07" title="Horse race: six candidates, one survivor" />
      <P>
        Which instrument carries what little mean information exists? Table 7 runs each candidate alone
        and all six jointly against the forward 3-month return — the five proxies plus the
        Bollerslev-Tauchen-Zhou variance risk premium (VIX² − realized variance), the canonical
        sentiment-adjacent mean predictor at this horizon and therefore the benchmark to beat. Five of
        the six die: the VIX at β ≈ {horserace.uni.find((h) => h.key === "VIX")!.beta}, the survey at
        t = {horserace.uni.find((h) => h.key === "UMCSENT")!.t}, credit and financial conditions with
        the wrong sign, and the VRP itself at t = {vrpUni.t} — weaker in this sample than its
        literature reputation. The exception is the Baker-Bloom-Davis policy-uncertainty index:{" "}
        <Em>+{epuUni.beta}pp</Em> per σ alone (t = {epuUni.t}) and <Em>+{epuMulti.beta}pp</Em> jointly
        (t = {epuMulti.t}), the only coefficient that strengthens with controls. One aside for the
        econometrically suspicious: the joint R² of {horserace.multiR2}% against univariate R²s near
        zero is a suppressor effect — the correlated market-priced legs (appendix Table 12) hedge each
        other out and let the EPU component through — not an additivity error.
      </P>
      <div className="my-6 grid gap-5 md:grid-cols-2">
        <div className="overflow-x-auto border border-rule">
          <table className="w-full border-collapse font-mono text-[11px]">
            <thead>
              <tr className="border-b border-rule-strong bg-bg-elev text-[9px] uppercase tracking-[0.03em] text-text-faint">
                <Th>Univariate</Th><Th r>β (pp/σ)</Th><Th r>HAC t</Th>
              </tr>
            </thead>
            <tbody>
              {horserace.uni.map((h) => (
                <tr key={h.key} className="border-b border-rule">
                  <td className="px-2 py-1 text-text">{h.label}</td>
                  <td className="px-2 py-1 text-right font-tabular text-text"><Num value={h.beta} decimals={2} signed /></td>
                  <td className={`px-2 py-1 text-right font-tabular ${h.t != null && Math.abs(h.t) >= 2 ? "text-text" : "text-text-faint"}`}>{h.t == null ? "—" : mns(h.t)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="overflow-x-auto border border-rule">
          <table className="w-full border-collapse font-mono text-[11px]">
            <thead>
              <tr className="border-b border-rule-strong bg-bg-elev text-[9px] uppercase tracking-[0.03em] text-text-faint">
                <Th>Joint (all six)</Th><Th r>β (pp/σ)</Th><Th r>HAC t</Th>
              </tr>
            </thead>
            <tbody>
              {horserace.multi.map((h) => (
                <tr key={h.key} className="border-b border-rule">
                  <td className="px-2 py-1 text-text">{h.label}</td>
                  <td className="px-2 py-1 text-right font-tabular text-text"><Num value={h.beta} decimals={2} signed /></td>
                  <td className={`px-2 py-1 text-right font-tabular ${h.t != null && Math.abs(h.t) >= 2 ? "text-text" : "text-text-faint"}`}>{h.t == null ? "—" : mns(h.t)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
      <p className="mb-4 text-[10px] text-text-faint">Table 7. Forward 3-month SPY return on fear-signed z-scores, 2000–2026 (n = {horserace.multiN}); Newey-West HAC t (lag {summary.hacLag}). Joint R² = {horserace.multiR2}%. Source: {FRED}, {YH}; {CALC}.</p>
      <P>
        A single survivor among six invites a multiple-testing discount, so Table 8 stress-tests it.
        The Bonferroni-adjusted p on the baseline is {epuBase.pBonf}. Lagging EPU a month — so the
        signal uses only papers already printed — leaves it intact (t = {epuLag.t}). Excluding the GFC
        strengthens it; excluding COVID keeps it (t = {epurobust[4]!.t}). The weakest cut is the one
        that matters most: EPU has drifted secularly upward as coverage of policy expanded, an
        expanding-window z inherits that trend, and a detrended (rolling 10-year) z drops the t to{" "}
        {epuDetr.t} — still there, but marginal. The fair summary: an uncertainty premium consistent
        with the literature, robust to lags and crises, and partly — not wholly — a trend. I flag the
        follow-up test now, so it is pre-registered rather than fished for: the next piece should test
        EPU on rate-sensitive sector spreads, where a policy-uncertainty premium has a mechanism.
      </P>
      <div className="my-6 overflow-x-auto border border-rule">
        <table className="w-full border-collapse font-mono text-[11px]">
          <thead>
            <tr className="border-b border-rule-strong bg-bg-elev text-[9px] uppercase tracking-[0.03em] text-text-faint">
              <Th>EPU under stress</Th><Th r>β (pp/σ)</Th><Th r>HAC t</Th><Th r>p</Th><Th r>n</Th>
            </tr>
          </thead>
          <tbody>
            {epurobust.map((e, i) => (
              <tr key={e.label} className={`border-b border-rule ${i === 0 ? "bg-bg-sunken" : ""}`}>
                <td className="px-2 py-1 text-text">{e.label}</td>
                <td className="px-2 py-1 text-right font-tabular text-text"><Num value={e.beta} decimals={2} signed /></td>
                <td className={`px-2 py-1 text-right font-tabular ${e.t != null && Math.abs(e.t) >= 2 ? "text-text" : "text-text-faint"}`}>{e.t == null ? "—" : mns(e.t)}</td>
                <td className="px-2 py-1 text-right font-tabular text-text-dim">{e.p == null ? "—" : e.p < 0.001 ? "<.001" : e.p}{"pBonf" in e && e.pBonf != null ? ` (Bonf ${e.pBonf})` : ""}</td>
                <td className="px-2 py-1 text-right font-tabular text-text-faint">{e.n}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="mb-4 text-[10px] text-text-faint">Table 8. The policy-uncertainty coefficient under stress. p from the HAC t (two-sided normal); Bonferroni ×6 for the six-way search. Source: {FRED}, {YH}; {CALC}.</p>

      {/* 08 OOS */}
      <Section n="08" title="Out of sample, nothing survives" />
      <P>
        Re-estimate everything on an expanding window and forecast truly out of sample, scoring against
        the expanding historical mean (Campbell-Thompson R²<sub>OOS</sub>); training data at each month
        excludes any observation whose forward window hasn't closed. Over {oos.start} → {oos.end}{" "}
        (n = {oos.n}): the linear signal scores <Em>{oos.r2Lin}%</Em>, the +1σ tail rule{" "}
        <Em>{oos.r2Rule}%</Em> — both negative; the historical mean was the better forecast. Against an
        in-sample R² of {oos.r2InSample}%, there was little to lose. This is the closing argument on
        sentiment-based <em>index timing</em>, and it is why §04's tree thresholds stay descriptive.
        The result is not that sentiment contains nothing; it is that what it contains — the variance
        information of §05 — cannot be monetized by shifting the mean exposure of an index position.
      </P>
      <div className="my-6 overflow-x-auto border border-rule">
        <table className="w-full border-collapse font-mono text-[11px]">
          <thead>
            <tr className="border-b border-rule-strong bg-bg-elev text-[9px] uppercase tracking-[0.03em] text-text-faint">
              <Th>Forecast of the forward 3m return</Th><Th r>R² (in-sample)</Th><Th r>R²oos vs hist. mean</Th>
            </tr>
          </thead>
          <tbody>
            <tr className="border-b border-rule">
              <td className="px-2 py-1 text-text">Linear: α + β·fear, expanding re-fit</td>
              <td className="px-2 py-1 text-right font-tabular text-text-dim">{oos.r2InSample}%</td>
              <td className="px-2 py-1 text-right font-tabular text-neg">{oos.r2Lin}%</td>
            </tr>
            <tr className="border-b border-rule">
              <td className="px-2 py-1 text-text">Tail rule: state mean, fear ≥ +1σ (real-time threshold)</td>
              <td className="px-2 py-1 text-right font-tabular text-text-faint">—</td>
              <td className="px-2 py-1 text-right font-tabular text-neg">{oos.r2Rule}%</td>
            </tr>
          </tbody>
        </table>
      </div>
      <p className="mb-4 text-[10px] text-text-faint">Table 9. Campbell-Thompson out-of-sample R² vs the expanding historical mean, {oos.start} → {oos.end} (n = {oos.n} monthly forecasts). Negative = the historical mean forecast was better. Source: {FRED}, {YH}; {CALC}.</p>

      {/* 09 vibecession */}
      <Section n="09" title="The vibecession, re-measured" />
      <P>
        The loudest sentiment story of recent years is the divergence between what households report
        and what the economy prints. To measure it, regress the Michigan index on the things that are
        supposed to drive it — unemployment, CPI inflation, gas-price inflation, the trailing 12-month
        market return — re-estimated on an expanding window so the fitted value at <TeX>{"t"}</TeX> is
        a real-time nowcast. The model explains {gapstats.model.r2}% of the variance, with sensible
        coefficients (Table 10): a point of unemployment costs {mns(gapstats.model.coefs[0]!.b!)} index
        points, a point of CPI inflation {mns(gapstats.model.coefs[1]!.b!)}. One folk belief does not
        survive controls: <em>conditional on headline CPI</em>, gas prices carry a small positive
        coefficient — pump prices matter through inflation, not on top of it.
      </P>
      <P>
        Taken at face value, the residual is enormous: the survey prints <Em>{cur.actual}</Em> against
        a model-implied {cur.fitted} — a gap of {mns(cur.gap!)} points, {mns(cur.gapZ!)}σ against its
        own history. But face value is wrong, and this section exists to say so. The University of
        Michigan completed a phone-to-web transition in mid-2024, and survey methodologists associate
        the redesign with a level shift down. Adding a web-era dummy to the model attributes{" "}
        <Em>{mns(rds.dummyCoef!)} points</Em> of the current shortfall to the instrument itself
        (t = {rds.dummyT}); the residual gloom that survives is <Em>{mns(rds.gap!)} points, or{" "}
        {mns(rds.gapZ!)}σ</Em> — unusual, not unprecedented. Roughly two-thirds of the headline
        “vibecession” number is the survey, not the vibes. What remains is still a puzzle worth
        watching — candidate explanations include inflation scarring (levels versus rates: the CPI
        enters as YoY, but households may anchor on three-year-ago price levels) and partisan response
        polarization — but the honest headline is the smaller number.
      </P>
      <Figure n={4} title="Michigan sentiment: actual vs fundamentals-model nowcast (expanding-window OLS)" source={`${FRED} and ${YH}; ${CALC}. Model: UMCSENT on unemployment, CPI YoY, gas-price YoY, trailing 12m ^GSPC return; re-estimated each month on data through that month. The 2024 phone-to-web redesign accounts for ${mns(rds.dummyCoef!)} points of the terminal gap (Table 10).`}>
        <LineChart
          height={280} decimalsLeft={0} yLabelLeft="index"
          series={[
            { name: "Michigan sentiment (actual)", color: AMBER, data: gapSeries.map((d) => ({ date: d.date, value: d.actual! })) },
            { name: "fundamentals nowcast", color: CYAN, data: gapSeries.map((d) => ({ date: d.date, value: d.fitted! })) },
          ]}
        />
      </Figure>
      <P>
        Does unexplained gloom mean anything for returns? Table 10 (right) sorts forward 3-month
        returns by the gap's real-time z. No contrast is significant: the gap's regression on the
        forward 12-month return has a t of {gapstats.predMarket.t}, and — the sharper null — it does
        not predict the <em>survey's own</em> 12-month change either (t = {gapstats.predMood.t}).
        Unexplained gloom neither reverts on schedule nor drags equities with it. This extends the
        hard/soft result in the{" "}
        <Link href="/research/2026-05-30-macro-regime" className="text-link no-underline hover:opacity-80">macro-regime piece</Link>{" "}
        with a stronger design — model residual rather than z-difference — and lands on a cleaner
        conclusion: <em>the vibecession, whatever its true size, is a fact about the mood, not a signal
        about the market.</em>
      </P>
      <div className="my-6 grid gap-5 md:grid-cols-2">
        <div className="overflow-x-auto border border-rule">
          <table className="w-full border-collapse font-mono text-[11px]">
            <thead>
              <tr className="border-b border-rule-strong bg-bg-elev text-[9px] uppercase tracking-[0.03em] text-text-faint">
                <Th>Sentiment model</Th><Th r>β</Th><Th r>HAC t</Th>
              </tr>
            </thead>
            <tbody>
              {gapstats.model.coefs.map((c) => (
                <tr key={c.name} className="border-b border-rule">
                  <td className="px-2 py-1 text-text">{c.name}</td>
                  <td className="px-2 py-1 text-right font-tabular text-text"><Num value={c.b} decimals={2} signed /></td>
                  <td className={`px-2 py-1 text-right font-tabular ${c.t != null && Math.abs(c.t) >= 2 ? "text-text" : "text-text-faint"}`}>{c.t == null ? "—" : mns(c.t)}</td>
                </tr>
              ))}
              <tr className="border-b border-rule">
                <td className="px-2 py-1 text-text">Web-redesign dummy (2024-07→)</td>
                <td className="px-2 py-1 text-right font-tabular text-text"><Num value={rds.dummyCoef} decimals={1} signed /></td>
                <td className="px-2 py-1 text-right font-tabular text-text">{mns(rds.dummyT!)}</td>
              </tr>
              <tr className="border-b border-rule bg-bg-sunken">
                <td className="px-2 py-1 text-text-dim">gap: raw / redesign-adj</td>
                <td className="px-2 py-1 text-right font-tabular text-text" colSpan={2}>{mns(cur.gapZ!)}σ / {mns(rds.gapZ!)}σ</td>
              </tr>
            </tbody>
          </table>
        </div>
        <div className="overflow-x-auto border border-rule">
          <table className="w-full border-collapse font-mono text-[11px]">
            <thead>
              <tr className="border-b border-rule-strong bg-bg-elev text-[9px] uppercase tracking-[0.03em] text-text-faint">
                <Th>Gap-z quintile</Th><Th r>fwd 3m</Th><Th r>hit</Th><Th r>n</Th>
              </tr>
            </thead>
            <tbody>
              {gq.map((q) => (
                <tr key={q.q} className={`border-b border-rule ${q.q === 1 ? "bg-bg-sunken" : ""}`}>
                  <td className="px-2 py-1 text-text">Q{q.q}{q.q === 1 ? " — gloom (today)" : q.q === 5 ? " — cheer vs model" : ""}</td>
                  <td className="px-2 py-1 text-right"><Pct v={q.mean} /></td>
                  <td className="px-2 py-1 text-right font-tabular text-text-dim">{q.hit}%</td>
                  <td className="px-2 py-1 text-right font-tabular text-text-faint">{q.n}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
      <p className="mb-4 text-[10px] text-text-faint">Table 10. Left: full-sample coefficient snapshot (2000–2026, HAC lag 12) including the web-redesign dummy; the gap series itself uses expanding-window re-estimation, and the redesign-adjusted gap z is measured against the baseline gap's history. Right: forward 3-month SPY return by gap-z quintile. Source: {FRED}, {YH}; {CALC}.</p>

      {/* 10 cross-section */}
      <Section n="10" title="The cross-section: mostly beta, honestly" />
      <P>
        The first version of this piece called the cross-section “where fear pays.” Applying the same
        inferential standard used on the nulls, the claim mostly does not survive — and since it was
        the paper's most tradeable sentence, the correction matters more than the original. Table 11
        conditions five long-short spreads on fear terciles, now with block-bootstrap CIs and, in the
        second panel, a beta hedge: each spread residualized on the market's forward return, because
        “cyclicals over defensives into a fear rebound” is close to a leveraged bet on the rebound
        itself. Raw, two spreads clear their intervals in the fear tercile — small−large at{" "}
        <Em>+{smlLrg.detail.Fear.mean}%</Em> [{smlLrg.detail.Fear.lo}, {smlLrg.detail.Fear.hi}] and
        Nasdaq−S&amp;P at +{qqq.detail.Fear.mean}% [{qqq.detail.Fear.lo}, {qqq.detail.Fear.hi}] —
        while cyclicals−defensives, the most intuitive one, does not
        ([{cycDef.detail.Fear.lo}, {cycDef.detail.Fear.hi}]). Beta-hedged, nearly everything collapses:
        cyclicals−defensives to {mns(cycDef.adj.Fear.mean!)}%, Nasdaq−S&amp;P to +{qqq.adj.Fear.mean}%,
        both with intervals straddling zero. The lone residual candidate is small−large at{" "}
        +{smlLrg.adj.Fear.mean}% [{smlLrg.adj.Fear.lo}, {smlLrg.adj.Fear.hi}] — marginal. This sits
        adjacent to the Baker-Wurgler result that speculative, hard-to-value stocks earn low returns
        after <em>high</em> sentiment; what shows up here is the flip side — the high-beta end recovers
        hardest after fear — and the beta hedge says most of that is the recovery itself, not a
        separate sentiment premium.
      </P>
      <div className="my-6 overflow-x-auto border border-rule">
        <table className="w-full border-collapse font-mono text-[11px]">
          <thead>
            <tr className="border-b border-rule-strong bg-bg-elev text-[9px] uppercase tracking-[0.03em] text-text-faint">
              <Th>Long − short spread (fwd 3m)</Th><Th r>Calm</Th><Th r>Fear</Th><Th r>Fear 95% CI</Th><Th r>hit</Th><Th r>mkt β</Th><Th r>Fear, β-adj</Th><Th r>adj 95% CI</Th>
            </tr>
          </thead>
          <tbody>
            {factors.spreads.map((s) => (
              <tr key={s.label} className="border-b border-rule">
                <td className="px-2 py-1 text-text">{s.label}</td>
                <td className="px-2 py-1 text-right"><Pct v={s.detail.Calm.mean} dim /></td>
                <td className="px-2 py-1 text-right"><Pct v={s.detail.Fear.mean} /></td>
                <td className="px-2 py-1 text-right font-tabular text-text-dim">[{s.detail.Fear.lo}, {s.detail.Fear.hi}]</td>
                <td className="px-2 py-1 text-right font-tabular text-text-dim">{s.detail.Fear.hit}%</td>
                <td className="px-2 py-1 text-right font-tabular text-text-dim"><Num value={s.beta} decimals={2} signed /></td>
                <td className="px-2 py-1 text-right"><Pct v={s.adj.Fear.mean} /></td>
                <td className="px-2 py-1 text-right font-tabular text-text-dim">[{s.adj.Fear.lo}, {s.adj.Fear.hi}]</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="mb-4 text-[10px] text-text-faint">Table 11. Forward 3-month relative return by fear tercile (cuts at F = {factors.cuts.t1} / {factors.cuts.t2}, in-sample), 2000–2026, with circular block-bootstrap 95% CIs (2,000 resamples). β-adj = spread residualized on the market's forward 3m return (full-sample β shown). Cyclicals = XLY/XLF/XLI/XLB/XLE, defensives = XLP/XLU/XLV. Source: {YH}, {FRED}; {CALC}.</p>
      <Takeaway>
        Rotating into cyclicals, small caps or the Nasdaq on fear spikes is, to first order, adding
        market beta at a volatile moment — a position-sizing decision, not an alpha source. The only
        candidate for residual signal is small−large, and it is marginal. If you want the exposure fear
        actually predicts, it is the variance exposure of §05, not a sector tilt.
      </Takeaway>

      {/* 11 overlay */}
      <Section n="11" title="The overlay that shouldn't work, and doesn't" />
      <P>
        Close the loop by trying to monetize the level anyway — a deliberately simple, fully real-time
        overlay: the composite's state at month-end sets next month's SPY weight —{" "}
        {Math.round(overlay.weights.fear * 100)}% in the fear state, {Math.round(overlay.weights.neutral * 100)}%
        neutral, {Math.round(overlay.weights.calm * 100)}% in the calm state, remainder in IEF. The
        first version used ±1σ cuts, which — on a right-skewed composite — fired the calm leg exactly{" "}
        {overlay.sigmaRule.stateMonths.calm} month in {stTot}: a half-run experiment. The redesign here
        uses <em>expanding-percentile</em> states (≥80th percentile of the composite's own history →
        fear, ≤20th → calm), which is symmetric by construction; the σ-rule is kept as a robustness
        row. The verdict does not change (Fig. 5, Table 12): Sharpe <Em>{overlay.strategy.sharpe}</Em>{" "}
        versus <Em>{overlay.bench.sharpe}</Em> for a static 70/30, a Sharpe difference of {sh.diff}
        whose bootstrap interval is [{sh.lo}, {sh.hi}] — {Math.round((1 - sh.pPos!) * 100)}% of resamples
        have the overlay behind its benchmark. The mechanism is §04 exactly: the fear state's extra
        exposure captured the 2009 and 2020 rebounds <em>and</em> the full continuation of 2008. An
        index overweight cannot keep the right tail and shed the left one.
      </P>
      <Figure n={5} title="Growth of $1: fear-scaled overlay vs static 70/30 vs buy-and-hold SPY (2003–2026)" source={`${YH} and ${FRED}; ${CALC}. Expanding-percentile states (≥80th fear / ≤20th calm) at month-end set next-month SPY/IEF weights. Cash rate = 3m T-bill for Sharpe.`}>
        <LineChart
          height={300} decimalsLeft={1} yLabelLeft="growth of $1"
          series={[
            { name: "fear-scaled overlay", color: AMBER, data: overlay.curve.map((d) => ({ date: d.date, value: d.strat })) },
            { name: "static 70/30", color: POS, data: overlay.curve.map((d) => ({ date: d.date, value: d.bench })) },
            { name: "buy-and-hold SPY", color: CYAN, data: overlay.curve.map((d) => ({ date: d.date, value: d.spy })) },
          ]}
        />
      </Figure>
      <div className="my-6 overflow-x-auto border border-rule">
        <table className="w-full border-collapse font-mono text-[11px]">
          <thead>
            <tr className="border-b border-rule-strong bg-bg-elev text-[9px] uppercase tracking-[0.03em] text-text-faint">
              <Th>Strategy</Th><Th r>CAGR</Th><Th r>vol</Th><Th r>Sharpe</Th><Th r>max DD</Th><Th r>worst 12m</Th>
            </tr>
          </thead>
          <tbody>
            {([["Fear-scaled overlay (percentile states)", overlay.strategy],
               ["— alt: ±1σ states", overlay.sigmaRule],
               ["Static 70/30", overlay.bench],
               ["Buy-and-hold SPY", overlay.spy]] as const).map(([name, s]) => (
              <tr key={name} className={`border-b border-rule ${String(name).startsWith("—") ? "text-text-dim" : ""}`}>
                <td className="px-2 py-1 text-text">{name}</td>
                <td className="px-2 py-1 text-right font-tabular text-text">{s.cagr}%</td>
                <td className="px-2 py-1 text-right font-tabular text-text-dim">{s.vol}%</td>
                <td className="px-2 py-1 text-right font-tabular text-text">{s.sharpe}</td>
                <td className="px-2 py-1 text-right"><Pct v={s.maxdd} /></td>
                <td className="px-2 py-1 text-right"><Pct v={s.worst12} /></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="mb-4 text-[10px] text-text-faint">Table 12. Monthly, {overlay.start} → {overlay.end}; risk-free ≈ {overlay.rfAnn}% (avg 3m T-bill). Percentile design states: fear {overlay.stateMonths.fear} / neutral {overlay.stateMonths.neutral} / calm {overlay.stateMonths.calm} months; turnover {overlay.strategy.turnover}%/mo. Sharpe difference vs 70/30: {sh.diff}, block-bootstrap 95% CI [{sh.lo}, {sh.hi}]. Source: {YH}, {FRED}; {CALC}.</p>
      <Takeaway>
        Fear-scaled index timing underperformed a static benchmark with the same average exposure, and
        the bootstrap puts {Math.round((1 - sh.pPos!) * 100)}% of the probability mass on that being
        real, not noise. If the desk wants to express the §05 result, the instruments are the ones that
        trade the distribution's width — options structures, variance exposure — not the index weight.
      </Takeaway>

      {/* 12 conclusion */}
      <Section n="12" title="Conclusion" />
      <P>
        Sentiment is not one number, and right now the pretense costs more than usual: credit at its
        tightest since 2000, the survey at a record low, uncertainty at the {ordinal(epu.pct)}{" "}
        percentile — a composite that nets to a meaningless neutral. Measured with the discipline the
        question deserves, the level of fear carries no mean forward-return information under any
        timing convention tested, and none of it survives out of sample. What fear robustly prices is
        the <em>width</em> of what comes next — +{vRV.bFear} points of forward realized volatility per
        σ, a +{c90.beta}pp effect on the 90th return percentile that survives the vol-clustering
        control — and width is not tradeable by re-weighting an index, as the overlay demonstrated at
        its own expense. The revision pass cut the paper's two most quotable numbers down to their
        honest size: the vibecession is {mns(rds.gapZ!)}σ once the survey redesign is dummied out, not{" "}
        {mns(cur.gapZ!)}σ; and the fear-tercile factor rotation is mostly market beta once hedged. What
        stands after the stress tests is narrower and more useful: fear is a state variable for
        dispersion and rebound convexity, not a directional signal — and the one mean effect left
        standing, the policy-uncertainty premium, has a pre-registered follow-up waiting in the{" "}
        <Link href="/research/2026-02-01-equity-duration" className="text-link no-underline hover:opacity-80">rate-sensitive corners</Link>{" "}
        of the index.
      </P>

      {/* appendix */}
      <Section n="A" title="Data & method" />
      <div className="space-y-2 font-mono text-[11px] leading-[18px] text-text-dim">
        <p><span className="text-text-faint">Sample.</span> Proxies fetched from 1985 (EPU's start) for z-score burn-in; all analysis restricted to 2000-01 → 2026-06, forward returns ending when their window closes (fwd 3m: 2026-03). Monthly frequency; daily/weekly series averaged within the month, surveys taken as published. Realized-vol measures from daily SPY adjusted closes (63-trading-day windows, annualized; semivols from the signed halves). VRP = VIX² − trailing 21-day realized variance.</p>
        <p><span className="text-text-faint">Sources.</span> FRED via the official API: UMCSENT, VIXCLS, BAA, AAA, NFCIRISK, USEPUINDXM, UNRATE, CPIAUCSL, GASREGW, TB3MS. Yahoo: SPY daily + monthly, ^GSPC, ^VIX fallback, IWD/IWF, IWM/IWB, QQQ, RSP, IEF and eight SPDR sectors. The credit leg is Moody's Baa−Aaa rather than high-yield OAS because ICE licensing caps BofA series on the FRED API at a trailing three-year window.</p>
        <p><span className="text-text-faint">Composite.</span> Equal-weight mean of five fear-signed expanding-window z-scores (population σ, 24-obs minimum), ≥4 of 5 required. Equal weighting is a choice, not an estimate — and a choice among correlated inputs is an implicit weighting (Table 13 below); §06 reports market-only and first-PC alternatives.</p>
        <div className="my-3 overflow-x-auto border border-rule">
          <table className="w-full border-collapse font-mono text-[10px]">
            <thead>
              <tr className="border-b border-rule-strong bg-bg-elev text-[9px] uppercase tracking-[0.03em] text-text-faint">
                <Th> </Th>{corr.labels.map((l) => <Th key={l} r>{l}</Th>)}
              </tr>
            </thead>
            <tbody>
              {corr.m.map((row, i) => (
                <tr key={i} className="border-b border-rule">
                  <td className="px-2 py-1 text-text">{corr.labels[i]}</td>
                  {row.map((v, j) => (
                    <td key={j} className={`px-2 py-1 text-right font-tabular ${i === j ? "text-text-faint" : Math.abs(v!) >= 0.6 ? "text-text" : "text-text-dim"}`}>{v!.toFixed(2)}</td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="text-[10px] text-text-faint">Table 13. Correlation matrix of the fear-signed z-scores, 2000–2026 (n = {corr.n}). Credit and the NFCI risk subindex overlap materially (the subindex includes credit spreads and the VIX among its ~50 inputs).</p>
        <p><span className="text-text-faint">Inference.</span> Quintile means carry circular block-bootstrap 95% intervals (block 6 — chosen a priori to span the 3-month overlap plus persistence; 3,000 resamples); quantile-regression CIs use the same scheme (1,200 raw / 800 controlled per τ); factor-tercile CIs 2,000. Time-series regressions use Newey-West (Bartlett kernel, lag {summary.hacLag}; lag 12 at the 12-month horizon). The overlap-corrected effective n ≈ n/h is a deliberately crude bound; Hansen-Hodrick errors or non-overlapping subsamples are the formal alternative and would not change any verdict here. The Sharpe comparison carries a block-bootstrap interval on the difference rather than a Ledoit-Wolf test — same idea, fewer assumptions.</p>
        <p><span className="text-text-faint">Out-of-sample.</span> Campbell-Thompson R²oos vs the expanding historical mean, {oos.start} → {oos.end}; training sets contain only observations whose forward window has closed; the tail rule's threshold is computed from the training window alone.</p>
        <p><span className="text-text-faint">Caveats.</span> Quintile/tercile breakpoints and tree splits are in-sample (§08 is the corrective). Proxies are revised-vintage FRED data; “real-time” refers to standardization, and §06's lag conventions bound — but do not eliminate — vintage effects (a full ALFRED vintage study is the right follow-up). Michigan prints with a publication lag ({mich.asOf} here) and its 2024 redesign is handled by dummy, not by splicing vintages. The AAII survey and put/call ratios are omitted — no stable free source with adequate history. ETF spreads begin at their listings (RSP 2003). Single market, single sample; an international replication is the cheap next test. Reproducible via <code className="text-text-dim">analysis/sentiment_tails.py</code> (requires a free FRED API key in <code className="text-text-dim">FRED_API_KEY</code>).</p>
        <p className="pt-1 text-text-faint">This is research, not investment advice.</p>
      </div>
    </article>
  );
}
