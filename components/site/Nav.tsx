"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { site } from "@/lib/site";

const routes = [
  { label: "research", href: "/research" },
  { label: "backtests", href: "/backtests" },
  { label: "notes", href: "/notes" },
  { label: "bio", href: "/bio" },
  { label: "now", href: "/now" },
  { label: "books", href: "/bookshelf" },
] as const;

export default function Nav() {
  const path = usePathname() || "/";
  return (
    <nav className="border-b border-rule">
      <div className="mx-auto flex h-8 max-w-[1408px] items-center gap-4 px-6 text-xs">
        <Link
          href="/"
          className={`no-underline ${path === "/" ? "text-accent" : "text-text-dim hover:text-text"}`}
          aria-label="home"
        >
          {site.name.toLowerCase().replace(/\s+/g, ".")}
        </Link>
        <span className="text-rule-strong">|</span>
        {routes.map(({ label, href }) => {
          const active = path === href || path.startsWith(href + "/");
          return (
            <Link
              key={href}
              href={href}
              className={`no-underline ${active ? "text-accent" : "text-text-dim hover:text-text"}`}
            >
              [ {label} ]
            </Link>
          );
        })}
        <span className="ml-auto text-text-faint">
          <kbd className="border border-rule-strong px-1 py-px font-mono text-[10px]">⌘K</kbd>
        </span>
      </div>
    </nav>
  );
}
