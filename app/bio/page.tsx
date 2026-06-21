import SectionLabel from "@/components/ui/SectionLabel";
import IndicesBoard from "@/components/home/IndicesBoard";
import { site } from "@/lib/site";

export const metadata = { title: "us equity" };

// /bio — now renders the Anthony US Equity dashboard (WEI board). Content
// swapped with the home route; the route itself is unchanged.
export default function BioPage() {
  return (
    <div className="grid grid-cols-12 gap-5">
      <section className="col-span-12">
        <SectionLabel>{site.homepage.indices.label}</SectionLabel>
        <IndicesBoard />
        <div className="mt-3 border-t border-rule pt-2 text-[10px] text-text-faint">
          <span>live · Yahoo Finance · index points, native currency · quotes may be delayed</span>
        </div>
      </section>
    </div>
  );
}
