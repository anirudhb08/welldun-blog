import rss from "@astrojs/rss";
import { getCollection } from "astro:content";
import { seriesBySlug } from "../series";

export async function GET(context) {
  const posts = (await getCollection("posts", ({ data }) => !data.draft)).sort(
    (a, b) => b.data.date.valueOf() - a.data.date.valueOf(),
  );
  return rss({
    title: "Anirudh — Notebook",
    description:
      "Working notes on the systems I build — data platforms, voice agents, and whatever I'm currently nerding out on.",
    site: context.site,
    items: posts.map((p) => ({
      title: p.data.title,
      description: p.data.dek,
      pubDate: p.data.date,
      link: `/posts/${p.slug}/`,
      categories: [seriesBySlug[p.data.series]?.title ?? p.data.series, ...p.data.tags],
    })),
    customData: `<language>en-us</language>`,
  });
}
