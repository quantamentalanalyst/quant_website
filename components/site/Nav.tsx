"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { site } from "@/lib/site";

// Bloomberg-terminal-style nav:
//   [ AMBER IDENTITY BADGE ]  [ red tab ][ red tab ][ red tab ][ red tab ]   ⌘K
// Tabs cluster flush together (1px gap shows the bg through, like Bloomberg's
// function-button bank). Routes under the hood unchanged.
const tabs = [
  { label: "Bio", href: "/bio" as const },
  { label: "Research", href: "/research" as const },
  { label: "News", href: "/notes" as const },
  { label: "Interests", href: "/bookshelf" as const },
];

// Bloomberg's function-button palette — a deep, slightly desaturated red.
// Hover/active is a half-step brighter so the affordance is real but subtle.
const TAB_BG = "#8b1f1f";
const TAB_BG_ACTIVE = "#b03030";

export default function Nav() {
  const path = usePathname() || "/";
  const firstName = site.name.split(/\s+/)[0]!.toUpperCase();
  const badge = `${firstName} US EQUITY`;

  return (
    <nav className="border-b border-rule">
      <div className="mx-auto flex h-8 max-w-[1408px] items-stretch px-6 text-xs">
        <Link
          href="/"
          aria-label="home"
          className="inline-flex h-full items-center bg-accent px-3 font-medium uppercase tracking-[0.08em] text-bg no-underline hover:bg-accent-dim"
        >
          {badge}
        </Link>

        <div className="flex h-full gap-px">
          {tabs.map(({ label, href }) => {
            const active = path === href || path.startsWith(href + "/");
            return (
              <Link
                key={href}
                href={href}
                style={{ backgroundColor: active ? TAB_BG_ACTIVE : TAB_BG }}
                className="inline-flex h-full items-center px-3 text-white no-underline transition-colors duration-75 hover:[background-color:var(--tab-hover)]"
                onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = TAB_BG_ACTIVE)}
                onMouseLeave={(e) =>
                  (e.currentTarget.style.backgroundColor = active ? TAB_BG_ACTIVE : TAB_BG)
                }
              >
                {label}
              </Link>
            );
          })}
        </div>

        <span className="ml-auto inline-flex items-center text-text-faint">
          <kbd className="border border-rule-strong px-1 py-px font-mono text-[10px]">⌘K</kbd>
        </span>
      </div>
    </nav>
  );
}
