import { resolve } from "node:path";
import { defineConfig, externalizeDepsPlugin } from "electron-vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { tanstackRouter } from "@tanstack/router-plugin/vite";

export default defineConfig({
  main: {
    plugins: [externalizeDepsPlugin()],
    build: {
      outDir: "out/main",
      lib: { entry: resolve("electron/main.ts") },
      rollupOptions: { output: { format: "cjs", entryFileNames: "index.cjs" } },
    },
  },
  preload: {
    plugins: [externalizeDepsPlugin()],
    build: {
      outDir: "out/preload",
      lib: { entry: resolve("electron/preload.ts") },
      // CommonJS keeps preload compatible with contextIsolation without ESM edge cases.
      rollupOptions: { output: { format: "cjs", entryFileNames: "index.cjs" } },
    },
  },
  renderer: {
    root: ".",
    resolve: {
      alias: { "@": resolve("src") },
    },
    plugins: [
      tanstackRouter({ target: "react", autoCodeSplitting: true }),
      react(),
      tailwindcss(),
    ],
    build: {
      outDir: "out/renderer",
      rollupOptions: { input: resolve("index.html") },
    },
  },
});
