import { getAllResearch } from "@/lib/content";
import Screener from "@/components/research/Screener";

export const metadata = { title: "research" };

export default async function ResearchIndex() {
  const items = await getAllResearch();
  return (
    <div className="pb-12">
      <Screener items={items} />
    </div>
  );
}
