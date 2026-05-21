# Design Proposal — Quantamental Research Site

Read order: IA → Type → Color → Scale → Grid → Layout sketches → Tech notes → Open questions.

This is a proposal. Nothing has been built yet. Approve, redline, or reject before I touch components.

---

## 1. Information architecture

```
/                       Home — dense status bar + 3-col grid (no hero)
/research               Index — terminal-screener filter (tags × dates)
/research/[slug]        Single — MDX, KaTeX, code, footnotes
/backtests              Index — grid of strategy cards w/ mini equity curves
/backtests/[slug]       Single — equity / drawdown / heatmap / stats / methodology
/notes                  Index — chronological list, no card UI
/notes/[slug]           Single — MDX
/bio                    Long-form prose + "Changed my mind about"
/now                    Single MDX file (nownownow style)
/bookshelf              Grouped by theme, not date
/terminal               Hidden — Easter egg (fake Bloomberg command line)
```

**Global chrome**
- Top: persistent status bar (name · role · location · live local time · 4 tickers). 28px tall, monospace, thin bottom rule.
- Bottom: thin research-log ticker band (latest note · latest commit · latest paper added). Scrolls slowly, left-to-right, pauseable on hover.
- No conventional nav bar with logo + menu. Nav lives inline in the status bar — `[ research ] [ backtests ] [ notes ] [ bio ] [ now ] [ books ]` in mono, square brackets included. Active route is amber.

**Content sources (all local, no CMS)**
```
/content
  /research/*.mdx       — frontmatter: title, date, abstract, tags, links{pdf,code,ssrn,data}
  /notes/*.mdx          — frontmatter: title, date, tags
  /backtests
    /[slug]
      index.mdx         — methodology, narrative
      equity.json       — daily {date, value} (also benchmark optional)
      stats.json        — CAGR, Sharpe, Sortino, Calmar, MaxDD, hitRate, turnover, exposure
      monthly.json      — flat {year, month, ret} for heatmap
  /bookshelf.json       — themes[].books[].{title,author,year,coverPath,note}
  /now.mdx              — single file, plain MDX
```

---

## 2. Typography

**Three faces. No more.**

| Role | Face | Why | Fallback stack |
|---|---|---|---|
| Body / data / UI | **JetBrains Mono** | Best-in-class tabular figures, six-zero variants, readable at 12–14px, ligatures off by default | `ui-monospace, "Cascadia Mono", Menlo, Consolas, monospace` |
| Display headings | **Geist** (Vercel, OFL) | Sharp neo-grotesque, free, ships with `tnum` and SS01 alternates. Söhne-adjacent without licensing | `"Inter Display", "Helvetica Neue", Helvetica, Arial, sans-serif` |
| Long-form prose (bio, research body) | **Source Serif 4** | Adobe's open-source serif. High contrast, generous x-height, sits well next to mono | `"Iowan Old Style", "Charter", Georgia, serif` |

Self-host all three via `next/font/local` (no Google CDN). Variable axes only.

**Ligatures**: off everywhere (`font-variant-ligatures: none`) — quants read code and numbers, not typographic gymnastics.

**Tabular numerals**: globally on. `font-feature-settings: "tnum" 1, "cv09" 1, "ss01" 1;` on body. Plus a Tailwind utility `font-tabular` for explicit numeric cells (decimal alignment is enforced via `font-variant-numeric: tabular-nums slashed-zero`).

---

## 3. Color tokens

Restricted palette, declared as CSS variables. Dark is the canonical theme; light is a derived inverse, not equal-weight.

```css
/* Dark (default) */
--bg:           #0a0a0a;   /* page */
--bg-elev:      #111111;   /* subtle elevation — table headers, code blocks */
--bg-sunken:    #060606;   /* status bar, terminal route */
--rule:         #1f1f1f;   /* thin 1px dividers — most of the site */
--rule-strong:  #2a2a2a;   /* section dividers, table outer borders */
--text:         #e4e4e4;   /* primary */
--text-dim:     #8a8a8a;   /* secondary — metadata, captions */
--text-faint:   #555555;   /* tertiary — placeholder, disabled */
--accent:       #ffb000;   /* terminal amber — links, active, highlights */
--accent-dim:   #b87d00;   /* hover/pressed amber */
--data:         #5cc8d7;   /* muted cyan — tickers, secondary series */
--pos:          #4dd277;   /* P&L green — chart series only */
--neg:          #ff4d4d;   /* P&L red — chart series only */
--warn:         #d9a441;   /* stale-data badge */

/* Light (toggle) — inverted, NOT a different design */
--bg:           #f7f5f0;   /* warm off-white, paper-feel, not cold white */
--bg-elev:      #efece5;
--bg-sunken:    #ffffff;
--rule:         #dcd8cf;
--rule-strong:  #c9c4b8;
--text:         #1a1a1a;
--text-dim:     #5c5c5c;
--text-faint:   #999999;
--accent:       #c47e00;   /* amber drops contrast on paper bg */
--data:         #2c7d8a;
--pos:          #1f9851;
--neg:          #c83232;
```

**Rules of use**
- Amber is sacred. Used for: links (underlined), active nav, current page indicator, chart axis labels at hover. Nothing else. Never for body emphasis (use weight or italics).
- Cyan is for *data labels and secondary chart series only*. Never as a UI accent.
- Pos/neg are *only* in charts and P&L cells. Never in UI states (success toasts etc.).
- Borders default to `--rule` (1px solid). Visual hierarchy comes from *position and density*, not from box shadows. **No shadows anywhere.** No glow, no halo.

---

## 4. Type scale

Modular but tight. Base 14px. No clamp() — fixed sizes; we are not afraid of dense type.

| Token | px / line-height | Use |
|---|---|---|
| `text-2xs` | 10 / 14 | Ticker deltas, sparkline labels |
| `text-xs` | 11 / 16 | Tag chips, table footnotes, metadata |
| `text-sm` | 12 / 18 | Captions, status bar, secondary table cells |
| `text-base` | 14 / 22 | Body, primary table cells, research index rows |
| `text-md` | 16 / 24 | Notes/research prose (mono body) |
| `text-lg` | 18 / 26 | H4 — subsection within an article |
| `text-xl` | 22 / 28 | H3 |
| `text-2xl` | 28 / 32 | H2 — section heads |
| `text-3xl` | 36 / 40 | H1 — page titles (Geist) |
| `text-display` | 56 / 60 | Reserved: homepage section labels, terminal banner |

H1–H3 in Geist; everything else in JetBrains Mono. Long-form prose route (`/bio`, `/notes/[slug]` *if* serif-mode flag set) swaps body to Source Serif 4 at 17/28.

---

## 5. Spacing & grid

**Spacing scale** — 4px base. Tight rhythm; whitespace is rationed.
`0, 2, 4, 6, 8, 12, 16, 20, 24, 32, 40, 56, 80`. No values between (no 14, no 18).

**Grid**
- Container max: **1408px** (90rem). Wide on purpose — Bloomberg-feel, not a centered blog column.
- Columns: 12. Gutter: 16px desktop / 12px tablet / 8px mobile.
- Outer padding: 24px desktop / 16px mobile.
- Home three-column split: **3 / 6 / 3** of 12 (left notes / center chart / right Now feed).
- Research index: **9 / 3** (table / filter sidebar).
- Backtest single: **8 / 4** (charts+stats / methodology aside) on wide; stacks below 1024px.
- Long-form (`/bio`, `/notes/[slug]`): max measure **66ch**, left-aligned (not centered).

**Rules**
- Borders are 1px solid `--rule`. Never 2px. Never dashed (except chart guides, where 1px dashed `--rule-strong` is allowed).
- Section dividers are thin rules with a tight `text-xs` label, e.g. `─── RESEARCH ───` — uppercase Geist 10/12 tracking +0.08em, sitting *on* the rule.
- No rounded corners above 2px. Most components use sharp 0px corners. Tag chips: 2px.

---

## 6. Component-level decisions worth surfacing now

- **Tables**: zebra stripes off. Row separation by 1px `--rule` only. Numeric cells right-aligned with `tabular-nums slashed-zero`. Decimal alignment via a custom `<Num value={x} decimals={2} />` component that splits integer/decimal parts and pads with hair space.
- **Code blocks**: Shiki, custom theme exported from these tokens. Background `--bg-elev`, no rounded corners, 1px `--rule` border, line numbers in `--text-faint`. Inline code uses `--bg-elev` with 2px horizontal padding.
- **Math**: KaTeX. Display equations get a 1px top + bottom rule, 24px vertical padding, centered, slightly larger (1.05em). Equation numbers right-aligned in `--text-dim`.
- **Tag chips**: square brackets in mono — `[ #factors ]`. Hover turns text amber. No background fill.
- **Filter UI** (research index): inline checkboxes with `[x]` / `[ ]` in mono, tag name, and a count `(12)` in `--text-dim`. No pill buttons.
- **Charts**: D3 for homepage centerpiece and backtest equity/drawdown/heatmap. Observable Plot for one-offs. Custom theme: 1px axes in `--text-faint`, gridlines in `--rule` at 0.5 opacity, tick labels in JetBrains Mono 10px, no chart title (title lives in the surrounding layout).
- **Live ticker**: server-side fetch every 60s with `unstable_cache`, client revalidates via SWR. On failure, render last-cached value + a small `*` superscript linking to a tooltip `stale: 4m 12s`. Sparkline is 60×16px, 1px stroke, no fill.
- **Cmd+K palette**: full-bleed modal on `--bg-sunken` with 1px `--rule-strong` border. Input is a single line, no rounded corners, prefixed with `>`. Results are mono rows; selected row has amber left border (2px inset).

---

## 7. Homepage layout sketch (ASCII)

```
┌───────────────────────────────────────────────────────────────────────────┐
│ [YOUR NAME] · quant researcher · [CITY] · 14:32:07 ET                     │
│ SPY 478.21 +0.42% ▴   QQQ 412.66 −0.18% ▾   BTC 67,210 +1.10% ▴   …       │
├───────────────────────────────────────────────────────────────────────────┤
│ [ research ] [ backtests ] [ notes ] [ bio ] [ now ] [ books ]            │
├──────────────────────┬──────────────────────────────┬─────────────────────┤
│ ─── LATEST NOTES ─── │ ─── QUALITY-MINUS-JUNK ───   │ ─── NOW ───         │
│                      │                              │                     │
│ 2026-05-18  Cross-   │   [interactive D3 chart      │ reading             │
│   sectional momentum │    — full equity curve,      │   · Asness, '24     │
│   in EM small caps   │    hover crosshair, brush    │   · Lo, "Adaptive   │
│ 2026-04-30  Notes on │    zoom, mono axes]          │     Markets"        │
│   Asness '24 …       │                              │                     │
│ 2026-04-12  …        │                              │ building            │
│ …                    │                              │   · this site       │
│                      │                              │                     │
├──────────────────────┴──────────────────────────────┴─────────────────────┤
│ research log: 2026-05-21 13:02 commit f3a2c1 → site • 2026-05-19 added …  │
└───────────────────────────────────────────────────────────────────────────┘
```

Density: roughly 60% of the fold is content, 0% is decoration.

---

## 8. Tech notes worth confirming

- **Next.js 15 App Router + TypeScript + Tailwind v4.** Tailwind v4's `@theme` directive holds the tokens; no `tailwind.config.ts` needed.
- **MDX** via `@next/mdx` with `remark-math` + `rehype-katex` + a Shiki rehype plugin. Frontmatter via `gray-matter`. I'm picking this over Contentlayer because Contentlayer's status is shaky and the file shapes here are simple.
- **D3 v7** for charts. Observable Plot for the bookshelf timeline (if added later) — not needed for v1.
- **Market data**: `yahoo-finance2` (no key, server-side only). Server route caches 60s. If we want to swap to Finnhub later, the fetcher is one file.
- **GitHub feed** for research log: `https://api.github.com/users/<handle>/events/public`, server-cached 5min, unauthenticated (60 req/hour suffices).
- **Hosting**: Vercel, edge runtime for the ticker route, node runtime for MDX-heavy pages.
- **No analytics in v1.** Add Plausible later if desired.

---

## 9. What I need from you to start building

**A. Personal details (the `[YOUR NAME]` blanks):**
- Full name
- One-line bio / role
- City
- Email (use anthonyhuang55555@gmail.com? confirm)
- Handles: X/Twitter, LinkedIn, GitHub, SSRN (any combination — leave blank if none)
- One-line tagline

**B. Design approval — anything to redline?**
- Font choices (Geist / JetBrains Mono / Source Serif 4) — OK or swap?
- Palette — amber #FFB000 + cyan #5cc8d7, light mode warm paper, OK?
- Type scale base of 14px — OK or smaller (13) / larger (15)?
- Three-column home with **left notes / center chart / right Now** — or different split?

**C. Three design-direction choices I'd rather you make than guess:**

1. **Homepage centerpiece chart subject** — pick one:
   - (a) Equity curve of one of the sample backtests (most "live trading desk" feel)
   - (b) A factor spread you watch (quality-minus-junk, value, momentum) — requires more setup; I'd synthesize realistic data for v1
   - (c) Your publication cadence over time (cumulative notes + research) — most personal, least "quant"
   - **My pick**: (a). Strongest first impression. Swappable later via a single JSON file.

2. **Long-form prose face** — `/bio` and `/notes/[slug]`:
   - (a) Stay in JetBrains Mono throughout (most consistent, most "terminal")
   - (b) Switch to Source Serif 4 for long-form (more journal-feel, more readable past 800 words)
   - **My pick**: (b), but only on `/bio` and `/notes/[slug]`. Research stays mono because it's heavy on code/math.

3. **Easter egg** — pick one:
   - (a) `/terminal` route — fake Bloomberg command line, accepts `HELP`, `DES <ticker>`, `GIP`, `QUIT`. ~150 lines of code.
   - (b) Konami code → screen flickers, status bar swaps to green CRT phosphor for 30s
   - (c) View-source ASCII art (greppable signature + an invitation to email)
   - **My pick**: (a). It's the most thematically appropriate and the most fun to build well.

---

## 10. What gets built once approved (in order)

1. Repo scaffold, tokens, fonts, base layout (status bar + footer ticker shell — non-live data first).
2. Homepage with centerpiece chart on **synthetic data**, real live-ticker hookup, real GitHub feed.
3. Research index + single-page template + 3 sample MDX entries.
4. Backtests: equity/drawdown/heatmap/stats components + 2 sample backtests with GBM-synthesized data.
5. Notes, Bio, Now, Bookshelf.
6. Cmd+K palette + research log ticker polish.
7. `/terminal` Easter egg.
8. `README.md` + completed `DESIGN.md` (this doc, finalized) + Lighthouse pass.

Commits along the way, logical groupings (one per numbered step above).

---

Reply with personal details + any redlines on §2–6 + your picks (or overrides) for §9C. I'll start with step 1 immediately on approval.
