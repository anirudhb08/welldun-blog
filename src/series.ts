// Series metadata. A "series" groups related posts (a post's `series` frontmatter is one
// of these slugs). Add a new entry here when you start a new multi-part topic.
export interface Series {
  slug: string;
  title: string;
  dek: string;
  status?: "active" | "planned";
}

export const series: Series[] = [
  {
    slug: "drafting-table",
    title: "Drafting Table",
    dek: "Building a multi-tenant platform where every customer designs their own database.",
    status: "active",
  },
  {
    slug: "voice-agents",
    title: "Voice Agents",
    dek: "Notes on building real-time voice agents — latency, turn-taking, and the messy bits.",
    status: "planned",
  },
];

export const seriesBySlug: Record<string, Series> = Object.fromEntries(
  series.map((s) => [s.slug, s]),
);
