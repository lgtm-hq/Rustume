// @ts-check
import { defineConfig, envField } from "astro/config";
import sitemap from "@astrojs/sitemap";
import { rehypeSiteImages } from "./src/lib/rehype-site-images.mjs";
import { rehypeDocLinks, rehypeUnwrapHeadingLinks } from "./src/lib/rehype-doc-links.mjs";

/** @param {string | undefined} value */
function trimmedEnv(value) {
  const trimmed = value?.trim();
  return trimmed ? trimmed : undefined;
}

const base = trimmedEnv(process.env.ASTRO_BASE) ?? "/";
const cloudAppUrl =
  trimmedEnv(process.env.PUBLIC_CLOUD_APP_URL) ??
  trimmedEnv(process.env.PUBLIC_CLOUD_APP_URL_DEFAULT) ??
  "https://app.rustume.com";

/** @type {import('astro').AstroUserConfig} */
export default defineConfig({
  site: "https://rustume.com",
  env: {
    schema: {
      PUBLIC_CLOUD_APP_URL: envField.string({
        context: "client",
        access: "public",
        default: cloudAppUrl,
      }),
    },
  },
  base,
  output: "static",
  integrations: [sitemap()],
  markdown: {
    shikiConfig: { theme: "css-variables", wrap: true },
    rehypePlugins: [[rehypeSiteImages, base], rehypeUnwrapHeadingLinks, [rehypeDocLinks, base]],
  },
  build: { format: "directory" },
  vite: {
    build: {
      target: "esnext",
      assetsInlineLimit: 0,
    },
  },
});
