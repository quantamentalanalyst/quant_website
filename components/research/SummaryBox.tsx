import Link from "next/link";

// Bloomberg-style summary block that opens every research article: a ruled
// box, three bullets, amber body text, blue hyperlinks.
//
// Bullets come from the `summary:` list in each article's MDX frontmatter and
// may contain markdown links — [label](/research/slug) or [label](https://…) —
// which render in link blue. Keeping them in frontmatter means the summary
// travels with the content rather than being duplicated in the component.

const LINK = /\[([^\]]+)\]\(([^)\s]+)\)/g;

function withLinks(text: string, key: string) {
  const out: React.ReactNode[] = [];
  let last = 0;
  for (const m of text.matchAll(LINK)) {
    const at = m.index ?? 0;
    if (at > last) out.push(text.slice(last, at));
    const [, label, href] = m;
    const external = /^https?:/.test(href!);
    out.push(
      external ? (
        <a key={`${key}-${at}`} href={href} target="_blank" rel="noopener noreferrer" className="text-link no-underline hover:opacity-80">
          {label}
        </a>
      ) : (
        <Link key={`${key}-${at}`} href={href!} className="text-link no-underline hover:opacity-80">
          {label}
        </Link>
      ),
    );
    last = at + m[0].length;
  }
  if (last < text.length) out.push(text.slice(last));
  return out;
}

export default function SummaryBox({ items }: { items?: string[] }) {
  if (!items || items.length === 0) return null;
  return (
    <section aria-label="Summary" className="my-6 border border-rule bg-bg-elev px-4 py-3.5">
      <h2 className="mb-2.5 font-mono text-[13px] text-text-dim">Summary</h2>
      <ul className="space-y-2">
        {items.map((t, i) => (
          <li key={i} className="flex gap-2.5 font-mono text-[13px] leading-[21px] text-accent">
            <span aria-hidden className="select-none leading-[21px]">•</span>
            <span>{withLinks(t, String(i))}</span>
          </li>
        ))}
      </ul>
    </section>
  );
}
