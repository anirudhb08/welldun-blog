# welldun-blog

A personal notebook — working notes on the systems I build (data platforms, voice agents,
and whatever I'm currently nerding out on). Built with [Astro](https://astro.build) (static
output) and deployed on **Cloudflare Pages**.

Writing is organized into **series** (multi-part deep dives). The first series, *Drafting
Table*, documents building a multi-tenant platform where customers design their own database.

Aesthetic: an engineering field-notebook — vellum ground, ink-navy text, a vermilion accent,
Fraunces (display) + Newsreader (prose) + JetBrains Mono (code/labels).

## Local development

```bash
pnpm install        # or: npm install
pnpm dev            # http://localhost:4321
pnpm build          # static site → ./dist
pnpm preview        # serve the built ./dist locally
```

## How it's organized

```
src/
  series.ts                 # series registry (title, dek, status: active | planned)
  content/posts/*.md        # posts (Markdown + frontmatter)
  pages/
    index.astro             # home: hero + series cards + latest writing
    series/[slug].astro      # one page per series (lists its posts)
    posts/[...slug].astro    # one page per post
  layouts/                  # Base (shell) + Post (article)
  styles/global.css         # the design system
```

### Adding a post

Create `src/content/posts/<name>.md`:

```yaml
---
title: "Your title"
dek: "One-line subtitle."
series: "drafting-table"   # a slug from src/series.ts
part: 5                     # ordering within the series (0 = intro)
date: 2026-07-01
readingTime: "8 min"
tags: ["postgres"]
draft: false                # true hides it everywhere
---
```

### Starting a new series

Add an entry to `src/series.ts`, then write posts with that `series` slug. A series with
published posts automatically gets a card on the home and its own `/series/<slug>` page.
Mark a series `status: "planned"` to tease it before any posts exist.

## Deploy to Cloudflare Pages

Static output means Pages just serves `dist/`.

### Git-connected (recommended)
Cloudflare dashboard → **Workers & Pages → Create → Pages → Connect to Git**:

| Setting | Value |
|---|---|
| Framework preset | Astro |
| Build command | `pnpm build` (or `npm run build`) |
| Build output directory | `dist` |
| Environment variable | `NODE_VERSION = 20` |

### Direct upload
```bash
pnpm build
npx wrangler pages deploy dist --project-name=welldun-blog
```

After the first deploy, set `site` in `astro.config.mjs` to your Pages URL (or custom
domain) so canonical and Open Graph links are correct.

> Fully static — no adapter needed. If a future post needs server rendering, add
> `@astrojs/cloudflare` and switch `output` to `"server"`.
