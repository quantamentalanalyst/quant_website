import SectionBar from "@/components/ui/SectionBar";

export const metadata = { title: "interests" };

// /bookshelf — the "Interests" tab. Bloomberg-content style: amber section bar,
// a category dateline, mono terminal prose.
export default function Interests() {
  return (
    <div className="mx-auto max-w-[760px] pb-16">
      <SectionBar>interests</SectionBar>

      <div className="mt-5 flex items-center gap-2 border-b border-rule pb-2 text-[10px]">
        <span className="section-label text-data">NBA · quant sports analytics</span>
        <span className="ml-auto font-tabular text-text-faint">coming soon</span>
      </div>

      <div className="mt-5 max-w-[66ch] font-mono text-[13px] leading-[22px] text-text">
        <p>
          I&apos;ll be sharing quantitative NBA analytics and insights into how I&apos;m building a
          quantitative valuation engine to identify undervalued players for fantasy basketball.
        </p>
        <p className="mt-4 text-accent">
          Stay tuned.<span className="ml-1 inline-block w-[7px] animate-pulse text-accent">▍</span>
        </p>
      </div>
    </div>
  );
}
