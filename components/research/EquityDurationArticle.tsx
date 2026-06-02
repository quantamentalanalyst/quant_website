import { site } from "@/lib/site";
import type { ResearchMeta } from "@/lib/content";
import Figure from "./Figure";
import { TeX, TeXBlock } from "./TeX";
import LineChart from "./charts/LineChart";
import BarH from "./charts/BarH";
import Scatter from "./charts/Scatter";

import yields from "@/content/research/2026-02-01-equity-duration/data/yields.json";
import rollingCorr from "@/content/research/2026-02-01-equity-duration/data/rolling_corr.json";
import sectorBetas from "@/content/research/2026-02-01-equity-duration/data/sector_betas.json";
import growthValue from "@/content/research/2026-02-01-equity-duration/data/growth_value.json";
import gvScatter from "@/content/research/2026-02-01-equity-duration/data/gv_scatter.json";
import curve from "@/content/research/2026-02-01-equity-duration/data/curve.json";

const AMBER = "var(--color-accent)";
const CYAN = "var(--color-data)";
const FRED = "Federal Reserve Economic Data (FRED), St. Louis Fed";
const YH = "Yahoo Finance (daily adjusted close)";
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
function Em({ children }: { children: React.ReactNode }) {
  return <span className="text-data">{children}</span>;
}

export default function EquityDurationArticle({ meta }: { meta: ResearchMeta }) {
  const betaRows = (sectorBetas as { label: string; sens100: number; tstat: number }[]).map((s) => ({
    label: s.label,
    value: s.sens100,
    tag: `t ${s.tstat > 0 ? "+" : "−"}${Math.abs(s.tstat).toFixed(1)}`,
    faint: Math.abs(s.tstat) < 2,
  }));

  return (
    <article className="mx-auto max-w-[860px] pb-16">
      {/* Header */}
      <header className="border-b border-rule-strong pb-5">
        <div className="mb-3 flex items-center gap-3 text-[10px]">
          <span className="bg-accent px-1.5 py-0.5 font-medium uppercase tracking-[0.1em] text-bg">
            driver · {meta.driver}
          </span>
          <span className="font-tabular text-text-faint">{meta.date}</span>
          <span className="text-text-faint">·</span>
          <span className="text-text-faint">{meta.readingTime} min read</span>
          <span className="text-text-faint">·</span>
          <span className="text-text-faint">{site.name}</span>
        </div>
        <h1 className="text-[26px] leading-[1.15] text-text">{meta.title}</h1>
        <p className="mt-4 max-w-[68ch] font-mono text-[13px] leading-[22px] text-text-dim">{meta.abstract}</p>
      </header>

      {/* Thesis */}
      <Section n="00" title="Thesis" />
      <P>
        Rates are the single most important variable in cross-asset pricing — but the way equity
        investors <em>attribute</em> rate sensitivity is mostly wrong. The reflexive framing —
        “Technology is long-duration, so it sells off when yields rise” — turns out to be one of the
        weakest relationships in the data. The real rate-beta of US equities lives in the bond-proxy
        sectors and <em>inverts</em> in the reflation complex. Using daily data from January 2021
        through January 2026 (<Em>n = 1,265</Em> trading days), I decompose equity rate sensitivity
        and reach four conclusions:
      </P>
      <ul className="mb-4 ml-1 space-y-1.5 font-mono text-[13px] leading-[20px] text-text">
        {[
          "The regime shift was a real-yield repricing: the 10y real yield went from −1.08% to +1.90%, a ~300bp tightening in the equity discount rate.",
          "The stock–bond correlation broke in 2022 and has since normalized — a single pooled correlation is the wrong summary statistic.",
          "Cross-sectional rate-beta is concentrated in bond proxies (Real Estate −5.7%, Utilities −4.4% per +100bp) and inverts in Energy (+3.6%) and Financials (+1.1%).",
          "“Tech = long duration” is statistically weak (β = −1.2%, t = −1.7); growth-minus-value loads on rates with the right sign but fragile significance.",
        ].map((t, i) => (
          <li key={i} className="flex gap-2">
            <span className="text-accent">{String(i + 1).padStart(2, "0")}</span>
            <span>{t}</span>
          </li>
        ))}
      </ul>

      {/* 01 regime */}
      <Section n="01" title="The regime: a real-yield repricing" />
      <P>
        The headline of this cycle is not the nominal 10-year yield — which rose from{" "}
        <Em>0.93%</Em> to <Em>4.26%</Em> — but the <em>real</em> 10-year, which traveled from{" "}
        <Em>−1.08%</Em> to <Em>+1.90%</Em> (Fig. 1). That ~300bp move in the real discount rate is
        what compresses the present value of distant cash flows; the rest is inflation
        compensation. The 2-year repriced even harder (0.11% → 3.52%), and the 10y–2y curve, deeply
        inverted through 2022–23, has re-steepened to <Em>+0.74</Em>. The free-money discount-rate
        regime equities enjoyed in 2021 is gone, and every valuation argument since has been an
        argument about where the real yield settles.
      </P>
      <Figure n={1} title="Nominal vs. real 10-year Treasury yield, 2021–2026" source={`${FRED} — series DGS10, DFII10. Daily.`}>
        <LineChart
          height={300}
          decimalsLeft={1}
          yLabelLeft="yield, %"
          series={[
            { name: "10y nominal (DGS10)", color: AMBER, data: yields.map((d) => ({ date: d.date, value: d.nominal })) },
            { name: "10y real (DFII10)", color: CYAN, data: yields.map((d) => ({ date: d.date, value: d.real })) },
          ]}
        />
      </Figure>

      {/* 02 correlation */}
      <Section n="02" title="The stock–bond correlation broke, then healed" />
      <P>
        Define <TeXInline>{"\\rho_t"}</TeXInline> as the 63-day rolling correlation between the daily{" "}
        <em>change</em> in the 10-year yield and the S&amp;P 500’s return (Fig. 2). In 2021 it was
        mildly positive (<Em>+0.10</Em>): rising yields signaled growth, and equities rallied
        alongside them. In 2022 it inverted to <Em>−0.17</Em> — every uptick in yields was a pure
        valuation shock. It stayed negative through 2023 (−0.07) and only normalized back to{" "}
        <Em>+0.04</Em> across 2024–25. The full-sample average (−0.055) is nearly zero and hides all
        of this. A relationship that is itself regime-dependent cannot be summarized by one pooled
        number — the sign of the equity–rate correlation <em>is</em> the macro regime.
      </P>
      <Figure n={2} title="63-day rolling correlation: Δ(10y yield) vs. S&P 500 return" source={`${FRED} (DGS10) and ${YH} (SPY); ${CALC}.`}>
        <LineChart
          height={280}
          decimalsLeft={2}
          zeroLine
          yLabelLeft="ρ (63d)"
          series={[{ name: "corr(Δ10y, SPX ret)", color: AMBER, data: rollingCorr.map((d) => ({ date: d.date, value: d.corr })) }]}
        />
      </Figure>

      {/* 03 cross-section */}
      <Section n="03" title="The cross-section: where rate-beta actually lives" />
      <P>
        To locate the sensitivity, I estimate a univariate OLS rate-beta for each GICS sector ETF —
        daily simple return on the daily change in the 10-year yield (in percentage points):
      </P>
      <TeXBlock eq="1">{"r_{i,t} \\;=\\; \\alpha_i \\;+\\; \\beta_i\\,\\Delta y_t \\;+\\; \\varepsilon_{i,t}"}</TeXBlock>
      <P>
        where <TeXInline>{"r_{i,t}"}</TeXInline> is sector <TeXInline>{"i"}</TeXInline>’s return,{" "}
        <TeXInline>{"\\Delta y_t"}</TeXInline> the daily yield change, and{" "}
        <TeXInline>{"\\beta_i\\times100"}</TeXInline> the return for a <Em>+100bp</Em> move. Figure 3
        ranks all eleven sectors. The ordering is a near-perfect duration ladder — but not the one
        the narrative predicts.
      </P>
      <Figure n={3} title="Sector rate-beta: return (%) per +100bp move in the 10-year (2021–2026)" source={`${YH} (SPDR sector ETFs) and ${FRED} (DGS10); ${CALC}. Faded bars: |t| < 2.`}>
        <BarH rows={betaRows} unit="%" decimals={2} />
      </Figure>
      <P>
        The most rate-sensitive sectors are the <em>bond proxies</em> — Real Estate (<Em>−5.7%</Em>,
        t = −10.9, R² = 0.09) and Utilities (<Em>−4.4%</Em>, t = −9.2) — whose cash flows are
        long-dated and bond-like. The defensives follow (Staples −2.0%, Health Care −2.1%). At the
        other end, the reflation complex flips the sign: Financials (<Em>+1.1%</Em>, t = 2.1) reprice
        net-interest margins higher, and Energy (<Em>+3.6%</Em>, t = 4.8) rides the same
        growth-and-inflation impulse that lifts yields.
      </P>
      <P>
        The twist sits in the middle of the ladder. <em>Technology</em> — the poster child for “long
        duration” — posts a β of just <Em>−1.2%</Em> with a t-stat of −1.7, below conventional
        significance. Over this sample, mega-cap tech behaved less like a 30-year zero-coupon bond
        and more like a quality-growth compounder whose earnings revisions swamped its discount-rate
        sensitivity. Duration intuition is real for cash-flow-distant bond proxies; for tech, it is
        mostly a story we tell.
      </P>

      {/* 04 growth-value */}
      <Section n="04" title="Growth vs. value is a duration trade — on paper" />
      <P>
        If rate-sensitivity were a <em>factor-level</em> phenomenon, growth-minus-value should load
        cleanly on yields. Figure 4 overlays the Russell growth/value ratio (IWF/IWD) against the
        10-year: the value comeback visually tracks the yield backup.
      </P>
      <Figure n={4} title="Growth/Value ratio (IWF/IWD, rebased=100) vs. 10-year yield" source={`${YH} (IWF, IWD) and ${FRED} (DGS10); ${CALC}.`}>
        <LineChart
          height={300}
          decimalsLeft={0}
          decimalsRight={1}
          yLabelLeft="IWF/IWD (=100)"
          yLabelRight="10y, %"
          series={[
            { name: "Growth/Value (IWF/IWD)", color: AMBER, axis: "left", data: growthValue.map((d) => ({ date: d.date, value: d.gv })) },
            { name: "10y yield", color: CYAN, axis: "right", data: growthValue.map((d) => ({ date: d.date, value: d.y10 })) },
          ]}
        />
      </Figure>
      <P>
        But the monthly regression tells a more honest story (Fig. 5). Growth-minus-value excess
        return on the monthly Δ10y gives <Em>β = −2.57</Em> — a +100bp month costs growth ~2.6%
        relative to value — with the right sign, but a t-stat of just <Em>−1.4</Em> and R² = 0.03.
        The factor-level duration trade is <em>directionally correct and statistically fragile</em>.
        The rate signal is sharper in sectors than in the growth factor, because the growth basket
        blends genuine bond-proxies with rate-insensitive compounders — exactly the attribution
        error from §03, now visible at the portfolio level.
      </P>
      <Figure n={5} title="Monthly growth-minus-value excess return vs. Δ(10y yield), 2021–2026" source={`${YH} (IWF, IWD) and ${FRED} (DGS10); ${CALC}. n = 60 months.`}>
        <Scatter
          points={gvScatter.points}
          fit={gvScatter.fit}
          xLabel="Δ 10y, pp (monthly)"
          yLabel="growth − value, %"
        />
      </Figure>

      {/* 05 curve */}
      <Section n="05" title="The curve and the banks" />
      <P>
        Financials are the cleanest beneficiaries of the regime: a positive rate-beta <em>and</em> a
        re-steepening curve. The 10y–2y spread, deeply inverted through 2022–23, is back to{" "}
        <Em>+0.74</Em> — restoring the maturity-transformation economics that inversion suppressed.
        Figure 6 plots the curve against financials (XLF); the recovery in bank equity coincides
        with the dis-inversion, not merely the level of rates.
      </P>
      <Figure n={6} title="Yield-curve slope (10y−2y) vs. Financials (XLF, rebased=100)" source={`${FRED} (T10Y2Y) and ${YH} (XLF); ${CALC}.`}>
        <LineChart
          height={300}
          decimalsLeft={2}
          decimalsRight={0}
          yLabelLeft="10y−2y, pp"
          yLabelRight="XLF (=100)"
          series={[
            { name: "10y−2y slope", color: CYAN, axis: "left", data: curve.map((d) => ({ date: d.date, value: d.curve })) },
            { name: "Financials (XLF)", color: AMBER, axis: "right", data: curve.map((d) => ({ date: d.date, value: d.xlf })) },
          ]}
        />
      </Figure>

      {/* Implications */}
      <Section n="06" title="Implications for positioning" />
      <ul className="mb-4 ml-1 space-y-2 font-mono text-[13px] leading-[20px] text-text">
        <li className="flex gap-2"><span className="text-accent">→</span><span>Hedging “rate risk” by underweighting tech is mis-specified. The cleaner rate hedge is the bond-proxy basket (Real Estate, Utilities), where the beta is large and highly significant.</span></li>
        <li className="flex gap-2"><span className="text-accent">→</span><span>For a higher-for-longer / reflation view, Energy and Financials carry <em>positive</em> rate-beta with statistical support — a rare combination of carry and rate-hedge.</span></li>
        <li className="flex gap-2"><span className="text-accent">→</span><span>Treat the growth-value duration trade as a weak prior, not a precise hedge. Express rate views in sectors, where the signal-to-noise is materially higher.</span></li>
      </ul>

      {/* Appendix */}
      <Section n="A" title="Data & method" />
      <div className="space-y-2 font-mono text-[11px] leading-[18px] text-text-dim">
        <p><span className="text-text-faint">Sample.</span> Daily, 2021-01-04 → 2026-01-30 (n = 1,265 trading days). As-of 2026-02-01.</p>
        <p><span className="text-text-faint">Yields.</span> FRED series DGS10 (10y nominal), DFII10 (10y TIPS real), DGS2 (2y), T10Y2Y (10y−2y), no API key required.</p>
        <p><span className="text-text-faint">Equities.</span> Yahoo Finance daily adjusted closes: SPY, the eleven SPDR sector ETFs (XLK/XLC/XLY/XLP/XLE/XLF/XLV/XLI/XLB/XLRE/XLU), and IWF/IWD for growth/value.</p>
        <p><span className="text-text-faint">Estimation.</span> Sector β from OLS of daily simple return on daily Δ(10y) in pp; sensitivity reported per +100bp. Growth−value regression at monthly frequency (n = 60). Correlations are Pearson over 63-day windows. t-statistics are OLS (homoskedastic); treat |t|≥2 as the significance threshold.</p>
        <p><span className="text-text-faint">Reproducibility.</span> All series and statistics are computed by <code className="text-text-dim">scripts/research/equity-duration.mjs</code> and re-pulled from source on each run.</p>
        <p className="pt-1 text-text-faint">This is research, not investment advice. Past statistical relationships do not guarantee future returns.</p>
      </div>
    </article>
  );
}

// Inline math helper (KaTeX inline render).
function TeXInline({ children }: { children: string }) {
  return <TeX>{children}</TeX>;
}
