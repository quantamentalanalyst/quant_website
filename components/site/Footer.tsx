import ResearchLogTicker from "./ResearchLogTicker";
import { site } from "@/lib/site";

export default function Footer() {
  return (
    <footer className="border-t border-rule bg-bg-sunken">
      <div className="mx-auto flex h-7 max-w-[1408px] items-center gap-3 px-6 text-xs">
        <span className="shrink-0 text-text-faint">log</span>
        <span className="shrink-0 text-rule-strong">|</span>
        <ResearchLogTicker handle={site.handles.github} />
      </div>
      <div className="border-t border-rule">
        <div className="mx-auto flex h-7 max-w-[1408px] items-center justify-between gap-3 px-6 text-[11px] text-text-faint">
          <span>© {new Date().getFullYear()} {site.name}</span>
          <span className="flex gap-3">
            {site.email && <a href={`mailto:${site.email}`} className="no-underline hover:text-accent">email</a>}
            {site.handles.github && <a href={`https://github.com/${site.handles.github}`} className="no-underline hover:text-accent">github</a>}
            {site.handles.twitter && <a href={`https://x.com/${site.handles.twitter}`} className="no-underline hover:text-accent">x</a>}
            {site.handles.linkedin && <a href={`https://www.linkedin.com/in/${site.handles.linkedin}`} className="no-underline hover:text-accent">linkedin</a>}
            {site.handles.ssrn && <a href={`https://papers.ssrn.com/sol3/cf_dev/AbsByAuth.cfm?per_id=${site.handles.ssrn}`} className="no-underline hover:text-accent">ssrn</a>}
            <span>·</span>
            <span>built in the open</span>
          </span>
        </div>
      </div>
    </footer>
  );
}
