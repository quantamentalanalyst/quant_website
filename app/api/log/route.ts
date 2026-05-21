// Research log feed — interleaves recent GitHub commits with recent content additions.
// Unauthenticated GitHub events API (60 req/hr/IP). Caches 5 minutes.

import { NextResponse } from "next/server";
import { unstable_cache } from "next/cache";
import { getAllResearch, getAllNotes } from "@/lib/content";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Entry = { kind: "commit" | "content"; when: string; text: string; href?: string };

async function fetchGhEvents(handle: string): Promise<Entry[]> {
  if (!handle) return [];
  try {
    const res = await fetch(`https://api.github.com/users/${encodeURIComponent(handle)}/events/public`, {
      headers: { "User-Agent": "quantamental-site", Accept: "application/vnd.github+json" },
      next: { revalidate: 300 },
    });
    if (!res.ok) return [];
    const events = (await res.json()) as Array<{
      type: string;
      created_at: string;
      repo: { name: string };
      payload: { commits?: Array<{ sha: string; message: string }> };
    }>;
    const entries: Entry[] = [];
    for (const e of events) {
      if (e.type === "PushEvent" && e.payload?.commits) {
        for (const c of e.payload.commits.slice(0, 1)) {
          entries.push({
            kind: "commit",
            when: e.created_at.slice(0, 16).replace("T", " "),
            text: `${e.repo.name.split("/").pop()} · ${c.message.split("\n")[0]!.slice(0, 80)}`,
            href: `https://github.com/${e.repo.name}/commit/${c.sha}`,
          });
        }
      }
    }
    return entries.slice(0, 10);
  } catch {
    return [];
  }
}

async function fetchContent(): Promise<Entry[]> {
  const [research, notes] = await Promise.all([getAllResearch(), getAllNotes()]);
  return [
    ...research.slice(0, 4).map((r) => ({
      kind: "content" as const,
      when: r.date,
      text: r.title,
      href: `/research/${r.slug}`,
    })),
    ...notes.slice(0, 4).map((n) => ({
      kind: "content" as const,
      when: n.date,
      text: n.title,
      href: `/notes/${n.slug}`,
    })),
  ];
}

const buildFeed = (handle: string) =>
  unstable_cache(
    async () => {
      const [commits, content] = await Promise.all([fetchGhEvents(handle), fetchContent()]);
      const all = [...commits, ...content];
      all.sort((a, b) => b.when.localeCompare(a.when));
      return { entries: all.slice(0, 15) };
    },
    ["research-log", handle || "no-gh"],
    { revalidate: 300, tags: ["log"] },
  );

export async function GET(req: Request) {
  const url = new URL(req.url);
  const gh = url.searchParams.get("gh") ?? "";
  const data = await buildFeed(gh)();
  return NextResponse.json(data, {
    headers: { "Cache-Control": "public, max-age=0, s-maxage=300, stale-while-revalidate=3600" },
  });
}
