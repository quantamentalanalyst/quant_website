import { site } from "@/lib/site";
import type { ResearchMeta } from "@/lib/content";
import Figure from "./Figure";
import { TeX, TeXBlock } from "./TeX";
import LineChart from "./charts/LineChart";
import BarH from "./charts/BarH";

import yields from "@/content/research/2026-02-01-equity-duration/data/yields.json";
import rollingCorr from "@/content/research/2026-02-01-equity-duration/data/rolling_corr.json";
import decomp from "@/content/research/2026-02-01-equity-duration/data/sector_decomp.json";
import multifactor from "@/content/research/2026-02-01-equity-duration/data/multifactor.json";
import stability from "@/content/research/2026-02-01-equity-duration/data/stability.json";
import rollingBetas from "@/content/research/2026-02-01-equity-duration/data/rolling_betas.json";
import gvDefs from "@/content/research/2026-02-01-equity-duration/data/gv_defs.json";
import hedge from "@/content/research/2026-02-01-equity-duration/data/hedge.json";

const AMBER = "var(--color-accent)";
const CYAN = "var(--color-data)";
const POS = "var(--color-pos)";
const NEG = "var(--color-neg)";
const LINK = "var(--color-link)";
const FRED = "Federal Reserve Economic Data (FRED) — DGS10, DFII10";
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
const Em = ({ children }: { children: React.ReactNode }) => <span className="text-data">{children}</span>;

// A coefficient + HAC t-stat cell: colored by sign, dimmed if insignificant (|t|<2).
function Stat({ b, t, unit = "%" }: { b: number | null; t: number | null; unit?: string }) {
  if (b == null || t == null) return <span className="text-text-faint">—</span>;
  const sig = Math.abs(t) >= 2;
  const col = b >= 0 ? "text-pos" : "text-neg";
  return (
    <span className="font-tabular whitespace-nowrap">
      <span className={`${col} ${sig ? "" : "opacity-55"}`}>
        {b >= 0 ? "+" : "−"}{Math.abs(b).toFixed(2)}{unit}
      </span>
      <span className={`ml-1 ${sig ? "text-text-dim" : "text-text-faint"}`}>({t.toFixed(1)})</span>
    </span>
  );
}
const Th = ({ children, r }: { children: React.ReactNode; r?: boolean }) => (
  <th className={`px-2 py-1.5 font-medium ${r ? "text-right" : "text-left"}`}>{children}</th>
);

export default function EquityDurationArticle({ meta }: { meta: ResearchMeta }) {
  const rollSectors = ["XLRE", "XLU", "XLP", "XLK", "XLF"] as const;
  const rollColors: Record<string, string> = { XLRE: AMBER, XLU: CYAN, XLP: POS, XLK: NEG, XLF: LINK };
  const xlk = multifactor.find((m) => m.sym === "XLK")!;
  const xlre = multifactor.find((m) => m.sym === "XLRE")!;
  const xlf = multifactor.find((m) => m.sym === "XLF")!;
  const xle = multifactor.find((m) => m.sym === "XLE")!;
  // headline chart: market-controlled real-rate beta, sorted
  const betaRows = [...decomp].sort((a, b) => a.realCtrl - b.realCtrl).map((d) => ({
    label: d.label,
    value: d.realCtrl,
    tag: `t ${d.tRealCtrl > 0 ? "+" : "−"}${Math.abs(d.tRealCtrl).toFixed(1)}`,
    faint: Math.abs(d.tRealCtrl) < 2,
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
        <p className="mt-4 max-w-[72ch] font-mono text-[13px] leading-[22px] text-text-dim">{meta.abstract}</p>
      </header>

      {/* Thesis + definition box */}
      <Section n="00" title="Thesis" />
      <P>
        “Technology is long-duration, so it sells off when rates rise” is the most repeated rule in
        macro-equity strategy. It is also, on careful measurement, mostly wrong. The error has three
        sources, and correcting all three reverses the conclusion: investors regress on{" "}
        <em>nominal</em> yields when the discount-rate variable is the <em>real</em> yield; they run{" "}
        <em>univariate</em> regressions that confound rate sensitivity with equity beta; and they use{" "}
        homoskedastic standard errors that overstate significance on fat-tailed daily returns. After
        decomposing nominal-yield changes into real and breakeven components, controlling for the
        market factor, and computing Newey-West (HAC) standard errors, the real-rate duration of US
        equities is concentrated in <Em>bond-proxy sectors</Em> — and Technology has essentially none.
      </P>
      <div className="my-5 border-l-2 border-accent bg-bg-elev px-4 py-3">
        <div className="section-label mb-1.5 text-accent">definition — equity duration (empirical)</div>
        <p className="font-mono text-[12px] leading-[20px] text-text-dim">
          Throughout, “equity duration” means the <span className="text-text">realized return sensitivity</span> of an
          equity portfolio to a change in Treasury yields — the regression coefficient{" "}
          <TeX>{"\\beta"}</TeX> in <TeX>{"r_{i,t}=\\alpha+\\beta\\,\\Delta y_t+\\varepsilon_{i,t}"}</TeX>. This is the{" "}
          <span className="text-text">empirical</span> notion, related to but distinct from theoretical cash-flow duration
          (the timing of expected cash flows) or valuation duration (the analytic sensitivity of present value to the
          discount rate). I measure the third and interpret it in light of the first two.
        </p>
      </div>

      {/* 01 regime */}
      <Section n="01" title="The regime: nominal, real, breakeven" />
      <P>
        The repricing of this cycle was a <em>real</em>-rate event. The 10-year real yield (TIPS)
        traveled from <Em>{yields[0].real}%</Em> to <Em>{yields[yields.length - 1].real}%</Em> — roughly a 300bp
        rise in the equity discount rate — while breakeven inflation (nominal minus real) round-tripped
        from <Em>{yields[0].be}%</Em> to <Em>{yields[yields.length - 1].be}%</Em> (Fig. 1). Decomposing the nominal
        move matters because the two components hit equities through different channels: real yields
        are the discount-rate shock; breakevens are the growth/inflation impulse. Every regression
        below is run on both.
      </P>
      <Figure n={1} title="10-year yield decomposed: nominal, real (TIPS), breakeven inflation" source={`${FRED}; breakeven = nominal − real. Daily.`}>
        <LineChart
          height={300} decimalsLeft={1} yLabelLeft="%"
          series={[
            { name: "nominal", color: AMBER, data: yields.map((d) => ({ date: d.date, value: d.nominal })) },
            { name: "real (TIPS)", color: CYAN, data: yields.map((d) => ({ date: d.date, value: d.real })) },
            { name: "breakeven", color: POS, data: yields.map((d) => ({ date: d.date, value: d.be })) },
          ]}
        />
      </Figure>

      {/* 02 correlation */}
      <Section n="02" title="The stock–bond correlation is regime-dependent" />
      <P>
        The sign of the equity–rate relationship is itself the macro regime. Figure 2 plots the
        63-day rolling correlation between daily changes in the nominal 10-year and the S&amp;P 500’s
        return: mildly positive in 2021 (rates and stocks rose together on growth), sharply negative
        through 2022 (every yield uptick a valuation shock), and drifting back toward zero since. A
        single pooled correlation is the wrong summary statistic for a relationship this
        state-dependent — and at a 63-day window the estimate carries wide confidence bands, so
        “normalized to zero” should be read as <em>within noise of zero</em>, not precisely zero.
      </P>
      <Figure n={2} title="63-day rolling correlation: Δ(nominal 10y) vs. S&P 500 return" source={`${FRED} and ${YH}; ${CALC}.`}>
        <LineChart
          height={260} decimalsLeft={2} zeroLine yLabelLeft="ρ (63d)"
          series={[{ name: "corr(Δ10y, SPX)", color: AMBER, data: rollingCorr.map((d) => ({ date: d.date, value: d.corr })) }]}
        />
      </Figure>

      {/* 03 decomposition */}
      <Section n="03" title="Decomposing the cross-section of rate beta" />
      <P>
        For each sector I estimate the empirical rate beta four ways — univariate on Δnominal, Δreal,
        and Δbreakeven, and then the cleanest specification, the real-rate beta <em>controlling for
        the market factor</em>:
      </P>
      <TeXBlock eq="1">{"r_{i,t}=\\alpha_i+\\beta_i^{\\,\\text{real}}\\,\\Delta y_t^{\\text{real}}+\\beta_i^{\\,m}\\,r_{\\text{mkt},t}+\\varepsilon_{i,t}"}</TeXBlock>
      <P>
        All <TeX>{"\\beta"}</TeX> are scaled to a <Em>+100bp</Em> move; t-statistics use Newey-West HAC
        standard errors (Bartlett kernel, 5 daily lags) to correct for the heteroskedasticity and
        serial correlation in daily returns. Table 1 is the core result. Three patterns jump out.
      </P>

      <div className="my-6 overflow-x-auto border border-rule">
        <table className="w-full border-collapse font-mono text-[11px]">
          <thead>
            <tr className="border-b border-rule-strong bg-bg-elev text-[9px] uppercase tracking-[0.03em] text-text-faint">
              <Th>Sector</Th><Th r>β nominal (t)</Th><Th r>β real (t)</Th><Th r>β breakeven (t)</Th>
              <Th r>β real | mkt (t)</Th><Th r>mkt β</Th><Th r>R²</Th>
            </tr>
          </thead>
          <tbody>
            {decomp.map((d) => (
              <tr key={d.sym} className="border-b border-rule">
                <td className="px-2 py-1 text-text">{d.sym} <span className="text-text-faint">{d.label}</span></td>
                <td className="px-2 py-1 text-right"><Stat b={d.nom} t={d.tNom} /></td>
                <td className="px-2 py-1 text-right"><Stat b={d.real} t={d.tReal} /></td>
                <td className="px-2 py-1 text-right"><Stat b={d.be} t={d.tBE} /></td>
                <td className="px-2 py-1 text-right"><Stat b={d.realCtrl} t={d.tRealCtrl} /></td>
                <td className="px-2 py-1 text-right font-tabular text-text-dim">{d.mktBeta.toFixed(2)}</td>
                <td className="px-2 py-1 text-right font-tabular text-text-faint">{d.r2.toFixed(3)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="mb-4 text-[10px] text-text-faint">
        Table 1. Sector rate-beta decomposition, daily 2021-01 → 2026-01 (n≈1,265; XLRE/XLC shorter histories).
        Coefficients are % return per +100bp; Newey-West HAC t in parentheses (faded = |t|&lt;2). Source: {FRED}, {YH}; {CALC}.
      </p>
      <P>
        <span className="text-text">First</span>, the <em>real</em>-yield ladder is far cleaner than the
        nominal one. On nominal yields, Energy (<Em>+3.6%</Em>) and Financials (<Em>+1.1%</Em>) carry
        positive betas — the apparent “sectors that benefit from rates.” On <em>real</em> yields,{" "}
        <em>every</em> sector loads negatively, including Energy (−1.6%) and Financials (−1.6%). The
        positive nominal betas were never a real-rate benefit. <span className="text-text">Second</span>,
        the inflation channel explains the flip: Energy’s breakeven beta is <Em>+18.0% (t=10.1)</Em> and
        Financials’ <Em>+8.8% (t=5.5)</Em> — these are reflation trades, co-moving with breakevens, not
        discount-rate plays. <span className="text-text">Third</span>, and most important, controlling
        for the market collapses the middle of the table. Once <TeX>{"r_{\\text{mkt}}"}</TeX> is
        included, Technology’s real-rate beta is <Em>+0.7% (t=1.8)</Em> — economically nil and the wrong
        sign — while Real Estate (<Em>−5.1%, t=−8.1</Em>) and Utilities (<Em>−4.2%, t=−7.6</Em>) retain
        large, highly significant duration. The duration ladder is real; it just lives in the bond
        proxies.
      </P>
      <Figure n={3} title="Market-controlled real-rate beta by sector (% per +100bp, HAC)" source={`${FRED} and ${YH}; ${CALC}. β from r = α + β·Δy_real + β_m·r_mkt + ε. Faded: |t|<2.`}>
        <BarH rows={betaRows} unit="%" decimals={2} labelWidth={92} tagWidth={48} />
      </Figure>

      {/* 04 is tech long duration */}
      <Section n="04" title="Is Technology really long-duration?" />
      <P>
        Take the question head-on with a full five-factor model — real yield, breakeven, market, ΔVIX,
        and oil — for the cleanest contrast in the universe, Technology vs. Real Estate (Table 2). The
        result is stark. For Technology, the market factor has a beta of <Em>{xlk.mkt} (t={xlk.tMkt})</Em>{" "}
        and the regression R² is <Em>{xlk.r2.toFixed(2)}</Em>: market risk explains{" "}
        {Math.round(xlk.r2 * 100)}% of XLK’s daily variance, and its conditional real-rate beta is{" "}
        <Em>{xlk.real >= 0 ? "+" : ""}{xlk.real}% (t={xlk.tReal})</Em> — positive and insignificant. Real
        Estate, by contrast, keeps a real-rate beta of <Em>{xlre.real}% (t={xlre.tReal})</Em> even with
        all five controls. Technology’s reputation as the market’s premier “long-duration” asset is, in
        the data, a reputation for high equity beta. When rates rise in a risk-off move, Tech falls
        because it is high-beta, not because it is long-duration; the bond proxies fall because they
        are genuinely rate-sensitive.
      </P>
      <div className="my-6 overflow-x-auto border border-rule">
        <table className="w-full border-collapse font-mono text-[11px]">
          <thead>
            <tr className="border-b border-rule-strong bg-bg-elev text-[9px] uppercase tracking-[0.03em] text-text-faint">
              <Th>Sector</Th><Th r>β real (t)</Th><Th r>β breakeven (t)</Th><Th r>β market (t)</Th><Th r>β ΔVIX (t)</Th><Th r>β oil (t)</Th><Th r>R²</Th>
            </tr>
          </thead>
          <tbody>
            {[xlre, xlk, xlf, xle].map((m) => (
              <tr key={m.sym} className="border-b border-rule">
                <td className="px-2 py-1 text-text">{m.sym}</td>
                <td className="px-2 py-1 text-right"><Stat b={m.real} t={m.tReal} /></td>
                <td className="px-2 py-1 text-right"><Stat b={m.be} t={m.tBE} /></td>
                <td className="px-2 py-1 text-right font-tabular text-text-dim">{m.mkt.toFixed(2)} <span className="text-text-faint">({m.tMkt.toFixed(0)})</span></td>
                <td className="px-2 py-1 text-right"><Stat b={m.vix} t={m.tVix} unit="" /></td>
                <td className="px-2 py-1 text-right"><Stat b={m.oil} t={m.tOil} unit="" /></td>
                <td className="px-2 py-1 text-right font-tabular text-text-faint">{m.r2.toFixed(2)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="mb-4 text-[10px] text-text-faint">
        Table 2. Five-factor model, daily 2021–2026, HAC t. β real/breakeven in % per +100bp; market β unitless; ΔVIX/oil per unit/return. Source: {FRED}, {YH}; {CALC}.
      </p>

      {/* 05 growth value */}
      <Section n="05" title="Growth/value: a noisy duration proxy" />
      <P>
        If duration were a <em>style</em>-level phenomenon, growth-minus-value should load on real
        rates. It does not — robustly, across definitions, once measured correctly. The popular figure
        is the monthly IWF/IWD beta of <Em>{gvDefs.monthlyIWF?.nom}</Em> per +100bp, but it is
        insignificant (t={gvDefs.monthlyIWF?.tNom}, n={gvDefs.monthlyIWF?.n}) and, more to the point,
        run at the wrong frequency — 60 monthly observations against 1,265 daily for the sectors. At
        daily frequency the growth-value real-rate beta is small and insignificant across all three
        definitions (Table 3), and after controlling for the market it flips positive. The earlier
        “growth is long-duration” signal was largely a frequency artifact compounded by basket
        composition: IWF blends genuine bond-proxy-free mega-cap quality with AI exposure, IWD blends
        Financials and Energy. Growth/value is not a clean duration factor.
      </P>
      <div className="my-6 overflow-x-auto border border-rule">
        <table className="w-full border-collapse font-mono text-[11px]">
          <thead>
            <tr className="border-b border-rule-strong bg-bg-elev text-[9px] uppercase tracking-[0.03em] text-text-faint">
              <Th>Growth − Value definition</Th><Th r>β nominal (t)</Th><Th r>β real (t)</Th><Th r>β real | mkt (t)</Th><Th r>freq</Th>
            </tr>
          </thead>
          <tbody>
            {gvDefs.daily.map((g) => (
              <tr key={g.label} className="border-b border-rule">
                <td className="px-2 py-1 text-text">{g.label}</td>
                <td className="px-2 py-1 text-right"><Stat b={g.nom} t={g.tNom} /></td>
                <td className="px-2 py-1 text-right"><Stat b={g.real} t={g.tReal} /></td>
                <td className="px-2 py-1 text-right"><Stat b={g.realCtrl} t={g.tRealCtrl} /></td>
                <td className="px-2 py-1 text-right font-tabular text-text-faint">daily</td>
              </tr>
            ))}
            <tr className="border-b border-rule">
              <td className="px-2 py-1 text-text-dim">Russell 1000 G/V <span className="text-text-faint">(monthly)</span></td>
              <td className="px-2 py-1 text-right"><Stat b={gvDefs.monthlyIWF?.nom ?? null} t={gvDefs.monthlyIWF?.tNom ?? null} /></td>
              <td className="px-2 py-1 text-right text-text-faint">—</td>
              <td className="px-2 py-1 text-right text-text-faint">—</td>
              <td className="px-2 py-1 text-right font-tabular text-text-faint">monthly</td>
            </tr>
          </tbody>
        </table>
      </div>
      <p className="mb-4 text-[10px] text-text-faint">Table 3. Growth-minus-value real-rate beta across definitions and frequencies, 2021–2026, HAC t. Source: {YH}, {FRED}; {CALC}.</p>

      {/* 06 robustness */}
      <Section n="06" title="Robustness: is the ladder structural?" />
      <P>
        A five-year window is one regime. To separate structure from artifact, Figure 4 plots the
        rolling 252-day market-controlled real-rate beta for the key sectors back to 2011, and Table 4
        splits the estimate into pre-inflation (2010–20), tightening (2021–22), and plateau (2023–26)
        sub-samples. Bond-proxy duration is <em>structural</em>: Utilities and Real Estate carry large
        negative real-rate betas in every sub-period and every rolling window. Technology’s is not — it
        is near zero pre-2020, briefly negative in the 2022 selloff, and <em>positive</em> in 2023–26.
        What looks like “Tech duration” is a transient of the 2022 regime, not a stable factor loading.
      </P>
      <Figure n={4} title="Rolling 252-day real-rate beta (market-controlled), 2011–2026" source={`${FRED} and ${YH}; ${CALC}. Re-estimated every 5 trading days.`}>
        <LineChart
          height={300} decimalsLeft={0} zeroLine yLabelLeft="β real|mkt, % per 100bp"
          series={rollSectors.map((s) => ({
            name: s, color: rollColors[s],
            data: rollingBetas.filter((r) => (r as unknown as Record<string, number | null>)[s] != null).map((r) => ({ date: r.date, value: (r as unknown as Record<string, number>)[s] })),
          }))}
        />
      </Figure>
      <div className="my-6 overflow-x-auto border border-rule">
        <table className="w-full border-collapse font-mono text-[11px]">
          <thead>
            <tr className="border-b border-rule-strong bg-bg-elev text-[9px] uppercase tracking-[0.03em] text-text-faint">
              <Th>Sector</Th><Th r>2010–20</Th><Th r>2021–22</Th><Th r>2023–26</Th><Th>read</Th>
            </tr>
          </thead>
          <tbody>
            {stability.filter((s) => ["XLU", "XLRE", "XLP", "XLK", "XLF", "XLE"].includes(s.sym)).map((s) => {
              const vals = [s["2010-20"], s["2021-22"], s["2023-26"]].filter((v): v is number => v != null);
              const allNeg = vals.every((v) => v < -1);
              return (
                <tr key={s.sym} className="border-b border-rule">
                  <td className="px-2 py-1 text-text">{s.sym} <span className="text-text-faint">{s.label}</span></td>
                  {(["2010-20", "2021-22", "2023-26"] as const).map((p) => (
                    <td key={p} className="px-2 py-1 text-right font-tabular">
                      {s[p] == null ? <span className="text-text-faint">—</span> : <span className={s[p]! < 0 ? "text-neg" : "text-pos"}>{s[p]! >= 0 ? "+" : "−"}{Math.abs(s[p]!).toFixed(1)}%</span>}
                    </td>
                  ))}
                  <td className="px-2 py-1 text-[10px] text-text-dim">{allNeg ? "structural duration" : "regime-dependent"}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <p className="mb-4 text-[10px] text-text-faint">Table 4. Market-controlled real-rate beta by sub-period (% per +100bp). Source: {FRED}, {YH}; {CALC}.</p>
      <P>
        Two honest caveats. The R²s in Table 1 are small — rates explain under 9% of even Real
        Estate’s daily return variance — so “rates as the master factor” overstates the share of
        variance rates command; the accurate claim is about <em>cross-sectional ranking</em>, not
        explanatory power. And these are <em>tradeable-proxy</em> betas (SPDR ETFs, with expense ratios
        and reconstitution), not pure-factor betas; the ranking is what survives, not the second
        decimal.
      </P>

      {/* 07 positioning */}
      <Section n="07" title="Portfolio implications" />
      <P>
        The positioning follows, with appropriate humility about borderline t-stats. To make it
        concrete, Table 5 reports the mean return of three candidate rate hedges on the
        <Em> top-decile</Em> nominal-yield-up days of the sample (mean move +{hedge.hedge[0].avgDyTop}bp).
        Shorting Technology — the consensus rate hedge — returns just <Em>+{hedge.hedge[0].topDecile}%</Em> on
        those days, because Tech’s move is mostly market beta that a rate shock only partially drives.
        Shorting the bond proxies returns <Em>+{hedge.hedge[1].topDecile}%</Em>, and the
        reflation-vs-bond-proxy spread <Em>+{hedge.hedge[2].topDecile}%</Em> — a materially cleaner
        hedge per unit of rate move.
      </P>
      <div className="my-6 overflow-x-auto border border-rule">
        <table className="w-full border-collapse font-mono text-[11px]">
          <thead>
            <tr className="border-b border-rule-strong bg-bg-elev text-[9px] uppercase tracking-[0.03em] text-text-faint">
              <Th>Hedge leg</Th><Th r>mean return, top-decile yield-up days</Th>
            </tr>
          </thead>
          <tbody>
            {hedge.hedge.map((h) => (
              <tr key={h.name} className="border-b border-rule">
                <td className="px-2 py-1 text-text">{h.name}</td>
                <td className="px-2 py-1 text-right"><span className={`font-tabular ${h.topDecile >= 0 ? "text-pos" : "text-neg"}`}>{h.topDecile >= 0 ? "+" : "−"}{Math.abs(h.topDecile).toFixed(2)}%</span></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="mb-4 text-[10px] text-text-faint">Table 5. Mean hedge return on the {hedge.nTop} worst rate-up days of {hedge.nAll} in 2021–2026. Source: {YH}, {FRED}; {CALC}.</p>
      <ul className="mb-4 ml-1 space-y-2 font-mono text-[13px] leading-[20px] text-text">
        <li className="flex gap-2"><span className="text-accent">→</span><span>Hedging rate risk by underweighting Technology is mis-specified — most of that exposure is equity beta, and it is a weak, regime-unstable rate hedge. The cleaner hedge is the bond-proxy basket (Real Estate, Utilities), where the real-rate beta is large, significant, and structural.</span></li>
        <li className="flex gap-2"><span className="text-accent">→</span><span>But a short-Utilities/REITs position is not a <em>pure</em> rate hedge — it is also a quality/defensive underweight that will hurt in risk-off rallies when Treasuries and bond proxies both rally. Size it as a rate tilt, not a costless hedge.</span></li>
        <li className="flex gap-2"><span className="text-accent">→</span><span>Treat the growth-value duration trade as no signal, not a weak one: it is insignificant at daily frequency across every definition tested.</span></li>
      </ul>

      {/* 08 conclusion */}
      <Section n="08" title="Conclusion" />
      <P>
        After decomposing nominal yields into real and breakeven components, controlling for equity
        beta, and using HAC standard errors, the result is sharper than the consensus framing and
        opposite to it in one important place. Real-rate duration is concentrated in bond-proxy
        sectors — Real Estate and Utilities — where it is large, highly significant, and stable across
        regimes. Technology, the textbook long-duration asset, shows essentially no real-rate duration
        once equity beta is removed; its rate “sensitivity” is market beta. And the sectors that look
        like rate beneficiaries on nominal yields — Energy, Financials — are reflation trades loading
        on breakeven inflation, not real rates. Rate risk lives where the cash flows are genuinely
        bond-like, not where the market beta is highest.
      </P>

      {/* appendix */}
      <Section n="A" title="Data & method" />
      <div className="space-y-2 font-mono text-[11px] leading-[18px] text-text-dim">
        <p><span className="text-text-faint">Sample.</span> Daily, 2010-01 → 2026-01 (focus regressions 2021–2026; rolling/sub-period use the full span). As-of 2026-02-01. n≈1,265 in the focus window; XLRE (from 2015) and XLC (from 2018) have shorter histories.</p>
        <p><span className="text-text-faint">Variables.</span> Δreal = daily change in DFII10 (10y TIPS); Δnominal = DGS10; Δbreakeven = Δnominal − Δreal. Market = SPY daily return. ΔVIX = change in VIXCLS; oil = CL=F return. Equities: SPY, eleven SPDR sector ETFs, IWF/IWD, SPYG/SPYV, QQQ/RSP.</p>
        <p><span className="text-text-faint">Estimation.</span> OLS with Newey-West HAC standard errors (Bartlett kernel, 5 daily lags). Betas scaled to a +100bp move (Δy in percentage points). The market-controlled beta is the rate coefficient from r = α + β·Δy + β_m·r_mkt + ε. FRED series fetched in 3-year chunks to avoid gateway timeouts.</p>
        <p><span className="text-text-faint">Caveats.</span> Tradeable-proxy (ETF) betas, not pure-factor betas. Contemporaneous co-movement, not identified causality — language is hedged accordingly. R²s confirm rates explain a small share of daily variance; the result is about cross-sectional ranking. Reproducible via <code className="text-text-dim">analysis/equity_duration.py</code>.</p>
        <p className="pt-1 text-text-faint">This is research, not investment advice.</p>
      </div>
    </article>
  );
}
