import { defineConfig } from "vite";
import solid from "vite-plugin-solid";
import { VitePWA } from "vite-plugin-pwa";
import tailwindcss from "@tailwindcss/vite";

export default defineConfig({
  plugins: [
    solid(),
    tailwindcss(),
    VitePWA({
      registerType: "autoUpdate",
      includeAssets: ["favicon.svg", "icons/*.png"],
      manifest: {
        name: "Rustume",
        short_name: "Rustume",
        description: "Privacy-first resume builder",
        theme_color: "#1a1a1a",
        background_color: "#fdfcfa",
        display: "standalone",
        icons: [
          {
            src: "icons/icon-192.png",
            sizes: "192x192",
            type: "image/png",
          },
          {
            src: "icons/icon-512.png",
            sizes: "512x512",
            type: "image/png",
          },
          {
            src: "icons/icon-512.png",
            sizes: "512x512",
            type: "image/png",
            purpose: "maskable",
          },
        ],
      },
      workbox: {
        globPatterns: ["**/*.{js,css,html,svg,png,woff2,wasm}"],
        runtimeCaching: [
          {
            urlPattern: /\.wasm$/,
            handler: "CacheFirst",
            options: {
              cacheName: "wasm-cache",
              expiration: {
                maxAgeSeconds: 30 * 24 * 60 * 60, // 30 days
              },
            },
          },
          {
            urlPattern: /^https:\/\/fonts\.googleapis\.com/,
            handler: "StaleWhileRevalidate",
            options: {
              cacheName: "google-fonts-stylesheets",
            },
          },
          {
            urlPattern: /^https:\/\/fonts\.gstatic\.com/,
            handler: "CacheFirst",
            options: {
              cacheName: "google-fonts-webfonts",
              expiration: {
                maxAgeSeconds: 365 * 24 * 60 * 60, // 1 year
              },
            },
          },
          {
            urlPattern: /\/api\/templates/,
            handler: "StaleWhileRevalidate",
            options: {
              cacheName: "api-templates",
            },
          },
        ],
      },
    }),
  ],
  server: {
    proxy: {
      "/api": {
        target: "http://localhost:3000",
        changeOrigin: true,
      },
    },
  },
  build: {
    target: "esnext",
    chunkSizeWarningLimit: 500,
    rollupOptions: {
      // Handle dynamic WASM import - will fail gracefully at runtime if not present
      external: (id) => /\/wasm\/rustume_wasm/.test(id),
      output: {
        manualChunks(id) {
          if (id.includes("@tiptap/") || id.includes("prosemirror")) {
            return "tiptap";
          }
          if (id.includes("@thisbeyond/solid-dnd")) {
            return "solid-dnd";
          }
          if (id.includes("@kobalte/")) {
            return "kobalte";
          }
          if (id.includes("@lgtm-hq/turbo-themes")) {
            return "turbo-themes";
          }
        },
      },
    },
  },
  optimizeDeps: {
    exclude: ["rustume_wasm"],
  },
  resolve: {
    alias: {
      "~": "/src",
    },
  },
});
