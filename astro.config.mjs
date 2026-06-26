import { defineConfig } from "astro/config";

// Static output (default) — deploys to Cloudflare Pages as plain files in dist/.
export default defineConfig({
  // Default Cloudflare Pages URL for this project. Change to your custom domain later.
  site: "https://welldun-blog.pages.dev",
  markdown: {
    shikiConfig: {
      theme: "github-light", // light code theme to match the paper aesthetic
      wrap: true,
    },
  },
});
