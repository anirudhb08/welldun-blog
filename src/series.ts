// Series metadata. A "series" groups related posts (a post's `series` frontmatter is one
// of these slugs) — typically one welldun project. Add an entry when you start a new one.
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
    dek: "Building a multi-tenant platform where every customer designs their own database — the entity platform.",
    status: "active",
  },
  {
    slug: "offhook",
    title: "Offhook",
    dek: "Building an open-source, self-hostable API for AI phone calls: STT, an LLM and TTS over a real phone line.",
    status: "active",
  },
  {
    slug: "email-infra",
    title: "Email Infra",
    dek: "A multi-tenant email-sending API — BYO SendGrid/Resend, envelope encryption, a Postgres work queue, signed webhooks.",
    status: "planned",
  },
];

export const seriesBySlug: Record<string, Series> = Object.fromEntries(
  series.map((s) => [s.slug, s]),
);
