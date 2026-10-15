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
  // welldun design system: surface ground, ink title in Archivo Expanded, the switchboard strip along the foot.
  getImageOptions: (_path, page) => ({
    title: page.title,
    description: page.description,
    bgImage: { path: "./src/og/background.png", fit: "cover" },
    logo: { path: "./src/og/wordmark.png" },
    padding: 80,
    fonts: ["./src/og/ArchivoExpanded-Bold.ttf", "./src/og/Archivo-Regular.ttf"],
    font: {
      title: { color: [21, 22, 24], size: 58, weight: "Bold", lineHeight: 1.08, families: ["Archivo Expanded"] },
      description: { color: [91, 93, 97], size: 28, lineHeight: 1.4, families: ["Archivo"] },
    },
    format: "PNG",
  }),
});
