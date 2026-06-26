import { getCollection } from "astro:content";
import { OGImageRoute } from "astro-og-canvas";
import { seriesBySlug } from "../../series";

const posts = await getCollection("posts", ({ data }) => !data.draft);

// one entry per generated PNG: a site default + every post
const pages: Record<string, { title: string; description: string }> = {
  default: {
    title: "welldun — building at the seam of software and AI.",
    description: "Field notes on multi-tenant infrastructure: entity platforms, voice, email.",
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
  getImageOptions: (_path, page) => ({
    title: page.title,
    description: page.description,
    bgGradient: [[239, 233, 218]], // vellum
    border: { color: [216, 71, 43], width: 18, side: "inline-start" }, // vermilion left rule
    padding: 80,
    font: {
      title: { color: [27, 36, 56], size: 64, weight: "Bold", lineHeight: 1.15 },
      description: { color: [70, 80, 102], size: 30, lineHeight: 1.4 },
    },
    format: "PNG",
  }),
});
