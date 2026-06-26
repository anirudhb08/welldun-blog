import { defineCollection, z } from "astro:content";

const posts = defineCollection({
  type: "content",
  schema: z.object({
    title: z.string(),
    dek: z.string(), // one-line subtitle / standfirst
    series: z.string(), // slug from src/series.ts
    part: z.number(), // ordering within the series (0 = intro)
    date: z.coerce.date(),
    readingTime: z.string().optional(),
    tags: z.array(z.string()).default([]),
    draft: z.boolean().default(false),
  }),
});

export const collections = { posts };
