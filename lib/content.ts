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
    date: String(data.date ?? ""),
    abstract: String(data.abstract ?? ""),
    tags: Array.isArray(data.tags) ? (data.tags as string[]) : [],
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
  reading: string[];
  building: string[];
  thinking: string[];
  listening: string[];
  body: string;
};

export async function getNow(): Promise<NowData> {
  const raw = await fs.readFile(path.join(CONTENT_DIR, "now.mdx"), "utf8");
  const { data, content } = matter(raw);
  return {
    updated: String(data.updated ?? ""),
    reading: Array.isArray(data.reading) ? (data.reading as string[]) : [],
    building: Array.isArray(data.building) ? (data.building as string[]) : [],
    thinking: Array.isArray(data.thinking_about) ? (data.thinking_about as string[]) : [],
    listening: Array.isArray(data.listening) ? (data.listening as string[]) : [],
    body: content,
  };
}
