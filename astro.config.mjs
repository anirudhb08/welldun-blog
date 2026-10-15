import { defineConfig } from "astro/config";
import sitemap from "@astrojs/sitemap";

// Static output (default) — deploys to Cloudflare as static assets.
export default defineConfig({
  // Live custom domain — drives canonical, sitemap, RSS, and Open Graph URLs.
  site: "https://blog.welldun.ai",
  integrations: [sitemap()],
  markdown: {
    shikiConfig: {
      // Colours come from the design system's code tokens (see .wd-prose pre.astro-code in global.css).
      theme: "css-variables",
      wrap: true,
    },
  },
});
