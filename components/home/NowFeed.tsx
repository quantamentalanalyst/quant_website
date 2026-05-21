import { getNow } from "@/lib/content";

export default async function NowFeed() {
  const now = await getNow();
  return (
    <div className="space-y-4 text-[13px]">
      <Block label="reading" items={now.reading} />
      <Block label="building" items={now.building} />
      <Block label="thinking about" items={now.thinking} />
      {now.listening.length > 0 && <Block label="listening" items={now.listening} />}
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
      <ul className="space-y-1 text-text-dim">
        {items.map((item, i) => (
          <li key={i} className="flex gap-2 leading-snug">
            <span className="shrink-0 text-text-faint">·</span>
            <span>{item}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
