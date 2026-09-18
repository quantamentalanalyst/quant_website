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

const IND: Record<string, string> = {
  Softw: "Computer Software", Chips: "Electronic Equipment (semis)", Hardw: "Computers",
  BusSv: "Business Services", LabEq: "Measuring & Control Equip.", ElcEq: "Electrical Equipment",
  Rtail: "Retail", Autos: "Autos", Util: "Utilities", Drugs: "Pharma", Banks: "Banks",
  Gold: "Precious Metals", Mach: "Machinery", Aero: "Aircraft", Mines: "Non-metallic Mining",
  Fin: "Trading", Hlth: "Healthcare", Agric: "Agriculture", Cnstr: "Construction",
  Clths: "Apparel", MedEq: "Medical Equipment", Whlsl: "Wholesale", RlEst: "Real Estate",
  Trans: "Transportation", Telcm: "Communication", Steel: "Steel", Coal: "Coal", Oil: "Oil",
  Soda: "Soft Drinks", Toys: "Recreation", Fun: "Entertainment", BldMt: "Building Materials",
  Paper: "Business Supplies", Insur: "Insurance", Books: "Printing & Publishing", Chems: "Chemicals",
  Rubbr: "Rubber & Plastic", Other: "Other",
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
function Revised({ children }: { children: React.ReactNode }) {
  return (
    <div className="my-5 border-l-2 border-rule-strong bg-bg-sunken px-4 py-3">
      <div className="section-label mb-1.5 text-text-dim">revision note</div>
      <p className="font-mono text-[12.5px] leading-[20px] text-text-dim">{children}</p>
    </div>
  );
}
const Em = ({ children }: { children: React.ReactNode }) => <span className="text-data">{children}</span>;
const mns = (x: number | null | undefined, d?: number) =>
  x == null ? "—" : (x < 0 ? "−" : "") + (d == null ? Math.abs(x) : Math.abs(x).toFixed(d));
const sgn = (x: number | null | undefined, d?: number) =>
  x == null ? "—" : x >= 0 ? "+" + (d == null ? x : x.toFixed(d)) : mns(x, d);
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
  const q90 = event.qreg["0.9"]!;

  const st = (k: string) => factor.stats.find((s) => s.key === k)!;
  const aix = st("AIX"), inx = st("IN"), a10 = st("AIX10"), aew = st("AIXew"), aixb = st("AIXB"), mkt = st("Mkt-RF");
  const sp = factor.spanning;
  const FAC = ["Mkt-RF", "SMB", "HML", "RMW", "CMA", "MOM"] as const;
  const EXF = ["MKTx", "SMBx", "VALx", "MOMx"] as const;
  const brk = sp.breakAIX, chow = sp.chow, oos = sp.oos;
  const cAt = (d: string) => factor.curve.find((c) => c.date === d)!;
  const c16 = cAt("2016-01"), c19 = cAt("2019-01"), c22 = cAt("2022-11"), cNow = factor.curve[factor.curve.length - 1]!;

  const dH = decomp[0]!, dL = decomp[1]!;
  const exCap = dH.cap! - dL.cap!;
  const exSales = dH.sales! - dL.sales!;
  const exMargin = dH.margin! - dL.margin!;
  const exMult = dH.mult! - dL.mult!;

  const D = (k: string) => crowding.dash.find((d) => d.key === k)!;
  const dEx = D("excess"), dCoH = D("coH"), dCoB = D("coB"), dEx1 = D("excess1");
  const dExT = D("excessT"), dCoT = D("coT"), dExTech = D("excessTtech"), dExFac = D("excessTfac");
  const dValI = D("valInd"), dVal = D("val"), dValVW = D("valVW"), dValAgg = D("valAgg");
  const dCap = D("capH"), dTop = D("top10"), dTopU = D("top10U"), dEffN = D("effNH");
  const dRun = D("runup"), dVol = D("fvol"), dCrRaw = D("crowdRaw"), dCr = D("crowd"), dCrVW = D("crowdVW");
  const core = crowding.core;
  const coreInds = Object.entries(core.inds as Record<string, number>);
  const th10 = core.thresh.find((t) => t.pct === 10)!;
  const th5 = core.thresh.find((t) => t.pct === 5)!;
  const th20 = core.thresh.find((t) => t.pct === 20)!;
  const lastSeries = crowding.series[crowding.series.length - 1]!;

  const pr = (x: string, y: string) => predict.find((p) => p.x === x && p.y === y)!;
  const pRun12 = pr("runup", "r12"), pRun6 = pr("runup", "r6");
  const pValDD = pr("valVW", "dd12"), pCr12 = pr("crowdFS", "r12");
  const bestCell = predict.reduce((a, b) => ((a.p ?? 1) <= (b.p ?? 1) ? a : b));
  const mdeR12 = predict.filter((p) => p.y === "r12").map((p) => p.mde ?? 0);

  const base = gsy.base;
  const th = (k: string) => gsy.thr.find((t) => t.label.startsWith(k))!;
  const tBase = th("GSY baseline"), tNet = th("  — also"), t150 = th("150%"), t50 = th("50%");
  const t2yOnly = th("100% 2y only"), t45 = th("100% 2y + 50% 5y, since 1945"), tExDot = th("100% 2y + 50% 5y, ex");
  const now = (k: string) => gsy.now.find((x) => x.ind === k)!;
  const chips = now("Chips"), hardw = now("Hardw"), softw = now("Softw");
  const openEp = gsy.named.filter((e) => e.open);
  const hardwEp = openEp.find((e) => e.ind === "Hardw");
  const softwEp = gsy.named.find((e) => e.ind === "Softw" && e.date.startsWith("1998"))!;
  const chipsEp = gsy.named.find((e) => e.ind === "Chips" && e.date.startsWith("1999"))!;
  const chips24 = gsy.named.find((e) => e.ind === "Chips" && e.date.startsWith("2024"))!;
  const techEp = gsy.named.filter((e) => ["Chips", "Softw", "Hardw"].includes(e.ind) && e.date >= "1990");
  const multi = gsy.multi;
  const runChar = gsy.chars.find((c) => c.key === "run")!;
  const volChar = gsy.chars.find((c) => c.key === "vol")!;

  const PRED_X: Record<string, string> = {
    excess: "Excess comovement (broad)", excessT: "Excess comovement (core)",
    valVW: "Valuation spread (VW)", capH: "Float-cap share",
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
        <p className="mt-4 max-w-[74ch] font-mono text-[13px] leading-[22px] text-text-dim">
          Is AI a factor or a crowd? Exposure measured point-in-time from {S.docs.toLocaleString()} 10-K
          filings says: neither, exactly. The AI long-short is largely a style bundle when priced against
          the published factors — but those factors now contain the AI names, and against styles rebuilt
          without them the alpha returns. The median AI firm is not expensive; the cap-weighted AI book
          is. And since spring 2026 the most AI-intensive names have started to trade as a bloc.
        </p>
      </header>

      {/* 00 */}
      <Section n="00" title="Executive summary" />
      <ul className="mb-4 ml-1 space-y-1.5 font-mono text-[13px] leading-[20px] text-text">
        {[
          <>Disclosure diffused, then changed character. AI mentions went from <Em>{a15.share}%</Em> of filings in 2015 to <Em>{a26.share}%</Em> in 2026 — but the Business section's share of those mentions fell from {mix16.year === 2016 ? adoption.find((a) => a.year === 2016)!.bShare : null}% to <Em>{a26.bShare}%</Em>. By 2026, {a26.shareR}% of filers discuss AI in Risk Factors against {a26.shareB}% in Business. Most of the diffusion is boilerplate about somebody else's AI.</>,
          <>The published factors have partly become the AI trade, so "AI is just old styles" is partly circular. Against FF5+momentum the long-short's alpha is {sgn(sp.AIX.full!.alpha)}%/yr (t = {sp.AIX.full!.tA}) with R² {sp.AIX.full!.r2}%. Against style factors <em>rebuilt without AI-leg stocks</em>, alpha is <Em>{sgn(sp.exAI.full!.alpha)}%/yr</Em> (t = {sp.exAI.full!.tA}) and R² falls to {sp.exAI.full!.r2}%. Sorting on Business-section language only, post-ChatGPT alpha is <Em>{sgn(sp.AIXB.post!.alpha)}%/yr (t = {sp.AIXB.post!.tA})</Em>.</>,
          <>The cohort's market-cap gain was not mostly re-rating. With TTM fundamentals and margins separated, the Nov-2022 AI cohort's {sgn(dH.cap)} log points split into {sgn(dH.sales)} sales, <Em>{sgn(dH.margin)} margin</Em> and {sgn(dH.mult)} multiple. Against the low-AI leg — which re-rated <em>more</em> ({sgn(dL.mult)}) — the AI cohort's excess gain is {sgn(exSales, 1)} sales and {sgn(exMargin, 1)} margin against {sgn(exMult, 1)} multiple.</>,
          <>Crowded on concentration and comovement, not on the median multiple. The industry-adjusted median valuation spread is {sgn(dValI.last, 2)} ({ordinal(dValI.pct)} percentile) while the float-weighted spread is <Em>{sgn(dValVW.last, 2)}</Em> ({ordinal(dValVW.pct)}). Factor volatility is at its sample high ({dVol.last}%), and since spring 2026 the top-decile core comoves beyond size- <em>and</em> tech-matched peers (<Em>{sgn(dExTech.last, 3)}</Em>, {ordinal(dExTech.pct)} percentile) — exploratory, but it strengthens under every control I could think to impose.</>,
          <>Nothing predicts, and the one pattern that looked like it did was an artefact. Run-up reversal ({sgn(pRun12.b)}pp per σ at 12 months, HAC t = {mns(pRun12.t)}) has a bootstrap p of <Em>{pRun12.p}</Em> once the null reproduces Stambaugh bias; no cell survives Romano-Wolf (min p = {S.predMinRW}).</>,
          <>History prices the tail, not the mean. Under the Greenwood-Shleifer-You design — a 40% drawdown from the running peak — two-year doublings crash <Em>{tBase.crash}%</Em> of the time (CI {tBase.lo}–{tBase.hi}) against a volatility-matched base rate of {tBase.volMatched}%, and <Em>{tNet.crash}%</Em> when the run-up also beats the market by 100%. Computers are inside a live episode; semiconductors peaked just under the bar.</>,
        ].map((t, i) => (
          <li key={i} className="flex gap-2"><span className="text-accent">{String(i + 1).padStart(2, "0")}</span><span>{t}</span></li>
        ))}
      </ul>
      <Revised>
        This is the second draft. Referee comments changed four headline numbers, and the text says so at
        each point rather than quietly restating them: the re-rating share of the AI cohort's gain (§05),
        the spanning verdict (§04), the crash frequency (§08) and the run-up reversal (§07). Where a
        result moved, the first-draft number is shown alongside the corrected one.
      </Revised>

      {/* 01 */}
      <Section n="01" title="Two hypotheses, stated so they can fail" />
      <P>
        A <em>factor</em>, in the sense of Fama and French (2015), needs two things: stocks sorted on the
        characteristic must share common return variation, and the long-short must either earn a premium
        or be spanned by factors that do. A <em>crowd</em> is harder. Stein (2009) framed the problem —
        when many investors hold the same position, none can see the others, and the price impact of a
        joint exit is in nobody's risk model — and Lou and Polk (2022) made it measurable: crowding
        leaves a fingerprint in excess return correlation among the stocks the crowd holds, beyond what
        common factors explain. Brown, Howard and Lundblad (2022) link that fingerprint directly to tail
        outcomes, which is where §08 ends up. Barberis, Shleifer and Wurgler (2005) show the same
        signature appearing mechanically on index inclusion, which is why every comovement number below
        is measured against a matched benchmark rather than against zero.
      </P>
      <P>
        There is a trap in testing the first hypothesis in 2026, and the first draft of this piece fell
        into it. If the AI names are a fifth of the market and most of the big-growth corner of the value
        and investment factors, then "the factors span AI" and "AI became the factors" are the same
        regression. §04 separates them by rebuilding the styles without AI-leg stocks. The second trap is
        time: the AI trade is about four years old, which is not enough history to learn how crowded
        trades end. §08 borrows a century of survivorship-free industry data for that, following
        Greenwood, Shleifer and You (2019).
      </P>

      {/* 02 */}
      <Section n="02" title="Measuring AI exposure, and separating talk from business" />
      <P>
        The universe is every NYSE- and Nasdaq-listed 10-K filer that ranked in the top 1,300 by dollar
        public float in any year from 2014 to 2025 ({S.firmsText.toLocaleString()} firms). For each I
        downloaded every 10-K primary document filed between January 2015 and August 2026
        ({S.docs.toLocaleString()} filings, median {S.medianWords.toLocaleString()} words), stripped the
        HTML and inline-XBRL header, and counted a fixed dictionary: seven phrases (<em>artificial
        intelligence, machine learning, deep learning, neural network, large language model, natural
        language processing, computer vision</em>) plus the bare tokens <em>AI</em>, <em>GenAI</em> and{" "}
        <em>LLM</em>, matched case-sensitively. Exposure is mentions per 10,000 words, dated to the
        filing date:
      </P>
      <TeXBlock eq="1">{"\\mathrm{AI}_{i,t}=10^{4}\\times\\frac{\\sum_{k}\\operatorname{count}_k\\!\\left(\\text{10-K}_{i,\\tau}\\right)}{\\operatorname{words}\\!\\left(\\text{10-K}_{i,\\tau}\\right)},\\qquad \\tau=\\max\\{\\text{filing date}\\le t\\}"}</TeXBlock>
      <P>
        The referee's cheapest suggestion turned out to be the most valuable: a mention in Item 1A (Risk
        Factors) — “our competitors may deploy AI” — is not the same economic signal as a mention in Item
        1 (Business). I re-read all {S.docs.toLocaleString()} filings and split them at the section
        headings, which parse cleanly in <Em>{S.secParsed}%</Em> of documents, then counted each section
        separately. Figure 1 is the result, and it reframes the adoption curve. Mentions went from{" "}
        {a15.share}% of filings in 2015 to <Em>{a26.share}%</Em> in 2026, but the Business section's
        share of all AI words fell from {adoption.find((a) => a.year === 2016)!.bShare}% to{" "}
        <Em>{a26.bShare}%</Em>. In 2026, {a26.shareR}% of filers mention AI in Risk Factors against{" "}
        {a26.shareB}% in Business. The diffusion everyone cites is mostly firms writing about somebody
        else's AI. The vocabulary converged too: the bare “AI” token was {mix16.ai_token}% of dictionary
        hits in 2016 and {mix25.ai_token}% in 2025, while “machine learning” fell from{" "}
        {mix16.machine_learning}% to {mix25.machine_learning}%.
      </P>
      <Figure n={1} title="AI disclosure: how much, and in which section" source={`${SEC}; ${CALC}. Primary 10-K documents only; ${a26.n.toLocaleString()} filings in 2026 through August. Section split parses in ${S.secParsed}% of filings.`}>
        <LineChart
          height={270} decimalsLeft={0} decimalsRight={0}
          yLabelLeft="% of filings mentioning" yLabelRight="Business share of AI words (%)"
          series={[
            { name: "any AI mention", color: AMBER, axis: "left", data: adoption.map((a) => ({ date: `${a.year}-07`, value: a.share! })) },
            { name: "in Risk Factors (Item 1A)", color: CYAN, axis: "left", data: adoption.filter((a) => a.shareR != null).map((a) => ({ date: `${a.year}-07`, value: a.shareR! })) },
            { name: "in Business (Item 1)", color: POS, axis: "left", data: adoption.filter((a) => a.shareB != null).map((a) => ({ date: `${a.year}-07`, value: a.shareB! })) },
            { name: "Business share of AI words", color: DIM, axis: "right", data: adoption.filter((a) => a.bShare != null).map((a) => ({ date: `${a.year}-07`, value: a.bShare! })) },
          ]}
        />
      </Figure>
      <Table>
        <Head><Th>Filing year</Th><Th r>10-Ks</Th><Th r>any AI</Th><Th r>in Business</Th><Th r>in Risk Factors</Th><Th r>GenAI/LLM</Th><Th r>mean intensity</Th><Th r>Business</Th><Th r>Risk</Th><Th r>Business share of words</Th></Head>
        <tbody>
          {adoption.map((a) => (
            <tr key={a.year} className={`border-b border-rule ${a.year === 2023 ? "bg-bg-sunken" : ""}`}>
              <td className="px-2 py-1 text-text">{a.year}{a.year === 2026 ? " (Jan–Aug)" : ""}</td>
              <td className="px-2 py-1 text-right font-tabular text-text-faint">{a.n.toLocaleString()}</td>
              <td className="px-2 py-1 text-right font-tabular text-text">{a.share}%</td>
              <td className="px-2 py-1 text-right font-tabular text-text-dim">{a.shareB}%</td>
              <td className="px-2 py-1 text-right font-tabular text-text-dim">{a.shareR}%</td>
              <td className="px-2 py-1 text-right font-tabular text-text-dim">{a.shareGen}%</td>
              <td className="px-2 py-1 text-right"><Num value={a.mean} decimals={2} /></td>
              <td className="px-2 py-1 text-right"><Num value={a.meanB} decimals={2} /></td>
              <td className="px-2 py-1 text-right"><Num value={a.meanR} decimals={2} /></td>
              <td className="px-2 py-1 text-right font-tabular text-text">{a.bShare}%</td>
            </tr>
          ))}
        </tbody>
      </Table>
      <Cap>Table 1. AI disclosure by filing year. Intensity = dictionary mentions per 10,000 words (eq. 1); Business and Risk columns are the same measure computed inside Item 1 and Item 1A. First post-ChatGPT filing season shaded. Source: {SEC}; {CALC}.</Cap>
      <P>
        Two limits of the measure, stated here rather than in the appendix. It updates once a year, in a
        period when the language moved quarter to quarter — earnings-call text would be timelier. And a
        dictionary cannot tell selling AI from buying it: a semiconductor firm and a retailer deploying
        chatbots can score alike. The section split is a partial fix, not a complete one. Table 2 shows
        the latest cross-section passes the face-validity check either way.
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
      <Cap>Table 2. Latest cross-section ({names.asOf}). Industries are Fama-French 49 from SEC SIC codes, which are sticky and self-reported (bitcoin miners turned AI hosts still file as finance companies); Hoberg-Phillips text-based industries would be the better classifier. Apple is absent from the AI leg: its 10-K intensity falls below the {S.q80_last}-per-10k cutoff, a reminder that disclosure volume is not exposure. Source: {SEC}, {YH}; {CALC}.</Cap>

      {/* 03 */}
      <Section n="03" title="Did disclosure predict the ChatGPT repricing? It depends what you control for" />
      <P>
        Take each firm's exposure from 10-Ks filed <em>before</em> 30 November 2022, cumulate abnormal
        returns from December 2022 through June 2023, and regress the cross-section on standardized
        exposure with size controls, clustering by industry. The first draft ran this with six-factor
        abnormal returns and industry fixed effects, found nothing, and called it a null. Both choices
        were wrong, and reversing them reverses the answer.
      </P>
      <TeXBlock eq="2">{"\\mathrm{CAR}_{i}=a+b\\,z\\!\\left(\\log(1+\\mathrm{AI}_{i,\\,\\text{Nov-22}})\\right)+c\\log \\mathrm{FV}_i+\\gamma_{\\mathrm{ind}(i)}+\\varepsilon_i"}</TeXBlock>
      <P>
        On <em>market-adjusted</em> returns, a 1σ increase in pre-event exposure is worth{" "}
        <Em>{sgn(event.regMkt.b)}pp</Em> (t = {event.regMkt.t}); on raw returns, {sgn(event.regRaw.b)}pp
        (t = {event.regRaw.t}). On six-factor-adjusted returns it is {sgn(reg.car.b)}pp
        (t = {mns(reg.car.t)}). The six-factor adjustment removes the result because in the first half of
        2023 the growth and investment factors <em>were</em> the AI repricing — the same circularity §04
        confronts. Industry fixed effects do the same thing for a different reason: the repricing hit
        whole industries (semis, software), so absorbing industry means absorbs the effect. The placebo
        window is flat ({sgn(reg.plc.b)}pp, t = {mns(reg.plc.t)}).
      </P>
      <P>
        Three further cuts keep the claim honest. Splitting the margins, neither the mention dummy
        ({sgn(event.regMargin.b)}pp, t = {mns(event.regMargin.t)}) nor intensity among mentioners
        ({sgn(event.regMargin.b_xint)}pp, t = {event.regMargin.t_xint}) is significant on six-factor returns.
        Business-section exposure does no better than total exposure ({sgn(event.regB.b)}pp,
        t = {mns(event.regB.t)}), so the section split, valuable in §04, does not rescue this test. And
        because “the winners were a handful of names” is a claim about the tail rather than the mean, I
        test the tail directly: the odds of landing in the top 5% of outcomes rise
        {" "}{event.tail.or}× per σ of exposure (p = {event.tail.p}), and the 90th-percentile quantile
        slope is {sgn(q90.b)}pp (t = {q90.t}) against {sgn(event.qreg["0.5"]!.b)}pp at the median.
        Directionally right, statistically marginal.
      </P>
      <Revised>
        First draft: “pre-ChatGPT disclosure did not predict the repricing (−0.3pp per σ, t = −0.3).”
        Corrected: disclosure predicted <em>raw and market-adjusted</em> abnormal returns
        ({sgn(event.regMkt.b)}pp per σ, t = {event.regMkt.t}); it does not survive six-factor adjustment or
        industry fixed effects, and the honest reading is that those controls absorb the event rather
        than that the signal is empty. The safest statement remains the narrow one: pre-ChatGPT
        disclosure intensity was a weak ex-ante signal, and a text screen built in 2022 would have been a
        blunt instrument — as Eisfeldt, Schubert and Zhang (2023) find with labor-based exposure, what
        “AI exposure” means depends entirely on the instrument.
      </Revised>
      <Figure n={2} title="Abnormal return, Dec-2022 → Jun-2023, by pre-ChatGPT AI exposure" source={`${SEC}, ${YH}, ${KF}; ${CALC}. Six-factor betas from 156 weekly returns before the event; bars are six-factor CARs, the conservative version. Tags: bootstrap 95% CI · n.`}>
        <BarH
          rows={event.groups.map((g) => ({ label: g.grp === "none" ? "no mention" : `${g.grp} (${g.expoLo}–${g.expoHi})`, value: g.car!, tag: `${ci(g.lo, g.hi)} · ${g.n}` }))}
          unit="%" decimals={1} labelWidth={112} tagWidth={120}
        />
      </Figure>
      <Table>
        <Head><Th>Specification (dependent = CAR, Dec-22 → Jun-23)</Th><Th r>b (pp per σ)</Th><Th r>t</Th><Th r>R²</Th><Th r>n</Th></Head>
        <tbody>
          {([
            ["Market-adjusted, no industry FE", event.regMkt, true],
            ["Raw return, no industry FE", event.regRaw, true],
            ["Six-factor-adjusted, no industry FE", reg.carNoFE, false],
            ["Six-factor-adjusted, industry FE", reg.car, false],
            ["  — value-weighted (WLS by float)", reg.carVW, false],
            ["  — Business-section exposure only", event.regB, false],
            ["  — mention dummy (extensive margin)", event.regMargin, false],
            ["Placebo May-22 → Nov-22 (six-factor)", reg.plc, false],
            ["Extended window to Dec-24 (six-factor)", reg.car2, false],
          ] as const).map(([lab, v, lead], i) => (
            <tr key={i} className={`border-b border-rule ${lead ? "bg-bg-sunken" : ""}`}>
              <td className="px-2 py-1 text-text">{lab}</td>
              <td className="px-2 py-1 text-right"><Num value={v.b} decimals={2} signed /></td>
              <td className="px-2 py-1 text-right"><T v={v.t} d={2} /></td>
              <td className="px-2 py-1 text-right font-tabular text-text-dim">{v.r2}%</td>
              <td className="px-2 py-1 text-right font-tabular text-text-faint">{v.n}</td>
            </tr>
          ))}
        </tbody>
      </Table>
      <Cap>Table 3. Cross-sectional regressions of abnormal returns on standardized pre-event exposure (eq. 2), controlling for log float value; standard errors clustered by FF49 industry. Shaded rows are the lead specifications: with the AI names inside the factors, factor-adjusting the dependent variable removes the event being measured. Source: {SEC}, {YH}, {KF}; {CALC}.</Cap>

      {/* 04 */}
      <Section n="04" title="Is AI a factor? Not against the published ones — but they are no longer independent" />
      <P>
        The sort is explicit, because the tie structure matters enormously early in the sample:
      </P>
      <TeXBlock eq="3">{"H_t=\\{i:\\mathrm{AI}_{i,t}>Q_{80,t}\\ \\wedge\\ \\mathrm{AI}_{i,t}>0\\},\\qquad L_t=\\{i:\\mathrm{AI}_{i,t}\\le Q_{30,t}\\}"}</TeXBlock>
      <P>
        When 97% of firms score zero, <TeX>{"Q_{80,t}=0"}</TeX> and the “top quintile” is every firm with
        any mention, while the “bottom 30%” is every firm with none. The legs therefore drift:{" "}
        <Em>{c16.nH}</Em> long and {c16.nL} short in January 2016, {c19.nH}/{c19.nL} in January 2019,{" "}
        {c22.nH}/{c22.nL} at ChatGPT, and {cNow.nH}/{cNow.nL} today. Early on this is “mentioners minus
        the market”; today it is a genuine intensity sort. Any pre/post comparison inherits that
        non-stationarity, which is one more reason the break tests below matter. Both legs are
        float-value-weighted and held one month. Four variants guard the obvious objections: equal
        weighting (kills the megacap bet), within-industry sorting (kills the sector bet), a top-decile
        core, and a sort on <em>Business-section</em> intensity only.
      </P>
      <Figure n={3} title="Growth of $1: AI long-short portfolios vs the market, 2016–2026" source={`${SEC}, ${YH}, ${KF}; ${CALC}. Long-short returns exclude financing; market = CRSP value-weighted total return.`}>
        <LineChart
          height={290} decimalsLeft={2} yLabelLeft="growth of $1"
          series={[
            { name: "AI − low-AI (value-weighted)", color: AMBER, data: factor.curve.map((d) => ({ date: d.date, value: d.vw! })) },
            { name: "Business-section sort", color: POS, data: factor.curve.filter((d) => d.biz != null).map((d) => ({ date: d.date, value: d.biz! })) },
            { name: "within-industry", color: CYAN, data: factor.curve.map((d) => ({ date: d.date, value: d.ind! })) },
            { name: "market (CRSP VW)", color: DIM, data: factor.curve.map((d) => ({ date: d.date, value: d.mkt! })) },
          ]}
        />
      </Figure>
      <P>
        Table 4 reports performance. The headline portfolio earned {sgn(aix.full!.mean)}% a year
        (t = {aix.full!.t}), {sgn(aix.post!.mean)}% after ChatGPT with volatility rising from{" "}
        {aix.pre!.vol}% to {aix.post!.vol}%. The best-behaved variant is the one the section split made
        possible: sorting on Business-section language alone earns <Em>{sgn(aixb.post!.mean)}%</Em> a
        year post-ChatGPT at {aixb.post!.vol}% volatility (Sharpe {aixb.post!.sharpe}, maximum drawdown{" "}
        {mns(aixb.post!.maxdd)}%). Firms that describe AI in their business beat firms that merely
        disclose it. The equal-weighted version is the counterweight: {sgn(aew.post!.mean)}% after
        ChatGPT. Its <em>pre</em>-ChatGPT alpha is the only conventionally significant one in the FF6
        table ({sgn(sp.AIXew.pre!.alpha)}%/yr, t = {sp.AIXew.pre!.tA}), consistent with Babina, Fedyk, He
        and Hodson (2024) on AI investment and firm growth in the pre-generative era — a result the first
        draft passed over in silence.
      </P>
      <Table>
        <Head><Th>Portfolio</Th><Th r>mean, full</Th><Th r>vol</Th><Th r>Sharpe</Th><Th r>t</Th><Th r>max DD</Th><Th r>mean, pre</Th><Th r>mean, post</Th><Th r>Sharpe post</Th></Head>
        <tbody>
          {[aix, aixb, aew, inx, a10, mkt].map((s) => (
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
      <Cap>Table 4. Monthly long-short returns, annualized; {S.factorStart} → {S.factorEnd} (n = {aix.full!.n}); pre = through Nov-2022 (n = {aix.pre!.n}), post = Dec-2022 onward (n = {aix.post!.n}). Source: {SEC}, {YH}, {KF}; {CALC}.</Cap>
      <P>
        Now the spanning question, and the correction that matters most. Against the published FF5 plus
        momentum, six factors explain <Em>{sp.AIX.full!.r2}%</Em> of the long-short's monthly return
        variation, rising to {sp.AIX.post!.r2}% after ChatGPT, with an insignificant alpha of{" "}
        {sgn(sp.AIX.full!.alpha)}%/yr (t = {sp.AIX.full!.tA}). The first draft read that as “AI is old
        styles in new clothes.” But by 2026 the AI leg is {dCap.last}% of universe float value, so the
        published factors are not independent of the thing being tested. Rebuilding four style factors
        from <em>non-AI stocks only</em> — market, size, a price-to-sales value factor and momentum,
        each computed inside the non-AI universe — the picture changes: R² falls to{" "}
        <Em>{sp.exAI.full!.r2}%</Em> and alpha rises to <Em>{sgn(sp.exAI.full!.alpha)}%/yr</Em>
        {" "}(t = {sp.exAI.full!.tA}), {sgn(sp.exAI.post!.alpha)}% post-ChatGPT
        (t = {sp.exAI.post!.tA}). For the top-decile core it is {sgn(sp.exAI10.full!.alpha)}%
        (t = {sp.exAI10.full!.tA}) and {sgn(sp.exAI10.post!.alpha)}% post (t = {sp.exAI10.post!.tA}).
      </P>
      <P>
        Two further tests keep me from over-claiming in the other direction. Freezing the pre-ChatGPT
        loadings and applying them to the post period leaves an out-of-sample alpha of{" "}
        {sgn(oos.alpha)}%/yr (t = {oos.t}) — the frozen factor model prices the post period about as well
        as the fitted one, which argues against a pure “AI became the factors” story. And the loadings
        themselves did break: a joint Wald test on alpha and all six betas rejects stability
        (χ² = {chow.stat}, {chow.df} df, p = <Em>{chow.p}</Em>), even though the alpha shift alone is{" "}
        {sgn(brk.diff)}pp (t = {brk.t}) with a minimum detectable effect of {brk.mde}pp — that test could
        not have found a break of any plausible size. So the correct sentence is “no detectable break in
        alpha, and a clear one in loadings,” not “no structural break.”
      </P>
      <Table small>
        <Head><Th>Portfolio · period</Th><Th r>α %/yr</Th><Th r>t(α)</Th>{FAC.map((f) => <Th key={f} r>{f === "Mkt-RF" ? "MKT" : f === "MOM" ? "UMD" : f}</Th>)}<Th r>R²</Th></Head>
        <tbody>
          {(["AIX", "AIXB", "AIXew", "IN", "AIX10"] as const).flatMap((k) =>
            (["full", "pre", "post"] as const).map((per) => {
              const v = sp[k][per]!;
              return (
                <tr key={k + per} className={`border-b border-rule ${per === "full" ? "bg-bg-sunken" : ""}`}>
                  <td className="px-2 py-1 text-text">{per === "full" ? { AIX: "AI − low (VW)", AIXB: "Business-section sort", AIXew: "AI − low (EW)", IN: "Within-industry", AIX10: "Top decile − low" }[k] : ""} <span className="text-text-faint">{per}</span></td>
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
          {(["exAI", "exAI10"] as const).flatMap((k) =>
            (["full", "pre", "post"] as const).map((per) => {
              const v = sp[k][per]!;
              return (
                <tr key={k + per} className="border-b border-rule">
                  <td className="px-2 py-1 text-text">{per === "full" ? (k === "exAI" ? "vs ex-AI styles" : "vs ex-AI styles (top decile)") : ""} <span className="text-text-faint">{per}</span></td>
                  <td className="px-2 py-1 text-right"><Num value={v.alpha} decimals={1} signed /></td>
                  <td className="px-2 py-1 text-right"><T v={v.tA} d={2} /></td>
                  {EXF.map((f) => (
                    <td key={f} className={`px-2 py-1 text-right font-tabular ${Math.abs(v.t[f] ?? 0) >= 2 ? "text-text" : "text-text-faint"}`}>{sgn(v.b[f], 2)}</td>
                  ))}
                  <td className="px-2 py-1 text-right font-tabular text-text-faint" colSpan={2}>ex-AI factors</td>
                  <td className="px-2 py-1 text-right font-tabular text-text">{v.r2}%</td>
                </tr>
              );
            }),
          )}
        </tbody>
      </Table>
      <Cap>Table 5. Spanning regressions, monthly, Newey-West HAC (lag {S.hac}). Top block: published Fama-French five plus momentum. Bottom block: MKTx/SMBx/VALx/MOMx rebuilt from non-AI-leg stocks inside this universe (columns reuse the MKT/SMB/HML/RMW positions). Bright = |t| ≥ 2. Source: {KF}, {SEC}, {YH}; {CALC}.</Cap>
      <P>
        One loading deserves explanation rather than a shrug. The AI leg loads <em>negatively</em> on RMW
        ({mns(sp.AIX.full!.b.RMW, 2)}), which looks absurd for a basket containing some of the most
        profitable firms in the world. Two reasons: Fama-French operating profitability expenses R&D, so
        research-heavy firms score poorly on it by construction; and the short leg is full of stable,
        cash-generative, low-growth firms that score well. The CMA loading ({mns(sp.AIX.full!.b.CMA, 2)},
        t = {mns(sp.AIX.full!.t.CMA)}) says the leg is tilted toward aggressive investment — asset growth
        broadly, which includes acquisitions and working capital, not only the data-center capex it is
        tempting to name.
      </P>
      <Revised>
        First draft: “six factors explain 70% of the AI long-short, so AI is a bundle of old styles, with
        no significant alpha.” Corrected: the published factors explain {sp.AIX.post!.r2}% of its monthly
        return <em>variation</em> post-ChatGPT — which is not the same as “70% of the portfolio is old
        styles” — and that number is partly circular, because the AI names are now inside those factors.
        Against ex-AI styles the alpha is {sgn(sp.exAI.full!.alpha)}%/yr (t = {sp.exAI.full!.tA}). The
        defensible claim is “insufficient evidence for a distinct, priced AI premium in{" "}
        {aix.full!.n} months,” not “AI is not a factor.”
      </Revised>
      <Takeaway>
        Hedge the styles you can name before calling anything AI alpha — but do not assume the standard
        factor suite is a clean hedge, because a fifth of the market's cap now sits on the AI side of it.
        The Business-section sort is the version worth tracking: same idea, better signal-to-noise
        ({sgn(aixb.post!.mean)}%/yr post-ChatGPT, Sharpe {aixb.post!.sharpe}).
      </Takeaway>

      {/* 05 */}
      <Section n="05" title="What the AI cohort's market-cap gain was made of" />
      <P>
        This section decomposes the change in <em>aggregate market capitalization</em> of a fixed cohort.
        That is not a shareholder return: issuance, buybacks and acquisitions move it too, so the numbers
        below describe where the market value went, not what an investor earned. With that label fixed,
        two measurement problems from the first draft remain to be corrected. Revenue was the latest
        <em> annual</em> figure, up to 18 months stale against a current price — which mechanically
        reclassifies fundamental growth as re-rating, and does so hardest for the fastest-growing cohort.
        And price-to-sales hides margin expansion, which is a fundamental. So: TTM revenue and TTM
        operating income from quarterly XBRL (median staleness now <Em>{S.ttmLagDays} days</Em>,
        coverage {S.ttmCoverage}% of universe firms), and a three-way split:
      </P>
      <TeXBlock eq="4">{"\\Delta\\log \\textstyle\\sum_i \\mathrm{MV}_i=\\underbrace{\\Delta\\log \\textstyle\\sum_i \\mathrm{Sales}_i}_{\\text{sales growth}}+\\underbrace{\\Delta\\log\\frac{\\sum_i \\mathrm{OpInc}_i}{\\sum_i \\mathrm{Sales}_i}}_{\\text{margin}}+\\underbrace{\\Delta\\log\\frac{\\sum_i \\mathrm{MV}_i}{\\sum_i \\mathrm{OpInc}_i}}_{\\text{multiple}}"}</TeXBlock>
      <P>
        The result reverses the first draft's headline. The AI cohort's market value rose{" "}
        <Em>{sgn(dH.cap)} log points</Em> (firm-bootstrap CI {ci(dH.capLo, dH.capHi)}): {sgn(dH.sales)}{" "}
        from sales, <Em>{sgn(dH.margin)} from margin</Em> (CI {ci(dH.marginLo, dH.marginHi)}) and{" "}
        {sgn(dH.mult)} from a higher multiple on operating income (CI {ci(dH.multLo, dH.multHi)}).
        Aggregate operating margin went from {dH.opm0}% to {dH.opm1}%. The low-AI cohort rose{" "}
        {sgn(dL.cap)}, and — the number that settles it — its multiple expanded <em>more</em>{" "}
        ({sgn(dL.mult)}) while its margin <em>fell</em> ({sgn(dL.margin)}). Relative to the low-AI leg,
        the AI cohort's excess {sgn(exCap, 1)} log points decompose into {sgn(exSales, 1)} sales,{" "}
        <Em>{sgn(exMargin, 1)} margin</Em> and {sgn(exMult, 1)} multiple. On this measure the AI
        cohort's outperformance was earned by fundamentals, not by re-rating.
      </P>
      <P>
        Two caveats keep the reversal from being over-read. The intervals are wide — the multiple term's
        CI spans {ci(dH.multLo, dH.multHi)} — because a cohort aggregate is dominated by a few firms:
        five names account for <Em>{dH.top5}%</Em> of the AI cohort's dollar gain (CI{" "}
        {ci(dH.top5Lo, dH.top5Hi)}) against {dL.top5}% for the low-AI leg. And a shift-share split of the
        aggregate price-to-sales ratio attributes {dH.within}% of its change to within-firm re-rating and
        {" "}{dH.between}% to mix shift toward high-multiple names, so the aggregate is not merely a
        composition artefact.
      </P>
      <Table>
        <Head><Th>Cohort (fixed at Nov-2022)</Th><Th r>firms</Th><Th r>Δ log MV</Th><Th r>sales</Th><Th r>margin</Th><Th r>multiple</Th><Th r>op margin then → now</Th><Th r>P/S</Th><Th r>P/OpInc</Th><Th r>top-5 share of $ gain</Th></Head>
        <tbody>
          {decomp.map((d) => (
            <tr key={d.leg} className="border-b border-rule">
              <td className="px-2 py-1 text-text">{d.leg.replace(" (fixed at Nov-2022)", "")}</td>
              <td className="px-2 py-1 text-right font-tabular text-text-faint">{d.n}</td>
              <td className="px-2 py-1 text-right font-tabular text-text">{sgn(d.cap)}</td>
              <td className="px-2 py-1 text-right font-tabular text-text-dim">{sgn(d.sales)}</td>
              <td className="px-2 py-1 text-right font-tabular text-text">{sgn(d.margin)}</td>
              <td className="px-2 py-1 text-right font-tabular text-text">{sgn(d.mult)}</td>
              <td className="px-2 py-1 text-right font-tabular text-text-dim">{d.opm0}% → {d.opm1}%</td>
              <td className="px-2 py-1 text-right font-tabular text-text-dim">{d.ps0}× → {d.ps1}×</td>
              <td className="px-2 py-1 text-right font-tabular text-text-dim">{d.pe0}× → {d.pe1}×</td>
              <td className="px-2 py-1 text-right font-tabular text-text">{d.top5}% {ci(d.top5Lo, d.top5Hi)}</td>
            </tr>
          ))}
          <tr className="border-b border-rule bg-bg-sunken">
            <td className="px-2 py-1 text-text-dim">AI minus low-AI</td>
            <td />
            <td className="px-2 py-1 text-right font-tabular text-text">{sgn(exCap, 1)}</td>
            <td className="px-2 py-1 text-right font-tabular text-text-dim">{sgn(exSales, 1)}</td>
            <td className="px-2 py-1 text-right font-tabular text-text">{sgn(exMargin, 1)}</td>
            <td className="px-2 py-1 text-right font-tabular text-text">{sgn(exMult, 1)}</td>
            <td colSpan={4} />
          </tr>
        </tbody>
      </Table>
      <Cap>Table 6. Aggregate log decomposition (eq. 4), log points ×100, Nov-2022 → {crowding.asOf}; cohort fixed at Nov-2022, firms with valid market value, TTM revenue and positive TTM operating income at both ends. Market value = unadjusted price × cover-page shares. Intervals: firm bootstrap (2,000 resamples). This is a market-capitalization decomposition, not a return decomposition: it excludes dividends and is affected by issuance and buybacks. Source: {SEC}, {YH}; {CALC}.</Cap>
      <Revised>
        First draft: “the AI cohort's value rose 68.8 log points: 28.2 from sales and 40.6 from a higher
        price-to-sales multiple — 59% re-rating.” That used the latest <em>annual</em> revenue against a
        current price and a multiple that hides margins. On TTM fundamentals the same price-to-sales
        framing would now read {sgn(dH.rerate_ps)} of {sgn(dH.cap)}; separating margin puts the true
        multiple term at {sgn(dH.mult)}, and the AI cohort's excess gain over the low-AI leg becomes
        mostly margin and sales. The first draft's most quotable sentence was wrong.
      </Revised>

      {/* 06 */}
      <Section n="06" title="Is it a crowd? Concentration, comovement — and which valuation you pick" />
      <P>
        Four gauges, each against an explicit benchmark. Comovement follows Lou and Polk: at each
        month-end, strip six factors from 52 weeks of returns and average the pairwise residual
        correlations inside a group, using only pairs from <em>different</em> industries so industry news
        cannot masquerade as crowding, and differencing against a benchmark matched on float-cap decile:
      </P>
      <TeXBlock eq="5">{"\\mathrm{CoAI}_t=\\overline{\\rho}\\big(e_i,e_j\\big)_{\\substack{i,j\\in C_t\\\\ \\mathrm{ind}(i)\\ne \\mathrm{ind}(j)}}-\\overline{\\rho}\\big(e_i,e_j\\big)_{\\substack{i,j\\in B_t\\\\ \\mathrm{ind}(i)\\ne \\mathrm{ind}(j)}},\\qquad e_i=r_i-r_f-\\hat\\beta_i' f"}</TeXBlock>
      <P>
        Start with valuation, where the first draft contradicted itself. The median AI firm's
        industry-adjusted price-to-sales spread is {sgn(dValI.last, 2)} log points
        ({ordinal(dValI.pct)} percentile) — unremarkable. The <em>float-weighted</em> spread is{" "}
        <Em>{sgn(dValVW.last, 2)}</Em> ({ordinal(dValVW.pct)} percentile) and the aggregate spread{" "}
        {sgn(dValAgg.last, 2)} ({ordinal(dValAgg.pct)}). Both are right; they answer different
        questions. Since the portfolio being tested is cap-weighted, the cap-weighted number is the
        relevant one for crowding, and the sharper sentence is: <em>the typical AI firm is not expensive
        relative to its industry; the AI book is, because the expense is concentrated in the
        megacap core.</em> That also reconciles §05, where the aggregate multiple rose while the median
        firm did not re-rate.
      </P>
      <P>
        Concentration needs its own foil, because US megacap concentration is not by itself an AI fact.
        The AI leg holds <Em>{dCap.last}%</Em> of universe float value against {dCap.pre}% before
        ChatGPT, and the ten largest AI names hold {dTop.last}%. But the ten largest firms in the
        universe — AI or not — hold {dTopU.last}%, so the AI-specific increment is the difference, not
        the level: essentially, most of the market's top 10 <em>are</em> the AI leg. The effective number
        of names in the AI leg (1/HHI) is <Em>{dEffN.last}</Em>, against {dEffN.pre} pre-ChatGPT. Read
        honestly, this gauge says the AI trade inherits the market's concentration rather than creating
        it — the direct test is holdings overlap from 13F filings, which is the pre-specified next step.
      </P>
      <Table>
        <Head><Th>Gauge</Th><Th r>{crowding.asOf}</Th><Th r>1y ago</Th><Th r>pre-ChatGPT avg</Th><Th r>z (real-time)</Th><Th r>percentile</Th></Head>
        <tbody>
          {crowding.dash.map((d) => {
            const dec = d.unit === "ρ" ? 3 : d.unit === "log" || d.unit === "z" ? 2 : d.unit === "n" ? 0 : d.key === "runup" ? 0 : 1;
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
      <Cap>Table 7. Crowding dashboard as of {crowding.asOf}. ρ = mean pairwise correlation of weekly six-factor residuals, 52-week window, cross-industry pairs only. z is expanding-window (real-time, so it uses only data through each month); the percentile is against the full 2016–2026 history — the two conventions differ, which is why a 95th-percentile reading can carry z ≈ 1.2 for a trending series. Valuation coverage {crowding.valCov}% of universe firms. Source: {SEC}, {YH}, {KF}; {CALC}.</Cap>
      <P>
        Now the gauge at a genuine extreme. On the broad AI leg there is <em>no</em> excess comovement
        ({sgn(dEx.last, 3)}, {ordinal(dEx.pct)} percentile): 200 names spanning software to retail do not
        trade as a bloc. The top-decile core does. Its cross-industry residual correlation is{" "}
        {fx(dCoT.last, 3)} against {fx(dCoT.last! - dExT.last!, 3)} for size-matched peers, an excess of{" "}
        <Em>{sgn(dExT.last, 3)}</Em> — the sample high. The referee's objection is the obvious one: the
        core is {core.shareTech}% tech ({coreInds.slice(0, 4).map(([k, v]) => `${v} ${ind(k)}`).join(", ")}),
        and software, IT services, semis and hardware are economic neighbours, so a common
        AI-disruption headline would produce this signature with no crowded ownership at all. Three
        tests, and the result survives all three. Matching the benchmark on <em>tech membership</em> as
        well as size raises the excess to <Em>{sgn(dExTech.last, 3)}</Em>. Adding a tech-sector factor to
        the residualization raises it to {sgn(dExFac.last, 3)}. And the Forbes-Rigobon adjustment for
        correlations estimated in a high-volatility window leaves {fx(lastSeries.excessT_fr, 3)}.
      </P>
      <P>
        The honest qualifier is about the <em>choice of cutoff</em>, not the estimate. The top decile was
        chosen after the broad leg showed nothing, so its bootstrap interval understates the real
        uncertainty. Table 8 therefore reports a pre-specified grid: the excess is{" "}
        <Em>{sgn(th5.exc, 3)}</Em> at the top 5% (t = {th5.t}), {sgn(th10.exc, 3)} at 10%
        (t = {th10.t}), {sgn(core.thresh.find((t) => t.pct === 15)!.exc, 3)} at 15% and{" "}
        {sgn(th20.exc, 3)} at 20% (t = {th20.t}). A monotone gradient in exposure concentration, not a
        knife-edge at one cutoff, and the maximum t across the grid is {core.maxT} at the top{" "}
        {core.maxPct}%. Over the same six months the core rose {sgn(core.ret6)}% value-weighted, so this
        is a joint rally, not a joint liquidation.
      </P>
      <Table>
        <Head><Th>Core cutoff (top % by exposure)</Th><Th r>names</Th><Th r>excess ρ, size-matched</Th><Th r>95% CI</Th><Th r>t</Th><Th r>excess ρ, size+tech-matched</Th><Th r>t</Th></Head>
        <tbody>
          {core.thresh.map((t) => (
            <tr key={t.pct} className={`border-b border-rule ${t.pct === 10 ? "bg-bg-sunken" : ""}`}>
              <td className="px-2 py-1 text-text">top {t.pct}%</td>
              <td className="px-2 py-1 text-right font-tabular text-text-faint">{t.n}</td>
              <td className="px-2 py-1 text-right font-tabular text-text">{sgn(t.exc, 3)}</td>
              <td className="px-2 py-1 text-right font-tabular text-text-dim">{ci(t.lo, t.hi)}</td>
              <td className="px-2 py-1 text-right"><T v={t.t} d={2} /></td>
              <td className="px-2 py-1 text-right font-tabular text-text">{sgn(t.excTech, 3)}</td>
              <td className="px-2 py-1 text-right"><T v={t.tTech} d={2} /></td>
            </tr>
          ))}
        </tbody>
      </Table>
      <Cap>Table 8. Excess cross-industry residual comovement of the AI core at four pre-specified cutoffs, latest 52-week window. CIs and t's from a 4-week block bootstrap over weeks (400 resamples), which covers sampling noise inside the window but not the choice of cutoff — hence the grid. Benchmarks are drawn from non-core stocks matched on float-cap decile, and in the last columns on tech-industry membership as well (10 draws). Source: {SEC}, {YH}, {KF}; {CALC}.</Cap>
      <Figure n={4} title="Cross-industry residual comovement: the AI core vs its matched benchmark" source={`${SEC}, ${YH}, ${KF}; ${CALC}. Mean pairwise correlation of 52-week six-factor residuals, cross-industry pairs. Benchmark = size-decile-matched non-core stocks (10 draws).`}>
        <LineChart
          height={270} decimalsLeft={3} yLabelLeft="mean pairwise ρ" zeroLine
          series={[
            { name: "top-decile AI core", color: AMBER, data: crowding.series.filter((d) => d.coT != null).map((d) => ({ date: d.date, value: d.coT! })) },
            { name: "size-matched benchmark", color: DIM, data: crowding.series.filter((d) => d.coBT != null).map((d) => ({ date: d.date, value: d.coBT! })) },
            { name: "broad AI leg (top quintile)", color: CYAN, data: crowding.series.filter((d) => d.coH != null).map((d) => ({ date: d.date, value: d.coH! })) },
          ]}
        />
      </Figure>
      <Figure n={5} title="Concentration: the AI leg against the market's own top ten" source={`${SEC}, ${YH}; ${CALC}. Left: shares of universe float value. Right: annualized volatility of weekly AI long-short returns, trailing 26 weeks.`}>
        <LineChart
          height={260} decimalsLeft={0} decimalsRight={0} yLabelLeft="share of universe float (%)" yLabelRight="factor vol (%)"
          series={[
            { name: "AI leg (%)", color: AMBER, axis: "left", data: crowding.series.filter((d) => d.capH != null).map((d) => ({ date: d.date, value: d.capH! * 100 })) },
            { name: "top-10 universe names (%)", color: DIM, axis: "left", data: crowding.series.filter((d) => d.top10U != null).map((d) => ({ date: d.date, value: d.top10U! * 100 })) },
            { name: "top-10 AI names (%)", color: POS, axis: "left", data: crowding.series.filter((d) => d.top10 != null).map((d) => ({ date: d.date, value: d.top10! * 100 })) },
            { name: "factor vol, 26w (%)", color: CYAN, axis: "right", data: crowding.series.filter((d) => d.fvol != null).map((d) => ({ date: d.date, value: d.fvol! * 100 })) },
          ]}
        />
      </Figure>
      <P>
        The composite averages four real-time z-scores — comovement, industry-adjusted median valuation,
        concentration and run-up. Because those legs are negatively correlated (appendix Table 13), their
        mean has a standard deviation of only {S.crowdRawSd}, so the first draft's “+0.3σ” was
        mislabelled; re-standardized, the composite reads {sgn(dCr.last, 2)}σ ({ordinal(dCr.pct)}{" "}
        percentile). Swapping the float-weighted valuation leg in gives {sgn(dCrVW.last, 2)}σ
        ({ordinal(dCrVW.pct)}). Either way the composite is unremarkable, and it is the least useful
        object on this page: its legs disagree by construction, and the two that matter — concentration
        and core comovement — are clearer read separately.
      </P>
      <Takeaway>
        The binding constraints are the cap-weighted multiple, an effective breadth of about{" "}
        {dEffN.last} names, record factor volatility ({dVol.last}%), and a core that has started moving
        together. Stress tests should assume the core's correlation goes to one on the way down rather
        than to its 52-week average — and should not take comfort from the median AI firm's ordinary
        multiple, because the median firm is not what a cap-weighted sleeve owns.
      </Takeaway>

      {/* 07 */}
      <Section n="07" title="Does crowding predict? Not once the null is built properly" />
      <P>
        Forward 3-, 6- and 12-month factor returns, the forward 12-month maximum drawdown and forward
        12-month volatility, each regressed on each standardized gauge. Two things make the naive version
        misleading, and the first draft only handled one. Overlapping windows leave about{" "}
        <TeX>{"n/h"}</TeX> independent observations. And — Stambaugh (1999) — a persistent regressor
        whose innovations correlate with contemporaneous returns biases the slope; for a <em>trailing
        run-up</em> that bias is negative, which manufactures exactly the reversal the first draft
        reported as its most consistent pattern. So p-values now come from a null bootstrap that
        reproduces both: the gauge is simulated from its own AR(1) with block-resampled innovations
        paired to the return innovations, under <TeX>{"\\beta=0"}</TeX>. Romano-Wolf step-down then
        controls family-wise error across the grid, exploiting the dependence that made Bonferroni
        absurdly conservative.
      </P>
      <Table small>
        <Head><Th>Gauge</Th><Th>Forward outcome</Th><Th r>β (pp/σ)</Th><Th r>HAC t</Th><Th r>p (null boot)</Th><Th r>p (Romano-Wolf)</Th><Th r>MDE</Th><Th r>n eff</Th></Head>
        <tbody>
          {predict.map((p) => (
            <tr key={p.x + p.y} className={`border-b border-rule ${p.x === "runup" && p.y === "r12" ? "bg-bg-sunken" : ""}`}>
              <td className="px-2 py-1 text-text">{p.y === "r3" ? PRED_X[p.x] : ""}</td>
              <td className="px-2 py-1 text-text-dim">{p.ylab}</td>
              <td className="px-2 py-1 text-right"><Num value={p.b} decimals={2} signed /></td>
              <td className="px-2 py-1 text-right"><T v={p.t} d={2} /></td>
              <td className={`px-2 py-1 text-right font-tabular ${p.p != null && p.p < 0.05 ? "text-text" : "text-text-faint"}`}>{p.p}</td>
              <td className={`px-2 py-1 text-right font-tabular ${p.pRW != null && p.pRW < 0.05 ? "text-text" : "text-text-faint"}`}>{p.pRW}</td>
              <td className="px-2 py-1 text-right font-tabular text-text-faint">{p.mde}</td>
              <td className="px-2 py-1 text-right font-tabular text-text-faint">{p.neff}</td>
            </tr>
          ))}
        </tbody>
      </Table>
      <Cap>Table 9. Predictive regressions of forward AI-factor outcomes on standardized crowding gauges, {S.factorStart} → {S.factorEnd}. Returns and drawdowns in pp per 1σ (a drawdown coefficient &lt; 0 = deeper drawdowns); volatility in points. HAC lag = horizon. p from {S.nullBoot?.toLocaleString()} draws of a Stambaugh-style null (AR(1) gauge, block-resampled innovations paired to return innovations, β = 0); Romano-Wolf step-down across all {predict.length} cells. MDE = 2.8 × HAC standard error. Source: {SEC}, {YH}, {KF}; {CALC}.</Cap>
      <P>
        The run-up reversal does not survive its own null. The point estimate is unchanged —
        {sgn(pRun12.b)}pp per σ at twelve months, HAC t = {pRun12.t}, which in the first draft carried a
        pairs-bootstrap p of 0.02 — but against a null that reproduces Stambaugh bias its p is{" "}
        <Em>{pRun12.p}</Em>. A persistent trailing-return regressor produces slopes that size routinely
        when nothing is there. The strongest surviving single-test cell is{" "}
        {PRED_X[bestCell.x]!.toLowerCase()} predicting {bestCell.ylab} (p = {bestCell.p}), and after
        Romano-Wolf the smallest family-wise p in the whole grid is <Em>{S.predMinRW}</Em>. With
        about {pRun12.neff} independent observations at the twelve-month horizon and detectable effects
        of {Math.min(...mdeR12).toFixed(1)}–{Math.max(...mdeR12).toFixed(1)}pp per σ, this sample cannot
        answer the question. That is not a finding about crowding; it is a finding about the sample, and
        it is why §08 goes looking for more data instead of more p-values.
      </P>
      <Revised>
        First draft: “the most consistent pattern is reversal after run-ups (−6.5pp per σ, bootstrap CI
        excluding zero), suggestive but not surviving Bonferroni.” Corrected: the pattern is what the
        null itself generates (p = {pRun12.p}). The negative sign was mostly econometrics, not crowding.
      </Revised>

      {/* 08 */}
      <Section n="08" title="A century of run-ups: what happens after an industry doubles" />
      <P>
        The Fama-French 49 value-weighted industry portfolios run from {gsy.start} to {gsy.end}, built
        from CRSP, including every firm that ever listed. The first draft got the experiment wrong in a
        way that mattered. Following Greenwood, Shleifer and You, a run-up is a two-year industry return
        above 100% <em>together with</em> a five-year return above 50% — the long-horizon filter is what
        keeps rebounds from a market-wide crash out — and a <em>crash</em> is a 40% drawdown from the{" "}
        <em>running peak</em> within the next two years. The first draft anchored the crash on the
        episode-month price instead, which only fires if an industry surrenders the entire run-up and
        more. An industry that rallies 60% and gives it all back is a 37% drawdown from peak and no crash
        at all by the entry-anchored rule; that is precisely the case bubble studies care about.
      </P>
      <P>
        Redone properly (Table 10): {tBase.n} episodes across {tBase.years} calendar years crash{" "}
        <Em>{tBase.crash}%</Em> of the time (year-block bootstrap CI {tBase.lo}–{tBase.hi}). The
        entry-anchored rule from the first draft gives {tBase.crashEnt}% on the same episodes — the
        definition, not the data, produced that number. The right comparison is not the {base.crash}%
        unconditional rate either: run-up industries are volatile industries, where a 40% drawdown is
        mechanically likelier, so Table 10 also reports a base rate computed over industry-months in the{" "}
        <em>same trailing-volatility deciles</em>, which is {tBase.volMatched}%. Against that foil, a
        doubling roughly doubles crash risk rather than tripling it. Requiring the run-up also to beat
        the market by 100% — the definition closest to a true bubble — gives <Em>{tNet.crash}%</Em>
        {" "}(CI {tNet.lo}–{tNet.hi}, vol-matched {tNet.volMatched}%), and a 150% two-year run-up gives{" "}
        {t150.crash}%. Excluding 1998–2001 leaves {tExDot.crash}%, so the dot-com cluster is not driving
        it; the post-1945 subsample gives {t45.crash}%.
      </P>
      <P>
        The mean is a different story, and it is the part of Greenwood-Shleifer-You that survives here
        cleanly: forward 24-month returns net of the market after a baseline run-up average{" "}
        {sgn(tBase.n24)}pp (CI {ci(tBase.nlo, tBase.nhi)}). Only the 150% bucket tilts negative
        ({sgn(t150.n24)}pp, CI {ci(t150.nlo, t150.nhi)}). Doubling does not predict low average returns;
        it predicts a fatter left tail.
      </P>
      <Revised>
        First draft: “100%+ two-year run-ups, raw and net of market, crash 26% of the time against a 7.9%
        base rate, 46% above 150%.” Two things were wrong. The crash was anchored on the entry price
        rather than the running peak, which misses exactly the episodes bubble research is about, and
        there was no five-year filter, so the episode set differed. And the unconditional base rate was
        the wrong foil, because run-up industries are volatile industries. Corrected: {tBase.crash}%
        against a volatility-matched {tBase.volMatched}%, rising to {tNet.crash}% when the run-up also
        beats the market by 100%.
      </Revised>
      <Figure n={6} title="Probability of a 40% drawdown from peak within two years" source={`${KF}; ${CALC}. Tags: year-block bootstrap 95% CI · episodes. Unconditional rate across all industry-months with ≥10 firms: ${base.crash}%; volatility-matched rates in Table 10.`}>
        <BarH
          rows={[{ label: "unconditional", value: base.crash!, tag: `${base.n.toLocaleString()} ind-months`, faint: true },
                 ...gsy.thr.map((t) => ({ label: t.label.replace("GSY baseline: ", "").replace("  — also", "+ also"), value: t.crash!, tag: `${ci(t.lo, t.hi)} · ${t.n}` }))]}
          unit="%" decimals={0} labelWidth={184} tagWidth={104} color={AMBER}
        />
      </Figure>
      <Table small>
        <Head><Th>Run-up definition</Th><Th r>episodes</Th><Th r>years</Th><Th r>P(crash), peak-anchored</Th><Th r>95% CI</Th><Th r>vol-matched base</Th><Th r>P(crash), entry-anchored</Th><Th r>fwd 24m net</Th><Th r>net 95% CI</Th></Head>
        <tbody>
          {gsy.thr.map((t) => (
            <tr key={t.label} className={`border-b border-rule ${t.label.startsWith("GSY") ? "bg-bg-sunken" : ""}`}>
              <td className="px-2 py-1 text-text">{t.label}</td>
              <td className="px-2 py-1 text-right font-tabular text-text-dim">{t.n}</td>
              <td className="px-2 py-1 text-right font-tabular text-text-faint">{t.years}</td>
              <td className="px-2 py-1 text-right font-tabular text-text">{t.crash}%</td>
              <td className="px-2 py-1 text-right font-tabular text-text-dim">{ci(t.lo, t.hi)}</td>
              <td className="px-2 py-1 text-right font-tabular text-text-dim">{t.volMatched}%</td>
              <td className="px-2 py-1 text-right font-tabular text-text-faint">{t.crashEnt}%</td>
              <td className="px-2 py-1 text-right"><Pct v={t.n24} /></td>
              <td className="px-2 py-1 text-right font-tabular text-text-dim">{ci(t.nlo, t.nhi)}</td>
            </tr>
          ))}
          <tr className="border-b border-rule text-text-dim">
            <td className="px-2 py-1">All industry-months (base rate)</td>
            <td className="px-2 py-1 text-right font-tabular">{base.n.toLocaleString()}</td>
            <td />
            <td className="px-2 py-1 text-right font-tabular">{base.crash}%</td>
            <td />
            <td />
            <td className="px-2 py-1 text-right font-tabular">{base.crashEnt}%</td>
            <td className="px-2 py-1 text-right"><Pct v={base.n24} /></td>
            <td />
          </tr>
        </tbody>
      </Table>
      <Cap>Table 10. Fama-French 49 value-weighted industries, {gsy.start} → {gsy.end}, industries with ≥10 firms. Peak-anchored crash = a 40% fall from the running peak within 24 months (Greenwood-Shleifer-You); entry-anchored = 40% below the episode-month level (the first draft's definition). Vol-matched base = crash rate among all industry-months in the same trailing-volatility deciles as the episodes. Intervals: calendar-year block bootstrap. Source: {KF}; {CALC}.</Cap>
      <P>
        With the right crash definition, the <em>shape</em> of a run-up starts to matter — another
        first-draft null that does not survive. Among the {multi.n} baseline episodes ({multi.crashes}{" "}
        crashes), crashed episodes had larger run-ups ({runChar.crash} vs {runChar.nocrash},
        permutation p = {runChar.p}) and higher trailing volatility ({volChar.crash} vs{" "}
        {volChar.nocrash}, p = {volChar.p}); acceleration and issuance still do not separate them. A
        pre-specified four-variable logit gives volatility t = {multi.t.vol} and run-up size
        t = {multi.t.run}, with an in-sample AUC of {multi.aucIn} and — the test that matters —{" "}
        <Em>{multi.aucLoo}</Em> leave-one-out. Modest, but better than the coin flip the first draft
        reported under the entry-anchored definition.
      </P>
      <Table>
        <Head><Th>Characteristic at episode start</Th><Th r>crashed</Th><Th r>did not</Th><Th r>perm. p</Th><Th r>odds ratio / σ</Th><Th r>logit p (yr-clustered)</Th></Head>
        <tbody>
          {gsy.chars.map((c) => (
            <tr key={c.key} className={`border-b border-rule ${["run", "vol"].includes(c.key) ? "bg-bg-sunken" : ""}`}>
              <td className="px-2 py-1 text-text">{c.label}</td>
              <td className="px-2 py-1 text-right"><Num value={c.crash} decimals={2} signed /></td>
              <td className="px-2 py-1 text-right"><Num value={c.nocrash} decimals={2} signed /></td>
              <td className={`px-2 py-1 text-right font-tabular ${c.p != null && c.p < 0.05 ? "text-text" : "text-text-dim"}`}>{c.p}</td>
              <td className="px-2 py-1 text-right font-tabular text-text">{c.or}</td>
              <td className="px-2 py-1 text-right font-tabular text-text-dim">{c.lp}</td>
            </tr>
          ))}
        </tbody>
      </Table>
      <Cap>Table 11. Baseline episodes (100% two-year + 50% five-year). Means by outcome in decimals (1.27 = 127%). Permutation p from 5,000 label shuffles. Four-variable logit (run-up, volatility, acceleration, issuance): in-sample AUC {multi.aucIn}, leave-one-out {multi.aucLoo}. Turnover and firm age, two of the attributes Greenwood-Shleifer-You use, need stock-level CRSP data and are not replicated here. Source: {KF}; {CALC}.</Cap>
      <P>
        Where does today's AI complex sit? Semiconductors ({chips.share}% of CRSP market value) peaked at
        a <Em>{chips.peak36}%</Em> two-year run-up within the last three years, {chips.peakNet36}% net of
        the market, and the June-2024 episode has since returned {sgn(chips24.f24)}% with a peak-to-trough
        drawdown of {mns(chips24.dd)}% — a qualifying episode that did not crash. The trailing run-up has
        cooled to {chips.run}%. Computer Software peaked at {softw.peak36}% and is now {sgn(softw.run)}%.
        The industry inside a live episode today is Computers: <Em>{hardw.run}% raw</Em>, {hardw.net}%
        net, accelerating ({sgn(hardw.accel)}pp), dated {hardwEp?.date}, {hardwEp?.months} months in.
        Its fitted crash probability from the Table 11 logit is {hardw.p}%, against the {tBase.crash}%
        unconditional episode rate — a number to hold loosely given an AUC of {multi.aucLoo}. Treat the
        Computers reading with care for a second reason: at {hardw.share}% of market value it is a small
        portfolio whose membership depends on CRSP's SIC assignment of the largest hardware names, so it
        is a thinner signal than the semiconductor one it is often conflated with. The
        dot-com precedent is the reason to care about definitions: Software's December-1998 episode fell{" "}
        {mns(softwEp.dd)}% from its peak (a crash) while ending the window only {mns(softwEp.f24)}% lower
        (not a crash by the entry-anchored rule), and semiconductors' 1999 episode fell{" "}
        {mns(chipsEp.dd)}% from peak.
      </P>
      <Figure n={7} title="Trailing 24-month industry return today: the run-up league table" source={`${KF}; ${CALC}. As of ${gsy.end}. Tags: net of market · peak 24m run-up within the last 36 months.`}>
        <BarH
          rows={gsy.now.slice(0, 12).map((x) => ({ label: ind(x.ind), value: x.run!, tag: `net ${sgn(x.net)} · pk ${x.peak36}` }))}
          unit="%" decimals={0} labelWidth={176} tagWidth={120} color={CYAN}
        />
      </Figure>
      <Table small>
        <Head><Th>Episode</Th><Th r>start</Th><Th r>2y run-up</Th><Th r>5y</Th><Th r>vol</Th><Th r>peak after</Th><Th r>max DD from peak</Th><Th r>24m return</Th><Th r>crash?</Th></Head>
        <tbody>
          {[...techEp, ...openEp.filter((e) => !["Chips", "Softw", "Hardw"].includes(e.ind))].map((e) => (
            <tr key={e.ind + e.date} className={`border-b border-rule ${e.open ? "bg-bg-sunken" : ""}`}>
              <td className="px-2 py-1 text-text">{ind(e.ind)}</td>
              <td className="px-2 py-1 text-right font-tabular text-text-dim">{e.date}</td>
              <td className="px-2 py-1 text-right font-tabular text-text">{e.run}%</td>
              <td className="px-2 py-1 text-right font-tabular text-text-faint">{e.run5}%</td>
              <td className="px-2 py-1 text-right font-tabular text-text-dim">{e.vol}%</td>
              <td className="px-2 py-1 text-right font-tabular text-text-dim">{sgn(e.peak)}%</td>
              <td className="px-2 py-1 text-right"><Pct v={e.dd} d={0} /></td>
              <td className="px-2 py-1 text-right">{e.open ? <span className="text-text-faint">{sgn(e.sofar)}% ({e.months}m, open)</span> : <Pct v={e.f24} d={0} />}</td>
              <td className={`px-2 py-1 text-right ${e.crash ? "text-neg" : "text-text-faint"}`}>{e.open ? "open" : e.crash ? "yes" : "no"}</td>
            </tr>
          ))}
        </tbody>
      </Table>
      <Cap>Table 12. Technology-industry episodes since 1990 (two-year filter, so live episodes appear) plus every episode still inside its 24-month window. Open episodes report the path so far. Source: {KF}; {CALC}.</Cap>

      {/* 09 */}
      <Section n="09" title="What this means for a portfolio" />
      <ul className="mb-4 ml-1 space-y-2 font-mono text-[13px] leading-[20px] text-text">
        {[
          <><span className="text-accent">Screen on the Business section, not the whole filing.</span> By 2026 {a26.share}% of large filers mention AI, but only {a26.bShare}% of AI words sit in Item 1. The Business-section sort is the version with post-ChatGPT alpha ({sgn(sp.AIXB.post!.alpha)}%/yr, t = {sp.AIXB.post!.tA}); the all-text sort is half boilerplate.</>,
          <><span className="text-accent">Do not assume the standard factor suite hedges this.</span> The published value and investment factors now contain the AI names; against styles rebuilt without them the long-short still earns {sgn(sp.exAI.full!.alpha)}%/yr. A “factor-neutral” AI book may be neutral to a benchmark that is itself long AI.</>,
          <><span className="text-accent">Size for breadth, not for the median multiple.</span> Effective breadth is about {dEffN.last} names, factor vol is at its sample high, and the cap-weighted valuation spread ({sgn(dValVW.last, 2)}) is nothing like the median firm's ({sgn(dValI.last, 2)}).</>,
          <><span className="text-accent">Treat the tail as fatter than base rates, and size accordingly.</span> A doubling raises the two-year crash probability to roughly {tBase.crash}% against {tBase.volMatched}% for equally volatile industries, without predictably lower average returns. That argues for lower risk budgets and explicit drawdown stress tests in the AI sleeve.</>,
          <><span className="text-accent">Watch core comovement; it is the one gauge at an extreme.</span> Monitor it as a state variable — it survives tech-matching and a volatility adjustment — but it is young, exploratory, and not yet shown to predict anything.</>,
        ].map((t, i) => (
          <li key={i} className="flex gap-2"><span className="text-accent">—</span><span>{t}</span></li>
        ))}
      </ul>
      <P>
        One recommendation from the first draft is withdrawn. It advised buying convexity — puts and
        collars — on the strength of the historical crash frequency. That does not follow. A physical
        crash probability says nothing about whether options are cheap; high-run-up, high-volatility
        industries carry elevated implied volatility and downside skew, and the market may already price
        a {tBase.crash}% two-year crash probability, or more. Comparing physical and risk-neutral tail
        probabilities needs option data this piece does not have. What the evidence supports is a
        position-sizing and stress-testing conclusion, not an options trade.
      </P>

      {/* 10 */}
      <Section n="10" title="Conclusion" />
      <P>
        The cleanest summary of this evidence is narrower than “AI is not a factor but is a crowd.” AI
        exposure behaves like a <em>concentrated style complex</em>: its returns load heavily on growth,
        size, investment and market beta, and those styles have themselves become partly synonymous with
        the trade, so the published factor suite can neither price it cleanly nor hedge it cleanly.
        There is not enough evidence for a distinct, priced AI premium in {aix.full!.n} months — but
        against styles rebuilt without AI names the residual is larger than the first draft implied, and
        the Business-section version of the signal is stronger still. The cohort's gains since ChatGPT
        came more from sales and margins than from multiple expansion, which is the opposite of what the
        first draft concluded from stale annual revenue. On crowding, the median AI firm is not
        expensive, the cap-weighted book is, breadth is about {dEffN.last} names, and since spring 2026
        the most AI-intensive names have begun to move together beyond what size, industry and a tech
        factor explain — a Lou-Polk signature, though ownership data, not return correlations, is what
        would prove it. Nothing here predicts the factor's returns, and the sample cannot: the one
        pattern that looked predictive was a Stambaugh artefact. What a century of industry data adds is
        the tail: doubling roughly doubles the probability of a 40% drawdown relative to equally volatile
        industries, and leaves the mean alone. For an allocator that is the operative fact — not because
        the AI trade is mispriced, but because its distribution is wider than the base rate implies, and
        one industry in the complex is inside a live episode as I write.
      </P>
      <P>
        Pre-specified and timestamped by this page's publication date, so later specification changes are
        auditable: (i) replace the dictionary with revenue-segment exposure from XBRL and re-run §03;
        (ii) add holdings-based crowding from the SEC 13F data sets — ownership breadth, overlap and
        common institutional ownership — which is the direct measure this piece approximates with return
        correlations; (iii) compare the §08 physical crash frequency with option-implied tail
        probabilities, the missing half of the §09 argument; (iv) re-test §07 in 2028, when the sample
        doubles.
      </P>

      {/* appendix */}
      <Section n="A" title="Data, method & limitations" />
      <div className="space-y-2 font-mono text-[11px] leading-[18px] text-text-dim">
        <p><span className="text-text-faint">Sources.</span> SEC EDGAR: company-ticker-exchange map; submissions API; {S.docs.toLocaleString()} 10-K primary documents filed 2015-01 → 2026-08 (median {S.medianWords.toLocaleString()} words), each also parsed into Item 1 and Item 1A ({S.secParsed}% parse rate); XBRL frames for dei:EntityPublicFloat, dei:EntityCommonStockSharesOutstanding, and quarterly/annual us-gaap revenue, operating income and net income. Revenue tags are taken in priority order (RevenueFromContractWithCustomerExcludingAssessedTax, then Revenues, then SalesRevenueNet) rather than by maximum, so gross and net definitions are not mixed. TTM series sum four quarters with a 60-day availability lag and impute a missing fourth quarter as annual minus the first three. Yahoo Finance: daily adjusted and split-adjusted closes plus split events for {S.tickersPriced.toLocaleString()} of {S.tickersWanted.toLocaleString()} tickers. Kenneth R. French Data Library ({gsy.end.replace("-", "")} CRSP build): FF5 and momentum (daily, monthly), FF3 from 1926, 49 industry portfolios (daily, monthly, firm counts, average size, BE/ME), SIC definitions.</p>
        <p><span className="text-text-faint">Data validation.</span> The value-weighted return of the {S.nUniverse?.toLocaleString()}-stock universe correlates <span className="text-text">{S.valCorr}</span> with the CRSP value-weighted market (beta {S.valBeta}, tracking error {S.valTE}%/yr, mean difference {sgn(S.valDiff)}%/yr). Floats: {S.floatVerifiedShare}% verified against price × shares; {S.floatFixed} filings rescaled for an exact 1,000× tagging error; {S.floatDropped + S.floatUnverifiedDropped} dropped. Monthly returns outside (−95%, +500%) and weekly outside (−90%, +300%) are treated as bad prints; preferred-stock ticker lines excluded.</p>
        <p><span className="text-text-faint">Portfolios.</span> Month-end sorts, next-month holding, float-value weights (cover-page float rolled forward on split-adjusted price). H and L as in eq. (3); top decile above the 90th percentile; the Business-section sort applies the same rule to Item 1 intensity; within-industry sorts inside each FF49 industry with ≥5 universe firms and aggregates by industry float. Ex-AI style factors (MKTx, SMBx, VALx, MOMx) are built from non-AI-leg stocks in the same universe: market excess, a median size split, a 30/70 price-to-sales value spread and a 12-1 momentum spread. They are proxies, not French-library replicas — there is no ex-AI RMW or CMA here, because operating profitability and asset growth are not in this data set.</p>
        <p><span className="text-text-faint">Inference.</span> Spanning: Newey-West HAC (lag {S.hac}); joint break test by Wald on alpha plus six interaction terms. Predictive tests: HAC at the horizon, p-values from {S.nullBoot?.toLocaleString()} Stambaugh-style null simulations, Romano-Wolf step-down across {predict.length} cells. Event study clusters by FF49 industry; group intervals are iid bootstraps. Core comovement: 4-week block bootstrap over weeks (400 resamples) at four pre-specified cutoffs, with a Forbes-Rigobon volatility adjustment reported alongside. Run-up statistics: calendar-year block bootstraps, because episodes cluster in time. Crowding z-scores are expanding-window; percentiles are full-sample.</p>
        <div className="my-3 overflow-x-auto border border-rule">
          <table className="w-full border-collapse font-mono text-[10px]">
            <Head><Th> </Th>{crowding.corr.labels.map((l) => <Th key={l} r>{l}</Th>)}</Head>
            <tbody>
              {crowding.corr.m.map((row, i) => (
                <tr key={i} className="border-b border-rule">
                  <td className="px-2 py-1 text-text">{crowding.corr.labels[i]}</td>
                  {row.map((v, j) => (
                    <td key={j} className={`px-2 py-1 text-right font-tabular ${i === j ? "text-text-faint" : Math.abs(v) >= 0.5 ? "text-text" : "text-text-dim"}`}>{fx(v, 2)}</td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="text-[10px] text-text-faint">Table 13. Correlation of the four composite legs (n = {crowding.corr.n} months). The strong negative correlations are why the equal-weight mean of the four z-scores has a standard deviation of only {S.crowdRawSd}, and why the composite is re-standardized before being quoted in σ.</p>
        <p><span className="text-text-faint">Limitations.</span> (1) Survivorship. The text universe contains only firms listed today. The 0.998 CRSP correlation shows the aggregate value-weighted index is close to the real one, but it does <em>not</em> bound survivorship bias in characteristic-sorted long-shorts, which distort if failed firms sat systematically on one side of the signal; equal-weighted results are the most exposed. A CRSP-linked rebuild is the fix. (2) Foreign private issuers file 20-F, so TSMC and ASML are absent. (3) SIC codes are sticky and self-reported; Hoberg-Phillips text-based industries would be better. (4) The dictionary cannot separate selling AI from using or fearing it; the section split is a partial remedy, and exposure updates only annually. (5) Valuation covers {crowding.valCov}% of universe firms and price-to-sales is weakly comparable across banks, retailers and software even after industry adjustment. (6) The core-comovement cutoff was chosen after seeing the broad-leg result; Table 8's grid is the honest presentation. (7) Industry portfolios lack turnover and firm age. (8) Concentration measures market structure as much as AI crowding; holdings data is the right instrument. Reproducible via <code className="text-text-dim">analysis/ai_crowding.py</code> (first run downloads ~22,000 filings twice — once for totals, once for sections — at EDGAR's fair-access rate).</p>
        <p><span className="text-text-faint">References.</span> Babina, T., A. Fedyk, A. He &amp; J. Hodson (2024), “Artificial Intelligence, Firm Growth, and Product Innovation,” <em>JFE</em>. Barberis, N., A. Shleifer &amp; J. Wurgler (2005), “Comovement,” <em>JFE</em>. Brown, G., T. Howard &amp; C. Lundblad (2022), “Crowded Trades and Tail Risk,” <em>RFS</em>. Carhart, M. (1997), <em>JF</em>. Cohen, L., C. Malloy &amp; Q. Nguyen (2020), “Lazy Prices,” <em>JF</em>. Eisfeldt, A., G. Schubert &amp; M. B. Zhang (2023), “Generative AI and Firm Values,” NBER WP 31222. Fama, E. &amp; K. French (2015), <em>JFE</em>. Forbes, K. &amp; R. Rigobon (2002), “No Contagion, Only Interdependence,” <em>JF</em>. Greenwood, R., A. Shleifer &amp; Y. You (2019), “Bubbles for Fama,” <em>JFE</em>. Hoberg, G. &amp; G. Phillips (2016), “Text-Based Network Industries,” <em>JPE</em>. Lou, D. &amp; C. Polk (2022), “Comomentum,” <em>RFS</em>. Loughran, T. &amp; B. McDonald (2011), <em>JF</em>. Newey, W. &amp; K. West (1987), <em>Econometrica</em>. Romano, J. &amp; M. Wolf (2005), “Stepwise Multiple Testing as Formalized Data Snooping,” <em>Econometrica</em>. Stambaugh, R. (1999), “Predictive Regressions,” <em>JFE</em>. Stein, J. (2009), <em>JF</em>.</p>
        <p className="pt-1 text-text-faint">This is research, not investment advice.</p>
      </div>
    </article>
  );
}
