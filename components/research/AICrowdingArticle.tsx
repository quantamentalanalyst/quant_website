import Link from "next/link";
import { site } from "@/lib/site";
import type { ResearchMeta } from "@/lib/content";
import Figure from "./Figure";
import { TeX, TeXBlock } from "./TeX";
import { Num } from "@/components/ui/Num";
import LineChart from "./charts/LineChart";
import BarH from "./charts/BarH";

import summary from "@/content/research/2026-09-16-ai-crowding/data/summary.json";
import adoption from "@/content/research/2026-09-16-ai-crowding/data/adoption.json";
import termmix from "@/content/research/2026-09-16-ai-crowding/data/termmix.json";
import names from "@/content/research/2026-09-16-ai-crowding/data/names.json";
import event from "@/content/research/2026-09-16-ai-crowding/data/event.json";
import factor from "@/content/research/2026-09-16-ai-crowding/data/factor.json";
import decomp from "@/content/research/2026-09-16-ai-crowding/data/decomp.json";
import crowding from "@/content/research/2026-09-16-ai-crowding/data/crowding.json";
import predict from "@/content/research/2026-09-16-ai-crowding/data/predict.json";
import gsy from "@/content/research/2026-09-16-ai-crowding/data/gsy.json";

const AMBER = "var(--color-accent)";
const CYAN = "var(--color-data)";
const POS = "var(--color-pos)";
const DIM = "var(--color-text-faint)";
const SEC = "SEC EDGAR (10-K full text, submissions, XBRL frames)";
const YH = "Yahoo Finance daily prices";
const KF = "Kenneth R. French Data Library (CRSP-based)";
const CALC = "author's calculations";

// Fama-French 49-industry short codes -> readable names
const IND: Record<string, string> = {
  Softw: "Computer Software", Chips: "Electronic Equipment (semis)", Hardw: "Computers",
  BusSv: "Business Services", LabEq: "Measuring & Control Equip.", ElcEq: "Electrical Equipment",
  Rtail: "Retail", Autos: "Autos", Util: "Utilities", Drugs: "Pharma", Banks: "Banks",
  Gold: "Precious Metals", Mach: "Machinery", Aero: "Aircraft", Mines: "Non-metallic Mining",
  Fin: "Trading", Hlth: "Healthcare", Agric: "Agriculture", Cnstr: "Construction",
  Clths: "Apparel", MedEq: "Medical Equipment", Whlsl: "Wholesale", RlEst: "Real Estate",
  Trans: "Transportation", Telcm: "Communication", Steel: "Steel", Coal: "Coal", Oil: "Oil",
  Soda: "Soft Drinks", Toys: "Recreation", Fun: "Entertainment",
};
const ind = (k: string | null) => (k ? IND[k] ?? k : "—");

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
const mns = (x: number | null | undefined, d?: number) =>
  x == null ? "—" : (x < 0 ? "−" : "") + (d == null ? Math.abs(x) : Math.abs(x).toFixed(d));
const sgn = (x: number | null | undefined, d?: number) => (x == null ? "—" : x >= 0 ? "+" + (d == null ? x : x.toFixed(d)) : mns(x, d));
const ci = (lo: number | null | undefined, hi: number | null | undefined) => `[${mns(lo)}, ${mns(hi)}]`;
const fx = (x: number | null | undefined, d: number) => (x == null ? "—" : mns(x, d));
const Th = ({ children, r }: { children: React.ReactNode; r?: boolean }) => (
  <th className={`px-2 py-1.5 font-medium ${r ? "text-right" : "text-left"}`}>{children}</th>
);
function Pct({ v, d = 1, dim = false }: { v: number | null | undefined; d?: number; dim?: boolean }) {
  if (v == null) return <span className="text-text-faint">—</span>;
  return <span className={`font-tabular ${v >= 0 ? "text-pos" : "text-neg"} ${dim ? "opacity-55" : ""}`}>{v >= 0 ? "+" : "−"}{Math.abs(v).toFixed(d)}%</span>;
}
function T({ v, d = 1 }: { v: number | null | undefined; d?: number }) {
  if (v == null) return <span className="text-text-faint">—</span>;
  return <span className={`font-tabular ${Math.abs(v) >= 2 ? "text-text" : "text-text-faint"}`}>{mns(v, d)}</span>;
}
function ordinal(n: number | null | undefined): string {
  if (n == null) return "—";
  const k = Math.round(n);
  const v = k % 100;
  const suf = v >= 11 && v <= 13 ? "th" : k % 10 === 1 ? "st" : k % 10 === 2 ? "nd" : k % 10 === 3 ? "rd" : "th";
  return `${k}${suf}`;
}
const Table = ({ children, small }: { children: React.ReactNode; small?: boolean }) => (
  <div className="my-6 overflow-x-auto border border-rule">
    <table className={`w-full border-collapse font-mono ${small ? "text-[10.5px]" : "text-[11px]"}`}>{children}</table>
  </div>
);
const Head = ({ children }: { children: React.ReactNode }) => (
  <thead>
    <tr className="border-b border-rule-strong bg-bg-elev text-[9px] uppercase tracking-[0.03em] text-text-faint">{children}</tr>
  </thead>
);
const Cap = ({ children }: { children: React.ReactNode }) => (
  <p className="mb-4 text-[10px] leading-snug text-text-faint">{children}</p>
);

export default function AICrowdingArticle({ meta }: { meta: ResearchMeta }) {
  const S = summary;
  const yr = (y: number) => adoption.find((a) => a.year === y)!;
  const a15 = yr(2015), a22 = yr(2022), a23 = yr(2023), a24 = yr(2024), a26 = yr(2026);
  const mix16 = termmix.find((m) => m.year === 2016)!;
  const mix25 = termmix.find((m) => m.year === 2025)!;

  const reg = event.reg;
  const gNone = event.groups.find((g) => g.grp === "none")!;
  const gQ5 = event.groups.find((g) => g.grp === "Q5")!;
  const nvdaEv = event.top.find((t) => t.tic === "NVDA");

  const st = (k: string) => factor.stats.find((s) => s.key === k)!;
  const aix = st("AIX"), inx = st("IN"), a10 = st("AIX10"), aew = st("AIXew"), mkt = st("Mkt-RF");
  const sp = factor.spanning;
  const FAC = ["Mkt-RF", "SMB", "HML", "RMW", "CMA", "MOM"] as const;
  const brk = sp.breakAIX;

  const dH = decomp[0]!, dL = decomp[1]!;
  const exAI = dH.cap! - dL.cap!;
  const exSales = dH.sales! - dL.sales!;
  const exRerate = dH.rerate! - dL.rerate!;

  const D = (k: string) => crowding.dash.find((d) => d.key === k)!;
  const dEx = D("excess"), dCoH = D("coH"), dCoB = D("coB"), dEx1 = D("excess1"), dExT = D("excessT"), dCoT = D("coT");
  const dVal = D("val"), dValI = D("valInd"), dCap = D("capH"), dTop = D("top10"), dRun = D("runup"), dVol = D("fvol"), dCr = D("crowd");
  const core = crowding.core;
  const coreInds = Object.entries(core.inds as Record<string, number>);

  const pr = (x: string, y: string) => predict.find((p) => p.x === x && p.y === y)!;
  const pRun12 = pr("runup", "r12"), pRun6 = pr("runup", "r6"), pRunDD = pr("runup", "dd12");
  const pCap6 = pr("capH", "vol6"), pCapDD = pr("capH", "dd12"), pCr12 = pr("crowdFS", "r12");
  const minP = Math.min(...predict.map((p) => p.p ?? 1));
  const minBonf = Math.min(...predict.map((p) => p.pBonf ?? 1));
  const mdeR12 = predict.filter((p) => p.y === "r12").map((p) => p.mde ?? 0);

  const base = gsy.base;
  const th = (lab: string) => gsy.thr.find((t) => t.label.startsWith(lab))!;
  const t100 = th("100% raw & net (baseline)"), t150 = th("150%"), t50 = th("50%"), tRaw = th("100% raw only"), t45 = th("100% raw & net, since 1945");
  const now = (k: string) => gsy.now.find((x) => x.ind === k)!;
  const chips = now("Chips"), hardw = now("Hardw"), softw = now("Softw");
  const aiNamed = gsy.named.filter((e) => ["Chips", "Softw", "Hardw"].includes(e.ind) && e.date >= "1990");
  const openEp = gsy.named.filter((e) => e.open);
  const dot = gsy.named.filter((e) => e.date >= "1999-01" && e.date <= "2000-12");
  const dotCrash = dot.filter((e) => e.crash).length;
  const multi = gsy.multi;

  const PRED_X: Record<string, string> = {
    excess: "Excess comovement", valInd: "Valuation spread (ind.-adj.)", capH: "Float-cap share",
    runup: "24m factor run-up", crowdFS: "Crowding composite",
  };

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

      {/* 00 */}
      <Section n="00" title="Executive summary" />
      <P>
        “The AI trade is crowded” is among the most-repeated sentences in markets and among the
        least-measured. The claim bundles two different hypotheses. One is that AI is a{" "}
        <em>factor</em>: a distinct source of common return variation that investors are paid, or
        not paid, to bear. The other is that it is a <em>crowd</em>: a position whose comovement,
        valuation and concentration tell you more about who owns it than about what it earns. This piece
        tests both, in forms that can fail. Exposure comes from the text of {S.docs.toLocaleString()}{" "}
        10-K filings, dated to the day each was filed. Crowding is measured four ways against explicit
        benchmarks. And because a ten-year-old trade cannot tell you how its own story ends, the crash
        question borrows a century of survivorship-free industry history.
      </P>
      <ul className="mb-4 ml-1 space-y-1.5 font-mono text-[13px] leading-[20px] text-text">
        {[
          <>Talk is not exposure, at least not before 2023. Firms that discussed AI most in the 10-Ks they filed before ChatGPT did not earn higher abnormal returns in the repricing that followed: <Em>{sgn(reg.car.b)}pp per σ</Em> of exposure (t = {mns(reg.car.t)}, industry fixed effects), and {sgn(reg.carVW.b)}pp (t = {reg.carVW.t}) value-weighted. The winners were a handful of names, not the disclosers.</>,
          <>As a factor, AI is mostly old styles in new clothes. The AI-minus-low-AI portfolio loads long on the market and short on size, value, profitability and conservative investment. Six factors explain <Em>{sp.AIX.full!.r2}%</Em> of its variance ({sp.AIX.post!.r2}% after ChatGPT), and its alpha of {sgn(sp.AIX.full!.alpha)}%/yr (t = {sp.AIX.full!.tA}) is not significant, with no break at ChatGPT (Δα = {sgn(brk.diff)}pp, t = {brk.t}).</>,
          <>The AI cohort's gain was mostly re-rating. Holding the November-2022 AI leg fixed, its market value rose {dH.cap} log points: {dH.sales} from sales and <Em>{dH.rerate} from a higher price-to-sales multiple</Em>. Against the low-AI leg, {Math.round((exRerate / exAI) * 100)}% of the excess gain is multiple, and five names delivered {dH.top5}% of the cohort's dollar gain.</>,
          <>AI is crowded in a specific way: concentration, volatility and, recently, a comoving core. It is not crowded on valuation. The AI leg is <Em>{dCap.last}% of universe float-cap</Em> ({ordinal(dCap.pct)} percentile), factor volatility is at its sample high ({dVol.last}%), and since spring 2026 the top-decile core has comoved beyond size-matched peers ({sgn(dExT.last)}, 95% CI {ci(core.lo, core.hi)}). Valuation is not the problem: the industry-adjusted spread is {sgn(dValI.last)} log points, the same as its pre-ChatGPT average ({sgn(dValI.pre)}), and the raw spread is at its {ordinal(dVal.pct)} percentile.</>,
          <>History says the risk is in the tail, not the mean. Across the French 49 industries since 1926, two-year run-ups above 100% (raw and net of market) crashed 40% within two years <Em>{t100.crash}%</Em> of the time (CI {t100.lo}–{t100.hi}), against {base.crash}% unconditionally, and {t150.crash}% above 150%. Mean forward returns net of the market are not reliably negative ({sgn(t100.n24)}pp, CI {ci(t100.nlo, t100.nhi)}). Semiconductors peaked at a {chips.peak36}% run-up ({chips.peakNet36}% net, a hair under the bar); Computers are inside a qualifying episode today.</>,
        ].map((t, i) => (
          <li key={i} className="flex gap-2"><span className="text-accent">{String(i + 1).padStart(2, "0")}</span><span>{t}</span></li>
        ))}
      </ul>

      {/* 01 */}
      <Section n="01" title="Two hypotheses, stated so they can fail" />
      <P>
        A <em>factor</em>, in the sense of Fama and French (2015), has two properties: stocks sorted on the
        characteristic share common return variation, and the long-short return either earns a premium
        or is spanned by factors that do. If AI is a factor in its own right, an AI long-short should
        leave material variance unexplained by the market, size, value, profitability, investment and
        momentum, and ideally carry an alpha against them. If it is merely a relabeling, those six will
        span it.
      </P>
      <P>
        A <em>crowd</em> is harder to define, which is why it is so rarely measured. Stein (2009) framed
        the problem: when many arbitrageurs pile into the same signal, none of them can see the others'
        positions, and the price impact of their joint exit is not in anyone's model. Lou and Polk (2022)
        made it measurable. Crowding leaves a fingerprint in excess return correlation among the stocks
        the crowd holds, beyond what common factors explain. Barberis, Shleifer and Wurgler (2005) showed
        the same fingerprint appearing mechanically when a stock joins the S&amp;P 500. I use that
        fingerprint alongside three blunter gauges: valuation, concentration, and the factor's own
        run-up and volatility.
      </P>
      <P>
        The limit is time. The AI trade, as a trade, is about four years old, and the exposure measure
        only has cross-sectional dispersion from about 2017. That is not enough history to learn how
        crowded trades end. Greenwood, Shleifer and You (2019) showed that industry-level price run-ups
        do not predict low average returns but do predict elevated crash probability, and their design
        runs on industry portfolios that exist, survivorship-free, back to 1926. Section 08 borrows that
        power.
      </P>

      {/* 02 */}
      <Section n="02" title="Measuring AI exposure from 22,000 annual reports" />
      <P>
        The universe is every NYSE- and Nasdaq-listed 10-K filer that ranked in the top{" "}
        {(1300).toLocaleString()} by dollar public float in any year from 2014 to 2025 ({S.firmsText.toLocaleString()}{" "}
        firms). Public float is the market value of non-affiliate shares that each filer reports on its
        own cover page. For each firm I downloaded every 10-K primary document filed between January 2015
        and August 2026 from EDGAR, stripped the HTML and the hidden inline-XBRL header, and counted a
        fixed dictionary. The dictionary has seven phrases (<em>artificial intelligence, machine learning,
        deep learning, neural network, large language model, natural language processing, computer
        vision</em>) plus the bare tokens <em>AI</em>, <em>GenAI</em> and <em>LLM</em>, matched
        case-sensitively so that “ai” inside words cannot fire. “Generative AI” is counted once, through
        its AI token. Exposure is mentions per 10,000 words:
      </P>
      <TeXBlock eq="1">{"\\mathrm{AI}_{i,t}=10^{4}\\times\\frac{\\sum_{k}\\operatorname{count}_k\\!\\left(\\text{10-K}_{i,\\tau}\\right)}{\\operatorname{words}\\!\\left(\\text{10-K}_{i,\\tau}\\right)},\\qquad \\tau=\\max\\{\\text{filing date}\\le t\\}"}</TeXBlock>
      <P>
        The score a firm carries at month-end <TeX>{"t"}</TeX> comes from the latest 10-K it had{" "}
        <em>filed</em> by then, which rules out look-ahead from the fiscal-year date. At each month-end the
        universe is the {S.nUniverse?.toLocaleString()} largest firms by float value. Each firm's
        cover-page float is rolled forward with its split-adjusted price, and every float is checked
        against unadjusted price × cover-page shares on its own date. That check caught{" "}
        {S.floatFixed} filings tagged with an exact 1,000× scale error, which were rescaled, and{" "}
        {S.floatDropped + S.floatUnverifiedDropped} that could not be reconciled, which were dropped.
        The {S.docsWrapper} “10-Ks” under {(10000).toLocaleString()} words are wrappers that incorporate the
        annual report by reference, and they are excluded.
      </P>
      <P>
        Figure 1 is the adoption curve, and it is the first finding. In 2015 <Em>{a15.share}%</Em> of
        these filings mentioned AI at all. By 2022, the year ChatGPT launched, {a22.share}% did. Then the
        curve broke: {a24.share}% in 2024 and <Em>{a26.share}%</Em> of the 10-Ks filed so far in 2026.
        Generative-AI language went from {a23.shareGen}% of filings in 2023 to {a26.shareGen}%. The
        vocabulary converged too: the bare “AI” token was {mix16.ai_token}% of dictionary hits in 2016 and{" "}
        {mix25.ai_token}% in 2025, while “machine learning” fell from {mix16.machine_learning}% to{" "}
        {mix25.machine_learning}%. A dictionary that everyone now triggers loses discriminating power at
        the bottom, which is why every sort below ranks on <em>intensity</em>, not mention. At the 2026
        cross-section the top-quintile cutoff is {S.q80_last} mentions per 10k words and the
        bottom-30% cutoff is {S.q30_last}.
      </P>
      <Figure n={1} title="Share of 10-K filings mentioning AI, by filing year (large-cap universe)" source={`${SEC}; ${CALC}. Primary 10-K documents only; ${a26.n.toLocaleString()} filings in 2026 through August.`}>
        <LineChart
          height={260} decimalsLeft={0} yLabelLeft="% of filings"
          series={[
            { name: "mentions AI (any)", color: AMBER, data: adoption.map((a) => ({ date: `${a.year}-07`, value: a.share! })) },
            { name: "mentions generative AI / LLMs", color: CYAN, data: adoption.map((a) => ({ date: `${a.year}-07`, value: a.shareGen! })) },
            { name: "intensity ≥ 5 per 10k words", color: POS, data: adoption.map((a) => ({ date: `${a.year}-07`, value: a.share5! })) },
          ]}
        />
      </Figure>
      <Table>
        <Head><Th>Filing year</Th><Th r>10-Ks</Th><Th r>any AI</Th><Th r>GenAI/LLM</Th><Th r>≥ 5 / 10k</Th><Th r>mean</Th><Th r>median</Th><Th r>p90</Th></Head>
        <tbody>
          {adoption.map((a) => (
            <tr key={a.year} className={`border-b border-rule ${a.year === 2023 ? "bg-bg-sunken" : ""}`}>
              <td className="px-2 py-1 text-text">{a.year}{a.year === 2026 ? " (Jan–Aug)" : ""}</td>
              <td className="px-2 py-1 text-right font-tabular text-text-faint">{a.n.toLocaleString()}</td>
              <td className="px-2 py-1 text-right font-tabular text-text">{a.share}%</td>
              <td className="px-2 py-1 text-right font-tabular text-text-dim">{a.shareGen}%</td>
              <td className="px-2 py-1 text-right font-tabular text-text-dim">{a.share5}%</td>
              <td className="px-2 py-1 text-right"><Num value={a.mean} decimals={2} /></td>
              <td className="px-2 py-1 text-right"><Num value={a.median} decimals={2} /></td>
              <td className="px-2 py-1 text-right"><Num value={a.p90} decimals={2} /></td>
            </tr>
          ))}
        </tbody>
      </Table>
      <Cap>Table 1. AI disclosure by filing year. Intensity = dictionary mentions per 10,000 words (eq. 1). First post-ChatGPT filing season shaded. Source: {SEC}; {CALC}.</Cap>
      <P>
        Face validity is the minimum bar, and Table 2 clears it. The most AI-intensive large filers in the
        latest cross-section are the names a practitioner would list: NVIDIA, Microsoft, Adobe,
        ServiceNow, Snowflake, Alphabet, alongside the new AI-infrastructure issuers (CoreWeave,
        DigitalOcean) and IT-services firms repositioning around AI (ExlService, Cognizant). By float, the AI leg is
        dominated by the familiar megacaps. Industry aggregates show the diffusion: software exposure
        went from {names.ind.find((x) => x.ind === "Softw")!.expo19} to{" "}
        {names.ind.find((x) => x.ind === "Softw")!.expo} mentions per 10k words between 2019 and{" "}
        {names.asOf}. Semiconductors rose to {names.ind.find((x) => x.ind === "Chips")!.expo}, and
        retailers, automakers and banks, which barely used the words in 2019, now sit in the middle of
        the distribution.
      </P>
      <div className="my-6 grid gap-5 md:grid-cols-2">
        <div className="overflow-x-auto border border-rule">
          <table className="w-full border-collapse font-mono text-[11px]">
            <Head><Th>Largest AI-leg names</Th><Th r>AI / 10k</Th><Th r>univ. wt</Th></Head>
            <tbody>
              {names.big.slice(0, 10).map((x) => (
                <tr key={x.tic} className="border-b border-rule">
                  <td className="px-2 py-1 text-text">{x.tic} <span className="text-text-faint">· {ind(x.ind)}</span></td>
                  <td className="px-2 py-1 text-right font-tabular text-text"><Num value={x.expo} decimals={1} /></td>
                  <td className="px-2 py-1 text-right font-tabular text-text-dim">{x.w}%</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="overflow-x-auto border border-rule">
          <table className="w-full border-collapse font-mono text-[11px]">
            <Head><Th>Most AI-intensive filers</Th><Th r>AI / 10k</Th><Th r>float $bn</Th></Head>
            <tbody>
              {names.top.slice(0, 10).map((x) => (
                <tr key={x.tic} className="border-b border-rule">
                  <td className="px-2 py-1 text-text">{x.tic} <span className="text-text-faint">· {ind(x.ind)}</span></td>
                  <td className="px-2 py-1 text-right font-tabular text-text"><Num value={x.expo} decimals={1} /></td>
                  <td className="px-2 py-1 text-right font-tabular text-text-dim">{x.fv?.toLocaleString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
      <Cap>Table 2. Latest cross-section ({names.asOf}). Left: largest members of the AI leg (top exposure quintile) by float value, with weight in the {S.nUniverse?.toLocaleString()}-stock universe. Right: highest-intensity filers. Industries are Fama-French 49 from SEC SIC codes; SIC is sticky (bitcoin miners turned AI hosts still file as finance companies). Source: {SEC}, {YH}; {CALC}.</Cap>

      {/* 03 */}
      <Section n="03" title="Validation, and a surprise: the disclosers did not win the repricing" />
      <P>
        If the text measure captured economic exposure, the natural experiment is ChatGPT's release on
        30 November 2022. Take each universe firm's exposure from 10-Ks filed <em>before</em> that date.
        Estimate its six-factor betas on the prior three years of weekly returns, and cumulate abnormal
        returns from December 2022 through June 2023, the window that ends just after NVIDIA's May 2023
        guidance reset the market's view of AI demand. Then regress the cross-section of abnormal returns
        on standardized exposure, with firm size and industry fixed effects, clustering by industry:
      </P>
      <TeXBlock eq="2">{"\\mathrm{CAR}_{i}=a+b\\,z\\!\\left(\\log(1+\\mathrm{AI}_{i,\\,\\text{Nov-22}})\\right)+c\\log \\mathrm{FV}_i+\\gamma_{\\mathrm{ind}(i)}+\\varepsilon_i"}</TeXBlock>
      <P>
        The answer is no. Across {reg.car.n} firms, a one-σ increase in pre-event exposure is associated
        with <Em>{sgn(reg.car.b)}pp</Em> of abnormal return (t = {mns(reg.car.t)}). Value-weighting
        gives {sgn(reg.carVW.b)}pp (t = {reg.carVW.t}), dropping the fixed effects gives{" "}
        {sgn(reg.carNoFE.b)}pp (t = {reg.carNoFE.t}), and extending the window through December 2024
        gives {sgn(reg.car2.b)}pp (t = {reg.car2.t}). The placebo window before the event is equally flat
        ({sgn(reg.plc.b)}pp, t = {mns(reg.plc.t)}). Figure 2 shows the groups: the {gNone.n} firms that
        never mentioned AI earned {sgn(gNone.car)}% and the most exposed quintile {sgn(gQ5.car)}%, with
        overlapping intervals. {nvdaEv && <>NVIDIA, the most AI-intensive large filer before the event, earned {sgn(nvdaEv.car)}% abnormal. It was the exception, not the pattern.</>}
      </P>
      <P>
        The null is informative, not an embarrassment for the measure, for two reasons. First, in late
        2022 {event.shareZero}% of large filers had never used the words, and those who had were mostly
        describing internal tools in risk-factor boilerplate. Disclosure measured intent, not revenue.
        Second, the market's repricing was narrow: it bought the handful of firms selling compute and
        models, not the broad population that talked about using them. This contrasts with labor-based
        exposure measures such as Eisfeldt, Schubert and Zhang (2023), who find that firms whose
        workforces were more exposed to generative AI outperformed after the release. Different
        instruments measure different things. The practical implication follows directly: a
        text-screened “AI basket” built in 2022 would have missed the trade. Text exposure became
        discriminating only after the vocabulary diffused and firms started describing AI in their
        products.
      </P>
      <Figure n={2} title="Abnormal return, Dec-2022 → Jun-2023, by pre-ChatGPT AI exposure" source={`${SEC}, ${YH}, ${KF}; ${CALC}. Six-factor (FF5 + momentum) betas from 156 weekly returns before the event; CAR = sum of weekly abnormal returns. Tags: bootstrap 95% CI · n.`}>
        <BarH
          rows={event.groups.map((g) => ({ label: g.grp === "none" ? "no mention" : `${g.grp} (${g.expoLo}–${g.expoHi})`, value: g.car!, tag: `${ci(g.lo, g.hi)} · ${g.n}` }))}
          unit="%" decimals={1} labelWidth={112} tagWidth={120}
        />
      </Figure>
      <Table>
        <Head><Th>Specification</Th><Th r>b (pp per σ)</Th><Th r>t (industry-clustered)</Th><Th r>R²</Th><Th r>n</Th></Head>
        <tbody>
          {([
            ["CAR Dec-22 → Jun-23, industry FE", reg.car],
            ["  — value-weighted (WLS by float)", reg.carVW],
            ["  — no industry FE", reg.carNoFE],
            ["CAR Dec-22 → Dec-24, industry FE", reg.car2],
            ["  — value-weighted", reg.car2VW],
            ["Placebo May-22 → Nov-22, industry FE", reg.plc],
            ["  — value-weighted", reg.plcVW],
          ] as const).map(([lab, v], i) => (
            <tr key={i} className={`border-b border-rule ${i === 0 ? "bg-bg-sunken" : ""}`}>
              <td className="px-2 py-1 text-text">{lab}</td>
              <td className="px-2 py-1 text-right"><Num value={v.b} decimals={2} signed /></td>
              <td className="px-2 py-1 text-right"><T v={v.t} d={2} /></td>
              <td className="px-2 py-1 text-right font-tabular text-text-dim">{v.r2}%</td>
              <td className="px-2 py-1 text-right font-tabular text-text-faint">{v.n}</td>
            </tr>
          ))}
        </tbody>
      </Table>
      <Cap>Table 3. Cross-sectional regressions of abnormal returns on standardized pre-event exposure (eq. 2), controlling for log float value. Standard errors clustered by Fama-French 49 industry. Source: {SEC}, {YH}, {KF}; {CALC}.</Cap>

      {/* 04 */}
      <Section n="04" title="Is AI a factor? Mostly a bundle of old ones" />
      <P>
        Each month-end, firms are sorted on exposure. The AI leg (H) is the top quintile among firms
        with any mention, and the low-AI leg (L) is the bottom 30%, which includes all zero-mention firms.
        Both legs are float-value-weighted and held for the next month. On average H holds {S.nH} names
        and L {S.nL}. The early-sample asymmetry is by design: in 2016 almost no one mentioned AI. Three
        variants guard against the obvious objections. An <em>equal-weighted</em> version removes the
        megacap bet. A <em>within-industry</em> version sorts inside each Fama-French 49 industry and
        aggregates by industry float, which removes the “long software, short banks” bet. A{" "}
        <em>top-decile</em> version tests whether the purest exposure behaves differently.
      </P>
      <Figure n={3} title="Growth of $1: AI long-short portfolios vs the market, 2016–2026" source={`${SEC}, ${YH}, ${KF}; ${CALC}. Long-short returns exclude financing; market = CRSP value-weighted total return.`}>
        <LineChart
          height={290} decimalsLeft={2} yLabelLeft="growth of $1"
          series={[
            { name: "AI − low-AI (value-weighted)", color: AMBER, data: factor.curve.map((d) => ({ date: d.date, value: d.vw! })) },
            { name: "within-industry", color: CYAN, data: factor.curve.map((d) => ({ date: d.date, value: d.ind! })) },
            { name: "equal-weighted", color: POS, data: factor.curve.map((d) => ({ date: d.date, value: d.ew! })) },
            { name: "market (CRSP VW)", color: DIM, data: factor.curve.map((d) => ({ date: d.date, value: d.mkt! })) },
          ]}
        />
      </Figure>
      <P>
        Table 4 reports performance for the whole sample and split at ChatGPT. The headline portfolio
        earned <Em>{sgn(aix.full!.mean)}%</Em> a year (t = {aix.full!.t}). Before ChatGPT it earned{" "}
        {sgn(aix.pre!.mean)}% and after {sgn(aix.post!.mean)}% (t = {aix.post!.t}), with volatility
        nearly doubling from {aix.pre!.vol}% to {aix.post!.vol}%. The within-industry version is the
        cleanest post-ChatGPT performer: {sgn(inx.post!.mean)}% a year at {inx.post!.vol}% volatility, a
        Sharpe ratio of {inx.post!.sharpe} (t = {inx.post!.t}), and a maximum drawdown of{" "}
        {mns(inx.post!.maxdd)}%. Within every industry, the firms that talked most about AI did a little
        better. The equal-weighted version tells the opposite story, {sgn(aew.post!.mean)}% after
        ChatGPT: the average AI-intensive small or mid-cap did not share in the megacaps' re-rating. No
        variant clears t = 2 over the full sample.
      </P>
      <Table>
        <Head><Th>Portfolio</Th><Th r>mean, full</Th><Th r>vol</Th><Th r>Sharpe</Th><Th r>t</Th><Th r>max DD</Th><Th r>mean, pre</Th><Th r>mean, post</Th><Th r>Sharpe post</Th></Head>
        <tbody>
          {[aix, aew, inx, a10, mkt].map((s) => (
            <tr key={s.key} className={`border-b border-rule ${s.key === "AIX" ? "bg-bg-sunken" : ""} ${s.key === "Mkt-RF" ? "text-text-dim" : ""}`}>
              <td className="px-2 py-1 text-text">{s.label}</td>
              <td className="px-2 py-1 text-right"><Pct v={s.full!.mean} /></td>
              <td className="px-2 py-1 text-right font-tabular text-text-dim">{s.full!.vol}%</td>
              <td className="px-2 py-1 text-right font-tabular text-text">{s.full!.sharpe}</td>
              <td className="px-2 py-1 text-right"><T v={s.full!.t} d={2} /></td>
              <td className="px-2 py-1 text-right"><Pct v={s.full!.maxdd} /></td>
              <td className="px-2 py-1 text-right"><Pct v={s.pre!.mean} dim /></td>
              <td className="px-2 py-1 text-right"><Pct v={s.post!.mean} /></td>
              <td className="px-2 py-1 text-right font-tabular text-text">{s.post!.sharpe}</td>
            </tr>
          ))}
        </tbody>
      </Table>
      <Cap>Table 4. Monthly long-short returns, annualized; {S.factorStart} → {S.factorEnd} (n = {aix.full!.n}); pre = through Nov-2022 (n = {aix.pre!.n}), post = Dec-2022 onward (n = {aix.post!.n}). t = mean / standard error of monthly returns. Source: {SEC}, {YH}, {KF}; {CALC}.</Cap>
      <P>
        The spanning regressions settle the factor question:
      </P>
      <TeXBlock eq="3">{"r^{\\mathrm{AI}}_{t}=\\alpha+\\beta_{m}\\mathrm{MKT}_t+\\beta_{s}\\mathrm{SMB}_t+\\beta_{h}\\mathrm{HML}_t+\\beta_{r}\\mathrm{RMW}_t+\\beta_{c}\\mathrm{CMA}_t+\\beta_{u}\\mathrm{UMD}_t+\\varepsilon_t"}</TeXBlock>
      <P>
        The loadings form a coherent profile (Table 5). The AI leg is higher-beta ({sgn(sp.AIX.full!.b["Mkt-RF"])}),
        larger (SMB {mns(sp.AIX.full!.b.SMB)}), growthier (HML {mns(sp.AIX.full!.b.HML)}), less profitable
        on the Fama-French definition (RMW {mns(sp.AIX.full!.b.RMW)}) and, most strongly, invests
        aggressively (CMA {mns(sp.AIX.full!.b.CMA)}, t = {mns(sp.AIX.full!.t.CMA)}). That last loading is
        the capex boom showing up in a factor model. Together the six factors explain{" "}
        <Em>{sp.AIX.full!.r2}%</Em> of the variance, rising to <Em>{sp.AIX.post!.r2}%</Em> after
        ChatGPT: as AI became the market's story, it became <em>more</em> explainable by known styles,
        not less. The alpha of {sgn(sp.AIX.full!.alpha)}%/yr (t = {sp.AIX.full!.tA}) is not
        significant, and a post-ChatGPT alpha dummy is {sgn(brk.diff)}pp (t = {brk.t}). Whatever the AI
        leg earned after November 2022, the factor model says it was paid for bearing growth, size,
        beta and investment exposure that already existed. The top-decile version has the largest alpha,{" "}
        {sgn(sp.AIX10.full!.alpha)}%/yr, at t = {sp.AIX10.full!.tA}, suggestive but short of
        conventional significance on {sp.AIX10.full!.n} months.
      </P>
      <Table small>
        <Head><Th>Portfolio · period</Th><Th r>α %/yr</Th><Th r>t(α)</Th>{FAC.map((f) => <Th key={f} r>{f === "Mkt-RF" ? "MKT" : f === "MOM" ? "UMD" : f}</Th>)}<Th r>R²</Th></Head>
        <tbody>
          {(["AIX", "AIXew", "IN", "AIX10"] as const).flatMap((k) =>
            (["full", "pre", "post"] as const).map((per) => {
              const v = sp[k][per]!;
              return (
                <tr key={k + per} className={`border-b border-rule ${per === "full" ? "bg-bg-sunken" : ""}`}>
                  <td className="px-2 py-1 text-text">{per === "full" ? { AIX: "AI − low (VW)", AIXew: "AI − low (EW)", IN: "Within-industry", AIX10: "Top decile − low" }[k] : ""} <span className="text-text-faint">{per}</span></td>
                  <td className="px-2 py-1 text-right"><Num value={v.alpha} decimals={1} signed /></td>
                  <td className="px-2 py-1 text-right"><T v={v.tA} d={2} /></td>
                  {FAC.map((f) => (
                    <td key={f} className={`px-2 py-1 text-right font-tabular ${Math.abs(v.t[f] ?? 0) >= 2 ? "text-text" : "text-text-faint"}`}>{sgn(v.b[f], 2)}</td>
                  ))}
                  <td className="px-2 py-1 text-right font-tabular text-text">{v.r2}%</td>
                </tr>
              );
            }),
          )}
        </tbody>
      </Table>
      <Cap>Table 5. Spanning regressions (eq. 3), monthly, Newey-West HAC (lag {S.hac}). Loadings in bold-equivalent (bright) when |t| ≥ 2. Factors: Fama-French five plus momentum (UMD). Source: {KF}, {SEC}, {YH}; {CALC}.</Cap>
      <Takeaway>
        An “AI factor” sleeve is, to about {Math.round(sp.AIX.post!.r2! / 10) * 10}%, a growth-beta-investment
        tilt you can already buy and risk-manage with standard factors. Hedge those loadings before
        calling any residual AI alpha. On this sample there is not enough residual to call it anything.
      </Takeaway>

      {/* 05 */}
      <Section n="05" title="What the AI return was made of" />
      <P>
        A return is sales growth, a change in the multiple, and distributions. Fix the membership of both
        legs at November 2022 and decompose each cohort's aggregate market value from then to{" "}
        {crowding.asOf}, using split-consistent market capitalization and trailing annual revenue from
        XBRL:
      </P>
      <TeXBlock eq="4">{"\\Delta\\log \\textstyle\\sum_i \\mathrm{MV}_i=\\underbrace{\\Delta\\log \\textstyle\\sum_i \\mathrm{Sales}_i}_{\\text{fundamentals}}+\\underbrace{\\Delta\\log\\left(\\textstyle\\sum_i \\mathrm{MV}_i\\big/\\textstyle\\sum_i \\mathrm{Sales}_i\\right)}_{\\text{re-rating}}"}</TeXBlock>
      <P>
        The AI cohort's value rose <Em>{dH.cap} log points</Em>. Of that, {dH.sales} came from sales
        and <Em>{dH.rerate}</Em> from a higher aggregate price-to-sales ratio, which went from{" "}
        {dH.ps0}× to {dH.ps1}×. The low-AI cohort rose {dL.cap}: {dL.sales} from sales and{" "}
        {dL.rerate} from re-rating. The AI cohort's excess, {exAI.toFixed(1)} log points, splits into{" "}
        {exSales.toFixed(1)} of faster sales growth and <Em>{exRerate.toFixed(1)} of multiple
        expansion</Em>. The concentration is as striking: five firms account for {dH.top5}% of the AI
        cohort's dollar gain, against {dL.top5}% for the low-AI cohort. This is the same verdict the{" "}
        <Link href="/research/2026-04-15-profit-dupont" className="text-link no-underline hover:opacity-80">DuPont piece</Link>{" "}
        reached for the decade's large-cap winners, sharpened: the AI trade has so far been paid mostly in
        multiple, by a few names.
      </P>
      <Table>
        <Head><Th>Cohort (fixed at Nov-2022)</Th><Th r>firms</Th><Th r>Δ log MV</Th><Th r>Δ log sales</Th><Th r>re-rating</Th><Th r>P/S then</Th><Th r>P/S now</Th><Th r>top-5 share of $ gain</Th></Head>
        <tbody>
          {decomp.map((d) => (
            <tr key={d.leg} className="border-b border-rule">
              <td className="px-2 py-1 text-text">{d.leg.replace(" (fixed at Nov-2022)", "")}</td>
              <td className="px-2 py-1 text-right font-tabular text-text-faint">{d.n}</td>
              <td className="px-2 py-1 text-right font-tabular text-text">{sgn(d.cap)}</td>
              <td className="px-2 py-1 text-right font-tabular text-text-dim">{sgn(d.sales)}</td>
              <td className="px-2 py-1 text-right font-tabular text-text">{sgn(d.rerate)}</td>
              <td className="px-2 py-1 text-right font-tabular text-text-dim">{d.ps0}×</td>
              <td className="px-2 py-1 text-right font-tabular text-text">{d.ps1}×</td>
              <td className="px-2 py-1 text-right font-tabular text-text-dim">{d.top5}%</td>
            </tr>
          ))}
          <tr className="border-b border-rule bg-bg-sunken">
            <td className="px-2 py-1 text-text-dim">AI minus low-AI</td>
            <td />
            <td className="px-2 py-1 text-right font-tabular text-text">{sgn(exAI, 1)}</td>
            <td className="px-2 py-1 text-right font-tabular text-text-dim">{sgn(exSales, 1)}</td>
            <td className="px-2 py-1 text-right font-tabular text-text">{sgn(exRerate, 1)}</td>
            <td colSpan={3} />
          </tr>
        </tbody>
      </Table>
      <Cap>Table 6. Aggregate log decomposition (eq. 4), in log points ×100, Nov-2022 → {crowding.asOf}; firms with valid market value and revenue at both ends. Market value = unadjusted price × cover-page shares; revenue = latest annual XBRL revenue available 90 days after fiscal year-end. Excludes dividends and buybacks. Source: {SEC}, {YH}; {CALC}.</Cap>

      {/* 06 */}
      <Section n="06" title="Is it a crowd? Four gauges, one pattern" />
      <P>
        The comovement gauge follows Lou and Polk. At each month-end, take the prior 52 weekly returns
        of every universe stock, strip the six Fama-French factors, and average the pairwise
        correlations of the residuals within a group. Two design choices matter. Only pairs from{" "}
        <em>different</em> industries are averaged, so industry news cannot masquerade as crowding.
        And each group is compared with a size-matched benchmark: for every AI-leg stock, a non-AI stock
        from the same float-value decile, averaged over ten random draws. That matters because megacaps
        comove with each other for reasons unrelated to AI:
      </P>
      <TeXBlock eq="5">{"\\mathrm{CoAI}_t=\\overline{\\rho}\\big(e_i,e_j\\big)_{\\substack{i,j\\in H_t\\\\ \\mathrm{ind}(i)\\ne \\mathrm{ind}(j)}}-\\overline{\\rho}\\big(e_i,e_j\\big)_{\\substack{i,j\\in B_t\\\\ \\mathrm{ind}(i)\\ne \\mathrm{ind}(j)}},\\qquad e_i=r_i-r_f-\\hat\\beta_i' f"}</TeXBlock>
      <P>
        The other gauges are blunter. The <em>valuation spread</em> is the median log price-to-sales of
        the AI leg minus that of the low-AI leg, raw and after subtracting each firm's industry median.{" "}
        <em>Concentration</em> is the AI leg's share of universe float value and the top-10 AI names'
        share. <em>Run-up</em> is the factor's trailing 24-month return and <em>factor volatility</em> its
        trailing 26-week volatility. Each is standardized in real time (expanding window, 24-month
        burn-in), and a pre-specified composite averages four of them: comovement, industry-adjusted
        valuation, concentration and run-up.
      </P>
      <Table>
        <Head><Th>Gauge</Th><Th r>{crowding.asOf}</Th><Th r>1y ago</Th><Th r>pre-ChatGPT avg</Th><Th r>z (real-time)</Th><Th r>percentile</Th></Head>
        <tbody>
          {crowding.dash.map((d) => {
            const dec = d.unit === "ρ" ? 3 : d.unit === "log" || d.unit === "z" ? 2 : d.unit === "%" && d.key === "runup" ? 0 : 1;
            const suf = d.unit === "%" ? "%" : "";
            const sub = d.label.startsWith("  ");
            return (
              <tr key={d.key} className={`border-b border-rule ${d.key === "crowd" ? "bg-bg-sunken" : ""}`}>
                <td className={`px-2 py-1 ${sub ? "pl-5 text-text-dim" : "text-text"}`}>{d.label.replace(/^\s+— /, "")}</td>
                <td className="px-2 py-1 text-right font-tabular text-text">{`${fx(d.last, dec)}${suf}`}</td>
                <td className="px-2 py-1 text-right font-tabular text-text-dim">{`${fx(d.prior, dec)}${suf}`}</td>
                <td className="px-2 py-1 text-right font-tabular text-text-faint">{`${fx(d.pre, dec)}${suf}`}</td>
                <td className="px-2 py-1 text-right">{d.z == null ? <span className="text-text-faint">—</span> : <span className={d.z >= 1 ? "text-neg" : d.z <= -1 ? "text-pos" : "text-text-dim"}><Num value={d.z} decimals={2} signed /></span>}</td>
                <td className="px-2 py-1 text-right font-tabular text-text-dim">{ordinal(d.pct)}</td>
              </tr>
            );
          })}
        </tbody>
      </Table>
      <Cap>Table 7. Crowding dashboard as of {crowding.asOf}. ρ = mean pairwise correlation of weekly six-factor residuals, 52-week window, cross-industry pairs only. Percentile vs the gauge's own 2016–2026 history; red z = crowded side. Valuation coverage {crowding.valCov}% of universe firms. Source: {SEC}, {YH}, {KF}; {CALC}.</Cap>
      <P>
        Read the table from the top. On the broad AI leg there is <em>no</em> excess comovement: its
        cross-industry residual correlation is {fx(dCoH.last, 3)} against {fx(dCoB.last, 3)} for size-matched peers
        (excess {sgn(dEx.last, 3)}, {ordinal(dEx.pct)} percentile). With market-model residuals the excess
        is actually negative ({fx(dEx1.last, 3)}), because the non-AI benchmark shares value and cyclical
        exposures that the six-factor model removes. The broad AI leg, some 200 names from software to
        retail, does not trade as a bloc. That is consistent with §04: its commonality lives in known
        styles.
      </P>
      <P>
        The <em>core</em> is different. The top-decile names ({core.n} stocks; {coreInds.slice(0, 4).map(([k, v]) => `${v} ${ind(k)}`).join(", ")})
        had residual comovement indistinguishable from their size-matched peers for a decade, then
        diverged in the spring of 2026. The current reading, <Em>{sgn(dExT.last)}</Em> (core{" "}
        {dCoT.last} vs benchmark {(dCoT.last! - dExT.last!).toFixed(3)}), is the highest in the sample,
        z = {dExT.z}. A week-block bootstrap of the latest 52-week window puts its 95% interval at{" "}
        <Em>{ci(core.lo, core.hi)}</Em>, clear of zero. Over the same six months the core rose{" "}
        {sgn(core.ret6)}% value-weighted ({sgn(core.ret6ew)}% equal-weighted), so this is a joint
        rally, not a joint liquidation. Two cautions. This gauge was added after the broad-leg result, as
        a robustness cut, so it carries a mild data-snooping discount. And a single spike is a state,
        not a forecast; §07 is the corrective.
      </P>
      <Figure n={4} title="Cross-industry residual comovement: the AI core vs its size-matched benchmark" source={`${SEC}, ${YH}, ${KF}; ${CALC}. Mean pairwise correlation of 52-week six-factor residuals, cross-industry pairs. Benchmark = size-decile-matched non-core stocks, 10 draws.`}>
        <LineChart
          height={270} decimalsLeft={3} yLabelLeft="mean pairwise ρ" zeroLine
          series={[
            { name: "top-decile AI core", color: AMBER, data: crowding.series.filter((d) => d.coT != null).map((d) => ({ date: d.date, value: d.coT! })) },
            { name: "size-matched benchmark", color: DIM, data: crowding.series.filter((d) => d.coBT != null).map((d) => ({ date: d.date, value: d.coBT! })) },
            { name: "broad AI leg (top quintile)", color: CYAN, data: crowding.series.filter((d) => d.coH != null).map((d) => ({ date: d.date, value: d.coH! })) },
          ]}
        />
      </Figure>
      <P>
        Concentration is the least ambiguous gauge. The AI leg holds <Em>{dCap.last}%</Em> of universe
        float value, against a pre-ChatGPT average of {dCap.pre}% ({ordinal(dCap.pct)} percentile), and
        the ten largest AI names alone hold <Em>{dTop.last}%</Em> ({ordinal(dTop.pct)} percentile).
        Factor volatility is at its sample high, <Em>{dVol.last}%</Em> annualized against{" "}
        {dVol.pre}% before ChatGPT (z = {dVol.z}). Valuation is where the popular story breaks. The raw
        spread is {dVal.last} log points, <em>below</em> its pre-ChatGPT average of {dVal.pre} and at its{" "}
        {ordinal(dVal.pct)} percentile. Industry-adjusted, it is {dValI.last} ({ordinal(dValI.pct)}{" "}
        percentile). Part of that compression is composition: as disclosure diffused, the AI leg
        absorbed cheaper retailers, banks and industrials. But it is also the §05 result read the other
        way round. The megacaps' re-rating pulled the aggregate multiple up while the median AI firm
        stayed close to its industry. The composite sits at {sgn(dCr.last)}σ ({ordinal(dCr.pct)}{" "}
        percentile), elevated but not extreme. Only one of its four pre-specified legs, concentration,
        is extended. The composite uses the broad-leg comovement gauge, not the core, and the run-up leg
        has cooled.
      </P>
      <Figure n={5} title="Concentration and factor volatility" source={`${SEC}, ${YH}; ${CALC}. Left: AI-leg share of universe float value. Right: annualized volatility of weekly AI long-short returns, trailing 26 weeks.`}>
        <LineChart
          height={260} decimalsLeft={0} decimalsRight={0} yLabelLeft="AI-leg share of float (%)" yLabelRight="factor vol (%)"
          series={[
            { name: "AI-leg share of universe (%)", color: AMBER, axis: "left", data: crowding.series.filter((d) => d.capH != null).map((d) => ({ date: d.date, value: d.capH! * 100 })) },
            { name: "top-10 AI names (%)", color: POS, axis: "left", data: crowding.series.filter((d) => d.top10 != null).map((d) => ({ date: d.date, value: d.top10! * 100 })) },
            { name: "factor vol, 26w (%)", color: CYAN, axis: "right", data: crowding.series.filter((d) => d.fvol != null).map((d) => ({ date: d.date, value: d.fvol! * 100 })) },
          ]}
        />
      </Figure>
      <Takeaway>
        Two portfolios can both be “long AI” and hold different risks. A market-cap AI sleeve is a
        concentration and volatility problem: {dTop.last}% of the universe in ten names, at record
        factor vol. A top-decile AI core now also carries a comovement problem, the Lou-Polk signature
        of crowded ownership. Size both for the joint-exit scenario, not for the average valuation,
        which is not the binding constraint.
      </Takeaway>

      {/* 07 */}
      <Section n="07" title="Does crowding predict? Not in 127 months, and here is why that is not surprising" />
      <P>
        The test is the standard predictive regression. Forward 3-, 6- and 12-month factor returns, the
        forward 12-month maximum drawdown, and forward 6-month factor volatility are each regressed on
        each gauge, standardized over the full sample. Overlapping forward windows make Newey-West
        t-statistics unreliable when the effective sample is only <TeX>{"n/h"}</TeX>, and the regressors
        are persistent, which is Stambaugh's (1999) bias. So every slope also gets a circular block
        bootstrap (block = 2h) of the (x, y) pairs, and the p-values are Bonferroni-adjusted over the
        25-cell grid. The last column is the minimum detectable effect: the slope the sample could
        detect with 80% power.
      </P>
      <Table small>
        <Head><Th>Gauge</Th><Th>Forward outcome</Th><Th r>β (pp/σ)</Th><Th r>HAC t</Th><Th r>boot 95% CI</Th><Th r>p</Th><Th r>Bonf. p</Th><Th r>MDE</Th><Th r>n eff</Th></Head>
        <tbody>
          {predict.map((p) => (
            <tr key={p.x + p.y} className={`border-b border-rule ${p.x === "crowdFS" ? "bg-bg-sunken" : ""}`}>
              <td className="px-2 py-1 text-text">{p.y === "r3" ? PRED_X[p.x] : ""}</td>
              <td className="px-2 py-1 text-text-dim">{p.ylab}</td>
              <td className="px-2 py-1 text-right"><Num value={p.b} decimals={2} signed /></td>
              <td className="px-2 py-1 text-right"><T v={p.t} d={2} /></td>
              <td className={`px-2 py-1 text-right font-tabular ${p.lo != null && p.hi != null && p.lo * p.hi > 0 ? "text-text" : "text-text-faint"}`}>{ci(p.lo, p.hi)}</td>
              <td className="px-2 py-1 text-right font-tabular text-text-dim">{p.p}</td>
              <td className={`px-2 py-1 text-right font-tabular ${p.pBonf != null && p.pBonf < 0.05 ? "text-text" : "text-text-faint"}`}>{p.pBonf}</td>
              <td className="px-2 py-1 text-right font-tabular text-text-faint">{p.mde}</td>
              <td className="px-2 py-1 text-right font-tabular text-text-faint">{p.neff}</td>
            </tr>
          ))}
        </tbody>
      </Table>
      <Cap>Table 8. Predictive regressions of forward AI-factor outcomes on standardized crowding gauges, {S.factorStart} → {S.factorEnd}. Returns and drawdowns in pp per 1σ of the gauge (a drawdown coefficient &lt; 0 = deeper drawdowns); volatility in points. HAC lag = horizon. Bootstrap: 2,000 circular-block resamples. MDE = 2.8 × HAC SE. Source: {SEC}, {YH}, {KF}; {CALC}.</Cap>
      <P>
        The most consistent pattern is <em>reversal after run-ups</em>. A 1σ higher trailing run-up is
        followed by {sgn(pRun6.b)}pp over six months and <Em>{sgn(pRun12.b)}pp over twelve</Em>{" "}
        (bootstrap CI {ci(pRun12.lo, pRun12.hi)}), and by deeper drawdowns ({sgn(pRunDD.b)}pp, CI{" "}
        {ci(pRunDD.lo, pRunDD.hi)}). Concentration predicts higher forward factor volatility{" "}
        ({sgn(pCap6.b)} points, CI {ci(pCap6.lo, pCap6.hi)}) and deeper drawdowns ({sgn(pCapDD.b)}pp). The
        composite points the same way at twelve months ({sgn(pCr12.b)}pp, CI {ci(pCr12.lo, pCr12.hi)}).
        All of these have the sign crowding theory predicts. <em>None survives the multiple-testing
        adjustment</em>: the smallest raw bootstrap p in the grid is {minP}, and Bonferroni over 25 cells
        leaves it at {minBonf}, short of 0.05. That smallest-p cell, broad-leg comovement predicting <em>lower</em> factor
        volatility, has the wrong sign for a crowding story, a reminder of what 25 tests on one short
        sample produce. At the 12-month horizon the sample has about {pRun12.neff} independent observations,
        and the detectable effect is {Math.min(...mdeR12).toFixed(1)}–{Math.max(...mdeR12).toFixed(1)}pp
        per σ. Only a very large crowding effect could show up here, which is why the next section goes
        looking for more data rather than more significance.
      </P>

      {/* 08 */}
      <Section n="08" title="A century of run-ups: what happens after an industry doubles" />
      <P>
        The Fama-French 49 value-weighted industry portfolios run from {gsy.start} to {gsy.end}. They
        are built from CRSP and include every firm that ever listed, including the dot-com failures a
        Yahoo sample cannot see. Following Greenwood, Shleifer and You, a <em>run-up</em> is a
        trailing 24-month industry return above a threshold. I require it both raw and net of the
        market, so that recoveries from market-wide crashes (1932–33, 2009–11) do not qualify, and I
        require at least ten firms in the industry. An episode starts at the first qualifying month
        with no episode in that industry in the prior 24 months. A <em>crash</em> is a fall of 40% or
        more below the episode-month level at any point in the next 24 months. Because run-ups cluster
        in time (August 2000 alone contributes several industries), all intervals resample calendar
        years, not episodes.
      </P>
      <Figure n={6} title="Probability of a 40% crash within two years, by run-up definition" source={`${KF}; ${CALC}. Tags: year-block bootstrap 95% CI · episodes. Unconditional rate across all industry-months with ≥10 firms: ${base.crash}%.`}>
        <BarH
          rows={[{ label: "unconditional", value: base.crash!, tag: `${base.n.toLocaleString()} ind-months`, faint: true },
                 ...gsy.thr.map((t) => ({ label: t.label.replace(" (baseline)", "*"), value: t.crash!, tag: `${ci(t.lo, t.hi)} · ${t.n}` }))]}
          unit="%" decimals={0} labelWidth={176} tagWidth={104} color={AMBER}
        />
      </Figure>
      <P>
        The results replicate the Greenwood-Shleifer-You pattern on an independent construction. The
        baseline definition yields {t100.n} episodes over {t100.years} distinct years, and{" "}
        <Em>{t100.crash}%</Em> of them crashed (CI {t100.lo}–{t100.hi}), against an unconditional{" "}
        {base.crash}%. Above 150% the crash rate is <Em>{t150.crash}%</Em> (CI {t150.lo}–{t150.hi}); at
        50% it is {t50.crash}%. The rate rises monotonically with run-up size. Restricting to the
        post-war sample changes little ({t45.crash}% vs a post-war base of {base.crash45}%). Dropping
        the net-of-market condition cuts the rate to {tRaw.crash}%, which is why that condition matters.
        The <em>mean</em> is a different matter. Forward 24-month returns net of the market after a
        100% run-up average {sgn(t100.n24)}pp with an interval of {ci(t100.nlo, t100.nhi)}: a coin flip
        ({t100.pneg}% negative), not a reliable short. Only the 150% bucket is reliably negative{" "}
        ({sgn(t150.n24)}pp, CI {ci(t150.nlo, t150.nhi)}). This is the industry-level cousin of the{" "}
        <Link href="/research/2026-07-04-sentiment-tails" className="text-link no-underline hover:opacity-80">sentiment piece's</Link>{" "}
        result: extremes buy variance, not a predictable mean.
      </P>
      <Table>
        <Head><Th>Run-up definition</Th><Th r>episodes</Th><Th r>years</Th><Th r>P(crash)</Th><Th r>95% CI</Th><Th r>fwd 24m raw</Th><Th r>fwd 24m net</Th><Th r>net 95% CI</Th><Th r>% negative</Th></Head>
        <tbody>
          {gsy.thr.map((t) => (
            <tr key={t.label} className={`border-b border-rule ${t.label.includes("baseline") ? "bg-bg-sunken" : ""}`}>
              <td className="px-2 py-1 text-text">{t.label}</td>
              <td className="px-2 py-1 text-right font-tabular text-text-dim">{t.n}</td>
              <td className="px-2 py-1 text-right font-tabular text-text-faint">{t.years}</td>
              <td className="px-2 py-1 text-right font-tabular text-text">{t.crash}%</td>
              <td className="px-2 py-1 text-right font-tabular text-text-dim">{ci(t.lo, t.hi)}</td>
              <td className="px-2 py-1 text-right"><Pct v={t.f24} /></td>
              <td className="px-2 py-1 text-right"><Pct v={t.n24} /></td>
              <td className="px-2 py-1 text-right font-tabular text-text-dim">{ci(t.nlo, t.nhi)}</td>
              <td className="px-2 py-1 text-right font-tabular text-text-dim">{t.pneg}%</td>
            </tr>
          ))}
          <tr className="border-b border-rule text-text-dim">
            <td className="px-2 py-1">All industry-months (base rate)</td>
            <td className="px-2 py-1 text-right font-tabular">{base.n.toLocaleString()}</td>
            <td />
            <td className="px-2 py-1 text-right font-tabular">{base.crash}%</td>
            <td />
            <td className="px-2 py-1 text-right"><Pct v={base.f24} /></td>
            <td className="px-2 py-1 text-right"><Pct v={base.n24} /></td>
            <td colSpan={2} />
          </tr>
        </tbody>
      </Table>
      <Cap>Table 9. Fama-French 49 value-weighted industries, {gsy.start} → {gsy.end}. Crash = cumulative return ≤ −40% from the episode month at any point within 24 months. Intervals: calendar-year block bootstrap (4,000 resamples for crash rates, 2,000 for returns). Source: {KF}; {CALC}.</Cap>
      <P>
        Can the <em>shape</em> of a run-up separate the ones that crash? Greenwood, Shleifer and You
        find that volatility, turnover, issuance and the price path of the run-up help. With industry
        portfolios I can measure four of the ingredients: run-up size, trailing realized volatility,
        acceleration (the last 12 months' return minus the prior 12), and issuance, proxied by the change
        in the number of listed firms. Table 10 is an honest null. Within the {multi.n} baseline episodes
        ({multi.crashes} crashes), none of the characteristics separates crashes from survivors at
        conventional levels, and a pre-specified four-variable logit that fits in sample (AUC{" "}
        {multi.aucIn}) scores <Em>{multi.aucLoo}</Em> out of sample (leave-one-out), worse than a coin.
        Without turnover, which needs stock-level CRSP data, industry portfolios can
        tell you <em>how likely</em> a crash is given the run-up, but not <em>which</em> run-up crashes.
      </P>
      <Table>
        <Head><Th>Characteristic at episode start</Th><Th r>crashed</Th><Th r>did not</Th><Th r>perm. p</Th><Th r>odds ratio / σ</Th><Th r>logit p (yr-clustered)</Th></Head>
        <tbody>
          {gsy.chars.map((c) => (
            <tr key={c.key} className="border-b border-rule">
              <td className="px-2 py-1 text-text">{c.label}</td>
              <td className="px-2 py-1 text-right"><Num value={c.crash} decimals={2} signed /></td>
              <td className="px-2 py-1 text-right"><Num value={c.nocrash} decimals={2} signed /></td>
              <td className="px-2 py-1 text-right font-tabular text-text-dim">{c.p}</td>
              <td className="px-2 py-1 text-right font-tabular text-text">{c.or}</td>
              <td className="px-2 py-1 text-right font-tabular text-text-dim">{c.lp}</td>
            </tr>
          ))}
        </tbody>
      </Table>
      <Cap>Table 10. Baseline episodes (100% raw and net). Means by outcome; decimal units (1.82 = 182%). Permutation p from 5,000 label shuffles. Multivariate logit (size, volatility, acceleration, issuance): in-sample AUC {multi.aucIn}, leave-one-out AUC {multi.aucLoo}. Source: {KF}; {CALC}.</Cap>
      <P>
        Now place today's AI-linked industries in that distribution (Figure 7, Table 11). Semiconductors
        (“Chips”, {chips.share}% of CRSP market value) reached a <Em>{chips.peak36}%</Em> two-year run-up
        within the last three years, {chips.peakNet36}% net of the market, a hair short of the baseline
        episode definition. The trailing run-up has since cooled to {chips.run}%. Computer Software
        peaked at {softw.peak36}% raw ({softw.peakNet36}% net) and is now {sgn(softw.run)}%. The
        industry inside a qualifying episode <em>today</em> is Computers (“Hardw”): {hardw.run}% raw
        and {hardw.net}% net over 24 months, accelerating ({sgn(hardw.accel)}pp), with the episode
        dated {openEp.find((e) => e.ind === "Hardw")?.date}. Its base rate from Table 9 is roughly{" "}
        {t100.crash}% for a 40% crash within two years, about {Math.round(t100.crash! / base.crash!)}×
        the unconditional rate. Precious metals ({now("Gold").run}% raw) and construction are the other
        live or recent episodes, and neither is an AI trade. The dot-com precedent is sobering on the
        tail and uninformative on timing: of the {dot.length} baseline episodes that started in
        1999–2000, {dotCrash} crashed. Software's episode, dated to March 1999, lost{" "}
        {Math.abs(aiNamed.find((e) => e.ind === "Softw" && e.date.startsWith("1999"))?.f24 ?? 0)}% over its
        window without breaching the crash line, while semiconductors' December 1999 episode fell{" "}
        {Math.abs(aiNamed.find((e) => e.ind === "Chips" && e.date.startsWith("1999"))?.trough ?? 0)}% at
        the trough.
      </P>
      <Figure n={7} title="Trailing 24-month industry return today: the run-up league table" source={`${KF}; ${CALC}. As of ${gsy.end}. Tags: net of market · peak 24m run-up within the last 36 months. Baseline episode threshold: 100% raw AND 100% net.`}>
        <BarH
          rows={gsy.now.slice(0, 12).map((x) => ({ label: ind(x.ind), value: x.run!, tag: `net ${sgn(x.net)} · pk ${x.peak36}` }))}
          unit="%" decimals={0} labelWidth={176} tagWidth={120} color={CYAN}
        />
      </Figure>
      <Table>
        <Head><Th>Industry (FF49)</Th><Th r>mkt share</Th><Th r>24m raw</Th><Th r>24m net</Th><Th r>peak raw, 36m</Th><Th r>peak net, 36m</Th><Th r>vol</Th><Th r>accel.</Th><Th r>rel. B/M</Th></Head>
        <tbody>
          {["Chips", "Hardw", "Softw", "BusSv", "ElcEq", "Util", "Rtail", "Autos"].map((k) => {
            const x = now(k);
            if (!x) return null;
            return (
              <tr key={k} className={`border-b border-rule ${k === "Hardw" ? "bg-bg-sunken" : ""}`}>
                <td className="px-2 py-1 text-text">{ind(k)}</td>
                <td className="px-2 py-1 text-right font-tabular text-text-dim">{x.share}%</td>
                <td className="px-2 py-1 text-right"><Pct v={x.run} d={0} /></td>
                <td className="px-2 py-1 text-right"><Pct v={x.net} d={0} /></td>
                <td className="px-2 py-1 text-right font-tabular text-text">{fx(x.peak36, 0)}%</td>
                <td className="px-2 py-1 text-right font-tabular text-text">{fx(x.peakNet36, 0)}%</td>
                <td className="px-2 py-1 text-right font-tabular text-text-dim">{x.vol}%</td>
                <td className="px-2 py-1 text-right font-tabular text-text-dim">{sgn(x.accel)}</td>
                <td className="px-2 py-1 text-right"><Num value={x.relbm} decimals={2} signed /></td>
              </tr>
            );
          })}
        </tbody>
      </Table>
      <Cap>Table 11. AI-linked industries as of {gsy.end} (industries ranked by firm-level AI exposure: {gsy.aiInds.map(ind).join(", ")}; plus the power and electrical-equipment trade). Vol = trailing 12-month realized; accel. = last 12m minus prior 12m return (pp); rel. B/M = log book-to-market minus the cross-industry median (negative = expensive). Source: {KF}, {SEC}; {CALC}.</Cap>
      <Table small>
        <Head><Th>Episode</Th><Th r>start</Th><Th r>run-up</Th><Th r>vol</Th><Th r>accel.</Th><Th r>Δ firms</Th><Th r>trough (24m)</Th><Th r>24m return</Th><Th r>crash?</Th></Head>
        <tbody>
          {[...aiNamed, ...openEp.filter((e) => !["Chips", "Softw", "Hardw"].includes(e.ind))].map((e) => (
            <tr key={e.ind + e.date} className={`border-b border-rule ${e.open ? "bg-bg-sunken" : ""}`}>
              <td className="px-2 py-1 text-text">{ind(e.ind)}</td>
              <td className="px-2 py-1 text-right font-tabular text-text-dim">{e.date}</td>
              <td className="px-2 py-1 text-right font-tabular text-text">{e.run}%</td>
              <td className="px-2 py-1 text-right font-tabular text-text-dim">{e.vol}%</td>
              <td className="px-2 py-1 text-right font-tabular text-text-dim">{sgn(e.accel)}</td>
              <td className="px-2 py-1 text-right font-tabular text-text-dim">{sgn(e.issue)}%</td>
              <td className="px-2 py-1 text-right"><Pct v={e.trough} d={0} /></td>
              <td className="px-2 py-1 text-right">{e.open ? <span className="text-text-faint">{sgn(e.sofar)}% ({e.months}m, open)</span> : <Pct v={e.f24} d={0} />}</td>
              <td className={`px-2 py-1 text-right ${e.crash ? "text-neg" : "text-text-faint"}`}>{e.open ? "—" : e.crash ? "yes" : "no"}</td>
            </tr>
          ))}
        </tbody>
      </Table>
      <Cap>Table 12. Baseline episodes in technology industries since 1990, plus every episode still inside its 24-month window. Open episodes report the return and trough so far. Source: {KF}; {CALC}.</Cap>

      {/* 09 */}
      <Section n="09" title="What this means for a portfolio" />
      <ul className="mb-4 ml-1 space-y-2 font-mono text-[13px] leading-[20px] text-text">
        {[
          <><span className="text-accent">Screen on products, not vocabulary.</span> By 2026, {a26.share}% of large filers mention AI. A dictionary screen still ranks exposure usefully (Table 2 passes the smell test), but in 2022 it failed to pick the winners (§03). Pair text with revenue-segment or capex data before trusting a basket.</>,
          <><span className="text-accent">Hedge the styles first.</span> Six standard factors explain {sp.AIX.post!.r2}% of the AI long-short after ChatGPT. A PM who is long AI and neutral on growth, investment and size has less AI exposure than they think. One who is not neutral is running a style book.</>,
          <><span className="text-accent">Size for the joint exit.</span> The binding crowding constraints are concentration ({dTop.last}% in ten names), record factor volatility ({dVol.last}%), and a newly comoving core. Stress tests should assume the core's correlation goes to one on the way down, not the 52-week average.</>,
          <><span className="text-accent">Treat run-ups as option-like, not as shorts.</span> A century of industry data says a doubled-and-outperforming industry crashes about {t100.crash}% of the time within two years, but its average forward return is statistically indistinguishable from the market's. That argues for buying convexity (puts, collars, or trimming into strength) rather than outright shorts, especially in Computers, today's live episode.</>,
          <><span className="text-accent">Watch the core-comovement gauge.</span> It is the one crowding measure at a sample extreme with an interval clear of zero. It is also the youngest, so treat it as a state variable to monitor, not a timing signal.</>,
        ].map((t, i) => (
          <li key={i} className="flex gap-2"><span className="text-accent">—</span><span>{t}</span></li>
        ))}
      </ul>

      {/* 10 */}
      <Section n="10" title="Conclusion" />
      <P>
        Is AI a factor or a crowd? On this evidence, it is not a factor in the strong sense: its returns
        are mostly spanned by growth, size, investment, profitability and market exposure, its alpha is
        insignificant, and the firms that talked about AI before ChatGPT were not the ones the market
        rewarded. It is a crowd in a narrower sense than the phrase usually implies. The AI trade is
        historically concentrated and historically volatile, and in 2026 its purest names began to
        trade as a bloc beyond what size and style explain. It is not, on median price-to-sales,
        unusually expensive relative to the rest of the market; its expense sits in a few megacaps whose
        multiples did most of the work. The short sample cannot say whether any of this predicts the
        factor's returns, and the text says so rather than dressing up a t-statistic. The long sample
        can say what doubling does to an industry's distribution: it roughly triples the probability of
        a 40% crash and leaves the mean alone. For an allocator that is the useful answer: the AI trade
        has not been mispriced on average, but its downside tail is priced as if it were ordinary, and a
        century of history says it is not.
      </P>
      <P>
        Pre-registered follow-ups, so they are not fished for later: (i) replace the dictionary with
        revenue-segment exposure from XBRL and repeat §03; (ii) add holdings-based crowding from the SEC
        13F data sets (ownership breadth and overlap), the direct measure this piece approximates with
        return correlations; (iii) re-test §07 in 2028, when the sample doubles.
      </P>

      {/* appendix */}
      <Section n="A" title="Data, method & limitations" />
      <div className="space-y-2 font-mono text-[11px] leading-[18px] text-text-dim">
        <p><span className="text-text-faint">Sources.</span> SEC EDGAR: company-ticker-exchange map; submissions API (10-K filing index, SIC); {S.docs.toLocaleString()} 10-K primary documents filed 2015-01 → 2026-08 (median {S.medianWords.toLocaleString()} words); XBRL frames for dei:EntityPublicFloat, dei:EntityCommonStockSharesOutstanding and us-gaap revenue tags (Revenues, RevenueFromContractWithCustomerExcludingAssessedTax, SalesRevenueNet; the maximum per firm-year). Yahoo Finance: daily adjusted and split-adjusted closes plus split events for {S.tickersPriced.toLocaleString()} of {S.tickersWanted.toLocaleString()} tickers. Kenneth R. French Data Library (files built from the {gsy.end.replace("-", "")} CRSP database): FF5 and momentum (daily and monthly), FF3 monthly from 1926, 49 industry portfolios (daily and monthly returns, number of firms, average firm size, BE/ME), and SIC definitions.</p>
        <p><span className="text-text-faint">Data validation.</span> The value-weighted return of the {S.nUniverse?.toLocaleString()}-stock universe correlates <span className="text-text">{S.valCorr}</span> with the CRSP value-weighted market (beta {S.valBeta}, tracking error {S.valTE}% a year, mean difference {sgn(S.valDiff)}% a year). That bounds the survivorship bias of a currently-listed universe at the value-weighted level. Floats: {S.floatVerifiedShare}% of observations verified against price × shares; {S.floatFixed} filings rescaled for an exact 1,000× tagging error; {S.floatDropped} failed verification and {S.floatUnverifiedDropped} unverifiable outliers were dropped. Monthly returns outside (−95%, +500%) and weekly outside (−90%, +300%) are treated as bad prints. Preferred-stock ticker lines are excluded.</p>
        <p><span className="text-text-faint">Exposure.</span> Eq. (1). HTML tags, script/style blocks and the inline-XBRL header are removed before counting; exhibits (including Exhibit 13 annual reports) are not read. The dictionary is fixed ex ante and not tuned. 10-Ks under 10,000 words ({S.docsWrapper}) are excluded as wrappers. Supply-chain vocabulary (GPU, accelerated computing, data center, hyperscale) is counted separately and does not enter the score.</p>
        <p><span className="text-text-faint">Portfolios.</span> Month-end sorts, next-month holding. H: exposure above the 80th percentile and positive; L: at or below the 30th percentile; top decile: above the 90th. Float value = cover-page float × (split-adjusted price now / at the float date). Within-industry: H and L within each FF49 industry with ≥ 5 universe firms, the industry spreads averaged by industry float. Weekly long-shorts reuse month-start weights.</p>
        <p><span className="text-text-faint">Inference.</span> Spanning and predictive regressions: Newey-West (Bartlett) HAC, lag {S.hac} for monthly spanning and lag = horizon for predictive regressions. Predictive slopes add circular block bootstraps (block 2h, 2,000 resamples) and Bonferroni ×25. The event study clusters by FF49 industry; group intervals are iid bootstraps. Core comovement uses a 4-week block bootstrap over weeks (500 resamples). Run-up statistics use calendar-year block bootstraps. Crowding z-scores are expanding-window (24-month burn-in), so dashboard readings are real-time; predictive regressions standardize over the full sample, which is harmless for t-statistics.</p>
        <div className="my-3 overflow-x-auto border border-rule">
          <table className="w-full border-collapse font-mono text-[10px]">
            <Head><Th> </Th>{crowding.corr.labels.map((l) => <Th key={l} r>{PRED_X[l]}</Th>)}</Head>
            <tbody>
              {crowding.corr.m.map((row, i) => (
                <tr key={i} className="border-b border-rule">
                  <td className="px-2 py-1 text-text">{PRED_X[crowding.corr.labels[i]!]}</td>
                  {row.map((v, j) => (
                    <td key={j} className={`px-2 py-1 text-right font-tabular ${i === j ? "text-text-faint" : Math.abs(v) >= 0.3 ? "text-text" : "text-text-dim"}`}>{fx(v, 2)}</td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="text-[10px] text-text-faint">Table 13. Correlation of the four composite legs (n = {crowding.corr.n} months). Concentration is negatively correlated with comovement and valuation, which is why the composite understates the concentration signal.</p>
        <p><span className="text-text-faint">Limitations.</span> (1) Survivorship: firms delisted before 2026 are absent from the text universe. The CRSP comparison bounds the value-weighted bias, but equal-weighted and small-cap results are more exposed; §08 is built on survivorship-free data for this reason. (2) Foreign private issuers file 20-F, not 10-K, so TSMC and ASML are outside the universe. (3) SIC codes are sticky and self-reported. (4) A dictionary cannot distinguish selling AI from using it or fearing it; the §03 null is partly that. (5) Revenue tags vary across firms; valuation covers {crowding.valCov}% of universe firms. (6) The core-comovement gauge (Fig. 4) was added after the broad-leg result. (7) Industry portfolios lack turnover and firm-level detail, so two of the run-up attributes Greenwood-Shleifer-You use cannot be replicated here. Reproducible via <code className="text-text-dim">analysis/ai_crowding.py</code> (first run downloads about 22,000 filings from EDGAR; roughly an hour at the fair-access rate).</p>
        <p><span className="text-text-faint">References.</span> Barberis, N., A. Shleifer &amp; J. Wurgler (2005), “Comovement,” <em>JFE</em>. Carhart, M. (1997), “On Persistence in Mutual Fund Performance,” <em>JF</em>. Eisfeldt, A., G. Schubert &amp; M. B. Zhang (2023), “Generative AI and Firm Values,” NBER WP 31222. Fama, E. &amp; K. French (2015), “A Five-Factor Asset Pricing Model,” <em>JFE</em>. Greenwood, R., A. Shleifer &amp; Y. You (2019), “Bubbles for Fama,” <em>JFE</em>. Lou, D. &amp; C. Polk (2022), “Comomentum: Inferring Arbitrage Activity from Return Correlations,” <em>RFS</em>. Loughran, T. &amp; B. McDonald (2011), “When Is a Liability Not a Liability? Textual Analysis, Dictionaries, and 10-Ks,” <em>JF</em>. Newey, W. &amp; K. West (1987), <em>Econometrica</em>. Stambaugh, R. (1999), “Predictive Regressions,” <em>JFE</em>. Stein, J. (2009), “Presidential Address: Sophisticated Investors and Market Efficiency,” <em>JF</em>.</p>
        <p className="pt-1 text-text-faint">This is research, not investment advice.</p>
      </div>
    </article>
  );
}
