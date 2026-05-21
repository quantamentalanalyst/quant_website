import { site } from "@/lib/site";
import Clock from "./Clock";
import TickerStrip from "./TickerStrip";

export default function StatusBar() {
  return (
    <header className="border-b border-rule bg-bg-sunken">
      <div className="mx-auto flex h-7 max-w-[1408px] items-center justify-between gap-6 px-6 text-xs">
        <div className="flex min-w-0 items-center gap-2.5 text-text-dim">
          <span className="text-text">{site.name}</span>
          <span className="text-text-faint">·</span>
          <span>{site.role}</span>
          <span className="text-text-faint">·</span>
          <span>{site.location}</span>
          <span className="text-text-faint">·</span>
          <Clock />
        </div>
        <TickerStrip />
      </div>
    </header>
  );
}
