import { defineConfig } from "astro/config";

// Static output (default) — deploys to Cloudflare Pages as plain files in dist/.
export default defineConfig({
  // Live custom domain — drives canonical + Open Graph URLs.
  site: "https://blog.welldun.ai",
  markdown: {
    shikiConfig: {
      theme: "github-light", // light code theme to match the paper aesthetic
      wrap: true,
    },
  },
});
