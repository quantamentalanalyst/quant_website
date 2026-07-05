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
import oos from "@/content/research/2026-07-04-sentiment-tails/data/oos.json";
import gapstats from "@/content/research/2026-07-04-sentiment-tails/data/gapstats.json";
import gapSeries from "@/content/research/2026-07-04-sentiment-tails/data/gap.json";
import factors from "@/content/research/2026-07-04-sentiment-tails/data/factors.json";
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
const Em = ({ children }: { children: React.ReactNode }) => <span className="text-data">{children}</span>;
const sgn = (x: number) => (x < 0 ? "−" : "+") + Math.abs(x);
const sgn2 = (x: number) => (x < 0 ? "−" : "+") + Math.abs(x).toFixed(2);
const mns = (x: number) => (x < 0 ? "−" : "") + Math.abs(x);
const Th = ({ children, r }: { children: React.ReactNode; r?: boolean }) => (
  <th className={`px-2 py-1.5 font-medium ${r ? "text-right" : "text-left"}`}>{children}</th>
);
function Pct({ v, d = 1, dim = false }: { v: number | null; d?: number; dim?: boolean }) {
  if (v == null) return <span className="text-text-faint">—</span>;
  return <span className={`font-tabular ${v >= 0 ? "text-pos" : "text-neg"} ${dim ? "opacity-55" : ""}`}>{v >= 0 ? "+" : "−"}{Math.abs(v).toFixed(d)}%</span>;
}

export default function SentimentTailsArticle({ meta }: { meta: ResearchMeta }) {
  const byKey = (k: string) => dashboard.find((d) => d.key === k)!;
  const vix = byKey("VIX");
  const credit = byKey("CREDIT");
  const epu = byKey("EPU");
  const mich = byKey("UMCSENT");
  const fearRow = byKey("FEAR");
  const fearLL = leadlag.find((l) => l.key === "FEAR")!;
  const epuLL = leadlag.find((l) => l.key === "EPU")!;
  const q1 = quintiles[0]!, q5 = quintiles[4]!;
  const s51 = summary.spread51;
  const t90 = qreg.taus.find((t) => t.tau === 0.9)!;
  const t75 = qreg.taus.find((t) => t.tau === 0.75)!;
  const t10 = qreg.taus.find((t) => t.tau === 0.1)!;
  const t25 = qreg.taus.find((t) => t.tau === 0.25)!;
  const t50 = qreg.taus.find((t) => t.tau === 0.5)!;
  const epuUni = horserace.uni.find((h) => h.key === "EPU")!;
  const epuMulti = horserace.multi.find((h) => h.key === "EPU")!;
  const cur = gapstats.current;
  const gq = gapstats.quint;
  const cycDef = factors.spreads.find((s) => s.label.startsWith("Cyclicals"))!;
  const smlLrg = factors.spreads.find((s) => s.label.startsWith("Small"))!;
  const qqq = factors.spreads.find((s) => s.label.startsWith("Nasdaq"))!;
  const qregRows = qreg.taus.map((t) => ({
    label: `τ = ${t.tau.toFixed(2)}`, value: t.beta!, tag: `[${t.lo}, ${t.hi}]`,
  }));
  const quintRows = quintiles.map((q) => ({
    label: `Q${q.q}${q.q === 1 ? " calm" : q.q === 5 ? " fear" : ""}`,
    value: q.mean!, tag: `${q.hit}%·n${q.n}`,
  }));

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
        uses only data available at <TeX>{"t"}</TeX> — and then asks the question in a form that can
        fail: does the level predict the forward 3-month S&amp;P return, and if not, what exactly does
        it predict?
      </P>
      <ul className="mb-4 ml-1 space-y-1.5 font-mono text-[13px] leading-[20px] text-text">
        {[
          <>The level predicts almost nothing. The fear composite's correlation with the forward 3-month return is <Em>{fearLL.c3!.toFixed(2)}</Em> (overlap-corrected t ≈ {fearLL.t3}); the top-minus-bottom quintile spread is +{s51.est}pp with a bootstrap CI of [{s51.lo}, {s51.hi}]; in-sample R² is {oos.r2InSample}%. There is no mean effect to trade.</>,
          <>What fear prices is the <em>shape</em>. A 1σ rise in the composite adds <Em>+{t90.beta}pp</Em> to the 90th percentile of the forward-return distribution (CI [{t90.lo}, {t90.hi}]) and +{t75.beta}pp to the 75th, while the 10th-percentile coefficient is <em>negative</em> ({t10.beta}, CI straddling zero). Fear widens the distribution — it buys the rebound and the continuation at the same time.</>,
          <>One proxy survives the horse race: news-based policy uncertainty, at <Em>+{epuMulti.beta}pp</Em> per σ (HAC t = {epuMulti.t}) in the five-way regression. The survey, the VIX and credit all die. Uncertainty appears to carry a premium; fear does not.</>,
          <>The Michigan survey prints <Em>{mich.last}</Em> — {cur.gap! < 0 ? mns(Math.abs(cur.gap!)) : cur.gap} points below the {cur.fitted} its own fundamentals model says (−{Math.abs(cur.gapZ!)}σ, the widest unexplained gloom on record) — and that gap predicts neither the market (t ≈ {gapstats.predMarket.t}) nor even the mood's mean reversion (t ≈ {gapstats.predMood.t}). The vibecession is a fact about the survey, not a signal about equities.</>,
        ].map((t, i) => (
          <li key={i} className="flex gap-2"><span className="text-accent">{String(i + 1).padStart(2, "0")}</span><span>{t}</span></li>
        ))}
      </ul>

      {/* 01 five instruments */}
      <Section n="01" title="One word, five instruments" />
      <P>
        Table 1 is the current state of the five gauges, each standardized against its own history
        (expanding-window z) with a percentile since 2000. Read the extremes first. The Baa−Aaa credit
        spread, at <Em>{credit.last}pp</Em>, is at its <Em>tightest reading since 2000</Em> — the 0th
        percentile; the credit market is pricing essentially no default-risk premium. The VIX sits at{" "}
        {vix.last}, its {vix.pct}th percentile — dead median. Policy uncertainty is at its{" "}
        <Em>{epu.pct}th percentile</Em>. And the Michigan survey is at <Em>{mich.last}</Em> — a level
        associated in every prior instance with deep recession, printed against a 4-handle unemployment
        rate. The five signed z-scores net to a composite of {fearRow.last} — the {fearRow.pct}th
        percentile, i.e. <em>neutral</em>. That netting is the first result: when the instruments
        disagree this much, a single “sentiment” number is an average of contradictions, and anyone
        quoting one is choosing which contradiction to ignore.
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
                <td className="px-2 py-1 text-right font-tabular text-text-dim">{d.pct == null ? "—" : `${d.pct}%`}</td>
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
        feel. One price of risk, one price of credit, one breadth measure, one news measure, one survey.
      </P>

      {/* 02 construction */}
      <Section n="02" title="Construction: a real-time fear composite" />
      <P>
        Each proxy is standardized on an expanding window and signed so that higher always means more
        fear; the composite is the equal-weight mean, requiring at least four of five to be available:
      </P>
      <TeXBlock eq="1">{"F_t=\\tfrac{1}{5}\\sum_{i} s_i\\, z^{\\,\\mathrm{RT}}_{i,t},\\qquad z^{\\,\\mathrm{RT}}_{i,t}=\\frac{x_{i,t}-\\mu_{i,\\,1:t}}{\\sigma_{i,\\,1:t}},\\qquad s_i\\in\\{+1,-1\\}"}</TeXBlock>
      <P>
        The discipline is the same as the macro piece: the z at month <TeX>{"t"}</TeX> uses only data
        through <TeX>{"t"}</TeX>, so every sort and regression below is one an investor could have run
        in real time. Daily series (VIX, NFCI components) are averaged within the month rather than
        sampled at month-end, which damps the noise in a series whose whole personality is spikes.
        Figure 1 plots the composite against the SPY drawdown; the spikes land where they should —
        2001–02, 2008–09, the 2011 and 2015 growth scares, March 2020, 2022 — which is the eyeball
        check that the construction measures what it claims to.
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
        and 12-month SPY return. The composite's 3-month correlation is <Em>{fearLL.c3!.toFixed(2)}</Em>.
        Not 0.04 hiding a nonlinearity the correlation misses — just nothing, and the honest correction
        makes it worse: forward 3-month returns sampled monthly overlap by two-thirds, so the {fearLL.n}{" "}
        months carry roughly {fearLL.nEff} independent observations, and the t-statistic is {fearLL.t3}.
        The quintile sort (Fig. 2, Table 3) says the same thing in portfolio form. Mean forward returns
        by fear quintile are {quintiles.map((q) => `${q.mean}%`).join(", ")} — a Q5−Q1 spread of{" "}
        <Em>+{s51.est}pp</Em> whose bootstrap interval, [{s51.lo}, {s51.hi}], contains zero with room to
        spare.
      </P>
      <P>
        One detail in Table 3 deserves more attention than the means: the <em>hit rate falls</em> as
        fear rises — {q1.hit}% of high-calm months are positive against {q5.hit}% of high-fear months —
        while the mean <em>rises</em>. More losing months, bigger winning ones. That combination is not
        a mean effect at all; it is a variance effect wearing a mean's clothes, and it is the first
        hint of the actual result in §04.
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
      <p className="mb-4 text-[10px] text-text-faint">Table 2. Correlation of each fear-signed proxy level with forward SPY returns, 2000–2026 (n = {fearLL.n} months). Effective n ≈ n/h corrects the overlap in h-month returns sampled monthly; t (eff.) is the corresponding t-statistic. Source: {FRED}, {YH}; {CALC}.</p>
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
      <Section n="04" title="What fear actually prices: the shape of the distribution" />
      <P>
        If fear changes the distribution of forward returns without changing its center, the right tool
        is quantile regression — estimate the effect of the composite not on the conditional mean but
        on each conditional quantile:
      </P>
      <TeXBlock eq="2">{"Q_{\\tau}\\!\\left(R_{t,t+3}\\,\\middle|\\,F_t\\right)=\\alpha_{\\tau}+\\beta_{\\tau}F_t,\\qquad \\tau\\in\\{0.10,\\,0.25,\\,0.50,\\,0.75,\\,0.90\\}"}</TeXBlock>
      <P>
        Figure 3 is the article's central result. The OLS (mean) coefficient is {qreg.ols.beta}pp per σ
        of fear with a t of {qreg.ols.t} — nothing, as §03 promised. But the quantile coefficients fan
        out: at the 90th percentile a 1σ rise in fear adds <Em>+{t90.beta}pp</Em> (block-bootstrap CI
        [{t90.lo}, {t90.hi}]), at the 75th <Em>+{t75.beta}pp</Em> (CI [{t75.lo}, {t75.hi}]), the median
        is {t50.beta}pp and indistinguishable from zero, and the 10th and 25th percentiles are{" "}
        <em>negative</em> ({t10.beta} and {t25.beta}) with intervals that straddle zero. A rise in fear
        does not shift the forward-return distribution to the right; it <em>stretches</em> it —
        materially in the right tail, and if anything adversely in the left. The colloquial version:
        buying fear does not buy you a better average outcome. It buys you a bigger rebound <em>if</em>{" "}
        the rebound comes, and no protection whatsoever if it doesn't. Fear is priced as variance.
      </P>
      <Figure n={3} title="Quantile-regression coefficients: effect of a 1σ rise in fear on each quantile of the forward 3-month return" source={`${FRED} and ${YH}; ${CALC}. β per σ of the composite; tags = circular block-bootstrap 95% CI (600 resamples per τ). OLS mean effect: ${qreg.ols.beta}pp (t ${qreg.ols.t}).`}>
        <BarH rows={qregRows} unit="pp" decimals={2} labelWidth={80} tagWidth={110} />
      </Figure>
      <P>
        A model-free cross-check: let a depth-two regression tree pick the thresholds itself (exhaustive
        SSE search, minimum leaf 24 months). The root split lands at <Em>F = {tree.root.thr}</Em> —
        almost exactly the Q4/Q5 boundary — with {tree.root.meanR}% above versus {tree.root.meanL}%
        below. Inside the high-fear branch the tree splits again at {tree.right!.thr}: the{" "}
        <em>moderately</em> elevated band pays {tree.right!.meanL}% (n = {tree.right!.nL}) while deep
        panic beyond {tree.right!.thr}σ pays a much less impressive {tree.right!.meanR}% (n ={" "}
        {tree.right!.nR}) — the right tail and the left tail arriving together, exactly as the quantile
        coefficients say. And the worst cell in the whole tree is not calm but <em>mild worry</em>{" "}
        ({tree.left!.thr} to {tree.root.thr}: {tree.left!.meanR}%). These are in-sample splits and I
        read them as description, not as a trading rule; the out-of-sample section explains why.
      </P>

      {/* 05 horse race */}
      <Section n="05" title="Horse race: only uncertainty survives" />
      <P>
        Which family carries what little mean information exists? Table 4 runs each proxy alone and all
        five jointly against the forward 3-month return, Newey-West errors throughout. Four of the five
        die on arrival — the VIX at β ≈ {horserace.uni.find((h) => h.key === "VIX")!.beta}, the survey at
        t = {horserace.uni.find((h) => h.key === "UMCSENT")!.t}, credit and financial conditions with
        the <em>wrong</em> sign. The exception is the Baker-Bloom-Davis policy-uncertainty index:{" "}
        <Em>+{epuUni.beta}pp</Em> per σ alone (t = {epuUni.t}) and <Em>+{epuMulti.beta}pp</Em> in the
        joint regression (t = {epuMulti.t}), the only coefficient that strengthens with controls. This
        is consistent with an uncertainty <em>premium</em> — compensation for holding equities when the
        policy path is illegible — and it is a different object from fear: the EPU counts newspaper
        coverage of unresolved policy questions, not risk-off price action. I flag the obvious caveat
        myself: one significant coefficient among five invites a multiple-testing discount, and the
        12-month correlation ({epuLL.c12}, t ≈ {epuLL.t12}) is the only other place it clears
        conventional bars. Suggestive, literature-consistent, not bulletproof.
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
                <Th>Joint (all five)</Th><Th r>β (pp/σ)</Th><Th r>HAC t</Th>
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
      <p className="mb-4 text-[10px] text-text-faint">Table 4. Forward 3-month SPY return regressed on fear-signed proxy z-scores, 2000–2026 (n = {horserace.multiN}); Newey-West HAC t (lag {summary.hacLag}). Joint R² = {horserace.multiR2}%. Source: {FRED}, {YH}; {CALC}.</p>

      {/* 06 OOS */}
      <Section n="06" title="Out of sample, nothing survives" />
      <P>
        The discipline that kills most sentiment papers: re-estimate everything on an expanding window
        and forecast truly out of sample, scoring against the expanding historical mean
        (Campbell-Thompson R²<sub>OOS</sub>). Training data at each month excludes any observation whose
        forward window hasn't closed. Over {oos.start} → {oos.end} (n = {oos.n}): the linear signal
        scores <Em>{oos.r2Lin}%</Em>, the +1σ tail rule <Em>{oos.r2Rule}%</Em> — both negative; you
        would have been better off assuming every quarter looks like the average quarter. Against an
        in-sample R² of just {oos.r2InSample}%, there was very little to lose in the first place. This
        is the appropriate epitaph for sentiment-based <em>index timing</em>, and it is why §04's tree
        thresholds stay descriptive. The result is not that sentiment contains nothing; it is that what
        it contains — the variance information — cannot be monetized by shifting the mean exposure of an
        index position.
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
      <p className="mb-4 text-[10px] text-text-faint">Table 5. Campbell-Thompson out-of-sample R² vs the expanding historical mean, {oos.start} → {oos.end} (n = {oos.n} monthly forecasts). Negative = the historical mean forecast was better. Source: {FRED}, {YH}; {CALC}.</p>

      {/* 07 vibecession */}
      <Section n="07" title="The vibecession, quantified" />
      <P>
        The loudest sentiment story of the past several years is the divergence between what households
        report and what the economy prints. To measure it, regress the Michigan index on the things
        that are supposed to drive it — unemployment, CPI inflation, gas-price inflation, the trailing
        12-month market return — re-estimated on an expanding window so the fitted value at{" "}
        <TeX>{"t"}</TeX> is a real-time nowcast. The model explains {gapstats.model.r2}% of the
        variance over the full sample, and the coefficients (Table 6) look like they should:
        a point of unemployment costs {mns(gapstats.model.coefs[0]!.b!)} index points (t ={" "}
        {gapstats.model.coefs[0]!.t}), a point of CPI inflation costs {mns(gapstats.model.coefs[1]!.b!)}{" "}
        (t = {gapstats.model.coefs[1]!.t}). One folk belief does not survive controls: <em>conditional
        on headline CPI</em>, gas prices carry a small positive coefficient — pump prices matter through
        inflation, not on top of it.
      </P>
      <P>
        The residual is the interesting object (Fig. 4). As of {cur.asOf}, the survey prints{" "}
        <Em>{cur.actual}</Em> against a model-implied <Em>{cur.fitted}</Em> — an unexplained gap of{" "}
        <Em>{mns(cur.gap!)} points, or −{Math.abs(cur.gapZ!)}σ</Em> against the gap's own history. For
        scale: the gap never breached −2σ in the GFC, when unemployment was 10%. Whatever the survey is
        measuring now — partisan response bias, inflation scarring, the affordability question the CPI
        basket understates — it is not the variables that explained it for the first two decades of the
        sample.
      </P>
      <Figure n={4} title="Michigan sentiment: actual vs fundamentals-model nowcast (expanding-window OLS)" source={`${FRED} and ${YH}; ${CALC}. Model: UMCSENT on unemployment, CPI YoY, gas-price YoY, trailing 12m ^GSPC return; re-estimated each month on data through that month.`}>
        <LineChart
          height={280} decimalsLeft={0} yLabelLeft="index"
          series={[
            { name: "Michigan sentiment (actual)", color: AMBER, data: gapSeries.map((d) => ({ date: d.date, value: d.actual! })) },
            { name: "fundamentals nowcast", color: CYAN, data: gapSeries.map((d) => ({ date: d.date, value: d.fitted! })) },
          ]}
        />
      </Figure>
      <P>
        Does unexplained gloom mean anything for returns? Table 6 (right) sorts forward 3-month returns
        by the gap's real-time z. The pattern is friendly at the edges — the most-above-model quintile
        pays {gq[4]!.mean}% — but no contrast is significant: the gap's regression on the forward
        12-month return has a t of {gapstats.predMarket.t}, and — the sharper null — it does not even
        predict the <em>survey's own</em> 12-month change (t = {gapstats.predMood.t}). Unexplained gloom
        neither reverts on schedule nor drags equities with it. This extends the hard/soft result in the{" "}
        <Link href="/research/2026-05-30-macro-regime" className="text-link no-underline hover:opacity-80">macro-regime piece</Link>{" "}
        with a stronger design — model residual rather than z-difference — and lands on a cleaner
        conclusion: <em>the vibecession is a fact about the mood, not a signal about the market.</em>
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
              <tr className="border-b border-rule bg-bg-sunken">
                <td className="px-2 py-1 text-text-dim">R² / n</td>
                <td className="px-2 py-1 text-right font-tabular text-text" colSpan={2}>{gapstats.model.r2}% / {gapstats.model.n}</td>
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
      <p className="mb-4 text-[10px] text-text-faint">Table 6. Left: full-sample coefficient snapshot (2000–2026, HAC lag 12); the gap itself uses expanding-window re-estimation. Right: forward 3-month SPY return by gap-z quintile; today's −{Math.abs(cur.gapZ!)}σ sits in the extreme of Q1. Source: {FRED}, {YH}; {CALC}.</p>

      {/* 08 cross-section */}
      <Section n="08" title="The cross-section is where fear pays" />
      <P>
        If fear prices variance, its tradeable expression should be in <em>relative</em> returns — the
        high-beta end of the market embeds more of the rebound optionality. Table 7 conditions five
        long-short spreads on fear terciles. In the fear tercile, every risk-on spread flips positive:
        cyclicals−defensives <Em>+{cycDef.byTercile.Fear}%</Em> per quarter, Nasdaq−S&amp;P
        +{qqq.byTercile.Fear}%, small−large +{smlLrg.byTercile.Fear}% — each of them flat-to-negative in
        the calm tercile. Value−growth is the odd one out: <em>negative</em> in fear
        ({factors.spreads[0]!.byTercile.Fear}%), because post-2008 fear episodes resolved through
        duration rallies that favored growth. The pattern is the quantile result in factor form: what
        recovers hardest out of a fear episode is whatever has the most market beta, not whatever is
        cheapest.
      </P>
      <div className="my-6 overflow-x-auto border border-rule">
        <table className="w-full border-collapse font-mono text-[11px]">
          <thead>
            <tr className="border-b border-rule-strong bg-bg-elev text-[9px] uppercase tracking-[0.03em] text-text-faint">
              <Th>Long − short spread (fwd 3m)</Th><Th r>Calm</Th><Th r>Neutral</Th><Th r>Fear</Th>
            </tr>
          </thead>
          <tbody>
            {factors.spreads.map((s) => (
              <tr key={s.label} className="border-b border-rule">
                <td className="px-2 py-1 text-text">{s.label}</td>
                <td className="px-2 py-1 text-right"><Pct v={s.byTercile.Calm} /></td>
                <td className="px-2 py-1 text-right"><Pct v={s.byTercile.Neutral} /></td>
                <td className="px-2 py-1 text-right"><Pct v={s.byTercile.Fear} /></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="mb-4 text-[10px] text-text-faint">Table 7. Forward 3-month relative return by fear tercile (cuts at F = {factors.cuts.t1} and {factors.cuts.t2}, in-sample), 2000–2026. Cyclicals = XLY/XLF/XLI/XLB/XLE, defensives = XLP/XLU/XLV. Descriptive sorts; the same overlap caveats apply. Source: {YH}, {FRED}; {CALC}.</p>

      {/* 09 overlay */}
      <Section n="09" title="The overlay that shouldn't work, and doesn't" />
      <P>
        Close the loop by trying to monetize the level anyway — a deliberately simple, fully real-time
        overlay: the composite's state at month-end (vs its own expanding mean and σ) sets next month's
        SPY weight — {Math.round(overlay.weights.fear * 100)}% when fear ≥ +1σ,{" "}
        {Math.round(overlay.weights.neutral * 100)}% otherwise, {Math.round(overlay.weights.calm * 100)}%
        below −1σ, remainder in IEF. The theory of §04 predicts this fails: going overweight into fear
        buys both tails, and an index position cannot keep the good one and shed the bad one. It fails
        on schedule (Fig. 5, Table 8): Sharpe <Em>{overlay.strategy.sharpe}</Em> versus{" "}
        <Em>{overlay.bench.sharpe}</Em> for a static 70/30 with the same average exposure — and a max
        drawdown of {overlay.strategy.maxdd}%, statistically indistinguishable from buy-and-hold,
        because the rule was 100% long through the middle of 2008. Two details tell the story: the calm
        state fired exactly {overlay.stateMonths.calm} month in {overlay.stateMonths.fear + overlay.stateMonths.neutral + overlay.stateMonths.calm} (the
        composite's expanding distribution is too right-skewed for a −1σ reading to occur), and the fear
        state's extra exposure captured 2009 and 2020 rebounds <em>and</em> the full continuation of
        2008 — the two tails, delivered as promised.
      </P>
      <Figure n={5} title="Growth of $1: fear-scaled overlay vs static 70/30 vs buy-and-hold SPY (2003–2026)" source={`${YH} and ${FRED}; ${CALC}. Real-time composite state at month-end sets next-month SPY/IEF weights. Cash rate = 3m T-bill for Sharpe.`}>
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
            {([["Fear-scaled overlay", overlay.strategy], ["Static 70/30", overlay.bench], ["Buy-and-hold SPY", overlay.spy]] as const).map(([name, s]) => (
              <tr key={name} className="border-b border-rule">
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
      <p className="mb-4 text-[10px] text-text-faint">Table 8. Monthly, {overlay.start} → {overlay.end}; risk-free ≈ {overlay.rfAnn}% (avg 3m T-bill). Overlay turnover {overlay.strategy.turnover}%/mo. Source: {YH}, {FRED}; {CALC}.</p>

      {/* 10 conclusion */}
      <Section n="10" title="Conclusion" />
      <P>
        Sentiment is not one number, and right now the pretense costs more than usual: credit at its
        tightest since 2000, the survey at a record low, uncertainty at the 91st percentile — a
        composite that nets to a meaningless neutral. Measured with the discipline the question
        deserves, the level of fear carries no mean forward-return information at any horizon that
        survives the overlap correction, and none of it survives out of sample. What fear robustly
        prices is the <em>width</em> of the forward distribution — +{t90.beta}pp per σ at the 90th
        percentile against a dead median — which is variance information, and variance information
        cannot be monetized by timing an index. It can be expressed in the cross-section (the high-beta
        rebound tilt of Table 7) or, more naturally, in instruments that trade variance directly. The
        survey deserves its own epitaph: {mns(cur.gap!)} points below its own fundamentals, the widest
        unexplained gloom on record, predicting neither the market nor even itself. The one thread
        worth pulling further is the uncertainty premium — the only mean effect left standing — and
        whether it holds when the policy path in question runs through the{" "}
        <Link href="/research/2026-02-01-equity-duration" className="text-link no-underline hover:opacity-80">rate-sensitive corners</Link>{" "}
        of the index.
      </P>

      {/* appendix */}
      <Section n="A" title="Data & method" />
      <div className="space-y-2 font-mono text-[11px] leading-[18px] text-text-dim">
        <p><span className="text-text-faint">Sample.</span> Proxies fetched from 1985 (EPU's start) for z-score burn-in; all analysis restricted to 2000-01 → 2026-06, forward returns ending when their window closes (fwd 3m: 2026-03). Monthly frequency; daily/weekly series averaged within the month, surveys taken as published.</p>
        <p><span className="text-text-faint">Sources.</span> FRED via the official API: UMCSENT, VIXCLS, BAA, AAA, NFCIRISK, USEPUINDXM, UNRATE, CPIAUCSL, GASREGW, TB3MS. Yahoo monthly: SPY (forward returns), ^GSPC (trailing-return regressor), ^VIX (VIXCLS fallback), IWD/IWF, IWM/IWB, QQQ, RSP, IEF and eight SPDR sectors. The credit leg is Moody's Baa−Aaa rather than high-yield OAS because ICE licensing caps BofA series on the FRED API at a trailing three-year window — unusable for expanding standardization.</p>
        <p><span className="text-text-faint">Composite.</span> Equal-weight mean of five fear-signed expanding-window z-scores (population σ, 24-obs minimum), requiring ≥4 of 5 present. No weights were fit; equal weighting is a choice, not an estimate.</p>
        <p><span className="text-text-faint">Inference.</span> Quintile means carry circular block-bootstrap 95% intervals (block 6, 3,000 resamples); quantile-regression CIs use the same scheme (600 resamples per τ). Time-series regressions use Newey-West (lag {summary.hacLag}; lag 12 for 12-month horizons). Unconditional correlations report the overlap-corrected effective n ≈ n/h. The regression tree is an exhaustive-SSE split, depth 2, minimum leaf 24 — reported as description, not inference.</p>
        <p><span className="text-text-faint">Out-of-sample.</span> Campbell-Thompson R²oos vs the expanding historical mean, {oos.start} → {oos.end}; at each forecast date the training set contains only observations whose 3-month forward window has closed, and the tail rule's +1σ threshold is computed from the training window alone.</p>
        <p><span className="text-text-faint">Caveats.</span> Quintile/tercile breakpoints and the tree's splits are in-sample (the OOS section is the corrective). Proxies are revised-vintage FRED data; "real-time" refers to standardization, not data vintages. Michigan prints with a publication lag ({mich.asOf} here). The AAII bull-bear survey and put/call ratios are omitted — no stable free source with adequate history. ETF spreads begin at their listings (RSP 2003), shortening some tercile cells. Reproducible via <code className="text-text-dim">analysis/sentiment_tails.py</code> (requires a free FRED API key in <code className="text-text-dim">FRED_API_KEY</code>).</p>
        <p className="pt-1 text-text-faint">This is research, not investment advice.</p>
      </div>
    </article>
  );
}
