import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// Served from https://mangluu.github.io/just-guessing/
export default defineConfig({
  base: "/just-guessing/",
  plugins: [react()],
  worker: { format: "es" },
  optimizeDeps: { exclude: ["@huggingface/transformers"] },
  // the main chunk carries the whole precomputed race, about 100 KB gzipped
  build: { chunkSizeWarningLimit: 1200 },
});
