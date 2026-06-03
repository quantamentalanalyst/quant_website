import { getNow } from "@/lib/content";

export const metadata = { title: "now" };

export default async function Now() {
  const n = await getNow();
  return (
    <div className="max-w-2xl text-[13px]">
      <h1 className="mb-4 text-2xl">Now</h1>
      <Block label="building / writing" items={n.building} />
      <Block label="studying" items={n.studying} />
      <Block label="reading" items={n.reading} />
      <Block label="thinking about" items={n.thinking} />
      <div className="mt-6 border-t border-rule pt-3 text-[10px] text-text-faint">
        updated <span className="font-tabular">{n.updated}</span>
      </div>
    </div>
  );
}

function Block({ label, items }: { label: string; items: string[] }) {
  if (items.length === 0) return null;
  return (
    <div className="mb-4">
      <div className="section-label mb-1.5 text-text-faint">{label}</div>
      <ul className="space-y-1 text-text-dim">
        {items.map((i, k) => (
          <li key={k} className="flex gap-2"><span className="text-text-faint">·</span><span>{i}</span></li>
        ))}
      </ul>
    </div>
  );
}
