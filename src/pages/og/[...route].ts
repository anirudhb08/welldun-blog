import { getCollection } from "astro:content";
import { OGImageRoute } from "astro-og-canvas";
import { seriesBySlug } from "../../series";

const posts = await getCollection("posts", ({ data }) => !data.draft);

// one entry per generated PNG: a site default + every post
const pages: Record<string, { title: string; description: string }> = {
  default: {
    title: "Notes from building infrastructure for AI agents.",
    description: "welldun · open infrastructure for AI agents that do real work.",
  },
};
for (const p of posts) {
  const s = seriesBySlug[p.data.series]?.title ?? p.data.series;
  pages[`posts/${p.slug}`] = {
    title: p.data.title,
    description: `${s} · ${p.data.dek}`,
  };
}

export const { getStaticPaths, GET } = OGImageRoute({
  param: "route",
  pages,
  // welldun design system v2: warm surface, ink title in Figtree, pastel tiles and a waveform along the foot.
  getImageOptions: (_path, page) => ({
    title: page.title,
    description: page.description,
    bgImage: { path: "./src/og/background.png", fit: "cover" },
    logo: { path: "./src/og/wordmark.png" },
    padding: 80,
    fonts: ["./src/og/Figtree-Bold.ttf", "./src/og/Figtree-Regular.ttf"],
    font: {
      title: { color: [31, 29, 26], size: 64, weight: "Bold", lineHeight: 1.08, families: ["Figtree"] },
      description: { color: [107, 102, 94], size: 30, lineHeight: 1.4, families: ["Figtree"] },
    },
    format: "PNG",
  }),
});
