import Link from "next/link";
import { site } from "@/lib/site";
import type { ResearchMeta } from "@/lib/content";
import Figure from "./Figure";
import { TeX, TeXBlock } from "./TeX";
import { Num } from "@/components/ui/Num";
import LineChart from "./charts/LineChart";
import BarH from "./charts/BarH";

import dashboard from "@/content/research/2026-05-30-macro-regime/data/dashboard.json";
import inflation from "@/content/research/2026-05-30-macro-regime/data/inflation.json";
import signal from "@/content/research/2026-05-30-macro-regime/data/signal.json";
import leadlag from "@/content/research/2026-05-30-macro-regime/data/leadlag.json";
import regime from "@/content/research/2026-05-30-macro-regime/data/regime.json";
import regReg from "@/content/research/2026-05-30-macro-regime/data/regime_reg.json";
import robustness from "@/content/research/2026-05-30-macro-regime/data/robustness.json";
import reaction from "@/content/research/2026-05-30-macro-regime/data/reaction.json";
import confidence from "@/content/research/2026-05-30-macro-regime/data/confidence.json";
import hardsoft from "@/content/research/2026-05-30-macro-regime/data/hardsoft.json";
import factors from "@/content/research/2026-05-30-macro-regime/data/factors.json";
import alloc from "@/content/research/2026-05-30-macro-regime/data/alloc.json";

const AMBER = "var(--color-accent)";
const CYAN = "var(--color-data)";
const POS = "var(--color-pos)";
const NEG = "var(--color-neg)";
const FRED = "Federal Reserve Economic Data (FRED), St. Louis Fed";
const YH = "Yahoo Finance (SPY, S&P 500 TR, sector/factor ETFs)";
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
// proper-minus formatters for inline prose (the audience cares about typography)
const sgn = (x: number) => (x < 0 ? "−" : "") + Math.abs(x);
const sgn2 = (x: number) => (x < 0 ? "−" : "") + Math.abs(x).toFixed(2);
const Th = ({ children, r }: { children: React.ReactNode; r?: boolean }) => (
  <th className={`px-2 py-1.5 font-medium ${r ? "text-right" : "text-left"}`}>{children}</th>
);
// signed % cell, green/red by sign, optionally dimmed
function Pct({ v, d = 1, dim = false }: { v: number | null; d?: number; dim?: boolean }) {
  if (v == null) return <span className="text-text-faint">—</span>;
  return <span className={`font-tabular ${v >= 0 ? "text-pos" : "text-neg"} ${dim ? "opacity-55" : ""}`}>{v >= 0 ? "+" : "−"}{Math.abs(v).toFixed(d)}%</span>;
}

export default function MacroRegimeArticle({ meta }: { meta: ResearchMeta }) {
  const byKey = (k: string) => regime.find((r) => r.key === k)!;
  const stag = byKey("G↓ I↑");
  const refl = byKey("G↑ I↑");
  const slow = byKey("G↓ I↓");
  const gold = byKey("G↑ I↓");
  const leadTop = leadlag[0]; // initial claims (largest |corr|)
  const leadRows = leadlag.map((l) => ({ label: l.label, value: l.corr!, tag: `t ${l.tEff}` }));
  const regimeRows = regime.map((r) => ({ label: r.name, value: r.mean!, tag: `${r.hit}%·n${r.n}` }));
  const cur = confidence;
  const GRP = ["Reflation", "Goldilocks", "Slowdown", "Stagflation"] as const;

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
        An equity investor is handed a firehose of macro — payrolls, CPI, core PCE, jobless claims,
        retail sales, ISM, sentiment — each release moving the tape for an afternoon. This piece makes
        two claims and is careful about the difference between them. <span className="text-text">Negative
        claim:</span> measured unconditionally, an individual macro indicator's <em>level</em> carries
        almost no information about the forward three-month equity return. <span className="text-text">Positive
        claim:</span> the joint <em>regime</em> — whether growth is accelerating and whether inflation
        is rising — does sort forward returns, but the only statistically defensible statement is{" "}
        <em>binary</em>: stagflation is the one quadrant that does not pay. Everything here is built on{" "}
        <em>real-time</em> (expanding-window) standardization, so the regime label at month <TeX>{"t"}</TeX>{" "}
        uses only data available at <TeX>{"t"}</TeX> — the result is not an artifact of look-ahead.
      </P>
      <ul className="mb-4 ml-1 space-y-1.5 font-mono text-[13px] leading-[20px] text-text">
        {[
          <>Unconditionally, prints are weak. The largest absolute correlation between any indicator level and the forward 3-month S&amp;P return is <Em>{leadTop.corr!.toFixed(2)}</Em> ({leadTop.label.toLowerCase()}); corrected for the overlap in monthly-sampled 3-month returns (effective n ≈ {leadTop.nEff}), even that is marginal (t ≈ {leadTop.tEff}) — and carries the “wrong”, reaction-function sign.</>,
          <>Regime sorts returns, but the robust result is binary. <Em>Stagflation</Em> is the only quadrant with a negative mean ({sgn(stag.mean!)}%, {stag.hit}% hit); the other three pay +{gold.mean}% to +{refl.mean}%. Their bootstrap 95% intervals overlap heavily, so the four-way <em>ranking</em> is within noise — do not over-read “reflation is best.”</>,
          <>The spread is real and survives the look-ahead fix. Non-stagflation regimes beat stagflation by <Em>+{regReg.joint.est}pp</Em> per quarter (Newey-West t = {regReg.joint.t}); the expanding-window estimate ({sgn(stag.mean!)}%) matches the full-sample one ({sgn(robustness.find((r) => r.label.startsWith("Full-sample"))!.stag!)}%), and stagflation is last in all {robustness.length} robustness variants.</>,
          <>Today is <Em>reflation</Em> but low-confidence — growth is only {cur.growth.sigma}σ into acceleration. Core PCE re-accelerating to 3.3% is the swing variable; consumer sentiment sits 1.8σ below trend against solid hard data, the widest non-recession hard/soft gap.</>,
        ].map((t, i) => (
          <li key={i} className="flex gap-2"><span className="text-accent">{String(i + 1).padStart(2, "0")}</span><span>{t}</span></li>
        ))}
      </ul>

      {/* 01 unconditional weakness */}
      <Section n="01" title="Macro prints are weak standalone signals" />
      <P>
        Start with the negative result, because it motivates everything after. For each indicator I
        compute the Pearson correlation between its current reading and the <em>subsequent</em>
        three-month S&amp;P 500 return, 2000–2026 (Fig. 1, Table 1). Every correlation is small: the
        largest magnitude is <Em>{leadTop.corr!.toFixed(2)}</Em>, for initial claims. And the signs are perverse —
        the only positive “leaders” are the bad-news indicators (claims, unemployment, VIX). That is
        not macro momentum; it is the <em>reaction function</em>: weak data and fear pull forward policy
        easing and compress risk premia, which lift subsequent returns. The growth and inflation series
        investors actually trade — retail sales, industrial production, core CPI — cluster at or below
        zero.
      </P>
      <Figure n={1} title="Unconditional lead-lag: correlation of each indicator level with the forward 3-month S&P 500 return" source={`${FRED} and ${YH}; ${CALC}. Monthly, 2000–2026. Tag = t-stat on the overlap-corrected effective sample.`}>
        <BarH rows={leadRows} unit="" decimals={2} labelWidth={176} tagWidth={48} />
      </Figure>
      <P>
        Two refinements make the point sharper rather than softer. <span className="text-text">First,
        the effective sample is far smaller than it looks.</span> Forward 3-month returns sampled
        monthly overlap by two-thirds, so the {leadTop.n} monthly observations behave like ≈{leadTop.nEff}{" "}
        independent ones. On that corrected sample even the strongest correlation ({leadTop.corr}) has a
        t-stat of only ≈{leadTop.tEff} (Table 1) — the honest reading is “indistinguishable from noise,”
        which <em>strengthens</em> the thesis. <span className="text-text">Second, levels are not the
        only transform.</span> Three-month changes do no better; the one with any signal is financial
        conditions (NFCI), whose Δ3m correlation of <Em>{sgn2(leadlag.find((l) => l.label.startsWith("Fin."))!.corrChg!)}</Em>{" "}
        is still small and, again, reaction-function-signed. The precise claim is therefore not “macro
        is noise” but: <em>raw indicator levels contain little unconditional forward-return information;
        their value is in whether they move the regime, the policy path, or the risk premium.</em>
      </P>

      <div className="my-6 overflow-x-auto border border-rule">
        <table className="w-full border-collapse font-mono text-[11px]">
          <thead>
            <tr className="border-b border-rule-strong bg-bg-elev text-[9px] uppercase tracking-[0.03em] text-text-faint">
              <Th>Indicator</Th><Th r>corr (level)</Th><Th r>corr (Δ3m)</Th><Th r>n</Th><Th r>n eff.</Th><Th r>t (eff.)</Th>
            </tr>
          </thead>
          <tbody>
            {leadlag.map((l) => (
              <tr key={l.label} className="border-b border-rule">
                <td className="px-2 py-1 text-text">{l.label}</td>
                <td className="px-2 py-1 text-right font-tabular text-text"><Num value={l.corr} decimals={2} signed /></td>
                <td className="px-2 py-1 text-right font-tabular text-text-dim"><Num value={l.corrChg} decimals={2} signed /></td>
                <td className="px-2 py-1 text-right font-tabular text-text-faint">{l.n}</td>
                <td className="px-2 py-1 text-right font-tabular text-text-faint">{l.nEff}</td>
                <td className={`px-2 py-1 text-right font-tabular ${Math.abs(l.tEff!) >= 2 ? "text-text" : "text-text-faint"}`}>{l.tEff! >= 0 ? "+" : "−"}{Math.abs(l.tEff!).toFixed(1)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="mb-4 text-[10px] text-text-faint">Table 1. Unconditional correlation with the forward 3-month SPY return, 2000–2026. Effective n ≈ n/3 corrects for the overlap in monthly-sampled 3-month returns; t (eff.) is the corresponding correlation t-statistic. Source: {FRED}, {YH}; {CALC}.</p>
      <P>
        Is the perverse sign really the reaction function, or just state-dependent risk premia (high
        VIX → high subsequent returns is, after all, the equity risk premium being mean-reverting)? The
        two are partly separable: if it is the <em>policy</em> reaction function, the effect should
        weaken after 2022, when the Fed was hiking <em>into</em> weak sentiment rather than easing to
        rescue it. It does. The claims–return correlation falls from <Em>+{reaction.claims.pre}</Em>{" "}
        pre-2022 to <Em>{reaction.claims.post! >= 0 ? "+" : "−"}{Math.abs(reaction.claims.post!)}</Em>{" "}
        after; the VIX correlation flips from +{reaction.vix.pre} to{" "}
        {reaction.vix.post! >= 0 ? "+" : "−"}{Math.abs(reaction.vix.post!)}. The bad-news-is-good-news
        channel is conditional on an easing-biased Fed — exactly what you would expect if it is the
        reaction function and not a mechanical risk-premium constant.
      </P>

      {/* 02 dashboard */}
      <Section n="02" title="The current macro dashboard" />
      <P>
        Table 2 is the current state — latest reading, the value a year ago, a trailing-10-year z-score,
        and a one-line read. The economy is <Em>late-cycle but not recessionary</Em>: unemployment low
        at 4.3%, claims subdued near <Em>215k</Em>, industrial-production growth back positive, the Sahm
        rule dormant at 0.13 (trigger 0.50), and the Fed easing (funds 3.6%, −70bp y/y). The two notes
        of tension: core PCE has re-accelerated to <Em>3.3%</Em>, and consumer sentiment sits at a{" "}
        <Em>−1.8σ</Em> extreme the hard data flatly contradicts (§07).
      </P>
      <div className="my-6 overflow-x-auto border border-rule">
        <table className="w-full border-collapse font-mono text-[12px]">
          <thead>
            <tr className="border-b border-rule-strong bg-bg-elev text-[10px] uppercase tracking-[0.04em] text-text-faint">
              <Th>Indicator</Th><Th r>Latest</Th><Th r>1y ago</Th><Th r>z (10y)</Th><Th>Read</Th>
            </tr>
          </thead>
          <tbody>
            {dashboard.map((d) => (
              <tr key={d.label} className="border-b border-rule">
                <td className="px-2 py-1 text-text">{d.label} <span className="text-text-faint">{d.unit}</span></td>
                <td className="px-2 py-1 text-right text-text"><Num value={d.last} decimals={d.unit === "k" || d.unit === "idx" ? 0 : 2} /></td>
                <td className="px-2 py-1 text-right text-text-dim"><Num value={d.prior} decimals={d.unit === "k" || d.unit === "idx" ? 0 : 2} /></td>
                <td className="px-2 py-1 text-right"><span className={d.z >= 0 ? "text-pos" : "text-neg"}><Num value={d.z} decimals={2} signed /></span></td>
                <td className="px-2 py-1 text-[11px] text-text-dim">{d.interp}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="mb-4 text-[10px] text-text-faint">Table 2. Macro dashboard, as of {meta.date}. z = standardized vs the trailing 10 years (as-of-date). The 10y–3m curve is omitted when FRED rate-limits its daily series. Source: {FRED}; {CALC}.</p>

      {/* 03 building the regime */}
      <Section n="03" title="Building the regime: growth × inflation, in real time" />
      <P>
        I summarize growth with a composite of the standardized year-over-year change of three hard
        series — industrial production, payrolls, and retail sales — and classify each month by whether
        the composite is rising and whether core inflation is rising:
      </P>
      <TeXBlock eq="1">{"g_t=\\tfrac{1}{3}\\sum_{i} z^{\\,\\mathrm{RT}}_{i,t},\\qquad z^{\\,\\mathrm{RT}}_{i,t}=\\frac{x_{i,t}-\\mu_{i,\\,1:t}}{\\sigma_{i,\\,1:t}}"}</TeXBlock>
      <TeXBlock eq="2">{"\\mathrm{regime}_t=\\big(\\operatorname{sign}(g_t-g_{t-3}),\\ \\operatorname{sign}(\\pi^{\\mathrm{core}}_t-\\pi^{\\mathrm{core}}_{t-3})\\big)"}</TeXBlock>
      <P>
        The detail that matters is the superscript <TeX>{"\\mathrm{RT}"}</TeX> on the z-score. The
        standardization is <em>expanding-window</em>: at each month <TeX>{"t"}</TeX> the mean and
        standard deviation use only observations through <TeX>{"t"}</TeX>. This is the fix for the
        original version's central flaw. With <em>full-sample</em> standardization, a month in 2004 is
        labeled “growth accelerating” partly using the series mean and variance computed through 2026 —
        information that did not exist yet — and since the entire result is “regime sorts forward
        returns,” the sort would be partly mechanical. Expanding-window standardization removes that
        contamination; the regime label is one an investor could actually have assigned in real time.
        FRED data is fetched back to 1990 so that by the 2000 sample start each z-score already has a
        decade of history. Figure 2 plots the two regime axes — the real-time growth composite and the
        3-month change in core-CPI inflation — whose signs define the quadrant.
      </P>
      <Figure n={2} title="The two regime axes: real-time growth composite (z) and the 3-month change in core-CPI inflation" source={`${FRED} and ${YH}; ${CALC}. Growth composite standardized expanding-window. Both centered on zero — the quadrant is the joint sign.`}>
        <LineChart
          height={280} decimalsLeft={1} decimalsRight={1} zeroLine
          yLabelLeft="growth composite (z)" yLabelRight="Δ3m core CPI (pp)"
          series={[
            { name: "growth composite (z, real-time)", color: AMBER, axis: "left", data: signal.map((d) => ({ date: d.date, value: d.growth! })) },
            { name: "core CPI 3m change (pp)", color: CYAN, axis: "right", data: signal.filter((d) => d.inflChg != null).map((d) => ({ date: d.date, value: d.inflChg! })) },
          ]}
        />
      </Figure>

      {/* 04 regime returns */}
      <Section n="04" title="Regime returns: stagflation is the only quadrant that doesn’t pay" />
      <P>
        Sort the forward 3-month SPY return by real-time quadrant (Fig. 3, Table 3). The headline is
        deliberately binary. <Em>Stagflation</Em> — growth decelerating into rising inflation — is the
        only quadrant with a negative mean (<Em>{sgn(stag.mean!)}%</Em>, a {stag.hit}% hit rate, barely a coin
        flip). The other three all pay, between +{gold.mean}% and +{refl.mean}%. I resist ranking them,
        and so should the reader: the bootstrap 95% intervals (Table 3) overlap almost completely —
        reflation’s [{refl.lo}, {refl.hi}] sits inside slowdown’s [{slow.lo}, {slow.hi}], which sits
        inside goldilocks’s [{gold.lo}, {gold.hi}]. With regimes that persist for many months and
        returns that overlap, the <em>effective</em> sample is perhaps 15–25 independent episodes, not
        the {refl.n + slow.n + gold.n + stag.n} months printed. “Reflation is the best quadrant” is not
        a claim the data can support. “Stagflation is the only bad quadrant” is.
      </P>
      <Figure n={3} title="Mean forward 3-month S&P 500 return by real-time growth×inflation regime (2000–2026)" source={`${FRED} and ${YH}; ${CALC}. Bar = mean forward 3m return; tag = hit rate · n months. Expanding-window classification.`}>
        <BarH rows={regimeRows} unit="%" decimals={1} labelWidth={96} tagWidth={84} />
      </Figure>
      <div className="grid gap-5 md:grid-cols-2">
        <div className="overflow-x-auto border border-rule">
          <table className="w-full border-collapse font-mono text-[11px]">
            <thead>
              <tr className="border-b border-rule-strong bg-bg-elev text-[9px] uppercase tracking-[0.03em] text-text-faint">
                <Th>Regime</Th><Th r>mean</Th><Th r>95% CI</Th><Th r>hit</Th><Th r>n</Th>
              </tr>
            </thead>
            <tbody>
              {regime.map((r) => (
                <tr key={r.key} className="border-b border-rule">
                  <td className="px-2 py-1 text-text">{r.name}</td>
                  <td className="px-2 py-1 text-right"><Pct v={r.mean} /></td>
                  <td className="px-2 py-1 text-right font-tabular text-text-dim">[{r.lo}, {r.hi}]</td>
                  <td className="px-2 py-1 text-right font-tabular text-text-dim">{r.hit}%</td>
                  <td className="px-2 py-1 text-right font-tabular text-text-faint">{r.n}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="overflow-x-auto border border-rule">
          <table className="w-full border-collapse font-mono text-[11px]">
            <thead>
              <tr className="border-b border-rule-strong bg-bg-elev text-[9px] uppercase tracking-[0.03em] text-text-faint">
                <Th>Contrast vs stagflation</Th><Th r>estimate</Th><Th r>HAC t</Th>
              </tr>
            </thead>
            <tbody>
              {regReg.contrasts.map((c) => (
                <tr key={c.name} className="border-b border-rule">
                  <td className="px-2 py-1 text-text">{c.name.replace(" − Stagflation", "")}</td>
                  <td className="px-2 py-1 text-right"><span className="font-tabular text-pos">+{c.est}pp</span></td>
                  <td className={`px-2 py-1 text-right font-tabular ${Math.abs(c.t!) >= 2 ? "text-text" : "text-text-faint"}`}>{c.t}</td>
                </tr>
              ))}
              <tr className="border-b border-rule bg-bg-sunken">
                <td className="px-2 py-1 text-text">Non-stagflation (joint)</td>
                <td className="px-2 py-1 text-right"><span className="font-tabular text-pos">+{regReg.joint.est}pp</span></td>
                <td className="px-2 py-1 text-right font-tabular text-text">{regReg.joint.t}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
      <p className="mb-4 mt-2 text-[10px] text-text-faint">Table 3. Left: cell means with circular block-bootstrap 95% intervals (block = 6 months, 3,000 resamples). Right: <TeX>{"R_{t,t+3}=\\alpha+\\beta_1\\mathrm{Refl}+\\beta_2\\mathrm{Slow}+\\beta_3\\mathrm{Gold}+\\varepsilon"}</TeX>, stagflation omitted; Newey-West HAC t (lag {regReg.hacLag}, for the 3-month overlap). Source: {FRED}, {YH}; {CALC}.</p>
      <P>
        The regression makes the binary claim precise. With stagflation as the omitted category, its
        own mean (<Em>{sgn2(regReg.stagMean!)}%</Em>) is statistically indistinguishable from zero (t ={" "}
        {regReg.stagT}), reflation and slowdown sit <Em>+{regReg.contrasts[0].est}pp</Em> (t ={" "}
        {regReg.contrasts[0].t}) and +{regReg.contrasts[1].est}pp (t = {regReg.contrasts[1].t}) above
        it, while goldilocks — at +{regReg.contrasts[2].est}pp (t = {regReg.contrasts[2].t}) — is{" "}
        <em>not</em> reliably different, a useful honesty check on the “every other quadrant pays”
        story. Pooling the three, non-stagflation beats stagflation by <Em>+{regReg.joint.est}pp</Em>{" "}
        per quarter with a HAC t of {regReg.joint.t}. The economically interesting half is <em>why</em>{" "}
        slowdown pays at all: falling growth into falling inflation pulls forward easing and lower
        discount rates, so a cooling economy is bullish for equities right up until inflation refuses to
        cool with it. The swing variable is inflation, not growth.
      </P>

      {/* 05 robustness */}
      <Section n="05" title="Robustness: does the binary result survive the discretionary choices?" />
      <P>
        The construction has arbitrary choices — a 3-month momentum window, exactly three equally
        weighted growth series, core CPI, a hard sign cut, full-history standardization. Table 4 re-runs
        the quadrant means under thirteen perturbations. The pattern is the point: <Em>stagflation is
        the lowest-returning quadrant in every single variant</Em>, and the only one with a negative
        mean in {robustness.filter((r) => r.stagOnlyNeg).length} of {robustness.length}. It survives a
        6-month window, core PCE instead of core CPI, 3-month-annualized instead of YoY growth, a
        PCA-weighted composite, dropping any one growth series, total-return instead of price, and
        excluding either COVID or the GFC. Most importantly it survives the standardization swap:{" "}
        <em>expanding-window</em> ({sgn(stag.mean!)}%) and <em>full-sample</em> ({sgn(robustness.find((r) => r.label.startsWith("Full-sample"))!.stag!)}%) give nearly
        identical stagflation means — confirming the original result was real, not a look-ahead artifact,
        while still earning the right to call the signal real-time.
      </P>
      <div className="my-6 overflow-x-auto border border-rule">
        <table className="w-full border-collapse font-mono text-[11px]">
          <thead>
            <tr className="border-b border-rule-strong bg-bg-elev text-[9px] uppercase tracking-[0.03em] text-text-faint">
              <Th>Robustness variant</Th><Th r>Refl</Th><Th r>Gold</Th><Th r>Slow</Th><Th r>Stag</Th><Th r>stag last?</Th>
            </tr>
          </thead>
          <tbody>
            {robustness.map((v, i) => (
              <tr key={v.label} className={`border-b border-rule ${i === 0 ? "bg-bg-sunken" : ""}`}>
                <td className="px-2 py-1 text-text">{v.label}</td>
                <td className="px-2 py-1 text-right"><Pct v={v.refl} /></td>
                <td className="px-2 py-1 text-right"><Pct v={v.gold} /></td>
                <td className="px-2 py-1 text-right"><Pct v={v.slow} /></td>
                <td className="px-2 py-1 text-right"><Pct v={v.stag} /></td>
                <td className="px-2 py-1 text-right">{v.stagLowest ? <span className="text-pos">✓{v.stagOnlyNeg ? " <0" : ""}</span> : <span className="text-neg">✗</span>}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="mb-4 text-[10px] text-text-faint">Table 4. Mean forward 3-month return by quadrant under each perturbation; “stag last?” ✓ if stagflation is the lowest-returning quadrant, “&lt;0” if it is also the only negative one. Baseline row shaded. Source: {FRED}, {YH}; {CALC}.</p>

      {/* 06 current regime */}
      <Section n="06" title="Current regime and transition risk" />
      <P>
        A hard classifier returns a label; a useful one returns a label <em>and</em> a confidence. The
        model places us in <Em>{cur.regime}</Em> — growth firming, core inflation rising — historically
        among the better quadrants. But the classification is <em>low confidence</em> (Table 5). The
        growth signal is only <Em>{cur.growth.sigma}σ</Em> into acceleration ({cur.growth.strength}) and
        sits close to the zero boundary, so a single data revision could flip the growth sign and tip
        the label toward goldilocks (disinflation) or, if inflation keeps climbing while growth rolls
        over, into the one quadrant that doesn’t pay. The inflation signal is firmer
        (+{cur.infl.sigma}σ, {cur.infl.strength}). The honest statement is: <em>reflation, but a
        small-margin reflation whose stability rests on the distance of two signals from their zero
        thresholds.</em>
      </P>
      <div className="my-6 overflow-x-auto border border-rule">
        <table className="w-full border-collapse font-mono text-[11px]">
          <thead>
            <tr className="border-b border-rule-strong bg-bg-elev text-[9px] uppercase tracking-[0.03em] text-text-faint">
              <Th>Component</Th><Th r>direction</Th><Th r>distance from boundary</Th><Th r>strength</Th>
            </tr>
          </thead>
          <tbody>
            <tr className="border-b border-rule">
              <td className="px-2 py-1 text-text">Growth composite, 3m change</td>
              <td className="px-2 py-1 text-right text-pos">{cur.growth.dir}</td>
              <td className="px-2 py-1 text-right font-tabular text-text">{cur.growth.sigma >= 0 ? "+" : "−"}{Math.abs(cur.growth.sigma)}σ</td>
              <td className="px-2 py-1 text-right text-text-dim">{cur.growth.strength}</td>
            </tr>
            <tr className="border-b border-rule">
              <td className="px-2 py-1 text-text">Core-CPI YoY, 3m change</td>
              <td className="px-2 py-1 text-right text-neg">{cur.infl.dir}</td>
              <td className="px-2 py-1 text-right font-tabular text-text">{cur.infl.sigma >= 0 ? "+" : "−"}{Math.abs(cur.infl.sigma)}σ</td>
              <td className="px-2 py-1 text-right text-text-dim">{cur.infl.strength}</td>
            </tr>
            <tr className="border-b border-rule bg-bg-sunken">
              <td className="px-2 py-1 text-text">Regime label → <span className="text-accent">{cur.regime}</span></td>
              <td className="px-2 py-1 text-right text-text-faint" colSpan={2}>confidence (lower of the two percentiles)</td>
              <td className="px-2 py-1 text-right text-text">{cur.confidence} · {cur.confPct}%</td>
            </tr>
          </tbody>
        </table>
      </div>
      <p className="mb-4 text-[10px] text-text-faint">Table 5. Real-time classification of the latest month ({cur.asOf}). Distance from boundary in standard deviations of the historical 3-month change; strength is the percentile of |change| in its own history. Source: {FRED}; {CALC}.</p>
      <P>
        Inflation is the variable to watch because it is the one moving against the favorable label.
        Core PCE has lifted from 2.6% to <Em>3.3%</Em> over the past year and headline CPI from 2.3% to
        3.8% (Fig. 4). A further leg higher that stalls the goods recovery would rotate the book from
        reflation straight into stagflation — the transition, not the current state, is the risk.
      </P>
      <Figure n={4} title="Inflation, the swing variable: CPI, core CPI, core PCE (% YoY)" source={`${FRED} — CPIAUCSL, CPILFESL, PCEPILFE. Monthly.`}>
        <LineChart
          height={260} decimalsLeft={1} yLabelLeft="% YoY"
          series={[
            { name: "CPI", color: AMBER, data: inflation.map((d) => ({ date: d.date, value: d.cpi! })) },
            { name: "core CPI", color: CYAN, data: inflation.map((d) => ({ date: d.date, value: d.core! })) },
            { name: "core PCE", color: POS, data: inflation.map((d) => ({ date: d.date, value: d.corePce! })) },
          ]}
        />
      </Figure>

      {/* 07 hard/soft */}
      <Section n="07" title="The hard/soft divergence as its own factor" />
      <P>
        The most unusual feature of the current dashboard deserves its own test. Consumer sentiment is{" "}
        <Em>−1.8σ</Em> below trend while the hard data is broadly fine — the widest hard/soft gap
        outside a recession. Does that gap carry forward-return information? Define a hard-data composite
        (real-time z of industrial production, payrolls, retail sales, and inverted unemployment and
        claims) and subtract the z of Michigan sentiment; sort the gap into quintiles (Table 6). The
        relationship is not monotone, but the tails are informative: the lowest-gap quintile — sentiment
        running <em>ahead</em> of the hard data, i.e. complacency — is the only one that fails to pay
        ({hardsoft.quint[0].mean}%, {hardsoft.quint[0].hit}% hit), while the highest-gap quintile —
        depressed sentiment against solid hard data — returns <Em>+{hardsoft.quint[4].mean}%</Em>{" "}
        ({hardsoft.quint[4].hit}% hit). Today’s reading sits in that top bucket: a gap of{" "}
        <Em>+{hardsoft.currentGap}</Em> (hard z {hardsoft.currentHardZ! >= 0 ? "+" : ""}{hardsoft.currentHardZ}, Michigan z {sgn2(hardsoft.currentMichZ!)}).
        The intuition is the classic one — when expectations are already on the floor and the hard data
        refuses to confirm them, the bar for positive surprise is low.
      </P>
      <div className="my-6 overflow-x-auto border border-rule">
        <table className="w-full border-collapse font-mono text-[11px]">
          <thead>
            <tr className="border-b border-rule-strong bg-bg-elev text-[9px] uppercase tracking-[0.03em] text-text-faint">
              <Th>Hard − soft gap quintile</Th><Th r>gap range</Th><Th r>fwd 3m return</Th><Th r>hit</Th><Th r>n</Th>
            </tr>
          </thead>
          <tbody>
            {hardsoft.quint.map((q) => (
              <tr key={q.q} className={`border-b border-rule ${q.q === 5 ? "bg-bg-sunken" : ""}`}>
                <td className="px-2 py-1 text-text">Q{q.q}{q.q === 1 ? " — sentiment ahead of hard data" : q.q === 5 ? " — sentiment below hard data (today)" : ""}</td>
                <td className="px-2 py-1 text-right font-tabular text-text-dim">[{q.gapLo}, {q.gapHi}]</td>
                <td className="px-2 py-1 text-right"><Pct v={q.mean} /></td>
                <td className="px-2 py-1 text-right font-tabular text-text-dim">{q.hit}%</td>
                <td className="px-2 py-1 text-right font-tabular text-text-faint">{q.n}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="mb-4 text-[10px] text-text-faint">Table 6. Forward 3-month SPY return by hard/soft-gap quintile, 2000–2026. Gap = z(hard composite) − z(Michigan sentiment), real-time standardized; quintile breakpoints are in-sample (descriptive). Source: {FRED}, {YH}; {CALC}.</p>

      {/* 08 portfolio implications */}
      <Section n="08" title="Portfolio implications: factor tilts and a regime-driven allocation" />
      <P>
        Regimes matter more for <em>relative</em> performance than for index direction, so the actionable
        output is the cross-section. Table 7 reports the forward 3-month return of four long-short
        spreads conditioned on the real-time regime, plus the best and worst single sector in each
        quadrant. The tilts line up with theory: <Em>cyclicals over defensives</Em> in every quadrant
        except stagflation (where defensives win, +{factors.spreads[2].byRegime.Goldilocks}% goldilocks
        vs {sgn((factors.spreads[2].byRegime as Record<string, number>).Stagflation)}% stagflation); <Em>value over growth</Em> only in
        stagflation (+{factors.spreads[0].byRegime.Stagflation}%), where inflation protection is scarce,
        with growth leading in the disinflationary quadrants; and at the sector level Technology leads
        goldilocks (+{factors.sectorTilt[1].best!.ret}%) while Utilities is the only sector that pays in
        stagflation (+{factors.sectorTilt[3].best!.ret}%) and Materials is the worst
        ({sgn(factors.sectorTilt[3].worst!.ret)}%). The single instruction a PM can take from the framework:
        in the stagflation corner, rotate from cyclicals and growth into defensives, value, and the
        rate-insensitive end of the curve.
      </P>
      <div className="my-6 overflow-x-auto border border-rule">
        <table className="w-full border-collapse font-mono text-[11px]">
          <thead>
            <tr className="border-b border-rule-strong bg-bg-elev text-[9px] uppercase tracking-[0.03em] text-text-faint">
              <Th>Long − short spread (fwd 3m)</Th>{GRP.map((g) => <Th key={g} r>{g.slice(0, 4)}</Th>)}
            </tr>
          </thead>
          <tbody>
            {factors.spreads.map((s) => (
              <tr key={s.label} className="border-b border-rule">
                <td className="px-2 py-1 text-text">{s.label}</td>
                {GRP.map((g) => <td key={g} className="px-2 py-1 text-right"><Pct v={(s.byRegime as Record<string, number>)[g]} /></td>)}
              </tr>
            ))}
            <tr className="border-b border-rule bg-bg-sunken">
              <td className="px-2 py-1 text-text-dim">best / worst sector</td>
              {factors.sectorTilt.map((t) => (
                <td key={t.regime} className="px-2 py-1 text-right text-[10px]">
                  <span className="text-pos">{t.best!.sym}</span> <span className="text-text-faint">/</span> <span className="text-neg">{t.worst!.sym}</span>
                </td>
              ))}
            </tr>
          </tbody>
        </table>
      </div>
      <p className="mb-4 text-[10px] text-text-faint">Table 7. Forward 3-month relative return of each spread by real-time regime; columns Refl/Gold/Slow/Stag. Style/size from IWD-IWF, IWM-IWB, RSP-SPY; cyclicals = XLY/XLF/XLI/XLB/XLE, defensives = XLP/XLU/XLV. Pure momentum/quality/min-vol ETFs have post-2013 histories too short to condition reliably and are omitted. Source: {YH}, {FRED}; {CALC}.</p>
      <P>
        Finally, does the framework <em>improve outcomes</em>, or is it merely descriptive? Table 8 and
        Figure 5 run a deliberately simple, fully real-time rule: the regime label at month{" "}
        <TeX>{"t"}</TeX> (expanding-window, so tradeable) sets the next month’s allocation — 100% equity
        in reflation and goldilocks, 75/25 equity/Treasuries in slowdown, and a defensive
        40/20/20/20 equity/Treasuries/gold/cash in stagflation. Versus buy-and-hold SPY (2005–2026, the
        span over which all sleeves exist), the overlay raises the Sharpe from <Em>{alloc.spy.sharpe}</Em>{" "}
        to <Em>{alloc.strategy.sharpe}</Em> and roughly halves the worst drawdown
        (<Em>{alloc.strategy.maxdd}%</Em> vs {alloc.spy.maxdd}%) for a similar CAGR
        ({alloc.strategy.cagr}% vs {alloc.spy.cagr}%), at modest turnover ({alloc.strategy.turnover}%/mo).
      </P>
      <Figure n={5} title="Growth of $1: regime-driven allocation vs. buy-and-hold SPY (2005–2026)" source={`${YH} and ${FRED}; ${CALC}. Real-time (expanding-window) regime label sets next-month weights. Cash = 3m T-bill.`}>
        <LineChart
          height={300} decimalsLeft={1} yLabelLeft="growth of $1"
          series={[
            { name: "regime allocation", color: AMBER, data: alloc.curve.map((d) => ({ date: d.date, value: d.strat })) },
            { name: "buy-and-hold SPY", color: CYAN, data: alloc.curve.map((d) => ({ date: d.date, value: d.spy })) },
          ]}
        />
      </Figure>
      <div className="my-6 overflow-x-auto border border-rule">
        <table className="w-full border-collapse font-mono text-[11px]">
          <thead>
            <tr className="border-b border-rule-strong bg-bg-elev text-[9px] uppercase tracking-[0.03em] text-text-faint">
              <Th>Strategy</Th><Th r>CAGR</Th><Th r>vol</Th><Th r>Sharpe</Th><Th r>max DD</Th><Th r>worst 12m</Th><Th r>’05–09</Th><Th r>’10–19</Th><Th r>’20–26</Th>
            </tr>
          </thead>
          <tbody>
            {([["Regime allocation", alloc.strategy], ["Buy-and-hold SPY", alloc.spy]] as const).map(([name, s]) => (
              <tr key={name} className="border-b border-rule">
                <td className="px-2 py-1 text-text">{name}</td>
                <td className="px-2 py-1 text-right font-tabular text-text">{s.cagr}%</td>
                <td className="px-2 py-1 text-right font-tabular text-text-dim">{s.vol}%</td>
                <td className="px-2 py-1 text-right font-tabular text-text">{s.sharpe}</td>
                <td className="px-2 py-1 text-right"><Pct v={s.maxdd} /></td>
                <td className="px-2 py-1 text-right"><Pct v={s.worst12} /></td>
                <td className="px-2 py-1 text-right"><Pct v={s.byDecade["2005–09"]} /></td>
                <td className="px-2 py-1 text-right"><Pct v={s.byDecade["2010–19"]} /></td>
                <td className="px-2 py-1 text-right"><Pct v={s.byDecade["2020–26"]} /></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="mb-4 text-[10px] text-text-faint">Table 8. Monthly, 2005–2026; risk-free ≈ {alloc.rfAnn}% (avg 3m T-bill). CAGR/Sharpe annualized; columns ’05–09 etc. are per-period CAGR. Source: {YH}, {FRED}; {CALC}.</p>
      <P>
        Read it honestly: <em>almost the entire edge is the GFC de-risk.</em> In 2005–09 the overlay
        returns +{alloc.strategy.byDecade["2005–09"]}% a year versus SPY’s {sgn(alloc.spy.byDecade["2005–09"])}%,
        because slowdown and stagflation labels pulled the book out of equities into 2008; in the two
        bull decades since, the defensive sleeves are a drag and pure SPY wins on CAGR
        ({alloc.spy.byDecade["2020–26"]}% vs {alloc.strategy.byDecade["2020–26"]}% in the 2020s). The
        framework is therefore best understood as <em>risk management</em> — a structural improvement in
        drawdown and Sharpe by avoiding the stagflation corner — not as an alpha engine. That is the
        defensible claim, and it is the one the statistics support.
      </P>

      {/* 09 conclusion */}
      <Section n="09" title="Conclusion" />
      <P>
        The macro edge is not in the prints. Individually, indicator levels carry almost no forward-return
        information, and what little they have runs through the policy reaction function — backwards to
        the naïve reading. The information is in the regime, and even there the disciplined claim is
        narrow: built in real time so it could actually have been traded, the growth×inflation quadrant
        sorts forward equity returns in exactly one robust way — <em>stagflation is the only quadrant
        that doesn’t pay</em>, by +{regReg.joint.est}pp a quarter (HAC t {regReg.joint.t}), stable across
        all {robustness.length} robustness cuts, while the finer ranking among the paying quadrants is
        within noise. Converted into an allocation, that single distinction earns its keep as drawdown
        control, not return enhancement. Today the model reads reflation, but at low confidence and with
        inflation — the swing variable — leaning the wrong way; the question for an equity book is not
        “what was CPI” but “how far are we from the stagflation corner,” which is also where the{" "}
        <Link href="/research/2026-02-01-equity-duration" className="text-link no-underline hover:opacity-80">rate-sensitive sectors</Link>{" "}
        hurt most.
      </P>

      {/* appendix */}
      <Section n="A" title="Data & method" />
      <div className="space-y-2 font-mono text-[11px] leading-[18px] text-text-dim">
        <p><span className="text-text-faint">Sample.</span> FRED series are fetched from 1990 to provide a ≥10-year burn-in for the expanding-window standardization; the <em>analysis</em> — regime classification, forward returns, regressions, factor sorts — is restricted to {alloc.start === "2005-01" ? "2000-01 → 2026-05" : "2000-01 → 2026-05"} (the allocation backtest to 2005-01, once the Treasury/gold/cash sleeves exist). Daily/weekly series resampled to month-end; equities to monthly close.</p>
        <p><span className="text-text-faint">Sources.</span> FRED (no key): PAYEMS, UNRATE, ICSA, CPIAUCSL, CPILFESL, PCEPI, PCEPILFE, RSAFS, INDPRO, FEDFUNDS, NFCI, UMCSENT, SAHMCURRENT, TB3MS, the Philly Fed manufacturing index, and (when not rate-limited) T10Y3M. VIX from Yahoo ^VIX. Equities/ETFs Yahoo monthly: SPY, ^SP500TR, IWF/IWD, IWM/IWB, RSP, IEF, GLD, and eleven SPDR sectors.</p>
        <p><span className="text-text-faint">Regime.</span> Growth composite = equal-weight mean of <em>expanding-window</em> z-scores of YoY INDPRO, PAYEMS, RSAFS; growth direction = sign of its 3-month change; inflation direction = sign of the 3-month change in core-CPI YoY. The expanding window standardizes each month using only data through that month — no look-ahead. Full-sample and rolling-10y standardizations appear only as robustness rows.</p>
        <p><span className="text-text-faint">Inference.</span> Cell means carry circular block-bootstrap 95% intervals (block 6 months, 3,000 resamples) to respect regime persistence and return overlap. The regime regression uses Newey-West HAC standard errors (Bartlett, {regReg.hacLag} monthly lags) covering the 3-month-return overlap and persistence. Unconditional correlations report an effective n ≈ n/3 and the corresponding t.</p>
        <p><span className="text-text-faint">Caveats.</span> Classification uses revised FRED vintages, not real-time releases, so the “real-time” label refers to standardization, not data revisions — a genuine limitation for the backtest. ISM PMI is excluded (not freely redistributable); the Philly Fed survey is a directional proxy, not numerically equivalent. Factor spreads are tradeable-ETF returns, not pure factors; pure momentum/quality/min-vol ETFs post-date 2013 and are omitted from the regime conditioning. Reproducible via <code className="text-text-dim">analysis/macro_regime.py</code>.</p>
        <p className="pt-1 text-text-faint">This is research, not investment advice.</p>
      </div>
    </article>
  );
}
