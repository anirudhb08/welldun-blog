import { defineConfig } from "astro/config";

// Static output (default) — deploys to Cloudflare Pages as plain files in dist/.
export default defineConfig({
  // Set this to your Pages URL (or custom domain) for correct canonical/OG links.
  site: "https://drafting-table.pages.dev",
  markdown: {
    shikiConfig: {
      theme: "github-light", // light code theme to match the paper aesthetic
      wrap: true,
    },
  },
});
