import { site } from "@/lib/site";
import Clock from "./Clock";

// Top status bar — identity + location + live clock only.
// (Live market data lives in the homepage WEI board; the old TickerStrip
// component is retained in ./TickerStrip but no longer mounted here.)
export default function StatusBar() {
  return (
    <header className="border-b border-rule bg-bg-sunken">
      <div className="mx-auto flex h-7 max-w-[1408px] items-center gap-2.5 px-6 text-xs text-text-dim">
        <span className="text-text">{site.role}</span>
        <span className="text-text-faint">·</span>
        <span>{site.location}</span>
        <span className="text-text-faint">·</span>
        <Clock />
      </div>
    </header>
  );
}
