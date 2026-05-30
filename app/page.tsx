import SectionLabel from "@/components/ui/SectionLabel";
import LatestNotes from "@/components/home/LatestNotes";
import IndicesBoard from "@/components/home/IndicesBoard";
import NowFeed from "@/components/home/NowFeed";
import { getAllResearch } from "@/lib/content";
import { site } from "@/lib/site";

export default async function HomePage() {
  const notes = await getAllResearch();

  return (
    <div className="grid grid-cols-12 gap-5">
      <section className="col-span-12 md:col-span-3 md:border-r md:border-rule md:pr-5">
        <SectionLabel>latest notes</SectionLabel>
        <LatestNotes notes={notes.slice(0, 5)} />
      </section>

      <section className="col-span-12 md:col-span-6">
        <SectionLabel>{site.homepage.indices.label}</SectionLabel>
        <IndicesBoard />
        <div className="mt-3 border-t border-rule pt-2 text-[10px] text-text-faint">
          <span>live · Yahoo Finance · index points, native currency · quotes may be delayed</span>
        </div>
      </section>

      <section className="col-span-12 md:col-span-3 md:border-l md:border-rule md:pl-5">
        <SectionLabel>now</SectionLabel>
        <NowFeed />
      </section>
    </div>
  );
}
