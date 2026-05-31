import ResearchLogTicker from "./ResearchLogTicker";
import { site } from "@/lib/site";

export default function Footer() {
  // Contact links in a fixed display order, dot-separated. Email first (mailto),
  // then external profiles (new tab). Add X/SSRN here if those handles get set.
  const links = [
    site.email && { label: "Email", href: `mailto:${site.email}`, external: false },
    site.handles.linkedin && {
      label: "LinkedIn",
      href: `https://www.linkedin.com/in/${site.handles.linkedin}/`,
      external: true,
    },
    site.handles.github && {
      label: "GitHub",
      href: `https://github.com/${site.handles.github}`,
      external: true,
    },
    site.handles.twitter && {
      label: "X",
      href: `https://x.com/${site.handles.twitter}`,
      external: true,
    },
    site.handles.ssrn && {
      label: "SSRN",
      href: `https://papers.ssrn.com/sol3/cf_dev/AbsByAuth.cfm?per_id=${site.handles.ssrn}`,
      external: true,
    },
  ].filter(Boolean) as { label: string; href: string; external: boolean }[];

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
          <span className="flex items-center gap-2">
            {links.map((l, i) => (
              <span key={l.label} className="flex items-center gap-2">
                {i > 0 && <span className="text-rule-strong">·</span>}
                <a
                  href={l.href}
                  {...(l.external ? { target: "_blank", rel: "noopener noreferrer" } : {})}
                  className="no-underline hover:text-accent-dim"
                >
                  {l.label}
                </a>
              </span>
            ))}
          </span>
        </div>
      </div>
    </footer>
  );
}
