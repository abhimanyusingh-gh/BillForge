import path from "node:path";
import { fileURLToPath } from "node:url";
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

const projectRoot = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      "@": path.resolve(projectRoot, "src")
    }
  },
  server: {
    port: 5173,
    proxy: {
      "/api": "http://localhost:4100",
      "/health": "http://localhost:4100"
    }
  },
  build: {
    outDir: "dist",
    sourcemap: false
  }
});
