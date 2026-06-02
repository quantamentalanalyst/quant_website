"use client";
import { useMemo, useState } from "react";
import Link from "next/link";
import type { ResearchMeta } from "@/lib/content";

// Terminal-style research screener: a tag filter (checkboxes + inline counts,
// AND semantics) and a driver filter on the right; a dense entry list on the
// left. Sort by date or title.
export default function Screener({ items }: { items: ResearchMeta[] }) {
  const [tags, setTags] = useState<Set<string>>(new Set());
  const [driver, setDriver] = useState<string | null>(null);
  const [sort, setSort] = useState<"date" | "title">("date");

  const tagCounts = useMemo(() => {
    const m = new Map<string, number>();
    for (const it of items) for (const t of it.tags) m.set(t, (m.get(t) ?? 0) + 1);
    return [...m.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]));
  }, [items]);

  const driverCounts = useMemo(() => {
    const m = new Map<string, number>();
    for (const it of items) if (it.driver) m.set(it.driver, (m.get(it.driver) ?? 0) + 1);
    return [...m.entries()].sort((a, b) => a[0].localeCompare(b[0]));
  }, [items]);

  const filtered = useMemo(() => {
    let r = items.filter(
      (it) =>
        (tags.size === 0 || [...tags].every((t) => it.tags.includes(t))) &&
        (driver === null || it.driver === driver),
    );
    r = [...r].sort((a, b) =>
      sort === "date" ? b.date.localeCompare(a.date) : a.title.localeCompare(b.title),
    );
    return r;
  }, [items, tags, driver, sort]);

  const toggle = (t: string) =>
    setTags((prev) => {
      const n = new Set(prev);
      n.has(t) ? n.delete(t) : n.add(t);
      return n;
    });

  return (
    <div className="grid grid-cols-12 gap-6">
      {/* List */}
      <div className="col-span-12 md:col-span-9">
        <div className="mb-2 flex items-center justify-between border-b border-rule pb-1.5 text-[10px] text-text-faint">
          <span className="section-label">
            {filtered.length} / {items.length} entries
          </span>
          <span className="flex items-center gap-2">
            sort
            <button onClick={() => setSort("date")} className={sort === "date" ? "text-accent" : "hover:text-text"}>date</button>
            <span className="text-rule-strong">/</span>
            <button onClick={() => setSort("title")} className={sort === "title" ? "text-accent" : "hover:text-text"}>title</button>
          </span>
        </div>

        <ul className="divide-y divide-rule">
          {filtered.map((r) => (
            <li key={r.slug} className="py-4">
              <Link href={`/research/${r.slug}`} className="group block no-underline">
                <div className="flex items-baseline gap-3">
                  <span className="w-[78px] shrink-0 font-tabular text-[11px] text-text-faint">{r.date}</span>
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      {r.driver && (
                        <span className="shrink-0 bg-accent/90 px-1 py-px text-[9px] font-medium uppercase tracking-[0.08em] text-bg">
                          {r.driver}
                        </span>
                      )}
                      {r.status === "draft" && (
                        <span className="shrink-0 border border-rule-strong px-1 py-px text-[9px] uppercase text-text-faint">draft</span>
                      )}
                      <span className="font-mono text-[14px] leading-[20px] text-text group-hover:text-accent">{r.title}</span>
                    </div>
                    <p className="mt-1 font-mono text-[12px] leading-[19px] text-text-dim">{r.abstract}</p>
                    <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-[10px] text-text-faint">
                      {r.readingTime && <span className="font-tabular">{r.readingTime} min</span>}
                      {r.tags.map((t) => (
                        <span key={t}>#{t}</span>
                      ))}
                    </div>
                  </div>
                </div>
              </Link>
            </li>
          ))}
          {filtered.length === 0 && (
            <li className="py-6 font-mono text-[12px] text-text-faint">no entries match the current filter.</li>
          )}
        </ul>
      </div>

      {/* Filter sidebar */}
      <aside className="col-span-12 md:col-span-3 md:border-l md:border-rule md:pl-5">
        <div className="section-label mb-2 text-text-dim">driver</div>
        <ul className="mb-5 space-y-1 font-mono text-[12px]">
          <li>
            <button onClick={() => setDriver(null)} className="flex w-full items-center gap-2 text-left no-underline">
              <span className="text-accent">{driver === null ? "[x]" : "[ ]"}</span>
              <span className={driver === null ? "text-text" : "text-text-dim hover:text-text"}>all</span>
            </button>
          </li>
          {driverCounts.map(([d, c]) => (
            <li key={d}>
              <button onClick={() => setDriver(driver === d ? null : d)} className="flex w-full items-center gap-2 text-left no-underline">
                <span className="text-accent">{driver === d ? "[x]" : "[ ]"}</span>
                <span className={driver === d ? "text-text" : "text-text-dim hover:text-text"}>{d}</span>
                <span className="ml-auto font-tabular text-text-faint">({c})</span>
              </button>
            </li>
          ))}
        </ul>

        <div className="section-label mb-2 text-text-dim">tags</div>
        <ul className="space-y-1 font-mono text-[12px]">
          {tagCounts.map(([t, c]) => {
            const on = tags.has(t);
            return (
              <li key={t}>
                <button onClick={() => toggle(t)} className="flex w-full items-center gap-2 text-left no-underline">
                  <span className="text-accent">{on ? "[x]" : "[ ]"}</span>
                  <span className={on ? "text-text" : "text-text-dim hover:text-text"}>#{t}</span>
                  <span className="ml-auto font-tabular text-text-faint">({c})</span>
                </button>
              </li>
            );
          })}
        </ul>

        {(tags.size > 0 || driver !== null) && (
          <button
            onClick={() => { setTags(new Set()); setDriver(null); }}
            className="mt-4 font-mono text-[11px] text-text-faint underline-offset-2 hover:text-accent"
          >
            clear filters
          </button>
        )}
      </aside>
    </div>
  );
}
