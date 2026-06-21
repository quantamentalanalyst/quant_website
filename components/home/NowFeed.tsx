import { getNow } from "@/lib/content";

export default async function NowFeed() {
  const now = await getNow();
  return (
    <div className="space-y-4 font-mono text-[13px] leading-[22px] text-text">
      <Block label="building / writing" items={now.building} />
      <Block label="studying" items={now.studying} />
      <Block label="reading" items={now.reading} />
      <Block label="thinking about" items={now.thinking} />
      <div className="border-t border-rule pt-3 text-[10px] text-text-faint">
        updated <span className="font-tabular">{now.updated}</span>
      </div>
    </div>
  );
}

function Block({ label, items }: { label: string; items: string[] }) {
  if (items.length === 0) return null;
  return (
    <div>
      <div className="section-label mb-1.5 text-text-faint">{label}</div>
      <ul className="space-y-1 text-text">
        {items.map((item, i) => (
          <li key={i} className="flex gap-2 leading-[22px]">
            <span className="shrink-0 text-text-faint">·</span>
            <span>{item}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
