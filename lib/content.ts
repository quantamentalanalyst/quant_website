import fs from "node:fs/promises";
import path from "node:path";
import matter from "gray-matter";

const CONTENT_DIR = path.join(process.cwd(), "content");

export type ResearchMeta = {
  slug: string;
  title: string;
  date: string;
  abstract: string;
  tags: string[];
  driver?: string; // profit | rates | sentiment | macro
  status?: "published" | "draft";
  readingTime?: number; // minutes
  links?: { pdf?: string; code?: string; ssrn?: string; data?: string };
};

export type NoteMeta = {
  slug: string;
  title: string;
  date: string;
  tags: string[];
  excerpt?: string;
};

async function readMdxDir<T>(
  subdir: string,
  map: (data: Record<string, unknown>, slug: string, body: string) => T,
): Promise<T[]> {
  const dir = path.join(CONTENT_DIR, subdir);
  let files: string[] = [];
  try {
    files = await fs.readdir(dir);
  } catch {
    return [];
  }
  const entries = await Promise.all(
    files
      .filter((f) => f.endsWith(".mdx"))
      .map(async (f) => {
        const raw = await fs.readFile(path.join(dir, f), "utf8");
        const { data, content } = matter(raw);
        return map(data, f.replace(/\.mdx$/, ""), content);
      }),
  );
  return entries;
}

export async function getAllResearch(): Promise<ResearchMeta[]> {
  const entries = await readMdxDir<ResearchMeta>("research", (data, slug) => ({
    slug,
    title: String(data.title ?? slug),
    date: typeof data.date === "string" ? data.date : String(data.date ?? "").slice(0, 10),
    abstract: String(data.abstract ?? ""),
    tags: Array.isArray(data.tags) ? (data.tags as string[]) : [],
    driver: data.driver ? String(data.driver) : undefined,
    status: data.status === "draft" ? "draft" : "published",
    readingTime: typeof data.readingTime === "number" ? data.readingTime : undefined,
    links: (data.links as ResearchMeta["links"]) ?? undefined,
  }));
  return entries.sort((a, b) => b.date.localeCompare(a.date));
}

export async function getAllNotes(): Promise<NoteMeta[]> {
  const entries = await readMdxDir<NoteMeta>("notes", (data, slug, body) => ({
    slug,
    title: String(data.title ?? slug),
    date: String(data.date ?? ""),
    tags: Array.isArray(data.tags) ? (data.tags as string[]) : [],
    excerpt: body.split("\n").find((l) => l.trim().length > 0) ?? "",
  }));
  return entries.sort((a, b) => b.date.localeCompare(a.date));
}

export type NowData = {
  updated: string;
  building: string[];
  studying: string[];
  reading: string[];
  thinking: string[];
  body: string;
};

export async function getNow(): Promise<NowData> {
  const raw = await fs.readFile(path.join(CONTENT_DIR, "now.mdx"), "utf8");
  const { data, content } = matter(raw);
  return {
    // YAML parses an unquoted `updated: 2026-05-21` as a Date; normalize to a
    // plain YYYY-MM-DD so we never render the time/timezone tail.
    updated:
      data.updated instanceof Date
        ? data.updated.toISOString().slice(0, 10)
        : String(data.updated ?? "").slice(0, 10),
    building: Array.isArray(data.building) ? (data.building as string[]) : [],
    studying: Array.isArray(data.studying) ? (data.studying as string[]) : [],
    reading: Array.isArray(data.reading) ? (data.reading as string[]) : [],
    thinking: Array.isArray(data.thinking_about) ? (data.thinking_about as string[]) : [],
    body: content,
  };
}
