import Link from "next/link";
import { notFound } from "next/navigation";
import { getAllResearch } from "@/lib/content";
import EquityDurationArticle from "@/components/research/EquityDurationArticle";
import ProfitDuPontArticle from "@/components/research/ProfitDuPontArticle";
import MacroRegimeArticle from "@/components/research/MacroRegimeArticle";

export async function generateStaticParams() {
  const items = await getAllResearch();
  return items.map((r) => ({ slug: r.slug }));
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const meta = (await getAllResearch()).find((r) => r.slug === slug);
  return meta ? { title: meta.title, description: meta.abstract } : {};
}

export default async function ResearchArticle({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const meta = (await getAllResearch()).find((r) => r.slug === slug);
  if (!meta) notFound();

  return (
    <div>
      <Link
        href="/research"
        className="mb-4 inline-block font-mono text-[11px] text-text-dim no-underline hover:text-accent"
      >
        ← research
      </Link>

      {slug === "2026-02-01-equity-duration" ? (
        <EquityDurationArticle meta={meta} />
      ) : slug === "2026-04-15-profit-dupont" ? (
        <ProfitDuPontArticle meta={meta} />
      ) : slug === "2026-04-15-macro-regime" ? (
        <MacroRegimeArticle meta={meta} />
      ) : (
        // Draft fallback for entries without a full data-bound article yet.
        <article className="mx-auto max-w-[760px] pb-16">
          <header className="border-b border-rule-strong pb-5">
            <div className="mb-3 flex items-center gap-3 text-[10px] text-text-faint">
              {meta.driver && (
                <span className="bg-accent px-1.5 py-0.5 font-medium uppercase tracking-[0.1em] text-bg">
                  driver · {meta.driver}
                </span>
              )}
              <span className="font-tabular">{meta.date}</span>
              <span>· draft</span>
            </div>
            <h1 className="text-[24px] leading-[1.15] text-text">{meta.title}</h1>
            <p className="mt-4 font-mono text-[13px] leading-[22px] text-text-dim">{meta.abstract}</p>
          </header>
          <p className="mt-6 font-mono text-[12px] text-text-faint">Full text in preparation.</p>
        </article>
      )}
    </div>
  );
}
