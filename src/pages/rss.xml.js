import rss from "@astrojs/rss";
import { getCollection } from "astro:content";
import { seriesBySlug } from "../series";
import { SITE } from "../site";

export async function GET(context) {
  const posts = (await getCollection("posts", ({ data }) => !data.draft)).sort(
    (a, b) => b.data.date.valueOf() - a.data.date.valueOf(),
  );
  return rss({
    title: `${SITE.name} — software × AI`,
    description: SITE.description,
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
