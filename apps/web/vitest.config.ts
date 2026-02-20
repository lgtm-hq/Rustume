import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";
import solid from "vite-plugin-solid";

export default defineConfig({
  plugins: [
    solid(),
    {
      name: "wasm-stub",
      enforce: "pre",
      resolveId(id) {
        if (/rustume_wasm/.test(id)) return "\0virtual:rustume_wasm";
      },
      load(id) {
        if (id === "\0virtual:rustume_wasm") {
          return 'throw new Error("WASM not available in test environment");';
        }
      },
    },
  ],
  test: {
    environment: "jsdom",
    globals: true,
    setupFiles: ["./src/test/setup.ts"],
    coverage: {
      provider: "v8",
      include: ["src/**/*.{ts,tsx}"],
      exclude: ["src/vite-env.d.ts", "src/test/**", "src/index.tsx", "src/wasm/types.ts"],
    },
  },
  resolve: {
    alias: {
      "~": fileURLToPath(new URL("./src", import.meta.url)),
    },
  },
});
