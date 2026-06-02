import Link from "next/link";
import { site } from "@/lib/site";
import type { ResearchMeta } from "@/lib/content";
import Figure from "./Figure";
import { TeX, TeXBlock } from "./TeX";
import { Num } from "@/components/ui/Num";
import LineChart from "./charts/LineChart";
import BarH from "./charts/BarH";
import Bubble from "./charts/Bubble";

import companies from "@/content/research/2026-04-15-profit-dupont/data/companies.json";
import sectors from "@/content/research/2026-04-15-profit-dupont/data/sectors.json";
import marginTrend from "@/content/research/2026-04-15-profit-dupont/data/margin_trend.json";

const AMBER = "var(--color-accent)";
const CYAN = "var(--color-data)";
const SEC = "SEC EDGAR company-facts (10-K / XBRL filings)";
const CALC = "author's calculations";

type Co = (typeof companies)[number];
function road(c: Co): "margin" | "turnover" | "leverage" {
  if (c.leverage >= 3.5) return "leverage";
  if (c.assetTurn >= 1.3) return "turnover";
  return "margin";
}

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

export default function ProfitDuPontArticle({ meta }: { meta: ResearchMeta }) {
  const byRoe = [...companies].sort((a, b) => b.roe - a.roe);

  const roeRows = byRoe.map((c) => ({
    label: c.ticker,
    value: c.roe,
    tag: `${c.leverage.toFixed(1)}×`,
  }));
  const bubblePts = companies.map((c) => ({ x: c.netMargin, y: c.assetTurn, size: c.leverage, label: c.ticker }));
  const sectorRows = [...sectors].sort((a, b) => b.netMargin - a.netMargin).map((s) => ({ label: s.sector, value: s.netMargin }));

  const t0 = marginTrend[0], t1 = marginTrend[marginTrend.length - 1];

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
        Return on equity is the headline summary of corporate profitability — but a single ROE
        number says nothing about <em>how</em> it was earned. Two firms can post an identical 25%
        ROE while running completely different businesses: one on fat margins, one on rapid asset
        turnover, one on a leveraged balance sheet. The 1920s DuPont identity makes the distinction
        precise, and it matters, because the three sources of ROE have very different durability.
        Across {companies.length} mega-caps — every figure pulled from the latest 10-K filing — I
        find that the highest ROEs in the market are <em>not</em> the highest-margin businesses.
        They are the most leveraged.
      </P>
      <ul className="mb-4 ml-1 space-y-1.5 font-mono text-[13px] leading-[20px] text-text">
        {[
          "Apple (ROE 152%) and Home Depot (110%) top the table — on a 27% and a 9% net margin. Their ROE is manufactured by leverage: buybacks have shrunk book equity to 4.9× and 8.2× assets.",
          "NVIDIA (76%) is the only top-tier name whose ROE is margin-sourced (56% net margin) with almost no leverage (1.3×) — the highest-quality ROE in the set.",
          "Costco and Walmart earn 28% and 22% ROE on ~3% net margins, entirely through asset turnover (3.6× and 2.5×) — the retail road.",
          "Aggregate net margin across the basket expanded from 9.0% (2017) to 16.1% (2025) — a ~700bp secular tailwind behind a decade of equity returns.",
        ].map((t, i) => (
          <li key={i} className="flex gap-2"><span className="text-accent">{String(i + 1).padStart(2, "0")}</span><span>{t}</span></li>
        ))}
      </ul>

      <Section n="01" title="The identity" />
      <P>
        ROE decomposes, by construction, into three multiplicative terms — net profit margin, asset
        turnover, and the equity multiplier (leverage):
      </P>
      <TeXBlock eq="1">{"\\mathrm{ROE}=\\underbrace{\\frac{\\text{NI}}{\\text{Rev}}}_{\\text{margin}}\\times\\underbrace{\\frac{\\text{Rev}}{\\text{Assets}}}_{\\text{turnover}}\\times\\underbrace{\\frac{\\text{Assets}}{\\text{Equity}}}_{\\text{leverage}}"}</TeXBlock>
      <P>
        Each term is an economic story. <Em>Margin</Em> is pricing power and operating efficiency.{" "}
        <Em>Turnover</Em> is capital intensity — how much revenue each dollar of assets generates.{" "}
        <Em>Leverage</Em> is a capital-structure choice. The product is identical to{" "}
        <TeX>{"\\text{NI}/\\text{Equity}"}</TeX>, but the decomposition reveals what a headline ROE
        conceals. All inputs are the latest fiscal-year values from SEC filings (see appendix);
        banks and regulated utilities are excluded because asset turnover is not economically
        comparable for balance-sheet or rate-base businesses.
      </P>

      <Section n="02" title="The ROE ranking" />
      <P>
        Figure 1 ranks the universe by ROE, annotated with each firm’s equity multiplier. The story
        is in that annotation: the top of the table is dominated by high-leverage names. Apple
        (<Em>152%</Em>, 4.9×) and Home Depot (<Em>110%</Em>, 8.2×) lead not because they
        out-earn — Home Depot’s 8.6% net margin is middling — but because aggressive buybacks have
        collapsed their book equity. ROE rises mechanically as the denominator shrinks.
      </P>
      <Figure n={1} title="Return on equity by company, latest fiscal year (annotated with leverage ×)" source={`${SEC}; ${CALC}. Bars = ROE %, right label = equity multiplier (assets/equity).`}>
        <BarH rows={roeRows} unit="%" decimals={0} color={AMBER} labelWidth={52} tagWidth={44} />
      </Figure>

      <Section n="03" title="The map: three roads to ROE" />
      <P>
        Figure 2 plots the universe on the two operating axes — net margin (x) against asset
        turnover (y) — with bubble size scaled to leverage. The three roads separate cleanly. The{" "}
        <Em>margin road</Em> runs along the right edge: NVIDIA, Microsoft, Alphabet, Lilly, the
        pharma and software franchises that earn 30–56 cents of profit per revenue dollar at
        unremarkable turnover. The <Em>turnover road</Em> sits in the top-left: Costco and Walmart,
        ~3% margins spun across assets 2.5–3.6× a year. And the <Em>leverage road</Em> is encoded in
        the bubbles — Apple, Home Depot, Caterpillar, Pepsi carry the largest circles, reaching
        their returns through balance-sheet structure rather than operations.
      </P>
      <Figure n={2} title="DuPont map: net margin × asset turnover, bubble size ∝ leverage" source={`${SEC}; ${CALC}. x = net margin %, y = revenue/assets, bubble radius ∝ √(assets/equity).`}>
        <Bubble points={bubblePts} xLabel="net margin" xUnit="%" yLabel="asset turnover (rev/assets)" height={380} />
      </Figure>

      <Section n="04" title="The quality of ROE" />
      <P>
        Not all ROE is created equal. Margin-sourced ROE reflects a durable economic moat — pricing
        power that competitors cannot easily erode. Turnover-sourced ROE reflects operational
        excellence in a thin-margin business. Leverage-sourced ROE is <em>borrowed</em>: it is a
        deliberate capital-structure decision that amplifies returns on the way up and losses on the
        way down, and — critically — its cost rises with interest rates. A 150% ROE built on 4.9×
        leverage is a different, more fragile asset than a 76% ROE built on a 56% margin. Table 1
        gives the full decomposition.
      </P>

      <div className="my-6 overflow-x-auto border border-rule">
        <table className="w-full border-collapse font-mono text-[12px]">
          <thead>
            <tr className="border-b border-rule-strong bg-bg-elev text-[10px] uppercase tracking-[0.04em] text-text-faint">
              <th className="px-2 py-1.5 text-left font-medium">Company</th>
              <th className="px-2 py-1.5 text-left font-medium">Sector</th>
              <th className="px-2 py-1.5 text-right font-medium">ROE</th>
              <th className="px-2 py-1.5 text-right font-medium">Net mgn</th>
              <th className="px-2 py-1.5 text-right font-medium">Asset turn</th>
              <th className="px-2 py-1.5 text-right font-medium">Leverage</th>
              <th className="px-2 py-1.5 text-left font-medium">Road</th>
            </tr>
          </thead>
          <tbody>
            {byRoe.map((c) => (
              <tr key={c.ticker} className="border-b border-rule">
                <td className="px-2 py-1 text-text">{c.ticker} <span className="text-text-faint">{c.name}</span></td>
                <td className="px-2 py-1 text-text-dim">{c.sector}</td>
                <td className="px-2 py-1 text-right text-text"><Num value={c.roe} decimals={1} />%</td>
                <td className="px-2 py-1 text-right text-text-dim"><Num value={c.netMargin} decimals={1} />%</td>
                <td className="px-2 py-1 text-right text-text-dim"><Num value={c.assetTurn} decimals={2} /></td>
                <td className="px-2 py-1 text-right text-text-dim"><Num value={c.leverage} decimals={2} />×</td>
                <td className="px-2 py-1">
                  <span className={road(c) === "margin" ? "text-data" : road(c) === "turnover" ? "text-accent" : "text-text-dim"}>{road(c)}</span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="mb-4 text-[10px] text-text-faint">Table 1. Full DuPont decomposition, latest fiscal year. Source: {SEC}; {CALC}.</p>

      <Section n="05" title="Sectors and the secular margin tailwind" />
      <P>
        At the sector level the margin hierarchy is stark (Fig. 3): Technology (<Em>35%</Em>) and
        Communication Services (<Em>31%</Em>) earn three to six times the net margin of Consumer
        Staples (<Em>5.6%</Em>) and Energy (<Em>7.9%</Em>). Yet staples and discretionary names still
        post competitive ROEs — proof that the turnover and leverage roads can substitute for margin.
      </P>
      <Figure n={3} title="Aggregate net margin by sector (revenue-weighted)" source={`${SEC}; ${CALC}.`}>
        <BarH rows={sectorRows} unit="%" decimals={1} color={CYAN} labelWidth={132} tagWidth={8} />
      </Figure>
      <P>
        The bigger picture is the trend. Aggregating net income and revenue across the whole basket,
        the blended net margin rose from <Em>{t0.netMargin}%</Em> in {t0.year} to{" "}
        <Em>{t1.netMargin}%</Em> in {t1.year} (Fig. 4) — a ~700bp expansion. This is the profit
        driver at the index level: a decade of equity returns has been underwritten not only by
        multiple expansion but by a genuine, filing-confirmed widening of corporate margins.
      </P>
      <Figure n={4} title="Blended net & operating margin of the basket, 2017–2025" source={`${SEC}; ${CALC}. Aggregate = Σ net income / Σ revenue across the universe.`}>
        <LineChart
          height={280}
          decimalsLeft={0}
          yLabelLeft="margin, %"
          series={[
            { name: "net margin", color: AMBER, data: marginTrend.map((d) => ({ date: d.year, value: d.netMargin })) },
            ...(marginTrend.every((d) => d.opMargin != null)
              ? [{ name: "operating margin", color: CYAN, data: marginTrend.map((d) => ({ date: d.year, value: d.opMargin as number })) }]
              : []),
          ]}
        />
      </Figure>

      <Section n="06" title="Implications" />
      <ul className="mb-4 ml-1 space-y-2 font-mono text-[13px] leading-[20px] text-text">
        <li className="flex gap-2"><span className="text-accent">→</span><span>Never screen on ROE alone. Decompose it: a high ROE from margin is a moat; a high ROE from leverage is a financing decision that can reverse.</span></li>
        <li className="flex gap-2"><span className="text-accent">→</span><span>Leverage-sourced ROE is rate-sensitive. As the cost of the borrowed denominator rises, the buyback-funded ROE of names like Apple and Home Depot faces a headwind the margin-funded ROE of NVIDIA does not — a direct link to the <Link href="/research/2026-02-01-equity-duration" className="text-data no-underline hover:opacity-80">rates piece</Link>.</span></li>
        <li className="flex gap-2"><span className="text-accent">→</span><span>The secular margin expansion is the real fundamental tailwind. Watch it for signs of rolling over — a margin peak, not a multiple peak, is what ends profit-driven bull markets.</span></li>
      </ul>

      <Section n="A" title="Data & method" />
      <div className="space-y-2 font-mono text-[11px] leading-[18px] text-text-dim">
        <p><span className="text-text-faint">Source.</span> SEC EDGAR company-facts API (XBRL from 10-K filings), no key required. {companies.length} companies; latest reported fiscal year per company (fiscal year-ends differ).</p>
        <p><span className="text-text-faint">Construction.</span> For each firm, every metric is aligned to the same fiscal year-end. Net margin = net income / revenue; asset turnover = revenue / total assets; equity multiplier = total assets / stockholders’ equity; ROE = net income / equity (identically the product of the three).</p>
        <p><span className="text-text-faint">Exclusions.</span> Banks and regulated utilities (asset turnover not comparable; non-standard revenue tags) and firms with negative book equity (e.g. buyback-driven, McDonald’s) are excluded from the cross-section.</p>
        <p><span className="text-text-faint">Caveats.</span> GAAP figures; single-year snapshots are sensitive to one-off items (impairments, acquisition amortization, tax). Sector aggregates use revenue weighting. Reproducible via <code className="text-text-dim">scripts/research/profit-dupont.mjs</code>.</p>
        <p className="pt-1 text-text-faint">This is research, not investment advice.</p>
      </div>
    </article>
  );
}
