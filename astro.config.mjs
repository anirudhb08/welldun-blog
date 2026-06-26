import { defineConfig } from "astro/config";
import sitemap from "@astrojs/sitemap";

// Static output (default) — deploys to Cloudflare as static assets.
export default defineConfig({
  // Live custom domain — drives canonical, sitemap, RSS, and Open Graph URLs.
  site: "https://blog.welldun.ai",
  integrations: [sitemap()],
  markdown: {
    shikiConfig: {
      theme: "github-light", // light code theme to match the paper aesthetic
      wrap: true,
    },
  },
});
