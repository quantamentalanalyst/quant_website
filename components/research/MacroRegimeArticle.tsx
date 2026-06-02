import Link from "next/link";
import { site } from "@/lib/site";
import type { ResearchMeta } from "@/lib/content";
import Figure from "./Figure";
import { TeX, TeXBlock } from "./TeX";
import { Num } from "@/components/ui/Num";
import LineChart from "./charts/LineChart";
import BarH from "./charts/BarH";

import dashboard from "@/content/research/2026-04-15-macro-regime/data/dashboard.json";
import inflation from "@/content/research/2026-04-15-macro-regime/data/inflation.json";
import labor from "@/content/research/2026-04-15-macro-regime/data/labor.json";
import growth from "@/content/research/2026-04-15-macro-regime/data/growth.json";
import leadlag from "@/content/research/2026-04-15-macro-regime/data/leadlag.json";
import regime from "@/content/research/2026-04-15-macro-regime/data/regime.json";
import summary from "@/content/research/2026-04-15-macro-regime/data/summary.json";

const AMBER = "var(--color-accent)";
const CYAN = "var(--color-data)";
const POS = "var(--color-pos)";
const FRED = "Federal Reserve Economic Data (FRED), St. Louis Fed";
const YH = "Yahoo Finance (SPY)";
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

export default function MacroRegimeArticle({ meta }: { meta: ResearchMeta }) {
  const cur = summary.current as { name: string; key: string } | null;
  const stag = regime.find((r) => r.key === "G↓ I↑")!;
  const leadRows = leadlag.map((l) => ({ label: l.label, value: l.corr, tag: `n${l.n}` }));
  const regimeRows = regime.map((r) => ({ label: `${r.name}`, value: r.avgFwd3, tag: `${r.hit}% · n${r.n}` }));

  return (
    <article className="mx-auto max-w-[860px] pb-16">
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
        <p className="mt-4 max-w-[68ch] font-mono text-[13px] leading-[22px] text-text-dim">{meta.abstract}</p>
      </header>

      <Section n="00" title="Thesis" />
      <P>
        An equity investor is handed a firehose of macro: payrolls, CPI, core PCE, jobless claims,
        retail sales, ISM, sentiment — each release moving the tape for an afternoon. The trouble is
        that these series are highly collinear and overwhelmingly <em>coincident-to-lagging</em>, and
        — as shown below — each one’s correlation with the <em>forward</em> three-month equity return
        is essentially zero. The macro edge is not in the prints. It is in the <em>regime</em>: the
        joint state of growth and inflation. Conditioning equity returns on the growth×inflation
        quadrant, rather than on any single indicator, is where the signal lives. Four findings,
        2000–2026 monthly:
      </P>
      <ul className="mb-4 ml-1 space-y-1.5 font-mono text-[13px] leading-[20px] text-text">
        {[
          "No single indicator's level meaningfully predicts forward 3-month returns — the largest absolute correlation in the panel is 0.18 (initial claims), and even that has the 'wrong' sign (bad news → good forward returns, the Fed reaction function).",
          "Regime does predict. Stagflation (growth↓, inflation↑) is the only quadrant with a negative average forward return (−0.7%, hit rate 49%); the other three quadrants average +2.0% to +3.2%.",
          `The current regime is ${cur?.name ?? "—"} (growth accelerating, inflation rising) — historically the strongest quadrant (+${regime[0].avgFwd3}% forward, ${regime[0].hit}% hit).`,
          "But watch the soft data: Michigan sentiment sits 1.8σ below its decade mean while every hard indicator is solid — the widest hard/soft divergence outside a recession.",
        ].map((t, i) => (
          <li key={i} className="flex gap-2"><span className="text-accent">{String(i + 1).padStart(2, "0")}</span><span>{t}</span></li>
        ))}
      </ul>

      <Section n="01" title="Where we are: the dashboard" />
      <P>
        Table 1 is the current macro state — latest reading, the value a year ago, and a 10-year
        z-score for context. The economy reads <Em>late-cycle but not recessionary</Em>: unemployment
        low at 4.3%, claims subdued, the manufacturing pulse swinging from contraction to expansion,
        the Sahm rule dormant at 0.13 (a recession trigger is 0.50), and the Fed easing (funds 3.6%,
        down ~70bp y/y) into a re-steepened curve. The discordant note is consumer sentiment, at a{" "}
        <Em>−1.8σ</Em> extreme that the hard data flatly contradicts.
      </P>

      <div className="my-6 overflow-x-auto border border-rule">
        <table className="w-full border-collapse font-mono text-[12px]">
          <thead>
            <tr className="border-b border-rule-strong bg-bg-elev text-[10px] uppercase tracking-[0.04em] text-text-faint">
              <th className="px-2 py-1.5 text-left font-medium">Indicator</th>
              <th className="px-2 py-1.5 text-right font-medium">Latest</th>
              <th className="px-2 py-1.5 text-right font-medium">1y ago</th>
              <th className="px-2 py-1.5 text-right font-medium">z (10y)</th>
            </tr>
          </thead>
          <tbody>
            {dashboard.map((d) => (
              <tr key={d.label} className="border-b border-rule">
                <td className="px-2 py-1 text-text">{d.label} <span className="text-text-faint">{d.unit}</span></td>
                <td className="px-2 py-1 text-right text-text"><Num value={d.last} decimals={d.unit === "k" || d.unit === "idx" ? 0 : 2} /></td>
                <td className="px-2 py-1 text-right text-text-dim"><Num value={d.prior} decimals={d.unit === "k" || d.unit === "idx" ? 0 : 2} /></td>
                <td className={`px-2 py-1 text-right ${Math.abs(d.z) >= 1 ? "text-text" : "text-text-dim"}`}>
                  <span className={d.z >= 0 ? "text-pos" : "text-neg"}><Num value={d.z} decimals={2} signed /></span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="mb-4 text-[10px] text-text-faint">Table 1. Macro dashboard, as of {summary.asOf}. z = standardized vs trailing 10 years. Source: {FRED}; {CALC}.</p>

      <Section n="02" title="Inflation: the disinflation stalled" />
      <P>
        The headline disinflation of 2023–24 has flattened and, on the core measures, begun to creep
        back. Core PCE — the Fed’s preferred gauge — has lifted from <Em>2.6%</Em> a year ago to{" "}
        <Em>3.3%</Em>, and headline CPI from 2.3% to 3.8% (Fig. 1). This is the variable that
        determines whether the favorable regime persists or tips toward stagflation.
      </P>
      <Figure n={1} title="Inflation: CPI, core CPI, PCE, core PCE (% YoY)" source={`${FRED} — CPIAUCSL, CPILFESL, PCEPI, PCEPILFE.`}>
        <LineChart
          height={300} decimalsLeft={1} yLabelLeft="% YoY"
          series={[
            { name: "CPI", color: AMBER, data: inflation.map((d) => ({ date: d.date, value: d.cpi! })) },
            { name: "core CPI", color: CYAN, data: inflation.map((d) => ({ date: d.date, value: d.core! })) },
            { name: "core PCE", color: POS, data: inflation.map((d) => ({ date: d.date, value: d.corePce! })) },
          ]}
        />
      </Figure>

      <Section n="03" title="Labor: cooling, not breaking" />
      <P>
        The labor market has loosened from its 2022 extreme without cracking. Unemployment has drifted
        up to 4.3% but initial claims — the highest-frequency, least-revised labor signal — remain low
        at <Em>208k</Em> (Fig. 2). The Sahm rule, which has called every modern recession, sits at
        0.13, far from its 0.50 trigger. This is a soft landing in the hard data.
      </P>
      <Figure n={2} title="Labor market: unemployment rate vs. initial jobless claims" source={`${FRED} — UNRATE, ICSA. Claims resampled to month-end, thousands.`}>
        <LineChart
          height={280} decimalsLeft={1} decimalsRight={0}
          yLabelLeft="unemployment %" yLabelRight="claims, k"
          series={[
            { name: "unemployment", color: AMBER, axis: "left", data: labor.map((d) => ({ date: d.date, value: d.unrate! })) },
            { name: "initial claims (k)", color: CYAN, axis: "right", data: labor.filter((d) => d.claims != null).map((d) => ({ date: d.date, value: d.claims! })) },
          ]}
        />
      </Figure>

      <Section n="04" title="Growth: the manufacturing pulse turned" />
      <P>
        Since ISM’s PMI is no longer freely redistributable, I proxy the factory pulse with the Philly
        Fed manufacturing diffusion index — same construction, same signal. It has swung from{" "}
        <Em>−12.9</Em> a year ago to <Em>+26.7</Em>, with industrial production YoY turning back
        positive (Fig. 3). The goods cycle, in recession-like contraction through 2024, is expanding
        again — the growth half of the regime call.
      </P>
      <Figure n={3} title="Growth pulse: industrial production (YoY) vs. Philly Fed manufacturing index" source={`${FRED} — INDPRO, GACDFSA066MSFRBPHI (ISM-PMI proxy).`}>
        <LineChart
          height={280} decimalsLeft={1} decimalsRight={0}
          yLabelLeft="IP % YoY" yLabelRight="Philly idx"
          series={[
            { name: "industrial prod. YoY", color: AMBER, axis: "left", data: growth.map((d) => ({ date: d.date, value: d.indpro! })) },
            { name: "Philly Fed (PMI proxy)", color: CYAN, axis: "right", data: growth.filter((d) => d.philly != null).map((d) => ({ date: d.date, value: d.philly! })) },
          ]}
        />
      </Figure>

      <Section n="05" title="Do any of these predict returns? Barely." />
      <P>
        Here is the uncomfortable result. Figure 4 shows the contemporaneous correlation between each
        indicator and the <em>forward</em> three-month S&amp;P 500 return, 2000–2026. Every bar is
        small: the largest magnitude is <Em>0.18</Em>. And the signs are perverse — the only positive
        “leaders” are initial claims, unemployment, and the VIX. That is not macro momentum; it is the{" "}
        <em>reaction function</em>: weak data and fear pull forward policy easing and risk premium,
        which lift subsequent returns. The growth and inflation indicators investors obsess over —
        retail sales, industrial production, core CPI — cluster near zero. Trading the prints is noise.
      </P>
      <Figure n={4} title="Lead-lag: correlation of each indicator with the forward 3-month S&P 500 return" source={`${FRED} and ${YH}; ${CALC}. Monthly, 2000–2026.`}>
        <BarH rows={leadRows} unit="" decimals={2} labelWidth={172} tagWidth={44} />
      </Figure>

      <Section n="06" title="Regime is the signal" />
      <P>
        Now condition on regime instead. I build a growth composite from the standardized YoY of
        industrial production, payrolls, and retail sales, and classify each month by whether growth
        is accelerating and whether core inflation is rising:
      </P>
      <TeXBlock eq="1">{"g_t=\\tfrac{1}{3}\\!\\sum_i z(\\text{YoY}_{i,t}),\\quad \\text{regime}=\\big(\\operatorname{sign}(g_t-g_{t-3}),\\ \\operatorname{sign}(\\pi^{\\text{core}}_t-\\pi^{\\text{core}}_{t-3})\\big)"}</TeXBlock>
      <P>
        The four quadrants sort forward equity returns cleanly (Fig. 5). <Em>Stagflation</Em> —
        growth decelerating into rising inflation — is the only quadrant that loses money on average
        (<Em>{stag.avgFwd3}%</Em>, a {stag.hit}% hit rate, barely a coin flip). The other three all
        pay: reflation and slowdown both beat goldilocks, because what equities reward is the{" "}
        <em>change</em> in conditions plus the policy response, not the level. The single most
        important macro question for an equity book is therefore not “what was CPI” but “are we
        drifting toward the stagflation corner.”
      </P>
      <Figure n={5} title="Average forward 3-month S&P 500 return by growth×inflation regime (2000–2026)" source={`${FRED} and ${YH}; ${CALC}. Bar = mean forward 3m return; right label = hit rate · n months.`}>
        <BarH rows={regimeRows} unit="%" decimals={1} labelWidth={96} tagWidth={84} />
      </Figure>
      <P>
        Today the model places us in <Em>{cur?.name}</Em> — growth accelerating (Fig. 3) and core
        inflation rising (Fig. 1). Historically the most rewarding quadrant. The risk is not the
        current state but the transition: a further inflation re-acceleration that stalls growth would
        rotate the book into the one quadrant that does not pay.
      </P>

      <Section n="07" title="Implications" />
      <ul className="mb-4 ml-1 space-y-2 font-mono text-[13px] leading-[20px] text-text">
        <li className="flex gap-2"><span className="text-accent">→</span><span>Stop trading the prints. A single CPI or payrolls number carries almost no information about forward returns; the reaction-function signs mean you would often want to fade, not chase.</span></li>
        <li className="flex gap-2"><span className="text-accent">→</span><span>Track the regime, not the level. Position for the growth×inflation quadrant and its transitions; the only quadrant to truly de-risk into is stagflation.</span></li>
        <li className="flex gap-2"><span className="text-accent">→</span><span>Inflation is the swing variable. With core PCE re-accelerating, the favorable reflation regime is one bad inflation quarter from rotating toward stagflation — which is also where the <Link href="/research/2026-02-01-equity-duration" className="text-data no-underline hover:opacity-80">rate-sensitive sectors</Link> hurt most.</span></li>
      </ul>

      <Section n="A" title="Data & method" />
      <div className="space-y-2 font-mono text-[11px] leading-[18px] text-text-dim">
        <p><span className="text-text-faint">Source.</span> FRED (no key): PAYEMS, UNRATE, ICSA, CPIAUCSL, CPILFESL, PCEPI, PCEPILFE, RSAFS, INDPRO, FEDFUNDS, T10Y3M, NFCI, UMCSENT, VIXCLS, SAHMCURRENT, and the Philly Fed manufacturing index (ISM-PMI proxy). Equities: Yahoo Finance SPY (monthly).</p>
        <p><span className="text-text-faint">Sample.</span> Monthly, {summary.sample}. Daily/weekly series resampled to month-end; prices to monthly close.</p>
        <p><span className="text-text-faint">Lead-lag.</span> Pearson correlation of each indicator (level, or YoY/MoM where a rate of change is the relevant signal) with the subsequent three-month SPY return.</p>
        <p><span className="text-text-faint">Regime.</span> Growth composite = equal-weight mean of standardized (full-sample) YoY of INDPRO, PAYEMS, RSAFS; direction by 3-month change. Inflation direction by 3-month change in core-CPI YoY. Standardization is in-sample and descriptive, not a tradeable out-of-sample signal.</p>
        <p><span className="text-text-faint">Caveat.</span> ISM PMI is excluded (not freely redistributable); the Philly Fed survey is a close proxy but not identical. Reproducible via <code className="text-text-dim">scripts/research/macro-regime.mjs</code>.</p>
        <p className="pt-1 text-text-faint">This is research, not investment advice.</p>
      </div>
    </article>
  );
}
