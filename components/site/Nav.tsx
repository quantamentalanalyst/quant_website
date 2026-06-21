"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { site } from "@/lib/site";

// Bloomberg-terminal-style nav — five equal-width cells across the full row.
//   [ AMBER IDENTITY BADGE ][ red tab ][ red tab ][ red tab ][ red tab ]
// Cells flush-connected with a 1px gap that lets the page bg show through,
// matching Bloomberg's function-button bank. Routes under the hood unchanged.
// (⌘K hint will return in phase 6 with the command palette.)
const tabs = [
  { label: "Market", href: "/bio" as const },
  { label: "Research", href: "/research" as const },
  { label: "Life Journey", href: "/notes" as const },
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
      <div className="mx-auto flex h-9 max-w-[1408px] items-stretch gap-px px-6 text-base">
        <Link
          href="/"
          aria-label="home"
          className="inline-flex h-full flex-1 items-center justify-center whitespace-nowrap bg-accent px-3 text-sm font-medium uppercase tracking-[0.04em] text-bg no-underline hover:bg-accent-dim"
        >
          {badge}
        </Link>
        {tabs.map(({ label, href }) => {
          const active = path === href || path.startsWith(href + "/");
          return (
            <Link
              key={href}
              href={href}
              style={{ backgroundColor: active ? TAB_BG_ACTIVE : TAB_BG }}
              className="inline-flex h-full flex-1 items-center justify-center whitespace-nowrap px-3 text-white no-underline transition-colors duration-75"
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
    </nav>
  );
}
